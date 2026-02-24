import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { RateCategory } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 만 나이 계산 (생일 기준)
 * @param birthDate - 생년월일 (Date 객체, "YYYY-MM-DD" 문자열, 또는 출생년도 숫자)
 * @param referenceDate - 기준일 (기본값: 오늘)
 * @returns 만 나이
 */
export function calculateAge(birthDate: Date | string | number, referenceDate: Date = new Date()): number {
  let birth: Date;

  if (typeof birthDate === 'number') {
    // 출생년도만 주어진 경우 (예: 1994) - 1월 1일생으로 가정
    birth = new Date(birthDate, 0, 1);
  } else if (typeof birthDate === 'string') {
    birth = new Date(birthDate);
  } else {
    birth = birthDate;
  }

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const monthDiff = referenceDate.getMonth() - birth.getMonth();

  // 생일이 아직 안 지났으면 1살 빼기
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

// 금액 포맷팅 (만원 단위 입력, 억+만원 단위로 표시)
// 예: 4729.205 → "4,729만원", 223 → "223만원", 53000 → "5억 3,000만원"
export function formatMoney(amount: number): string {
  const isNegative = amount < 0
  const prefix = isNegative ? "-" : ""
  const manPart = Math.round(Math.abs(amount))

  if (manPart >= 10000) {
    const uk = Math.floor(manPart / 10000)
    const man = manPart % 10000
    if (man === 0) return `${prefix}${uk.toLocaleString()}억원`
    return `${prefix}${uk.toLocaleString()}억 ${man.toLocaleString()}만원`
  }

  return `${prefix}${manPart.toLocaleString()}만원`
}

// 금액 포맷팅 (원 단위 입력, 억+만+원 단위로 표시)
// 예: 4723332 → "472만 3,332원", 2347245342 → "23억 4,724만 5,342원"
export function formatWon(amount: number): string {
  const isNegative = amount < 0
  const absAmount = Math.abs(amount)
  const prefix = isNegative ? "-" : ""

  if (absAmount >= 100000000) {
    // 1억 이상: "23억 4,724만 5,342원"
    const uk = Math.floor(absAmount / 100000000)
    const remainder = absAmount % 100000000
    const man = Math.floor(remainder / 10000)
    const won = remainder % 10000

    let result = `${uk.toLocaleString()}억`
    if (man > 0) result += ` ${man.toLocaleString()}만`
    if (won > 0) result += ` ${won.toLocaleString()}`
    return prefix + result + "원"
  }

  if (absAmount >= 10000) {
    // 1만 이상: "472만 3,332원"
    const man = Math.floor(absAmount / 10000)
    const won = absAmount % 10000

    if (won === 0) {
      return `${prefix}${man.toLocaleString()}만원`
    }
    return `${prefix}${man.toLocaleString()}만 ${won.toLocaleString()}원`
  }

  // 1만 미만: "3,332원"
  return `${prefix}${absAmount.toLocaleString()}원`
}

// ============================================
// 금액 단위 변환 함수 (만원 ↔ 원)
// ============================================

/**
 * 만원 → 원 변환
 * DB 저장 시 사용 (클라이언트에서 만원 입력 → DB에 원 저장)
 */
export function manwonToWon(manwon: number): number {
  return Math.round(manwon * 10000)
}

/**
 * 원 → 만원 변환
 * DB 조회 시 사용 (DB에서 원 조회 → 클라이언트에 만원 표시)
 */
export function wonToManwon(won: number): number {
  return won / 10000
}

// 타입별 기본 상승률 카테고리 반환
export function getDefaultRateCategory(
  itemType: string
): RateCategory {
  switch (itemType) {
    // 소득
    case 'labor':
    case 'business':
    case 'regular':
      return 'income'
    case 'rental':
      return 'realEstate'
    case 'pension':
      return 'fixed' // 연금은 별도 로직으로 처리 (PMT 등)
    case 'onetime':
      return 'fixed'
    // 지출
    case 'fixed':
    case 'variable':
    case 'medical':
      return 'inflation'
    case 'housing':
      return 'realEstate'
    case 'interest':
      return 'fixed'
    // 저축/투자
    case 'savings_deposit':
      return 'fixed'        // 예금/적금 금리는 고정
    case 'investment':
    case 'isa':
      return 'investment'    // 주식/펀드/ISA → 투자수익률
    // 부동산
    case 'real_estate':
      return 'realEstate'
    // 실물 자산
    case 'car':
    case 'precious_metal':
    case 'custom_asset':
      return 'physicalAsset'
    // 연금
    case 'retirement_pension':
    case 'personal_pension':
      return 'investment'
    default:
      return 'inflation'
  }
}
