'use client'

import type { OnboardingData, SimulationSettings } from '@/types'
import styles from './Sections.module.css'

interface ProgressSectionProps {
  data: OnboardingData
  settings: SimulationSettings
}

function calculateAge(birthDate: string): number {
  if (!birthDate) return 0
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

function calculateNetWorth(data: OnboardingData): number {
  const realEstateAsset = data.housingType === '자가' ? (data.housingValue || 0) : 0
  const depositAsset = data.housingType === '전세' ? (data.housingValue || 0) : 0
  const cashAssets = (data.cashCheckingAccount || 0) + (data.cashSavingsAccount || 0)
  const investAssets = (data.investDomesticStock || 0) + (data.investForeignStock || 0) +
    (data.investFund || 0) + (data.investOther || 0)
  const pensionAssets = (data.retirementPensionBalance || 0) +
    (data.irpBalance || 0) + (data.pensionSavingsBalance || 0) + (data.isaBalance || 0)
  const totalAssets = realEstateAsset + depositAsset + cashAssets + investAssets + pensionAssets
  const housingDebt = data.housingHasLoan ? (data.housingLoan || 0) : 0
  const otherDebts = data.debts?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0
  const totalDebts = housingDebt + otherDebts
  return totalAssets - totalDebts
}

export function ProgressSection({ data, settings }: ProgressSectionProps) {
  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60
  const yearsToRetirement = retirementAge - currentAge
  const progressPercent = Math.round((currentAge / retirementAge) * 100)

  const netWorth = calculateNetWorth(data)
  const targetFund = data.target_retirement_fund || 100000

  const fundProgress = Math.min(100, Math.round((netWorth / targetFund) * 100))

  return (
    <div className={styles.section}>
      <div className={styles.progressGrid}>
        <div className={styles.progressCard}>
          <h3 className={styles.cardTitle}>은퇴까지</h3>
          <div className={styles.bigNumber}>{yearsToRetirement}년</div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className={styles.progressLabel}>
            <span>현재 {currentAge}세</span>
            <span>목표 {retirementAge}세</span>
          </div>
        </div>

        <div className={styles.progressCard}>
          <h3 className={styles.cardTitle}>목표 은퇴자금</h3>
          <div className={styles.bigNumber}>{fundProgress}%</div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${fundProgress}%`,
                backgroundColor: fundProgress >= 100 ? '#34c759' : '#007aff'
              }}
            />
          </div>
          <div className={styles.progressLabel}>
            <span>현재 {netWorth.toLocaleString()}만원</span>
            <span>목표 {targetFund.toLocaleString()}만원</span>
          </div>
        </div>

        <div className={styles.progressCard}>
          <h3 className={styles.cardTitle}>월 저축률</h3>
          <div className={styles.bigNumber}>
            {(() => {
              const income = (data.laborIncome || 0) + (data.businessIncome || 0) +
                (data.spouseLaborIncome || 0) + (data.spouseBusinessIncome || 0)
              const expense = data.livingExpenses || 0
              const savings = income - expense
              return income > 0 ? Math.round((savings / income) * 100) : 0
            })()}%
          </div>
          <p className={styles.cardSubtext}>
            월 {(() => {
              const income = (data.laborIncome || 0) + (data.businessIncome || 0) +
                (data.spouseLaborIncome || 0) + (data.spouseBusinessIncome || 0)
              const expense = data.livingExpenses || 0
              return (income - expense).toLocaleString()
            })()}만원 저축
          </p>
        </div>
      </div>

      <div className={styles.milestones}>
        <h3 className={styles.sectionTitle}>Milestones</h3>
        <div className={styles.milestoneList}>
          <div className={`${styles.milestone} ${netWorth >= 10000 ? styles.completed : ''}`}>
            <div className={styles.milestoneCheck}>
              {netWorth >= 10000 ? '완료' : '진행중'}
            </div>
            <div className={styles.milestoneInfo}>
              <span className={styles.milestoneName}>순자산 1억 달성</span>
              <span className={styles.milestoneValue}>
                {netWorth >= 10000 ? '달성!' : `${Math.round((netWorth / 10000) * 100)}%`}
              </span>
            </div>
          </div>
          <div className={`${styles.milestone} ${netWorth >= 50000 ? styles.completed : ''}`}>
            <div className={styles.milestoneCheck}>
              {netWorth >= 50000 ? '완료' : '진행중'}
            </div>
            <div className={styles.milestoneInfo}>
              <span className={styles.milestoneName}>순자산 5억 달성</span>
              <span className={styles.milestoneValue}>
                {netWorth >= 50000 ? '달성!' : `${Math.round((netWorth / 50000) * 100)}%`}
              </span>
            </div>
          </div>
          <div className={`${styles.milestone} ${netWorth >= targetFund ? styles.completed : ''}`}>
            <div className={styles.milestoneCheck}>
              {netWorth >= targetFund ? '완료' : '진행중'}
            </div>
            <div className={styles.milestoneInfo}>
              <span className={styles.milestoneName}>은퇴 자금 목표 달성</span>
              <span className={styles.milestoneValue}>
                {netWorth >= targetFund ? '달성!' : `${fundProgress}%`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
