"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Target,
  Wallet,
  ChevronDown,
  ChevronRight,
  LogOut,
  Settings,
  Banknote,
  CreditCard,
  Home,
  Landmark,
  LineChart,
  PieChart,
  ArrowRightLeft,
  Receipt,
  Pin,
  Car,
  MessageCircle,
  Shield,
  ClipboardList,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  unreadMessageCount?: number;
}

const topMenu = [
  { id: "diagnosis", label: "재무 검진", icon: Target },
  { id: "messages", label: "메시지", icon: MessageCircle },
];

const simulationMenus = [
  { id: "networth", label: "순자산", icon: PieChart },
  { id: "cashflow-overview", label: "현금흐름", icon: ArrowRightLeft },
  { id: "asset-record", label: "자산 기록", icon: ClipboardList },
];

// 섹터별 구분 (자산 → 현금흐름 → 미래준비)
const financeSubmenus = [
  // 자산 (Net Worth)
  { id: "realEstate", label: "부동산", icon: Home },
  { id: "debt", label: "부채", icon: CreditCard },
  { id: "asset", label: "실물 자산", icon: Car },
  { id: "divider-1", label: "", icon: null },
  // 현금흐름 (Cash Flow)
  { id: "income", label: "소득", icon: Banknote },
  { id: "expense", label: "지출", icon: Receipt },
  { id: "divider-2", label: "", icon: null },
  // 미래준비 (Future Planning)
  { id: "savings", label: "저축/투자", icon: LineChart },
  { id: "pension", label: "연금", icon: Landmark },
  { id: "insurance", label: "보험", icon: Shield },
];

// 단축키용 탭 매핑
const shortcutTabs: { key: string; id: string; display: string }[] = [
  { key: "1", id: "diagnosis", display: "1" },
  { key: "2", id: "messages", display: "2" },
  { key: "3", id: "networth", display: "3" },
  { key: "4", id: "cashflow-overview", display: "4" },
  { key: "5", id: "asset-record", display: "5" },
  { key: "6", id: "realEstate", display: "6" },
  { key: "7", id: "debt", display: "7" },
  { key: "8", id: "asset", display: "8" },
  { key: "9", id: "income", display: "9" },
  { key: "0", id: "expense", display: "0" },
  { key: "-", id: "savings", display: "-" },
  { key: "=", id: "pension", display: "+" },
];

