// 자산 카테고리 타입
export type AssetCategory = 'income' | 'expense' | 'real_estate' | 'asset' | 'debt' | 'pension'

// 빈도 타입
export type Frequency = 'monthly' | 'yearly' | 'once'

// 가족 관계 타입
export type FamilyRelationship = 'spouse' | 'child' | 'parent'

// 성별 타입
export type Gender = 'male' | 'female'

// 사용자 프로필
export interface Profile {
  id: string
  name: string
  birth_date: string  // YYYY-MM-DD 형식
  target_retirement_age: number
  target_retirement_fund: number
  created_at: string
  updated_at: string
}

// 가족 구성원 (DB 테이블)
export interface FamilyMember {
  id: string
  user_id: string
  relationship: FamilyRelationship
  name: string
  birth_date: string | null
  gender: Gender | null
  is_dependent: boolean
  // 배우자 재정 정보
  is_working: boolean
  retirement_age: number | null
  monthly_income: number
  notes: string | null
  created_at: string
  updated_at: string
}

// 가족 구성원 입력 폼
export interface FamilyMemberInput {
  relationship: FamilyRelationship
  name: string
  birth_date?: string
  gender?: Gender
  is_dependent?: boolean
  // 배우자 재정 정보
  is_working?: boolean
  retirement_age?: number
  monthly_income?: number
  notes?: string
}

// 자산 항목
export interface Asset {
  id: string
  user_id: string
  category: AssetCategory
  name: string
  amount: number
  frequency: Frequency
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// 온보딩 데이터
export interface OnboardingData {
  // Step 1: 기본 정보
  name: string
  gender: Gender | null  // 성별
  birth_date: string  // YYYY-MM-DD 형식
  target_retirement_age: number
  target_retirement_fund: number

  // Step 2: 결혼 여부 및 배우자 정보
  isMarried: boolean | null  // null = 아직 선택 안함, false = 없음, true = 있음
  spouse: FamilyMemberInput | null

  // Step 3: 자녀/부모 정보
  hasChildren: boolean | null  // null = 아직 선택 안함, false = 없음, true = 있음
  children: FamilyMemberInput[]
  parents: FamilyMemberInput[]

  // Step 4-8: 자산 정보
  // 소득 (근로소득, 사업소득, 기타소득)
  laborIncome: number | null        // 본인 근로 소득
  laborIncomeFrequency: 'monthly' | 'yearly'
  spouseLaborIncome: number | null  // 배우자 근로 소득
  spouseLaborIncomeFrequency: 'monthly' | 'yearly'
  businessIncome: number | null     // 본인 사업 소득
  businessIncomeFrequency: 'monthly' | 'yearly'
  spouseBusinessIncome: number | null  // 배우자 사업 소득
  spouseBusinessIncomeFrequency: 'monthly' | 'yearly'

  // 지출
  livingExpenses: number | null     // 생활비
  livingExpensesFrequency: 'monthly' | 'yearly'  // 생활비 주기

  // 거주용 부동산
  housingType: '자가' | '전세' | '월세' | '해당없음' | null  // 거주 형태
  housingValue: number | null      // 자가: 시세, 전세/월세: 보증금
  housingRent: number | null       // 월세: 월세
  housingMaintenance: number | null  // 관리비 (자가, 전세, 월세 공통)
  housingHasLoan: boolean          // 대출 여부
  housingLoan: number | null       // 대출금액
  housingLoanRate: number | null   // 대출 금리 (%)
  housingLoanMaturity: string | null  // 대출 만기 (YYYY-MM)
  housingLoanType: '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환' | null  // 상환방식

  // 금융자산 - 현금성 자산
  cashCheckingAccount: number | null      // 입출금통장
  cashCheckingRate: number | null         // 입출금통장 금리
  cashSavingsAccount: number | null       // 정기예금/적금
  cashSavingsRate: number | null          // 정기예금/적금 금리

