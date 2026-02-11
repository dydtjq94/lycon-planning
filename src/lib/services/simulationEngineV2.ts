/**
 * Simulation Engine V2
 * - DB 타입 직접 사용 (dbToFinancialItems 우회, 필드 손실 방지)
 * - 항목별 개별 State 추적
 * - 연도 루프 안에 월별 서브루프
 * - currentCash로 잉여/적자 누적
 * - YearlySnapshot 100% 호환 출력
 */

import type {
  Income,
  Expense,
  Savings,
  Debt,
  NationalPension,
  RetirementPension,
  PersonalPension,
  RealEstate,
  PhysicalAsset,
} from '@/types/tables'

import type {
  GlobalSettings,
  InvestmentAssumptions,
  CashFlowPriorities,
  RateCategory,
  InvestmentRates,
  CashFlowItem,
} from '@/types'

import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_INVESTMENT_ASSUMPTIONS } from '@/types'
import type { YearlySnapshot, MonthlySnapshot, SimulationResult, SimulationProfile } from './simulationEngine'
import { getEffectiveRate, getDefaultRateCategory } from '../utils'
import { getEffectiveDebtRate } from '../utils/loanCalculator'
import {
  calculateInterestIncomeTax,
  calculateCapitalGainsTax,
  calculateISATax,
} from '../utils/taxCalculator'
import { HISTORICAL_RATES, type HistoricalIndex } from '../data/historicalRates'

// ============================================
// 내부 State 타입
// ============================================

interface SavingsItemState {
  id: string
  title: string
  owner: string
  type: string
  balance: number
  totalPrincipal: number
  monthlyContribution: number | null
  contributionStartYear: number | null
  contributionStartMonth: number | null
  contributionEndYear: number | null
  contributionEndMonth: number | null
  isContributionFixedToRetirement: boolean
  interestRate: number | null
  expectedReturn: number | null
  maturityYear: number | null
  maturityMonth: number | null
  isTaxFree: boolean
  isMatured: boolean
  isActive: boolean
}

interface PensionItemState {
  id: string
  title: string
  owner: string
  category: 'national' | 'retirement' | 'personal'
  pensionSubType: string
  balance: number
  totalPrincipal: number
  monthlyContribution: number | null
  contributionEndYear: number | null
  contributionEndMonth: number | null
  isContributionFixedToRetirement: boolean
  returnRate: number
  // 국민연금
  expectedMonthlyAmount?: number
  startAge?: number
  endAge?: number | null
  // 퇴직/개인
  receiveType?: string
  receivingYears?: number | null
  startAgeForReceiving?: number | null
  // ISA
  isaMaturityYear?: number | null
  isaMaturityMonth?: number | null
  isaMaturityStrategy?: string | null
  // 퇴직금/DB
  yearsOfService?: number | null
  pensionType?: string
  // 상태
  isReceiving: boolean
  isMatured: boolean
}

interface DebtItemState {
  id: string
  title: string
  type: string
  originalPrincipal: number
  currentBalance: number
  interestRate: number
  rateType: string
  spread: number | null
  repaymentType: string
  startYear: number
  startMonth: number
  maturityYear: number
  maturityMonth: number
  gracePeriodMonths: number
  monthlyPayment: number
  isPaidOff: boolean
}

interface RealEstateItemState {
  id: string
  title: string
  owner: string
  type: string
  currentValue: number
  purchasePrice: number
  purchaseYear: number | null
  purchaseMonth: number | null
  growthRate: number
  housingType: string | null
  sellYear: number | null
  sellMonth: number | null
  isSold: boolean
  deposit: number | null
  monthlyRent: number | null
  maintenanceFee: number | null
  hasRentalIncome: boolean
  rentalMonthly: number | null
  rentalStartYear: number | null
  rentalStartMonth: number | null
  rentalEndYear: number | null
  rentalEndMonth: number | null
  hasLoan: boolean
  loanAmount: number | null
  loanRate: number | null
  loanRateType: string | null
  loanSpread: number | null
  loanStartYear: number | null
  loanStartMonth: number | null
  loanMaturityYear: number | null
  loanMaturityMonth: number | null
  loanRepaymentType: string | null
  loanBalance: number
}

interface PhysicalAssetItemState {
  id: string
  title: string
  owner: string
  type: string
  currentValue: number
  purchasePrice: number
  annualRate: number
  sellYear: number | null
  sellMonth: number | null
  isSold: boolean
}

interface SimulationState {
  currentCash: number
  checkingAccountId: string | null
  checkingAccountTitle: string
  savings: SavingsItemState[]
  pensions: PensionItemState[]
  debts: DebtItemState[]
  realEstates: RealEstateItemState[]
  physicalAssets: PhysicalAssetItemState[]
}

// ============================================
// 입력 타입
// ============================================

export interface SimulationV2Input {
  incomes: Income[]
  expenses: Expense[]
  savings: Savings[]
  debts: Debt[]
  nationalPensions: NationalPension[]
  retirementPensions: RetirementPension[]
  personalPensions: PersonalPension[]
  realEstates: RealEstate[]
  physicalAssets: PhysicalAsset[]
}

// ============================================
// 헬퍼 함수
// ============================================

const ownerLabels: Record<string, string> = {
  self: '본인',
  spouse: '배우자',
  child: '자녀',
  common: '공동',
}

function getSavingsAssetCategory(savingsType: string): string {
  switch (savingsType) {
    case 'checking':
    case 'savings':
    case 'deposit':
    case 'housing':
      return 'savings'
    case 'domestic_stock':
    case 'foreign_stock':
    case 'fund':
    case 'bond':
    case 'crypto':
      return 'investment'
    default:
      return 'savings'
  }
}

function getDebtAssetCategory(debtType: string): string {
  switch (debtType) {
    case 'mortgage': return 'mortgage'
    case 'jeonse': return 'jeonse'
    case 'credit':
    case 'card': return 'credit'
    case 'car': return 'car'
    case 'student': return 'student'
    default: return 'other_debt'
  }
}

function getOwnerBirthYear(owner: string, profile: SimulationProfile): number {
  if (owner === 'spouse' && profile.spouseBirthYear) return profile.spouseBirthYear
  return profile.birthYear
}

function getRetirementYear(owner: string, profile: SimulationProfile): number {
  if (owner === 'spouse' && profile.spouseBirthYear && profile.spouseRetirementAge) {
    return profile.spouseBirthYear + profile.spouseRetirementAge
  }
  return profile.birthYear + profile.retirementAge
}

function isInPeriod(
  year: number, month: number,
  startYear: number | null, startMonth: number | null,
  endYear: number | null, endMonth: number | null
): boolean {
  const sy = startYear ?? 0
  const sm = startMonth ?? 1
  const ey = endYear ?? 9999
  const em = endMonth ?? 12

  const current = year * 12 + month
  const start = sy * 12 + sm
  const end = ey * 12 + em

  return current >= start && current <= end
}

function isSavingsType(type: string): boolean {
  return ['checking', 'savings', 'deposit', 'housing'].includes(type)
}

function isInvestmentType(type: string): boolean {
  return ['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other'].includes(type)
}

/** 월 상환액(PMT) 계산 */
function calculatePMT(principal: number, monthlyRate: number, totalMonths: number): number {
  if (totalMonths <= 0) return 0
  if (monthlyRate === 0) return principal / totalMonths
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
    (Math.pow(1 + monthlyRate, totalMonths) - 1)
}

function getRateForYear(
  rateKey: keyof InvestmentRates,
  year: number,
  startYear: number,
  assumptions: InvestmentAssumptions
): number {
  if (assumptions.mode !== 'historical' || !assumptions.historicalConfig) {
    return assumptions.rates[rateKey]
  }
  const config = assumptions.historicalConfig
  const index: HistoricalIndex = config.indexMapping[rateKey]
  const dataset = HISTORICAL_RATES[index]
  if (!dataset || dataset.length === 0) return assumptions.rates[rateKey]
  const yearsSinceStart = year - startYear
  const dataIndex = (config.startOffset + yearsSinceStart) % dataset.length
  return dataset[dataIndex].rate
}

// ============================================
// State 초기화
// ============================================

