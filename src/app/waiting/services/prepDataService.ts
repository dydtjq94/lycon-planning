import { createClient } from "@/lib/supabase/client";
import { simulationService } from "@/lib/services/simulationService";
import type {
  PrepData,
  PrepCompleted,
  PrepTaskId,
  FamilyMember,
  HousingData,
  FinancialAssetItem,
  InvestmentAccountData,
  DebtItem,
  IncomeItem,
  PensionItem,
  ExpenseItem,
} from "../types";
import type { IncomeFormData } from "../components/IncomeInputForm";
import type { PensionFormData } from "../components/PensionInputForm";
import type { ExpenseFormData } from "../components/ExpenseInputForm";

const DEFAULT_COMPLETED: PrepCompleted = {
  family: false,
  housing: false,
  savings: false,
  investment: false,
  debt: false,
  income: false,
  pension: false,
  expense: false,
};

// 순서대로 진행할 태스크 목록
const TASK_ORDER: PrepTaskId[] = [
  "family",
  "housing",
  "savings",
  "investment",
  "debt",
  "income",
  "pension",
  "expense",
];

/**
 * 모든 준비사항 데이터를 한번에 로드
 */
export async function loadPrepData(userId: string): Promise<PrepData> {
  const supabase = createClient();

  // 시뮬레이션 ID 가져오기
  const simulation = await simulationService.getDefault();

  // 병렬로 모든 데이터 로드
  const [profileResult, familyResult, housingResult, savingsResult, debtsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("survey_responses")
      .eq("id", userId)
      .single(),
    supabase
      .from("family_members")
      .select("relationship, name, birth_date, gender")
      .eq("user_id", userId),
    simulation
      ? supabase
          .from("real_estates")
          .select("*")
          .eq("simulation_id", simulation.id)
          .eq("type", "residence")
          .single()
      : Promise.resolve({ data: null }),
    simulation
      ? supabase
          .from("savings")
          .select("*")
          .eq("simulation_id", simulation.id)
      : Promise.resolve({ data: [] }),
    simulation
      ? supabase
          .from("debts")
          .select("*")
          .eq("simulation_id", simulation.id)
          .is("source_type", null) // 직접 입력한 부채만 (housing 연동 제외)
      : Promise.resolve({ data: [] }),
  ]);

  // 완료 상태 파싱
  const prepCompleted = profileResult.data?.survey_responses?.prep_completed || {};
  const completed: PrepCompleted = {
    ...DEFAULT_COMPLETED,
    ...prepCompleted,
  };

  // 거주 부동산 데이터 변환
  let housing: HousingData | null = null;
  if (housingResult.data) {
    const h = housingResult.data;
    housing = {
      housingType: h.housing_type as "자가" | "전세" | "월세" | "무상",
      currentValue: h.current_value || undefined,
      deposit: h.deposit || undefined,
      monthlyRent: h.monthly_rent || undefined,
      maintenanceFee: h.maintenance_fee || undefined,
      hasLoan: h.has_loan || false,
      loanType: h.housing_type === "자가" ? "mortgage" : "jeonse",
      loanAmount: h.loan_amount || undefined,
      loanRate: h.loan_rate || undefined,
      loanRateType: h.loan_rate_type as "fixed" | "floating" | undefined,
      loanMaturityYear: h.loan_maturity_year || undefined,
      loanMaturityMonth: h.loan_maturity_month || undefined,
      loanRepaymentType: h.loan_repayment_type || undefined,
      graceEndYear: h.grace_end_year || undefined,
      graceEndMonth: h.grace_end_month || undefined,
    };
  }

  // 저축 계좌 데이터 변환
  const savingsTypes = ["checking", "savings", "deposit"];
  const savings: FinancialAssetItem[] = (savingsResult.data || [])
    .filter((s: Record<string, unknown>) => savingsTypes.includes(s.type as string))
    .map((s: Record<string, unknown>) => ({
      id: s.id as string,
      category: "savings" as const,
      type: s.type as string,
      title: s.title as string,
      owner: s.owner as "self" | "spouse",
      currentBalance: s.current_balance as number,
      monthlyDeposit: s.monthly_contribution as number | undefined,
      maturityYear: s.maturity_year as number | undefined,
      maturityMonth: s.maturity_month as number | undefined,
      expectedReturn: s.expected_return as number | undefined,
    }));

  // 투자 계좌 데이터 변환 (새 형식)
  // 증권 계좌는 type='other', title='증권 계좌'로 저장됨
  const securitiesData = (savingsResult.data || []).find(
    (s: Record<string, unknown>) => s.type === "other" && s.title === "증권 계좌"
  );
  const cryptoData = (savingsResult.data || []).find(
    (s: Record<string, unknown>) => s.type === "crypto"
  );

  // 금 현물 데이터 로드 (physical_assets 테이블)
  const { data: goldData } = await supabase
    .from("physical_assets")
    .select("*")
    .eq("simulation_id", simulation.id)
    .eq("type", "precious_metal")
    .eq("title", "금 현물")
    .single();

  // 투자 데이터 구성
  let investment: InvestmentAccountData | null = null;
  if (securitiesData || cryptoData || goldData) {
    // memo에서 투자 유형 파싱
    let investmentTypes: string[] = [];
    if (securitiesData?.memo) {
      try {
        const parsed = JSON.parse(securitiesData.memo as string);
        investmentTypes = parsed.investmentTypes || [];
      } catch {
        // JSON 파싱 실패 시 빈 배열
      }
    }

    investment = {
      securities: {
        balance: (securitiesData?.current_balance as number) || 0,
        investmentTypes,
      },
    };

    if (cryptoData) {
      investment.crypto = {
        balance: cryptoData.current_balance as number,
      };
    }

    if (goldData) {
      investment.gold = {
        balance: goldData.current_value as number,
      };
    }
  }

  // 부채 데이터 변환
  const debt: DebtItem[] = (debtsResult.data || []).map((d: Record<string, unknown>) => ({
    id: d.id as string,
    type: d.type as string,
    title: d.title as string,
    principal: d.principal as number,
    currentBalance: d.current_balance as number,
    interestRate: d.interest_rate as number,
    monthlyPayment: d.monthly_payment as number | undefined,
  }));

  return {
    family: (familyResult.data || []) as FamilyMember[],
    housing,
    savings,
    investment,
    debt,
    income: [], // TODO: 구현
    pension: [], // TODO: 구현
    expense: [], // TODO: 구현
    completed,
  };
}

