import type { OnboardingData } from '@/types'

// 나이 계산
export function calculateAge(birthDate: string): number {
  if (!birthDate) return 0
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// 은퇴까지 남은 년수
export function yearsToRetirement(birthDate: string, retirementAge: number): number {
  if (!birthDate || !retirementAge) return 0
  const currentAge = calculateAge(birthDate)
  return Math.max(0, retirementAge - currentAge)
}

// 월 총소득 계산 (만원 단위)
export function calculateMonthlyIncome(data: OnboardingData): number {
  let total = 0

  // 근로소득
  if (data.laborIncome) {
    total += data.laborIncomeFrequency === 'yearly'
      ? data.laborIncome / 12
      : data.laborIncome
  }
  if (data.spouseLaborIncome) {
    total += data.spouseLaborIncomeFrequency === 'yearly'
      ? data.spouseLaborIncome / 12
      : data.spouseLaborIncome
  }

  // 사업소득
  if (data.businessIncome) {
    total += data.businessIncomeFrequency === 'yearly'
      ? data.businessIncome / 12
      : data.businessIncome
  }
  if (data.spouseBusinessIncome) {
    total += data.spouseBusinessIncomeFrequency === 'yearly'
      ? data.spouseBusinessIncome / 12
      : data.spouseBusinessIncome
  }

  return total
}

// 월 지출 계산 (만원 단위)
export function calculateMonthlyExpense(data: OnboardingData): number {
  if (!data.livingExpenses) return 0
  return data.livingExpensesFrequency === 'yearly'
    ? data.livingExpenses / 12
    : data.livingExpenses
}

// 저축률 계산 (%)
export function calculateSavingsRate(data: OnboardingData): number {
  const income = calculateMonthlyIncome(data)
  const expense = calculateMonthlyExpense(data)
  if (income === 0) return 0
  return Math.round(((income - expense) / income) * 100)
}

// 총 금융자산 계산 (만원 단위)
export function calculateTotalFinancialAssets(data: OnboardingData): number {
  let total = 0

  // 저축 계좌
  if (data.savingsAccounts) {
    data.savingsAccounts.forEach(account => {
      total += account.balance || 0
    })
  }

  // 투자 계좌
  if (data.investmentAccounts) {
    data.investmentAccounts.forEach(account => {
      total += account.balance || 0
    })
  }

  return total
}

// 총 연금 자산 계산 (만원 단위)
export function calculateTotalPensionAssets(data: OnboardingData): number {
  let total = 0
  total += data.retirementPensionBalance || 0
  total += data.irpBalance || 0
  total += data.pensionSavingsBalance || 0
  total += data.isaBalance || 0
  return total
}

// 총 부채 계산 (만원 단위)
export function calculateTotalDebt(data: OnboardingData): number {
  let total = 0

  // 주택 대출
  total += data.housingLoan || 0

  // 기타 부채
  data.debts.forEach(debt => {
    total += debt.amount || 0
  })

  return total
}

// 순자산 계산 (만원 단위)
export function calculateNetWorth(data: OnboardingData): number {
  const assets = calculateTotalFinancialAssets(data)
  const pension = calculateTotalPensionAssets(data)
  const housing = data.housingType === '자가' ? (data.housingValue || 0) : 0
  const debt = calculateTotalDebt(data)

  return assets + pension + housing - debt
}

// 은퇴 자금 달성률 (%)
export function calculateRetirementProgress(data: OnboardingData): number {
  if (!data.target_retirement_fund || data.target_retirement_fund === 0) return 0
  const netWorth = calculateNetWorth(data)
  return Math.min(100, Math.round((netWorth / data.target_retirement_fund) * 100))
}

// 필요 월 저축액 계산 (만원 단위)
// 은퇴까지 목표 자금 달성을 위해 매월 저축해야 할 금액
export function calculateRequiredMonthlySaving(data: OnboardingData): number {
  if (!data.target_retirement_fund || !data.birth_date || !data.target_retirement_age) {
    return 0
  }

  const currentNetWorth = calculateNetWorth(data)
  const targetFund = data.target_retirement_fund
  const yearsLeft = yearsToRetirement(data.birth_date, data.target_retirement_age)

  if (yearsLeft <= 0) return 0

  const monthsLeft = yearsLeft * 12
  const shortfall = targetFund - currentNetWorth

  if (shortfall <= 0) return 0

  // 연 5% 수익률 가정 시 필요 월 저축액 (단순 계산)
  // PMT = FV * r / ((1+r)^n - 1)
  const monthlyRate = 0.05 / 12
  const factor = Math.pow(1 + monthlyRate, monthsLeft) - 1
  const requiredMonthly = (shortfall * monthlyRate) / factor

  return Math.round(requiredMonthly)
}

// LTV 계산 (%)
export function calculateLTV(data: OnboardingData): number {
  if (!data.housingValue || data.housingValue === 0 || !data.housingLoan) {
    return 0
  }
  return Math.round((data.housingLoan / data.housingValue) * 100)
}

// DTI 계산 (%) - 총 부채 / 연소득
export function calculateDTI(data: OnboardingData): number {
  const annualIncome = calculateMonthlyIncome(data) * 12
  if (annualIncome === 0) return 0

  const totalDebt = calculateTotalDebt(data)
  return Math.round((totalDebt / annualIncome) * 100)
}

// 연금 소득대체율 (%) - 예상 연금 소득 / 현재 소득
export function calculatePensionReplacement(data: OnboardingData): number {
  const currentIncome = calculateMonthlyIncome(data)
  if (currentIncome === 0) return 0

  // 월 연금 수령액 합계
  let monthlyPension = 0
  monthlyPension += data.nationalPension || 0
  monthlyPension += data.otherPensionMonthly || 0

  // 퇴직연금은 현재 잔액을 20년으로 나눠서 월 수령액 추정
  if (data.retirementPensionBalance) {
    monthlyPension += data.retirementPensionBalance / (20 * 12)
  }

  // 개인연금도 20년으로 나눠서 추정
  const personalPension = (data.irpBalance || 0) + (data.pensionSavingsBalance || 0)
  if (personalPension > 0) {
    monthlyPension += personalPension / (20 * 12)
  }

  return Math.round((monthlyPension / currentIncome) * 100)
}

// 기대수명 (기본값 90세)
export const LIFE_EXPECTANCY = 90

// 국민연금 수령 시작 나이 (기본값 65세)
export const DEFAULT_PENSION_START_AGE = 65

// 기본 물가상승률 (연 2%)
export const DEFAULT_INFLATION_RATE = 0.02

// ============================================
// 시뮬레이션 함수들
// ============================================

// 복리 성장 계산 결과 타입
export interface CompoundGrowthResult {
  nominalValue: number      // 명목 가치 (원)
  realValue: number         // 실질 가치 (물가 반영, 원)
  totalContribution: number // 총 납입금 (원)
  totalGrowth: number       // 수익금 (원)
  yearlyData: Array<{       // 연도별 데이터 (차트용)
    year: number
    nominalValue: number
    realValue: number
    contribution: number
  }>
}

/**
 * 복리 성장 계산
 * @param principal 초기 원금 (원)
 * @param monthlyContribution 월 적립금 (원)
 * @param annualRate 연 수익률 (%, 예: 7이면 7%)
 * @param years 기간 (년)
 * @param inflationRate 물가상승률 (%, 기본 2%)
 */
export function calculateCompoundGrowth(
  principal: number,
  monthlyContribution: number,
  annualRate: number,
  years: number,
  inflationRate: number = DEFAULT_INFLATION_RATE * 100
): CompoundGrowthResult {
  const monthlyRate = annualRate / 100 / 12
  const monthlyInflation = inflationRate / 100 / 12
  const totalMonths = years * 12

  let nominalValue = principal
  let realValue = principal
  const totalContribution = principal + monthlyContribution * totalMonths
  const yearlyData: CompoundGrowthResult['yearlyData'] = []

  // 초기값 기록
  yearlyData.push({
    year: 0,
    nominalValue: principal,
    realValue: principal,
    contribution: principal,
  })

  // 월별 복리 계산
  for (let month = 1; month <= totalMonths; month++) {
    // 명목 가치: 이전 잔액 * (1 + 월수익률) + 월적립금
    nominalValue = nominalValue * (1 + monthlyRate) + monthlyContribution

    // 실질 가치: 물가상승률로 할인
    const inflationDiscount = Math.pow(1 + monthlyInflation, month)
    realValue = nominalValue / inflationDiscount

    // 연말마다 기록
    if (month % 12 === 0) {
      yearlyData.push({
        year: month / 12,
        nominalValue: Math.round(nominalValue),
        realValue: Math.round(realValue),
        contribution: principal + monthlyContribution * month,
      })
    }
  }

  return {
    nominalValue: Math.round(nominalValue),
    realValue: Math.round(realValue),
    totalContribution: Math.round(totalContribution),
    totalGrowth: Math.round(nominalValue - totalContribution),
    yearlyData,
  }
}

// 연금 수령 시뮬레이션 결과 타입
export interface PensionWithdrawalResult {
  totalReceived: number       // 총 수령액 (원)
  remainingBalance: number    // 잔액 (원)
  exhaustionYear: number | null  // 소진 연도 (없으면 null)
  yearlyData: Array<{         // 연도별 데이터
    year: number
    balance: number
    withdrawal: number
  }>
}

/**
 * 연금 수령 시뮬레이션
 * @param balance 시작 잔액 (원)
 * @param monthlyWithdrawal 월 인출금 (원)
 * @param annualRate 잔액 수익률 (%, 예: 3이면 3%)
 * @param years 수령 기간 (년)
 */
export function simulatePensionWithdrawal(
  balance: number,
  monthlyWithdrawal: number,
  annualRate: number,
  years: number
): PensionWithdrawalResult {
  const monthlyRate = annualRate / 100 / 12
  const totalMonths = years * 12

  let currentBalance = balance
  let totalReceived = 0
  let exhaustionYear: number | null = null
  const yearlyData: PensionWithdrawalResult['yearlyData'] = []

  // 초기값 기록
  yearlyData.push({
    year: 0,
    balance: balance,
    withdrawal: 0,
  })

  // 월별 인출 시뮬레이션
  for (let month = 1; month <= totalMonths; month++) {
    // 잔액에 수익률 적용
    currentBalance = currentBalance * (1 + monthlyRate)

    // 인출
    const actualWithdrawal = Math.min(currentBalance, monthlyWithdrawal)
    currentBalance -= actualWithdrawal
    totalReceived += actualWithdrawal

    // 잔액 소진 체크
    if (currentBalance <= 0 && exhaustionYear === null) {
      exhaustionYear = Math.ceil(month / 12)
      currentBalance = 0
    }

    // 연말마다 기록
    if (month % 12 === 0) {
      yearlyData.push({
        year: month / 12,
        balance: Math.round(currentBalance),
        withdrawal: Math.round(totalReceived),
      })
    }
  }

  return {
    totalReceived: Math.round(totalReceived),
    remainingBalance: Math.round(Math.max(0, currentBalance)),
    exhaustionYear,
    yearlyData,
  }
}

// 연금 세금 계산 결과 타입
export interface PensionTaxResult {
  grossAmount: number   // 세전 금액 (원)
  taxRate: number       // 적용 세율 (%)
  taxAmount: number     // 세금 (원)
  netAmount: number     // 세후 금액 (원)
}

/**
 * 연금 세금 계산
 * @param annualPension 연간 연금 수령액 (원)
 * @param pensionType 연금 유형
 * @param age 수령 시작 나이 (연금소득세율에 영향)
 */
export function calculatePensionTax(
  annualPension: number,
  pensionType: 'national' | 'retirement' | 'personal',
  age: number = 65
): PensionTaxResult {
  let taxRate = 0

  switch (pensionType) {
    case 'national':
      // 국민연금: 비과세 (연간 350만원 이하) 또는 종합과세
      // 단순화: 연금소득 기본공제 적용 후 실효세율 약 5-10%
      if (annualPension <= 3500000) {
        taxRate = 0
      } else {
        taxRate = 5 // 평균 실효세율 5%
      }
      break

    case 'retirement':
      // 퇴직연금: 연금수령 시 연금소득세 (3.3~5.5%)
      // 나이에 따라 차등
      if (age >= 80) {
        taxRate = 3.3
      } else if (age >= 70) {
        taxRate = 4.4
      } else {
        taxRate = 5.5
      }
      break

    case 'personal':
      // 개인연금: 연금소득세 (3.3~5.5%)
      // 나이에 따라 차등
      if (age >= 80) {
        taxRate = 3.3
      } else if (age >= 70) {
        taxRate = 4.4
      } else {
        taxRate = 5.5
      }
      break
  }

  const taxAmount = Math.round(annualPension * (taxRate / 100))

  return {
    grossAmount: annualPension,
    taxRate,
    taxAmount,
    netAmount: annualPension - taxAmount,
  }
}

// 시나리오 비교 결과 타입
export interface ScenarioResult {
  name: string
  description: string
  retirementAge: number
  targetFund: number
  projectedFund: number
  achievementRate: number
  monthlyPension: number
  gap: number
}

/**
 * 시나리오 비교 (낙관/중립/비관)
 * @param data 온보딩 데이터
 */
export function compareScenarios(data: OnboardingData): ScenarioResult[] {
  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60
  const yearsToRetire = Math.max(0, retirementAge - currentAge)
  const monthlySavings = calculateMonthlyIncome(data) - calculateMonthlyExpense(data)
  const currentAssets = calculateNetWorth(data)
  const targetFund = data.target_retirement_fund || 0

  // 3가지 시나리오: 낙관(7%), 중립(5%), 비관(3%)
  const scenarios = [
    { name: '낙관적', rate: 7, description: '적극적 투자 (주식 70%)' },
    { name: '중립적', rate: 5, description: '균형 투자 (주식 50%)' },
    { name: '보수적', rate: 3, description: '안전 투자 (예금/채권)' },
  ]

  return scenarios.map(scenario => {
    const growth = calculateCompoundGrowth(
      currentAssets,
      monthlySavings,
      scenario.rate,
      yearsToRetire
    )

    const projectedFund = growth.nominalValue
    const achievementRate = targetFund > 0
      ? Math.round((projectedFund / targetFund) * 100)
      : 0

    // 은퇴 후 30년 동안 월 인출 가능액 추정 (수익률 3% 가정)
    const withdrawal = simulatePensionWithdrawal(
      projectedFund,
      projectedFund / (30 * 12), // 균등 분할 기준
      3,
      30
    )
    const monthlyPension = Math.round(projectedFund / (30 * 12))

    return {
      name: scenario.name,
      description: scenario.description,
      retirementAge,
      targetFund,
      projectedFund,
      achievementRate,
      monthlyPension,
      gap: targetFund - projectedFund,
    }
  })
}

/**
 * 국민연금 수령 시기별 총액 비교
 * @param monthlyPension 기본 월 수령액 (65세 기준, 원)
 * @param lifeExpectancy 기대수명 (세)
 */
export function compareNationalPensionTiming(
  monthlyPension: number,
  lifeExpectancy: number = LIFE_EXPECTANCY
): Array<{
  startAge: number
  adjustmentRate: number  // 조정률 (%)
  monthlyAmount: number   // 조정된 월 수령액
  totalAmount: number     // 총 수령액
  years: number           // 수령 기간
}> {
  const timings = [
    { startAge: 60, adjustmentRate: -30 },  // 조기수령: 30% 감액
    { startAge: 62, adjustmentRate: -18 },  // 조기수령: 18% 감액
    { startAge: 65, adjustmentRate: 0 },    // 정상수령
    { startAge: 67, adjustmentRate: 14.4 }, // 연기수령: 14.4% 증액
    { startAge: 70, adjustmentRate: 36 },   // 최대연기: 36% 증액
  ]

  return timings.map(timing => {
    const adjustedMonthly = Math.round(monthlyPension * (1 + timing.adjustmentRate / 100))
    const years = Math.max(0, lifeExpectancy - timing.startAge)
    const totalAmount = adjustedMonthly * 12 * years

    return {
      startAge: timing.startAge,
      adjustmentRate: timing.adjustmentRate,
      monthlyAmount: adjustedMonthly,
      totalAmount,
      years,
    }
  })
}

/**
 * 퇴직연금 운용 수익률별 최종 잔액 비교
 * @param currentBalance 현재 잔액 (원)
 * @param monthlyContribution 월 추가 납입금 (원, 기본 0)
 * @param yearsToRetirement 은퇴까지 년수
 */
export function compareRetirementPensionReturns(
  currentBalance: number,
  yearsToRetirement: number,
  monthlyContribution: number = 0
): Array<{
  type: string
  rate: number
  finalBalance: number
  totalGrowth: number
}> {
  const types = [
    { type: '예금', rate: 2 },
    { type: '채권형', rate: 4 },
    { type: '혼합형 (TDF)', rate: 5.5 },
    { type: '주식형', rate: 7 },
  ]

  return types.map(item => {
    const growth = calculateCompoundGrowth(
      currentBalance,
      monthlyContribution,
      item.rate,
      yearsToRetirement,
      0 // 명목 가치만 계산
    )

    return {
      type: item.type,
      rate: item.rate,
      finalBalance: growth.nominalValue,
      totalGrowth: growth.totalGrowth,
    }
  })
}

/**
 * 개인연금 세액공제 계산
 * @param annualContribution 연간 납입액 (원)
 * @param totalIncome 연간 총급여 (원)
 */
export function calculatePersonalPensionTaxCredit(
  annualContribution: number,
  totalIncome: number
): {
  eligibleAmount: number    // 공제 대상 금액
  creditRate: number        // 공제율 (%)
  creditAmount: number      // 세액공제 금액
} {
  // 연금저축 + IRP 합산 900만원 한도
  const MAX_ELIGIBLE = 9000000
  const eligibleAmount = Math.min(annualContribution, MAX_ELIGIBLE)

  // 공제율: 총급여 5,500만원 이하 16.5%, 초과 13.2%
  const creditRate = totalIncome <= 55000000 ? 16.5 : 13.2
  const creditAmount = Math.round(eligibleAmount * (creditRate / 100))

  return {
    eligibleAmount,
    creditRate,
    creditAmount,
  }
}

/**
 * 소득 안정성 분석
 * @param data 온보딩 데이터
 */
export function analyzeIncomeStability(data: OnboardingData): {
  laborIncomeRatio: number      // 근로소득 비중 (%)
  businessIncomeRatio: number   // 사업소득 비중 (%)
  riskLevel: 'low' | 'medium' | 'high'
  recommendedEmergencyMonths: number  // 권장 비상금 개월 수
  currentEmergencyMonths: number      // 현재 비상금 개월 수
} {
  const laborIncome = (data.laborIncome || 0) + (data.spouseLaborIncome || 0)
  const businessIncome = (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)
  const totalIncome = laborIncome + businessIncome

  if (totalIncome === 0) {
    return {
      laborIncomeRatio: 0,
      businessIncomeRatio: 0,
      riskLevel: 'high',
      recommendedEmergencyMonths: 12,
      currentEmergencyMonths: 0,
    }
  }

  const laborRatio = Math.round((laborIncome / totalIncome) * 100)
  const businessRatio = 100 - laborRatio

  // 리스크 레벨 판단
  let riskLevel: 'low' | 'medium' | 'high'
  let recommendedMonths: number

  if (businessRatio >= 70) {
    riskLevel = 'high'
    recommendedMonths = 12
  } else if (businessRatio >= 30) {
    riskLevel = 'medium'
    recommendedMonths = 9
  } else {
    riskLevel = 'low'
    recommendedMonths = 6
  }

  // 현재 비상금 개월 수 (저축 계좌 중 checking, savings 타입 합산)
  let cash = 0
  if (data.savingsAccounts) {
    data.savingsAccounts.forEach(account => {
      if (account.type === 'checking' || account.type === 'savings') {
        cash += account.balance || 0
      }
    })
  }
  const monthlyExpense = calculateMonthlyExpense(data)
  const currentEmergencyMonths = monthlyExpense > 0
    ? Math.round(cash / monthlyExpense)
    : 0

  return {
    laborIncomeRatio: laborRatio,
    businessIncomeRatio: businessRatio,
    riskLevel,
    recommendedEmergencyMonths: recommendedMonths,
    currentEmergencyMonths,
  }
}

/**
 * 연금 공백 기간 분석
 * @param data 온보딩 데이터
 */
export function analyzeRetirementGap(data: OnboardingData): {
  retirementAge: number
  pensionStartAge: number
  gapYears: number
  monthlyExpenseNeeded: number
  totalGapFund: number
  currentPreparation: number
  preparationRate: number
} {
  const retirementAge = data.target_retirement_age || 60
  const pensionStartAge = data.nationalPensionStartAge || DEFAULT_PENSION_START_AGE
  const gapYears = Math.max(0, pensionStartAge - retirementAge)

  // 월 생활비 (은퇴 후 70% 가정)
  const currentExpense = calculateMonthlyExpense(data)
  const monthlyExpenseNeeded = Math.round(currentExpense * 0.7)

  // 공백 기간 필요 자금
  const totalGapFund = monthlyExpenseNeeded * 12 * gapYears

  // 현재 준비 상황 (금융자산 + 퇴직연금 일부)
  const financialAssets = calculateTotalFinancialAssets(data)
  const retirementPension = data.retirementPensionBalance || 0
  const currentPreparation = financialAssets + retirementPension

  // 준비율
  const preparationRate = totalGapFund > 0
    ? Math.min(100, Math.round((currentPreparation / totalGapFund) * 100))
    : 100

  return {
    retirementAge,
    pensionStartAge,
    gapYears,
    monthlyExpenseNeeded,
    totalGapFund,
    currentPreparation,
    preparationRate,
  }
}
