'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { OnboardingData } from '@/types'
import { formatMoney } from '@/lib/utils'
import styles from '../PensionTab.module.css'

interface PersonalPensionSectionProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  owner: 'self' | 'spouse'
  ownerLabel: string
}

export function PersonalPensionSection({
  data,
  onUpdateData,
  owner,
  ownerLabel,
}: PersonalPensionSectionProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const cancelEdit = () => {
    setEditingField(null)
    setEditValues({})
  }

  // 본인 데이터
  const selfPensionSavings = {
    balance: data.pensionSavingsBalance,
    monthly: data.pensionSavingsMonthlyContribution,
    startAge: data.pensionSavingsStartAge || 56,
    years: data.pensionSavingsReceivingYears || 20,
  }
  const selfIrp = {
    balance: data.irpBalance,
    monthly: data.irpMonthlyContribution,
    startAge: data.irpStartAge || 56,
    years: data.irpReceivingYears || 20,
  }

  // 배우자 데이터
  const spousePensionSavings = {
    balance: data.spousePensionSavingsBalance,
    monthly: data.spousePensionSavingsMonthlyContribution,
    startAge: data.spousePensionSavingsStartAge || 56,
    years: data.spousePensionSavingsReceivingYears || 20,
  }
  const spouseIrp = {
    balance: data.spouseIrpBalance,
    monthly: data.spouseIrpMonthlyContribution,
    startAge: data.spouseIrpStartAge || 56,
    years: data.spouseIrpReceivingYears || 20,
  }

  const pensionSavings = owner === 'self' ? selfPensionSavings : spousePensionSavings
  const irp = owner === 'self' ? selfIrp : spouseIrp

  // 연금저축 저장
  const savePensionSavings = () => {
    const validatedStartAge = Math.max(56, parseInt(editValues.startAge) || 56)

    if (owner === 'self') {
      onUpdateData({
        pensionSavingsBalance: editValues.balance ? parseFloat(editValues.balance) : null,
        pensionSavingsMonthlyContribution: editValues.monthly ? parseFloat(editValues.monthly) : null,
        pensionSavingsStartAge: validatedStartAge,
        pensionSavingsReceivingYears: editValues.years ? parseInt(editValues.years) : 20,
      })
    } else {
      onUpdateData({
        spousePensionSavingsBalance: editValues.balance ? parseFloat(editValues.balance) : null,
        spousePensionSavingsMonthlyContribution: editValues.monthly ? parseFloat(editValues.monthly) : null,
        spousePensionSavingsStartAge: validatedStartAge,
        spousePensionSavingsReceivingYears: editValues.years ? parseInt(editValues.years) : 20,
      })
    }
    cancelEdit()
  }

  // IRP 저장
  const saveIrp = () => {
    const validatedStartAge = Math.max(56, parseInt(editValues.startAge) || 56)

    if (owner === 'self') {
      onUpdateData({
        irpBalance: editValues.balance ? parseFloat(editValues.balance) : null,
        irpMonthlyContribution: editValues.monthly ? parseFloat(editValues.monthly) : null,
        irpStartAge: validatedStartAge,
        irpReceivingYears: editValues.years ? parseInt(editValues.years) : 20,
      })
    } else {
      onUpdateData({
        spouseIrpBalance: editValues.balance ? parseFloat(editValues.balance) : null,
        spouseIrpMonthlyContribution: editValues.monthly ? parseFloat(editValues.monthly) : null,
        spouseIrpStartAge: validatedStartAge,
        spouseIrpReceivingYears: editValues.years ? parseInt(editValues.years) : 20,
      })
    }
    cancelEdit()
  }

  const fieldPrefix = owner === 'self' ? '' : 'spouse_'

  return (
    <div className={styles.itemList}>
      {/* 연금저축 */}
      {editingField === `${fieldPrefix}pensionSavings` ? (
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
            <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
            <button className={styles.saveBtn} onClick={savePensionSavings}>저장</button>
          </div>
        </div>
      ) : (
        <div className={styles.pensionItem}>
          <div className={styles.itemMain}>
            <span className={styles.itemLabel}>{ownerLabel} 연금저축</span>
            <span className={styles.itemAmount}>
              {pensionSavings.balance ? formatMoney(pensionSavings.balance) : '0'}
            </span>
            {pensionSavings.balance || pensionSavings.monthly ? (
              <span className={styles.itemMeta}>
                {pensionSavings.monthly ? `월 ${formatMoney(pensionSavings.monthly)} 납입 | ` : ''}
                {pensionSavings.startAge}세부터 {pensionSavings.years}년간 수령
              </span>
            ) : null}
          </div>
          <div className={styles.itemActions}>
            <button
              className={styles.editBtn}
              onClick={() => {
                setEditingField(`${fieldPrefix}pensionSavings`)
                setEditValues({
                  balance: pensionSavings.balance?.toString() || '',
                  monthly: pensionSavings.monthly?.toString() || '',
                  startAge: pensionSavings.startAge.toString(),
                  years: pensionSavings.years.toString(),
                })
              }}
            >
              <Pencil size={16} />
            </button>
          </div>
        </div>
      )}

      {/* IRP */}
      {editingField === `${fieldPrefix}irp` ? (
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
            <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
            <button className={styles.saveBtn} onClick={saveIrp}>저장</button>
          </div>
        </div>
      ) : (
        <div className={styles.pensionItem}>
          <div className={styles.itemMain}>
            <span className={styles.itemLabel}>{ownerLabel} IRP</span>
            <span className={styles.itemAmount}>
              {irp.balance ? formatMoney(irp.balance) : '0'}
            </span>
            {irp.balance || irp.monthly ? (
              <span className={styles.itemMeta}>
                {irp.monthly ? `월 ${formatMoney(irp.monthly)} 납입 | ` : ''}
                {irp.startAge}세부터 {irp.years}년간 수령
              </span>
            ) : null}
          </div>
          <div className={styles.itemActions}>
            <button
              className={styles.editBtn}
              onClick={() => {
                setEditingField(`${fieldPrefix}irp`)
                setEditValues({
                  balance: irp.balance?.toString() || '',
                  monthly: irp.monthly?.toString() || '',
                  startAge: irp.startAge.toString(),
                  years: irp.years.toString(),
                })
              }}
            >
              <Pencil size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
