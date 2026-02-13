"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, Search, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar } from "./components";
import { AdminProvider } from "./AdminContext";
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

interface AllCustomer {
  id: string;
  name: string;
  phone_number: string | null;
  customer_stage: string;
  isAssigned: boolean;
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

  // 고객 추가 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [allCustomers, setAllCustomers] = useState<AllCustomer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingCustomer, setAddingCustomer] = useState<string | null>(null);

  // 데이터 로딩
  useEffect(() => {
    const supabase = createClient();

    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: expertData } = await supabase
        .from("experts")
        .select("id, name, title")
        .eq("user_id", user.id)
        .single();

      if (!expertData) {
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

        // 고객 목록 먼저 보여주기 (unread 0으로)
        setCustomers(conversationsRef.current.map(c => ({
          id: c.profileId,
          name: c.profileName,
          unreadCount: 0,
        })));
        setConversationsLoaded(true);
      }

      // 사이드바 즉시 표시
      setLoading(false);

      // unread 카운트는 백그라운드에서 로드
      if (conversationsRef.current.length > 0) {
        const conversationIds = conversationsRef.current.map(c => c.id);
        const { data: unreadMessages } = await supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", conversationIds)
          .eq("sender_type", "user")
          .eq("is_read", false);

        const unreadMap: Record<string, number> = {};
        unreadMessages?.forEach(m => {
          unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
        });

        setCustomers(conversationsRef.current.map(c => ({
          id: c.profileId,
          name: c.profileName,
          unreadCount: unreadMap[c.id] || 0,
        })));
      }
    };

    loadData();

    // 로그인/로그아웃 시 데이터 다시 로드
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        setLoading(true);
        loadData();
      } else if (event === "SIGNED_OUT") {
        setExpert(null);
        setCustomers([]);
        conversationsRef.current = [];
        setConversationsLoaded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 인증 체크 및 리다이렉트 (pathname 변경 시에만)
  useEffect(() => {
    if (loading) return;

    if (!expert) {
      if (pathname !== "/admin/login" && pathname !== "/admin/setup") {
        router.replace("/admin/login");
      }
    } else if (pathname === "/admin/login") {
      router.replace("/admin");
    }
  }, [pathname, router, expert, loading]);

  // 실시간 메시지 구독 - 읽지 않은 수 업데이트
  useEffect(() => {
    if (!conversationsLoaded || conversationsRef.current.length === 0) return;

    const supabase = createClient();
    const conversationIds = conversationsRef.current.map((c) => c.id);

    const refreshUnreadCounts = async () => {
      // 단일 쿼리로 모든 읽지 않은 메시지 조회
      const conversationIds = conversationsRef.current.map(c => c.id);
      const { data: unreadMessages } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
        .eq("sender_type", "user")
        .eq("is_read", false);

      // conversation_id별로 그룹화
      const unreadMap: Record<string, number> = {};
      unreadMessages?.forEach(m => {
        unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
      });

      // 고객 목록 업데이트
      const updatedCustomers: Customer[] = conversationsRef.current.map(c => ({
        id: c.profileId,
        name: c.profileName,
        unreadCount: unreadMap[c.id] || 0,
      }));

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

  // 고객 추가 모달 열기
  const handleOpenAddModal = async () => {
    if (!expert) return;

    const supabase = createClient();

    // 모든 프로필 조회
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, phone_number, customer_stage")
      .order("created_at", { ascending: false });

    // 이미 담당 중인 고객 ID 목록
    const assignedIds = new Set(customers.map((c) => c.id));

    if (profiles) {
      setAllCustomers(
        profiles.map((p) => ({
          id: p.id,
          name: p.name || "이름 없음",
          phone_number: p.phone_number,
          customer_stage: p.customer_stage || "new",
          isAssigned: assignedIds.has(p.id),
        }))
      );
    }

    setSearchQuery("");
    setShowAddModal(true);
  };

  // 고객 담당 설정
  const handleAssignCustomer = async (customerId: string) => {
    if (!expert || addingCustomer) return;

    setAddingCustomer(customerId);
    const supabase = createClient();

    // 새 conversation 생성
    const { data: newConversation, error } = await supabase
      .from("conversations")
      .insert({
        user_id: customerId,
        expert_id: expert.id,
        is_primary: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error assigning customer:", error);
      alert("담당 설정 중 오류가 발생했습니다.");
      setAddingCustomer(null);
      return;
    }

    // 고객 목록 업데이트
    const assignedCustomer = allCustomers.find((c) => c.id === customerId);
    if (assignedCustomer && newConversation) {
      setCustomers((prev) => [
        ...prev,
        {
          id: customerId,
          name: assignedCustomer.name,
          unreadCount: 0,
        },
      ]);

      // conversationsRef 업데이트
      conversationsRef.current.push({
        id: newConversation.id,
        user_id: customerId,
        profileId: customerId,
        profileName: assignedCustomer.name,
      });

      // allCustomers에서 isAssigned 업데이트
      setAllCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { ...c, isAssigned: true } : c))
      );
    }

    setAddingCustomer(null);
  };

  // 검색 필터링된 고객 목록
  const filteredCustomers = allCustomers.filter(
    (c) =>
      !c.isAssigned &&
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone_number?.includes(searchQuery))
  );

  const STAGE_LABELS: Record<string, string> = {
    new: "신규",
    first_consultation: "1차 상담",
    report_delivered: "보고서",
    second_consultation: "2차 상담",
    subscription: "구독",
    churned: "이탈",
  };

  return (
    <AdminProvider value={{ expertId: expert.id, expertName: expert.name }}>
    <div className={styles.layout}>
      <AdminSidebar
        expertName={expert.name}
        customers={customers}
        onLogout={handleLogout}
        onAddCustomer={handleOpenAddModal}
      />
      <main className={styles.main}>{children}</main>

      {/* 고객 추가 모달 */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>고객 추가</h3>
              <button
                className={styles.modalClose}
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalSearch}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="이름 또는 연락처로 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div className={styles.modalList}>
              {filteredCustomers.length === 0 ? (
                <div className={styles.modalEmpty}>
                  {searchQuery
                    ? "검색 결과가 없습니다."
                    : "추가할 수 있는 고객이 없습니다."}
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <div key={customer.id} className={styles.modalCustomerItem}>
                    <div className={styles.modalCustomerInfo}>
                      <div className={styles.modalCustomerName}>
                        {customer.name}
                        <span className={styles.modalCustomerStage}>
                          {STAGE_LABELS[customer.customer_stage] || customer.customer_stage}
                        </span>
                      </div>
                      <div className={styles.modalCustomerPhone}>
                        {customer.phone_number || "연락처 없음"}
                      </div>
                    </div>
                    <button
                      className={styles.modalAssignButton}
                      onClick={() => handleAssignCustomer(customer.id)}
                      disabled={addingCustomer === customer.id}
                    >
                      {addingCustomer === customer.id ? (
                        "추가 중..."
                      ) : (
                        <>
                          <UserPlus size={14} />
                          담당 설정
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminProvider>
  );
}
