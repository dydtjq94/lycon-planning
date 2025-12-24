'use client'

import React from 'react'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
} from 'chart.js'
import type { OnboardingData } from '@/types'
import { calculateMonthlyExpense } from '../calculators'
import { formatMoney } from '../formatUtils'
import styles from './Charts.module.css'

ChartJS.register(ArcElement, Tooltip)

interface AssetPieChartProps {
  data: OnboardingData
}

export function AssetPieChart({ data }: AssetPieChartProps) {
  // 현금성 자산
  const cashAssets = (data.cashCheckingAccount || 0) + (data.cashSavingsAccount || 0)

  // 투자자산
  const investAssets =
    (data.investDomesticStock || 0) +
    (data.investForeignStock || 0) +
    (data.investFund || 0) +
    (data.investOther || 0)

  const totalAssets = cashAssets + investAssets

  // 비상금 분석 (월 생활비의 6개월치)
  const monthlyExpense = calculateMonthlyExpense(data)
  const recommendedEmergencyFund = monthlyExpense * 6
  const emergencyFundMonths = monthlyExpense > 0 ? Math.round(cashAssets / monthlyExpense) : 0

  if (totalAssets === 0) {
    return (
      <div className={styles.chartPlaceholder}>
        <span>금융자산을 입력하면</span>
        <span>자산 배분 분석이 표시됩니다</span>
      </div>
    )
  }

  const cashRatio = Math.round((cashAssets / totalAssets) * 100)
  const investRatio = 100 - cashRatio

  const chartData = {
    labels: ['현금성 자산', '투자자산'],
    datasets: [
      {
        data: [cashAssets, investAssets],
        backgroundColor: ['#60A5FA', '#10B981'],
        borderWidth: 0,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { raw: unknown; label: string }) => {
            const value = context.raw as number
            const ratio = Math.round((value / totalAssets) * 100)
            return `${context.label}: ${formatMoney(value)} (${ratio}%)`
          },
        },
      },
    },
  }

  // 비상금 상태 메시지
  const getEmergencyFundMessage = () => {
    if (monthlyExpense === 0) return null
    if (emergencyFundMonths < 3) return `비상금 ${emergencyFundMonths}개월치로 부족합니다. 최소 3-6개월치를 권장합니다.`
    if (emergencyFundMonths < 6) return `비상금 ${emergencyFundMonths}개월치입니다. 6개월치면 안정적입니다.`
    return `비상금 ${emergencyFundMonths}개월치로 충분합니다.`
  }

  // 자산 배분 조언
  const getAllocationAdvice = () => {
    if (cashRatio > 70) return '현금 비중이 높습니다. 투자 다변화를 고려하세요.'
    if (investRatio > 80) return '투자 비중이 높습니다. 비상금 확보를 권장합니다.'
    return '균형 잡힌 자산 배분입니다.'
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>금융자산 배분</span>
        <span className={styles.chartSubtitle}>총 {formatMoney(totalAssets)}</span>
      </div>

      <div className={styles.doughnutWrapper}>
        <div className={styles.doughnutChart}>
          <Doughnut data={chartData} options={options} />
          <div className={styles.doughnutCenter}>
            <span className={styles.doughnutCenterValue}>{investRatio}%</span>
            <span className={styles.doughnutCenterLabel}>투자</span>
          </div>
        </div>

        <div className={styles.doughnutLegend}>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: '#60A5FA' }} />
            <span className={styles.legendLabel}>현금 {cashRatio}%</span>
            <span className={styles.legendValue}>{formatMoney(cashAssets)}</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: '#10B981' }} />
            <span className={styles.legendLabel}>투자 {investRatio}%</span>
            <span className={styles.legendValue}>{formatMoney(investAssets)}</span>
          </div>
        </div>
      </div>

      <div className={styles.savingsMessage}>
        {getEmergencyFundMessage() || getAllocationAdvice()}
      </div>
    </div>
  )
}
