'use client'

import { useState } from 'react'
import { ChevronLeft, Plus, X } from 'lucide-react'
import { calculateInternationalAge } from '@/components/ui/age-display'
import styles from './FamilyForm.module.css'

type ChildGender = 'son' | 'daughter'

interface ChildData {
  gender: ChildGender
  birthDate: string
}

interface ParentData {
  birthDate: string
}

interface FamilyFormProps {
  missionNumber?: number
  initialData?: {
    spouse?: { birthYear: number; birthMonth: number } | null
    children?: { gender: ChildGender; birthYear: number; birthMonth: number }[]
    parents?: { birthYear: number; birthMonth: number }[]
  }
  onComplete: (data: {
    spouse: { birthYear: number; birthMonth: number } | null
    children: { gender: ChildGender; birthYear: number; birthMonth: number }[]
    parents: { birthYear: number; birthMonth: number }[]
  }) => void
  onSkip: () => void
  onBack: () => void
}

// 년월을 date string으로 변환
const toDateString = (year: number, month: number): string => {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

// date string에서 년월 추출
const fromDateString = (dateStr: string): { year: number; month: number } | null => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}


export function FamilyForm({ missionNumber, initialData, onComplete, onSkip, onBack }: FamilyFormProps) {
  const [hasSpouse, setHasSpouse] = useState(!!initialData?.spouse)
  const [spouseBirthDate, setSpouseBirthDate] = useState(
    initialData?.spouse ? toDateString(initialData.spouse.birthYear, initialData.spouse.birthMonth) : ''
  )

  const [children, setChildren] = useState<ChildData[]>(
    initialData?.children?.map(c => ({
      gender: c.gender,
      birthDate: toDateString(c.birthYear, c.birthMonth)
    })) || []
  )

  const [parents, setParents] = useState<ParentData[]>(
    initialData?.parents?.map(p => ({
      birthDate: toDateString(p.birthYear, p.birthMonth)
    })) || []
  )

  const addChild = () => {
    setChildren([...children, { gender: 'son', birthDate: '' }])
  }

  const updateChildGender = (index: number, gender: ChildGender) => {
    const updated = [...children]
    updated[index] = { ...updated[index], gender }
    setChildren(updated)
  }

  const updateChildBirthDate = (index: number, birthDate: string) => {
    const updated = [...children]
    updated[index] = { ...updated[index], birthDate }
    setChildren(updated)
  }

  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index))
  }

  const addParent = () => {
    if (parents.length < 4) {
      setParents([...parents, { birthDate: '' }])
    }
  }

  const updateParentBirthDate = (index: number, birthDate: string) => {
    const updated = [...parents]
    updated[index] = { birthDate }
    setParents(updated)
  }

  const removeParent = (index: number) => {
    setParents(parents.filter((_, i) => i !== index))
  }

  const handleComplete = () => {
    const spouseData = fromDateString(spouseBirthDate)

    onComplete({
      spouse: hasSpouse && spouseData
        ? { birthYear: spouseData.year, birthMonth: spouseData.month }
        : null,
      children: children
        .filter(c => c.birthDate)
        .map(c => {
          const data = fromDateString(c.birthDate)!
          return { gender: c.gender, birthYear: data.year, birthMonth: data.month }
        }),
      parents: parents
        .filter(p => p.birthDate)
        .map(p => {
          const data = fromDateString(p.birthDate)!
          return { birthYear: data.year, birthMonth: data.month }
        }),
    })
  }

  const spouseAge = spouseBirthDate ? calculateInternationalAge(spouseBirthDate) : null

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <div className={styles.headerInfo}>
          {missionNumber !== undefined && (
            <p className={styles.missionLabel}>Mission {missionNumber}</p>
          )}
          <h2 className={styles.title}>가족 구성</h2>
        </div>
      </div>

      {/* 배우자 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>배우자</span>
        </div>
        <div className={styles.toggleRow}>
          <button
            className={`${styles.toggleBtn} ${hasSpouse ? styles.active : ''}`}
            onClick={() => setHasSpouse(true)}
          >
            있음
          </button>
          <button
            className={`${styles.toggleBtn} ${!hasSpouse ? styles.active : ''}`}
            onClick={() => setHasSpouse(false)}
          >
            없음
          </button>
        </div>
        {hasSpouse && (
          <div className={styles.birthRow}>
            <span className={styles.birthLabel}>생년월일</span>
            <div className={styles.dateInputWrapper}>
              <input
                type="date"
                className={styles.dateInput}
                min="1900-01-01"
                max="2200-12-31"
                value={spouseBirthDate}
                onChange={(e) => setSpouseBirthDate(e.target.value)}
              />
              {spouseAge !== null && (
                <span className={styles.ageDisplay}>만 {spouseAge}세</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 자녀 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>자녀</span>
          <button className={styles.addBtn} onClick={addChild}>
            <Plus size={16} />
            추가
          </button>
        </div>
        {children.length === 0 ? (
          <p className={styles.emptyText}>등록된 자녀가 없습니다</p>
        ) : (
          <div className={styles.memberList}>
            {children.map((child, index) => (
              <div key={index} className={styles.memberRow}>
                <div className={styles.genderToggle}>
                  <button
                    className={`${styles.genderBtn} ${child.gender === 'son' ? styles.active : ''}`}
                    onClick={() => updateChildGender(index, 'son')}
                  >
                    아들
                  </button>
                  <button
                    className={`${styles.genderBtn} ${child.gender === 'daughter' ? styles.active : ''}`}
                    onClick={() => updateChildGender(index, 'daughter')}
                  >
                    딸
                  </button>
                </div>
                <div className={styles.dateInputWrapper}>
                  <input
                    type="date"
                    className={styles.dateInput}
                    min="1900-01-01"
                    max="2200-12-31"
                    value={child.birthDate}
                    onChange={(e) => updateChildBirthDate(index, e.target.value)}
                  />
                  {child.birthDate && (
                    <span className={styles.ageDisplay}>만 {calculateInternationalAge(child.birthDate)}세</span>
                  )}
                </div>
                <button className={styles.removeBtn} onClick={() => removeChild(index)}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 부양 부모님 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>부양 부모님</span>
          {parents.length < 4 && (
            <button className={styles.addBtn} onClick={addParent}>
              <Plus size={16} />
              추가
            </button>
          )}
        </div>
        {parents.length === 0 ? (
          <p className={styles.emptyText}>등록된 부모님이 없습니다</p>
        ) : (
          <div className={styles.memberList}>
            {parents.map((parent, index) => (
              <div key={index} className={styles.memberRow}>
                <span className={styles.memberLabel}>부모님 {index + 1}</span>
                <div className={styles.dateInputWrapper}>
                  <input
                    type="date"
                    className={styles.dateInput}
                    min="1900-01-01"
                    max="2200-12-31"
                    value={parent.birthDate}
                    onChange={(e) => updateParentBirthDate(index, e.target.value)}
                  />
                  {parent.birthDate && (
                    <span className={styles.ageDisplay}>만 {calculateInternationalAge(parent.birthDate)}세</span>
                  )}
                </div>
                <button className={styles.removeBtn} onClick={() => removeParent(index)}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.skipBtn} onClick={onSkip}>
          건너뛰기
        </button>
        <button className={styles.completeBtn} onClick={handleComplete}>
          완료
        </button>
      </div>
    </div>
  )
}
