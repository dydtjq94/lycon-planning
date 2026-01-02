'use client'

import { useRef, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import type { SimulationResult } from '@/lib/services/simulationEngine'
import styles from './CashFlowChart.module.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  annotationPlugin
)

interface CashFlowChartProps {
  simulationResult: SimulationResult
  endYear: number
  retirementYear: number
  onYearClick?: (year: number) => void
  selectedYear?: number | null
}

// 금액 포맷팅 (억/만 단위)
function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    const uk = amount / 10000
    return `${uk.toFixed(1).replace(/\.0$/, '')}억`
  }
  return `${amount.toLocaleString()}만`
}

export function CashFlowChart({
  simulationResult,
  endYear,
  retirementYear,
  onYearClick,
  selectedYear,
}: CashFlowChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<ChartJS | null>(null)

  const { snapshots } = simulationResult
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (!chartRef.current || snapshots.length === 0) return

    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    // 연도 레이블 (5년 단위로 표시하되 데이터는 전체)
    const labels = snapshots.map(s => s.year)
    const incomeData = snapshots.map(s => s.totalIncome)
    const expenseData = snapshots.map(s => s.totalExpense)
    const netCashFlowData = snapshots.map(s => s.netCashFlow)

    // 은퇴 연도 인덱스
    const retirementIndex = labels.findIndex(y => y === retirementYear)

    chartInstance.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: '수입',
            data: incomeData,
            backgroundColor: snapshots.map((s, i) =>
              selectedYear === s.year ? 'rgba(59, 130, 246, 1)' : 'rgba(59, 130, 246, 0.7)'
            ),
            borderRadius: 2,
            barPercentage: 0.8,
            categoryPercentage: 0.85,
            order: 2,
          },
          {
            type: 'bar',
            label: '지출',
            data: expenseData,
            backgroundColor: snapshots.map((s, i) =>
              selectedYear === s.year ? 'rgba(249, 115, 22, 1)' : 'rgba(249, 115, 22, 0.7)'
            ),
            borderRadius: 2,
            barPercentage: 0.8,
            categoryPercentage: 0.85,
            order: 2,
          },
          {
            type: 'line',
            label: '순현금흐름',
            data: netCashFlowData,
            borderColor: '#22c55e',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.3,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        onClick: (event, elements) => {
          if (elements.length > 0 && onYearClick) {
            const index = elements[0].index
            onYearClick(labels[index])
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              padding: 16,
              font: { size: 11 },
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#1e293b',
            bodyColor: '#64748b',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              title: (items) => {
                const year = items[0].label
                const snapshot = snapshots.find(s => s.year === Number(year))
                return snapshot ? `${year}년 (${snapshot.age}세)` : `${year}년`
              },
              label: (context) => {
                const value = context.raw as number
                return ` ${context.dataset.label}: ${formatMoney(value)}`
              },
            },
          },
          annotation: {
            annotations: {
              retirementLine: {
                type: 'line',
                xMin: retirementIndex,
                xMax: retirementIndex,
                borderColor: 'rgba(239, 68, 68, 0.6)',
                borderWidth: 2,
                borderDash: [6, 4],
                label: {
                  display: true,
                  content: '은퇴',
                  position: 'start',
                  backgroundColor: 'rgba(239, 68, 68, 0.8)',
                  color: 'white',
                  font: { size: 10, weight: 'bold' },
                  padding: 4,
                },
              },
              zeroLine: {
                type: 'line',
                yMin: 0,
                yMax: 0,
                borderColor: 'rgba(148, 163, 184, 0.5)',
                borderWidth: 1,
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              color: '#94a3b8',
              maxRotation: 0,
              callback: function(value, index) {
                const year = labels[index]
                // 5년 단위 또는 현재 연도, 은퇴 연도만 표시
                if (year === currentYear || year === retirementYear || year % 5 === 0) {
                  return year
                }
                return ''
              },
            },
          },
          y: {
            grid: {
              color: 'rgba(226, 232, 240, 0.5)',
            },
            ticks: {
              font: { size: 10 },
              color: '#94a3b8',
              callback: function(value) {
                return formatMoney(Number(value))
              },
            },
          },
        },
      },
    })

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [snapshots, retirementYear, selectedYear, onYearClick, currentYear])

  if (snapshots.length === 0) {
    return (
      <div className={styles.emptyState}>
        데이터를 입력하면 현금흐름 시뮬레이션을 확인할 수 있습니다
      </div>
    )
  }

  return (
    <div className={styles.chartWrapper}>
      <canvas ref={chartRef} />
    </div>
  )
}
