"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft } from "lucide-react";
import { formatMoney } from "@/lib/utils";
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

// 온보딩 설문 응답 타입
interface SurveyResponsesData {
  onboarding?: Record<string, string | string[]>;
  updated_at?: string;
  completed_at?: string;
}

// --- prep_data 실제 타입 ---
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
  fixedExpenses: Array<{ type: string; title: string; amount: number; frequency: "monthly" | "yearly" }>;
  variableExpenses: Array<{ type: string; title: string; amount: number; frequency: "monthly" | "yearly" }>;
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
  securities?: {
    balance: number;
    investmentTypes: string[];
  };
  crypto?: {
    balance: number;
  };
  gold?: {
    balance: number;
  };
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
  loanRepaymentType?: string;
}

interface PrepDebtItem {
  type: string;
  title: string;
  principal: number;
  currentBalance?: number;
  interestRate: number;
  monthlyPayment?: number;
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

// 온보딩 설문 라벨 매핑
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
  money_importance: {
    very: "아주 중요하다",
    important: "중요한 편이다",
    moderate: "보통이다",
    not_much: "별로 안 중요하다",
  },
  financial_goal: {
    retirement: "편안한 노후",
    house: "내 집 마련",
    children: "자녀 교육/결혼",
    freedom: "경제적 자유",
    debt: "빚 갚기",
  },
  today_vs_tomorrow: {
    today: "오늘을 즐기는 편",
    tomorrow: "미래를 위해 아끼는 편",
    balance: "반반",
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
  income_range: {
    under_3000: "3,000만원 이하",
    "3000_5000": "3,000~5,000만원",
    "5000_8000": "5,000~8,000만원",
    "8000_12000": "8,000만원~1.2억",
    over_12000: "1.2억 초과",
  },
  monthly_expense: {
    under_200: "200만원 미만",
    "200_300": "200~300만원",
    "300_500": "300~500만원",
    over_500: "500만원 이상",
  },
  monthly_investment: {
    none: "거의 못 하고 있어요",
    under_50: "50만원 미만",
    "50_100": "50~100만원",
    "100_300": "100~300만원",
    over_300: "300만원 이상",
  },
  saving_style: {
    aggressive: "적극적으로 투자하는 편",
    balanced: "저축과 투자 반반",
    conservative: "안전하게 저축하는 편",
    passive: "딱히 안 하는 편",
  },
  budget_tracking: {
    always: "꾸준히 쓴다",
    sometimes: "가끔 쓴다",
    tried: "해봤는데 안 맞더라",
    never: "안 쓴다",
  },
  investment_exp: {
    stock_domestic: "국내 주식/ETF",
    stock_foreign: "해외 주식/ETF",
    fund: "펀드",
    bond: "채권",
    realestate: "부동산",
    crypto: "가상자산",
    gold: "금/원자재",
    none: "없어요",
  },
  retirement_worry: {
    none: "전혀 걱정되지 않는다",
    little: "별로 걱정되지 않는다",
    somewhat: "좀 걱정된다",
    very: "많이 걱정된다",
  },
  pension_awareness: {
    exact: "정확히 알아요",
    roughly: "대충은 알아요",
    unknown: "잘 몰라요",
  },
  retirement_concern: {
    pension_shortage: "연금만으론 부족할 것 같다",
    medical: "의료비/간병비가 걱정된다",
    children_balance: "자녀 지원과 노후 준비 사이 균형",
    dont_know: "뭐부터 해야 할지 모르겠다",
    no_worry: "딱히 걱정 없다",
  },
};

// 질문 라벨
const QUESTION_LABELS: Record<string, string> = {
  visit_purpose: "방문 목적",
  money_feeling: "돈 생각하면?",
  money_importance: "돈의 중요성",
  financial_goal: "재무 목표",
  today_vs_tomorrow: "오늘 vs 미래",
  marital_status: "결혼 여부",
  children: "자녀",
  income_range: "연 소득",
  monthly_expense: "월 생활비",
  monthly_investment: "월 저축/투자",
  saving_style: "투자 스타일",
  budget_tracking: "가계부",
  investment_exp: "현재 투자",
  retirement_worry: "은퇴 걱정",
  pension_awareness: "연금 인지",
  retirement_concern: "가장 걱정",
};

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      const supabase = createClient();
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
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getSurveyLabel = (questionId: string, value: string | string[]) => {
    const labels = SURVEY_LABELS[questionId];
    if (!labels) return Array.isArray(value) ? value.join(", ") : value;

    if (Array.isArray(value)) {
      return value.map(v => labels[v] || v).join(", ");
    }
    return labels[value] || value;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>로딩 중...</div>
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
        <button className={styles.backButton} onClick={() => router.back()}>
          <ChevronLeft size={18} />
          뒤로
        </button>
        <div className={styles.headerInfo}>
          <h1 className={styles.userName}>
            {profile.name}
            <span className={styles.userMeta}>
              {getAge(profile.birth_date) && `${getAge(profile.birth_date)}세`}
              {profile.gender && ` / ${profile.gender === "male" ? "남" : "여"}`}
            </span>
          </h1>
          <div className={styles.userSubInfo}>
            {profile.phone_number && <span>{profile.phone_number}</span>}
            {profile.booking_info && (
              <span className={styles.bookingBadge}>
                예약: {new Date(profile.booking_info.date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} {profile.booking_info.time}
              </span>
            )}
          </div>
        </div>
        <button
          className={styles.chatButton}
          onClick={() => router.push(`/admin/chat/${userId}`)}
        >
          채팅하기
        </button>
      </div>

      {/* 메인 컨텐츠 - 2단 레이아웃 */}
      <div className={styles.mainContent}>
        {/* 왼쪽: 온보딩 설문 */}
        <div className={styles.column}>
          <h2 className={styles.columnTitle}>온보딩 설문</h2>

          {Object.keys(survey).length === 0 ? (
            <div className={styles.emptySection}>설문 응답이 없습니다.</div>
          ) : (
            <div className={styles.surveyList}>
              {Object.entries(survey).map(([key, value]) => {
                if (!QUESTION_LABELS[key]) return null;
                return (
                  <div key={key} className={styles.surveyItem}>
                    <div className={styles.surveyQuestion}>{QUESTION_LABELS[key]}</div>
                    <div className={styles.surveyAnswer}>{getSurveyLabel(key, value)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 오른쪽: 입력해두기 */}
        <div className={styles.column}>
          <h2 className={styles.columnTitle}>입력해두기</h2>

          {Object.keys(prep).length === 0 ? (
            <div className={styles.emptySection}>입력된 정보가 없습니다.</div>
          ) : (
            <div className={styles.prepList}>
              {/* 가족 */}
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

              {/* 소득 */}
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
                  {prep.income.additionalIncomes?.map((item, idx) => (
                    <div key={idx} className={styles.prepItem}>
                      <span className={styles.prepLabel}>
                        {item.owner === "self" ? "본인" : "배우자"} {item.type === "business" ? "사업소득" : "기타소득"}
                      </span>
                      <span className={styles.prepValue}>
                        {formatMoney(item.amount)} / {item.frequency === "monthly" ? "월" : "년"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 지출 */}
              {prep.expense && prep.expense.livingExpense > 0 && (
                <div className={styles.prepSection}>
                  <div className={styles.prepSectionTitle}>지출</div>
                  <div className={styles.prepItem}>
                    <span className={styles.prepLabel}>월 변동 생활비</span>
                    <span className={styles.prepValue}>{formatMoney(prep.expense.livingExpense)} / 월</span>
                  </div>
                </div>
              )}

              {/* 저축 */}
              {prep.savings && prep.savings.length > 0 && (
                <div className={styles.prepSection}>
                  <div className={styles.prepSectionTitle}>저축 계좌</div>
                  {prep.savings.map((item, idx) => (
                    <div key={idx} className={styles.prepItem}>
                      <span className={styles.prepLabel}>
                        {item.title || `${item.owner === "self" ? "본인" : "배우자"} ${item.type}`}
                      </span>
                      <span className={styles.prepValue}>{formatMoney(item.currentBalance)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 투자 */}
              {prep.investment && (prep.investment.securities || prep.investment.crypto || prep.investment.gold) && (
                <div className={styles.prepSection}>
                  <div className={styles.prepSectionTitle}>투자</div>
                  {prep.investment.securities && (
                    <div className={styles.prepItem}>
                      <span className={styles.prepLabel}>증권 계좌</span>
                      <span className={styles.prepValue}>{formatMoney(prep.investment.securities.balance)}</span>
                    </div>
                  )}
                  {prep.investment.crypto && (
                    <div className={styles.prepItem}>
                      <span className={styles.prepLabel}>코인</span>
                      <span className={styles.prepValue}>{formatMoney(prep.investment.crypto.balance)}</span>
                    </div>
                  )}
                  {prep.investment.gold && (
                    <div className={styles.prepItem}>
                      <span className={styles.prepLabel}>금</span>
                      <span className={styles.prepValue}>{formatMoney(prep.investment.gold.balance)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 주거 */}
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
                  {prep.housing.deposit && (
                    <div className={styles.prepItem}>
                      <span className={styles.prepLabel}>보증금</span>
                      <span className={styles.prepValue}>{formatMoney(prep.housing.deposit)}</span>
                    </div>
                  )}
                  {prep.housing.hasLoan && prep.housing.loanAmount && (
                    <div className={styles.prepItem}>
                      <span className={styles.prepLabel}>대출 잔액</span>
                      <span className={styles.prepValue}>
                        {formatMoney(prep.housing.loanAmount)}
                        {prep.housing.loanRate && ` (${prep.housing.loanRate}%)`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 부채 */}
              {prep.debt && prep.debt.length > 0 && (
                <div className={styles.prepSection}>
                  <div className={styles.prepSectionTitle}>부채</div>
                  {prep.debt.map((item, idx) => (
                    <div key={idx} className={styles.prepItem}>
                      <span className={styles.prepLabel}>{item.title || item.type}</span>
                      <span className={styles.prepValue}>
                        {formatMoney(item.currentBalance ?? item.principal)}
                        {item.interestRate > 0 && ` (${item.interestRate}%)`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 국민연금 */}
              {prep.nationalPension && (prep.nationalPension.selfExpectedAmount > 0 || prep.nationalPension.spouseExpectedAmount > 0) && (
                <div className={styles.prepSection}>
                  <div className={styles.prepSectionTitle}>국민(공적)연금</div>
                  {prep.nationalPension.selfExpectedAmount > 0 && (
                    <div className={styles.prepItem}>
                      <span className={styles.prepLabel}>본인</span>
                      <span className={styles.prepValue}>월 {formatMoney(prep.nationalPension.selfExpectedAmount)}</span>
                    </div>
                  )}
                  {prep.nationalPension.spouseExpectedAmount > 0 && (
                    <div className={styles.prepItem}>
                      <span className={styles.prepLabel}>배우자</span>
                      <span className={styles.prepValue}>월 {formatMoney(prep.nationalPension.spouseExpectedAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 퇴직연금 */}
              {prep.retirementPension && (prep.retirementPension.selfType !== "none" || prep.retirementPension.spouseType !== "none") && (
                <div className={styles.prepSection}>
                  <div className={styles.prepSectionTitle}>퇴직연금</div>
                  {prep.retirementPension.selfType !== "none" && (
                    <div className={styles.prepItem}>
                      <span className={styles.prepLabel}>
                        본인 ({prep.retirementPension.selfType === "db" ? "DB형" : "DC형"})
                      </span>
                      <span className={styles.prepValue}>
                        {prep.retirementPension.selfType === "db" && prep.retirementPension.selfYearsWorked
                          ? `근속 ${prep.retirementPension.selfYearsWorked}년`
                          : prep.retirementPension.selfBalance
                            ? formatMoney(prep.retirementPension.selfBalance)
                            : "-"}
                      </span>
                    </div>
                  )}
                  {prep.retirementPension.spouseType !== "none" && (
                    <div className={styles.prepItem}>
                      <span className={styles.prepLabel}>
                        배우자 ({prep.retirementPension.spouseType === "db" ? "DB형" : "DC형"})
                      </span>
                      <span className={styles.prepValue}>
                        {prep.retirementPension.spouseType === "db" && prep.retirementPension.spouseYearsWorked
                          ? `근속 ${prep.retirementPension.spouseYearsWorked}년`
                          : prep.retirementPension.spouseBalance
                            ? formatMoney(prep.retirementPension.spouseBalance)
                            : "-"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 개인연금 */}
              {prep.personalPension && prep.personalPension.length > 0 && (
                <div className={styles.prepSection}>
                  <div className={styles.prepSectionTitle}>개인연금</div>
                  {prep.personalPension.map((item, idx) => (
                    <div key={idx} className={styles.prepItem}>
                      <span className={styles.prepLabel}>
                        {item.owner === "self" ? "본인" : "배우자"} {item.type === "pension_savings" ? "연금저축" : "IRP"}
                      </span>
                      <span className={styles.prepValue}>
                        {formatMoney(item.balance)}
                        {item.monthlyDeposit > 0 && ` (월 ${formatMoney(item.monthlyDeposit)})`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
