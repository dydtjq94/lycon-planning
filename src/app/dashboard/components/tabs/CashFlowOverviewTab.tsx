'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import type { GlobalSettings } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import { runSimulationFromItems } from '@/lib/services/simulationEngine'
import { useFinancialItems } from '@/hooks/useFinancialData'
import { calculateEndYear } from '@/lib/utils/chartDataTransformer'
import { formatMoney } from '@/lib/utils'
import { CashFlowChart, SankeyChart } from '../charts'
import { useChartTheme } from '@/hooks/useChartTheme'
import styles from './CashFlowOverviewTab.module.css'

interface CashFlowOverviewTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  globalSettings?: GlobalSettings
  isInitializing?: boolean
  timeRange?: 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full'
  onTimeRangeChange?: (range: 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full') => void
  selectedYear?: number
  onSelectedYearChange?: (year: number) => void
}

function getIncomeLabel(key: string): string {
  const labels: Record<string, string> = {
    salary: '근로소득',
    business: '사업소득',
    rental: '임대소득',
    pension: '연금소득',
    nationalPension: '국민연금',
    retirementPension: '퇴직연금',
    personalPension: '개인연금',
    interest: '이자/배당',
    other: '기타소득',
    side: '부업소득',
    financial: '금융소득',
  }
  return labels[key] || key
}

function getExpenseLabel(key: string): string {
  const labels: Record<string, string> = {
    living: '생활비',
    housing: '주거비',
    insurance: '보험료',
    interest: '이자/원금상환',
    principal: '원금상환',
    education: '교육비',
    medical: '의료비',
    transportation: '교통비',
    leisure: '여가/문화',
    other: '기타지출',
    tax: '세금',
    childcare: '양육비',
    communication: '통신비',
    subscription: '구독료',
    maintenance: '관리비',
    event: '경조사',
    fixed: '고정비',
    variable: '변동비',
  }
  return labels[key] || key
}

// 기간 선택 옵션
type TimeRange = 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full'

const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: 'next20', label: '향후 20년' },
  { id: 'next30', label: '향후 30년' },
  { id: 'next40', label: '향후 40년' },
  { id: 'accumulation', label: '축적 기간' },
  { id: 'drawdown', label: '인출 기간' },
  { id: 'full', label: '전체 계획' },
]

export function CashFlowOverviewTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  globalSettings,
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

  // 프로필 정보
  const profile = useMemo(() => ({
    birthYear,
    retirementAge,
    spouseBirthYear: spouseBirthYear || undefined,
  }), [birthYear, retirementAge, spouseBirthYear])

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: items = [], isLoading: loading } = useFinancialItems(simulationId, profile)

  // 시뮬레이션 실행
  const simulationResult = useMemo(() => {
    if (items.length === 0) {
      return {
        startYear: currentYear,
        endYear: simulationEndYear,
        retirementYear,
        snapshots: [],
        summary: {
          currentNetWorth: 0,
          retirementNetWorth: 0,
          peakNetWorth: 0,
          peakNetWorthYear: currentYear,
          yearsToFI: null,
          fiTarget: 0,
          bankruptcyYear: null,
        },
      }
    }

    const gs = globalSettings || DEFAULT_GLOBAL_SETTINGS

    return runSimulationFromItems(
      items,
      {
        birthYear,
        retirementAge,
        spouseBirthYear: spouseBirthYear || undefined,
      },
      gs,
      yearsToSimulate
    )
  }, [items, birthYear, retirementAge, spouseBirthYear, globalSettings, yearsToSimulate, currentYear, simulationEndYear, retirementYear])

  // 필터링된 시뮬레이션 결과 (기간 선택에 따라)
  const filteredSimulationResult = useMemo(() => ({
    ...simulationResult,
    snapshots: simulationResult.snapshots.filter(
      s => s.year >= displayRange.start && s.year <= displayRange.end
    ),
  }), [simulationResult, displayRange.start, displayRange.end])

  // 현금흐름도 연도 선택 상태 (기본값: 현재 연도)
  const [localSelectedYear, setLocalSelectedYear] = useState<number>(currentYear)
  const sankeyYear = propSelectedYear ?? localSelectedYear
  const setSankeyYear = onSelectedYearChange ?? setLocalSelectedYear

  // 현재 나이 계산
  const sankeyAge = sankeyYear - birthYear
  const spouseAge = spouseBirthYear ? sankeyYear - spouseBirthYear : null

  // 현금흐름도 스냅샷
  const sankeySnapshot = simulationResult.snapshots.find(s => s.year === sankeyYear)

  // 캐시된 데이터가 없고 로딩 중일 때만 로딩 표시
  if ((loading || isInitializing) && items.length === 0) {
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
                            const newRange = (() => {
                              switch (range.id) {
                                case 'next20': return { start: currentYear, end: Math.min(currentYear + 20, simulationEndYear) }
                                case 'next30': return { start: currentYear, end: Math.min(currentYear + 30, simulationEndYear) }
                                case 'next40': return { start: currentYear, end: Math.min(currentYear + 40, simulationEndYear) }
                                case 'accumulation': return { start: currentYear, end: retirementYear }
                                case 'drawdown': return { start: retirementYear, end: simulationEndYear }
                                default: return { start: currentYear, end: simulationEndYear }
                              }
                            })()
                            if (sankeyYear < newRange.start) setSankeyYear(newRange.start)
                            if (sankeyYear > newRange.end) setSankeyYear(newRange.end)
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
                <span className={styles.sliderYear}>{sankeyYear}년</span>
                <span className={styles.sliderAge}>본인 {sankeyAge}세</span>
                {spouseAge !== null && <span className={styles.sliderAge}>배우자 {spouseAge}세</span>}
              </div>
              <input
                type="range"
                min={displayRange.start}
                max={displayRange.end}
                value={sankeyYear}
                onChange={(e) => setSankeyYear(parseInt(e.target.value))}
                className={styles.yearSlider}
              />
              <div className={styles.sliderLabels}>
                <span>{displayRange.start}</span>
                <span>{displayRange.end}</span>
              </div>
            </div>

            {/* 상세 정보 */}
            <div className={styles.detailContent}>
              {/* 총 유입 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>총 유입</span>
                <span className={styles.detailValue}>{formatMoney(sankeySnapshot?.totalIncome || 0)}</span>
              </div>

              {/* 총 유출 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>총 유출</span>
                <span className={styles.detailValue}>{formatMoney(sankeySnapshot?.totalExpense || 0)}</span>
              </div>

              <div className={styles.divider} />

              {/* Income breakdown */}
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

              {/* Expense breakdown */}
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

              {/* 순현금흐름 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>순현금흐름</span>
                <span
                  className={styles.detailValue}
                  style={{ color: (sankeySnapshot?.netCashFlow || 0) >= 0 ? chartLineColors.price : chartLineColors.expense }}
                >
                  {(sankeySnapshot?.netCashFlow || 0) >= 0 ? '+' : ''}{formatMoney(sankeySnapshot?.netCashFlow || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 현금흐름도 */}
      <div className={styles.chartSection}>
        <div className={styles.sankeyArea}>
          <SankeyChart
            simulationResult={simulationResult}
            selectedYear={sankeyYear}
          />
        </div>
      </div>
    </div>
  )
}
