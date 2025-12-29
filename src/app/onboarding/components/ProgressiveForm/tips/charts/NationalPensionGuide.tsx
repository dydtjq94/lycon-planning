'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

interface NationalPensionGuideProps {
  data: OnboardingData
}

// 나이 계산
function calculateAge(birthDate: string): number {
  if (!birthDate) return 0
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// 국민연금 예상 수령액 계산
// 공식: 예상월연금 = (A값 + B값) × 가입연수 × 0.005
function estimatePension(monthlyIncome: number, retirementAge: number): number {
  if (monthlyIncome <= 0) return 0

  // 세후 → 세전 환산 (대략 85% 가정)
  const grossIncome = Math.round(monthlyIncome / 0.85)

  // A값: 2025년 기준 전체 가입자 평균 소득월액 (309만원)
  const aValue = 309

  // B값: 본인 평균 기준소득월액 (상한 637만원, 하한 40만원)
  const bValue = Math.min(Math.max(grossIncome, 40), 637)

  // 가입 기간 계산 (27세 시작, 은퇴 나이 또는 60세 중 작은 값까지)
  const startAge = 27
  const endAge = Math.min(retirementAge || 60, 60) // 국민연금은 60세까지 납부
  const totalYears = Math.max(0, endAge - startAge)

  // 예상 월 연금액 = (A + B) × 가입연수 × 0.005
  const estimatedPension = (aValue + bValue) * totalYears * 0.005

  return Math.round(estimatedPension)
}

export function NationalPensionGuide({ data }: NationalPensionGuideProps) {
  const monthlyIncome = (data.laborIncome || 0) + (data.businessIncome || 0)
  const retirementAge = data.target_retirement_age || 60
  const estimatedAmount = estimatePension(monthlyIncome, retirementAge)

  // 가입 기간 계산 (표시용)
  const contributionYears = Math.max(0, Math.min(retirementAge, 60) - 27)

  const handleClick = () => {
    window.open('https://csa.nps.or.kr/ohkd/ntpsidnty/anpninq/UHKD7101M0.do', '_blank')
  }

  return (
    <div className={styles.pensionGuide}>
      {estimatedAmount > 0 && (
        <div className={styles.pensionEstimate}>
          <div className={styles.pensionEstimateMain}>
            <span className={styles.pensionEstimateLabel}>예상 수령액</span>
            <div className={styles.pensionEstimateValue}>
              <span className={styles.pensionEstimateAmount}>약 {estimatedAmount}</span>
              <span className={styles.pensionEstimateUnit}>만원/월</span>
            </div>
          </div>
          <div className={styles.pensionEstimateDetails}>
            <div className={styles.pensionEstimateRow}>
              <span>현재 소득</span>
              <span>{monthlyIncome}만원/월</span>
            </div>
            <div className={styles.pensionEstimateRow}>
              <span>은퇴 나이</span>
              <span>{retirementAge}세</span>
            </div>
            <div className={styles.pensionEstimateRow}>
              <span>예상 가입 기간</span>
              <span>{contributionYears}년</span>
            </div>
          </div>
        </div>
      )}
      <button
        className={styles.pensionGuideLink}
        onClick={handleClick}
      >
        국민연금공단에서 정확히 조회하기
      </button>
    </div>
  )
}
