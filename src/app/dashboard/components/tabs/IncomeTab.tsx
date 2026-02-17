"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, TrendingUp, Pencil, X, Check, ExternalLink, ArrowLeft } from "lucide-react";
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
} from "@/types";
import type { SimulationResult } from "@/lib/services/simulationTypes";
import type { Income, IncomeInput, IncomeType as DBIncomeType } from "@/types/tables";
import { formatMoney, getDefaultRateCategory } from "@/lib/utils";
import { formatPeriodDisplay, toPeriodRaw, isPeriodValid, restorePeriodCursor, handlePeriodTextChange } from "@/lib/utils/periodInput";
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
  simulationResult: SimulationResult;
}

// 로컬 타입 별칭 (기존 코드 호환)
type IncomeItem = DashboardIncomeItem;
type IncomeType = DashboardIncomeItem["type"];
type EndType = DashboardIncomeItem["endType"];
type IncomeFrequency = DashboardIncomeFrequency;

// UI 소득 유형 라벨
const UI_TYPE_LABELS: Record<IncomeType, string> = {
  labor: '근로 소득',
  business: '사업 소득',
  regular: '정기적 소득',
  onetime: '일시적 소득',
  rental: '임대 소득',
  pension: '연금 소득',
};

export function IncomeTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  spouseRetirementAge = 60,
  isMarried,
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

  const displayItems = useMemo(() => {
    return incomeItems.map((item) => ({
      ...item,
      displayGrowthRate: item.growthRate, // fixed 모드에서만 표시
    }));
  }, [incomeItems]);

  // 확장/축소 상태
  const [isExpanded, setIsExpanded] = useState(true);

  // 편집 중인 항목 ID
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<IncomeItem | null>(null);
  const [editStartType, setEditStartType] = useState<'current' | 'self-retirement' | 'spouse-retirement' | 'year'>('current');
  const [editEndType, setEditEndType] = useState<'self-retirement' | 'spouse-retirement' | 'year'>('self-retirement');
  const [customRateInput, setCustomRateInput] = useState("");

  // 추가 중인 타입
  const [addingType, setAddingType] = useState<IncomeType | null>(null);
  const [newOwner, setNewOwner] = useState<"self" | "spouse">("self");
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newFrequency, setNewFrequency] = useState<IncomeFrequency>("monthly");
  const [newOnetimeYear, setNewOnetimeYear] = useState(currentYear);
  const [newOnetimeMonth, setNewOnetimeMonth] = useState(currentMonth);
  const [newStartType, setNewStartType] = useState<'current' | 'self-retirement' | 'spouse-retirement' | 'year'>('current');
  const [newStartYear, setNewStartYear] = useState(currentYear);
  const [newStartMonth, setNewStartMonth] = useState(currentMonth);
  const [newEndType, setNewEndType] = useState<'self-retirement' | 'spouse-retirement' | 'year'>('self-retirement');
  const [newEndYear, setNewEndYear] = useState(selfRetirementYear);
  const [newEndMonth, setNewEndMonth] = useState(12);
  const [newRateCategory, setNewRateCategory] = useState<'inflation' | 'income' | 'investment' | 'realEstate' | 'fixed'>('income');
  const [newCustomRate, setNewCustomRate] = useState("");
  const [newStartDateText, setNewStartDateText] = useState('');
  const [newEndDateText, setNewEndDateText] = useState('');
  const [newOnetimeDateText, setNewOnetimeDateText] = useState('');
  const [editStartDateText, setEditStartDateText] = useState('');
  const [editEndDateText, setEditEndDateText] = useState('');

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
  const resetAddForm = () => {
    setShowTypeMenu(false);
    setAddingType(null);
    setNewOwner("self");
    setNewLabel("");
    setNewAmount("");
    setNewFrequency("monthly");
    setNewOnetimeYear(currentYear);
    setNewOnetimeMonth(currentMonth);
    setNewStartType('current');
    setNewStartYear(currentYear);
    setNewStartMonth(currentMonth);
    setNewEndType('self-retirement');
    setNewEndYear(selfRetirementYear);
    setNewEndMonth(12);
    setNewRateCategory('income');
    setNewCustomRate("");
    setNewStartDateText(toPeriodRaw(currentYear, currentMonth));
    setNewEndDateText(toPeriodRaw(selfRetirementYear, 12));
    setNewOnetimeDateText(toPeriodRaw(currentYear, currentMonth));
  };

  const handleAdd = async () => {
    if (!addingType || !newAmount || !simulationId) return;

    const getDefaultLabel = () => {
      if (newLabel) return newLabel;
      return UI_TYPE_LABELS[addingType] || addingType;
    };

    const isOnetime = addingType === "onetime";

    // retirement_link 결정
    let retirementLink: string | null = null;
    if (!isOnetime) {
      if (newEndType === 'self-retirement') retirementLink = 'self';
      else if (newEndType === 'spouse-retirement') retirementLink = 'spouse';
    }

    const isFixedToRetirement = retirementLink !== null;

    // growth_rate 결정
    const growthRate = isOnetime ? 0
      : newRateCategory === 'fixed'
        ? (newCustomRate === '' ? 0 : parseFloat(newCustomRate))
        : 3.0;

    const incomeInput: IncomeInput = {
      simulation_id: simulationId,
      type: uiTypeToDbType(addingType),
      title: getDefaultLabel(),
      owner: newOwner,
      amount: parseFloat(newAmount),
      frequency: isOnetime ? "monthly" : newFrequency,
      start_year: isOnetime ? newOnetimeYear : newStartYear,
      start_month: isOnetime ? newOnetimeMonth : newStartMonth,
      end_year: isOnetime ? newOnetimeYear : (retirementLink ? null : newEndYear),
      end_month: isOnetime ? newOnetimeMonth : (retirementLink ? null : newEndMonth),
      is_fixed_to_retirement: isFixedToRetirement,
      retirement_link: retirementLink as any,
      growth_rate: growthRate,
      rate_category: newRateCategory as any,
    };

    try {
      await createIncome(incomeInput);
      invalidate('incomes');
    } catch (error) {
      console.error('Failed to create income:', error);
    }

    resetAddForm();
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
    // endType 결정
    if (item.endType === 'self-retirement') {
      setEditEndType('self-retirement');
    } else if (item.endType === 'spouse-retirement') {
      setEditEndType('spouse-retirement');
    } else {
      setEditEndType('year');
    }
    if (itemWithCategory.rateCategory === 'fixed') {
      setCustomRateInput(String(item.growthRate));
    } else {
      setCustomRateInput("");
    }
    setEditStartDateText(toPeriodRaw(item.startYear, item.startMonth));
    const endY = item.endYear || selfRetirementYear;
    const endM = item.endMonth || 12;
    setEditEndDateText(toPeriodRaw(endY, endM));
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setEditStartType('current');
    setEditEndType('self-retirement');
    setCustomRateInput("");
  };

  // 편집 저장 (DB에 저장)
  const saveEdit = async () => {
    if (!editForm) return;

    // If fixed mode, use customRateInput; otherwise growthRate doesn't matter (engine uses rateCategory)
    const finalGrowthRate = editForm.rateCategory === 'fixed'
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
        type: uiTypeToDbType(editForm.type),
        title: editForm.label,
        owner: editForm.owner,
        amount: editForm.amount,
        frequency: editForm.type === 'onetime' ? 'monthly' : editForm.frequency,
        start_year: editForm.startYear,
        start_month: editForm.startMonth,
        end_year: editForm.type === 'onetime' ? editForm.startYear : endYearToSave,
        end_month: editForm.type === 'onetime' ? editForm.startMonth : endMonthToSave,
        is_fixed_to_retirement: editForm.type === 'onetime' ? false : isFixedToRetirement,
        retirement_link: editForm.type === 'onetime' ? null : retirementLink,
        growth_rate: editForm.type === 'onetime' ? 0 : finalGrowthRate,
        rate_category: editForm.rateCategory as any,
      });
      invalidate('incomes'); // 캐시 무효화 (소득 + items)
    } catch (error) {
      console.error('Failed to update income:', error);
    }

    setEditingId(null);
    setEditForm(null);
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

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) {
          cancelEdit();
          e.stopPropagation();
        } else if (showTypeMenu) {
          resetAddForm();
          e.stopPropagation();
        }
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [showTypeMenu, editingId]);


  const handleTypeSelect = (type: IncomeType) => {
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
    setNewStartDateText(toPeriodRaw(currentYear, currentMonth));
    setNewEndDateText(toPeriodRaw(selfRetirementYear, 12));
    setNewOnetimeDateText(toPeriodRaw(currentYear, currentMonth));
    // Don't close showTypeMenu - stay in modal for step 2
  };

  // 아이템 렌더링 함수 (개별 항목) - 항상 읽기 모드
  const renderItem = (item: DisplayItem) => {
    return (
      <div key={item.id} className={styles.incomeItem}>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>
            {item.label} | {item.owner === "spouse" ? "배우자" : "본인"}
          </span>
          <span className={styles.itemMeta}>
            {item.type === "onetime"
              ? formatPeriod(item)
              : `${formatPeriod(item)} | ${item.rateCategory === 'fixed' ? `연 ${item.displayGrowthRate}% 상승` : '시뮬레이션 가정'}`}
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

      {/* 타입 선택 모달 (2-step) */}
      {showTypeMenu && createPortal(
        <div
          className={styles.typeModalOverlay}
          data-scenario-dropdown-portal="true"
          onClick={resetAddForm}
        >
          <div
            className={styles.typeModal}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            {!addingType ? (
              <>
                {/* Step 1: 타입 선택 */}
                <div className={styles.typeModalHeader}>
                  <span className={styles.typeModalTitle}>소득 추가</span>
                  <button
                    className={styles.typeModalClose}
                    onClick={resetAddForm}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.typeGrid}>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('labor')}>
                    <span className={styles.typeCardName}>근로 소득</span>
                    <span className={styles.typeCardDesc}>급여, 임금 등</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('business')}>
                    <span className={styles.typeCardName}>사업 소득</span>
                    <span className={styles.typeCardDesc}>프리랜서, 자영업 등</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('regular')}>
                    <span className={styles.typeCardName}>정기적 소득</span>
                    <span className={styles.typeCardDesc}>배당, 이자, 임대 등</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('onetime')}>
                    <span className={styles.typeCardName}>일시적 소득</span>
                    <span className={styles.typeCardDesc}>상속, 증여, 퇴직금 등</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: 입력 폼 */}
                <div className={styles.typeModalHeader}>
                  <div className={styles.headerLeft}>
                    <button
                      className={styles.backButton}
                      onClick={() => setAddingType(null)}
                      type="button"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <span className={styles.stepLabel}>
                      {UI_TYPE_LABELS[addingType]} 추가
                    </span>
                  </div>
                  <button
                    className={styles.typeModalClose}
                    onClick={resetAddForm}
                    type="button"
                  >
                    <X size={18} />
                  </button>
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
                      placeholder={UI_TYPE_LABELS[addingType]}
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
                      {hasSpouse && (
                        <button
                          type="button"
                          className={`${styles.ownerBtn} ${newOwner === 'spouse' ? styles.active : ''}`}
                          onClick={() => setNewOwner('spouse')}
                        >
                          배우자
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 금액 */}
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
                      <span className={styles.modalFormLabel}>수령일</span>
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
                              const val = e.target.value;
                              if (val === 'current') {
                                setNewStartType('current');
                                setNewStartYear(currentYear);
                                setNewStartMonth(currentMonth);
                              } else if (val === 'self-retirement') {
                                setNewStartType('self-retirement');
                                setNewStartYear(selfRetirementYear);
                                setNewStartMonth(12);
                              } else if (val === 'spouse-retirement') {
                                setNewStartType('spouse-retirement');
                                setNewStartYear(spouseRetirementYear);
                                setNewStartMonth(12);
                              } else {
                                setNewStartType('year');
                                setNewStartDateText(toPeriodRaw(newStartYear, newStartMonth));
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
                              const val = e.target.value;
                              if (val === 'self-retirement') {
                                setNewEndType('self-retirement');
                              } else if (val === 'spouse-retirement') {
                                setNewEndType('spouse-retirement');
                              } else {
                                setNewEndType('year');
                                setNewEndDateText(toPeriodRaw(newEndYear, newEndMonth));
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

                  {/* 상승률 (일시적 소득 제외) */}
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
                    <button
                      className={styles.modalCancelBtn}
                      onClick={resetAddForm}
                    >
                      취소
                    </button>
                    <button
                      className={styles.modalAddBtn}
                      onClick={handleAdd}
                      disabled={!newAmount || (addingType === 'onetime'
                        ? !isPeriodValid(newOnetimeDateText)
                        : (newStartType === 'year' && !isPeriodValid(newStartDateText)) || (newEndType === 'year' && !isPeriodValid(newEndDateText))
                      )}
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
        <div
          className={styles.typeModalOverlay}
          data-scenario-dropdown-portal="true"
          onClick={cancelEdit}
        >
          <div
            className={styles.typeModal}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div className={styles.typeModalHeader}>
              <span className={styles.stepLabel}>
                {UI_TYPE_LABELS[editForm.type]} 수정
              </span>
              <button
                className={styles.typeModalClose}
                onClick={cancelEdit}
                type="button"
              >
                <X size={18} />
              </button>
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
                  {hasSpouse && (
                    <button
                      type="button"
                      className={`${styles.ownerBtn} ${editForm.owner === 'spouse' ? styles.active : ''}`}
                      onClick={() => setEditForm({ ...editForm, owner: 'spouse' })}
                    >
                      배우자
                    </button>
                  )}
                </div>
              </div>

              {/* 금액 */}
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
                  <span className={styles.modalFormLabel}>수령일</span>
                  <div className={styles.fieldContent}>
                    <input
                      type="text"
                      className={`${styles.periodInput}${editStartDateText.length > 0 && !isPeriodValid(editStartDateText) ? ` ${styles.invalid}` : ''}`}
                      value={formatPeriodDisplay(editStartDateText)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
                        restorePeriodCursor(e.target, raw);
                        setEditStartDateText(raw);
                        let y = editForm.startYear, m = editForm.startMonth;
                        if (raw.length >= 4) {
                          const py = parseInt(raw.slice(0, 4));
                          if (!isNaN(py)) y = py;
                        }
                        if (raw.length >= 5) {
                          const pm = parseInt(raw.slice(4));
                          if (!isNaN(pm) && pm >= 1 && pm <= 12) m = pm;
                        }
                        setEditForm({ ...editForm, startYear: y, startMonth: m, endYear: y, endMonth: m });
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
                          const val = e.target.value;
                          if (val === 'current') {
                            setEditStartType('current');
                            setEditForm({ ...editForm, startYear: currentYear, startMonth: currentMonth });
                          } else if (val === 'self-retirement') {
                            setEditStartType('self-retirement');
                            setEditForm({ ...editForm, startYear: selfRetirementYear, startMonth: 12 });
                          } else if (val === 'spouse-retirement') {
                            setEditStartType('spouse-retirement');
                            setEditForm({ ...editForm, startYear: spouseRetirementYear, startMonth: 12 });
                          } else {
                            setEditStartType('year');
                            setEditStartDateText(toPeriodRaw(editForm.startYear, editForm.startMonth));
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
                            restorePeriodCursor(e.target, raw);
                            setEditStartDateText(raw);
                            let y = editForm.startYear, m = editForm.startMonth;
                            if (raw.length >= 4) {
                              const py = parseInt(raw.slice(0, 4));
                              if (!isNaN(py)) y = py;
                            }
                            if (raw.length >= 5) {
                              const pm = parseInt(raw.slice(4));
                              if (!isNaN(pm) && pm >= 1 && pm <= 12) m = pm;
                            }
                            setEditForm({ ...editForm, startYear: y, startMonth: m });
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
                          const val = e.target.value;
                          if (val === 'self-retirement') {
                            setEditEndType('self-retirement');
                            setEditForm({ ...editForm, endType: 'self-retirement' });
                          } else if (val === 'spouse-retirement') {
                            setEditEndType('spouse-retirement');
                            setEditForm({ ...editForm, endType: 'spouse-retirement' });
                          } else {
                            setEditEndType('year');
                            setEditEndDateText(toPeriodRaw(editForm.endYear || selfRetirementYear, editForm.endMonth || 12));
                            setEditForm({ ...editForm, endType: 'custom', endYear: editForm.endYear || selfRetirementYear, endMonth: editForm.endMonth || 12 });
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
                            restorePeriodCursor(e.target, raw);
                            setEditEndDateText(raw);
                            let y = editForm.endYear || selfRetirementYear, m = editForm.endMonth || 12;
                            if (raw.length >= 4) {
                              const py = parseInt(raw.slice(0, 4));
                              if (!isNaN(py)) y = py;
                            }
                            if (raw.length >= 5) {
                              const pm = parseInt(raw.slice(4));
                              if (!isNaN(pm) && pm >= 1 && pm <= 12) m = pm;
                            }
                            setEditForm({ ...editForm, endType: 'custom', endYear: y, endMonth: m });
                          }}
                          placeholder="2030.12"
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* 상승률 (일시적 소득 제외) */}
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
                            value={customRateInput}
                            onChange={(e) => setCustomRateInput(e.target.value)}
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
                            setCustomRateInput('');
                          }}
                        >
                          시뮬레이션 가정
                        </button>
                        <button
                          type="button"
                          className={`${styles.rateToggleBtn} ${editForm.rateCategory === 'fixed' ? styles.active : ''}`}
                          onClick={() => {
                            setEditForm({ ...editForm, rateCategory: 'fixed' as any });
                            if (customRateInput === '') setCustomRateInput(String(editForm.growthRate));
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
                <button
                  className={styles.modalAddBtn}
                  onClick={saveEdit}
                  disabled={editForm?.type === 'onetime'
                    ? !isPeriodValid(editStartDateText)
                    : (editStartType === 'year' && !isPeriodValid(editStartDateText)) || (editEndType === 'year' && !isPeriodValid(editEndDateText))
                  }
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.flatList}>
          {displayItems.length === 0 && (
            <p className={styles.emptyHint}>
              아직 등록된 소득이 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}
          {displayItems.map((item) => renderItem(item))}
        </div>
      )}
    </div>
  );
}
