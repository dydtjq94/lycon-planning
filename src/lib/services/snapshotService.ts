/**
 * 자산 기록 (Financial Snapshot) 서비스
 * 고객의 자산 상태를 특정 시점에 기록하고 추적
 */

import { createClient } from '@/lib/supabase/client'
import type {
  FinancialSnapshot,
  FinancialSnapshotInput,
  FinancialSnapshotItem,
  FinancialSnapshotItemInput,
  SnapshotType,
  SnapshotCategory,
} from '@/types/tables'

// ============================================
// Snapshot CRUD
// ============================================

// 고객의 모든 스냅샷 조회
export async function getSnapshots(profileId: string): Promise<FinancialSnapshot[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('financial_snapshots')
    .select('*')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .order('recorded_at', { ascending: false })

  if (error) throw error
  return data || []
}

// 단일 스냅샷 조회
export async function getSnapshot(id: string): Promise<FinancialSnapshot | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('financial_snapshots')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// 가장 최근 스냅샷 조회
export async function getLatestSnapshot(profileId: string): Promise<FinancialSnapshot | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('financial_snapshots')
    .select('*')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// 스냅샷 생성
export async function createSnapshot(input: FinancialSnapshotInput): Promise<FinancialSnapshot> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('financial_snapshots')
    .insert({
      ...input,
      recorded_at: input.recorded_at || new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// 스냅샷 수정
export async function updateSnapshot(
  id: string,
  updates: Partial<FinancialSnapshotInput>
): Promise<FinancialSnapshot> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('financial_snapshots')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// 스냅샷 삭제 (소프트 삭제)
export async function deleteSnapshot(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('financial_snapshots')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// 스냅샷 완전 삭제
export async function hardDeleteSnapshot(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('financial_snapshots')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 오늘 날짜 스냅샷 조회 (없으면 null)
export async function getTodaySnapshot(profileId: string): Promise<FinancialSnapshot | null> {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('financial_snapshots')
    .select('*')
    .eq('profile_id', profileId)
    .eq('recorded_at', today)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data
}

// 오늘 날짜 스냅샷 가져오기 (없으면 생성)
export async function getOrCreateTodaySnapshot(profileId: string): Promise<FinancialSnapshot> {
  const existing = await getTodaySnapshot(profileId)
  if (existing) return existing

  // 없으면 새로 생성
  return createSnapshot({
    profile_id: profileId,
    snapshot_type: 'followup',
  })
}

// 오늘 날짜 스냅샷 업데이트 (없으면 생성 후 업데이트)
export async function upsertTodaySnapshot(
  profileId: string,
  updates: Partial<FinancialSnapshotInput>
): Promise<FinancialSnapshot> {
  const snapshot = await getOrCreateTodaySnapshot(profileId)
  return updateSnapshot(snapshot.id, updates)
}

// ============================================
// Snapshot Items CRUD
// ============================================

// 스냅샷의 모든 항목 조회
export async function getSnapshotItems(snapshotId: string): Promise<FinancialSnapshotItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('financial_snapshot_items')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .order('category')
    .order('sort_order')

  if (error) throw error
  return data || []
}

// 카테고리별 항목 조회
export async function getSnapshotItemsByCategory(
  snapshotId: string,
  category: SnapshotCategory
): Promise<FinancialSnapshotItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('financial_snapshot_items')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .eq('category', category)
    .order('sort_order')

  if (error) throw error
  return data || []
}

// 항목 생성
export async function createSnapshotItem(input: FinancialSnapshotItemInput): Promise<FinancialSnapshotItem> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('financial_snapshot_items')
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data
}

// 여러 항목 일괄 생성
export async function createSnapshotItems(inputs: FinancialSnapshotItemInput[]): Promise<FinancialSnapshotItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('financial_snapshot_items')
    .insert(inputs)
    .select()

  if (error) throw error
  return data || []
}

// 항목 수정
export async function updateSnapshotItem(
  id: string,
  updates: Partial<FinancialSnapshotItemInput>
): Promise<FinancialSnapshotItem> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('financial_snapshot_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// 항목 삭제
export async function deleteSnapshotItem(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('financial_snapshot_items')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 스냅샷의 모든 항목 삭제
export async function deleteSnapshotItems(snapshotId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('financial_snapshot_items')
    .delete()
    .eq('snapshot_id', snapshotId)

  if (error) throw error
}

// ============================================
// 요약 계산 및 업데이트
// ============================================

// 스냅샷 요약 데이터 재계산
export async function recalculateSnapshotSummary(snapshotId: string): Promise<FinancialSnapshot> {
  const items = await getSnapshotItems(snapshotId)

  let totalAssets = 0
  let totalDebts = 0
  let monthlyIncome = 0
  let monthlyExpense = 0

  for (const item of items) {
    switch (item.category) {
      case 'asset':
      case 'pension':
        totalAssets += item.amount
        break
      case 'debt':
        totalDebts += item.amount
        break
      case 'income':
        monthlyIncome += item.amount
        break
      case 'expense':
        monthlyExpense += item.amount
        break
    }
  }

  const netWorth = totalAssets - totalDebts
  const monthlySavings = monthlyIncome - monthlyExpense
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0

  return updateSnapshot(snapshotId, {
    total_assets: totalAssets,
    total_debts: totalDebts,
    net_worth: netWorth,
    monthly_income: monthlyIncome,
    monthly_expense: monthlyExpense,
    monthly_savings: monthlySavings,
    savings_rate: Math.round(savingsRate * 100) / 100,
  })
}

// ============================================
// 유틸리티
// ============================================

// 스냅샷 타입 라벨
export const SNAPSHOT_TYPE_LABELS: Record<SnapshotType, string> = {
  initial: '최초 기록',
  followup: '후속 기록',
  quarterly: '분기 기록',
  annual: '연간 기록',
}

// 카테고리 라벨
export const SNAPSHOT_CATEGORY_LABELS: Record<SnapshotCategory, string> = {
  asset: '자산',
  debt: '부채',
  income: '수입',
  expense: '지출',
  pension: '연금',
}

// 이전 스냅샷 대비 변화 계산
export function calculateChange(
  current: FinancialSnapshot,
  previous: FinancialSnapshot | null
): {
  netWorthChange: number
  netWorthChangePercent: number
  incomeChange: number
  expenseChange: number
  savingsRateChange: number
} {
  if (!previous) {
    return {
      netWorthChange: 0,
      netWorthChangePercent: 0,
      incomeChange: 0,
      expenseChange: 0,
      savingsRateChange: 0,
    }
  }

  const netWorthChange = current.net_worth - previous.net_worth
  const netWorthChangePercent = previous.net_worth !== 0
    ? (netWorthChange / Math.abs(previous.net_worth)) * 100
    : 0

  return {
    netWorthChange,
    netWorthChangePercent: Math.round(netWorthChangePercent * 100) / 100,
    incomeChange: current.monthly_income - previous.monthly_income,
    expenseChange: current.monthly_expense - previous.monthly_expense,
    savingsRateChange: current.savings_rate - previous.savings_rate,
  }
}
