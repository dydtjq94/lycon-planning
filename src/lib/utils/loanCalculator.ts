/**
 * 대출 계산 유틸리티
 * 모든 대출 관련 계산을 한 곳에서 관리
 */

import type { DebtInput, DebtData, SimulationRates, RateType } from '@/types'

// 상환방식 타입
export type RepaymentType = '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환'

// 월 상환액 계산 결과
export interface LoanPaymentResult {
  monthlyPayment: number    // 월 상환액 (만원)
  totalInterest: number     // 총 이자액 (만원)
}

// 잔액 계산 결과
export interface BalanceResult {
  remainingPrincipal: number  // 남은 원금 (만원)
  monthsRemaining: number     // 남은 개월 수
  elapsedMonths: number       // 경과 개월 수
}

/**
 * 변동/고정 금리에 따른 실효 금리 계산
 * @param debt 부채 정보 (DebtInput 또는 DebtData)
 * @param rates 시뮬레이션 금리 설정 (기준금리 포함)
 * @returns 실효 금리 (%)
 */
export function getEffectiveDebtRate(
  debt: { rate?: number | null; rateType?: RateType; spread?: number },
  rates: Pick<SimulationRates, 'baseRate' | 'debtDefault'>
): number {
  const rateType = debt.rateType || 'fixed'

  if (rateType === 'floating') {
    // 변동금리: 기준금리 + 스프레드
    const spread = debt.spread || 0
    return (rates.baseRate ?? 3.5) + spread
  }

  // 고정금리: 입력된 금리 그대로 사용
  return debt.rate || (rates.debtDefault ?? 3.5)
}

/**
 * 상환방식별 월 상환액 및 총 이자 계산
 * @param principal 원금 (만원)
 * @param annualRate 연이자율 (%)
 * @param maturityDate 만기일 (YYYY-MM)
 * @param repaymentType 상환방식
 * @param gracePeriodMonths 거치기간 (개월) - 거치식상환일 때만 사용
 * @param startDate 대출 시작일 (기본: 현재)
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  maturityDate: string,
  repaymentType: RepaymentType,
  gracePeriodMonths: number = 0,
  startDate?: Date
): LoanPaymentResult {
  if (!principal || !maturityDate) return { monthlyPayment: 0, totalInterest: 0 }

  const monthlyRate = (annualRate || 0) / 100 / 12
  const [year, month] = maturityDate.split('-').map(Number)
  const now = startDate || new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const totalMonths = (year - currentYear) * 12 + (month - currentMonth)
  if (totalMonths <= 0) return { monthlyPayment: 0, totalInterest: 0 }

  switch (repaymentType) {
    case '만기일시상환': {
      // 매월 이자만 납부, 만기에 원금 일시상환
      const monthlyInterest = principal * monthlyRate
      const totalInterest = monthlyInterest * totalMonths
      return { monthlyPayment: Math.round(monthlyInterest), totalInterest: Math.round(totalInterest) }
    }

    case '원리금균등상환': {
      // PMT 공식: P * [r(1+r)^n] / [(1+r)^n - 1]
      if (monthlyRate === 0) {
        return { monthlyPayment: Math.round(principal / totalMonths), totalInterest: 0 }
      }
      const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
      const totalPayment = payment * totalMonths
      return { monthlyPayment: Math.round(payment), totalInterest: Math.round(totalPayment - principal) }
    }

    case '원금균등상환': {
      // 매월 동일한 원금 + 감소하는 이자
      const monthlyPrincipal = principal / totalMonths
      // 평균 상환액 계산 (첫 달과 마지막 달의 평균)
      const avgInterest = (principal * monthlyRate * (totalMonths + 1)) / 2 / totalMonths
      const avgPayment = monthlyPrincipal + avgInterest
      const totalInterest = (principal * monthlyRate * (totalMonths + 1)) / 2
      return { monthlyPayment: Math.round(avgPayment), totalInterest: Math.round(totalInterest) }
    }

    case '거치식상환': {
      // 거치기간 동안 이자만, 이후 원리금균등
      const effectiveGrace = Math.min(gracePeriodMonths, totalMonths - 1)
      const repaymentMonths = totalMonths - effectiveGrace

      if (repaymentMonths <= 0) {
        const monthlyInterest = principal * monthlyRate
        return { monthlyPayment: Math.round(monthlyInterest), totalInterest: Math.round(monthlyInterest * totalMonths) }
      }

      // 거치기간 이자
      const graceInterest = principal * monthlyRate * effectiveGrace

      // 상환기간 원리금균등
      if (monthlyRate === 0) {
        return { monthlyPayment: Math.round(principal / repaymentMonths), totalInterest: Math.round(graceInterest) }
      }
      const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, repaymentMonths)) /
        (Math.pow(1 + monthlyRate, repaymentMonths) - 1)
      const repaymentInterest = payment * repaymentMonths - principal
      return { monthlyPayment: Math.round(payment), totalInterest: Math.round(graceInterest + repaymentInterest) }
    }

    default:
      return { monthlyPayment: 0, totalInterest: 0 }
  }
}

/**
 * 특정 시점의 대출 잔액 계산
 * @param params 대출 정보
 * @param asOfDate 기준 날짜
 */
