import type { OnboardingData, OnboardingPurpose } from '@/types'

// ============================================
// 스텝 정의
// ============================================

export type StepId =
  // 인트로
  | 'welcome'
  // Part 1: 목적
  | 'purpose'
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

export type Phase = 'ask' | 'respond'

export type InputType =
  | 'none'           // 입력 없음 (인트로, 응답 화면)
  | 'text'           // 텍스트 입력
  | 'date'           // 날짜 입력
  | 'number'         // 숫자 입력
  | 'yes_no'         // 예/아니오 선택
  | 'multi_select'   // 다중 선택
  | 'children_add'   // 자녀 추가 (특수)
  | 'spouse_form'    // 배우자 정보 폼

export interface StepConfig {
  id: StepId
  inputType: InputType
  // 이 스텝이 보여야 하는지 (조건부 스텝용)
  isVisible: (data: OnboardingData) => boolean
  // 이 스텝이 완료되었는지
  isComplete: (data: OnboardingData) => boolean
}

// ============================================
// 목적 선택지
// ============================================

export const purposeOptions: Array<{ id: OnboardingPurpose; label: string }> = [
  { id: 'retirement_fund', label: '은퇴 후 돈이 얼마나 필요한지 알고 싶어요' },
  { id: 'savings_check', label: '지금 저축을 잘 하고 있는지 확인하고 싶어요' },
  { id: 'pension_calc', label: '연금이 얼마나 나올지 계산해보고 싶어요' },
  { id: 'asset_organize', label: '자산을 한눈에 정리하고 싶어요' },
  { id: 'dont_know', label: '뭐부터 해야 할지 모르겠어요' },
]

// ============================================
// 스텝 설정
// ============================================

export const steps: StepConfig[] = [
  // 인트로
  {
    id: 'welcome',
    inputType: 'none',
    isVisible: () => true,
    isComplete: () => true, // 항상 완료 (다음 버튼만 누르면 됨)
  },

  // Part 1: 목적
  {
    id: 'purpose',
    inputType: 'multi_select',
    isVisible: () => true,
    isComplete: (data) => (data.purposes?.length ?? 0) > 0,
  },

  // Part 2: 알아가기
  {
    id: 'name',
    inputType: 'text',
    isVisible: () => true,
    isComplete: (data) => !!data.name.trim(),
  },
  {
    id: 'birth',
    inputType: 'date',
    isVisible: () => true,
    isComplete: (data) => !!data.birth_date,
  },
  {
    id: 'retirement_age',
    inputType: 'number',
    isVisible: () => true,
    isComplete: (data) => data.target_retirement_age > 0,
  },

  // Part 3: 가족
  {
    id: 'spouse',
    inputType: 'yes_no',
    isVisible: () => true,
    isComplete: (data) => data.isMarried !== null,
  },
  {
    id: 'spouse_info',
    inputType: 'spouse_form',
    isVisible: (data) => data.isMarried === true,
    isComplete: (data) => !data.isMarried || !!data.spouse?.birth_date,
  },
  {
    id: 'children',
    inputType: 'yes_no',
    isVisible: () => true,
    isComplete: (data) => data.hasChildren !== null,
  },
  {
    id: 'children_info',
    inputType: 'children_add',
    isVisible: (data) => data.hasChildren === true,
    isComplete: (data) => !data.hasChildren || data.children.length > 0,
  },

  // Part 4: 재무
  {
    id: 'income',
    inputType: 'number',
    isVisible: () => true,
    isComplete: (data) => data.laborIncome !== null,
  },
  {
    id: 'expense',
    inputType: 'number',
    isVisible: () => true,
    isComplete: (data) => data.livingExpenses !== null,
  },

  // Part 5: 완료
  {
    id: 'complete',
    inputType: 'none',
    isVisible: () => true,
    isComplete: () => true,
  },
]

// ============================================
// 헬퍼 함수들
// ============================================

export function getVisibleSteps(data: OnboardingData): StepConfig[] {
  return steps.filter(step => step.isVisible(data))
}

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
