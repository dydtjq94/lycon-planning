'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { GlobalSettings } from '@/types'
import { formatMoney } from '@/lib/utils'
import type {
  RetirementPensionProjection,
  PersonalPensionProjection,
  TotalPensionProjection,
} from './usePensionCalculations'
import styles from '../PensionTab.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface PensionSummaryProps {
  settings: GlobalSettings
  retirementPensionProjection: RetirementPensionProjection | null
  spouseRetirementPensionProjection: RetirementPensionProjection | null
  personalPensionProjection: PersonalPensionProjection | null
  spousePersonalPensionProjection: PersonalPensionProjection | null
  totalPensionProjection: TotalPensionProjection | null
  nationalPensionData: {
    self: { monthly: number; startAge: number }
    spouse: { monthly: number; startAge: number } | null
  }
  isMarried: boolean
  currentAge: number
}

export function PensionSummary({
  settings,
  retirementPensionProjection,
  spouseRetirementPensionProjection,
  personalPensionProjection,
  spousePersonalPensionProjection,
  totalPensionProjection,
  nationalPensionData,
  isMarried,
  currentAge,
}: PensionSummaryProps) {
  // 연령대별 타임라인 계산
  const ageTimeline = useMemo(() => {
    const ages = [56, 60, 65, 75, 85]
    return ages
      .filter(age => age > currentAge)
      .map(age => {
        let monthly = 0
        const sources: string[] = []

        // 국민연금 (65세 이상)
        if (age >= nationalPensionData.self.startAge) {
          monthly += nationalPensionData.self.monthly
          if (nationalPensionData.self.monthly > 0) sources.push('국민연금')
        }
        if (nationalPensionData.spouse && age >= nationalPensionData.spouse.startAge) {
          monthly += nationalPensionData.spouse.monthly
        }

        // 퇴직연금 (수령 시작 나이 이상 && 수령 기간 내)
        if (retirementPensionProjection?.receiveType === 'annuity') {
          const startAge = retirementPensionProjection.startAge
          const endAge = startAge + retirementPensionProjection.receivingYears
          if (age >= startAge && age < endAge) {
            monthly += retirementPensionProjection.monthlyPMT
            if (retirementPensionProjection.monthlyPMT > 0) sources.push('퇴직연금')
          }
        }
        if (spouseRetirementPensionProjection?.receiveType === 'annuity') {
          const startAge = spouseRetirementPensionProjection.startAge
          const endAge = startAge + spouseRetirementPensionProjection.receivingYears
          if (age >= startAge && age < endAge) {
            monthly += spouseRetirementPensionProjection.monthlyPMT
          }
        }

        // 연금저축
        if (personalPensionProjection) {
          const psStartAge = personalPensionProjection.pensionSavings.startAge
          const psEndAge = psStartAge + personalPensionProjection.pensionSavings.receivingYears
          if (age >= psStartAge && age < psEndAge) {
            monthly += personalPensionProjection.pensionSavings.monthlyPMT
            if (personalPensionProjection.pensionSavings.monthlyPMT > 0) sources.push('연금저축')
          }
        }
        if (spousePersonalPensionProjection) {
          const spsStartAge = spousePersonalPensionProjection.pensionSavings.startAge
          const spsEndAge = spsStartAge + spousePersonalPensionProjection.pensionSavings.receivingYears
          if (age >= spsStartAge && age < spsEndAge) {
            monthly += spousePersonalPensionProjection.pensionSavings.monthlyPMT
          }
        }

        // IRP
        if (personalPensionProjection) {
          const irpStartAge = personalPensionProjection.irp.startAge
          const irpEndAge = irpStartAge + personalPensionProjection.irp.receivingYears
          if (age >= irpStartAge && age < irpEndAge) {
            monthly += personalPensionProjection.irp.monthlyPMT
            if (personalPensionProjection.irp.monthlyPMT > 0 && !sources.includes('IRP')) sources.push('IRP')
          }
        }
        if (spousePersonalPensionProjection) {
          const sipStartAge = spousePersonalPensionProjection.irp.startAge
          const sipEndAge = sipStartAge + spousePersonalPensionProjection.irp.receivingYears
          if (age >= sipStartAge && age < sipEndAge) {
            monthly += spousePersonalPensionProjection.irp.monthlyPMT
          }
        }

        return { age, monthly, sources }
      })
  }, [
    currentAge,
    nationalPensionData,
    retirementPensionProjection,
    spouseRetirementPensionProjection,
    personalPensionProjection,
    spousePersonalPensionProjection,
  ])

  // 연금 구성비 차트 데이터
  const chartData = useMemo(() => {
    const data: { label: string; value: number; color: string }[] = []

    if (totalPensionProjection) {
      const nationalTotal = totalPensionProjection.nationalPension.monthly
      if (nationalTotal > 0) {
        data.push({ label: '국민연금', value: nationalTotal, color: '#5856d6' })
      }

      const retirementMonthly = totalPensionProjection.retirement.isAnnuity
        ? totalPensionProjection.retirement.monthlyPMT
        : 0
      if (retirementMonthly > 0) {
        data.push({ label: '퇴직연금', value: retirementMonthly, color: '#007aff' })
      }

      const personalMonthly = totalPensionProjection.personal.monthlyPMT
      if (personalMonthly > 0) {
        data.push({ label: '개인연금', value: personalMonthly, color: '#34c759' })
      }
    } else {
      // fallback: nationalPensionData 사용
      if (nationalPensionData.self.monthly > 0) {
        data.push({ label: '국민연금', value: nationalPensionData.self.monthly, color: '#5856d6' })
      }
      if (nationalPensionData.spouse && nationalPensionData.spouse.monthly > 0) {
        data.push({ label: '배우자 국민연금', value: nationalPensionData.spouse.monthly, color: '#8e8ee5' })
      }
    }

    return {
      labels: data.map(d => d.label),
      datasets: [{
        data: data.map(d => d.value),
        backgroundColor: data.map(d => d.color),
        borderWidth: 0,
        hoverOffset: 4,
      }],
    }
  }, [totalPensionProjection, nationalPensionData])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: { label?: string; raw: unknown }) => {
            const value = typeof context.raw === 'number' ? context.raw : 0
            return `${context.label || ''}: ${formatMoney(value)}/월`
          },
        },
      },
    },
    cutout: '65%',
  }

  // 현재 적립 현황
  const currentBalances = useMemo(() => {
    const balances: { label: string; current: number; monthly: number; color: string }[] = []

    // 퇴직연금 (DC형만 현재 잔액 표시)
    if (retirementPensionProjection?.type === 'DC' && retirementPensionProjection.currentBalance) {
      balances.push({
        label: '퇴직연금',
        current: retirementPensionProjection.currentBalance,
        monthly: retirementPensionProjection.monthlyContribution || 0,
        color: '#007aff',
      })
    }
    if (spouseRetirementPensionProjection?.type === 'DC' && spouseRetirementPensionProjection.currentBalance) {
      balances.push({
        label: '배우자 퇴직연금',
        current: spouseRetirementPensionProjection.currentBalance,
        monthly: spouseRetirementPensionProjection.monthlyContribution || 0,
        color: '#5ac8fa',
      })
    }

    // 연금저축
    if (personalPensionProjection && (personalPensionProjection.pensionSavings.current > 0 || personalPensionProjection.pensionSavings.monthly > 0)) {
      balances.push({
        label: '연금저축',
        current: personalPensionProjection.pensionSavings.current,
        monthly: personalPensionProjection.pensionSavings.monthly,
        color: '#34c759',
      })
    }
    if (spousePersonalPensionProjection?.pensionSavings.current) {
      balances.push({
        label: '배우자 연금저축',
        current: spousePersonalPensionProjection.pensionSavings.current,
        monthly: spousePersonalPensionProjection.pensionSavings.monthly,
        color: '#86d993',
      })
    }

    // IRP
    if (personalPensionProjection && (personalPensionProjection.irp.current > 0 || personalPensionProjection.irp.monthly > 0)) {
      balances.push({
        label: 'IRP',
        current: personalPensionProjection.irp.current,
        monthly: personalPensionProjection.irp.monthly,
        color: '#ff9500',
      })
    }
    if (spousePersonalPensionProjection?.irp.current) {
      balances.push({
        label: '배우자 IRP',
        current: spousePersonalPensionProjection.irp.current,
        monthly: spousePersonalPensionProjection.irp.monthly,
        color: '#ffb84d',
      })
    }

    // ISA
    if (personalPensionProjection && personalPensionProjection.isa.current > 0) {
      balances.push({
        label: 'ISA',
        current: personalPensionProjection.isa.current,
        monthly: personalPensionProjection.isa.monthly,
        color: '#af52de',
      })
    }

    return balances
  }, [retirementPensionProjection, spouseRetirementPensionProjection, personalPensionProjection, spousePersonalPensionProjection])

  const hasChartData = chartData.datasets[0]?.data.length > 0

  // 총 연금 계산 (null-safe)
  const totalMonthly = totalPensionProjection
    ? totalPensionProjection.nationalPension.monthly +
      totalPensionProjection.retirement.monthlyPMT +
      totalPensionProjection.personal.monthlyPMT
    : nationalPensionData.self.monthly + (nationalPensionData.spouse?.monthly || 0)

  return (
    <div className={styles.summaryPanel}>
      {/* 예상 월 수령액 */}
      <div className={styles.summaryCard}>
        <div className={styles.totalPension}>
          <span className={styles.totalLabel}>예상 월 연금 수령액 {isMarried ? '(합산)' : ''}</span>
          <span className={styles.totalValue}>
            {formatMoney(totalMonthly)}/월
          </span>
        </div>
        <div className={styles.subValues}>
          <div className={styles.subValueItem}>
            <span className={styles.subLabel}>국민연금</span>
            <span className={styles.subValue}>{formatMoney(totalPensionProjection?.nationalPension.monthly || (nationalPensionData.self.monthly + (nationalPensionData.spouse?.monthly || 0)))}/월</span>
          </div>
          {totalPensionProjection?.retirement.isAnnuity && (
            <div className={styles.subValueItem}>
              <span className={styles.subLabel}>퇴직연금</span>
              <span className={styles.subValue}>{formatMoney(totalPensionProjection.retirement.monthlyPMT)}/월</span>
            </div>
          )}
          <div className={styles.subValueItem}>
            <span className={styles.subLabel}>개인연금</span>
            <span className={styles.subValue}>{formatMoney(totalPensionProjection?.personal.monthlyPMT || 0)}/월</span>
          </div>
        </div>
      </div>

      {/* 연금 상세 */}
      <div className={styles.breakdownCard}>
        <h4 className={styles.cardTitle}>연금 상세</h4>
        <div className={styles.breakdownList}>
          {/* 본인 국민연금 */}
          {nationalPensionData.self.monthly > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#5856d6' }}></span>
                  <span className={styles.breakdownLabel}>본인 국민연금</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(nationalPensionData.self.monthly)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {nationalPensionData.self.startAge}세부터 수령
              </div>
            </>
          )}

          {/* 배우자 국민연금 */}
          {nationalPensionData.spouse && nationalPensionData.spouse.monthly > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#8e8ee5' }}></span>
                  <span className={styles.breakdownLabel}>배우자 국민연금</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(nationalPensionData.spouse.monthly)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {nationalPensionData.spouse.startAge}세부터 수령
              </div>
            </>
          )}

          {/* 본인 퇴직연금 */}
          {retirementPensionProjection && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#007aff' }}></span>
                  <span className={styles.breakdownLabel}>본인 퇴직연금</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>
                    {retirementPensionProjection.receiveType === 'annuity' && retirementPensionProjection.monthlyPMT
                      ? `${formatMoney(retirementPensionProjection.monthlyPMT)}/월`
                      : formatMoney(retirementPensionProjection.totalAmount)
                    }
                  </span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {retirementPensionProjection.receiveType === 'annuity'
                  ? `${retirementPensionProjection.startAge}세부터 ${retirementPensionProjection.receivingYears}년간 (적립액 ${formatMoney(retirementPensionProjection.totalAmount)})`
                  : '퇴직 시 일시금 수령'
                }
              </div>
            </>
          )}

          {/* 배우자 퇴직연금 */}
          {spouseRetirementPensionProjection && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#5ac8fa' }}></span>
                  <span className={styles.breakdownLabel}>배우자 퇴직연금</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>
                    {spouseRetirementPensionProjection.receiveType === 'annuity' && spouseRetirementPensionProjection.monthlyPMT
                      ? `${formatMoney(spouseRetirementPensionProjection.monthlyPMT)}/월`
                      : formatMoney(spouseRetirementPensionProjection.totalAmount)
                    }
                  </span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {spouseRetirementPensionProjection.receiveType === 'annuity'
                  ? `${spouseRetirementPensionProjection.startAge}세부터 ${spouseRetirementPensionProjection.receivingYears}년간`
                  : '퇴직 시 일시금 수령'
                }
              </div>
            </>
          )}

          {/* 본인 연금저축 */}
          {personalPensionProjection && personalPensionProjection.pensionSavings.futureAtStart > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#34c759' }}></span>
                  <span className={styles.breakdownLabel}>본인 연금저축</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(personalPensionProjection.pensionSavings.monthlyPMT)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {personalPensionProjection.pensionSavings.startAge}세부터 {personalPensionProjection.pensionSavings.receivingYears}년간
                (적립액 {formatMoney(personalPensionProjection.pensionSavings.futureAtStart)})
              </div>
            </>
          )}

          {/* 배우자 연금저축 */}
          {spousePersonalPensionProjection && spousePersonalPensionProjection.pensionSavings.futureAtStart > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#86d993' }}></span>
                  <span className={styles.breakdownLabel}>배우자 연금저축</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(spousePersonalPensionProjection.pensionSavings.monthlyPMT)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {spousePersonalPensionProjection.pensionSavings.startAge}세부터 {spousePersonalPensionProjection.pensionSavings.receivingYears}년간
              </div>
            </>
          )}

          {/* 본인 IRP */}
          {personalPensionProjection && personalPensionProjection.irp.futureAtStart > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#ff9500' }}></span>
                  <span className={styles.breakdownLabel}>본인 IRP</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(personalPensionProjection.irp.monthlyPMT)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {personalPensionProjection.irp.startAge}세부터 {personalPensionProjection.irp.receivingYears}년간
                (적립액 {formatMoney(personalPensionProjection.irp.futureAtStart)})
              </div>
            </>
          )}

          {/* 배우자 IRP */}
          {spousePersonalPensionProjection && spousePersonalPensionProjection.irp.futureAtStart > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#ffb84d' }}></span>
                  <span className={styles.breakdownLabel}>배우자 IRP</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(spousePersonalPensionProjection.irp.monthlyPMT)}/월</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {spousePersonalPensionProjection.irp.startAge}세부터 {spousePersonalPensionProjection.irp.receivingYears}년간
              </div>
            </>
          )}

          {/* ISA (본인만) */}
          {personalPensionProjection && personalPensionProjection.isa.current > 0 && (
            <>
              <div className={styles.breakdownItem}>
                <div className={styles.breakdownInfo}>
                  <span className={styles.breakdownDot} style={{ background: '#af52de' }}></span>
                  <span className={styles.breakdownLabel}>ISA</span>
                </div>
                <div className={styles.breakdownValues}>
                  <span className={styles.breakdownAmount}>{formatMoney(personalPensionProjection.isa.atMaturity)}</span>
                </div>
              </div>
              <div className={styles.breakdownMeta}>
                {personalPensionProjection.isa.maturityYear}년 만기 → {personalPensionProjection.isa.transferTo} 전환
              </div>
            </>
          )}
        </div>
      </div>

      {/* 연령대별 타임라인 */}
      {ageTimeline.length > 0 && (
        <div className={styles.timelineCard}>
          <h4 className={styles.cardTitle}>연령대별 예상 수령액</h4>
          <div className={styles.timelineList}>
            {ageTimeline.map(({ age, monthly, sources }) => (
              <div key={age} className={styles.timelineItem}>
                <div className={styles.timelineAge}>{age}세</div>
                <div className={styles.timelineBar}>
                  <div
                    className={styles.timelineProgress}
                    style={{
                      width: `${Math.min(100, (monthly / (ageTimeline[ageTimeline.length - 1]?.monthly || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <div className={styles.timelineAmount}>{formatMoney(monthly)}/월</div>
              </div>
            ))}
          </div>
          <p className={styles.timelineNote}>
            각 연령에서 수령 가능한 모든 연금의 합계입니다
          </p>
        </div>
      )}

      {/* 연금 구성비 차트 */}
      {hasChartData && (
        <div className={styles.chartCard}>
          <h4 className={styles.cardTitle}>연금 구성비</h4>
          <div className={styles.chartWrapper}>
            <Doughnut data={chartData} options={chartOptions} />
            <div className={styles.chartCenter}>
              <span className={styles.chartCenterLabel}>월 수령액</span>
              <span className={styles.chartCenterValue}>
                {formatMoney(totalMonthly)}
              </span>
            </div>
          </div>
          <div className={styles.chartLegend}>
            {chartData.labels.map((label: string, i: number) => (
              <div key={label} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ background: chartData.datasets[0].backgroundColor[i] as string }}
                />
                <span className={styles.legendLabel}>{label}</span>
                <span className={styles.legendValue}>{formatMoney(chartData.datasets[0].data[i])}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 현재 적립 현황 */}
      {currentBalances.length > 0 && (
        <div className={styles.balanceCard}>
          <h4 className={styles.cardTitle}>현재 적립 현황</h4>
          <div className={styles.balanceList}>
            {currentBalances.map(({ label, current, monthly, color }) => (
              <div key={label} className={styles.balanceItem}>
                <div className={styles.balanceInfo}>
                  <span className={styles.balanceDot} style={{ background: color }} />
                  <span className={styles.balanceLabel}>{label}</span>
                </div>
                <div className={styles.balanceValues}>
                  <span className={styles.balanceCurrent}>{formatMoney(current)}</span>
                  {monthly > 0 && (
                    <span className={styles.balanceMonthly}>+{formatMoney(monthly)}/월</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.balanceTotal}>
            <span className={styles.balanceTotalLabel}>총 적립액</span>
            <span className={styles.balanceTotalValue}>
              {formatMoney(currentBalances.reduce((sum, b) => sum + b.current, 0))}
            </span>
          </div>
        </div>
      )}

      {/* 가정 안내 */}
      <div className={styles.assumptionsCard}>
        <h4 className={styles.cardTitle}>계산 가정</h4>
        <ul className={styles.assumptionsList}>
          <li>시나리오: {
            settings.scenarioMode === 'optimistic' ? '낙관적' :
            settings.scenarioMode === 'average' ? '평균' :
            settings.scenarioMode === 'pessimistic' ? '비관적' :
            settings.scenarioMode === 'custom' ? '커스텀' : '개별'
          }</li>
          <li>임금상승률: 연 {settings.incomeGrowthRate}%</li>
          <li>투자수익률: 연 {settings.investmentReturnRate}%</li>
          <li>예상 수명: {settings.lifeExpectancy}세</li>
          <li>PMT 방식: 수령 중에도 잔액에 수익률 적용</li>
        </ul>
      </div>
    </div>
  )
}
