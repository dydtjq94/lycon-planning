// ============================================
// 새로운 데이터 구조 타입 정의
// 상세 스펙: docs/data_structure.md 참조
// ============================================

// ============================================
// 공통 타입
// ============================================

export type Owner = 'self' | 'spouse'
export type OwnerWithCommon = 'self' | 'spouse' | 'common'
export type Frequency = 'monthly' | 'yearly'
export type RateCategory = 'inflation' | 'income' | 'investment' | 'realEstate' | 'fixed'
export type RateType = 'fixed' | 'floating'

// 연동 출처 타입
export type IncomeSourceType = 'national_pension' | 'retirement_pension' | 'personal_pension' | 'real_estate' | null
export type ExpenseSourceType = 'debt' | 'real_estate' | 'insurance' | null
export type DebtSourceType = 'real_estate' | 'physical_asset' | null

// 은퇴 연동 타입 (어떤 은퇴년도에 연동할지)
export type RetirementLink = 'self' | 'spouse' | null

// ============================================
// 소득 (incomes)
// ============================================

export type IncomeType = 'labor' | 'business' | 'rental' | 'pension' | 'dividend' | 'side' | 'other'

export interface Income {
  id: string
  simulation_id: string
  type: IncomeType
  title: string
  owner: Owner
  amount: number  // 만원
  frequency: Frequency
  start_year: number
  start_month: number
  end_year: number | null
  end_month: number | null
  is_fixed_to_retirement: boolean
  retirement_link: RetirementLink  // 어떤 은퇴년도에 연동: 'self' | 'spouse' | null
  growth_rate: number
  rate_category: RateCategory
  source_type: IncomeSourceType
  source_id: string | null
  memo: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface IncomeInput {
  simulation_id: string
  type: IncomeType
  title: string
  owner?: Owner
  amount: number
  frequency?: Frequency
  start_year: number
  start_month: number
  end_year?: number | null
  end_month?: number | null
  is_fixed_to_retirement?: boolean
  retirement_link?: RetirementLink  // 어떤 은퇴년도에 연동: 'self' | 'spouse' | null
  growth_rate?: number
  rate_category?: RateCategory
  source_type?: IncomeSourceType
  source_id?: string | null
  memo?: string | null
  sort_order?: number
}

// ============================================
// 지출 (expenses)
// ============================================

export type ExpenseType = 'living' | 'housing' | 'education' | 'insurance' | 'medical' | 'transport' | 'interest' | 'principal' | 'child' | 'parents' | 'travel' | 'wedding' | 'other'

export interface Expense {
  id: string
  simulation_id: string
  type: ExpenseType
  title: string
  amount: number  // 만원
  frequency: Frequency
  start_year: number
  start_month: number
  end_year: number | null
  end_month: number | null
  is_fixed_to_retirement: boolean
  retirement_link: RetirementLink  // 어떤 은퇴년도에 연동: 'self' | 'spouse' | null
  growth_rate: number
  rate_category: RateCategory
  source_type: ExpenseSourceType
  source_id: string | null
  memo: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ExpenseInput {
  simulation_id: string
  type: ExpenseType
  title: string
  amount: number
  frequency?: Frequency
  start_year: number
  start_month: number
  end_year?: number | null
  end_month?: number | null
  is_fixed_to_retirement?: boolean
  retirement_link?: RetirementLink  // 어떤 은퇴년도에 연동: 'self' | 'spouse' | null
  growth_rate?: number
  rate_category?: RateCategory
  source_type?: ExpenseSourceType
  source_id?: string | null
  memo?: string | null
  sort_order?: number
}

// ============================================
// 국민연금 (national_pensions)
// ============================================

export interface NationalPension {
  id: string
  simulation_id: string
  owner: Owner
  expected_monthly_amount: number  // 만원
  start_age: number
  end_age: number | null
  memo: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NationalPensionInput {
  simulation_id: string
  owner?: Owner
  expected_monthly_amount: number
  start_age: number
  end_age?: number | null
  memo?: string | null
}

// ============================================
// 퇴직연금 (retirement_pensions)
// ============================================

export type RetirementPensionType = 'db' | 'dc' | 'corporate_irp' | 'severance'
export type ReceiveType = 'lump_sum' | 'annuity'

export interface RetirementPension {
  id: string
  simulation_id: string
  owner: Owner
  pension_type: RetirementPensionType
  current_balance: number | null  // DC, IRP
  years_of_service: number | null  // DB, 퇴직금
  receive_type: ReceiveType
  start_age: number | null
  receiving_years: number | null
  return_rate: number
  memo: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RetirementPensionInput {
  simulation_id: string
  owner?: Owner
  pension_type: RetirementPensionType
  current_balance?: number | null
  years_of_service?: number | null
  receive_type: ReceiveType
  start_age?: number | null
  receiving_years?: number | null
  return_rate?: number
  memo?: string | null
}

// ============================================
// 개인연금 (personal_pensions)
// ============================================

export type PersonalPensionType = 'pension_savings' | 'irp' | 'isa'
export type IsaMaturityStrategy = 'pension_savings' | 'irp' | 'cash'

export interface PersonalPension {
  id: string
  simulation_id: string
  owner: Owner
  pension_type: PersonalPensionType
  current_balance: number  // 만원
  monthly_contribution: number | null
  contribution_end_year: number | null
  contribution_end_month: number | null
  is_contribution_fixed_to_retirement: boolean
  start_age: number | null
  receiving_years: number | null
  return_rate: number
  isa_maturity_year: number | null
  isa_maturity_month: number | null
  isa_maturity_strategy: IsaMaturityStrategy | null
  memo: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PersonalPensionInput {
  simulation_id: string
  owner?: Owner
  pension_type: PersonalPensionType
  current_balance: number
  monthly_contribution?: number | null
  contribution_end_year?: number | null
  contribution_end_month?: number | null
  is_contribution_fixed_to_retirement?: boolean
  start_age?: number | null
  receiving_years?: number | null
  return_rate?: number
  isa_maturity_year?: number | null
  isa_maturity_month?: number | null
  isa_maturity_strategy?: IsaMaturityStrategy | null
  memo?: string | null
}

// ============================================
// 부동산 (real_estates)
// ============================================

export type RealEstateType = 'residence' | 'investment' | 'rental' | 'land'
export type HousingType = '자가' | '전세' | '월세'
export type LoanRepaymentType = '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환'

export interface RealEstate {
  id: string
  simulation_id: string
  type: RealEstateType
  title: string
  owner: OwnerWithCommon
  current_value: number  // 만원
  purchase_price: number | null
  purchase_year: number | null
  purchase_month: number | null
  growth_rate: number

