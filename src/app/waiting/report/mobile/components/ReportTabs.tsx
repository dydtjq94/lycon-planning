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
import { Doughnut, Bar } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";
import {
  DiagnosisData,
  FixedExpenseItem,
  CalculationParams,
  DEFAULT_CALC_PARAMS,
  calculateAllDiagnosisMetrics,
  calculateAdditionalCosts,
} from "@/lib/services/diagnosisDataService";
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

type TabId = "summary" | "current" | "retirement" | "opinion";

export function ReportTabs({ data, opinion }: ReportTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
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
    { id: "summary", label: "요약" },
    { id: "current", label: "자산 현황" },
    { id: "retirement", label: "필요 자금" },
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
        {/* ===== 요약 탭 ===== */}
        {activeTab === "summary" && (
          <>
            {/* Lycon 점수 */}
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
            </div>

            {/* 핵심 지표 요약 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>Key</span>
                <span className={styles.stepTitle}>핵심 지표</span>
              </div>
              <div className={styles.keyMetricsGrid}>
                <div className={styles.keyMetricItem}>
                  <span className={styles.keyMetricLabel}>순자산</span>
                  <span className={styles.keyMetricValue}>
                    {formatBillion(m.netWorth)}억
                  </span>
                  <span
                    className={`${styles.keyMetricBadge} ${styles[netWorthStatus.status]}`}
                  >
                    {netWorthStatus.label}
                  </span>
                </div>
                <div className={styles.keyMetricItem}>
                  <span className={styles.keyMetricLabel}>저축률</span>
                  <span className={styles.keyMetricValue}>
                    {Math.round(m.savingsRate)}%
                  </span>
                  <span
                    className={`${styles.keyMetricBadge} ${m.currentMonthlyGap >= 0 ? styles.sufficient : styles.critical}`}
                  >
                    월 {m.currentMonthlyGap >= 0 ? "+" : ""}
                    {m.currentMonthlyGap}만
                  </span>
                </div>
                <div className={styles.keyMetricItem}>
                  <span className={styles.keyMetricLabel}>은퇴까지</span>
                  <span className={styles.keyMetricValue}>
                    {m.yearsToRetirement}년
                  </span>
                  <span className={styles.keyMetricBadge}>
                    {m.effectiveRetirementAge}세 목표
                  </span>
                </div>
                <div className={styles.keyMetricItem}>
                  <span className={styles.keyMetricLabel}>고정비:변동비</span>
                  <span className={styles.keyMetricValue}>
                    {m.fixedExpense + m.variableExpense > 0
                      ? Math.round(
                          (m.fixedExpense /
                            (m.fixedExpense + m.variableExpense)) *
                            100,
                        )
                      : 0}
                    :
                    {m.fixedExpense + m.variableExpense > 0
                      ? Math.round(
                          (m.variableExpense /
                            (m.fixedExpense + m.variableExpense)) *
                            100,
                        )
                      : 0}
                  </span>
                  <span className={styles.keyMetricBadge}>
                    {m.fixedExpense}만/{m.variableExpense}만
                  </span>
                </div>
              </div>
            </div>

            {/* 3층 연금 준비 상태 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>Pension</span>
                <span className={styles.stepTitle}>3층 연금 준비</span>
              </div>
              <div className={styles.pensionSummaryGrid}>
                <div className={styles.pensionSummaryItem}>
                  <span
                    className={styles.pensionSummaryBadge}
                    style={{ background: "#38a169" }}
                  >
                    1층
                  </span>
                  <span className={styles.pensionSummaryLabel}>국민연금</span>
                  <span className={styles.pensionSummaryValue}>
                    {(
                      data.nationalPensionPersonal + data.nationalPensionSpouse
                    ).toLocaleString()}
                    만/월
                  </span>
                </div>
                <div className={styles.pensionSummaryItem}>
                  <span
                    className={styles.pensionSummaryBadge}
                    style={{ background: "#3182ce" }}
                  >
                    2층
                  </span>
                  <span className={styles.pensionSummaryLabel}>퇴직연금</span>
                  <span className={styles.pensionSummaryValue}>
                    {(
                      data.retirementPensionBalanceSelf +
                      data.retirementPensionBalanceSpouse
                    ).toLocaleString()}
                    만
                  </span>
                </div>
                <div className={styles.pensionSummaryItem}>
                  <span
                    className={styles.pensionSummaryBadge}
                    style={{ background: "#805ad5" }}
                  >
                    3층
                  </span>
                  <span className={styles.pensionSummaryLabel}>개인연금</span>
                  <span className={styles.pensionSummaryValue}>
                    {(
                      data.personalPensionStatus.irp.balance +
                      data.personalPensionStatus.pensionSavings.balance +
                      data.personalPensionStatus.isa.balance
                    ).toLocaleString()}
                    만
                  </span>
                </div>
              </div>
            </div>

            {/* 총 필요 자금 */}
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
              const additionalTotal =
                educationCost +
                medicalCost +
                leisureCost +
                consumerGoodsCost +
                housingCost;
              const totalNeed = m.totalDemand + additionalTotal / 10000;

              return (
                <div className={styles.stepCard}>
                  <div className={styles.stepHeader}>
                    <span className={styles.stepNumber}>Funding</span>
                    <span className={styles.stepTitle}>총 필요 자금</span>
                  </div>
                  <div className={styles.stepMainResult}>
                    <div className={styles.stepMainValue}>
                      {formatBillion(totalNeed)}
                      <span className={styles.stepMainUnit}>억</span>
                    </div>
                    <div className={styles.stepMainLabel}>
                      우리 가족이 평생 필요한 돈
                    </div>
                  </div>
                  <div className={styles.fundingBreakdown}>
                    <div className={styles.fundingBreakdownItem}>
                      <span className={styles.fundingBreakdownLabel}>최소</span>
                      <span className={styles.fundingBreakdownValue}>
                        {formatBillion(m.totalDemand)}억
                      </span>
                    </div>
                    <span className={styles.fundingBreakdownPlus}>+</span>
                    <div className={styles.fundingBreakdownItem}>
                      <span className={styles.fundingBreakdownLabel}>추가</span>
                      <span className={styles.fundingBreakdownValue}>
                        {formatBillion(additionalTotal / 10000)}억
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}

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
                  월 저축여력 (소득 - 지출)
                </div>
              </div>
              <div className={styles.cashflowChartContainer}>
                <Bar
                  data={{
                    labels: ["월 소득", "월 지출", "저축여력"],
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
                    <span className={styles.pensionFloorTitle}>개인연금 + ISA</span>
                  </div>
                  <div className={styles.pensionProductsGrid}>
                    <div
                      className={`${styles.pensionProductNew} ${data.personalPensionStatus.irp.enrolled ? styles.active : styles.inactive}`}
                    >
                      <span className={styles.pensionProductName}>IRP</span>
                      <span className={styles.pensionProductValue}>
                        {data.personalPensionStatus.irp.enrolled
                          ? `${data.personalPensionStatus.irp.balance.toLocaleString()}만원`
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
                          ? `${data.personalPensionStatus.pensionSavings.balance.toLocaleString()}만원`
                          : "미가입"}
                      </span>
                    </div>
                    <div
                      className={`${styles.pensionProductNew} ${data.personalPensionStatus.isa.enrolled ? styles.active : styles.inactive}`}
                    >
                      <span className={styles.pensionProductName}>ISA</span>
                      <span className={styles.pensionProductValue}>
                        {data.personalPensionStatus.isa.enrolled
                          ? `${data.personalPensionStatus.isa.balance.toLocaleString()}만원`
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
                    {(
                      data.retirementPensionBalanceSelf +
                      data.retirementPensionBalanceSpouse
                    ).toLocaleString()}
                    만원
                  </div>
                  <div className={styles.pensionFloorDesc}>현재 잔액</div>
                  <div className={styles.pensionFloorSub}>
                    은퇴시 예상: 약{" "}
                    {(
                      data.retirementPensionBalanceAtRetireSelf +
                      data.retirementPensionBalanceAtRetireSpouse
                    ).toLocaleString()}
                    만원
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
                m.totalDemand + additionalCostTotal / 10000;

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

                  {/* Step 1: 기본 은퇴자금 */}
                  <div className={styles.stepCard}>
                    <div className={styles.stepHeader}>
                      <span className={styles.stepNumber}>Base</span>
                      <span className={styles.stepTitle}>최소 필요 자금</span>
                    </div>
                    <div className={styles.stepMainResult}>
                      <div
                        className={`${styles.stepMainValue} ${styles.animatedValue}`}
                      >
                        {formatBillion(m.totalDemand)}억
                      </div>
                      <div className={styles.stepMainLabel}>
                        {m.retirementYears}년간 기본 생활비 (
                        {effectiveRetirementAge}세 → {m.effectiveLifeExpectancy}
                        세)
                      </div>
                    </div>
                    <div className={styles.stepDetails}>
                      <div className={styles.stepDetailRow}>
                        <span className={styles.stepDetailLabel}>
                          현재 월 지출
                        </span>
                        <span className={styles.stepDetailValue}>
                          {m.currentMonthlyExpense}만원
                        </span>
                      </div>
                      <div className={styles.stepDetailRow}>
                        <span className={styles.stepDetailLabel}>
                          은퇴 후 월 생활비
                        </span>
                        <span className={styles.stepDetailNote}>
                          물가상승 x{" "}
                          {Math.round(calcParams.livingExpenseRatio * 100)}%
                        </span>
                        <span
                          className={`${styles.stepDetailValue} ${styles.animatedValue}`}
                        >
                          {m.monthlyExpense}만원
                        </span>
                      </div>
                    </div>
                    <div className={styles.stepFootnote}>
                      이 금액에는 자녀 교육비, 의료비, 여행, 자동차, 주거 비용이
                      포함되어 있지 않습니다
                    </div>
                  </div>

                  {/* Step 2: 추가 비용 */}
                  <div className={styles.stepCard}>
                    <div className={styles.stepHeader}>
                      <span className={styles.stepNumber}>Extra</span>
                      <span className={styles.stepTitle}>추가 필요 자금</span>
                    </div>
                    <div className={styles.stepMainResult}>
                      <div
                        className={`${styles.stepMainValue} ${styles.animatedValue}`}
                      >
                        +{formatBillion(additionalCostTotal / 10000)}억
                      </div>
                      <div className={styles.stepMainLabel}>
                        기본 생활비 외 반드시 고려해야 할 비용
                      </div>
                    </div>
                    <div className={styles.stepDetails}>
                      {data.children.length > 0 && (
                        <div className={styles.stepDetailRow}>
                          <span className={styles.stepDetailLabel}>
                            자녀 교육/양육비
                          </span>
                          <span className={styles.stepDetailNote}>
                            {costOptions.education === "none"
                              ? "포함 안함"
                              : costOptions.education === "normal"
                                ? "보통"
                                : "여유"}
                          </span>
                          <span
                            className={`${styles.stepDetailValue} ${styles.animatedValue}`}
                          >
                            {formatBillion(educationCost / 10000)}억
                          </span>
                        </div>
                      )}
                      <div className={styles.stepDetailRow}>
                        <span className={styles.stepDetailLabel}>
                          의료/간병비
                        </span>
                        <span className={styles.stepDetailNote}>
                          {costOptions.medical
                            ? `본인${data.spouseAge ? " + 배우자" : ""}`
                            : "포함 안함"}
                        </span>
                        <span
                          className={`${styles.stepDetailValue} ${styles.animatedValue}`}
                        >
                          {formatBillion(medicalCost / 10000)}억
                        </span>
                      </div>
                      <div className={styles.stepDetailRow}>
                        <span className={styles.stepDetailLabel}>
                          여행/여가
                        </span>
                        <span className={styles.stepDetailNote}>
                          {costOptions.leisure === "none"
                            ? "포함 안함"
                            : additionalCosts.leisure[
                                costOptions.leisure as number
                              ]?.level}
                        </span>
                        <span
                          className={`${styles.stepDetailValue} ${styles.animatedValue}`}
                        >
                          {formatBillion(leisureCost / 10000)}억
                        </span>
                      </div>
                      <div className={styles.stepDetailRow}>
                        <span className={styles.stepDetailLabel}>소비재</span>
                        <span className={styles.stepDetailNote}>
                          {costOptions.consumerGoods === "none"
                            ? "포함 안함"
                            : additionalCosts.consumerGoods[
                                costOptions.consumerGoods as number
                              ]?.level}
                        </span>
                        <span
                          className={`${styles.stepDetailValue} ${styles.animatedValue}`}
                        >
                          {formatBillion(consumerGoodsCost / 10000)}억
                        </span>
                      </div>
                      <div className={styles.stepDetailRow}>
                        <span className={styles.stepDetailLabel}>주거</span>
                        <span className={styles.stepDetailNote}>
                          {costOptions.housing
                            ? `${additionalCosts.housing[costOptions.housing.areaIndex]?.area} ${additionalCosts.housing[costOptions.housing.areaIndex]?.tiers[costOptions.housing.tierIndex]?.tier}`
                            : "미선택"}
                        </span>
                        <span
                          className={`${styles.stepDetailValue} ${styles.animatedValue}`}
                        >
                          {costOptions.housing
                            ? formatBillion(housingCost / 10000)
                            : "0"}
                          억
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: 총 필요 자금 */}
                  <div className={styles.stepCard}>
                    <div className={styles.stepHeader}>
                      <span className={styles.stepNumber}>Total</span>
                      <span className={styles.stepTitle}>총 필요 자금</span>
                    </div>
                    <div className={styles.stepMainResult}>
                      <div
                        className={`${styles.stepMainValue} ${styles.stepMainValueLarge} ${styles.animatedValue}`}
                      >
                        {formatBillion(totalRetirementNeed)}억
                      </div>
                      <div className={styles.stepMainLabel}>
                        우리 가족이 평생 필요한 돈
                      </div>
                    </div>
                    <div className={styles.stepCalcBox}>
                      <div className={styles.stepCalcRow}>
                        <span>기본 생활비</span>
                        <span className={styles.animatedValue}>
                          {formatBillion(m.totalDemand)}억
                        </span>
                      </div>
                      <div className={styles.stepCalcRow}>
                        <span>추가 비용</span>
                        <span className={styles.animatedValue}>
                          +{formatBillion(additionalCostTotal / 10000)}억
                        </span>
                      </div>
                      <div className={styles.stepCalcDivider}></div>
                      <div className={styles.stepCalcTotal}>
                        <span>총 필요 자금</span>
                        <span className={styles.animatedValue}>
                          {formatBillion(totalRetirementNeed)}억
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step 4: 진단 결과 */}
                  {(() => {
                    const totalSupply =
                      (m.monthlyPension * 12 * m.retirementYears) / 10000 +
                      m.liquidAssetAtRetirement;
                    const gap = totalSupply - totalRetirementNeed;
                    const gapRatio =
                      totalRetirementNeed > 0 ? gap / totalRetirementNeed : 0;

                    let diagnosisStatus:
                      | "critical"
                      | "caution"
                      | "lacking"
                      | "fair"
                      | "sufficient"
                      | "abundant";
                    let diagnosisLabel: string;
                    if (gapRatio < -0.5) {
                      diagnosisStatus = "critical";
                      diagnosisLabel = "심각";
                    } else if (gapRatio < -0.2) {
                      diagnosisStatus = "caution";
                      diagnosisLabel = "주의";
                    } else if (gapRatio < 0) {
                      diagnosisStatus = "lacking";
                      diagnosisLabel = "부족";
                    } else if (gapRatio < 0.1) {
                      diagnosisStatus = "fair";
                      diagnosisLabel = "양호";
                    } else if (gapRatio < 0.3) {
                      diagnosisStatus = "sufficient";
                      diagnosisLabel = "충분";
                    } else {
                      diagnosisStatus = "abundant";
                      diagnosisLabel = "여유";
                    }

                    return (
                      <div className={styles.stepCard}>
                        <div className={styles.stepHeader}>
                          <span className={styles.stepNumber}>Result</span>
                          <span className={styles.stepTitle}>진단 결과</span>
                        </div>
                        <div className={styles.stepMainResult}>
                          <div
                            className={`${styles.diagnosisBadge} ${styles[diagnosisStatus]}`}
                          >
                            {diagnosisLabel}
                          </div>
                          <div
                            className={`${styles.stepMainValue} ${styles.stepMainValueLarge} ${styles.animatedValue} ${gap >= 0 ? styles.positive : styles.negative}`}
                          >
                            {gap >= 0 ? "+" : ""}
                            {formatBillion(gap)}억
                          </div>
                          <div className={styles.stepMainLabel}>
                            {gap >= 0 ? "여유분" : "부족분"} (연금 + 금융자산 -
                            총 필요자금)
                          </div>
                          <div className={styles.diagnosisCriteria}>
                            연금수입 + 현재자산 + 저축여력 기준, 필요자금 대비{" "}
                            {Math.abs(Math.round(gapRatio * 100))}%{" "}
                            {gapRatio >= 0 ? "여유" : "부족"}
                          </div>
                        </div>

                        <div className={styles.stepSection}>
                          <div className={styles.stepSectionHeader}>
                            <span className={styles.stepSectionIcon}>1</span>
                            <span className={styles.stepSectionTitle}>
                              연금으로 충당
                            </span>
                            <span
                              className={`${styles.stepSectionValue} ${styles.animatedValue}`}
                            >
                              {formatBillion(
                                Math.round(
                                  ((m.monthlyPension * 12 * m.retirementYears) /
                                    10000) *
                                    100,
                                ) / 100,
                              )}
                              억
                            </span>
                          </div>
                          <div className={styles.stepSectionDesc}>
                            월 {m.monthlyPension}만원 x {m.retirementYears}년
                          </div>
                          <div className={styles.stepSubDetails}>
                            <div className={styles.stepSubRow}>
                              <span>국민연금</span>
                              <span>
                                {formatBillion(
                                  Math.round(
                                    ((m.nationalPensionInflated *
                                      12 *
                                      m.retirementYears) /
                                      10000) *
                                      100,
                                  ) / 100,
                                )}
                                억
                              </span>
                            </div>
                            {data.retirementPensionPersonal +
                              data.retirementPensionSpouse >
                              0 && (
                              <div className={styles.stepSubRow}>
                                <span>퇴직연금</span>
                                <span>
                                  {formatBillion(
                                    Math.round(
                                      (((data.retirementPensionPersonal +
                                        data.retirementPensionSpouse) *
                                        12 *
                                        m.retirementYears) /
                                        10000) *
                                        100,
                                    ) / 100,
                                  )}
                                  억
                                </span>
                              </div>
                            )}
                            {data.privatePensionPersonal +
                              data.privatePensionSpouse >
                              0 && (
                              <div className={styles.stepSubRow}>
                                <span>개인연금</span>
                                <span>
                                  {formatBillion(
                                    Math.round(
                                      (((data.privatePensionPersonal +
                                        data.privatePensionSpouse) *
                                        12 *
                                        m.retirementYears) /
                                        10000) *
                                        100,
                                    ) / 100,
                                  )}
                                  억
                                </span>
                              </div>
                            )}
                            {data.otherIncomePersonal + data.otherIncomeSpouse >
                              0 && (
                              <div className={styles.stepSubRow}>
                                <span>기타소득</span>
                                <span>
                                  {formatBillion(
                                    Math.round(
                                      (((data.otherIncomePersonal +
                                        data.otherIncomeSpouse) *
                                        12 *
                                        m.retirementYears) /
                                        10000) *
                                        100,
                                    ) / 100,
                                  )}
                                  억
                                </span>
                              </div>
                            )}
                          </div>
                          <div className={styles.stepSubNote}>
                            물가상승률{" "}
                            {Math.round(calcParams.inflationRate * 100)}%,
                            투자수익률{" "}
                            {Math.round(calcParams.financialGrowthRate * 100)}%
                            반영
                          </div>
                        </div>

                        <div className={styles.stepSection}>
                          <div className={styles.stepSectionHeader}>
                            <span className={styles.stepSectionIcon}>2</span>
                            <span className={styles.stepSectionTitle}>
                              은퇴 시점 예상 금융자산
                            </span>
                            <span
                              className={`${styles.stepSectionValue} ${styles.animatedValue}`}
                            >
                              {formatBillion(m.liquidAssetAtRetirement)}억
                            </span>
                          </div>
                          <div className={styles.stepSectionDesc}>
                            현재 저축 유지 + 투자수익률 (부동산 제외)
                          </div>
                          <div className={styles.stepSubDetails}>
                            <div className={styles.stepSubRow}>
                              <span>현재 금융자산</span>
                              <span>{formatBillion(m.financialAsset)}억</span>
                            </div>
                            <div className={styles.stepSubRow}>
                              <span>저축률 (유지 가정)</span>
                              <span>{Math.round(m.savingsRate)}%</span>
                            </div>
                            <div className={styles.stepSubRow}>
                              <span>소득 상승률</span>
                              <span className={styles.animatedValue}>
                                연{" "}
                                {Math.round(calcParams.incomeGrowthRate * 100)}%
                              </span>
                            </div>
                            <div className={styles.stepSubRow}>
                              <span>금융자산 수익률</span>
                              <span className={styles.animatedValue}>
                                연{" "}
                                {Math.round(
                                  calcParams.financialGrowthRate * 100,
                                )}
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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

            {/* Lycon Membership 소개 */}
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>Membership</span>
                <span className={styles.stepTitle}>Lycon 멤버십</span>
              </div>
              <div className={styles.membershipIntro}>
                <p>주기적인 관리로 원활한 재무 목표 달성</p>
              </div>
              <div className={styles.membershipTimeline}>
                <div className={styles.membershipTimelineItem}>
                  <span className={styles.membershipCycle}>주간</span>
                  <span className={styles.membershipService}>
                    맞춤 투자 전략 서한
                  </span>
                </div>
                <div className={styles.membershipTimelineItem}>
                  <span className={styles.membershipCycle}>월간</span>
                  <span className={styles.membershipService}>가계부 정리</span>
                </div>
                <div className={styles.membershipTimelineItem}>
                  <span className={styles.membershipCycle}>분기</span>
                  <span className={styles.membershipService}>
                    포트폴리오 리밸런싱
                  </span>
                </div>
                <div className={styles.membershipTimelineItem}>
                  <span className={styles.membershipCycle}>반기</span>
                  <span className={styles.membershipService}>
                    자산 진단 리포트
                  </span>
                </div>
                <div className={styles.membershipTimelineItem}>
                  <span className={styles.membershipCycle}>연간</span>
                  <span className={styles.membershipService}>
                    종합 재무 컨설팅
                  </span>
                </div>
              </div>
              <button className={styles.membershipButton}>
                멤버십 알아보기
              </button>
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
