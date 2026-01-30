"use client";

import { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";
import {
  DiagnosisData,
  FixedExpenseItem,
  CalculationParams,
  DEFAULT_CALC_PARAMS,
  calculateAllDiagnosisMetrics,
  calculateAdditionalCosts,
} from "@/lib/services/diagnosisDataService";
import { formatMoney } from "@/lib/utils";
import {
  householdFinance2025,
  type AgeGroup,
  estimatePercentiles,
} from "@/lib/data/householdFinance2025";
import styles from "../mobile-report.module.css";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  annotationPlugin,
);

interface ReportTabsProps {
  data: DiagnosisData;
  opinion: string;
}

// 마크다운 파서
function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\n/g, "<br />");
}

// 억원 포맷
function formatBillion(value: number): string {
  const fixed = value.toFixed(2);
  return parseFloat(fixed).toString();
}

// PMT 계산 (연금 월 수령액): 잔액을 n개월 동안 r% 수익률로 매월 동일 금액 인출
function calculatePMT(
  balance: number,
  years: number,
  annualRate: number = 0.04,
): number {
  if (balance <= 0 || years <= 0) return 0;
  const months = years * 12;
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) return Math.round(balance / months);
  const factor = Math.pow(1 + monthlyRate, months);
  return Math.round((balance * monthlyRate * factor) / (factor - 1));
}

type TabId = "current" | "retirement" | "opinion";

