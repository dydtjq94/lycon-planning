import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { RateCategory, ScenarioMode, GlobalSettings } from "@/types"
import { SCENARIO_PRESETS } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
