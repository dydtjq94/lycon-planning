"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { List, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getExpertBookings, BookingWithUser } from "@/lib/services/bookingService";
import styles from "./admin.module.css";

interface User {
  id: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
  phone_number: string | null;
  created_at: string;
  onboarding_step: string | null;
  unread_count: number;  // 전문가가 안 읽은 유저 메시지 수
  conversation_id: string;
  last_message_at: string | null;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<BookingWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    unreadMessages: 0,
  });
  const [expertId, setExpertId] = useState<string | null>(null);
  const [bookingViewMode, setBookingViewMode] = useState<"list" | "calendar">("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 안 읽은 메시지 수 새로고침 함수
  const refreshUnreadCounts = async (conversationIds: string[]) => {
    if (conversationIds.length === 0) return;

    const supabase = createClient();
    const { data: unreadCounts } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .eq("sender_type", "user")
      .eq("is_read", false);

    const unreadMap: Record<string, number> = {};
    unreadCounts?.forEach(m => {
      unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
    });

    setUsers(prev => prev.map(u => ({
      ...u,
      unread_count: unreadMap[u.conversation_id] || 0,
    })));

    setStats(prev => ({
      ...prev,
      unreadMessages: Object.values(unreadMap).reduce((sum, count) => sum + count, 0),
    }));
  };

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();

      // 현재 로그인한 전문가 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: expert } = await supabase
        .from("experts")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!expert) return;
      setExpertId(expert.id);

      // 예약 목록 로드
      const bookingList = await getExpertBookings(expert.id);
      setBookings(bookingList);

      // 전문가에게 연결된 대화방과 유저 정보 가져오기
      const { data: conversations } = await supabase
        .from("conversations")
        .select(`
          id,
          user_id,
          last_message_at,
          profiles:user_id (
            id,
            name,
            birth_date,
            gender,
            phone_number,
            created_at,
            onboarding_step
          )
        `)
        .eq("expert_id", expert.id)
        .order("last_message_at", { ascending: false });

      if (conversations) {
        type ProfileData = {
          id: string;
          name: string | null;
          birth_date: string | null;
          gender: string | null;
          phone_number: string | null;
          created_at: string;
          onboarding_step: string | null;
        };

        // 각 대화방별 안 읽은 메시지 수 조회 (유저가 보낸 메시지 중 안 읽은 것)
        const conversationIds = conversations.map(c => c.id);
        const { data: unreadCounts } = await supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", conversationIds)
          .eq("sender_type", "user")
          .eq("is_read", false);

        // conversation_id별 안 읽은 수 계산
        const unreadMap: Record<string, number> = {};
        unreadCounts?.forEach(m => {
          unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
        });

        const userList: User[] = conversations
          .filter((c) => c.profiles && (Array.isArray(c.profiles) ? c.profiles.length > 0 : true))
          .map((c) => {
            const profileData = c.profiles as ProfileData | ProfileData[];
            const profile = Array.isArray(profileData) ? profileData[0] : profileData;
            return {
              id: profile.id,
              name: profile.name || "이름 없음",
              birth_date: profile.birth_date,
              gender: profile.gender,
              phone_number: profile.phone_number,
              created_at: profile.created_at,
              onboarding_step: profile.onboarding_step,
              unread_count: unreadMap[c.id] || 0,
              conversation_id: c.id,
              last_message_at: c.last_message_at,
            };
          });

        setUsers(userList);
        setStats({
          totalUsers: userList.length,
          unreadMessages: userList.reduce((sum, u) => sum + u.unread_count, 0),
        });
      }

      setLoading(false);
    };

    loadData();
  }, []);

  // 실시간 메시지 업데이트 구독
  useEffect(() => {
    if (!expertId || users.length === 0) return;

    const supabase = createClient();
    const conversationIds = users.map(u => u.conversation_id);

    const channel = supabase
      .channel(`admin-messages:${expertId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // 유저가 보낸 메시지일 때만 업데이트
          if (payload.new && (payload.new as { sender_type: string }).sender_type === "user") {
            refreshUnreadCounts(conversationIds);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        () => {
          // 읽음 처리 시 업데이트
          refreshUnreadCounts(conversationIds);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [expertId, users.length]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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

  const getStatusText = (step: string | null) => {
    if (!step) return "시작 전";
    if (step === "completed") return "온보딩 완료";
    return "진행 중";
  };

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <h1 className={styles.pageTitle}>대시보드</h1>

      {/* 통계 */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>담당 고객</div>
          <div className={styles.statValue}>{stats.totalUsers}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>안 읽은 메시지</div>
          <div className={styles.statValue}>{stats.unreadMessages}</div>
        </div>
        <button
          className={styles.scheduleButton}
          onClick={() => router.push("/admin/schedule")}
        >
          스케줄 관리
        </button>
      </div>

      {/* 예약 목록 */}
      <div className={styles.section}>
        <div className={styles.sectionHeaderWithToggle}>
          <h2 className={styles.sectionTitle}>예약 목록</h2>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleButton} ${bookingViewMode === "list" ? styles.toggleActive : ""}`}
              onClick={() => setBookingViewMode("list")}
            >
              <List size={16} />
            </button>
            <button
              className={`${styles.toggleButton} ${bookingViewMode === "calendar" ? styles.toggleActive : ""}`}
              onClick={() => setBookingViewMode("calendar")}
            >
              <Calendar size={16} />
            </button>
          </div>
        </div>

        {bookingViewMode === "list" ? (
          <div className={styles.bookingList}>
            {bookings.length === 0 ? (
              <div className={styles.emptyState}>
                예약이 없습니다.
              </div>
            ) : (
              bookings.map((booking) => {
                const date = new Date(booking.booking_date);
                const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
                const birthYear = booking.user_birth_date ? booking.user_birth_date.split("-")[0] : null;
                const genderText = booking.user_gender === "male" ? "남" : booking.user_gender === "female" ? "여" : null;
                return (
                  <div key={booking.id} className={styles.bookingItem}>
                    <div className={styles.bookingInfo}>
                      <span className={styles.bookingDate}>
                        {date.getMonth() + 1}/{date.getDate()} ({weekdays[date.getDay()]}) {booking.booking_time}
                      </span>
                      <span className={styles.bookingUser}>
                        {booking.user_name || "이름 없음"}
                        {birthYear && ` ${birthYear}년생`}
                        {genderText && ` ${genderText}`}
                        {booking.user_phone && ` ${booking.user_phone}`}
                      </span>
                    </div>
                    <span className={`${styles.bookingStatus} ${styles[booking.status]}`}>
                      {booking.status === "confirmed" ? "확정" :
                       booking.status === "pending" ? "대기" :
                       booking.status === "cancelled" ? "취소" : "완료"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className={styles.calendarView}>
            {/* 캘린더 헤더 */}
            <div className={styles.calendarHeader}>
              <button
                className={styles.calendarNavButton}
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              >
                <ChevronLeft size={20} />
              </button>
              <span className={styles.calendarMonthTitle}>
                {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
              </span>
              <button
                className={styles.calendarNavButton}
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className={styles.calendarWeekdays}>
              {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                <div key={day} className={`${styles.calendarWeekday} ${i === 0 ? styles.sunday : i === 6 ? styles.saturday : ""}`}>
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className={styles.calendarGrid}>
              {(() => {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const days: (number | null)[] = [];

                // 빈 칸 (이전 달)
                for (let i = 0; i < firstDay; i++) {
                  days.push(null);
                }
                // 현재 달 날짜
                for (let d = 1; d <= daysInMonth; d++) {
                  days.push(d);
                }

                return days.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className={styles.calendarDayEmpty} />;
                  }

                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayBookings = bookings.filter(b => b.booking_date === dateStr);
                  const isToday = new Date().toISOString().split("T")[0] === dateStr;
                  const dayOfWeek = (firstDay + day - 1) % 7;

                  return (
                    <div
                      key={dateStr}
                      className={`${styles.calendarDay} ${isToday ? styles.calendarDayToday : ""} ${dayOfWeek === 0 ? styles.sunday : dayOfWeek === 6 ? styles.saturday : ""}`}
                    >
                      <span className={styles.calendarDayNumber}>{day}</span>
                      {dayBookings.length > 0 && (
                        <div className={styles.calendarDayBookings}>
                          {dayBookings.map((b) => (
                            <div
                              key={b.id}
                              className={`${styles.calendarBookingDot} ${styles[b.status]}`}
                            >
                              <span className={styles.calendarBookingTime}>{b.booking_time}</span>
                              <span className={styles.calendarBookingName}>{b.user_name || "?"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {/* 유저 목록 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>담당 고객 목록</h2>
        </div>
        <div className={styles.userList}>
          {users.length === 0 ? (
            <div className={styles.emptyState}>
              담당 고객이 없습니다.
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className={styles.userItem}
                onClick={() => router.push(`/admin/users/${user.id}`)}
              >
                <div className={styles.userInfo}>
                  <div className={styles.userAvatar}>
                    {user.name.charAt(0)}
                  </div>
                  <div className={styles.userDetails}>
                    <span className={styles.userName}>
                      {user.name}
                      {user.birth_date && ` ${user.birth_date.replace(/-/g, ".")}`}
                      {user.gender && ` ${user.gender === "male" ? "남" : "여"}`}
                      {getAge(user.birth_date) && ` (${getAge(user.birth_date)}세)`}
                    </span>
                    <span className={styles.userMeta}>
                      {user.phone_number && `${user.phone_number} · `}
                      {getStatusText(user.onboarding_step)} · 가입 {formatDate(user.created_at)}
                    </span>
                  </div>
                </div>
                <div className={styles.userActions}>
                  {user.unread_count > 0 && (
                    <span className={styles.unreadBadge}>
                      {user.unread_count}
                    </span>
                  )}
                  <button
                    className={styles.actionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/admin/chat/${user.id}`);
                    }}
                  >
                    채팅
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
