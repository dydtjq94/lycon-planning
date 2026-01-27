"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, User, Bell, Shield, HelpCircle, ChevronRight } from "lucide-react";
import styles from "./SettingsTab.module.css";

interface SettingsTabProps {
  profileName: string;
}

export function SettingsTab({ profileName }: SettingsTabProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* 프로필 섹션 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>프로필</h2>
          <div className={styles.menuList}>
            <button className={styles.menuItem}>
              <User size={20} />
              <div className={styles.menuInfo}>
                <span className={styles.menuLabel}>내 정보</span>
                <span className={styles.menuValue}>{profileName || "이름 없음"}</span>
              </div>
              <ChevronRight size={16} className={styles.chevron} />
            </button>
          </div>
        </section>

        {/* 앱 설정 섹션 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>앱 설정</h2>
          <div className={styles.menuList}>
            <button className={styles.menuItem}>
              <Bell size={20} />
              <div className={styles.menuInfo}>
                <span className={styles.menuLabel}>알림</span>
              </div>
              <ChevronRight size={16} className={styles.chevron} />
            </button>
            <button className={styles.menuItem}>
              <Shield size={20} />
              <div className={styles.menuInfo}>
                <span className={styles.menuLabel}>보안</span>
              </div>
              <ChevronRight size={16} className={styles.chevron} />
            </button>
          </div>
        </section>

        {/* 지원 섹션 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>지원</h2>
          <div className={styles.menuList}>
            <button className={styles.menuItem}>
              <HelpCircle size={20} />
              <div className={styles.menuInfo}>
                <span className={styles.menuLabel}>도움말</span>
              </div>
              <ChevronRight size={16} className={styles.chevron} />
            </button>
          </div>
        </section>

        {/* 로그아웃 */}
        <section className={styles.section}>
          <div className={styles.menuList}>
            <button className={styles.logoutButton} onClick={handleLogout}>
              <LogOut size={20} />
              <span>로그아웃</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
