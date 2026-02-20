// 현금흐름 유형
export type CashFlowType =
  | "income" // 소득 (근로, 사업, 임대 등)
  | "expense" // 지출 (생활비, 의료비 등)
  | "savings_contribution" // 저축/투자 적립
  | "savings_withdrawal" // 저축/투자 인출
  | "savings_interest" // 저축 이자/배당 수익
  | "pension_contribution" // 연금 적립
  | "pension_withdrawal" // 연금 수령
  | "pension_lump_sum" // 연금/퇴직금 일시금 수령
  | "debt_interest" // 대출 이자
  | "debt_principal" // 원금 상환
  | "real_estate_purchase" // 부동산 구매
  | "real_estate_sale" // 부동산 매도
  | "asset_purchase" // 실물자산 구매
  | "asset_sale" // 실물자산 매도
  | "tax" // 세금 (취득세, 양도세 등)
  | "insurance_premium" // 보험료
  | "housing_expense" // 주거비 (월세, 관리비)
  | "rental_income" // 임대 소득
  | "surplus_investment" // 잉여 현금 투자
  | "deficit_withdrawal"; // 부족분 인출

// 현금흐름 개별 항목
export interface CashFlowItem {
  title: string;
  amount: number; // 양수 = 유입, 음수 = 유출
  flowType: CashFlowType;
  sourceType?: string; // 원천 테이블 (savings, debts, pensions, real_estates, etc.)
  sourceId?: string; // 원천 ID
}

// 자산 카테고리 타입
export type AssetCategory =
  | "income"
  | "expense"
  | "real_estate"
  | "asset"
  | "debt"
  | "pension";

// 빈도 타입
export type Frequency = "monthly" | "yearly" | "once";

// 가족 관계 타입
export type FamilyRelationship = "spouse" | "child" | "parent";

// 성별 타입
export type Gender = "male" | "female";

// 사용자 프로필
export interface Profile {
  id: string;
  name: string;
  birth_date: string; // YYYY-MM-DD 형식
  target_retirement_age: number;
  target_retirement_fund: number;
  created_at: string;
  updated_at: string;
}

