'use client'

import { useState, useMemo } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { OnboardingData, SimulationSettings, GlobalSettings } from '@/types'
import { runSimulation } from '@/lib/services/simulationEngine'
import { calculateEndYear } from '@/lib/utils/chartDataTransformer'
import { CashFlowChart, YearCashFlowPanel, SankeyChart } from '../charts'
import styles from './CashFlowOverviewTab.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface CashFlowOverviewTabProps {
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

export function CashFlowOverviewTab({ data, settings, globalSettings }: CashFlowOverviewTabProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const currentYear = new Date().getFullYear()
  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60

  // 시뮬레이션 설정
  const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : currentYear - 35
  const spouseBirthYear = data.spouse?.birth_date ? parseInt(data.spouse.birth_date.split('-')[0]) : null
  const simulationEndYear = calculateEndYear(birthYear, spouseBirthYear)
  const yearsToSimulate = simulationEndYear - currentYear
  const retirementYear = birthYear + retirementAge

  // 시뮬레이션 실행
  const simulationResult = useMemo(() => {
    return runSimulation(data, settings, yearsToSimulate, globalSettings)
  }, [data, settings, yearsToSimulate, globalSettings])

  // 현재 연도 스냅샷
  const currentSnapshot = simulationResult.snapshots.find(s => s.year === currentYear) || simulationResult.snapshots[0]

  // 선택된 연도 스냅샷
  const selectedSnapshot = selectedYear
    ? simulationResult.snapshots.find(s => s.year === selectedYear)
    : null

  // 현재 월간 현금흐름 계산
  const monthlyIncome = currentSnapshot ? Math.round(currentSnapshot.totalIncome / 12) : 0
  const monthlyExpense = currentSnapshot ? Math.round(currentSnapshot.totalExpense / 12) : 0
  const monthlySavings = monthlyIncome - monthlyExpense
  const savingsRate = monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 100) : 0

  // 국민연금 시작 나이
  const nationalPensionStartAge = data.nationalPensionStartAge || 65
  const nationalPensionStartYear = birthYear + nationalPensionStartAge

  // 은퇴 후 현금흐름 계산 (은퇴 직후 첫 해)
  const retirementSnapshot = simulationResult.snapshots.find(s => s.year === retirementYear)
  const postRetirementIncome = retirementSnapshot ? retirementSnapshot.totalIncome : 0
  const postRetirementExpense = retirementSnapshot ? retirementSnapshot.totalExpense : 0
  const cashFlowGap = postRetirementIncome - postRetirementExpense
  const hasGap = cashFlowGap < 0

  // 연금 구성 (국민연금 수령 시작 연도 기준)
  const pensionSnapshot = simulationResult.snapshots.find(s => s.year === nationalPensionStartYear)
  const nationalPension = data.nationalPension || 0
  const retirementPensionMonthly = Math.round((data.retirementPensionBalance || 0) / 20 / 12)
  const personalPensionMonthly = Math.round(((data.irpBalance || 0) + (data.pensionSavingsBalance || 0)) / 20 / 12)
  const totalPensionMonthly = nationalPension + retirementPensionMonthly + personalPensionMonthly

  // 소득 구성 차트 (현재)
  const incomeItems: { name: string; value: number; color: string }[] = []
  if (data.laborIncome) incomeItems.push({ name: '본인 근로', value: data.laborIncome, color: '#3b82f6' })
  if (data.spouseLaborIncome) incomeItems.push({ name: '배우자 근로', value: data.spouseLaborIncome, color: '#8b5cf6' })
  if (data.businessIncome) incomeItems.push({ name: '본인 사업', value: data.businessIncome, color: '#22c55e' })
  if (data.spouseBusinessIncome) incomeItems.push({ name: '배우자 사업', value: data.spouseBusinessIncome, color: '#14b8a6' })

  const doughnutData = {
    labels: incomeItems.map(i => i.name),
    datasets: [{
      data: incomeItems.map(i => i.value),
      backgroundColor: incomeItems.map(i => i.color),
      borderWidth: 0,
    }],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { label: string; parsed: number }) =>
            `${context.label}: ${formatMoney(context.parsed)}`,
        },
      },
    },
    cutout: '70%',
  }

  return (
    <div className={styles.container}>
      {/* 히어로 섹션 */}
      <div className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.cashFlowBlock}>
            <p className={styles.cashFlowLabel}>월 순현금흐름</p>
            <p className={`${styles.cashFlowValue} ${monthlySavings >= 0 ? styles.positive : styles.negative}`}>
              {monthlySavings >= 0 ? '+' : ''}{formatMoney(monthlySavings)}
            </p>
            <p className={styles.cashFlowSub}>
              수입 {formatMoney(monthlyIncome)} - 지출 {formatMoney(monthlyExpense)}
            </p>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>월 수입</p>
              <p className={`${styles.statValue} ${styles.blue}`}>{formatMoney(monthlyIncome)}</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>월 지출</p>
              <p className={`${styles.statValue} ${styles.negative}`}>{formatMoney(monthlyExpense)}</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>저축률</p>
              <p className={`${styles.statValue} ${savingsRate >= 30 ? styles.positive : ''}`}>{savingsRate}%</p>
              <p className={styles.statSub}>{savingsRate >= 30 ? '우수' : savingsRate >= 15 ? '적정' : '개선 필요'}</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>은퇴까지</p>
              <p className={styles.statValue}>{Math.max(0, retirementAge - currentAge)}년</p>
              <p className={styles.statSub}>{retirementAge}세 목표</p>
            </div>
          </div>
        </div>
      </div>

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

      {/* Sankey 차트 - 현재 현금흐름도 */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>현재 현금흐름도</h3>
            <p className={styles.chartSubtitle}>돈이 어디서 오고 어디로 가는지 한눈에 확인하세요</p>
          </div>
        </div>
        <SankeyChart data={data} />
      </div>

      {/* 하단 카드 그리드 */}
      <div className={styles.bottomGrid}>
        {/* 저축률 + 소득 구성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 저축률 */}
          <div className={`${styles.card} ${styles.savingsRateCard}`}>
            <div className={styles.savingsRateHeader}>
              <span className={styles.savingsRateTitle}>저축률</span>
              <span className={styles.savingsRateValue}>목표 30%</span>
            </div>
            <div className={styles.savingsRateProgress}>
              <div className={styles.savingsRateFill} style={{ width: `${Math.min(savingsRate, 100)}%` }} />
            </div>
            <div className={styles.savingsRateStats}>
              <span className={styles.savingsRatePercent}>{savingsRate}%</span>
              <span className={styles.savingsRateHint}>
                {savingsRate >= 30 ? '목표 달성!' : `${30 - savingsRate}% 더 저축하면 목표 달성`}
              </span>
            </div>
          </div>

          {/* 소득 구성 */}
          {monthlyIncome > 0 && (
            <div className={styles.card}>
              <h4 className={styles.cardTitle}>소득 구성</h4>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <div style={{ width: 140, height: 140 }}>
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {incomeItems.map((item) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: '#64748b' }}>{item.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{formatMoney(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 은퇴 후 현금흐름 + 연금 구성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 은퇴 후 현금흐름 갭 */}
          <div className={`${styles.card} ${styles.gapCard} ${hasGap ? styles.hasGap : styles.noGap}`}>
            <div className={styles.gapHeader}>
              <span className={styles.gapTitle}>은퇴 후 현금흐름</span>
              <span className={`${styles.gapValue} ${hasGap ? styles.negative : styles.positive}`}>
                {hasGap ? '' : '+'}{formatMoney(cashFlowGap)}/년
              </span>
            </div>
            <div className={styles.gapDetails}>
              <div className={styles.gapRow}>
                <span className={styles.gapLabel}>예상 수입 (연금 등)</span>
                <span className={styles.gapAmount}>{formatMoney(postRetirementIncome)}/년</span>
              </div>
              <div className={styles.gapRow}>
                <span className={styles.gapLabel}>예상 지출</span>
                <span className={styles.gapAmount}>{formatMoney(postRetirementExpense)}/년</span>
              </div>
            </div>
            {hasGap && (
              <p className={styles.gapHint}>
                은퇴 후 매년 {formatMoney(Math.abs(cashFlowGap))} 부족 예상
              </p>
            )}
          </div>

          {/* 연금 구성 */}
          <div className={styles.card}>
            <h4 className={styles.cardTitle}>은퇴 후 연금 구성</h4>
            <div className={styles.pensionList}>
              <div className={styles.pensionItem}>
                <div className={styles.pensionHeader}>
                  <span className={styles.pensionName}>국민연금</span>
                  <span className={styles.pensionAmount}>{formatMoney(nationalPension)}/월</span>
                </div>
                <div className={styles.pensionBar}>
                  <div
                    className={`${styles.pensionFill} ${styles.national}`}
                    style={{ width: totalPensionMonthly > 0 ? `${(nationalPension / totalPensionMonthly) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <div className={styles.pensionItem}>
                <div className={styles.pensionHeader}>
                  <span className={styles.pensionName}>퇴직연금</span>
                  <span className={styles.pensionAmount}>{formatMoney(retirementPensionMonthly)}/월</span>
                </div>
                <div className={styles.pensionBar}>
                  <div
                    className={`${styles.pensionFill} ${styles.retirement}`}
                    style={{ width: totalPensionMonthly > 0 ? `${(retirementPensionMonthly / totalPensionMonthly) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <div className={styles.pensionItem}>
                <div className={styles.pensionHeader}>
                  <span className={styles.pensionName}>개인연금</span>
                  <span className={styles.pensionAmount}>{formatMoney(personalPensionMonthly)}/월</span>
                </div>
                <div className={styles.pensionBar}>
                  <div
                    className={`${styles.pensionFill} ${styles.personal}`}
                    style={{ width: totalPensionMonthly > 0 ? `${(personalPensionMonthly / totalPensionMonthly) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <div className={styles.pensionTotal}>
                <span className={styles.pensionTotalLabel}>총 연금 소득</span>
                <span className={styles.pensionTotalValue}>{formatMoney(totalPensionMonthly)}/월</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
