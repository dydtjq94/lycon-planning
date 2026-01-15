import { createClient } from '@/lib/supabase/client'

export interface Expert {
  id: string
  name: string
  title: string
  profile_image: string | null
  introduction: string | null
  credentials: { type: string; label: string }[]
  specialties: string[]
  is_active: boolean
}

export interface Conversation {
  id: string
  user_id: string
  expert_id: string
  is_primary: boolean
  last_message_at: string
  unread_count: number
  created_at: string
  expert?: Expert
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: 'expert' | 'user'
  content: string
  is_read: boolean
  created_at: string
}

// 모든 전문가 조회
export async function getExperts(): Promise<Expert[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('experts')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data || []
}

// 기본 전문가 조회 (첫 번째 활성 전문가)
export async function getDefaultExpert(): Promise<Expert | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('experts')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (error) return null
  return data
}

// 유저의 모든 대화 조회
export async function getConversations(): Promise<Conversation[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      expert:experts(*)
    `)
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false })
    .order('last_message_at', { ascending: false })

  if (error) throw error
  return data || []
}

// 대화방 생성 또는 조회
export async function getOrCreateConversation(expertId: string, isPrimary: boolean = false): Promise<Conversation> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  // 기존 대화 확인
  const { data: existing } = await supabase
    .from('conversations')
    .select(`*, expert:experts(*)`)
    .eq('user_id', user.id)
    .eq('expert_id', expertId)
    .maybeSingle()

  if (existing) return existing

  // 새 대화 생성
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      expert_id: expertId,
      is_primary: isPrimary,
    })
    .select(`*, expert:experts(*)`)
    .single()

  if (error) throw error
  return data
}

// 대화의 메시지 조회
export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

// 메시지 전송
export async function sendMessage(conversationId: string, content: string): Promise<Message> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'user',
      content,
    })
    .select()
    .single()

  if (error) throw error

  // 대화방 last_message_at 업데이트
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data
}

// 메시지 읽음 처리
export async function markMessagesAsRead(conversationId: string): Promise<void> {
  const supabase = createClient()

  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .eq('sender_type', 'expert')
    .eq('is_read', false)

  // unread_count 리셋
  await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
}

// 전문가의 최신 메시지 조회
export async function getLatestExpertMessage(): Promise<{ message: Message; expertName: string } | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 주 대화방 조회
  const { data: conversation } = await supabase
    .from('conversations')
    .select(`*, expert:experts(name)`)
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .maybeSingle()

  if (!conversation) return null

  // 전문가의 최신 메시지 조회
  const { data: message } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .eq('sender_type', 'expert')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!message) return null

  return {
    message,
    expertName: conversation.expert?.name || '담당 자산관리사',
  }
}

// 전체 안 읽은 메시지 수
export async function getTotalUnreadCount(): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data, error } = await supabase
    .from('conversations')
    .select('unread_count')
    .eq('user_id', user.id)

  if (error) return 0
  return data?.reduce((sum, c) => sum + (c.unread_count || 0), 0) || 0
}

// 담당 전문가와의 대화 초기화 (온보딩 완료 시 호출)
export async function initializePrimaryConversation(): Promise<Conversation | null> {
  const expert = await getDefaultExpert()
  if (!expert) return null

  const conversation = await getOrCreateConversation(expert.id, true)

  // 환영 메시지가 없으면 추가
  const messages = await getMessages(conversation.id)
  if (messages.length === 0) {
    const supabase = createClient()
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'expert',
        content: `안녕하세요, 담당 자산관리사 ${expert.name}입니다.

은퇴 준비, 어떻게 하고 계셨나요?
대부분 "나중에", "언젠가" 하다가 정작 중요한 결정을 미루게 됩니다.

라이콘은 다릅니다.
복잡한 재무 상황을 한눈에 정리하고, 은퇴까지 남은 시간 동안 무엇을 어떻게 준비해야 하는지 구체적으로 알려드립니다. 단순한 숫자 계산이 아니라, 당신의 삶에 맞는 전략을 함께 설계합니다.

이제부터 제가 담당 전문가로서 함께하겠습니다.
은퇴는 물론, 살면서 마주하는 크고 작은 재무 결정들 - 내 집 마련, 자녀 교육, 노후 의료비까지. 혼자 고민하지 마세요, 함께 결정해드리겠습니다.

질문이 꽤 많을 거예요.
하지만 이 과정을 거치면, 막연했던 미래가 선명해집니다.

입력을 완료하시면 7일 후 은퇴 진단 플랜을 보내드릴게요.
그때 다시 인사드리겠습니다.`,
        is_read: false,
      })

    // unread_count 업데이트
    await supabase
      .from('conversations')
      .update({ unread_count: 1 })
      .eq('id', conversation.id)
  }

  return conversation
}
