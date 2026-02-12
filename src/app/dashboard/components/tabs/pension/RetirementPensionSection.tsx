'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { RetirementPension, Owner, RetirementPensionType, ReceiveType } from '@/types/tables'
import { formatMoney } from '@/lib/utils'
import {
  upsertRetirementPension,
  deleteRetirementPension,
  PENSION_TYPE_LABELS,
} from '@/lib/services/retirementPensionService'
import type { RetirementPensionProjection } from './usePensionCalculations'
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
  onSave,
}: RetirementPensionSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  const startEdit = () => {
    const isDB = pension?.pension_type === 'db' || pension?.pension_type === 'severance'
    setIsEditing(true)
    setEditValues({
      type: isDB ? 'DB' : pension?.pension_type === 'dc' || pension?.pension_type === 'corporate_irp' ? 'DC' : '',
      years: pension?.years_of_service?.toString() || '',
      balance: pension?.current_balance?.toString() || '',
      receiveType: pension?.receive_type || 'annuity',
      startYear: String(birthYear + (pension?.start_age || 56)),
      startMonth: '1',
      endYear: String(birthYear + (pension?.start_age || 56) + (pension?.receiving_years || 10)),
      endMonth: '12',
    })
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditValues({})
  }

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
          return_rate: 5, // 기본 수익률 5%
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
    if (!confirm('퇴직연금 정보를 삭제하시겠습니까?')) return

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

  if (isEditing) {
    return (
      <div className={styles.editItem}>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>유형</span>
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
          <div className={styles.editRow}>
            <span className={styles.editRowLabel}>근속</span>
            <div className={styles.editField}>
              <input
                type="number"
                className={styles.editInputSmall}
                value={editValues.years || ''}
                onChange={e => setEditValues({ ...editValues, years: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                min={0}
                max={50}
                placeholder="0"
              />
              <span className={styles.editUnit}>년</span>
            </div>
          </div>
        )}

        {editValues.type === 'DC' && (
          <div className={styles.editRow}>
            <span className={styles.editRowLabel}>잔액</span>
            <div className={styles.editField}>
              <input
                type="number"
                className={styles.editInput}
                value={editValues.balance || ''}
                onChange={e => setEditValues({ ...editValues, balance: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.editUnit}>만원</span>
            </div>
          </div>
        )}

        {editValues.type && (
          <>
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>수령</span>
              <div className={styles.typeButtons}>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${editValues.receiveType === 'annuity' ? styles.active : ''}`}
                  onClick={() => setEditValues({ ...editValues, receiveType: 'annuity' })}
                >
                  연금 수령 (세금 30~40% 감면)
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
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>수령시작</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.startYear || ''}
                      onChange={e => setEditValues({ ...editValues, startYear: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.editUnit}>년</span>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.startMonth || ''}
                      onChange={e => setEditValues({ ...editValues, startMonth: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={1}
                      max={12}
                      placeholder="1"
                    />
                    <span className={styles.editUnit}>월</span>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>수령종료</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.endYear || ''}
                      onChange={e => setEditValues({ ...editValues, endYear: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.editUnit}>년</span>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.endMonth || ''}
                      onChange={e => setEditValues({ ...editValues, endMonth: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={1}
                      max={12}
                      placeholder="12"
                    />
                    <span className={styles.editUnit}>월</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={cancelEdit} disabled={isSaving}>
            취소
          </button>
          <button className={styles.saveBtn} onClick={saveEdit} disabled={isSaving}>
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    )
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
    )
  }

  return (
    <button className={styles.addBtn} onClick={startEdit}>
      + {ownerLabel} 퇴직연금 추가
    </button>
  )
}
