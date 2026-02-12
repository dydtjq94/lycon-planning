/**
 * 퇴직연금 서비스
 * retirement_pensions 테이블 CRUD + 소득 연동
 *
 * 금액 단위:
 * - DB: 원 단위
 * - 클라이언트: 만원 단위
 * - 변환: 조회 시 원->만원, 저장 시 만원->원
 */

import { createClient } from '@/lib/supabase/client'
import type { RetirementPension, RetirementPensionInput, Owner, RetirementPensionType, ReceiveType } from '@/types/tables'
import { convertFromWon, convertToWon, convertArrayFromWon, convertPartialToWon } from './moneyConversion'

// 금액 필드 목록
const RETIREMENT_PENSION_MONEY_FIELDS = ['current_balance'] as const

// 퇴직연금 조회 (시뮬레이션별)
export async function getRetirementPensions(simulationId: string): Promise<RetirementPension[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('retirement_pensions')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .order('owner', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], RETIREMENT_PENSION_MONEY_FIELDS)
}

// 퇴직연금 단건 조회
export async function getRetirementPension(id: string): Promise<RetirementPension | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('retirement_pensions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return data ? convertFromWon(data, RETIREMENT_PENSION_MONEY_FIELDS) : null
}

// 퇴직연금 생성 + 소득 연동
export async function createRetirementPension(
  input: RetirementPensionInput,
  birthYear: number,
  retirementAge: number,
  monthlyIncome?: number
): Promise<RetirementPension> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertToWon(input, RETIREMENT_PENSION_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('retirement_pensions')
    .insert(convertedInput)
    .select()
    .single()

  if (error) throw error

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, RETIREMENT_PENSION_MONEY_FIELDS)
}

// 퇴직연금 수정 + 소득 연동 업데이트
export async function updateRetirementPension(
  id: string,
  updates: Partial<RetirementPensionInput>,
  birthYear: number,
  retirementAge: number,
  monthlyIncome?: number
): Promise<RetirementPension> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedUpdates = convertPartialToWon(updates, RETIREMENT_PENSION_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('retirement_pensions')
    .update({ ...convertedUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, RETIREMENT_PENSION_MONEY_FIELDS)
}

// 퇴직연금 삭제
export async function deleteRetirementPension(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('retirement_pensions')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 퇴직연금 예상 수령액 계산
export function calculateRetirementPensionAmount(
  pensionType: RetirementPensionType,
  currentBalance: number | null,
  yearsOfService: number | null,
  returnRate: number,
  yearsUntilRetirement: number,
  monthlyIncome?: number
): number {
  switch (pensionType) {
    case 'dc':
    case 'corporate_irp':
      // DC/기업IRP: 현재 잔액 * (1 + 수익률)^남은연수
      if (!currentBalance) return 0
      return Math.round(currentBalance * Math.pow(1 + returnRate / 100, yearsUntilRetirement))

    case 'db':
      // DB: 평균 월급 * 근속연수
      if (!monthlyIncome || !yearsOfService) return 0
      const totalYears = yearsOfService + yearsUntilRetirement
      return Math.round(monthlyIncome * totalYears)

    case 'severance':
      // 퇴직금: 평균 월급 * 근속연수
      if (!monthlyIncome || !yearsOfService) return 0
      const totalServiceYears = yearsOfService + yearsUntilRetirement
      return Math.round(monthlyIncome * totalServiceYears)

    default:
      return 0
  }
}

// 퇴직연금 타입 라벨
export const PENSION_TYPE_LABELS: Record<RetirementPensionType, string> = {
  db: 'DB형 퇴직연금',
  dc: 'DC형 퇴직연금',
  corporate_irp: '기업형 IRP',
  severance: '퇴직금',
}

// 수령 방식 라벨
export const RECEIVE_TYPE_LABELS: Record<ReceiveType, string> = {
  lump_sum: '일시금',
  annuity: '연금',
}

// owner별 퇴직연금 조회
export async function getRetirementPensionByOwner(
  simulationId: string,
  owner: Owner
): Promise<RetirementPension | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('retirement_pensions')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('owner', owner)
    .eq('is_active', true)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  // DB(원) -> 클라이언트(만원) 변환
  return data ? convertFromWon(data, RETIREMENT_PENSION_MONEY_FIELDS) : null
}

// 퇴직연금 upsert (owner별로 하나만 존재)
export async function upsertRetirementPension(
  simulationId: string,
  owner: Owner,
  input: Omit<RetirementPensionInput, 'simulation_id' | 'owner'>,
  birthYear: number,
  retirementAge: number,
  monthlyIncome?: number
): Promise<RetirementPension> {
  const existing = await getRetirementPensionByOwner(simulationId, owner)

  if (existing) {
    return updateRetirementPension(existing.id, input, birthYear, retirementAge, monthlyIncome)
  } else {
    return createRetirementPension(
      {
        ...input,
        simulation_id: simulationId,
        owner,
      },
      birthYear,
      retirementAge,
      monthlyIncome
    )
  }
}
