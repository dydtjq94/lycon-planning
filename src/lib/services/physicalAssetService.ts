/**
 * 실물자산 서비스
 *
 * 금액 단위:
 * - DB: 원 단위
 * - 클라이언트: 만원 단위
 * - 변환: 조회 시 원->만원, 저장 시 만원->원
 */

import { createClient } from '@/lib/supabase/client'
import type {
  PhysicalAsset,
  PhysicalAssetInput,
  PhysicalAssetType,
  FinancingType,
  LoanRepaymentType,
} from '@/types/tables'
import { convertFromWon, convertToWon, convertArrayFromWon, convertPartialToWon } from './moneyConversion'

// 금액 필드 목록
const PHYSICAL_ASSET_MONEY_FIELDS = ['current_value', 'purchase_price', 'loan_amount'] as const

// ============================================
// 실물자산 CRUD
// ============================================

export async function getPhysicalAssets(simulationId: string): Promise<PhysicalAsset[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('physical_assets')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  // DB(원) -> 클라이언트(만원) 변환
  return convertArrayFromWon(data || [], PHYSICAL_ASSET_MONEY_FIELDS)
}

export async function getPhysicalAssetById(id: string): Promise<PhysicalAsset | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('physical_assets')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, PHYSICAL_ASSET_MONEY_FIELDS)
}

export async function createPhysicalAsset(input: PhysicalAssetInput): Promise<PhysicalAsset> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertToWon(input, PHYSICAL_ASSET_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('physical_assets')
    .insert({
      simulation_id: convertedInput.simulation_id,
      type: convertedInput.type,
      title: convertedInput.title,
      owner: convertedInput.owner || 'self',
      current_value: convertedInput.current_value,
      purchase_price: convertedInput.purchase_price,
      purchase_year: convertedInput.purchase_year,
      purchase_month: convertedInput.purchase_month,
      annual_rate: convertedInput.annual_rate ?? 0,
      has_loan: convertedInput.has_loan ?? false,
      financing_type: convertedInput.financing_type,
      loan_amount: convertedInput.loan_amount,
      loan_rate: convertedInput.loan_rate,
      loan_start_year: convertedInput.loan_start_year,
      loan_start_month: convertedInput.loan_start_month,
      loan_maturity_year: convertedInput.loan_maturity_year,
      loan_maturity_month: convertedInput.loan_maturity_month,
      loan_repayment_type: convertedInput.loan_repayment_type,
      sell_year: convertedInput.sell_year,
      sell_month: convertedInput.sell_month,
      memo: convertedInput.memo,
      sort_order: convertedInput.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) throw error

  // 연동 항목 생성 (DB 원 단위 데이터로)
  await syncLinkedDebt(data)

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, PHYSICAL_ASSET_MONEY_FIELDS)
}

export async function updatePhysicalAsset(
  id: string,
  input: Partial<PhysicalAssetInput>
): Promise<PhysicalAsset> {
  const supabase = createClient()

  // 클라이언트(만원) -> DB(원) 변환
  const convertedInput = convertPartialToWon(input, PHYSICAL_ASSET_MONEY_FIELDS)

  const { data, error } = await supabase
    .from('physical_assets')
    .update({
      ...convertedInput,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // 연동 항목 재동기화 (DB 원 단위 데이터로)
  await syncLinkedDebt(data)

  // DB(원) -> 클라이언트(만원) 변환
  return convertFromWon(data, PHYSICAL_ASSET_MONEY_FIELDS)
}

export async function deletePhysicalAsset(id: string): Promise<void> {
  const supabase = createClient()

  // 연동된 부채 먼저 삭제
  await deleteLinkedDebt(id)

  // 실물자산 삭제 (soft delete)
  const { error } = await supabase
    .from('physical_assets')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// ============================================
// 연동 부채 관리
// ============================================

async function syncLinkedDebt(asset: PhysicalAsset): Promise<void> {
  // 기존 연동 부채 삭제
  await deleteLinkedDebt(asset.id)

  // 연동 부채 생성은 엔진에서 처리
}

async function deleteLinkedDebt(assetId: string): Promise<void> {
  const supabase = createClient()

  await supabase
    .from('debts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('source_type', 'physical_asset')
    .eq('source_id', assetId)
}

// ============================================
// 유틸리티
// ============================================

// DB 타입 → UI 타입 매핑
export type UIAssetType = 'car' | 'precious_metal' | 'custom'

export function dbTypeToUIType(dbType: PhysicalAssetType): UIAssetType {
  switch (dbType) {
    case 'car': return 'car'
    case 'precious_metal': return 'precious_metal'
    case 'art':
    case 'other':
    default: return 'custom'
  }
}

export function uiTypeToDBType(uiType: UIAssetType): PhysicalAssetType {
  switch (uiType) {
    case 'car': return 'car'
    case 'precious_metal': return 'precious_metal'
    case 'custom': return 'other'
    default: return 'other'
  }
}

export const ASSET_TYPE_LABELS: Record<UIAssetType, string> = {
  car: '자동차',
  precious_metal: '귀금속/금',
  custom: '기타 자산',
}

export const FINANCING_TYPE_LABELS: Record<FinancingType | 'none', string> = {
  none: '없음',
  loan: '대출 있음',
  installment: '할부 있음',
}

export const REPAYMENT_TYPE_LABELS: Record<LoanRepaymentType, string> = {
  '만기일시상환': '만기일시',
  '원리금균등상환': '원리금균등',
  '원금균등상환': '원금균등',
  '거치식상환': '거치식',
}
