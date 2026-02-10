'use client'

import { useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import type { SimulationResult } from '@/lib/services/simulationEngine'
import {
  transformSimulationToChartData,
  formatChartValue,
  ASSET_COLORS,
} from '@/lib/utils/chartDataTransformer'
import {
  groupDebtItems,
  categorizeAsset,
} from '@/lib/utils/tooltipCategories'
import {
  getOrCreateTooltip,
  removeTooltip,
  positionTooltip,
  hideTooltip,
  formatMoneyWithUnit,
  getAgeText,
} from '@/lib/utils/chartTooltip'
import { useChartTheme } from '@/hooks/useChartTheme'
import styles from './AssetStackChart.module.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  annotationPlugin
)

interface AssetStackChartProps {
  simulationResult: SimulationResult
  endYear?: number
  retirementYear?: number
  birthYear?: number
  spouseBirthYear?: number | null
  onYearClick?: (year: number) => void
  selectedYear?: number | null
  headerAction?: React.ReactNode
}


export function AssetStackChart({
  simulationResult,
  endYear,
  retirementYear,
  birthYear,
  spouseBirthYear,
  onYearClick,
  selectedYear,
  headerAction,
}: AssetStackChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<ChartJS | null>(null)
  const onYearClickRef = useRef(onYearClick)
  onYearClickRef.current = onYearClick
  const { chartScaleColors, isDark, categoryColors, chartLineColors, toRgba } = useChartTheme()

  const { snapshots } = simulationResult

  // 차트 데이터 변환 - 메모이제이션
  const chartData = useMemo(
    () => transformSimulationToChartData(simulationResult, { endYear }),
    [simulationResult, endYear]
  )

  // 순자산 데이터 추출
  const netWorthData = useMemo(
    () => chartData.snapshots.map(s => s.netWorth),
    [chartData.snapshots]
  )

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
    const snapshot = chartData.snapshots[dataIndex]

    if (!snapshot) {
      hideTooltip(tooltipEl)
      return
    }

    const textColor = isDark ? '#ffffff' : '#1d1d1f'
    const textSecondary = isDark ? '#a1a1aa' : '#86868b'
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

    // 순자산
    const netWorth = snapshot.netWorth
    const netColor = netWorth >= 0 ? '#10b981' : '#ef4444'
    const netPrefix = netWorth >= 0 ? '' : '-'

    // 자산 총계
    const totalAssets = snapshot.financialAssets + snapshot.realEstateValue + snapshot.pensionAssets
    const getAssetColor = (title: string) => categorizeAsset(title).color

    // 나이 텍스트
    const ageText = getAgeText(snapshot.year, birthYear, spouseBirthYear)

    // 자산 항목 HTML
    const assetItemsHtml = snapshot.assetBreakdown.map(item => `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 3px; padding-left: 4px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${getAssetColor(item.title)}; flex-shrink: 0;"></span>
          <span style="font-size: 12px; color: ${textColor};">${item.title}</span>
        </div>
        <span style="font-size: 12px; color: ${textColor};">${formatMoneyWithUnit(item.amount)}</span>
      </div>
    `).join('')

    // 연금 항목 HTML
    const pensionItemsHtml = snapshot.pensionBreakdown.map(item => `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 3px; padding-left: 4px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${ASSET_COLORS.pension}; flex-shrink: 0;"></span>
          <span style="font-size: 12px; color: ${textColor};">${item.title}</span>
        </div>
        <span style="font-size: 12px; color: ${textColor};">${formatMoneyWithUnit(item.amount)}</span>
      </div>
    `).join('')

    const assetSectionHtml = (assetItemsHtml || pensionItemsHtml) ? `
      <div style="margin-top: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: ${textColor};">자산</span>
          <span style="font-size: 13px; font-weight: 700; color: #10b981;">${formatMoneyWithUnit(totalAssets)}</span>
        </div>
        ${assetItemsHtml}
        ${pensionItemsHtml}
      </div>
    ` : ''

    // 부채 항목 HTML
    const debtGroups = groupDebtItems(snapshot.debtBreakdown)
    const debtSectionHtml = debtGroups.length > 0 ? `
      <div style="margin-top: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: ${textColor};">부채</span>
          <span style="font-size: 13px; font-weight: 700; color: #ef4444;">-${formatMoneyWithUnit(snapshot.totalDebts)}</span>
        </div>
        ${debtGroups.map(group => group.items.map(item => `
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
          <span style="font-size: 14px; font-weight: 700; color: ${textColor};">순자산</span>
          <span style="font-size: 14px; font-weight: 700; color: ${netColor};">${netPrefix}${formatMoneyWithUnit(netWorth)}</span>
        </div>
      </div>
      ${assetSectionHtml}
      ${debtSectionHtml}
    `

    positionTooltip(tooltipEl, chart.canvas, tooltip.caretX, tooltip.caretY)
  }, [chartData.snapshots, isDark, birthYear, spouseBirthYear])

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
    if (!chartRef.current || chartData.snapshots.length === 0) return

    // 공통 값 계산
    const positiveColor = chartLineColors.price
    const negativeColor = chartLineColors.expense

    const retirementIndex = retirementYear
      ? chartData.labels.findIndex(label => parseInt(label) === retirementYear)
      : -1

    // 바 색상 (양수/음수)
    const bgColors = netWorthData.map(v => v >= 0 ? toRgba(positiveColor, 0.7) : toRgba(negativeColor, 0.7))

    // 0을 가운데로 대칭 y축
    const maxAbs = Math.max(Math.abs(Math.max(...netWorthData)), Math.abs(Math.min(...netWorthData))) * 1.1

    // annotation 설정
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

    // 차트가 이미 있으면 데이터/옵션만 업데이트 (애니메이션 없이)
    if (chartInstance.current) {
      const chart = chartInstance.current
      chart.data.labels = chartData.labels
      const ds = chart.data.datasets[0] as any
      ds.data = netWorthData
      ds.backgroundColor = bgColors

      // 스케일 업데이트
      if (chart.options.scales?.x?.ticks) chart.options.scales.x.ticks.color = chartScaleColors.tickColor
      if (chart.options.scales?.y) {
        chart.options.scales.y.min = -maxAbs
        chart.options.scales.y.max = maxAbs
        if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = chartScaleColors.tickColor
        if (chart.options.scales.y.grid) (chart.options.scales.y.grid as any).color = chartScaleColors.gridColor
      }

      // annotation 업데이트
      ;(chart.options.plugins as any).annotation = { annotations: annotationsConfig }

      // tooltip 핸들러 업데이트 (테마 변경 반영)
      if (chart.options.plugins?.tooltip) {
        (chart.options.plugins.tooltip as any).external = externalTooltipHandler
      }

      chart.update('none')
      return
    }

    // 최초 생성 (애니메이션 포함)
    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    chartInstance.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: '순자산',
          data: netWorthData,
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
            if (label) onYearClickRef.current(parseInt(String(label)))
          }
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
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, retirementYear, externalTooltipHandler, chartScaleColors, chartLineColors, categoryColors, netWorthData, toRgba])

  // 선택된 연도가 변경될 때 annotation만 업데이트 (차트 재생성 X)
  useEffect(() => {
    if (!chartInstance.current || !chartRef.current) return

    const chart = chartInstance.current
    const annotations = (chart.options.plugins?.annotation as { annotations?: Record<string, unknown> })?.annotations

    if (!annotations) return

    // 선택된 연도 인덱스 계산
    const newSelectedIndex = selectedYear
      ? chartData.labels.findIndex(label => parseInt(label) === selectedYear)
      : -1

    // CSS 변수에서 accent color 가져오기 (opacity 40%)
    const accentColor = getComputedStyle(chartRef.current).getPropertyValue('--accent-color').trim() || '#007aff'
    const accentWithOpacity = `color-mix(in srgb, ${accentColor} 40%, transparent)`

    // annotation 업데이트
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

    chart.update('none') // 애니메이션 없이 즉시 업데이트
  }, [selectedYear, chartData.labels])

  return (
    <div className={styles.container}>
      {/* 범례 + 헤더 액션 */}
      <div className={styles.legendRow}>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: chartLineColors.price }} />
            <span className={styles.legendLabel}>순자산</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: chartLineColors.expense }} />
            <span className={styles.legendLabel}>순부채</span>
          </div>
        </div>
        {headerAction && <div className={styles.headerAction}>{headerAction}</div>}
      </div>

      {/* 차트 */}
      <div className={styles.chartWrapper}>
        <canvas ref={chartRef} />
      </div>

      {/* 클릭 안내 */}
      <p className={styles.hint}>
        차트를 클릭하면 해당 연도의 상세 정보를 볼 수 있습니다
      </p>
    </div>
  )
}
