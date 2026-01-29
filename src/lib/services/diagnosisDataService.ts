/**
 * 진단 보고서 데이터 변환 서비스
 * prep_data를 DiagnosisData로 변환하는 공통 유틸리티
 */

import { calculateAge } from "@/lib/utils";

// prep_data 타입 정의
interface FamilyMember {
  relationship: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
}

interface HousingData {
  housingType: "자가" | "전세" | "월세" | "무상";
  currentValue?: number;
  deposit?: number;
  monthlyRent?: number;
  maintenanceFee?: number;
  hasLoan: boolean;
  loanAmount?: number;
  loanRate?: number;
}

interface FinancialAssetItem {
  type: string;
  title?: string;
  owner: "self" | "spouse";
  currentBalance: number;
}

interface InvestmentAccountData {
  securities?: { balance: number; investmentTypes?: string[] };
  crypto?: { balance: number };
  gold?: { balance: number };
}

interface DebtItem {
  type: string;
  principal: number;
  currentBalance?: number;
  interestRate: number;
}

interface IncomeFormData {
  selfLaborIncome: number;
  selfLaborFrequency: "monthly" | "yearly";
  spouseLaborIncome: number;
  spouseLaborFrequency: "monthly" | "yearly";
  additionalIncomes: {
    type: string;
    owner: "self" | "spouse";
    amount: number;
    frequency: "monthly" | "yearly";
  }[];
}

interface ExpenseFormData {
  livingExpense: number;
  livingExpenseDetails?: {
    food?: number;
    transport?: number;
    shopping?: number;
    leisure?: number;
    other?: number;
  };
  fixedExpenses: Array<{ type: string; title: string; amount: number; frequency: "monthly" | "yearly" }>;
}

interface NationalPensionData {
  selfExpectedAmount: number;
  selfStartAge?: number;
  spouseExpectedAmount: number;
  spouseStartAge?: number;
}

interface RetirementPensionData {
  selfType: "db" | "dc" | "none";
  selfBalance: number | null;
  selfWithdrawalPeriod?: number;
  spouseType: "db" | "dc" | "none";
  spouseBalance: number | null;
  spouseWithdrawalPeriod?: number;
}

interface PersonalPensionItem {
  type: string;
  owner: "self" | "spouse";
  balance: number;
  withdrawalPeriod?: number;
}

interface RetirementGoals {
  targetRetirementAge?: number;
  targetMonthlyExpense?: number;
  lifeExpectancy?: number;
}

export interface PrepDataStore {
  family?: FamilyMember[];
  income?: IncomeFormData;
  expense?: ExpenseFormData;
  savings?: FinancialAssetItem[];
  investment?: InvestmentAccountData;
  housing?: HousingData;
  debt?: DebtItem[];
  nationalPension?: NationalPensionData;
  retirementPension?: RetirementPensionData;
  personalPension?: PersonalPensionItem[];
  retirementGoals?: RetirementGoals;
}

// 고정비 세부 항목
export interface FixedExpenseItem {
  type: string;
  title: string;
  amount: number;
}

// 개인연금 항목 (미가입 표시용)
export interface PersonalPensionStatus {
  irp: { enrolled: boolean; balance: number };
  pensionSavings: { enrolled: boolean; balance: number };
  isa: { enrolled: boolean; balance: number };
}

// 자녀 정보
export interface ChildInfo {
  name: string;
  age: number;
  gender: "male" | "female" | null;
}

export interface DiagnosisData {
  customerName: string;
  currentAge: number;
  spouseAge: number | null;
  lifeExpectancy: number;
  targetRetirementAge: number;
  // 자녀 정보
  children: ChildInfo[];
  // 연금 (만원/월)
  nationalPensionPersonal: number;
  nationalPensionSpouse: number;
  retirementPensionPersonal: number;
  retirementPensionSpouse: number;
  // 퇴직연금 잔액 (만원)
  retirementPensionBalanceSelf: number;
  retirementPensionBalanceSpouse: number;
  retirementPensionBalanceAtRetireSelf: number;
  retirementPensionBalanceAtRetireSpouse: number;
  privatePensionPersonal: number;
  privatePensionSpouse: number;
  otherIncomePersonal: number;
  otherIncomeSpouse: number;
  // 자산 (억원)
  realEstateAsset: number;
  cashAsset: number;
  depositAsset: number; // 전세/월세 보증금 (성장률 0%)
  investmentAsset: number;
  pensionAsset: number;
  // 부채 (만원)
  mortgageAmount: number;
  mortgageRate: number;
  creditLoanAmount: number;
  creditLoanRate: number;
  otherDebtAmount: number;
  otherDebtRate: number;
  // 현금흐름 (만원/월)
  monthlyIncome: number;
  monthlyFixedExpense: number;
  monthlyLivingExpense: number;
  // 지출 세부 항목 (만원/월)
  expenseFood: number;
  expenseTransport: number;
  expenseShopping: number;
  expenseLeisure: number;
  expenseOther: number;
  // 고정비 세부 항목
  fixedExpenseItems: FixedExpenseItem[];
  // 개인연금 가입 상태
  personalPensionStatus: PersonalPensionStatus;
  // 개별 자산 항목 목록 (차트용)
  assetItems: AssetItem[];
}

// 개별 자산 항목
export interface AssetItem {
  key: string;
  label: string;
  amount: number; // 억원
  color: string;
}

interface ProfileData {
  name?: string;
  birth_date?: string;
  target_retirement_age?: number;
  prep_data?: PrepDataStore;
}

/**
 * prep_data를 DiagnosisData로 변환
 */
