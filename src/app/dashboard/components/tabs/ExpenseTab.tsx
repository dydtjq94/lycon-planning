'use client'

import { useMemo } from 'react'
import { Pencil, Plus } from 'lucide-react'
import type { OnboardingData, FinancialItemInput, ExpenseData } from '@/types'
import {
  migrateOnboardingToFinancialItems,
  CASHFLOW_UI_GROUPS,
  createChildEducationItems,
} from '@/lib/services'
import styles from './ExpenseTab.module.css'

interface ExpenseTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

type ExpenseItem = FinancialItemInput & {
  data: ExpenseData
}

export function ExpenseTab({ data }: ExpenseTabProps) {
  const currentYear = new Date().getFullYear()
  const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : currentYear - 35
  const retirementYear = birthYear + data.target_retirement_age

  // OnboardingData를 FinancialItem으로 변환
  const financialItems = useMemo(() => {
    const items = migrateOnboardingToFinancialItems(data, 'temp')

    // 자녀 교육비 추가
    if (data.children && data.children.length > 0) {
      data.children.forEach((child) => {
        if (child.birth_date) {
          const childBirthYear = parseInt(child.birth_date.split('-')[0])
          const childName = child.name || '자녀'
          const educationItems = createChildEducationItems('temp', childName, childBirthYear, currentYear)
          items.push(...educationItems)
        }
      })
    }

    return items
  }, [data, currentYear])

  // 지출 항목 필터링
  const expenseItems = useMemo(() => {
    return financialItems.filter(item => item.category === 'expense') as ExpenseItem[]
  }, [financialItems])

  // 그룹별로 항목 분류
  const getItemsByTypes = (items: ExpenseItem[], types: readonly string[]) => {
    return items.filter(item => types.includes(item.type))
  }

  // 금액 계산
  const getMonthlyAmount = (item: ExpenseItem): number => {
    if (item.data.frequency === 'yearly') {
      return Math.round(item.data.amount / 12)
    }
    return item.data.amount
  }

  // 총 지출 계산 (현재 활성화된 항목만)
  const totalExpense = useMemo(() => {
    return expenseItems
      .filter(item => {
        if (!item.start_year) return true
        if (item.start_year > currentYear) return false
        return true
      })
      .reduce((sum, item) => sum + getMonthlyAmount(item), 0)
  }, [expenseItems, currentYear])

  // 기간 표시 포맷
  const formatPeriod = (item: ExpenseItem): string => {
    const start = item.start_year || currentYear
    const end = item.end_year

    if (item.is_fixed_to_retirement_year) {
      return `${start} ~ ${retirementYear} (은퇴)`
    }
    if (end) {
      return `${start} ~ ${end}`
    }
    return `${start} ~ (계속)`
  }

  // 그룹 총합 계산
  const getGroupTotal = (items: ExpenseItem[]): number => {
    return items.reduce((sum, item) => sum + getMonthlyAmount(item), 0)
  }

  return (
    <div className={styles.container}>
      {/* 요약 카드 */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryItem}>
          <p className={styles.summaryLabel}>월 총 지출</p>
          <p className={styles.summaryValue}>{totalExpense.toLocaleString()}만원</p>
        </div>
        <div className={styles.summaryItem}>
          <p className={styles.summaryLabel}>연 총 지출</p>
          <p className={styles.summaryValue}>{(totalExpense * 12).toLocaleString()}만원</p>
        </div>
      </div>

      {/* 지출 섹션 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>지출 항목</h2>
          <span className={styles.sectionTotal}>월 {totalExpense.toLocaleString()}만원</span>
        </div>

        {CASHFLOW_UI_GROUPS.expense.map((group) => {
          const groupItems = getItemsByTypes(expenseItems, group.types)
          // 현재 활성화된 항목만 필터 (은퇴 후 생활비 제외)
          const activeItems = groupItems.filter(item => {
            if (!item.start_year) return true
            if (item.start_year > currentYear) return false
            return true
          })
          const futureItems = groupItems.filter(item => {
            if (!item.start_year) return false
            return item.start_year > currentYear
          })
          const groupTotal = getGroupTotal(activeItems)

          return (
            <div key={group.group} className={styles.group}>
              <div className={styles.groupHeader}>
                <div>
                  <span className={styles.groupTitle}>{group.label}</span>
                  <span className={styles.groupDescription}>{group.description}</span>
                </div>
                {groupTotal > 0 && (
                  <span className={styles.groupTotal}>{groupTotal.toLocaleString()}만원/월</span>
                )}
              </div>

              <div className={styles.itemList}>
                {activeItems.length > 0 ? (
                  activeItems.map((item, index) => (
                    <div key={index} className={styles.item}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemTitle}>{item.title}</span>
                        <span className={styles.itemPeriod}>{formatPeriod(item)}</span>
                      </div>
                      <span className={styles.itemAmount}>
                        {getMonthlyAmount(item).toLocaleString()}만원
                      </span>
                      <span className={styles.itemFrequency}>
                        /{item.data.frequency === 'yearly' ? '년' : '월'}
                      </span>
                      <button className={styles.editButton} title="수정">
                        <Pencil size={14} />
                      </button>
                    </div>
                  ))
                ) : futureItems.length === 0 ? (
                  <div className={styles.emptyGroup}>(없음)</div>
                ) : null}

                {/* 미래 항목 (예: 자녀 교육비) */}
                {futureItems.map((item, index) => (
                  <div key={`future-${index}`} className={styles.itemFuture}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.itemPeriod}>{formatPeriod(item)}</span>
                    </div>
                    <span className={styles.itemAmount}>
                      {getMonthlyAmount(item).toLocaleString()}만원
                    </span>
                    <span className={styles.itemFrequency}>
                      /{item.data.frequency === 'yearly' ? '년' : '월'}
                    </span>
                    <button className={styles.editButton} title="수정">
                      <Pencil size={14} />
                    </button>
                  </div>
                ))}

                <button className={styles.addButton}>
                  <Plus size={14} />
                  <span>추가</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
