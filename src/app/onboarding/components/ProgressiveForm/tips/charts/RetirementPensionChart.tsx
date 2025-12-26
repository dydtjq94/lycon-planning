'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { OnboardingData } from '@/types'
import { calculateAge } from '../calculators'
import styles from './Charts.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface RetirementPensionChartProps {
  data: OnboardingData
}

// 금액 포맷 (만원 단위 → 억/만원 표시)
function formatAmount(value: number): string {
  if (value === 0) return '0만원'

  if (value >= 10000) {
    const billions = Math.floor(value / 10000)
    const remainder = value % 10000
    if (remainder > 0) {
      return `${billions}억 ${Math.round(remainder).toLocaleString()}만원`
    }
    return `${billions}억`
  }

  return `${Math.round(value).toLocaleString()}만원`
}

// 퇴직연금 수익률별 비교 (만원 단위로 작업)
function compareRetirementPensionReturnsInManwon(currentBalance: number, years: number) {
  const scenarios = [
    { type: '예금', rate: 2 },
    { type: '채권형', rate: 4 },
    { type: 'TDF', rate: 5.5 },
    { type: '주식형', rate: 7 },
  ]

  return scenarios.map(scenario => {
    // 복리 계산: 최종 잔액 = 현재잔액 * (1 + 연이율)^년수
    const finalBalance = Math.round(currentBalance * Math.pow(1 + scenario.rate / 100, years))
    const totalGrowth = finalBalance - currentBalance

    return {
      type: scenario.type,
      rate: scenario.rate,
      finalBalance,   // 만원 단위
      totalGrowth,    // 만원 단위
    }
  })
}

export function RetirementPensionChart({ data }: RetirementPensionChartProps) {
  // 퇴직연금 데이터가 없으면 안내 메시지
  if (!data.retirementPensionBalance || data.retirementPensionBalance === 0) {
    return (
      <div className={styles.chartPlaceholder}>
        <p>퇴직연금 잔액을 입력하면</p>
        <p>운용 수익률별 시뮬레이션을 확인할 수 있습니다</p>
      </div>
    )
  }

  // 입력값 그대로 사용 (이미 만원 단위)
  const currentBalance = data.retirementPensionBalance

  // 은퇴까지 남은 기간 계산
  const currentAge = data.birth_date ? calculateAge(data.birth_date) : 40
  const retirementAge = data.target_retirement_age || 60
  const yearsToRetirement = Math.max(1, retirementAge - currentAge)

  // 수익률별 시뮬레이션
  const comparison = compareRetirementPensionReturnsInManwon(currentBalance, yearsToRetirement)

  // 최저 vs 최고 차이
  const lowestBalance = comparison[0].finalBalance
  const highestBalance = comparison[comparison.length - 1].finalBalance
  const difference = highestBalance - lowestBalance

  // 차트 데이터 (만원 단위 그대로)
  const chartData = {
    labels: comparison.map(c => c.type),
    datasets: [
      {
        label: '예상 잔액',
        data: comparison.map(c => c.finalBalance),
        backgroundColor: ['#A8A29E', '#60A5FA', '#3B82F6', '#F97316'],
        borderRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { dataIndex: number }) => {
            const item = comparison[context.dataIndex]
            return [
              `연 ${item.rate}% 수익률`,
              `최종 잔액: ${formatAmount(item.finalBalance)}`,
              `수익금: +${formatAmount(item.totalGrowth)}`,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#78716C',
          font: { size: 11 },
        },
      },
      y: {
        display: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          color: '#A8A29E',
          font: { size: 10 },
          callback: (value: number | string) => `${Number(value).toLocaleString()}만`,
        },
      },
    },
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>퇴직연금 운용 수익률 비교</span>
        <span className={styles.chartSubtitle}>
          {yearsToRetirement}년 후 예상 잔액
        </span>
      </div>

      <div className={styles.chartBodyLarge}>
        <Bar data={chartData} options={options} />
      </div>

      <div className={styles.chartFooter}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatAmount(currentBalance)}</span>
          <span className={styles.statLabel}>현재 잔액</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValueWarning}>+{formatAmount(difference)}</span>
          <span className={styles.statLabel}>TDF vs 예금 차이</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValueSuccess}>{formatAmount(highestBalance)}</span>
          <span className={styles.statLabel}>주식형 7%</span>
        </div>
      </div>

      <div className={styles.savingsMessage}>
        DC형이라면 TDF(혼합형) 또는 주식형 펀드로 적극 운용을 권장합니다
      </div>
    </div>
  )
}
