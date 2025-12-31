'use client'

import { useState, useMemo } from 'react'
import { Pencil, Trash2, Home, Building2 } from 'lucide-react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type {
  OnboardingData,
  RealEstateProperty,
  RealEstateUsageType,
  DebtInput,
  DashboardIncomeItem,
} from '@/types'
import { formatMoney } from '@/lib/utils'
import styles from './RealEstateTab.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface RealEstateTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

// 용도별 라벨
const USAGE_TYPE_LABELS: Record<RealEstateUsageType, string> = {
  investment: '투자용',
  rental: '임대용',
  land: '토지',
}

// 색상
const HOUSING_COLOR = '#007aff'
const USAGE_COLORS: Record<RealEstateUsageType, string> = {
  investment: '#5856d6',
  rental: '#34c759',
  land: '#ff9500',
}

// 상환방식 라벨
const REPAYMENT_TYPE_LABELS: Record<string, string> = {
  '만기일시상환': '만기일시',
  '원리금균등상환': '원리금균등',
  '원금균등상환': '원금균등',
  '거치식상환': '거치식',
}

// 거주형태 라벨
const HOUSING_TYPE_LABELS: Record<string, string> = {
  '자가': '자가',
  '전세': '전세',
  '월세': '월세',
  '해당없음': '해당없음',
}

