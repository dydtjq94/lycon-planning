/**
 * 부채 서비스
 *
 * 금액 단위:
 * - DB: 원 단위
 * - 클라이언트: 만원 단위
 * - 변환: 조회 시 원->만원, 저장 시 만원->원
 */

import { createClient } from '@/lib/supabase/client'
import type {
  Debt,
  DebtInput,
  DebtType,
  DebtSourceType,
  LoanRepaymentType,
  RateType,
} from '@/types/tables'
import { createExpense, deleteLinkedExpenses } from './expenseService'
import { convertFromWon, convertToWon, convertArrayFromWon, convertPartialToWon } from './moneyConversion'

// 금액 필드 목록
const DEBT_MONEY_FIELDS = ['principal', 'current_balance'] as const

// ============================================
// 부채 CRUD
// ============================================

export async function getDebts(simulationId: string): Promise<Debt[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], DEBT_MONEY_FIELDS)
}

export async function getDebtById(id: string): Promise<Debt | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, DEBT_MONEY_FIELDS)
}

export async function createDebt(input: DebtInput): Promise<Debt> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertToWon(input, DEBT_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('debts')
    .insert({
      simulation_id: convertedInput.simulation_id,
      type: convertedInput.type,
      title: convertedInput.title,
      principal: convertedInput.principal,
      current_balance: convertedInput.current_balance ?? convertedInput.principal,
      interest_rate: convertedInput.interest_rate,
      rate_type: convertedInput.rate_type || 'fixed',
      spread: convertedInput.spread,
      repayment_type: convertedInput.repayment_type,
      grace_period_months: convertedInput.grace_period_months ?? 0,
      start_year: convertedInput.start_year,
      start_month: convertedInput.start_month,
      maturity_year: convertedInput.maturity_year,
      maturity_month: convertedInput.maturity_month,
      source_type: convertedInput.source_type || null,
      source_id: convertedInput.source_id || null,
      memo: convertedInput.memo,
      sort_order: convertedInput.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) throw error

  // 연동된 부채가 아닌 경우에만 연동 지출 생성
  // (부동산/실물자산에서 온 부채는 해당 서비스에서 지출을 생성함)
  if (!data.source_type) {
    await createLinkedExpensesForDebt(convertFromWon(data, DEBT_MONEY_FIELDS))
  }

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, DEBT_MONEY_FIELDS)
}

export async function updateDebt(
  id: string,
  input: Partial<DebtInput>
): Promise<Debt> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertPartialToWon(input, DEBT_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('debts')
    .update({
      ...convertedInput,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // 연동된 부채가 아닌 경우에만 연동 지출 재생성
  if (!data.source_type) {
    await deleteLinkedExpenses('debt', id)
    await createLinkedExpensesForDebt(convertFromWon(data, DEBT_MONEY_FIELDS))
  }

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, DEBT_MONEY_FIELDS)
}

export async function deleteDebt(id: string): Promise<void> {
  const supabase = createClient()

  // 연동된 지출 먼저 삭제
  await deleteLinkedExpenses('debt', id)

  const { error } = await supabase
    .from('debts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// ============================================
// 분류별 조회
// ============================================

// 직접 입력 부채만 (연동되지 않은 것)
export async function getDirectDebts(simulationId: string): Promise<Debt[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .is('source_type', null)
    .order('sort_order', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], DEBT_MONEY_FIELDS)
}

// 연동된 부채만 (부동산/실물자산에서 온 것)
export async function getLinkedDebts(simulationId: string): Promise<Debt[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .not('source_type', 'is', null)
    .order('sort_order', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], DEBT_MONEY_FIELDS)
}

// 특정 소스에서 연동된 부채
export async function getDebtsBySource(
  sourceType: DebtSourceType,
  sourceId: string
): Promise<Debt[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('is_active', true)

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], DEBT_MONEY_FIELDS)
}

// ============================================
// 월 상환액 계산
// ============================================

export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  startYear: number,
  startMonth: number,
  maturityYear: number,
  maturityMonth: number,
  repaymentType: LoanRepaymentType,
  gracePeriodMonths: number = 0
): { monthlyPayment: number; totalInterest: number } {
  if (!principal) return { monthlyPayment: 0, totalInterest: 0 }

  const monthlyRate = (annualRate || 0) / 100 / 12
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const totalMonths = (maturityYear - currentYear) * 12 + (maturityMonth - currentMonth)
  if (totalMonths <= 0) return { monthlyPayment: 0, totalInterest: 0 }

  switch (repaymentType) {
    case '만기일시상환': {
      const monthlyInterest = principal * monthlyRate
      const totalInterest = monthlyInterest * totalMonths
      return { monthlyPayment: Math.round(monthlyInterest), totalInterest: Math.round(totalInterest) }
    }

    case '원리금균등상환': {
      if (monthlyRate === 0) {
        return { monthlyPayment: Math.round(principal / totalMonths), totalInterest: 0 }
      }
      const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
      const totalPayment = payment * totalMonths
      return { monthlyPayment: Math.round(payment), totalInterest: Math.round(totalPayment - principal) }
    }

    case '원금균등상환': {
      const monthlyPrincipal = principal / totalMonths
      const avgInterest = (principal * monthlyRate * (totalMonths + 1)) / 2 / totalMonths
      const avgPayment = monthlyPrincipal + avgInterest
      const totalInterest = (principal * monthlyRate * (totalMonths + 1)) / 2
      return { monthlyPayment: Math.round(avgPayment), totalInterest: Math.round(totalInterest) }
    }

    case '거치식상환': {
      const effectiveGrace = Math.min(gracePeriodMonths, totalMonths - 1)
      const repaymentMonths = totalMonths - effectiveGrace

      if (repaymentMonths <= 0) {
        const monthlyInterest = principal * monthlyRate
        return { monthlyPayment: Math.round(monthlyInterest), totalInterest: Math.round(monthlyInterest * totalMonths) }
      }

      const graceInterest = principal * monthlyRate * effectiveGrace

      if (monthlyRate === 0) {
        return { monthlyPayment: Math.round(principal / repaymentMonths), totalInterest: Math.round(graceInterest) }
      }
      const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, repaymentMonths)) /
        (Math.pow(1 + monthlyRate, repaymentMonths) - 1)
      const repaymentInterest = payment * repaymentMonths - principal
      return { monthlyPayment: Math.round(payment), totalInterest: Math.round(graceInterest + repaymentInterest) }
    }

    default:
      return { monthlyPayment: 0, totalInterest: 0 }
  }
}

