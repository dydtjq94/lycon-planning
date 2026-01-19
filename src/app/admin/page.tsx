"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./admin.module.css";

interface User {
  id: string;
  name: string;
  birth_date: string | null;
  created_at: string;
  onboarding_step: string | null;
  unread_count: number;
  conversation_id: string;
  last_message_at: string | null;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    unreadMessages: 0,
  });

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

      // 전문가에게 연결된 대화방과 유저 정보 가져오기
      const { data: conversations } = await supabase
        .from("conversations")
        .select(`
          id,
          user_id,
          unread_count,
          last_message_at,
          profiles:user_id (
            id,
            name,
            birth_date,
            created_at,
            onboarding_step
          )
        `)
        .eq("expert_id", expert.id)
        .order("last_message_at", { ascending: false });

      if (conversations) {
        const userList: User[] = conversations
          .filter((c) => c.profiles)
          .map((c) => ({
            id: (c.profiles as { id: string }).id,
            name: (c.profiles as { name: string }).name || "이름 없음",
            birth_date: (c.profiles as { birth_date: string | null }).birth_date,
            created_at: (c.profiles as { created_at: string }).created_at,
            onboarding_step: (c.profiles as { onboarding_step: string | null }).onboarding_step,
            unread_count: c.unread_count || 0,
            conversation_id: c.id,
            last_message_at: c.last_message_at,
          }));

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
                      {getAge(user.birth_date) && ` (${getAge(user.birth_date)}세)`}
                    </span>
                    <span className={styles.userMeta}>
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
