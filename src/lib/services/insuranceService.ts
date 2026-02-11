/**
 * 보험 서비스
 *
 * 금액 단위:
 * - DB: 원 단위
 * - 클라이언트: 만원 단위
 * - 변환: 조회 시 원->만원, 저장 시 만원->원
 */

import { createClient } from '@/lib/supabase/client'
import type {
  Insurance,
  InsuranceInput,
  InsuranceType,
} from '@/types/tables'
import { createExpense, deleteLinkedExpenses } from './expenseService'
import { convertFromWon, convertToWon, convertArrayFromWon, convertPartialToWon } from './moneyConversion'

// 금액 필드 목록
const INSURANCE_MONEY_FIELDS = ['monthly_premium', 'coverage_amount', 'current_value', 'maturity_amount'] as const

// ============================================
// 보험 CRUD
// ============================================

export async function getInsurances(simulationId: string): Promise<Insurance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('insurances')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], INSURANCE_MONEY_FIELDS)
}

export async function getInsuranceById(id: string): Promise<Insurance | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('insurances')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, INSURANCE_MONEY_FIELDS)
}

export async function createInsurance(input: InsuranceInput): Promise<Insurance> {
  const supabase = createClient()
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertToWon(input, INSURANCE_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('insurances')
    .insert({
      simulation_id: convertedInput.simulation_id,
      type: convertedInput.type,
      title: convertedInput.title,
      owner: convertedInput.owner || 'self',
      insurance_company: convertedInput.insurance_company || null,
      monthly_premium: convertedInput.monthly_premium,
      premium_start_year: convertedInput.premium_start_year ?? currentYear,
      premium_start_month: convertedInput.premium_start_month ?? currentMonth,
      premium_end_year: convertedInput.premium_end_year ?? null,
      premium_end_month: convertedInput.premium_end_month ?? null,
      is_premium_fixed_to_retirement: convertedInput.is_premium_fixed_to_retirement ?? false,
      coverage_amount: convertedInput.coverage_amount ?? null,
      coverage_end_year: convertedInput.coverage_end_year ?? null,
      coverage_end_month: convertedInput.coverage_end_month ?? null,
      current_value: convertedInput.current_value ?? null,
      maturity_year: convertedInput.maturity_year ?? null,
      maturity_month: convertedInput.maturity_month ?? null,
      maturity_amount: convertedInput.maturity_amount ?? null,
      return_rate: convertedInput.return_rate ?? null,
      pension_start_age: convertedInput.pension_start_age ?? null,
      pension_receiving_years: convertedInput.pension_receiving_years ?? null,
      memo: convertedInput.memo ?? null,
      sort_order: convertedInput.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) throw error

  // 보험료 지출 연동 생성 (만원 변환 후)
  await createLinkedExpenseForInsurance(convertFromWon(data, INSURANCE_MONEY_FIELDS))

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, INSURANCE_MONEY_FIELDS)
}

export async function updateInsurance(
  id: string,
  input: Partial<InsuranceInput>
): Promise<Insurance> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertPartialToWon(input, INSURANCE_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('insurances')
    .update({
      ...convertedInput,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // 연동 지출 재생성 (만원 변환 후)
  await deleteLinkedExpenses('insurance', id)
  await createLinkedExpenseForInsurance(convertFromWon(data, INSURANCE_MONEY_FIELDS))

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, INSURANCE_MONEY_FIELDS)
}

export async function deleteInsurance(id: string): Promise<void> {
  const supabase = createClient()

  // 연동된 지출 먼저 삭제
  await deleteLinkedExpenses('insurance', id)

  const { error } = await supabase
    .from('insurances')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// ============================================
// 분류별 조회
// ============================================

// 보장성 보험 (종신, 정기, 실손, 자동차)
export async function getProtectionInsurances(simulationId: string): Promise<Insurance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('insurances')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .in('type', ['life', 'term', 'health', 'car'])
    .order('sort_order', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], INSURANCE_MONEY_FIELDS)
}

// 저축성/연금 보험
export async function getSavingsInsurances(simulationId: string): Promise<Insurance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('insurances')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .in('type', ['savings', 'pension'])
    .order('sort_order', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], INSURANCE_MONEY_FIELDS)
}

// ============================================
// 유틸리티
// ============================================

// 타입 라벨
export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  life: '종신보험',
  term: '정기보험',
  health: '실손/건강보험',
  savings: '저축성보험',
  car: '자동차보험',
  pension: '연금보험',
  other: '기타보험',
}

// 타입별 카테고리
export type InsuranceCategory = 'protection' | 'savings'

export function getInsuranceCategory(type: InsuranceType): InsuranceCategory {
  if (type === 'savings' || type === 'pension') {
    return 'savings'
  }
  return 'protection'
}

export const INSURANCE_CATEGORY_LABELS: Record<InsuranceCategory, string> = {
  protection: '보장성 보험',
  savings: '저축성/연금 보험',
}

// 보험 타입 옵션 (UI용)
export const INSURANCE_TYPE_OPTIONS: { value: InsuranceType; label: string; desc: string }[] = [
  { value: 'health', label: '실손/건강', desc: '의료비 보장' },
  { value: 'term', label: '정기보험', desc: '일정 기간 사망 보장' },
  { value: 'life', label: '종신보험', desc: '평생 사망 보장' },
  { value: 'car', label: '자동차보험', desc: '차량 사고 보장' },
  { value: 'savings', label: '저축성보험', desc: '저축 + 보장' },
  { value: 'pension', label: '연금보험', desc: '은퇴 후 연금 수령' },
  { value: 'other', label: '기타', desc: '그 외 보험' },
]

// ============================================
// 연동 지출 생성 (보험 → 지출)
// ============================================

async function createLinkedExpenseForInsurance(insurance: Insurance): Promise<void> {
  if (!insurance.monthly_premium || insurance.monthly_premium <= 0) return

  const now = new Date()
  const startYear = insurance.premium_start_year || now.getFullYear()
  const startMonth = insurance.premium_start_month || 1

  await createExpense({
    simulation_id: insurance.simulation_id,
    type: 'insurance',
    title: `${insurance.title} 보험료`,
    amount: insurance.monthly_premium,
    frequency: 'monthly',
    start_year: startYear,
    start_month: startMonth,
    end_year: insurance.premium_end_year,
    end_month: insurance.premium_end_month,
    is_fixed_to_retirement: insurance.is_premium_fixed_to_retirement,
    growth_rate: 0,
    rate_category: 'fixed',
    source_type: 'insurance',
    source_id: insurance.id,
  })
}

// ============================================
// 월 보험료 합계 계산
// ============================================

export function calculateTotalMonthlyPremium(insurances: Insurance[]): number {
  return insurances.reduce((sum, ins) => sum + (ins.monthly_premium || 0), 0)
}

// 보장성 보험료 합계
export function calculateProtectionPremium(insurances: Insurance[]): number {
  return insurances
    .filter(ins => getInsuranceCategory(ins.type) === 'protection')
    .reduce((sum, ins) => sum + (ins.monthly_premium || 0), 0)
}

// 저축성 보험료 합계
export function calculateSavingsPremium(insurances: Insurance[]): number {
  return insurances
    .filter(ins => getInsuranceCategory(ins.type) === 'savings')
    .reduce((sum, ins) => sum + (ins.monthly_premium || 0), 0)
}
