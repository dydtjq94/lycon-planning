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

// 금액 포맷 함수 (조/억/만원)
export function formatMoney(amount: number): string {
  const jo = 1000000000000 // 1조
  const eok = 100000000 // 1억
  const man = 10000 // 1만

  if (amount >= jo) {
    const joVal = Math.floor(amount / jo)
    const remainder = amount % jo
    const eokVal = Math.floor(remainder / eok)
    const manVal = Math.floor((remainder % eok) / man)

    let result = `${joVal}조`
    if (eokVal > 0) result += ` ${eokVal.toLocaleString()}억`
    if (manVal > 0) result += ` ${manVal.toLocaleString()}만`
    return result + '원'
  }

  if (amount >= eok) {
    const eokVal = Math.floor(amount / eok)
    const remainder = amount % eok
    const manVal = Math.floor(remainder / man)
    if (manVal > 0) {
      return `${eokVal}억 ${manVal.toLocaleString()}만원`
    }
    return `${eokVal}억원`
  }

  if (amount >= man) {
    const manVal = Math.floor(amount / man)
    return `${manVal.toLocaleString()}만원`
  }

  return `${amount.toLocaleString()}원`
}
