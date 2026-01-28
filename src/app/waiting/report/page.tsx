"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DiagnosisReport, DiagnosisData } from "@/app/admin/users/[id]/report/DiagnosisReport";
import styles from "./report.module.css";

// prep_data 타입 정의
interface FamilyMember {
  relationship: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
}

interface HousingData {
  housingType: "자가" | "전세" | "월세" | "무상";
  currentValue?: number;
  hasLoan: boolean;
  loanAmount?: number;
  loanRate?: number;
}

interface FinancialAssetItem {
  type: string;
  owner: "self" | "spouse";
  currentBalance: number;
}

interface InvestmentAccountData {
  securities?: { balance: number };
  crypto?: { balance: number };
  gold?: { balance: number };
}

interface DebtItem {
  type: string;
  principal: number;
  currentBalance?: number;
  interestRate: number;
}

interface IncomeFormData {
  selfLaborIncome: number;
  selfLaborFrequency: "monthly" | "yearly";
  spouseLaborIncome: number;
  spouseLaborFrequency: "monthly" | "yearly";
  additionalIncomes: {
    type: string;
    owner: "self" | "spouse";
    amount: number;
    frequency: "monthly" | "yearly";
  }[];
}

interface ExpenseFormData {
  livingExpense: number;
  livingExpenseDetails?: {
    food?: number;
    transport?: number;
    shopping?: number;
    leisure?: number;
    other?: number;
  };
  fixedExpenses: Array<{ type: string; title: string; amount: number; frequency: "monthly" | "yearly" }>;
}

interface NationalPensionData {
  selfExpectedAmount: number;
  spouseExpectedAmount: number;
}

interface RetirementPensionData {
  selfType: "db" | "dc" | "none";
  selfBalance: number | null;
  spouseType: "db" | "dc" | "none";
  spouseBalance: number | null;
}

interface PersonalPensionItem {
  type: string;
  owner: "self" | "spouse";
  balance: number;
}

