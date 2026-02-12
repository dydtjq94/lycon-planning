'use client'

import { useState } from 'react'
import type { ProfileBasics } from '@/contexts/FinancialContext'
import type { LifeCycleSettings, SimFamilyMember } from '@/types'
import styles from './LifeCyclePanel.module.css'

interface LifeCyclePanelProps {
  profile: ProfileBasics
  spouseMember?: SimFamilyMember
  lifeCycleSettings: LifeCycleSettings
  onLifeCycleChange: (settings: LifeCycleSettings) => void
}

function getAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  return new Date().getFullYear() - parseInt(birthDate.split('-')[0])
}

export function LifeCyclePanel({
  profile,
  spouseMember,
  lifeCycleSettings,
  onLifeCycleChange,
}: LifeCyclePanelProps) {
  const [selfRetirement, setSelfRetirement] = useState(lifeCycleSettings.selfRetirementAge)
  const [selfLife, setSelfLife] = useState(lifeCycleSettings.selfLifeExpectancy)
  const [spouseRetirement, setSpouseRetirement] = useState(lifeCycleSettings.spouseRetirementAge ?? 65)
  const [spouseLife, setSpouseLife] = useState(lifeCycleSettings.spouseLifeExpectancy ?? lifeCycleSettings.selfLifeExpectancy)

  const selfAge = getAge(profile.birth_date)
  const spouseAge = spouseMember?.birth_date ? getAge(spouseMember.birth_date) : null

  const saveSelfRetirement = () => {
    onLifeCycleChange({ ...lifeCycleSettings, selfRetirementAge: selfRetirement })
  }

  const saveSelfLife = () => {
    onLifeCycleChange({ ...lifeCycleSettings, selfLifeExpectancy: selfLife })
  }

  const saveSpouseRetirement = () => {
    onLifeCycleChange({ ...lifeCycleSettings, spouseRetirementAge: spouseRetirement })
  }

  const saveSpouseLife = () => {
    onLifeCycleChange({ ...lifeCycleSettings, spouseLifeExpectancy: spouseLife })
  }

  const handleBlur = (saveFn: () => void) => saveFn()
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }
  const preventScroll = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur()

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>생애 주기</span>
      </div>

      {/* 본인 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {profile.name} {selfAge !== null ? `(${selfAge}세)` : ''}
        </div>
        <div className={styles.row}>
          <span className={styles.label}>은퇴 나이</span>
          <div className={styles.inputGroup}>
            <input
              type="number"
              value={selfRetirement}
              onChange={(e) => setSelfRetirement(Number(e.target.value))}
              onBlur={() => handleBlur(saveSelfRetirement)}
              onKeyDown={handleKey}
              onWheel={preventScroll}
              className={styles.input}
            />
            <span className={styles.unit}>세</span>
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>기대 수명</span>
          <div className={styles.inputGroup}>
            <input
              type="number"
              value={selfLife}
              onChange={(e) => setSelfLife(Number(e.target.value))}
              onBlur={() => handleBlur(saveSelfLife)}
              onKeyDown={handleKey}
              onWheel={preventScroll}
              className={styles.input}
            />
            <span className={styles.unit}>세</span>
          </div>
        </div>
      </div>

      {/* 배우자 */}
      {spouseMember && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {spouseMember.name} {spouseAge !== null ? `(${spouseAge}세)` : ''}
            </div>
            <div className={styles.row}>
              <span className={styles.label}>은퇴 나이</span>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  value={spouseRetirement}
                  onChange={(e) => setSpouseRetirement(Number(e.target.value))}
                  onBlur={() => handleBlur(saveSpouseRetirement)}
                  onKeyDown={handleKey}
                  onWheel={preventScroll}
                  className={styles.input}
                />
                <span className={styles.unit}>세</span>
              </div>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>기대 수명</span>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  value={spouseLife}
                  onChange={(e) => setSpouseLife(Number(e.target.value))}
                  onBlur={() => handleBlur(saveSpouseLife)}
                  onKeyDown={handleKey}
                  onWheel={preventScroll}
                  className={styles.input}
                />
                <span className={styles.unit}>세</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
