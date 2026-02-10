/**
 * Snapshot → Simulation 데이터 복사 서비스
 *
 * 스냅샷의 현재 자산 상태를 시뮬레이션의 초기값으로 복사합니다.
 * - 복사는 one-time copy로, 이후 스냅샷 변경은 시뮬레이션에 반영되지 않음
 * - 시뮬레이션 데이터는 독립적으로 수정 가능
 */

import { createClient } from '@/lib/supabase/client'
import type {
  FinancialSnapshot,
  FinancialSnapshotItem,
} from '@/types/tables'
import { getLatestSnapshot, getSnapshotItems } from './snapshotService'

// ============================================
// 타입 정의
// ============================================

interface CopyResult {
  success: boolean
  copiedItems: {
    savings: number
    debts: number
    realEstates: number
    personalPensions: number
    incomes: number
    expenses: number
  }
  errors: string[]
}

// 스냅샷 item_type → 시뮬레이션 테이블 매핑
const ITEM_TYPE_TO_TABLE: Record<string, string> = {
  // 저축/투자 (snapshot item_type → savings 테이블)
  checking: 'savings',
  savings: 'savings',
  deposit: 'savings',
  emergency: 'savings',
  domestic_stock: 'savings',
  foreign_stock: 'savings',
  fund: 'savings',
  bond: 'savings',
  crypto: 'savings',
  etf: 'savings',

  // 부채 (snapshot item_type → debts 테이블)
  mortgage: 'debts',
  jeonse: 'debts',
  credit: 'debts',
  student: 'debts',
  card: 'debts',
  installment: 'debts',
  other_debt: 'debts',

  // 실물자산 → real_estates 또는 physical_assets
  real_estate: 'real_estates',
  residence: 'real_estates',
  land: 'real_estates',
  car: 'physical_assets',
  precious_metal: 'physical_assets',
  art: 'physical_assets',
}

// ============================================
// 메인 함수
// ============================================

/**
 * 최신 스냅샷의 데이터를 시뮬레이션에 복사
 * @param profileId 프로필 ID
 * @param simulationId 대상 시뮬레이션 ID
 * @param options 복사 옵션
 */