interface PrepDataStore {
  family?: FamilyMember[];
  income?: IncomeFormData;
  expense?: ExpenseFormData;
  savings?: FinancialAssetItem[];
  investment?: InvestmentAccountData;
  housing?: HousingData;
  debt?: DebtItem[];
  nationalPension?: NationalPensionData;
  retirementPension?: RetirementPensionData;
  personalPension?: PersonalPensionItem[];
}

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

        // 프로필 정보 및 prep_data 조회
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("name, birth_date, target_retirement_age, report_published_at, report_opinion, prep_data")
          .eq("id", user.id)
          .single();

        if (profileError) throw new Error("프로필을 찾을 수 없습니다.");

        if (!profile.report_published_at) {
          setError("발행된 보고서가 없습니다.");
          setLoading(false);
          return;
        }

        const prepData = (profile.prep_data || {}) as PrepDataStore;

        // 기본 정보
        const birthYear = profile.birth_date
          ? new Date(profile.birth_date).getFullYear()
          : new Date().getFullYear() - 40;
        const currentAge = new Date().getFullYear() - birthYear;

        // 배우자 나이 (prep_data.family에서 추출)
        const spouse = prepData.family?.find((m) => m.relationship === "spouse");
        const spouseAge = spouse?.birth_date
          ? new Date().getFullYear() - new Date(spouse.birth_date).getFullYear()
          : null;

        // 월환산 함수
        const toMonthly = (amount: number, frequency: string) =>
          frequency === "yearly" ? Math.round(amount / 12) : amount;

        // 소득 계산 (prep_data.income)
        const incomeData = prepData.income;
        let monthlyIncome = 0;
        if (incomeData) {
          monthlyIncome += toMonthly(incomeData.selfLaborIncome || 0, incomeData.selfLaborFrequency || "monthly");
          monthlyIncome += toMonthly(incomeData.spouseLaborIncome || 0, incomeData.spouseLaborFrequency || "monthly");
          for (const additional of incomeData.additionalIncomes || []) {
            monthlyIncome += toMonthly(additional.amount || 0, additional.frequency || "monthly");
          }
        }

        // 지출 계산 (prep_data.expense)
        const expenseData = prepData.expense;
        let monthlyFixedExpense = 0;
        let monthlyLivingExpense = 0;
        let expenseFood = 0;
        let expenseTransport = 0;
        let expenseShopping = 0;
        let expenseLeisure = 0;
        let expenseOther = 0;

        if (expenseData) {
          // 고정 지출
          for (const fixed of expenseData.fixedExpenses || []) {
            monthlyFixedExpense += toMonthly(fixed.amount || 0, fixed.frequency || "monthly");
          }

          // 변동 생활비 세부 항목
          const details = expenseData.livingExpenseDetails;
          if (details) {
            expenseFood = details.food || 0;
            expenseTransport = details.transport || 0;
            expenseShopping = details.shopping || 0;
            expenseLeisure = details.leisure || 0;
            expenseOther = details.other || 0;
            monthlyLivingExpense = expenseFood + expenseTransport + expenseShopping + expenseLeisure + expenseOther;
          } else {
            // livingExpenseDetails가 없으면 livingExpense를 비율로 분배
            monthlyLivingExpense = expenseData.livingExpense || 0;
            expenseFood = Math.round(monthlyLivingExpense * 0.35);
            expenseTransport = Math.round(monthlyLivingExpense * 0.15);
            expenseShopping = Math.round(monthlyLivingExpense * 0.20);
            expenseLeisure = Math.round(monthlyLivingExpense * 0.15);
            expenseOther = monthlyLivingExpense - expenseFood - expenseTransport - expenseShopping - expenseLeisure;
          }
        }

        // 부동산 자산 (억원) - prep_data.housing
        const housingData = prepData.housing;
        const realEstateAsset = housingData?.housingType === "자가"
          ? (housingData.currentValue || 0) / 10000
          : 0;

        // 현금성 자산 (억원) - prep_data.savings
        const savingsData = prepData.savings || [];
        const cashTypes = ["checking", "savings", "deposit"];
        const cashAsset = savingsData
          .filter((s) => cashTypes.includes(s.type))
          .reduce((sum, s) => sum + (s.currentBalance || 0), 0) / 10000;

        // 투자 자산 (억원) - prep_data.investment + prep_data.savings 중 투자형
        const investmentData = prepData.investment;
        let investmentAsset = 0;
        if (investmentData) {
          investmentAsset += (investmentData.securities?.balance || 0) / 10000;
          investmentAsset += (investmentData.crypto?.balance || 0) / 10000;
          investmentAsset += (investmentData.gold?.balance || 0) / 10000;
        }
        // savings에서 투자형 자산 추가
        investmentAsset += savingsData
          .filter((s) => !cashTypes.includes(s.type))
          .reduce((sum, s) => sum + (s.currentBalance || 0), 0) / 10000;

        // 연금 자산 (억원) - 퇴직연금 + 개인연금 현재 잔액
        const retirementData = prepData.retirementPension;
        const personalPensions = prepData.personalPension || [];

        let pensionAsset = 0;
        if (retirementData) {
          pensionAsset += (retirementData.selfBalance || 0) / 10000;
          pensionAsset += (retirementData.spouseBalance || 0) / 10000;
        }
        pensionAsset += personalPensions.reduce((sum, p) => sum + (p.balance || 0), 0) / 10000;

        // 부채 분류 - prep_data.debt + prep_data.housing 대출
        const debtData = prepData.debt || [];

        // 주담대: housing 대출 + debt 중 mortgage 타입
        let mortgageAmount = 0;
        let mortgageRate = 4.5;
        if (housingData?.hasLoan) {
          mortgageAmount += housingData.loanAmount || 0;
          mortgageRate = housingData.loanRate || 4.5;
        }
        const mortgageDebts = debtData.filter((d) => d.type === "mortgage");
        mortgageAmount += mortgageDebts.reduce((sum, d) => sum + (d.currentBalance || d.principal || 0), 0);
        if (mortgageDebts.length > 0) {
          mortgageRate = mortgageDebts[0].interestRate || 4.5;
        }

        // 신용대출
        const creditDebts = debtData.filter((d) => d.type === "credit" || d.type === "credit_line");
        const creditLoanAmount = creditDebts.reduce((sum, d) => sum + (d.currentBalance || d.principal || 0), 0);
        const creditLoanRate = creditDebts[0]?.interestRate || 6.8;

        // 기타 부채
        const otherDebts = debtData.filter((d) => !["mortgage", "credit", "credit_line"].includes(d.type));
        const otherDebtAmount = otherDebts.reduce((sum, d) => sum + (d.currentBalance || d.principal || 0), 0);
        const otherDebtRate = otherDebts[0]?.interestRate || 5.0;

        // 국민연금 - prep_data.nationalPension
        const nationalPensionData = prepData.nationalPension;
        const nationalPensionPersonal = nationalPensionData?.selfExpectedAmount || 0;
        const nationalPensionSpouse = nationalPensionData?.spouseExpectedAmount || 0;

        // 퇴직연금 월수령액 계산 (잔액 / 20년)
        const calculateMonthlyPension = (balance: number, years: number = 20) => {
          const months = years * 12;
          return Math.round(balance / months);
        };

        const retirementPensionPersonal = retirementData?.selfBalance
          ? calculateMonthlyPension(retirementData.selfBalance)
          : 0;
        const retirementPensionSpouse = retirementData?.spouseBalance
          ? calculateMonthlyPension(retirementData.spouseBalance)
          : 0;

        // 개인연금 월수령액
        const selfPersonalPensions = personalPensions.filter((p) => p.owner === "self");
        const spousePersonalPensions = personalPensions.filter((p) => p.owner === "spouse");

        const privatePensionPersonal = selfPersonalPensions.reduce(
          (sum, p) => sum + calculateMonthlyPension(p.balance || 0),
          0
        );
        const privatePensionSpouse = spousePersonalPensions.reduce(
          (sum, p) => sum + calculateMonthlyPension(p.balance || 0),
          0
        );

        const diagnosisData: DiagnosisData = {
          customerName: profile.name || "고객",
          currentAge,
          spouseAge,
          lifeExpectancy: 90,
          targetRetirementAge: profile.target_retirement_age || 60,
          // 연금 (만원/월)
          nationalPensionPersonal,
          nationalPensionSpouse,
          retirementPensionPersonal,
          retirementPensionSpouse,
          privatePensionPersonal,
          privatePensionSpouse,
          otherIncomePersonal: 0,
          otherIncomeSpouse: 0,
          // 자산 (억원)
          realEstateAsset,
          cashAsset,
          investmentAsset,
          pensionAsset,
          // 부채 (만원)
          mortgageAmount,
          mortgageRate,
          creditLoanAmount,
          creditLoanRate,
          otherDebtAmount,
          otherDebtRate,
          // 현금흐름 (만원/월)
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
