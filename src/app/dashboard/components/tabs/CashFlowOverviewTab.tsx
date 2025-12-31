'use client'

import { useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import type { OnboardingData, SimulationSettings } from '@/types'
import { SankeyChart } from '../charts'
import styles from '../../dashboard.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler)

interface CashFlowOverviewTabProps {
  data: OnboardingData
  settings: SimulationSettings
}

type ViewMode = 'monthly' | 'yearly'
type CategoryTab = 'all' | 'income' | 'expense' | 'savings'

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

export function CashFlowOverviewTab({ data, settings }: CashFlowOverviewTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('all')

  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60
  const nationalPensionStartAge = data.nationalPensionStartAge || 65
  const multiplier = viewMode === 'yearly' ? 12 : 1

  // 소득 상세
  const laborIncome = data.laborIncome || 0
  const spouseLaborIncome = data.spouseLaborIncome || 0
  const businessIncome = data.businessIncome || 0
  const spouseBusinessIncome = data.spouseBusinessIncome || 0
  const totalIncome = laborIncome + spouseLaborIncome + businessIncome + spouseBusinessIncome

  // 지출 상세
  const livingExpenses = data.livingExpenses || 0
  const housingRent = data.housingType === '월세' ? (data.housingRent || 0) : 0
  const totalExpense = livingExpenses + housingRent

  // 저축
  const monthlySavings = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? Math.round((monthlySavings / totalIncome) * 100) : 0

  // 연간 현금흐름 예측 (현재 ~ 은퇴 ~ 기대수명)
  const lifeExpectancy = settings.lifeExpectancy || 100
  const yearsToRetirement = Math.max(0, retirementAge - currentAge)

  // 국민연금
  const nationalPension = data.nationalPension || 0
  // 퇴직연금 (20년 수령)
  const retirementPension = Math.round((data.retirementPensionBalance || 0) / 20 / 12)
  // 개인연금 (20년 수령)
  const personalPension = Math.round(((data.irpBalance || 0) + (data.pensionSavingsBalance || 0)) / 20 / 12)
  const totalPensionIncome = nationalPension + retirementPension + personalPension

  // 은퇴 후 현금흐름 갭 분석
  const retiredExpense = Math.round(totalExpense * 0.8) // 은퇴 후 지출 80%
  const cashFlowGap = totalPensionIncome - retiredExpense
  const hasGap = cashFlowGap < 0

  // 연도별 현금흐름 데이터 (5년 단위)
  const flowYears: number[] = []
  const flowIncome: number[] = []
  const flowExpense: number[] = []

  for (let age = currentAge; age <= lifeExpectancy; age += 5) {
    flowYears.push(age)

    if (age < retirementAge) {
      // 근로기
      flowIncome.push(totalIncome * 12)
      flowExpense.push(totalExpense * 12)
    } else {
      // 은퇴 후
      let income = 0
      if (age >= nationalPensionStartAge) income += nationalPension * 12
      if (age >= retirementAge && age < retirementAge + 20) {
        income += (retirementPension + personalPension) * 12
      }
      flowIncome.push(income)
      flowExpense.push(totalExpense * 12 * 0.8) // 은퇴 후 지출 80%
    }
  }

  const flowData = {
    labels: flowYears.map(age => `${age}세`),
    datasets: [
      {
        label: '수입',
        data: flowIncome,
        backgroundColor: '#007aff',
        borderRadius: 4,
      },
      {
        label: '지출',
        data: flowExpense,
        backgroundColor: '#ff9500',
        borderRadius: 4,
      },
    ],
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { usePointStyle: true, font: { size: 11 } },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => {
            const num = Number(value)
            if (num >= 10000) return `${(num / 10000).toFixed(0)}억`
            return `${num.toLocaleString()}만`
          },
        },
      },
    },
  }

  // 누적 저축 시뮬레이션
  const savingsYears = [0, 5, 10, 15, 20]
  const annualReturn = (settings.investmentReturn || 5) / 100
  const cumulativeSavings = savingsYears.map(year => {
    let total = 0
    for (let i = 0; i < year; i++) {
      total = total * (1 + annualReturn) + (monthlySavings * 12)
    }
    return Math.round(total)
  })

  const savingsData = {
    labels: savingsYears.map(y => y === 0 ? '현재' : `${y}년 후`),
    datasets: [{
      label: '누적 저축',
      data: cumulativeSavings,
      borderColor: '#34c759',
      backgroundColor: 'rgba(52, 199, 89, 0.1)',
      fill: true,
      tension: 0.4,
    }],
  }

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => {
            const num = Number(value)
            if (num >= 10000) return `${(num / 10000).toFixed(0)}억`
            return `${num.toLocaleString()}만`
          },
        },
      },
    },
  }

  // 소득 구성 차트 데이터
  const incomeBreakdown = {
    labels: ['본인 근로', '배우자 근로', '본인 사업', '배우자 사업'].filter((_, i) =>
      [laborIncome, spouseLaborIncome, businessIncome, spouseBusinessIncome][i] > 0
    ),
    datasets: [{
      data: [laborIncome, spouseLaborIncome, businessIncome, spouseBusinessIncome].filter(v => v > 0),
      backgroundColor: ['#007aff', '#5ac8fa', '#34c759', '#30d158'],
      borderWidth: 0,
    }],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { padding: 12, usePointStyle: true, font: { size: 11 } },
      },
    },
    cutout: '65%',
  }

  const periodLabel = viewMode === 'monthly' ? '월' : '연'

  return (
    <div className={styles.tabLayout}>
      {/* 요약 섹션 */}
      <div className={styles.tabInputSection}>
        <h3 className={styles.tabInputTitle}>현금흐름 현황</h3>

        {/* 기간 선택기 */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          backgroundColor: '#f5f5f4',
          borderRadius: 8,
          marginBottom: 20,
        }}>
          <button
            onClick={() => setViewMode('monthly')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: viewMode === 'monthly' ? 600 : 500,
              color: viewMode === 'monthly' ? '#292524' : '#78716c',
              backgroundColor: viewMode === 'monthly' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: viewMode === 'monthly' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            월간
          </button>
          <button
            onClick={() => setViewMode('yearly')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: viewMode === 'yearly' ? 600 : 500,
              color: viewMode === 'yearly' ? '#292524' : '#78716c',
              backgroundColor: viewMode === 'yearly' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: viewMode === 'yearly' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            연간
          </button>
        </div>

        {/* 저축률 게이지 */}
        <div className={styles.gaugeContainer} style={{ marginBottom: 24 }}>
          <span className={styles.gaugeValue} style={{
            color: savingsRate >= 30 ? '#34c759' : savingsRate >= 15 ? '#ff9500' : '#ff3b30'
          }}>
            {savingsRate}%
          </span>
          <span className={styles.gaugeLabel}>저축률</span>
        </div>

        {/* 현금흐름 요약 */}
        <div className={styles.statRow}>
          <span className={styles.statLabel}>{periodLabel} 수입</span>
          <span className={styles.statValue} style={{ color: '#007aff' }}>
            {formatMoney(totalIncome * multiplier)}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>{periodLabel} 지출</span>
          <span className={styles.statValue} style={{ color: '#ff9500' }}>
            {formatMoney(totalExpense * multiplier)}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>{periodLabel} 저축</span>
          <span className={styles.statValue} style={{ color: '#34c759' }}>
            {formatMoney(monthlySavings * multiplier)}
          </span>
        </div>

        <div style={{ height: 1, backgroundColor: '#e7e5e4', margin: '16px 0' }} />

        {/* 소득 상세 */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#292524', marginBottom: 8 }}>수입 상세</p>
        {laborIncome > 0 && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>본인 근로소득</span>
            <span className={styles.statValue}>{formatMoney(laborIncome * multiplier)}</span>
          </div>
        )}
        {spouseLaborIncome > 0 && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>배우자 근로소득</span>
            <span className={styles.statValue}>{formatMoney(spouseLaborIncome * multiplier)}</span>
          </div>
        )}
        {businessIncome > 0 && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>본인 사업소득</span>
            <span className={styles.statValue}>{formatMoney(businessIncome * multiplier)}</span>
          </div>
        )}
        {spouseBusinessIncome > 0 && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>배우자 사업소득</span>
            <span className={styles.statValue}>{formatMoney(spouseBusinessIncome * multiplier)}</span>
          </div>
        )}

        <div style={{ height: 1, backgroundColor: '#e7e5e4', margin: '16px 0' }} />

        {/* 은퇴 후 현금흐름 갭 분석 */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#292524', marginBottom: 8 }}>은퇴 후 현금흐름</p>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>예상 연금소득</span>
          <span className={styles.statValue} style={{ color: '#007aff' }}>
            {formatMoney(totalPensionIncome * multiplier)}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>예상 지출</span>
          <span className={styles.statValue} style={{ color: '#ff9500' }}>
            {formatMoney(retiredExpense * multiplier)}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>현금흐름 갭</span>
          <span className={styles.statValue} style={{
            color: hasGap ? '#ff3b30' : '#34c759',
            fontWeight: 600,
          }}>
            {hasGap ? '' : '+'}{formatMoney(cashFlowGap * multiplier)}
          </span>
        </div>
        {hasGap && (
          <p style={{
            fontSize: 12,
            color: '#ff3b30',
            marginTop: 8,
            padding: '8px 12px',
            backgroundColor: '#fef2f2',
            borderRadius: 6,
          }}>
            은퇴 후 매월 {formatMoney(Math.abs(cashFlowGap))} 부족
          </p>
        )}

        <div style={{ height: 1, backgroundColor: '#e7e5e4', margin: '16px 0' }} />

        <div className={styles.statRow}>
          <span className={styles.statLabel}>현재 나이</span>
          <span className={styles.statValue}>{currentAge}세</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>은퇴 목표</span>
          <span className={styles.statValue}>{retirementAge}세 ({yearsToRetirement}년 후)</span>
        </div>
      </div>

      {/* 차트 섹션 */}
      <div className={styles.tabChartSection}>
        {/* Sankey 현금흐름도 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>현금흐름도</h4>
          <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16 }}>
            돈이 어디서 오고 어디로 가는지 한눈에 확인하세요
          </p>
          <SankeyChart data={data} />
        </div>

        {/* 소득 구성 */}
        {totalIncome > 0 && (
          <div className={styles.chartCard}>
            <h4 className={styles.chartTitle}>소득 구성</h4>
            <div className={styles.chartWrapper} style={{ height: 200 }}>
              <Doughnut data={incomeBreakdown} options={doughnutOptions} />
            </div>
          </div>
        )}

        {/* 생애주기 현금흐름 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>생애주기 현금흐름</h4>
          <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16 }}>
            근로기에서 은퇴 후까지 수입/지출 변화
          </p>
          <div className={styles.chartWrapper} style={{ height: 250 }}>
            <Bar data={flowData} options={barOptions} />
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            marginTop: 12,
            fontSize: 12,
            color: '#78716c'
          }}>
            <span>은퇴: {retirementAge}세</span>
            <span>국민연금 수령: {nationalPensionStartAge}세</span>
          </div>
        </div>

        {/* 은퇴 후 연금 구성 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>은퇴 후 연금 구성</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#57534e' }}>국민연금</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatMoney(nationalPension)}/월</span>
              </div>
              <div style={{ height: 8, backgroundColor: '#e7e5e4', borderRadius: 4 }}>
                <div style={{
                  height: '100%',
                  width: totalPensionIncome > 0 ? `${(nationalPension / totalPensionIncome) * 100}%` : '0%',
                  backgroundColor: '#007aff',
                  borderRadius: 4,
                }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#57534e' }}>퇴직연금</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatMoney(retirementPension)}/월</span>
              </div>
              <div style={{ height: 8, backgroundColor: '#e7e5e4', borderRadius: 4 }}>
                <div style={{
                  height: '100%',
                  width: totalPensionIncome > 0 ? `${(retirementPension / totalPensionIncome) * 100}%` : '0%',
                  backgroundColor: '#34c759',
                  borderRadius: 4,
                }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#57534e' }}>개인연금</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatMoney(personalPension)}/월</span>
              </div>
              <div style={{ height: 8, backgroundColor: '#e7e5e4', borderRadius: 4 }}>
                <div style={{
                  height: '100%',
                  width: totalPensionIncome > 0 ? `${(personalPension / totalPensionIncome) * 100}%` : '0%',
                  backgroundColor: '#ff9500',
                  borderRadius: 4,
                }} />
              </div>
            </div>
            <div style={{ marginTop: 8, padding: 12, backgroundColor: '#f5f5f4', borderRadius: 8 }}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>총 연금 소득</span>
                <span className={styles.statValue} style={{ fontWeight: 600 }}>
                  {formatMoney(totalPensionIncome)}/월
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 누적 저축 시뮬레이션 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>저축 누적 시뮬레이션</h4>
          <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16 }}>
            예상 수익률 {settings.investmentReturn || 5}% 적용
          </p>
          <div className={styles.chartWrapper}>
            <Line data={savingsData} options={lineOptions} />
          </div>
          <div className={styles.statRow} style={{ marginTop: 16 }}>
            <span className={styles.statLabel}>10년 후 예상</span>
            <span className={styles.statValue}>{formatMoney(cumulativeSavings[2])}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>20년 후 예상</span>
            <span className={styles.statValue} style={{ fontWeight: 600, color: '#34c759' }}>
              {formatMoney(cumulativeSavings[4])}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
