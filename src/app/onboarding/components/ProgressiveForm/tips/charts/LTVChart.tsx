'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import { calculateLTV, calculateMonthlyIncome } from '../calculators'
import { formatMoney } from '../formatUtils'
import styles from './Charts.module.css'

interface LTVChartProps {
  data: OnboardingData
}

export function LTVChart({ data }: LTVChartProps) {
  const housingType = data.housingType
  const housingValue = data.housingValue || 0
  const housingLoan = data.housingLoan || 0
  const loanRate = data.housingLoanRate || 0
  const ltv = calculateLTV(data)
  const monthlyIncome = calculateMonthlyIncome(data)

  // 주거 형태별 분기
  if (!housingType || housingType === '해당없음') {
    return (
      <div className={styles.chartPlaceholder}>
        <span>거주 형태를 선택하면</span>
        <span>주거비 분석이 표시됩니다</span>
      </div>
    )
  }

  // 전세/월세인 경우
  if (housingType === '전세' || housingType === '월세') {
    const deposit = housingValue
    const monthlyRent = data.housingRent || 0
    const rentRatio = monthlyIncome > 0 ? Math.round((monthlyRent / monthlyIncome) * 100) : 0

    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>{housingType} 현황</span>
        </div>

        <div className={styles.housingStats}>
          <div className={styles.housingStat}>
            <span className={styles.housingStatLabel}>보증금</span>
            <span className={styles.housingStatValue}>{formatMoney(deposit)}</span>
          </div>
          {housingType === '월세' && monthlyRent > 0 && (
            <div className={styles.housingStat}>
              <span className={styles.housingStatLabel}>월세</span>
              <span className={styles.housingStatValue}>{formatMoney(monthlyRent)}/월</span>
            </div>
          )}
        </div>

        {housingType === '월세' && monthlyRent > 0 && monthlyIncome > 0 && (
          <div className={styles.rentRatioSection}>
            <div className={styles.progressHeader}>
              <span className={styles.chartSubtitle}>월세 비율 (소득 대비)</span>
              <span className={`${styles.progressPercent} ${rentRatio > 30 ? styles.progressPercentLow : ''}`}>
                {rentRatio}%
              </span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={`${styles.progressFill} ${rentRatio > 30 ? styles.progressFillLow : ''}`}
                style={{ width: `${Math.min(rentRatio, 100)}%` }}
              />
            </div>
            <div className={styles.savingsMessage}>
              {rentRatio <= 20 ? '적정 수준입니다.' :
               rentRatio <= 30 ? '관리 가능한 수준입니다.' :
               '월세 비율이 높습니다. 소득의 30% 이하를 권장합니다.'}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 자가인 경우
  if (housingType === '자가') {
    const equity = housingValue - housingLoan
    const ltvColor = ltv > 60 ? '#F97316' : ltv > 40 ? '#3B82F6' : '#10B981'
    const ltvMessage = ltv > 60 ? '높은 LTV입니다. 대출 상환을 권장합니다.' :
                       ltv > 40 ? '적정 수준입니다.' :
                       '안정적인 LTV입니다.'

    // 월 상환액 추정 (원리금균등상환, 30년 기준)
    const estimatedMonthlyPayment = housingLoan > 0 && loanRate > 0
      ? Math.round((housingLoan * (loanRate / 100 / 12)) / (1 - Math.pow(1 + loanRate / 100 / 12, -360)))
      : 0

    const dsr = monthlyIncome > 0 && estimatedMonthlyPayment > 0
      ? Math.round((estimatedMonthlyPayment / monthlyIncome) * 100)
      : 0

    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>자가 주택 현황</span>
        </div>

        {/* LTV 게이지 */}
        {housingLoan > 0 && (
          <div className={styles.ltvSection}>
            <div className={styles.progressHeader}>
              <span className={styles.chartSubtitle}>LTV (담보인정비율)</span>
              <span className={styles.progressPercent} style={{ color: ltvColor }}>
                {ltv}%
              </span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.min(ltv, 100)}%`, backgroundColor: ltvColor }}
              />
            </div>
            <div className={styles.savingsMessage}>{ltvMessage}</div>
          </div>
        )}

        {/* 자산 현황 */}
        <div className={styles.chartFooter}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{formatMoney(housingValue)}</span>
            <span className={styles.statLabel}>시세</span>
          </div>
          {housingLoan > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statValueWarning}>{formatMoney(housingLoan)}</span>
              <span className={styles.statLabel}>대출</span>
            </div>
          )}
          <div className={styles.statItem}>
            <span className={styles.statValueSuccess}>{formatMoney(equity)}</span>
            <span className={styles.statLabel}>순자산</span>
          </div>
        </div>

        {/* DSR 정보 */}
        {dsr > 0 && (
          <div className={styles.dsrInfo}>
            <span className={styles.chartSubtitle}>
              예상 월 상환액: {formatMoney(estimatedMonthlyPayment)} (소득의 {dsr}%)
            </span>
          </div>
        )}
      </div>
    )
  }

  return null
}
