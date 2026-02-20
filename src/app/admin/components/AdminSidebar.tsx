"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Settings,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { useState, useEffect } from "react";
import styles from "./AdminSidebar.module.css";

type ThemeId = "dark" | "darker" | "light" | "blue";

interface Customer {
  id: string;
  name: string;
  unreadCount: number;
}

interface AdminSidebarProps {
  expertName: string;
  customers: Customer[];
  onLogout: () => void;
  onAddCustomer: () => void;
}

const mainMenu = [
  { id: "/admin", label: "대시보드", icon: LayoutDashboard },
  { id: "/admin/schedule", label: "스케줄", icon: Calendar },
  { id: "/admin/reports", label: "고객 현황", icon: FileText },
];

export function AdminSidebar({
  expertName,
  customers,
  onLogout,
  onAddCustomer,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("darker");

  // 테마 로드 및 이벤트 리스너
  useEffect(() => {
    const loadTheme = () => {
      const saved = localStorage.getItem("admin-theme") as ThemeId | null;
      if (saved) setTheme(saved);
    };

    loadTheme();

    const handleThemeChange = (e: CustomEvent<ThemeId>) => {
      setTheme(e.detail);
    };

    window.addEventListener("admin-theme-change", handleThemeChange as EventListener);
    return () => {
      window.removeEventListener("admin-theme-change", handleThemeChange as EventListener);
    };
  }, []);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(path);
  };

  const isUserDetailPage = pathname.startsWith("/admin/users/");
  const currentUserId = isUserDetailPage ? pathname.split("/")[3] : null;

  return (
    <aside
      className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}
      data-theme={theme}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* 로고 */}
      <div className={styles.logoRow}>
        <div className={styles.logoItem}>
          <span className={styles.logoLetter}>L</span>
          {isExpanded && <span className={styles.navLabel}>담당자</span>}
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          {mainMenu.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${isActive(item.id) && !isUserDetailPage ? styles.active : ""}`}
              onClick={() => router.push(item.id)}
            >
              <item.icon size={20} />
              {isExpanded && <span className={styles.navLabel}>{item.label}</span>}
            </button>
          ))}

          <div className={styles.divider} />

          {/* 고객 관리 */}
          <div className={styles.navGroup}>
            <button
              className={`${styles.navItem} ${isUserDetailPage ? styles.active : ""}`}
              onClick={() => isExpanded && setIsCustomerOpen(!isCustomerOpen)}
            >
              <Users size={20} />
              {isExpanded && <span className={styles.navLabel}>고객 목록</span>}
              {isExpanded && (
                <span className={styles.chevron}>
                  {isCustomerOpen ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </span>
              )}
            </button>

            {isExpanded && isCustomerOpen && (
              <div className={styles.submenu}>
                {customers.length === 0 ? (
                  <div className={styles.emptyCustomers}>
                    담당 고객이 없습니다
                  </div>
                ) : (
                  customers.map((customer) => (
                    <button
                      key={customer.id}
                      className={`${styles.submenuItem} ${currentUserId === customer.id ? styles.active : ""}`}
                      onClick={() => router.push(`/admin/users/${customer.id}`)}
                    >
                      <User size={16} />
                      <span className={styles.navLabel}>{customer.name}</span>
                      {customer.unreadCount > 0 && (
                        <span className={styles.unreadBadge}>
                          {customer.unreadCount}
                        </span>
                      )}
                    </button>
                  ))
                )}
                <button
                  className={styles.addCustomerButton}
                  onClick={onAddCustomer}
                >
                  <UserPlus size={16} />
                  <span className={styles.navLabel}>고객 추가</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 푸터 */}
      <div className={styles.footer}>
        <div className={styles.expertInfo}>
          <div className={styles.expertAvatar}>{expertName.charAt(0)}</div>
          {isExpanded && <span className={styles.expertName}>{expertName}</span>}
        </div>
        <button
          className={styles.footerItem}
          onClick={() => router.push("/admin/settings")}
        >
          <Settings size={18} />
          {isExpanded && <span className={styles.navLabel}>설정</span>}
        </button>
        <button className={styles.footerItem} onClick={onLogout}>
          <LogOut size={18} />
          {isExpanded && <span className={styles.navLabel}>로그아웃</span>}
        </button>
      </div>
    </aside>
  );
}
