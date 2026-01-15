/**
 * 월별 계산 유틸리티
 * - 시뮬레이션은 연 단위로 표시하지만, 내부 계산은 월 단위로 정확하게 수행
 * - 시작/종료 월을 정확히 반영하여 일할 계산
 */

/**
 * 특정 연도에서 항목이 활성화된 개월 수 계산
 *
 * @example
 * // 2025년 6월 시작, 2030년 12월 종료
 * getActiveMonthsInYear(2025, 6, 2030, 12, 2025) // 7 (6월~12월)
 * getActiveMonthsInYear(2025, 6, 2030, 12, 2026) // 12 (1월~12월)
 * getActiveMonthsInYear(2025, 6, 2030, 12, 2030) // 12 (1월~12월)
 * getActiveMonthsInYear(2025, 6, 2030, 6, 2030)  // 6 (1월~6월)
 */
export function getActiveMonthsInYear(
  startYear: number,
  startMonth: number,  // 1-12
  endYear: number | null | undefined,
  endMonth: number | null | undefined,
  targetYear: number
): number {
  const effectiveEndYear = endYear ?? 9999
  const effectiveEndMonth = endMonth ?? 12

  // 대상 연도가 범위 밖이면 0
  if (targetYear < startYear || targetYear > effectiveEndYear) return 0

  // 시작 월 (대상 연도가 시작 연도면 시작 월, 아니면 1월)
  const effectiveStartMonth = targetYear === startYear ? startMonth : 1

  // 종료 월 (대상 연도가 종료 연도면 종료 월, 아니면 12월)
  const activeEndMonth = targetYear === effectiveEndYear ? effectiveEndMonth : 12

  return Math.max(0, activeEndMonth - effectiveStartMonth + 1)
}

/**
 * 연간 상승률 → 월간 상승률 변환
 * 연 5% (0.05) → 월 약 0.407% (0.00407)
 */
export function annualToMonthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1
}

/**
 * 시작 시점부터 특정 연도/월까지의 총 개월 수 계산
 */
export function getMonthsElapsed(
  startYear: number,
  startMonth: number,
  targetYear: number,
  targetMonth: number
): number {
  return (targetYear - startYear) * 12 + (targetMonth - startMonth)
}

/**
 * 특정 연도의 연간 금액 계산 (월별 상승률 적용)
 * - 해당 연도에서 활성화된 개월만 계산
 * - 각 월마다 시작 시점부터의 복리 상승률 적용
 *
 * @param monthlyBaseAmount 월 기준 금액 (만원)
 * @param annualGrowthRate 연간 상승률 (0.03 = 3%)
 * @param startYear 항목 시작 연도
 * @param startMonth 항목 시작 월 (1-12)
 * @param endYear 항목 종료 연도 (null이면 무한)
 * @param endMonth 항목 종료 월 (1-12)
 * @param targetYear 계산 대상 연도
 */
export function calculateYearlyAmountWithProrating(
  monthlyBaseAmount: number,
  annualGrowthRate: number,
  startYear: number,
  startMonth: number,
  endYear: number | null | undefined,
  endMonth: number | null | undefined,
  targetYear: number
): number {
  const activeMonths = getActiveMonthsInYear(
    startYear, startMonth,
    endYear, endMonth,
    targetYear
  )

  if (activeMonths === 0) return 0

  const monthlyRate = annualToMonthlyRate(annualGrowthRate)

  // 해당 연도의 첫 활성 월
  const firstActiveMonth = targetYear === startYear ? startMonth : 1

  let total = 0

  for (let i = 0; i < activeMonths; i++) {
    const currentMonth = firstActiveMonth + i
    // 시작 시점부터 현재 월까지의 경과 개월 수
    const monthsFromStart = getMonthsElapsed(startYear, startMonth, targetYear, currentMonth)
    // 월별 상승률 적용
    const monthAmount = monthlyBaseAmount * Math.pow(1 + monthlyRate, monthsFromStart)
    total += monthAmount
  }

  return total
}

/**
 * 특정 연도의 이자 계산 (월별 정확 계산)
 * - 대출 시작월부터 해당 연도 활성 개월만 계산
 * - 원금 감소에 따른 이자 감소 반영 (상환 방식별)
 *
 * @param principal 원금 (만원)
 * @param annualRate 연 이자율 (5 = 5%)
 * @param startYear 대출 시작 연도
 * @param startMonth 대출 시작 월 (1-12)
 * @param endYear 대출 만기 연도
 * @param endMonth 대출 만기 월 (1-12)
 * @param targetYear 계산 대상 연도
 * @param repaymentType 상환 방식
 */
