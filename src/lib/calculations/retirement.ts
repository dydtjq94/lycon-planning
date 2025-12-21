import type { Asset, SimulationDataPoint } from '@/types'

interface SimulationParams {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  currentAssets: number
  monthlyIncome: number
  monthlyExpense: number
  monthlyPension: number
  annualReturnRate: number
  inflationRate: number
}

/**
 * 은퇴 시뮬레이션 데이터 생성
 */
export function generateRetirementSimulation(params: SimulationParams): SimulationDataPoint[] {
  const {
    currentAge,
    retirementAge,
    lifeExpectancy = 90,
    currentAssets,
    monthlyIncome,
    monthlyExpense,
    monthlyPension,
    annualReturnRate = 0.05,
    inflationRate = 0.02,
  } = params

  const dataPoints: SimulationDataPoint[] = []
  let assets = currentAssets
  const currentYear = new Date().getFullYear()

  for (let age = currentAge; age <= lifeExpectancy; age++) {
    const year = currentYear + (age - currentAge)
    const isRetired = age >= retirementAge

    // 연간 수입 계산
    let annualIncome = 0
    if (!isRetired) {
      annualIncome = monthlyIncome * 12
    }
    // 은퇴 후에는 연금만
    annualIncome += monthlyPension * 12

    // 연간 지출 (인플레이션 적용)
    const yearsFromNow = age - currentAge
    const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow)
    const annualExpense = monthlyExpense * 12 * inflationFactor

    // 자산 변화 계산
    const netCashFlow = annualIncome - annualExpense
    assets = assets * (1 + annualReturnRate) + netCashFlow

    dataPoints.push({
      age,
      year,
      assets: Math.max(0, Math.round(assets)),
      income: Math.round(annualIncome),
      expense: Math.round(annualExpense),
    })

    // 자산이 0 이하가 되면 중단
    if (assets <= 0) {
      break
    }
  }

  return dataPoints
}

/**
 * 자산 데이터에서 월별 합계 계산
 */
export function calculateMonthlyTotals(assets: Asset[]) {
  const totals = {
    income: 0,
    expense: 0,
    realEstate: 0,
    asset: 0,
    debt: 0,
    pension: 0,
  }

  assets.forEach((item) => {
    const monthlyAmount =
      item.frequency === 'yearly'
        ? item.amount / 12
        : item.frequency === 'once'
        ? 0
        : item.amount

    const totalAmount =
      item.frequency === 'once' ? item.amount : monthlyAmount

    switch (item.category) {
      case 'income':
        totals.income += monthlyAmount
        break
      case 'expense':
        totals.expense += monthlyAmount
        break
      case 'real_estate':
        totals.realEstate += item.amount // 부동산은 시가 합계
        break
      case 'asset':
        totals.asset += item.amount // 자산은 총액
        break
      case 'debt':
        totals.debt += item.amount // 부채는 총액
        break
      case 'pension':
        totals.pension += monthlyAmount // 연금은 월 환산
        break
    }
  })

  return totals
}

/**
 * 순자산 계산
 */
export function calculateNetWorth(totals: ReturnType<typeof calculateMonthlyTotals>) {
  return totals.realEstate + totals.asset - totals.debt
}

/**
 * 은퇴 자금 고갈 나이 계산
 */
export function calculateDepletionAge(simulation: SimulationDataPoint[]): number | null {
  const depletionPoint = simulation.find((point, index) => {
    if (index === 0) return false
    return point.assets <= 0
  })

  return depletionPoint?.age ?? null
}
