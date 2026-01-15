import { createClient } from '@/lib/supabase/client'
import type {
  PhysicalAsset,
  PhysicalAssetInput,
  PhysicalAssetType,
  FinancingType,
  LoanRepaymentType,
  DebtInput,
  DebtType,
} from '@/types/tables'

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
  return data || []
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
  return data
}

export async function createPhysicalAsset(input: PhysicalAssetInput): Promise<PhysicalAsset> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('physical_assets')
    .insert({
      simulation_id: input.simulation_id,
      type: input.type,
      title: input.title,
      owner: input.owner || 'self',
      current_value: input.current_value,
      purchase_price: input.purchase_price,
      purchase_year: input.purchase_year,
      purchase_month: input.purchase_month,
      annual_rate: input.annual_rate ?? 0,
      has_loan: input.has_loan ?? false,
      financing_type: input.financing_type,
      loan_amount: input.loan_amount,
      loan_rate: input.loan_rate,
      loan_start_year: input.loan_start_year,
      loan_start_month: input.loan_start_month,
      loan_maturity_year: input.loan_maturity_year,
      loan_maturity_month: input.loan_maturity_month,
      loan_repayment_type: input.loan_repayment_type,
      sell_year: input.sell_year,
      sell_month: input.sell_month,
      memo: input.memo,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) throw error

  // 연동 항목 생성
  await syncLinkedDebt(data)

  return data
}

export async function updatePhysicalAsset(
  id: string,
  input: Partial<PhysicalAssetInput>
): Promise<PhysicalAsset> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('physical_assets')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // 연동 항목 재동기화
  await syncLinkedDebt(data)

  return data
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

  // 대출/할부가 있으면 부채 생성
  if (asset.has_loan && asset.loan_amount) {
    await createLinkedDebt(asset)
  }
}

async function deleteLinkedDebt(assetId: string): Promise<void> {
  const supabase = createClient()

  await supabase
    .from('debts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('source_type', 'physical_asset')
    .eq('source_id', assetId)
}

async function createLinkedDebt(asset: PhysicalAsset): Promise<void> {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // 부채 타입 결정
  const debtType: DebtType = asset.type === 'car' ? 'car' : 'other'

  // 대출/할부 라벨
  const financingLabel = asset.financing_type === 'loan' ? '대출' : '할부'

  // 할부는 항상 원리금균등상환
  const repaymentType: LoanRepaymentType = asset.financing_type === 'installment'
    ? '원리금균등상환'
    : (asset.loan_repayment_type || '원리금균등상환')

  const debtInput: DebtInput = {
    simulation_id: asset.simulation_id,
    type: debtType,
    title: `${asset.title} ${financingLabel}`,
    principal: asset.loan_amount!,
    current_balance: asset.loan_amount,
    interest_rate: asset.loan_rate || 5,
    rate_type: 'fixed',
    repayment_type: repaymentType,
    grace_period_months: 0,
    start_year: asset.loan_start_year || currentYear,
    start_month: asset.loan_start_month || currentMonth,
    maturity_year: asset.loan_maturity_year || currentYear + 5,
    maturity_month: asset.loan_maturity_month || currentMonth,
    source_type: 'physical_asset',
    source_id: asset.id,
  }

  await supabase.from('debts').insert(debtInput)
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
