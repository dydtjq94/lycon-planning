/**
 * 시뮬레이션 결과를 Chart.js 데이터 형식으로 변환
 */

import type { YearlySnapshot, SimulationResult } from '@/lib/services/simulationEngine'

// Chart.js 데이터셋 타입
export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor: string
  borderColor?: string
  borderWidth?: number
  stack: 'positive' | 'negative'
}

// 변환된 차트 데이터
export interface TransformedChartData {
  labels: string[]
  datasets: ChartDataset[]
  snapshots: YearlySnapshot[]
}

// 자산 카테고리 색상
export const ASSET_COLORS = {
  financialAssets: '#22c55e',  // 금융자산 (green)
  realEstate: '#3b82f6',       // 부동산 (blue)
  pension: '#eab308',          // 연금 (yellow)
  cash: '#a855f7',             // 현금 (purple)
  debt: '#ef4444',             // 부채 (red)
} as const

// 카테고리 라벨
export const ASSET_LABELS = {
  financialAssets: '금융자산',
  realEstate: '부동산',
  pension: '연금',
  cash: '현금',
  debt: '부채',
} as const

/**
 * 시뮬레이션 종료 연도 계산 (본인/배우자 100세 중 늦은 것)
 */
export function calculateEndYear(
  birthYear: number,
  spouseBirthYear?: number | null
): number {
  const selfAge100Year = birthYear + 100
  if (spouseBirthYear) {
    const spouseAge100Year = spouseBirthYear + 100
    return Math.max(selfAge100Year, spouseAge100Year)
  }
  return selfAge100Year
}

/**
 * 시뮬레이션 결과를 Chart.js 데이터로 변환
 */
export function transformSimulationToChartData(
  result: SimulationResult,
  options?: {
    showDebt?: boolean
    endYear?: number
  }
): TransformedChartData {
  const { snapshots } = result
  const showDebt = options?.showDebt ?? true
  const endYear = options?.endYear

  // 종료 연도까지만 필터링
  const filteredSnapshots = endYear
    ? snapshots.filter(s => s.year <= endYear)
    : snapshots

  // 라벨 생성 (연도)
  const labels = filteredSnapshots.map(s => String(s.year))

  // 데이터셋 생성
  const datasets: ChartDataset[] = [
    {
      label: ASSET_LABELS.financialAssets,
      data: filteredSnapshots.map(s => s.financialAssets),
      backgroundColor: ASSET_COLORS.financialAssets,
      stack: 'positive',
    },
    {
      label: ASSET_LABELS.realEstate,
      data: filteredSnapshots.map(s => s.realEstateValue),
      backgroundColor: ASSET_COLORS.realEstate,
      stack: 'positive',
    },
    {
      label: ASSET_LABELS.pension,
      data: filteredSnapshots.map(s => s.pensionAssets),
      backgroundColor: ASSET_COLORS.pension,
      stack: 'positive',
    },
  ]

  // 부채 표시 여부
  if (showDebt) {
    datasets.push({
      label: ASSET_LABELS.debt,
      data: filteredSnapshots.map(s => -s.totalDebts), // 음수로 표시
      backgroundColor: ASSET_COLORS.debt,
      stack: 'negative',
    })
  }

  return {
    labels,
    datasets,
    snapshots: filteredSnapshots,
  }
}

/**
 * 금액을 억원 단위로 포맷팅 (차트 Y축용)
 */
export function formatChartValue(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 10000) {
    const uk = value / 10000
    return `${uk.toFixed(1).replace(/\.0$/, '')}억`
  }
  if (absValue >= 1000) {
    return `${Math.round(value / 1000)}천만`
  }
  return `${value}만`
}

/**
 * 툴팁용 금액 포맷팅
 */
export function formatTooltipValue(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 10000) {
    const uk = Math.floor(absValue / 10000)
    const remainder = Math.round(absValue % 10000)
    if (remainder > 0) {
      return `${value < 0 ? '-' : ''}${uk}억 ${remainder.toLocaleString()}만원`
    }
    return `${value < 0 ? '-' : ''}${uk}억원`
  }
  return `${value.toLocaleString()}만원`
}

/**
 * 연도별 상세 데이터 추출
 */
export interface YearDetail {
  year: number
  age: number
  // 자산
  financialAssets: number
  realEstate: number
  pension: number
  totalAssets: number
  // 부채
  totalDebts: number
  // 순자산
  netWorth: number
  // 현금흐름
  totalIncome: number
  totalExpense: number
  netCashFlow: number
  // breakdown
  incomeBreakdown: { title: string; amount: number }[]
  expenseBreakdown: { title: string; amount: number }[]
  assetBreakdown: { title: string; amount: number }[]
  debtBreakdown: { title: string; amount: number }[]
  // 전년 대비
  netWorthChange?: number
  netWorthChangePercent?: number
}

export function getYearDetail(
  snapshots: YearlySnapshot[],
  year: number
): YearDetail | null {
  const index = snapshots.findIndex(s => s.year === year)
  if (index === -1) return null

  const snapshot = snapshots[index]
  const prevSnapshot = index > 0 ? snapshots[index - 1] : null

  return {
    year: snapshot.year,
    age: snapshot.age,
    // 자산
    financialAssets: snapshot.financialAssets,
    realEstate: snapshot.realEstateValue,
    pension: snapshot.pensionAssets,
    totalAssets: snapshot.totalAssets,
    // 부채
    totalDebts: snapshot.totalDebts,
    // 순자산
    netWorth: snapshot.netWorth,
    // 현금흐름
    totalIncome: snapshot.totalIncome,
    totalExpense: snapshot.totalExpense,
    netCashFlow: snapshot.netCashFlow,
    // breakdown
    incomeBreakdown: snapshot.incomeBreakdown,
    expenseBreakdown: snapshot.expenseBreakdown,
    assetBreakdown: snapshot.assetBreakdown,
    debtBreakdown: snapshot.debtBreakdown,
    // 전년 대비
    netWorthChange: prevSnapshot ? snapshot.netWorth - prevSnapshot.netWorth : undefined,
    netWorthChangePercent: prevSnapshot && prevSnapshot.netWorth !== 0
      ? ((snapshot.netWorth - prevSnapshot.netWorth) / Math.abs(prevSnapshot.netWorth)) * 100
      : undefined,
  }
}
