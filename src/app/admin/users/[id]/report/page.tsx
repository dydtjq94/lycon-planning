"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DiagnosisReport, DiagnosisData } from "./DiagnosisReport";
import styles from "./report.module.css";

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [opinion, setOpinion] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient();

        // 1. 프로필 정보 조회
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("name, birth_date, target_retirement_age, report_published_at, report_opinion")
          .eq("id", userId)
          .single();

        if (profileError) throw new Error("프로필을 찾을 수 없습니다.");

        const birthYear = profile.birth_date
          ? new Date(profile.birth_date).getFullYear()
          : new Date().getFullYear() - 40;
        const currentAge = new Date().getFullYear() - birthYear;

        // 2. 배우자 정보 조회
        const { data: spouse } = await supabase
          .from("family_members")
          .select("birth_date")
          .eq("user_id", userId)
          .eq("relationship", "spouse")
          .single();

        const spouseAge = spouse?.birth_date
          ? new Date().getFullYear() - new Date(spouse.birth_date).getFullYear()
          : null;

        // 3. 시뮬레이션 조회
        const { data: simulation } = await supabase
          .from("simulations")
          .select("id")
          .eq("profile_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!simulation) throw new Error("시뮬레이션 데이터가 없습니다.");

        // 4. 모든 재무 데이터 병렬 조회
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

        // 5. 데이터 매핑
        // 월환산 함수
        const toMonthly = (amount: number, frequency: string) =>
          frequency === "yearly" ? Math.round(amount / 12) : amount;

        // 소득 합계
        const monthlyIncome = (incomes || []).reduce(
          (sum, i) => sum + toMonthly(i.amount || 0, i.frequency || "monthly"),
          0
        );

        // 지출 합계
        const monthlyFixedExpense = (expenses || [])
          .filter((e) => e.expense_category === "fixed")
          .reduce((sum, e) => sum + toMonthly(e.amount || 0, e.frequency || "monthly"), 0);

        const monthlyLivingExpense = (expenses || [])
          .filter((e) => e.expense_category !== "fixed")
          .reduce((sum, e) => sum + toMonthly(e.amount || 0, e.frequency || "monthly"), 0);

        // 부동산 자산 (억원)
        const realEstateAsset =
          (realEstates || []).reduce((sum, r) => sum + (r.current_value || 0), 0) / 10000;

        // 금융자산 (억원)
        const financialAsset =
          (savings || []).reduce((sum, s) => sum + (s.current_balance || 0), 0) / 10000;

        // 연금자산 (억원)
        const pensionAsset =
          ((retirementPensions || []).reduce((sum, p) => sum + (p.current_balance || 0), 0) +
            (personalPensions || []).reduce((sum, p) => sum + (p.current_balance || 0), 0)) /
          10000;

        // 부채 분류
        const mortgageDebts = (debts || []).filter((d) => d.type === "mortgage");
        const creditDebts = (debts || []).filter(
          (d) => d.type === "credit" || d.type === "credit_line"
        );
        const otherDebts = (debts || []).filter(
          (d) => !["mortgage", "credit", "credit_line"].includes(d.type)
        );

        const mortgageAmount = mortgageDebts.reduce(
          (sum, d) => sum + (d.current_balance || d.principal || 0),
          0
        );
        const creditLoanAmount = creditDebts.reduce(
          (sum, d) => sum + (d.current_balance || d.principal || 0),
          0
        );
        const otherDebtAmount = otherDebts.reduce(
          (sum, d) => sum + (d.current_balance || d.principal || 0),
          0
        );

        // 국민연금
        const selfNationalPension = (nationalPensions || []).find((p) => p.owner === "self");
        const spouseNationalPension = (nationalPensions || []).find((p) => p.owner === "spouse");

        // 퇴직연금 월수령액 계산
        const calculateMonthlyPension = (balance: number, years: number) => {
          const months = (years || 20) * 12;
          return Math.round(balance / months);
        };

        const selfRetirementPension = (retirementPensions || []).find((p) => p.owner === "self");
        const spouseRetirementPension = (retirementPensions || []).find(
          (p) => p.owner === "spouse"
        );

        // 개인연금
        const selfPersonalPensions = (personalPensions || []).filter((p) => p.owner === "self");
        const spousePersonalPensions = (personalPensions || []).filter(
          (p) => p.owner === "spouse"
        );

        const diagnosisData: DiagnosisData = {
          customerName: profile.name || "고객",
          currentAge,
          spouseAge,
          lifeExpectancy: 90,
          targetRetirementAge: profile.target_retirement_age || 60,
          // 연금 (만원/월)
          nationalPensionPersonal: selfNationalPension?.expected_monthly_amount || 0,
          nationalPensionSpouse: spouseNationalPension?.expected_monthly_amount || 0,
          retirementPensionPersonal: selfRetirementPension
            ? calculateMonthlyPension(
                selfRetirementPension.current_balance || 0,
                selfRetirementPension.receiving_years || 20
              )
            : 0,
          retirementPensionSpouse: spouseRetirementPension
            ? calculateMonthlyPension(
                spouseRetirementPension.current_balance || 0,
                spouseRetirementPension.receiving_years || 20
              )
            : 0,
          privatePensionPersonal: selfPersonalPensions.reduce(
            (sum, p) =>
              sum + calculateMonthlyPension(p.current_balance || 0, p.receiving_years || 20),
            0
          ),
          privatePensionSpouse: spousePersonalPensions.reduce(
            (sum, p) =>
              sum + calculateMonthlyPension(p.current_balance || 0, p.receiving_years || 20),
            0
          ),
          otherIncomePersonal: 0,
          otherIncomeSpouse: 0,
          // 자산 (억원)
          realEstateAsset,
          financialAsset,
          pensionAsset,
          // 부채 (만원)
          mortgageAmount,
          mortgageRate: mortgageDebts[0]?.interest_rate || 4.5,
          creditLoanAmount,
          creditLoanRate: creditDebts[0]?.interest_rate || 6.8,
          otherDebtAmount,
          otherDebtRate: otherDebts[0]?.interest_rate || 5.0,
          // 현금흐름 (만원/월)
          monthlyIncome,
          monthlyFixedExpense,
          monthlyLivingExpense,
        };

        setData(diagnosisData);
        setIsPublished(!!profile.report_published_at);
        setOpinion(profile.report_opinion || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "데이터 로드 실패");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>보고서를 생성하고 있습니다...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.errorContainer}>
        <p>{error || "데이터를 불러올 수 없습니다."}</p>
        <button onClick={() => router.back()}>뒤로 가기</button>
      </div>
    );
  }

  const handlePublish = async () => {
    if (isPublished) {
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
        setIsPublished(true);
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

  return (
    <div className={styles.pageContainer}>
      <button className={styles.backButton} onClick={() => router.back()}>
        <ArrowLeft size={16} />
        뒤로 가기
      </button>
      <div className={styles.contentLayout}>
        <div className={styles.reportWrapper}>
          <DiagnosisReport
            data={data}
            userId={userId}
            isPublished={isPublished}
            hideActions
            opinion={opinion}
          />
        </div>
        <div className={styles.sidePanel}>
          <div className={styles.opinionPanel}>
            <h3 className={styles.panelTitle}>담당자 소견 작성</h3>
            <textarea
              className={styles.opinionTextarea}
              placeholder="고객에게 전달할 소견을 작성하세요..."
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              rows={8}
              disabled={isPublished}
            />
            <div className={styles.formatGuide}>
              <span className={styles.formatItem}><strong>**굵게**</strong></span>
              <span className={styles.formatItem}><em>*기울임*</em></span>
              <span className={styles.formatItem}><u>__밑줄__</u></span>
            </div>
            <p className={styles.opinionHint}>
              작성하지 않으면 자동 생성된 소견이 표시됩니다.
            </p>
          </div>
          <div className={styles.actionPanel}>
            <button
              className={styles.printButton}
              onClick={() => window.print()}
            >
              인쇄하기
            </button>
            <button
              className={`${styles.publishButton} ${isPublished ? styles.published : ""}`}
              onClick={handlePublish}
              disabled={publishing || isPublished}
            >
              {publishing ? "발행 중..." : isPublished ? "발행 완료" : "보고서 발행하기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
