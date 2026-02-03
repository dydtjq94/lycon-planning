"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./settings.module.css";

type ThemeId = "dark" | "darker" | "light" | "blue";

interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  preview: {
    bg: string;
    itemBg: string;
    text: string;
    textMuted: string;
  };
}

const themes: Theme[] = [
  {
    id: "darker",
    name: "다크 (기본)",
    description: "선명한 텍스트",
    preview: {
      bg: "#0f0f0f",
      itemBg: "#1f1f1f",
      text: "#ffffff",
      textMuted: "#cccccc",
    },
  },
  {
    id: "dark",
    name: "다크 (소프트)",
    description: "부드러운 대비",
    preview: {
      bg: "#1a1a1a",
      itemBg: "#2a2a2a",
      text: "#ffffff",
      textMuted: "#aaaaaa",
    },
  },
  {
    id: "light",
    name: "라이트",
    description: "밝은 배경",
    preview: {
      bg: "#f5f5f7",
      itemBg: "#ffffff",
      text: "#1d1d1f",
      textMuted: "#6e6e73",
    },
  },
  {
    id: "blue",
    name: "네이비",
    description: "네이비 블루",
    preview: {
      bg: "#1e2a3a",
      itemBg: "#2a3a4d",
      text: "#ffffff",
      textMuted: "#9cb3c9",
    },
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState<ThemeId>("darker");

  useEffect(() => {
    const saved = localStorage.getItem("admin-theme") as ThemeId | null;
    if (saved && themes.some((t) => t.id === saved)) {
      setCurrentTheme(saved);
    }
  }, []);

  const handleThemeChange = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    localStorage.setItem("admin-theme", themeId);
    // 테마 적용을 위한 커스텀 이벤트
    window.dispatchEvent(new CustomEvent("admin-theme-change", { detail: themeId }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => router.back()}>
          <ChevronLeft size={18} />
        </button>
        <h1 className={styles.title}>설정</h1>
      </div>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>사이드바 테마</h2>
          <p className={styles.sectionDesc}>사이드바의 색상 테마를 선택하세요</p>

          <div className={styles.themeGrid}>
            {themes.map((theme) => (
              <button
                key={theme.id}
                className={`${styles.themeCard} ${currentTheme === theme.id ? styles.themeCardActive : ""}`}
                onClick={() => handleThemeChange(theme.id)}
              >
                {/* 미리보기 */}
                <div
                  className={styles.themePreview}
                  style={{ backgroundColor: theme.preview.bg }}
                >
                  <div
                    className={styles.previewItem}
                    style={{ backgroundColor: theme.preview.itemBg }}
                  >
                    <div
                      className={styles.previewDot}
                      style={{ backgroundColor: theme.preview.text }}
                    />
                    <div
                      className={styles.previewLine}
                      style={{ backgroundColor: theme.preview.text }}
                    />
                  </div>
                  <div
                    className={styles.previewItem}
                    style={{ backgroundColor: "transparent" }}
                  >
                    <div
                      className={styles.previewDot}
                      style={{ backgroundColor: theme.preview.textMuted }}
                    />
                    <div
                      className={styles.previewLine}
                      style={{ backgroundColor: theme.preview.textMuted }}
                    />
                  </div>
                  <div
                    className={styles.previewItem}
                    style={{ backgroundColor: "transparent" }}
                  >
                    <div
                      className={styles.previewDot}
                      style={{ backgroundColor: theme.preview.textMuted }}
                    />
                    <div
                      className={styles.previewLine}
                      style={{ backgroundColor: theme.preview.textMuted }}
                    />
                  </div>
                </div>

                {/* 정보 */}
                <div className={styles.themeInfo}>
                  <span className={styles.themeName}>{theme.name}</span>
                  <span className={styles.themeDesc}>{theme.description}</span>
                </div>

                {/* 선택 표시 */}
                {currentTheme === theme.id && (
                  <div className={styles.checkMark}>
                    <Check size={16} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
