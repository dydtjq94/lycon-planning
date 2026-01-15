import type { OnboardingData, OnboardingPurpose } from '@/types'

// ============================================
// Part 정의 (5개 파트)
// ============================================

export type PartId = 1 | 2 | 3 | 4 | 5

export const partInfo: Record<PartId, { label: string; description: string }> = {
  1: { label: '목적', description: '목적 파악' },
  2: { label: '알아가기', description: '당신을 알아가기' },
  3: { label: '가족', description: '가족 관계' },
  4: { label: '재무', description: '재무 상황' },
  5: { label: '완료', description: '완료' },
}

// ============================================
// Step 정의 (각 화면 단위)
// ============================================

export type StepId =
  // Part 1: 목적
  | 'purpose'
  | 'purpose_empathy'
  // Part 2: 알아가기
  | 'name'
  | 'birth'
  | 'retirement_age'
  // Part 3: 가족
  | 'spouse'
  | 'spouse_info'
  | 'children'
  | 'children_info'
  // Part 4: 재무
  | 'income'
  | 'expense'
  // Part 5: 완료
  | 'complete'
  // 하위 호환성 (deprecated - 추후 제거)
  | 'basic_info'

export type StepType = 'input' | 'select' | 'multi_select' | 'empathy' | 'complete'

export interface StepConfig {
  id: StepId
  part: PartId
  type: StepType
  // 이 스텝이 보여야 하는지 (조건부 스텝용)
  isVisible: (data: OnboardingData) => boolean
  // 이 스텝이 완료되었는지
  isComplete: (data: OnboardingData) => boolean
}

// ============================================
// 목적 선택지 정의
// ============================================

export const purposeOptions: Array<{ id: OnboardingPurpose; label: string }> = [
  { id: 'retirement_fund', label: '은퇴 후 돈이 얼마나 필요한지 알고 싶어요' },
  { id: 'savings_check', label: '지금 저축을 잘 하고 있는지 확인하고 싶어요' },
  { id: 'pension_calc', label: '연금이 얼마나 나올지 계산해보고 싶어요' },
  { id: 'asset_organize', label: '자산을 한눈에 정리하고 싶어요' },
]

export const purposeEmpathy: Record<OnboardingPurpose, string> = {
  retirement_fund: '은퇴 후 얼마가 필요한지, 막막하셨죠?\nLycon이 당신의 상황에 맞게 계산해드릴게요.',
  savings_check: '충분히 모으고 있는지, 불안하셨죠?\nLycon이 목표 대비 현재 위치를 보여드릴게요.',
  pension_calc: '국민연금, 퇴직연금... 복잡하셨죠?\nLycon이 한눈에 정리해드릴게요.',
  asset_organize: '여기저기 흩어진 자산, 헷갈리셨죠?\nLycon이 깔끔하게 정리해드릴게요.',
  dont_know: '뭘 해야 할지 모르시겠죠?\n괜찮아요, 처음부터 함께 해볼게요.',
}

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
 * 현재 나이 계산
 */
export function calculateAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

/**
 * 자녀 나이 계산
 */
export function calculateChildAge(birthDate: string): number {
  return calculateAge(birthDate)
}

// ============================================
// Step 설정 배열
// ============================================

export const steps: StepConfig[] = [
  // Part 1: 목적
  {
    id: 'purpose',
    part: 1,
    type: 'multi_select',
    isVisible: () => true,
    isComplete: (data) => (data.purposes?.length ?? 0) > 0,
  },
  {
    id: 'purpose_empathy',
    part: 1,
    type: 'empathy',
    isVisible: (data) => (data.purposes?.length ?? 0) > 0,
    isComplete: (data) => (data.purposes?.length ?? 0) > 0, // 공감은 보여주면 완료
  },

  // Part 2: 알아가기
  {
    id: 'name',
    part: 2,
    type: 'input',
    isVisible: () => true,
    isComplete: (data) => !!data.name.trim(),
  },
  {
    id: 'birth',
    part: 2,
    type: 'input',
    isVisible: () => true,
    isComplete: (data) => !!data.birth_date,
  },
  {
    id: 'retirement_age',
    part: 2,
    type: 'input',
    isVisible: () => true,
    isComplete: (data) => data.target_retirement_age > 0,
  },

  // Part 3: 가족
  {
    id: 'spouse',
    part: 3,
    type: 'select',
    isVisible: () => true,
    isComplete: (data) => data.isMarried !== null,
  },
  {
    id: 'spouse_info',
    part: 3,
    type: 'input',
    isVisible: (data) => data.isMarried === true,
    isComplete: (data) => !data.isMarried || !!data.spouse?.birth_date,
  },
  {
    id: 'children',
    part: 3,
    type: 'select',
    isVisible: () => true,
    isComplete: (data) => data.hasChildren !== null,
  },
  {
    id: 'children_info',
    part: 3,
    type: 'input',
    isVisible: (data) => data.hasChildren === true,
    isComplete: (data) => !data.hasChildren || data.children.length > 0,
  },

  // Part 4: 재무
  {
    id: 'income',
    part: 4,
    type: 'input',
    isVisible: () => true,
    isComplete: (data) => data.laborIncome !== null,
  },
  {
    id: 'expense',
    part: 4,
    type: 'input',
    isVisible: () => true,
    isComplete: (data) => data.livingExpenses !== null,
  },

  // Part 5: 완료
  {
    id: 'complete',
    part: 5,
    type: 'complete',
    isVisible: () => true,
    isComplete: () => true,
  },
]

// ============================================
// 헬퍼 함수들
// ============================================

/**
 * 현재 보이는 스텝들만 필터링
 */
export function getVisibleSteps(data: OnboardingData): StepConfig[] {
  return steps.filter(step => step.isVisible(data))
}

/**
 * 특정 Part의 스텝들 가져오기
 */
export function getStepsByPart(part: PartId, data: OnboardingData): StepConfig[] {
  return getVisibleSteps(data).filter(step => step.part === part)
}

/**
 * Part 진행률 계산
 */
export function getPartProgress(part: PartId, data: OnboardingData): { completed: number; total: number } {
  const partSteps = getStepsByPart(part, data)
  const completed = partSteps.filter(step => step.isComplete(data)).length
  return { completed, total: partSteps.length }
}

/**
 * 현재 Part 찾기
 */
export function getCurrentPart(stepId: StepId): PartId {
  const step = steps.find(s => s.id === stepId)
  return step?.part ?? 1
}

// ============================================
// 하위 호환성을 위한 타입 (deprecated)
// ============================================

export type RowId = StepId
export type RowConfig = StepConfig

// 하위 호환성을 위한 rows alias
export const rows = steps

export interface ProgressiveFormProps {
  data: OnboardingData
  currentStepIndex?: number
}
