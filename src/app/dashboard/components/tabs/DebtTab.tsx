'use client'

import { useState, useMemo } from 'react'
import { CreditCard, ExternalLink, Pencil, X, Plus } from 'lucide-react'
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
  maturityYear: string
  maturityMonth: string
  repaymentType: LoanRepaymentType
  gracePeriodMonths: string
}

const initialEditingDebt: EditingDebt = {
  id: null,
  category: 'credit',
  name: '',
  amount: '',
  rate: String(DEFAULT_LOAN_RATE),
  rateType: 'fixed',
  spread: '1.5',
  maturityYear: '',
  maturityMonth: '',
  repaymentType: '원리금균등상환',
  gracePeriodMonths: '12',
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

  // 부채 카테고리별 분류
  const categorizedDebts = useMemo(() => {
    const result: Record<UIDebtCategory, DebtWithPayment[]> = {
      credit: [],
      other: [],
      physicalAsset: [],
      housing: [],
      realEstate: [],
    }

    debts.forEach(debt => {
      const category = getCategoryFromDebt(debt)
      // housing과 realEstate 구분: source_type이 real_estate이고 title에 '투자'가 있으면 realEstate
      if (debt.source_type === 'real_estate') {
        if (debt.title.includes('투자') || debt.type === 'mortgage' && !debt.title.includes('주택') && !debt.title.includes('전세')) {
          result.realEstate.push(addPaymentInfo(debt))
        } else {
          result.housing.push(addPaymentInfo(debt))
        }
      } else if (debt.source_type === 'physical_asset') {
        result.physicalAsset.push(addPaymentInfo(debt))
      } else {
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
      ...categorizedDebts.physicalAsset,
      ...categorizedDebts.housing,
      ...categorizedDebts.realEstate,
    ]
    return {
      totalDebt: all.reduce((sum, d) => sum + (d.principal || 0), 0),
      totalMonthlyPayment: all.reduce((sum, d) => sum + d.monthlyPayment, 0),
      totalInterest: all.reduce((sum, d) => sum + d.totalInterest, 0),
      byCategory: {
        credit: categorizedDebts.credit.reduce((sum, d) => sum + (d.principal || 0), 0),
        other: categorizedDebts.other.reduce((sum, d) => sum + (d.principal || 0), 0),
        physicalAsset: categorizedDebts.physicalAsset.reduce((sum, d) => sum + (d.principal || 0), 0),
        housing: categorizedDebts.housing.reduce((sum, d) => sum + (d.principal || 0), 0),
        realEstate: categorizedDebts.realEstate.reduce((sum, d) => sum + (d.principal || 0), 0),
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
      ...categorizedDebts.physicalAsset,
      ...categorizedDebts.housing,
      ...categorizedDebts.realEstate,
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
      ...categorizedDebts.physicalAsset,
      ...categorizedDebts.housing,
      ...categorizedDebts.realEstate,
    ]
    return allDebts
      .filter(d => (d.interest_rate || 0) >= 5)
      .sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))
  }, [categorizedDebts])

  // 담보 대출 비율
  const securedDebtRatio = totals.totalDebt > 0
    ? Math.round(((totals.byCategory.housing + totals.byCategory.realEstate + totals.byCategory.physicalAsset) / totals.totalDebt) * 100)
    : 0

  const hasData = totals.totalDebt > 0

  // 부채 추가 시작
  const startAddDebt = (category: UIDebtCategory) => {
    const defaultMat = getDefaultMaturity()
    setEditingDebt({
      ...initialEditingDebt,
      category,
      name: category === 'credit' ? '신용대출' : '',
      maturityYear: String(defaultMat.year),
      maturityMonth: String(defaultMat.month),
    })
  }

  // 부채 편집 시작
  const startEditDebt = (debt: DebtWithPayment, category: UIDebtCategory) => {
    const defaultMat = getDefaultMaturity()
    setEditingDebt({
      id: debt.id,
      category,
      name: debt.title || '',
      amount: debt.principal?.toString() || '',
      rate: debt.interest_rate?.toString() || String(DEFAULT_LOAN_RATE),
      rateType: debt.rate_type || 'fixed',
      spread: debt.spread?.toString() || '1.5',
      maturityYear: debt.maturity_year?.toString() || String(defaultMat.year),
      maturityMonth: debt.maturity_month?.toString() || String(defaultMat.month),
      repaymentType: debt.repayment_type || '원리금균등상환',
      gracePeriodMonths: debt.grace_period_months?.toString() || '12',
    })
  }

  // 부채 저장
  const handleSaveDebt = async () => {
    if (!editingDebt) return

    try {
      const principal = parseFloat(editingDebt.amount) || 0
      const rate = parseFloat(editingDebt.rate) || 0
      const spread = parseFloat(editingDebt.spread) || 0
      const maturityYear = parseInt(editingDebt.maturityYear) || currentYear + 5
      const maturityMonth = parseInt(editingDebt.maturityMonth) || 12

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
        grace_period_months: editingDebt.repaymentType === '거치식상환' ? parseInt(editingDebt.gracePeriodMonths) || 12 : 0,
        start_year: currentYear,
        start_month: currentMonth,
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

    const isLinked = ['physicalAsset', 'housing', 'realEstate'].includes(editingDebt.category) && editingDebt.id !== null

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
            disabled={isLinked}
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
              disabled={isLinked}
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
            <label className={styles.editLabel}>거치</label>
            <div className={styles.editField}>
              <input
                type="number"
                className={styles.editInputSmall}
                value={editingDebt.gracePeriodMonths}
                onChange={e => setEditingDebt({ ...editingDebt, gracePeriodMonths: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="12"
                min={1}
                max={60}
              />
              <span className={styles.editUnit}>개월</span>
            </div>
          </div>
        )}

        {/* 예상 월 상환액 미리보기 */}
        {editingDebt.amount && editingDebt.maturityYear && editingDebt.maturityMonth && (
          <div className={styles.paymentPreview}>
            <span className={styles.previewLabel}>예상 월 상환액</span>
            <span className={styles.previewValue}>
              {formatMoney(
                calculateMonthlyPayment(
                  parseFloat(editingDebt.amount) || 0,
                  parseFloat(editingDebt.rate) || 0,
                  currentYear,
                  currentMonth,
                  parseInt(editingDebt.maturityYear) || currentYear + 5,
                  parseInt(editingDebt.maturityMonth) || 12,
                  editingDebt.repaymentType,
                  parseInt(editingDebt.gracePeriodMonths) || 12
                ).monthlyPayment
              )}/월
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
    category: UIDebtCategory,
    linkedLabel?: string
  ) => {
    const isEditing = editingDebt?.id === debt.id
    const isLinked = debt.source_type !== null

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
          {isLinked ? (
            <div className={styles.linkedBadge}>
              <ExternalLink size={12} />
              <span>{linkedLabel}</span>
            </div>
          ) : (
            <>
              <button className={styles.editBtn} onClick={() => startEditDebt(debt, category)}>
                <Pencil size={16} />
              </button>
              <button className={styles.deleteBtn} onClick={() => handleDeleteDebt(debt.id)}>
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // 섹션 렌더링
  const renderSection = (
    title: string,
    category: UIDebtCategory,
    debtList: DebtWithPayment[],
    linkedLabel?: string,
    placeholder?: string,
    canAdd: boolean = false,
    linkInfo?: { href: string; text: string }
  ) => {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{title}</span>
        </div>

        {debtList.length > 0 && (
          <div className={styles.debtList}>
            {debtList.map(debt => renderDebtItem(debt, category, linkedLabel))}
          </div>
        )}

        {debtList.length === 0 && placeholder && !editingDebt && (
          <p className={styles.placeholder}>{placeholder}</p>
        )}

        {linkInfo && (
          <a href={linkInfo.href} className={styles.tabLink}>
            {linkInfo.text}
          </a>
        )}

        {canAdd && (
          editingDebt?.category === category && !editingDebt.id ? (
            renderEditForm()
          ) : (
            <button className={styles.addBtn} onClick={() => startAddDebt(category)}>
              <Plus size={16} />
              <span>{title} 추가</span>
            </button>
          )
        )}
      </div>
    )
  }

  if (isLoading && debts.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>데이터를 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {renderSection(
        '주택담보대출',
        'housing',
        categorizedDebts.housing,
        '거주 부동산',
        '주택담보대출은 부동산 탭에서 추가하세요',
        false,
        { href: '#realEstate', text: '부동산 탭에서 주택담보대출 관리하기' }
      )}

      {renderSection(
        '부동산 투자 대출',
        'realEstate',
        categorizedDebts.realEstate,
        '투자 부동산',
        '투자용 부동산 대출은 부동산 탭에서 추가하세요',
        false,
        { href: '#realEstate', text: '부동산 탭에서 투자용 대출 관리하기' }
      )}

      {renderSection(
        '자동차/실물자산 대출',
        'physicalAsset',
        categorizedDebts.physicalAsset,
        '실물 자산',
        '자동차 대출은 실물 자산 탭에서 추가하세요',
        false,
        { href: '#asset', text: '실물 자산 탭에서 자동차 대출 관리하기' }
      )}

      {renderSection(
        '신용대출',
        'credit',
        categorizedDebts.credit,
        undefined,
        undefined,
        true
      )}

      {renderSection(
        '기타 부채',
        'other',
        categorizedDebts.other,
        undefined,
        undefined,
        true
      )}

      <p className={styles.infoText}>
        담보대출(주택, 부동산, 자동차)은 해당 자산 탭에서 관리됩니다.
        상환방식과 금리는 여기서 수정할 수 있습니다.
      </p>
    </div>
  )
}
