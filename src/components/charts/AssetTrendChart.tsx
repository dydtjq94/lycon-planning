'use client'

import { Line } from './ChartWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SimulationDataPoint } from '@/types'

interface AssetTrendChartProps {
  data: SimulationDataPoint[]
  retirementAge: number
  currentAge: number
}

export function AssetTrendChart({ data, retirementAge, currentAge }: AssetTrendChartProps) {
  const retirementIndex = data.findIndex(d => d.age === retirementAge)

  const chartData = {
    labels: data.map(d => `${d.age}세`),
    datasets: [
      {
        label: '예상 자산',
        data: data.map(d => d.assets),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1d1d1f',
        bodyColor: '#1d1d1f',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        callbacks: {
          label: (context: { parsed: { y: number } }) => {
            const value = context.parsed.y
            if (value >= 100000000) {
              return `${(value / 100000000).toFixed(1)}억원`
            }
            return `${(value / 10000).toFixed(0)}만원`
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value: number | string) => {
            const numValue = typeof value === 'string' ? parseFloat(value) : value
            if (numValue >= 100000000) {
              return `${(numValue / 100000000).toFixed(0)}억`
            }
            return `${(numValue / 10000).toFixed(0)}만`
          },
        },
      },
    },
    annotation: retirementIndex >= 0 ? {
      annotations: {
        retirement: {
          type: 'line',
          xMin: retirementIndex,
          xMax: retirementIndex,
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 2,
          borderDash: [6, 6],
          label: {
            display: true,
            content: '은퇴',
            position: 'start',
          },
        },
      },
    } : undefined,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">자산 추이 예측</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Line data={chartData} options={options as never} />
        </div>
        <div className="mt-2 text-sm text-gray-500 text-center">
          현재 {currentAge}세 → 은퇴 {retirementAge}세
        </div>
      </CardContent>
    </Card>
  )
}
