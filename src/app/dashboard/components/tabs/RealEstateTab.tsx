'use client'

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { OnboardingData } from '@/types'
import styles from '../../dashboard.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface RealEstateTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function RealEstateTab({ data, onUpdateData }: RealEstateTabProps) {
  const housingValue = data.housingValue || 0
  const housingLoan = data.housingHasLoan ? (data.housingLoan || 0) : 0
  const netValue = data.housingType === '자가' ? housingValue - housingLoan : 0
  const ltv = housingValue > 0 ? Math.round((housingLoan / housingValue) * 100) : 0

  // 소득 계산
  const totalIncome = (data.laborIncome || 0) + (data.spouseLaborIncome || 0) +
    (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)
  const housingRent = data.housingRent || 0
  const housingRatio = totalIncome > 0 ? Math.round((housingRent / totalIncome) * 100) : 0

  // 자산 vs 부채 차트
  const equityData = {
    labels: ['순자산', '대출'],
    datasets: [{
      data: [netValue, housingLoan],
      backgroundColor: ['#34c759', '#ff3b30'],
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

  const getHousingTypeLabel = (type: string | null) => {
    switch (type) {
      case '자가': return '자가'
      case '전세': return '전세'
      case '월세': return '월세'
      default: return '해당없음'
    }
  }

  return (
    <div className={styles.tabLayout}>
      {/* 입력 섹션 (1/3) */}
      <div className={styles.tabInputSection}>
        <h3 className={styles.tabInputTitle}>부동산 정보</h3>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>거주 형태</label>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#292524' }}>
            {getHousingTypeLabel(data.housingType)}
          </div>
        </div>

        {data.housingType === '자가' && (
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>시세</label>
            <div className={styles.inputRow}>
              <input
                type="number"
                value={housingValue || ''}
                onChange={(e) => onUpdateData({ housingValue: parseInt(e.target.value) || 0 })}
                className={styles.inputField}
                placeholder="0"
              />
              <span className={styles.inputUnit}>만원</span>
            </div>
          </div>
        )}

        {(data.housingType === '전세' || data.housingType === '월세') && (
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>보증금</label>
            <div className={styles.inputRow}>
              <input
                type="number"
                value={housingValue || ''}
                onChange={(e) => onUpdateData({ housingValue: parseInt(e.target.value) || 0 })}
                className={styles.inputField}
                placeholder="0"
              />
              <span className={styles.inputUnit}>만원</span>
            </div>
          </div>
        )}

        {data.housingType === '월세' && (
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>월세</label>
            <div className={styles.inputRow}>
              <input
                type="number"
                value={housingRent || ''}
                onChange={(e) => onUpdateData({ housingRent: parseInt(e.target.value) || 0 })}
                className={styles.inputField}
                placeholder="0"
              />
              <span className={styles.inputUnit}>만원/월</span>
            </div>
          </div>
        )}
      </div>

      {/* 차트 섹션 (2/3) */}
      <div className={styles.tabChartSection}>
        {/* 부동산 요약 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>부동산 요약</h4>
          <div className={styles.gaugeContainer}>
            <span className={styles.gaugeValue}>
              {data.housingType === '자가' ? netValue.toLocaleString() : housingValue.toLocaleString()}
            </span>
            <span className={styles.gaugeLabel}>
              {data.housingType === '자가' ? '순자산 (만원)' : '보증금 (만원)'}
            </span>
          </div>

          {data.housingType === '자가' && (
            <>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>시세</span>
                <span className={styles.statValue}>{housingValue.toLocaleString()}만원</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>대출 잔액</span>
                <span className={styles.statValue}>{housingLoan.toLocaleString()}만원</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>LTV</span>
                <span className={styles.statValue} style={{
                  color: ltv <= 50 ? '#34c759' : ltv <= 70 ? '#ff9500' : '#ff3b30'
                }}>
                  {ltv}%
                </span>
              </div>
            </>
          )}

          {data.housingType === '월세' && (
            <>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>월세</span>
                <span className={styles.statValue}>{housingRent.toLocaleString()}만원</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>주거비 비율</span>
                <span className={styles.statValue} style={{
                  color: housingRatio <= 25 ? '#34c759' : housingRatio <= 35 ? '#ff9500' : '#ff3b30'
                }}>
                  {housingRatio}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* 자산 vs 부채 (자가인 경우) */}
        {data.housingType === '자가' && housingValue > 0 && (
          <div className={styles.chartCard}>
            <h4 className={styles.chartTitle}>자산 vs 부채</h4>
            <div className={styles.chartWrapper}>
              <Doughnut data={equityData} options={doughnutOptions} />
            </div>
          </div>
        )}

        {/* 주거비 가이드 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>주거비 가이드</h4>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>권장 주거비</span>
            <span className={styles.statValue}>소득의 25% 이하</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>주의 구간</span>
            <span className={styles.statValue}>소득의 25~35%</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>위험 구간</span>
            <span className={styles.statValue}>소득의 35% 초과</span>
          </div>
        </div>
      </div>
    </div>
  )
}
