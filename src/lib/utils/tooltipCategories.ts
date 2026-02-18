/**
 * 툴팁 카테고리 분류 유틸리티
 * - 모든 차트의 툴팁에서 일관된 카테고리 분류 사용
 * - 색상, 키워드, 순서 등 중앙 관리
 *
 * [구조 추가 시 주의]
 * - 새로운 소득/지출/자산 타입 추가 시 반드시 여기에 색상 정의
 * - CHART_COLORS에서 색상 가져다 사용 (직접 하드코딩 금지)
 * - structure.md 업데이트 필수
 */

// ============================================
// 차트 색상 상수 (Single Source of Truth)
// ============================================

export const CHART_COLORS = {
  // 소득 타입
  income: {
    labor: '#007aff',      // 근로소득 (파란색)
    business: '#5856d6',   // 사업소득 (보라색)
    pension: '#34c759',    // 연금소득 (초록색)
    rental: '#ff9500',     // 임대소득 (주황색)
    financial: '#00c7be',  // 금융소득 (청록색)
    regular: '#af52de',    // 정기소득 (연보라색)
    onetime: '#ff2d55',    // 일시소득 (핑크색)
    other: '#8e8e93',      // 기타소득 (회색)
  },
  // 지출 타입
  expense: {
    fixed: '#ff3b30',      // 고정비 (빨간색)
    variable: '#ff9500',   // 변동비 (주황색)
    housing: '#ff6b35',    // 주거비 (주황-빨강)
    medical: '#007aff',    // 의료비 (파란색)
    education: '#5856d6',  // 교육비 (보라색)
    loan: '#ef4444',       // 대출상환 (빨간색)
    interest: '#af52de',   // 이자비용 (연보라색)
    leisure: '#00c7be',    // 여가비 (청록색)
    transportation: '#34c759', // 교통비 (초록색)
    onetime: '#ff2d55',    // 일시지출 (핑크색)
    other: '#636366',      // 기타지출 (진회색)
  },
  // 자산 타입 (카테고리 레벨)
  asset: {
    savings: '#22c55e',    // 저축/계좌 (초록색) - 예금, 적금, CMA 등
    investment: '#5856d6', // 투자자산 (보라색) - 주식, 펀드, ETF
    realEstate: '#3b82f6', // 부동산 (파란색)
    deposit: '#00c7be',    // 보증금 (청록색)
    pension: '#eab308',    // 연금자산 (노란색) - 퇴직연금, IRP, 개인연금
    tangible: '#f97316',   // 실물자산 (주황색) - 자동차, 귀금속
    financial: '#22c55e',  // 금융자산 (초록색) - savings와 동일 (호환용)
    cash: '#a855f7',       // 현금 (연보라색)
    other: '#8e8e93',      // 기타자산 (회색)
  },
  // 저축 세부 타입
  savingsDetail: {
    checking: '#22c55e',   // 입출금통장 (초록색)
    savings: '#16a34a',    // 적금 (진초록색)
    deposit: '#15803d',    // 정기예금 (더 진한 초록색)
  },
  // 투자 세부 타입
  investmentDetail: {
    domestic_stock: '#5856d6', // 국내주식/ETF (보라색)
    foreign_stock: '#7c3aed',  // 해외주식/ETF (연보라색)
    fund: '#8b5cf6',           // 펀드 (밝은 보라색)
    bond: '#a78bfa',           // 채권 (더 밝은 보라색)
    crypto: '#c4b5fd',         // 암호화폐 (연한 보라색)
    other: '#8e8e93',          // 기타 (회색)
  },
  // 연금/ISA 세부 타입
  pensionDetail: {
    isa_self: '#eab308',       // 본인 ISA (노란색)
    isa_spouse: '#facc15',     // 배우자 ISA (밝은 노란색)
    irp: '#ca8a04',            // IRP (진한 노란색)
    retirement: '#a16207',     // 퇴직연금 (갈색-노란색)
    personal: '#854d0e',       // 개인연금 (갈색)
  },
  // 부채 타입
  debt: {
    mortgage: '#ff3b30',   // 주택담보대출 (빨간색)
    jeonse: '#ff6b35',     // 전세대출 (주황-빨강)
    credit: '#ff9500',     // 신용대출 (주황색)
    car: '#af52de',        // 자동차대출 (연보라색)
    student: '#5856d6',    // 학자금대출 (보라색)
    other: '#8e8e93',      // 기타대출 (회색)
  },
  // 범용 색상
  positive: '#10b981',     // 양수/긍정 (초록색)
  negative: '#ef4444',     // 음수/부정 (빨간색)
  neutral: '#78716c',      // 중립 (갈색-회색)
  total: '#1d1d1f',        // 합계 (검정)
} as const

