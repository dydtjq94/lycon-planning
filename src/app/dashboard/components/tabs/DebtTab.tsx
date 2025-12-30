'use client'

import { CreditCard } from 'lucide-react'
import type { OnboardingData } from '@/types'
import styles from './DebtTab.module.css'

interface DebtTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function DebtTab({ data, onUpdateData }: DebtTabProps) {
  return (
    <div className={styles.container}>
      {/* 왼쪽: 부채 입력 */}
      <div className={styles.inputPanel}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>주택 관련 대출</span>
          </div>
          <p className={styles.placeholder}>주택담보대출, 전세대출 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>신용 대출</span>
          </div>
          <p className={styles.placeholder}>신용대출, 마이너스통장 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>기타 부채</span>
          </div>
          <p className={styles.placeholder}>카드론, 학자금대출 등</p>
        </div>

        <p className={styles.infoText}>
          부채 현황을 입력하면 상환 계획 분석이 가능합니다.
        </p>
      </div>

      {/* 오른쪽: 인사이트 */}
      <div className={styles.insightPanel}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>총 부채</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>월 상환액</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>DTI</span>
            <span className={styles.summaryValueLarge}>-</span>
          </div>
        </div>

        <div className={styles.emptyState}>
          <CreditCard size={40} />
          <p>부채 정보를 입력하면 분석 결과가 표시됩니다</p>
        </div>
      </div>
    </div>
  )
}