// 가족 구성원 (DB 테이블)
export interface FamilyMember {
  id: string;
  user_id: string;
  relationship: FamilyRelationship;
  name: string;
  birth_date: string | null;
  gender: Gender | null;
  is_dependent: boolean;
  // 배우자 재정 정보
  is_working: boolean;
  retirement_age: number | null;
  monthly_income: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// 가족 구성원 입력 폼
export interface FamilyMemberInput {
  relationship: FamilyRelationship;
  name: string;
  birth_date?: string;
  gender?: Gender;
  is_dependent?: boolean;
  // 배우자 재정 정보
  is_working?: boolean;
  retirement_age?: number;
  monthly_income?: number;
  notes?: string;
}

// 자산 항목
export interface Asset {
  id: string;
  user_id: string;
  category: AssetCategory;
  name: string;
  amount: number;
  frequency: Frequency;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// 소득 항목 타입 (대시보드용)
export type DashboardIncomeType =
  | "labor"
  | "business"
  | "regular"
  | "onetime"
  | "rental"
  | "pension";
export type DashboardEndType =
  | "self-retirement"
  | "spouse-retirement"
  | "self-life-expectancy"
  | "spouse-life-expectancy"
  | "custom";
export type DashboardIncomeFrequency = "monthly" | "yearly";

// 상승률 카테고리 (시나리오에 따라 변동)
export type RateCategory =
  | "inflation"
  | "income"
  | "investment"
  | "realEstate"
  | "fixed";

// 상승률 카테고리 라벨
export const RATE_CATEGORY_LABELS: Record<RateCategory, string> = {
  inflation: "물가연동",
  income: "소득연동",
  investment: "투자수익",
  realEstate: "부동산",
  fixed: "고정",
};

// 소득 연동 출처 타입
export type IncomeSourceType =
  | "realEstate"
  | "manual"
  | "national_pension"
  | "retirement_pension"
  | "personal_pension"
  | "real_estate";

// 소득 항목 (대시보드용)
export interface DashboardIncomeItem {
  id: string;
  type: DashboardIncomeType;
  label: string;
  owner: "self" | "spouse";
  amount: number; // 만원 (frequency에 따라 월/년)
  frequency: DashboardIncomeFrequency; // 지급 주기 (월/년)
  startYear: number;
  startMonth: number; // 1-12
  endType: DashboardEndType;
  endYear: number | null; // custom일 때만 사용
  endMonth: number | null; // custom일 때만 사용
  endAge?: number; // age 종료 조건일 때 사용
  growthRate: number; // % (연간) - 커스텀 모드에서 사용하는 기본값
  rateCategory: RateCategory; // 상승률 카테고리 (시나리오 모드에 따라 적용)
  icon?: string | null;
  color?: string | null;
  isSystem?: boolean; // 시스템에서 자동 생성된 항목 (연금 탭 등)
  // 연동 정보 (다른 탭에서 생성된 경우)
  sourceType?: IncomeSourceType;
  sourceId?: string; // 원본 항목 ID (realEstateProperty.id 등)
}

// 지출 항목 타입 (대시보드용)
export type DashboardExpenseType =
  | "fixed"
  | "variable"
  | "onetime"
  | "medical"
  | "interest"
  | "housing";
export type DashboardExpenseFrequency = "monthly" | "yearly";

// 지출 연동 출처 타입
export type ExpenseSourceType = "debt" | "real_estate" | "insurance";

// 지출 항목 (대시보드용)
export interface DashboardExpenseItem {
  id: string;
  type: DashboardExpenseType;
  label: string;
  amount: number; // 만원 (frequency에 따라 월/년)
  frequency: DashboardExpenseFrequency; // 지출 주기 (월/년)
  owner: 'self' | 'spouse' | 'common';
  startYear: number;
  startMonth: number; // 1-12
  endType: DashboardEndType;
  endYear: number | null; // custom일 때만 사용
  endMonth: number | null; // custom일 때만 사용
  growthRate: number; // % (연간) - 커스텀 모드에서 사용하는 기본값
  rateCategory: RateCategory; // 상승률 카테고리 (시나리오 모드에 따라 적용)
  icon?: string | null;
  color?: string | null;
  // 연동 정보 (다른 탭에서 생성된 경우)
  sourceType?: ExpenseSourceType;
  sourceId?: string; // 원본 항목 ID (debt.id 등)
}

// 저축 계좌 타입
export type SavingsAccountType = "checking" | "savings" | "deposit";

// 저축 계좌
export interface SavingsAccount {
  id: string;
  type: SavingsAccountType;
  name: string; // 계좌명 (예: 신한은행 주거래, 카카오뱅크 등)
  balance: number; // 잔액 (만원)
  interestRate?: number; // 금리 (%)
  maturityYear?: number; // 만기 연도 (정기예금/적금)
  maturityMonth?: number; // 만기 월 (정기예금/적금)
}

// 투자 계좌 타입
export type InvestmentAccountType =
  | "domestic_stock"
  | "foreign_stock"
  | "fund"
  | "bond"
  | "crypto"
  | "other";

// 투자 계좌
export interface InvestmentAccount {
  id: string;
  type: InvestmentAccountType;
  name: string; // 계좌명 (예: 삼성증권 국내, 키움 해외 등)
  balance: number; // 평가액 (만원)
  expectedReturn?: number; // 예상 수익률 (%)
}

// 실물 자산 타입 (저축/투자 외 실물 자산)
export type PhysicalAssetType = "car" | "precious_metal" | "custom";

// 부동산 용도 타입 (온보딩 거주용 외 추가 부동산)
export type RealEstateUsageType = "investment" | "rental" | "land";
// investment: 투자용 (아파트, 주택)
// rental: 임대용 (상가, 오피스텔)
// land: 토지

// 추가 부동산 (투자용, 임대용, 토지)
export interface RealEstateProperty {
  id: string;
  usageType: RealEstateUsageType; // 용도
  name: string; // 예: "강남 오피스텔", "판교 상가"

  // 가치 정보
  marketValue: number; // 시세/매입가 (만원)
  purchaseYear?: number;
  purchaseMonth?: number;

  // 임대 수익
  hasRentalIncome?: boolean;
  monthlyRent?: number; // 월 임대료 (만원)
  deposit?: number; // 임대 보증금 (만원)

  // 대출 정보
  hasLoan?: boolean;
  loanAmount?: number; // 대출금액 (만원)
  loanRate?: number; // 금리 (%)
  loanMaturity?: string; // 만기 (YYYY-MM)
  loanRepaymentType?:
    | "만기일시상환"
    | "원리금균등상환"
    | "원금균등상환"
    | "거치식상환"
    | null;
}

// 실물 자산 금융 타입 (대출/할부/없음)
export type AssetFinancingType = "loan" | "installment" | "none";

// 실물 자산 대출 상환방식
export type AssetLoanRepaymentType =
  | "만기일시상환"
  | "원리금균등상환"
  | "원금균등상환"
  | null;

// 실물 자산
export interface PhysicalAsset {
  id: string;
  type: PhysicalAssetType;
  name: string; // 자산명 (예: BMW 5시리즈, 금 50g)
  purchaseValue: number; // 매입가 (만원)
  purchaseYear?: number; // 취득 연도
  purchaseMonth?: number; // 취득 월
  // 대출/할부 정보
  financingType?: AssetFinancingType; // 금융 타입: 대출/할부/없음
  loanAmount?: number; // 대출/할부 금액 (만원)
  loanRate?: number; // 금리 (%)
  loanMaturity?: string; // 만기 (YYYY-MM)
  loanRepaymentType?: AssetLoanRepaymentType; // 상환방식
}

// 온보딩 목적 타입
export type OnboardingPurpose =
  | "retirement_fund"
  | "savings_check"
  | "pension_calc"
  | "asset_organize"
  | "dont_know";

// 온보딩 데이터
export interface OnboardingData {
  // 온보딩 목적 (Part 1에서 선택, 다중 선택 가능)
  purposes?: OnboardingPurpose[];

