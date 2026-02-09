"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, User, Bell, Shield, HelpCircle, ChevronRight, Check, Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ColorMode, type AccentColor } from "@/contexts/ThemeContext";
import styles from "./SettingsTab.module.css";
type ChartThemeId = "default" | "pastel" | "mono" | "vivid" | "ocean" | "sunset" | "forest" | "neon" | "retro" | "candy";

interface AccentColorOption {
  id: AccentColor;
  name: string;
  color: string;
}

interface ChartTheme {
  id: ChartThemeId;
  name: string;
  colors: string[];
}

const accentColors: AccentColorOption[] = [
  { id: "blue", name: "블루", color: "#007aff" },
  { id: "purple", name: "퍼플", color: "#a855f7" },
  { id: "green", name: "그린", color: "#22c55e" },
  { id: "teal", name: "틸", color: "#14b8a6" },
  { id: "indigo", name: "인디고", color: "#6366f1" },
  { id: "rose", name: "로즈", color: "#f43f5e" },
  { id: "orange", name: "오렌지", color: "#f97316" },
  { id: "amber", name: "앰버", color: "#f59e0b" },
  { id: "black", name: "블랙", color: "#525252" },
  { id: "cyan", name: "시안", color: "#06b6d4" },
];

const chartThemes: ChartTheme[] = [
  {
    id: "default",
    name: "기본",
    colors: ["#3b82f6", "#22c55e", "#8b5cf6", "#f59e0b", "#ef4444"],
  },
  {
    id: "pastel",
    name: "파스텔",
    colors: ["#93c5fd", "#86efac", "#c4b5fd", "#fcd34d", "#fca5a5"],
  },
  {
    id: "mono",
    name: "모노톤",
    colors: ["#1f2937", "#374151", "#6b7280", "#9ca3af", "#d1d5db"],
  },
  {
    id: "vivid",
    name: "비비드",
    colors: ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#dc2626"],
  },
  {
    id: "ocean",
    name: "오션",
    colors: ["#0ea5e9", "#06b6d4", "#0891b2", "#0284c7", "#38bdf8"],
  },
  {
    id: "sunset",
    name: "선셋",
    colors: ["#f97316", "#f59e0b", "#ec4899", "#ef4444", "#fb923c"],
  },
  {
    id: "forest",
    name: "포레스트",
    colors: ["#22c55e", "#16a34a", "#84cc16", "#65a30d", "#4ade80"],
  },
  {
    id: "neon",
    name: "네온",
    colors: ["#a855f7", "#06b6d4", "#f43f5e", "#22d3ee", "#d946ef"],
  },
  {
    id: "retro",
    name: "레트로",
    colors: ["#d97706", "#b45309", "#a16207", "#92400e", "#ca8a04"],
  },
  {
    id: "candy",
    name: "캔디",
    colors: ["#ec4899", "#f472b6", "#a855f7", "#c084fc", "#f9a8d4"],
  },
];

interface SettingsTabProps {
  profileName: string;
}

export function SettingsTab({ profileName }: SettingsTabProps) {
  const router = useRouter();
  const { colorMode, accentColor, setColorMode, setAccentColor } = useTheme();
  const [currentChartTheme, setCurrentChartTheme] = useState<ChartThemeId>("default");

  useEffect(() => {
    // 차트 테마 로드
    const savedChart = localStorage.getItem("chart-theme") as ChartThemeId | null;
    if (savedChart && chartThemes.some((t) => t.id === savedChart)) {
      setCurrentChartTheme(savedChart);
    }
  }, []);

  const handleColorModeChange = (mode: ColorMode) => {
    setColorMode(mode);
  };

  const handleAccentColorChange = (accent: AccentColor) => {
    setAccentColor(accent);
  };

  const handleChartThemeChange = (themeId: ChartThemeId) => {
    setCurrentChartTheme(themeId);
    localStorage.setItem("chart-theme", themeId);
    window.dispatchEvent(new CustomEvent("chart-theme-change", { detail: themeId }));
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
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

        {/* Right Column */}
        <div className={styles.rightColumn}>
          {/* 색상 모드 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>색상 모드</h2>
            <div className={styles.colorModeContainer}>
              <button
                className={`${styles.colorModeBtn} ${colorMode === "light" ? styles.colorModeBtnActive : ""}`}
                onClick={() => handleColorModeChange("light")}
              >
                <Sun size={18} />
                <span>라이트</span>
              </button>
              <button
                className={`${styles.colorModeBtn} ${colorMode === "dark" ? styles.colorModeBtnActive : ""}`}
                onClick={() => handleColorModeChange("dark")}
              >
                <Moon size={18} />
                <span>다크</span>
              </button>
              <button
                className={`${styles.colorModeBtn} ${colorMode === "system" ? styles.colorModeBtnActive : ""}`}
                onClick={() => handleColorModeChange("system")}
              >
                <Monitor size={18} />
                <span>시스템</span>
              </button>
            </div>
          </section>

          {/* 액센트 색상 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>액센트 색상</h2>
            <div className={styles.accentGrid}>
              {accentColors.map((color) => (
                <button
                  key={color.id}
                  className={`${styles.accentCard} ${accentColor === color.id ? styles.accentCardActive : ""}`}
                  onClick={() => handleAccentColorChange(color.id)}
                >
                  <div
                    className={styles.accentDot}
                    style={{ backgroundColor: color.color }}
                  />
                  <span className={styles.accentName}>{color.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 차트 색상 설정 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>차트 색상</h2>
            <div className={styles.chartList}>
              {chartThemes.map((theme) => (
                <button
                  key={theme.id}
                  className={`${styles.chartRow} ${currentChartTheme === theme.id ? styles.chartRowActive : ""}`}
                  onClick={() => handleChartThemeChange(theme.id)}
                >
                  <div className={styles.chartDots}>
                    {theme.colors.map((color, idx) => (
                      <div
                        key={idx}
                        className={styles.chartDot}
                        style={{ backgroundColor: color, zIndex: theme.colors.length - idx }}
                      />
                    ))}
                  </div>
                  <span className={styles.chartThemeName}>{theme.name}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
