'use client'

import { useMemo } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { YearlySnapshot, MonthlySnapshot } from '@/lib/services/simulationTypes'
import {
  groupAssetItems,
  groupDebtItems,
} from '@/lib/utils/tooltipCategories'
import { useChartTheme } from '@/hooks/useChartTheme'
import { formatMoney } from '@/lib/utils'
import styles from './DonutPairView.module.css'

ChartJS.register(ArcElement, Tooltip)

interface DonutPairViewProps {
  snapshot: YearlySnapshot | MonthlySnapshot
  selectedLabel: string
}

export function DonutPairView({ snapshot, selectedLabel }: DonutPairViewProps) {
  const { assetCategoryColors, debtCategoryColors, chartScaleColors } = useChartTheme()

  const pensionBreakdown = 'pensionBreakdown' in snapshot ? snapshot.pensionBreakdown : undefined

  const assetGroups = useMemo(
    () => {
      const items = [...(snapshot.assetBreakdown || [])]
      if (pensionBreakdown) {
        for (const p of pensionBreakdown) {
          items.push({ title: p.title, amount: p.amount, type: p.type || 'pension' })
        }
      }
      return groupAssetItems(items).sort((a, b) => b.total - a.total)
    },
    [snapshot.assetBreakdown, pensionBreakdown]
  )

  const debtGroups = useMemo(
    () => groupDebtItems(snapshot.debtBreakdown || []).sort((a, b) => b.total - a.total),
    [snapshot.debtBreakdown]
  )

  const totalAssets = useMemo(
    () => assetGroups.reduce((sum, g) => sum + g.total, 0),
    [assetGroups]
  )

  const totalDebts = useMemo(
    () => debtGroups.reduce((sum, g) => sum + g.total, 0),
    [debtGroups]
  )

  const hasAssets = totalAssets > 0
  const hasDebts = totalDebts > 0

  if (!hasAssets && !hasDebts) {
    return (
      <div className={styles.emptyState}>
        {selectedLabel} 자산/부채 데이터가 없습니다
      </div>
    )
  }

  const makeChartData = (
    groups: typeof assetGroups,
    colorMap: Record<string, string>,
    total: number
  ) => {
    if (total === 0) return null

    const labels = groups.map(g => g.category.label)
    const data = groups.map(g => g.total)
    const backgroundColor = groups.map(g => colorMap[g.category.id] || '#8e8e93')

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor: chartScaleColors.doughnutBorder,
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: { label?: string; parsed: number; dataset: { data: number[] } }) => {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
            const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0'
            return `${context.label}: ${formatMoney(context.parsed)} (${pct}%)`
          },
        },
      },
      legend: {
        display: false,
      },
    },
  } as const

  const assetChartData = makeChartData(assetGroups, assetCategoryColors, totalAssets)
  const debtChartData = makeChartData(debtGroups, debtCategoryColors, totalDebts)

  return (
    <div className={`${styles.container} ${!hasDebts ? styles.containerSingle : ''}`}>
      {hasAssets && assetChartData && (
        <div className={styles.chartSection}>
          <span className={styles.chartTitle}>자산 구성</span>
          <div className={styles.chartArea}>
            <Doughnut data={assetChartData} options={chartOptions} />
            <div className={styles.centerLabel}>
              <div className={styles.centerAmount}>{formatMoney(totalAssets)}</div>
            </div>
          </div>
          <div className={styles.legendList}>
            {assetGroups.map(g => (
              <div key={g.category.id} className={styles.legendRow}>
                <span
                  className={styles.legendDot}
                  style={{ background: assetCategoryColors[g.category.id] || '#8e8e93' }}
                />
                <span className={styles.legendName}>{g.category.label}</span>
                <span className={styles.legendValue}>{formatMoney(g.total)}</span>
                <span className={styles.legendPercent}>
                  {totalAssets > 0 ? ((g.total / totalAssets) * 100).toFixed(1) : '0'}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasDebts && debtChartData && (
        <div className={styles.chartSection}>
          <span className={styles.chartTitle}>부채 구성</span>
          <div className={styles.chartArea}>
            <Doughnut data={debtChartData} options={chartOptions} />
            <div className={styles.centerLabel}>
              <div className={styles.centerAmount}>{formatMoney(totalDebts)}</div>
            </div>
          </div>
          <div className={styles.legendList}>
            {debtGroups.map(g => (
              <div key={g.category.id} className={styles.legendRow}>
                <span
                  className={styles.legendDot}
                  style={{ background: debtCategoryColors[g.category.id] || '#8e8e93' }}
                />
                <span className={styles.legendName}>{g.category.label}</span>
                <span className={styles.legendValue}>{formatMoney(g.total)}</span>
                <span className={styles.legendPercent}>
                  {totalDebts > 0 ? ((g.total / totalDebts) * 100).toFixed(1) : '0'}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