  // 거주용
  housing_type: HousingType | null
  deposit: number | null
  monthly_rent: number | null
  maintenance_fee: number | null

  // 임대
  has_rental_income: boolean
  rental_deposit: number | null
  rental_monthly: number | null
  rental_start_year: number | null
  rental_start_month: number | null
  rental_end_year: number | null
  rental_end_month: number | null

  // 대출
  has_loan: boolean
  loan_amount: number | null
  loan_rate: number | null
  loan_rate_type: RateType | null
  loan_spread: number | null
  loan_start_year: number | null
  loan_start_month: number | null
  loan_maturity_year: number | null
  loan_maturity_month: number | null
  loan_repayment_type: LoanRepaymentType | null

  // 매도
  sell_year: number | null
  sell_month: number | null

  memo: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RealEstateInput {
  simulation_id: string
  type: RealEstateType
  title: string
  owner?: OwnerWithCommon
  current_value: number
  purchase_price?: number | null
  purchase_year?: number | null
  purchase_month?: number | null
  growth_rate?: number
  housing_type?: HousingType | null
  deposit?: number | null
  monthly_rent?: number | null
  maintenance_fee?: number | null
  has_rental_income?: boolean
  rental_deposit?: number | null
  rental_monthly?: number | null
  rental_start_year?: number | null
  rental_start_month?: number | null
  rental_end_year?: number | null
  rental_end_month?: number | null
  has_loan?: boolean
  loan_amount?: number | null
  loan_rate?: number | null
  loan_rate_type?: RateType | null
  loan_spread?: number | null
  loan_start_year?: number | null
  loan_start_month?: number | null
  loan_maturity_year?: number | null
  loan_maturity_month?: number | null
  loan_repayment_type?: LoanRepaymentType | null
  sell_year?: number | null
  sell_month?: number | null
  memo?: string | null
  sort_order?: number
}

// ============================================
// 실물자산 (physical_assets)
// ============================================

export type PhysicalAssetType = 'car' | 'precious_metal' | 'art' | 'other'
export type FinancingType = 'loan' | 'installment'

export interface PhysicalAsset {
  id: string
  simulation_id: string
  type: PhysicalAssetType
  title: string
  owner: OwnerWithCommon
  current_value: number  // 만원
  purchase_price: number | null
  purchase_year: number | null
  purchase_month: number | null
  annual_rate: number  // +상승, -감가

  // 대출/할부
  has_loan: boolean
  financing_type: FinancingType | null
  loan_amount: number | null
  loan_rate: number | null
  loan_start_year: number | null
  loan_start_month: number | null
  loan_maturity_year: number | null
  loan_maturity_month: number | null
  loan_repayment_type: LoanRepaymentType | null

  // 처분
  sell_year: number | null
  sell_month: number | null

