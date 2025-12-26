'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import type { SectionId } from '../../SectionForm'
import type { RowId } from '../types'
import { getTipContent } from './tipContent'
import {
  TimelineChart,
  ProgressChart,
  IncomeChart,
  SavingsChart,
  LTVChart,
  AssetPieChart,
  DebtChart,
  WelcomeChart,
  NationalPensionChart,
  RetirementPensionChart,
  PersonalPensionChart,
  RetirementGapChart,
  IncomeRiskChart,
} from './charts'
import styles from './TipPanel.module.css'

interface TipPanelProps {
  activeSection: SectionId
  activeRow: RowId
  data: OnboardingData
}

// 항목별 차트 매핑 (rowId 기반)
// children은 별도 처리 (showChildrenTimeline prop 필요)
type ChartMapValue = React.ComponentType<{ data: OnboardingData; showChildrenTimeline?: boolean }> | null

const rowChartMap: Record<RowId, ChartMapValue> = {
  name: WelcomeChart,              // 첫 화면: 복리 성장 시뮬레이션
  birth_date: TimelineChart,       // 생애 타임라인
  children: TimelineChart,         // 자녀 교육/독립 타임라인
  retirement_age: RetirementGapChart, // 연금 공백 분석
  retirement_fund: ProgressChart,  // 목표 달성률
  labor_income: IncomeChart,       // 소득 구성
  business_income: IncomeRiskChart, // 소득 안정성 분석
  living_expenses: SavingsChart,   // 저축률 분석
  realEstate: LTVChart,            // 주거 현황
  asset: AssetPieChart,            // 자산 배분
  debt: DebtChart,                 // 부채 현황
  national_pension: NationalPensionChart,     // 국민연금 수령 시기별 비교
  retirement_pension: RetirementPensionChart, // 퇴직연금 운용 수익률 비교
  personal_pension: PersonalPensionChart,     // 개인연금 적립 시뮬레이션
}

export function TipPanel({ activeSection, activeRow, data }: TipPanelProps) {
  const tipContent = getTipContent(activeRow, activeSection, data)
  const insight = tipContent.insights?.(data)
  const ChartComponent = rowChartMap[activeRow]

  // children 항목에서는 자녀 타임라인 모드로 표시
  const showChildrenTimeline = activeRow === 'children'

  return (
    <div className={styles.tipPanel}>
      {/* 상단: TIP 텍스트 */}
      <div className={styles.tipArea}>
        <div className={styles.tipHeader}>
          <span className={styles.tipLabel}>Lycon AI</span>
          <h3 className={styles.tipTitle}>{tipContent.title}</h3>
        </div>
        <p className={styles.tipDescription}>{tipContent.description}</p>
        {insight && (
          <div className={styles.tipInsight}>
            {insight}
          </div>
        )}
      </div>

      {/* 하단: 차트 영역 */}
      {ChartComponent && (
        <div className={styles.chartArea}>
          <ChartComponent data={data} showChildrenTimeline={showChildrenTimeline} />
        </div>
      )}
    </div>
  )
}
