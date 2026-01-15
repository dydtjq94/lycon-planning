'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from '../pin-setup/pin-setup.module.css'

interface RippleEffect {
  id: number
  x: number
  y: number
  key: string
}

// Fisher-Yates 셔플 알고리즘
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// PIN을 해시하는 함수 (SHA-256)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function PinVerify() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [keypadNumbers, setKeypadNumbers] = useState<string[]>([])
  const [ripples, setRipples] = useState<RippleEffect[]>([])
  const [rippleId, setRippleId] = useState(0)
  const [attempts, setAttempts] = useState(0)

  // 키패드 숫자 셔플
  const shuffleKeypad = useCallback(() => {
    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
    setKeypadNumbers(shuffleArray(numbers))
  }, [])

  useEffect(() => {
    shuffleKeypad()
  }, [shuffleKeypad])

  const [glowButtons, setGlowButtons] = useState<string[]>([])

  const createRipple = (key: string, element: HTMLButtonElement) => {
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    const newRipple: RippleEffect = {
      id: rippleId,
      x,
      y,
      key,
    }

    setRippleId(prev => prev + 1)
    setRipples(prev => [...prev, newRipple])

    // 랜덤하게 다른 버튼들도 글로우 효과
    const otherNums = keypadNumbers.filter(n => n !== key)
    const randomCount = Math.floor(Math.random() * 4) + 2
    const randomNums = shuffleArray(otherNums).slice(0, randomCount)
    setGlowButtons([key, ...randomNums])

    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id))
      setGlowButtons([])
    }, 500)
  }

  const handleNumberClick = (num: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (pin.length >= 6) return

    setError(null)
    createRipple(num, event.currentTarget)

    const newPin = pin + num
    setPin(newPin)

    // 6자리 완성 시 검증
    if (newPin.length === 6) {
      setTimeout(() => {
        verifyPin(newPin)
      }, 200)
    }
  }

  const verifyPin = async (inputPin: string) => {
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      // 저장된 PIN 해시 가져오기
      const { data: profile } = await supabase
        .from('profiles')
        .select('pin_hash')
        .eq('id', user.id)
        .single()

      if (!profile?.pin_hash) {
        router.push('/auth/pin-setup')
        return
      }

      // 입력한 PIN 해시화
      const hashedInput = await hashPin(inputPin)

      // 비교
      if (hashedInput === profile.pin_hash) {
        // 성공 - 웨이팅 화면으로 (서비스 시작 후 dashboard로 변경)
        router.push('/waiting')
        router.refresh()
      } else {
        // 실패
        setAttempts(prev => prev + 1)
        setError('비밀번호가 일치하지 않습니다')
        setPin('')
        shuffleKeypad()
        setLoading(false)

        // 5회 실패 시 로그아웃
        if (attempts >= 4) {
          await supabase.auth.signOut()
          router.push('/auth/login')
        }
      }
    } catch (err) {
      console.error('PIN 검증 오류:', err)
      setError('오류가 발생했습니다')
      setPin('')
      setLoading(false)
    }
  }

  const handleDelete = () => {
    setError(null)
    setPin(prev => prev.slice(0, -1))
  }

  const handleReset = () => {
    setError(null)
    setPin('')
  }

  return (
    <div className={styles.container}>
      {/* 전역 리플 효과 */}
      {ripples.map(ripple => (
        <div
          key={ripple.id}
          className={styles.globalRipple}
          style={{
            left: ripple.x,
            top: ripple.y,
          }}
        />
      ))}

      <main className={styles.main}>
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Lock size={28} strokeWidth={1.5} />
          </div>
          <h1 className={styles.title}>비밀번호 입력</h1>
          <p className={styles.subtitle}>6자리 비밀번호를 입력해주세요</p>
        </div>

        {/* PIN 표시 */}
        <div className={styles.pinDisplay}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`${styles.pinDot} ${i < pin.length ? styles.filled : ''}`}
            >
              {i < pin.length && <span className={styles.dotInner} />}
            </div>
          ))}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className={styles.error}>
            {error}
            {attempts > 0 && ` (${5 - attempts}회 남음)`}
          </div>
        )}

        {/* 키패드 */}
        <div className={styles.keypad}>
          <div className={styles.keypadGrid}>
            {keypadNumbers.slice(0, 9).map((num) => (
              <button
                key={num}
                type="button"
                className={`${styles.keypadButton} ${glowButtons.includes(num) ? styles.glow : ''}`}
                onClick={(e) => handleNumberClick(num, e)}
                disabled={loading}
              >
                <span className={styles.keypadNum}>{num}</span>
              </button>
            ))}
            {/* 하단 행: 전체삭제, 0, 삭제 */}
            <button
              type="button"
              className={`${styles.keypadButton} ${styles.keypadAction}`}
              onClick={handleReset}
              disabled={loading}
            >
              <span className={styles.keypadText}>전체</span>
            </button>
            <button
              type="button"
              className={`${styles.keypadButton} ${glowButtons.includes(keypadNumbers[9]) ? styles.glow : ''}`}
              onClick={(e) => handleNumberClick(keypadNumbers[9], e)}
              disabled={loading}
            >
              <span className={styles.keypadNum}>{keypadNumbers[9]}</span>
            </button>
            <button
              type="button"
              className={`${styles.keypadButton} ${styles.keypadAction}`}
              onClick={handleDelete}
              disabled={loading}
            >
              <span className={styles.keypadText}>삭제</span>
            </button>
          </div>
        </div>

        {/* 로딩 오버레이 */}
        {loading && (
          <div className={styles.loadingOverlay}>
            <Loader2 size={32} className={styles.spinner} />
          </div>
        )}
      </main>
    </div>
  )
}
