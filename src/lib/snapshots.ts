import { createClient } from '@/lib/supabase/client'
import { calculateMonthlyTotals, calculateNetWorth } from '@/lib/calculations/retirement'
import { calculateScores } from '@/lib/calculations/scoring'
import type { Asset, Profile, MonthlySnapshot } from '@/types'

/**
 * 현재 월의 YYYY-MM-01 형식 날짜 반환
 */
export function getCurrentYearMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

/**
 * 사용자의 월별 스냅샷 생성 또는 업데이트
 * assets와 profile 데이터를 기반으로 계산하여 저장
 */
export async function generateMonthlySnapshot(
  userId: string,
  assets: Asset[],
  profile: Profile
): Promise<MonthlySnapshot | null> {
  const supabase = createClient()
  const yearMonth = getCurrentYearMonth()

  // 월별 합계 계산
  const totals = calculateMonthlyTotals(assets)
  const netWorth = calculateNetWorth(totals)
  const monthlySavings = totals.income - totals.expense

  // 스코어 계산
  const currentYear = new Date().getFullYear()
  const birthYear = parseInt(profile.birth_date.split('-')[0], 10)
  const currentAge = currentYear - birthYear

  const scores = calculateScores({
    monthlyIncome: totals.income,
    monthlyExpense: totals.expense,
    totalAssets: totals.realEstate + totals.asset,
    totalDebts: totals.debt,
    netWorth,
    targetRetirementFund: profile.target_retirement_fund,
    currentAge,
    retirementAge: profile.target_retirement_age,
    monthlyPension: totals.pension,
  })

  // 스냅샷 데이터 구성
  const snapshotData = {
    user_id: userId,
    year_month: yearMonth,
    total_income: Math.round(totals.income),
    total_expense: Math.round(totals.expense),
    monthly_savings: Math.round(monthlySavings),
    total_real_estate: Math.round(totals.realEstate),
    total_assets: Math.round(totals.asset),
    total_pension: Math.round(totals.pension),
    total_debts: Math.round(totals.debt),
    net_worth: Math.round(netWorth),
    score_overall: scores.overall,
    score_income: scores.income,
    score_expense: scores.expense,
    score_asset: scores.asset,
    score_debt: scores.debt,
    score_pension: scores.pension,
    updated_at: new Date().toISOString(),
  }

  // Upsert (insert or update on conflict)
  const { data, error } = await supabase
    .from('monthly_snapshots')
    .upsert(snapshotData, {
      onConflict: 'user_id,year_month',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to generate monthly snapshot:', error)
    return null
  }

  return data as MonthlySnapshot
}

/**
 * 사용자의 최근 스냅샷 조회
 */
export async function getLatestSnapshot(userId: string): Promise<MonthlySnapshot | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('year_month', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Failed to get latest snapshot:', error)
    return null
  }

  return data as MonthlySnapshot
}

/**
 * 사용자의 모든 스냅샷 조회 (시계열 데이터용)
 */
export async function getAllSnapshots(userId: string): Promise<MonthlySnapshot[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('year_month', { ascending: true })

  if (error) {
    console.error('Failed to get all snapshots:', error)
    return []
  }

  return data as MonthlySnapshot[]
}

/**
 * 특정 기간의 스냅샷 조회
 */
export async function getSnapshotsInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<MonthlySnapshot[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('year_month', startDate)
    .lte('year_month', endDate)
    .order('year_month', { ascending: true })

  if (error) {
    console.error('Failed to get snapshots in range:', error)
    return []
  }

  return data as MonthlySnapshot[]
}
