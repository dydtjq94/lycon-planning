'use client'

import { useState, useMemo } from 'react'
import type { OnboardingData, SimulationSettings, GlobalSettings } from '@/types'
import { runSimulation } from '@/lib/services/simulationEngine'
import { calculateEndYear } from '@/lib/utils/chartDataTransformer'
import { AssetStackChart, YearDetailPanel } from '../charts'
import styles from './NetWorthTab.module.css'

interface NetWorthTabProps {
  data: OnboardingData
  settings: SimulationSettings
  globalSettings?: GlobalSettings
}

// 금액 포맷팅
function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    const uk = amount / 10000
    return `${uk.toFixed(1).replace(/\.0$/, '')}억`
  }
  return `${amount.toLocaleString()}만원`
}

// 나이 계산
function calculateAge(birthDate: string): number {
  if (!birthDate) return 35
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export function NetWorthTab({ data, settings, globalSettings }: NetWorthTabProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60

  // 시뮬레이션 설정
  const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : new Date().getFullYear() - 35
  const spouseBirthYear = data.spouse?.birth_date ? parseInt(data.spouse.birth_date.split('-')[0]) : null
  const simulationEndYear = calculateEndYear(birthYear, spouseBirthYear)
  const yearsToSimulate = simulationEndYear - new Date().getFullYear()
  const retirementYear = birthYear + retirementAge

  // 시뮬레이션 실행
  const simulationResult = useMemo(() => {
    return runSimulation(data, settings, yearsToSimulate, globalSettings)
  }, [data, settings, yearsToSimulate, globalSettings])

  // 현재 순자산 계산
  const currentSnapshot = simulationResult.snapshots[0]
  const netWorth = currentSnapshot?.netWorth || 0
  const totalAssets = currentSnapshot?.totalAssets || 0
  const totalDebts = currentSnapshot?.totalDebts || 0

  return (
    <div className={styles.container}>
      {/* 자산 시뮬레이션 차트 */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>자산 시뮬레이션</h3>
            <p className={styles.chartSubtitle}>
              현재 순자산 {formatMoney(netWorth)} (자산 {formatMoney(totalAssets)} - 부채 {formatMoney(totalDebts)})
            </p>
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
