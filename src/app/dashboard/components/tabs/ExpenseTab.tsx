"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, TrendingDown, Pencil, ChevronDown, ChevronUp, Info, CreditCard } from "lucide-react";
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
  DashboardExpenseItem,
  DashboardExpenseFrequency,
  GlobalSettings,
} from "@/types";
import { DEFAULT_GLOBAL_SETTINGS, getMedicalExpenseByAge, MEDICAL_EXPENSE_INFO, MEDICAL_EXPENSE_BY_AGE } from "@/types";
import { formatMoney, getDefaultRateCategory, getEffectiveRate } from "@/lib/utils";
import styles from "./ExpenseTab.module.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface ExpenseTabProps {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
  globalSettings: GlobalSettings;
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
type RepaymentType = '만기일시상환' | '원리금균등상환' | '원금균등상환' | '거치식상환';

// 상환방식별 월 상환액 계산
function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  maturityDate: string | null,
  repaymentType: RepaymentType = '원리금균등상환'
): number {
  if (!principal || !maturityDate) return 0;

  const monthlyRate = (annualRate || 0) / 100 / 12;
  const [year, month] = maturityDate.split('-').map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const totalMonths = (year - currentYear) * 12 + (month - currentMonth);
  if (totalMonths <= 0) return 0;

  switch (repaymentType) {
    case '만기일시상환':
      return Math.round(principal * monthlyRate);
    case '원리금균등상환': {
      if (monthlyRate === 0) return Math.round(principal / totalMonths);
      const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1);
      return Math.round(payment);
    }
    case '원금균등상환': {
      const monthlyPrincipal = principal / totalMonths;
      const avgInterest = (principal * monthlyRate * (totalMonths + 1)) / 2 / totalMonths;
      return Math.round(monthlyPrincipal + avgInterest);
    }
    case '거치식상환':
      return Math.round(principal * monthlyRate);
    default:
      return 0;
  }
}

