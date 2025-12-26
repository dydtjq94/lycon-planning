'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { OnboardingData } from '@/types'
import { calculateAge, calculateMonthlyIncome } from '../calculators'
import styles from './Charts.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface PersonalPensionChartProps {
  data: OnboardingData
}

// 금액 포맷 (만원 단위 → 억/만원 표시)
function formatAmount(value: number): string {
  if (value === 0) return '0만원'

  if (value >= 10000) {
    const billions = Math.floor(value / 10000)
    const remainder = value % 10000
    if (remainder > 0) {
      return `${billions}억 ${Math.round(remainder).toLocaleString()}만원`
    }
    return `${billions}억`
  }

  return `${Math.round(value).toLocaleString()}만원`
}

// 복리 성장 계산 (만원 단위로 작업)
function calculateCompoundGrowthInManwon(
  principal: number,
  monthlyContribution: number,
  annualRate: number,
  years: number
) {
  let balance = principal
  const monthlyRate = annualRate / 100 / 12

  for (let month = 0; month < years * 12; month++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
  }

  return Math.round(balance)
}

// 세액공제 계산 (만원 단위)
function calculateTaxCredit(annualContribution: number, annualIncome: number) {
  // 총급여 5,500만원 이하: 16.5%, 초과: 13.2%
  const creditRate = annualIncome <= 5500 ? 16.5 : 13.2
  // 최대 공제 대상: 900만원
  const maxDeductible = 900
  const deductible = Math.min(annualContribution, maxDeductible)
  const creditAmount = Math.round(deductible * creditRate / 100)

  return {
    creditRate,
    creditAmount,  // 만원 단위
  }
}

export function PersonalPensionChart({ data }: PersonalPensionChartProps) {
  // 개인연금 현황 (이미 만원 단위)
  const irp = data.irpBalance || 0
  const pensionSavings = data.pensionSavingsBalance || 0
  const isa = data.isaBalance || 0
  const totalBalance = irp + pensionSavings + isa

  // 연간 소득 계산 (만원 단위)
  const annualIncome = calculateMonthlyIncome(data) * 12

  // 세액공제 계산 (연 900만원 납입 가정)
  const maxContribution = 900 // 만원 단위
  const taxCredit = calculateTaxCredit(maxContribution, annualIncome)

  // 은퇴까지 남은 기간
  const currentAge = data.birth_date ? calculateAge(data.birth_date) : 40
  const retirementAge = data.target_retirement_age || 60
  const yearsToRetirement = Math.max(1, retirementAge - currentAge)

  // 납입 시뮬레이션 (연 900만원 납입, 5% 수익률)
  const futureProjection = calculateCompoundGrowthInManwon(
    totalBalance,
    maxContribution / 12, // 월 75만원
    5,
    yearsToRetirement
  )

  // 누적 세금 환급 예상
  const totalTaxCredit = taxCredit.creditAmount * yearsToRetirement

  // 잔액이 없으면 세금 환급 효과 차트로 대체
  if (totalBalance === 0) {
    const yearsData = [5, 10, 15, 20]
    const projections = yearsData.map(years => {
      const balance = calculateCompoundGrowthInManwon(0, maxContribution / 12, 5, years)
      const credit = taxCredit.creditAmount * years
      return {
        years,
        balance,      // 만원 단위
        taxCredit: credit,  // 만원 단위
        total: balance + credit,
      }
    })

    const chartData = {
      labels: projections.map(p => `${p.years}년`),
      datasets: [
        {
          label: '적립금',
          data: projections.map(p => p.balance),
          backgroundColor: '#3B82F6',
          borderRadius: 4,
        },
        {
          label: '세금 환급',
          data: projections.map(p => p.taxCredit),
          backgroundColor: '#10B981',
          borderRadius: 4,
        },
      ],
    }

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
          labels: { boxWidth: 12, padding: 8, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (context: { dataset: { label?: string }, raw: unknown }) => {
              return `${context.dataset.label}: ${formatAmount(context.raw as number)}`
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#78716C', font: { size: 11 } },
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            color: '#A8A29E',
            font: { size: 10 },
            callback: (value: number | string) => `${Number(value).toLocaleString()}만`,
          },
        },
      },
    }

    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>개인연금 적립 시뮬레이션</span>
          <span className={styles.chartSubtitle}>연 900만원 납입 기준</span>
        </div>

        <div className={styles.chartBodyLarge}>
          <Bar data={chartData} options={options} />
        </div>

        <div className={styles.chartFooter}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{formatAmount(maxContribution)}</span>
            <span className={styles.statLabel}>연간 납입</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValueSuccess}>+{formatAmount(taxCredit.creditAmount)}</span>
            <span className={styles.statLabel}>연간 환급</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{taxCredit.creditRate}%</span>
            <span className={styles.statLabel}>공제율</span>
          </div>
        </div>

        <div className={styles.savingsMessage}>
          지금 시작하면 {yearsToRetirement}년 후 약 {formatAmount(projections.find(p => p.years >= yearsToRetirement)?.total || futureProjection)} 확보 가능
        </div>
      </div>
    )
  }

  // 잔액이 있을 때: 현재 잔액 + 미래 예상
  const products = [
    { name: 'IRP', balance: irp, color: '#3B82F6' },
    { name: '연금저축', balance: pensionSavings, color: '#10B981' },
    { name: 'ISA', balance: isa, color: '#F97316' },
  ].filter(p => p.balance > 0)

  const chartData = {
    labels: products.map(p => p.name),
    datasets: [
      {
        label: '현재 잔액',
        data: products.map(p => p.balance),
        backgroundColor: products.map(p => p.color),
        borderRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { raw: unknown }) => {
            return formatAmount(context.raw as number)
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          color: '#A8A29E',
          font: { size: 10 },
          callback: (value: number | string) => `${Number(value).toLocaleString()}만`,
        },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#78716C', font: { size: 12 } },
      },
    },
  }

  // 20년 수령 시 월 연금
  const monthlyPension = Math.round(futureProjection / (20 * 12))

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>개인연금 현황</span>
        <span className={styles.chartSubtitle}>
          {yearsToRetirement}년 후 예상 {formatAmount(futureProjection)}
        </span>
      </div>

      <div className={styles.chartBody}>
        <Bar data={chartData} options={options} />
      </div>

      <div className={styles.chartFooter}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatAmount(totalBalance)}</span>
          <span className={styles.statLabel}>현재 총액</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValueSuccess}>+{formatAmount(totalTaxCredit)}</span>
          <span className={styles.statLabel}>{yearsToRetirement}년 누적 환급</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatAmount(monthlyPension)}</span>
          <span className={styles.statLabel}>월 연금 (20년)</span>
        </div>
      </div>

      <div className={styles.savingsMessage}>
        연 900만원 납입 시 세액공제 {formatAmount(taxCredit.creditAmount)} (공제율 {taxCredit.creditRate}%)
      </div>
    </div>
  )
}
