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
  showChildrenTimeline?: boolean
}

// 자녀 나이 계산
function getChildAge(birthDate: string | undefined): number {
  if (!birthDate) return 0
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return Math.max(0, age)
}

// 물가상승률 적용 (연 3%)
const INFLATION_RATE = 0.03

function applyInflation(amount: number, yearsFromNow: number): number {
  return Math.round(amount * Math.pow(1 + INFLATION_RATE, yearsFromNow))
}

// 나이별 연간 비용 계산 (만원 단위, 물가상승률 반영)
function getYearlyCostByAge(
  age: number,
  currentAge: number,
  isMale: boolean,
  marriageAge: number
): {
  childcare: number
  education: number
  allowance: number
  tuition: number
  wedding: number
} {
  const yearsFromNow = age - currentAge
  const cost = {
    childcare: 0,
    education: 0,
    allowance: 0,
    tuition: 0,
    wedding: 0,
  }

  // 양육비 (0-6세) - 연 600만원
  if (age <= 6) {
    cost.childcare = applyInflation(600, yearsFromNow)
  }

  // 교육비 + 용돈
  if (age >= 7 && age <= 12) {
    // 초등학교
    cost.education = applyInflation(300, yearsFromNow)
    cost.allowance = applyInflation(36, yearsFromNow)
  } else if (age >= 13 && age <= 15) {
    // 중학교
    cost.education = applyInflation(400, yearsFromNow)
    cost.allowance = applyInflation(60, yearsFromNow)
  } else if (age >= 16 && age <= 18) {
    // 고등학교
    cost.education = applyInflation(600, yearsFromNow)
    cost.allowance = applyInflation(120, yearsFromNow)
  } else if (age >= 19 && age <= 22) {
    // 대학교
    cost.tuition = applyInflation(800, yearsFromNow)
    cost.allowance = applyInflation(360, yearsFromNow)
  }

  // 결혼 자금 (남자 1.3억, 여자 8천)
  if (age === marriageAge) {
    const weddingBase = isMale ? 13000 : 8000
    cost.wedding = applyInflation(weddingBase, yearsFromNow)
  }

  return cost
}

export function TimelineChart({ data, showChildrenTimeline }: TimelineChartProps) {
  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60
  const pensionStartAge = data.nationalPensionStartAge || DEFAULT_PENSION_START_AGE

  const hasChildren = data.children && data.children.length > 0

  if (hasChildren && showChildrenTimeline) {
    // 모든 자녀의 총 비용 카테고리별 계산
    const totals = {
      childcare: 0,   // 양육비
      education: 0,   // 교육비
      allowance: 0,   // 용돈
      tuition: 0,     // 대학등록금
      wedding: 0,     // 결혼자금
    }

    data.children.forEach(child => {
      const childCurrentAge = getChildAge(child.birth_date)
      const isMale = child.gender === 'male'
      const marriageAge = isMale ? 34 : 30

      for (let childAge = childCurrentAge; childAge <= marriageAge; childAge++) {
        const cost = getYearlyCostByAge(childAge, childCurrentAge, isMale, marriageAge)
        totals.childcare += cost.childcare
        totals.education += cost.education
        totals.allowance += cost.allowance
        totals.tuition += cost.tuition
        totals.wedding += cost.wedding
      }
    })

    const totalCost = totals.childcare + totals.education + totals.allowance + totals.tuition + totals.wedding

    const chartData = {
      labels: ['양육비', '교육비', '용돈', '대학등록금', '결혼자금'],
      datasets: [
        {
          data: [totals.childcare, totals.education, totals.allowance, totals.tuition, totals.wedding],
          backgroundColor: ['#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#F97316'],
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
            label: (context: { raw: unknown }) => {
              const value = context.raw as number
              return `${value.toLocaleString()}만원`
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#F5F5F4' },
          ticks: {
            font: { size: 10 },
            color: '#78716C',
            callback: (value: unknown) => {
              const v = value as number
              return v >= 10000 ? `${(v / 10000).toFixed(0)}억` : `${v}만`
            },
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { size: 11 },
            color: '#44403C',
          },
        },
      },
    }

    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>자녀 양육 총 비용</span>
          <span className={styles.chartSubtitle}>
            자녀 {data.children.length}명 기준
          </span>
        </div>
        <div className={styles.chartBodyLarge}>
          <Bar data={chartData} options={options} />
        </div>
        <div className={styles.chartFooter}>
          <div className={styles.statItem}>
            <span className={styles.statValueWarning}>
              {totalCost >= 10000
                ? `${(totalCost / 10000).toFixed(1)}억`
                : `${totalCost.toLocaleString()}만`}
            </span>
            <span className={styles.statLabel}>예상 총 비용</span>
          </div>
        </div>
      </div>
    )
  }

  // 기본 생애 타임라인
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
