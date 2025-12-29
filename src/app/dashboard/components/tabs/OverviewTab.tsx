'use client'

import { useMemo } from 'react'
import type { OnboardingData, SimulationSettings } from '@/types'
import styles from './OverviewTab.module.css'

interface OverviewTabProps {
  data: OnboardingData
  settings: SimulationSettings
}

// 나이 계산
function calculateAge(birthDate: string): number {
  if (!birthDate) return 35
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// 금액 포맷팅
function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    const uk = amount / 10000
    return `${uk.toFixed(1).replace(/\.0$/, '')}억`
  }
  return `${amount.toLocaleString()}만원`
}

export function OverviewTab({ data, settings }: OverviewTabProps) {
  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60
  const yearsToRetirement = Math.max(0, retirementAge - currentAge)

  // 소득 계산
  const totalIncome = useMemo(() => {
    const labor = data.laborIncome || 0
    const spouseLabor = data.spouseLaborIncome || 0
    const business = data.businessIncome || 0
    const spouseBusiness = data.spouseBusinessIncome || 0
    return labor + spouseLabor + business + spouseBusiness
  }, [data])

  // 지출 계산
  const totalExpense = useMemo(() => {
    const living = data.livingExpenses || 0
    const rent = data.housingType === '월세' ? (data.housingRent || 0) : 0
    return living + rent
  }, [data])

  // 저축
  const monthlySavings = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? Math.round((monthlySavings / totalIncome) * 100) : 0

  // 자산 계산
  const totalAssets = useMemo(() => {
    let assets = 0
    // 현금성 자산
    assets += data.cashCheckingAccount || 0
    assets += data.cashSavingsAccount || 0
    // 투자 자산
    assets += data.investDomesticStock || 0
    assets += data.investForeignStock || 0
    assets += data.investFund || 0
    assets += data.investOther || 0
    // 부동산 (자가인 경우)
    if (data.housingType === '자가') {
      assets += data.housingValue || 0
    }
    // 연금
    assets += data.retirementPensionBalance || 0
    assets += data.irpBalance || 0
    assets += data.pensionSavingsBalance || 0
    assets += data.isaBalance || 0
    return assets
  }, [data])

  // 부채 계산
  const totalDebts = useMemo(() => {
    let debts = 0
    // 주택 대출
    if (data.housingHasLoan) {
      debts += data.housingLoan || 0
    }
    // 기타 부채
    if (data.debts) {
      debts += data.debts.reduce((sum, d) => sum + (d.amount || 0), 0)
    }
    return debts
  }, [data])

  // 순자산
  const netWorth = totalAssets - totalDebts

  // 은퇴 목표
  const targetFund = data.target_retirement_fund || 100000
  const progress = Math.min(100, Math.round((netWorth / targetFund) * 100))

  return (
    <div className={styles.container}>
      {/* 인사말 */}
      <div className={styles.greeting}>
        <h2 className={styles.greetingTitle}>
          {data.name || '사용자'}님, 안녕하세요
        </h2>
        <p className={styles.greetingSubtitle}>
          은퇴까지 {yearsToRetirement}년 남았습니다
        </p>
      </div>

      {/* 주요 지표 */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>순자산</p>
          <p className={styles.metricValue}>{formatMoney(netWorth)}</p>
          <p className={styles.metricSub}>
            자산 {formatMoney(totalAssets)} - 부채 {formatMoney(totalDebts)}
          </p>
        </div>

        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>월 현금흐름</p>
          <p className={monthlySavings >= 0 ? styles.metricValuePositive : styles.metricValueNegative}>
            {monthlySavings >= 0 ? '+' : ''}{formatMoney(monthlySavings)}
          </p>
          <p className={styles.metricSub}>
            저축률 {savingsRate}%
          </p>
        </div>

        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>은퇴 목표</p>
          <p className={styles.metricValue}>{formatMoney(targetFund)}</p>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={styles.metricSub}>달성률 {progress}%</p>
        </div>
      </div>

      {/* 요약 테이블 */}
      <div className={styles.summarySection}>
        <h3 className={styles.sectionTitle}>재무 현황</h3>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>소득</div>
            <div className={styles.summaryRow}>
              <span>월 소득</span>
              <span className={styles.summaryAmount}>{formatMoney(totalIncome)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>연 소득</span>
              <span className={styles.summaryAmount}>{formatMoney(totalIncome * 12)}</span>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>지출</div>
            <div className={styles.summaryRow}>
              <span>월 지출</span>
              <span className={styles.summaryAmount}>{formatMoney(totalExpense)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>연 지출</span>
              <span className={styles.summaryAmount}>{formatMoney(totalExpense * 12)}</span>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>자산</div>
            <div className={styles.summaryRow}>
              <span>총 자산</span>
              <span className={styles.summaryAmount}>{formatMoney(totalAssets)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>총 부채</span>
              <span className={styles.summaryAmountNegative}>{formatMoney(totalDebts)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
