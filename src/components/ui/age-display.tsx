'use client'

import styles from './age-display.module.css'

interface AgeDisplayProps {
  birthDate: string  // YYYY-MM-DD 형식
  className?: string
}

/**
 * 만 나이 계산
 */
function calculateInternationalAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  // 생일이 아직 안 지났으면 1살 빼기
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return age
}

/**
 * 한국식 나이 계산 (현재 연도 - 출생 연도 + 1)
 */
function calculateKoreanAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  return today.getFullYear() - birth.getFullYear() + 1
}

/**
 * 나이 표시 컴포넌트
 * 한국식 나이와 만 나이를 함께 표시
 * 예: "32세 (만 31세)"
 */
export function AgeDisplay({ birthDate, className }: AgeDisplayProps) {
  if (!birthDate) return null

  const koreanAge = calculateKoreanAge(birthDate)
  const internationalAge = calculateInternationalAge(birthDate)

  return (
    <span className={`${styles.ageText} ${className || ''}`}>
      현재 {koreanAge}세 (만 {internationalAge}세)
    </span>
  )
}

/**
 * 나이 계산 함수들도 export
 */
export { calculateInternationalAge, calculateKoreanAge }
