import { createClient } from '@/lib/supabase/client'

export interface ConsultationRecord {
  id: string
  consultation_type: string
  scheduled_date: string
  scheduled_time: string | null
  completed_date: string | null
  status: string // 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  summary: string | null
  notes: string | null
  action_items: { text: string; completed: boolean }[]
  expert_name: string
  created_at: string
}

// 사용자의 상담 기록 조회 (최신순, 페이징)
export async function getUserConsultationRecords(
  limit: number = 10,
  offset: number = 0
): Promise<{ records: ConsultationRecord[]; total: number }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { records: [], total: 0 }

  // 전체 카운트
  const { count } = await supabase
    .from('consultation_records')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', user.id)

  // 데이터 조회 (expert name join)
  const { data, error } = await supabase
    .from('consultation_records')
    .select(`
      id,
      consultation_type,
      scheduled_date,
      scheduled_time,
      completed_date,
      status,
      summary,
      notes,
      action_items,
      created_at,
      experts:expert_id (name)
    `)
    .eq('profile_id', user.id)
    .order('scheduled_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  const records: ConsultationRecord[] = (data || []).map(r => {
    const expertData = r.experts as unknown as { name: string } | { name: string }[] | null
    const expert = Array.isArray(expertData) ? expertData[0] : expertData

    return {
      id: r.id,
      consultation_type: r.consultation_type,
      scheduled_date: r.scheduled_date,
      scheduled_time: r.scheduled_time,
      completed_date: r.completed_date,
      status: r.status,
      summary: r.summary,
      notes: r.notes,
      action_items: (r.action_items as { text: string; completed: boolean }[]) || [],
      expert_name: expert?.name || '전문가',
      created_at: r.created_at,
    }
  })

  return { records, total: count || 0 }
}

// 사용자의 예약된 상담 목록 (upcoming bookings)
export async function getUserUpcomingBookings(): Promise<{
  id: string
  booking_date: string
  booking_time: string
  consultation_type: string
  status: string
  expert_name: string
}[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_date,
      booking_time,
      consultation_type,
      status,
      experts:expert_id (name)
    `)
    .eq('user_id', user.id)
    .in('status', ['pending', 'confirmed'])
    .gte('booking_date', todayStr)
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true })

  if (error) throw error

  return (data || []).map(b => {
    const expertData = b.experts as unknown as { name: string } | { name: string }[] | null
    const expert = Array.isArray(expertData) ? expertData[0] : expertData

    return {
      id: b.id,
      booking_date: b.booking_date,
      booking_time: b.booking_time,
      consultation_type: b.consultation_type || 'retirement-diagnosis',
      status: b.status,
      expert_name: expert?.name || '전문가',
    }
  })
}
