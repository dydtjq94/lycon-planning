'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface StepBasicInfoProps {
  data: {
    name: string
    birth_year: number
    target_retirement_age: number
    target_retirement_fund: number
  }
  onChange: (data: Partial<StepBasicInfoProps['data']>) => void
}

export function StepBasicInfo({ data, onChange }: StepBasicInfoProps) {
  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">기본 정보</h2>
        <p className="text-muted-foreground mt-2">은퇴 계획을 위한 기본 정보를 입력해주세요</p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground font-medium">이름</Label>
          <Input
            id="name"
            placeholder="홍길동"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth_year" className="text-foreground font-medium">출생년도</Label>
          <Input
            id="birth_year"
            type="number"
            placeholder="1990"
            min={1940}
            max={currentYear - 18}
            value={data.birth_year || ''}
            onChange={(e) => onChange({ birth_year: parseInt(e.target.value) || 0 })}
            className="h-11"
          />
          {data.birth_year > 0 && (
            <p className="text-sm text-muted-foreground">
              현재 나이: <span className="font-medium text-foreground">{currentYear - data.birth_year}세</span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="target_retirement_age" className="text-foreground font-medium">목표 은퇴 나이</Label>
          <Input
            id="target_retirement_age"
            type="number"
            placeholder="60"
            min={40}
            max={80}
            value={data.target_retirement_age || ''}
            onChange={(e) => onChange({ target_retirement_age: parseInt(e.target.value) || 0 })}
            className="h-11"
          />
          {data.birth_year > 0 && data.target_retirement_age > 0 && (
            <p className="text-sm text-muted-foreground">
              은퇴까지 <span className="font-medium text-primary">{data.target_retirement_age - (currentYear - data.birth_year)}년</span> 남음
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="target_retirement_fund" className="text-foreground font-medium">목표 은퇴 자금 (원)</Label>
          <Input
            id="target_retirement_fund"
            type="number"
            placeholder="1000000000"
            min={0}
            value={data.target_retirement_fund || ''}
            onChange={(e) => onChange({ target_retirement_fund: parseInt(e.target.value) || 0 })}
            className="h-11"
          />
          {data.target_retirement_fund > 0 && (
            <p className="text-sm text-muted-foreground">
              목표 금액: <span className="font-medium text-primary">{(data.target_retirement_fund / 100000000).toFixed(1)}억원</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
