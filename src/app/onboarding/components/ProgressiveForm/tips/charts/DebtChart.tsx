'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import { calculateDTI, calculateTotalDebt, calculateMonthlyIncome } from '../calculators'
import { formatMoney } from '../formatUtils'
import styles from './Charts.module.css'

interface DebtChartProps {
  data: OnboardingData
}

export function DebtChart({ data }: DebtChartProps) {
  const totalDebt = calculateTotalDebt(data)
  const dti = calculateDTI(data)
  const monthlyIncome = calculateMonthlyIncome(data)
  const annualIncome = monthlyIncome * 12

  // 부채 목록 수집
  const debtItems: { name: string; amount: number; rate: number | null }[] = []

  // 주택담보대출
  if (data.housingLoan && data.housingLoan > 0) {
    debtItems.push({
      name: '주택담보대출',
      amount: data.housingLoan,
      rate: data.housingLoanRate,
    })
  }

  // 기타 부채
  data.debts.forEach((debt, index) => {
    if (debt.amount && debt.amount > 0) {
      debtItems.push({
        name: debt.name || `대출 ${index + 1}`,
        amount: debt.amount,
        rate: debt.rate,
      })
    }
  })

  if (totalDebt === 0 || debtItems.length === 0) {
    return (
      <div className={styles.chartPlaceholder}>
        <span>부채 정보를 입력하면</span>
        <span>부채 현황 분석이 표시됩니다</span>
      </div>
    )
  }

  // 금리순 정렬 (고금리 우선)
  const sortedDebts = [...debtItems].sort((a, b) => (b.rate || 0) - (a.rate || 0))

  // DTI 상태
  const getDTIColor = () => {
    if (dti > 200) return '#EF4444'  // 위험
    if (dti > 100) return '#F97316'  // 주의
    return '#10B981'  // 양호
  }

  const getDTIMessage = () => {
    if (dti > 200) return '부채가 연소득의 2배를 초과합니다. 상환 계획이 필요합니다.'
    if (dti > 100) return '부채가 연소득을 초과합니다. 관리가 필요합니다.'
    if (dti > 50) return '적정 수준입니다. 고금리 대출부터 상환을 권장합니다.'
    return '건전한 부채 수준입니다.'
  }

  // 고금리 대출 확인 (5% 이상)
  const highRateDebts = sortedDebts.filter(d => d.rate && d.rate >= 5)

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>부채 현황</span>
        <span className={styles.chartSubtitle}>총 {formatMoney(totalDebt)}</span>
      </div>

      {/* DTI 게이지 */}
      {annualIncome > 0 && (
        <div className={styles.dtiSection}>
          <div className={styles.progressHeader}>
            <span className={styles.chartSubtitle}>DTI (총부채/연소득)</span>
            <span className={styles.progressPercent} style={{ color: getDTIColor() }}>
              {dti}%
            </span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${Math.min(dti / 2, 100)}%`,
                backgroundColor: getDTIColor(),
              }}
            />
          </div>
        </div>
      )}

      {/* 부채 목록 */}
      <div className={styles.debtList}>
        {sortedDebts.slice(0, 3).map((debt, index) => (
          <div key={index} className={styles.debtItem}>
            <div className={styles.debtInfo}>
              <span className={styles.debtName}>{debt.name}</span>
              {debt.rate && debt.rate >= 5 && (
                <span className={styles.highRateBadge}>고금리</span>
              )}
            </div>
            <div className={styles.debtDetails}>
              <span className={styles.debtAmount}>{formatMoney(debt.amount)}</span>
              {debt.rate && (
                <span className={styles.debtRate}>{debt.rate}%</span>
              )}
            </div>
          </div>
        ))}
        {sortedDebts.length > 3 && (
          <div className={styles.debtMore}>
            외 {sortedDebts.length - 3}건
          </div>
        )}
      </div>

      <div className={styles.savingsMessage}>
        {highRateDebts.length > 0
          ? `고금리 대출 ${highRateDebts.length}건 (${formatMoney(highRateDebts.reduce((sum, d) => sum + d.amount, 0))}) 우선 상환을 권장합니다.`
          : getDTIMessage()}
      </div>
    </div>
  )
}
