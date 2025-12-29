'use client'

import { useEffect, useRef } from 'react'
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

interface SavingsTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

export function SavingsTab({ data, onUpdateData }: SavingsTabProps) {
  // 소득/지출 계산
  const totalIncome = (data.laborIncome || 0) + (data.spouseLaborIncome || 0) +
    (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)
  const livingExpenses = data.livingExpenses || 0
  const monthlySavings = Math.max(0, totalIncome - livingExpenses)
  const savingsRate = totalIncome > 0 ? Math.round((monthlySavings / totalIncome) * 100) : 0

  // 저축/투자 배분
  const cashSavings = data.cashSavingsAccount || 0
  const investStock = (data.investDomesticStock || 0) + (data.investForeignStock || 0)
  const investFund = data.investFund || 0
  const investOther = data.investOther || 0
  const totalInvestment = cashSavings + investStock + investFund + investOther

  // 포트폴리오 차트 데이터
  const portfolioData = {
    labels: ['예적금', '주식', '펀드', '기타'],
    datasets: [{
      data: [cashSavings, investStock, investFund, investOther],
      backgroundColor: ['#34c759', '#007aff', '#5856d6', '#a8a29e'],
      borderWidth: 0,
    }],
  }

  const portfolioOptions = {
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

  // 자산 성장 시뮬레이션
  const years = [0, 5, 10, 15, 20, 25, 30]
  const annualReturn = 0.05 // 5% 수익률
  const annualSavings = monthlySavings * 12

  const projectedAssets = years.map(year => {
    let assets = totalInvestment
    for (let i = 0; i < year; i++) {
      assets = assets * (1 + annualReturn) + annualSavings
    }
    return Math.round(assets)
  })

  const growthData = {
    labels: years.map(y => `${y}년`),
    datasets: [{
      label: '예상 자산',
      data: projectedAssets,
      borderColor: '#007aff',
      backgroundColor: 'rgba(0, 122, 255, 0.1)',
      fill: true,
      tension: 0.4,
    }],
  }

  const growthOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number | null } }) => `${(context.parsed.y ?? 0).toLocaleString()}만원`,
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
        <h3 className={styles.tabInputTitle}>저축/투자 현황</h3>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>월 저축 가능액</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={monthlySavings || ''}
              disabled
              className={styles.inputField}
              style={{ backgroundColor: '#f5f5f4' }}
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
          <p style={{ fontSize: 12, color: '#a8a29e', marginTop: 4 }}>
            수입 - 지출로 자동 계산
          </p>
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

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>주식 투자</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={investStock || ''}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0
                onUpdateData({ investDomesticStock: val })
              }}
              className={styles.inputField}
              placeholder="0"
            />
            <span className={styles.inputUnit}>만원</span>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>펀드/ETF</label>
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
          <label className={styles.inputLabel}>기타 투자</label>
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
        {/* 저축률 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>저축률</h4>
          <div className={styles.gaugeContainer}>
            <span className={styles.gaugeValue} style={{
              color: savingsRate >= 30 ? '#34c759' : savingsRate >= 15 ? '#ff9500' : '#ff3b30'
            }}>
              {savingsRate}%
            </span>
            <span className={styles.gaugeLabel}>
              {savingsRate >= 30 ? '우수' : savingsRate >= 15 ? '보통' : '개선 필요'}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>월 수입</span>
            <span className={styles.statValue}>{totalIncome.toLocaleString()}만원</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>월 지출</span>
            <span className={styles.statValue}>{livingExpenses.toLocaleString()}만원</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>월 저축</span>
            <span className={styles.statValue}>{monthlySavings.toLocaleString()}만원</span>
          </div>
        </div>

        {/* 포트폴리오 배분 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>투자 포트폴리오</h4>
          {totalInvestment > 0 ? (
            <div className={styles.chartWrapper}>
              <Doughnut data={portfolioData} options={portfolioOptions} />
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#a8a29e' }}>
              투자 자산을 입력하면 포트폴리오를 확인할 수 있습니다
            </div>
          )}
        </div>

        {/* 자산 성장 시뮬레이션 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>자산 성장 시뮬레이션 (연 5% 수익률)</h4>
          <div className={styles.chartWrapper}>
            <Line data={growthData} options={growthOptions} />
          </div>
          <div className={styles.statRow} style={{ marginTop: 16 }}>
            <span className={styles.statLabel}>10년 후 예상</span>
            <span className={styles.statValue}>{projectedAssets[2].toLocaleString()}만원</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>20년 후 예상</span>
            <span className={styles.statValue}>{projectedAssets[4].toLocaleString()}만원</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>30년 후 예상</span>
            <span className={styles.statValue}>{projectedAssets[6].toLocaleString()}만원</span>
          </div>
        </div>
      </div>
    </div>
  )
}