  // Step 1: 기본 정보
  name: string;
  gender: Gender | null; // 성별
  birth_date: string; // YYYY-MM-DD 형식
  target_retirement_age: number;
  target_retirement_fund: number;

  // Step 2: 결혼 여부 및 배우자 정보
  isMarried: boolean | null; // null = 아직 선택 안함, false = 없음, true = 있음
  spouse: FamilyMemberInput | null;

  // Step 3: 자녀/부모 정보
  hasChildren: boolean | null; // null = 아직 선택 안함, false = 없음, true = 있음
  children: FamilyMemberInput[];
  parents: FamilyMemberInput[];

  // Step 4-8: 자산 정보
  // 소득 (근로소득, 사업소득, 기타소득)
  laborIncome: number | null; // 본인 근로 소득
  laborIncomeFrequency: "monthly" | "yearly";
  spouseLaborIncome: number | null; // 배우자 근로 소득
  spouseLaborIncomeFrequency: "monthly" | "yearly";
  businessIncome: number | null; // 본인 사업 소득
  businessIncomeFrequency: "monthly" | "yearly";
  spouseBusinessIncome: number | null; // 배우자 사업 소득
  spouseBusinessIncomeFrequency: "monthly" | "yearly";

  // 소득 항목 (대시보드용 상세 데이터)
  incomeItems?: DashboardIncomeItem[];

  // 지출 항목 (대시보드용 상세 데이터)
  expenseItems?: DashboardExpenseItem[];

  // 지출
  livingExpenses: number | null; // 생활비
  livingExpensesFrequency: "monthly" | "yearly"; // 생활비 주기

  // 거주용 부동산
  housingType: "자가" | "전세" | "월세" | "해당없음" | null; // 거주 형태
  housingValue: number | null; // 자가: 시세, 전세/월세: 보증금
  housingPurchaseYear: number | null; // 자가: 취득 연도
  housingPurchaseMonth: number | null; // 자가: 취득 월
  housingPurchasePrice: number | null; // 자가: 취득가 (만원)
  housingRent: number | null; // 월세: 월세
  housingMaintenance: number | null; // 관리비 (자가, 전세, 월세 공통)
  housingHasLoan: boolean; // 대출 여부
  housingLoan: number | null; // 대출금액
  housingLoanRate: number | null; // 대출 금리 (%)
  housingLoanMaturity: string | null; // 대출 만기 (YYYY-MM)
  housingLoanType:
    | "만기일시상환"
    | "원리금균등상환"
    | "원금균등상환"
    | "거치식상환"
    | null; // 상환방식

  // 금융자산 - 저축 계좌 (복수)
  savingsAccounts: SavingsAccount[];

  // 금융자산 - 투자 계좌 (복수)
  investmentAccounts: InvestmentAccount[];

  // 실물 자산 (자동차, 귀금속 등)
  physicalAssets: PhysicalAsset[];

  // 추가 부동산 (투자용, 임대용, 토지 - 거주용 제외)
  realEstateProperties: RealEstateProperty[];

  // 금융자산 없음 여부
  hasNoAsset: boolean | null; // null = 아직 선택 안함, true = 금융자산 없음

  // 부채 목록
  debts: DebtInput[];
  hasNoDebt: boolean | null; // null = 아직 선택 안함, true = 부채 없음

