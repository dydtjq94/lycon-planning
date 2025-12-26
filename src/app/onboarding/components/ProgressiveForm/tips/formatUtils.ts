/**
 * 금액 포맷 유틸리티
 * 모든 금액은 만원 단위로 입력됩니다.
 * - 10000 = 1억
 * - 100 = 100만원
 */

// 금액 포맷 (만원 단위 입력 → 억/만원 표시)
export function formatMoney(amount: number): string {
  if (amount === 0) return '0만원'

  if (amount >= 10000) {
    const billions = Math.floor(amount / 10000)
    const remainder = amount % 10000
    if (remainder > 0) {
      return `${billions}억 ${Math.round(remainder).toLocaleString()}만원`
    }
    return `${billions}억`
  }

  return `${Math.round(amount).toLocaleString()}만원`
}

// 간단한 금액 포맷 (차트용 - 짧게)
export function formatMoneyShort(amount: number): string {
  if (amount === 0) return '0'

  if (amount >= 10000) {
    const billions = amount / 10000
    if (billions >= 10) {
      return `${Math.round(billions)}억`
    }
    return `${billions.toFixed(1)}억`
  }

  return `${Math.round(amount).toLocaleString()}만원`
}
