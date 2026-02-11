"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, MessageSquare, ChevronRight, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getExpertBookings, BookingWithUser } from "@/lib/services/bookingService";
import { formatWon } from "@/lib/utils";
import { useAdmin } from "./AdminContext";
import { BookingModal } from "./components";
import styles from "./dashboard.module.css";

type CustomerStage = "new" | "first_consultation" | "report_delivered" | "second_consultation" | "subscription" | "churned";

const CUSTOMER_STAGE_LABELS: Record<CustomerStage, string> = {
  new: "신규",
  first_consultation: "1차 상담",
  report_delivered: "보고서",
  second_consultation: "2차 상담",
  subscription: "구독",
  churned: "이탈",
};

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
  customer_stage: CustomerStage;
}

interface AssetSummary {
  totalAssets: number;
  totalDebts: number;
  netWorth: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { expertId } = useAdmin();
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<BookingWithUser[]>([]);
  const [loading, setLoading] = useState(true);
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

      // 1단계: bookings + conversations 병렬
      const [bookingList, conversationsRes] = await Promise.all([
        getExpertBookings(expertId),
        supabase
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
              onboarding_step,
              customer_stage
            )
          `)
          .eq("expert_id", expertId)
          .order("last_message_at", { ascending: false }),
      ]);

      setBookings(bookingList);

      const conversations = conversationsRes.data;
      if (conversations) {
        type ProfileData = {
          id: string;
          name: string | null;
          birth_date: string | null;
          gender: string | null;
          phone_number: string | null;
          created_at: string;
          onboarding_step: string | null;
          customer_stage: CustomerStage | null;
        };

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
              unread_count: 0,
              conversation_id: c.id,
              last_message_at: c.last_message_at,
              customer_stage: profile.customer_stage || "new",
            };
          });

        setUsers(userList);
        setLoading(false);

        // 2단계: unread + assets 백그라운드 병렬
        const conversationIds = conversations.map(c => c.id);
        const userIds = userList.map(u => u.id);

        const [unreadRes, simulationsRes] = await Promise.all([
          supabase
            .from("messages")
            .select("conversation_id")
            .in("conversation_id", conversationIds)
            .eq("sender_type", "user")
            .eq("is_read", false),
          userIds.length > 0
            ? supabase.from("simulations").select("id").in("profile_id", userIds)
            : Promise.resolve({ data: null }),
        ]);

        // unread 반영
        const unreadMap: Record<string, number> = {};
        unreadRes.data?.forEach(m => {
          unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
        });
        setUsers(prev => prev.map(u => ({
          ...u,
          unread_count: unreadMap[u.conversation_id] || 0,
        })));

        // assets 반영
        const simulations = simulationsRes.data;
        if (simulations && simulations.length > 0) {
          const simIds = simulations.map(s => s.id);
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
      } else {
        setLoading(false);
      }
    };

    loadData();
  }, [expertId]);

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
        <div className={styles.header}>
          <h1 className={styles.title}>대시보드</h1>
        </div>

        <div className={styles.content}>
          {/* Stats Skeleton */}
          <div className={styles.statsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.statCard}>
                <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: "80px" }} />
                <div className={`${styles.skeleton} ${styles.skeletonValue}`} style={{ width: "120px" }} />
              </div>
            ))}
          </div>

          {/* Main Grid Skeleton */}
          <div className={styles.mainGrid}>
            {/* Left: Customer List Skeleton */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>내 고객</h2>
              </div>
              <div className={styles.customerList}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={styles.customerItem}>
                    <div className={`${styles.skeleton} ${styles.skeletonCircle}`} />
                    <div className={styles.customerInfo}>
                      <div className={`${styles.skeleton} ${styles.skeletonBlock}`} style={{ width: "160px", marginBottom: "6px" }} />
                      <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: "120px" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Schedule Skeleton */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>예정 상담</h2>
              </div>
              <div className={styles.scheduleList}>
                {[1, 2].map((i) => (
                  <div key={i} className={styles.scheduleItem}>
                    <div className={styles.scheduleTime}>
                      <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: "40px", marginBottom: "4px" }} />
                      <div className={`${styles.skeleton} ${styles.skeletonBlock}`} style={{ width: "50px" }} />
                    </div>
                    <div className={styles.scheduleDivider} />
                    <div className={styles.scheduleInfo}>
                      <div className={`${styles.skeleton} ${styles.skeletonBlock}`} style={{ width: "100px", marginBottom: "4px" }} />
                      <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: "140px" }} />
                    </div>
                    <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: "40px" }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
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

      {/* 콘텐츠 */}
      <div className={styles.content}>
        {/* 통계 */}
        <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>담당 고객</div>
          <div className={styles.statValue}>{users.length}<span className={styles.statUnit}>명</span></div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>총 관리 자산</div>
          <div className={styles.statValue}>{formatWon(assetSummary.totalAssets)}</div>
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
                      <span className={`${styles.stageBadge} ${styles[user.customer_stage]}`}>
                        {CUSTOMER_STAGE_LABELS[user.customer_stage]}
                      </span>
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
                        router.push(`/admin/users/${user.id}#chat`);
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
