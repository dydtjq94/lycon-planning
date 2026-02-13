"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Trash2,
  TrendingDown,
  Pencil,
  ChevronDown,
  ChevronUp,
  Info,
  X,
  ArrowLeft,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type {
  DashboardExpenseItem,
  DashboardExpenseFrequency,
  GlobalSettings,
} from "@/types";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { Expense } from "@/types/tables";
import type { SimulationResult } from "@/lib/services/simulationEngine";
import {
  DEFAULT_GLOBAL_SETTINGS,
  MEDICAL_EXPENSE_INFO,
  MEDICAL_EXPENSE_BY_AGE,
} from "@/types";
import {
  formatMoney,
  getDefaultRateCategory,
  getEffectiveRate,
} from "@/lib/utils";
import {
  formatPeriodDisplay,
  toPeriodRaw,
  isPeriodValid,
  handlePeriodTextChange,
} from "@/lib/utils/periodInput";
import { CHART_COLORS, categorizeExpense } from "@/lib/utils/tooltipCategories";
import { useExpenses, useInvalidateByCategory } from "@/hooks/useFinancialData";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  dbTypeToUIType,
  uiTypeToDBType,
  type UIExpenseType,
} from "@/lib/services/expenseService";
import { TabSkeleton } from "./shared/TabSkeleton";
import styles from "./ExpenseTab.module.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface ExpenseTabProps {
  simulationId: string;
  birthYear: number;
  spouseBirthYear?: number | null;
  retirementAge: number;
  spouseRetirementAge?: number;
  isMarried: boolean;
  globalSettings: GlobalSettings;
  simulationResult: SimulationResult;
}

// 상승률 프리셋 (물가 상승률 기준)
const GROWTH_PRESETS = [
  { id: "rate-3", value: 3 },
  { id: "rate-2.5", value: 2.5 },
  { id: "rate-2", value: 2 },
  { id: "rate-0", value: 0 },
];

// 로컬 타입 별칭
type ExpenseItem = DashboardExpenseItem;
type ExpenseType = DashboardExpenseItem["type"];
type ExpenseFrequency = DashboardExpenseFrequency;

