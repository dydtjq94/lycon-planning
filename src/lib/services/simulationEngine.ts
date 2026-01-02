import type {
  OnboardingData,
  FinancialItemInput,
  IncomeData,
  ExpenseData,
  SavingsData,
  PensionData,
  DebtData,
  RealEstateData,
  SimulationSettings,
  GlobalSettings,
} from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import { migrateOnboardingToFinancialItems, isItemActiveAt } from './dataMigration'
import { DEFAULT_RATES } from './defaultItems'
import {
  calculateRemainingBalance,
  calculateYearlyPrincipalPayment,
  calculateYearlyInterestPayment,
  calculateAnnualPensionWithdrawal,
  getEffectiveDebtRate,
  type RepaymentType,
} from '../utils/loanCalculator'

// ============================================
// 타입 정의
// ============================================

export interface YearlySnapshot {
  year: number
  age: number

  // 현금흐름
  totalIncome: number        // 연간 총 수입
  totalExpense: number       // 연간 총 지출
  netCashFlow: number        // 연간 순현금흐름 (저축 가능액)

  // 자산
  totalAssets: number        // 총 자산
  realEstateValue: number    // 부동산 가치
  financialAssets: number    // 금융자산 (현금 + 투자)
  pensionAssets: number      // 연금자산

  // 부채
  totalDebts: number         // 총 부채

  // 순자산
  netWorth: number           // 순자산 (자산 - 부채)

  // 상세 breakdown
  incomeBreakdown: { title: string; amount: number }[]
  expenseBreakdown: { title: string; amount: number }[]
  assetBreakdown: { title: string; amount: number }[]
  debtBreakdown: { title: string; amount: number }[]
  pensionBreakdown: { title: string; amount: number }[]
}

export interface SimulationResult {
  startYear: number
  endYear: number
  retirementYear: number
  snapshots: YearlySnapshot[]

  // 요약 지표
  summary: {
    currentNetWorth: number
    retirementNetWorth: number
    peakNetWorth: number
    peakNetWorthYear: number
    yearsToFI: number | null  // 경제적 자유 달성 연도 (null = 미달성)
    fiTarget: number          // FI 목표 (연간 지출 x 25)
  }
}

// ============================================
// 핵심 계산 함수
// ============================================

/**
 * OnboardingData로부터 시뮬레이션 실행
 */
