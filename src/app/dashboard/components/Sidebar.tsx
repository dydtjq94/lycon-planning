"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ChevronDown,
  ChevronRight,
  Settings,
  PieChart,
  Receipt,
  MessageCircle,
  CalendarCheck,
  LayoutDashboard,
  Plus,
  Layers,
  TrendingUp,
  Target,
  LineChart,
  PiggyBank,
  X,
} from "lucide-react";
import type { Simulation } from "@/types";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  unreadMessageCount?: number;
  simulations?: Simulation[];
  currentSimulationId?: string;
  onSimulationChange?: (simulationId: string) => void;
  onAddSimulation?: () => void;
  onDeleteSimulation?: (simulationId: string) => void;
}

// 담당자 관련
const expertMenu = [
  { id: "messages", label: "채팅", icon: MessageCircle },
  { id: "consultation", label: "상담", icon: CalendarCheck },
];

// 재무 관리
const financeMenu = [
  { id: "household-budget", label: "가계부", icon: Receipt },
  { id: "savings-deposits", label: "정기 예금/적금", icon: PiggyBank },
  { id: "portfolio", label: "투자 포트폴리오", icon: LineChart },
  { id: "current-asset", label: "현재 자산", icon: PieChart },
];

// 분석
const analysisMenu = [
  { id: "progress", label: "자산 추이", icon: TrendingUp },
];

// 단축키용 탭 매핑 (위에서부터 순서대로)
const shortcutTabs: { key: string; id: string; display: string }[] = [
  { key: "1", id: "dashboard", display: "1" },
  { key: "2", id: "household-budget", display: "2" },
  { key: "3", id: "savings-deposits", display: "3" },
  { key: "4", id: "portfolio", display: "4" },
  { key: "5", id: "current-asset", display: "5" },
  { key: "6", id: "progress", display: "6" },
  { key: "7", id: "messages", display: "7" },
  { key: "8", id: "consultation", display: "8" },
];

export function Sidebar({
  currentSection,
  onSectionChange,
  unreadMessageCount = 0,
  simulations = [],
  currentSimulationId,
  onSimulationChange,
  onAddSimulation,
  onDeleteSimulation,
}: SidebarProps) {
  const [isScenarioOpen, setIsScenarioOpen] = useState(true);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // ThemeContext에서 테마 상태 가져오기
  const { resolvedColorMode, accentColor } = useTheme();

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

  const getShortcutDisplay = (sectionId: string): string | null => {
    const shortcut = shortcutTabs.find(s => s.id === sectionId);
    return shortcut ? shortcut.display : null;
  };

  const handleScenarioClick = (simulationId: string) => {
    // handleSimulationChange가 섹션 변경도 함께 처리함
    onSimulationChange?.(simulationId);
  };

  // 시뮬레이션 섹션이 활성화되어 있는지
  const isScenarioActive = currentSection === "simulation";

  return (
    <aside
      className={`${styles.sidebar} ${styles.expanded}`}
      data-color-mode={resolvedColorMode}
      data-accent={accentColor}
    >
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          {/* 로고 */}
          <div className={styles.logoRow}>
            <div className={styles.logoItem}>
              <span className={styles.logoLetter}>L</span>
              <span className={styles.logoText}>ycon</span>
            </div>
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

          {/* 시장 정보 */}
          {analysisMenu.map((item) => {
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
                  <div
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
                    {!sim.is_default && onDeleteSimulation && (
                      <button
                        className={styles.deleteSimBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`"${sim.title}" 시뮬레이션을 삭제하시겠습니까?`)) {
                            onDeleteSimulation(sim.id);
                          }
                        }}
                        title="삭제"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {/* 시뮬레이션 추가 버튼 */}
                <button
                  className={styles.addScenarioBtn}
                  title="시뮬레이션 추가"
                  onClick={onAddSimulation}
                >
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
        <div className={`${styles.sectionLabel} ${styles.expert}`}>담당: 손균우 전문가</div>
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
          className={`${styles.footerItem} ${
            currentSection === "settings" ? styles.active : ""
          }`}
          onClick={() => onSectionChange("settings")}
          title="설정"
        >
          <div className={styles.iconWrapper}>
            <Settings size={18} />
          </div>
          <span className={styles.navLabel}>설정</span>
        </button>
      </div>
    </aside>
  );
}
