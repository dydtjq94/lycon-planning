"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, TrendingUp, Pencil, X, Check, ExternalLink, Home, Landmark, Link } from "lucide-react";
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
  DashboardIncomeItem,
  DashboardIncomeFrequency,
  GlobalSettings,
} from "@/types";
import type { SimulationResult } from "@/lib/services/simulationEngine";
import type { Income, IncomeInput, IncomeType as DBIncomeType } from "@/types/tables";
import { DEFAULT_GLOBAL_SETTINGS } from "@/types";
import { formatMoney, getDefaultRateCategory, getEffectiveRate } from "@/lib/utils";
import { CHART_COLORS, categorizeIncome } from "@/lib/utils/tooltipCategories";
import { useIncomes, useInvalidateByCategory } from "@/hooks/useFinancialData";
import {
  createIncome,
  updateIncome,
  deleteIncome,
  INCOME_TYPE_LABELS,
  INCOME_TYPE_DEFAULTS,
  getSourceLabel,
} from "@/lib/services/incomeService";
import { useChartTheme } from "@/hooks/useChartTheme";
import { TabSkeleton } from "./shared/TabSkeleton";
import styles from "./IncomeTab.module.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface IncomeTabProps {
  simulationId: string;
  birthYear: number;
  spouseBirthYear?: number | null;
  retirementAge: number;
  spouseRetirementAge?: number;
  isMarried: boolean;
  globalSettings: GlobalSettings;
  simulationResult: SimulationResult;
}

// 상승률 프리셋 (숫자만)
const GROWTH_PRESETS = [
  { id: "rate-5", value: 5 },
  { id: "rate-3", value: 3 },
  { id: "rate-1", value: 1 },
  { id: "rate-0", value: 0 },
];

// 로컬 타입 별칭 (기존 코드 호환)
type IncomeItem = DashboardIncomeItem;
type IncomeType = DashboardIncomeItem["type"];
type EndType = DashboardIncomeItem["endType"];
type IncomeFrequency = DashboardIncomeFrequency;

