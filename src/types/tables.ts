// ============================================
// 새로운 데이터 구조 타입 정의
// 상세 스펙: docs/data_structure.md 참조
// ============================================

// ============================================
// 프로필 (profiles)
// ============================================

export type Gender = 'male' | 'female'

export interface Profile {
  id: string
  name: string | null
  birth_date: string | null  // DATE (YYYY-MM-DD)
  gender: Gender | null
  target_retirement_age: number
  target_retirement_fund: number
  settings: {
    inflationRate: number
    lifeExpectancy: number
    investmentReturn: number
  }
  created_at: string
  updated_at: string
}

// ============================================
// 가족 구성원 (family_members)
// ============================================

export type FamilyRelationship = 'spouse' | 'child' | 'parent'

export interface FamilyMember {
  id: string
  user_id: string
  relationship: FamilyRelationship
  name: string | null
  birth_date: string | null  // DATE (YYYY-MM-DD)
  gender: Gender | null
  is_dependent: boolean
  is_working: boolean
  retirement_age: number | null
  monthly_income: number | null  // 원 (서비스에서 만원으로 변환)
  notes: string | null
  created_at: string
  updated_at: string
}

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
  amount: number  // 원 (서비스에서 만원으로 변환)
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
  amount: number  // 원 (서비스에서 만원으로 변환)
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
// 공적연금 (national_pensions)
// ============================================

export type PublicPensionType = 'national' | 'government' | 'military' | 'private_school'

export interface NationalPension {
  id: string
  simulation_id: string
  owner: Owner
  pension_type: PublicPensionType  // 공적연금 유형
  expected_monthly_amount: number  // 원 (서비스에서 만원으로 변환)
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
  pension_type?: PublicPensionType
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
  title: string | null
  broker_name: string | null
  current_balance: number  // 원 (서비스에서 만원으로 변환)
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
  title?: string | null
  broker_name?: string | null
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
export type HousingType = '자가' | '전세' | '월세' | '무상'
export type LoanRepaymentType = '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환'

export interface RealEstate {
  id: string
  simulation_id: string
  type: RealEstateType
  title: string
  owner: OwnerWithCommon
  current_value: number  // 원 (서비스에서 만원으로 변환)
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
  grace_end_year: number | null
  grace_end_month: number | null

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
  grace_end_year?: number | null
  grace_end_month?: number | null
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
  current_value: number  // 원 (서비스에서 만원으로 변환)
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

export type SavingsType = 'checking' | 'savings' | 'deposit' | 'housing' | 'domestic_stock' | 'foreign_stock' | 'fund' | 'bond' | 'crypto' | 'other'

export type CurrencyType = 'KRW' | 'USD' | 'EUR' | 'JPY'

export interface Savings {
  id: string
  simulation_id: string
  type: SavingsType
  title: string
  broker_name: string | null
  owner: Owner
  current_balance: number  // 원 (서비스에서 만원으로 변환)
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
  is_tax_free: boolean  // 비과세 여부
  currency: CurrencyType  // 통화
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
  broker_name?: string | null
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
  is_tax_free?: boolean
  currency?: CurrencyType
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
  principal: number  // 원 (서비스에서 만원으로 변환)
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
  monthly_premium: number  // 원 (서비스에서 만원으로 변환)
  premium_start_year: number | null
  premium_start_month: number | null
  premium_end_year: number | null
  premium_end_month: number | null
  is_premium_fixed_to_retirement: boolean

  // 보장
  coverage_amount: number | null  // 원 (서비스에서 만원으로 변환)
  coverage_end_year: number | null
  coverage_end_month: number | null

  // 저축성/연금보험
  current_value: number | null  // 해지환급금 (원, 서비스에서 만원으로 변환)
  maturity_year: number | null
  maturity_month: number | null
  maturity_amount: number | null  // 만기금액 (원, 서비스에서 만원으로 변환)
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

// ============================================
// 자산 기록 (Financial Snapshots / Progress)
// ============================================

export type SnapshotType = 'initial' | 'followup' | 'quarterly' | 'annual'
export type SnapshotCategory = 'asset' | 'debt' | 'income' | 'expense' | 'pension'
export type SnapshotOwner = 'self' | 'spouse' | 'joint'

export interface FinancialSnapshot {
  id: string
  profile_id: string
  recorded_at: string  // DATE
  recorded_by: string | null  // expert_id
  snapshot_type: SnapshotType

  // 요약 데이터 (DB: 원 단위, 클라이언트: 훅에서 만원으로 변환)
  total_assets: number      // 원 (저축 + 투자 + 실물자산)
  total_debts: number       // 원 (담보대출 + 무담보부채)
  net_worth: number         // 원 (총자산 - 총부채)

  // 자산 분류별 (DB: 원 단위, 클라이언트: 훅에서 만원으로 변환)
  savings: number           // 원 (예금, 적금, 비상금)
  investments: number       // 원 (주식, 펀드, 채권, 암호화폐)
  real_estate: number       // 원 (부동산)
  real_assets: number       // 원 (자동차, 귀금속 등 실물자산)
  unsecured_debt: number    // 원 (신용대출, 카드대출 등 무담보)

