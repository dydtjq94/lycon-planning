"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  OpeningSection,
  CashFlowSection,
  AssetsSection,
  OpeningData,
  CashFlowData,
} from "./sections";
import { getRealEstates } from "@/lib/services/realEstateService";
import { getSavings } from "@/lib/services/savingsService";
import { getDebts } from "@/lib/services/debtService";
import { getInsurances } from "@/lib/services/insuranceService";
import { getNationalPensions } from "@/lib/services/nationalPensionService";
import { getRetirementPensions } from "@/lib/services/retirementPensionService";
import { getPersonalPensions } from "@/lib/services/personalPensionService";
import { formatMoney } from "@/lib/utils";
import type {
  RealEstate,
  Savings,
  NationalPension,
  RetirementPension,
  PersonalPension,
  Debt,
  Insurance,
} from "@/types/tables";
import styles from "./ConsultationNote.module.css";

interface ConsultationNoteProps {
  userId: string;
  birthYear: number;
  retirementAge: number;
}

// 설문 응답 라벨
const SURVEY_LABELS: Record<string, Record<string, string>> = {
  visit_purpose: {
    retirement_worry: "은퇴 후 생활이 걱정돼요",
    financial_checkup: "내 재정 상태를 점검받고 싶어요",
    asset_management: "자산 관리 방법을 알고 싶어요",
    strategy: "연금/투자 전략이 궁금해요",
    expert_advice: "전문가 조언이 필요해요",
    curious: "그냥 한번 써보려고요",
  },
  money_feeling: {
    confident: "든든하고 여유롭다",
    varies: "그때그때 다르다",
    anxious: "왠지 불안하다",
    avoid: "생각하기 싫다",
  },
  financial_goal: {
    retirement: "편안한 노후",
    house: "내 집 마련",
    children: "자녀 교육/결혼",
    freedom: "경제적 자유",
    debt: "빚 갚기",
  },
  income_range: {
    under_1200: "1,200만원 이하",
    "1200_4600": "1,200~4,600만원",
    "4600_8800": "4,600~8,800만원",
    "8800_15000": "8,800만원~1.5억",
    over_15000: "1.5억 초과",
  },
  monthly_expense: {
    under_200: "200만원 미만",
    "200_300": "200~300만원",
    "300_500": "300~500만원",
    over_500: "500만원 이상",
  },
  monthly_investment: {
    under_50: "50만원 미만",
    "50_100": "50~100만원",
    "100_200": "100~200만원",
    over_200: "200만원 이상",
    none: "잘 못하고 있어요",
  },
  marital_status: {
    single: "미혼",
    married: "기혼",
    divorced: "이혼/사별",
  },
  children: {
    none: "없음",
    one: "1명",
    two: "2명",
    three_plus: "3명 이상",
  },
  // 추가 온보딩 필드
  saving_style: {
    aggressive: "적극적 저축",
    moderate: "적당히",
    minimal: "최소한",
    none: "못하고 있어요",
  },
  investment_exp: {
    stock_domestic: "국내주식",
    stock_foreign: "해외주식",
    fund: "펀드",
    bond: "채권",
    crypto: "암호화폐",
    real_estate: "부동산",
    none: "없음",
  },
  budget_tracking: {
    always: "항상 체크",
    sometimes: "가끔",
    rarely: "거의 안함",
    never: "전혀 안함",
  },
  retirement_worry: {
    very: "매우 걱정",
    somewhat: "약간 걱정",
    little: "조금",
    none: "안함",
  },
  pension_awareness: {
    exact: "정확히 알고 있음",
    rough: "대략 알고 있음",
    little: "잘 모름",
    none: "전혀 모름",
  },
  today_vs_tomorrow: {
    today: "오늘을 위해",
    balanced: "균형있게",
    tomorrow: "미래를 위해",
  },
  retirement_concern: {
    pension_shortage: "연금 부족",
    healthcare: "의료비",
    longevity: "장수 리스크",
    inflation: "물가 상승",
    housing: "주거 문제",
  },
};

