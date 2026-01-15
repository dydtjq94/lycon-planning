'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PinVerify } from './PinVerify'

export default function PinVerifyPage() {
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

      // PIN이 설정되어 있는지 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('pin_hash')
        .eq('id', user.id)
        .single()

      if (!profile?.pin_hash) {
        // PIN이 없으면 설정 페이지로
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
        background: '#0a0a0a',
        color: '#666'
      }}>
        로딩 중...
      </div>
    )
  }

  return <PinVerify />
}
