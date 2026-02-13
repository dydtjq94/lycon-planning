'use client'

import { useState, useRef, useEffect } from 'react'
import type { ProfileBasics } from '@/contexts/FinancialContext'
import type { LifeCycleSettings, SimFamilyMember } from '@/types'
import {
  LIFECYCLE_ICONS,
  LIFECYCLE_COLORS,
  LIFECYCLE_DEFAULTS,
  getLifecycleIcon,
} from '@/lib/constants/lifecycle'
import { useChartTheme } from '@/hooks/useChartTheme'
import styles from './LifeCyclePanel.module.css'

interface LifeCyclePanelProps {
  profile: ProfileBasics
  spouseMember?: SimFamilyMember
  lifeCycleSettings: LifeCycleSettings
  onLifeCycleChange: (settings: LifeCycleSettings) => void
}

type PickerTarget = 'retirement' | 'lifeExpectancy' | 'spouseRetirement' | 'spouseLifeExpectancy' | null

function getAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  return new Date().getFullYear() - parseInt(birthDate.split('-')[0])
}

function getBirthYear(birthDate: string | null): number | null {
  if (!birthDate) return null
  return parseInt(birthDate.split('-')[0])
}

function ageToYear(birthYear: number | null, age: number): string {
  if (birthYear === null) return ''
  return String(birthYear + age)
}