function initializeState(
  data: SimulationV2Input,
  profile: SimulationProfile,
  gs: GlobalSettings
): SimulationState {
  const state: SimulationState = {
    currentCash: 0,
    checkingAccountId: null,
    checkingAccountTitle: '현금잔고',
    savings: [],
    pensions: [],
    debts: [],
    realEstates: [],
    physicalAssets: [],
  }

  // 저축 초기화
  for (const s of data.savings) {
    if (!s.is_active) continue
    state.savings.push({
      id: s.id,
      title: s.title,
      owner: s.owner,
      type: s.type,
      balance: s.current_balance,
      totalPrincipal: s.current_balance,
      monthlyContribution: s.monthly_contribution,
      contributionStartYear: s.contribution_start_year,
      contributionStartMonth: s.contribution_start_month,
      contributionEndYear: s.contribution_end_year,
      contributionEndMonth: s.contribution_end_month,
      isContributionFixedToRetirement: s.is_contribution_fixed_to_retirement,
      interestRate: s.interest_rate,
      expectedReturn: s.expected_return,
      maturityYear: s.maturity_year,
      maturityMonth: s.maturity_month,
      isTaxFree: s.is_tax_free,
      isMatured: false,
      isActive: true,
    })
  }

  // 입출금통장 → currentCash 연동
  const checkingIdx = state.savings.findIndex(s => s.type === 'checking')
  if (checkingIdx >= 0) {
    const checking = state.savings[checkingIdx]
    state.currentCash = checking.balance
    state.checkingAccountId = checking.id
    state.checkingAccountTitle = checking.title
    state.savings.splice(checkingIdx, 1)  // savings 배열에서 제거 (이중계산 방지)
  }

  // 국민연금 초기화
  for (const p of data.nationalPensions) {
    if (!p.is_active) continue
    state.pensions.push({
      id: p.id,
      title: p.owner === 'spouse' ? '배우자 국민연금' : '국민연금',
      owner: p.owner,
      category: 'national',
      pensionSubType: p.pension_type,
      balance: 0,
      totalPrincipal: 0,
      monthlyContribution: null,
      contributionEndYear: null,
      contributionEndMonth: null,
      isContributionFixedToRetirement: false,
      returnRate: 0,
      expectedMonthlyAmount: p.expected_monthly_amount,
      startAge: p.start_age,
      endAge: p.end_age,
      isReceiving: false,
      isMatured: false,
    })
  }

  // 퇴직연금 초기화
  for (const p of data.retirementPensions) {
    if (!p.is_active) continue
    state.pensions.push({
      id: p.id,
      title: p.owner === 'spouse' ? '배우자 퇴직연금' : '퇴직연금',
      owner: p.owner,
      category: 'retirement',
      pensionSubType: p.pension_type,
      balance: p.current_balance || 0,
      totalPrincipal: p.current_balance || 0,
      monthlyContribution: null,
      contributionEndYear: null,
      contributionEndMonth: null,
      isContributionFixedToRetirement: false,
      returnRate: p.return_rate,
      receiveType: p.receive_type,
      receivingYears: p.receiving_years,
      startAgeForReceiving: p.start_age,
      yearsOfService: p.years_of_service,
      pensionType: p.pension_type,
      isReceiving: false,
      isMatured: false,
    })
  }

  // 개인연금 초기화
  for (const p of data.personalPensions) {
    if (!p.is_active) continue
    state.pensions.push({
      id: p.id,
      title: p.title || (p.pension_type === 'irp' ? 'IRP' :
        p.pension_type === 'isa' ? 'ISA' : '연금저축'),
      owner: p.owner,
      category: 'personal',
      pensionSubType: p.pension_type,
      balance: p.current_balance,
      totalPrincipal: p.current_balance,
      monthlyContribution: p.monthly_contribution,
      contributionEndYear: p.contribution_end_year,
      contributionEndMonth: p.contribution_end_month,
      isContributionFixedToRetirement: p.is_contribution_fixed_to_retirement,
      returnRate: p.return_rate,
      receivingYears: p.receiving_years,
      startAgeForReceiving: p.start_age,
      isaMaturityYear: p.isa_maturity_year,
      isaMaturityMonth: p.isa_maturity_month,
      isaMaturityStrategy: p.isa_maturity_strategy,
      isReceiving: false,
      isMatured: false,
    })
  }

  // 부채 초기화
  for (const d of data.debts) {
    if (!d.is_active) continue
    const effectiveRate = getEffectiveDebtRate(
      { rate: d.interest_rate, rateType: d.rate_type, spread: d.spread || 0 },
      gs
    )
    const monthlyRate = effectiveRate / 100 / 12
    const totalMonths = (d.maturity_year - d.start_year) * 12 + (d.maturity_month - d.start_month)
    const principal = d.current_balance || d.principal
    let monthlyPayment = 0

    switch (d.repayment_type) {
      case '만기일시상환':
        monthlyPayment = principal * monthlyRate
        break
      case '원리금균등상환':
        monthlyPayment = calculatePMT(principal, monthlyRate, totalMonths)
        break
      case '원금균등상환':
        monthlyPayment = principal / totalMonths + principal * monthlyRate
        break
      case '거치식상환': {
        const repayMonths = Math.max(1, totalMonths - d.grace_period_months)
        monthlyPayment = calculatePMT(principal, monthlyRate, repayMonths)
        break
      }
    }

    state.debts.push({
      id: d.id,
      title: d.title,
      type: d.type,
      originalPrincipal: d.principal,
      currentBalance: d.current_balance || d.principal,
      interestRate: effectiveRate,
      rateType: d.rate_type,
      spread: d.spread,
      repaymentType: d.repayment_type,
      startYear: d.start_year,
      startMonth: d.start_month,
      maturityYear: d.maturity_year,
      maturityMonth: d.maturity_month,
      gracePeriodMonths: d.grace_period_months,
      monthlyPayment,
      isPaidOff: false,
    })
  }

  // 부동산 초기화
  for (const re of data.realEstates) {
    if (!re.is_active) continue
    state.realEstates.push({
      id: re.id,
      title: re.title,
      owner: re.owner,
      type: re.type,
      currentValue: re.current_value,
      purchasePrice: re.purchase_price || re.current_value,
      purchaseYear: re.purchase_year,
      purchaseMonth: re.purchase_month,
      growthRate: re.growth_rate,
      housingType: re.housing_type,
      sellYear: re.sell_year,
      sellMonth: re.sell_month,
      isSold: false,
      deposit: re.deposit,
      monthlyRent: re.monthly_rent,
      maintenanceFee: re.maintenance_fee,
      hasRentalIncome: re.has_rental_income,
      rentalMonthly: re.rental_monthly,
      rentalStartYear: re.rental_start_year,
      rentalStartMonth: re.rental_start_month,
      rentalEndYear: re.rental_end_year,
      rentalEndMonth: re.rental_end_month,
      hasLoan: re.has_loan,
      loanAmount: re.loan_amount,
      loanRate: re.loan_rate,
      loanRateType: re.loan_rate_type,
      loanSpread: re.loan_spread,
      loanStartYear: re.loan_start_year,
      loanStartMonth: re.loan_start_month,
      loanMaturityYear: re.loan_maturity_year,
      loanMaturityMonth: re.loan_maturity_month,
      loanRepaymentType: re.loan_repayment_type,
      loanBalance: re.loan_amount || 0,
    })
  }

  // 실물자산 초기화
  for (const a of data.physicalAssets) {
    if (!a.is_active) continue
    state.physicalAssets.push({
      id: a.id,
      title: a.title,
      owner: a.owner,
      type: a.type,
      currentValue: a.current_value,
      purchasePrice: a.purchase_price || a.current_value,
      annualRate: a.annual_rate,
      sellYear: a.sell_year,
      sellMonth: a.sell_month,
      isSold: false,
    })
  }

  return state
}

// ============================================
// 메인 엔진
// ============================================

