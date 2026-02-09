import { createClient } from '@/lib/supabase/client'
import type { Simulation, SimulationInput } from '@/types'
import type { AccountType, SavingsType } from '@/types/tables'

// 은행 계좌 타입
const BANK_ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'deposit', 'free_savings', 'housing']

// 일반 투자 계좌 타입 (절세계좌 제외)
const INVESTMENT_ACCOUNT_TYPES: AccountType[] = ['general']

// 절세 계좌 타입 (personal_pensions에만 저장)
const PENSION_ACCOUNT_TYPES: AccountType[] = ['pension_savings', 'irp', 'isa']

// 퇴직연금 계좌 타입 (retirement_pensions에 저장)
const RETIREMENT_PENSION_TYPES: AccountType[] = ['dc']

// AccountType → SavingsType 매핑 (절세계좌 제외)
const ACCOUNT_TO_SAVINGS_TYPE: Partial<Record<AccountType, SavingsType>> = {
  checking: 'checking',
  savings: 'savings',
  deposit: 'deposit',
  free_savings: 'savings',
  housing: 'housing',
  general: 'domestic_stock',
}

// AccountType → PersonalPensionType 매핑
const ACCOUNT_TO_PENSION_TYPE: Partial<Record<AccountType, string>> = {
  pension_savings: 'pension_savings',
  irp: 'irp',
  isa: 'isa',
}

/**
 * 시뮬레이션 서비스
 * simulations 테이블 CRUD
 */
