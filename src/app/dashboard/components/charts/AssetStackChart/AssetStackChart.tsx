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
import { getLifecycleIcon, getLifecycleIconSvg } from '@/lib/constants/lifecycle'
import { DonutPairView } from './DonutPairView'
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
  lifecycleMilestones?: { year: number; color: string; label: string; iconId: string; opacity?: number }[]
  overlayLines?: { label: string; color: string; data: (number | null)[] }[]
  compareItems?: { key: string; label: string; color: string; selected: boolean }[]
  onToggleCompare?: (key: string) => void
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
  lifecycleMilestones,
  overlayLines,
  compareItems,
  onToggleCompare,
}: AssetStackChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<ChartJS | null>(null)
  const onYearClickRef = useRef(onYearClick)
  onYearClickRef.current = onYearClick
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const hoverIndexRef = useRef<number>(-1)
  const { chartScaleColors, isDark, categoryColors, chartLineColors, toRgba, assetCategoryColors, debtCategoryColors } = useChartTheme()
  const [chartMode, setChartMode] = useState<'bar' | 'line' | 'donut'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('asset-chart-mode') as 'bar' | 'line' | 'donut') || 'line'
    }
    return 'line'
  })
  const handleChartModeChange = useCallback((mode: 'bar' | 'line' | 'donut') => {
    setChartMode(mode)
    localStorage.setItem('asset-chart-mode', mode)
  }, [])
  const chartModeRef = useRef(chartMode)
  chartModeRef.current = chartMode
  const prevChartModeRef = useRef(chartMode)

  // 생애주기 아이콘 오버레이 위치
  const [milestonePos, setMilestonePos] = useState<{ x: number; y: number; color: string; iconId: string; opacity?: number }[]>([])
  const computePosRef = useRef<() => void>(() => {})

  const { snapshots } = simulationResult

  const isMonthlyMode = !!monthlySnapshots && monthlySnapshots.length > 0
  const prevMonthlyModeRef = useRef(isMonthlyMode)
  // snapshots 참조가 바뀌면 시뮬레이션 전환으로 간주 → 차트 재생성
  const prevSnapshotsRef = useRef(snapshots)
  // 초기 애니메이션 진행 중 플래그 (업데이트 경로가 애니메이션을 중단하지 않도록)
  const isAnimatingRef = useRef(false)

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

  // 생애주기 아이콘 위치 계산 함수 (ref로 최신 클로저 유지)
  computePosRef.current = () => {
    const chart = chartInstance.current
    if (!chart || !chart.scales?.x || !chart.scales?.y || !chart.chartArea) {
      setMilestonePos(prev => prev.length === 0 ? prev : [])
      return
    }
    const labels = chart.data.labels as string[]
    const chartTop = chart.chartArea.top
    const iconSize = 17
    const iconGap = 2
    const iconPad = 4

    // 바 상단 Y 좌표 가져오기 (애니메이션 중 현재 위치 사용)
    const getBarTopY = (idx: number): number => {
      const zeroY = chart.scales.y.getPixelForValue(0)
      if (chartMode === 'bar') {
        // 스택 바: 가장 높은 양수 바 엘리먼트의 현재 y 위치
        let topY = zeroY
        for (let d = 0; d < chart.data.datasets.length; d++) {
          const val = (chart.data.datasets[d].data as number[])[idx]
          if (val != null && val > 0) {
            const meta = chart.getDatasetMeta(d)
            const el = meta.data[idx] as any
            if (el && el.y < topY) topY = el.y
          }
        }
        return topY
      }
      // 라인 모드: 라인 포인트의 현재 y 위치
      const lineMeta = chart.getDatasetMeta(1)
      const el = lineMeta?.data[idx] as any
      if (el) return Math.min(el.y, zeroY)
      const val = (chart.data.datasets[0]?.data as number[])?.[idx] ?? 0
      return chart.scales.y.getPixelForValue(Math.max(val, 0))
    }

    // 같은 x 위치에 여러 아이콘이 겹치면 위로 쌓기
    const xCountMap = new Map<number, number>()
    const pos: { x: number; y: number; color: string; iconId: string; opacity?: number }[] = []

    // 생애주기 마일스톤
    if (lifecycleMilestones?.length) {
      [...lifecycleMilestones].reverse().forEach(milestone => {
        const idx = isMonthlyMode && monthlyChartData
          ? monthlyChartData.snapshots.findIndex(ms => ms.year === milestone.year && ms.month === 1)
          : labels.findIndex(l => parseInt(String(l)) === milestone.year)
        if (idx < 0) return
        const x = chart.scales.x.getPixelForValue(idx)
        const barTopY = getBarTopY(idx)
        const stackIdx = xCountMap.get(idx) || 0
        xCountMap.set(idx, stackIdx + 1)
        const y = barTopY - iconPad - iconSize - stackIdx * (iconSize + iconGap)
        pos.push({ x, y: Math.max(y, chartTop), color: milestone.color, iconId: milestone.iconId, opacity: milestone.opacity })
      })
    }

    // 금융자산 소진 (마이너스 통장 시작)
    const overdraftIdx = isMonthlyMode && monthlyChartData
      ? monthlyChartData.snapshots.findIndex(ms => ms.debtBreakdown?.some(d => d.title === '마이너스 통장'))
      : chartData.snapshots.findIndex(s => s.debtBreakdown?.some(d => d.title === '마이너스 통장'))
    if (overdraftIdx >= 0) {
      const x = chart.scales.x.getPixelForValue(overdraftIdx)
      const barTopY = getBarTopY(overdraftIdx)
      const stackIdx = xCountMap.get(overdraftIdx) || 0
      xCountMap.set(overdraftIdx, stackIdx + 1)
      const y = barTopY - iconPad - iconSize - stackIdx * (iconSize + iconGap)
      pos.push({ x, y: Math.max(y, chartTop), color: '#ef4444', iconId: 'circle-alert' })
    }

    setMilestonePos(prev => {
      if (prev.length !== pos.length) return pos
      const same = prev.every((p, i) =>
        Math.abs(p.x - pos[i].x) < 0.5 && Math.abs(p.y - pos[i].y) < 0.5 && p.color === pos[i].color && p.iconId === pos[i].iconId && p.opacity === pos[i].opacity
      )
      return same ? prev : pos
    })
  }

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
        color: assetCategoryColors[category.id] || category.color,
        data: perSnapshot.map(s => {
          const group = s.assetGroups.find(g => g.category.id === category.id)
          return group ? group.total : 0
        }),
      }))

    const debtDatasets = DEBT_CATEGORIES
      .filter(c => allDebtCategoryIds.has(c.id))
      .map(category => ({
        label: category.label,
        color: debtCategoryColors[category.id] || category.color,
        data: perSnapshot.map(s => {
          const group = s.debtGroups.find(g => g.category.id === category.id)
          return group ? -group.total : 0
        }),
      }))

    return { assetDatasets, debtDatasets }
  }, [chartData.snapshots, isMonthlyMode, monthlySnapshots, assetCategoryColors, debtCategoryColors])

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

    // 오버레이 비교 섹션 HTML 빌더
    const buildOverlayHtml = (idx: number, borderColor: string) => {
      if (!overlayLines || overlayLines.length === 0) return ''
      const items = overlayLines
        .map(line => {
          const val = line.data[idx]
          if (val == null) return ''
          const prefix = val >= 0 ? '' : '-'
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 0; border-top: 2px dashed ${line.color}; flex-shrink: 0;"></span>
                <span style="font-size: 11px; color: ${isDark ? '#9a9b9e' : '#a8a29e'};">${line.label}</span>
              </div>
              <span style="font-size: 11px; color: ${isDark ? '#9a9b9e' : '#a8a29e'};">${prefix}${formatMoneyWithUnit(val)}</span>
            </div>`
        })
        .filter(Boolean)
        .join('')
      if (!items) return ''
      return `
        <div style="margin-top: 10px; border-top: 1px solid ${borderColor}; padding-top: 10px;">
          ${items}
        </div>`
    }

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
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${assetCategoryColors[group.category.id] || group.category.color}; flex-shrink: 0;"></span>
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
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${debtCategoryColors[group.category.id] || group.category.color}; flex-shrink: 0;"></span>
                <span style="font-size: 12px; color: ${textColor};">${group.category.label}</span>
              </div>
              <span style="font-size: 12px; color: ${textColor};">-${formatMoneyWithUnit(group.total)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''

      // 생애주기 마일스톤 + 금융자산 소진 (해당 년도)
      const msMatches = lifecycleMilestones?.filter(m => m.year === ms.year) || []
      const isOverdraftStart = ms.debtBreakdown?.some(d => d.title === '마이너스 통장') && (dataIndex === 0 || !monthlyChartData!.snapshots[dataIndex - 1]?.debtBreakdown?.some(d => d.title === '마이너스 통장'))
      const allMarkers = [
        ...msMatches.map(m => ({ iconId: m.iconId, color: m.color, label: m.label })),
        ...(isOverdraftStart ? [{ iconId: 'circle-alert', color: '#ef4444', label: '금융자산 소진' }] : []),
      ]
      const msMilestoneHtml = allMarkers.length > 0 ? `
        <div style="margin-top: 10px; border-top: 1px solid ${borderColor}; padding-top: 10px;">
          ${allMarkers.map(m => `
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
            <span style="font-size: 14px; font-weight: 700; color: ${textColor};">순자산</span>
            <span style="font-size: 14px; font-weight: 700; color: ${netColor};">${netPrefix}${formatMoneyWithUnit(netWorth)}</span>
          </div>
        </div>
        ${assetSectionHtml}
        ${debtSectionHtml}
        ${buildOverlayHtml(dataIndex, borderColor)}
        ${msMilestoneHtml}
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
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${assetCategoryColors[group.category.id] || group.category.color}; flex-shrink: 0;"></span>
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
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${debtCategoryColors[group.category.id] || group.category.color}; flex-shrink: 0;"></span>
              <span style="font-size: 12px; color: ${textColor};">${group.category.label}</span>
            </div>
            <span style="font-size: 12px; color: ${textColor};">-${formatMoneyWithUnit(group.total)}</span>
          </div>
        `).join('')}
      </div>
    ` : ''

    // 생애주기 마일스톤 + 금융자산 소진 (해당 년도)
    const yearMatches = lifecycleMilestones?.filter(m => m.year === snapshot.year) || []
    const isOverdraftYear = snapshot.debtBreakdown?.some(d => d.title === '마이너스 통장') && (dataIndex === 0 || !chartData.snapshots[dataIndex - 1]?.debtBreakdown?.some(d => d.title === '마이너스 통장'))
    const allYearMarkers = [
      ...yearMatches.map(m => ({ iconId: m.iconId, color: m.color, label: m.label })),
      ...(isOverdraftYear ? [{ iconId: 'circle-alert', color: '#ef4444', label: '금융자산 소진' }] : []),
    ]
    const milestoneHtml = allYearMarkers.length > 0 ? `
      <div style="margin-top: 10px; border-top: 1px solid ${borderColor}; padding-top: 10px;">
        ${allYearMarkers.map(m => `
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
          <span style="font-size: 14px; font-weight: 700; color: ${textColor};">순자산</span>
          <span style="font-size: 14px; font-weight: 700; color: ${netColor};">${netPrefix}${formatMoneyWithUnit(netWorth)}</span>
        </div>
      </div>
      ${assetSectionHtml}
      ${debtSectionHtml}
      ${buildOverlayHtml(dataIndex, borderColor)}
      ${milestoneHtml}
    `

    positionTooltip(tooltipEl, chart.canvas, mouseRef.current.x, mouseRef.current.y)
  }, [chartData.snapshots, isDark, birthYear, spouseBirthYear, isMonthlyMode, monthlyChartData, selfLifeExpectancy, spouseLifeExpectancy, lifecycleMilestones, overlayLines, assetCategoryColors, debtCategoryColors])

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

    // 생애주기 마일스톤 (은퇴, 기대수명 등)
    if (lifecycleMilestones) {
      lifecycleMilestones.forEach((milestone, idx) => {
        const milestoneIndex = isMonthlyMode && monthlyChartData
          ? monthlyChartData.snapshots.findIndex(ms => ms.year === milestone.year && ms.month === 1)
          : activeLabels.findIndex(label => parseInt(label) === milestone.year)

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
        borderColor: 'rgba(239, 68, 68, 0.25)',
        borderWidth: 1,
        borderDash: [3, 3],
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

    // 스택 바 최상단 border-radius 플러그인
    // 스택 바에서 최상단/최하단 바에만 borderRadius 적용하는 헬퍼
    const applyTopBarRadius = (chart: any, barData: { data: number[] }[]) => {
      const dataLength = barData[0]?.data.length || 0
      const topPositiveByIdx = new Array(dataLength).fill(-1)
      const bottomNegativeByIdx = new Array(dataLength).fill(-1)
      for (let i = 0; i < dataLength; i++) {
        for (let d = 0; d < barData.length; d++) {
          if (barData[d].data[i] > 0) topPositiveByIdx[i] = d
          if (barData[d].data[i] < 0) bottomNegativeByIdx[i] = d
        }
      }
      barData.forEach((_ds, dsIdx) => {
        const chartDs = chart.data.datasets[dsIdx] as any
        if (!chartDs) return
        chartDs.borderRadius = (ctx: any) => {
          const di = ctx.dataIndex
          if (dsIdx === topPositiveByIdx[di]) return { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 }
          if (dsIdx === bottomNegativeByIdx[di]) return { topLeft: 0, topRight: 0, bottomLeft: 3, bottomRight: 3 }
          return 0
        }
        chartDs.borderSkipped = false
      })
    }

    // snapshots 참조 변경 감지 (시뮬레이션 전환, 기간 변경 등)
    const snapshotsChanged = prevSnapshotsRef.current !== snapshots
    prevSnapshotsRef.current = snapshots

    // 모드 전환 또는 데이터 변경 시 차트 재생성 (애니메이션 재생)
    if (chartInstance.current && (prevMonthlyModeRef.current !== isMonthlyMode || prevChartModeRef.current !== chartMode || snapshotsChanged)) {
      chartInstance.current.destroy()
      chartInstance.current = null
    }
    prevMonthlyModeRef.current = isMonthlyMode
    prevChartModeRef.current = chartMode

    // Y축 범위 계산 (bar/line 모두 0 중심 대칭, 그리드 한 칸 여유)
    const computeNiceAxisMax = (posMax: number, negMin: number): number => {
      const absMax = Math.max(Math.abs(posMax), Math.abs(negMin))
      if (absMax === 0) return 1
      const roughStep = absMax / 4
      const mag = Math.pow(10, Math.floor(Math.log10(roughStep)))
      const norm = roughStep / mag
      const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
      const posSteps = Math.ceil(Math.abs(posMax) / step) + 1
      const negSteps = Math.ceil(Math.abs(negMin) / step) + 1
      return Math.max(posSteps, negSteps) * step
    }

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
      const maxAbs = computeNiceAxisMax(rawMax, rawMin)
      yMin = -maxAbs
      yMax = maxAbs
    } else {
      const dataMax = Math.max(...activeNetWorthData)
      const dataMin = Math.min(...activeNetWorthData)
      const maxAbs = computeNiceAxisMax(dataMax, dataMin)
      yMin = -maxAbs
      yMax = maxAbs
    }

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
      chart.data.labels = activeLabels

      if (chartMode === 'bar' && stackedBarData) {
        const allBarData = [...[...stackedBarData.assetDatasets].reverse(), ...stackedBarData.debtDatasets]
        allBarData.forEach((ds, i) => {
          const chartDs = chart.data.datasets[i] as any
          if (chartDs) {
            chartDs.data = ds.data
            chartDs.backgroundColor = toRgba(ds.color, 0.8)
          }
        })
        applyTopBarRadius(chart, allBarData)
      } else {
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

      // 오버레이 라인 업데이트
      const baseCount = chartMode === 'bar' && stackedBarData
        ? [...stackedBarData.assetDatasets, ...stackedBarData.debtDatasets].length
        : 2
      while (chart.data.datasets.length > baseCount) chart.data.datasets.pop()
      if (overlayLines && overlayLines.length > 0) {
        overlayLines.forEach(line => {
          chart.data.datasets.push({
            type: 'line' as const,
            label: line.label,
            data: line.data,
            borderColor: line.color,
            borderWidth: 2,
            borderDash: [6, 3],
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: line.color,
            tension: 0.35,
            fill: false,
            spanGaps: true,
            stack: undefined,
          } as any)
        })
      }

      if (chart.options.scales?.x?.ticks) chart.options.scales.x.ticks.color = chartScaleColors.tickColor
      if (chart.options.scales?.y) {
        chart.options.scales.y.min = yMin
        chart.options.scales.y.max = yMax
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

    // 최초 생성 또는 데이터 변경 후 재생성 (애니메이션 포함)
    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    // 모드별 데이터셋 구성 (0으로 초기화 → 애니메이션으로 실제 데이터 전환)
    let datasets: any[]
    if (chartMode === 'bar' && stackedBarData) {
      datasets = []
      // 자산은 역순으로 쌓기 (위→아래가 툴팁/사이드바 순서와 일치)
      ;[...stackedBarData.assetDatasets].reverse().forEach(ds => {
        datasets.push({
          label: ds.label,
          data: ds.data.map(() => 0),
          backgroundColor: toRgba(ds.color, 0.8),
          borderWidth: 0,
          borderRadius: 0,
          stack: 'stack',
          barPercentage: 0.92,
          categoryPercentage: 0.92,
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
          barPercentage: 0.92,
          categoryPercentage: 0.92,
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

    // 비교 오버레이 라인 추가
    if (overlayLines && overlayLines.length > 0) {
      overlayLines.forEach(line => {
        datasets.push({
          type: 'line' as const,
          label: line.label,
          data: line.data,
          borderColor: line.color,
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: line.color,
          tension: 0.35,
          fill: false,
          spanGaps: true,
          stack: undefined,
        })
      })
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
              autoSkip: false,
              font: { size: 11 },
              color: chartScaleColors.tickColor,
              callback: function (_, index) {
                const labels = this.chart.data.labels as string[] | undefined
                if (!labels || labels.length === 0) return ''
                const total = labels.length
                if (total <= 15) return labels[index]
                if (index === 0 || index === total - 1) return labels[index]
                const slots = Math.min(15, total) - 2
                if (slots <= 0) return ''
                const step = (total - 2) / (slots + 1)
                for (let s = 1; s <= slots; s++) {
                  if (index === Math.round(s * step)) return labels[index]
                }
                return ''
              },
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
                return `${prefix}${formatChartValue(Math.abs(numValue))}`
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

    // 0→실제 데이터 전환 애니메이션 (초기 생성 시에만, onComplete에서 아이콘 위치 계산)
    isAnimatingRef.current = true
    requestAnimationFrame(() => {
      const chart = chartInstance.current
      if (!chart) { isAnimatingRef.current = false; return }
      // 일시적으로 애니메이션 활성화
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
      if (chartMode === 'bar' && stackedBarData) {
        const allBarData = [...[...stackedBarData.assetDatasets].reverse(), ...stackedBarData.debtDatasets]
        allBarData.forEach((ds, i) => {
          ;(chart.data.datasets[i] as any).data = ds.data
        })
        applyTopBarRadius(chart, allBarData)
        // 오버레이 라인 데이터도 설정 (bar 모드에서 스택 데이터셋 수 이후)
        if (overlayLines) {
          const overlayStartIdx = allBarData.length
          overlayLines.forEach((line, i) => {
            const ds = chart.data.datasets[overlayStartIdx + i] as any
            if (ds) ds.data = line.data
          })
        }
      } else {
        const barDs = chart.data.datasets[0] as any
        const lineDs = chart.data.datasets[1] as any
        barDs.data = activeNetWorthData
        if (lineDs) lineDs.data = activeNetWorthData
        // 오버레이 라인 데이터도 설정 (line 모드에서 2개 기본 데이터셋 이후)
        if (overlayLines) {
          overlayLines.forEach((line, i) => {
            const ds = chart.data.datasets[2 + i] as any
            if (ds) ds.data = line.data
          })
        }
      }
      chart.update()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, lifecycleMilestones, externalTooltipHandler, chartScaleColors, chartLineColors, categoryColors, netWorthData, toRgba, chartMode, isMonthlyMode, monthlyChartData, stackedBarData, overlayLines])

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
        <div className={styles.legend}>
          {chartMode === 'donut' ? null : chartMode === 'bar' && stackedBarData ? (
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
            <>
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
              {compareItems && compareItems.map(item => (
                <button
                  key={item.key}
                  className={`${styles.compareLegendItem} ${item.selected ? styles.compareLegendActive : ''}`}
                  onClick={() => onToggleCompare?.(item.key)}
                  type="button"
                >
                  <span className={styles.compareLegendLine} style={{ borderTopColor: item.color }} />
                  <span className={styles.compareLegendLabel}>{item.label}</span>
                </button>
              ))}
            </>
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
            <button
              className={`${styles.modeButton} ${chartMode === 'donut' ? styles.modeActive : ''}`}
              onClick={() => handleChartModeChange('donut')}
              title="도넛 차트"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
            </button>
          </div>
          {headerAction}
        </div>
      </div>

      {/* 차트 */}
      {chartMode === 'donut' ? (
        <DonutPairView
          snapshot={
            snapshots.find(s => s.year === (selectedYear ?? snapshots[snapshots.length - 1]?.year))
            || snapshots[snapshots.length - 1]
          }
          selectedYear={selectedYear ?? snapshots[snapshots.length - 1]?.year ?? new Date().getFullYear()}
        />
      ) : (
        <>
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
                  opacity: pos.opacity ?? 1,
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

          {/* 클릭 안내 */}
          <p className={styles.hint}>
            차트를 클릭하면 해당 연도의 상세 정보를 볼 수 있습니다
          </p>
        </>
      )}
    </div>
  )
}