export function IncomeTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  spouseRetirementAge = 60,
  isMarried,
  globalSettings,
  simulationResult,
}: IncomeTabProps) {
  const { chartScaleColors, isDark } = useChartTheme();
  const currentYear = new Date().getFullYear();

  // React Query로 소득 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: dbIncomes = [], isLoading } = useIncomes(simulationId);
  const invalidate = useInvalidateByCategory(simulationId);

  // 현재 나이 계산
  const currentAge = currentYear - birthYear;
  const selfRetirementYear = currentYear + (retirementAge - currentAge);

  // 배우자 나이 계산
  const spouseCurrentAge = spouseBirthYear ? currentYear - spouseBirthYear : null;

  // 배우자 은퇴년도
  const spouseRetirementYear = useMemo(() => {
    if (!spouseBirthYear || spouseCurrentAge === null) return selfRetirementYear;
    return currentYear + (spouseRetirementAge - spouseCurrentAge);
  }, [spouseBirthYear, currentYear, selfRetirementYear, spouseCurrentAge, spouseRetirementAge]);

  const hasSpouse = isMarried && spouseBirthYear;

  // 특정 연도의 나이 계산
  const getAgeAtYear = (year: number, isSelf: boolean): number | null => {
    if (isSelf) {
      return currentAge + (year - currentYear);
    }
    if (spouseCurrentAge === null) return null;
    return spouseCurrentAge + (year - currentYear);
  };
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // 종료 년월 계산
  const getEndYearMonth = (
    item: IncomeItem
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
  const getMonthsCount = (item: IncomeItem): number => {
    const end = getEndYearMonth(item);
    return (end.year - item.startYear) * 12 + (end.month - item.startMonth);
  };

  // DB 소득을 IncomeItem 형식으로 변환
  const dbTypeToUIType = (dbType: DBIncomeType): IncomeType => {
    const typeMap: Record<DBIncomeType, IncomeType> = {
      labor: 'labor',
      business: 'business',
      rental: 'rental',
      pension: 'pension',
      dividend: 'regular',
      side: 'regular',
      other: 'regular',
    };
    return typeMap[dbType] || 'regular';
  };

  // DB 소득 데이터를 UI용 IncomeItem으로 변환
  const incomeItems = useMemo<IncomeItem[]>(() => {
    return dbIncomes.map((income) => {
      // endType 결정: retirement_link 기반
      let endType: EndType = 'custom';
      if (income.retirement_link === 'self') {
        endType = 'self-retirement';
      } else if (income.retirement_link === 'spouse') {
        endType = 'spouse-retirement';
      }

      return {
        id: income.id,
        type: dbTypeToUIType(income.type),
        label: income.title,
        owner: income.owner,
        amount: income.amount,
        frequency: income.frequency,
        startYear: income.start_year,
        startMonth: income.start_month,
        endType,
        endYear: income.end_year,
        endMonth: income.end_month,
        growthRate: income.growth_rate,
        rateCategory: income.rate_category,
        // 연동 정보 (null을 undefined로 변환)
        sourceType: income.source_type || undefined,
        sourceId: income.source_id || undefined,
        isSystem: income.source_type !== null, // 연동된 항목은 시스템 생성
      };
    });
  }, [dbIncomes]);

  // incomeItems 변경은 더 이상 onUpdateData로 저장하지 않음 (DB에서 직접 관리)
  // 기존 레거시 호환을 위해 빈 함수 유지
  const setIncomeItems = (_updater: IncomeItem[] | ((prev: IncomeItem[]) => IncomeItem[])) => {
    // DB 기반이므로 직접 상태 변경하지 않음
    // 대신 loadIncomes()를 호출하여 새로고침
    console.warn('setIncomeItems is deprecated. Use incomeService directly.');
  };

  // DB에서 직접 관리하므로 더 이상 onUpdateData로 저장하지 않음

  // 시나리오 모드 여부 (individual이 아니면 시나리오 적용 중)
  const isScenarioMode = globalSettings.scenarioMode !== "individual";
  const displayItems = useMemo(() => {
    return incomeItems.map((item) => {
      const rateCategory = item.rateCategory || getDefaultRateCategory(item.type);
      const effectiveRate = getEffectiveRate(
        item.growthRate,
        rateCategory,
        globalSettings.scenarioMode,
        globalSettings
      );
      return {
        ...item,
        displayGrowthRate: effectiveRate, // 현재 시나리오에서 표시할 상승률
      };
    });
  }, [incomeItems, globalSettings]);

  // 확장/축소 상태
  const [isExpanded, setIsExpanded] = useState(true);

  // 편집 중인 항목 ID
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<IncomeItem | null>(null);
  const [isCustomRateMode, setIsCustomRateMode] = useState(false);
  const [customRateInput, setCustomRateInput] = useState("");

  // 추가 중인 타입
  const [addingType, setAddingType] = useState<IncomeType | null>(null);
  const [newOwner, setNewOwner] = useState<"self" | "spouse">("self");
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newFrequency, setNewFrequency] = useState<IncomeFrequency>("monthly");
  const [newOnetimeYear, setNewOnetimeYear] = useState(currentYear);
  const [newOnetimeMonth, setNewOnetimeMonth] = useState(currentMonth);

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // 타입별 항목 (displayItems에서 필터 - 시나리오 적용된 상승률 포함)
  type DisplayItem = IncomeItem & { displayGrowthRate: number };
  const laborItems = displayItems.filter((i) => i.type === "labor");
  const businessItems = displayItems.filter((i) => i.type === "business");
  const regularItems = displayItems.filter((i) => i.type === "regular");
  const onetimeItems = displayItems.filter((i) => i.type === "onetime");

  // 헤더 총 개수 및 월 소득 계산
  const totalCount = displayItems.length;
  const totalMonthlyIncome = useMemo(() => {
    return displayItems.reduce((sum, item) => {
      if (item.type === 'onetime') return sum;
      if (item.frequency === 'yearly') return sum + Math.round(item.amount / 12);
      return sum + item.amount;
    }, 0);
  }, [displayItems]);

  // 월 소득으로 변환 (frequency 고려)
  const toMonthlyAmount = (item: IncomeItem): number => {
    if (item.type === "onetime") return 0; // 일시적 소득은 월 소득에 포함 안함
    if (item.frequency === "yearly") return item.amount / 12;
    return item.amount;
  };

  // 현재 연도에 해당하는 항목만 필터링
  const isCurrentYearItem = (item: IncomeItem): boolean => {
    if (item.type === "onetime") {
      return item.startYear === currentYear;
    }
    const endYear = item.endType === "self-retirement"
      ? selfRetirementYear
      : item.endType === "spouse-retirement"
        ? spouseRetirementYear
        : item.endYear || 9999;
    return currentYear >= item.startYear && currentYear <= endYear;
  };

  // 월 총 소득 (현재 연도에 해당하는 항목만)
  const monthlyIncome = useMemo(() => {
    return displayItems
      .filter((item) => isCurrentYearItem(item) && item.type !== "onetime")
      .reduce((sum, item) => sum + toMonthlyAmount(item), 0);
  }, [displayItems, currentYear, selfRetirementYear, spouseRetirementYear]);

  // 은퇴까지 총 소득 (상승률 반영, 은퇴 전에 시작하는 항목만)
  const lifetimeIncome = useMemo(() => {
    let total = 0;
    displayItems.forEach((item) => {
      // 은퇴 이후에 시작하는 항목은 제외
      if (item.startYear > selfRetirementYear) return;

      // 일시적 소득은 은퇴 전이면 포함
      if (item.type === "onetime") {
        if (item.startYear <= selfRetirementYear) {
          total += item.amount;
        }
        return;
      }

      // 종료 시점을 은퇴년도로 제한
      const itemEnd = getEndYearMonth(item);
      const effectiveEndYear = Math.min(itemEnd.year, selfRetirementYear);
      const effectiveEndMonth = itemEnd.year <= selfRetirementYear ? itemEnd.month : 12;

      // 실제 개월 수 계산 (은퇴까지만)
      const months = (effectiveEndYear - item.startYear) * 12 + (effectiveEndMonth - item.startMonth);
      if (months <= 0) return;

      // displayGrowthRate 사용 (이미 시나리오 적용됨)
      const monthlyGrowthRate = Math.pow(1 + item.displayGrowthRate / 100, 1 / 12) - 1;
      // 월 소득으로 변환
      let monthlyAmount =
        item.frequency === "yearly" ? item.amount / 12 : item.amount;
      for (let i = 0; i < months; i++) {
        total += monthlyAmount;
        monthlyAmount *= 1 + monthlyGrowthRate;
      }
    });
    return Math.round(total);
  }, [displayItems, selfRetirementYear, spouseRetirementYear]);

  // 소득 유형별 월 소득 (현재 연도 해당 항목만)
  const incomeByType = useMemo(
    () => ({
      labor: laborItems.filter(isCurrentYearItem).reduce((s, i) => s + toMonthlyAmount(i), 0),
      business: businessItems.filter(isCurrentYearItem).reduce((s, i) => s + toMonthlyAmount(i), 0),
      regular: regularItems.filter(isCurrentYearItem).reduce((s, i) => s + toMonthlyAmount(i), 0),
      onetime: onetimeItems.filter(isCurrentYearItem).reduce((s, i) => s + i.amount, 0),
    }),
    [
      laborItems,
      businessItems,
      regularItems,
      onetimeItems,
      currentYear,
      selfRetirementYear,
      spouseRetirementYear,
    ]
  );

  // 차트 데이터 - simulationResult에서 직접 가져옴 (Single Source of Truth)
  const projectionData = useMemo(() => {
    const labels: string[] = [];
    const laborData: number[] = [];
    const businessData: number[] = [];
    const regularData: number[] = [];
    const onetimeData: number[] = [];

    simulationResult.snapshots.forEach((snapshot) => {
      let laborTotal = 0;
      let businessTotal = 0;
      let regularTotal = 0;
      let onetimeTotal = 0;

      // incomeBreakdown을 type 필드로 정확히 분류
      snapshot.incomeBreakdown.forEach((item: { title: string; amount: number; type?: string }) => {
        // type 필드가 있으면 직접 사용, 없으면 키워드 기반 분류
        const itemType = item.type || '';
        switch (itemType) {
          case 'labor':
            laborTotal += item.amount;
            break;
          case 'business':
            businessTotal += item.amount;
            break;
          case 'pension':
          case 'national':      // 국민연금
          case 'retirement':    // 퇴직연금
          case 'personal':      // 개인연금
          case 'irp':           // IRP
            // Pension income is excluded from dashboard view
            break;
          case 'rental':
            // Rental income is excluded from dashboard view
            break;
          case 'dividend':
          case 'interest':
          case 'financial':
            regularTotal += item.amount;
            break;
          case 'bonus':
          case 'onetime':
          case 'inheritance':
          case 'gift':
            onetimeTotal += item.amount;
            break;
          default:
            // type이 없으면 키워드 기반 분류로 폴백
            if (itemType === '') {
              const category = categorizeIncome(item.title);
              switch (category.id) {
                case 'labor': laborTotal += item.amount; break;
                case 'business': businessTotal += item.amount; break;
                case 'pension': break; // Excluded
                case 'rental': break; // Excluded
                default: regularTotal += item.amount;
              }
            } else {
              regularTotal += item.amount;
            }
        }
      });

      labels.push(`${snapshot.year}`);
      laborData.push(laborTotal);
      businessData.push(businessTotal);
      regularData.push(regularTotal);
      onetimeData.push(onetimeTotal);
    });

    return {
      labels,
      laborData,
      businessData,
      regularData,
      onetimeData,
    };
  }, [simulationResult]);

  // 차트에 표시할 데이터셋 (값이 있는 것만)
  const chartDatasets = useMemo(() => {
    const datasets = [];
    if (projectionData.laborData.some((v) => v > 0)) {
      datasets.push({
        label: "근로",
        data: projectionData.laborData,
        backgroundColor: CHART_COLORS.income.labor,
      });
    }
    if (projectionData.businessData.some((v) => v > 0)) {
      datasets.push({
        label: "사업",
        data: projectionData.businessData,
        backgroundColor: CHART_COLORS.income.business,
      });
    }
    if (projectionData.regularData.some((v) => v > 0)) {
      datasets.push({
        label: "정기",
        data: projectionData.regularData,
        backgroundColor: CHART_COLORS.income.regular,
      });
    }
    if (projectionData.onetimeData.some((v) => v > 0)) {
      datasets.push({
        label: "일시",
        data: projectionData.onetimeData,
        backgroundColor: CHART_COLORS.income.onetime,
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
      "div.chart-tooltip"
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

    // 나이 계산
    const selfAgeAtYear = getAgeAtYear(yearNum, true);
    const spouseAgeAtYear = hasSpouse ? getAgeAtYear(yearNum, false) : null;

    // 나이 표시 문자열
    const ageDisplay = spouseAgeAtYear !== null
      ? `본인 ${selfAgeAtYear}세, 배우자 ${spouseAgeAtYear}세`
      : `본인 ${selfAgeAtYear}세`;

    const items: { label: string; value: number; color: string }[] = [];
    let total = 0;

    // 모든 데이터셋의 해당 연도 값을 가져옴 (0이어도 포함)
    chartDatasets.forEach((ds) => {
      const value = ds.data[dataIndex];
      items.push({ label: ds.label, value, color: ds.backgroundColor });
      total += value;
    });

    // 소득이 있는 항목만 표시 (0은 제외)
    const activeItems = items.filter((item) => item.value > 0);

    if (activeItems.length > 0) {
      const itemsHtml = activeItems
        .map(
          (item) => `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 24px; margin: 6px 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${
              item.color
            };"></span>
            <span style="font-size: 14px; color: #1d1d1f;">${item.label}</span>
          </div>
          <span style="font-size: 14px; font-weight: 600; color: #1d1d1f;">${formatMoney(
            item.value
          )}</span>
        </div>
      `
        )
        .join("");

      tooltipEl.innerHTML = `
        <div style="font-size: 16px; font-weight: 700; color: #1d1d1f; margin-bottom: 2px;">${year}년</div>
        <div style="font-size: 12px; color: #86868b; margin-bottom: 10px;">${ageDisplay}</div>
        ${itemsHtml}
        <div style="border-top: 1px solid rgba(0,0,0,0.08); margin-top: 10px; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; color: #86868b;">총 소득</span>
          <span style="font-size: 15px; font-weight: 700; color: #34c759;">${formatMoney(
            total
          )}</span>
        </div>
      `;
    } else {
      // 해당 연도에 소득이 없는 경우
      tooltipEl.innerHTML = `
        <div style="font-size: 16px; font-weight: 700; color: #1d1d1f; margin-bottom: 2px;">${year}년</div>
        <div style="font-size: 12px; color: #86868b; margin-bottom: 10px;">${ageDisplay}</div>
        <div style="font-size: 14px; color: #86868b; text-align: center; padding: 8px 0;">소득 없음</div>
        <div style="border-top: 1px solid rgba(0,0,0,0.08); margin-top: 10px; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; color: #86868b;">총 소득</span>
          <span style="font-size: 15px; font-weight: 700; color: #86868b;">0원</span>
        </div>
      `;
    }

    const chartWidth = chart.canvas.offsetWidth;
    const tooltipWidth = tooltipEl.offsetWidth || 180;

    // 좌우 경계 체크
    let leftPos = tooltip.caretX;
    if (leftPos + tooltipWidth / 2 > chartWidth) {
      // 오른쪽 끝에서 잘리면 왼쪽으로 이동
      leftPos = chartWidth - tooltipWidth / 2 - 10;
      tooltipEl.style.transform = "translate(-50%, 0)";
    } else if (leftPos - tooltipWidth / 2 < 0) {
      // 왼쪽 끝에서 잘리면 오른쪽으로 이동
      leftPos = tooltipWidth / 2 + 10;
      tooltipEl.style.transform = "translate(-50%, 0)";
    } else {
      tooltipEl.style.transform = "translate(-50%, 0)";
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

  // UI 타입을 DB 타입으로 변환
  const uiTypeToDbType = (uiType: IncomeType): DBIncomeType => {
    const typeMap: Record<IncomeType, DBIncomeType> = {
      labor: 'labor',
      business: 'business',
      rental: 'rental',
      pension: 'pension',
      regular: 'other',
      onetime: 'other',
    };
    return typeMap[uiType] || 'other';
  };

  // 항목 추가 (DB에 저장)
  const handleAdd = async () => {
    if (!addingType || !newAmount || !simulationId) return;

    const defaultLabel = newOwner === "self" ? "본인" : "배우자";

    // 타입별 기본 라벨
    const getDefaultLabel = () => {
      if (newLabel) return newLabel;
      if (addingType === "regular") return "정기 소득";
      if (addingType === "onetime") return "일시 소득";
      if (addingType === "rental") return "임대 소득";
      if (addingType === "pension") return "연금 소득";
      return defaultLabel;
    };

    // 일시적 소득은 선택한 년/월에 한 번만 발생
    const isOnetime = addingType === "onetime";
    const isFixedToRetirement = !isOnetime && (newOwner === "self" || newOwner === "spouse");

    // 새 소득의 기본 retirement_link는 owner 기준 (본인 소득 → 본인 은퇴, 배우자 소득 → 배우자 은퇴)
    const defaultRetirementLink = isFixedToRetirement
      ? (newOwner === 'spouse' ? 'spouse' : 'self')
      : null;

    const incomeInput: IncomeInput = {
      simulation_id: simulationId,
      type: uiTypeToDbType(addingType),
      title: getDefaultLabel(),
      owner: newOwner,
      amount: parseFloat(newAmount),
      frequency: isOnetime ? "monthly" : newFrequency,
      start_year: isOnetime ? newOnetimeYear : currentYear,
      start_month: isOnetime ? newOnetimeMonth : currentMonth,
      // retirement_link가 있으면 end_year는 null - 시뮬레이션 시점에 동적 계산
      end_year: isOnetime ? newOnetimeYear : null,
      end_month: isOnetime ? newOnetimeMonth : null,
      is_fixed_to_retirement: isFixedToRetirement,
      retirement_link: defaultRetirementLink,
      growth_rate: isOnetime ? 0 : DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
      rate_category: getDefaultRateCategory(addingType) as any,
    };

    try {
      await createIncome(incomeInput);
      invalidate('incomes'); // 캐시 무효화 (소득 + items)
    } catch (error) {
      console.error('Failed to create income:', error);
    }

    setAddingType(null);
    setNewOwner("self");
    setNewLabel("");
    setNewAmount("");
    setNewFrequency("monthly");
    setNewOnetimeYear(currentYear);
    setNewOnetimeMonth(currentMonth);
  };

  // 항목 삭제 (DB에서 삭제)
  const handleDelete = async (id: string) => {
    try {
      await deleteIncome(id);
      invalidate('incomes'); // 캐시 무효화 (소득 + items)
    } catch (error) {
      console.error('Failed to delete income:', error);
      alert(error instanceof Error ? error.message : '삭제 실패');
    }
    if (editingId === id) {
      setEditingId(null);
      setEditForm(null);
    }
  };

  // 편집 시작
  const startEdit = (item: IncomeItem) => {
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

  // 편집 저장 (DB에 저장)
  const saveEdit = async () => {
    if (!editForm) return;

    const finalGrowthRate = isCustomRateMode
      ? (customRateInput === "" ? 0 : parseFloat(customRateInput))
      : editForm.growthRate;

    const isFixedToRetirement = editForm.endType === 'self-retirement' || editForm.endType === 'spouse-retirement';

    try {
      // retirement_link 결정: endType에 따라 'self', 'spouse', null
      const retirementLink = editForm.endType === 'self-retirement'
        ? 'self'
        : editForm.endType === 'spouse-retirement'
          ? 'spouse'
          : null;

      // retirement_link가 있으면 end_year는 null - 시뮬레이션 시점에 동적 계산
      const endYearToSave = retirementLink ? null : editForm.endYear;
      const endMonthToSave = retirementLink ? null : editForm.endMonth;

      await updateIncome(editForm.id, {
        title: editForm.label,
        owner: editForm.owner,
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
      invalidate('incomes'); // 캐시 무효화 (소득 + items)
    } catch (error) {
      console.error('Failed to update income:', error);
    }

    setEditingId(null);
    setEditForm(null);
    setIsCustomRateMode(false);
    setCustomRateInput("");
  };

  // 기간 표시 텍스트 (년.월 형식)
  const formatPeriod = (item: IncomeItem): string => {
    // 일시적 소득은 받는 시점만 표시
    if (item.type === "onetime") {
      return `${item.startYear}.${String(item.startMonth).padStart(
        2,
        "0"
      )} 수령 예정`;
    }

    const startStr = `${item.startYear}.${String(item.startMonth).padStart(
      2,
      "0"
    )}`;

    if (item.endType === "self-retirement") {
      return `${startStr} ~ 본인 은퇴`;
    }
    if (item.endType === "spouse-retirement") {
      return `${startStr} ~ 배우자 은퇴`;
    }

    // 종료일이 없으면 "시작일 ~" 형식으로 표시
    if (!item.endYear) return `${startStr} ~`;

    const endStr = `${item.endYear}.${String(item.endMonth || 12).padStart(2, "0")}`;
    return `${startStr} ~ ${endStr}`;
  };

  // 금액 표시 (frequency 고려)
  const formatAmountWithFreq = (item: IncomeItem): string => {
    if (item.type === "onetime") {
      return formatMoney(item.amount); // 일시적 소득은 총액
    }
    const unit = item.frequency === "yearly" ? "/년" : "/월";
    return `${formatMoney(item.amount)}${unit}`;
  };

  // 종료 타입 표시 텍스트 (편집용)
  const getEndTypeLabel = (item: IncomeItem): string => {
    if (item.endType === "self-retirement") return `본인 은퇴`;
    if (item.endType === "spouse-retirement") return `배우자 은퇴`;
    return `직접 입력`;
  };

  // 상승률이 프리셋인지 확인
  const isPresetRate = (rate: number) =>
    GROWTH_PRESETS.some((p) => p.value === rate);

  // ESC 키로 드롭다운 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTypeMenu) {
        setShowTypeMenu(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showTypeMenu]);

  // 드롭다운 외부 클릭으로 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showTypeMenu &&
        addButtonRef.current &&
        !addButtonRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest(`.${styles.typeMenu}`)
      ) {
        setShowTypeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTypeMenu]);

  const handleTypeSelect = (type: IncomeType) => {
    setAddingType(type);
    setShowTypeMenu(false);
  };

  // 아이템 렌더링 함수 (개별 항목)
  const renderItem = (item: DisplayItem) => {
    const isEditing = editingId === item.id;

    if (isEditing && editForm) {
      // 일시적 소득 편집 모드
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
                    <span className={styles.editRowLabel}>수령</span>
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
                            Math.max(1, parseInt(e.target.value) || 1)
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

      // 일반 소득 편집 모드
      const isLaborOrBusiness =
        item.type === "labor" || item.type === "business";
      return (
        <div key={item.id} className={styles.editItem}>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>
                    {isLaborOrBusiness ? "주체" : "항목"}
                  </span>
                  {isLaborOrBusiness ? (
                    <div className={styles.ownerButtons}>
                      <button
                        type="button"
                        className={`${styles.ownerBtn} ${
                          editForm.owner === "self" ? styles.active : ""
                        }`}
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            owner: "self",
                            label: "본인",
                          })
                        }
                      >
                        본인
                      </button>
                      {hasSpouse && (
                        <button
                          type="button"
                          className={`${styles.ownerBtn} ${
                            editForm.owner === "spouse" ? styles.active : ""
                          }`}
                          onClick={() =>
                            setEditForm({
                              ...editForm,
                              owner: "spouse",
                              label: "배우자",
                            })
                          }
                        >
                          배우자
                        </button>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      className={styles.editLabelInput}
                      value={editForm.label}
                      onChange={(e) =>
                        setEditForm({ ...editForm, label: e.target.value })
                      }
                      placeholder="항목명"
                    />
                  )}
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
                            Math.max(1, parseInt(e.target.value) || 1)
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
                                Math.max(1, parseInt(e.target.value) || 12)
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
    const isLinked = item.sourceType !== null && item.sourceType !== undefined;
    const isReadOnly = item.isSystem || isLinked;

    // 연동 소스 라벨 및 아이콘
    const getLinkedBadge = () => {
      if (!item.sourceType) return null;
      switch (item.sourceType) {
        case 'national_pension':
          return { label: '국민연금', icon: <Link size={12} /> };
        case 'retirement_pension':
          return { label: '퇴직연금', icon: <Link size={12} /> };
        case 'personal_pension':
          return { label: '개인연금', icon: <Link size={12} /> };
        case 'real_estate':
          return { label: '부동산', icon: <Home size={12} /> };
        default:
          return { label: '연동', icon: <Link size={12} /> };
      }
    };
    const linkedBadge = getLinkedBadge();

    return (
      <div key={item.id} className={styles.incomeItem}>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>
            {item.label}
            {linkedBadge && (
              <span className={styles.linkedBadge}>
                {linkedBadge.icon}
                {linkedBadge.label}
              </span>
            )}
          </span>
          <span className={styles.itemMeta}>
            {item.type === "onetime"
              ? formatPeriod(item)
              : isReadOnly
              ? formatPeriod(item)
              : `${formatPeriod(item)} | 연 ${item.displayGrowthRate}% 상승${isScenarioMode ? " (시나리오)" : ""}`}
          </span>
        </div>
        <div className={styles.itemRight}>
          <span className={styles.itemAmount}>
            {formatAmountWithFreq(item)}
          </span>
          {isLinked ? null : !isReadOnly && (
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
      </div>
    );
  };

  // 인라인 추가 폼 렌더링
  const renderInlineAddForm = () => {
    if (!addingType) return null;

    return (
      <div className={styles.inlineAddForm}>
        {/* 첫 번째 줄: 항목명 + 본인/배우자 */}
        <div className={styles.addFormRow}>
          {(addingType === "regular" || addingType === "onetime") && (
            <input
              type="text"
              className={styles.inlineLabelInput}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="항목명"
              autoFocus
            />
          )}
          <div className={styles.ownerButtons}>
            <button
              type="button"
              className={`${styles.ownerBtn} ${
                newOwner === "self" ? styles.active : ""
              }`}
              onClick={() => setNewOwner("self")}
            >
              본인
            </button>
            {hasSpouse && (
              <button
                type="button"
                className={`${styles.ownerBtn} ${
                  newOwner === "spouse" ? styles.active : ""
                }`}
                onClick={() => setNewOwner("spouse")}
              >
                배우자
              </button>
            )}
          </div>
        </div>

        {/* 두 번째 줄: 금액 + 주기 (또는 수령시점) */}
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
                    setNewOnetimeYear(
                      parseInt(e.target.value) || currentYear
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
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    )
                  }
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.editUnit}>월 수령</span>
              </div>
            </>
          ) : (
            <div className={styles.inlineAmountGroup}>
              <input
                type="number"
                className={styles.inlineAmountInput}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
                autoFocus={addingType !== "regular"}
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
              onClick={() => {
                setAddingType(null);
                setNewOwner("self");
                setNewLabel("");
                setNewAmount("");
                setNewFrequency("monthly");
                setNewOnetimeYear(currentYear);
                setNewOnetimeMonth(currentMonth);
              }}
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
    );
  };

  // 캐시된 데이터가 없고 로딩 중일 때만 스켈레톤 표시
  if (isLoading && dbIncomes.length === 0) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={2} itemsPerSection={3} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.headerToggle} onClick={() => setIsExpanded(!isExpanded)} type="button">
          <span className={styles.title}>소득</span>
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

      {/* 타입 선택 드롭다운 - portal로 body에 렌더 (부모 backdrop-filter 스택킹 컨텍스트 회피) */}
      {showTypeMenu && addButtonRef.current && createPortal(
        <div
          className={styles.typeMenu}
          style={{
            position: 'fixed',
            top: addButtonRef.current.getBoundingClientRect().bottom + 6,
            left: addButtonRef.current.getBoundingClientRect().right - 150,
            background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}
        >
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('labor')}
          >
            근로 소득
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('business')}
          >
            사업 소득
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('regular')}
          >
            정기적 소득
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('onetime')}
          >
            일시적 소득
          </button>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.flatList}>
          {displayItems.length === 0 && !addingType && (
            <p className={styles.emptyHint}>
              아직 등록된 소득이 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}
          {displayItems.map((item) => renderItem(item))}
          {renderInlineAddForm()}
        </div>
      )}
    </div>
  );
}