// ============================================
// 소득 카테고리
// ============================================

export interface IncomeCategory {
  id: string
  label: string
  color: string
  keywords: string[]
}

export const INCOME_CATEGORIES: IncomeCategory[] = [
  {
    id: 'labor',
    label: '근로소득',
    color: CHART_COLORS.income.labor,
    keywords: ['급여', '근로', '월급', '연봉', '본인', '배우자'],
  },
  {
    id: 'business',
    label: '사업소득',
    color: CHART_COLORS.income.business,
    keywords: ['사업', '프리랜서', '자영업', '매출', '수익'],
  },
  {
    id: 'pension',
    label: '연금소득',
    color: CHART_COLORS.income.pension,
    keywords: ['연금', '공적연금', '국민연금', '퇴직연금', '개인연금', '공무원연금', '군인연금', '사학연금'],
  },
  {
    id: 'rental',
    label: '임대소득',
    color: CHART_COLORS.income.rental,
    keywords: ['임대', '월세수입', '렌트', '부동산수입'],
  },
  {
    id: 'financial',
    label: '금융소득',
    color: CHART_COLORS.income.financial,
    keywords: ['이자', '배당', '투자수익', '금융', '예금이자'],
  },
  {
    id: 'other_income',
    label: '기타소득',
    color: CHART_COLORS.income.other,
    keywords: [],
  },
]

// ============================================
// 지출 카테고리
// ============================================

export interface ExpenseCategory {
  id: string
  label: string
  color: string
  keywords: string[]
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    id: 'living',
    label: '생활비',
    color: CHART_COLORS.expense.variable,
    keywords: ['생활비', '식비', '생필품', '장보기', '외식'],
  },
  {
    id: 'housing',
    label: '주거비',
    color: CHART_COLORS.expense.housing,
    keywords: ['주거', '월세', '관리비', '전세', '공과금', '수도', '전기', '가스'],
  },
  {
    id: 'loan',
    label: '대출상환',
    color: CHART_COLORS.expense.loan,
    keywords: ['이자', '원금', '상환', '대출', '담보', '신용'],
  },
  {
    id: 'medical',
    label: '의료비',
    color: CHART_COLORS.expense.medical,
    keywords: ['의료', '건강', '병원', '약값', '치료', '검진'],
  },
  {
    id: 'education',
    label: '교육/양육',
    color: CHART_COLORS.expense.education,
    keywords: ['교육', '학비', '양육', '자녀', '학원', '등록금', '유치원', '어린이집'],
  },
  {
    id: 'fixed',
    label: '고정비',
    color: CHART_COLORS.expense.fixed,
    keywords: ['보험', '통신', '구독', '멤버십', '정기결제', '휴대폰'],
  },
  {
    id: 'leisure',
    label: '여가비',
    color: CHART_COLORS.expense.leisure,
    keywords: ['여가', '여행', '취미', '문화', '운동', '헬스'],
  },
  {
    id: 'transportation',
    label: '교통비',
    color: CHART_COLORS.expense.transportation,
    keywords: ['교통', '자동차', '주유', '기름값', '대중교통', '주차'],
  },
  {
    id: 'other_expense',
    label: '기타지출',
    color: CHART_COLORS.expense.other,
    keywords: [],
  },
]

// ============================================
// 자산 카테고리
// ============================================

