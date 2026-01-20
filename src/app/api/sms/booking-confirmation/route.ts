import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendBookingConfirmedNotification } from '@/lib/services/slackService'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 유저의 예약 정보 조회
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        booking_date,
        booking_time,
        expert_id,
        experts:expert_id (name)
      `)
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!booking) {
      return NextResponse.json({ error: '확정된 예약이 없습니다' }, { status: 400 })
    }

    // 유저 정보 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone_number, name, birth_date, gender')
      .eq('id', user.id)
      .single()

    if (!profile?.phone_number) {
      return NextResponse.json({ error: '전화번호가 없습니다' }, { status: 400 })
    }

    // 날짜 포맷팅
    const bookingDate = new Date(booking.booking_date)
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const formattedDate = `${bookingDate.getFullYear()}년 ${bookingDate.getMonth() + 1}월 ${bookingDate.getDate()}일(${weekdays[bookingDate.getDay()]})`

    // 전문가 이름 추출
    const expertsData = booking.experts as { name: string } | { name: string }[] | null
    const expertName = Array.isArray(expertsData)
      ? expertsData[0]?.name
      : expertsData?.name || '담당 설계사'

    // FastAPI를 통해 SMS 발송
    const FASTAPI_URL = process.env.FASTAPI_URL

    const response = await fetch(`${FASTAPI_URL}/sms/send-booking-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: profile.phone_number,
        program_name: '기본형 종합 재무검진 (은퇴 진단)',
        booking_date: formattedDate,
        booking_time: booking.booking_time,
        expert_name: `${expertName} 은퇴설계 전문가`,
      }),
    })

    const result = await response.json()

    if (!result.success) {
      console.error('예약 확정 SMS 발송 실패:', result)
      return NextResponse.json({
        error: result.message || '예약 확정 SMS 발송에 실패했습니다',
        detail: result
      }, { status: 500 })
    }

    // Slack 알림 발송
    try {
      const birthYear = profile.birth_date?.split('-')[0]
      await sendBookingConfirmedNotification({
        userName: profile.name || '이름 없음',
        userPhone: profile.phone_number,
        bookingDate: booking.booking_date,
        bookingTime: booking.booking_time,
        userBirthYear: birthYear,
        userGender: profile.gender || undefined,
      })
    } catch (slackError) {
      console.error('Slack 알림 발송 오류:', slackError)
      // Slack 실패해도 계속 진행
    }

    return NextResponse.json({ success: true, message: '예약 확정 메시지가 발송되었습니다' })
  } catch (error) {
    console.error('예약 확정 SMS 발송 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
