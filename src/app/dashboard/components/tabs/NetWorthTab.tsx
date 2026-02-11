'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import type { GlobalSettings, InvestmentAssumptions, CashFlowPriorities } from '@/types'
import type { MonthlySnapshot } from '@/lib/services/simulationEngine'
import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_INVESTMENT_ASSUMPTIONS } from '@/types'
import { runSimulationV2 } from '@/lib/services/simulationEngineV2'
import { useSimulationV2Data } from '@/hooks/useFinancialData'
import { calculateEndYear } from '@/lib/utils/chartDataTransformer'
import { AssetStackChart } from '../charts'
import { formatMoney } from '@/lib/utils'
import { useChartTheme } from '@/hooks/useChartTheme'
import { groupAssetItems, groupDebtItems } from '@/lib/utils/tooltipCategories'
import styles from './NetWorthTab.module.css'

interface NetWorthTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  spouseRetirementAge?: number
  globalSettings?: GlobalSettings
  isInitializing?: boolean
  timeRange?: 'next3m' | 'next5m' | 'next5' | 'next10' | 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full'
  onTimeRangeChange?: (range: 'next3m' | 'next5m' | 'next5' | 'next10' | 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full') => void
  selectedYear?: number
  onSelectedYearChange?: (year: number) => void
  investmentAssumptions?: InvestmentAssumptions
  cashFlowPriorities?: CashFlowPriorities
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

export function NetWorthTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  spouseRetirementAge = 60,
  globalSettings,
  isInitializing = false,
  timeRange: propTimeRange,
  onTimeRangeChange,
  selectedYear: propSelectedYear,
  onSelectedYearChange,
  investmentAssumptions,
  cashFlowPriorities,
}: NetWorthTabProps) {
  const currentYear = new Date().getFullYear()
  const currentAge = currentYear - birthYear
  const { chartLineColors } = useChartTheme()

  // 시뮬레이션 설정
  const simulationEndYear = calculateEndYear(birthYear, spouseBirthYear)
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

  // 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    if (!showTimeRangeMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (timeRangeRef.current && !timeRangeRef.current.contains(e.target as Node)) {
        setShowTimeRangeMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTimeRangeMenu])

  // React Query로 데이터 로드
  const { data: v2Data, isLoading } = useSimulationV2Data(simulationId)

  // 시뮬레이션 실행
  const simulationResult = useMemo(() => {
    const gs = globalSettings || DEFAULT_GLOBAL_SETTINGS
    return runSimulationV2(
      v2Data,
      {
        birthYear,
        retirementAge,
        spouseBirthYear: spouseBirthYear || undefined,
      },
      gs,
      yearsToSimulate,
      investmentAssumptions || DEFAULT_INVESTMENT_ASSUMPTIONS,
      cashFlowPriorities
    )
  }, [v2Data, birthYear, retirementAge, spouseBirthYear, globalSettings, yearsToSimulate, investmentAssumptions, cashFlowPriorities])

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

  if (isLoading || isInitializing) {
    return <div className={styles.loadingState}>데이터를 불러오는 중...</div>
  }

  const selectedAge = Math.floor(selectedYear) - birthYear
  const spouseAge = spouseBirthYear ? Math.floor(selectedYear) - spouseBirthYear : null

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
              simulationResult={filteredSimulationResult}
              endYear={displayRange.end}
              retirementYear={retirementYear}
              spouseRetirementYear={spouseRetirementYear}
              birthYear={birthYear}
              spouseBirthYear={spouseBirthYear}
              onYearClick={handleYearChange}
              selectedYear={selectedYear}
              monthlySnapshots={filteredMonthlySnapshots}
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
                    <div className={styles.timeRangeMenu}>
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
                    <span className={styles.sliderAge}>본인 {selectedMonthlySnapshot.age}세</span>
                    {spouseAge !== null && <span className={styles.sliderAge}>배우자 {spouseAge}세</span>}
                  </>
                ) : (
                  <>
                    <span className={styles.sliderYear}>{Math.floor(selectedYear)}년</span>
                    <span className={styles.sliderAge}>본인 {selectedAge}세</span>
                    {spouseAge !== null && <span className={styles.sliderAge}>배우자 {spouseAge}세</span>}
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
                          <span className={styles.categoryDot} style={{ background: group.category.color }} />
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
                              <span className={styles.categoryDot} style={{ background: group.category.color }} />
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
                                <span className={styles.categoryDot} style={{ background: group.category.color }} />
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
                                    <span className={styles.categoryDot} style={{ background: group.category.color }} />
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
