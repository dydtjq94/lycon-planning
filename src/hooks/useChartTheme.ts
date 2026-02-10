"use client";

import { useState, useEffect, useMemo } from "react";

type ChartThemeId = "default" | "pastel" | "mono" | "vivid" | "ocean" | "sunset" | "forest" | "neon" | "retro" | "candy";
type ColorMode = "light" | "dark";

// 카테고리별 테마 색상 인덱스
// 0: 저축(blue), 1: 투자(green), 2: 부동산(purple), 3: 실물자산(orange), 4: 부채(gray/red)
const chartThemes: Record<ChartThemeId, string[]> = {
  default: ["#3b82f6", "#22c55e", "#8b5cf6", "#f59e0b", "#94a3b8", "#06b6d4", "#ec4899", "#84cc16"],
  pastel: ["#93c5fd", "#86efac", "#c4b5fd", "#fcd34d", "#cbd5e1", "#67e8f9", "#f9a8d4", "#bef264"],
  mono: ["#1f2937", "#374151", "#4b5563", "#6b7280", "#9ca3af", "#d1d5db", "#475569", "#64748b"],
  vivid: ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#64748b", "#0891b2", "#db2777", "#65a30d"],
  ocean: ["#0ea5e9", "#06b6d4", "#0891b2", "#0284c7", "#64748b", "#38bdf8", "#22d3ee", "#7dd3fc"],
  sunset: ["#f97316", "#f59e0b", "#ec4899", "#ef4444", "#78716c", "#fb923c", "#fbbf24", "#f472b6"],
  forest: ["#22c55e", "#16a34a", "#84cc16", "#65a30d", "#737373", "#4ade80", "#a3e635", "#86efac"],
  neon: ["#a855f7", "#06b6d4", "#f43f5e", "#22d3ee", "#6b7280", "#d946ef", "#2dd4bf", "#fb7185"],
  retro: ["#d97706", "#b45309", "#a16207", "#92400e", "#78716c", "#ca8a04", "#854d0e", "#fbbf24"],
  candy: ["#ec4899", "#f472b6", "#a855f7", "#c084fc", "#9ca3af", "#f9a8d4", "#e879f9", "#f0abfc"],
};

// 라인 차트 색상 (가격/평가금액)
const lineChartColors: Record<ChartThemeId, string> = {
  default: "#10b981",  // emerald
  pastel: "#6ee7b7",   // emerald light
  mono: "#374151",     // gray
  vivid: "#059669",    // emerald dark
  ocean: "#0ea5e9",    // sky blue
  sunset: "#f97316",   // orange
  forest: "#22c55e",   // green
  neon: "#a855f7",     // purple
  retro: "#d97706",    // amber
  candy: "#ec4899",    // pink
};

// 손익/매수매도 색상 (한국식: 상승=빨강, 하락=파랑)
const profitLossColors: Record<ChartThemeId, { profit: string; loss: string }> = {
  default: { profit: "#ef4444", loss: "#3b82f6" },
  pastel: { profit: "#fca5a5", loss: "#93c5fd" },
  mono: { profit: "#1f2937", loss: "#9ca3af" },
  vivid: { profit: "#dc2626", loss: "#2563eb" },
  ocean: { profit: "#f97316", loss: "#0ea5e9" },
  sunset: { profit: "#ef4444", loss: "#8b5cf6" },
  forest: { profit: "#ef4444", loss: "#22c55e" },
  neon: { profit: "#f43f5e", loss: "#06b6d4" },
  retro: { profit: "#dc2626", loss: "#1d4ed8" },
  candy: { profit: "#f43f5e", loss: "#a855f7" },
};

// HEX to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

// RGB to HEX
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

// 색상 밝기 조절 (amount: -1 ~ 1, 양수면 밝게, 음수면 어둡게)
function adjustBrightness(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = amount > 0 ? (1 - amount) : (1 + amount);
  const target = amount > 0 ? 255 : 0;

  return rgbToHex(
    r + (target - r) * Math.abs(amount),
    g + (target - g) * Math.abs(amount),
    b + (target - b) * Math.abs(amount)
  );
}

// 기본 색상에서 그라데이션 배열 생성
function generateShades(baseColor: string, count: number): string[] {
  const shades: string[] = [baseColor];
  for (let i = 1; i < count; i++) {
    shades.push(adjustBrightness(baseColor, i * 0.15));
  }
  return shades;
}

