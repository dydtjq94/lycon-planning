'use client'

import { useRef, useEffect, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import type { SimulationResult } from '@/lib/services/simulationEngine'
import { groupIncomeItems, groupExpenseItems } from '@/lib/utils/tooltipCategories'
import {
  getOrCreateTooltip,
  removeTooltip,
  positionTooltip,
  hideTooltip,
  formatMoneyWithUnit,
  getAgeText,
} from '@/lib/utils/chartTooltip'
import { useChartTheme } from '@/hooks/useChartTheme'
import styles from './CashFlowChart.module.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  annotationPlugin
)

interface CashFlowChartProps {
  simulationResult: SimulationResult
  endYear: number
  retirementYear: number
  birthYear?: number
  spouseBirthYear?: number | null
  onYearClick?: (year: number) => void
  selectedYear?: number | null
  headerAction?: React.ReactNode
}

// Y축 포맷팅
function formatChartValue(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 10000) {
    return `${(absValue / 10000).toFixed(1)}억`
  }
  return `${absValue.toLocaleString()}만`
}

export function CashFlowChart({
  simulationResult,
  endYear,
  retirementYear,
  birthYear,
  spouseBirthYear,
  onYearClick,
  selectedYear,
  headerAction,
}: CashFlowChartProps) {
  const { chartLineColors, chartScaleColors, categoryColors, isDark, toRgba } = useChartTheme()
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<ChartJS | null>(null)
  const onYearClickRef = useRef(onYearClick)
  onYearClickRef.current = onYearClick

  const { snapshots } = simulationResult
  const currentYear = new Date().getFullYear()

  // 순현금흐름 바 색상
  const positiveColor = chartLineColors.price
  const negativeColor = chartLineColors.expense

  // 커스텀 툴팁 핸들러
  const externalTooltipHandler = useCallback((context: {
    chart: ChartJS
    tooltip: {
      opacity: number
      caretX: number
      caretY: number
      dataPoints?: { dataIndex: number }[]
    }
  }) => {
    const { chart, tooltip } = context
    const tooltipEl = getOrCreateTooltip(isDark)

    if (tooltip.opacity === 0) {
      hideTooltip(tooltipEl)
      return
    }

    const dataIndex = tooltip.dataPoints?.[0]?.dataIndex ?? 0
    const snapshot = snapshots[dataIndex]

    if (!snapshot) {
      hideTooltip(tooltipEl)
      return
    }

    const textColor = isDark ? '#ffffff' : '#1d1d1f'
    const textSecondary = isDark ? '#a1a1aa' : '#86868b'
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

    // 순현금흐름
    const netCashFlow = snapshot.netCashFlow
    const netPrefix = netCashFlow >= 0 ? '+' : '-'
    const netColor = netCashFlow >= 0 ? '#10b981' : '#ef4444'

    // 소득/지출 breakdown
    const incomeGroups = groupIncomeItems(snapshot.incomeBreakdown)
    const expenseGroups = groupExpenseItems(snapshot.expenseBreakdown)
    const totalIncome = incomeGroups.reduce((sum, g) => sum + g.total, 0)
    const totalExpense = expenseGroups.reduce((sum, g) => sum + g.total, 0)

    // 나이 텍스트
    const ageText = getAgeText(snapshot.year, birthYear, spouseBirthYear)

    // 소득 항목 HTML
    const incomeItemsHtml = incomeGroups.length > 0 ? `
      <div style="margin-top: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: ${textColor};">수입</span>
          <span style="font-size: 13px; font-weight: 700; color: #10b981;">+${formatMoneyWithUnit(totalIncome)}</span>
        </div>
        ${incomeGroups.map(group => group.items.map(item => `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 3px; padding-left: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${group.category.color}; flex-shrink: 0;"></span>
              <span style="font-size: 12px; color: ${textColor};">${item.title}</span>
            </div>
            <span style="font-size: 12px; color: ${textColor};">+${formatMoneyWithUnit(item.amount)}</span>
          </div>
        `).join('')).join('')}
      </div>
    ` : ''

    // 지출 항목 HTML
    const expenseItemsHtml = expenseGroups.length > 0 ? `
      <div style="margin-top: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: ${textColor};">지출</span>
          <span style="font-size: 13px; font-weight: 700; color: #ef4444;">-${formatMoneyWithUnit(totalExpense)}</span>
        </div>
        ${expenseGroups.map(group => group.items.map(item => `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 3px; padding-left: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${group.category.color}; flex-shrink: 0;"></span>
              <span style="font-size: 12px; color: ${textColor};">${item.title}</span>
            </div>
            <span style="font-size: 12px; color: ${textColor};">-${formatMoneyWithUnit(item.amount)}</span>
          </div>
        `).join('')).join('')}
      </div>
    ` : ''

    tooltipEl.innerHTML = `
      <div style="font-size: 18px; font-weight: 700; color: ${textColor}; margin-bottom: 2px;">${snapshot.year}년</div>
      <div style="font-size: 12px; color: ${textSecondary}; margin-bottom: 12px;">${ageText}</div>
      <div style="border-top: 1px solid ${borderColor}; padding-top: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; font-weight: 700; color: ${textColor};">순 현금흐름</span>
          <span style="font-size: 14px; font-weight: 700; color: ${netColor};">${netPrefix}${formatMoneyWithUnit(netCashFlow)}</span>
        </div>
      </div>
      ${incomeItemsHtml}
      ${expenseItemsHtml}
    `

    positionTooltip(tooltipEl, chart.canvas, tooltip.caretX, tooltip.caretY)
  }, [snapshots, isDark, birthYear, spouseBirthYear])

  // 언마운트 시 차트 + 툴팁 정리
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
        chartInstance.current = null
      }
      removeTooltip()
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || snapshots.length === 0) return

    const labels = snapshots.map(s => s.year)
    const netCashFlowData = snapshots.map(s => s.netCashFlow)

    const retirementIndex = labels.findIndex(y => y === retirementYear)

    // 바 색상 (양수/음수)
    const bgColors = netCashFlowData.map(v => v >= 0 ? toRgba(positiveColor, 0.7) : toRgba(negativeColor, 0.7))

    // 0을 가운데로 대칭 y축
    const maxAbs = Math.max(Math.abs(Math.max(...netCashFlowData)), Math.abs(Math.min(...netCashFlowData))) * 1.1

    // annotation 설정
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const annotationsConfig: any = {
      zeroLine: {
        type: 'line',
        yMin: 0,
        yMax: 0,
        borderColor: 'rgba(100, 116, 139, 0.8)',
        borderWidth: 1.5,
      },
    }
    if (retirementIndex >= 0) {
      annotationsConfig.retirementLine = {
        type: 'line',
        xMin: retirementIndex,
        xMax: retirementIndex,
        borderColor: 'rgba(148, 163, 184, 0.8)',
        borderWidth: 2,
        borderDash: [6, 4],
        label: {
          display: true,
          content: '은퇴',
          position: 'start' as const,
          backgroundColor: 'rgba(100, 116, 139, 0.9)',
          color: '#fff',
          font: { size: 11, weight: 'bold' as const },
          padding: { x: 6, y: 4 },
          borderRadius: 4,
        },
      }
    }

    // 차트가 이미 있으면 데이터/옵션만 업데이트
    if (chartInstance.current) {
      const chart = chartInstance.current
      chart.data.labels = labels
      const ds = chart.data.datasets[0] as any
      ds.data = netCashFlowData
      ds.backgroundColor = bgColors

      if (chart.options.scales?.x?.ticks) chart.options.scales.x.ticks.color = chartScaleColors.tickColor
      if (chart.options.scales?.y) {
        chart.options.scales.y.min = -maxAbs
        chart.options.scales.y.max = maxAbs
        if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = chartScaleColors.tickColor
        if (chart.options.scales.y.grid) (chart.options.scales.y.grid as any).color = chartScaleColors.gridColor
      }

      ;(chart.options.plugins as any).annotation = { annotations: annotationsConfig }

      if (chart.options.plugins?.tooltip) {
        (chart.options.plugins.tooltip as any).external = externalTooltipHandler
      }

      chart.update('none')
      return
    }

    // 최초 생성
    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    chartInstance.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '순현금흐름',
          data: netCashFlowData,
          backgroundColor: bgColors,
          borderWidth: 0,
          borderRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        onClick: (_event, elements, chart) => {
          if (elements.length > 0 && onYearClickRef.current) {
            const index = elements[0].index
            const label = chart.data.labels?.[index]
            if (label) onYearClickRef.current(Number(label))
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: externalTooltipHandler,
          },
          annotation: {
            annotations: annotationsConfig,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 15,
              font: { size: 11 },
              color: chartScaleColors.tickColor,
            },
            border: { display: false },
          },
          y: {
            min: -maxAbs,
            max: maxAbs,
            afterFit: (scale: { width: number }) => { scale.width = 60 },
            grid: { color: chartScaleColors.gridColor },
            ticks: {
              callback: (value) => {
                const numValue = value as number
                if (numValue === 0) return '0'
                const prefix = numValue > 0 ? '+' : '-'
                return `${prefix}${formatChartValue(numValue)}`
              },
              font: { size: 11 },
              color: chartScaleColors.tickColor,
            },
            border: { display: false },
          },
        },
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, retirementYear, externalTooltipHandler, chartScaleColors, chartLineColors, categoryColors, isDark, toRgba])

  // 선택된 연도가 변경될 때 annotation만 업데이트
  useEffect(() => {
    if (!chartInstance.current || !chartRef.current) return

    const chart = chartInstance.current
    const annotations = (chart.options.plugins?.annotation as { annotations?: Record<string, unknown> })?.annotations

    if (!annotations) return

    const labels = chart.data.labels as number[]
    const newSelectedIndex = selectedYear
      ? labels.findIndex(label => Number(label) === selectedYear)
      : -1

    const accentColor = getComputedStyle(chartRef.current).getPropertyValue('--accent-color').trim() || '#007aff'
    const accentWithOpacity = `color-mix(in srgb, ${accentColor} 40%, transparent)`

    if (newSelectedIndex >= 0) {
      annotations.selectedLine = {
        type: 'line',
        xMin: newSelectedIndex,
        xMax: newSelectedIndex,
        borderColor: accentWithOpacity,
        borderWidth: 2,
      }
    } else {
      delete annotations.selectedLine
    }

    chart.update('none')
  }, [selectedYear, snapshots])

  if (snapshots.length === 0) {
    return (
      <div className={styles.emptyState}>
        데이터를 입력하면 현금흐름 시뮬레이션을 확인할 수 있습니다
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.legendRow}>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: positiveColor }} />
            <span className={styles.legendLabel}>흑자</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: negativeColor }} />
            <span className={styles.legendLabel}>적자</span>
          </div>
        </div>
        {headerAction && <div className={styles.headerAction}>{headerAction}</div>}
      </div>
      <div className={styles.chartWrapper}>
        <canvas ref={chartRef} />
      </div>
      <p className={styles.hint}>
        차트를 클릭하면 해당 연도의 상세 정보를 볼 수 있습니다
      </p>
    </div>
  )
}
