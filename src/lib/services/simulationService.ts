import { createClient } from '@/lib/supabase/client'
import type { Simulation, SimulationInput } from '@/types'

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
}

export default simulationService
