import type {
  OnboardingData,
  FinancialItem,
  FinancialItemInput,
  IncomeData,
  ExpenseData,
  SavingsData,
  PensionData,
  DebtData,
  RealEstateData,
  SimulationSettings,
  GlobalSettings,
  InvestmentAssumptions,
  CashFlowPriorities,
  CashFlowItem,
} from "@/types";
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_INVESTMENT_ASSUMPTIONS,
} from "@/types";
import {
  migrateOnboardingToFinancialItems,
  isItemActiveInYear,
} from "./dataMigration";

// 프로필 정보 (시뮬레이션용)
export interface SimulationProfile {
  birthYear: number;
  retirementAge: number;
  spouseBirthYear?: number;
  spouseRetirementAge?: number;
}
import { DEFAULT_RATES } from "./defaultItems";
import {
  calculateRemainingBalance,
  calculateYearlyPrincipalPayment,
  calculateYearlyInterestPayment,
  calculateAnnualPensionWithdrawal,
  getEffectiveDebtRate,
  type RepaymentType,
} from "../utils/loanCalculator";
import {
  getActiveMonthsInYear,
  calculateYearlyAmountWithProrating,
  calculateYearlyInterestWithProrating,
  calculateRemainingBalanceAtYearEnd,
} from "../utils/monthlyCalculation";
import { getEffectiveRate, getDefaultRateCategory } from "../utils";

// ============================================
// 타입 정의
// ============================================

export interface YearlySnapshot {
  year: number;
  age: number;

  // 현금흐름
  totalIncome: number; // 연간 총 수입
  totalExpense: number; // 연간 총 지출
  netCashFlow: number; // 연간 순현금흐름 (저축 가능액)

  // 자산
  totalAssets: number; // 총 자산
  realEstateValue: number; // 부동산 가치
  financialAssets: number; // 금융자산 (현금 + 투자)
  pensionAssets: number; // 연금자산

  // 부채
  totalDebts: number; // 총 부채

  // 순자산
  netWorth: number; // 순자산 (자산 - 부채)

  // 상세 breakdown
  incomeBreakdown: { title: string; amount: number; type?: string }[];
  expenseBreakdown: { title: string; amount: number; type?: string }[];
  assetBreakdown: { title: string; amount: number; type?: string }[];
  debtBreakdown: { title: string; amount: number; type?: string }[];
  pensionBreakdown: { title: string; amount: number; type?: string }[];

  // V2 옵셔널 필드 (하위 호환)
  cashBalance?: number;
  physicalAssetValue?: number;
  taxPaid?: number;
  savingsBreakdown?: {
    id: string;
    title: string;
    balance: number;
    type: string;
  }[];
  realEstateBreakdown?: {
    id: string;
    title: string;
    value: number;
    isSold: boolean;
  }[];
  physicalAssetBreakdown?: { id: string; title: string; value: number }[];
  events?: string[];
  cashFlowBreakdown?: CashFlowItem[];
}

export interface MonthlySnapshot {
  year: number;
  month: number;
  age: number;

  // 해당 월의 현금흐름
  monthlyIncome: number;
  monthlyExpense: number;
  netCashFlow: number;

  // 해당 월 말 자산/부채 잔액
  financialAssets: number;
  pensionAssets: number;
  realEstateValue: number;
  physicalAssetValue: number;
  totalDebts: number;
  netWorth: number;
  currentCash: number;

  // 상세 breakdown
  incomeBreakdown: { title: string; amount: number; type?: string }[];
  expenseBreakdown: { title: string; amount: number; type?: string }[];

  // 자산/부채/연금 개별 항목 (월말 잔액)
  assetBreakdown?: { title: string; amount: number; type: string }[];
  debtBreakdown?: { title: string; amount: number; type: string }[];
  pensionBreakdown?: { title: string; amount: number; type: string }[];

  // 월별 인출/적립 내역
  withdrawalBreakdown?: { title: string; amount: number; category: string }[];
  surplusBreakdown?: { title: string; amount: number; category: string }[];
}

export interface SimulationResult {
  startYear: number;
  endYear: number;
  retirementYear: number;
  snapshots: YearlySnapshot[];
  monthlySnapshots?: MonthlySnapshot[];

  // 요약 지표
  summary: {
    currentNetWorth: number;
    retirementNetWorth: number;
    peakNetWorth: number;
    peakNetWorthYear: number;
    yearsToFI: number | null; // 경제적 자유 달성 연도 (null = 미달성)
    fiTarget: number; // FI 목표 (연간 지출 x 25)
    bankruptcyYear: number | null; // 파산 연도 (금융자산 < 0, null = 파산 안함)
  };
}

// ============================================
// 핵심 계산 함수
// ============================================

/**
 * OnboardingData로부터 시뮬레이션 실행
 */
