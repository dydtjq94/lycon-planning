/**
 * 온보딩 데이터 → 대시보드 데이터 변환 서비스
 *
 * 온보딩에서 간단하게 받은 데이터를 대시보드에서 사용하는 상세 형식으로 변환합니다.
 * - 시작년월, 종료조건, 성장률 등은 사용자 정보를 기반으로 자동 계산
 * - 이미 상세 데이터가 있으면 변환하지 않음 (대시보드에서 수정한 경우)
 */

import type {
  OnboardingData,
  DashboardIncomeItem,
  DashboardExpenseItem,
  SavingsAccount,
  InvestmentAccount,
  DebtInput,
} from '@/types'

// 기본 성장률 설정
const DEFAULT_RATES = {
  income: 3.3,           // 소득 증가율
  inflation: 2.5,        // 물가 상승률 (지출에 적용)
  investment: 5.0,       // 투자 수익률
  savings: 2.5,          // 저축 이자율
  realEstate: 2.4,       // 부동산 상승률
}

// UUID 생성
function generateId(): string {
  return crypto.randomUUID()
}

// 현재 연도/월 가져오기
function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

// 생년월일에서 현재 나이 계산
function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// 배우자 은퇴 연도 계산
function getSpouseRetirementYear(data: OnboardingData): number | null {
  if (!data.spouse?.birth_date || !data.spouse?.retirement_age) return null
  const spouseBirthYear = parseInt(data.spouse.birth_date.split('-')[0])
  return spouseBirthYear + data.spouse.retirement_age
}

// ============================================
// 소득 항목 변환
// ============================================

export function convertToIncomeItems(data: OnboardingData): DashboardIncomeItem[] {
  // 이미 incomeItems가 있으면 그대로 반환 (대시보드에서 수정한 경우)
  if (data.incomeItems && data.incomeItems.length > 0) {
    return data.incomeItems
  }

  const items: DashboardIncomeItem[] = []
  const { year: currentYear, month: currentMonth } = getCurrentYearMonth()
  const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : currentYear - 35
  const retirementYear = birthYear + data.target_retirement_age

  // 본인 근로소득
  if (data.laborIncome !== null && data.laborIncome > 0) {
    items.push({
      id: generateId(),
      type: 'labor',
      label: '본인 근로소득',
      owner: 'self',
      amount: data.laborIncomeFrequency === 'yearly'
        ? Math.round(data.laborIncome / 12)
        : data.laborIncome,
      frequency: 'monthly',
      startYear: currentYear,
      startMonth: currentMonth,
      endType: 'self-retirement',
      endYear: null,
      endMonth: null,
      growthRate: DEFAULT_RATES.income,
      rateCategory: 'income',
    })
  }

  // 배우자 근로소득
  if (data.spouseLaborIncome !== null && data.spouseLaborIncome > 0) {
    items.push({
      id: generateId(),
      type: 'labor',
      label: '배우자 근로소득',
      owner: 'spouse',
      amount: data.spouseLaborIncomeFrequency === 'yearly'
        ? Math.round(data.spouseLaborIncome / 12)
        : data.spouseLaborIncome,
      frequency: 'monthly',
      startYear: currentYear,
      startMonth: currentMonth,
      endType: 'spouse-retirement',
      endYear: null,
      endMonth: null,
      growthRate: DEFAULT_RATES.income,
      rateCategory: 'income',
    })
  }

  // 본인 사업소득
  if (data.businessIncome !== null && data.businessIncome > 0) {
    items.push({
      id: generateId(),
      type: 'business',
      label: '본인 사업소득',
      owner: 'self',
      amount: data.businessIncomeFrequency === 'yearly'
        ? Math.round(data.businessIncome / 12)
        : data.businessIncome,
      frequency: 'monthly',
      startYear: currentYear,
      startMonth: currentMonth,
      endType: 'self-retirement',
      endYear: null,
      endMonth: null,
      growthRate: DEFAULT_RATES.income,
      rateCategory: 'income',
    })
  }

  // 배우자 사업소득
  if (data.spouseBusinessIncome !== null && data.spouseBusinessIncome > 0) {
    items.push({
      id: generateId(),
      type: 'business',
      label: '배우자 사업소득',
      owner: 'spouse',
      amount: data.spouseBusinessIncomeFrequency === 'yearly'
        ? Math.round(data.spouseBusinessIncome / 12)
        : data.spouseBusinessIncome,
      frequency: 'monthly',
      startYear: currentYear,
      startMonth: currentMonth,
      endType: 'spouse-retirement',
      endYear: null,
      endMonth: null,
      growthRate: DEFAULT_RATES.income,
      rateCategory: 'income',
    })
  }

  // 부동산 임대소득 (realEstateProperties에서)
  if (data.realEstateProperties && data.realEstateProperties.length > 0) {
    data.realEstateProperties.forEach((property) => {
      if (property.hasRentalIncome && property.monthlyRent && property.monthlyRent > 0) {
        items.push({
          id: generateId(),
          type: 'rental',
          label: `${property.name} 임대수익`,
          owner: 'self',
          amount: property.monthlyRent,
          frequency: 'monthly',
          startYear: currentYear,
          startMonth: currentMonth,
          endType: 'custom',
          endYear: currentYear + 30, // 기본 30년
          endMonth: 12,
          growthRate: DEFAULT_RATES.realEstate,
          rateCategory: 'realEstate',
          sourceType: 'realEstate',
          sourceId: property.id,
        })
      }
    })
  }

  return items
}

