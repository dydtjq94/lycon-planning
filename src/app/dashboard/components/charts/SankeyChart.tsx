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
import type { SimulationResult } from "@/lib/services/simulationTypes";
import { useChartTheme } from "@/hooks/useChartTheme";
import {
  CHART_COLORS,
  INFLOW_CATEGORIES,
  OUTFLOW_CATEGORIES,
  groupCashFlowItems,
} from "@/lib/utils/tooltipCategories";
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

// 금액 포맷팅 (만원 단위, 반올림)
function formatMoney(amount: number): string {
  // 만원 단위로 반올림하여 깔끔하게 표시
  const rounded = Math.round(Math.abs(amount));

  if (rounded >= 10000) {
    const uk = Math.floor(rounded / 10000);
    const man = rounded % 10000;
    if (man === 0) return `${uk}억원`;
    return `${uk}억 ${man.toLocaleString()}만원`;
  }

  if (rounded === 0) return `0원`;
  return `${rounded.toLocaleString()}만원`;
}

// 라벨 정리 (소유자 태그만 제거, 나머지 전부 표시)
function shortenLabel(title: string): string {
  let short = title.replace(/\s*\|\s*(본인|공동|배우자)$/, "");
  short = short.replace(" (은퇴 전)", "");
  short = short.replace(" (은퇴 후)", "(후)");
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
    type === "debt" ||
    type === "interest" ||
    type === "loan" ||
    title.includes("이자") ||
    title.includes("원금") ||
    title.includes("대출") ||
    title.includes("주담대") ||
    title.includes("담보") ||
    title.includes("상환")
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
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const { chartScaleColors, isDark } = useChartTheme();

  // 카테고리 색상 (CHART_COLORS 기반 - 툴팁과 동일)
  const CATEGORY_COLORS: Record<string, string> = useMemo(() => {
    const colors: Record<string, string> = {
      "총 공급": CHART_COLORS.positive,
    };
    for (const cat of INFLOW_CATEGORIES) {
      colors[cat.label] = cat.color;
    }
    for (const cat of OUTFLOW_CATEGORIES) {
      colors[cat.label] = cat.color;
    }
    // Fallback colors for legacy categories
    colors["근로소득"] = CHART_COLORS.income.labor;
    colors["사업소득"] = CHART_COLORS.income.business;
    colors["연금소득"] = CHART_COLORS.income.pension;
    colors["임대소득"] = CHART_COLORS.income.rental;
    colors["금융소득"] = CHART_COLORS.income.financial;
    colors["기타소득"] = CHART_COLORS.income.other;
    colors["생활비"] = CHART_COLORS.expense.variable;
    colors["주거비"] = CHART_COLORS.expense.housing;
    colors["의료비"] = CHART_COLORS.expense.medical;
    colors["부채상환"] = CHART_COLORS.expense.loan;
    colors["기타지출"] = CHART_COLORS.expense.other;
    colors["잉여현금"] = CHART_COLORS.asset.savings;
    colors["저축/투자"] = CHART_COLORS.asset.savings;
    colors["부족분 충당"] = CHART_COLORS.debt.credit;
    return colors;
  }, []);

  const snapshot = useMemo(() => {
    return simulationResult.snapshots.find((s) => s.year === selectedYear);
  }, [simulationResult.snapshots, selectedYear]);

  // 데이터 준비 - cashFlowBreakdown 기반 (fallback: incomeBreakdown/expenseBreakdown)
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
    const columnMap: Record<string, number> = {};
    const labels: Record<string, string> = {};
    const colorMap: Record<string, string> = { ...CATEGORY_COLORS };
    const priority: Record<string, number> = {};

    // Use cashFlowBreakdown if available, otherwise fall back to old logic
    if (snapshot.cashFlowBreakdown && snapshot.cashFlowBreakdown.length > 0) {
      // NEW APPROACH: Use cashFlowBreakdown with flowType-based categorization
      // surplus_investment, deficit_withdrawal 분리 후 regular items만 그룹핑
      const regularItems = snapshot.cashFlowBreakdown.filter(
        item => item.flowType !== 'surplus_investment' && item.flowType !== 'deficit_withdrawal'
      );
      const { inflows, outflows, totalInflow, totalOutflow } = groupCashFlowItems(regularItems);

      const surplusItems = snapshot.cashFlowBreakdown.filter(item => item.flowType === 'surplus_investment');
      const deficitItems = snapshot.cashFlowBreakdown.filter(item => item.flowType === 'deficit_withdrawal');
      const surplusTotal = surplusItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);
      const deficitTotal = deficitItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);

      const seenTitles = new Set<string>();

      // Helper to make titles unique
      const makeUnique = (title: string, isCategory: boolean = false): string => {
        if (!seenTitles.has(title)) {
          seenTitles.add(title);
          return title;
        }
        // If collision, add suffix
        let counter = 2;
        let uniqueTitle = isCategory ? `${title} (${counter})` : `${title} #${counter}`;
        while (seenTitles.has(uniqueTitle)) {
          counter++;
          uniqueTitle = isCategory ? `${title} (${counter})` : `${title} #${counter}`;
        }
        seenTitles.add(uniqueTitle);
        return uniqueTitle;
      };

      // Add category labels to seen set first
      for (const cat of INFLOW_CATEGORIES) {
        seenTitles.add(cat.label);
      }
      for (const cat of OUTFLOW_CATEGORIES) {
        seenTitles.add(cat.label);
      }
      seenTitles.add("총 공급");

      // INFLOW PROCESSING
      let incomePriority = 0;
      const inflowsSorted = [...inflows].sort((a, b) => b.total - a.total);

      inflowsSorted.forEach((group) => {
        const categoryLabel = group.category.label;
        const categoryColor = group.category.color;

        // Individual items → Category (Column 0 → 1)
        const sortedItems = [...group.items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        sortedItems.forEach((item) => {
          if (Math.abs(item.amount) === 0) return;

          const uniqueTitle = makeUnique(item.title);
          flows.push({ from: uniqueTitle, to: categoryLabel, flow: Math.abs(item.amount) });
          labels[uniqueTitle] = `${shortenLabel(item.title)}\n${formatMoney(Math.abs(item.amount))}`;
          colorMap[uniqueTitle] = categoryColor;
          priority[uniqueTitle] = incomePriority++;
          columnMap[uniqueTitle] = 0;
        });

        // Category → 총 공급 (Column 1 → 2)
        flows.push({ from: categoryLabel, to: "총 공급", flow: group.total });
        labels[categoryLabel] = `${categoryLabel}\n${formatMoney(group.total)}`;
        colorMap[categoryLabel] = categoryColor;
        priority[categoryLabel] = incomePriority++;
        columnMap[categoryLabel] = 1;
      });

      // 총 공급 (Column 2)
      priority["총 공급"] = 50;
      labels["총 공급"] = `총 공급\n${formatMoney(totalInflow)}`;
      colorMap["총 공급"] = CHART_COLORS.positive;
      columnMap["총 공급"] = 2;

      // OUTFLOW PROCESSING
      let expensePriority = 100;
      const outflowsSorted = [...outflows].sort((a, b) => b.total - a.total);

      outflowsSorted.forEach((group) => {
        const categoryLabel = group.category.label;
        const categoryColor = group.category.color;

        // 총 공급 → Category (Column 2 → 3)
        flows.push({ from: "총 공급", to: categoryLabel, flow: group.total });
        labels[categoryLabel] = `${categoryLabel}\n${formatMoney(group.total)}`;
        colorMap[categoryLabel] = categoryColor;
        priority[categoryLabel] = expensePriority++;
        columnMap[categoryLabel] = 3;

        // Category → Individual items (Column 3 → 4)
        const sortedOutItems = [...group.items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        sortedOutItems.forEach((item) => {
          if (Math.abs(item.amount) === 0) return;

          const uniqueTitle = makeUnique(item.title);
          flows.push({ from: categoryLabel, to: uniqueTitle, flow: Math.abs(item.amount) });
          labels[uniqueTitle] = `${shortenLabel(item.title)}\n${formatMoney(Math.abs(item.amount))}`;
          colorMap[uniqueTitle] = categoryColor;
          priority[uniqueTitle] = expensePriority++;
          columnMap[uniqueTitle] = 4;
        });
      });

      // SURPLUS HANDLING: Use actual surplus_investment items from cashFlowBreakdown
      if (surplusTotal > 0) {
        const surplusLabel = makeUnique("잉여현금", true);

        // 총 공급 → 잉여현금 (Column 2 → 3)
        flows.push({ from: "총 공급", to: surplusLabel, flow: surplusTotal });
        labels[surplusLabel] = `잉여현금\n${formatMoney(surplusTotal)}`;
        colorMap[surplusLabel] = CHART_COLORS.asset.savings;
        priority[surplusLabel] = 900;
        columnMap[surplusLabel] = 3;

        // 잉여현금 → 개별 계좌 (Column 3 → 4)
        let surplusPriority = 901;
        surplusItems.forEach((item) => {
          const amount = Math.abs(item.amount);
          if (amount === 0) return;
          const uniqueTitle = makeUnique(item.title);
          flows.push({ from: surplusLabel, to: uniqueTitle, flow: amount });
          labels[uniqueTitle] = `${shortenLabel(item.title)}\n${formatMoney(amount)}`;
          colorMap[uniqueTitle] = CHART_COLORS.asset.savings;
          priority[uniqueTitle] = surplusPriority++;
          columnMap[uniqueTitle] = 4;
        });
      }

      // DEFICIT HANDLING: Use actual deficit_withdrawal items from cashFlowBreakdown
      if (deficitTotal > 0) {
        const deficitLabel = makeUnique("부족분 충당", true);

        // 부족분 충당 → 총 공급 (Column 1 → 2)
        flows.push({ from: deficitLabel, to: "총 공급", flow: deficitTotal });
        labels[deficitLabel] = `부족분 충당\n${formatMoney(deficitTotal)}`;
        colorMap[deficitLabel] = CHART_COLORS.debt.credit;
        priority[deficitLabel] = -1;
        columnMap[deficitLabel] = 1;

        // 개별 인출 계좌 → 부족분 충당 (Column 0 → 1)
        let deficitPriority = -10;
        deficitItems.forEach((item) => {
          const amount = Math.abs(item.amount);
          if (amount === 0) return;
          const uniqueTitle = makeUnique(item.title);
          flows.push({ from: uniqueTitle, to: deficitLabel, flow: amount });
          labels[uniqueTitle] = `${shortenLabel(item.title)}\n${formatMoney(amount)}`;
          colorMap[uniqueTitle] = CHART_COLORS.debt.credit;
          priority[uniqueTitle] = deficitPriority++;
          columnMap[uniqueTitle] = 0;
        });

        // Update 총 공급 label to include deficit
        labels["총 공급"] = `총 공급\n${formatMoney(totalInflow + deficitTotal)}`;
      }

      const nodeCount = Object.keys(labels).length;
      return {
        flows,
        labels,
        colorMap,
        priority,
        totalIncome: totalInflow,
        nodeCount,
        columnMap,
      };
    } else {
      // FALLBACK: Use old incomeBreakdown/expenseBreakdown logic
      const totalIncome = snapshot.totalIncome;
      const totalExpense = snapshot.totalExpense;
      const savings = Math.max(0, totalIncome - totalExpense);

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
            labels[item.title] = `${shortenLabel(item.title)}\n${formatMoney(item.amount)}`;
            colorMap[item.title] = CATEGORY_COLORS[category] || "#64748b";
            priority[item.title] = incomePriority++;
            columnMap[item.title] = 0; // 개별 소득: 컬럼 0
          });

        // 카테고리 → 총 공급 (컬럼 1 → 2)
        flows.push({ from: category, to: "총 공급", flow: data.total });
        labels[category] = `${category}\n${formatMoney(data.total)}`;
        priority[category] = incomePriority++;
        columnMap[category] = 1; // 소득 카테고리: 컬럼 1
      });

      // 총 공급 (컬럼 2)
      priority["총 공급"] = 50;
      labels["총 공급"] = `총 공급\n${formatMoney(totalIncome)}`;
      columnMap["총 공급"] = 2;

      // 지출 처리 - 카테고리별 그룹화
      const expenseByCategory: Record<
        string,
        { items: { title: string; amount: number }[]; total: number }
      > = {};

      snapshot.expenseBreakdown.forEach(
        (item: { title: string; amount: number; type?: string }) => {
          if (item.amount <= 0) return;

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

      // 지출 카테고리 크기순 정렬
      const sortedCategories = Object.entries(expenseByCategory).sort(
        (a, b) => b[1].total - a[1].total
      );

      let expensePriority = 100;
      sortedCategories.forEach(([category, data]) => {
        // 총 공급 → 지출 카테고리 (컬럼 2 → 3)
        flows.push({ from: "총 공급", to: category, flow: data.total });
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
        flows.push({ from: "총 공급", to: "잉여현금", flow: savings });
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
    }
  }, [snapshot, CATEGORY_COLORS]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    if (flows.length === 0) return;

    // 마우스 위치 추적 + 툴팁 위치 실시간 업데이트
    const canvas = chartRef.current;
    let sankeyRafId: number | null = null;
    let sankeyAnimating = false;

    const updateTooltipPosition = () => {
      const el = document.getElementById('sankey-chart-tooltip') as HTMLDivElement | null;
      if (!el || el.style.opacity === '0') {
        sankeyAnimating = false;
        return;
      }

      const tw = el.offsetWidth || 200;
      const th = el.offsetHeight || 60;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      let tl = mx + 16;
      let tt = my - th - 8;
      if (tl + tw > window.innerWidth - 10) tl = mx - tw - 16;
      if (tl < 10) tl = 10;
      if (tt < 10) tt = my + 20;
      if (tt + th > window.innerHeight - 10) tt = window.innerHeight - th - 10;

      let cl = parseFloat(el.dataset.curLeft || '0');
      let ct = parseFloat(el.dataset.curTop || '0');
      cl += (tl - cl) * 0.15;
      ct += (tt - ct) * 0.15;
      if (Math.abs(cl - tl) < 0.5) cl = tl;
      if (Math.abs(ct - tt) < 0.5) ct = tt;

      el.dataset.curLeft = String(cl);
      el.dataset.curTop = String(ct);
      el.style.left = `${cl}px`;
      el.style.top = `${ct}px`;

      if (el.style.opacity !== '0') {
        sankeyRafId = requestAnimationFrame(updateTooltipPosition);
      } else {
        sankeyAnimating = false;
      }
    };

    const startTooltipAnimation = () => {
      if (!sankeyAnimating) {
        sankeyAnimating = true;
        sankeyRafId = requestAnimationFrame(updateTooltipPosition);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      startTooltipAnimation();
    };
    const handleMouseLeave = () => {
      const el = document.getElementById('sankey-chart-tooltip');
      if (el) el.style.opacity = '0';
      sankeyAnimating = false;
      if (sankeyRafId) { cancelAnimationFrame(sankeyRafId); sankeyRafId = null; }
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

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
            font: { size: 12 },
            color: chartScaleColors.textColor,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 24, bottom: 24 },
        },
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
            enabled: false,
            external: (context) => {
              // Tooltip element
              const tooltipId = 'sankey-chart-tooltip';
              let tooltipEl = document.getElementById(tooltipId) as HTMLDivElement | null;

              // Create element on first render
              if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.id = tooltipId;
                tooltipEl.style.position = 'fixed';
                tooltipEl.style.pointerEvents = 'none';
                tooltipEl.style.zIndex = '10000';
                tooltipEl.style.transition = 'opacity 0.15s ease';
                tooltipEl.dataset.curLeft = '0';
                tooltipEl.dataset.curTop = '0';
                tooltipEl.dataset.animating = '0';
                document.body.appendChild(tooltipEl);
              }

              // Hide if no tooltip
              const tooltipModel = context.tooltip;
              if (tooltipModel.opacity === 0) {
                tooltipEl.style.opacity = '0';
                tooltipEl.dataset.animating = '0';
                return;
              }

              // Get raw data
              if (tooltipModel.body) {
                const raw = tooltipModel.dataPoints[0].raw as {
                  from: string;
                  to: string;
                  flow: number;
                };

                const fromColor = colorMap[raw.from] || '#64748b';
                const textColor = isDark ? '#e8e8e8' : '#1d1d1f';
                const secondaryTextColor = isDark ? '#9a9b9e' : '#a8a29e';
                const mutedColor = isDark ? '#6b6d70' : '#d4d4d4';
                const fromLabel = shortenLabel(raw.from);
                const toLabel = shortenLabel(raw.to);
                const amount = formatMoney(raw.flow);

                // 인플로우(총 공급까지) vs 아웃플로우(총 공급 이후)
                const toCol = columnMap[raw.to] ?? 99;
                const isInflowSide = toCol <= 2;

                const toColor = colorMap[raw.to] || '#64748b';
                const labelColor = isDark ? '#b0b1b4' : '#78716c';
                const arrowColor = isDark ? '#9a9b9e' : '#a8a29e';

                if (isInflowSide) {
                  const targetTotal = flows
                    .filter(f => f.to === raw.to)
                    .reduce((sum, f) => sum + f.flow, 0);
                  const pct = targetTotal > 0
                    ? (raw.flow / targetTotal * 100).toFixed(1)
                    : '0';

                  tooltipEl.innerHTML = `
                    <div style="display: grid; grid-template-columns: auto auto auto; gap: 4px 10px; align-items: center; justify-items: center;">
                      <span style="font-size: 15px; font-weight: 700; color: ${fromColor}; justify-self: end;">${amount}</span>
                      <span style="font-size: 13px; color: ${arrowColor};">→</span>
                      <span style="font-size: 15px; font-weight: 700; color: ${toColor}; justify-self: start;">${formatMoney(targetTotal)}</span>
                      <span style="font-size: 11px; color: ${labelColor}; justify-self: end;">${fromLabel}</span>
                      <span style="font-size: 11px; font-weight: 600; color: ${labelColor};">${pct}%</span>
                      <span style="font-size: 11px; color: ${labelColor}; justify-self: start;">${toLabel}</span>
                    </div>
                  `;
                } else {
                  const sourceTotal = flows
                    .filter(f => f.from === raw.from)
                    .reduce((sum, f) => sum + f.flow, 0);
                  const pct = sourceTotal > 0
                    ? (raw.flow / sourceTotal * 100).toFixed(1)
                    : '0';

                  tooltipEl.innerHTML = `
                    <div style="display: grid; grid-template-columns: auto auto auto; gap: 4px 10px; align-items: center; justify-items: center;">
                      <span style="font-size: 15px; font-weight: 700; color: ${fromColor}; justify-self: end;">${formatMoney(sourceTotal)}</span>
                      <span style="font-size: 13px; color: ${arrowColor};">→</span>
                      <span style="font-size: 15px; font-weight: 700; color: ${toColor}; justify-self: start;">${amount}</span>
                      <span style="font-size: 11px; color: ${labelColor}; justify-self: end;">${fromLabel}</span>
                      <span style="font-size: 11px; font-weight: 600; color: ${labelColor};">${pct}%</span>
                      <span style="font-size: 11px; color: ${labelColor}; justify-self: start;">${toLabel}</span>
                    </div>
                  `;
                }
              }

              // Glassmorphism styles
              const bgColor = isDark
                ? 'rgba(34, 37, 41, 0.5)'
                : 'rgba(255, 255, 255, 0.5)';
              const borderColor = isDark
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(0, 0, 0, 0.06)';
              const shadow = isDark
                ? '0 8px 32px rgba(0, 0, 0, 0.5)'
                : '0 8px 32px rgba(0, 0, 0, 0.12)';

              tooltipEl.style.background = bgColor;
              tooltipEl.style.backdropFilter = 'blur(6px)';
              (tooltipEl.style as unknown as Record<string, string>)['-webkit-backdrop-filter'] = 'blur(6px)';
              tooltipEl.style.border = `1px solid ${borderColor}`;
              tooltipEl.style.borderRadius = '14px';
              tooltipEl.style.boxShadow = shadow;
              tooltipEl.style.padding = '14px 16px';
              // 첫 등장이면 즉시 위치 설정
              const wasHidden = tooltipEl.style.opacity === '0' || tooltipEl.style.opacity === '';
              tooltipEl.style.opacity = '1';

              if (wasHidden) {
                const mx = mouseRef.current.x;
                const my = mouseRef.current.y;
                const tw = tooltipEl.offsetWidth || 200;
                const th = tooltipEl.offsetHeight || 60;
                let l = mx + 16;
                let t = my - th - 8;
                if (l + tw > window.innerWidth - 10) l = mx - tw - 16;
                if (l < 10) l = 10;
                if (t < 10) t = my + 20;
                tooltipEl.dataset.curLeft = String(l);
                tooltipEl.dataset.curTop = String(t);
                tooltipEl.style.left = `${l}px`;
                tooltipEl.style.top = `${t}px`;
              }
              // 이후 위치는 mousemove 애니메이션 루프에서 처리
              startTooltipAnimation();
            },
          },
        },
      },
    });

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (sankeyRafId) cancelAnimationFrame(sankeyRafId);
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      const tooltipEl = document.getElementById('sankey-chart-tooltip');
      if (tooltipEl) {
        tooltipEl.remove();
      }
    };
  }, [flows, labels, colorMap, priority, totalIncome, nodeCount, columnMap, chartScaleColors, CATEGORY_COLORS, isDark]);

  if (flows.length === 0) {
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
