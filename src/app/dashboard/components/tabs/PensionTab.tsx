'use client'

import { Landmark } from 'lucide-react'
import type { OnboardingData } from '@/types'
import styles from './PensionTab.module.css'

interface PensionTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function PensionTab({ data, onUpdateData }: PensionTabProps) {
  return (
    <div className={styles.container}>
      {/* 왼쪽: 연금 입력 */}
      <div className={styles.inputPanel}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>국민연금</span>
          </div>
          <p className={styles.placeholder}>예상 수령액, 수령 시기 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>퇴직연금</span>
          </div>
          <p className={styles.placeholder}>DC, DB, IRP 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>개인연금</span>
          </div>
          <p className={styles.placeholder}>연금저축, 변액연금 등</p>
        </div>

        <p className={styles.infoText}>
          연금 정보를 입력하면 은퇴 후 소득 분석이 가능합니다.
        </p>
      </div>

      {/* 오른쪽: 인사이트 */}
      <div className={styles.insightPanel}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>연금자산 총액</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>예상 연금소득</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>소득대체율</span>
            <span className={styles.summaryValueLarge}>-</span>
          </div>
        </div>

        <div className={styles.emptyState}>
          <Landmark size={40} />
          <p>연금 정보를 입력하면 분석 결과가 표시됩니다</p>
        </div>
      </div>
    </div>
  )
}
