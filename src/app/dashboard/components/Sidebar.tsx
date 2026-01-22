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

// 담당자 관련
const expertMenu = [
  { id: "messages", label: "채팅", icon: MessageCircle },
  { id: "consultation", label: "상담", icon: Target },
];

// 프로그레스 (현재 기록)
const progressMenu = [
  { id: "asset-snapshot", label: "자산 현황", icon: PieChart },
  { id: "household-budget", label: "가계부", icon: Receipt },
];

// 시나리오 내 서브메뉴 (나의 재무)
const financeSubmenus = [
  { id: "realEstate", label: "부동산", icon: Home },
  { id: "debt", label: "부채", icon: CreditCard },
  { id: "asset", label: "실물 자산", icon: Car },
  { id: "income", label: "소득", icon: Banknote },
  { id: "expense", label: "지출", icon: Receipt },
  { id: "savings", label: "저축/투자", icon: LineChart },
  { id: "pension", label: "연금", icon: Landmark },
  { id: "insurance", label: "보험", icon: Shield },
];

// 시나리오 내 차트/개요
const scenarioOverviewMenus = [
  { id: "networth", label: "순자산", icon: PieChart },
  { id: "cashflow-overview", label: "현금흐름", icon: ArrowRightLeft },
];

// 단축키용 탭 매핑 (간소화)
const shortcutTabs: { key: string; id: string; display: string }[] = [
  { key: "1", id: "messages", display: "1" },
  { key: "2", id: "asset-snapshot", display: "2" },
  { key: "3", id: "household-budget", display: "3" },
  { key: "4", id: "networth", display: "4" },
  { key: "5", id: "cashflow-overview", display: "5" },
];

export function Sidebar({
  currentSection,
  onSectionChange,
  isExpanded,
  onExpandChange,
  unreadMessageCount = 0,
}: SidebarProps) {
  const router = useRouter();
  const [isScenarioOpen, setIsScenarioOpen] = useState(true);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);
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

  const isExpertSection = expertMenu.some((item) => item.id === currentSection);
  const isProgressSection = progressMenu.some((item) => item.id === currentSection);
  const isScenarioOverview = scenarioOverviewMenus.some((item) => item.id === currentSection);
  const isFinanceSection = financeSubmenus.some((sub) => sub.id === currentSection);

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

          {/* 담당자 관련 */}
          <div className={styles.sectionLabel}>담당자</div>
          {expertMenu.map((item) => {
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

          {/* 프로그레스 */}
          <div className={styles.sectionLabel}>프로그레스</div>
          {progressMenu.map((item) => {
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

          {/* 시나리오 */}
          <div className={styles.sectionLabel}>시나리오</div>
          <div className={styles.navGroup}>
            <button
              className={`${styles.navItem} ${
                isScenarioOverview || isFinanceSection ? styles.active : ""
              }`}
              onClick={() => setIsScenarioOpen(!isScenarioOpen)}
              title="은퇴"
            >
              <Target size={20} />
              <span className={styles.navLabel}>은퇴</span>
              <span className={styles.chevron}>
                {isScenarioOpen ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </span>
            </button>

            {isScenarioOpen && (
              <div className={styles.submenu}>
                {/* 순자산, 현금흐름 */}
                {scenarioOverviewMenus.map((item) => {
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
                        <item.icon size={16} />
                        {isCtrlPressed && shortcutDisplay && (
                          <span className={styles.shortcutHint}>{shortcutDisplay}</span>
                        )}
                      </div>
                      <span className={styles.navLabel}>{item.label}</span>
                    </button>
                  );
                })}

                {/* 나의 재무 (서브 그룹) */}
                <button
                  className={`${styles.submenuItem} ${
                    isFinanceSection ? styles.active : ""
                  }`}
                  onClick={() => setIsFinanceOpen(!isFinanceOpen)}
                >
                  <div className={styles.iconWrapper}>
                    <Wallet size={16} />
                  </div>
                  <span className={styles.navLabel}>나의 재무</span>
                  <span className={styles.chevron}>
                    {isFinanceOpen ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                </button>

                {isFinanceOpen && (
                  <div className={styles.nestedSubmenu}>
                    {financeSubmenus.map((item) => {
                      const IconComponent = item.icon;
                      return (
                        <button
                          key={item.id}
                          className={`${styles.nestedItem} ${
                            currentSection === item.id ? styles.active : ""
                          }`}
                          onClick={() => onSectionChange(item.id)}
                          title={item.label}
                        >
                          <IconComponent size={14} />
                          <span className={styles.navLabel}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 시나리오 추가 버튼 */}
            <button className={styles.addScenarioBtn} title="시나리오 추가">
              <span>+ 시나리오 추가</span>
            </button>
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