export function convertPrepDataToDiagnosisData(
  profile: ProfileData
): DiagnosisData {
  const prepData = (profile.prep_data || {}) as PrepDataStore;

  // 기본 정보 - 만 나이 계산
  const currentAge = profile.birth_date
    ? calculateAge(profile.birth_date)
    : 40; // 생년월일 없으면 기본 40세

  // 배우자 만 나이 (prep_data.family에서 추출)
  const spouse = prepData.family?.find((m) => m.relationship === "spouse");
  const spouseAge = spouse?.birth_date
    ? calculateAge(spouse.birth_date)
    : null;

  // 자녀 정보 추출 (relationship이 "child"로 저장됨)
  const children: ChildInfo[] = (prepData.family || [])
    .filter((m) => m.relationship === "child")
    .map((child, idx) => {
      const gender: "male" | "female" | null =
        child.gender === "male" ? "male" :
        child.gender === "female" ? "female" : null;
      return {
        name: child.name || `자녀${idx + 1}`,
        age: child.birth_date ? calculateAge(child.birth_date) : 0,
        gender,
      };
    })
    .sort((a, b) => b.age - a.age); // 나이 많은 순 정렬

  // 월환산 함수
  const toMonthly = (amount: number, frequency: string) =>
    frequency === "yearly" ? Math.round(amount / 12) : amount;

  // 소득 계산 (prep_data.income)
  const incomeData = prepData.income;
  let monthlyIncome = 0;
  if (incomeData) {
    monthlyIncome += toMonthly(incomeData.selfLaborIncome || 0, incomeData.selfLaborFrequency || "monthly");
    monthlyIncome += toMonthly(incomeData.spouseLaborIncome || 0, incomeData.spouseLaborFrequency || "monthly");
    for (const additional of incomeData.additionalIncomes || []) {
      monthlyIncome += toMonthly(additional.amount || 0, additional.frequency || "monthly");
    }
  }

  // 지출 계산 (prep_data.expense)
  const expenseData = prepData.expense;
  let monthlyFixedExpense = 0;
  let monthlyLivingExpense = 0;
  let expenseFood = 0;
  let expenseTransport = 0;
  let expenseShopping = 0;
  let expenseLeisure = 0;
  let expenseOther = 0;

  // 주거비 (월세 + 관리비)를 고정비에 포함
  const housingData = prepData.housing;
  const monthlyRent = housingData?.monthlyRent || 0;
  const maintenanceFee = housingData?.maintenanceFee || 0;
  monthlyFixedExpense += monthlyRent + maintenanceFee;

  if (expenseData) {
    // 고정 지출
    for (const fixed of expenseData.fixedExpenses || []) {
      monthlyFixedExpense += toMonthly(fixed.amount || 0, fixed.frequency || "monthly");
    }

    // 변동 생활비 세부 항목
    const details = expenseData.livingExpenseDetails;
    if (details) {
      expenseFood = details.food || 0;
      expenseTransport = details.transport || 0;
      expenseShopping = details.shopping || 0;
      expenseLeisure = details.leisure || 0;
      expenseOther = details.other || 0;
      monthlyLivingExpense = expenseFood + expenseTransport + expenseShopping + expenseLeisure + expenseOther;
    } else {
      // livingExpenseDetails가 없으면 livingExpense를 비율로 분배
      monthlyLivingExpense = expenseData.livingExpense || 0;
      expenseFood = Math.round(monthlyLivingExpense * 0.35);
      expenseTransport = Math.round(monthlyLivingExpense * 0.15);
      expenseShopping = Math.round(monthlyLivingExpense * 0.20);
      expenseLeisure = Math.round(monthlyLivingExpense * 0.15);
      expenseOther = monthlyLivingExpense - expenseFood - expenseTransport - expenseShopping - expenseLeisure;
    }
  }

  // 부동산 자산 (억원) - prep_data.housing
  // 자가: 집값만 부동산 자산으로 분류
  let realEstateAsset = 0;
  // 전세/월세 보증금: 별도 분류 (성장률 0%, 회수 가능한 자산)
  let depositAsset = 0;
  if (housingData) {
    if (housingData.housingType === "자가") {
      realEstateAsset = (housingData.currentValue || 0) / 10000;
    } else if (housingData.housingType === "전세" || housingData.housingType === "월세") {
      depositAsset = (housingData.deposit || 0) / 10000;
    }
  }

  // 현금성 자산 (억원) - prep_data.savings (보증금 제외)
  const savingsData = prepData.savings || [];
  const cashTypes = ["checking", "savings", "deposit"];
  const cashAsset = savingsData
    .filter((s) => cashTypes.includes(s.type))
    .reduce((sum, s) => sum + (s.currentBalance || 0), 0) / 10000;

  // 투자 자산 (억원) - prep_data.investment 또는 prep_data.savings 중 투자형
  // 주의: 양쪽에 중복 저장된 경우 중복 계산 방지
  const investmentData = prepData.investment;
  let investmentAsset = 0;

  // investment 데이터가 있으면 사용 (waiting survey에서 저장된 경우)
  const investmentFromInvestment = investmentData
    ? (investmentData.securities?.balance || 0) / 10000 +
      (investmentData.crypto?.balance || 0) / 10000 +
      (investmentData.gold?.balance || 0) / 10000
    : 0;

  // savings에서 투자형 자산 (admin form에서 저장된 경우)
  const investmentFromSavings = savingsData
    .filter((s) => !cashTypes.includes(s.type))
    .reduce((sum, s) => sum + (s.currentBalance || 0), 0) / 10000;

  // 중복 방지: investment 데이터가 있으면 그것만 사용, 없으면 savings 사용
  investmentAsset = investmentFromInvestment > 0 ? investmentFromInvestment : investmentFromSavings;

  // 연금 자산 (억원) - 퇴직연금 + 개인연금 현재 잔액
  const retirementData = prepData.retirementPension;
  const personalPensions = prepData.personalPension || [];

  let pensionAsset = 0;
  if (retirementData) {
    pensionAsset += (retirementData.selfBalance || 0) / 10000;
    pensionAsset += (retirementData.spouseBalance || 0) / 10000;
  }
  pensionAsset += personalPensions.reduce((sum, p) => sum + (p.balance || 0), 0) / 10000;

  // 부채 분류 - prep_data.debt + prep_data.housing 대출
  const debtData = prepData.debt || [];

  // 주담대: housing 대출 + debt 중 mortgage 타입
  let mortgageAmount = 0;
  let mortgageRate = 4.5;
  if (housingData?.hasLoan) {
    mortgageAmount += housingData.loanAmount || 0;
    mortgageRate = housingData.loanRate || 4.5;
  }
  const mortgageDebts = debtData.filter((d) => d.type === "mortgage");
  mortgageAmount += mortgageDebts.reduce((sum, d) => sum + (d.currentBalance || d.principal || 0), 0);
  if (mortgageDebts.length > 0) {
    mortgageRate = mortgageDebts[0].interestRate || 4.5;
  }

  // 신용대출
  const creditDebts = debtData.filter((d) => d.type === "credit" || d.type === "credit_line");
  const creditLoanAmount = creditDebts.reduce((sum, d) => sum + (d.currentBalance || d.principal || 0), 0);
  const creditLoanRate = creditDebts[0]?.interestRate || 6.8;

  // 기타 부채
  const otherDebts = debtData.filter((d) => !["mortgage", "credit", "credit_line"].includes(d.type));
  const otherDebtAmount = otherDebts.reduce((sum, d) => sum + (d.currentBalance || d.principal || 0), 0);
  const otherDebtRate = otherDebts[0]?.interestRate || 5.0;

  // 국민연금 - prep_data.nationalPension
  const nationalPensionData = prepData.nationalPension;
  const nationalPensionPersonal = nationalPensionData?.selfExpectedAmount || 0;
  const nationalPensionSpouse = nationalPensionData?.spouseExpectedAmount || 0;

  // 은퇴까지 남은 기간 (미래가치 계산용)
  const targetRetirementAge = prepData.retirementGoals?.targetRetirementAge || profile.target_retirement_age || 60;
  const yearsToRetirement = Math.max(0, targetRetirementAge - currentAge);

  // 연금 성장률 및 퇴직연금 적립률
  const pensionGrowthRate = 0.04; // 연 4% 수익률
  const retirementContributionRate = 0.0833; // 월급의 8.33% (연봉의 1/12)

  // 퇴직연금 은퇴시점 예상 잔액 계산 (현재잔액 + 추가적립 + 수익률)
  const calculateFutureRetirementPension = (currentBalance: number, monthlyIncome: number, years: number) => {
    if (years <= 0) return currentBalance;
    // 현재 잔액의 미래가치
    const currentBalanceFV = currentBalance * Math.pow(1 + pensionGrowthRate, years);
    // 추가 적립금의 미래가치 (매년 적립 가정)
    const annualContribution = monthlyIncome * retirementContributionRate * 12;
    const contributionFV = annualContribution * ((Math.pow(1 + pensionGrowthRate, years) - 1) / pensionGrowthRate);
    return Math.round(currentBalanceFV + contributionFV);
  };

  // 개인연금 은퇴시점 예상 잔액 계산 (현재잔액 + 수익률, 추가납입 없음)
  const calculateFuturePersonalPension = (currentBalance: number, years: number) => {
    if (years <= 0) return currentBalance;
    return Math.round(currentBalance * Math.pow(1 + pensionGrowthRate, years));
  };

  // 월수령액 계산 (은퇴시점 잔액 / 인출기간)
  const calculateMonthlyPension = (balance: number, years: number = 20) => {
    const months = years * 12;
    return Math.round(balance / months);
  };

  // 퇴직연금 인출 기간 (기본 20년)
  const retirementWithdrawalYears = retirementData?.selfWithdrawalPeriod || 20;

  // 퇴직연금 은퇴시점 예상 잔액
  const retirementPensionBalanceAtRetire = retirementData?.selfBalance
    ? calculateFutureRetirementPension(retirementData.selfBalance, monthlyIncome, yearsToRetirement)
    : 0;
  const retirementPensionSpouseBalanceAtRetire = retirementData?.spouseBalance
    ? calculateFutureRetirementPension(retirementData.spouseBalance, monthlyIncome * 0.5, yearsToRetirement) // 배우자는 소득의 50% 가정
    : 0;

  // 퇴직연금 월수령액 (은퇴시점 예상잔액 기준)
  const retirementPensionPersonal = retirementPensionBalanceAtRetire > 0
    ? calculateMonthlyPension(retirementPensionBalanceAtRetire, retirementWithdrawalYears)
    : 0;
  const retirementPensionSpouse = retirementPensionSpouseBalanceAtRetire > 0
    ? calculateMonthlyPension(retirementPensionSpouseBalanceAtRetire, retirementData?.spouseWithdrawalPeriod || retirementWithdrawalYears)
    : 0;

  // 개인연금 월수령액 (은퇴시점 예상잔액 기준)
  const selfPersonalPensions = personalPensions.filter((p) => p.owner === "self");
  const spousePersonalPensions = personalPensions.filter((p) => p.owner === "spouse");

  const privatePensionPersonal = selfPersonalPensions.reduce(
    (sum, p) => {
      const futureBalance = calculateFuturePersonalPension(p.balance || 0, yearsToRetirement);
      return sum + calculateMonthlyPension(futureBalance, p.withdrawalPeriod || 20);
    },
    0
  );
  const privatePensionSpouse = spousePersonalPensions.reduce(
    (sum, p) => {
      const futureBalance = calculateFuturePersonalPension(p.balance || 0, yearsToRetirement);
      return sum + calculateMonthlyPension(futureBalance, p.withdrawalPeriod || 20);
    },
    0
  );

  // 기대수명 (prep_data.retirementGoals에서 가져오거나 기본 90세)
  const lifeExpectancy = prepData.retirementGoals?.lifeExpectancy || 90;

  // 고정비 세부 항목 생성
  const fixedExpenseItems: FixedExpenseItem[] = [];

  // 월세 추가
  if (monthlyRent > 0) {
    fixedExpenseItems.push({ type: "housing", title: "월세", amount: monthlyRent });
  }
  // 관리비 추가
  if (maintenanceFee > 0) {
    fixedExpenseItems.push({ type: "housing", title: "관리비", amount: maintenanceFee });
  }
  // 사용자 입력 고정비 추가
  if (expenseData?.fixedExpenses) {
    for (const fixed of expenseData.fixedExpenses) {
      fixedExpenseItems.push({
        type: fixed.type,
        title: fixed.title || fixed.type,
        amount: toMonthly(fixed.amount || 0, fixed.frequency || "monthly"),
      });
    }
  }

  // 개인연금 가입 상태 (IRP, 연금저축, ISA)
  const irpPensions = personalPensions.filter((p) => p.type === "irp");
  const pensionSavingsPensions = personalPensions.filter((p) => p.type === "pension_savings");
  const isaPensions = personalPensions.filter((p) => p.type === "isa");

  const personalPensionStatus: PersonalPensionStatus = {
    irp: {
      enrolled: irpPensions.length > 0,
      balance: irpPensions.reduce((sum, p) => sum + (p.balance || 0), 0),
    },
    pensionSavings: {
      enrolled: pensionSavingsPensions.length > 0,
      balance: pensionSavingsPensions.reduce((sum, p) => sum + (p.balance || 0), 0),
    },
    isa: {
      enrolled: isaPensions.length > 0,
      balance: isaPensions.reduce((sum, p) => sum + (p.balance || 0), 0),
    },
  };

  // 개별 자산 항목 목록 생성
  const assetItems: AssetItem[] = [];
  const assetColors = [
    "#1a365d", "#2c5282", "#3182ce", "#4299e1", "#63b3ed",
    "#805ad5", "#9f7aea", "#b794f4", "#38a169", "#48bb78",
    "#ed8936", "#f6ad55", "#e53e3e", "#fc8181", "#4a5568",
  ];
  let colorIndex = 0;
  const getNextColor = () => assetColors[colorIndex++ % assetColors.length];

  // 저축 타입 레이블
  const savingsTypeLabels: Record<string, string> = {
    checking: "입출금통장",
    savings: "적금",
    deposit: "정기예금",
    domestic_stock: "국내주식",
    foreign_stock: "해외주식",
    fund: "펀드",
    bond: "채권",
    crypto: "코인",
    other: "기타",
  };

  // 1. 부동산/보증금
  if (realEstateAsset > 0) {
    assetItems.push({ key: "realestate", label: "부동산", amount: realEstateAsset, color: getNextColor() });
  }
  if (depositAsset > 0) {
    assetItems.push({ key: "deposit", label: "보증금", amount: depositAsset, color: getNextColor() });
  }

  // 2. 저축 계좌 (개별 항목)
  savingsData
    .filter((s) => cashTypes.includes(s.type) && (s.currentBalance || 0) > 0)
    .forEach((s) => {
      const label = s.title || savingsTypeLabels[s.type] || s.type;
      assetItems.push({
        key: `savings-${s.type}-${s.title}`,
        label,
        amount: (s.currentBalance || 0) / 10000,
        color: getNextColor(),
      });
    });

  // 3. 투자 자산 (개별 항목)
  if (investmentFromInvestment > 0) {
    // prep_data.investment에서 개별 항목
    if (investmentData?.securities?.balance && investmentData.securities.balance > 0) {
      const types = investmentData.securities.investmentTypes || [];
      const label = types.length > 0
        ? types.map((t: string) => savingsTypeLabels[t] || t).join("/")
        : "증권";
      assetItems.push({
        key: "investment-securities",
        label,
        amount: investmentData.securities.balance / 10000,
        color: getNextColor(),
      });
    }
    if (investmentData?.crypto?.balance && investmentData.crypto.balance > 0) {
      assetItems.push({
        key: "investment-crypto",
        label: "코인",
        amount: investmentData.crypto.balance / 10000,
        color: getNextColor(),
      });
    }
    if (investmentData?.gold?.balance && investmentData.gold.balance > 0) {
      assetItems.push({
        key: "investment-gold",
        label: "금",
        amount: investmentData.gold.balance / 10000,
        color: getNextColor(),
      });
    }
  } else if (investmentFromSavings > 0) {
    // prep_data.savings에서 투자형 개별 항목
    savingsData
      .filter((s) => !cashTypes.includes(s.type) && (s.currentBalance || 0) > 0)
      .forEach((s) => {
        const label = s.title || savingsTypeLabels[s.type] || s.type;
        assetItems.push({
          key: `savings-inv-${s.type}-${s.title}`,
          label,
          amount: (s.currentBalance || 0) / 10000,
          color: getNextColor(),
        });
      });
  }

  // 4. 연금 자산 (개별 항목)
  if (retirementData?.selfBalance && retirementData.selfBalance > 0) {
    assetItems.push({
      key: "retirement-self",
      label: "퇴직연금(본인)",
      amount: retirementData.selfBalance / 10000,
      color: getNextColor(),
    });
  }
  if (retirementData?.spouseBalance && retirementData.spouseBalance > 0) {
    assetItems.push({
      key: "retirement-spouse",
      label: "퇴직연금(배우자)",
      amount: retirementData.spouseBalance / 10000,
      color: getNextColor(),
    });
  }

  // 개인연금 개별 항목
  const personalPensionTypeLabels: Record<string, string> = {
    irp: "IRP",
    pension_savings: "연금저축",
    pension_savings_tax: "연금저축(세액공제)",
    pension_savings_invest: "연금저축(투자)",
    isa: "ISA",
  };
  personalPensions
    .filter((p) => (p.balance || 0) > 0)
    .forEach((p) => {
      const ownerLabel = p.owner === "spouse" ? "(배우자)" : "";
      const typeLabel = personalPensionTypeLabels[p.type] || p.type;
      assetItems.push({
        key: `personal-${p.type}-${p.owner}`,
        label: `${typeLabel}${ownerLabel}`,
        amount: (p.balance || 0) / 10000,
        color: getNextColor(),
      });
    });

  return {
    customerName: profile.name || "고객",
    currentAge,
    spouseAge,
    lifeExpectancy,
    targetRetirementAge: prepData.retirementGoals?.targetRetirementAge || profile.target_retirement_age || 60,
    // 자녀 정보
    children,
    // 연금 (만원/월)
    nationalPensionPersonal,
    nationalPensionSpouse,
    retirementPensionPersonal,
    retirementPensionSpouse,
    // 퇴직연금 잔액 (만원)
    retirementPensionBalanceSelf: retirementData?.selfBalance || 0,
    retirementPensionBalanceSpouse: retirementData?.spouseBalance || 0,
    retirementPensionBalanceAtRetireSelf: retirementPensionBalanceAtRetire,
    retirementPensionBalanceAtRetireSpouse: retirementPensionSpouseBalanceAtRetire,
    privatePensionPersonal,
    privatePensionSpouse,
    otherIncomePersonal: 0,
    otherIncomeSpouse: 0,
    // 자산 (억원)
    realEstateAsset,
    cashAsset,
    depositAsset,
    investmentAsset,
    pensionAsset,
    // 부채 (만원)
    mortgageAmount,
    mortgageRate,
    creditLoanAmount,
    creditLoanRate,
    otherDebtAmount,
    otherDebtRate,
    // 현금흐름 (만원/월)
    monthlyIncome,
    monthlyFixedExpense,
    monthlyLivingExpense,
    // 지출 세부 항목 (만원/월)
    expenseFood,
    expenseTransport,
    expenseShopping,
    expenseLeisure,
    expenseOther,
    // 고정비 세부 항목
    fixedExpenseItems,
    // 개인연금 가입 상태
    personalPensionStatus,
    // 개별 자산 항목 목록
    assetItems,
  };
}

