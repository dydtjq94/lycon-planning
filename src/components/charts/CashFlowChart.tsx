'use client'

import { Bar } from './ChartWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CashFlowChartProps {
  income: number
  expense: number
}

export function CashFlowChart({ income, expense }: CashFlowChartProps) {
  const savings = income - expense

  const chartData = {
    labels: ['수입', '지출', '저축'],
    datasets: [
      {
        data: [income, expense, savings],
        backgroundColor: [
          'rgb(16, 185, 129)',
          'rgb(239, 68, 68)',
          savings >= 0 ? 'rgb(59, 130, 246)' : 'rgb(239, 68, 68)',
        ],
        borderRadius: 8,
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
        callbacks: {
          label: (context: { parsed: { y: number } }) => {
            const value = context.parsed.y
            return `${value.toLocaleString()}원`
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => {
            const numValue = typeof value === 'string' ? parseFloat(value) : value
            return `${(numValue / 10000).toFixed(0)}만`
          },
        },
      },
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">월 현금흐름</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Bar data={chartData} options={options as never} />
        </div>
        <div className="mt-2 text-sm text-center">
          <span className={savings >= 0 ? 'text-blue-600' : 'text-red-600'}>
            월 저축: {savings.toLocaleString()}원
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
