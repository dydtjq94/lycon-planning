import { createClient } from '@/lib/supabase/client'

export interface ExpertAvailability {
  id: string
  expert_id: string
  day_of_week: number // 0=일, 1=월, ..., 6=토
  time_slots: string[] // ["09:00", "10:00", ...]
  is_active: boolean
}

export interface Booking {
  id: string
  expert_id: string
  user_id: string
  booking_date: string // "2024-01-15"
  booking_time: string // "10:00"
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  notes?: string
  created_at: string
}

// 전문가의 주간 스케줄 조회
export async function getExpertAvailability(expertId: string): Promise<ExpertAvailability[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('expert_availability')
    .select('*')
    .eq('expert_id', expertId)
    .order('day_of_week')

  if (error) throw error
  return data || []
}

// 특정 날짜의 예약된 시간 조회
export async function getBookedTimes(expertId: string, date: string): Promise<string[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select('booking_time')
    .eq('expert_id', expertId)
    .eq('booking_date', date)
    .in('status', ['pending', 'confirmed'])

  if (error) throw error
  return data?.map(b => b.booking_time) || []
}

// 특정 날짜의 가용 시간 조회 (전체 - 예약된 시간)
export async function getAvailableTimes(expertId: string, date: Date): Promise<string[]> {
  const dayOfWeek = date.getDay()
  const dateStr = date.toISOString().split('T')[0]

  // 해당 요일의 스케줄 조회
  const supabase = createClient()
  const { data: availability } = await supabase
    .from('expert_availability')
    .select('*')
    .eq('expert_id', expertId)
    .eq('day_of_week', dayOfWeek)
    .single()

  if (!availability || !availability.is_active) {
    return []
  }

  // 이미 예약된 시간 조회
  const bookedTimes = await getBookedTimes(expertId, dateStr)

  // 가용 시간 = 전체 - 예약된 시간
  const availableTimes = (availability.time_slots as string[]).filter(
    time => !bookedTimes.includes(time)
  )

  return availableTimes
}

// 로컬 날짜를 YYYY-MM-DD 형식으로 변환 (타임존 문제 방지)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 여러 날짜의 가용 시간 조회 (온보딩용)
export async function getAvailableTimesForDates(
  expertId: string,
  dates: Date[]
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {}

  // 모든 요일의 스케줄 조회
  const availability = await getExpertAvailability(expertId)
  const scheduleByDay: Record<number, ExpertAvailability> = {}
  availability.forEach(a => {
    scheduleByDay[a.day_of_week] = a
  })

  // 예약된 시간들 조회
  const supabase = createClient()
  const dateStrings = dates.map(d => formatLocalDate(d))

  const { data: bookings } = await supabase
    .from('bookings')
    .select('booking_date, booking_time')
    .eq('expert_id', expertId)
    .in('booking_date', dateStrings)
    .in('status', ['pending', 'confirmed'])

  // 날짜별 예약된 시간 맵
  const bookedByDate: Record<string, string[]> = {}
  bookings?.forEach(b => {
    if (!bookedByDate[b.booking_date]) {
      bookedByDate[b.booking_date] = []
    }
    bookedByDate[b.booking_date].push(b.booking_time)
  })

  // 각 날짜별 가용 시간 계산
  dates.forEach(date => {
    const dateStr = formatLocalDate(date)
    const dayOfWeek = date.getDay()
    const schedule = scheduleByDay[dayOfWeek]

    if (!schedule || !schedule.is_active) {
      result[dateStr] = []
      return
    }

    const booked = bookedByDate[dateStr] || []
    result[dateStr] = (schedule.time_slots as string[]).filter(
      time => !booked.includes(time)
    )
  })

  return result
}

// 예약 생성
export async function createBooking(
  expertId: string,
  bookingDate: string,
  bookingTime: string,
  notes?: string
): Promise<Booking> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      expert_id: expertId,
      user_id: user.id,
      booking_date: bookingDate,
      booking_time: bookingTime,
      status: 'pending',
      notes,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// 예약 취소
export async function cancelBooking(bookingId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) throw error
}

// 예약 확정 (전화번호 인증 후)
export async function confirmUserBooking(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (error) throw error
}

// 전문가의 예약 목록 조회 (어드민용)
export interface BookingWithUser extends Booking {
  user_name?: string
  user_birth_date?: string
  user_gender?: string
  user_phone?: string
}

export async function getExpertBookings(expertId: string): Promise<BookingWithUser[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      profiles:user_id (name, birth_date, gender, phone_number)
    `)
    .eq('expert_id', expertId)
    .in('status', ['pending', 'confirmed'])
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true })

  if (error) throw error

  return (data || []).map(b => {
    const profile = b.profiles as { name: string; birth_date: string | null; gender: string | null; phone_number: string | null } | null
    return {
      ...b,
      user_name: profile?.name,
      user_birth_date: profile?.birth_date || undefined,
      user_gender: profile?.gender || undefined,
      user_phone: profile?.phone_number || undefined,
      profiles: undefined,
    }
  })
}

// 스케줄 업데이트 (어드민용)
export async function updateAvailability(
  expertId: string,
  dayOfWeek: number,
  timeSlots: string[],
  isActive: boolean
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('expert_availability')
    .upsert({
      expert_id: expertId,
      day_of_week: dayOfWeek,
      time_slots: timeSlots,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'expert_id,day_of_week',
    })

  if (error) throw error
}

// 기본 전문가 ID 조회
export async function getDefaultExpertId(): Promise<string | null> {
  const supabase = createClient()

  const { data } = await supabase
    .from('experts')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()

  return data?.id || null
}