export function ReportTabs({ data, opinion }: ReportTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("current");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [activeSheet, setActiveSheet] = useState<"cost" | "assumption" | null>(
    null,
  );

  // 계산 파라미터 상태
  const [calcParams, setCalcParams] = useState<CalculationParams>({
    ...DEFAULT_CALC_PARAMS,
    lifeExpectancy: data.lifeExpectancy,
  });

  // 비용 옵션 선택 상태
  const [costOptions, setCostOptions] = useState({
    education: "normal" as "normal" | "premium" | "none",
    leisure: 1 as number | "none",
    consumerGoods: 1 as number | "none",
    medical: true as boolean,
    housing: null as { areaIndex: number; tierIndex: number } | null,
  });

  // 스크롤 방향 감지 (settingsBar 숨김용)
  const [isSettingsBarHidden, setIsSettingsBarHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;

      // 스크롤 내림 (10px 이상 움직임)
      if (scrollDelta > 10 && currentScrollY > 120) {
        setIsSettingsBarHidden(true);
      }
      // 스크롤 올림 (10px 이상 움직임)
      else if (scrollDelta < -10) {
        setIsSettingsBarHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // 탭 변경 시 스크롤 맨 위로
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const m = calculateAllDiagnosisMetrics(data, calcParams);

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // 동연령대 가계 비교
  const getAgeGroup = (age: number): AgeGroup => {
    if (age < 30) return "29세이하";
    if (age < 40) return "30대";
    if (age < 50) return "40대";
    if (age < 60) return "50대";
    if (age < 65) return "60대";
    return "65세이상";
  };
  const ageGroup = getAgeGroup(data.currentAge);
  const ageStats = householdFinance2025[ageGroup];

  // Lycon Score 계산
  const calcPrecisePercentile = (
    value: number,
    percentiles: ReturnType<typeof estimatePercentiles>,
  ) => {
    const thresholds = [
      { p: 95, v: percentiles.p90 * 1.2 },
      { p: 90, v: percentiles.p90 },
      { p: 80, v: percentiles.p80 },
      { p: 70, v: percentiles.p70 },
      { p: 60, v: percentiles.p60 },
      { p: 50, v: (percentiles.p40 + percentiles.p60) / 2 },
      { p: 40, v: percentiles.p40 },
      { p: 30, v: percentiles.p30 },
      { p: 20, v: percentiles.p20 },
      { p: 10, v: percentiles.p20 * 0.5 },
      { p: 0, v: 0 },
    ];
    for (let i = 0; i < thresholds.length - 1; i++) {
      if (value >= thresholds[i].v) {
        const range = thresholds[i].p - (thresholds[i + 1]?.p || 0);
        const valueRange = thresholds[i].v - thresholds[i + 1].v;
        const position =
          valueRange > 0 ? (value - thresholds[i + 1].v) / valueRange : 1;
        return Math.min(100, thresholds[i + 1].p + range * position);
      }
    }
    return 5;
  };

  const annualIncome = data.monthlyIncome * 12;
  const incomePercentiles = estimatePercentiles(ageStats.income.median);
  const assetPercentilesData = estimatePercentiles(ageStats.asset.median);
  const netWorthPercentilesData = estimatePercentiles(ageStats.netWorth.median);
  const debtPercentilesData = estimatePercentiles(ageStats.debt.median);

  const incomeScore = calcPrecisePercentile(annualIncome, incomePercentiles);
  const assetScore = calcPrecisePercentile(
    m.totalAsset * 10000,
    assetPercentilesData,
  );
  const netWorthScore = calcPrecisePercentile(
    m.netWorth * 10000,
    netWorthPercentilesData,
  );

  const debtRatio = data.monthlyIncome > 0 ? m.totalDebt / annualIncome : 0;
  const debtScore = m.totalDebt === 0 ? 100 : Math.max(0, 100 - debtRatio * 25);
  const savingsRateScore = Math.min(100, m.savingsRate * 2.5);

  const lyconScore = Math.round(
    netWorthScore * 0.3 +
      savingsRateScore * 0.25 +
      debtScore * 0.2 +
      incomeScore * 0.15 +
      assetScore * 0.1,
  );

  const getLyconGrade = (score: number) => {
    if (score >= 90) return { grade: "S", label: "최상위", color: "#059669" };
    if (score >= 80) return { grade: "A", label: "우수", color: "#0284c7" };
    if (score >= 70) return { grade: "B", label: "양호", color: "#2563eb" };
    if (score >= 60) return { grade: "C", label: "보통", color: "#7c3aed" };
    if (score >= 50) return { grade: "D", label: "주의", color: "#ea580c" };
    return { grade: "F", label: "개선필요", color: "#dc2626" };
  };
  const lyconGrade = getLyconGrade(lyconScore);

  // 퍼센타일 범위
  const getPercentileRange = (
    value: number,
    percentiles: ReturnType<typeof estimatePercentiles>,
    median: number,
  ) => {
    if (value >= percentiles.p90) return { idx: 0, display: "상위 10%" };
    if (value >= percentiles.p80) return { idx: 1, display: "상위 20%" };
    if (value >= percentiles.p70) return { idx: 2, display: "상위 30%" };
    if (value >= percentiles.p60) return { idx: 3, display: "상위 40%" };
    if (value >= median) return { idx: 4, display: "상위 50%" };
    if (value >= percentiles.p40) return { idx: 5, display: "상위 60%" };
    if (value >= percentiles.p30) return { idx: 6, display: "상위 70%" };
    if (value >= percentiles.p20) return { idx: 7, display: "상위 80%" };
    return { idx: 8, display: "상위 90%" };
  };
  const incomePercentile = getPercentileRange(
    annualIncome,
    incomePercentiles,
    ageStats.income.median,
  );
  const netWorthPercentile = getPercentileRange(
    m.netWorth * 10000,
    netWorthPercentilesData,
    ageStats.netWorth.median,
  );
  const assetPercentile = getPercentileRange(
    m.totalAsset * 10000,
    assetPercentilesData,
    ageStats.asset.median,
  );

  const getDebtLevel = (
    value: number,
    percentiles: ReturnType<typeof estimatePercentiles>,
    median: number,
  ) => {
    if (value === 0) return { idx: 0, display: "무부채" };
    if (value <= percentiles.p20) return { idx: 1, display: "최소" };
    if (value <= percentiles.p40) return { idx: 3, display: "양호" };
    if (value <= percentiles.p60) return { idx: 5, display: "평균" };
    if (value <= percentiles.p80) return { idx: 7, display: "주의" };
    return { idx: 9, display: "높음" };
  };
  const debtPercentile = getDebtLevel(
    m.totalDebt,
    debtPercentilesData,
    ageStats.debt.median,
  );

  // 고정비/변동비 색상
  const expenseColors: Record<string, string> = {
    food: "#1a365d",
    transport: "#2c5282",
    shopping: "#3182ce",
    leisure: "#63b3ed",
    otherExpense: "#bee3f8",
  };
  const fixedExpenseColors: Record<string, string> = {
    housing: "#744210",
    education: "#975a16",
    insurance: "#b7791f",
    loan: "#d69e2e",
    other: "#ecc94b",
  };
  const FIXED_EXPENSE_LABELS: Record<string, string> = {
    housing: "주거비",
    education: "교육비",
    insurance: "보험료",
    loan: "대출상환",
    other: "기타",
  };

  // 고정비 항목
  const fixedExpenseItemsWithInterest: FixedExpenseItem[] = [
    ...data.fixedExpenseItems,
  ];
  if (m.monthlyInterest > 0) {
    fixedExpenseItemsWithInterest.push({
      type: "loan",
      title: "대출이자",
      amount: m.monthlyInterest,
    });
  }
  const fixedExpenseItemsForChart = fixedExpenseItemsWithInterest.map(
    (item, idx) => ({
      ...item,
      key: `${item.type}-${idx}`,
      label: item.title || FIXED_EXPENSE_LABELS[item.type] || item.type,
      ratio:
        m.fixedExpense > 0
          ? Math.round((item.amount / m.fixedExpense) * 100)
          : 0,
      color: fixedExpenseColors[item.type] || fixedExpenseColors.other,
    }),
  );

  // 변동비 항목
  const foodRatio =
    m.variableExpense > 0
      ? Math.round((data.expenseFood / m.variableExpense) * 100)
      : 0;
  const transportRatio =
    m.variableExpense > 0
      ? Math.round((data.expenseTransport / m.variableExpense) * 100)
      : 0;
  const shoppingRatio =
    m.variableExpense > 0
      ? Math.round((data.expenseShopping / m.variableExpense) * 100)
      : 0;
  const leisureRatio =
    m.variableExpense > 0
      ? Math.round((data.expenseLeisure / m.variableExpense) * 100)
      : 0;
  const otherExpenseRatio =
    m.variableExpense > 0
      ? Math.round((data.expenseOther / m.variableExpense) * 100)
      : 0;
  const expenseItems = [
    { key: "food", label: "식비", amount: data.expenseFood, ratio: foodRatio },
    {
      key: "transport",
      label: "교통비",
      amount: data.expenseTransport,
      ratio: transportRatio,
    },
    {
      key: "shopping",
      label: "쇼핑/미용",
      amount: data.expenseShopping,
      ratio: shoppingRatio,
    },
    {
      key: "leisure",
      label: "유흥/여가",
      amount: data.expenseLeisure,
      ratio: leisureRatio,
    },
    {
      key: "otherExpense",
      label: "기타",
      amount: data.expenseOther,
      ratio: otherExpenseRatio,
    },
  ].filter((item) => item.amount > 0);

  // 요약 탭 상태
  const getNetWorthStatus = () => {
    if (netWorthPercentile.idx <= 3)
      return { status: "good", label: netWorthPercentile.display };
    if (netWorthPercentile.idx <= 5)
      return { status: "caution", label: netWorthPercentile.display };
    return { status: "warning", label: netWorthPercentile.display };
  };
  const netWorthStatus = getNetWorthStatus();

  const getPensionStatus = () => {
    if (m.pensionCoverageRate >= 80) return { status: "good", label: "양호" };
    if (m.pensionCoverageRate >= 50)
      return { status: "caution", label: "주의" };
    return { status: "warning", label: "위험" };
  };
  const pensionStatus = getPensionStatus();

  const getSustainabilityStatus = () => {
    if (m.yearsOfWithdrawal >= m.retirementYears)
      return { status: "good", label: "양호", value: "충분" };
    if (m.yearsOfWithdrawal >= m.retirementYears * 0.7)
      return {
        status: "caution",
        label: "주의",
        value: `${Math.round(m.yearsOfWithdrawal)}년`,
      };
    return {
      status: "warning",
      label: "위험",
      value: `${Math.round(m.yearsOfWithdrawal)}년`,
    };
  };
  const sustainabilityStatus = getSustainabilityStatus();

  // 퍼센타일 트랙 렌더링
  const renderPercentileTrack = (
    indicatorIdx: number,
    reversed: boolean = false,
  ) => (
    <div
      className={
        reversed ? styles.percentileTrackReversed : styles.percentileTrack
      }
    >
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
        <div key={idx} className={styles.percentileSegment}>
          {idx === 9 - indicatorIdx && (
            <div className={styles.percentileIndicator} />
          )}
        </div>
      ))}
    </div>
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "current", label: "자산 현황" },
    { id: "retirement", label: "은퇴 진단" },
    { id: "opinion", label: "종합소견" },
  ];

  return (
    <div className={styles.tabsContainer}>
      <nav className={styles.tabNav}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ""}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 필요 자금 탭 설정 바 */}
      {activeTab === "retirement" && (
        <div
          className={`${styles.settingsBar} ${isSettingsBarHidden ? styles.settingsBarHidden : ""}`}
        >
          <button
            className={styles.settingsBarBtn}
            onClick={() => setActiveSheet("cost")}
          >
            비용 변경
          </button>
          <button
            className={styles.settingsBarBtn}
            onClick={() => setActiveSheet("assumption")}
          >
            가정 변경
          </button>
        </div>
      )}

      <div className={styles.tabContent}>
        {/* ===== 자산 현황 탭 ===== */}
        {activeTab === "current" && (
          <>
            {/* 순자산 히어로 카드 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>OVERVIEW</span>
                <span className={styles.stepTitle}>현재 재무 상태</span>
              </div>
              <div className={styles.stepMainResult}>
                <div className={styles.stepMainValue}>
                  {formatBillion(m.netWorth)}억
                </div>
                <div className={styles.stepMainLabel}>
                  순자산 (총자산 - 총부채)
                </div>
              </div>
              <div className={styles.currentSummaryRow}>
                <div className={styles.currentSummaryItem}>
                  <span className={styles.currentSummaryLabel}>총자산</span>
                  <span className={styles.currentSummaryValue}>
                    {formatBillion(m.totalAsset)}억
                  </span>
                </div>
                <div className={styles.currentSummaryDivider}>-</div>
                <div className={styles.currentSummaryItem}>
                  <span className={styles.currentSummaryLabel}>총부채</span>
                  <span
                    className={`${styles.currentSummaryValue} ${styles.negative}`}
                  >
                    {formatBillion(m.totalDebt / 10000)}억
                  </span>
                </div>
                <div className={styles.currentSummaryDivider}>=</div>
                <div className={styles.currentSummaryItem}>
                  <span className={styles.currentSummaryLabel}>순자산</span>
                  <span className={styles.currentSummaryValue}>
                    {formatBillion(m.netWorth)}억
                  </span>
                </div>
              </div>
            </div>

            {/* 월 현금흐름 히어로 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>CASHFLOW</span>
                <span className={styles.stepTitle}>월 현금흐름</span>
              </div>
              <div className={styles.stepMainResult}>
                <div
                  className={`${styles.stepMainValue} ${m.currentMonthlyGap >= 0 ? styles.positive : styles.negative}`}
                >
                  {m.currentMonthlyGap >= 0 ? "+" : ""}
                  {m.currentMonthlyGap}만원
                </div>
                <div className={styles.stepMainLabel}>
                  월 현금흐름 (소득 - 지출)
                </div>
              </div>
              <div className={styles.cashflowChartContainer}>
                <Bar
                  data={{
                    labels: ["월 소득", "월 지출", "저축/투자 여력"],
                    datasets: [
                      {
                        data: [
                          data.monthlyIncome,
                          m.currentMonthlyExpense,
                          Math.abs(m.currentMonthlyGap),
                        ],
                        backgroundColor: [
                          "#3182ce",
                          "#e53e3e",
                          m.currentMonthlyGap >= 0 ? "#38a169" : "#e53e3e",
                        ],
                        borderRadius: 6,
                        barThickness: 40,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `${ctx.raw?.toLocaleString()}만원`,
                        },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (v) => `${v}만`,
                        },
                      },
                      x: {
                        grid: { display: false },
                      },
                    },
                  }}
                />
              </div>
              <div className={styles.stepDetails}>
                <div className={styles.stepDetailRow}>
                  <span className={styles.stepDetailLabel}>월 소득</span>
                  <span className={styles.stepDetailValue}>
                    {data.monthlyIncome.toLocaleString()}만원
                  </span>
                </div>
                <div className={styles.stepDetailRow}>
                  <span className={styles.stepDetailLabel}>월 지출</span>
                  <span className={styles.stepDetailValue}>
                    {m.currentMonthlyExpense.toLocaleString()}만원
                  </span>
                </div>
                <div className={styles.stepDetailRow}>
                  <span className={styles.stepDetailLabel}>저축률</span>
                  <span className={styles.stepDetailValue}>
                    {Math.round(m.savingsRate)}%
                  </span>
                </div>
              </div>
            </div>

            {/* 지출 구성 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>EXPENSE</span>
                <span className={styles.stepTitle}>지출 구성</span>
              </div>
              <div className={styles.stepMainResult}>
                <div className={styles.stepMainValue}>
                  {m.currentMonthlyExpense}만원
                </div>
                <div className={styles.stepMainLabel}>월 지출</div>
              </div>

              <div className={styles.expenseCompareContainer}>
                <Bar
                  data={{
                    labels: ["고정비", "변동비"],
                    datasets: [
                      ...fixedExpenseItemsForChart.map((item) => ({
                        label: item.label,
                        data: [item.amount, 0],
                        backgroundColor: item.color,
                        stack: "stack0",
                        barThickness: 32,
                      })),
                      ...expenseItems.map((item) => ({
                        label: item.label,
                        data: [0, item.amount],
                        backgroundColor: expenseColors[item.key],
                        stack: "stack0",
                        barThickness: 32,
                      })),
                    ],
                  }}
                  options={{
                    indexAxis: "y" as const,
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) =>
                            `${ctx.dataset.label}: ${(ctx.raw as number)?.toLocaleString()}만원`,
                        },
                      },
                    },
                    scales: {
                      x: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: { callback: (v) => `${v}만` },
                      },
                      y: {
                        stacked: true,
                        grid: { display: false },
                      },
                    },
                  }}
                />
              </div>

              {/* 고정비 상세 */}
              <div className={styles.expenseSection}>
                <div className={styles.expenseSectionHeader}>
                  <span className={styles.expenseSectionTitle}>
                    <span
                      className={styles.expenseSectionDot}
                      style={{ background: "#b7791f" }}
                    ></span>
                    고정비
                  </span>
                  <span className={styles.expenseSectionAmount}>
                    {m.fixedExpense}만원
                  </span>
                </div>
                <p className={styles.expenseSectionDesc}>
                  매달 일정하게 나가는 비용
                </p>
                {fixedExpenseItemsForChart.length > 0 ? (
                  <div className={styles.expenseItemsGrid}>
                    {fixedExpenseItemsForChart
                      .sort((a, b) => b.amount - a.amount)
                      .map((item) => (
                        <div key={item.key} className={styles.expenseItemCard}>
                          <span
                            className={styles.expenseItemDot}
                            style={{ backgroundColor: item.color }}
                          ></span>
                          <span className={styles.expenseItemName}>
                            {item.label}
                          </span>
                          <span className={styles.expenseItemValue}>
                            {item.amount}만원
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className={styles.noExpenseMessage}>없음</div>
                )}
              </div>

              {/* 변동비 상세 */}
              <div className={styles.expenseSection}>
                <div className={styles.expenseSectionHeader}>
                  <span className={styles.expenseSectionTitle}>
                    <span
                      className={styles.expenseSectionDot}
                      style={{ background: "#2c5282" }}
                    ></span>
                    변동비
                  </span>
                  <span className={styles.expenseSectionAmount}>
                    {m.variableExpense}만원
                  </span>
                </div>
                <p className={styles.expenseSectionDesc}>
                  생활 패턴에 따라 달라지는 비용
                </p>
                {expenseItems.length > 0 ? (
                  <div className={styles.expenseItemsGrid}>
                    {expenseItems
                      .sort((a, b) => b.amount - a.amount)
                      .map((item) => (
                        <div key={item.key} className={styles.expenseItemCard}>
                          <span
                            className={styles.expenseItemDot}
                            style={{ backgroundColor: expenseColors[item.key] }}
                          ></span>
                          <span className={styles.expenseItemName}>
                            {item.label}
                          </span>
                          <span className={styles.expenseItemValue}>
                            {item.amount}만원
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className={styles.noExpenseMessage}>없음</div>
                )}
              </div>
            </div>

            {/* 자산 구성 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>ASSET</span>
                <span className={styles.stepTitle}>자산 구성</span>
              </div>
              <div className={styles.stepMainResult}>
                <div className={styles.stepMainValue}>
                  {formatBillion(m.totalAsset)}억
                </div>
                <div className={styles.stepMainLabel}>총자산</div>
              </div>

              {/* 개별 자산 항목 차트 */}
              {data.assetItems.length > 0 &&
                (() => {
                  const totalAmount = data.assetItems.reduce(
                    (sum, item) => sum + item.amount,
                    0,
                  );
                  const itemsWithRatio = data.assetItems
                    .filter((item) => item.amount > 0)
                    .map((item) => ({
                      ...item,
                      ratio:
                        totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0,
                    }))
                    .sort((a, b) => b.amount - a.amount);
                  return (
                    <div className={styles.chartWithLegend}>
                      <div className={styles.doughnutChartContainer}>
                        <Doughnut
                          data={{
                            labels: itemsWithRatio.map((item) => item.label),
                            datasets: [
                              {
                                data: itemsWithRatio.map((item) =>
                                  Math.round(item.ratio),
                                ),
                                backgroundColor: itemsWithRatio.map(
                                  (item) => item.color,
                                ),
                                borderWidth: 0,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            cutout: "60%",
                            plugins: {
                              legend: { display: false },
                              tooltip: {
                                callbacks: {
                                  label: (ctx) => `${ctx.label}: ${ctx.raw}%`,
                                },
                              },
                            },
                          }}
                        />
                      </div>
                      <div className={styles.chartLegend}>
                        {itemsWithRatio.map((item) => (
                          <div key={item.key} className={styles.legendItem}>
                            <span
                              className={styles.legendDot}
                              style={{ backgroundColor: item.color }}
                            ></span>
                            <span className={styles.legendLabel}>
                              {item.label}
                            </span>
                            <span className={styles.legendValue}>
                              {formatBillion(item.amount)}억
                            </span>
                            <span className={styles.legendPercent}>
                              {Math.round(item.ratio)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
            </div>

            {/* 부채 구성 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>DEBT</span>
                <span className={styles.stepTitle}>부채 구성</span>
              </div>
              {m.totalDebt === 0 ? (
                <div className={styles.stepMainResult}>
                  <div className={`${styles.stepMainValue} ${styles.positive}`}>
                    0억
                  </div>
                  <div className={styles.stepMainLabel}>부채 없음</div>
                </div>
              ) : (
                <>
                  <div className={styles.stepMainResult}>
                    <div
                      className={`${styles.stepMainValue} ${styles.negative}`}
                    >
                      {formatBillion(m.totalDebt / 10000)}억
                    </div>
                    <div className={styles.stepMainLabel}>
                      총부채 (월 이자 {m.monthlyInterest}만원)
                    </div>
                  </div>

                  <div className={styles.chartWithLegend}>
                    <div className={styles.doughnutChartContainer}>
                      <Doughnut
                        data={{
                          labels: ["주담대", "신용", "기타"].filter(
                            (_, i) =>
                              [
                                m.mortgageRatio,
                                m.creditRatio,
                                m.otherDebtRatio,
                              ][i] > 0,
                          ),
                          datasets: [
                            {
                              data: [
                                m.mortgageRatio,
                                m.creditRatio,
                                m.otherDebtRatio,
                              ].filter((v) => v > 0),
                              backgroundColor: [
                                "#1a365d",
                                "#c53030",
                                "#d69e2e",
                              ].filter(
                                (_, i) =>
                                  [
                                    m.mortgageRatio,
                                    m.creditRatio,
                                    m.otherDebtRatio,
                                  ][i] > 0,
                              ),
                              borderWidth: 0,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          cutout: "60%",
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (ctx) => `${ctx.label}: ${ctx.raw}%`,
                              },
                            },
                          },
                        }}
                      />
                    </div>
                    <div className={styles.chartLegend}>
                      {[
                        {
                          key: "mortgage",
                          label: "주담대",
                          amount: data.mortgageAmount,
                          ratio: m.mortgageRatio,
                          rate: data.mortgageRate,
                          color: "#1a365d",
                        },
                        {
                          key: "credit",
                          label: "신용",
                          amount: data.creditLoanAmount,
                          ratio: m.creditRatio,
                          rate: data.creditLoanRate,
                          color: "#c53030",
                        },
                        {
                          key: "other",
                          label: "기타",
                          amount: data.otherDebtAmount,
                          ratio: m.otherDebtRatio,
                          rate: data.otherDebtRate,
                          color: "#d69e2e",
                        },
                      ]
                        .filter((item) => item.amount > 0)
                        .sort((a, b) => b.amount - a.amount)
                        .map((item) => (
                          <div key={item.key} className={styles.legendItem}>
                            <span
                              className={styles.legendDot}
                              style={{ backgroundColor: item.color }}
                            ></span>
                            <span className={styles.legendLabel}>
                              {item.label}
                            </span>
                            <span className={styles.legendValue}>
                              {formatBillion(item.amount / 10000)}억
                            </span>
                            <span className={styles.legendRate}>
                              {item.rate}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 3층 연금 현황 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>PENSION</span>
                <span className={styles.stepTitle}>3층 연금 현황</span>
              </div>
              <div className={styles.pensionTowerNew}>
                {/* 3층: 개인연금 + ISA */}
                <div className={styles.pensionFloorNew}>
                  <div className={styles.pensionFloorHeader}>
                    <span
                      className={styles.pensionFloorBadge}
                      style={{ background: "#805ad5" }}
                    >
                      3층
                    </span>
                    <span className={styles.pensionFloorTitle}>
                      개인연금 + ISA
                    </span>
                  </div>
                  <div className={styles.pensionProductsGrid}>
                    <div
                      className={`${styles.pensionProductNew} ${data.personalPensionStatus.irp.enrolled ? styles.active : styles.inactive}`}
                    >
                      <span className={styles.pensionProductName}>IRP</span>
                      <span className={styles.pensionProductValue}>
                        {data.personalPensionStatus.irp.enrolled
                          ? formatMoney(data.personalPensionStatus.irp.balance)
                          : "미가입"}
                      </span>
                    </div>
                    <div
                      className={`${styles.pensionProductNew} ${data.personalPensionStatus.pensionSavings.enrolled ? styles.active : styles.inactive}`}
                    >
                      <span className={styles.pensionProductName}>
                        연금저축
                      </span>
                      <span className={styles.pensionProductValue}>
                        {data.personalPensionStatus.pensionSavings.enrolled
                          ? formatMoney(
                              data.personalPensionStatus.pensionSavings.balance,
                            )
                          : "미가입"}
                      </span>
                    </div>
                    <div
                      className={`${styles.pensionProductNew} ${data.personalPensionStatus.isa.enrolled ? styles.active : styles.inactive}`}
                    >
                      <span className={styles.pensionProductName}>ISA</span>
                      <span className={styles.pensionProductValue}>
                        {data.personalPensionStatus.isa.enrolled
                          ? formatMoney(data.personalPensionStatus.isa.balance)
                          : "미가입"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2층: 퇴직연금 */}
                <div className={styles.pensionFloorNew}>
                  <div className={styles.pensionFloorHeader}>
                    <span
                      className={styles.pensionFloorBadge}
                      style={{ background: "#3182ce" }}
                    >
                      2층
                    </span>
                    <span className={styles.pensionFloorTitle}>퇴직연금</span>
                  </div>
                  <div className={styles.pensionFloorValue}>
                    {formatMoney(
                      data.retirementPensionBalanceSelf +
                        data.retirementPensionBalanceSpouse,
                    )}
                  </div>
                  <div className={styles.pensionFloorDesc}>현재 잔액</div>
                  <div className={styles.pensionFloorSub}>
                    {(() => {
                      // 기준 수익률 (5%)로 계산된 값을 선택한 수익률로 재조정
                      const baseRate = 0.05;
                      const selectedRate = calcParams.financialGrowthRate || 0.05;
                      const baseProjected =
                        data.retirementPensionBalanceAtRetireSelf +
                        data.retirementPensionBalanceAtRetireSpouse;

                      // 수익률 변경에 따른 비례 조정
                      // (1 + selectedRate)^years / (1 + baseRate)^years
                      const rateAdjustment =
                        Math.pow(1 + selectedRate, m.yearsToRetirement) /
                        Math.pow(1 + baseRate, m.yearsToRetirement);
                      const projectedBalance = Math.round(
                        baseProjected * rateAdjustment,
                      );
                      return (
                        <>은퇴시 예상: 약 {formatMoney(projectedBalance)}</>
                      );
                    })()}
                  </div>
                </div>

                {/* 1층: 국민연금 */}
                <div className={styles.pensionFloorNew}>
                  <div className={styles.pensionFloorHeader}>
                    <span
                      className={styles.pensionFloorBadge}
                      style={{ background: "#38a169" }}
                    >
                      1층
                    </span>
                    <span className={styles.pensionFloorTitle}>국민연금</span>
                  </div>
                  {(() => {
                    const currentValuePension =
                      data.nationalPensionPersonal + data.nationalPensionSpouse;
                    const yearsTo65 = Math.max(0, 65 - data.currentAge);
                    const inflationRate = 0.025;
                    const nominalPension = Math.round(
                      currentValuePension *
                        Math.pow(1 + inflationRate, yearsTo65),
                    );
                    return (
                      <>
                        <div className={styles.pensionFloorValue}>
                          {currentValuePension}만원/월
                        </div>
                        <div className={styles.pensionFloorDesc}>
                          현재가치 기준
                        </div>
                        <div className={styles.pensionFloorSub}>
                          65세 예상: 약 {nominalPension}만원/월
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* 동연령대 통계 비교 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>Statistics</span>
                <span className={styles.stepTitle}>동연령대 가계 비교</span>
              </div>
              <div className={styles.stepMainResult}>
                <div className={styles.stepMainValue}>
                  {netWorthPercentile.display}
                </div>
                <div className={styles.stepMainLabel}>
                  {ageGroup} 순자산 기준
                </div>
              </div>
              <div className={styles.statisticsList}>
                <div className={styles.statisticsRow}>
                  <span className={styles.statisticsLabel}>연소득</span>
                  <div className={styles.statisticsTrackWrapper}>
                    {renderPercentileTrack(incomePercentile.idx)}
                    <div className={styles.statisticsTrackLabels}>
                      <span>하위</span>
                      <span>상위</span>
                    </div>
                  </div>
                  <span className={styles.statisticsValue}>
                    {incomePercentile.display}
                  </span>
                </div>
                <div className={styles.statisticsRow}>
                  <span className={styles.statisticsLabel}>총자산</span>
                  <div className={styles.statisticsTrackWrapper}>
                    {renderPercentileTrack(assetPercentile.idx)}
                    <div className={styles.statisticsTrackLabels}>
                      <span>하위</span>
                      <span>상위</span>
                    </div>
                  </div>
                  <span className={styles.statisticsValue}>
                    {assetPercentile.display}
                  </span>
                </div>
                <div className={styles.statisticsRow}>
                  <span className={styles.statisticsLabel}>순자산</span>
                  <div className={styles.statisticsTrackWrapper}>
                    {renderPercentileTrack(netWorthPercentile.idx)}
                    <div className={styles.statisticsTrackLabels}>
                      <span>하위</span>
                      <span>상위</span>
                    </div>
                  </div>
                  <span className={styles.statisticsValue}>
                    {netWorthPercentile.display}
                  </span>
                </div>
                <div className={styles.statisticsRow}>
                  <span className={styles.statisticsLabel}>부채</span>
                  <div className={styles.statisticsTrackWrapper}>
                    {renderPercentileTrack(debtPercentile.idx, true)}
                    <div className={styles.statisticsTrackLabels}>
                      <span>많음</span>
                      <span>없음</span>
                    </div>
                  </div>
                  <span className={styles.statisticsValue}>
                    {debtPercentile.display}
                  </span>
                </div>
              </div>
              <div className={styles.statisticsSource}>
                통계청 가계금융복지조사 2024 기준
              </div>
            </div>

            {/* Lycon Score */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>Score</span>
                <span className={styles.stepTitle}>Lycon 재무점수</span>
              </div>
              <div className={styles.stepMainResult}>
                <div className={styles.stepMainValue}>
                  {lyconScore}
                  <span className={styles.stepMainUnit}>점</span>
                </div>
                <div className={styles.stepMainLabel}>
                  동연령대 상위 {100 - lyconScore}% ({lyconGrade.label})
                </div>
              </div>
              <div className={styles.lyconScoreContainer}>
                <div className={styles.lyconScoreBar}>
                  <div
                    className={styles.lyconScoreBarFill}
                    style={{ width: `${lyconScore}%` }}
                  ></div>
                  <div
                    className={styles.lyconScoreBarIndicator}
                    style={{ left: `${lyconScore}%` }}
                  ></div>
                </div>
                <div className={styles.lyconScoreBarLabels}>
                  <span>하위</span>
                  <span>상위</span>
                </div>
                <div className={styles.lyconScoreBreakdown}>
                  <div className={styles.lyconScoreItem}>
                    <span className={styles.lyconScoreItemLabel}>순자산</span>
                    <div className={styles.lyconScoreItemBar}>
                      <div
                        className={styles.lyconScoreItemFill}
                        style={{ width: `${netWorthScore}%` }}
                      ></div>
                    </div>
                    <span className={styles.lyconScoreItemValue}>
                      {Math.round(netWorthScore)}
                    </span>
                  </div>
                  <div className={styles.lyconScoreItem}>
                    <span className={styles.lyconScoreItemLabel}>저축률</span>
                    <div className={styles.lyconScoreItemBar}>
                      <div
                        className={styles.lyconScoreItemFill}
                        style={{ width: `${savingsRateScore}%` }}
                      ></div>
                    </div>
                    <span className={styles.lyconScoreItemValue}>
                      {Math.round(savingsRateScore)}
                    </span>
                  </div>
                  <div className={styles.lyconScoreItem}>
                    <span className={styles.lyconScoreItemLabel}>
                      부채건전성
                    </span>
                    <div className={styles.lyconScoreItemBar}>
                      <div
                        className={styles.lyconScoreItemFill}
                        style={{ width: `${debtScore}%` }}
                      ></div>
                    </div>
                    <span className={styles.lyconScoreItemValue}>
                      {Math.round(debtScore)}
                    </span>
                  </div>
                  <div className={styles.lyconScoreItem}>
                    <span className={styles.lyconScoreItemLabel}>소득</span>
                    <div className={styles.lyconScoreItemBar}>
                      <div
                        className={styles.lyconScoreItemFill}
                        style={{ width: `${incomeScore}%` }}
                      ></div>
                    </div>
                    <span className={styles.lyconScoreItemValue}>
                      {Math.round(incomeScore)}
                    </span>
                  </div>
                  <div className={styles.lyconScoreItem}>
                    <span className={styles.lyconScoreItemLabel}>총자산</span>
                    <div className={styles.lyconScoreItemBar}>
                      <div
                        className={styles.lyconScoreItemFill}
                        style={{ width: `${assetScore}%` }}
                      ></div>
                    </div>
                    <span className={styles.lyconScoreItemValue}>
                      {Math.round(assetScore)}
                    </span>
                  </div>
                </div>
                <div className={styles.lyconScoreSource}>
                  Lycon 데이터 기반 ({ageGroup})
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===== 필요 자금 탭 ===== */}
        {activeTab === "retirement" && (
          <>
            {(() => {
              const additionalCosts = calculateAdditionalCosts(
                data,
                calcParams,
              );

              const educationCost =
                costOptions.education === "none"
                  ? 0
                  : costOptions.education === "normal"
                    ? additionalCosts.childEducation.grandTotalNormal
                    : additionalCosts.childEducation.grandTotalPremium;
              const leisureCost =
                costOptions.leisure === "none"
                  ? 0
                  : (additionalCosts.leisure[costOptions.leisure as number]
                      ?.totalUntilRetirement || 0) +
                    (additionalCosts.leisure[costOptions.leisure as number]
                      ?.totalAfterRetirement || 0);
              const consumerGoodsCost =
                costOptions.consumerGoods === "none"
                  ? 0
                  : additionalCosts.consumerGoods[
                      costOptions.consumerGoods as number
                    ]?.totalUntilLifeExpectancy || 0;
              const medicalCost = costOptions.medical
                ? additionalCosts.medical.grandTotal
                : 0;
              const housingCost = costOptions.housing
                ? additionalCosts.housing[costOptions.housing.areaIndex]?.tiers[
                    costOptions.housing.tierIndex
                  ]?.price || 0
                : 0;

              const additionalCostTotal =
                educationCost +
                medicalCost +
                leisureCost +
                consumerGoodsCost +
                housingCost;
              const totalRetirementNeed =
                m.lifetimeLivingCost + additionalCostTotal / 10000;

              const currentYear = new Date().getFullYear();
              const retirementYear = currentYear + m.yearsToRetirement;
              const effectiveRetirementAge = m.effectiveRetirementAge;

              return (
                <>
                  {/* 은퇴 목표 요약 */}
                  <div className={styles.retirementGoalCard}>
                    <div className={styles.retirementGoalItem}>
                      <div
                        className={`${styles.retirementGoalValue} ${styles.animatedValue}`}
                      >
                        {m.effectiveRetirementAge}세
                      </div>
                      <div className={styles.retirementGoalLabel}>
                        은퇴 나이
                      </div>
                    </div>
                    <div className={styles.retirementGoalDivider}></div>
                    <div className={styles.retirementGoalItem}>
                      <div
                        className={`${styles.retirementGoalValue} ${styles.animatedValue}`}
                      >
                        {retirementYear}년
                      </div>
                      <div className={styles.retirementGoalLabel}>
                        은퇴 예정
                      </div>
                    </div>
                    <div className={styles.retirementGoalDivider}></div>
                    <div className={styles.retirementGoalItem}>
                      <div
                        className={`${styles.retirementGoalValue} ${styles.animatedValue}`}
                      >
                        {m.yearsToRetirement}년
                      </div>
                      <div className={styles.retirementGoalLabel}>
                        남은 기간
                      </div>
                    </div>
                  </div>

                  {/* 은퇴 시점 월 현금흐름 분석 */}
                  {(() => {
                    // 은퇴 시점 예상 연금/자산 잔액
                    const retirementPensionAtRetire =
                      data.retirementPensionBalanceAtRetireSelf +
                      data.retirementPensionBalanceAtRetireSpouse;
                    const personalPensionAtRetire =
                      (data.personalPensionStatus.irp.balance +
                        data.personalPensionStatus.pensionSavings.balance) *
                      Math.pow(1 + 0.05, m.yearsToRetirement);

                    // PMT 계산
                    const retirementPensionPMT = calculatePMT(
                      retirementPensionAtRetire,
                      m.retirementYears,
                      0.04,
                    );
                    const personalPensionPMT = calculatePMT(
                      personalPensionAtRetire,
                      m.retirementYears,
                      0.04,
                    );

                    // 월 수입/지출
                    const monthlyIncomeTotal =
                      m.nationalPensionInflated +
                      retirementPensionPMT +
                      personalPensionPMT;
                    const monthlyExpenseTotal = m.monthlyExpense;
                    const monthlyCashflow =
                      monthlyIncomeTotal - monthlyExpenseTotal;
                    const maxValue = Math.max(
                      monthlyIncomeTotal,
                      monthlyExpenseTotal,
                    );

                    // 현재 가치로 환산 (물가상승률 역산)
                    const presentValueCashflow = Math.round(
                      monthlyCashflow /
                        Math.pow(
                          1 + calcParams.inflationRate,
                          m.yearsToRetirement,
                        ),
                    );

                    return (
                      <div className={styles.stepCard}>
                        <div className={styles.stepHeader}>
                          <span className={styles.stepNumber}>Cashflow</span>
                          <span className={styles.stepTitle}>
                            은퇴 시점 월 현금흐름
                          </span>
                        </div>

                        <div className={styles.cashflowChart}>
                          <div className={styles.cashflowRow}>
                            <span className={styles.cashflowLabel}>
                              월 수입
                            </span>
                            <div className={styles.cashflowBarContainer}>
                              <div
                                className={styles.cashflowBarIncome}
                                style={{
                                  width: `${maxValue > 0 ? (monthlyIncomeTotal / maxValue) * 100 : 0}%`,
                                }}
                              >
                                <span className={styles.cashflowBarValue}>
                                  {monthlyIncomeTotal.toLocaleString()}만원
                                </span>
                              </div>
                              {monthlyCashflow < 0 && (
                                <div
                                  className={styles.cashflowBarDeficit}
                                  style={{
                                    width: `${maxValue > 0 ? (Math.abs(monthlyCashflow) / maxValue) * 100 : 0}%`,
                                  }}
                                >
                                  <span className={styles.cashflowBarValue}>
                                    {monthlyCashflow.toLocaleString()}만원
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className={styles.cashflowRow}>
                            <span className={styles.cashflowLabel}>
                              월 지출
                            </span>
                            <div className={styles.cashflowBarContainer}>
                              <div
                                className={styles.cashflowBarExpense}
                                style={{
                                  width: `${maxValue > 0 ? (monthlyExpenseTotal / maxValue) * 100 : 0}%`,
                                }}
                              >
                                <span className={styles.cashflowBarValue}>
                                  {monthlyExpenseTotal.toLocaleString()}만원
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={styles.stepCalcBox}>
                          <div className={styles.stepCalcRow}>
                            <span>
                              국민연금{" "}
                              <span className={styles.stepCalcNote}>
                                물가상승 반영
                              </span>
                            </span>
                            <span>
                              +{m.nationalPensionInflated.toLocaleString()}만원
                            </span>
                          </div>
                          <div className={styles.stepCalcRow}>
                            <span>
                              퇴직연금{" "}
                              <span className={styles.stepCalcNote}>
                                {m.retirementYears}년간 나눠서 인출 가정
                              </span>
                            </span>
                            <span>
                              +{retirementPensionPMT.toLocaleString()}만원
                            </span>
                          </div>
                          <div className={styles.stepCalcRow}>
                            <span>
                              개인연금{" "}
                              <span className={styles.stepCalcNote}>
                                {m.retirementYears}년간 나눠서 인출 가정
                              </span>
                            </span>
                            <span>
                              +{personalPensionPMT.toLocaleString()}만원
                            </span>
                          </div>
                          <div className={styles.stepCalcDivider} />
                          <div className={styles.stepCalcRow}>
                            <span>
                              생활비{" "}
                              <span className={styles.stepCalcNote}>
                                물가상승 x {calcParams.livingExpenseRatio * 100}
                                %
                              </span>
                            </span>
                            <span>
                              -{monthlyExpenseTotal.toLocaleString()}만원
                            </span>
                          </div>
                          <div className={styles.stepCalcDivider} />
                          <div className={styles.stepCalcTotal}>
                            <span>월 현금흐름</span>
                            <span
                              style={{
                                color:
                                  monthlyCashflow >= 0 ? "#16a34a" : "#dc2626",
                              }}
                            >
                              {monthlyCashflow >= 0 ? "+" : ""}
                              {monthlyCashflow.toLocaleString()}만원
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 현재 가치 환산 Step */}
                  {(() => {
                    // 다시 계산 (IIFE 밖이라서)
                    const retirementPensionAtRetire =
                      data.retirementPensionBalanceAtRetireSelf +
                      data.retirementPensionBalanceAtRetireSpouse;
                    const personalPensionAtRetire =
                      (data.personalPensionStatus.irp.balance +
                        data.personalPensionStatus.pensionSavings.balance) *
                      Math.pow(1 + 0.05, m.yearsToRetirement);
                    const retirementPensionPMT = calculatePMT(
                      retirementPensionAtRetire,
                      m.retirementYears,
                      0.04,
                    );
                    const personalPensionPMT = calculatePMT(
                      personalPensionAtRetire,
                      m.retirementYears,
                      0.04,
                    );
                    const monthlyIncomeTotal =
                      m.nationalPensionInflated +
                      retirementPensionPMT +
                      personalPensionPMT;
                    const monthlyExpenseTotal = m.monthlyExpense;
                    const monthlyCashflow =
                      monthlyIncomeTotal - monthlyExpenseTotal;
                    const presentValueCashflow = Math.round(
                      monthlyCashflow /
                        Math.pow(
                          1 + calcParams.inflationRate,
                          m.yearsToRetirement,
                        ),
                    );

                    // 부족분 채우기 위한 필요 자산 계산 (현재 가치 기준, 연간 환산 후 억원 변환)
                    const annualDeficit = Math.abs(presentValueCashflow) * 12; // 만원/년
                    const needRealEstate =
                      Math.round((annualDeficit / 0.03 / 10000) * 10) / 10; // 억원
                    const needCash =
                      Math.round((annualDeficit / 0.02 / 10000) * 10) / 10; // 억원
                    const needStocks =
                      Math.round((annualDeficit / 0.04 / 10000) * 10) / 10; // 억원
                    const needAssets =
                      Math.round((annualDeficit / 0.4 / 10000) * 10) / 10; // 억원

                    const isDeficit = presentValueCashflow < 0;
                    const currentYear = new Date().getFullYear();
                    const retirementYear = currentYear + m.yearsToRetirement;

                    // 바 차트용 비율 계산
                    const maxAmount = Math.abs(monthlyCashflow);
                    const presentRatio =
                      (Math.abs(presentValueCashflow) / maxAmount) * 100;

                    // 개인연금 필요액 (연 5% 수익률, 은퇴까지 적립)
                    const yearsToRetire = m.yearsToRetirement;
                    const monthlyContribForPension =
                      yearsToRetire > 0
                        ? Math.round(
                            (annualDeficit / 0.05 / 10000 / yearsToRetire) *
                              12 *
                              10,
                          ) / 10
                        : 0;
                    const needPension =
                      Math.round((annualDeficit / 0.05 / 10000) * 10) / 10; // 억원

                    // 배당주 필요액 (연 4% 배당)
                    const needDividend =
                      Math.round((annualDeficit / 0.04 / 10000) * 10) / 10; // 억원

                    return (
                      <>
                        {/* Step: 지금 기준 환산 */}
                        <div className={styles.stepCard}>
                          <div className={styles.stepHeader}>
                            <span className={styles.stepNumber}>Now</span>
                            <span className={styles.stepTitle}>
                              지금 기준 환산
                            </span>
                          </div>

                          {isDeficit ? (
                            <>
                              {/* 현재 가치 크게 표시 */}
                              <div className={styles.goalMainValue}>
                                <span className={styles.goalMainLabel}>
                                  현재 가치로
                                </span>
                                <span className={styles.goalMainAmount}>
                                  월{" "}
                                  {Math.abs(
                                    presentValueCashflow,
                                  ).toLocaleString()}
                                  만원
                                </span>
                                <span className={styles.goalMainSub}>
                                  의 현금흐름이 필요합니다
                                </span>
                              </div>

                              {/* 설명 */}
                              <div className={styles.goalExplanation}>
                                <div className={styles.goalExplanationRow}>
                                  <span>은퇴 시점 부족분</span>
                                  <span>
                                    월{" "}
                                    {Math.abs(monthlyCashflow).toLocaleString()}
                                    만원
                                  </span>
                                </div>
                                <div className={styles.goalExplanationRow}>
                                  <span>현재 가치 환산</span>
                                  <span>
                                    월{" "}
                                    {Math.abs(
                                      presentValueCashflow,
                                    ).toLocaleString()}
                                    만원
                                  </span>
                                </div>
                                <div className={styles.goalExplanationNote}>
                                  {m.yearsToRetirement}년간 물가상승률{" "}
                                  {calcParams.inflationRate * 100}% 역산
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* 흑자: 현재 가치 여유분 표시 */}
                              <div className={styles.goalMainValue}>
                                <span className={styles.goalMainLabel}>
                                  현재 가치로
                                </span>
                                <span
                                  className={styles.goalMainAmount}
                                  style={{ color: "#059669" }}
                                >
                                  월 +
                                  {Math.abs(
                                    presentValueCashflow,
                                  ).toLocaleString()}
                                  만원
                                </span>
                                <span className={styles.goalMainSub}>
                                  의 여유가 있습니다
                                </span>
                              </div>

                              {/* 설명 */}
                              <div className={styles.goalExplanation}>
                                <div className={styles.goalExplanationRow}>
                                  <span>은퇴 시점 여유분</span>
                                  <span style={{ color: "#059669" }}>
                                    월 +
                                    {Math.abs(monthlyCashflow).toLocaleString()}
                                    만원
                                  </span>
                                </div>
                                <div className={styles.goalExplanationRow}>
                                  <span>현재 가치 환산</span>
                                  <span style={{ color: "#059669" }}>
                                    월 +
                                    {Math.abs(
                                      presentValueCashflow,
                                    ).toLocaleString()}
                                    만원
                                  </span>
                                </div>
                                <div className={styles.goalExplanationNote}>
                                  {m.yearsToRetirement}년간 물가상승률{" "}
                                  {calcParams.inflationRate * 100}% 역산
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Step: 자산 목표 (적자) / 예상 자산 (흑자) */}
                        <div className={styles.stepCard}>
                          <div className={styles.stepHeader}>
                            <span className={styles.stepNumber}>Asset</span>
                            <span className={styles.stepTitle}>
                              {isDeficit ? "자산 목표" : "예상 자산"}
                            </span>
                          </div>

                          {isDeficit ? (
                            <>
                              <div className={styles.assetGoalMessage}>
                                아래 자산 중 하나를 <strong>은퇴 전까지</strong>{" "}
                                만들면 됩니다
                              </div>

                              <div className={styles.assetGoalList}>
                                <div className={styles.assetGoalRow}>
                                  <div className={styles.assetGoalName}>
                                    부동산
                                  </div>
                                  <div className={styles.assetGoalRight}>
                                    <div className={styles.assetGoalDesc}>
                                      월세 연 3%
                                    </div>
                                    <div className={styles.assetGoalValue}>
                                      {needRealEstate}억
                                    </div>
                                  </div>
                                </div>
                                <div className={styles.assetGoalRow}>
                                  <div className={styles.assetGoalName}>
                                    예적금
                                  </div>
                                  <div className={styles.assetGoalRight}>
                                    <div className={styles.assetGoalDesc}>
                                      이자 연 2%
                                    </div>
                                    <div className={styles.assetGoalValue}>
                                      {needCash}억
                                    </div>
                                  </div>
                                </div>
                                <div className={styles.assetGoalRow}>
                                  <div className={styles.assetGoalName}>
                                    개인연금
                                  </div>
                                  <div className={styles.assetGoalRight}>
                                    <div className={styles.assetGoalDesc}>
                                      수익률 연 5%
                                    </div>
                                    <div className={styles.assetGoalValue}>
                                      {needPension}억
                                    </div>
                                  </div>
                                </div>
                                <div className={styles.assetGoalRow}>
                                  <div className={styles.assetGoalName}>
                                    배당주
                                  </div>
                                  <div className={styles.assetGoalRight}>
                                    <div className={styles.assetGoalDesc}>
                                      배당 연 4%
                                    </div>
                                    <div className={styles.assetGoalValue}>
                                      {needDividend}억
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className={styles.assetGoalExample}>
                                지금 가치 기준{" "}
                                <strong>{needRealEstate}억</strong> 부동산을
                                <br />
                                <strong>{retirementYear}년</strong>까지 마련하면
                                부족분 해결
                              </div>
                            </>
                          ) : (
                            <>
                              <div className={styles.assetGoalMessage}>
                                이대로 유지하면 <strong>은퇴 후</strong> 아래
                                자산과 동일한 가치입니다
                              </div>

                              <div className={styles.assetGoalList}>
                                <div className={styles.assetGoalRow}>
                                  <div className={styles.assetGoalName}>
                                    부동산
                                  </div>
                                  <div className={styles.assetGoalRight}>
                                    <div className={styles.assetGoalDesc}>
                                      월세 연 3%
                                    </div>
                                    <div
                                      className={styles.assetGoalValue}
                                      style={{ color: "#059669" }}
                                    >
                                      +{needRealEstate}억
                                    </div>
                                  </div>
                                </div>
                                <div className={styles.assetGoalRow}>
                                  <div className={styles.assetGoalName}>
                                    예적금
                                  </div>
                                  <div className={styles.assetGoalRight}>
                                    <div className={styles.assetGoalDesc}>
                                      이자 연 2%
                                    </div>
                                    <div
                                      className={styles.assetGoalValue}
                                      style={{ color: "#059669" }}
                                    >
                                      +{needCash}억
                                    </div>
                                  </div>
                                </div>
                                <div className={styles.assetGoalRow}>
                                  <div className={styles.assetGoalName}>
                                    개인연금
                                  </div>
                                  <div className={styles.assetGoalRight}>
                                    <div className={styles.assetGoalDesc}>
                                      수익률 연 5%
                                    </div>
                                    <div
                                      className={styles.assetGoalValue}
                                      style={{ color: "#059669" }}
                                    >
                                      +{needPension}억
                                    </div>
                                  </div>
                                </div>
                                <div className={styles.assetGoalRow}>
                                  <div className={styles.assetGoalName}>
                                    배당주
                                  </div>
                                  <div className={styles.assetGoalRight}>
                                    <div className={styles.assetGoalDesc}>
                                      배당 연 4%
                                    </div>
                                    <div
                                      className={styles.assetGoalValue}
                                      style={{ color: "#059669" }}
                                    >
                                      +{needDividend}억
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className={styles.assetGoalExample}>
                                연금 외 여유분은{" "}
                                <strong>{needRealEstate}억</strong> 부동산의
                                <br />
                                월세 수익과 동일한 가치
                              </div>
                            </>
                          )}
                        </div>

                        {/* Step: 추가 고려사항 */}
                        <div className={styles.stepCard}>
                          <div className={styles.stepHeader}>
                            <span className={styles.stepNumber}>But</span>
                            <span className={styles.stepTitle}>
                              잠깐, 이게 전부일까요?
                            </span>
                          </div>
                          <div className={styles.butCardContent}>
                            <p className={styles.butCardQuestion}>
                              {isDeficit ? "목표 자산" : "예상 자산"}만 있으면
                              충분할까요?
                            </p>
                            <p className={styles.butCardAnswer}>
                              살면서 써야 할 <strong>추가 지출 이벤트</strong>는
                              생각보다 많습니다.
                            </p>
                            <div className={styles.butCardList}>
                              <span>자녀 교육/결혼</span>
                              <span>의료/간병</span>
                              <span>주거</span>
                              <span>여행/경조사</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Step 2: 추가 비용 */}
                  {(() => {
                    // 현재 가치 환산 (평균 지출 시점 기준)
                    const avgYearsToExpense = Math.round(
                      (m.yearsToRetirement + m.retirementYears) / 2,
                    );
                    const presentValueFactor = Math.pow(
                      1 + calcParams.inflationRate,
                      avgYearsToExpense,
                    );
                    const presentValueTotal = Math.round(
                      additionalCostTotal / presentValueFactor,
                    );
                    const presentEducation = Math.round(
                      educationCost / presentValueFactor,
                    );
                    const presentMedical = Math.round(
                      medicalCost / presentValueFactor,
                    );
                    const presentLeisure = Math.round(
                      leisureCost / presentValueFactor,
                    );
                    const presentConsumer = Math.round(
                      consumerGoodsCost / presentValueFactor,
                    );
                    const presentHousing = Math.round(
                      housingCost / presentValueFactor,
                    );

                    return (
                      <div className={styles.stepCard}>
                        <div className={styles.stepHeader}>
                          <span className={styles.stepNumber}>Extra</span>
                          <span className={styles.stepTitle}>
                            추가 필요 자금
                          </span>
                        </div>
                        <div className={styles.stepMainResult}>
                          <div className={styles.stepMainLabel}>
                            현재 가치로 평생{" "}
                            <strong>
                              {formatBillion(presentValueTotal / 10000)}억
                            </strong>
                            의 추가 비용 발생 예상
                          </div>
                        </div>
                        <div className={styles.extraValueComparison}>
                          <div className={styles.extraValueItem}>
                            <div className={styles.extraValueLabel}>
                              미래 가치
                            </div>
                            <div className={styles.extraValueAmount}>
                              +{formatBillion(additionalCostTotal / 10000)}억
                            </div>
                            <div className={styles.extraValueNote}>
                              물가상승 반영
                            </div>
                          </div>
                          <div className={styles.extraValueItem}>
                            <div className={styles.extraValueLabel}>
                              현재 가치
                            </div>
                            <div
                              className={styles.extraValueAmount}
                              style={{ color: "#0369a1" }}
                            >
                              +{formatBillion(presentValueTotal / 10000)}억
                            </div>
                            <div className={styles.extraValueNote}>
                              지금 기준
                            </div>
                          </div>
                        </div>
                        <div className={styles.stepDetails}>
                          {data.children.length > 0 && (
                            <div className={styles.stepDetailRow}>
                              <div className={styles.stepDetailTop}>
                                <span className={styles.stepDetailLabel}>
                                  자녀 교육/양육비
                                </span>
                                <span className={styles.stepDetailValues}>
                                  <span
                                    className={styles.stepDetailValueFuture}
                                  >
                                    {formatBillion(educationCost / 10000)}억
                                  </span>
                                  <span
                                    className={styles.stepDetailValuePresent}
                                  >
                                    {formatBillion(presentEducation / 10000)}억
                                  </span>
                                </span>
                              </div>
                              <span className={styles.stepDetailPersonalized}>
                                {costOptions.education === "none"
                                  ? "포함 안함"
                                  : `자녀 ${data.children.length}명, 영아~대학교 + 결혼자금`}
                              </span>
                            </div>
                          )}
                          <div className={styles.stepDetailRow}>
                            <div className={styles.stepDetailTop}>
                              <span className={styles.stepDetailLabel}>
                                의료/간병비
                              </span>
                              <span className={styles.stepDetailValues}>
                                <span className={styles.stepDetailValueFuture}>
                                  {formatBillion(medicalCost / 10000)}억
                                </span>
                                <span className={styles.stepDetailValuePresent}>
                                  {formatBillion(presentMedical / 10000)}억
                                </span>
                              </span>
                            </div>
                            <span className={styles.stepDetailPersonalized}>
                              {costOptions.medical
                                ? `본인${data.spouseAge ? "+배우자" : ""} 연령대별 예상 의료비`
                                : "포함 안함"}
                            </span>
                          </div>
                          <div className={styles.stepDetailRow}>
                            <div className={styles.stepDetailTop}>
                              <span className={styles.stepDetailLabel}>
                                여행/여가
                              </span>
                              <span className={styles.stepDetailValues}>
                                <span className={styles.stepDetailValueFuture}>
                                  {formatBillion(leisureCost / 10000)}억
                                </span>
                                <span className={styles.stepDetailValuePresent}>
                                  {formatBillion(presentLeisure / 10000)}억
                                </span>
                              </span>
                            </div>
                            <span className={styles.stepDetailPersonalized}>
                              {costOptions.leisure === "none"
                                ? "포함 안함"
                                : `연간 여행/취미활동 (${m.effectiveLifeExpectancy}세까지)`}
                            </span>
                          </div>
                          <div className={styles.stepDetailRow}>
                            <div className={styles.stepDetailTop}>
                              <span className={styles.stepDetailLabel}>
                                소비재
                              </span>
                              <span className={styles.stepDetailValues}>
                                <span className={styles.stepDetailValueFuture}>
                                  {formatBillion(consumerGoodsCost / 10000)}억
                                </span>
                                <span className={styles.stepDetailValuePresent}>
                                  {formatBillion(presentConsumer / 10000)}억
                                </span>
                              </span>
                            </div>
                            <span className={styles.stepDetailPersonalized}>
                              {costOptions.consumerGoods === "none"
                                ? "포함 안함"
                                : `자동차, 가전, 가구 등 (${m.effectiveLifeExpectancy}세까지)`}
                            </span>
                          </div>
                          <div className={styles.stepDetailRow}>
                            <div className={styles.stepDetailTop}>
                              <span className={styles.stepDetailLabel}>
                                주거
                              </span>
                              <span className={styles.stepDetailValues}>
                                <span className={styles.stepDetailValueFuture}>
                                  {costOptions.housing
                                    ? formatBillion(housingCost / 10000)
                                    : "0"}
                                  억
                                </span>
                                <span className={styles.stepDetailValuePresent}>
                                  {costOptions.housing
                                    ? formatBillion(presentHousing / 10000)
                                    : "0"}
                                  억
                                </span>
                              </span>
                            </div>
                            <span className={styles.stepDetailPersonalized}>
                              {costOptions.housing
                                ? "은퇴 후 예상 주거비 (전용 84㎡ 기준)"
                                : "미선택"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Lycon 소개 카드 */}
                  <div className={styles.stepCard}>
                    <div className={styles.stepHeader}>
                      <span className={styles.stepNumber}>Lycon</span>
                      <span className={styles.stepTitle}>자산 관리 서비스</span>
                    </div>
                    <div className={styles.lyconIntro}>
                      {/* 문제 제기 */}
                      <div className={styles.lyconSection}>
                        <p className={styles.lyconParagraph}>
                          은퇴 목표만 해도 이렇게 많은 것들을 신경써야 합니다.
                        </p>
                        <p className={styles.lyconParagraph}>
                          하지만 우리의 목표가 은퇴만은 아니잖아요?
                          <br />
                          <strong>
                            내 집 마련, 자녀 계획, 교육 계획, 심지어 어떤
                            자동차를 살지까지.
                          </strong>
                          <br />이 모든 것을 고려하며 미래를 계획해야 합니다.
                        </p>
                      </div>

                      {/* 현실의 어려움 */}
                      <div className={styles.lyconSection}>
                        <p className={styles.lyconHighlight}>
                          이를 위해 가장 중요한 건 <strong>현재의 관리</strong>
                          입니다.
                        </p>
                        <p className={styles.lyconParagraph}>
                          하지만 가계부 하나 쓰는 것도 어렵지 않나요?
                        </p>
                        <div className={styles.lyconChallenges}>
                          <span>매달, 매년 바뀌는 세금과 정부 정책</span>
                          <span>
                            매일 요동치는 주식 시장에 의해 흔들리는 장기 투자
                          </span>
                          <span>
                            놓치고 있는 연말정산 공제, 정부 지원금, 보험 청구
                          </span>
                        </div>
                        <p className={styles.lyconSubNote}>
                          돈을 버는 것만이 전부가 아닙니다.
                          <br />
                          <strong>돌려받을 것, 내지 않아도 될 것</strong>을
                          챙기는 것도 돈을 버는 것입니다.
                        </p>
                      </div>

                      {/* 해결책 */}
                      <div className={styles.lyconSection}>
                        <p className={styles.lyconHighlight}>
                          그래서 당신과 가족을 위한
                          <br />
                          <strong>자산 관리 전문가</strong>가 필요합니다.
                        </p>
                      </div>

                      {/* Lycon 서비스 */}
                      <div className={styles.lyconServices}>
                        <div className={styles.lyconServiceItem}>
                          <span className={styles.lyconServiceNum}>01</span>
                          <div className={styles.lyconServiceContent}>
                            <strong>목표 검증</strong>
                            <span>
                              은퇴 목표를 기반으로 모든 단기 목표를 검증합니다
                            </span>
                          </div>
                        </div>
                        <div className={styles.lyconServiceItem}>
                          <span className={styles.lyconServiceNum}>02</span>
                          <div className={styles.lyconServiceContent}>
                            <strong>맞춤 시나리오</strong>
                            <span>
                              사용자 성향에 따라 시나리오를 생성하고 매년
                              시뮬레이션을 관리합니다
                            </span>
                          </div>
                        </div>
                        <div className={styles.lyconServiceItem}>
                          <span className={styles.lyconServiceNum}>03</span>
                          <div className={styles.lyconServiceContent}>
                            <strong>정기 관리</strong>
                            <span>
                              가계부 정리, 연말정산, 포트폴리오 리밸런싱까지
                              주기적으로 챙깁니다
                            </span>
                          </div>
                        </div>
                        <div className={styles.lyconServiceItem}>
                          <span className={styles.lyconServiceNum}>04</span>
                          <div className={styles.lyconServiceContent}>
                            <strong>통합 관리</strong>
                            <span>
                              모든 자산과 재무를 한 곳에서 투명하게, 언제
                              어디서든 관리합니다
                            </span>
                          </div>
                        </div>
                        <div className={styles.lyconServiceItem}>
                          <span className={styles.lyconServiceNum}>05</span>
                          <div className={styles.lyconServiceContent}>
                            <strong>자산 관리 대시보드</strong>
                            <span>
                              내 자산 현황, 목표 달성률, 할 일 목록을 한눈에
                              확인합니다
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CTA */}
                      <div className={styles.lyconCta}>
                        <p>
                          혼자서는 못합니다. 아니, <strong>안 합니다.</strong>
                        </p>
                        <p>
                          Lycon 자산 관리사에게 생각 없이 관리받으세요.
                          <br />
                          잊고 있다 보면, 때가 되면 알아서 액션하도록
                          도와드립니다.
                        </p>
                      </div>

                      {/* Lycon 비전 */}
                      <div className={styles.lyconBelief}>
                        <p className={styles.lyconBeliefTitle}>
                          Lycon이 믿고 있는 것
                        </p>
                        <p className={styles.lyconBeliefText}>
                          상위 5% 자산가들은 이미 은행과 금융권에서 관리받고
                          있습니다.
                          <br />
                          바로 PB(Private Banking) 서비스입니다.
                        </p>
                        <p className={styles.lyconBeliefText}>
                          은행, 증권사에게 소외되고 있는 중산층부터 모든
                          국민에게
                          <br />
                          자산 관리사가 반드시 필요하다고 믿습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}

        {/* ===== 종합소견 탭 ===== */}
        {activeTab === "opinion" && (
          <>
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>Opinion</span>
                <span className={styles.stepTitle}>전문가 소견</span>
              </div>
              {opinion ? (
                <div
                  className={styles.opinionContent}
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(opinion) }}
                />
              ) : (
                <div className={styles.noDataMessage}>
                  담당자 소견이 아직 작성되지 않았습니다.
                </div>
              )}
            </div>

            {/* 은퇴 준비 기본 상식 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>GUIDE</span>
                <span className={styles.stepTitle}>은퇴 준비 기본 상식</span>
              </div>
              <div className={styles.guideContent}>
                <p>
                  은퇴는 단순히 "회사를 그만두는 것"이 아닙니다.{" "}
                  <strong>매달 들어오던 월급이 멈추는 순간</strong>입니다.
                </p>
                <p>
                  하지만 생활비, 병원비, 경조사비는 계속 나갑니다. 그래서 은퇴
                  준비의 핵심은{" "}
                  <strong>"월급 없이도 돈이 들어오는 구조"</strong>를 만드는
                  것입니다.
                </p>
              </div>
            </div>

            {/* 3층 연금 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>PENSION</span>
                <span className={styles.stepTitle}>연금의 3가지 종류</span>
              </div>
              <div className={styles.guidePensionGrid}>
                <div className={styles.guidePensionItem}>
                  <span
                    className={styles.guidePensionBadge}
                    style={{ background: "#38a169" }}
                  >
                    1층
                  </span>
                  <span className={styles.guidePensionLabel}>국민연금</span>
                  <span className={styles.guidePensionDesc}>
                    나라에서 주는 연금, 월 60~100만원
                  </span>
                </div>
                <div className={styles.guidePensionItem}>
                  <span
                    className={styles.guidePensionBadge}
                    style={{ background: "#3182ce" }}
                  >
                    2층
                  </span>
                  <span className={styles.guidePensionLabel}>퇴직연금</span>
                  <span className={styles.guidePensionDesc}>
                    회사에서 쌓아주는 연금
                  </span>
                </div>
                <div className={styles.guidePensionItem}>
                  <span
                    className={styles.guidePensionBadge}
                    style={{ background: "#805ad5" }}
                  >
                    3층
                  </span>
                  <span className={styles.guidePensionLabel}>개인연금</span>
                  <span className={styles.guidePensionDesc}>
                    연금저축, IRP 등 직접 준비
                  </span>
                </div>
              </div>
              <div className={styles.guideTipBox}>
                1층만으로는 부족합니다. 2층, 3층을 함께 쌓아야 안정적인 노후가
                됩니다.
              </div>
            </div>

            {/* 복리의 힘 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>COMPOUND</span>
                <span className={styles.stepTitle}>복리의 힘</span>
              </div>
              <div className={styles.guideSubtitle}>
                1,000만원을 연 10%로 굴리면{" "}
                <span className={styles.guideSubtitleNote}>
                  (Lycon 자산 관리사 연평균 수익률)
                </span>
              </div>
              <div className={styles.compoundAmounts}>
                <div className={styles.compoundAmountItem}>
                  <span className={styles.compoundAmountValue}>1,000만</span>
                  <span className={styles.compoundAmountYear}>0년</span>
                </div>
                <div className={styles.compoundAmountItem}>
                  <span className={styles.compoundAmountValue}>2,594만</span>
                  <span className={styles.compoundAmountYear}>10년</span>
                </div>
                <div className={styles.compoundAmountItem}>
                  <span className={styles.compoundAmountValue}>6,727만</span>
                  <span className={styles.compoundAmountYear}>20년</span>
                </div>
                <div className={styles.compoundAmountItem}>
                  <span className={styles.compoundAmountValue}>
                    1억 7,449만
                  </span>
                  <span className={styles.compoundAmountYear}>30년</span>
                </div>
              </div>
              <div className={styles.compoundChartContainer}>
                <Line
                  data={{
                    labels: Array.from({ length: 31 }, (_, i) => i),
                    datasets: [
                      {
                        data: Array.from({ length: 31 }, (_, i) =>
                          Math.round(1000 * Math.pow(1.1, i)),
                        ),
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59, 130, 246, 0.1)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: (ctx) => {
                          const index = ctx.dataIndex;
                          return [0, 10, 20, 30].includes(index) ? 4 : 0;
                        },
                        pointBackgroundColor: "#3b82f6",
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) =>
                            `${(ctx.parsed.y ?? 0).toLocaleString()}만원`,
                          title: (ctx) => `${ctx[0].label}년 후`,
                        },
                      },
                    },
                    scales: {
                      x: {
                        display: false,
                      },
                      y: {
                        display: false,
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              </div>
              <div className={styles.guideTipBox}>
                내가 일하지 않아도 돈이 스스로 불어납니다. 시간이 길수록 효과가
                커집니다.
              </div>
            </div>

            {/* 인플레이션 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>INFLATION</span>
                <span className={styles.stepTitle}>물가 상승의 무서움</span>
              </div>
              <div className={styles.guideInflationRow}>
                <div className={styles.guideInflationItem}>
                  <span className={styles.guideInflationLabel}>20년 전</span>
                  <span className={styles.guideInflationValue}>3,000원</span>
                </div>
                <div className={styles.guideInflationArrow}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                <div className={styles.guideInflationItem}>
                  <span className={styles.guideInflationLabel}>현재</span>
                  <span className={styles.guideInflationValue}>8,000원</span>
                </div>
              </div>
              <div className={styles.guideContent}>
                <p>
                  지금 100만원으로 살 수 있는 것들이, 20년 후에는 60만원어치밖에
                  못 삽니다.
                </p>
                <p>
                  은퇴 자금은 "지금 필요한 돈"이 아니라{" "}
                  <strong>"미래에 필요한 돈"</strong>으로 계산해야 합니다.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 바텀시트 오버레이 */}
      {activeSheet && (
        <div
          className={styles.bottomSheetOverlay}
          onClick={() => setActiveSheet(null)}
        />
      )}

      {/* 비용 변경 바텀시트 */}
      <div
        className={`${styles.bottomSheet} ${activeSheet === "cost" ? styles.open : ""}`}
      >
        <div className={styles.bottomSheetHeader}>
          <span className={styles.bottomSheetTitle}>비용 변경</span>
          <button
            className={styles.bottomSheetClose}
            onClick={() => setActiveSheet(null)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.bottomSheetContent}>
          {(() => {
            const additionalCosts = calculateAdditionalCosts(data, calcParams);
            const educationCost =
              costOptions.education === "none"
                ? 0
                : costOptions.education === "normal"
                  ? additionalCosts.childEducation.grandTotalNormal
                  : additionalCosts.childEducation.grandTotalPremium;
            const leisureCost =
              costOptions.leisure === "none"
                ? 0
                : (additionalCosts.leisure[costOptions.leisure as number]
                    ?.totalUntilRetirement || 0) +
                  (additionalCosts.leisure[costOptions.leisure as number]
                    ?.totalAfterRetirement || 0);
            const consumerGoodsCost =
              costOptions.consumerGoods === "none"
                ? 0
                : additionalCosts.consumerGoods[
                    costOptions.consumerGoods as number
                  ]?.totalUntilLifeExpectancy || 0;
            const medicalCost = costOptions.medical
              ? additionalCosts.medical.grandTotal
              : 0;
            const housingCost = costOptions.housing
              ? additionalCosts.housing[costOptions.housing.areaIndex]?.tiers[
                  costOptions.housing.tierIndex
                ]?.price || 0
              : 0;

            return (
              <>
                {/* 자녀 교육/양육비 상세 */}
                {data.children.length > 0 && (
                  <div className={styles.card}>
                    <div className={styles.costDetailHeader}>
                      <h3
                        className={styles.cardTitle}
                        onClick={() => toggleSection("childEducation")}
                      >
                        자녀 교육/양육비
                      </h3>
                      <div className={styles.costDetailTopRow}>
                        <div className={styles.costDetailOptions}>
                          <button
                            className={`${styles.costOptionBtn} ${costOptions.education === "normal" ? styles.active : ""}`}
                            onClick={() =>
                              setCostOptions((p) => ({
                                ...p,
                                education: "normal",
                              }))
                            }
                          >
                            보통
                          </button>
                          <button
                            className={`${styles.costOptionBtn} ${costOptions.education === "premium" ? styles.active : ""}`}
                            onClick={() =>
                              setCostOptions((p) => ({
                                ...p,
                                education: "premium",
                              }))
                            }
                          >
                            여유
                          </button>
                        </div>
                        <svg
                          className={`${styles.chevron} ${expandedSections["childEducation"] ? styles.expanded : ""}`}
                          onClick={() => toggleSection("childEducation")}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </div>
                    <div className={styles.costDetailBottomRow}>
                      <span className={styles.costDetailDesc}>
                        자녀 {data.children.length}명, 영아~대학교 + 결혼자금
                      </span>
                      <span
                        className={`${styles.costDetailAmount} ${styles.animatedValue}`}
                      >
                        {formatBillion(educationCost / 10000)}억
                      </span>
                    </div>
                    {expandedSections["childEducation"] && (
                      <div className={styles.simpleExpandContent}>
                        <div className={styles.simpleColumnHeader}>
                          <span>단계</span>
                          <div className={styles.simpleColumnLabels}>
                            <span>보통</span>
                            <span>여유</span>
                          </div>
                        </div>
                        {additionalCosts.childEducation.details.map(
                          (child, idx) => (
                            <div key={idx} className={styles.simpleSubSection}>
                              <div className={styles.simpleSubTitle}>
                                {child.childName} (현재 {child.childAge}세)
                              </div>
                              <div className={styles.simpleList}>
                                {child.stageDetails.map((stage, sIdx) => (
                                  <div key={sIdx} className={styles.simpleRow}>
                                    <span className={styles.simpleRowLabel}>
                                      {stage.stage}
                                      <span className={styles.simpleRowSub}>
                                        {stage.years}년
                                      </span>
                                    </span>
                                    <div className={styles.simpleRowValues}>
                                      <span
                                        className={styles.simpleRowValueNormal}
                                      >
                                        {formatBillion(
                                          stage.normalCost / 10000,
                                        )}
                                        억
                                      </span>
                                      <span
                                        className={styles.simpleRowValuePremium}
                                      >
                                        {formatBillion(
                                          stage.premiumCost / 10000,
                                        )}
                                        억
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                <div className={styles.simpleRow}>
                                  <span className={styles.simpleRowLabel}>
                                    결혼자금
                                  </span>
                                  <div className={styles.simpleRowValues}>
                                    <span
                                      className={styles.simpleRowValueNormal}
                                    >
                                      {formatBillion(
                                        child.weddingNormal / 10000,
                                      )}
                                      억
                                    </span>
                                    <span
                                      className={styles.simpleRowValuePremium}
                                    >
                                      {formatBillion(
                                        child.weddingPremium / 10000,
                                      )}
                                      억
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                        <div className={styles.simpleTotalRow}>
                          <span>총계</span>
                          <div className={styles.simpleRowValues}>
                            <span className={styles.simpleRowValueNormal}>
                              {formatBillion(
                                additionalCosts.childEducation
                                  .grandTotalNormal / 10000,
                              )}
                              억
                            </span>
                            <span className={styles.simpleRowValuePremium}>
                              {formatBillion(
                                additionalCosts.childEducation
                                  .grandTotalPremium / 10000,
                              )}
                              억
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 의료/간병비 */}
                <div className={styles.card}>
                  <div className={styles.costDetailHeader}>
                    <h3
                      className={styles.cardTitle}
                      onClick={() => toggleSection("medical")}
                    >
                      의료/간병비
                    </h3>
                    <div className={styles.costDetailTopRow}>
                      <div className={styles.costDetailOptions}>
                        <span className={styles.costDetailNote}>
                          평균 의료비 적용
                        </span>
                      </div>
                      <svg
                        className={`${styles.chevron} ${expandedSections["medical"] ? styles.expanded : ""}`}
                        onClick={() => toggleSection("medical")}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                  <div className={styles.costDetailBottomRow}>
                    <span className={styles.costDetailDesc}>
                      본인{data.spouseAge ? "+배우자" : ""} 연령대별 예상 의료비
                    </span>
                    <span
                      className={`${styles.costDetailAmount} ${styles.animatedValue}`}
                    >
                      {formatBillion(medicalCost / 10000)}억
                    </span>
                  </div>
                  {expandedSections["medical"] && (
                    <div className={styles.simpleExpandContent}>
                      <div className={styles.simpleSubSection}>
                        <div className={styles.simpleSubTitle}>
                          본인 ({data.currentAge}세)
                        </div>
                        <div className={styles.simpleList}>
                          {additionalCosts.medical.selfCosts.map(
                            (cost, idx) => (
                              <div key={idx} className={styles.simpleRow}>
                                <span className={styles.simpleRowLabel}>
                                  {cost.ageRange}
                                  <span className={styles.simpleRowSub}>
                                    {cost.yearsInRange}년
                                  </span>
                                </span>
                                <span className={styles.simpleRowValue}>
                                  {formatBillion(cost.totalCost / 10000)}억
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                      {data.spouseAge &&
                        additionalCosts.medical.spouseCosts.length > 0 && (
                          <div className={styles.simpleSubSection}>
                            <div className={styles.simpleSubTitle}>
                              배우자 ({data.spouseAge}세)
                            </div>
                            <div className={styles.simpleList}>
                              {additionalCosts.medical.spouseCosts.map(
                                (cost, idx) => (
                                  <div key={idx} className={styles.simpleRow}>
                                    <span className={styles.simpleRowLabel}>
                                      {cost.ageRange}
                                      <span className={styles.simpleRowSub}>
                                        {cost.yearsInRange}년
                                      </span>
                                    </span>
                                    <span className={styles.simpleRowValue}>
                                      {formatBillion(cost.totalCost / 10000)}억
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      <div className={styles.simpleTotalRow}>
                        <span>총계</span>
                        <span>
                          {formatBillion(
                            additionalCosts.medical.grandTotal / 10000,
                          )}
                          억
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 여행/여가 */}
                <div className={styles.card}>
                  <div className={styles.costDetailHeader}>
                    <h3
                      className={styles.cardTitle}
                      onClick={() => toggleSection("leisure")}
                    >
                      여행/여가
                    </h3>
                    <div className={styles.costDetailTopRow}>
                      <div className={styles.costDetailOptions}>
                        {additionalCosts.leisure.map((opt, idx) => (
                          <button
                            key={idx}
                            className={`${styles.costOptionBtn} ${costOptions.leisure === idx ? styles.active : ""}`}
                            onClick={() =>
                              setCostOptions((p) => ({ ...p, leisure: idx }))
                            }
                          >
                            {opt.level}
                          </button>
                        ))}
                      </div>
                      <svg
                        className={`${styles.chevron} ${expandedSections["leisure"] ? styles.expanded : ""}`}
                        onClick={() => toggleSection("leisure")}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                  <div className={styles.costDetailBottomRow}>
                    <span className={styles.costDetailDesc}>
                      연간 여행/취미활동 ({m.effectiveLifeExpectancy}세까지)
                    </span>
                    <span
                      className={`${styles.costDetailAmount} ${styles.animatedValue}`}
                    >
                      {formatBillion(leisureCost / 10000)}억
                    </span>
                  </div>
                  {expandedSections["leisure"] && (
                    <div className={styles.simpleExpandContent}>
                      <div className={styles.simpleList}>
                        {additionalCosts.leisure.map((opt, idx) => (
                          <div key={idx} className={styles.simpleRow}>
                            <span className={styles.simpleRowLabel}>
                              {opt.level}
                              <span className={styles.simpleRowSub}>
                                연 {opt.annualCost}만
                              </span>
                            </span>
                            <span className={styles.simpleRowValue}>
                              {formatBillion(
                                (opt.totalUntilRetirement +
                                  opt.totalAfterRetirement) /
                                  10000,
                              )}
                              억
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 소비재 */}
                <div className={styles.card}>
                  <div className={styles.costDetailHeader}>
                    <h3
                      className={styles.cardTitle}
                      onClick={() => toggleSection("consumerGoods")}
                    >
                      소비재
                    </h3>
                    <div className={styles.costDetailTopRow}>
                      <div className={styles.costDetailOptions}>
                        {additionalCosts.consumerGoods.map((opt, idx) => (
                          <button
                            key={idx}
                            className={`${styles.costOptionBtn} ${costOptions.consumerGoods === idx ? styles.active : ""}`}
                            onClick={() =>
                              setCostOptions((p) => ({
                                ...p,
                                consumerGoods: idx,
                              }))
                            }
                          >
                            {opt.level}
                          </button>
                        ))}
                      </div>
                      <svg
                        className={`${styles.chevron} ${expandedSections["consumerGoods"] ? styles.expanded : ""}`}
                        onClick={() => toggleSection("consumerGoods")}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                  <div className={styles.costDetailBottomRow}>
                    <span className={styles.costDetailDesc}>
                      자동차, 가전, 가구 등 ({m.effectiveLifeExpectancy}세까지)
                    </span>
                    <span
                      className={`${styles.costDetailAmount} ${styles.animatedValue}`}
                    >
                      {formatBillion(consumerGoodsCost / 10000)}억
                    </span>
                  </div>
                  {expandedSections["consumerGoods"] && (
                    <div className={styles.simpleExpandContent}>
                      <div className={styles.simpleList}>
                        {additionalCosts.consumerGoods.map((opt, idx) => (
                          <div key={idx} className={styles.simpleRow}>
                            <span className={styles.simpleRowLabel}>
                              {opt.level}
                              <span className={styles.simpleRowSub}>
                                연 {opt.annualCost}만
                              </span>
                            </span>
                            <span className={styles.simpleRowValue}>
                              {formatBillion(
                                opt.totalUntilLifeExpectancy / 10000,
                              )}
                              억
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 주거 */}
                <div className={styles.card}>
                  <div className={styles.costDetailHeader}>
                    <h3
                      className={styles.cardTitle}
                      onClick={() => toggleSection("housing")}
                    >
                      주거
                    </h3>
                    <div className={styles.costDetailTopRow}>
                      <div className={styles.costDetailOptions}>
                        <button
                          className={`${styles.costOptionBtn} ${costOptions.housing === null ? styles.active : ""}`}
                          onClick={() =>
                            setCostOptions((p) => ({ ...p, housing: null }))
                          }
                        >
                          선택 안함
                        </button>
                        {costOptions.housing && (
                          <span className={styles.costDetailNote}>
                            {
                              additionalCosts.housing[
                                costOptions.housing.areaIndex
                              ]?.area
                            }{" "}
                            {
                              additionalCosts.housing[
                                costOptions.housing.areaIndex
                              ]?.tiers[costOptions.housing.tierIndex]?.tier
                            }
                          </span>
                        )}
                      </div>
                      <svg
                        className={`${styles.chevron} ${expandedSections["housing"] ? styles.expanded : ""}`}
                        onClick={() => toggleSection("housing")}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                  <div className={styles.costDetailBottomRow}>
                    <span className={styles.costDetailDesc}>
                      은퇴 후 예상 주거비 (전용 84㎡ 기준)
                    </span>
                    <span
                      className={`${styles.costDetailAmount} ${styles.animatedValue}`}
                    >
                      {costOptions.housing
                        ? formatBillion(housingCost / 10000)
                        : "0"}
                      억
                    </span>
                  </div>
                  {expandedSections["housing"] && (
                    <div className={styles.simpleExpandContent}>
                      <table className={styles.housingTable}>
                        <thead>
                          <tr>
                            <th>지역</th>
                            {additionalCosts.housing[0]?.tiers.map(
                              (tier, idx) => (
                                <th key={idx}>{tier.tier}</th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {additionalCosts.housing.map((area, areaIdx) => (
                            <tr key={areaIdx}>
                              <td>
                                <div>{area.area}</div>
                                <div className={styles.housingAreaDesc}>
                                  {area.description}
                                </div>
                              </td>
                              {area.tiers.map((tier, tierIdx) => (
                                <td
                                  key={tierIdx}
                                  className={`${styles.housingTableCell} ${
                                    costOptions.housing?.areaIndex ===
                                      areaIdx &&
                                    costOptions.housing?.tierIndex === tierIdx
                                      ? styles.selected
                                      : ""
                                  }`}
                                  onClick={() =>
                                    setCostOptions((p) => ({
                                      ...p,
                                      housing: {
                                        areaIndex: areaIdx,
                                        tierIndex: tierIdx,
                                      },
                                    }))
                                  }
                                >
                                  {tier.priceDisplay}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* 가정 변경 바텀시트 */}
      <div
        className={`${styles.bottomSheet} ${activeSheet === "assumption" ? styles.open : ""}`}
      >
        <div className={styles.bottomSheetHeader}>
          <span className={styles.bottomSheetTitle}>가정 변경</span>
          <button
            className={styles.bottomSheetClose}
            onClick={() => setActiveSheet(null)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.bottomSheetContent}>
          {/* 은퇴 나이 */}
          <div className={styles.calcSettingRow}>
            <span className={styles.calcSettingLabel}>은퇴 나이</span>
            <div className={styles.calcSettingOptions}>
              {[
                {
                  value: -5,
                  label: `${data.targetRetirementAge - 5}세`,
                  desc: "-5년",
                },
                {
                  value: 0,
                  label: `${data.targetRetirementAge}세`,
                  desc: "기준",
                },
                {
                  value: 5,
                  label: `${data.targetRetirementAge + 5}세`,
                  desc: "+5년",
                },
              ].map((opt) => (
                <div key={opt.value} className={styles.calcSettingBtnWrapper}>
                  <button
                    className={`${styles.calcSettingBtn} ${calcParams.retirementAgeOffset === opt.value ? styles.active : ""}`}
                    onClick={() =>
                      setCalcParams((p) => ({
                        ...p,
                        retirementAgeOffset: opt.value,
                      }))
                    }
                  >
                    {opt.label}
                  </button>
                  <span className={styles.calcSettingDesc}>{opt.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 생활비 수준 */}
          <div className={styles.calcSettingRow}>
            <span className={styles.calcSettingLabel}>은퇴 후 생활비</span>
            <div className={styles.calcSettingOptions}>
              {[
                { value: 0.5, label: "50%", desc: "검소" },
                { value: 0.7, label: "70%", desc: "보통" },
                { value: 1.0, label: "100%", desc: "여유" },
              ].map((opt) => (
                <div key={opt.value} className={styles.calcSettingBtnWrapper}>
                  <button
                    className={`${styles.calcSettingBtn} ${calcParams.livingExpenseRatio === opt.value ? styles.active : ""}`}
                    onClick={() =>
                      setCalcParams((p) => ({
                        ...p,
                        livingExpenseRatio: opt.value,
                      }))
                    }
                  >
                    {opt.label}
                  </button>
                  <span className={styles.calcSettingDesc}>{opt.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 물가상승률 */}
          <div className={styles.calcSettingRow}>
            <span className={styles.calcSettingLabel}>물가상승률</span>
            <div className={styles.calcSettingOptions}>
              {[
                { value: 0.045, label: "4.5%", desc: "비관" },
                { value: 0.03, label: "3%", desc: "평균" },
                { value: 0.015, label: "1.5%", desc: "낙관" },
              ].map((opt) => (
                <div key={opt.value} className={styles.calcSettingBtnWrapper}>
                  <button
                    className={`${styles.calcSettingBtn} ${calcParams.inflationRate === opt.value ? styles.active : ""}`}
                    onClick={() =>
                      setCalcParams((p) => ({ ...p, inflationRate: opt.value }))
                    }
                  >
                    {opt.label}
                  </button>
                  <span className={styles.calcSettingDesc}>{opt.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 소득상승률 */}
          <div className={styles.calcSettingRow}>
            <span className={styles.calcSettingLabel}>소득상승률</span>
            <div className={styles.calcSettingOptions}>
              {[
                { value: 0.02, label: "2%", desc: "비관" },
                { value: 0.035, label: "3.5%", desc: "평균" },
                { value: 0.05, label: "5%", desc: "낙관" },
              ].map((opt) => (
                <div key={opt.value} className={styles.calcSettingBtnWrapper}>
                  <button
                    className={`${styles.calcSettingBtn} ${calcParams.incomeGrowthRate === opt.value ? styles.active : ""}`}
                    onClick={() =>
                      setCalcParams((p) => ({
                        ...p,
                        incomeGrowthRate: opt.value,
                      }))
                    }
                  >
                    {opt.label}
                  </button>
                  <span className={styles.calcSettingDesc}>{opt.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 금융자산 수익률 */}
          <div className={styles.calcSettingRow}>
            <span className={styles.calcSettingLabel}>금융자산 수익률</span>
            <div className={styles.calcSettingOptions}>
              {[
                { value: 0.02, label: "2%", desc: "비관" },
                { value: 0.05, label: "5%", desc: "평균" },
                { value: 0.07, label: "7%", desc: "낙관" },
                { value: 0.1, label: "10%", desc: "Lycon" },
              ].map((opt) => (
                <div key={opt.value} className={styles.calcSettingBtnWrapper}>
                  <button
                    className={`${styles.calcSettingBtn} ${calcParams.financialGrowthRate === opt.value ? styles.active : ""}`}
                    onClick={() =>
                      setCalcParams((p) => ({
                        ...p,
                        financialGrowthRate: opt.value,
                      }))
                    }
                  >
                    {opt.label}
                  </button>
                  <span className={styles.calcSettingDesc}>{opt.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 기대수명 */}
          <div className={styles.calcSettingRow}>
            <span className={styles.calcSettingLabel}>기대수명</span>
            <div className={styles.calcSettingOptions}>
              {[
                { value: 80, label: "80세" },
                { value: 90, label: "90세" },
                { value: 100, label: "100세" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.calcSettingBtn} ${calcParams.lifeExpectancy === opt.value ? styles.active : ""}`}
                  onClick={() =>
                    setCalcParams((p) => ({ ...p, lifeExpectancy: opt.value }))
                  }
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
