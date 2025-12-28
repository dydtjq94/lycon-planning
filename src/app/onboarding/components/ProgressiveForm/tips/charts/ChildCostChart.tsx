'use client'

import React from 'react'
import { Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface ChildCostChartProps {
  data: OnboardingData
}

// 색상 (파란 계열)
const colors = ['#1E3A5F', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE']

// 양육비 데이터 (만원 단위)
const sonData = {
  label: '아들 (34세)',
  items: [
    { name: '영유아', cost: 5040 },
    { name: '초등', cost: 5616 },
    { name: '중고등', cost: 6624 },
    { name: '대학', cost: 3552 },
    { name: '용돈', cost: 3960 },
    { name: '결혼', cost: 13900 },
  ],
  total: 38692,
}

const daughterData = {
  label: '딸 (30세)',
  items: [
    { name: '영유아', cost: 5040 },
    { name: '초등', cost: 5616 },
    { name: '중고등', cost: 6624 },
    { name: '대학', cost: 3552 },
    { name: '용돈', cost: 2520 },
    { name: '결혼', cost: 6500 },
  ],
  total: 29852,
}

function formatMoney(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}억`
  }
  return `${Math.round(value / 100) * 100}만`
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
}

export function ChildCostChart({ data }: ChildCostChartProps) {
  const sonChartData = {
    labels: sonData.items.map(i => i.name),
    datasets: [{
      data: sonData.items.map(i => i.cost),
      backgroundColor: colors,
      borderWidth: 0,
    }],
  }

  const daughterChartData = {
    labels: daughterData.items.map(i => i.name),
    datasets: [{
      data: daughterData.items.map(i => i.cost),
      backgroundColor: colors,
      borderWidth: 0,
    }],
  }

  return (
    <div className={styles.dualPieChart}>
      {/* 아들 */}
      <div className={styles.pieSection}>
        <div className={styles.pieChart}>
          <Pie data={sonChartData} options={chartOptions} />
        </div>
        <div className={styles.pieLabel}>아들</div>
        <div className={styles.pieTotal}>{formatMoney(sonData.total)}</div>
      </div>

      {/* 딸 */}
      <div className={styles.pieSection}>
        <div className={styles.pieChart}>
          <Pie data={daughterChartData} options={chartOptions} />
        </div>
        <div className={styles.pieLabel}>딸</div>
        <div className={styles.pieTotal}>{formatMoney(daughterData.total)}</div>
      </div>

      {/* 범례 */}
      <div className={styles.pieLegend}>
        {sonData.items.map((item, i) => (
          <div key={i} className={styles.pieLegendItem}>
            <span className={styles.pieLegendDot} style={{ backgroundColor: colors[i] }} />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