export function runSimulation(
  data: OnboardingData,
  settings?: Partial<SimulationSettings>,
  yearsToSimulate: number = 50,
  globalSettings?: GlobalSettings
): SimulationResult {
  const currentYear = new Date().getFullYear()
  const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : currentYear - 35
  const currentAge = currentYear - birthYear
  const retirementYear = birthYear + (data.target_retirement_age || 60)
  const endYear = currentYear + yearsToSimulate

  // OnboardingData를 FinancialItem으로 변환
  const items = migrateOnboardingToFinancialItems(data, 'simulation')

  // 글로벌 설정 (우선순위: globalSettings > data.globalSettings > 기본값)
  const gs = globalSettings || data.globalSettings || DEFAULT_GLOBAL_SETTINGS

  // 설정값 (GlobalSettings 우선 사용)
  const investmentReturn = (gs.investmentReturnRate ?? settings?.investmentReturn ?? DEFAULT_RATES.investmentReturn) / 100
  const inflationRate = (gs.inflationRate ?? settings?.inflationRate ?? DEFAULT_RATES.expenseGrowth) / 100
  const incomeGrowthRate = (gs.incomeGrowthRate ?? DEFAULT_RATES.incomeGrowth) / 100
  const realEstateGrowthRate = (gs.realEstateGrowthRate ?? DEFAULT_RATES.realEstateGrowth) / 100

  const snapshots: YearlySnapshot[] = []

  // 초기 자산 상태 계산
  let accumulatedSavings = calculateInitialSavings(items)
  let accumulatedPension = calculateInitialPension(items)
  let currentDebt = calculateInitialDebt(items)

  // 연도별 시뮬레이션
  for (let year = currentYear; year <= endYear; year++) {
    const age = year - birthYear
    const yearsSinceStart = year - currentYear

    // 해당 연도의 활성 항목 필터링
    const activeItems = items.filter(item => isItemActiveAt(item, year, 6))

    // 소득 계산 (성장률 반영, GlobalSettings 우선)
    const incomeItems = activeItems.filter(i => i.category === 'income')
    const incomeBreakdown = incomeItems.map(item => {
      const incomeData = item.data as IncomeData
      // 개별 항목 성장률 > GlobalSettings > 기본값
      const itemGrowthRate = incomeData.growthRate !== undefined
        ? incomeData.growthRate / 100
        : incomeGrowthRate
      const amount = incomeData.amount * Math.pow(1 + itemGrowthRate, yearsSinceStart) * 12
      return { title: item.title, amount: Math.round(amount) }
    })
    const totalIncome = incomeBreakdown.reduce((sum, i) => sum + i.amount, 0)

    // 연금 수령 (은퇴 후)
    const pensionIncomeItems = activeItems.filter(i => i.category === 'pension')
    const pensionIncome = pensionIncomeItems.reduce((sum, item) => {
      const pensionData = item.data as PensionData
      if (pensionData.expectedMonthlyAmount && year >= (item.start_year || 0)) {
        return sum + pensionData.expectedMonthlyAmount * 12
      }
      return sum
    }, 0)

    // 지출 계산 (물가상승률 반영, GlobalSettings 우선)
    const expenseItems = activeItems.filter(i => i.category === 'expense')
    const expenseBreakdown = expenseItems.map(item => {
      const expenseData = item.data as ExpenseData
      // 개별 항목 성장률 > GlobalSettings 인플레이션 > 기본값
      const itemGrowthRate = expenseData.growthRate !== undefined
        ? expenseData.growthRate / 100
        : inflationRate
      const itemStartYear = item.start_year || currentYear
      const yearsFromItemStart = Math.max(0, year - itemStartYear)
      const amount = expenseData.amount * Math.pow(1 + itemGrowthRate, yearsFromItemStart) * 12
      return { title: item.title, amount: Math.round(amount) }
    })
    const totalExpense = expenseBreakdown.reduce((sum, e) => sum + e.amount, 0)

    // 순현금흐름
    const netCashFlow = totalIncome + pensionIncome - totalExpense

    // 부채 상환 (정확한 상환 방식별 계산)
    const debtItems = items.filter(i => i.category === 'debt')
    const debtBreakdown = debtItems
      .filter(item => {
        const itemEndYear = item.end_year || 9999
        return year <= itemEndYear
      })
      .map(item => {
        const debtData = item.data as DebtData
        const itemEndYear = item.end_year || currentYear + 30
        const itemEndMonth = item.end_month || 12

        if (year > itemEndYear) return { title: item.title, amount: 0 }

        // 실효 금리 계산 (변동금리 지원)
        const effectiveRate = getEffectiveDebtRate(debtData, gs)
        const maturityDate = `${itemEndYear}-${String(itemEndMonth).padStart(2, '0')}`
        const repaymentType = debtData.repaymentType || '원리금균등상환'

        // 정확한 잔액 계산
        const asOfDate = new Date(year, 5, 30) // 6월 30일 기준
        const balanceResult = calculateRemainingBalance(
          {
            principal: debtData.currentBalance || debtData.principal,
            annualRate: effectiveRate,
            maturityDate,
            repaymentType: repaymentType as RepaymentType,
            loanStartDate: item.start_year
              ? `${item.start_year}-${String(item.start_month || 1).padStart(2, '0')}`
              : undefined,
          },
          asOfDate
        )

        return { title: item.title, amount: Math.round(balanceResult.remainingPrincipal) }
      })
    const totalDebts = debtBreakdown.reduce((sum, d) => sum + d.amount, 0)

    // 금융자산 성장 (투자수익률 반영)
    accumulatedSavings = accumulatedSavings * (1 + investmentReturn) + Math.max(0, netCashFlow)

    // 연금자산 성장 (은퇴 전까지)
    if (year < retirementYear) {
      accumulatedPension = accumulatedPension * (1 + investmentReturn)
    } else {
      // 은퇴 후 연금 인출 (연금 데이터의 수령 기간 활용)
      // 각 연금 항목의 수령 기간을 고려한 인출
      const pensionDataItems = pensionIncomeItems.map(item => item.data as PensionData)

      // 평균 수령 기간 계산 (기본값: 20년)
      const totalReceivingYears = pensionDataItems.reduce((sum, pd) => {
        return sum + (pd.paymentYears || pd.receivingYears || 20)
      }, 0)
      const avgReceivingYears = pensionDataItems.length > 0
        ? totalReceivingYears / pensionDataItems.length
        : 20

      // 연금 현가 기반 인출액 계산
      const pensionWithdrawal = calculateAnnualPensionWithdrawal(
        accumulatedPension,
        avgReceivingYears,
        investmentReturn * 100
      )
      accumulatedPension = Math.max(0, accumulatedPension - pensionWithdrawal)
    }

    // 부동산 가치 계산 (GlobalSettings 우선)
    const realEstateItems = items.filter(i => i.category === 'real_estate')
    const realEstateValue = realEstateItems.reduce((sum, item) => {
      const reData = item.data as RealEstateData
      if (reData.housingType === '자가') {
        // 개별 항목 상승률 > GlobalSettings > 기본값
        const itemGrowthRate = reData.appreciationRate !== undefined
          ? reData.appreciationRate / 100
          : realEstateGrowthRate
        return sum + (reData.currentValue || 0) * Math.pow(1 + itemGrowthRate, yearsSinceStart)
      }
      return sum
    }, 0)

    // 전세보증금 (자산으로 계산)
    const depositValue = realEstateItems.reduce((sum, item) => {
      const reData = item.data as RealEstateData
      if (reData.housingType === '전세' || reData.housingType === '월세') {
        return sum + (reData.deposit || 0)
      }
      return sum
    }, 0)

    // 자산 breakdown
    const assetBreakdown: { title: string; amount: number }[] = []
    if (realEstateValue > 0) assetBreakdown.push({ title: '부동산', amount: Math.round(realEstateValue) })
    if (depositValue > 0) assetBreakdown.push({ title: '전세보증금', amount: Math.round(depositValue) })
    if (accumulatedSavings > 0) assetBreakdown.push({ title: '금융자산', amount: Math.round(accumulatedSavings) })

    // 연금 breakdown
    const pensionBreakdown: { title: string; amount: number }[] = []
    if (accumulatedPension > 0) pensionBreakdown.push({ title: '연금자산', amount: Math.round(accumulatedPension) })

    // 총자산
    const financialAssets = Math.round(accumulatedSavings)
    const pensionAssets = Math.round(accumulatedPension)
    const totalAssets = Math.round(realEstateValue + depositValue + financialAssets + pensionAssets)

    // 순자산
    const netWorth = totalAssets - totalDebts

    snapshots.push({
      year,
      age,
      totalIncome: Math.round(totalIncome + pensionIncome),
      totalExpense: Math.round(totalExpense),
      netCashFlow: Math.round(netCashFlow),
      totalAssets,
      realEstateValue: Math.round(realEstateValue + depositValue),
      financialAssets,
      pensionAssets,
      totalDebts,
      netWorth,
      incomeBreakdown,
      expenseBreakdown,
      assetBreakdown,
      debtBreakdown,
      pensionBreakdown,
    })
  }

  // 요약 지표 계산
  const currentSnapshot = snapshots[0]
  const retirementSnapshot = snapshots.find(s => s.year === retirementYear) || currentSnapshot
  const peakSnapshot = snapshots.reduce((max, s) => s.netWorth > max.netWorth ? s : max, snapshots[0])

  // FI 목표 (연간 지출 x 25)
  const annualExpense = currentSnapshot.totalExpense
  const fiTarget = annualExpense * 25
  const fiSnapshot = snapshots.find(s => s.netWorth >= fiTarget)

  return {
    startYear: currentYear,
    endYear,
    retirementYear,
    snapshots,
    summary: {
      currentNetWorth: currentSnapshot.netWorth,
      retirementNetWorth: retirementSnapshot.netWorth,
      peakNetWorth: peakSnapshot.netWorth,
      peakNetWorthYear: peakSnapshot.year,
      yearsToFI: fiSnapshot ? fiSnapshot.year - currentYear : null,
      fiTarget,
    },
  }
}