// 은퇴 판정 상태 타입
export type RetirementVerdictStatus = "possible" | "conditional" | "difficult";

// 은퇴 시나리오 결과 타입
export interface RetirementScenario {
  retireAge: number;
  assetAtRetire: number;
  depletionAge: number;
  sustainable: boolean;
}

// 전체 계산 결과 타입
export interface DiagnosisMetrics {
  // 기본 자산/부채
  financialAsset: number;
  totalAsset: number;
  totalDebt: number;
  netWorth: number;

  // 생활비/지출
  livingExpense: number;
  monthlyInterest: number;
  currentExpenseBase: number;
  currentMonthlyExpense: number;
  currentMonthlyGap: number;
  savingsRate: number;

  // 자산 비율
  realEstateRatio: number;
  depositRatio: number;
  cashRatio: number;
  investmentRatio: number;
  pensionRatio: number;

  // 부채 비율
  mortgageRatio: number;
  creditRatio: number;
  otherDebtRatio: number;
  isMortgageRateGood: boolean;
  isCreditRateGood: boolean;
  annualInterest: number;
  interestToIncome: number;

  // 지출 분석
  fixedExpense: number;
  variableExpense: number;
  fixedRatio: number;
  variableRatio: number;

  // 은퇴 시점 계산 (물가 반영)
  effectiveRetirementAge: number;
  effectiveLifeExpectancy: number;
  yearsToRetirement: number;
  retirementYears: number;
  nationalPensionInflated: number;
  monthlyPension: number;
  monthlyExpense: number;
  monthlyGap: number;
  pensionCoverageRate: number;

