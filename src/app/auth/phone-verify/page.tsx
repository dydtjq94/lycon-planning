'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PhoneVerify } from './PhoneVerify'

export default function PhoneVerifyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // 로그인 안됨 → 로그인 페이지로
      if (!user) {
        router.replace('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('pin_hash, onboarding_step, phone_number')
        .eq('id', user.id)
        .single()

      // PIN 없음 → PIN 설정으로
      if (!profile?.pin_hash) {
        router.replace('/auth/pin-setup')
        return
      }

      // 온보딩 미완료 → 온보딩으로
      if (profile?.onboarding_step !== 'completed') {
        router.replace('/onboarding')
        return
      }

      // 이미 전화번호 인증됨 → 대기 화면으로
      if (profile?.phone_number) {
        router.replace('/waiting')
        return
      }

      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#ffffff',
        color: '#6b7280'
      }}>
        로딩 중...
      </div>
    )
  }

  return <PhoneVerify />
}
