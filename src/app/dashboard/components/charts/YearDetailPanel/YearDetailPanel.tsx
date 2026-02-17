'use client'

import { X } from 'lucide-react'
import type { YearlySnapshot } from '@/lib/services/simulationTypes'
import { getYearDetail, formatTooltipValue, ASSET_COLORS } from '@/lib/utils/chartDataTransformer'
import { categorizeAsset } from '@/lib/utils/tooltipCategories'
import styles from './YearDetailPanel.module.css'

interface YearDetailPanelProps {
  snapshots: YearlySnapshot[]
  year: number
  onClose: () => void
}

// 중앙화된 색상 시스템 사용 (tooltipCategories.ts)
function getAssetColor(title: string): string {
  return categorizeAsset(title).color
}

export function YearDetailPanel({ snapshots, year, onClose }: YearDetailPanelProps) {
  const detail = getYearDetail(snapshots, year)

  if (!detail) return null

  // 변화율 포맷팅
  const formatChange = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${formatTooltipValue(value)}`
  }

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {detail.year}년 ({detail.age}세)
        </h3>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className={styles.content}>
        {/* 순자산 */}
        <div className={styles.netWorthSection}>
          <div className={styles.netWorthLabel}>순자산</div>
          <div className={styles.netWorthValue}>
            {formatTooltipValue(detail.netWorth)}
          </div>
          {detail.netWorthChange !== undefined && (
            <div className={detail.netWorthChange >= 0 ? styles.changePositive : styles.changeNegative}>
              {formatChange(detail.netWorthChange)}
              {detail.netWorthChangePercent !== undefined && (
                <span className={styles.changePercent}>
                  ({formatPercent(detail.netWorthChangePercent)})
                </span>
              )}
            </div>
          )}
        </div>

        {/* 자산 breakdown */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>자산</div>
          {detail.assetBreakdown.map((item, idx) => (
            <div key={idx} className={styles.row}>
              <span className={styles.rowLabel}>
                <span
                  className={styles.dot}
                  style={{ backgroundColor: getAssetColor(item.title) }}
                />
                {item.title}
              </span>
              <span className={styles.rowValue}>{formatTooltipValue(item.amount)}</span>
            </div>
          ))}
          {detail.pensionBreakdown.map((item, idx) => (
            <div key={`pension-${idx}`} className={styles.row}>
              <span className={styles.rowLabel}>
                <span className={styles.dot} style={{ backgroundColor: ASSET_COLORS.pension }} />
                {item.title}
              </span>
              <span className={styles.rowValue}>{formatTooltipValue(item.amount)}</span>
            </div>
          ))}
          <div className={styles.rowTotal}>
            <span>총 자산</span>
            <span>{formatTooltipValue(detail.totalAssets)}</span>
          </div>
        </div>

        {/* 부채 */}
        {detail.totalDebts > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>부채</div>
            {detail.debtBreakdown.map((item, idx) => (
              <div key={idx} className={styles.row}>
                <span className={styles.rowLabel}>
                  <span className={styles.dot} style={{ backgroundColor: ASSET_COLORS.debt }} />
                  {item.title}
                </span>
                <span className={styles.rowValueNegative}>{formatTooltipValue(item.amount)}</span>
              </div>
            ))}
            <div className={styles.rowTotal}>
              <span>총 부채</span>
              <span className={styles.rowValueNegative}>{formatTooltipValue(detail.totalDebts)}</span>
            </div>
          </div>
        )}

        {/* 현금흐름 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>연간 현금흐름</div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>소득</span>
            <span className={styles.rowValue}>{formatTooltipValue(detail.totalIncome)}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>지출</span>
            <span className={styles.rowValueNegative}>{formatTooltipValue(detail.totalExpense)}</span>
          </div>
          <div className={styles.rowTotal}>
            <span>순현금흐름</span>
            <span className={detail.netCashFlow >= 0 ? styles.rowValue : styles.rowValueNegative}>
              {formatTooltipValue(detail.netCashFlow)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
