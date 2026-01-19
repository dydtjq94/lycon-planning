'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OnboardingEvents, identifyUser } from '@/lib/analytics/mixpanel'
import { PinSetup } from './PinSetup'

export default function PinSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const trackedRef = useRef(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/auth/login')
        return
      }

      // PIN이 이미 설정되어 있으면 온보딩으로
      const { data: profile } = await supabase
        .from('profiles')
        .select('pin_hash')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.pin_hash) {
        router.replace('/onboarding')
        return
      }

      // 프로필이 없으면 생성 (신규 회원가입)
      if (!profile) {
        await supabase.from('profiles').insert({
          id: user.id,
          name: user.email?.split('@')[0] || '사용자',
          target_retirement_age: 60,
          target_retirement_fund: 1000000000,
        })

        // 신규 회원가입 완료 트래킹 (카카오 등 OAuth)
        if (!trackedRef.current) {
          trackedRef.current = true
          identifyUser(user.id, { email: user.email })
          OnboardingEvents.signUpCompleted(user.id)
        }
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

  return <PinSetup />
}
