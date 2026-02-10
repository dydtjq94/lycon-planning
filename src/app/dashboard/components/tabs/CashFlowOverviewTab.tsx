'use client'

import { useState, useMemo } from 'react'
import type { GlobalSettings } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import { runSimulationFromItems } from '@/lib/services/simulationEngine'
import { useFinancialItems } from '@/hooks/useFinancialData'
import { calculateEndYear } from '@/lib/utils/chartDataTransformer'
import { CashFlowChart, YearCashFlowPanel, SankeyChart } from '../charts'
import styles from './CashFlowOverviewTab.module.css'

interface CashFlowOverviewTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  globalSettings?: GlobalSettings
  isInitializing?: boolean
}

export function CashFlowOverviewTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  globalSettings,
  isInitializing = false,
}: CashFlowOverviewTabProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const currentYear = new Date().getFullYear()

  // 시뮬레이션 설정
  const simulationEndYear = calculateEndYear(birthYear, spouseBirthYear)
  const yearsToSimulate = simulationEndYear - currentYear
  const retirementYear = birthYear + retirementAge

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

  // 선택된 연도 스냅샷
  const selectedSnapshot = selectedYear
    ? simulationResult.snapshots.find(s => s.year === selectedYear)
    : null

  // 현금흐름도 연도 선택 상태 (기본값: 현재 연도)
  const [sankeyYear, setSankeyYear] = useState<number>(currentYear)

  // 슬라이더 진행률 계산
  const sliderProgress = useMemo(() => {
    const totalYears = simulationEndYear - currentYear
    const currentPos = sankeyYear - currentYear
    return totalYears > 0 ? (currentPos / totalYears) * 100 : 0
  }, [sankeyYear, currentYear, simulationEndYear])

  // 현재 나이 계산
  const sankeyAge = sankeyYear - birthYear

  // 캐시된 데이터가 없고 로딩 중일 때만 로딩 표시
  if ((loading || isInitializing) && items.length === 0) {
    return <div className={styles.loadingState}>데이터를 불러오는 중...</div>
  }

  return (
    <div className={styles.container}>
      {/* 현금흐름 시뮬레이션 차트 */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>현금흐름 시뮬레이션</h3>
            <p className={styles.chartSubtitle}>연도를 클릭하면 상세 내역을 확인할 수 있습니다</p>
          </div>
        </div>
        <div className={styles.chartContent}>
          <div className={styles.chartArea}>
            <CashFlowChart
              simulationResult={simulationResult}
              endYear={simulationEndYear}
              retirementYear={retirementYear}
              onYearClick={setSelectedYear}
              selectedYear={selectedYear}
            />
          </div>
          {selectedSnapshot && (
            <div className={styles.detailPanel}>
              <YearCashFlowPanel
                snapshot={selectedSnapshot}
                onClose={() => setSelectedYear(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* 현금흐름도 */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>현금흐름도</h3>
            <p className={styles.chartSubtitle}>돈이 어디서 오고 어디로 가는지 한눈에 확인하세요</p>
          </div>
          {/* 연도 선택 슬라이더 */}
          <div className={styles.yearSliderWrapper}>
            <div className={styles.yearDisplay}>
              <span className={styles.yearValue}>{sankeyYear}년</span>
              <span className={styles.ageValue}>({sankeyAge}세)</span>
            </div>
            <div className={styles.sliderContainer}>
              <span className={styles.sliderLabel}>{currentYear}</span>
              <div className={styles.sliderTrack}>
                <div
                  className={styles.sliderProgress}
                  style={{ width: `${sliderProgress}%` }}
                />
                <input
                  type="range"
                  min={currentYear}
                  max={simulationEndYear}
                  value={sankeyYear}
                  onChange={(e) => setSankeyYear(parseInt(e.target.value))}
                  className={styles.sliderInput}
                />
              </div>
              <span className={styles.sliderLabel}>{simulationEndYear}</span>
            </div>
          </div>
        </div>
        <SankeyChart
          simulationResult={simulationResult}
          selectedYear={sankeyYear}
        />
      </div>

    </div>
  )
}
