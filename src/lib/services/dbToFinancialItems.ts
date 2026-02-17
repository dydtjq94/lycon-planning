/**
 * DB 테이블 데이터를 FinancialItem[]으로 변환하는 어댑터
 * - 기존 시뮬레이션 엔진(runSimulationFromItems)과 호환
 * - Phase 12에서 레거시 제거 시 이 파일도 삭제 예정
 *
 * 주의: 연금/부동산 서비스에서 연동 소득/지출을 이미 incomes/expenses 테이블에 생성하므로
 * 이 어댑터에서는 별도로 연동 항목을 생성하지 않음. incomes/expenses 테이블에서 읽어오면
 * source_type이 있는 연동 항목들도 함께 포함됨.
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
  FinancialItem,
  FinancialItemType,
  OwnerType,
  IncomeData,
  ExpenseData,
  SavingsData,
  PensionData,
  DebtData,
  RealEstateData,
  AssetData,
  RateCategory,
  AssetLoanRepaymentType,
} from '@/types'

import type { SimulationProfile } from './simulationTypes'

import { getIncomes } from './incomeService'
import { getExpenses } from './expenseService'
import { getSavings } from './savingsService'
import { getDebts } from './debtService'
import { getNationalPensions } from './nationalPensionService'
import { getRetirementPensions } from './retirementPensionService'
import { getPersonalPensions } from './personalPensionService'
import { getRealEstates } from './realEstateService'
import { getPhysicalAssets } from './physicalAssetService'

// ============================================
// 메인 함수
// ============================================

export type { SimulationProfile } from './simulationTypes'

/**
 * DB에서 모든 재무 데이터를 로드하여 FinancialItem[]으로 변환
 */
export async function loadFinancialItemsFromDB(
  simulationId: string,
  profile: SimulationProfile
): Promise<FinancialItem[]> {
  // 모든 테이블에서 병렬로 데이터 로드
  const [
    incomes,
    expenses,
    savings,
    debts,
    nationalPensions,
    retirementPensions,
    personalPensions,
    realEstates,
    physicalAssets,
  ] = await Promise.all([
    getIncomes(simulationId),
    getExpenses(simulationId),
    getSavings(simulationId),
    getDebts(simulationId),
    getNationalPensions(simulationId),
    getRetirementPensions(simulationId),
    getPersonalPensions(simulationId),
    getRealEstates(simulationId),
    getPhysicalAssets(simulationId),
  ])

  const items: FinancialItem[] = []
  const now = new Date()
  const timestamp = now.toISOString()

  // 은퇴년도 계산 (동적)
  const selfRetirementYear = profile.birthYear + profile.retirementAge
  const spouseRetirementYear = profile.spouseBirthYear && profile.spouseRetirementAge
    ? profile.spouseBirthYear + profile.spouseRetirementAge
    : selfRetirementYear

  // 소득 변환 (연동 소득도 포함됨 - 연금소득, 임대소득 등)
  incomes.forEach(income => {
    items.push(convertIncome(income, simulationId, timestamp, selfRetirementYear, spouseRetirementYear))
  })

  // 지출 변환 (연동 지출도 포함됨 - 이자지출, 월세지출 등)
  expenses.forEach(expense => {
    items.push(convertExpense(expense, simulationId, timestamp, selfRetirementYear, spouseRetirementYear))
  })

  // 저축 변환
  savings.forEach(saving => {
    items.push(convertSavings(saving, simulationId, timestamp))
  })

  // 부채 변환
  debts.forEach(debt => {
    items.push(convertDebt(debt, simulationId, timestamp))
  })

  // 국민연금 변환 (연금 자산만, 소득은 incomes에서 이미 읽어옴)
  nationalPensions.forEach(pension => {
    items.push(convertNationalPension(pension, simulationId, profile, timestamp))
  })

  // 퇴직연금 변환 (연금 자산만, 소득은 incomes에서 이미 읽어옴)
  retirementPensions.forEach(pension => {
    items.push(convertRetirementPension(pension, simulationId, profile, timestamp))
  })

  // 개인연금 변환 (연금 자산만, 소득은 incomes에서 이미 읽어옴)
  personalPensions.forEach(pension => {
    if (pension.pension_type === 'isa') {
      // ISA는 저축으로 변환
      items.push(convertISAToSavings(pension, simulationId, timestamp))
    } else {
      // 연금저축, IRP
      items.push(convertPersonalPension(pension, simulationId, profile, timestamp))
    }
  })

  // 부동산 변환 (부동산 자산만, 임대소득/월세지출은 incomes/expenses에서 이미 읽어옴)
  realEstates.forEach(re => {
    items.push(convertRealEstate(re, simulationId, timestamp))
  })

  // 실물자산 변환
  physicalAssets.forEach(asset => {
    items.push(convertPhysicalAsset(asset, simulationId, timestamp))
  })

  return items
}

