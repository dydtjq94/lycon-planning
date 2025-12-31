'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { OnboardingData } from '@/types'
import { formatMoney } from '@/lib/utils'
import styles from '../PensionTab.module.css'

interface NationalPensionSectionProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  owner: 'self' | 'spouse'
  ownerLabel: string
}

export function NationalPensionSection({
  data,
  onUpdateData,
  owner,
  ownerLabel,
}: NationalPensionSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  // 본인 또는 배우자 데이터 선택
  const pensionAmount = owner === 'self' ? data.nationalPension : data.spouseNationalPension
  const startAge = owner === 'self'
    ? (data.nationalPensionStartAge || 65)
    : (data.spouseNationalPensionStartAge || 65)

  const startEdit = () => {
    setIsEditing(true)
    setEditValues({
      amount: pensionAmount?.toString() || '',
      startAge: startAge.toString(),
    })
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditValues({})
  }

  const saveEdit = () => {
    if (owner === 'self') {
      onUpdateData({
        nationalPension: editValues.amount ? parseFloat(editValues.amount) : null,
        nationalPensionStartAge: editValues.startAge ? parseInt(editValues.startAge) : null,
      })
    } else {
      onUpdateData({
        spouseNationalPension: editValues.amount ? parseFloat(editValues.amount) : null,
        spouseNationalPensionStartAge: editValues.startAge ? parseInt(editValues.startAge) : null,
      })
    }
    setIsEditing(false)
    setEditValues({})
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
          <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
          <button className={styles.saveBtn} onClick={saveEdit}>저장</button>
        </div>
      </div>
    )
  }

  if (pensionAmount) {
    return (
      <div className={styles.pensionItem}>
        <div className={styles.itemMain}>
          <span className={styles.itemLabel}>{ownerLabel} 국민연금</span>
          <span className={styles.itemAmount}>{formatMoney(pensionAmount)}/월</span>
          <span className={styles.itemMeta}>{startAge}세부터 수령</span>
        </div>
        <div className={styles.itemActions}>
          <button className={styles.editBtn} onClick={startEdit}>
            <Pencil size={16} />
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
