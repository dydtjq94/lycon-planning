"use client";

import { X, Check } from "lucide-react";
import styles from "./OnboardingSurveyModal.module.css";

// 설문 섹션 정의 (SimpleOnboarding에서 가져옴)
const SURVEY_SECTIONS = [
  {
    id: 1,
    title: "방문 목적",
    questions: [
      {
        id: "visit_purpose",
        question: "어떤 고민으로 찾아오셨나요?",
        type: "multiple",
        options: [
          { value: "retirement_worry", label: "은퇴 후 생활이 걱정돼요" },
          { value: "financial_checkup", label: "내 재정 상태를 점검받고 싶어요" },
          { value: "asset_management", label: "자산 관리 방법을 알고 싶어요" },
          { value: "strategy", label: "연금/투자 전략이 궁금해요" },
          { value: "expert_advice", label: "전문가 조언이 필요해요" },
          { value: "curious", label: "그냥 한번 써보려고요" },
        ],
      },
    ],
  },
  {
    id: 2,
    title: "돈에 대한 생각",
    questions: [
      {
        id: "money_feeling",
        question: "돈 생각하면 어떤 기분이 드세요?",
        type: "single",
        options: [
          { value: "confident", label: "든든하고 여유롭다" },
          { value: "varies", label: "그때그때 다르다" },
          { value: "anxious", label: "왠지 불안하다" },
          { value: "avoid", label: "생각하기 싫다" },
        ],
      },
      {
        id: "money_importance",
        question: "행복하려면 돈이 얼마나 중요할까요?",
        type: "single",
        options: [
          { value: "very", label: "아주 중요하다" },
          { value: "important", label: "중요한 편이다" },
          { value: "moderate", label: "보통이다" },
          { value: "not_much", label: "별로 안 중요하다" },
        ],
      },
      {
        id: "financial_goal",
        question: "지금 가장 중요한 목표는요?",
        type: "single",
        options: [
          { value: "retirement", label: "편안한 노후" },
          { value: "house", label: "내 집 마련" },
          { value: "children", label: "자녀 교육/결혼" },
          { value: "freedom", label: "경제적 자유" },
          { value: "debt", label: "빚 갚기" },
        ],
      },
      {
        id: "today_vs_tomorrow",
        question: "지금 쓰는 것 vs 미래를 위해 모으는 것, 어느 쪽이세요?",
        type: "single",
        options: [
          { value: "today", label: "오늘을 즐기는 편" },
          { value: "tomorrow", label: "미래를 위해 아끼는 편" },
          { value: "balance", label: "반반" },
        ],
      },
    ],
  },
  {
    id: 3,
    title: "현재 상황",
    questions: [
      {
        id: "marital_status",
        question: "결혼하셨나요?",
        type: "single",
        options: [
          { value: "single", label: "미혼" },
          { value: "married", label: "기혼" },
          { value: "divorced", label: "이혼/사별" },
        ],
      },
      {
        id: "children",
        question: "자녀가 있으신가요?",
        type: "single",
        options: [
          { value: "none", label: "없어요" },
          { value: "one", label: "1명" },
          { value: "two", label: "2명" },
          { value: "three_plus", label: "3명 이상" },
        ],
      },
      {
        id: "income_range",
        question: "연 소득이 어느 정도 되시나요?",
        type: "single",
        options: [
          { value: "under_1200", label: "1,200만원 이하" },
          { value: "1200_4600", label: "1,200~4,600만원" },
          { value: "4600_8800", label: "4,600~8,800만원" },
          { value: "8800_15000", label: "8,800만원~1.5억" },
          { value: "over_15000", label: "1.5억 초과" },
        ],
      },
      {
        id: "monthly_expense",
        question: "한 달 생활비는 보통 얼마나 쓰시나요?",
        type: "single",
        options: [
          { value: "under_200", label: "200만원 미만" },
          { value: "200_300", label: "200~300만원" },
          { value: "300_500", label: "300~500만원" },
          { value: "over_500", label: "500만원 이상" },
        ],
      },
      {
        id: "monthly_investment",
        question: "한 달에 저축이나 투자는 얼마나 하세요?",
        type: "single",
        options: [
          { value: "none", label: "거의 못 하고 있어요" },
          { value: "under_50", label: "50만원 미만" },
          { value: "50_100", label: "50~100만원" },
          { value: "100_300", label: "100~300만원" },
          { value: "over_300", label: "300만원 이상" },
        ],
      },
    ],
  },
  {
    id: 4,
    title: "재무 습관",
    questions: [
      {
        id: "saving_style",
        question: "저축이나 투자, 어떤 스타일이세요?",
        type: "single",
        options: [
          { value: "aggressive", label: "적극적으로 투자하는 편" },
          { value: "balanced", label: "저축과 투자 반반" },
          { value: "conservative", label: "안전하게 저축하는 편" },
          { value: "passive", label: "딱히 안 하는 편" },
        ],
      },
      {
        id: "budget_tracking",
        question: "가계부 쓰시나요?",
        type: "single",
        options: [
          { value: "always", label: "꾸준히 쓴다" },
          { value: "sometimes", label: "가끔 쓴다" },
          { value: "tried", label: "해봤는데 안 맞더라" },
          { value: "never", label: "안 쓴다" },
        ],
      },
      {
        id: "investment_exp",
        question: "지금 하고 계신 투자가 있나요?",
        type: "multiple",
        options: [
          { value: "stock_domestic", label: "국내 주식/ETF" },
          { value: "stock_foreign", label: "해외 주식/ETF" },
          { value: "fund", label: "펀드" },
          { value: "bond", label: "채권" },
          { value: "realestate", label: "부동산" },
          { value: "crypto", label: "가상자산" },
          { value: "gold", label: "금/원자재" },
          { value: "none", label: "없어요" },
        ],
      },
    ],
  },
  {
    id: 5,
    title: "은퇴 준비",
    questions: [
      {
        id: "retirement_worry",
        question: "은퇴 후 생활, 얼마나 걱정되세요?",
        type: "single",
        options: [
          { value: "none", label: "전혀 걱정되지 않는다" },
          { value: "little", label: "별로 걱정되지 않는다" },
          { value: "somewhat", label: "좀 걱정된다" },
          { value: "very", label: "많이 걱정된다" },
        ],
      },
      {
        id: "pension_awareness",
        question: "국민연금 예상 수령액을 알고 계세요?",
        type: "single",
        options: [
          { value: "exact", label: "정확히 알아요" },
          { value: "roughly", label: "대충은 알아요" },
          { value: "unknown", label: "잘 몰라요" },
        ],
      },
      {
        id: "retirement_concern",
        question: "은퇴 준비에서 가장 걱정되는 건요?",
        type: "single",
        options: [
          { value: "pension_shortage", label: "연금만으론 부족할 것 같다" },
          { value: "medical", label: "의료비/간병비가 걱정된다" },
          { value: "children_balance", label: "자녀 지원과 노후 준비 사이 균형" },
          { value: "dont_know", label: "뭐부터 해야 할지 모르겠다" },
          { value: "no_worry", label: "딱히 걱정 없다" },
        ],
      },
    ],
  },
];

