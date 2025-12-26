'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
)

interface WelcomeChartProps {
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

// 복리 성장 계산 (만원 단위로 작업)
function calculateCompoundGrowthInManwon(
  principal: number,
  monthlyContribution: number,
  annualRate: number,
  years: number
) {
  let balance = principal
  const monthlyRate = annualRate / 100 / 12

  // 연도별 데이터 저장
  const yearlyData: Array<{ year: number; value: number }> = [{ year: 0, value: balance }]

  for (let year = 1; year <= years; year++) {
    for (let month = 0; month < 12; month++) {
      balance = balance * (1 + monthlyRate) + monthlyContribution
    }
    yearlyData.push({ year, value: Math.round(balance) })
  }

  return {
    finalValue: Math.round(balance),
    yearlyData,
  }
}

export function WelcomeChart({}: WelcomeChartProps) {
  // 기본 시뮬레이션 값 (만원 단위)
  const monthlyContribution = 50 // 월 50만원
  const years = 30

  // 3가지 수익률 시나리오
  const scenarios = [
    { label: '예금 2%', rate: 2, color: '#A8A29E' },
    { label: '균형 5%', rate: 5, color: '#3B82F6' },
    { label: '적극 7%', rate: 7, color: '#F97316' },
  ]

  // 각 시나리오별 연도별 데이터 계산
  const scenarioResults = scenarios.map(scenario => {
    const result = calculateCompoundGrowthInManwon(
      0,
      monthlyContribution,
      scenario.rate,
      years
    )
    return {
      ...scenario,
      result,
    }
  })

  // 차트 라벨 (10년 단위)
  const labels = ['시작', '10년', '20년', '30년']
  const yearIndices = [0, 10, 20, 30]

  // 차트 데이터 (만원 단위 그대로)
  const chartData = {
    labels,
    datasets: scenarioResults.map(scenario => ({
      label: scenario.label,
      data: yearIndices.map(year => {
        const yearData = scenario.result.yearlyData.find(d => d.year === year)
        return yearData ? yearData.value : 0
      }),
      borderColor: scenario.color,
      backgroundColor: scenario.rate === 7
        ? 'rgba(249, 115, 22, 0.1)'
        : 'transparent',
      borderWidth: scenario.rate === 7 ? 3 : 2,
      pointRadius: scenario.rate === 7 ? [0, 4, 4, 6] : [0, 2, 2, 3],
      pointBackgroundColor: scenario.color,
      fill: scenario.rate === 7,
      tension: 0.3,
    })),
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: { dataset: { label?: string }, raw: unknown }) => {
            return `${context.dataset.label}: ${formatAmount(context.raw as number)}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#A8A29E',
          font: { size: 11 },
        },
        border: { display: false },
      },
      y: {
        min: 0,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          color: '#A8A29E',
          font: { size: 11 },
          callback: function(value: number | string) {
            return `${Number(value).toLocaleString()}만`
          },
        },
        border: { display: false },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }

  // 30년 후 최종 금액 비교
  const finalAmounts = scenarioResults.map(s => ({
    label: s.label.split(' ')[0],
    rate: s.rate,
    amount: s.result.finalValue,
    color: s.color,
  }))

  // 총 납입금 (만원 단위)
  const totalContribution = monthlyContribution * 12 * years

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>월 50만원 x 30년 복리 효과</span>
        <span className={styles.chartSubtitle}>
          납입금 {formatAmount(totalContribution)}
        </span>
      </div>

      <div className={styles.chartBodyLarge}>
        <Line data={chartData} options={options} />
      </div>

      <div className={styles.chartFooter}>
        {finalAmounts.map((item, index) => (
          <div key={index} className={styles.statItem}>
            <span
              className={item.rate === 7 ? styles.statValueWarning : styles.statValue}
              style={{ color: item.color }}
            >
              {formatAmount(item.amount)}
            </span>
            <span className={styles.statLabel}>{item.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.savingsMessage}>
        오늘 시작하면 10년 뒤보다 월 저축액이 절반으로 줄어듭니다
      </div>
    </div>
  )
}
