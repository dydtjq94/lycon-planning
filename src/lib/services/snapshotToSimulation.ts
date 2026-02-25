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
    physicalAssets: number
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
  other_asset: 'physical_assets',
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
    categories?: ('savings' | 'debts' | 'real_estates' | 'physical_assets')[] // 복사할 카테고리 (기본: 전체)
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
      physicalAssets: 0,
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
      const tablesToClear = categories || ['savings', 'debts', 'real_estates', 'physical_assets']
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
        item => item.category === 'asset' && ['checking', 'savings', 'deposit', 'domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'etf', 'emergency', 'other'].includes(item.item_type)
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
        item => item.category === 'asset' && ['real_estate', 'residence', 'land', 'apartment', 'house', 'officetel', 'commercial'].includes(item.item_type)
      )

      if (realEstateItems.length > 0) {
        const realEstatesDataArray = realEstateItems.map(item =>
          mapRealEstateToSimulation(item, simulationId, currentYear, currentMonth)
        )
        const { data: insertedRealEstates, error } = await supabase
          .from('real_estates')
          .insert(realEstatesDataArray)
          .select()
        if (error) {
          result.errors.push(`Failed to copy real estates: ${error.message}`)
        } else {
          result.copiedItems.realEstates = realEstateItems.length

          // 부동산 연동 항목 생성 (대출→부채, 임대→소득)
          if (insertedRealEstates) {
            for (const re of insertedRealEstates) {
              await createLinkedItemsForRealEstate(re, supabase)
            }
          }
        }
      }
    }

    // 실물자산 항목 복사 (physical_assets) - 배치 INSERT
    if (!categories || categories.includes('physical_assets')) {
      const physicalAssetItems = items.filter(
        item => item.category === 'asset' && ['car', 'precious_metal', 'art', 'other_asset'].includes(item.item_type)
      )

      if (physicalAssetItems.length > 0) {
        // 기존 physical_assets 삭제
        const { error: deletePhysicalError } = await supabase
          .from('physical_assets')
          .delete()
          .eq('simulation_id', simulationId)

        if (deletePhysicalError) {
          result.errors.push(`Failed to clear physical_assets: ${deletePhysicalError.message}`)
        }

        const physicalAssetsDataArray = physicalAssetItems.map(item =>
          mapPhysicalAssetToSimulation(item, simulationId, currentYear, currentMonth)
        )
        const { error } = await supabase.from('physical_assets').insert(physicalAssetsDataArray)
        if (error) {
          result.errors.push(`Failed to copy physical assets: ${error.message}`)
        } else {
          result.copiedItems.physicalAssets = physicalAssetItems.length
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

  const startYear = (metadata.start_year as number) || currentYear
  const startMonth = (metadata.start_month as number) || currentMonth

  // 거치기간 계산: grace_period_year/month (절대 연/월) → grace_period_months (상대 개월 수)
  let gracePeriodMonths = 0
  const graceYear = metadata.grace_period_year as number | undefined
  const graceMonth = metadata.grace_period_month as number | undefined
  if (graceYear && graceMonth) {
    gracePeriodMonths = (graceYear - startYear) * 12 + (graceMonth - startMonth)
    if (gracePeriodMonths < 0) gracePeriodMonths = 0
  }

  return {
    simulation_id: simulationId,
    type: typeMapping[item.item_type] || 'other',
    title: item.title,
    principal: metadata.principal || item.amount,
    current_balance: item.amount,
    interest_rate: metadata.loan_rate || metadata.interest_rate || 5.0,
    rate_type: metadata.rate_type || 'fixed',
    repayment_type: metadata.loan_repayment_type || metadata.repayment_type || '원리금균등상환',
    grace_period_months: gracePeriodMonths,
    start_year: startYear,
    start_month: startMonth,
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
    apartment: 'investment',
    house: 'investment',
    officetel: 'investment',
    commercial: 'rental',
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
    deposit: metadata.deposit || (metadata.housing_type === '전세' || metadata.housing_type === '월세' ? item.amount : null),
    monthly_rent: metadata.monthly_rent || null,
    maintenance_fee: metadata.maintenance_fee || null,
    has_loan: metadata.has_loan || false,
    loan_amount: metadata.loan_amount || null,
    loan_rate: metadata.loan_rate || null,
    loan_start_year: metadata.loan_start_year || metadata.purchase_year || currentYear,
    loan_start_month: metadata.loan_start_month || metadata.purchase_month || currentMonth,
    loan_maturity_year: metadata.loan_maturity_year || null,
    loan_maturity_month: metadata.loan_maturity_month || null,
    loan_repayment_type: metadata.loan_repayment_type || null,
    grace_end_year: metadata.grace_period_year || null,
    grace_end_month: metadata.grace_period_month || null,
    is_active: true,
    sort_order: item.sort_order || 0,
  }
}

function mapPhysicalAssetToSimulation(
  item: FinancialSnapshotItem,
  simulationId: string,
  currentYear: number,
  currentMonth: number
) {
  const metadata = item.metadata || {}

  // item_type → physical_asset type 매핑
  const typeMapping: Record<string, string> = {
    car: 'car',
    precious_metal: 'precious_metal',
    art: 'art',
    other_asset: 'other',
  }

  // 담보대출 또는 할부 → 동일한 loan 필드로 매핑
  const hasLoan = metadata.has_loan || false
  const hasInstallment = metadata.has_installment || false
  const hasFinancing = hasLoan || hasInstallment
  const financingType = hasInstallment ? 'installment' : hasLoan ? 'loan' : null

  // 할부인 경우 installment_ 필드에서, 담보대출인 경우 loan_ 필드에서 가져옴
  const loanAmount = hasInstallment
    ? (metadata.installment_remaining || null)
    : (metadata.loan_amount || null)
  const loanRate = hasInstallment
    ? (metadata.installment_rate || null)
    : (metadata.loan_rate || null)
  const loanMaturityYear = hasInstallment
    ? (metadata.installment_end_year || null)
    : (metadata.loan_maturity_year || null)
  const loanMaturityMonth = hasInstallment
    ? (metadata.installment_end_month || null)
    : (metadata.loan_maturity_month || null)
  const loanRepaymentType = hasInstallment
    ? '원리금균등상환'
    : (metadata.loan_repayment_type || null)

  return {
    simulation_id: simulationId,
    type: typeMapping[item.item_type] || 'other',
    title: item.title,
    owner: item.owner || 'self',
    current_value: item.amount,
    purchase_price: metadata.purchase_price || item.amount,
    purchase_year: metadata.purchase_year || currentYear,
    purchase_month: metadata.purchase_month || currentMonth,
    annual_rate: metadata.annual_rate ?? metadata.growth_rate ?? (typeMapping[item.item_type] === 'car' ? -5 : 5),
    rate_category: 'fixed',
    has_loan: hasFinancing,
    financing_type: financingType,
    loan_amount: loanAmount,
    loan_rate: loanRate,
    loan_start_year: metadata.loan_start_year || metadata.purchase_year || currentYear,
    loan_start_month: metadata.loan_start_month || metadata.purchase_month || currentMonth,
    loan_maturity_year: loanMaturityYear,
    loan_maturity_month: loanMaturityMonth,
    loan_repayment_type: loanRepaymentType,
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

// ============================================
// 부동산 연동 항목 생성
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createLinkedItemsForRealEstate(realEstate: any, supabase: any): Promise<void> {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // 대출 → 부채
  if (realEstate.has_loan && realEstate.loan_amount) {
    const debtType = (realEstate.housing_type === '전세' || realEstate.housing_type === '월세') ? 'jeonse' : 'mortgage'
    const loanTitle = realEstate.housing_type === '자가'
      ? `${realEstate.title} 주담대`
      : `${realEstate.title} 전월세 보증금 대출`

    await supabase.from('debts').insert({
      simulation_id: realEstate.simulation_id,
      type: debtType,
      title: loanTitle,
      principal: realEstate.loan_amount,
      current_balance: realEstate.loan_amount,
      interest_rate: realEstate.loan_rate || 4,
      rate_type: realEstate.loan_rate_type || 'fixed',
      repayment_type: realEstate.loan_repayment_type || '원리금균등상환',
      start_year: realEstate.loan_start_year || currentYear,
      start_month: realEstate.loan_start_month || currentMonth,
      maturity_year: realEstate.loan_maturity_year || currentYear + 30,
      maturity_month: realEstate.loan_maturity_month || currentMonth,
      source_type: 'real_estate',
      source_id: realEstate.id,
    })
  }

  // 임대 수익 → 소득
  if (realEstate.has_rental_income && realEstate.rental_monthly) {
    await supabase.from('incomes').insert({
      simulation_id: realEstate.simulation_id,
      type: 'rental',
      title: `${realEstate.title} 임대`,
      owner: realEstate.owner === 'common' ? 'self' : (realEstate.owner || 'self'),
      amount: realEstate.rental_monthly,
      frequency: 'monthly',
      start_year: realEstate.rental_start_year || currentYear,
      start_month: realEstate.rental_start_month || currentMonth,
      end_year: realEstate.rental_end_year || null,
      end_month: realEstate.rental_end_month || null,
      growth_rate: 2,
      rate_category: 'realEstate',
      source_type: 'real_estate',
      source_id: realEstate.id,
    })
  }

  // 월세/관리비는 V2 엔진이 부동산 데이터에서 직접 계산하므로 별도 지출 항목 생성하지 않음
}
