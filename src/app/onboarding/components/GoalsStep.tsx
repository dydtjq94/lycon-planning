'use client'

import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { calculateInternationalAge } from '@/components/ui/age-display'
import type { OnboardingData } from '@/types'
import styles from '../onboarding.module.css'

interface GoalsStepProps {
  data: OnboardingData
  onUpdateBasicInfo: (updates: Partial<OnboardingData>) => void
}

export function GoalsStep({ data, onUpdateBasicInfo }: GoalsStepProps) {
  return (
    <div>
      <h2 className={styles.pageTitle}>은퇴 목표를 설정해주세요</h2>
      <p className={styles.pageDescription}>마지막으로 은퇴 목표를 설정합니다</p>

      <div className={styles.formSection}>
        <div className={styles.formGroup}>
          <label className={styles.label}>목표 은퇴 나이</label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="60"
            value={data.target_retirement_age || ''}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '')
              onUpdateBasicInfo({ target_retirement_age: parseInt(value) || 0 })
            }}
          />
          {data.birth_date && data.target_retirement_age > 0 && (
            <p className={styles.retirementInfo}>
              은퇴까지 {data.target_retirement_age - calculateInternationalAge(data.birth_date)}년 남음
            </p>
          )}
        </div>
        <MoneyInput
          label="목표 은퇴 자금"
          value={data.target_retirement_fund}
          onChange={(value) => onUpdateBasicInfo({ target_retirement_fund: value ?? 0 })}
          placeholder="100000"
        />
      </div>
    </div>
  )
}