export function Sidebar({
  currentSection,
  onSectionChange,
  isExpanded,
  onExpandChange,
  unreadMessageCount = 0,
}: SidebarProps) {
  const router = useRouter();
  const [isFinanceOpen, setIsFinanceOpen] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl 키 감지
      if (e.key === "Control") {
        setIsCtrlPressed(true);
      }

      // Ctrl + 단축키
      if (e.ctrlKey) {
        const shortcut = shortcutTabs.find(s => s.key === e.key);
        if (shortcut) {
          e.preventDefault();
          onSectionChange(shortcut.id);

          // 나의 재무 탭이면 서브메뉴 열기
          if (financeSubmenus.some(sub => sub.id === shortcut.id)) {
            setIsFinanceOpen(true);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        setIsCtrlPressed(false);
      }
    };

    // 창 포커스 잃으면 Ctrl 해제
    const handleBlur = () => {
      setIsCtrlPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [onSectionChange]);

  const handleLogout = async () => {
    await fetch("/api/auth/delete-account", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      onExpandChange(false);
    }
  };

  const handlePin = () => {
    setIsPinned(!isPinned);
    if (!isPinned) {
      onExpandChange(true);
    }
  };

  // 단축키 표시 가져오기
  const getShortcutDisplay = (sectionId: string): string | null => {
    const shortcut = shortcutTabs.find(s => s.id === sectionId);
    return shortcut ? shortcut.display : null;
  };

  const isTopSection = topMenu.some((item) => item.id === currentSection);
  const isSimulationSection = simulationMenus.some(
    (item) => item.id === currentSection
  );
  const isFinanceSection = financeSubmenus.some(
    (sub) => sub.id === currentSection
  );

  return (
    <aside
      className={`${styles.sidebar} ${
        isExpanded || isPinned ? styles.expanded : ""
      }`}
      onMouseEnter={() => onExpandChange(true)}
      onMouseLeave={handleMouseLeave}
    >
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          {/* 로고 + 고정 버튼 */}
          <div className={styles.logoRow}>
            <div className={styles.logoItem}>
              <span className={styles.logoLetter}>L</span>
              <span className={styles.navLabel}>ycon</span>
            </div>
            <button
              className={`${styles.pinButton} ${isPinned ? styles.pinned : ""}`}
              onClick={handlePin}
              title={isPinned ? "고정 해제" : "사이드바 고정"}
            >
              <Pin size={14} fill={isPinned ? "currentColor" : "none"} />
            </button>
          </div>

          {/* 홈, 메시지 */}
          {topMenu.map((item) => {
            const shortcutDisplay = getShortcutDisplay(item.id);
            return (
              <button
                key={item.id}
                className={`${styles.navItem} ${
                  currentSection === item.id ? styles.active : ""
                }`}
                onClick={() => onSectionChange(item.id)}
                title={item.label}
              >
                <div className={styles.iconWrapper}>
                  <item.icon size={20} />
                  {item.id === "messages" && unreadMessageCount > 0 && (
                    <span className={styles.unreadBadge}>
                      {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                    </span>
                  )}
                  {isCtrlPressed && shortcutDisplay && (
                    <span className={styles.shortcutHint}>{shortcutDisplay}</span>
                  )}
                </div>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            );
          })}

          {/* 구분선 */}
          <div className={styles.divider} />

          {/* 순자산, 현금흐름 */}
          {simulationMenus.map((item) => {
            const shortcutDisplay = getShortcutDisplay(item.id);
            return (
              <button
                key={item.id}
                className={`${styles.navItem} ${
                  currentSection === item.id ? styles.active : ""
                }`}
                onClick={() => onSectionChange(item.id)}
                title={item.label}
              >
                <div className={styles.iconWrapper}>
                  <item.icon size={20} />
                  {isCtrlPressed && shortcutDisplay && (
                    <span className={styles.shortcutHint}>{shortcutDisplay}</span>
                  )}
                </div>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            );
          })}

          {/* 구분선 */}
          <div className={styles.divider} />

          {/* 나의 재무 - 접을 수 있는 메뉴 */}
          <div className={styles.navGroup}>
            <button
              className={`${styles.navItem} ${
                isFinanceSection ? styles.active : ""
              }`}
              onClick={() => setIsFinanceOpen(!isFinanceOpen)}
              title="나의 재무"
            >
              <Wallet size={20} />
              <span className={styles.navLabel}>나의 재무</span>
              <span className={styles.chevron}>
                {isFinanceOpen ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </span>
            </button>

            {isFinanceOpen && (
              <div className={styles.submenu}>
                {financeSubmenus.map((item) => {
                  if (item.id.startsWith("divider")) {
                    return (
                      <div key={item.id} className={styles.submenuDivider} />
                    );
                  }
                  const IconComponent = item.icon!;
                  const shortcutDisplay = getShortcutDisplay(item.id);
                  return (
                    <button
                      key={item.id}
                      className={`${styles.submenuItem} ${
                        currentSection === item.id ? styles.active : ""
                      }`}
                      onClick={() => onSectionChange(item.id)}
                      title={item.label}
                    >
                      <div className={styles.iconWrapper}>
                        <IconComponent size={16} />
                        {isCtrlPressed && shortcutDisplay && (
                          <span className={styles.shortcutHint}>{shortcutDisplay}</span>
                        )}
                      </div>
                      <span className={styles.navLabel}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className={styles.footer}>
        <button
          className={styles.footerItem}
          onClick={() => router.push("/onboarding")}
          title="설정"
        >
          <Settings size={18} />
          <span className={styles.navLabel}>설정</span>
        </button>
        <button
          className={styles.footerItem}
          onClick={handleLogout}
          title="로그아웃"
        >
          <LogOut size={18} />
          <span className={styles.navLabel}>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
