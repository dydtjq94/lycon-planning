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

      if (!user) {
        router.push('/auth/login')
        return
      }

      // 이미 번호 인증이 되어있는지 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', user.id)
        .single()

      if (profile?.phone_number) {
        // 이미 인증됨 → PIN 설정으로
        router.push('/auth/pin-setup')
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
