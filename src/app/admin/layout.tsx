"use client";

import { useEffect, useState } from "react";
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
          user_id,
          profiles:user_id (
            id,
            name
          )
        `)
        .eq("expert_id", expertData.id)
        .order("last_message_at", { ascending: false });

      if (conversations) {
        const customerList: Customer[] = conversations
          .filter((c) => c.profiles)
          .map((c) => {
            const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
            return {
              id: profile?.id || "",
              name: profile?.name || "이름 없음",
            };
          })
          .filter((c) => c.id);
        setCustomers(customerList);
      }

      setLoading(false);

      if (pathname === "/admin/login") {
        router.replace("/admin");
      }
    };

    checkExpert();
  }, [pathname, router]);

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
