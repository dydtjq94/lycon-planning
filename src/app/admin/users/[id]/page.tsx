"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, MessageSquare, Check } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { NotesSection, FinanceManager } from "./components";
import styles from "./UserDetail.module.css";

interface Profile {
  id: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
  target_retirement_age: number;
  created_at: string;
  onboarding_step: string | null;
  prep_data: PrepData | null;
  survey_responses: SurveyResponsesData | null;
  phone_number: string | null;
  booking_info: {
    date: string;
    time: string;
    expert: string;
    booked_at: string;
  } | null;
}

interface SurveyResponsesData {
  onboarding?: Record<string, string | string[]>;
  updated_at?: string;
  completed_at?: string;
}

interface PrepData {
  family?: PrepFamilyMember[];
  income?: PrepIncomeData;
  expense?: PrepExpenseData;
  savings?: PrepSavingsItem[];
  investment?: PrepInvestmentData;
  housing?: PrepHousingData;
  debt?: PrepDebtItem[];
  nationalPension?: PrepNationalPensionData;
  retirementPension?: PrepRetirementPensionData;
  personalPension?: PrepPersonalPensionItem[];
}

interface PrepFamilyMember {
  relationship: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
}

interface PrepIncomeData {
  selfLaborIncome: number;
  selfLaborFrequency: "monthly" | "yearly";
  spouseLaborIncome: number;
  spouseLaborFrequency: "monthly" | "yearly";
  additionalIncomes: Array<{
    type: string;
    owner: "self" | "spouse";
    amount: number;
    frequency: "monthly" | "yearly";
  }>;
}

interface PrepExpenseData {
  livingExpense: number;
  livingExpenseDetails?: {
    food?: number;
    transport?: number;
    shopping?: number;
    leisure?: number;
  };
  fixedExpenses: Array<{
    type: string;
    title: string;
    amount: number;
    frequency: "monthly" | "yearly";
  }>;
  variableExpenses: Array<{
    type: string;
    title: string;
    amount: number;
    frequency: "monthly" | "yearly";
  }>;
}

interface PrepSavingsItem {
  category: string;
  type: string;
  title: string;
  owner: "self" | "spouse";
  currentBalance: number;
  monthlyDeposit?: number;
  expectedReturn?: number;
}

interface PrepInvestmentData {
  securities?: { balance: number; investmentTypes: string[] };
  crypto?: { balance: number };
  gold?: { balance: number };
}

interface PrepHousingData {
  housingType: "자가" | "전세" | "월세" | "무상";
  currentValue?: number;
  deposit?: number;
  monthlyRent?: number;
  maintenanceFee?: number;
  hasLoan: boolean;
  loanType?: "mortgage" | "jeonse";
  loanAmount?: number;
  loanRate?: number;
  loanRateType?: "fixed" | "floating";
  loanMaturityYear?: number;
  loanMaturityMonth?: number;
}

interface PrepDebtItem {
  type: string;
  title: string;
  principal: number;
  currentBalance?: number;
  interestRate: number;
}

interface PrepNationalPensionData {
  selfType: string;
  selfExpectedAmount: number;
  spouseType: string;
  spouseExpectedAmount: number;
}

interface PrepRetirementPensionData {
  selfType: string;
  selfYearsWorked: number | null;
  selfBalance: number | null;
  spouseType: string;
  spouseYearsWorked: number | null;
  spouseBalance: number | null;
}

interface PrepPersonalPensionItem {
  type: string;
  owner: "self" | "spouse";
  balance: number;
  monthlyDeposit: number;
}

