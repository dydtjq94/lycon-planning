'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

interface RetirementGoalChartProps {
  data: OnboardingData
}

// 목표 금액 기준점 (만원)
const assetPoints = [0, 50000, 100000, 150000, 200000, 300000, 400000, 500000]
const assetLabels = ['0', '5억', '10억', '15억', '20억', '30억', '40억', '50억']

// 월 생활비 계산 (연 4% 수익률 기준)
const calcMonthly = (asset: number) => Math.round((asset * 0.04) / 12)

export function RetirementGoalChart({ data }: RetirementGoalChartProps) {
  const targetAsset = data.target_retirement_fund || 0
  const [debouncedTarget, setDebouncedTarget] = useState(targetAsset)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedTarget(targetAsset), 1500)
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [targetAsset])

  const userMonthly = calcMonthly(debouncedTarget)

  // 차트 데이터
  const chartData = {
    labels: assetLabels,
    datasets: [
      {
        data: assetPoints.map(calcMonthly),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  }

  // 목표 금액 포맷팅
  const formatAsset = (val: number) => {
    if (val >= 10000) return `${(val / 10000).toFixed(val % 10000 === 0 ? 0 : 1)}억`
    return `${val.toLocaleString()}만원`
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          color: '#A8A29E',
        },
        border: { display: false },
      },
      y: {
        min: 0,
        max: 1800,
        grid: {
          color: '#F5F5F4',
        },
        ticks: {
          font: { size: 10 },
          color: '#A8A29E',
          callback: (value: number | string) => `${value}만`,
          stepSize: 300,
        },
        border: { display: false },
      },
    },
  }

  if (debouncedTarget === 0) {
    return (
      <div className={styles.goalLineChart}>
        <div className={styles.goalLinePlaceholder}>
          목표 자산을 입력하면<br />
          은퇴 후 월 생활비를 알려드려요
        </div>
      </div>
    )
  }

  return (
    <div className={styles.goalLineChart}>
      <div className={styles.goalLineHeader}>
        <span className={styles.goalLineAmount}>{userMonthly}</span>
        <span className={styles.goalLineUnit}>만원/월</span>
      </div>

      <div className={styles.goalLineBody}>
        <Line data={chartData} options={options} />
      </div>

      <div className={styles.goalLineFooter}>
        <span>연 4% 인출률 기준</span>
      </div>
    </div>
  )
}
