import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 프로필 존재 여부 확인
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // 프로필 및 인증 상태 확인
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, phone_number, onboarding_step')
          .eq('id', user.id)
          .single()

        // 1. 신규 유저 (프로필 없음) → 온보딩
        if (!profile) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }

        // 2. 온보딩 미완료 → 온보딩
        if (profile.onboarding_step !== 'completed') {
          return NextResponse.redirect(`${origin}/onboarding`)
        }

        // 3. 전화번호 미인증 → 전화번호 인증
        if (!profile.phone_number) {
          return NextResponse.redirect(`${origin}/auth/phone-verify`)
        }

        // 4. 모두 완료 (재방문) → 웨이팅
        return NextResponse.redirect(`${origin}/waiting`)
      }

      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`)
}