  // 연금 - 본인
  nationalPension: number | null; // 국민연금 예상 월 수령액
  nationalPensionStartAge: number | null; // 국민연금 수령 시작 나이
  retirementPensionType:
    | "DB"
    | "DC"
    | "corporate_irp"
    | "severance"
    | "unknown"
    | null; // 퇴직연금/퇴직금 유형
  retirementPensionBalance: number | null; // 퇴직연금 현재 잔액
  retirementPensionReceiveType: "lump_sum" | "annuity" | null; // 수령 방식: 일시금 / 연금
  retirementPensionStartAge: number | null; // 연금 수령 시작 나이
  retirementPensionReceivingYears: number | null; // 연금 수령 기간
  personalPensionMonthly: number | null; // 개인연금 월 납입액 (deprecated)
  personalPensionBalance: number | null; // 개인연금 현재 잔액 (deprecated)
  irpBalance: number | null; // IRP 현재 잔액
  irpMonthlyContribution: number | null; // IRP 월 납입액
  irpStartAge: number | null; // IRP 수령 시작 나이
  irpReceivingYears: number | null; // IRP 수령 기간 (년)
  pensionSavingsBalance: number | null; // 연금저축 현재 잔액
  pensionSavingsMonthlyContribution: number | null; // 연금저축 월 납입액
  pensionSavingsStartAge: number | null; // 연금저축 수령 시작 나이
  pensionSavingsReceivingYears: number | null; // 연금저축 수령 기간 (년)
  isaBalance: number | null; // ISA 현재 잔액
  isaMonthlyContribution: number | null; // ISA 월 납입액
  isaMaturityYear: number | null; // ISA 만기 연도
  isaMaturityMonth: number | null; // ISA 만기 월
  isaMaturityStrategy: "pension_savings" | "irp" | "cash" | null; // ISA 만기 후 전략
  personalPensionWithdrawYears: number | null; // 개인연금 수령 기간 (년) - deprecated
  otherPensionMonthly: number | null; // 기타연금 예상 월 수령액
  hasNoPension: boolean | null; // null = 아직 선택 안함, true = 연금 없음
  yearsOfService: number | null; // 현재 근속연수

  // 연금 - 배우자
  spouseNationalPension: number | null; // 배우자 국민연금 예상 월 수령액
  spouseNationalPensionStartAge: number | null; // 배우자 국민연금 수령 시작 나이
  spouseRetirementPensionType:
    | "DB"
    | "DC"
    | "corporate_irp"
    | "severance"
    | "unknown"
    | null;
  spouseRetirementPensionBalance: number | null; // 배우자 퇴직연금 현재 잔액
  spouseRetirementPensionReceiveType: "lump_sum" | "annuity" | null;
  spouseRetirementPensionStartAge: number | null;
  spouseRetirementPensionReceivingYears: number | null;
  spouseYearsOfService: number | null; // 배우자 현재 근속연수
  spousePensionSavingsBalance: number | null; // 배우자 연금저축 잔액
  spousePensionSavingsMonthlyContribution: number | null;
  spousePensionSavingsStartAge: number | null;
  spousePensionSavingsReceivingYears: number | null;
  spouseIrpBalance: number | null; // 배우자 IRP 잔액
  spouseIrpMonthlyContribution: number | null;
  spouseIrpStartAge: number | null;
  spouseIrpReceivingYears: number | null;

  // ISA - 배우자
  spouseIsaBalance: number | null; // 배우자 ISA 잔액
  spouseIsaMonthlyContribution: number | null; // 배우자 ISA 월 납입액
  spouseIsaMaturityYear: number | null; // 배우자 ISA 만기 연도
  spouseIsaMaturityMonth: number | null; // 배우자 ISA 만기 월
  spouseIsaMaturityStrategy: "pension_savings" | "irp" | "cash" | null;

  // 현금 흐름 분배 규칙
  cashFlowRules: CashFlowRule[];

  // 기존 배열 (추후 상세 입력용, 현재 미사용)
  incomes: AssetInput[];
  expenses: AssetInput[];
  realEstates: AssetInput[];
  assets: AssetInput[];
  pensions: AssetInput[];
}

// 자산 입력 폼
export interface AssetInput {
  name: string;
  amount: number | null; // null = 미입력, 0 = 0 입력함
  frequency: Frequency;
  subcategory?: string; // 분류 (근로소득, 사업소득, 기타소득 등)
  start_date?: string;
  end_date?: string;
  notes?: string;
}

// 부채 연동 출처 타입
export type DebtSourceType =
  | "physicalAsset"
  | "housing"
  | "realEstate"
  | "manual"
  | "credit"
  | "other";

// 금리 타입
export type RateType = "fixed" | "floating";

// 부채 입력 폼 (대출 상세 정보 포함)
export interface DebtInput {
  id: string; // 고유 ID
  name: string;
  amount: number | null; // 대출 금액
  rate: number | null; // 금리 (%) - 고정금리일 때 사용
  rateType?: RateType; // 금리 타입: 고정(fixed) / 변동(floating)
  spread?: number; // 스프레드 (%) - 변동금리일 때: 기준금리 + 스프레드
  maturity: string | null; // 만기 (YYYY-MM)
  repaymentType:
    | "만기일시상환"
    | "원리금균등상환"
    | "원금균등상환"
    | "거치식상환"
    | null;
  // 연동 정보 (다른 탭에서 생성된 경우)
  sourceType?: DebtSourceType;
  sourceId?: string; // 원본 항목 ID (physicalAsset.id 등)
}

// 스코어 타입
export interface Scores {
  overall: number;
  income: number;
  expense: number;
  asset: number;
  debt: number;
  pension: number;
}

// 대시보드 요약 데이터
export interface DashboardSummary {
  totalAssets: number;
  totalDebts: number;
  netWorth: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySavings: number;
  scores: Scores;
}

// 은퇴 시뮬레이션 데이터 포인트
export interface SimulationDataPoint {
  age: number;
  year: number;
  assets: number;
  income: number;
  expense: number;
}

// 차트 데이터
export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    fill?: boolean;
  }[];
}