  // 금융자산 - 투자자산
  investDomesticStock: number | null      // 국내주식 및 ETF
  investDomesticRate: number | null       // 국내주식 수익률
  investForeignStock: number | null       // 해외주식 및 ETF
  investForeignRate: number | null        // 해외주식 수익률
  investFund: number | null               // 펀드 및 채권
  investFundRate: number | null           // 펀드 수익률
  investOther: number | null              // 기타 투자자산 (가상화폐, P2P 등)
  investOtherRate: number | null          // 기타 수익률
  hasNoAsset: boolean | null              // null = 아직 선택 안함, true = 금융자산 없음

  // 부채 목록
  debts: DebtInput[]
  hasNoDebt: boolean | null  // null = 아직 선택 안함, true = 부채 없음

  // 연금
  nationalPension: number | null           // 국민연금 예상 월 수령액
  nationalPensionStartAge: number | null   // 국민연금 수령 시작 나이
  retirementPensionType: 'DB' | 'DC' | 'corporate_irp' | 'severance' | null  // 퇴직연금/퇴직금 유형
  retirementPensionBalance: number | null  // 퇴직연금 현재 잔액
  personalPensionMonthly: number | null    // 개인연금 월 납입액 (deprecated)
  personalPensionBalance: number | null    // 개인연금 현재 잔액 (deprecated)
  irpBalance: number | null                // IRP 현재 잔액
  pensionSavingsBalance: number | null     // 연금저축 현재 잔액
  isaBalance: number | null                // ISA 현재 잔액
  otherPensionMonthly: number | null       // 기타연금 예상 월 수령액
  hasNoPension: boolean | null             // null = 아직 선택 안함, true = 연금 없음

  // 기존 배열 (추후 상세 입력용, 현재 미사용)
  incomes: AssetInput[]
  expenses: AssetInput[]
  realEstates: AssetInput[]
  assets: AssetInput[]
  pensions: AssetInput[]
}

// 자산 입력 폼
export interface AssetInput {
  name: string
  amount: number | null  // null = 미입력, 0 = 0 입력함
  frequency: Frequency
  subcategory?: string  // 분류 (근로소득, 사업소득, 기타소득 등)
  start_date?: string
  end_date?: string
  notes?: string
}

// 부채 입력 폼 (대출 상세 정보 포함)
export interface DebtInput {
  name: string
  amount: number | null  // 대출 금액
  rate: number | null    // 금리 (%)
  maturity: string | null  // 만기 (YYYY-MM)
  repaymentType: '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환' | null
}

// 스코어 타입
export interface Scores {
  overall: number
  income: number
  expense: number
  asset: number
  debt: number
  pension: number
}

// 대시보드 요약 데이터
export interface DashboardSummary {
  totalAssets: number
  totalDebts: number
  netWorth: number
  monthlyIncome: number
  monthlyExpense: number
  monthlySavings: number
  scores: Scores
}

// 글로벌 설정 (시뮬레이션 전역)
export interface GlobalSettings {
  // 물가/인플레이션
  inflationRate: number           // 물가 상승률 (%) - 지출, 국민연금에 적용

  // 소득 관련
  incomeGrowthRate: number        // 소득 증가율 (%) - 근로/사업소득에 적용

  // 투자 관련
  investmentReturnRate: number    // 투자 수익률 (%) - 저축/투자, 퇴직/개인연금에 적용
  savingsGrowthRate: number       // 저축 증가율 (%) - 적립금 증가에 적용

  // 부동산 관련
  realEstateGrowthRate: number    // 부동산 상승률 (%)

  // 부채 관련
  debtInterestRate: number        // 부채 기본 금리 (%)

  // 수명
  lifeExpectancy: number          // 예상 수명 (세)
}

// 기본 글로벌 설정
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  inflationRate: 2.5,
  incomeGrowthRate: 3.3,
  investmentReturnRate: 5,
  savingsGrowthRate: 2.5,
  realEstateGrowthRate: 2.4,
  debtInterestRate: 3.5,
  lifeExpectancy: 90,
}

