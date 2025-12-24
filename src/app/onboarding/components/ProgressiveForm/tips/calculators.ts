import type { OnboardingData } from '@/types'

// 나이 계산
export function calculateAge(birthDate: string): number {
  if (!birthDate) return 0
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// 은퇴까지 남은 년수
export function yearsToRetirement(birthDate: string, retirementAge: number): number {
  if (!birthDate || !retirementAge) return 0
  const currentAge = calculateAge(birthDate)
  return Math.max(0, retirementAge - currentAge)
}

// 월 총소득 계산 (만원 단위)
export function calculateMonthlyIncome(data: OnboardingData): number {
  let total = 0

  // 근로소득
  if (data.laborIncome) {
    total += data.laborIncomeFrequency === 'yearly'
      ? data.laborIncome / 12
      : data.laborIncome
  }
  if (data.spouseLaborIncome) {
    total += data.spouseLaborIncomeFrequency === 'yearly'
      ? data.spouseLaborIncome / 12
      : data.spouseLaborIncome
  }

  // 사업소득
  if (data.businessIncome) {
    total += data.businessIncomeFrequency === 'yearly'
      ? data.businessIncome / 12
      : data.businessIncome
  }
  if (data.spouseBusinessIncome) {
    total += data.spouseBusinessIncomeFrequency === 'yearly'
      ? data.spouseBusinessIncome / 12
      : data.spouseBusinessIncome
  }

  return total
}

// 월 지출 계산 (만원 단위)
export function calculateMonthlyExpense(data: OnboardingData): number {
  if (!data.livingExpenses) return 0
  return data.livingExpensesFrequency === 'yearly'
    ? data.livingExpenses / 12
    : data.livingExpenses
}

// 저축률 계산 (%)
export function calculateSavingsRate(data: OnboardingData): number {
  const income = calculateMonthlyIncome(data)
  const expense = calculateMonthlyExpense(data)
  if (income === 0) return 0
  return Math.round(((income - expense) / income) * 100)
}

// 총 금융자산 계산 (만원 단위)
export function calculateTotalFinancialAssets(data: OnboardingData): number {
  let total = 0

  // 현금성 자산
  total += data.cashCheckingAccount || 0
  total += data.cashSavingsAccount || 0

  // 투자자산
  total += data.investDomesticStock || 0
  total += data.investForeignStock || 0
  total += data.investFund || 0
  total += data.investOther || 0

  return total
}

// 총 연금 자산 계산 (만원 단위)
export function calculateTotalPensionAssets(data: OnboardingData): number {
  let total = 0
  total += data.retirementPensionBalance || 0
  total += data.irpBalance || 0
  total += data.pensionSavingsBalance || 0
  total += data.isaBalance || 0
  return total
}

// 총 부채 계산 (만원 단위)
export function calculateTotalDebt(data: OnboardingData): number {
  let total = 0

  // 주택 대출
  total += data.housingLoan || 0

  // 기타 부채
  data.debts.forEach(debt => {
    total += debt.amount || 0
  })

  return total
}

// 순자산 계산 (만원 단위)
export function calculateNetWorth(data: OnboardingData): number {
  const assets = calculateTotalFinancialAssets(data)
  const pension = calculateTotalPensionAssets(data)
  const housing = data.housingType === '자가' ? (data.housingValue || 0) : 0
  const debt = calculateTotalDebt(data)

  return assets + pension + housing - debt
}

// 은퇴 자금 달성률 (%)
export function calculateRetirementProgress(data: OnboardingData): number {
  if (!data.target_retirement_fund || data.target_retirement_fund === 0) return 0
  const netWorth = calculateNetWorth(data)
  return Math.min(100, Math.round((netWorth / data.target_retirement_fund) * 100))
}

// 필요 월 저축액 계산 (만원 단위)
// 은퇴까지 목표 자금 달성을 위해 매월 저축해야 할 금액
export function calculateRequiredMonthlySaving(data: OnboardingData): number {
  if (!data.target_retirement_fund || !data.birth_date || !data.target_retirement_age) {
    return 0
  }

  const currentNetWorth = calculateNetWorth(data)
  const targetFund = data.target_retirement_fund
  const yearsLeft = yearsToRetirement(data.birth_date, data.target_retirement_age)

  if (yearsLeft <= 0) return 0

  const monthsLeft = yearsLeft * 12
  const shortfall = targetFund - currentNetWorth

  if (shortfall <= 0) return 0

  // 연 5% 수익률 가정 시 필요 월 저축액 (단순 계산)
  // PMT = FV * r / ((1+r)^n - 1)
  const monthlyRate = 0.05 / 12
  const factor = Math.pow(1 + monthlyRate, monthsLeft) - 1
  const requiredMonthly = (shortfall * monthlyRate) / factor

  return Math.round(requiredMonthly)
}

// LTV 계산 (%)
export function calculateLTV(data: OnboardingData): number {
  if (!data.housingValue || data.housingValue === 0 || !data.housingLoan) {
    return 0
  }
  return Math.round((data.housingLoan / data.housingValue) * 100)
}

// DTI 계산 (%) - 총 부채 / 연소득
export function calculateDTI(data: OnboardingData): number {
  const annualIncome = calculateMonthlyIncome(data) * 12
  if (annualIncome === 0) return 0

  const totalDebt = calculateTotalDebt(data)
  return Math.round((totalDebt / annualIncome) * 100)
}

// 연금 소득대체율 (%) - 예상 연금 소득 / 현재 소득
export function calculatePensionReplacement(data: OnboardingData): number {
  const currentIncome = calculateMonthlyIncome(data)
  if (currentIncome === 0) return 0

  // 월 연금 수령액 합계
  let monthlyPension = 0
  monthlyPension += data.nationalPension || 0
  monthlyPension += data.otherPensionMonthly || 0

  // 퇴직연금은 현재 잔액을 20년으로 나눠서 월 수령액 추정
  if (data.retirementPensionBalance) {
    monthlyPension += data.retirementPensionBalance / (20 * 12)
  }

  // 개인연금도 20년으로 나눠서 추정
  const personalPension = (data.irpBalance || 0) + (data.pensionSavingsBalance || 0)
  if (personalPension > 0) {
    monthlyPension += personalPension / (20 * 12)
  }

  return Math.round((monthlyPension / currentIncome) * 100)
}

// 기대수명 (기본값 90세)
export const LIFE_EXPECTANCY = 90

// 국민연금 수령 시작 나이 (기본값 65세)
export const DEFAULT_PENSION_START_AGE = 65