export interface AssetCategory {
  id: string
  label: string
  color: string
  keywords: string[]
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  {
    id: 'pension',
    label: '연금',
    color: CHART_COLORS.asset.pension,
    keywords: ['연금저축', '연금', 'IRP', 'ISA', '퇴직연금', '개인연금', '퇴직금'],
  },
  {
    id: 'savings',
    label: '저축',
    color: CHART_COLORS.asset.savings,
    keywords: ['예금', '적금', '저축', 'CMA', 'MMF', '입출금', '통장', '계좌', '현금'],
  },
  {
    id: 'investment',
    label: '투자',
    color: CHART_COLORS.asset.investment,
    keywords: ['투자', '주식', '펀드', 'ETF', '채권', '코인', '가상화폐', '증권'],
  },
  {
    id: 'real_estate',
    label: '부동산',
    color: CHART_COLORS.asset.realEstate,
    keywords: ['부동산', '아파트', '주택', '토지', '건물', '오피스텔', '빌라', '상가'],
  },
  {
    id: 'deposit',
    label: '보증금',
    color: CHART_COLORS.asset.deposit,
    keywords: ['전세', '보증금', '임차'],
  },
  {
    id: 'tangible',
    label: '실물자산',
    color: CHART_COLORS.asset.tangible,
    keywords: ['자동차', '귀금속', '예술품', '시계', '금괴', '보석', '골동품'],
  },
  {
    id: 'other_asset',
    label: '기타자산',
    color: CHART_COLORS.asset.other,
    keywords: [],
  },
]

// ============================================
// 부채 카테고리
// ============================================

export interface DebtCategory {
  id: string
  label: string
  color: string
  keywords: string[]
}

export const DEBT_CATEGORIES: DebtCategory[] = [
  {
    id: 'mortgage',
    label: '주택담보대출',
    color: CHART_COLORS.debt.mortgage,
    keywords: ['주담대', '주택담보', '모기지', '아파트담보'],
  },
  {
    id: 'jeonse',
    label: '전세대출',
    color: CHART_COLORS.debt.jeonse,
    keywords: ['전세', '전세자금', '버팀목'],
  },
  {
    id: 'credit',
    label: '신용대출',
    color: CHART_COLORS.debt.credit,
    keywords: ['신용', '마이너스', '카드론'],
  },
  {
    id: 'car',
    label: '자동차대출',
    color: CHART_COLORS.debt.car,
    keywords: ['자동차', '차량', '오토론'],
  },
  {
    id: 'student',
    label: '학자금대출',
    color: CHART_COLORS.debt.student,
    keywords: ['학자금', '등록금', '취업후상환'],
  },
  {
    id: 'other_debt',
    label: '기타대출',
    color: CHART_COLORS.debt.other,
    keywords: [],
  },
]

// ============================================
// 분류 함수
// ============================================

/**
 * 소득 항목을 카테고리로 분류
 */
export function categorizeIncome(title: string): IncomeCategory {
  const t = title.toLowerCase()
  for (const category of INCOME_CATEGORIES) {
    if (category.keywords.some(keyword => t.includes(keyword))) {
      return category
    }
  }
  return INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1] // 기타소득
}

/**
 * 지출 항목을 카테고리로 분류
 */
export function categorizeExpense(title: string): ExpenseCategory {
  const t = title.toLowerCase()
  for (const category of EXPENSE_CATEGORIES) {
    if (category.keywords.some(keyword => t.includes(keyword))) {
      return category
    }
  }
  return EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1] // 기타지출
}

/**
 * 자산 항목을 카테고리로 분류
 */
export function categorizeAsset(title: string): AssetCategory {
  const t = title.toLowerCase()
  for (const category of ASSET_CATEGORIES) {
    if (category.keywords.some(keyword => t.includes(keyword))) {
      return category
    }
  }
  return ASSET_CATEGORIES[ASSET_CATEGORIES.length - 1] // 기타자산
}

/**
 * 부채 항목을 카테고리로 분류
 */
export function categorizeDebt(title: string): DebtCategory {
  const t = title.toLowerCase()
  for (const category of DEBT_CATEGORIES) {
    if (category.keywords.some(keyword => t.includes(keyword))) {
      return category
    }
  }
  return DEBT_CATEGORIES[DEBT_CATEGORIES.length - 1] // 기타대출
}

