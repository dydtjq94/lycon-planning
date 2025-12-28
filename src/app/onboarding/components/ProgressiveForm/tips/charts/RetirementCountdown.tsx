'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

interface RetirementCountdownProps {
  data: OnboardingData
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function calculateTimeLeft(birthDate: string, retirementAge: number): TimeLeft | null {
  if (!birthDate) return null

  const birth = new Date(birthDate)
  const retirementDate = new Date(
    birth.getFullYear() + retirementAge,
    birth.getMonth(),
    birth.getDate()
  )

  const now = new Date()
  const diff = retirementDate.getTime() - now.getTime()

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds }
}

function formatNumber(num: number, digits: number): string {
  return num.toString().padStart(digits, '0')
}

export function RetirementCountdown({ data }: RetirementCountdownProps) {
  const inputAge = data.target_retirement_age || 60

  // 디바운스된 은퇴 나이 (3초 후 반영)
  const [debouncedAge, setDebouncedAge] = useState(inputAge)
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const [mounted, setMounted] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // 은퇴 나이 변경 시 3초 디바운스
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedAge(inputAge)
    }, 1500)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [inputAge])

  // 카운트다운 타이머
  useEffect(() => {
    setMounted(true)

    // 초기값 설정
    const initial = calculateTimeLeft(data.birth_date || '', debouncedAge)
    setTimeLeft(initial)

    // 1초마다 업데이트
    const timer = setInterval(() => {
      const updated = calculateTimeLeft(data.birth_date || '', debouncedAge)
      setTimeLeft(updated)
    }, 1000)

    return () => clearInterval(timer)
  }, [data.birth_date, debouncedAge])

  if (!mounted || !timeLeft) {
    return (
      <div className={styles.countdown}>
        <div className={styles.countdownPlaceholder}>
          은퇴까지 남은 시간을 계산하려면<br />
          생년월일을 먼저 입력해주세요
        </div>
      </div>
    )
  }

  const isRetired = timeLeft.days === 0 && timeLeft.hours === 0 &&
                    timeLeft.minutes === 0 && timeLeft.seconds === 0

  if (isRetired) {
    return (
      <div className={styles.countdown}>
        <div className={styles.countdownRetired}>
          이미 은퇴 나이에 도달했어요!
        </div>
      </div>
    )
  }

  const years = Math.floor(timeLeft.days / 365)
  const months = Math.floor((timeLeft.days % 365) / 30)

  return (
    <div className={styles.countdown}>
      <div className={styles.countdownHeader}>
        <span className={styles.countdownLabel}>은퇴하는 그날까지</span>
      </div>

      <div className={styles.countdownTimer}>
        {/* Days */}
        <div className={styles.countdownUnit}>
          <div className={styles.countdownNumber}>
            {formatNumber(timeLeft.days, 4).split('').map((digit, i) => (
              <span key={i} className={styles.countdownDigit}>{digit}</span>
            ))}
          </div>
          <div className={styles.countdownUnitLabel}>일</div>
        </div>

        <div className={styles.countdownSeparator}>:</div>

        {/* Hours */}
        <div className={styles.countdownUnit}>
          <div className={styles.countdownNumber}>
            {formatNumber(timeLeft.hours, 2).split('').map((digit, i) => (
              <span key={i} className={styles.countdownDigit}>{digit}</span>
            ))}
          </div>
          <div className={styles.countdownUnitLabel}>시간</div>
        </div>

        <div className={styles.countdownSeparator}>:</div>

        {/* Seconds */}
        <div className={styles.countdownUnit}>
          <div className={styles.countdownNumber}>
            {formatNumber(timeLeft.seconds, 2).split('').map((digit, i) => (
              <span
                key={`${timeLeft.seconds}-${i}`}
                className={`${styles.countdownDigit} ${styles.countdownDigitTick}`}
              >
                {digit}
              </span>
            ))}
          </div>
          <div className={styles.countdownUnitLabel}>초</div>
        </div>
      </div>

      <div className={styles.countdownSummary}>
        약 {years}년 {months}개월
      </div>
    </div>
  )
}
