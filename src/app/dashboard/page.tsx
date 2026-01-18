import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 현재는 대시보드 접근 차단 - waiting 페이지로 리다이렉트
  // (waiting에서 상태에 따라 적절한 페이지로 다시 리다이렉트됨)
  redirect('/waiting')
}