// ============================================
// 그룹핑 헬퍼 함수
// ============================================

export interface GroupedItem<T> {
  category: T
  items: { title: string; amount: number }[]
  total: number
}

/**
 * 자산 타입을 카테고리 ID로 매핑
 */
function getAssetCategoryId(type: string): string {
  const typeToCategory: Record<string, string> = {
    savings: 'savings',
    investment: 'investment',
    real_estate: 'real_estate',
    deposit: 'deposit',
    pension: 'pension',
    tangible: 'tangible',
  }
  return typeToCategory[type] || 'other_asset'
}

/**
 * 부채 타입을 카테고리 ID로 매핑
 */
function getDebtCategoryIdFromType(type: string): string {
  const typeToCategory: Record<string, string> = {
    mortgage: 'mortgage',
    jeonse: 'jeonse',
    credit: 'credit',
    car: 'car',
    student: 'student',
  }
  return typeToCategory[type] || 'other_debt'
}

/**
 * 소득 타입을 카테고리 ID로 매핑
 */
function getIncomeCategoryId(type: string): string {
  const typeToCategory: Record<string, string> = {
    labor: 'labor',
    business: 'business',
    pension: 'pension',
    national: 'pension',
    retirement: 'pension',
    personal: 'pension',
    irp: 'pension',
    rental: 'rental',
    dividend: 'financial',
    interest: 'financial',
    financial: 'financial',
    bonus: 'other_income',
    onetime: 'other_income',
    inheritance: 'other_income',
    gift: 'other_income',
    allowance: 'other_income',
    other: 'other_income',
  }
  return typeToCategory[type] || 'other_income'
}

/**
 * 소득 항목들을 카테고리별로 그룹핑 (type 필드 기반)
 */
export function groupIncomeItems(
  items: { title: string; amount: number; type?: string }[]
): GroupedItem<IncomeCategory>[] {
  const groups = new Map<string, GroupedItem<IncomeCategory>>()

  items.forEach(item => {
    if (item.amount <= 0) return

    // type 필드가 있으면 사용, 없으면 키워드 기반 폴백
    let categoryId: string
    if (item.type) {
      categoryId = getIncomeCategoryId(item.type)
    } else {
      categoryId = categorizeIncome(item.title).id
    }

    const category = INCOME_CATEGORIES.find(c => c.id === categoryId)
      || INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1]

    const existing = groups.get(category.id)
    if (existing) {
      existing.items.push(item)
      existing.total += item.amount
    } else {
      groups.set(category.id, {
        category,
        items: [item],
        total: item.amount,
      })
    }
  })

  // 카테고리 순서대로 정렬
  const categoryOrder = INCOME_CATEGORIES.map(c => c.id)
  return Array.from(groups.values()).sort(
    (a, b) => categoryOrder.indexOf(a.category.id) - categoryOrder.indexOf(b.category.id)
  )
}

/**
 * 지출 타입을 카테고리 ID로 매핑
 */
function getExpenseCategoryId(type: string): string {
  const typeToCategory: Record<string, string> = {
    living: 'living',
    food: 'living',
    housing: 'housing',
    rent: 'housing',
    maintenance: 'fixed',
    insurance: 'fixed',
    subscription: 'fixed',
    health: 'medical',
    medical: 'medical',
    education: 'education',
    child: 'education',
    transport: 'transportation',
    leisure: 'leisure',
    travel: 'other_expense',
    wedding: 'other_expense',
    onetime: 'other_expense',
    loan: 'loan',
    interest: 'loan',
    parents: 'other_expense',
    other: 'other_expense',
  }
  return typeToCategory[type] || 'other_expense'
}

/**
 * 지출 항목들을 카테고리별로 그룹핑 (type 필드 기반)
 */
