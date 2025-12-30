import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 금액 포맷팅 (만원 단위 입력)
export function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    const uk = Math.floor(amount / 10000)
    const man = amount % 10000
    if (man === 0) {
      return `${uk}억`
    }
    return `${uk}억 ${man.toLocaleString()}만`
  }
  return `${amount.toLocaleString()}만원`
}
