'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

interface IncomePositionChartProps {
  data: OnboardingData
}

// 한국 월 소득 분위 데이터 (세후 실수령액 기준, 만원)
const incomePercentiles = [
  { percentile: 1, income: 2000 },   // 상위 1%
  { percentile: 5, income: 1200 },   // 상위 5%
  { percentile: 10, income: 900 },   // 상위 10%
  { percentile: 20, income: 700 },   // 상위 20%
  { percentile: 30, income: 550 },   // 상위 30%
  { percentile: 50, income: 400 },   // 중위
  { percentile: 70, income: 300 },   // 하위 30%
  { percentile: 100, income: 150 },  // 하위
]

// 소득으로 상위 % 계산
function calcPercentile(income: number): number {
  if (income >= 2000) return 1
  if (income >= 1200) return 5
  if (income >= 900) return 10
  if (income >= 700) return 20
  if (income >= 550) return 30
  if (income >= 400) return 50
  if (income >= 300) return 70
  return 100
}

export function IncomePositionChart({ data }: IncomePositionChartProps) {
  const income = data.laborIncome || 0
  const spouseIncome = data.spouseLaborIncome || 0
  const totalIncome = income + spouseIncome

  const [debouncedIncome, setDebouncedIncome] = useState(totalIncome)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedIncome(totalIncome), 1500)
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [totalIncome])

  const percentile = calcPercentile(debouncedIncome)
  const barWidth = Math.max(100 - percentile, 5) // 최소 5%

  if (debouncedIncome === 0) {
    return (
      <div className={styles.incomePosition}>
        <div className={styles.incomePositionPlaceholder}>
          소득을 입력하면<br />
          소득 위치를 알려드려요
        </div>
      </div>
    )
  }

  return (
    <div className={styles.incomePosition}>
      <div className={styles.incomePositionHeader}>
        <span className={styles.incomePositionLabel}>대한민국 소득 기준</span>
        <div className={styles.incomePositionValue}>
          <span className={styles.incomePositionTop}>상위</span>
          <span className={styles.incomePositionPercent}>{percentile}</span>
          <span className={styles.incomePositionUnit}>%</span>
        </div>
      </div>

      <div className={styles.incomePositionBar}>
        <div
          className={styles.incomePositionFill}
          style={{ width: `${barWidth}%` }}
        />
        <div
          className={styles.incomePositionMarker}
          style={{ left: `${barWidth}%` }}
        />
      </div>

      <div className={styles.incomePositionScale}>
        <span>하위</span>
        <span>중위</span>
        <span>상위</span>
      </div>

      <div className={styles.incomePositionInfo}>
        <div className={styles.incomePositionInfoItem}>
          <span className={styles.incomePositionInfoLabel}>월 소득</span>
          <span className={styles.incomePositionInfoValue}>{debouncedIncome.toLocaleString()}만원</span>
        </div>
        <div className={styles.incomePositionInfoItem}>
          <span className={styles.incomePositionInfoLabel}>연 소득</span>
          <span className={styles.incomePositionInfoValue}>{(debouncedIncome * 12).toLocaleString()}만원</span>
        </div>
      </div>
    </div>
  )
}
