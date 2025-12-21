'use client'

import { Card, CardContent } from '@/components/ui/card'

interface SummaryCardsProps {
  totalAssets: number
  totalDebts: number
  netWorth: number
  monthlyIncome: number
  monthlyExpense: number
  monthlySavings: number
}

const formatAmount = (amount: number) => {
  const absAmount = Math.abs(amount)
  if (absAmount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`
  }
  if (absAmount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만원`
  }
  return `${amount.toLocaleString()}원`
}

export function SummaryCards({
  totalAssets,
  totalDebts,
  netWorth,
  monthlyIncome,
  monthlyExpense,
  monthlySavings,
}: SummaryCardsProps) {
  const cards = [
    { label: '총 자산', value: totalAssets, color: 'text-blue-600' },
    { label: '총 부채', value: totalDebts, color: 'text-red-600' },
    { label: '순자산', value: netWorth, color: netWorth >= 0 ? 'text-green-600' : 'text-red-600' },
    { label: '월 수입', value: monthlyIncome, color: 'text-green-600' },
    { label: '월 지출', value: monthlyExpense, color: 'text-orange-600' },
    { label: '월 저축', value: monthlySavings, color: monthlySavings >= 0 ? 'text-blue-600' : 'text-red-600' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">{card.label}</div>
            <div className={`text-xl font-bold ${card.color}`}>
              {formatAmount(card.value)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
