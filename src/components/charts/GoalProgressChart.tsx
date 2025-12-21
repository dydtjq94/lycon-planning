'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface GoalProgressChartProps {
  currentNetWorth: number
  targetFund: number
}

export function GoalProgressChart({ currentNetWorth, targetFund }: GoalProgressChartProps) {
  const progress = targetFund > 0 ? Math.min((currentNetWorth / targetFund) * 100, 100) : 0
  const remaining = targetFund - currentNetWorth

  const formatAmount = (amount: number) => {
    if (Math.abs(amount) >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억원`
    }
    return `${(amount / 10000).toFixed(0)}만원`
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500'
    if (progress >= 50) return 'bg-blue-500'
    if (progress >= 25) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">목표 달성률</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative pt-4">
            <div className="text-center mb-4">
              <span className="text-4xl font-bold">{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} className="h-4" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-gray-500">현재 순자산</div>
              <div className="font-semibold text-lg">{formatAmount(currentNetWorth)}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-gray-500">목표 은퇴자금</div>
              <div className="font-semibold text-lg">{formatAmount(targetFund)}</div>
            </div>
          </div>

          {remaining > 0 && (
            <div className="text-center text-sm text-gray-600">
              목표까지 <span className="font-semibold text-blue-600">{formatAmount(remaining)}</span> 남음
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
