import type { Scores } from '@/types'

interface ScoringParams {
  monthlyIncome: number
  monthlyExpense: number
  totalAssets: number
  totalDebts: number
  netWorth: number
  targetRetirementFund: number
  currentAge: number
  retirementAge: number
  monthlyPension: number
}

/**
 * 은퇴 준비 스코어 계산
 * 각 카테고리별로 0-100점 스코어 반환
 */
export function calculateScores(params: ScoringParams): Scores {
  const {
    monthlyIncome,
    monthlyExpense,
    totalAssets,
    totalDebts,
    netWorth,
    targetRetirementFund,
    currentAge,
    retirementAge,
    monthlyPension,
  } = params

  // 1. 수입 스코어 (저축률 기반)
  const savingsRate = monthlyIncome > 0
    ? (monthlyIncome - monthlyExpense) / monthlyIncome
    : 0
  const incomeScore = calculateIncomeScore(savingsRate)

  // 2. 지출 스코어 (수입 대비 지출 비율)
  const expenseRatio = monthlyIncome > 0
    ? monthlyExpense / monthlyIncome
    : 1
  const expenseScore = calculateExpenseScore(expenseRatio)

  // 3. 자산 스코어 (목표 대비 진행률)
  const progressRate = targetRetirementFund > 0
    ? netWorth / targetRetirementFund
    : 0
  const assetScore = calculateAssetScore(progressRate, currentAge, retirementAge)

  // 4. 부채 스코어 (자산 대비 부채 비율)
  const debtRatio = totalAssets > 0
    ? totalDebts / totalAssets
    : totalDebts > 0 ? 1 : 0
  const debtScore = calculateDebtScore(debtRatio)

  // 5. 연금 스코어 (예상 지출 대비 연금 비율)
  const pensionCoverage = monthlyExpense > 0
    ? monthlyPension / monthlyExpense
    : 0
  const pensionScore = calculatePensionScore(pensionCoverage)

  // 전체 스코어 (가중 평균)
  const overall = Math.round(
    incomeScore * 0.2 +
    expenseScore * 0.15 +
    assetScore * 0.35 +
    debtScore * 0.15 +
    pensionScore * 0.15
  )

  return {
    overall: Math.min(100, Math.max(0, overall)),
    income: Math.min(100, Math.max(0, incomeScore)),
    expense: Math.min(100, Math.max(0, expenseScore)),
    asset: Math.min(100, Math.max(0, assetScore)),
    debt: Math.min(100, Math.max(0, debtScore)),
    pension: Math.min(100, Math.max(0, pensionScore)),
  }
}

/**
 * 수입 스코어 계산 (저축률 기반)
 * 저축률 30% 이상 = 100점
 */
function calculateIncomeScore(savingsRate: number): number {
  if (savingsRate >= 0.3) return 100
  if (savingsRate >= 0.2) return 80 + (savingsRate - 0.2) * 200
  if (savingsRate >= 0.1) return 60 + (savingsRate - 0.1) * 200
  if (savingsRate >= 0) return savingsRate * 600
  return 0
}

/**
 * 지출 스코어 계산 (수입 대비 지출 비율)
 * 지출이 수입의 70% 이하 = 100점
 */
function calculateExpenseScore(expenseRatio: number): number {
  if (expenseRatio <= 0.7) return 100
  if (expenseRatio <= 0.8) return 80 + (0.8 - expenseRatio) * 200
  if (expenseRatio <= 0.9) return 60 + (0.9 - expenseRatio) * 200
  if (expenseRatio <= 1) return 40 + (1 - expenseRatio) * 200
  return Math.max(0, 40 - (expenseRatio - 1) * 100)
}

/**
 * 자산 스코어 계산 (목표 대비 진행률 + 나이 고려)
 */
function calculateAssetScore(progressRate: number, currentAge: number, retirementAge: number): number {
  const yearsToRetirement = retirementAge - currentAge
  const expectedProgress = yearsToRetirement > 0
    ? 1 - (yearsToRetirement / (retirementAge - 25)) // 25세부터 시작 가정
    : 1

  // 예상 진행률 대비 실제 진행률
  const relativeProgress = expectedProgress > 0
    ? progressRate / expectedProgress
    : progressRate

  if (relativeProgress >= 1) return 100
  if (relativeProgress >= 0.8) return 80 + (relativeProgress - 0.8) * 100
  if (relativeProgress >= 0.5) return 50 + (relativeProgress - 0.5) * 100
  return relativeProgress * 100
}

/**
 * 부채 스코어 계산 (자산 대비 부채 비율)
 * 부채가 자산의 20% 이하 = 100점
 */
function calculateDebtScore(debtRatio: number): number {
  if (debtRatio <= 0.2) return 100
  if (debtRatio <= 0.4) return 80 + (0.4 - debtRatio) * 100
  if (debtRatio <= 0.6) return 60 + (0.6 - debtRatio) * 100
  if (debtRatio <= 0.8) return 40 + (0.8 - debtRatio) * 100
  if (debtRatio <= 1) return 20 + (1 - debtRatio) * 100
  return Math.max(0, 20 - (debtRatio - 1) * 50)
}

/**
 * 연금 스코어 계산 (지출 대비 연금 비율)
 * 연금이 지출의 50% 이상 = 100점
 */
function calculatePensionScore(pensionCoverage: number): number {
  if (pensionCoverage >= 0.5) return 100
  if (pensionCoverage >= 0.4) return 80 + (pensionCoverage - 0.4) * 200
  if (pensionCoverage >= 0.3) return 60 + (pensionCoverage - 0.3) * 200
  if (pensionCoverage >= 0.2) return 40 + (pensionCoverage - 0.2) * 200
  return pensionCoverage * 200
}

/**
 * 스코어 등급 반환
 */
export function getScoreGrade(score: number): { grade: string; color: string; description: string } {
  if (score >= 90) return { grade: 'A+', color: 'text-green-600', description: '매우 우수' }
  if (score >= 80) return { grade: 'A', color: 'text-green-500', description: '우수' }
  if (score >= 70) return { grade: 'B+', color: 'text-blue-600', description: '양호' }
  if (score >= 60) return { grade: 'B', color: 'text-blue-500', description: '보통' }
  if (score >= 50) return { grade: 'C+', color: 'text-yellow-600', description: '주의' }
  if (score >= 40) return { grade: 'C', color: 'text-yellow-500', description: '개선 필요' }
  if (score >= 30) return { grade: 'D', color: 'text-orange-500', description: '위험' }
  return { grade: 'F', color: 'text-red-500', description: '매우 위험' }
}