// ============================================
// 헬퍼 함수
// ============================================

function calculateInitialSavings(items: FinancialItemInput[]): number {
  return items
    .filter(i => i.category === 'savings')
    .reduce((sum, item) => {
      const data = item.data as SavingsData
      return sum + (data.currentBalance || 0)
    }, 0)
}

function calculateInitialPension(items: FinancialItemInput[]): number {
  return items
    .filter(i => i.category === 'pension')
    .reduce((sum, item) => {
      const data = item.data as PensionData
      return sum + (data.currentBalance || 0)
    }, 0)
}

function calculateInitialDebt(items: FinancialItemInput[]): number {
  return items
    .filter(i => i.category === 'debt')
    .reduce((sum, item) => {
      const data = item.data as DebtData
      return sum + (data.currentBalance || data.principal || 0)
    }, 0)
}

// ============================================
// 간단한 현재 상태 계산 (대시보드용)
// ============================================

export interface CurrentFinancialState {
  // 월간 현금흐름
  monthlyIncome: number
  monthlyExpense: number
  monthlySavings: number
  savingsRate: number

  // 자산
  totalAssets: number
  realEstateAssets: number
  depositAssets: number      // 전세보증금
  cashAssets: number
  investmentAssets: number
  pensionAssets: number

  // 부채
  totalDebts: number
  housingDebt: number
  otherDebts: number

  // 순자산
  netWorth: number

  // 비율
  debtToAssetRatio: number   // 부채비율
  debtToIncomeRatio: number  // DTI
}

