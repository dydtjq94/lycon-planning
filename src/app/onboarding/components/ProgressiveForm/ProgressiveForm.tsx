'use client'

import React, { useState, useEffect } from 'react'
import type { OnboardingData } from '@/types'
import styles from './ProgressiveForm.module.css'

import { type RowId, type ProgressiveFormProps, rows, sectionRows } from './types'
import { type SectionId } from '../SectionForm'
import { TipPanel } from './tips'

export function ProgressiveForm({
  data,
  currentStepIndex = 0
}: ProgressiveFormProps) {
  const [activeRow, setActiveRow] = useState<RowId>('name')
  const [visibleSection, setVisibleSection] = useState<SectionId>('household')

  // 현재 행이 속한 섹션 찾기
  const getCurrentSection = (rowId: RowId): SectionId | null => {
    for (const [sectionId, rowIds] of Object.entries(sectionRows)) {
      if (rowIds.includes(rowId)) {
        return sectionId as SectionId
      }
    }
    return null
  }

  // currentStepIndex와 activeRow 동기화
  useEffect(() => {
    if (currentStepIndex >= 0 && currentStepIndex < rows.length) {
      const targetRowId = rows[currentStepIndex].id
      if (activeRow !== targetRowId) {
        setActiveRow(targetRowId)
      }

      // 섹션도 업데이트
      const section = getCurrentSection(targetRowId)
      if (section) {
        setVisibleSection(section)
      }
    }
  }, [currentStepIndex, activeRow])

  return (
    <div className={styles.rightPanelSplit}>
      <div className={styles.rightPanelFull}>
        <TipPanel
          activeSection={visibleSection}
          activeRow={activeRow}
          data={data}
        />
      </div>
    </div>
  )
}
