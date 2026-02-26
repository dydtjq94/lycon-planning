'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Simulation } from '@/types'
import type { SimulationResult } from '@/lib/services/simulationTypes'
import { DEFAULT_SIMULATION_ASSUMPTIONS, normalizePriorities } from '@/types'
import { runSimulationV2 } from '@/lib/services/simulationEngineV2'
import { getSnapshots } from '@/lib/services/snapshotService'
import { getIncomes } from '@/lib/services/incomeService'
import { getExpenses } from '@/lib/services/expenseService'
import { getSavings } from '@/lib/services/savingsService'
import { getDebts } from '@/lib/services/debtService'
import { getNationalPensions } from '@/lib/services/nationalPensionService'
import { getRetirementPensions } from '@/lib/services/retirementPensionService'
import { getPersonalPensions } from '@/lib/services/personalPensionService'
import { getRealEstates } from '@/lib/services/realEstateService'
import { getPhysicalAssets } from '@/lib/services/physicalAssetService'
import { wonToManwon } from '@/lib/utils'
import { calculateEndYear } from '@/lib/utils/chartDataTransformer'
import { generateVirtualExpenses } from '@/lib/utils/virtualExpenses'
import { AssetStackChart } from '../charts'
import { formatMoney } from '@/lib/utils'
import { useChartTheme } from '@/hooks/useChartTheme'
import { groupAssetItems, groupDebtItems } from '@/lib/utils/tooltipCategories'
import styles from './NetWorthTab.module.css'

interface NetWorthTabProps {
  simulationId: string
  simulationResult: SimulationResult
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  spouseRetirementAge?: number
  isInitializing?: boolean
  timeRange?: 'next3m' | 'next5m' | 'next5' | 'next10' | 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full'
  onTimeRangeChange?: (range: 'next3m' | 'next5m' | 'next5' | 'next10' | 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full') => void
  selectedYear?: number
  onSelectedYearChange?: (year: number) => void
  selfLifeExpectancy?: number
  spouseLifeExpectancy?: number
  simulationStartYear?: number | null
  lifecycleMilestones?: { year: number; color: string; label: string; iconId: string }[]
  compareSelections?: Set<string>
  allSimulations?: Simulation[]
  profileId?: string
  onToggleCompare?: (key: string) => void
}

// 기간 선택 옵션
type TimeRange = 'next3m' | 'next5m' | 'next5' | 'next10' | 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full'

const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: 'next3m', label: '향후 3년 [월]' },
  { id: 'next5m', label: '향후 5년 [월]' },
  { id: 'next5', label: '향후 5년' },
  { id: 'next10', label: '향후 10년' },
  { id: 'next20', label: '향후 20년' },
  { id: 'next30', label: '향후 30년' },
  { id: 'next40', label: '향후 40년' },
  { id: 'accumulation', label: '축적 기간' },
  { id: 'drawdown', label: '인출 기간' },
  { id: 'full', label: '전체 기간' },
]

