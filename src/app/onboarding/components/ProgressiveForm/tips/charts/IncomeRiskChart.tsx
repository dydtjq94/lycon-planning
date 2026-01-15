'use client'

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface IncomeRiskChartProps {
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

// 소득 안정성 분석 (만원 단위로 작업)
function analyzeIncomeStabilityInManwon(data: OnboardingData) {
  // 소득 계산 (만원 단위)
  const laborIncome = (data.laborIncome || 0) + (data.spouseLaborIncome || 0)
  const businessIncome = (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)
  const totalIncome = laborIncome + businessIncome

  // 소득 비율
  const laborIncomeRatio = totalIncome > 0 ? Math.round(laborIncome / totalIncome * 100) : 0
  const businessIncomeRatio = totalIncome > 0 ? Math.round(businessIncome / totalIncome * 100) : 0

  // 리스크 레벨 (사업소득 비중에 따라)
  let riskLevel: 'low' | 'medium' | 'high' = 'low'
  let recommendedEmergencyMonths = 6

  if (businessIncomeRatio >= 70) {
    riskLevel = 'high'
    recommendedEmergencyMonths = 12
  } else if (businessIncomeRatio >= 30) {
    riskLevel = 'medium'
    recommendedEmergencyMonths = 9
  }

  // 현재 비상금 (현금성 자산 - savingsAccounts에서 checking, savings 타입 합산)
  let currentEmergencyFund = 0
  if (data.savingsAccounts) {
    data.savingsAccounts.forEach(account => {
      if (account.type === 'checking' || account.type === 'savings') {
        currentEmergencyFund += account.balance || 0
      }
    })
  }
  const monthlyExpense = data.livingExpenses || 300
  const currentEmergencyMonths = monthlyExpense > 0
    ? Math.round(currentEmergencyFund / monthlyExpense)
    : 0

  return {
    laborIncomeRatio,
    businessIncomeRatio,
    riskLevel,
    recommendedEmergencyMonths,
    currentEmergencyMonths,
    monthlyExpense,  // 만원 단위
  }
}

export function IncomeRiskChart({ data }: IncomeRiskChartProps) {
  const analysis = analyzeIncomeStabilityInManwon(data)
  const monthlyExpense = analysis.monthlyExpense

  // 소득이 없으면 안내 메시지
  if (analysis.laborIncomeRatio === 0 && analysis.businessIncomeRatio === 0) {
    return (
      <div className={styles.chartPlaceholder}>
        <p>소득 정보를 입력하면</p>
        <p>소득 안정성을 분석할 수 있습니다</p>
      </div>
    )
  }

  // 차트 데이터
  const chartData = {
    labels: ['근로소득', '사업소득'],
    datasets: [
      {
        data: [analysis.laborIncomeRatio, analysis.businessIncomeRatio],
        backgroundColor: ['#3B82F6', '#F97316'],
        borderWidth: 0,
        cutout: '65%',
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { label: string, raw: unknown }) => {
            return `${context.label}: ${context.raw}%`
          },
        },
      },
    },
  }

  // 리스크 레벨별 색상
  const riskColors = {
    low: '#10B981',
    medium: '#F97316',
    high: '#EF4444',
  }

  const riskLabels = {
    low: '안정',
    medium: '보통',
    high: '위험',
  }

  // 권장 비상금 계산 (만원 단위)
  const recommendedEmergencyFund = monthlyExpense * analysis.recommendedEmergencyMonths

  // 현재 비상금 상태
  let emergencyStatus = ''
  let emergencyStatusClass = styles.statValueWarning
  if (analysis.currentEmergencyMonths >= analysis.recommendedEmergencyMonths) {
    emergencyStatus = '충분'
    emergencyStatusClass = styles.statValueSuccess
  } else if (analysis.currentEmergencyMonths >= analysis.recommendedEmergencyMonths * 0.5) {
    emergencyStatus = '부족'
  } else {
    emergencyStatus = '매우 부족'
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>소득 안정성 분석</span>
        <span className={styles.chartSubtitle}>
          리스크 등급: <span style={{ color: riskColors[analysis.riskLevel] }}>{riskLabels[analysis.riskLevel]}</span>
        </span>
      </div>

      <div className={styles.doughnutWrapper}>
        <div className={styles.doughnutChart}>
          <Doughnut data={chartData} options={options} />
          <div className={styles.doughnutCenter}>
            <span
              className={styles.doughnutCenterValue}
              style={{ color: riskColors[analysis.riskLevel] }}
            >
              {riskLabels[analysis.riskLevel]}
            </span>
            <span className={styles.doughnutCenterLabel}>리스크</span>
          </div>
        </div>

        <div className={styles.doughnutLegend}>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: '#3B82F6' }} />
            <span className={styles.legendLabel}>근로소득</span>
            <span className={styles.legendValue}>{analysis.laborIncomeRatio}%</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: '#F97316' }} />
            <span className={styles.legendLabel}>사업소득</span>
            <span className={styles.legendValue}>{analysis.businessIncomeRatio}%</span>
          </div>
        </div>
      </div>

      <div className={styles.chartFooter}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{analysis.recommendedEmergencyMonths}개월</span>
          <span className={styles.statLabel}>권장 비상금</span>
        </div>
        <div className={styles.statItem}>
          <span className={emergencyStatusClass}>{analysis.currentEmergencyMonths}개월</span>
          <span className={styles.statLabel}>현재 ({emergencyStatus})</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatAmount(recommendedEmergencyFund)}</span>
          <span className={styles.statLabel}>권장 금액</span>
        </div>
      </div>

      {analysis.riskLevel !== 'low' && (
        <div className={styles.savingsMessage}>
          {analysis.riskLevel === 'high'
            ? '사업소득 비중이 높아 비상금 12개월치 확보를 권장합니다.'
            : '사업소득이 있어 비상금 9개월치 확보를 권장합니다.'
          }
        </div>
      )}
    </div>
  )
}