  memo: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PhysicalAssetInput {
  simulation_id: string
  type: PhysicalAssetType
  title: string
  owner?: OwnerWithCommon
  current_value: number
  purchase_price?: number | null
  purchase_year?: number | null
  purchase_month?: number | null
  annual_rate?: number
  has_loan?: boolean
  financing_type?: FinancingType | null
  loan_amount?: number | null
  loan_rate?: number | null
  loan_start_year?: number | null
  loan_start_month?: number | null
  loan_maturity_year?: number | null
  loan_maturity_month?: number | null
  loan_repayment_type?: LoanRepaymentType | null
  sell_year?: number | null
  sell_month?: number | null
  memo?: string | null
  sort_order?: number
}

// ============================================
// 저축/투자 (savings)
// ============================================

export type SavingsType = 'checking' | 'savings' | 'deposit' | 'domestic_stock' | 'foreign_stock' | 'fund' | 'bond' | 'crypto' | 'other'

export interface Savings {
  id: string
  simulation_id: string
  type: SavingsType
  title: string
  owner: Owner
  current_balance: number  // 만원
  monthly_contribution: number | null
  contribution_start_year: number | null
  contribution_start_month: number | null
  contribution_end_year: number | null
  contribution_end_month: number | null
  is_contribution_fixed_to_retirement: boolean
  interest_rate: number | null  // 예금
  expected_return: number | null  // 투자
  maturity_year: number | null
  maturity_month: number | null
  memo: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SavingsInput {
  simulation_id: string
  type: SavingsType
  title: string
  owner?: Owner
  current_balance: number
  monthly_contribution?: number | null
  contribution_start_year?: number | null
  contribution_start_month?: number | null
  contribution_end_year?: number | null
  contribution_end_month?: number | null
  is_contribution_fixed_to_retirement?: boolean
  interest_rate?: number | null
  expected_return?: number | null
  maturity_year?: number | null
  maturity_month?: number | null
  memo?: string | null
  sort_order?: number
}

// ============================================
// 부채 (debts)
// ============================================

export type DebtType = 'mortgage' | 'jeonse' | 'credit' | 'car' | 'student' | 'card' | 'other'

export interface Debt {
  id: string
  simulation_id: string
  type: DebtType
  title: string
  principal: number  // 만원
  current_balance: number | null
  interest_rate: number
  rate_type: RateType
  spread: number | null
  repayment_type: LoanRepaymentType
  grace_period_months: number
  start_year: number
  start_month: number
  maturity_year: number
  maturity_month: number
  source_type: DebtSourceType
  source_id: string | null
  memo: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DebtInput {
  simulation_id: string
  type: DebtType
  title: string
  principal: number
  current_balance?: number | null
  interest_rate: number
  rate_type?: RateType
  spread?: number | null
  repayment_type: LoanRepaymentType
  grace_period_months?: number
  start_year: number
  start_month: number
  maturity_year: number
  maturity_month: number
  source_type?: DebtSourceType
  source_id?: string | null
  memo?: string | null
  sort_order?: number
}

// ============================================
// 보험 (insurances)
// ============================================

export type InsuranceType = 'life' | 'term' | 'health' | 'savings' | 'car' | 'pension' | 'other'

export interface Insurance {
  id: string
  simulation_id: string
  type: InsuranceType
  title: string
  owner: Owner
  insurance_company: string | null

  // 보험료
  monthly_premium: number  // 만원
  premium_start_year: number | null
  premium_start_month: number | null
  premium_end_year: number | null
  premium_end_month: number | null
  is_premium_fixed_to_retirement: boolean

  // 보장
  coverage_amount: number | null  // 만원
  coverage_end_year: number | null
  coverage_end_month: number | null

  // 저축성/연금보험
  current_value: number | null  // 해지환급금 (만원)
  maturity_year: number | null
  maturity_month: number | null
  maturity_amount: number | null  // 만기금액 (만원)
  return_rate: number | null

  // 연금보험
  pension_start_age: number | null
  pension_receiving_years: number | null

  memo: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InsuranceInput {
  simulation_id: string
  type: InsuranceType
  title: string
  owner?: Owner
  insurance_company?: string | null
  monthly_premium: number
  premium_start_year?: number | null
  premium_start_month?: number | null
  premium_end_year?: number | null
  premium_end_month?: number | null
  is_premium_fixed_to_retirement?: boolean
  coverage_amount?: number | null
  coverage_end_year?: number | null
  coverage_end_month?: number | null
  current_value?: number | null
  maturity_year?: number | null
  maturity_month?: number | null
  maturity_amount?: number | null
  return_rate?: number | null
  pension_start_age?: number | null
  pension_receiving_years?: number | null
  memo?: string | null
  sort_order?: number
}
