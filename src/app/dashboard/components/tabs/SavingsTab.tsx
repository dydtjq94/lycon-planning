'use client'

import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import { PiggyBank } from 'lucide-react'
import type { OnboardingData } from '@/types'
import styles from './SavingsTab.module.css'

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

interface SavingsTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function SavingsTab({ data, onUpdateData }: SavingsTabProps) {
  return (
    <div className={styles.container}>
      {/* 왼쪽: 저축/투자 입력 */}
      <div className={styles.inputPanel}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>예적금</span>
          </div>
          <p className={styles.placeholder}>정기예금, 적금 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>투자 자산</span>
          </div>
          <p className={styles.placeholder}>주식, 펀드, ETF 등</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>기타 저축</span>
          </div>
          <p className={styles.placeholder}>비상금, 목표 저축 등</p>
        </div>

        <p className={styles.infoText}>
          저축 목표와 현황을 입력하면 맞춤 분석이 가능합니다.
        </p>
      </div>

      {/* 오른쪽: 인사이트 */}
      <div className={styles.insightPanel}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>월 저축 가능액</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>총 저축/투자 자산</span>
            <span className={styles.summaryValue}>-</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>저축률</span>
            <span className={styles.summaryValueLarge}>-</span>
          </div>
        </div>

        <div className={styles.emptyState}>
          <PiggyBank size={40} />
          <p>저축 현황을 입력하면 분석 결과가 표시됩니다</p>
        </div>
      </div>
    </div>
  )
}