export function runSimulationV2(
  data: SimulationV2Input,
  profile: SimulationProfile,
  globalSettings?: GlobalSettings,
  yearsToSimulate: number = 50,
  assumptions?: InvestmentAssumptions,
  priorities?: CashFlowPriorities
): SimulationResult {
  const currentYear = new Date().getFullYear()
  const { birthYear, retirementAge } = profile
  const retirementYear = birthYear + retirementAge
  const endYear = currentYear + yearsToSimulate

  const gs = globalSettings || DEFAULT_GLOBAL_SETTINGS
  const effectiveAssumptions: InvestmentAssumptions = assumptions || DEFAULT_INVESTMENT_ASSUMPTIONS

  // State 초기화
  const state = initializeState(data, profile, gs)

  const snapshots: YearlySnapshot[] = []
  const monthlySnapshots: MonthlySnapshot[] = []

  for (let year = currentYear; year <= endYear; year++) {
    const age = year - birthYear
    const surplusAllocated = new Map<string, number>()  // 연간 배분 추적
    const yearsSinceStart = year - currentYear
    const events: string[] = []
    let yearlyTax = 0
    let yearlyIncome = 0
    let yearlyExpense = 0

    // B6/B7 추적 배열
    const surplusInvestments: { title: string; amount: number; category: string; id: string }[] = []
    const deficitWithdrawals: { title: string; amount: number; category: string; id: string }[] = []
    const yearStartCash = state.currentCash
    const eventFlowItems: CashFlowItem[] = []

    // 연도별 수익률 (히스토리컬이면 매년 다름)
    const savingsReturnPct = getRateForYear('savings', year, currentYear, effectiveAssumptions)
    const investmentReturnPct = getRateForYear('investment', year, currentYear, effectiveAssumptions)
    const pensionReturnPct = getRateForYear('pension', year, currentYear, effectiveAssumptions)
    const realEstateGrowthPct = getRateForYear('realEstate', year, currentYear, effectiveAssumptions)
    const inflationPct = getRateForYear('inflation', year, currentYear, effectiveAssumptions)

    const incomeBreakdown: { title: string; amount: number; type?: string }[] = []
    const expenseBreakdown: { title: string; amount: number; type?: string }[] = []

    // 직접 계산 항목의 연간 합계 추적 (breakdown용)
    const debtPaymentTotals = new Map<string, number>()
    const pensionIncomeTotals = new Map<string, number>()

    // 현금흐름 상세 추적
    const cashFlowItems: CashFlowItem[] = []
    const savingsContribTotals = new Map<string, { title: string; amount: number; id: string }>()
    const pensionContribTotals = new Map<string, { title: string; amount: number; id: string; category: string }>()
    const debtInterestTotals = new Map<string, { title: string; amount: number; id: string }>()
    const debtPrincipalTotals = new Map<string, { title: string; amount: number; id: string }>()

    // ==============================
    // Phase A: 월별 현금흐름
    // ==============================
    for (let month = 1; month <= 12; month++) {
      // 월별 추적 변수
      let monthIncome = 0
      let monthExpense = 0
      const monthIncomeBreakdown: { title: string; amount: number; type?: string }[] = []
      const monthExpenseBreakdown: { title: string; amount: number; type?: string }[] = []
      const monthWithdrawals: { title: string; amount: number; category: string }[] = []
      const monthSurplus: { title: string; amount: number; category: string }[] = []

      // A1. 월간 소득 (연금 연동 소득은 A10/A11에서 직접 계산)
      for (const income of data.incomes) {
        if (!income.is_active) continue
        // 연금 연동 소득은 A10/A11에서 직접 계산하므로 건너뜀
        if (income.source_type === 'national_pension' ||
            income.source_type === 'retirement_pension' ||
            income.source_type === 'personal_pension') continue

        // retirement_link에 따른 동적 종료년도 계산
        let endY = income.end_year
        let endM = income.end_month
        if (income.retirement_link === 'self') {
          endY = profile.birthYear + profile.retirementAge
          endM = 12
        } else if (income.retirement_link === 'spouse') {
          endY = getRetirementYear('spouse', profile)
          endM = 12
        }

        if (!isInPeriod(year, month, income.start_year, income.start_month, endY, endM)) continue

        const rateCategory = income.rate_category || getDefaultRateCategory(income.type)
        const baseRate = income.growth_rate ?? gs.incomeGrowthRate
        const effectiveRate = getEffectiveRate(baseRate, rateCategory as RateCategory, gs.scenarioMode, gs)
        const monthlyRate = Math.pow(1 + effectiveRate / 100, 1 / 12) - 1

        const monthsFromStart = (year - income.start_year) * 12 + (month - income.start_month)
        const baseAmount = income.frequency === 'yearly'
          ? income.amount / 12
          : income.amount
        const amount = baseAmount * Math.pow(1 + monthlyRate, Math.max(0, monthsFromStart))

        state.currentCash += amount
        yearlyIncome += amount
        monthIncome += amount
        monthIncomeBreakdown.push({ title: income.title, amount, type: income.type })
      }

      // A2. 월간 지출 (부채 연동 지출은 A5에서 직접 계산)
      for (const expense of data.expenses) {
        if (!expense.is_active) continue
        // 부채 연동 지출은 A5에서 직접 계산하므로 건너뜀
        if (expense.source_type === 'debt') continue

        let endY = expense.end_year
        let endM = expense.end_month
        if (expense.retirement_link === 'self') {
          endY = profile.birthYear + profile.retirementAge
          endM = 12
        } else if (expense.retirement_link === 'spouse') {
          endY = getRetirementYear('spouse', profile)
          endM = 12
        }

        if (!isInPeriod(year, month, expense.start_year, expense.start_month, endY, endM)) continue

        const rateCategory = expense.rate_category || getDefaultRateCategory(expense.type)
        const baseRate = expense.growth_rate ?? gs.inflationRate
        const effectiveRate = getEffectiveRate(baseRate, rateCategory as RateCategory, gs.scenarioMode, gs)
        const monthlyRate = Math.pow(1 + effectiveRate / 100, 1 / 12) - 1

        const monthsFromStart = (year - expense.start_year) * 12 + (month - expense.start_month)
        const baseAmount = expense.frequency === 'yearly'
          ? expense.amount / 12
          : expense.amount
        const amount = baseAmount * Math.pow(1 + monthlyRate, Math.max(0, monthsFromStart))

        state.currentCash -= amount
        yearlyExpense += amount
        monthExpense += amount
        monthExpenseBreakdown.push({ title: expense.title, amount, type: expense.type })
      }

      // A3. 저축 월 납입금 처리
      for (const saving of state.savings) {
        if (saving.isMatured || !saving.isActive || !saving.monthlyContribution) continue

        // 납입 기간 체크
        let contribEndYear = saving.contributionEndYear
        let contribEndMonth = saving.contributionEndMonth
        if (saving.isContributionFixedToRetirement) {
          contribEndYear = getRetirementYear(saving.owner, profile)
          contribEndMonth = 12
        }

        const inContribPeriod = isInPeriod(
          year, month,
          saving.contributionStartYear, saving.contributionStartMonth,
          contribEndYear, contribEndMonth
        )

        if (inContribPeriod) {
          state.currentCash -= saving.monthlyContribution
          yearlyExpense += saving.monthlyContribution
          saving.balance += saving.monthlyContribution
          saving.totalPrincipal += saving.monthlyContribution
          monthExpense += saving.monthlyContribution
          monthExpenseBreakdown.push({ title: `${saving.title} 납입`, amount: saving.monthlyContribution, type: 'savings' })

          // 현금흐름 추적: 저축 적립
          const existingSavContrib = savingsContribTotals.get(saving.id)
          if (existingSavContrib) {
            existingSavContrib.amount += saving.monthlyContribution
          } else {
            savingsContribTotals.set(saving.id, {
              title: saving.title,
              amount: saving.monthlyContribution,
              id: saving.id,
            })
          }
        }
      }

      // A4. 연금 월 납입금 처리
      for (const pension of state.pensions) {
        if (pension.isMatured || !pension.monthlyContribution) continue
        if (pension.category === 'national') continue // 국민연금은 납입 없음

        let contribEndYear = pension.contributionEndYear
        let contribEndMonth = pension.contributionEndMonth
        if (pension.isContributionFixedToRetirement) {
          contribEndYear = getRetirementYear(pension.owner, profile)
          contribEndMonth = 12
        }

        // ISA는 만기까지만 납입
        if (pension.pensionSubType === 'isa') {
          contribEndYear = pension.isaMaturityYear ?? contribEndYear
          contribEndMonth = pension.isaMaturityMonth ?? contribEndMonth
        }

        const inContribPeriod = isInPeriod(
          year, month,
          null, null,
          contribEndYear, contribEndMonth
        )

        if (inContribPeriod) {
          state.currentCash -= pension.monthlyContribution
          yearlyExpense += pension.monthlyContribution
          pension.balance += pension.monthlyContribution
          pension.totalPrincipal += pension.monthlyContribution
          monthExpense += pension.monthlyContribution
          monthExpenseBreakdown.push({ title: `${pension.title} 납입`, amount: pension.monthlyContribution, type: 'pension' })

          // 현금흐름 추적: 연금 적립
          const existingPenContrib = pensionContribTotals.get(pension.id)
          if (existingPenContrib) {
            existingPenContrib.amount += pension.monthlyContribution
          } else {
            pensionContribTotals.set(pension.id, {
              title: pension.title,
              amount: pension.monthlyContribution,
              id: pension.id,
              category: pension.category,
            })
          }
        }
      }

      // A5. 부채 월 상환액 처리
      for (const debt of state.debts) {
        if (debt.isPaidOff) continue
        if (!isInPeriod(year, month, debt.startYear, debt.startMonth, debt.maturityYear, debt.maturityMonth)) continue

        const monthsFromStart = (year - debt.startYear) * 12 + (month - debt.startMonth)
        const monthlyRate = debt.interestRate / 100 / 12
        let debtPaymentThisMonth = 0
        let debtInterestThisMonth = 0
        let debtPrincipalThisMonth = 0

        // 거치기간 체크
        if (debt.repaymentType === '거치식상환' && monthsFromStart < debt.gracePeriodMonths) {
          // 거치기간: 이자만 납부
          debtInterestThisMonth = debt.currentBalance * monthlyRate
          debtPaymentThisMonth = debtInterestThisMonth
        } else {
          // 상환
          const interestPayment = debt.currentBalance * monthlyRate
          let principalPayment = 0

          switch (debt.repaymentType) {
            case '만기일시상환':
              // 이자만 매월 납부
              debtInterestThisMonth = interestPayment
              debtPaymentThisMonth = interestPayment
              // 만기 시 원금 상환
              if (year === debt.maturityYear && month === debt.maturityMonth) {
                debtPrincipalThisMonth = debt.currentBalance
                debtPaymentThisMonth += debt.currentBalance
                debt.currentBalance = 0
                debt.isPaidOff = true
                events.push(`${debt.title} 만기상환`)
              }
              break

            case '원리금균등상환': {
              const totalMonths = (debt.maturityYear - debt.startYear) * 12 + (debt.maturityMonth - debt.startMonth)
              const remainingMonthsForDebt = Math.max(1, totalMonths - monthsFromStart)
              const pmt = calculatePMT(debt.currentBalance, monthlyRate, remainingMonthsForDebt)
              principalPayment = pmt - interestPayment
              debtInterestThisMonth = interestPayment
              debtPrincipalThisMonth = principalPayment
              debtPaymentThisMonth = interestPayment + principalPayment
              debt.currentBalance = Math.max(0, debt.currentBalance - principalPayment)
              if (debt.currentBalance <= 0) {
                debt.isPaidOff = true
                events.push(`${debt.title} 상환 완료`)
              }
              break
            }

            case '원금균등상환': {
              const totalMonths = (debt.maturityYear - debt.startYear) * 12 + (debt.maturityMonth - debt.startMonth)
              principalPayment = debt.originalPrincipal / totalMonths
              debtInterestThisMonth = interestPayment
              debtPrincipalThisMonth = principalPayment
              debtPaymentThisMonth = interestPayment + principalPayment
              debt.currentBalance = Math.max(0, debt.currentBalance - principalPayment)
              if (debt.currentBalance <= 0) {
                debt.isPaidOff = true
                events.push(`${debt.title} 상환 완료`)
              }
              break
            }

            case '거치식상환': {
              // 거치기간 이후 원리금균등
              const totalMonthsDebt = (debt.maturityYear - debt.startYear) * 12 + (debt.maturityMonth - debt.startMonth)
              const remainingRepayMonths = Math.max(1, totalMonthsDebt - monthsFromStart)
              const pmt = calculatePMT(debt.currentBalance, monthlyRate, remainingRepayMonths)
              principalPayment = pmt - interestPayment
              debtInterestThisMonth = interestPayment
              debtPrincipalThisMonth = principalPayment
              debtPaymentThisMonth = interestPayment + principalPayment
              debt.currentBalance = Math.max(0, debt.currentBalance - principalPayment)
              if (debt.currentBalance <= 0) {
                debt.isPaidOff = true
                events.push(`${debt.title} 상환 완료`)
              }
              break
            }
          }
        }

        // 현금흐름 반영 + 추적
        state.currentCash -= debtPaymentThisMonth
        yearlyExpense += debtPaymentThisMonth
        debtPaymentTotals.set(debt.id, (debtPaymentTotals.get(debt.id) || 0) + debtPaymentThisMonth)
        monthExpense += debtPaymentThisMonth
        monthExpenseBreakdown.push({ title: debt.title, amount: debtPaymentThisMonth, type: 'debt' })

        // 현금흐름 추적: 이자/원금 분리
        if (debtInterestThisMonth > 0) {
          const existingInterest = debtInterestTotals.get(debt.id)
          if (existingInterest) {
            existingInterest.amount += debtInterestThisMonth
          } else {
            debtInterestTotals.set(debt.id, {
              title: debt.title,
              amount: debtInterestThisMonth,
              id: debt.id,
            })
          }
        }
        if (debtPrincipalThisMonth > 0) {
          const existingPrincipal = debtPrincipalTotals.get(debt.id)
          if (existingPrincipal) {
            existingPrincipal.amount += debtPrincipalThisMonth
          } else {
            debtPrincipalTotals.set(debt.id, {
              title: debt.title,
              amount: debtPrincipalThisMonth,
              id: debt.id,
            })
          }
        }
      }

      // A6. 부동산 대출 잔액 감소 추적
      // (이자/원금 지출은 expenses 테이블에 연동으로 이미 포함됨, 여기서는 잔액만 추적)
      for (const re of state.realEstates) {
        if (re.isSold || !re.hasLoan || re.loanBalance <= 0) continue
        if (!re.loanStartYear || !re.loanMaturityYear) continue
        if (!isInPeriod(year, month, re.loanStartYear, re.loanStartMonth || 1, re.loanMaturityYear, re.loanMaturityMonth || 12)) continue

        const loanRate = re.loanRate || gs.debtInterestRate
        const loanMonthlyRate = loanRate / 100 / 12
        const totalLoanMonths = ((re.loanMaturityYear || 0) - (re.loanStartYear || 0)) * 12 +
          ((re.loanMaturityMonth || 12) - (re.loanStartMonth || 1))
        const monthsElapsedLoan = (year - (re.loanStartYear || 0)) * 12 + (month - (re.loanStartMonth || 1))

        switch (re.loanRepaymentType) {
          case '만기일시상환':
            // 잔액 유지, 만기 시 0
            if (year === re.loanMaturityYear && month === (re.loanMaturityMonth || 12)) {
              re.loanBalance = 0
            }
            break
          case '원리금균등상환': {
            const remainingLoanMonths = Math.max(1, totalLoanMonths - monthsElapsedLoan)
            const loanPmt = calculatePMT(re.loanBalance, loanMonthlyRate, remainingLoanMonths)
            const loanInterest = re.loanBalance * loanMonthlyRate
            const loanPrincipal = loanPmt - loanInterest
            re.loanBalance = Math.max(0, re.loanBalance - loanPrincipal)
            break
          }
          case '원금균등상환': {
            const loanPrincipal = (re.loanAmount || 0) / Math.max(1, totalLoanMonths)
            re.loanBalance = Math.max(0, re.loanBalance - loanPrincipal)
            break
          }
          case '거치식상환':
            // 거치기간 판단을 위한 간단한 처리 (거치 끝 이후 원리금균등)
            // 부동산 대출은 grace_end_year/month를 사용
            // 여기서는 간단히 전체 기간의 30%를 거치로 가정
            if (monthsElapsedLoan > totalLoanMonths * 0.3) {
              const remainingRepay = Math.max(1, totalLoanMonths - monthsElapsedLoan)
              const loanPmt = calculatePMT(re.loanBalance, loanMonthlyRate, remainingRepay)
              const loanInterest = re.loanBalance * loanMonthlyRate
              const loanPrincipal = loanPmt - loanInterest
              re.loanBalance = Math.max(0, re.loanBalance - loanPrincipal)
            }
            break
        }
      }

      // A7. 부동산 매각 이벤트
      for (const re of state.realEstates) {
        if (re.isSold) continue
        if (re.sellYear === year && re.sellMonth === month) {
          const salePrice = re.currentValue
          const holdingYears = re.purchaseYear ? year - re.purchaseYear : 0
          const isResidence = re.type === 'residence'

          // 세금 비활성화 (추후 프리미엄 기능으로 재설계)
          // const cgt = calculateCapitalGainsTax(salePrice, re.purchasePrice, holdingYears, isResidence)
          // yearlyTax += cgt
          const cgt = 0

          // 순매각대금 → currentCash
          const netProceeds = salePrice - cgt
          state.currentCash += netProceeds
          yearlyIncome += netProceeds
          monthIncome += netProceeds
          monthIncomeBreakdown.push({ title: `${re.title} 매각`, amount: netProceeds, type: 'real_estate_sale' })

          // 연동 대출이 있으면 정리
          if (re.hasLoan && re.loanBalance > 0) {
            state.currentCash -= re.loanBalance
            yearlyExpense += re.loanBalance
            monthExpense += re.loanBalance
            monthExpenseBreakdown.push({ title: `${re.title} 대출 상환`, amount: re.loanBalance, type: 'loan_repayment' })
            eventFlowItems.push({
              title: `${re.title} 대출 상환`,
              amount: -Math.round(re.loanBalance),
              flowType: 'debt_principal',
              sourceType: 'real_estates',
              sourceId: re.id,
            })
            re.loanBalance = 0
          }

          re.isSold = true
          events.push(`${re.title} 매각 (${Math.round(salePrice)}만원, 세금 ${Math.round(cgt)}만원)`)
          // Track for cashFlowItems
          eventFlowItems.push({
            title: `${re.title} 매각`,
            amount: Math.round(salePrice),
            flowType: 'real_estate_sale',
            sourceType: 'real_estates',
            sourceId: re.id,
          })
        }
      }

      // A8. 실물자산 매각 이벤트
      for (const asset of state.physicalAssets) {
        if (asset.isSold) continue
        if (asset.sellYear === year && asset.sellMonth === month) {
          state.currentCash += asset.currentValue
          yearlyIncome += asset.currentValue
          monthIncome += asset.currentValue
          monthIncomeBreakdown.push({ title: `${asset.title} 매각`, amount: asset.currentValue, type: 'physical_asset_sale' })
          asset.isSold = true
          events.push(`${asset.title} 매각 (${Math.round(asset.currentValue)}만원)`)
          eventFlowItems.push({
            title: `${asset.title} 매각`,
            amount: Math.round(asset.currentValue),
            flowType: 'asset_sale',
            sourceType: 'physical_assets',
            sourceId: asset.id,
          })
        }
      }

      // A9. ISA 만기 처리
      for (const pension of state.pensions) {
        if (pension.isMatured) continue
        if (pension.pensionSubType !== 'isa') continue
        if (pension.isaMaturityYear === year && pension.isaMaturityMonth === month) {
          const gain = pension.balance - pension.totalPrincipal
          // 세금 비활성화 (추후 프리미엄 기능으로 재설계)
          // const tax = calculateISATax(gain)
          // yearlyTax += tax
          const tax = 0
          const netAmount = pension.balance - tax

          switch (pension.isaMaturityStrategy) {
            case 'pension_savings': {
              // 연금저축으로 이전
              const target = state.pensions.find(p =>
                p.pensionSubType === 'pension_savings' && p.owner === pension.owner && !p.isMatured
              )
              if (target) {
                target.balance += netAmount
                target.totalPrincipal += netAmount
              } else {
                state.currentCash += netAmount
              }
              events.push(`${pension.title} 만기 → 연금저축 이전 (${Math.round(netAmount)}만원)`)
              break
            }
            case 'irp': {
              const target = state.pensions.find(p =>
                p.pensionSubType === 'irp' && p.owner === pension.owner && !p.isMatured
              )
              if (target) {
                target.balance += netAmount
                target.totalPrincipal += netAmount
              } else {
                state.currentCash += netAmount
              }
              events.push(`${pension.title} 만기 → IRP 이전 (${Math.round(netAmount)}만원)`)
              break
            }
            default:
              state.currentCash += netAmount
              yearlyIncome += netAmount
              monthIncome += netAmount
              monthIncomeBreakdown.push({ title: `${pension.title} 만기`, amount: netAmount, type: 'isa_maturity' })
              events.push(`${pension.title} 만기 → 현금 수령 (${Math.round(netAmount)}만원)`)
              eventFlowItems.push({
                title: `${pension.title} 만기`,
                amount: Math.round(pension.balance),
                flowType: 'savings_withdrawal',
                sourceType: 'pension',
                sourceId: pension.id,
              })
          }

          pension.balance = 0
          pension.isMatured = true
        }
      }

      // A10. 국민연금 수령
      for (const pension of state.pensions) {
        if (pension.category !== 'national' || pension.isMatured) continue
        if (!pension.expectedMonthlyAmount || !pension.startAge) continue

        const ownerBirthYear = getOwnerBirthYear(pension.owner, profile)
        const ownerAge = year - ownerBirthYear
        const endAge = pension.endAge ?? 999

        if (ownerAge >= pension.startAge && ownerAge <= endAge) {
          // 물가상승률 적용
          const yearsReceiving = ownerAge - pension.startAge
          const adjustedAmount = pension.expectedMonthlyAmount * Math.pow(1 + inflationPct / 100, yearsReceiving)
          state.currentCash += adjustedAmount
          yearlyIncome += adjustedAmount
          monthIncome += adjustedAmount
          monthIncomeBreakdown.push({ title: pension.title, amount: adjustedAmount, type: 'national_pension' })
          pensionIncomeTotals.set(pension.id, (pensionIncomeTotals.get(pension.id) || 0) + adjustedAmount)
          pension.isReceiving = true
        }
      }

      // A11. 퇴직/개인연금 수령
      for (const pension of state.pensions) {
        if (pension.category === 'national' || pension.isMatured) continue
        if (pension.pensionSubType === 'isa') continue

        const ownerBirthYear = getOwnerBirthYear(pension.owner, profile)
        const ownerAge = year - ownerBirthYear
        const startAge = pension.startAgeForReceiving || profile.retirementAge

        if (ownerAge >= startAge && pension.balance > 0) {
          if (!pension.isReceiving) {
            pension.isReceiving = true
          }

          const receivingYears = pension.receivingYears || 20
          const monthlyReturnRate = Math.pow(1 + pension.returnRate / 100, 1 / 12) - 1

          // PMT로 월 수령액 계산 (연초 기준 일관된 값 사용)
          const elapsedReceivingMonths = (ownerAge - startAge) * 12
          const remainingMonths = Math.max(1, receivingYears * 12 - elapsedReceivingMonths)
          let monthlyWithdrawal: number

          if (monthlyReturnRate === 0 || remainingMonths <= 0) {
            monthlyWithdrawal = pension.balance / Math.max(1, remainingMonths)
          } else {
            monthlyWithdrawal = pension.balance *
              (monthlyReturnRate * Math.pow(1 + monthlyReturnRate, remainingMonths)) /
              (Math.pow(1 + monthlyReturnRate, remainingMonths) - 1)
          }

          monthlyWithdrawal = Math.min(monthlyWithdrawal, pension.balance)
          pension.balance -= monthlyWithdrawal
          state.currentCash += monthlyWithdrawal
          yearlyIncome += monthlyWithdrawal
          monthIncome += monthlyWithdrawal
          monthIncomeBreakdown.push({ title: pension.title, amount: monthlyWithdrawal, type: 'pension_withdrawal' })
          pensionIncomeTotals.set(pension.id, (pensionIncomeTotals.get(pension.id) || 0) + monthlyWithdrawal)

          if (pension.balance <= 0) {
            pension.balance = 0
            pension.isMatured = true
          }
        }
      }

      // A14. 월별 자산 성장 (이자/수익률/가치 상승)
      // 저축 이자/수익률
      for (const saving of state.savings) {
        if (saving.isMatured || !saving.isActive) continue
        let annualRate: number
        if (isSavingsType(saving.type)) {
          annualRate = saving.interestRate ?? savingsReturnPct
        } else {
          annualRate = saving.expectedReturn ?? investmentReturnPct
        }
        if (annualRate > 0) {
          const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1
          saving.balance *= (1 + monthlyRate)
        }
      }
      // 연금 적립 성장
      for (const pension of state.pensions) {
        if (pension.category === 'national' || pension.isMatured) continue
        if (pension.pensionSubType === 'isa') continue
        if (pension.isReceiving) continue
        const returnRate = pension.returnRate || pensionReturnPct
        if (returnRate > 0) {
          const monthlyRate = Math.pow(1 + returnRate / 100, 1 / 12) - 1
          pension.balance *= (1 + monthlyRate)
        }
      }
      // 부동산 가치 성장
      for (const re of state.realEstates) {
        if (re.isSold) continue
        const effectiveRate = getEffectiveRate(re.growthRate, 'realEstate' as RateCategory, gs.scenarioMode, gs)
        if (effectiveRate !== 0) {
          const monthlyRate = Math.pow(1 + effectiveRate / 100, 1 / 12) - 1
          re.currentValue *= (1 + monthlyRate)
        }
      }
      // 실물자산 성장/감가
      for (const asset of state.physicalAssets) {
        if (asset.isSold) continue
        if (asset.annualRate !== 0) {
          const monthlyRate = Math.pow(1 + asset.annualRate / 100, 1 / 12) - 1
          asset.currentValue *= (1 + monthlyRate)
          if (asset.currentValue < 0) asset.currentValue = 0
        }
      }

      // A12. 저축 만기 처리 (정기예금 등)
      for (const saving of state.savings) {
        if (saving.isMatured || !saving.isActive) continue
        if (!saving.maturityYear || !saving.maturityMonth) continue
        if (year !== saving.maturityYear || month !== saving.maturityMonth) continue

        // A14에서 이미 월별 이자 적용됨 → 추가 이자 계산 불필요
        const gain = saving.balance - saving.totalPrincipal
        // 세금 비활성화 (추후 프리미엄 기능으로 재설계)
        // const tax = calculateInterestIncomeTax(gain, saving.isTaxFree)
        // yearlyTax += tax
        const tax = 0

        const maturityAmount = saving.balance - tax
        state.currentCash += maturityAmount
        yearlyIncome += maturityAmount
        monthIncome += maturityAmount
        monthIncomeBreakdown.push({ title: `${saving.title} 만기`, amount: maturityAmount, type: 'savings_maturity' })
        events.push(`${saving.title} 만기 (${Math.round(maturityAmount)}만원, 세금 ${Math.round(tax)}만원)`)
        eventFlowItems.push({
          title: `${saving.title} 만기`,
          amount: Math.round(saving.balance),
          flowType: 'savings_withdrawal',
          sourceType: 'savings',
          sourceId: saving.id,
        })

        saving.balance = 0
        saving.isMatured = true
      }

      // A13. 월별 적자 보전 (currentCash < 0이면 저축에서 인출)
      if (state.currentCash < 0) {
        // 1단계: 사용자 설정 인출 순서
        if (priorities?.withdrawalRules?.length) {
          const sorted = [...priorities.withdrawalRules].sort((a, b) => a.priority - b.priority)
          for (const rule of sorted) {
            if (state.currentCash >= 0) break

            if (rule.targetCategory === 'savings') {
              const item = state.savings.find(s => s.id === rule.targetId && !s.isMatured && s.isActive && s.balance > 0)
              if (!item) continue
              const deficit = -state.currentCash
              const withdrawal = Math.min(item.balance, deficit)
              item.balance -= withdrawal
              item.totalPrincipal = Math.max(0, item.totalPrincipal - withdrawal)
              state.currentCash += withdrawal
              deficitWithdrawals.push({ title: item.title || '저축', amount: withdrawal, category: 'savings', id: item.id })
              monthWithdrawals.push({ title: `${item.title || '저축'} 인출`, amount: Math.round(withdrawal), category: 'savings' })
            } else if (rule.targetCategory === 'pension') {
              const item = state.pensions.find(p => p.id === rule.targetId && !p.isMatured && p.balance > 0)
              if (!item) continue
              const withdrawal = Math.min(item.balance, -state.currentCash)
              item.balance -= withdrawal
              state.currentCash += withdrawal
              deficitWithdrawals.push({ title: item.title || '연금', amount: withdrawal, category: 'pension', id: item.id })
              monthWithdrawals.push({ title: `${item.title || '연금'} 인출`, amount: Math.round(withdrawal), category: 'pension' })
              if (item.balance <= 0) {
                item.balance = 0
                item.isMatured = true
              }
            }
          }
        }

        // 2단계: 폴백 (유동성 순서)
        if (state.currentCash < 0) {
          const fallbackOrder = ['checking', 'savings', 'deposit', 'housing',
            'domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other']

          for (const type of fallbackOrder) {
            if (state.currentCash >= 0) break
            const items = state.savings
              .filter(s => s.type === type && !s.isMatured && s.isActive && s.balance > 0)
              .sort((a, b) => b.balance - a.balance)

            for (const item of items) {
              if (state.currentCash >= 0) break
              const deficit = -state.currentCash
              const withdrawal = Math.min(item.balance, deficit)
              item.balance -= withdrawal
              item.totalPrincipal = Math.max(0, item.totalPrincipal - withdrawal)
              state.currentCash += withdrawal
              deficitWithdrawals.push({ title: item.title || '저축', amount: withdrawal, category: 'savings', id: item.id })
              monthWithdrawals.push({ title: `${item.title || '저축'} 인출`, amount: Math.round(withdrawal), category: 'savings' })
            }
          }
        }
      }

      // A15. 월별 잉여금 배분 (Cash Flow Priorities)
      if (state.currentCash > 0 && priorities?.surplusRules?.length) {
        const sorted = [...priorities.surplusRules].sort((a, b) => a.priority - b.priority)

        for (const rule of sorted) {
          if (state.currentCash <= 0) break

          // 연간 한도 체크 (surplusAllocated는 연 단위로 추적)
          const allocated = surplusAllocated.get(rule.id) || 0
          let maxThisRule = state.currentCash
          if (rule.annualLimit != null) {
            maxThisRule = Math.min(state.currentCash, Math.max(0, rule.annualLimit - allocated))
          }
          if (maxThisRule <= 0) continue

          let actualAllocation = 0

          if (rule.targetCategory === 'savings') {
            const target = state.savings.find(s => s.id === rule.targetId && !s.isMatured && s.isActive)
            if (!target) continue
            target.balance += maxThisRule
            target.totalPrincipal += maxThisRule
            actualAllocation = maxThisRule
          } else if (rule.targetCategory === 'pension') {
            const target = state.pensions.find(p => p.id === rule.targetId && !p.isMatured)
            if (!target) continue
            target.balance += maxThisRule
            target.totalPrincipal += maxThisRule
            actualAllocation = maxThisRule
          } else if (rule.targetCategory === 'debt') {
            const target = state.debts.find(d => d.id === rule.targetId && !d.isPaidOff)
            if (!target) continue
            const repay = Math.min(maxThisRule, target.currentBalance)
            target.currentBalance -= repay
            if (target.currentBalance <= 0) {
              target.isPaidOff = true
              events.push(`${target.title} 조기상환`)
            }
            actualAllocation = repay
          }

          if (actualAllocation > 0) {
            state.currentCash -= actualAllocation
            surplusAllocated.set(rule.id, allocated + actualAllocation)
            const targetName = rule.targetCategory === 'savings'
              ? state.savings.find(s => s.id === rule.targetId)?.title
              : rule.targetCategory === 'pension'
              ? state.pensions.find(p => p.id === rule.targetId)?.title
              : state.debts.find(d => d.id === rule.targetId)?.title
            surplusInvestments.push({
              title: targetName || '알 수 없음',
              amount: actualAllocation,
              category: rule.targetCategory,
              id: rule.targetId
            })
            const actionLabel = rule.targetCategory === 'debt' ? '상환' : '적립'
            monthSurplus.push({ title: `${targetName || '알 수 없음'} ${actionLabel}`, amount: Math.round(actualAllocation), category: rule.targetCategory })
          }
        }
      }

      // 월말 스냅샷 생성
      const mFinancialAssets = state.savings
        .filter(s => !s.isMatured && s.isActive)
        .reduce((sum, s) => sum + s.balance, 0) + Math.max(0, state.currentCash)

      const mPensionAssets = state.pensions
        .filter(p => !p.isMatured)
        .reduce((sum, p) => sum + p.balance, 0)

      const mRealEstateValue = state.realEstates
        .filter(re => !re.isSold)
        .reduce((sum, re) => {
          if (re.housingType === '전세' || re.housingType === '월세') {
            return sum + (re.deposit || 0)
          }
          return sum + re.currentValue
        }, 0)

      const mPhysicalAssetValue = state.physicalAssets
        .filter(a => !a.isSold)
        .reduce((sum, a) => sum + a.currentValue, 0)

      const mTotalDebts = state.debts
        .filter(d => !d.isPaidOff)
        .reduce((sum, d) => sum + d.currentBalance, 0) +
        (state.currentCash < 0 ? Math.abs(state.currentCash) : 0)

      const mTotalAssets = mFinancialAssets + mPensionAssets + mRealEstateValue + mPhysicalAssetValue

      // 월별 자산 breakdown
      const mAssetBreakdown: { title: string; amount: number; type: string }[] = []

      // 부동산
      for (const re of state.realEstates) {
        if (re.isSold) continue
        const label = ownerLabels[re.owner] || ''
        const displayTitle = label ? `${re.title} | ${label}` : re.title
        if (re.housingType === '전세' || re.housingType === '월세') {
          if (re.deposit && re.deposit > 0) {
            mAssetBreakdown.push({ title: `${displayTitle} 보증금`, amount: Math.round(re.deposit), type: 'deposit' })
          }
        } else {
          if (re.currentValue > 0) {
            mAssetBreakdown.push({ title: displayTitle, amount: Math.round(re.currentValue), type: 'real_estate' })
          }
        }
      }

      // 저축/투자 계좌
      for (const saving of state.savings) {
        if (saving.isMatured || !saving.isActive || saving.balance <= 0) continue
        const label = ownerLabels[saving.owner] || ''
        const displayTitle = label ? `${saving.title} | ${label}` : saving.title
        const savingsCategory = getSavingsAssetCategory(saving.type)
        mAssetBreakdown.push({ title: displayTitle, amount: Math.round(saving.balance), type: savingsCategory })
      }

      // 현금잔고 (입출금통장)
      if (state.currentCash > 0) {
        mAssetBreakdown.push({ title: state.checkingAccountTitle || '현금잔고', amount: Math.round(state.currentCash), type: 'savings' })
      }

      // 실물자산
      for (const asset of state.physicalAssets) {
        if (asset.isSold || asset.currentValue <= 0) continue
        const label = ownerLabels[asset.owner] || ''
        const displayTitle = label ? `${asset.title} | ${label}` : asset.title
        mAssetBreakdown.push({ title: displayTitle, amount: Math.round(asset.currentValue), type: 'tangible' })
      }

      // 월별 부채 breakdown
      const mDebtBreakdown: { title: string; amount: number; type: string }[] = []
      for (const debt of state.debts) {
        if (debt.isPaidOff) continue
        mDebtBreakdown.push({ title: debt.title, amount: Math.round(debt.currentBalance), type: getDebtAssetCategory(debt.type) })
      }
      if (state.currentCash < 0) {
        mDebtBreakdown.push({ title: '마이너스 통장', amount: Math.round(Math.abs(state.currentCash)), type: 'other_debt' })
      }

      // 월별 연금 breakdown
      const mPensionBreakdown: { title: string; amount: number; type: string }[] = []
      for (const pension of state.pensions) {
        if (pension.isMatured || pension.balance <= 0) continue
        const label = ownerLabels[pension.owner] || ''
        const displayTitle = label ? `${pension.title} | ${label}` : pension.title
        mPensionBreakdown.push({ title: displayTitle, amount: Math.round(pension.balance), type: 'pension' })
      }

      monthlySnapshots.push({
        year,
        month,
        age,
        monthlyIncome: Math.round(monthIncome),
        monthlyExpense: Math.round(monthExpense),
        netCashFlow: Math.round(monthIncome - monthExpense),
        financialAssets: Math.round(mFinancialAssets),
        pensionAssets: Math.round(mPensionAssets),
        realEstateValue: Math.round(mRealEstateValue),
        physicalAssetValue: Math.round(mPhysicalAssetValue),
        totalDebts: Math.round(mTotalDebts),
        netWorth: Math.round(mTotalAssets - mTotalDebts),
        currentCash: Math.round(state.currentCash),
        incomeBreakdown: monthIncomeBreakdown,
        expenseBreakdown: monthExpenseBreakdown,
        assetBreakdown: mAssetBreakdown,
        debtBreakdown: mDebtBreakdown,
        pensionBreakdown: mPensionBreakdown,
        withdrawalBreakdown: monthWithdrawals.length > 0 ? monthWithdrawals : undefined,
        surplusBreakdown: monthSurplus.length > 0 ? monthSurplus : undefined,
      })
    }

    // ==============================
    // Phase B: 연말 처리 (자산 성장/잉여배분/적자인출은 A14/A15/A13에서 월별 처리)
    // ==============================

    // B2. 저축 만기 처리 (maturityMonth가 없는 경우만 - 연말 기준 처리)
    // A14에서 이미 12개월 이자가 월별 적용되었으므로 추가 이자 불필요
    for (const saving of state.savings) {
      if (saving.isMatured || !saving.isActive) continue
      if (!saving.maturityYear) continue
      if (saving.maturityMonth) continue  // maturityMonth가 있으면 A12에서 이미 처리됨

      if (year >= saving.maturityYear) {
        const gain = saving.balance - saving.totalPrincipal
        // 세금 비활성화 (추후 프리미엄 기능으로 재설계)
        // const tax = calculateInterestIncomeTax(gain, saving.isTaxFree)
        // yearlyTax += tax
        const tax = 0

        const maturityAmount = saving.balance - tax
        state.currentCash += maturityAmount
        events.push(`${saving.title} 만기 (${Math.round(maturityAmount)}만원, 세금 ${Math.round(tax)}만원)`)
        eventFlowItems.push({
          title: `${saving.title} 만기`,
          amount: Math.round(saving.balance),
          flowType: 'savings_withdrawal',
          sourceType: 'savings',
          sourceId: saving.id,
        })

        saving.balance = 0
        saving.isMatured = true
      }
    }

    // ==============================
    // B8. YearlySnapshot 생성
    // ==============================

    // 항목별 연간 소득/지출을 다시 계산하여 breakdown 생성
    const incomeBrkDown = buildIncomeBreakdown(data.incomes, year, profile, gs)
    const expenseBrkDown = buildExpenseBreakdown(data.expenses, year, profile, gs)

    // 직접 계산된 부채 상환액을 지출 breakdown에 추가
    for (const debt of state.debts) {
      const amount = debtPaymentTotals.get(debt.id)
      if (amount && amount > 0) {
        expenseBrkDown.push({ title: debt.title, amount: amount, type: 'debt' })
      }
    }

    // 직접 계산된 연금 수령액을 소득 breakdown에 추가
    for (const pension of state.pensions) {
      const amount = pensionIncomeTotals.get(pension.id)
      if (amount && amount > 0) {
        incomeBrkDown.push({ title: pension.title, amount: amount, type: 'pension' })
      }
    }

    // 자산 합계
    const financialAssets = state.savings
      .filter(s => !s.isMatured && s.isActive)
      .reduce((sum, s) => sum + s.balance, 0) + Math.max(0, state.currentCash)

    const pensionAssets = state.pensions
      .filter(p => !p.isMatured)
      .reduce((sum, p) => sum + p.balance, 0)

    const realEstateValue = state.realEstates
      .filter(re => !re.isSold)
      .reduce((sum, re) => {
        if (re.housingType === '전세' || re.housingType === '월세') {
          return sum + (re.deposit || 0)
        }
        return sum + re.currentValue
      }, 0)

    const physicalAssetValue = state.physicalAssets
      .filter(a => !a.isSold)
      .reduce((sum, a) => sum + a.currentValue, 0)

    const totalAssets = Math.round(financialAssets + pensionAssets + realEstateValue + physicalAssetValue)

    const totalDebts = state.debts
      .filter(d => !d.isPaidOff)
      .reduce((sum, d) => sum + d.currentBalance, 0)

    // 부동산 연동 대출은 state.debts에 이미 포함 (source_type: 'real_estate')
    // realEstates.loanBalance는 매각 시 대출 정리용으로만 사용

    const cashDeficit = state.currentCash < 0 ? Math.abs(state.currentCash) : 0
    const totalDebtsAll = Math.round(totalDebts + cashDeficit)

    const netWorth = totalAssets - totalDebtsAll

    // 자산 breakdown
    const assetBreakdown: { title: string; amount: number; type: string }[] = []

    // 부동산
    for (const re of state.realEstates) {
      if (re.isSold) continue
      const label = ownerLabels[re.owner] || ''
      const displayTitle = label ? `${re.title} | ${label}` : re.title

      if (re.housingType === '전세' || re.housingType === '월세') {
        if (re.deposit && re.deposit > 0) {
          assetBreakdown.push({ title: `${displayTitle} 보증금`, amount: Math.round(re.deposit), type: 'deposit' })
        }
      } else {
        if (re.currentValue > 0) {
          assetBreakdown.push({ title: displayTitle, amount: Math.round(re.currentValue), type: 'real_estate' })
        }
      }
    }

    // 금융자산 (개별 항목)
    for (const saving of state.savings) {
      if (saving.isMatured || !saving.isActive || saving.balance <= 0) continue
      const label = ownerLabels[saving.owner] || ''
      const displayTitle = label ? `${saving.title} | ${label}` : saving.title
      const savingsCategory = getSavingsAssetCategory(saving.type)
      assetBreakdown.push({ title: displayTitle, amount: Math.round(saving.balance), type: savingsCategory })
    }

    // 현금잔고 (입출금통장명으로 표시)
    if (state.currentCash > 0) {
      assetBreakdown.push({ title: state.checkingAccountTitle || '현금잔고', amount: Math.round(state.currentCash), type: 'savings' })
    }

    // 실물자산
    for (const asset of state.physicalAssets) {
      if (asset.isSold || asset.currentValue <= 0) continue
      const label = ownerLabels[asset.owner] || ''
      const displayTitle = label ? `${asset.title} | ${label}` : asset.title
      assetBreakdown.push({ title: displayTitle, amount: Math.round(asset.currentValue), type: 'tangible' })
    }

    // 부채 breakdown
    const debtBreakdown: { title: string; amount: number; type: string }[] = []
    for (const debt of state.debts) {
      if (debt.isPaidOff) continue
      debtBreakdown.push({ title: debt.title, amount: Math.round(debt.currentBalance), type: getDebtAssetCategory(debt.type) })
    }
    // 부동산 연동 대출은 state.debts에서 이미 포함됨 (중복 방지)
    // 마이너스 통장 (현금 적자 시 부채로 표시)
    if (state.currentCash < 0) {
      debtBreakdown.push({ title: '마이너스 통장', amount: Math.round(Math.abs(state.currentCash)), type: 'other_debt' })
    }

    // 연금 breakdown
    const pensionBreakdown: { title: string; amount: number; type: string }[] = []
    for (const pension of state.pensions) {
      if (pension.isMatured || pension.balance <= 0) continue
      const label = ownerLabels[pension.owner] || ''
      const displayTitle = label ? `${pension.title} | ${label}` : pension.title
      pensionBreakdown.push({ title: displayTitle, amount: Math.round(pension.balance), type: 'pension' })
    }

    // V2 확장 필드
    const savingsBreakdown = state.savings
      .filter(s => !s.isMatured && s.isActive)
      .map(s => ({ id: s.id, title: s.title, balance: Math.round(s.balance), type: s.type }))

    const realEstateBreakdown = state.realEstates.map(re => ({
      id: re.id,
      title: re.title,
      value: Math.round(re.currentValue),
      isSold: re.isSold,
    }))

    const physicalAssetBreakdown = state.physicalAssets
      .filter(a => !a.isSold)
      .map(a => ({ id: a.id, title: a.title, value: Math.round(a.currentValue) }))

    // ==============================
    // 현금흐름 상세 (cashFlowItems) 조립
    // ==============================

    // 소득 항목
    for (const item of incomeBrkDown) {
      cashFlowItems.push({
        title: item.title,
        amount: item.amount,
        flowType: 'income',
        sourceType: 'income',
      })
    }

    // 이벤트 현금흐름 (부동산 매각, 자산 매각, 저축 만기 등)
    for (const event of eventFlowItems) {
      cashFlowItems.push(event)
    }

    // 지출 항목 (부채는 아래에서 이자/원금 분리로 추적하므로 제외)
    for (const item of expenseBrkDown) {
      if (item.type === 'debt') continue
      cashFlowItems.push({
        title: item.title,
        amount: -Math.abs(item.amount),
        flowType: 'expense',
        sourceType: 'expense',
      })
    }

    // 저축 적립
    for (const [id, contrib] of savingsContribTotals) {
      if (contrib.amount > 0) {
        cashFlowItems.push({
          title: `${contrib.title} | 적립`,
          amount: -contrib.amount,
          flowType: 'savings_contribution',
          sourceType: 'savings',
          sourceId: id,
        })
      }
    }

    // 연금 적립
    for (const [id, contrib] of pensionContribTotals) {
      if (contrib.amount > 0) {
        cashFlowItems.push({
          title: `${contrib.title} | 적립`,
          amount: -contrib.amount,
          flowType: 'pension_contribution',
          sourceType: `${contrib.category}_pension`,
          sourceId: id,
        })
      }
    }

    // 대출 이자
    for (const [id, interest] of debtInterestTotals) {
      if (interest.amount > 0) {
        cashFlowItems.push({
          title: `${interest.title} | 이자`,
          amount: -interest.amount,
          flowType: 'debt_interest',
          sourceType: 'debts',
          sourceId: id,
        })
      }
    }

    // 대출 원금상환
    for (const [id, principal] of debtPrincipalTotals) {
      if (principal.amount > 0) {
        cashFlowItems.push({
          title: `${principal.title} | 원금상환`,
          amount: -principal.amount,
          flowType: 'debt_principal',
          sourceType: 'debts',
          sourceId: id,
        })
      }
    }

    // 세금: snapshot.taxPaid에 별도 저장 (차트 cashFlowBreakdown에는 미포함 - 추후 세금 체계 재설계 예정)

    // 잉여금 배분 (B6)
    for (const inv of surplusInvestments) {
      cashFlowItems.push({
        title: `${inv.title} | 저축`,
        amount: -inv.amount,
        flowType: 'surplus_investment',
        sourceType: inv.category === 'savings' ? 'savings' : inv.category === 'pension' ? 'pension' : 'debts',
        sourceId: inv.id,
      })
    }

    // 현금잔고 / 마이너스 통장 연간 변화분 (잔액이 아닌 delta만 표시)
    const overdraftStart = yearStartCash < 0 ? Math.abs(yearStartCash) : 0
    const overdraftEnd = state.currentCash < 0 ? Math.abs(state.currentCash) : 0
    const cashStart = Math.max(0, yearStartCash)
    const cashEnd = Math.max(0, state.currentCash)

    // 마이너스 통장 변화
    if (overdraftEnd > overdraftStart) {
      // 추가 차입 → 유입
      cashFlowItems.push({
        title: '마이너스 통장 | 인출',
        amount: overdraftEnd - overdraftStart,
        flowType: 'deficit_withdrawal',
        sourceType: 'cash',
        sourceId: 'overdraft',
      })
    } else if (overdraftStart > overdraftEnd) {
      // 상환 → 유출
      cashFlowItems.push({
        title: '마이너스 통장 | 상환',
        amount: -(overdraftStart - overdraftEnd),
        flowType: 'surplus_investment',
        sourceType: 'cash',
        sourceId: 'overdraft_repayment',
      })
    }

    // 현금잔고 변화
    if (cashEnd > cashStart) {
      // 현금 증가 → 유출 (입출금통장에 적립)
      const delta = cashEnd - cashStart
      if (delta > 1) {
        cashFlowItems.push({
          title: `${state.checkingAccountTitle || '현금잔고'} | 적립`,
          amount: -delta,
          flowType: 'surplus_investment',
          sourceType: 'cash',
          sourceId: 'cash_balance',
        })
      }
    } else if (cashStart > cashEnd) {
      // 현금 감소 → 유입 (입출금통장에서 인출)
      const delta = cashStart - cashEnd
      if (delta > 1) {
        cashFlowItems.push({
          title: `${state.checkingAccountTitle || '현금잔고'} | 인출`,
          amount: delta,
          flowType: 'deficit_withdrawal',
          sourceType: 'cash',
          sourceId: 'cash_balance',
        })
      }
    }

    // 적자 인출 (A13 월별 + B7 연말) - 같은 계좌 인출을 합산
    const aggregatedWithdrawals = new Map<string, { title: string; amount: number; category: string; id: string }>()
    for (const w of deficitWithdrawals) {
      const existing = aggregatedWithdrawals.get(w.id)
      if (existing) {
        existing.amount += w.amount
      } else {
        aggregatedWithdrawals.set(w.id, { ...w })
      }
    }
    for (const w of aggregatedWithdrawals.values()) {
      cashFlowItems.push({
        title: `${w.title} | 인출`,
        amount: w.amount,
        flowType: 'deficit_withdrawal',
        sourceType: w.category === 'savings' ? 'savings' : w.category === 'cash' ? 'cash' : 'pension',
        sourceId: w.id,
      })
    }

    snapshots.push({
      year,
      age,
      totalIncome: Math.round(yearlyIncome),
      totalExpense: Math.round(yearlyExpense),
      netCashFlow: Math.round(cashFlowItems
        .filter(item => item.flowType !== 'deficit_withdrawal' && item.flowType !== 'surplus_investment')
        .reduce((sum, item) => sum + item.amount, 0)),
      totalAssets,
      realEstateValue: Math.round(realEstateValue),
      financialAssets: Math.round(financialAssets),
      pensionAssets: Math.round(pensionAssets),
      totalDebts: totalDebtsAll,
      netWorth,
      incomeBreakdown: incomeBrkDown,
      expenseBreakdown: expenseBrkDown,
      assetBreakdown,
      debtBreakdown,
      pensionBreakdown,
      // V2 필드
      cashBalance: Math.round(state.currentCash),
      physicalAssetValue: Math.round(physicalAssetValue),
      taxPaid: Math.round(yearlyTax),
      savingsBreakdown,
      realEstateBreakdown,
      physicalAssetBreakdown,
      events: events.length > 0 ? events : undefined,
      cashFlowBreakdown: cashFlowItems.length > 0 ? cashFlowItems : undefined,
    })
  }

  // 요약 지표 계산
  const currentSnapshot = snapshots[0]
  const retirementSnapshot = snapshots.find(s => s.year === retirementYear) || currentSnapshot
  const peakSnapshot = snapshots.reduce((max, s) => s.netWorth > max.netWorth ? s : max, snapshots[0])

  const annualExpense = currentSnapshot.totalExpense
  const fiTarget = annualExpense * 25
  const fiSnapshot = snapshots.find(s => s.netWorth >= fiTarget)
  const bankruptcySnapshot = snapshots.find(s => s.financialAssets < 0)

  return {
    startYear: currentYear,
    endYear,
    retirementYear,
    snapshots,
    monthlySnapshots,
    summary: {
      currentNetWorth: currentSnapshot.netWorth,
      retirementNetWorth: retirementSnapshot.netWorth,
      peakNetWorth: peakSnapshot.netWorth,
      peakNetWorthYear: peakSnapshot.year,
      yearsToFI: fiSnapshot ? fiSnapshot.year - new Date().getFullYear() : null,
      fiTarget,
      bankruptcyYear: bankruptcySnapshot ? bankruptcySnapshot.year : null,
    },
  }
}

