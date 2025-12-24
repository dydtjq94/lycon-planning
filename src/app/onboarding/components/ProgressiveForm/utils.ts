import type { AssetInput } from '@/types'

// 월 기준 합계 계산 (수입/지출용)
export function calculateMonthlyTotal(items: AssetInput[]): number {
  return items.reduce((sum, item) => {
    const amount = item.amount ?? 0
    if (item.frequency === 'yearly') return sum + amount / 12
    if (item.frequency === 'once') return sum // 일회성은 월 합계에 미포함
    return sum + amount // monthly
  }, 0)
}

// 총액 계산 (자산/부채용)
export function calculateTotalValue(items: AssetInput[]): number {
  return items.reduce((sum, item) => {
    const amount = item.amount ?? 0
    if (item.frequency === 'monthly') return sum + amount * 12 // 월납이면 연간으로
    if (item.frequency === 'yearly') return sum + amount
    return sum + amount // once = 총액 그대로
  }, 0)
}

// 나이 계산 함수 (만 나이)
export function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// 한국 나이 계산 함수
export function calculateKoreanAge(birthDate: string): number | null {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  return today.getFullYear() - birth.getFullYear() + 1
}

// 금액 포맷 함수 (원 단위 입력 기준)
// 입력: 원 단위 (100000000 = 1억, 10000 = 1만원)
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
