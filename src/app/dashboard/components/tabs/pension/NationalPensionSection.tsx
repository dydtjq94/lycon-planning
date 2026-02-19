'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X } from 'lucide-react'
import type { NationalPension, Owner } from '@/types/tables'
import { formatMoney } from '@/lib/utils'
import {
  upsertNationalPension,
  deleteNationalPension,
} from '@/lib/services/nationalPensionService'
import { useChartTheme } from '@/hooks/useChartTheme'
import {
  formatPeriodDisplay,
  toPeriodRaw,
  isPeriodValid,
  handlePeriodTextChange,
} from '@/lib/utils/periodInput'
import styles from '../PensionTab.module.css'

interface NationalPensionSectionProps {
  pension: NationalPension | null
  simulationId: string
  owner: Owner
  ownerLabel: string
  birthYear: number
  onSave: () => void
  retirementAge?: number
  lifeExpectancy?: number
  inflationRate?: number
}

export function NationalPensionSection({
  pension,
  simulationId,
  owner,
  ownerLabel,
  birthYear,
  onSave,
  retirementAge,
  lifeExpectancy,
  inflationRate,
}: NationalPensionSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [startDateText, setStartDateText] = useState('')
  const [endDateText, setEndDateText] = useState('')
  const [startMode, setStartMode] = useState<'default' | 'custom'>('default')
  const [endMode, setEndMode] = useState<'none' | 'lifeExpectancy' | 'custom'>('none')
  const [isSaving, setIsSaving] = useState(false)
  const { isDark } = useChartTheme()

  const startEdit = () => {
    setIsEditing(true)
    const startAge = pension?.start_age || 65
    const endAge = pension?.end_age || null
    const startYear = birthYear + startAge
    const endYear = endAge ? birthYear + endAge : null

    setEditValues({
      amount: pension?.expected_monthly_amount?.toString() || '',
      startYear: String(startYear),
      startMonth: '1',
      endYear: endYear ? String(endYear) : '',
      endMonth: endYear ? '12' : '',
    })
    setStartDateText(toPeriodRaw(startYear, 1))
    setEndDateText(endYear ? toPeriodRaw(endYear, 12) : '')

    // 수령시작 모드 복원: 65세와 일치하면 default
    if (startAge === 65) {
      setStartMode('default')
    } else {
      setStartMode('custom')
    }

    // 수령종료 모드 복원: 기대수명과 일치하면 lifeExpectancy
    if (!endAge) {
      setEndMode('none')
    } else if (lifeExpectancy && endAge === lifeExpectancy) {
      setEndMode('lifeExpectancy')
    } else {
      setEndMode('custom')
    }
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditValues({})
    setStartDateText('')
    setEndDateText('')
    setStartMode('default')
    setEndMode('none')
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
    if (!editValues.amount) return

    setIsSaving(true)
    try {
      const startYear = parseInt(editValues.startYear) || (birthYear + 65)
      const startAge = startYear - birthYear
      const endYear = editValues.endYear ? parseInt(editValues.endYear) : null
      const endAge = endYear ? endYear - birthYear : null
      await upsertNationalPension(
        simulationId,
        owner,
        {
          expected_monthly_amount: parseFloat(editValues.amount),
          start_age: startAge,
          end_age: endAge,
        },
        birthYear
      )
      await onSave()
      setIsEditing(false)
      setEditValues({})
    } catch (error) {
      console.error('Failed to save national pension:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pension) return

    setIsSaving(true)
    try {
      await deleteNationalPension(pension.id)
      await onSave()
    } catch (error) {
      console.error('Failed to delete national pension:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 읽기 뷰
  if (pension) {
    return (
      <>
        <div className={styles.pensionItem} onClick={startEdit} style={{ cursor: 'pointer' }}>
          <div className={styles.itemInfo}>
            <span className={styles.itemName}>{ownerLabel} 공적연금</span>
            <span className={styles.itemMeta}>
              {birthYear + pension.start_age}년부터 수령{pension.end_age ? ` ~ ${birthYear + pension.end_age}년` : ''}
            </span>
            {inflationRate && (() => {
              const currentYear = new Date().getFullYear()
              const startYear = birthYear + pension.start_age
              const years = startYear - currentYear
              if (years <= 0) return null
              const amount = pension.expected_monthly_amount
              if (!amount || amount <= 0) return null
              const presentValue = amount / Math.pow(1 + inflationRate / 100, years)
              return (
                <span className={styles.itemMeta}>
                  {`현재 가치 기준 약 ${formatMoney(Math.round(presentValue))}/월`}
                </span>
              )
            })()}
          </div>
          <div className={styles.itemRight}>
            <span className={styles.itemAmount}>{formatMoney(pension.expected_monthly_amount)}/월</span>
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
                <span className={styles.stepLabel}>{ownerLabel} 공적연금 수정</span>
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
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>금액</span>
                  <input
                    type="number"
                    className={styles.modalFormInput}
                    value={editValues.amount || ''}
                    onChange={e => setEditValues({ ...editValues, amount: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder="0"
                    autoFocus
                  />
                  <span className={styles.modalFormUnit}>만원/월</span>
                </div>
                {editValues.amount && editValues.startYear && inflationRate && (() => {
                  const currentYear = new Date().getFullYear()
                  const startYear = parseInt(editValues.startYear)
                  const years = startYear - currentYear
                  if (years <= 0) return null
                  const amount = parseFloat(editValues.amount)
                  if (!amount || amount <= 0) return null
                  const presentValue = amount / Math.pow(1 + inflationRate / 100, years)
                  return (
                    <div className={styles.modalFormRow}>
                      <span className={styles.modalFormLabel} />
                      <span className={styles.modalFormHint}>
                        {`현재 가치 기준 약 ${formatMoney(Math.round(presentValue))}/월 (물가상승률 ${inflationRate}%)`}
                      </span>
                    </div>
                  )
                })()}
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>수령시작</span>
                  <div className={styles.fieldContent}>
                    <select
                      className={styles.periodSelect}
                      value={startMode}
                      onChange={e => {
                        const mode = e.target.value as 'default' | 'custom'
                        setStartMode(mode)
                        if (mode === 'default') {
                          const year = birthYear + 65
                          setEditValues({ ...editValues, startYear: String(year), startMonth: '1' })
                          setStartDateText(toPeriodRaw(year, 1))
                        }
                      }}
                    >
                      <option value="default">
                        65세 ({birthYear + 65}년)
                      </option>
                      <option value="custom">직접 입력</option>
                    </select>
                    {startMode === 'custom' && (
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
                    )}
                  </div>
                </div>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>수령종료</span>
                  <div className={styles.fieldContent}>
                    <select
                      className={styles.periodSelect}
                      value={endMode}
                      onChange={e => {
                        const mode = e.target.value as 'none' | 'lifeExpectancy' | 'custom'
                        setEndMode(mode)
                        if (mode === 'none') {
                          setEditValues({ ...editValues, endYear: '', endMonth: '' })
                          setEndDateText('')
                        } else if (mode === 'lifeExpectancy' && lifeExpectancy) {
                          const year = birthYear + lifeExpectancy
                          setEditValues({ ...editValues, endYear: String(year), endMonth: '12' })
                          setEndDateText(toPeriodRaw(year, 12))
                        }
                      }}
                    >
                      <option value="none">종료 없음 (평생)</option>
                      {lifeExpectancy && (
                        <option value="lifeExpectancy">
                          기대수명 ({lifeExpectancy}세, {birthYear + lifeExpectancy}년)
                        </option>
                      )}
                      <option value="custom">직접 입력</option>
                    </select>
                    {endMode === 'custom' && (
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
                    )}
                  </div>
                </div>
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
