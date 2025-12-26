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
import { DEFAULT_PENSION_START_AGE } from '../calculators'
import styles from './Charts.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface RetirementGapChartProps {
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

// 연금 공백 분석 (만원 단위로 작업)
function analyzeRetirementGapInManwon(data: OnboardingData) {
  const retirementAge = data.target_retirement_age || 60
  const pensionStartAge = data.nationalPensionStartAge || DEFAULT_PENSION_START_AGE
  const gapYears = Math.max(0, pensionStartAge - retirementAge)

  // 월 생활비 (만원 단위)
  const monthlyExpense = data.livingExpenses || 300 // 기본값 300만원

  // 공백 기간 필요 자금
  const monthlyExpenseNeeded = monthlyExpense
  const totalGapFund = monthlyExpenseNeeded * 12 * gapYears

  // 현재 준비된 자금 (금융자산 총합)
  const cashAssets = (data.cashCheckingAccount || 0) + (data.cashSavingsAccount || 0)
  const investmentAssets = (data.investDomesticStock || 0) + (data.investForeignStock || 0) + (data.investFund || 0) + (data.investOther || 0)
  const currentAssets = cashAssets + investmentAssets

  // 준비율
  const preparationRate = totalGapFund > 0
    ? Math.min(100, Math.round(currentAssets / totalGapFund * 100))
    : 100

  return {
    retirementAge,
    pensionStartAge,
    gapYears,
    monthlyExpenseNeeded,  // 만원 단위
    totalGapFund,          // 만원 단위
    preparationRate,
  }
}

export function RetirementGapChart({ data }: RetirementGapChartProps) {
  const retirementAge = data.target_retirement_age || 60
  const pensionStartAge = data.nationalPensionStartAge || DEFAULT_PENSION_START_AGE

  // 은퇴 나이가 연금 수령 나이보다 높으면 공백 없음
  if (retirementAge >= pensionStartAge) {
    return (
      <div className={styles.chartPlaceholder}>
        <p>연금 공백이 없습니다</p>
        <p>{retirementAge}세 은퇴, {pensionStartAge}세 연금 수령</p>
      </div>
    )
  }

  const gapAnalysis = analyzeRetirementGapInManwon(data)

  // 공백 기간 연도별 데이터
  const gapYears = Array.from({ length: gapAnalysis.gapYears }, (_, i) => ({
    age: gapAnalysis.retirementAge + i,
    monthlyNeeded: gapAnalysis.monthlyExpenseNeeded,
    yearlyNeeded: gapAnalysis.monthlyExpenseNeeded * 12,
  }))

  // 차트 데이터 (만원 단위 그대로)
  const chartData = {
    labels: gapYears.map(y => `${y.age}세`),
    datasets: [
      {
        label: '필요 생활비',
        data: gapYears.map(y => y.yearlyNeeded),
        backgroundColor: '#F97316',
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
            const year = gapYears[context.dataIndex]
            return [
              `월 ${formatAmount(year.monthlyNeeded)}`,
              `연 ${formatAmount(year.yearlyNeeded)}`,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#78716C', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          color: '#A8A29E',
          font: { size: 10 },
          callback: (value: number | string) => `${Number(value).toLocaleString()}만`,
        },
      },
    },
  }

  // 준비율에 따른 상태
  let statusClass = styles.statValueWarning
  let statusText = '준비 필요'
  if (gapAnalysis.preparationRate >= 100) {
    statusClass = styles.statValueSuccess
    statusText = '준비 완료'
  } else if (gapAnalysis.preparationRate >= 70) {
    statusClass = styles.statValue
    statusText = '대부분 준비'
  } else if (gapAnalysis.preparationRate >= 30) {
    statusText = '추가 준비 필요'
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>연금 공백 기간 분석</span>
        <span className={styles.chartSubtitle}>
          {gapAnalysis.retirementAge}세 ~ {gapAnalysis.pensionStartAge}세 ({gapAnalysis.gapYears}년)
        </span>
      </div>

      <div className={styles.chartBodyLarge}>
        <Bar data={chartData} options={options} />
      </div>

      <div className={styles.chartFooter}>
        <div className={styles.statItem}>
          <span className={styles.statValueWarning}>{gapAnalysis.gapYears}년</span>
          <span className={styles.statLabel}>공백 기간</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatAmount(gapAnalysis.totalGapFund)}</span>
          <span className={styles.statLabel}>필요 자금</span>
        </div>
        <div className={styles.statItem}>
          <span className={statusClass}>{gapAnalysis.preparationRate}%</span>
          <span className={styles.statLabel}>{statusText}</span>
        </div>
      </div>

      <div className={styles.savingsMessage}>
        {gapAnalysis.preparationRate >= 100
          ? '연금 공백에 대비한 자금이 충분합니다.'
          : `공백 기간 동안 월 ${formatAmount(gapAnalysis.monthlyExpenseNeeded)}씩 ${gapAnalysis.gapYears}년간 필요합니다.`
        }
      </div>
    </div>
  )
}