/**
 * 가족 데이터 저장
 */
export async function saveFamilyData(
  userId: string,
  members: FamilyMember[]
): Promise<void> {
  const supabase = createClient();

  // 1. 기존 데이터 삭제
  await supabase.from("family_members").delete().eq("user_id", userId);

  // 2. 새 데이터 삽입
  if (members.length > 0) {
    const { error } = await supabase.from("family_members").insert(
      members.map((m) => ({
        user_id: userId,
        relationship: m.relationship,
        name: m.name,
        birth_date: m.birth_date,
        gender: m.gender,
      }))
    );
    if (error) throw error;
  }

  // 3. 완료 상태 업데이트
  await markTaskCompleted(userId, "family");
}

/**
 * 거주 부동산 데이터 저장
 */
export async function saveHousingData(
  userId: string,
  data: HousingData
): Promise<void> {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 시뮬레이션 ID 가져오기
  const simulation = await simulationService.getDefault();
  if (!simulation) {
    throw new Error("시뮬레이션을 찾을 수 없습니다.");
  }

  // 기존 거주 부동산 삭제 (type = 'residence')
  await supabase
    .from("real_estates")
    .delete()
    .eq("simulation_id", simulation.id)
    .eq("type", "residence");

  // 거주 부동산 데이터 구성
  const realEstate: Record<string, unknown> = {
    simulation_id: simulation.id,
    type: "residence",
    title: "거주 부동산",
    owner: "self",
    housing_type: data.housingType,
    current_value: data.housingType === "자가" ? (data.currentValue || 0) : 0,
    deposit: data.deposit || 0,
    monthly_rent: data.monthlyRent || 0,
    maintenance_fee: data.maintenanceFee || 0,
    has_loan: data.hasLoan,
    growth_rate: 3.0,
  };

  // 대출 정보 추가
  if (data.hasLoan) {
    realEstate.loan_amount = data.loanAmount || 0;
    realEstate.loan_rate = data.loanRate || 0;
    realEstate.loan_rate_type = data.loanRateType || "fixed";
    realEstate.loan_maturity_year = data.loanMaturityYear || currentYear + 20;
    realEstate.loan_maturity_month = data.loanMaturityMonth || 12;
    realEstate.loan_repayment_type = data.loanRepaymentType || "원리금균등";
    realEstate.loan_start_year = currentYear;
    realEstate.loan_start_month = currentMonth;
    // 거치식 - 거치 종료 시점
    if (data.loanRepaymentType === "거치식") {
      realEstate.grace_end_year = data.graceEndYear || currentYear + 3;
      realEstate.grace_end_month = data.graceEndMonth || 12;
    }
  }

  // 부동산 삽입
  const { error } = await supabase.from("real_estates").insert(realEstate);
  if (error) throw error;

  // 완료 상태 업데이트
  await markTaskCompleted(userId, "housing");
}

