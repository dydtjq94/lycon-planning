"use client";

import { useState, useEffect } from "react";
import {
  Landmark,
  TrendingUp,
  PiggyBank,
  Briefcase,
  Building2,
  Car,
  CreditCard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPortfolioPrices,
  calculatePortfolioAccountValues,
  calculateTermDepositValue,
  calculateExpectedBalance,
  calculateAccountTransactionSummary,
} from "@/lib/utils/accountValueCalculator";
import type { RepaymentType } from "@/lib/utils/loanCalculator";
import type { StepProps } from "./types";
import { formatMoney } from "@/lib/utils";
import styles from "./StepAssetReview.module.css";

interface StepAssetReviewProps extends StepProps {
  profileId: string;
  cachedGroups?: AssetGroup[] | null;
}

export interface AssetGroup {
  key: string;
  label: string;
  icon: typeof Landmark;
  color: string;
  items: { name: string; amount: number }[];
}

const GROUP_META: Record<string, { icon: typeof Landmark; color: string }> = {
  bank: { icon: Landmark, color: "#3b82f6" },
  investment: { icon: TrendingUp, color: "#10b981" },
  pension: { icon: PiggyBank, color: "#8b5cf6" },
  retirement: { icon: Briefcase, color: "#6366f1" },
  realEstate: { icon: Building2, color: "#f59e0b" },
  physical: { icon: Car, color: "#64748b" },
  debt: { icon: CreditCard, color: "#ef4444" },
};

// accounts 테이블 account_type 분류
const BANK_TYPES = ["checking", "savings", "deposit", "free_savings", "housing"];
const INVESTMENT_TYPES = ["general"];
const PENSION_TYPES = ["pension_savings", "irp", "isa"];
const RETIREMENT_TYPES = ["dc"];

export interface HousingExpenseInfo {
  title: string;
  housingType: string | null; // '자가' | '전세' | '월세' | '무상'
  monthlyRent: number; // 원 단위 (DB raw)
  maintenanceFee: number; // 원 단위
  deposit: number; // 원 단위
  hasLoan: boolean;
  loanAmount: number; // 원 단위
  loanRate: number | null;
  loanRepaymentType: string | null;
  loanStartYear: number | null;
  loanStartMonth: number | null;
  loanMaturityYear: number | null;
  loanMaturityMonth: number | null;
  graceEndYear: number | null;
  graceEndMonth: number | null;
  monthlyLoanPayment: number; // 만원 단위 (pre-calculated)
}

export interface PhysicalAssetLoanInfo {
  title: string;
  financingType: string | null; // 'loan' | 'installment'
  loanAmount: number;           // 원
  loanRate: number | null;
  loanRepaymentType: string | null;
  monthlyPayment: number;       // 만원 (pre-calculated)
}

export interface DebtExpenseInfo {
  title: string;
  debtType: string;             // 'credit' | 'student' | 'card' | 'other' etc
  currentBalance: number;       // 원
  interestRate: number;
  repaymentType: string;
  monthlyPayment: number;       // 만원 (pre-calculated)
}

/**
 * 현재 시점 기준 월 납부액 계산
 * - 만기일시상환: 이자만
 * - 원리금균등상환: 고정 월 상환액
 * - 원금균등상환: 현재 잔액 기준 이자 + 고정 원금
 * - 거치식상환: 거치기간 중 이자만, 이후 원리금균등
 */
