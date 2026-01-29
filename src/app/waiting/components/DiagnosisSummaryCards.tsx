"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  convertPrepDataToDiagnosisData,
  calculateAllDiagnosisMetrics,
  calculateAdditionalCosts,
  DEFAULT_CALC_PARAMS,
  PrepDataStore,
  DiagnosisData,
} from "@/lib/services/diagnosisDataService";
import {
  householdFinance2025,
  type AgeGroup,
  estimatePercentiles,
} from "@/lib/data/householdFinance2025";
import styles from "./DiagnosisSummaryCards.module.css";

type DiagnosisStatus = "good" | "caution" | "warning";

interface DiagnosisSummaryCardsProps {
  userId: string;
}

// 억 단위 포맷
const formatBillion = (value: number): string => {
  return value.toFixed(1);
};

// 연령대 그룹 분류
const getAgeGroup = (age: number): AgeGroup => {
  if (age < 30) return "29세이하";
  if (age < 40) return "30대";
  if (age < 50) return "40대";
  if (age < 60) return "50대";
  if (age < 65) return "60대";
  return "65세이상";
};

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
    { p: 10, v: percentiles.p10 },
  ];

  for (const { p, v } of thresholds) {
    if (value >= v) return p;
  }
  return 5;
};

// 퍼센타일 범위 계산 (ReportTabs와 동일)
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

// Lycon Score 계산 함수
const calculateLyconScore = (
  data: DiagnosisData,
  metrics: ReturnType<typeof calculateAllDiagnosisMetrics>,
) => {
  const ageGroup = getAgeGroup(data.currentAge);
  const ageStats = householdFinance2025[ageGroup];

  const annualIncome = data.monthlyIncome * 12;
  const incomePercentiles = estimatePercentiles(ageStats.income.median);
  const assetPercentilesData = estimatePercentiles(ageStats.asset.median);
  const netWorthPercentilesData = estimatePercentiles(ageStats.netWorth.median);

  const incomeScore = calcPrecisePercentile(annualIncome, incomePercentiles);
  const assetScore = calcPrecisePercentile(
    metrics.totalAsset * 10000,
    assetPercentilesData,
  );
  const netWorthScore = calcPrecisePercentile(
    metrics.netWorth * 10000,
    netWorthPercentilesData,
  );

  const debtRatio =
    data.monthlyIncome > 0 ? metrics.totalDebt / annualIncome : 0;
  const debtScore =
    metrics.totalDebt === 0 ? 100 : Math.max(0, 100 - debtRatio * 25);
  const savingsRateScore = Math.min(100, metrics.savingsRate * 2.5);

  const lyconScore = Math.round(
    netWorthScore * 0.3 +
      savingsRateScore * 0.25 +
      debtScore * 0.2 +
      incomeScore * 0.15 +
      assetScore * 0.1,
  );

  return lyconScore;
};

