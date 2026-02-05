"use client";

import { useEffect } from "react";
import { useChartTheme } from "@/hooks/useChartTheme";

/**
 * CSS 변수로 차트 테마 색상을 전역에 적용하는 컴포넌트
 * 레이아웃에 포함시켜서 전체 앱에서 사용 가능하게 함
 */
export function ChartThemeProvider({ children }: { children: React.ReactNode }) {
  const { chartLineColors } = useChartTheme();

  useEffect(() => {
    // CSS 변수로 테마 색상 설정
    const root = document.documentElement;
    root.style.setProperty("--chart-line-color", chartLineColors.value);
    root.style.setProperty("--chart-profit-color", chartLineColors.profit);
    root.style.setProperty("--chart-loss-color", chartLineColors.loss);
    root.style.setProperty("--chart-buy-color", chartLineColors.buy);
    root.style.setProperty("--chart-sell-color", chartLineColors.sell);
  }, [chartLineColors]);

  return <>{children}</>;
}
