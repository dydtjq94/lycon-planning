import type { OnboardingData, AssetInput, Frequency } from '@/types'
import type { SectionId } from '../SectionForm'

// Row ID 타입 정의
export type RowId =
  | 'name'
  | 'birth_date'
  | 'children'
  | 'labor_income'        // 근로 소득
  | 'business_income'     // 사업 소득
  | 'fixed_expenses'      // 고정 지출
  | 'variable_expenses'   // 변동 지출
  | 'savings'
  | 'investment'
  | 'realEstate'
  | 'asset'
  | 'debt'
  | 'national_pension'    // 국민연금
  | 'retirement_pension'  // 퇴직연금 (DB/DC)
  | 'personal_pension'    // 개인연금 (IRP, 연금저축)
  | 'other_pension'       // 기타연금 (주택연금 등)
  | 'retirement_age'
  | 'retirement_fund'

// Row 설정 타입
export interface RowConfig {
  id: RowId
  label: string
  isVisible: (data: OnboardingData, visibleRows: RowId[]) => boolean
  isComplete: (data: OnboardingData) => boolean
}

// ProgressiveForm Props
export interface ProgressiveFormProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  onActiveRowChange: (rowId: string) => void
  activeSection?: SectionId
  onSectionChange?: (sectionId: SectionId) => void
  onComplete?: () => void
  isCompleteDisabled?: boolean
  isSaving?: boolean
}

// Row Input Props (공통)
export interface RowInputProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  onFocus: (rowId: RowId) => void
  isActive?: boolean
}

// Asset Item 관련 Props
export interface AssetRowInputProps extends RowInputProps {
  addAssetItem: (key: keyof OnboardingData) => void
  updateAssetItem: (key: keyof OnboardingData, index: number, updates: Partial<AssetInput>) => void
  deleteAssetItem: (key: keyof OnboardingData, index: number) => void
}

// 빈도 레이블
export const frequencyLabels: Record<Frequency, string> = {
  monthly: '월',
  yearly: '연',
  once: '총',
}

// 섹션별로 포함되는 행들 정의
export const sectionRows: Record<SectionId, RowId[]> = {
  basic: ['name', 'birth_date', 'children', 'retirement_age', 'retirement_fund'],
  income: ['labor_income', 'business_income', 'fixed_expenses', 'variable_expenses'],
  savings: ['savings', 'investment'],
  realEstate: ['realEstate'],
  asset: ['asset'],
  debt: ['debt'],
  pension: ['national_pension', 'retirement_pension', 'personal_pension', 'other_pension'],
}

