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
  attachments?: string[]  // 이미지 URL 배열
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
export async function sendMessage(
  conversationId: string,
  content: string,
  attachments?: string[]
): Promise<Message> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'user',
      content,
      attachments: attachments || [],
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

// 이미지 업로드
export async function uploadChatImage(file: File): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('chat-attachments')
    .upload(fileName, file)

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('chat-attachments')
    .getPublicUrl(fileName)

  return publicUrl
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

// 채팅 데이터 한 번에 로드 (최적화)
export async function loadChatData(): Promise<{
  expert: Expert | null
  conversation: Conversation | null
  messages: Message[]
} | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 1. 기존 primary 대화방 조회 (expert 포함)
  const { data: existingConv } = await supabase
    .from('conversations')
    .select(`*, expert:experts(*), messages(*)`)
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .maybeSingle()

  if (existingConv) {
    // 메시지 정렬
    const sortedMessages = (existingConv.messages || []).sort(
      (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    return {
      expert: existingConv.expert as Expert,
      conversation: { ...existingConv, messages: undefined } as Conversation,
      messages: sortedMessages,
    }
  }

  // 2. 없으면 생성 (기존 로직)
  const { data: expert } = await supabase
    .from('experts')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!expert) return null

  const { data: newConv } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, expert_id: expert.id, is_primary: true })
    .select(`*, expert:experts(*)`)
    .single()

  return {
    expert: expert as Expert,
    conversation: newConv as Conversation,
    messages: [],
  }
}

// 담당 전문가와의 대화 초기화 (온보딩 완료 시 호출)
export async function initializePrimaryConversation(): Promise<Conversation | null> {
  const supabase = createClient()

  const expert = await getDefaultExpert()
  if (!expert) return null

  // 유저 정보 가져오기
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  const userName = profile?.name || '고객'

  const conversation = await getOrCreateConversation(expert.id, true)

  // 환영 메시지가 없으면 추가
  const messages = await getMessages(conversation.id)
  if (messages.length === 0) {
    // 첫 번째 메시지: 인사
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'expert',
        content: `안녕하세요, ${userName}님,
검진을 예약해주셔서 감사합니다.
은퇴설계전문가 ${expert.name}입니다.`,
        is_read: false,
      })

    // 두 번째 메시지: 준비사항 안내
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'expert',
        content: `첫 검진 시간에는 소득·지출·자산·부채·연금 정보를 함께 검토해드립니다.
미리 입력해주시면 더 정확한 분석이 가능하며, 입력 없이도 상담은 정상 진행됩니다.`,
        is_read: false,
      })

    // 세 번째 메시지: 문의 안내
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'expert',
        content: `검진 전 궁금하신 점 있으시면 편하게 물어보세요.`,
        is_read: false,
      })

    // unread_count 업데이트
    await supabase
      .from('conversations')
      .update({ unread_count: 3 })
      .eq('id', conversation.id)
  }

  return conversation
}
