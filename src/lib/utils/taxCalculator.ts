/**
 * 세금 계산 유틸리티
 * 모든 금액은 만원 단위
 */

/**
 * 이자소득세 계산
 * @param gain 이자/수익금 (만원)
 * @param isTaxFree 비과세 여부
 * @returns 세금 (만원)
 */
export function calculateInterestIncomeTax(gain: number, isTaxFree: boolean): number {
  if (isTaxFree || gain <= 0) return 0
  // 이자소득세 15.4% (소득세 14% + 지방소득세 1.4%)
  return Math.round(gain * 0.154)
}

/**
 * 장기보유특별공제 공제율 계산
 * @param holdingYears 보유기간 (년)
 * @param isResidence 1세대 1주택 여부
 * @returns 공제율 (0~1)
 */
export function getLongTermHoldingDeduction(holdingYears: number, isResidence: boolean): number {
  if (holdingYears < 3) return 0

  if (isResidence) {
    // 1세대 1주택: 연 8%, 최대 80%
    return Math.min(0.80, holdingYears * 0.08)
  } else {
    // 일반: 연 2%, 최대 30%
    return Math.min(0.30, holdingYears * 0.02)
  }
}

/**
 * 양도소득세 세율표 (2024 기준)
 * 과세표준 구간별 세율 적용
 */
function getCapitalGainsTaxRate(taxableGain: number): { tax: number } {
  // 과세표준 구간별 세율 (만원 단위)
  const brackets = [
    { limit: 1400, rate: 0.06, deduction: 0 },       // ~1,400만원: 6%
    { limit: 5000, rate: 0.15, deduction: 126 },      // ~5,000만원: 15%
    { limit: 8800, rate: 0.24, deduction: 576 },      // ~8,800만원: 24%
    { limit: 15000, rate: 0.35, deduction: 1544 },    // ~1.5억: 35%
    { limit: 30000, rate: 0.38, deduction: 1994 },    // ~3억: 38%
    { limit: 50000, rate: 0.40, deduction: 2594 },    // ~5억: 40%
    { limit: 100000, rate: 0.42, deduction: 3594 },   // ~10억: 42%
    { limit: Infinity, rate: 0.45, deduction: 6594 }, // 10억 초과: 45%
  ]

  for (const bracket of brackets) {
    if (taxableGain <= bracket.limit) {
      const tax = taxableGain * bracket.rate - bracket.deduction
      // 지방소득세 10% 추가
      return { tax: Math.round(tax * 1.1) }
    }
  }

  return { tax: 0 }
}

/**
 * 양도소득세 계산
 * @param salePrice 매도가 (만원)
 * @param purchasePrice 취득가 (만원)
 * @param holdingYears 보유기간 (년)
 * @param isResidence 1세대 1주택 여부
 * @returns 양도소득세 (만원)
 */
export function calculateCapitalGainsTax(
  salePrice: number,
  purchasePrice: number,
  holdingYears: number,
  isResidence: boolean
): number {
  const capitalGain = salePrice - purchasePrice
  if (capitalGain <= 0) return 0

  // 1세대 1주택 비과세: 12억(120,000만원) 이하
  if (isResidence && salePrice <= 120000) {
    return 0
  }

  // 1세대 1주택이지만 12억 초과 시: 초과분만 과세
  let taxableGain = capitalGain
  if (isResidence && salePrice > 120000) {
    // 초과분 비율로 과세
    const exceedRatio = (salePrice - 120000) / salePrice
    taxableGain = capitalGain * exceedRatio
  }

  // 장기보유특별공제
  const deductionRate = getLongTermHoldingDeduction(holdingYears, isResidence)
  taxableGain = taxableGain * (1 - deductionRate)

  // 기본공제 250만원
  taxableGain = Math.max(0, taxableGain - 250)

  if (taxableGain <= 0) return 0

  return getCapitalGainsTaxRate(taxableGain).tax
}

/**
 * 취득세 계산
 * @param price 취득가 (만원)
 * @returns 취득세 (만원)
 */
export function calculateAcquisitionTax(price: number): number {
  if (price <= 0) return 0

  // 6억 이하: 1.1%
  if (price <= 60000) return Math.round(price * 0.011)
  // 6~9억: 2.2%
  if (price <= 90000) return Math.round(price * 0.022)
  // 9억 초과: 3.3%
  return Math.round(price * 0.033)
}

/**
 * ISA 만기 세금 계산
 * @param gain 수익금 (만원)
 * @param isSeomin 서민형 여부 (비과세 한도 400만원 vs 일반 200만원)
 * @returns 세금 (만원)
 */
export function calculateISATax(gain: number, isSeomin: boolean = false): number {
  if (gain <= 0) return 0

  const exemptLimit = isSeomin ? 400 : 200  // 만원 단위
  const taxableGain = Math.max(0, gain - exemptLimit)

  // 초과분 9.9% 분리과세
  return Math.round(taxableGain * 0.099)
}

/**
 * 연금소득세 계산 (연금 수령 시)
 * 나이대별 세율 적용 (70세 미만 5.5%, 70-79세 4.4%, 80세 이상 3.3%)
 * @param amount 연금 수령액 (만원/월)
 * @param age 수령자 나이
 * @returns 월 세금 (만원)
 */
export function calculatePensionIncomeTax(monthlyAmount: number, age: number): number {
  if (monthlyAmount <= 0) return 0

  let rate: number
  if (age >= 80) {
    rate = 0.033
  } else if (age >= 70) {
    rate = 0.044
  } else {
    rate = 0.055
  }

  return Math.round(monthlyAmount * rate)
}
