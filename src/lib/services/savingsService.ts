import { createClient } from '@/lib/supabase/client'
import type { Savings, SavingsInput, SavingsType, Owner } from '@/types/tables'

// ============================================
// 저축/투자 CRUD
// ============================================

export async function getSavings(simulationId: string): Promise<Savings[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('savings')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getSavingsById(id: string): Promise<Savings | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('savings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function createSavings(input: SavingsInput): Promise<Savings> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('savings')
    .insert({
      simulation_id: input.simulation_id,
      type: input.type,
      title: input.title,
      owner: input.owner || 'self',
      current_balance: input.current_balance,
      monthly_contribution: input.monthly_contribution,
      contribution_start_year: input.contribution_start_year,
      contribution_start_month: input.contribution_start_month,
      contribution_end_year: input.contribution_end_year,
      contribution_end_month: input.contribution_end_month,
      is_contribution_fixed_to_retirement: input.is_contribution_fixed_to_retirement ?? false,
      interest_rate: input.interest_rate,
      expected_return: input.expected_return,
      maturity_year: input.maturity_year,
      maturity_month: input.maturity_month,
      memo: input.memo,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSavings(
  id: string,
  input: Partial<SavingsInput>
): Promise<Savings> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('savings')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSavings(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('savings')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// ============================================
// 타입별 조회
// ============================================

// 저축 계좌만 조회 (checking, savings, deposit)
export async function getSavingsAccounts(simulationId: string): Promise<Savings[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('savings')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .in('type', ['checking', 'savings', 'deposit'])
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data || []
}

// 투자 계좌만 조회
export async function getInvestmentAccounts(simulationId: string): Promise<Savings[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('savings')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .in('type', ['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other'])
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data || []
}

// ============================================
// 유틸리티
// ============================================

// UI 타입 분류
export type UISavingsType = 'checking' | 'savings' | 'deposit'
export type UIInvestmentType = 'domestic_stock' | 'foreign_stock' | 'fund' | 'bond' | 'crypto' | 'other'

export function isSavingsType(type: SavingsType): type is UISavingsType {
  return ['checking', 'savings', 'deposit'].includes(type)
}

export function isInvestmentType(type: SavingsType): type is UIInvestmentType {
  return ['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other'].includes(type)
}

// 타입 라벨
export const SAVINGS_TYPE_LABELS: Record<UISavingsType, string> = {
  checking: '입출금통장',
  savings: '적금',
  deposit: '정기예금',
}

export const INVESTMENT_TYPE_LABELS: Record<UIInvestmentType, string> = {
  domestic_stock: '국내주식/ETF',
  foreign_stock: '해외주식/ETF',
  fund: '펀드',
  bond: '채권',
  crypto: '암호화폐',
  other: '기타',
}

// 전체 타입 라벨
export const ALL_SAVINGS_TYPE_LABELS: Record<SavingsType, string> = {
  ...SAVINGS_TYPE_LABELS,
  ...INVESTMENT_TYPE_LABELS,
}
