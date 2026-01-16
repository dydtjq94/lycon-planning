import { createClient } from '@/lib/supabase/client'
import type {
  RealEstate,
  RealEstateInput,
  RealEstateType,
  HousingType,
  LoanRepaymentType,
  OwnerWithCommon,
  DebtType,
  DebtInput,
  IncomeInput,
  ExpenseInput,
} from '@/types/tables'

// ============================================
// 부동산 CRUD
// ============================================

export async function getRealEstates(simulationId: string): Promise<RealEstate[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('real_estates')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getRealEstateById(id: string): Promise<RealEstate | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('real_estates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function createRealEstate(input: RealEstateInput): Promise<RealEstate> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('real_estates')
    .insert({
      simulation_id: input.simulation_id,
      type: input.type,
      title: input.title,
      owner: input.owner || 'self',
      current_value: input.current_value,
      purchase_price: input.purchase_price,
      purchase_year: input.purchase_year,
      purchase_month: input.purchase_month,
      growth_rate: input.growth_rate ?? 3,
      housing_type: input.housing_type,
      deposit: input.deposit,
      monthly_rent: input.monthly_rent,
      maintenance_fee: input.maintenance_fee,
      has_rental_income: input.has_rental_income ?? false,
      rental_deposit: input.rental_deposit,
      rental_monthly: input.rental_monthly,
      rental_start_year: input.rental_start_year,
      rental_start_month: input.rental_start_month,
      rental_end_year: input.rental_end_year,
      rental_end_month: input.rental_end_month,
      has_loan: input.has_loan ?? false,
      loan_amount: input.loan_amount,
      loan_rate: input.loan_rate,
      loan_rate_type: input.loan_rate_type,
      loan_spread: input.loan_spread,
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
  await syncLinkedItems(data)

  return data
}

export async function updateRealEstate(
  id: string,
  input: Partial<RealEstateInput>
): Promise<RealEstate> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('real_estates')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // 연동 항목 재동기화
  await syncLinkedItems(data)

  return data
}

export async function deleteRealEstate(id: string): Promise<void> {
  const supabase = createClient()

  // 연동된 항목들 먼저 삭제
  await deleteLinkedItems(id)

  // 부동산 삭제 (soft delete)
  const { error } = await supabase
    .from('real_estates')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// ============================================
// 연동 항목 관리
// ============================================

async function syncLinkedItems(realEstate: RealEstate): Promise<void> {
  // 기존 연동 항목 삭제
  await deleteLinkedItems(realEstate.id)

  // 대출이 있으면 부채 생성
  if (realEstate.has_loan && realEstate.loan_amount) {
    await createLinkedDebt(realEstate)
  }

  // 임대 수익이 있으면 소득 생성
  if (realEstate.has_rental_income && realEstate.rental_monthly) {
    await createLinkedIncome(realEstate)
  }

  // 월세 거주면 지출 생성
  if (realEstate.type === 'residence' && realEstate.housing_type === '월세' && realEstate.monthly_rent) {
    await createLinkedRentExpense(realEstate)
  }

  // 관리비가 있으면 지출 생성
  if (realEstate.maintenance_fee) {
    await createLinkedMaintenanceExpense(realEstate)
  }
}

async function deleteLinkedItems(realEstateId: string): Promise<void> {
  const supabase = createClient()

  // 연동된 부채 삭제
  await supabase
    .from('debts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('source_type', 'real_estate')
    .eq('source_id', realEstateId)

  // 연동된 소득 삭제
  await supabase
    .from('incomes')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('source_type', 'real_estate')
    .eq('source_id', realEstateId)

  // 연동된 지출 삭제
  await supabase
    .from('expenses')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('source_type', 'real_estate')
    .eq('source_id', realEstateId)
}

async function createLinkedDebt(realEstate: RealEstate): Promise<void> {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // 부채 타입 결정: 자가=주담대(mortgage), 전세/월세=전월세 보증금 대출(jeonse)
  let debtType: DebtType = 'mortgage'
  if (realEstate.housing_type === '전세' || realEstate.housing_type === '월세') {
    debtType = 'jeonse'
  }

  // 대출명 결정
  const loanTitle = realEstate.housing_type === '자가'
    ? `${realEstate.title} 주담대`
    : `${realEstate.title} 전월세 보증금 대출`

  const debtInput: DebtInput = {
    simulation_id: realEstate.simulation_id,
    type: debtType,
    title: loanTitle,
    principal: realEstate.loan_amount!,
    current_balance: realEstate.loan_amount,
    interest_rate: realEstate.loan_rate || 4,
    rate_type: realEstate.loan_rate_type || 'fixed',
    spread: realEstate.loan_spread,
    repayment_type: realEstate.loan_repayment_type || '원리금균등상환',
    grace_period_months: 0,
    start_year: realEstate.loan_start_year || currentYear,
    start_month: realEstate.loan_start_month || currentMonth,
    maturity_year: realEstate.loan_maturity_year || currentYear + 30,
    maturity_month: realEstate.loan_maturity_month || currentMonth,
    source_type: 'real_estate',
    source_id: realEstate.id,
  }

  await supabase.from('debts').insert(debtInput)
}

async function createLinkedIncome(realEstate: RealEstate): Promise<void> {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const ownerMapping: Record<OwnerWithCommon, 'self' | 'spouse'> = {
    self: 'self',
    spouse: 'spouse',
    common: 'self', // 공동 소유는 본인으로 처리
  }

  const incomeInput: IncomeInput = {
    simulation_id: realEstate.simulation_id,
    type: 'rental',
    title: `${realEstate.title} 임대`,
    owner: ownerMapping[realEstate.owner],
    amount: realEstate.rental_monthly!,
    frequency: 'monthly',
    start_year: realEstate.rental_start_year || currentYear,
    start_month: realEstate.rental_start_month || currentMonth,
    end_year: realEstate.rental_end_year,
    end_month: realEstate.rental_end_month,
    is_fixed_to_retirement: false,
    growth_rate: 2,
    rate_category: 'realEstate',
    source_type: 'real_estate',
    source_id: realEstate.id,
  }

  await supabase.from('incomes').insert(incomeInput)
}

async function createLinkedRentExpense(realEstate: RealEstate): Promise<void> {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const expenseInput: ExpenseInput = {
    simulation_id: realEstate.simulation_id,
    type: 'housing',
    title: `${realEstate.title} 월세`,
    amount: realEstate.monthly_rent!,
    frequency: 'monthly',
    start_year: currentYear,
    start_month: currentMonth,
    end_year: null,
    end_month: null,
    is_fixed_to_retirement: false,
    growth_rate: 2,
    rate_category: 'realEstate',
    source_type: 'real_estate',
    source_id: realEstate.id,
  }

  await supabase.from('expenses').insert(expenseInput)
}

async function createLinkedMaintenanceExpense(realEstate: RealEstate): Promise<void> {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const expenseInput: ExpenseInput = {
    simulation_id: realEstate.simulation_id,
    type: 'housing',
    title: `${realEstate.title} 관리비`,
    amount: realEstate.maintenance_fee!,
    frequency: 'monthly',
    start_year: currentYear,
    start_month: currentMonth,
    end_year: null,
    end_month: null,
    is_fixed_to_retirement: false,
    growth_rate: 2,
    rate_category: 'inflation',
    source_type: 'real_estate',
    source_id: realEstate.id,
  }

  await supabase.from('expenses').insert(expenseInput)
}

// ============================================
// 거주용 부동산 Upsert
// ============================================

export async function upsertResidenceRealEstate(
  simulationId: string,
  input: {
    housing_type: HousingType | null
    current_value: number
    purchase_price?: number | null
    purchase_year?: number | null
    purchase_month?: number | null
    deposit?: number | null
    monthly_rent?: number | null
    maintenance_fee?: number | null
    has_loan?: boolean
    loan_amount?: number | null
    loan_rate?: number | null
    loan_start_year?: number | null
    loan_start_month?: number | null
    loan_maturity_year?: number | null
    loan_maturity_month?: number | null
    loan_repayment_type?: LoanRepaymentType | null
  }
): Promise<RealEstate | null> {
  const supabase = createClient()

  // 거주용 부동산이 없거나 해당없음이면 삭제
  if (!input.housing_type || input.housing_type === '해당없음' as unknown) {
    // 기존 거주용 부동산 찾기
    const { data: existing } = await supabase
      .from('real_estates')
      .select('id')
      .eq('simulation_id', simulationId)
      .eq('type', 'residence')
      .eq('is_active', true)
      .single()

    if (existing) {
      await deleteRealEstate(existing.id)
    }
    return null
  }

  // 기존 거주용 부동산 찾기
  const { data: existing } = await supabase
    .from('real_estates')
    .select('*')
    .eq('simulation_id', simulationId)
    .eq('type', 'residence')
    .eq('is_active', true)
    .single()

  const realEstateInput: RealEstateInput = {
    simulation_id: simulationId,
    type: 'residence',
    title: input.housing_type === '자가' ? '자가 주택' : input.housing_type === '전세' ? '전세 주택' : '월세 주택',
    owner: 'self',
    current_value: input.current_value,
    purchase_price: input.purchase_price,
    purchase_year: input.purchase_year,
    purchase_month: input.purchase_month,
    housing_type: input.housing_type,
    deposit: input.housing_type !== '자가' ? input.deposit || input.current_value : null,
    monthly_rent: input.monthly_rent,
    maintenance_fee: input.maintenance_fee,
    has_loan: input.has_loan,
    loan_amount: input.loan_amount,
    loan_rate: input.loan_rate,
    loan_start_year: input.loan_start_year,
    loan_start_month: input.loan_start_month,
    loan_maturity_year: input.loan_maturity_year,
    loan_maturity_month: input.loan_maturity_month,
    loan_repayment_type: input.loan_repayment_type,
  }

  if (existing) {
    return updateRealEstate(existing.id, realEstateInput)
  } else {
    return createRealEstate(realEstateInput)
  }
}

// ============================================
// 유틸리티
// ============================================

export const REAL_ESTATE_TYPE_LABELS: Record<RealEstateType, string> = {
  residence: '거주용',
  investment: '투자용',
  rental: '임대용',
  land: '토지',
}

export const HOUSING_TYPE_LABELS: Record<HousingType, string> = {
  '자가': '자가',
  '전세': '전세',
  '월세': '월세',
  '무상': '무상 거주',
}

export const REPAYMENT_TYPE_LABELS: Record<LoanRepaymentType, string> = {
  '만기일시상환': '만기일시',
  '원리금균등상환': '원리금균등',
  '원금균등상환': '원금균등',
  '거치식상환': '거치식',
}
