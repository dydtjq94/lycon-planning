'use client'

import { useState, useMemo } from 'react'
import { Pencil, X, Plus } from 'lucide-react'
import type { Debt, DebtInput, LoanRepaymentType, RateType } from '@/types/tables'
import { formatMoney } from '@/lib/utils'
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
import styles from './DebtTab.module.css'

interface DebtTabProps {
  simulationId: string
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
}

// 부채 + 계산 정보
interface DebtWithPayment extends Debt {
  monthlyPayment: number
  totalInterest: number
}

export function DebtTab({ simulationId }: DebtTabProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: debts = [], isLoading } = useDebts(simulationId)
  const invalidate = useInvalidateByCategory(simulationId)

  // 편집 상태
  const [editingDebt, setEditingDebt] = useState<EditingDebt | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

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
    setEditingDebt({
      ...initialEditingDebt,
      category,
      name: category === 'credit' ? '신용대출' : '',
      startYear: String(currentYear),
      startMonth: String(currentMonth),
      maturityYear: String(defaultMat.year),
      maturityMonth: String(defaultMat.month),
    })
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
      maturityYear: debt.maturity_year?.toString() || String(defaultMat.year),
      maturityMonth: debt.maturity_month?.toString() || String(defaultMat.month),
      repaymentType: debt.repayment_type || '원리금균등상환',
      graceEndYear: graceMonths > 0 ? String(gEndYear) : '',
      graceEndMonth: graceMonths > 0 ? String(gEndMonth) : '',
    })
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
      }

      if (editingDebt.id) {
        await updateDebt(editingDebt.id, input)
      } else {
        await createDebt(input)
      }

      invalidate('debts')
      setEditingDebt(null)
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

  // 편집 폼 렌더링
  const renderEditForm = () => {
    if (!editingDebt) return null

    return (
      <div className={styles.editForm}>
        <div className={styles.editRow}>
          <label className={styles.editLabel}>이름</label>
          <input
            type="text"
            className={styles.editInput}
            value={editingDebt.name}
            onChange={e => setEditingDebt({ ...editingDebt, name: e.target.value })}
            placeholder={editingDebt.category === 'credit' ? '신용대출' : '부채명'}
          />
        </div>

        <div className={styles.editRow}>
          <label className={styles.editLabel}>금액</label>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInputNumber}
              value={editingDebt.amount}
              onChange={e => setEditingDebt({ ...editingDebt, amount: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.editUnit}>만원</span>
          </div>
        </div>

        <div className={styles.editRow}>
          <label className={styles.editLabel}>금리</label>
          <div className={styles.editField}>
            <div className={styles.repaymentButtons}>
              <button
                type="button"
                className={`${styles.repaymentBtn} ${editingDebt.rateType === 'fixed' ? styles.active : ''}`}
                onClick={() => setEditingDebt({ ...editingDebt, rateType: 'fixed' })}
              >
                고정
              </button>
              <button
                type="button"
                className={`${styles.repaymentBtn} ${editingDebt.rateType === 'floating' ? styles.active : ''}`}
                onClick={() => setEditingDebt({ ...editingDebt, rateType: 'floating' })}
              >
                변동
              </button>
            </div>
            {editingDebt.rateType === 'fixed' ? (
              <>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editingDebt.rate}
                  onChange={e => setEditingDebt({ ...editingDebt, rate: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="0"
                  step="0.1"
                />
                <span className={styles.editUnit}>%</span>
              </>
            ) : (
              <>
                <span className={styles.editUnit}>기준금리 +</span>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editingDebt.spread}
                  onChange={e => setEditingDebt({ ...editingDebt, spread: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="1.5"
                  step="0.1"
                />
                <span className={styles.editUnit}>%</span>
              </>
            )}
          </div>
        </div>

        <div className={styles.editRow}>
          <label className={styles.editLabel}>시작일</label>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInputSmall}
              value={editingDebt.startYear}
              onChange={e => setEditingDebt({ ...editingDebt, startYear: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder={String(currentYear)}
            />
            <span className={styles.editUnit}>년</span>
            <input
              type="number"
              className={styles.editInputSmall}
              value={editingDebt.startMonth}
              onChange={e => setEditingDebt({ ...editingDebt, startMonth: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder={String(currentMonth)}
              min={1}
              max={12}
            />
            <span className={styles.editUnit}>월</span>
          </div>
        </div>

        <div className={styles.editRow}>
          <label className={styles.editLabel}>만기</label>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInputSmall}
              value={editingDebt.maturityYear}
              onChange={e => setEditingDebt({ ...editingDebt, maturityYear: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder={String(currentYear + 3)}
              min={currentYear}
              max={currentYear + 50}
            />
            <span className={styles.editUnit}>년</span>
            <input
              type="number"
              className={styles.editInputSmall}
              value={editingDebt.maturityMonth}
              onChange={e => setEditingDebt({ ...editingDebt, maturityMonth: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="12"
              min={1}
              max={12}
            />
            <span className={styles.editUnit}>월</span>
          </div>
        </div>

        <div className={styles.editRow}>
          <label className={styles.editLabel}>상환</label>
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

        {editingDebt.repaymentType === '거치식상환' && (
          <div className={styles.editRow}>
            <label className={styles.editLabel}>거치종료</label>
            <div className={styles.editField}>
              <input
                type="number"
                className={styles.editInputSmall}
                value={editingDebt.graceEndYear}
                onChange={e => setEditingDebt({ ...editingDebt, graceEndYear: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder={String(currentYear + 1)}
              />
              <span className={styles.editUnit}>년</span>
              <input
                type="number"
                className={styles.editInputSmall}
                value={editingDebt.graceEndMonth}
                onChange={e => setEditingDebt({ ...editingDebt, graceEndMonth: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="12"
                min={1}
                max={12}
              />
              <span className={styles.editUnit}>월</span>
            </div>
          </div>
        )}

        {/* 예상 월 상환액 미리보기 */}
        {editingDebt.amount && editingDebt.maturityYear && editingDebt.maturityMonth && (
          <div className={styles.paymentPreview}>
            <span className={styles.previewLabel}>
              예상 월 상환액{editingDebt.repaymentType === '원금균등상환' ? ' (첫달)' : ''}
            </span>
            <span className={styles.previewValue}>
              {(() => {
                const sY = parseInt(editingDebt.startYear) || currentYear
                const sM = parseInt(editingDebt.startMonth) || currentMonth
                let gMonths = 0
                if (editingDebt.repaymentType === '거치식상환' && editingDebt.graceEndYear && editingDebt.graceEndMonth) {
                  gMonths = (parseInt(editingDebt.graceEndYear) - sY) * 12 + (parseInt(editingDebt.graceEndMonth) - sM)
                  if (gMonths < 0) gMonths = 0
                }
                return formatMoney(
                  calculateMonthlyPayment(
                    parseFloat(editingDebt.amount) || 0,
                    parseFloat(editingDebt.rate) || 0,
                    sY,
                    sM,
                    parseInt(editingDebt.maturityYear) || currentYear + 5,
                    parseInt(editingDebt.maturityMonth) || 12,
                    editingDebt.repaymentType,
                    gMonths
                  ).monthlyPayment
                )
              })()}/월
            </span>
          </div>
        )}

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={() => setEditingDebt(null)}>취소</button>
          <button className={styles.saveBtn} onClick={handleSaveDebt}>저장</button>
        </div>
      </div>
    )
  }

  // 부채 항목 렌더링
  const renderDebtItem = (
    debt: DebtWithPayment,
    category: 'credit' | 'other'
  ) => {
    const isEditing = editingDebt?.id === debt.id

    if (isEditing) {
      return <div key={debt.id}>{renderEditForm()}</div>
    }

    const maturityStr = `${debt.maturity_year}.${String(debt.maturity_month).padStart(2, '0')}`

    return (
      <div key={debt.id} className={styles.debtItem}>
        <div className={styles.debtMain}>
          <span className={styles.debtLabel}>
            {debt.rate_type === 'floating'
              ? `변동 ${debt.spread || 0}%`
              : `${debt.interest_rate || 0}%`
            }
            {` | ${maturityStr} 만기`}
          </span>
          <span className={styles.debtAmount}>{formatMoney(debt.principal || 0)}</span>
          <span className={styles.debtName}>{debt.title}</span>
          <span className={styles.debtMeta}>
            {debt.repayment_type}
            {debt.monthlyPayment > 0 && ` | 월 ${formatMoney(debt.monthlyPayment)} 상환`}
          </span>
        </div>
        <div className={styles.debtActions}>
          <button className={styles.editBtn} onClick={() => startEditDebt(debt, category)}>
            <Pencil size={16} />
          </button>
          <button className={styles.deleteBtn} onClick={() => handleDeleteDebt(debt.id)}>
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  // 섹션 렌더링
  const renderSection = (
    title: string,
    category: 'credit' | 'other',
    debtList: DebtWithPayment[]
  ) => {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{title}</span>
        </div>

        {debtList.length > 0 && (
          <div className={styles.debtList}>
            {debtList.map(debt => renderDebtItem(debt, category))}
          </div>
        )}

        {editingDebt?.category === category && !editingDebt.id ? (
          renderEditForm()
        ) : (
          <button className={styles.addBtn} onClick={() => startAddDebt(category)}>
            <Plus size={16} />
            <span>{title} 추가</span>
          </button>
        )}
      </div>
    )
  }

  if (isLoading && debts.length === 0) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={2} itemsPerSection={2} />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {renderSection(
        '신용대출',
        'credit',
        categorizedDebts.credit
      )}

      {renderSection(
        '기타 부채',
        'other',
        categorizedDebts.other
      )}
    </div>
  )
}
