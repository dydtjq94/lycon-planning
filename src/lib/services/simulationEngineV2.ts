/**
 * Simulation Engine V2
 * - DB 타입 직접 사용 (dbToFinancialItems 우회, 필드 손실 방지)
 * - 항목별 개별 State 추적
 * - 연도 루프 안에 월별 서브루프
 * - currentCash로 잉여/적자 누적
 * - YearlySnapshot 100% 호환 출력
 */

import type {
  Income,
  Expense,
  Savings,
  Debt,
  NationalPension,
  RetirementPension,
  PersonalPension,
  RealEstate,
  PhysicalAsset,
} from "@/types/tables";

import type {
  SimulationAssumptions,
  CashFlowPriorities,
  SimulationRates,
  CashFlowItem,
} from "@/types";

import {
  DEFAULT_SIMULATION_ASSUMPTIONS,
} from "@/types";
import type {
  YearlySnapshot,
  MonthlySnapshot,
  SimulationResult,
  SimulationProfile,
} from "./simulationTypes";
import { getDefaultRateCategory } from "../utils";
import { getEffectiveDebtRate } from "../utils/loanCalculator";
import {
  calculateInterestIncomeTax,
  calculateCapitalGainsTax,
  calculateISATax,
} from "../utils/taxCalculator";
import {
  HISTORICAL_RATES,
  type HistoricalIndex,
} from "../data/historicalRates";

// ============================================
// 내부 State 타입
// ============================================

interface SavingsItemState {
  id: string;
  title: string;
  owner: string;
  type: string;
  balance: number;
  totalPrincipal: number;
  monthlyContribution: number | null;
  contributionStartYear: number | null;
  contributionStartMonth: number | null;
  contributionEndYear: number | null;
  contributionEndMonth: number | null;
  isContributionFixedToRetirement: boolean;
  interestRate: number | null;
  expectedReturn: number | null;
  maturityYear: number | null;
  maturityMonth: number | null;
  isTaxFree: boolean;
  isMatured: boolean;
  isActive: boolean;
  deferredBalance: number;  // 시작 시점 이전 계좌의 이연 잔액
  isVirtual?: boolean;
}

interface PensionItemState {
  id: string;
  title: string;
  owner: string;
  category: "national" | "retirement" | "personal";
  pensionSubType: string;
  balance: number;
  totalPrincipal: number;
  monthlyContribution: number | null;
  contributionStartYear: number | null;
  contributionStartMonth: number | null;
  contributionEndYear: number | null;
  contributionEndMonth: number | null;
  isContributionFixedToRetirement: boolean;
  returnRate: number;
  // 국민연금
  expectedMonthlyAmount?: number;
  startAge?: number;
  endAge?: number | null;
  // 퇴직/개인
  receiveType?: string;
  receivingYears?: number | null;
  startAgeForReceiving?: number | null;
  // ISA
  isaMaturityYear?: number | null;
  isaMaturityMonth?: number | null;
  isaMaturityStrategy?: string | null;
  // 퇴직금/DB
  yearsOfService?: number | null;
  pensionType?: string;
  monthlySalary?: number | null;
  calculationMode?: 'auto' | 'manual';
  // 상태
  isReceiving: boolean;
  isMatured: boolean;
}

interface DebtItemState {
  id: string;
  title: string;
  type: string;
  sourceType: string | null;
  originalPrincipal: number;
  currentBalance: number;
  interestRate: number;
  rateType: string;
  spread: number | null;
  repaymentType: string;
  startYear: number;
  startMonth: number;
  maturityYear: number;
  maturityMonth: number;
  gracePeriodMonths: number;
  monthlyPayment: number;
  isPaidOff: boolean;
}

interface RealEstateItemState {
  id: string;
  title: string;
  owner: string;
  type: string;
  currentValue: number;
  purchasePrice: number;
  purchaseYear: number | null;
  purchaseMonth: number | null;
  growthRate: number;
  rateCategory: string;
  housingType: string | null;
  sellYear: number | null;
  sellMonth: number | null;
  isSold: boolean;
  deposit: number | null;
  monthlyRent: number | null;
  maintenanceFee: number | null;
  hasRentalIncome: boolean;
  rentalMonthly: number | null;
  rentalStartYear: number | null;
  rentalStartMonth: number | null;
  rentalEndYear: number | null;
  rentalEndMonth: number | null;
  hasLoan: boolean;
  loanAmount: number | null;
  loanRate: number | null;
  loanRateType: string | null;
  loanSpread: number | null;
  loanStartYear: number | null;
  loanStartMonth: number | null;
  loanMaturityYear: number | null;
  loanMaturityMonth: number | null;
  loanRepaymentType: string | null;
  loanGraceEndYear: number | null;
  loanGraceEndMonth: number | null;
  loanBalance: number;
  includeInCashflow: boolean;
  isPurchased: boolean;
}

interface PhysicalAssetItemState {
  id: string;
  title: string;
  owner: string;
  type: string;
  currentValue: number;
  purchasePrice: number;
  annualRate: number;
  rateCategory: string;
  sellYear: number | null;
  sellMonth: number | null;
  isSold: boolean;
  // 대출 필드
  hasLoan: boolean;
  loanAmount: number | null;
  loanRate: number | null;
  loanStartYear: number | null;
  loanStartMonth: number | null;
  loanMaturityYear: number | null;
  loanMaturityMonth: number | null;
  loanRepaymentType: string | null;
  loanBalance: number;
  purchaseYear: number | null;
  purchaseMonth: number | null;
  includeInCashflow: boolean;
  isPurchased: boolean;
}

interface SimulationState {
  currentCash: number;
  savings: SavingsItemState[];
  pensions: PensionItemState[];
  debts: DebtItemState[];
  realEstates: RealEstateItemState[];
  physicalAssets: PhysicalAssetItemState[];
}

// ============================================
// 입력 타입
// ============================================

export interface SimulationV2Input {
  incomes: Income[];
  expenses: Expense[];
  savings: Savings[];
  debts: Debt[];
  nationalPensions: NationalPension[];
  retirementPensions: RetirementPension[];
  personalPensions: PersonalPension[];
  realEstates: RealEstate[];
  physicalAssets: PhysicalAsset[];
}

// ============================================
// 헬퍼 함수
// ============================================

const ownerLabels: Record<string, string> = {
  self: "본인",
  spouse: "배우자",
  child: "자녀",
  common: "공동",
};

const incomeTypeLabels: Record<string, string> = {
  labor: "근로소득",
  business: "사업소득",
  rental: "임대소득",
  pension: "연금소득",
  dividend: "배당소득",
  side: "부업소득",
  other: "기타소득",
};

function getSavingsAssetCategory(savingsType: string): string {
  switch (savingsType) {
    case "checking":
    case "savings":
    case "deposit":
    case "housing":
      return "savings";
    case "domestic_stock":
    case "foreign_stock":
    case "fund":
    case "bond":
    case "crypto":
    case "other":
      return "investment";
    default:
      return "savings";
  }
}

function getDebtAssetCategory(debtType: string): string {
  switch (debtType) {
    case "mortgage":
      return "mortgage";
    case "jeonse":
      return "jeonse";
    case "credit":
    case "card":
      return "credit";
    case "car":
      return "car";
    case "student":
      return "student";
    default:
      return "other_debt";
  }
}

function getOwnerBirthYear(owner: string, profile: SimulationProfile): number {
  if (owner === "spouse" && profile.spouseBirthYear)
    return profile.spouseBirthYear;
  return profile.birthYear;
}

function getRetirementYear(owner: string, profile: SimulationProfile): number {
  if (
    owner === "spouse" &&
    profile.spouseBirthYear &&
    profile.spouseRetirementAge
  ) {
    return profile.spouseBirthYear + profile.spouseRetirementAge;
  }
  return profile.birthYear + profile.retirementAge;
}

/**
 * 은퇴 시점을 { year, month } 로 반환.
 * "은퇴 나이가 되는 생일 달의 직전 달"이 마지막 근로 달.
 * 예) 4월생 65세 은퇴 → 2059년 3월이 마지막 근로 달.
 *     1월생 65세 은퇴 → 전년도 12월이 마지막 근로 달.
 */
function getRetirementYearMonth(
  owner: string,
  profile: SimulationProfile,
): { year: number; month: number } {
  if (
    owner === "spouse" &&
    profile.spouseBirthYear &&
    profile.spouseRetirementAge
  ) {
    const retYear = profile.spouseBirthYear + profile.spouseRetirementAge;
    const bm = profile.spouseBirthMonth || 1;
    if (bm === 1) return { year: retYear - 1, month: 12 };
    return { year: retYear, month: bm - 1 };
  }
  const retYear = profile.birthYear + profile.retirementAge;
  const bm = profile.birthMonth || 1;
  if (bm === 1) return { year: retYear - 1, month: 12 };
  return { year: retYear, month: bm - 1 };
}

function isInPeriod(
  year: number,
  month: number,
  startYear: number | null,
  startMonth: number | null,
  endYear: number | null,
  endMonth: number | null,
): boolean {
  const sy = startYear ?? 0;
  const sm = startMonth ?? 1;
  const ey = endYear ?? 9999;
  const em = endMonth ?? 12;

  const current = year * 12 + month;
  const start = sy * 12 + sm;
  const end = ey * 12 + em;

  return current >= start && current <= end;
}

function isSavingsType(type: string): boolean {
  return ["checking", "savings", "deposit", "housing"].includes(type);
}

function isInvestmentType(type: string): boolean {
  return [
    "domestic_stock",
    "foreign_stock",
    "fund",
    "bond",
    "crypto",
    "other",
  ].includes(type);
}

/** 월 상환액(PMT) 계산 */
function calculatePMT(
  principal: number,
  monthlyRate: number,
  totalMonths: number,
): number {
  if (totalMonths <= 0) return 0;
  if (monthlyRate === 0) return principal / totalMonths;
  return (
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
    (Math.pow(1 + monthlyRate, totalMonths) - 1)
  );
}

function getRateForYear(
  rateKey: keyof SimulationRates,
  year: number,
  startYear: number,
  assumptions: SimulationAssumptions,
): number {
  if (assumptions.mode !== "historical" || !assumptions.historicalConfig) {
    return assumptions.rates[rateKey] ?? 0;
  }
  const config = assumptions.historicalConfig;
  const index: HistoricalIndex = config.indexMapping[rateKey];
  const dataset = HISTORICAL_RATES[index];
  if (!dataset || dataset.length === 0) return assumptions.rates[rateKey] ?? 0;
  const yearsSinceStart = year - startYear;
  const dataIndex = (config.startOffset + yearsSinceStart) % dataset.length;
  return dataset[dataIndex].rate;
}

// ============================================
// 시뮬레이션 시작 전 경과 개월에 대한 잔액 보정
// ============================================

function adjustBalanceForElapsed(
  principal: number,
  annualRate: number,
  repaymentType: string,
  startYear: number,
  startMonth: number,
  maturityYear: number,
  maturityMonth: number,
  simStartYear: number,
  simStartMonth: number,
  gracePeriodMonths: number = 0,
): number {
  const totalMonths = (maturityYear - startYear) * 12 + (maturityMonth - startMonth);
  const elapsedMonths = Math.max(0, (simStartYear - startYear) * 12 + (simStartMonth - startMonth));
  if (totalMonths <= 0 || elapsedMonths <= 0) return principal;
  if (elapsedMonths >= totalMonths) return 0;

  const monthlyRate = (annualRate || 0) / 100 / 12;

  switch (repaymentType) {
    case "만기일시상환":
      return principal;

    case "원금균등상환": {
      const paid = (principal / totalMonths) * elapsedMonths;
      return Math.max(0, Math.round(principal - paid));
    }

    case "원리금균등상환": {
      if (monthlyRate === 0) {
        const paid = (principal / totalMonths) * elapsedMonths;
        return Math.max(0, Math.round(principal - paid));
      }
      const factor = Math.pow(1 + monthlyRate, totalMonths);
      const elapsedFactor = Math.pow(1 + monthlyRate, elapsedMonths);
      return Math.max(0, Math.round(principal * (factor - elapsedFactor) / (factor - 1)));
    }

    case "거치식상환": {
      const effectiveGrace = Math.min(gracePeriodMonths, totalMonths - 1);
      if (elapsedMonths <= effectiveGrace) return principal;
      const repayMonths = totalMonths - effectiveGrace;
      const elapsedAfterGrace = elapsedMonths - effectiveGrace;
      if (monthlyRate === 0) {
        const paid = (principal / repayMonths) * elapsedAfterGrace;
        return Math.max(0, Math.round(principal - paid));
      }
      const factor = Math.pow(1 + monthlyRate, repayMonths);
      const elapsedFactor = Math.pow(1 + monthlyRate, elapsedAfterGrace);
      return Math.max(0, Math.round(principal * (factor - elapsedFactor) / (factor - 1)));
    }

    default:
      return principal;
  }
}

// ============================================
// State 초기화
// ============================================