export function calculateRemainingBalance(
  params: {
    principal: number
    annualRate: number
    maturityDate: string
    repaymentType: RepaymentType
    loanStartDate?: string  // YYYY-MM
    gracePeriodMonths?: number
  },
  asOfDate: Date
): BalanceResult {
  const { principal, annualRate, maturityDate, repaymentType, loanStartDate, gracePeriodMonths = 0 } = params

  if (!principal || !maturityDate) {
    return { remainingPrincipal: 0, monthsRemaining: 0, elapsedMonths: 0 }
  }

  const monthlyRate = (annualRate || 0) / 100 / 12
  const [endYear, endMonth] = maturityDate.split('-').map(Number)

  // 대출 시작일 (기본: 현재)
  let startYear: number
  let startMonth: number
  if (loanStartDate) {
    [startYear, startMonth] = loanStartDate.split('-').map(Number)
  } else {
    const now = new Date()
    startYear = now.getFullYear()
    startMonth = now.getMonth() + 1
  }

  const asOfYear = asOfDate.getFullYear()
  const asOfMonth = asOfDate.getMonth() + 1

  // 총 대출 기간 (개월)
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth)
  // 경과 개월 수
  const elapsedMonths = Math.max(0, (asOfYear - startYear) * 12 + (asOfMonth - startMonth))
  // 남은 개월 수
  const monthsRemaining = Math.max(0, totalMonths - elapsedMonths)

  if (totalMonths <= 0 || elapsedMonths >= totalMonths) {
    return { remainingPrincipal: 0, monthsRemaining: 0, elapsedMonths }
  }

  switch (repaymentType) {
    case '만기일시상환': {
      // 만기까지 원금 그대로
      return { remainingPrincipal: principal, monthsRemaining, elapsedMonths }
    }

    case '원리금균등상환': {
      // PMT 방식: 매월 원금 상환 비율 계산
      if (monthlyRate === 0) {
        const paidPrincipal = (principal / totalMonths) * elapsedMonths
        return { remainingPrincipal: Math.round(principal - paidPrincipal), monthsRemaining, elapsedMonths }
      }

      // 잔액 = P * [(1+r)^n - (1+r)^k] / [(1+r)^n - 1]
      // k = 경과 개월 수
      const factor = Math.pow(1 + monthlyRate, totalMonths)
      const elapsedFactor = Math.pow(1 + monthlyRate, elapsedMonths)
      const remainingPrincipal = principal * (factor - elapsedFactor) / (factor - 1)
      return { remainingPrincipal: Math.round(remainingPrincipal), monthsRemaining, elapsedMonths }
    }

    case '원금균등상환': {
      // 매월 동일 원금 상환
      const monthlyPrincipal = principal / totalMonths
      const paidPrincipal = monthlyPrincipal * elapsedMonths
      return { remainingPrincipal: Math.round(principal - paidPrincipal), monthsRemaining, elapsedMonths }
    }

    case '거치식상환': {
      // 거치기간: 원금 그대로, 이후 원리금균등
      const effectiveGrace = Math.min(gracePeriodMonths, totalMonths - 1)

      if (elapsedMonths <= effectiveGrace) {
        // 아직 거치기간
        return { remainingPrincipal: principal, monthsRemaining, elapsedMonths }
      }

      // 거치기간 후 원리금균등
      const repaymentMonths = totalMonths - effectiveGrace
      const elapsedAfterGrace = elapsedMonths - effectiveGrace

      if (monthlyRate === 0) {
        const paidPrincipal = (principal / repaymentMonths) * elapsedAfterGrace
        return { remainingPrincipal: Math.round(principal - paidPrincipal), monthsRemaining, elapsedMonths }
      }

      const factor = Math.pow(1 + monthlyRate, repaymentMonths)
      const elapsedFactor = Math.pow(1 + monthlyRate, elapsedAfterGrace)
      const remainingPrincipal = principal * (factor - elapsedFactor) / (factor - 1)
      return { remainingPrincipal: Math.round(remainingPrincipal), monthsRemaining, elapsedMonths }
    }

    default:
      return { remainingPrincipal: principal, monthsRemaining, elapsedMonths }
  }
}

