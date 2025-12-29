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

interface PensionTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function PensionTab({ data, onUpdateData }: PensionTabProps) {
  const nationalPension = data.nationalPension || 0
  const nationalPensionStartAge = data.nationalPensionStartAge || 65
  const retirementPension = data.retirementPensionBalance || 0
  const irp = data.irpBalance || 0
  const pensionSavings = data.pensionSavingsBalance || 0
  const isa = data.isaBalance || 0

  const totalPersonalPension = irp + pensionSavings + isa
  const totalPensionAssets = retirementPension + totalPersonalPension

  // 20년 수령 가정 월 환산
  const retirementMonthly = Math.round(retirementPension / 20 / 12)
  const personalMonthly = Math.round(totalPersonalPension / 20 / 12)
  const totalMonthlyPension = nationalPension + retirementMonthly + personalMonthly

  // 3층 연금 구조 차트
  const pensionData = {
    labels: ['국민연금', '퇴직연금', '개인연금'],
    datasets: [{
      data: [nationalPension * 240, retirementPension, totalPersonalPension], // 20년 수령 기준 총액
      backgroundColor: ['#78716c', '#007aff', '#34c759'],
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

  // 월 수령액 비교 차트
  const monthlyData = {
    labels: ['국민연금', '퇴직연금', '개인연금'],
    datasets: [{
      label: '예상 월 수령액',
      data: [nationalPension, retirementMonthly, personalMonthly],
      backgroundColor: ['#78716c', '#007aff', '#34c759'],
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
        <h3 className={styles.tabInputTitle}>연금 정보</h3>

        <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16 }}>1층: 국민연금</p>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>예상 월 수령액</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={nationalPension || ''}
              onChange={(e) => onUpdateData({ nationalPension: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>수령 시작 나이</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={nationalPensionStartAge || ''}
              onChange={(e) => onUpdateData({ nationalPensionStartAge: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="65"
            />
            <span className={styles.inputUnit}>세</span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16, marginTop: 24 }}>2층: 퇴직연금</p>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>현재 잔액</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={retirementPension || ''}
              onChange={(e) => onUpdateData({ retirementPensionBalance: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16, marginTop: 24 }}>3층: 개인연금</p>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>IRP</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={irp || ''}
              onChange={(e) => onUpdateData({ irpBalance: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>연금저축</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={pensionSavings || ''}
              onChange={(e) => onUpdateData({ pensionSavingsBalance: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>ISA</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={isa || ''}
              onChange={(e) => onUpdateData({ isaBalance: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>
      </div>

      {/* 차트 섹션 (2/3) */}
      <div className={styles.tabChartSection}>
        {/* 연금 요약 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>연금 요약</h4>
          <div className={styles.gaugeContainer}>
            <span className={styles.gaugeValue}>{totalMonthlyPension.toLocaleString()}</span>
            <span className={styles.gaugeLabel}>예상 월 수령액 (만원)</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>국민연금</span>
            <span className={styles.statValue}>{nationalPension.toLocaleString()}만원/월</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>퇴직연금 (20년 수령)</span>
            <span className={styles.statValue}>{retirementMonthly.toLocaleString()}만원/월</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>개인연금 (20년 수령)</span>
            <span className={styles.statValue}>{personalMonthly.toLocaleString()}만원/월</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>연금자산 총액</span>
            <span className={styles.statValue}>{totalPensionAssets.toLocaleString()}만원</span>
          </div>
        </div>

        {/* 3층 연금 구조 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>3층 연금 구조</h4>
          {totalPensionAssets > 0 || nationalPension > 0 ? (
            <div className={styles.chartWrapper}>
              <Doughnut data={pensionData} options={doughnutOptions} />
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#a8a29e' }}>
              연금 정보를 입력하면 구조를 확인할 수 있습니다
            </div>
          )}
        </div>

        {/* 월 수령액 비교 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>예상 월 수령액 비교</h4>
          <div className={styles.chartWrapper}>
            <Bar data={monthlyData} options={barOptions} />
          </div>
        </div>
      </div>
    </div>
  )
}