// ============================================
// 소득 변환
// ============================================

function convertIncome(
  income: Income,
  simulationId: string,
  timestamp: string,
  selfRetirementYear: number,
  spouseRetirementYear: number
): FinancialItem {
  const data: IncomeData = {
    amount: income.amount,
    frequency: income.frequency,
    growthRate: income.growth_rate,
    rateCategory: mapRateCategory(income.rate_category),
  }

  // 동적 종료년도 계산: retirement_link에 따라 해당 은퇴년도 사용
  let dynamicEndYear: number | undefined = income.end_year || undefined
  let dynamicEndMonth: number | undefined = income.end_month || undefined

  if (income.retirement_link === 'self') {
    dynamicEndYear = selfRetirementYear
    dynamicEndMonth = 12
  } else if (income.retirement_link === 'spouse') {
    dynamicEndYear = spouseRetirementYear
    dynamicEndMonth = 12
  }

  return {
    id: income.id,
    simulation_id: simulationId,
    category: 'income',
    type: income.type as FinancialItemType,
    title: income.title,
    owner: income.owner as OwnerType,
    memo: income.memo || undefined,
    start_year: income.start_year,
    start_month: income.start_month,
    end_year: dynamicEndYear,
    end_month: dynamicEndMonth,
    is_fixed_to_retirement_year: income.is_fixed_to_retirement,
    data,
    sort_order: income.sort_order,
    is_active: income.is_active,
    created_at: income.created_at,
    updated_at: income.updated_at,
  }
}

// ============================================
// 지출 변환
// ============================================

function convertExpense(
  expense: Expense,
  simulationId: string,
  timestamp: string,
  selfRetirementYear: number,
  spouseRetirementYear: number
): FinancialItem {
  const data: ExpenseData = {
    amount: expense.amount,
    frequency: expense.frequency,
    growthRate: expense.growth_rate,
    rateCategory: mapRateCategory(expense.rate_category),
  }

  // 동적 종료년도 계산: retirement_link에 따라 해당 은퇴년도 사용
  let dynamicEndYear: number | undefined = expense.end_year || undefined
  let dynamicEndMonth: number | undefined = expense.end_month || undefined

  if (expense.retirement_link === 'self') {
    dynamicEndYear = selfRetirementYear
    dynamicEndMonth = 12
  } else if (expense.retirement_link === 'spouse') {
    dynamicEndYear = spouseRetirementYear
    dynamicEndMonth = 12
  }

  return {
    id: expense.id,
    simulation_id: simulationId,
    category: 'expense',
    type: mapExpenseType(expense.type) as FinancialItemType,
    title: expense.title,
    owner: 'common' as OwnerType,
    memo: expense.memo || undefined,
    start_year: expense.start_year,
    start_month: expense.start_month,
    end_year: dynamicEndYear,
    end_month: dynamicEndMonth,
    is_fixed_to_retirement_year: expense.is_fixed_to_retirement,
    data,
    sort_order: expense.sort_order,
    is_active: expense.is_active,
    created_at: expense.created_at,
    updated_at: expense.updated_at,
  }
}

// ============================================
// 저축 변환
// ============================================