// 시뮬레이션 설정 (deprecated - GlobalSettings 사용)
export interface SimulationSettings {
  inflationRate: number      // 물가 상승률 (%)
  investmentReturn: number   // 투자 수익률 (%)
  lifeExpectancy: number     // 예상 수명 (세)
}

// 기본 시뮬레이션 설정 (deprecated)
export const DEFAULT_SETTINGS: SimulationSettings = {
  inflationRate: 2.5,
  investmentReturn: 5,
  lifeExpectancy: 90,
}

// 은퇴 시뮬레이션 데이터 포인트
export interface SimulationDataPoint {
  age: number
  year: number
  assets: number
  income: number
  expense: number
}

// 차트 데이터
export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string
    fill?: boolean
  }[]
}

// ============================================
// 새로운 시뮬레이션 기반 데이터 구조
// ============================================

// 시뮬레이션 (시나리오)
export interface Simulation {
  id: string
  profile_id: string
  title: string
  description?: string
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// 재무 항목 카테고리
export type FinancialCategory =
  | 'income'
  | 'expense'
  | 'savings'
  | 'pension'
  | 'asset'
  | 'debt'
  | 'real_estate'

// 소유자 타입
export type OwnerType = 'self' | 'spouse' | 'child' | 'common'

// 재무 항목 타입 (카테고리별)
export type IncomeType = 'salary' | 'business' | 'side_income' | 'rental' | 'dividend' | 'other'
export type ExpenseType = 'living' | 'housing' | 'maintenance' | 'education' | 'child' | 'insurance' | 'transport' | 'health' | 'travel' | 'parents' | 'wedding' | 'leisure' | 'other'
export type SavingsType = 'emergency_fund' | 'savings_account' | 'stock' | 'fund' | 'crypto' | 'other'
export type PensionType = 'national' | 'retirement' | 'personal' | 'irp' | 'severance'
export type AssetType = 'deposit' | 'stock' | 'fund' | 'bond' | 'crypto' | 'vehicle' | 'other'
export type DebtType = 'mortgage' | 'credit_loan' | 'student_loan' | 'car_loan' | 'credit_card' | 'other'
export type RealEstateType = 'residence' | 'investment' | 'land' | 'other'

export type FinancialItemType =
  | IncomeType
  | ExpenseType
  | SavingsType
  | PensionType
  | AssetType
  | DebtType
  | RealEstateType

// ============================================
// 카테고리별 상세 데이터 (JSONB)
// ============================================

// 소득 데이터
export interface IncomeData {
  amount: number                    // 금액 (만원)
  frequency: 'monthly' | 'yearly'   // 지급 주기
  growthRate: number                // 연간 증가율 (%)
}

// 지출 데이터
export interface ExpenseData {
  amount: number                    // 금액 (만원)
  frequency: 'monthly' | 'yearly'   // 지출 주기
  growthRate: number                // 연간 증가율 (%, 보통 물가상승률)
}

// 저축 데이터
export interface SavingsData {
  currentBalance: number            // 현재 잔액 (만원)
  monthlyContribution?: number      // 월 납입액 (만원)
  interestRate?: number             // 이자율/수익률 (%)
  targetAmount?: number             // 목표 금액 (만원)
}

// 연금 데이터 (유형별로 다른 필드 사용)
export interface PensionData {
  // 국민연금
  expectedMonthlyAmount?: number    // 예상 월 수령액 (만원)
  paymentStartAge?: number          // 수령 시작 나이

  // 퇴직연금/퇴직금
  currentBalance?: number           // 현재 잔액 (만원)
  pensionType?: 'DB' | 'DC' | 'corporate_irp' | 'severance'

