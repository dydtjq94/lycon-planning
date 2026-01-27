"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./DiagnosisSummaryCards.module.css";

type DiagnosisStatus = "good" | "caution" | "warning";

interface DiagnosisCard {
  id: string;
  title: string;
  value: string;
  status: DiagnosisStatus;
  statusLabel: string;
}

interface DiagnosisSummaryCardsProps {
  userId: string;
}

export function DiagnosisSummaryCards({ userId }: DiagnosisSummaryCardsProps) {
  const [cards, setCards] = useState<DiagnosisCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDiagnosisData = async () => {
      try {
        const supabase = createClient();

        // 1. 프로필 정보 조회
        const { data: profile } = await supabase
          .from("profiles")
          .select("birth_date, target_retirement_age")
          .eq("id", userId)
          .single();

        if (!profile) return;

        const birthYear = profile.birth_date
          ? new Date(profile.birth_date).getFullYear()
          : new Date().getFullYear() - 40;
        const currentAge = new Date().getFullYear() - birthYear;
        const targetRetirementAge = profile.target_retirement_age || 60;
        const lifeExpectancy = 90;

        // 2. 시뮬레이션 조회
        const { data: simulation } = await supabase
          .from("simulations")
          .select("id")
          .eq("profile_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!simulation) return;

        // 3. 재무 데이터 병렬 조회
        const [
          { data: incomes },
          { data: expenses },
          { data: realEstates },
          { data: savings },
          { data: debts },
          { data: nationalPensions },
          { data: retirementPensions },
          { data: personalPensions },
        ] = await Promise.all([
          supabase.from("incomes").select("*").eq("simulation_id", simulation.id),
          supabase.from("expenses").select("*").eq("simulation_id", simulation.id),
          supabase.from("real_estates").select("*").eq("simulation_id", simulation.id),
          supabase.from("savings").select("*").eq("simulation_id", simulation.id),
          supabase.from("debts").select("*").eq("simulation_id", simulation.id),
          supabase.from("national_pensions").select("*").eq("simulation_id", simulation.id),
          supabase.from("retirement_pensions").select("*").eq("simulation_id", simulation.id),
          supabase.from("personal_pensions").select("*").eq("simulation_id", simulation.id),
        ]);

        // 4. 계산 로직
        const toMonthly = (amount: number, frequency: string) =>
          frequency === "yearly" ? Math.round(amount / 12) : amount;

        const monthlyIncome = (incomes || []).reduce(
          (sum, i) => sum + toMonthly(i.amount || 0, i.frequency || "monthly"),
          0
        );

        const monthlyFixedExpense = (expenses || [])
          .filter((e) => e.expense_category === "fixed")
          .reduce((sum, e) => sum + toMonthly(e.amount || 0, e.frequency || "monthly"), 0);

        const monthlyLivingExpense = (expenses || [])
          .filter((e) => e.expense_category !== "fixed")
          .reduce((sum, e) => sum + toMonthly(e.amount || 0, e.frequency || "monthly"), 0);

        // 자산 (억원)
        const realEstateAsset =
          (realEstates || []).reduce((sum, r) => sum + (r.current_value || 0), 0) / 10000;
        const financialAsset =
          (savings || []).reduce((sum, s) => sum + (s.current_balance || 0), 0) / 10000;
        const pensionAsset =
          ((retirementPensions || []).reduce((sum, p) => sum + (p.current_balance || 0), 0) +
            (personalPensions || []).reduce((sum, p) => sum + (p.current_balance || 0), 0)) /
          10000;
        const totalAsset = realEstateAsset + financialAsset + pensionAsset;

        // 부채 (만원)
        const totalDebt = (debts || []).reduce(
          (sum, d) => sum + (d.current_balance || d.principal || 0),
          0
        );

        // 부채 이자
        const monthlyInterest = (debts || []).reduce((sum, d) => {
          const balance = d.current_balance || d.principal || 0;
          const rate = d.interest_rate || 5;
          return sum + Math.round((balance * rate) / 100 / 12);
        }, 0);

        // 현재 현금흐름
        const currentMonthlyExpense = monthlyFixedExpense + monthlyLivingExpense + monthlyInterest;
        const currentMonthlyGap = monthlyIncome - currentMonthlyExpense;

        // 저축률
        const savingsRate = monthlyIncome > 0 ? (currentMonthlyGap / monthlyIncome) * 100 : 0;

        // 연금 수령액 계산
        const calculateMonthlyPension = (balance: number, years: number) => {
          const months = (years || 20) * 12;
          return Math.round(balance / months);
        };

        const selfNationalPension = (nationalPensions || []).find((p) => p.owner === "self");
        const spouseNationalPension = (nationalPensions || []).find((p) => p.owner === "spouse");
        const selfRetirementPension = (retirementPensions || []).find((p) => p.owner === "self");
        const spouseRetirementPension = (retirementPensions || []).find((p) => p.owner === "spouse");
        const selfPersonalPensions = (personalPensions || []).filter((p) => p.owner === "self");
        const spousePersonalPensions = (personalPensions || []).filter((p) => p.owner === "spouse");

        const monthlyPension =
          (selfNationalPension?.expected_monthly_amount || 0) +
          (spouseNationalPension?.expected_monthly_amount || 0) +
          (selfRetirementPension
            ? calculateMonthlyPension(
                selfRetirementPension.current_balance || 0,
                selfRetirementPension.receiving_years || 20
              )
            : 0) +
          (spouseRetirementPension
            ? calculateMonthlyPension(
                spouseRetirementPension.current_balance || 0,
                spouseRetirementPension.receiving_years || 20
              )
            : 0) +
          selfPersonalPensions.reduce(
            (sum, p) => sum + calculateMonthlyPension(p.current_balance || 0, p.receiving_years || 20),
            0
          ) +
          spousePersonalPensions.reduce(
            (sum, p) => sum + calculateMonthlyPension(p.current_balance || 0, p.receiving_years || 20),
            0
          );

        // 은퇴 후 월지출 (현재의 70%)
        const currentExpenseBase = monthlyFixedExpense + monthlyLivingExpense;
        const monthlyExpense = Math.round(currentExpenseBase * 0.7);
        const monthlyGap = monthlyPension - monthlyExpense;

        // 연금 충당률
        const pensionCoverageRate = monthlyExpense > 0 ? Math.round((monthlyPension / monthlyExpense) * 100) : 0;

        // 자산 지속성 계산
        const yearsToRetirement = Math.max(0, targetRetirementAge - currentAge);
        const growthRate = 0.025;
        const liquidAsset = Math.round((financialAsset + pensionAsset - totalDebt / 10000) * 100) / 100;
        const liquidAssetAtRetirement =
          Math.round(liquidAsset * Math.pow(1 + growthRate, yearsToRetirement) * 100) / 100;
        const retirementYears = lifeExpectancy - targetRetirementAge;
        const annualShortfall = monthlyGap < 0 ? (Math.abs(monthlyGap) * 12) / 10000 : 0;
        const yearsOfWithdrawal =
          liquidAssetAtRetirement <= 0
            ? 0
            : annualShortfall > 0
              ? Math.round((liquidAssetAtRetirement / annualShortfall) * 10) / 10
              : 999;

        // 부동산 비율
        const realEstateRatio = totalAsset > 0 ? Math.round((realEstateAsset / totalAsset) * 100) : 0;

        // 5. 카드 생성
        const diagnosisCards: DiagnosisCard[] = [];

        // 카드 1: 저축 여력
        const getSavingsStatus = (): { status: DiagnosisStatus; label: string } => {
          if (savingsRate >= 20) return { status: "good", label: "양호" };
          if (savingsRate >= 10) return { status: "caution", label: "경과 관찰" };
          return { status: "warning", label: "정밀 검진 권고" };
        };
        const savingsStatus = getSavingsStatus();
        diagnosisCards.push({
          id: "savings",
          title: "저축 여력",
          value: savingsRate >= 0 ? `${Math.round(savingsRate)}%` : "적자",
          status: savingsStatus.status,
          statusLabel: savingsStatus.label,
        });

        // 카드 2: 은퇴 현금흐름 (연금 충당률 기준)
        const getRetirementStatus = (): { status: DiagnosisStatus; label: string } => {
          // 연금 충당률 100% 이상 (연금으로 생활비 충당 가능)
          if (pensionCoverageRate >= 100) return { status: "good", label: "양호" };
          // 연금 충당률 70% 이상
          if (pensionCoverageRate >= 70) return { status: "caution", label: "경과 관찰" };
          // 연금 충당률 70% 미만
          return { status: "warning", label: "정밀 검진 권고" };
        };
        const retirementStatus = getRetirementStatus();
        diagnosisCards.push({
          id: "retirement",
          title: "은퇴 현금흐름",
          value: monthlyGap >= 0 ? `+${monthlyGap}만원/월` : `${monthlyGap}만원/월`,
          status: retirementStatus.status,
          statusLabel: retirementStatus.label,
        });

        // 카드 3: 연금 충당률
        const getPensionStatus = (): { status: DiagnosisStatus; label: string } => {
          if (pensionCoverageRate >= 80) return { status: "good", label: "양호" };
          if (pensionCoverageRate >= 50) return { status: "caution", label: "경과 관찰" };
          return { status: "warning", label: "정밀 검진 권고" };
        };
        const pensionStatus = getPensionStatus();
        diagnosisCards.push({
          id: "pension",
          title: "연금 충당률",
          value: `${pensionCoverageRate}%`,
          status: pensionStatus.status,
          statusLabel: pensionStatus.label,
        });

        // 카드 4: 자산 지속성
        const getSustainabilityStatus = (): { status: DiagnosisStatus; label: string; value: string } => {
          if (yearsOfWithdrawal >= retirementYears) {
            return { status: "good", label: "양호", value: "충분" };
          }
          if (yearsOfWithdrawal >= retirementYears * 0.7) {
            return { status: "caution", label: "경과 관찰", value: `${Math.round(yearsOfWithdrawal)}년` };
          }
          return { status: "warning", label: "정밀 검진 권고", value: `${Math.round(yearsOfWithdrawal)}년` };
        };
        const sustainabilityStatus = getSustainabilityStatus();
        diagnosisCards.push({
          id: "sustainability",
          title: "자산 지속성",
          value: sustainabilityStatus.value,
          status: sustainabilityStatus.status,
          statusLabel: sustainabilityStatus.label,
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

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.cardGrid}>
        {cards.map((card) => (
          <div key={card.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{card.title}</span>
            </div>
            <div className={styles.cardValue}>{card.value}</div>
            <div className={`${styles.cardStatus} ${styles[card.status]}`}>
              {card.statusLabel}
            </div>
          </div>
        ))}
      </div>
      <button
        className={styles.reportButton}
        onClick={() => window.location.href = "/waiting/report/mobile"}
      >
        검진 결과 자세히 보기
      </button>
    </div>
  );
}
