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
  fixedExpenseName: string          // 고정 지출 항목명
  fixedExpenses: number | null      // 고정 지출
  fixedExpensesFrequency: 'monthly' | 'yearly'  // 고정 지출 주기
  additionalFixedExpenses: Array<{name: string, amount: number | null, frequency: 'monthly' | 'yearly'}>
  variableExpenseName: string       // 변동 지출 항목명
  variableExpenses: number | null   // 변동 지출
  variableExpensesFrequency: 'monthly' | 'yearly'  // 변동 지출 주기
  additionalVariableExpenses: Array<{name: string, amount: number | null, frequency: 'monthly' | 'yearly'}>

  // 기존 배열 (추후 상세 입력용, 현재 미사용)
  incomes: AssetInput[]
  expenses: AssetInput[]
  realEstates: AssetInput[]
  assets: AssetInput[]
  debts: AssetInput[]
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

