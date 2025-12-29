'use client'

import { useState } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Doughnut, Bar, Line } from 'react-chartjs-2'
import type { OnboardingData, SimulationSettings } from '@/types'
import styles from '../../dashboard.module.css'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler)

interface TaxAnalyticsTabProps {
  data: OnboardingData
  settings: SimulationSettings
}

type ViewMode = 'monthly' | 'yearly'

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

// 종합소득세 계산 (2024 기준)
function calculateIncomeTax(annualIncome: number): { tax: number; rate: number; brackets: { range: string; rate: number; amount: number }[] } {
  const brackets = [
    { min: 0, max: 1400, rate: 6 },
    { min: 1400, max: 5000, rate: 15 },
    { min: 5000, max: 8800, rate: 24 },
    { min: 8800, max: 15000, rate: 35 },
    { min: 15000, max: 30000, rate: 38 },
    { min: 30000, max: 50000, rate: 40 },
    { min: 50000, max: 100000, rate: 42 },
    { min: 100000, max: Infinity, rate: 45 },
  ]

  let totalTax = 0
  const taxDetails: { range: string; rate: number; amount: number }[] = []
  let remaining = annualIncome

  for (const bracket of brackets) {
    if (remaining <= 0) break
    const taxableInBracket = Math.min(remaining, bracket.max - bracket.min)
    const taxAmount = Math.round(taxableInBracket * bracket.rate / 100)
    if (taxAmount > 0) {
      taxDetails.push({
        range: bracket.max === Infinity ? `${bracket.min.toLocaleString()}만원 초과` : `${bracket.min.toLocaleString()}~${bracket.max.toLocaleString()}만원`,
        rate: bracket.rate,
        amount: taxAmount,
      })
    }
    totalTax += taxAmount
    remaining -= taxableInBracket
  }

  const effectiveRate = annualIncome > 0 ? Math.round((totalTax / annualIncome) * 100 * 10) / 10 : 0

  return { tax: totalTax, rate: effectiveRate, brackets: taxDetails }
}

// 한계세율 계산
function getMarginalTaxRate(annualIncome: number): number {
  const brackets = [
    { max: 1400, rate: 6 },
    { max: 5000, rate: 15 },
    { max: 8800, rate: 24 },
    { max: 15000, rate: 35 },
    { max: 30000, rate: 38 },
    { max: 50000, rate: 40 },
    { max: 100000, rate: 42 },
    { max: Infinity, rate: 45 },
  ]
  for (const bracket of brackets) {
    if (annualIncome <= bracket.max) {
      return bracket.rate
    }
  }
  return 45
}

// 4대보험료 계산 (2024 기준, 근로자 부담분)
function calculate4Insurance(monthlyIncome: number): { national: number; health: number; longterm: number; employment: number; total: number; rate: number } {
  // 국민연금: 4.5% (월 소득 상한 590만원)
  const nationalBase = Math.min(monthlyIncome, 590)
  const national = Math.round(nationalBase * 0.045)

  // 건강보험: 3.545%
  const health = Math.round(monthlyIncome * 0.03545)

  // 장기요양보험: 건강보험료의 12.81%
  const longterm = Math.round(health * 0.1281)

  // 고용보험: 0.9%
  const employment = Math.round(monthlyIncome * 0.009)

  const total = national + health + longterm + employment

  // 4대보험 요율 (대략)
  const rate = monthlyIncome > 0 ? (total / monthlyIncome) * 100 : 0

  return { national, health, longterm, employment, total, rate }
}

// 세후 소득에서 세전 소득 역산 (반복법)
function estimateGrossFromNet(netMonthlyIncome: number): {
  grossMonthly: number
  grossAnnual: number
  incomeTax: { tax: number; rate: number; brackets: { range: string; rate: number; amount: number }[] }
  localTax: number
  insurance: { national: number; health: number; longterm: number; employment: number; total: number; rate: number }
  totalTax: number
} {
  if (netMonthlyIncome <= 0) {
    return {
      grossMonthly: 0,
      grossAnnual: 0,
      incomeTax: { tax: 0, rate: 0, brackets: [] },
      localTax: 0,
      insurance: { national: 0, health: 0, longterm: 0, employment: 0, total: 0, rate: 0 },
      totalTax: 0,
    }
  }

  // 반복법으로 세전 소득 추정
  let grossMonthly = netMonthlyIncome * 1.3 // 초기 추정 (30% 세금 가정)

  for (let i = 0; i < 20; i++) {
    const grossAnnual = grossMonthly * 12
    const incomeTax = calculateIncomeTax(grossAnnual)
    const localTax = Math.round(incomeTax.tax * 0.1)
    const insurance = calculate4Insurance(grossMonthly)

    const monthlyTax = Math.round(incomeTax.tax / 12) + Math.round(localTax / 12) + insurance.total
    const estimatedNet = grossMonthly - monthlyTax

    // 오차가 1만원 미만이면 종료
    if (Math.abs(estimatedNet - netMonthlyIncome) < 1) {
      return {
        grossMonthly: Math.round(grossMonthly),
        grossAnnual: Math.round(grossMonthly * 12),
        incomeTax,
        localTax,
        insurance,
        totalTax: Math.round(monthlyTax * 12),
      }
    }

    // 추정치 조정
    grossMonthly = grossMonthly + (netMonthlyIncome - estimatedNet)
  }

  // 최종 결과
  const grossAnnual = grossMonthly * 12
  const incomeTax = calculateIncomeTax(grossAnnual)
  const localTax = Math.round(incomeTax.tax * 0.1)
  const insurance = calculate4Insurance(grossMonthly)
  const monthlyTax = Math.round(incomeTax.tax / 12) + Math.round(localTax / 12) + insurance.total

  return {
    grossMonthly: Math.round(grossMonthly),
    grossAnnual: Math.round(grossAnnual),
    incomeTax,
    localTax,
    insurance,
    totalTax: Math.round(monthlyTax * 12),
  }
}

