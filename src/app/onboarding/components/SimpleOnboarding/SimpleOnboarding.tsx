"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Square, CheckSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getAvailableTimesForDates,
  getDefaultExpertId,
} from "@/lib/services/bookingService";
import { OnboardingEvents } from "@/lib/analytics/mixpanel";
import styles from "./SimpleOnboarding.module.css";

// localStorage 키
const SURVEY_STORAGE_KEY = "lycon_onboarding_survey";
const BASIC_INFO_STORAGE_KEY = "lycon_onboarding_basic";

type Step =
  | "welcome"
  | "mission"
  | "problem"
  | "ready"
  | "basicInfo"
  // Part 1: 방문 목적
  | "part1_q1"
  | "transition1"
  // Part 2: 돈에 대한 생각
  | "part2_q1"
  | "part2_q2"
  | "part2_q3"
  | "part2_q4"
  | "transition2"
  // Part 3: 현재 상황
  | "part3_q1"
  | "part3_q2"
  | "part3_q3"
  | "part3_q4"
  | "part3_q5"
  | "transition3"
  // Part 4: 재무 습관
  | "part4_q1"
  | "part4_q2"
  | "part4_q3"
  | "transition4"
  // Part 5: 은퇴 준비
  | "part5_q1"
  | "part5_q2"
  | "part5_q3"
  | "surveyComplete"
  | "matching"
  | "program"
  | "booking";

// 설문 섹션 정의
interface SurveySection {
  id: number;
  title: string;
  description: string;
  questions: SurveyQuestion[];
}

interface SurveyQuestion {
  id: string;
  question: string;
  type: "single" | "multiple";
  options: { value: string; label: string }[];
}

