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
import {
  calculateMonthlyIncome,
  calculatePensionReplacement,
  yearsToRetirement,
  DEFAULT_PENSION_START_AGE,
} from '../calculators'
import { formatMoney } from '../formatUtils'
import styles from './Charts.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

interface PensionStackChartProps {
  data: OnboardingData
}

export function PensionStackChart({ data }: PensionStackChartProps) {
  const monthlyIncome = calculateMonthlyIncome(data)
  const replacementRate = calculatePensionReplacement(data)

  // 연금 수령 시작 나이
  const pensionStartAge = data.nationalPensionStartAge || DEFAULT_PENSION_START_AGE
  const retirementAge = data.target_retirement_age || 60

  // 연금 공백 기간
  const pensionGap = Math.max(0, pensionStartAge - retirementAge)

  // 3층 연금 분석
  // 1층: 국민연금
  const nationalPension = data.nationalPension || 0

  // 2층: 퇴직연금 (잔액을 20년으로 나눠 월 수령액 추정)
  const retirementPensionMonthly = data.retirementPensionBalance
    ? Math.round(data.retirementPensionBalance / (20 * 12))
    : 0

  // 3층: 개인연금 (IRP + 연금저축을 20년으로 나눠 월 수령액 추정)
  const personalPensionBalance = (data.irpBalance || 0) + (data.pensionSavingsBalance || 0)
  const personalPensionMonthly = personalPensionBalance > 0
    ? Math.round(personalPensionBalance / (20 * 12))
    : 0

  // 기타 연금
  const otherPension = data.otherPensionMonthly || 0

  const totalMonthlyPension = nationalPension + retirementPensionMonthly + personalPensionMonthly + otherPension

  // 연금이 하나도 없는 경우
  if (totalMonthlyPension === 0 && !data.nationalPension && !data.retirementPensionBalance && personalPensionBalance === 0) {
    return (
      <div className={styles.chartPlaceholder}>
        <span>연금 정보를 입력하면</span>
        <span>은퇴 후 소득 분석이 표시됩니다</span>
      </div>
    )
  }

  // 연금 구성 데이터
  const pensionItems = [
    { label: '국민연금', amount: nationalPension, color: '#3B82F6' },
    { label: '퇴직연금', amount: retirementPensionMonthly, color: '#10B981' },
    { label: '개인연금', amount: personalPensionMonthly, color: '#F59E0B' },
  ].filter(item => item.amount > 0)

  if (otherPension > 0) {
    pensionItems.push({ label: '기타연금', amount: otherPension, color: '#8B5CF6' })
  }

  const chartData = {
    labels: pensionItems.map(item => item.label),
    datasets: [
      {
        data: pensionItems.map(item => item.amount),
        backgroundColor: pensionItems.map(item => item.color),
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

  // 소득대체율 메시지
  const getReplacementMessage = () => {
    if (monthlyIncome === 0) return null
    if (replacementRate < 30) return '소득대체율이 낮습니다. 추가 연금 저축을 권장합니다.'
    if (replacementRate < 50) return '소득대체율이 다소 낮습니다. 개인연금 추가 가입을 고려하세요.'
    if (replacementRate < 70) return '적정 수준입니다. 은퇴 후 안정적인 소득이 예상됩니다.'
    return '우수한 소득대체율입니다.'
  }

  // 연금 공백 경고
  const getGapMessage = () => {
    if (pensionGap <= 0) return null
    return `은퇴(${retirementAge}세) ~ 연금 수령(${pensionStartAge}세) 사이 ${pensionGap}년 공백이 있습니다.`
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>3층 연금 구조</span>
        <span className={styles.chartSubtitle}>예상 월 수령액</span>
      </div>

      {pensionItems.length > 0 && (
        <div className={styles.chartBody}>
          <Bar data={chartData} options={options} />
        </div>
      )}

      <div className={styles.chartFooter}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatMoney(totalMonthlyPension)}</span>
          <span className={styles.statLabel}>월 예상 연금</span>
        </div>
        {monthlyIncome > 0 && (
          <div className={styles.statItem}>
            <span className={`${styles.statValue} ${replacementRate < 50 ? styles.statValueWarning : styles.statValueSuccess}`}>
              {replacementRate}%
            </span>
            <span className={styles.statLabel}>소득대체율</span>
          </div>
        )}
      </div>

      <div className={styles.savingsMessage}>
        {getGapMessage() || getReplacementMessage()}
      </div>
    </div>
  )
}