export function ExpenseTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  spouseRetirementAge = 60,
  isMarried,
  globalSettings,
  simulationResult,
}: ExpenseTabProps) {
  const { chartScaleColors, isDark } = useChartTheme();
  const currentYear = new Date().getFullYear();

  // 현재 나이 계산
  const currentAge = currentYear - birthYear;
  const selfRetirementYear = currentYear + (retirementAge - currentAge);

  // 배우자 나이 계산
  const spouseCurrentAge = spouseBirthYear
    ? currentYear - spouseBirthYear
    : null;

  // 배우자 은퇴년도
  const spouseRetirementYear = useMemo(() => {
    if (!spouseBirthYear || spouseCurrentAge === null)
      return selfRetirementYear;
    return currentYear + (spouseRetirementAge - spouseCurrentAge);
  }, [
    spouseBirthYear,
    currentYear,
    selfRetirementYear,
    spouseCurrentAge,
    spouseRetirementAge,
  ]);

  const hasSpouse = isMarried && spouseBirthYear;
  const currentMonth = new Date().getMonth() + 1;

  // 특정 연도의 나이 계산
  const getAgeAtYear = (year: number, isSelf: boolean): number | null => {
    if (isSelf) {
      return currentAge + (year - currentYear);
    }
    if (spouseCurrentAge === null) return null;
    return spouseCurrentAge + (year - currentYear);
  };

  // 종료 년월 계산
  const getEndYearMonth = (
    item: ExpenseItem,
  ): { year: number; month: number } => {
    if (item.endType === "self-retirement")
      return { year: selfRetirementYear, month: 12 };
    if (item.endType === "spouse-retirement")
      return { year: spouseRetirementYear, month: 12 };
    return {
      year: item.endYear || selfRetirementYear,
      month: item.endMonth || 12,
    };
  };

  // 개월 수 계산
  const getMonthsCount = (item: ExpenseItem): number => {
    const end = getEndYearMonth(item);
    return (end.year - item.startYear) * 12 + (end.month - item.startMonth);
  };

  // React Query로 지출 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: dbExpenses = [], isLoading } = useExpenses(simulationId);
  const invalidate = useInvalidateByCategory(simulationId);

  // DB 지출 데이터를 UI용 ExpenseItem으로 변환
  const expenseItems = useMemo<ExpenseItem[]>(() => {
    return dbExpenses.map((expense) => {
      // endType 결정: retirement_link 기반
      let endType: ExpenseItem["endType"] = "custom";
      if (expense.retirement_link === "self") {
        endType = "self-retirement";
      } else if (expense.retirement_link === "spouse") {
        endType = "spouse-retirement";
      }

      return {
        id: expense.id,
        type: dbTypeToUIType(expense.type),
        label: expense.title,
        amount: expense.amount,
        frequency: expense.frequency,
        startYear: expense.start_year,
        startMonth: expense.start_month,
        endType,
        endYear: expense.end_year,
        endMonth: expense.end_month,
        growthRate: expense.growth_rate,
        rateCategory: expense.rate_category,
        sourceType: expense.source_type || undefined,
        sourceId: expense.source_id || undefined,
      };
    });
  }, [dbExpenses]);

  // 시나리오 모드 여부 (individual이 아니면 시나리오 적용 중)
  const isScenarioMode = globalSettings.scenarioMode !== "individual";

  // 사용자 지출 표시용 데이터 (부채 지출은 simulationResult에서 가져옴)
  const displayItems = useMemo(() => {
    return expenseItems.map((item) => {
      const rateCategory =
        item.rateCategory || getDefaultRateCategory(item.type);
      const effectiveRate = getEffectiveRate(
        item.growthRate,
        rateCategory,
        globalSettings.scenarioMode,
        globalSettings,
      );
      return {
        ...item,
        displayGrowthRate: effectiveRate, // 현재 시나리오에서 표시할 상승률
      };
    });
  }, [expenseItems, globalSettings]);

  // 확장/축소 상태
  const [isExpanded, setIsExpanded] = useState(true);

  // 의료비 섹션 토글 상태
  const [medicalExpanded, setMedicalExpanded] = useState(false);
  const [showMedicalInfo, setShowMedicalInfo] = useState(false);

  // 편집 중인 항목 ID
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ExpenseItem | null>(null);
  const [editStartType, setEditStartType] = useState<'current' | 'self-retirement' | 'spouse-retirement' | 'year'>('current');
  const [editStartDateText, setEditStartDateText] = useState("");
  const [editEndType, setEditEndType] = useState<'self-retirement' | 'spouse-retirement' | 'year'>('self-retirement');
  const [editEndDateText, setEditEndDateText] = useState("");
  const [isCustomRateMode, setIsCustomRateMode] = useState(false);
  const [customRateInput, setCustomRateInput] = useState("");

  // 추가 중인 타입
  const [addingType, setAddingType] = useState<ExpenseType | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newFrequency, setNewFrequency] = useState<ExpenseFrequency>("monthly");
  const [newOnetimeYear, setNewOnetimeYear] = useState(currentYear);
  const [newOnetimeMonth, setNewOnetimeMonth] = useState(currentMonth);
  const [newOnetimeDateText, setNewOnetimeDateText] = useState(toPeriodRaw(currentYear, currentMonth));
  const [newStartType, setNewStartType] = useState<'current' | 'self-retirement' | 'spouse-retirement' | 'year'>('current');
  const [newStartYear, setNewStartYear] = useState(currentYear);
  const [newStartMonth, setNewStartMonth] = useState(currentMonth);
  const [newStartDateText, setNewStartDateText] = useState(toPeriodRaw(currentYear, currentMonth));
  const [newEndType, setNewEndType] = useState<'self-retirement' | 'spouse-retirement' | 'year'>('self-retirement');
  const [newEndYear, setNewEndYear] = useState(selfRetirementYear);
  const [newEndMonth, setNewEndMonth] = useState(12);
  const [newEndDateText, setNewEndDateText] = useState(toPeriodRaw(selfRetirementYear, 12));
  const [newRateCategory, setNewRateCategory] = useState<'inflation' | 'income' | 'investment' | 'realEstate' | 'fixed'>('inflation');
  const [newCustomRate, setNewCustomRate] = useState("");

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // 타입별 항목 (displayItems에서 필터 - 시나리오 적용된 상승률 포함)
  type DisplayItem = ExpenseItem & { displayGrowthRate: number };
  const fixedItems = displayItems.filter((i) => i.type === "fixed");
  const variableItems = displayItems.filter((i) => i.type === "variable");
  const onetimeItems = displayItems.filter((i) => i.type === "onetime");
  const medicalItems = displayItems.filter((i) => i.type === "medical");

  // 헤더 총 개수 및 월 지출 계산
  const totalCount = displayItems.length;
  const totalMonthlyExpense = useMemo(() => {
    return displayItems.reduce((sum, item) => {
      if (item.type === "onetime") return sum;
      if (item.frequency === "yearly")
        return sum + Math.round(item.amount / 12);
      return sum + item.amount;
    }, 0);
  }, [displayItems]);

  // 월 지출로 변환 (frequency 고려)
  const toMonthlyAmount = (item: ExpenseItem): number => {
    if (item.type === "onetime") return 0;
    if (item.frequency === "yearly") return item.amount / 12;
    return item.amount;
  };

  // 현재 연도에 해당하는 의료비만 필터링
  const currentMedicalItems = useMemo(() => {
    return medicalItems.filter((item) => {
      const start = item.startYear;
      const end = item.endYear || 9999;
      return currentYear >= start && currentYear <= end;
    });
  }, [medicalItems, currentYear]);

  // 현재 연도에 해당하는 항목만 필터링 (모든 타입)
  const isCurrentYearItem = (item: ExpenseItem): boolean => {
    if (item.type === "onetime") {
      return item.startYear === currentYear;
    }
    const endYear =
      item.endType === "self-retirement"
        ? selfRetirementYear
        : item.endType === "spouse-retirement"
          ? spouseRetirementYear
          : item.endYear || 9999;
    return currentYear >= item.startYear && currentYear <= endYear;
  };

  // 월 지출 (현재 연도에 해당하는 항목만)
  const monthlyExpense = useMemo(() => {
    // 일반 지출
    const regularExpense = displayItems
      .filter((item) => isCurrentYearItem(item) && item.type !== "onetime")
      .reduce((sum, item) => sum + toMonthlyAmount(item), 0);

    return regularExpense;
  }, [displayItems, currentYear, selfRetirementYear, spouseRetirementYear]);

  // 은퇴까지 총 지출 (상승률 반영, 은퇴 전에 시작하는 항목만)
  const lifetimeExpense = useMemo(() => {
    let total = 0;
    displayItems.forEach((item) => {
      // 은퇴 이후에 시작하는 항목은 제외
      if (item.startYear > selfRetirementYear) return;

      if (item.type === "onetime") {
        // 일시적 지출은 은퇴 전이면 포함
        if (item.startYear <= selfRetirementYear) {
          total += item.amount;
        }
        return;
      }

      // 종료 시점을 은퇴년도로 제한
      const itemEnd = getEndYearMonth(item);
      const effectiveEndYear = Math.min(itemEnd.year, selfRetirementYear);
      const effectiveEndMonth =
        itemEnd.year <= selfRetirementYear ? itemEnd.month : 12;

      // 실제 개월 수 계산 (은퇴까지만)
      const months =
        (effectiveEndYear - item.startYear) * 12 +
        (effectiveEndMonth - item.startMonth);
      if (months <= 0) return;

      // displayGrowthRate 사용 (이미 시나리오 적용됨)
      const monthlyGrowthRate =
        Math.pow(1 + item.displayGrowthRate / 100, 1 / 12) - 1;
      let monthlyAmount =
        item.frequency === "yearly" ? item.amount / 12 : item.amount;
      for (let i = 0; i < months; i++) {
        total += monthlyAmount;
        monthlyAmount *= 1 + monthlyGrowthRate;
      }
    });
    return Math.round(total);
  }, [displayItems, selfRetirementYear, spouseRetirementYear]);

  // 지출 유형별 월 지출 (현재 연도 해당 항목만)
  const expenseByType = useMemo(
    () => ({
      fixed: fixedItems
        .filter(isCurrentYearItem)
        .reduce((s, i) => s + toMonthlyAmount(i), 0),
      variable: variableItems
        .filter(isCurrentYearItem)
        .reduce((s, i) => s + toMonthlyAmount(i), 0),
      onetime: onetimeItems
        .filter(isCurrentYearItem)
        .reduce((s, i) => s + i.amount, 0),
      medical: currentMedicalItems.reduce((s, i) => s + toMonthlyAmount(i), 0),
    }),
    [
      fixedItems,
      variableItems,
      onetimeItems,
      currentMedicalItems,
      currentYear,
      selfRetirementYear,
      spouseRetirementYear,
    ],
  );

  // 차트 데이터 - simulationResult에서 직접 가져옴 (Single Source of Truth)
  const projectionData = useMemo(() => {
    const labels: string[] = [];
    const fixedData: number[] = [];
    const variableData: number[] = [];
    const onetimeData: number[] = [];
    const medicalData: number[] = [];

    simulationResult.snapshots.forEach((snapshot) => {
      let fixedTotal = 0;
      let variableTotal = 0;
      let onetimeTotal = 0;
      let medicalTotal = 0;

      // expenseBreakdown을 type 필드로 정확히 분류
      snapshot.expenseBreakdown.forEach(
        (item: { title: string; amount: number; type?: string }) => {
          const itemType = item.type || "";
          switch (itemType) {
            // 고정비
            case "insurance":
            case "subscription":
            case "maintenance":
              fixedTotal += item.amount;
              break;
            // 생활비/변동비
            case "living":
            case "food":
            case "transport":
            case "education":
            case "child":
            case "leisure":
            case "parents":
            case "other":
              variableTotal += item.amount;
              break;
            // 의료비
            case "health":
            case "medical":
              medicalTotal += item.amount;
              break;
            // 일시 지출
            case "travel":
            case "wedding":
            case "onetime":
              onetimeTotal += item.amount;
              break;
            default:
              // type이 없으면 키워드 기반 분류로 폴백
              if (itemType === "") {
                const category = categorizeExpense(item.title);
                switch (category.id) {
                  case "fixed":
                    fixedTotal += item.amount;
                    break;
                  case "living":
                    variableTotal += item.amount;
                    break;
                  case "medical":
                    medicalTotal += item.amount;
                    break;
                  default:
                    variableTotal += item.amount;
                }
              } else {
                variableTotal += item.amount;
              }
          }
        },
      );

      labels.push(`${snapshot.year}`);
      fixedData.push(fixedTotal);
      variableData.push(variableTotal);
      onetimeData.push(onetimeTotal);
      medicalData.push(medicalTotal);
    });

    return {
      labels,
      fixedData,
      variableData,
      onetimeData,
      medicalData,
    };
  }, [simulationResult]);

  // 차트 데이터셋
  const chartDatasets = useMemo(() => {
    const datasets = [];
    if (projectionData.fixedData.some((v) => v > 0)) {
      datasets.push({
        label: "고정비",
        data: projectionData.fixedData,
        backgroundColor: CHART_COLORS.expense.fixed,
      });
    }
    if (projectionData.variableData.some((v) => v > 0)) {
      datasets.push({
        label: "변동비",
        data: projectionData.variableData,
        backgroundColor: CHART_COLORS.expense.variable,
      });
    }
    if (projectionData.onetimeData.some((v) => v > 0)) {
      datasets.push({
        label: "일시",
        data: projectionData.onetimeData,
        backgroundColor: CHART_COLORS.expense.onetime,
      });
    }
    if (projectionData.medicalData.some((v) => v > 0)) {
      datasets.push({
        label: "의료비",
        data: projectionData.medicalData,
        backgroundColor: CHART_COLORS.expense.medical,
      });
    }
    return datasets;
  }, [projectionData]);

  const barChartData = {
    labels: projectionData.labels,
    datasets: chartDatasets.map((ds) => ({
      ...ds,
      borderRadius: 2,
    })),
  };

  // 커스텀 툴팁
  const getOrCreateTooltip = (chart: ChartJS) => {
    let tooltipEl = chart.canvas.parentNode?.querySelector(
      "div.chart-tooltip",
    ) as HTMLDivElement | null;
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "chart-tooltip";
      tooltipEl.style.cssText = `
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.06);
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        pointer-events: none;
        position: absolute;
        transform: translate(-50%, 0);
        transition: all 0.15s ease;
        padding: 14px 18px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        white-space: nowrap;
        z-index: 100;
        min-width: 200px;
      `;
      chart.canvas.parentNode?.appendChild(tooltipEl);
    }
    return tooltipEl;
  };

  const externalTooltipHandler = (context: {
    chart: ChartJS;
    tooltip: {
      opacity: number;
      caretX: number;
      caretY: number;
      dataPoints?: { dataIndex: number }[];
    };
  }) => {
    const { chart, tooltip } = context;
    const tooltipEl = getOrCreateTooltip(chart);

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = "0";
      return;
    }

    const dataIndex = tooltip.dataPoints?.[0]?.dataIndex ?? 0;
    const year = projectionData.labels[dataIndex];
    const yearNum = parseInt(year);

    const selfAgeAtYear = getAgeAtYear(yearNum, true);
    const spouseAgeAtYear = hasSpouse ? getAgeAtYear(yearNum, false) : null;
    const ageDisplay =
      spouseAgeAtYear !== null
        ? `본인 ${selfAgeAtYear}세, 배우자 ${spouseAgeAtYear}세`
        : `본인 ${selfAgeAtYear}세`;

    const items: { label: string; value: number; color: string }[] = [];
    let total = 0;

    chartDatasets.forEach((ds) => {
      const value = ds.data[dataIndex];
      items.push({ label: ds.label, value, color: ds.backgroundColor });
      total += value;
    });

    const activeItems = items.filter((item) => item.value > 0);

    if (activeItems.length > 0) {
      const itemsHtml = activeItems
        .map(
          (item) => `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 24px; margin: 6px 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${item.color};"></span>
            <span style="font-size: 14px; color: #1d1d1f;">${item.label}</span>
          </div>
          <span style="font-size: 14px; font-weight: 600; color: #1d1d1f;">${formatMoney(item.value)}</span>
        </div>
      `,
        )
        .join("");

      tooltipEl.innerHTML = `
        <div style="font-size: 16px; font-weight: 700; color: #1d1d1f; margin-bottom: 2px;">${year}년</div>
        <div style="font-size: 12px; color: #86868b; margin-bottom: 10px;">${ageDisplay}</div>
        ${itemsHtml}
        <div style="border-top: 1px solid rgba(0,0,0,0.08); margin-top: 10px; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; color: #86868b;">총 지출</span>
          <span style="font-size: 15px; font-weight: 700; color: #ff3b30;">${formatMoney(total)}</span>
        </div>
      `;
    } else {
      tooltipEl.innerHTML = `
        <div style="font-size: 16px; font-weight: 700; color: #1d1d1f; margin-bottom: 2px;">${year}년</div>
        <div style="font-size: 12px; color: #86868b; margin-bottom: 10px;">${ageDisplay}</div>
        <div style="font-size: 14px; color: #86868b; text-align: center; padding: 8px 0;">지출 없음</div>
        <div style="border-top: 1px solid rgba(0,0,0,0.08); margin-top: 10px; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; color: #86868b;">총 지출</span>
          <span style="font-size: 15px; font-weight: 700; color: #86868b;">0원</span>
        </div>
      `;
    }

    const chartWidth = chart.canvas.offsetWidth;
    const tooltipWidth = tooltipEl.offsetWidth || 180;
    let leftPos = tooltip.caretX;
    if (leftPos + tooltipWidth / 2 > chartWidth) {
      leftPos = chartWidth - tooltipWidth / 2 - 10;
    } else if (leftPos - tooltipWidth / 2 < 0) {
      leftPos = tooltipWidth / 2 + 10;
    }

    tooltipEl.style.opacity = "1";
    tooltipEl.style.left = leftPos + "px";
    tooltipEl.style.top = Math.max(10, tooltip.caretY - 60) + "px";
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: chartDatasets.length > 1,
        position: "top" as const,
        labels: { boxWidth: 12, font: { size: 11 } },
      },
      tooltip: {
        enabled: false,
        external: externalTooltipHandler,
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 },
      },
      y: {
        stacked: true,
        grid: { color: chartScaleColors.gridColor },
        ticks: {
          font: { size: 11 },
          color: chartScaleColors.tickColor,
          callback: (value: number | string) => {
            const num = typeof value === "number" ? value : parseFloat(value);
            if (num >= 10000) {
              const eok = Math.floor(num / 10000);
              const cheon = Math.floor((num % 10000) / 1000);
              if (cheon > 0) return `${eok}억 ${cheon}천`;
              return `${eok}억`;
            }
            if (num >= 1000) return `${(num / 1000).toFixed(0)}천`;
            return `${num.toLocaleString()}만`;
          },
        },
      },
    },
  };

  // 나이대별 의료비 자동 생성 (DB)
  const generateMedicalExpenses = async () => {
    if (!simulationId) return;

    const ageKeys = Object.keys(MEDICAL_EXPENSE_BY_AGE)
      .map(Number)
      .sort((a, b) => a - b);

    try {
      // 기존 의료비 항목 삭제
      const medicalItems = dbExpenses.filter((e) => e.type === "medical");
      for (const item of medicalItems) {
        await deleteExpense(item.id);
      }

      // 본인 의료비 생성
      for (let i = 0; i < ageKeys.length; i++) {
        const startAge = ageKeys[i];
        const endAge = i < ageKeys.length - 1 ? ageKeys[i + 1] - 1 : 100;
        const startYear = birthYear + startAge;
        const endYear = birthYear + endAge;

        if (endYear < currentYear) continue;

        const amount = MEDICAL_EXPENSE_BY_AGE[startAge];
        await createExpense({
          simulation_id: simulationId,
          type: "medical",
          title: `본인 의료비 (${startAge}대)`,
          amount,
          frequency: "monthly",
          start_year: Math.max(startYear, currentYear),
          start_month: 1,
          end_year: endYear,
          end_month: 12,
          is_fixed_to_retirement: false,
          growth_rate: 3,
          rate_category: "inflation",
        });
      }

      // 배우자 의료비 생성 (배우자가 있는 경우)
      if (isMarried && spouseBirthYear) {
        for (let i = 0; i < ageKeys.length; i++) {
          const startAge = ageKeys[i];
          const endAge = i < ageKeys.length - 1 ? ageKeys[i + 1] - 1 : 100;
          const startYear = spouseBirthYear + startAge;
          const endYear = spouseBirthYear + endAge;

          if (endYear < currentYear) continue;

          const amount = MEDICAL_EXPENSE_BY_AGE[startAge];
          await createExpense({
            simulation_id: simulationId,
            type: "medical",
            title: `배우자 의료비 (${startAge}대)`,
            amount,
            frequency: "monthly",
            start_year: Math.max(startYear, currentYear),
            start_month: 1,
            end_year: endYear,
            end_month: 12,
            is_fixed_to_retirement: false,
            growth_rate: 3,
            rate_category: "inflation",
          });
        }
      }

      invalidate("expenses");
      setMedicalExpanded(true);
    } catch (error) {
      console.error("Failed to generate medical expenses:", error);
    }
  };

  // 항목 추가 (DB)
  const handleAdd = async () => {
    if (!addingType || !newAmount || !simulationId) return;

    const isOnetime = addingType === "onetime";

    // retirement_link 결정
    let retirementLink: string | null = null;
    if (!isOnetime) {
      if (newEndType === 'self-retirement') retirementLink = 'self';
      else if (newEndType === 'spouse-retirement') retirementLink = 'spouse';
    }

    // growth_rate 결정
    const growthRate = isOnetime ? 0
      : newRateCategory === 'fixed'
        ? (newCustomRate === '' ? 0 : parseFloat(newCustomRate))
        : globalSettings.inflationRate;

    try {
      await createExpense({
        simulation_id: simulationId,
        type: uiTypeToDBType(addingType),
        title: newLabel || getDefaultLabel(addingType),
        amount: parseFloat(newAmount),
        frequency: isOnetime ? "monthly" : newFrequency,
        start_year: isOnetime ? newOnetimeYear : newStartYear,
        start_month: isOnetime ? newOnetimeMonth : newStartMonth,
        // retirement_link가 있으면 end_year는 null - 시뮬레이션 시점에 동적 계산
        end_year: isOnetime ? newOnetimeYear : (retirementLink ? null : newEndYear),
        end_month: isOnetime ? newOnetimeMonth : (retirementLink ? null : newEndMonth),
        is_fixed_to_retirement: !isOnetime && retirementLink !== null,
        retirement_link: retirementLink as 'self' | 'spouse' | null,
        growth_rate: growthRate,
        rate_category: newRateCategory as any,
      });
      invalidate("expenses");
      resetAddForm();
    } catch (error) {
      console.error("Failed to add expense:", error);
    }
  };

  const getDefaultLabel = (type: ExpenseType): string => {
    switch (type) {
      case "fixed":
        return "고정 지출";
      case "variable":
        return "변동 지출";
      case "onetime":
        return "일시 지출";
      case "medical":
        return "의료비";
      default:
        return "지출";
    }
  };

  const resetAddForm = () => {
    setShowTypeMenu(false);
    setAddingType(null);
    setNewLabel("");
    setNewAmount("");
    setNewFrequency("monthly");
    setNewOnetimeYear(currentYear);
    setNewOnetimeMonth(currentMonth);
    setNewOnetimeDateText(toPeriodRaw(currentYear, currentMonth));
    setNewStartType('current');
    setNewStartYear(currentYear);
    setNewStartMonth(currentMonth);
    setNewStartDateText(toPeriodRaw(currentYear, currentMonth));
    setNewEndType('self-retirement');
    setNewEndYear(selfRetirementYear);
    setNewEndMonth(12);
    setNewEndDateText(toPeriodRaw(selfRetirementYear, 12));
    setNewRateCategory('inflation');
    setNewCustomRate("");
  };

  // 항목 삭제 (DB)
  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      invalidate("expenses");
      if (editingId === id) {
        setEditingId(null);
        setEditForm(null);
      }
    } catch (error) {
      console.error("Failed to delete expense:", error);
      alert("연동된 지출은 원본에서 삭제해주세요");
    }
  };

  // 편집 시작
  const startEdit = (item: ExpenseItem) => {
    setEditingId(item.id);
    // rateCategory가 없는 기존 항목은 기본값 설정
    const itemWithCategory = {
      ...item,
      rateCategory: item.rateCategory || getDefaultRateCategory(item.type),
    };
    setEditForm(itemWithCategory);
    // startType 결정
    if (item.startYear === currentYear && item.startMonth === currentMonth) {
      setEditStartType('current');
    } else if (item.startYear === selfRetirementYear && item.startMonth === 12) {
      setEditStartType('self-retirement');
    } else if (hasSpouse && item.startYear === spouseRetirementYear && item.startMonth === 12) {
      setEditStartType('spouse-retirement');
    } else {
      setEditStartType('year');
    }
    setEditStartDateText(toPeriodRaw(item.startYear, item.startMonth));
    // endType 결정
    if (item.endType === 'self-retirement') {
      setEditEndType('self-retirement');
    } else if (item.endType === 'spouse-retirement') {
      setEditEndType('spouse-retirement');
    } else {
      setEditEndType('year');
    }
    setEditEndDateText(toPeriodRaw(item.endYear || currentYear, item.endMonth || 12));
    if (itemWithCategory.rateCategory === 'fixed') {
      setCustomRateInput(String(item.growthRate));
    } else {
      setCustomRateInput("");
    }
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setEditStartType('current');
    setEditEndType('self-retirement');
    setCustomRateInput("");
  };

  // 편집 저장 (DB)
  const saveEdit = async () => {
    if (!editForm) return;

    // If fixed mode, use customRateInput; otherwise growthRate doesn't matter (engine uses rateCategory)
    const finalGrowthRate = editForm.rateCategory === 'fixed'
      ? (customRateInput === "" ? 0 : parseFloat(customRateInput))
      : editForm.growthRate;

    const isFixedToRetirement =
      editForm.endType === "self-retirement" ||
      editForm.endType === "spouse-retirement";

    // retirement_link 결정: endType에 따라 'self', 'spouse', null
    const retirementLink =
      editForm.endType === "self-retirement"
        ? "self"
        : editForm.endType === "spouse-retirement"
          ? "spouse"
          : null;

    // retirement_link가 있으면 end_year는 null - 시뮬레이션 시점에 동적 계산
    const endYearToSave = retirementLink ? null : editForm.endYear;
    const endMonthToSave = retirementLink ? null : editForm.endMonth;

    try {
      await updateExpense(editForm.id, {
        type: uiTypeToDBType(editForm.type),
        title: editForm.label,
        amount: editForm.amount,
        frequency: editForm.frequency,
        start_year: editForm.startYear,
        start_month: editForm.startMonth,
        end_year: endYearToSave,
        end_month: endMonthToSave,
        is_fixed_to_retirement: isFixedToRetirement,
        retirement_link: retirementLink,
        growth_rate: finalGrowthRate,
        rate_category: editForm.rateCategory as any,
      });
      invalidate("expenses");
      cancelEdit();
    } catch (error) {
      console.error("Failed to update expense:", error);
    }
  };

  // 기간 표시
  const formatPeriod = (item: ExpenseItem): string => {
    if (item.type === "onetime") {
      return `${item.startYear}.${String(item.startMonth).padStart(2, "0")} 지출 예정`;
    }

    const startStr = `${item.startYear}.${String(item.startMonth).padStart(2, "0")}`;

    if (item.endType === "self-retirement") return `${startStr} ~ 본인 은퇴`;
    if (item.endType === "spouse-retirement")
      return `${startStr} ~ 배우자 은퇴`;

    // 종료일이 없으면 "시작일 ~" 형식으로 표시
    if (!item.endYear) return `${startStr} ~`;

    const endStr = `${item.endYear}.${String(item.endMonth || 12).padStart(2, "0")}`;
    return `${startStr} ~ ${endStr}`;
  };

  // 금액 표시
  const formatAmountWithFreq = (item: ExpenseItem): string => {
    if (item.type === "onetime") return formatMoney(item.amount);
    const unit = item.frequency === "yearly" ? "/년" : "/월";
    return `${formatMoney(item.amount)}${unit}`;
  };

  // 상승률 프리셋 확인
  const isPresetRate = (rate: number) =>
    GROWTH_PRESETS.some((p) => p.value === rate);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId) {
          cancelEdit();
          e.stopPropagation();
        } else if (showTypeMenu) {
          resetAddForm();
          e.stopPropagation();
        }
      }
    };
    window.addEventListener("keydown", handleEsc, true);
    return () => window.removeEventListener("keydown", handleEsc, true);
  }, [showTypeMenu, editingId]);

  const handleTypeSelect = (type: ExpenseType) => {
    setAddingType(type);
    // 기본값 초기화
    setNewStartType('current');
    setNewStartYear(currentYear);
    setNewStartMonth(currentMonth);
    setNewEndType('self-retirement');
    setNewEndYear(selfRetirementYear);
    setNewEndMonth(12);
    setNewRateCategory(getDefaultRateCategory(type));
    setNewCustomRate("");
    // DON'T close showTypeMenu - stay in modal for step 2
  };

  // 아이템 렌더링 함수 (개별 항목) - 항상 읽기 모드
  const renderItem = (item: DisplayItem) => {
    // Always render read mode - editing is done in modal
    return (
      <div key={item.id} className={styles.expenseItem}>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{item.label}</span>
          <span className={styles.itemMeta}>
            {item.type === "onetime"
              ? formatPeriod(item)
              : `${formatPeriod(item)} | 연 ${item.displayGrowthRate}% 상승${isScenarioMode ? " (시나리오)" : ""}`}
          </span>
        </div>
        <div className={styles.itemRight}>
          <span className={styles.itemAmount}>
            {formatAmountWithFreq(item)}
          </span>
          <div className={styles.itemActions}>
            <button className={styles.editBtn} onClick={() => startEdit(item)}>
              <Pencil size={16} />
            </button>
            <button
              className={styles.deleteBtn}
              onClick={() => handleDelete(item.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 인라인 추가 폼 렌더링
  const renderInlineAddForm = () => {
    if (!addingType) return null;

    return (
      <div className={styles.inlineAddForm}>
        <div className={styles.addFormRow}>
          <input
            type="text"
            className={styles.inlineLabelInput}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="항목명"
            autoFocus
          />
        </div>

        <div className={styles.addFormRow}>
          {addingType === "onetime" ? (
            <>
              <div className={styles.inlineAmountGroup}>
                <input
                  type="number"
                  className={styles.inlineAmountInput}
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.inlineUnit}>만원</span>
              </div>
              <div className={styles.inlineDateGroup}>
                <input
                  type="number"
                  className={styles.editYearInput}
                  min={1900}
                  max={2200}
                  value={newOnetimeYear}
                  onChange={(e) =>
                    setNewOnetimeYear(parseInt(e.target.value) || currentYear)
                  }
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.editUnit}>년</span>
                <input
                  type="number"
                  className={styles.editMonthInput}
                  value={newOnetimeMonth}
                  min={1}
                  max={12}
                  onChange={(e) =>
                    setNewOnetimeMonth(
                      Math.min(12, Math.max(1, parseInt(e.target.value) || 1)),
                    )
                  }
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.editUnit}>월 지출</span>
              </div>
            </>
          ) : (
            <div className={styles.inlineAmountGroup}>
              <input
                type="number"
                className={styles.inlineAmountInput}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0"
              />
              <span className={styles.inlineUnit}>만원</span>
              <div className={styles.frequencyButtons}>
                <button
                  type="button"
                  className={`${styles.freqBtn} ${
                    newFrequency === "monthly" ? styles.active : ""
                  }`}
                  onClick={() => setNewFrequency("monthly")}
                >
                  /월
                </button>
                <button
                  type="button"
                  className={`${styles.freqBtn} ${
                    newFrequency === "yearly" ? styles.active : ""
                  }`}
                  onClick={() => setNewFrequency("yearly")}
                >
                  /년
                </button>
              </div>
            </div>
          )}

          <div className={styles.inlineActions}>
            <button className={styles.inlineCancelBtn} onClick={resetAddForm}>
              취소
            </button>
            <button
              className={styles.inlineAddBtn}
              onClick={handleAdd}
              disabled={!newAmount}
            >
              추가
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 섹션 렌더링 (items는 displayItems에서 필터된 것)
  const renderSection = (
    title: string,
    type: ExpenseType,
    items: DisplayItem[],
    description?: string,
    sectionBadge?: { icon: React.ReactNode; label: string },
  ) => (
    <div className={styles.expenseSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
        {sectionBadge && (
          <span className={styles.sectionBadge}>
            {sectionBadge.icon}
            {sectionBadge.label}
          </span>
        )}
      </div>
      {description && <p className={styles.sectionDesc}>{description}</p>}

      <div className={styles.itemList}>
        {items.map((item) => {
          const isEditing = editingId === item.id;

          if (isEditing && editForm) {
            // 일시적 지출 편집
            if (item.type === "onetime") {
              return (
                <div key={item.id} className={styles.editItem}>
                  <div className={styles.editRow}>
                    <span className={styles.editRowLabel}>항목</span>
                    <input
                      type="text"
                      className={styles.editLabelInput}
                      value={editForm.label}
                      onChange={(e) =>
                        setEditForm({ ...editForm, label: e.target.value })
                      }
                      placeholder="항목명"
                    />
                  </div>

                  <div className={styles.editRow}>
                    <span className={styles.editRowLabel}>금액</span>
                    <div className={styles.editField}>
                      <input
                        type="number"
                        className={styles.editInput}
                        value={editForm.amount || ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.editUnit}>만원</span>
                    </div>
                  </div>

                  <div className={styles.editRow}>
                    <span className={styles.editRowLabel}>지출</span>
                    <div className={styles.editField}>
                      <input
                        type="number"
                        className={styles.editYearInput}
                        min={1900}
                        max={2200}
                        value={editForm.startYear}
                        onChange={(e) => {
                          const year = parseInt(e.target.value) || currentYear;
                          setEditForm({
                            ...editForm,
                            startYear: year,
                            endYear: year,
                          });
                        }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.editUnit}>년</span>
                      <input
                        type="number"
                        className={styles.editMonthInput}
                        value={editForm.startMonth}
                        min={1}
                        max={12}
                        onChange={(e) => {
                          const month = Math.min(
                            12,
                            Math.max(1, parseInt(e.target.value) || 1),
                          );
                          setEditForm({
                            ...editForm,
                            startMonth: month,
                            endMonth: month,
                          });
                        }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.editUnit}>월</span>
                    </div>
                  </div>

                  <div className={styles.editActions}>
                    <button className={styles.cancelBtn} onClick={cancelEdit}>
                      취소
                    </button>
                    <button className={styles.saveBtn} onClick={saveEdit}>
                      저장
                    </button>
                  </div>
                </div>
              );
            }

            // 일반 지출 편집
            return (
              <div key={item.id} className={styles.editItem}>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>항목</span>
                  <input
                    type="text"
                    className={styles.editLabelInput}
                    value={editForm.label}
                    onChange={(e) =>
                      setEditForm({ ...editForm, label: e.target.value })
                    }
                    placeholder="항목명"
                  />
                </div>

                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>금액</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInput}
                      value={editForm.amount || ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          amount: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <span className={styles.editUnit}>만원</span>
                    <div className={styles.frequencyButtons}>
                      <button
                        type="button"
                        className={`${styles.freqBtn} ${
                          editForm.frequency === "monthly" ? styles.active : ""
                        }`}
                        onClick={() =>
                          setEditForm({ ...editForm, frequency: "monthly" })
                        }
                      >
                        /월
                      </button>
                      <button
                        type="button"
                        className={`${styles.freqBtn} ${
                          editForm.frequency === "yearly" ? styles.active : ""
                        }`}
                        onClick={() =>
                          setEditForm({ ...editForm, frequency: "yearly" })
                        }
                      >
                        /년
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>시작</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editYearInput}
                      min={1900}
                      max={2200}
                      value={editForm.startYear}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          startYear: parseInt(e.target.value) || currentYear,
                        })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.editUnit}>년</span>
                    <input
                      type="number"
                      className={styles.editMonthInput}
                      value={editForm.startMonth}
                      min={1}
                      max={12}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          startMonth: Math.min(
                            12,
                            Math.max(1, parseInt(e.target.value) || 1),
                          ),
                        })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.editUnit}>월</span>
                  </div>
                </div>

                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>종료</span>
                  <div className={styles.editField}>
                    <div className={styles.endTypeButtons}>
                      <button
                        type="button"
                        className={`${styles.endTypeBtn} ${
                          editForm.endType === "self-retirement"
                            ? styles.active
                            : ""
                        }`}
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            endType: "self-retirement",
                          })
                        }
                      >
                        본인 은퇴
                      </button>
                      {hasSpouse && (
                        <button
                          type="button"
                          className={`${styles.endTypeBtn} ${
                            editForm.endType === "spouse-retirement"
                              ? styles.active
                              : ""
                          }`}
                          onClick={() =>
                            setEditForm({
                              ...editForm,
                              endType: "spouse-retirement",
                            })
                          }
                        >
                          배우자 은퇴
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${styles.endTypeBtn} ${
                          editForm.endType === "custom" ? styles.active : ""
                        }`}
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            endType: "custom",
                            endYear: editForm.endYear || selfRetirementYear,
                            endMonth: editForm.endMonth || 12,
                          })
                        }
                      >
                        직접 입력
                      </button>
                    </div>
                    {editForm.endType === "custom" && (
                      <>
                        <input
                          type="number"
                          className={styles.editYearInput}
                          min={1900}
                          max={2200}
                          value={editForm.endYear || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              endYear: parseInt(e.target.value) || null,
                            })
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.editUnit}>년</span>
                        <input
                          type="number"
                          className={styles.editMonthInput}
                          value={editForm.endMonth || ""}
                          min={1}
                          max={12}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              endMonth: Math.min(
                                12,
                                Math.max(1, parseInt(e.target.value) || 12),
                              ),
                            })
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.editUnit}>월</span>
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>상승률</span>
                  <div className={styles.rateButtons}>
                    <div className={styles.customRateGroup}>
                      <span className={styles.customRateLabel}>직접 입력</span>
                      <input
                        type="number"
                        className={`${styles.customRateInput} ${
                          isCustomRateMode ? styles.active : ""
                        }`}
                        value={customRateInput}
                        onFocus={() => {
                          setIsCustomRateMode(true);
                          if (customRateInput === "") {
                            setCustomRateInput(String(editForm.growthRate));
                          }
                        }}
                        onChange={(e) => setCustomRateInput(e.target.value)}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        placeholder="0"
                        step="0.5"
                      />
                      <span className={styles.rateUnit}>%</span>
                    </div>
                    {GROWTH_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className={`${styles.rateBtn} ${
                          !isCustomRateMode &&
                          editForm.growthRate === preset.value
                            ? styles.active
                            : ""
                        }`}
                        onClick={() => {
                          setIsCustomRateMode(false);
                          setCustomRateInput("");
                          setEditForm({
                            ...editForm,
                            growthRate: preset.value,
                          });
                        }}
                      >
                        {preset.value}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.editActions}>
                  <button className={styles.cancelBtn} onClick={cancelEdit}>
                    취소
                  </button>
                  <button className={styles.saveBtn} onClick={saveEdit}>
                    저장
                  </button>
                </div>
              </div>
            );
          }

          // 읽기 모드 - displayGrowthRate 사용 (이미 시나리오 적용됨)
          return (
            <div key={item.id} className={styles.expenseItem}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{item.label}</span>
                <span className={styles.itemMeta}>
                  {item.type === "onetime"
                    ? formatPeriod(item)
                    : `${formatPeriod(item)} | 연 ${item.displayGrowthRate}% 상승${isScenarioMode ? " (시나리오)" : ""}`}
                </span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemAmount}>
                  {formatAmountWithFreq(item)}
                </span>
                <div className={styles.itemActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => startEdit(item)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* 추가 폼 */}
        {addingType === type ? (
          <div className={styles.inlineAddForm}>
            <div className={styles.addFormRow}>
              <input
                type="text"
                className={styles.inlineLabelInput}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="항목명"
                autoFocus
              />
            </div>

            <div className={styles.addFormRow}>
              {type === "onetime" ? (
                <>
                  <div className={styles.inlineAmountGroup}>
                    <input
                      type="number"
                      className={styles.inlineAmountInput}
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder="0"
                    />
                    <span className={styles.inlineUnit}>만원</span>
                  </div>
                  <div className={styles.inlineDateGroup}>
                    <input
                      type="number"
                      className={styles.editYearInput}
                      min={1900}
                      max={2200}
                      value={newOnetimeYear}
                      onChange={(e) =>
                        setNewOnetimeYear(
                          parseInt(e.target.value) || currentYear,
                        )
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.editUnit}>년</span>
                    <input
                      type="number"
                      className={styles.editMonthInput}
                      value={newOnetimeMonth}
                      min={1}
                      max={12}
                      onChange={(e) =>
                        setNewOnetimeMonth(
                          Math.min(
                            12,
                            Math.max(1, parseInt(e.target.value) || 1),
                          ),
                        )
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.editUnit}>월 지출</span>
                  </div>
                </>
              ) : (
                <div className={styles.inlineAmountGroup}>
                  <input
                    type="number"
                    className={styles.inlineAmountInput}
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="0"
                  />
                  <span className={styles.inlineUnit}>만원</span>
                  <div className={styles.frequencyButtons}>
                    <button
                      type="button"
                      className={`${styles.freqBtn} ${
                        newFrequency === "monthly" ? styles.active : ""
                      }`}
                      onClick={() => setNewFrequency("monthly")}
                    >
                      /월
                    </button>
                    <button
                      type="button"
                      className={`${styles.freqBtn} ${
                        newFrequency === "yearly" ? styles.active : ""
                      }`}
                      onClick={() => setNewFrequency("yearly")}
                    >
                      /년
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.inlineActions}>
                <button
                  className={styles.inlineCancelBtn}
                  onClick={resetAddForm}
                >
                  취소
                </button>
                <button
                  className={styles.inlineAddBtn}
                  onClick={handleAdd}
                  disabled={!newAmount}
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button className={styles.addBtn} onClick={() => setAddingType(type)}>
            <Plus size={16} />
            추가
          </button>
        )}
      </div>
    </div>
  );

  // 캐시된 데이터가 없고 로딩 중일 때만 스켈레톤 표시
  if (isLoading && dbExpenses.length === 0) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={2} itemsPerSection={3} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          className={styles.headerToggle}
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          <span className={styles.title}>지출</span>
          <span className={styles.count}>{totalCount}개</span>
        </button>
        <div className={styles.headerRight}>
          <button
            ref={addButtonRef}
            className={styles.addIconBtn}
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            type="button"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* 타입 선택 모달 (2-step) */}
      {showTypeMenu && createPortal(
        <div className={styles.typeModalOverlay} data-scenario-dropdown-portal="true" onClick={resetAddForm}>
          <div className={styles.typeModal} onClick={e => e.stopPropagation()} style={{
            background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}>
            {!addingType ? (
              // Step 1: type selection grid
              <>
                <div className={styles.typeModalHeader}>
                  <span className={styles.typeModalTitle}>지출 추가</span>
                  <button className={styles.typeModalClose} onClick={resetAddForm}><X size={18} /></button>
                </div>
                <div className={styles.typeGrid}>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('fixed')}>
                    <span className={styles.typeCardName}>고정 지출</span>
                    <span className={styles.typeCardDesc}>보험, 구독, 관리비 등</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('variable')}>
                    <span className={styles.typeCardName}>변동 지출</span>
                    <span className={styles.typeCardDesc}>식비, 교통, 여가 등</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('onetime')}>
                    <span className={styles.typeCardName}>일시적 지출</span>
                    <span className={styles.typeCardDesc}>여행, 경조사 등</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('medical')}>
                    <span className={styles.typeCardName}>의료비</span>
                    <span className={styles.typeCardDesc}>건강, 치료 등</span>
                  </button>
                </div>
              </>
            ) : (
              // Step 2: form inside modal
              <>
                <div className={styles.typeModalHeader}>
                  <div className={styles.headerLeft}>
                    <button className={styles.backButton} onClick={() => setAddingType(null)}><ArrowLeft size={18} /></button>
                    <span className={styles.stepLabel}>{getDefaultLabel(addingType)} 추가</span>
                  </div>
                  <button className={styles.typeModalClose} onClick={resetAddForm}><X size={18} /></button>
                </div>
                <div className={styles.modalFormBody}>
                  {/* 항목명 */}
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>항목명</span>
                    <input
                      type="text"
                      className={styles.modalFormInput}
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder={getDefaultLabel(addingType)}
                      autoFocus
                    />
                  </div>

                  {/* 금액 + 주기 */}
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>금액</span>
                    <input
                      type="number"
                      className={styles.modalFormInput}
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder="0"
                    />
                    <span className={styles.modalFormUnit}>만원</span>
                    {addingType !== 'onetime' && (
                      <div className={styles.frequencyButtons}>
                        <button
                          type="button"
                          className={`${styles.freqBtn} ${newFrequency === 'monthly' ? styles.active : ''}`}
                          onClick={() => setNewFrequency('monthly')}
                        >
                          /월
                        </button>
                        <button
                          type="button"
                          className={`${styles.freqBtn} ${newFrequency === 'yearly' ? styles.active : ''}`}
                          onClick={() => setNewFrequency('yearly')}
                        >
                          /년
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 기간 */}
                  {addingType === 'onetime' ? (
                    <div className={styles.modalFormRow}>
                      <span className={styles.modalFormLabel}>지출시점</span>
                      <div className={styles.fieldContent}>
                        <input
                          type="text"
                          className={`${styles.periodInput}${newOnetimeDateText.length > 0 && !isPeriodValid(newOnetimeDateText) ? ` ${styles.invalid}` : ''}`}
                          value={formatPeriodDisplay(newOnetimeDateText)}
                          onChange={(e) => handlePeriodTextChange(e, setNewOnetimeDateText, setNewOnetimeYear, setNewOnetimeMonth)}
                          placeholder="2026.01"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.modalFormRow}>
                        <span className={styles.modalFormLabel}>시작일</span>
                        <div className={styles.fieldContent}>
                          <select
                            className={styles.periodSelect}
                            value={newStartType}
                            onChange={(e) => {
                              const val = e.target.value as typeof newStartType;
                              setNewStartType(val);
                              if (val === 'current') {
                                setNewStartYear(currentYear);
                                setNewStartMonth(currentMonth);
                                setNewStartDateText(toPeriodRaw(currentYear, currentMonth));
                              } else if (val === 'self-retirement') {
                                setNewStartYear(selfRetirementYear);
                                setNewStartMonth(12);
                                setNewStartDateText(toPeriodRaw(selfRetirementYear, 12));
                              } else if (val === 'spouse-retirement') {
                                setNewStartYear(spouseRetirementYear);
                                setNewStartMonth(12);
                                setNewStartDateText(toPeriodRaw(spouseRetirementYear, 12));
                              }
                            }}
                          >
                            <option value="current">현재</option>
                            <option value="self-retirement">본인 은퇴</option>
                            {hasSpouse && <option value="spouse-retirement">배우자 은퇴</option>}
                            <option value="year">직접 입력</option>
                          </select>
                          {newStartType === 'year' && (
                            <input
                              type="text"
                              className={`${styles.periodInput}${newStartDateText.length > 0 && !isPeriodValid(newStartDateText) ? ` ${styles.invalid}` : ''}`}
                              value={formatPeriodDisplay(newStartDateText)}
                              onChange={(e) => handlePeriodTextChange(e, setNewStartDateText, setNewStartYear, setNewStartMonth)}
                              placeholder="2026.01"
                            />
                          )}
                        </div>
                      </div>
                      <div className={styles.modalFormRow}>
                        <span className={styles.modalFormLabel}>종료일</span>
                        <div className={styles.fieldContent}>
                          <select
                            className={styles.periodSelect}
                            value={newEndType}
                            onChange={(e) => {
                              const val = e.target.value as typeof newEndType;
                              setNewEndType(val);
                              if (val === 'self-retirement') {
                                setNewEndYear(selfRetirementYear);
                                setNewEndMonth(12);
                                setNewEndDateText(toPeriodRaw(selfRetirementYear, 12));
                              } else if (val === 'spouse-retirement') {
                                setNewEndYear(spouseRetirementYear);
                                setNewEndMonth(12);
                                setNewEndDateText(toPeriodRaw(spouseRetirementYear, 12));
                              }
                            }}
                          >
                            <option value="self-retirement">본인 은퇴</option>
                            {hasSpouse && <option value="spouse-retirement">배우자 은퇴</option>}
                            <option value="year">직접 입력</option>
                          </select>
                          {newEndType === 'year' && (
                            <input
                              type="text"
                              className={`${styles.periodInput}${newEndDateText.length > 0 && !isPeriodValid(newEndDateText) ? ` ${styles.invalid}` : ''}`}
                              value={formatPeriodDisplay(newEndDateText)}
                              onChange={(e) => handlePeriodTextChange(e, setNewEndDateText, setNewEndYear, setNewEndMonth)}
                              placeholder="2030.12"
                            />
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* 상승률 (onetime 제외) */}
                  {addingType !== 'onetime' && (() => {
                    const defaultRate = globalSettings.inflationRate;
                    const addEffectiveRate = getEffectiveRate(
                      defaultRate,
                      newRateCategory,
                      globalSettings.scenarioMode,
                      globalSettings
                    );
                    return (
                      <div className={styles.modalFormRow}>
                        <span className={styles.modalFormLabel}>상승률</span>
                        <div className={styles.fieldContent}>
                          {newRateCategory !== 'fixed' && (
                            <span className={styles.rateValue}>{addEffectiveRate}%</span>
                          )}
                          {newRateCategory === 'fixed' && (
                            <>
                              <input
                                type="number"
                                className={styles.customRateInput}
                                value={newCustomRate}
                                onChange={(e) => setNewCustomRate(e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                placeholder="0"
                                step="0.5"
                              />
                              <span className={styles.rateUnit}>%</span>
                            </>
                          )}
                          <div className={styles.rateToggle}>
                            <button
                              type="button"
                              className={`${styles.rateToggleBtn} ${newRateCategory !== 'fixed' ? styles.active : ''}`}
                              onClick={() => {
                                setNewRateCategory(getDefaultRateCategory(addingType));
                                setNewCustomRate("");
                              }}
                            >
                              시뮬레이션 가정
                            </button>
                            <button
                              type="button"
                              className={`${styles.rateToggleBtn} ${newRateCategory === 'fixed' ? styles.active : ''}`}
                              onClick={() => {
                                setNewRateCategory('fixed');
                                if (newCustomRate === '') setNewCustomRate("0");
                              }}
                            >
                              직접 입력
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 하단 버튼 */}
                  <div className={styles.modalFormActions}>
                    <button className={styles.modalCancelBtn} onClick={resetAddForm}>
                      취소
                    </button>
                    <button
                      className={styles.modalAddBtn}
                      onClick={handleAdd}
                      disabled={
                        !newAmount ||
                        (addingType === 'onetime' && !isPeriodValid(newOnetimeDateText)) ||
                        (addingType !== 'onetime' && (
                          (newStartType === 'year' && !isPeriodValid(newStartDateText)) ||
                          (newEndType === 'year' && !isPeriodValid(newEndDateText))
                        ))
                      }
                    >
                      추가
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 편집 모달 */}
      {editingId && editForm && createPortal(
        <div className={styles.typeModalOverlay} data-scenario-dropdown-portal="true" onClick={cancelEdit}>
          <div className={styles.typeModal} onClick={e => e.stopPropagation()} style={{
            background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}>
            <div className={styles.typeModalHeader}>
              <span className={styles.stepLabel}>{getDefaultLabel(editForm.type)} 수정</span>
              <button className={styles.typeModalClose} onClick={cancelEdit}><X size={18} /></button>
            </div>
            <div className={styles.modalFormBody}>
              {/* 항목명 */}
              <div className={styles.modalFormRow}>
                <span className={styles.modalFormLabel}>항목명</span>
                <input
                  type="text"
                  className={styles.modalFormInput}
                  value={editForm.label}
                  onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                  placeholder="항목명"
                />
              </div>

              {/* 금액 + 주기 */}
              <div className={styles.modalFormRow}>
                <span className={styles.modalFormLabel}>금액</span>
                <input
                  type="number"
                  className={styles.modalFormInput}
                  value={editForm.amount || ''}
                  onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.modalFormUnit}>만원</span>
                {editForm.type !== 'onetime' && (
                  <div className={styles.frequencyButtons}>
                    <button
                      type="button"
                      className={`${styles.freqBtn} ${editForm.frequency === 'monthly' ? styles.active : ''}`}
                      onClick={() => setEditForm({ ...editForm, frequency: 'monthly' })}
                    >
                      /월
                    </button>
                    <button
                      type="button"
                      className={`${styles.freqBtn} ${editForm.frequency === 'yearly' ? styles.active : ''}`}
                      onClick={() => setEditForm({ ...editForm, frequency: 'yearly' })}
                    >
                      /년
                    </button>
                  </div>
                )}
              </div>

              {/* 기간 */}
              {editForm.type === 'onetime' ? (
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>지출시점</span>
                  <div className={styles.fieldContent}>
                    <input
                      type="text"
                      className={`${styles.periodInput}${editStartDateText.length > 0 && !isPeriodValid(editStartDateText) ? ` ${styles.invalid}` : ''}`}
                      value={formatPeriodDisplay(editStartDateText)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setEditStartDateText(raw);
                        if (raw.length >= 4) {
                          const y = parseInt(raw.slice(0, 4));
                          if (!isNaN(y)) setEditForm({ ...editForm, startYear: y, endYear: y });
                        }
                        if (raw.length >= 5) {
                          const m = parseInt(raw.slice(4));
                          if (!isNaN(m) && m >= 1 && m <= 12) setEditForm({ ...editForm, startMonth: m, endMonth: m });
                        }
                      }}
                      placeholder="2026.01"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>시작일</span>
                    <div className={styles.fieldContent}>
                      <select
                        className={styles.periodSelect}
                        value={editStartType}
                        onChange={(e) => {
                          const val = e.target.value as typeof editStartType;
                          setEditStartType(val);
                          if (val === 'current') {
                            setEditForm({ ...editForm, startYear: currentYear, startMonth: currentMonth });
                            setEditStartDateText(toPeriodRaw(currentYear, currentMonth));
                          } else if (val === 'self-retirement') {
                            setEditForm({ ...editForm, startYear: selfRetirementYear, startMonth: 12 });
                            setEditStartDateText(toPeriodRaw(selfRetirementYear, 12));
                          } else if (val === 'spouse-retirement') {
                            setEditForm({ ...editForm, startYear: spouseRetirementYear, startMonth: 12 });
                            setEditStartDateText(toPeriodRaw(spouseRetirementYear, 12));
                          }
                        }}
                      >
                        <option value="current">현재</option>
                        <option value="self-retirement">본인 은퇴</option>
                        {hasSpouse && <option value="spouse-retirement">배우자 은퇴</option>}
                        <option value="year">직접 입력</option>
                      </select>
                      {editStartType === 'year' && (
                        <input
                          type="text"
                          className={`${styles.periodInput}${editStartDateText.length > 0 && !isPeriodValid(editStartDateText) ? ` ${styles.invalid}` : ''}`}
                          value={formatPeriodDisplay(editStartDateText)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setEditStartDateText(raw);
                            if (raw.length >= 4) {
                              const y = parseInt(raw.slice(0, 4));
                              if (!isNaN(y)) setEditForm({ ...editForm, startYear: y });
                            }
                            if (raw.length >= 5) {
                              const m = parseInt(raw.slice(4));
                              if (!isNaN(m) && m >= 1 && m <= 12) setEditForm({ ...editForm, startMonth: m });
                            }
                          }}
                          placeholder="2026.01"
                        />
                      )}
                    </div>
                  </div>
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>종료일</span>
                    <div className={styles.fieldContent}>
                      <select
                        className={styles.periodSelect}
                        value={editEndType}
                        onChange={(e) => {
                          const val = e.target.value as typeof editEndType;
                          setEditEndType(val);
                          if (val === 'self-retirement') {
                            setEditForm({ ...editForm, endYear: selfRetirementYear, endMonth: 12 });
                            setEditEndDateText(toPeriodRaw(selfRetirementYear, 12));
                          } else if (val === 'spouse-retirement') {
                            setEditForm({ ...editForm, endYear: spouseRetirementYear, endMonth: 12 });
                            setEditEndDateText(toPeriodRaw(spouseRetirementYear, 12));
                          }
                        }}
                      >
                        <option value="self-retirement">본인 은퇴</option>
                        {hasSpouse && <option value="spouse-retirement">배우자 은퇴</option>}
                        <option value="year">직접 입력</option>
                      </select>
                      {editEndType === 'year' && (
                        <input
                          type="text"
                          className={`${styles.periodInput}${editEndDateText.length > 0 && !isPeriodValid(editEndDateText) ? ` ${styles.invalid}` : ''}`}
                          value={formatPeriodDisplay(editEndDateText)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setEditEndDateText(raw);
                            if (raw.length >= 4) {
                              const y = parseInt(raw.slice(0, 4));
                              if (!isNaN(y)) setEditForm({ ...editForm, endYear: y });
                            }
                            if (raw.length >= 5) {
                              const m = parseInt(raw.slice(4));
                              if (!isNaN(m) && m >= 1 && m <= 12) setEditForm({ ...editForm, endMonth: m });
                            }
                          }}
                          placeholder="2030.12"
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* 상승률 (onetime 제외) */}
              {editForm.type !== 'onetime' && (() => {
                const defaultRate = globalSettings.inflationRate;
                const editEffectiveRate = getEffectiveRate(
                  defaultRate,
                  editForm.rateCategory,
                  globalSettings.scenarioMode,
                  globalSettings
                );
                return (
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>상승률</span>
                    <div className={styles.fieldContent}>
                      {editForm.rateCategory !== 'fixed' && (
                        <span className={styles.rateValue}>{editEffectiveRate}%</span>
                      )}
                      {editForm.rateCategory === 'fixed' && (
                        <>
                          <input
                            type="number"
                            className={styles.customRateInput}
                            value={editForm.growthRate ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, growthRate: parseFloat(e.target.value) || 0 })}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            placeholder="0"
                            step="0.5"
                          />
                          <span className={styles.rateUnit}>%</span>
                        </>
                      )}
                      <div className={styles.rateToggle}>
                        <button
                          type="button"
                          className={`${styles.rateToggleBtn} ${editForm.rateCategory !== 'fixed' ? styles.active : ''}`}
                          onClick={() => {
                            setEditForm({ ...editForm, rateCategory: getDefaultRateCategory(editForm.type) });
                          }}
                        >
                          시뮬레이션 가정
                        </button>
                        <button
                          type="button"
                          className={`${styles.rateToggleBtn} ${editForm.rateCategory === 'fixed' ? styles.active : ''}`}
                          onClick={() => {
                            setEditForm({ ...editForm, rateCategory: 'fixed' });
                          }}
                        >
                          직접 입력
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 하단 버튼 */}
              <div className={styles.modalFormActions}>
                <button className={styles.modalCancelBtn} onClick={cancelEdit}>
                  취소
                </button>
                <button className={styles.modalAddBtn} onClick={saveEdit}>
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isExpanded && (
        <>
          <div className={styles.flatList}>
            {displayItems.length === 0 && (
              <p className={styles.emptyHint}>
                아직 등록된 지출이 없습니다. 오른쪽 + 버튼으로 추가하세요.
              </p>
            )}
            {displayItems.map((item) => renderItem(item))}
          </div>

          <div className={styles.expenseSection}>
            <div
              className={styles.sectionHeader}
              style={{ cursor: "pointer" }}
              onClick={() => setMedicalExpanded(!medicalExpanded)}
            >
              <div className={styles.sectionTitleGroup}>
                <span className={styles.sectionTitle}>의료비</span>
                <button
                  className={styles.infoBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMedicalInfo(!showMedicalInfo);
                  }}
                  title="의료비 안내"
                >
                  <Info size={14} />
                </button>
              </div>
              <div className={styles.sectionToggle}>
                {medicalExpanded ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </div>
            </div>

            {showMedicalInfo && (
              <div className={styles.medicalInfoBox}>
                <p className={styles.medicalInfoText}>{MEDICAL_EXPENSE_INFO}</p>
                <button
                  className={styles.medicalInfoClose}
                  onClick={() => setShowMedicalInfo(false)}
                >
                  닫기
                </button>
              </div>
            )}

            {medicalExpanded && (
              <div className={styles.sectionContent}>
                {medicalItems.length === 0 ? (
                  <div className={styles.emptyMedical}>
                    <p className={styles.emptyMedicalText}>
                      나이대별 의료비를 자동으로 생성할 수 있습니다.
                    </p>
                    <button
                      className={styles.generateMedicalBtn}
                      onClick={generateMedicalExpenses}
                    >
                      나이대별 의료비 자동 생성
                    </button>
                  </div>
                ) : (
                  <>
                    {medicalItems.map((item) => (
                      <div key={item.id} className={styles.expenseItem}>
                        <div className={styles.itemInfo}>
                          <span className={styles.itemName}>
                            {item.label}
                          </span>
                          <span className={styles.itemMeta}>
                            {`${item.startYear}년 ~ ${item.endYear}년 | 연 ${item.displayGrowthRate}% 상승${isScenarioMode ? " (시나리오)" : ""}`}
                          </span>
                        </div>
                        <div className={styles.itemRight}>
                          <span className={styles.itemAmount}>
                            {formatMoney(item.amount)}
                            <span className={styles.itemFrequency}>
                              /{item.frequency === "monthly" ? "월" : "년"}
                            </span>
                          </span>
                          <div className={styles.itemActions}>
                            <button
                              className={styles.editBtn}
                              onClick={() => startEdit(item)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className={styles.medicalActions}>
                      <button
                        className={styles.regenerateMedicalBtn}
                        onClick={generateMedicalExpenses}
                      >
                        나이대별 의료비 다시 생성
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!medicalExpanded && medicalItems.length > 0 && (
              <div className={styles.collapsedSummary}>
                {medicalItems.length}개 항목 (현재 적용:{" "}
                {currentMedicalItems.length}개), 월{" "}
                {formatMoney(
                  currentMedicalItems.reduce(
                    (sum, i) =>
                      sum +
                      (i.frequency === "yearly" ? i.amount / 12 : i.amount),
                    0,
                  ),
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
