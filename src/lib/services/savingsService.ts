/**
 * 저축/투자 서비스
 *
 * 금액 단위:
 * - DB: 원 단위
 * - 클라이언트: 만원 단위
 * - 변환: 조회 시 원->만원, 저장 시 만원->원
 */

import { createClient } from '@/lib/supabase/client'
import type { Savings, SavingsInput, SavingsType, Owner } from '@/types/tables'
import { convertFromWon, convertToWon, convertArrayFromWon, convertPartialToWon } from './moneyConversion'

// 금액 필드 목록
const SAVINGS_MONEY_FIELDS = ['current_balance', 'monthly_contribution'] as const

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
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], SAVINGS_MONEY_FIELDS)
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
  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, SAVINGS_MONEY_FIELDS)
}

export async function createSavings(input: SavingsInput): Promise<Savings> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertToWon(input, SAVINGS_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('savings')
    .insert({
      simulation_id: convertedInput.simulation_id,
      type: convertedInput.type,
      title: convertedInput.title,
      broker_name: convertedInput.broker_name,
      owner: convertedInput.owner || 'self',
      current_balance: convertedInput.current_balance,
      monthly_contribution: convertedInput.monthly_contribution,
      contribution_start_year: convertedInput.contribution_start_year,
      contribution_start_month: convertedInput.contribution_start_month,
      contribution_end_year: convertedInput.contribution_end_year,
      contribution_end_month: convertedInput.contribution_end_month,
      is_contribution_fixed_to_retirement: convertedInput.is_contribution_fixed_to_retirement ?? false,
      interest_rate: convertedInput.interest_rate,
      expected_return: convertedInput.expected_return,
      maturity_year: convertedInput.maturity_year,
      maturity_month: convertedInput.maturity_month,
      memo: convertedInput.memo,
      sort_order: convertedInput.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, SAVINGS_MONEY_FIELDS)
}

export async function updateSavings(
  id: string,
  input: Partial<SavingsInput>
): Promise<Savings> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertPartialToWon(input, SAVINGS_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('savings')
    .update({
      ...convertedInput,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, SAVINGS_MONEY_FIELDS)
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
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], SAVINGS_MONEY_FIELDS)
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
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], SAVINGS_MONEY_FIELDS)
}

// ============================================
// 유틸리티
// ============================================

// UI 타입 분류
export type UISavingsType = 'checking' | 'savings' | 'deposit' | 'housing'
export type UIInvestmentType = 'domestic_stock' | 'foreign_stock' | 'fund' | 'bond' | 'crypto' | 'other'

export function isSavingsType(type: SavingsType): type is UISavingsType {
  return ['checking', 'savings', 'deposit', 'housing'].includes(type)
}

export function isInvestmentType(type: SavingsType): type is UIInvestmentType {
  return ['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other'].includes(type)
}

// 타입 라벨
export const SAVINGS_TYPE_LABELS: Record<UISavingsType, string> = {
  checking: '입출금통장',
  savings: '적금',
  deposit: '정기예금',
  housing: '주택청약',
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
