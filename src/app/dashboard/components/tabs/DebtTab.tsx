'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X, Plus, ArrowLeft } from 'lucide-react'
import type { Debt, DebtInput, LoanRepaymentType, RateType, Owner } from '@/types/tables'
import { formatMoney } from '@/lib/utils'
import { formatPeriodDisplay, toPeriodRaw, isPeriodValid, restorePeriodCursor } from '@/lib/utils/periodInput'
import { useDebts, useInvalidateByCategory } from '@/hooks/useFinancialData'
import {
  createDebt,
  updateDebt,
  deleteDebt,
  calculateMonthlyPayment,
  getCategoryFromDebt,
  getDebtTypeFromCategory,
  REPAYMENT_OPTIONS,
  DEFAULT_LOAN_RATE,
  getDefaultMaturity,
  type UIDebtCategory,
} from '@/lib/services/debtService'
import { TabSkeleton } from './shared/TabSkeleton'
import { useChartTheme } from '@/hooks/useChartTheme'
import styles from './DebtTab.module.css'

interface DebtTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  spouseRetirementAge?: number
  isMarried: boolean
  selfLifeExpectancy?: number
  spouseLifeExpectancy?: number
}

interface EditingDebt {
  id: string | null
  category: UIDebtCategory
  name: string
  amount: string
  rate: string
  rateType: RateType
  spread: string
  startYear: string
  startMonth: string
  maturityYear: string
  maturityMonth: string
  repaymentType: LoanRepaymentType
  graceEndYear: string
  graceEndMonth: string
  owner: Owner
}

const initialEditingDebt: EditingDebt = {
  id: null,
  category: 'credit',
  name: '',
  amount: '',
  rate: String(DEFAULT_LOAN_RATE),
  rateType: 'fixed',
  spread: '1.5',
  startYear: '',
  startMonth: '',
  maturityYear: '',
  maturityMonth: '',
  repaymentType: '원리금균등상환',
  graceEndYear: '',
  graceEndMonth: '',
  owner: 'self',
}

// 부채 + 계산 정보
interface DebtWithPayment extends Debt {
  monthlyPayment: number
  totalInterest: number
}

