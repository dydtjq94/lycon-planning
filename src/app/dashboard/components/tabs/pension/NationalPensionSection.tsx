'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { NationalPension, Owner } from '@/types/tables'
import { formatMoney } from '@/lib/utils'
import {
  upsertNationalPension,
  deleteNationalPension,
} from '@/lib/services/nationalPensionService'
import styles from '../PensionTab.module.css'

interface NationalPensionSectionProps {
  pension: NationalPension | null
  simulationId: string
  owner: Owner
  ownerLabel: string
  birthYear: number
  onSave: () => void
}

export function NationalPensionSection({
  pension,
  simulationId,
  owner,
  ownerLabel,
  birthYear,
  onSave,
}: NationalPensionSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  const startEdit = () => {
    setIsEditing(true)
    setEditValues({
      amount: pension?.expected_monthly_amount?.toString() || '',
      startAge: (pension?.start_age || 65).toString(),
    })
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditValues({})
  }

  const saveEdit = async () => {
    if (!editValues.amount) return

    setIsSaving(true)
    try {
      await upsertNationalPension(
        simulationId,
        owner,
        {
          expected_monthly_amount: parseFloat(editValues.amount),
          start_age: parseInt(editValues.startAge) || 65,
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
    if (!confirm('국민연금 정보를 삭제하시겠습니까?')) return

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

  if (isEditing) {
    return (
      <div className={styles.editItem}>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>금액</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInput}
              value={editValues.amount || ''}
              onChange={e => setEditValues({ ...editValues, amount: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
              autoFocus
            />
            <span className={styles.editUnit}>만원/월</span>
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>시작</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInputSmall}
              value={editValues.startAge || ''}
              onChange={e => setEditValues({ ...editValues, startAge: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              min={60}
              max={70}
            />
            <span className={styles.editUnit}>세부터 수령</span>
          </div>
        </div>
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
    return (
      <div className={styles.pensionItem}>
        <div className={styles.itemMain}>
          <span className={styles.itemLabel}>{ownerLabel} 국민연금</span>
          <span className={styles.itemAmount}>{formatMoney(pension.expected_monthly_amount)}/월</span>
          <span className={styles.itemMeta}>{pension.start_age}세부터 수령</span>
        </div>
        <div className={styles.itemActions}>
          <button className={styles.editBtn} onClick={startEdit}>
            <Pencil size={16} />
          </button>
          <button className={styles.deleteBtn} onClick={handleDelete} disabled={isSaving}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <button className={styles.addBtn} onClick={startEdit}>
      + {ownerLabel} 국민연금 추가
    </button>
  )
}