// ============================================
// 유틸리티
// ============================================

// UI 카테고리 → DB 타입 매핑
export type UIDebtCategory = 'credit' | 'other' | 'housing' | 'realEstate' | 'physicalAsset'

export function getDebtTypeFromCategory(category: UIDebtCategory): DebtType {
  switch (category) {
    case 'credit': return 'credit'
    case 'housing': return 'mortgage'
    case 'realEstate': return 'mortgage'
    case 'physicalAsset': return 'car'
    case 'other':
    default: return 'other'
  }
}

export function getCategoryFromDebt(debt: Debt): UIDebtCategory {
  // 연동된 부채
  if (debt.source_type === 'real_estate') {
    // 거주용 vs 투자용 구분 (type으로)
    if (debt.type === 'jeonse') return 'housing'
    return debt.type === 'mortgage' ? 'housing' : 'realEstate'
  }
  if (debt.source_type === 'physical_asset') {
    return 'physicalAsset'
  }

  // 직접 입력 부채
  if (debt.type === 'credit' || debt.type === 'card') return 'credit'
  return 'other'
}

// 타입 라벨
export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  mortgage: '주택담보대출',
  jeonse: '전세자금대출',
  credit: '신용대출',
  car: '자동차대출',
  student: '학자금대출',
  card: '카드대출',
  other: '기타대출',
}

export const REPAYMENT_TYPE_LABELS: Record<LoanRepaymentType, string> = {
  '만기일시상환': '만기일시',
  '원리금균등상환': '원리금균등',
  '원금균등상환': '원금균등',
  '거치식상환': '거치식',
}

export const REPAYMENT_OPTIONS: { value: LoanRepaymentType; label: string; desc: string }[] = [
  { value: '원리금균등상환', label: '원리금균등', desc: '매월 동일 금액 상환' },
  { value: '원금균등상환', label: '원금균등', desc: '원금은 동일, 이자는 점점 감소' },
  { value: '만기일시상환', label: '만기일시', desc: '만기에 원금 일시상환, 매월 이자만' },
  { value: '거치식상환', label: '거치식', desc: '거치기간 후 원리금균등' },
]

// 기본값
export const DEFAULT_LOAN_RATE = 5
export const DEFAULT_LOAN_MONTHS = 60

export function getDefaultMaturity(): { year: number; month: number } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const endMonth = ((currentMonth - 1 + DEFAULT_LOAN_MONTHS) % 12) + 1
  const endYear = currentYear + Math.floor((currentMonth - 1 + DEFAULT_LOAN_MONTHS) / 12)
  return { year: endYear, month: endMonth }
}

// ============================================
// 연동 지출 생성 (부채 → 지출)
// ============================================

async function createLinkedExpensesForDebt(debt: Debt): Promise<void> {
  const startYear = debt.start_year || new Date().getFullYear()
  const startMonth = debt.start_month || 1
  const maturityYear = debt.maturity_year || startYear + 5
  const maturityMonth = debt.maturity_month || 12

  // 월 이자 계산 (원금 * 연이율 / 12)
  const monthlyInterest = Math.round(debt.principal * (debt.interest_rate / 100) / 12)

  // 1. 이자 지출 (모든 상환유형)
  if (monthlyInterest > 0) {
    await createExpense({
      simulation_id: debt.simulation_id,
      type: 'interest',
      title: `${debt.title} 이자`,
      amount: monthlyInterest,
      frequency: 'monthly',
      start_year: startYear,
      start_month: startMonth,
      end_year: maturityYear,
      end_month: maturityMonth,
      is_fixed_to_retirement: false,
      growth_rate: 0,
      rate_category: 'fixed',
      source_type: 'debt',
      source_id: debt.id,
    })
  }

  // 2. 원금상환 지출 (만기일시상환 제외)
  if (debt.repayment_type !== '만기일시상환') {
    const totalMonths = ((maturityYear - startYear) * 12) + (maturityMonth - startMonth)
    const monthlyPrincipal = Math.round(debt.principal / Math.max(totalMonths, 1))

    if (monthlyPrincipal > 0) {
      await createExpense({
        simulation_id: debt.simulation_id,
        type: 'principal',
        title: `${debt.title} 원금상환`,
        amount: monthlyPrincipal,
        frequency: 'monthly',
        start_year: startYear,
        start_month: startMonth,
        end_year: maturityYear,
        end_month: maturityMonth,
        is_fixed_to_retirement: false,
        growth_rate: 0,
        rate_category: 'fixed',
        source_type: 'debt',
        source_id: debt.id,
      })
    }
  }
}
