'use client'

import { Home } from 'lucide-react'
import type { OnboardingData } from '@/types'
import styles from './RealEstateTab.module.css'

interface RealEstateTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function RealEstateTab({ data, onUpdateData }: RealEstateTabProps) {
  return (
    <div className={styles.container}>
      {/* 왼쪽: 부동산 입력 */}
      <div className={styles.inputPanel}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>거주 부동산</span>
          </div>
          <p className={styles.placeholder}>자가, 전세, 월세 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>투자 부동산</span>
          </div>
          <p className={styles.placeholder}>임대 수익용 부동산 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>부동산 대출</span>
          </div>
          <p className={styles.placeholder}>주택담보대출, 전세대출 등</p>
        </div>

        <p className={styles.infoText}>
          부동산 정보를 입력하면 자산 현황 분석이 가능합니다.
        </p>
      </div>

      {/* 오른쪽: 인사이트 */}
      <div className={styles.insightPanel}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>부동산 총 자산</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>부동산 대출</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>순자산</span>
            <span className={styles.summaryValueLarge}>-</span>
          </div>
        </div>

        <div className={styles.emptyState}>
          <Home size={40} />
          <p>부동산 정보를 입력하면 분석 결과가 표시됩니다</p>
        </div>
      </div>
    </div>
  )
}