const SURVEY_SECTIONS: SurveySection[] = [
  // Part 1: 방문 목적 (1문항)
  {
    id: 1,
    title: "방문 목적",
    description: "",
    questions: [
      {
        id: "visit_purpose",
        question: "어떤 고민으로\n찾아오셨나요?",
        type: "multiple",
        options: [
          { value: "retirement_worry", label: "은퇴 후 생활이 걱정돼요" },
          {
            value: "financial_checkup",
            label: "내 재정 상태를 점검받고 싶어요",
          },
          { value: "asset_management", label: "자산 관리 방법을 알고 싶어요" },
          { value: "strategy", label: "연금/투자 전략이 궁금해요" },
          { value: "expert_advice", label: "전문가 조언이 필요해요" },
          { value: "curious", label: "그냥 한번 써보려고요" },
        ],
      },
    ],
  },
  // Part 2: 돈에 대한 생각 (4문항)
  {
    id: 2,
    title: "돈에 대한 생각",
    description: "",
    questions: [
      {
        id: "money_feeling",
        question: "돈 생각하면\n어떤 기분이 드세요?",
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
        question: "행복하려면 돈이\n얼마나 중요할까요?",
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
        question: "지금 가장 중요한\n목표는요?",
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
        question: "지금 쓰는 것 vs\n미래를 위해 모으는 것,\n어느 쪽이세요?",
        type: "single",
        options: [
          { value: "today", label: "오늘을 즐기는 편" },
          { value: "tomorrow", label: "미래를 위해 아끼는 편" },
          { value: "balance", label: "반반" },
        ],
      },
    ],
  },
  // Part 3: 현재 상황 (5문항)
  {
    id: 3,
    title: "현재 상황",
    description: "",
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
        question: "연 소득이\n어느 정도 되시나요?",
        type: "single",
        options: [
          { value: "under_3000", label: "3,000만원 이하" },
          { value: "3000_5000", label: "3,000~5,000만원" },
          { value: "5000_8000", label: "5,000~8,000만원" },
          { value: "8000_12000", label: "8,000만원~1.2억" },
          { value: "over_12000", label: "1.2억 초과" },
        ],
      },
      {
        id: "monthly_expense",
        question: "한 달 생활비는\n보통 얼마나 쓰시나요?",
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
        question: "한 달에 저축이나 투자는\n얼마나 하세요?",
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
  // Part 4: 재무 습관 (3문항)
  {
    id: 4,
    title: "재무 습관",
    description: "",
    questions: [
      {
        id: "saving_style",
        question: "저축이나 투자,\n어떤 스타일이세요?",
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
        question: "지금 하고 계신\n투자가 있나요?",
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
  // Part 5: 은퇴 준비 (3문항)
  {
    id: 5,
    title: "은퇴 준비",
    description: "",
    questions: [
      {
        id: "retirement_worry",
        question: "은퇴 후 생활,\n얼마나 걱정되세요?",
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
        question: "국민연금 예상 수령액을\n알고 계세요?",
        type: "single",
        options: [
          { value: "exact", label: "정확히 알아요" },
          { value: "roughly", label: "대충은 알아요" },
          { value: "unknown", label: "잘 몰라요" },
        ],
      },
      {
        id: "retirement_concern",
        question: "은퇴 준비에서\n가장 걱정되는 건요?",
        type: "single",
        options: [
          { value: "pension_shortage", label: "연금만으론 부족할 것 같다" },
          { value: "medical", label: "의료비/간병비가 걱정된다" },
          {
            value: "children_balance",
            label: "자녀 지원과 노후 준비 사이 균형",
          },
          { value: "dont_know", label: "뭐부터 해야 할지 모르겠다" },
          { value: "no_worry", label: "딱히 걱정 없다" },
        ],
      },
    ],
  },
];

// 설문 응답 타입
interface SurveyResponses {
  [questionId: string]: string | string[];
}

interface InitialData {
  name: string;
  rrnFront: string;
  rrnBack: string;
  savedStep?: string;
}

interface SimpleOnboardingProps {
  onComplete: (data: {
    name: string;
    gender: string;
    birthYear: number;
    birthMonth: number;
    surveyResponses: SurveyResponses;
    bookingDate: string | null;
    bookingTime: string | null;
    expertId: string | null;
  }) => void;
  initialData?: InitialData | null;
}

// 로컬 날짜를 YYYY-MM-DD 형식으로 변환 (타임존 문제 방지)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 나이대별 프로그램 설명
const PROGRAM_CONTENT: Record<string, { desc: string; checkpoints: string[] }> =
  {
    "20대": {
      desc: "사회초년생에게 가장 취약한 재무 습관 부재, 저축 계획 미흡, 연금 가입 누락 등의 조기 진단과 건강한 재무 기초를 다지기 위한 기본형 종합 재무검진 프로그램입니다.",
      checkpoints: [
        "사회초년생으로 재무 관리를 어떻게 시작해야 할지 모르겠다.",
        "월급 관리와 저축 습관을 체계적으로 만들고 싶다.",
        "국민연금, 퇴직연금 등 연금 제도를 이해하고 싶다.",
        "내 집 마련, 결혼 자금 등 목표 자금을 계획하고 싶다.",
        "20대에 알아야 할 재무 지식을 전문가에게 배우고 싶다.",
      ],
    },
    "30대": {
      desc: "30대 직장인에게 가장 취약한 주택자금 부담, 자녀 교육비 준비 미흡, 연금 설계 부족 등의 조기 진단과 자산 형성기에 맞는 재무 전략 수립을 위한 기본형 종합 재무검진 프로그램입니다.",
      checkpoints: [
        "결혼, 출산, 주택 구입 등 큰 지출이 예정되어 있다.",
        "맞벌이/외벌이 상황에 맞는 재무 전략이 필요하다.",
        "자녀 교육비와 노후 준비를 동시에 계획하고 싶다.",
        "대출 상환과 자산 증식의 균형을 맞추고 싶다.",
        "30대에 꼭 해야 할 재무 결정에 대해 조언받고 싶다.",
      ],
    },
    "40대": {
      desc: "40대 가장에게 가장 취약한 자녀 교육비 집중, 은퇴 준비 후순위화, 건강/보험 리스크 등의 조기 진단과 은퇴 준비 본격화를 위한 기본형 종합 재무검진 프로그램입니다.",
      checkpoints: [
        "자녀 교육비 부담이 크고 은퇴 준비가 걱정된다.",
        "남은 직장 생활 동안 얼마나 모아야 하는지 알고 싶다.",
        "연금 수령 전략과 최적의 은퇴 시점을 계획하고 싶다.",
        "부동산, 금융자산의 최적 배분 비율을 점검하고 싶다.",
        "40대에 반드시 점검해야 할 재무 항목을 확인하고 싶다.",
      ],
    },
    "50+": {
      desc: "은퇴를 앞둔 50대 이상에게 가장 취약한 은퇴 후 소득 공백, 의료비 리스크, 자산 인출 전략 부재 등의 조기 진단과 안정적인 노후 생활을 위한 기본형 종합 재무검진 프로그램입니다.",
      checkpoints: [
        "은퇴 후 월 생활비가 얼마나 필요한지 정확히 알고 싶다.",
        "국민연금, 퇴직연금, 개인연금 수령 전략을 최적화하고 싶다.",
        "은퇴 후 자산을 어떤 순서로 인출해야 하는지 알고 싶다.",
        "의료비, 간병비 등 노후 리스크에 대비하고 싶다.",
        "자녀에게 물려줄 자산과 내가 쓸 자산을 구분하고 싶다.",
      ],
    },
  };

// 검진 항목 정의 (의료재단 스타일)
const CHECKUP_ITEMS = [
  {
    category: "소득",
    items: "소득 분석",
    diagnosis: "소득 안정성, 성장 추세, 은퇴 후 소득 공백",
  },
  {
    category: "지출",
    items: "지출내역 분석",
    diagnosis: "지출 적정성, 저축 여력, 은퇴 후 생활비",
  },
  {
    category: "현금자산",
    items: "예적금 현황 분석",
    diagnosis: "유동성, 안전자산 비중, 비상자금 적정성",
  },
  {
    category: "투자자산",
    items: "투자 포트폴리오 분석",
    diagnosis: "자산배분, 수익률, 리스크 수준",
  },
  {
    category: "실물자산",
    items: "부동산/실물 현황 분석",
    diagnosis: "자산 편중도, 현금화 가능성",
  },
  {
    category: "부채",
    items: "대출 현황 분석",
    diagnosis: "부채비율, 이자부담률, 상환 능력",
  },
  {
    category: "미래 이벤트",
    items: "생애주기 이벤트 설계",
    diagnosis: "결혼/출산/교육/의료 필요자금, 현금흐름 영향",
  },
  {
    category: "국민연금",
    items: "가입이력 조회 및 시뮬레이션",
    diagnosis: "예상 수령액, 조기/연기수령 비교",
  },
  {
    category: "퇴직연금",
    items: "퇴직연금 현황 분석",
    diagnosis: "DB/DC/IRP 예상액, 수령 전략",
  },
  {
    category: "개인연금",
    items: "개인연금 현황 분석",
    diagnosis: "세제혜택 활용도, 노후소득 보완 수준",
  },
  {
    category: "은퇴 시뮬레이션",
    items: "100세 현금흐름 시뮬레이션",
    diagnosis: "은퇴 적정 시기, 자산수명, 고갈 시점",
  },
  {
    category: "종합 소견",
    items: "재무 건전성 평가",
    diagnosis: "종합 점수, 맞춤 개선 방안, 실행 전략",
  },
];

export function SimpleOnboarding({
  onComplete,
  initialData,
}: SimpleOnboardingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // step 디코딩 함수 (URL의 인코딩된 step을 디코드)
  const decodeStepFromUrl = (encoded: string): Step | null => {
    try {
      // base64 패딩 복구
      const padded = encoded + "==".slice(0, (4 - (encoded.length % 4)) % 4);
      const decoded = atob(padded);
      const validStepsForDecode: Step[] = [
        "welcome",
        "mission",
        "problem",
        "ready",
        "basicInfo",
        // Part 1
        "part1_q1",
        "transition1",
        // Part 2
        "part2_q1",
        "part2_q2",
        "part2_q3",
        "part2_q4",
        "transition2",
        // Part 3
        "part3_q1",
        "part3_q2",
        "part3_q3",
        "part3_q4",
        "part3_q5",
        "transition3",
        // Part 4
        "part4_q1",
        "part4_q2",
        "part4_q3",
        "transition4",
        // Part 5
        "part5_q1",
        "part5_q2",
        "part5_q3",
        "surveyComplete",
        "matching",
        "program",
        "booking",
      ];
      if (validStepsForDecode.includes(decoded as Step)) {
        return decoded as Step;
      }
    } catch {
      return null;
    }
    return null;
  };

  // 스텝 이름 매핑 (트래킹용) - 컴포넌트 밖에 정의
  const getStepInfo = (s: Step): { step: number; name: string } => {
    const stepMap: Record<Step, { step: number; name: string }> = {
      welcome: { step: 1, name: "welcome" },
      mission: { step: 2, name: "mission" },
      problem: { step: 3, name: "problem" },
      ready: { step: 4, name: "ready" },
      basicInfo: { step: 5, name: "basic_info" },
      part1_q1: { step: 6, name: "survey_part1" },
      transition1: { step: 7, name: "transition1" },
      part2_q1: { step: 8, name: "survey_part2_q1" },
      part2_q2: { step: 9, name: "survey_part2_q2" },
      part2_q3: { step: 10, name: "survey_part2_q3" },
      part2_q4: { step: 11, name: "survey_part2_q4" },
      transition2: { step: 12, name: "transition2" },
      part3_q1: { step: 13, name: "survey_part3_q1" },
      part3_q2: { step: 14, name: "survey_part3_q2" },
      part3_q3: { step: 15, name: "survey_part3_q3" },
      part3_q4: { step: 16, name: "survey_part3_q4" },
      part3_q5: { step: 17, name: "survey_part3_q5" },
      transition3: { step: 18, name: "transition3" },
      part4_q1: { step: 19, name: "survey_part4_q1" },
      part4_q2: { step: 20, name: "survey_part4_q2" },
      part4_q3: { step: 21, name: "survey_part4_q3" },
      transition4: { step: 22, name: "transition4" },
      part5_q1: { step: 23, name: "survey_part5_q1" },
      part5_q2: { step: 24, name: "survey_part5_q2" },
      part5_q3: { step: 25, name: "survey_part5_q3" },
      surveyComplete: { step: 26, name: "survey_complete" },
      matching: { step: 27, name: "matching" },
      program: { step: 28, name: "program" },
      booking: { step: 29, name: "booking" },
    };
    return stepMap[s];
  };

  const validSteps: Step[] = [
    "welcome",
    "mission",
    "problem",
    "ready",
    "basicInfo",
    // Part 1
    "part1_q1",
    "transition1",
    // Part 2
    "part2_q1",
    "part2_q2",
    "part2_q3",
    "part2_q4",
    "transition2",
    // Part 3
    "part3_q1",
    "part3_q2",
    "part3_q3",
    "part3_q4",
    "part3_q5",
    "transition3",
    // Part 4
    "part4_q1",
    "part4_q2",
    "part4_q3",
    "transition4",
    // Part 5
    "part5_q1",
    "part5_q2",
    "part5_q3",
    "surveyComplete",
    "matching",
    "program",
    "booking",
  ];

  // URL에서 초기 step 읽기
  const getInitialStep = (): Step => {
    // 새 형식: ?s=encoded
    const encodedStep = searchParams.get("s");
    if (encodedStep) {
      const decoded = decodeStepFromUrl(encodedStep);
      if (decoded) return decoded;
    }
    // 이전 형식 호환: ?step=stepName
    const oldStep = searchParams.get("step");
    if (oldStep && validSteps.includes(oldStep as Step)) {
      return oldStep as Step;
    }
    // 저장된 단계가 있으면 사용
    if (
      initialData?.savedStep &&
      validSteps.includes(initialData.savedStep as Step)
    ) {
      return initialData.savedStep as Step;
    }
    return "welcome";
  };

  const [step, setStep] = useState<Step>(getInitialStep);
  const [name, setName] = useState(initialData?.name || "");
  const [rrnFront, setRrnFront] = useState(initialData?.rrnFront || "");
  const [rrnBack, setRrnBack] = useState(initialData?.rrnBack || "");
  const [isAnimating, setIsAnimating] = useState(false);
  const [matchingProgress, setMatchingProgress] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [expertId, setExpertId] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<
    Record<string, string[]>
  >({});
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponses>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const trackingInitRef = useRef(false);

  // 온보딩 시작 트래킹 (최초 1회)
  useEffect(() => {
    if (!trackingInitRef.current) {
      trackingInitRef.current = true;
      OnboardingEvents.onboardingStarted();
      // 현재 스텝 view 트래킹
      const info = getStepInfo(step);
      OnboardingEvents.onboardingStepViewed(info.step, info.name);
    }
  }, []);

  // localStorage에서 저장된 데이터 불러오기
  useEffect(() => {
    const loadSavedData = async () => {
      // 1. localStorage에서 먼저 확인
      const savedSurvey = localStorage.getItem(SURVEY_STORAGE_KEY);
      const savedBasicInfo = localStorage.getItem(BASIC_INFO_STORAGE_KEY);

      if (savedSurvey) {
        try {
          setSurveyResponses(JSON.parse(savedSurvey));
        } catch (e) {
          console.error("설문 응답 파싱 오류:", e);
        }
      }

      if (savedBasicInfo) {
        try {
          const basicInfo = JSON.parse(savedBasicInfo);
          if (basicInfo.name && !name) setName(basicInfo.name);
          if (basicInfo.rrnFront && !rrnFront) setRrnFront(basicInfo.rrnFront);
          if (basicInfo.rrnBack && !rrnBack) setRrnBack(basicInfo.rrnBack);
        } catch (e) {
          console.error("기본 정보 파싱 오류:", e);
        }
      }

      // 2. Supabase에서도 확인 (localStorage에 없을 경우 대비)
      if (!savedSurvey) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("survey_responses")
            .eq("id", user.id)
            .single();

          if (profile?.survey_responses?.onboarding) {
            setSurveyResponses(profile.survey_responses.onboarding);
            // localStorage에도 저장
            localStorage.setItem(
              SURVEY_STORAGE_KEY,
              JSON.stringify(profile.survey_responses.onboarding),
            );
          }
        }
      }

      setIsDataLoaded(true);
    };

    loadSavedData();
  }, []);

  // surveyResponses 변경 시 localStorage 즉시 저장 + Supabase 디바운스 저장
  useEffect(() => {
    if (!isDataLoaded) return;
    if (Object.keys(surveyResponses).length === 0) return;

    // 1. localStorage 즉시 저장
    localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(surveyResponses));

    // 2. Supabase 디바운스 저장 (3초)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            survey_responses: {
              onboarding: surveyResponses,
              updated_at: new Date().toISOString(),
            },
          })
          .eq("id", user.id);
      }
    }, 3000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [surveyResponses, isDataLoaded]);

  // 기본 정보 변경 시 localStorage 저장
  useEffect(() => {
    if (!isDataLoaded) return;
    if (!name && !rrnFront && !rrnBack) return;

    localStorage.setItem(
      BASIC_INFO_STORAGE_KEY,
      JSON.stringify({ name, rrnFront, rrnBack }),
    );
  }, [name, rrnFront, rrnBack, isDataLoaded]);

  const closePrivacyModal = () => {
    setIsModalClosing(true);
    setTimeout(() => {
      setShowPrivacyModal(false);
      setIsModalClosing(false);
    }, 300);
  };
  const rrnBackRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // 초기 로드 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 매칭 애니메이션 (빠르게 약 4초)
  useEffect(() => {
    if (step === "matching") {
      let currentProgress = 0;
      let animationId: NodeJS.Timeout;

      const updateProgress = () => {
        if (currentProgress >= 100) {
          return;
        }

        // 빠른 증가 (6~12씩 증가)
        const increment = Math.random() * 6 + 6;
        // 짧은 딜레이 (250~400ms)
        let delay = Math.random() * 150 + 250;

        // 마지막에 살짝 느리게
        if (currentProgress > 85) {
          delay = Math.random() * 150 + 300;
        }

        currentProgress = Math.min(currentProgress + increment, 100);
        setMatchingProgress(currentProgress);

        animationId = setTimeout(updateProgress, delay);
      };

      updateProgress();

      return () => {
        if (animationId) clearTimeout(animationId);
      };
    }
  }, [step]);

  // 예약 단계 진입 시 가용 시간 로드
  useEffect(() => {
    if (step !== "booking") return;

    const loadAvailability = async () => {
      setLoadingTimes(true);

      // 전문가 ID 가져오기
      let expId = expertId;
      if (!expId) {
        expId = await getDefaultExpertId();
        if (expId) setExpertId(expId);
      }

      if (!expId) {
        setLoadingTimes(false);
        return;
      }

      // 5일 후부터 14일간 날짜 생성
      const dates: Date[] = [];
      const today = new Date();
      for (let i = 5; i <= 11; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date);
      }

      // 가용 시간 로드
      const times = await getAvailableTimesForDates(expId, dates);
      setAvailableTimes(times);

      // 기본 날짜 설정 (가용 시간이 있는 첫 번째 날)
      if (!selectedDate) {
        for (const date of dates) {
          const dateStr = formatLocalDate(date);
          if (times[dateStr] && times[dateStr].length > 0) {
            setSelectedDate(date);
            break;
          }
        }
      }

      setLoadingTimes(false);
    };

    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, expertId]);

  // step을 인코딩해서 URL에 저장 (내부 추적용)
  const encodeStep = (s: Step): string => {
    return btoa(s).replace(/=/g, "");
  };

  // Supabase에 현재 단계 저장
  const saveStepToDb = async (stepToSave: Step) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ onboarding_step: stepToSave })
          .eq("id", user.id);
      }
    } catch (err) {
      console.error("온보딩 단계 저장 실패:", err);
    }
  };


  const goToStep = (nextStep: Step) => {
    // 현재 스텝 완료 트래킹
    const currentInfo = getStepInfo(step);
    OnboardingEvents.onboardingStepCompleted(currentInfo.step, currentInfo.name);

    setIsAnimating(true);
    setTimeout(() => {
      setStep(nextStep);
      setIsAnimating(false);

      // 다음 스텝 시작 트래킹
      const nextInfo = getStepInfo(nextStep);
      OnboardingEvents.onboardingStepViewed(nextInfo.step, nextInfo.name);

      // URL 쿼리 파라미터 업데이트 (복잡한 형태로)
      const ts = Date.now();
      const encoded = encodeStep(nextStep);
      const seq = Math.floor(Math.random() * 9000) + 1000;
      router.replace(
        `/onboarding?s=${encoded}&t=${ts}&v=2&ref=ob_flow&seq=${seq}&src=internal`,
        { scroll: false },
      );
      // 스크롤 맨 위로
      mainRef.current?.scrollTo(0, 0);
      // Supabase에 단계 저장 (백그라운드)
      saveStepToDb(nextStep);
    }, 200);
  };

  // 주민번호에서 생년월일, 성별 파싱
  const parseRrn = () => {
    if (rrnFront.length !== 6 || !rrnBack) return null;

    const yy = parseInt(rrnFront.slice(0, 2));
    const mm = parseInt(rrnFront.slice(2, 4));
    const dd = parseInt(rrnFront.slice(4, 6));
    const genderCode = parseInt(rrnBack);

    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    if (![1, 2, 3, 4].includes(genderCode)) return null;

    const gender = [1, 3].includes(genderCode) ? "male" : "female";
    const century = [1, 2].includes(genderCode) ? 1900 : 2000;
    const birthYear = century + yy;

    return { gender, birthYear, birthMonth: mm, birthDay: dd };
  };

  // 주민번호 입력 에러 메시지
  const getRrnError = () => {
    if (rrnFront.length === 0 && !rrnBack) return null;

    if (rrnFront.length > 0 && rrnFront.length < 6) return null; // 아직 입력 중

    if (rrnFront.length === 6) {
      const mm = parseInt(rrnFront.slice(2, 4));
      const dd = parseInt(rrnFront.slice(4, 6));

      if (mm < 1 || mm > 12) {
        return "월은 01~12 사이로 입력해주세요";
      }
      if (dd < 1 || dd > 31) {
        return "일은 01~31 사이로 입력해주세요";
      }
    }

    if (rrnBack && ![1, 2, 3, 4].includes(parseInt(rrnBack))) {
      return "성별은 1~4만 입력 가능해요 (1,2: 1900년대생 / 3,4: 2000년대생)";
    }

    return null;
  };

  // 나이대 계산
  const getAgeGroup = () => {
    const parsed = parseRrn();
    if (!parsed) return null;

    const currentYear = new Date().getFullYear();
    const age = currentYear - parsed.birthYear;
    const decade = Math.floor(age / 10) * 10;
    const genderText = parsed.gender === "male" ? "남성" : "여성";

    // 50대 이상은 "50+"로 표시
    const decadeKey = decade >= 50 ? "50+" : `${decade}대`;
    const displayText =
      decade >= 50 ? `50+ ${genderText}` : `${decade}대 ${genderText}`;

    return { decadeKey, displayText };
  };

  // 설문 응답 핸들러
  const handleSurveyAnswer = (
    questionId: string,
    value: string,
    isMultiple: boolean,
  ) => {
    if (isMultiple) {
      const currentValues = (surveyResponses[questionId] as string[]) || [];
      if (value === "none") {
        // "없음" 선택시 다른 옵션 모두 해제
        setSurveyResponses({ ...surveyResponses, [questionId]: [value] });
      } else {
        // 다른 옵션 선택시 "없음" 해제
        const filteredValues = currentValues.filter((v) => v !== "none");
        if (filteredValues.includes(value)) {
          setSurveyResponses({
            ...surveyResponses,
            [questionId]: filteredValues.filter((v) => v !== value),
          });
        } else {
          setSurveyResponses({
            ...surveyResponses,
            [questionId]: [...filteredValues, value],
          });
        }
      }
    } else {
      setSurveyResponses({ ...surveyResponses, [questionId]: value });
      // 단일 선택은 자동으로 다음으로 넘어감
      setTimeout(() => handleNext(), 300);
    }
  };

  // 현재 질문에 대한 응답 여부 확인
  const hasAnswer = (questionId: string) => {
    const response = surveyResponses[questionId];
    if (Array.isArray(response)) {
      return response.length > 0;
    }
    return !!response;
  };

  const handleNext = async () => {
    if (step === "welcome") {
      goToStep("mission");
    } else if (step === "mission") {
      goToStep("problem");
    } else if (step === "problem") {
      goToStep("ready");
    } else if (step === "ready") {
      goToStep("basicInfo");
    } else if (step === "basicInfo") {
      const parsed = parseRrn();
      if (name && parsed) {
        goToStep("part1_q1");
      }
    }
    // Part 1: 방문 목적
    else if (step === "part1_q1") {
      goToStep("transition1");
    } else if (step === "transition1") {
      goToStep("part2_q1");
    }
    // Part 2: 돈에 대한 생각
    else if (step === "part2_q1") {
      goToStep("part2_q2");
    } else if (step === "part2_q2") {
      goToStep("part2_q3");
    } else if (step === "part2_q3") {
      goToStep("part2_q4");
    } else if (step === "part2_q4") {
      goToStep("transition2");
    } else if (step === "transition2") {
      goToStep("part3_q1");
    }
    // Part 3: 현재 상황
    else if (step === "part3_q1") {
      goToStep("part3_q2");
    } else if (step === "part3_q2") {
      goToStep("part3_q3");
    } else if (step === "part3_q3") {
      goToStep("part3_q4");
    } else if (step === "part3_q4") {
      goToStep("part3_q5");
    } else if (step === "part3_q5") {
      goToStep("transition3");
    } else if (step === "transition3") {
      goToStep("part4_q1");
    }
    // Part 4: 재무 습관
    else if (step === "part4_q1") {
      goToStep("part4_q2");
    } else if (step === "part4_q2") {
      goToStep("part4_q3");
    } else if (step === "part4_q3") {
      goToStep("transition4");
    } else if (step === "transition4") {
      goToStep("part5_q1");
    }
    // Part 5: 은퇴 준비
    else if (step === "part5_q1") {
      goToStep("part5_q2");
    } else if (step === "part5_q2") {
      goToStep("part5_q3");
    } else if (step === "part5_q3") {
      goToStep("surveyComplete");
    } else if (step === "surveyComplete") {
      goToStep("matching");
    }
    // 나머지
    else if (step === "program") {
      goToStep("booking");
    } else if (step === "booking") {
      // 전화번호 인증으로 이동
      const parsed = parseRrn();
      if (parsed && selectedDate && selectedTime && expertId) {
        // 예약 완료 트래킹
        OnboardingEvents.bookingCompleted({
          date: selectedDate.toISOString().split("T")[0],
          time: selectedTime,
          expertName: "손균우", // TODO: 동적으로 가져오기
        });

        // 온보딩 완료 시 localStorage 정리
        localStorage.removeItem(SURVEY_STORAGE_KEY);
        localStorage.removeItem(BASIC_INFO_STORAGE_KEY);

        onComplete({
          name,
          gender: parsed.gender,
          birthYear: parsed.birthYear,
          birthMonth: parsed.birthMonth,
          surveyResponses,
          bookingDate: selectedDate ? selectedDate.toISOString() : null,
          bookingTime: selectedTime,
          expertId,
        });
      }
    }
  };

  const isBasicInfoComplete =
    name.trim() && rrnFront.length === 6 && rrnBack && parseRrn();

  // 주민번호 앞자리 입력 핸들러
  const handleRrnFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits.length <= 6) {
      setRrnFront(digits);
      if (digits.length === 6) {
        rrnBackRef.current?.focus();
      }
    } else {
      setRrnFront(digits.slice(0, 6));
      setRrnBack(digits.slice(6, 7));
      rrnBackRef.current?.focus();
    }
  };

  // 주민번호 뒷자리 입력 핸들러
  const handleRrnBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 1);
    setRrnBack(value);
  };

  // 1. 라이콘 소개
  const renderWelcome = () => (
    <div className={styles.stepContent}>
      <div className={styles.welcomeBadge}>Lycon | Retirement</div>
      <h1 className={styles.titleLarge}>
        은퇴 준비,
        <br />
        지금 하고 계신가요?
      </h1>
      <p className={styles.subtitleLarge}>
        라이콘은 은퇴 설계 전문가가 1:1로 배정되어
        <br />
        현재 재무 상태를 진단하고
        <br />
        은퇴 전략을 함께 설계해드립니다.
      </p>
      <div className={styles.bottomButtonArea}>
        <button className={styles.primaryButton} onClick={handleNext}>
          다음
        </button>
      </div>
    </div>
  );

  // 2. 라이콘 소개
  const renderMission = () => (
    <div className={styles.stepContent}>
      <div className={styles.welcomeBadge}>Lycon | Retirement</div>
      <h1 className={styles.titleLarge}>
        전문가의 자산 관리,
        <br />더 이상 특권이 아닙니다
      </h1>
      <p className={styles.missionDesc}>
        은행 PB, 증권사 자산관리 서비스는
        <br />
        최소 5억부터 수십억 자산가에게만 제공됩니다.
      </p>
      <p className={styles.missionDesc}>
        라이콘은 자산 규모와 관계없이
        <br />
        누구나 전문가의 종합 재무검진을 받을 수 있도록, 문턱을 낮추고 있습니다.
      </p>
      <div className={styles.bottomButtonArea}>
        <button className={styles.primaryButton} onClick={handleNext}>
          다음
        </button>
      </div>
    </div>
  );

  // 3. 왜 은퇴 진단이 필요한가
  const renderProblem = () => (
    <div className={styles.stepContent}>
      <div className={styles.welcomeBadge}>Lycon | Retirement</div>
      <h1 className={styles.titleLarge}>
        왜 은퇴 진단이
        <br />
        필요할까요?
      </h1>
      <div className={styles.statsList}>
        <div className={styles.statItem}>
          <div className={styles.statHeader}>
            <span className={styles.statNumber}>39.7%</span>
            <span className={styles.statBadge}>OECD 1위, 평균의 3배</span>
          </div>
          <div className={styles.statTitle}>노인 빈곤율</div>
          <div className={styles.statSource}>
            국가데이터처 「2024 고령자통계」
          </div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statHeader}>
            <span className={styles.statNumber}>67만원</span>
            <span className={styles.statVs}>vs 300만원</span>
          </div>
          <div className={styles.statTitle}>국민연금 평균 vs 희망 생활비</div>
          <div className={styles.statSource}>
            국민연금공단, 한국보건사회연구원
          </div>
        </div>
      </div>
      <p className={styles.problemText}>
        건강검진처럼 은퇴도 정기적인 검진이 필요합니다.
      </p>
      <div className={styles.bottomButtonArea}>
        <button className={styles.primaryButton} onClick={handleNext}>
          다음
        </button>
      </div>
    </div>
  );

  // 4. 문진표 작성 안내
  const renderReady = () => (
    <div className={styles.stepContent}>
      <div className={styles.welcomeBadge}>Lycon | Retirement</div>
      <h1 className={styles.titleLarge}>
        먼저 간단한 문진표를
        <br />
        작성해주세요
      </h1>
      <p className={styles.readyDesc}>맞춤 진단을 위해 필요해요</p>
      <div className={styles.bottomButtonArea}>
        <button className={styles.primaryButton} onClick={handleNext}>
          시작하기
        </button>
      </div>
    </div>
  );

  // 5. 기본 정보 입력
  const renderBasicInfo = () => (
    <div className={styles.stepContent}>
      <div className={styles.welcomeBadge}>기본 정보 입력</div>
      <h1 className={styles.titleLarge}>
        고객님에 대해
        <br />
        알려주세요
      </h1>
      <p className={styles.readyDesc}>맞춤형 진단을 위한 기본 정보입니다.</p>

      <div className={styles.formGroup}>
        <label className={styles.label}>이름</label>
        <input
          type="text"
          className={styles.textInput}
          placeholder="이름을 입력해주세요"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>생년월일 / 성별</label>
        <div className={styles.rrnInputGroup}>
          <input
            type="text"
            inputMode="numeric"
            className={styles.rrnInput}
            placeholder="900101"
            value={rrnFront}
            onChange={handleRrnFrontChange}
            maxLength={6}
          />
          <span className={styles.rrnDash}>-</span>
          <input
            ref={rrnBackRef}
            type="text"
            inputMode="numeric"
            className={styles.rrnBackInput}
            placeholder="1"
            value={rrnBack}
            onChange={handleRrnBackChange}
            maxLength={1}
          />
          <span className={styles.rrnMask}>******</span>
        </div>
        {getRrnError() ? (
          <p className={styles.rrnError}>{getRrnError()}</p>
        ) : (
          <p className={styles.rrnHint}>뒷자리는 첫 번째 숫자만 입력해주세요</p>
        )}
      </div>

      <div className={styles.bottomButtonArea}>
        <button
          className={styles.privacyLink}
          onClick={() => setShowPrivacyModal(true)}
        >
          모든 데이터는 금융기관 수준으로 보호됩니다
        </button>
        <button
          className={styles.primaryButton}
          onClick={handleNext}
          disabled={!isBasicInfoComplete}
        >
          다음
        </button>
      </div>

      {/* 개인정보 보호 모달 */}
      {showPrivacyModal && (
        <div
          className={`${styles.modalOverlay} ${
            isModalClosing ? styles.closing : ""
          }`}
          onClick={closePrivacyModal}
        >
          <div
            className={`${styles.modalContent} ${
              isModalClosing ? styles.closing : ""
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>데이터 보호 정책</h2>
              <button className={styles.modalClose} onClick={closePrivacyModal}>
                닫기
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.privacyItem}>
                <div className={styles.privacyItemTitle}>
                  금융기관 수준 암호화
                </div>
                <div className={styles.privacyItemDesc}>
                  모든 개인정보는 AES-256 암호화를 통해 안전하게 보호됩니다.
                  이는 국내 주요 은행에서 사용하는 것과 동일한 수준입니다.
                </div>
              </div>
              <div className={styles.privacyItem}>
                <div className={styles.privacyItemTitle}>데이터 접근 제한</div>
                <div className={styles.privacyItemDesc}>
                  고객님의 데이터는 담당 전문가만 열람할 수 있으며, 모든 접근
                  기록은 철저히 관리됩니다.
                </div>
              </div>
              <div className={styles.privacyItem}>
                <div className={styles.privacyItemTitle}>제3자 제공 금지</div>
                <div className={styles.privacyItemDesc}>
                  수집된 정보는 재무 진단 목적으로만 사용되며, 고객 동의 없이
                  외부에 제공되지 않습니다.
                </div>
              </div>
              <div className={styles.privacyItem}>
                <div className={styles.privacyItemTitle}>언제든 삭제 가능</div>
                <div className={styles.privacyItemDesc}>
                  요청 시 모든 개인정보를 즉시 삭제해 드립니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 파트 간 전환 화면 데이터
  const TRANSITION_DATA = [
    {
      // transition1: Part 1 완료 → Part 2 시작
      badge: "다음",
      title: "고민을 나눠주셔서\n감사해요",
      desc: "이제 돈에 대한 생각을 여쭤볼게요.\n같은 상황이라도 사람마다\n전략이 달라지거든요.",
    },
    {
      // transition2: Part 2 완료 → Part 3 시작
      badge: "다음",
      title: "생각보다 많은 분들이\n비슷한 고민을 해요",
      desc: "현실적인 은퇴 진단을 위해\n지금 상황을 간단히 여쭤볼게요.",
    },
    {
      // transition3: Part 3 완료 → Part 4 시작
      badge: "다음",
      title: "은퇴 준비,\n습관이 절반이에요",
      desc: "평소 돈 관리 방식을 알면\n더 실천 가능한 전략을 드릴 수 있어요.",
    },
    {
      // transition4: Part 4 완료 → Part 5 시작
      badge: "마지막",
      title: "노후 준비,\n늦은 건 없어요",
      desc: "지금 어디쯤인지만 알면\n앞으로 뭘 해야 할지 보여요.",
    },
  ];

  // 전환 화면 렌더링
  const renderTransition = (transitionIndex: number) => {
    const data = TRANSITION_DATA[transitionIndex];
    // 다음 섹션 정보 (transition1 -> Part 2, transition2 -> Part 3, ...)
    const nextSectionIndex = transitionIndex + 1;
    const nextSection = SURVEY_SECTIONS[nextSectionIndex];

    return (
      <div className={styles.stepContent}>
        <div className={styles.surveyQuestionContainer}>
          <div className={styles.surveyProgress}>
            <span className={styles.surveyProgressSection}>
              {nextSection?.title || "다음"}
            </span>
          </div>
          <h1 className={styles.surveyQuestionTitle}>
            {data.title.split("\n").map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i < data.title.split("\n").length - 1 && <br />}
              </React.Fragment>
            ))}
          </h1>
          <p className={styles.transitionDesc}>
            {data.desc.split("\n").map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i < data.desc.split("\n").length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        </div>
        <div className={styles.bottomButtonArea}>
          <button className={styles.primaryButton} onClick={handleNext}>
            계속하기
          </button>
        </div>
      </div>
    );
  };

  // 설문 완료 화면 (심플 버전)
  const renderSurveyComplete = () => {
    return (
      <div className={styles.stepContent}>
        <div className={styles.surveyQuestionContainer}>
          <div className={styles.surveyProgress}>
            <span className={styles.surveyProgressSection}>설문 완료</span>
          </div>
          <h1 className={styles.surveyQuestionTitle}>
            고생하셨어요,
            <br />
            {name}님!
          </h1>
          <p className={styles.transitionDesc}>
            응답을 바탕으로
            <br />
            담당 은퇴설계사를 배정해드릴게요.
          </p>
        </div>
        <div className={styles.bottomButtonArea}>
          <button className={styles.primaryButton} onClick={handleNext}>
            담당 전문가 배정받기
          </button>
        </div>
      </div>
    );
  };

  // 설문 질문 렌더링
  const renderSurveyQuestion = (
    sectionIndex: number,
    questionIndex: number,
  ) => {
    const section = SURVEY_SECTIONS[sectionIndex];
    const question = section.questions[questionIndex];
    const response = surveyResponses[question.id];
    const isMultiple = question.type === "multiple";

    const isSelected = (value: string) => {
      if (isMultiple) {
        return Array.isArray(response) && response.includes(value);
      }
      return response === value;
    };

    return (
      <div className={styles.stepContent}>
        <div className={styles.surveyQuestionContainer}>
          <div className={styles.surveyProgress}>
            <span className={styles.surveyProgressSection}>
              {section.title}
            </span>
            <span className={styles.surveyProgressCount}>
              {questionIndex + 1} / {section.questions.length}
            </span>
          </div>
          <h1 className={styles.surveyQuestionTitle}>
            {question.question.split("\n").map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i < question.question.split("\n").length - 1 && <br />}
              </React.Fragment>
            ))}
          </h1>
          {isMultiple && (
            <p className={styles.surveyMultipleHint}>복수 선택 가능</p>
          )}
          <div className={styles.surveyOptions}>
            {question.options.map((option) => (
              <button
                key={option.value}
                className={`${styles.surveyOption} ${
                  isSelected(option.value) ? styles.selected : ""
                }`}
                onClick={() =>
                  handleSurveyAnswer(question.id, option.value, isMultiple)
                }
              >
                {isMultiple && (
                  <span className={styles.checkbox}>
                    {isSelected(option.value) ? (
                      <CheckSquare size={20} />
                    ) : (
                      <Square size={20} />
                    )}
                  </span>
                )}
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {isMultiple && (
          <div className={styles.bottomButtonArea}>
            <button
              className={styles.primaryButton}
              onClick={handleNext}
              disabled={!hasAnswer(question.id)}
            >
              다음
            </button>
          </div>
        )}
      </div>
    );
  };

  // 3. 담당자 매칭
  const isMatched = matchingProgress >= 100;

  const renderMatching = () => {
    return (
      <div className={styles.stepContent}>
        {/* 매칭 중 */}
        {!isMatched && (
          <div className={styles.matchingContainer}>
            {/* 스켈레톤 프로필 카드 */}
            <div className={styles.skeletonCard}>
              <div className={styles.skeletonAvatar} />
              <div className={styles.skeletonInfo}>
                <div className={styles.skeletonLine} style={{ width: 100 }} />
                <div
                  className={styles.skeletonLine}
                  style={{ width: 140, height: 20 }}
                />
              </div>
            </div>

            <p className={styles.matchingDesc}>전문가 배정 중...</p>
            <div className={styles.matchingProgress}>
              <div
                className={styles.matchingProgressBar}
                style={{ width: `${matchingProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* 매칭 완료 */}
        {isMatched && (
          <>
            <div className={styles.welcomeBadge}>
              담당 전문가: 손균우 설계사
            </div>
            <div className={styles.letterPaper}>
              <p className={styles.letterText}>{name}님, 반갑습니다.</p>
              <p className={styles.letterText}>
                담당 은퇴설계 전문가 손균우입니다.
              </p>
              <div className={styles.letterLine} />
              <p className={styles.letterText}>은퇴 준비, 막막하셨죠?</p>
              <p className={styles.letterText}>
                알아야 할 것도 많고, 결정할 것도 많습니다.
              </p>
              <p className={styles.letterText}>
                이제 걱정 내려놓으셔도 됩니다.
              </p>
              <div className={styles.letterLine} />
              <p className={styles.letterText}>
                IRP, 세액공제, ISA, 연금 수령 시기, 부동산...
              </p>
              <p className={styles.letterText}>
                은퇴 준비에 알아야 할 게 정말 많습니다.
              </p>
              <p className={styles.letterText}>
                하나하나 차근차근 알려드릴게요.
              </p>
              <div className={styles.letterLine} />
              <p className={styles.letterText}>현재 상황을 정확히 파악하고,</p>
              <p className={styles.letterText}>
                {name}님에게 맞는 전략을 함께 세우겠습니다.
              </p>
              <div className={styles.letterLine} />
              <p className={styles.letterText}>
                그럼 첫 번째 검진, 시작해볼까요?
              </p>
              <p className={styles.letterSignature}>손균우 드림</p>
            </div>
            <div className={styles.bottomButtonArea}>
              <button
                className={styles.primaryButton}
                onClick={() => goToStep("program")}
              >
                검진 프로그램 확인
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  // 6. 재무검진 프로그램 소개
  const renderProgram = () => {
    const ageGroup = getAgeGroup();
    const content = ageGroup
      ? PROGRAM_CONTENT[ageGroup.decadeKey]
      : PROGRAM_CONTENT["30대"];

    return (
      <div className={styles.stepContent}>
        <div className={styles.welcomeBadge}>{name}님을 위한</div>
        <div className={styles.programHeader}>
          <h1 className={styles.programTitle}>
            기본형 종합 재무검진{" "}
            <span className={styles.programTitleSub}>(은퇴 진단)</span>
          </h1>
          {ageGroup && (
            <p className={styles.programTarget}>{ageGroup.displayText}</p>
          )}
          <p className={styles.programExpert}>담당 : 손균우 은퇴설계 전문가</p>
        </div>

        {/* 프로그램 설명 */}
        <p className={styles.programDesc}>{content.desc}</p>

        {/* 소요시간/비용/진행방식 */}
        <div className={styles.programMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>진행방식</span>
            <span className={styles.metaValue}>온라인 또는 대면</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>소요시간</span>
            <span className={styles.metaValue}>약 30분</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>검진비용</span>
            <span className={styles.metaValue}>
              <span className={styles.metaOriginal}>249,000원</span>
              <span className={styles.metaFree}>무료</span>
            </span>
          </div>
        </div>
        <p className={styles.metaNote}>
          * 대면 상담 시 추가 비용이 발생할 수 있으며, 소요 시간은 약
          1시간입니다.
        </p>

        {/* CHECK POINT */}
        <div className={styles.checkpoint}>
          <div className={styles.checkpointTitle}>CHECK POINT !</div>
          <ul className={styles.checkpointList}>
            {content.checkpoints.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        {/* 검진 항목 표 */}
        <div className={styles.checkupTableSection}>
          <h2 className={styles.checkupTableTitle}>검진 항목</h2>
          <table className={styles.checkupTable}>
            <thead>
              <tr>
                <th className={styles.thCategory}>검진 영역</th>
                <th className={styles.thItems}>검사 항목</th>
                <th className={styles.thDiagnosis}>관련 진단</th>
              </tr>
            </thead>
            <tbody>
              {CHECKUP_ITEMS.map((item, index) => (
                <tr key={index}>
                  <td className={styles.tdCategory}>{item.category}</td>
                  <td className={styles.tdItems}>{item.items}</td>
                  <td className={styles.tdDiagnosis}>{item.diagnosis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 검진 후 제공 */}
        <div className={styles.programAfter}>
          <div className={styles.programAfterTitle}>검진 후 제공</div>
          <ul className={styles.programAfterList}>
            <li>전담 은퇴설계전문가 1:1 상담</li>
            <li>은퇴 진단 보고서</li>
            <li>맞춤 재무 전략 수립</li>
            <li>은퇴 시나리오 다각화</li>
          </ul>
        </div>

        <div className={styles.bottomButtonArea}>
          <button className={styles.primaryButton} onClick={handleNext}>
            검진 예약하기
          </button>
        </div>
      </div>
    );
  };

  // 5. 예약 일정 잡기
  const renderBooking = () => {
    // 5일 후부터 14일간 날짜 생성
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 5; i <= 11; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    const formatDate = (date: Date) => {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekday = weekdays[date.getDay()];
      return { month, day, weekday };
    };

    // 선택된 날짜의 가용 시간
    const selectedDateStr = selectedDate ? formatLocalDate(selectedDate) : "";
    const timeSlots = selectedDateStr
      ? availableTimes[selectedDateStr] || []
      : [];

    const isBookingComplete = selectedDate && selectedTime;

    if (loadingTimes) {
      return (
        <div className={styles.stepContent}>
          <h1 className={styles.title}>검진 일정 예약</h1>
          <div className={styles.skeletonSubtitle} />
          <div className={styles.skeletonSubtitleShort} />

          <div className={styles.bookingSection}>
            <div className={styles.skeletonLabel} />
            <div className={styles.dateGrid}>
              {[...Array(7)].map((_, i) => (
                <div key={i} className={styles.skeletonDateItem} />
              ))}
            </div>
          </div>

          <div className={styles.bookingSection}>
            <div className={styles.skeletonLabel} />
            <div className={styles.timeGrid}>
              {[...Array(7)].map((_, i) => (
                <div key={i} className={styles.skeletonTimeItem} />
              ))}
            </div>
          </div>

          <div className={styles.bottomButtonArea}>
            <div className={styles.skeletonButton} />
          </div>
        </div>
      );
    }

    return (
      <div className={styles.stepContent}>
        <h1 className={styles.title}>검진 일정 예약</h1>
        <p className={styles.subtitle}>
          손균우 전문가와의 상담 일정을 선택해주세요.
          <br />
          안내되는 재무 정보 입력을 따라해주시면 됩니다.
        </p>

        <div className={styles.bookingSection}>
          <label className={styles.bookingLabel}>날짜 선택</label>
          <div className={styles.dateGrid}>
            {dates.map((date, index) => {
              const { month, day, weekday } = formatDate(date);
              const isSelected =
                selectedDate?.toDateString() === date.toDateString();
              const dateStr = formatLocalDate(date);
              const hasSlots =
                availableTimes[dateStr] && availableTimes[dateStr].length > 0;
              const dayOfWeek = date.getDay(); // 0: 일요일, 6: 토요일

              return (
                <button
                  key={index}
                  className={`${styles.dateItem} ${
                    isSelected ? styles.selected : ""
                  } ${!hasSlots ? styles.disabled : ""}`}
                  onClick={() => {
                    if (hasSlots) {
                      setSelectedDate(date);
                      setSelectedTime(null);
                    }
                  }}
                  disabled={!hasSlots}
                >
                  <span className={`${styles.dateWeekday} ${dayOfWeek === 0 ? styles.sunday : ""} ${dayOfWeek === 6 ? styles.saturday : ""}`}>{weekday}</span>
                  <span className={`${styles.dateDay} ${dayOfWeek === 0 ? styles.sunday : ""} ${dayOfWeek === 6 ? styles.saturday : ""}`}>{day}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div className={styles.bookingSection}>
            <label className={styles.bookingLabel}>시간 선택</label>
            {timeSlots.length > 0 ? (
              <div className={styles.timeGrid}>
                {timeSlots.map((time, index) => {
                  const isSelected = selectedTime === time;
                  return (
                    <button
                      key={index}
                      className={`${styles.timeItem} ${
                        isSelected ? styles.selected : ""
                      }`}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={styles.noSlots}>
                이 날짜에는 예약 가능한 시간이 없습니다.
              </p>
            )}
          </div>
        )}

        <div className={styles.bottomButtonArea}>
          <button
            className={styles.primaryButton}
            onClick={handleNext}
            disabled={!isBookingComplete}
          >
            예약 완료
          </button>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case "welcome":
        return renderWelcome();
      case "mission":
        return renderMission();
      case "problem":
        return renderProblem();
      case "ready":
        return renderReady();
      case "basicInfo":
        return renderBasicInfo();
      // Part 1: 방문 목적 (1문항)
      case "part1_q1":
        return renderSurveyQuestion(0, 0);
      case "transition1":
        return renderTransition(0);
      // Part 2: 돈에 대한 생각 (4문항)
      case "part2_q1":
        return renderSurveyQuestion(1, 0);
      case "part2_q2":
        return renderSurveyQuestion(1, 1);
      case "part2_q3":
        return renderSurveyQuestion(1, 2);
      case "part2_q4":
        return renderSurveyQuestion(1, 3);
      case "transition2":
        return renderTransition(1);
      // Part 3: 현재 상황 (5문항)
      case "part3_q1":
        return renderSurveyQuestion(2, 0);
      case "part3_q2":
        return renderSurveyQuestion(2, 1);
      case "part3_q3":
        return renderSurveyQuestion(2, 2);
      case "part3_q4":
        return renderSurveyQuestion(2, 3);
      case "part3_q5":
        return renderSurveyQuestion(2, 4);
      case "transition3":
        return renderTransition(2);
      // Part 4: 재무 습관 (3문항)
      case "part4_q1":
        return renderSurveyQuestion(3, 0);
      case "part4_q2":
        return renderSurveyQuestion(3, 1);
      case "part4_q3":
        return renderSurveyQuestion(3, 2);
      case "transition4":
        return renderTransition(3);
      // Part 5: 은퇴 준비 (3문항)
      case "part5_q1":
        return renderSurveyQuestion(4, 0);
      case "part5_q2":
        return renderSurveyQuestion(4, 1);
      case "part5_q3":
        return renderSurveyQuestion(4, 2);
      // 설문 완료
      case "surveyComplete":
        return renderSurveyComplete();
      // 나머지
      case "matching":
        return renderMatching();
      case "program":
        return renderProgram();
      case "booking":
        return renderBooking();
      default:
        return null;
    }
  };

  // 회원 탈퇴 (테스트용)
  const handleDeleteAccount = async () => {
    if (!confirm("정말 탈퇴하시겠습니까?\n모든 데이터가 삭제됩니다.")) return;
    await fetch("/api/auth/delete-account", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <div
      className={`${styles.container} ${
        isInitialLoad ? styles.initialLoad : styles.loaded
      }`}
    >
      {/* 회원탈퇴 버튼 (테스트용) */}
      <button className={styles.deleteButton} onClick={handleDeleteAccount}>
        탈퇴
      </button>
      <main
        ref={mainRef}
        className={`${styles.main} ${isAnimating ? styles.animating : ""}`}
      >
        {renderStep()}
      </main>
    </div>
  );
}