export function runSimulation(
  data: OnboardingData,
  settings?: Partial<SimulationSettings>,
  yearsToSimulate: number = 50,
  globalSettings?: GlobalSettings,
): SimulationResult {
  const currentYear = new Date().getFullYear();
  const birthYear = data.birth_date
    ? parseInt(data.birth_date.split("-")[0])
    : currentYear - 35;
  const spouseBirthYear = data.spouse?.birth_date
    ? parseInt(data.spouse.birth_date.split("-")[0])
    : null;
  const currentAge = currentYear - birthYear;
  const retirementYear = birthYear + (data.target_retirement_age || 60);
  const endYear = currentYear + yearsToSimulate;

  // owner에 따른 생년 반환 (연금 수령 시작 연도 계산용)
  const getOwnerBirthYear = (owner?: string) => {
    if (owner === "spouse" && spouseBirthYear) return spouseBirthYear;
    return birthYear;
  };

  // OnboardingData를 FinancialItem으로 변환
  const items = migrateOnboardingToFinancialItems(data, "simulation");

  // 글로벌 설정 (우선순위: globalSettings > data.globalSettings > 기본값)
  const gs = globalSettings || data.globalSettings || DEFAULT_GLOBAL_SETTINGS;

  // 설정값 (GlobalSettings + 시나리오 모드 적용)
  const investmentReturn =
    getEffectiveRate(
      gs.investmentReturnRate ??
        settings?.investmentReturn ??
        DEFAULT_RATES.investmentReturn,
      "investment",
      gs.scenarioMode,
      gs,
    ) / 100;
  const inflationRate =
    getEffectiveRate(
      gs.inflationRate ??
        settings?.inflationRate ??
        DEFAULT_RATES.expenseGrowth,
      "inflation",
      gs.scenarioMode,
      gs,
    ) / 100;
  // incomeGrowthRate, realEstateGrowthRate는 항목별로 적용하므로 여기서는 기본값만 저장
  const incomeGrowthRate =
    (gs.incomeGrowthRate ?? DEFAULT_RATES.incomeGrowth) / 100;
  const realEstateGrowthRate =
    (gs.realEstateGrowthRate ?? DEFAULT_RATES.realEstateGrowth) / 100;

  const snapshots: YearlySnapshot[] = [];

  // 초기 자산 상태 계산
  let accumulatedSavings = calculateInitialSavings(items);
  let accumulatedPension = calculateInitialPension(items);
  let currentDebt = calculateInitialDebt(items);

  // 연도별 시뮬레이션
  for (let year = currentYear; year <= endYear; year++) {
    const age = year - birthYear;
    const yearsSinceStart = year - currentYear;

    // 해당 연도의 활성 항목 필터링
    const activeItems = items.filter((item) => isItemActiveInYear(item, year));

    // owner를 한글로 변환
    const ownerLabels: Record<string, string> = {
      self: "본인",
      spouse: "배우자",
      child: "자녀",
      common: "공동",
    };

    // 소득 계산 (성장률 반영, GlobalSettings 우선)
    const incomeItems = activeItems.filter((i) => i.category === "income");
    const incomeBreakdown = incomeItems.map((item) => {
      const incomeData = item.data as IncomeData;
      // rateCategory 기반으로 시나리오 상승률 적용
      const rateCategory =
        incomeData.rateCategory || getDefaultRateCategory(item.type);
      const baseRate = incomeData.growthRate ?? gs.incomeGrowthRate;
      const effectiveRate = getEffectiveRate(
        baseRate,
        rateCategory,
        gs.scenarioMode,
        gs,
      );
      const itemGrowthRate = effectiveRate / 100;
      const amount =
        incomeData.amount * Math.pow(1 + itemGrowthRate, yearsSinceStart) * 12;
      // 형식: "title | owner"
      const ownerLabel = item.owner ? ownerLabels[item.owner] || "" : "";
      const displayTitle = ownerLabel
        ? `${item.title} | ${ownerLabel}`
        : item.title;
      return {
        title: displayTitle,
        amount: Math.round(amount),
        type: item.type,
      };
    });

    // 총 소득 (연금/임대 소득도 category: 'income'으로 저장되므로 별도 처리 불필요)
    const totalIncome = incomeBreakdown.reduce((sum, i) => sum + i.amount, 0);

    // 지출 계산 (물가 상승률 반영, GlobalSettings 우선)
    const expenseItems = activeItems.filter((i) => i.category === "expense");
    const regularExpenseBreakdown = expenseItems.map((item) => {
      const expenseData = item.data as ExpenseData;
      // rateCategory 기반으로 시나리오 상승률 적용
      const rateCategory =
        expenseData.rateCategory || getDefaultRateCategory(item.type);
      const baseRate = expenseData.growthRate ?? gs.inflationRate;
      const effectiveRate = getEffectiveRate(
        baseRate,
        rateCategory,
        gs.scenarioMode,
        gs,
      );
      const itemGrowthRate = effectiveRate / 100;
      const itemStartYear = item.start_year || currentYear;
      const yearsFromItemStart = Math.max(0, year - itemStartYear);
      const amount =
        expenseData.amount *
        Math.pow(1 + itemGrowthRate, yearsFromItemStart) *
        12;
      // 형식: "지출명 | owner"
      const ownerLabel = item.owner ? ownerLabels[item.owner] || "" : "";
      const displayTitle = ownerLabel
        ? `${item.title} | ${ownerLabel}`
        : item.title;
      return {
        title: displayTitle,
        amount: Math.round(amount),
        type: item.type,
      };
    });

    // 월세 지출 계산
    const realEstateItemsForRent = activeItems.filter(
      (i) => i.category === "real_estate",
    );
    const rentExpenseBreakdown: { title: string; amount: number }[] = [];
    realEstateItemsForRent.forEach((item) => {
      const reData = item.data as RealEstateData;
      if (
        reData.housingType === "월세" &&
        reData.monthlyRent &&
        reData.monthlyRent > 0
      ) {
        const itemStartYear = item.start_year || currentYear;
        const yearsFromStart = Math.max(0, year - itemStartYear);
        const adjustedRent =
          reData.monthlyRent * Math.pow(1 + inflationRate, yearsFromStart) * 12;
        // 형식: "월세 | owner"
        const ownerLabel = item.owner ? ownerLabels[item.owner] || "" : "";
        const rentTitle = ownerLabel
          ? `${item.title} 월세 | ${ownerLabel}`
          : `${item.title} 월세`;
        rentExpenseBreakdown.push({
          title: rentTitle,
          amount: Math.round(adjustedRent),
        });
      }
    });

    // 전체 지출 = 일반 지출 + 월세 지출
    const expenseBreakdown = [
      ...regularExpenseBreakdown,
      ...rentExpenseBreakdown,
    ];
    const totalExpense = expenseBreakdown.reduce((sum, e) => sum + e.amount, 0);

    // 순현금흐름
    const netCashFlow = totalIncome - totalExpense;

    // 부채 상환 (정확한 상환 방식별 계산)
    const debtItems = items.filter((i) => i.category === "debt");
    const debtBreakdown = debtItems
      .filter((item) => {
        const itemEndYear = item.end_year || 9999;
        return year <= itemEndYear;
      })
      .map((item) => {
        const debtData = item.data as DebtData;
        const itemEndYear = item.end_year || currentYear + 30;
        const itemEndMonth = item.end_month || 12;

        if (year > itemEndYear) return { title: item.title, amount: 0 };

        // 실효 금리 계산 (변동금리 지원)
        const effectiveRate = getEffectiveDebtRate(debtData, gs);
        const maturityDate = `${itemEndYear}-${String(itemEndMonth).padStart(2, "0")}`;
        const repaymentType = debtData.repaymentType || "원리금균등상환";

        // 정확한 잔액 계산
        const asOfDate = new Date(year, 5, 30); // 6월 30일 기준
        const balanceResult = calculateRemainingBalance(
          {
            principal: debtData.currentBalance || debtData.principal,
            annualRate: effectiveRate,
            maturityDate,
            repaymentType: repaymentType as RepaymentType,
            loanStartDate: item.start_year
              ? `${item.start_year}-${String(item.start_month || 1).padStart(2, "0")}`
              : undefined,
          },
          asOfDate,
        );

        return {
          title: item.title,
          amount: Math.round(balanceResult.remainingPrincipal),
        };
      });
    const totalDebts = debtBreakdown.reduce((sum, d) => sum + d.amount, 0);

    // 금융자산 성장 (투자수익률 반영)
    accumulatedSavings =
      accumulatedSavings * (1 + investmentReturn) + Math.max(0, netCashFlow);

    // 연금자산 성장 (은퇴 전까지)
    if (year < retirementYear) {
      accumulatedPension = accumulatedPension * (1 + investmentReturn);
    } else {
      // 은퇴 후 연금 인출 (연금 데이터의 수령 기간 활용)
      // 각 연금 항목의 수령 기간을 고려한 인출
      const pensionAssetItems = items.filter((i) => i.category === "pension");
      const pensionDataItems = pensionAssetItems.map(
        (item) => item.data as PensionData,
      );

      // 평균 수령 기간 계산 (기본값: 20년)
      const totalReceivingYears = pensionDataItems.reduce((sum, pd) => {
        return sum + (pd.paymentYears || pd.receivingYears || 20);
      }, 0);
      const avgReceivingYears =
        pensionDataItems.length > 0
          ? totalReceivingYears / pensionDataItems.length
          : 20;

      // 연금 현가 기반 인출액 계산
      const pensionWithdrawal = calculateAnnualPensionWithdrawal(
        accumulatedPension,
        avgReceivingYears,
        investmentReturn * 100,
      );
      accumulatedPension = Math.max(0, accumulatedPension - pensionWithdrawal);
    }

    // 부동산 가치 계산 (GlobalSettings 우선)
    const realEstateItems = items.filter((i) => i.category === "real_estate");
    const realEstateValue = realEstateItems.reduce((sum, item) => {
      const reData = item.data as RealEstateData;
      if (reData.housingType === "자가") {
        // rateCategory 기반으로 시나리오 상승률 적용
        const baseRate = reData.appreciationRate ?? gs.realEstateGrowthRate;
        const effectiveRate = getEffectiveRate(
          baseRate,
          "realEstate",
          gs.scenarioMode,
          gs,
        );
        const itemGrowthRate = effectiveRate / 100;
        return (
          sum +
          (reData.currentValue || 0) *
            Math.pow(1 + itemGrowthRate, yearsSinceStart)
        );
      }
      return sum;
    }, 0);

    // 전세보증금 (자산으로 계산)
    const depositValue = realEstateItems.reduce((sum, item) => {
      const reData = item.data as RealEstateData;
      if (reData.housingType === "전세" || reData.housingType === "월세") {
        return sum + (reData.deposit || 0);
      }
      return sum;
    }, 0);

    // 자산 breakdown - 개별 항목으로 상세 표시
    const assetBreakdown: { title: string; amount: number }[] = [];

    // 부동산 개별 항목
    realEstateItems.forEach((item) => {
      const reData = item.data as RealEstateData;
      if (
        reData.housingType === "자가" &&
        reData.currentValue &&
        reData.currentValue > 0
      ) {
        // rateCategory 기반으로 시나리오 상승률 적용
        const baseRate = reData.appreciationRate ?? gs.realEstateGrowthRate;
        const effectiveRate = getEffectiveRate(
          baseRate,
          "realEstate",
          gs.scenarioMode,
          gs,
        );
        const itemGrowthRate = effectiveRate / 100;
        const value =
          reData.currentValue * Math.pow(1 + itemGrowthRate, yearsSinceStart);
        const ownerLabel = item.owner ? ownerLabels[item.owner] || "" : "";
        const displayTitle = ownerLabel
          ? `${item.title} | ${ownerLabel}`
          : item.title;
        assetBreakdown.push({ title: displayTitle, amount: Math.round(value) });
      }
    });

    // 전세보증금 개별 항목
    realEstateItems.forEach((item) => {
      const reData = item.data as RealEstateData;
      if (
        (reData.housingType === "전세" || reData.housingType === "월세") &&
        reData.deposit &&
        reData.deposit > 0
      ) {
        const ownerLabel = item.owner ? ownerLabels[item.owner] || "" : "";
        const displayTitle = ownerLabel
          ? `${item.title} 보증금 | ${ownerLabel}`
          : `${item.title} 보증금`;
        assetBreakdown.push({
          title: displayTitle,
          amount: Math.round(reData.deposit),
        });
      }
    });

    // 금융자산 개별 항목으로 표시
    const savingsItems = items.filter((i) => i.category === "savings");
    if (accumulatedSavings > 0 && savingsItems.length > 0) {
      // 저축 항목별 초기 잔액 비율로 분배
      const totalInitialSavings = savingsItems.reduce((sum, item) => {
        const savingsData = item.data as SavingsData;
        return sum + (savingsData.currentBalance || 0);
      }, 0);

      if (totalInitialSavings > 0) {
        savingsItems.forEach((item) => {
          const savingsData = item.data as SavingsData;
          const initialBalance = savingsData.currentBalance || 0;
          const ratio = initialBalance / totalInitialSavings;
          const currentValue = accumulatedSavings * ratio;
          if (currentValue > 0) {
            const ownerLabel = item.owner ? ownerLabels[item.owner] || "" : "";
            const displayTitle = ownerLabel
              ? `${item.title} | ${ownerLabel}`
              : item.title;
            assetBreakdown.push({
              title: displayTitle,
              amount: Math.round(currentValue),
            });
          }
        });
      } else {
        // 초기 잔액이 없지만 누적 저축이 있는 경우
        assetBreakdown.push({
          title: "금융자산",
          amount: Math.round(accumulatedSavings),
        });
      }
    } else if (accumulatedSavings > 0) {
      assetBreakdown.push({
        title: "금융자산",
        amount: Math.round(accumulatedSavings),
      });
    }

    // 연금 breakdown - 개별 연금 항목으로 표시
    const pensionBreakdownItems = items.filter((i) => i.category === "pension");
    const pensionBreakdown: { title: string; amount: number }[] = [];

    if (accumulatedPension > 0 && pensionBreakdownItems.length > 0) {
      // 연금 항목별 초기 잔액 비율로 분배
      const totalInitialPension = pensionBreakdownItems.reduce((sum, item) => {
        const pensionData = item.data as PensionData;
        return sum + (pensionData.currentBalance || 0);
      }, 0);

      if (totalInitialPension > 0) {
        pensionBreakdownItems.forEach((item) => {
          const pensionData = item.data as PensionData;
          const initialBalance = pensionData.currentBalance || 0;
          const ratio = initialBalance / totalInitialPension;
          const currentValue = accumulatedPension * ratio;
          if (currentValue > 0) {
            const ownerLabel = item.owner ? ownerLabels[item.owner] || "" : "";
            const displayTitle = ownerLabel
              ? `${item.title} | ${ownerLabel}`
              : item.title;
            pensionBreakdown.push({
              title: displayTitle,
              amount: Math.round(currentValue),
            });
          }
        });
      } else {
        pensionBreakdown.push({
          title: "연금자산",
          amount: Math.round(accumulatedPension),
        });
      }
    } else if (accumulatedPension > 0) {
      pensionBreakdown.push({
        title: "연금자산",
        amount: Math.round(accumulatedPension),
      });
    }

    // 총자산
    const financialAssets = Math.round(accumulatedSavings);
    const pensionAssets = Math.round(accumulatedPension);
    const totalAssets = Math.round(
      realEstateValue + depositValue + financialAssets + pensionAssets,
    );

    // 순자산
    const netWorth = totalAssets - totalDebts;

    snapshots.push({
      year,
      age,
      totalIncome: Math.round(totalIncome),
      totalExpense: Math.round(totalExpense),
      netCashFlow: Math.round(netCashFlow),
      totalAssets,
      realEstateValue: Math.round(realEstateValue + depositValue),
      financialAssets,
      pensionAssets,
      totalDebts,
      netWorth,
      incomeBreakdown,
      expenseBreakdown,
      assetBreakdown,
      debtBreakdown,
      pensionBreakdown,
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

  // FI 목표 (연간 지출 x 25)
  const annualExpense = currentSnapshot.totalExpense;
  const fiTarget = annualExpense * 25;
  const fiSnapshot = snapshots.find((s) => s.netWorth >= fiTarget);

  // 파산 감지 (금융자산 < 0인 첫 연도)
  const bankruptcySnapshot = snapshots.find((s) => s.financialAssets < 0);

  return {
    startYear: currentYear,
    endYear,
    retirementYear,
    snapshots,
    summary: {
      currentNetWorth: currentSnapshot.netWorth,
      retirementNetWorth: retirementSnapshot.netWorth,
      peakNetWorth: peakSnapshot.netWorth,
      peakNetWorthYear: peakSnapshot.year,
      yearsToFI: fiSnapshot ? fiSnapshot.year - currentYear : null,
      fiTarget,
      bankruptcyYear: bankruptcySnapshot ? bankruptcySnapshot.year : null,
    },
  };
}

/**
 * FinancialItem[]에서 직접 시뮬레이션 실행
 * - 데이터 변환 없이 바로 사용
 * - 대시보드에서 사용
 * @param items 재무 항목 배열
 * @param profile 프로필 정보 (생년, 은퇴 나이 등)
 * @param globalSettings 글로벌 설정
 * @param yearsToSimulate 시뮬레이션 기간 (년)
 * @param assumptions Investment Assumptions (있으면 globalSettings보다 우선)
 * @param priorities Cash Flow Priorities (잉여금 배분 규칙)
 */
export function runSimulationFromItems(
  items: FinancialItem[],
  profile: SimulationProfile,
  globalSettings: GlobalSettings,
  yearsToSimulate: number = 50,
  assumptions?: InvestmentAssumptions,
  priorities?: CashFlowPriorities,
): SimulationResult {
  const currentYear = new Date().getFullYear();
  const { birthYear, retirementAge, spouseBirthYear } = profile;
  const retirementYear = birthYear + retirementAge;
  const endYear = currentYear + yearsToSimulate;

  // owner에 따른 생년 반환 (연금 수령 시작 연도 계산용)
  const getOwnerBirthYear = (owner?: string) => {
    if (owner === "spouse" && spouseBirthYear) return spouseBirthYear;
    return birthYear;
  };

  // 글로벌 설정
  const gs = globalSettings || DEFAULT_GLOBAL_SETTINGS;

  // Investment Assumptions (있으면 우선 적용)
  const rates = assumptions?.rates;

  // 설정값 (InvestmentAssumptions > GlobalSettings > 기본값)
  const investmentReturn =
    rates?.investment !== undefined
      ? rates.investment / 100
      : getEffectiveRate(
          gs.investmentReturnRate ?? DEFAULT_RATES.investmentReturn,
          "investment",
          gs.scenarioMode,
          gs,
        ) / 100;

  const inflationRate =
    rates?.inflation !== undefined
      ? rates.inflation / 100
      : getEffectiveRate(
          gs.inflationRate ?? DEFAULT_RATES.expenseGrowth,
          "inflation",
          gs.scenarioMode,
          gs,
        ) / 100;

  // 저축 수익률 (예금/적금용)
  const savingsReturn =
    rates?.savings !== undefined
      ? rates.savings / 100
      : (gs.savingsGrowthRate ?? DEFAULT_RATES.depositRate ?? 3.0) / 100;

  // 연금 수익률
  const pensionReturn =
    rates?.pension !== undefined ? rates.pension / 100 : investmentReturn; // 기본적으로 투자 수익률 사용

  // incomeGrowthRate, realEstateGrowthRate는 항목별로 적용하므로 여기서는 기본값만 저장
  const incomeGrowthRate =
    (gs.incomeGrowthRate ?? DEFAULT_RATES.incomeGrowth) / 100;
  const realEstateGrowthRate =
    rates?.realEstate !== undefined
      ? rates.realEstate / 100
      : (gs.realEstateGrowthRate ?? DEFAULT_RATES.realEstateGrowth) / 100;

  const snapshots: YearlySnapshot[] = [];

  // 초기 자산 상태 계산
  let accumulatedSavings = calculateInitialSavingsFromItems(items);
  let accumulatedPension = calculateInitialPensionFromItems(items);

  // 연도별 시뮬레이션
  for (let year = currentYear; year <= endYear; year++) {
    const age = year - birthYear;
    const yearsSinceStart = year - currentYear;

    // 해당 연도의 활성 항목 필터링
    const activeItems = items.filter((item) => isItemActiveInYear(item, year));

    // 소득 타입 한글 매핑
    const incomeTypeLabels: Record<string, string> = {
      labor: "근로소득",
      business: "사업소득",
      rental: "임대소득",
      pension: "연금소득",
      dividend: "배당소득",
      interest: "이자소득",
      bonus: "상여금",
      other: "기타소득",
    };

    // owner를 한글로 변환
    const ownerLabels: Record<string, string> = {
      self: "본인",
      spouse: "배우자",
      child: "자녀",
      common: "공동",
    };

    // 소득 계산 (월별 일할 계산 + 상승률 반영)
    const incomeItems = activeItems.filter((i) => i.category === "income");
    const incomeBreakdown = incomeItems.map((item) => {
      const incomeData = item.data as IncomeData;
      // rateCategory 기반으로 시나리오 상승률 적용
      const rateCategory =
        incomeData.rateCategory || getDefaultRateCategory(item.type);
      const baseRate = incomeData.growthRate ?? gs.incomeGrowthRate;
      const effectiveRate = getEffectiveRate(
        baseRate,
        rateCategory,
        gs.scenarioMode,
        gs,
      );
      const itemGrowthRate = effectiveRate / 100;

      // 월 기준 금액
      const monthlyAmount =
        incomeData.frequency === "yearly"
          ? incomeData.amount / 12
          : incomeData.amount;

      // 월별 일할 계산으로 연간 금액 산출
      const amount = calculateYearlyAmountWithProrating(
        monthlyAmount,
        itemGrowthRate,
        item.start_year || currentYear,
        item.start_month || 1,
        item.end_year,
        item.end_month,
        year,
      );
      // 형식: "타입 | owner" (예: "근로소득 | 본인")
      const ownerLabel = ownerLabels[item.owner] || "";
      const typeLabel = incomeTypeLabels[item.type] || item.type;
      const displayTitle = ownerLabel
        ? `${typeLabel} | ${ownerLabel}`
        : typeLabel;
      return {
        title: displayTitle,
        amount: Math.round(amount),
        type: item.type,
      };
    });
    // 총 소득 (연금/임대 소득도 category: 'income'으로 저장되므로 별도 처리 불필요)
    const totalIncome = incomeBreakdown.reduce((sum, i) => sum + i.amount, 0);

    // 지출 계산 (월별 일할 계산 + 물가 상승률 반영)
    const expenseItems = activeItems.filter((i) => i.category === "expense");
    const regularExpenseBreakdown = expenseItems.map((item) => {
      const expenseData = item.data as ExpenseData;
      // rateCategory 기반으로 시나리오 상승률 적용
      const rateCategory =
        expenseData.rateCategory || getDefaultRateCategory(item.type);
      const baseRate = expenseData.growthRate ?? gs.inflationRate;
      const effectiveRate = getEffectiveRate(
        baseRate,
        rateCategory,
        gs.scenarioMode,
        gs,
      );
      const itemGrowthRate = effectiveRate / 100;

      // 월 기준 금액
      const monthlyAmount =
        expenseData.frequency === "yearly"
          ? expenseData.amount / 12
          : expenseData.amount;

      // 월별 일할 계산으로 연간 금액 산출
      const amount = calculateYearlyAmountWithProrating(
        monthlyAmount,
        itemGrowthRate,
        item.start_year || currentYear,
        item.start_month || 1,
        item.end_year,
        item.end_month,
        year,
      );
      // 형식: "지출명 | owner" (예: "생활비 | 공동")
      const ownerLabel = ownerLabels[item.owner] || "";
      const displayTitle = ownerLabel
        ? `${item.title} | ${ownerLabel}`
        : item.title;
      return {
        title: displayTitle,
        amount: Math.round(amount),
        type: item.type,
      };
    });

    // 전체 지출 = 지출 테이블 데이터만 사용 (연동 지출 포함)
    // 부채 이자/원금, 월세 등은 이미 expenses 테이블에 연동 지출로 저장됨
    const expenseBreakdown = [...regularExpenseBreakdown];
    const totalExpense = expenseBreakdown.reduce((sum, e) => sum + e.amount, 0);

    // 순현금흐름
    const netCashFlow = totalIncome - totalExpense;

    // 부채 잔액 계산 (연도 말 기준)
    const debtItems = items.filter((i) => i.category === "debt");
    const debtBreakdown = debtItems
      .filter((item) => {
        const itemStartYear = item.start_year || currentYear;
        const itemEndYear = item.end_year || 9999;
        return year >= itemStartYear && year <= itemEndYear;
      })
      .map((item) => {
        const debtData = item.data as DebtData;
        const itemStartYear = item.start_year || currentYear;
        const itemStartMonth = item.start_month || 1;
        const itemEndYear = item.end_year || currentYear + 30;
        const itemEndMonth = item.end_month || 12;

        const effectiveRate = getEffectiveDebtRate(debtData, gs);
        const principal = debtData.currentBalance || debtData.principal || 0;
        const repaymentType = (debtData.repaymentType || "원리금균등상환") as
          | "만기일시상환"
          | "원리금균등상환"
          | "원금균등상환";

        // 연도 말 기준 잔액 계산
        const remainingBalance = calculateRemainingBalanceAtYearEnd(
          principal,
          effectiveRate,
          itemStartYear,
          itemStartMonth,
          itemEndYear,
          itemEndMonth,
          year,
          repaymentType,
        );

        return { title: item.title, amount: remainingBalance };
      });
    const totalDebts = debtBreakdown.reduce((sum, d) => sum + d.amount, 0);

    // 금융자산 성장 (투자수익률 반영)
    accumulatedSavings = accumulatedSavings * (1 + investmentReturn);

    // 잉여금 배분 (Cash Flow Priorities 적용)
    if (netCashFlow > 0) {
      let remainingSurplus = netCashFlow;
      let pensionAllocation = 0;
      let debtAllocation = 0;

      // V1 엔진에서는 CashFlowPriorities V2 규칙 미적용 (V2 엔진에서만 동작)
      // priorities 파라미터는 타입 호환만 유지

      // 배분 결과 적용
      // - 연금 배분액은 accumulatedPension에 추가
      // - 부채 상환액은 잉여금에서 차감 (현재 모델에서는 부채 잔액에 직접 반영 안됨)
      // - 나머지(savings, investment, 미배분)는 모두 금융자산으로
      const financialAllocation =
        netCashFlow - pensionAllocation - debtAllocation;
      accumulatedSavings += financialAllocation;
      accumulatedPension += pensionAllocation;
    }

    // 연금자산 성장 (pensionReturn 적용)
    if (year < retirementYear) {
      accumulatedPension = accumulatedPension * (1 + pensionReturn);
    } else {
      // 은퇴 후 연금 인출
      const pensionItems = items.filter((i) => i.category === "pension");
      const pensionDataItems = pensionItems.map(
        (item) => item.data as PensionData,
      );
      const totalReceivingYears = pensionDataItems.reduce((sum, pd) => {
        return sum + (pd.paymentYears || pd.receivingYears || 20);
      }, 0);
      const avgReceivingYears =
        pensionDataItems.length > 0
          ? totalReceivingYears / pensionDataItems.length
          : 20;
      const pensionWithdrawal = calculateAnnualPensionWithdrawal(
        accumulatedPension,
        avgReceivingYears,
        pensionReturn * 100,
      );
      accumulatedPension = Math.max(0, accumulatedPension - pensionWithdrawal);
    }

    // 부동산 가치 계산
    const realEstateItems = items.filter((i) => i.category === "real_estate");
    const realEstateValue = realEstateItems.reduce((sum, item) => {
      const reData = item.data as RealEstateData;
      if (reData.housingType === "자가" || !reData.housingType) {
        // rateCategory 기반으로 시나리오 상승률 적용
        const baseRate = reData.appreciationRate ?? gs.realEstateGrowthRate;
        const effectiveRate = getEffectiveRate(
          baseRate,
          "realEstate",
          gs.scenarioMode,
          gs,
        );
        const itemGrowthRate = effectiveRate / 100;
        return (
          sum +
          (reData.currentValue || 0) *
            Math.pow(1 + itemGrowthRate, yearsSinceStart)
        );
      }
      return sum;
    }, 0);

    // 전세보증금
    const depositValue = realEstateItems.reduce((sum, item) => {
      const reData = item.data as RealEstateData;
      if (reData.housingType === "전세" || reData.housingType === "월세") {
        return sum + (reData.deposit || 0);
      }
      return sum;
    }, 0);

    // 자산 breakdown - 개별 항목으로 상세 표시
    const assetBreakdown: { title: string; amount: number }[] = [];

    // 부동산 개별 항목
    realEstateItems.forEach((item) => {
      const reData = item.data as RealEstateData;
      if (
        (reData.housingType === "자가" || !reData.housingType) &&
        reData.currentValue &&
        reData.currentValue > 0
      ) {
        // rateCategory 기반으로 시나리오 상승률 적용
        const baseRate = reData.appreciationRate ?? gs.realEstateGrowthRate;
        const effectiveRate = getEffectiveRate(
          baseRate,
          "realEstate",
          gs.scenarioMode,
          gs,
        );
        const itemGrowthRate = effectiveRate / 100;
        const value =
          reData.currentValue * Math.pow(1 + itemGrowthRate, yearsSinceStart);
        const ownerLabel = ownerLabels[item.owner] || "";
        const displayTitle = ownerLabel
          ? `${item.title} | ${ownerLabel}`
          : item.title;
        assetBreakdown.push({ title: displayTitle, amount: Math.round(value) });
      }
    });

    // 전세보증금 개별 항목
    realEstateItems.forEach((item) => {
      const reData = item.data as RealEstateData;
      if (
        (reData.housingType === "전세" || reData.housingType === "월세") &&
        reData.deposit &&
        reData.deposit > 0
      ) {
        const ownerLabel = ownerLabels[item.owner] || "";
        const displayTitle = ownerLabel
          ? `${item.title} 보증금 | ${ownerLabel}`
          : `${item.title} 보증금`;
        assetBreakdown.push({
          title: displayTitle,
          amount: Math.round(reData.deposit),
        });
      }
    });

    // 금융자산 개별 항목으로 표시
    const savingsItems = items.filter((i) => i.category === "savings");
    if (accumulatedSavings > 0 && savingsItems.length > 0) {
      // 저축 항목별 초기 잔액 비율로 분배
      const totalInitialSavings = savingsItems.reduce((sum, item) => {
        const savingsData = item.data as SavingsData;
        return sum + (savingsData.currentBalance || 0);
      }, 0);

      if (totalInitialSavings > 0) {
        savingsItems.forEach((item) => {
          const savingsData = item.data as SavingsData;
          const initialBalance = savingsData.currentBalance || 0;
          const ratio = initialBalance / totalInitialSavings;
          const currentValue = accumulatedSavings * ratio;
          if (currentValue > 0) {
            const ownerLabel = ownerLabels[item.owner] || "";
            const displayTitle = ownerLabel
              ? `${item.title} | ${ownerLabel}`
              : item.title;
            assetBreakdown.push({
              title: displayTitle,
              amount: Math.round(currentValue),
            });
          }
        });
      } else {
        // 초기 잔액이 없지만 누적 저축이 있는 경우
        assetBreakdown.push({
          title: "금융자산",
          amount: Math.round(accumulatedSavings),
        });
      }
    } else if (accumulatedSavings > 0) {
      assetBreakdown.push({
        title: "금융자산",
        amount: Math.round(accumulatedSavings),
      });
    }

    // 연금 breakdown - 개별 연금 항목으로 표시
    const pensionBreakdownItems = items.filter((i) => i.category === "pension");
    const pensionBreakdown: { title: string; amount: number }[] = [];

    if (accumulatedPension > 0 && pensionBreakdownItems.length > 0) {
      // 연금 항목별 초기 잔액 비율로 분배
      const totalInitialPension = pensionBreakdownItems.reduce((sum, item) => {
        const pensionData = item.data as PensionData;
        return sum + (pensionData.currentBalance || 0);
      }, 0);

      if (totalInitialPension > 0) {
        pensionBreakdownItems.forEach((item) => {
          const pensionData = item.data as PensionData;
          const initialBalance = pensionData.currentBalance || 0;
          const ratio = initialBalance / totalInitialPension;
          const currentValue = accumulatedPension * ratio;
          if (currentValue > 0) {
            const ownerLabel = ownerLabels[item.owner] || "";
            const displayTitle = ownerLabel
              ? `${item.title} | ${ownerLabel}`
              : item.title;
            pensionBreakdown.push({
              title: displayTitle,
              amount: Math.round(currentValue),
            });
          }
        });
      } else {
        pensionBreakdown.push({
          title: "연금자산",
          amount: Math.round(accumulatedPension),
        });
      }
    } else if (accumulatedPension > 0) {
      pensionBreakdown.push({
        title: "연금자산",
        amount: Math.round(accumulatedPension),
      });
    }

    // 총자산
    const financialAssets = Math.round(accumulatedSavings);
    const pensionAssets = Math.round(accumulatedPension);
    const totalAssets = Math.round(
      realEstateValue + depositValue + financialAssets + pensionAssets,
    );

    // 순자산
    const netWorth = totalAssets - totalDebts;

    snapshots.push({
      year,
      age,
      totalIncome: Math.round(totalIncome),
      totalExpense: Math.round(totalExpense),
      netCashFlow: Math.round(netCashFlow),
      totalAssets,
      realEstateValue: Math.round(realEstateValue + depositValue),
      financialAssets,
      pensionAssets,
      totalDebts,
      netWorth,
      incomeBreakdown,
      expenseBreakdown,
      assetBreakdown,
      debtBreakdown,
      pensionBreakdown,
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

  // FI 목표 (연간 지출 x 25)
  const annualExpense = currentSnapshot.totalExpense;
  const fiTarget = annualExpense * 25;
  const fiSnapshot = snapshots.find((s) => s.netWorth >= fiTarget);

  // 파산 감지 (금융자산 < 0인 첫 연도)
  const bankruptcySnapshot = snapshots.find((s) => s.financialAssets < 0);

  return {
    startYear: currentYear,
    endYear,
    retirementYear,
    snapshots,
    summary: {
      currentNetWorth: currentSnapshot.netWorth,
      retirementNetWorth: retirementSnapshot.netWorth,
      peakNetWorth: peakSnapshot.netWorth,
      peakNetWorthYear: peakSnapshot.year,
      yearsToFI: fiSnapshot ? fiSnapshot.year - currentYear : null,
      fiTarget,
      bankruptcyYear: bankruptcySnapshot ? bankruptcySnapshot.year : null,
    },
  };
}

// ============================================
// 헬퍼 함수
// ============================================

function calculateInitialSavings(items: FinancialItemInput[]): number {
  return items
    .filter((i) => i.category === "savings")
    .reduce((sum, item) => {
      const data = item.data as SavingsData;
      return sum + (data.currentBalance || 0);
    }, 0);
}

function calculateInitialPension(items: FinancialItemInput[]): number {
  return items
    .filter((i) => i.category === "pension")
    .reduce((sum, item) => {
      const data = item.data as PensionData;
      return sum + (data.currentBalance || 0);
    }, 0);
}

function calculateInitialDebt(items: FinancialItemInput[]): number {
  return items
    .filter((i) => i.category === "debt")
    .reduce((sum, item) => {
      const data = item.data as DebtData;
      return sum + (data.currentBalance || data.principal || 0);
    }, 0);
}

// FinancialItem[] 용 헬퍼 함수
function calculateInitialSavingsFromItems(items: FinancialItem[]): number {
  return items
    .filter((i) => i.category === "savings")
    .reduce((sum, item) => {
      const data = item.data as SavingsData;
      return sum + (data.currentBalance || 0);
    }, 0);
}

function calculateInitialPensionFromItems(items: FinancialItem[]): number {
  return items
    .filter((i) => i.category === "pension")
    .reduce((sum, item) => {
      const data = item.data as PensionData;
      return sum + (data.currentBalance || 0);
    }, 0);
}

// ============================================
// 간단한 현재 상태 계산 (대시보드용)
// ============================================

export interface CurrentFinancialState {
  // 월간 현금흐름
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySavings: number;
  savingsRate: number;

  // 자산
  totalAssets: number;
  realEstateAssets: number;
  depositAssets: number; // 전세보증금
  cashAssets: number;
  investmentAssets: number;
  pensionAssets: number;

  // 부채
  totalDebts: number;
  housingDebt: number;
  otherDebts: number;

  // 순자산
  netWorth: number;

  // 비율
  debtToAssetRatio: number; // 부채비율
  debtToIncomeRatio: number; // DTI
}

/**
 * OnboardingData에서 현재 재무 상태 계산
 */
export function calculateCurrentState(
  data: OnboardingData,
): CurrentFinancialState {
  // 월간 소득
  const monthlyIncome =
    (data.laborIncome || 0) +
    (data.spouseLaborIncome || 0) +
    (data.businessIncome || 0) +
    (data.spouseBusinessIncome || 0);

  // 월간 지출
  const monthlyExpense =
    (data.livingExpenses || 0) +
    (data.housingRent || 0) +
    (data.housingMaintenance || 0);

  // 월간 저축
  const monthlySavings = monthlyIncome - monthlyExpense;
  const savingsRate =
    monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

  // 부동산 자산
  const realEstateAssets =
    data.housingType === "자가" ? data.housingValue || 0 : 0;
  const depositAssets =
    data.housingType === "전세" || data.housingType === "월세"
      ? data.housingValue || 0
      : 0;

  // 금융자산 (savingsAccounts, investmentAccounts 배열에서 합산)
  let cashAssets = 0;
  if (data.savingsAccounts) {
    data.savingsAccounts.forEach((account) => {
      cashAssets += account.balance || 0;
    });
  }
  let investmentAssets = 0;
  if (data.investmentAccounts) {
    data.investmentAccounts.forEach((account) => {
      investmentAssets += account.balance || 0;
    });
  }

  // 연금자산
  const pensionAssets =
    (data.retirementPensionBalance || 0) +
    (data.irpBalance || 0) +
    (data.pensionSavingsBalance || 0) +
    (data.isaBalance || 0);

  // 총 자산
  const totalAssets =
    realEstateAssets +
    depositAssets +
    cashAssets +
    investmentAssets +
    pensionAssets;

  // 부채
  const housingDebt = data.housingHasLoan ? data.housingLoan || 0 : 0;
  const otherDebts =
    data.debts?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
  const totalDebts = housingDebt + otherDebts;

  // 순자산
  const netWorth = totalAssets - totalDebts;

  // 비율
  const debtToAssetRatio =
    totalAssets > 0 ? (totalDebts / totalAssets) * 100 : 0;
  const annualIncome = monthlyIncome * 12;
  const debtToIncomeRatio =
    annualIncome > 0 ? (totalDebts / annualIncome) * 100 : 0;

  return {
    monthlyIncome,
    monthlyExpense,
    monthlySavings,
    savingsRate,
    totalAssets,
    realEstateAssets,
    depositAssets,
    cashAssets,
    investmentAssets,
    pensionAssets,
    totalDebts,
    housingDebt,
    otherDebts,
    netWorth,
    debtToAssetRatio,
    debtToIncomeRatio,
  };
}

// ============================================
// 목표 달성 계산
// ============================================

export interface GoalProgress {
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  remainingAmount: number;
  estimatedYears: number | null; // 달성까지 예상 년수
}

/**
 * 은퇴 목표 진행률 계산
 */
export function calculateRetirementGoalProgress(
  data: OnboardingData,
  settings?: Partial<SimulationSettings>,
): GoalProgress {
  const state = calculateCurrentState(data);
  const simulation = runSimulation(data, settings, 50);

  const targetAmount = data.target_retirement_fund || 0;
  const currentAmount = state.netWorth;
  const progressPercent =
    targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 0;
  const remainingAmount = Math.max(0, targetAmount - currentAmount);

  // 목표 달성 예상 년수
  const targetSnapshot = simulation.snapshots.find(
    (s) => s.netWorth >= targetAmount,
  );
  const estimatedYears = targetSnapshot
    ? targetSnapshot.year - new Date().getFullYear()
    : null;

  return {
    targetAmount,
    currentAmount,
    progressPercent,
    remainingAmount,
    estimatedYears,
  };
}

/**
 * 마일스톤 계산
 */
export interface Milestone {
  name: string;
  target: number;
  achieved: boolean;
  estimatedYear: number | null;
  estimatedAge: number | null;
}

export function calculateMilestones(
  data: OnboardingData,
  settings?: Partial<SimulationSettings>,
): Milestone[] {
  const state = calculateCurrentState(data);
  const simulation = runSimulation(data, settings, 50);
  const birthYear = data.birth_date
    ? parseInt(data.birth_date.split("-")[0])
    : new Date().getFullYear() - 35;

  const milestoneTargets = [
    { name: "1억", target: 10000 },
    { name: "3억", target: 30000 },
    { name: "5억", target: 50000 },
    { name: "10억", target: 100000 },
    { name: "20억", target: 200000 },
  ];

  return milestoneTargets.map((m) => {
    const achieved = state.netWorth >= m.target;
    const snapshot = simulation.snapshots.find((s) => s.netWorth >= m.target);

    return {
      name: m.name,
      target: m.target,
      achieved,
      estimatedYear: achieved
        ? new Date().getFullYear()
        : snapshot?.year || null,
      estimatedAge: achieved
        ? new Date().getFullYear() - birthYear
        : snapshot?.age || null,
    };
  });
}
