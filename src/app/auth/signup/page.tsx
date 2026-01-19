import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: '회원가입',
  description: 'Lycon 회원가입 - 전문가와 함께하는 맞춤형 재무 설계',
}
import { createClient } from '@/lib/supabase/server'
import { SignupForm } from './SignupForm'

export default async function SignupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return <SignupForm />
}
