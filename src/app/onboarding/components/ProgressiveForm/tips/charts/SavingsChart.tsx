'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import {
  calculateMonthlyIncome,
  calculateMonthlyExpense,
  calculateSavingsRate,
} from '../calculators'
import { formatMoney } from '../formatUtils'
import styles from './Charts.module.css'

interface SavingsChartProps {
  data: OnboardingData
}

export function SavingsChart({ data }: SavingsChartProps) {
  const income = calculateMonthlyIncome(data)
  const expense = calculateMonthlyExpense(data)
  const savingsRate = calculateSavingsRate(data)
  const savings = income - expense

  if (income === 0 && expense === 0) {
    return (
      <div className={styles.chartPlaceholder}>
        <span>소득/지출 정보를 입력하면</span>
        <span>저축률 분석이 표시됩니다</span>
      </div>
    )
  }

  // 저축률에 따른 색상
  const getColor = () => {
    if (savingsRate < 20) return { bar: '#F97316', text: styles.progressPercentLow }
    if (savingsRate >= 30) return { bar: '#10B981', text: styles.progressPercentHigh }
    return { bar: '#3B82F6', text: '' }
  }

  const color = getColor()
  const maxAmount = Math.max(income, expense, 1)

  // 저축률 상태 메시지
  const getMessage = () => {
    if (savingsRate < 10) return '저축이 거의 없습니다. 지출 점검이 필요합니다.'
    if (savingsRate < 20) return '저축률이 낮습니다. 최소 20%를 권장합니다.'
    if (savingsRate < 30) return '적정 수준입니다. 30% 이상이면 더 좋습니다.'
    if (savingsRate < 50) return '우수한 저축률입니다.'
    return '매우 높은 저축률입니다.'
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>소득 vs 지출</span>
        <span className={`${styles.progressPercent} ${color.text}`}>
          저축률 {savingsRate}%
        </span>
      </div>

      {/* 소득 바 */}
      <div className={styles.barRow}>
        <span className={styles.barLabel}>소득</span>
        <div className={styles.barContainer}>
          <div
            className={styles.barFill}
            style={{
              width: `${(income / maxAmount) * 100}%`,
              backgroundColor: '#3B82F6',
            }}
          />
        </div>
        <span className={styles.barValue}>{formatMoney(income)}</span>
      </div>

      {/* 지출 바 */}
      <div className={styles.barRow}>
        <span className={styles.barLabel}>지출</span>
        <div className={styles.barContainer}>
          <div
            className={styles.barFill}
            style={{
              width: `${(expense / maxAmount) * 100}%`,
              backgroundColor: '#EF4444',
            }}
          />
        </div>
        <span className={styles.barValue}>{formatMoney(expense)}</span>
      </div>

      {/* 저축 바 */}
      <div className={styles.barRow}>
        <span className={styles.barLabel}>저축</span>
        <div className={styles.barContainer}>
          <div
            className={styles.barFill}
            style={{
              width: savings > 0 ? `${(savings / maxAmount) * 100}%` : '0%',
              backgroundColor: color.bar,
            }}
          />
        </div>
        <span className={styles.barValue}>{formatMoney(Math.max(0, savings))}</span>
      </div>

      <div className={styles.savingsMessage}>
        {getMessage()}
      </div>
    </div>
  )
}