function convertSavings(saving: Savings, simulationId: string, timestamp: string): FinancialItem {
  const data: SavingsData = {
    currentBalance: saving.current_balance,
    monthlyContribution: saving.monthly_contribution || undefined,
    interestRate: saving.interest_rate || saving.expected_return || undefined,
  }

  return {
    id: saving.id,
    simulation_id: simulationId,
    category: 'savings',
    type: mapSavingsType(saving.type) as FinancialItemType,
    title: saving.title,
    owner: saving.owner as OwnerType,
    memo: saving.memo || undefined,
    start_year: saving.contribution_start_year || undefined,
    start_month: saving.contribution_start_month || undefined,
    end_year: saving.contribution_end_year || undefined,
    end_month: saving.contribution_end_month || undefined,
    is_fixed_to_retirement_year: saving.is_contribution_fixed_to_retirement,
    data,
    sort_order: saving.sort_order,
    is_active: saving.is_active,
    created_at: saving.created_at,
    updated_at: saving.updated_at,
  }
}

// ============================================
// 부채 변환
// ============================================

function convertDebt(debt: Debt, simulationId: string, timestamp: string): FinancialItem {
  const data: DebtData = {
    principal: debt.principal,
    currentBalance: debt.current_balance || undefined,
    interestRate: debt.interest_rate,
    rateType: debt.rate_type,
    spread: debt.spread || undefined,
    repaymentType: debt.repayment_type,
  }

  return {
    id: debt.id,
    simulation_id: simulationId,
    category: 'debt',
    type: mapDebtType(debt.type) as FinancialItemType,
    title: debt.title,
    owner: 'common' as OwnerType,
    memo: debt.memo || undefined,
    start_year: debt.start_year,
    start_month: debt.start_month,
    end_year: debt.maturity_year,
    end_month: debt.maturity_month,
    is_fixed_to_retirement_year: false,
    data,
    sort_order: debt.sort_order,
    is_active: debt.is_active,
    created_at: debt.created_at,
    updated_at: debt.updated_at,
  }
}

// ============================================
// 국민연금 변환 (연금 자산만)
// ============================================

function convertNationalPension(
  pension: NationalPension,
  simulationId: string,
  profile: SimulationProfile,
  timestamp: string
): FinancialItem {
  const ownerBirthYear = pension.owner === 'spouse' && profile.spouseBirthYear
    ? profile.spouseBirthYear
    : profile.birthYear

  const data: PensionData = {
    expectedMonthlyAmount: pension.expected_monthly_amount,
    paymentStartAge: pension.start_age,
  }

  return {
    id: pension.id,
    simulation_id: simulationId,
    category: 'pension',
    type: 'national',
    title: pension.owner === 'spouse' ? '배우자 국민연금' : '국민연금',
    owner: pension.owner as OwnerType,
    memo: pension.memo || undefined,
    start_year: ownerBirthYear + pension.start_age,
    start_month: 1,
    end_year: pension.end_age ? ownerBirthYear + pension.end_age : undefined,
    end_month: undefined,
    is_fixed_to_retirement_year: false,
    data,
    sort_order: 0,
    is_active: pension.is_active,
    created_at: pension.created_at,
    updated_at: pension.updated_at,
  }
}

// ============================================
// 퇴직연금 변환 (연금 자산만)
// ============================================

function convertRetirementPension(
  pension: RetirementPension,
  simulationId: string,
  profile: SimulationProfile,
  timestamp: string
): FinancialItem {
  const ownerBirthYear = pension.owner === 'spouse' && profile.spouseBirthYear
    ? profile.spouseBirthYear
    : profile.birthYear

  const data: PensionData = {
    currentBalance: pension.current_balance || undefined,
    pensionType: mapRetirementPensionType(pension.pension_type),
    yearsOfService: pension.years_of_service || undefined,
    receiveType: pension.receive_type,
    receivingYears: pension.receiving_years || undefined,
    returnRate: pension.return_rate,
  }

  const startAge = pension.start_age || profile.retirementAge

  return {
    id: pension.id,
    simulation_id: simulationId,
    category: 'pension',
    type: 'retirement',
    title: pension.owner === 'spouse' ? '배우자 퇴직연금' : '퇴직연금',
    owner: pension.owner as OwnerType,
    memo: pension.memo || undefined,
    start_year: ownerBirthYear + startAge,
    start_month: 1,
    end_year: pension.receiving_years ? ownerBirthYear + startAge + pension.receiving_years : undefined,
    end_month: undefined,
    is_fixed_to_retirement_year: false,
    data,
    sort_order: 1,
    is_active: pension.is_active,
    created_at: pension.created_at,
    updated_at: pension.updated_at,
  }
}

