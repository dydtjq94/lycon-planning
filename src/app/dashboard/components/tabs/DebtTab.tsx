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

interface DebtTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function DebtTab({ data, onUpdateData }: DebtTabProps) {
  const housingDebt = data.housingHasLoan ? (data.housingLoan || 0) : 0
  const housingLoanRate = data.housingLoanRate || 4.0
  const otherDebts = data.debts?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0
  const totalDebt = housingDebt + otherDebts

  // 소득 계산
  const totalIncome = (data.laborIncome || 0) + (data.spouseLaborIncome || 0) +
    (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)
  const annualIncome = totalIncome * 12

  // DTI (총부채상환비율)
  const monthlyPayment = housingDebt > 0 ? Math.round(housingDebt * (housingLoanRate / 100 / 12) / (1 - Math.pow(1 + housingLoanRate / 100 / 12, -360)) ) : 0
  const dti = annualIncome > 0 ? Math.round((monthlyPayment * 12 / annualIncome) * 100) : 0

  // 부채 구성 차트
  const debtData = {
    labels: ['주택담보대출', '기타 대출'],
    datasets: [{
      data: [housingDebt, otherDebts],
      backgroundColor: ['#ff3b30', '#ff9500'],
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

  // 상환 일정 (30년 기준 남은 금액 시뮬레이션)
  const years = [0, 5, 10, 15, 20, 25, 30]
  const remainingBalance = years.map(year => {
    if (housingDebt === 0) return 0
    // 단순 원리금균등상환 가정
    const monthlyRate = housingLoanRate / 100 / 12
    const totalMonths = 360
    const paidMonths = year * 12
    const remainingMonths = totalMonths - paidMonths
    if (remainingMonths <= 0) return 0
    const factor = Math.pow(1 + monthlyRate, -remainingMonths)
    return Math.round(housingDebt * (1 - (paidMonths / totalMonths)) * (1 - paidMonths * 0.02))
  })

  const repaymentData = {
    labels: years.map(y => `${y}년`),
    datasets: [{
      label: '남은 잔액',
      data: remainingBalance,
      backgroundColor: '#ff3b30',
      borderRadius: 4,
    }],
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
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
        <h3 className={styles.tabInputTitle}>부채 정보</h3>

        {data.housingHasLoan && (
          <>
            <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16 }}>주택담보대출</p>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>대출 잔액</label>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  value={housingDebt || ''}
                  onChange={(e) => onUpdateData({ housingLoan: parseInt(e.target.value) || 0 })}
                  className={styles.inputField}
                  placeholder="0"
                />
                <span className={styles.inputUnit}>만원</span>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>대출 금리</label>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  step="0.1"
                  value={housingLoanRate || ''}
                  onChange={(e) => onUpdateData({ housingLoanRate: parseFloat(e.target.value) || 0 })}
                  className={styles.inputField}
                  placeholder="4.0"
                />
                <span className={styles.inputUnit}>%</span>
              </div>
            </div>
          </>
        )}

        <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16, marginTop: data.housingHasLoan ? 24 : 0 }}>
          기타 대출
        </p>

        {(data.debts || []).length > 0 ? (
          data.debts?.map((debt, index) => (
            <div key={index} className={styles.inputGroup}>
              <label className={styles.inputLabel}>{debt.name || `대출 ${index + 1}`}</label>
              <div style={{ fontSize: 14, color: '#292524' }}>
                {(debt.amount || 0).toLocaleString()}만원 ({debt.rate}%)
              </div>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 13, color: '#a8a29e' }}>등록된 기타 대출이 없습니다</p>
        )}
      </div>

      {/* 차트 섹션 (2/3) */}
      <div className={styles.tabChartSection}>
        {/* 부채 요약 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>부채 요약</h4>
          <div className={styles.gaugeContainer}>
            <span className={styles.gaugeValue} style={{ color: '#ff3b30' }}>
              {totalDebt.toLocaleString()}
            </span>
            <span className={styles.gaugeLabel}>만원</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>주택담보대출</span>
            <span className={styles.statValue}>{housingDebt.toLocaleString()}만원</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>기타 대출</span>
            <span className={styles.statValue}>{otherDebts.toLocaleString()}만원</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>DTI (총부채상환비율)</span>
            <span className={styles.statValue} style={{
              color: dti <= 40 ? '#34c759' : dti <= 60 ? '#ff9500' : '#ff3b30'
            }}>
              {dti}%
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>월 상환액 (예상)</span>
            <span className={styles.statValue}>{monthlyPayment.toLocaleString()}만원</span>
          </div>
        </div>

        {/* 부채 구성 */}
        {totalDebt > 0 && (
          <div className={styles.chartCard}>
            <h4 className={styles.chartTitle}>부채 구성</h4>
            <div className={styles.chartWrapper}>
              <Doughnut data={debtData} options={doughnutOptions} />
            </div>
          </div>
        )}

        {/* 상환 일정 */}
        {housingDebt > 0 && (
          <div className={styles.chartCard}>
            <h4 className={styles.chartTitle}>대출 상환 예상 (30년 기준)</h4>
            <div className={styles.chartWrapper}>
              <Bar data={repaymentData} options={barOptions} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
