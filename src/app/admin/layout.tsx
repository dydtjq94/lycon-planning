"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./admin.module.css";

interface Expert {
  id: string;
  name: string;
  title: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [expert, setExpert] = useState<Expert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkExpert = async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // 로그인 안 됨 → 로그인 페이지로 (로그인, 셋업 페이지는 제외)
        if (pathname !== "/admin/login" && pathname !== "/admin/setup") {
          router.replace("/admin/login");
        }
        setLoading(false);
        return;
      }

      // 전문가인지 확인
      const { data: expertData } = await supabase
        .from("experts")
        .select("id, name, title")
        .eq("user_id", user.id)
        .single();

      if (!expertData) {
        // 전문가 아님 → 로그인 페이지로 (셋업 페이지는 제외)
        if (pathname !== "/admin/login" && pathname !== "/admin/setup") {
          router.replace("/admin/login");
        }
        setLoading(false);
        return;
      }

      setExpert(expertData);
      setLoading(false);

      // 로그인 페이지에서 이미 로그인됨 → 대시보드로
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
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <span className={styles.logo}>Lycon Admin</span>
          <div className={styles.headerRight}>
            <span className={styles.expertName}>{expert.name}</span>
            <button onClick={handleLogout} className={styles.logoutButton}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