// 온보딩 설문 데이터
const SURVEY_OPTIONS: Record<string, { label: string; options: Record<string, string> }> = {
  visit_purpose: {
    label: "방문 목적",
    options: {
      retirement_worry: "은퇴 후 생활이 걱정돼요",
      financial_checkup: "내 재정 상태를 점검받고 싶어요",
      asset_management: "자산 관리 방법을 알고 싶어요",
      strategy: "연금/투자 전략이 궁금해요",
      expert_advice: "전문가 조언이 필요해요",
      curious: "그냥 한번 써보려고요",
    },
  },
  money_feeling: {
    label: "돈 생각하면?",
    options: {
      confident: "든든하고 여유롭다",
      varies: "그때그때 다르다",
      anxious: "왠지 불안하다",
      avoid: "생각하기 싫다",
    },
  },
  money_importance: {
    label: "돈의 중요성",
    options: {
      very: "아주 중요하다",
      important: "중요한 편이다",
      moderate: "보통이다",
      not_much: "별로 안 중요하다",
    },
  },
  financial_goal: {
    label: "재무 목표",
    options: {
      retirement: "편안한 노후",
      house: "내 집 마련",
      children: "자녀 교육/결혼",
      freedom: "경제적 자유",
      debt: "빚 갚기",
    },
  },
  today_vs_tomorrow: {
    label: "오늘 vs 미래",
    options: {
      today: "오늘을 즐기는 편",
      tomorrow: "미래를 위해 아끼는 편",
      balance: "반반",
    },
  },
  marital_status: {
    label: "결혼 여부",
    options: { single: "미혼", married: "기혼", divorced: "이혼/사별" },
  },
  children: {
    label: "자녀",
    options: { none: "없음", one: "1명", two: "2명", three_plus: "3명 이상" },
  },
  income_range: {
    label: "연 소득",
    options: {
      under_3000: "3,000만원 이하",
      "3000_5000": "3,000~5,000만원",
      "5000_8000": "5,000~8,000만원",
      "8000_12000": "8,000만원~1.2억",
      over_12000: "1.2억 초과",
    },
  },
  monthly_expense: {
    label: "월 생활비",
    options: {
      under_200: "200만원 미만",
      "200_300": "200~300만원",
      "300_500": "300~500만원",
      over_500: "500만원 이상",
    },
  },
  monthly_investment: {
    label: "월 저축/투자",
    options: {
      none: "거의 못 하고 있어요",
      under_50: "50만원 미만",
      "50_100": "50~100만원",
      "100_300": "100~300만원",
      over_300: "300만원 이상",
    },
  },
  saving_style: {
    label: "투자 스타일",
    options: {
      aggressive: "적극적으로 투자하는 편",
      balanced: "저축과 투자 반반",
      conservative: "안전하게 저축하는 편",
      passive: "딱히 안 하는 편",
    },
  },
  budget_tracking: {
    label: "가계부",
    options: {
      always: "꾸준히 쓴다",
      sometimes: "가끔 쓴다",
      tried: "쓰다가 포기",
      never: "안 쓴다",
    },
  },
  investment_exp: {
    label: "투자 경험",
    options: {
      stock_domestic: "국내 주식/ETF",
      stock_foreign: "해외 주식/ETF",
      fund: "펀드",
      bond: "채권",
      realestate: "부동산",
      crypto: "가상자산",
      gold: "금/원자재",
      none: "없어요",
    },
  },
  retirement_worry: {
    label: "은퇴 걱정",
    options: {
      none: "전혀 걱정되지 않는다",
      little: "별로 걱정되지 않는다",
      somewhat: "좀 걱정된다",
      very: "많이 걱정된다",
    },
  },
  pension_awareness: {
    label: "연금 인지",
    options: {
      exact: "정확히 알아요",
      roughly: "대충은 알아요",
      unknown: "잘 몰라요",
    },
  },
  retirement_concern: {
    label: "가장 걱정",
    options: {
      pension_shortage: "연금만으론 부족할 것 같다",
      medical: "의료비/간병비가 걱정된다",
      children_balance: "자녀 지원과 노후 준비 사이 균형",
      dont_know: "뭐부터 해야 할지 모르겠다",
      no_worry: "딱히 걱정 없다",
    },
  },
};