  // 유동자산/지속성
  liquidAsset: number;
  liquidAssetAtRetirement: number;
  annualShortfall: number;
  yearsOfWithdrawal: number;
  rawDepletionAge: number;
  assetDepletionAge: number;
  isAssetSustainable: boolean;

  // 은퇴 판정
  retirementVerdict: {
    status: RetirementVerdictStatus;
    label: string;
    message: string;
  };

  // 자금 수급
  totalDemand: number;
  totalPensionSupply: number;
  totalSupply: number;
  supplyDeficit: number;
  supplyRatio: number;

  // 은퇴 시점 예상 자산
  realEstateAtRetirement: number;
  depositAtRetirement: number;
  financialAtRetirement: number;
  pensionAtRetirement: number;
  totalAtRetirement: number;
  debtAtRetirement: number;
  netWorthAtRetirement: number;
  realEstateRatioAtRetirement: number;
  depositRatioAtRetirement: number;
  financialRatioAtRetirement: number;
  pensionRatioAtRetirement: number;

  // 은퇴 시나리오
  earlyRetirement: RetirementScenario;
  normalRetirement: RetirementScenario;
  lateRetirement: RetirementScenario;

  // 노후생활비 기준
  minLivingCost: number;
  adequateLivingCost: number;
}

// 커스텀 계산 파라미터 인터페이스
export interface CalculationParams {
  retirementAgeOffset: number;      // 은퇴 나이 조정 (-5, 0, +5)
  livingExpenseRatio: number;       // 생활비 비율 (0.7, 1.0, 1.2)
  inflationRate: number;            // 물가상승률 (0.01, 0.02, 0.04)
  incomeGrowthRate: number;         // 소득상승률 (0.01, 0.02, 0.04)
  financialGrowthRate: number;      // 금융자산 수익률 (0.02, 0.05, 0.07, 0.10)
  lifeExpectancy: number | null;    // 기대수명 (null이면 데이터 값 사용)
}

// 기본 계산 파라미터
export const DEFAULT_CALC_PARAMS: CalculationParams = {
  retirementAgeOffset: 0,
  livingExpenseRatio: 0.7,
  inflationRate: 0.02,
  incomeGrowthRate: 0.02,
  financialGrowthRate: 0.05,
  lifeExpectancy: null,
};

/**
 * DiagnosisData에서 모든 진단 지표 계산 (중앙집중화)
 * DiagnosisReport, ReportTabs, DiagnosisSummaryCards 모두 이 함수 사용
 */