/**
 * 저축 계좌 데이터 저장
 */
export async function saveSavingsData(
  userId: string,
  items: FinancialAssetItem[]
): Promise<void> {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 시뮬레이션 ID 가져오기
  const simulation = await simulationService.getDefault();
  if (!simulation) {
    throw new Error("시뮬레이션을 찾을 수 없습니다.");
  }

  // 저축 타입들
  const savingsTypes = ["checking", "savings", "deposit"];

  // 기존 저축 계좌 삭제
  await supabase
    .from("savings")
    .delete()
    .eq("simulation_id", simulation.id)
    .in("type", savingsTypes);

  // 새 저축 계좌 데이터 구성
  const savings: Array<{
    simulation_id: string;
    type: string;
    title: string;
    owner: string;
    current_balance: number;
    monthly_contribution: number;
    expected_return: number | null;
    maturity_year: number | null;
    maturity_month: number | null;
    contribution_start_year: number;
    contribution_start_month: number;
    is_contribution_fixed_to_retirement: boolean;
  }> = [];

  for (const item of items) {
    savings.push({
      simulation_id: simulation.id,
      type: item.type,
      title: item.title || `${item.owner === "self" ? "본인" : "배우자"} ${item.type}`,
      owner: item.owner,
      current_balance: item.currentBalance,
      monthly_contribution: item.monthlyDeposit || 0,
      expected_return: item.expectedReturn || null, // 적금/정기예금 금리
      maturity_year: item.maturityYear || null,
      maturity_month: item.maturityMonth || null,
      contribution_start_year: currentYear,
      contribution_start_month: currentMonth,
      is_contribution_fixed_to_retirement: true,
    });
  }

  // 저축 계좌 삽입
  if (savings.length > 0) {
    const { error } = await supabase.from("savings").insert(savings);
    if (error) throw error;
  }

  // 완료 상태 업데이트
  await markTaskCompleted(userId, "savings");
}

/**
 * 투자 계좌 데이터 저장
 */
