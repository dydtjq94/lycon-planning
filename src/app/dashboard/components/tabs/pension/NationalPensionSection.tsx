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
    const startAge = pension?.start_age || 65
    const endAge = pension?.end_age || null
    setEditValues({
      amount: pension?.expected_monthly_amount?.toString() || '',
      startYear: String(birthYear + startAge),
      startMonth: '1',
      endYear: endAge ? String(birthYear + endAge) : '',
      endMonth: endAge ? '12' : '',
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
              placeholder=""
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
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{ownerLabel} 국민연금</span>
          <span className={styles.itemMeta}>
            {birthYear + pension.start_age}년부터 수령{pension.end_age ? ` ~ ${birthYear + pension.end_age}년` : ''}
          </span>
        </div>
        <div className={styles.itemRight}>
          <span className={styles.itemAmount}>{formatMoney(pension.expected_monthly_amount)}/월</span>
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
      + {ownerLabel} 국민연금 추가
    </button>
  )
}