export function groupExpenseItems(
  items: { title: string; amount: number; type?: string }[]
): GroupedItem<ExpenseCategory>[] {
  const groups = new Map<string, GroupedItem<ExpenseCategory>>()

  items.forEach(item => {
    if (item.amount <= 0) return

    // type 필드가 있으면 사용, 없으면 키워드 기반 폴백
    let categoryId: string
    if (item.type) {
      categoryId = getExpenseCategoryId(item.type)
    } else {
      categoryId = categorizeExpense(item.title).id
    }

    const category = EXPENSE_CATEGORIES.find(c => c.id === categoryId)
      || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]

    const existing = groups.get(category.id)
    if (existing) {
      existing.items.push(item)
      existing.total += item.amount
    } else {
      groups.set(category.id, {
        category,
        items: [item],
        total: item.amount,
      })
    }
  })

  // 카테고리 순서대로 정렬
  const categoryOrder = EXPENSE_CATEGORIES.map(c => c.id)
  return Array.from(groups.values()).sort(
    (a, b) => categoryOrder.indexOf(a.category.id) - categoryOrder.indexOf(b.category.id)
  )
}

/**
 * 자산 항목들을 카테고리별로 그룹핑
 */
export function groupAssetItems(
  items: { title: string; amount: number; type?: string }[]
): GroupedItem<AssetCategory>[] {
  const groups = new Map<string, GroupedItem<AssetCategory>>()

  items.forEach(item => {
    if (item.amount <= 0) return

    // type 필드가 있으면 사용, 없으면 키워드 기반 폴백
    let categoryId: string
    if (item.type) {
      categoryId = getAssetCategoryId(item.type)
    } else {
      categoryId = categorizeAsset(item.title).id
    }

    const category = ASSET_CATEGORIES.find(c => c.id === categoryId)
      || ASSET_CATEGORIES[ASSET_CATEGORIES.length - 1]

    const existing = groups.get(category.id)
    if (existing) {
      existing.items.push(item)
      existing.total += item.amount
    } else {
      groups.set(category.id, {
        category,
        items: [item],
        total: item.amount,
      })
    }
  })

  // 카테고리 순서대로 정렬
  const categoryOrder = ASSET_CATEGORIES.map(c => c.id)
  return Array.from(groups.values()).sort(
    (a, b) => categoryOrder.indexOf(a.category.id) - categoryOrder.indexOf(b.category.id)
  )
}

/**
 * 부채 항목들을 카테고리별로 그룹핑
 */
export function groupDebtItems(
  items: { title: string; amount: number; type?: string }[]
): GroupedItem<DebtCategory>[] {
  const groups = new Map<string, GroupedItem<DebtCategory>>()

  items.forEach(item => {
    if (item.amount <= 0) return

    // type 필드가 있으면 사용, 없으면 키워드 기반 폴백
    let categoryId: string
    if (item.type) {
      categoryId = getDebtCategoryIdFromType(item.type)
    } else {
      categoryId = categorizeDebt(item.title).id
    }

    const category = DEBT_CATEGORIES.find(c => c.id === categoryId)
      || DEBT_CATEGORIES[DEBT_CATEGORIES.length - 1]

    const existing = groups.get(category.id)
    if (existing) {
      existing.items.push(item)
      existing.total += item.amount
    } else {
      groups.set(category.id, {
        category,
        items: [item],
        total: item.amount,
      })
    }
  })

  // 카테고리 순서대로 정렬
  const categoryOrder = DEBT_CATEGORIES.map(c => c.id)
  return Array.from(groups.values()).sort(
    (a, b) => categoryOrder.indexOf(a.category.id) - categoryOrder.indexOf(b.category.id)
  )
}

// ============================================
// Cash Flow 카테고리 (flowType별 그룹핑)
// ============================================

import type { CashFlowType, CashFlowItem } from '@/types'

export interface CashFlowCategory {
  id: string
  label: string
  color: string
  flowTypes: CashFlowType[]
}

