"use client";

import { useRef, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import styles from "./RetirementSimulationCharts.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

interface SimulationData {
  currentAge: number;
  targetRetirementAge: number;
  lifeExpectancy: number;
  // 현재 자산 (억원)
  realEstateAsset: number;
  depositAsset: number;
  cashAsset: number;
  investmentAsset: number;
  pensionAsset: number;
  // 현재 부채 (만원)
  totalDebt: number;
  // 현재 현금흐름 (만원/월)
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySavings: number;
  // 성장률
  realEstateGrowth?: number;
  financialGrowth?: number;
  pensionGrowth?: number;
  inflationRate?: number;
  // 연금 (만원/월)
  monthlyPension: number;
}

interface RetirementSimulationChartsProps {
  data: SimulationData;
}

function formatBillion(value: number): string {
  // 억+만원 형식으로 표시 (예: 14억 1,324만원)
  const absValue = Math.abs(value);
  const uk = Math.floor(absValue); // 억 단위
  const man = Math.round((absValue - uk) * 10000); // 만원 단위

  if (uk > 0 && man > 0) {
    return `${uk}억 ${man.toLocaleString()}만`;
  }
  if (uk > 0) {
    return `${uk}억`;
  }
  return `${man.toLocaleString()}만`;
}

function formatMoney(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 10000) {
    const uk = Math.floor(absValue / 10000);
    const man = Math.round(absValue % 10000);
    if (man === 0) return `${uk}억`;
    return `${uk}억 ${man.toLocaleString()}만`;
  }
  return `${absValue.toLocaleString()}만`;
}

