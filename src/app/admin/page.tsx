"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, MessageSquare, ChevronRight, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getExpertBookings, BookingWithUser } from "@/lib/services/bookingService";
import { formatMoney } from "@/lib/utils";
import { BookingModal } from "./components";
import styles from "./dashboard.module.css";

interface User {
  id: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
  phone_number: string | null;
  created_at: string;
  onboarding_step: string | null;
  unread_count: number;
  conversation_id: string;
  last_message_at: string | null;
}

interface AssetSummary {
  totalAssets: number;
  totalDebts: number;
  netWorth: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<BookingWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expertId, setExpertId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithUser | null>(null);
  const [assetSummary, setAssetSummary] = useState<AssetSummary>({
    totalAssets: 0,
    totalDebts: 0,
    netWorth: 0,
  });

  // 안 읽은 메시지 수 새로고침
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
  };

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();

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

      // 대화방과 유저 정보
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

        const conversationIds = conversations.map(c => c.id);
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

        // 자산 총합 계산 (모든 고객의 시뮬레이션 데이터)
        const userIds = userList.map(u => u.id);
        if (userIds.length > 0) {
          // 시뮬레이션 조회
          const { data: simulations } = await supabase
            .from("simulations")
            .select("id")
            .in("profile_id", userIds);

          if (simulations && simulations.length > 0) {
            const simIds = simulations.map(s => s.id);

            // 자산 합계
            const [savingsRes, realEstateRes, debtsRes] = await Promise.all([
              supabase.from("savings").select("current_balance").in("simulation_id", simIds),
              supabase.from("real_estates").select("current_value").in("simulation_id", simIds),
              supabase.from("debts").select("current_balance").in("simulation_id", simIds),
            ]);

            const totalSavings = savingsRes.data?.reduce((sum, s) => sum + (s.current_balance || 0), 0) || 0;
            const totalRealEstate = realEstateRes.data?.reduce((sum, r) => sum + (r.current_value || 0), 0) || 0;
            const totalDebts = debtsRes.data?.reduce((sum, d) => sum + (d.current_balance || 0), 0) || 0;

            setAssetSummary({
              totalAssets: totalSavings + totalRealEstate,
              totalDebts,
              netWorth: totalSavings + totalRealEstate - totalDebts,
            });
          }
        }
      }

      setLoading(false);
    };

    loadData();
  }, []);

  // 실시간 메시지 구독
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
          refreshUnreadCounts(conversationIds);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [expertId, users.length]);

  const handleBookingUpdate = async () => {
    if (!expertId) return;
    const bookingList = await getExpertBookings(expertId);
    setBookings(bookingList);
  };

  // 예정된 예약 (오늘 이후)
  const getUpcomingBookings = () => {
    const today = new Date().toISOString().split("T")[0];

    return bookings
      .filter(b => b.booking_date >= today)
      .filter(b => b.status === "confirmed" || b.status === "pending")
      .sort((a, b) => {
        if (a.booking_date !== b.booking_date) {
          return a.booking_date.localeCompare(b.booking_date);
        }
        return a.booking_time.localeCompare(b.booking_time);
      });
  };

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
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

  const upcomingBookings = getUpcomingBookings();
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.header}>
        <h1 className={styles.title}>대시보드</h1>
        <button
          className={styles.settingsButton}
          onClick={() => router.push("/admin/schedule")}
          title="스케줄 설정"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* 통계 */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>담당 고객</div>
          <div className={styles.statValue}>{users.length}<span className={styles.statUnit}>명</span></div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>총 관리 자산</div>
          <div className={styles.statValue}>{formatMoney(assetSummary.totalAssets)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>예정 상담</div>
          <div className={styles.statValue}>{upcomingBookings.length}<span className={styles.statUnit}>건</span></div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>안 읽은 메시지</div>
          <div className={styles.statValue}>{users.reduce((sum, u) => sum + u.unread_count, 0)}<span className={styles.statUnit}>건</span></div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className={styles.mainGrid}>
        {/* 왼쪽: 고객 목록 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>내 고객</h2>
            <span className={styles.sectionCount}>{users.length}</span>
          </div>
          <div className={styles.customerList}>
            {users.length === 0 ? (
              <div className={styles.empty}>담당 고객이 없습니다.</div>
            ) : (
              users.slice(0, 10).map((user) => (
                <div
                  key={user.id}
                  className={styles.customerItem}
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                >
                  <div className={styles.customerAvatar}>
                    {user.name.charAt(0)}
                  </div>
                  <div className={styles.customerInfo}>
                    <div className={styles.customerName}>
                      {user.name}
                      {getAge(user.birth_date) && (
                        <span className={styles.customerAge}>
                          {getAge(user.birth_date)}세
                        </span>
                      )}
                    </div>
                    <div className={styles.customerMeta}>
                      {user.phone_number || "연락처 없음"}
                    </div>
                  </div>
                  <div className={styles.customerActions}>
                    <button
                      className={styles.chatButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/chat/${user.id}`);
                      }}
                    >
                      <MessageSquare size={16} />
                      {user.unread_count > 0 && (
                        <span className={styles.chatBadge}>{user.unread_count}</span>
                      )}
                    </button>
                    <ChevronRight size={16} className={styles.chevron} />
                  </div>
                </div>
              ))
            )}
            {users.length > 10 && (
              <button className={styles.viewAllButton}>
                전체 {users.length}명 보기
              </button>
            )}
          </div>
        </div>

        {/* 오른쪽: 스케줄 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>예정 상담</h2>
            <button
              className={styles.calendarButton}
              onClick={() => router.push("/admin/schedule")}
            >
              <Calendar size={16} />
            </button>
          </div>
          <div className={styles.scheduleList}>
            {upcomingBookings.length === 0 ? (
              <div className={styles.empty}>예정된 상담이 없습니다.</div>
            ) : (
              upcomingBookings.map((booking) => {
                const isToday = booking.booking_date === today;
                const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
                const isTomorrow = booking.booking_date === tomorrow;
                const date = new Date(booking.booking_date);
                const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

                const getDateLabel = () => {
                  if (isToday) return "오늘";
                  if (isTomorrow) return "내일";
                  return `${date.getMonth() + 1}/${date.getDate()}(${weekdays[date.getDay()]})`;
                };

                return (
                  <div
                    key={booking.id}
                    className={`${styles.scheduleItem} ${isToday ? styles.scheduleToday : ""}`}
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <div className={styles.scheduleTime}>
                      <div className={styles.scheduleDate}>
                        {getDateLabel()}
                      </div>
                      <div className={styles.scheduleHour}>
                        {booking.booking_time}
                      </div>
                    </div>
                    <div className={styles.scheduleDivider} />
                    <div className={styles.scheduleInfo}>
                      <div className={styles.scheduleName}>
                        {booking.user_name || "이름 없음"}
                      </div>
                      <div className={styles.scheduleMeta}>
                        {booking.user_phone || "연락처 없음"}
                      </div>
                    </div>
                    <div className={`${styles.scheduleStatus} ${styles[booking.status]}`}>
                      {booking.status === "confirmed" ? "확정" : "대기"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdate={handleBookingUpdate}
        />
      )}
    </div>
  );
}