function computeMonthlyLoanPayment(
  loanAmount: number,
  loanRate: number | null,
  loanRepaymentType: string | null,
  loanStartYear: number | null,
  loanStartMonth: number | null,
  loanMaturityYear: number | null,
  loanMaturityMonth: number | null,
  graceEndYear?: number | null,
  graceEndMonth?: number | null,
): number {
  if (!loanAmount || !loanMaturityYear || !loanMaturityMonth) return 0;

  const principal = Math.round(loanAmount / 10000); // 원 → 만원
  const rate = loanRate || 0;
  const monthlyRate = rate / 100 / 12;
  const repaymentType = (loanRepaymentType || '원리금균등상환') as RepaymentType;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const startY = loanStartYear || currentYear;
  const startM = loanStartMonth || currentMonth;

  // 총 대출기간 (개월)
  const totalMonths = (loanMaturityYear - startY) * 12 + (loanMaturityMonth - startM);
  if (totalMonths <= 0) return 0;

  // 경과 개월 수
  const elapsedMonths = Math.max(0, (currentYear - startY) * 12 + (currentMonth - startM));
  if (elapsedMonths >= totalMonths) return 0;

  switch (repaymentType) {
    case '만기일시상환': {
      return Math.round(principal * monthlyRate);
    }

    case '원리금균등상환': {
      if (monthlyRate === 0) return Math.round(principal / totalMonths);
      const pmt = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1);
      return Math.round(pmt);
    }

    case '원금균등상환': {
      const monthlyPrincipal = principal / totalMonths;
      const paidPrincipal = Math.min(elapsedMonths, totalMonths) * monthlyPrincipal;
      const currentBalance = Math.max(0, principal - paidPrincipal);
      return Math.round(monthlyPrincipal + currentBalance * monthlyRate);
    }

    case '거치식상환': {
      // 거치종료 절대 날짜로 현재 거치 중인지 판단
      const inGracePeriod = graceEndYear && graceEndMonth
        ? (currentYear < graceEndYear || (currentYear === graceEndYear && currentMonth < graceEndMonth))
        : true; // 거치기간 정보 없으면 거치 중으로 간주

      if (inGracePeriod) {
        return Math.round(principal * monthlyRate);
      }

      // 거치기간 후: 거치종료~만기 구간 원리금균등
      const repaymentMonths = (loanMaturityYear - graceEndYear!) * 12 + (loanMaturityMonth - graceEndMonth!);
      if (repaymentMonths <= 0) return Math.round(principal * monthlyRate);
      if (monthlyRate === 0) return Math.round(principal / repaymentMonths);
      const pmt = principal * (monthlyRate * Math.pow(1 + monthlyRate, repaymentMonths)) /
        (Math.pow(1 + monthlyRate, repaymentMonths) - 1);
      return Math.round(pmt);
    }

    default:
      return 0;
  }
}