export function calculateYearlyInterestWithProrating(
  principal: number,
  annualRate: number,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  targetYear: number,
  repaymentType: '만기일시상환' | '원리금균등상환' | '원금균등상환' = '원리금균등상환'
): { interest: number; principalPayment: number } {
  const activeMonths = getActiveMonthsInYear(
    startYear, startMonth,
    endYear, endMonth,
    targetYear
  )

  if (activeMonths === 0) return { interest: 0, principalPayment: 0 }

  const monthlyRate = annualRate / 100 / 12
  const totalMonths = getMonthsElapsed(startYear, startMonth, endYear, endMonth)

  if (totalMonths <= 0) return { interest: 0, principalPayment: 0 }

  // 해당 연도의 첫 활성 월
  const firstActiveMonth = targetYear === startYear ? startMonth : 1

  let totalInterest = 0
  let totalPrincipal = 0

  for (let i = 0; i < activeMonths; i++) {
    const currentMonth = firstActiveMonth + i
    const monthsFromStart = getMonthsElapsed(startYear, startMonth, targetYear, currentMonth)

    let monthlyInterest = 0
    let monthlyPrincipalPayment = 0

    switch (repaymentType) {
      case '만기일시상환':
        // 매월 이자만 납부
        monthlyInterest = principal * monthlyRate
        monthlyPrincipalPayment = 0
        break

      case '원리금균등상환': {
        // 월 상환액 계산
        const monthlyPayment = monthlyRate === 0
          ? principal / totalMonths
          : principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
            (Math.pow(1 + monthlyRate, totalMonths) - 1)

        // 현재까지 상환된 원금 계산
        let remainingPrincipal = principal
        for (let m = 0; m < monthsFromStart; m++) {
          const interestPart = remainingPrincipal * monthlyRate
          const principalPart = monthlyPayment - interestPart
          remainingPrincipal -= principalPart
        }
        remainingPrincipal = Math.max(0, remainingPrincipal)

        monthlyInterest = remainingPrincipal * monthlyRate
        monthlyPrincipalPayment = monthlyPayment - monthlyInterest
        break
      }

      case '원금균등상환': {
        // 매월 동일한 원금 + 잔액 기준 이자
        const monthlyPrincipal = principal / totalMonths
        const paidPrincipal = monthlyPrincipal * monthsFromStart
        const remainingPrincipal = Math.max(0, principal - paidPrincipal)

        monthlyInterest = remainingPrincipal * monthlyRate
        monthlyPrincipalPayment = monthlyPrincipal
        break
      }
    }

    totalInterest += monthlyInterest
    totalPrincipal += monthlyPrincipalPayment
  }

  return {
    interest: Math.round(totalInterest),
    principalPayment: Math.round(totalPrincipal)
  }
}

/**
 * 특정 연도 말 기준 대출 잔액 계산
 */
export function calculateRemainingBalanceAtYearEnd(
  principal: number,
  annualRate: number,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  targetYear: number,
  repaymentType: '만기일시상환' | '원리금균등상환' | '원금균등상환' = '원리금균등상환'
): number {
  // 대출 시작 전
  if (targetYear < startYear) return principal

  // 대출 만기 후
  if (targetYear > endYear) return 0

  const monthlyRate = annualRate / 100 / 12
  const totalMonths = getMonthsElapsed(startYear, startMonth, endYear, endMonth)

  if (totalMonths <= 0) return 0

  // 해당 연도 말까지의 경과 개월 수
  const monthsElapsed = getMonthsElapsed(startYear, startMonth, targetYear, 12)
  const effectiveMonthsElapsed = Math.min(monthsElapsed, totalMonths)

  switch (repaymentType) {
    case '만기일시상환':
      // 만기까지 원금 유지
      return targetYear >= endYear ? 0 : principal

    case '원리금균등상환': {
      if (monthlyRate === 0) {
        const paidPrincipal = (principal / totalMonths) * effectiveMonthsElapsed
        return Math.max(0, principal - paidPrincipal)
      }
      const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)

      let remaining = principal
      for (let m = 0; m < effectiveMonthsElapsed; m++) {
        const interestPart = remaining * monthlyRate
        const principalPart = monthlyPayment - interestPart
        remaining -= principalPart
      }
      return Math.max(0, Math.round(remaining))
    }

    case '원금균등상환': {
      const monthlyPrincipal = principal / totalMonths
      const paidPrincipal = monthlyPrincipal * effectiveMonthsElapsed
      return Math.max(0, Math.round(principal - paidPrincipal))
    }

    default:
      return principal
  }
}
