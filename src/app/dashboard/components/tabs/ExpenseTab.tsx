"use client";

import { useState, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  TrendingDown,
  Pencil,
  ChevronDown,
  ChevronUp,
  Info,
  CreditCard,
  Link,
  Building2,
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

// 상승률 프리셋 (물가상승률 기준)
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

  // simulationResult에서 현재 연도의 부채 관련 지출 추출
  const debtExpensesFromSimulation = useMemo(() => {
    const currentSnapshot = simulationResult.snapshots.find(
      (s) => s.year === currentYear,
    );
    if (!currentSnapshot) return [];

    // expenseBreakdown에서 이자/원금상환 항목 추출
    return currentSnapshot.expenseBreakdown
      .filter(
        (item) =>
          item.title.includes("이자") || item.title.includes("원금상환"),
      )
      .map((item, index) => ({
        id: `sim-debt-${index}`,
        type: "interest" as const,
        label: item.title,
        amount: Math.round(item.amount / 12), // 연간 → 월간
        frequency: "monthly" as const,
        startYear: currentYear,
        startMonth: 1,
        endType: "custom" as const,
        endYear: currentYear + 10,
        endMonth: 12,
        growthRate: 0,
        rateCategory: "fixed" as const,
        sourceType: "debt" as const,
        sourceId: `sim-${index}`,
        displayGrowthRate: 0,
      }));
  }, [simulationResult, currentYear]);

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

  // 의료비 섹션 토글 상태
  const [medicalExpanded, setMedicalExpanded] = useState(false);
  const [showMedicalInfo, setShowMedicalInfo] = useState(false);

  // 편집 중인 항목 ID
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ExpenseItem | null>(null);
  const [isCustomRateMode, setIsCustomRateMode] = useState(false);
  const [customRateInput, setCustomRateInput] = useState("");

  // 추가 중인 타입
  const [addingType, setAddingType] = useState<ExpenseType | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newFrequency, setNewFrequency] = useState<ExpenseFrequency>("monthly");
  const [newOnetimeYear, setNewOnetimeYear] = useState(currentYear);
  const [newOnetimeMonth, setNewOnetimeMonth] = useState(currentMonth);

  // 타입별 항목 (displayItems에서 필터 - 시나리오 적용된 상승률 포함)
  type DisplayItem = ExpenseItem & { displayGrowthRate: number };
  const fixedItems = displayItems.filter((i) => i.type === "fixed");
  const variableItems = displayItems.filter((i) => i.type === "variable");
  const onetimeItems = displayItems.filter((i) => i.type === "onetime");
  const medicalItems = displayItems.filter((i) => i.type === "medical");
  // interestItems는 simulationResult에서 가져옴 (Single Source of Truth)
  const interestItems = debtExpensesFromSimulation;
  const housingItems = displayItems.filter((i) => i.type === "housing");

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

  // 월 지출 (현재 연도에 해당하는 항목만 + simulationResult의 부채 지출)
  const monthlyExpense = useMemo(() => {
    // 일반 지출
    const regularExpense = displayItems
      .filter((item) => isCurrentYearItem(item) && item.type !== "onetime")
      .reduce((sum, item) => sum + toMonthlyAmount(item), 0);

    // 부채 지출 (simulationResult에서 - 이미 월간으로 변환됨)
    const debtExpense = debtExpensesFromSimulation.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    return regularExpense + debtExpense;
  }, [
    displayItems,
    debtExpensesFromSimulation,
    currentYear,
    selfRetirementYear,
    spouseRetirementYear,
  ]);

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
      // interest는 simulationResult에서 가져온 데이터 사용 (이미 월간으로 변환됨)
      interest: debtExpensesFromSimulation.reduce((s, i) => s + i.amount, 0),
      housing: housingItems
        .filter(isCurrentYearItem)
        .reduce((s, i) => s + toMonthlyAmount(i), 0),
    }),
    [
      fixedItems,
      variableItems,
      onetimeItems,
      currentMedicalItems,
      debtExpensesFromSimulation,
      housingItems,
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
    const interestData: number[] = [];
    const housingData: number[] = [];

    simulationResult.snapshots.forEach((snapshot) => {
      let fixedTotal = 0;
      let variableTotal = 0;
      let onetimeTotal = 0;
      let medicalTotal = 0;
      let interestTotal = 0;
      let housingTotal = 0;

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
            // 대출/이자
            case "loan":
            case "interest":
              interestTotal += item.amount;
              break;
            // 주거비
            case "housing":
            case "rent":
              housingTotal += item.amount;
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
                  case "loan":
                    interestTotal += item.amount;
                    break;
                  case "housing":
                    housingTotal += item.amount;
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
      interestData.push(interestTotal);
      housingData.push(housingTotal);
    });

    return {
      labels,
      fixedData,
      variableData,
      onetimeData,
      medicalData,
      interestData,
      housingData,
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
    if (projectionData.interestData.some((v) => v > 0)) {
      datasets.push({
        label: "이자",
        data: projectionData.interestData,
        backgroundColor: CHART_COLORS.expense.interest,
      });
    }
    if (projectionData.housingData.some((v) => v > 0)) {
      datasets.push({
        label: "주거",
        data: projectionData.housingData,
        backgroundColor: CHART_COLORS.expense.housing,
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
        grid: { color: "#f0f0f0" },
        ticks: {
          font: { size: 11 },
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
    // 지출은 기본적으로 본인 은퇴까지
    const retirementLink = isOnetime ? null : "self";

    try {
      await createExpense({
        simulation_id: simulationId,
        type: uiTypeToDBType(addingType),
        title: newLabel || getDefaultLabel(addingType),
        amount: parseFloat(newAmount),
        frequency: isOnetime ? "monthly" : newFrequency,
        start_year: isOnetime ? newOnetimeYear : currentYear,
        start_month: isOnetime ? newOnetimeMonth : currentMonth,
        // retirement_link가 있으면 end_year는 null - 시뮬레이션 시점에 동적 계산
        end_year: isOnetime ? newOnetimeYear : null,
        end_month: isOnetime ? newOnetimeMonth : null,
        is_fixed_to_retirement: !isOnetime,
        retirement_link: retirementLink,
        growth_rate: isOnetime ? 0 : DEFAULT_GLOBAL_SETTINGS.inflationRate,
        rate_category: getDefaultRateCategory(addingType),
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
    setAddingType(null);
    setNewLabel("");
    setNewAmount("");
    setNewFrequency("monthly");
    setNewOnetimeYear(currentYear);
    setNewOnetimeMonth(currentMonth);
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
    const isCustom = !isPresetRate(item.growthRate);
    setIsCustomRateMode(isCustom);
    setCustomRateInput(isCustom ? String(item.growthRate) : "");
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setIsCustomRateMode(false);
    setCustomRateInput("");
  };

  // 편집 저장 (DB)
  const saveEdit = async () => {
    if (!editForm) return;
    const finalForm = isCustomRateMode
      ? {
          ...editForm,
          growthRate: customRateInput === "" ? 0 : parseFloat(customRateInput),
        }
      : editForm;

    const isFixedToRetirement =
      finalForm.endType === "self-retirement" ||
      finalForm.endType === "spouse-retirement";

    // retirement_link 결정: endType에 따라 'self', 'spouse', null
    const retirementLink =
      finalForm.endType === "self-retirement"
        ? "self"
        : finalForm.endType === "spouse-retirement"
          ? "spouse"
          : null;

    // retirement_link가 있으면 end_year는 null - 시뮬레이션 시점에 동적 계산
    const endYearToSave = retirementLink ? null : finalForm.endYear;
    const endMonthToSave = retirementLink ? null : finalForm.endMonth;

    try {
      await updateExpense(finalForm.id, {
        type: uiTypeToDBType(finalForm.type),
        title: finalForm.label,
        amount: finalForm.amount,
        frequency: finalForm.frequency,
        start_year: finalForm.startYear,
        start_month: finalForm.startMonth,
        end_year: endYearToSave,
        end_month: endMonthToSave,
        is_fixed_to_retirement: isFixedToRetirement,
        retirement_link: retirementLink,
        growth_rate: finalForm.growthRate,
        rate_category: finalForm.rateCategory,
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

  // 섹션 렌더링 (items는 displayItems에서 필터된 것)
  const renderSection = (
    title: string,
    type: ExpenseType,
    items: DisplayItem[],
    description?: string,
  ) => (
    <div className={styles.expenseSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
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

          // 연동 항목 여부 확인
          const isLinked = !!item.sourceType;

          // 연동 배지 정보
          const getLinkedBadge = () => {
            if (!item.sourceType) return null;
            switch (item.sourceType) {
              case "debt":
                return { label: "부채", icon: <CreditCard size={12} /> };
              case "real_estate":
                return { label: "부동산", icon: <Building2 size={12} /> };
              default:
                return { label: "연동", icon: <Link size={12} /> };
            }
          };

          const linkedBadge = getLinkedBadge();

          // 읽기 모드 - displayGrowthRate 사용 (이미 시나리오 적용됨)
          return (
            <div key={item.id} className={styles.expenseItem}>
              <div className={styles.itemMain}>
                <span className={styles.itemLabel}>{item.label}</span>
                <span className={styles.itemAmount}>
                  {formatAmountWithFreq(item)}
                </span>
                <span className={styles.itemMeta}>
                  {item.type === "onetime"
                    ? formatPeriod(item)
                    : `${formatPeriod(item)} | 연 ${item.displayGrowthRate}% 상승${isScenarioMode ? " (시나리오)" : ""}`}
                </span>
              </div>
              {isLinked && linkedBadge ? (
                <div className={styles.linkedBadge}>
                  {linkedBadge.icon}
                  <span>{linkedBadge.label} 연동</span>
                </div>
              ) : (
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
              )}
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
        ) : type === "interest" ? (
          <a href="#debt" className={styles.realEstateLink}>
            부채 탭에서 대출 이자 관리하기
          </a>
        ) : type === "housing" ? (
          <a href="#realEstate" className={styles.realEstateLink}>
            부동산 탭에서 주거비 관리하기
          </a>
        ) : (
          <button className={styles.addBtn} onClick={() => setAddingType(type)}>
            <Plus size={16} />
            추가
          </button>
        )}
      </div>
    </div>
  );

  // 캐시된 데이터가 없고 로딩 중일 때만 로딩 표시
  if (isLoading && dbExpenses.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 왼쪽: 지출 입력 */}
      <div className={styles.inputPanel}>
        {renderSection(
          "고정비",
          "fixed",
          fixedItems,
          "보험료, 통신비, 구독료 등 매월 고정적으로 나가는 지출",
        )}
        {renderSection(
          "변동비",
          "variable",
          variableItems,
          "식비, 교통비, 여가비 등 매월 변동되는 지출",
        )}
        {renderSection(
          "일회성 지출",
          "onetime",
          onetimeItems,
          "여행, 결혼, 차량구입, 이사 등 특정 시점의 큰 지출",
        )}
        {/* 의료비 섹션 (토글 가능) */}
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
                  {medicalItems.map((item) => {
                    if (editingId === item.id && editForm) {
                      // 편집 모드 - renderSection과 동일한 로직 사용
                      return (
                        <div key={item.id} className={styles.expenseItem}>
                          <div className={styles.editMode}>
                            <div className={styles.editRow}>
                              <span className={styles.editRowLabel}>
                                항목명
                              </span>
                              <input
                                type="text"
                                className={styles.editLabelInput}
                                value={editForm.label}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    label: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className={styles.editRow}>
                              <span className={styles.editRowLabel}>금액</span>
                              <div className={styles.editField}>
                                <input
                                  type="number"
                                  className={styles.editAmountInput}
                                  value={editForm.amount}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      amount: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  onWheel={(e) =>
                                    (e.target as HTMLElement).blur()
                                  }
                                />
                                <span className={styles.editUnit}>만원</span>
                                <select
                                  className={styles.editSelect}
                                  value={editForm.frequency}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      frequency: e.target
                                        .value as ExpenseFrequency,
                                    })
                                  }
                                >
                                  <option value="monthly">월</option>
                                  <option value="yearly">년</option>
                                </select>
                              </div>
                            </div>
                            <div className={styles.editActions}>
                              <button
                                className={styles.saveBtn}
                                onClick={saveEdit}
                              >
                                저장
                              </button>
                              <button
                                className={styles.cancelBtn}
                                onClick={() => setEditingId(null)}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 읽기 모드
                    return (
                      <div key={item.id} className={styles.expenseItem}>
                        <div className={styles.itemMain}>
                          <span className={styles.itemLabel}>{item.label}</span>
                          <span className={styles.itemAmount}>
                            {formatMoney(item.amount)}
                            <span className={styles.itemFrequency}>
                              /{item.frequency === "monthly" ? "월" : "년"}
                            </span>
                          </span>
                          <span className={styles.itemMeta}>
                            {`${item.startYear}년 ~ ${item.endYear}년 | 연 ${item.displayGrowthRate}% 상승${isScenarioMode ? " (시나리오)" : ""}`}
                          </span>
                        </div>
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
                    );
                  })}

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
                    sum + (i.frequency === "yearly" ? i.amount / 12 : i.amount),
                  0,
                ),
              )}
            </div>
          )}
        </div>
        {renderSection(
          "주거비",
          "housing",
          housingItems,
          "부동산 탭에서 등록한 월세, 관리비가 표시됩니다",
        )}
        {/* 이자 비용 섹션 - simulationResult에서 가져옴 (Single Source of Truth) */}
        <div className={styles.expenseSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>이자/원금 상환</span>
          </div>
          <p className={styles.sectionDesc}>
            부채 탭에서 등록한 대출 상환금이 표시됩니다
          </p>

          <div className={styles.itemList}>
            {interestItems.map((item) => (
              <div key={item.id} className={styles.expenseItem}>
                <div className={styles.itemMain}>
                  <span className={styles.itemLabel}>{item.label}</span>
                  <span className={styles.itemAmount}>
                    {formatMoney(item.amount)}/월
                  </span>
                  <span className={styles.itemMeta}>
                    연간 {formatMoney(item.amount * 12)}
                  </span>
                </div>
                <div className={styles.linkedBadge}>
                  <CreditCard size={12} />
                  <span>부채 연동</span>
                </div>
              </div>
            ))}

            {interestItems.length === 0 && (
              <p className={styles.emptyText}>
                부채 탭에서 대출을 등록하면 월 상환금이 표시됩니다
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 오른쪽: 인사이트 */}
      <div className={styles.insightPanel}>
        {/* TODO: 인사이트 내용 추가 예정 */}
      </div>
    </div>
  );
}
