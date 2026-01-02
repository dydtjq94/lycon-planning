'use client'

import { useMemo, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import { Bar } from 'react-chartjs-2'
import type { ChartOptions, ChartData } from 'chart.js'
import type { SimulationResult } from '@/lib/services/simulationEngine'
import {
  transformSimulationToChartData,
  formatChartValue,
  formatTooltipValue,
  ASSET_COLORS,
} from '@/lib/utils/chartDataTransformer'
import styles from './AssetStackChart.module.css'

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
)

interface AssetStackChartProps {
  simulationResult: SimulationResult
  endYear?: number
  retirementYear?: number
  onYearClick?: (year: number) => void
  selectedYear?: number | null
}

export function AssetStackChart({
  simulationResult,
  endYear,
  retirementYear,
  onYearClick,
  selectedYear,
}: AssetStackChartProps) {
  const chartRef = useRef<ChartJS<'bar'>>(null)

  // 차트 데이터 변환
  const chartData = useMemo(() => {
    return transformSimulationToChartData(simulationResult, { endYear })
  }, [simulationResult, endYear])

  // 은퇴 연도 인덱스 계산
  const retirementIndex = useMemo(() => {
    if (!retirementYear) return null
    return chartData.labels.findIndex(label => parseInt(label) === retirementYear)
  }, [chartData.labels, retirementYear])

  // Chart.js 데이터 형식
  const data: ChartData<'bar'> = useMemo(() => ({
    labels: chartData.labels,
    datasets: chartData.datasets.map(ds => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.backgroundColor,
      borderWidth: 0,
      borderRadius: 2,
      stack: ds.stack,
    })),
  }), [chartData])

  // Chart.js 옵션
  const options: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    onClick: (_event, elements) => {
      if (elements.length > 0 && onYearClick) {
        const index = elements[0].index
        const year = parseInt(chartData.labels[index])
        onYearClick(year)
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 15,
          font: {
            size: 11,
          },
          color: '#64748b',
        },
        border: {
          display: false,
        },
      },
      y: {
        stacked: true,
        grid: {
          color: '#e2e8f0',
        },
        ticks: {
          callback: (value) => formatChartValue(value as number),
          font: {
            size: 11,
          },
          color: '#64748b',
        },
        border: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false, // 커스텀 범례 사용
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        boxWidth: 12,
        boxHeight: 12,
        boxPadding: 4,
        callbacks: {
          title: (items) => {
            const year = items[0].label
            const snapshot = chartData.snapshots.find(s => String(s.year) === year)
            return snapshot ? `${year}년 (${snapshot.age}세)` : `${year}년`
          },
          label: (item) => {
            const value = item.raw as number
            return ` ${item.dataset.label}: ${formatTooltipValue(value)}`
          },
          footer: (items) => {
            const year = items[0].label
            const snapshot = chartData.snapshots.find(s => String(s.year) === year)
            if (snapshot) {
              return `\n순자산: ${formatTooltipValue(snapshot.netWorth)}`
            }
            return ''
          },
        },
      },
      annotation: {
        annotations: retirementIndex !== null && retirementIndex >= 0 ? {
          retirementLine: {
            type: 'line' as const,
            xMin: retirementIndex,
            xMax: retirementIndex,
            borderColor: '#f97316',
            borderWidth: 2,
            borderDash: [6, 4],
            label: {
              display: true,
              content: '은퇴',
              position: 'start' as const,
              backgroundColor: '#f97316',
              color: '#fff',
              font: {
                size: 11,
                weight: 'bold' as const,
              },
              padding: { x: 6, y: 4 },
              borderRadius: 4,
            },
          },
        } : {},
      },
    },
  }), [chartData, onYearClick, retirementIndex])

  return (
    <div className={styles.container}>
      {/* 범례 */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: ASSET_COLORS.financialAssets }} />
          <span className={styles.legendLabel}>금융자산</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: ASSET_COLORS.realEstate }} />
          <span className={styles.legendLabel}>부동산</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: ASSET_COLORS.pension }} />
          <span className={styles.legendLabel}>연금</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: ASSET_COLORS.debt }} />
          <span className={styles.legendLabel}>부채</span>
        </div>
      </div>

      {/* 차트 */}
      <div className={styles.chartWrapper}>
        <Bar ref={chartRef} data={data} options={options} />
      </div>

      {/* 클릭 안내 */}
      <p className={styles.hint}>
        막대를 클릭하면 해당 연도의 상세 정보를 볼 수 있습니다
      </p>
    </div>
  )
}
