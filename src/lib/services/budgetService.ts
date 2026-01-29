/**
 * 가계부 서비스
 * budget_transactions, budget_categories 테이블 CRUD
 */

import { createClient } from '@/lib/supabase/client'

// 타입 정의
export type TransactionType = 'income' | 'expense'

export interface BudgetCategory {
  id: string
  profile_id: string | null
  type: TransactionType
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  is_default: boolean
  created_at: string
}

export interface BudgetTransaction {
  id: string
  profile_id: string
  type: TransactionType
  category: string
  title: string
  amount: number
  year: number
  month: number
  day: number | null
  memo: string | null
  is_recurring: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface BudgetTransactionInput {
  profile_id: string
  type: TransactionType
  category: string
  title: string
  amount: number
  year: number
  month: number
  day?: number | null
  memo?: string | null
  is_recurring?: boolean
}

// ============================================
// 카테고리 관련
// ============================================

// 카테고리 조회 (기본 + 사용자 정의)
export async function getBudgetCategories(
  profileId: string,
  type?: TransactionType
): Promise<BudgetCategory[]> {
  const supabase = createClient()

  let query = supabase
    .from('budget_categories')
    .select('*')
    .or(`profile_id.is.null,profile_id.eq.${profileId}`)
    .order('sort_order', { ascending: true })

  if (type) {
    query = query.eq('type', type)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// 사용자 카테고리 생성
export async function createBudgetCategory(
  profileId: string,
  type: TransactionType,
  name: string
): Promise<BudgetCategory> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('budget_categories')
    .insert({
      profile_id: profileId,
      type,
      name,
      is_default: false,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// 거래 관련
// ============================================

// 거래 조회 (월별)
export async function getBudgetTransactions(
  profileId: string,
  year: number,
  month: number
): Promise<BudgetTransaction[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('budget_transactions')
    .select('*')
    .eq('profile_id', profileId)
    .eq('year', year)
    .eq('month', month)
    .order('day', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// 거래 생성
export async function createBudgetTransaction(
  input: BudgetTransactionInput
): Promise<BudgetTransaction> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('budget_transactions')
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data
}

// 거래 수정
export async function updateBudgetTransaction(
  id: string,
  updates: Partial<BudgetTransactionInput>
): Promise<BudgetTransaction> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('budget_transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// 거래 삭제
export async function deleteBudgetTransaction(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('budget_transactions')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ============================================
// 집계 함수
// ============================================

// 월별 카테고리 합계
export interface CategorySummary {
  category: string
  total: number
}

export async function getMonthlySummaryByCategory(
  profileId: string,
  year: number,
  month: number,
  type: TransactionType
): Promise<CategorySummary[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('budget_transactions')
    .select('category, amount')
    .eq('profile_id', profileId)
    .eq('year', year)
    .eq('month', month)
    .eq('type', type)

  if (error) throw error

  // 카테고리별 합계 계산
  const summaryMap = new Map<string, number>()
  for (const tx of data || []) {
    const current = summaryMap.get(tx.category) || 0
    summaryMap.set(tx.category, current + tx.amount)
  }

  return Array.from(summaryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

// 월 총합
export async function getMonthlyTotal(
  profileId: string,
  year: number,
  month: number,
  type: TransactionType
): Promise<number> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('budget_transactions')
    .select('amount')
    .eq('profile_id', profileId)
    .eq('year', year)
    .eq('month', month)
    .eq('type', type)

  if (error) throw error

  return (data || []).reduce((sum, tx) => sum + tx.amount, 0)
}