export async function saveInvestmentData(
  userId: string,
  data: InvestmentAccountData
): Promise<void> {
  const supabase = createClient();

  // 시뮬레이션 ID 가져오기
  const simulation = await simulationService.getDefault();
  if (!simulation) {
    throw new Error("시뮬레이션을 찾을 수 없습니다.");
  }

  // 기존 투자 계좌 삭제 (savings 테이블)
  // 1. 증권 계좌 삭제 (type='other', title='증권 계좌')
  await supabase
    .from("savings")
    .delete()
    .eq("simulation_id", simulation.id)
    .eq("type", "other")
    .eq("title", "증권 계좌");

  // 2. 코인 거래소 삭제
  await supabase
    .from("savings")
    .delete()
    .eq("simulation_id", simulation.id)
    .eq("type", "crypto");

  // 기존 금 현물 삭제 (physical_assets 테이블)
  await supabase
    .from("physical_assets")
    .delete()
    .eq("simulation_id", simulation.id)
    .eq("type", "precious_metal")
    .eq("title", "금 현물");

  // 새 투자 데이터 저장
  const savingsToInsert: Array<{
    simulation_id: string;
    type: string;
    title: string;
    owner: string;
    current_balance: number;
    expected_return: number | null;
    memo: string | null;
  }> = [];

  // 1. 증권 계좌 (type: 'other'로 저장, title로 구분)
  if (data.securities && data.securities.balance > 0) {
    savingsToInsert.push({
      simulation_id: simulation.id,
      type: "other",
      title: "증권 계좌",
      owner: "self",
      current_balance: data.securities.balance,
      expected_return: 7, // 기본 수익률
      memo: data.securities.investmentTypes.length > 0
        ? JSON.stringify({ investmentTypes: data.securities.investmentTypes })
        : null,
    });
  }

  // 2. 코인 거래소
  if (data.crypto && data.crypto.balance > 0) {
    savingsToInsert.push({
      simulation_id: simulation.id,
      type: "crypto",
      title: "코인 거래소",
      owner: "self",
      current_balance: data.crypto.balance,
      expected_return: 10, // 코인 기본 수익률 (높은 변동성)
      memo: null,
    });
  }

  // savings 테이블에 삽입
  if (savingsToInsert.length > 0) {
    const { error } = await supabase.from("savings").insert(savingsToInsert);
    if (error) throw error;
  }

  // 3. 금 현물 (physical_assets 테이블)
  if (data.gold && data.gold.balance > 0) {
    const { error } = await supabase.from("physical_assets").insert({
      simulation_id: simulation.id,
      type: "precious_metal",
      title: "금 현물",
      owner: "self",
      current_value: data.gold.balance,
      annual_rate: 3, // 금 기본 상승률
    });
    if (error) throw error;
  }

  // 완료 상태 업데이트
  await markTaskCompleted(userId, "investment");
}

/**
 * 부채 데이터 저장
 */
export async function saveDebtData(
  userId: string,
  items: DebtItem[]
): Promise<void> {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 시뮬레이션 ID 가져오기
  const simulation = await simulationService.getDefault();
  if (!simulation) {
    throw new Error("시뮬레이션을 찾을 수 없습니다.");
  }

  // 기존 부채 삭제 (source_type이 null인 것만 - 직접 입력한 부채)
  await supabase
    .from("debts")
    .delete()
    .eq("simulation_id", simulation.id)
    .is("source_type", null);

  // 새 부채 데이터 구성
  const debts: Array<{
    simulation_id: string;
    type: string;
    title: string;
    principal: number;
    current_balance: number;
    interest_rate: number;
    repayment_type: string;
    maturity_year: number;
    maturity_month: number;
    start_year: number;
    start_month: number;
  }> = [];

  for (const item of items) {
    debts.push({
      simulation_id: simulation.id,
      type: item.type,
      title: item.title,
      principal: item.principal,
      current_balance: item.currentBalance || item.principal,
      interest_rate: item.interestRate,
      repayment_type: "원리금균등",
      maturity_year: currentYear + 5,
      maturity_month: 12,
      start_year: currentYear,
      start_month: currentMonth,
    });
  }

  // 부채 삽입
  if (debts.length > 0) {
    const { error } = await supabase.from("debts").insert(debts);
    if (error) throw error;
  }

  // 완료 상태 업데이트
  await markTaskCompleted(userId, "debt");
}

/**
 * 소득 데이터 저장
 */