// Row 설정 배열
export const rows: RowConfig[] = [
  // 기본 정보
  {
    id: 'name',
    label: '이름',
    isVisible: () => true,
    isComplete: (data) => !!data.name.trim(),
  },
  {
    id: 'birth_date',
    label: '생년월일',
    isVisible: (_, visible) => visible.includes('name'),
    isComplete: (data) => !!data.birth_date && (!data.isMarried || (data.isMarried === true && !!data.spouse?.birth_date)),
  },
  {
    id: 'children',
    label: '자녀',
    isVisible: (_, visible) => visible.includes('birth_date'),
    isComplete: (data) => data.children.length === 0 || data.children.every(child => !!child.birth_date),
  },
  {
    id: 'retirement_age',
    label: '목표 은퇴 나이',
    isVisible: (_, visible) => visible.includes('children'),
    isComplete: (data) => {
      const hasSpouseRetirementAge = data.spouse?.retirement_age != null && data.spouse.retirement_age !== 0
      const mainComplete = data.target_retirement_age > 0
      const spouseComplete = (data.spouse?.retirement_age ?? 0) > 0
      return (mainComplete || spouseComplete) && (!hasSpouseRetirementAge || spouseComplete)
    },
  },
  {
    id: 'retirement_fund',
    label: '목표 은퇴 자금',
    isVisible: (_, visible) => visible.includes('retirement_age'),
    isComplete: (data) => data.target_retirement_fund > 0,
  },
  // 소득/지출
  {
    id: 'labor_income',
    label: '근로소득',
    isVisible: (_, visible) => visible.includes('retirement_fund'),
    isComplete: (data) => {
      const mainComplete = data.laborIncome !== null
      const spouseComplete = data.spouseLaborIncome !== null
      // 배우자 은퇴 나이가 설정된 경우에만 배우자 소득 필요
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0
      return mainComplete && (!hasWorkingSpouse || spouseComplete)
    },
  },
  {
    id: 'business_income',
    label: '사업소득',
    isVisible: (_, visible) => visible.includes('labor_income'),
    isComplete: (data) => {
      const mainComplete = data.businessIncome !== null
      const spouseComplete = data.spouseBusinessIncome !== null
      // 배우자 은퇴 나이가 설정된 경우에만 배우자 소득 필요
      const hasWorkingSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0
      return mainComplete && (!hasWorkingSpouse || spouseComplete)
    },
  },
  {
    id: 'fixed_expenses',
    label: '고정 지출',
    isVisible: (_, visible) => visible.includes('business_income'),
    isComplete: (data) => data.fixedExpenses !== null,
  },
  {
    id: 'variable_expenses',
    label: '변동 지출',
    isVisible: (_, visible) => visible.includes('fixed_expenses'),
    isComplete: (data) => data.variableExpenses !== null,
  },
  // 저축/투자
  {
    id: 'savings',
    label: '저축',
    isVisible: (_, visible) => visible.includes('variable_expenses'),
    isComplete: (data) => data.assets.some(i => i.subcategory === '저축' && i.name && i.name.trim() !== '' && i.amount !== null && i.amount > 0),
  },
  {
    id: 'investment',
    label: '투자',
    isVisible: (_, visible) => visible.includes('savings'),
    isComplete: (data) => data.assets.some(i => i.subcategory === '투자' && i.name && i.name.trim() !== '' && i.amount !== null && i.amount > 0),
  },
  // 부동산
  {
    id: 'realEstate',
    label: '부동산',
    isVisible: (_, visible) => visible.includes('investment'),
    isComplete: (data) => data.realEstates.some(i => i.name && i.name.trim() !== '' && i.amount !== null && i.amount > 0),
  },
  // 금융자산
  {
    id: 'asset',
    label: '금융자산',
    isVisible: (_, visible) => visible.includes('realEstate'),
    isComplete: (data) => data.assets.some(i => i.subcategory === '기타자산' && i.name && i.name.trim() !== '' && i.amount !== null && i.amount > 0),
  },
  // 부채
  {
    id: 'debt',
    label: '부채',
    isVisible: (_, visible) => visible.includes('asset'),
    isComplete: (data) => data.debts.some(i => i.name && i.name.trim() !== '' && i.amount !== null && i.amount > 0),
  },
  // 연금 (한국형 3층 연금)
  {
    id: 'national_pension',
    label: '국민연금',
    isVisible: (_, visible) => visible.includes('debt'),
    isComplete: (data) => data.pensions.some(i => i.subcategory === '국민연금' && i.amount !== null && i.amount > 0),
  },
  {
    id: 'retirement_pension',
    label: '퇴직연금',
    isVisible: (_, visible) => visible.includes('national_pension'),
    isComplete: (data) => data.pensions.some(i => i.subcategory === '퇴직연금' && i.amount !== null && i.amount > 0),
  },
  {
    id: 'personal_pension',
    label: '개인연금',
    isVisible: (_, visible) => visible.includes('retirement_pension'),
    isComplete: (data) => data.pensions.some(i => i.subcategory === '개인연금' && i.amount !== null && i.amount > 0),
  },
  {
    id: 'other_pension',
    label: '기타연금',
    isVisible: (_, visible) => visible.includes('personal_pension'),
    isComplete: (data) => data.pensions.some(i => i.subcategory === '기타연금' && i.amount !== null && i.amount > 0),
  },
]