// ============================================
// 새로운 시뮬레이션 기반 데이터 구조
// ============================================

// ============================================
// Investment Assumptions (투자 가정)
// ============================================

import type { HistoricalIndex } from "../lib/data/historicalRates";

export type SimulationAssumptionsMode = "fixed" | "historical" | "advanced";

export interface SimulationRates {
  savings: number; // 예금/적금 이율 (%)
  investment: number; // 투자 수익률 (%)
  pension: number; // 연금 수익률 (%)
  realEstate: number; // 부동산 상승률 (%)
  inflation: number; // 물가 상승률 (%)
  incomeGrowth?: number; // 소득 상승률 (%)
  baseRate?: number; // 기준금리 (%) - 변동금리 대출에 사용
  debtDefault?: number; // 부채 기본이자 (%) - 이자율 미입력 시 폴백
}

export interface HistoricalRateConfig {
  indexMapping: Record<keyof SimulationRates, HistoricalIndex>;
  startOffset: number;
}

export interface SimulationAssumptions {
  mode: SimulationAssumptionsMode;
  rates: SimulationRates;
  historicalConfig?: HistoricalRateConfig;
}

export const DEFAULT_SIMULATION_ASSUMPTIONS: SimulationAssumptions = {
  mode: "fixed",
  rates: {
    savings: 3.0,
    investment: 7.0,
    pension: 5.0,
    realEstate: 3.0,
    inflation: 2.5,
    incomeGrowth: 3.0,
    baseRate: 3.5,
    debtDefault: 3.5,
  },
};

// ============================================
// Cash Flow Priorities (현금흐름 우선순위) V2
// ============================================

export type CashFlowAccountCategory = "savings" | "pension" | "debt";

// 잉여금 배분 모드
export type SurplusAllocationMode = "allocate" | "maintain_balance";

// 잉여금 배분 규칙 (특정 계좌 단위)
export interface SurplusAllocationRule {
  id: string;
  targetId: string; // DB row ID (savings.id, pensions.id, debts.id)
  targetCategory: CashFlowAccountCategory;
  targetName: string; // UI 표시용
  priority: number; // 낮을수록 먼저 (1, 2, 3...)
  mode: SurplusAllocationMode; // 적립 or 잔액유지

  // 적립 모드 (allocate)
  annualLimit?: number; // 연간 최대 한도 (만원). undefined = 나머지 전부

  // 잔액 유지 모드 (maintain_balance)
  targetBalance?: number; // 목표 잔액 (만원). 이 금액 이하면 채움

  // 기간 설정 (optional - 미설정 시 항상 적용)
  startYear?: number;
  startMonth?: number; // 1-12
  endYear?: number;
  endMonth?: number; // 1-12
}

// 인출 순서 규칙 (특정 계좌 단위)
export interface WithdrawalOrderRule {
  id: string;
  targetId: string;
  targetCategory: CashFlowAccountCategory;
  targetName: string;
  priority: number;
}

// 최상위 구조 (simulations.cash_flow_priorities JSONB에 저장)
export interface CashFlowPriorities {
  surplusRules: SurplusAllocationRule[];
  withdrawalRules: WithdrawalOrderRule[];
  _initialized?: boolean;
}

// 하위 호환 헬퍼 (레거시 CashFlowPriority[] → CashFlowPriorities 변환)
export function normalizePriorities(raw: unknown): CashFlowPriorities {
  if (!raw) return { surplusRules: [], withdrawalRules: [] };
  if (Array.isArray(raw)) return { surplusRules: [], withdrawalRules: [] }; // 레거시 → 빈 값
  return raw as CashFlowPriorities;
}

// ============================================
// 시뮬레이션 (시나리오)
// ============================================

export interface LifeCycleSettings {
  selfRetirementAge: number;
  selfLifeExpectancy: number;
  spouseRetirementAge?: number;
  spouseLifeExpectancy?: number;
  retirementIcon?: string;
  retirementColor?: string;
  lifeExpectancyIcon?: string;
  lifeExpectancyColor?: string;
  spouseRetirementIcon?: string;
  spouseRetirementColor?: string;
  spouseLifeExpectancyIcon?: string;
  spouseLifeExpectancyColor?: string;
}

export interface SimFamilyMember {
  id: string;
  relationship: "spouse" | "child" | "parent" | string;
  name: string;
  birth_date: string | null;
  gender: "male" | "female" | null;
  is_dependent: boolean;
  is_working: boolean;
  retirement_age: number | null;
  monthly_income: number | null;
  icon?: string;
  iconColor?: string;
}

