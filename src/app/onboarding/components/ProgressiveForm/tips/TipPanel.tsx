'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import type { SectionId } from '../../SectionForm'
import type { RowId } from '../types'
import { getTipContent } from './tipContent'
import {
  WelcomeChart,
  LifeNavigationChart,
  ChildCostChart,
  RetirementCountdown,
  RetirementGoalChart,
} from './charts'
import styles from './TipPanel.module.css'

interface TipPanelProps {
  activeSection: SectionId
  activeRow: RowId
  data: OnboardingData
}

// 1번, 2번, 3번 차트 표시 (나머지는 단순 텍스트)
type ChartMapValue = React.ComponentType<{ data: OnboardingData }> | null

const rowChartMap: Partial<Record<RowId, ChartMapValue>> = {
  name: WelcomeChart,              // 첫 화면: 명언
  birth_date: LifeNavigationChart, // 인생 네비게이션
  children: ChildCostChart,        // 자녀 양육비 차트
  retirement_age: RetirementCountdown, // 은퇴 카운트다운
  retirement_fund: RetirementGoalChart, // 목표 자산 가이드
}

export function TipPanel({ activeSection, activeRow, data }: TipPanelProps) {
  const tipContent = getTipContent(activeRow, activeSection, data)
  const ChartComponent = rowChartMap[activeRow]

  return (
    <div className={styles.tipPanel}>
      {/* TIP 텍스트 */}
      <div key={`tip-${activeRow}`} className={styles.tipArea}>
        <div className={styles.tipHeader}>
          <span className={styles.tipLabel}>Lycon</span>
          <h3 className={styles.tipTitle}>{tipContent.title}</h3>
        </div>
        <p className={styles.tipDescription}>{tipContent.description}</p>
      </div>

      {/* 차트 영역 (1번, 2번만) */}
      {ChartComponent && (
        <div key={`chart-${activeRow}`} className={styles.chartArea}>
          <ChartComponent data={data} />
        </div>
      )}
    </div>
  )
}