export function DebtTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  spouseRetirementAge,
  isMarried,
  selfLifeExpectancy,
  spouseLifeExpectancy,
}: DebtTabProps) {
  const { isDark } = useChartTheme()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // 나이 및 은퇴 연도 계산
  const currentAge = currentYear - birthYear
  const selfRetirementYear = currentYear + (retirementAge - currentAge)
  const spouseCurrentAge = spouseBirthYear ? currentYear - spouseBirthYear : null
  const spouseRetirementYear = useMemo(() => {
    if (!spouseBirthYear || spouseCurrentAge === null) return selfRetirementYear
    return currentYear + ((spouseRetirementAge || 60) - spouseCurrentAge)
  }, [spouseBirthYear, currentYear, selfRetirementYear, spouseCurrentAge, spouseRetirementAge])
  const hasSpouse = isMarried && spouseBirthYear

  // 기대수명 연도 계산
  const selfLifeExpectancyYear = birthYear + (selfLifeExpectancy || 100)
  const spouseLifeExpectancyYear = spouseBirthYear
    ? spouseBirthYear + (spouseLifeExpectancy || selfLifeExpectancy || 100)
    : selfLifeExpectancyYear

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: debts = [], isLoading } = useDebts(simulationId)
  const invalidate = useInvalidateByCategory(simulationId)

  // 편집 상태
  const [editingDebt, setEditingDebt] = useState<EditingDebt | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  // Period text inputs
  const [startDateText, setStartDateText] = useState('')
  const [maturityDateText, setMaturityDateText] = useState('')
  const [graceEndDateText, setGraceEndDateText] = useState('')
  const [startType, setStartType] = useState<'current' | 'self-retirement' | 'spouse-retirement' | 'year'>('current')
  const [maturityType, setMaturityType] = useState<'self-retirement' | 'spouse-retirement' | 'self-life-expectancy' | 'spouse-life-expectancy' | 'year'>('self-retirement')
  const [graceEndType, setGraceEndType] = useState<'self-retirement' | 'spouse-retirement' | 'self-life-expectancy' | 'spouse-life-expectancy' | 'year'>('year')

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [addingCategory, setAddingCategory] = useState<UIDebtCategory | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  // 부채에 월 상환액 정보 추가
  const addPaymentInfo = (debt: Debt): DebtWithPayment => {
    const { monthlyPayment, totalInterest } = calculateMonthlyPayment(
      debt.principal || 0,
      debt.interest_rate || 0,
      debt.start_year,
      debt.start_month,
      debt.maturity_year,
      debt.maturity_month,
      debt.repayment_type,
      debt.grace_period_months || 0
    )
    return { ...debt, monthlyPayment, totalInterest }
  }

  // 부채 카테고리별 분류 (user-created only)
  const categorizedDebts = useMemo(() => {
    const result: Record<'credit' | 'other', DebtWithPayment[]> = {
      credit: [],
      other: [],
    }

    debts.forEach(debt => {
      // 연결된 부채(real_estate, physical_asset) 제외
      if (debt.source_type !== null) return

      const category = getCategoryFromDebt(debt)
      if (category === 'credit' || category === 'other') {
        result[category].push(addPaymentInfo(debt))
      }
    })

    return result
  }, [debts])

  // 총계 계산
  const totals = useMemo(() => {
    const all = [
      ...categorizedDebts.credit,
      ...categorizedDebts.other,
    ]
    return {
      totalDebt: all.reduce((sum, d) => sum + (d.principal || 0), 0),
      totalMonthlyPayment: all.reduce((sum, d) => sum + d.monthlyPayment, 0),
      totalInterest: all.reduce((sum, d) => sum + d.totalInterest, 0),
      byCategory: {
        credit: categorizedDebts.credit.reduce((sum, d) => sum + (d.principal || 0), 0),
        other: categorizedDebts.other.reduce((sum, d) => sum + (d.principal || 0), 0),
      }
    }
  }, [categorizedDebts])

  // DSR (임시로 0 - 소득 데이터 필요)
  const dsr = 0

  // 가장 빠른/늦은 만기
  const maturityDates = useMemo(() => {
    const allDebts = [
      ...categorizedDebts.credit,
      ...categorizedDebts.other,
    ]
    if (allDebts.length === 0) return { earliest: null, latest: null }

    const sorted = [...allDebts].sort((a, b) => {
      const aDate = a.maturity_year * 100 + a.maturity_month
      const bDate = b.maturity_year * 100 + b.maturity_month
      return aDate - bDate
    })
    return {
      earliest: sorted[0],
      latest: sorted[sorted.length - 1],
    }
  }, [categorizedDebts])

  // 고금리 부채 (금리 5% 이상)
  const highInterestDebts = useMemo(() => {
    const allDebts = [
      ...categorizedDebts.credit,
      ...categorizedDebts.other,
    ]
    return allDebts
      .filter(d => (d.interest_rate || 0) >= 5)
      .sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))
  }, [categorizedDebts])

  // 담보 대출 비율 (removed - no linked debts anymore)
  // const securedDebtRatio = 0

  const hasData = totals.totalDebt > 0

  // 부채 추가 시작
  const startAddDebt = (category: 'credit' | 'other') => {
    const defaultMat = getDefaultMaturity()
    setAddingCategory(category)
    setEditingDebt({
      ...initialEditingDebt,
      category,
      name: category === 'credit' ? '신용대출' : '',
      startYear: String(currentYear),
      startMonth: String(currentMonth),
      maturityYear: String(defaultMat.year),
      maturityMonth: String(defaultMat.month),
      owner: 'self',
    })
    // Initialize period inputs
    setStartType('current')
    setMaturityType('self-retirement')
    setGraceEndType('year')
    setStartDateText(toPeriodRaw(currentYear, currentMonth))
    setMaturityDateText(toPeriodRaw(defaultMat.year, defaultMat.month))
    setGraceEndDateText('')
    // Keep showTypeMenu open for step 2
  }

  // 추가 폼 리셋
  const resetAddForm = () => {
    setShowTypeMenu(false)
    setAddingCategory(null)
    setEditingDebt(null)
    setStartDateText('')
    setMaturityDateText('')
    setGraceEndDateText('')
    setStartType('current')
    setMaturityType('self-retirement')
    setGraceEndType('year')
  }

  // 부채 편집 시작
  const startEditDebt = (debt: DebtWithPayment, category: 'credit' | 'other') => {
    const defaultMat = getDefaultMaturity()
    // 거치 종료일 계산: 시작일 + grace_period_months
    const graceMonths = debt.grace_period_months || 0
    const sYear = debt.start_year || currentYear
    const sMonth = debt.start_month || currentMonth
    const graceEndTotal = sYear * 12 + (sMonth - 1) + graceMonths
    const gEndYear = Math.floor(graceEndTotal / 12)
    const gEndMonth = (graceEndTotal % 12) + 1
    const mYear = debt.maturity_year || defaultMat.year
    const mMonth = debt.maturity_month || defaultMat.month

    setEditingDebt({
      id: debt.id,
      category,
      name: debt.title || '',
      amount: debt.principal?.toString() || '',
      rate: debt.interest_rate?.toString() || String(DEFAULT_LOAN_RATE),
      rateType: debt.rate_type || 'fixed',
      spread: debt.spread?.toString() || '1.5',
      startYear: sYear.toString(),
      startMonth: sMonth.toString(),
      maturityYear: mYear.toString(),
      maturityMonth: mMonth.toString(),
      repaymentType: debt.repayment_type || '원리금균등상환',
      graceEndYear: graceMonths > 0 ? String(gEndYear) : '',
      graceEndMonth: graceMonths > 0 ? String(gEndMonth) : '',
      owner: debt.owner || 'self',
    })

    // Determine types and initialize text
    if (sYear === currentYear && sMonth === currentMonth) {
      setStartType('current')
    } else if (sYear === selfRetirementYear && sMonth === 12) {
      setStartType('self-retirement')
    } else if (hasSpouse && sYear === spouseRetirementYear && sMonth === 12) {
      setStartType('spouse-retirement')
    } else {
      setStartType('year')
    }

    if (mYear === selfRetirementYear && mMonth === 12) {
      setMaturityType('self-retirement')
    } else if (hasSpouse && mYear === spouseRetirementYear && mMonth === 12) {
      setMaturityType('spouse-retirement')
    } else if (mYear === selfLifeExpectancyYear && mMonth === 12) {
      setMaturityType('self-life-expectancy')
    } else if (hasSpouse && mYear === spouseLifeExpectancyYear && mMonth === 12) {
      setMaturityType('spouse-life-expectancy')
    } else {
      setMaturityType('year')
    }

    if (graceMonths > 0) {
      if (gEndYear === selfRetirementYear && gEndMonth === 12) {
        setGraceEndType('self-retirement')
      } else if (hasSpouse && gEndYear === spouseRetirementYear && gEndMonth === 12) {
        setGraceEndType('spouse-retirement')
      } else if (gEndYear === selfLifeExpectancyYear && gEndMonth === 12) {
        setGraceEndType('self-life-expectancy')
      } else if (hasSpouse && gEndYear === spouseLifeExpectancyYear && gEndMonth === 12) {
        setGraceEndType('spouse-life-expectancy')
      } else {
        setGraceEndType('year')
      }
      setGraceEndDateText(toPeriodRaw(gEndYear, gEndMonth))
    } else {
      setGraceEndType('year')
      setGraceEndDateText('')
    }

    setStartDateText(toPeriodRaw(sYear, sMonth))
    setMaturityDateText(toPeriodRaw(mYear, mMonth))
  }

  // 부채 저장
  const handleSaveDebt = async () => {
    if (!editingDebt) return

    try {
      const principal = parseFloat(editingDebt.amount) || 0
      const rate = parseFloat(editingDebt.rate) || 0
      const spread = parseFloat(editingDebt.spread) || 0
      const startYear = parseInt(editingDebt.startYear) || currentYear
      const startMonth = parseInt(editingDebt.startMonth) || currentMonth
      const maturityYear = parseInt(editingDebt.maturityYear) || currentYear + 5
      const maturityMonth = parseInt(editingDebt.maturityMonth) || 12

      // 거치기간 계산: graceEnd - start (월 단위)
      let gracePeriodMonths = 0
      if (editingDebt.repaymentType === '거치식상환' && editingDebt.graceEndYear && editingDebt.graceEndMonth) {
        const gEndYear = parseInt(editingDebt.graceEndYear)
        const gEndMonth = parseInt(editingDebt.graceEndMonth)
        gracePeriodMonths = (gEndYear - startYear) * 12 + (gEndMonth - startMonth)
        if (gracePeriodMonths < 0) gracePeriodMonths = 0
      }

      const input: DebtInput = {
        simulation_id: simulationId,
        type: getDebtTypeFromCategory(editingDebt.category),
        title: editingDebt.name || (editingDebt.category === 'credit' ? '신용대출' : '기타 부채'),
        principal,
        current_balance: principal,
        interest_rate: editingDebt.rateType === 'fixed' ? rate : 3.5, // 변동금리면 기준금리 기본값
        rate_type: editingDebt.rateType,
        spread: editingDebt.rateType === 'floating' ? spread : null,
        repayment_type: editingDebt.repaymentType,
        grace_period_months: gracePeriodMonths,
        start_year: startYear,
        start_month: startMonth,
        maturity_year: maturityYear,
        maturity_month: maturityMonth,
        owner: editingDebt.owner,
      }

      if (editingDebt.id) {
        await updateDebt(editingDebt.id, input)
        setEditingDebt(null)
      } else {
        await createDebt(input)
        resetAddForm()
      }

      invalidate('debts')
    } catch (error) {
      console.error('Failed to save debt:', error)
    }
  }

  // 부채 삭제
  const handleDeleteDebt = async (id: string) => {
    try {
      await deleteDebt(id)
      invalidate('debts')
    } catch (error) {
      console.error('Failed to delete debt:', error)
    }
  }

  // 편집 폼 렌더링 (모달 안에서 사용)
  const renderEditForm = () => {
    if (!editingDebt) return null

    const isEditMode = !!editingDebt.id

    return (
      <>
        {/* 이름 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>이름</span>
          <input
            type="text"
            className={styles.modalFormInput}
            value={editingDebt.name}
            onChange={e => setEditingDebt({ ...editingDebt, name: e.target.value })}
            placeholder={editingDebt.category === 'credit' ? '신용대출' : '부채명'}
            autoFocus={!isEditMode}
          />
        </div>

        {/* 소유자 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>소유자</span>
          <div className={styles.ownerButtons}>
            <button
              type="button"
              className={`${styles.ownerBtn} ${editingDebt.owner === 'self' ? styles.active : ''}`}
              onClick={() => setEditingDebt({ ...editingDebt, owner: 'self' })}
            >
              본인
            </button>
            {hasSpouse && (
              <button
                type="button"
                className={`${styles.ownerBtn} ${editingDebt.owner === 'spouse' ? styles.active : ''}`}
                onClick={() => setEditingDebt({ ...editingDebt, owner: 'spouse' })}
              >
                배우자
              </button>
            )}
          </div>
        </div>

        {/* 금액 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>금액</span>
          <input
            type="number"
            className={styles.modalFormInput}
            value={editingDebt.amount}
            onChange={e => setEditingDebt({ ...editingDebt, amount: e.target.value })}
            onWheel={e => (e.target as HTMLElement).blur()}
            placeholder="0"
          />
          <span className={styles.modalFormUnit}>만원</span>
        </div>

        {/* 금리 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>금리</span>
          <div className={styles.ownerButtons}>
            <button
              type="button"
              className={`${styles.ownerBtn} ${editingDebt.rateType === 'fixed' ? styles.active : ''}`}
              onClick={() => setEditingDebt({ ...editingDebt, rateType: 'fixed' })}
            >
              고정
            </button>
            <button
              type="button"
              className={`${styles.ownerBtn} ${editingDebt.rateType === 'floating' ? styles.active : ''}`}
              onClick={() => setEditingDebt({ ...editingDebt, rateType: 'floating' })}
            >
              변동
            </button>
          </div>
        </div>

        {editingDebt.rateType === 'fixed' ? (
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}></span>
            <input
              type="number"
              className={styles.modalFormInput}
              value={editingDebt.rate}
              onChange={e => setEditingDebt({ ...editingDebt, rate: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
              step="0.1"
            />
            <span className={styles.modalFormUnit}>%</span>
          </div>
        ) : (
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}></span>
            <span className={styles.modalFormUnit}>기준금리 +</span>
            <input
              type="number"
              className={styles.modalFormInput}
              value={editingDebt.spread}
              onChange={e => setEditingDebt({ ...editingDebt, spread: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="1.5"
              step="0.1"
            />
            <span className={styles.modalFormUnit}>%</span>
          </div>
        )}

        {/* 시작일 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>시작일</span>
          <div className={styles.fieldContent}>
            <select
              className={styles.periodSelect}
              value={startType}
              onChange={(e) => {
                const val = e.target.value
                if (val === 'current') {
                  setStartType('current')
                  setEditingDebt({ ...editingDebt, startYear: String(currentYear), startMonth: String(currentMonth) })
                  setStartDateText(toPeriodRaw(currentYear, currentMonth))
                } else if (val === 'self-retirement') {
                  setStartType('self-retirement')
                  setEditingDebt({ ...editingDebt, startYear: String(selfRetirementYear), startMonth: '12' })
                  setStartDateText(toPeriodRaw(selfRetirementYear, 12))
                } else if (val === 'spouse-retirement') {
                  setStartType('spouse-retirement')
                  setEditingDebt({ ...editingDebt, startYear: String(spouseRetirementYear), startMonth: '12' })
                  setStartDateText(toPeriodRaw(spouseRetirementYear, 12))
                } else {
                  setStartType('year')
                  const y = parseInt(editingDebt.startYear) || currentYear
                  const m = parseInt(editingDebt.startMonth) || currentMonth
                  setStartDateText(toPeriodRaw(y, m))
                }
              }}
            >
              <option value="current">현재</option>
              <option value="self-retirement">본인 은퇴</option>
              {hasSpouse && <option value="spouse-retirement">배우자 은퇴</option>}
              <option value="year">직접 입력</option>
            </select>
            {startType === 'year' && (
              <input
                type="text"
                className={`${styles.periodInput}${startDateText.length > 0 && !isPeriodValid(startDateText) ? ` ${styles.invalid}` : ''}`}
                value={formatPeriodDisplay(startDateText)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 6)
                  restorePeriodCursor(e.target as HTMLInputElement, raw)
                  setStartDateText(raw)
                  let y = parseInt(editingDebt.startYear) || currentYear
                  let m = parseInt(editingDebt.startMonth) || currentMonth
                  if (raw.length >= 4) {
                    const py = parseInt(raw.slice(0, 4))
                    if (!isNaN(py)) y = py
                  }
                  if (raw.length >= 5) {
                    const pm = parseInt(raw.slice(4))
                    if (!isNaN(pm) && pm >= 1 && pm <= 12) m = pm
                  }
                  setEditingDebt({ ...editingDebt, startYear: String(y), startMonth: String(m) })
                }}
                placeholder="2026.01"
              />
            )}
          </div>
        </div>

        {/* 만기 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>만기</span>
          <div className={styles.fieldContent}>
            <select
              className={styles.periodSelect}
              value={maturityType}
              onChange={(e) => {
                const val = e.target.value
                if (val === 'self-retirement') {
                  setMaturityType('self-retirement')
                  setEditingDebt({ ...editingDebt, maturityYear: String(selfRetirementYear), maturityMonth: '12' })
                  setMaturityDateText(toPeriodRaw(selfRetirementYear, 12))
                } else if (val === 'spouse-retirement') {
                  setMaturityType('spouse-retirement')
                  setEditingDebt({ ...editingDebt, maturityYear: String(spouseRetirementYear), maturityMonth: '12' })
                  setMaturityDateText(toPeriodRaw(spouseRetirementYear, 12))
                } else if (val === 'self-life-expectancy') {
                  setMaturityType('self-life-expectancy')
                  setEditingDebt({ ...editingDebt, maturityYear: String(selfLifeExpectancyYear), maturityMonth: '12' })
                  setMaturityDateText(toPeriodRaw(selfLifeExpectancyYear, 12))
                } else if (val === 'spouse-life-expectancy') {
                  setMaturityType('spouse-life-expectancy')
                  setEditingDebt({ ...editingDebt, maturityYear: String(spouseLifeExpectancyYear), maturityMonth: '12' })
                  setMaturityDateText(toPeriodRaw(spouseLifeExpectancyYear, 12))
                } else {
                  setMaturityType('year')
                  const y = parseInt(editingDebt.maturityYear) || currentYear + 5
                  const m = parseInt(editingDebt.maturityMonth) || 12
                  setMaturityDateText(toPeriodRaw(y, m))
                }
              }}
            >
              <option value="self-retirement">본인 은퇴</option>
              {hasSpouse && <option value="spouse-retirement">배우자 은퇴</option>}
              <option value="self-life-expectancy">본인 기대수명</option>
              {hasSpouse && <option value="spouse-life-expectancy">배우자 기대수명</option>}
              <option value="year">직접 입력</option>
            </select>
            {maturityType === 'year' && (
              <input
                type="text"
                className={`${styles.periodInput}${maturityDateText.length > 0 && !isPeriodValid(maturityDateText) ? ` ${styles.invalid}` : ''}`}
                value={formatPeriodDisplay(maturityDateText)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 6)
                  restorePeriodCursor(e.target as HTMLInputElement, raw)
                  setMaturityDateText(raw)
                  let y = parseInt(editingDebt.maturityYear) || currentYear + 5
                  let m = parseInt(editingDebt.maturityMonth) || 12
                  if (raw.length >= 4) {
                    const py = parseInt(raw.slice(0, 4))
                    if (!isNaN(py)) y = py
                  }
                  if (raw.length >= 5) {
                    const pm = parseInt(raw.slice(4))
                    if (!isNaN(pm) && pm >= 1 && pm <= 12) m = pm
                  }
                  setEditingDebt({ ...editingDebt, maturityYear: String(y), maturityMonth: String(m) })
                }}
                placeholder="2031.12"
              />
            )}
          </div>
        </div>

        {/* 상환방식 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>상환</span>
          <div className={styles.repaymentButtons}>
            {REPAYMENT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.repaymentBtn} ${editingDebt.repaymentType === opt.value ? styles.active : ''}`}
                onClick={() => setEditingDebt({ ...editingDebt, repaymentType: opt.value })}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 거치종료 (거치식상환일 때만) */}
        {editingDebt.repaymentType === '거치식상환' && (
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>거치종료</span>
            <div className={styles.fieldContent}>
              <select
                className={styles.periodSelect}
                value={graceEndType}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === 'self-retirement') {
                    setGraceEndType('self-retirement')
                    setEditingDebt({ ...editingDebt, graceEndYear: String(selfRetirementYear), graceEndMonth: '12' })
                    setGraceEndDateText(toPeriodRaw(selfRetirementYear, 12))
                  } else if (val === 'spouse-retirement') {
                    setGraceEndType('spouse-retirement')
                    setEditingDebt({ ...editingDebt, graceEndYear: String(spouseRetirementYear), graceEndMonth: '12' })
                    setGraceEndDateText(toPeriodRaw(spouseRetirementYear, 12))
                  } else if (val === 'self-life-expectancy') {
                    setGraceEndType('self-life-expectancy')
                    setEditingDebt({ ...editingDebt, graceEndYear: String(selfLifeExpectancyYear), graceEndMonth: '12' })
                    setGraceEndDateText(toPeriodRaw(selfLifeExpectancyYear, 12))
                  } else if (val === 'spouse-life-expectancy') {
                    setGraceEndType('spouse-life-expectancy')
                    setEditingDebt({ ...editingDebt, graceEndYear: String(spouseLifeExpectancyYear), graceEndMonth: '12' })
                    setGraceEndDateText(toPeriodRaw(spouseLifeExpectancyYear, 12))
                  } else {
                    setGraceEndType('year')
                    const sY = parseInt(editingDebt.startYear) || currentYear
                    const sM = parseInt(editingDebt.startMonth) || currentMonth
                    setGraceEndDateText(toPeriodRaw(sY, sM))
                    setEditingDebt({ ...editingDebt, graceEndYear: String(sY), graceEndMonth: String(sM) })
                  }
                }}
              >
                <option value="self-retirement">본인 은퇴</option>
                {hasSpouse && <option value="spouse-retirement">배우자 은퇴</option>}
                <option value="self-life-expectancy">본인 기대수명</option>
                {hasSpouse && <option value="spouse-life-expectancy">배우자 기대수명</option>}
                <option value="year">직접 입력</option>
              </select>
              {graceEndType === 'year' && (
                <input
                  type="text"
                  className={`${styles.periodInput}${graceEndDateText.length > 0 && !isPeriodValid(graceEndDateText) ? ` ${styles.invalid}` : ''}`}
                  value={formatPeriodDisplay(graceEndDateText)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 6)
                    restorePeriodCursor(e.target as HTMLInputElement, raw)
                    setGraceEndDateText(raw)
                    let y = parseInt(editingDebt.graceEndYear) || currentYear
                    let m = parseInt(editingDebt.graceEndMonth) || currentMonth
                    if (raw.length >= 4) {
                      const py = parseInt(raw.slice(0, 4))
                      if (!isNaN(py)) y = py
                    }
                    if (raw.length >= 5) {
                      const pm = parseInt(raw.slice(4))
                      if (!isNaN(pm) && pm >= 1 && pm <= 12) m = pm
                    }
                    setEditingDebt({ ...editingDebt, graceEndYear: String(y), graceEndMonth: String(m) })
                  }}
                  placeholder="2027.06"
                />
              )}
            </div>
          </div>
        )}


        {/* 하단 버튼 */}
        <div className={styles.modalFormActions}>
          <button
            className={styles.modalCancelBtn}
            onClick={isEditMode ? () => setEditingDebt(null) : resetAddForm}
          >
            취소
          </button>
          <button
            className={styles.modalAddBtn}
            onClick={handleSaveDebt}
            disabled={!editingDebt.amount}
          >
            {isEditMode ? '저장' : '추가'}
          </button>
        </div>
      </>
    )
  }

  // 부채 항목 렌더링 (항상 읽기 모드)
  const renderDebtItem = (
    debt: DebtWithPayment,
    category: 'credit' | 'other'
  ) => {
    const maturityStr = `${debt.maturity_year}.${String(debt.maturity_month).padStart(2, '0')}`
    const ownerLabel = debt.owner === 'spouse' ? '배우자' : '본인'

    return (
      <div key={debt.id} className={styles.debtItem} onClick={() => startEditDebt(debt, category)} style={{ cursor: 'pointer' }}>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>
            {debt.title} | {ownerLabel}
          </span>
          <span className={styles.itemMeta}>
            {debt.rate_type === 'floating'
              ? `변동 ${debt.spread || 0}%`
              : `${debt.interest_rate || 0}%`
            }
            {` | ${maturityStr} 만기`}
            {` | ${debt.repayment_type}`}
          </span>
        </div>
        <div className={styles.itemRight}>
          <span className={styles.debtAmount}>{formatMoney(debt.principal || 0)}</span>
        </div>
      </div>
    )
  }

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingDebt?.id) {
          setEditingDebt(null)
          e.stopPropagation()
        } else if (showTypeMenu) {
          resetAddForm()
          e.stopPropagation()
        }
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [showTypeMenu, editingDebt])

  if (isLoading && debts.length === 0) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={2} itemsPerSection={2} />
      </div>
    )
  }

  // 모든 부채 리스트 (flat)
  const allDebts = useMemo(() => {
    return [
      ...categorizedDebts.credit,
      ...categorizedDebts.other,
    ]
  }, [categorizedDebts])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.headerToggle} onClick={() => setIsExpanded(!isExpanded)} type="button">
          <span className={styles.title}>부채</span>
          <span className={styles.count}>{debts.length}개</span>
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

      {/* 타입 선택 모달 (2-step) */}
      {showTypeMenu && createPortal(
        <div
          className={styles.typeModalOverlay}
          data-scenario-dropdown-portal="true"
          onClick={resetAddForm}
        >
          <div
            className={styles.typeModal}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            {!addingCategory ? (
              <>
                {/* Step 1: 타입 선택 */}
                <div className={styles.typeModalHeader}>
                  <span className={styles.typeModalTitle}>부채 추가</span>
                  <button
                    className={styles.typeModalClose}
                    onClick={resetAddForm}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.typeGrid}>
                  <button className={styles.typeCard} onClick={() => startAddDebt('credit')}>
                    <span className={styles.typeCardName}>신용대출</span>
                    <span className={styles.typeCardDesc}>신용카드, 마이너스통장 등</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => startAddDebt('other')}>
                    <span className={styles.typeCardName}>기타부채</span>
                    <span className={styles.typeCardDesc}>학자금, 개인 등</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: 입력 폼 */}
                <div className={styles.typeModalHeader}>
                  <div className={styles.headerLeft}>
                    <button
                      className={styles.backButton}
                      onClick={() => setAddingCategory(null)}
                      type="button"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <span className={styles.stepLabel}>
                      {addingCategory === 'credit' ? '신용대출' : '기타부채'} 추가
                    </span>
                  </div>
                  <button
                    className={styles.typeModalClose}
                    onClick={resetAddForm}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.modalFormBody}>
                  {renderEditForm()}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 편집 모달 */}
      {editingDebt && editingDebt.id && createPortal(
        <div
          className={styles.typeModalOverlay}
          data-scenario-dropdown-portal="true"
          onClick={() => setEditingDebt(null)}
        >
          <div
            className={styles.typeModal}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div className={styles.typeModalHeader}>
              <span className={styles.stepLabel}>
                {editingDebt.category === 'credit' ? '신용대출' : '기타부채'} 수정
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  className={styles.typeModalClose}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm('이 항목을 삭제하시겠습니까?')) {
                      handleDeleteDebt(editingDebt.id!)
                      setEditingDebt(null)
                    }
                  }}
                  type="button"
                  style={{ color: 'var(--dashboard-text-secondary)' }}
                >
                  <Trash2 size={18} />
                </button>
                <button
                  className={styles.typeModalClose}
                  onClick={() => setEditingDebt(null)}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className={styles.modalFormBody}>
              {renderEditForm()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.groupedList}>
          {allDebts.length === 0 && (
            <p className={styles.emptyHint}>
              아직 등록된 부채가 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}

          {categorizedDebts.credit.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>신용대출</span>
                  <span className={styles.sectionCount}>{categorizedDebts.credit.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {categorizedDebts.credit.map(debt => renderDebtItem(debt, 'credit'))}
              </div>
            </div>
          )}

          {categorizedDebts.other.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>기타부채</span>
                  <span className={styles.sectionCount}>{categorizedDebts.other.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {categorizedDebts.other.map(debt => renderDebtItem(debt, 'other'))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
