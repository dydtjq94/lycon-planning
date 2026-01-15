/**
 * 소득 서비스
 * incomes 테이블 CRUD + 연동 처리
 */

import { createClient } from '@/lib/supabase/client'
import type { Income, IncomeInput, IncomeType, Owner, Frequency, RateCategory } from '@/types/tables'

// 소득 조회 (시뮬레이션별)
export async function getIncomes(simulationId: string): Promise<Income[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('incomes')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data || []
}

// 소득 생성
export async function createIncome(input: IncomeInput): Promise<Income> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('incomes')
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data
}

// 소득 수정
export async function updateIncome(id: string, updates: Partial<IncomeInput>): Promise<Income> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('incomes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// 소득 삭제 (연동된 항목은 삭제 불가)
export async function deleteIncome(id: string): Promise<void> {
  const supabase = createClient()

  // 연동된 항목인지 확인
  const { data: income } = await supabase
    .from('incomes')
    .select('source_type')
    .eq('id', id)
    .single()

  if (income?.source_type) {
    throw new Error('연동된 소득은 원본에서 삭제해주세요')
  }

  const { error } = await supabase
    .from('incomes')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 연동된 소득 삭제 (source_type + source_id로)
export async function deleteLinkedIncomes(sourceType: string, sourceId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('incomes')
    .delete()
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)

  if (error) throw error
}

// 소득 타입별 라벨
export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  labor: '근로소득',
  business: '사업소득',
  rental: '임대소득',
  pension: '연금소득',
  dividend: '배당/이자소득',
  side: '부업소득',
  other: '기타소득',
}

// 소득 타입별 기본 설정
export const INCOME_TYPE_DEFAULTS: Record<IncomeType, { rateCategory: RateCategory; growthRate: number }> = {
  labor: { rateCategory: 'income', growthRate: 3.0 },
  business: { rateCategory: 'income', growthRate: 3.0 },
  rental: { rateCategory: 'inflation', growthRate: 2.5 },
  pension: { rateCategory: 'inflation', growthRate: 2.5 },
  dividend: { rateCategory: 'investment', growthRate: 5.0 },
  side: { rateCategory: 'income', growthRate: 3.0 },
  other: { rateCategory: 'fixed', growthRate: 0 },
}

// 연동 소스 라벨
export function getSourceLabel(sourceType: string | null, sourceId: string | null): string | null {
  if (!sourceType) return null

  switch (sourceType) {
    case 'national_pension':
      return '국민연금'
    case 'retirement_pension':
      return '퇴직연금'
    case 'personal_pension':
      return '개인연금'
    case 'real_estate':
      return '부동산'
    default:
      return sourceType
  }
}

// 대시보드용 소득 항목 변환 (기존 DashboardIncomeItem 호환)
export interface DashboardIncome {
  id: string
  type: IncomeType
  title: string
  owner: Owner
  amount: number
  frequency: Frequency
  startYear: number
  startMonth: number
  endYear: number | null
  endMonth: number | null
  isFixedToRetirement: boolean
  growthRate: number
  rateCategory: RateCategory
  isLinked: boolean
  sourceType: string | null
  sourceLabel: string | null
}

export function toDashboardIncome(income: Income): DashboardIncome {
  return {
    id: income.id,
    type: income.type,
    title: income.title,
    owner: income.owner,
    amount: income.amount,
    frequency: income.frequency,
    startYear: income.start_year,
    startMonth: income.start_month,
    endYear: income.end_year,
    endMonth: income.end_month,
    isFixedToRetirement: income.is_fixed_to_retirement,
    growthRate: income.growth_rate,
    rateCategory: income.rate_category,
    isLinked: income.source_type !== null,
    sourceType: income.source_type,
    sourceLabel: getSourceLabel(income.source_type, income.source_id),
  }
}

// 소득 입력 변환 (대시보드 → DB)
export function toIncomeInput(
  simulationId: string,
  dashboard: Omit<DashboardIncome, 'id' | 'isLinked' | 'sourceLabel'>
): IncomeInput {
  return {
    simulation_id: simulationId,
    type: dashboard.type,
    title: dashboard.title,
    owner: dashboard.owner,
    amount: dashboard.amount,
    frequency: dashboard.frequency,
    start_year: dashboard.startYear,
    start_month: dashboard.startMonth,
    end_year: dashboard.endYear,
    end_month: dashboard.endMonth,
    is_fixed_to_retirement: dashboard.isFixedToRetirement,
    growth_rate: dashboard.growthRate,
    rate_category: dashboard.rateCategory,
    source_type: dashboard.sourceType as Income['source_type'],
  }
}
