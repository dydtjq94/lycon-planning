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
import type { SimulationResult, MonthlySnapshot } from '@/lib/services/simulationTypes'
import {
  transformSimulationToChartData,
  formatChartValue,
} from '@/lib/utils/chartDataTransformer'
import {
  ASSET_CATEGORIES,
  DEBT_CATEGORIES,
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
  spouseRetirementYear?: number | null
  birthYear?: number
  spouseBirthYear?: number | null
  onYearClick?: (year: number) => void
  selectedYear?: number | null
  headerAction?: React.ReactNode
  monthlySnapshots?: MonthlySnapshot[]
  selfLifeExpectancy?: number
  spouseLifeExpectancy?: number
}


export function AssetStackChart({
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
  selfLifeExpectancy,
  spouseLifeExpectancy,
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
  const prevChartModeRef = useRef(chartMode)

  const { snapshots } = simulationResult

  const isMonthlyMode = !!monthlySnapshots && monthlySnapshots.length > 0
  const prevMonthlyModeRef = useRef(isMonthlyMode)

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

  // 월별 데이터 (isMonthlyMode일 때 사용)
  const monthlyChartData = useMemo(() => {
    if (!isMonthlyMode) return null
    const labels = monthlySnapshots!.map(ms => {
      const yy = String(ms.year).slice(-2)
      const mm = String(ms.month).padStart(2, '0')
      return `${yy}.${mm}`
    })
    const netWorthValues = monthlySnapshots!.map(ms => ms.netWorth)
    return { labels, netWorthValues, snapshots: monthlySnapshots! }
  }, [isMonthlyMode, monthlySnapshots])

  // 막대 모드용 카테고리별 스택 데이터
  const stackedBarData = useMemo(() => {
    const dataSource = isMonthlyMode && monthlySnapshots
      ? monthlySnapshots
      : chartData.snapshots
    if (!dataSource || dataSource.length === 0) return null

    const allAssetCategoryIds = new Set<string>()
    const allDebtCategoryIds = new Set<string>()

    const perSnapshot = dataSource.map(snapshot => {
      const allAssetItems = [
        ...(snapshot.assetBreakdown || []),
        ...(snapshot.pensionBreakdown || [])
      ]
      const assetGroups = groupAssetItems(allAssetItems)
      const debtGroups = groupDebtItems(snapshot.debtBreakdown || [])

      assetGroups.forEach(g => allAssetCategoryIds.add(g.category.id))
      debtGroups.forEach(g => allDebtCategoryIds.add(g.category.id))

      return { assetGroups, debtGroups }
    })

    const assetDatasets = ASSET_CATEGORIES
      .filter(c => allAssetCategoryIds.has(c.id))
      .map(category => ({
        label: category.label,
        color: category.color,
        data: perSnapshot.map(s => {
          const group = s.assetGroups.find(g => g.category.id === category.id)
          return group ? group.total : 0
        }),
      }))

    const debtDatasets = DEBT_CATEGORIES
      .filter(c => allDebtCategoryIds.has(c.id))
      .map(category => ({
        label: category.label,
        color: category.color,
        data: perSnapshot.map(s => {
          const group = s.debtGroups.find(g => g.category.id === category.id)
          return group ? -group.total : 0
        }),
      }))

    return { assetDatasets, debtDatasets }
  }, [chartData.snapshots, isMonthlyMode, monthlySnapshots])

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

    // Monthly mode: use monthlySnapshots
    if (isMonthlyMode && monthlyChartData) {
      const ms = monthlyChartData.snapshots[dataIndex]
      if (!ms) {
        hideTooltip(tooltipEl)
        return
      }

      const textColor = isDark ? '#ffffff' : '#1d1d1f'
      const textSecondary = isDark ? '#a1a1aa' : '#86868b'
      const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
      const netWorth = ms.netWorth
      const netColor = netWorth >= 0 ? '#10b981' : '#ef4444'
      const netPrefix = netWorth >= 0 ? '' : '-'
      const totalAssets = ms.financialAssets + ms.realEstateValue + ms.pensionAssets + (ms.physicalAssetValue || 0)
      const ageText = getAgeText(ms.year, birthYear, spouseBirthYear, selfLifeExpectancy, spouseLifeExpectancy)

      // 자산 카테고리별 그룹핑 (연간 모드와 동일)
      const allAssetItems = [
        ...(ms.assetBreakdown || []),
        ...(ms.pensionBreakdown || [])
      ]
      const assetGroups = groupAssetItems(allAssetItems)
      const debtGroups = groupDebtItems(ms.debtBreakdown || [])

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

      const debtSectionHtml = debtGroups.length > 0 ? `
        <div style="margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 700; color: ${textColor};">부채</span>
            <span style="font-size: 13px; font-weight: 700; color: #ef4444;">-${formatMoneyWithUnit(ms.totalDebts)}</span>
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
        <div style="font-size: 18px; font-weight: 700; color: ${textColor}; margin-bottom: 2px;">${ms.year}년 ${ms.month}월</div>
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
      return
    }

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
    const totalAssets = snapshot.financialAssets + snapshot.realEstateValue + snapshot.pensionAssets + (snapshot.physicalAssetValue || 0)

    // 나이 텍스트
    const ageText = getAgeText(snapshot.year, birthYear, spouseBirthYear, selfLifeExpectancy, spouseLifeExpectancy)

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
  }, [chartData.snapshots, isDark, birthYear, spouseBirthYear, isMonthlyMode, monthlyChartData, selfLifeExpectancy, spouseLifeExpectancy])

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

    // 월별/연별 데이터 선택
    const activeLabels = isMonthlyMode && monthlyChartData ? monthlyChartData.labels : chartData.labels
    const activeNetWorthData = isMonthlyMode && monthlyChartData ? monthlyChartData.netWorthValues : netWorthData

    const retirementIndex = isMonthlyMode && monthlyChartData
      ? monthlyChartData.snapshots.findIndex(ms => ms.year === retirementYear && ms.month === 1)
      : retirementYear
        ? chartData.labels.findIndex(label => parseInt(label) === retirementYear)
        : -1

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

    // 배우자 은퇴선
    const spouseRetirementIndex = spouseRetirementYear
      ? (isMonthlyMode && monthlyChartData
        ? monthlyChartData.snapshots.findIndex(ms => ms.year === spouseRetirementYear && ms.month === 1)
        : activeLabels.findIndex(label => parseInt(label) === spouseRetirementYear))
      : -1

    if (spouseRetirementIndex >= 0 && spouseRetirementIndex !== retirementIndex) {
      annotationsConfig.spouseRetirementLine = {
        type: 'line',
        xMin: spouseRetirementIndex,
        xMax: spouseRetirementIndex,
        borderColor: 'rgba(148, 163, 184, 0.6)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        label: {
          display: true,
          content: '배우자 은퇴',
          position: 'start' as const,
          backgroundColor: 'rgba(148, 163, 184, 0.8)',
          color: '#fff',
          font: { size: 10, weight: 'bold' as const },
          padding: { x: 5, y: 3 },
          borderRadius: 4,
        },
      }
    }

    // 금융자산 소진 (마이너스 통장 시작) 라인
    const overdraftStartIndex = isMonthlyMode && monthlyChartData
      ? monthlyChartData.snapshots.findIndex(ms =>
          ms.debtBreakdown?.some(d => d.title === '마이너스 통장'))
      : chartData.snapshots.findIndex(s =>
          s.debtBreakdown?.some(d => d.title === '마이너스 통장'))

    if (overdraftStartIndex >= 0) {
      annotationsConfig.overdraftLine = {
        type: 'line',
        xMin: overdraftStartIndex,
        xMax: overdraftStartIndex,
        borderColor: 'rgba(239, 68, 68, 0.6)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        label: {
          display: true,
          content: '금융자산 소진',
          position: 'end' as const,
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          color: '#fff',
          font: { size: 10, weight: 'bold' as const },
          padding: { x: 5, y: 3 },
          borderRadius: 4,
        },
      }
    }

    // 선택된 연도 라인
    if (selectedYear && chartRef.current) {
      const selectedIndex = isMonthlyMode && monthlyChartData
        ? monthlyChartData.snapshots.findIndex(ms => {
            const selectedMonth = Math.round((selectedYear % 1) * 100) || 1
            return ms.year === Math.floor(selectedYear) && ms.month === selectedMonth
          })
        : activeLabels.findIndex(label => parseInt(label) === selectedYear)
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

    // 그라데이션 플러그인 (0선 기준) - line mode에만 적용
    const gradientFillPlugin = {
      id: 'gradientFill',
      afterLayout: (chart: ChartJS) => {
        // bar 모드에서는 완전히 스킵 (datasets[1]이 저축 카테고리이므로 건드리면 안됨)
        if (chartModeRef.current !== 'line') return

        const { ctx, chartArea, scales } = chart
        if (!chartArea || !scales.y) return

        const lineDs = chart.data.datasets[1] as any
        if (!lineDs) return

        const chartHeight = chartArea.bottom - chartArea.top
        if (!chartHeight || chartHeight <= 0) return
        const zeroPixel = scales.y.getPixelForValue(0)
        const zeroRatio = (zeroPixel - chartArea.top) / chartHeight
        if (!isFinite(zeroRatio)) return
        const clampedRatio = Math.max(0.01, Math.min(0.99, zeroRatio))

        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        gradient.addColorStop(0, toRgba(positiveColor, 0.25))
        gradient.addColorStop(clampedRatio, toRgba(positiveColor, 0.02))
        gradient.addColorStop(clampedRatio, toRgba(negativeColor, 0.02))
        gradient.addColorStop(1, toRgba(negativeColor, 0.25))

        lineDs.backgroundColor = gradient
      },
    }

    // 월별↔연간 모드 전환 시 차트 완전 재생성 (onClick 클로저 갱신)
    if (chartInstance.current && prevMonthlyModeRef.current !== isMonthlyMode) {
      chartInstance.current.destroy()
      chartInstance.current = null
    }
    prevMonthlyModeRef.current = isMonthlyMode

    // bar/line 모드 전환 시 차트 재생성 (데이터셋 구조가 다름)
    if (chartInstance.current && prevChartModeRef.current !== chartMode) {
      chartInstance.current.destroy()
      chartInstance.current = null
    }
    prevChartModeRef.current = chartMode

    // Y축 범위 계산 (bar/line 모두 0 중심 대칭)
    let yMin: number
    let yMax: number
    if (chartMode === 'bar' && stackedBarData) {
      let rawMax = 0
      let rawMin = 0
      const numPoints = stackedBarData.assetDatasets[0]?.data.length || stackedBarData.debtDatasets[0]?.data.length || 0
      for (let i = 0; i < numPoints; i++) {
        const assetSum = stackedBarData.assetDatasets.reduce((sum, ds) => sum + ds.data[i], 0)
        const debtSum = stackedBarData.debtDatasets.reduce((sum, ds) => sum + ds.data[i], 0)
        rawMax = Math.max(rawMax, assetSum)
        rawMin = Math.min(rawMin, debtSum)
      }
      const maxAbs = Math.max(Math.abs(rawMax), Math.abs(rawMin)) * 1.1
      yMin = -maxAbs
      yMax = maxAbs
    } else {
      const maxAbs = Math.max(Math.abs(Math.max(...activeNetWorthData)), Math.abs(Math.min(...activeNetWorthData))) * 1.1
      yMin = -maxAbs
      yMax = maxAbs
    }

    // 차트가 이미 있으면 데이터/옵션만 업데이트 (같은 모드 내 데이터 변경)
    if (chartInstance.current) {
      const chart = chartInstance.current
      chart.data.labels = activeLabels

      if (chartMode === 'bar' && stackedBarData) {
        // 스택 바 모드: 각 카테고리 데이터셋 업데이트
        const allBarData = [...stackedBarData.assetDatasets, ...stackedBarData.debtDatasets]
        allBarData.forEach((ds, i) => {
          const chartDs = chart.data.datasets[i] as any
          if (chartDs) {
            chartDs.data = ds.data
            chartDs.backgroundColor = toRgba(ds.color, 0.8)
          }
        })
      } else {
        // 라인 모드
        const barDs = chart.data.datasets[0] as any
        const lineDs = chart.data.datasets[1] as any
        barDs.data = activeNetWorthData
        barDs.backgroundColor = 'transparent'
        barDs.borderRadius = 0
        barDs.barPercentage = 1.0
        barDs.categoryPercentage = 1.0
        if (lineDs) {
          lineDs.data = activeNetWorthData
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
        chart.options.scales.y.min = yMin
        chart.options.scales.y.max = yMax
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

    // 모드별 데이터셋 구성
    let datasets: any[]
    if (chartMode === 'bar' && stackedBarData) {
      datasets = []
      stackedBarData.assetDatasets.forEach(ds => {
        datasets.push({
          label: ds.label,
          data: ds.data.map(() => 0),
          backgroundColor: toRgba(ds.color, 0.8),
          borderWidth: 0,
          borderRadius: 0,
          stack: 'stack',
          barPercentage: 0.85,
          categoryPercentage: 0.85,
        })
      })
      stackedBarData.debtDatasets.forEach(ds => {
        datasets.push({
          label: ds.label,
          data: ds.data.map(() => 0),
          backgroundColor: toRgba(ds.color, 0.8),
          borderWidth: 0,
          borderRadius: 0,
          stack: 'stack',
          barPercentage: 0.85,
          categoryPercentage: 0.85,
        })
      })
    } else {
      const zeroData = activeNetWorthData.map(() => 0)
      datasets = [
        {
          label: '순자산-bar',
          data: zeroData,
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderRadius: 0,
          barPercentage: 1.0,
          categoryPercentage: 1.0,
        },
        {
          type: 'line' as const,
          label: '순자산',
          data: zeroData,
          borderColor: positiveColor,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.35,
          fill: 'origin',
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
      ]
    }

    chartInstance.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: activeLabels,
        datasets,
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
            if (label) {
              if (isMonthlyMode && monthlyChartData) {
                const ms = monthlyChartData.snapshots[index]
                if (ms) onYearClickRef.current(ms.year + ms.month / 100)
              } else {
                onYearClickRef.current(parseInt(String(label)))
              }
            }
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
              color: chartScaleColors.tickColor,
            },
            border: { display: false },
          },
          y: {
            stacked: chartMode === 'bar',
            min: yMin,
            max: yMax,
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

    // 0→실제 데이터 전환 애니메이션
    requestAnimationFrame(() => {
      const chart = chartInstance.current
      if (!chart) return
      if (chartMode === 'bar' && stackedBarData) {
        const allBarData = [...stackedBarData.assetDatasets, ...stackedBarData.debtDatasets]
        allBarData.forEach((ds, i) => {
          ;(chart.data.datasets[i] as any).data = ds.data
        })
      } else {
        const barDs = chart.data.datasets[0] as any
        const lineDs = chart.data.datasets[1] as any
        barDs.data = activeNetWorthData
        if (lineDs) lineDs.data = activeNetWorthData
      }
      chart.update()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, retirementYear, spouseRetirementYear, externalTooltipHandler, chartScaleColors, chartLineColors, categoryColors, netWorthData, toRgba, chartMode, isMonthlyMode, monthlyChartData, stackedBarData])

  // 선택된 연도가 변경될 때 annotation만 업데이트 (차트 재생성 X)
  useEffect(() => {
    if (!chartInstance.current || !chartRef.current) return

    const chart = chartInstance.current
    const annotations = (chart.options.plugins?.annotation as { annotations?: Record<string, unknown> })?.annotations

    if (!annotations) return

    // 선택된 연도 인덱스 계산
    const newSelectedIndex = (() => {
      if (!selectedYear) return -1
      if (isMonthlyMode && monthlyChartData) {
        const selectedMonth = Math.round((selectedYear % 1) * 100) || 1
        return monthlyChartData.snapshots.findIndex(ms => ms.year === Math.floor(selectedYear) && ms.month === selectedMonth)
      }
      return chartData.labels.findIndex(label => parseInt(label) === selectedYear)
    })()

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

    chart.update('none')
  }, [selectedYear, chartData.labels, isMonthlyMode, monthlyChartData])

  return (
    <div className={styles.container}>
      {/* 범례 + 헤더 액션 */}
      <div className={styles.legendRow}>
        <div className={styles.legend} style={chartMode === 'bar' ? { flexWrap: 'wrap', gap: '4px 12px' } : undefined}>
          {chartMode === 'bar' && stackedBarData ? (
            <>
              {stackedBarData.assetDatasets.map(ds => (
                <div key={ds.label} className={styles.legendItem}>
                  <span className={styles.legendColor} style={{ background: ds.color }} />
                  <span className={styles.legendLabel}>{ds.label}</span>
                </div>
              ))}
              {stackedBarData.debtDatasets.map(ds => (
                <div key={ds.label} className={styles.legendItem}>
                  <span className={styles.legendColor} style={{ background: ds.color }} />
                  <span className={styles.legendLabel}>{ds.label}</span>
                </div>
              ))}
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
              className={`${styles.modeButton} ${chartMode === 'line' ? styles.modeActive : ''}`}
              onClick={() => handleChartModeChange('line')}
              title="라인 차트"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 12L4.5 7L8 9L13 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
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