export async function loadAssetGroups(profileId: string): Promise<{ groups: AssetGroup[]; housingExpenses: HousingExpenseInfo[]; physicalAssetLoans: PhysicalAssetLoanInfo[]; debtExpenses: DebtExpenseInfo[] }> {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [accountsRes, portfolioRes, budgetRes, customHoldingsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true),
    supabase
      .from("portfolio_transactions")
      .select("*")
      .eq("profile_id", profileId),
    supabase
      .from("budget_transactions")
      .select("account_id, type, amount")
      .eq("profile_id", profileId)
      .eq("year", currentYear)
      .eq("month", currentMonth),
    supabase
      .from("custom_holdings")
      .select("*")
      .eq("profile_id", profileId),
  ]);

  const accounts = accountsRes.data;
  const portfolioTransactions = portfolioRes.data || [];

  const priceCache = await fetchPortfolioPrices(portfolioTransactions);
  const investmentValues = calculatePortfolioAccountValues(
    portfolioTransactions,
    priceCache,
    accounts?.map((a) => ({ id: a.id, additional_amount: a.additional_amount })),
    customHoldingsRes.data || []
  );

  const savingsValues = new Map<string, number>();
  const txSummary = calculateAccountTransactionSummary(budgetRes.data || []);
  const bankTypeAccounts = accounts?.filter((a) =>
    BANK_TYPES.includes(a.account_type || "")
  ) || [];

  for (const acc of bankTypeAccounts) {
    if (acc.account_type === "checking") {
      savingsValues.set(acc.id, Math.round(calculateExpectedBalance(acc.current_balance || 0, txSummary[acc.id])));
    } else {
      savingsValues.set(acc.id, Math.round(calculateTermDepositValue(acc)));
    }
  }

  const getBalance = (accountId: string, currentBalance: number | null, isInvestment: boolean): number => {
    if (isInvestment && investmentValues.has(accountId)) {
      return investmentValues.get(accountId)!;
    }
    if (!isInvestment && savingsValues.has(accountId)) {
      return savingsValues.get(accountId)!;
    }
    return currentBalance || 0;
  };

  const RE_TYPES = ["real_estate", "residence", "land", "apartment", "house", "officetel", "commercial"];
  const PA_TYPES = ["car", "precious_metal", "art", "other_asset"];

  type SnapshotItem = { category: string; item_type: string; title: string; amount: number; metadata: Record<string, unknown> | null };
  let snapshotRealEstates: SnapshotItem[] = [];
  let snapshotPhysicalAssets: SnapshotItem[] = [];
  let snapshotDebts: SnapshotItem[] = [];
  let housingExpenses: HousingExpenseInfo[] = [];
  let physicalAssetLoans: PhysicalAssetLoanInfo[] = [];
  let debtExpenses: DebtExpenseInfo[] = [];

  const { data: snapshots } = await supabase
    .from("financial_snapshots")
    .select("id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .order("recorded_at", { ascending: false })
    .limit(1);

  if (snapshots && snapshots.length > 0) {
    const { data: items } = await supabase
      .from("financial_snapshot_items")
      .select("category, item_type, title, amount, metadata")
      .eq("snapshot_id", snapshots[0].id)
      .order("sort_order", { ascending: true });

    if (items) {
      snapshotRealEstates = items.filter((i) => i.category === "asset" && RE_TYPES.includes(i.item_type));
      snapshotPhysicalAssets = items.filter((i) => i.category === "asset" && PA_TYPES.includes(i.item_type));
      snapshotDebts = items.filter((i) => i.category === "debt");
    }
  }

  // housingExpenses: 월세/관리비/대출이 있는 부동산 항목
  housingExpenses = snapshotRealEstates
    .filter((i) => {
      const m = i.metadata || {};
      return (m.monthly_rent as number) > 0 || (m.maintenance_fee as number) > 0 || m.has_loan;
    })
    .map((i) => {
      const m = i.metadata || {};
      const loanStartYear = (m.loan_start_year as number) ?? (m.purchase_year as number) ?? null;
      const loanStartMonth = (m.loan_start_month as number) ?? (m.purchase_month as number) ?? null;
      const loanMaturityYear = (m.loan_maturity_year as number) ?? null;
      const loanMaturityMonth = (m.loan_maturity_month as number) ?? null;
      const graceEndYear = (m.grace_period_year as number) ?? null;
      const graceEndMonth = (m.grace_period_month as number) ?? null;
      const hasLoan = (m.has_loan as boolean) || false;
      const loanAmount = (m.loan_amount as number) || 0;
      const monthlyLoanPayment = hasLoan
        ? computeMonthlyLoanPayment(
            loanAmount,
            (m.loan_rate as number) ?? null,
            (m.loan_repayment_type as string) ?? null,
            loanStartYear,
            loanStartMonth,
            loanMaturityYear,
            loanMaturityMonth,
            graceEndYear,
            graceEndMonth,
          )
        : 0;
      return {
        title: i.title,
        housingType: (m.housing_type as string) || null,
        monthlyRent: (m.monthly_rent as number) || 0,
        maintenanceFee: (m.maintenance_fee as number) || 0,
        deposit: (m.deposit as number) || 0,
        hasLoan,
        loanAmount,
        loanRate: (m.loan_rate as number) ?? null,
        loanRepaymentType: (m.loan_repayment_type as string) ?? null,
        loanStartYear,
        loanStartMonth,
        loanMaturityYear,
        loanMaturityMonth,
        graceEndYear,
        graceEndMonth,
        monthlyLoanPayment,
      };
    });

  // physicalAssetLoans: 할부 또는 담보대출이 있는 실물자산 항목
  physicalAssetLoans = snapshotPhysicalAssets
    .filter((i) => {
      const m = i.metadata || {};
      const hasLoan = m.has_loan as boolean;
      const hasInstallment = m.has_installment as boolean;
      const loanAmount = hasInstallment
        ? (m.installment_remaining as number)
        : (m.loan_amount as number);
      return (hasLoan || hasInstallment) && loanAmount > 0;
    })
    .map((i) => {
      const m = i.metadata || {};
      const hasInstallment = (m.has_installment as boolean) || false;
      const hasLoan = (m.has_loan as boolean) || false;
      const financingType = hasInstallment ? 'installment' : hasLoan ? 'loan' : null;
      const loanAmount = hasInstallment
        ? (m.installment_remaining as number) || 0
        : (m.loan_amount as number) || 0;
      const loanRate = hasInstallment
        ? (m.installment_rate as number) ?? null
        : (m.loan_rate as number) ?? null;
      const loanMaturityYear = hasInstallment
        ? (m.installment_end_year as number) ?? null
        : (m.loan_maturity_year as number) ?? null;
      const loanMaturityMonth = hasInstallment
        ? (m.installment_end_month as number) ?? null
        : (m.loan_maturity_month as number) ?? null;
      const loanRepaymentType = hasInstallment
        ? '원리금균등상환'
        : (m.loan_repayment_type as string) ?? null;
      const loanStartYear = (m.loan_start_year as number) ?? (m.purchase_year as number) ?? null;
      const loanStartMonth = (m.loan_start_month as number) ?? (m.purchase_month as number) ?? null;
      return {
        title: i.title,
        financingType,
        loanAmount,
        loanRate,
        loanRepaymentType,
        monthlyPayment: computeMonthlyLoanPayment(
          loanAmount,
          loanRate,
          loanRepaymentType,
          loanStartYear,
          loanStartMonth,
          loanMaturityYear,
          loanMaturityMonth,
        ),
      };
    });

  // debtExpenses: 잔액이 있는 부채 항목
  debtExpenses = snapshotDebts
    .filter((i) => i.amount > 0)
    .map((i) => {
      const m = i.metadata || {};
      const interestRate = (m.loan_rate as number) ?? (m.interest_rate as number) ?? 0;
      const repaymentType = (m.loan_repayment_type as string) ?? (m.repayment_type as string) ?? '원리금균등상환';
      const startYear = (m.start_year as number) ?? null;
      const startMonth = (m.start_month as number) ?? null;
      const maturityYear = (m.loan_maturity_year as number) ?? (m.maturity_year as number) ?? null;
      const maturityMonth = (m.loan_maturity_month as number) ?? (m.maturity_month as number) ?? null;
      const graceEndYear = (m.grace_period_year as number) ?? null;
      const graceEndMonth = (m.grace_period_month as number) ?? null;
      return {
        title: i.title,
        debtType: i.item_type,
        currentBalance: i.amount,
        interestRate,
        repaymentType,
        monthlyPayment: computeMonthlyLoanPayment(
          i.amount,
          interestRate,
          repaymentType,
          startYear,
          startMonth,
          maturityYear,
          maturityMonth,
          graceEndYear,
          graceEndMonth,
        ),
      };
    });

  // 그룹 구성
  const result: AssetGroup[] = [];

  if (accounts) {
    const bankAccounts = accounts.filter((a) => BANK_TYPES.includes(a.account_type || ""));
    if (bankAccounts.length > 0) {
      result.push({
        key: "bank",
        label: "예적금",
        ...GROUP_META.bank,
        items: bankAccounts.map((a) => ({
          name: a.name,
          amount: getBalance(a.id, a.current_balance, false),
        })),
      });
    }

    const investAccounts = accounts.filter((a) => INVESTMENT_TYPES.includes(a.account_type || ""));
    if (investAccounts.length > 0) {
      result.push({
        key: "investment",
        label: "투자",
        ...GROUP_META.investment,
        items: investAccounts.map((a) => ({
          name: a.name,
          amount: getBalance(a.id, a.current_balance, true),
        })),
      });
    }

    const pensionAccounts = accounts.filter((a) => PENSION_TYPES.includes(a.account_type || ""));
    if (pensionAccounts.length > 0) {
      result.push({
        key: "pension",
        label: "연금",
        ...GROUP_META.pension,
        items: pensionAccounts.map((a) => ({
          name: a.name,
          amount: getBalance(a.id, a.current_balance, true),
        })),
      });
    }

    const retirementAccounts = accounts.filter((a) => RETIREMENT_TYPES.includes(a.account_type || ""));
    if (retirementAccounts.length > 0) {
      result.push({
        key: "retirement",
        label: "퇴직연금",
        ...GROUP_META.retirement,
        items: retirementAccounts.map((a) => ({
          name: a.name,
          amount: getBalance(a.id, a.current_balance, true),
        })),
      });
    }
  }

  if (snapshotRealEstates.length > 0) {
    result.push({
      key: "realEstate",
      label: "부동산",
      ...GROUP_META.realEstate,
      items: snapshotRealEstates.map((i) => ({ name: i.title, amount: i.amount })),
    });
  }

  if (snapshotPhysicalAssets.length > 0) {
    result.push({
      key: "physical",
      label: "실물자산",
      ...GROUP_META.physical,
      items: snapshotPhysicalAssets.map((i) => ({ name: i.title, amount: i.amount })),
    });
  }

  if (snapshotDebts.length > 0) {
    result.push({
      key: "debt",
      label: "부채",
      ...GROUP_META.debt,
      items: snapshotDebts.map((i) => ({ name: i.title, amount: i.amount })),
    });
  }

  return { groups: result, housingExpenses, physicalAssetLoans, debtExpenses };
}

