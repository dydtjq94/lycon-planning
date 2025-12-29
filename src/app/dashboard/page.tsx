import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from './DashboardContent'
import type { OnboardingData, SimulationSettings } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 프로필 조회 (draft_data, settings 포함)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 프로필이 없으면 온보딩으로 리다이렉트
  if (!profile) {
    redirect('/onboarding')
  }

  // draft_data에서 OnboardingData 가져오기
  const onboardingData = profile.draft_data as OnboardingData | null

  // 온보딩 데이터가 없으면 온보딩으로 리다이렉트
  if (!onboardingData) {
    redirect('/onboarding')
  }

  // settings 가져오기 (없으면 기본값 사용)
  const settings = (profile.settings as SimulationSettings) || DEFAULT_SETTINGS

  return (
    <DashboardContent data={onboardingData} initialSettings={settings} />
  )
}
