"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageCircle,
  ArrowLeft,
  ChevronRight,
  Home,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ChatRoom,
  PrepTaskCard,
  CompletedItems,
  FamilyInputForm,
  HousingInputForm,
  FinancialAssetInputForm,
  IncomeInputForm,
  ProgramDetailView,
  type PrepTask,
  type CompletedTask,
} from "./components";
import { getTotalUnreadCount } from "@/lib/services/messageService";
import { loadPrepData, saveFamilyData, saveHousingData, saveFinancialData, saveIncomeData, getNextTaskIndex } from "./services/prepDataService";
import type { PrepData, PrepTaskId, FamilyMember, HousingData, FinancialAssetItem } from "./types";
import type { IncomeFormData } from "./components";
import styles from "./waiting.module.css";

// Suspense로 감싸기 위한 wrapper
export default function WaitingPage() {
  return (
    <Suspense fallback={<WaitingPageLoading />}>
      <WaitingPageContent />
    </Suspense>
  );
}

function WaitingPageLoading() {
  return (
    <div className={styles.container}>
      {/* 스켈레톤 헤더 */}
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonLogo} />
      </div>
      {/* 스켈레톤 예약 정보 */}
      <div className={styles.skeletonBooking}>
        <div className={styles.skeletonText} style={{ width: 80 }} />
        <div className={styles.skeletonText} style={{ width: 140 }} />
      </div>
      {/* 스켈레톤 메인 */}
      <main className={styles.skeletonMain}>
        {/* 카드 스켈레톤 */}
        <div className={styles.skeletonCard}>
          <div className={styles.skeletonCardHeader}>
            <div className={styles.skeletonBadge} />
            <div className={styles.skeletonText} style={{ width: 60 }} />
          </div>
          <div className={styles.skeletonText} style={{ width: "70%" }} />
          <div className={styles.skeletonText} style={{ width: "50%" }} />
          <div className={styles.skeletonButton} />
        </div>
      </main>
    </div>
  );
}

interface BookingInfo {
  date: string;
  time: string;
  expert: string;
  booked_at: string;
}

interface SurveyResponses {
  marital_status?: string;
  children?: string;
  income_range?: string;
  monthly_expense?: string;
  monthly_investment?: string;
  investment_exp?: string[];
  pension_awareness?: string;
}

interface Profile {
  name: string;
  booking_info: BookingInfo | null;
  survey_responses: {
    onboarding?: SurveyResponses;
  } | null;
}

type Tab = "checkup" | "chat";

// 검진 전 준비 항목 (순서대로 진행)
const PREP_TASKS: PrepTask[] = [
  {
    id: "family",
    title: "가계 구성",
    description: "배우자, 자녀, 부양 부모님 정보를 확인해주세요.",
    status: "pending",
  },
  {
    id: "housing",
    title: "거주 부동산",
    description: "현재 거주 형태와 관련 대출 정보를 입력해주세요.",
    status: "pending",
  },
  {
    id: "financial",
    title: "금융 자산",
    description: "저축 계좌, 투자 계좌 정보를 입력해주세요.",
    status: "pending",
  },
  {
    id: "debt",
    title: "부채",
    description: "보유 중인 대출 정보를 입력해주세요.",
    status: "pending",
  },
  {
    id: "income",
    title: "소득",
    description: "본인과 배우자의 소득 정보를 입력해주세요.",
    status: "pending",
  },
  {
    id: "pension",
    title: "연금",
    description: "국민연금, 퇴직연금, 개인연금 정보를 입력해주세요.",
    status: "pending",
  },
  {
    id: "expense",
    title: "지출",
    description: "월 생활비를 입력해주세요.",
    status: "pending",
  },
];

function WaitingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    return tab === "chat" ? "chat" : "checkup";
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeInputForm, setActiveInputForm] = useState<PrepTaskId | null>(null);
  const [showProgramDetail, setShowProgramDetail] = useState(false);
  const [toast, setToast] = useState<{ message: string; subMessage?: string } | null>(null);

  // 준비사항 데이터 (통합)
  const [prepData, setPrepData] = useState<PrepData | null>(null);

  // 완료 상태에서 파생되는 값들
  const currentTaskIndex = useMemo(() => {
    if (!prepData) return 0;
    return getNextTaskIndex(prepData.completed);
  }, [prepData]);

  const completedTasks = useMemo((): CompletedTask[] => {
    if (!prepData) return [];
    const tasks: CompletedTask[] = [];
    const order: PrepTaskId[] = ["family", "housing", "financial", "debt", "income", "pension", "expense"];

    order.forEach((taskId, index) => {
      if (prepData.completed[taskId]) {
        const task = PREP_TASKS.find(t => t.id === taskId);
        if (task) {
          tasks.push({ id: taskId, title: task.title, stepNumber: index + 1 });
        }
      }
    });
    return tasks;
  }, [prepData]);

  // 탭 변경 시 URL 업데이트
  const handleTabChange = async (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "chat") {
      router.push("/waiting?tab=chat", { scroll: false });
    } else {
      router.push("/waiting", { scroll: false });
      const unread = await getTotalUnreadCount();
      setUnreadCount(unread);
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "name, booking_info, pin_hash, onboarding_step, phone_number, pin_verified_at, survey_responses"
        )
        .eq("id", user.id)
        .single();

      if (!profileData?.pin_hash) {
        router.replace("/auth/pin-setup");
        return;
      }

      if (profileData?.onboarding_step !== "completed") {
        router.replace("/onboarding");
        return;
      }

      if (!profileData?.phone_number) {
        router.replace("/auth/phone-verify");
        return;
      }

      const PIN_TIMEOUT_MINUTES = 30;
      const pinVerifiedAt = profileData?.pin_verified_at;
      if (!pinVerifiedAt) {
        router.replace("/auth/pin-verify");
        return;
      }
      const minutesSinceVerified =
        (Date.now() - new Date(pinVerifiedAt).getTime()) / 1000 / 60;
      if (minutesSinceVerified > PIN_TIMEOUT_MINUTES) {
        router.replace("/auth/pin-verify");
        return;
      }

      if (profileData) {
        setProfile(profileData as Profile);
      }
      setUserId(user.id);

      // 준비사항 데이터 로드 (통합)
      const data = await loadPrepData(user.id);
      setPrepData(data);

      const unread = await getTotalUnreadCount();
      setUnreadCount(unread);

      setLoading(false);
    };

    loadProfile();
  }, [router]);

  // 토스트 표시
  const showToast = (message: string, subMessage?: string) => {
    setToast({ message, subMessage });
    setTimeout(() => setToast(null), 3000);
  };

  // 회원 탈퇴 (테스트용)
  const handleDeleteAccount = async () => {
    if (!confirm("정말 탈퇴하시겠습니까?\n모든 데이터가 삭제됩니다.")) return;
    await fetch("/api/auth/delete-account", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  // 입력 폼 시작
  const handleStartTask = (taskId: string) => {
    setActiveInputForm(taskId as PrepTaskId);
  };

  // 데이터 저장 완료 처리
  const handleSaveComplete = async (taskId: PrepTaskId, isFirstSave: boolean) => {
    if (!prepData || !userId) return;

    // prepData 다시 로드 (DB에서 최신 데이터 가져오기)
    const updatedData = await loadPrepData(userId);
    setPrepData(updatedData);

    // 토스트 표시
    if (isFirstSave) {
      const nextIndex = getNextTaskIndex(updatedData.completed);
      const nextTask = PREP_TASKS[nextIndex];
      if (nextTask) {
        showToast("저장되었습니다", `다음: ${nextTask.title}`);
      } else {
        showToast("모든 준비가 완료되었습니다!");
      }
    } else {
      showToast("저장되었습니다");
    }

    setActiveInputForm(null);
  };

  // 입력 폼 닫기 (저장 없이)
  const handleCloseInputForm = () => {
    setActiveInputForm(null);
  };

  // 수정하기
  const handleEditTask = (taskId: string) => {
    setActiveInputForm(taskId as PrepTaskId);
  };

  const formatBookingDate = (dateStr: string, timeStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];

    return `${month}월 ${day}일 (${weekday}) ${timeStr}`;
  };

  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        {/* 스켈레톤 헤더 */}
        <div className={styles.skeletonHeader}>
          <div className={styles.skeletonLogo} />
        </div>
        {/* 스켈레톤 예약 정보 */}
        <div className={styles.skeletonBooking}>
          <div className={styles.skeletonText} style={{ width: 80, marginBottom: 0 }} />
          <div className={styles.skeletonText} style={{ width: 140, marginBottom: 0 }} />
        </div>
        {/* 스켈레톤 메인 */}
        <main className={styles.skeletonMain}>
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonCardHeader}>
              <div className={styles.skeletonBadge} />
              <div className={styles.skeletonText} style={{ width: 60, marginBottom: 0 }} />
            </div>
            <div className={styles.skeletonText} style={{ width: "70%" }} />
            <div className={styles.skeletonText} style={{ width: "50%" }} />
            <div className={styles.skeletonButton} />
          </div>
        </main>
      </div>
    );
  }

  const bookingInfo = profile?.booking_info;
  const daysUntil = bookingInfo ? getDaysUntil(bookingInfo.date) : 0;
  const surveyResponses = profile?.survey_responses?.onboarding;

  // 채팅 탭 - 전체 화면
  if (activeTab === "chat") {
    return (
      <div className={styles.chatContainer}>
        <header className={styles.chatHeader}>
          <button
            className={styles.backButton}
            onClick={() => handleTabChange("checkup")}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.chatHeaderTitle}>
            담당: {bookingInfo?.expert || "전문가"}
          </h1>
          <div className={styles.headerSpacer} />
        </header>

        <div className={styles.chatMain}>
          {userId && <ChatRoom userId={userId} />}
        </div>
      </div>
    );
  }

  // 검진 프로그램 상세
  if (showProgramDetail && bookingInfo) {
    return (
      <ProgramDetailView
        bookingInfo={bookingInfo}
        onClose={() => setShowProgramDetail(false)}
      />
    );
  }

  // 가계 구성 입력 폼
  if (activeInputForm === "family" && prepData) {
    const isCompleted = prepData.completed.family;
    return (
      <FamilyInputForm
        taskId="family"
        initialData={prepData.family}
        isCompleted={isCompleted}
        onClose={handleCloseInputForm}
        onSave={async (data: FamilyMember[]) => {
          if (!userId) return;
          await saveFamilyData(userId, data);
          await handleSaveComplete("family", !isCompleted);
        }}
        surveyMaritalStatus={surveyResponses?.marital_status}
        surveyChildren={surveyResponses?.children}
      />
    );
  }

  // 거주 부동산 입력 폼
  if (activeInputForm === "housing" && prepData) {
    const isCompleted = prepData.completed.housing;
    return (
      <HousingInputForm
        initialData={prepData.housing}
        isCompleted={isCompleted}
        onClose={handleCloseInputForm}
        onSave={async (data: HousingData) => {
          if (!userId) return;
          await saveHousingData(userId, data);
          await handleSaveComplete("housing", !isCompleted);
        }}
      />
    );
  }

  // 금융 자산 입력 폼
  if (activeInputForm === "financial" && prepData) {
    const isCompleted = prepData.completed.financial;
    const hasSpouse = prepData.family.some(m => m.relationship === "spouse");
    return (
      <FinancialAssetInputForm
        hasSpouse={hasSpouse}
        initialData={prepData.financial}
        isCompleted={isCompleted}
        onClose={handleCloseInputForm}
        onSave={async (data: FinancialAssetItem[]) => {
          if (!userId) return;
          await saveFinancialData(userId, data);
          await handleSaveComplete("financial", !isCompleted);
        }}
      />
    );
  }

  // 소득 입력 폼
  if (activeInputForm === "income" && prepData) {
    const isCompleted = prepData.completed.income;
    // 배우자 유무 확인
    const hasSpouse = prepData.family.some(m => m.relationship === "spouse");
    return (
      <IncomeInputForm
        hasSpouse={hasSpouse}
        initialData={null} // TODO: 기존 데이터 로드 구현
        isCompleted={isCompleted}
        onClose={handleCloseInputForm}
        onSave={async (data: IncomeFormData) => {
          if (!userId) return;
          await saveIncomeData(userId, data);
          await handleSaveComplete("income", !isCompleted);
        }}
        surveyIncomeRange={surveyResponses?.income_range}
      />
    );
  }

  // 다른 입력 폼들 (나중에 구현)
  if (activeInputForm) {
    return (
      <div className={styles.inputFormContainer}>
        <header className={styles.inputFormHeader}>
          <button className={styles.backButton} onClick={handleCloseInputForm}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.inputFormTitle}>
            {PREP_TASKS.find((t) => t.id === activeInputForm)?.title ||
              "정보 입력"}
          </h1>
          <div className={styles.headerSpacer} />
        </header>
        <div className={styles.inputFormMain}>
          <div className={styles.inputFormPlaceholder}>
            <p>{activeInputForm} 정보 입력 폼 (준비 중)</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 회원탈퇴 버튼 (테스트용) */}
      <button className={styles.deleteButton} onClick={handleDeleteAccount}>
        탈퇴
      </button>

      {/* 고정 헤더 영역 */}
      <div className={styles.fixedHeader}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>
            <span className={styles.headerLogo}>Lycon Finance Group</span>
          </h1>
        </header>

        {/* 예약 정보 */}
        {bookingInfo && (
          <button
            className={styles.bookingRow}
            onClick={() => setShowProgramDetail(true)}
          >
            <span className={styles.bookingLabel}>예약된 검진</span>
            <div className={styles.bookingRight}>
              <span className={styles.bookingValue}>
                {formatBookingDate(bookingInfo.date, bookingInfo.time)}
              </span>
              <ChevronRight size={20} className={styles.bookingArrow} />
            </div>
          </button>
        )}
      </div>

      <main className={styles.main}>
        <div className={styles.tabContent}>
          {/* 1. 검진 전 해야할 일 (1개씩) */}
          {currentTaskIndex < PREP_TASKS.length && (
            <PrepTaskCard
              task={PREP_TASKS[currentTaskIndex]}
              currentStep={currentTaskIndex + 1}
              totalSteps={PREP_TASKS.length}
              onStart={handleStartTask}
            />
          )}

          {/* 3. 입력 완료한 항목들 */}
          <CompletedItems tasks={completedTasks} onEdit={handleEditTask} />
        </div>
      </main>

      {/* 하단 네비게이션 */}
      <nav className={styles.bottomNav}>
        <button className={`${styles.navItem} ${styles.active}`}>
          <Home size={22} />
          <span>홈</span>
        </button>
        <button
          className={styles.navItem}
          onClick={() => handleTabChange("chat")}
        >
          <div className={styles.navIconWrapper}>
            <MessageCircle size={22} />
            {unreadCount > 0 && (
              <span className={styles.unreadBadge}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <span>담당: {bookingInfo?.expert || "전문가"}</span>
        </button>
      </nav>

      {/* 토스트 */}
      {toast && (
        <div className={styles.toast}>
          <span className={styles.toastMessage}>{toast.message}</span>
          {toast.subMessage && (
            <span className={styles.toastSub}>{toast.subMessage}</span>
          )}
        </div>
      )}
    </div>
  );
}
