import type {
  FinancialItemInput,
  FinancialItemType,
  FinancialCategory,
  IncomeData,
  ExpenseData,
  SavingsData,
  PensionData,
  RealEstateData,
} from '@/types'

// 기본 설정값
export const DEFAULT_RATES = {
  // 소득
  incomeGrowth: 3.3,           // 소득 증가율 (%)

  // 지출
  expenseGrowth: 2.5,          // 지출 증가율 / 물가상승률 (%)
  postRetirementRatio: 0.8,    // 은퇴 후 생활비 비율 (80%)

  // 저축/투자
  depositRate: 3.0,            // 예금 이자율 (%)
  investmentReturn: 5.0,       // 투자 수익률 (%)

  // 부동산
  realEstateGrowth: 3.0,       // 부동산 상승률 (%)
  mortgageRate: 4.0,           // 주담대 금리 (%)

  // 연금
  nationalPensionGrowth: 2.0,  // 국민연금 상승률 (%)
  pensionReturn: 5.0,          // 연금 수익률 (%)

  // 국민연금 수령 시작 나이
  nationalPensionStartAge: 65,
}

/**
 * 은퇴 시점의 생활비 계산 (물가상승률 반영)
 * @param currentAmount 현재 생활비 (만원)
 * @param yearsToRetirement 은퇴까지 남은 년수
 * @param inflationRate 물가상승률 (%, 기본 2.5)
 * @returns 은퇴 시점의 생활비 (만원)
 */
export function calculateInflatedAmount(
  currentAmount: number,
  yearsToRetirement: number,
  inflationRate: number = DEFAULT_RATES.expenseGrowth
): number {
  return Math.round(currentAmount * Math.pow(1 + inflationRate / 100, yearsToRetirement))
}

/**
 * 은퇴 후 생활비 계산 (은퇴 시점 생활비의 80%)
 * @param currentLivingExpense 현재 생활비 (만원)
 * @param yearsToRetirement 은퇴까지 남은 년수
 * @param ratio 은퇴 후 비율 (기본 0.8 = 80%)
 */
export function calculatePostRetirementExpense(
  currentLivingExpense: number,
  yearsToRetirement: number,
  ratio: number = DEFAULT_RATES.postRetirementRatio
): number {
  const inflatedAmount = calculateInflatedAmount(currentLivingExpense, yearsToRetirement)
  return Math.round(inflatedAmount * ratio)
}

/**
 * 사용자 프로필 정보
 */
interface UserProfile {
  birthYear: number
  retirementAge: number
  isMarried: boolean
}

/**
 * 기본 재무 항목 템플릿 생성
 * 신규 사용자의 시뮬레이션에 자동으로 추가됨
 */