const OVERLAY_COLORS = ['#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export function NetWorthTab({
  simulationId,
  simulationResult,
  birthYear,
  spouseBirthYear,
  retirementAge,
  spouseRetirementAge = 60,
  isInitializing = false,
  timeRange: propTimeRange,
  onTimeRangeChange,
  selectedYear: propSelectedYear,
  onSelectedYearChange,
  selfLifeExpectancy = 100,
  spouseLifeExpectancy = 100,
  simulationStartYear,
  lifecycleMilestones,
  compareSelections,
  allSimulations,
  profileId,
  onToggleCompare,
}: NetWorthTabProps) {
  const currentYear = simulationStartYear || new Date().getFullYear()
  const currentAge = currentYear - birthYear
  const { isDark, chartLineColors, assetCategoryColors, debtCategoryColors } = useChartTheme()

  // 메인 액센트 색 (실제 자산 추이에 사용)
  const accentColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#007aff'
    : '#007aff'

  // Overlay comparison: 항목 ID 기반 고정 색상 맵
  const stableColorMap = useMemo(() => {
    const map = new Map<string, string>()
    map.set('asset-trend', accentColor)
    const otherSims = (allSimulations || []).filter(s => s.id !== simulationId)
    otherSims.forEach((sim, i) => {
      map.set(sim.id, OVERLAY_COLORS[i % OVERLAY_COLORS.length])
    })
    return map
  }, [allSimulations, simulationId, accentColor])

  // Build compare items array for legend
  const compareItems = useMemo(() => {
    const items: { key: string; label: string; color: string; selected: boolean }[] = []
    // Asset trend
    items.push({
      key: 'asset-trend',
      label: '실제 자산 추이',
      color: stableColorMap.get('asset-trend') || OVERLAY_COLORS[0],
      selected: compareSelections?.has('asset-trend') || false,
    })
    // Other simulations
    const otherSims = (allSimulations || []).filter(s => s.id !== simulationId)
    otherSims.forEach(sim => {
      items.push({
        key: sim.id,
        label: sim.title || '시뮬레이션',
        color: stableColorMap.get(sim.id) || OVERLAY_COLORS[0],
        selected: compareSelections?.has(sim.id) || false,
      })
    })
    return items
  }, [allSimulations, simulationId, compareSelections, stableColorMap])

  // Overlay comparison: cache + loading
  interface OverlayCacheEntry {
    label: string
    yearMap: Map<number, number>    // year → netWorth (만원)
    monthMap: Map<string, number>   // "YYYY-MM" → netWorth (만원)
  }
  const overlayCache = useRef<Map<string, OverlayCacheEntry>>(new Map())
  const overlayRequestRef = useRef(0)
  const [overlayCacheVer, setOverlayCacheVer] = useState(0)
  const [overlayLoading, setOverlayLoading] = useState(false)

  // 시뮬레이션 설정
  const simulationEndYear = calculateEndYear(birthYear, spouseBirthYear, selfLifeExpectancy, spouseLifeExpectancy)
  const yearsToSimulate = simulationEndYear - currentYear
  const retirementYear = birthYear + retirementAge
  const spouseRetirementYear = spouseBirthYear ? spouseBirthYear + spouseRetirementAge : undefined

  // State
  const [localSelectedYear, setLocalSelectedYear] = useState<number>(currentYear)
  const rawSelectedYear = propSelectedYear ?? localSelectedYear
  const setSelectedYear = onSelectedYearChange ?? setLocalSelectedYear

  const [localTimeRange, setLocalTimeRange] = useState<TimeRange>('full')
  const timeRange = propTimeRange ?? localTimeRange
  const setTimeRange = onTimeRangeChange ?? setLocalTimeRange

  const [showTimeRangeMenu, setShowTimeRangeMenu] = useState(false)
  const timeRangeRef = useRef<HTMLDivElement>(null)

  // 메뉴 바깥 클릭 또는 ESC 시 닫기
  useEffect(() => {
    if (!showTimeRangeMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (timeRangeRef.current && !timeRangeRef.current.contains(e.target as Node)) {
        setShowTimeRangeMenu(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTimeRangeMenu(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [showTimeRangeMenu])

  // 기간에 따른 표시 범위 계산
  const displayRange = useMemo(() => {
    switch (timeRange) {
      case 'next3m':
        return { start: currentYear, end: Math.min(currentYear + 3, simulationEndYear) }
      case 'next5m':
      case 'next5':
        return { start: currentYear, end: Math.min(currentYear + 5, simulationEndYear) }
      case 'next10':
        return { start: currentYear, end: Math.min(currentYear + 10, simulationEndYear) }
      case 'next20':
        return { start: currentYear, end: Math.min(currentYear + 20, simulationEndYear) }
      case 'next30':
        return { start: currentYear, end: Math.min(currentYear + 30, simulationEndYear) }
      case 'next40':
        return { start: currentYear, end: Math.min(currentYear + 40, simulationEndYear) }
      case 'accumulation':
        return { start: currentYear, end: retirementYear }
      case 'drawdown':
        return { start: retirementYear, end: simulationEndYear }
      case 'full':
      default:
        return { start: currentYear, end: simulationEndYear }
    }
  }, [timeRange, currentYear, simulationEndYear, retirementYear])

  // 필터링된 시뮬레이션 결과 (기간 선택에 따라)
  const filteredSimulationResult = useMemo(() => ({
    ...simulationResult,
    snapshots: simulationResult.snapshots.filter(
      s => s.year >= displayRange.start && s.year <= displayRange.end
    ),
  }), [simulationResult, displayRange.start, displayRange.end])

  // 월별 스냅샷 (next3m/next5m일 때만 사용)
  const filteredMonthlySnapshots = useMemo(() => {
    if (timeRange !== 'next3m' && timeRange !== 'next5m') return undefined
    const ms = simulationResult.monthlySnapshots
    if (!ms || ms.length === 0) return undefined
    return ms.filter(
      s => s.year >= displayRange.start && (s.year < displayRange.end || (s.year === displayRange.end && s.month <= 12))
    )
  }, [timeRange, simulationResult.monthlySnapshots, displayRange.start, displayRange.end])

  const isMonthlyMode = !!filteredMonthlySnapshots && filteredMonthlySnapshots.length > 0

  // Fetch overlay data into cache (runs only when new items need fetching)
  useEffect(() => {
    if (!compareSelections || compareSelections.size === 0) return

    const toFetch = Array.from(compareSelections).filter(key => !overlayCache.current.has(key))
    if (toFetch.length === 0) return

    const requestId = ++overlayRequestRef.current
    setOverlayLoading(true)

    ;(async () => {
      for (const key of toFetch) {
        if (requestId !== overlayRequestRef.current) return

        if (key === 'asset-trend' && profileId) {
          try {
            const snapshots = await getSnapshots(profileId)
            const yearMap = new Map<number, number>()
            const monthMap = new Map<string, number>()
            for (const snap of snapshots) {
              const year = parseInt(snap.recorded_at.slice(0, 4))
              const monthKey = snap.recorded_at.slice(0, 7)
              if (!yearMap.has(year)) yearMap.set(year, wonToManwon(snap.net_worth))
              if (!monthMap.has(monthKey)) monthMap.set(monthKey, wonToManwon(snap.net_worth))
            }
            overlayCache.current.set('asset-trend', {
              label: '실제 자산 추이',
              yearMap,
              monthMap,
            })
          } catch (err) {
            console.error('Failed to fetch asset trend snapshots:', err)
          }
        } else if (key !== 'asset-trend') {
          try {
            const [incomes, expenses, savings, debts, nationalPensions, retirementPensions, personalPensions, realEstates, physicalAssets] = await Promise.all([
              getIncomes(key), getExpenses(key), getSavings(key), getDebts(key),
              getNationalPensions(key), getRetirementPensions(key), getPersonalPensions(key),
              getRealEstates(key), getPhysicalAssets(key),
            ])
            const targetSim = allSimulations?.find(s => s.id === key)
            if (!targetSim) continue

            // 가상 교육비/의료비 augmentation (비교 시뮬레이션)
            const targetLifeCycle = targetSim.life_cycle_settings as { selfLifeExpectancy?: number; spouseLifeExpectancy?: number; autoExpenses?: { medical?: boolean; education?: { enabled: boolean; tier: 'normal' | 'premium' } } } | null
            const targetAutoExp = targetLifeCycle?.autoExpenses
            const targetIncludeMedical = targetAutoExp?.medical === true
            const targetIncludeEducation = targetAutoExp?.education?.enabled === true
            let augmentedExpenses = expenses
            if (targetIncludeMedical || targetIncludeEducation) {
              augmentedExpenses = expenses.filter(e => {
                if (targetIncludeMedical && e.type === 'medical') return false
                if (targetIncludeEducation && e.type === 'education') return false
                return true
              })
              const targetChildren = (targetSim.family_config || [])
                .filter(fm => fm.relationship === 'child' && fm.birth_date)
                .map(fm => ({ name: fm.name, birthYear: parseInt(fm.birth_date!.split('-')[0]) }))
              const virtualExpenses = generateVirtualExpenses({
                selfBirthYear: birthYear,
                spouseBirthYear: spouseBirthYear,
                children: targetChildren,
                selfLifeExpectancy: targetLifeCycle?.selfLifeExpectancy ?? selfLifeExpectancy,
                spouseLifeExpectancy: targetLifeCycle?.spouseLifeExpectancy ?? spouseLifeExpectancy,
                simulationId: key,
                includeMedical: targetIncludeMedical,
                includeEducation: targetIncludeEducation,
                educationTier: targetAutoExp?.education?.tier,
              })
              augmentedExpenses = [...augmentedExpenses, ...virtualExpenses]
            }

            const compResult = runSimulationV2(
              { incomes, expenses: augmentedExpenses, savings, debts, nationalPensions, retirementPensions, personalPensions, realEstates, physicalAssets },
              { birthYear, retirementAge, spouseBirthYear: spouseBirthYear || undefined },
              yearsToSimulate,
              targetSim.simulation_assumptions || DEFAULT_SIMULATION_ASSUMPTIONS,
              targetSim.cash_flow_priorities ? normalizePriorities(targetSim.cash_flow_priorities) : undefined,
              targetSim.start_year ?? undefined,
              targetSim.start_month ?? undefined,
            )
            const yearMap = new Map<number, number>()
            compResult.snapshots.forEach(s => yearMap.set(s.year, s.netWorth))
            const monthMap = new Map<string, number>()
            compResult.monthlySnapshots?.forEach(ms => {
              monthMap.set(`${ms.year}-${String(ms.month).padStart(2, '0')}`, ms.netWorth)
            })
            overlayCache.current.set(key, {
              label: targetSim.title || `시뮬레이션 ${key.slice(0, 8)}`,
              yearMap,
              monthMap,
            })
          } catch (err) {
            console.error(`Failed to load comparison simulation ${key}:`, err)
          }
        }
      }
      if (requestId === overlayRequestRef.current) {
        setOverlayLoading(false)
        setOverlayCacheVer(v => v + 1)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareSelections, profileId, simulationId, birthYear, retirementAge, spouseBirthYear, yearsToSimulate])

  // Build overlay lines from cache (instant, runs on mode/range/cache changes)
  const overlayLines = useMemo(() => {
    if (!compareSelections || compareSelections.size === 0) return []

    const lines: { label: string; color: string; data: (number | null)[] }[] = []
    for (const key of compareSelections) {
      if (key === simulationId) continue // 현재 시뮬레이션은 비교 제외
      const cached = overlayCache.current.get(key)
      if (!cached) continue

      let data: (number | null)[]
      if (isMonthlyMode && filteredMonthlySnapshots) {
        data = filteredMonthlySnapshots.map(ms => {
          const monthKey = `${ms.year}-${String(ms.month).padStart(2, '0')}`
          return cached.monthMap.get(monthKey) ?? null
        })
      } else {
        data = []
        for (let y = displayRange.start; y <= displayRange.end; y++) {
          data.push(cached.yearMap.get(y) ?? null)
        }
      }

      lines.push({ label: cached.label, color: stableColorMap.get(key) || OVERLAY_COLORS[0], data })
    }
    return lines
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareSelections, overlayCacheVer, isMonthlyMode, filteredMonthlySnapshots, displayRange.start, displayRange.end, simulationId, stableColorMap])

  const selectedYear = rawSelectedYear

  // 선택된 연도의 스냅샷
  const selectedSnapshot = useMemo(() => {
    return simulationResult.snapshots.find(s => s.year === Math.floor(selectedYear)) || simulationResult.snapshots[0]
  }, [simulationResult.snapshots, selectedYear])

  // 월별 모드에서 선택된 월의 스냅샷
  const selectedMonthlySnapshot = useMemo(() => {
    if (!isMonthlyMode || !filteredMonthlySnapshots) return null
    const selectedMonth = Math.round((selectedYear % 1) * 100) || 1
    const targetYear = Math.floor(selectedYear)
    return filteredMonthlySnapshots.find(s => s.year === targetYear && s.month === selectedMonth) || filteredMonthlySnapshots[0]
  }, [isMonthlyMode, filteredMonthlySnapshots, selectedYear])

  // 이전 연도 스냅샷 (변화 계산용)
  const prevSnapshot = useMemo(() => {
    const yr = Math.floor(selectedYear)
    const idx = simulationResult.snapshots.findIndex(s => s.year === yr)
    return idx > 0 ? simulationResult.snapshots[idx - 1] : null
  }, [simulationResult.snapshots, selectedYear])

  // 연도 변경 핸들러
  const handleYearChange = useCallback((year: number) => {
    setSelectedYear(year)
  }, [])

  // 슬라이더 변경 핸들러
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedYear(parseInt(e.target.value))
  }, [])

  // 키보드 좌우 화살표로 연도/월 이동
  const selectedYearRef = useRef(selectedYear)
  selectedYearRef.current = selectedYear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const delta = e.key === 'ArrowLeft' ? -1 : 1

      if (isMonthlyMode && filteredMonthlySnapshots && filteredMonthlySnapshots.length > 0) {
        const currentVal = selectedYearRef.current
        const currentIdx = filteredMonthlySnapshots.findIndex(s =>
          s.year === Math.floor(currentVal) && s.month === (Math.round((currentVal % 1) * 100) || 1)
        )
        const nextIdx = Math.max(0, Math.min(filteredMonthlySnapshots.length - 1, (currentIdx === -1 ? 0 : currentIdx) + delta))
        const ms = filteredMonthlySnapshots[nextIdx]
        if (ms) setSelectedYear(ms.year + ms.month / 100)
      } else {
        const current = Math.floor(selectedYearRef.current)
        const next = Math.max(displayRange.start, Math.min(displayRange.end, current + delta))
        setSelectedYear(next)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [displayRange.start, displayRange.end, setSelectedYear, isMonthlyMode, filteredMonthlySnapshots])

  // 자산/부채 카테고리 그룹 계산 (hooks는 early return 전에 위치해야 함)
  const assetGroups = useMemo(() => {
    if (!selectedSnapshot) return []
    const allAssetItems = [
      ...(selectedSnapshot.assetBreakdown || []),
      ...(selectedSnapshot.pensionBreakdown || [])
    ]
    return groupAssetItems(allAssetItems)
  }, [selectedSnapshot])

  const debtGroups = useMemo(() => {
    if (!selectedSnapshot) return []
    return groupDebtItems(selectedSnapshot.debtBreakdown || [])
  }, [selectedSnapshot])

  if (isInitializing) {
    return <div className={styles.loadingState}>데이터를 불러오는 중...</div>
  }

  const selectedAge = Math.floor(selectedYear) - birthYear
  const spouseAge = spouseBirthYear ? Math.floor(selectedYear) - spouseBirthYear : null
  const showSelfAge = selectedAge <= selfLifeExpectancy
  const showSpouseAge = spouseAge !== null && spouseAge <= spouseLifeExpectancy

  // 변화량 계산
  const netWorthChange = prevSnapshot ? selectedSnapshot.netWorth - prevSnapshot.netWorth : 0
  const netWorthChangePercent = prevSnapshot && prevSnapshot.netWorth !== 0
    ? ((selectedSnapshot.netWorth - prevSnapshot.netWorth) / Math.abs(prevSnapshot.netWorth)) * 100
    : 0

  return (
    <div className={styles.container}>
      {/* 메인 차트 영역 */}
      <div className={styles.chartSection}>
        {/* 파산 경고 */}
        {simulationResult.summary.bankruptcyYear && (
          <div className={styles.bankruptcyWarning}>
            <span className={styles.warningIcon}>!</span>
            <span>
              {simulationResult.summary.bankruptcyYear}년 ({simulationResult.summary.bankruptcyYear - birthYear}세)에
              금융자산이 고갈됩니다. 지출을 줄이거나 소득을 늘려야 합니다.
            </span>
          </div>
        )}

        {/* 차트 + 상세 패널 */}
        <div className={styles.chartContent}>
          <div className={styles.chartArea}>
            <AssetStackChart
              key={simulationId}
              simulationResult={filteredSimulationResult}
              endYear={displayRange.end}
              retirementYear={retirementYear}
              spouseRetirementYear={spouseRetirementYear}
              birthYear={birthYear}
              spouseBirthYear={spouseBirthYear}
              onYearClick={handleYearChange}
              selectedYear={selectedYear}
              monthlySnapshots={filteredMonthlySnapshots}
              selfLifeExpectancy={selfLifeExpectancy}
              spouseLifeExpectancy={spouseLifeExpectancy}
              lifecycleMilestones={lifecycleMilestones}
              overlayLines={overlayLines}
              compareItems={compareItems}
              onToggleCompare={onToggleCompare}
              headerAction={
                <div ref={timeRangeRef} className={styles.timeRangeSelector}>
                  <button
                    className={styles.timeRangeButton}
                    onClick={() => setShowTimeRangeMenu(!showTimeRangeMenu)}
                  >
                    {TIME_RANGES.find(r => r.id === timeRange)?.label}
                    <ChevronDown size={14} />
                  </button>

                  {showTimeRangeMenu && (
                    <div className={styles.timeRangeMenu} style={{
                      background: isDark ? 'rgba(34, 37, 41, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                    }}>
                      {TIME_RANGES.map(range => (
                        <button
                          key={range.id}
                          className={`${styles.timeRangeOption} ${timeRange === range.id ? styles.active : ''}`}
                          onClick={() => {
                            setTimeRange(range.id)
                            setShowTimeRangeMenu(false)
                            // 모드 전환 시 항상 새 범위의 시작점으로 리셋
                            if (range.id === 'next3m' || range.id === 'next5m') {
                              setSelectedYear(currentYear + 1 / 100)
                            } else {
                              const newStart = (() => {
                                switch (range.id) {
                                  case 'drawdown': return retirementYear
                                  default: return currentYear
                                }
                              })()
                              setSelectedYear(newStart)
                            }
                          }}
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              }
            />
          </div>

          {/* 연도 상세 패널 (항상 표시) */}
          <div className={styles.detailPanel}>
            {/* 연도 슬라이더 */}
            <div className={styles.sliderSection}>
              <div className={styles.sliderHeader}>
                {isMonthlyMode && selectedMonthlySnapshot ? (
                  <>
                    <span className={styles.sliderYear}>{selectedMonthlySnapshot.year}년 {selectedMonthlySnapshot.month}월</span>
                    {showSelfAge && <span className={styles.sliderAge}>본인 {selectedMonthlySnapshot.age}세</span>}
                    {showSpouseAge && <span className={styles.sliderAge}>배우자 {spouseAge}세</span>}
                  </>
                ) : (
                  <>
                    <span className={styles.sliderYear}>{Math.floor(selectedYear)}년</span>
                    {showSelfAge && <span className={styles.sliderAge}>본인 {selectedAge}세</span>}
                    {showSpouseAge && <span className={styles.sliderAge}>배우자 {spouseAge}세</span>}
                  </>
                )}
              </div>
              {isMonthlyMode && filteredMonthlySnapshots ? (
                <input
                  type="range"
                  min={0}
                  max={filteredMonthlySnapshots.length - 1}
                  value={filteredMonthlySnapshots.findIndex(s =>
                    s.year === Math.floor(selectedYear) && s.month === (Math.round((selectedYear % 1) * 100) || 1)
                  )}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value)
                    const ms = filteredMonthlySnapshots[idx]
                    if (ms) setSelectedYear(ms.year + ms.month / 100)
                  }}
                  className={styles.yearSlider}
                />
              ) : (
                <input
                  type="range"
                  min={displayRange.start}
                  max={displayRange.end}
                  value={Math.floor(selectedYear)}
                  onChange={handleSliderChange}
                  className={styles.yearSlider}
                />
              )}
              <div className={styles.sliderLabels}>
                {isMonthlyMode && filteredMonthlySnapshots ? (
                  <>
                    <span>{filteredMonthlySnapshots[0]?.year}.{String(filteredMonthlySnapshots[0]?.month).padStart(2, '0')}</span>
                    <span>{filteredMonthlySnapshots[filteredMonthlySnapshots.length - 1]?.year}.{String(filteredMonthlySnapshots[filteredMonthlySnapshots.length - 1]?.month).padStart(2, '0')}</span>
                  </>
                ) : (
                  <>
                    <span>{displayRange.start}</span>
                    <span>{displayRange.end}</span>
                  </>
                )}
              </div>
            </div>

            {/* 상세 정보 */}
            <div className={styles.detailContent}>
              {/* 순자산 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>순자산</span>
                <span
                  className={styles.detailValue}
                  style={{ color: ((isMonthlyMode ? selectedMonthlySnapshot?.netWorth : selectedSnapshot?.netWorth) || 0) >= 0 ? chartLineColors.price : chartLineColors.expense }}
                >
                  {formatMoney((isMonthlyMode ? selectedMonthlySnapshot?.netWorth : selectedSnapshot?.netWorth) || 0)}
                </span>
              </div>

              {/* 순자산 변화 - 연간 모드에서만 표시 */}
              {!isMonthlyMode && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>순자산 변화</span>
                  <span className={styles.detailValue}>
                    {netWorthChange >= 0 ? '+' : ''}{formatMoney(netWorthChange)}
                  </span>
                </div>
              )}

              <div className={styles.divider} />

              {!isMonthlyMode && (
                <>
                  {/* 자산 총합 */}
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionHeaderLabel}>자산</span>
                    <span className={styles.sectionHeaderValue} style={{ color: '#10b981' }}>
                      {formatMoney(assetGroups.reduce((sum, g) => sum + g.total, 0))}
                    </span>
                  </div>
                  {/* 자산 카테고리별 */}
                  {assetGroups.map(group => (
                    <div key={group.category.id}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>
                          <span className={styles.categoryDot} style={{ background: assetCategoryColors[group.category.id] || group.category.color }} />
                          {group.category.label}
                        </span>
                        <span className={styles.detailValue}>{formatMoney(group.total)}</span>
                      </div>
                      {group.items.map((item, idx) => (
                        <div key={idx} className={styles.subItemRow}>
                          <span className={styles.subItemLabel}>{item.title}</span>
                          <span className={styles.subItemValue}>{formatMoney(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* 부채 카테고리별 */}
                  {debtGroups.length > 0 && (
                    <>
                      <div className={styles.divider} />
                      <div className={styles.sectionHeader}>
                        <span className={styles.sectionHeaderLabel}>부채</span>
                        <span className={styles.sectionHeaderValue} style={{ color: '#ef4444' }}>
                          -{formatMoney(debtGroups.reduce((sum, g) => sum + g.total, 0))}
                        </span>
                      </div>
                      {debtGroups.map(group => (
                        <div key={group.category.id}>
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>
                              <span className={styles.categoryDot} style={{ background: debtCategoryColors[group.category.id] || group.category.color }} />
                              {group.category.label}
                            </span>
                            <span className={`${styles.detailValue} ${styles.negative}`}>-{formatMoney(group.total)}</span>
                          </div>
                          {group.items.map((item, idx) => (
                            <div key={idx} className={styles.subItemRow}>
                              <span className={styles.subItemLabel}>{item.title}</span>
                              <span className={`${styles.subItemValue} ${styles.negative}`}>-{formatMoney(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              {/* 월별 모드: 개별 자산/부채 항목 */}
              {isMonthlyMode && selectedMonthlySnapshot && (
                <>
                  {(() => {
                    const monthlyAssetItems = [
                      ...(selectedMonthlySnapshot.assetBreakdown || []),
                      ...(selectedMonthlySnapshot.pensionBreakdown || [])
                    ]
                    const monthlyAssetGroups = groupAssetItems(monthlyAssetItems)
                    const monthlyDebtGroups = groupDebtItems(selectedMonthlySnapshot.debtBreakdown || [])

                    return (
                      <>
                        {/* 자산 총합 */}
                        <div className={styles.sectionHeader}>
                          <span className={styles.sectionHeaderLabel}>자산</span>
                          <span className={styles.sectionHeaderValue} style={{ color: '#10b981' }}>
                            {formatMoney(monthlyAssetGroups.reduce((sum, g) => sum + g.total, 0))}
                          </span>
                        </div>
                        {monthlyAssetGroups.map(group => (
                          <div key={group.category.id}>
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>
                                <span className={styles.categoryDot} style={{ background: assetCategoryColors[group.category.id] || group.category.color }} />
                                {group.category.label}
                              </span>
                              <span className={styles.detailValue}>{formatMoney(group.total)}</span>
                            </div>
                            {group.items.map((item, idx) => (
                              <div key={idx} className={styles.subItemRow}>
                                <span className={styles.subItemLabel}>{item.title}</span>
                                <span className={styles.subItemValue}>{formatMoney(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        ))}

                        {monthlyDebtGroups.length > 0 && (
                          <>
                            <div className={styles.divider} />
                            <div className={styles.sectionHeader}>
                              <span className={styles.sectionHeaderLabel}>부채</span>
                              <span className={styles.sectionHeaderValue} style={{ color: '#ef4444' }}>
                                -{formatMoney(monthlyDebtGroups.reduce((sum, g) => sum + g.total, 0))}
                              </span>
                            </div>
                            {monthlyDebtGroups.map(group => (
                              <div key={group.category.id}>
                                <div className={styles.detailRow}>
                                  <span className={styles.detailLabel}>
                                    <span className={styles.categoryDot} style={{ background: debtCategoryColors[group.category.id] || group.category.color }} />
                                    {group.category.label}
                                  </span>
                                  <span className={`${styles.detailValue} ${styles.negative}`}>-{formatMoney(group.total)}</span>
                                </div>
                                {group.items.map((item, idx) => (
                                  <div key={idx} className={styles.subItemRow}>
                                    <span className={styles.subItemLabel}>{item.title}</span>
                                    <span className={`${styles.subItemValue} ${styles.negative}`}>-{formatMoney(item.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
