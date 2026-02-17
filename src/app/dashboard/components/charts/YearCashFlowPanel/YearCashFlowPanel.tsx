'use client'

import { X } from 'lucide-react'
import type { YearlySnapshot } from '@/lib/services/simulationTypes'
import styles from './YearCashFlowPanel.module.css'

interface YearCashFlowPanelProps {
  snapshot: YearlySnapshot
  onClose: () => void
}

// 금액 포맷팅 (억+만원 단위로 상세 표시)
function formatMoney(amount: number): string {
  const absAmount = Math.abs(amount)
  if (absAmount >= 10000) {
    const uk = Math.floor(absAmount / 10000)
    const man = Math.round(absAmount % 10000)
    if (man === 0) {
      return `${uk}억원`
    }
    return `${uk}억 ${man.toLocaleString()}만원`
  }
  return `${absAmount.toLocaleString()}만원`
}

export function YearCashFlowPanel({ snapshot, onClose }: YearCashFlowPanelProps) {
  const { year, age, totalIncome, totalExpense, netCashFlow, incomeBreakdown, expenseBreakdown } = snapshot

  const savingsRate = totalIncome > 0 ? Math.round((netCashFlow / totalIncome) * 100) : 0

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{year}년 현금흐름</h3>
          <p className={styles.subtitle}>{age}세</p>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* 요약 */}
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>연간 소득</span>
          <span className={`${styles.summaryValue} ${styles.income}`}>{formatMoney(totalIncome)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>연간 지출</span>
          <span className={`${styles.summaryValue} ${styles.expense}`}>{formatMoney(totalExpense)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>순현금흐름</span>
          <span className={`${styles.summaryValue} ${netCashFlow >= 0 ? styles.positive : styles.negative}`}>
            {netCashFlow >= 0 ? '+' : ''}{formatMoney(netCashFlow)}
          </span>
        </div>
        <div className={styles.savingsRate}>
          <span className={styles.savingsRateLabel}>저축률</span>
          <span className={`${styles.savingsRateValue} ${savingsRate >= 30 ? styles.good : savingsRate >= 15 ? styles.ok : styles.bad}`}>
            {savingsRate}%
          </span>
        </div>
      </div>

      {/* 소득 상세 */}
      {incomeBreakdown.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>소득 상세</h4>
          <div className={styles.breakdownList}>
            {incomeBreakdown.map((item, idx) => (
              <div key={idx} className={styles.breakdownItem}>
                <span className={styles.breakdownLabel}>{item.title}</span>
                <span className={styles.breakdownValue}>{formatMoney(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 지출 상세 */}
      {expenseBreakdown.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>지출 상세</h4>
          <div className={styles.breakdownList}>
            {expenseBreakdown.map((item, idx) => (
              <div key={idx} className={styles.breakdownItem}>
                <span className={styles.breakdownLabel}>{item.title}</span>
                <span className={styles.breakdownValue}>{formatMoney(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 현금흐름 시각화 */}
      <div className={styles.flowVisualization}>
        <div className={styles.flowBar}>
          <div
            className={styles.incomeBar}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.flowBar}>
          <div
            className={styles.expenseBar}
            style={{ width: totalIncome > 0 ? `${Math.min(100, (totalExpense / totalIncome) * 100)}%` : '0%' }}
          />
        </div>
        <div className={styles.flowLabels}>
          <span className={styles.flowLabel}>소득 대비 지출 {totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0}%</span>
        </div>
      </div>
    </div>
  )
}
