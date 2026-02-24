'use client'

import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import type { OnboardingData, AssetInput, FamilyMemberInput, Gender, Frequency } from '@/types'
import { Plus, Trash2, ChevronDown } from 'lucide-react'
import styles from '../onboarding.module.css'

interface SpreadsheetOnboardingProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

type SectionId = 'basic' | 'spouse' | 'children' | 'parents' | 'income' | 'expense' | 'realEstate' | 'asset' | 'debt' | 'pension' | 'goals'

const frequencyLabels: Record<Frequency, string> = {
  monthly: '월',
  yearly: '연',
  once: '일시',
}

export function SpreadsheetOnboarding({ data, onUpdateData }: SpreadsheetOnboardingProps) {
  const [activeSection, setActiveSection] = useState<SectionId | null>('basic')
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFocus = (section: SectionId) => {
    setActiveSection(section)
  }

  // 자산 항목 관리
  const addAssetItem = (key: keyof OnboardingData) => {
    const items = data[key] as AssetInput[]
    onUpdateData({ [key]: [...items, { name: '', amount: 0, frequency: 'monthly' }] })
  }

  const removeAssetItem = (key: keyof OnboardingData, index: number) => {
    const items = data[key] as AssetInput[]
    onUpdateData({ [key]: items.filter((_, i) => i !== index) })
  }

  const updateAssetItem = (key: keyof OnboardingData, index: number, updates: Partial<AssetInput>) => {
    const items = data[key] as AssetInput[]
    onUpdateData({ [key]: items.map((item, i) => (i === index ? { ...item, ...updates } : item)) })
  }

  // 배우자 관리
  const toggleSpouse = () => {
    if (data.isMarried) {
      onUpdateData({ isMarried: false, spouse: null })
    } else {
      onUpdateData({
        isMarried: true,
        spouse: { relationship: 'spouse', name: '', birth_date: '', is_working: false, retirement_age: 0, monthly_income: 0 }
      })
    }
  }

  const updateSpouse = (updates: Partial<FamilyMemberInput>) => {
    if (data.spouse) {
      onUpdateData({ spouse: { ...data.spouse, ...updates } })
    }
  }

  // 자녀 관리
  const addChild = () => {
    onUpdateData({ children: [...data.children, { relationship: 'child', name: '', birth_date: '', gender: 'male' as Gender }] })
  }

  const removeChild = (index: number) => {
    onUpdateData({ children: data.children.filter((_, i) => i !== index) })
  }

  const updateChild = (index: number, updates: Partial<FamilyMemberInput>) => {
    onUpdateData({ children: data.children.map((child, i) => i === index ? { ...child, ...updates } : child) })
  }

  // 부모 관리
  const addParent = () => {
    onUpdateData({ parents: [...data.parents, { relationship: 'parent', name: '', birth_date: '', is_dependent: true }] })
  }

  const removeParent = (index: number) => {
    onUpdateData({ parents: data.parents.filter((_, i) => i !== index) })
  }

  const updateParent = (index: number, updates: Partial<FamilyMemberInput>) => {
    onUpdateData({ parents: data.parents.map((parent, i) => i === index ? { ...parent, ...updates } : parent) })
  }

  const renderAssetSection = (
    sectionId: SectionId,
    title: string,
    key: keyof OnboardingData,
    placeholder: string,
    showFrequency: boolean = true
  ) => {
    const items = data[key] as AssetInput[]
    const isActive = activeSection === sectionId

    return (
      <div
        className={`${styles.spreadsheetSection} ${isActive ? styles.spreadsheetSectionActive : ''}`}
        onFocus={() => handleFocus(sectionId)}
      >
        <div className={styles.spreadsheetHeader}>
          <span className={styles.spreadsheetTitle}>{title}</span>
          <span className={styles.spreadsheetCount}>{items.filter(i => i.name && i.amount).length}개</span>
        </div>
        <div className={styles.spreadsheetRows}>
          {items.map((item, index) => (
            <div key={index} className={styles.spreadsheetRow}>
              <Input
                placeholder={placeholder}
                value={item.name}
                onChange={(e) => updateAssetItem(key, index, { name: e.target.value })}
              />
              <MoneyInput
                value={item.amount}
                onChange={(value) => updateAssetItem(key, index, { amount: value })}
                placeholder="0"
              />
              {showFrequency && (
                <select
                  className={styles.spreadsheetSelect}
                  value={item.frequency}
                  onChange={(e) => updateAssetItem(key, index, { frequency: e.target.value as Frequency })}
                >
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              )}
              <button
                className={styles.spreadsheetDelete}
                onClick={() => removeAssetItem(key, index)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button className={styles.spreadsheetAdd} onClick={() => addAssetItem(key)}>
            <Plus size={14} /> 추가
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={styles.spreadsheetContainer}>
      {/* 기본 정보 */}
      <div
        className={`${styles.spreadsheetSection} ${activeSection === 'basic' ? styles.spreadsheetSectionActive : ''}`}
        onFocus={() => handleFocus('basic')}
      >
        <div className={styles.spreadsheetHeader}>
          <span className={styles.spreadsheetTitle}>기본 정보</span>
        </div>
        <div className={styles.spreadsheetGrid}>
          <div className={styles.spreadsheetField}>
            <label className={styles.spreadsheetLabel}>이름</label>
            <Input
              placeholder="홍길동"
              value={data.name}
              onChange={(e) => onUpdateData({ name: e.target.value })}
            />
          </div>
          <div className={styles.spreadsheetField}>
            <label className={styles.spreadsheetLabel}>생년월일</label>
            <Input
              type="date"
              max="9999-12-31"
              value={data.birth_date}
              onChange={(e) => onUpdateData({ birth_date: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* 배우자 */}
      <div
        className={`${styles.spreadsheetSection} ${activeSection === 'spouse' ? styles.spreadsheetSectionActive : ''}`}
        onFocus={() => handleFocus('spouse')}
      >
        <div className={styles.spreadsheetHeader}>
          <span className={styles.spreadsheetTitle}>배우자</span>
          <button className={styles.spreadsheetToggle} onClick={toggleSpouse}>
            {data.isMarried ? '있음' : '없음'}
            <ChevronDown size={14} />
          </button>
        </div>
        {data.isMarried && data.spouse && (
          <div className={styles.spreadsheetGrid}>
            <div className={styles.spreadsheetField}>
              <label className={styles.spreadsheetLabel}>이름</label>
              <Input
                placeholder="이름"
                value={data.spouse.name}
                onChange={(e) => updateSpouse({ name: e.target.value })}
              />
            </div>
            <div className={styles.spreadsheetField}>
              <label className={styles.spreadsheetLabel}>생년월일</label>
              <Input
                type="date"
                max="9999-12-31"
                value={data.spouse.birth_date}
                onChange={(e) => updateSpouse({ birth_date: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* 자녀 */}
      <div
        className={`${styles.spreadsheetSection} ${activeSection === 'children' ? styles.spreadsheetSectionActive : ''}`}
        onFocus={() => handleFocus('children')}
      >
        <div className={styles.spreadsheetHeader}>
          <span className={styles.spreadsheetTitle}>자녀</span>
          <span className={styles.spreadsheetCount}>{data.children.filter(c => c.name).length}명</span>
        </div>
        <div className={styles.spreadsheetRows}>
          {data.children.map((child, index) => (
            <div key={index} className={styles.spreadsheetRow}>
              <Input
                placeholder="이름"
                value={child.name}
                onChange={(e) => updateChild(index, { name: e.target.value })}
              />
              <Input
                type="date"
                max="9999-12-31"
                value={child.birth_date}
                onChange={(e) => updateChild(index, { birth_date: e.target.value })}
              />
              <button
                className={styles.spreadsheetDelete}
                onClick={() => removeChild(index)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button className={styles.spreadsheetAdd} onClick={addChild}>
            <Plus size={14} /> 자녀 추가
          </button>
        </div>
      </div>

      {/* 부양 부모 */}
      <div
        className={`${styles.spreadsheetSection} ${activeSection === 'parents' ? styles.spreadsheetSectionActive : ''}`}
        onFocus={() => handleFocus('parents')}
      >
        <div className={styles.spreadsheetHeader}>
          <span className={styles.spreadsheetTitle}>부양 부모</span>
          <span className={styles.spreadsheetCount}>{data.parents.filter(p => p.name).length}명</span>
        </div>
        <div className={styles.spreadsheetRows}>
          {data.parents.map((parent, index) => (
            <div key={index} className={styles.spreadsheetRow}>
              <Input
                placeholder="이름"
                value={parent.name}
                onChange={(e) => updateParent(index, { name: e.target.value })}
              />
              <Input
                type="date"
                max="9999-12-31"
                value={parent.birth_date}
                onChange={(e) => updateParent(index, { birth_date: e.target.value })}
              />
              <button
                className={styles.spreadsheetDelete}
                onClick={() => removeParent(index)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button className={styles.spreadsheetAdd} onClick={addParent}>
            <Plus size={14} /> 부모 추가
          </button>
        </div>
      </div>

      {/* 수입 */}
      {renderAssetSection('income', '수입', 'incomes', '급여, 사업소득 등', true)}

      {/* 지출 */}
      {renderAssetSection('expense', '지출', 'expenses', '생활비, 보험료 등', true)}

      {/* 부동산 */}
      {renderAssetSection('realEstate', '부동산', 'realEstates', '아파트, 주택 등', false)}

      {/* 금융자산 */}
      {renderAssetSection('asset', '금융자산', 'assets', '예금, 주식 등', false)}

      {/* 부채 */}
      {renderAssetSection('debt', '부채', 'debts', '대출, 카드빚 등', false)}

      {/* 연금 */}
      {renderAssetSection('pension', '연금', 'pensions', '국민연금, 퇴직연금 등', true)}

      {/* 목표 */}
      <div
        className={`${styles.spreadsheetSection} ${activeSection === 'goals' ? styles.spreadsheetSectionActive : ''}`}
        onFocus={() => handleFocus('goals')}
      >
        <div className={styles.spreadsheetHeader}>
          <span className={styles.spreadsheetTitle}>은퇴 목표</span>
        </div>
        <div className={styles.spreadsheetGrid}>
          <div className={styles.spreadsheetField}>
            <label className={styles.spreadsheetLabel}>목표 은퇴 나이</label>
            <Input
              type="number"
              placeholder="60"
              value={data.target_retirement_age || ''}
              onChange={(e) => onUpdateData({ target_retirement_age: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className={styles.spreadsheetField}>
            <label className={styles.spreadsheetLabel}>목표 은퇴 자금</label>
            <MoneyInput
              value={data.target_retirement_fund}
              onChange={(value) => onUpdateData({ target_retirement_fund: value ?? 0 })}
              placeholder="0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