export interface Simulation {
  id: string;
  profile_id: string;
  title: string;
  description?: string;
  icon?: string;
  is_default: boolean;
  sort_order: number;
  // 새 필드
  simulation_assumptions?: SimulationAssumptions;
  cash_flow_priorities?: CashFlowPriorities;
  life_cycle_settings?: LifeCycleSettings;
  family_config?: SimFamilyMember[];
  start_year?: number | null;
  start_month?: number | null;
  created_at: string;
  updated_at: string;
}

// 재무 항목 카테고리
export type FinancialCategory =
  | "income"
  | "expense"
  | "savings"
  | "pension"
  | "asset"
  | "debt"
  | "real_estate";

// 소유자 타입
export type OwnerType = "self" | "spouse" | "child" | "common";

// 재무 항목 타입 (카테고리별)
export type IncomeType =
  | "labor"
  | "business"
  | "side_income"
  | "rental"
  | "dividend"
  | "pension"
  | "regular"
  | "onetime"
  | "other";
export type ExpenseType =
  | "living"
  | "housing"
  | "maintenance"
  | "education"
  | "child"
  | "insurance"
  | "transport"
  | "health"
  | "travel"
  | "parents"
  | "wedding"
  | "leisure"
  | "other";
export type SavingsType =
  | "emergency_fund"
  | "savings_account"
  | "stock"
  | "fund"
  | "crypto"
  | "other";
export type PensionType =
  | "national"
  | "retirement"
  | "personal"
  | "irp"
  | "severance";
export type AssetType =
  | "deposit"
  | "stock"
  | "fund"
  | "bond"
  | "crypto"
  | "vehicle"
  | "other";
export type DebtType =
  | "mortgage"
  | "credit_loan"
  | "student_loan"
  | "car_loan"
  | "credit_card"
  | "other";
export type RealEstateType = "residence" | "investment" | "land" | "other";

export type FinancialItemType =
  | IncomeType
  | ExpenseType
  | SavingsType
  | PensionType
  | AssetType
  | DebtType
  | RealEstateType;

// ============================================
// 카테고리별 상세 데이터 (JSONB)
// ============================================

// 소득 데이터
export interface IncomeData {
  amount: number; // 금액 (만원)
  frequency: "monthly" | "yearly"; // 지급 주기
  growthRate: number; // 연간 증가율 (%)
  rateCategory?: RateCategory; // 상승률 카테고리 (시나리오 모드용)
}

// 지출 데이터
export interface ExpenseData {
  amount: number; // 금액 (만원)
  frequency: "monthly" | "yearly"; // 지출 주기
  growthRate: number; // 연간 증가율 (%, 보통 물가 상승률)
  rateCategory?: RateCategory; // 상승률 카테고리 (시나리오 모드용)
}

// 저축 데이터
export interface SavingsData {
  currentBalance: number; // 현재 잔액 (만원)
  monthlyContribution?: number; // 월 납입액 (만원)
  interestRate?: number; // 이자율/수익률 (%)
  targetAmount?: number; // 목표 금액 (만원)
  // 원본 타입 저장 (DB 타입과 다를 수 있음)
  originalSavingsType?: SavingsAccountType; // 저축 계좌 원본 타입
  originalInvestmentType?: InvestmentAccountType; // 투자 계좌 원본 타입
}

// 연금 데이터 (유형별로 다른 필드 사용)
export interface PensionData {
  // 국민연금
  expectedMonthlyAmount?: number; // 예상 월 수령액 (만원)
  paymentStartAge?: number; // 수령 시작 나이

  // 퇴직연금/퇴직금
  currentBalance?: number; // 현재 잔액 (만원)
  pensionType?: "DB" | "DC" | "corporate_irp" | "severance";
  yearsOfService?: number; // 근속연수 (DB형에서 사용)
  receiveType?: "lump_sum" | "annuity"; // 수령 방식 (일시금/연금)
  receivingYears?: number; // 수령 기간 (년, 연금 수령 시)

  // 개인연금 (연금저축, IRP)
  monthlyContribution?: number; // 월 납입액 (만원)
  returnRate?: number; // 예상 수익률 (%)
  paymentStartYear?: number; // 수령 시작 연도
  paymentStartMonth?: number; // 수령 시작 월 (1-12)
  paymentYears?: number; // 수령 기간 (년)
}

// 자산 데이터
export interface AssetData {
  currentValue: number; // 현재 가치 (만원)
  purchasePrice?: number; // 매입가 (만원)
  appreciationRate?: number; // 연간 상승률 (%)
  interestRate?: number; // 이자율 (예금 등)
  // 원본 타입 저장 (DB 타입과 다를 수 있음)
  originalAssetType?: PhysicalAssetType;
  // 금융 정보 (대출/할부)
  financingType?: AssetFinancingType;
  loanAmount?: number; // 대출/할부 금액 (만원)
  loanRate?: number; // 금리 (%)
  loanMaturity?: string; // 만기 (YYYY-MM)
  loanRepaymentType?: AssetLoanRepaymentType;
}

