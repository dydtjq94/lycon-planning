import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from './DashboardContent'
import type { Asset, Profile } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 프로필 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 자산 정보 조회
  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('user_id', user.id)

  // 프로필이 없으면 온보딩으로 리다이렉트
  if (!profile) {
    redirect('/onboarding')
  }

  return (
    <DashboardContent
      profile={profile as Profile}
      assets={(assets as Asset[]) || []}
    />
  )
}