// ============================================
// Breakdown 빌더 함수
// ============================================

function buildIncomeBreakdown(
  incomes: Income[],
  year: number,
  profile: SimulationProfile,
  gs: GlobalSettings
): { title: string; amount: number; type?: string }[] {
  const result: { title: string; amount: number; type?: string }[] = []

  const incomeTypeLabels: Record<string, string> = {
    labor: '근로소득',
    business: '사업소득',
    rental: '임대소득',
    pension: '연금소득',
    dividend: '배당소득',
    side: '부업소득',
    other: '기타소득',
  }

  for (const income of incomes) {
    if (!income.is_active) continue
    // 연금 연동 소득은 직접 계산되므로 건너뜀
    if (income.source_type === 'national_pension' ||
        income.source_type === 'retirement_pension' ||
        income.source_type === 'personal_pension') continue

    let endY = income.end_year
    let endM = income.end_month
    if (income.retirement_link === 'self') {
      endY = profile.birthYear + profile.retirementAge
      endM = 12
    } else if (income.retirement_link === 'spouse') {
      endY = getRetirementYear('spouse', profile)
      endM = 12
    }

    const rateCategory = income.rate_category || getDefaultRateCategory(income.type)
    const baseRate = income.growth_rate ?? gs.incomeGrowthRate
    const effectiveRate = getEffectiveRate(baseRate, rateCategory as RateCategory, gs.scenarioMode, gs)
    const monthlyRate = Math.pow(1 + effectiveRate / 100, 1 / 12) - 1

    let yearTotal = 0
    for (let month = 1; month <= 12; month++) {
      if (!isInPeriod(year, month, income.start_year, income.start_month, endY, endM)) continue
      const monthsFromStart = (year - income.start_year) * 12 + (month - income.start_month)
      const baseAmount = income.frequency === 'yearly' ? income.amount / 12 : income.amount
      yearTotal += baseAmount * Math.pow(1 + monthlyRate, Math.max(0, monthsFromStart))
    }

    if (yearTotal > 0) {
      const label = ownerLabels[income.owner] || ''
      const typeLabel = incomeTypeLabels[income.type] || income.type
      const displayTitle = label ? `${typeLabel} | ${label}` : typeLabel
      result.push({ title: displayTitle, amount: yearTotal, type: income.type })
    }
  }

  return result
}