export function calculateAllDiagnosisMetrics(
  data: DiagnosisData,
  customParams?: Partial<CalculationParams>
): DiagnosisMetrics {
  const params = { ...DEFAULT_CALC_PARAMS, ...customParams };
  const inflationRate = params.inflationRate;
  const growthRate = 0.025;

  // === 기본 자산/부채 계산 ===
  const financialAsset = Math.round((data.cashAsset + data.investmentAsset) * 100) / 100;
  // 총자산에 보증금 포함 (보증금은 별도 추적하여 성장률 0% 적용)
  const totalAsset = Math.round((data.realEstateAsset + financialAsset + data.depositAsset + data.pensionAsset) * 100) / 100;
  const totalDebt = data.mortgageAmount + data.creditLoanAmount + data.otherDebtAmount;
  const netWorth = Math.round((totalAsset - totalDebt / 10000) * 100) / 100;

  // === 생활비/지출 계산 ===
  const livingExpense =
    data.expenseFood + data.expenseTransport + data.expenseShopping + data.expenseLeisure + data.expenseOther;

  const monthlyInterest = Math.round(
    (data.mortgageAmount * data.mortgageRate) / 100 / 12 +
    (data.creditLoanAmount * data.creditLoanRate) / 100 / 12 +
    (data.otherDebtAmount * data.otherDebtRate) / 100 / 12
  );

  const currentExpenseBase = data.monthlyFixedExpense + livingExpense + monthlyInterest;
  const currentMonthlyExpense = currentExpenseBase;
  const currentMonthlyGap = data.monthlyIncome - currentMonthlyExpense;
  const savingsRate = data.monthlyIncome > 0 ? (currentMonthlyGap / data.monthlyIncome) * 100 : 0;

  // === 자산 비율 ===
  const realEstateRatio = totalAsset > 0 ? Math.round((data.realEstateAsset / totalAsset) * 100) : 0;
  const depositRatio = totalAsset > 0 ? Math.round((data.depositAsset / totalAsset) * 100) : 0;
  const cashRatio = totalAsset > 0 ? Math.round((data.cashAsset / totalAsset) * 100) : 0;
  const investmentRatio = totalAsset > 0 ? Math.round((data.investmentAsset / totalAsset) * 100) : 0;
  const pensionRatio = 100 - realEstateRatio - depositRatio - cashRatio - investmentRatio;

  // === 부채 비율 ===
  const mortgageRatio = totalDebt > 0 ? Math.round((data.mortgageAmount / totalDebt) * 100) : 0;
  const creditRatio = totalDebt > 0 ? Math.round((data.creditLoanAmount / totalDebt) * 100) : 0;
  const otherDebtRatio = 100 - mortgageRatio - creditRatio;
  const isMortgageRateGood = data.mortgageRate <= 4.5;
  const isCreditRateGood = data.creditLoanRate <= 7.0;
  const annualInterest = monthlyInterest * 12;
  const annualIncomeCalc = data.monthlyIncome * 12;
  const interestToIncome = annualIncomeCalc > 0 ? Math.round((annualInterest / annualIncomeCalc) * 100) : 0;

  // === 지출 분석 ===
  const fixedExpense = data.monthlyFixedExpense + monthlyInterest;
  const variableExpense = livingExpense;
  const totalAllExpense = fixedExpense + variableExpense;
  const fixedRatio = totalAllExpense > 0 ? Math.round((fixedExpense / totalAllExpense) * 100) : 0;
  const variableRatio = 100 - fixedRatio;

  // === 은퇴 시점 계산 (물가 반영) ===
  const effectiveRetirementAge = data.targetRetirementAge + params.retirementAgeOffset;
  const effectiveLifeExpectancy = params.lifeExpectancy ?? data.lifeExpectancy;
  const yearsToRetirement = Math.max(0, effectiveRetirementAge - data.currentAge);
  const retirementYears = Math.max(0, effectiveLifeExpectancy - effectiveRetirementAge);

  // 국민연금 물가상승률 반영
  const nationalPensionInflated = Math.round(
    (data.nationalPensionPersonal + data.nationalPensionSpouse) *
    Math.pow(1 + inflationRate, yearsToRetirement)
  );

  const monthlyPension =
    nationalPensionInflated +
    data.retirementPensionPersonal +
    data.retirementPensionSpouse +
    data.privatePensionPersonal +
    data.privatePensionSpouse +
    data.otherIncomePersonal +
    data.otherIncomeSpouse;

  // 은퇴 시점 예상 지출 (물가상승 반영, 커스텀 비율 적용)
  const monthlyExpense = Math.round(
    currentExpenseBase * Math.pow(1 + inflationRate, yearsToRetirement) * params.livingExpenseRatio
  );
  const monthlyGap = monthlyPension - monthlyExpense;
  const pensionCoverageRate = monthlyExpense > 0 ? Math.round((monthlyPension / monthlyExpense) * 100) : 0;

  // === 현재 유동자산 ===
  const liquidAsset = Math.round((financialAsset + data.depositAsset + data.pensionAsset) * 100) / 100;

  // === 은퇴 시점 예상 자산 (먼저 계산) ===
  // 저축률 유지 + 소득 상승 방식 (savingsRate는 위에서 이미 계산됨 - 퍼센트)
  const initialAnnualSavings = currentMonthlyGap > 0 ? (currentMonthlyGap * 12) / 10000 : 0;
  const incomeGrowthRate = params.incomeGrowthRate; // 소득 상승률
  const realEstateGrowth = 0.02;
  const financialGrowth = params.financialGrowthRate; // 금융자산 수익률
  const pensionGrowth = 0.04;
  const depositGrowth = 0; // 보증금은 성장률 0%

  // 소득 상승에 따른 저축 증가를 반영한 미래가치 계산
  // FV = S0 * ((1+r)^n - (1+g)^n) / (r - g) (r ≠ g일 때)
  const calculateSavingsFV = (initialSavings: number, years: number, returnRate: number, growthRate: number) => {
    if (years <= 0 || initialSavings <= 0) return 0;
    if (Math.abs(returnRate - growthRate) < 0.001) {
      // r ≈ g인 경우: S0 * n * (1+r)^(n-1)
      return initialSavings * years * Math.pow(1 + returnRate, years - 1);
    }
    return initialSavings * (Math.pow(1 + returnRate, years) - Math.pow(1 + growthRate, years)) / (returnRate - growthRate);
  };

  const realEstateAtRetirement =
    Math.round(data.realEstateAsset * Math.pow(1 + realEstateGrowth, yearsToRetirement) * 10) / 10;
  const depositAtRetirement =
    Math.round(data.depositAsset * Math.pow(1 + depositGrowth, yearsToRetirement) * 10) / 10;
  const financialAtRetirement =
    Math.round(
      (financialAsset * Math.pow(1 + financialGrowth, yearsToRetirement) +
        calculateSavingsFV(initialAnnualSavings, yearsToRetirement, financialGrowth, incomeGrowthRate)) *
      10
    ) / 10;
  const pensionAtRetirement =
    Math.round(data.pensionAsset * Math.pow(1 + pensionGrowth, yearsToRetirement) * 10) / 10;
  const totalAtRetirement =
    Math.round((realEstateAtRetirement + depositAtRetirement + financialAtRetirement + pensionAtRetirement) * 10) / 10;

  const debtAtRetirement = Math.round(totalDebt * 0.5);
  const netWorthAtRetirement =
    Math.round((totalAtRetirement - debtAtRetirement / 10000) * 10) / 10;

  // === 유동자산/지속성 (화면 표시 값과 일치) ===
  // 유동자산 = 금융자산 + 보증금 + 연금자산 (부동산 제외)
  const liquidAssetAtRetirement =
    Math.round((financialAtRetirement + depositAtRetirement + pensionAtRetirement) * 100) / 100;

  const annualShortfall = monthlyGap < 0 ? (Math.abs(monthlyGap) * 12) / 10000 : 0;
  const yearsOfWithdrawal =
    liquidAssetAtRetirement <= 0
      ? 0
      : annualShortfall > 0
        ? Math.round((liquidAssetAtRetirement / annualShortfall) * 10) / 10
        : 999;

  const rawDepletionAge = effectiveRetirementAge + Math.floor(yearsOfWithdrawal);
  const assetDepletionAge = Math.min(rawDepletionAge, effectiveLifeExpectancy + 1);
  const isAssetSustainable = rawDepletionAge > effectiveLifeExpectancy;

  // === 은퇴 판정 ===
  const isRetirementPossible = monthlyGap >= 0;
  const coverageGap = monthlyExpense - monthlyPension;
  const requiredAdditionalAsset =
    coverageGap > 0 ? Math.round(((coverageGap * 12 * retirementYears) / 10000) * 10) / 10 : 0;
  const hasEnoughAsset = liquidAssetAtRetirement >= requiredAdditionalAsset;

  let retirementVerdict: { status: RetirementVerdictStatus; label: string; message: string };
  if (isRetirementPossible) {
    retirementVerdict = {
      status: "possible",
      label: "가능",
      message: `만 ${effectiveRetirementAge}세 은퇴 가능`,
    };
  } else if (hasEnoughAsset) {
    retirementVerdict = {
      status: "conditional",
      label: "조건부",
      message: `만 ${effectiveRetirementAge}세 조건부 가능`,
    };
  } else {
    retirementVerdict = {
      status: "difficult",
      label: "재검토",
      message: `만 ${effectiveRetirementAge}세 재검토 필요`,
    };
  }

  // === 자금 수급 ===
  const totalDemand = Math.round(((retirementYears * monthlyExpense * 12) / 10000) * 100) / 100;
  const totalPensionSupply = Math.round(((retirementYears * monthlyPension * 12) / 10000) * 100) / 100;
  const totalSupply = Math.round((totalPensionSupply + Math.max(0, liquidAssetAtRetirement)) * 100) / 100;
  const supplyDeficit = Math.round((totalDemand - totalSupply) * 100) / 100;
  const supplyRatio = totalDemand > 0 ? Math.round((totalSupply / totalDemand) * 100) : 0;

  // === 은퇴 시점 자산 비율 ===
  const realEstateRatioAtRetirement = totalAtRetirement > 0 ? Math.round((realEstateAtRetirement / totalAtRetirement) * 100) : 0;
  const depositRatioAtRetirement = totalAtRetirement > 0 ? Math.round((depositAtRetirement / totalAtRetirement) * 100) : 0;
  const financialRatioAtRetirement = totalAtRetirement > 0 ? Math.round((financialAtRetirement / totalAtRetirement) * 100) : 0;
  const pensionRatioAtRetirement = 100 - realEstateRatioAtRetirement - depositRatioAtRetirement - financialRatioAtRetirement;

  // === 은퇴 시나리오 계산 함수 ===
  const calculateRetirementScenario = (retireAge: number): RetirementScenario => {
    const yearsToRetire = Math.max(0, retireAge - data.currentAge);
    const retireYears = Math.max(0, effectiveLifeExpectancy - retireAge);

    // 각 자산별 개별 성장률 적용 (메인 계산과 동일)
    // 저축률 유지 + 소득 상승 방식
    const financialAtRetire =
      financialAsset * Math.pow(1 + financialGrowth, yearsToRetire) +
      calculateSavingsFV(initialAnnualSavings, yearsToRetire, financialGrowth, incomeGrowthRate);
    const pensionAtRetireAsset = data.pensionAsset * Math.pow(1 + pensionGrowth, yearsToRetire);
    // 보증금은 성장률 0%
    const assetAtRetire = Math.round((financialAtRetire + pensionAtRetireAsset + data.depositAsset) * 100) / 100;

    const expenseAtRetire = Math.round(currentExpenseBase * Math.pow(1 + inflationRate, yearsToRetire) * params.livingExpenseRatio);
    const pensionAtRetire =
      Math.round(
        (data.nationalPensionPersonal + data.nationalPensionSpouse) *
        Math.pow(1 + inflationRate, yearsToRetire)
      ) +
      data.retirementPensionPersonal +
      data.retirementPensionSpouse +
      data.privatePensionPersonal +
      data.privatePensionSpouse +
      data.otherIncomePersonal +
      data.otherIncomeSpouse;

    const gapAtRetire = pensionAtRetire - expenseAtRetire;
    const shortfallAtRetire = gapAtRetire < 0 ? (Math.abs(gapAtRetire) * 12) / 10000 : 0;

    const yearsOfWithdraw =
      assetAtRetire <= 0
        ? 0
        : shortfallAtRetire > 0
          ? Math.round((assetAtRetire / shortfallAtRetire) * 10) / 10
          : 999;
    const depletionAge = retireAge + Math.floor(yearsOfWithdraw);
    return {
      retireAge,
      assetAtRetire,
      depletionAge: Math.min(depletionAge, effectiveLifeExpectancy + 10),
      sustainable: yearsOfWithdraw >= retireYears,
    };
  };

  const earlyRetirement = calculateRetirementScenario(effectiveRetirementAge - 5);
  const normalRetirement = calculateRetirementScenario(effectiveRetirementAge);
  const lateRetirement = calculateRetirementScenario(effectiveRetirementAge + 5);

  // === 노후생활비 기준 (KB금융 2025) ===
  const minLivingCost = Math.round(248 * Math.pow(1.03, yearsToRetirement));
  const adequateLivingCost = Math.round(350 * Math.pow(1.03, yearsToRetirement));

  return {
    // 기본 자산/부채
    financialAsset,
    totalAsset,
    totalDebt,
    netWorth,

    // 생활비/지출
    livingExpense,
    monthlyInterest,
    currentExpenseBase,
    currentMonthlyExpense,
    currentMonthlyGap,
    savingsRate,

    // 자산 비율
    realEstateRatio,
    depositRatio,
    cashRatio,
    investmentRatio,
    pensionRatio,

    // 부채 비율
    mortgageRatio,
    creditRatio,
    otherDebtRatio,
    isMortgageRateGood,
    isCreditRateGood,
    annualInterest,
    interestToIncome,

    // 지출 분석
    fixedExpense,
    variableExpense,
    fixedRatio,
    variableRatio,

    // 은퇴 시점 계산
    effectiveRetirementAge,
    effectiveLifeExpectancy,
    yearsToRetirement,
    retirementYears,
    nationalPensionInflated,
    monthlyPension,
    monthlyExpense,
    monthlyGap,
    pensionCoverageRate,

    // 유동자산/지속성
    liquidAsset,
    liquidAssetAtRetirement,
    annualShortfall,
    yearsOfWithdrawal,
    rawDepletionAge,
    assetDepletionAge,
    isAssetSustainable,

    // 은퇴 판정
    retirementVerdict,

    // 자금 수급
    totalDemand,
    totalPensionSupply,
    totalSupply,
    supplyDeficit,
    supplyRatio,

    // 은퇴 시점 예상 자산
    realEstateAtRetirement,
    depositAtRetirement,
    financialAtRetirement,
    pensionAtRetirement,
    totalAtRetirement,
    debtAtRetirement,
    netWorthAtRetirement,
    realEstateRatioAtRetirement,
    depositRatioAtRetirement,
    financialRatioAtRetirement,
    pensionRatioAtRetirement,

    // 은퇴 시나리오
    earlyRetirement,
    normalRetirement,
    lateRetirement,

    // 노후생활비 기준
    minLivingCost,
    adequateLivingCost,
  };
}

