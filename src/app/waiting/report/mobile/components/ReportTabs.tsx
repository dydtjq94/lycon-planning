"use client";

import { useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { DiagnosisData } from "@/app/admin/users/[id]/report/DiagnosisReport";
import { householdFinance2025, type AgeGroup, estimatePercentiles } from "@/lib/data/householdFinance2025";
import styles from "../mobile-report.module.css";

ChartJS.register(ArcElement, Tooltip);

interface ReportTabsProps {
  data: DiagnosisData;
  opinion: string;
}

type TabId = "summary" | "basic" | "detailed" | "opinion";

// 마크다운 파서
function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\n/g, "<br />");
}

export function ReportTabs({ data, opinion }: ReportTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [cashflowView, setCashflowView] = useState<"current" | "suggested">("current");

  // === 계산 로직 (DiagnosisReport.tsx와 동일) ===
  const financialAsset = data.cashAsset + data.investmentAsset;
  const totalAsset = data.realEstateAsset + financialAsset + data.pensionAsset;
  const totalDebt = data.mortgageAmount + data.creditLoanAmount + data.otherDebtAmount;
  const netWorth = Math.round((totalAsset - totalDebt / 10000) * 100) / 100;

  const livingExpense =
    data.expenseFood + data.expenseTransport + data.expenseShopping + data.expenseLeisure + data.expenseOther;

  const monthlyInterest = Math.round(
    (data.mortgageAmount * data.mortgageRate) / 100 / 12 +
    (data.creditLoanAmount * data.creditLoanRate) / 100 / 12 +
    (data.otherDebtAmount * data.otherDebtRate) / 100 / 12
  );

  const currentExpenseBase = data.monthlyFixedExpense + livingExpense + monthlyInterest;
  const currentMonthlyExpense = currentExpenseBase;
  const currentMonthlyGap = data.monthlyIncome - currentMonthlyExpense;
  const savingsRate = data.monthlyIncome > 0 ? (currentMonthlyGap / data.monthlyIncome) * 100 : 0;

  const yearsToRetirement = Math.max(0, data.targetRetirementAge - data.currentAge);
  const retirementYears = data.lifeExpectancy - data.targetRetirementAge;
  const inflationRate = 0.03;
  const growthRate = 0.025;

  // 국민연금 물가상승률 반영
  const nationalPensionInflated = Math.round(
    (data.nationalPensionPersonal + data.nationalPensionSpouse) *
    Math.pow(1 + inflationRate, yearsToRetirement)
  );

  const monthlyPension =
    nationalPensionInflated +
    data.retirementPensionPersonal +
    data.retirementPensionSpouse +
    data.privatePensionPersonal +
    data.privatePensionSpouse +
    data.otherIncomePersonal +
    data.otherIncomeSpouse;

  const monthlyExpense = Math.round(
    currentExpenseBase * Math.pow(1 + inflationRate, yearsToRetirement) * 0.7
  );
  const monthlyGap = monthlyPension - monthlyExpense;
  const pensionCoverageRate = monthlyExpense > 0 ? Math.round((monthlyPension / monthlyExpense) * 100) : 0;

  // 유동자산
  const liquidAsset = Math.round((financialAsset + data.pensionAsset) * 100) / 100;
  const liquidAssetAtRetirement =
    Math.round(liquidAsset * Math.pow(1 + growthRate, yearsToRetirement) * 100) / 100;

  const annualShortfall = monthlyGap < 0 ? (Math.abs(monthlyGap) * 12) / 10000 : 0;
  const yearsOfWithdrawal =
    liquidAssetAtRetirement <= 0
      ? 0
      : annualShortfall > 0
        ? Math.round((liquidAssetAtRetirement / annualShortfall) * 10) / 10
        : 999;

  const rawDepletionAge = data.targetRetirementAge + Math.floor(yearsOfWithdrawal);
  const assetDepletionAge = Math.min(rawDepletionAge, data.lifeExpectancy + 1);
  const isAssetSustainable = rawDepletionAge > data.lifeExpectancy;

  // 자산 비율
  const realEstateRatio = totalAsset > 0 ? Math.round((data.realEstateAsset / totalAsset) * 100) : 0;
  const cashRatio = totalAsset > 0 ? Math.round((data.cashAsset / totalAsset) * 100) : 0;
  const investmentRatio = totalAsset > 0 ? Math.round((data.investmentAsset / totalAsset) * 100) : 0;
  const pensionRatio = 100 - realEstateRatio - cashRatio - investmentRatio;

  // 부채 비율
  const mortgageRatio = totalDebt > 0 ? Math.round((data.mortgageAmount / totalDebt) * 100) : 0;
  const creditRatio = totalDebt > 0 ? Math.round((data.creditLoanAmount / totalDebt) * 100) : 0;
  const otherDebtRatio = 100 - mortgageRatio - creditRatio;
  const isMortgageRateGood = data.mortgageRate <= 4.5;
  const isCreditRateGood = data.creditLoanRate <= 7.0;
  const annualInterest = monthlyInterest * 12;
  const annualIncomeCalc = data.monthlyIncome * 12;
  const interestToIncome = annualIncomeCalc > 0 ? Math.round((annualInterest / annualIncomeCalc) * 100) : 0;

  // 지출 분석
  const fixedExpense = data.monthlyFixedExpense + monthlyInterest;
  const variableExpense = livingExpense;
  const totalAllExpense = fixedExpense + variableExpense;
  const fixedRatio = totalAllExpense > 0 ? Math.round((fixedExpense / totalAllExpense) * 100) : 0;
  const variableRatio = 100 - fixedRatio;

  // 지출 항목 (절감 포인트 포함)
  const expenseItems = [
    { key: "food", label: "식비", amount: data.expenseFood, color: "#1a365d", savingPotential: "low", savingTip: "외식 빈도 조절로 10~15% 절감 가능" },
    { key: "transport", label: "교통비", amount: data.expenseTransport, color: "#2c5282", savingPotential: "medium", savingTip: "대중교통 활용, 카풀로 20~30% 절감 가능" },
    { key: "shopping", label: "쇼핑/미용", amount: data.expenseShopping, color: "#3182ce", savingPotential: "high", savingTip: "충동구매 자제, 세일 활용으로 30~40% 절감 가능" },
    { key: "leisure", label: "유흥/여가", amount: data.expenseLeisure, color: "#63b3ed", savingPotential: "high", savingTip: "구독서비스 정리, 무료 활동으로 40~50% 절감 가능" },
    { key: "other", label: "기타", amount: data.expenseOther, color: "#bee3f8", savingPotential: "medium", savingTip: "불필요한 지출 점검으로 20~30% 절감 가능" },
  ].filter((item) => item.amount > 0);

  const totalExpenseAmount = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const expenseItemsWithRatio = expenseItems.map((item) => ({
    ...item,
    ratio: totalExpenseAmount > 0 ? Math.round((item.amount / totalExpenseAmount) * 100) : 0,
  }));

  // 절감 포인트 (가장 높은 절감 잠재력 항목)
  const highPotentialItems = expenseItemsWithRatio
    .filter((item) => item.savingPotential === "high" && item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const topSavingItem = highPotentialItems[0] || expenseItemsWithRatio.sort((a, b) => b.amount - a.amount)[0];

  // 동연령대 비교
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

  const annualIncome = data.monthlyIncome * 12;
  const incomePercentiles = estimatePercentiles(ageStats.income.median);
  const getIncomePercentileRange = (income: number) => {
    if (income >= incomePercentiles.p90) return { idx: 0, display: "상위 10%" };
    if (income >= incomePercentiles.p80) return { idx: 1, display: "상위 10~20%" };
    if (income >= incomePercentiles.p70) return { idx: 2, display: "상위 20~30%" };
    if (income >= incomePercentiles.p60) return { idx: 3, display: "상위 30~40%" };
    if (income >= ageStats.income.median) return { idx: 4, display: "상위 40~50%" };
    if (income >= incomePercentiles.p40) return { idx: 5, display: "상위 50~60%" };
    if (income >= incomePercentiles.p30) return { idx: 6, display: "상위 60~70%" };
    if (income >= incomePercentiles.p20) return { idx: 7, display: "상위 70~80%" };
    return { idx: 8, display: "상위 80~100%" };
  };
  const incomePercentile = getIncomePercentileRange(annualIncome);

  const netWorthPercentilesData = estimatePercentiles(ageStats.netWorth.median);
  const getNetWorthPercentileRange = (netWorthValue: number) => {
    const netWorthInManwon = netWorthValue * 10000;
    if (netWorthInManwon >= netWorthPercentilesData.p90) return { idx: 0, display: "상위 10%" };
    if (netWorthInManwon >= netWorthPercentilesData.p80) return { idx: 1, display: "상위 10~20%" };
    if (netWorthInManwon >= netWorthPercentilesData.p70) return { idx: 2, display: "상위 20~30%" };
    if (netWorthInManwon >= netWorthPercentilesData.p60) return { idx: 3, display: "상위 30~40%" };
    if (netWorthInManwon >= ageStats.netWorth.median) return { idx: 4, display: "상위 40~50%" };
    if (netWorthInManwon >= netWorthPercentilesData.p40) return { idx: 5, display: "상위 50~60%" };
    if (netWorthInManwon >= netWorthPercentilesData.p30) return { idx: 6, display: "상위 60~70%" };
    if (netWorthInManwon >= netWorthPercentilesData.p20) return { idx: 7, display: "상위 70~80%" };
    return { idx: 8, display: "상위 80~100%" };
  };
  const netWorthPercentile = getNetWorthPercentileRange(netWorth);

  const getSavingsPercentileRange = (rate: number) => {
    if (rate >= 35) return { idx: 0, display: "상위 10%" };
    if (rate >= 28) return { idx: 1, display: "상위 10~20%" };
    if (rate >= 22) return { idx: 2, display: "상위 20~30%" };
    if (rate >= 17) return { idx: 3, display: "상위 30~40%" };
    if (rate >= 13) return { idx: 4, display: "상위 40~50%" };
    if (rate >= 9) return { idx: 5, display: "상위 50~60%" };
    if (rate >= 5) return { idx: 6, display: "상위 60~70%" };
    if (rate >= 0) return { idx: 7, display: "상위 70~80%" };
    return { idx: 8, display: "상위 80~100%" };
  };
  const savingsPercentile = getSavingsPercentileRange(savingsRate);

  // 자금 수급
  const totalDemand = Math.round(((retirementYears * monthlyExpense * 12) / 10000) * 100) / 100;
  const totalPensionSupply = Math.round(((retirementYears * monthlyPension * 12) / 10000) * 100) / 100;
  const totalSupply = Math.round((totalPensionSupply + Math.max(0, liquidAssetAtRetirement)) * 100) / 100;
  const supplyDeficit = Math.round((totalDemand - totalSupply) * 100) / 100;
  const supplyRatio = totalDemand > 0 ? Math.round((totalSupply / totalDemand) * 100) : 0;

  // 은퇴 시점 예상 자산 (상세)
  const annualSavings = currentMonthlyGap > 0 ? (currentMonthlyGap * 12) / 10000 : 0;
  const realEstateGrowth = 0.02;
  const financialGrowth = 0.05;
  const pensionGrowth = 0.04;

  const realEstateAtRetirement =
    Math.round(data.realEstateAsset * Math.pow(1 + realEstateGrowth, yearsToRetirement) * 10) / 10;
  const financialAtRetirement =
    Math.round(
      (financialAsset * Math.pow(1 + financialGrowth, yearsToRetirement) +
        annualSavings *
        ((Math.pow(1 + financialGrowth, yearsToRetirement) - 1) / financialGrowth)) *
      10
    ) / 10;
  const pensionAtRetirement =
    Math.round(data.pensionAsset * Math.pow(1 + pensionGrowth, yearsToRetirement) * 10) / 10;
  const totalAtRetirement =
    Math.round((realEstateAtRetirement + financialAtRetirement + pensionAtRetirement) * 10) / 10;

  const debtAtRetirement = Math.round(totalDebt * 0.5);
  const netWorthAtRetirement =
    Math.round((totalAtRetirement - debtAtRetirement / 10000) * 10) / 10;

  const realEstateRatioAtRetirement = totalAtRetirement > 0 ? Math.round((realEstateAtRetirement / totalAtRetirement) * 100) : 0;
  const financialRatioAtRetirement = totalAtRetirement > 0 ? Math.round((financialAtRetirement / totalAtRetirement) * 100) : 0;
  const pensionRatioAtRetirement = 100 - realEstateRatioAtRetirement - financialRatioAtRetirement;

  // 은퇴 시나리오
  const calculateRetirementScenario = (retireAge: number) => {
    const yearsToRetire = Math.max(0, retireAge - data.currentAge);
    const retireYears = data.lifeExpectancy - retireAge;
    let assetAtRetire = liquidAsset;
    const annualSavingsCalc = currentMonthlyGap > 0 ? (currentMonthlyGap * 12) / 10000 : 0;
    for (let year = 0; year < yearsToRetire; year++) {
      assetAtRetire = assetAtRetire * (1 + growthRate) + annualSavingsCalc;
    }
    assetAtRetire = Math.round(assetAtRetire * 100) / 100;

    const expenseAtRetire = Math.round(currentExpenseBase * Math.pow(1 + inflationRate, yearsToRetire) * 0.7);
    const pensionAtRetire =
      Math.round(
        (data.nationalPensionPersonal + data.nationalPensionSpouse) *
        Math.pow(1 + inflationRate, yearsToRetire)
      ) +
      data.retirementPensionPersonal +
      data.retirementPensionSpouse +
      data.privatePensionPersonal +
      data.privatePensionSpouse;

    const gapAtRetire = pensionAtRetire - expenseAtRetire;
    const shortfallAtRetire = gapAtRetire < 0 ? (Math.abs(gapAtRetire) * 12) / 10000 : 0;
    const yearsOfWithdraw =
      assetAtRetire <= 0
        ? 0
        : shortfallAtRetire > 0
          ? Math.round((assetAtRetire / shortfallAtRetire) * 10) / 10
          : 999;
    const depletionAge = retireAge + Math.floor(yearsOfWithdraw);
    return {
      retireAge,
      assetAtRetire,
      depletionAge: Math.min(depletionAge, data.lifeExpectancy + 10),
      sustainable: yearsOfWithdraw >= retireYears,
    };
  };

  const earlyRetirement = calculateRetirementScenario(data.targetRetirementAge - 5);
  const normalRetirement = calculateRetirementScenario(data.targetRetirementAge);
  const lateRetirement = calculateRetirementScenario(data.targetRetirementAge + 5);

  // 리스크
  const getRiskLevel = (value: number, thresholds: [number, number]) => {
    if (value >= thresholds[1]) return "high";
    if (value >= thresholds[0]) return "medium";
    return "low";
  };

  // 요약 카드 상태
  const getSavingsStatus = () => {
    if (savingsRate >= 20) return { status: "good", label: "양호" };
    if (savingsRate >= 10) return { status: "caution", label: "주의" };
    return { status: "warning", label: "위험" };
  };
  const savingsStatus = getSavingsStatus();

  const getRetirementStatus = () => {
    if (pensionCoverageRate >= 100) return { status: "good", label: "양호" };
    if (pensionCoverageRate >= 70) return { status: "caution", label: "주의" };
    return { status: "warning", label: "위험" };
  };
  const retirementStatus = getRetirementStatus();

  const getPensionStatus = () => {
    if (pensionCoverageRate >= 80) return { status: "good", label: "양호" };
    if (pensionCoverageRate >= 50) return { status: "caution", label: "주의" };
    return { status: "warning", label: "위험" };
  };
  const pensionStatus = getPensionStatus();

  const getSustainabilityStatus = () => {
    if (yearsOfWithdrawal >= retirementYears) return { status: "good", label: "양호", value: "충분" };
    if (yearsOfWithdrawal >= retirementYears * 0.7) return { status: "caution", label: "주의", value: `${Math.round(yearsOfWithdrawal)}년` };
    return { status: "warning", label: "위험", value: `${Math.round(yearsOfWithdrawal)}년` };
  };
  const sustainabilityStatus = getSustainabilityStatus();

  // 제안
  const needsReduction = savingsRate < 30;
  const suggestedExpense = Math.round(currentMonthlyExpense * 0.85);
  const suggestedGap = data.monthlyIncome - suggestedExpense;

  // 노후생활비 기준 (KB금융 2025)
  const minLivingCost = Math.round(248 * Math.pow(1.03, yearsToRetirement));
  const adequateLivingCost = Math.round(350 * Math.pow(1.03, yearsToRetirement));

  // 도넛 차트 옵션
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: "55%",
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  };

  // 백분위 트랙
  const renderPercentileTrack = (indicatorIdx: number) => (
    <div className={styles.percentileTrack}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
        <div key={idx} className={styles.percentileSegment}>
          {idx === indicatorIdx && <div className={styles.percentileIndicator} />}
        </div>
      ))}
    </div>
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "summary", label: "요약" },
    { id: "basic", label: "기초" },
    { id: "detailed", label: "정밀" },
    { id: "opinion", label: "소견" },
  ];

  return (
    <div className={styles.tabsContainer}>
      <nav className={styles.tabNav}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.tabContent}>
        {/* ===== 요약 탭 ===== */}
        {activeTab === "summary" && (
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardTitle}>저축 여력</div>
              <div className={styles.summaryCardValue}>
                {savingsRate >= 0 ? `${Math.round(savingsRate)}%` : "적자"}
              </div>
              <div className={`${styles.summaryCardStatus} ${styles[savingsStatus.status]}`}>
                {savingsStatus.label}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardTitle}>은퇴 현금흐름</div>
              <div className={styles.summaryCardValue}>
                {monthlyGap >= 0 ? `+${monthlyGap}` : monthlyGap}만원
              </div>
              <div className={`${styles.summaryCardStatus} ${styles[retirementStatus.status]}`}>
                {retirementStatus.label}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardTitle}>연금 충당률</div>
              <div className={styles.summaryCardValue}>{pensionCoverageRate}%</div>
              <div className={`${styles.summaryCardStatus} ${styles[pensionStatus.status]}`}>
                {pensionStatus.label}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardTitle}>자산 지속성</div>
              <div className={styles.summaryCardValue}>{sustainabilityStatus.value}</div>
              <div className={`${styles.summaryCardStatus} ${styles[sustainabilityStatus.status]}`}>
                {sustainabilityStatus.label}
              </div>
            </div>
          </div>
        )}

        {/* ===== 기초진단 탭 ===== */}
        {activeTab === "basic" && (
          <>
            {/* 재무정보 요약 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>재무정보 요약</h3>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>총자산</span>
                  <span className={styles.summaryValue}>{totalAsset}억원</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>총부채</span>
                  <span className={`${styles.summaryValue} ${styles.negative}`}>
                    {(totalDebt / 10000).toFixed(1)}억원
                  </span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>순자산</span>
                  <span className={`${styles.summaryValue} ${styles.highlight}`}>{netWorth}억원</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>저축률</span>
                  <span className={styles.summaryValue}>{savingsRate.toFixed(0)}%</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>월 저축여력</span>
                  <span className={`${styles.summaryValue} ${currentMonthlyGap >= 0 ? styles.positive : styles.negative}`}>
                    {currentMonthlyGap >= 0 ? "+" : ""}{currentMonthlyGap}만원
                  </span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>은퇴까지</span>
                  <span className={styles.summaryValue}>{yearsToRetirement}년</span>
                </div>
              </div>
            </div>

            {/* 현금흐름 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>현금흐름</h3>
              {needsReduction && (
                <div className={styles.toggleContainer}>
                  <button
                    className={`${styles.toggleButton} ${cashflowView === "current" ? styles.active : ""}`}
                    onClick={() => setCashflowView("current")}
                  >
                    현재
                  </button>
                  <button
                    className={`${styles.toggleButton} ${cashflowView === "suggested" ? styles.active : ""}`}
                    onClick={() => setCashflowView("suggested")}
                  >
                    제안 (-15%)
                  </button>
                </div>
              )}
              <div className={styles.cashflowItem}>
                <div className={styles.cashflowLabel}>월 소득</div>
                <div className={styles.cashflowBarContainer}>
                  <div className={`${styles.cashflowBar} ${styles.income}`} style={{ width: "100%" }}>
                    <span className={styles.cashflowBarValue}>{data.monthlyIncome}만원</span>
                  </div>
                </div>
              </div>
              <div className={styles.cashflowItem}>
                <div className={styles.cashflowLabel}>월 지출</div>
                <div className={styles.cashflowBarContainer}>
                  <div
                    className={`${styles.cashflowBar} ${styles.expense}`}
                    style={{
                      width: `${Math.min(100, ((cashflowView === "current" ? currentMonthlyExpense : suggestedExpense) / data.monthlyIncome) * 100)}%`,
                    }}
                  >
                    <span className={styles.cashflowBarValue}>
                      {cashflowView === "current" ? currentMonthlyExpense : suggestedExpense}만원
                      {cashflowView === "suggested" && ` (-${currentMonthlyExpense - suggestedExpense})`}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.cashflowItem}>
                <div className={styles.cashflowLabel}>저축 여력</div>
                <div className={styles.cashflowBarContainer}>
                  {(() => {
                    const gap = cashflowView === "current" ? currentMonthlyGap : suggestedGap;
                    return (
                      <div
                        className={`${styles.cashflowBar} ${styles.gap} ${gap < 0 ? styles.negative : ""}`}
                        style={{ width: `${Math.min(100, (Math.abs(gap) / data.monthlyIncome) * 100)}%` }}
                      >
                        <span className={styles.cashflowBarValue}>
                          {gap >= 0 ? "+" : ""}{gap}만원
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              {/* 현금흐름 TIP */}
              {needsReduction && (
                <div className={styles.tipBox}>
                  <div className={styles.tipLabel}>TIP</div>
                  <div className={styles.tipText}>
                    {(() => {
                      const monthlySaving = Math.round(currentMonthlyExpense * 0.15);
                      const months = yearsToRetirement * 12;
                      const monthlyRate = 0.1 / 12;
                      const futureValue = monthlySaving * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
                      const formatAmount = (amount: number) => {
                        if (amount >= 10000) return `${Math.round((amount / 10000) * 10) / 10}억원`;
                        return `${Math.round(amount).toLocaleString()}만원`;
                      };
                      return `월 ${monthlySaving}만원 절감액을 연평균 10% 수익률로 은퇴시점까지 투자하면, 은퇴자산이 ${formatAmount(futureValue)} 늘어납니다.`;
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* 지출 분석 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>지출 분석</h3>
              <div className={styles.categoryRow}>
                <div className={`${styles.categoryItem} ${styles.fixed}`}>
                  <div className={styles.categoryLabel}>고정비 (필수 지출)</div>
                  <div className={styles.categoryValue}>{fixedExpense}만원</div>
                  <div className={styles.categoryRatio}>{fixedRatio}%</div>
                </div>
                <div className={`${styles.categoryItem} ${styles.variable}`}>
                  <div className={styles.categoryLabel}>변동비 (조절 가능)</div>
                  <div className={styles.categoryValue}>{variableExpense}만원</div>
                  <div className={styles.categoryRatio}>{variableRatio}%</div>
                </div>
              </div>
              <div className={styles.stackBarContainer}>
                {expenseItemsWithRatio.map((item) => (
                  <div
                    key={item.key}
                    className={styles.stackBarSegment}
                    style={{ width: `${item.ratio}%`, backgroundColor: item.color }}
                  >
                    {item.ratio >= 18 && <span className={styles.stackBarLabel}>{item.label}</span>}
                  </div>
                ))}
              </div>
              <div className={styles.expenseList}>
                {expenseItemsWithRatio
                  .sort((a, b) => b.amount - a.amount)
                  .map((item) => (
                    <div key={item.key} className={`${styles.expenseRow} ${item.savingPotential === "high" ? styles.highPotential : ""}`}>
                      <div className={styles.expenseInfo}>
                        <span className={styles.expenseDot} style={{ backgroundColor: item.color }} />
                        <span className={styles.expenseName}>{item.label}</span>
                      </div>
                      <div className={styles.expenseValues}>
                        <span className={styles.expenseAmount}>{item.amount}만원</span>
                        <span className={styles.expenseRatio}>{item.ratio}%</span>
                      </div>
                    </div>
                  ))}
              </div>
              {/* 절감 포인트 */}
              {topSavingItem && (
                <div className={styles.insightBox}>
                  <div className={styles.insightLabel}>절감 포인트</div>
                  <div className={styles.insightText}>
                    <strong>{topSavingItem.label}</strong> 항목이 변동비의 {topSavingItem.ratio}%를 차지합니다. {topSavingItem.savingTip}
                  </div>
                </div>
              )}
            </div>

            {/* 자산 분석 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>자산 구성</h3>
              <div className={styles.pieContainer}>
                <div className={styles.pieChart}>
                  <Doughnut
                    data={{
                      labels: ["부동산", "현금", "투자", "연금"],
                      datasets: [{
                        data: [realEstateRatio, cashRatio, investmentRatio, pensionRatio],
                        backgroundColor: ["#1a365d", "#3182ce", "#2c5282", "#63b3ed"],
                        borderWidth: 0,
                      }],
                    }}
                    options={chartOptions}
                  />
                </div>
                <div className={styles.pieLegend}>
                  <div className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.realestate}`} />
                    부동산 {realEstateRatio}%
                  </div>
                  <div className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.cash}`} />
                    현금 {cashRatio}%
                  </div>
                  <div className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.investment}`} />
                    투자 {investmentRatio}%
                  </div>
                  <div className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.pension}`} />
                    연금 {pensionRatio}%
                  </div>
                </div>
              </div>
              <div className={styles.commentBox}>
                {realEstateRatio >= 70
                  ? `부동산 ${realEstateRatio}%로 편중. 유동성 확보 필요`
                  : realEstateRatio >= 50
                    ? `부동산 ${realEstateRatio}%, 금융 ${cashRatio + investmentRatio}%로 균형 유지`
                    : `금융자산 ${cashRatio + investmentRatio}% 중심의 유동적 포트폴리오`}
              </div>
            </div>

            {/* 부채 분석 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>부채 현황</h3>
              {totalDebt === 0 ? (
                <div className={styles.noDebt}>
                  <div className={styles.noDebtText}>부채 없음</div>
                  <div className={styles.noDebtDesc}>훌륭합니다! 부채 없이 자산을 관리하고 계십니다.</div>
                </div>
              ) : (
                <>
                  <div className={styles.pieContainer}>
                    <div className={styles.pieChart}>
                      <Doughnut
                        data={{
                          labels: ["주담대", "신용", "기타"],
                          datasets: [{
                            data: [mortgageRatio, creditRatio, otherDebtRatio],
                            backgroundColor: ["#1a365d", "#c53030", "#d69e2e"],
                            borderWidth: 0,
                          }],
                        }}
                        options={chartOptions}
                      />
                    </div>
                    <div className={styles.pieLegend}>
                      {data.mortgageAmount > 0 && (
                        <div className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.mortgage}`} />
                          주담대 {mortgageRatio}%
                          <span className={`${styles.rateBadge} ${isMortgageRateGood ? styles.good : styles.warning}`}>
                            {data.mortgageRate}%
                          </span>
                        </div>
                      )}
                      {data.creditLoanAmount > 0 && (
                        <div className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.credit}`} />
                          신용 {creditRatio}%
                          <span className={`${styles.rateBadge} ${isCreditRateGood ? styles.good : styles.warning}`}>
                            {data.creditLoanRate}%
                          </span>
                        </div>
                      )}
                      {data.otherDebtAmount > 0 && (
                        <div className={styles.legendItem}>
                          <span className={`${styles.legendDot} ${styles.other}`} />
                          기타 {otherDebtRatio}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.commentBox}>
                    {(() => {
                      const comments = [];
                      comments.push(`총 ${(totalDebt / 10000).toFixed(1)}억, 월 이자 ${monthlyInterest}만원`);
                      if (interestToIncome > 20) {
                        comments.push(`이자 부담 ${interestToIncome}%로 과다 (권장 20% 이하)`);
                      } else if (interestToIncome > 10) {
                        comments.push(`이자 부담 ${interestToIncome}%로 주의 필요`);
                      } else {
                        comments.push(`이자 부담 ${interestToIncome}%로 양호`);
                      }
                      if (data.creditLoanAmount > 0 && !isCreditRateGood) {
                        comments.push(`신용대출 금리 ${data.creditLoanRate}% - 대환 검토 권장`);
                      }
                      return comments.join(". ");
                    })()}
                  </div>
                </>
              )}
            </div>

            {/* 동연령대 비교 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                동연령대 비교 <span className={styles.cardSubtitle}>({ageGroup})</span>
              </h3>
              <div className={styles.percentileRow}>
                <div className={styles.percentileLabel}>연소득</div>
                {renderPercentileTrack(incomePercentile.idx)}
                <div className={styles.percentileInfo}>
                  <span>하위</span>
                  <span className={styles.percentileValue}>
                    {incomePercentile.display} ({((data.monthlyIncome * 12) / 10000).toFixed(1)}억)
                  </span>
                  <span>상위</span>
                </div>
              </div>
              <div className={styles.percentileRow}>
                <div className={styles.percentileLabel}>순자산</div>
                {renderPercentileTrack(netWorthPercentile.idx)}
                <div className={styles.percentileInfo}>
                  <span>하위</span>
                  <span className={styles.percentileValue}>
                    {netWorthPercentile.display} ({netWorth}억)
                  </span>
                  <span>상위</span>
                </div>
              </div>
              <div className={styles.percentileRow}>
                <div className={styles.percentileLabel}>저축률</div>
                {renderPercentileTrack(savingsPercentile.idx)}
                <div className={styles.percentileInfo}>
                  <span>하위</span>
                  <span className={styles.percentileValue}>
                    {savingsPercentile.display} ({savingsRate.toFixed(0)}%)
                  </span>
                  <span>상위</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===== 정밀진단 탭 ===== */}
        {activeTab === "detailed" && (
          <>
            {/* 은퇴 가능 여부 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>은퇴 가능 여부</h3>
              {(() => {
                const isRetirementPossible = monthlyGap >= 0;
                const coverageGap = monthlyExpense - monthlyPension;
                const requiredAdditionalAsset =
                  coverageGap > 0 ? Math.round(((coverageGap * 12 * retirementYears) / 10000) * 10) / 10 : 0;
                const hasEnoughAsset = liquidAssetAtRetirement >= requiredAdditionalAsset;

                let verdictStatus: "possible" | "conditional" | "difficult";
                let verdictMessage: string;
                let verdictDetail: string;

                if (isRetirementPossible) {
                  verdictStatus = "possible";
                  verdictMessage = `${data.targetRetirementAge}세 은퇴 가능`;
                  verdictDetail = `연금 수입만으로 예상 생활비를 충당할 수 있습니다.`;
                } else if (hasEnoughAsset) {
                  verdictStatus = "conditional";
                  verdictMessage = `${data.targetRetirementAge}세 은퇴 조건부 가능`;
                  verdictDetail = isAssetSustainable
                    ? `연금만으로는 부족하나, 보유 자산으로 기대수명(${data.lifeExpectancy}세)까지 충분히 보완 가능합니다.`
                    : `연금만으로는 부족하나, 보유 자산으로 보완 가능합니다. 다만 ${assetDepletionAge}세 이후 자산 소진에 대비가 필요합니다.`;
                } else {
                  verdictStatus = "difficult";
                  verdictMessage = `${data.targetRetirementAge}세 은퇴 재검토 필요`;
                  verdictDetail = `현재 준비 상황으로는 은퇴 후 현금흐름 유지가 어렵습니다. 추가 준비가 필요합니다.`;
                }

                return (
                  <>
                    <div className={styles.verdictHeader}>
                      <div className={`${styles.verdictBadge} ${styles[verdictStatus]}`}>
                        {verdictStatus === "possible" && "가능"}
                        {verdictStatus === "conditional" && "조건부"}
                        {verdictStatus === "difficult" && "재검토"}
                      </div>
                      <div className={styles.verdictTitle}>{verdictMessage}</div>
                    </div>
                    <div className={styles.verdictDesc}>{verdictDetail}</div>
                  </>
                );
              })()}
              <div className={styles.breakdownGrid}>
                <div className={styles.breakdownItem}>
                  <div className={styles.breakdownLabel}>예상 생활비</div>
                  <div className={styles.breakdownValue}>{monthlyExpense}만원/월</div>
                  <div className={styles.breakdownDesc}>물가상승 연3%, 은퇴직전 지출의 70%</div>
                </div>
                <div className={styles.breakdownItem}>
                  <div className={styles.breakdownLabel}>예상 연금</div>
                  <div className={styles.breakdownValue}>{monthlyPension}만원/월</div>
                  <div className={styles.breakdownDesc}>국민(물가반영)+퇴직+개인 합산</div>
                </div>
                <div className={styles.breakdownItem}>
                  <div className={styles.breakdownLabel}>월 현금흐름</div>
                  <div className={`${styles.breakdownValue} ${monthlyGap >= 0 ? styles.positive : styles.negative}`}>
                    {monthlyGap >= 0 ? "+" : ""}{monthlyGap}만원
                  </div>
                  <div className={styles.breakdownDesc}>{monthlyGap >= 0 ? "자산 보존 가능" : "자산에서 인출 필요"}</div>
                </div>
                <div className={styles.breakdownItem}>
                  <div className={styles.breakdownLabel}>연금 충당률</div>
                  <div className={`${styles.breakdownValue} ${pensionCoverageRate >= 80 ? styles.positive : pensionCoverageRate < 50 ? styles.negative : ""}`}>
                    {pensionCoverageRate}%
                  </div>
                  <div className={styles.breakdownDesc}>
                    {pensionCoverageRate >= 80 ? "여유" : pensionCoverageRate >= 60 ? "적정" : pensionCoverageRate >= 40 ? "부족" : "심각한 부족"}
                  </div>
                </div>
              </div>
              {/* 노후생활비 참고 */}
              <div className={styles.referenceBox}>
                노후생활비 기준 (KB금융 2025, 2인가구): 최소 248만원 / 적정 350만원
                → {data.targetRetirementAge}세 기준 최소 {minLivingCost}만원 / 적정 {adequateLivingCost}만원
              </div>
            </div>

            {/* 3층 연금 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>3층 연금 준비현황</h3>
              <div className={styles.pensionColumns}>
                <div className={styles.pensionColumn}>
                  <div className={`${styles.pensionLayer} ${styles.layer1}`}>1층</div>
                  <div className={styles.pensionType}>국민연금</div>
                  <div className={styles.pensionAmount}>
                    {data.nationalPensionPersonal + data.nationalPensionSpouse}만원/월
                  </div>
                  <div className={styles.pensionNote}>
                    {data.targetRetirementAge}세 기준 {nationalPensionInflated}만원/월
                  </div>
                </div>
                <div className={styles.pensionColumn}>
                  <div className={`${styles.pensionLayer} ${styles.layer2}`}>2층</div>
                  <div className={styles.pensionType}>퇴직연금</div>
                  <div className={styles.pensionAmount}>
                    {data.retirementPensionPersonal + data.retirementPensionSpouse}만원/월
                  </div>
                  {(data.retirementPensionPersonal + data.retirementPensionSpouse) > 0 && (
                    <div className={styles.pensionNote}>{retirementYears}년 인출 가정</div>
                  )}
                </div>
                <div className={styles.pensionColumn}>
                  <div className={`${styles.pensionLayer} ${styles.layer3}`}>3층</div>
                  <div className={styles.pensionType}>개인연금</div>
                  <div className={styles.pensionAmount}>
                    {data.privatePensionPersonal + data.privatePensionSpouse}만원/월
                  </div>
                  {(data.privatePensionPersonal + data.privatePensionSpouse) > 0 && (
                    <div className={styles.pensionNote}>{retirementYears}년 인출 가정</div>
                  )}
                </div>
              </div>
            </div>

            {/* 자금 수급 분석 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                은퇴 후 자금 수급 분석 <span className={styles.cardSubtitle}>* 현재 물가 기준</span>
              </h3>
              <div className={styles.supplyDemandRow}>
                <div className={styles.sdLabel}>총수요 ({retirementYears}년)</div>
                <div className={styles.sdTrack}>
                  <div className={`${styles.sdBar} ${styles.demand}`} style={{ width: "100%" }}>
                    {totalDemand}억
                  </div>
                </div>
              </div>
              <div className={styles.supplyDemandRow}>
                <div className={styles.sdLabel}>총공급</div>
                <div className={styles.sdTrack}>
                  <div className={`${styles.sdBar} ${styles.supply}`} style={{ width: `${Math.min(100, supplyRatio)}%` }}>
                    {totalSupply}억
                  </div>
                  {supplyDeficit > 0 && (
                    <div className={`${styles.sdBar} ${styles.deficit}`} style={{ width: `${100 - supplyRatio}%` }}>
                      -{supplyDeficit}억
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.sdLegend}>
                <span className={styles.sdLegendItem}><span className={`${styles.sdLegendDot} ${styles.demand}`}></span>총 지출 수요</span>
                <span className={styles.sdLegendItem}><span className={`${styles.sdLegendDot} ${styles.supply}`}></span>확보 현금흐름</span>
                {supplyDeficit > 0 && (
                  <span className={styles.sdLegendItem}><span className={`${styles.sdLegendDot} ${styles.deficit}`}></span>부족분</span>
                )}
              </div>
            </div>

            {/* 은퇴 시 예상 자산 (상세) */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>은퇴 시점 예상 자산 ({data.targetRetirementAge}세)</h3>
              <div className={styles.assetComparison}>
                <div className={styles.assetCompareItem}>
                  <div className={styles.assetCompareLabel}>현재</div>
                  <div className={styles.assetCompareValue}>{totalAsset}억</div>
                </div>
                <div className={styles.assetCompareArrow}>→</div>
                <div className={`${styles.assetCompareItem} ${styles.highlight}`}>
                  <div className={styles.assetCompareLabel}>{yearsToRetirement}년 후</div>
                  <div className={styles.assetCompareValue}>{totalAtRetirement}억</div>
                </div>
              </div>
              {/* 자산 상세 내역 */}
              <div className={styles.assetDetailList}>
                <div className={styles.assetDetailRow}>
                  <span className={`${styles.legendDot} ${styles.realestate}`}></span>
                  <span className={styles.assetDetailLabel}>부동산</span>
                  <span className={styles.assetDetailValue}>{realEstateAtRetirement}억</span>
                  <span className={styles.assetDetailRatio}>({realEstateRatioAtRetirement}%)</span>
                </div>
                <div className={styles.assetDetailRow}>
                  <span className={`${styles.legendDot} ${styles.investment}`}></span>
                  <span className={styles.assetDetailLabel}>금융자산</span>
                  <span className={styles.assetDetailValue}>{financialAtRetirement}억</span>
                  <span className={styles.assetDetailRatio}>({financialRatioAtRetirement}%)</span>
                </div>
                <div className={styles.assetDetailRow}>
                  <span className={`${styles.legendDot} ${styles.pension}`}></span>
                  <span className={styles.assetDetailLabel}>연금</span>
                  <span className={styles.assetDetailValue}>{pensionAtRetirement}억</span>
                  <span className={styles.assetDetailRatio}>({pensionRatioAtRetirement}%)</span>
                </div>
              </div>
              <div className={styles.assetSummaryRow}>
                <div className={styles.assetSummaryItem}>
                  <span className={styles.assetSummaryLabel}>예상 총자산</span>
                  <span className={styles.assetSummaryValue}>{totalAtRetirement}억원</span>
                </div>
                <div className={styles.assetSummaryItem}>
                  <span className={styles.assetSummaryLabel}>예상 부채</span>
                  <span className={`${styles.assetSummaryValue} ${styles.negative}`}>{(debtAtRetirement / 10000).toFixed(1)}억원</span>
                </div>
                <div className={`${styles.assetSummaryItem} ${styles.highlight}`}>
                  <span className={styles.assetSummaryLabel}>예상 순자산</span>
                  <span className={styles.assetSummaryValue}>{netWorthAtRetirement}억원</span>
                </div>
              </div>
              <div className={styles.calculationNote}>
                산출 기준: 부동산 연 2% 성장, 금융자산 연 5% 성장(저축 누적 포함), 연금 연 4% 성장, 부채 50% 상환 가정
              </div>
            </div>

            {/* 은퇴 시기별 비교 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>은퇴 시기별 비교</h3>
              <p className={styles.cardDesc}>은퇴 시기를 5년 앞당기거나 늦추면 어떻게 될까요?</p>
              <div className={styles.scenarioCards}>
                <div className={styles.scenarioCard}>
                  <div className={`${styles.scenarioHeader} ${styles.early}`}>5년 일찍</div>
                  <div className={styles.scenarioBody}>
                    <div className={styles.scenarioAge}>{earlyRetirement.retireAge}세</div>
                    <div className={styles.scenarioStat}>
                      자산 <span className={styles.scenarioStatValue}>{earlyRetirement.assetAtRetire}억</span>
                    </div>
                    <div className={styles.scenarioStat}>
                      소진{" "}
                      <span className={`${styles.scenarioStatValue} ${!earlyRetirement.sustainable ? styles.danger : ""}`}>
                        {earlyRetirement.sustainable ? "안됨" : `${earlyRetirement.depletionAge}세`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`${styles.scenarioCard} ${styles.current}`}>
                  <div className={`${styles.scenarioHeader} ${styles.currentHeader}`}>현재</div>
                  <div className={styles.scenarioBody}>
                    <div className={styles.scenarioAge}>{normalRetirement.retireAge}세</div>
                    <div className={styles.scenarioStat}>
                      자산 <span className={styles.scenarioStatValue}>{normalRetirement.assetAtRetire}억</span>
                    </div>
                    <div className={styles.scenarioStat}>
                      소진{" "}
                      <span className={`${styles.scenarioStatValue} ${!normalRetirement.sustainable ? styles.danger : ""}`}>
                        {normalRetirement.sustainable ? "안됨" : `${normalRetirement.depletionAge}세`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.scenarioCard}>
                  <div className={`${styles.scenarioHeader} ${styles.late}`}>5년 늦게</div>
                  <div className={styles.scenarioBody}>
                    <div className={styles.scenarioAge}>{lateRetirement.retireAge}세</div>
                    <div className={styles.scenarioStat}>
                      자산 <span className={styles.scenarioStatValue}>{lateRetirement.assetAtRetire}억</span>
                    </div>
                    <div className={styles.scenarioStat}>
                      소진{" "}
                      <span className={`${styles.scenarioStatValue} ${!lateRetirement.sustainable ? styles.danger : ""}`}>
                        {lateRetirement.sustainable ? "안됨" : `${lateRetirement.depletionAge}세`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 리스크 진단 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>리스크 진단</h3>
              <div className={styles.riskRow}>
                <div className={styles.riskLabel}>부동산 편중</div>
                <div className={styles.riskTrack}>
                  <div className={`${styles.riskZone} ${styles.high}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.medium}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.low}`} style={{ width: "40%" }} />
                  <div
                    className={`${styles.riskIndicator} ${styles[getRiskLevel(realEstateRatio, [50, 70])]}`}
                    style={{ left: `${Math.max(0, Math.min(100, 100 - realEstateRatio))}%` }}
                  />
                </div>
                <div className={styles.riskValue}>{realEstateRatio}%</div>
              </div>
              <div className={styles.riskRow}>
                <div className={styles.riskLabel}>현금흐름</div>
                <div className={styles.riskTrack}>
                  <div className={`${styles.riskZone} ${styles.high}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.medium}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.low}`} style={{ width: "40%" }} />
                  <div
                    className={`${styles.riskIndicator} ${styles[monthlyGap >= 0 ? "low" : getRiskLevel(Math.abs(monthlyGap), [50, 150])]}`}
                    style={{ left: `${monthlyGap >= 0 ? 100 : Math.max(0, Math.min(100, 100 - Math.abs(monthlyGap) / 2))}%` }}
                  />
                </div>
                <div className={styles.riskValue}>{monthlyGap >= 0 ? "+" : ""}{monthlyGap}만원</div>
              </div>
              <div className={styles.riskRow}>
                <div className={styles.riskLabel}>연금 충당률</div>
                <div className={styles.riskTrack}>
                  <div className={`${styles.riskZone} ${styles.high}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.medium}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.low}`} style={{ width: "40%" }} />
                  <div
                    className={`${styles.riskIndicator} ${styles[pensionCoverageRate >= 80 ? "low" : pensionCoverageRate >= 50 ? "medium" : "high"]}`}
                    style={{ left: `${Math.min(100, pensionCoverageRate)}%` }}
                  />
                </div>
                <div className={styles.riskValue}>{pensionCoverageRate}%</div>
              </div>
            </div>
          </>
        )}

        {/* ===== 소견 탭 ===== */}
        {activeTab === "opinion" && (
          <>
            {/* 담당자 소견 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                담당자 소견 <span className={styles.cardSubtitle}>| 손균우 은퇴 설계 전문가</span>
              </h3>
              {opinion ? (
                <div
                  className={styles.opinionContent}
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(opinion) }}
                />
              ) : (
                <div className={styles.opinionContent}>
                  담당자 소견이 아직 작성되지 않았습니다.
                </div>
              )}
            </div>

            {/* 다음 단계 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>다음 단계</h3>
              <div className={styles.nextSteps}>
                <div className={styles.nextStepItem}>
                  <div className={styles.stepNumber}>1</div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepTitle}>진단 결과 상세 설명</div>
                    <div className={styles.stepDesc}>이 진단서의 각 항목에 대한 자세한 해설</div>
                  </div>
                </div>
                <div className={styles.nextStepItem}>
                  <div className={styles.stepNumber}>2</div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepTitle}>투자 포트폴리오 가이드</div>
                    <div className={styles.stepDesc}>현재 투자 분석 및 최적 투자 전략 제안</div>
                  </div>
                </div>
                <div className={styles.nextStepItem}>
                  <div className={styles.stepNumber}>3</div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepTitle}>맞춤 액션 플랜</div>
                    <div className={styles.stepDesc}>지금 당장 실행할 수 있는 구체적인 행동 가이드</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 전문진단 안내 */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>전문진단 안내</h3>
              <p className={styles.cardDesc}>
                기초진단과 정밀진단 결과를 바탕으로, 아래 전문진단을 통해 더 깊은 분석이 가능합니다.
              </p>
              <div className={styles.optionsGroup}>
                <div className={styles.optionsGroupHeader}>기본 제공</div>
                <div className={`${styles.optionItem} ${styles.included}`}>
                  <span className={styles.optionCheck}>V</span>
                  <span className={styles.optionName}>은퇴 목표 달성 시나리오 2종</span>
                  <span className={`${styles.optionTag} ${styles.free}`}>기본</span>
                </div>
                <div className={`${styles.optionItem} ${styles.included}`}>
                  <span className={styles.optionCheck}>V</span>
                  <span className={styles.optionName}>투자 포트폴리오 분석</span>
                  <span className={`${styles.optionTag} ${styles.free}`}>기본</span>
                </div>
              </div>
              <div className={styles.optionsGroup}>
                <div className={styles.optionsGroupHeader}>추가 분석 (선택)</div>
                <div className={styles.optionItem}>
                  <span className={styles.optionCheckEmpty}></span>
                  <div className={styles.optionContent}>
                    <span className={styles.optionName}>절세 방안 분석</span>
                    <span className={styles.optionDesc}>연금 인출 순서, 세액공제 최적화</span>
                  </div>
                </div>
                <div className={styles.optionItem}>
                  <span className={styles.optionCheckEmpty}></span>
                  <div className={styles.optionContent}>
                    <span className={styles.optionName}>주택연금 적합성 분석</span>
                    <span className={styles.optionDesc}>가입 시기, 예상 수령액 시뮬레이션</span>
                  </div>
                </div>
                <div className={styles.optionItem}>
                  <span className={styles.optionCheckEmpty}></span>
                  <div className={styles.optionContent}>
                    <span className={styles.optionName}>상속/증여 플랜</span>
                    <span className={styles.optionDesc}>사전 증여 vs 상속, 절세 전략</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