function buildExpenseBreakdown(
  expenses: Expense[],
  year: number,
  profile: SimulationProfile,
  gs: GlobalSettings
): { title: string; amount: number; type?: string }[] {
  const result: { title: string; amount: number; type?: string }[] = []

  for (const expense of expenses) {
    if (!expense.is_active) continue
    // 부채 연동 지출은 직접 계산되므로 건너뜀
    if (expense.source_type === 'debt') continue

    let endY = expense.end_year
    let endM = expense.end_month
    if (expense.retirement_link === 'self') {
      endY = profile.birthYear + profile.retirementAge
      endM = 12
    } else if (expense.retirement_link === 'spouse') {
      endY = getRetirementYear('spouse', profile)
      endM = 12
    }

    const rateCategory = expense.rate_category || getDefaultRateCategory(expense.type)
    const baseRate = expense.growth_rate ?? gs.inflationRate
    const effectiveRate = getEffectiveRate(baseRate, rateCategory as RateCategory, gs.scenarioMode, gs)
    const monthlyRate = Math.pow(1 + effectiveRate / 100, 1 / 12) - 1

    let yearTotal = 0
    for (let month = 1; month <= 12; month++) {
      if (!isInPeriod(year, month, expense.start_year, expense.start_month, endY, endM)) continue
      const monthsFromStart = (year - expense.start_year) * 12 + (month - expense.start_month)
      const baseAmount = expense.frequency === 'yearly' ? expense.amount / 12 : expense.amount
      yearTotal += baseAmount * Math.pow(1 + monthlyRate, Math.max(0, monthsFromStart))
    }

    if (yearTotal > 0) {
      result.push({ title: expense.title, amount: yearTotal, type: expense.type })
    }
  }

  return result
}
