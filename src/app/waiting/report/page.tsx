"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DiagnosisReport, DiagnosisData } from "@/app/admin/users/[id]/report/DiagnosisReport";
import styles from "./report.module.css";

export default function WaitingReportPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WaitingReportPageContent />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner} />
      <p>보고서를 불러오고 있습니다...</p>
    </div>
  );
}

function WaitingReportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPrintMode = searchParams.get("print") === "true";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opinion, setOpinion] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          localStorage.setItem("returnUrl", "/waiting/report");
          router.replace("/auth/login");
          return;
        }

        // 1. 프로필 정보 조회
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("name, birth_date, target_retirement_age, report_published_at, report_opinion")
          .eq("id", user.id)
          .single();

        if (profileError) throw new Error("프로필을 찾을 수 없습니다.");

        if (!profile.report_published_at) {
          setError("발행된 보고서가 없습니다.");
          setLoading(false);
          return;
        }

        const birthYear = profile.birth_date
          ? new Date(profile.birth_date).getFullYear()
          : new Date().getFullYear() - 40;
        const currentAge = new Date().getFullYear() - birthYear;

        // 2. 배우자 정보 조회
        const { data: spouse } = await supabase
          .from("family_members")
          .select("birth_date")
          .eq("user_id", user.id)
          .eq("relationship", "spouse")
          .single();

        const spouseAge = spouse?.birth_date
          ? new Date().getFullYear() - new Date(spouse.birth_date).getFullYear()
          : null;

        // 3. 시뮬레이션 조회
        const { data: simulation } = await supabase
          .from("simulations")
          .select("id")
          .eq("profile_id", user.id)
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

        const realEstateAsset =
          (realEstates || []).reduce((sum, r) => sum + (r.current_value || 0), 0) / 10000;

        // 금융자산 분리: 현금성 vs 투자
        const cashSavings = (savings || []).filter(
          (s) => s.type === "deposit" || s.type === "savings" || s.type === "emergency"
        );
        const investmentSavings = (savings || []).filter(
          (s) => s.type !== "deposit" && s.type !== "savings" && s.type !== "emergency"
        );
        const cashAsset =
          cashSavings.reduce((sum, s) => sum + (s.current_balance || 0), 0) / 10000;
        const investmentAsset =
          investmentSavings.reduce((sum, s) => sum + (s.current_balance || 0), 0) / 10000;

        // 지출 세부 항목 (카테고리별 분류)
        const toMonthlyExp = (amount: number, frequency: string) =>
          frequency === "yearly" ? Math.round(amount / 12) : amount;
        const expenseByCategory = (category: string) =>
          (expenses || [])
            .filter((e) => e.expense_type === category || e.name?.includes(category))
            .reduce((sum, e) => sum + toMonthlyExp(e.amount || 0, e.frequency || "monthly"), 0);

        const expenseFood = expenseByCategory("food") || Math.round(monthlyLivingExpense * 0.3);
        const expenseTransport = expenseByCategory("transport") || Math.round(monthlyLivingExpense * 0.15);
        const expenseShopping = expenseByCategory("shopping") || Math.round(monthlyLivingExpense * 0.2);
        const expenseLeisure = expenseByCategory("leisure") || Math.round(monthlyLivingExpense * 0.15);
        const expenseOther = monthlyLivingExpense - expenseFood - expenseTransport - expenseShopping - expenseLeisure;

        const pensionAsset =
          ((retirementPensions || []).reduce((sum, p) => sum + (p.current_balance || 0), 0) +
            (personalPensions || []).reduce((sum, p) => sum + (p.current_balance || 0), 0)) /
          10000;

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

        const selfNationalPension = (nationalPensions || []).find((p) => p.owner === "self");
        const spouseNationalPension = (nationalPensions || []).find((p) => p.owner === "spouse");

        const calculateMonthlyPension = (balance: number, years: number) => {
          const months = (years || 20) * 12;
          return Math.round(balance / months);
        };

        const selfRetirementPension = (retirementPensions || []).find((p) => p.owner === "self");
        const spouseRetirementPension = (retirementPensions || []).find(
          (p) => p.owner === "spouse"
        );

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
          realEstateAsset,
          cashAsset,
          investmentAsset,
          pensionAsset,
          mortgageAmount,
          mortgageRate: mortgageDebts[0]?.interest_rate || 4.5,
          creditLoanAmount,
          creditLoanRate: creditDebts[0]?.interest_rate || 6.8,
          otherDebtAmount,
          otherDebtRate: otherDebts[0]?.interest_rate || 5.0,
          monthlyIncome,
          monthlyFixedExpense,
          monthlyLivingExpense,
          // 지출 세부 항목 (만원/월)
          expenseFood,
          expenseTransport,
          expenseShopping,
          expenseLeisure,
          expenseOther,
        };

        setData(diagnosisData);
        setOpinion(profile.report_opinion || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "데이터 로드 실패");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  // 인쇄 모드일 때 자동으로 인쇄 다이얼로그 띄우기
  useEffect(() => {
    if (isPrintMode && !loading && data) {
      // 렌더링 완료 후 인쇄 다이얼로그
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPrintMode, loading, data]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>보고서를 불러오고 있습니다...</p>
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

  return (
    <div className={styles.pageContainer}>
      {!isPrintMode && (
        <button className={styles.backButton} onClick={() => router.back()}>
          <ArrowLeft size={16} />
          뒤로 가기
        </button>
      )}
      <DiagnosisReport data={data} userId="" isPublished={true} hideActions opinion={opinion} />
    </div>
  );
}
