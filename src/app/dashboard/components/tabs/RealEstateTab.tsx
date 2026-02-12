'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Trash2, Building2, Plus } from 'lucide-react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { RealEstate, RealEstateType, HousingType, LoanRepaymentType } from '@/types/tables'
import { formatMoney } from '@/lib/utils'
import { useRealEstates, useInvalidateByCategory } from '@/hooks/useFinancialData'
import {
  createRealEstate,
  updateRealEstate,
  deleteRealEstate,
  upsertResidenceRealEstate,
  REAL_ESTATE_TYPE_LABELS,
  HOUSING_TYPE_LABELS,
  REPAYMENT_TYPE_LABELS,
} from '@/lib/services/realEstateService'
import { TabSkeleton } from './shared/TabSkeleton'
import { useChartTheme } from '@/hooks/useChartTheme'
import styles from './RealEstateTab.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface RealEstateTabProps {
  simulationId: string
}

// 색상
const HOUSING_COLOR = '#007aff'
const USAGE_COLORS: Record<Exclude<RealEstateType, 'residence'>, string> = {
  investment: '#5856d6',
  rental: '#34c759',
  land: '#ff9500',
}

export function RealEstateTab({ simulationId }: RealEstateTabProps) {
  const { isDark } = useChartTheme()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: dbRealEstates = [], isLoading } = useRealEstates(simulationId)
  const invalidate = useInvalidateByCategory(simulationId)

  // 편집 상태
  const [editingProperty, setEditingProperty] = useState<{ type: RealEstateType, id: string | null } | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editBooleans, setEditBooleans] = useState<{ hasRentalIncome: boolean, hasLoan: boolean }>({ hasRentalIncome: false, hasLoan: false })
  const [isSaving, setIsSaving] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  // 타입별 분류
  const residenceProperty = useMemo(
    () => dbRealEstates.find(p => p.type === 'residence') || null,
    [dbRealEstates]
  )
  const investmentProperties = useMemo(
    () => dbRealEstates.filter(p => p.type === 'investment'),
    [dbRealEstates]
  )
  const rentalProperties = useMemo(
    () => dbRealEstates.filter(p => p.type === 'rental'),
    [dbRealEstates]
  )
  const landProperties = useMemo(
    () => dbRealEstates.filter(p => p.type === 'land'),
    [dbRealEstates]
  )

  // 합계 계산
  const investmentTotal = investmentProperties.reduce((sum, p) => sum + p.current_value, 0)
  const rentalTotal = rentalProperties.reduce((sum, p) => sum + p.current_value, 0)
  const landTotal = landProperties.reduce((sum, p) => sum + p.current_value, 0)
  const additionalTotal = investmentTotal + rentalTotal + landTotal

  // 거주용 자산 (자가만 자산으로 계산)
  const housingAssetValue = residenceProperty?.housing_type === '자가' ? residenceProperty.current_value : 0
  const housingLoanAmount = residenceProperty?.has_loan ? (residenceProperty.loan_amount || 0) : 0

  // 총 부동산 자산
  const totalRealEstateValue = housingAssetValue + additionalTotal

  // 총 부동산 대출
  const additionalLoans = dbRealEstates
    .filter(p => p.type !== 'residence')
    .reduce((sum, p) => sum + (p.has_loan ? (p.loan_amount || 0) : 0), 0)
  const totalRealEstateLoans = housingLoanAmount + additionalLoans

  // 월 임대 수익 합계
  const totalMonthlyRent = dbRealEstates.reduce((sum, p) => {
    return sum + (p.has_rental_income ? (p.rental_monthly || 0) : 0)
  }, 0)

  // 순자산
  const netRealEstateValue = totalRealEstateValue - totalRealEstateLoans

  // LTV 비율
  const ltvRatio = totalRealEstateValue > 0
    ? Math.round((totalRealEstateLoans / totalRealEstateValue) * 100)
    : 0

  // 연간 임대 수익률
  const rentalPropertiesValue = dbRealEstates
    .filter(p => p.has_rental_income)
    .reduce((sum, p) => sum + p.current_value, 0)
  const annualRentalYield = rentalPropertiesValue > 0
    ? ((totalMonthlyRent * 12) / rentalPropertiesValue * 100).toFixed(1)
    : '0'

  // 평균 대출 금리 계산
  const loansWithRates: { amount: number; rate: number }[] = dbRealEstates
    .filter(p => p.has_loan && p.loan_amount && p.loan_rate)
    .map(p => ({ amount: p.loan_amount!, rate: p.loan_rate! }))
  const avgLoanRate = loansWithRates.length > 0
    ? (loansWithRates.reduce((sum, l) => sum + (l.amount * l.rate), 0) /
       loansWithRates.reduce((sum, l) => sum + l.amount, 0)).toFixed(2)
    : '0'

  // 레버리지 배율
  const leverageRatio = netRealEstateValue > 0
    ? (totalRealEstateValue / netRealEstateValue).toFixed(1)
    : '1.0'

  // 편집 시작 (거주용)
  const startEditResidence = () => {
    const prop = residenceProperty
    let maturityYear = ''
    let maturityMonth = ''
    if (prop?.loan_maturity_year && prop?.loan_maturity_month) {
      maturityYear = prop.loan_maturity_year.toString()
      maturityMonth = prop.loan_maturity_month.toString()
    }
    const startYear = prop?.loan_start_year?.toString() || ''
    const startMonth = prop?.loan_start_month?.toString() || ''

    setEditingProperty({ type: 'residence', id: prop?.id || null })
    setEditBooleans({ hasRentalIncome: false, hasLoan: prop?.has_loan || false })
    setEditValues({
      housingType: prop?.housing_type || '',
      currentValue: prop?.current_value?.toString() || '',
      purchaseYear: prop?.purchase_year?.toString() || '',
      purchaseMonth: prop?.purchase_month?.toString() || '',
      purchasePrice: prop?.purchase_price?.toString() || '',
      monthlyRent: prop?.monthly_rent?.toString() || '',
      maintenanceFee: prop?.maintenance_fee?.toString() || '',
      loanAmount: prop?.loan_amount?.toString() || '',
      loanRate: prop?.loan_rate?.toString() || '',
      loanStartYear: startYear,
      loanStartMonth: startMonth,
      loanMaturityYear: maturityYear,
      loanMaturityMonth: maturityMonth,
      loanRepaymentType: prop?.loan_repayment_type || '',
      graceEndYear: prop?.grace_end_year?.toString() || '',
      graceEndMonth: prop?.grace_end_month?.toString() || '',
    })
  }

  // 편집 시작 (추가 부동산)
  const startAddProperty = (type: Exclude<RealEstateType, 'residence'>) => {
    setEditingProperty({ type, id: null })
    setEditBooleans({ hasRentalIncome: false, hasLoan: false })
    setEditValues({
      title: '',
      currentValue: '',
      purchaseYear: currentYear.toString(),
      purchaseMonth: currentMonth.toString(),
      rentalMonthly: '',
      rentalDeposit: '',
      loanAmount: '',
      loanRate: '',
      loanStartYear: currentYear.toString(),
      loanStartMonth: currentMonth.toString(),
      loanMaturityYear: '',
      loanMaturityMonth: '',
      loanRepaymentType: '',
      graceEndYear: '',
      graceEndMonth: '',
    })
    setShowTypeMenu(false)
  }

  const startEditProperty = (property: RealEstate) => {
    setEditingProperty({ type: property.type, id: property.id })

    let maturityYear = ''
    let maturityMonth = ''
    if (property.loan_maturity_year && property.loan_maturity_month) {
      maturityYear = property.loan_maturity_year.toString()
      maturityMonth = property.loan_maturity_month.toString()
    }

    setEditBooleans({
      hasRentalIncome: property.has_rental_income || false,
      hasLoan: property.has_loan || false,
    })
    setEditValues({
      title: property.title,
      currentValue: property.current_value.toString(),
      purchaseYear: property.purchase_year?.toString() || '',
      purchaseMonth: property.purchase_month?.toString() || '',
      rentalMonthly: property.rental_monthly?.toString() || '',
      rentalDeposit: property.rental_deposit?.toString() || '',
      loanAmount: property.loan_amount?.toString() || '',
      loanRate: property.loan_rate?.toString() || '',
      loanStartYear: property.loan_start_year?.toString() || '',
      loanStartMonth: property.loan_start_month?.toString() || '',
      loanMaturityYear: maturityYear,
      loanMaturityMonth: maturityMonth,
      loanRepaymentType: property.loan_repayment_type || '',
      graceEndYear: property.grace_end_year?.toString() || '',
      graceEndMonth: property.grace_end_month?.toString() || '',
    })
  }

  const cancelEdit = () => {
    setEditingProperty(null)
    setEditValues({})
    setEditBooleans({ hasRentalIncome: false, hasLoan: false })
  }

  // 저장 (거주용)
  const saveResidence = async () => {
    if (!editingProperty) return
    setIsSaving(true)

    try {
      const housingType = editValues.housingType as HousingType | null

      await upsertResidenceRealEstate(simulationId, {
        housing_type: housingType,
        current_value: editValues.currentValue ? parseFloat(editValues.currentValue) : 0,
        purchase_price: editValues.purchasePrice ? parseFloat(editValues.purchasePrice) : null,
        purchase_year: editValues.purchaseYear ? parseInt(editValues.purchaseYear) : null,
        purchase_month: editValues.purchaseMonth ? parseInt(editValues.purchaseMonth) : null,
        monthly_rent: editValues.monthlyRent ? parseFloat(editValues.monthlyRent) : null,
        maintenance_fee: editValues.maintenanceFee ? parseFloat(editValues.maintenanceFee) : null,
        has_loan: editBooleans.hasLoan,
        loan_amount: editValues.loanAmount ? parseFloat(editValues.loanAmount) : null,
        loan_rate: editValues.loanRate ? parseFloat(editValues.loanRate) : null,
        loan_start_year: editValues.loanStartYear ? parseInt(editValues.loanStartYear) : null,
        loan_start_month: editValues.loanStartMonth ? parseInt(editValues.loanStartMonth) : null,
        loan_maturity_year: editValues.loanMaturityYear ? parseInt(editValues.loanMaturityYear) : null,
        loan_maturity_month: editValues.loanMaturityMonth ? parseInt(editValues.loanMaturityMonth) : null,
        loan_repayment_type: editValues.loanRepaymentType as LoanRepaymentType | null,
        grace_end_year: editValues.loanRepaymentType === '거치식상환' && editValues.graceEndYear ? parseInt(editValues.graceEndYear) : null,
        grace_end_month: editValues.loanRepaymentType === '거치식상환' && editValues.graceEndMonth ? parseInt(editValues.graceEndMonth) : null,
      })

      invalidate('realEstates')
      cancelEdit()
    } catch (error) {
      console.error('Failed to save residence:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 저장 (추가 부동산)
  const saveProperty = async () => {
    if (!editingProperty || !editValues.title || !editValues.currentValue) return
    setIsSaving(true)

    try {
      const input = {
        simulation_id: simulationId,
        type: editingProperty.type,
        title: editValues.title,
        current_value: parseFloat(editValues.currentValue) || 0,
        purchase_year: editValues.purchaseYear ? parseInt(editValues.purchaseYear) : null,
        purchase_month: editValues.purchaseMonth ? parseInt(editValues.purchaseMonth) : null,
        has_rental_income: editBooleans.hasRentalIncome,
        rental_monthly: editBooleans.hasRentalIncome && editValues.rentalMonthly ? parseFloat(editValues.rentalMonthly) : null,
        rental_deposit: editBooleans.hasRentalIncome && editValues.rentalDeposit ? parseFloat(editValues.rentalDeposit) : null,
        rental_start_year: editBooleans.hasRentalIncome ? currentYear : null,
        rental_start_month: editBooleans.hasRentalIncome ? currentMonth : null,
        has_loan: editBooleans.hasLoan,
        loan_amount: editBooleans.hasLoan && editValues.loanAmount ? parseFloat(editValues.loanAmount) : null,
        loan_rate: editBooleans.hasLoan && editValues.loanRate ? parseFloat(editValues.loanRate) : null,
        loan_start_year: editBooleans.hasLoan && editValues.loanStartYear ? parseInt(editValues.loanStartYear) : null,
        loan_start_month: editBooleans.hasLoan && editValues.loanStartMonth ? parseInt(editValues.loanStartMonth) : null,
        loan_maturity_year: editBooleans.hasLoan && editValues.loanMaturityYear ? parseInt(editValues.loanMaturityYear) : null,
        loan_maturity_month: editBooleans.hasLoan && editValues.loanMaturityMonth ? parseInt(editValues.loanMaturityMonth) : null,
        loan_repayment_type: editBooleans.hasLoan && editValues.loanRepaymentType
          ? editValues.loanRepaymentType as LoanRepaymentType
          : null,
        grace_end_year: editBooleans.hasLoan && editValues.loanRepaymentType === '거치식상환' && editValues.graceEndYear
          ? parseInt(editValues.graceEndYear) : null,
        grace_end_month: editBooleans.hasLoan && editValues.loanRepaymentType === '거치식상환' && editValues.graceEndMonth
          ? parseInt(editValues.graceEndMonth) : null,
      }

      if (editingProperty.id) {
        await updateRealEstate(editingProperty.id, input)
      } else {
        await createRealEstate(input)
      }

      invalidate('realEstates')
      cancelEdit()
    } catch (error) {
      console.error('Failed to save property:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 부동산을 삭제하시겠습니까?')) return
    setIsSaving(true)

    try {
      await deleteRealEstate(id)
      invalidate('realEstates')
    } catch (error) {
      console.error('Failed to delete property:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 거주용 편집 폼
  const renderResidenceEditForm = () => {
    const housingType = editValues.housingType
    const hasLoan = editBooleans.hasLoan

    return (
      <div className={styles.editItem}>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>거주형태</span>
          <div className={styles.typeButtons}>
            {(['자가', '전세', '월세'] as const).map(type => (
              <button
                key={type}
                type="button"
                className={`${styles.typeBtn} ${housingType === type ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, housingType: type })}
              >
                {HOUSING_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {housingType && (
          <>
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>
                {housingType === '자가' ? '시세' : '보증금'}
              </span>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInput}
                  value={editValues.currentValue || ''}
                  onChange={e => setEditValues({ ...editValues, currentValue: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.editUnit}>만원</span>
              </div>
            </div>

            {housingType === '자가' && (
              <>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>취득일자</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.purchaseYear || ''}
                      onChange={e => setEditValues({ ...editValues, purchaseYear: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
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
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>취득가</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInput}
                      value={editValues.purchasePrice || ''}
                      onChange={e => setEditValues({ ...editValues, purchasePrice: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      placeholder="0"
                    />
                    <span className={styles.editUnit}>만원</span>
                  </div>
                </div>
              </>
            )}

            {housingType === '월세' && (
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>월세</span>
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
            )}

            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>관리비</span>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInput}
                  value={editValues.maintenanceFee || ''}
                  onChange={e => setEditValues({ ...editValues, maintenanceFee: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.editUnit}>만원/월</span>
              </div>
            </div>

            {housingType && (
              <>
                <div className={styles.editDivider} />
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>
                    {housingType === '자가' ? '주담대' : '전월세 보증금 대출'}
                  </span>
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
                          placeholder="3.5"
                        />
                        <span className={styles.editUnit}>%</span>
                      </div>
                    </div>
                    <div className={styles.editRow}>
                      <span className={styles.editRowLabel}>대출시작</span>
                      <div className={styles.editField}>
                        <input
                          type="number"
                          className={styles.editInputSmall}
                          value={editValues.loanStartYear || ''}
                          onChange={e => setEditValues({ ...editValues, loanStartYear: e.target.value })}
                          onWheel={e => (e.target as HTMLElement).blur()}
                          placeholder={String(currentYear)}
                        />
                        <span className={styles.editUnit}>년</span>
                        <input
                          type="number"
                          className={styles.editInputSmall}
                          value={editValues.loanStartMonth || ''}
                          onChange={e => setEditValues({ ...editValues, loanStartMonth: e.target.value })}
                          onWheel={e => (e.target as HTMLElement).blur()}
                          min={1}
                          max={12}
                          placeholder="1"
                        />
                        <span className={styles.editUnit}>월</span>
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
                    {editValues.loanRepaymentType === '거치식상환' && (
                      <div className={styles.editRow}>
                        <span className={styles.editRowLabel}>거치종료</span>
                        <div className={styles.editField}>
                          <input
                            type="number"
                            className={styles.editInputSmall}
                            value={editValues.graceEndYear || ''}
                            onChange={e => setEditValues({ ...editValues, graceEndYear: e.target.value })}
                            onWheel={e => (e.target as HTMLElement).blur()}
                            placeholder={String(currentYear + 1)}
                          />
                          <span className={styles.editUnit}>년</span>
                          <input
                            type="number"
                            className={styles.editInputSmall}
                            value={editValues.graceEndMonth || ''}
                            onChange={e => setEditValues({ ...editValues, graceEndMonth: e.target.value })}
                            onWheel={e => (e.target as HTMLElement).blur()}
                            min={1}
                            max={12}
                            placeholder="12"
                          />
                          <span className={styles.editUnit}>월</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={cancelEdit} disabled={isSaving}>취소</button>
          <button className={styles.saveBtn} onClick={saveResidence} disabled={isSaving}>
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    )
  }

  // 추가 부동산 편집 폼
  const renderPropertyEditForm = (type: Exclude<RealEstateType, 'residence'>) => {
    const namePlaceholder = type === 'investment'
      ? '예: 판교 아파트, 분당 빌라'
      : type === 'rental'
        ? '예: 강남 오피스텔, 홍대 상가'
        : '예: 경기 토지, 제주 땅'

    const hasRentalIncome = editBooleans.hasRentalIncome
    const hasLoan = editBooleans.hasLoan
    const showRentalOption = type === 'rental' || type === 'investment'

    return (
      <div className={styles.editItem}>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>부동산명</span>
          <div className={styles.editField}>
            <input
              type="text"
              className={styles.editInputWide}
              value={editValues.title || ''}
              onChange={e => setEditValues({ ...editValues, title: e.target.value })}
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
              value={editValues.currentValue || ''}
              onChange={e => setEditValues({ ...editValues, currentValue: e.target.value })}
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
                      value={editValues.rentalMonthly || ''}
                      onChange={e => setEditValues({ ...editValues, rentalMonthly: e.target.value })}
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
                      value={editValues.rentalDeposit || ''}
                      onChange={e => setEditValues({ ...editValues, rentalDeposit: e.target.value })}
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
              <span className={styles.editRowLabel}>대출시작</span>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editValues.loanStartYear || ''}
                  onChange={e => setEditValues({ ...editValues, loanStartYear: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder={String(currentYear)}
                />
                <span className={styles.editUnit}>년</span>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editValues.loanStartMonth || ''}
                  onChange={e => setEditValues({ ...editValues, loanStartMonth: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  min={1}
                  max={12}
                  placeholder="1"
                />
                <span className={styles.editUnit}>월</span>
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
            {editValues.loanRepaymentType === '거치식상환' && (
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>거치종료</span>
                <div className={styles.editField}>
                  <input
                    type="number"
                    className={styles.editInputSmall}
                    value={editValues.graceEndYear || ''}
                    onChange={e => setEditValues({ ...editValues, graceEndYear: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder={String(currentYear + 1)}
                  />
                  <span className={styles.editUnit}>년</span>
                  <input
                    type="number"
                    className={styles.editInputSmall}
                    value={editValues.graceEndMonth || ''}
                    onChange={e => setEditValues({ ...editValues, graceEndMonth: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    min={1}
                    max={12}
                    placeholder="12"
                  />
                  <span className={styles.editUnit}>월</span>
                </div>
              </div>
            )}
          </>
        )}

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={cancelEdit} disabled={isSaving}>취소</button>
          <button className={styles.saveBtn} onClick={saveProperty} disabled={isSaving}>
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    )
  }

  // 부동산 아이템 렌더링
  const renderPropertyItem = (property: RealEstate) => {
    // 메타 정보 구성
    const metaParts = []

    if (property.purchase_year) {
      metaParts.push(`${property.purchase_year}년${property.purchase_month ? ` ${property.purchase_month}월` : ''} 취득`)
    }

    if (property.has_rental_income && property.rental_monthly) {
      const rentInfo = `월 임대 ${formatMoney(property.rental_monthly)}`
      if (property.rental_deposit) {
        metaParts.push(`${rentInfo} | 보증금 ${formatMoney(property.rental_deposit)}`)
      } else {
        metaParts.push(rentInfo)
      }
    }

    if (property.has_loan && property.loan_amount) {
      const loanParts = [`대출 ${formatMoney(property.loan_amount)}`]
      if (property.loan_rate) loanParts.push(`${property.loan_rate}%`)
      if (property.loan_repayment_type) loanParts.push(REPAYMENT_TYPE_LABELS[property.loan_repayment_type])
      if (property.loan_maturity_year) {
        loanParts.push(`${property.loan_maturity_year}.${String(property.loan_maturity_month || 1).padStart(2, '0')} 만기`)
      }
      metaParts.push(loanParts.join(' | '))
    }

    return (
      <div key={property.id} className={styles.assetItem}>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{property.title}</span>
          {metaParts.length > 0 && (
            <span className={styles.itemMeta}>
              {metaParts.join(' | ')}
            </span>
          )}
        </div>
        <div className={styles.itemRight}>
          <span className={styles.itemAmount}>{formatMoney(property.current_value)}</span>
          <div className={styles.itemActions}>
            <button className={styles.editBtn} onClick={() => startEditProperty(property)}>
              <Pencil size={16} />
            </button>
            <button className={styles.deleteBtn} onClick={() => handleDelete(property.id)} disabled={isSaving}>
              <Trash2 size={16} />
            </button>
          </div>
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
    if (residenceProperty?.housing_type === '자가' && housingAssetValue > 0) {
      labels.push('거주용 부동산')
      values.push(housingAssetValue)
      colors.push(HOUSING_COLOR)
    }

    // 추가 부동산
    ;[...investmentProperties, ...rentalProperties, ...landProperties].forEach(property => {
      labels.push(property.title)
      values.push(property.current_value)
      colors.push(USAGE_COLORS[property.type as Exclude<RealEstateType, 'residence'>])
    })

    return { labels, values, colors }
  }, [residenceProperty, housingAssetValue, investmentProperties, rentalProperties, landProperties])

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

  const hasData = totalRealEstateValue > 0 || !!residenceProperty

  // ESC 키로 드롭다운 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTypeMenu) {
        setShowTypeMenu(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showTypeMenu])

  // 드롭다운 외부 클릭으로 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showTypeMenu &&
        addButtonRef.current &&
        !addButtonRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest(`.${styles.typeMenu}`)
      ) {
        setShowTypeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTypeMenu])

  if (isLoading && dbRealEstates.length === 0) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={2} itemsPerSection={2} />
      </div>
    )
  }

  const totalPropertyCount = dbRealEstates.length

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.headerToggle} onClick={() => setIsExpanded(!isExpanded)} type="button">
          <span className={styles.title}>부동산</span>
          <span className={styles.count}>{totalPropertyCount}개</span>
        </button>
        <div className={styles.headerRight}>
          <button
            ref={addButtonRef}
            className={styles.addIconBtn}
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            type="button"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* 타입 선택 드롭다운 - portal로 body에 렌더 */}
      {showTypeMenu && addButtonRef.current && createPortal(
        <div
          className={styles.typeMenu}
          style={{
            position: 'fixed',
            top: addButtonRef.current.getBoundingClientRect().bottom + 6,
            left: addButtonRef.current.getBoundingClientRect().right - 150,
            background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}
        >
          <button
            className={styles.typeMenuItem}
            onClick={() => startEditResidence()}
          >
            거주용
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => startAddProperty('investment')}
          >
            투자용
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => startAddProperty('rental')}
          >
            임대용
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => startAddProperty('land')}
          >
            토지
          </button>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.flatList}>
          {dbRealEstates.length === 0 && !editingProperty && (
            <p className={styles.emptyHint}>
              아직 등록된 부동산이 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}

          {/* 거주용 */}
          {editingProperty?.type === 'residence' ? (
            renderResidenceEditForm()
          ) : residenceProperty ? (
            <div className={styles.assetItem}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{residenceProperty.housing_type}</span>
                <span className={styles.itemMeta}>
                  {(() => {
                    const metaParts: string[] = []

                    if (residenceProperty.housing_type === '자가') {
                      if (residenceProperty.purchase_year && residenceProperty.purchase_month) {
                        metaParts.push(`취득 ${residenceProperty.purchase_year}.${String(residenceProperty.purchase_month).padStart(2, '0')}`)
                      }
                      if (residenceProperty.purchase_price) {
                        metaParts.push(`취득가 ${formatMoney(residenceProperty.purchase_price)}`)
                      }
                    }

                    if (residenceProperty.housing_type === '월세' && residenceProperty.monthly_rent) {
                      metaParts.push(`월세 ${formatMoney(residenceProperty.monthly_rent)}`)
                    }

                    if (residenceProperty.maintenance_fee) {
                      metaParts.push(`관리비 ${formatMoney(residenceProperty.maintenance_fee)}/월`)
                    }

                    if (residenceProperty.has_loan && residenceProperty.loan_amount) {
                      const loanLabel = residenceProperty.housing_type === '자가' ? '주담대' : '전월세 보증금 대출'
                      const loanParts = [`${loanLabel} ${formatMoney(residenceProperty.loan_amount)}`]
                      if (residenceProperty.loan_rate) loanParts.push(`${residenceProperty.loan_rate}%`)
                      if (residenceProperty.loan_repayment_type) loanParts.push(REPAYMENT_TYPE_LABELS[residenceProperty.loan_repayment_type])
                      if (residenceProperty.loan_maturity_year) {
                        loanParts.push(`${residenceProperty.loan_maturity_year}.${String(residenceProperty.loan_maturity_month || 1).padStart(2, '0')} 만기`)
                      }
                      metaParts.push(loanParts.join(' | '))
                    }

                    return metaParts.join(' | ')
                  })()}
                </span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemAmount}>
                  {residenceProperty.housing_type === '자가'
                    ? formatMoney(residenceProperty.current_value)
                    : `보증금 ${formatMoney(residenceProperty.current_value)}`}
                </span>
                <div className={styles.itemActions}>
                  <button className={styles.editBtn} onClick={startEditResidence}>
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* 투자용 */}
          {investmentProperties.map(property => (
            editingProperty?.type === 'investment' && editingProperty.id === property.id
              ? <div key={property.id}>{renderPropertyEditForm('investment')}</div>
              : renderPropertyItem(property)
          ))}

          {/* 임대용 */}
          {rentalProperties.map(property => (
            editingProperty?.type === 'rental' && editingProperty.id === property.id
              ? <div key={property.id}>{renderPropertyEditForm('rental')}</div>
              : renderPropertyItem(property)
          ))}

          {/* 토지 */}
          {landProperties.map(property => (
            editingProperty?.type === 'land' && editingProperty.id === property.id
              ? <div key={property.id}>{renderPropertyEditForm('land')}</div>
              : renderPropertyItem(property)
          ))}

          {/* 추가 폼 (+ 드롭다운에서 선택 시) */}
          {editingProperty && editingProperty.id === null && editingProperty.type !== 'residence' && (
            renderPropertyEditForm(editingProperty.type as Exclude<typeof editingProperty.type, 'residence'>)
          )}
        </div>
      )}
    </div>
  )
}