// 부채 데이터
export interface DebtData {
  principal: number; // 원금 (만원)
  currentBalance?: number; // 현재 잔액 (만원)
  interestRate: number; // 금리 (%) - 고정금리 또는 현재 실효금리
  rateType?: RateType; // 금리 타입: 고정(fixed) / 변동(floating)
  spread?: number; // 스프레드 (%) - 변동금리일 때: 기준금리 + 스프레드
  repaymentType:
    | "만기일시상환"
    | "원리금균등상환"
    | "원금균등상환"
    | "거치식상환";
  monthlyPayment?: number; // 월 상환액 (만원)
}

// 부동산 데이터
export interface RealEstateData {
  currentValue: number; // 현재 시세 (만원)
  purchasePrice?: number; // 매입가 (만원)
  appreciationRate?: number; // 연간 상승률 (%)

  // 거주용
  housingType?: "자가" | "전세" | "월세" | "무상";
  deposit?: number; // 보증금 (만원)
  monthlyRent?: number; // 월세 (만원)

  // 대출 정보
  hasLoan?: boolean;
  loanAmount?: number; // 대출금액 (만원)
  loanRate?: number; // 대출 금리 (%)
  loanMaturityYear?: number; // 대출 만기 연도
  loanMaturityMonth?: number; // 대출 만기 월
  loanRepaymentType?:
    | "만기일시상환"
    | "원리금균등상환"
    | "원금균등상환"
    | "거치식상환";

  // 원본 타입 저장 (DB 타입과 다를 수 있음)
  originalUsageType?: RealEstateUsageType;
}

// 통합 데이터 타입
export type FinancialItemData =
  | IncomeData
  | ExpenseData
  | SavingsData
  | PensionData
  | AssetData
  | DebtData
  | RealEstateData;

// ============================================
// 재무 항목 (통합 테이블)
// ============================================

export interface FinancialItem {
  id: string;
  simulation_id: string;

  // 분류
  category: FinancialCategory;
  type: FinancialItemType;

  // 기본 정보
  title: string;
  owner: OwnerType;
  memo?: string;

  // 시간 범위 (월별 계산 기반)
  start_year?: number;
  start_month?: number;
  end_year?: number;
  end_month?: number;
  is_fixed_to_retirement_year: boolean;

  // 카테고리별 상세 데이터
  data: FinancialItemData;

  // 연동 항목 (부동산 대출 ↔ 부채)
  linked_item_id?: string;