// ============================================
// 지출 항목 변환
// ============================================

export function convertToExpenseItems(data: OnboardingData): DashboardExpenseItem[] {
  // 이미 expenseItems가 있으면 그대로 반환
  if (data.expenseItems && data.expenseItems.length > 0) {
    return data.expenseItems
  }

  const items: DashboardExpenseItem[] = []
  const { year: currentYear, month: currentMonth } = getCurrentYearMonth()

  // 생활비
  if (data.livingExpenses !== null && data.livingExpenses > 0) {
    items.push({
      id: generateId(),
      type: 'fixed',
      label: '생활비',
      amount: data.livingExpensesFrequency === 'yearly'
        ? Math.round(data.livingExpenses / 12)
        : data.livingExpenses,
      frequency: 'monthly',
      startYear: currentYear,
      startMonth: currentMonth,
      endType: 'custom',
      endYear: currentYear + 50, // 기본 50년 (100세까지)
      endMonth: 12,
      growthRate: DEFAULT_RATES.inflation,
      rateCategory: 'inflation',
    })
  }

  // 월세 (거주용)
  if (data.housingType === '월세' && data.housingRent !== null && data.housingRent > 0) {
    items.push({
      id: generateId(),
      type: 'housing',
      label: '월세',
      amount: data.housingRent,
      frequency: 'monthly',
      startYear: currentYear,
      startMonth: currentMonth,
      endType: 'custom',
      endYear: currentYear + 10, // 기본 10년 (추후 수정 가능)
      endMonth: 12,
      growthRate: DEFAULT_RATES.inflation,
      rateCategory: 'inflation',
    })
  }

  // 관리비
  if (data.housingType && data.housingType !== '해당없음' &&
      data.housingMaintenance !== null && data.housingMaintenance > 0) {
    items.push({
      id: generateId(),
      type: 'housing',
      label: '관리비',
      amount: data.housingMaintenance,
      frequency: 'monthly',
      startYear: currentYear,
      startMonth: currentMonth,
      endType: 'custom',
      endYear: currentYear + 50,
      endMonth: 12,
      growthRate: DEFAULT_RATES.inflation,
      rateCategory: 'inflation',
    })
  }

  // 주택담보대출 이자 (원리금균등 or 원금균등 → 이자 포함)
  // 대출 상환액은 DebtTab에서 계산하므로 여기서는 생략
  // 필요시 sourceType: 'debt'로 연동

  return items
}

// ============================================
// 저축 계좌 변환
// ============================================

export function convertToSavingsAccounts(data: OnboardingData): SavingsAccount[] {
  // savingsAccounts 배열 반환 (없으면 빈 배열)
  return data.savingsAccounts || []
}

// ============================================
// 투자 계좌 변환
// ============================================

export function convertToInvestmentAccounts(data: OnboardingData): InvestmentAccount[] {
  // investmentAccounts 배열 반환 (없으면 빈 배열)
  return data.investmentAccounts || []
}

// ============================================
// 부채 변환 (이미 배열이지만 자동 생성 항목 추가)
// ============================================