export const INFLOW_CATEGORIES: CashFlowCategory[] = [
  { id: 'income', label: '소득', color: CHART_COLORS.income.labor, flowTypes: ['income'] },
  { id: 'pension_withdrawal', label: '연금 수령', color: CHART_COLORS.asset.pension, flowTypes: ['pension_withdrawal', 'pension_lump_sum'] },
  { id: 'savings_withdrawal', label: '저축/투자 인출', color: CHART_COLORS.asset.savings, flowTypes: ['savings_withdrawal', 'savings_interest'] },
  { id: 'real_estate', label: '부동산', color: CHART_COLORS.asset.realEstate, flowTypes: ['real_estate_sale', 'rental_income'] },
  { id: 'asset_sale', label: '자산 매각', color: CHART_COLORS.asset.tangible, flowTypes: ['asset_sale'] },
  { id: 'deficit_withdrawal', label: '부족분 인출', color: CHART_COLORS.expense.variable, flowTypes: ['deficit_withdrawal'] },
]

export const OUTFLOW_CATEGORIES: CashFlowCategory[] = [
  { id: 'expense', label: '지출', color: CHART_COLORS.expense.variable, flowTypes: ['expense'] },
  { id: 'debt', label: '대출 상환', color: CHART_COLORS.expense.loan, flowTypes: ['debt_interest', 'debt_principal'] },
  { id: 'savings_contribution', label: '저축/투자', color: CHART_COLORS.asset.savings, flowTypes: ['savings_contribution', 'surplus_investment'] },
  { id: 'pension_contribution', label: '연금 적립', color: CHART_COLORS.asset.pension, flowTypes: ['pension_contribution'] },
  { id: 'tax', label: '세금', color: CHART_COLORS.expense.other, flowTypes: ['tax'] },
  { id: 'insurance', label: '보험료', color: CHART_COLORS.expense.fixed, flowTypes: ['insurance_premium'] },
  { id: 'real_estate', label: '부동산', color: CHART_COLORS.asset.realEstate, flowTypes: ['real_estate_purchase', 'housing_expense'] },
  { id: 'asset_purchase', label: '자산 매입', color: CHART_COLORS.asset.tangible, flowTypes: ['asset_purchase'] },
]

export interface GroupedCashFlow {
  category: CashFlowCategory
  items: CashFlowItem[]
  total: number  // always positive
}

export function groupCashFlowItems(items: CashFlowItem[]): {
  inflows: GroupedCashFlow[]
  outflows: GroupedCashFlow[]
  totalInflow: number
  totalOutflow: number
} {
  const inflowGroups = new Map<string, GroupedCashFlow>()
  const outflowGroups = new Map<string, GroupedCashFlow>()

  for (const item of items) {
    if (item.amount > 0) {
      // inflow
      const cat = INFLOW_CATEGORIES.find(c => c.flowTypes.includes(item.flowType))
        || INFLOW_CATEGORIES[INFLOW_CATEGORIES.length - 1]
      const existing = inflowGroups.get(cat.id)
      if (existing) {
        existing.items.push(item)
        existing.total += item.amount
      } else {
        inflowGroups.set(cat.id, { category: cat, items: [item], total: item.amount })
      }
    } else if (item.amount < 0) {
      // outflow
      const cat = OUTFLOW_CATEGORIES.find(c => c.flowTypes.includes(item.flowType))
        || OUTFLOW_CATEGORIES[OUTFLOW_CATEGORIES.length - 1]
      const existing = outflowGroups.get(cat.id)
      if (existing) {
        existing.items.push(item)
        existing.total += Math.abs(item.amount)
      } else {
        outflowGroups.set(cat.id, { category: cat, items: [item], total: Math.abs(item.amount) })
      }
    }
  }

  // Sort by category order
  const inflowOrder = INFLOW_CATEGORIES.map(c => c.id)
  const outflowOrder = OUTFLOW_CATEGORIES.map(c => c.id)

  const inflows = Array.from(inflowGroups.values()).sort(
    (a, b) => inflowOrder.indexOf(a.category.id) - inflowOrder.indexOf(b.category.id)
  )
  const outflows = Array.from(outflowGroups.values()).sort(
    (a, b) => outflowOrder.indexOf(a.category.id) - outflowOrder.indexOf(b.category.id)
  )

  return {
    inflows,
    outflows,
    totalInflow: inflows.reduce((sum, g) => sum + g.total, 0),
    totalOutflow: outflows.reduce((sum, g) => sum + g.total, 0),
  }
}
