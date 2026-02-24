"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
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
  SimFamilyMember,
  LifeCycleSettings,
  RateCategory,
} from "@/types";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { Expense } from "@/types/tables";
import type { SimulationResult } from "@/lib/services/simulationTypes";
import { FinancialItemIcon } from "@/components/FinancialItemIcon";
import { FinancialIconPicker } from "@/components/FinancialIconPicker";
import {
  formatMoney,
  getDefaultRateCategory,
  calculateAge,
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
  deleteExpensesByType,
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
  birthMonth: number;
  spouseBirthYear?: number | null;
  spouseBirthMonth?: number | null;
  retirementAge: number;
  spouseRetirementAge?: number;
  isMarried: boolean;
  lifeExpectancy?: number;
  spouseLifeExpectancy?: number;
  simulationResult: SimulationResult;
  familyMembers: SimFamilyMember[];
  autoExpenses?: LifeCycleSettings['autoExpenses'];
  onAutoExpensesChange?: (autoExpenses: LifeCycleSettings['autoExpenses']) => void;
}

// 로컬 타입 별칭
type ExpenseItem = DashboardExpenseItem;
type ExpenseType = DashboardExpenseItem["type"];
type ExpenseFrequency = DashboardExpenseFrequency;

export function ExpenseTab({
  simulationId,
  birthYear,
  birthMonth,
  spouseBirthYear,
  spouseBirthMonth,
  retirementAge,
  spouseRetirementAge = 60,
  isMarried,
  lifeExpectancy = 100,
  spouseLifeExpectancy,
  simulationResult,
  familyMembers,
  autoExpenses,
  onAutoExpensesChange,
}: ExpenseTabProps) {
  const { chartScaleColors, isDark } = useChartTheme();
  const currentYear = new Date().getFullYear();

  // 현재 나이 계산
  const currentAge = currentYear - birthYear;
  const selfRetirementYear = currentYear + (retirementAge - currentAge);

  // 은퇴 월 정밀 계산 (생일 기준)
  // 마지막 근무 월: 은퇴 나이가 되는 달의 전 달
  const selfRetEndMonth = birthMonth === 1 ? 12 : birthMonth - 1;
  const selfRetEndYear = birthMonth === 1 ? selfRetirementYear - 1 : selfRetirementYear;
  // 은퇴 시작 월: 은퇴 나이가 되는 달 (생일 달)
  const selfRetStartYear = selfRetirementYear;
  const selfRetStartMonth = birthMonth;

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

  // 배우자 은퇴 월 정밀 계산
  const effectiveSpouseBirthMonth = spouseBirthMonth || 1;
  const spouseRetEndMonth = effectiveSpouseBirthMonth === 1 ? 12 : effectiveSpouseBirthMonth - 1;
  const spouseRetEndYear = effectiveSpouseBirthMonth === 1 ? spouseRetirementYear - 1 : spouseRetirementYear;
  const spouseRetStartYear = spouseRetirementYear;
  const spouseRetStartMonth = effectiveSpouseBirthMonth;

  const hasSpouse = isMarried && spouseBirthYear;
  const currentMonth = new Date().getMonth() + 1;

  // 기대수명 연도 계산
  const selfLifeExpectancyYear = birthYear + (lifeExpectancy || 100);
  const spouseLifeExpectancyYear = spouseBirthYear
    ? spouseBirthYear + (spouseLifeExpectancy || lifeExpectancy || 100)
    : selfLifeExpectancyYear;

  // 자녀 데이터 추출
  const children = useMemo(() =>
    familyMembers.filter(fm => fm.relationship === 'child' && fm.birth_date),
    [familyMembers]
  );

  // 특정 연도의 나이 계산
  const getAgeAtYear = (year: number, isSelf: boolean): number | null => {
    if (isSelf) {
      return currentAge + (year - currentYear);
    }
    if (spouseCurrentAge === null) return null;
    return spouseCurrentAge + (year - currentYear);
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
        owner: expense.owner || 'common',
        startYear: expense.start_year,
        startMonth: expense.start_month,
        endType,
        endYear: expense.end_year,
        endMonth: expense.end_month,
        growthRate: expense.growth_rate,
        rateCategory: expense.rate_category,
        sourceType: expense.source_type || undefined,
        sourceId: expense.source_id || undefined,
        icon: expense.icon,
        color: expense.color,
        dbType: expense.type,
      };
    });
  }, [dbExpenses]);

  // 사용자 지출 표시용 데이터 (부채 지출은 simulationResult에서 가져옴)
  const displayItems = useMemo(() => {
    return expenseItems.map((item) => ({
      ...item,
      displayGrowthRate: item.growthRate, // fixed 모드에서만 표시
    }));
  }, [expenseItems]);

  // 확장/축소 상태
  const [isExpanded, setIsExpanded] = useState(true);


  // 편집 중인 항목 ID
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ExpenseItem | null>(null);
  const [editStartType, setEditStartType] = useState<'current' | 'self-retirement' | 'spouse-retirement' | 'year'>('current');
  const [editStartDateText, setEditStartDateText] = useState("");
  const [editEndType, setEditEndType] = useState<'self-retirement' | 'spouse-retirement' | 'self-life-expectancy' | 'spouse-life-expectancy' | 'year'>('self-retirement');
  const [editEndDateText, setEditEndDateText] = useState("");

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
  const [newEndType, setNewEndType] = useState<'self-retirement' | 'spouse-retirement' | 'self-life-expectancy' | 'spouse-life-expectancy' | 'year'>('self-retirement');
  const [newEndYear, setNewEndYear] = useState(selfRetEndYear);
  const [newEndMonth, setNewEndMonth] = useState(selfRetEndMonth);
  const [newEndDateText, setNewEndDateText] = useState(toPeriodRaw(selfRetEndYear, selfRetEndMonth));
  const [newOwner, setNewOwner] = useState<'self' | 'spouse' | 'common'>('common');
  const [newRateCategory, setNewRateCategory] = useState<RateCategory>('inflation');
  const [newCustomRate, setNewCustomRate] = useState("");

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // 교육비 tier 선택 중 상태
  const [educationTierSelection, setEducationTierSelection] = useState(false);

  type DisplayItem = ExpenseItem & { displayGrowthRate: number };

  const totalCount = displayItems.length;

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

  // 자동 지출 활성화 핸들러
  const handleEnableMedical = async () => {
    // 기존 DB 레코드 정리
    try {
      await deleteExpensesByType(simulationId, "medical");
      invalidate("expenses");
    } catch { /* ignore */ }
    onAutoExpensesChange?.({ ...autoExpenses, medical: true });
    resetAddForm();
  };

  const handleEnableEducation = async (tier: 'normal' | 'premium') => {
    // 기존 DB 레코드 정리
    try {
      await deleteExpensesByType(simulationId, "education");
      invalidate("expenses");
    } catch { /* ignore */ }
    onAutoExpensesChange?.({ ...autoExpenses, education: { enabled: true, tier } });
    resetAddForm();
  };

  const handleDisableMedical = () => {
    const { medical: _, ...rest } = autoExpenses || {};
    onAutoExpensesChange?.(Object.keys(rest).length > 0 ? rest : undefined);
  };

  const handleDisableEducation = () => {
    const { education: _, ...rest } = autoExpenses || {};
    onAutoExpensesChange?.(Object.keys(rest).length > 0 ? rest : undefined);
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

    // 기대수명 종료 연도 계산
    const resolvedEndYear = newEndType === 'self-life-expectancy'
      ? selfLifeExpectancyYear
      : newEndType === 'spouse-life-expectancy'
        ? spouseLifeExpectancyYear
        : newEndYear;
    const resolvedEndMonth = (newEndType === 'self-life-expectancy' || newEndType === 'spouse-life-expectancy')
      ? 12
      : newEndMonth;

    // growth_rate 결정
    const growthRate = isOnetime ? 0
      : newRateCategory === 'fixed'
        ? (newCustomRate === '' ? 0 : parseFloat(newCustomRate))
        : 2.5;

    try {
      await createExpense({
        simulation_id: simulationId,
        type: uiTypeToDBType(addingType),
        title: newLabel || getDefaultLabel(addingType),
        amount: parseFloat(newAmount),
        owner: newOwner,
        frequency: isOnetime ? "monthly" : newFrequency,
        start_year: isOnetime ? newOnetimeYear : newStartYear,
        start_month: isOnetime ? newOnetimeMonth : newStartMonth,
        // retirement_link가 있으면 end_year는 null - 시뮬레이션 시점에 동적 계산
        end_year: isOnetime ? newOnetimeYear : (retirementLink ? null : resolvedEndYear),
        end_month: isOnetime ? newOnetimeMonth : (retirementLink ? null : resolvedEndMonth),
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
    setNewOwner("common");
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
    setNewEndYear(selfRetEndYear);
    setNewEndMonth(selfRetEndMonth);
    setNewEndDateText(toPeriodRaw(selfRetEndYear, selfRetEndMonth));
    setNewRateCategory('inflation');
    setNewCustomRate("");
    setEducationTierSelection(false);
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
    } else if (item.startYear === selfRetStartYear && item.startMonth === selfRetStartMonth) {
      setEditStartType('self-retirement');
    } else if (hasSpouse && item.startYear === spouseRetStartYear && item.startMonth === spouseRetStartMonth) {
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
    } else if (item.endType === 'self-life-expectancy') {
      setEditEndType('self-life-expectancy');
    } else if (item.endType === 'spouse-life-expectancy') {
      setEditEndType('spouse-life-expectancy');
    } else {
      setEditEndType('year');
    }
    setEditEndDateText(toPeriodRaw(item.endYear || currentYear, item.endMonth || 12));
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setEditStartType('current');
    setEditEndType('self-retirement');
  };

  // 편집 저장 (DB)
  const saveEdit = async () => {
    if (!editForm) return;

    const finalGrowthRate = editForm.growthRate;

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

    // 기대수명 종료 연도 계산 (actual year saved, no retirement_link)
    const resolvedEditEndYear = editForm.endType === 'self-life-expectancy'
      ? selfLifeExpectancyYear
      : editForm.endType === 'spouse-life-expectancy'
        ? spouseLifeExpectancyYear
        : editForm.endYear;
    const resolvedEditEndMonth = (editForm.endType === 'self-life-expectancy' || editForm.endType === 'spouse-life-expectancy')
      ? 12
      : editForm.endMonth;

    // retirement_link가 있으면 end_year는 null - 시뮬레이션 시점에 동적 계산
    const endYearToSave = retirementLink ? null : resolvedEditEndYear;
    const endMonthToSave = retirementLink ? null : resolvedEditEndMonth;

    try {
      await updateExpense(editForm.id, {
        type: uiTypeToDBType(editForm.type),
        title: editForm.label,
        amount: editForm.amount,
        owner: editForm.owner,
        frequency: editForm.frequency,
        start_year: editForm.startYear,
        start_month: editForm.startMonth,
        end_year: endYearToSave,
        end_month: endMonthToSave,
        is_fixed_to_retirement: isFixedToRetirement,
        retirement_link: retirementLink,
        growth_rate: finalGrowthRate,
        rate_category: editForm.rateCategory as any,
        icon: editForm.icon || null,
        color: editForm.color || null,
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

    if (item.endType === "self-retirement") return `${startStr} ~ ${selfRetEndYear}.${String(selfRetEndMonth).padStart(2, "0")} (본인 은퇴)`;
    if (item.endType === "spouse-retirement") return `${startStr} ~ ${spouseRetEndYear}.${String(spouseRetEndMonth).padStart(2, "0")} (배우자 은퇴)`;
    if (item.endType === "self-life-expectancy") return `${startStr} ~ ${selfLifeExpectancyYear}.12 (본인 기대수명)`;
    if (item.endType === "spouse-life-expectancy") return `${startStr} ~ ${spouseLifeExpectancyYear}.12 (배우자 기대수명)`;

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
    setNewEndYear(selfRetEndYear);
    setNewEndMonth(selfRetEndMonth);
    setNewRateCategory(getDefaultRateCategory(type));
    setNewCustomRate("");
    // DON'T close showTypeMenu - stay in modal for step 2
  };

  const getOwnerLabel = (owner: 'self' | 'spouse' | 'common') => {
    switch (owner) {
      case 'self': return '본인';
      case 'spouse': return '배우자';
      case 'common': return '가계';
    }
  };

  // 아이템 렌더링 함수 (개별 항목) - 클릭 시 편집 모달
  const renderItem = (item: DisplayItem) => {
    return (
      <div key={item.id} className={styles.expenseItem} onClick={() => startEdit(item)}>
        <FinancialItemIcon
          category="expense"
          type={(item as any).dbType || item.type}
          icon={(item as any).icon}
          color={(item as any).color}
          onSave={async (icon, color) => {
            await updateExpense(item.id, { icon, color })
            invalidate('expenses')
          }}
        />
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>
            {item.label} | {getOwnerLabel(item.owner)}
          </span>
          {item.type === "onetime" ? (
            <span className={styles.itemMeta}>{formatPeriod(item)}</span>
          ) : (
            <>
              <span className={styles.itemMeta}>{formatPeriod(item)}</span>
              <span className={styles.itemMeta}>
                {item.rateCategory === 'fixed'
                  ? `연 ${item.displayGrowthRate}% 상승`
                  : `시뮬레이션 가정 (${item.rateCategory === 'income' ? '소득 상승률' : item.rateCategory === 'inflation' ? '물가 상승률' : item.rateCategory === 'realEstate' ? '부동산 상승률' : '투자 수익률'})`}
              </span>
            </>
          )}
        </div>
        <div className={styles.itemRight}>
          <span className={styles.itemAmount}>
            {formatAmountWithFreq(item)}
          </span>
        </div>
      </div>
    );
  };

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
                </div>

                {/* Auto-generation presets section */}
                <div className={styles.presetSection}>
                  <span className={styles.presetLabel}>자동 반영</span>
                  <div className={styles.presetList}>
                    {!autoExpenses?.medical && (
                      <button className={styles.presetCard} onClick={handleEnableMedical}>
                        <div className={styles.presetInfo}>
                          <span className={styles.presetName}>의료비</span>
                          <span className={styles.presetDesc}>
                            {isMarried && spouseBirthYear ? '본인 + 배우자 나이대별' : '본인 나이대별'}
                          </span>
                        </div>
                        <Plus size={16} className={styles.presetIcon} />
                      </button>
                    )}
                    {autoExpenses?.medical && (
                      <div className={styles.presetCard} style={{ opacity: 0.6 }}>
                        <div className={styles.presetInfo}>
                          <span className={styles.presetName}>의료비</span>
                          <span className={styles.presetDesc}>
                            {isMarried && spouseBirthYear ? '본인 + 배우자' : '본인'} 반영 중
                          </span>
                        </div>
                      </div>
                    )}
                    {children.length > 0 && !autoExpenses?.education?.enabled && !educationTierSelection && (
                      <button className={styles.presetCard} onClick={() => setEducationTierSelection(true)}>
                        <div className={styles.presetInfo}>
                          <span className={styles.presetName}>양육비</span>
                          <span className={styles.presetDesc}>
                            {children.map(c => c.name || '자녀').join(', ')} 기반
                          </span>
                        </div>
                        <Plus size={16} className={styles.presetIcon} />
                      </button>
                    )}
                    {children.length > 0 && autoExpenses?.education?.enabled && (
                      <div className={styles.presetCard} style={{ opacity: 0.6 }}>
                        <div className={styles.presetInfo}>
                          <span className={styles.presetName}>양육비</span>
                          <span className={styles.presetDesc}>자동 반영 중 ({autoExpenses.education.tier === 'premium' ? '여유' : '보통'})</span>
                        </div>
                      </div>
                    )}
                    {educationTierSelection && (
                      <div className={styles.tierSelection}>
                        <button className={styles.tierBtn} onClick={() => { handleEnableEducation('normal'); setEducationTierSelection(false); }}>
                          <span className={styles.tierName}>보통</span>
                          <span className={styles.tierDesc}>연 150~3,000만원</span>
                        </button>
                        <button className={styles.tierBtn} onClick={() => { handleEnableEducation('premium'); setEducationTierSelection(false); }}>
                          <span className={styles.tierName}>여유</span>
                          <span className={styles.tierDesc}>연 1,000~7,000만원</span>
                        </button>
                      </div>
                    )}
                  </div>
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

                  {/* 소유자 */}
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>소유자</span>
                    <div className={styles.ownerButtons}>
                      <button
                        type="button"
                        className={`${styles.ownerBtn} ${newOwner === 'self' ? styles.active : ''}`}
                        onClick={() => setNewOwner('self')}
                      >
                        본인
                      </button>
                      {isMarried && (
                        <button
                          type="button"
                          className={`${styles.ownerBtn} ${newOwner === 'spouse' ? styles.active : ''}`}
                          onClick={() => setNewOwner('spouse')}
                        >
                          배우자
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${styles.ownerBtn} ${newOwner === 'common' ? styles.active : ''}`}
                        onClick={() => setNewOwner('common')}
                      >
                        가계
                      </button>
                    </div>
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
                                setNewStartYear(selfRetStartYear);
                                setNewStartMonth(selfRetStartMonth);
                                setNewStartDateText(toPeriodRaw(selfRetStartYear, selfRetStartMonth));
                              } else if (val === 'spouse-retirement') {
                                setNewStartYear(spouseRetStartYear);
                                setNewStartMonth(spouseRetStartMonth);
                                setNewStartDateText(toPeriodRaw(spouseRetStartYear, spouseRetStartMonth));
                              }
                            }}
                          >
                            <option value="current">현재</option>
                            <option value="self-retirement">{`본인 은퇴 후 (${selfRetStartYear}.${String(selfRetStartMonth).padStart(2, "0")})`}</option>
                            {hasSpouse && <option value="spouse-retirement">{`배우자 은퇴 후 (${spouseRetStartYear}.${String(spouseRetStartMonth).padStart(2, "0")})`}</option>}
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
                                setNewEndYear(selfRetEndYear);
                                setNewEndMonth(selfRetEndMonth);
                                setNewEndDateText(toPeriodRaw(selfRetEndYear, selfRetEndMonth));
                              } else if (val === 'spouse-retirement') {
                                setNewEndYear(spouseRetEndYear);
                                setNewEndMonth(spouseRetEndMonth);
                                setNewEndDateText(toPeriodRaw(spouseRetEndYear, spouseRetEndMonth));
                              } else if (val === 'self-life-expectancy') {
                                setNewEndYear(selfLifeExpectancyYear);
                                setNewEndMonth(12);
                                setNewEndDateText(toPeriodRaw(selfLifeExpectancyYear, 12));
                              } else if (val === 'spouse-life-expectancy') {
                                setNewEndYear(spouseLifeExpectancyYear);
                                setNewEndMonth(12);
                                setNewEndDateText(toPeriodRaw(spouseLifeExpectancyYear, 12));
                              }
                            }}
                          >
                            <option value="self-retirement">{`본인 은퇴 (${selfRetEndYear}.${String(selfRetEndMonth).padStart(2, "0")})`}</option>
                            {hasSpouse && <option value="spouse-retirement">{`배우자 은퇴 (${spouseRetEndYear}.${String(spouseRetEndMonth).padStart(2, "0")})`}</option>}
                            <option value="self-life-expectancy">{`본인 기대수명 (${selfLifeExpectancyYear}.12)`}</option>
                            {hasSpouse && <option value="spouse-life-expectancy">{`배우자 기대수명 (${spouseLifeExpectancyYear}.12)`}</option>}
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
                    return (
                      <div className={styles.modalFormRow}>
                        <span className={styles.modalFormLabel}>상승률</span>
                        <div className={styles.fieldContent}>
                          {newRateCategory !== 'fixed' && (
                            <span className={styles.rateValue}>시뮬레이션 가정</span>
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
              <div className={styles.modalHeaderActions}>
                <button
                  className={styles.modalDeleteBtn}
                  onClick={() => {
                    if (window.confirm('이 항목을 삭제하시겠습니까?')) {
                      handleDelete(editForm.id);
                    }
                  }}
                  type="button"
                >
                  <Trash2 size={18} />
                </button>
                <button className={styles.typeModalClose} onClick={cancelEdit}><X size={18} /></button>
              </div>
            </div>
            <div className={styles.modalFormBody}>
              {/* 아이콘 */}
              <FinancialIconPicker
                category="expense"
                type={(editForm as any)?.dbType || editForm?.type || 'living'}
                icon={editForm?.icon || null}
                color={editForm?.color || null}
                onIconChange={(icon) => setEditForm(prev => prev ? { ...prev, icon } : prev)}
                onColorChange={(color) => setEditForm(prev => prev ? { ...prev, color } : prev)}
              />
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

              {/* 소유자 */}
              <div className={styles.modalFormRow}>
                <span className={styles.modalFormLabel}>소유자</span>
                <div className={styles.ownerButtons}>
                  <button
                    type="button"
                    className={`${styles.ownerBtn} ${editForm.owner === 'self' ? styles.active : ''}`}
                    onClick={() => setEditForm({ ...editForm, owner: 'self' })}
                  >
                    본인
                  </button>
                  {isMarried && (
                    <button
                      type="button"
                      className={`${styles.ownerBtn} ${editForm.owner === 'spouse' ? styles.active : ''}`}
                      onClick={() => setEditForm({ ...editForm, owner: 'spouse' })}
                    >
                      배우자
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.ownerBtn} ${editForm.owner === 'common' ? styles.active : ''}`}
                    onClick={() => setEditForm({ ...editForm, owner: 'common' })}
                  >
                    가계
                  </button>
                </div>
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
                            setEditForm({ ...editForm, startYear: selfRetStartYear, startMonth: selfRetStartMonth });
                            setEditStartDateText(toPeriodRaw(selfRetStartYear, selfRetStartMonth));
                          } else if (val === 'spouse-retirement') {
                            setEditForm({ ...editForm, startYear: spouseRetStartYear, startMonth: spouseRetStartMonth });
                            setEditStartDateText(toPeriodRaw(spouseRetStartYear, spouseRetStartMonth));
                          }
                        }}
                      >
                        <option value="current">현재</option>
                        <option value="self-retirement">{`본인 은퇴 후 (${selfRetStartYear}.${String(selfRetStartMonth).padStart(2, "0")})`}</option>
                        {hasSpouse && <option value="spouse-retirement">{`배우자 은퇴 후 (${spouseRetStartYear}.${String(spouseRetStartMonth).padStart(2, "0")})`}</option>}
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
                            setEditForm({ ...editForm, endYear: selfRetEndYear, endMonth: selfRetEndMonth });
                            setEditEndDateText(toPeriodRaw(selfRetEndYear, selfRetEndMonth));
                          } else if (val === 'spouse-retirement') {
                            setEditForm({ ...editForm, endYear: spouseRetEndYear, endMonth: spouseRetEndMonth });
                            setEditEndDateText(toPeriodRaw(spouseRetEndYear, spouseRetEndMonth));
                          } else if (val === 'self-life-expectancy') {
                            setEditForm({ ...editForm, endType: 'self-life-expectancy', endYear: selfLifeExpectancyYear, endMonth: 12 });
                            setEditEndDateText(toPeriodRaw(selfLifeExpectancyYear, 12));
                          } else if (val === 'spouse-life-expectancy') {
                            setEditForm({ ...editForm, endType: 'spouse-life-expectancy', endYear: spouseLifeExpectancyYear, endMonth: 12 });
                            setEditEndDateText(toPeriodRaw(spouseLifeExpectancyYear, 12));
                          }
                        }}
                      >
                        <option value="self-retirement">{`본인 은퇴 (${selfRetEndYear}.${String(selfRetEndMonth).padStart(2, "0")})`}</option>
                        {hasSpouse && <option value="spouse-retirement">{`배우자 은퇴 (${spouseRetEndYear}.${String(spouseRetEndMonth).padStart(2, "0")})`}</option>}
                        <option value="self-life-expectancy">{`본인 기대수명 (${selfLifeExpectancyYear}.12)`}</option>
                        {hasSpouse && <option value="spouse-life-expectancy">{`배우자 기대수명 (${spouseLifeExpectancyYear}.12)`}</option>}
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
                return (
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>상승률</span>
                    <div className={styles.fieldContent}>
                      {editForm.rateCategory !== 'fixed' && (
                        <span className={styles.rateValue}>시뮬레이션 가정</span>
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
        <div className={styles.groupedList}>
          {/* 자동 반영 상태 표시 */}
          {(autoExpenses?.medical || autoExpenses?.education?.enabled) && (
            <div className={styles.autoStatusSection}>
              {autoExpenses?.medical && (
                <div className={styles.autoStatusItem}>
                  <div className={styles.autoStatusInfo}>
                    <span className={styles.autoStatusLabel}>의료비</span>
                    <span className={styles.autoStatusDesc}>
                      {isMarried && spouseBirthYear ? '본인 + 배우자' : '본인'} 나이대별 자동 반영
                    </span>
                  </div>
                  <button className={styles.autoStatusToggle} onClick={handleDisableMedical}>해제</button>
                </div>
              )}
              {autoExpenses?.education?.enabled && (
                <div className={styles.autoStatusItem}>
                  <div className={styles.autoStatusInfo}>
                    <span className={styles.autoStatusLabel}>
                      양육비 ({autoExpenses.education.tier === 'premium' ? '여유' : '보통'})
                    </span>
                    <span className={styles.autoStatusDesc}>
                      {children.length > 0
                        ? children.map(c => c.name || '자녀').join(', ')
                        : '자녀'} 기반 자동 반영
                    </span>
                  </div>
                  <button className={styles.autoStatusToggle} onClick={handleDisableEducation}>해제</button>
                </div>
              )}
            </div>
          )}

          {displayItems.length === 0 && !autoExpenses?.medical && !autoExpenses?.education?.enabled && (
            <p className={styles.emptyHint}>
              아직 등록된 지출이 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}

          {displayItems.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionItems}>
                {displayItems.map((item) => renderItem(item))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
