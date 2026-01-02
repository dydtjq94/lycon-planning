import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from './DashboardContent'
import { FinancialProvider, type ProfileBasics } from '@/contexts/FinancialContext'
import type { Simulation, FinancialItem, GlobalSettings } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 프로필 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, birth_date, target_retirement_age, target_retirement_fund, settings')
    .eq('id', user.id)
    .single()

  // 프로필이 없으면 온보딩으로 리다이렉트
  if (!profile) {
    redirect('/onboarding')
  }

  // 기본 시뮬레이션 조회
  let simulation: Simulation | null = null
  const { data: existingSimulation } = await supabase
    .from('simulations')
    .select('*')
    .eq('profile_id', user.id)
    .eq('is_default', true)
    .single()

  if (existingSimulation) {
    simulation = existingSimulation as Simulation
  } else {
    // 시뮬레이션이 없으면 온보딩으로 리다이렉트
    redirect('/onboarding')
  }

  // 재무 항목 조회
  const { data: items } = await supabase
    .from('financial_items')
    .select('*')
    .eq('simulation_id', simulation.id)
    .eq('is_active', true)
    .order('category')
    .order('sort_order', { ascending: true })

  const financialItems = (items || []) as FinancialItem[]

  // 재무 항목이 없으면 온보딩으로 리다이렉트
  if (financialItems.length === 0) {
    redirect('/onboarding')
  }

  // 프로필 기본 정보 구성
  const profileBasics: ProfileBasics = {
    id: profile.id,
    name: profile.name || '',
    birth_date: profile.birth_date,
    target_retirement_age: profile.target_retirement_age || 60,
    target_retirement_fund: profile.target_retirement_fund,
    settings: profile.settings as ProfileBasics['settings'],
  }

  // 글로벌 설정
  const globalSettings: GlobalSettings = {
    ...DEFAULT_GLOBAL_SETTINGS,
    ...(profile.settings as GlobalSettings || {}),
  }

  return (
    <FinancialProvider
      simulation={simulation}
      initialItems={financialItems}
      profile={profileBasics}
      initialGlobalSettings={globalSettings}
    >
      <DashboardContent />
    </FinancialProvider>
  )
}
