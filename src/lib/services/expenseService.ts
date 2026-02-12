/**
 * 지출 서비스
 * expenses 테이블 CRUD + 연동 처리
 *
 * 금액 단위:
 * - DB: 원 단위
 * - 클라이언트: 만원 단위
 * - 변환: 조회 시 원->만원, 저장 시 만원->원
 */

import { createClient } from '@/lib/supabase/client'
import type { Expense, ExpenseInput, ExpenseType, Frequency, RateCategory } from '@/types/tables'
import { convertFromWon, convertToWon, convertArrayFromWon, convertPartialToWon } from './moneyConversion'

// 금액 필드 목록
const EXPENSE_MONEY_FIELDS = ['amount'] as const

// 지출 조회 (시뮬레이션별)
export async function getExpenses(simulationId: string): Promise<Expense[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], EXPENSE_MONEY_FIELDS)
}

// 지출 생성
export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertToWon(input, EXPENSE_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('expenses')
    .insert(convertedInput)
    .select()
    .single()

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, EXPENSE_MONEY_FIELDS)
}

// 지출 수정
export async function updateExpense(id: string, updates: Partial<ExpenseInput>): Promise<Expense> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedUpdates = convertPartialToWon(updates, EXPENSE_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('expenses')
    .update({ ...convertedUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, EXPENSE_MONEY_FIELDS)
}

// 지출 삭제 (연동된 항목은 삭제 불가)
export async function deleteExpense(id: string): Promise<void> {
  const supabase = createClient()

  // 연동된 항목인지 확인
  const { data: expense } = await supabase
    .from('expenses')
    .select('source_type')
    .eq('id', id)
    .single()

  if (expense?.source_type) {
    throw new Error('연동된 지출은 원본에서 삭제해주세요')
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 지출 타입별 라벨
export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  living: '생활비',
  housing: '주거비',
  education: '교육비',
  insurance: '보험료',
  medical: '의료비',
  transport: '교통비',
  interest: '이자비용',
  principal: '원금상환',
  child: '양육비',
  parents: '부모님 용돈',
  travel: '여행/여가',
  wedding: '경조사',
  other: '기타',
}

// 지출 타입별 기본 설정
export const EXPENSE_TYPE_DEFAULTS: Record<ExpenseType, { rateCategory: RateCategory; growthRate: number }> = {
  living: { rateCategory: 'inflation', growthRate: 2.5 },
  housing: { rateCategory: 'inflation', growthRate: 2.5 },
  education: { rateCategory: 'inflation', growthRate: 3.0 },
  insurance: { rateCategory: 'inflation', growthRate: 2.5 },
  medical: { rateCategory: 'inflation', growthRate: 3.0 },
  transport: { rateCategory: 'inflation', growthRate: 2.5 },
  interest: { rateCategory: 'fixed', growthRate: 0 },
  principal: { rateCategory: 'fixed', growthRate: 0 },
  child: { rateCategory: 'inflation', growthRate: 3.0 },
  parents: { rateCategory: 'inflation', growthRate: 2.5 },
  travel: { rateCategory: 'inflation', growthRate: 2.5 },
  wedding: { rateCategory: 'fixed', growthRate: 0 },
  other: { rateCategory: 'inflation', growthRate: 2.5 },
}

// UI 타입 (DashboardExpenseType)
export type UIExpenseType = 'fixed' | 'variable' | 'onetime' | 'medical' | 'interest' | 'housing'

// DB 타입 → UI 타입 매핑
export function dbTypeToUIType(dbType: ExpenseType): UIExpenseType {
  switch (dbType) {
    case 'living':
    case 'child':
    case 'parents':
    case 'other':
      return 'variable'
    case 'insurance':
    case 'education':
    case 'transport':
      return 'fixed'
    case 'medical':
      return 'medical'
    case 'interest':
    case 'principal':
      return 'interest'
    case 'housing':
      return 'housing'
    case 'travel':
    case 'wedding':
      return 'onetime'
    default:
      return 'variable'
  }
}

// UI 타입 → DB 타입 매핑
export function uiTypeToDBType(uiType: UIExpenseType): ExpenseType {
  switch (uiType) {
    case 'fixed':
      return 'insurance' // 고정비 기본값
    case 'variable':
      return 'living' // 변동비 기본값
    case 'onetime':
      return 'travel' // 일시 지출 기본값
    case 'medical':
      return 'medical'
    case 'interest':
      return 'interest'
    case 'housing':
      return 'housing'
    default:
      return 'other'
  }
}

// 대시보드용 지출 항목 변환
export interface DashboardExpense {
  id: string
  type: ExpenseType
  uiType: UIExpenseType
  title: string
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

export function toDashboardExpense(expense: Expense): DashboardExpense {
  // Inline sourceLabel logic
  let sourceLabel: string | null = null
  if (expense.source_type === 'debt') {
    sourceLabel = '부채'
  } else if (expense.source_type === 'real_estate') {
    sourceLabel = '부동산'
  } else if (expense.source_type) {
    sourceLabel = expense.source_type
  }

  return {
    id: expense.id,
    type: expense.type,
    uiType: dbTypeToUIType(expense.type),
    title: expense.title,
    amount: expense.amount,
    frequency: expense.frequency,
    startYear: expense.start_year,
    startMonth: expense.start_month,
    endYear: expense.end_year,
    endMonth: expense.end_month,
    isFixedToRetirement: expense.is_fixed_to_retirement,
    growthRate: expense.growth_rate,
    rateCategory: expense.rate_category,
    isLinked: expense.source_type !== null,
    sourceType: expense.source_type,
    sourceLabel,
  }
}

// 지출 입력 변환 (대시보드 → DB)
export function toExpenseInput(
  simulationId: string,
  dashboard: Omit<DashboardExpense, 'id' | 'isLinked' | 'sourceLabel'>
): ExpenseInput {
  return {
    simulation_id: simulationId,
    type: dashboard.type,
    title: dashboard.title,
    amount: dashboard.amount,
    frequency: dashboard.frequency,
    start_year: dashboard.startYear,
    start_month: dashboard.startMonth,
    end_year: dashboard.endYear,
    end_month: dashboard.endMonth,
    is_fixed_to_retirement: dashboard.isFixedToRetirement,
    growth_rate: dashboard.growthRate,
    rate_category: dashboard.rateCategory,
    source_type: dashboard.sourceType as Expense['source_type'],
  }
}
