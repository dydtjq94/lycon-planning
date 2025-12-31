'use client'

import { useMemo, useEffect } from 'react'
import { CreditCard, Car, Building2, ExternalLink } from 'lucide-react'
import type { OnboardingData, DebtInput, DashboardExpenseItem } from '@/types'
import { formatMoney } from '@/lib/utils'
import styles from './DebtTab.module.css'

interface DebtTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

// 월 상환액 계산 (원리금균등상환 기준)
function calculateMonthlyPayment(principal: number, annualRate: number, maturityDate: string): number {
  if (!principal || !annualRate || !maturityDate) return 0

  const monthlyRate = annualRate / 100 / 12
  const [year, month] = maturityDate.split('-').map(Number)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const remainingMonths = (year - currentYear) * 12 + (month - currentMonth)
  if (remainingMonths <= 0) return 0

  // 원리금균등상환 공식
  if (monthlyRate === 0) return principal / remainingMonths
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) /
    (Math.pow(1 + monthlyRate, remainingMonths) - 1)

  return Math.round(payment)
}

export function DebtTab({ data, onUpdateData }: DebtTabProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const debts = data.debts || []

  // 실물 자산에서 연동된 대출 (sourceType === 'physicalAsset')
  const linkedAssetDebts = useMemo(() => {
    return debts
      .filter(debt => debt.sourceType === 'physicalAsset')
      .map(debt => ({
        ...debt,
        monthlyPayment: calculateMonthlyPayment(
          debt.amount || 0,
          debt.rate || 0,
          debt.maturity || ''
        ),
      }))
  }, [debts])

  // 부동산에서 연동된 대출 (sourceType === 'realEstate')
  const linkedRealEstateDebts = useMemo(() => {
    return debts
      .filter(debt => debt.sourceType === 'realEstate')
      .map(debt => ({
        ...debt,
        monthlyPayment: calculateMonthlyPayment(
          debt.amount || 0,
          debt.rate || 0,
          debt.maturity || ''
        ),
      }))
  }, [debts])

  // 주택담보대출 (온보딩에서 가져오기)
  const housingLoan = useMemo(() => {
    if (!data.housingHasLoan || !data.housingLoan) return null
    return {
      amount: data.housingLoan / 10000, // 원 → 만원
      rate: data.housingLoanRate || 0,
      maturity: data.housingLoanMaturity || '',
      repaymentType: data.housingLoanType || '원리금균등상환',
      monthlyPayment: calculateMonthlyPayment(
        data.housingLoan / 10000,
        data.housingLoanRate || 0,
        data.housingLoanMaturity || ''
      ),
    }
  }, [data.housingHasLoan, data.housingLoan, data.housingLoanRate, data.housingLoanMaturity, data.housingLoanType])

  // 기타 부채 (연동되지 않은 수동 입력 부채)
  const manualDebts = useMemo(() => {
    return debts.filter(debt => !debt.sourceType || debt.sourceType === 'manual')
  }, [debts])

  // 총 부채 계산
  const totalLinkedAssetDebts = linkedAssetDebts.reduce((sum, loan) => sum + (loan.amount || 0), 0)
  const totalLinkedRealEstateDebts = linkedRealEstateDebts.reduce((sum, loan) => sum + (loan.amount || 0), 0)
  const totalHousingLoan = housingLoan?.amount || 0
  const totalManualDebts = manualDebts.reduce((sum, debt) => sum + (debt.amount || 0), 0)

  const totalDebt = totalLinkedAssetDebts + totalLinkedRealEstateDebts + totalHousingLoan + totalManualDebts

  // 월 상환액 계산
  const monthlyLinkedPayments = linkedAssetDebts.reduce((sum, loan) => sum + loan.monthlyPayment, 0)
  const monthlyRealEstatePayments = linkedRealEstateDebts.reduce((sum, loan) => sum + loan.monthlyPayment, 0)
  const monthlyHousingPayment = housingLoan?.monthlyPayment || 0
  const totalMonthlyPayment = monthlyLinkedPayments + monthlyRealEstatePayments + monthlyHousingPayment

  const hasData = totalDebt > 0

  // 부채 → 지출(expenseItems) 연동
  useEffect(() => {
    const existingExpenseItems = data.expenseItems || []

    // 기존 부채 연동 지출 항목 제거
    let updatedExpenseItems = existingExpenseItems.filter(
      item => item.sourceType !== 'debt'
    )

    // 월 상환금이 있는 부채에 대해 지출 항목 생성
    const newExpenseItems: DashboardExpenseItem[] = []

    // 연동된 부채 (실물 자산)
    linkedAssetDebts.forEach(debt => {
      if (debt.monthlyPayment > 0 && debt.maturity) {
        const [endYear, endMonth] = debt.maturity.split('-').map(Number)
        newExpenseItems.push({
          id: `expense-debt-${debt.id}`,
          type: 'interest',
          label: `${debt.name} 상환`,
          amount: debt.monthlyPayment,
          frequency: 'monthly',
          startYear: currentYear,
          startMonth: currentMonth,
          endType: 'custom',
          endYear: endYear,
          endMonth: endMonth,
          growthRate: 0, // 대출 상환금은 고정
          rateCategory: 'fixed',
          sourceType: 'debt',
          sourceId: debt.id,
        })
      }
    })

    // 연동된 부채 (부동산)
    linkedRealEstateDebts.forEach(debt => {
      if (debt.monthlyPayment > 0 && debt.maturity) {
        const [endYear, endMonth] = debt.maturity.split('-').map(Number)
        newExpenseItems.push({
          id: `expense-debt-${debt.id}`,
          type: 'interest',
          label: `${debt.name} 상환`,
          amount: debt.monthlyPayment,
          frequency: 'monthly',
          startYear: currentYear,
          startMonth: currentMonth,
          endType: 'custom',
          endYear: endYear,
          endMonth: endMonth,
          growthRate: 0,
          rateCategory: 'fixed',
          sourceType: 'debt',
          sourceId: debt.id,
        })
      }
    })

    // 주택 대출
    if (housingLoan && housingLoan.monthlyPayment > 0 && housingLoan.maturity) {
      const [endYear, endMonth] = housingLoan.maturity.split('-').map(Number)
      newExpenseItems.push({
        id: 'expense-debt-housing',
        type: 'interest',
        label: '주택담보대출 상환',
        amount: housingLoan.monthlyPayment,
        frequency: 'monthly',
        startYear: currentYear,
        startMonth: currentMonth,
        endType: 'custom',
        endYear: endYear,
        endMonth: endMonth,
        growthRate: 0,
        rateCategory: 'fixed',
        sourceType: 'debt',
        sourceId: 'housing',
      })
    }

    updatedExpenseItems = [...updatedExpenseItems, ...newExpenseItems]

    // 변경사항이 있을 때만 업데이트
    const existingDebtExpenses = existingExpenseItems.filter(item => item.sourceType === 'debt')
    const hasChanges =
      existingDebtExpenses.length !== newExpenseItems.length ||
      JSON.stringify(existingDebtExpenses.map(e => e.id).sort()) !== JSON.stringify(newExpenseItems.map(e => e.id).sort())

    if (hasChanges) {
      onUpdateData({ expenseItems: updatedExpenseItems })
    }
  }, [linkedAssetDebts, linkedRealEstateDebts, housingLoan, currentYear, currentMonth])

  return (
    <div className={styles.container}>
      {/* 왼쪽: 부채 입력 */}
      <div className={styles.inputPanel}>
        {/* 실물 자산 대출 (자동차 등) */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>실물 자산 대출</span>
            {totalLinkedAssetDebts > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(totalLinkedAssetDebts)}</span>
            )}
          </div>

          {linkedAssetDebts.length > 0 ? (
            <div className={styles.debtList}>
              {linkedAssetDebts.map(debt => (
                <div key={debt.id} className={styles.debtItem}>
                  <div className={styles.debtIcon}>
                    <Car size={16} />
                  </div>
                  <div className={styles.debtMain}>
                    <span className={styles.debtName}>{debt.name}</span>
                    <span className={styles.debtAmount}>{formatMoney(debt.amount || 0)}</span>
                    <span className={styles.debtMeta}>
                      {debt.rate}% | {debt.maturity} 만기
                      {debt.monthlyPayment > 0 && ` | 월 ${formatMoney(debt.monthlyPayment)}`}
                    </span>
                  </div>
                  <div className={styles.debtBadge}>
                    <ExternalLink size={12} />
                    <span>실물 자산</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.placeholder}>자동차 대출/할부가 있으면 실물 자산 탭에서 추가하세요</p>
          )}
        </div>

        {/* 주택 관련 대출 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>주택 관련 대출</span>
            {totalHousingLoan > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(totalHousingLoan)}</span>
            )}
          </div>

          {housingLoan ? (
            <div className={styles.debtList}>
              <div className={styles.debtItem}>
                <div className={styles.debtMain}>
                  <span className={styles.debtName}>주택담보대출</span>
                  <span className={styles.debtAmount}>{formatMoney(housingLoan.amount)}</span>
                  <span className={styles.debtMeta}>
                    {housingLoan.rate}% | {housingLoan.maturity} 만기
                    {housingLoan.monthlyPayment > 0 && ` | 월 ${formatMoney(housingLoan.monthlyPayment)}`}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className={styles.placeholder}>주택담보대출, 전세대출 등</p>
          )}
        </div>

        {/* 부동산 투자 대출 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>부동산 투자 대출</span>
            {totalLinkedRealEstateDebts > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(totalLinkedRealEstateDebts)}</span>
            )}
          </div>

          {linkedRealEstateDebts.length > 0 ? (
            <div className={styles.debtList}>
              {linkedRealEstateDebts.map(debt => (
                <div key={debt.id} className={styles.debtItem}>
                  <div className={styles.debtIcon}>
                    <Building2 size={16} />
                  </div>
                  <div className={styles.debtMain}>
                    <span className={styles.debtName}>{debt.name}</span>
                    <span className={styles.debtAmount}>{formatMoney(debt.amount || 0)}</span>
                    <span className={styles.debtMeta}>
                      {debt.rate}% | {debt.maturity} 만기
                      {debt.monthlyPayment > 0 && ` | 월 ${formatMoney(debt.monthlyPayment)}`}
                    </span>
                  </div>
                  <div className={styles.debtBadge}>
                    <ExternalLink size={12} />
                    <span>부동산</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.placeholder}>투자용/임대용 부동산 대출은 부동산 탭에서 추가하세요</p>
          )}
        </div>

        {/* 신용 대출 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>신용 대출</span>
          </div>
          <p className={styles.placeholder}>신용대출, 마이너스통장 등</p>
        </div>

        {/* 기타 부채 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>기타 부채</span>
            {totalManualDebts > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(totalManualDebts)}</span>
            )}
          </div>

          {manualDebts.length > 0 ? (
            <div className={styles.debtList}>
              {manualDebts.map((debt) => (
                <div key={debt.id} className={styles.debtItem}>
                  <div className={styles.debtMain}>
                    <span className={styles.debtName}>{debt.name}</span>
                    <span className={styles.debtAmount}>{formatMoney(debt.amount || 0)}</span>
                    {debt.rate && (
                      <span className={styles.debtMeta}>
                        {debt.rate}%{debt.maturity && ` | ${debt.maturity} 만기`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.placeholder}>카드론, 학자금대출 등</p>
          )}
        </div>

        <p className={styles.infoText}>
          자동차 대출은 실물 자산 탭에서, 부동산 대출은 부동산 탭에서 관리됩니다.
        </p>
      </div>

      {/* 오른쪽: 인사이트 */}
      <div className={styles.insightPanel}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>총 부채</span>
            <span className={styles.summaryValue}>
              {hasData ? formatMoney(totalDebt) : '-'}
            </span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>월 상환액</span>
            <span className={styles.summaryValue}>
              {totalMonthlyPayment > 0 ? formatMoney(totalMonthlyPayment) : '-'}
            </span>
          </div>
          {hasData && (
            <>
              {totalLinkedAssetDebts > 0 && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>실물 자산 대출</span>
                  <span className={styles.summaryValue}>{formatMoney(totalLinkedAssetDebts)}</span>
                </div>
              )}
              {totalHousingLoan > 0 && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>주택 대출</span>
                  <span className={styles.summaryValue}>{formatMoney(totalHousingLoan)}</span>
                </div>
              )}
              {totalLinkedRealEstateDebts > 0 && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>부동산 투자 대출</span>
                  <span className={styles.summaryValue}>{formatMoney(totalLinkedRealEstateDebts)}</span>
                </div>
              )}
              {totalManualDebts > 0 && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>기타 부채</span>
                  <span className={styles.summaryValue}>{formatMoney(totalManualDebts)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {!hasData && (
          <div className={styles.emptyState}>
            <CreditCard size={40} />
            <p>부채 정보를 입력하면 분석 결과가 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
