'use client'

import { Wallet } from 'lucide-react'
import type { OnboardingData } from '@/types'
import styles from './AssetTab.module.css'

interface AssetTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function AssetTab({ data, onUpdateData }: AssetTabProps) {
  return (
    <div className={styles.container}>
      {/* 왼쪽: 금융자산 입력 */}
      <div className={styles.inputPanel}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>현금성 자산</span>
          </div>
          <p className={styles.placeholder}>입출금통장, 예적금 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>투자 자산</span>
          </div>
          <p className={styles.placeholder}>주식, 펀드, ETF 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>기타 자산</span>
          </div>
          <p className={styles.placeholder}>가상화폐, 금 등</p>
        </div>

        <p className={styles.infoText}>
          자산을 입력하면 포트폴리오 분석이 가능합니다.
        </p>
      </div>

      {/* 오른쪽: 인사이트 */}
      <div className={styles.insightPanel}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>금융자산 총액</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>투자 비중</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>현금 비중</span>
            <span className={styles.summaryValueLarge}>-</span>
          </div>
        </div>

        <div className={styles.emptyState}>
          <Wallet size={40} />
          <p>자산을 입력하면 분석 결과가 표시됩니다</p>
        </div>
      </div>
    </div>
  )
}
