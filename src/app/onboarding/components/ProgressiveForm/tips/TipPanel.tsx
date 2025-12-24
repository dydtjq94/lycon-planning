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
  PensionStackChart,
} from './charts'
import styles from './TipPanel.module.css'

interface TipPanelProps {
  activeSection: SectionId
  activeRow: RowId
  data: OnboardingData
}

// 섹션별 차트 매핑
const sectionChartMap: Record<SectionId, React.ComponentType<{ data: OnboardingData }> | null> = {
  household: TimelineChart,
  goals: ProgressChart,
  income: IncomeChart,
  expense: SavingsChart,
  realEstate: LTVChart,
  asset: AssetPieChart,
  debt: DebtChart,
  pension: PensionStackChart,
}

export function TipPanel({ activeSection, activeRow, data }: TipPanelProps) {
  const tipContent = getTipContent(activeRow, activeSection)
  const insight = tipContent.insights?.(data)
  const ChartComponent = sectionChartMap[activeSection]

  return (
    <div className={styles.tipPanel}>
      {/* 상단: 차트 영역 */}
      {ChartComponent && (
        <div className={styles.chartArea}>
          <ChartComponent data={data} />
        </div>
      )}

      {/* 하단: TIP 텍스트 */}
      <div className={styles.tipArea}>
        <div className={styles.tipHeader}>
          <span className={styles.tipLabel}>TIP</span>
          <h3 className={styles.tipTitle}>{tipContent.title}</h3>
        </div>
        <p className={styles.tipDescription}>{tipContent.description}</p>
        {insight && (
          <div className={styles.tipInsight}>
            {insight}
          </div>
        )}
      </div>
    </div>
  )
}
