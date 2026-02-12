/**
 * 국민연금 서비스
 * national_pensions 테이블 CRUD + 소득 연동
 *
 * 금액 단위:
 * - DB: 원 단위
 * - 클라이언트: 만원 단위
 * - 변환: 조회 시 원->만원, 저장 시 만원->원
 */

import { createClient } from '@/lib/supabase/client'
import type { NationalPension, NationalPensionInput, Owner } from '@/types/tables'
import { convertFromWon, convertToWon, convertArrayFromWon, convertPartialToWon } from './moneyConversion'

// 금액 필드 목록
const NATIONAL_PENSION_MONEY_FIELDS = ['expected_monthly_amount'] as const

// 국민연금 조회 (시뮬레이션별)
export async function getNationalPensions(simulationId: string): Promise<NationalPension[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('national_pensions')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .order('owner', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], NATIONAL_PENSION_MONEY_FIELDS)
}

// 국민연금 단건 조회
export async function getNationalPension(id: string): Promise<NationalPension | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('national_pensions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return data ? convertFromWon(data, NATIONAL_PENSION_MONEY_FIELDS) : null
}

// 국민연금 생성 + 소득 연동
export async function createNationalPension(
  input: NationalPensionInput,
  birthYear: number
): Promise<NationalPension> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertToWon(input, NATIONAL_PENSION_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('national_pensions')
    .insert(convertedInput)
    .select()
    .single()

  if (error) throw error

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, NATIONAL_PENSION_MONEY_FIELDS)
}

// 국민연금 수정 + 소득 연동 업데이트
export async function updateNationalPension(
  id: string,
  updates: Partial<NationalPensionInput>,
  birthYear: number
): Promise<NationalPension> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedUpdates = convertPartialToWon(updates, NATIONAL_PENSION_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('national_pensions')
    .update({ ...convertedUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, NATIONAL_PENSION_MONEY_FIELDS)
}

// 국민연금 삭제
export async function deleteNationalPension(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('national_pensions')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// owner별 국민연금 조회
export async function getNationalPensionByOwner(
  simulationId: string,
  owner: Owner
): Promise<NationalPension | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('national_pensions')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('owner', owner)
    .eq('is_active', true)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116: no rows returned
  // DB(원) -> 클라이언트(만원) 변환
  return data ? convertFromWon(data, NATIONAL_PENSION_MONEY_FIELDS) : null
}

// 국민연금 upsert (owner별로 하나만 존재)
export async function upsertNationalPension(
  simulationId: string,
  owner: Owner,
  input: Omit<NationalPensionInput, 'simulation_id' | 'owner'>,
  birthYear: number
): Promise<NationalPension> {
  // 기존 항목 확인
  const existing = await getNationalPensionByOwner(simulationId, owner)

  if (existing) {
    // 수정
    return updateNationalPension(existing.id, input, birthYear)
  } else {
    // 생성
    return createNationalPension(
      {
        ...input,
        simulation_id: simulationId,
        owner,
      },
      birthYear
    )
  }
}
