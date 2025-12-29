import { createClient } from '@/lib/supabase/client'
import type {
  Simulation,
  SimulationInput,
  FinancialItem,
  FinancialItemInput,
  FinancialCategory,
  OwnerType,
} from '@/types'

// ============================================
// 시뮬레이션 서비스
// ============================================

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

    // 기본 시뮬레이션 조회
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('profile_id', user.id)
      .eq('is_default', true)
      .single()

    if (data) return data

    // 없으면 생성
    if (error?.code === 'PGRST116') {
      return this.create({
        profile_id: user.id,
        title: '기본 시나리오',
        is_default: true,
        sort_order: 0,
      })
    }

    throw error
  },

  // 시뮬레이션 생성
  async create(input: SimulationInput): Promise<Simulation> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('simulations')
      .insert({
        profile_id: input.profile_id,
        title: input.title,
        description: input.description,
        is_default: input.is_default ?? false,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single()

    if (error) throw error
    return data
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

  // 시뮬레이션 복제
  async duplicate(sourceId: string, newTitle: string): Promise<Simulation> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // 원본 시뮬레이션 조회
    const { data: source, error: sourceError } = await supabase
      .from('simulations')
      .select('*')
      .eq('id', sourceId)
      .single()

    if (sourceError) throw sourceError

    // 새 시뮬레이션 생성
    const newSimulation = await this.create({
      profile_id: user.id,
      title: newTitle,
      description: source.description,
      is_default: false,
    })

    // 원본의 재무 항목들 복제
    const { data: items, error: itemsError } = await supabase
      .from('financial_items')
      .select('*')
      .eq('simulation_id', sourceId)

    if (itemsError) throw itemsError

    if (items && items.length > 0) {
      const newItems = items.map(item => ({
        simulation_id: newSimulation.id,
        category: item.category,
        type: item.type,
        title: item.title,
        owner: item.owner,
        memo: item.memo,
        start_year: item.start_year,
        start_month: item.start_month,
        end_year: item.end_year,
        end_month: item.end_month,
        is_fixed_to_retirement_year: item.is_fixed_to_retirement_year,
        data: item.data,
        sort_order: item.sort_order,
        is_active: item.is_active,
      }))

      const { error: insertError } = await supabase
        .from('financial_items')
        .insert(newItems)

      if (insertError) throw insertError
    }

    return newSimulation
  },
}

// ============================================
// 재무 항목 서비스
// ============================================

export const financialItemService = {
  // 시뮬레이션의 모든 재무 항목 조회
  async getAll(simulationId: string): Promise<FinancialItem[]> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('financial_items')
      .select('*')
      .eq('simulation_id', simulationId)
      .eq('is_active', true)
      .order('category')
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
  },

  // 카테고리별 재무 항목 조회
  async getByCategory(
    simulationId: string,
    category: FinancialCategory
  ): Promise<FinancialItem[]> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('financial_items')
      .select('*')
      .eq('simulation_id', simulationId)
      .eq('category', category)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
  },

  // 소유자별 재무 항목 조회
  async getByOwner(
    simulationId: string,
    owner: OwnerType
  ): Promise<FinancialItem[]> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('financial_items')
      .select('*')
      .eq('simulation_id', simulationId)
      .eq('owner', owner)
      .eq('is_active', true)
      .order('category')
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
  },

  // 단일 재무 항목 조회
  async get(id: string): Promise<FinancialItem> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('financial_items')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // 재무 항목 생성
  async create(input: FinancialItemInput): Promise<FinancialItem> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('financial_items')
      .insert({
        simulation_id: input.simulation_id,
        category: input.category,
        type: input.type,
        title: input.title,
        owner: input.owner ?? 'self',
        memo: input.memo,
        start_year: input.start_year,
        start_month: input.start_month,
        end_year: input.end_year,
        end_month: input.end_month,
        is_fixed_to_retirement_year: input.is_fixed_to_retirement_year ?? false,
        data: input.data,
        linked_item_id: input.linked_item_id,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 재무 항목 업데이트
  async update(
    id: string,
    updates: Partial<Omit<FinancialItemInput, 'simulation_id'>>
  ): Promise<FinancialItem> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('financial_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 재무 항목 삭제 (soft delete)
  async delete(id: string): Promise<void> {
    const supabase = createClient()

    const { error } = await supabase
      .from('financial_items')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error
  },

  // 재무 항목 완전 삭제 (hard delete)
  async hardDelete(id: string): Promise<void> {
    const supabase = createClient()

    const { error } = await supabase
      .from('financial_items')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // 여러 재무 항목 일괄 생성
  async createMany(inputs: FinancialItemInput[]): Promise<FinancialItem[]> {
    const supabase = createClient()

    const items = inputs.map(input => ({
      simulation_id: input.simulation_id,
      category: input.category,
      type: input.type,
      title: input.title,
      owner: input.owner ?? 'self',
      memo: input.memo,
      start_year: input.start_year,
      start_month: input.start_month,
      end_year: input.end_year,
      end_month: input.end_month,
      is_fixed_to_retirement_year: input.is_fixed_to_retirement_year ?? false,
      data: input.data,
      linked_item_id: input.linked_item_id,
      sort_order: input.sort_order ?? 0,
    }))

    const { data, error } = await supabase
      .from('financial_items')
      .insert(items)
      .select()

    if (error) throw error
    return data || []
  },

  // 정렬 순서 업데이트
  async updateOrder(updates: { id: string; sort_order: number }[]): Promise<void> {
    const supabase = createClient()

    // 각 항목별로 업데이트 (Supabase는 batch update를 직접 지원하지 않음)
    const promises = updates.map(({ id, sort_order }) =>
      supabase
        .from('financial_items')
        .update({ sort_order })
        .eq('id', id)
    )

    const results = await Promise.all(promises)
    const error = results.find(r => r.error)?.error
    if (error) throw error
  },
}

// ============================================
// 통합 서비스 (편의 함수)
// ============================================

export const financialService = {
  simulation: simulationService,
  item: financialItemService,

  // 시뮬레이션과 재무 항목 함께 조회
  async getSimulationWithItems(simulationId: string) {
    const [simulation, items] = await Promise.all([
      simulationService.getAll().then(sims => sims.find(s => s.id === simulationId)),
      financialItemService.getAll(simulationId),
    ])

    if (!simulation) throw new Error('Simulation not found')

    return { simulation, items }
  },

  // 기본 시뮬레이션과 재무 항목 함께 조회
  async getDefaultWithItems() {
    const simulation = await simulationService.getDefault()
    const items = await financialItemService.getAll(simulation.id)

    return { simulation, items }
  },

  // 카테고리별 그룹화된 재무 항목 조회
  async getGroupedItems(simulationId: string) {
    const items = await financialItemService.getAll(simulationId)

    return {
      incomes: items.filter(i => i.category === 'income'),
      expenses: items.filter(i => i.category === 'expense'),
      savings: items.filter(i => i.category === 'savings'),
      pensions: items.filter(i => i.category === 'pension'),
      assets: items.filter(i => i.category === 'asset'),
      debts: items.filter(i => i.category === 'debt'),
      realEstates: items.filter(i => i.category === 'real_estate'),
    }
  },
}

export default financialService