export function RealEstateTab({ data, onUpdateData }: RealEstateTabProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // 편집 상태
  const [editingProperty, setEditingProperty] = useState<{ usageType: RealEstateUsageType, id: string | null } | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editBooleans, setEditBooleans] = useState<{ hasRentalIncome: boolean, hasLoan: boolean }>({ hasRentalIncome: false, hasLoan: false })
  const [editingHousing, setEditingHousing] = useState(false)
  const [housingEditValues, setHousingEditValues] = useState<Record<string, string>>({})
  const [housingHasLoan, setHousingHasLoan] = useState(false)

  // 데이터
  const realEstateProperties = data.realEstateProperties || []

  // 거주용 부동산 (온보딩 데이터)
  const hasHousing = data.housingType && data.housingType !== '해당없음'
  const housingValue = data.housingType === '자가' ? (data.housingValue || 0) : (data.housingValue || 0) // 자가: 시세, 전세/월세: 보증금
  const housingLoanAmount = data.housingHasLoan ? (data.housingLoan || 0) : 0

  // 추가 부동산
  const investmentProperties = realEstateProperties.filter(p => p.usageType === 'investment')
  const rentalProperties = realEstateProperties.filter(p => p.usageType === 'rental')
  const landProperties = realEstateProperties.filter(p => p.usageType === 'land')

  // 합계 계산
  const investmentTotal = investmentProperties.reduce((sum, p) => sum + p.marketValue, 0)
  const rentalTotal = rentalProperties.reduce((sum, p) => sum + p.marketValue, 0)
  const landTotal = landProperties.reduce((sum, p) => sum + p.marketValue, 0)
  const additionalTotal = investmentTotal + rentalTotal + landTotal

  // 총 부동산 자산 (거주용 + 추가)
  const totalRealEstateValue = (data.housingType === '자가' ? housingValue : 0) + additionalTotal

  // 총 부동산 대출
  const additionalLoans = realEstateProperties.reduce((sum, p) => {
    return sum + (p.hasLoan ? (p.loanAmount || 0) : 0)
  }, 0)
  const totalRealEstateLoans = housingLoanAmount + additionalLoans

  // 월 임대 수익 합계
  const totalMonthlyRent = realEstateProperties.reduce((sum, p) => {
    return sum + (p.hasRentalIncome ? (p.monthlyRent || 0) : 0)
  }, 0)

  // 거주용 편집 시작
  const startEditHousing = () => {
    let maturityYear = ''
    let maturityMonth = ''
    if (data.housingLoanMaturity) {
      const [y, m] = data.housingLoanMaturity.split('-')
      maturityYear = y || ''
      maturityMonth = m || ''
    }

    setEditingHousing(true)
    setHousingHasLoan(data.housingHasLoan || false)
    setHousingEditValues({
      housingType: data.housingType || '',
      housingValue: data.housingValue?.toString() || '',
      housingRent: data.housingRent?.toString() || '',
      housingMaintenance: data.housingMaintenance?.toString() || '',
      housingLoan: data.housingLoan?.toString() || '',
      housingLoanRate: data.housingLoanRate?.toString() || '',
      housingLoanMaturityYear: maturityYear,
      housingLoanMaturityMonth: maturityMonth,
      housingLoanType: data.housingLoanType || '',
    })
  }

  const cancelHousingEdit = () => {
    setEditingHousing(false)
    setHousingEditValues({})
    setHousingHasLoan(false)
  }

  const saveHousingEdit = () => {
    const housingType = housingEditValues.housingType as '자가' | '전세' | '월세' | '해당없음' | null

    let loanMaturity: string | null = null
    if (housingHasLoan && housingEditValues.housingLoanMaturityYear && housingEditValues.housingLoanMaturityMonth) {
      loanMaturity = `${housingEditValues.housingLoanMaturityYear}-${String(housingEditValues.housingLoanMaturityMonth).padStart(2, '0')}`
    }

    onUpdateData({
      housingType: housingType || null,
      housingValue: housingEditValues.housingValue ? parseFloat(housingEditValues.housingValue) : null,
      housingRent: housingEditValues.housingRent ? parseFloat(housingEditValues.housingRent) : null,
      housingMaintenance: housingEditValues.housingMaintenance ? parseFloat(housingEditValues.housingMaintenance) : null,
      housingHasLoan: housingHasLoan,
      housingLoan: housingEditValues.housingLoan ? parseFloat(housingEditValues.housingLoan) : null,
      housingLoanRate: housingEditValues.housingLoanRate ? parseFloat(housingEditValues.housingLoanRate) : null,
      housingLoanMaturity: loanMaturity,
      housingLoanType: housingEditValues.housingLoanType as '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환' | null,
    })
    cancelHousingEdit()
  }

  // 추가 부동산 편집
  const startAddProperty = (usageType: RealEstateUsageType) => {
    setEditingProperty({ usageType, id: null })
    setEditBooleans({ hasRentalIncome: false, hasLoan: false })
    setEditValues({
      name: '',
      marketValue: '',
      purchaseYear: currentYear.toString(),
      purchaseMonth: currentMonth.toString(),
      monthlyRent: '',
      deposit: '',
      loanAmount: '',
      loanRate: '',
      loanMaturityYear: '',
      loanMaturityMonth: '',
      loanRepaymentType: '',
    })
  }

  const startEditProperty = (property: RealEstateProperty) => {
    setEditingProperty({ usageType: property.usageType, id: property.id })

    let maturityYear = ''
    let maturityMonth = ''
    if (property.loanMaturity) {
      const [y, m] = property.loanMaturity.split('-')
      maturityYear = y || ''
      maturityMonth = m || ''
    }

    setEditBooleans({
      hasRentalIncome: property.hasRentalIncome || false,
      hasLoan: property.hasLoan || false,
    })
    setEditValues({
      name: property.name,
      marketValue: property.marketValue.toString(),
      purchaseYear: property.purchaseYear?.toString() || '',
      purchaseMonth: property.purchaseMonth?.toString() || '',
      monthlyRent: property.monthlyRent?.toString() || '',
      deposit: property.deposit?.toString() || '',
      loanAmount: property.loanAmount?.toString() || '',
      loanRate: property.loanRate?.toString() || '',
      loanMaturityYear: maturityYear,
      loanMaturityMonth: maturityMonth,
      loanRepaymentType: property.loanRepaymentType || '',
    })
  }

  const cancelEdit = () => {
    setEditingProperty(null)
    setEditValues({})
    setEditBooleans({ hasRentalIncome: false, hasLoan: false })
  }

  const saveProperty = () => {
    if (!editingProperty || !editValues.name || !editValues.marketValue) return

    let loanMaturity: string | undefined
    if (editBooleans.hasLoan && editValues.loanMaturityYear && editValues.loanMaturityMonth) {
      loanMaturity = `${editValues.loanMaturityYear}-${String(editValues.loanMaturityMonth).padStart(2, '0')}`
    }

    const propertyId = editingProperty.id || `realestate-${Date.now()}`

    const newProperty: RealEstateProperty = {
      id: propertyId,
      usageType: editingProperty.usageType,
      name: editValues.name,
      marketValue: parseFloat(editValues.marketValue) || 0,
      purchaseYear: editValues.purchaseYear ? parseInt(editValues.purchaseYear) : undefined,
      purchaseMonth: editValues.purchaseMonth ? parseInt(editValues.purchaseMonth) : undefined,
      hasRentalIncome: editBooleans.hasRentalIncome,
      monthlyRent: editBooleans.hasRentalIncome ? (parseFloat(editValues.monthlyRent) || undefined) : undefined,
      deposit: editBooleans.hasRentalIncome ? (parseFloat(editValues.deposit) || undefined) : undefined,
      hasLoan: editBooleans.hasLoan,
      loanAmount: editBooleans.hasLoan ? (parseFloat(editValues.loanAmount) || undefined) : undefined,
      loanRate: editBooleans.hasLoan ? (parseFloat(editValues.loanRate) || undefined) : undefined,
      loanMaturity: editBooleans.hasLoan ? loanMaturity : undefined,
      loanRepaymentType: editBooleans.hasLoan ? (editValues.loanRepaymentType as RealEstateProperty['loanRepaymentType']) : undefined,
    }

    let updatedProperties: RealEstateProperty[]
    if (editingProperty.id) {
      updatedProperties = realEstateProperties.map(p => p.id === editingProperty.id ? newProperty : p)
    } else {
      updatedProperties = [...realEstateProperties, newProperty]
    }

    // 부채 배열 업데이트
    let updatedDebts = [...(data.debts || [])]
    const debtId = `debt-realestate-${propertyId}`

    // 기존 연동 부채 제거
    updatedDebts = updatedDebts.filter(d => d.sourceId !== propertyId)

    // 대출이 있으면 새 부채 추가
    if (newProperty.hasLoan && newProperty.loanAmount) {
      const newDebt: DebtInput = {
        id: debtId,
        name: `${newProperty.name} 대출`,
        amount: newProperty.loanAmount,
        rate: newProperty.loanRate || null,
        maturity: newProperty.loanMaturity || null,
        repaymentType: newProperty.loanRepaymentType || null,
        sourceType: 'realEstate',
        sourceId: propertyId,
      }
      updatedDebts.push(newDebt)
    }

    // 소득 배열 업데이트 (임대 수익)
    let updatedIncomes = [...(data.incomeItems || [])]
    const incomeId = `income-realestate-${propertyId}`

    // 기존 연동 소득 제거
    updatedIncomes = updatedIncomes.filter(i => i.sourceId !== propertyId)

    // 임대 수익이 있으면 새 소득 추가
    if (newProperty.hasRentalIncome && newProperty.monthlyRent) {
      const newIncome: DashboardIncomeItem = {
        id: incomeId,
        type: 'rental',
        label: `${newProperty.name} 임대`,
        owner: 'self',
        amount: newProperty.monthlyRent,
        frequency: 'monthly',
        startYear: currentYear,
        startMonth: currentMonth,
        endType: 'custom',
        endYear: null,
        endMonth: null,
        growthRate: 0,
        rateCategory: 'realEstate',
        sourceType: 'realEstate',
        sourceId: propertyId,
      }
      updatedIncomes.push(newIncome)
    }

    onUpdateData({
      realEstateProperties: updatedProperties,
      debts: updatedDebts,
      incomeItems: updatedIncomes,
    })
    cancelEdit()
  }

  const deleteProperty = (id: string) => {
    const updatedProperties = realEstateProperties.filter(p => p.id !== id)
    // 연동된 부채/소득도 삭제
    const updatedDebts = (data.debts || []).filter(d => d.sourceId !== id)
    const updatedIncomes = (data.incomeItems || []).filter(i => i.sourceId !== id)
    onUpdateData({
      realEstateProperties: updatedProperties,
      debts: updatedDebts,
      incomeItems: updatedIncomes,
    })
  }

  // 거주용 편집 폼
  const renderHousingEditForm = () => {
    const housingType = housingEditValues.housingType
    const hasLoan = housingHasLoan

    return (
      <div className={styles.editItem}>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>거주형태</span>
          <div className={styles.typeButtons}>
            {(['자가', '전세', '월세', '해당없음'] as const).map(type => (
              <button
                key={type}
                type="button"
                className={`${styles.typeBtn} ${housingType === type ? styles.active : ''}`}
                onClick={() => setHousingEditValues({ ...housingEditValues, housingType: type })}
              >
                {HOUSING_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {housingType && housingType !== '해당없음' && (
          <>
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>
                {housingType === '자가' ? '시세' : '보증금'}
              </span>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInput}
                  value={housingEditValues.housingValue || ''}
                  onChange={e => setHousingEditValues({ ...housingEditValues, housingValue: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.editUnit}>만원</span>
              </div>
            </div>

            {housingType === '월세' && (
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>월세</span>
                <div className={styles.editField}>
                  <input
                    type="number"
                    className={styles.editInput}
                    value={housingEditValues.housingRent || ''}
                    onChange={e => setHousingEditValues({ ...housingEditValues, housingRent: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder="0"
                  />
                  <span className={styles.editUnit}>만원</span>
                </div>
              </div>
            )}

            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>관리비</span>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInput}
                  value={housingEditValues.housingMaintenance || ''}
                  onChange={e => setHousingEditValues({ ...housingEditValues, housingMaintenance: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.editUnit}>만원/월</span>
              </div>
            </div>

            {(housingType === '자가' || housingType === '전세') && (
              <>
                <div className={styles.editDivider} />
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>대출</span>
                  <div className={styles.typeButtons}>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${!hasLoan ? styles.active : ''}`}
                      onClick={() => setHousingHasLoan(false)}
                    >
                      없음
                    </button>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${hasLoan ? styles.active : ''}`}
                      onClick={() => setHousingHasLoan(true)}
                    >
                      있음
                    </button>
                  </div>
                </div>

                {hasLoan && (
                  <>
                    <div className={styles.editRow}>
                      <span className={styles.editRowLabel}>대출금액</span>
                      <div className={styles.editField}>
                        <input
                          type="number"
                          className={styles.editInput}
                          value={housingEditValues.housingLoan || ''}
                          onChange={e => setHousingEditValues({ ...housingEditValues, housingLoan: e.target.value })}
                          onWheel={e => (e.target as HTMLElement).blur()}
                          placeholder="0"
                        />
                        <span className={styles.editUnit}>만원</span>
                      </div>
                    </div>
                    <div className={styles.editRow}>
                      <span className={styles.editRowLabel}>금리</span>
                      <div className={styles.editField}>
                        <input
                          type="number"
                          className={styles.editInputSmall}
                          value={housingEditValues.housingLoanRate || ''}
                          onChange={e => setHousingEditValues({ ...housingEditValues, housingLoanRate: e.target.value })}
                          onWheel={e => (e.target as HTMLElement).blur()}
                          step="0.1"
                          placeholder="3.5"
                        />
                        <span className={styles.editUnit}>%</span>
                      </div>
                    </div>
                    <div className={styles.editRow}>
                      <span className={styles.editRowLabel}>만기</span>
                      <div className={styles.editField}>
                        <input
                          type="number"
                          className={styles.editInputSmall}
                          value={housingEditValues.housingLoanMaturityYear || ''}
                          onChange={e => setHousingEditValues({ ...housingEditValues, housingLoanMaturityYear: e.target.value })}
                          onWheel={e => (e.target as HTMLElement).blur()}
                          placeholder={String(currentYear + 20)}
                        />
                        <span className={styles.editUnit}>년</span>
                        <input
                          type="number"
                          className={styles.editInputSmall}
                          value={housingEditValues.housingLoanMaturityMonth || ''}
                          onChange={e => setHousingEditValues({ ...housingEditValues, housingLoanMaturityMonth: e.target.value })}
                          onWheel={e => (e.target as HTMLElement).blur()}
                          min={1}
                          max={12}
                          placeholder="12"
                        />
                        <span className={styles.editUnit}>월</span>
                      </div>
                    </div>
                    <div className={styles.editRow}>
                      <span className={styles.editRowLabel}>상환방식</span>
                      <div className={styles.typeButtons}>
                        {(['원리금균등상환', '원금균등상환', '만기일시상환', '거치식상환'] as const).map(repType => (
                          <button
                            key={repType}
                            type="button"
                            className={`${styles.typeBtn} ${housingEditValues.housingLoanType === repType ? styles.active : ''}`}
                            onClick={() => setHousingEditValues({ ...housingEditValues, housingLoanType: repType })}
                          >
                            {REPAYMENT_TYPE_LABELS[repType]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={cancelHousingEdit}>취소</button>
          <button className={styles.saveBtn} onClick={saveHousingEdit}>저장</button>
        </div>
      </div>
    )
  }

  // 추가 부동산 편집 폼
  const renderPropertyEditForm = (usageType: RealEstateUsageType) => {
    const namePlaceholder = usageType === 'investment'
      ? '예: 판교 아파트, 분당 빌라'
      : usageType === 'rental'
        ? '예: 강남 오피스텔, 홍대 상가'
        : '예: 경기 토지, 제주 땅'

    const hasRentalIncome = editBooleans.hasRentalIncome
    const hasLoan = editBooleans.hasLoan
    const showRentalOption = usageType === 'rental' || usageType === 'investment'

    return (
      <div className={styles.editItem}>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>부동산명</span>
          <div className={styles.editField}>
            <input
              type="text"
              className={styles.editInputWide}
              value={editValues.name || ''}
              onChange={e => setEditValues({ ...editValues, name: e.target.value })}
              placeholder={namePlaceholder}
              autoFocus
            />
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>시세</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInput}
              value={editValues.marketValue || ''}
              onChange={e => setEditValues({ ...editValues, marketValue: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.editUnit}>만원</span>
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>취득일</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInputSmall}
              value={editValues.purchaseYear || ''}
              onChange={e => setEditValues({ ...editValues, purchaseYear: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              min={1990}
              max={currentYear}
              placeholder={String(currentYear)}
            />
            <span className={styles.editUnit}>년</span>
            <input
              type="number"
              className={styles.editInputSmall}
              value={editValues.purchaseMonth || ''}
              onChange={e => setEditValues({ ...editValues, purchaseMonth: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              min={1}
              max={12}
              placeholder={String(currentMonth)}
            />
            <span className={styles.editUnit}>월</span>
          </div>
        </div>

        {/* 임대 수익 (투자용/임대용만) */}
        {showRentalOption && (
          <>
            <div className={styles.editDivider} />
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>임대 수익</span>
              <div className={styles.typeButtons}>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${!hasRentalIncome ? styles.active : ''}`}
                  onClick={() => setEditBooleans({ ...editBooleans, hasRentalIncome: false })}
                >
                  없음
                </button>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${hasRentalIncome ? styles.active : ''}`}
                  onClick={() => setEditBooleans({ ...editBooleans, hasRentalIncome: true })}
                >
                  있음
                </button>
              </div>
            </div>

            {hasRentalIncome && (
              <>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>월 임대료</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInput}
                      value={editValues.monthlyRent || ''}
                      onChange={e => setEditValues({ ...editValues, monthlyRent: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      placeholder="0"
                    />
                    <span className={styles.editUnit}>만원</span>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>보증금</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInput}
                      value={editValues.deposit || ''}
                      onChange={e => setEditValues({ ...editValues, deposit: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      placeholder="0"
                    />
                    <span className={styles.editUnit}>만원</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* 대출 정보 */}
        <div className={styles.editDivider} />
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>대출</span>
          <div className={styles.typeButtons}>
            <button
              type="button"
              className={`${styles.typeBtn} ${!hasLoan ? styles.active : ''}`}
              onClick={() => setEditBooleans({ ...editBooleans, hasLoan: false })}
            >
              없음
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${hasLoan ? styles.active : ''}`}
              onClick={() => setEditBooleans({ ...editBooleans, hasLoan: true })}
            >
              있음
            </button>
          </div>
        </div>

        {hasLoan && (
          <>
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>대출금액</span>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInput}
                  value={editValues.loanAmount || ''}
                  onChange={e => setEditValues({ ...editValues, loanAmount: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.editUnit}>만원</span>
              </div>
            </div>
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>금리</span>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editValues.loanRate || ''}
                  onChange={e => setEditValues({ ...editValues, loanRate: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  step="0.1"
                  placeholder="4.0"
                />
                <span className={styles.editUnit}>%</span>
              </div>
            </div>
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>만기</span>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editValues.loanMaturityYear || ''}
                  onChange={e => setEditValues({ ...editValues, loanMaturityYear: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder={String(currentYear + 20)}
                />
                <span className={styles.editUnit}>년</span>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editValues.loanMaturityMonth || ''}
                  onChange={e => setEditValues({ ...editValues, loanMaturityMonth: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  min={1}
                  max={12}
                  placeholder="12"
                />
                <span className={styles.editUnit}>월</span>
              </div>
            </div>
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>상환방식</span>
              <div className={styles.typeButtons}>
                {(['원리금균등상환', '원금균등상환', '만기일시상환', '거치식상환'] as const).map(repType => (
                  <button
                    key={repType}
                    type="button"
                    className={`${styles.typeBtn} ${editValues.loanRepaymentType === repType ? styles.active : ''}`}
                    onClick={() => setEditValues({ ...editValues, loanRepaymentType: repType })}
                  >
                    {REPAYMENT_TYPE_LABELS[repType]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
          <button className={styles.saveBtn} onClick={saveProperty}>저장</button>
        </div>
      </div>
    )
  }

  // 부동산 아이템 렌더링
  const renderPropertyItem = (property: RealEstateProperty) => {
    const purchaseDate = property.purchaseYear
      ? `${property.purchaseYear}년${property.purchaseMonth ? ` ${property.purchaseMonth}월` : ''}`
      : null

    return (
      <div key={property.id} className={styles.assetItem}>
        <div className={styles.itemMain}>
          <span className={styles.itemLabel}>{USAGE_TYPE_LABELS[property.usageType]}</span>
          <span className={styles.itemAmount}>{formatMoney(property.marketValue)}</span>
          <span className={styles.itemName}>{property.name}</span>
          {purchaseDate && (
            <span className={styles.itemMeta}>{purchaseDate} 취득</span>
          )}
          {property.hasRentalIncome && property.monthlyRent && (
            <span className={styles.itemRent}>
              월 임대 {formatMoney(property.monthlyRent)}
              {property.deposit && ` | 보증금 ${formatMoney(property.deposit)}`}
            </span>
          )}
          {property.hasLoan && property.loanAmount && (
            <span className={styles.itemLoan}>
              대출 {formatMoney(property.loanAmount)}
              {property.loanRate && ` | ${property.loanRate}%`}
              {property.loanMaturity && ` | ${property.loanMaturity} 만기`}
            </span>
          )}
        </div>
        <div className={styles.itemActions}>
          <button className={styles.editBtn} onClick={() => startEditProperty(property)}>
            <Pencil size={16} />
          </button>
          <button className={styles.deleteBtn} onClick={() => deleteProperty(property.id)}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    )
  }

  // 차트 데이터
  const chartData = useMemo(() => {
    const labels: string[] = []
    const values: number[] = []
    const colors: string[] = []

    // 거주용 (자가만 자산으로 포함)
    if (data.housingType === '자가' && housingValue > 0) {
      labels.push('거주용 부동산')
      values.push(housingValue)
      colors.push(HOUSING_COLOR)
    }

    // 추가 부동산
    realEstateProperties.forEach(property => {
      labels.push(property.name)
      values.push(property.marketValue)
      colors.push(USAGE_COLORS[property.usageType])
    })

    return { labels, values, colors }
  }, [data.housingType, housingValue, realEstateProperties])

  const doughnutData = {
    labels: chartData.labels,
    datasets: [{
      data: chartData.values,
      backgroundColor: chartData.colors,
      borderWidth: 0,
    }],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { label?: string, raw: unknown }) => {
            return `${context.label || ''}: ${formatMoney(context.raw as number)}`
          },
        },
      },
    },
  }

  const hasData = totalRealEstateValue > 0 || hasHousing

  return (
    <div className={styles.container}>
      {/* 왼쪽: 부동산 입력 */}
      <div className={styles.inputPanel}>

        {/* ========== 거주용 부동산 ========== */}
        <section className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>거주용 부동산</span>
            {data.housingType === '자가' && housingValue > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(housingValue)}</span>
            )}
          </div>
          <p className={styles.sectionDesc}>
            현재 거주 중인 부동산. 온보딩에서 입력한 정보입니다.
          </p>

          <div className={styles.itemList}>
            {editingHousing ? (
              renderHousingEditForm()
            ) : hasHousing ? (
              <div className={styles.assetItem}>
                <div className={styles.itemMain}>
                  <span className={styles.itemLabel}>{data.housingType}</span>
                  <span className={styles.itemAmount}>
                    {data.housingType === '자가' ? formatMoney(housingValue) : `보증금 ${formatMoney(housingValue)}`}
                  </span>
                  {data.housingType === '월세' && data.housingRent && (
                    <span className={styles.itemMeta}>월세 {formatMoney(data.housingRent)}</span>
                  )}
                  {data.housingMaintenance && (
                    <span className={styles.itemMeta}>관리비 {formatMoney(data.housingMaintenance)}/월</span>
                  )}
                  {data.housingHasLoan && data.housingLoan && (
                    <span className={styles.itemLoan}>
                      대출 {formatMoney(data.housingLoan)}
                      {data.housingLoanRate && ` | ${data.housingLoanRate}%`}
                      {data.housingLoanMaturity && ` | ${data.housingLoanMaturity} 만기`}
                    </span>
                  )}
                </div>
                <div className={styles.itemActions}>
                  <button className={styles.editBtn} onClick={startEditHousing}>
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <button className={styles.addBtn} onClick={startEditHousing}>
                + 거주 정보 입력
              </button>
            )}
          </div>
        </section>

        {/* ========== 투자용 부동산 ========== */}
        <section className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>투자용 부동산</span>
            {investmentTotal > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(investmentTotal)}</span>
            )}
          </div>
          <p className={styles.sectionDesc}>
            거주 목적이 아닌 투자용 부동산 (아파트, 빌라, 주택 등).
          </p>

          <div className={styles.itemList}>
            {investmentProperties.map(property => (
              editingProperty?.usageType === 'investment' && editingProperty.id === property.id
                ? <div key={property.id}>{renderPropertyEditForm('investment')}</div>
                : renderPropertyItem(property)
            ))}

            {editingProperty?.usageType === 'investment' && editingProperty.id === null ? (
              renderPropertyEditForm('investment')
            ) : (
              <button className={styles.addBtn} onClick={() => startAddProperty('investment')}>
                + 투자용 부동산 추가
              </button>
            )}
          </div>
        </section>

        {/* ========== 임대용 부동산 ========== */}
        <section className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>임대용 부동산</span>
            {rentalTotal > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(rentalTotal)}</span>
            )}
          </div>
          <p className={styles.sectionDesc}>
            임대 수익 목적의 부동산 (상가, 오피스텔, 원룸 등).
          </p>

          <div className={styles.itemList}>
            {rentalProperties.map(property => (
              editingProperty?.usageType === 'rental' && editingProperty.id === property.id
                ? <div key={property.id}>{renderPropertyEditForm('rental')}</div>
                : renderPropertyItem(property)
            ))}

            {editingProperty?.usageType === 'rental' && editingProperty.id === null ? (
              renderPropertyEditForm('rental')
            ) : (
              <button className={styles.addBtn} onClick={() => startAddProperty('rental')}>
                + 임대용 부동산 추가
              </button>
            )}
          </div>
        </section>

        {/* ========== 토지 ========== */}
        <section className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>토지</span>
            {landTotal > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(landTotal)}</span>
            )}
          </div>
          <p className={styles.sectionDesc}>
            건물이 없는 토지, 땅 등.
          </p>

          <div className={styles.itemList}>
            {landProperties.map(property => (
              editingProperty?.usageType === 'land' && editingProperty.id === property.id
                ? <div key={property.id}>{renderPropertyEditForm('land')}</div>
                : renderPropertyItem(property)
            ))}

            {editingProperty?.usageType === 'land' && editingProperty.id === null ? (
              renderPropertyEditForm('land')
            ) : (
              <button className={styles.addBtn} onClick={() => startAddProperty('land')}>
                + 토지 추가
              </button>
            )}
          </div>
        </section>

        <p className={styles.infoText}>
          부동산 대출은 부채 탭에, 임대 수익은 소득 탭에 자동 연동됩니다.
        </p>
      </div>

      {/* 오른쪽: 요약 */}
      <div className={styles.summaryPanel}>
        {hasData ? (
          <>
            {/* 요약 카드 */}
            <div className={styles.summaryCard}>
              <div className={styles.totalAssets}>
                <span className={styles.totalLabel}>총 부동산 자산</span>
                <span className={styles.totalValue}>{formatMoney(totalRealEstateValue)}</span>
              </div>

              <div className={styles.subValues}>
                {data.housingType === '자가' && housingValue > 0 && (
                  <div className={styles.subValueItem}>
                    <span className={styles.subLabel}>거주용</span>
                    <span className={styles.subValue}>{formatMoney(housingValue)}</span>
                  </div>
                )}
                {additionalTotal > 0 && (
                  <div className={styles.subValueItem}>
                    <span className={styles.subLabel}>추가 부동산</span>
                    <span className={styles.subValue}>{formatMoney(additionalTotal)}</span>
                  </div>
                )}
              </div>

              {totalRealEstateLoans > 0 && (
                <div className={styles.loanSummary}>
                  <span className={styles.loanLabel}>총 부동산 대출</span>
                  <span className={styles.loanValue}>{formatMoney(totalRealEstateLoans)}</span>
                </div>
              )}

              {totalMonthlyRent > 0 && (
                <div className={styles.rentSummary}>
                  <span className={styles.rentLabel}>월 임대 수익</span>
                  <span className={styles.rentValue}>{formatMoney(totalMonthlyRent)}</span>
                </div>
              )}
            </div>

            {/* 부동산 현황 */}
            <div className={styles.countCard}>
              <h4 className={styles.cardTitle}>부동산 현황</h4>
              <div className={styles.countList}>
                <div className={styles.countRow}>
                  <span className={styles.countLabel}>거주용</span>
                  <span className={styles.countValue}>{hasHousing ? '1건' : '없음'}</span>
                </div>
                <div className={styles.countRow}>
                  <span className={styles.countLabel}>투자용</span>
                  <span className={styles.countValue}>{investmentProperties.length}건</span>
                </div>
                <div className={styles.countRow}>
                  <span className={styles.countLabel}>임대용</span>
                  <span className={styles.countValue}>{rentalProperties.length}건</span>
                </div>
                <div className={styles.countRow}>
                  <span className={styles.countLabel}>토지</span>
                  <span className={styles.countValue}>{landProperties.length}건</span>
                </div>
              </div>
            </div>

            {/* 자산 구성 차트 */}
            {chartData.values.length > 0 && (
              <div className={styles.chartCard}>
                <h4 className={styles.cardTitle}>부동산 구성</h4>
                <div className={styles.chartWrapper}>
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
                <div className={styles.legendList}>
                  {chartData.labels.map((label, index) => (
                    <div key={label} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: chartData.colors[index] }}></span>
                      <span className={styles.legendLabel}>{label}</span>
                      <span className={styles.legendValue}>{formatMoney(chartData.values[index])}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            <Building2 size={40} />
            <p>부동산 정보를 입력하면<br />분석 결과가 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
