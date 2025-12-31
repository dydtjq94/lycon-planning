'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { OnboardingData } from '@/types'
import { formatMoney } from '@/lib/utils'
import type { RetirementPensionProjection } from './usePensionCalculations'
import styles from '../PensionTab.module.css'

interface RetirementPensionSectionProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  owner: 'self' | 'spouse'
  ownerLabel: string
  projection: RetirementPensionProjection | null
  monthlyIncome: number
  yearsUntilRetirement: number
}

export function RetirementPensionSection({
  data,
  onUpdateData,
  owner,
  ownerLabel,
  projection,
  monthlyIncome,
  yearsUntilRetirement,
}: RetirementPensionSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  // 본인 또는 배우자 데이터 선택
  const pensionType = owner === 'self' ? data.retirementPensionType : data.spouseRetirementPensionType
  const yearsOfService = owner === 'self' ? data.yearsOfService : data.spouseYearsOfService
  const balance = owner === 'self' ? data.retirementPensionBalance : data.spouseRetirementPensionBalance
  const receiveType = owner === 'self' ? data.retirementPensionReceiveType : data.spouseRetirementPensionReceiveType
  const startAge = owner === 'self' ? data.retirementPensionStartAge : data.spouseRetirementPensionStartAge
  const receivingYears = owner === 'self' ? data.retirementPensionReceivingYears : data.spouseRetirementPensionReceivingYears

  const startEdit = () => {
    const isDB = pensionType === 'DB' || pensionType === 'severance'
    setIsEditing(true)
    setEditValues({
      type: isDB ? 'DB' : pensionType === 'DC' || pensionType === 'corporate_irp' ? 'DC' : '',
      years: yearsOfService?.toString() || '',
      balance: balance?.toString() || '',
      receiveType: receiveType || 'annuity',
      startAge: (startAge || 56).toString(),
      receivingYears: (receivingYears || 10).toString(),
    })
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditValues({})
  }

  const saveEdit = () => {
    // 수령 시작 나이 56세 이상 검증
    const validatedStartAge = Math.max(56, parseInt(editValues.startAge) || 56)

    if (owner === 'self') {
      onUpdateData({
        retirementPensionType: editValues.type as 'DB' | 'DC' | null,
        yearsOfService: editValues.type === 'DB' && editValues.years ? parseInt(editValues.years) : null,
        retirementPensionBalance: editValues.type === 'DC' && editValues.balance ? parseFloat(editValues.balance) : null,
        retirementPensionReceiveType: editValues.receiveType as 'lump_sum' | 'annuity' | null,
        retirementPensionStartAge: editValues.receiveType === 'annuity' ? validatedStartAge : null,
        retirementPensionReceivingYears: editValues.receiveType === 'annuity' && editValues.receivingYears ? parseInt(editValues.receivingYears) : null,
      })
    } else {
      onUpdateData({
        spouseRetirementPensionType: editValues.type as 'DB' | 'DC' | null,
        spouseYearsOfService: editValues.type === 'DB' && editValues.years ? parseInt(editValues.years) : null,
        spouseRetirementPensionBalance: editValues.type === 'DC' && editValues.balance ? parseFloat(editValues.balance) : null,
        spouseRetirementPensionReceiveType: editValues.receiveType as 'lump_sum' | 'annuity' | null,
        spouseRetirementPensionStartAge: editValues.receiveType === 'annuity' ? validatedStartAge : null,
        spouseRetirementPensionReceivingYears: editValues.receiveType === 'annuity' && editValues.receivingYears ? parseInt(editValues.receivingYears) : null,
      })
    }
    setIsEditing(false)
    setEditValues({})
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
              <div className={styles.editRow}>
                <span className={styles.editRowLabel}>기간</span>
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
                    value={editValues.receivingYears || ''}
                    onChange={e => setEditValues({ ...editValues, receivingYears: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    min={5}
                    max={30}
                    placeholder="10"
                  />
                  <span className={styles.editUnit}>년간</span>
                </div>
              </div>
            )}
          </>
        )}

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
          <button className={styles.saveBtn} onClick={saveEdit}>저장</button>
        </div>
      </div>
    )
  }

  if (pensionType) {
    const isDBType = pensionType === 'DB' || pensionType === 'severance'
    const isDCType = pensionType === 'DC' || pensionType === 'corporate_irp'

    return (
      <div className={styles.pensionItem}>
        <div className={styles.itemMain}>
          <span className={styles.itemLabel}>
            {ownerLabel} {isDBType ? 'DB형/퇴직금' : 'DC형/기업IRP'}
          </span>
          <span className={styles.itemAmount}>
            {projection
              ? receiveType === 'annuity' && projection.monthlyPMT
                ? `${formatMoney(projection.monthlyPMT)}/월`
                : formatMoney(projection.totalAmount)
              : '계산 불가'}
          </span>
          <span className={styles.itemMeta}>
            {isDBType
              ? yearsOfService
                ? `현재 ${yearsOfService}년 → 퇴직 시 ${yearsOfService + yearsUntilRetirement}년 근속`
                : '근속연수를 입력하세요'
              : balance
                ? `현재 잔액 ${formatMoney(balance)}`
                : '현재 잔액을 입력하세요'
            }
            {receiveType === 'annuity'
              ? ` | ${startAge || 56}세부터 ${receivingYears || 10}년간 연금 수령`
              : receiveType === 'lump_sum'
                ? ' | 일시금 수령'
                : ''
            }
            {!monthlyIncome && ' | 소득 탭에서 근로소득 입력 필요'}
          </span>
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
      + {ownerLabel} 퇴직연금 추가
    </button>
  )
}
