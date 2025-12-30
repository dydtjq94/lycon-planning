"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, TrendingUp, Pencil, X, Check } from "lucide-react";
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
  OnboardingData,
  DashboardIncomeItem,
  DashboardIncomeFrequency,
} from "@/types";
import { DEFAULT_GLOBAL_SETTINGS } from "@/types";
import { formatMoney } from "@/lib/utils";
import styles from "./IncomeTab.module.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface IncomeTabProps {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
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

export function IncomeTab({ data, onUpdateData }: IncomeTabProps) {
  const currentYear = new Date().getFullYear();

  // 현재 나이 계산
  const currentAge = useMemo(() => {
    if (!data.birth_date) return 35;
    const birthYear = new Date(data.birth_date).getFullYear();
    return currentYear - birthYear;
  }, [data.birth_date, currentYear]);

  const retirementAge = data.target_retirement_age || 60;
  const selfRetirementYear = currentYear + (retirementAge - currentAge);

  // 배우자 나이 계산
  const spouseCurrentAge = useMemo(() => {
    if (!data.spouse?.birth_date) return null;
    const spouseBirthYear = new Date(data.spouse.birth_date).getFullYear();
    return currentYear - spouseBirthYear;
  }, [data.spouse?.birth_date, currentYear]);

  const spouseRetirementAge = data.spouse?.retirement_age || 60;

  // 배우자 은퇴년도
  const spouseRetirementYear = useMemo(() => {
    if (!data.spouse?.birth_date || spouseCurrentAge === null) return selfRetirementYear;
    return currentYear + (spouseRetirementAge - spouseCurrentAge);
  }, [data.spouse, currentYear, selfRetirementYear, spouseCurrentAge, spouseRetirementAge]);

  const hasSpouse = data.isMarried && data.spouse;

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

  // 소득 항목 상태 (저장된 데이터 우선, 없으면 기존 필드에서 마이그레이션)
  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>(() => {
    // 저장된 incomeItems가 있으면 사용
    if (data.incomeItems && data.incomeItems.length > 0) {
      return data.incomeItems;
    }

    // 없으면 기존 필드에서 마이그레이션
    const items: IncomeItem[] = [];
    const month = new Date().getMonth() + 1;

    if (data.laborIncome && data.laborIncome > 0) {
      items.push({
        id: "labor-self",
        type: "labor",
        label: "본인",
        owner: "self",
        amount: data.laborIncome,
        frequency: data.laborIncomeFrequency || "monthly",
        startYear: currentYear,
        startMonth: month,
        endType: "self-retirement",
        endYear: null,
        endMonth: null,
        growthRate: DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
      });
    }

    if (data.spouseLaborIncome && data.spouseLaborIncome > 0) {
      items.push({
        id: "labor-spouse",
        type: "labor",
        label: "배우자",
        owner: "spouse",
        amount: data.spouseLaborIncome,
        frequency: data.spouseLaborIncomeFrequency || "monthly",
        startYear: currentYear,
        startMonth: month,
        endType: "spouse-retirement",
        endYear: null,
        endMonth: null,
        growthRate: DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
      });
    }

    if (data.businessIncome && data.businessIncome > 0) {
      items.push({
        id: "business-self",
        type: "business",
        label: "본인",
        owner: "self",
        amount: data.businessIncome,
        frequency: data.businessIncomeFrequency || "monthly",
        startYear: currentYear,
        startMonth: month,
        endType: "self-retirement",
        endYear: null,
        endMonth: null,
        growthRate: DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
      });
    }

    if (data.spouseBusinessIncome && data.spouseBusinessIncome > 0) {
      items.push({
        id: "business-spouse",
        type: "business",
        label: "배우자",
        owner: "spouse",
        amount: data.spouseBusinessIncome,
        frequency: data.spouseBusinessIncomeFrequency || "monthly",
        startYear: currentYear,
        startMonth: month,
        endType: "spouse-retirement",
        endYear: null,
        endMonth: null,
        growthRate: DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
      });
    }

    return items;
  });

  // incomeItems 변경 시 DB에 저장
  useEffect(() => {
    onUpdateData({ incomeItems });
  }, [incomeItems]);

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

  // 타입별 항목
  const laborItems = incomeItems.filter((i) => i.type === "labor");
  const businessItems = incomeItems.filter((i) => i.type === "business");
  const regularItems = incomeItems.filter((i) => i.type === "regular");
  const onetimeItems = incomeItems.filter((i) => i.type === "onetime");
  const rentalItems = incomeItems.filter((i) => i.type === "rental");
  const pensionItems = incomeItems.filter((i) => i.type === "pension");

  // 월 소득으로 변환 (frequency 고려)
  const toMonthlyAmount = (item: IncomeItem): number => {
    if (item.type === "onetime") return 0; // 일시적 소득은 월 소득에 포함 안함
    if (item.frequency === "yearly") return item.amount / 12;
    return item.amount;
  };

  // 월 총 소득 (일시적 소득 제외, frequency 고려)
  const monthlyIncome = useMemo(() => {
    return incomeItems.reduce((sum, item) => sum + toMonthlyAmount(item), 0);
  }, [incomeItems]);

  // 은퇴까지 총 소득 (상승률 반영, 월 단위 계산)
  const lifetimeIncome = useMemo(() => {
    let total = 0;
    incomeItems.forEach((item) => {
      // 일시적 소득은 한 번만 추가
      if (item.type === "onetime") {
        total += item.amount;
        return;
      }

      const months = getMonthsCount(item);
      // 연간 상승률을 월간으로 변환 (복리)
      const monthlyGrowthRate = Math.pow(1 + item.growthRate / 100, 1 / 12) - 1;
      // 월 소득으로 변환
      let monthlyAmount =
        item.frequency === "yearly" ? item.amount / 12 : item.amount;
      for (let i = 0; i < months; i++) {
        total += monthlyAmount;
        monthlyAmount *= 1 + monthlyGrowthRate;
      }
    });
    return Math.round(total);
  }, [incomeItems, selfRetirementYear, spouseRetirementYear]);

  // 소득 유형별 월 소득
  const incomeByType = useMemo(
    () => ({
      labor: laborItems.reduce((s, i) => s + toMonthlyAmount(i), 0),
      business: businessItems.reduce((s, i) => s + toMonthlyAmount(i), 0),
      regular: regularItems.reduce((s, i) => s + toMonthlyAmount(i), 0),
      onetime: onetimeItems.reduce((s, i) => s + i.amount, 0), // 일시적 소득은 총액
      rental: rentalItems.reduce((s, i) => s + toMonthlyAmount(i), 0),
      pension: pensionItems.reduce((s, i) => s + toMonthlyAmount(i), 0),
    }),
    [
      laborItems,
      businessItems,
      regularItems,
      onetimeItems,
      rentalItems,
      pensionItems,
    ]
  );

  // 차트 데이터 (연간 합계, 소득 유형별로 분리)
  const projectionData = useMemo(() => {
    const maxYear = Math.max(selfRetirementYear, spouseRetirementYear);
    const yearsUntilEnd = Math.max(0, maxYear - currentYear);
    const labels: string[] = [];
    const laborData: number[] = [];
    const businessData: number[] = [];
    const regularData: number[] = [];
    const onetimeData: number[] = [];
    const rentalData: number[] = [];
    const pensionData: number[] = [];

    for (let i = 0; i <= yearsUntilEnd; i++) {
      const year = currentYear + i;
      let laborTotal = 0;
      let businessTotal = 0;
      let regularTotal = 0;
      let onetimeTotal = 0;
      let rentalTotal = 0;
      let pensionTotal = 0;

      incomeItems.forEach((item) => {
        // 일시적 소득: 해당 연도/월에만 한 번 추가
        if (item.type === "onetime") {
          if (year === item.startYear) {
            onetimeTotal += item.amount;
          }
          return;
        }

        const end = getEndYearMonth(item);
        if (year >= item.startYear && year <= end.year) {
          const startM = year === item.startYear ? item.startMonth : 1;
          const endM = year === end.year ? end.month : 12;
          const monthsInYear = Math.max(0, endM - startM + 1);
          const yearsFromStart = year - item.startYear;
          // 월 금액으로 변환 후 상승률 적용
          const monthlyAmount =
            item.frequency === "yearly" ? item.amount / 12 : item.amount;
          const grownAmount =
            monthlyAmount * Math.pow(1 + item.growthRate / 100, yearsFromStart);
          const yearAmount = Math.round(grownAmount * monthsInYear);

          if (item.type === "labor") laborTotal += yearAmount;
          else if (item.type === "business") businessTotal += yearAmount;
          else if (item.type === "regular") regularTotal += yearAmount;
          else if (item.type === "rental") rentalTotal += yearAmount;
          else if (item.type === "pension") pensionTotal += yearAmount;
        }
      });

      labels.push(`${year}`);
      laborData.push(laborTotal);
      businessData.push(businessTotal);
      regularData.push(regularTotal);
      onetimeData.push(onetimeTotal);
      rentalData.push(rentalTotal);
      pensionData.push(pensionTotal);
    }

    return {
      labels,
      laborData,
      businessData,
      regularData,
      onetimeData,
      rentalData,
      pensionData,
    };
  }, [incomeItems, selfRetirementYear, spouseRetirementYear, currentYear]);

  // 차트에 표시할 데이터셋 (값이 있는 것만)
  const chartDatasets = useMemo(() => {
    const datasets = [];
    if (projectionData.laborData.some((v) => v > 0)) {
      datasets.push({
        label: "근로",
        data: projectionData.laborData,
        backgroundColor: "#007aff",
      });
    }
    if (projectionData.businessData.some((v) => v > 0)) {
      datasets.push({
        label: "사업",
        data: projectionData.businessData,
        backgroundColor: "#34c759",
      });
    }
    if (projectionData.regularData.some((v) => v > 0)) {
      datasets.push({
        label: "정기",
        data: projectionData.regularData,
        backgroundColor: "#ff9500",
      });
    }
    if (projectionData.onetimeData.some((v) => v > 0)) {
      datasets.push({
        label: "일시",
        data: projectionData.onetimeData,
        backgroundColor: "#af52de",
      });
    }
    if (projectionData.rentalData.some((v) => v > 0)) {
      datasets.push({
        label: "임대",
        data: projectionData.rentalData,
        backgroundColor: "#ff3b30",
      });
    }
    if (projectionData.pensionData.some((v) => v > 0)) {
      datasets.push({
        label: "연금",
        data: projectionData.pensionData,
        backgroundColor: "#5856d6",
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
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.06);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        pointer-events: none;
        position: absolute;
        transform: translate(-50%, 0);
        transition: all 0.15s ease;
        padding: 14px 18px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        min-width: 180px;
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
        grid: { color: "#f0f0f0" },
        ticks: {
          font: { size: 11 },
          callback: (value: number | string) => {
            const num = typeof value === "number" ? value : parseFloat(value);
            if (num >= 10000) return `${(num / 10000).toFixed(0)}억`;
            return `${num.toLocaleString()}만`;
          },
        },
      },
    },
  };

  // 항목 추가
  const handleAdd = () => {
    if (!addingType || !newAmount) return;

    const defaultLabel = newOwner === "self" ? "본인" : "배우자";
    const defaultEndType =
      newOwner === "self" ? "self-retirement" : "spouse-retirement";

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

    const newItem: IncomeItem = {
      id: Date.now().toString(),
      type: addingType,
      label: getDefaultLabel(),
      owner: newOwner,
      amount: parseFloat(newAmount),
      frequency: isOnetime ? "monthly" : newFrequency, // 일시적 소득은 frequency 무의미
      startYear: isOnetime ? newOnetimeYear : currentYear,
      startMonth: isOnetime ? newOnetimeMonth : currentMonth,
      endType: isOnetime ? "custom" : defaultEndType,
      endYear: isOnetime ? newOnetimeYear : null,
      endMonth: isOnetime ? newOnetimeMonth : null,
      growthRate: isOnetime ? 0 : DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
    };

    setIncomeItems((prev) => [...prev, newItem]);
    setAddingType(null);
    setNewOwner("self");
    setNewLabel("");
    setNewAmount("");
    setNewFrequency("monthly");
    setNewOnetimeYear(currentYear);
    setNewOnetimeMonth(currentMonth);
  };

  // 항목 삭제
  const handleDelete = (id: string) => {
    setIncomeItems((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditForm(null);
    }
  };

  // 편집 시작
  const startEdit = (item: IncomeItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
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

  // 편집 저장
  const saveEdit = () => {
    if (!editForm) return;
    const finalForm = isCustomRateMode
      ? {
          ...editForm,
          growthRate: customRateInput === "" ? 0 : parseFloat(customRateInput),
        }
      : editForm;
    setIncomeItems((prev) =>
      prev.map((item) => (item.id === finalForm.id ? finalForm : item))
    );
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

    const end = getEndYearMonth(item);
    const endStr = `${end.year}.${String(end.month).padStart(2, "0")}`;
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

  // 섹션 렌더링
  const renderSection = (
    title: string,
    type: IncomeType,
    items: IncomeItem[],
    placeholder: string,
    description?: string
  ) => (
    <div className={styles.incomeSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
      </div>
      {description && <p className={styles.sectionDesc}>{description}</p>}

      <div className={styles.itemList}>
        {items.map((item) => {
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
                        value={editForm.startYear}
                        onChange={(e) => {
                          const year = parseInt(e.target.value) || currentYear;
                          setEditForm({
                            ...editForm,
                            startYear: year,
                            endYear: year,
                          });
                        }}
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
                      value={editForm.startYear}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          startYear: parseInt(e.target.value) || currentYear,
                        })
                      }
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
                          value={editForm.endYear || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              endYear: parseInt(e.target.value) || null,
                            })
                          }
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

          // 읽기 모드
          return (
            <div key={item.id} className={styles.incomeItem}>
              <div className={styles.itemMain}>
                <span className={styles.itemLabel}>{item.label}</span>
                <span className={styles.itemAmount}>
                  {formatAmountWithFreq(item)}
                </span>
                <span className={styles.itemMeta}>
                  {item.type === "onetime"
                    ? formatPeriod(item)
                    : `${formatPeriod(item)} | 연 ${item.growthRate}% 상승`}
                </span>
              </div>
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
          );
        })}

        {/* 인라인 추가 폼 */}
        {addingType === type ? (
          <div className={styles.inlineAddForm}>
            {/* 첫 번째 줄: 항목명 + 본인/배우자 */}
            <div className={styles.addFormRow}>
              {(type === "regular" || type === "onetime") && (
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
              {type === "onetime" ? (
                <>
                  <div className={styles.inlineAmountGroup}>
                    <input
                      type="number"
                      className={styles.inlineAmountInput}
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="0"
                    />
                    <span className={styles.inlineUnit}>만원</span>
                  </div>
                  <div className={styles.inlineDateGroup}>
                    <input
                      type="number"
                      className={styles.editYearInput}
                      value={newOnetimeYear}
                      onChange={(e) =>
                        setNewOnetimeYear(
                          parseInt(e.target.value) || currentYear
                        )
                      }
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
                    placeholder="0"
                    autoFocus={type !== "regular"}
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
        ) : type === "rental" ? (
          <a href="#realEstate" className={styles.realEstateLink}>
            부동산 탭에서 임대 부동산 관리하기
          </a>
        ) : type === "pension" ? (
          <a href="#pension" className={styles.realEstateLink}>
            연금 탭에서 연금 소득 관리하기
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

  return (
    <div className={styles.container}>
      {/* 왼쪽: 소득 입력 */}
      <div className={styles.inputPanel}>
        {renderSection("근로 소득", "labor", laborItems, "본인/배우자")}
        {renderSection("사업 소득", "business", businessItems, "본인/배우자")}
        {renderSection(
          "정기적 소득",
          "regular",
          regularItems,
          "항목명",
          "연금외 정기지급금, 아르바이트, 용돈 등"
        )}
        {renderSection(
          "일시적 소득",
          "onetime",
          onetimeItems,
          "항목명",
          "상여금, 보너스, 증여, 상속, 퇴직금 등"
        )}
        {renderSection(
          "임대 소득",
          "rental",
          rentalItems,
          "항목명",
          "부동산 탭에서 등록한 임대 부동산의 소득이 표시됩니다"
        )}
        {renderSection(
          "연금 소득",
          "pension",
          pensionItems,
          "항목명",
          "연금 탭에서 등록한 연금 소득이 표시됩니다"
        )}

        <p className={styles.infoText}>
          배당, 이자 소득은 저축/투자 계좌에 자동으로 추가됩니다.
        </p>
      </div>

      {/* 오른쪽: 요약 */}
      <div className={styles.summaryPanel}>
        {monthlyIncome > 0 ? (
          <>
            {/* 총 소득 요약 */}
            <div className={styles.summaryCard}>
              <div className={styles.totalIncome}>
                <span className={styles.totalLabel}>월 총 소득</span>
                <span className={styles.totalValue}>
                  {formatMoney(monthlyIncome)}
                </span>
              </div>
              <div className={styles.subValues}>
                <div className={styles.subValueItem}>
                  <span className={styles.subLabel}>연 소득</span>
                  <span className={styles.subValue}>
                    {formatMoney(monthlyIncome * 12)}
                  </span>
                </div>
                <div className={styles.subValueItem}>
                  <span className={styles.subLabel}>은퇴까지 총 소득</span>
                  <span className={styles.subValue}>
                    {formatMoney(lifetimeIncome)}
                  </span>
                </div>
              </div>
              <div className={styles.retirementInfo}>
                <div className={styles.retirementItem}>
                  <span className={styles.retirementLabel}>본인 은퇴</span>
                  <span className={styles.retirementValue}>
                    {selfRetirementYear}년 ({retirementAge}세)
                  </span>
                </div>
                {hasSpouse && spouseCurrentAge !== null && (
                  <div className={styles.retirementItem}>
                    <span className={styles.retirementLabel}>배우자 은퇴</span>
                    <span className={styles.retirementValue}>
                      {spouseRetirementYear}년 ({spouseRetirementAge}세)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 소득 구성 */}
            <div className={styles.breakdownCard}>
              <h4 className={styles.cardTitle}>소득 구성</h4>
              <div className={styles.breakdownList}>
                {incomeByType.labor > 0 && (
                  <div className={styles.breakdownItem}>
                    <div className={styles.breakdownInfo}>
                      <span
                        className={styles.breakdownDot}
                        style={{ backgroundColor: "#007aff" }}
                      />
                      <span className={styles.breakdownLabel}>근로 소득</span>
                    </div>
                    <div className={styles.breakdownValues}>
                      <span className={styles.breakdownAmount}>
                        {formatMoney(incomeByType.labor)}/월
                      </span>
                      <span className={styles.breakdownPercent}>
                        {Math.round((incomeByType.labor / monthlyIncome) * 100)}
                        %
                      </span>
                    </div>
                  </div>
                )}
                {incomeByType.business > 0 && (
                  <div className={styles.breakdownItem}>
                    <div className={styles.breakdownInfo}>
                      <span
                        className={styles.breakdownDot}
                        style={{ backgroundColor: "#34c759" }}
                      />
                      <span className={styles.breakdownLabel}>사업 소득</span>
                    </div>
                    <div className={styles.breakdownValues}>
                      <span className={styles.breakdownAmount}>
                        {formatMoney(incomeByType.business)}/월
                      </span>
                      <span className={styles.breakdownPercent}>
                        {Math.round(
                          (incomeByType.business / monthlyIncome) * 100
                        )}
                        %
                      </span>
                    </div>
                  </div>
                )}
                {incomeByType.regular > 0 && (
                  <div className={styles.breakdownItem}>
                    <div className={styles.breakdownInfo}>
                      <span
                        className={styles.breakdownDot}
                        style={{ backgroundColor: "#ff9500" }}
                      />
                      <span className={styles.breakdownLabel}>정기적 소득</span>
                    </div>
                    <div className={styles.breakdownValues}>
                      <span className={styles.breakdownAmount}>
                        {formatMoney(incomeByType.regular)}/월
                      </span>
                      <span className={styles.breakdownPercent}>
                        {Math.round(
                          (incomeByType.regular / monthlyIncome) * 100
                        )}
                        %
                      </span>
                    </div>
                  </div>
                )}
                {incomeByType.onetime > 0 && (
                  <div className={styles.breakdownItem}>
                    <div className={styles.breakdownInfo}>
                      <span
                        className={styles.breakdownDot}
                        style={{ backgroundColor: "#af52de" }}
                      />
                      <span className={styles.breakdownLabel}>일시적 소득</span>
                    </div>
                    <div className={styles.breakdownValues}>
                      <span className={styles.breakdownAmount}>
                        {formatMoney(incomeByType.onetime)} (총액)
                      </span>
                    </div>
                  </div>
                )}
                {incomeByType.rental > 0 && (
                  <div className={styles.breakdownItem}>
                    <div className={styles.breakdownInfo}>
                      <span
                        className={styles.breakdownDot}
                        style={{ backgroundColor: "#ff3b30" }}
                      />
                      <span className={styles.breakdownLabel}>임대 소득</span>
                    </div>
                    <div className={styles.breakdownValues}>
                      <span className={styles.breakdownAmount}>
                        {formatMoney(incomeByType.rental)}/월
                      </span>
                      <span className={styles.breakdownPercent}>
                        {Math.round(
                          (incomeByType.rental / monthlyIncome) * 100
                        )}
                        %
                      </span>
                    </div>
                  </div>
                )}
                {incomeByType.pension > 0 && (
                  <div className={styles.breakdownItem}>
                    <div className={styles.breakdownInfo}>
                      <span
                        className={styles.breakdownDot}
                        style={{ backgroundColor: "#5856d6" }}
                      />
                      <span className={styles.breakdownLabel}>연금 소득</span>
                    </div>
                    <div className={styles.breakdownValues}>
                      <span className={styles.breakdownAmount}>
                        {formatMoney(incomeByType.pension)}/월
                      </span>
                      <span className={styles.breakdownPercent}>
                        {Math.round(
                          (incomeByType.pension / monthlyIncome) * 100
                        )}
                        %
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 소득 전망 차트 */}
            {projectionData.labels.length > 1 && (
              <div className={styles.chartCard}>
                <h4 className={styles.cardTitle}>연간 소득 전망</h4>
                <div className={styles.chartWrapper}>
                  <Bar data={barChartData} options={barChartOptions} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            <TrendingUp size={40} />
            <p>소득을 추가하면 분석 결과가 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
