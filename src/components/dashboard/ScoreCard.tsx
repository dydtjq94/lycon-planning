'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getScoreGrade } from '@/lib/calculations/scoring'
import type { Scores } from '@/types'

interface ScoreCardProps {
  scores: Scores
}

const scoreLabels: Record<keyof Scores, string> = {
  overall: '전체',
  income: '수입',
  expense: '지출',
  asset: '자산',
  debt: '부채',
  pension: '연금',
}

export function ScoreCard({ scores }: ScoreCardProps) {
  const overallGrade = getScoreGrade(scores.overall)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">은퇴 준비 스코어</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-6">
          <div className={`text-6xl font-bold ${overallGrade.color}`}>
            {overallGrade.grade}
          </div>
          <div className="text-3xl font-semibold mt-2">
            {scores.overall}점
          </div>
          <div className="text-gray-500 mt-1">{overallGrade.description}</div>
        </div>

        <div className="space-y-3">
          {(Object.keys(scores) as (keyof Scores)[])
            .filter((key) => key !== 'overall')
            .map((key) => {
              const grade = getScoreGrade(scores[key])
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-600">{scoreLabels[key]}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${scores[key]}%` }}
                      />
                    </div>
                    <span className={`font-semibold w-12 text-right ${grade.color}`}>
                      {scores[key]}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>
      </CardContent>
    </Card>
  )
}
