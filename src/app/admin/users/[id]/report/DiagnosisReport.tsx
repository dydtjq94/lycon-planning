"use client";

import { useState } from "react";
import styles from "./DiagnosisReport.module.css";
import { householdFinance2025, type AgeGroup, estimatePercentiles } from "@/lib/data/householdFinance2025";

export interface DiagnosisData {
  customerName: string;
  currentAge: number;
  spouseAge: number | null;
  lifeExpectancy: number;
  targetRetirementAge: number;

  // 연금 (만원/월)
  nationalPensionPersonal: number;
  nationalPensionSpouse: number;
  retirementPensionPersonal: number;
  retirementPensionSpouse: number;
  privatePensionPersonal: number;
  privatePensionSpouse: number;
  otherIncomePersonal: number;
  otherIncomeSpouse: number;

  // 자산 (억원)
  realEstateAsset: number;
  cashAsset: number;
  investmentAsset: number;
  pensionAsset: number;

  // 부채 (만원)
  mortgageAmount: number;
  mortgageRate: number;
  creditLoanAmount: number;
  creditLoanRate: number;
  otherDebtAmount: number;
  otherDebtRate: number;

  // 현금흐름 (만원/월)
  monthlyIncome: number;
  monthlyFixedExpense: number;
  monthlyLivingExpense: number;

  // 지출 세부 항목 (만원/월)
  expenseFood: number;
  expenseTransport: number;
  expenseShopping: number;
  expenseLeisure: number;
  expenseOther: number;
}

interface DiagnosisReportProps {
  data: DiagnosisData;
  userId: string;
  isPublished?: boolean;
  hideActions?: boolean;
  opinion?: string;
  onOpinionChange?: (opinion: string) => void;
}

// 간단한 마크다운 파서
function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\n/g, "<br />");
}

