import type { OnboardingData } from '@/types'
import type { SectionId } from '../SectionForm'

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 배우자가 일하는지 확인 (은퇴 나이가 설정되어 있으면 일하는 것으로 간주)
 */
export function hasWorkingSpouse(data: OnboardingData): boolean {
  return data.spouse?.retirement_age != null && data.spouse.retirement_age > 0
}

/**
 * 퇴직연금 타입이 DC형인지 확인 (DC, 기업형IRP)
 */
export function isDCType(type: string | null | undefined): boolean {
  return type === 'DC' || type === 'corporate_irp'
}

/**
 * 퇴직연금 타입이 DB형인지 확인 (DB, 퇴직금)
 */
export function isDBType(type: string | null | undefined): boolean {
  return type === 'DB' || type === 'severance'
}

/**
 * 퇴직연금 완료 여부 확인
 */
export function isRetirementPensionComplete(
  pensionType: string | null | undefined,
  dcBalance: number | null | undefined,
  dbYearsOfService: number | null | undefined
): boolean {
  if (pensionType === 'unknown') return true
  if (isDCType(pensionType)) return dcBalance != null
  if (isDBType(pensionType)) return dbYearsOfService != null
  return false
}

// Row ID 타입 정의
export type RowId =
  | 'name'
  | 'birth_date'
  | 'children'
  | 'labor_income'
  | 'business_income'
  | 'living_expenses'
  | 'realEstate'
  | 'asset'
  | 'debt'
  | 'national_pension'
  | 'retirement_pension'
  | 'personal_pension'
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
  currentStepIndex?: number
}

// 섹션별 행 매핑
export const sectionRows: Record<SectionId, RowId[]> = {
  household: ['name', 'birth_date', 'children'],
  goals: ['retirement_age', 'retirement_fund'],
  income: ['labor_income', 'business_income'],
  expense: ['living_expenses'],
  realEstate: ['realEstate'],
  asset: ['asset'],
  debt: ['debt'],
  pension: ['national_pension', 'retirement_pension', 'personal_pension'],
}

// Row 설정 배열
export const rows: RowConfig[] = [
  {
    id: 'name',
    label: '이름/성별',
    isVisible: () => true,
    isComplete: (data) => !!data.name.trim() && !!data.gender,
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
  {
    id: 'labor_income',
    label: '근로소득',
    isVisible: (_, visible) => visible.includes('retirement_fund'),
    isComplete: (data) => {
      const mainComplete = data.laborIncome !== null
      const spouseComplete = data.spouseLaborIncome !== null
      return mainComplete && (!hasWorkingSpouse(data) || spouseComplete)
    },
  },
  {
    id: 'business_income',
    label: '사업소득',
    isVisible: (_, visible) => visible.includes('labor_income'),
    isComplete: (data) => {
      const mainComplete = data.businessIncome !== null
      const spouseComplete = data.spouseBusinessIncome !== null
      return mainComplete && (!hasWorkingSpouse(data) || spouseComplete)
    },
  },
  {
    id: 'living_expenses',
    label: '평균 생활비',
    isVisible: (_, visible) => visible.includes('business_income'),
    isComplete: (data) => data.livingExpenses !== null,
  },
  {
    id: 'realEstate',
    label: '거주 부동산',
    isVisible: (_, visible) => visible.includes('living_expenses'),
    isComplete: (data) => {
      if (data.housingType === '해당없음') return true
      if (data.housingType === null) return false
      const isValueFilled = data.housingValue !== null && data.housingValue > 0
      const isRentFilled = data.housingRent !== null && data.housingRent > 0
      const isLoanFilled = data.housingLoan !== null && data.housingLoan > 0
      const isMonthlyRentComplete = data.housingType === '월세' ? (isValueFilled && isRentFilled) : isValueFilled
      return isMonthlyRentComplete && (!data.housingHasLoan || isLoanFilled)
    },
  },
  {
    id: 'asset',
    label: '현금 보유',
    isVisible: (_, visible) => visible.includes('realEstate'),
    isComplete: (data) => {
      // 온보딩 입력 (deprecated) 또는 대시보드 입력 (savingsAccounts) 체크
      const hasOnboardingInput = data.cashCheckingAccount !== null
      const hasDashboardInput = data.savingsAccounts && data.savingsAccounts.length > 0
      return hasOnboardingInput || hasDashboardInput
    },
  },
  {
    id: 'debt',
    label: '부채',
    isVisible: (_, visible) => visible.includes('asset'),
    isComplete: (data) => data.hasNoDebt === true || data.debts.some(i => i.name && i.name.trim() !== '' && i.amount !== null && i.amount > 0),
  },
  {
    id: 'national_pension',
    label: '국민연금',
    isVisible: (_, visible) => visible.includes('debt'),
    isComplete: (data) => {
      const mainComplete = data.nationalPension != null && data.nationalPension > 0
      const spouseComplete = data.spouseNationalPension != null && data.spouseNationalPension > 0
      return mainComplete && (!hasWorkingSpouse(data) || spouseComplete)
    },
  },
  {
    id: 'retirement_pension',
    label: '퇴직연금/퇴직금',
    isVisible: (_, visible) => visible.includes('national_pension'),
    isComplete: (data) => {
      // 본인: DC형은 적립금, DB형은 근속년수, 모름은 바로 완료
      const mainComplete = isRetirementPensionComplete(
        data.retirementPensionType,
        data.retirementPensionBalance,
        data.yearsOfService
      )
      // 배우자
      const spouseComplete = isRetirementPensionComplete(
        data.spouseRetirementPensionType,
        data.spouseRetirementPensionBalance,
        data.spouseYearsOfService
      )
      return mainComplete && (!hasWorkingSpouse(data) || spouseComplete)
    },
  },
  {
    id: 'personal_pension',
    label: '개인연금',
    isVisible: (_, visible) => visible.includes('retirement_pension'),
    isComplete: (data) => {
      const mainComplete = (data.irpBalance != null && data.irpBalance >= 0) || (data.pensionSavingsBalance != null && data.pensionSavingsBalance >= 0)
      const spouseComplete = (data.spouseIrpBalance != null && data.spouseIrpBalance >= 0) || (data.spousePensionSavingsBalance != null && data.spousePensionSavingsBalance >= 0)
      return mainComplete && (!hasWorkingSpouse(data) || spouseComplete)
    },
  },
]
