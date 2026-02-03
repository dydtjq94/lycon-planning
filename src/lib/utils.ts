import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { RateCategory, ScenarioMode, GlobalSettings } from "@/types"
import { SCENARIO_PRESETS } from "@/types"

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

// 금액 포맷팅 (만원 단위 입력, 억+만원 단위로 상세 표시)
export function formatMoney(amount: number): string {
  const absAmount = Math.abs(amount)
  if (absAmount >= 10000) {
    const uk = Math.floor(absAmount / 10000)
    const man = Math.round(absAmount % 10000)
    if (man === 0) {
      return `${uk.toLocaleString()}억원`
    }
    return `${uk.toLocaleString()}억 ${man.toLocaleString()}만원`
  }
  return `${absAmount.toLocaleString()}만원`
}

// 금액 포맷팅 (원 단위 입력, 억+만+원 단위로 표시)
// 예: 4723332 → "472만 3,332원", 2347245342 → "23억 4,724만 5,342원"
export function formatWon(amount: number): string {
  const absAmount = Math.abs(amount)

  if (absAmount >= 100000000) {
    // 1억 이상: "23억 4,724만 5,342원"
    const uk = Math.floor(absAmount / 100000000)
    const remainder = absAmount % 100000000
    const man = Math.floor(remainder / 10000)
    const won = remainder % 10000

    let result = `${uk.toLocaleString()}억`
    if (man > 0) result += ` ${man.toLocaleString()}만`
    if (won > 0) result += ` ${won.toLocaleString()}`
    return result + "원"
  }

  if (absAmount >= 10000) {
    // 1만 이상: "472만 3,332원"
    const man = Math.floor(absAmount / 10000)
    const won = absAmount % 10000

    if (won === 0) {
      return `${man.toLocaleString()}만원`
    }
    return `${man.toLocaleString()}만 ${won.toLocaleString()}원`
  }

  // 1만 미만: "3,332원"
  return `${absAmount.toLocaleString()}원`
}

// 시나리오 모드에 따른 실제 적용 상승률 계산
export function getEffectiveRate(
  baseRate: number,
  rateCategory: RateCategory,
  scenarioMode: ScenarioMode,
  globalSettings: GlobalSettings
): number {
  // 고정 카테고리는 항상 기본값 사용
  if (rateCategory === 'fixed') {
    return baseRate
  }

  // 개별 모드는 항목별 개별 상승률 사용
  if (scenarioMode === 'individual') {
    return baseRate
  }

  // 커스텀 모드는 globalSettings에 저장된 값 사용
  if (scenarioMode === 'custom') {
    switch (rateCategory) {
      case 'inflation':
        return globalSettings.inflationRate
      case 'income':
        return globalSettings.incomeGrowthRate
      case 'investment':
        return globalSettings.investmentReturnRate
      case 'realEstate':
        return globalSettings.realEstateGrowthRate
      default:
        return baseRate
    }
  }

  // 프리셋 모드(낙관/평균/비관)는 해당 카테고리의 프리셋 값 사용
  const preset = SCENARIO_PRESETS[scenarioMode as 'optimistic' | 'average' | 'pessimistic']

  switch (rateCategory) {
    case 'inflation':
      return preset.inflationRate
    case 'income':
      return preset.incomeGrowthRate
    case 'investment':
      return preset.investmentReturnRate
    case 'realEstate':
      return preset.realEstateGrowthRate
    default:
      return baseRate
  }
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
    default:
      return 'inflation'
  }
}
