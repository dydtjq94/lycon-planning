import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: '6자리 인증번호를 입력해주세요' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 저장된 인증번호 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('verification_code, verification_expires_at, verification_phone')
      .eq('id', user.id)
      .single()

    if (!profile?.verification_code) {
      return NextResponse.json({ error: '인증번호를 먼저 요청해주세요' }, { status: 400 })
    }

    // 만료 확인
    if (new Date() > new Date(profile.verification_expires_at)) {
      return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }, { status: 400 })
    }

    // 인증번호 확인
    if (profile.verification_code !== code) {
      return NextResponse.json({ error: '인증번호가 일치하지 않습니다' }, { status: 400 })
    }

    // 인증 성공 - 전화번호 저장 및 인증번호 삭제
    await supabase
      .from('profiles')
      .update({
        phone_number: profile.verification_phone,
        phone_verified_at: new Date().toISOString(),
        verification_code: null,
        verification_expires_at: null,
        verification_phone: null,
      })
      .eq('id', user.id)

    return NextResponse.json({ success: true, message: '전화번호 인증이 완료되었습니다' })
  } catch (error) {
    console.error('인증 확인 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
