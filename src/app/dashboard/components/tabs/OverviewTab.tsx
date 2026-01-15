"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  Check,
  X,
  Award,
  Briefcase,
  GraduationCap,
  Shield,
} from "lucide-react";
import {
  useFamilyMembers,
  useSimulation,
  type ProfileBasics,
} from "@/contexts/FinancialContext";
import { createClient } from "@/lib/supabase/client";
import { MissionForm } from "./MissionForm";
import { StepMissionForm } from "./StepMissionForm";
import { FamilyForm } from "./FamilyForm";
import {
  RealEstateInputForm,
  type RealEstateFormData,
} from "./RealEstateInputForm";
import {
  SavingsInputForm,
  type SavingsFormData,
} from "./SavingsInputForm";
import { getQuestionsForMission } from "./surveyQuestions";
import {
  getRealEstates,
  createRealEstate,
  updateRealEstate,
  deleteRealEstate,
} from "@/lib/services/realEstateService";
import { getLatestExpertMessage, type Message } from "@/lib/services/messageService";
import {
  getSavings,
  createSavings,
  updateSavings,
  deleteSavings,
} from "@/lib/services/savingsService";
import { useInvalidateByCategory } from "@/hooks/useFinancialData";
import type { RealEstate, Savings } from "@/types/tables";
import styles from "./OverviewTab.module.css";

// 7일 = 604800초
const TOTAL_SECONDS = 7 * 24 * 60 * 60;

// 금융자산 기본 명칭
function getDefaultSavingsTitle(type: string): string {
  const labels: Record<string, string> = {
    checking: "입출금통장",
    savings: "적금",
    deposit: "정기예금",
    domestic_stock: "국내주식/ETF",
    foreign_stock: "해외주식/ETF",
    fund: "펀드",
    bond: "채권",
    crypto: "암호화폐",
    other: "기타",
  };
  return labels[type] || type;
}

interface OverviewTabProps {
  profile: ProfileBasics;
}

type MissionType = "survey" | "finance";

type MissionCategory = "know-myself" | "assets" | "future-prep" | "cashflow" | "future";

interface Mission {
  id: string;
  type: MissionType;
  category: MissionCategory;
  label: string;
  description: string;
  link?: string; // finance 타입만
  tip: string;
}

// 카테고리 정보
const CATEGORY_INFO: Record<MissionCategory, { label: string; description: string; step: number }> = {
  "know-myself": { label: "가족", description: "가족 구성", step: 1 },
  "assets": { label: "자산", description: "보유 자산 현황", step: 2 },
  "cashflow": { label: "현금흐름", description: "수입과 지출", step: 3 },
  "future-prep": { label: "연금", description: "노후 준비", step: 4 },
  "future": { label: "미래 계획", description: "앞으로의 계획", step: 5 },
};

// 여정 미션 정의 - 핵심 항목만
const journeyMissions: Mission[] = [
  // ========== 1단계: 나를 알기 ==========
  {
    id: "family-composition",
    type: "survey",
    category: "know-myself",
    label: "가족 구성",
    description:
      "함께 사는 가족 구성원을 확인합니다. 배우자, 자녀, 부양가족 정보를 입력해주세요.",
    tip: "가족 구성에 따라 생활비, 교육비, 상속 계획 등이 달라져요. 정확한 분석을 위해 꼭 입력해주세요.",
  },

  // ========== 2단계: 자산 파악 ==========
  {
    id: "realestate-residence",
    type: "finance",
    category: "assets",
    label: "거주 부동산",
    description:
      "현재 살고 계신 집의 정보를 입력합니다. 자가, 전세, 월세 여부와 시세를 파악해요.",
    link: "realEstate",
    tip: "현재 시세 기준으로 입력해주세요. 대출이 있다면 부채 현황에서 따로 입력하게 됩니다.",
  },
  {
    id: "assets",
    type: "finance",
    category: "assets",
    label: "자산",
    description:
      "예금, 적금, 주식, 펀드, 암호화폐 등 보유한 금융자산을 입력합니다.",
    link: "savings",
    tip: "은행/증권사 앱에서 계좌 잔액을 확인해주세요.",
  },
  {
    id: "debt",
    type: "finance",
    category: "assets",
    label: "부채",
    description:
      "대출, 할부, 리스 등 모든 부채를 입력합니다. 남은 잔액과 월 상환액을 파악해요.",
    link: "debt",
    tip: "주택담보대출, 신용대출은 물론 자동차 할부, 가전 할부도 포함해주세요.",
  },

  // ========== 3단계: 현금흐름 ==========
  {
    id: "income",
    type: "finance",
    category: "cashflow",
    label: "소득",
    description: "본인과 배우자의 급여, 사업소득 등 모든 수입을 입력합니다.",
    link: "income",
    tip: "세전 금액 기준으로 입력해주세요. 월급 명세서를 참고하시면 정확해요.",
  },
  {
    id: "expense",
    type: "finance",
    category: "cashflow",
    label: "지출",
    description: "주거비, 생활비, 교육비 등 매달 나가는 지출을 입력합니다.",
    link: "expense",
    tip: "카드 명세서를 참고하세요. 정확하지 않아도 대략적인 규모면 충분합니다.",
  },

  // ========== 4단계: 연금 ==========
  {
    id: "pension-national",
    type: "finance",
    category: "future-prep",
    label: "국민연금",
    description: "국민연금 예상 수령액과 가입 현황을 입력합니다.",
    link: "pension",
    tip: "국민연금공단 앱이나 홈페이지에서 예상 수령액을 확인할 수 있어요.",
  },
  {
    id: "pension-retirement",
    type: "finance",
    category: "future-prep",
    label: "퇴직연금/퇴직금",
    description: "회사에서 적립 중인 퇴직연금 또는 퇴직금 현황을 입력합니다.",
    link: "pension",
    tip: "회사 인사팀이나 퇴직연금 운용사에서 적립금을 확인할 수 있어요.",
  },
  {
    id: "pension-personal",
    type: "finance",
    category: "future-prep",
    label: "개인연금",
    description: "연금저축, IRP 등 개인연금 현황을 입력합니다.",
    link: "pension",
    tip: "IRP는 세액공제 전용과 절세용 두 계좌를 활용하면 효과적이에요.",
  },
];