// ============================================
// 개인연금 변환 (연금 자산만)
// ============================================

function convertPersonalPension(
  pension: PersonalPension,
  simulationId: string,
  profile: SimulationProfile,
  timestamp: string
): FinancialItem {
  const ownerBirthYear = pension.owner === 'spouse' && profile.spouseBirthYear
    ? profile.spouseBirthYear
    : profile.birthYear

  const startAge = pension.start_age || profile.retirementAge

  const data: PensionData = {
    currentBalance: pension.current_balance,
    monthlyContribution: pension.monthly_contribution || undefined,
    returnRate: pension.return_rate,
    paymentStartYear: ownerBirthYear + startAge,
    paymentStartMonth: 1,
    paymentYears: pension.receiving_years || 20,
  }

  const pensionTypeLabel = pension.pension_type === 'irp' ? 'IRP' : '연금저축'
  const ownerLabel = pension.owner === 'spouse' ? '배우자 ' : ''

  return {
    id: pension.id,
    simulation_id: simulationId,
    category: 'pension',
    type: pension.pension_type === 'irp' ? 'irp' : 'personal',
    title: `${ownerLabel}${pensionTypeLabel}`,
    owner: pension.owner as OwnerType,
    memo: pension.memo || undefined,
    start_year: ownerBirthYear + startAge,
    start_month: 1,
    end_year: pension.receiving_years ? ownerBirthYear + startAge + pension.receiving_years : undefined,
    end_month: undefined,
    is_fixed_to_retirement_year: pension.is_contribution_fixed_to_retirement,
    data,
    sort_order: 2,
    is_active: pension.is_active,
    created_at: pension.created_at,
    updated_at: pension.updated_at,
  }
}

function convertISAToSavings(
  pension: PersonalPension,
  simulationId: string,
  timestamp: string
): FinancialItem {
  const data: SavingsData = {
    currentBalance: pension.current_balance,
    monthlyContribution: pension.monthly_contribution || undefined,
    interestRate: pension.return_rate,
  }

  const ownerLabel = pension.owner === 'spouse' ? '배우자 ' : ''

  return {
    id: pension.id,
    simulation_id: simulationId,
    category: 'savings',
    type: 'fund',
    title: `${ownerLabel}ISA`,
    owner: pension.owner as OwnerType,
    memo: pension.memo || undefined,
    start_year: undefined,
    start_month: undefined,
    end_year: pension.isa_maturity_year || undefined,
    end_month: pension.isa_maturity_month || undefined,
    is_fixed_to_retirement_year: false,
    data,
    sort_order: 10,
    is_active: pension.is_active,
    created_at: pension.created_at,
    updated_at: pension.updated_at,
  }
}

// ============================================
// 부동산 변환 (부동산 자산만)
// ============================================

function convertRealEstate(re: RealEstate, simulationId: string, timestamp: string): FinancialItem {
  const data: RealEstateData = {
    currentValue: re.current_value,
    purchasePrice: re.purchase_price || undefined,
    appreciationRate: re.growth_rate,
    housingType: re.housing_type || undefined,
    deposit: re.deposit || undefined,
    monthlyRent: re.monthly_rent || undefined,
    hasLoan: re.has_loan,
    loanAmount: re.loan_amount || undefined,
    loanRate: re.loan_rate || undefined,
    loanMaturityYear: re.loan_maturity_year || undefined,
    loanMaturityMonth: re.loan_maturity_month || undefined,
    loanRepaymentType: re.loan_repayment_type || undefined,
  }

  return {
    id: re.id,
    simulation_id: simulationId,
    category: 'real_estate',
    type: mapRealEstateType(re.type) as FinancialItemType,
    title: re.title,
    owner: re.owner as OwnerType,
    memo: re.memo || undefined,
    start_year: re.purchase_year || undefined,
    start_month: re.purchase_month || undefined,
    end_year: re.sell_year || undefined,
    end_month: re.sell_month || undefined,
    is_fixed_to_retirement_year: false,
    data,
    sort_order: re.sort_order,
    is_active: re.is_active,
    created_at: re.created_at,
    updated_at: re.updated_at,
  }
}

