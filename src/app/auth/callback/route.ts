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
          .select('id, phone_number, pin_hash, booking_info')
          .eq('id', user.id)
          .single()

        // 1. 신규 유저 (프로필 없음) → PIN 설정
        if (!profile) {
          return NextResponse.redirect(`${origin}/auth/pin-setup`)
        }

        // 2. PIN 미설정 → PIN 설정
        if (!profile.pin_hash) {
          return NextResponse.redirect(`${origin}/auth/pin-setup`)
        }

        // 3. PIN 있고 예약 전 → 온보딩
        if (!profile.booking_info) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }

        // 4. 예약 완료 + 전화번호 미인증 → 전화번호 인증
        if (!profile.phone_number) {
          return NextResponse.redirect(`${origin}/auth/phone-verify`)
        }

        // 5. 모두 완료 (재방문) → PIN 입력
        return NextResponse.redirect(`${origin}/auth/pin-verify`)
      }

      return NextResponse.redirect(`${origin}/auth/pin-setup`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`)
}
