'use client'

import { useState, useMemo } from 'react'
import { CreditCard, Car, Building2, Home, ExternalLink, Pencil, X, Plus } from 'lucide-react'
import type { OnboardingData, DebtInput, RateType } from '@/types'
import { formatMoney } from '@/lib/utils'
import styles from './DebtTab.module.css'

interface DebtTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

type DebtCategory = 'credit' | 'other' | 'physicalAsset' | 'housing' | 'realEstate'
type RepaymentType = '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환'

interface EditingDebt {
  id: string | null
  category: DebtCategory
  name: string
  amount: string
  rate: string
  rateType: RateType        // 금리 타입: 고정(fixed) / 변동(floating)
  spread: string            // 스프레드 (%) - 변동금리일 때
  maturityYear: string
  maturityMonth: string
  repaymentType: RepaymentType
  gracePeriodMonths: string // 거치기간 (거치식상환일 때)
}

const REPAYMENT_OPTIONS: { value: RepaymentType; label: string; desc: string }[] = [
  { value: '원리금균등상환', label: '원리금균등', desc: '매월 동일 금액 상환' },
  { value: '원금균등상환', label: '원금균등', desc: '원금은 동일, 이자는 점점 감소' },
  { value: '만기일시상환', label: '만기일시', desc: '만기에 원금 일시상환, 매월 이자만' },
  { value: '거치식상환', label: '거치식', desc: '거치기간 후 원리금균등' },
]

// 기본값: 60개월 후 만기, 5% 금리
const DEFAULT_LOAN_RATE = 5;
const DEFAULT_LOAN_MONTHS = 60;

// 기본 만기 계산 (현재 + 60개월)
const getDefaultMaturity = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const endMonth = ((currentMonth - 1 + DEFAULT_LOAN_MONTHS) % 12) + 1;
  const endYear = currentYear + Math.floor((currentMonth - 1 + DEFAULT_LOAN_MONTHS) / 12);
  return { year: String(endYear), month: String(endMonth) };
};

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

// 상환방식별 월 상환액 계산
function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  maturityDate: string,
  repaymentType: RepaymentType,
  gracePeriodMonths: number = 0
): { monthlyPayment: number; totalInterest: number } {
  if (!principal || !maturityDate) return { monthlyPayment: 0, totalInterest: 0 }

  const monthlyRate = (annualRate || 0) / 100 / 12
  const [year, month] = maturityDate.split('-').map(Number)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const totalMonths = (year - currentYear) * 12 + (month - currentMonth)
  if (totalMonths <= 0) return { monthlyPayment: 0, totalInterest: 0 }

  switch (repaymentType) {
    case '만기일시상환': {
      // 매월 이자만 납부, 만기에 원금 일시상환
      const monthlyInterest = principal * monthlyRate
      const totalInterest = monthlyInterest * totalMonths
      return { monthlyPayment: Math.round(monthlyInterest), totalInterest: Math.round(totalInterest) }
    }

    case '원리금균등상환': {
      // PMT 공식
      if (monthlyRate === 0) {
        return { monthlyPayment: Math.round(principal / totalMonths), totalInterest: 0 }
      }
      const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
      const totalPayment = payment * totalMonths
      return { monthlyPayment: Math.round(payment), totalInterest: Math.round(totalPayment - principal) }
    }

    case '원금균등상환': {
      // 첫 달 상환액 (가장 높음)
      const monthlyPrincipal = principal / totalMonths
      const firstMonthInterest = principal * monthlyRate
      const firstMonthPayment = monthlyPrincipal + firstMonthInterest
      // 평균 상환액 계산
      const avgInterest = (principal * monthlyRate * (totalMonths + 1)) / 2 / totalMonths
      const avgPayment = monthlyPrincipal + avgInterest
      const totalInterest = (principal * monthlyRate * (totalMonths + 1)) / 2
      return { monthlyPayment: Math.round(avgPayment), totalInterest: Math.round(totalInterest) }
    }

    case '거치식상환': {
      // 거치기간 동안 이자만, 이후 원리금균등
      const effectiveGrace = Math.min(gracePeriodMonths, totalMonths - 1)
      const repaymentMonths = totalMonths - effectiveGrace

      if (repaymentMonths <= 0) {
        const monthlyInterest = principal * monthlyRate
        return { monthlyPayment: Math.round(monthlyInterest), totalInterest: Math.round(monthlyInterest * totalMonths) }
      }

      // 거치기간 이자
      const graceInterest = principal * monthlyRate * effectiveGrace

      // 상환기간 원리금균등
      if (monthlyRate === 0) {
        return { monthlyPayment: Math.round(principal / repaymentMonths), totalInterest: Math.round(graceInterest) }
      }
      const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, repaymentMonths)) /
        (Math.pow(1 + monthlyRate, repaymentMonths) - 1)
      const repaymentInterest = payment * repaymentMonths - principal
      return { monthlyPayment: Math.round(payment), totalInterest: Math.round(graceInterest + repaymentInterest) }
    }

    default:
      return { monthlyPayment: 0, totalInterest: 0 }
  }
}

