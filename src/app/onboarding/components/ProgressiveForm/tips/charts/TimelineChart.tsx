'use client'

import React from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { OnboardingData } from '@/types'
import {
  calculateAge,
  yearsToRetirement,
  LIFE_EXPECTANCY,
  DEFAULT_PENSION_START_AGE,
} from '../calculators'
import styles from './Charts.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface TimelineChartProps {
  data: OnboardingData
}

export function TimelineChart({ data }: TimelineChartProps) {
  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60
  const pensionStartAge = data.nationalPensionStartAge || DEFAULT_PENSION_START_AGE

  // 데이터가 없으면 기본 안내 표시
  if (!data.birth_date) {
    return (
      <div className={styles.chartPlaceholder}>
        <p>생년월일을 입력하면</p>
        <p>생애 타임라인을 확인할 수 있습니다</p>
      </div>
    )
  }

  const yearsLeft = yearsToRetirement(data.birth_date, retirementAge)
  const yearsAfterRetirement = LIFE_EXPECTANCY - retirementAge
  const pensionGap = Math.max(0, pensionStartAge - retirementAge)
  const pensionYears = LIFE_EXPECTANCY - pensionStartAge

  // 가로 막대 차트 데이터
  const chartData = {
    labels: ['생애 타임라인'],
    datasets: [
      {
        label: `현재 ~ 은퇴 (${yearsLeft}년)`,
        data: [yearsLeft],
        backgroundColor: '#3B82F6',
        borderRadius: 4,
      },
      {
        label: pensionGap > 0 ? `연금 공백 (${pensionGap}년)` : '',
        data: [pensionGap],
        backgroundColor: '#F97316',
        borderRadius: 4,
      },
      {
        label: `연금 수령 (${pensionYears}년)`,
        data: [pensionYears],
        backgroundColor: '#10B981',
        borderRadius: 4,
      },
    ].filter(ds => ds.data[0] > 0),
  }

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 8,
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: { dataset: { label?: string }, raw: unknown }) => {
            return `${context.dataset.label}`
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        display: false,
      },
      y: {
        stacked: true,
        display: false,
      },
    },
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>생애 타임라인</span>
        <span className={styles.chartSubtitle}>
          현재 {currentAge}세 / 기대수명 {LIFE_EXPECTANCY}세
        </span>
      </div>
      <div className={styles.chartBody}>
        <Bar data={chartData} options={options} />
      </div>
      <div className={styles.chartFooter}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{yearsLeft}년</span>
          <span className={styles.statLabel}>은퇴까지</span>
        </div>
        {pensionGap > 0 && (
          <div className={styles.statItem}>
            <span className={styles.statValueWarning}>{pensionGap}년</span>
            <span className={styles.statLabel}>연금 공백</span>
          </div>
        )}
        <div className={styles.statItem}>
          <span className={styles.statValue}>{yearsAfterRetirement}년</span>
          <span className={styles.statLabel}>은퇴 후 생활</span>
        </div>
      </div>
    </div>
  )
}
