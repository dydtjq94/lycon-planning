import { createClient } from '@/lib/supabase/client'
import type { Simulation, SimulationInput } from '@/types'
import type { AccountType, SavingsType } from '@/types/tables'
import { calculatePortfolioAccountValues, fetchPortfolioPrices, calculateAccountTransactionSummary, calculateExpectedBalance, calculateTermDepositValue } from '@/lib/utils/accountValueCalculator'
import { copySnapshotToSimulation } from './snapshotToSimulation'

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
  async getAll(profileId?: string): Promise<Simulation[]> {
    const supabase = createClient()

    let userId = profileId
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      userId = user.id
    }

    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('profile_id', userId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
  },

  // 기본 시뮬레이션 조회 (없으면 null)
  async getDefault(): Promise<Simulation | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    return this.getDefaultByUserId(user.id)
  },

  // 특정 유저의 기본 시뮬레이션 조회 (없으면 null)
  async getDefaultByUserId(userId: string): Promise<Simulation | null> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('profile_id', userId)
      .eq('is_default', true)
      .maybeSingle()

    if (error) throw error
    return data
  },

  // 시뮬레이션 생성 (빠르게 - 레코드만 생성)
  async create(input: Omit<SimulationInput, 'profile_id'> & { profile_id?: string }): Promise<Simulation> {
    const supabase = createClient()

    // profile_id가 없으면 현재 사용자 ID 사용
    let profileId = input.profile_id
    if (!profileId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      profileId = user.id
    }

    const now = new Date()

    // sort_order가 지정되지 않으면 맨 뒤에 배치
    let sortOrder = input.sort_order
    if (sortOrder === undefined || sortOrder === null) {
      const { count } = await supabase
        .from('simulations')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
      sortOrder = count ?? 0
    }

    const { data, error } = await supabase
      .from('simulations')
      .insert({
        profile_id: profileId,
        title: input.title,
        description: input.description,
        is_default: input.is_default ?? false,
        sort_order: sortOrder,
        start_year: input.start_year ?? now.getFullYear(),
        start_month: input.start_month ?? (now.getMonth() + 1),
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 시뮬레이션 데이터 초기화 (느린 작업 - 백그라운드에서 실행)
  async initializeSimulationData(simulationId: string, profileId: string): Promise<void> {
    const supabase = createClient()

    // 기본 시뮬레이션 찾기 (복사 원본)
    const { data: defaultSim } = await supabase
      .from('simulations')
      .select('id')
      .eq('profile_id', profileId)
      .eq('is_default', true)
      .maybeSingle()

    // 현재 계좌 데이터 복사 (실시간 가격 반영)
    const { investmentValues, savingsValues } = await this.calculateCurrentAccountValues(profileId)
    await this.copyAccountsToSimulation(simulationId, profileId, investmentValues, savingsValues)

    // 기본 시뮬레이션에서 나머지 데이터 복사
    if (defaultSim && defaultSim.id !== simulationId) {
      await this.copySimulationData(defaultSim.id, simulationId)
    }

    // 스냅샷에서 부동산/부채/실물자산 복사 (시뮬레이션에 없는 데이터만)
    await this.copyMissingDataFromSnapshot(simulationId, profileId)

    // 동기화 시간 기록
    await supabase
      .from('simulations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', simulationId)
  },

  /**
   * 기존 시뮬레이션에서 재무 데이터를 새 시뮬레이션으로 복사
   * 복사 대상: incomes, expenses, debts, real_estates, physical_assets, insurances, national_pensions
   * (savings, personal_pensions, retirement_pensions는 copyAccountsToSimulation에서 처리)
   */
  async copySimulationData(sourceSimulationId: string, targetSimulationId: string): Promise<void> {
    const supabase = createClient()

    // 원본 데이터 병렬 조회
    const [
      incomesRes,
      expensesRes,
      debtsRes,
      realEstatesRes,
      physicalAssetsRes,
      insurancesRes,
      nationalPensionsRes,
    ] = await Promise.all([
      supabase.from('incomes').select('*').eq('simulation_id', sourceSimulationId),
      supabase.from('expenses').select('*').eq('simulation_id', sourceSimulationId),
      supabase.from('debts').select('*').eq('simulation_id', sourceSimulationId),
      supabase.from('real_estates').select('*').eq('simulation_id', sourceSimulationId),
      supabase.from('physical_assets').select('*').eq('simulation_id', sourceSimulationId),
      supabase.from('insurances').select('*').eq('simulation_id', sourceSimulationId),
      supabase.from('national_pensions').select('*').eq('simulation_id', sourceSimulationId),
    ])

    // id, created_at, updated_at 제거하고 simulation_id 교체하는 헬퍼
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prepareRows = (rows: any[] | null) => {
      if (!rows?.length) return []
      return rows.map(({ id, created_at, updated_at, ...rest }) => ({
        ...rest,
        simulation_id: targetSimulationId,
      }))
    }

    // 병렬 INSERT
    const inserts: Promise<unknown>[] = []

    const incomes = prepareRows(incomesRes.data)
    if (incomes.length > 0) inserts.push(Promise.resolve(supabase.from('incomes').insert(incomes)))

    const expenses = prepareRows(expensesRes.data)
    if (expenses.length > 0) inserts.push(Promise.resolve(supabase.from('expenses').insert(expenses)))

    const debts = prepareRows(debtsRes.data)
    if (debts.length > 0) inserts.push(Promise.resolve(supabase.from('debts').insert(debts)))

    const realEstates = prepareRows(realEstatesRes.data)
    if (realEstates.length > 0) inserts.push(Promise.resolve(supabase.from('real_estates').insert(realEstates)))

    const physicalAssets = prepareRows(physicalAssetsRes.data)
    if (physicalAssets.length > 0) inserts.push(Promise.resolve(supabase.from('physical_assets').insert(physicalAssets)))

    const insurances = prepareRows(insurancesRes.data)
    if (insurances.length > 0) inserts.push(Promise.resolve(supabase.from('insurances').insert(insurances)))

    const nationalPensions = prepareRows(nationalPensionsRes.data)
    if (nationalPensions.length > 0) inserts.push(Promise.resolve(supabase.from('national_pensions').insert(nationalPensions)))

    await Promise.all(inserts)
  },

  /**
   * 기존 시뮬레이션을 완전히 복사
   * copySimulationData + savings/personal_pensions/retirement_pensions + 시뮬레이션 설정
   */
  async copyFullSimulation(sourceSimulationId: string, targetSimulationId: string): Promise<void> {
    const supabase = createClient()

    // 1. 기존 copySimulationData 호출 (incomes, expenses, debts, real_estates, physical_assets, insurances, national_pensions)
    await this.copySimulationData(sourceSimulationId, targetSimulationId)

    // 2. 추가 테이블 복사 (savings, personal_pensions, retirement_pensions)
    const [
      savingsRes,
      personalPensionsRes,
      retirementPensionsRes,
    ] = await Promise.all([
      supabase.from('savings').select('*').eq('simulation_id', sourceSimulationId),
      supabase.from('personal_pensions').select('*').eq('simulation_id', sourceSimulationId),
      supabase.from('retirement_pensions').select('*').eq('simulation_id', sourceSimulationId),
    ])

    // id, created_at, updated_at 제거하고 simulation_id 교체
    const prepareRows = (rows: any[] | null) => {
      if (!rows?.length) return []
      return rows.map(({ id, created_at, updated_at, ...rest }) => ({
        ...rest,
        simulation_id: targetSimulationId,
      }))
    }

    const inserts: Promise<unknown>[] = []

    const savings = prepareRows(savingsRes.data)
    if (savings.length > 0) inserts.push(Promise.resolve(supabase.from('savings').insert(savings)))

    const personalPensions = prepareRows(personalPensionsRes.data)
    if (personalPensions.length > 0) inserts.push(Promise.resolve(supabase.from('personal_pensions').insert(personalPensions)))

    const retirementPensions = prepareRows(retirementPensionsRes.data)
    if (retirementPensions.length > 0) inserts.push(Promise.resolve(supabase.from('retirement_pensions').insert(retirementPensions)))

    await Promise.all(inserts)

    // 3. 시뮬레이션 설정 복사 (simulation_assumptions, cash_flow_priorities, life_cycle_settings, family_config)
    const { data: sourceSim } = await supabase
      .from('simulations')
      .select('simulation_assumptions, cash_flow_priorities, life_cycle_settings, family_config, start_year, start_month')
      .eq('id', sourceSimulationId)
      .single()

    if (sourceSim) {
      const updates: Record<string, any> = {}
      if (sourceSim.simulation_assumptions) updates.simulation_assumptions = sourceSim.simulation_assumptions
      if (sourceSim.cash_flow_priorities) updates.cash_flow_priorities = sourceSim.cash_flow_priorities
      if (sourceSim.life_cycle_settings) updates.life_cycle_settings = sourceSim.life_cycle_settings
      if (sourceSim.family_config) updates.family_config = sourceSim.family_config
      if (sourceSim.start_year) updates.start_year = sourceSim.start_year
      if (sourceSim.start_month) updates.start_month = sourceSim.start_month

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('simulations')
          .update(updates)
          .eq('id', targetSimulationId)
      }
    }
  },

  /**
   * 스냅샷에서 시뮬레이션에 없는 데이터만 복사
   * 부동산, 부채, 실물자산 등이 시뮬레이션 테이블에 없으면 스냅샷에서 가져옴
   */
  async copyMissingDataFromSnapshot(simulationId: string, profileId: string): Promise<void> {
    const supabase = createClient()

    // 시뮬레이션에 이미 있는 데이터 확인
    const [debtsRes, realEstatesRes, physicalAssetsRes] = await Promise.all([
      supabase.from('debts').select('id', { count: 'exact', head: true }).eq('simulation_id', simulationId),
      supabase.from('real_estates').select('id', { count: 'exact', head: true }).eq('simulation_id', simulationId),
      supabase.from('physical_assets').select('id', { count: 'exact', head: true }).eq('simulation_id', simulationId),
    ])

    const hasDebts = (debtsRes.count || 0) > 0
    const hasRealEstates = (realEstatesRes.count || 0) > 0
    const hasPhysicalAssets = (physicalAssetsRes.count || 0) > 0

    // 모든 데이터가 있으면 스킵
    if (hasDebts && hasRealEstates && hasPhysicalAssets) return

    // 빈 카테고리만 스냅샷에서 복사
    const categoriesToCopy: ('savings' | 'debts' | 'real_estates' | 'physical_assets')[] = []
    if (!hasDebts) categoriesToCopy.push('debts')
    if (!hasRealEstates) categoriesToCopy.push('real_estates')
    if (!hasPhysicalAssets) categoriesToCopy.push('physical_assets')

    if (categoriesToCopy.length > 0) {
      await copySnapshotToSimulation(profileId, simulationId, {
        categories: categoriesToCopy,
      })
    }
  },

  /**
   * 현재 계좌 값 빠른 계산 (가격 조회 없이 투자금액 기준)
   * 실시간 가격은 사용자가 동기화 버튼 클릭 시 반영됨
   */
  async calculateCurrentAccountValues(profileId: string): Promise<{
    investmentValues: Map<string, number>
    savingsValues: Map<string, number>
  }> {
    const supabase = createClient()

    // 병렬로 모든 데이터 조회 (최적화)
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    const [portfolioRes, accountsRes, budgetRes, customHoldingsRes] = await Promise.all([
      supabase
        .from('portfolio_transactions')
        .select('*')
        .eq('profile_id', profileId),
      supabase
        .from('accounts')
        .select('*')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .in('account_type', ['checking', 'savings', 'deposit', 'free_savings', 'housing']),
      supabase
        .from('budget_transactions')
        .select('account_id, type, amount')
        .eq('profile_id', profileId)
        .eq('year', currentYear)
        .eq('month', currentMonth),
      supabase
        .from('custom_holdings')
        .select('*')
        .eq('profile_id', profileId),
    ])

    // 투자 계좌 평가액 계산 (가격 조회 없이 투자금액 기준)
    const investmentValues = calculatePortfolioAccountValues(
      portfolioRes.data || [],
      null,  // 가격 없이 투자금액 사용
      undefined,
      customHoldingsRes.data || []
    )

    // 저축 계좌 잔액 계산 (가계부 반영)
    const savingsValues = new Map<string, number>()
    const txSummary = calculateAccountTransactionSummary(budgetRes.data || [])

    accountsRes.data?.forEach(acc => {
      if (acc.account_type === 'checking') {
        // 입출금 계좌: 현재 잔액 + 가계부 거래
        const expectedBalance = calculateExpectedBalance(acc.current_balance || 0, txSummary[acc.id])
        savingsValues.set(acc.id, Math.round(expectedBalance))
      } else {
        // 예금/적금: 이자 포함 평가금액
        savingsValues.set(acc.id, Math.round(calculateTermDepositValue(acc)))
      }
    })

    return { investmentValues, savingsValues }
  },

  /**
   * 백그라운드에서 실시간 가격 조회 후 시뮬레이션 데이터 업데이트
   */
  async syncPricesInBackground(simulationId: string, profileId: string): Promise<void> {
    const supabase = createClient()

    // 1. 포트폴리오 거래 내역 가져오기
    const { data: portfolioTransactions } = await supabase
      .from('portfolio_transactions')
      .select('*')
      .eq('profile_id', profileId)

    if (!portfolioTransactions?.length) return

    // 2. 실시간 가격 조회 (외부 API)
    const priceCache = await fetchPortfolioPrices(portfolioTransactions)

    // custom_holdings도 가져오기
    const { data: customHoldings } = await supabase
      .from('custom_holdings')
      .select('*')
      .eq('profile_id', profileId)

    // 3. 투자 계좌 평가액 계산
    const investmentValues = calculatePortfolioAccountValues(portfolioTransactions, priceCache, undefined, customHoldings || [])

    // 4. 시뮬레이션의 투자 계좌 잔액 업데이트
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, account_type')
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .in('account_type', ['general', 'pension_savings', 'irp', 'isa', 'dc'])

    if (!accounts?.length) return

    // 5. 테이블별로 투자 계좌 업데이트
    const PENSION_TYPES = ['pension_savings', 'irp', 'isa']
    const RETIREMENT_TYPES = ['dc']

    for (const [accountId, value] of investmentValues) {
      const account = accounts.find(a => a.id === accountId)
      if (!account) continue

      if (PENSION_TYPES.includes(account.account_type)) {
        // 절세계좌 → personal_pensions 테이블
        await supabase
          .from('personal_pensions')
          .update({ current_balance: value })
          .eq('simulation_id', simulationId)
          .eq('title', account.name)
      } else if (RETIREMENT_TYPES.includes(account.account_type)) {
        // 퇴직연금 → retirement_pensions 테이블
        await supabase
          .from('retirement_pensions')
          .update({ current_balance: value })
          .eq('simulation_id', simulationId)
          .eq('title', account.name)
      } else {
        // 일반 투자 → savings 테이블
        await supabase
          .from('savings')
          .update({ current_balance: value })
          .eq('simulation_id', simulationId)
          .eq('title', account.name)
      }
    }

    // 6. 동기화 시간 업데이트
    await supabase
      .from('simulations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', simulationId)
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

    // 1. 동기화된 계좌만 삭제 (수동 추가 계좌는 유지)
    await Promise.all([
      supabase.from('savings').delete().eq('simulation_id', simulationId).not('source_account_id', 'is', null),
      supabase.from('personal_pensions').delete().eq('simulation_id', simulationId).not('source_account_id', 'is', null),
      supabase.from('retirement_pensions').delete().eq('simulation_id', simulationId).not('source_account_id', 'is', null),
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
        source_account_id: acc.id,
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
        source_account_id: acc.id,
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
      const { error } = await supabase.from('savings').insert(savingsData)
      if (error) {
        console.error('Savings insert error:', error)
        console.error('Savings data:', JSON.stringify(savingsData, null, 2))
        throw error
      }
    }

    // 4. 절세 계좌 → personal_pensions 테이블
    const pensionAccounts = accounts.filter(acc => PENSION_ACCOUNT_TYPES.includes(acc.account_type as AccountType))

    if (pensionAccounts.length > 0) {
      const pensionData = pensionAccounts.map(acc => ({
        simulation_id: simulationId,
        source_account_id: acc.id,
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
        source_account_id: acc.id,
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
