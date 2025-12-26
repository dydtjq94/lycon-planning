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
import { LIFE_EXPECTANCY } from '../calculators'
import styles from './Charts.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface NationalPensionChartProps {
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

// 국민연금 수령 시기별 비교 계산 (만원 단위로 작업)
function compareNationalPensionTimingInManwon(monthlyPension: number, lifeExpectancy: number) {
  const timings = [
    { startAge: 60, adjustmentRate: -30 },
    { startAge: 62, adjustmentRate: -18 },
    { startAge: 65, adjustmentRate: 0 },
    { startAge: 67, adjustmentRate: 14.4 },
    { startAge: 70, adjustmentRate: 36 },
  ]

  return timings.map(timing => {
    const years = Math.max(0, lifeExpectancy - timing.startAge)
    const monthlyAmount = Math.round(monthlyPension * (1 + timing.adjustmentRate / 100))
    const totalAmount = monthlyAmount * 12 * years

    return {
      startAge: timing.startAge,
      adjustmentRate: timing.adjustmentRate,
      monthlyAmount,  // 만원 단위
      totalAmount,    // 만원 단위
      years,
    }
  })
}

export function NationalPensionChart({ data }: NationalPensionChartProps) {
  // 국민연금 데이터가 없으면 안내 메시지
  if (!data.nationalPension || data.nationalPension === 0) {
    return (
      <div className={styles.chartPlaceholder}>
        <p>국민연금 예상 수령액을 입력하면</p>
        <p>수령 시기별 비교를 확인할 수 있습니다</p>
      </div>
    )
  }

  // 입력값 그대로 사용 (이미 만원 단위)
  const monthlyPension = data.nationalPension
  const timingComparison = compareNationalPensionTimingInManwon(monthlyPension, LIFE_EXPECTANCY)

  // 차트 데이터 (만원 단위 그대로)
  const chartData = {
    labels: timingComparison.map(t => `${t.startAge}세`),
    datasets: [
      {
        label: '총 수령액',
        data: timingComparison.map(t => t.totalAmount),
        backgroundColor: timingComparison.map(t => {
          if (t.startAge === 65) return '#3B82F6'
          if (t.startAge < 65) return '#F97316'
          return '#10B981'
        }),
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
          title: (context: Array<{ label: string }>) => {
            const label = context[0].label
            const timing = timingComparison.find(t => `${t.startAge}세` === label)
            if (!timing) return label

            if (timing.adjustmentRate === 0) return `${label} 정상수령`
            if (timing.adjustmentRate < 0) return `${label} 조기수령 (${timing.adjustmentRate}%)`
            return `${label} 연기수령 (+${timing.adjustmentRate}%)`
          },
          label: (context: { dataIndex: number }) => {
            const timing = timingComparison[context.dataIndex]
            return [
              `월 ${formatAmount(timing.monthlyAmount)}`,
              `수령기간 ${timing.years}년`,
              `총액 ${formatAmount(timing.totalAmount)}`,
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

  // 최적 수령 시기 찾기 (총액 기준)
  const optimalTiming = [...timingComparison].sort((a, b) => b.totalAmount - a.totalAmount)[0]

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>국민연금 수령 시기별 비교</span>
        <span className={styles.chartSubtitle}>
          기대수명 {LIFE_EXPECTANCY}세 기준
        </span>
      </div>

      <div className={styles.chartBodyLarge}>
        <Bar data={chartData} options={options} />
      </div>

      <div className={styles.chartFooter}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatAmount(monthlyPension)}</span>
          <span className={styles.statLabel}>월 수령액 (65세)</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValueSuccess}>{optimalTiming.startAge}세</span>
          <span className={styles.statLabel}>최적 수령시기</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatAmount(optimalTiming.totalAmount)}</span>
          <span className={styles.statLabel}>최대 총액</span>
        </div>
      </div>

      {optimalTiming.startAge !== 65 && (
        <div className={styles.savingsMessage}>
          {optimalTiming.startAge < 65
            ? `조기수령 시 월 ${formatAmount(optimalTiming.monthlyAmount)}로 줄지만, 기대수명까지 총액은 더 많습니다.`
            : `${optimalTiming.startAge}세까지 연기하면 월 ${formatAmount(optimalTiming.monthlyAmount)}로 +${optimalTiming.adjustmentRate}% 증가합니다.`
          }
        </div>
      )}
    </div>
  )
}
