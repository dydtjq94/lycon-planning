'use client'

import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import type { SimulationResult } from '@/lib/services/simulationEngine'
import {
  transformSimulationToChartData,
  formatChartValue,
} from '@/lib/utils/chartDataTransformer'
import {
  groupAssetItems,
  groupDebtItems,
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
  LineElement,
  PointElement,
  Filler,
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
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const hoverIndexRef = useRef<number>(-1)
  const { chartScaleColors, isDark, categoryColors, chartLineColors, toRgba } = useChartTheme()
  const [chartMode, setChartMode] = useState<'bar' | 'line'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('asset-chart-mode') as 'bar' | 'line') || 'line'
    }
    return 'line'
  })
  const handleChartModeChange = useCallback((mode: 'bar' | 'line') => {
    setChartMode(mode)
    localStorage.setItem('asset-chart-mode', mode)
  }, [])
  const chartModeRef = useRef(chartMode)
  chartModeRef.current = chartMode

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

    // 나이 텍스트
    const ageText = getAgeText(snapshot.year, birthYear, spouseBirthYear)

    // 자산 카테고리별 그룹핑 (assetBreakdown + pensionBreakdown 합쳐서)
    const allAssetItems = [...snapshot.assetBreakdown, ...snapshot.pensionBreakdown]
    const assetGroups = groupAssetItems(allAssetItems)

    const assetSectionHtml = assetGroups.length > 0 ? `
      <div style="margin-top: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: ${textColor};">자산</span>
          <span style="font-size: 13px; font-weight: 700; color: #10b981;">${formatMoneyWithUnit(totalAssets)}</span>
        </div>
        ${assetGroups.map(group => `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 3px; padding-left: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${group.category.color}; flex-shrink: 0;"></span>
              <span style="font-size: 12px; color: ${textColor};">${group.category.label}</span>
            </div>
            <span style="font-size: 12px; color: ${textColor};">${formatMoneyWithUnit(group.total)}</span>
          </div>
        `).join('')}
      </div>
    ` : ''

    // 부채 카테고리별 그룹핑
    const debtGroups = groupDebtItems(snapshot.debtBreakdown)
    const debtSectionHtml = debtGroups.length > 0 ? `
      <div style="margin-top: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: ${textColor};">부채</span>
          <span style="font-size: 13px; font-weight: 700; color: #ef4444;">-${formatMoneyWithUnit(snapshot.totalDebts)}</span>
        </div>
        ${debtGroups.map(group => `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 3px; padding-left: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${group.category.color}; flex-shrink: 0;"></span>
              <span style="font-size: 12px; color: ${textColor};">${group.category.label}</span>
            </div>
            <span style="font-size: 12px; color: ${textColor};">-${formatMoneyWithUnit(group.total)}</span>
          </div>
        `).join('')}
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

    positionTooltip(tooltipEl, chart.canvas, mouseRef.current.x, mouseRef.current.y)
  }, [chartData.snapshots, isDark, birthYear, spouseBirthYear])

  // 마우스 추적 + 호버 라인 + 언마운트 정리
  useEffect(() => {
    const canvas = chartRef.current

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }

      // 툴팁이 보이면 마우스 따라 위치 업데이트
      const tooltipEl = document.getElementById('sim-chart-tooltip') as HTMLDivElement | null
      if (tooltipEl && tooltipEl.style.opacity === '1' && canvas) {
        positionTooltip(tooltipEl, canvas, e.clientX, e.clientY)
      }

      const chart = chartInstance.current
      if (!chart) return

      const elements = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, false)
      const newIndex = elements.length > 0 ? elements[0].index : -1
      if (newIndex === hoverIndexRef.current) return
      hoverIndexRef.current = newIndex

      const annotations = (chart.options.plugins?.annotation as { annotations?: Record<string, unknown> })?.annotations
      if (!annotations) return

      if (newIndex >= 0) {
        const accent = getComputedStyle(canvas!).getPropertyValue('--accent-color').trim() || '#007aff'
        annotations.hoverLine = {
          type: 'line',
          xMin: newIndex,
          xMax: newIndex,
          borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
          borderWidth: 1.5,
        }
      } else {
        delete annotations.hoverLine
      }
      chart.update('none')
    }

    const handleMouseLeave = () => {
      hoverIndexRef.current = -1
      const chart = chartInstance.current
      if (!chart) return
      const annotations = (chart.options.plugins?.annotation as { annotations?: Record<string, unknown> })?.annotations
      if (annotations?.hoverLine) {
        delete annotations.hoverLine
        chart.update('none')
      }
    }

    canvas?.addEventListener('mousemove', handleMouseMove)
    canvas?.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      canvas?.removeEventListener('mousemove', handleMouseMove)
      canvas?.removeEventListener('mouseleave', handleMouseLeave)
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

    // Bar mode에서 사용할 색상 배열
    const bgColors = netWorthData.map(v => v >= 0 ? toRgba(positiveColor, 0.7) : toRgba(negativeColor, 0.7))

    const retirementIndex = retirementYear
      ? chartData.labels.findIndex(label => parseInt(label) === retirementYear)
      : -1

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

    // 그라데이션 플러그인 (0선 기준) - line mode에만 적용
    const gradientFillPlugin = {
      id: 'gradientFill',
      afterLayout: (chart: ChartJS) => {
        const { ctx, chartArea, scales } = chart
        if (!chartArea || !scales.y) return

        const lineDs = chart.data.datasets[1] as any
        if (!lineDs) return

        // Only apply gradient in line mode (ref로 최신 값 참조)
        if (chartModeRef.current !== 'line') {
          lineDs.backgroundColor = 'transparent'
          return
        }

        const zeroPixel = scales.y.getPixelForValue(0)
        const zeroRatio = (zeroPixel - chartArea.top) / (chartArea.bottom - chartArea.top)
        const clampedRatio = Math.max(0.01, Math.min(0.99, zeroRatio))

        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        gradient.addColorStop(0, toRgba(positiveColor, 0.25))
        gradient.addColorStop(clampedRatio, toRgba(positiveColor, 0.02))
        gradient.addColorStop(clampedRatio, toRgba(negativeColor, 0.02))
        gradient.addColorStop(1, toRgba(negativeColor, 0.25))

        lineDs.backgroundColor = gradient
      },
    }

    // 차트가 이미 있으면 데이터/옵션만 업데이트 (애니메이션 없이)
    if (chartInstance.current) {
      const chart = chartInstance.current
      chart.data.labels = chartData.labels

      const barDs = chart.data.datasets[0] as any
      const lineDs = chart.data.datasets[1] as any

      barDs.data = netWorthData
      if (lineDs) lineDs.data = netWorthData

      if (chartMode === 'bar') {
        // Bar visible
        barDs.backgroundColor = bgColors
        barDs.borderRadius = 2
        barDs.barPercentage = 0.85
        barDs.categoryPercentage = 0.85
        // Line hidden
        if (lineDs) {
          lineDs.borderWidth = 0
          lineDs.fill = false
          lineDs.backgroundColor = 'transparent'
        }
      } else {
        // Bar transparent
        barDs.backgroundColor = 'transparent'
        barDs.borderRadius = 0
        barDs.barPercentage = 1.0
        barDs.categoryPercentage = 1.0
        // Line visible
        if (lineDs) {
          lineDs.borderWidth = 2.5
          lineDs.borderColor = positiveColor
          lineDs.fill = 'origin'
          lineDs.segment = {
            borderColor: (ctx: any) => {
              const y0 = ctx.p0.parsed.y
              const y1 = ctx.p1.parsed.y
              if (y0 >= 0 && y1 >= 0) return positiveColor
              if (y0 < 0 && y1 < 0) return negativeColor
              return positiveColor
            },
          }
        }
      }

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
        datasets: [
          {
            label: '순자산-bar',
            data: netWorthData,
            backgroundColor: chartMode === 'bar' ? bgColors : 'transparent',
            borderWidth: 0,
            borderRadius: chartMode === 'bar' ? 2 : 0,
            barPercentage: chartMode === 'bar' ? 0.85 : 1.0,
            categoryPercentage: chartMode === 'bar' ? 0.85 : 1.0,
          },
          {
            type: 'line' as const,
            label: '순자산',
            data: netWorthData,
            borderColor: positiveColor,
            borderWidth: chartMode === 'line' ? 2.5 : 0,
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0.35,
            fill: chartMode === 'line' ? 'origin' : false,
            backgroundColor: 'transparent',
            segment: {
              borderColor: (ctx: any) => {
                const y0 = ctx.p0.parsed.y
                const y1 = ctx.p1.parsed.y
                if (y0 >= 0 && y1 >= 0) return positiveColor
                if (y0 < 0 && y1 < 0) return negativeColor
                return positiveColor
              },
            },
          },
        ],
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
      plugins: [gradientFillPlugin],
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, retirementYear, externalTooltipHandler, chartScaleColors, chartLineColors, categoryColors, netWorthData, toRgba, chartMode])

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
          {chartMode === 'bar' ? (
            <>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: chartLineColors.price }} />
                <span className={styles.legendLabel}>순자산</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: chartLineColors.expense }} />
                <span className={styles.legendLabel}>순부채</span>
              </div>
            </>
          ) : (
            <div className={styles.legendItem}>
              <span
                className={styles.legendGradient}
                style={{
                  borderTopColor: chartLineColors.price,
                  background: `linear-gradient(to bottom, ${toRgba(chartLineColors.price, 0.3)}, ${toRgba(chartLineColors.price, 0)})`,
                }}
              />
              <span className={styles.legendLabel}>순자산</span>
            </div>
          )}

        </div>
        <div className={styles.rightActions}>
          {/* Chart mode toggle */}
          <div className={styles.chartModeToggle}>
            <button
              className={`${styles.modeButton} ${chartMode === 'bar' ? styles.modeActive : ''}`}
              onClick={() => handleChartModeChange('bar')}
              title="막대 차트"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="6" width="3" height="7" rx="0.5" fill="currentColor"/>
                <rect x="5.5" y="3" width="3" height="10" rx="0.5" fill="currentColor"/>
                <rect x="10" y="1" width="3" height="12" rx="0.5" fill="currentColor"/>
              </svg>
            </button>
            <button
              className={`${styles.modeButton} ${chartMode === 'line' ? styles.modeActive : ''}`}
              onClick={() => handleChartModeChange('line')}
              title="라인 차트"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 12L4.5 7L8 9L13 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          {headerAction}
        </div>
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