export function LifeCyclePanel({
  profile,
  spouseMember,
  lifeCycleSettings,
  onLifeCycleChange,
}: LifeCyclePanelProps) {
  const { isDark } = useChartTheme()
  const [isDirty, setIsDirty] = useState(false)
  // 문자열 기반 로컬 state (자유 입력 → blur 시 저장)
  const [selfRetirement, setSelfRetirement] = useState(String(lifeCycleSettings.selfRetirementAge))
  const [selfLife, setSelfLife] = useState(String(lifeCycleSettings.selfLifeExpectancy))
  const [spouseRetirement, setSpouseRetirement] = useState(String(lifeCycleSettings.spouseRetirementAge ?? 65))
  const [spouseLife, setSpouseLife] = useState(String(lifeCycleSettings.spouseLifeExpectancy ?? lifeCycleSettings.selfLifeExpectancy))

  // 본인 아이콘/색상 로컬 state
  const [retirementIcon, setRetirementIcon] = useState(lifeCycleSettings.retirementIcon ?? LIFECYCLE_DEFAULTS.retirement.icon)
  const [retirementColor, setRetirementColor] = useState(lifeCycleSettings.retirementColor ?? LIFECYCLE_DEFAULTS.retirement.color)
  const [lifeIcon, setLifeIcon] = useState(lifeCycleSettings.lifeExpectancyIcon ?? LIFECYCLE_DEFAULTS.lifeExpectancy.icon)
  const [lifeColor, setLifeColor] = useState(lifeCycleSettings.lifeExpectancyColor ?? LIFECYCLE_DEFAULTS.lifeExpectancy.color)

  // 배우자 아이콘/색상 로컬 state
  const [spRetirementIcon, setSpRetirementIcon] = useState(lifeCycleSettings.spouseRetirementIcon ?? LIFECYCLE_DEFAULTS.spouseRetirement.icon)
  const [spRetirementColor, setSpRetirementColor] = useState(lifeCycleSettings.spouseRetirementColor ?? LIFECYCLE_DEFAULTS.spouseRetirement.color)
  const [spLifeIcon, setSpLifeIcon] = useState(lifeCycleSettings.spouseLifeExpectancyIcon ?? LIFECYCLE_DEFAULTS.spouseLifeExpectancy.icon)
  const [spLifeColor, setSpLifeColor] = useState(lifeCycleSettings.spouseLifeExpectancyColor ?? LIFECYCLE_DEFAULTS.spouseLifeExpectancy.color)

  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const selfAge = getAge(profile.birth_date)
  const selfBirthYear = getBirthYear(profile.birth_date)
  const spouseAge = spouseMember?.birth_date ? getAge(spouseMember.birth_date) : null
  const spouseBirthYear = spouseMember?.birth_date ? getBirthYear(spouseMember.birth_date) : null

  // Close picker on outside click
  useEffect(() => {
    if (!pickerTarget) return
    const handleClick = (e: MouseEvent) => {
      const isInsidePicker = pickerRef.current?.contains(e.target as Node)
      const isInsideBtn = Object.values(btnRefs.current).some(
        btn => btn?.contains(e.target as Node)
      )
      if (!isInsidePicker && !isInsideBtn) {
        setPickerTarget(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerTarget])

  // Close picker on ESC
  useEffect(() => {
    if (!pickerTarget) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerTarget(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [pickerTarget])

  const parseAge = (raw: string, fallback: number): number => {
    const parsed = parseInt(raw)
    return isNaN(parsed) ? fallback : parsed
  }

  const handleAgeBlur = (
    key: 'selfRetirementAge' | 'selfLifeExpectancy' | 'spouseRetirementAge' | 'spouseLifeExpectancy',
    raw: string,
    fallback: number,
    setter: (v: string) => void
  ) => {
    const value = parseAge(raw, fallback)
    setter(String(value))
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }
  const preventScroll = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur()

  const handleIconChange = (iconId: string) => {
    if (pickerTarget === 'retirement') {
      setRetirementIcon(iconId)
    } else if (pickerTarget === 'lifeExpectancy') {
      setLifeIcon(iconId)
    } else if (pickerTarget === 'spouseRetirement') {
      setSpRetirementIcon(iconId)
    } else if (pickerTarget === 'spouseLifeExpectancy') {
      setSpLifeIcon(iconId)
    }
    setIsDirty(true)
  }

  const handleColorChange = (color: string) => {
    if (pickerTarget === 'retirement') {
      setRetirementColor(color)
    } else if (pickerTarget === 'lifeExpectancy') {
      setLifeColor(color)
    } else if (pickerTarget === 'spouseRetirement') {
      setSpRetirementColor(color)
    } else if (pickerTarget === 'spouseLifeExpectancy') {
      setSpLifeColor(color)
    }
    setIsDirty(true)
  }

  // 현재 피커 대상의 아이콘/색상
  const getCurrentPickerValues = () => {
    switch (pickerTarget) {
      case 'retirement': return { icon: retirementIcon, color: retirementColor }
      case 'lifeExpectancy': return { icon: lifeIcon, color: lifeColor }
      case 'spouseRetirement': return { icon: spRetirementIcon, color: spRetirementColor }
      case 'spouseLifeExpectancy': return { icon: spLifeIcon, color: spLifeColor }
      default: return { icon: '', color: '' }
    }
  }
  const { icon: currentPickerIcon, color: currentPickerColor } = getCurrentPickerValues()

  const RetirementIcon = getLifecycleIcon(retirementIcon)
  const LifeIcon = getLifecycleIcon(lifeIcon)
  const SpRetirementIcon = getLifecycleIcon(spRetirementIcon)
  const SpLifeIcon = getLifecycleIcon(spLifeIcon)

  const togglePicker = (target: NonNullable<PickerTarget>) => {
    setPickerTarget(pickerTarget === target ? null : target)
  }

  const handleSave = () => {
    onLifeCycleChange({
      ...lifeCycleSettings,
      selfRetirementAge: parseAge(selfRetirement, lifeCycleSettings.selfRetirementAge),
      selfLifeExpectancy: parseAge(selfLife, lifeCycleSettings.selfLifeExpectancy),
      spouseRetirementAge: parseAge(spouseRetirement, lifeCycleSettings.spouseRetirementAge ?? 65),
      spouseLifeExpectancy: parseAge(spouseLife, lifeCycleSettings.spouseLifeExpectancy ?? lifeCycleSettings.selfLifeExpectancy),
      retirementIcon,
      lifeExpectancyIcon: lifeIcon,
      retirementColor,
      lifeExpectancyColor: lifeColor,
      spouseRetirementIcon: spRetirementIcon,
      spouseLifeExpectancyIcon: spLifeIcon,
      spouseRetirementColor: spRetirementColor,
      spouseLifeExpectancyColor: spLifeColor,
    })
    setIsDirty(false)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>생애 주기</span>
        <button
          type="button"
          className={`${styles.saveButton}${!isDirty ? ` ${styles.saveButtonDisabled}` : ''}`}
          onClick={handleSave}
          disabled={!isDirty}
        >
          저장
        </button>
      </div>

      {/* 본인 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {profile.name} {selfAge !== null ? `(${selfAge}세)` : ''}
        </div>
        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <button
              ref={el => { btnRefs.current['retirement'] = el }}
              className={styles.iconBtn}
              style={{ color: retirementColor }}
              onClick={() => togglePicker('retirement')}
            >
              <RetirementIcon size={14} />
            </button>
            <span className={styles.label}>은퇴 나이</span>
          </div>
          <div className={styles.inputGroup}>
            <input
              type="number"
              value={selfRetirement}
              onChange={(e) => { setSelfRetirement(e.target.value); setIsDirty(true); }}
              onBlur={() => handleAgeBlur('selfRetirementAge', selfRetirement, lifeCycleSettings.selfRetirementAge, setSelfRetirement)}
              onKeyDown={handleKey}
              onWheel={preventScroll}
              className={styles.input}
            />
            <span className={styles.unit}>세</span>
            <span className={styles.yearHint}>{ageToYear(selfBirthYear, parseAge(selfRetirement, lifeCycleSettings.selfRetirementAge))}년</span>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <button
              ref={el => { btnRefs.current['lifeExpectancy'] = el }}
              className={styles.iconBtn}
              style={{ color: lifeColor }}
              onClick={() => togglePicker('lifeExpectancy')}
            >
              <LifeIcon size={14} />
            </button>
            <span className={styles.label}>기대 수명</span>
          </div>
          <div className={styles.inputGroup}>
            <input
              type="number"
              value={selfLife}
              onChange={(e) => { setSelfLife(e.target.value); setIsDirty(true); }}
              onBlur={() => handleAgeBlur('selfLifeExpectancy', selfLife, lifeCycleSettings.selfLifeExpectancy, setSelfLife)}
              onKeyDown={handleKey}
              onWheel={preventScroll}
              className={styles.input}
            />
            <span className={styles.unit}>세</span>
            <span className={styles.yearHint}>{ageToYear(selfBirthYear, parseAge(selfLife, lifeCycleSettings.selfLifeExpectancy))}년</span>
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
              <div className={styles.labelGroup}>
                <button
                  ref={el => { btnRefs.current['spouseRetirement'] = el }}
                  className={styles.iconBtn}
                  style={{ color: spRetirementColor }}
                  onClick={() => togglePicker('spouseRetirement')}
                >
                  <SpRetirementIcon size={14} />
                </button>
                <span className={styles.label}>은퇴 나이</span>
              </div>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  value={spouseRetirement}
                  onChange={(e) => { setSpouseRetirement(e.target.value); setIsDirty(true); }}
                  onBlur={() => handleAgeBlur('spouseRetirementAge', spouseRetirement, lifeCycleSettings.spouseRetirementAge ?? 65, setSpouseRetirement)}
                  onKeyDown={handleKey}
                  onWheel={preventScroll}
                  className={styles.input}
                />
                <span className={styles.unit}>세</span>
                <span className={styles.yearHint}>{ageToYear(spouseBirthYear, parseAge(spouseRetirement, lifeCycleSettings.spouseRetirementAge ?? 65))}년</span>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.labelGroup}>
                <button
                  ref={el => { btnRefs.current['spouseLifeExpectancy'] = el }}
                  className={styles.iconBtn}
                  style={{ color: spLifeColor }}
                  onClick={() => togglePicker('spouseLifeExpectancy')}
                >
                  <SpLifeIcon size={14} />
                </button>
                <span className={styles.label}>기대 수명</span>
              </div>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  value={spouseLife}
                  onChange={(e) => { setSpouseLife(e.target.value); setIsDirty(true); }}
                  onBlur={() => handleAgeBlur('spouseLifeExpectancy', spouseLife, lifeCycleSettings.spouseLifeExpectancy ?? lifeCycleSettings.selfLifeExpectancy, setSpouseLife)}
                  onKeyDown={handleKey}
                  onWheel={preventScroll}
                  className={styles.input}
                />
                <span className={styles.unit}>세</span>
                <span className={styles.yearHint}>{ageToYear(spouseBirthYear, parseAge(spouseLife, lifeCycleSettings.spouseLifeExpectancy ?? lifeCycleSettings.selfLifeExpectancy))}년</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 아이콘/색상 피커 */}
      {pickerTarget && (
        <div
          ref={pickerRef}
          className={styles.picker}
          style={{
            background: isDark ? 'rgba(34, 37, 41, 0.5)' : 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
          }}
        >
          <div className={styles.pickerSection}>
            <div className={styles.pickerGrid}>
              {LIFECYCLE_ICONS.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    className={`${styles.pickerIconItem} ${currentPickerIcon === item.id ? styles.pickerItemActive : ''}`}
                    style={currentPickerIcon === item.id ? { color: currentPickerColor } : undefined}
                    onClick={() => handleIconChange(item.id)}
                    title={item.label}
                  >
                    <Icon size={16} />
                  </button>
                )
              })}
            </div>
          </div>
          <div className={styles.pickerDivider} />
          <div className={styles.pickerSection}>
            <div className={styles.colorGrid}>
              {LIFECYCLE_COLORS.map((item) => (
                <button
                  key={item.id}
                  className={`${styles.colorItem} ${currentPickerColor === item.color ? styles.colorItemActive : ''}`}
                  style={{ background: item.color }}
                  onClick={() => handleColorChange(item.color)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
