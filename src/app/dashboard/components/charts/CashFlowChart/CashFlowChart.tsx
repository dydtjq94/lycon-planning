'use client'

import { useRef, useEffect, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import type { SimulationResult, YearlySnapshot } from '@/lib/services/simulationEngine'
import { groupIncomeItems, groupExpenseItems } from '@/lib/utils/tooltipCategories'
import { useChartTheme } from '@/hooks/useChartTheme'
import styles from './CashFlowChart.module.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  annotationPlugin
)

interface CashFlowChartProps {
  simulationResult: SimulationResult
  endYear: number
  retirementYear: number
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
function getOrCreateTooltip(chart: ChartJS, isDark: boolean): HTMLDivElement {
  let tooltipEl = chart.canvas.parentNode?.querySelector('div.chart-tooltip') as HTMLDivElement | null
  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.className = 'chart-tooltip'
  }
  tooltipEl.style.cssText = `
    background: ${isDark ? 'rgba(39, 39, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
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

export function CashFlowChart({
  simulationResult,
  endYear,
  retirementYear,
  onYearClick,
  selectedYear,
}: CashFlowChartProps) {
  const { chartLineColors, chartScaleColors, isDark, toRgba } = useChartTheme()
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<ChartJS | null>(null)

  const { snapshots } = simulationResult
  const currentYear = new Date().getFullYear()

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
    const snapshot = snapshots[dataIndex]

    if (!snapshot) {
      tooltipEl.style.opacity = '0'
      return
    }

    // 소득/지출 breakdown 표시 (카테고리별 그룹핑)
    const incomeGroups = groupIncomeItems(snapshot.incomeBreakdown)
    const expenseGroups = groupExpenseItems(snapshot.expenseBreakdown)

    const totalIncome = incomeGroups.reduce((sum, g) => sum + g.total, 0)
    const totalExpense = expenseGroups.reduce((sum, g) => sum + g.total, 0)

    const textColor = isDark ? '#ffffff' : '#1d1d1f'
    const textSecondary = isDark ? '#a1a1aa' : '#86868b'
    const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'

    const incomeHtml = incomeGroups.length > 0 ? `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 12px; font-weight: 600; color: #10b981;">소득</span>
          <span style="font-size: 12px; font-weight: 600; color: #10b981;">+${formatMoney(totalIncome)}</span>
        </div>
        ${incomeGroups.map(group => `
          <div style="margin-bottom: 6px;">
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

    const expenseHtml = expenseGroups.length > 0 ? `
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 12px; font-weight: 600; color: #ef4444;">지출</span>
          <span style="font-size: 12px; font-weight: 600; color: #ef4444;">-${formatMoney(totalExpense)}</span>
        </div>
        ${expenseGroups.map(group => `
          <div style="margin-bottom: 6px;">
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

    const netCashFlow = snapshot.netCashFlow
    const netPrefix = netCashFlow >= 0 ? '+' : '-'
    const netColor = netCashFlow >= 0 ? '#10b981' : '#ef4444'

    tooltipEl.innerHTML = `
      <div style="font-size: 16px; font-weight: 700; color: ${textColor}; margin-bottom: 2px;">${snapshot.year}년</div>
      <div style="font-size: 12px; color: ${textSecondary}; margin-bottom: 12px;">${snapshot.age}세</div>
      ${incomeHtml}
      ${expenseHtml}
      <div style="border-top: 1px solid ${borderColor}; margin-top: 8px; padding-top: 8px;">
        <div style="display: flex; justify-content: space-between; gap: 16px;">
          <span style="font-size: 14px; color: ${textSecondary};">순현금흐름</span>
          <span style="font-size: 14px; font-weight: 700; color: ${netColor};">${netPrefix}${formatMoney(netCashFlow)}</span>
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
  }, [snapshots, isDark])

  useEffect(() => {
    if (!chartRef.current || snapshots.length === 0) return

    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    // 연도 레이블
    const labels = snapshots.map(s => s.year)
    // 소득은 양수, 지출은 음수로 변환
    const incomeData = snapshots.map(s => s.totalIncome)
    const expenseData = snapshots.map(s => -s.totalExpense) // 음수로 변환

    // 은퇴 연도 인덱스
    const retirementIndex = labels.findIndex(y => y === retirementYear)

    // Y축 범위 계산 (0 중심 대칭)
    const maxIncome = Math.max(...incomeData)
    const maxExpense = Math.max(...snapshots.map(s => s.totalExpense))
    const maxAbsValue = Math.max(maxIncome, maxExpense)
    const roundedMax = Math.ceil(maxAbsValue / 1000) * 1000

    chartInstance.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '소득',
            data: incomeData,
            backgroundColor: snapshots.map(s =>
              selectedYear === s.year ? toRgba(chartLineColors.value, 1) : toRgba(chartLineColors.value, 0.7)
            ),
            borderRadius: 2,
            barPercentage: 0.7,
            categoryPercentage: 0.9,
          },
          {
            label: '지출',
            data: expenseData,
            backgroundColor: snapshots.map(s =>
              selectedYear === s.year ? toRgba(chartLineColors.profit, 1) : toRgba(chartLineColors.profit, 0.7)
            ),
            borderRadius: 2,
            barPercentage: 0.7,
            categoryPercentage: 0.9,
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
        onClick: (event, elements) => {
          if (elements.length > 0 && onYearClick) {
            const index = elements[0].index
            onYearClick(labels[index])
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              padding: 16,
              font: { size: 11 },
              usePointStyle: true,
            },
          },
          tooltip: {
            enabled: false,
            external: externalTooltipHandler,
          },
          annotation: {
            annotations: {
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
                  position: 'start',
                  backgroundColor: 'rgba(100, 116, 139, 0.9)',
                  color: 'white',
                  font: { size: 10, weight: 'bold' },
                  padding: 4,
                },
              },
              zeroLine: {
                type: 'line',
                yMin: 0,
                yMax: 0,
                borderColor: 'rgba(100, 116, 139, 0.8)',
                borderWidth: 1.5,
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              color: chartScaleColors.tickColor,
              maxRotation: 0,
              callback: function(value, index) {
                const year = labels[index]
                // 5년 단위 또는 현재 연도, 은퇴 연도만 표시
                if (year === currentYear || year === retirementYear || year % 5 === 0) {
                  return year
                }
                return ''
              },
            },
          },
          y: {
            stacked: true,
            min: -roundedMax,
            max: roundedMax,
            grid: {
              color: chartScaleColors.gridColor,
            },
            ticks: {
              font: { size: 10 },
              color: chartScaleColors.tickColor,
              callback: function(value) {
                const numValue = Number(value)
                if (numValue === 0) return '0'
                const prefix = numValue > 0 ? '+' : '-'
                return `${prefix}${formatMoney(numValue)}`
              },
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
  }, [snapshots, retirementYear, selectedYear, onYearClick, currentYear, externalTooltipHandler, chartScaleColors, chartLineColors, toRgba])

  if (snapshots.length === 0) {
    return (
      <div className={styles.emptyState}>
        데이터를 입력하면 현금흐름 시뮬레이션을 확인할 수 있습니다
      </div>
    )
  }

  return (
    <div className={styles.chartWrapper}>
      <canvas ref={chartRef} />
    </div>
  )
}
