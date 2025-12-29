'use client'

import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import type { OnboardingData } from '@/types'
import styles from '../../dashboard.module.css'

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

interface AssetTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function AssetTab({ data, onUpdateData }: AssetTabProps) {
  const cashChecking = data.cashCheckingAccount || 0
  const cashSavings = data.cashSavingsAccount || 0
  const investDomestic = data.investDomesticStock || 0
  const investForeign = data.investForeignStock || 0
  const investFund = data.investFund || 0
  const investOther = data.investOther || 0

  const cashAssets = cashChecking + cashSavings
  const investAssets = investDomestic + investForeign + investFund + investOther
  const totalAssets = cashAssets + investAssets

  // 자산 구성 차트
  const assetData = {
    labels: ['현금성', '주식', '펀드/채권', '기타'],
    datasets: [{
      data: [cashAssets, investDomestic + investForeign, investFund, investOther],
      backgroundColor: ['#34c759', '#007aff', '#5856d6', '#a8a29e'],
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

  // 순자산 성장 시뮬레이션
  const years = [0, 5, 10, 15, 20]
  const annualReturn = 0.05
  const monthlySavings = Math.max(0,
    ((data.laborIncome || 0) + (data.spouseLaborIncome || 0) +
      (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)) -
    (data.livingExpenses || 0)
  )
  const annualSavings = monthlySavings * 12

  const projectedAssets = years.map(year => {
    let assets = totalAssets
    for (let i = 0; i < year; i++) {
      assets = assets * (1 + annualReturn) + annualSavings
    }
    return Math.round(assets)
  })

  const growthData = {
    labels: years.map(y => `${y}년 후`),
    datasets: [{
      label: '예상 자산',
      data: projectedAssets,
      borderColor: '#007aff',
      backgroundColor: 'rgba(0, 122, 255, 0.1)',
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
          callback: (value: number | string) => `${Number(value).toLocaleString()}`,
        },
      },
    },
  }

  return (
    <div className={styles.tabLayout}>
      {/* 입력 섹션 (1/3) */}
      <div className={styles.tabInputSection}>
        <h3 className={styles.tabInputTitle}>금융자산</h3>

        <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16 }}>현금성 자산</p>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>입출금통장</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={cashChecking || ''}
              onChange={(e) => onUpdateData({ cashCheckingAccount: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>예적금</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={cashSavings || ''}
              onChange={(e) => onUpdateData({ cashSavingsAccount: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16, marginTop: 24 }}>투자 자산</p>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>국내주식/ETF</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={investDomestic || ''}
              onChange={(e) => onUpdateData({ investDomesticStock: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>해외주식/ETF</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={investForeign || ''}
              onChange={(e) => onUpdateData({ investForeignStock: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>펀드/채권</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={investFund || ''}
              onChange={(e) => onUpdateData({ investFund: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>기타 (가상화폐 등)</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={investOther || ''}
              onChange={(e) => onUpdateData({ investOther: parseInt(e.target.value) || 0 })}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>
      </div>

      {/* 차트 섹션 (2/3) */}
      <div className={styles.tabChartSection}>
        {/* 자산 요약 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>금융자산 요약</h4>
          <div className={styles.gaugeContainer}>
            <span className={styles.gaugeValue}>{totalAssets.toLocaleString()}</span>
            <span className={styles.gaugeLabel}>만원</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>현금성 자산</span>
            <span className={styles.statValue}>{cashAssets.toLocaleString()}만원</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>투자 자산</span>
            <span className={styles.statValue}>{investAssets.toLocaleString()}만원</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>투자 비중</span>
            <span className={styles.statValue}>
              {totalAssets > 0 ? Math.round((investAssets / totalAssets) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* 자산 구성 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>자산 구성</h4>
          {totalAssets > 0 ? (
            <div className={styles.chartWrapper}>
              <Doughnut data={assetData} options={doughnutOptions} />
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#a8a29e' }}>
              자산을 입력하면 구성을 확인할 수 있습니다
            </div>
          )}
        </div>

        {/* 자산 성장 시뮬레이션 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>자산 성장 시뮬레이션 (연 5% 수익률)</h4>
          <div className={styles.chartWrapper}>
            <Line data={growthData} options={lineOptions} />
          </div>
        </div>
      </div>
    </div>
  )
}
