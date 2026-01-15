'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from '../auth.module.css'

export function SignupForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleKakaoSignup = async () => {
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다')
      return
    }

    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // PIN 설정으로 이동
    router.push('/auth/pin-setup')
    router.refresh()
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {/* 상단: 철학/미션 */}
        <div className={styles.heroArea}>
          <p className={styles.brandLabel}>Lycon Finance Group</p>
          <h1 className={styles.heroTitle}>
            은퇴 후에도<br />
            당신다운 삶을<br />
            살 수 있도록
          </h1>
          <p className={styles.heroDesc}>
            재무 전문가와 함께<br />
            나만의 은퇴 시나리오를 설계하세요
          </p>
        </div>

        {/* 하단: 버튼 영역 */}
        <div className={styles.actionArea}>
          {error && <div className={styles.error}>{error}</div>}

          {!showEmailForm ? (
            <>
              <button
                type="button"
                className={styles.kakaoButton}
                onClick={handleKakaoSignup}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={20} className={styles.spinner} />
                ) : (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.47 1.607 4.647 4.023 5.897-.125.48-.45 1.737-.516 2.008-.082.334.122.33.258.24.106-.07 1.693-1.15 2.378-1.615.598.088 1.22.135 1.857.135 5.523 0 10-3.477 10-7.665C20 6.477 17.523 3 12 3z"/>
                    </svg>
                    <span>카카오로 시작하기</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className={styles.emailToggle}
                onClick={() => setShowEmailForm(true)}
              >
                이메일로 가입하기
              </button>

              <p className={styles.linkText}>
                이미 계정이 있으신가요?{' '}
                <Link href="/auth/login" className={styles.link}>
                  로그인
                </Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleEmailSignup} className={styles.emailForm}>
              <div className={styles.formGroup}>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="비밀번호 (6자 이상)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <input
                  id="confirmPassword"
                  type="password"
                  className={styles.input}
                  placeholder="비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={styles.submitButton} disabled={loading}>
                {loading ? <Loader2 size={20} className={styles.spinner} /> : '가입하기'}
              </button>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => setShowEmailForm(false)}
              >
                다른 방법으로 가입
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