export function createDefaultFinancialItems(
  simulationId: string,
  profile: UserProfile
): FinancialItemInput[] {
  const currentYear = new Date().getFullYear()
  const { birthYear, retirementAge, isMarried } = profile
  const retirementYear = birthYear + retirementAge
  const pensionStartYear = birthYear + DEFAULT_RATES.nationalPensionStartAge

  const items: FinancialItemInput[] = []
  let sortOrder = 0

  // ============================================
  // 소득 (Income)
  // ============================================

  // 본인 급여
  items.push({
    simulation_id: simulationId,
    category: 'income',
    type: 'labor',
    title: '본인 급여',
    owner: 'self',
    start_year: currentYear,
    start_month: 1,
    end_year: retirementYear,
    end_month: 12,
    is_fixed_to_retirement_year: true,
    data: {
      amount: 0,  // 사용자 입력 필요
      frequency: 'monthly',
      growthRate: DEFAULT_RATES.incomeGrowth,
    } as IncomeData,
    sort_order: sortOrder++,
  })

  // 배우자 급여 (결혼한 경우)
  if (isMarried) {
    items.push({
      simulation_id: simulationId,
      category: 'income',
      type: 'labor',
      title: '배우자 급여',
      owner: 'spouse',
      start_year: currentYear,
      start_month: 1,
      end_year: retirementYear,
      end_month: 12,
      is_fixed_to_retirement_year: false,
      data: {
        amount: 0,
        frequency: 'monthly',
        growthRate: DEFAULT_RATES.incomeGrowth,
      } as IncomeData,
      sort_order: sortOrder++,
    })
  }

  // ============================================
  // 지출 (Expense)
  // ============================================

  // 은퇴 전 생활비
  items.push({
    simulation_id: simulationId,
    category: 'expense',
    type: 'living',
    title: '생활비 (은퇴 전)',
    owner: 'common',
    start_year: currentYear,
    start_month: 1,
    end_year: retirementYear,
    end_month: 12,
    is_fixed_to_retirement_year: true,
    data: {
      amount: 0,
      frequency: 'monthly',
      growthRate: DEFAULT_RATES.expenseGrowth,
    } as ExpenseData,
    sort_order: sortOrder++,
  })

  // 은퇴 후 생활비 (보통 70~80% 수준)
  items.push({
    simulation_id: simulationId,
    category: 'expense',
    type: 'living',
    title: '생활비 (은퇴 후)',
    owner: 'common',
    start_year: retirementYear + 1,
    start_month: 1,
    data: {
      amount: 0,  // 은퇴 전 생활비의 70~80% 권장
      frequency: 'monthly',
      growthRate: DEFAULT_RATES.expenseGrowth,
    } as ExpenseData,
    memo: '은퇴 전 생활비의 70~80% 수준 권장',
    sort_order: sortOrder++,
  })

  // ============================================
  // 부동산 (Real Estate)
  // ============================================

  // 주거용 부동산
  items.push({
    simulation_id: simulationId,
    category: 'real_estate',
    type: 'residence',
    title: '주거용 부동산',
    owner: 'common',
    start_year: currentYear,
    start_month: 1,
    data: {
      currentValue: 0,
      appreciationRate: DEFAULT_RATES.realEstateGrowth,
      housingType: '자가',
      hasLoan: false,
      loanAmount: 0,
      loanRate: DEFAULT_RATES.mortgageRate,
      loanRepaymentType: '원리금균등상환',
    } as RealEstateData,
    sort_order: sortOrder++,
  })

  // ============================================
  // 저축/투자 (Savings)
  // ============================================

  // 예금/적금 (은퇴 전까지 적립)
  items.push({
    simulation_id: simulationId,
    category: 'savings',
    type: 'savings_account',
    title: '예금/적금',
    owner: 'common',
    start_year: currentYear,
    start_month: 1,
    end_year: retirementYear,
    end_month: 12,
    is_fixed_to_retirement_year: true,
    data: {
      currentBalance: 0,
      monthlyContribution: 0,  // 월 적립액 (은퇴 전까지)
      interestRate: DEFAULT_RATES.depositRate,
    } as SavingsData,
    memo: '월 적립은 은퇴 전까지, 잔액은 계속 유지',
    sort_order: sortOrder++,
  })

  // 투자 (주식/펀드) - 은퇴 전까지 적립
  items.push({
    simulation_id: simulationId,
    category: 'savings',
    type: 'stock',
    title: '투자 (주식/펀드)',
    owner: 'common',
    start_year: currentYear,
    start_month: 1,
    end_year: retirementYear,
    end_month: 12,
    is_fixed_to_retirement_year: true,
    data: {
      currentBalance: 0,
      monthlyContribution: 0,  // 월 투자액 (은퇴 전까지)
      interestRate: DEFAULT_RATES.investmentReturn,
    } as SavingsData,
    memo: '월 투자는 은퇴 전까지, 잔액은 계속 운용',
    sort_order: sortOrder++,
  })

  // ============================================
  // 연금 (Pension)
  // ============================================

  // 국민연금 (65세부터 수령)
  items.push({
    simulation_id: simulationId,
    category: 'pension',
    type: 'national',
    title: '국민연금',
    owner: 'self',
    start_year: pensionStartYear,
    start_month: 1,
    data: {
      expectedMonthlyAmount: 0,
      paymentStartAge: DEFAULT_RATES.nationalPensionStartAge,
    } as PensionData,
    memo: `${DEFAULT_RATES.nationalPensionStartAge}세부터 평생 수령`,
    sort_order: sortOrder++,
  })

  // 배우자 국민연금 (결혼한 경우)
  if (isMarried) {
    items.push({
      simulation_id: simulationId,
      category: 'pension',
      type: 'national',
      title: '배우자 국민연금',
      owner: 'spouse',
      start_year: pensionStartYear,
      start_month: 1,
      data: {
        expectedMonthlyAmount: 0,
        paymentStartAge: DEFAULT_RATES.nationalPensionStartAge,
      } as PensionData,
      memo: `${DEFAULT_RATES.nationalPensionStartAge}세부터 평생 수령`,
      sort_order: sortOrder++,
    })
  }

  // 퇴직연금 (현재~은퇴까지 적립, 은퇴 후 수령)
  items.push({
    simulation_id: simulationId,
    category: 'pension',
    type: 'retirement',
    title: '퇴직연금',
    owner: 'self',
    start_year: currentYear,
    start_month: 1,
    end_year: retirementYear,
    end_month: 12,
    is_fixed_to_retirement_year: true,
    data: {
      currentBalance: 0,
      pensionType: 'DC',
      returnRate: DEFAULT_RATES.pensionReturn,
      paymentStartYear: retirementYear,
      paymentStartMonth: 1,  // 1월부터 수령 시작
      paymentYears: 10,  // 10년간 연금 수령 (기본값)
    } as PensionData,
    memo: '은퇴 시까지 적립, 이후 10년간 연금 수령',
    sort_order: sortOrder++,
  })

  // 연금저축 (현재~은퇴까지 납입, 은퇴 후 수령)
  items.push({
    simulation_id: simulationId,
    category: 'pension',
    type: 'personal',
    title: '연금저축',
    owner: 'self',
    start_year: currentYear,
    start_month: 1,
    end_year: retirementYear,
    end_month: 12,
    is_fixed_to_retirement_year: true,
    data: {
      currentBalance: 0,
      monthlyContribution: 0,
      returnRate: DEFAULT_RATES.pensionReturn,
      paymentStartYear: retirementYear,
      paymentStartMonth: 1,  // 1월부터 수령 시작
      paymentYears: 20,  // 20년간 연금 수령
    } as PensionData,
    memo: '은퇴 전까지 납입, 은퇴 후 20년간 수령',
    sort_order: sortOrder++,
  })

  // IRP (현재~은퇴까지 납입, 은퇴 후 수령)
  items.push({
    simulation_id: simulationId,
    category: 'pension',
    type: 'irp',
    title: 'IRP',
    owner: 'self',
    start_year: currentYear,
    start_month: 1,
    end_year: retirementYear,
    end_month: 12,
    is_fixed_to_retirement_year: true,
    data: {
      currentBalance: 0,
      monthlyContribution: 0,
      returnRate: DEFAULT_RATES.pensionReturn,
      paymentStartYear: retirementYear,
      paymentStartMonth: 1,  // 1월부터 수령 시작
      paymentYears: 20,  // 20년간 연금 수령
    } as PensionData,
    memo: '은퇴 전까지 납입, 은퇴 후 20년간 수령',
    sort_order: sortOrder++,
  })

  return items
}