/**
 * OnboardingData에서 현재 재무 상태 계산
 */
export function calculateCurrentState(data: OnboardingData): CurrentFinancialState {
  // 월간 소득
  const monthlyIncome =
    (data.laborIncome || 0) +
    (data.spouseLaborIncome || 0) +
    (data.businessIncome || 0) +
    (data.spouseBusinessIncome || 0)

  // 월간 지출
  const monthlyExpense =
    (data.livingExpenses || 0) +
    (data.housingRent || 0) +
    (data.housingMaintenance || 0)

  // 월간 저축
  const monthlySavings = monthlyIncome - monthlyExpense
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0

  // 부동산 자산
  const realEstateAssets = data.housingType === '자가' ? (data.housingValue || 0) : 0
  const depositAssets = (data.housingType === '전세' || data.housingType === '월세')
    ? (data.housingValue || 0) : 0

  // 금융자산
  const cashAssets = (data.cashCheckingAccount || 0) + (data.cashSavingsAccount || 0)
  const investmentAssets =
    (data.investDomesticStock || 0) +
    (data.investForeignStock || 0) +
    (data.investFund || 0) +
    (data.investOther || 0)

  // 연금자산
  const pensionAssets =
    (data.retirementPensionBalance || 0) +
    (data.irpBalance || 0) +
    (data.pensionSavingsBalance || 0) +
    (data.isaBalance || 0)

  // 총 자산
  const totalAssets = realEstateAssets + depositAssets + cashAssets + investmentAssets + pensionAssets

  // 부채
  const housingDebt = data.housingHasLoan ? (data.housingLoan || 0) : 0
  const otherDebts = data.debts?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0
  const totalDebts = housingDebt + otherDebts

  // 순자산
  const netWorth = totalAssets - totalDebts

  // 비율
  const debtToAssetRatio = totalAssets > 0 ? (totalDebts / totalAssets) * 100 : 0
  const annualIncome = monthlyIncome * 12
  const debtToIncomeRatio = annualIncome > 0 ? (totalDebts / annualIncome) * 100 : 0

  return {
    monthlyIncome,
    monthlyExpense,
    monthlySavings,
    savingsRate,
    totalAssets,
    realEstateAssets,
    depositAssets,
    cashAssets,
    investmentAssets,
    pensionAssets,
    totalDebts,
    housingDebt,
    otherDebts,
    netWorth,
    debtToAssetRatio,
    debtToIncomeRatio,
  }
}

// ============================================
// 목표 달성 계산
// ============================================

export interface GoalProgress {
  targetAmount: number
  currentAmount: number
  progressPercent: number
  remainingAmount: number
  estimatedYears: number | null  // 달성까지 예상 년수
}

/**
 * 은퇴 목표 진행률 계산
 */
export function calculateRetirementGoalProgress(
  data: OnboardingData,
  settings?: Partial<SimulationSettings>
): GoalProgress {
  const state = calculateCurrentState(data)
  const simulation = runSimulation(data, settings, 50)

  const targetAmount = data.target_retirement_fund || 0
  const currentAmount = state.netWorth
  const progressPercent = targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 0
  const remainingAmount = Math.max(0, targetAmount - currentAmount)

  // 목표 달성 예상 년수
  const targetSnapshot = simulation.snapshots.find(s => s.netWorth >= targetAmount)
  const estimatedYears = targetSnapshot ? targetSnapshot.year - new Date().getFullYear() : null

  return {
    targetAmount,
    currentAmount,
    progressPercent,
    remainingAmount,
    estimatedYears,
  }
}

/**
 * 마일스톤 계산
 */
export interface Milestone {
  name: string
  target: number
  achieved: boolean
  estimatedYear: number | null
  estimatedAge: number | null
}

export function calculateMilestones(
  data: OnboardingData,
  settings?: Partial<SimulationSettings>
): Milestone[] {
  const state = calculateCurrentState(data)
  const simulation = runSimulation(data, settings, 50)
  const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : new Date().getFullYear() - 35

  const milestoneTargets = [
    { name: '1억', target: 10000 },
    { name: '3억', target: 30000 },
    { name: '5억', target: 50000 },
    { name: '10억', target: 100000 },
    { name: '20억', target: 200000 },
  ]

  return milestoneTargets.map(m => {
    const achieved = state.netWorth >= m.target
    const snapshot = simulation.snapshots.find(s => s.netWorth >= m.target)

    return {
      name: m.name,
      target: m.target,
      achieved,
      estimatedYear: achieved ? new Date().getFullYear() : (snapshot?.year || null),
      estimatedAge: achieved ? (new Date().getFullYear() - birthYear) : (snapshot?.age || null),
    }
  })
}