export async function saveIncomeData(
  userId: string,
  data: IncomeFormData
): Promise<void> {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 시뮬레이션 ID 가져오기
  const simulation = await simulationService.getDefault();
  if (!simulation) {
    throw new Error("시뮬레이션을 찾을 수 없습니다.");
  }

  // 기존 소득 삭제 (source_type이 null인 것만 - 직접 입력한 소득)
  await supabase
    .from("incomes")
    .delete()
    .eq("simulation_id", simulation.id)
    .is("source_type", null);

  // 새 소득 데이터 구성
  const incomes: Array<{
    simulation_id: string;
    type: string;
    title: string;
    owner: string;
    amount: number;
    frequency: string;
    start_year: number;
    start_month: number;
    is_fixed_to_retirement: boolean;
    growth_rate: number;
    rate_category: string;
  }> = [];

  // 본인 근로소득
  if (data.selfLaborIncome > 0) {
    incomes.push({
      simulation_id: simulation.id,
      type: "labor",
      title: "본인 급여",
      owner: "self",
      amount: data.selfLaborIncome,
      frequency: data.selfLaborFrequency,
      start_year: currentYear,
      start_month: currentMonth,
      is_fixed_to_retirement: true,
      growth_rate: 3.0,
      rate_category: "income",
    });
  }

  // 배우자 근로소득
  if (data.spouseLaborIncome > 0) {
    incomes.push({
      simulation_id: simulation.id,
      type: "labor",
      title: "배우자 급여",
      owner: "spouse",
      amount: data.spouseLaborIncome,
      frequency: data.spouseLaborFrequency,
      start_year: currentYear,
      start_month: currentMonth,
      is_fixed_to_retirement: true,
      growth_rate: 3.0,
      rate_category: "income",
    });
  }

  // 추가 소득
  for (const additional of data.additionalIncomes) {
    const typeLabels: Record<string, string> = {
      business: "사업소득",
      other: "기타소득",
    };
    const ownerLabel = additional.owner === "self" ? "본인" : "배우자";

    incomes.push({
      simulation_id: simulation.id,
      type: additional.type,
      title: `${ownerLabel} ${typeLabels[additional.type] || additional.type}`,
      owner: additional.owner,
      amount: additional.amount,
      frequency: additional.frequency,
      start_year: currentYear,
      start_month: currentMonth,
      is_fixed_to_retirement: true,
      growth_rate: 3.0,
      rate_category: "income",
    });
  }

  // 소득 삽입
  if (incomes.length > 0) {
    const { error } = await supabase.from("incomes").insert(incomes);
    if (error) throw error;
  }

  // 완료 상태 업데이트
  await markTaskCompleted(userId, "income");
}

/**
 * 연금 데이터 저장
 */
export async function savePensionData(
  userId: string,
  data: PensionFormData
): Promise<void> {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 시뮬레이션 ID 가져오기
  const simulation = await simulationService.getDefault();
  if (!simulation) {
    throw new Error("시뮬레이션을 찾을 수 없습니다.");
  }

  // 기존 연금 삭제
  await supabase
    .from("pensions")
    .delete()
    .eq("simulation_id", simulation.id);

  // 새 연금 데이터 구성
  const pensions: Array<{
    simulation_id: string;
    type: string;
    owner: string;
    expected_monthly_amount?: number;
    current_balance?: number;
    monthly_contribution?: number;
    contribution_start_year?: number;
    contribution_start_month?: number;
  }> = [];

  // 국민연금
  if (data.hasNationalPension) {
    if (data.selfNationalPensionExpected > 0) {
      pensions.push({
        simulation_id: simulation.id,
        type: "national",
        owner: "self",
        expected_monthly_amount: data.selfNationalPensionExpected,
      });
    }
    if (data.spouseNationalPensionExpected > 0) {
      pensions.push({
        simulation_id: simulation.id,
        type: "national",
        owner: "spouse",
        expected_monthly_amount: data.spouseNationalPensionExpected,
      });
    }
  }

  // 퇴직연금
  if (data.hasRetirementPension) {
    if (data.selfRetirementBalance > 0) {
      pensions.push({
        simulation_id: simulation.id,
        type: "retirement",
        owner: "self",
        current_balance: data.selfRetirementBalance,
      });
    }
    if (data.spouseRetirementBalance > 0) {
      pensions.push({
        simulation_id: simulation.id,
        type: "retirement",
        owner: "spouse",
        current_balance: data.spouseRetirementBalance,
      });
    }
  }

  // 개인연금
  if (data.hasPersonalPension) {
    if (data.selfPersonalBalance > 0 || data.selfPersonalMonthly > 0) {
      pensions.push({
        simulation_id: simulation.id,
        type: "personal",
        owner: "self",
        current_balance: data.selfPersonalBalance || 0,
        monthly_contribution: data.selfPersonalMonthly || 0,
        contribution_start_year: currentYear,
        contribution_start_month: currentMonth,
      });
    }
    if (data.spousePersonalBalance > 0 || data.spousePersonalMonthly > 0) {
      pensions.push({
        simulation_id: simulation.id,
        type: "personal",
        owner: "spouse",
        current_balance: data.spousePersonalBalance || 0,
        monthly_contribution: data.spousePersonalMonthly || 0,
        contribution_start_year: currentYear,
        contribution_start_month: currentMonth,
      });
    }
  }

  // 연금 삽입
  if (pensions.length > 0) {
    const { error } = await supabase.from("pensions").insert(pensions);
    if (error) throw error;
  }

  // 완료 상태 업데이트
  await markTaskCompleted(userId, "pension");
}

