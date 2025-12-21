'use client'

import { Doughnut } from './ChartWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AssetCompositionChartProps {
  data: {
    realEstate: number
    assets: number
    pension: number
  }
}

const COLORS = {
  realEstate: 'rgb(59, 130, 246)',
  assets: 'rgb(16, 185, 129)',
  pension: 'rgb(249, 115, 22)',
}

export function AssetCompositionChart({ data }: AssetCompositionChartProps) {
  const total = data.realEstate + data.assets + data.pension

  const chartData = {
    labels: ['부동산', '금융자산', '연금'],
    datasets: [
      {
        data: [data.realEstate, data.assets, data.pension],
        backgroundColor: [COLORS.realEstate, COLORS.assets, COLORS.pension],
        borderWidth: 0,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: { label: string; parsed: number }) => {
            const value = context.parsed
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
            if (value >= 100000000) {
              return `${context.label}: ${(value / 100000000).toFixed(1)}억원 (${percentage}%)`
            }
            return `${context.label}: ${(value / 10000).toFixed(0)}만원 (${percentage}%)`
          },
        },
      },
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">자산 구성</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Doughnut data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  )
}
