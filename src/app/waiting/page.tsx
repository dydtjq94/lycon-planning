"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageCircle,
  ArrowLeft,
  ChevronRight,
  Home,
  Users,
  Building2,
  Wallet,
  Receipt,
  PiggyBank,
  TrendingUp,
  CreditCard,
  Shield,
  Briefcase,
  Heart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChatRoom, ProgramDetailView, Toast, TipModal } from "./components";
import { getTotalUnreadCount } from "@/lib/services/messageService";
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

interface Profile {
  name: string;
  booking_info: BookingInfo | null;
}

type Tab = "home" | "chat";

// 팁 카테고리 정의 (입력 폼 순서와 동일)
const TIP_CATEGORIES = [
  { id: "family", title: "가계 정보", icon: Users },
  { id: "housing", title: "거주용 부동산", icon: Building2 },
  { id: "savings", title: "저축", icon: PiggyBank },
  { id: "investment", title: "투자", icon: TrendingUp },
  { id: "debt", title: "부채", icon: CreditCard },
  { id: "income", title: "소득", icon: Wallet },
  { id: "nationalPension", title: "국민(공적)연금", icon: Shield },
  { id: "retirementPension", title: "퇴직연금/퇴직금", icon: Briefcase },
  { id: "personalPension", title: "개인연금", icon: Heart },
  { id: "expense", title: "지출", icon: Receipt },
];

function WaitingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    return tab === "chat" ? "chat" : "home";
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProgramDetail, setShowProgramDetail] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    subMessage?: string;
  } | null>(null);
  const [selectedTip, setSelectedTip] = useState<string | null>(null);
  const [tipModalKey, setTipModalKey] = useState(0);
  const [prepDataCategories, setPrepDataCategories] = useState<Set<string>>(new Set());

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
          "name, booking_info, pin_hash, onboarding_step, phone_number, pin_verified_at, prep_data",
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

      const PIN_TIMEOUT_MINUTES = 60;
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

        // prep_data에서 데이터가 있는 카테고리 추출
        if (profileData.prep_data && typeof profileData.prep_data === 'object') {
          const categories = new Set<string>();
          const prepData = profileData.prep_data as Record<string, unknown>;
          for (const [key, value] of Object.entries(prepData)) {
            if (value && (Array.isArray(value) ? value.length > 0 : Object.keys(value as object).length > 0)) {
              categories.add(key);
            }
          }
          setPrepDataCategories(categories);
        }
      }
      setUserId(user.id);

      const unread = await getTotalUnreadCount();
      setUnreadCount(unread);

      setLoading(false);
    };

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 실시간 unreadCount 업데이트 (채팅 탭이 아닐 때만)
  useEffect(() => {
    if (!userId || activeTab === "chat") return;

    const supabase = createClient();

    const refreshUnread = async () => {
      const unread = await getTotalUnreadCount();
      setUnreadCount(unread);
    };

    // conversations 테이블의 unread_count 변경 구독
    const channel = supabase
      .channel(`unread:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `user_id=eq.${userId}`,
        },
        refreshUnread,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          // 전문가가 보낸 메시지일 때만 업데이트
          if (
            payload.new &&
            (payload.new as { sender_type: string }).sender_type === "expert"
          ) {
            refreshUnread();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, activeTab]);

  // 회원 탈퇴 (테스트용)
  const handleDeleteAccount = async () => {
    if (!confirm("정말 탈퇴하시겠습니까?\n모든 데이터가 삭제됩니다.")) return;
    await fetch("/api/auth/delete-account", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const formatBookingDate = (dateStr: string, timeStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];

    return `${month}월 ${day}일 (${weekday}) ${timeStr}`;
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
          <div
            className={styles.skeletonText}
            style={{ width: 80, marginBottom: 0 }}
          />
          <div
            className={styles.skeletonText}
            style={{ width: 140, marginBottom: 0 }}
          />
        </div>
        {/* 스켈레톤 메인 */}
        <main className={styles.skeletonMain}>
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonCardHeader}>
              <div className={styles.skeletonBadge} />
              <div
                className={styles.skeletonText}
                style={{ width: 60, marginBottom: 0 }}
              />
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

  // 검진 프로그램 상세
  if (showProgramDetail && bookingInfo) {
    return (
      <ProgramDetailView
        bookingInfo={bookingInfo}
        onClose={() => setShowProgramDetail(false)}
      />
    );
  }

  return (
    <>
      {/* 홈 탭 */}
      <div
        className={styles.container}
        style={{ display: activeTab === "home" ? "flex" : "none" }}
      >
        {/* 회원탈퇴 버튼 (테스트용) */}
        <button className={styles.deleteButton} onClick={handleDeleteAccount}>
          탈퇴
        </button>

        {/* 고정 헤더 영역 */}
        <div className={styles.fixedHeader}>
          <header className={styles.header}>
            <h1 className={styles.headerTitle}>
              <span className={styles.headerLogo}>Lycon | Retirement</span>
            </h1>
          </header>

          {/* 예약 정보 */}
          {bookingInfo && (
            <button
              className={styles.bookingRow}
              onClick={() => setShowProgramDetail(true)}
            >
              <span className={styles.bookingLabel}>내 검진 일정</span>
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
            {/* 메인 타이틀 */}
            <h2 className={styles.mainTitle}>
              예약이 확정되었습니다.
              <br />
              검진 전, 내 자산 상황을
              <br />
              미리 파악해주세요.
            </h2>

            {/* 섹션 헤더 */}
            <p className={styles.sectionDesc}>
              자산 파악은 아래 가이드를 참고하세요!
            </p>

            {/* 팁 카테고리 그리드 */}
            <div className={styles.tipGrid}>
              {TIP_CATEGORIES.map((category) => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={category.id}
                    className={styles.tipCard}
                    onClick={() => {
                      setSelectedTip(category.id);
                      setTipModalKey(prev => prev + 1);
                    }}
                  >
                    <span className={styles.tipTitle}>{category.title}</span>
                    <div className={styles.tipIconWrapper}>
                      <IconComponent size={18} />
                    </div>
                  </button>
                );
              })}
            </div>
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

        {/* 팁 모달 */}
        {selectedTip && (
          <TipModal
            key={tipModalKey}
            categoryId={selectedTip}
            initialHasData={prepDataCategories.has(selectedTip)}
            onDataSaved={(category) => {
              setPrepDataCategories(prev => new Set([...prev, category]));
            }}
            onClose={() => setSelectedTip(null)}
          />
        )}

        {/* 토스트 */}
        <Toast
          message={
            toast
              ? toast.subMessage
                ? `${toast.message} - ${toast.subMessage}`
                : toast.message
              : ""
          }
          isVisible={!!toast}
          onClose={() => setToast(null)}
        />
      </div>

      {/* 채팅 탭 - 항상 마운트, display로 숨김 */}
      <div
        className={styles.chatContainer}
        style={{ display: activeTab === "chat" ? "flex" : "none" }}
      >
        <header className={styles.chatHeader}>
          <button
            className={styles.backButton}
            onClick={() => handleTabChange("home")}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.chatHeaderTitle}>
            담당: {bookingInfo?.expert || "전문가"}
          </h1>
          <div className={styles.headerSpacer} />
        </header>

        <div className={styles.chatMain}>
          {userId && (
            <ChatRoom userId={userId} isVisible={activeTab === "chat"} />
          )}
        </div>
      </div>
    </>
  );
}