// ============================================
// 추가 비용 계산 (은퇴 시점까지)
// ============================================

// 자녀 교육비 연도별 비용 (만원, 2025년 기준)
// 일반 경로 vs 프리미엄 경로
const EDUCATION_COST_BY_STAGE = {
  // 일반 경로
  infant: { normal: 360, premium: 600 },        // 영아 (0-2세): 어린이집 월 30만 vs 프리미엄 50만
  toddler: { normal: 480, premium: 720 },       // 유아 (3세): 어린이집 월 40만 vs 60만
  preschool: { normal: 600, premium: 2400 },    // 유치원 (4-6세): 일반 월 50만 vs 영어유치원 월 200만
  elementary: { normal: 480, premium: 1200 },   // 초등학교 (7-12세): 학원 월 40만 vs 영어+수학 월 100만
  middle: { normal: 720, premium: 1440 },       // 중학교 (13-15세): 월 60만 vs 120만
  high: { normal: 1200, premium: 2400 },        // 고등학교 (16-18세): 월 100만 vs 200만 (대입 집중)
  university: { normal: 2400, premium: 6000 },  // 대학교 (19-22세): 국내 vs 유학
  wedding: { normal: 15000, premium: 25000 },   // 결혼자금: 1.5억 vs 2.5억
};

// 교육 단계 라벨
const EDUCATION_STAGE_LABELS: Record<string, string> = {
  infant: "영아 (어린이집)",
  toddler: "유아 (어린이집)",
  preschool: "유치원",
  elementary: "초등학교",
  middle: "중학교",
  high: "고등학교",
  university: "대학교",
  wedding: "결혼자금",
};

// 자녀 교육 단계 판별
function getEducationStage(age: number): keyof typeof EDUCATION_COST_BY_STAGE | null {
  if (age >= 0 && age <= 2) return "infant";
  if (age === 3) return "toddler";
  if (age >= 4 && age <= 6) return "preschool";
  if (age >= 7 && age <= 12) return "elementary";
  if (age >= 13 && age <= 15) return "middle";
  if (age >= 16 && age <= 18) return "high";
  if (age >= 19 && age <= 22) return "university";
  return null;
}

// 교육 단계별 비용 상세
export interface EducationStageDetail {
  stage: string;
  stageKey: string;
  ageRange: string;
  years: number;
  normalCost: number;      // 일반 경로 총 비용
  premiumCost: number;     // 프리미엄 경로 총 비용
  premiumLabel: string;    // 프리미엄 옵션 설명
}

// 자녀별 교육비 연도별 계산
export interface ChildEducationCost {
  childName: string;
  childAge: number;
  gender: "male" | "female" | null;
  stageDetails: EducationStageDetail[]; // 단계별 상세
  totalNormal: number;      // 일반 경로 총 비용
  totalPremium: number;     // 프리미엄 경로 총 비용
  weddingNormal: number;    // 결혼자금 (일반)
  weddingPremium: number;   // 결혼자금 (프리미엄)
}

// 프리미엄 옵션 설명
const PREMIUM_LABELS: Record<string, string> = {
  infant: "프리미엄 어린이집",
  toddler: "프리미엄 어린이집",
  preschool: "영어유치원",
  elementary: "영어+수학 심화",
  middle: "특목고 준비",
  high: "대입 집중반",
  university: "해외 유학",
  wedding: "프리미엄 지원",
};

