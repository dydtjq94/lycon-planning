'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Phone, Shield } from 'lucide-react'
import styles from './phone-verify.module.css'

type Step = 'phone' | 'code'

export function PhoneVerify() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 인증번호 발송
  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('올바른 전화번호를 입력해주세요')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '인증번호 발송에 실패했습니다')
        return
      }

      setStep('code')
      setCountdown(180) // 3분 타이머
    } catch (err) {
      console.error('인증번호 발송 오류:', err)
      setError('인증번호 발송에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // 인증번호 확인
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('6자리 인증번호를 입력해주세요')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '인증에 실패했습니다')
        setLoading(false)
        return
      }

      // 웨이팅 화면으로 이동
      router.push('/waiting')
      router.refresh()
    } catch (err) {
      console.error('인증 확인 오류:', err)
      setError('인증에 실패했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  // 재발송
  const handleResend = () => {
    setStep('phone')
    setVerificationCode('')
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {/* 히어로 영역 */}
        <div className={styles.heroArea}>
          <div className={styles.iconWrapper}>
            {step === 'phone' ? <Phone size={28} /> : <Shield size={28} />}
          </div>
          <h1 className={styles.title}>
            {step === 'phone' ? '전화번호 인증' : '인증번호 입력'}
          </h1>
          <p className={styles.subtitle}>
            {step === 'phone'
              ? '예약 확인 및 상담 안내를 위해\n전화번호 인증이 필요합니다'
              : `${phoneNumber}로 전송된\n인증번호를 입력해주세요`}
          </p>
        </div>

        {/* 입력 영역 */}
        <div className={styles.formArea}>
          {error && <div className={styles.error}>{error}</div>}

          {step === 'phone' ? (
            <>
              <div className={styles.inputGroup}>
                <span className={styles.prefix}>+82</span>
                <input
                  type="tel"
                  className={styles.phoneInput}
                  placeholder="01012345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={11}
                  disabled={loading}
                />
              </div>
              <button
                type="button"
                className={styles.submitButton}
                onClick={handleSendCode}
                disabled={loading || phoneNumber.length < 10}
              >
                {loading ? <Loader2 size={20} className={styles.spinner} /> : '인증번호 받기'}
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                className={styles.codeInput}
                placeholder="인증번호 6자리"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                disabled={loading}
                autoFocus
              />
              {countdown > 0 && (
                <p className={styles.timer}>
                  남은 시간: {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                </p>
              )}
              <button
                type="button"
                className={styles.submitButton}
                onClick={handleVerifyCode}
                disabled={loading || verificationCode.length !== 6}
              >
                {loading ? <Loader2 size={20} className={styles.spinner} /> : '확인'}
              </button>
              <button
                type="button"
                className={styles.resendButton}
                onClick={handleResend}
                disabled={loading}
              >
                인증번호 다시 받기
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