// ============================================
// 실물자산 변환
// ============================================

function convertPhysicalAsset(asset: PhysicalAsset, simulationId: string, timestamp: string): FinancialItem {
  const data: AssetData = {
    currentValue: asset.current_value,
    purchasePrice: asset.purchase_price || undefined,
    appreciationRate: asset.annual_rate, // 실물자산은 감가상각될 수 있음 (음수)
    financingType: asset.financing_type || undefined,
    loanAmount: asset.loan_amount || undefined,
    loanRate: asset.loan_rate || undefined,
    loanMaturity: asset.loan_maturity_year
      ? `${asset.loan_maturity_year}-${String(asset.loan_maturity_month || 12).padStart(2, '0')}`
      : undefined,
    loanRepaymentType: mapAssetLoanRepaymentType(asset.loan_repayment_type),
  }

  return {
    id: asset.id,
    simulation_id: simulationId,
    category: 'asset',
    type: mapPhysicalAssetType(asset.type) as FinancialItemType,
    title: asset.title,
    owner: asset.owner as OwnerType,
    memo: asset.memo || undefined,
    start_year: asset.purchase_year || undefined,
    start_month: asset.purchase_month || undefined,
    end_year: asset.sell_year || undefined,
    end_month: asset.sell_month || undefined,
    is_fixed_to_retirement_year: false,
    data,
    sort_order: asset.sort_order,
    is_active: asset.is_active,
    created_at: asset.created_at,
    updated_at: asset.updated_at,
  }
}

// ============================================
// 타입 매핑 유틸리티
// ============================================

function mapRateCategory(category: string): RateCategory {
  const mapping: Record<string, RateCategory> = {
    inflation: 'inflation',
    income: 'income',
    investment: 'investment',
    realEstate: 'realEstate',
    fixed: 'fixed',
  }
  return mapping[category] || 'fixed'
}

function mapExpenseType(type: string): string {
  // tables.ts ExpenseType과 index.ts ExpenseType이 거의 동일
  return type
}

function mapSavingsType(type: string): string {
  // checking, savings, deposit -> emergency_fund, savings_account
  // domestic_stock, foreign_stock, fund, bond, crypto -> stock, fund, crypto
  const mapping: Record<string, string> = {
    checking: 'emergency_fund',
    savings: 'savings_account',
    deposit: 'savings_account',
    domestic_stock: 'stock',
    foreign_stock: 'stock',
    fund: 'fund',
    bond: 'fund',
    crypto: 'crypto',
    other: 'other',
  }
  return mapping[type] || type
}

function mapDebtType(type: string): string {
  // mortgage, jeonse, credit, car, student, card, other
  const mapping: Record<string, string> = {
    mortgage: 'mortgage',
    jeonse: 'mortgage',
    credit: 'credit_loan',
    car: 'car_loan',
    student: 'student_loan',
    card: 'credit_card',
    other: 'other',
  }
  return mapping[type] || type
}

function mapRetirementPensionType(type: string): 'DB' | 'DC' | 'corporate_irp' | 'severance' {
  const mapping: Record<string, 'DB' | 'DC' | 'corporate_irp' | 'severance'> = {
    db: 'DB',
    dc: 'DC',
    corporate_irp: 'corporate_irp',
    severance: 'severance',
  }
  return mapping[type] || 'DC'
}

function mapRealEstateType(type: string): string {
  const mapping: Record<string, string> = {
    residence: 'residence',
    investment: 'investment',
    rental: 'investment',
    land: 'land',
  }
  return mapping[type] || type
}

function mapPhysicalAssetType(type: string): string {
  const mapping: Record<string, string> = {
    car: 'vehicle',
    precious_metal: 'other',
    art: 'other',
    other: 'other',
  }
  return mapping[type] || 'other'
}

function mapAssetLoanRepaymentType(type: string | null | undefined): AssetLoanRepaymentType | undefined {
  if (!type) return undefined
  // 거치식상환은 AssetLoanRepaymentType에 없으므로 원리금균등상환으로 대체
  if (type === '거치식상환') return '원리금균등상환'
  return type as AssetLoanRepaymentType
}
