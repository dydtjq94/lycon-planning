'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import type { SimulationResult, MonthlySnapshot } from '@/lib/services/simulationTypes'
import { groupIncomeItems, groupExpenseItems, groupCashFlowItems } from '@/lib/utils/tooltipCategories'
import {
  getOrCreateTooltip,
  removeTooltip,
  positionTooltip,
  hideTooltip,
  formatMoneyWithUnit,
  getAgeText,
} from '@/lib/utils/chartTooltip'
import { useChartTheme } from '@/hooks/useChartTheme'
import { getLifecycleIcon, getLifecycleIconSvg } from '@/lib/constants/lifecycle'
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
  spouseRetirementYear?: number | null
  birthYear?: number
  spouseBirthYear?: number | null
  onYearClick?: (year: number) => void
  selectedYear?: number | null
  headerAction?: React.ReactNode
  monthlySnapshots?: MonthlySnapshot[]
  hideLegend?: boolean
  selfLifeExpectancy?: number
  spouseLifeExpectancy?: number
  lifecycleMilestones?: { year: number; color: string; label: string; iconId: string }[]
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
  spouseRetirementYear,
  birthYear,
  spouseBirthYear,
  onYearClick,
  selectedYear,
  headerAction,
  monthlySnapshots,
  hideLegend,
  selfLifeExpectancy,
  spouseLifeExpectancy,
  lifecycleMilestones,
}: CashFlowChartProps) {
  const { chartLineColors, chartScaleColors, categoryColors, isDark, toRgba } = useChartTheme()
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<ChartJS | null>(null)
  const onYearClickRef = useRef(onYearClick)
  onYearClickRef.current = onYearClick
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const hoverIndexRef = useRef<number>(-1)

  const isMonthlyMode = !!monthlySnapshots && monthlySnapshots.length > 0
  const prevMonthlyModeRef = useRef(isMonthlyMode)

  // 생애주기 아이콘 오버레이 위치
  const [milestonePos, setMilestonePos] = useState<{ x: number; y: number; color: string; iconId: string }[]>([])
  const computePosRef = useRef<() => void>(() => {})

  const { snapshots } = simulationResult
  // snapshots 참조가 바뀌면 시뮬레이션 전환으로 간주 → 차트 재생성
  const prevSnapshotsRef = useRef(snapshots)
  // 초기 애니메이션 진행 중 플래그
  const isAnimatingRef = useRef(false)
  const currentYear = new Date().getFullYear()

  // 생애주기 아이콘 위치 계산 함수
  computePosRef.current = () => {
    const chart = chartInstance.current
    if (!chart || !lifecycleMilestones?.length || !chart.scales?.x || !chart.scales?.y || !chart.chartArea) {
      setMilestonePos(prev => prev.length === 0 ? prev : [])
      return
    }
    const labels = chart.data.labels as (number | string)[]
    const chartTop = chart.chartArea.top
    const iconSize = 17
    const iconGap = 2
    const iconPad = 4

    // 바 상단 Y 좌표 (애니메이션 중 현재 위치 사용)
    const getBarTopY = (idx: number): number => {
      const zeroY = chart.scales.y.getPixelForValue(0)
      const meta = chart.getDatasetMeta(0)
      const el = meta?.data[idx] as any
      if (el) {
        const val = (chart.data.datasets[0]?.data as number[])?.[idx] ?? 0
        return val >= 0 ? el.y : zeroY
      }
      const val = (chart.data.datasets[0]?.data as number[])?.[idx] ?? 0
      return chart.scales.y.getPixelForValue(Math.max(val, 0))
    }

    const xCountMap = new Map<number, number>()
    const pos = lifecycleMilestones.map(milestone => {
      const idx = isMonthlyMode && monthlySnapshots
        ? monthlySnapshots.findIndex(ms => ms.year === milestone.year && ms.month === 1)
        : labels.findIndex(y => Number(y) === milestone.year)
      if (idx < 0) return null
      const x = chart.scales.x.getPixelForValue(idx)
      const barTopY = getBarTopY(idx)
      const stackIdx = xCountMap.get(idx) || 0
      xCountMap.set(idx, stackIdx + 1)
      const y = barTopY - iconPad - iconSize - stackIdx * (iconSize + iconGap)
      return {
        x,
        y: Math.max(y, chartTop),
        color: milestone.color,
        iconId: milestone.iconId,
      }
    }).filter(Boolean) as { x: number; y: number; color: string; iconId: string }[]
    setMilestonePos(prev => {
      if (prev.length !== pos.length) return pos
      const same = prev.every((p, i) =>
        Math.abs(p.x - pos[i].x) < 0.5 && Math.abs(p.y - pos[i].y) < 0.5 && p.color === pos[i].color && p.iconId === pos[i].iconId
      )
      return same ? prev : pos
    })
  }

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

    // Monthly mode tooltip
    if (isMonthlyMode && monthlySnapshots) {
      const ms = monthlySnapshots[dataIndex]
      if (!ms) {
        hideTooltip(tooltipEl)
        return
      }

      const textColor = isDark ? '#ffffff' : '#1d1d1f'
      const textSecondary = isDark ? '#a1a1aa' : '#86868b'
      const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
      const ageText = getAgeText(ms.year, birthYear, spouseBirthYear, selfLifeExpectancy, spouseLifeExpectancy)
      const netCashFlow = ms.netCashFlow
      const netColor = netCashFlow >= 0 ? '#10b981' : '#ef4444'
      const netPrefix = netCashFlow >= 0 ? '+' : '-'

      const incomeItemsHtml = ms.incomeBreakdown.length > 0 ? `
        <div style="margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 700; color: ${textColor};">월수입</span>
            <span style="font-size: 13px; font-weight: 700; color: #10b981;">+${formatMoneyWithUnit(ms.monthlyIncome)}</span>
          </div>
          ${ms.incomeBreakdown.filter(i => i.amount > 0).map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 3px; padding-left: 4px;">
              <span style="font-size: 12px; color: ${textColor};">${item.title}</span>
              <span style="font-size: 12px; color: ${textColor};">${formatMoneyWithUnit(item.amount)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''

      const expenseItemsHtml = ms.expenseBreakdown.length > 0 ? `
        <div style="margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 700; color: ${textColor};">월지출</span>
            <span style="font-size: 13px; font-weight: 700; color: #ef4444;">-${formatMoneyWithUnit(ms.monthlyExpense)}</span>
          </div>
          ${ms.expenseBreakdown.filter(i => i.amount > 0).map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 3px; padding-left: 4px;">
              <span style="font-size: 12px; color: ${textColor};">${item.title}</span>
              <span style="font-size: 12px; color: ${textColor};">${formatMoneyWithUnit(item.amount)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''

      // 생애주기 마일스톤 (해당 년도)
      const msMatches = lifecycleMilestones?.filter(m => m.year === ms.year) || []
      const msMilestoneHtml = msMatches.length > 0 ? `
        <div style="margin-top: 10px; border-top: 1px solid ${borderColor}; padding-top: 10px;">
          ${msMatches.map(m => `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: ${m.color}20; flex-shrink: 0;">${getLifecycleIconSvg(m.iconId, m.color, 11)}</span>
              <span style="font-size: 12px; color: ${m.color}; font-weight: 600;">${m.label}</span>
            </div>
          `).join('')}
        </div>
      ` : ''

      tooltipEl.innerHTML = `
        <div style="font-size: 18px; font-weight: 700; color: ${textColor}; margin-bottom: 2px;">${ms.year}년 ${ms.month}월</div>
        <div style="font-size: 12px; color: ${textSecondary}; margin-bottom: 12px;">${ageText}</div>
        <div style="border-top: 1px solid ${borderColor}; padding-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; font-weight: 700; color: ${textColor};">순 현금흐름</span>
            <span style="font-size: 14px; font-weight: 700; color: ${netColor};">${netPrefix}${formatMoneyWithUnit(netCashFlow)}</span>
          </div>
        </div>
        ${incomeItemsHtml}
        ${expenseItemsHtml}
        ${msMilestoneHtml}
      `

      positionTooltip(tooltipEl, chart.canvas, mouseRef.current.x, mouseRef.current.y)
      return
    }

    const snapshot = snapshots[dataIndex]

    if (!snapshot) {
      hideTooltip(tooltipEl)
      return
    }

    const textColor = isDark ? '#ffffff' : '#1d1d1f'
    const textSecondary = isDark ? '#a1a1aa' : '#86868b'
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

    // 나이 텍스트
    const ageText = getAgeText(snapshot.year, birthYear, spouseBirthYear, selfLifeExpectancy, spouseLifeExpectancy)

    // 소득/지출 breakdown
    let incomeItemsHtml = ''
    let expenseItemsHtml = ''

    // 순현금흐름 (cashFlowBreakdown 기반으로 계산)
    let netCashFlow = snapshot.netCashFlow  // fallback
    let netPrefix = netCashFlow >= 0 ? '+' : '-'
    let netColor = netCashFlow >= 0 ? '#10b981' : '#ef4444'

    const cfItems = snapshot.cashFlowBreakdown
    if (cfItems && cfItems.length > 0) {
      // V2: use cashFlowBreakdown with grouped categories (exclude deficit/surplus - Sankey only)
      const regularItems = cfItems.filter(
        item => item.flowType !== 'deficit_withdrawal' && item.flowType !== 'surplus_investment'
      )
      const { inflows, outflows, totalInflow, totalOutflow } = groupCashFlowItems(regularItems)

      // cashFlowItems 기반 순현금흐름 (모든 뷰에서 동일한 값)
      netCashFlow = totalInflow - totalOutflow
      netPrefix = netCashFlow >= 0 ? '+' : '-'
      netColor = netCashFlow >= 0 ? '#10b981' : '#ef4444'

      incomeItemsHtml = inflows.length > 0 ? `
        <div style="margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 700; color: ${textColor};">공급</span>
            <span style="font-size: 13px; font-weight: 700; color: #10b981;">+${formatMoneyWithUnit(totalInflow)}</span>
          </div>
          ${inflows.map(group => `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 3px; padding-left: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${group.category.color}; flex-shrink: 0;"></span>
                <span style="font-size: 12px; color: ${textColor};">${group.category.label}</span>
              </div>
              <span style="font-size: 12px; color: ${textColor};">+${formatMoneyWithUnit(group.total)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''

      expenseItemsHtml = outflows.length > 0 ? `
        <div style="margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 700; color: ${textColor};">수요</span>
            <span style="font-size: 13px; font-weight: 700; color: #ef4444;">-${formatMoneyWithUnit(totalOutflow)}</span>
          </div>
          ${outflows.map(group => `
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
    } else {
      // Fallback: use old income/expense breakdowns
      const incomeGroups = groupIncomeItems(snapshot.incomeBreakdown)
      const expenseGroups = groupExpenseItems(snapshot.expenseBreakdown)
      const totalIncome = incomeGroups.reduce((sum, g) => sum + g.total, 0)
      const totalExpense = expenseGroups.reduce((sum, g) => sum + g.total, 0)

      incomeItemsHtml = incomeGroups.length > 0 ? `
        <div style="margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 700; color: ${textColor};">공급</span>
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

      expenseItemsHtml = expenseGroups.length > 0 ? `
        <div style="margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 700; color: ${textColor};">수요</span>
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
    }

    // 생애주기 마일스톤 (해당 년도)
    const yearMatches = lifecycleMilestones?.filter(m => m.year === snapshot.year) || []
    const milestoneHtml = yearMatches.length > 0 ? `
      <div style="margin-top: 10px; border-top: 1px solid ${borderColor}; padding-top: 10px;">
        ${yearMatches.map(m => `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: ${m.color}20; flex-shrink: 0;">${getLifecycleIconSvg(m.iconId, m.color, 11)}</span>
            <span style="font-size: 12px; color: ${m.color}; font-weight: 600;">${m.label}</span>
          </div>
        `).join('')}
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
      ${milestoneHtml}
    `

    positionTooltip(tooltipEl, chart.canvas, mouseRef.current.x, mouseRef.current.y)
  }, [snapshots, isDark, birthYear, spouseBirthYear, isMonthlyMode, monthlySnapshots, selfLifeExpectancy, spouseLifeExpectancy, lifecycleMilestones])

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
    if (!chartRef.current || snapshots.length === 0) return

    // 월별/연별 데이터 선택
    const labels: (number | string)[] = isMonthlyMode && monthlySnapshots
      ? monthlySnapshots.map(ms => {
          const yy = String(ms.year).slice(-2)
          const mm = String(ms.month).padStart(2, '0')
          return `${yy}.${mm}`
        })
      : snapshots.map(s => s.year)
    const netCashFlowData = isMonthlyMode && monthlySnapshots
      ? monthlySnapshots.map(ms => ms.netCashFlow)
      : snapshots.map(s => s.netCashFlow)

    // 바 색상 (양수/음수)
    const bgColors = netCashFlowData.map(v => v >= 0 ? toRgba(positiveColor, 0.7) : toRgba(negativeColor, 0.7))

    // 0을 가운데로 대칭 y축 (그리드 한 칸 여유)
    const rawPosMax = Math.max(...netCashFlowData)
    const rawNegMin = Math.min(...netCashFlowData)
    const absRange = Math.max(Math.abs(rawPosMax), Math.abs(rawNegMin))
    let maxAbs: number
    if (absRange === 0) {
      maxAbs = 1
    } else {
      const roughStep = absRange / 4
      const mag = Math.pow(10, Math.floor(Math.log10(roughStep)))
      const norm = roughStep / mag
      const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
      const posSteps = Math.ceil(Math.abs(rawPosMax) / step) + 1
      const negSteps = Math.ceil(Math.abs(rawNegMin) / step) + 1
      maxAbs = Math.max(posSteps, negSteps) * step
    }

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

    // 생애주기 마일스톤 (은퇴, 기대수명 등)
    if (lifecycleMilestones) {
      lifecycleMilestones.forEach((milestone, idx) => {
        const milestoneIndex = isMonthlyMode && monthlySnapshots
          ? monthlySnapshots.findIndex(ms => ms.year === milestone.year && ms.month === 1)
          : labels.findIndex(y => Number(y) === milestone.year)

        if (milestoneIndex >= 0) {
          annotationsConfig[`milestone_${idx}`] = {
            type: 'line',
            xMin: milestoneIndex,
            xMax: milestoneIndex,
            borderColor: `${milestone.color}25`,
            borderWidth: 1,
            borderDash: [3, 3],
          }
        }
      })
    }

    // 선택된 연도 라인
    if (selectedYear && chartRef.current) {
      const selectedIndex = isMonthlyMode && monthlySnapshots
        ? monthlySnapshots.findIndex(ms => {
            const selectedMonth = Math.round((selectedYear % 1) * 100) || 1
            return ms.year === Math.floor(selectedYear) && ms.month === selectedMonth
          })
        : labels.findIndex(label => Number(label) === selectedYear)
      if (selectedIndex >= 0) {
        const accentColor = getComputedStyle(chartRef.current).getPropertyValue('--accent-color').trim() || '#007aff'
        const accentWithOpacity = `color-mix(in srgb, ${accentColor} 40%, transparent)`
        annotationsConfig.selectedLine = {
          type: 'line',
          xMin: selectedIndex,
          xMax: selectedIndex,
          borderColor: accentWithOpacity,
          borderWidth: 2,
        }
      }
    }

    // snapshots 참조 변경 감지 (시뮬레이션 전환, 기간 변경 등)
    const snapshotsChanged = prevSnapshotsRef.current !== snapshots
    prevSnapshotsRef.current = snapshots

    // 모드 전환 또는 데이터 변경 시 차트 재생성 (애니메이션 재생)
    if (chartInstance.current && (prevMonthlyModeRef.current !== isMonthlyMode || snapshotsChanged)) {
      chartInstance.current.destroy()
      chartInstance.current = null
    }
    prevMonthlyModeRef.current = isMonthlyMode

    // 초기 애니메이션 진행 중이면 어노테이션/아이콘만 업데이트 (데이터 업데이트로 애니메이션 중단 방지)
    if (chartInstance.current && isAnimatingRef.current) {
      const chart = chartInstance.current
      ;(chart.options.plugins as any).annotation = { annotations: annotationsConfig }
      computePosRef.current()
      return
    }

    // 차트가 이미 있으면 데이터/옵션만 업데이트 (테마 변경 등)
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
      computePosRef.current()
      return
    }

    // 최초 생성 (또는 데이터 변경 후 재생성)
    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    const zeroData = netCashFlowData.map(() => 0)

    chartInstance.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '순현금흐름',
          data: zeroData,
          backgroundColor: bgColors,
          borderWidth: 0,
          borderRadius: 3,
          barPercentage: 0.92,
          categoryPercentage: 0.92,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        transitions: { resize: { animation: { duration: 0 } } },
        onResize: () => { requestAnimationFrame(() => computePosRef.current()) },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        onClick: (_event, elements, chart) => {
          if (elements.length > 0 && onYearClickRef.current) {
            const index = elements[0].index
            const label = chart.data.labels?.[index]
            if (label) {
              if (isMonthlyMode && monthlySnapshots) {
                const ms = monthlySnapshots[index]
                if (ms) onYearClickRef.current(ms.year + ms.month / 100)
              } else {
                onYearClickRef.current(Number(label))
              }
            }
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

    // 0→실제 데이터 전환 애니메이션 (초기 생성 시에만, onComplete에서 아이콘 위치 계산)
    isAnimatingRef.current = true
    requestAnimationFrame(() => {
      const chart = chartInstance.current
      if (!chart) { isAnimatingRef.current = false; return }
      ;(chart.options as any).animation = {
        duration: 800,
        easing: 'easeOutQuart',
        onProgress: () => {
          computePosRef.current()
        },
        onComplete: () => {
          isAnimatingRef.current = false
          computePosRef.current()
        },
      }
      ;(chart.data.datasets[0] as any).data = netCashFlowData
      chart.update()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, lifecycleMilestones, externalTooltipHandler, chartScaleColors, chartLineColors, categoryColors, isDark, toRgba, isMonthlyMode, monthlySnapshots])

  // 선택된 연도가 변경될 때 annotation만 업데이트
  useEffect(() => {
    if (!chartInstance.current || !chartRef.current) return

    const chart = chartInstance.current
    const annotations = (chart.options.plugins?.annotation as { annotations?: Record<string, unknown> })?.annotations

    if (!annotations) return

    const labels = chart.data.labels as number[]
    const newSelectedIndex = (() => {
      if (!selectedYear) return -1
      if (isMonthlyMode && monthlySnapshots) {
        const selectedMonth = Math.round((selectedYear % 1) * 100) || 1
        return monthlySnapshots.findIndex(ms => ms.year === Math.floor(selectedYear) && ms.month === selectedMonth)
      }
      const chartLabels = chart.data.labels as number[]
      return chartLabels.findIndex(label => Number(label) === selectedYear)
    })()

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
  }, [selectedYear, snapshots, isMonthlyMode, monthlySnapshots])

  if (snapshots.length === 0) {
    return (
      <div className={styles.emptyState}>
        데이터를 입력하면 현금흐름 시뮬레이션을 확인할 수 있습니다
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {!hideLegend && (
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
      )}
      <div className={styles.chartWrapper}>
        <canvas ref={chartRef} />
        {milestonePos.map((pos, i) => {
          const Icon = getLifecycleIcon(pos.iconId)
          return (
            <div key={i} style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 10,
              width: 17,
              height: 17,
              borderRadius: '50%',
              background: `${pos.color}${isDark ? '30' : '20'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icon size={10} color={pos.color} strokeWidth={2.5} />
            </div>
          )
        })}
      </div>
      <p className={styles.hint}>
        차트를 클릭하면 해당 연도의 상세 정보를 볼 수 있습니다
      </p>
    </div>
  )
}
