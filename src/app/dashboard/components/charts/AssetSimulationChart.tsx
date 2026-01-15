'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TooltipItem,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { OnboardingData, SimulationSettings } from '@/types'
import styles from './Charts.module.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface AssetSimulationChartProps {
  data: OnboardingData
  settings: SimulationSettings
}

function calculateAge(birthDate: string): number {
  if (!birthDate) return 0
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

function calculateNetWorth(data: OnboardingData): number {
  const realEstateAsset = data.housingType === '자가' ? (data.housingValue || 0) : 0
  const depositAsset = data.housingType === '전세' ? (data.housingValue || 0) : 0
  // 저축 계좌
  let cashAssets = 0
  if (data.savingsAccounts) {
    data.savingsAccounts.forEach(account => {
      cashAssets += account.balance || 0
    })
  }
  // 투자 계좌
  let investAssets = 0
  if (data.investmentAccounts) {
    data.investmentAccounts.forEach(account => {
      investAssets += account.balance || 0
    })
  }
  const pensionAssets = (data.retirementPensionBalance || 0) +
    (data.irpBalance || 0) + (data.pensionSavingsBalance || 0) + (data.isaBalance || 0)
  const totalAssets = realEstateAsset + depositAsset + cashAssets + investAssets + pensionAssets
  const housingDebt = data.housingHasLoan ? (data.housingLoan || 0) : 0
  const otherDebts = data.debts?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0
  const totalDebts = housingDebt + otherDebts
  return totalAssets - totalDebts
}

export function AssetSimulationChart({ data, settings }: AssetSimulationChartProps) {
  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60
  const lifeExpectancy = settings.lifeExpectancy
  const annualReturn = settings.investmentReturn / 100

  const monthlyIncome = (data.laborIncome || 0) + (data.businessIncome || 0) +
    (data.spouseLaborIncome || 0) + (data.spouseBusinessIncome || 0)
  const monthlyExpense = data.livingExpenses || 0
  const monthlySavings = monthlyIncome - monthlyExpense
  const currentNetWorth = calculateNetWorth(data)

  const nationalPension = data.nationalPension || 0
  const retirementPensionBalance = data.retirementPensionBalance || 0
  const personalPensionBalance = (data.irpBalance || 0) + (data.pensionSavingsBalance || 0) + (data.isaBalance || 0)

  // 시뮬레이션 데이터 생성
  const labels: string[] = []
  const assetData: number[] = []

  let assets = currentNetWorth

  for (let age = currentAge; age <= lifeExpectancy; age++) {
    labels.push(`${age}세`)

    if (age < retirementAge) {
      // 은퇴 전: 저축 + 투자 수익
      assets = assets * (1 + annualReturn) + (monthlySavings * 12)
    } else {
      // 은퇴 후: 연금 수령 + 자산 인출
      const pensionYears = 20
      const retirementMonthly = Math.round(retirementPensionBalance / pensionYears / 12)
      const personalMonthly = Math.round(personalPensionBalance / pensionYears / 12)
      const pensionIncome = nationalPension + retirementMonthly + personalMonthly

      const withdrawalNeeded = Math.max(0, monthlyExpense - pensionIncome)
      assets = assets * (1 + annualReturn / 2) - (withdrawalNeeded * 12)
    }

    assetData.push(Math.max(0, Math.round(assets)))
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: '순자산',
        data: assetData,
        borderColor: '#007aff',
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#007aff',
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1d1d1f',
        bodyColor: '#1d1d1f',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            const value = context.parsed.y ?? 0
            if (value >= 10000) {
              return `${(value / 10000).toFixed(1)}억원`
            }
            return `${value.toLocaleString()}만원`
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 10,
          color: '#a8a29e',
        },
      },
      y: {
        grid: {
          color: '#f5f5f4',
        },
        ticks: {
          color: '#a8a29e',
          callback: (value: number | string) => {
            const numValue = typeof value === 'string' ? parseFloat(value) : value
            if (numValue >= 10000) {
              return `${(numValue / 10000).toFixed(0)}억`
            }
            return `${numValue.toLocaleString()}만`
          },
        },
      },
    },
  }

  // 은퇴 시점에 세로선 표시를 위한 annotation
  const retirementIndex = retirementAge - currentAge

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>자산 시뮬레이션</h3>
      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ backgroundColor: '#007aff' }} />
          순자산 추이
        </span>
        <span className={styles.legendRetirement}>
          {retirementAge}세 은퇴
        </span>
      </div>
      <div className={styles.chartWrapper}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