function initializeState(
  data: SimulationV2Input,
  profile: SimulationProfile,
  rates: SimulationRates,
  simStartYear?: number | null,
  simStartMonth?: number | null,
): SimulationState {
  const state: SimulationState = {
    currentCash: 0,
    savings: [],
    pensions: [],
    debts: [],
    realEstates: [],
    physicalAssets: [],
  };

  // 저축 초기화
  const simStartYM = (simStartYear || new Date().getFullYear()) * 12 + (simStartMonth || 1);
  for (const s of data.savings) {
    if (!s.is_active) continue;
    const accStartYear = s.contribution_start_year;
    const accStartMonth = s.contribution_start_month;
    const accStartYM = accStartYear != null ? (accStartYear * 12 + (accStartMonth || 1)) : 0;
    const startsLater = accStartYear != null && accStartYM > simStartYM;
    state.savings.push({
      id: s.id,
      title: s.title,
      owner: s.owner,
      type: s.type,
      balance: startsLater ? 0 : s.current_balance,
      totalPrincipal: startsLater ? 0 : s.current_balance,
      monthlyContribution: s.monthly_contribution,
      contributionStartYear: s.contribution_start_year,
      contributionStartMonth: s.contribution_start_month,
      contributionEndYear: s.contribution_end_year,
      contributionEndMonth: s.contribution_end_month,
      isContributionFixedToRetirement: s.is_contribution_fixed_to_retirement,
      interestRate: s.interest_rate,
      expectedReturn: s.expected_return,
      maturityYear: s.maturity_year,
      maturityMonth: s.maturity_month,
      isTaxFree: s.is_tax_free,
      isMatured: false,
      isActive: !startsLater,
      deferredBalance: startsLater ? s.current_balance : 0,
    });
  }

  // 유동 현금 항상 생성: 잉여금/부족분의 최종 수용처
  state.savings.push({
    id: '__default_checking__',
    title: '유동 현금',
    owner: 'self',
    type: 'checking',
    balance: 0,
    totalPrincipal: 0,
    monthlyContribution: null,
    contributionStartYear: null,
    contributionStartMonth: null,
    contributionEndYear: null,
    contributionEndMonth: null,
    isContributionFixedToRetirement: false,
    interestRate: null,
    expectedReturn: null,
    maturityYear: null,
    maturityMonth: null,
    isTaxFree: false,
    isMatured: false,
    isActive: true,
    deferredBalance: 0,
    isVirtual: true,
  });

  // 국민연금 초기화
  for (const p of data.nationalPensions) {
    if (!p.is_active) continue;
    state.pensions.push({
      id: p.id,
      title: p.owner === "spouse" ? "배우자 공적연금" : "공적연금",
      owner: p.owner,
      category: "national",
      pensionSubType: p.pension_type,
      balance: 0,
      totalPrincipal: 0,
      monthlyContribution: null,
      contributionStartYear: null,
      contributionStartMonth: null,
      contributionEndYear: null,
      contributionEndMonth: null,
      isContributionFixedToRetirement: false,
      returnRate: 0,
      expectedMonthlyAmount: p.expected_monthly_amount,
      startAge: p.start_age,
      endAge: p.end_age,
      isReceiving: false,
      isMatured: false,
    });
  }

  // 퇴직연금 초기화
  for (const p of data.retirementPensions) {
    if (!p.is_active) continue;
    const isDBSeverance = p.pension_type === 'db' || p.pension_type === 'severance';
    const calcMode = p.calculation_mode || 'auto';

    // DB/퇴직금 auto 모드: 퇴직 시점에 급여x근속으로 계산 → 초기 잔액 0
    // DB/퇴직금 manual 모드: 사용자가 입력한 예상 총액 사용
    // DC/기업IRP: 현재 잔액 기반
    let initialBalance: number;
    if (isDBSeverance && calcMode === 'auto') {
      initialBalance = 0; // 퇴직 시점에 계산
    } else {
      initialBalance = p.current_balance || 0;
    }

    // monthly_salary(DB에는 연봉으로 저장)를 월급여로 변환
    // 엔진 내부는 월급여 기준으로 동작
    let monthlySalary = (p.monthly_salary || 0) / 12;
    if (!monthlySalary) {
      const ownerLaborIncome = data.incomes.find(
        inc => inc.is_active && inc.owner === p.owner && inc.type === 'labor'
      );
      if (ownerLaborIncome) {
        monthlySalary = ownerLaborIncome.frequency === 'yearly'
          ? ownerLaborIncome.amount / 12
          : ownerLaborIncome.amount;
      }
    }

    state.pensions.push({
      id: p.id,
      title: p.owner === "spouse" ? "배우자 퇴직연금" : "퇴직연금",
      owner: p.owner,
      category: "retirement",
      pensionSubType: p.pension_type,
      balance: initialBalance,
      totalPrincipal: initialBalance,
      monthlyContribution: null,
      contributionStartYear: null,
      contributionStartMonth: null,
      contributionEndYear: null,
      contributionEndMonth: null,
      isContributionFixedToRetirement: false,
      returnRate: p.return_rate,
      receiveType: p.receive_type,
      receivingYears: p.receiving_years,
      startAgeForReceiving: p.start_age,
      yearsOfService: p.years_of_service,
      pensionType: p.pension_type,
      monthlySalary,
      calculationMode: calcMode,
      isReceiving: false,
      isMatured: false,
    });
  }

  // 개인연금 초기화
  for (const p of data.personalPensions) {
    if (!p.is_active) continue;
    state.pensions.push({
      id: p.id,
      title:
        p.title ||
        (p.pension_type === "irp"
          ? "IRP"
          : p.pension_type === "isa"
            ? "ISA"
            : "연금저축"),
      owner: p.owner,
      category: "personal",
      pensionSubType: p.pension_type,
      balance: p.current_balance,
      totalPrincipal: p.current_balance,
      monthlyContribution: p.monthly_contribution,
      contributionStartYear: p.contribution_start_year ?? null,
      contributionStartMonth: p.contribution_start_month ?? null,
      contributionEndYear: p.contribution_end_year,
      contributionEndMonth: p.contribution_end_month,
      isContributionFixedToRetirement: p.is_contribution_fixed_to_retirement,
      returnRate: p.return_rate,
      receivingYears: p.receiving_years,
      startAgeForReceiving: p.start_age,
      isaMaturityYear: p.isa_maturity_year,
      isaMaturityMonth: p.isa_maturity_month,
      isaMaturityStrategy: p.isa_maturity_strategy,
      isReceiving: false,
      isMatured: false,
    });
  }

  // 부채 초기화
  const sYear = simStartYear || new Date().getFullYear();
  const sMonth = simStartMonth || 1;

  for (const d of data.debts) {
    if (!d.is_active) continue;
    const effectiveRate = getEffectiveDebtRate(
      { rate: d.interest_rate, rateType: d.rate_type, spread: d.spread || 0 },
      rates,
    );
    const monthlyRate = effectiveRate / 100 / 12;
    const totalMonths =
      (d.maturity_year - d.start_year) * 12 +
      (d.maturity_month - d.start_month);

    // current_balance가 명시적으로 있으면 그대로 사용, 없으면 경과 보정
    const principal = d.current_balance || adjustBalanceForElapsed(
      d.principal,
      effectiveRate,
      d.repayment_type,
      d.start_year,
      d.start_month,
      d.maturity_year,
      d.maturity_month,
      sYear,
      sMonth,
      d.grace_period_months,
    );
    const alreadyPaidOff = principal <= 0;

    let monthlyPayment = 0;
    if (!alreadyPaidOff) {
      switch (d.repayment_type) {
        case "만기일시상환":
          monthlyPayment = principal * monthlyRate;
          break;
        case "원리금균등상환":
          monthlyPayment = calculatePMT(principal, monthlyRate, totalMonths);
          break;
        case "원금균등상환":
          monthlyPayment = principal / totalMonths + principal * monthlyRate;
          break;
        case "거치식상환": {
          const repayMonths = Math.max(1, totalMonths - d.grace_period_months);
          monthlyPayment = calculatePMT(principal, monthlyRate, repayMonths);
          break;
        }
      }
    }

    state.debts.push({
      id: d.id,
      title: d.title,
      type: d.type,
      sourceType: d.source_type,
      originalPrincipal: d.principal,
      currentBalance: principal,
      interestRate: effectiveRate,
      rateType: d.rate_type,
      spread: d.spread,
      repaymentType: d.repayment_type,
      startYear: d.start_year,
      startMonth: d.start_month,
      maturityYear: d.maturity_year,
      maturityMonth: d.maturity_month,
      gracePeriodMonths: d.grace_period_months,
      monthlyPayment,
      isPaidOff: alreadyPaidOff,
    });
  }

  // 부동산 초기화
  for (const re of data.realEstates) {
    if (!re.is_active) continue;
    state.realEstates.push({
      id: re.id,
      title: re.title,
      owner: re.owner,
      type: re.type,
      currentValue: re.current_value,
      purchasePrice: re.purchase_price || re.current_value,
      purchaseYear: re.purchase_year,
      purchaseMonth: re.purchase_month,
      growthRate: re.growth_rate,
      rateCategory: re.rate_category || 'realEstate',
      housingType: re.housing_type,
      sellYear: re.sell_year,
      sellMonth: re.sell_month,
      isSold: false,
      deposit: re.deposit,
      monthlyRent: re.monthly_rent,
      maintenanceFee: re.maintenance_fee,
      hasRentalIncome: re.has_rental_income,
      rentalMonthly: re.rental_monthly,
      rentalStartYear: re.rental_start_year,
      rentalStartMonth: re.rental_start_month,
      rentalEndYear: re.rental_end_year,
      rentalEndMonth: re.rental_end_month,
      hasLoan: re.has_loan,
      loanAmount: re.loan_amount,
      loanRate: re.loan_rate,
      loanRateType: re.loan_rate_type,
      loanSpread: re.loan_spread,
      loanStartYear:
        re.loan_start_year || re.purchase_year || new Date().getFullYear(),
      loanStartMonth: re.loan_start_month || 1,
      loanMaturityYear:
        re.loan_maturity_year ||
        (re.loan_start_year || re.purchase_year || new Date().getFullYear()) +
          30,
      loanMaturityMonth: re.loan_maturity_month || 12,
      loanRepaymentType: re.loan_repayment_type || "원리금균등상환",
      loanGraceEndYear: re.grace_end_year,
      loanGraceEndMonth: re.grace_end_month,
      loanBalance: re.has_loan && re.loan_amount ? adjustBalanceForElapsed(
        re.loan_amount,
        getEffectiveDebtRate(
          { rate: re.loan_rate || 0, rateType: re.loan_rate_type || 'fixed', spread: re.loan_spread || 0 },
          rates,
        ),
        re.loan_repayment_type || "원리금균등상환",
        re.loan_start_year || re.purchase_year || sYear,
        re.loan_start_month || 1,
        re.loan_maturity_year || (re.loan_start_year || re.purchase_year || sYear) + 30,
        re.loan_maturity_month || 12,
        sYear,
        sMonth,
      ) : 0,
      includeInCashflow: re.include_in_cashflow ?? false,
      isPurchased: true,
    });

    // 시뮬레이션 시작 이후 취득이면 취득 전 상태로 전환
    const reState = state.realEstates[state.realEstates.length - 1];
    if (reState.purchaseYear) {
      const pMonth = reState.purchaseMonth || 1;
      const purchaseYM = reState.purchaseYear * 12 + pMonth;
      const startYM = sYear * 12 + sMonth;
      if (purchaseYM > startYM) {
        reState.isPurchased = false;
        reState.currentValue = 0;
      }
    }
  }

  // 실물자산 초기화
  for (const a of data.physicalAssets) {
    if (!a.is_active) continue;
    state.physicalAssets.push({
      id: a.id,
      title: a.title,
      owner: a.owner,
      type: a.type,
      currentValue: a.current_value,
      purchasePrice: a.purchase_price || a.current_value,
      annualRate: a.annual_rate,
      rateCategory: a.rate_category || "physicalAsset",
      sellYear: a.sell_year,
      sellMonth: a.sell_month,
      isSold: false,
      // 대출 필드
      hasLoan: a.has_loan,
      loanAmount: a.loan_amount,
      loanRate: a.loan_rate,
      loanStartYear: a.loan_start_year || new Date().getFullYear(),
      loanStartMonth: a.loan_start_month || 1,
      loanMaturityYear:
        a.loan_maturity_year ||
        (a.loan_start_year || new Date().getFullYear()) + 30,
      loanMaturityMonth: a.loan_maturity_month || 12,
      loanRepaymentType: a.loan_repayment_type || "원리금균등상환",
      loanBalance: a.has_loan && a.loan_amount ? adjustBalanceForElapsed(
        a.loan_amount,
        a.loan_rate || 0,
        a.loan_repayment_type || "원리금균등상환",
        a.loan_start_year || sYear,
        a.loan_start_month || 1,
        a.loan_maturity_year || (a.loan_start_year || sYear) + 30,
        a.loan_maturity_month || 12,
        sYear,
        sMonth,
      ) : 0,
      purchaseYear: a.purchase_year,
      purchaseMonth: a.purchase_month,
      includeInCashflow: a.include_in_cashflow ?? false,
      isPurchased: true,
    });

    // 시뮬레이션 시작 이후 취득이면 취득 전 상태로 전환
    const aState = state.physicalAssets[state.physicalAssets.length - 1];
    if (aState.includeInCashflow && aState.purchaseYear) {
      const pMonth = aState.purchaseMonth || 1;
      const sYear = simStartYear || new Date().getFullYear();
      const sMonth = simStartMonth || 1;
      const purchaseYM = aState.purchaseYear * 12 + pMonth;
      const startYM = sYear * 12 + sMonth;
      if (purchaseYM >= startYM) {
        aState.isPurchased = false;
        aState.currentValue = 0;
      }
    }
  }

  return state;
}

// ============================================
// 메인 엔진
// ============================================

