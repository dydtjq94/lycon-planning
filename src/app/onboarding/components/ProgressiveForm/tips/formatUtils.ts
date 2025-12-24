/**
 * 금액 포맷 유틸리티
 * 모든 금액은 원 단위로 입력됩니다.
 * - 100000000 = 1억
 * - 10000 = 1만원
 */

// 금액 포맷 (원 단위 입력 → 억/만원 표시)
export function formatMoney(amount: number): string {
  if (amount === 0) return '0원'

  const manwon = amount / 10000  // 만원 단위로 변환

  if (manwon >= 10000) {
    const billions = Math.floor(manwon / 10000)
    const remainder = manwon % 10000
    if (remainder > 0) {
      return `${billions}억 ${Math.round(remainder).toLocaleString()}만원`
    }
    return `${billions}억`
  }

  return `${Math.round(manwon).toLocaleString()}만원`
}

// 간단한 금액 포맷 (차트용 - 짧게)
export function formatMoneyShort(amount: number): string {
  if (amount === 0) return '0'

  const manwon = amount / 10000  // 만원 단위로 변환

  if (manwon >= 10000) {
    const billions = manwon / 10000
    if (billions >= 10) {
      return `${Math.round(billions)}억`
    }
    return `${billions.toFixed(1)}억`
  }

  return `${Math.round(manwon).toLocaleString()}만원`
}