export function calculateChildEducationCosts(
  children: ChildInfo[],
  currentAge: number,
  targetRetirementAge: number,
  inflationRate: number = 0.02
): ChildEducationCost[] {
  return children.map((child) => {
    const stageDetails: EducationStageDetail[] = [];
    let totalNormal = 0;
    let totalPremium = 0;

    // 각 교육 단계별 계산
    const stages: { key: keyof typeof EDUCATION_COST_BY_STAGE; minAge: number; maxAge: number; ageRange: string }[] = [
      { key: "infant", minAge: 0, maxAge: 2, ageRange: "0~2세" },
      { key: "toddler", minAge: 3, maxAge: 3, ageRange: "3세" },
      { key: "preschool", minAge: 4, maxAge: 6, ageRange: "4~6세" },
      { key: "elementary", minAge: 7, maxAge: 12, ageRange: "7~12세" },
      { key: "middle", minAge: 13, maxAge: 15, ageRange: "13~15세" },
      { key: "high", minAge: 16, maxAge: 18, ageRange: "16~18세" },
      { key: "university", minAge: 19, maxAge: 22, ageRange: "19~22세" },
    ];

    for (const stage of stages) {
      // 이미 지난 단계는 스킵
      if (child.age > stage.maxAge) continue;

      const startAge = Math.max(child.age, stage.minAge);
      const yearsInStage = stage.maxAge - startAge + 1;

      if (yearsInStage <= 0) continue;

      const yearOffset = startAge - child.age;
      const costs = EDUCATION_COST_BY_STAGE[stage.key];

      // 각 년도별 물가상승 반영하여 합산
      let stageNormalTotal = 0;
      let stagePremiumTotal = 0;
      for (let i = 0; i < yearsInStage; i++) {
        const inflationMultiplier = Math.pow(1 + inflationRate, yearOffset + i);
        stageNormalTotal += Math.round(costs.normal * inflationMultiplier);
        stagePremiumTotal += Math.round(costs.premium * inflationMultiplier);
      }

      stageDetails.push({
        stage: EDUCATION_STAGE_LABELS[stage.key],
        stageKey: stage.key,
        ageRange: stage.ageRange,
        years: yearsInStage,
        normalCost: stageNormalTotal,
        premiumCost: stagePremiumTotal,
        premiumLabel: PREMIUM_LABELS[stage.key],
      });

      totalNormal += stageNormalTotal;
      totalPremium += stagePremiumTotal;
    }

    // 결혼자금 (자녀 30세 가정)
    const weddingYearOffset = Math.max(0, 30 - child.age);
    const weddingInflation = Math.pow(1 + inflationRate, weddingYearOffset);
    const weddingNormal = Math.round(EDUCATION_COST_BY_STAGE.wedding.normal * weddingInflation);
    const weddingPremium = Math.round(EDUCATION_COST_BY_STAGE.wedding.premium * weddingInflation);

    return {
      childName: child.name,
      childAge: child.age,
      gender: child.gender,
      stageDetails,
      totalNormal,
      totalPremium,
      weddingNormal,
      weddingPremium,
    };
  });
}

// 의료/간병비 계산
export interface MedicalCostBreakdown {
  ageRange: string;
  yearsInRange: number;
  annualCost: number; // 만원
  totalCost: number; // 만원
}

export interface MedicalCostResult {
  selfCosts: MedicalCostBreakdown[];
  spouseCosts: MedicalCostBreakdown[];
  totalSelf: number;
  totalSpouse: number;
  grandTotal: number;
}

export function calculateMedicalCosts(
  currentAge: number,
  spouseAge: number | null,
  lifeExpectancy: number,
  inflationRate: number = 0.02
): MedicalCostResult {
  // 연령대별 연간 의료비 (만원, 현재 기준)
  const medicalCostByAge = [
    { minAge: 0, maxAge: 59, baseCost: 100 },
    { minAge: 60, maxAge: 69, baseCost: 200 },
    { minAge: 70, maxAge: 79, baseCost: 400 },
    { minAge: 80, maxAge: 89, baseCost: 800 },
    { minAge: 90, maxAge: 100, baseCost: 1200 }, // 간병비 포함
  ];

  const calculateForPerson = (personAge: number): MedicalCostBreakdown[] => {
    const results: MedicalCostBreakdown[] = [];
    const currentYear = new Date().getFullYear();

    for (const bracket of medicalCostByAge) {
      if (personAge >= bracket.maxAge) continue; // 이미 지난 구간
      if (personAge >= lifeExpectancy) continue;

      const startAge = Math.max(personAge, bracket.minAge);
      const endAge = Math.min(lifeExpectancy, bracket.maxAge);
      const yearsInRange = Math.max(0, endAge - startAge + 1);

      if (yearsInRange <= 0) continue;

      // 해당 구간 시작 시점까지의 물가상승률 반영
      const yearsToStart = Math.max(0, startAge - personAge);
      const inflatedCost = Math.round(bracket.baseCost * Math.pow(1 + inflationRate, yearsToStart));

      results.push({
        ageRange: `${bracket.minAge}~${bracket.maxAge}세`,
        yearsInRange,
        annualCost: inflatedCost,
        totalCost: inflatedCost * yearsInRange,
      });
    }

    return results;
  };

  const selfCosts = calculateForPerson(currentAge);
  const spouseCosts = spouseAge ? calculateForPerson(spouseAge) : [];

  const totalSelf = selfCosts.reduce((sum, c) => sum + c.totalCost, 0);
  const totalSpouse = spouseCosts.reduce((sum, c) => sum + c.totalCost, 0);

  return {
    selfCosts,
    spouseCosts,
    totalSelf,
    totalSpouse,
    grandTotal: totalSelf + totalSpouse,
  };
}

// 여행/여가 비용 계산
export interface LeisureCostOption {
  level: string;
  description: string;
  annualCost: number; // 만원
  totalUntilRetirement: number;
  totalAfterRetirement: number;
}

export function calculateLeisureCosts(
  currentAge: number,
  targetRetirementAge: number,
  lifeExpectancy: number,
  inflationRate: number = 0.02
): LeisureCostOption[] {
  const yearsToRetirement = Math.max(0, targetRetirementAge - currentAge);
  const retirementYears = lifeExpectancy - targetRetirementAge;

  const options = [
    { level: "검소", description: "국내 여행 연 2회", annualCost: 300 },
    { level: "보통", description: "국내 3회 + 해외 1회", annualCost: 600 },
    { level: "여유", description: "국내 + 해외 연 2회", annualCost: 1200 },
  ];

  return options.map((opt) => {
    // 은퇴 전까지 비용 (물가상승 반영한 합계)
    let totalUntilRetirement = 0;
    for (let i = 0; i < yearsToRetirement; i++) {
      totalUntilRetirement += Math.round(opt.annualCost * Math.pow(1 + inflationRate, i));
    }

    // 은퇴 후 비용 (은퇴 시점 물가 기준으로 고정)
    const retirementCost = Math.round(opt.annualCost * Math.pow(1 + inflationRate, yearsToRetirement));
    const totalAfterRetirement = retirementCost * retirementYears;

    return {
      ...opt,
      totalUntilRetirement,
      totalAfterRetirement,
    };
  });
}

// 소비재 비용 옵션 (자동차, 가전, 가구 등)
export interface ConsumerGoodsCostOption {
  level: string;          // 검소, 보통, 여유
  description: string;
  annualCost: number;     // 연간 비용 (만원)
  breakdown: {
    car: string;          // 자동차 설명
    appliances: string;   // 가전/가구 설명
  };
  totalUntilLifeExpectancy: number;
}