export function DebtTab({ data, onUpdateData }: DebtTabProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const debts = data.debts || []

  const [editingDebt, setEditingDebt] = useState<EditingDebt | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  // 부채 카테고리별 분류 및 월 상환액 계산
  const categorizedDebts = useMemo(() => {
    const addPaymentInfo = (debt: DebtInput) => {
      const { monthlyPayment, totalInterest } = calculateMonthlyPayment(
        debt.amount || 0,
        debt.rate || 0,
        debt.maturity || '',
        debt.repaymentType || '원리금균등상환',
        12 // 기본 거치기간
      )
      return { ...debt, monthlyPayment, totalInterest }
    }

    return {
      credit: debts.filter(d => d.sourceType === 'credit').map(addPaymentInfo),
      other: debts.filter(d => !d.sourceType || d.sourceType === 'manual' || d.sourceType === 'other').map(addPaymentInfo),
      physicalAsset: debts.filter(d => d.sourceType === 'physicalAsset').map(addPaymentInfo),
      housing: debts.filter(d => d.sourceType === 'housing').map(addPaymentInfo),
      realEstate: debts.filter(d => d.sourceType === 'realEstate').map(addPaymentInfo),
    }
  }, [debts])

  // 총계 계산
  const totals = useMemo(() => {
    const all = [...categorizedDebts.credit, ...categorizedDebts.other, ...categorizedDebts.physicalAsset, ...categorizedDebts.housing, ...categorizedDebts.realEstate]
    return {
      totalDebt: all.reduce((sum, d) => sum + (d.amount || 0), 0),
      totalMonthlyPayment: all.reduce((sum, d) => sum + d.monthlyPayment, 0),
      totalInterest: all.reduce((sum, d) => sum + d.totalInterest, 0),
      byCategory: {
        credit: categorizedDebts.credit.reduce((sum, d) => sum + (d.amount || 0), 0),
        other: categorizedDebts.other.reduce((sum, d) => sum + (d.amount || 0), 0),
        physicalAsset: categorizedDebts.physicalAsset.reduce((sum, d) => sum + (d.amount || 0), 0),
        housing: categorizedDebts.housing.reduce((sum, d) => sum + (d.amount || 0), 0),
        realEstate: categorizedDebts.realEstate.reduce((sum, d) => sum + (d.amount || 0), 0),
      }
    }
  }, [categorizedDebts])

  // 월 소득 계산 (소득 데이터에서)
  const monthlyIncome = useMemo(() => {
    const incomeItems = data.incomeItems || []
    return incomeItems.reduce((sum, item) => {
      if (item.frequency === 'monthly') return sum + (item.amount || 0)
      if (item.frequency === 'yearly') return sum + (item.amount || 0) / 12
      return sum
    }, 0)
  }, [data.incomeItems])

  // DSR (부채상환비율)
  const dsr = monthlyIncome > 0
    ? Math.round((totals.totalMonthlyPayment / monthlyIncome) * 100)
    : 0

  // 가장 빠른/늦은 만기
  const maturityDates = useMemo(() => {
    const allDebts = [...categorizedDebts.credit, ...categorizedDebts.other, ...categorizedDebts.physicalAsset, ...categorizedDebts.housing, ...categorizedDebts.realEstate]
    const withMaturity = allDebts.filter(d => d.maturity)
    if (withMaturity.length === 0) return { earliest: null, latest: null }

    const sorted = withMaturity.sort((a, b) => a.maturity!.localeCompare(b.maturity!))
    return {
      earliest: sorted[0],
      latest: sorted[sorted.length - 1],
    }
  }, [categorizedDebts])

  // 고금리 부채 (금리 5% 이상)
  const highInterestDebts = useMemo(() => {
    const allDebts = [...categorizedDebts.credit, ...categorizedDebts.other, ...categorizedDebts.physicalAsset, ...categorizedDebts.housing, ...categorizedDebts.realEstate]
    return allDebts
      .filter(d => (d.rate || 0) >= 5)
      .sort((a, b) => (b.rate || 0) - (a.rate || 0))
  }, [categorizedDebts])

  // 담보 대출 비율
  const securedDebtRatio = totals.totalDebt > 0
    ? Math.round(((totals.byCategory.housing + totals.byCategory.realEstate + totals.byCategory.physicalAsset) / totals.totalDebt) * 100)
    : 0

  const hasData = totals.totalDebt > 0

  // 부채 추가 시작
  const startAddDebt = (category: DebtCategory) => {
    const defaultMat = getDefaultMaturity();
    setEditingDebt({
      ...initialEditingDebt,
      category,
      name: category === 'credit' ? '신용대출' : '',
      maturityYear: defaultMat.year,
      maturityMonth: defaultMat.month,
    })
  }

  // 부채 편집 시작
  const startEditDebt = (debt: DebtInput & { monthlyPayment: number }, category: DebtCategory) => {
    const [year, month] = (debt.maturity || '').split('-')
    const defaultMat = getDefaultMaturity();
    setEditingDebt({
      id: debt.id,
      category,
      name: debt.name || '',
      amount: debt.amount?.toString() || '',
      rate: debt.rate?.toString() || String(DEFAULT_LOAN_RATE),
      rateType: debt.rateType || 'fixed',
      spread: debt.spread?.toString() || '1.5',
      maturityYear: year || defaultMat.year,
      maturityMonth: month || defaultMat.month,
      repaymentType: debt.repaymentType || '원리금균등상환',
      gracePeriodMonths: '12',
    })
  }

  // 부채 저장
  const saveDebt = () => {
    if (!editingDebt) return

    const amount = parseFloat(editingDebt.amount) || 0
    const rate = parseFloat(editingDebt.rate) || 0
    const spread = parseFloat(editingDebt.spread) || 0
    const maturity = editingDebt.maturityYear && editingDebt.maturityMonth
      ? `${editingDebt.maturityYear}-${editingDebt.maturityMonth.padStart(2, '0')}`
      : null

    // 연동된 부채인 경우 sourceType 유지
    const isLinked = ['physicalAsset', 'housing', 'realEstate'].includes(editingDebt.category)
    const existingDebt = debts.find(d => d.id === editingDebt.id)

    const newDebt: DebtInput = {
      id: editingDebt.id || `debt-${editingDebt.category}-${Date.now()}`,
      name: editingDebt.name || (editingDebt.category === 'credit' ? '신용대출' : '기타 부채'),
      amount,
      rate: editingDebt.rateType === 'fixed' ? rate : null, // 고정금리일 때만 rate 저장
      rateType: editingDebt.rateType,
      spread: editingDebt.rateType === 'floating' ? spread : undefined, // 변동금리일 때만 spread 저장
      maturity,
      repaymentType: editingDebt.repaymentType,
      sourceType: isLinked ? existingDebt?.sourceType : (editingDebt.category === 'credit' ? 'credit' : 'other'),
      sourceId: existingDebt?.sourceId,
    }

    let updatedDebts: DebtInput[]
    if (editingDebt.id) {
      updatedDebts = debts.map(d => d.id === editingDebt.id ? newDebt : d)
    } else {
      updatedDebts = [...debts, newDebt]
    }

    onUpdateData({ debts: updatedDebts })
    setEditingDebt(null)
  }

  // 부채 삭제
  const deleteDebt = (id: string) => {
    const updatedDebts = debts.filter(d => d.id !== id)
    onUpdateData({ debts: updatedDebts })
  }

  // 편집 폼 렌더링
  const renderEditForm = () => {
    if (!editingDebt) return null

    const isLinked = ['physicalAsset', 'housing', 'realEstate'].includes(editingDebt.category)

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
                  `${editingDebt.maturityYear}-${editingDebt.maturityMonth.padStart(2, '0')}`,
                  editingDebt.repaymentType,
                  parseInt(editingDebt.gracePeriodMonths) || 12
                ).monthlyPayment
              )}/월
            </span>
          </div>
        )}

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={() => setEditingDebt(null)}>취소</button>
          <button className={styles.saveBtn} onClick={saveDebt}>저장</button>
        </div>
      </div>
    )
  }

  // 부채 항목 렌더링
  const renderDebtItem = (
    debt: DebtInput & { monthlyPayment: number; totalInterest: number },
    category: DebtCategory,
    icon: React.ReactNode,
    linkedLabel?: string
  ) => {
    const isEditing = editingDebt?.id === debt.id

    if (isEditing) {
      return <div key={debt.id}>{renderEditForm()}</div>
    }

    return (
      <div key={debt.id} className={styles.debtItem}>
        <div className={styles.debtIcon}>{icon}</div>
        <div className={styles.debtMain}>
          <span className={styles.debtName}>{debt.name}</span>
          <span className={styles.debtAmount}>{formatMoney(debt.amount || 0)}</span>
          <span className={styles.debtMeta}>
            {debt.rateType === 'floating'
              ? `변동 기준금리+${debt.spread || 0}%`
              : `${debt.rate || 0}%`
            }
            {debt.maturity && ` | ${debt.maturity} 만기`}
            {debt.repaymentType && ` | ${debt.repaymentType}`}
          </span>
          {debt.monthlyPayment > 0 && (
            <span className={styles.debtPayment}>월 {formatMoney(debt.monthlyPayment)} 상환</span>
          )}
        </div>
        <div className={styles.debtRight}>
          {linkedLabel && (
            <div className={styles.debtBadge}>
              <ExternalLink size={12} />
              <span>{linkedLabel}</span>
            </div>
          )}
          <div className={styles.debtActions}>
            <button className={styles.editBtn} onClick={() => startEditDebt(debt, category)}>
              <Pencil size={14} />
            </button>
            {!linkedLabel && (
              <button className={styles.deleteBtn} onClick={() => deleteDebt(debt.id)}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 섹션 렌더링
  const renderSection = (
    title: string,
    category: DebtCategory,
    debts: (DebtInput & { monthlyPayment: number; totalInterest: number })[],
    total: number,
    icon: React.ReactNode,
    linkedLabel?: string,
    placeholder?: string,
    canAdd: boolean = false
  ) => {
    const isExpanded = expandedSection === category || debts.length > 0

    return (
      <div className={styles.section}>
        <div
          className={styles.sectionHeader}
          onClick={() => setExpandedSection(expandedSection === category ? null : category)}
        >
          <div className={styles.sectionLeft}>
            <span className={styles.sectionTitle}>{title}</span>
            {debts.length > 0 && (
              <span className={styles.sectionCount}>{debts.length}건</span>
            )}
          </div>
          {total > 0 && (
            <span className={styles.sectionTotal}>{formatMoney(total)}</span>
          )}
        </div>

        {debts.length > 0 && (
          <div className={styles.debtList}>
            {debts.map(debt => renderDebtItem(debt, category, icon, linkedLabel))}
          </div>
        )}

        {debts.length === 0 && placeholder && !editingDebt && (
          <p className={styles.placeholder}>{placeholder}</p>
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

  return (
    <div className={styles.container}>
      {/* 왼쪽: 부채 입력 */}
      <div className={styles.inputPanel}>
        {renderSection(
          '주택담보대출',
          'housing',
          categorizedDebts.housing,
          totals.byCategory.housing,
          <Home size={16} />,
          '거주 부동산',
          '주택담보대출은 부동산 탭에서 추가하세요'
        )}

        {renderSection(
          '부동산 투자 대출',
          'realEstate',
          categorizedDebts.realEstate,
          totals.byCategory.realEstate,
          <Building2 size={16} />,
          '투자 부동산',
          '투자용 부동산 대출은 부동산 탭에서 추가하세요'
        )}

        {renderSection(
          '자동차/실물자산 대출',
          'physicalAsset',
          categorizedDebts.physicalAsset,
          totals.byCategory.physicalAsset,
          <Car size={16} />,
          '실물 자산',
          '자동차 대출은 실물 자산 탭에서 추가하세요'
        )}

        {renderSection(
          '신용대출',
          'credit',
          categorizedDebts.credit,
          totals.byCategory.credit,
          <CreditCard size={16} />,
          undefined,
          undefined,
          true
        )}

        {renderSection(
          '기타 부채',
          'other',
          categorizedDebts.other,
          totals.byCategory.other,
          <CreditCard size={16} />,
          undefined,
          undefined,
          true
        )}

        <p className={styles.infoText}>
          담보대출(주택, 부동산, 자동차)은 해당 자산 탭에서 관리됩니다.
          상환방식과 금리는 여기서 수정할 수 있습니다.
        </p>
      </div>

      {/* 오른쪽: 인사이트 */}
      <div className={styles.insightPanel}>
        {/* 총 부채 요약 */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <span className={styles.summaryTitle}>총 부채</span>
          </div>
          <span className={styles.summaryTotal}>
            {hasData ? formatMoney(totals.totalDebt) : '-'}
          </span>

          {hasData && (
            <div className={styles.summarySubValues}>
              <div className={styles.summarySubItem}>
                <span className={styles.summarySubLabel}>월 상환액</span>
                <span className={styles.summarySubValue}>{formatMoney(totals.totalMonthlyPayment)}</span>
              </div>
              <div className={styles.summarySubItem}>
                <span className={styles.summarySubLabel}>예상 총 이자</span>
                <span className={styles.summarySubValue}>{formatMoney(totals.totalInterest)}</span>
              </div>
            </div>
          )}
        </div>

        {/* 핵심 지표 */}
        {hasData && (
          <div className={styles.metricsCard}>
            <h4 className={styles.cardTitle}>핵심 지표</h4>
            <div className={styles.metricsList}>
              {/* DSR */}
              {monthlyIncome > 0 && (
                <div className={styles.metricItem}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>DSR (부채상환비율)</span>
                    <span className={`${styles.metricValue} ${dsr > 60 ? styles.warning : dsr > 40 ? styles.caution : ''}`}>
                      {dsr}%
                    </span>
                  </div>
                  <div className={styles.metricBar}>
                    <div
                      className={`${styles.metricFill} ${dsr > 60 ? styles.warning : dsr > 40 ? styles.caution : ''}`}
                      style={{ width: `${Math.min(dsr, 100)}%` }}
                    />
                  </div>
                  <span className={styles.metricHint}>
                    {dsr <= 30 ? '안정적 수준' : dsr <= 40 ? '적정 수준' : dsr <= 60 ? '관리 필요' : '위험 수준 (60% 초과)'}
                  </span>
                </div>
              )}

              {/* 담보 대출 비율 */}
              <div className={styles.metricItem}>
                <div className={styles.metricHeader}>
                  <span className={styles.metricLabel}>담보 대출 비율</span>
                  <span className={styles.metricValue}>{securedDebtRatio}%</span>
                </div>
                <span className={styles.metricHint}>
                  {securedDebtRatio >= 70 ? '담보 대출 위주로 안정적' : '신용대출 비중이 높습니다'}
                </span>
              </div>

              {/* 상환 타임라인 */}
              {maturityDates.earliest && (
                <div className={styles.metricItem}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>다음 만기</span>
                    <span className={styles.metricValue}>{maturityDates.earliest.maturity}</span>
                  </div>
                  <span className={styles.metricHint}>{maturityDates.earliest.name}</span>
                </div>
              )}

              {maturityDates.latest && maturityDates.latest !== maturityDates.earliest && (
                <div className={styles.metricItem}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>최종 상환</span>
                    <span className={styles.metricValue}>{maturityDates.latest.maturity}</span>
                  </div>
                  <span className={styles.metricHint}>{maturityDates.latest.name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 부채 구성 */}
        {hasData && (
          <div className={styles.breakdownCard}>
            <h4 className={styles.cardTitle}>부채 구성</h4>
            <div className={styles.breakdownList}>
              {totals.byCategory.housing > 0 && (
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>주택담보대출</span>
                  <span className={styles.breakdownValue}>{formatMoney(totals.byCategory.housing)}</span>
                </div>
              )}
              {totals.byCategory.realEstate > 0 && (
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>부동산 투자</span>
                  <span className={styles.breakdownValue}>{formatMoney(totals.byCategory.realEstate)}</span>
                </div>
              )}
              {totals.byCategory.physicalAsset > 0 && (
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>자동차/실물자산</span>
                  <span className={styles.breakdownValue}>{formatMoney(totals.byCategory.physicalAsset)}</span>
                </div>
              )}
              {totals.byCategory.credit > 0 && (
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>신용대출</span>
                  <span className={styles.breakdownValue}>{formatMoney(totals.byCategory.credit)}</span>
                </div>
              )}
              {totals.byCategory.other > 0 && (
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>기타 부채</span>
                  <span className={styles.breakdownValue}>{formatMoney(totals.byCategory.other)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 고금리 부채 경고 */}
        {highInterestDebts.length > 0 && (
          <div className={styles.warningCard}>
            <h4 className={styles.cardTitle}>고금리 부채 ({highInterestDebts.length}건)</h4>
            <p className={styles.warningDesc}>
              금리 5% 이상 부채는 우선 상환을 고려하세요.
            </p>
            <div className={styles.warningList}>
              {highInterestDebts.slice(0, 3).map(debt => (
                <div key={debt.id} className={styles.warningItem}>
                  <span className={styles.warningName}>{debt.name}</span>
                  <span className={styles.warningRate}>{debt.rate}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 부채 관리 팁 */}
        {hasData && (
          <div className={styles.tipsCard}>
            <h4 className={styles.cardTitle}>부채 관리 팁</h4>
            <ul className={styles.tipsList}>
              {dsr > 40 && (
                <li className={styles.tipsWarning}>DSR이 {dsr}%입니다. 추가 대출이 어려울 수 있습니다.</li>
              )}
              {highInterestDebts.length > 0 && (
                <li className={styles.tipsWarning}>
                  {highInterestDebts[0].name}({highInterestDebts[0].rate}%)을 우선 상환하면 이자를 줄일 수 있습니다.
                </li>
              )}
              {securedDebtRatio < 50 && totals.totalDebt > 5000 && (
                <li className={styles.tipsNeutral}>신용대출 비중이 높습니다. 담보대출 전환을 고려해 보세요.</li>
              )}
              {maturityDates.earliest && (
                <li className={styles.tipsNeutral}>
                  {maturityDates.earliest.maturity}에 {maturityDates.earliest.name} 만기입니다. 상환 계획을 세우세요.
                </li>
              )}
            </ul>
          </div>
        )}

        {!hasData && (
          <div className={styles.emptyState}>
            <CreditCard size={40} />
            <p>부채 정보를 입력하면<br />분석 결과가 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