export function ExpenseTab({ data, onUpdateData, globalSettings }: ExpenseTabProps) {
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
    item: ExpenseItem
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

  // 지출 항목 상태 (저장된 데이터 우선, 없으면 온보딩에서 마이그레이션)
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>(() => {
    // 저장된 expenseItems가 있으면 사용
    if (data.expenseItems && data.expenseItems.length > 0) {
      return data.expenseItems;
    }

    // 없으면 온보딩 데이터에서 마이그레이션
    const items: ExpenseItem[] = [];
    const month = new Date().getMonth() + 1;

    // 나이 계산 (마이그레이션용)
    const birthYear = data.birth_date
      ? new Date(data.birth_date).getFullYear()
      : currentYear - 35;
    const age = currentYear - birthYear;
    const retireAge = data.target_retirement_age || 60;
    const retireYear = currentYear + (retireAge - age);
    const age100Year = currentYear + (100 - age);

    // 생활비 -> 고정비로 마이그레이션
    if (data.livingExpenses && data.livingExpenses > 0) {
      const livingExpenseAmount = data.livingExpenses;
      const livingFrequency = data.livingExpensesFrequency || "monthly";

      // 현재 생활비 (은퇴 전까지)
      items.push({
        id: "fixed-living",
        type: "fixed",
        label: "생활비",
        amount: livingExpenseAmount,
        frequency: livingFrequency,
        startYear: currentYear,
        startMonth: month,
        endType: "self-retirement",
        endYear: null,
        endMonth: null,
        growthRate: DEFAULT_GLOBAL_SETTINGS.inflationRate,
        rateCategory: "inflation",
      });

      // 은퇴 후 생활비 자동 추가 (현재 생활비의 70%를 물가상승률 적용)
      const yearsUntilRetirement = retireYear - currentYear;
      if (yearsUntilRetirement > 0) {
        const monthlyAmount = livingFrequency === "yearly"
          ? livingExpenseAmount / 12
          : livingExpenseAmount;
        const inflationRate = DEFAULT_GLOBAL_SETTINGS.inflationRate; // 2.5%

        // 은퇴 시점의 생활비 (물가상승률 적용)
        const retirementAmount = monthlyAmount * Math.pow(1 + inflationRate / 100, yearsUntilRetirement);

        // 은퇴 후 생활비 = 70%
        const postRetirementAmount = Math.round(retirementAmount * 0.7);

        items.push({
          id: "fixed-retirement-living",
          type: "fixed",
          label: "은퇴 후 생활비",
          amount: postRetirementAmount,
          frequency: "monthly",
          startYear: retireYear + 1,
          startMonth: 1,
          endType: "custom",
          endYear: age100Year,
          endMonth: 12,
          growthRate: inflationRate,
          rateCategory: "inflation",
        });
      }
    }

    // 의료비 자동 생성 (나이대별)
    const ageKeys = Object.keys(MEDICAL_EXPENSE_BY_AGE).map(Number).sort((a, b) => a - b);

    // 본인 의료비
    for (let i = 0; i < ageKeys.length; i++) {
      const startAge = ageKeys[i];
      const endAge = i < ageKeys.length - 1 ? ageKeys[i + 1] - 1 : 100;
      const startYear = birthYear + startAge;
      const endYear = birthYear + endAge;

      // 이미 지난 기간은 스킵
      if (endYear < currentYear) continue;

      const amount = MEDICAL_EXPENSE_BY_AGE[startAge];
      items.push({
        id: `medical-self-${startAge}`,
        type: "medical",
        label: `본인 의료비 (${startAge}대)`,
        amount,
        frequency: "monthly",
        startYear: Math.max(startYear, currentYear),
        startMonth: 1,
        endType: "custom",
        endYear,
        endMonth: 12,
        growthRate: 3, // 의료비는 물가상승률보다 높게
        rateCategory: "inflation",
      });
    }

    // 배우자 의료비 (배우자가 있는 경우)
    if (data.spouse?.birth_date) {
      const spouseBirthYear = new Date(data.spouse.birth_date).getFullYear();

      for (let i = 0; i < ageKeys.length; i++) {
        const startAge = ageKeys[i];
        const endAge = i < ageKeys.length - 1 ? ageKeys[i + 1] - 1 : 100;
        const startYear = spouseBirthYear + startAge;
        const endYear = spouseBirthYear + endAge;

        if (endYear < currentYear) continue;

        const amount = MEDICAL_EXPENSE_BY_AGE[startAge];
        items.push({
          id: `medical-spouse-${startAge}`,
          type: "medical",
          label: `배우자 의료비 (${startAge}대)`,
          amount,
          frequency: "monthly",
          startYear: Math.max(startYear, currentYear),
          startMonth: 1,
          endType: "custom",
          endYear,
          endMonth: 12,
          growthRate: 3,
          rateCategory: "inflation",
        });
      }
    }

    return items;
  });

  // expenseItems 변경 시 DB에 저장
  useEffect(() => {
    onUpdateData({ expenseItems });
  }, [expenseItems]);

  // 시나리오 모드 적용된 표시용 데이터 (한 번만 계산!)
  const isPresetMode = globalSettings.scenarioMode !== "custom";

  // 기본값: 60개월 후 만기, 5% 금리
  const DEFAULT_LOAN_RATE = 5;
  const DEFAULT_LOAN_MONTHS = 60;

  // 기본 만기일 계산 (현재 + 60개월)
  const getDefaultMaturity = () => {
    const endMonth = ((currentMonth - 1 + DEFAULT_LOAN_MONTHS) % 12) + 1;
    const endYear = currentYear + Math.floor((currentMonth - 1 + DEFAULT_LOAN_MONTHS) / 12);
    return `${endYear}-${String(endMonth).padStart(2, '0')}`;
  };

  // 부채 기반 이자 비용 항목 생성 (동적 계산, 저장하지 않음)
  const debtExpenseItems = useMemo(() => {
    const items: ExpenseItem[] = [];
    const debts = data.debts || [];
    const defaultMaturity = getDefaultMaturity();

    // 1. 일반 부채 (신용대출, 기타 부채 등)
    debts.forEach(debt => {
      if (!debt.amount) return;
      const maturity = debt.maturity || defaultMaturity;
      const rate = debt.rate ?? DEFAULT_LOAN_RATE;
      const monthlyPayment = calculateMonthlyPayment(
        debt.amount,
        rate,
        maturity,
        (debt.repaymentType || '원리금균등상환') as RepaymentType
      );
      if (monthlyPayment > 0) {
        const [endYear, endMonth] = maturity.split('-').map(Number);
        items.push({
          id: `expense-debt-${debt.id}`,
          type: 'interest',
          label: `${debt.name} 상환`,
          amount: monthlyPayment,
          frequency: 'monthly',
          startYear: currentYear,
          startMonth: currentMonth,
          endType: 'custom',
          endYear,
          endMonth,
          growthRate: 0,
          rateCategory: 'fixed',
          sourceType: 'debt',
          sourceId: debt.id,
        });
      }
    });

    // 2. 주택담보대출
    if (data.housingHasLoan && data.housingLoan) {
      const maturity = data.housingLoanMaturity || defaultMaturity;
      const rate = data.housingLoanRate ?? DEFAULT_LOAN_RATE;
      const monthlyPayment = calculateMonthlyPayment(
        data.housingLoan,
        rate,
        maturity,
        (data.housingLoanType || '원리금균등상환') as RepaymentType
      );
      if (monthlyPayment > 0) {
        const [endYear, endMonth] = maturity.split('-').map(Number);
        items.push({
          id: 'expense-housing-loan',
          type: 'interest',
          label: '주택담보대출 상환',
          amount: monthlyPayment,
          frequency: 'monthly',
          startYear: currentYear,
          startMonth: currentMonth,
          endType: 'custom',
          endYear,
          endMonth,
          growthRate: 0,
          rateCategory: 'fixed',
          sourceType: 'debt',
          sourceId: 'housing',
        });
      }
    }

    // 3. 부동산 투자 대출
    const realEstateProperties = data.realEstateProperties || [];
    realEstateProperties.forEach(property => {
      if (property.hasLoan && property.loanAmount) {
        const maturity = property.loanMaturity || defaultMaturity;
        const rate = property.loanRate ?? DEFAULT_LOAN_RATE;
        const monthlyPayment = calculateMonthlyPayment(
          property.loanAmount,
          rate,
          maturity,
          (property.loanRepaymentType || '원리금균등상환') as RepaymentType
        );
        if (monthlyPayment > 0) {
          const [endYear, endMonth] = maturity.split('-').map(Number);
          items.push({
            id: `expense-realestate-${property.id}`,
            type: 'interest',
            label: `${property.name} 대출 상환`,
            amount: monthlyPayment,
            frequency: 'monthly',
            startYear: currentYear,
            startMonth: currentMonth,
            endType: 'custom',
            endYear,
            endMonth,
            growthRate: 0,
            rateCategory: 'fixed',
            sourceType: 'debt',
            sourceId: property.id,
          });
        }
      }
    });

    return items;
  }, [data.debts, data.housingHasLoan, data.housingLoan, data.housingLoanMaturity, data.housingLoanRate, data.housingLoanType, data.realEstateProperties, currentYear, currentMonth]);

  // 사용자 지출 + 부채 지출 합친 표시용 데이터
  const displayItems = useMemo(() => {
    const allItems = [...expenseItems, ...debtExpenseItems];
    return allItems.map((item) => {
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
  }, [expenseItems, debtExpenseItems, globalSettings]);

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
  const interestItems = displayItems.filter((i) => i.type === "interest");
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
    const endYear = item.endType === "self-retirement"
      ? selfRetirementYear
      : item.endType === "spouse-retirement"
        ? spouseRetirementYear
        : item.endYear || 9999;
    return currentYear >= item.startYear && currentYear <= endYear;
  };

  // 월 총 지출 (현재 연도에 해당하는 항목만)
  const monthlyExpense = useMemo(() => {
    return displayItems
      .filter((item) => isCurrentYearItem(item) && item.type !== "onetime")
      .reduce((sum, item) => sum + toMonthlyAmount(item), 0);
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
      const effectiveEndMonth = itemEnd.year <= selfRetirementYear ? itemEnd.month : 12;

      // 실제 개월 수 계산 (은퇴까지만)
      const months = (effectiveEndYear - item.startYear) * 12 + (effectiveEndMonth - item.startMonth);
      if (months <= 0) return;

      // displayGrowthRate 사용 (이미 시나리오 적용됨)
      const monthlyGrowthRate = Math.pow(1 + item.displayGrowthRate / 100, 1 / 12) - 1;
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
      fixed: fixedItems.filter(isCurrentYearItem).reduce((s, i) => s + toMonthlyAmount(i), 0),
      variable: variableItems.filter(isCurrentYearItem).reduce((s, i) => s + toMonthlyAmount(i), 0),
      onetime: onetimeItems.filter(isCurrentYearItem).reduce((s, i) => s + i.amount, 0),
      medical: currentMedicalItems.reduce((s, i) => s + toMonthlyAmount(i), 0),
      interest: interestItems.filter(isCurrentYearItem).reduce((s, i) => s + toMonthlyAmount(i), 0),
      housing: housingItems.filter(isCurrentYearItem).reduce((s, i) => s + toMonthlyAmount(i), 0),
    }),
    [fixedItems, variableItems, onetimeItems, currentMedicalItems, interestItems, housingItems, currentYear, selfRetirementYear, spouseRetirementYear]
  );

  // 차트 데이터 - 100세까지 표시
  const projectionData = useMemo(() => {
    // 본인/배우자 중 나중에 100세 되는 해까지
    const selfAge100Year = currentYear + (100 - currentAge);
    const spouseAge100Year = spouseCurrentAge !== null
      ? currentYear + (100 - spouseCurrentAge)
      : selfAge100Year;
    const maxYear = Math.max(selfAge100Year, spouseAge100Year);
    const yearsUntilEnd = Math.max(0, maxYear - currentYear);
    const labels: string[] = [];
    const fixedData: number[] = [];
    const variableData: number[] = [];
    const onetimeData: number[] = [];
    const medicalData: number[] = [];
    const interestData: number[] = [];
    const housingData: number[] = [];

    for (let i = 0; i <= yearsUntilEnd; i++) {
      const year = currentYear + i;
      let fixedTotal = 0;
      let variableTotal = 0;
      let onetimeTotal = 0;
      let medicalTotal = 0;
      let interestTotal = 0;
      let housingTotal = 0;

      displayItems.forEach((item) => {
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
          // displayGrowthRate 사용 (이미 시나리오 적용됨)
          const monthlyAmount =
            item.frequency === "yearly" ? item.amount / 12 : item.amount;
          const grownAmount =
            monthlyAmount * Math.pow(1 + item.displayGrowthRate / 100, yearsFromStart);
          const yearAmount = Math.round(grownAmount * monthsInYear);

          if (item.type === "fixed") fixedTotal += yearAmount;
          else if (item.type === "variable") variableTotal += yearAmount;
          else if (item.type === "medical") medicalTotal += yearAmount;
          else if (item.type === "interest") interestTotal += yearAmount;
          else if (item.type === "housing") housingTotal += yearAmount;
        }
      });

      labels.push(`${year}`);
      fixedData.push(fixedTotal);
      variableData.push(variableTotal);
      onetimeData.push(onetimeTotal);
      medicalData.push(medicalTotal);
      interestData.push(interestTotal);
      housingData.push(housingTotal);
    }

    return { labels, fixedData, variableData, onetimeData, medicalData, interestData, housingData };
  }, [displayItems, currentYear, currentAge, spouseCurrentAge, selfRetirementYear, spouseRetirementYear]);

  // 차트 데이터셋
  const chartDatasets = useMemo(() => {
    const datasets = [];
    if (projectionData.fixedData.some((v) => v > 0)) {
      datasets.push({
        label: "고정비",
        data: projectionData.fixedData,
        backgroundColor: "#ff3b30",
      });
    }
    if (projectionData.variableData.some((v) => v > 0)) {
      datasets.push({
        label: "변동비",
        data: projectionData.variableData,
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
    if (projectionData.medicalData.some((v) => v > 0)) {
      datasets.push({
        label: "의료비",
        data: projectionData.medicalData,
        backgroundColor: "#007aff",
      });
    }
    if (projectionData.interestData.some((v) => v > 0)) {
      datasets.push({
        label: "이자",
        data: projectionData.interestData,
        backgroundColor: "#5856d6",
      });
    }
    if (projectionData.housingData.some((v) => v > 0)) {
      datasets.push({
        label: "주거",
        data: projectionData.housingData,
        backgroundColor: "#34c759",
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

    const selfAgeAtYear = getAgeAtYear(yearNum, true);
    const spouseAgeAtYear = hasSpouse ? getAgeAtYear(yearNum, false) : null;
    const ageDisplay = spouseAgeAtYear !== null
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
      `
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

  // 나이대별 의료비 자동 생성
  const generateMedicalExpenses = () => {
    const newItems: ExpenseItem[] = [];
    const ageKeys = Object.keys(MEDICAL_EXPENSE_BY_AGE).map(Number).sort((a, b) => a - b);

    // 본인 의료비 생성
    const selfBirthYear = data.birth_date
      ? new Date(data.birth_date).getFullYear()
      : currentYear - 35;

    for (let i = 0; i < ageKeys.length; i++) {
      const startAge = ageKeys[i];
      const endAge = i < ageKeys.length - 1 ? ageKeys[i + 1] - 1 : 100;
      const startYear = selfBirthYear + startAge;
      const endYear = selfBirthYear + endAge;

      // 이미 지난 기간은 스킵, 현재 연도 이후만 생성
      if (endYear < currentYear) continue;

      const amount = MEDICAL_EXPENSE_BY_AGE[startAge];
      newItems.push({
        id: `medical-self-${startAge}-${Date.now()}`,
        type: "medical",
        label: `본인 의료비 (${startAge}대)`,
        amount,
        frequency: "monthly",
        startYear: Math.max(startYear, currentYear),
        startMonth: 1,
        endType: "custom",
        endYear,
        endMonth: 12,
        growthRate: 3, // 의료비는 물가상승률보다 높게
        rateCategory: "inflation",
      });
    }

    // 배우자 의료비 생성 (배우자가 있는 경우)
    if (data.spouse?.birth_date) {
      const spouseBirthYear = new Date(data.spouse.birth_date).getFullYear();

      for (let i = 0; i < ageKeys.length; i++) {
        const startAge = ageKeys[i];
        const endAge = i < ageKeys.length - 1 ? ageKeys[i + 1] - 1 : 100;
        const startYear = spouseBirthYear + startAge;
        const endYear = spouseBirthYear + endAge;

        if (endYear < currentYear) continue;

        const amount = MEDICAL_EXPENSE_BY_AGE[startAge];
        newItems.push({
          id: `medical-spouse-${startAge}-${Date.now()}`,
          type: "medical",
          label: `배우자 의료비 (${startAge}대)`,
          amount,
          frequency: "monthly",
          startYear: Math.max(startYear, currentYear),
          startMonth: 1,
          endType: "custom",
          endYear,
          endMonth: 12,
          growthRate: 3,
          rateCategory: "inflation",
        });
      }
    }

    // 기존 의료비 항목 제거 후 새로 추가
    const nonMedicalItems = expenseItems.filter((i) => i.type !== "medical");
    setExpenseItems([...nonMedicalItems, ...newItems]);
    setMedicalExpanded(true);
  };

  // 항목 추가
  const handleAdd = () => {
    if (!addingType || !newAmount) return;

    const isOnetime = addingType === "onetime";

    const newItem: ExpenseItem = {
      id: Date.now().toString(),
      type: addingType,
      label: newLabel || getDefaultLabel(addingType),
      amount: parseFloat(newAmount),
      frequency: isOnetime ? "monthly" : newFrequency,
      startYear: isOnetime ? newOnetimeYear : currentYear,
      startMonth: isOnetime ? newOnetimeMonth : currentMonth,
      endType: isOnetime ? "custom" : "self-retirement",
      endYear: isOnetime ? newOnetimeYear : null,
      endMonth: isOnetime ? newOnetimeMonth : null,
      growthRate: isOnetime ? 0 : DEFAULT_GLOBAL_SETTINGS.inflationRate,
      rateCategory: getDefaultRateCategory(addingType),
    };

    setExpenseItems((prev) => [...prev, newItem]);
    resetAddForm();
  };

  const getDefaultLabel = (type: ExpenseType): string => {
    switch (type) {
      case "fixed": return "고정 지출";
      case "variable": return "변동 지출";
      case "onetime": return "일시 지출";
      case "medical": return "의료비";
      default: return "지출";
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

  // 항목 삭제
  const handleDelete = (id: string) => {
    setExpenseItems((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditForm(null);
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

  // 편집 저장
  const saveEdit = () => {
    if (!editForm) return;
    const finalForm = isCustomRateMode
      ? {
          ...editForm,
          growthRate: customRateInput === "" ? 0 : parseFloat(customRateInput),
        }
      : editForm;
    setExpenseItems((prev) =>
      prev.map((item) => (item.id === finalForm.id ? finalForm : item))
    );
    cancelEdit();
  };

  // 기간 표시
  const formatPeriod = (item: ExpenseItem): string => {
    if (item.type === "onetime") {
      return `${item.startYear}.${String(item.startMonth).padStart(2, "0")} 지출 예정`;
    }

    const startStr = `${item.startYear}.${String(item.startMonth).padStart(2, "0")}`;

    if (item.endType === "self-retirement") return `${startStr} ~ 본인 은퇴`;
    if (item.endType === "spouse-retirement") return `${startStr} ~ 배우자 은퇴`;

    const end = getEndYearMonth(item);
    const endStr = `${end.year}.${String(end.month).padStart(2, "0")}`;
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
    description?: string
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
                          editForm.endType === "self-retirement" ? styles.active : ""
                        }`}
                        onClick={() =>
                          setEditForm({ ...editForm, endType: "self-retirement" })
                        }
                      >
                        본인 은퇴
                      </button>
                      {hasSpouse && (
                        <button
                          type="button"
                          className={`${styles.endTypeBtn} ${
                            editForm.endType === "spouse-retirement" ? styles.active : ""
                          }`}
                          onClick={() =>
                            setEditForm({ ...editForm, endType: "spouse-retirement" })
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
                          !isCustomRateMode && editForm.growthRate === preset.value
                            ? styles.active
                            : ""
                        }`}
                        onClick={() => {
                          setIsCustomRateMode(false);
                          setCustomRateInput("");
                          setEditForm({ ...editForm, growthRate: preset.value });
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
              <div className={styles.itemMain}>
                <span className={styles.itemLabel}>{item.label}</span>
                <span className={styles.itemAmount}>
                  {formatAmountWithFreq(item)}
                </span>
                <span className={styles.itemMeta}>
                  {item.type === "onetime"
                    ? formatPeriod(item)
                    : `${formatPeriod(item)} | 연 ${item.displayGrowthRate}% 상승${isPresetMode ? " (시나리오)" : ""}`}
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
                          Math.min(12, Math.max(1, parseInt(e.target.value) || 1))
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

  return (
    <div className={styles.container}>
      {/* 왼쪽: 지출 입력 */}
      <div className={styles.inputPanel}>
        {renderSection(
          "고정비",
          "fixed",
          fixedItems,
          "보험료, 통신비, 구독료 등 매월 고정적으로 나가는 지출"
        )}
        {renderSection(
          "변동비",
          "variable",
          variableItems,
          "식비, 교통비, 여가비 등 매월 변동되는 지출"
        )}
        {renderSection(
          "일회성 지출",
          "onetime",
          onetimeItems,
          "여행, 결혼, 차량구입, 이사 등 특정 시점의 큰 지출"
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
              {medicalExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
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
                              <span className={styles.editRowLabel}>항목명</span>
                              <input
                                type="text"
                                className={styles.editLabelInput}
                                value={editForm.label}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, label: e.target.value })
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
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                />
                                <span className={styles.editUnit}>만원</span>
                                <select
                                  className={styles.editSelect}
                                  value={editForm.frequency}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      frequency: e.target.value as ExpenseFrequency,
                                    })
                                  }
                                >
                                  <option value="monthly">월</option>
                                  <option value="yearly">년</option>
                                </select>
                              </div>
                            </div>
                            <div className={styles.editActions}>
                              <button className={styles.saveBtn} onClick={saveEdit}>
                                저장
                              </button>
                              <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>
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
                            {`${item.startYear}년 ~ ${item.endYear}년 | 연 ${item.displayGrowthRate}% 상승${isPresetMode ? " (시나리오)" : ""}`}
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
              {medicalItems.length}개 항목 (현재 적용: {currentMedicalItems.length}개), 월 {formatMoney(
                currentMedicalItems.reduce((sum, i) => sum + (i.frequency === "yearly" ? i.amount / 12 : i.amount), 0)
              )}
            </div>
          )}
        </div>
        {renderSection(
          "주거비",
          "housing",
          housingItems,
          "부동산 탭에서 등록한 월세, 관리비가 표시됩니다"
        )}
        {/* 이자 비용 섹션 - 부채에서 연동 */}
        <div className={styles.expenseSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>이자 비용</span>
          </div>
          <p className={styles.sectionDesc}>부채 탭에서 등록한 대출 상환금이 표시됩니다</p>

          <div className={styles.itemList}>
            {interestItems.map((item) => {
              const isLinked = item.sourceType === 'debt';
              const isEditing = editingId === item.id;

              // 연동된 항목은 읽기 전용
              if (isLinked) {
                return (
                  <div key={item.id} className={styles.expenseItem}>
                    <div className={styles.itemMain}>
                      <span className={styles.itemLabel}>{item.label}</span>
                      <span className={styles.itemAmount}>
                        {formatAmountWithFreq(item)}
                      </span>
                      <span className={styles.itemMeta}>
                        {formatPeriod(item)}
                      </span>
                    </div>
                    <div className={styles.linkedBadge}>
                      <CreditCard size={12} />
                      <span>부채</span>
                    </div>
                  </div>
                );
              }

              // 수동 입력 항목
              if (isEditing && editForm) {
                return (
                  <div key={item.id} className={styles.editItem}>
                    {/* 기존 편집 로직 */}
                  </div>
                );
              }
              return (
                <div key={item.id} className={styles.expenseItem}>
                  <div className={styles.itemMain}>
                    <span className={styles.itemLabel}>{item.label}</span>
                    <span className={styles.itemAmount}>
                      {formatAmountWithFreq(item)}
                    </span>
                    <span className={styles.itemMeta}>
                      {formatPeriod(item)} | 연 {item.displayGrowthRate}% 상승
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.editBtn} onClick={() => startEdit(item)}>
                      <Pencil size={16} />
                    </button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {interestItems.length === 0 && (
              <p className={styles.emptyText}>
                부채 탭에서 대출을 등록하면 월 상환금이 표시됩니다
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 오른쪽: 요약 */}
      <div className={styles.summaryPanel}>
        {monthlyExpense > 0 ? (
          <>
            <div className={styles.summaryCard}>
              <div className={styles.totalExpense}>
                <span className={styles.totalLabel}>월 총 지출</span>
                <span className={styles.totalValue}>
                  {formatMoney(monthlyExpense)}
                </span>
              </div>
              <div className={styles.subValues}>
                <div className={styles.subValueItem}>
                  <span className={styles.subLabel}>연 지출</span>
                  <span className={styles.subValue}>
                    {formatMoney(monthlyExpense * 12)}
                  </span>
                </div>
                <div className={styles.subValueItem}>
                  <span className={styles.subLabel}>은퇴까지 총 지출</span>
                  <span className={styles.subValue}>
                    {formatMoney(lifetimeExpense)}
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

            {/* 지출 전망 차트 */}
            {projectionData.labels.length > 1 && (
              <div className={styles.chartCard}>
                <h4 className={styles.cardTitle}>연간 지출 전망</h4>
                <div className={styles.chartWrapper}>
                  <Bar data={barChartData} options={barChartOptions} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            <TrendingDown size={40} />
            <p>지출을 추가하면 분석 결과가 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
