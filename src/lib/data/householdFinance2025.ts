// 통계청 2025 가계금융복지조사 데이터
// 자동 생성됨 - 직접 수정하지 마세요

export interface AgeGroupStats {
  // 자산 현황 (만원)
  asset: { mean: number; median: number }
  financialAsset: { mean: number; median: number }
  realAsset: { mean: number; median: number }
  debt: { mean: number; median: number }
  netWorth: { mean: number; median: number }

  // 소득/지출 (만원/연)
  income: { mean: number; median: number }
  nonConsumption: { mean: number; median: number }
  disposableIncome: { mean: number; median: number }
  debtPayment: { mean: number; median: number }

  // 재무건전성 (%)
  debtToAssetRatio: number
  financialDebtToSavingsRatio: number
}

export type AgeGroup = '29세이하' | '30대' | '40대' | '50대' | '60대' | '65세이상'

export const householdFinance2025: Record<AgeGroup, AgeGroupStats> = {
  '29세이하': {
    asset: { mean: 15500, median: 7260 },
    financialAsset: { mean: 8843, median: 5245 },
    realAsset: { mean: 6657, median: 2015 },
    debt: { mean: 4703, median: 7000 },
    netWorth: { mean: 10796, median: 5000 },
    income: { mean: 4509, median: 3873 },
    nonConsumption: { mean: 671, median: 498 },
    disposableIncome: { mean: 3838, median: 3297 },
    debtPayment: { mean: 902, median: 570 },
    debtToAssetRatio: 30,
    financialDebtToSavingsRatio: 107,
  },
  '30대': {
    asset: { mean: 35958, median: 24910 },
    financialAsset: { mean: 14104, median: 9330 },
    realAsset: { mean: 21854, median: 15580 },
    debt: { mean: 10899, median: 10732 },
    netWorth: { mean: 25060, median: 15585 },
    income: { mean: 7386, median: 6219 },
    nonConsumption: { mean: 1409, median: 1066 },
    disposableIncome: { mean: 5976, median: 5085 },
    debtPayment: { mean: 1646, median: 984 },
    debtToAssetRatio: 30,
    financialDebtToSavingsRatio: 135,
  },
  '40대': {
    asset: { mean: 62714, median: 39990 },
    financialAsset: { mean: 16401, median: 8460 },
    realAsset: { mean: 46313, median: 31530 },
    debt: { mean: 14325, median: 11000 },
    netWorth: { mean: 48389, median: 28384 },
    income: { mean: 9333, median: 7801 },
    nonConsumption: { mean: 2022, median: 1381 },
    disposableIncome: { mean: 7311, median: 6369 },
    debtPayment: { mean: 2134, median: 1300 },
    debtToAssetRatio: 23,
    financialDebtToSavingsRatio: 97,
  },
  '50대': {
    asset: { mean: 66205, median: 38005 },
    financialAsset: { mean: 16507, median: 8100 },
    realAsset: { mean: 49698, median: 29905 },
    debt: { mean: 11044, median: 7500 },
    netWorth: { mean: 55161, median: 31685 },
    income: { mean: 9416, median: 7805 },
    nonConsumption: { mean: 1940, median: 1225 },
    disposableIncome: { mean: 7476, median: 6416 },
    debtPayment: { mean: 1584, median: 1040 },
    debtToAssetRatio: 17,
    financialDebtToSavingsRatio: 59,
  },
  '60대': {
    asset: { mean: 60095, median: 28060 },
    financialAsset: { mean: 11236, median: 4150 },
    realAsset: { mean: 48859, median: 23910 },
    debt: { mean: 6504, median: 5000 },
    netWorth: { mean: 53591, median: 25000 },
    income: { mean: 5767, median: 3978 },
    nonConsumption: { mean: 877, median: 349 },
    disposableIncome: { mean: 4891, median: 3460 },
    debtPayment: { mean: 747, median: 800 },
    debtToAssetRatio: 11,
    financialDebtToSavingsRatio: 41,
  },
  '65세이상': {
    asset: { mean: 54272, median: 24400 },
    financialAsset: { mean: 9147, median: 3100 },
    realAsset: { mean: 45125, median: 21300 },
    debt: { mean: 4993, median: 4000 },
    netWorth: { mean: 49279, median: 22100 },
    income: { mean: 4728, median: 3198 },
    nonConsumption: { mean: 634, median: 214 },
    disposableIncome: { mean: 4094, median: 2862 },
    debtPayment: { mean: 550, median: 672 },
    debtToAssetRatio: 9,
    financialDebtToSavingsRatio: 38,
  },
}

// 전체 평균 데이터 (참고용)
export const nationalAverage: AgeGroupStats = {
  asset: { mean: 56678, median: 30270 },
  financialAsset: { mean: 13690, median: 6320 },
  realAsset: { mean: 42988, median: 23950 },
  debt: { mean: 9534, median: 8000 },
  netWorth: { mean: 47144, median: 23860 },
  income: { mean: 7427, median: 5800 },
  nonConsumption: { mean: 1396, median: 795 },
  disposableIncome: { mean: 6032, median: 4823 },
  debtPayment: { mean: 1328, median: 1006 },
  debtToAssetRatio: 17,
  financialDebtToSavingsRatio: 68,
}

// 전 연령대 순자산 분위 경계값 (통계청 2025 가계금융복지조사)
// P10 = 하위 10%, P90 = 상위 10%
export const netWorthPercentiles = {
  p10: 1210,
  p20: 5108,
  p30: 10296,
  p40: 16472,
  p50: 23860, // 중앙값
  p60: 33050,
  p70: 46180,
  p80: 69380,
  p90: 110020,
}

// 전 연령대 중앙값(P50) 대비 각 분위의 비율
const percentileRatios = {
  p10: netWorthPercentiles.p10 / netWorthPercentiles.p50, // 0.0507
  p20: netWorthPercentiles.p20 / netWorthPercentiles.p50, // 0.2141
  p30: netWorthPercentiles.p30 / netWorthPercentiles.p50, // 0.4315
  p40: netWorthPercentiles.p40 / netWorthPercentiles.p50, // 0.6903
  p60: netWorthPercentiles.p60 / netWorthPercentiles.p50, // 1.3852
  p70: netWorthPercentiles.p70 / netWorthPercentiles.p50, // 1.9355
  p80: netWorthPercentiles.p80 / netWorthPercentiles.p50, // 2.9077
  p90: netWorthPercentiles.p90 / netWorthPercentiles.p50, // 4.6108
}

// 연령대별 분위 경계값 추정
// 전 연령대 분포 비율을 해당 연령대의 중앙값에 적용
export function estimatePercentiles(median: number): {
  p10: number
  p20: number
  p30: number
  p40: number
  p60: number
  p70: number
  p80: number
  p90: number
} {
  return {
    p10: Math.round(median * percentileRatios.p10),
    p20: Math.round(median * percentileRatios.p20),
    p30: Math.round(median * percentileRatios.p30),
    p40: Math.round(median * percentileRatios.p40),
    p60: Math.round(median * percentileRatios.p60),
    p70: Math.round(median * percentileRatios.p70),
    p80: Math.round(median * percentileRatios.p80),
    p90: Math.round(median * percentileRatios.p90),
  }
}