export async function copySnapshotToSimulation(
  profileId: string,
  simulationId: string,
  options: {
    clearExisting?: boolean // 기존 데이터 삭제 후 복사 (기본: false)
    categories?: ('savings' | 'debts' | 'real_estates')[] // 복사할 카테고리 (기본: 전체)
  } = {}
): Promise<CopyResult> {
  const { clearExisting = false, categories } = options
  const supabase = createClient()
  const result: CopyResult = {
    success: false,
    copiedItems: {
      savings: 0,
      debts: 0,
      realEstates: 0,
      personalPensions: 0,
      incomes: 0,
      expenses: 0,
    },
    errors: [],
  }

  try {
    // 1. 최신 스냅샷 조회
    const snapshot = await getLatestSnapshot(profileId)
    if (!snapshot) {
      result.errors.push('No snapshot found for profile')
      return result
    }

    // 2. 스냅샷 items 조회
    const items = await getSnapshotItems(snapshot.id)
    if (items.length === 0) {
      result.errors.push('Snapshot has no items')
      return result
    }

    // 3. 기존 데이터 삭제 (옵션)
    if (clearExisting) {
      const tablesToClear = categories || ['savings', 'debts', 'real_estates']
      for (const table of tablesToClear) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('simulation_id', simulationId)

        if (error) {
          result.errors.push(`Failed to clear ${table}: ${error.message}`)
        }
      }
    }

    // 4. 카테고리별 복사 (배치 INSERT로 최적화)
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    // 자산 항목 복사 (savings) - 배치 INSERT
    if (!categories || categories.includes('savings')) {
      const assetItems = items.filter(
        item => item.category === 'asset' && ['checking', 'savings', 'deposit', 'domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'etf', 'emergency'].includes(item.item_type)
      )

      if (assetItems.length > 0) {
        const savingsDataArray = assetItems.map(item =>
          mapAssetToSavings(item, simulationId, currentYear, currentMonth)
        )
        const { error } = await supabase.from('savings').insert(savingsDataArray)
        if (error) {
          result.errors.push(`Failed to copy savings: ${error.message}`)
        } else {
          result.copiedItems.savings = assetItems.length
        }
      }
    }

    // 부채 항목 복사 (debts) - 배치 INSERT
    if (!categories || categories.includes('debts')) {
      const debtItems = items.filter(item => item.category === 'debt')

      if (debtItems.length > 0) {
        const debtsDataArray = debtItems.map(item =>
          mapDebtToSimulation(item, simulationId, currentYear, currentMonth)
        )
        const { error } = await supabase.from('debts').insert(debtsDataArray)
        if (error) {
          result.errors.push(`Failed to copy debts: ${error.message}`)
        } else {
          result.copiedItems.debts = debtItems.length
        }
      }
    }

    // 연금 계좌 복사 (personal_pensions: ISA, 연금저축, IRP) - 배치 INSERT
    const pensionItems = items.filter(
      item => item.category === 'asset' && ['isa', 'pension_savings', 'irp'].includes(item.item_type)
    )

    if (pensionItems.length > 0) {
      // 기존 personal_pensions 삭제
      const { error: deletePensionError } = await supabase
        .from('personal_pensions')
        .delete()
        .eq('simulation_id', simulationId)

      if (deletePensionError) {
        result.errors.push(`Failed to clear personal_pensions: ${deletePensionError.message}`)
      }

      const pensionsDataArray = pensionItems.map(item =>
        mapPensionToPersonalPension(item, simulationId)
      )
      const { error } = await supabase.from('personal_pensions').insert(pensionsDataArray)
      if (error) {
        result.errors.push(`Failed to copy pensions: ${error.message}`)
      } else {
        result.copiedItems.personalPensions = pensionItems.length
      }
    }

    // 부동산 항목 복사 (real_estates) - 배치 INSERT
    if (!categories || categories.includes('real_estates')) {
      const realEstateItems = items.filter(
        item => item.category === 'asset' && ['real_estate', 'residence', 'land'].includes(item.item_type)
      )

      if (realEstateItems.length > 0) {
        const realEstatesDataArray = realEstateItems.map(item =>
          mapRealEstateToSimulation(item, simulationId, currentYear, currentMonth)
        )
        const { error } = await supabase.from('real_estates').insert(realEstatesDataArray)
        if (error) {
          result.errors.push(`Failed to copy real estates: ${error.message}`)
        } else {
          result.copiedItems.realEstates = realEstateItems.length
        }
      }
    }

    result.success = result.errors.length === 0

    console.log('[copySnapshotToSimulation] Complete:', {
      snapshotId: snapshot.id,
      simulationId,
      copiedItems: result.copiedItems,
      errors: result.errors.length,
    })

    return result
  } catch (error) {
    result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
    return result
  }
}

// ============================================
// 매핑 함수
// ============================================

function mapAssetToSavings(
  item: FinancialSnapshotItem,
  simulationId: string,
  currentYear: number,
  currentMonth: number
) {
  const metadata = item.metadata || {}

  // item_type → savings type 매핑
  const typeMapping: Record<string, string> = {
    checking: 'checking',
    savings: 'savings',
    deposit: 'deposit',
    emergency: 'checking',
    domestic_stock: 'domestic_stock',
    foreign_stock: 'foreign_stock',
    fund: 'fund',
    bond: 'bond',
    crypto: 'crypto',
    etf: 'fund',
  }

  return {
    simulation_id: simulationId,
    type: typeMapping[item.item_type] || 'other',
    title: item.title,
    broker_name: metadata.broker_name || null,
    owner: item.owner || 'self',
    current_balance: item.amount,
    monthly_contribution: metadata.monthly_contribution || null,
    interest_rate: metadata.interest_rate || null,
    expected_return: metadata.expected_return || null,
    contribution_start_year: currentYear,
    contribution_start_month: currentMonth,
    is_active: true,
    sort_order: item.sort_order || 0,
  }
}

function mapPensionToPersonalPension(
  item: FinancialSnapshotItem,
  simulationId: string,
) {
  const metadata = item.metadata || {}

  // item_type → pension_type 매핑
  const typeMapping: Record<string, string> = {
    pension_savings: 'pension_savings',
    irp: 'irp',
    isa: 'isa',
  }

  return {
    simulation_id: simulationId,
    owner: item.owner === 'joint' ? 'self' : (item.owner || 'self'),
    pension_type: typeMapping[item.item_type] || item.item_type,
    title: item.title,
    broker_name: metadata.broker_name || null,
    current_balance: item.amount, // 원 단위 그대로
    monthly_contribution: metadata.monthly_contribution || null,
    is_contribution_fixed_to_retirement: true,
    start_age: metadata.start_age || 55,
    receiving_years: metadata.receiving_years || 20,
    return_rate: metadata.expected_return || 5.0,
    isa_maturity_year: item.item_type === 'isa' ? (metadata.maturity_year || null) : null,
    isa_maturity_month: item.item_type === 'isa' ? (metadata.maturity_month || null) : null,
    isa_maturity_strategy: item.item_type === 'isa' ? (metadata.maturity_strategy || 'pension_savings') : null,
    is_active: true,
  }
}

