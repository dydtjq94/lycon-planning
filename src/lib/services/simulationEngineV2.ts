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
  CashFlowPriority,
  RateCategory,
} from '@/types'

import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_INVESTMENT_ASSUMPTIONS } from '@/types'
import type { YearlySnapshot, SimulationResult, SimulationProfile } from './simulationEngine'
import { getEffectiveRate, getDefaultRateCategory } from '../utils'
import { getEffectiveDebtRate } from '../utils/loanCalculator'
import {
  calculateInterestIncomeTax,
  calculateCapitalGainsTax,
  calculateISATax,
} from '../utils/taxCalculator'

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
  priorities?: CashFlowPriority[]
): SimulationResult {
  const currentYear = new Date().getFullYear()
  const { birthYear, retirementAge } = profile
  const retirementYear = birthYear + retirementAge
  const endYear = currentYear + yearsToSimulate

  const gs = globalSettings || DEFAULT_GLOBAL_SETTINGS
  const rates = assumptions?.rates

  // 수익률 설정
  const savingsReturnPct = rates?.savings ?? 3.0
  const investmentReturnPct = rates?.investment ?? gs.investmentReturnRate ?? 7.0
  const pensionReturnPct = rates?.pension ?? 5.0
  const realEstateGrowthPct = rates?.realEstate ?? gs.realEstateGrowthRate ?? 3.0
  const inflationPct = rates?.inflation ?? gs.inflationRate ?? 2.5

  // State 초기화
  const state = initializeState(data, profile, gs)

  const snapshots: YearlySnapshot[] = []

  for (let year = currentYear; year <= endYear; year++) {
    const age = year - birthYear
    const yearsSinceStart = year - currentYear
    const events: string[] = []
    let yearlyTax = 0
    let yearlyIncome = 0
    let yearlyExpense = 0

    const incomeBreakdown: { title: string; amount: number; type?: string }[] = []
    const expenseBreakdown: { title: string; amount: number; type?: string }[] = []

    // 직접 계산 항목의 연간 합계 추적 (breakdown용)
    const debtPaymentTotals = new Map<string, number>()
    const pensionIncomeTotals = new Map<string, number>()

    // ==============================
    // Phase A: 월별 현금흐름
    // ==============================
    for (let month = 1; month <= 12; month++) {

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
        }
      }

      // A5. 부채 월 상환액 처리
      for (const debt of state.debts) {
        if (debt.isPaidOff) continue
        if (!isInPeriod(year, month, debt.startYear, debt.startMonth, debt.maturityYear, debt.maturityMonth)) continue

        const monthsFromStart = (year - debt.startYear) * 12 + (month - debt.startMonth)
        const monthlyRate = debt.interestRate / 100 / 12
        let debtPaymentThisMonth = 0

        // 거치기간 체크
        if (debt.repaymentType === '거치식상환' && monthsFromStart < debt.gracePeriodMonths) {
          // 거치기간: 이자만 납부
          debtPaymentThisMonth = debt.currentBalance * monthlyRate
        } else {
          // 상환
          const interestPayment = debt.currentBalance * monthlyRate
          let principalPayment = 0

          switch (debt.repaymentType) {
            case '만기일시상환':
              // 이자만 매월 납부
              debtPaymentThisMonth = interestPayment
              // 만기 시 원금 상환
              if (year === debt.maturityYear && month === debt.maturityMonth) {
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

          // 양도소득세 계산
          const cgt = calculateCapitalGainsTax(salePrice, re.purchasePrice, holdingYears, isResidence)
          yearlyTax += cgt

          // 순매각대금 → currentCash
          const netProceeds = salePrice - cgt
          state.currentCash += netProceeds
          yearlyIncome += netProceeds

          // 연동 대출이 있으면 정리
          if (re.hasLoan && re.loanBalance > 0) {
            state.currentCash -= re.loanBalance
            yearlyExpense += re.loanBalance
            re.loanBalance = 0
          }

          re.isSold = true
          events.push(`${re.title} 매각 (${Math.round(salePrice)}만원, 세금 ${Math.round(cgt)}만원)`)
        }
      }

      // A8. 실물자산 매각 이벤트
      for (const asset of state.physicalAssets) {
        if (asset.isSold) continue
        if (asset.sellYear === year && asset.sellMonth === month) {
          state.currentCash += asset.currentValue
          yearlyIncome += asset.currentValue
          asset.isSold = true
          events.push(`${asset.title} 매각 (${Math.round(asset.currentValue)}만원)`)
        }
      }

      // A9. ISA 만기 처리
      for (const pension of state.pensions) {
        if (pension.isMatured) continue
        if (pension.pensionSubType !== 'isa') continue
        if (pension.isaMaturityYear === year && pension.isaMaturityMonth === month) {
          const gain = pension.balance - pension.totalPrincipal
          const tax = calculateISATax(gain)
          yearlyTax += tax
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
              events.push(`${pension.title} 만기 → 현금 수령 (${Math.round(netAmount)}만원)`)
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
          pensionIncomeTotals.set(pension.id, (pensionIncomeTotals.get(pension.id) || 0) + monthlyWithdrawal)

          if (pension.balance <= 0) {
            pension.balance = 0
            pension.isMatured = true
          }
        }
      }
    }

    // ==============================
    // Phase B: 연말 자산 처리
    // ==============================

    // B1. 저축 항목별 이자/수익률 적용
    for (const saving of state.savings) {
      if (saving.isMatured || !saving.isActive) continue

      let annualRate: number
      if (isSavingsType(saving.type)) {
        annualRate = saving.interestRate ?? savingsReturnPct
      } else {
        annualRate = saving.expectedReturn ?? investmentReturnPct
      }

      const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1
      // 12개월 복리 적용
      saving.balance = saving.balance * Math.pow(1 + monthlyRate, 12)
    }

    // B2. 저축 만기 처리
    for (const saving of state.savings) {
      if (saving.isMatured || !saving.isActive) continue
      if (!saving.maturityYear) continue

      if (year > saving.maturityYear || (year === saving.maturityYear && 12 >= (saving.maturityMonth || 12))) {
        const gain = saving.balance - saving.totalPrincipal
        const tax = calculateInterestIncomeTax(gain, saving.isTaxFree)
        yearlyTax += tax

        const maturityAmount = saving.balance - tax
        state.currentCash += maturityAmount
        events.push(`${saving.title} 만기 (${Math.round(maturityAmount)}만원, 세금 ${Math.round(tax)}만원)`)

        saving.balance = 0
        saving.isMatured = true
      }
    }

    // B3. 부동산 가치 성장
    for (const re of state.realEstates) {
      if (re.isSold) continue
      const effectiveRate = getEffectiveRate(re.growthRate, 'realEstate' as RateCategory, gs.scenarioMode, gs)
      re.currentValue = re.currentValue * (1 + effectiveRate / 100)
    }

    // B4. 실물자산 성장/감가
    for (const asset of state.physicalAssets) {
      if (asset.isSold) continue
      asset.currentValue = asset.currentValue * (1 + asset.annualRate / 100)
      if (asset.currentValue < 0) asset.currentValue = 0
    }

    // B5. 연금 적립 성장
    for (const pension of state.pensions) {
      if (pension.category === 'national' || pension.isMatured) continue
      if (pension.pensionSubType === 'isa') continue
      if (pension.isReceiving) continue // 수령 중인 연금은 A11에서 처리됨

      const returnRate = pension.returnRate || pensionReturnPct
      const monthlyRate = Math.pow(1 + returnRate / 100, 1 / 12) - 1
      pension.balance = pension.balance * Math.pow(1 + monthlyRate, 12)
    }

    // B6. 잉여금 투자 배분 (Cash Flow Priorities)
    if (state.currentCash > 0 && priorities && priorities.length > 0) {
      const sortedPriorities = [...priorities].sort((a, b) => a.priority - b.priority)

      for (const rule of sortedPriorities) {
        if (state.currentCash <= 0) break

        let allocation = 0

        switch (rule.strategy) {
          case 'maintain': {
            let currentBalance = 0
            if (rule.targetType === 'pension') {
              currentBalance = state.pensions
                .filter(p => !p.isMatured && p.category !== 'national')
                .reduce((sum, p) => sum + p.balance, 0)
            } else if (rule.targetType === 'savings' || rule.targetType === 'investment') {
              currentBalance = state.savings
                .filter(s => !s.isMatured && s.isActive)
                .reduce((sum, s) => sum + s.balance, 0)
            }
            const needed = Math.max(0, (rule.targetAmount || 0) - currentBalance)
            allocation = Math.min(state.currentCash, needed)
            break
          }
          case 'maximize':
            allocation = Math.min(state.currentCash, rule.maxAmount || state.currentCash)
            break
          case 'remainder':
            allocation = state.currentCash
            break
        }

        if (allocation > 0) {
          if (rule.targetType === 'pension') {
            // 연금 중 가장 잔액이 큰 항목에 추가
            const target = state.pensions
              .filter(p => !p.isMatured && p.category !== 'national')
              .sort((a, b) => b.balance - a.balance)[0]
            if (target) {
              target.balance += allocation
              target.totalPrincipal += allocation
            }
          } else if (rule.targetType === 'debt') {
            // 금리가 높은 부채부터 추가 상환
            const target = state.debts
              .filter(d => !d.isPaidOff)
              .sort((a, b) => b.interestRate - a.interestRate)[0]
            if (target) {
              const repay = Math.min(allocation, target.currentBalance)
              target.currentBalance -= repay
              if (target.currentBalance <= 0) {
                target.isPaidOff = true
                events.push(`${target.title} 조기상환`)
              }
              allocation = repay // 실제 사용량
            }
          } else {
            // 저축/투자: 잔액이 가장 큰 활성 항목에 추가
            const target = state.savings
              .filter(s => !s.isMatured && s.isActive)
              .sort((a, b) => b.balance - a.balance)[0]
            if (target) {
              target.balance += allocation
              target.totalPrincipal += allocation
            }
          }
          state.currentCash -= allocation
        }
      }
    }

    // B7. 적자 시 자산 인출 (Asset Withdrawal)
    if (state.currentCash < 0) {
      const withdrawalOrder = ['checking', 'savings', 'deposit', 'housing', 'domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other']

      for (const type of withdrawalOrder) {
        if (state.currentCash >= 0) break

        const items = state.savings
          .filter(s => s.type === type && !s.isMatured && s.isActive && s.balance > 0)
          .sort((a, b) => b.balance - a.balance)

        for (const item of items) {
          if (state.currentCash >= 0) break
          const withdrawal = Math.min(item.balance, -state.currentCash)

          // 세금 처리 (중도 인출 시)
          const gain = withdrawal * (item.balance - item.totalPrincipal) / item.balance
          const tax = calculateInterestIncomeTax(Math.max(0, gain), item.isTaxFree)
          yearlyTax += tax

          item.balance -= withdrawal
          item.totalPrincipal = Math.max(0, item.totalPrincipal - (withdrawal - Math.max(0, gain)))
          state.currentCash += withdrawal - tax
        }
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
        expenseBrkDown.push({ title: debt.title, amount: Math.round(amount), type: 'debt' })
      }
    }

    // 직접 계산된 연금 수령액을 소득 breakdown에 추가
    for (const pension of state.pensions) {
      const amount = pensionIncomeTotals.get(pension.id)
      if (amount && amount > 0) {
        incomeBrkDown.push({ title: pension.title, amount: Math.round(amount), type: 'pension' })
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

    // 부동산 대출 잔액도 부채에 포함
    const realEstateLoanDebts = state.realEstates
      .filter(re => !re.isSold && re.hasLoan && re.loanBalance > 0)
      .reduce((sum, re) => sum + re.loanBalance, 0)

    const totalDebtsAll = Math.round(totalDebts + realEstateLoanDebts)

    const netWorth = totalAssets - totalDebtsAll

    // 자산 breakdown
    const assetBreakdown: { title: string; amount: number }[] = []

    // 부동산
    for (const re of state.realEstates) {
      if (re.isSold) continue
      const label = ownerLabels[re.owner] || ''
      const displayTitle = label ? `${re.title} | ${label}` : re.title

      if (re.housingType === '전세' || re.housingType === '월세') {
        if (re.deposit && re.deposit > 0) {
          assetBreakdown.push({ title: `${displayTitle} 보증금`, amount: Math.round(re.deposit) })
        }
      } else {
        if (re.currentValue > 0) {
          assetBreakdown.push({ title: displayTitle, amount: Math.round(re.currentValue) })
        }
      }
    }

    // 금융자산 (개별 항목)
    for (const saving of state.savings) {
      if (saving.isMatured || !saving.isActive || saving.balance <= 0) continue
      const label = ownerLabels[saving.owner] || ''
      const displayTitle = label ? `${saving.title} | ${label}` : saving.title
      assetBreakdown.push({ title: displayTitle, amount: Math.round(saving.balance) })
    }

    // 현금잔고
    if (state.currentCash > 0) {
      assetBreakdown.push({ title: '현금잔고', amount: Math.round(state.currentCash) })
    }

    // 실물자산
    for (const asset of state.physicalAssets) {
      if (asset.isSold || asset.currentValue <= 0) continue
      const label = ownerLabels[asset.owner] || ''
      const displayTitle = label ? `${asset.title} | ${label}` : asset.title
      assetBreakdown.push({ title: displayTitle, amount: Math.round(asset.currentValue) })
    }

    // 부채 breakdown
    const debtBreakdown: { title: string; amount: number }[] = []
    for (const debt of state.debts) {
      if (debt.isPaidOff) continue
      debtBreakdown.push({ title: debt.title, amount: Math.round(debt.currentBalance) })
    }
    for (const re of state.realEstates) {
      if (re.isSold || !re.hasLoan || re.loanBalance <= 0) continue
      debtBreakdown.push({ title: `${re.title} 대출`, amount: Math.round(re.loanBalance) })
    }

    // 연금 breakdown
    const pensionBreakdown: { title: string; amount: number }[] = []
    for (const pension of state.pensions) {
      if (pension.isMatured || pension.balance <= 0) continue
      const label = ownerLabels[pension.owner] || ''
      const displayTitle = label ? `${pension.title} | ${label}` : pension.title
      pensionBreakdown.push({ title: displayTitle, amount: Math.round(pension.balance) })
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

    snapshots.push({
      year,
      age,
      totalIncome: Math.round(yearlyIncome),
      totalExpense: Math.round(yearlyExpense),
      netCashFlow: Math.round(yearlyIncome - yearlyExpense),
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
      result.push({ title: displayTitle, amount: Math.round(yearTotal), type: income.type })
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
      result.push({ title: expense.title, amount: Math.round(yearTotal), type: expense.type })
    }
  }

  return result
}
