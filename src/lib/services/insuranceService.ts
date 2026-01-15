import { createClient } from '@/lib/supabase/client'
import type {
  Insurance,
  InsuranceInput,
  InsuranceType,
} from '@/types/tables'
import { createExpense, deleteLinkedExpenses } from './expenseService'

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
  return data || []
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
  return data
}

export async function createInsurance(input: InsuranceInput): Promise<Insurance> {
  const supabase = createClient()
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const { data, error } = await supabase
    .from('insurances')
    .insert({
      simulation_id: input.simulation_id,
      type: input.type,
      title: input.title,
      owner: input.owner || 'self',
      insurance_company: input.insurance_company || null,
      monthly_premium: input.monthly_premium,
      premium_start_year: input.premium_start_year ?? currentYear,
      premium_start_month: input.premium_start_month ?? currentMonth,
      premium_end_year: input.premium_end_year ?? null,
      premium_end_month: input.premium_end_month ?? null,
      is_premium_fixed_to_retirement: input.is_premium_fixed_to_retirement ?? false,
      coverage_amount: input.coverage_amount ?? null,
      coverage_end_year: input.coverage_end_year ?? null,
      coverage_end_month: input.coverage_end_month ?? null,
      current_value: input.current_value ?? null,
      maturity_year: input.maturity_year ?? null,
      maturity_month: input.maturity_month ?? null,
      maturity_amount: input.maturity_amount ?? null,
      return_rate: input.return_rate ?? null,
      pension_start_age: input.pension_start_age ?? null,
      pension_receiving_years: input.pension_receiving_years ?? null,
      memo: input.memo ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) throw error

  // 보험료 지출 연동 생성
  await createLinkedExpenseForInsurance(data)

  return data
}

export async function updateInsurance(
  id: string,
  input: Partial<InsuranceInput>
): Promise<Insurance> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('insurances')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // 연동 지출 재생성
  await deleteLinkedExpenses('insurance', id)
  await createLinkedExpenseForInsurance(data)

  return data
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
  return data || []
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
  return data || []
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
