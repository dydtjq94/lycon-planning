'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Trash2, X } from 'lucide-react'
import type { RetirementPension, Owner, RetirementPensionType, ReceiveType, RateCategory } from '@/types/tables'
import type { GlobalSettings } from '@/types'
import { formatMoney, getEffectiveRate, getDefaultRateCategory } from '@/lib/utils'
import {
  upsertRetirementPension,
  deleteRetirementPension,
} from '@/lib/services/retirementPensionService'
import type { RetirementPensionProjection } from './usePensionCalculations'
import { useChartTheme } from '@/hooks/useChartTheme'
import {
  formatPeriodDisplay,
  toPeriodRaw,
  isPeriodValid,
  handlePeriodTextChange,
} from '@/lib/utils/periodInput'
import styles from '../PensionTab.module.css'

interface RetirementPensionSectionProps {
  pension: RetirementPension | null
  simulationId: string
  owner: Owner
  ownerLabel: string
  projection: RetirementPensionProjection | null
  monthlyIncome: number
  yearsUntilRetirement: number
  birthYear: number
  retirementAge: number
  globalSettings: GlobalSettings
  onSave: () => void
}

export function RetirementPensionSection({
  pension,
  simulationId,
  owner,
  ownerLabel,
  projection,
  monthlyIncome,
  yearsUntilRetirement,
  birthYear,
  retirementAge,
  globalSettings,
  onSave,
}: RetirementPensionSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [startDateText, setStartDateText] = useState('')
  const [endDateText, setEndDateText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { isDark } = useChartTheme()

  const startEdit = () => {
    const isDB = pension?.pension_type === 'db' || pension?.pension_type === 'severance'
    const rateCategory = pension?.rate_category || getDefaultRateCategory('investment')
    const startAge = pension?.start_age || 56
    const receivingYears = pension?.receiving_years || 10
    const startYear = birthYear + startAge
    const endYear = startYear + receivingYears

    setIsEditing(true)
    setEditValues({
      type: isDB ? 'DB' : pension?.pension_type === 'dc' || pension?.pension_type === 'corporate_irp' ? 'DC' : '',
      years: pension?.years_of_service?.toString() || '',
      balance: pension?.current_balance?.toString() || '',
      receiveType: pension?.receive_type || 'annuity',
      startYear: String(startYear),
      startMonth: '1',
      endYear: String(endYear),
      endMonth: '12',
      rateCategory,
      returnRate: pension?.return_rate?.toString() || '5',
    })
    setStartDateText(toPeriodRaw(startYear, 1))
    setEndDateText(toPeriodRaw(endYear, 12))
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditValues({})
    setStartDateText('')
    setEndDateText('')
  }

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditing) {
        cancelEdit()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [isEditing])

  const saveEdit = async () => {
    if (!editValues.type) return

    setIsSaving(true)
    try {
      const startYear = parseInt(editValues.startYear) || (birthYear + 56)
      const endYear = parseInt(editValues.endYear) || (startYear + 10)
      const validatedStartAge = Math.max(56, startYear - birthYear)
      const receivingYears = Math.max(1, endYear - startYear)
      const pensionType: RetirementPensionType = editValues.type === 'DB' ? 'db' : 'dc'
      const receiveType = editValues.receiveType as ReceiveType
      const rateCategory = editValues.rateCategory as RateCategory
      const returnRate = parseFloat(editValues.returnRate) || 5

      await upsertRetirementPension(
        simulationId,
        owner,
        {
          pension_type: pensionType,
          current_balance: editValues.type === 'DC' && editValues.balance ? parseFloat(editValues.balance) : null,
          years_of_service: editValues.type === 'DB' && editValues.years ? parseInt(editValues.years) : null,
          receive_type: receiveType,
          start_age: receiveType === 'annuity' ? validatedStartAge : null,
          receiving_years: receiveType === 'annuity' ? receivingYears : null,
          return_rate: returnRate,
          rate_category: rateCategory,
        },
        birthYear,
        retirementAge,
        monthlyIncome
      )
      await onSave()
      setIsEditing(false)
      setEditValues({})
    } catch (error) {
      console.error('Failed to save retirement pension:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pension) return

    setIsSaving(true)
    try {
      await deleteRetirementPension(pension.id)
      await onSave()
    } catch (error) {
      console.error('Failed to delete retirement pension:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (pension) {
    const isDBType = pension.pension_type === 'db' || pension.pension_type === 'severance'

    // 메타 정보 구성
    const metaParts = []

    if (isDBType) {
      if (pension.years_of_service) {
        metaParts.push(`현재 ${pension.years_of_service}년 → 퇴직 시 ${pension.years_of_service + yearsUntilRetirement}년 근속`)
      } else {
        metaParts.push('근속연수를 입력하세요')
      }
    } else {
      if (pension.current_balance) {
        metaParts.push(`현재 잔액 ${formatMoney(pension.current_balance)}`)
      } else {
        metaParts.push('현재 잔액을 입력하세요')
      }
    }

    if (pension.receive_type === 'annuity') {
      metaParts.push(`${birthYear + (pension.start_age || 56)}년부터 ${(pension.receiving_years || 10)}년간 연금 수령`)
    } else if (pension.receive_type === 'lump_sum') {
      metaParts.push('일시금 수령')
    }

    if (!monthlyIncome) {
      metaParts.push('소득 탭에서 근로소득 입력 필요')
    }

    return (
      <>
        <div className={styles.pensionItem}>
          <div className={styles.itemInfo}>
            <span className={styles.itemName}>
              {ownerLabel} {isDBType ? 'DB형/퇴직금' : 'DC형/기업IRP'}
            </span>
            <span className={styles.itemMeta}>
              {metaParts.join(' | ')}
            </span>
          </div>
          <div className={styles.itemRight}>
            <span className={styles.itemAmount}>
              {projection
                ? pension.receive_type === 'annuity' && projection.monthlyPMT
                  ? `${formatMoney(projection.monthlyPMT)}/월`
                  : formatMoney(projection.totalAmount)
                : '계산 불가'}
            </span>
            <div className={styles.itemActions}>
              <button className={styles.editBtn} onClick={startEdit}>
                <Pencil size={16} />
              </button>
              <button className={styles.deleteBtn} onClick={handleDelete} disabled={isSaving}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 편집 모달 */}
        {isEditing && createPortal(
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
                <span className={styles.stepLabel}>{ownerLabel} 퇴직연금 수정</span>
                <button className={styles.typeModalClose} onClick={cancelEdit} type="button">
                  <X size={18} />
                </button>
              </div>
              <div className={styles.modalFormBody}>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>유형</span>
                  <div className={styles.typeButtons}>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${editValues.type === 'DB' ? styles.active : ''}`}
                      onClick={() => setEditValues({ ...editValues, type: 'DB', balance: '' })}
                    >
                      DB형/퇴직금
                    </button>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${editValues.type === 'DC' ? styles.active : ''}`}
                      onClick={() => setEditValues({ ...editValues, type: 'DC' })}
                    >
                      DC형/기업IRP
                    </button>
                  </div>
                </div>

                {editValues.type === 'DB' && (
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>근속</span>
                    <input
                      type="number"
                      className={styles.modalFormInput}
                      value={editValues.years || ''}
                      onChange={e => setEditValues({ ...editValues, years: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={0}
                      max={50}
                      placeholder="0"
                    />
                    <span className={styles.modalFormUnit}>년</span>
                  </div>
                )}

                {editValues.type === 'DC' && (
                  <>
                    <div className={styles.modalFormRow}>
                      <span className={styles.modalFormLabel}>잔액</span>
                      <input
                        type="number"
                        className={styles.modalFormInput}
                        value={editValues.balance || ''}
                        onChange={e => setEditValues({ ...editValues, balance: e.target.value })}
                        onWheel={e => (e.target as HTMLElement).blur()}
                        placeholder="0"
                      />
                      <span className={styles.modalFormUnit}>만원</span>
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
                            {getEffectiveRate(parseFloat(editValues.returnRate) || 5, 'investment', globalSettings.scenarioMode, globalSettings).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {editValues.type && (
                  <>
                    <div className={styles.modalFormRow}>
                      <span className={styles.modalFormLabel}>수령</span>
                      <div className={styles.typeButtons}>
                        <button
                          type="button"
                          className={`${styles.typeBtn} ${editValues.receiveType === 'annuity' ? styles.active : ''}`}
                          onClick={() => setEditValues({ ...editValues, receiveType: 'annuity' })}
                        >
                          연금 수령
                        </button>
                        <button
                          type="button"
                          className={`${styles.typeBtn} ${editValues.receiveType === 'lump_sum' ? styles.active : ''}`}
                          onClick={() => setEditValues({ ...editValues, receiveType: 'lump_sum' })}
                        >
                          일시금 수령
                        </button>
                      </div>
                    </div>

                    {editValues.receiveType === 'annuity' && (
                      <>
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
                      </>
                    )}
                  </>
                )}

                <div className={styles.modalFormActions}>
                  <button className={styles.modalCancelBtn} onClick={cancelEdit} disabled={isSaving}>
                    취소
                  </button>
                  <button className={styles.modalAddBtn} onClick={saveEdit} disabled={isSaving}>
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    )
  }

  return null
}
