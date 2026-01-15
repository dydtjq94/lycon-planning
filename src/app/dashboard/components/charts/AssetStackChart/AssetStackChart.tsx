'use client'

import { useRef, useEffect, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
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
import styles from './AssetStackChart.module.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
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
function getOrCreateTooltip(chart: ChartJS): HTMLDivElement {
  let tooltipEl = chart.canvas.parentNode?.querySelector('div.chart-tooltip') as HTMLDivElement | null
  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.className = 'chart-tooltip'
    tooltipEl.style.cssText = `
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
      pointer-events: none;
      position: absolute;
      transition: all 0.15s ease;
      padding: 14px 18px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      white-space: nowrap;
      z-index: 100;
      min-width: 200px;
    `
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
}: AssetStackChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<ChartJS | null>(null)

  const { snapshots } = simulationResult

  // 차트 데이터 변환
  const chartData = transformSimulationToChartData(simulationResult, { endYear })

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
    const tooltipEl = getOrCreateTooltip(chart)

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

    // 자산 항목을 개별적으로 표시
    const assetItemsHtml = snapshot.assetBreakdown.map(item => `
      <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px; padding-left: 8px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 2px; background: ${getAssetColor(item.title)};"></span>
          <span style="font-size: 12px; color: #1d1d1f;">${item.title}</span>
        </div>
        <span style="font-size: 12px; color: ${getAssetColor(item.title)};">${formatMoney(item.amount)}</span>
      </div>
    `).join('')

    // 연금 항목을 개별적으로 표시
    const pensionItemsHtml = snapshot.pensionBreakdown.map(item => `
      <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px; padding-left: 8px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 2px; background: ${ASSET_COLORS.pension};"></span>
          <span style="font-size: 12px; color: #1d1d1f;">${item.title}</span>
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
              <span style="font-size: 11px; color: #86868b;">${group.category.label}</span>
            </div>
            ${group.items.map(item => `
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 1px; padding-left: 14px;">
                <span style="font-size: 12px; color: #1d1d1f;">${item.title}</span>
                <span style="font-size: 12px; color: ${group.category.color};">${formatMoney(item.amount)}</span>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    ` : ''

    const netWorth = snapshot.netWorth
    const netColor = netWorth >= 0 ? '#10b981' : '#ef4444'

    tooltipEl.innerHTML = `
      <div style="font-size: 16px; font-weight: 700; color: #1d1d1f; margin-bottom: 2px;">${snapshot.year}년</div>
      <div style="font-size: 12px; color: #86868b; margin-bottom: 12px;">${snapshot.age}세</div>
      ${assetHtml}
      ${debtHtml}
      <div style="border-top: 1px solid rgba(0,0,0,0.08); margin-top: 8px; padding-top: 8px;">
        <div style="display: flex; justify-content: space-between; gap: 16px;">
          <span style="font-size: 14px; color: #86868b;">순자산</span>
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
  }, [chartData.snapshots])

  useEffect(() => {
    if (!chartRef.current || chartData.snapshots.length === 0) return

    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    // 은퇴 연도 인덱스
    const retirementIndex = retirementYear
      ? chartData.labels.findIndex(label => parseInt(label) === retirementYear)
      : -1

    // Y축 범위 계산 (0 중심 대칭)
    const maxAssets = Math.max(...chartData.snapshots.map(s => s.totalAssets))
    const maxDebts = Math.max(...chartData.snapshots.map(s => s.totalDebts))
    const maxAbsValue = Math.max(maxAssets, maxDebts)
    const roundedMax = Math.ceil(maxAbsValue / 10000) * 10000

    chartInstance.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets.map(ds => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: ds.backgroundColor,
          borderWidth: 0,
          borderRadius: 2,
          stack: ds.stack,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        onClick: (_event, elements) => {
          if (elements.length > 0 && onYearClick) {
            const index = elements[0].index
            const year = parseInt(chartData.labels[index])
            onYearClick(year)
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 15,
              font: { size: 11 },
              color: '#64748b',
            },
            border: { display: false },
          },
          y: {
            stacked: true,
            min: -roundedMax,
            max: roundedMax,
            grid: { color: '#e2e8f0' },
            ticks: {
              callback: (value) => {
                const numValue = value as number
                if (numValue === 0) return '0'
                const prefix = numValue > 0 ? '+' : ''
                return `${prefix}${formatChartValue(numValue)}`
              },
              font: { size: 11 },
              color: '#64748b',
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
            annotations: {
              zeroLine: {
                type: 'line',
                yMin: 0,
                yMax: 0,
                borderColor: 'rgba(100, 116, 139, 0.8)',
                borderWidth: 1.5,
              },
              ...(retirementIndex >= 0 ? {
                retirementLine: {
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
                },
              } : {}),
            },
          },
        },
      },
    })

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [chartData, retirementYear, onYearClick, externalTooltipHandler])

  return (
    <div className={styles.container}>
      {/* 범례 */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: ASSET_COLORS.financialAssets }} />
          <span className={styles.legendLabel}>금융자산</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: ASSET_COLORS.realEstate }} />
          <span className={styles.legendLabel}>부동산</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: ASSET_COLORS.pension }} />
          <span className={styles.legendLabel}>연금</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: ASSET_COLORS.debt }} />
          <span className={styles.legendLabel}>부채</span>
        </div>
      </div>

      {/* 차트 */}
      <div className={styles.chartWrapper}>
        <canvas ref={chartRef} />
      </div>

      {/* 클릭 안내 */}
      <p className={styles.hint}>
        막대를 클릭하면 해당 연도의 상세 정보를 볼 수 있습니다
      </p>
    </div>
  )
}
