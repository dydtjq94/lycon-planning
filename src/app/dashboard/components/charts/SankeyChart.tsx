"use client";

import { useEffect, useRef, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { SankeyController, Flow } from "chartjs-chart-sankey";
import type { SimulationResult } from "@/lib/services/simulationEngine";
import { useChartTheme } from "@/hooks/useChartTheme";
import styles from "./Charts.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  SankeyController,
  Flow
);

// 기본 애니메이션 설정 제거 - 인스턴스별 설정 사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sankeyDefaults = SankeyController.defaults as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flowDefaults = Flow.defaults as any;

// 기본 딜레이 함수 제거 (인스턴스 옵션에서 커스텀 딜레이 사용)
if (sankeyDefaults?.animations) {
  delete sankeyDefaults.animations;
}
if (flowDefaults?.animations) {
  delete flowDefaults.animations;
}

interface SankeyChartProps {
  simulationResult: SimulationResult;
  selectedYear: number;
}

// 금액 포맷팅 (간결하게)
function formatMoney(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount >= 10000) {
    const uk = Math.floor(absAmount / 10000);
    const man = Math.round(absAmount % 10000);
    if (man === 0) {
      return `${uk}억`;
    }
    return `${uk}억${man.toLocaleString()}만`;
  }
  return `${absAmount.toLocaleString()}만`;
}

// 라벨 간략화
function shortenLabel(title: string): string {
  let short = title.replace(/\s*\|\s*(본인|공동|배우자)/, "");
  short = short.replace(" (은퇴 전)", "");
  short = short.replace(" (은퇴 후)", "(후)");
  short = short.replace("창업 대출 ", "");
  short = short.replace("주거 ", "");
  if (short.length > 8) {
    short = short.substring(0, 7) + "..";
  }
  return short;
}

// 소득 타입을 카테고리로 분류
function getIncomeCategory(type: string, title: string): string {
  const categoryMap: Record<string, string> = {
    labor: "근로소득",
    business: "사업소득",
    pension: "연금소득",
    national: "연금소득",
    retirement: "연금소득",
    personal: "연금소득",
    irp: "연금소득",
    rental: "임대소득",
    dividend: "금융소득",
    interest: "금융소득",
    financial: "금융소득",
  };

  if (type && categoryMap[type]) {
    return categoryMap[type];
  }

  if (title.includes("급여") || title.includes("근로")) return "근로소득";
  if (title.includes("사업")) return "사업소득";
  if (title.includes("연금") || title.includes("IRP")) return "연금소득";
  if (title.includes("임대") || title.includes("월세")) return "임대소득";
  if (title.includes("배당") || title.includes("이자")) return "금융소득";

  return "기타소득";
}

// 지출 타입을 상위 카테고리로 분류 (더 단순하게)
function getExpenseCategory(type: string, title: string): string {
  // 부채상환
  if (
    type === "interest" ||
    type === "loan" ||
    title.includes("이자") ||
    title.includes("원금") ||
    title.includes("대출")
  ) {
    return "부채상환";
  }
  // 주거비
  if (
    type === "housing" ||
    type === "maintenance" ||
    title.includes("관리비") ||
    title.includes("월세") ||
    title.includes("주거")
  ) {
    return "주거비";
  }
  // 의료비
  if (
    type === "health" ||
    type === "medical" ||
    title.includes("의료") ||
    title.includes("병원")
  ) {
    return "의료비";
  }
  // 나머지는 생활비로 통합
  return "생활비";
}