export function calculateConsumerGoodsCosts(
  currentAge: number,
  lifeExpectancy: number,
  inflationRate: number = 0.02
): ConsumerGoodsCostOption[] {
  const yearsLeft = lifeExpectancy - currentAge;

  // 연간 소비재 비용 (자동차 감가+유지비 + 가전/가구 교체비)
  const options = [
    {
      level: "검소",
      description: "필요한 것만, 오래 사용",
      annualCost: 300,  // 연 300만원
      breakdown: {
        car: "소형차 10년 사용, 중고차 활용",
        appliances: "가전 고장 시에만 교체",
      },
    },
    {
      level: "보통",
      description: "적당한 소비, 7년 주기 교체",
      annualCost: 600,  // 연 600만원
      breakdown: {
        car: "중형차 7년 사용",
        appliances: "가전/가구 주기적 교체",
      },
    },
    {
      level: "여유",
      description: "좋은 것 선호, 5년 주기 교체",
      annualCost: 1200, // 연 1200만원
      breakdown: {
        car: "수입차/대형차 5년 사용",
        appliances: "고급 가전, 인테리어 투자",
      },
    },
  ];

  return options.map((opt) => {
    // 물가상승 반영한 총 비용
    let total = 0;
    for (let i = 0; i < yearsLeft; i++) {
      total += Math.round(opt.annualCost * Math.pow(1 + inflationRate, i));
    }

    return {
      ...opt,
      totalUntilLifeExpectancy: total,
    };
  });
}

// 주거 비용 옵션 (다운사이징/이사/리모델링)
export interface HousingTier {
  tier: "일반" | "프리미엄" | "하이엔드";
  price: number; // 만원
  priceDisplay: string;
}

export interface HousingCostOption {
  area: string;
  description: string;
  tiers: HousingTier[];
}

export function getHousingOptions(): HousingCostOption[] {
  // 2025-2026년 실거래가 기준 (전용 84㎡ 기준)
  return [
    {
      area: "서울 외곽",
      description: "노원, 도봉, 강북, 금천 등",
      tiers: [
        { tier: "일반", price: 70000, priceDisplay: "7억" },
        { tier: "프리미엄", price: 100000, priceDisplay: "10억" },
        { tier: "하이엔드", price: 130000, priceDisplay: "13억" },
      ],
    },
    {
      area: "서울 중간",
      description: "마포, 영등포, 성동, 동작 등",
      tiers: [
        { tier: "일반", price: 130000, priceDisplay: "13억" },
        { tier: "프리미엄", price: 180000, priceDisplay: "18억" },
        { tier: "하이엔드", price: 230000, priceDisplay: "23억" },
      ],
    },
    {
      area: "서울 주요",
      description: "용산, 광진 등",
      tiers: [
        { tier: "일반", price: 180000, priceDisplay: "18억" },
        { tier: "프리미엄", price: 220000, priceDisplay: "22억" },
        { tier: "하이엔드", price: 280000, priceDisplay: "28억" },
      ],
    },
    {
      area: "강남권",
      description: "강남, 서초, 송파",
      tiers: [
        { tier: "일반", price: 250000, priceDisplay: "25억" },
        { tier: "프리미엄", price: 350000, priceDisplay: "35억" },
        { tier: "하이엔드", price: 500000, priceDisplay: "50억" },
      ],
    },
    {
      area: "수도권",
      description: "분당, 판교, 광교 등",
      tiers: [
        { tier: "일반", price: 100000, priceDisplay: "10억" },
        { tier: "프리미엄", price: 150000, priceDisplay: "15억" },
        { tier: "하이엔드", price: 220000, priceDisplay: "22억" },
      ],
    },
  ];
}

// 종합 추가 비용 계산
export interface AdditionalCostsSummary {
  childEducation: {
    details: ChildEducationCost[];
    totalNormal: number;       // 일반 경로 교육비 총합
    totalPremium: number;      // 프리미엄 경로 교육비 총합
    totalWeddingNormal: number;
    totalWeddingPremium: number;
    grandTotalNormal: number;  // 교육비 + 결혼 (일반)
    grandTotalPremium: number; // 교육비 + 결혼 (프리미엄)
  };
  medical: MedicalCostResult;
  leisure: LeisureCostOption[];
  consumerGoods: ConsumerGoodsCostOption[];  // 소비재 (자동차+가전 등)
  housing: HousingCostOption[];
  totalMinimum: number; // 최소 추정 (검소)
  totalMaximum: number; // 최대 추정 (사치)
}

export function calculateAdditionalCosts(
  data: DiagnosisData,
  customParams?: Partial<CalculationParams>
): AdditionalCostsSummary {
  const params = { ...DEFAULT_CALC_PARAMS, ...customParams };
  const effectiveRetirementAge = data.targetRetirementAge + params.retirementAgeOffset;
  const effectiveLifeExpectancy = params.lifeExpectancy ?? data.lifeExpectancy;

  const childEducation = calculateChildEducationCosts(
    data.children,
    data.currentAge,
    effectiveRetirementAge,
    params.inflationRate
  );

  const totalNormal = childEducation.reduce((sum, c) => sum + c.totalNormal, 0);
  const totalPremium = childEducation.reduce((sum, c) => sum + c.totalPremium, 0);
  const totalWeddingNormal = childEducation.reduce((sum, c) => sum + c.weddingNormal, 0);
  const totalWeddingPremium = childEducation.reduce((sum, c) => sum + c.weddingPremium, 0);

  const medical = calculateMedicalCosts(data.currentAge, data.spouseAge, effectiveLifeExpectancy, params.inflationRate);
  const leisure = calculateLeisureCosts(data.currentAge, effectiveRetirementAge, effectiveLifeExpectancy, params.inflationRate);
  const consumerGoods = calculateConsumerGoodsCosts(data.currentAge, effectiveLifeExpectancy, params.inflationRate);
  const housing = getHousingOptions();

  // 최소 추정 (검소: 자녀교육 일반 + 의료 + 여행(기본) + 소비재(검소))
  const totalMinimum = (totalNormal + totalWeddingNormal) + medical.grandTotal +
    (leisure[0]?.totalUntilRetirement || 0) + (leisure[0]?.totalAfterRetirement || 0) +
    (consumerGoods[0]?.totalUntilLifeExpectancy || 0);

  // 최대 추정 (사치: 자녀교육 프리미엄 + 의료 + 여행(여유) + 소비재(사치))
  const totalMaximum = (totalPremium + totalWeddingPremium) + medical.grandTotal +
    (leisure[2]?.totalUntilRetirement || 0) + (leisure[2]?.totalAfterRetirement || 0) +
    (consumerGoods[2]?.totalUntilLifeExpectancy || 0);

  return {
    childEducation: {
      details: childEducation,
      totalNormal,
      totalPremium,
      totalWeddingNormal,
      totalWeddingPremium,
      grandTotalNormal: totalNormal + totalWeddingNormal,
      grandTotalPremium: totalPremium + totalWeddingPremium,
    },
    medical,
    leisure,
    consumerGoods,
    housing,
    totalMinimum,
    totalMaximum,
  };
}

/**
 * DiagnosisData에서 요약 카드용 데이터 계산 (하위호환)
 * @deprecated calculateAllDiagnosisMetrics 사용 권장
 */
export function calculateDiagnosisSummary(data: DiagnosisData) {
  const metrics = calculateAllDiagnosisMetrics(data);

  return {
    // 자산/부채
    totalAsset: metrics.totalAsset,
    totalDebt: metrics.totalDebt,
    netWorth: metrics.netWorth,
    financialAsset: metrics.financialAsset,
    realEstateRatio: metrics.realEstateRatio,
    // 현금흐름
    currentMonthlyGap: metrics.currentMonthlyGap,
    savingsRate: metrics.savingsRate,
    monthlyInterest: metrics.monthlyInterest,
    // 은퇴
    totalPension: metrics.monthlyPension,
    retirementMonthlyExpense: metrics.monthlyExpense,
    monthlyGap: metrics.monthlyGap,
    pensionCoverageRate: metrics.pensionCoverageRate,
    // 자산 지속성
    yearsToRetirement: metrics.yearsToRetirement,
    retirementYears: metrics.retirementYears,
    liquidAssetAtRetirement: metrics.liquidAssetAtRetirement,
    yearsOfWithdrawal: metrics.yearsOfWithdrawal,
  };
}
