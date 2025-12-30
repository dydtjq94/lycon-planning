'use client'

import { TrendingDown } from 'lucide-react'
import type { OnboardingData } from '@/types'
import styles from './ExpenseTab.module.css'

interface ExpenseTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function ExpenseTab({ data, onUpdateData }: ExpenseTabProps) {
  return (
    <div className={styles.container}>
      {/* 왼쪽: 지출 입력 */}
      <div className={styles.inputPanel}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>고정 지출</span>
          </div>
          <p className={styles.placeholder}>주거비, 보험료, 대출상환 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>생활 지출</span>
          </div>
          <p className={styles.placeholder}>식비, 교통비, 통신비 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>기타 지출</span>
          </div>
          <p className={styles.placeholder}>교육비, 여가비, 경조사비 등</p>
        </div>

        <p className={styles.infoText}>
          각 항목별 상세 지출을 입력하면 더 정확한 분석이 가능합니다.
        </p>
      </div>

      {/* 오른쪽: 인사이트 */}
      <div className={styles.insightPanel}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>월 총 지출</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>연 총 지출</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>소득 대비 지출률</span>
            <span className={styles.summaryValueLarge}>-</span>
          </div>
        </div>

        <div className={styles.emptyState}>
          <TrendingDown size={40} />
          <p>지출을 입력하면 분석 결과가 표시됩니다</p>
        </div>
      </div>
    </div>
  )
}