  memo: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FinancialSnapshotInput {
  profile_id: string
  recorded_at?: string
  recorded_by?: string | null
  snapshot_type?: SnapshotType
  total_assets?: number
  total_debts?: number
  net_worth?: number
  savings?: number
  investments?: number
  real_estate?: number
  real_assets?: number
  unsecured_debt?: number
  memo?: string | null
}

export interface FinancialSnapshotItem {
  id: string
  snapshot_id: string
  category: SnapshotCategory
  item_type: string
  title: string
  amount: number  // 원 (DB), 훅에서 만원으로 변환하여 클라이언트에 제공
  owner: SnapshotOwner
  metadata: Record<string, unknown>  // 금액 필드도 원 단위
  sort_order: number
  created_at: string
}

export interface FinancialSnapshotItemInput {
  snapshot_id: string
  category: SnapshotCategory
  item_type: string
  title: string
  amount: number
  owner?: SnapshotOwner
  metadata?: Record<string, unknown>
  sort_order?: number
}

// ============================================
// 포트폴리오 거래 내역 (portfolio_transactions)
// ============================================

export type PortfolioTransactionType = 'buy' | 'sell'
export type PortfolioAssetType = 'domestic_stock' | 'foreign_stock' | 'domestic_etf' | 'foreign_etf' | 'etf' | 'crypto' | 'fund' | 'bond' | 'other'
export type PortfolioCurrency = 'KRW' | 'USD' | 'EUR' | 'JPY'

export interface PortfolioTransaction {
  id: string
  profile_id: string
  account_id: string | null  // 증권 계좌 ID
  type: PortfolioTransactionType
  asset_type: PortfolioAssetType
  ticker: string          // 종목코드 (005930.KS, AAPL, BTC-USD 등)
  name: string            // 종목명
  quantity: number        // 수량
  price: number           // 매수/매도 단가 (원)
  total_amount: number    // 총금액 (원)
  currency: PortfolioCurrency
  exchange_rate: number   // 환율 (해외주식용)
  fee: number             // 수수료 (원)
  trade_date: string      // 거래일 (YYYY-MM-DD)
  memo: string | null
  created_at: string
  updated_at: string
}

export interface PortfolioTransactionInput {
  profile_id: string
  account_id?: string | null  // 증권 계좌 ID
  type: PortfolioTransactionType
  asset_type: PortfolioAssetType
  ticker: string
  name: string
  quantity: number
  price: number
  total_amount: number
  currency?: PortfolioCurrency
  exchange_rate?: number
  fee?: number
  trade_date: string
  memo?: string | null
}

// 보유 종목 (거래 내역에서 계산)
export interface PortfolioHolding {
  ticker: string
  name: string
  asset_type: PortfolioAssetType
  quantity: number          // 보유 수량
  avg_price: number         // 평균 매수가
  total_invested: number    // 총 투자금액 (원, 서비스에서 만원으로 변환)
  current_price?: number    // 현재가 (API에서)
  current_value?: number    // 평가금액 (원, 서비스에서 만원으로 변환)
  profit_loss?: number      // 손익 (원, 서비스에서 만원으로 변환)
  profit_rate?: number      // 수익률 (%)
  currency: PortfolioCurrency
}

// ============================================
// 계좌 (accounts 테이블)
// 증권 계좌 + 은행 계좌 통합 관리
// ============================================

// 계좌 유형
// - 증권: general(일반), isa(ISA), pension_savings(연금저축), irp(IRP), dc(DC형 퇴직연금)
// - 은행: checking(입출금), savings(정기적금), deposit(정기예금), free_savings(자유적금), housing(청약)
export type AccountType = 'general' | 'isa' | 'pension_savings' | 'irp' | 'dc' | 'checking' | 'savings' | 'deposit' | 'free_savings' | 'housing'

export interface Account {
  id: string
  profile_id: string
  name: string              // 계좌 별명 (예: "미국주식 계좌", "월급통장")
  broker_name: string       // 증권사/은행명 (예: "키움증권", "국민은행")
  account_number: string | null  // 계좌번호 (마스킹)
  account_type: AccountType
  current_balance: number | null  // 현재 잔액 (원, 서비스에서 만원으로 변환) - 입출금/예금 계좌용
  balance_updated_at: string | null  // 잔액 기록 시점 (checkpoint)
  is_default: boolean       // 기본 계좌 여부
  is_active: boolean
  memo: string | null
  // 정기 예금/적금 필드
  interest_rate: number | null  // 이율 (%)
  start_year: number | null     // 가입 연도
  start_month: number | null    // 가입 월
  start_day: number | null      // 가입 일
  maturity_year: number | null  // 만기 연도
  maturity_month: number | null // 만기 월
  maturity_day: number | null   // 만기 일
  is_tax_free: boolean          // 비과세 여부
  currency: CurrencyType        // 통화
  monthly_contribution: number | null  // 월 납입액 (적금용, 원, 서비스에서 만원으로 변환)
  created_at: string
  updated_at: string
}

export interface AccountInput {
  profile_id: string
  name: string
  broker_name: string
  account_number?: string | null
  account_type?: AccountType
  current_balance?: number
  is_default?: boolean
  memo?: string | null
  // 정기 예금/적금 필드
  interest_rate?: number | null
  start_year?: number | null
  start_month?: number | null
  start_day?: number | null
  maturity_year?: number | null
  maturity_month?: number | null
  maturity_day?: number | null
  is_tax_free?: boolean
  currency?: CurrencyType
  monthly_contribution?: number | null
}

// 기존 코드 호환성을 위한 alias
export type PortfolioAccountType = AccountType
export type PortfolioAccount = Account
export type PortfolioAccountInput = AccountInput

// ============================================
// 결제수단 (payment_methods)
// 카드/페이 등 계좌에 연동된 결제수단
// ============================================

export type PaymentMethodType = 'debit_card' | 'credit_card' | 'pay'

export interface PaymentMethod {
  id: string
  profile_id: string
  account_id: string           // 연결된 계좌
  name: string                 // 결제수단 이름 (예: "카카오 체크카드")
  type: PaymentMethodType      // 체크카드, 신용카드, 페이
  card_company: string | null  // 카드사 (신한, 삼성 등)
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PaymentMethodInput {
  profile_id: string
  account_id: string
  name: string
  type: PaymentMethodType
  card_company?: string | null
}