function mapDebtToSimulation(
  item: FinancialSnapshotItem,
  simulationId: string,
  currentYear: number,
  currentMonth: number
) {
  const metadata = item.metadata || {}

  // item_type → debt type 매핑
  const typeMapping: Record<string, string> = {
    mortgage: 'mortgage',
    jeonse: 'jeonse',
    credit: 'credit',
    student: 'student',
    card: 'card',
    installment: 'installment',
    other: 'other',
  }

  // 만기 연월 계산 (메타데이터에 있으면 사용, 없으면 현재년도 + 10년)
  const maturityYear = metadata.loan_maturity_year || metadata.maturity_year || currentYear + 10
  const maturityMonth = metadata.loan_maturity_month || metadata.maturity_month || 12

  return {
    simulation_id: simulationId,
    type: typeMapping[item.item_type] || 'other',
    title: item.title,
    principal: metadata.principal || item.amount,
    current_balance: item.amount,
    interest_rate: metadata.loan_rate || metadata.interest_rate || 5.0,
    rate_type: metadata.rate_type || 'fixed',
    repayment_type: metadata.loan_repayment_type || metadata.repayment_type || '원리금균등상환',
    start_year: metadata.start_year || currentYear,
    start_month: metadata.start_month || currentMonth,
    maturity_year: maturityYear,
    maturity_month: maturityMonth,
    is_active: true,
    sort_order: item.sort_order || 0,
  }
}

function mapRealEstateToSimulation(
  item: FinancialSnapshotItem,
  simulationId: string,
  currentYear: number,
  currentMonth: number
) {
  const metadata = item.metadata || {}

  // item_type → real_estate type 매핑
  const typeMapping: Record<string, string> = {
    real_estate: 'residence',
    residence: 'residence',
    land: 'land',
  }

  return {
    simulation_id: simulationId,
    type: typeMapping[item.item_type] || 'residence',
    title: item.title,
    owner: item.owner || 'self',
    current_value: item.amount,
    purchase_price: metadata.purchase_price || item.amount,
    purchase_year: metadata.purchase_year || currentYear,
    purchase_month: metadata.purchase_month || currentMonth,
    growth_rate: metadata.growth_rate || 3.0,
    housing_type: metadata.housing_type || '자가',
    deposit: metadata.deposit || null,
    monthly_rent: metadata.monthly_rent || null,
    has_loan: metadata.has_loan || false,
    loan_amount: metadata.loan_amount || null,
    loan_rate: metadata.loan_rate || null,
    is_active: true,
    sort_order: item.sort_order || 0,
  }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 시뮬레이션에 스냅샷 데이터가 이미 복사되었는지 확인
 */
export async function hasSimulationData(simulationId: string): Promise<boolean> {
  const supabase = createClient()

  // savings, debts, real_estates 중 하나라도 데이터가 있으면 true
  const [savingsRes, debtsRes, realEstatesRes] = await Promise.all([
    supabase.from('savings').select('id', { count: 'exact', head: true }).eq('simulation_id', simulationId),
    supabase.from('debts').select('id', { count: 'exact', head: true }).eq('simulation_id', simulationId),
    supabase.from('real_estates').select('id', { count: 'exact', head: true }).eq('simulation_id', simulationId),
  ])

  const totalCount =
    (savingsRes.count || 0) +
    (debtsRes.count || 0) +
    (realEstatesRes.count || 0)

  return totalCount > 0
}

/**
 * 스냅샷 요약 정보를 시뮬레이션 설명으로 포맷
 */
export function formatSnapshotSummary(snapshot: FinancialSnapshot): string {
  const formatMoney = (amount: number) => {
    if (amount >= 10000) {
      const uk = Math.floor(amount / 10000)
      const man = amount % 10000
      return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`
    }
    return `${amount.toLocaleString()}만`
  }

  return `기준일: ${snapshot.recorded_at} | 순자산: ${formatMoney(snapshot.net_worth)}원`
}