/**
 * 지출 데이터 저장
 */
export async function saveExpenseData(
  userId: string,
  data: ExpenseFormData
): Promise<void> {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 시뮬레이션 ID 가져오기
  const simulation = await simulationService.getDefault();
  if (!simulation) {
    throw new Error("시뮬레이션을 찾을 수 없습니다.");
  }

  // 기존 지출 삭제 (source_type이 null인 것만 - 직접 입력한 지출)
  await supabase
    .from("expenses")
    .delete()
    .eq("simulation_id", simulation.id)
    .is("source_type", null);

  // 새 지출 데이터 구성
  const expenses: Array<{
    simulation_id: string;
    type: string;
    title: string;
    amount: number;
    frequency: string;
    start_year: number;
    start_month: number;
    growth_rate: number;
    rate_category: string;
  }> = [];

  // 기본 생활비
  if (data.livingExpense > 0) {
    expenses.push({
      simulation_id: simulation.id,
      type: "living",
      title: "기본 생활비",
      amount: data.livingExpense,
      frequency: "monthly",
      start_year: currentYear,
      start_month: currentMonth,
      growth_rate: 3.0,
      rate_category: "expense",
    });
  }

  // 추가 지출
  if (data.hasAdditionalExpense) {
    for (const expense of data.additionalExpenses) {
      const typeLabels: Record<string, string> = {
        food: "식비",
        transport: "교통비",
        communication: "통신비",
        insurance: "보험료",
        medical: "의료비",
        education: "교육비",
        leisure: "여가/문화",
        clothing: "의류/미용",
        other: "기타",
      };

      expenses.push({
        simulation_id: simulation.id,
        type: expense.type,
        title: expense.title || typeLabels[expense.type] || expense.type,
        amount: expense.amount,
        frequency: expense.frequency,
        start_year: currentYear,
        start_month: currentMonth,
        growth_rate: 3.0,
        rate_category: "expense",
      });
    }
  }

  // 지출 삽입
  if (expenses.length > 0) {
    const { error } = await supabase.from("expenses").insert(expenses);
    if (error) throw error;
  }

  // 완료 상태 업데이트
  await markTaskCompleted(userId, "expense");
}

/**
 * 태스크 완료 상태 업데이트
 */
export async function markTaskCompleted(
  userId: string,
  taskId: PrepTaskId
): Promise<void> {
  const supabase = createClient();

  // 기존 survey_responses 가져오기
  const { data: profile } = await supabase
    .from("profiles")
    .select("survey_responses")
    .eq("id", userId)
    .single();

  const surveyResponses = profile?.survey_responses || {};
  const prepCompleted = surveyResponses.prep_completed || {};

  // 완료 상태 업데이트
  await supabase
    .from("profiles")
    .update({
      survey_responses: {
        ...surveyResponses,
        prep_completed: {
          ...prepCompleted,
          [taskId]: true,
        },
      },
    })
    .eq("id", userId);
}

/**
 * 완료된 태스크 ID 목록 반환
 */
export function getCompletedTaskIds(completed: PrepCompleted): PrepTaskId[] {
  return (Object.keys(completed) as PrepTaskId[]).filter(
    (key) => completed[key]
  );
}

/**
 * 다음 해야할 태스크 인덱스 반환
 */
export function getNextTaskIndex(completed: PrepCompleted): number {
  for (let i = 0; i < TASK_ORDER.length; i++) {
    if (!completed[TASK_ORDER[i]]) {
      return i;
    }
  }
  return TASK_ORDER.length; // 모두 완료
}