export const simulationService = {
  // 사용자의 모든 시뮬레이션 조회
  async getAll(): Promise<Simulation[]> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('profile_id', user.id)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
  },

  // 기본 시뮬레이션 조회 (없으면 생성)
  async getDefault(): Promise<Simulation> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    return this.getDefaultByUserId(user.id)
  },

  // 특정 유저의 기본 시뮬레이션 조회 (없으면 생성)
  async getDefaultByUserId(userId: string): Promise<Simulation> {
    const supabase = createClient()

    // 기본 시뮬레이션 조회 (maybeSingle은 없으면 null 반환)
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('profile_id', userId)
      .eq('is_default', true)
      .maybeSingle()

    if (error) throw error
    if (data) return data

    // 없으면 생성
    return this.create({
      profile_id: userId,
      title: '은퇴',
      is_default: true,
      sort_order: 0,
    })
  },

  // 시뮬레이션 생성
  async create(input: Omit<SimulationInput, 'profile_id'> & { profile_id?: string }): Promise<Simulation> {
    const supabase = createClient()

    // profile_id가 없으면 현재 사용자 ID 사용
    let profileId = input.profile_id
    if (!profileId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      profileId = user.id
    }

    const { data, error } = await supabase
      .from('simulations')
      .insert({
        profile_id: profileId,
        title: input.title,
        description: input.description,
        is_default: input.is_default ?? false,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single()

    if (error) throw error

    // 시뮬레이션 생성 후 현재 계좌 데이터 복사
    await this.copyAccountsToSimulation(data.id, profileId)

    return data
  },

  /**
   * 현재 계좌 데이터를 시뮬레이션에 복사
   * accounts 테이블의 current_balance를 그대로 사용 (이미 원 단위)
   * @param accountValues Map이 전달되면 해당 값을 우선 사용
   */
  async copyAccountsToSimulation(
    simulationId: string,
    profileId: string,
    investmentAccountValues?: Map<string, number>,
    savingsAccountValues?: Map<string, number>
  ): Promise<void> {
    const supabase = createClient()

    // 1. 기존 데이터 삭제
    await Promise.all([
      supabase.from('savings').delete().eq('simulation_id', simulationId),
      supabase.from('personal_pensions').delete().eq('simulation_id', simulationId),
      supabase.from('retirement_pensions').delete().eq('simulation_id', simulationId),
    ])

    // 2. 현재 활성 계좌 가져오기
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_active', true)

    if (accountsError || !accounts?.length) {
      return
    }

    // 계좌 잔액 가져오기 (Map 값 우선, 없으면 accounts.current_balance 사용)
    const getBalance = (accountId: string, defaultBalance: number, isInvestment: boolean): number => {
      if (isInvestment && investmentAccountValues?.has(accountId)) {
        return investmentAccountValues.get(accountId)!
      }
      if (!isInvestment && savingsAccountValues?.has(accountId)) {
        return savingsAccountValues.get(accountId)!
      }
      return defaultBalance || 0
    }

    // 3. 은행 + 일반투자 계좌 → savings 테이블
    const bankAccounts = accounts.filter(acc => BANK_ACCOUNT_TYPES.includes(acc.account_type as AccountType))
    const investmentAccounts = accounts.filter(acc => INVESTMENT_ACCOUNT_TYPES.includes(acc.account_type as AccountType))

    const savingsData = [
      ...bankAccounts.map((acc, idx) => ({
        simulation_id: simulationId,
        type: ACCOUNT_TO_SAVINGS_TYPE[acc.account_type as AccountType] || 'other',
        title: acc.name,
        broker_name: acc.broker_name || null,
        owner: 'self' as const,
        current_balance: getBalance(acc.id, acc.current_balance, false),
        interest_rate: acc.interest_rate ? Number(acc.interest_rate) : null,
        maturity_year: acc.maturity_year || null,
        maturity_month: acc.maturity_month || null,
        is_tax_free: acc.is_tax_free || false,
        monthly_contribution: acc.monthly_contribution || null,
        expected_return: null,
        sort_order: idx,
      })),
      ...investmentAccounts.map((acc, idx) => ({
        simulation_id: simulationId,
        type: ACCOUNT_TO_SAVINGS_TYPE[acc.account_type as AccountType] || 'other',
        title: acc.name,
        broker_name: acc.broker_name || null,
        owner: 'self' as const,
        current_balance: getBalance(acc.id, acc.current_balance, true),
        interest_rate: null,
        maturity_year: null,
        maturity_month: null,
        is_tax_free: acc.is_tax_free || false,
        monthly_contribution: null,
        expected_return: null,
        sort_order: bankAccounts.length + idx,
      })),
    ]

    if (savingsData.length > 0) {
      await supabase.from('savings').insert(savingsData)
    }

    // 4. 절세 계좌 → personal_pensions 테이블
    const pensionAccounts = accounts.filter(acc => PENSION_ACCOUNT_TYPES.includes(acc.account_type as AccountType))

    if (pensionAccounts.length > 0) {
      const pensionData = pensionAccounts.map(acc => ({
        simulation_id: simulationId,
        owner: 'self' as const,
        pension_type: ACCOUNT_TO_PENSION_TYPE[acc.account_type as AccountType]!,
        title: acc.name,
        broker_name: acc.broker_name || null,
        current_balance: getBalance(acc.id, acc.current_balance, true),
        monthly_contribution: acc.monthly_contribution || null,
        is_contribution_fixed_to_retirement: true,
        start_age: 55,
        receiving_years: 20,
        return_rate: 5.0,
        isa_maturity_year: acc.account_type === 'isa' ? acc.maturity_year : null,
        isa_maturity_month: acc.account_type === 'isa' ? acc.maturity_month : null,
        isa_maturity_strategy: acc.account_type === 'isa' ? 'pension_savings' : null,
      }))

      await supabase.from('personal_pensions').insert(pensionData)
    }

    // 5. DC형 퇴직연금 → retirement_pensions 테이블
    const dcAccounts = accounts.filter(acc => RETIREMENT_PENSION_TYPES.includes(acc.account_type as AccountType))

    if (dcAccounts.length > 0) {
      const retirementPensionData = dcAccounts.map(acc => ({
        simulation_id: simulationId,
        owner: 'self' as const,
        pension_type: 'dc' as const,
        title: acc.name,
        broker_name: acc.broker_name || null,
        current_balance: getBalance(acc.id, acc.current_balance, true),
        receive_type: 'annuity' as const,
        start_age: 55,
        receiving_years: 20,
        return_rate: 5.0,
      }))

      await supabase.from('retirement_pensions').insert(retirementPensionData)
    }
  },

  // 시뮬레이션 업데이트
  async update(id: string, updates: Partial<SimulationInput>): Promise<Simulation> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('simulations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 시뮬레이션 삭제
  async delete(id: string): Promise<void> {
    const supabase = createClient()

    const { error } = await supabase
      .from('simulations')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}

export default simulationService
