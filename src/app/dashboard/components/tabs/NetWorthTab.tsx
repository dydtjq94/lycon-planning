'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ChevronDown, Calendar } from 'lucide-react'
import type { GlobalSettings } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import { runSimulationFromItems } from '@/lib/services/simulationEngine'
import { useFinancialItems } from '@/hooks/useFinancialData'
import { calculateEndYear } from '@/lib/utils/chartDataTransformer'
import { AssetStackChart } from '../charts'
import { formatMoney } from '@/lib/utils'
import styles from './NetWorthTab.module.css'

interface NetWorthTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  globalSettings?: GlobalSettings
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

export function NetWorthTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  globalSettings,
}: NetWorthTabProps) {
  const currentYear = new Date().getFullYear()
  const currentAge = currentYear - birthYear

  // 시뮬레이션 설정
  const simulationEndYear = calculateEndYear(birthYear, spouseBirthYear)
  const yearsToSimulate = simulationEndYear - currentYear
  const retirementYear = birthYear + retirementAge

  // State
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [timeRange, setTimeRange] = useState<TimeRange>('full')
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

  // 프로필 정보
  const profile = useMemo(() => ({
    birthYear,
    retirementAge,
    spouseBirthYear: spouseBirthYear || undefined,
  }), [birthYear, retirementAge, spouseBirthYear])

  // React Query로 데이터 로드
  const { data: items = [], isLoading } = useFinancialItems(simulationId, profile)

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

  // 필터링된 시뮬레이션 결과 (기간 선택에 따라)
  const filteredSimulationResult = useMemo(() => ({
    ...simulationResult,
    snapshots: simulationResult.snapshots.filter(
      s => s.year >= displayRange.start && s.year <= displayRange.end
    ),
  }), [simulationResult, displayRange.start, displayRange.end])

  // 선택된 연도의 스냅샷
  const selectedSnapshot = useMemo(() => {
    return simulationResult.snapshots.find(s => s.year === selectedYear) || simulationResult.snapshots[0]
  }, [simulationResult.snapshots, selectedYear])

  // 이전 연도 스냅샷 (변화 계산용)
  const prevSnapshot = useMemo(() => {
    const idx = simulationResult.snapshots.findIndex(s => s.year === selectedYear)
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

  if (isLoading && items.length === 0) {
    return <div className={styles.loadingState}>데이터를 불러오는 중...</div>
  }

  const selectedAge = selectedYear - birthYear
  const spouseAge = spouseBirthYear ? selectedYear - spouseBirthYear : null

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

        {/* 차트 헤더 */}
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleArea}>
            <h3 className={styles.chartTitle}>순자산</h3>
          </div>

          {/* 연도 선택기 (우측 상단) */}
          <div className={styles.yearSelector}>
            <div className={styles.yearDisplay}>
              <Calendar size={16} />
              <span className={styles.yearValue}>{selectedYear}</span>
            </div>
            <div className={styles.ageDisplay}>
              <span>{selectedAge}세</span>
              {spouseAge !== null && <span className={styles.spouseAge}>배우자 {spouseAge}세</span>}
            </div>
          </div>
        </div>

        {/* 차트 + 상세 패널 */}
        <div className={styles.chartContent}>
          <div className={styles.chartArea}>
            <AssetStackChart
              simulationResult={filteredSimulationResult}
              endYear={displayRange.end}
              retirementYear={retirementYear}
              onYearClick={handleYearChange}
              selectedYear={selectedYear}
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
                            // 선택된 연도가 새 범위를 벗어나면 조정
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
                            if (selectedYear < newRange.start) setSelectedYear(newRange.start)
                            if (selectedYear > newRange.end) setSelectedYear(newRange.end)
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
              <input
                type="range"
                min={displayRange.start}
                max={displayRange.end}
                value={selectedYear}
                onChange={handleSliderChange}
                className={styles.yearSlider}
              />
              <div className={styles.sliderLabels}>
                <span>{displayRange.start}</span>
                <span>{displayRange.end}</span>
              </div>
            </div>

            {/* 상세 정보 */}
            <div className={styles.detailContent}>
              {/* 순자산 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>순자산</span>
                <span className={styles.detailValue}>{formatMoney(selectedSnapshot?.netWorth || 0)}</span>
              </div>

              {/* 순자산 변화 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>순자산 변화</span>
                <span className={`${styles.detailValue} ${netWorthChange >= 0 ? styles.positive : styles.negative}`}>
                  {netWorthChange >= 0 ? '+' : ''}{formatMoney(netWorthChange)}
                </span>
              </div>

              <div className={styles.divider} />

              {/* 소득 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel} style={{ color: '#3b82f6' }}>소득</span>
                <span className={styles.detailValue}>{formatMoney(selectedSnapshot?.totalIncome || 0)}</span>
              </div>

              {/* 지출 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel} style={{ color: '#f97316' }}>지출</span>
                <span className={styles.detailValue}>{formatMoney(selectedSnapshot?.totalExpense || 0)}</span>
              </div>

              {/* 저축률 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel} style={{ color: '#10b981' }}>저축률</span>
                <span className={styles.detailValue}>
                  {selectedSnapshot?.totalIncome
                    ? `${Math.round((selectedSnapshot.netCashFlow / selectedSnapshot.totalIncome) * 100)}%`
                    : '0%'
                  }
                </span>
              </div>

              <div className={styles.divider} />

              {/* 금융자산 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>금융자산</span>
                <span className={styles.detailValue}>{formatMoney(selectedSnapshot?.financialAssets || 0)}</span>
              </div>

              {/* 부동산 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>부동산</span>
                <span className={styles.detailValue}>{formatMoney(selectedSnapshot?.realEstateValue || 0)}</span>
              </div>

              {/* 연금 */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>연금</span>
                <span className={styles.detailValue}>{formatMoney(selectedSnapshot?.pensionAssets || 0)}</span>
              </div>

              {/* 부채 */}
              {(selectedSnapshot?.totalDebts || 0) > 0 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel} style={{ color: '#ef4444' }}>부채</span>
                  <span className={`${styles.detailValue} ${styles.negative}`}>
                    -{formatMoney(selectedSnapshot?.totalDebts || 0)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