// 은퇴 후 건강보험료 (지역가입자) 예상
function calculateRetiredHealthInsurance(financialAssets: number, pensionIncome: number): number {
  // 단순화된 계산: 금융소득 + 연금소득 기준
  // 실제로는 재산, 자동차 등도 포함
  const incomePoints = Math.round(pensionIncome * 12 / 100) // 소득 점수
  const assetPoints = Math.round(financialAssets / 1000) // 재산 점수 (단순화)
  const totalPoints = incomePoints + assetPoints
  const monthlyPremium = Math.round(totalPoints * 208.4) // 2024년 점수당 금액

  return Math.min(monthlyPremium, 400) // 상한 400만원 가정
}

export function TaxAnalyticsTab({ data, settings }: TaxAnalyticsTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const multiplier = viewMode === 'yearly' ? 12 : 1
  const periodLabel = viewMode === 'monthly' ? '월' : '연'

  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60
  const yearsToRetirement = Math.max(0, retirementAge - currentAge)

  // 세후 소득 (사용자가 입력한 실수령액)
  const netMonthlyLaborIncome = (data.laborIncome || 0) + (data.spouseLaborIncome || 0)
  const netMonthlyBusinessIncome = (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)
  const netMonthlyIncome = netMonthlyLaborIncome + netMonthlyBusinessIncome

  // 세후 소득에서 세전 소득 역산
  const estimated = estimateGrossFromNet(netMonthlyIncome)

  // 세전 소득 (추정)
  const grossMonthlyIncome = estimated.grossMonthly
  const grossAnnualIncome = estimated.grossAnnual

  // 세금 정보 (역산된 결과)
  const incomeTax = estimated.incomeTax
  const localTax = estimated.localTax
  const totalIncomeTax = incomeTax.tax + localTax
  const insurance = estimated.insurance

  // 한계세율 (세전 소득 기준)
  const marginalRate = getMarginalTaxRate(grossAnnualIncome)

  // 총 세금 부담
  const totalAnnualTax = estimated.totalTax
  const monthlyTaxBurden = Math.round(totalAnnualTax / 12)
  const taxRate = grossAnnualIncome > 0 ? Math.round((totalAnnualTax / grossAnnualIncome) * 100) : 0

  // 세후 소득 (입력값 = 실수령액)
  const afterTaxIncome = netMonthlyIncome

  // 은퇴 후 예상
  const nationalPension = data.nationalPension || 0
  const retirementPension = Math.round((data.retirementPensionBalance || 0) / 20 / 12)
  const personalPension = Math.round(((data.irpBalance || 0) + (data.pensionSavingsBalance || 0)) / 20 / 12)
  const totalPensionIncome = nationalPension + retirementPension + personalPension

  const financialAssets = (data.cashCheckingAccount || 0) + (data.cashSavingsAccount || 0) +
    (data.investDomesticStock || 0) + (data.investForeignStock || 0) +
    (data.investFund || 0) + (data.investOther || 0)

  const retiredHealthInsurance = calculateRetiredHealthInsurance(financialAssets, totalPensionIncome)

  // 연도별 세금 예측 (은퇴까지)
  const taxProjectionYears = [0, 5, 10, 15, 20].filter(y => y <= yearsToRetirement + 5)
  const taxProjection = taxProjectionYears.map(year => {
    if (year <= yearsToRetirement) {
      // 근로기: 동일 소득 가정
      return totalAnnualTax
    } else {
      // 은퇴 후: 연금 소득에 대한 세금만
      const pensionAnnual = totalPensionIncome * 12
      const pensionTax = calculateIncomeTax(pensionAnnual)
      return Math.round(pensionTax.tax * 1.1) + Math.round(retiredHealthInsurance * 12) // 소득세 + 건보료
    }
  })

  // 누적 세금 계산
  const cumulativeTax = taxProjectionYears.reduce((acc, year, i) => {
    const prev = acc[i - 1] || 0
    return [...acc, prev + taxProjection[i] * (i === 0 ? 1 : 5)]
  }, [] as number[])

  // 세금 구성 차트
  const taxData = {
    labels: ['종합소득세', '지방소득세', '국민연금', '건강보험', '장기요양', '고용보험'],
    datasets: [{
      data: [
        incomeTax.tax / 12,
        localTax / 12,
        insurance.national,
        insurance.health,
        insurance.longterm,
        insurance.employment
      ],
      backgroundColor: ['#ff3b30', '#ff6b6b', '#007aff', '#34c759', '#5856d6', '#ff9500'],
      borderWidth: 0,
    }],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 12,
          usePointStyle: true,
          font: { size: 11 },
        },
      },
    },
    cutout: '60%',
  }

  // 세금 구간 바 차트
  const bracketData = {
    labels: incomeTax.brackets.map(b => b.range),
    datasets: [{
      label: '납부 세금',
      data: incomeTax.brackets.map(b => b.amount),
      backgroundColor: incomeTax.brackets.map((_, i) =>
        `rgba(255, 59, 48, ${0.3 + (i * 0.1)})`
      ),
      borderRadius: 4,
    }],
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: {
          callback: (value: number | string) => `${Number(value).toLocaleString()}만원`,
        },
      },
    },
  }

  // 세금 예측 차트 데이터
  const taxProjectionData = {
    labels: taxProjectionYears.map(y => y === 0 ? '현재' : `${y}년 후`),
    datasets: [{
      label: '연간 세금',
      data: taxProjection,
      borderColor: '#ff3b30',
      backgroundColor: 'rgba(255, 59, 48, 0.1)',
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
          callback: (value: number | string) => formatMoney(Number(value)),
        },
      },
    },
  }

  return (
    <div className={styles.tabLayout}>
      {/* 요약 섹션 */}
      <div className={styles.tabInputSection}>
        <h3 className={styles.tabInputTitle}>세금 현황</h3>

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

        {/* 세율 요약 */}
        <div style={{
          display: 'flex',
          gap: 16,
          marginBottom: 24,
        }}>
          <div className={styles.gaugeContainer} style={{ flex: 1 }}>
            <span className={styles.gaugeValue} style={{ color: '#ff3b30', fontSize: 28 }}>
              {taxRate}%
            </span>
            <span className={styles.gaugeLabel}>실효세율</span>
          </div>
          <div className={styles.gaugeContainer} style={{ flex: 1 }}>
            <span className={styles.gaugeValue} style={{ color: '#ff9500', fontSize: 28 }}>
              {marginalRate}%
            </span>
            <span className={styles.gaugeLabel}>한계세율</span>
          </div>
        </div>

        {/* 소득 요약 */}
        <div className={styles.statRow}>
          <span className={styles.statLabel}>실수령액 (입력값)</span>
          <span className={styles.statValue} style={{ color: '#34c759' }}>
            {formatMoney(netMonthlyIncome * multiplier)}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>추정 세전 소득</span>
          <span className={styles.statValue}>{formatMoney(grossMonthlyIncome * multiplier)}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>추정 {periodLabel} 세금</span>
          <span className={styles.statValue} style={{ color: '#ff3b30' }}>
            {formatMoney(monthlyTaxBurden * multiplier)}
          </span>
        </div>

        <div style={{ height: 1, backgroundColor: '#e7e5e4', margin: '16px 0' }} />

        {/* 세금 상세 */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#292524', marginBottom: 12 }}>
          세금 상세
        </p>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>종합소득세</span>
          <span className={styles.statValue}>{formatMoney(Math.round(incomeTax.tax / 12) * multiplier)}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>지방소득세</span>
          <span className={styles.statValue}>{formatMoney(Math.round(localTax / 12) * multiplier)}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>국민연금</span>
          <span className={styles.statValue}>{formatMoney(insurance.national * multiplier)}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>건강보험</span>
          <span className={styles.statValue}>{formatMoney(insurance.health * multiplier)}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>장기요양</span>
          <span className={styles.statValue}>{formatMoney(insurance.longterm * multiplier)}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>고용보험</span>
          <span className={styles.statValue}>{formatMoney(insurance.employment * multiplier)}</span>
        </div>

        <div style={{ height: 1, backgroundColor: '#e7e5e4', margin: '16px 0' }} />

        {/* 은퇴 후 예상 */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#292524', marginBottom: 12 }}>
          은퇴 후 예상
        </p>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>예상 연금소득</span>
          <span className={styles.statValue}>{formatMoney(totalPensionIncome * multiplier)}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>건강보험료</span>
          <span className={styles.statValue} style={{ color: '#ff9500' }}>
            {formatMoney(retiredHealthInsurance * multiplier)}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>은퇴까지</span>
          <span className={styles.statValue}>{yearsToRetirement}년</span>
        </div>
      </div>

      {/* 차트 섹션 */}
      <div className={styles.tabChartSection}>
        {/* 세금 구성 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>월별 세금 구성</h4>
          {monthlyTaxBurden > 0 ? (
            <div className={styles.chartWrapper}>
              <Doughnut data={taxData} options={doughnutOptions} />
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#a8a29e' }}>
              소득을 입력하면 세금을 계산할 수 있습니다
            </div>
          )}
        </div>

        {/* 소득세 구간별 분석 */}
        {incomeTax.brackets.length > 0 && (
          <div className={styles.chartCard}>
            <h4 className={styles.chartTitle}>소득세 구간별 분석</h4>
            <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16 }}>
              실효세율: {incomeTax.rate}%
            </p>
            <div className={styles.chartWrapper} style={{ height: Math.max(150, incomeTax.brackets.length * 40) }}>
              <Bar data={bracketData} options={barOptions} />
            </div>
          </div>
        )}

        {/* 세금 절약 팁 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>세금 절약 전략</h4>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: '#57534e' }}>
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f4', borderRadius: 8 }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>연금저축/IRP 세액공제</p>
              <p style={{ fontSize: 12, color: '#78716c' }}>
                연간 최대 900만원 납입 시 최대 148.5만원 세액공제
              </p>
            </div>
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f4', borderRadius: 8 }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>ISA 활용</p>
              <p style={{ fontSize: 12, color: '#78716c' }}>
                비과세 한도 내 금융소득 절세 (일반형 200만원, 서민형 400만원)
              </p>
            </div>
            <div style={{ padding: 12, backgroundColor: '#f5f5f4', borderRadius: 8 }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>금융소득 2천만원 이하 유지</p>
              <p style={{ fontSize: 12, color: '#78716c' }}>
                초과 시 종합과세 + 건강보험료 인상
              </p>
            </div>
          </div>
        </div>

        {/* 세금 예측 */}
        {taxProjectionYears.length > 1 && (
          <div className={styles.chartCard}>
            <h4 className={styles.chartTitle}>연간 세금 추이</h4>
            <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16 }}>
              근로기 vs 은퇴 후 세금 부담 변화
            </p>
            <div className={styles.chartWrapper}>
              <Line data={taxProjectionData} options={lineOptions} />
            </div>
            <div style={{ marginTop: 16 }}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>현재 연간 세금</span>
                <span className={styles.statValue} style={{ color: '#ff3b30' }}>
                  {formatMoney(totalAnnualTax)}
                </span>
              </div>
              {yearsToRetirement > 0 && yearsToRetirement <= 20 && (
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>은퇴 후 예상</span>
                  <span className={styles.statValue} style={{ color: '#ff9500' }}>
                    {formatMoney(taxProjection[taxProjection.length - 1])}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 누적 세금 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>누적 세금 부담</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {taxProjectionYears.map((year, i) => (
              <div key={year} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#78716c', width: 60 }}>
                  {year === 0 ? '현재' : `${year}년 후`}
                </span>
                <div style={{ flex: 1, height: 8, backgroundColor: '#e7e5e4', borderRadius: 4 }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (cumulativeTax[i] / (cumulativeTax[cumulativeTax.length - 1] || 1)) * 100)}%`,
                    backgroundColor: '#ff3b30',
                    borderRadius: 4,
                    opacity: 0.5 + (i / taxProjectionYears.length) * 0.5,
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, width: 80, textAlign: 'right' }}>
                  {formatMoney(cumulativeTax[i])}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 연간 요약 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>연간 요약</h4>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>연간 실수령액</span>
            <span className={styles.statValue} style={{ color: '#34c759', fontWeight: 600 }}>
              {formatMoney(netMonthlyIncome * 12)}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>추정 세전 소득</span>
            <span className={styles.statValue}>{formatMoney(grossAnnualIncome)}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>추정 소득세</span>
            <span className={styles.statValue}>{formatMoney(totalIncomeTax)}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>추정 4대보험</span>
            <span className={styles.statValue}>{formatMoney(insurance.total * 12)}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>추정 총 세금</span>
            <span className={styles.statValue} style={{ color: '#ff3b30', fontWeight: 600 }}>
              {formatMoney(totalAnnualTax)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