export function convertToDebts(data: OnboardingData): DebtInput[] {
  const debts: DebtInput[] = [...(data.debts || [])]

  // 주택담보대출 (거주용 부동산에서)
  if (data.housingHasLoan && data.housingLoan !== null && data.housingLoan > 0) {
    // 이미 housing 소스의 부채가 있는지 확인
    const existingHousingDebt = debts.find(d => d.sourceType === 'housing')
    if (!existingHousingDebt) {
      debts.push({
        id: generateId(),
        name: '주택담보대출',
        amount: data.housingLoan,
        rate: data.housingLoanRate || 4.0,
        maturity: data.housingLoanMaturity || null,
        repaymentType: data.housingLoanType || '원리금균등상환',
        sourceType: 'housing',
      })
    }
  }

  // 부동산 대출 (추가 부동산에서)
  if (data.realEstateProperties && data.realEstateProperties.length > 0) {
    data.realEstateProperties.forEach((property) => {
      if (property.hasLoan && property.loanAmount && property.loanAmount > 0) {
        const existingDebt = debts.find(d => d.sourceType === 'realEstate' && d.sourceId === property.id)
        if (!existingDebt) {
          debts.push({
            id: generateId(),
            name: `${property.name} 대출`,
            amount: property.loanAmount,
            rate: property.loanRate || 4.0,
            maturity: property.loanMaturity || null,
            repaymentType: property.loanRepaymentType || '원리금균등상환',
            sourceType: 'realEstate',
            sourceId: property.id,
          })
        }
      }
    })
  }

  // 실물자산 대출 (자동차 등)
  if (data.physicalAssets && data.physicalAssets.length > 0) {
    data.physicalAssets.forEach((asset) => {
      if (asset.financingType === 'loan' && asset.loanAmount && asset.loanAmount > 0) {
        const existingDebt = debts.find(d => d.sourceType === 'physicalAsset' && d.sourceId === asset.id)
        if (!existingDebt) {
          debts.push({
            id: generateId(),
            name: `${asset.name} 대출`,
            amount: asset.loanAmount,
            rate: asset.loanRate || 5.0,
            maturity: asset.loanMaturity || null,
            repaymentType: asset.loanRepaymentType || '원리금균등상환',
            sourceType: 'physicalAsset',
            sourceId: asset.id,
          })
        }
      }
    })
  }

  return debts
}

// ============================================
// 전체 변환 함수
// ============================================

export interface ConvertedData {
  incomeItems: DashboardIncomeItem[]
  expenseItems: DashboardExpenseItem[]
  savingsAccounts: SavingsAccount[]
  investmentAccounts: InvestmentAccount[]
  debts: DebtInput[]
}

/**
 * 온보딩 데이터를 대시보드 형식으로 변환
 * - 이미 상세 데이터가 있으면 그대로 유지
 * - 간편 입력만 있으면 상세 형식으로 변환
 */
export function convertOnboardingToDashboard(data: OnboardingData): ConvertedData {
  return {
    incomeItems: convertToIncomeItems(data),
    expenseItems: convertToExpenseItems(data),
    savingsAccounts: convertToSavingsAccounts(data),
    investmentAccounts: convertToInvestmentAccounts(data),
    debts: convertToDebts(data),
  }
}

/**
 * 온보딩 완료 시 호출하여 데이터를 변환하고 병합
 * - 기존 OnboardingData에 변환된 상세 데이터를 추가
 */
export function finalizeOnboardingData(data: OnboardingData): OnboardingData {
  const converted = convertOnboardingToDashboard(data)

  return {
    ...data,
    incomeItems: converted.incomeItems,
    expenseItems: converted.expenseItems,
    savingsAccounts: converted.savingsAccounts,
    investmentAccounts: converted.investmentAccounts,
    debts: converted.debts,
  }
}

/**
 * 간편 입력 필드가 있는지 확인 (변환 필요 여부)
 */
export function hasSimplifiedData(data: OnboardingData): boolean {
  return (
    (data.laborIncome !== null && data.laborIncome > 0) ||
    (data.spouseLaborIncome !== null && data.spouseLaborIncome > 0) ||
    (data.businessIncome !== null && data.businessIncome > 0) ||
    (data.spouseBusinessIncome !== null && data.spouseBusinessIncome > 0) ||
    (data.livingExpenses !== null && data.livingExpenses > 0) ||
    (data.savingsAccounts && data.savingsAccounts.length > 0) ||
    (data.investmentAccounts && data.investmentAccounts.length > 0)
  )
}

/**
 * 상세 데이터가 이미 있는지 확인
 */
export function hasDetailedData(data: OnboardingData): boolean {
  return (
    (data.incomeItems && data.incomeItems.length > 0) ||
    (data.expenseItems && data.expenseItems.length > 0) ||
    (data.savingsAccounts && data.savingsAccounts.length > 0) ||
    (data.investmentAccounts && data.investmentAccounts.length > 0)
  )
}
