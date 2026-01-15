'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

interface AssetSummaryChartProps {
  data: OnboardingData
}

export function AssetSummaryChart({ data }: AssetSummaryChartProps) {
  // 입출금통장 (즉시 사용 가능한 현금) - savingsAccounts에서 checking 타입 합산
  let cash = 0
  if (data.savingsAccounts) {
    data.savingsAccounts.forEach(account => {
      if (account.type === 'checking') {
        cash += account.balance || 0
      }
    })
  }
  // 월 생활비
  const monthlyExpense = data.livingExpenses || 0

  const [debouncedCash, setDebouncedCash] = useState(0)
  const [showContent, setShowContent] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    setShowContent(false)

    debounceTimer.current = setTimeout(() => {
      setDebouncedCash(cash)
      if (cash > 0) {
        setShowContent(true)
      }
    }, 1500)

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [cash])

  // 비상금 개월 수 계산
  const emergencyMonths = monthlyExpense > 0 ? Math.floor(debouncedCash / monthlyExpense) : 0

  // 팁 생성
  const getTip = () => {
    if (monthlyExpense === 0) {
      return "생활비를 입력하면 비상금이 몇 개월치인지 확인할 수 있어요."
    }
    if (emergencyMonths < 3) {
      return "비상금이 부족해요. 최소 3개월 생활비는 현금으로 보유하는 게 좋아요."
    }
    if (emergencyMonths < 6) {
      return "기본 비상금은 확보했어요. 6개월치까지 모아두면 더 안전해요."
    }
    if (emergencyMonths <= 12) {
      return "충분한 비상금을 보유하고 있어요. 나머지는 투자로 굴려보세요."
    }
    return "비상금이 많아요. 일부는 투자나 예금으로 굴리는 게 효율적이에요."
  }

  // 금액 포맷
  const formatAmount = (val: number) => {
    if (val >= 10000) return `${(val / 10000).toFixed(val % 10000 === 0 ? 0 : 1)}억`
    return `${val.toLocaleString()}만원`
  }

  if (!showContent) {
    return null
  }

  return (
    <div className={styles.assetSummary}>
      <div className={styles.assetSummaryHeader}>
        <span className={styles.assetSummaryLabel}>보유 현금</span>
        <span className={styles.assetSummaryTotal}>{formatAmount(debouncedCash)}</span>
      </div>

      {/* 비상금 개월 수 표시 */}
      {monthlyExpense > 0 && (
        <>
          <div className={styles.assetSummaryBar}>
            <div
              className={styles.assetSummaryCash}
              style={{ width: `${Math.min(emergencyMonths / 12 * 100, 100)}%` }}
            />
          </div>

          <div className={styles.assetSummaryLegend}>
            <div className={styles.assetSummaryLegendItem}>
              <span className={styles.assetSummaryDotCash} />
              <span>생활비 {emergencyMonths}개월분</span>
            </div>
          </div>
        </>
      )}

      {/* 팁 */}
      <div className={styles.assetSummaryTip}>
        {getTip()}
      </div>
    </div>
  )
}