interface SurveyResponsesData {
  onboarding?: {
    [questionId: string]: string | string[];
  };
  completed_at?: string;
  updated_at?: string;
}

interface OnboardingSurveyModalProps {
  surveyResponses: SurveyResponsesData | null;
  onClose: () => void;
}

export function OnboardingSurveyModal({ surveyResponses, onClose }: OnboardingSurveyModalProps) {
  const onboardingData = surveyResponses?.onboarding;

  const isSelected = (questionId: string, value: string) => {
    if (!onboardingData) return false;
    const response = onboardingData[questionId];
    if (Array.isArray(response)) {
      return response.includes(value);
    }
    return response === value;
  };

  const hasResponse = (questionId: string) => {
    if (!onboardingData) return false;
    const response = onboardingData[questionId];
    if (Array.isArray(response)) {
      return response.length > 0;
    }
    return !!response;
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>온보딩 설문 응답</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          {!onboardingData || Object.keys(onboardingData).length === 0 ? (
            <div className={styles.empty}>온보딩 설문 응답이 없습니다.</div>
          ) : (
            SURVEY_SECTIONS.map((section) => (
              <div key={section.id} className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionNumber}>{section.id}</span>
                  <span className={styles.sectionTitle}>{section.title}</span>
                </div>

                <div className={styles.questions}>
                  {section.questions.map((question) => (
                    <div key={question.id} className={styles.question}>
                      <div className={styles.questionHeader}>
                        <span className={styles.questionText}>{question.question}</span>
                        {question.type === "multiple" && (
                          <span className={styles.multipleTag}>복수</span>
                        )}
                        {!hasResponse(question.id) && (
                          <span className={styles.noResponseTag}>미응답</span>
                        )}
                      </div>
                      <div className={styles.options}>
                        {question.options.map((option) => {
                          const selected = isSelected(question.id, option.value);
                          return (
                            <div
                              key={option.value}
                              className={`${styles.option} ${selected ? styles.selected : ""}`}
                            >
                              {selected && (
                                <span className={styles.checkIcon}>
                                  <Check size={12} />
                                </span>
                              )}
                              <span className={styles.optionLabel}>{option.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