/**
 * 카테고리별 추가 가능한 항목 타입
 */
export const ADDABLE_ITEM_TYPES = {
  income: [
    { type: 'labor', label: '급여' },
    { type: 'business', label: '사업소득' },
    { type: 'side_income', label: '부업/프리랜서' },
    { type: 'rental', label: '임대소득' },
    { type: 'dividend', label: '배당/이자소득' },
    { type: 'other', label: '기타소득' },
  ],
  expense: [
    { type: 'living', label: '생활비' },
    { type: 'housing', label: '주거비' },
    { type: 'maintenance', label: '관리비' },
    { type: 'education', label: '교육비' },
    { type: 'child', label: '자녀 관련' },
    { type: 'insurance', label: '보험료' },
    { type: 'transport', label: '교통비' },
    { type: 'health', label: '의료비' },
    { type: 'travel', label: '여행' },
    { type: 'parents', label: '부모님 관련' },
    { type: 'wedding', label: '결혼/경조사' },
    { type: 'leisure', label: '여가/취미' },
    { type: 'other', label: '기타' },
  ],
  savings: [
    { type: 'emergency_fund', label: '비상금' },
    { type: 'savings_account', label: '예금/적금' },
    { type: 'stock', label: '주식/ETF' },
    { type: 'fund', label: '펀드/채권' },
    { type: 'crypto', label: '가상화폐' },
    { type: 'other', label: '기타' },
  ],
  pension: [
    { type: 'national', label: '국민연금' },
    { type: 'retirement', label: '퇴직연금' },
    { type: 'personal', label: '연금저축' },
    { type: 'irp', label: 'IRP' },
    { type: 'severance', label: '퇴직금' },
  ],
  asset: [
    { type: 'deposit', label: '예금' },
    { type: 'stock', label: '주식' },
    { type: 'fund', label: '펀드' },
    { type: 'bond', label: '채권' },
    { type: 'crypto', label: '가상화폐' },
    { type: 'vehicle', label: '자동차' },
    { type: 'other', label: '기타자산' },
  ],
  debt: [
    { type: 'mortgage', label: '주택담보대출' },
    { type: 'credit_loan', label: '신용대출' },
    { type: 'student_loan', label: '학자금대출' },
    { type: 'car_loan', label: '자동차대출' },
    { type: 'credit_card', label: '카드론' },
    { type: 'other', label: '기타대출' },
  ],
  real_estate: [
    { type: 'residence', label: '거주용' },
    { type: 'investment', label: '투자용' },
    { type: 'land', label: '토지' },
    { type: 'other', label: '기타' },
  ],
} as const