type MainTab = "overview" | "prep" | "finance" | "notes";

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("overview");
  const [expertId, setExpertId] = useState<string | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: expert } = await supabase
          .from("experts")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (expert) {
          setExpertId(expert.id);
        }
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      setLoading(false);
    };

    loadUserData();
  }, [userId]);

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const isSelected = (questionId: string, optionKey: string) => {
    const survey = profile?.survey_responses?.onboarding || {};
    const value = survey[questionId];
    if (!value) return false;
    if (Array.isArray(value)) return value.includes(optionKey);
    return value === optionKey;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>유저를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const survey = profile.survey_responses?.onboarding || {};
  const prep = profile.prep_data || {};

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => router.push("/admin")}>
          <ChevronLeft size={18} />
        </button>
        <div className={styles.headerInfo}>
          <h1 className={styles.userName}>{profile.name}</h1>
          <div className={styles.userMeta}>
            {getAge(profile.birth_date) && <span>{getAge(profile.birth_date)}세</span>}
            {profile.gender && <span>{profile.gender === "male" ? "남" : "여"}</span>}
            {profile.phone_number && <span>{profile.phone_number}</span>}
          </div>
        </div>
        <button
          className={styles.chatButton}
          onClick={() => router.push(`/admin/chat/${userId}`)}
        >
          <MessageSquare size={18} />
          <span>채팅</span>
        </button>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${mainTab === "overview" ? styles.active : ""}`}
          onClick={() => setMainTab("overview")}
        >
          개요
        </button>
        <button
          className={`${styles.tab} ${mainTab === "prep" ? styles.active : ""}`}
          onClick={() => setMainTab("prep")}
        >
          상담전 확인
        </button>
        <button
          className={`${styles.tab} ${mainTab === "finance" ? styles.active : ""}`}
          onClick={() => setMainTab("finance")}
        >
          재무 입력
        </button>
        <button
          className={`${styles.tab} ${mainTab === "notes" ? styles.active : ""}`}
          onClick={() => setMainTab("notes")}
        >
          상담 노트
        </button>
      </div>

      {/* 개요 탭 */}
      {mainTab === "overview" && (
        <div className={styles.overviewContent}>
          <div className={styles.overviewGrid}>
            {/* 기본 정보 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>기본 정보</h3>
              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>이름</span>
                  <span className={styles.infoValue}>{profile.name}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>생년월일</span>
                  <span className={styles.infoValue}>
                    {profile.birth_date || "-"}
                    {getAge(profile.birth_date) && ` (${getAge(profile.birth_date)}세)`}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>성별</span>
                  <span className={styles.infoValue}>
                    {profile.gender === "male" ? "남성" : profile.gender === "female" ? "여성" : "-"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>연락처</span>
                  <span className={styles.infoValue}>{profile.phone_number || "-"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>목표 은퇴 나이</span>
                  <span className={styles.infoValue}>{profile.target_retirement_age || 60}세</span>
                </div>
              </div>
            </div>

            {/* 예약 정보 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>예약 정보</h3>
              {profile.booking_info ? (
                <div className={styles.infoList}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>예약일</span>
                    <span className={styles.infoValue}>
                      {new Date(profile.booking_info.date).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>시간</span>
                    <span className={styles.infoValue}>{profile.booking_info.time}</span>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyCard}>예약 정보가 없습니다.</div>
              )}
            </div>

            {/* 온보딩 현황 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>온보딩 현황</h3>
              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>진행 상태</span>
                  <span className={styles.infoValue}>
                    {profile.onboarding_step === "completed" ? "완료" : "진행 중"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>설문 응답</span>
                  <span className={styles.infoValue}>
                    {Object.keys(survey).length}개 항목
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>가입일</span>
                  <span className={styles.infoValue}>
                    {new Date(profile.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              </div>
            </div>

            {/* 재무 요약 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>재무 요약 (입력해두기)</h3>
              {Object.keys(prep).length === 0 ? (
                <div className={styles.emptyCard}>입력된 정보가 없습니다.</div>
              ) : (
                <div className={styles.infoList}>
                  {prep.income && (prep.income.selfLaborIncome > 0 || prep.income.spouseLaborIncome > 0) && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>월 소득</span>
                      <span className={styles.infoValue}>
                        {formatMoney(
                          (prep.income.selfLaborFrequency === "monthly" ? prep.income.selfLaborIncome : prep.income.selfLaborIncome / 12) +
                          (prep.income.spouseLaborFrequency === "monthly" ? prep.income.spouseLaborIncome : prep.income.spouseLaborIncome / 12)
                        )}
                      </span>
                    </div>
                  )}
                  {prep.expense && prep.expense.livingExpense > 0 && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>월 생활비</span>
                      <span className={styles.infoValue}>{formatMoney(prep.expense.livingExpense)}</span>
                    </div>
                  )}
                  {prep.housing && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>주거</span>
                      <span className={styles.infoValue}>{prep.housing.housingType}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 상담전 확인 탭 */}
      {mainTab === "prep" && (
        <div className={styles.prepContent}>
          <div className={styles.prepGrid}>
            {/* 온보딩 설문 */}
            <div className={styles.prepColumn}>
              <h2 className={styles.prepColumnTitle}>온보딩 설문</h2>
              {Object.keys(survey).length === 0 ? (
                <div className={styles.emptySection}>설문 응답이 없습니다.</div>
              ) : (
                <div className={styles.surveyList}>
                  {Object.entries(SURVEY_OPTIONS).map(([questionId, { label, options }]) => {
                    const hasAnswer = survey[questionId] !== undefined;
                    if (!hasAnswer) return null;

                    return (
                      <div key={questionId} className={styles.surveyQuestion}>
                        <div className={styles.surveyQuestionLabel}>{label}</div>
                        <div className={styles.surveyOptions}>
                          {Object.entries(options).map(([optionKey, optionLabel]) => {
                            const selected = isSelected(questionId, optionKey);
                            return (
                              <div
                                key={optionKey}
                                className={`${styles.surveyOption} ${selected ? styles.selected : ""}`}
                              >
                                {selected && <Check size={14} className={styles.checkIcon} />}
                                <span>{optionLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 입력해두기 */}
            <div className={styles.prepColumn}>
              <h2 className={styles.prepColumnTitle}>입력해두기</h2>
              {Object.keys(prep).length === 0 ? (
                <div className={styles.emptySection}>입력된 정보가 없습니다.</div>
              ) : (
                <div className={styles.prepList}>
                  {prep.family && prep.family.length > 0 && (
                    <div className={styles.prepSection}>
                      <div className={styles.prepSectionTitle}>가족 구성</div>
                      {prep.family.map((member, idx) => {
                        const age = member.birth_date ? getAge(member.birth_date) : null;
                        const relLabel = {
                          self: "본인",
                          spouse: "배우자",
                          child: "자녀",
                          parent: "부양부모",
                        }[member.relationship] || member.relationship;
                        return (
                          <div key={idx} className={styles.prepItem}>
                            <span className={styles.prepLabel}>{relLabel}</span>
                            <span className={styles.prepValue}>
                              {member.name || "-"}
                              {age !== null && ` (${age}세)`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {prep.income && (
                    <div className={styles.prepSection}>
                      <div className={styles.prepSectionTitle}>소득</div>
                      {prep.income.selfLaborIncome > 0 && (
                        <div className={styles.prepItem}>
                          <span className={styles.prepLabel}>본인 근로소득</span>
                          <span className={styles.prepValue}>
                            {formatMoney(prep.income.selfLaborIncome)} / {prep.income.selfLaborFrequency === "monthly" ? "월" : "년"}
                          </span>
                        </div>
                      )}
                      {prep.income.spouseLaborIncome > 0 && (
                        <div className={styles.prepItem}>
                          <span className={styles.prepLabel}>배우자 근로소득</span>
                          <span className={styles.prepValue}>
                            {formatMoney(prep.income.spouseLaborIncome)} / {prep.income.spouseLaborFrequency === "monthly" ? "월" : "년"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {prep.expense && prep.expense.livingExpense > 0 && (
                    <div className={styles.prepSection}>
                      <div className={styles.prepSectionTitle}>지출</div>
                      <div className={styles.prepItem}>
                        <span className={styles.prepLabel}>월 변동 생활비</span>
                        <span className={styles.prepValue}>{formatMoney(prep.expense.livingExpense)} / 월</span>
                      </div>
                    </div>
                  )}

                  {prep.savings && prep.savings.length > 0 && (
                    <div className={styles.prepSection}>
                      <div className={styles.prepSectionTitle}>저축</div>
                      {prep.savings.map((item, idx) => (
                        <div key={idx} className={styles.prepItem}>
                          <span className={styles.prepLabel}>{item.title || item.type}</span>
                          <span className={styles.prepValue}>{formatMoney(item.currentBalance)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {prep.housing && (
                    <div className={styles.prepSection}>
                      <div className={styles.prepSectionTitle}>주거</div>
                      <div className={styles.prepItem}>
                        <span className={styles.prepLabel}>거주 형태</span>
                        <span className={styles.prepValue}>{prep.housing.housingType}</span>
                      </div>
                      {prep.housing.currentValue && (
                        <div className={styles.prepItem}>
                          <span className={styles.prepLabel}>현재 시세</span>
                          <span className={styles.prepValue}>{formatMoney(prep.housing.currentValue)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {prep.debt && prep.debt.length > 0 && (
                    <div className={styles.prepSection}>
                      <div className={styles.prepSectionTitle}>부채</div>
                      {prep.debt.map((item, idx) => (
                        <div key={idx} className={styles.prepItem}>
                          <span className={styles.prepLabel}>{item.title || item.type}</span>
                          <span className={styles.prepValue}>{formatMoney(item.currentBalance ?? item.principal)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {prep.nationalPension && (prep.nationalPension.selfExpectedAmount > 0 || prep.nationalPension.spouseExpectedAmount > 0) && (
                    <div className={styles.prepSection}>
                      <div className={styles.prepSectionTitle}>국민연금</div>
                      {prep.nationalPension.selfExpectedAmount > 0 && (
                        <div className={styles.prepItem}>
                          <span className={styles.prepLabel}>본인</span>
                          <span className={styles.prepValue}>월 {formatMoney(prep.nationalPension.selfExpectedAmount)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 재무 입력 탭 */}
      {mainTab === "finance" && (
        <div className={styles.financeContent}>
          <FinanceManager
            userId={userId}
            birthYear={profile.birth_date ? new Date(profile.birth_date).getFullYear() : new Date().getFullYear() - 40}
            retirementAge={profile.target_retirement_age || 60}
          />
        </div>
      )}

      {/* 상담 노트 탭 */}
      {mainTab === "notes" && (
        <div className={styles.notesContent}>
          {expertId ? (
            <NotesSection profileId={userId} expertId={expertId} />
          ) : (
            <div className={styles.emptySection}>전문가 정보를 불러올 수 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}
