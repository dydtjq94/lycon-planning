import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { phone, customer_name } = await request.json()

    if (!phone || !customer_name) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다' }, { status: 400 })
    }

    const FASTAPI_URL = process.env.FASTAPI_URL

    if (!FASTAPI_URL) {
      return NextResponse.json({ error: 'FASTAPI_URL이 설정되지 않았습니다' }, { status: 500 })
    }

    const response = await fetch(`${FASTAPI_URL}/sms/send-chat-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        customer_name,
      }),
    })

    const result = await response.json()

    if (!result.success) {
      console.error('채팅 알림 SMS 발송 실패:', result)
      return NextResponse.json({
        error: result.message || '채팅 알림 SMS 발송에 실패했습니다',
        detail: result
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '채팅 알림이 발송되었습니다' })
  } catch (error) {
    console.error('채팅 알림 SMS 발송 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
