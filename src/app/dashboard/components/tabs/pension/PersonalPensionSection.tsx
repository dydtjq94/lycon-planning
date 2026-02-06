'use client'

import { useState, useMemo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { PersonalPension, Owner, PersonalPensionType } from '@/types/tables'
import { formatMoney } from '@/lib/utils'
import {
  upsertPersonalPension,
  deletePersonalPension,
  PENSION_TYPE_LABELS,
} from '@/lib/services/personalPensionService'
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
  const [isSaving, setIsSaving] = useState(false)

  // 타입별 연금 찾기
  const pensionSavings = useMemo(
    () => pensions.find(p => p.pension_type === 'pension_savings') || null,
    [pensions]
  )
  const irp = useMemo(
    () => pensions.find(p => p.pension_type === 'irp') || null,
    [pensions]
  )

  const cancelEdit = () => {
    setEditingType(null)
    setEditValues({})
  }

  const startEditPensionSavings = () => {
    setEditingType('pension_savings')
    setEditValues({
      balance: pensionSavings?.current_balance?.toString() || '',
      monthly: pensionSavings?.monthly_contribution?.toString() || '',
      startAge: (pensionSavings?.start_age || 56).toString(),
      years: (pensionSavings?.receiving_years || 20).toString(),
    })
  }

  const startEditIrp = () => {
    setEditingType('irp')
    setEditValues({
      balance: irp?.current_balance?.toString() || '',
      monthly: irp?.monthly_contribution?.toString() || '',
      startAge: (irp?.start_age || 56).toString(),
      years: (irp?.receiving_years || 20).toString(),
    })
  }

  const savePension = async (pensionType: PersonalPensionType) => {
    setIsSaving(true)
    try {
      const validatedStartAge = Math.max(56, parseInt(editValues.startAge) || 56)

      await upsertPersonalPension(
        simulationId,
        owner,
        pensionType,
        {
          current_balance: editValues.balance ? parseFloat(editValues.balance) : 0,
          monthly_contribution: editValues.monthly ? parseFloat(editValues.monthly) : null,
          is_contribution_fixed_to_retirement: true,
          start_age: validatedStartAge,
          receiving_years: editValues.years ? parseInt(editValues.years) : 20,
          return_rate: 5, // 기본 수익률 5%
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
    if (!confirm(`${PENSION_TYPE_LABELS[pensionType]} 정보를 삭제하시겠습니까?`)) return

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

  return (
    <div className={styles.itemList}>
      {/* 연금저축 */}
      {editingType === 'pension_savings' ? (
        <div className={styles.editItem}>
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
                autoFocus
              />
              <span className={styles.editUnit}>만원</span>
            </div>
          </div>
          <div className={styles.editRow}>
            <span className={styles.editRowLabel}>납입</span>
            <div className={styles.editField}>
              <input
                type="number"
                className={styles.editInput}
                value={editValues.monthly || ''}
                onChange={e => setEditValues({ ...editValues, monthly: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.editUnit}>만원/월</span>
            </div>
          </div>
          <div className={styles.editRow}>
            <span className={styles.editRowLabel}>수령</span>
            <div className={styles.editField}>
              <input
                type="number"
                className={styles.editInputSmall}
                value={editValues.startAge || ''}
                onChange={e => setEditValues({ ...editValues, startAge: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                min={56}
                max={80}
                placeholder="56"
              />
              <span className={styles.editUnit}>세부터</span>
              <input
                type="number"
                className={styles.editInputSmall}
                value={editValues.years || ''}
                onChange={e => setEditValues({ ...editValues, years: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                min={10}
                max={30}
                placeholder="20"
              />
              <span className={styles.editUnit}>년간</span>
            </div>
          </div>
          <div className={styles.editActions}>
            <button className={styles.cancelBtn} onClick={cancelEdit} disabled={isSaving}>
              취소
            </button>
            <button
              className={styles.saveBtn}
              onClick={() => savePension('pension_savings')}
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.pensionItem}>
          <div className={styles.itemMain}>
            <span className={styles.itemLabel}>{ownerLabel} 연금저축</span>
            <span className={styles.itemAmount}>
              {pensionSavings?.current_balance ? formatMoney(pensionSavings.current_balance) : '0'}
            </span>
            {pensionSavings?.title && (
              <span className={styles.itemName}>
                {pensionSavings.title}
                {pensionSavings.broker_name && <span className={styles.brokerName}>{pensionSavings.broker_name}</span>}
              </span>
            )}
            {(pensionSavings?.current_balance || pensionSavings?.monthly_contribution) ? (
              <span className={styles.itemMeta}>
                {pensionSavings?.monthly_contribution ? `월 ${formatMoney(pensionSavings.monthly_contribution)} 납입 | ` : ''}
                {pensionSavings?.start_age || 56}세부터 {pensionSavings?.receiving_years || 20}년간 수령
              </span>
            ) : null}
          </div>
          <div className={styles.itemActions}>
            <button className={styles.editBtn} onClick={startEditPensionSavings}>
              <Pencil size={16} />
            </button>
            {pensionSavings && (
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete('pension_savings')}
                disabled={isSaving}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* IRP */}
      {editingType === 'irp' ? (
        <div className={styles.editItem}>
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
                autoFocus
              />
              <span className={styles.editUnit}>만원</span>
            </div>
          </div>
          <div className={styles.editRow}>
            <span className={styles.editRowLabel}>납입</span>
            <div className={styles.editField}>
              <input
                type="number"
                className={styles.editInput}
                value={editValues.monthly || ''}
                onChange={e => setEditValues({ ...editValues, monthly: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.editUnit}>만원/월</span>
            </div>
          </div>
          <div className={styles.editRow}>
            <span className={styles.editRowLabel}>수령</span>
            <div className={styles.editField}>
              <input
                type="number"
                className={styles.editInputSmall}
                value={editValues.startAge || ''}
                onChange={e => setEditValues({ ...editValues, startAge: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                min={56}
                max={80}
                placeholder="56"
              />
              <span className={styles.editUnit}>세부터</span>
              <input
                type="number"
                className={styles.editInputSmall}
                value={editValues.years || ''}
                onChange={e => setEditValues({ ...editValues, years: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                min={10}
                max={30}
                placeholder="20"
              />
              <span className={styles.editUnit}>년간</span>
            </div>
          </div>
          <div className={styles.editActions}>
            <button className={styles.cancelBtn} onClick={cancelEdit} disabled={isSaving}>
              취소
            </button>
            <button
              className={styles.saveBtn}
              onClick={() => savePension('irp')}
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.pensionItem}>
          <div className={styles.itemMain}>
            <span className={styles.itemLabel}>{ownerLabel} IRP</span>
            <span className={styles.itemAmount}>
              {irp?.current_balance ? formatMoney(irp.current_balance) : '0'}
            </span>
            {irp?.title && (
              <span className={styles.itemName}>
                {irp.title}
                {irp.broker_name && <span className={styles.brokerName}>{irp.broker_name}</span>}
              </span>
            )}
            {(irp?.current_balance || irp?.monthly_contribution) ? (
              <span className={styles.itemMeta}>
                {irp?.monthly_contribution ? `월 ${formatMoney(irp.monthly_contribution)} 납입 | ` : ''}
                {irp?.start_age || 56}세부터 {irp?.receiving_years || 20}년간 수령
              </span>
            ) : null}
          </div>
          <div className={styles.itemActions}>
            <button className={styles.editBtn} onClick={startEditIrp}>
              <Pencil size={16} />
            </button>
            {irp && (
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete('irp')}
                disabled={isSaving}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
