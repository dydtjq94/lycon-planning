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
import type { OnboardingData, FamilyMemberInput } from '@/types'
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
  showChildrenTimeline?: boolean  // 자녀 타임라인 모드
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

// 자녀 교육 단계 정보
function getEducationStage(age: number): { stage: string; yearsLeft: number; color: string } {
  if (age < 7) {
    return { stage: '미취학', yearsLeft: 7 - age, color: '#A78BFA' }
  } else if (age < 13) {
    return { stage: '초등학교', yearsLeft: 13 - age, color: '#60A5FA' }
  } else if (age < 16) {
    return { stage: '중학교', yearsLeft: 16 - age, color: '#34D399' }
  } else if (age < 19) {
    return { stage: '고등학교', yearsLeft: 19 - age, color: '#FBBF24' }
  } else if (age < 23) {
    return { stage: '대학교', yearsLeft: 23 - age, color: '#F97316' }
  } else {
    return { stage: '성인', yearsLeft: 0, color: '#78716C' }
  }
}

export function TimelineChart({ data, showChildrenTimeline }: TimelineChartProps) {
  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60
  const pensionStartAge = data.nationalPensionStartAge || DEFAULT_PENSION_START_AGE

  // 자녀가 있고 자녀 모드인 경우 자녀 타임라인 표시
  const hasChildren = data.children && data.children.length > 0

  if (hasChildren && showChildrenTimeline) {
    const childrenInfo = data.children.map((child: FamilyMemberInput, index: number) => {
      const age = getChildAge(child.birth_date)
      const edu = getEducationStage(age)
      const yearsToIndependence = Math.max(0, 23 - age)  // 대학 졸업 (23세) 기준
      const name = child.gender === 'male' ? `아들${data.children.length > 1 ? index + 1 : ''}` :
                   child.gender === 'female' ? `딸${data.children.length > 1 ? index + 1 : ''}` :
                   `자녀${index + 1}`
      return { name, age, edu, yearsToIndependence }
    })

    // 모든 자녀가 독립할 때까지 남은 최대 년수
    const maxYearsToIndependence = Math.max(...childrenInfo.map(c => c.yearsToIndependence))

    // 자녀별 막대 차트 데이터
    const chartData = {
      labels: childrenInfo.map(c => `${c.name} (${c.age}세)`),
      datasets: [
        {
          label: '독립까지',
          data: childrenInfo.map(c => c.yearsToIndependence),
          backgroundColor: childrenInfo.map(c => c.edu.color),
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
            label: (context: { raw: unknown, dataIndex: number }) => {
              const child = childrenInfo[context.dataIndex]
              return `${child.edu.stage} / 독립까지 ${context.raw}년`
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },
          ticks: {
            font: { size: 10 },
            color: '#78716C',
            callback: (value: unknown) => `${value}년`,
          },
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

    // 예상 교육비 계산 (1인당 평균 약 2억, 만원 단위)
    const totalEducationCost = childrenInfo.reduce((sum, child) => {
      if (child.age >= 23) return sum
      // 남은 교육 단계별 대략적 비용 (만원 단위)
      let cost = 0
      if (child.age < 7) cost += 3000  // 유아기
      if (child.age < 13) cost += 4000  // 초등
      if (child.age < 16) cost += 3000  // 중등
      if (child.age < 19) cost += 5000  // 고등
      if (child.age < 23) cost += 8000  // 대학
      return sum + cost  // 만원 단위 그대로
    }, 0)

    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>자녀 교육 타임라인</span>
          <span className={styles.chartSubtitle}>
            독립까지 최대 {maxYearsToIndependence}년
          </span>
        </div>
        <div className={styles.chartBody}>
          <Bar data={chartData} options={options} />
        </div>
        <div className={styles.chartFooter}>
          {childrenInfo.map((child, index) => (
            <div key={index} className={styles.statItem}>
              <span className={styles.statValue}>{child.edu.stage}</span>
              <span className={styles.statLabel}>{child.name}</span>
            </div>
          ))}
        </div>
        {totalEducationCost > 0 && (
          <div className={styles.savingsMessage}>
            남은 예상 교육비: 약 {Math.round(totalEducationCost / 10000)}억원
            (자녀 {childrenInfo.filter(c => c.yearsToIndependence > 0).length}명 기준)
          </div>
        )}
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
