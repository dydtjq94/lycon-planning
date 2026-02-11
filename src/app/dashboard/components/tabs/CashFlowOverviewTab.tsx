'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import type { GlobalSettings, InvestmentAssumptions, CashFlowPriorities } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_INVESTMENT_ASSUMPTIONS } from '@/types'
import { runSimulationV2 } from '@/lib/services/simulationEngineV2'
import type { MonthlySnapshot } from '@/lib/services/simulationEngine'
import { useSimulationV2Data } from '@/hooks/useFinancialData'
import { calculateEndYear } from '@/lib/utils/chartDataTransformer'
import { formatMoney } from '@/lib/utils'
import { CashFlowChart, SankeyChart } from '../charts'
import { useChartTheme } from '@/hooks/useChartTheme'
import { groupCashFlowItems } from '@/lib/utils/tooltipCategories'
import styles from './CashFlowOverviewTab.module.css'

interface CashFlowOverviewTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  globalSettings?: GlobalSettings
  investmentAssumptions?: InvestmentAssumptions
  cashFlowPriorities?: CashFlowPriorities
  isInitializing?: boolean
  timeRange?: 'next3m' | 'next5m' | 'next5' | 'next10' | 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full'
  onTimeRangeChange?: (range: 'next3m' | 'next5m' | 'next5' | 'next10' | 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full') => void
  selectedYear?: number
  onSelectedYearChange?: (year: number) => void
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

export function CashFlowOverviewTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  globalSettings,
  investmentAssumptions,
  cashFlowPriorities,
  isInitializing = false,
  timeRange: propTimeRange,
  onTimeRangeChange,
  selectedYear: propSelectedYear,
  onSelectedYearChange,
}: CashFlowOverviewTabProps) {
  const currentYear = new Date().getFullYear()
  const { chartLineColors } = useChartTheme()

  // 시뮬레이션 설정
  const simulationEndYear = calculateEndYear(birthYear, spouseBirthYear)
  const yearsToSimulate = simulationEndYear - currentYear
  const retirementYear = birthYear + retirementAge

  // 기간 선택
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

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: v2Data, isLoading: loading } = useSimulationV2Data(simulationId)

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

  // 현금흐름도 연도 선택 상태 (기본값: 현재 연도)
  const [localSelectedYear, setLocalSelectedYear] = useState<number>(currentYear)
  const sankeyYear = propSelectedYear ?? localSelectedYear
  const setSankeyYear = onSelectedYearChange ?? setLocalSelectedYear

  // 현재 나이 계산
  const sankeyAge = Math.floor(sankeyYear) - birthYear
  const spouseAge = spouseBirthYear ? Math.floor(sankeyYear) - spouseBirthYear : null

  // 현금흐름도 스냅샷
  const sankeySnapshot = simulationResult.snapshots.find(s => s.year === Math.floor(sankeyYear))

  // 월별 모드에서 선택된 월의 스냅샷
  const selectedMonthlySnapshot = useMemo(() => {
    if (!isMonthlyMode || !filteredMonthlySnapshots) return null
    const selectedMonth = Math.round((sankeyYear % 1) * 100) || 1
    const targetYear = Math.floor(sankeyYear)
    return filteredMonthlySnapshots.find(s => s.year === targetYear && s.month === selectedMonth) || filteredMonthlySnapshots[0]
  }, [isMonthlyMode, filteredMonthlySnapshots, sankeyYear])

  // 로딩 중일 때 로딩 표시
  if (loading || isInitializing) {
    return <div className={styles.loadingState}>데이터를 불러오는 중...</div>
  }

  return (
    <div className={styles.container}>
      {/* 현금흐름 시뮬레이션 차트 */}
      <div className={styles.chartSection}>
        <div className={styles.chartContent}>
          <div className={styles.chartArea}>
            <CashFlowChart
              simulationResult={filteredSimulationResult}
              endYear={displayRange.end}
              retirementYear={retirementYear}
              birthYear={birthYear}
              spouseBirthYear={spouseBirthYear}
              selectedYear={sankeyYear}
              onYearClick={(year) => {
                setSankeyYear(year)
              }}
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
                              setSankeyYear(currentYear + 1 / 100)
                            } else {
                              const newStart = (() => {
                                switch (range.id) {
                                  case 'drawdown': return retirementYear
                                  default: return currentYear
                                }
                              })()
                              setSankeyYear(newStart)
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

          {/* 연도 상세 패널 */}
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
                    <span className={styles.sliderYear}>{sankeyYear}년</span>
                    <span className={styles.sliderAge}>본인 {sankeyAge}세</span>
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
                    s.year === Math.floor(sankeyYear) && s.month === (Math.round((sankeyYear % 1) * 100) || 1)
                  )}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value)
                    const ms = filteredMonthlySnapshots[idx]
                    if (ms) setSankeyYear(ms.year + ms.month / 100)
                  }}
                  className={styles.yearSlider}
                />
              ) : (
                <input
                  type="range"
                  min={displayRange.start}
                  max={displayRange.end}
                  value={sankeyYear}
                  onChange={(e) => setSankeyYear(parseInt(e.target.value))}
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
              {isMonthlyMode && selectedMonthlySnapshot ? (
                <>
                  {/* 순현금흐름 (최상단) */}
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>순현금흐름</span>
                    <span
                      className={styles.detailValue}
                      style={{ color: selectedMonthlySnapshot.netCashFlow >= 0 ? chartLineColors.price : chartLineColors.expense }}
                    >
                      {selectedMonthlySnapshot.netCashFlow >= 0 ? '+' : ''}{formatMoney(selectedMonthlySnapshot.netCashFlow)}
                    </span>
                  </div>

                  <div className={styles.divider} />

                  {/* 총 공급 */}
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionHeaderLabel}>총 공급</span>
                    <span className={styles.sectionHeaderValue} style={{ color: '#10b981' }}>
                      {formatMoney(selectedMonthlySnapshot.monthlyIncome)}
                    </span>
                  </div>
                  {selectedMonthlySnapshot.incomeBreakdown.filter(i => i.amount > 0).map((item, idx) => (
                    <div key={`mi-${idx}`} className={styles.subItemRow}>
                      <span className={styles.subItemLabel}>{item.title}</span>
                      <span className={styles.subItemValue}>{formatMoney(item.amount)}</span>
                    </div>
                  ))}

                  <div className={styles.divider} />

                  {/* 총 수요 */}
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionHeaderLabel}>총 수요</span>
                    <span className={styles.sectionHeaderValue} style={{ color: '#ef4444' }}>
                      {formatMoney(selectedMonthlySnapshot.monthlyExpense)}
                    </span>
                  </div>
                  {selectedMonthlySnapshot.expenseBreakdown.filter(i => i.amount > 0).map((item, idx) => (
                    <div key={`me-${idx}`} className={styles.subItemRow}>
                      <span className={styles.subItemLabel}>{item.title}</span>
                      <span className={styles.subItemValue}>{formatMoney(item.amount)}</span>
                    </div>
                  ))}

                  {/* 인출 내역 */}
                  {selectedMonthlySnapshot.withdrawalBreakdown && selectedMonthlySnapshot.withdrawalBreakdown.length > 0 && (
                    <>
                      <div className={styles.divider} />
                      <div className={styles.sectionHeader}>
                        <span className={styles.sectionHeaderLabel}>부족분 인출</span>
                        <span className={styles.sectionHeaderValue} style={{ color: '#f59e0b' }}>
                          {formatMoney(selectedMonthlySnapshot.withdrawalBreakdown.reduce((s, w) => s + w.amount, 0))}
                        </span>
                      </div>
                      {selectedMonthlySnapshot.withdrawalBreakdown.map((item, idx) => (
                        <div key={`mw-${idx}`} className={styles.subItemRow}>
                          <span className={styles.subItemLabel}>{item.title}</span>
                          <span className={styles.subItemValue}>{formatMoney(item.amount)}</span>
                        </div>
                      ))}
                    </>
                  )}

                  {/* 잉여금 적립 */}
                  {selectedMonthlySnapshot.surplusBreakdown && selectedMonthlySnapshot.surplusBreakdown.length > 0 && (
                    <>
                      <div className={styles.divider} />
                      <div className={styles.sectionHeader}>
                        <span className={styles.sectionHeaderLabel}>잉여금 배분</span>
                        <span className={styles.sectionHeaderValue} style={{ color: '#10b981' }}>
                          {formatMoney(selectedMonthlySnapshot.surplusBreakdown.reduce((s, w) => s + w.amount, 0))}
                        </span>
                      </div>
                      {selectedMonthlySnapshot.surplusBreakdown.map((item, idx) => (
                        <div key={`ms-${idx}`} className={styles.subItemRow}>
                          <span className={styles.subItemLabel}>{item.title}</span>
                          <span className={styles.subItemValue}>{formatMoney(item.amount)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : sankeySnapshot?.cashFlowBreakdown && sankeySnapshot.cashFlowBreakdown.length > 0 ? (
                <>
                  {/* V2: 3-phase cash flow structure */}
                  {(() => {
                    // Regular items vs deficit/surplus
                    const regularItems = sankeySnapshot.cashFlowBreakdown.filter(
                      item => item.flowType !== 'deficit_withdrawal' && item.flowType !== 'surplus_investment'
                    )
                    const deficitItems = sankeySnapshot.cashFlowBreakdown.filter(
                      item => item.flowType === 'deficit_withdrawal'
                    )
                    const surplusItems = sankeySnapshot.cashFlowBreakdown.filter(
                      item => item.flowType === 'surplus_investment'
                    )

                    const { inflows, outflows, totalInflow, totalOutflow } = groupCashFlowItems(regularItems)
                    const netCashFlow = totalInflow - totalOutflow
                    const savingsRate = totalInflow > 0 ? (netCashFlow / totalInflow * 100) : 0
                    const totalDeficit = deficitItems.reduce((sum, i) => sum + i.amount, 0)
                    const totalSurplus = surplusItems.reduce((sum, i) => sum + Math.abs(i.amount), 0)

                    return (
                      <>
                        {/* 순현금흐름 (최상단) */}
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>순현금흐름</span>
                          <span
                            className={styles.detailValue}
                            style={{ color: netCashFlow >= 0 ? chartLineColors.price : chartLineColors.expense }}
                          >
                            {netCashFlow >= 0 ? '+' : ''}{formatMoney(netCashFlow)}
                          </span>
                        </div>

                        {/* 저축률 (양수일 때만 표시) */}
                        {savingsRate > 0 && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>저축률</span>
                            <span
                              className={styles.detailValue}
                              style={{ color: chartLineColors.price }}
                            >
                              {savingsRate.toFixed(1)}%
                            </span>
                          </div>
                        )}

                        <div className={styles.divider} />

                        {/* 총 공급 */}
                        <div className={styles.sectionHeader}>
                          <span className={styles.sectionHeaderLabel}>총 공급</span>
                          <span className={styles.sectionHeaderValue} style={{ color: '#10b981' }}>
                            {formatMoney(totalInflow)}
                          </span>
                        </div>
                        {inflows.map((group, idx) => (
                          <div key={`inflow-${idx}`}>
                            <div className={styles.detailRow}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className={styles.categoryDot} style={{ background: group.category.color }} />
                                <span className={styles.detailLabel}>{group.category.label}</span>
                              </div>
                              <span className={styles.detailValue}>{formatMoney(group.total)}</span>
                            </div>
                            {group.items.map((item, itemIdx) => (
                              <div key={`inflow-item-${idx}-${itemIdx}`} className={styles.subItemRow}>
                                <span className={styles.subItemLabel}>{item.title}</span>
                                <span className={styles.subItemValue}>{formatMoney(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        ))}

                        <div className={styles.divider} />

                        {/* 총 수요 */}
                        <div className={styles.sectionHeader}>
                          <span className={styles.sectionHeaderLabel}>총 수요</span>
                          <span className={styles.sectionHeaderValue} style={{ color: '#ef4444' }}>
                            {formatMoney(totalOutflow)}
                          </span>
                        </div>
                        {outflows.map((group, idx) => (
                          <div key={`outflow-${idx}`}>
                            <div className={styles.detailRow}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className={styles.categoryDot} style={{ background: group.category.color }} />
                                <span className={styles.detailLabel}>{group.category.label}</span>
                              </div>
                              <span className={styles.detailValue}>{formatMoney(group.total)}</span>
                            </div>
                            {group.items.map((item, itemIdx) => (
                              <div key={`outflow-item-${idx}-${itemIdx}`} className={styles.subItemRow}>
                                <span className={styles.subItemLabel}>{item.title}</span>
                                <span className={styles.subItemValue}>{formatMoney(Math.abs(item.amount))}</span>
                              </div>
                            ))}
                          </div>
                        ))}

                        {/* 부족분 인출 */}
                        {deficitItems.length > 0 && (
                          <>
                            <div className={styles.divider} />
                            <div className={styles.sectionHeader}>
                              <span className={styles.sectionHeaderLabel}>부족분 인출</span>
                              <span className={styles.sectionHeaderValue} style={{ color: '#f59e0b' }}>
                                {formatMoney(totalDeficit)}
                              </span>
                            </div>
                            {deficitItems.map((item, idx) => (
                              <div key={`deficit-${idx}`} className={styles.subItemRow}>
                                <span className={styles.subItemLabel}>{item.title}</span>
                                <span className={styles.subItemValue}>{formatMoney(item.amount)}</span>
                              </div>
                            ))}
                          </>
                        )}

                        {/* 잉여금 저축 */}
                        {surplusItems.length > 0 && (
                          <>
                            <div className={styles.divider} />
                            <div className={styles.sectionHeader}>
                              <span className={styles.sectionHeaderLabel}>잉여금 배분</span>
                              <span className={styles.sectionHeaderValue} style={{ color: '#10b981' }}>
                                {formatMoney(totalSurplus)}
                              </span>
                            </div>
                            {surplusItems.map((item, idx) => (
                              <div key={`surplus-${idx}`} className={styles.subItemRow}>
                                <span className={styles.subItemLabel}>{item.title}</span>
                                <span className={styles.subItemValue}>{formatMoney(Math.abs(item.amount))}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )
                  })()}
                </>
              ) : (
                <>
                  {/* Fallback: Old breakdown */}
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>총 공급</span>
                    <span className={styles.detailValue}>{formatMoney(sankeySnapshot?.totalIncome || 0)}</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>총 수요</span>
                    <span className={styles.detailValue}>{formatMoney(sankeySnapshot?.totalExpense || 0)}</span>
                  </div>

                  <div className={styles.divider} />

                  {sankeySnapshot?.incomeBreakdown && sankeySnapshot.incomeBreakdown.length > 0 && (
                    <>
                      {sankeySnapshot.incomeBreakdown
                        .filter(item => item.amount > 0)
                        .map((item, idx) => (
                          <div key={idx} className={styles.detailRow}>
                            <span className={styles.detailLabel}>{item.title}</span>
                            <span className={styles.detailValue}>{formatMoney(item.amount)}</span>
                          </div>
                        ))}

                      <div className={styles.divider} />
                    </>
                  )}

                  {sankeySnapshot?.expenseBreakdown && sankeySnapshot.expenseBreakdown.length > 0 && (
                    <>
                      {sankeySnapshot.expenseBreakdown
                        .filter(item => item.amount > 0)
                        .map((item, idx) => (
                          <div key={idx} className={styles.detailRow}>
                            <span className={styles.detailLabel}>{item.title}</span>
                            <span className={styles.detailValue}>{formatMoney(item.amount)}</span>
                          </div>
                        ))}

                      <div className={styles.divider} />
                    </>
                  )}

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>순현금흐름</span>
                    <span
                      className={styles.detailValue}
                      style={{ color: (sankeySnapshot?.netCashFlow || 0) >= 0 ? chartLineColors.price : chartLineColors.expense }}
                    >
                      {(sankeySnapshot?.netCashFlow || 0) >= 0 ? '+' : ''}{formatMoney(sankeySnapshot?.netCashFlow || 0)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 현금흐름도 (월별 모드에서는 미지원) */}
      {!isMonthlyMode && (
        <div className={styles.chartSection}>
          <div className={styles.sankeyArea}>
            <SankeyChart
              simulationResult={simulationResult}
              selectedYear={sankeyYear}
            />
          </div>
        </div>
      )}
    </div>
  )
}
