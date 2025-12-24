'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import type { OnboardingData, AssetInput, Frequency, DebtInput } from '@/types'
import { Plus, X, Check } from 'lucide-react'
import styles from '../onboarding.module.css'

// 섹션 정의
export type SectionId =
  | 'household'  // 가계 정보
  | 'goals'      // 목표
  | 'income'     // 소득
  | 'expense'    // 지출
  | 'realEstate' // 부동산 정리
  | 'asset'      // 자산 정리
  | 'debt'       // 부채 정리
  | 'pension'    // 연금 정리

export interface Section {
  id: SectionId
  label: string
  shortLabel: string
  description: string
}

export const sections: Section[] = [
  { id: 'household', label: '가계 정보', shortLabel: '가계', description: '이름, 생년월일, 가족 정보를 입력하세요' },
  { id: 'goals', label: '목표', shortLabel: '목표', description: '은퇴 목표를 설정하세요' },
  { id: 'income', label: '소득 정리', shortLabel: '소득', description: '월별 소득 내역을 정리하세요' },
  { id: 'expense', label: '지출 정리', shortLabel: '지출', description: '월별 지출 내역을 정리하세요' },
  { id: 'realEstate', label: '부동산 정리', shortLabel: '부동산', description: '보유 부동산 자산을 정리하세요' },
  { id: 'asset', label: '자산 정리', shortLabel: '금융자산', description: '예금, 주식, 펀드 등 금융자산을 정리하세요' },
  { id: 'debt', label: '부채 정리', shortLabel: '부채', description: '대출, 카드빚 등 부채를 정리하세요' },
  { id: 'pension', label: '연금 정리', shortLabel: '연금', description: '국민연금, 퇴직연금, 개인연금을 정리하세요' },
]