  // 메타
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 재무 항목 생성 입력
export interface FinancialItemInput {
  simulation_id: string;
  category: FinancialCategory;
  type: FinancialItemType;
  title: string;
  owner?: OwnerType;
  memo?: string;
  start_year?: number;
  start_month?: number;
  end_year?: number;
  end_month?: number;
  is_fixed_to_retirement_year?: boolean;
  data: FinancialItemData;
  linked_item_id?: string;
  sort_order?: number;
}

// 시뮬레이션 생성 입력
export interface SimulationInput {
  profile_id: string;
  title: string;
  description?: string;
  icon?: string;
  is_default?: boolean;
  sort_order?: number;
  // 새 필드
  simulation_assumptions?: SimulationAssumptions;
  cash_flow_priorities?: CashFlowPriorities;
  life_cycle_settings?: LifeCycleSettings;
  family_config?: SimFamilyMember[];
  start_year?: number | null;
  start_month?: number | null;
}

// ============================================
// 현금 흐름 분배 규칙
// ============================================

export type CashFlowAccountType =
  | "pension_savings" // 연금저축
  | "irp" // IRP
  | "isa" // ISA
  | "savings" // 정기예금/적금
  | "investment" // 투자 (주식/펀드 등)
  | "checking"; // 입출금통장 (기본값, 나머지)

export interface CashFlowRule {
  id: string;
  accountType: CashFlowAccountType;
  name: string; // 표시 이름
  priority: number; // 우선순위 (1이 가장 높음)
  allocationType: "fixed" | "percentage" | "remainder";
  monthlyAmount?: number; // 월 납입액 (fixed일 때, 만원 단위)
  percentage?: number; // 비율 (percentage일 때)
  annualLimit?: number; // 연간 한도 (만원 단위)
  isEnabled: boolean;
}

export const DEFAULT_CASH_FLOW_RULES: CashFlowRule[] = [
  {
    id: "1",
    accountType: "pension_savings",
    name: "연금저축",
    priority: 1,
    allocationType: "fixed",
    monthlyAmount: 50,
    annualLimit: 600,
    isEnabled: true,
  },
  {
    id: "2",
    accountType: "irp",
    name: "IRP",
    priority: 2,
    allocationType: "fixed",
    monthlyAmount: 25,
    annualLimit: 300,
    isEnabled: true,
  },
  {
    id: "3",
    accountType: "isa",
    name: "ISA",
    priority: 3,
    allocationType: "fixed",
    monthlyAmount: 167,
    annualLimit: 2000,
    isEnabled: true,
  },
  {
    id: "4",
    accountType: "savings",
    name: "비상금",
    priority: 4,
    allocationType: "fixed",
    monthlyAmount: 50,
    isEnabled: true,
  },
  {
    id: "5",
    accountType: "checking",
    name: "입출금통장",
    priority: 99,
    allocationType: "remainder",
    isEnabled: true,
  },
];

// ============================================
// 월별 시뮬레이션 계산용 타입
// ============================================

// 월별 현금흐름
export interface MonthlyCashFlow {
  year: number;
  month: number;
  incomes: { item: FinancialItem; amount: number }[];
  expenses: { item: FinancialItem; amount: number }[];
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
}

// 월별 자산 상태
export interface MonthlyAssetState {
  year: number;
  month: number;
  assets: { item: FinancialItem; value: number }[];
  debts: { item: FinancialItem; balance: number }[];
  realEstates: { item: FinancialItem; value: number; loanBalance: number }[];
  savings: { item: FinancialItem; balance: number }[];
  pensions: { item: FinancialItem; value: number }[];
  totalAssets: number;
  totalDebts: number;
  netWorth: number;
}

// 시뮬레이션 결과 (전체 타임라인)
export interface SimulationResult {
  simulation: Simulation;
  timeline: {
    year: number;
    month: number;
    cashFlow: MonthlyCashFlow;
    assetState: MonthlyAssetState;
  }[];
}

// 월별 스냅샷
export interface MonthlySnapshot {
  id: string;
  user_id: string;
  year_month: string;
  total_income: number;
  total_expense: number;
  monthly_savings: number;
  total_real_estate: number;
  total_assets: number;
  total_pension: number;
  total_debts: number;
  net_worth: number;
  score_overall: number;
  score_income: number;
  score_expense: number;
  score_asset: number;
  score_debt: number;
  score_pension: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// 나이대별 의료비 기본값 (인당 연간 만원 단위, 현재 화폐가치)
// ============================================

// 나이대별 연간 의료비 (현재 화폐가치 기준, 물가상승률로 미래 조정)
// 출처: 건강보험통계연보, 국민건강보험공단
export const MEDICAL_EXPENSE_BY_AGE: Record<number, number> = {
  0: 60, // 0~59세: 연 60만원
  60: 180, // 60~69세: 연 180만원
  70: 350, // 70~79세: 연 350만원
  80: 780, // 80~89세: 연 780만원
  90: 950, // 90~100세: 연 950만원
};

// 나이대별 교육비 (만원/월, 사교육 포함 평균)
export const EDUCATION_EXPENSE_BY_AGE: Record<number, { label: string; amount: number }> = {
  3: { label: '유치원', amount: 40 },
  6: { label: '초등학교', amount: 50 },
  12: { label: '중학교', amount: 70 },
  15: { label: '고등학교', amount: 90 },
  18: { label: '대학교', amount: 120 },
};

export const EDUCATION_EXPENSE_INFO = `한국 평균 사교육비 포함 교육비 (통계청, 교육부 자료 기반)

- 유치원 (3~5세): 월 40만원
- 초등학교 (6~11세): 월 50만원
- 중학교 (12~14세): 월 70만원
- 고등학교 (15~17세): 월 90만원
- 대학교 (18~21세): 월 120만원

※ 지역, 학교 유형, 사교육 규모에 따라 크게 다를 수 있습니다.`;

// 나이에 해당하는 연간 의료비 반환
export function getMedicalExpenseByAge(age: number): number {
  if (age >= 90) return 950;

  const ageKeys = Object.keys(MEDICAL_EXPENSE_BY_AGE)
    .map(Number)
    .sort((a, b) => a - b);

  for (let i = ageKeys.length - 1; i >= 0; i--) {
    if (age >= ageKeys[i]) {
      return MEDICAL_EXPENSE_BY_AGE[ageKeys[i]];
    }
  }

  return 60; // 기본값
}

// 의료비 안내 메시지
export const MEDICAL_EXPENSE_INFO = `대한민국 나이대별 인당 연간 의료비 (현재 화폐가치 기준, 건강보험통계연보)

- 0~59세: 연 60만원
- 60~69세: 연 180만원
- 70~79세: 연 350만원
- 80~89세: 연 780만원
- 90~100세: 연 950만원

물가상승률이 자동 적용되어 미래 시점의 실제 비용으로 계산됩니다.

※ 개인 건강 상태에 따라 실제 비용은 크게 다를 수 있습니다.`;