// 다크모드 resolve 함수
function getResolvedColorMode(): ColorMode {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem("color-mode");
  if (saved === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return (saved as ColorMode) || "dark";
}

export function useChartTheme() {
  const [themeId, setThemeId] = useState<ChartThemeId>(() => {
    if (typeof window === "undefined") return "default";
    const saved = localStorage.getItem("chart-theme") as ChartThemeId | null;
    return (saved && saved in chartThemes) ? saved : "default";
  });
  const [colorMode, setColorMode] = useState<ColorMode>(() => getResolvedColorMode());
  const [isReady, setIsReady] = useState(true);

  useEffect(() => {
    // 차트 테마 변경 이벤트 리스너
    const handleChartThemeChange = (e: CustomEvent<ChartThemeId>) => {
      if (e.detail in chartThemes) {
        setThemeId(e.detail);
      }
    };

    // 색상 모드 변경 이벤트 리스너
    const handleThemeChange = (e: CustomEvent<{ mode: string; accent: string; resolved?: ColorMode }>) => {
      if (e.detail.resolved) {
        setColorMode(e.detail.resolved);
      } else {
        setColorMode(getResolvedColorMode());
      }
    };

    // 시스템 테마 변경 감지
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const savedMode = localStorage.getItem("color-mode");
      if (savedMode === "system") {
        setColorMode(mediaQuery.matches ? "dark" : "light");
      }
    };

    window.addEventListener("chart-theme-change", handleChartThemeChange as EventListener);
    window.addEventListener("theme-change", handleThemeChange as EventListener);
    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      window.removeEventListener("chart-theme-change", handleChartThemeChange as EventListener);
      window.removeEventListener("theme-change", handleThemeChange as EventListener);
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, []);

  const colors = chartThemes[themeId];
  const lineColor = lineChartColors[themeId];
  const plColors = profitLossColors[themeId];

  // 카테고리별 색상
  const categoryColors = useMemo(() => ({
    savings: colors[0],      // 저축
    investment: colors[1],   // 투자
    realEstate: colors[2],   // 부동산
    realAsset: colors[3],    // 실물자산
    debt: colors[4],         // 부채
    extra1: colors[5],
    extra2: colors[6],
    extra3: colors[7],
  }), [colors]);

  // 라인 차트용 색상
  const chartLineColors = useMemo(() => ({
    price: lineColor,        // 가격/종가 라인
    value: lineColor,        // 평가금액 라인
    profit: plColors.profit, // 수익 (빨강)
    loss: plColors.loss,     // 손실 (파랑)
    buy: plColors.profit,    // 매수 (빨강)
    sell: plColors.loss,     // 매도 (파랑)
    expense: colors[3],      // 비용/적자 (Sankey 비용 색상과 통일)
  }), [lineColor, plColors, colors]);

  // 카테고리별 그라데이션 배열
  const categoryShades = useMemo(() => ({
    savings: generateShades(colors[0], 5),
    investment: generateShades(colors[1], 5),
    realEstate: generateShades(colors[2], 5),
    realAsset: generateShades(colors[3], 5),
    debt: generateShades(colors[4], 8),
  }), [colors]);

  // rgba 변환 유틸리티
  const toRgba = (hex: string, alpha: number) => {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // 다크모드 여부
  const isDark = colorMode === "dark";

  // 차트 스케일/그리드/툴팁 색상 (다크모드 지원 - 슬랙 스타일)
  const chartScaleColors = useMemo(() => ({
    gridColor: isDark ? "#35373b" : "#f5f5f4",
    tickColor: isDark ? "#9a9b9e" : "#a8a29e",
    textColor: isDark ? "#e8e8e8" : "#1d1d1f",
    textSecondary: isDark ? "#9a9b9e" : "#6b7280",
    tooltipBg: isDark ? "rgba(34, 37, 41, 0.5)" : "rgba(255, 255, 255, 0.5)",
    tooltipBorder: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
    tooltipText: isDark ? "#e8e8e8" : "#1d1d1f",
    // 도넛 차트용 색상
    doughnutBorder: isDark ? "#1a1d21" : "#ffffff",
    emptyState: isDark ? "#35373b" : "#e5e7eb",
  }), [isDark]);

  return {
    themeId,
    colorMode,
    isDark,
    isReady,
    colors,
    categoryColors,
    categoryShades,
    chartLineColors,
    chartScaleColors,
    toRgba,
    getColor: (index: number) => colors[index % colors.length],
    getShade: (baseColor: string, index: number, total: number = 5) => {
      const shades = generateShades(baseColor, total);
      return shades[index % shades.length];
    },
  };
}
