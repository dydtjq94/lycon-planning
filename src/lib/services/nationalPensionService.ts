/**
 * 국민연금 서비스
 * national_pensions 테이블 CRUD + 소득 연동
 */

import { createClient } from '@/lib/supabase/client'
import type { NationalPension, NationalPensionInput, Owner } from '@/types/tables'
import { createIncome, deleteLinkedIncomes } from './incomeService'

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
  return data || []
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
  return data
}

// 국민연금 생성 + 소득 연동
export async function createNationalPension(
  input: NationalPensionInput,
  birthYear: number
): Promise<NationalPension> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('national_pensions')
    .insert(input)
    .select()
    .single()

  if (error) throw error

  // 소득 테이블에 연동 항목 생성
  await createLinkedIncome(data, birthYear)

  return data
}

// 국민연금 수정 + 소득 연동 업데이트
export async function updateNationalPension(
  id: string,
  updates: Partial<NationalPensionInput>,
  birthYear: number
): Promise<NationalPension> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('national_pensions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // 기존 연동 소득 삭제 후 재생성
  await deleteLinkedIncomes('national_pension', id)
  await createLinkedIncome(data, birthYear)

  return data
}

// 국민연금 삭제 + 연동 소득 삭제
export async function deleteNationalPension(id: string): Promise<void> {
  const supabase = createClient()

  // 연동된 소득 먼저 삭제
  await deleteLinkedIncomes('national_pension', id)

  const { error } = await supabase
    .from('national_pensions')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 연동 소득 생성 (국민연금 → 소득)
async function createLinkedIncome(pension: NationalPension, birthYear: number): Promise<void> {
  const startYear = birthYear + pension.start_age
  const endYear = pension.end_age ? birthYear + pension.end_age : birthYear + 100

  const ownerLabel = pension.owner === 'self' ? '본인' : '배우자'

  await createIncome({
    simulation_id: pension.simulation_id,
    type: 'pension',
    title: `${ownerLabel} 국민연금`,
    owner: pension.owner,
    amount: pension.expected_monthly_amount,
    frequency: 'monthly',
    start_year: startYear,
    start_month: 1,
    end_year: endYear,
    end_month: 12,
    is_fixed_to_retirement: false,
    growth_rate: 0,
    rate_category: 'fixed',
    source_type: 'national_pension',
    source_id: pension.id,
  })
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
  return data || null
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
