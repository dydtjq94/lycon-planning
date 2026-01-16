import { createClient } from "@/lib/supabase/client";
import { simulationService } from "@/lib/services/simulationService";
import type {
  PrepData,
  PrepCompleted,
  PrepTaskId,
  FamilyMember,
  HousingData,
  FinancialAssetItem,
  DebtItem,
  IncomeItem,
  PensionItem,
  ExpenseItem,
} from "../types";
import type { IncomeFormData } from "../components/IncomeInputForm";

const DEFAULT_COMPLETED: PrepCompleted = {
  family: false,
  housing: false,
  financial: false,
  debt: false,
  income: false,
  pension: false,
  expense: false,
};

// 순서대로 진행할 태스크 목록
const TASK_ORDER: PrepTaskId[] = [
  "family",
  "housing",
  "financial",
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
  const [profileResult, familyResult, housingResult, savingsResult] = await Promise.all([
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
      housingType: h.housing_type as "자가" | "전세" | "월세",
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
    };
  }

  // 금융 자산 데이터 변환
  const financial: FinancialAssetItem[] = (savingsResult.data || []).map((s: Record<string, unknown>) => {
    // 저축 계좌 타입 (checking, savings, deposit)
    const savingsTypes = ["checking", "savings", "deposit"];
    const category = savingsTypes.includes(s.type as string) ? "savings" : "investment";

    return {
      id: s.id as string,
      category: category as "savings" | "investment",
      type: s.type as string,
      title: s.title as string,
      owner: s.owner as "self" | "spouse",
      currentBalance: s.current_balance as number,
      monthlyContribution: s.monthly_contribution as number | undefined,
      expectedReturn: s.expected_return as number | undefined,
    };
  });

  return {
    family: (familyResult.data || []) as FamilyMember[],
    housing,
    financial,
    debt: [], // TODO: 구현
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
  }

  // 부동산 삽입
  const { error } = await supabase.from("real_estates").insert(realEstate);
  if (error) throw error;

  // 완료 상태 업데이트
  await markTaskCompleted(userId, "housing");
}

/**
 * 금융 자산 데이터 저장
 */
export async function saveFinancialData(
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

  // 기존 금융 자산 삭제 (source_type이 null인 것만 - 직접 입력한 자산)
  await supabase
    .from("savings")
    .delete()
    .eq("simulation_id", simulation.id)
    .is("memo", null); // memo가 null인 것만 삭제 (직접 입력)

  // 새 금융 자산 데이터 구성
  const savings: Array<{
    simulation_id: string;
    type: string;
    title: string;
    owner: string;
    current_balance: number;
    monthly_contribution: number;
    expected_return: number | null;
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
      monthly_contribution: item.monthlyContribution || 0,
      expected_return: item.category === "investment" ? (item.expectedReturn || 7) : null,
      contribution_start_year: currentYear,
      contribution_start_month: currentMonth,
      is_contribution_fixed_to_retirement: true,
    });
  }

  // 금융 자산 삽입
  if (savings.length > 0) {
    const { error } = await supabase.from("savings").insert(savings);
    if (error) throw error;
  }

  // 완료 상태 업데이트
  await markTaskCompleted(userId, "financial");
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