// 전문가 프로필 정보
const expertProfile = {
  name: "손균우",
  title: "담당 자산관리사",
  image: null, // 추후 실제 이미지 URL
  introduction:
    "15년간 1,200명 이상의 고객에게 맞춤 은퇴 설계를 제공해온 재무 전문가입니다. 복잡한 재무 상황도 쉽게 풀어드립니다.",
  credentials: [
    { type: "license", label: "국제공인재무설계사 (CFP)" },
    { type: "license", label: "재무설계사 (AFPK)" },
    { type: "license", label: "투자자산운용사" },
    { type: "license", label: "보험설계사 (생명/손해)" },
    { type: "license", label: "은퇴설계전문가 (RICP)" },
  ],
  education: [
    { label: "서울대학교 경영학과 졸업" },
    { label: "연세대학교 금융MBA 수료" },
  ],
  career: [
    { period: "2020 - 현재", role: "라이콘 수석 재무설계사" },
    { period: "2015 - 2020", role: "삼성생명 WM센터 팀장" },
    { period: "2010 - 2015", role: "미래에셋증권 PB" },
  ],
  specialties: [
    "은퇴 자금 설계",
    "연금 최적화",
    "자산 배분",
    "세금 절감 전략",
    "상속/증여 설계",
  ],
  stats: {
    clients: "1,200+",
    experience: "15년",
    satisfaction: "98%",
  },
};