export function DiagnosisReport({
  data,
  userId,
  isPublished = false,
  hideActions = false,
  opinion = "",
  onOpinionChange,
}: DiagnosisReportProps) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(isPublished);

  // 금융자산 = 현금 + 투자
  const financialAsset = data.cashAsset + data.investmentAsset;
  const totalAsset = data.realEstateAsset + financialAsset + data.pensionAsset;
  const totalDebt = data.mortgageAmount + data.creditLoanAmount + data.otherDebtAmount;
  const netWorth = Math.round((totalAsset - totalDebt / 10000) * 100) / 100;

  // 생활비 = 지출 세부 항목 합계
  const livingExpense =
    data.expenseFood + data.expenseTransport + data.expenseShopping + data.expenseLeisure + data.expenseOther;

  // 월 이자 계산
  const monthlyInterest = Math.round(
    (data.mortgageAmount * data.mortgageRate) / 100 / 12 +
      (data.creditLoanAmount * data.creditLoanRate) / 100 / 12 +
      (data.otherDebtAmount * data.otherDebtRate) / 100 / 12
  );

  // 현재 지출 기준 (이자 포함)
  const currentExpenseBase = data.monthlyFixedExpense + livingExpense + monthlyInterest;
  const inflationRate = 0.03;
  const yearsToRetirementForExpense = Math.max(0, data.targetRetirementAge - data.currentAge);

  // 국민연금 물가상승률 반영
  const nationalPensionInflated = Math.round(
    (data.nationalPensionPersonal + data.nationalPensionSpouse) *
      Math.pow(1 + inflationRate, yearsToRetirementForExpense)
  );

  // 월 연금
  const monthlyPension =
    nationalPensionInflated +
    data.retirementPensionPersonal +
    data.retirementPensionSpouse +
    data.privatePensionPersonal +
    data.privatePensionSpouse +
    data.otherIncomePersonal +
    data.otherIncomeSpouse;

  // 은퇴 시점 예상 지출
  const monthlyExpense = Math.round(
    currentExpenseBase * Math.pow(1 + inflationRate, yearsToRetirementForExpense) * 0.7
  );
  const monthlyGap = monthlyPension - monthlyExpense;

  const currentMonthlyExpense = data.monthlyFixedExpense + livingExpense + monthlyInterest;
  const currentMonthlyGap = data.monthlyIncome - currentMonthlyExpense;

  // 자산 비율
  const realEstateRatio = totalAsset > 0 ? Math.round((data.realEstateAsset / totalAsset) * 100) : 0;
  const cashRatio = totalAsset > 0 ? Math.round((data.cashAsset / totalAsset) * 100) : 0;
  const investmentRatio = totalAsset > 0 ? Math.round((data.investmentAsset / totalAsset) * 100) : 0;
  const pensionRatio = 100 - realEstateRatio - cashRatio - investmentRatio;

  // 유동자산
  const liquidAsset = Math.round((financialAsset + data.pensionAsset) * 100) / 100;

  const yearsToRetirement = Math.max(0, data.targetRetirementAge - data.currentAge);
  const growthRate = 0.025;
  const liquidAssetAtRetirement =
    Math.round(liquidAsset * Math.pow(1 + growthRate, yearsToRetirement) * 100) / 100;

  const retirementYears = data.lifeExpectancy - data.targetRetirementAge;
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

  const pensionCoverageRate = monthlyExpense > 0 ? Math.round((monthlyPension / monthlyExpense) * 100) : 0;

  const totalDemand = Math.round(((retirementYears * monthlyExpense * 12) / 10000) * 100) / 100;
  const totalPensionSupply = Math.round(((retirementYears * monthlyPension * 12) / 10000) * 100) / 100;
  const totalSupply = Math.round((totalPensionSupply + Math.max(0, liquidAssetAtRetirement)) * 100) / 100;
  const supplyDeficit = Math.round((totalDemand - totalSupply) * 100) / 100;
  const supplyRatio = totalDemand > 0 ? Math.round((totalSupply / totalDemand) * 100) : 0;
  const deficitRatio = 100 - supplyRatio;

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
  const getIncomePercentileRange = (income: number): { start: number; end: number; display: string } => {
    if (income >= incomePercentiles.p90) return { start: 0, end: 10, display: "상위 10%" };
    if (income >= incomePercentiles.p80) return { start: 10, end: 20, display: "상위 10~20%" };
    if (income >= incomePercentiles.p70) return { start: 20, end: 30, display: "상위 20~30%" };
    if (income >= incomePercentiles.p60) return { start: 30, end: 40, display: "상위 30~40%" };
    if (income >= ageStats.income.median) return { start: 40, end: 50, display: "상위 40~50%" };
    if (income >= incomePercentiles.p40) return { start: 50, end: 60, display: "상위 50~60%" };
    if (income >= incomePercentiles.p30) return { start: 60, end: 70, display: "상위 60~70%" };
    if (income >= incomePercentiles.p20) return { start: 70, end: 80, display: "상위 70~80%" };
    return { start: 80, end: 100, display: "상위 80~100%" };
  };
  const incomePercentile = getIncomePercentileRange(annualIncome);

  const netWorthPercentiles = estimatePercentiles(ageStats.netWorth.median);
  const getNetWorthPercentileRange = (
    netWorthValue: number
  ): { start: number; end: number; display: string } => {
    const netWorthInManwon = netWorthValue * 10000;
    if (netWorthInManwon >= netWorthPercentiles.p90) return { start: 0, end: 10, display: "상위 10%" };
    if (netWorthInManwon >= netWorthPercentiles.p80) return { start: 10, end: 20, display: "상위 10~20%" };
    if (netWorthInManwon >= netWorthPercentiles.p70) return { start: 20, end: 30, display: "상위 20~30%" };
    if (netWorthInManwon >= netWorthPercentiles.p60) return { start: 30, end: 40, display: "상위 30~40%" };
    if (netWorthInManwon >= ageStats.netWorth.median) return { start: 40, end: 50, display: "상위 40~50%" };
    if (netWorthInManwon >= netWorthPercentiles.p40) return { start: 50, end: 60, display: "상위 50~60%" };
    if (netWorthInManwon >= netWorthPercentiles.p30) return { start: 60, end: 70, display: "상위 60~70%" };
    if (netWorthInManwon >= netWorthPercentiles.p20) return { start: 70, end: 80, display: "상위 70~80%" };
    return { start: 80, end: 100, display: "상위 80~100%" };
  };
  const netWorthPercentile = getNetWorthPercentileRange(netWorth);

  const savingsRate = data.monthlyIncome > 0 ? (currentMonthlyGap / data.monthlyIncome) * 100 : 0;
  const getSavingsPercentileRange = (rate: number): { start: number; end: number; display: string } => {
    if (rate >= 35) return { start: 0, end: 10, display: "상위 10%" };
    if (rate >= 28) return { start: 10, end: 20, display: "상위 10~20%" };
    if (rate >= 22) return { start: 20, end: 30, display: "상위 20~30%" };
    if (rate >= 17) return { start: 30, end: 40, display: "상위 30~40%" };
    if (rate >= 13) return { start: 40, end: 50, display: "상위 40~50%" };
    if (rate >= 9) return { start: 50, end: 60, display: "상위 50~60%" };
    if (rate >= 5) return { start: 60, end: 70, display: "상위 60~70%" };
    if (rate >= 0) return { start: 70, end: 80, display: "상위 70~80%" };
    return { start: 80, end: 100, display: "상위 80~100%" };
  };
  const savingsPercentile = getSavingsPercentileRange(savingsRate);

  // 은퇴 시기 시뮬레이션
  const calculateRetirementScenario = (retireAge: number) => {
    const yearsToRetire = Math.max(0, retireAge - data.currentAge);
    const retireYears = data.lifeExpectancy - retireAge;

    let assetAtRetire = liquidAsset;
    const annualSavings = currentMonthlyGap > 0 ? (currentMonthlyGap * 12) / 10000 : 0;
    for (let year = 0; year < yearsToRetire; year++) {
      assetAtRetire = assetAtRetire * (1 + growthRate) + annualSavings;
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
      data.privatePensionSpouse +
      data.otherIncomePersonal +
      data.otherIncomeSpouse;

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

  // 리스크 수준 판단
  const getRiskLevel = (value: number, thresholds: [number, number]) => {
    if (value >= thresholds[1]) return "high";
    if (value >= thresholds[0]) return "medium";
    return "low";
  };

  // 소견 생성
  const generateVerdict = () => {
    const findings: string[] = [];
    const recommendations: string[] = [];

    if (monthlyGap < 0) {
      findings.push(`은퇴 후 월 ${Math.abs(monthlyGap)}만원의 현금흐름 부족이 예상됩니다`);
      if (currentMonthlyGap > 0) {
        recommendations.push(`현재 월 저축여력 ${currentMonthlyGap}만원을 활용한 자산 축적 전략 수립`);
      }
    }

    if (realEstateRatio >= 70) {
      findings.push(`부동산 비중이 ${realEstateRatio}%로 유동성 리스크가 높습니다`);
      recommendations.push("부동산 일부 현금화 또는 역모기지 활용 검토");
    } else if (realEstateRatio >= 50) {
      findings.push(`자산의 ${realEstateRatio}%가 부동산에 집중되어 있습니다`);
    }

    if (pensionCoverageRate < 50) {
      findings.push(`연금 충당률이 ${pensionCoverageRate}%로 매우 낮습니다`);
      recommendations.push("개인연금 추가 가입 또는 연금저축 확대 검토");
    } else if (pensionCoverageRate < 70) {
      findings.push(`연금으로 생활비의 ${pensionCoverageRate}%만 충당 가능합니다`);
    }

    if (yearsOfWithdrawal < retirementYears) {
      const depletionMsg = `현재 구조 유지 시 ${assetDepletionAge}세에 금융자산 소진이 예상됩니다`;
      if (!findings.includes(depletionMsg)) {
        findings.push(depletionMsg);
      }
      recommendations.push(`${data.lifeExpectancy}세까지 자산 유지를 위한 현금흐름 개선 필요`);
    }

    if (supplyDeficit > 0) {
      findings.push(`은퇴 후 총 ${supplyDeficit}억원의 자금 부족이 예상됩니다`);
    }

    return {
      findingText:
        findings.length > 0 ? findings.slice(0, 2).join(". ") + "." : "현재 재무 구조가 안정적입니다.",
      recommendationText: recommendations.length > 0 ? recommendations[0] + "이 필요합니다." : "",
    };
  };

  const verdict = generateVerdict();

  const getSavingsGrade = () => {
    if (savingsRate < 0) return { grade: "적자", className: styles.gradeDanger };
    if (savingsRate < 10) return { grade: "부족", className: styles.gradeWarning };
    if (savingsRate < 20) return { grade: "보통", className: styles.gradeCaution };
    if (savingsRate < 30) return { grade: "양호", className: styles.gradeGood };
    return { grade: "우수", className: styles.gradeExcellent };
  };
  const savingsGrade = getSavingsGrade();

  const handlePrint = () => {
    window.print();
  };

  const handlePublish = async () => {
    if (published) {
      alert("이미 발행된 보고서입니다.");
      return;
    }

    if (!confirm("보고서를 발행하시겠습니까?\n고객에게 SMS가 발송됩니다.")) {
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch("/api/report/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, opinion }),
      });

      const result = await response.json();

      if (result.success) {
        setPublished(true);
        alert("보고서가 발행되었습니다.\n고객에게 SMS가 발송되었습니다.");
      } else {
        alert(result.error || "발행에 실패했습니다.");
      }
    } catch {
      alert("발행 중 오류가 발생했습니다.");
    } finally {
      setPublishing(false);
    }
  };

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // 지출 분석 데이터
  const fixedExpense = data.monthlyFixedExpense + monthlyInterest;
  const variableExpense =
    data.expenseFood + data.expenseTransport + data.expenseShopping + data.expenseLeisure + data.expenseOther;
  const totalAllExpense = fixedExpense + variableExpense;
  const fixedRatio = totalAllExpense > 0 ? Math.round((fixedExpense / totalAllExpense) * 100) : 0;
  const variableRatio = 100 - fixedRatio;

  const foodRatio = variableExpense > 0 ? Math.round((data.expenseFood / variableExpense) * 100) : 0;
  const transportRatio =
    variableExpense > 0 ? Math.round((data.expenseTransport / variableExpense) * 100) : 0;
  const shoppingRatio =
    variableExpense > 0 ? Math.round((data.expenseShopping / variableExpense) * 100) : 0;
  const leisureRatio = variableExpense > 0 ? Math.round((data.expenseLeisure / variableExpense) * 100) : 0;
  const otherExpenseRatio = 100 - foodRatio - transportRatio - shoppingRatio - leisureRatio;

  const expenseColors: Record<string, string> = {
    food: "#1a365d",
    transport: "#2c5282",
    shopping: "#3182ce",
    leisure: "#63b3ed",
    otherExpense: "#bee3f8",
  };

  const expenseItems = [
    {
      key: "food",
      label: "식비",
      amount: data.expenseFood,
      ratio: foodRatio,
      savingPotential: "low",
      savingTip: "외식 빈도 조절로 10~15% 절감 가능",
    },
    {
      key: "transport",
      label: "교통비",
      amount: data.expenseTransport,
      ratio: transportRatio,
      savingPotential: "medium",
      savingTip: "대중교통 활용, 카풀로 20~30% 절감 가능",
    },
    {
      key: "shopping",
      label: "쇼핑/미용",
      amount: data.expenseShopping,
      ratio: shoppingRatio,
      savingPotential: "high",
      savingTip: "충동구매 자제, 세일 활용으로 30~40% 절감 가능",
    },
    {
      key: "leisure",
      label: "유흥/여가",
      amount: data.expenseLeisure,
      ratio: leisureRatio,
      savingPotential: "high",
      savingTip: "구독서비스 정리, 무료 활동으로 40~50% 절감 가능",
    },
    {
      key: "otherExpense",
      label: "기타",
      amount: data.expenseOther,
      ratio: otherExpenseRatio,
      savingPotential: "medium",
      savingTip: "불필요한 지출 점검으로 20~30% 절감 가능",
    },
  ].filter((item) => item.amount > 0);

  const highPotentialItems = expenseItems
    .filter((item) => item.savingPotential === "high" && item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const topSavingItem = highPotentialItems[0] || expenseItems.sort((a, b) => b.amount - a.amount)[0];

  // 부채 분석 데이터
  const mortgageRatio = totalDebt > 0 ? Math.round((data.mortgageAmount / totalDebt) * 100) : 0;
  const creditRatio = totalDebt > 0 ? Math.round((data.creditLoanAmount / totalDebt) * 100) : 0;
  const otherDebtRatio = 100 - mortgageRatio - creditRatio;
  const isMortgageRateGood = data.mortgageRate <= 4.5;
  const isCreditRateGood = data.creditLoanRate <= 7.0;
  const annualInterest = monthlyInterest * 12;
  const annualIncomeCalc = data.monthlyIncome * 12;
  const interestToIncome = annualIncomeCalc > 0 ? Math.round((annualInterest / annualIncomeCalc) * 100) : 0;

  return (
    <div className={styles.reportContainer}>
      {!hideActions && (
        <div className={styles.actionButtons}>
          <button className={styles.printButton} onClick={handlePrint}>
            인쇄하기
          </button>
          <button
            className={`${styles.publishButton} ${published ? styles.published : ""}`}
            onClick={handlePublish}
            disabled={publishing || published}
          >
            {publishing ? "발행 중..." : published ? "발행 완료" : "보고서 발행하기"}
          </button>
        </div>
      )}

      {/* 표지 */}
      <div className={`${styles.reportPage} ${styles.pageCover}`}>
        <div className={styles.coverContent}>
          <div className={styles.coverBrand}>
            <div className={styles.coverLogo}>LYCON PLANNING</div>
            <div className={styles.coverTagline}>은퇴 설계 전문</div>
          </div>

          <div className={styles.coverTitleSection}>
            <h1 className={styles.coverTitle}>은퇴 준비 진단서</h1>
            <p className={styles.coverSubtitle}>Retirement Planning Diagnosis Report</p>
          </div>

          <div className={styles.coverClientInfo}>
            <div className={styles.coverClientRow}>
              <span className={styles.coverLabel}>성명</span>
              <span className={styles.coverValue}>{data.customerName}</span>
            </div>
            <div className={styles.coverClientRow}>
              <span className={styles.coverLabel}>연령</span>
              <span className={styles.coverValue}>만 {data.currentAge}세</span>
            </div>
            <div className={styles.coverClientRow}>
              <span className={styles.coverLabel}>목표 은퇴</span>
              <span className={styles.coverValue}>만 {data.targetRetirementAge}세</span>
            </div>
            <div className={styles.coverClientRow}>
              <span className={styles.coverLabel}>진단일</span>
              <span className={styles.coverValue}>{today}</span>
            </div>
          </div>

          <div className={styles.coverFooter}>
            <div className={styles.coverFooterText}>
              본 진단서는 고객님의 재무 상황을 바탕으로 작성되었습니다.
            </div>
            <div className={styles.coverFooterContact}>Lycon Planning | lyconplanning.com</div>
          </div>
        </div>
      </div>

      {/* 1페이지: 기초진단 */}
      <div className={styles.reportPage}>
        <header className={styles.reportHeader}>
          <div className={styles.reportHeaderLeft}>
            <div className={styles.reportLogo}>Lycon Planning</div>
            <h1 className={styles.reportTitle}>기초진단</h1>
          </div>
          <div className={styles.reportHeaderRight}>
            <span className={styles.reportInfoLabel}>성명</span>
            <span className={styles.reportInfoValue}>{data.customerName}</span>
            <span className={styles.reportInfoLabel}>연령</span>
            <span className={styles.reportInfoValue}>만 {data.currentAge}세</span>
            <span className={styles.reportInfoLabel}>진단일</span>
            <span className={styles.reportInfoValue}>{today}</span>
            <span className={styles.reportInfoLabel}>목표 은퇴</span>
            <span className={styles.reportInfoValue}>만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 재무정보 요약 */}
        <section className={`${styles.reportSection} ${styles.financialSummary}`}>
          <h2 className={styles.sectionTitle}>재무정보 요약</h2>
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
            <div className={`${styles.summaryItem} ${styles.highlight}`}>
              <span className={styles.summaryLabel}>순자산</span>
              <span className={styles.summaryValue}>{netWorth}억원</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>월 저축여력</span>
              <span className={styles.summaryValue}>
                {currentMonthlyGap > 0 ? "+" : ""}
                {currentMonthlyGap}만원
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>저축률</span>
              <span className={styles.summaryValue}>{savingsRate.toFixed(0)}%</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>은퇴까지</span>
              <span className={styles.summaryValue}>{yearsToRetirement}년</span>
            </div>
          </div>
        </section>

        {/* 현금흐름 분석 */}
        <div className={styles.reportTwoColumn}>
          <section className={`${styles.reportSection} ${styles.half}`}>
            <h2 className={styles.sectionTitle}>현재 현금흐름</h2>
            <div className={styles.cashflowGrid}>
              <div className={styles.cashflowItem}>
                <div className={styles.cashflowLabel}>월 소득</div>
                <div className={styles.cashflowBarContainer}>
                  <div
                    className={`${styles.cashflowBar} ${styles.income}`}
                    style={{
                      width: `${Math.min(100, (data.monthlyIncome / Math.max(data.monthlyIncome, currentMonthlyExpense)) * 100)}%`,
                    }}
                  >
                    <span className={styles.cashflowBarLabel}>{data.monthlyIncome}만원</span>
                  </div>
                </div>
              </div>
              <div className={styles.cashflowItem}>
                <div className={styles.cashflowLabel}>월 지출</div>
                <div className={styles.cashflowBarContainer}>
                  <div
                    className={`${styles.cashflowBar} ${styles.expense}`}
                    style={{
                      width: `${Math.min(100, (currentMonthlyExpense / Math.max(data.monthlyIncome, currentMonthlyExpense)) * 100)}%`,
                    }}
                  >
                    <span className={styles.cashflowBarLabel}>{currentMonthlyExpense}만원</span>
                  </div>
                </div>
              </div>
              <div className={`${styles.cashflowItem} ${styles.highlightItem}`}>
                <div className={styles.cashflowLabel}>저축 여력</div>
                <div className={styles.cashflowBarContainer}>
                  {(() => {
                    const barWidth = Math.min(100, (Math.abs(currentMonthlyGap) / currentMonthlyExpense) * 100);
                    const isNarrow = barWidth < 25;
                    return (
                      <>
                        <div
                          className={`${styles.cashflowBar} ${styles.gap} ${currentMonthlyGap >= 0 ? styles.positive : styles.negative}`}
                          style={{ width: `${barWidth}%` }}
                        >
                          {!isNarrow && (
                            <span className={styles.cashflowBarLabel}>
                              {currentMonthlyGap >= 0 ? "+" : ""}
                              {currentMonthlyGap}만원
                            </span>
                          )}
                        </div>
                        {isNarrow && (
                          <span className={styles.cashflowBarLabelOutside}>
                            {currentMonthlyGap >= 0 ? "+" : ""}
                            {currentMonthlyGap}만원
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className={`${styles.cashflowGrade} ${savingsGrade.className}`}>{savingsGrade.grade}</div>
              </div>
            </div>
          </section>

          {/* 제안 섹션 */}
          <section className={`${styles.reportSection} ${styles.half} ${styles.suggestionSection}`}>
            {(() => {
              const currentSavingsRate =
                data.monthlyIncome > 0 ? (currentMonthlyGap / data.monthlyIncome) * 100 : 0;
              const needsReduction = currentSavingsRate < 30;

              if (needsReduction) {
                const suggestedExpense = Math.round(currentMonthlyExpense * 0.85);
                const suggestedGap = data.monthlyIncome - suggestedExpense;
                const expenseReduction = currentMonthlyExpense - suggestedExpense;
                const getSuggestedGrade = () => {
                  const suggestedSavingsRate =
                    data.monthlyIncome > 0 ? (suggestedGap / data.monthlyIncome) * 100 : 0;
                  if (suggestedSavingsRate < 0) return { grade: "적자", className: styles.gradeDanger };
                  if (suggestedSavingsRate < 10) return { grade: "부족", className: styles.gradeWarning };
                  if (suggestedSavingsRate < 20) return { grade: "보통", className: styles.gradeCaution };
                  if (suggestedSavingsRate < 30) return { grade: "양호", className: styles.gradeGood };
                  return { grade: "우수", className: styles.gradeExcellent };
                };
                const suggestedGrade = getSuggestedGrade();

                return (
                  <>
                    <h2 className={styles.sectionTitle}>제안 (지출 15% 절감 시)</h2>
                    <div className={styles.cashflowGrid}>
                      <div className={styles.cashflowItem}>
                        <div className={styles.cashflowLabel}>월 소득</div>
                        <div className={styles.cashflowBarContainer}>
                          <div
                            className={`${styles.cashflowBar} ${styles.income}`}
                            style={{
                              width: `${Math.min(100, (data.monthlyIncome / Math.max(data.monthlyIncome, suggestedExpense)) * 100)}%`,
                            }}
                          >
                            <span className={styles.cashflowBarLabel}>{data.monthlyIncome}만원</span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.cashflowItem}>
                        <div className={styles.cashflowLabel}>월 지출</div>
                        <div className={styles.cashflowBarContainer}>
                          <div
                            className={`${styles.cashflowBar} ${styles.expense}`}
                            style={{
                              width: `${Math.min(100, (suggestedExpense / Math.max(data.monthlyIncome, suggestedExpense)) * 100)}%`,
                            }}
                          >
                            <span className={styles.cashflowBarLabel}>
                              {suggestedExpense}만원 (-{expenseReduction})
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`${styles.cashflowItem} ${styles.highlightItem}`}>
                        <div className={styles.cashflowLabel}>저축 여력</div>
                        <div className={styles.cashflowBarContainer}>
                          {(() => {
                            const barWidth = Math.min(
                              100,
                              (Math.abs(suggestedGap) / suggestedExpense) * 100
                            );
                            const isNarrow = barWidth < 25;
                            return (
                              <>
                                <div
                                  className={`${styles.cashflowBar} ${styles.gap} ${suggestedGap >= 0 ? styles.positive : styles.negative}`}
                                  style={{ width: `${barWidth}%` }}
                                >
                                  {!isNarrow && (
                                    <span className={styles.cashflowBarLabel}>
                                      {suggestedGap >= 0 ? "+" : ""}
                                      {suggestedGap}만원
                                    </span>
                                  )}
                                </div>
                                {isNarrow && (
                                  <span className={styles.cashflowBarLabelOutside}>
                                    {suggestedGap >= 0 ? "+" : ""}
                                    {suggestedGap}만원
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div className={`${styles.cashflowGrade} ${suggestedGrade.className}`}>
                          {suggestedGrade.grade}
                        </div>
                      </div>
                    </div>
                  </>
                );
              } else {
                return (
                  <>
                    <h2 className={styles.sectionTitle}>제안 (현재 유지)</h2>
                    <div className={styles.cashflowGrid}>
                      <div className={styles.cashflowItem}>
                        <div className={styles.cashflowLabel}>월 소득</div>
                        <div className={styles.cashflowBarContainer}>
                          <div
                            className={`${styles.cashflowBar} ${styles.income}`}
                            style={{
                              width: `${Math.min(100, (data.monthlyIncome / Math.max(data.monthlyIncome, currentMonthlyExpense)) * 100)}%`,
                            }}
                          >
                            <span className={styles.cashflowBarLabel}>{data.monthlyIncome}만원</span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.cashflowItem}>
                        <div className={styles.cashflowLabel}>월 지출</div>
                        <div className={styles.cashflowBarContainer}>
                          <div
                            className={`${styles.cashflowBar} ${styles.expense}`}
                            style={{
                              width: `${Math.min(100, (currentMonthlyExpense / Math.max(data.monthlyIncome, currentMonthlyExpense)) * 100)}%`,
                            }}
                          >
                            <span className={styles.cashflowBarLabel}>{currentMonthlyExpense}만원</span>
                          </div>
                        </div>
                      </div>
                      <div className={`${styles.cashflowItem} ${styles.highlightItem}`}>
                        <div className={styles.cashflowLabel}>저축 여력</div>
                        <div className={styles.cashflowBarContainer}>
                          <div
                            className={`${styles.cashflowBar} ${styles.gap} ${styles.positive}`}
                            style={{
                              width: `${Math.min(100, (Math.abs(currentMonthlyGap) / currentMonthlyExpense) * 100)}%`,
                            }}
                          >
                            <span className={styles.cashflowBarLabel}>
                              {currentMonthlyGap >= 0 ? "+" : ""}
                              {currentMonthlyGap}만원
                            </span>
                          </div>
                        </div>
                        <div className={`${styles.cashflowGrade} ${styles.gradeExcellent}`}>우수</div>
                      </div>
                    </div>
                    <div className={styles.maintainMessage}>
                      현재 저축률 {Math.round(currentSavingsRate)}%로 우수합니다. 현재 수준을 유지하세요.
                    </div>
                  </>
                );
              }
            })()}
          </section>
        </div>

        {/* 현금흐름 TIP */}
        {(() => {
          const currentSavingsRate =
            data.monthlyIncome > 0 ? (currentMonthlyGap / data.monthlyIncome) * 100 : 0;
          if (currentSavingsRate >= 30) return null;

          const monthlySaving = Math.round(currentMonthlyExpense * 0.15);
          const months = yearsToRetirement * 12;
          const monthlyRate = 0.1 / 12;
          const futureValue = monthlySaving * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

          const formatAmount = (amount: number) => {
            if (amount >= 10000) {
              return `${Math.round((amount / 10000) * 10) / 10}억원`;
            }
            return `${Math.round(amount).toLocaleString()}만원`;
          };

          return (
            <div className={styles.tipBox}>
              <span className={styles.tipLabel}>TIP</span>
              <span className={styles.tipText}>
                월 {monthlySaving}만원 절감액을 연평균 10% 수익률로 은퇴시점까지 매월 투자하면, 은퇴자산이{" "}
                <strong>{formatAmount(futureValue)}</strong> 늘어납니다.
              </span>
            </div>
          );
        })()}

        {/* 지출 분석 */}
        <section className={`${styles.reportSection} ${styles.expenseAnalysisSection}`}>
          <h2 className={styles.sectionTitle}>지출 분석</h2>
          <div className={styles.expenseAnalysisLayout}>
            <div className={styles.expenseCategoryRow}>
              <div className={`${styles.expenseCategory} ${styles.fixed}`}>
                <div className={styles.expenseCategoryHeader}>
                  <span className={styles.expenseCategoryTitle}>
                    고정비 <span className={styles.expenseCategoryHint}>(필수 지출)</span>
                  </span>
                  <span className={styles.expenseCategoryAmount}>{fixedExpense}만원</span>
                </div>
                <div className={styles.expenseCategoryDesc}>주거비, 보험료, 통신비, 대출이자 등 ({fixedRatio}%)</div>
              </div>
              <div className={`${styles.expenseCategory} ${styles.variable}`}>
                <div className={styles.expenseCategoryHeader}>
                  <span className={styles.expenseCategoryTitle}>
                    변동비 <span className={styles.expenseCategoryHint}>(조절 가능)</span>
                  </span>
                  <span className={styles.expenseCategoryAmount}>{variableExpense}만원</span>
                </div>
                <div className={styles.expenseCategoryDesc}>식비, 쇼핑, 여가 등 ({variableRatio}%)</div>
              </div>
            </div>

            <div className={styles.expenseStackedBar}>
              <div className={styles.stackedBarLabel}>변동비 구성</div>
              <div className={styles.stackedBarContainer}>
                {expenseItems.map((item) => (
                  <div
                    key={item.key}
                    className={styles.stackedBarSegment}
                    style={{ width: `${item.ratio}%`, backgroundColor: expenseColors[item.key] }}
                    title={`${item.label}: ${item.amount}만원 (${item.ratio}%)`}
                  >
                    {item.ratio >= 15 && <span className={styles.segmentLabel}>{item.label}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.expenseItemsGrid}>
              {expenseItems
                .sort((a, b) => b.amount - a.amount)
                .map((item) => (
                  <div
                    key={item.key}
                    className={`${styles.expenseItemRow} ${item.savingPotential === "high" ? styles.highPotential : ""}`}
                  >
                    <div className={styles.expenseItemInfo}>
                      <span
                        className={styles.expenseDot}
                        style={{ backgroundColor: expenseColors[item.key] }}
                      ></span>
                      <span className={styles.expenseItemLabel}>{item.label}</span>
                    </div>
                    <div className={styles.expenseItemValues}>
                      <span className={styles.expenseItemAmount}>{item.amount}만원</span>
                      <span className={styles.expenseItemRatio}>{item.ratio}%</span>
                    </div>
                  </div>
                ))}
            </div>

            {topSavingItem && (
              <div className={styles.expenseInsight}>
                <div className={styles.insightHeader}>절감 포인트</div>
                <div className={styles.insightContent}>
                  <strong>{topSavingItem.label}</strong> 항목이 변동비의 {topSavingItem.ratio}%를 차지합니다.{" "}
                  {topSavingItem.savingTip}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 자산/부채 분석 */}
        <div className={styles.reportTwoColumn}>
          <section className={`${styles.reportSection} ${styles.half}`}>
            <h2 className={styles.sectionTitle}>자산 분석</h2>
            <div className={styles.assetAnalysisLayout}>
              <div className={styles.assetPieContainer}>
                <svg viewBox="0 0 100 100" className={styles.assetPie}>
                  {(() => {
                    const r = 40;
                    const cx = 50;
                    const cy = 50;
                    let startAngle = -90;

                    const getArc = (percent: number) => {
                      if (percent <= 0) return "";
                      const angle = (percent / 100) * 360;
                      const endAngle = startAngle + angle;
                      const largeArc = angle > 180 ? 1 : 0;
                      const startRad = (startAngle * Math.PI) / 180;
                      const endRad = (endAngle * Math.PI) / 180;
                      const x1 = cx + r * Math.cos(startRad);
                      const y1 = cy + r * Math.sin(startRad);
                      const x2 = cx + r * Math.cos(endRad);
                      const y2 = cy + r * Math.sin(endRad);
                      startAngle = endAngle;
                      return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    };

                    const assetItems = [
                      { key: "realestate", ratio: realEstateRatio, color: "#1a365d" },
                      { key: "cash", ratio: cashRatio, color: "#3182ce" },
                      { key: "investment", ratio: investmentRatio, color: "#2c5282" },
                      { key: "pension", ratio: pensionRatio, color: "#63b3ed" },
                    ].sort((a, b) => b.ratio - a.ratio);

                    return assetItems.map((item) => (
                      <path key={item.key} d={getArc(item.ratio)} fill={item.color} />
                    ));
                  })()}
                </svg>
                <div className={styles.assetPieLegend}>
                  {[
                    { key: "realestate", label: "부동산", ratio: realEstateRatio },
                    { key: "cash", label: "현금", ratio: cashRatio },
                    { key: "investment", label: "투자", ratio: investmentRatio },
                    { key: "pension", label: "연금", ratio: pensionRatio },
                  ]
                    .sort((a, b) => b.ratio - a.ratio)
                    .map((item) => (
                      <div className={styles.pieLegendItem} key={item.key}>
                        <span className={`${styles.legendDot} ${styles[item.key]}`}></span>
                        <span>
                          {item.label} {item.ratio}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <div className={styles.assetSummaryComment}>
              {realEstateRatio >= 70
                ? `부동산 ${realEstateRatio}%로 편중. 유동성 확보 필요`
                : realEstateRatio >= 50
                  ? `부동산 ${realEstateRatio}%, 금융 ${cashRatio + investmentRatio}%로 균형 유지`
                  : `금융자산 ${cashRatio + investmentRatio}% 중심의 유동적 포트폴리오`}
            </div>
          </section>

          <section className={`${styles.reportSection} ${styles.half}`}>
            <h2 className={styles.sectionTitle}>부채 분석</h2>
            {totalDebt === 0 ? (
              <div className={styles.debtAnalysis}>
                <div className={styles.noDebtMessage}>
                  <span className={styles.noDebtText}>부채 없음</span>
                  <span className={styles.noDebtDesc}>훌륭합니다! 부채 없이 자산을 관리하고 계십니다.</span>
                </div>
              </div>
            ) : (
              <div className={styles.debtAnalysis}>
                <div className={styles.assetPieContainer}>
                  <svg viewBox="0 0 100 100" className={styles.assetPie}>
                    {(() => {
                      const r = 40;
                      const cx = 50;
                      const cy = 50;
                      let startAngle = -90;

                      const getArc = (percent: number) => {
                        if (percent <= 0) return "";
                        const angle = (percent / 100) * 360;
                        const endAngle = startAngle + angle;
                        const largeArc = angle > 180 ? 1 : 0;
                        const startRad = (startAngle * Math.PI) / 180;
                        const endRad = (endAngle * Math.PI) / 180;
                        const x1 = cx + r * Math.cos(startRad);
                        const y1 = cy + r * Math.sin(startRad);
                        const x2 = cx + r * Math.cos(endRad);
                        const y2 = cy + r * Math.sin(endRad);
                        startAngle = endAngle;
                        return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                      };

                      const debtItems = [
                        { key: "mortgage", amount: data.mortgageAmount, ratio: mortgageRatio, color: "#1a365d" },
                        { key: "credit", amount: data.creditLoanAmount, ratio: creditRatio, color: "#c53030" },
                        { key: "other", amount: data.otherDebtAmount, ratio: otherDebtRatio, color: "#d69e2e" },
                      ]
                        .filter((item) => item.amount > 0)
                        .sort((a, b) => b.amount - a.amount);

                      return debtItems.map((item) => (
                        <path key={item.key} d={getArc(item.ratio)} fill={item.color} />
                      ));
                    })()}
                  </svg>
                  <div className={styles.assetPieLegend}>
                    {[
                      {
                        key: "mortgage",
                        label: "주담대",
                        amount: data.mortgageAmount,
                        ratio: mortgageRatio,
                        rate: data.mortgageRate,
                        isGood: isMortgageRateGood,
                      },
                      {
                        key: "credit",
                        label: "신용",
                        amount: data.creditLoanAmount,
                        ratio: creditRatio,
                        rate: data.creditLoanRate,
                        isGood: isCreditRateGood,
                      },
                      {
                        key: "other",
                        label: "기타",
                        amount: data.otherDebtAmount,
                        ratio: otherDebtRatio,
                        rate: data.otherDebtRate,
                        isGood: null,
                      },
                    ]
                      .filter((item) => item.amount > 0)
                      .sort((a, b) => b.amount - a.amount)
                      .map((item) => (
                        <div className={styles.pieLegendItem} key={item.key}>
                          <span className={`${styles.legendDot} ${styles[item.key]}`}></span>
                          <span>
                            {item.label} {item.ratio}%{" "}
                            <span
                              className={`${styles.rateBadge} ${item.isGood === null ? "" : item.isGood ? styles.good : styles.warning}`}
                            >
                              금리 {item.rate}%
                            </span>
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className={styles.debtSummaryComment}>
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
              </div>
            )}
          </section>
        </div>

        {/* 동연령대 비교 */}
        <section className={styles.reportSection}>
          <h2 className={styles.sectionTitle}>동연령대 비교 ({ageGroup})</h2>
          {(() => {
            const incomeIndicatorIdx = 9 - Math.floor(incomePercentile.start / 10);
            const netWorthIndicatorIdx = 9 - Math.floor(netWorthPercentile.start / 10);
            const savingsIndicatorIdx = 9 - Math.floor(savingsPercentile.start / 10);
            return (
              <>
                <div className={styles.percentileRow}>
                  <div className={styles.percentileRowLabel}>연소득</div>
                  <div className={styles.percentileTrackWrapper}>
                    <div className={styles.percentileTrack}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
                        <div key={idx} className={styles.percentileSegment}>
                          {idx === incomeIndicatorIdx && <div className={styles.percentileIndicator} />}
                        </div>
                      ))}
                    </div>
                    <div className={styles.percentileLabels}>
                      <span>하위</span>
                      <span className={styles.percentileDetail}>
                        {incomePercentile.display} ({((data.monthlyIncome * 12) / 10000).toFixed(1)}억)
                      </span>
                      <span>상위</span>
                    </div>
                  </div>
                </div>
                <div className={styles.percentileRow}>
                  <div className={styles.percentileRowLabel}>순자산</div>
                  <div className={styles.percentileTrackWrapper}>
                    <div className={styles.percentileTrack}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
                        <div key={idx} className={styles.percentileSegment}>
                          {idx === netWorthIndicatorIdx && <div className={styles.percentileIndicator} />}
                        </div>
                      ))}
                    </div>
                    <div className={styles.percentileLabels}>
                      <span>하위</span>
                      <span className={styles.percentileDetail}>
                        {netWorthPercentile.display} ({netWorth}억)
                      </span>
                      <span>상위</span>
                    </div>
                  </div>
                </div>
                <div className={styles.percentileRow}>
                  <div className={styles.percentileRowLabel}>저축률</div>
                  <div className={styles.percentileTrackWrapper}>
                    <div className={styles.percentileTrack}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
                        <div key={idx} className={styles.percentileSegment}>
                          {idx === savingsIndicatorIdx && <div className={styles.percentileIndicator} />}
                        </div>
                      ))}
                    </div>
                    <div className={styles.percentileLabels}>
                      <span>하위</span>
                      <span className={styles.percentileDetail}>
                        {savingsPercentile.display} ({savingsRate.toFixed(0)}%)
                      </span>
                      <span>상위</span>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </section>

        <footer className={styles.reportFooter}>
          <div className={styles.footerBrand}>Lycon Planning</div>
          <div className={styles.footerTagline}>기초진단 1 / 3</div>
        </footer>
      </div>

      {/* 2페이지: 정밀진단 */}
      <div className={`${styles.reportPage} ${styles.page2}`}>
        <header className={styles.reportHeader}>
          <div className={styles.reportHeaderLeft}>
            <div className={styles.reportLogo}>Lycon Planning</div>
            <h1 className={styles.reportTitle}>정밀진단</h1>
          </div>
          <div className={styles.reportHeaderRight}>
            <span className={styles.reportInfoLabel}>성명</span>
            <span className={styles.reportInfoValue}>{data.customerName}</span>
            <span className={styles.reportInfoLabel}>연령</span>
            <span className={styles.reportInfoValue}>만 {data.currentAge}세</span>
            <span className={styles.reportInfoLabel}>진단일</span>
            <span className={styles.reportInfoValue}>{today}</span>
            <span className={styles.reportInfoLabel}>목표 은퇴</span>
            <span className={styles.reportInfoValue}>만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 은퇴 가능 여부 판단 */}
        <section className={`${styles.reportSection} ${styles.retirementVerdictSection}`}>
          <h2 className={styles.sectionTitle}>은퇴 가능 여부 판단</h2>
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
              if (isAssetSustainable) {
                verdictDetail = `연금만으로는 부족하나, 보유 자산으로 기대수명(${data.lifeExpectancy}세)까지 충분히 보완 가능합니다.`;
              } else {
                verdictDetail = `연금만으로는 부족하나, 보유 자산으로 보완 가능합니다. 다만 ${assetDepletionAge}세 이후 자산 소진에 대비가 필요합니다.`;
              }
            } else {
              verdictStatus = "difficult";
              verdictMessage = `${data.targetRetirementAge}세 은퇴 재검토 필요`;
              verdictDetail = `현재 준비 상황으로는 은퇴 후 현금흐름 유지가 어렵습니다. 추가 준비가 필요합니다.`;
            }

            return (
              <div className={`${styles.retirementVerdict} ${styles[verdictStatus]}`}>
                <div className={styles.verdictHeader}>
                  <div className={`${styles.verdictBadge} ${styles[verdictStatus]}`}>
                    {verdictStatus === "possible" && "가능"}
                    {verdictStatus === "conditional" && "조건부"}
                    {verdictStatus === "difficult" && "재검토"}
                  </div>
                  <div className={styles.verdictTitle}>{verdictMessage}</div>
                </div>
                <div className={styles.verdictDetail}>{verdictDetail}</div>
                <div className={styles.verdictBreakdown}>
                  <div className={styles.breakdownItem}>
                    <span className={styles.breakdownLabel}>예상 월 생활비</span>
                    <span className={styles.breakdownValue}>{monthlyExpense}만원</span>
                    <span className={styles.breakdownDesc}>물가상승 연3%, 은퇴직전 지출의 70%</span>
                  </div>
                  <div className={styles.breakdownItem}>
                    <span className={styles.breakdownLabel}>예상 월 연금</span>
                    <span className={styles.breakdownValue}>{monthlyPension}만원</span>
                    <span className={styles.breakdownDesc}>국민(물가반영)+퇴직+개인연금 합산</span>
                  </div>
                  <div className={styles.breakdownItem}>
                    <span className={styles.breakdownLabel}>월 현금흐름</span>
                    <span
                      className={`${styles.breakdownValue} ${monthlyGap >= 0 ? styles.positive : styles.negative}`}
                    >
                      {monthlyGap >= 0 ? "+" : ""}
                      {monthlyGap}만원
                    </span>
                    <span className={styles.breakdownDesc}>
                      {monthlyGap >= 0 ? "자산 보존 가능" : "자산에서 인출 필요"}
                    </span>
                  </div>
                  <div className={styles.breakdownItem}>
                    <span className={styles.breakdownLabel}>연금 충당률</span>
                    <span
                      className={`${styles.breakdownValue} ${pensionCoverageRate >= 80 ? styles.positive : pensionCoverageRate >= 60 ? "" : styles.negative}`}
                    >
                      {pensionCoverageRate}%
                    </span>
                    <span className={styles.breakdownDesc}>
                      {pensionCoverageRate >= 80
                        ? "여유"
                        : pensionCoverageRate >= 60
                          ? "적정"
                          : pensionCoverageRate >= 40
                            ? "부족"
                            : "심각한 부족"}
                    </span>
                  </div>
                </div>
                <div className={styles.verdictReference}>
                  노후생활비 기준 (KB금융 2025, 2인가구): 최소 248만원 / 적정 350만원 →{" "}
                  {data.targetRetirementAge}세 기준 최소{" "}
                  {Math.round(248 * Math.pow(1.03, yearsToRetirementForExpense))}만원 / 적정{" "}
                  {Math.round(350 * Math.pow(1.03, yearsToRetirementForExpense))}만원
                </div>
              </div>
            );
          })()}
        </section>

        {/* 3층 연금 */}
        <section className={styles.reportSection}>
          <h2 className={styles.sectionTitle}>3층 연금 준비현황</h2>
          <div className={styles.pensionThreeColumn}>
            <div className={styles.pensionColumn}>
              <div className={`${styles.pensionColumnHeader} ${styles.layer1}`}>1층</div>
              <div className={styles.pensionColumnTitle}>국민연금</div>
              <div className={styles.pensionColumnValue}>
                {data.nationalPensionPersonal + data.nationalPensionSpouse}만원/월
              </div>
              <div className={styles.pensionColumnNote}>
                {data.targetRetirementAge}세 기준{" "}
                {Math.round(
                  (data.nationalPensionPersonal + data.nationalPensionSpouse) *
                    Math.pow(1.03, yearsToRetirementForExpense)
                )}
                만원/월 (물가상승 연3%)
              </div>
            </div>
            <div className={styles.pensionColumn}>
              <div className={`${styles.pensionColumnHeader} ${styles.layer2}`}>2층</div>
              <div className={styles.pensionColumnTitle}>퇴직연금</div>
              <div className={styles.pensionColumnValue}>
                {data.retirementPensionPersonal + data.retirementPensionSpouse}만원/월
              </div>
              {data.retirementPensionPersonal + data.retirementPensionSpouse > 0 && (
                <div className={styles.pensionColumnNote}>{retirementYears}년 인출 가정</div>
              )}
            </div>
            <div className={styles.pensionColumn}>
              <div className={`${styles.pensionColumnHeader} ${styles.layer3}`}>3층</div>
              <div className={styles.pensionColumnTitle}>개인연금</div>
              <div className={styles.pensionColumnValue}>
                {data.privatePensionPersonal + data.privatePensionSpouse}만원/월
              </div>
              {data.privatePensionPersonal + data.privatePensionSpouse > 0 && (
                <div className={styles.pensionColumnNote}>{retirementYears}년 인출 가정</div>
              )}
            </div>
          </div>
        </section>

        {/* 은퇴 후 자금 수급 분석 */}
        <section className={styles.reportSection}>
          <h2 className={styles.sectionTitle}>
            은퇴 후 자금 수급 분석
            <span className={styles.sectionNote}>* 현재 물가 기준</span>
          </h2>
          <div className={styles.demandSupplyChart}>
            <div className={styles.dsRow}>
              <span className={styles.dsLabel}>총수요</span>
              <div className={styles.dsTrack}>
                <div className={`${styles.dsBar} ${styles.demand}`} style={{ width: "100%" }}>
                  <span className={styles.dsValue}>{totalDemand}억</span>
                </div>
              </div>
            </div>
            <div className={styles.dsRow}>
              <span className={styles.dsLabel}>총공급</span>
              <div className={styles.dsTrack}>
                <div className={`${styles.dsBar} ${styles.supply}`} style={{ width: `${supplyRatio}%` }}>
                  <span className={styles.dsValue}>{totalSupply}억</span>
                </div>
                {supplyDeficit > 0 && (
                  <div className={`${styles.dsBar} ${styles.deficit}`} style={{ width: `${deficitRatio}%` }}>
                    <span className={styles.dsValue}>-{supplyDeficit}억</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className={styles.dsLegend}>
            <div className={styles.dsLegendItem}>
              <span className={`${styles.dsLegendBox} ${styles.demand}`}></span>
              <span>총 지출 수요 ({retirementYears}년)</span>
            </div>
            <div className={styles.dsLegendItem}>
              <span className={`${styles.dsLegendBox} ${styles.supply}`}></span>
              <span>확보 현금흐름</span>
            </div>
            {supplyDeficit > 0 && (
              <div className={styles.dsLegendItem}>
                <span className={`${styles.dsLegendBox} ${styles.deficit}`}></span>
                <span>부족분</span>
              </div>
            )}
          </div>
        </section>

        {/* 은퇴 시점 예상 자산 */}
        <section className={styles.reportSection}>
          <h2 className={styles.sectionTitle}>은퇴 시점 예상 자산 ({data.targetRetirementAge}세)</h2>
          {(() => {
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

            const realEstateRatioAtRetirement = Math.round(
              (realEstateAtRetirement / totalAtRetirement) * 100
            );
            const financialRatioAtRetirement = Math.round(
              (financialAtRetirement / totalAtRetirement) * 100
            );
            const pensionRatioAtRetirement =
              100 - realEstateRatioAtRetirement - financialRatioAtRetirement;

            return (
              <div className={styles.retirementAssetPreview}>
                <div className={styles.assetComparisonCol}>
                  <div className={styles.assetComparisonItem}>
                    <div className={styles.comparisonLabel}>현재</div>
                    <div className={styles.comparisonValue}>{totalAsset}억</div>
                  </div>
                  <div className={styles.assetComparisonArrow}>↓</div>
                  <div className={`${styles.assetComparisonItem} ${styles.highlight}`}>
                    <div className={styles.comparisonLabel}>{yearsToRetirement}년 후</div>
                    <div className={styles.comparisonValue}>{totalAtRetirement}억</div>
                  </div>
                </div>
                <div className={styles.assetDetailCol}>
                  <div className={styles.assetBreakdownList}>
                    <div className={styles.assetBreakdownItem}>
                      <span className={`${styles.legendDot} ${styles.realestate}`}></span>
                      <span className={styles.breakdownName}>부동산</span>
                      <span className={styles.breakdownAmount}>{realEstateAtRetirement}억</span>
                      <span className={styles.breakdownRatio}>({realEstateRatioAtRetirement}%)</span>
                    </div>
                    <div className={styles.assetBreakdownItem}>
                      <span className={`${styles.legendDot} ${styles.investment}`}></span>
                      <span className={styles.breakdownName}>금융자산</span>
                      <span className={styles.breakdownAmount}>{financialAtRetirement}억</span>
                      <span className={styles.breakdownRatio}>({financialRatioAtRetirement}%)</span>
                    </div>
                    <div className={styles.assetBreakdownItem}>
                      <span className={`${styles.legendDot} ${styles.pension}`}></span>
                      <span className={styles.breakdownName}>연금</span>
                      <span className={styles.breakdownAmount}>{pensionAtRetirement}억</span>
                      <span className={styles.breakdownRatio}>({pensionRatioAtRetirement}%)</span>
                    </div>
                  </div>
                  <div className={styles.assetSummaryStats}>
                    <div className={styles.summaryStatItem}>
                      <span className={styles.statLabel}>예상 총자산</span>
                      <span className={styles.statValue}>{totalAtRetirement}억원</span>
                    </div>
                    <div className={styles.summaryStatItem}>
                      <span className={styles.statLabel}>예상 부채</span>
                      <span className={`${styles.statValue} ${styles.negative}`}>
                        {(debtAtRetirement / 10000).toFixed(1)}억원
                      </span>
                    </div>
                    <div className={`${styles.summaryStatItem} ${styles.highlight}`}>
                      <span className={styles.statLabel}>예상 순자산</span>
                      <span className={styles.statValue}>{netWorthAtRetirement}억원</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className={styles.calculationNote}>
            <span className={styles.noteLabel}>산출 기준</span>
            <span className={styles.noteContent}>
              부동산 연 2% 성장, 금융자산 연 5% 성장(저축 누적 포함), 연금 연 4% 성장, 부채 50% 상환 가정
            </span>
          </div>
        </section>

        {/* 은퇴 시기별 비교 */}
        <section className={styles.reportSection}>
          <h2 className={styles.sectionTitle}>은퇴 시기별 비교</h2>
          <p className={styles.sectionDesc}>은퇴 시기를 5년 앞당기거나 늦추면 어떻게 될까요?</p>
          <div className={styles.retirementScenarios}>
            <div className={styles.scenarioCard}>
              <div className={`${styles.scenarioHeader} ${styles.early}`}>5년 일찍</div>
              <div className={styles.scenarioBody}>
                <div className={styles.scenarioAge}>{earlyRetirement.retireAge}세 은퇴</div>
                <div className={styles.scenarioStat}>
                  <span className={styles.scenarioLabel}>은퇴 시 금융자산</span>
                  <span className={styles.scenarioValue}>{earlyRetirement.assetAtRetire}억</span>
                </div>
                <div className={styles.scenarioStat}>
                  <span className={styles.scenarioLabel}>자산 소진시점</span>
                  <span className={`${styles.scenarioValue} ${!earlyRetirement.sustainable ? styles.danger : ""}`}>
                    {earlyRetirement.sustainable ? "소진 안됨" : `${earlyRetirement.depletionAge}세`}
                  </span>
                </div>
              </div>
            </div>
            <div className={`${styles.scenarioCard} ${styles.current}`}>
              <div className={`${styles.scenarioHeader} ${styles.currentHeader}`}>현재 계획</div>
              <div className={styles.scenarioBody}>
                <div className={styles.scenarioAge}>{normalRetirement.retireAge}세 은퇴</div>
                <div className={styles.scenarioStat}>
                  <span className={styles.scenarioLabel}>은퇴 시 금융자산</span>
                  <span className={styles.scenarioValue}>{normalRetirement.assetAtRetire}억</span>
                </div>
                <div className={styles.scenarioStat}>
                  <span className={styles.scenarioLabel}>자산 소진시점</span>
                  <span className={`${styles.scenarioValue} ${!normalRetirement.sustainable ? styles.danger : ""}`}>
                    {normalRetirement.sustainable ? "소진 안됨" : `${normalRetirement.depletionAge}세`}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.scenarioCard}>
              <div className={`${styles.scenarioHeader} ${styles.late}`}>5년 늦게</div>
              <div className={styles.scenarioBody}>
                <div className={styles.scenarioAge}>{lateRetirement.retireAge}세 은퇴</div>
                <div className={styles.scenarioStat}>
                  <span className={styles.scenarioLabel}>은퇴 시 금융자산</span>
                  <span className={styles.scenarioValue}>{lateRetirement.assetAtRetire}억</span>
                </div>
                <div className={styles.scenarioStat}>
                  <span className={styles.scenarioLabel}>자산 소진시점</span>
                  <span className={`${styles.scenarioValue} ${!lateRetirement.sustainable ? styles.danger : ""}`}>
                    {lateRetirement.sustainable ? "소진 안됨" : `${lateRetirement.depletionAge}세`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 리스크 진단 */}
        <section className={styles.reportSection}>
          <h2 className={styles.sectionTitle}>리스크 진단</h2>
          <div className={styles.riskGrid}>
            <div className={styles.riskItem}>
              <div className={styles.riskLabel}>부동산 편중</div>
              <div className={styles.riskBarContainer}>
                <div className={styles.riskBarBg}>
                  <div className={`${styles.riskZone} ${styles.high}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.medium}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.low}`} style={{ width: "40%" }} />
                </div>
                <div
                  className={`${styles.riskIndicator} ${styles[getRiskLevel(realEstateRatio, [50, 70])]}`}
                  style={{ left: `${Math.max(0, Math.min(100, 100 - realEstateRatio))}%` }}
                />
              </div>
              <div className={styles.riskValue}>{realEstateRatio}%</div>
            </div>
            <div className={styles.riskItem}>
              <div className={styles.riskLabel}>현금흐름</div>
              <div className={styles.riskBarContainer}>
                <div className={styles.riskBarBg}>
                  <div className={`${styles.riskZone} ${styles.high}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.medium}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.low}`} style={{ width: "40%" }} />
                </div>
                <div
                  className={`${styles.riskIndicator} ${styles[monthlyGap >= 0 ? "low" : getRiskLevel(Math.abs(monthlyGap), [50, 150])]}`}
                  style={{
                    left: `${monthlyGap >= 0 ? 100 : Math.max(0, Math.min(100, 100 - Math.abs(monthlyGap) / 2))}%`,
                  }}
                />
              </div>
              <div className={styles.riskValue}>
                {monthlyGap >= 0 ? "+" : ""}
                {monthlyGap}만원
              </div>
            </div>
            <div className={styles.riskItem}>
              <div className={styles.riskLabel}>연금 충당률</div>
              <div className={styles.riskBarContainer}>
                <div className={styles.riskBarBg}>
                  <div className={`${styles.riskZone} ${styles.high}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.medium}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.low}`} style={{ width: "40%" }} />
                </div>
                <div
                  className={`${styles.riskIndicator} ${styles[pensionCoverageRate >= 80 ? "low" : pensionCoverageRate >= 50 ? "medium" : "high"]}`}
                  style={{ left: `${Math.min(100, pensionCoverageRate)}%` }}
                />
              </div>
              <div className={styles.riskValue}>{pensionCoverageRate}%</div>
            </div>
          </div>
        </section>

        <footer className={styles.reportFooter}>
          <div className={styles.footerBrand}>Lycon Planning</div>
          <div className={styles.footerTagline}>정밀진단 2 / 3</div>
        </footer>
      </div>

      {/* 3페이지: 종합소견 */}
      <div className={`${styles.reportPage} ${styles.page3}`}>
        <header className={styles.reportHeader}>
          <div className={styles.reportHeaderLeft}>
            <div className={styles.reportLogo}>Lycon Planning</div>
            <h1 className={styles.reportTitle}>종합소견</h1>
          </div>
          <div className={styles.reportHeaderRight}>
            <span className={styles.reportInfoLabel}>성명</span>
            <span className={styles.reportInfoValue}>{data.customerName}</span>
            <span className={styles.reportInfoLabel}>연령</span>
            <span className={styles.reportInfoValue}>만 {data.currentAge}세</span>
            <span className={styles.reportInfoLabel}>진단일</span>
            <span className={styles.reportInfoValue}>{today}</span>
            <span className={styles.reportInfoLabel}>목표 은퇴</span>
            <span className={styles.reportInfoValue}>만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 담당자 소견 */}
        <section className={`${styles.reportSection} ${styles.opinionSection}`}>
          <h2 className={styles.sectionTitle}>
            담당자 소견 <span className={styles.sectionTitleEn}>| 손균우 은퇴 설계 전문가</span>
          </h2>
          {!published && onOpinionChange ? (
            <div className={styles.opinionInput}>
              <textarea
                className={styles.opinionTextarea}
                placeholder="고객에게 전달할 소견을 작성하세요..."
                value={opinion}
                onChange={(e) => onOpinionChange(e.target.value)}
                rows={6}
              />
              <p className={styles.opinionHint}>
                * 자동 생성 참고: {verdict.findingText} {verdict.recommendationText}
              </p>
            </div>
          ) : (
            <div className={styles.opinionContent}>
              {opinion ? (
                <div
                  className={styles.opinionFinding}
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(opinion) }}
                />
              ) : (
                <>
                  <p className={styles.opinionFinding}>{verdict.findingText}</p>
                  {verdict.recommendationText && (
                    <p className={styles.opinionRecommendation}>{verdict.recommendationText}</p>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {/* 다음 단계 */}
        <section className={`${styles.reportSection} ${styles.ctaSection}`}>
          <h2 className={styles.sectionTitle}>다음 단계</h2>
          <div className={styles.ctaCards}>
            <div className={styles.ctaCard}>
              <div className={styles.ctaCardNumber}>1</div>
              <div className={styles.ctaCardContent}>
                <div className={styles.ctaCardTitle}>진단 결과 상세 설명</div>
                <div className={styles.ctaCardDesc}>이 진단서의 각 항목에 대한 자세한 해설</div>
              </div>
            </div>
            <div className={styles.ctaCard}>
              <div className={styles.ctaCardNumber}>2</div>
              <div className={styles.ctaCardContent}>
                <div className={styles.ctaCardTitle}>투자 포트폴리오 가이드</div>
                <div className={styles.ctaCardDesc}>현재 투자 분석 및 최적 투자 전략 제안</div>
              </div>
            </div>
            <div className={styles.ctaCard}>
              <div className={styles.ctaCardNumber}>3</div>
              <div className={styles.ctaCardContent}>
                <div className={styles.ctaCardTitle}>맞춤 액션 플랜</div>
                <div className={styles.ctaCardDesc}>지금 당장 실행할 수 있는 구체적인 행동 가이드</div>
              </div>
            </div>
          </div>
        </section>

        {/* 전문진단 안내 */}
        <section className={`${styles.reportSection} ${styles.specialistSection}`}>
          <h2 className={styles.sectionTitle}>전문진단 안내</h2>
          <p className={styles.sectionDesc}>
            기초진단과 정밀진단 결과를 바탕으로, 아래 전문진단을 통해 더 깊은 분석이 가능합니다.
          </p>
          <div className={styles.specialistOptionsList}>
            <div className={styles.optionsGroup}>
              <div className={styles.optionsGroupHeader}>기본 제공</div>
              <label className={`${styles.optionItem} ${styles.included}`}>
                <input type="checkbox" checked disabled />
                <span className={styles.optionCheck}></span>
                <span className={styles.optionName}>은퇴 목표 달성 시나리오 2종</span>
                <span className={`${styles.optionTag} ${styles.free}`}>기본</span>
              </label>
              <label className={`${styles.optionItem} ${styles.included}`}>
                <input type="checkbox" checked disabled />
                <span className={styles.optionCheck}></span>
                <span className={styles.optionName}>투자 포트폴리오 분석</span>
                <span className={`${styles.optionTag} ${styles.free}`}>기본</span>
              </label>
            </div>
            <div className={styles.optionsGroup}>
              <div className={styles.optionsGroupHeader}>추가 분석 (선택)</div>
              <label className={styles.optionItem}>
                <input type="checkbox" />
                <span className={styles.optionCheck}></span>
                <span className={styles.optionName}>절세 방안 분석</span>
                <span className={styles.optionDesc}>연금 인출 순서, 세액공제 최적화</span>
              </label>
              <label className={styles.optionItem}>
                <input type="checkbox" />
                <span className={styles.optionCheck}></span>
                <span className={styles.optionName}>주택연금 적합성 분석</span>
                <span className={styles.optionDesc}>가입 시기, 예상 수령액 시뮬레이션</span>
              </label>
              <label className={styles.optionItem}>
                <input type="checkbox" />
                <span className={styles.optionCheck}></span>
                <span className={styles.optionName}>상속/증여 플랜</span>
                <span className={styles.optionDesc}>사전 증여 vs 상속, 절세 전략</span>
              </label>
            </div>
          </div>
        </section>

        <footer className={styles.reportFooter}>
          <div className={styles.footerBrand}>Lycon Planning</div>
          <div className={styles.footerTagline}>종합소견 3 / 3</div>
        </footer>
      </div>
    </div>
  );
}