export function StepAssetReview({ profileId, cachedGroups }: StepAssetReviewProps) {
  const [groups, setGroups] = useState<AssetGroup[]>(cachedGroups ?? []);
  const [loading, setLoading] = useState(!cachedGroups);
  const [activeTab, setActiveTab] = useState<string | null>(
    cachedGroups && cachedGroups.length > 0 ? cachedGroups[0].key : null
  );

  useEffect(() => {
    if (cachedGroups) return;

    loadAssetGroups(profileId)
      .then(({ groups: result }) => {
        setGroups(result);
        if (result.length > 0) setActiveTab(result[0].key);
      })
      .catch((err) => {
        console.error("[StepAssetReview] Failed to load assets:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [profileId, cachedGroups]);

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.emptyText}>자산 데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.emptyText}>복사할 자산 데이터가 없습니다</div>
      </div>
    );
  }

  const activeGroup = groups.find((g) => g.key === activeTab) ?? groups[0];
  const groupTotal = activeGroup.items.reduce((sum, i) => sum + i.amount, 0);
  const isDebt = activeGroup.key === "debt";

  return (
    <div className={styles.root}>
      <div className={styles.description}>
        현재 등록된 자산이 새 시뮬레이션에 자동으로 복사됩니다.
      </div>

      <div className={styles.tabBar}>
        {groups.map((group) => {
          const isActive = group.key === activeTab;
          return (
            <button
              key={group.key}
              type="button"
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(group.key)}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      <div className={styles.list}>
        {activeGroup.items.map((item, idx) => {
          const Icon = activeGroup.icon;
          const color = activeGroup.color;
          return (
            <div key={idx} className={styles.itemRow}>
              <div className={styles.iconBtn} style={{ background: `${color}18` }}>
                <Icon size={15} style={{ color }} />
              </div>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemMeta}>
                  {activeGroup.label} · {formatMoney(Math.round(item.amount / 10000))}
                </span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemAmount}>
                  {formatMoney(Math.round(item.amount / 10000))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>{activeGroup.label} 합계</span>
        <span className={`${styles.totalAmount} ${isDebt ? styles.totalDebt : ""}`}>
          {formatMoney(Math.round(groupTotal / 10000))}
        </span>
      </div>
    </div>
  );
}
