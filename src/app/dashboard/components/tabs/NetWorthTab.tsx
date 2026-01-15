'use client'

import { useState, useMemo } from 'react'
import type { GlobalSettings } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import { runSimulationFromItems } from '@/lib/services/simulationEngine'
import { useFinancialItems } from '@/hooks/useFinancialData'
import { calculateEndYear } from '@/lib/utils/chartDataTransformer'
import { AssetStackChart, YearDetailPanel } from '../charts'
import styles from './NetWorthTab.module.css'

interface NetWorthTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  globalSettings?: GlobalSettings
}

export function NetWorthTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  globalSettings,
}: NetWorthTabProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const currentYear = new Date().getFullYear()
  const currentAge = currentYear - birthYear

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
  const { data: items = [], isLoading } = useFinancialItems(simulationId, profile)

  // 시뮬레이션 실행
  const simulationResult = useMemo(() => {
    if (items.length === 0) {
      // 빈 시뮬레이션 결과 반환
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

  if (isLoading && items.length === 0) {
    return <div className={styles.loadingState}>데이터를 불러오는 중...</div>
  }

  return (
    <div className={styles.container}>
      {/* 자산 시뮬레이션 차트 */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>자산 시뮬레이션</h3>
            <p className={styles.chartSubtitle}>연도를 클릭하면 상세 내역을 확인할 수 있습니다</p>
          </div>
          <div className={styles.headerInfo}>
            <span className={styles.infoItem}>현재 {currentAge}세</span>
            <span className={styles.infoDivider}>|</span>
            <span className={styles.infoItem}>은퇴 {retirementAge}세 ({Math.max(0, retirementAge - currentAge)}년 후)</span>
          </div>
        </div>
        <div className={styles.chartContent}>
          <div className={styles.chartArea}>
            <AssetStackChart
              simulationResult={simulationResult}
              endYear={simulationEndYear}
              retirementYear={retirementYear}
              onYearClick={setSelectedYear}
              selectedYear={selectedYear}
            />
          </div>
          {selectedYear && (
            <div className={styles.detailPanel}>
              <YearDetailPanel
                snapshots={simulationResult.snapshots}
                year={selectedYear}
                onClose={() => setSelectedYear(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
