'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X } from 'lucide-react'
import type { RetirementPension, Owner, RetirementPensionType, ReceiveType, RateCategory } from '@/types/tables'
import { formatMoney, getDefaultRateCategory } from '@/lib/utils'
import {
  upsertRetirementPension,
  deleteRetirementPension,
} from '@/lib/services/retirementPensionService'
import { useMemo } from 'react'
import { useChartTheme } from '@/hooks/useChartTheme'
import {
  formatPeriodDisplay,
  toPeriodRaw,
  isPeriodValid,
  handlePeriodTextChange,
} from '@/lib/utils/periodInput'
import { FinancialItemIcon } from '@/components/FinancialItemIcon'
import { FinancialIconPicker } from '@/components/FinancialIconPicker'
import styles from '../PensionTab.module.css'

interface RetirementPensionSectionProps {
  pension: RetirementPension | null
  simulationId: string
  owner: Owner
  ownerLabel: string
  yearsUntilRetirement: number
  birthYear: number
  birthMonth: number
  retirementAge: number
  onSave: () => void
}

export function RetirementPensionSection({
  pension,
  simulationId,
  owner,
  ownerLabel,
  yearsUntilRetirement,
  birthYear,
  birthMonth,
  retirementAge,
  onSave,
}: RetirementPensionSectionProps) {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [startDateText, setStartDateText] = useState('')
  const [endDateText, setEndDateText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { isDark } = useChartTheme()

  // Icon/color state
  const [editIcon, setEditIcon] = useState<string | null>(null)
  const [editColor, setEditColor] = useState<string | null>(null)

  const startEdit = () => {
    const isDB = pension?.pension_type === 'db' || pension?.pension_type === 'severance'
    const rateCategory = pension?.rate_category || getDefaultRateCategory('investment')
    const startAge = pension?.start_age || 56
    const receivingYears = pension?.receiving_years || 10
    const startYear = birthYear + startAge
    const endYear = startYear + receivingYears

    // Set icon and color
    setEditIcon(pension?.icon || null)
    setEditColor(pension?.color || null)

    const endM = birthMonth > 1 ? birthMonth - 1 : 12
    const effectiveEndYear = birthMonth > 1 ? endYear : endYear - 1

    setIsEditing(true)
    setEditValues({
      type: isDB ? 'DB' : pension?.pension_type === 'dc' || pension?.pension_type === 'corporate_irp' ? 'DC' : '',
      years: pension?.years_of_service?.toString() || '',
      balance: pension?.current_balance?.toString() || '',
      receiveType: pension?.receive_type || 'annuity',
      startYear: String(startYear),
      startMonth: String(birthMonth),
      endYear: String(effectiveEndYear),
      endMonth: String(endM),
      rateCategory,
      returnRate: pension?.return_rate?.toString() || '5',
      calculationMode: pension?.calculation_mode || 'auto',
      monthlySalary: pension?.monthly_salary?.toString() || '',
    })
    setStartDateText(toPeriodRaw(startYear, birthMonth))
    setEndDateText(toPeriodRaw(effectiveEndYear, endM))
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditValues({})
    setStartDateText('')
    setEndDateText('')
    setEditIcon(null)
    setEditColor(null)
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

      const isDBType = editValues.type === 'DB'
      const isAutoMode = editValues.calculationMode !== 'manual'

      let pensionFields: Parameters<typeof upsertRetirementPension>[2]
      if (isDBType && isAutoMode) {
        pensionFields = {
          pension_type: pensionType,
          current_balance: null,
          years_of_service: editValues.years ? parseInt(editValues.years) : null,
          monthly_salary: editValues.monthlySalary ? parseFloat(editValues.monthlySalary) : null,
          calculation_mode: 'auto',
          receive_type: receiveType,
          start_age: receiveType === 'annuity' ? validatedStartAge : null,
          receiving_years: receiveType === 'annuity' ? receivingYears : null,
          return_rate: returnRate,
          rate_category: rateCategory,
          icon: editIcon,
          color: editColor,
        }
      } else if (isDBType && !isAutoMode) {
        pensionFields = {
          pension_type: pensionType,
          current_balance: editValues.balance ? parseFloat(editValues.balance) : null,
          years_of_service: null,
          monthly_salary: null,
          calculation_mode: 'manual',
          receive_type: receiveType,
          start_age: receiveType === 'annuity' ? validatedStartAge : null,
          receiving_years: receiveType === 'annuity' ? receivingYears : null,
          return_rate: returnRate,
          rate_category: rateCategory,
          icon: editIcon,
          color: editColor,
        }
      } else {
        // DC/기업IRP
        pensionFields = {
          pension_type: pensionType,
          current_balance: editValues.balance ? parseFloat(editValues.balance) : null,
          years_of_service: null,
          monthly_salary: editValues.monthlySalary ? parseFloat(editValues.monthlySalary) : null,
          receive_type: receiveType,
          start_age: receiveType === 'annuity' ? validatedStartAge : null,
          receiving_years: receiveType === 'annuity' ? receivingYears : null,
          return_rate: returnRate,
          rate_category: rateCategory,
          icon: editIcon,
          color: editColor,
        }
      }

      await upsertRetirementPension(
        simulationId,
        owner,
        pensionFields,
        birthYear,
        retirementAge
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

  // 예상 수령액 계산: 연금이면 PMT 월 수령액, 일시금이면 퇴직 시 총액
  const pensionEstimate = useMemo(() => {
    if (!pension) return null
    const isDB = pension.pension_type === 'db' || pension.pension_type === 'severance'
    const returnRate = pension.return_rate || 5
    const monthlyRate = Math.pow(1 + returnRate / 100, 1 / 12) - 1
    const monthsUntilRet = Math.max(0, yearsUntilRetirement * 12)

    let totalAtRetirement: number | null = null

    if (isDB) {
      if (pension.calculation_mode === 'manual') {
        totalAtRetirement = pension.current_balance || 0
      } else {
        const annualSalary = pension.monthly_salary || 0
        const totalYears = (pension.years_of_service || 0) + yearsUntilRetirement
        totalAtRetirement = annualSalary > 0 && totalYears > 0
          ? (annualSalary / 12) * totalYears
          : null
      }
    } else {
      // DC/기업IRP: FV(현재잔액) + FV(월 납입 누적) with compound returns
      const balance = pension.current_balance || 0
      const annualSalary = pension.monthly_salary || 0
      const monthlyContrib = annualSalary / 144 // 연간부담금(연봉/12)의 월할

      if (monthlyRate > 0 && monthsUntilRet > 0) {
        const fvBalance = balance * Math.pow(1 + monthlyRate, monthsUntilRet)
        const fvContrib = monthlyContrib * (Math.pow(1 + monthlyRate, monthsUntilRet) - 1) / monthlyRate
        totalAtRetirement = fvBalance + fvContrib
      } else {
        totalAtRetirement = balance + monthlyContrib * monthsUntilRet
      }
    }

    if (totalAtRetirement === null || totalAtRetirement <= 0) return null

    // 일시금: 퇴직 시 총액
    if (pension.receive_type === 'lump_sum') {
      return { amount: totalAtRetirement, isMonthly: false }
    }

    // 연금: PMT 월 수령액 (수령 기간 동안 잔액에 수익률 적용)
    const receivingMonths = (pension.receiving_years || 10) * 12
    let monthlyPMT: number
    if (monthlyRate > 0) {
      monthlyPMT = totalAtRetirement * monthlyRate / (1 - Math.pow(1 + monthlyRate, -receivingMonths))
    } else {
      monthlyPMT = totalAtRetirement / receivingMonths
    }

    return { amount: monthlyPMT, isMonthly: true }
  }, [pension, yearsUntilRetirement])

  if (pension) {
    const isDBType = pension.pension_type === 'db' || pension.pension_type === 'severance'

    // 메타 정보 구성
    const metaParts = []

    if (isDBType) {
      if (pension.calculation_mode === 'manual') {
        metaParts.push(`직접 입력 | 예상 ${formatMoney(pension.current_balance ?? 0)}`)
      } else {
        if (pension.monthly_salary) {
          const years = pension.years_of_service || 0
          metaParts.push(`연봉 ${formatMoney(pension.monthly_salary)} | 현재 ${years}년 근속`)
        } else if (pension.years_of_service) {
          metaParts.push(`현재 ${pension.years_of_service}년 → 퇴직 시 ${pension.years_of_service + yearsUntilRetirement}년 근속`)
        } else {
          metaParts.push('근속연수를 입력하세요')
        }
      }
    } else {
      const dcParts = []
      if (pension.current_balance) {
        dcParts.push(`현재 잔액 ${formatMoney(pension.current_balance)}`)
      }
      if (pension.monthly_salary) {
        dcParts.push(`연봉 ${formatMoney(pension.monthly_salary)}`)
      }
      if (dcParts.length > 0) {
        metaParts.push(dcParts.join(' | '))
      } else {
        metaParts.push('현재 잔액을 입력하세요')
      }
    }

    if (pension.receive_type === 'annuity') {
      metaParts.push(`${birthYear + (pension.start_age || 56)}.${pad2(birthMonth)}부터 ${(pension.receiving_years || 10)}년간 연금 수령`)
    } else if (pension.receive_type === 'lump_sum') {
      metaParts.push('일시금 수령')
    }

    return (
      <>
        <div className={styles.pensionItem} onClick={startEdit} style={{ cursor: 'pointer' }}>
          <FinancialItemIcon
            category="retirementPension"
            type={pension.pension_type}
            icon={pension.icon}
            color={pension.color}
            onSave={async (icon, color) => {
              const isDBType = pension.pension_type === 'db' || pension.pension_type === 'severance'
              const isAutoMode = pension.calculation_mode !== 'manual'

              let pensionFields: Parameters<typeof upsertRetirementPension>[2]
              if (isDBType && isAutoMode) {
                pensionFields = {
                  pension_type: pension.pension_type,
                  current_balance: null,
                  years_of_service: pension.years_of_service,
                  monthly_salary: pension.monthly_salary,
                  calculation_mode: 'auto',
                  receive_type: pension.receive_type,
                  start_age: pension.start_age,
                  receiving_years: pension.receiving_years,
                  return_rate: pension.return_rate,
                  rate_category: pension.rate_category,
                  icon,
                  color,
                }
              } else if (isDBType && !isAutoMode) {
                pensionFields = {
                  pension_type: pension.pension_type,
                  current_balance: pension.current_balance,
                  years_of_service: null,
                  monthly_salary: null,
                  calculation_mode: 'manual',
                  receive_type: pension.receive_type,
                  start_age: pension.start_age,
                  receiving_years: pension.receiving_years,
                  return_rate: pension.return_rate,
                  rate_category: pension.rate_category,
                  icon,
                  color,
                }
              } else {
                pensionFields = {
                  pension_type: pension.pension_type,
                  current_balance: pension.current_balance,
                  years_of_service: null,
                  monthly_salary: pension.monthly_salary,
                  receive_type: pension.receive_type,
                  start_age: pension.start_age,
                  receiving_years: pension.receiving_years,
                  return_rate: pension.return_rate,
                  rate_category: pension.rate_category,
                  icon,
                  color,
                }
              }

              await upsertRetirementPension(
                simulationId,
                owner,
                pensionFields,
                birthYear,
                retirementAge
              )
              await onSave()
            }}
          />
          <div className={styles.itemInfo}>
            <span className={styles.itemName}>
              {ownerLabel} {isDBType ? 'DB형/퇴직금' : 'DC형/기업IRP'}
            </span>
            {metaParts.map((part, i) => (
              <span key={i} className={styles.itemMeta}>{part}</span>
            ))}
          </div>
          <div className={styles.itemRight}>
            <span className={styles.itemAmount}>
              {pensionEstimate !== null
                ? pensionEstimate.isMonthly
                  ? `${formatMoney(Math.round(pensionEstimate.amount))}/월`
                  : formatMoney(Math.round(pensionEstimate.amount))
                : '-'}
            </span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    className={styles.typeModalClose}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm('이 항목을 삭제하시겠습니까?')) {
                        handleDelete()
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
                <FinancialIconPicker
                  category="retirementPension"
                  type={pension?.pension_type || 'db'}
                  icon={editIcon}
                  color={editColor}
                  onIconChange={setEditIcon}
                  onColorChange={setEditColor}
                />
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
                  <>
                    <div className={styles.modalFormRow}>
                      <span className={styles.modalFormLabel}>계산</span>
                      <div className={styles.typeButtons}>
                        <button
                          type="button"
                          className={`${styles.typeBtn} ${editValues.calculationMode !== 'manual' ? styles.active : ''}`}
                          onClick={() => setEditValues({ ...editValues, calculationMode: 'auto' })}
                        >
                          자동 계산
                        </button>
                        <button
                          type="button"
                          className={`${styles.typeBtn} ${editValues.calculationMode === 'manual' ? styles.active : ''}`}
                          onClick={() => setEditValues({ ...editValues, calculationMode: 'manual' })}
                        >
                          직접 입력
                        </button>
                      </div>
                    </div>

                    {editValues.calculationMode !== 'manual' ? (
                      <>
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
                        <div className={styles.modalFormRow}>
                          <span className={styles.modalFormLabel}>연봉</span>
                          <input
                            type="number"
                            className={styles.modalFormInput}
                            value={editValues.monthlySalary || ''}
                            onChange={e => setEditValues({ ...editValues, monthlySalary: e.target.value })}
                            onWheel={e => (e.target as HTMLElement).blur()}
                            min={0}
                            placeholder="0"
                          />
                          <span className={styles.modalFormUnit}>만원</span>
                        </div>
                        {editValues.years && editValues.monthlySalary && (
                          <div className={styles.modalFormRow}>
                            <span className={styles.modalFormLabel} />
                            <span className={styles.modalFormHint}>
                              {`예상 퇴직금: ${formatMoney(Math.round(parseFloat(editValues.monthlySalary) / 12 * (parseInt(editValues.years) + yearsUntilRetirement)))} (연봉/12 x 퇴직시 총 근속연수)`}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className={styles.modalFormRow}>
                        <span className={styles.modalFormLabel}>예상 총액</span>
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
                    )}
                  </>
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
                      <span className={styles.modalFormLabel}>연봉</span>
                      <input
                        type="number"
                        className={styles.modalFormInput}
                        value={editValues.monthlySalary || ''}
                        onChange={e => setEditValues({ ...editValues, monthlySalary: e.target.value })}
                        onWheel={e => (e.target as HTMLElement).blur()}
                        min={0}
                        placeholder="0"
                      />
                      <span className={styles.modalFormUnit}>만원</span>
                    </div>
                    <span className={styles.modalFormHint}>매년 연봉의 1/12이 회사에서 DC 계좌로 적립됩니다</span>
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
                              y => setEditValues(prev => ({ ...prev, startYear: String(y) })),
                              m => setEditValues(prev => ({ ...prev, startMonth: String(m) }))
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
                              y => setEditValues(prev => ({ ...prev, endYear: String(y) })),
                              m => setEditValues(prev => ({ ...prev, endMonth: String(m) }))
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
