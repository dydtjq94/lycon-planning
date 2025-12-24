'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import {
  calculateNetWorth,
  calculateRetirementProgress,
  calculateRequiredMonthlySaving,
} from '../calculators'
import { formatMoney } from '../formatUtils'
import styles from './Charts.module.css'

interface ProgressChartProps {
  data: OnboardingData
}

export function ProgressChart({ data }: ProgressChartProps) {
  const targetFund = data.target_retirement_fund || 0
  const netWorth = calculateNetWorth(data)
  const progress = calculateRetirementProgress(data)
  const requiredMonthly = calculateRequiredMonthlySaving(data)

  // 데이터가 없으면 기본 안내 표시
  if (!targetFund) {
    return (
      <div className={styles.chartPlaceholder}>
        <p>목표 은퇴 자금을 입력하면</p>
        <p>달성률을 확인할 수 있습니다</p>
      </div>
    )
  }

  // 진행률에 따른 색상 결정
  const getProgressClass = () => {
    if (progress >= 70) return 'High'
    if (progress >= 30) return ''
    return 'Low'
  }

  const progressClass = getProgressClass()

  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressHeader}>
        <span className={styles.progressTitle}>은퇴 자금 달성률</span>
        <span className={`${styles.progressPercent} ${styles[`progressPercent${progressClass}`] || ''}`}>
          {progress}%
        </span>
      </div>

      <div className={styles.progressBar}>
        <div
          className={`${styles.progressFill} ${styles[`progressFill${progressClass}`] || ''}`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      <div className={styles.progressStats}>
        <div className={styles.progressStat}>
          <span className={styles.progressStatLabel}>현재 순자산</span>
          <span className={styles.progressStatValue}>
            {netWorth > 0 ? formatMoney(netWorth) : '0원'}
          </span>
        </div>
        <div className={styles.progressStat}>
          <span className={styles.progressStatLabel}>목표 자금</span>
          <span className={styles.progressStatValue}>
            {formatMoney(targetFund)}
          </span>
        </div>
        {requiredMonthly > 0 && (
          <div className={styles.progressStat}>
            <span className={styles.progressStatLabel}>필요 월저축</span>
            <span className={styles.progressStatValueHighlight}>
              {formatMoney(requiredMonthly)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
