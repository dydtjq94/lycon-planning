"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  convertPrepDataToDiagnosisData,
  calculateAllDiagnosisMetrics,
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

interface DiagnosisSummaryCardsProps {
  userId: string;
}

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

// Lycon Score 및 개별 점수 계산 함수
const calculateLyconScores = (
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

  return {
    lyconScore,
    netWorthScore,
    savingsRateScore,
    debtScore,
    incomeScore,
    assetScore,
    ageGroup,
  };
};

export function DiagnosisSummaryCards({ userId }: DiagnosisSummaryCardsProps) {
  const [loading, setLoading] = useState(true);
  const [lyconScore, setLyconScore] = useState(0);
  const [lyconGradeLabel, setLyconGradeLabel] = useState("");
  const [netWorthScore, setNetWorthScore] = useState(0);
  const [savingsRateScore, setSavingsRateScore] = useState(0);
  const [debtScore, setDebtScore] = useState(0);
  const [incomeScore, setIncomeScore] = useState(0);
  const [assetScore, setAssetScore] = useState(0);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("30대");

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

        const calcParams = {
          ...DEFAULT_CALC_PARAMS,
          lifeExpectancy: diagnosisData.lifeExpectancy,
        };
        const metrics = calculateAllDiagnosisMetrics(diagnosisData, calcParams);

        // Lycon 점수 및 개별 점수 계산
        const scores = calculateLyconScores(diagnosisData, metrics);
        setLyconScore(scores.lyconScore);
        setNetWorthScore(scores.netWorthScore);
        setSavingsRateScore(scores.savingsRateScore);
        setDebtScore(scores.debtScore);
        setIncomeScore(scores.incomeScore);
        setAssetScore(scores.assetScore);
        setAgeGroup(scores.ageGroup);

        const getGradeLabel = (s: number) => {
          if (s >= 90) return "우수";
          if (s >= 70) return "양호";
          if (s >= 50) return "보통";
          return "주의";
        };
        setLyconGradeLabel(getGradeLabel(scores.lyconScore));
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
      </div>
    );
  }

  return (
    <div className={styles.container}>
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
            동연령대 상위 {100 - lyconScore}% ({lyconGradeLabel})
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
              <span className={styles.lyconScoreItemLabel}>부채건전성</span>
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
    </div>
  );
}
