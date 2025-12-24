'use client'

import React from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'
import type { OnboardingData } from '@/types'
import { calculateMonthlyIncome, yearsToRetirement } from '../calculators'
import { formatMoney, formatMoneyShort } from '../formatUtils'
import styles from './Charts.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

interface IncomeChartProps {
  data: OnboardingData
}

export function IncomeChart({ data }: IncomeChartProps) {
  // 소득 항목 수집
  const incomeItems: { label: string; amount: number }[] = []

  // 본인 근로소득
  if (data.laborIncome) {
    const monthly = data.laborIncomeFrequency === 'yearly'
      ? data.laborIncome / 12
      : data.laborIncome
    incomeItems.push({ label: '본인 근로', amount: monthly })
  }

  // 배우자 근로소득
  if (data.spouseLaborIncome) {
    const monthly = data.spouseLaborIncomeFrequency === 'yearly'
      ? data.spouseLaborIncome / 12
      : data.spouseLaborIncome
    incomeItems.push({ label: '배우자 근로', amount: monthly })
  }

  // 본인 사업소득
  if (data.businessIncome) {
    const monthly = data.businessIncomeFrequency === 'yearly'
      ? data.businessIncome / 12
      : data.businessIncome
    incomeItems.push({ label: '본인 사업', amount: monthly })
  }

  // 배우자 사업소득
  if (data.spouseBusinessIncome) {
    const monthly = data.spouseBusinessIncomeFrequency === 'yearly'
      ? data.spouseBusinessIncome / 12
      : data.spouseBusinessIncome
    incomeItems.push({ label: '배우자 사업', amount: monthly })
  }

  const totalMonthlyIncome = calculateMonthlyIncome(data)
  const yearsLeft = data.birth_date && data.target_retirement_age
    ? yearsToRetirement(data.birth_date, data.target_retirement_age)
    : 0

  // 은퇴까지 예상 총 근로소득 (억 단위)
  const totalEarningsUntilRetirement = totalMonthlyIncome * 12 * yearsLeft

  if (incomeItems.length === 0) {
    return (
      <div className={styles.chartPlaceholder}>
        <span>소득 정보를 입력하면</span>
        <span>소득 구성 분석이 표시됩니다</span>
      </div>
    )
  }

  const chartData = {
    labels: incomeItems.map(item => item.label),
    datasets: [
      {
        data: incomeItems.map(item => item.amount),
        backgroundColor: [
          '#3B82F6',  // 본인 근로 - 파랑
          '#60A5FA',  // 배우자 근로 - 연파랑
          '#10B981',  // 본인 사업 - 초록
          '#34D399',  // 배우자 사업 - 연초록
        ],
        borderRadius: 4,
      },
    ],
  }

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { raw: unknown }) => `${formatMoney(context.raw as number)}/월`,
        },
      },
    },
    scales: {
      x: {
        display: false,
        grid: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: {
          font: { size: 12 },
          color: '#57534E',
        },
      },
    },
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>가구 소득 구성</span>
        <span className={styles.chartSubtitle}>월 기준</span>
      </div>
      <div className={styles.chartBody}>
        <Bar data={chartData} options={options} />
      </div>
      <div className={styles.chartFooter}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatMoney(totalMonthlyIncome)}</span>
          <span className={styles.statLabel}>월 총소득</span>
        </div>
        {yearsLeft > 0 && (
          <div className={styles.statItem}>
            <span className={styles.statValue}>{formatMoney(totalEarningsUntilRetirement)}</span>
            <span className={styles.statLabel}>은퇴까지 예상 소득</span>
          </div>
        )}
      </div>
    </div>
  )
}