export function RetirementSimulationCharts({ data }: RetirementSimulationChartsProps) {
  const assetChartRef = useRef<HTMLCanvasElement>(null);
  const cashFlowChartRef = useRef<HTMLCanvasElement>(null);
  const assetChartInstance = useRef<ChartJS | null>(null);
  const cashFlowChartInstance = useRef<ChartJS | null>(null);

  const currentYear = new Date().getFullYear();
  const retirementYear = currentYear + (data.targetRetirementAge - data.currentAge);
  const endYear = currentYear + (data.lifeExpectancy - data.currentAge);

  // 성장률 설정
  const realEstateGrowth = data.realEstateGrowth ?? 0.02;
  const financialGrowth = data.financialGrowth ?? 0.05;
  const pensionGrowth = data.pensionGrowth ?? 0.04;
  const inflationRate = data.inflationRate ?? 0.03;

  // 연도별 데이터 생성
  const years: number[] = [];
  const assetData: {
    year: number;
    age: number;
    realEstate: number;
    deposit: number;
    financial: number;
    pension: number;
    debt: number;
    netWorth: number;
  }[] = [];
  const cashFlowData: {
    year: number;
    age: number;
    income: number;
    expense: number;
    netCashFlow: number;
  }[] = [];

  // 초기값 (억원 단위)
  let realEstate = data.realEstateAsset;
  let deposit = data.depositAsset;
  let financial = data.cashAsset + data.investmentAsset;
  let pension = data.pensionAsset;
  let debt = data.totalDebt / 10000; // 만원 → 억원

  // 현재 현금흐름 (만원/월)
  const currentMonthlyIncome = data.monthlyIncome;
  const currentMonthlyExpense = data.monthlyExpense;
  const annualSavings = data.monthlySavings > 0 ? (data.monthlySavings * 12) / 10000 : 0;

  for (let year = currentYear; year <= endYear; year++) {
    const age = data.currentAge + (year - currentYear);
    const yearsFromNow = year - currentYear;
    const isRetired = age >= data.targetRetirementAge;

    years.push(year);

    // 자산 계산
    if (yearsFromNow === 0) {
      // 현재
      assetData.push({
        year,
        age,
        realEstate,
        deposit,
        financial,
        pension,
        debt,
        netWorth: realEstate + deposit + financial + pension - debt,
      });
    } else {
      // 미래 - 각 자산별 성장
      realEstate = realEstate * (1 + realEstateGrowth);
      // 보증금은 성장 없음
      if (!isRetired) {
        financial = financial * (1 + financialGrowth) + annualSavings;
        pension = pension * (1 + pensionGrowth);
      } else {
        // 은퇴 후에는 성장만, 저축 없음
        financial = financial * (1 + financialGrowth * 0.5); // 보수적 투자
        pension = pension * (1 + pensionGrowth * 0.5);
      }
      // 부채 상환 (은퇴 전까지 50% 상환 가정)
      if (!isRetired && debt > 0) {
        debt = debt * 0.95; // 매년 5%씩 상환
      }

      // 만원 단위까지 정밀하게 유지 (소수점 4자리 = 만원 단위)
      assetData.push({
        year,
        age,
        realEstate: Math.round(realEstate * 10000) / 10000,
        deposit: Math.round(deposit * 10000) / 10000,
        financial: Math.round(financial * 10000) / 10000,
        pension: Math.round(pension * 10000) / 10000,
        debt: Math.round(debt * 10000) / 10000,
        netWorth: Math.round((realEstate + deposit + financial + pension - debt) * 10000) / 10000,
      });
    }

    // 현금흐름 계산 (만원/월 → 만원/연)
    let yearlyIncome: number;
    let yearlyExpense: number;

    if (!isRetired) {
      // 은퇴 전: 근로소득 + 물가상승 반영 지출
      yearlyIncome = currentMonthlyIncome * 12 * Math.pow(1 + inflationRate * 0.5, yearsFromNow);
      yearlyExpense = currentMonthlyExpense * 12 * Math.pow(1 + inflationRate, yearsFromNow);
    } else {
      // 은퇴 후: 연금소득 + 물가상승 반영 지출 (70%)
      const pensionAtYear = data.monthlyPension * Math.pow(1 + inflationRate, yearsFromNow);
      yearlyIncome = pensionAtYear * 12;
      yearlyExpense = currentMonthlyExpense * 12 * Math.pow(1 + inflationRate, yearsFromNow) * 0.7;
    }

    cashFlowData.push({
      year,
      age,
      income: Math.round(yearlyIncome),
      expense: Math.round(yearlyExpense),
      netCashFlow: Math.round(yearlyIncome - yearlyExpense),
    });
  }

  // 자산 차트 렌더링
  useEffect(() => {
    if (!assetChartRef.current || assetData.length === 0) return;

    if (assetChartInstance.current) {
      assetChartInstance.current.destroy();
    }

    const ctx = assetChartRef.current.getContext("2d");
    if (!ctx) return;

    const labels = assetData.map((d) => d.year);
    const retirementIndex = labels.findIndex((y) => y === retirementYear);

    // Y축 범위 계산
    const maxAsset = Math.max(...assetData.map((d) => d.realEstate + d.deposit + d.financial + d.pension));
    const maxDebt = Math.max(...assetData.map((d) => d.debt));
    const maxValue = Math.max(maxAsset, maxDebt);
    const roundedMax = Math.ceil(maxValue / 5) * 5;

    assetChartInstance.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "부동산",
            data: assetData.map((d) => d.realEstate),
            backgroundColor: "rgba(26, 54, 93, 0.85)",
            stack: "networth",
            barPercentage: 0.7,
            categoryPercentage: 0.9,
          },
          {
            label: "보증금",
            data: assetData.map((d) => d.deposit),
            backgroundColor: "rgba(74, 85, 104, 0.85)",
            stack: "networth",
            barPercentage: 0.7,
            categoryPercentage: 0.9,
          },
          {
            label: "금융자산",
            data: assetData.map((d) => d.financial),
            backgroundColor: "rgba(49, 130, 206, 0.85)",
            stack: "networth",
            barPercentage: 0.7,
            categoryPercentage: 0.9,
          },
          {
            label: "연금자산",
            data: assetData.map((d) => d.pension),
            backgroundColor: "rgba(99, 179, 237, 0.85)",
            stack: "networth",
            barPercentage: 0.7,
            categoryPercentage: 0.9,
          },
          {
            label: "부채",
            data: assetData.map((d) => -d.debt),
            backgroundColor: "rgba(239, 68, 68, 0.75)",
            stack: "networth",
            barPercentage: 0.7,
            categoryPercentage: 0.9,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              padding: 12,
              font: { size: 10 },
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                const d = assetData[idx];
                return `${d.year}년 (${d.age}세)`;
              },
              label: (context) => {
                const value = context.raw as number;
                if (value === 0) return "";
                const label = context.dataset.label || "";
                const prefix = value < 0 ? "-" : "";
                return `${label}: ${prefix}${formatBillion(Math.abs(value))}`;
              },
              footer: (items) => {
                const idx = items[0].dataIndex;
                const d = assetData[idx];
                return `순자산: ${formatBillion(d.netWorth)}`;
              },
            },
          },
          annotation: {
            annotations: {
              currentLine: {
                type: "line",
                xMin: 0,
                xMax: 0,
                borderColor: "rgba(16, 185, 129, 0.8)",
                borderWidth: 2,
                label: {
                  display: true,
                  content: "현재",
                  position: "start",
                  backgroundColor: "rgba(16, 185, 129, 0.9)",
                  color: "white",
                  font: { size: 9, weight: "bold" },
                  padding: 3,
                },
              },
              retirementLine: {
                type: "line",
                xMin: retirementIndex,
                xMax: retirementIndex,
                borderColor: "rgba(148, 163, 184, 0.8)",
                borderWidth: 2,
                borderDash: [6, 4],
                label: {
                  display: true,
                  content: "은퇴",
                  position: "start",
                  backgroundColor: "rgba(100, 116, 139, 0.9)",
                  color: "white",
                  font: { size: 9, weight: "bold" },
                  padding: 3,
                },
              },
              zeroLine: {
                type: "line",
                yMin: 0,
                yMax: 0,
                borderColor: "rgba(100, 116, 139, 0.6)",
                borderWidth: 1,
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              font: { size: 9 },
              color: "#94a3b8",
              maxRotation: 0,
              callback: function (value, index) {
                const year = labels[index];
                if (year === currentYear || year === retirementYear || year === endYear || year % 10 === 0) {
                  return year;
                }
                return "";
              },
            },
          },
          y: {
            stacked: true,
            min: -Math.ceil(maxDebt / 5) * 5,
            max: roundedMax,
            grid: {
              color: "rgba(226, 232, 240, 0.5)",
            },
            ticks: {
              font: { size: 9 },
              color: "#94a3b8",
              callback: function (value) {
                const numValue = Number(value);
                if (numValue === 0) return "0";
                return formatBillion(numValue);
              },
            },
          },
        },
      },
    });

    return () => {
      if (assetChartInstance.current) {
        assetChartInstance.current.destroy();
      }
    };
  }, [assetData, retirementYear, endYear, currentYear]);

  // 현금흐름 차트 렌더링
  useEffect(() => {
    if (!cashFlowChartRef.current || cashFlowData.length === 0) return;

    if (cashFlowChartInstance.current) {
      cashFlowChartInstance.current.destroy();
    }

    const ctx = cashFlowChartRef.current.getContext("2d");
    if (!ctx) return;

    const labels = cashFlowData.map((d) => d.year);
    const retirementIndex = labels.findIndex((y) => y === retirementYear);

    // Y축 범위 계산
    const maxIncome = Math.max(...cashFlowData.map((d) => d.income));
    const maxExpense = Math.max(...cashFlowData.map((d) => d.expense));
    const maxValue = Math.max(maxIncome, maxExpense);
    const roundedMax = Math.ceil(maxValue / 1000) * 1000;

    cashFlowChartInstance.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "소득",
            data: cashFlowData.map((d) => d.income),
            backgroundColor: "rgba(16, 185, 129, 0.75)",
            stack: "cashflow",
            barPercentage: 0.7,
            categoryPercentage: 0.9,
          },
          {
            label: "지출",
            data: cashFlowData.map((d) => -d.expense),
            backgroundColor: "rgba(239, 68, 68, 0.75)",
            stack: "cashflow",
            barPercentage: 0.7,
            categoryPercentage: 0.9,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              padding: 12,
              font: { size: 10 },
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                const d = cashFlowData[idx];
                return `${d.year}년 (${d.age}세)`;
              },
              label: (context) => {
                const value = context.raw as number;
                if (value === 0) return "";
                const label = context.dataset.label || "";
                const prefix = value < 0 ? "-" : "+";
                return `${label}: ${prefix}${formatMoney(Math.abs(value))}`;
              },
              footer: (items) => {
                const idx = items[0].dataIndex;
                const d = cashFlowData[idx];
                const prefix = d.netCashFlow >= 0 ? "+" : "-";
                return `순현금흐름: ${prefix}${formatMoney(Math.abs(d.netCashFlow))}`;
              },
            },
          },
          annotation: {
            annotations: {
              currentLine: {
                type: "line",
                xMin: 0,
                xMax: 0,
                borderColor: "rgba(16, 185, 129, 0.8)",
                borderWidth: 2,
                label: {
                  display: true,
                  content: "현재",
                  position: "start",
                  backgroundColor: "rgba(16, 185, 129, 0.9)",
                  color: "white",
                  font: { size: 9, weight: "bold" },
                  padding: 3,
                },
              },
              retirementLine: {
                type: "line",
                xMin: retirementIndex,
                xMax: retirementIndex,
                borderColor: "rgba(148, 163, 184, 0.8)",
                borderWidth: 2,
                borderDash: [6, 4],
                label: {
                  display: true,
                  content: "은퇴",
                  position: "start",
                  backgroundColor: "rgba(100, 116, 139, 0.9)",
                  color: "white",
                  font: { size: 9, weight: "bold" },
                  padding: 3,
                },
              },
              zeroLine: {
                type: "line",
                yMin: 0,
                yMax: 0,
                borderColor: "rgba(100, 116, 139, 0.6)",
                borderWidth: 1,
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              font: { size: 9 },
              color: "#94a3b8",
              maxRotation: 0,
              callback: function (value, index) {
                const year = labels[index];
                if (year === currentYear || year === retirementYear || year === endYear || year % 10 === 0) {
                  return year;
                }
                return "";
              },
            },
          },
          y: {
            stacked: true,
            min: -roundedMax,
            max: roundedMax,
            grid: {
              color: "rgba(226, 232, 240, 0.5)",
            },
            ticks: {
              font: { size: 9 },
              color: "#94a3b8",
              callback: function (value) {
                const numValue = Number(value);
                if (numValue === 0) return "0";
                const prefix = numValue > 0 ? "+" : "";
                return `${prefix}${formatMoney(numValue)}`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (cashFlowChartInstance.current) {
        cashFlowChartInstance.current.destroy();
      }
    };
  }, [cashFlowData, retirementYear, endYear, currentYear]);

  return (
    <div className={styles.container}>
      <div className={styles.chartSection}>
        <h4 className={styles.chartTitle}>자산 시뮬레이션</h4>
        <p className={styles.chartSubtitle}>현재부터 {data.lifeExpectancy}세까지 자산 변화 예측</p>
        <div className={styles.chartWrapper}>
          <canvas ref={assetChartRef} />
        </div>
      </div>

      <div className={styles.chartSection}>
        <h4 className={styles.chartTitle}>현금흐름 시뮬레이션</h4>
        <p className={styles.chartSubtitle}>연간 소득과 지출 변화 예측</p>
        <div className={styles.chartWrapper}>
          <canvas ref={cashFlowChartRef} />
        </div>
      </div>
    </div>
  );
}
