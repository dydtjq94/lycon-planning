"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  convertPrepDataToDiagnosisData,
  calculateAllDiagnosisMetrics,
  PrepDataStore,
} from "@/lib/services/diagnosisDataService";
import styles from "./DiagnosisSummaryCards.module.css";

type DiagnosisStatus = "good" | "caution" | "warning";

interface DiagnosisCard {
  id: string;
  title: string;
  value: string;
  status: DiagnosisStatus;
  statusLabel: string;
}

interface RetirementVerdict {
  canRetire: boolean;
  targetAge: number;
  status: DiagnosisStatus;
  label: string;
}

interface DiagnosisSummaryCardsProps {
  userId: string;
}

export function DiagnosisSummaryCards({ userId }: DiagnosisSummaryCardsProps) {
  const [cards, setCards] = useState<DiagnosisCard[]>([]);
  const [retirementVerdict, setRetirementVerdict] = useState<RetirementVerdict | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDiagnosisData = async () => {
      try {
        const supabase = createClient();

        // 프로필 정보 및 prep_data 조회
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, birth_date, target_retirement_age, prep_data")
          .eq("id", userId)
          .single();

        if (!profile) return;

        // 공통 유틸리티로 데이터 변환 (prep_data가 없어도 기본값으로 계산)
        const diagnosisData = convertPrepDataToDiagnosisData({
          name: profile.name,
          birth_date: profile.birth_date,
          target_retirement_age: profile.target_retirement_age,
          prep_data: profile.prep_data as PrepDataStore,
        });

        // 중앙집중화된 계산 함수 사용
        const metrics = calculateAllDiagnosisMetrics(diagnosisData);
        const targetAge = diagnosisData.targetRetirementAge;

        // 카드 생성 - 모바일 리포트 요약 탭과 동일한 항목
        const diagnosisCards: DiagnosisCard[] = [];

        // 카드 1: 순자산 (상위 퍼센트 포함)
        const getNetWorthPercentile = (nw: number): string => {
          if (nw >= 10) return "상위 0~20%";
          if (nw >= 5) return "상위 20~40%";
          if (nw >= 2) return "상위 40~60%";
          if (nw >= 1) return "상위 60~80%";
          return "상위 80~100%";
        };
        const getNetWorthStatus = (): { status: DiagnosisStatus; label: string } => {
          if (metrics.netWorth >= 5) return { status: "good", label: getNetWorthPercentile(metrics.netWorth) };
          if (metrics.netWorth >= 2) return { status: "caution", label: getNetWorthPercentile(metrics.netWorth) };
          return { status: "warning", label: getNetWorthPercentile(metrics.netWorth) };
        };
        const netWorthStatus = getNetWorthStatus();
        diagnosisCards.push({
          id: "netWorth",
          title: "순자산",
          value: `${Math.round(metrics.netWorth)}억원`,
          status: netWorthStatus.status,
          statusLabel: netWorthStatus.label,
        });

        // 카드 2: 연금 충당률
        const getPensionStatus = (): { status: DiagnosisStatus; label: string } => {
          if (metrics.pensionCoverageRate >= 100) return { status: "good", label: "안전" };
          if (metrics.pensionCoverageRate >= 70) return { status: "caution", label: "주의" };
          return { status: "warning", label: "위험" };
        };
        const pensionStatus = getPensionStatus();
        diagnosisCards.push({
          id: "pension",
          title: "연금 충당률",
          value: `${metrics.pensionCoverageRate}%`,
          status: pensionStatus.status,
          statusLabel: pensionStatus.label,
        });

        // 카드 3: 자산 지속성
        const getSustainabilityStatus = (): { status: DiagnosisStatus; label: string } => {
          if (metrics.yearsOfWithdrawal >= metrics.retirementYears) return { status: "good", label: "안전" };
          if (metrics.yearsOfWithdrawal >= metrics.retirementYears * 0.7) return { status: "caution", label: "주의" };
          return { status: "warning", label: "위험" };
        };
        const sustainabilityStatus = getSustainabilityStatus();
        const sustainabilityValue = metrics.yearsOfWithdrawal >= 999
          ? "충분"
          : `${Math.round(metrics.yearsOfWithdrawal)}년`;
        diagnosisCards.push({
          id: "sustainability",
          title: "자산 지속성",
          value: sustainabilityValue,
          status: sustainabilityStatus.status,
          statusLabel: sustainabilityStatus.label,
        });

        // 은퇴 판정 데이터 저장 (중앙집중화된 결과 사용)
        let verdictStatus: DiagnosisStatus;
        if (metrics.retirementVerdict.status === "possible") {
          verdictStatus = "good";
        } else if (metrics.retirementVerdict.status === "conditional") {
          verdictStatus = "caution";
        } else {
          verdictStatus = "warning";
        }

        setRetirementVerdict({
          canRetire: metrics.retirementVerdict.status !== "difficult",
          targetAge,
          status: verdictStatus,
          label: metrics.retirementVerdict.label,
        });

        setCards(diagnosisCards);
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
        <div className={styles.skeletonGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 은퇴 판정 카드 */}
      {retirementVerdict && (
        <div className={`${styles.verdictCard} ${styles[retirementVerdict.status]}`}>
          <div className={styles.verdictLabel}>은퇴 판정</div>
          <div className={styles.verdictContent}>
            <span className={`${styles.verdictBadge} ${styles[retirementVerdict.status]}`}>
              {retirementVerdict.label}
            </span>
            <span className={styles.verdictText}>
              만 {retirementVerdict.targetAge}세 은퇴 {retirementVerdict.label === "재검토" ? "재검토 필요" : retirementVerdict.label}
            </span>
          </div>
        </div>
      )}

      {/* 요약 카드 그리드 */}
      {cards.length > 0 && (
        <div className={styles.cardGrid}>
          {cards.map((card) => (
            <div key={card.id} className={styles.card}>
              <div className={styles.cardTitle}>{card.title}</div>
              <div className={styles.cardValue}>{card.value}</div>
              <div className={`${styles.cardStatus} ${styles[card.status]}`}>
                {card.statusLabel}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className={styles.reportButton}
        onClick={() => window.location.href = "/waiting/report/mobile"}
      >
        검진 결과 자세히 보기
      </button>
    </div>
  );
}
