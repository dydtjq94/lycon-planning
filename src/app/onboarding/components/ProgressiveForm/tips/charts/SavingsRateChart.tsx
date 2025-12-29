'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

interface SavingsRateChartProps {
  data: OnboardingData
}

export function SavingsRateChart({ data }: SavingsRateChartProps) {
  const income = (data.laborIncome || 0) + (data.spouseLaborIncome || 0) +
                 (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)
  const expense = data.livingExpenses || 0

  const [debouncedExpense, setDebouncedExpense] = useState(0)
  const [showContent, setShowContent] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    // 값이 변경되면 일단 숨김
    setShowContent(false)

    debounceTimer.current = setTimeout(() => {
      setDebouncedExpense(expense)
      if (expense > 0 && income > 0) {
        setShowContent(true)
      }
    }, 1500)

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [expense, income])

  // 저축 가능 금액 및 저축률 계산
  const savings = income - debouncedExpense
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0

  // 저축률 상태
  const getRateStatus = () => {
    if (savingsRate >= 30) return { label: '훌륭해요', color: '#10B981' }
    if (savingsRate >= 20) return { label: '좋아요', color: '#3B82F6' }
    if (savingsRate >= 10) return { label: '괜찮아요', color: '#F59E0B' }
    if (savingsRate > 0) return { label: '조금 부족해요', color: '#F97316' }
    return { label: '적자예요', color: '#EF4444' }
  }

  const status = getRateStatus()

  if (!showContent) {
    return null
  }

  return (
    <div className={styles.savingsRate}>
      <div className={styles.savingsRateHeader}>
        <span className={styles.savingsRateLabel}>월 저축 여력</span>
        <div className={styles.savingsRateValue}>
          <span
            className={styles.savingsRateAmount}
            style={{ color: status.color }}
          >
            {savings >= 0 ? '+' : ''}{savings}
          </span>
          <span className={styles.savingsRateUnit}>만원</span>
        </div>
      </div>

      <div className={styles.savingsRateBar}>
        <div
          className={styles.savingsRateFill}
          style={{
            width: `${Math.min(Math.max(savingsRate, 0), 100)}%`,
            backgroundColor: status.color
          }}
        />
      </div>

      <div className={styles.savingsRateInfo}>
        <div className={styles.savingsRateRow}>
          <span className={styles.savingsRateRowLabel}>소득</span>
          <span className={styles.savingsRateRowValue}>{income.toLocaleString()}만원</span>
        </div>
        <div className={styles.savingsRateRow}>
          <span className={styles.savingsRateRowLabel}>지출</span>
          <span className={styles.savingsRateRowValue}>-{debouncedExpense.toLocaleString()}만원</span>
        </div>
        <div className={styles.savingsRateRowTotal}>
          <span className={styles.savingsRateRowLabel}>저축률</span>
          <span
            className={styles.savingsRateRowValue}
            style={{ color: status.color }}
          >
            {savingsRate}% ({status.label})
          </span>
        </div>
      </div>
    </div>
  )
}
