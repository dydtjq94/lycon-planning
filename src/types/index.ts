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
  housingRent: number | null       // 월세: 월세+관리비
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
  retirementPensionType: 'DB' | 'DC' | 'severance' | null  // 퇴직연금/퇴직금 유형
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

