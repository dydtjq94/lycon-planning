import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json({ error: '전화번호가 필요합니다' }, { status: 400 })
    }

    // 전화번호 정리 (숫자만)
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '')

    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return NextResponse.json({ error: '올바른 전화번호 형식이 아닙니다' }, { status: 400 })
    }

    // 인증번호 생성 (6자리)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // 만료 시간 (3분)
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString()

    // Supabase에 인증번호 저장
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // profiles 테이블에 인증번호 저장
    await supabase
      .from('profiles')
      .update({
        verification_code: verificationCode,
        verification_expires_at: expiresAt,
        verification_phone: cleanPhone,
      })
      .eq('id', user.id)

    // CloudType FastAPI를 통해 SMS 발송 (고정 IP 사용)
    const FASTAPI_URL = process.env.FASTAPI_URL

    const response = await fetch(`${FASTAPI_URL}/sms/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: cleanPhone,
        code: verificationCode,
      }),
    })

    const result = await response.json()

    if (!result.success) {
      console.error('SMS 발송 실패:', result)
      return NextResponse.json({
        error: result.message || 'SMS 발송에 실패했습니다',
        detail: result
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '인증번호가 발송되었습니다' })
  } catch (error) {
    console.error('SMS 발송 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