export function runSimulationV2(
  data: SimulationV2Input,
  profile: SimulationProfile,
  yearsToSimulate: number = 50,
  assumptions?: SimulationAssumptions,
  priorities?: CashFlowPriorities,
  startYear?: number | null,
  startMonth?: number | null,
): SimulationResult {
  const currentYear = startYear || new Date().getFullYear();
  const simStartMonth = startMonth || 1;
  const { birthYear, retirementAge } = profile;
  const retirementYear = birthYear + retirementAge;
  const endYear = currentYear + yearsToSimulate;

  const effectiveAssumptions: SimulationAssumptions =
    assumptions || DEFAULT_SIMULATION_ASSUMPTIONS;

  // State 초기화
  const state = initializeState(data, profile, effectiveAssumptions.rates, currentYear, startMonth);

  const snapshots: YearlySnapshot[] = [];
  const monthlySnapshots: MonthlySnapshot[] = [];

  for (let year = currentYear; year <= endYear; year++) {
    const age = year - birthYear;
    const surplusAllocated = new Map<string, number>(); // 연간 배분 추적
    const yearsSinceStart = year - currentYear;
    const events: string[] = [];
    let yearlyTax = 0;
    let yearlyIncome = 0;
    let yearlyExpense = 0;

    // B6/B7 추적 배열
    const surplusInvestments: {
      title: string;
      amount: number;
      category: string;
      id: string;
    }[] = [];
    const deficitWithdrawals: {
      title: string;
      amount: number;
      category: string;
      id: string;
    }[] = [];
    const yearStartCash = state.currentCash;
    const yearStartDefaultChecking = state.savings.find(s => s.id === '__default_checking__' && s.isActive)?.balance || 0;
    const eventFlowItems: CashFlowItem[] = [];

    // 연도별 수익률 (히스토리컬이면 매년 다름)
    const savingsReturnPct = getRateForYear(
      "savings",
      year,
      currentYear,
      effectiveAssumptions,
    );
    const investmentReturnPct = getRateForYear(
      "investment",
      year,
      currentYear,
      effectiveAssumptions,
    );
    const pensionReturnPct = getRateForYear(
      "pension",
      year,
      currentYear,
      effectiveAssumptions,
    );
    const realEstateGrowthPct = getRateForYear(
      "realEstate",
      year,
      currentYear,
      effectiveAssumptions,
    );
    const inflationPct = getRateForYear(
      "inflation",
      year,
      currentYear,
      effectiveAssumptions,
    );
    const incomeGrowthPct = getRateForYear(
      "incomeGrowth",
      year,
      currentYear,
      effectiveAssumptions,
    );

    // rateCategory별 assumptions 비율 매핑
    const physicalAssetGrowthPct = getRateForYear(
      "physicalAsset",
      year,
      currentYear,
      effectiveAssumptions,
    );
    const assumptionRateByCategory: Record<string, number> = {
      income: incomeGrowthPct,
      inflation: inflationPct,
      investment: investmentReturnPct,
      realEstate: realEstateGrowthPct,
      physicalAsset: physicalAssetGrowthPct,
    };

    const incomeBreakdown: { title: string; amount: number; type?: string }[] =
      [];
    const expenseBreakdown: { title: string; amount: number; type?: string }[] =
      [];

    // 직접 계산 항목의 연간 합계 추적 (breakdown용)
    const debtPaymentTotals = new Map<string, number>();
    const pensionIncomeTotals = new Map<string, number>();
    const housingExpenseTotals = new Map<
      string,
      { title: string; amount: number }
    >();
    const rentalIncomeTotals = new Map<
      string,
      { title: string; amount: number }
    >();

    // 현금흐름 상세 추적
    const cashFlowItems: CashFlowItem[] = [];
    const savingsContribTotals = new Map<
      string,
      { title: string; amount: number; id: string }
    >();
    const pensionContribTotals = new Map<
      string,
      { title: string; amount: number; id: string; category: string }
    >();
    const debtInterestTotals = new Map<
      string,
      { title: string; amount: number; id: string }
    >();
    const debtPrincipalTotals = new Map<
      string,
      { title: string; amount: number; id: string }
    >();
    // 소득/지출 연간 합계 (월별 루프에서 누적 → B8 snapshot/cashFlowItems에 직접 사용)
    const yearlyIncomeAccum = new Map<
      string,
      { title: string; amount: number; type?: string }
    >();
    const yearlyExpenseAccum = new Map<
      string,
      { title: string; amount: number; type?: string }
    >();

    // ==============================
    // Phase A: 월별 현금흐름
    // ==============================
    const monthStart = (year === currentYear) ? simStartMonth : 1;
    for (let month = monthStart; month <= 12; month++) {
      // 월별 추적 변수
      let monthIncome = 0;
      let monthExpense = 0;
      const monthIncomeBreakdown: {
        title: string;
        amount: number;
        type?: string;
      }[] = [];
      const monthExpenseBreakdown: {
        title: string;
        amount: number;
        type?: string;
      }[] = [];
      const monthWithdrawals: {
        title: string;
        amount: number;
        category: string;
      }[] = [];
      const monthSurplus: {
        title: string;
        amount: number;
        category: string;
      }[] = [];

      // A0. 계좌 시작 시점 활성화 (시뮬레이션 시작 이후 개설 계좌)
      for (const saving of state.savings) {
        if (!saving.isActive && saving.deferredBalance > 0) {
          const accStartYM = (saving.contributionStartYear || 0) * 12 + (saving.contributionStartMonth || 1);
          const currentYM = year * 12 + month;
          if (currentYM >= accStartYM) {
            saving.isActive = true;
            saving.balance = saving.deferredBalance;
            saving.totalPrincipal = saving.deferredBalance;
            saving.deferredBalance = 0;
          }
        }
      }

      // A1. 월간 소득 (연금 연동 소득은 A10/A11에서 직접 계산)
      for (const income of data.incomes) {
        if (!income.is_active) continue;
        // 연금 연동 소득은 A10/A11에서 직접 계산하므로 건너뜀
        if (
          income.source_type === "national_pension" ||
          income.source_type === "retirement_pension" ||
          income.source_type === "personal_pension"
        )
          continue;

        // retirement_link에 따른 동적 종료년도 계산
        let endY = income.end_year;
        let endM = income.end_month;
        if (income.retirement_link === "self") {
          const ret = getRetirementYearMonth("self", profile);
          endY = ret.year;
          endM = ret.month;
        } else if (income.retirement_link === "spouse") {
          const ret = getRetirementYearMonth("spouse", profile);
          endY = ret.year;
          endM = ret.month;
        }

        if (
          !isInPeriod(
            year,
            month,
            income.start_year,
            income.start_month,
            endY,
            endM,
          )
        )
          continue;

        const rateCategory =
          income.rate_category || getDefaultRateCategory(income.type);
        const effectiveRate = rateCategory === 'fixed'
          ? (income.growth_rate ?? 0)
          : (assumptionRateByCategory[rateCategory] ?? income.growth_rate ?? 0);
        const monthlyRate = Math.pow(1 + effectiveRate / 100, 1 / 12) - 1;

        const monthsFromStart =
          (year - income.start_year) * 12 + (month - income.start_month);
        const baseAmount =
          income.frequency === "yearly" ? income.amount / 12 : income.amount;
        const amount =
          baseAmount * Math.pow(1 + monthlyRate, Math.max(0, monthsFromStart));

        state.currentCash += amount;
        yearlyIncome += amount;
        monthIncome += amount;
        monthIncomeBreakdown.push({
          title: income.title,
          amount,
          type: income.type,
        });

        // 연간 합계 누적 (B8에서 사용)
        const incAccum = yearlyIncomeAccum.get(income.id);
        if (incAccum) {
          incAccum.amount += amount;
        } else {
          const lbl = ownerLabels[income.owner] || "";
          const typeLbl = incomeTypeLabels[income.type] || income.type;
          const displayTitle = lbl ? `${typeLbl} | ${lbl}` : typeLbl;
          yearlyIncomeAccum.set(income.id, { title: displayTitle, amount, type: income.type });
        }
      }

      // A2. 월간 지출 (부채/부동산 연동 지출은 직접 계산)
      for (const expense of data.expenses) {
        if (!expense.is_active) continue;
        // 부채/부동산 연동 지출은 직접 계산하므로 건너뜀
        if (expense.source_type === "debt") continue;
        if (expense.source_type === "real_estate") continue;

        let endY = expense.end_year;
        let endM = expense.end_month;
        if (expense.retirement_link === "self") {
          const ret = getRetirementYearMonth("self", profile);
          endY = ret.year;
          endM = ret.month;
        } else if (expense.retirement_link === "spouse") {
          const ret = getRetirementYearMonth("spouse", profile);
          endY = ret.year;
          endM = ret.month;
        }

        if (
          !isInPeriod(
            year,
            month,
            expense.start_year,
            expense.start_month,
            endY,
            endM,
          )
        )
          continue;

        const rateCategory =
          expense.rate_category || getDefaultRateCategory(expense.type);
        const effectiveRate = rateCategory === 'fixed'
          ? (expense.growth_rate ?? 0)
          : (assumptionRateByCategory[rateCategory] ?? expense.growth_rate ?? 0);
        const monthlyRate = Math.pow(1 + effectiveRate / 100, 1 / 12) - 1;

        // amount_base_year가 있으면 기준년도부터 복리, 없으면 시작년도부터
        const growthBaseYear = expense.amount_base_year ?? expense.start_year;
        const growthBaseMonth = expense.amount_base_year ? 1 : expense.start_month;
        const monthsFromBase =
          (year - growthBaseYear) * 12 + (month - growthBaseMonth);
        // 일시금(start===end) 또는 1개월짜리는 yearly여도 전액 반영
        const isOneTimeExpense = expense.start_year === expense.end_year && expense.start_month === expense.end_month;
        const baseAmount =
          (expense.frequency === "yearly" && !isOneTimeExpense) ? expense.amount / 12 : expense.amount;
        const amount =
          baseAmount * Math.pow(1 + monthlyRate, Math.max(0, monthsFromBase));

        state.currentCash -= amount;
        yearlyExpense += amount;
        monthExpense += amount;
        monthExpenseBreakdown.push({
          title: expense.title,
          amount,
          type: expense.type,
        });

        // 연간 합계 누적 (B8에서 사용)
        const expAccum = yearlyExpenseAccum.get(expense.id);
        if (expAccum) {
          expAccum.amount += amount;
        } else {
          yearlyExpenseAccum.set(expense.id, { title: expense.title, amount, type: expense.type });
        }
      }

      // A3. 저축 월 납입금 처리
      for (const saving of state.savings) {
        if (saving.isMatured || !saving.isActive || !saving.monthlyContribution)
          continue;

        // 납입 기간 체크
        let contribEndYear = saving.contributionEndYear;
        let contribEndMonth = saving.contributionEndMonth;
        if (saving.isContributionFixedToRetirement) {
          contribEndYear = getRetirementYear(saving.owner, profile);
          contribEndMonth = 12;
        }

        const inContribPeriod = isInPeriod(
          year,
          month,
          saving.contributionStartYear,
          saving.contributionStartMonth,
          contribEndYear,
          contribEndMonth,
        );

        if (inContribPeriod) {
          state.currentCash -= saving.monthlyContribution;
          yearlyExpense += saving.monthlyContribution;
          saving.balance += saving.monthlyContribution;
          saving.totalPrincipal += saving.monthlyContribution;
          monthExpense += saving.monthlyContribution;
          monthExpenseBreakdown.push({
            title: `${saving.title} 납입`,
            amount: saving.monthlyContribution,
            type: "savings",
          });

          // 현금흐름 추적: 저축 적립
          const existingSavContrib = savingsContribTotals.get(saving.id);
          if (existingSavContrib) {
            existingSavContrib.amount += saving.monthlyContribution;
          } else {
            savingsContribTotals.set(saving.id, {
              title: saving.title,
              amount: saving.monthlyContribution,
              id: saving.id,
            });
          }
        }
      }

      // A4. 연금 월 납입금 처리
      for (const pension of state.pensions) {
        if (pension.isMatured || !pension.monthlyContribution) continue;
        if (pension.category === "national") continue; // 국민연금은 납입 없음

        let contribEndYear = pension.contributionEndYear;
        let contribEndMonth = pension.contributionEndMonth;
        if (pension.isContributionFixedToRetirement) {
          contribEndYear = getRetirementYear(pension.owner, profile);
          contribEndMonth = 12;
        }

        // ISA는 만기까지만 납입
        if (pension.pensionSubType === "isa") {
          contribEndYear = pension.isaMaturityYear ?? contribEndYear;
          contribEndMonth = pension.isaMaturityMonth ?? contribEndMonth;
        }

        const inContribPeriod = isInPeriod(
          year,
          month,
          pension.contributionStartYear,
          pension.contributionStartMonth,
          contribEndYear,
          contribEndMonth,
        );

        if (inContribPeriod) {
          state.currentCash -= pension.monthlyContribution;
          yearlyExpense += pension.monthlyContribution;
          pension.balance += pension.monthlyContribution;
          pension.totalPrincipal += pension.monthlyContribution;
          monthExpense += pension.monthlyContribution;
          monthExpenseBreakdown.push({
            title: `${pension.title} 납입`,
            amount: pension.monthlyContribution,
            type: "pension",
          });

          // 현금흐름 추적: 연금 적립
          const existingPenContrib = pensionContribTotals.get(pension.id);
          if (existingPenContrib) {
            existingPenContrib.amount += pension.monthlyContribution;
          } else {
            pensionContribTotals.set(pension.id, {
              title: pension.title,
              amount: pension.monthlyContribution,
              id: pension.id,
              category: pension.category,
            });
          }
        }
      }

      // A4-1. DC/기업IRP 회사 납입분 (월급여/12, 소득성장률 적용)
      for (const pension of state.pensions) {
        if (pension.isMatured || pension.isReceiving) continue;
        if (pension.category !== "retirement") continue;
        if (pension.pensionType !== 'dc' && pension.pensionType !== 'corporate_irp') continue;
        if (!pension.monthlySalary || pension.monthlySalary <= 0) continue;

        // 퇴직 전까지만 납입
        const ownerRetYear = getRetirementYear(pension.owner, profile);
        if (year > ownerRetYear || (year === ownerRetYear && month > 12)) continue;

        // 소득성장률로 급여 투영
        const monthsFromStart = (year - currentYear) * 12 + (month - 1);
        const monthlyGrowthRate = Math.pow(1 + incomeGrowthPct / 100, 1 / 12) - 1;
        const projectedSalary = pension.monthlySalary * Math.pow(1 + monthlyGrowthRate, Math.max(0, monthsFromStart));
        const employerContrib = projectedSalary / 12;

        // 회사 납입분 → 잔액만 증가 (현금흐름 차감 없음)
        pension.balance += employerContrib;
        pension.totalPrincipal += employerContrib;
      }

      // A5. 부채 월 상환액 처리
      for (const debt of state.debts) {
        if (debt.isPaidOff) continue;
        // 부동산/실물자산 연동 부채는 각 자산에서 직접 계산 (A6, A6-2)
        if (
          debt.sourceType === "real_estate" ||
          debt.sourceType === "physical_asset"
        )
          continue;
        if (
          !isInPeriod(
            year,
            month,
            debt.startYear,
            debt.startMonth,
            debt.maturityYear,
            debt.maturityMonth,
          )
        ) {
          // 만기 이후인데 잔액이 남아있으면 강제 정리
          const pastMaturity = year > debt.maturityYear ||
            (year === debt.maturityYear && month > debt.maturityMonth);
          if (pastMaturity && debt.currentBalance > 0) {
            debt.currentBalance = 0;
            debt.isPaidOff = true;
          }
          continue;
        }

        const monthsFromStart =
          (year - debt.startYear) * 12 + (month - debt.startMonth);
        const monthlyRate = debt.interestRate / 100 / 12;
        let debtPaymentThisMonth = 0;
        let debtInterestThisMonth = 0;
        let debtPrincipalThisMonth = 0;

        // 거치기간 체크
        if (
          debt.repaymentType === "거치식상환" &&
          monthsFromStart < debt.gracePeriodMonths
        ) {
          // 거치기간: 이자만 납부
          debtInterestThisMonth = debt.currentBalance * monthlyRate;
          debtPaymentThisMonth = debtInterestThisMonth;
        } else {
          // 상환
          const interestPayment = debt.currentBalance * monthlyRate;
          let principalPayment = 0;

          switch (debt.repaymentType) {
            case "만기일시상환":
              // 이자만 매월 납부
              debtInterestThisMonth = interestPayment;
              debtPaymentThisMonth = interestPayment;
              // 만기 시 원금 상환
              if (year === debt.maturityYear && month === debt.maturityMonth) {
                debtPrincipalThisMonth = debt.currentBalance;
                debtPaymentThisMonth += debt.currentBalance;
                debt.currentBalance = 0;
                debt.isPaidOff = true;
                events.push(`${debt.title} 만기상환`);
              }
              break;

            case "원리금균등상환": {
              const totalMonths =
                (debt.maturityYear - debt.startYear) * 12 +
                (debt.maturityMonth - debt.startMonth);
              const remainingMonthsForDebt = Math.max(
                1,
                totalMonths - monthsFromStart,
              );
              const pmt = calculatePMT(
                debt.currentBalance,
                monthlyRate,
                remainingMonthsForDebt,
              );
              principalPayment = pmt - interestPayment;
              debtInterestThisMonth = interestPayment;
              debtPrincipalThisMonth = principalPayment;
              debtPaymentThisMonth = interestPayment + principalPayment;
              debt.currentBalance = Math.max(
                0,
                debt.currentBalance - principalPayment,
              );
              if (debt.currentBalance <= 0) {
                debt.isPaidOff = true;
                events.push(`${debt.title} 상환 완료`);
              }
              break;
            }

            case "원금균등상환": {
              const totalMonths =
                (debt.maturityYear - debt.startYear) * 12 +
                (debt.maturityMonth - debt.startMonth);
              principalPayment = debt.originalPrincipal / totalMonths;
              debtInterestThisMonth = interestPayment;
              debtPrincipalThisMonth = principalPayment;
              debtPaymentThisMonth = interestPayment + principalPayment;
              debt.currentBalance = Math.max(
                0,
                debt.currentBalance - principalPayment,
              );
              if (debt.currentBalance <= 0) {
                debt.isPaidOff = true;
                events.push(`${debt.title} 상환 완료`);
              }
              break;
            }

            case "거치식상환": {
              // 거치기간 이후 원리금균등
              const totalMonthsDebt =
                (debt.maturityYear - debt.startYear) * 12 +
                (debt.maturityMonth - debt.startMonth);
              const remainingRepayMonths = Math.max(
                1,
                totalMonthsDebt - monthsFromStart,
              );
              const pmt = calculatePMT(
                debt.currentBalance,
                monthlyRate,
                remainingRepayMonths,
              );
              principalPayment = pmt - interestPayment;
              debtInterestThisMonth = interestPayment;
              debtPrincipalThisMonth = principalPayment;
              debtPaymentThisMonth = interestPayment + principalPayment;
              debt.currentBalance = Math.max(
                0,
                debt.currentBalance - principalPayment,
              );
              if (debt.currentBalance <= 0) {
                debt.isPaidOff = true;
                events.push(`${debt.title} 상환 완료`);
              }
              break;
            }
          }
        }

        // 현금흐름 반영 + 추적
        state.currentCash -= debtPaymentThisMonth;
        yearlyExpense += debtPaymentThisMonth;
        debtPaymentTotals.set(
          debt.id,
          (debtPaymentTotals.get(debt.id) || 0) + debtPaymentThisMonth,
        );
        monthExpense += debtPaymentThisMonth;
        monthExpenseBreakdown.push({
          title: debt.title,
          amount: debtPaymentThisMonth,
          type: "debt",
        });

        // 현금흐름 추적: 이자/원금 분리
        if (debtInterestThisMonth > 0) {
          const existingInterest = debtInterestTotals.get(debt.id);
          if (existingInterest) {
            existingInterest.amount += debtInterestThisMonth;
          } else {
            debtInterestTotals.set(debt.id, {
              title: debt.title,
              amount: debtInterestThisMonth,
              id: debt.id,
            });
          }
        }
        if (debtPrincipalThisMonth > 0) {
          const existingPrincipal = debtPrincipalTotals.get(debt.id);
          if (existingPrincipal) {
            existingPrincipal.amount += debtPrincipalThisMonth;
          } else {
            debtPrincipalTotals.set(debt.id, {
              title: debt.title,
              amount: debtPrincipalThisMonth,
              id: debt.id,
            });
          }
        }
      }

      // A6. 부동산 대출 이자/원금 직접 계산 (현금 차감 포함)
      for (const re of state.realEstates) {
        if (re.isSold || !re.hasLoan || re.loanBalance <= 0) continue;
        if (!re.isPurchased) continue;
        // Check if property hasn't been purchased yet (by date)
        if (re.purchaseYear) {
          const purchaseYM = re.purchaseYear * 12 + (re.purchaseMonth || 1);
          const currentYM = year * 12 + month;
          if (currentYM < purchaseYM) continue;
        }
        if (!re.loanStartYear || !re.loanMaturityYear) continue;
        if (
          !isInPeriod(
            year,
            month,
            re.loanStartYear,
            re.loanStartMonth || 1,
            re.loanMaturityYear,
            re.loanMaturityMonth || 12,
          )
        ) {
          // 만기 이후 잔액 강제 정리
          const pastMaturity = year > re.loanMaturityYear ||
            (year === re.loanMaturityYear && month > (re.loanMaturityMonth || 12));
          if (pastMaturity && re.loanBalance > 0) {
            re.loanBalance = 0;
          }
          continue;
        }

        const loanRate = re.loanRate || (effectiveAssumptions.rates.debtDefault ?? 3.5);
        const loanMonthlyRate = loanRate / 100 / 12;
        const totalLoanMonths =
          ((re.loanMaturityYear || 0) - (re.loanStartYear || 0)) * 12 +
          ((re.loanMaturityMonth || 12) - (re.loanStartMonth || 1));
        const monthsElapsedLoan =
          (year - (re.loanStartYear || 0)) * 12 +
          (month - (re.loanStartMonth || 1));

        let reInterest = 0;
        let rePrincipal = 0;

        switch (re.loanRepaymentType) {
          case "만기일시상환":
            reInterest = re.loanBalance * loanMonthlyRate;
            if (
              year === re.loanMaturityYear &&
              month === (re.loanMaturityMonth || 12)
            ) {
              rePrincipal = re.loanBalance;
              re.loanBalance = 0;
              events.push(`${re.title} 대출 만기상환`);
            }
            break;
          case "원리금균등상환": {
            const remainingLoanMonths = Math.max(
              1,
              totalLoanMonths - monthsElapsedLoan,
            );
            const loanPmt = calculatePMT(
              re.loanBalance,
              loanMonthlyRate,
              remainingLoanMonths,
            );
            reInterest = re.loanBalance * loanMonthlyRate;
            rePrincipal = loanPmt - reInterest;
            re.loanBalance = Math.max(0, re.loanBalance - rePrincipal);
            break;
          }
          case "원금균등상환": {
            rePrincipal = (re.loanAmount || 0) / Math.max(1, totalLoanMonths);
            reInterest = re.loanBalance * loanMonthlyRate;
            re.loanBalance = Math.max(0, re.loanBalance - rePrincipal);
            break;
          }
          case "거치식상환": {
            // 거치종료 시점 계산: DB에 있으면 사용, 없으면 전체의 30% 기본값
            let gracePeriodMonths: number;
            if (re.loanGraceEndYear && re.loanGraceEndMonth) {
              gracePeriodMonths =
                (re.loanGraceEndYear - (re.loanStartYear || 0)) * 12 +
                (re.loanGraceEndMonth - (re.loanStartMonth || 1));
            } else {
              gracePeriodMonths = Math.round(totalLoanMonths * 0.3);
            }
            if (monthsElapsedLoan < gracePeriodMonths) {
              // 거치기간: 이자만
              reInterest = re.loanBalance * loanMonthlyRate;
            } else {
              const remainingRepay = Math.max(
                1,
                totalLoanMonths - monthsElapsedLoan,
              );
              const loanPmt = calculatePMT(
                re.loanBalance,
                loanMonthlyRate,
                remainingRepay,
              );
              reInterest = re.loanBalance * loanMonthlyRate;
              rePrincipal = loanPmt - reInterest;
              re.loanBalance = Math.max(0, re.loanBalance - rePrincipal);
            }
            break;
          }
        }

        const rePayment = reInterest + rePrincipal;
        if (rePayment > 0) {
          state.currentCash -= rePayment;
          yearlyExpense += rePayment;
          monthExpense += rePayment;
          monthExpenseBreakdown.push({
            title: `${re.title} 대출`,
            amount: rePayment,
            type: "loan",
          });
          debtPaymentTotals.set(
            `re_loan_${re.id}`,
            (debtPaymentTotals.get(`re_loan_${re.id}`) || 0) + rePayment,
          );

          // 현금흐름 추적: 이자/원금 분리
          if (reInterest > 0) {
            const key = `re_interest_${re.id}`;
            const existing = debtInterestTotals.get(key);
            if (existing) {
              existing.amount += reInterest;
            } else {
              debtInterestTotals.set(key, {
                title: `${re.title} 대출`,
                amount: reInterest,
                id: re.id,
              });
            }
          }
          if (rePrincipal > 0) {
            const key = `re_principal_${re.id}`;
            const existing = debtPrincipalTotals.get(key);
            if (existing) {
              existing.amount += rePrincipal;
            } else {
              debtPrincipalTotals.set(key, {
                title: `${re.title} 대출`,
                amount: rePrincipal,
                id: re.id,
              });
            }
          }
        }
      }

      // A6-2. 실물자산 대출 이자/원금 직접 계산
      for (const asset of state.physicalAssets) {
        if (asset.isSold || !asset.hasLoan || asset.loanBalance <= 0) continue;
        if (!asset.isPurchased) continue;
        // Check if asset hasn't been purchased yet (by date)
        if (asset.purchaseYear) {
          const purchaseYM = asset.purchaseYear * 12 + (asset.purchaseMonth || 1);
          const currentYM = year * 12 + month;
          if (currentYM < purchaseYM) continue;
        }
        if (!asset.loanStartYear || !asset.loanMaturityYear) continue;
        if (
          !isInPeriod(
            year,
            month,
            asset.loanStartYear,
            asset.loanStartMonth || 1,
            asset.loanMaturityYear,
            asset.loanMaturityMonth || 12,
          )
        ) {
          // 만기 이후 잔액 강제 정리
          const pastMaturity = year > asset.loanMaturityYear ||
            (year === asset.loanMaturityYear && month > (asset.loanMaturityMonth || 12));
          if (pastMaturity && asset.loanBalance > 0) {
            asset.loanBalance = 0;
          }
          continue;
        }

        const assetLoanRate = asset.loanRate || (effectiveAssumptions.rates.debtDefault ?? 3.5);
        const assetMonthlyRate = assetLoanRate / 100 / 12;
        const totalAssetLoanMonths =
          ((asset.loanMaturityYear || 0) - (asset.loanStartYear || 0)) * 12 +
          ((asset.loanMaturityMonth || 12) - (asset.loanStartMonth || 1));
        const monthsElapsedAssetLoan =
          (year - (asset.loanStartYear || 0)) * 12 +
          (month - (asset.loanStartMonth || 1));

        let assetInterest = 0;
        let assetPrincipal = 0;

        switch (asset.loanRepaymentType) {
          case "만기일시상환":
            assetInterest = asset.loanBalance * assetMonthlyRate;
            if (
              year === asset.loanMaturityYear &&
              month === (asset.loanMaturityMonth || 12)
            ) {
              assetPrincipal = asset.loanBalance;
              asset.loanBalance = 0;
              events.push(`${asset.title} 대출 만기상환`);
            }
            break;
          case "원리금균등상환": {
            const remaining = Math.max(
              1,
              totalAssetLoanMonths - monthsElapsedAssetLoan,
            );
            const pmt = calculatePMT(
              asset.loanBalance,
              assetMonthlyRate,
              remaining,
            );
            assetInterest = asset.loanBalance * assetMonthlyRate;
            assetPrincipal = pmt - assetInterest;
            asset.loanBalance = Math.max(0, asset.loanBalance - assetPrincipal);
            break;
          }
          case "원금균등상환": {
            assetPrincipal =
              (asset.loanAmount || 0) / Math.max(1, totalAssetLoanMonths);
            assetInterest = asset.loanBalance * assetMonthlyRate;
            asset.loanBalance = Math.max(0, asset.loanBalance - assetPrincipal);
            break;
          }
          default: {
            // 기본: 원리금균등상환
            const remaining = Math.max(
              1,
              totalAssetLoanMonths - monthsElapsedAssetLoan,
            );
            const pmt = calculatePMT(
              asset.loanBalance,
              assetMonthlyRate,
              remaining,
            );
            assetInterest = asset.loanBalance * assetMonthlyRate;
            assetPrincipal = pmt - assetInterest;
            asset.loanBalance = Math.max(0, asset.loanBalance - assetPrincipal);
            break;
          }
        }

        const assetPayment = assetInterest + assetPrincipal;
        if (assetPayment > 0) {
          state.currentCash -= assetPayment;
          yearlyExpense += assetPayment;
          monthExpense += assetPayment;
          monthExpenseBreakdown.push({
            title: `${asset.title} 대출`,
            amount: assetPayment,
            type: "loan",
          });
          debtPaymentTotals.set(
            `pa_loan_${asset.id}`,
            (debtPaymentTotals.get(`pa_loan_${asset.id}`) || 0) + assetPayment,
          );

          // 현금흐름 추적: 이자/원금 분리
          if (assetInterest > 0) {
            const key = `pa_interest_${asset.id}`;
            const existing = debtInterestTotals.get(key);
            if (existing) {
              existing.amount += assetInterest;
            } else {
              debtInterestTotals.set(key, {
                title: `${asset.title} 대출`,
                amount: assetInterest,
                id: asset.id,
              });
            }
          }
          if (assetPrincipal > 0) {
            const key = `pa_principal_${asset.id}`;
            const existing = debtPrincipalTotals.get(key);
            if (existing) {
              existing.amount += assetPrincipal;
            } else {
              debtPrincipalTotals.set(key, {
                title: `${asset.title} 대출`,
                amount: assetPrincipal,
                id: asset.id,
              });
            }
          }
        }
      }

      // A6-1. 부동산 주거비 (월세/관리비) 직접 계산
      for (const re of state.realEstates) {
        if (re.isSold) continue;
        if (!re.isPurchased) continue;
        // Check if property hasn't been purchased yet (by date)
        if (re.purchaseYear) {
          const purchaseYM = re.purchaseYear * 12 + (re.purchaseMonth || 1);
          const currentYM = year * 12 + month;
          if (currentYM < purchaseYM) continue;
        }

        // 월세 (월세 거주만)
        if (re.housingType === "월세" && re.monthlyRent && re.monthlyRent > 0) {
          const rentAmount = re.monthlyRent;
          state.currentCash -= rentAmount;
          yearlyExpense += rentAmount;
          monthExpense += rentAmount;
          monthExpenseBreakdown.push({
            title: `${re.title} 월세`,
            amount: rentAmount,
            type: "housing",
          });
          const rentKey = `rent_${re.id}`;
          const existingRent = housingExpenseTotals.get(rentKey);
          if (existingRent) {
            existingRent.amount += rentAmount;
          } else {
            housingExpenseTotals.set(rentKey, {
              title: `${re.title} 월세`,
              amount: rentAmount,
            });
          }
        }

        // 관리비
        if (re.maintenanceFee && re.maintenanceFee > 0) {
          const maintAmount = re.maintenanceFee;
          state.currentCash -= maintAmount;
          yearlyExpense += maintAmount;
          monthExpense += maintAmount;
          monthExpenseBreakdown.push({
            title: `${re.title} 관리비`,
            amount: maintAmount,
            type: "housing",
          });
          const maintKey = `maint_${re.id}`;
          const existingMaint = housingExpenseTotals.get(maintKey);
          if (existingMaint) {
            existingMaint.amount += maintAmount;
          } else {
            housingExpenseTotals.set(maintKey, {
              title: `${re.title} 관리비`,
              amount: maintAmount,
            });
          }
        }
      }

      // A6-3. 부동산 임대 소득 직접 계산
      for (const re of state.realEstates) {
        if (re.isSold) continue;
        if (!re.isPurchased) continue;
        // Check if property hasn't been purchased yet (by date)
        if (re.purchaseYear) {
          const purchaseYM = re.purchaseYear * 12 + (re.purchaseMonth || 1);
          const currentYM = year * 12 + month;
          if (currentYM < purchaseYM) continue;
        }
        if (!re.hasRentalIncome || !re.rentalMonthly || re.rentalMonthly <= 0)
          continue;
        if (
          !isInPeriod(
            year,
            month,
            re.rentalStartYear,
            re.rentalStartMonth,
            re.rentalEndYear,
            re.rentalEndMonth,
          )
        )
          continue;

        const rentalAmount = re.rentalMonthly;
        state.currentCash += rentalAmount;
        yearlyIncome += rentalAmount;
        monthIncome += rentalAmount;
        monthIncomeBreakdown.push({
          title: `${re.title} 임대소득`,
          amount: rentalAmount,
          type: "rental",
        });
        const rentalKey = re.id;
        const existingRental = rentalIncomeTotals.get(rentalKey);
        if (existingRental) {
          existingRental.amount += rentalAmount;
        } else {
          rentalIncomeTotals.set(rentalKey, {
            title: `${re.title} 임대소득`,
            amount: rentalAmount,
          });
        }
      }

      // A6-5. 부동산 취득 이벤트
      for (const re of state.realEstates) {
        if (re.isPurchased || re.isSold) continue;
        const purchaseMonth = re.purchaseMonth || 1;
        if (re.purchaseYear === year && purchaseMonth === month) {
          re.isPurchased = true;
          const isLease = re.housingType === "전세" || re.housingType === "월세";

          if (isLease) {
            // 전세/월세: 대출 실행 → 보증금 지출
            const depositAmount = re.deposit || 0;

            // 1) 대출금 현금 유입
            if (re.hasLoan && re.loanBalance > 0) {
              const loanDisbursement = re.loanBalance;
              state.currentCash += loanDisbursement;
              yearlyIncome += loanDisbursement;
              monthIncome += loanDisbursement;
              monthIncomeBreakdown.push({
                title: `${re.title} 대출 실행`,
                amount: loanDisbursement,
                type: "loan_disbursement",
              });
              eventFlowItems.push({
                title: `${re.title} 대출 실행`,
                amount: Math.round(loanDisbursement),
                flowType: "loan_disbursement",
                sourceType: "real_estates",
                sourceId: re.id,
              });
            }

            // 2) 보증금 현금 유출
            if (depositAmount > 0) {
              state.currentCash -= depositAmount;
              yearlyExpense += depositAmount;
              monthExpense += depositAmount;
              monthExpenseBreakdown.push({
                title: `${re.title} 보증금`,
                amount: depositAmount,
                type: "deposit_payment",
              });
              eventFlowItems.push({
                title: `${re.title} 보증금`,
                amount: -Math.round(depositAmount),
                flowType: "deposit_payment",
                sourceType: "real_estates",
                sourceId: re.id,
              });
            }

            events.push(
              `${re.title} 입주 (보증금 ${Math.round(depositAmount)}만원)`,
            );
          } else {
            // 자가/투자/임대/토지: 기존 로직
            re.currentValue = re.purchasePrice;
            events.push(
              `${re.title} 취득 (${Math.round(re.purchasePrice)}만원)`,
            );

            // 대출 실행 현금 유입
            if (re.hasLoan && re.loanBalance > 0) {
              const loanDisbursement = re.loanBalance;
              state.currentCash += loanDisbursement;
              yearlyIncome += loanDisbursement;
              monthIncome += loanDisbursement;
              monthIncomeBreakdown.push({
                title: `${re.title} 대출 실행`,
                amount: loanDisbursement,
                type: "loan_disbursement",
              });
              eventFlowItems.push({
                title: `${re.title} 대출 실행`,
                amount: Math.round(loanDisbursement),
                flowType: "loan_disbursement",
                sourceType: "real_estates",
                sourceId: re.id,
              });
            }

            // 취득가 현금 유출 (includeInCashflow일 때만)
            if (re.includeInCashflow) {
              state.currentCash -= re.purchasePrice;
              yearlyExpense += re.purchasePrice;
              monthExpense += re.purchasePrice;
              monthExpenseBreakdown.push({
                title: `${re.title} 취득`,
                amount: re.purchasePrice,
                type: "real_estate_purchase",
              });
              eventFlowItems.push({
                title: `${re.title} 취득`,
                amount: -Math.round(re.purchasePrice),
                flowType: "real_estate_purchase",
                sourceType: "real_estates",
                sourceId: re.id,
              });
            }
          }
        }
      }

      // A6-6. 실물자산 취득 이벤트 (현금 흐름 처리)
      for (const asset of state.physicalAssets) {
        if (asset.isPurchased || asset.isSold) continue;
        if (!asset.includeInCashflow) continue;
        const purchaseMonth = asset.purchaseMonth || 1;
        if (asset.purchaseYear === year && purchaseMonth === month) {
          state.currentCash -= asset.purchasePrice;
          yearlyExpense += asset.purchasePrice;
          monthExpense += asset.purchasePrice;
          monthExpenseBreakdown.push({
            title: `${asset.title} 취득`,
            amount: asset.purchasePrice,
            type: "asset_purchase",
          });
          asset.currentValue = asset.purchasePrice;
          asset.isPurchased = true;
          events.push(
            `${asset.title} 취득 (${Math.round(asset.purchasePrice)}만원)`,
          );
          eventFlowItems.push({
            title: `${asset.title} 취득`,
            amount: -Math.round(asset.purchasePrice),
            flowType: "asset_purchase",
            sourceType: "physical_assets",
            sourceId: asset.id,
          });
        }
      }

      // A7. 부동산 매각/종료 이벤트
      for (const re of state.realEstates) {
        if (re.isSold) continue;
        if (re.sellYear === year && re.sellMonth === month) {
          const isLeaseEnd = re.housingType === "전세" || re.housingType === "월세";

          if (isLeaseEnd) {
            // 전세/월세 종료: 보증금 반환, 월세/관리비 중단
            const depositReturn = re.deposit || 0;
            if (depositReturn > 0) {
              state.currentCash += depositReturn;
              yearlyIncome += depositReturn;
              monthIncome += depositReturn;
              monthIncomeBreakdown.push({
                title: `${re.title} 보증금 반환`,
                amount: depositReturn,
                type: "deposit_return",
              });
              eventFlowItems.push({
                title: `${re.title} 보증금 반환`,
                amount: Math.round(depositReturn),
                flowType: "real_estate_sale",
                sourceType: "real_estates",
                sourceId: re.id,
              });
            }
            re.isSold = true;
            events.push(
              `${re.title} 종료 (보증금 ${Math.round(depositReturn)}만원 반환)`,
            );
          } else {
            // 자가/투자 등: 기존 매각 로직
            const salePrice = re.currentValue;

            // 세금 비활성화 (추후 프리미엄 기능으로 재설계)
            const cgt = 0;

            // 순매각대금 → currentCash
            const netProceeds = salePrice - cgt;
            state.currentCash += netProceeds;
            yearlyIncome += netProceeds;
            monthIncome += netProceeds;
            monthIncomeBreakdown.push({
              title: `${re.title} 매각`,
              amount: netProceeds,
              type: "real_estate_sale",
            });

            // 연동 대출이 있으면 정리
            if (re.hasLoan && re.loanBalance > 0) {
              state.currentCash -= re.loanBalance;
              yearlyExpense += re.loanBalance;
              monthExpense += re.loanBalance;
              monthExpenseBreakdown.push({
                title: `${re.title} 대출 상환`,
                amount: re.loanBalance,
                type: "loan_repayment",
              });
              eventFlowItems.push({
                title: `${re.title} 대출 상환`,
                amount: -Math.round(re.loanBalance),
                flowType: "debt_principal",
                sourceType: "real_estates",
                sourceId: re.id,
              });
              re.loanBalance = 0;
            }

            re.isSold = true;
            events.push(
              `${re.title} 매각 (${Math.round(salePrice)}만원)`,
            );
            eventFlowItems.push({
              title: `${re.title} 매각`,
              amount: Math.round(salePrice),
              flowType: "real_estate_sale",
              sourceType: "real_estates",
              sourceId: re.id,
            });
          }
        }
      }

      // A8. 실물자산 매각 이벤트
      for (const asset of state.physicalAssets) {
        if (asset.isSold) continue;
        if (asset.sellYear === year && asset.sellMonth === month) {
          state.currentCash += asset.currentValue;
          yearlyIncome += asset.currentValue;
          monthIncome += asset.currentValue;
          monthIncomeBreakdown.push({
            title: `${asset.title} 매각`,
            amount: asset.currentValue,
            type: "physical_asset_sale",
          });

          // 연동 대출이 있으면 정리
          if (asset.hasLoan && asset.loanBalance > 0) {
            state.currentCash -= asset.loanBalance;
            yearlyExpense += asset.loanBalance;
            monthExpense += asset.loanBalance;
            monthExpenseBreakdown.push({
              title: `${asset.title} 대출 상환`,
              amount: asset.loanBalance,
              type: "loan_repayment",
            });
            eventFlowItems.push({
              title: `${asset.title} 대출 상환`,
              amount: -Math.round(asset.loanBalance),
              flowType: "debt_principal",
              sourceType: "physical_assets",
              sourceId: asset.id,
            });
            asset.loanBalance = 0;
          }

          asset.isSold = true;
          events.push(
            `${asset.title} 매각 (${Math.round(asset.currentValue)}만원)`,
          );
          eventFlowItems.push({
            title: `${asset.title} 매각`,
            amount: Math.round(asset.currentValue),
            flowType: "asset_sale",
            sourceType: "physical_assets",
            sourceId: asset.id,
          });
        }
      }

      // A9. ISA 만기 처리
      for (const pension of state.pensions) {
        if (pension.isMatured) continue;
        if (pension.pensionSubType !== "isa") continue;
        if (
          pension.isaMaturityYear === year &&
          pension.isaMaturityMonth === month
        ) {
          const gain = pension.balance - pension.totalPrincipal;
          // 세금 비활성화 (추후 프리미엄 기능으로 재설계)
          // const tax = calculateISATax(gain)
          // yearlyTax += tax
          const tax = 0;
          const netAmount = pension.balance - tax;

          switch (pension.isaMaturityStrategy) {
            case "pension_savings": {
              // 연금저축으로 이전
              const target = state.pensions.find(
                (p) =>
                  p.pensionSubType === "pension_savings" &&
                  p.owner === pension.owner &&
                  !p.isMatured,
              );
              if (target) {
                target.balance += netAmount;
                target.totalPrincipal += netAmount;
              } else {
                state.currentCash += netAmount;
              }
              events.push(
                `${pension.title} 만기 → 연금저축 이전 (${Math.round(netAmount)}만원)`,
              );
              break;
            }
            case "irp": {
              const target = state.pensions.find(
                (p) =>
                  p.pensionSubType === "irp" &&
                  p.owner === pension.owner &&
                  !p.isMatured,
              );
              if (target) {
                target.balance += netAmount;
                target.totalPrincipal += netAmount;
              } else {
                state.currentCash += netAmount;
              }
              events.push(
                `${pension.title} 만기 → IRP 이전 (${Math.round(netAmount)}만원)`,
              );
              break;
            }
            default:
              state.currentCash += netAmount;
              yearlyIncome += netAmount;
              monthIncome += netAmount;
              monthIncomeBreakdown.push({
                title: `${pension.title} 만기`,
                amount: netAmount,
                type: "isa_maturity",
              });
              events.push(
                `${pension.title} 만기 → 현금 수령 (${Math.round(netAmount)}만원)`,
              );
              eventFlowItems.push({
                title: `${pension.title} 만기`,
                amount: Math.round(pension.balance),
                flowType: "savings_withdrawal",
                sourceType: "pension",
                sourceId: pension.id,
              });
          }

          pension.balance = 0;
          pension.isMatured = true;
        }
      }

      // A10. 국민연금 수령
      for (const pension of state.pensions) {
        if (pension.category !== "national" || pension.isMatured) continue;
        if (!pension.expectedMonthlyAmount || !pension.startAge) continue;

        const ownerBirthYear = getOwnerBirthYear(pension.owner, profile);
        const ownerAge = year - ownerBirthYear;
        const endAge = pension.endAge ?? 999;

        if (ownerAge >= pension.startAge && ownerAge <= endAge) {
          // 물가 상승률 적용: 현재 시점(입력 기준)에서 수령 연도까지 복리
          const yearsFromNow = year - currentYear;
          const adjustedAmount =
            pension.expectedMonthlyAmount *
            Math.pow(1 + inflationPct / 100, Math.max(0, yearsFromNow));
          state.currentCash += adjustedAmount;
          yearlyIncome += adjustedAmount;
          monthIncome += adjustedAmount;
          monthIncomeBreakdown.push({
            title: pension.title,
            amount: adjustedAmount,
            type: "national_pension",
          });
          pensionIncomeTotals.set(
            pension.id,
            (pensionIncomeTotals.get(pension.id) || 0) + adjustedAmount,
          );
          pension.isReceiving = true;
        }
      }

      // A10-1. DB/퇴직금 퇴직 시점 이벤트 (auto 모드)
      for (const pension of state.pensions) {
        if (pension.category !== "retirement" || pension.isMatured) continue;
        if (pension.pensionType !== 'db' && pension.pensionType !== 'severance') continue;
        if (pension.calculationMode !== 'auto') continue;

        const ownerBirthYear = getOwnerBirthYear(pension.owner, profile);
        const ownerAge = year - ownerBirthYear;
        const ownerRetirementAge = pension.owner === 'spouse'
          ? (profile.spouseRetirementAge || profile.retirementAge)
          : profile.retirementAge;

        // 퇴직 시점 (해당 나이의 1월에 한 번만 처리)
        if (ownerAge === ownerRetirementAge && month === 1) {
          const yearsWorked = (pension.yearsOfService || 0) + (ownerRetirementAge - (currentYear - ownerBirthYear));
          const effectiveYearsWorked = Math.max(0, yearsWorked);
          // 급여를 소득성장률로 투영
          const yearsUntilRetirement = Math.max(0, ownerRetirementAge - (currentYear - ownerBirthYear));
          const projectedSalary = (pension.monthlySalary || 0) *
            Math.pow(1 + incomeGrowthPct / 100, yearsUntilRetirement);
          const totalAmount = projectedSalary * effectiveYearsWorked;

          if (totalAmount > 0) {
            if (pension.receiveType === 'lump_sum') {
              // 일시금: 즉시 현금으로
              state.currentCash += totalAmount;
              yearlyIncome += totalAmount;
              monthIncome += totalAmount;
              monthIncomeBreakdown.push({
                title: `${pension.title} 퇴직금 일시금`,
                amount: totalAmount,
                type: "pension_lump_sum",
              });
              pensionIncomeTotals.set(
                pension.id,
                (pensionIncomeTotals.get(pension.id) || 0) + totalAmount,
              );
              pension.isMatured = true;
              events.push(`${pension.title} 퇴직금 일시금 수령 (${Math.round(totalAmount)}만원)`);
              eventFlowItems.push({
                title: `${pension.title} 퇴직금 일시금`,
                amount: Math.round(totalAmount),
                flowType: "pension_lump_sum",
                sourceType: "pension",
                sourceId: pension.id,
              });
            } else {
              // 연금: balance에 적립 → 이후 A11에서 PMT 수령
              pension.balance = totalAmount;
              pension.totalPrincipal = totalAmount;
              events.push(`${pension.title} 퇴직금 연금 전환 (${Math.round(totalAmount)}만원)`);
            }
          }
        }
      }

      // A11. 퇴직/개인연금 수령
      for (const pension of state.pensions) {
        if (pension.category === "national" || pension.isMatured) continue;
        if (pension.pensionSubType === "isa") continue;

        const ownerBirthYear = getOwnerBirthYear(pension.owner, profile);
        const ownerAge = year - ownerBirthYear;
        const startAge = pension.startAgeForReceiving || profile.retirementAge;

        if (ownerAge >= startAge && pension.balance > 0) {
          // 일시금 수령: 잔액 전체를 한 번에 수령
          if (pension.receiveType === 'lump_sum') {
            const lumpSum = pension.balance;
            state.currentCash += lumpSum;
            yearlyIncome += lumpSum;
            monthIncome += lumpSum;
            monthIncomeBreakdown.push({
              title: `${pension.title} 일시금`,
              amount: lumpSum,
              type: "pension_lump_sum",
            });
            pensionIncomeTotals.set(
              pension.id,
              (pensionIncomeTotals.get(pension.id) || 0) + lumpSum,
            );
            pension.balance = 0;
            pension.isMatured = true;
            events.push(`${pension.title} 일시금 수령 (${Math.round(lumpSum)}만원)`);
            eventFlowItems.push({
              title: `${pension.title} 일시금`,
              amount: Math.round(lumpSum),
              flowType: "pension_lump_sum",
              sourceType: "pension",
              sourceId: pension.id,
            });
            continue;
          }

          // 연금 수령 (annuity)
          if (!pension.isReceiving) {
            pension.isReceiving = true;
          }

          const receivingYears = pension.receivingYears || 20;
          const effectiveReturnRate = pensionReturnPct;
          const monthlyReturnRate =
            Math.pow(1 + effectiveReturnRate / 100, 1 / 12) - 1;

          // PMT를 이자 적용 전 잔액으로 계산 (표준 연금 모델)
          // 그래야 매월 정확히 동일한 PMT가 나옴
          // A14에서는 수령 중인 연금 건너뜀 (여기서 이자 처리하므로)
          const elapsedReceivingMonths = (ownerAge - startAge) * 12 + (month - 1);
          const remainingMonths = Math.max(
            1,
            receivingYears * 12 - elapsedReceivingMonths,
          );
          let monthlyWithdrawal: number;

          if (monthlyReturnRate === 0 || remainingMonths <= 0) {
            monthlyWithdrawal = pension.balance / Math.max(1, remainingMonths);
          } else {
            // PMT(pre-interest balance, rate, remaining)
            monthlyWithdrawal =
              (pension.balance *
                (monthlyReturnRate *
                  Math.pow(1 + monthlyReturnRate, remainingMonths))) /
              (Math.pow(1 + monthlyReturnRate, remainingMonths) - 1);
          }

          // 이자 적용 후 인출: new_balance = balance × (1+r) - PMT
          const grownBalance = pension.balance * (1 + monthlyReturnRate);
          monthlyWithdrawal = Math.min(monthlyWithdrawal, grownBalance);
          pension.balance = grownBalance - monthlyWithdrawal;
          state.currentCash += monthlyWithdrawal;
          yearlyIncome += monthlyWithdrawal;
          monthIncome += monthlyWithdrawal;
          monthIncomeBreakdown.push({
            title: pension.title,
            amount: monthlyWithdrawal,
            type: "pension_withdrawal",
          });
          pensionIncomeTotals.set(
            pension.id,
            (pensionIncomeTotals.get(pension.id) || 0) + monthlyWithdrawal,
          );

          if (pension.balance <= 0) {
            pension.balance = 0;
            pension.isMatured = true;
          }
        }
      }

      // A14. 월별 자산 성장 (이자/수익률/가치 상승)
      // 저축 이자/수익률
      for (const saving of state.savings) {
        if (saving.isMatured || !saving.isActive) continue;
        if (saving.isVirtual) continue; // 유동 현금은 성장률 0%
        let annualRate: number;
        if (isSavingsType(saving.type)) {
          annualRate = saving.interestRate ?? savingsReturnPct;
        } else {
          annualRate = saving.expectedReturn ?? investmentReturnPct;
        }
        if (annualRate > 0) {
          const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
          saving.balance *= 1 + monthlyRate;
        }
      }
      // 연금 적립 성장 (수령 중인 연금은 A11에서 수익률 적용 완료)
      for (const pension of state.pensions) {
        if (pension.category === "national" || pension.isMatured) continue;
        if (pension.isReceiving) continue;
        // DB/퇴직금 auto 모드: 투자 잔액이 아니므로 수익률 적용 불필요
        if (
          (pension.pensionType === 'db' || pension.pensionType === 'severance') &&
          pension.calculationMode === 'auto'
        ) continue;
        const returnRate = pensionReturnPct;
        if (returnRate > 0) {
          const monthlyRate = Math.pow(1 + returnRate / 100, 1 / 12) - 1;
          pension.balance *= 1 + monthlyRate;
        }
      }
      // 부동산 가치 성장
      for (const re of state.realEstates) {
        if (re.isSold) continue;
        if (!re.isPurchased) continue;
        // Check if property hasn't been purchased yet (by date)
        if (re.purchaseYear) {
          const purchaseYM = re.purchaseYear * 12 + (re.purchaseMonth || 1);
          const currentYM = year * 12 + month;
          if (currentYM < purchaseYM) continue;
        }
        const reRate = re.rateCategory === 'fixed'
          ? (re.growthRate ?? 0)
          : (assumptionRateByCategory[re.rateCategory] ?? re.growthRate ?? 0);
        if (reRate !== 0) {
          const monthlyRate = Math.pow(1 + reRate / 100, 1 / 12) - 1;
          re.currentValue *= 1 + monthlyRate;
        }
      }
      // 실물자산 성장/감가
      for (const asset of state.physicalAssets) {
        if (asset.isSold) continue;
        if (!asset.isPurchased) continue;
        // Check if asset hasn't been purchased yet (by date)
        if (asset.purchaseYear) {
          const purchaseYM = asset.purchaseYear * 12 + (asset.purchaseMonth || 1);
          const currentYM = year * 12 + month;
          if (currentYM < purchaseYM) continue;
        }
        const physRate = asset.rateCategory === "fixed"
          ? asset.annualRate
          : (assumptionRateByCategory[asset.rateCategory] ?? asset.annualRate);
        if (physRate !== 0) {
          const monthlyRate = Math.pow(1 + physRate / 100, 1 / 12) - 1;
          asset.currentValue *= 1 + monthlyRate;
          if (asset.currentValue < 0) asset.currentValue = 0;
        }
      }

      // A12. 저축 만기 처리 (정기예금 등)
      for (const saving of state.savings) {
        if (saving.isMatured || !saving.isActive) continue;
        if (!saving.maturityYear || !saving.maturityMonth) continue;
        if (year !== saving.maturityYear || month !== saving.maturityMonth)
          continue;

        // A14에서 이미 월별 이자 적용됨 → 추가 이자 계산 불필요
        const gain = saving.balance - saving.totalPrincipal;
        // 세금 비활성화 (추후 프리미엄 기능으로 재설계)
        // const tax = calculateInterestIncomeTax(gain, saving.isTaxFree)
        // yearlyTax += tax
        const tax = 0;

        const maturityAmount = saving.balance - tax;
        state.currentCash += maturityAmount;
        yearlyIncome += maturityAmount;
        monthIncome += maturityAmount;
        monthIncomeBreakdown.push({
          title: `${saving.title} 만기`,
          amount: maturityAmount,
          type: "savings_maturity",
        });
        events.push(
          `${saving.title} 만기 (${Math.round(maturityAmount)}만원, 세금 ${Math.round(tax)}만원)`,
        );
        eventFlowItems.push({
          title: `${saving.title} 만기`,
          amount: Math.round(saving.balance),
          flowType: "savings_withdrawal",
          sourceType: "savings",
          sourceId: saving.id,
        });

        saving.balance = 0;
        saving.isMatured = true;
      }

      // A13. 월별 적자 보전 (currentCash < 0이면 저축에서 인출)
      if (state.currentCash < 0) {
        // 0단계: 유동 현금(__default_checking__)에서 먼저 인출
        const defaultCheckingForDeficit = state.savings.find(
          s => s.id === '__default_checking__' && s.isActive && s.balance > 0
        );
        if (defaultCheckingForDeficit) {
          const deficit = -state.currentCash;
          const withdrawal = Math.min(defaultCheckingForDeficit.balance, deficit);
          defaultCheckingForDeficit.balance -= withdrawal;
          defaultCheckingForDeficit.totalPrincipal = Math.max(
            0,
            defaultCheckingForDeficit.totalPrincipal - withdrawal,
          );
          state.currentCash += withdrawal;
          deficitWithdrawals.push({
            title: '유동 현금',
            amount: withdrawal,
            category: 'savings',
            id: '__default_checking__',
          });
          monthWithdrawals.push({
            title: '유동 현금 인출',
            amount: withdrawal,
            category: 'savings',
          });
        }
      }

      if (state.currentCash < 0) {
        // 1단계: 사용자 설정 인출 순서
        if (priorities?.withdrawalRules?.length) {
          const sorted = [...priorities.withdrawalRules].sort(
            (a, b) => a.priority - b.priority,
          );
          for (const rule of sorted) {
            if (state.currentCash >= 0) break;

            if (rule.targetCategory === "savings") {
              const item = state.savings.find(
                (s) =>
                  s.id === rule.targetId &&
                  !s.isMatured &&
                  s.isActive &&
                  s.balance > 0,
              );
              if (!item) continue;
              const deficit = -state.currentCash;
              const withdrawal = Math.min(item.balance, deficit);
              item.balance -= withdrawal;
              item.totalPrincipal = Math.max(
                0,
                item.totalPrincipal - withdrawal,
              );
              state.currentCash += withdrawal;
              deficitWithdrawals.push({
                title: item.title || "저축",
                amount: withdrawal,
                category: "savings",
                id: item.id,
              });
              monthWithdrawals.push({
                title: `${item.title || "저축"} 인출`,
                amount: withdrawal,
                category: "savings",
              });
            } else if (rule.targetCategory === "pension") {
              const item = state.pensions.find(
                (p) => p.id === rule.targetId && !p.isMatured && p.balance > 0,
              );
              if (!item) continue;
              const withdrawal = Math.min(item.balance, -state.currentCash);
              item.balance -= withdrawal;
              state.currentCash += withdrawal;
              deficitWithdrawals.push({
                title: item.title || "연금",
                amount: withdrawal,
                category: "pension",
                id: item.id,
              });
              monthWithdrawals.push({
                title: `${item.title || "연금"} 인출`,
                amount: withdrawal,
                category: "pension",
              });
              if (item.balance <= 0) {
                item.balance = 0;
                item.isMatured = true;
              }
            }
          }
        }

        // 2단계: 폴백 (유동성 순서 - 현실적 인출 순서)
        if (state.currentCash < 0) {
          const fallbackOrder = [
            "checking",  // 입출금 통장 먼저 사용
            "savings",   // 적금
            "deposit",   // 정기 예금
            "housing",   // 주택청약
            "other",
            "fund",
            "bond",
            "domestic_stock",
            "foreign_stock",
            "crypto",
          ];

          for (const type of fallbackOrder) {
            if (state.currentCash >= 0) break;
            const items = state.savings
              .filter(
                (s) =>
                  s.type === type &&
                  s.id !== '__default_checking__' && // 0단계에서 이미 처리됨
                  !s.isMatured &&
                  s.isActive &&
                  s.balance > 0,
              )
              .sort((a, b) => b.balance - a.balance);

            for (const item of items) {
              if (state.currentCash >= 0) break;
              const deficit = -state.currentCash;
              const withdrawal = Math.min(item.balance, deficit);
              item.balance -= withdrawal;
              item.totalPrincipal = Math.max(
                0,
                item.totalPrincipal - withdrawal,
              );
              state.currentCash += withdrawal;
              deficitWithdrawals.push({
                title: item.title || "저축",
                amount: withdrawal,
                category: "savings",
                id: item.id,
              });
              monthWithdrawals.push({
                title: `${item.title || "저축"} 인출`,
                amount: withdrawal,
                category: "savings",
              });
            }
          }
        }
      }

      // A15-0. 잉여금 먼저 마이너스 통장 상환 (오버드래프트가 있으면 최우선 상환)
      if (state.currentCash > 0) {
        const defaultCheckingForRepay = state.savings.find(
          s => s.id === '__default_checking__' && s.isActive && s.balance < 0
        );
        if (defaultCheckingForRepay) {
          const overdraft = Math.abs(defaultCheckingForRepay.balance);
          const repayment = Math.min(state.currentCash, overdraft);
          defaultCheckingForRepay.balance += repayment;
          defaultCheckingForRepay.totalPrincipal += repayment;
          state.currentCash -= repayment;
          surplusInvestments.push({
            title: '마이너스 통장',
            amount: repayment,
            category: 'debt',
            id: 'overdraft_repayment',
          });
          monthSurplus.push({
            title: '마이너스 통장 상환',
            amount: repayment,
            category: 'debt',
          });
        }
      }

      // A15. 월별 잉여금 배분 (Cash Flow Priorities)
      if (state.currentCash > 0 && priorities?.surplusRules?.length) {
        const sorted = [...priorities.surplusRules].sort(
          (a, b) => a.priority - b.priority,
        );

        for (const rule of sorted) {
          if (state.currentCash <= 0) break;

          // 기간 체크: 현재 연월이 규칙 기간 내인지
          const currentYM = year * 12 + month;
          if (rule.startYear != null && rule.startMonth != null) {
            const startYM = rule.startYear * 12 + rule.startMonth;
            if (currentYM < startYM) continue;
          }
          if (rule.endYear != null && rule.endMonth != null) {
            const endYM = rule.endYear * 12 + rule.endMonth;
            if (currentYM > endYM) continue;
          }

          // 모드별 배분 가능 금액 계산
          const ruleMode = rule.mode || "allocate";
          let maxThisRule = state.currentCash;

          if (ruleMode === "maintain_balance" && rule.targetBalance != null) {
            // 잔액 유지 모드: 현재 잔액과 목표의 차이만큼만 배분
            let currentBalance = 0;
            if (rule.targetCategory === "savings") {
              const t = state.savings.find(s => s.id === rule.targetId && s.isActive && !s.isMatured);
              currentBalance = t?.balance ?? 0;
            } else if (rule.targetCategory === "pension") {
              const t = state.pensions.find(p => p.id === rule.targetId && !p.isMatured);
              currentBalance = t?.balance ?? 0;
            }
            const deficit = rule.targetBalance - currentBalance;
            if (deficit <= 0) continue; // 이미 목표 이상
            maxThisRule = Math.min(state.currentCash, deficit);
          } else {
            // 적립 모드: 연간 한도 체크
            const allocated = surplusAllocated.get(rule.id) || 0;
            if (rule.annualLimit != null) {
              maxThisRule = Math.min(
                state.currentCash,
                Math.max(0, rule.annualLimit - allocated),
              );
            }
          }
          if (maxThisRule <= 0) continue;

          let actualAllocation = 0;

          if (rule.targetCategory === "savings") {
            const target = state.savings.find(
              (s) => s.id === rule.targetId && !s.isMatured && s.isActive,
            );
            if (!target) continue;
            target.balance += maxThisRule;
            target.totalPrincipal += maxThisRule;
            actualAllocation = maxThisRule;
          } else if (rule.targetCategory === "pension") {
            const target = state.pensions.find(
              (p) => p.id === rule.targetId && !p.isMatured,
            );
            if (!target) continue;
            target.balance += maxThisRule;
            target.totalPrincipal += maxThisRule;
            actualAllocation = maxThisRule;
          } else if (rule.targetCategory === "debt") {
            const target = state.debts.find(
              (d) => d.id === rule.targetId && !d.isPaidOff,
            );
            if (!target) continue;
            const repay = Math.min(maxThisRule, target.currentBalance);
            target.currentBalance -= repay;
            if (target.currentBalance <= 0) {
              target.isPaidOff = true;
              events.push(`${target.title} 조기상환`);
            }
            actualAllocation = repay;
          }

          if (actualAllocation > 0) {
            state.currentCash -= actualAllocation;
            surplusAllocated.set(rule.id, (surplusAllocated.get(rule.id) || 0) + actualAllocation);
            const targetName =
              rule.targetCategory === "savings"
                ? state.savings.find((s) => s.id === rule.targetId)?.title
                : rule.targetCategory === "pension"
                  ? state.pensions.find((p) => p.id === rule.targetId)?.title
                  : state.debts.find((d) => d.id === rule.targetId)?.title;
            surplusInvestments.push({
              title: targetName || "알 수 없음",
              amount: actualAllocation,
              category: rule.targetCategory,
              id: rule.targetId,
            });
            const actionLabel =
              rule.targetCategory === "debt" ? "상환" : ruleMode === "maintain_balance" ? "잔액유지" : "적립";
            monthSurplus.push({
              title: `${targetName || "알 수 없음"} ${actionLabel}`,
              amount: actualAllocation,
              category: rule.targetCategory,
            });
          }
        }
      }

      // A15 폴백: surplusRules 없을 때 → 유동 현금으로만 흡수 (아래 월말 처리에서 처리)

      // 월말 잔여 currentCash → 유동 현금(__default_checking__)에 흡수 (마이너스 가능)
      if (state.currentCash !== 0) {
        const defaultChecking = state.savings.find(
          s => s.id === '__default_checking__' && s.isActive
        );
        if (defaultChecking) {
          const amount = state.currentCash;
          defaultChecking.balance += amount;
          defaultChecking.totalPrincipal += amount;
          if (amount > 0) {
            surplusInvestments.push({
              title: '유동 현금',
              amount,
              category: 'savings',
              id: '__default_checking__',
            });
            monthSurplus.push({
              title: '유동 현금 적립',
              amount,
              category: 'savings',
            });
          } else {
            // 인출 후 잔액이 음수면 마이너스 통장, 아니면 유동 현금
            const isOverdraft = defaultChecking.balance < 0;
            const label = isOverdraft ? '마이너스 통장' : '유동 현금';
            deficitWithdrawals.push({
              title: label,
              amount: -amount,
              category: 'savings',
              id: isOverdraft ? 'overdraft' : '__default_checking__',
            });
            monthWithdrawals.push({
              title: `${label} 인출`,
              amount: -amount,
              category: 'savings',
            });
          }
          state.currentCash = 0;
        }
      }

      // 월말 스냅샷 생성
      // __default_checking__ 음수 → 금융자산에서 제외, 부채로 분리
      const defaultCheckingM = state.savings.find(s => s.id === '__default_checking__' && s.isActive);
      const overdraftAmountM = defaultCheckingM && defaultCheckingM.balance < 0 ? Math.abs(defaultCheckingM.balance) : 0;
      const mFinancialAssets = state.savings
        .filter((s) => !s.isMatured && s.isActive)
        .reduce((sum, s) => {
          if (s.id === '__default_checking__' && s.balance < 0) return sum;
          return sum + s.balance;
        }, 0);

      const mPensionAssets = state.pensions
        .filter((p) => !p.isMatured)
        .reduce((sum, p) => sum + p.balance, 0);

      const mRealEstateValue = state.realEstates
        .filter((re) => re.isPurchased && !re.isSold)
        .reduce((sum, re) => {
          if (re.housingType === "전세" || re.housingType === "월세") {
            return sum + (re.deposit || 0);
          }
          return sum + re.currentValue;
        }, 0);

      const mPhysicalAssetValue = state.physicalAssets
        .filter((a) => a.isPurchased && !a.isSold)
        .reduce((sum, a) => sum + a.currentValue, 0);

      // 사용자 직접 생성 부채 (연동 부채 제외)
      const mUserDebts = state.debts
        .filter(
          (d) =>
            !d.isPaidOff &&
            d.sourceType !== "real_estate" &&
            d.sourceType !== "physical_asset",
        )
        .reduce((sum, d) => sum + d.currentBalance, 0);
      // 부동산 대출 잔액
      const mRealEstateLoans = state.realEstates
        .filter((re) => !re.isSold && re.hasLoan && re.loanBalance > 0)
        .reduce((sum, re) => sum + re.loanBalance, 0);
      // 실물자산 대출 잔액
      const mPhysicalAssetLoans = state.physicalAssets
        .filter((a) => !a.isSold && a.hasLoan && a.loanBalance > 0)
        .reduce((sum, a) => sum + a.loanBalance, 0);
      const mTotalDebts =
        mUserDebts +
        mRealEstateLoans +
        mPhysicalAssetLoans +
        overdraftAmountM;

      const mTotalAssets =
        mFinancialAssets +
        mPensionAssets +
        mRealEstateValue +
        mPhysicalAssetValue;

      // 월별 자산 breakdown
      const mAssetBreakdown: { title: string; amount: number; type: string }[] =
        [];

      // 부동산
      for (const re of state.realEstates) {
        if (!re.isPurchased || re.isSold) continue;
        const label = ownerLabels[re.owner] || "";
        const displayTitle = label ? `${re.title} | ${label}` : re.title;
        if (re.housingType === "전세" || re.housingType === "월세") {
          if (re.deposit && re.deposit > 0) {
            mAssetBreakdown.push({
              title: `${displayTitle} 보증금`,
              amount: Math.round(re.deposit),
              type: "deposit",
            });
          }
        } else {
          if (re.currentValue > 0) {
            mAssetBreakdown.push({
              title: displayTitle,
              amount: Math.round(re.currentValue),
              type: "real_estate",
            });
          }
        }
      }

      // 저축/투자 계좌
      for (const saving of state.savings) {
        if (saving.isMatured || !saving.isActive || saving.balance <= 0)
          continue;
        const label = ownerLabels[saving.owner] || "";
        const displayTitle = label
          ? `${saving.title} | ${label}`
          : saving.title;
        const savingsCategory = getSavingsAssetCategory(saving.type);
        mAssetBreakdown.push({
          title: displayTitle,
          amount: Math.round(saving.balance),
          type: savingsCategory,
        });
      }

      // 실물자산
      for (const asset of state.physicalAssets) {
        if (asset.isSold || asset.currentValue <= 0) continue;
        const label = ownerLabels[asset.owner] || "";
        const displayTitle = label ? `${asset.title} | ${label}` : asset.title;
        mAssetBreakdown.push({
          title: displayTitle,
          amount: Math.round(asset.currentValue),
          type: "tangible",
        });
      }

      // 월별 부채 breakdown
      const mDebtBreakdown: { title: string; amount: number; type: string }[] =
        [];
      for (const debt of state.debts) {
        if (debt.isPaidOff) continue;
        // 연동 부채는 아래에서 자산별로 표시
        if (
          debt.sourceType === "real_estate" ||
          debt.sourceType === "physical_asset"
        )
          continue;
        mDebtBreakdown.push({
          title: debt.title,
          amount: Math.round(debt.currentBalance),
          type: getDebtAssetCategory(debt.type),
        });
      }
      // 부동산 대출 잔액
      for (const re of state.realEstates) {
        if (!re.isPurchased || re.isSold || !re.hasLoan || re.loanBalance <= 0) continue;
        mDebtBreakdown.push({
          title: `${re.title} 대출`,
          amount: Math.round(re.loanBalance),
          type: "mortgage",
        });
      }
      // 실물자산 대출 잔액
      for (const asset of state.physicalAssets) {
        if (!asset.isPurchased || asset.isSold || !asset.hasLoan || asset.loanBalance <= 0) continue;
        mDebtBreakdown.push({
          title: `${asset.title} 대출`,
          amount: Math.round(asset.loanBalance),
          type: "other_debt",
        });
      }
      if (overdraftAmountM > 0) {
        mDebtBreakdown.push({
          title: "마이너스 통장",
          amount: Math.round(overdraftAmountM),
          type: "other_debt",
        });
      }

      // 월별 연금 breakdown
      const mPensionBreakdown: {
        title: string;
        amount: number;
        type: string;
      }[] = [];
      for (const pension of state.pensions) {
        if (pension.isMatured || pension.balance <= 0) continue;
        const label = ownerLabels[pension.owner] || "";
        const displayTitle = label
          ? `${pension.title} | ${label}`
          : pension.title;
        mPensionBreakdown.push({
          title: displayTitle,
          amount: Math.round(pension.balance),
          type: "pension",
        });
      }

      monthlySnapshots.push({
        year,
        month,
        age,
        monthlyIncome: monthIncome,
        monthlyExpense: monthExpense,
        netCashFlow: monthIncome - monthExpense,
        financialAssets: Math.round(mFinancialAssets),
        pensionAssets: Math.round(mPensionAssets),
        realEstateValue: Math.round(mRealEstateValue),
        physicalAssetValue: Math.round(mPhysicalAssetValue),
        totalDebts: Math.round(mTotalDebts),
        netWorth: Math.round(mTotalAssets - mTotalDebts),
        currentCash: Math.round(state.currentCash),
        incomeBreakdown: monthIncomeBreakdown,
        expenseBreakdown: monthExpenseBreakdown,
        assetBreakdown: mAssetBreakdown,
        debtBreakdown: mDebtBreakdown,
        pensionBreakdown: mPensionBreakdown,
        withdrawalBreakdown:
          monthWithdrawals.length > 0 ? monthWithdrawals : undefined,
        surplusBreakdown: monthSurplus.length > 0 ? monthSurplus : undefined,
      });
    }

    // ==============================
    // Phase B: 연말 처리 (자산 성장/잉여배분/적자인출은 A14/A15/A13에서 월별 처리)
    // ==============================

    // B2. 저축 만기 처리 (maturityMonth가 없는 경우만 - 연말 기준 처리)
    // A14에서 이미 12개월 이자가 월별 적용되었으므로 추가 이자 불필요
    for (const saving of state.savings) {
      if (saving.isMatured || !saving.isActive) continue;
      if (!saving.maturityYear) continue;
      if (saving.maturityMonth) continue; // maturityMonth가 있으면 A12에서 이미 처리됨

      if (year >= saving.maturityYear) {
        const gain = saving.balance - saving.totalPrincipal;
        // 세금 비활성화 (추후 프리미엄 기능으로 재설계)
        // const tax = calculateInterestIncomeTax(gain, saving.isTaxFree)
        // yearlyTax += tax
        const tax = 0;

        const maturityAmount = saving.balance - tax;
        state.currentCash += maturityAmount;
        yearlyIncome += maturityAmount;
        events.push(
          `${saving.title} 만기 (${Math.round(maturityAmount)}만원, 세금 ${Math.round(tax)}만원)`,
        );
        eventFlowItems.push({
          title: `${saving.title} 만기`,
          amount: Math.round(saving.balance),
          flowType: "savings_withdrawal",
          sourceType: "savings",
          sourceId: saving.id,
        });

        saving.balance = 0;
        saving.isMatured = true;
      }
    }

    // ==============================
    // B8. YearlySnapshot 생성
    // ==============================

    // 월별 루프에서 누적한 실제 값을 직접 사용 (이중 계산 방지)
    const incomeBrkDown: { title: string; amount: number; type?: string }[] = [...yearlyIncomeAccum.values()];
    const expenseBrkDown: { title: string; amount: number; type?: string }[] = [...yearlyExpenseAccum.values()];

    // 직접 계산된 부채 상환액을 지출 breakdown에 추가
    for (const debt of state.debts) {
      // 연동 부채는 아래에서 자산별로 추가
      if (
        debt.sourceType === "real_estate" ||
        debt.sourceType === "physical_asset"
      )
        continue;
      const amount = debtPaymentTotals.get(debt.id);
      if (amount && amount > 0) {
        expenseBrkDown.push({
          title: debt.title,
          amount: amount,
          type: "debt",
        });
      }
    }
    // 부동산 대출 상환액
    for (const re of state.realEstates) {
      const amount = debtPaymentTotals.get(`re_loan_${re.id}`);
      if (amount && amount > 0) {
        expenseBrkDown.push({
          title: `${re.title} 대출`,
          amount: amount,
          type: "debt",
        });
      }
    }
    // 실물자산 대출 상환액
    for (const asset of state.physicalAssets) {
      const amount = debtPaymentTotals.get(`pa_loan_${asset.id}`);
      if (amount && amount > 0) {
        expenseBrkDown.push({
          title: `${asset.title} 대출`,
          amount: amount,
          type: "debt",
        });
      }
    }

    // 부동산 주거비 (월세/관리비) 추가
    for (const [, housing] of housingExpenseTotals) {
      if (housing.amount > 0) {
        expenseBrkDown.push({
          title: housing.title,
          amount: housing.amount,
          type: "housing",
        });
      }
    }

    // 직접 계산된 연금 수령액을 소득 breakdown에 추가
    for (const pension of state.pensions) {
      const amount = pensionIncomeTotals.get(pension.id);
      if (amount && amount > 0) {
        incomeBrkDown.push({
          title: pension.title,
          amount: amount,
          type: "pension",
        });
      }
    }

    // 임대 소득 추가
    for (const [, rental] of rentalIncomeTotals) {
      if (rental.amount > 0) {
        incomeBrkDown.push({
          title: rental.title,
          amount: rental.amount,
          type: "rental",
        });
      }
    }

    // 이벤트성 소득 (매각, 만기 등) 추가
    for (const event of eventFlowItems) {
      if (event.amount > 0) {
        incomeBrkDown.push({
          title: event.title,
          amount: event.amount,
          type:
            event.flowType === "real_estate_sale"
              ? "real_estate"
              : event.flowType === "asset_sale"
                ? "asset"
                : "savings",
        });
      }
    }

    // 자산 합계 (__default_checking__ 음수 → 금융자산에서 제외, 부채로 분리)
    const defaultCheckingY = state.savings.find(s => s.id === '__default_checking__' && s.isActive);
    const overdraftAmountY = defaultCheckingY && defaultCheckingY.balance < 0 ? Math.abs(defaultCheckingY.balance) : 0;
    const financialAssets = state.savings
      .filter((s) => !s.isMatured && s.isActive)
      .reduce((sum, s) => {
        if (s.id === '__default_checking__' && s.balance < 0) return sum;
        return sum + s.balance;
      }, 0);

    const pensionAssets = state.pensions
      .filter((p) => !p.isMatured)
      .reduce((sum, p) => sum + p.balance, 0);

    const realEstateValue = state.realEstates
      .filter((re) => re.isPurchased && !re.isSold)
      .reduce((sum, re) => {
        if (re.housingType === "전세" || re.housingType === "월세") {
          return sum + (re.deposit || 0);
        }
        return sum + re.currentValue;
      }, 0);

    const physicalAssetValue = state.physicalAssets
      .filter((a) => a.isPurchased && !a.isSold)
      .reduce((sum, a) => sum + a.currentValue, 0);

    const totalAssets = Math.round(
      financialAssets + pensionAssets + realEstateValue + physicalAssetValue,
    );

    // 사용자 직접 생성 부채 (연동 부채 제외)
    const userDebts = state.debts
      .filter(
        (d) =>
          !d.isPaidOff &&
          d.sourceType !== "real_estate" &&
          d.sourceType !== "physical_asset",
      )
      .reduce((sum, d) => sum + d.currentBalance, 0);

    // 부동산 대출 잔액
    const realEstateLoans = state.realEstates
      .filter((re) => !re.isSold && re.hasLoan && re.loanBalance > 0)
      .reduce((sum, re) => sum + re.loanBalance, 0);

    // 실물자산 대출 잔액
    const physicalAssetLoans = state.physicalAssets
      .filter((a) => !a.isSold && a.hasLoan && a.loanBalance > 0)
      .reduce((sum, a) => sum + a.loanBalance, 0);

    const totalDebts = userDebts + realEstateLoans + physicalAssetLoans;
    const totalDebtsAll = Math.round(totalDebts + overdraftAmountY);

    const netWorth = totalAssets - totalDebtsAll;

    // 자산 breakdown
    const assetBreakdown: { title: string; amount: number; type: string }[] =
      [];

    // 부동산
    for (const re of state.realEstates) {
      if (!re.isPurchased || re.isSold) continue;
      const label = ownerLabels[re.owner] || "";
      const displayTitle = label ? `${re.title} | ${label}` : re.title;

      if (re.housingType === "전세" || re.housingType === "월세") {
        if (re.deposit && re.deposit > 0) {
          assetBreakdown.push({
            title: `${displayTitle} 보증금`,
            amount: Math.round(re.deposit),
            type: "deposit",
          });
        }
      } else {
        if (re.currentValue > 0) {
          assetBreakdown.push({
            title: displayTitle,
            amount: Math.round(re.currentValue),
            type: "real_estate",
          });
        }
      }
    }

    // 금융자산 (개별 항목)
    for (const saving of state.savings) {
      if (saving.isMatured || !saving.isActive || saving.balance <= 0) continue;
      const label = ownerLabels[saving.owner] || "";
      const displayTitle = label ? `${saving.title} | ${label}` : saving.title;
      const savingsCategory = getSavingsAssetCategory(saving.type);
      assetBreakdown.push({
        title: displayTitle,
        amount: Math.round(saving.balance),
        type: savingsCategory,
      });
    }

    // 실물자산
    for (const asset of state.physicalAssets) {
      if (asset.isSold || asset.currentValue <= 0) continue;
      const label = ownerLabels[asset.owner] || "";
      const displayTitle = label ? `${asset.title} | ${label}` : asset.title;
      assetBreakdown.push({
        title: displayTitle,
        amount: Math.round(asset.currentValue),
        type: "tangible",
      });
    }

    // 부채 breakdown
    const debtBreakdown: { title: string; amount: number; type: string }[] = [];
    for (const debt of state.debts) {
      if (debt.isPaidOff) continue;
      // 연동 부채는 아래에서 자산별로 표시
      if (
        debt.sourceType === "real_estate" ||
        debt.sourceType === "physical_asset"
      )
        continue;
      debtBreakdown.push({
        title: debt.title,
        amount: Math.round(debt.currentBalance),
        type: getDebtAssetCategory(debt.type),
      });
    }
    // 부동산 대출 잔액
    for (const re of state.realEstates) {
      if (!re.isPurchased || re.isSold || !re.hasLoan || re.loanBalance <= 0) continue;
      debtBreakdown.push({
        title: `${re.title} 대출`,
        amount: Math.round(re.loanBalance),
        type: "mortgage",
      });
    }
    // 실물자산 대출 잔액
    for (const asset of state.physicalAssets) {
      if (!asset.isPurchased || asset.isSold || !asset.hasLoan || asset.loanBalance <= 0) continue;
      debtBreakdown.push({
        title: `${asset.title} 대출`,
        amount: Math.round(asset.loanBalance),
        type: "other_debt",
      });
    }
    // 마이너스 통장 (__default_checking__ 잔액이 음수면 부채로 표시)
    if (overdraftAmountY > 0) {
      debtBreakdown.push({
        title: "마이너스 통장",
        amount: Math.round(overdraftAmountY),
        type: "other_debt",
      });
    }

    // 연금 breakdown
    const pensionBreakdown: { title: string; amount: number; type: string }[] =
      [];
    for (const pension of state.pensions) {
      if (pension.isMatured || pension.balance <= 0) continue;
      const label = ownerLabels[pension.owner] || "";
      const displayTitle = label
        ? `${pension.title} | ${label}`
        : pension.title;
      pensionBreakdown.push({
        title: displayTitle,
        amount: Math.round(pension.balance),
        type: "pension",
      });
    }

    // V2 확장 필드
    const savingsBreakdown = state.savings
      .filter((s) => !s.isMatured && s.isActive)
      .map((s) => ({
        id: s.id,
        title: s.title,
        balance: Math.round(s.balance),
        type: s.type,
      }));

    const realEstateBreakdown = state.realEstates.map((re) => ({
      id: re.id,
      title: re.title,
      value: Math.round(re.currentValue),
      isSold: re.isSold,
    }));

    const physicalAssetBreakdown = state.physicalAssets
      .filter((a) => !a.isSold)
      .map((a) => ({
        id: a.id,
        title: a.title,
        value: Math.round(a.currentValue),
      }));

    // ==============================
    // 현금흐름 상세 (cashFlowItems) 조립
    // ==============================

    // 소득 항목
    for (const item of incomeBrkDown) {
      const isPension = item.type === "pension";
      const isRental = item.type === "rental";
      const isEvent =
        item.type === "real_estate" ||
        item.type === "asset" ||
        item.type === "savings";
      if (isRental || isEvent) continue; // 별도 처리됨
      cashFlowItems.push({
        title: item.title,
        amount: item.amount,
        flowType: isPension ? "pension_withdrawal" : "income",
        sourceType: isPension ? "pension" : "income",
      });
    }

    // 이벤트 현금흐름 (부동산 매각, 자산 매각, 저축 만기 등)
    for (const event of eventFlowItems) {
      cashFlowItems.push(event);
    }

    // 지출 항목 (부채는 아래에서 이자/원금 분리로 추적하므로 제외, housing은 별도 추가하므로 제외)
    for (const item of expenseBrkDown) {
      if (item.type === "debt" || item.type === "housing") continue;
      cashFlowItems.push({
        title: item.title,
        amount: -Math.abs(item.amount),
        flowType: "expense",
        sourceType: "expense",
      });
    }

    // 저축 적립
    for (const [id, contrib] of savingsContribTotals) {
      if (contrib.amount > 0) {
        cashFlowItems.push({
          title: `${contrib.title} | 적립`,
          amount: -contrib.amount,
          flowType: "savings_contribution",
          sourceType: "savings",
          sourceId: id,
        });
      }
    }

    // 연금 적립
    for (const [id, contrib] of pensionContribTotals) {
      if (contrib.amount > 0) {
        cashFlowItems.push({
          title: `${contrib.title} | 적립`,
          amount: -contrib.amount,
          flowType: "pension_contribution",
          sourceType: `${contrib.category}_pension`,
          sourceId: id,
        });
      }
    }

    // 주거비 (월세/관리비)
    for (const [key, housing] of housingExpenseTotals) {
      if (housing.amount > 0) {
        cashFlowItems.push({
          title: housing.title,
          amount: -housing.amount,
          flowType: "housing_expense",
          sourceType: "real_estates",
          sourceId: key,
        });
      }
    }

    // 임대 소득
    for (const [key, rental] of rentalIncomeTotals) {
      if (rental.amount > 0) {
        cashFlowItems.push({
          title: rental.title,
          amount: rental.amount,
          flowType: "rental_income",
          sourceType: "real_estates",
          sourceId: key,
        });
      }
    }

    // 대출 이자
    for (const [id, interest] of debtInterestTotals) {
      if (interest.amount > 0) {
        cashFlowItems.push({
          title: `${interest.title} | 이자`,
          amount: -interest.amount,
          flowType: "debt_interest",
          sourceType: "debts",
          sourceId: id,
        });
      }
    }

    // 대출 원금상환
    for (const [id, principal] of debtPrincipalTotals) {
      if (principal.amount > 0) {
        cashFlowItems.push({
          title: `${principal.title} | 원금상환`,
          amount: -principal.amount,
          flowType: "debt_principal",
          sourceType: "debts",
          sourceId: id,
        });
      }
    }

    // 세금: snapshot.taxPaid에 별도 저장 (차트 cashFlowBreakdown에는 미포함 - 추후 세금 체계 재설계 예정)

    // 잉여금 배분 (A15 월별) - 같은 계좌 적립을 합산
    const aggregatedSurplus = new Map<
      string,
      { title: string; amount: number; category: string; id: string }
    >();
    for (const inv of surplusInvestments) {
      const existing = aggregatedSurplus.get(inv.id);
      if (existing) {
        existing.amount += inv.amount;
      } else {
        aggregatedSurplus.set(inv.id, { ...inv });
      }
    }
    for (const inv of aggregatedSurplus.values()) {
      cashFlowItems.push({
        title: `${inv.title} | ${inv.category === "debt" ? "상환" : "적립"}`,
        amount: -inv.amount,
        flowType: "surplus_investment",
        sourceType:
          inv.category === "savings"
            ? "savings"
            : inv.category === "pension"
              ? "pension"
              : "debts",
        sourceId: inv.id,
      });
    }

    // 마이너스 통장 연간 변화분 (__default_checking__ 잔액 기반)
    const overdraftStart = yearStartDefaultChecking < 0 ? Math.abs(yearStartDefaultChecking) : 0;
    const defaultCheckingEnd = state.savings.find(s => s.id === '__default_checking__' && s.isActive)?.balance || 0;
    const overdraftEnd = defaultCheckingEnd < 0 ? Math.abs(defaultCheckingEnd) : 0;

    // 마이너스 통장 변화분은 월별 유동 현금/마이너스 통장 인출/적립에서 이미 추적되므로
    // 여기서 별도 추가하면 중복됨. 단, 월별 추적에서 잡히지 않는 경우만 보완
    // (현재 구조에서는 모든 currentCash 변동이 월말에 __default_checking__으로 흡수되므로 중복 방지를 위해 생략)

    // 적자 인출 (A13 월별 + B7 연말) - 같은 계좌 인출을 합산
    const aggregatedWithdrawals = new Map<
      string,
      { title: string; amount: number; category: string; id: string }
    >();
    for (const w of deficitWithdrawals) {
      const existing = aggregatedWithdrawals.get(w.id);
      if (existing) {
        existing.amount += w.amount;
      } else {
        aggregatedWithdrawals.set(w.id, { ...w });
      }
    }
    for (const w of aggregatedWithdrawals.values()) {
      cashFlowItems.push({
        title: `${w.title} | 인출`,
        amount: w.amount,
        flowType: "deficit_withdrawal",
        sourceType:
          w.category === "savings"
            ? "savings"
            : w.category === "cash"
              ? "cash"
              : "pension",
        sourceId: w.id,
      });
    }

    snapshots.push({
      year,
      age,
      totalIncome: Math.round(yearlyIncome),
      totalExpense: Math.round(yearlyExpense),
      netCashFlow: Math.round(
        cashFlowItems
          .filter(
            (item) =>
              item.flowType !== "deficit_withdrawal" &&
              item.flowType !== "surplus_investment",
          )
          .reduce((sum, item) => sum + item.amount, 0),
      ),
      totalAssets,
      realEstateValue: Math.round(realEstateValue),
      financialAssets: Math.round(financialAssets),
      pensionAssets: Math.round(pensionAssets),
      totalDebts: totalDebtsAll,
      netWorth,
      incomeBreakdown: incomeBrkDown,
      expenseBreakdown: expenseBrkDown,
      assetBreakdown,
      debtBreakdown,
      pensionBreakdown,
      // V2 필드
      cashBalance: Math.round(state.currentCash),
      physicalAssetValue: Math.round(physicalAssetValue),
      taxPaid: Math.round(yearlyTax),
      savingsBreakdown,
      realEstateBreakdown,
      physicalAssetBreakdown,
      events: events.length > 0 ? events : undefined,
      cashFlowBreakdown: cashFlowItems.length > 0 ? cashFlowItems : undefined,
    });
  }

  // 요약 지표 계산
  const currentSnapshot = snapshots[0];
  const retirementSnapshot =
    snapshots.find((s) => s.year === retirementYear) || currentSnapshot;
  const peakSnapshot = snapshots.reduce(
    (max, s) => (s.netWorth > max.netWorth ? s : max),
    snapshots[0],
  );

  const annualExpense = currentSnapshot.totalExpense;
  const fiTarget = annualExpense * 25;
  const fiSnapshot = snapshots.find((s) => s.netWorth >= fiTarget);
  const bankruptcySnapshot = snapshots.find((s) => s.financialAssets < 0);

  return {
    startYear: currentYear,
    endYear,
    retirementYear,
    snapshots,
    monthlySnapshots,
    summary: {
      currentNetWorth: currentSnapshot.netWorth,
      retirementNetWorth: retirementSnapshot.netWorth,
      peakNetWorth: peakSnapshot.netWorth,
      peakNetWorthYear: peakSnapshot.year,
      yearsToFI: fiSnapshot ? fiSnapshot.year - new Date().getFullYear() : null,
      fiTarget,
      bankruptcyYear: bankruptcySnapshot ? bankruptcySnapshot.year : null,
    },
  };
}

// (buildIncomeBreakdown/buildExpenseBreakdown 제거됨)
// 소득/지출 breakdown은 월별 루프에서 yearlyIncomeAccum/yearlyExpenseAccum으로 직접 누적