/**
 * 연간 원금 상환액 계산
 * @param params 대출 정보
 * @param year 계산 연도
 */
export function calculateYearlyPrincipalPayment(
  params: {
    principal: number
    annualRate: number
    maturityDate: string
    repaymentType: RepaymentType
    loanStartDate?: string
    gracePeriodMonths?: number
  },
  year: number
): number {
  // 해당 연도 시작과 끝 잔액의 차이
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31)

  const startBalance = calculateRemainingBalance(params, startOfYear)
  const endBalance = calculateRemainingBalance(params, endOfYear)

  return Math.max(0, startBalance.remainingPrincipal - endBalance.remainingPrincipal)
}

/**
 * 연간 이자 상환액 계산
 * @param params 대출 정보
 * @param year 계산 연도
 */
export function calculateYearlyInterestPayment(
  params: {
    principal: number
    annualRate: number
    maturityDate: string
    repaymentType: RepaymentType
    loanStartDate?: string
    gracePeriodMonths?: number
  },
  year: number
): number {
  const { annualRate, maturityDate, repaymentType, gracePeriodMonths = 0 } = params

  // 월 상환액 계산
  const paymentResult = calculateMonthlyPayment(
    params.principal,
    annualRate,
    maturityDate,
    repaymentType,
    gracePeriodMonths,
    params.loanStartDate ? new Date(params.loanStartDate + '-01') : undefined
  )

  // 원금 상환액
  const yearlyPrincipal = calculateYearlyPrincipalPayment(params, year)

  // 12개월 * 월 상환액 - 원금 상환액 = 이자 상환액
  // (단, 해당 연도에 상환 중인 개월 수만 계산)
  const [endYear, endMonth] = maturityDate.split('-').map(Number)

  let activeMonths = 12

  // 만기년도인 경우
  if (year === endYear) {
    activeMonths = endMonth
  }

  // 대출 시작년도인 경우
  if (params.loanStartDate) {
    const [startYear, startMonth] = params.loanStartDate.split('-').map(Number)
    if (year === startYear) {
      activeMonths = 12 - startMonth + 1
    }
    if (year < startYear || year > endYear) {
      return 0
    }
  }

  const yearlyPayment = paymentResult.monthlyPayment * activeMonths
  return Math.max(0, yearlyPayment - yearlyPrincipal)
}

/**
 * PMT 함수 (연금 현가 계산)
 * Excel/재무계산기의 PMT 함수와 동일
 */
export function PMT(
  presentValue: number,
  periods: number,
  annualRate: number
): number {
  if (periods <= 0) return 0

  const periodRate = annualRate / 100

  if (periodRate === 0) {
    return presentValue / periods
  }

  return presentValue * (periodRate * Math.pow(1 + periodRate, periods)) /
    (Math.pow(1 + periodRate, periods) - 1)
}

/**
 * 연금 수령액 계산 (연금 현가 기반)
 * @param balance 연금 잔액 (만원)
 * @param receivingYears 수령 기간 (년)
 * @param annualReturnRate 연간 수익률 (%)
 * @returns 연간 수령액 (만원)
 */
export function calculateAnnualPensionWithdrawal(
  balance: number,
  receivingYears: number,
  annualReturnRate: number = 3
): number {
  if (balance <= 0 || receivingYears <= 0) return 0

  return Math.round(PMT(balance, receivingYears, annualReturnRate))
}