/**
 * 새 항목 생성 시 기본값
 */
export function createNewItemDefaults(
  simulationId: string,
  category: FinancialCategory,
  type: FinancialItemType,
  profile: UserProfile
): FinancialItemInput {
  const currentYear = new Date().getFullYear()
  const { birthYear, retirementAge } = profile
  const retirementYear = birthYear + retirementAge

  const baseItem: Partial<FinancialItemInput> = {
    simulation_id: simulationId,
    category,
    type,
    owner: 'self',
    start_year: currentYear,
    start_month: 1,
  }

  switch (category) {
    case 'income':
      return {
        ...baseItem,
        title: ADDABLE_ITEM_TYPES.income.find(t => t.type === type)?.label || '소득',
        end_year: retirementYear,
        is_fixed_to_retirement_year: true,
        data: {
          amount: 0,
          frequency: 'monthly',
          growthRate: DEFAULT_RATES.incomeGrowth,
        } as IncomeData,
      } as FinancialItemInput

    case 'expense':
      return {
        ...baseItem,
        title: ADDABLE_ITEM_TYPES.expense.find(t => t.type === type)?.label || '지출',
        owner: 'common',
        data: {
          amount: 0,
          frequency: 'monthly',
          growthRate: DEFAULT_RATES.expenseGrowth,
        } as ExpenseData,
      } as FinancialItemInput

    case 'savings':
      return {
        ...baseItem,
        title: ADDABLE_ITEM_TYPES.savings.find(t => t.type === type)?.label || '저축',
        owner: 'common',
        data: {
          currentBalance: 0,
          monthlyContribution: 0,
          interestRate: type === 'savings_account' ? DEFAULT_RATES.depositRate : DEFAULT_RATES.investmentReturn,
        } as SavingsData,
      } as FinancialItemInput

    case 'pension':
      return {
        ...baseItem,
        title: ADDABLE_ITEM_TYPES.pension.find(t => t.type === type)?.label || '연금',
        start_year: type === 'national' ? birthYear + DEFAULT_RATES.nationalPensionStartAge : undefined,
        data: {
          currentBalance: 0,
          returnRate: DEFAULT_RATES.pensionReturn,
          paymentStartAge: type === 'national' ? DEFAULT_RATES.nationalPensionStartAge : undefined,
        } as PensionData,
      } as FinancialItemInput

    case 'debt':
      return {
        ...baseItem,
        title: ADDABLE_ITEM_TYPES.debt.find(t => t.type === type)?.label || '대출',
        owner: 'common',
        data: {
          principal: 0,
          currentBalance: 0,
          interestRate: type === 'mortgage' ? DEFAULT_RATES.mortgageRate : 5.0,
          repaymentType: '원리금균등상환',
        },
      } as FinancialItemInput

    case 'real_estate':
      return {
        ...baseItem,
        title: ADDABLE_ITEM_TYPES.real_estate.find(t => t.type === type)?.label || '부동산',
        owner: 'common',
        data: {
          currentValue: 0,
          appreciationRate: DEFAULT_RATES.realEstateGrowth,
          housingType: type === 'residence' ? '자가' : undefined,
          hasLoan: false,
        } as RealEstateData,
      } as FinancialItemInput

    default:
      return baseItem as FinancialItemInput
  }
}

