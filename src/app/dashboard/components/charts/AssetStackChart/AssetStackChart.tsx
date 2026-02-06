'use client'

import { useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import type { SimulationResult, YearlySnapshot } from '@/lib/services/simulationEngine'
import {
  transformSimulationToChartData,
  formatChartValue,
  ASSET_COLORS,
} from '@/lib/utils/chartDataTransformer'
import {
  groupAssetItems,
  groupDebtItems,
  categorizeAsset,
  ASSET_CATEGORIES,
  DEBT_CATEGORIES,
  CHART_COLORS,
} from '@/lib/utils/tooltipCategories'
import { useChartTheme } from '@/hooks/useChartTheme'
import styles from './AssetStackChart.module.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
)

interface AssetStackChartProps {
  simulationResult: SimulationResult
  endYear?: number
  retirementYear?: number
  onYearClick?: (year: number) => void
  selectedYear?: number | null
  headerAction?: React.ReactNode
}

// 금액 포맷팅 (억+만원 단위로 상세 표시)
function formatMoney(amount: number): string {
  const absAmount = Math.abs(amount)
  if (absAmount >= 10000) {
    const uk = Math.floor(absAmount / 10000)
    const man = Math.round(absAmount % 10000)
    if (man === 0) {
      return `${uk}억`
    }
    return `${uk}억 ${man.toLocaleString()}만`
  }
  return `${absAmount.toLocaleString()}만`
}

// 커스텀 툴팁 생성
function getOrCreateTooltip(chart: ChartJS, isDark: boolean): HTMLDivElement {
  let tooltipEl = chart.canvas.parentNode?.querySelector('div.chart-tooltip') as HTMLDivElement | null
  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.className = 'chart-tooltip'
  }
  tooltipEl.style.cssText = `
    background: ${isDark ? 'rgba(34, 37, 41, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 12px;
    border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'};
    box-shadow: 0 4px 24px ${isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.12)'};
    pointer-events: none;
    position: absolute;
    transition: all 0.15s ease;
    padding: 14px 18px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    white-space: nowrap;
    z-index: 100;
    min-width: 200px;
  `
  if (!chart.canvas.parentNode?.querySelector('div.chart-tooltip')) {
    chart.canvas.parentNode?.appendChild(tooltipEl)
  }
  return tooltipEl
}

