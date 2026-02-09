"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type ColorMode = "light" | "dark" | "system";
export type AccentColor = "blue" | "purple" | "green" | "rose" | "orange" | "black" | "teal" | "indigo" | "amber" | "cyan";

interface ThemeContextType {
  colorMode: ColorMode;
  accentColor: AccentColor;
  resolvedColorMode: "light" | "dark";
  setColorMode: (mode: ColorMode) => void;
  setAccentColor: (color: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const accentColorValues: Record<AccentColor, { primary: string; primaryHover: string; primaryLight: string }> = {
  blue: { primary: "#007aff", primaryHover: "#0066d6", primaryLight: "#e5f1ff" },
  purple: { primary: "#a855f7", primaryHover: "#9333ea", primaryLight: "#faf5ff" },
  green: { primary: "#22c55e", primaryHover: "#16a34a", primaryLight: "#f0fdf4" },
  rose: { primary: "#f43f5e", primaryHover: "#e11d48", primaryLight: "#fff1f2" },
  orange: { primary: "#f97316", primaryHover: "#ea580c", primaryLight: "#fff7ed" },
  black: { primary: "#525252", primaryHover: "#404040", primaryLight: "#f5f5f5" },
  teal: { primary: "#14b8a6", primaryHover: "#0d9488", primaryLight: "#f0fdfa" },
  indigo: { primary: "#6366f1", primaryHover: "#4f46e5", primaryLight: "#eef2ff" },
  amber: { primary: "#f59e0b", primaryHover: "#d97706", primaryLight: "#fffbeb" },
  cyan: { primary: "#06b6d4", primaryHover: "#0891b2", primaryLight: "#ecfeff" },
};

// 사이드바/헤더 배경 색상 (색상모드 + 액센트별)
const sidebarColors: Record<"light" | "dark", Record<AccentColor, { bg: string; border: string; text: string; textMuted: string }>> = {
  light: {
    blue: { bg: "#f0f7ff", border: "#e2eef9", text: "#3a5570", textMuted: "#6b8db0" },
    purple: { bg: "#f8f5ff", border: "#e8e0f5", text: "#5a4070", textMuted: "#9078a8" },
    green: { bg: "#f0fdf5", border: "#d5f5e3", text: "#2d5a45", textMuted: "#4d9066" },
    rose: { bg: "#fff5f6", border: "#fde0e4", text: "#703040", textMuted: "#b0606e" },
    orange: { bg: "#fffaf5", border: "#ffe5d0", text: "#804020", textMuted: "#c07040" },
    black: { bg: "#f7f7f7", border: "#e5e5e5", text: "#404040", textMuted: "#737373" },
    teal: { bg: "#f0fdfa", border: "#d5f5f0", text: "#2d5a52", textMuted: "#4d9088" },
    indigo: { bg: "#f0f2ff", border: "#e0e4f8", text: "#3a4070", textMuted: "#6b78a8" },
    amber: { bg: "#fffcf0", border: "#fef0c8", text: "#705020", textMuted: "#a08040" },
    cyan: { bg: "#f0fdff", border: "#d5f5fa", text: "#2d5560", textMuted: "#4d8a95" },
  },
  dark: {
    blue: { bg: "#1a2333", border: "#2a3a52", text: "#e8e8e8", textMuted: "#9a9b9e" },
    purple: { bg: "#251f38", border: "#3a3058", text: "#e8e8e8", textMuted: "#9a9b9e" },
    green: { bg: "#1a2a22", border: "#2a4038", text: "#e8e8e8", textMuted: "#9a9b9e" },
    rose: { bg: "#2a1a20", border: "#452a35", text: "#e8e8e8", textMuted: "#9a9b9e" },
    orange: { bg: "#2a2218", border: "#453828", text: "#e8e8e8", textMuted: "#9a9b9e" },
    black: { bg: "#1e2126", border: "#35373b", text: "#e8e8e8", textMuted: "#9a9b9e" },
    teal: { bg: "#1a2a28", border: "#2a4540", text: "#e8e8e8", textMuted: "#9a9b9e" },
    indigo: { bg: "#1f1f38", border: "#303050", text: "#e8e8e8", textMuted: "#9a9b9e" },
    amber: { bg: "#2a2518", border: "#454028", text: "#e8e8e8", textMuted: "#9a9b9e" },
    cyan: { bg: "#1a2a2e", border: "#2a4548", text: "#e8e8e8", textMuted: "#9a9b9e" },
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>("dark");
  const [accentColor, setAccentColorState] = useState<AccentColor>("blue");
  const [resolvedColorMode, setResolvedColorMode] = useState<"light" | "dark">("dark");

  // 시스템 테마 감지
  const getSystemTheme = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  // resolved 모드 계산
  const resolveColorMode = useCallback((mode: ColorMode): "light" | "dark" => {
    if (mode === "system") {
      return getSystemTheme();
    }
    return mode;
  }, [getSystemTheme]);

  // DOM에 테마 클래스 적용
  const applyTheme = useCallback((resolved: "light" | "dark", accent: AccentColor) => {
    const root = document.documentElement;

    // dark 클래스 토글
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // 액센트 색상 CSS 변수 업데이트
    const accentValues = accentColorValues[accent];
    root.style.setProperty("--accent-color", accentValues.primary);
    root.style.setProperty("--accent-primary", accentValues.primary);
    root.style.setProperty("--accent-primary-hover", accentValues.primaryHover);
    root.style.setProperty("--accent-primary-light", accentValues.primaryLight);
    root.style.setProperty("--accent-color-light", accentValues.primaryLight);

    // 사이드바/헤더 색상 CSS 변수 업데이트
    const sidebarVals = sidebarColors[resolved][accent];
    root.style.setProperty("--sidebar-bg", sidebarVals.bg);
    root.style.setProperty("--sidebar-border", sidebarVals.border);
    root.style.setProperty("--sidebar-text", sidebarVals.text);
    root.style.setProperty("--sidebar-text-muted", sidebarVals.textMuted);
  }, []);

  // 초기 로드
  useEffect(() => {
    const savedMode = localStorage.getItem("color-mode") as ColorMode | null;
    const savedAccent = localStorage.getItem("accent-color") as AccentColor | null;

    // 기존 테마 마이그레이션
    if (!savedMode && !savedAccent) {
      const oldTheme = localStorage.getItem("user-theme");
      if (oldTheme) {
        let newMode: ColorMode = "dark";
        let newAccent: AccentColor = "blue";

        if (oldTheme === "light") {
          newMode = "light";
        } else if (["purple", "green", "rose", "orange"].includes(oldTheme)) {
          newAccent = oldTheme as AccentColor;
        }

        setColorModeState(newMode);
        setAccentColorState(newAccent);
        localStorage.setItem("color-mode", newMode);
        localStorage.setItem("accent-color", newAccent);

        const resolved = resolveColorMode(newMode);
        setResolvedColorMode(resolved);
        applyTheme(resolved, newAccent);
        return;
      }
    }

    const mode = savedMode || "dark";
    const accent = (savedAccent && savedAccent in accentColorValues) ? savedAccent : "blue";

    setColorModeState(mode);
    setAccentColorState(accent);

    const resolved = resolveColorMode(mode);
    setResolvedColorMode(resolved);
    applyTheme(resolved, accent);
  }, [resolveColorMode, applyTheme]);

  // 시스템 테마 변경 감지
  useEffect(() => {
    if (colorMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const resolved = getSystemTheme();
      setResolvedColorMode(resolved);
      applyTheme(resolved, accentColor);

      // 다른 컴포넌트에 알림
      window.dispatchEvent(new CustomEvent("theme-change", {
        detail: { mode: colorMode, accent: accentColor, resolved }
      }));
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [colorMode, accentColor, getSystemTheme, applyTheme]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    localStorage.setItem("color-mode", mode);

    const resolved = resolveColorMode(mode);
    setResolvedColorMode(resolved);
    applyTheme(resolved, accentColor);

    // 다른 컴포넌트에 알림
    window.dispatchEvent(new CustomEvent("theme-change", {
      detail: { mode, accent: accentColor, resolved }
    }));
  }, [accentColor, resolveColorMode, applyTheme]);

  const setAccentColor = useCallback((accent: AccentColor) => {
    setAccentColorState(accent);
    localStorage.setItem("accent-color", accent);
    applyTheme(resolvedColorMode, accent);

    // 다른 컴포넌트에 알림
    window.dispatchEvent(new CustomEvent("theme-change", {
      detail: { mode: colorMode, accent, resolved: resolvedColorMode }
    }));
  }, [colorMode, resolvedColorMode, applyTheme]);

  return (
    <ThemeContext.Provider value={{ colorMode, accentColor, resolvedColorMode, setColorMode, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
