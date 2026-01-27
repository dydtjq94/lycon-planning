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
// 아이템 타입 분류
// ============================================

// 저축 타입
const SAVINGS_TYPES = ['checking', 'savings', 'deposit', 'emergency']

// 투자 타입
const INVESTMENT_TYPES = ['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'etf']

// 실물자산 타입
const REAL_ASSET_TYPES = ['real_estate', 'car', 'precious_metal', 'art', 'other']

// 무담보 부채 타입 (담보대출 제외)
const UNSECURED_DEBT_TYPES = ['credit', 'student', 'card', 'installment', 'other']

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

  if (error) {
    console.error('[createSnapshot] Error:', error.message, error.code, error.details)
    throw new Error(`Failed to create snapshot: ${error.message}`)
  }
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
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('[getTodaySnapshot] Error:', error.message, error.code, error.details)
    throw new Error(`Failed to get today snapshot: ${error.message}`)
  }
  return data?.[0] || null
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

  if (error) {
    console.error('[getSnapshotItems] Error:', error.message, error.code, error.details)
    throw new Error(`Failed to get snapshot items: ${error.message}`)
  }
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

  // 저축 (예금, 적금, 비상금 등)
  const savings = items
    .filter((item) => item.category === 'asset' && SAVINGS_TYPES.includes(item.item_type))
    .reduce((sum, item) => sum + item.amount, 0)

  // 투자 (주식, 펀드, 채권 등)
  const investments = items
    .filter((item) => item.category === 'asset' && INVESTMENT_TYPES.includes(item.item_type))
    .reduce((sum, item) => sum + item.amount, 0)

  // 실물자산 (부동산, 자동차 등)
  const realAssets = items
    .filter((item) => item.category === 'asset' && REAL_ASSET_TYPES.includes(item.item_type))
    .reduce((sum, item) => sum + item.amount, 0)

  // 총 부채
  const totalDebts = items
    .filter((item) => item.category === 'debt')
    .reduce((sum, item) => sum + item.amount, 0)

  // 무담보 부채 (신용대출, 카드대출 등)
  const unsecuredDebt = items
    .filter((item) => item.category === 'debt' && UNSECURED_DEBT_TYPES.includes(item.item_type))
    .reduce((sum, item) => sum + item.amount, 0)

  // 총 자산 = 저축 + 투자 + 실물자산
  const totalAssets = savings + investments + realAssets

  // 순자산 = 총 자산 - 총 부채
  const netWorth = totalAssets - totalDebts

  return updateSnapshot(snapshotId, {
    total_assets: totalAssets,
    total_debts: totalDebts,
    net_worth: netWorth,
    savings,
    investments,
    real_assets: realAssets,
    unsecured_debt: unsecuredDebt,
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
  savingsChange: number
  investmentsChange: number
  realAssetsChange: number
  debtsChange: number
} {
  if (!previous) {
    return {
      netWorthChange: 0,
      netWorthChangePercent: 0,
      savingsChange: 0,
      investmentsChange: 0,
      realAssetsChange: 0,
      debtsChange: 0,
    }
  }

  const netWorthChange = current.net_worth - previous.net_worth
  const netWorthChangePercent = previous.net_worth !== 0
    ? (netWorthChange / Math.abs(previous.net_worth)) * 100
    : 0

  return {
    netWorthChange,
    netWorthChangePercent: Math.round(netWorthChangePercent * 100) / 100,
    savingsChange: (current.savings || 0) - (previous.savings || 0),
    investmentsChange: (current.investments || 0) - (previous.investments || 0),
    realAssetsChange: (current.real_assets || 0) - (previous.real_assets || 0),
    debtsChange: (current.total_debts || 0) - (previous.total_debts || 0),
  }
}