/**
 * 소득/지출 탭 UI 그룹 구조
 * 각 그룹별로 항목을 정리하여 표시
 */
export const CASHFLOW_UI_GROUPS = {
  income: [
    {
      group: 'labor',
      label: '근로소득',
      types: ['labor'],
      description: '급여, 상여금 등',
    },
    {
      group: 'business',
      label: '사업소득',
      types: ['business', 'side_income'],
      description: '사업, 프리랜서, 부업 등',
    },
    {
      group: 'passive',
      label: '기타소득',
      types: ['rental', 'dividend', 'other'],
      description: '임대, 배당, 이자 등',
    },
  ],
  expense: [
    {
      group: 'fixed',
      label: '고정 지출',
      types: ['living', 'housing', 'maintenance', 'insurance'],
      description: '생활비, 주거비, 보험료 등',
    },
    {
      group: 'child',
      label: '자녀 관련',
      types: ['child', 'education'],
      description: '양육비, 교육비 등',
    },
    {
      group: 'travel',
      label: '여행',
      types: ['travel'],
      description: '국내/해외 여행',
    },
    {
      group: 'medical',
      label: '의료비',
      types: ['health'],
      description: '병원비, 약값 등',
    },
    {
      group: 'parents',
      label: '부모님 관련',
      types: ['parents'],
      description: '용돈, 간병비 등',
    },
    {
      group: 'event',
      label: '기타 이벤트',
      types: ['wedding', 'transport', 'leisure', 'other'],
      description: '경조사, 차량, 여가 등',
    },
  ],
} as const

/**
 * 자녀 교육비 자동 생성 (자녀 나이 기반)
 */
export interface ChildEducationPreset {
  stage: string
  label: string
  startAge: number
  endAge: number
  monthlyAmount: number  // 만원
}

export const CHILD_EDUCATION_PRESETS: ChildEducationPreset[] = [
  { stage: 'kindergarten', label: '유치원', startAge: 4, endAge: 6, monthlyAmount: 40 },
  { stage: 'elementary', label: '초등학교', startAge: 7, endAge: 12, monthlyAmount: 30 },
  { stage: 'middle', label: '중학교', startAge: 13, endAge: 15, monthlyAmount: 50 },
  { stage: 'high', label: '고등학교', startAge: 16, endAge: 18, monthlyAmount: 80 },
  { stage: 'university', label: '대학교', startAge: 19, endAge: 22, monthlyAmount: 150 },
]

/**
 * 자녀 정보 기반으로 교육비 항목 자동 생성
 */
export function createChildEducationItems(
  simulationId: string,
  childName: string,
  childBirthYear: number,
  currentYear: number = new Date().getFullYear()
): FinancialItemInput[] {
  const items: FinancialItemInput[] = []
  const childAge = currentYear - childBirthYear

  for (const preset of CHILD_EDUCATION_PRESETS) {
    // 이미 지나간 교육 단계는 스킵
    if (childAge > preset.endAge) continue

    const startYear = childBirthYear + preset.startAge
    const endYear = childBirthYear + preset.endAge

    items.push({
      simulation_id: simulationId,
      category: 'expense',
      type: 'education',
      title: `${childName} ${preset.label}`,
      owner: 'common',
      start_year: Math.max(startYear, currentYear),
      start_month: 3,  // 3월 시작
      end_year: endYear,
      end_month: 2,    // 2월 종료
      data: {
        amount: preset.monthlyAmount,
        frequency: 'monthly',
        growthRate: DEFAULT_RATES.expenseGrowth,
      } as ExpenseData,
      memo: `${preset.startAge}세~${preset.endAge}세`,
    })
  }

  return items
}