export function AssetStackChart({
  simulationResult,
  endYear,
  retirementYear,
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
    const tooltipEl = getOrCreateTooltip(chart, isDark)

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = '0'
      return
    }

    const dataIndex = tooltip.dataPoints?.[0]?.dataIndex ?? 0
    const snapshot = chartData.snapshots[dataIndex]

    if (!snapshot) {
      tooltipEl.style.opacity = '0'
      return
    }

    // 자산/부채 breakdown (카테고리별 그룹핑)
    const totalAssets = snapshot.financialAssets + snapshot.realEstateValue + snapshot.pensionAssets
    const debtGroups = groupDebtItems(snapshot.debtBreakdown)

    // 중앙화된 색상 시스템 사용 (tooltipCategories.ts)
    const getAssetColor = (title: string) => categorizeAsset(title).color

    // 텍스트 색상 (테마 기반)
    const textColor = chartScaleColors.textColor
    const textSecondary = chartScaleColors.textSecondary

    // 자산 항목을 개별적으로 표시
    const assetItemsHtml = snapshot.assetBreakdown.map(item => `
      <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px; padding-left: 8px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 2px; background: ${getAssetColor(item.title)};"></span>
          <span style="font-size: 12px; color: ${textColor};">${item.title}</span>
        </div>
        <span style="font-size: 12px; color: ${getAssetColor(item.title)};">${formatMoney(item.amount)}</span>
      </div>
    `).join('')

    // 연금 항목을 개별적으로 표시
    const pensionItemsHtml = snapshot.pensionBreakdown.map(item => `
      <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px; padding-left: 8px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 2px; background: ${ASSET_COLORS.pension};"></span>
          <span style="font-size: 12px; color: ${textColor};">${item.title}</span>
        </div>
        <span style="font-size: 12px; color: ${ASSET_COLORS.pension};">${formatMoney(item.amount)}</span>
      </div>
    `).join('')

    const assetHtml = `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 12px; font-weight: 600; color: #10b981;">자산</span>
          <span style="font-size: 12px; font-weight: 600; color: #10b981;">${formatMoney(totalAssets)}</span>
        </div>
        ${assetItemsHtml}
        ${pensionItemsHtml}
      </div>
    `

    const debtHtml = debtGroups.length > 0 ? `
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 12px; font-weight: 600; color: #ef4444;">부채</span>
          <span style="font-size: 12px; font-weight: 600; color: #ef4444;">-${formatMoney(snapshot.totalDebts)}</span>
        </div>
        ${debtGroups.map(group => `
          <div style="margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
              <span style="width: 8px; height: 8px; border-radius: 2px; background: ${group.category.color};"></span>
              <span style="font-size: 11px; color: ${textSecondary};">${group.category.label}</span>
            </div>
            ${group.items.map(item => `
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 1px; padding-left: 14px;">
                <span style="font-size: 12px; color: ${textColor};">${item.title}</span>
                <span style="font-size: 12px; color: ${group.category.color};">${formatMoney(item.amount)}</span>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    ` : ''

    const netWorth = snapshot.netWorth
    const netColor = netWorth >= 0 ? '#10b981' : '#ef4444'

    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

    tooltipEl.innerHTML = `
      <div style="font-size: 16px; font-weight: 700; color: ${textColor}; margin-bottom: 2px;">${snapshot.year}년</div>
      <div style="font-size: 12px; color: ${textSecondary}; margin-bottom: 12px;">${snapshot.age}세</div>
      ${assetHtml}
      ${debtHtml}
      <div style="border-top: 1px solid ${borderColor}; margin-top: 8px; padding-top: 8px;">
        <div style="display: flex; justify-content: space-between; gap: 16px;">
          <span style="font-size: 14px; color: ${textSecondary};">순자산</span>
          <span style="font-size: 14px; font-weight: 700; color: ${netColor};">${formatMoney(netWorth)}</span>
        </div>
      </div>
    `

    // 툴팁 위치 계산
    const chartRect = chart.canvas.getBoundingClientRect()
    const tooltipWidth = tooltipEl.offsetWidth || 200
    let leftPos = tooltip.caretX

    if (leftPos + tooltipWidth / 2 > chartRect.width) {
      leftPos = chartRect.width - tooltipWidth / 2 - 10
    } else if (leftPos - tooltipWidth / 2 < 0) {
      leftPos = tooltipWidth / 2 + 10
    }

    tooltipEl.style.opacity = '1'
    tooltipEl.style.left = `${leftPos}px`
    tooltipEl.style.top = `${Math.max(10, tooltip.caretY - 60)}px`
    tooltipEl.style.transform = 'translate(-50%, 0)'
  }, [chartData.snapshots, chartScaleColors, isDark])

  // 언마운트 시에만 차트 정리
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
        chartInstance.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || chartData.snapshots.length === 0) return

    // 공통 값 계산
    const lineColor = chartLineColors.price
    const debtColor = categoryColors.debt
    const hasPositive = netWorthData.some(v => v >= 0)
    const hasNegative = netWorthData.some(v => v < 0)

    const retirementIndex = retirementYear
      ? chartData.labels.findIndex(label => parseInt(label) === retirementYear)
      : -1

    // 스크립터블 배경색 함수 (chartArea가 준비된 시점에 그라데이션 생성)
    const createGradientBackground = (context: { chart: ChartJS }) => {
      const chart = context.chart
      const { ctx: c, chartArea, scales } = chart
      if (!chartArea || !scales?.y) return 'transparent'

      const yScale = scales.y
      const zeroY = yScale.getPixelForValue(0)
      const zeroRatio = Math.max(0, Math.min(1, (zeroY - chartArea.top) / (chartArea.bottom - chartArea.top)))

      const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)

      if (hasPositive && hasNegative) {
        gradient.addColorStop(0, toRgba(lineColor, 0.2))
        gradient.addColorStop(zeroRatio, toRgba(lineColor, 0))
        gradient.addColorStop(zeroRatio, toRgba(debtColor, 0))
        gradient.addColorStop(1, toRgba(debtColor, 0.2))
      } else if (hasPositive) {
        gradient.addColorStop(0, toRgba(lineColor, 0.2))
        gradient.addColorStop(1, toRgba(lineColor, 0))
      } else {
        gradient.addColorStop(0, toRgba(debtColor, 0))
        gradient.addColorStop(1, toRgba(debtColor, 0.2))
      }

      return gradient
    }

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
      ds.borderColor = lineColor
      ds.backgroundColor = createGradientBackground
      ds.pointHoverBackgroundColor = lineColor

      // 스케일 색상 업데이트
      if (chart.options.scales?.x?.ticks) chart.options.scales.x.ticks.color = chartScaleColors.tickColor
      if (chart.options.scales?.y?.ticks) chart.options.scales.y.ticks.color = chartScaleColors.tickColor
      if (chart.options.scales?.y?.grid) (chart.options.scales.y.grid as any).color = chartScaleColors.gridColor

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
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: '순자산',
          data: netWorthData,
          borderColor: lineColor,
          backgroundColor: createGradientBackground as any,
          borderWidth: 2,
          fill: 'origin',
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBorderWidth: 2,
          pointHoverBackgroundColor: lineColor,
          pointHoverBorderColor: '#ffffff',
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
            grid: { color: chartScaleColors.gridColor },
            ticks: {
              callback: (value) => {
                const numValue = value as number
                if (numValue === 0) return '0'
                const prefix = numValue > 0 ? '+' : ''
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
            <span className={styles.legendColor} style={{ backgroundColor: chartLineColors.price }} />
            <span className={styles.legendLabel}>순자산</span>
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