export function DiagnosisSummaryCards({ userId }: DiagnosisSummaryCardsProps) {
  const [loading, setLoading] = useState(true);
  const [lyconScore, setLyconScore] = useState(0);
  const [lyconGradeLabel, setLyconGradeLabel] = useState("");
  const [netWorth, setNetWorth] = useState(0);
  const [netWorthStatus, setNetWorthStatus] = useState<{
    status: DiagnosisStatus;
    label: string;
  }>({ status: "good", label: "" });
  const [savingsRate, setSavingsRate] = useState(0);
  const [monthlyGap, setMonthlyGap] = useState(0);
  const [yearsToRetirement, setYearsToRetirement] = useState(0);
  const [effectiveRetirementAge, setEffectiveRetirementAge] = useState(0);
  const [fixedExpense, setFixedExpense] = useState(0);
  const [variableExpense, setVariableExpense] = useState(0);
  const [nationalPensionTotal, setNationalPensionTotal] = useState(0);
  const [retirementPensionTotal, setRetirementPensionTotal] = useState(0);
  const [personalPensionTotal, setPersonalPensionTotal] = useState(0);
  const [totalDemand, setTotalDemand] = useState(0);
  const [additionalTotal, setAdditionalTotal] = useState(0);

  useEffect(() => {
    const loadDiagnosisData = async () => {
      try {
        const supabase = createClient();

        const { data: profile } = await supabase
          .from("profiles")
          .select("name, birth_date, target_retirement_age, prep_data")
          .eq("id", userId)
          .single();

        if (!profile) return;

        const diagnosisData = convertPrepDataToDiagnosisData({
          name: profile.name,
          birth_date: profile.birth_date,
          target_retirement_age: profile.target_retirement_age,
          prep_data: profile.prep_data as PrepDataStore,
        });

        // ReportTabs와 동일하게 calcParams 설정
        const calcParams = {
          ...DEFAULT_CALC_PARAMS,
          lifeExpectancy: diagnosisData.lifeExpectancy,
        };
        const metrics = calculateAllDiagnosisMetrics(diagnosisData, calcParams);

        // Lycon 점수 계산
        const score = calculateLyconScore(diagnosisData, metrics);
        setLyconScore(score);

        const getGradeLabel = (s: number) => {
          if (s >= 90) return "우수";
          if (s >= 70) return "양호";
          if (s >= 50) return "보통";
          return "주의";
        };
        setLyconGradeLabel(getGradeLabel(score));

        // 순자산 및 상태 (ReportTabs와 동일한 백분위 기반 계산)
        setNetWorth(metrics.netWorth);
        const ageGroup = getAgeGroup(diagnosisData.currentAge);
        const ageStats = householdFinance2025[ageGroup];
        const netWorthPercentilesData = estimatePercentiles(
          ageStats.netWorth.median,
        );
        const netWorthPercentile = getPercentileRange(
          metrics.netWorth * 10000,
          netWorthPercentilesData,
          ageStats.netWorth.median,
        );

        const getNetWorthStatus = (): {
          status: DiagnosisStatus;
          label: string;
        } => {
          if (netWorthPercentile.idx <= 3)
            return { status: "good", label: netWorthPercentile.display };
          if (netWorthPercentile.idx <= 5)
            return { status: "caution", label: netWorthPercentile.display };
          return { status: "warning", label: netWorthPercentile.display };
        };
        setNetWorthStatus(getNetWorthStatus());

        // 핵심 지표
        setSavingsRate(metrics.savingsRate);
        setMonthlyGap(metrics.currentMonthlyGap);
        setYearsToRetirement(metrics.yearsToRetirement);
        setEffectiveRetirementAge(metrics.effectiveRetirementAge);
        setFixedExpense(metrics.fixedExpense);
        setVariableExpense(metrics.variableExpense);

        // 3층 연금
        setNationalPensionTotal(
          diagnosisData.nationalPensionPersonal +
            diagnosisData.nationalPensionSpouse,
        );
        setRetirementPensionTotal(
          diagnosisData.retirementPensionBalanceSelf +
            diagnosisData.retirementPensionBalanceSpouse,
        );
        setPersonalPensionTotal(
          diagnosisData.personalPensionStatus.irp.balance +
            diagnosisData.personalPensionStatus.pensionSavings.balance +
            diagnosisData.personalPensionStatus.isa.balance,
        );

        // 총 필요 자금
        setTotalDemand(metrics.totalDemand);

        // 추가 비용 계산 (ReportTabs와 동일한 calcParams 사용)
        const additionalCosts = calculateAdditionalCosts(
          diagnosisData,
          calcParams,
        );

        // 기본 costOptions: education="normal", leisure=1, consumerGoods=1, medical=true, housing=null
        const educationCost = additionalCosts.childEducation.grandTotalNormal;
        const leisureCost =
          (additionalCosts.leisure[1]?.totalUntilRetirement || 0) +
          (additionalCosts.leisure[1]?.totalAfterRetirement || 0);
        const consumerGoodsCost =
          additionalCosts.consumerGoods[1]?.totalUntilLifeExpectancy || 0;
        const medicalCost = additionalCosts.medical.grandTotal;
        const housingCost = 0; // 기본값은 미선택

        const totalAdditional =
          educationCost +
          leisureCost +
          consumerGoodsCost +
          medicalCost +
          housingCost;
        setAdditionalTotal(totalAdditional / 10000); // 억 단위로 변환
      } catch (error) {
        console.error("진단 요약 데이터 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDiagnosisData();
  }, [userId]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} />
      </div>
    );
  }

  const fixedRatio =
    fixedExpense + variableExpense > 0
      ? Math.round((fixedExpense / (fixedExpense + variableExpense)) * 100)
      : 0;
  const variableRatio =
    fixedExpense + variableExpense > 0
      ? Math.round((variableExpense / (fixedExpense + variableExpense)) * 100)
      : 0;

  return (
    <div className={styles.summaryGrid}>
      {/* Lycon 점수 */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <span className={styles.summaryLabel}>Score</span>
          <span className={styles.summaryTitle}>Lycon 재무점수</span>
        </div>
        <div className={styles.summaryValue}>
          {lyconScore}
          <span className={styles.summaryUnit}>점</span>
        </div>
        <div className={styles.summarySubtext}>
          동연령대 상위 {100 - lyconScore}%
        </div>
      </div>

      {/* 총 필요 자금 */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <span className={styles.summaryLabel}>Funding</span>
          <span className={styles.summaryTitle}>총 필요 자금</span>
        </div>
        <div className={styles.summaryValue}>
          {formatBillion(totalDemand + additionalTotal)}
          <span className={styles.summaryUnit}>억</span>
        </div>
        <div className={styles.summarySubtext}>
          평생 필요한 돈
        </div>
      </div>
    </div>
  );
}
