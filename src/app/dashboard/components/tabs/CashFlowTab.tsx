'use client'

import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import type { OnboardingData } from '@/types'
import styles from '../../dashboard.module.css'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface CashFlowTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function CashFlowTab({ data, onUpdateData }: CashFlowTabProps) {
  // 소득 계산
  const laborIncome = data.laborIncome || 0
  const spouseLaborIncome = data.spouseLaborIncome || 0
  const businessIncome = data.businessIncome || 0
  const spouseBusinessIncome = data.spouseBusinessIncome || 0
  const totalIncome = laborIncome + spouseLaborIncome + businessIncome + spouseBusinessIncome

  // 지출 계산
  const livingExpenses = data.livingExpenses || 0
  const housingRent = data.housingType === '월세' ? (data.housingRent || 0) : 0
  const totalExpense = livingExpenses + housingRent

  // 저축률
  const monthlySavings = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? Math.round((monthlySavings / totalIncome) * 100) : 0

  // 소득원별 차트
  const incomeLabels = []
  const incomeValues = []
  if (laborIncome > 0) { incomeLabels.push('본인 근로'); incomeValues.push(laborIncome) }
  if (spouseLaborIncome > 0) { incomeLabels.push('배우자 근로'); incomeValues.push(spouseLaborIncome) }
  if (businessIncome > 0) { incomeLabels.push('본인 사업'); incomeValues.push(businessIncome) }
  if (spouseBusinessIncome > 0) { incomeLabels.push('배우자 사업'); incomeValues.push(spouseBusinessIncome) }

  const incomeData = {
    labels: incomeLabels,
    datasets: [{
      data: incomeValues,
      backgroundColor: ['#007aff', '#5856d6', '#34c759', '#30d158'],
      borderWidth: 0,
    }],
  }

  // 수입 대비 지출/저축 차트
  const cashFlowData = {
    labels: ['지출', '저축'],
    datasets: [{
      data: [totalExpense, Math.max(0, monthlySavings)],
      backgroundColor: ['#ff9500', '#34c759'],
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
          padding: 16,
          usePointStyle: true,
          font: { size: 12 },
        },
      },
    },
    cutout: '60%',
  }

  // 월별 현금흐름 차트
  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
  const monthlyData = {
    labels: months,
    datasets: [
      {
        label: '수입',
        data: months.map(() => totalIncome),
        backgroundColor: '#007aff',
        borderRadius: 4,
      },
      {
        label: '지출',
        data: months.map(() => totalExpense),
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
        labels: {
          usePointStyle: true,
          font: { size: 11 },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => `${Number(value).toLocaleString()}`,
        },
      },
    },
  }

  return (
    <div className={styles.tabLayout}>
      {/* 입력 섹션 (1/3) */}
      <div className={styles.tabInputSection}>
        <h3 className={styles.tabInputTitle}>소득</h3>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>본인 근로소득</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={laborIncome || ''}
              onChange={(e) => onUpdateData({ laborIncome: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원/월</span>
          </div>
        </div>

        {data.isMarried && (
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>배우자 근로소득</label>
            <div className={styles.inputRow}>
              <input
                type="number"
                value={spouseLaborIncome || ''}
                onChange={(e) => onUpdateData({ spouseLaborIncome: parseInt(e.target.value) || 0 })}
                className={styles.inputField}
                placeholder="0"
              />
              <span className={styles.inputUnit}>만원/월</span>
            </div>
          </div>
        )}

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>본인 사업소득</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={businessIncome || ''}
              onChange={(e) => onUpdateData({ businessIncome: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원/월</span>
          </div>
        </div>

        {data.isMarried && (
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>배우자 사업소득</label>
            <div className={styles.inputRow}>
              <input
                type="number"
                value={spouseBusinessIncome || ''}
                onChange={(e) => onUpdateData({ spouseBusinessIncome: parseInt(e.target.value) || 0 })}
                className={styles.inputField}
                placeholder="0"
              />
              <span className={styles.inputUnit}>만원/월</span>
            </div>
          </div>
        )}

        <h3 className={styles.tabInputTitle} style={{ marginTop: 32 }}>지출</h3>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>월 생활비</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={livingExpenses || ''}
              onChange={(e) => onUpdateData({ livingExpenses: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
          <p style={{ fontSize: 12, color: '#a8a29e', marginTop: 4 }}>
            식비, 교통비, 통신비 등 포함
          </p>
        </div>

        {data.housingType === '월세' && (
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>월세 + 관리비</label>
            <div className={styles.inputRow}>
              <input
                type="number"
                value={housingRent || ''}
                onChange={(e) => onUpdateData({ housingRent: parseInt(e.target.value) || 0 })}
                className={styles.inputField}
                placeholder="0"
              />
              <span className={styles.inputUnit}>만원</span>
            </div>
          </div>
        )}
      </div>

      {/* 차트 섹션 (2/3) */}
      <div className={styles.tabChartSection}>
        {/* 현금흐름 요약 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>월 현금흐름</h4>
          <div className={styles.gaugeContainer}>
            <span className={styles.gaugeValue} style={{
              color: savingsRate >= 30 ? '#34c759' : savingsRate >= 15 ? '#ff9500' : '#ff3b30'
            }}>
              {monthlySavings >= 0 ? '+' : ''}{monthlySavings.toLocaleString()}
            </span>
            <span className={styles.gaugeLabel}>만원 (저축률 {savingsRate}%)</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>월 수입</span>
            <span className={styles.statValue} style={{ color: '#007aff' }}>
              {totalIncome.toLocaleString()}만원
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>월 지출</span>
            <span className={styles.statValue} style={{ color: '#ff9500' }}>
              {totalExpense.toLocaleString()}만원
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>연간 저축</span>
            <span className={styles.statValue}>
              {(monthlySavings * 12).toLocaleString()}만원
            </span>
          </div>
        </div>

        {/* 수입 대비 지출/저축 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>수입 배분</h4>
          {totalIncome > 0 ? (
            <div className={styles.chartWrapper}>
              <Doughnut data={cashFlowData} options={doughnutOptions} />
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#a8a29e' }}>
              소득을 입력하면 비율을 확인할 수 있습니다
            </div>
          )}
        </div>

        {/* 소득원별 비율 */}
        {totalIncome > 0 && (
          <div className={styles.chartCard}>
            <h4 className={styles.chartTitle}>소득원별 비율</h4>
            <div className={styles.chartWrapper}>
              <Doughnut data={incomeData} options={doughnutOptions} />
            </div>
          </div>
        )}

        {/* 월별 현금흐름 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>연간 현금흐름 예상</h4>
          <div className={styles.chartWrapper}>
            <Bar data={monthlyData} options={barOptions} />
          </div>
        </div>
      </div>
    </div>
  )
}