  // 개인연금 (연금저축, IRP)
  monthlyContribution?: number      // 월 납입액 (만원)
  returnRate?: number               // 예상 수익률 (%)
  paymentStartYear?: number         // 수령 시작 연도
  paymentYears?: number             // 수령 기간 (년)
}

// 자산 데이터
export interface AssetData {
  currentValue: number              // 현재 가치 (만원)
  purchasePrice?: number            // 매입가 (만원)
  appreciationRate?: number         // 연간 상승률 (%)
  interestRate?: number             // 이자율 (예금 등)
}

// 부채 데이터
export interface DebtData {
  principal: number                 // 원금 (만원)
  currentBalance?: number           // 현재 잔액 (만원)
  interestRate: number              // 금리 (%)
  repaymentType: '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환'
  monthlyPayment?: number           // 월 상환액 (만원)
}

// 부동산 데이터
export interface RealEstateData {
  currentValue: number              // 현재 시세 (만원)
  purchasePrice?: number            // 매입가 (만원)
  appreciationRate?: number         // 연간 상승률 (%)

  // 거주용
  housingType?: '자가' | '전세' | '월세'
  deposit?: number                  // 보증금 (만원)
  monthlyRent?: number              // 월세 (만원)

  // 대출 정보
  hasLoan?: boolean
  loanAmount?: number               // 대출금액 (만원)
  loanRate?: number                 // 대출 금리 (%)
  loanMaturityYear?: number         // 대출 만기 연도
  loanMaturityMonth?: number        // 대출 만기 월
  loanRepaymentType?: '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환'
}

// 통합 데이터 타입
export type FinancialItemData =
  | IncomeData
  | ExpenseData
  | SavingsData
  | PensionData
  | AssetData
  | DebtData
  | RealEstateData

// ============================================
// 재무 항목 (통합 테이블)
// ============================================

export interface FinancialItem {
  id: string
  simulation_id: string

  // 분류
  category: FinancialCategory
  type: FinancialItemType

  // 기본 정보
  title: string
  owner: OwnerType
  memo?: string

  // 시간 범위 (월별 계산 기반)
  start_year?: number
  start_month?: number
  end_year?: number
  end_month?: number
  is_fixed_to_retirement_year: boolean

  // 카테고리별 상세 데이터
  data: FinancialItemData

  // 연동 항목 (부동산 대출 ↔ 부채)
  linked_item_id?: string

  // 메타
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// 재무 항목 생성 입력
export interface FinancialItemInput {
  simulation_id: string
  category: FinancialCategory
  type: FinancialItemType
  title: string
  owner?: OwnerType
  memo?: string
  start_year?: number
  start_month?: number
  end_year?: number
  end_month?: number
  is_fixed_to_retirement_year?: boolean
  data: FinancialItemData
  linked_item_id?: string
  sort_order?: number
}

// 시뮬레이션 생성 입력
export interface SimulationInput {
  profile_id: string
  title: string
  description?: string
  is_default?: boolean
  sort_order?: number
}

// ============================================
// 월별 시뮬레이션 계산용 타입
// ============================================

// 월별 현금흐름
export interface MonthlyCashFlow {
  year: number
  month: number
  incomes: { item: FinancialItem; amount: number }[]
  expenses: { item: FinancialItem; amount: number }[]
  totalIncome: number
  totalExpense: number
  netCashFlow: number
}

// 월별 자산 상태
export interface MonthlyAssetState {
  year: number
  month: number
  assets: { item: FinancialItem; value: number }[]
  debts: { item: FinancialItem; balance: number }[]
  realEstates: { item: FinancialItem; value: number; loanBalance: number }[]
  savings: { item: FinancialItem; balance: number }[]
  pensions: { item: FinancialItem; value: number }[]
  totalAssets: number
  totalDebts: number
  netWorth: number
}

// 시뮬레이션 결과 (전체 타임라인)
export interface SimulationResult {
  simulation: Simulation
  timeline: {
    year: number
    month: number
    cashFlow: MonthlyCashFlow
    assetState: MonthlyAssetState
  }[]
}

// 월별 스냅샷
export interface MonthlySnapshot {
  id: string
  user_id: string
  year_month: string
  total_income: number
  total_expense: number
  monthly_savings: number
  total_real_estate: number
  total_assets: number
  total_pension: number
  total_debts: number
  net_worth: number
  score_overall: number
  score_income: number
  score_expense: number
  score_asset: number
  score_debt: number
  score_pension: number
  created_at: string
  updated_at: string
}

