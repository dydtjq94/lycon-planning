"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Settings,
  PieChart,
  Receipt,
  Pin,
  MessageCircle,
  CalendarCheck,
  LayoutDashboard,
  Plus,
  Layers,
  TrendingUp,
  Target,
} from "lucide-react";
import type { Simulation } from "@/types";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  unreadMessageCount?: number;
  simulations?: Simulation[];
  currentSimulationId?: string;
  onSimulationChange?: (simulationId: string) => void;
}

// 담당자 관련
const expertMenu = [
  { id: "messages", label: "채팅", icon: MessageCircle },
  { id: "consultation", label: "상담", icon: CalendarCheck },
];

// 재무 현황
const financeMenu = [
  { id: "current-asset", label: "현재 자산", icon: PieChart },
  { id: "progress", label: "프로그레스", icon: TrendingUp },
  { id: "household-budget", label: "가계부", icon: Receipt },
];

// 단축키용 탭 매핑 (위에서부터 순서대로)
const shortcutTabs: { key: string; id: string; display: string }[] = [
  { key: "1", id: "dashboard", display: "1" },
  { key: "2", id: "current-asset", display: "2" },
  { key: "3", id: "progress", display: "3" },
  { key: "4", id: "household-budget", display: "4" },
  { key: "5", id: "messages", display: "5" },
  { key: "6", id: "consultation", display: "6" },
];

export function Sidebar({
  currentSection,
  onSectionChange,
  isExpanded,
  onExpandChange,
  unreadMessageCount = 0,
  simulations = [],
  currentSimulationId,
  onSimulationChange,
}: SidebarProps) {
  const router = useRouter();
  const [isScenarioOpen, setIsScenarioOpen] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        setIsCtrlPressed(true);
      }

      if (e.ctrlKey) {
        const shortcut = shortcutTabs.find(s => s.key === e.key);
        if (shortcut) {
          e.preventDefault();
          onSectionChange(shortcut.id);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        setIsCtrlPressed(false);
      }
    };

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

  const getShortcutDisplay = (sectionId: string): string | null => {
    const shortcut = shortcutTabs.find(s => s.id === sectionId);
    return shortcut ? shortcut.display : null;
  };

  const handleScenarioClick = (simulationId: string) => {
    onSimulationChange?.(simulationId);
    onSectionChange("scenario");
  };

  // 시나리오 섹션이 활성화되어 있는지
  const isScenarioActive = currentSection === "scenario";

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
              <span className={styles.logoText}>ycon</span>
            </div>
            <button
              className={`${styles.pinButton} ${isPinned ? styles.pinned : ""}`}
              onClick={handlePin}
              title={isPinned ? "고정 해제" : "사이드바 고정"}
            >
              <Pin size={14} fill={isPinned ? "currentColor" : "none"} />
            </button>
          </div>

          {/* 대시보드 */}
          <button
            className={`${styles.navItem} ${
              currentSection === "dashboard" ? styles.active : ""
            }`}
            onClick={() => onSectionChange("dashboard")}
            title="대시보드"
          >
            <div className={styles.iconWrapper}>
              <LayoutDashboard size={20} />
              {isCtrlPressed && (
                <span className={styles.shortcutHint}>1</span>
              )}
            </div>
            <span className={styles.navLabel}>대시보드</span>
          </button>

          {/* 간격 */}
          <div className={styles.spacer} />

          {/* 재무 현황 */}
          {financeMenu.map((item) => {
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

          {/* 간격 */}
          <div className={styles.spacer} />

          {/* 시뮬레이션 */}
          <div className={styles.navGroup}>
            <button
              className={`${styles.navItem} ${isScenarioActive ? styles.active : ""}`}
              onClick={() => setIsScenarioOpen(!isScenarioOpen)}
              title="시뮬레이션"
            >
              <div className={styles.iconWrapper}>
                <Layers size={20} />
              </div>
              <span className={styles.navLabel}>시뮬레이션</span>
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
                {simulations.map((sim) => (
                  <button
                    key={sim.id}
                    className={`${styles.submenuItem} ${
                      isScenarioActive && currentSimulationId === sim.id ? styles.active : ""
                    }`}
                    onClick={() => handleScenarioClick(sim.id)}
                    title={sim.title}
                  >
                    <div className={styles.iconWrapper}>
                      <Target size={16} />
                    </div>
                    <span className={styles.navLabel}>{sim.title}</span>
                  </button>
                ))}

                {/* 시뮬레이션 추가 버튼 */}
                <button className={styles.addScenarioBtn} title="시뮬레이션 추가">
                  <Plus size={14} />
                  <span>시뮬레이션 추가</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className={styles.footer}>
        {/* 담당 전문가 */}
        <div className={styles.sectionLabel}>담당 전문가</div>
        {expertMenu.map((item) => {
          const shortcutDisplay = getShortcutDisplay(item.id);
          return (
            <button
              key={item.id}
              className={`${styles.footerItem} ${
                currentSection === item.id ? styles.active : ""
              }`}
              onClick={() => onSectionChange(item.id)}
              title={item.label}
            >
              <div className={styles.iconWrapper}>
                <item.icon size={18} />
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

        <div className={styles.spacer} />

        <button
          className={styles.footerItem}
          onClick={() => router.push("/onboarding")}
          title="설정"
        >
          <div className={styles.iconWrapper}>
            <Settings size={18} />
          </div>
          <span className={styles.navLabel}>설정</span>
        </button>
        <button
          className={styles.footerItem}
          onClick={handleLogout}
          title="로그아웃"
        >
          <div className={styles.iconWrapper}>
            <LogOut size={18} />
          </div>
          <span className={styles.navLabel}>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
