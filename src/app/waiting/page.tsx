"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, User, MessageCircle, ChevronRight, Check, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./waiting.module.css";

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

// 사전 준비 체크리스트 항목
const PREP_CHECKLIST = [
  {
    id: "income",
    label: "소득 정보",
    description: "월 소득, 소득 유형, 소득원 등",
  },
  {
    id: "expense",
    label: "지출 정보",
    description: "월 생활비, 고정 지출 등",
  },
  {
    id: "asset",
    label: "자산 정보",
    description: "예적금, 투자자산, 부동산 등",
  },
  {
    id: "debt",
    label: "부채 정보",
    description: "대출 잔액, 이자율, 상환 기간 등",
  },
  {
    id: "pension",
    label: "연금 정보",
    description: "국민연금, 퇴직연금, 개인연금 등",
  },
];

export default function WaitingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("name, booking_info")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      setLoading(false);
    };

    loadProfile();
  }, [router]);

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.loading}>불러오는 중...</div>
        </main>
      </div>
    );
  }

  const bookingInfo = profile?.booking_info;
  const daysUntil = bookingInfo ? getDaysUntil(bookingInfo.date) : 0;

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {/* 헤더 */}
        <div className={styles.header}>
          <span className={styles.logo}>Lycon</span>
        </div>

        {/* 예약 정보 카드 */}
        <div className={styles.bookingCard}>
          <div className={styles.bookingBadge}>
            {daysUntil > 0 ? `D-${daysUntil}` : "오늘"}
          </div>
          <h1 className={styles.bookingTitle}>
            {profile?.name}님의
            <br />
            재무검진이 예약되었습니다
          </h1>

          {bookingInfo && (
            <div className={styles.bookingDetails}>
              <div className={styles.bookingItem}>
                <Calendar size={18} />
                <span>{formatBookingDate(bookingInfo.date, bookingInfo.time)}</span>
              </div>
              <div className={styles.bookingItem}>
                <User size={18} />
                <span>{bookingInfo.expert} 은퇴설계전문가</span>
              </div>
            </div>
          )}

          <button className={styles.rescheduleBtn}>
            일정 변경
          </button>
        </div>

        {/* 사전 준비 섹션 */}
        <div className={styles.prepSection}>
          <div className={styles.prepHeader}>
            <h2 className={styles.prepTitle}>검진 전 준비사항</h2>
            <p className={styles.prepDesc}>
              더 정확한 진단을 위해 아래 정보를 미리 준비해주세요.
              <br />
              준비가 안 되어도 검진은 진행됩니다.
            </p>
          </div>

          <div className={styles.checklist}>
            {PREP_CHECKLIST.map((item) => {
              const isChecked = checkedItems.has(item.id);
              return (
                <button
                  key={item.id}
                  className={`${styles.checklistItem} ${isChecked ? styles.checked : ""}`}
                  onClick={() => toggleCheck(item.id)}
                >
                  <div className={styles.checkIcon}>
                    {isChecked ? <Check size={16} /> : <Circle size={16} />}
                  </div>
                  <div className={styles.checkContent}>
                    <span className={styles.checkLabel}>{item.label}</span>
                    <span className={styles.checkDesc}>{item.description}</span>
                  </div>
                  <ChevronRight size={18} className={styles.checkArrow} />
                </button>
              );
            })}
          </div>

          <p className={styles.prepNote}>
            * 준비가 완료되면 체크해주세요. 검진 시 참고됩니다.
          </p>
        </div>

        {/* 채팅 섹션 */}
        <div className={styles.chatSection}>
          <div className={styles.chatHeader}>
            <h2 className={styles.chatTitle}>궁금한 점이 있으신가요?</h2>
            <p className={styles.chatDesc}>
              담당 전문가에게 미리 질문하실 수 있어요.
            </p>
          </div>
          <button
            className={styles.chatBtn}
            onClick={() => router.push("/dashboard?section=messages")}
          >
            <MessageCircle size={20} />
            <span>메시지 보내기</span>
          </button>
        </div>

        {/* 검진 안내 */}
        <div className={styles.infoSection}>
          <h2 className={styles.infoTitle}>검진에서 무엇을 하나요?</h2>
          <div className={styles.infoList}>
            <div className={styles.infoItem}>
              <div className={styles.infoNum}>1</div>
              <div className={styles.infoText}>
                <strong>현재 상태 파악</strong>
                <span>자산, 부채, 소득, 지출 현황 분석</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoNum}>2</div>
              <div className={styles.infoText}>
                <strong>은퇴 준비 진단</strong>
                <span>연금, 투자, 저축 수준 점검</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoNum}>3</div>
              <div className={styles.infoText}>
                <strong>맞춤 전략 수립</strong>
                <span>개선 포인트 및 실행 방안 제안</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
