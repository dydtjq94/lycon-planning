import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from './DashboardContent'
import { FinancialProvider, type ProfileBasics, type FamilyMember } from '@/contexts/FinancialContext'
import type { Simulation, GlobalSettings } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 프로필 조회 (설문 응답 포함)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, gender, birth_date, target_retirement_age, target_retirement_fund, retirement_lifestyle_ratio, settings, diagnosis_started_at, action_plan_status, investment_profile, survey_responses, pin_verified_at')
    .eq('id', user.id)
    .single()

  // 프로필이 없으면 온보딩으로 리다이렉트
  if (!profile) {
    redirect('/onboarding')
  }

  // 현재는 대시보드 접근 차단 - waiting 페이지로 리다이렉트
  // (waiting에서 상태에 따라 적절한 페이지로 다시 리다이렉트됨)
  redirect('/waiting')

  // 가족 구성원 조회
  const { data: familyMembers } = await supabase
    .from('family_members')
    .select('*')
    .eq('user_id', user.id)
    .order('relationship')

  // 기본 시뮬레이션 조회
  let simulation: Simulation | null = null
  const { data: existingSimulation } = await supabase
    .from('simulations')
    .select('*')
    .eq('profile_id', user.id)
    .eq('is_default', true)
    .maybeSingle()

  if (existingSimulation) {
    simulation = existingSimulation as Simulation
  } else {
    // 시뮬레이션이 없으면 온보딩으로 리다이렉트
    redirect('/onboarding')
  }

  // 프로필 기본 정보 구성
  const profileBasics: ProfileBasics = {
    id: profile.id,
    name: profile.name || '',
    gender: profile.gender as ProfileBasics['gender'],
    birth_date: profile.birth_date,
    target_retirement_age: profile.target_retirement_age || 60,
    target_retirement_fund: profile.target_retirement_fund,
    retirement_lifestyle_ratio: profile.retirement_lifestyle_ratio,
    settings: profile.settings as ProfileBasics['settings'],
    diagnosis_started_at: profile.diagnosis_started_at,
    action_plan_status: profile.action_plan_status as Record<string, boolean> | undefined,
    investment_profile: profile.investment_profile as ProfileBasics['investment_profile'],
    survey_responses: profile.survey_responses as ProfileBasics['survey_responses'],
  }

  // 글로벌 설정
  const globalSettings: GlobalSettings = {
    ...DEFAULT_GLOBAL_SETTINGS,
    ...(profile.settings as GlobalSettings || {}),
  }

  // familyMembers 타입 변환
  const typedFamilyMembers: FamilyMember[] = (familyMembers || []).map(fm => ({
    id: fm.id,
    user_id: fm.user_id,
    relationship: fm.relationship,
    name: fm.name,
    birth_date: fm.birth_date,
    gender: fm.gender as FamilyMember['gender'],
    is_dependent: fm.is_dependent ?? false,
    is_working: fm.is_working ?? false,
    retirement_age: fm.retirement_age,
    monthly_income: fm.monthly_income,
    notes: fm.notes,
  }))

  return (
    <FinancialProvider
      simulation={simulation}
      profile={profileBasics}
      familyMembers={typedFamilyMembers}
      initialGlobalSettings={globalSettings}
    >
      <DashboardContent />
    </FinancialProvider>
  )
}
