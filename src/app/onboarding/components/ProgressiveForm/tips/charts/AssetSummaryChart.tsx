'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

interface AssetSummaryChartProps {
  data: OnboardingData
}

export function AssetSummaryChart({ data }: AssetSummaryChartProps) {
  // 현금성 자산
  const cash = (data.cashCheckingAccount || 0) + (data.cashSavingsAccount || 0)
  // 투자 자산
  const invest = (data.investDomesticStock || 0) + (data.investForeignStock || 0) +
                 (data.investFund || 0) + (data.investOther || 0)
  const total = cash + invest

  const [debouncedTotal, setDebouncedTotal] = useState(0)
  const [debouncedCash, setDebouncedCash] = useState(0)
  const [debouncedInvest, setDebouncedInvest] = useState(0)
  const [showContent, setShowContent] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    setShowContent(false)

    debounceTimer.current = setTimeout(() => {
      setDebouncedTotal(total)
      setDebouncedCash(cash)
      setDebouncedInvest(invest)
      if (total > 0) {
        setShowContent(true)
      }
    }, 1500)

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [total, cash, invest])

  // 비율 계산
  const cashRatio = debouncedTotal > 0 ? Math.round((debouncedCash / debouncedTotal) * 100) : 0
  const investRatio = debouncedTotal > 0 ? Math.round((debouncedInvest / debouncedTotal) * 100) : 0

  // 팁 생성
  const getTip = () => {
    if (debouncedCash > 0 && debouncedInvest === 0) {
      return "투자 자산도 추가해보세요. 장기적으로 인플레이션을 이기려면 투자가 필요해요."
    }
    if (debouncedInvest > 0 && debouncedCash === 0) {
      return "비상금도 챙겨두세요. 최소 3~6개월 생활비는 현금으로 보유하는 게 좋아요."
    }
    if (cashRatio > 70) {
      return "현금 비중이 높아요. 일부를 투자로 돌리면 자산 증식에 도움이 됩니다."
    }
    if (investRatio > 90) {
      return "투자 비중이 높아요. 급할 때 쓸 비상금도 조금 남겨두세요."
    }
    return "현금과 투자의 균형이 좋아요. 꾸준히 유지해보세요."
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
        <span className={styles.assetSummaryLabel}>금융자산 합계</span>
        <span className={styles.assetSummaryTotal}>{formatAmount(debouncedTotal)}</span>
      </div>

      {/* 비율 바 */}
      <div className={styles.assetSummaryBar}>
        {debouncedCash > 0 && (
          <div
            className={styles.assetSummaryCash}
            style={{ width: `${cashRatio}%` }}
          />
        )}
        {debouncedInvest > 0 && (
          <div
            className={styles.assetSummaryInvest}
            style={{ width: `${investRatio}%` }}
          />
        )}
      </div>

      {/* 범례 */}
      <div className={styles.assetSummaryLegend}>
        {debouncedCash > 0 && (
          <div className={styles.assetSummaryLegendItem}>
            <span className={styles.assetSummaryDotCash} />
            <span>현금 {cashRatio}%</span>
          </div>
        )}
        {debouncedInvest > 0 && (
          <div className={styles.assetSummaryLegendItem}>
            <span className={styles.assetSummaryDotInvest} />
            <span>투자 {investRatio}%</span>
          </div>
        )}
      </div>

      {/* 팁 */}
      <div className={styles.assetSummaryTip}>
        {getTip()}
      </div>
    </div>
  )
}
