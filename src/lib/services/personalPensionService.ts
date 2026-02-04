/**
 * 개인연금 서비스
 * personal_pensions 테이블 CRUD + 소득 연동
 *
 * 금액 단위:
 * - DB: 원 단위
 * - 클라이언트: 만원 단위
 * - 변환: 조회 시 원->만원, 저장 시 만원->원
 */

import { createClient } from '@/lib/supabase/client'
import type { PersonalPension, PersonalPensionInput, Owner, PersonalPensionType } from '@/types/tables'
import { createIncome, deleteLinkedIncomes } from './incomeService'
import { convertFromWon, convertToWon, convertArrayFromWon, convertPartialToWon } from './moneyConversion'

// 금액 필드 목록
const PERSONAL_PENSION_MONEY_FIELDS = ['current_balance', 'monthly_contribution'] as const

// 개인연금 조회 (시뮬레이션별)
export async function getPersonalPensions(simulationId: string): Promise<PersonalPension[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('personal_pensions')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .order('owner', { ascending: true })
    .order('pension_type', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], PERSONAL_PENSION_MONEY_FIELDS)
}

// 개인연금 단건 조회
export async function getPersonalPension(id: string): Promise<PersonalPension | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('personal_pensions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return data ? convertFromWon(data, PERSONAL_PENSION_MONEY_FIELDS) : null
}

// 개인연금 생성 + 소득 연동
export async function createPersonalPension(
  input: PersonalPensionInput,
  birthYear: number,
  retirementAge: number
): Promise<PersonalPension> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertToWon(input, PERSONAL_PENSION_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('personal_pensions')
    .insert(convertedInput)
    .select()
    .single()

  if (error) throw error

  // 수령 정보가 있을 경우에만 소득 연동 (DB 원 단위 데이터로)
  if (data.start_age && data.receiving_years) {
    await createLinkedIncome(data, birthYear, retirementAge)
  }

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, PERSONAL_PENSION_MONEY_FIELDS)
}

// 개인연금 수정 + 소득 연동 업데이트
export async function updatePersonalPension(
  id: string,
  updates: Partial<PersonalPensionInput>,
  birthYear: number,
  retirementAge: number
): Promise<PersonalPension> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedUpdates = convertPartialToWon(updates, PERSONAL_PENSION_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('personal_pensions')
    .update({ ...convertedUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // 기존 연동 소득 삭제
  await deleteLinkedIncomes('personal_pension', id)

  // 수령 정보가 있을 경우에만 소득 연동 재생성 (DB 원 단위 데이터로)
  if (data.start_age && data.receiving_years) {
    await createLinkedIncome(data, birthYear, retirementAge)
  }

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, PERSONAL_PENSION_MONEY_FIELDS)
}

// 개인연금 삭제 + 연동 소득 삭제
export async function deletePersonalPension(id: string): Promise<void> {
  const supabase = createClient()

  // 연동된 소득 먼저 삭제
  await deleteLinkedIncomes('personal_pension', id)

  const { error } = await supabase
    .from('personal_pensions')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 개인연금 예상 수령액 계산
export function calculatePersonalPensionAmount(
  currentBalance: number,
  monthlyContribution: number | null,
  returnRate: number,
  yearsUntilStart: number,
  contributionYears: number
): number {
  // 복리 계산
  const monthlyRate = returnRate / 100 / 12
  let total = currentBalance

  // 적립 기간 동안의 복리 성장
  const monthsContributing = contributionYears * 12
  const monthlyAmount = monthlyContribution || 0

  for (let i = 0; i < monthsContributing; i++) {
    total = total * (1 + monthlyRate) + monthlyAmount
  }

  // 적립 종료 후 수령 시작까지의 성장
  const monthsAfterContribution = Math.max(0, (yearsUntilStart - contributionYears)) * 12
  for (let i = 0; i < monthsAfterContribution; i++) {
    total = total * (1 + monthlyRate)
  }

  return Math.round(total)
}

// 연동 소득 생성 (개인연금 → 소득)
async function createLinkedIncome(
  pension: PersonalPension,
  birthYear: number,
  retirementAge: number
): Promise<void> {
  if (!pension.start_age || !pension.receiving_years) return

  const currentYear = new Date().getFullYear()
  const currentAge = currentYear - birthYear
  const yearsUntilStart = pension.start_age - currentAge

  // 적립 종료까지의 년수 계산
  let contributionYears = 0
  if (pension.is_contribution_fixed_to_retirement) {
    contributionYears = retirementAge - currentAge
  } else if (pension.contribution_end_year) {
    contributionYears = pension.contribution_end_year - currentYear
  }
  contributionYears = Math.max(0, contributionYears)

  // 예상 총액 계산
  const totalAmount = calculatePersonalPensionAmount(
    pension.current_balance,
    pension.monthly_contribution,
    pension.return_rate,
    yearsUntilStart,
    contributionYears
  )

  // 월 수령액 계산
  const monthlyAmount = Math.round(totalAmount / (pension.receiving_years * 12))
  if (monthlyAmount <= 0) return

  const startYear = birthYear + pension.start_age
  const endYear = startYear + pension.receiving_years

  const ownerLabel = pension.owner === 'self' ? '본인' : '배우자'
  const typeLabel = PENSION_TYPE_LABELS[pension.pension_type]

  await createIncome({
    simulation_id: pension.simulation_id,
    type: 'pension',
    title: `${ownerLabel} ${typeLabel}`,
    owner: pension.owner,
    amount: monthlyAmount,
    frequency: 'monthly',
    start_year: startYear,
    start_month: 1,
    end_year: endYear,
    end_month: 12,
    is_fixed_to_retirement: false,
    growth_rate: 0,
    rate_category: 'fixed',
    source_type: 'personal_pension',
    source_id: pension.id,
  })
}

// 개인연금 타입 라벨
export const PENSION_TYPE_LABELS: Record<PersonalPensionType, string> = {
  pension_savings: '연금저축',
  irp: '개인형 IRP',
  isa: 'ISA',
}

// owner + type별 개인연금 조회
export async function getPersonalPensionByOwnerAndType(
  simulationId: string,
  owner: Owner,
  pensionType: PersonalPensionType
): Promise<PersonalPension | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('personal_pensions')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('owner', owner)
    .eq('pension_type', pensionType)
    .eq('is_active', true)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  // DB(원) -> 클라이언트(만원) 변환
  return data ? convertFromWon(data, PERSONAL_PENSION_MONEY_FIELDS) : null
}

// owner별 개인연금 목록 조회
export async function getPersonalPensionsByOwner(
  simulationId: string,
  owner: Owner
): Promise<PersonalPension[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('personal_pensions')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('owner', owner)
    .eq('is_active', true)
    .order('pension_type', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], PERSONAL_PENSION_MONEY_FIELDS)
}

// 개인연금 upsert (owner + type별로 하나만 존재)
export async function upsertPersonalPension(
  simulationId: string,
  owner: Owner,
  pensionType: PersonalPensionType,
  input: Omit<PersonalPensionInput, 'simulation_id' | 'owner' | 'pension_type'>,
  birthYear: number,
  retirementAge: number
): Promise<PersonalPension> {
  const existing = await getPersonalPensionByOwnerAndType(simulationId, owner, pensionType)

  if (existing) {
    return updatePersonalPension(existing.id, input, birthYear, retirementAge)
  } else {
    return createPersonalPension(
      {
        ...input,
        simulation_id: simulationId,
        owner,
        pension_type: pensionType,
      },
      birthYear,
      retirementAge
    )
  }
}
