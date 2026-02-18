'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X } from 'lucide-react'
import type { PersonalPension, Owner, PersonalPensionType, RateCategory } from '@/types/tables'
import { formatMoney, getDefaultRateCategory } from '@/lib/utils'
import {
  upsertPersonalPension,
  deletePersonalPension,
} from '@/lib/services/personalPensionService'
import { useChartTheme } from '@/hooks/useChartTheme'
import {
  formatPeriodDisplay,
  toPeriodRaw,
  isPeriodValid,
  handlePeriodTextChange,
} from '@/lib/utils/periodInput'
import styles from '../PensionTab.module.css'

interface PersonalPensionSectionProps {
  pensions: PersonalPension[]
  simulationId: string
  owner: Owner
  ownerLabel: string
  birthYear: number
  retirementAge: number
  onSave: () => void
}

export function PersonalPensionSection({
  pensions,
  simulationId,
  owner,
  ownerLabel,
  birthYear,
  retirementAge,
  onSave,
}: PersonalPensionSectionProps) {
  const [editingType, setEditingType] = useState<PersonalPensionType | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [startDateText, setStartDateText] = useState('')
  const [endDateText, setEndDateText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { isDark } = useChartTheme()

  // 타입별 연금 찾기
  const pensionSavings = useMemo(
    () => pensions.find(p => p.pension_type === 'pension_savings') || null,
    [pensions]
  )
  const irp = useMemo(
    () => pensions.find(p => p.pension_type === 'irp') || null,
    [pensions]
  )

  // 개인연금 예상 월 수령액 계산 (FV + PMT)
  const calcMonthlyPMT = (pension: PersonalPension | null): number | null => {
    if (!pension) return null
    const currentYear = new Date().getFullYear()
    const currentAge = currentYear - birthYear
    const startAge = pension.start_age || 56
    const receivingYears = pension.receiving_years || 20
    const returnRate = pension.return_rate || 5
    const monthlyRate = Math.pow(1 + returnRate / 100, 1 / 12) - 1
    const monthsUntilReceiving = Math.max(0, (startAge - currentAge) * 12)
    const receivingMonths = receivingYears * 12

    const balance = pension.current_balance || 0
    const monthlyContrib = pension.monthly_contribution || 0

    // 납입 기간 (퇴직까지 or 수령시작까지)
    let contribMonths = pension.is_contribution_fixed_to_retirement
      ? Math.max(0, (retirementAge - currentAge) * 12)
      : monthsUntilReceiving
    contribMonths = Math.min(contribMonths, monthsUntilReceiving)

    let totalAtReceiving: number
    if (monthlyRate > 0 && monthsUntilReceiving > 0) {
      const fvBalance = balance * Math.pow(1 + monthlyRate, monthsUntilReceiving)
      let fvContrib = 0
      if (monthlyContrib > 0 && contribMonths > 0) {
        const fvAtContribEnd = monthlyContrib * (Math.pow(1 + monthlyRate, contribMonths) - 1) / monthlyRate
        fvContrib = fvAtContribEnd * Math.pow(1 + monthlyRate, monthsUntilReceiving - contribMonths)
      }
      totalAtReceiving = fvBalance + fvContrib
    } else {
      totalAtReceiving = balance + monthlyContrib * contribMonths
    }

    if (totalAtReceiving <= 0) return null

    if (monthlyRate > 0) {
      return totalAtReceiving * monthlyRate / (1 - Math.pow(1 + monthlyRate, -receivingMonths))
    }
    return totalAtReceiving / receivingMonths
  }

  const savingsPMT = useMemo(() => calcMonthlyPMT(pensionSavings), [pensionSavings, birthYear, retirementAge])
  const irpPMT = useMemo(() => calcMonthlyPMT(irp), [irp, birthYear, retirementAge])

  const cancelEdit = () => {
    setEditingType(null)
    setEditValues({})
    setStartDateText('')
    setEndDateText('')
  }

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingType) {
        cancelEdit()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [editingType])

  const startEditPensionSavings = () => {
    const rateCategory = pensionSavings?.rate_category || getDefaultRateCategory('investment')
    const startAge = pensionSavings?.start_age || 56
    const receivingYears = pensionSavings?.receiving_years || 20
    const startYear = birthYear + startAge
    const endYear = startYear + receivingYears

    setEditingType('pension_savings')
    setEditValues({
      balance: pensionSavings?.current_balance?.toString() || '',
      monthly: pensionSavings?.monthly_contribution?.toString() || '',
      startYear: String(startYear),
      startMonth: '1',
      endYear: String(endYear),
      endMonth: '12',
      rateCategory,
      returnRate: pensionSavings?.return_rate?.toString() || '5',
    })
    setStartDateText(toPeriodRaw(startYear, 1))
    setEndDateText(toPeriodRaw(endYear, 12))
  }

  const startEditIrp = () => {
    const rateCategory = irp?.rate_category || getDefaultRateCategory('investment')
    const startAge = irp?.start_age || 56
    const receivingYears = irp?.receiving_years || 20
    const startYear = birthYear + startAge
    const endYear = startYear + receivingYears

    setEditingType('irp')
    setEditValues({
      balance: irp?.current_balance?.toString() || '',
      monthly: irp?.monthly_contribution?.toString() || '',
      startYear: String(startYear),
      startMonth: '1',
      endYear: String(endYear),
      endMonth: '12',
      rateCategory,
      returnRate: irp?.return_rate?.toString() || '5',
    })
    setStartDateText(toPeriodRaw(startYear, 1))
    setEndDateText(toPeriodRaw(endYear, 12))
  }

  const savePension = async (pensionType: PersonalPensionType) => {
    setIsSaving(true)
    try {
      const startYear = parseInt(editValues.startYear) || (birthYear + 56)
      const endYear = parseInt(editValues.endYear) || (startYear + 20)
      const validatedStartAge = Math.max(56, startYear - birthYear)
      const receivingYears = Math.max(1, endYear - startYear)
      const rateCategory = editValues.rateCategory as RateCategory
      const returnRate = parseFloat(editValues.returnRate) || 5

      await upsertPersonalPension(
        simulationId,
        owner,
        pensionType,
        {
          current_balance: editValues.balance ? parseFloat(editValues.balance) : 0,
          monthly_contribution: editValues.monthly ? parseFloat(editValues.monthly) : null,
          is_contribution_fixed_to_retirement: true,
          start_age: validatedStartAge,
          receiving_years: receivingYears,
          return_rate: returnRate,
          rate_category: rateCategory,
        },
        birthYear,
        retirementAge
      )
      await onSave()
      cancelEdit()
    } catch (error) {
      console.error('Failed to save personal pension:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (pensionType: PersonalPensionType) => {
    const pension = pensionType === 'pension_savings' ? pensionSavings : irp
    if (!pension) return

    setIsSaving(true)
    try {
      await deletePersonalPension(pension.id)
      await onSave()
    } catch (error) {
      console.error('Failed to delete personal pension:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 편집 모달 렌더링 (연금저축 or IRP)
  const renderEditModal = (pensionType: PersonalPensionType, label: string) => {
    if (editingType !== pensionType) return null

    return createPortal(
      <div
        className={styles.typeModalOverlay}
        data-scenario-dropdown-portal="true"
        onClick={cancelEdit}
      >
        <div
          className={styles.typeModal}
          onClick={e => e.stopPropagation()}
          style={{
            background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}
        >
          <div className={styles.typeModalHeader}>
            <span className={styles.stepLabel}>{ownerLabel} {label} 수정</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className={styles.typeModalClose}
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.confirm('이 항목을 삭제하시겠습니까?')) {
                    handleDelete(pensionType)
                    cancelEdit()
                  }
                }}
                type="button"
                disabled={isSaving}
                style={{ color: 'var(--dashboard-text-secondary)' }}
              >
                <Trash2 size={18} />
              </button>
              <button className={styles.typeModalClose} onClick={cancelEdit} type="button">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className={styles.modalFormBody}>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>잔액</span>
              <input
                type="number"
                className={styles.modalFormInput}
                value={editValues.balance || ''}
                onChange={e => setEditValues({ ...editValues, balance: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="0"
                autoFocus
              />
              <span className={styles.modalFormUnit}>만원</span>
            </div>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>납입</span>
              <input
                type="number"
                className={styles.modalFormInput}
                value={editValues.monthly || ''}
                onChange={e => setEditValues({ ...editValues, monthly: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.modalFormUnit}>만원/월</span>
            </div>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>수익률</span>
              <div className={styles.fieldContent}>
                <div className={styles.rateToggle}>
                  <button
                    type="button"
                    className={`${styles.rateToggleBtn} ${editValues.rateCategory !== 'fixed' ? styles.active : ''}`}
                    onClick={() => setEditValues({ ...editValues, rateCategory: getDefaultRateCategory('investment') })}
                  >
                    시뮬레이션 가정
                  </button>
                  <button
                    type="button"
                    className={`${styles.rateToggleBtn} ${editValues.rateCategory === 'fixed' ? styles.active : ''}`}
                    onClick={() => setEditValues({ ...editValues, rateCategory: 'fixed' })}
                  >
                    직접 입력
                  </button>
                </div>
                {editValues.rateCategory === 'fixed' ? (
                  <>
                    <input
                      type="number"
                      className={styles.customRateInput}
                      value={editValues.returnRate || ''}
                      onChange={e => setEditValues({ ...editValues, returnRate: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      placeholder="0"
                      step="0.1"
                    />
                    <span className={styles.rateUnit}>%</span>
                  </>
                ) : (
                  <span className={styles.rateValue}>
                    시뮬레이션 가정
                  </span>
                )}
              </div>
            </div>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>수령시작</span>
              <input
                type="text"
                className={`${styles.periodInput} ${startDateText.length === 6 && !isPeriodValid(startDateText) ? styles.invalid : ''}`}
                value={formatPeriodDisplay(startDateText)}
                onChange={e => handlePeriodTextChange(
                  e,
                  setStartDateText,
                  y => setEditValues({ ...editValues, startYear: String(y) }),
                  m => setEditValues({ ...editValues, startMonth: String(m) })
                )}
                placeholder="YYYY.MM"
              />
            </div>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>수령종료</span>
              <input
                type="text"
                className={`${styles.periodInput} ${endDateText.length === 6 && !isPeriodValid(endDateText) ? styles.invalid : ''}`}
                value={formatPeriodDisplay(endDateText)}
                onChange={e => handlePeriodTextChange(
                  e,
                  setEndDateText,
                  y => setEditValues({ ...editValues, endYear: String(y) }),
                  m => setEditValues({ ...editValues, endMonth: String(m) })
                )}
                placeholder="YYYY.MM"
              />
            </div>
            <div className={styles.modalFormActions}>
              <button className={styles.modalCancelBtn} onClick={cancelEdit} disabled={isSaving}>
                취소
              </button>
              <button
                className={styles.modalAddBtn}
                onClick={() => savePension(pensionType)}
                disabled={isSaving}
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return (
    <>
      {/* 연금저축 읽기 뷰 */}
      {pensionSavings && (
        <div className={styles.pensionItem} onClick={startEditPensionSavings} style={{ cursor: 'pointer' }}>
          <div className={styles.itemInfo}>
            <span className={styles.itemName}>
              {ownerLabel} 연금저축
              {pensionSavings.broker_name && <span className={styles.brokerName}>{pensionSavings.broker_name}</span>}
            </span>
            {pensionSavings.monthly_contribution && (
              <span className={styles.itemMeta}>월 {formatMoney(pensionSavings.monthly_contribution)} 납입</span>
            )}
            <span className={styles.itemMeta}>
              {birthYear + (pensionSavings.start_age || 56)}년부터 {pensionSavings.receiving_years || 20}년간 수령
            </span>
          </div>
          <div className={styles.itemRight}>
            <span className={styles.itemAmount}>
              {savingsPMT !== null
                ? `${formatMoney(Math.round(savingsPMT))}/월`
                : pensionSavings.current_balance ? formatMoney(pensionSavings.current_balance) : '0'}
            </span>
          </div>
        </div>
      )}

      {/* IRP 읽기 뷰 */}
      {irp && (
        <div className={styles.pensionItem} onClick={startEditIrp} style={{ cursor: 'pointer' }}>
          <div className={styles.itemInfo}>
            <span className={styles.itemName}>
              {ownerLabel} IRP
              {irp.broker_name && <span className={styles.brokerName}>{irp.broker_name}</span>}
            </span>
            {irp.monthly_contribution && (
              <span className={styles.itemMeta}>월 {formatMoney(irp.monthly_contribution)} 납입</span>
            )}
            <span className={styles.itemMeta}>
              {birthYear + (irp.start_age || 56)}년부터 {irp.receiving_years || 20}년간 수령
            </span>
          </div>
          <div className={styles.itemRight}>
            <span className={styles.itemAmount}>
              {irpPMT !== null
                ? `${formatMoney(Math.round(irpPMT))}/월`
                : irp.current_balance ? formatMoney(irp.current_balance) : '0'}
            </span>
          </div>
        </div>
      )}

      {/* 편집 모달 */}
      {renderEditModal('pension_savings', '연금저축')}
      {renderEditModal('irp', 'IRP')}
    </>
  )
}