interface SurveyResponses {
  onboarding?: {
    visit_purpose?: string[];
    money_feeling?: string;
    financial_goal?: string;
    income_range?: string;
    monthly_expense?: string;
    monthly_investment?: string;
    marital_status?: string;
    children?: string;
    // 추가 온보딩 필드
    saving_style?: string;
    investment_exp?: string[];
    budget_tracking?: string;
    retirement_worry?: string;
    pension_awareness?: string;
    today_vs_tomorrow?: string;
    retirement_concern?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

type SidebarTab = "onboarding" | "data";

export function ConsultationNote({
  userId,
  birthYear,
  retirementAge,
}: ConsultationNoteProps) {
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("고객님");
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponses>({});
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("onboarding");

  // Opening section data
  const [openingData, setOpeningData] = useState<OpeningData>({
    concerns: "",
    targetRetirementAge: retirementAge,
    targetMonthlyIncome: 300,
  });

  // CashFlow section data
  const [cashFlowData, setCashFlowData] = useState<CashFlowData>({
    totalMonthlyIncome: 0,
    totalMonthlyExpense: 0,
    monthlySavings: 0,
    savingsRate: 0,
    incomes: [],
    expenses: [],
  });

  // Assets data state
  const [realEstates, setRealEstates] = useState<RealEstate[]>([]);
  const [savings, setSavings] = useState<Savings[]>([]);
  const [nationalPensions, setNationalPensions] = useState<NationalPension[]>(
    [],
  );
  const [retirementPensions, setRetirementPensions] = useState<
    RetirementPension[]
  >([]);
  const [personalPensions, setPersonalPensions] = useState<PersonalPension[]>(
    [],
  );
  const [debts, setDebts] = useState<Debt[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);

  // Load assets data
  const loadAssetsData = async () => {
    if (!simulationId) return;

    const [
      realEstatesData,
      savingsData,
      nationalPensionsData,
      retirementPensionsData,
      personalPensionsData,
      debtsData,
      insurancesData,
    ] = await Promise.all([
      getRealEstates(simulationId),
      getSavings(simulationId),
      getNationalPensions(simulationId),
      getRetirementPensions(simulationId),
      getPersonalPensions(simulationId),
      getDebts(simulationId),
      getInsurances(simulationId),
    ]);

    setRealEstates(realEstatesData);
    setSavings(savingsData);
    setNationalPensions(nationalPensionsData);
    setRetirementPensions(retirementPensionsData);
    setPersonalPensions(personalPensionsData);
    setDebts(debtsData);
    setInsurances(insurancesData);
  };

  // 시뮬레이션 ID 및 고객명, 설문 응답 가져오기
  useEffect(() => {
    const loadSimulation = async () => {
      const supabase = createClient();

      // 고객 프로필 가져오기 (이름 + 설문 응답)
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, survey_responses")
        .eq("id", userId)
        .single();

      if (profile?.name) {
        setCustomerName(profile.name);
      }
      if (profile?.survey_responses) {
        setSurveyResponses(profile.survey_responses as SurveyResponses);
      }

      const { data: existing } = await supabase
        .from("simulations")
        .select("id")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let simId: string | null = null;

      if (existing) {
        simId = existing.id;
        setSimulationId(existing.id);
      } else {
        const { data: newSim } = await supabase
          .from("simulations")
          .insert({
            profile_id: userId,
            name: "기본 시뮬레이션",
            birth_year: birthYear,
            retirement_age: retirementAge,
          })
          .select("id")
          .single();

        if (newSim) {
          simId = newSim.id;
          setSimulationId(newSim.id);
        }
      }

      // Load assets data after setting simulation ID
      if (simId) {
        const [
          realEstatesData,
          savingsData,
          nationalPensionsData,
          retirementPensionsData,
          personalPensionsData,
          debtsData,
          insurancesData,
        ] = await Promise.all([
          getRealEstates(simId),
          getSavings(simId),
          getNationalPensions(simId),
          getRetirementPensions(simId),
          getPersonalPensions(simId),
          getDebts(simId),
          getInsurances(simId),
        ]);

        setRealEstates(realEstatesData);
        setSavings(savingsData);
        setNationalPensions(nationalPensionsData);
        setRetirementPensions(retirementPensionsData);
        setPersonalPensions(personalPensionsData);
        setDebts(debtsData);
        setInsurances(insurancesData);
      }

      setLoading(false);
    };

    loadSimulation();
  }, [userId, birthYear, retirementAge]);

  if (loading || !simulationId) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;
  const onboarding = surveyResponses?.onboarding || {};

  // 설문 라벨 가져오기 헬퍼
  const getLabel = (key: string, value: string | string[] | undefined) => {
    if (!value) return "-";
    if (Array.isArray(value)) {
      return value.map((v) => SURVEY_LABELS[key]?.[v] || v).join(", ");
    }
    return SURVEY_LABELS[key]?.[value] || value;
  };

  // 자산 요약 계산
  const totalRealEstateValue = realEstates.reduce(
    (sum, re) => sum + re.current_value,
    0,
  );
  const totalFinancialAssets = savings.reduce(
    (sum, s) => sum + s.current_balance,
    0,
  );
  const totalDebtBalance = debts.reduce(
    (sum, d) => sum + (d.current_balance || d.principal),
    0,
  );

  return (
    <div className={styles.container}>
      {/* Document Header */}
      <div className={styles.documentHeader}>
        <h1 className={styles.documentTitle}>기본형 재무 검진</h1>
        <p className={styles.documentSubtitle}>
          {customerName} ({currentAge}세) | {currentYear}년
        </p>
      </div>

      {/* 2 Column Layout - Main Content + Sticky Sidebar */}
      <div className={styles.documentBody}>
        {/* Left: 상담 내용 */}
        <div className={styles.mainColumn}>
          {/* Section 1: 오프닝 */}
          <section className={styles.documentSection}>
            <h2 className={styles.sectionTitle}>1. 기본 정보 및 상담 목표</h2>
            <OpeningSection
              userId={userId}
              simulationId={simulationId}
              birthYear={birthYear}
              retirementAge={retirementAge}
              customerName={customerName}
              onDataChange={setOpeningData}
            />
          </section>

          {/* Section 2: 돈의 흐름 */}
          <section className={styles.documentSection}>
            <h2 className={styles.sectionTitle}>2. 월 현금흐름</h2>
            <CashFlowSection
              userId={userId}
              simulationId={simulationId}
              birthYear={birthYear}
              retirementAge={retirementAge}
              onDataChange={setCashFlowData}
            />
          </section>

          {/* Section 3: 자산/부채 */}
          <section className={styles.documentSection}>
            <h2 className={styles.sectionTitle}>3. 자산 및 부채 현황</h2>
            <AssetsSection
              userId={userId}
              simulationId={simulationId}
              birthYear={birthYear}
              retirementAge={retirementAge}
              realEstates={realEstates}
              savings={savings}
              nationalPensions={nationalPensions}
              retirementPensions={retirementPensions}
              personalPensions={personalPensions}
              debts={debts}
              onUpdate={loadAssetsData}
            />
          </section>
        </div>

        {/* Right: Sticky 고객 정보 패널 */}
        <div className={styles.sidebarColumn}>
          <div className={styles.stickyPanel}>
            {/* 탭 */}
            <div className={styles.sidebarTabs}>
              <button
                className={`${styles.sidebarTab} ${sidebarTab === "onboarding" ? styles.active : ""}`}
                onClick={() => setSidebarTab("onboarding")}
              >
                온보딩 응답
              </button>
              <button
                className={`${styles.sidebarTab} ${sidebarTab === "data" ? styles.active : ""}`}
                onClick={() => setSidebarTab("data")}
              >
                입력된 데이터
              </button>
            </div>

            {/* 온보딩 응답 탭 */}
            {sidebarTab === "onboarding" && (
              <div className={styles.tabContent}>
                <div className={styles.panelSection}>
                  <h3 className={styles.panelTitle}>목표</h3>
                  <div className={styles.responseContent}>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>방문 목적</span>
                      <span className={styles.responseValue}>
                        {getLabel("visit_purpose", onboarding.visit_purpose)}
                      </span>
                    </div>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>재정 목표</span>
                      <span className={styles.responseValue}>
                        {getLabel("financial_goal", onboarding.financial_goal)}
                      </span>
                    </div>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>돈 생각하면</span>
                      <span className={styles.responseValue}>
                        {getLabel("money_feeling", onboarding.money_feeling)}
                      </span>
                    </div>
                    {onboarding.retirement_worry && (
                      <div className={styles.responseItem}>
                        <span className={styles.responseLabel}>은퇴 걱정</span>
                        <span className={styles.responseValue}>
                          {getLabel(
                            "retirement_worry",
                            onboarding.retirement_worry,
                          )}
                        </span>
                      </div>
                    )}
                    {onboarding.retirement_concern && (
                      <div className={styles.responseItem}>
                        <span className={styles.responseLabel}>은퇴 우려</span>
                        <span className={styles.responseValue}>
                          {getLabel(
                            "retirement_concern",
                            onboarding.retirement_concern,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.panelDivider} />

                <div className={styles.panelSection}>
                  <h3 className={styles.panelTitle}>가족</h3>
                  <div className={styles.responseContent}>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>결혼 여부</span>
                      <span className={styles.responseValue}>
                        {getLabel("marital_status", onboarding.marital_status)}
                      </span>
                    </div>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>자녀</span>
                      <span className={styles.responseValue}>
                        {getLabel("children", onboarding.children)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.panelDivider} />

                <div className={styles.panelSection}>
                  <h3 className={styles.panelTitle}>재무 상황</h3>
                  <div className={styles.responseContent}>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>연 소득</span>
                      <span className={styles.responseValue}>
                        {getLabel("income_range", onboarding.income_range)}
                      </span>
                    </div>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>월 생활비</span>
                      <span className={styles.responseValue}>
                        {getLabel(
                          "monthly_expense",
                          onboarding.monthly_expense,
                        )}
                      </span>
                    </div>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>월 저축</span>
                      <span className={styles.responseValue}>
                        {getLabel(
                          "monthly_investment",
                          onboarding.monthly_investment,
                        )}
                      </span>
                    </div>
                    {onboarding.budget_tracking && (
                      <div className={styles.responseItem}>
                        <span className={styles.responseLabel}>예산 관리</span>
                        <span className={styles.responseValue}>
                          {getLabel(
                            "budget_tracking",
                            onboarding.budget_tracking,
                          )}
                        </span>
                      </div>
                    )}
                    {onboarding.saving_style && (
                      <div className={styles.responseItem}>
                        <span className={styles.responseLabel}>
                          저축 스타일
                        </span>
                        <span className={styles.responseValue}>
                          {getLabel("saving_style", onboarding.saving_style)}
                        </span>
                      </div>
                    )}
                    {onboarding.investment_exp && (
                      <div className={styles.responseItem}>
                        <span className={styles.responseLabel}>투자 경험</span>
                        <span className={styles.responseValue}>
                          {getLabel(
                            "investment_exp",
                            onboarding.investment_exp,
                          )}
                        </span>
                      </div>
                    )}
                    {onboarding.pension_awareness && (
                      <div className={styles.responseItem}>
                        <span className={styles.responseLabel}>
                          연금 인지도
                        </span>
                        <span className={styles.responseValue}>
                          {getLabel(
                            "pension_awareness",
                            onboarding.pension_awareness,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 입력된 데이터 탭 */}
            {sidebarTab === "data" && (
              <div className={styles.tabContent}>
                <div className={styles.panelSection}>
                  <h3 className={styles.panelTitle}>현금흐름</h3>
                  <div className={styles.responseContent}>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>월 수입</span>
                      <span className={styles.responseValue}>
                        {cashFlowData.totalMonthlyIncome > 0
                          ? formatMoney(cashFlowData.totalMonthlyIncome)
                          : "-"}
                      </span>
                    </div>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>월 지출</span>
                      <span className={styles.responseValue}>
                        {cashFlowData.totalMonthlyExpense > 0
                          ? formatMoney(cashFlowData.totalMonthlyExpense)
                          : "-"}
                      </span>
                    </div>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>월 저축액</span>
                      <span className={styles.responseValueHighlight}>
                        {cashFlowData.monthlySavings !== 0
                          ? formatMoney(cashFlowData.monthlySavings)
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.panelDivider} />

                <div className={styles.panelSection}>
                  <h3 className={styles.panelTitle}>자산</h3>
                  <div className={styles.responseContent}>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>부동산</span>
                      <span className={styles.responseValue}>
                        {realEstates.length > 0
                          ? formatMoney(totalRealEstateValue)
                          : "-"}
                      </span>
                    </div>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>금융자산</span>
                      <span className={styles.responseValue}>
                        {savings.length > 0
                          ? formatMoney(totalFinancialAssets)
                          : "-"}
                      </span>
                    </div>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>연금</span>
                      <span className={styles.responseValue}>
                        {nationalPensions.length +
                          retirementPensions.length +
                          personalPensions.length >
                        0
                          ? `${nationalPensions.length + retirementPensions.length + personalPensions.length}건`
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.panelDivider} />

                <div className={styles.panelSection}>
                  <h3 className={styles.panelTitle}>부채/보험</h3>
                  <div className={styles.responseContent}>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>부채</span>
                      <span className={styles.responseValue}>
                        {debts.length > 0 ? formatMoney(totalDebtBalance) : "-"}
                      </span>
                    </div>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabel}>보험</span>
                      <span className={styles.responseValue}>
                        {insurances.length > 0 ? `${insurances.length}건` : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.panelDivider} />

                <div className={styles.panelSection}>
                  <div className={styles.responseContent}>
                    <div className={styles.responseItem}>
                      <span className={styles.responseLabelBold}>순자산</span>
                      <span className={styles.responseValueHighlight}>
                        {formatMoney(
                          totalRealEstateValue +
                            totalFinancialAssets -
                            totalDebtBalance,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