interface SectionFormProps {
  data: OnboardingData
  activeSection: SectionId
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

const frequencyLabels: Record<Frequency, string> = {
  monthly: '월',
  yearly: '연',
  once: '총',
}

// 나이 계산 함수
function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// 한국 나이 계산
function calculateKoreanAge(birthDate: string): number | null {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  return today.getFullYear() - birth.getFullYear() + 1
}

// 월 기준 합계 계산
function calculateMonthlyTotal(items: AssetInput[]): number {
  return items.reduce((sum, item) => {
    const amount = item.amount ?? 0
    if (item.frequency === 'yearly') return sum + amount / 12
    if (item.frequency === 'once') return sum
    return sum + amount
  }, 0)
}

// 총액 계산
function calculateTotalValue(items: AssetInput[]): number {
  return items.reduce((sum, item) => {
    const amount = item.amount ?? 0
    if (item.frequency === 'monthly') return sum + amount * 12
    if (item.frequency === 'yearly') return sum + amount
    return sum + amount
  }, 0)
}

// 금액 포맷 (원 단위 입력 기준)
// 입력: 원 단위 (100000000 = 1억, 10000 = 1만원)
function formatMoney(amount: number): string {
  if (amount === 0) return '0원'

  const manwon = amount / 10000  // 만원 단위로 변환

  if (manwon >= 10000) {
    const billions = Math.floor(manwon / 10000)
    const remainder = manwon % 10000
    if (remainder > 0) {
      return `${billions}억 ${Math.round(remainder).toLocaleString()}만원`
    }
    return `${billions}억`
  }

  return `${Math.round(manwon).toLocaleString()}만원`
}

export function SectionForm({ data, activeSection, onUpdateData }: SectionFormProps) {
  // 자산 항목 관리
  const addAssetItem = (key: keyof OnboardingData, subcategory?: string) => {
    const items = data[key] as AssetInput[]
    const newItem: AssetInput = { name: '', amount: null, frequency: 'monthly', subcategory }
    onUpdateData({ [key]: [...items, newItem] })
  }

  const updateAssetItem = (key: keyof OnboardingData, index: number, updates: Partial<AssetInput>) => {
    const items = data[key] as AssetInput[]
    onUpdateData({ [key]: items.map((item, i) => (i === index ? { ...item, ...updates } : item)) })
  }

  const deleteAssetItem = (key: keyof OnboardingData, index: number) => {
    const items = data[key] as AssetInput[]
    if (items.length <= 1) {
      onUpdateData({ [key]: [{ name: '', amount: null, frequency: 'monthly' }] })
    } else {
      onUpdateData({ [key]: items.filter((_, i) => i !== index) })
    }
  }

  // 공통 자산 입력 렌더러
  const renderAssetInputs = (
    key: keyof OnboardingData,
    items: AssetInput[],
    placeholder: string = '항목명',
    showFrequency: boolean = true
  ) => (
    <div className={styles.sectionInputList}>
      {items.map((item, index) => (
        <div key={index} className={styles.sectionInputRow}>
          <Input
            placeholder={placeholder}
            value={item.name}
            onChange={(e) => updateAssetItem(key, index, { name: e.target.value })}
            className={styles.sectionInputName}
          />
          <MoneyInput
            value={item.amount}
            onChange={(value) => updateAssetItem(key, index, { amount: value })}
            placeholder="0"
          />
          {showFrequency && (
            <select
              className={styles.sectionFrequency}
              value={item.frequency}
              onChange={(e) => updateAssetItem(key, index, { frequency: e.target.value as Frequency })}
            >
              {Object.entries(frequencyLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          )}
          <button
            className={styles.sectionDeleteBtn}
            onClick={() => deleteAssetItem(key, index)}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button className={styles.sectionAddBtn} onClick={() => addAssetItem(key)}>
        <Plus size={16} /> 항목 추가
      </button>
    </div>
  )

  // 각 섹션별 콘텐츠 렌더링
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'household':
        const currentAge = calculateAge(data.birth_date)
        const koreanAge = calculateKoreanAge(data.birth_date)
        const spouseAge = data.spouse?.birth_date ? calculateAge(data.spouse.birth_date) : null
        const spouseKoreanAge = data.spouse?.birth_date ? calculateKoreanAge(data.spouse.birth_date) : null

        return (
          <div className={styles.sectionContent}>
            <div className={styles.sectionGroup}>
              <h3 className={styles.sectionGroupTitle}>본인 정보</h3>
              <div className={styles.sectionField}>
                <label className={styles.sectionLabel}>이름</label>
                <Input
                  placeholder="이름을 입력하세요"
                  value={data.name}
                  onChange={(e) => onUpdateData({ name: e.target.value })}
                />
              </div>
              <div className={styles.sectionField}>
                <label className={styles.sectionLabel}>생년월일</label>
                <div className={styles.sectionFieldWithInfo}>
                  <Input
                    type="date"
                    value={data.birth_date}
                    onChange={(e) => onUpdateData({ birth_date: e.target.value })}
                  />
                  {currentAge !== null && (
                    <span className={styles.sectionFieldInfo}>
                      {koreanAge}세 (만 {currentAge}세)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.sectionGroup}>
              <h3 className={styles.sectionGroupTitle}>배우자 정보</h3>
              <div className={styles.sectionToggleGroup}>
                <button
                  className={`${styles.sectionToggle} ${data.isMarried === false ? styles.sectionToggleActive : ''}`}
                  onClick={() => onUpdateData({ isMarried: false, spouse: null })}
                >
                  없음
                </button>
                <button
                  className={`${styles.sectionToggle} ${data.isMarried === true ? styles.sectionToggleActive : ''}`}
                  onClick={() => onUpdateData({
                    isMarried: true,
                    spouse: { relationship: 'spouse', name: '배우자', birth_date: '' }
                  })}
                >
                  있음
                </button>
              </div>
              {data.isMarried && data.spouse && (
                <div className={styles.sectionField}>
                  <label className={styles.sectionLabel}>배우자 생년월일</label>
                  <div className={styles.sectionFieldWithInfo}>
                    <Input
                      type="date"
                      value={data.spouse.birth_date}
                      onChange={(e) => onUpdateData({ spouse: { ...data.spouse!, birth_date: e.target.value } })}
                    />
                    {spouseAge !== null && (
                      <span className={styles.sectionFieldInfo}>
                        {spouseKoreanAge}세 (만 {spouseAge}세)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 'goals':
        const goalsCurrentAge = calculateAge(data.birth_date)

        return (
          <div className={styles.sectionContent}>
            <div className={styles.sectionGroup}>
              <h3 className={styles.sectionGroupTitle}>은퇴 목표</h3>
              <div className={styles.sectionField}>
                <label className={styles.sectionLabel}>목표 은퇴 나이</label>
                <div className={styles.sectionFieldWithInfo}>
                  <Input
                    type="number"
                    placeholder="60"
                    value={data.target_retirement_age || ''}
                    onChange={(e) => onUpdateData({ target_retirement_age: parseInt(e.target.value) || 0 })}
                    className={styles.sectionSmallInput}
                  />
                  <span className={styles.sectionUnit}>세</span>
                  {goalsCurrentAge && data.target_retirement_age > goalsCurrentAge && (
                    <span className={styles.sectionFieldInfo}>
                      {data.target_retirement_age - goalsCurrentAge}년 후
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.sectionField}>
                <label className={styles.sectionLabel}>목표 은퇴 자금</label>
                <MoneyInput
                  value={data.target_retirement_fund}
                  onChange={(value) => onUpdateData({ target_retirement_fund: value ?? 0 })}
                  placeholder="100000"
                />
              </div>
            </div>
          </div>
        )

      case 'income':
        const incomeTotal = calculateMonthlyTotal(data.incomes)
        const expenseTotal = calculateMonthlyTotal(data.expenses)
        const monthlySavings = incomeTotal - expenseTotal
        const savingsRate = incomeTotal > 0 ? Math.round((monthlySavings / incomeTotal) * 100) : 0

        // 지출 분류
        const fixedExpenses = data.expenses.filter(item =>
          item.subcategory === '고정지출' ||
          ['주거비', '보험료', '교육비', '구독 서비스', '용돈', '기타 고정'].includes(item.name)
        )
        const variableExpenses = data.expenses.filter(item =>
          item.subcategory === '변동지출' ||
          ['생활·식비', '패션·개인관리', '교통비', '교육·자기계발', '건강·여가', '기타 변동'].includes(item.name)
        )
        const uncategorizedExpenses = data.expenses.filter(item =>
          !fixedExpenses.includes(item) && !variableExpenses.includes(item)
        )

        return (
          <div className={styles.sectionContent}>
            {/* 요약 카드 */}
            {(incomeTotal > 0 || expenseTotal > 0) && (
              <div className={styles.sectionSummary}>
                <div className={styles.sectionSummaryItem}>
                  <span className={styles.sectionSummaryLabel}>월 수입</span>
                  <span className={styles.sectionSummaryValue}>{formatMoney(incomeTotal)}</span>
                </div>
                <div className={styles.sectionSummaryItem}>
                  <span className={styles.sectionSummaryLabel}>월 지출</span>
                  <span className={styles.sectionSummaryValue}>{formatMoney(expenseTotal)}</span>
                </div>
                <div className={`${styles.sectionSummaryItem} ${monthlySavings >= 0 ? styles.sectionSummaryPositive : styles.sectionSummaryNegative}`}>
                  <span className={styles.sectionSummaryLabel}>월 저축</span>
                  <span className={styles.sectionSummaryValue}>
                    {monthlySavings >= 0 ? '+' : ''}{formatMoney(monthlySavings)}
                    {incomeTotal > 0 && <small> ({savingsRate}%)</small>}
                  </span>
                </div>
              </div>
            )}

            <div className={styles.sectionGroup}>
              <h3 className={styles.sectionGroupTitle}>소득</h3>
              {renderAssetInputs('incomes', data.incomes, '소득 항목')}
            </div>

            <div className={styles.sectionGroup}>
              <h3 className={styles.sectionGroupTitle}>고정 지출</h3>
              <p className={styles.sectionGroupDesc}>주거비, 보험료, 구독료 등 매월 고정적으로 나가는 비용</p>
              {renderAssetInputs('expenses', fixedExpenses.length > 0 ? fixedExpenses : [{ name: '', amount: null, frequency: 'monthly', subcategory: '고정지출' }], '지출 항목')}
              <button
                className={styles.sectionAddBtn}
                onClick={() => addAssetItem('expenses', '고정지출')}
              >
                <Plus size={16} /> 고정 지출 추가
              </button>
            </div>

            <div className={styles.sectionGroup}>
              <h3 className={styles.sectionGroupTitle}>변동 지출</h3>
              <p className={styles.sectionGroupDesc}>식비, 교통비, 여가비 등 매월 변동되는 비용</p>
              {renderAssetInputs('expenses', [...variableExpenses, ...uncategorizedExpenses].length > 0 ? [...variableExpenses, ...uncategorizedExpenses] : [{ name: '', amount: null, frequency: 'monthly', subcategory: '변동지출' }], '지출 항목')}
              <button
                className={styles.sectionAddBtn}
                onClick={() => addAssetItem('expenses', '변동지출')}
              >
                <Plus size={16} /> 변동 지출 추가
              </button>
            </div>
          </div>
        )

      case 'realEstate':
        const realEstateTotal = calculateTotalValue(data.realEstates)

        return (
          <div className={styles.sectionContent}>
            {realEstateTotal > 0 && (
              <div className={styles.sectionSummary}>
                <div className={styles.sectionSummaryItem}>
                  <span className={styles.sectionSummaryLabel}>총 부동산</span>
                  <span className={styles.sectionSummaryValue}>{formatMoney(realEstateTotal)}</span>
                </div>
              </div>
            )}
            <div className={styles.sectionGroup}>
              <h3 className={styles.sectionGroupTitle}>부동산 자산</h3>
              <p className={styles.sectionGroupDesc}>아파트, 빌라, 상가, 토지, 전세보증금 등</p>
              {renderAssetInputs('realEstates', data.realEstates.length > 0 ? data.realEstates : [{ name: '', amount: null, frequency: 'once' }], '부동산 항목', false)}
            </div>
          </div>
        )

      case 'asset':
        const assetTotal = calculateTotalValue(data.assets)

        return (
          <div className={styles.sectionContent}>
            {assetTotal > 0 && (
              <div className={styles.sectionSummary}>
                <div className={styles.sectionSummaryItem}>
                  <span className={styles.sectionSummaryLabel}>총 금융자산</span>
                  <span className={styles.sectionSummaryValue}>{formatMoney(assetTotal)}</span>
                </div>
              </div>
            )}
            <div className={styles.sectionGroup}>
              <h3 className={styles.sectionGroupTitle}>금융 자산</h3>
              <p className={styles.sectionGroupDesc}>예금, 적금, 주식, ETF, 펀드, 채권 등</p>
              {renderAssetInputs('assets', data.assets.length > 0 ? data.assets : [{ name: '', amount: null, frequency: 'once' }], '자산 항목', false)}
            </div>
          </div>
        )

      case 'debt':
        // DebtInput 타입을 위한 별도 합계 계산
        const debtTotal = data.debts.reduce((sum, d) => sum + (d.amount || 0), 0)

        return (
          <div className={styles.sectionContent}>
            {debtTotal > 0 && (
              <div className={styles.sectionSummary}>
                <div className={`${styles.sectionSummaryItem} ${styles.sectionSummaryNegative}`}>
                  <span className={styles.sectionSummaryLabel}>총 부채</span>
                  <span className={styles.sectionSummaryValue}>{formatMoney(debtTotal)}</span>
                </div>
              </div>
            )}
            <div className={styles.sectionGroup}>
              <h3 className={styles.sectionGroupTitle}>부채</h3>
              <p className={styles.sectionGroupDesc}>주택담보대출, 신용대출, 학자금대출, 카드론 등</p>
              <p className={styles.sectionGroupDesc}>부채는 Progressive Form에서 입력하세요.</p>
            </div>
          </div>
        )

      case 'pension':
        const pensionTotal = calculateMonthlyTotal(data.pensions)

        return (
          <div className={styles.sectionContent}>
            {pensionTotal > 0 && (
              <div className={styles.sectionSummary}>
                <div className={styles.sectionSummaryItem}>
                  <span className={styles.sectionSummaryLabel}>월 예상 연금</span>
                  <span className={styles.sectionSummaryValue}>{formatMoney(pensionTotal)}</span>
                </div>
              </div>
            )}
            <div className={styles.sectionGroup}>
              <h3 className={styles.sectionGroupTitle}>연금</h3>
              <p className={styles.sectionGroupDesc}>국민연금, 퇴직연금(DB/DC), IRP, 연금저축 등</p>
              {renderAssetInputs('pensions', data.pensions.length > 0 ? data.pensions : [{ name: '', amount: null, frequency: 'monthly' }], '연금 항목')}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={styles.sectionFormContainer}>
      {renderSectionContent()}
    </div>
  )
}
