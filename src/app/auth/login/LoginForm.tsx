'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import styles from '../auth.module.css'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>로그인</h1>
          <p className={styles.description}>Lycon에 오신 것을 환영합니다</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className={styles.content}>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="email">이메일</label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="password">비밀번호</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <div className={styles.footer}>
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
            <p className={styles.linkText}>
              계정이 없으신가요?{' '}
              <Link href="/auth/signup" className={styles.link}>
                회원가입
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
