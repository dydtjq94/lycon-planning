import { createClient } from '@/lib/supabase/client'

export interface ActionItem {
  id: string
  user_id: string
  expert_id: string | null
  title: string
  description: string | null
  is_completed: boolean
  due_date: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * 사용자의 액션 아이템 조회 (미완료 우선, 정렬순)
 */
export async function getActionItems(): Promise<ActionItem[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('action_items')
    .select('*')
    .eq('user_id', user.id)
    .order('is_completed', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[actionItemService] getActionItems error:', error)
    return []
  }

  return data as ActionItem[]
}

/**
 * 액션 아이템 완료 토글
 */
export async function toggleActionItem(id: string, isCompleted: boolean): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('action_items')
    .update({ is_completed: isCompleted })
    .eq('id', id)

  if (error) {
    console.error('[actionItemService] toggleActionItem error:', error)
    return false
  }

  return true
}