// 요일 배열
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 날짜 포맷 (M/D 요일)
function formatDateShort(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()} ${weekday}`;
}

// 미션별 기존 데이터 → 폼 초기값으로 변환
function getInitialValuesForMission(
  missionId: string,
  profile: ProfileBasics,
  familyMembers: {
    relationship: string;
    name: string;
    birth_date: string | null;
  }[]
): Record<string, string | string[]> {
  // 1. 먼저 survey_responses에 저장된 데이터 확인
  if (profile.survey_responses?.[missionId]) {
    return profile.survey_responses[missionId];
  }

  // 2. investment_profile에 저장된 데이터 확인
  if (missionId === "investment-style" && profile.investment_profile?.answers) {
    return profile.investment_profile.answers;
  }

  // 3. 특수 케이스: DB 컬럼에 개별 저장된 데이터
  const values: Record<string, string | string[]> = {};

  if (missionId === "family-composition") {
    const spouse = familyMembers.find((m) => m.relationship === "spouse");
    const children = familyMembers.filter((m) => m.relationship === "child");
    const parents = familyMembers.filter((m) => m.relationship === "parent");

    values["has-spouse"] = spouse ? "yes" : "no";
    if (spouse?.birth_date) {
      const age =
        new Date().getFullYear() - new Date(spouse.birth_date).getFullYear();
      values["spouse-age"] = String(age);
    }
    values["children-count"] =
      children.length >= 3 ? "3+" : String(children.length);
    values["dependents"] =
      parents.length === 0 ? "none" : parents.length === 1 ? "one" : "both";
  }

  if (missionId === "retirement-goal") {
    if (profile.target_retirement_age) {
      values["target-retirement-age"] = String(profile.target_retirement_age);
    }
    if (profile.retirement_lifestyle_ratio) {
      values["retirement-lifestyle"] = String(
        profile.retirement_lifestyle_ratio
      );
    }
  }

  return values;
}

export function OverviewTab({ profile }: OverviewTabProps) {
  const router = useRouter();
  const { familyMembers } = useFamilyMembers();
  const { simulation } = useSimulation();
  const [completedMissions, setCompletedMissions] = useState<
    Record<string, boolean>
  >(profile.action_plan_status || {});
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [showExpertProfile, setShowExpertProfile] = useState(false);
  const [isProfileClosing, setIsProfileClosing] = useState(false);
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isViewExiting, setIsViewExiting] = useState(false);
  const [isViewEntering, setIsViewEntering] = useState(false);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [realEstates, setRealEstates] = useState<RealEstate[]>([]);
  const [savings, setSavings] = useState<Savings[]>([]);
  const [selectedMissionIndex, setSelectedMissionIndex] = useState(0);
  const [latestMessage, setLatestMessage] = useState<{ message: Message; expertName: string } | null>(null);
  const [isMessageLoading, setIsMessageLoading] = useState(true);
  const missionListRef = useRef<HTMLDivElement>(null);
  const missionItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // React Query 캐시 무효화 훅
  const invalidateByCategory = useInvalidateByCategory(simulation?.id || "");

  // 부동산 데이터 로드
  useEffect(() => {
    if (simulation?.id) {
      getRealEstates(simulation.id).then(setRealEstates).catch(console.error);
    }
  }, [simulation?.id]);

  // 금융자산 데이터 로드
  useEffect(() => {
    if (simulation?.id) {
      getSavings(simulation.id).then(setSavings).catch(console.error);
    }
  }, [simulation?.id]);

  // 최신 전문가 메시지 로드
  useEffect(() => {
    getLatestExpertMessage()
      .then(setLatestMessage)
      .catch(console.error)
      .finally(() => setIsMessageLoading(false));
  }, []);

  // 카운트다운 타이머 (재무 입력 마감일까지)
  useEffect(() => {
    const deadline = profile.diagnosis_started_at
      ? new Date(new Date(profile.diagnosis_started_at).getTime() + 7 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = deadline.getTime() - now;

      if (distance > 0) {
        setCountdown({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [profile.diagnosis_started_at]);

  // 모든 미션 표시 (필터링 없음)
  const filteredMissions = journeyMissions;

  // 시작일 계산
  const startDate = useMemo(() => {
    if (profile.diagnosis_started_at) {
      return new Date(profile.diagnosis_started_at);
    }
    return new Date();
  }, [profile.diagnosis_started_at]);

  // 현재 Day 인덱스 (0-6)
  const currentDayIndex = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.min(Math.max(diffDays, 0), 6);
  }, [startDate]);

  // 초 단위 실제 진행률 계산
  const actualProgress = useMemo(() => {
    const now = new Date().getTime();
    const start = new Date(startDate).getTime();
    const elapsedSeconds = (now - start) / 1000;
    const progress = (elapsedSeconds / TOTAL_SECONDS) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }, [startDate]);

  // 페이지 로드 시 애니메이션으로 채워지는 효과
  useEffect(() => {
    // 처음에는 0에서 시작
    setAnimatedProgress(0);

    // 약간의 딜레이 후 실제 진행률로 애니메이션
    const timer = setTimeout(() => {
      setAnimatedProgress(actualProgress);
    }, 100);

    return () => clearTimeout(timer);
  }, [actualProgress]);

  // 현재 단계 (입력/분석/완료)
  const currentPhase = useMemo(() => {
    if (currentDayIndex < 3) return "input";
    if (currentDayIndex < 6) return "analysis";
    return "complete";
  }, [currentDayIndex]);

  // D-day 계산
  const daysUntilDeadline = 3 - currentDayIndex; // 입력 마감까지
  const daysUntilReport = 7 - currentDayIndex; // 보고서까지

  // 입력 마감 카운트다운 (매초 업데이트)
  useEffect(() => {
    const deadlineDate = new Date(startDate);
    deadlineDate.setDate(deadlineDate.getDate() + 3); // 시작일 + 3일
    deadlineDate.setHours(23, 59, 59, 999); // 마감일 자정 직전

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = deadlineDate.getTime() - now;

      if (distance > 0) {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setCountdown({ days, hours, minutes, seconds });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  // 7일 타임라인 날짜 생성
  const timelineDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const isToday = date.getTime() === today.getTime();
      const isPast = date.getTime() < today.getTime();

      dates.push({
        date,
        label: isToday ? "Today" : formatDateShort(date),
        isToday,
        isPast,
      });
    }
    return dates;
  }, [startDate]);

  // 현재 미션 인덱스 찾기
  const getCurrentMissionIndex = (): number => {
    for (let i = 0; i < filteredMissions.length; i++) {
      if (!completedMissions[filteredMissions[i].id]) {
        return i;
      }
    }
    return filteredMissions.length;
  };

  const currentMissionIndex = getCurrentMissionIndex();
  const currentMission = filteredMissions[currentMissionIndex];
  const isAllComplete = currentMissionIndex >= filteredMissions.length;
  const activeMission = activeMissionId
    ? filteredMissions.find((m) => m.id === activeMissionId)
    : null;
  const selectedMission = filteredMissions[selectedMissionIndex];

  // 초기 선택 인덱스를 현재 미션으로 설정 + 자동 스크롤
  useEffect(() => {
    if (currentMissionIndex < filteredMissions.length) {
      setSelectedMissionIndex(currentMissionIndex);
      // DOM이 렌더링된 후 스크롤
      const timer = setTimeout(() => {
        const item = missionItemRefs.current[currentMissionIndex];
        const container = missionListRef.current;
        if (item && container) {
          const containerHeight = container.clientHeight;
          const itemTop = item.offsetTop;
          const itemHeight = item.clientHeight;
          const scrollTo = itemTop - (containerHeight / 2) + (itemHeight / 2);
          container.scrollTo({ top: scrollTo, behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentMissionIndex, filteredMissions.length]);

  // 선택된 미션을 중앙으로 스크롤
  const scrollToCenter = useCallback((index: number) => {
    const item = missionItemRefs.current[index];
    const container = missionListRef.current;
    if (item && container) {
      const containerHeight = container.clientHeight;
      const itemTop = item.offsetTop;
      const itemHeight = item.clientHeight;
      const scrollTo = itemTop - (containerHeight / 2) + (itemHeight / 2);
      container.scrollTo({ top: scrollTo, behavior: 'smooth' });
    }
  }, []);

  // 미션 선택 핸들러
  const handleSelectMission = useCallback((index: number) => {
    setSelectedMissionIndex(index);
    scrollToCenter(index);
  }, [scrollToCenter]);

  // 진행 상태 저장
  const saveProgress = useCallback(
    async (newStatus: Record<string, boolean>) => {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ action_plan_status: newStatus })
        .eq("id", profile.id);
    },
    [profile.id]
  );

  // 미션 시작하기 (리스트 접고 폼 슬라이드 인)
  const handleStartMission = (missionId: string) => {
    setIsListCollapsed(true);
    setTimeout(() => {
      setActiveMissionId(missionId);
      setIsViewEntering(true);
      setTimeout(() => {
        setIsViewEntering(false);
      }, 300);
    }, 200);
  };

  // 미션 접기 (폼 나가고 리스트 펼침)
  const handleCollapseMission = () => {
    setIsViewExiting(true);
    setTimeout(() => {
      setActiveMissionId(null);
      setIsViewExiting(false);
      setIsListCollapsed(false);
      setIsViewEntering(true);
      setTimeout(() => {
        setIsViewEntering(false);
      }, 300);
    }, 250);
  };

  // 재무 탭으로 이동 (finance 타입)
  const handleGoToFinanceTab = (link: string) => {
    window.location.hash = link;
  };

  // 미션 완료
  const handleCompleteMission = (missionId: string) => {
    const newStatus = { ...completedMissions, [missionId]: true };
    setCompletedMissions(newStatus);

    // 다음 미션 인덱스 계산
    let nextMissionIndex = filteredMissions.length;
    for (let i = 0; i < filteredMissions.length; i++) {
      if (!newStatus[filteredMissions[i].id]) {
        nextMissionIndex = i;
        break;
      }
    }

    // 애니메이션과 함께 리스트로 돌아가기
    setIsViewExiting(true);
    setTimeout(() => {
      setActiveMissionId(null);
      setIsViewExiting(false);
      setIsListCollapsed(false);
      setIsViewEntering(true);

      // 다음 미션으로 선택 및 스크롤
      if (nextMissionIndex < filteredMissions.length) {
        setSelectedMissionIndex(nextMissionIndex);
        setTimeout(() => {
          scrollToCenter(nextMissionIndex);
        }, 100);
      }

      setTimeout(() => {
        setIsViewEntering(false);
      }, 300);
    }, 250);

    // 백그라운드에서 저장
    saveProgress(newStatus);
  };

  // 메시지로 이동
  const handleOpenChat = () => {
    window.location.hash = "messages";
  };

  // 전문가 프로필 패널 닫기 (애니메이션 포함)
  const handleCloseExpertProfile = useCallback(() => {
    setIsProfileClosing(true);
    setTimeout(() => {
      setShowExpertProfile(false);
      setIsProfileClosing(false);
    }, 250); // 애니메이션 시간
  }, []);

  // ESC 키로 프로필 패널 닫기
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showExpertProfile && !isProfileClosing) {
        handleCloseExpertProfile();
      }
    };

    if (showExpertProfile) {
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [showExpertProfile, isProfileClosing, handleCloseExpertProfile]);

  // ESC 키로 미션 폼에서 돌아가기
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeMissionId && !isViewExiting) {
        handleCollapseMission();
      }
    };

    if (activeMissionId) {
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [activeMissionId, isViewExiting]);

  // 미션 상세 뷰 (시작하기 클릭 시)
  if (activeMission) {
    const missionIndex = filteredMissions.findIndex(
      (m) => m.id === activeMission.id
    );

    // 질문이 정의된 미션: 폼으로 한 번에 보여주기
    // 부동산 미션은 전용 폼 사용
    const isRealEstateMission = activeMission.id === "realestate-residence";
    const isResidenceMission = activeMission.id === "realestate-residence";
    // 금융자산 미션
    const isSavingsMission = activeMission.id === "assets";

    if (isRealEstateMission) {
      const missionViewClass = `${styles.surveyFullContainer} ${
        isViewExiting ? styles.viewExitRight : ""
      } ${isViewEntering ? styles.viewEnterFromRight : ""}`;

      const handleRealEstateComplete = async (data: RealEstateFormData[]) => {
        if (!simulation?.id) return;

        // 기존 부동산 삭제 (해당 타입만)
        const existingIds = realEstates
          .filter((re) =>
            isResidenceMission
              ? re.type === "residence"
              : re.type !== "residence"
          )
          .map((re) => re.id);

        for (const id of existingIds) {
          await deleteRealEstate(id);
        }

        // 새 부동산 저장
        for (const property of data) {
          await createRealEstate({
            simulation_id: simulation.id,
            type: property.type,
            title:
              property.title ||
              (isResidenceMission
                ? property.housing_type === "자가"
                  ? "자가 주택"
                  : property.housing_type === "전세"
                  ? "전세 주택"
                  : "월세 주택"
                : `투자 부동산`),
            owner: property.owner,
            current_value: property.current_value,
            purchase_price: property.purchase_price,
            purchase_year: property.purchase_year,
            purchase_month: property.purchase_month,
            growth_rate: property.growth_rate ?? 3,
            housing_type: property.housing_type,
            deposit: property.deposit,
            monthly_rent: property.monthly_rent,
            maintenance_fee: property.maintenance_fee,
            has_loan: property.has_loan,
            loan_amount: property.loan_amount,
            loan_rate: property.loan_rate,
            loan_rate_type: property.loan_rate_type,
            loan_start_year: property.loan_start_year,
            loan_start_month: property.loan_start_month,
            loan_maturity_year: property.loan_maturity_year,
            loan_maturity_month: property.loan_maturity_month,
            loan_repayment_type: property.loan_repayment_type,
            has_rental_income: property.has_rental_income,
            rental_monthly: property.rental_monthly,
          });
        }

        // 부동산 목록 새로고침
        const updated = await getRealEstates(simulation.id);
        setRealEstates(updated);

        // React Query 캐시 무효화 (부동산 탭에서 최신 데이터 표시되도록)
        invalidateByCategory('realEstates');

        // 서버 컴포넌트 데이터 새로고침
        router.refresh();

        handleCompleteMission(activeMission.id);
      };

      return (
        <div className={missionViewClass}>
          <RealEstateInputForm
            missionType={isResidenceMission ? "residence" : "investment"}
            missionNumber={missionIndex + 1}
            simulationId={simulation?.id || ""}
            existingData={realEstates}
            onComplete={handleRealEstateComplete}
            onSkip={() => handleCompleteMission(activeMission.id)}
            onBack={handleCollapseMission}
          />
        </div>
      );
    }

    // 금융자산 미션은 전용 폼 사용
    if (isSavingsMission) {
      const missionViewClass = `${styles.surveyFullContainer} ${
        isViewExiting ? styles.viewExitRight : ""
      } ${isViewEntering ? styles.viewEnterFromRight : ""}`;

      const handleSavingsComplete = async (data: SavingsFormData[]) => {
        if (!simulation?.id) return;

        // 기존 금융자산 모두 삭제
        for (const existing of savings) {
          await deleteSavings(existing.id);
        }

        // 새 금융자산 저장
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          await createSavings({
            simulation_id: simulation.id,
            type: item.type,
            title: item.title || getDefaultSavingsTitle(item.type),
            owner: item.owner,
            current_balance: item.current_balance,
            monthly_contribution: item.monthly_contribution,
            contribution_start_year: item.contribution_start_year,
            contribution_start_month: item.contribution_start_month,
            contribution_end_year: item.contribution_end_year,
            contribution_end_month: item.contribution_end_month,
            is_contribution_fixed_to_retirement: item.is_contribution_fixed_to_retirement,
            interest_rate: item.interest_rate,
            expected_return: item.expected_return,
            maturity_year: item.maturity_year,
            maturity_month: item.maturity_month,
            sort_order: i,
          });
        }

        // 금융자산 목록 새로고침
        const updated = await getSavings(simulation.id);
        setSavings(updated);

        // React Query 캐시 무효화
        invalidateByCategory('savings');

        // 서버 컴포넌트 데이터 새로고침
        router.refresh();

        handleCompleteMission(activeMission.id);
      };

      return (
        <div className={missionViewClass}>
          <SavingsInputForm
            missionType="all"
            missionNumber={missionIndex + 1}
            simulationId={simulation?.id || ""}
            existingData={savings}
            onComplete={handleSavingsComplete}
            onSkip={() => handleCompleteMission(activeMission.id)}
            onBack={handleCollapseMission}
          />
        </div>
      );
    }

    const missionQuestions = getQuestionsForMission(activeMission.id);
    const hasQuestions = missionQuestions.length > 0;

    if (hasQuestions) {
      // 가족 구성은 특별한 폼 사용
      if (activeMission.id === "family-composition") {
        const spouse = familyMembers.find((m) => m.relationship === "spouse");
        const children = familyMembers.filter(
          (m) => m.relationship === "child"
        );
        const parents = familyMembers.filter(
          (m) => m.relationship === "parent"
        );

        const initialFamilyData = {
          spouse: spouse?.birth_date
            ? {
                birthYear: new Date(spouse.birth_date).getFullYear(),
                birthMonth: new Date(spouse.birth_date).getMonth() + 1,
              }
            : null,
          children: children
            .filter((c) => c.birth_date)
            .map((c) => ({
              gender: (c.gender === "male" ? "son" : "daughter") as
                | "son"
                | "daughter",
              birthYear: new Date(c.birth_date!).getFullYear(),
              birthMonth: new Date(c.birth_date!).getMonth() + 1,
            })),
          parents: parents
            .filter((p) => p.birth_date)
            .map((p) => ({
              birthYear: new Date(p.birth_date!).getFullYear(),
              birthMonth: new Date(p.birth_date!).getMonth() + 1,
            })),
        };

        const missionViewClass = `${styles.surveyFullContainer} ${
          isViewExiting ? styles.viewExitRight : ""
        } ${isViewEntering ? styles.viewEnterFromRight : ""}`;

        return (
          <div className={missionViewClass}>
            <FamilyForm
              missionNumber={missionIndex + 1}
              initialData={initialFamilyData}
              onBack={handleCollapseMission}
              onComplete={async (data) => {
                const supabase = createClient();

                // 1. 기존 가족 구성원 삭제
                await supabase
                  .from("family_members")
                  .delete()
                  .eq("user_id", profile.id);

                // 2. 새 가족 구성원 추가
                const newFamilyMembers = [];

                // 배우자 추가
                if (data.spouse) {
                  const birthDate = `${data.spouse.birthYear}-${String(
                    data.spouse.birthMonth
                  ).padStart(2, "0")}-01`;
                  newFamilyMembers.push({
                    user_id: profile.id,
                    relationship: "spouse",
                    name: "배우자",
                    birth_date: birthDate,
                  });
                }

                // 자녀 추가
                for (const child of data.children) {
                  const birthDate = `${child.birthYear}-${String(
                    child.birthMonth
                  ).padStart(2, "0")}-01`;
                  newFamilyMembers.push({
                    user_id: profile.id,
                    relationship: "child",
                    name: child.gender === "son" ? "아들" : "딸",
                    birth_date: birthDate,
                    gender: child.gender === "son" ? "male" : "female",
                  });
                }

                // 부양 부모 추가
                for (let i = 0; i < data.parents.length; i++) {
                  const parent = data.parents[i];
                  const birthDate = `${parent.birthYear}-${String(
                    parent.birthMonth
                  ).padStart(2, "0")}-01`;
                  newFamilyMembers.push({
                    user_id: profile.id,
                    relationship: "parent",
                    name: `부모님 ${i + 1}`,
                    birth_date: birthDate,
                    is_dependent: true,
                  });
                }

                if (newFamilyMembers.length > 0) {
                  await supabase
                    .from("family_members")
                    .insert(newFamilyMembers);
                }

                // 서버 컴포넌트 데이터 새로고침
                router.refresh();

                handleCompleteMission(activeMission.id);
              }}
              onSkip={() => handleCompleteMission(activeMission.id)}
            />
          </div>
        );
      }

      // 일반 설문
      const initialValues = getInitialValuesForMission(
        activeMission.id,
        profile,
        familyMembers
      );

      // 투자 성향은 스텝 방식으로
      if (activeMission.id === "investment-style") {
        const stepMissionViewClass = `${styles.surveyFullContainer} ${
          isViewExiting ? styles.viewExitRight : ""
        } ${isViewEntering ? styles.viewEnterFromRight : ""}`;

        return (
          <div className={stepMissionViewClass}>
            <StepMissionForm
              missionNumber={missionIndex + 1}
              title={activeMission.label}
              questions={getQuestionsForMission(activeMission.id)}
              questionsPerPage={2}
              initialValues={initialValues}
              onBack={handleCollapseMission}
              onComplete={async (answers, calculatedType) => {
                // 투자 프로필 저장
                const supabase = createClient();
                await supabase
                  .from("profiles")
                  .update({
                    investment_profile: {
                      type: calculatedType,
                      answers,
                      updatedAt: new Date().toISOString(),
                    },
                  })
                  .eq("id", profile.id);

                // 서버 컴포넌트 데이터 새로고침
                router.refresh();

                handleCompleteMission(activeMission.id);
              }}
              onSkip={() => handleCompleteMission(activeMission.id)}
            />
          </div>
        );
      }

      const generalMissionViewClass = `${styles.surveyFullContainer} ${
        isViewExiting ? styles.viewExitRight : ""
      } ${isViewEntering ? styles.viewEnterFromRight : ""}`;

      return (
        <div className={generalMissionViewClass}>
          <MissionForm
            missionNumber={missionIndex + 1}
            title={activeMission.label}
            questions={getQuestionsForMission(activeMission.id)}
            initialValues={initialValues}
            onBack={handleCollapseMission}
            onComplete={async (answers) => {
              const supabase = createClient();

              // 은퇴 목표 설정 저장
              if (activeMission.id === "retirement-goal") {
                const retirementAge = answers[
                  "target-retirement-age"
                ] as string;
                const lifestyleRatio = answers[
                  "retirement-lifestyle"
                ] as string;
                await supabase
                  .from("profiles")
                  .update({
                    target_retirement_age: retirementAge
                      ? parseInt(retirementAge)
                      : null,
                    retirement_lifestyle_ratio: lifestyleRatio
                      ? parseInt(lifestyleRatio)
                      : 80,
                  })
                  .eq("id", profile.id);
              } else {
                // 기타 설문 응답은 survey_responses에 저장
                const existingResponses = profile.survey_responses || {};
                await supabase
                  .from("profiles")
                  .update({
                    survey_responses: {
                      ...existingResponses,
                      [activeMission.id]: answers,
                    },
                  })
                  .eq("id", profile.id);
              }

              // 서버 컴포넌트 데이터 새로고침
              router.refresh();

              handleCompleteMission(activeMission.id);
            }}
            onSkip={() => handleCompleteMission(activeMission.id)}
          />
        </div>
      );
    }

    // 재무 입력 타입: 기존 상세 뷰
    const financeMissionViewClass = `${styles.container} ${
      isViewExiting ? styles.viewExitRight : ""
    } ${isViewEntering ? styles.viewEnterFromRight : ""}`;

    return (
      <div className={financeMissionViewClass}>
        <div className={styles.missionDetailHeader}>
          <button className={styles.backButton} onClick={handleCollapseMission}>
            <ChevronLeft size={20} />
            <span>돌아가기</span>
          </button>
          <div className={styles.missionProgress}>
            <span>
              {missionIndex + 1} / {filteredMissions.length}
            </span>
          </div>
        </div>

        <div className={styles.missionDetailContent}>
          <div className={styles.missionDetailInfo}>
            <span className={styles.missionDetailType}>재무 입력</span>
            <h1 className={styles.missionDetailTitle}>{activeMission.label}</h1>
            <p className={styles.missionDetailDesc}>
              {activeMission.description}
            </p>
          </div>

          <div className={styles.missionDetailBody}>
            <div className={styles.financeContainer}>
              <div className={styles.financeInfoCard}>
                <h3>입력 안내</h3>
                <p>
                  아래 버튼을 클릭하면 {activeMission.label} 탭으로 이동합니다.
                  입력을 완료한 후 이곳으로 돌아와 완료 버튼을 눌러주세요.
                </p>
              </div>
              <div className={styles.missionDetailActions}>
                <button
                  className={styles.primaryButton}
                  onClick={() => handleGoToFinanceTab(activeMission.link!)}
                >
                  {activeMission.label} 탭으로 이동
                  <ChevronRight size={18} />
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={() => handleCompleteMission(activeMission.id)}
                >
                  완료하기
                </button>
              </div>
            </div>
          </div>

          <div className={styles.missionDetailTip}>
            <div className={styles.tipHeader}>
              <div className={styles.expertAvatarSmall}>손</div>
              <span className={styles.tipFrom}>손균우 자산관리사의 TIP</span>
            </div>
            <p className={styles.tipBody}>{activeMission.tip}</p>
          </div>
        </div>
      </div>
    );
  }

  // 미션 리스트 뷰 (기본)
  const mainViewClass = `${styles.container} ${
    isViewExiting ? styles.viewExitLeft : ""
  } ${isViewEntering ? styles.viewEnterFromLeft : ""}`;

  // 메시지 시간 포맷
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className={mainViewClass}>
      {/* 상단: 카운트다운 + 메시지 배너 */}
      <div className={styles.topBanner}>
        {/* 왼쪽: 카운트다운 */}
        <div className={styles.countdownSection}>
          <span className={styles.countdownLabel}>재무 입력 마감까지</span>
          <div className={styles.countdownTimer}>
            <div className={styles.countdownItem}>
              <span className={styles.countdownNumber}>{countdown.days}</span>
              <span className={styles.countdownUnit}>일</span>
            </div>
            <div className={styles.countdownItem}>
              <span className={styles.countdownNumber}>{String(countdown.hours).padStart(2, '0')}</span>
              <span className={styles.countdownUnit}>시간</span>
            </div>
            <div className={styles.countdownItem}>
              <span className={styles.countdownNumber}>{String(countdown.minutes).padStart(2, '0')}</span>
              <span className={styles.countdownUnit}>분</span>
            </div>
            <div className={styles.countdownItem}>
              <span className={styles.countdownNumber}>{String(countdown.seconds).padStart(2, '0')}</span>
              <span className={styles.countdownUnit}>초</span>
            </div>
          </div>
        </div>

        {/* 오른쪽: 메시지 */}
        {isMessageLoading ? (
          <div className={styles.messageBannerSkeleton}>
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonLine} style={{ width: '120px' }} />
              <div className={styles.skeletonLine} style={{ width: '200px' }} />
            </div>
          </div>
        ) : latestMessage ? (
          <button className={styles.messageBanner} onClick={handleOpenChat}>
            <div className={styles.messageBannerAvatar}>
              {latestMessage.expertName.charAt(0)}
            </div>
            <div className={styles.messageBannerContent}>
              <div className={styles.messageBannerHeader}>
                <span className={styles.messageBannerName}>{latestMessage.expertName}</span>
                <span className={styles.messageBannerTime}>{formatMessageTime(latestMessage.message.created_at)}</span>
              </div>
              <p className={styles.messageBannerText}>
                {latestMessage.message.content}
              </p>
            </div>
          </button>
        ) : null}
      </div>

      {/* 메인: 왼쪽 미션 리스트 + 오른쪽 상세 */}
      <div className={`${styles.mainContent} ${isListCollapsed ? styles.listCollapsed : ''}`}>
        {/* 왼쪽: 미션 리스트 */}
        <div className={`${styles.missionListSection} ${isListCollapsed ? styles.collapsed : ''}`}>
          {/* 진행률 헤더 */}
          <div className={styles.progressHeader}>
            <span className={styles.progressText}>검진 준비</span>
            <span className={styles.progressCount}>
              <strong>{Object.values(completedMissions).filter(Boolean).length}</strong> / {filteredMissions.length}
            </span>
          </div>
          <div className={styles.missionListWrapper} ref={missionListRef}>
            <div className={styles.missionListInner}>
              {filteredMissions.map((mission, index) => {
                const isCompleted = completedMissions[mission.id];
                const isSelected = index === selectedMissionIndex;

                // 카테고리 헤더 표시 여부
                const prevMission = index > 0 ? filteredMissions[index - 1] : null;
                const showCategoryHeader = !prevMission || prevMission.category !== mission.category;

                return (
                  <div key={mission.id}>
                    {showCategoryHeader && (
                      <div className={styles.categoryHeader}>
                        <span className={styles.categoryLabel}>{CATEGORY_INFO[mission.category].label}</span>
                      </div>
                    )}
                    <button
                      ref={(el) => { missionItemRefs.current[index] = el; }}
                      className={`${styles.missionListItem} ${isSelected ? styles.selected : ''} ${isCompleted ? styles.completed : ''}`}
                      onClick={() => handleSelectMission(index)}
                    >
                      <span className={styles.missionText}>
                        {mission.label}
                      </span>
                      {isCompleted && <Check size={14} className={styles.checkIcon} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 오른쪽: 미션 상세 */}
        <div className={styles.missionDetailSection}>
          {selectedMission && (
            <>
              <div className={styles.detailHeader}>
                <span className={styles.detailLabel}>{selectedMissionIndex + 1}번째 항목</span>
                <h2 className={styles.detailTitle}>{selectedMission.label}</h2>
              </div>

              <p className={styles.detailDesc}>{selectedMission.description}</p>

              <button
                className={styles.startButton}
                onClick={() => handleStartMission(selectedMission.id)}
              >
                {completedMissions[selectedMission.id] ? '다시 입력하기' : '시작하기'}
                <ChevronRight size={18} />
              </button>
            </>
          )}

          {isAllComplete && !selectedMission && (
            <div className={styles.allCompleteMessage}>
              <div className={styles.completeIcon}>
                <Check size={32} />
              </div>
              <h3>모든 입력 완료</h3>
              <p>전문가 분석이 진행 중입니다</p>
            </div>
          )}
        </div>
      </div>

      {/* 전문가 프로필 슬라이드 패널 */}
      {showExpertProfile && (
        <>
          <div
            className={`${styles.profileOverlay} ${
              isProfileClosing ? styles.overlayClosing : ""
            }`}
            onClick={handleCloseExpertProfile}
          />
          <div
            className={`${styles.profilePanel} ${
              isProfileClosing ? styles.panelClosing : ""
            }`}
          >
            <div className={styles.profileHeader}>
              <h2 className={styles.profileHeaderTitle}>
                담당 자산관리사 소개
              </h2>
              <button
                className={styles.profileCloseButton}
                onClick={handleCloseExpertProfile}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.profileContent}>
              {/* 프로필 상단 */}
              <div className={styles.profileTop}>
                <div className={styles.profileAvatarLarge}>손</div>
                <div className={styles.profileNameSection}>
                  <h3 className={styles.profileName}>{expertProfile.name}</h3>
                  <span className={styles.profileTitle}>
                    {expertProfile.title}
                  </span>
                </div>
              </div>

              {/* 통계 */}
              <div className={styles.profileStats}>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>
                    {expertProfile.stats.experience}
                  </span>
                  <span className={styles.statLabel}>경력</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>
                    {expertProfile.stats.clients}
                  </span>
                  <span className={styles.statLabel}>상담 고객</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>
                    {expertProfile.stats.satisfaction}
                  </span>
                  <span className={styles.statLabel}>만족도</span>
                </div>
              </div>

              {/* 소개 */}
              <p className={styles.profileIntro}>
                {expertProfile.introduction}
              </p>

              {/* 자격증 */}
              <div className={styles.profileSection}>
                <div className={styles.sectionHeader}>
                  <Award size={16} />
                  <span>자격 및 면허</span>
                </div>
                <div className={styles.credentialList}>
                  {expertProfile.credentials.map((cred, i) => (
                    <div key={i} className={styles.credentialItem}>
                      <Shield size={14} />
                      <span>{cred.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 학력 */}
              <div className={styles.profileSection}>
                <div className={styles.sectionHeader}>
                  <GraduationCap size={16} />
                  <span>학력</span>
                </div>
                <div className={styles.educationList}>
                  {expertProfile.education.map((edu, i) => (
                    <div key={i} className={styles.educationItem}>
                      {edu.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* 경력 */}
              <div className={styles.profileSection}>
                <div className={styles.sectionHeader}>
                  <Briefcase size={16} />
                  <span>주요 경력</span>
                </div>
                <div className={styles.careerList}>
                  {expertProfile.career.map((job, i) => (
                    <div key={i} className={styles.careerItem}>
                      <span className={styles.careerPeriod}>{job.period}</span>
                      <span className={styles.careerRole}>{job.role}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 전문 분야 */}
              <div className={styles.profileSection}>
                <div className={styles.sectionHeader}>
                  <span>전문 분야</span>
                </div>
                <div className={styles.specialtyTags}>
                  {expertProfile.specialties.map((specialty, i) => (
                    <span key={i} className={styles.specialtyTag}>
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 하단 버튼 - 고정 */}
            <div className={styles.profileActions}>
              <button
                className={styles.profileMessageButton}
                onClick={() => {
                  handleCloseExpertProfile();
                  setTimeout(() => handleOpenChat(), 250);
                }}
              >
                <MessageCircle size={18} />
                메시지 보내기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
