'use client'

import { Input } from '@/components/ui/input'
import { AgeDisplay } from '@/components/ui/age-display'
import type { OnboardingData, FamilyMemberInput } from '@/types'
import styles from '../onboarding.module.css'

interface BasicInfoStepProps {
  data: OnboardingData
  onUpdateBasicInfo: (updates: Partial<OnboardingData>) => void
  onSetMarried: (isMarried: boolean) => void
  onUpdateSpouse: (updates: Partial<FamilyMemberInput>) => void
}

export function BasicInfoStep({ data, onUpdateBasicInfo, onSetMarried, onUpdateSpouse }: BasicInfoStepProps) {
  return (
    <div>
      <h2 className={styles.pageTitle}>기본 정보를 알려주세요</h2>
      <p className={styles.pageDescription}>은퇴 계획의 기초가 되는 정보입니다</p>

      <div className={styles.formSection}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>이름</label>
            <Input
              placeholder="홍길동"
              value={data.name}
              onChange={(e) => onUpdateBasicInfo({ name: e.target.value })}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>생년월일</label>
            <Input
              type="date"
              max="9999-12-31"
              value={data.birth_date}
              onChange={(e) => onUpdateBasicInfo({ birth_date: e.target.value })}
            />
            {data.birth_date && <AgeDisplay birthDate={data.birth_date} />}
          </div>
        </div>

        {/* 결혼 여부 */}
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>결혼 하셨나요?</span>
          <button
            onClick={() => onSetMarried(!data.isMarried)}
            className={`${styles.toggle} ${data.isMarried ? styles.toggleActive : styles.toggleInactive}`}
          >
            <div className={`${styles.toggleKnob} ${data.isMarried ? styles.toggleKnobActive : styles.toggleKnobInactive}`} />
          </button>
        </div>

        {/* 배우자 기본 정보 */}
        {data.isMarried && data.spouse && (
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.labelSmall}>배우자 이름</label>
              <Input
                placeholder="이름"
                value={data.spouse.name}
                onChange={(e) => onUpdateSpouse({ name: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.labelSmall}>배우자 생년월일</label>
              <Input
                type="date"
                max="9999-12-31"
                value={data.spouse.birth_date || ''}
                onChange={(e) => onUpdateSpouse({ birth_date: e.target.value })}
              />
              {data.spouse.birth_date && <AgeDisplay birthDate={data.spouse.birth_date} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
