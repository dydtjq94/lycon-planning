'use client'

import { useMemo } from 'react'
import { Pencil, Plus } from 'lucide-react'
import type { OnboardingData, FinancialItemInput, IncomeData } from '@/types'
import {
  migrateOnboardingToFinancialItems,
  CASHFLOW_UI_GROUPS,
} from '@/lib/services'
import styles from './IncomeTab.module.css'

interface IncomeTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

type IncomeItem = FinancialItemInput & {
  data: IncomeData
}

export function IncomeTab({ data }: IncomeTabProps) {
  const currentYear = new Date().getFullYear()
  const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : currentYear - 35
  const retirementYear = birthYear + data.target_retirement_age

  // OnboardingData를 FinancialItem으로 변환
  const financialItems = useMemo(() => {
    return migrateOnboardingToFinancialItems(data, 'temp')
  }, [data])

  // 소득 항목 필터링
  const incomeItems = useMemo(() => {
    return financialItems.filter(item => item.category === 'income') as IncomeItem[]
  }, [financialItems])

  // 그룹별로 항목 분류
  const getItemsByTypes = (items: IncomeItem[], types: readonly string[]) => {
    return items.filter(item => types.includes(item.type))
  }

  // 금액 계산
  const getMonthlyAmount = (item: IncomeItem): number => {
    if (item.data.frequency === 'yearly') {
      return Math.round(item.data.amount / 12)
    }
    return item.data.amount
  }

  // 총 소득 계산
  const totalIncome = useMemo(() => {
    return incomeItems.reduce((sum, item) => sum + getMonthlyAmount(item), 0)
  }, [incomeItems])

  // 기간 표시 포맷
  const formatPeriod = (item: IncomeItem): string => {
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
  const getGroupTotal = (items: IncomeItem[]): number => {
    return items.reduce((sum, item) => sum + getMonthlyAmount(item), 0)
  }

  return (
    <div className={styles.container}>
      {/* 요약 카드 */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryItem}>
          <p className={styles.summaryLabel}>월 총 소득</p>
          <p className={styles.summaryValue}>{totalIncome.toLocaleString()}만원</p>
        </div>
        <div className={styles.summaryItem}>
          <p className={styles.summaryLabel}>연 총 소득</p>
          <p className={styles.summaryValue}>{(totalIncome * 12).toLocaleString()}만원</p>
        </div>
      </div>

      {/* 소득 섹션 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>소득 항목</h2>
          <span className={styles.sectionTotal}>월 {totalIncome.toLocaleString()}만원</span>
        </div>

        {CASHFLOW_UI_GROUPS.income.map((group) => {
          const groupItems = getItemsByTypes(incomeItems, group.types)
          const groupTotal = getGroupTotal(groupItems)

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
                {groupItems.length > 0 ? (
                  groupItems.map((item, index) => (
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
                ) : (
                  <div className={styles.emptyGroup}>(없음)</div>
                )}
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