export function SankeyChart({
  simulationResult,
  selectedYear,
}: SankeyChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<ChartJS | null>(null);
  const { chartScaleColors, isDark, categoryColors, categoryShades, chartLineColors } = useChartTheme();

  // 동적 카테고리 색상 (테마 기반)
  const CATEGORY_COLORS: Record<string, string> = useMemo(() => ({
    // 소득 (투자/저축 색상 계열)
    근로소득: categoryShades.investment[0],
    사업소득: categoryShades.investment[1],
    연금소득: categoryShades.investment[2],
    임대소득: categoryShades.savings[1],
    금융소득: categoryShades.savings[2],
    기타소득: categoryColors.debt,

    // 중간 노드
    "총 유입": chartLineColors.price,

    // 지출 (손실 색상 계열 - 빨강)
    생활비: chartLineColors.profit,
    주거비: categoryShades.realAsset[0],
    의료비: categoryShades.realAsset[1],
    부채상환: categoryShades.realAsset[2],
    기타지출: categoryColors.debt,

    // 저축 (저축 색상)
    잉여현금: categoryColors.savings,
    "저축/투자": categoryColors.savings,
  }), [categoryColors, categoryShades, chartLineColors, isDark]);

  const snapshot = useMemo(() => {
    return simulationResult.snapshots.find((s) => s.year === selectedYear);
  }, [simulationResult.snapshots, selectedYear]);

  // 데이터 준비 - 더 단순하게
  const {
    flows,
    labels,
    colorMap,
    priority,
    totalIncome,
    nodeCount,
    columnMap,
  } = useMemo(() => {
    if (!snapshot) {
      return {
        flows: [],
        labels: {},
        colorMap: {},
        priority: {},
        totalIncome: 0,
        nodeCount: 0,
        columnMap: {},
      };
    }

    const flows: { from: string; to: string; flow: number }[] = [];
    // 각 노드가 어떤 컬럼에 있는지 추적 (왼쪽→오른쪽 애니메이션용)
    const columnMap: Record<string, number> = {};
    const labels: Record<string, string> = {};
    const colorMap: Record<string, string> = { ...CATEGORY_COLORS };
    const priority: Record<string, number> = {};

    const totalIncome = snapshot.totalIncome;
    const totalExpense = snapshot.totalExpense;
    const savings = Math.max(0, totalIncome - totalExpense);

    // 최소 표시 금액 (총 소득의 2% 미만은 기타로 통합)
    const minAmount = totalIncome * 0.02;

    // 소득 처리 - 카테고리별 그룹화
    const incomeByCategory: Record<
      string,
      { items: { title: string; amount: number }[]; total: number }
    > = {};

    snapshot.incomeBreakdown.forEach(
      (item: { title: string; amount: number; type?: string }) => {
        if (item.amount <= 0) return;
        const category = getIncomeCategory(item.type || "", item.title);
        if (!incomeByCategory[category]) {
          incomeByCategory[category] = { items: [], total: 0 };
        }
        incomeByCategory[category].items.push({
          title: item.title,
          amount: item.amount,
        });
        incomeByCategory[category].total += item.amount;
      }
    );

    // 소득 카테고리 크기순 정렬
    const sortedIncomeCategories = Object.entries(incomeByCategory).sort(
      (a, b) => b[1].total - a[1].total
    );

    let incomePriority = 0;
    sortedIncomeCategories.forEach(([category, data]) => {
      // 항상 카테고리 노드 사용 (일관된 단계 유지)
      // 개별 소득 → 카테고리 (컬럼 0 → 1)
      data.items
        .sort((a, b) => b.amount - a.amount)
        .forEach((item) => {
          flows.push({ from: item.title, to: category, flow: item.amount });
          labels[item.title] = `${shortenLabel(item.title)}\n${formatMoney(
            item.amount
          )}`;
          colorMap[item.title] = CATEGORY_COLORS[category] || "#64748b";
          priority[item.title] = incomePriority++;
          columnMap[item.title] = 0; // 개별 소득: 컬럼 0
        });

      // 카테고리 → 총 유입 (컬럼 1 → 2)
      flows.push({ from: category, to: "총 유입", flow: data.total });
      labels[category] = `${category}\n${formatMoney(data.total)}`;
      priority[category] = incomePriority++;
      columnMap[category] = 1; // 소득 카테고리: 컬럼 1
    });

    // 총 유입 (컬럼 2)
    priority["총 유입"] = 50;
    labels["총 유입"] = `총 유입\n${formatMoney(totalIncome)}`;
    columnMap["총 유입"] = 2;

    // 지출 처리 - 카테고리별 그룹화
    const expenseByCategory: Record<
      string,
      { items: { title: string; amount: number }[]; total: number }
    > = {};
    let otherExpenseTotal = 0;

    snapshot.expenseBreakdown.forEach(
      (item: { title: string; amount: number; type?: string }) => {
        if (item.amount <= 0) return;

        // 작은 항목은 기타로
        if (item.amount < minAmount) {
          otherExpenseTotal += item.amount;
          return;
        }

        const category = getExpenseCategory(item.type || "", item.title);
        if (!expenseByCategory[category]) {
          expenseByCategory[category] = { items: [], total: 0 };
        }
        expenseByCategory[category].items.push({
          title: item.title,
          amount: item.amount,
        });
        expenseByCategory[category].total += item.amount;
      }
    );

    // 기타 지출 추가
    if (otherExpenseTotal > 0) {
      if (!expenseByCategory["기타지출"]) {
        expenseByCategory["기타지출"] = { items: [], total: 0 };
      }
      expenseByCategory["기타지출"].items.push({
        title: "기타",
        amount: otherExpenseTotal,
      });
      expenseByCategory["기타지출"].total += otherExpenseTotal;
    }

    // 지출 카테고리 크기순 정렬
    const sortedCategories = Object.entries(expenseByCategory).sort(
      (a, b) => b[1].total - a[1].total
    );

    let expensePriority = 100;
    sortedCategories.forEach(([category, data]) => {
      // 총 유입 → 지출 카테고리 (컬럼 2 → 3)
      flows.push({ from: "총 유입", to: category, flow: data.total });
      labels[category] = `${category}\n${formatMoney(data.total)}`;
      priority[category] = expensePriority++;
      columnMap[category] = 3; // 지출 카테고리: 컬럼 3

      // 지출 카테고리 → 개별 지출 (컬럼 3 → 4)
      data.items
        .sort((a, b) => b.amount - a.amount)
        .forEach((item) => {
          const displayName =
            item.title === "기타" ? `기타(${category})` : item.title;
          flows.push({ from: category, to: displayName, flow: item.amount });
          labels[displayName] = `${shortenLabel(
            item.title === "기타" ? "기타" : item.title
          )}\n${formatMoney(item.amount)}`;
          colorMap[displayName] = CATEGORY_COLORS[category] || "#ef4444";
          priority[displayName] = expensePriority++;
          columnMap[displayName] = 4; // 개별 지출: 컬럼 4
        });
    });

    // 잉여 현금 → 저축/투자 (컬럼 2 → 3 → 4)
    if (savings > 0) {
      flows.push({ from: "총 유입", to: "잉여현금", flow: savings });
      flows.push({ from: "잉여현금", to: "저축/투자", flow: savings });
      labels["잉여현금"] = `잉여현금\n${formatMoney(savings)}`;
      labels["저축/투자"] = `저축/투자\n${formatMoney(savings)}`;
      priority["잉여현금"] = 900;
      priority["저축/투자"] = 901;
      columnMap["잉여현금"] = 3; // 잉여현금: 컬럼 3
      columnMap["저축/투자"] = 4; // 저축/투자: 컬럼 4
    }

    const nodeCount = Object.keys(labels).length;

    return {
      flows,
      labels,
      colorMap,
      priority,
      totalIncome,
      nodeCount,
      columnMap,
    };
  }, [snapshot, CATEGORY_COLORS]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    if (flows.length === 0) return;

    // 노드 수에 따라 동적 패딩 계산
    const dynamicPadding = Math.max(30, Math.min(60, 400 / nodeCount));

    chartInstance.current = new ChartJS(ctx, {
      type: "sankey",
      data: {
        datasets: [
          {
            label: "현금 흐름",
            data: flows,
            colorFrom: (c) =>
              colorMap[c.dataset.data[c.dataIndex].from] || "#64748b",
            colorTo: (c) =>
              colorMap[c.dataset.data[c.dataIndex].to] || "#64748b",
            colorMode: "gradient",
            borderWidth: 0,
            nodeWidth: 12,
            nodePadding: dynamicPadding,
            priority,
            labels,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 200,
          easing: "linear",
        },
        animations: {
          progress: {
            duration: 200,
            easing: "linear",
            // 왼쪽→오른쪽 파도 애니메이션: from 노드의 컬럼에 따라 딜레이
            delay: (ctx) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const raw = ctx.raw as any;
              if (!raw?.from) return 0;
              const col = columnMap[raw.from] ?? 0;
              // 컬럼당 200ms 딜레이 (왼쪽→오른쪽 파도 효과)
              return col * 200;
            },
          },
          colors: {
            duration: 200,
            easing: "linear",
            delay: (ctx) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const raw = ctx.raw as any;
              if (!raw?.from) return 0;
              const col = columnMap[raw.from] ?? 0;
              return col * 200;
            },
          },
          numbers: {
            duration: 400,
            easing: "easeOutQuart",
            delay: () => 0,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: chartScaleColors.tooltipBg,
            titleColor: chartScaleColors.tooltipText,
            bodyColor: chartScaleColors.textSecondary,
            borderColor: chartScaleColors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            cornerRadius: 8,
            titleFont: { weight: "bold", size: 13 },
            bodyFont: { size: 12 },
            callbacks: {
              title: (items) => {
                const raw = items[0].raw as {
                  from: string;
                  to: string;
                  flow: number;
                };
                return `${raw.from} → ${raw.to}`;
              },
              label: (context) => {
                const raw = context.raw as {
                  from: string;
                  to: string;
                  flow: number;
                };
                const percentage =
                  totalIncome > 0
                    ? Math.round((raw.flow / totalIncome) * 100)
                    : 0;
                return `${formatMoney(raw.flow)}원/년 (${percentage}%)`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [flows, labels, colorMap, priority, totalIncome, nodeCount, columnMap, chartScaleColors, CATEGORY_COLORS]);

  if (totalIncome === 0) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.emptyState}>
          {selectedYear}년 데이터가 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartWrapperLarge}>
        <canvas ref={chartRef} />
      </div>
    </div>
  );
}
