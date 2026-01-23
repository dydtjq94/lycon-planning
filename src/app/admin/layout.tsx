"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar } from "./components";
import styles from "./admin.module.css";

interface Expert {
  id: string;
  name: string;
  title: string;
}

interface Customer {
  id: string;
  name: string;
  unreadCount: number;
}

interface ConversationData {
  id: string;
  user_id: string;
  profileId: string;
  profileName: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [expert, setExpert] = useState<Expert | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const conversationsRef = useRef<ConversationData[]>([]);

  useEffect(() => {
    const checkExpert = async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (pathname !== "/admin/login" && pathname !== "/admin/setup") {
          router.replace("/admin/login");
        }
        setLoading(false);
        return;
      }

      const { data: expertData } = await supabase
        .from("experts")
        .select("id, name, title")
        .eq("user_id", user.id)
        .single();

      if (!expertData) {
        if (pathname !== "/admin/login" && pathname !== "/admin/setup") {
          router.replace("/admin/login");
        }
        setLoading(false);
        return;
      }

      setExpert(expertData);

      // 고객 목록 로드
      const { data: conversations } = await supabase
        .from("conversations")
        .select(`
          id,
          user_id,
          profiles:user_id (
            id,
            name
          )
        `)
        .eq("expert_id", expertData.id)
        .order("last_message_at", { ascending: false });

      if (conversations) {
        // 대화 데이터 저장 (실시간 구독용)
        conversationsRef.current = conversations
          .filter((c) => c.profiles)
          .map((c) => {
            const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
            return {
              id: c.id,
              user_id: c.user_id,
              profileId: profile?.id || "",
              profileName: profile?.name || "이름 없음",
            };
          })
          .filter((c) => c.profileId);

        // 각 대화별 읽지 않은 메시지 수 조회
        const customerList: Customer[] = await Promise.all(
          conversationsRef.current.map(async (c) => {
            const { data: unreadMessages } = await supabase
              .from("messages")
              .select("id")
              .eq("conversation_id", c.id)
              .eq("sender_type", "user")
              .eq("is_read", false);

            return {
              id: c.profileId,
              name: c.profileName,
              unreadCount: unreadMessages?.length || 0,
            };
          })
        );
        setCustomers(customerList);
        setConversationsLoaded(true);
      }

      setLoading(false);

      if (pathname === "/admin/login") {
        router.replace("/admin");
      }
    };

    checkExpert();
  }, [pathname, router]);

  // 실시간 메시지 구독 - 읽지 않은 수 업데이트
  useEffect(() => {
    if (!conversationsLoaded || conversationsRef.current.length === 0) return;

    const supabase = createClient();
    const conversationIds = conversationsRef.current.map((c) => c.id);

    const refreshUnreadCounts = async () => {
      const updatedCustomers = await Promise.all(
        conversationsRef.current.map(async (c) => {
          const { data: unreadMessages } = await supabase
            .from("messages")
            .select("id")
            .eq("conversation_id", c.id)
            .eq("sender_type", "user")
            .eq("is_read", false);

          return {
            id: c.profileId,
            name: c.profileName,
            unreadCount: unreadMessages?.length || 0,
          };
        })
      );
      setCustomers(updatedCustomers);
    };

    // 커스텀 이벤트 리스너 (메시지 읽음 처리 시)
    const handleMessagesRead = () => {
      refreshUnreadCounts();
    };
    window.addEventListener("admin-messages-read", handleMessagesRead);

    // Supabase 실시간 구독
    const channel = supabase
      .channel("admin-sidebar-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const conversationId = (payload.new as any)?.conversation_id || (payload.old as any)?.conversation_id;
          if (conversationIds.includes(conversationId)) {
            refreshUnreadCounts();
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("admin-messages-read", handleMessagesRead);
      supabase.removeChannel(channel);
    };
  }, [conversationsLoaded]);

  // 로그인, 셋업 페이지는 레이아웃 없이 렌더링
  if (pathname === "/admin/login" || pathname === "/admin/setup") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!expert) {
    return null;
  }

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
  };

  return (
    <div className={styles.layout}>
      <AdminSidebar
        expertName={expert.name}
        customers={customers}
        onLogout={handleLogout}
      />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
