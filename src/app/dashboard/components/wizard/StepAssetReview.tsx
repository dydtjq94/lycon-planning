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
import type { StepProps } from "./types";
import { formatMoney } from "@/lib/utils";
import styles from "./StepAssetReview.module.css";

interface StepAssetReviewProps extends StepProps {
  profileId: string;
}

interface AssetGroup {
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

export function StepAssetReview({ profileId }: StepAssetReviewProps) {
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadAssets() {
      try {
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

        const { data: defaultSim } = await supabase
          .from("simulations")
          .select("id")
          .eq("profile_id", profileId)
          .eq("is_default", true)
          .single();

        type SimItem = { title: string; current_balance?: number | null; current_value?: number | null };
        let debts: SimItem[] = [];
        let realEstates: SimItem[] = [];
        let physicalAssets: SimItem[] = [];

        if (defaultSim) {
          const [debtsRes, reRes, paRes] = await Promise.all([
            supabase.from("debts").select("title, current_balance").eq("simulation_id", defaultSim.id),
            supabase.from("real_estates").select("title, current_value").eq("simulation_id", defaultSim.id),
            supabase.from("physical_assets").select("title, current_value").eq("simulation_id", defaultSim.id),
          ]);
          debts = debtsRes.data || [];
          realEstates = reRes.data || [];
          physicalAssets = paRes.data || [];
        }

        if (!debts.length || !realEstates.length || !physicalAssets.length) {
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
              .select("category, item_type, title, amount")
              .eq("snapshot_id", snapshots[0].id)
              .order("sort_order", { ascending: true });

            if (items) {
              if (!debts.length) {
                debts = items
                  .filter((i) => i.category === "debt")
                  .map((i) => ({ title: i.title, current_balance: i.amount }));
              }
              if (!realEstates.length) {
                const RE_TYPES = ["real_estate", "residence", "land", "apartment", "house", "officetel", "commercial"];
                realEstates = items
                  .filter((i) => i.category === "asset" && RE_TYPES.includes(i.item_type))
                  .map((i) => ({ title: i.title, current_value: i.amount }));
              }
              if (!physicalAssets.length) {
                const PA_TYPES = ["car", "precious_metal", "art", "other_asset"];
                physicalAssets = items
                  .filter((i) => i.category === "asset" && PA_TYPES.includes(i.item_type))
                  .map((i) => ({ title: i.title, current_value: i.amount }));
              }
            }
          }
        }

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

        if (realEstates.length > 0) {
          result.push({
            key: "realEstate",
            label: "부동산",
            ...GROUP_META.realEstate,
            items: realEstates.map((i) => ({ name: i.title, amount: i.current_value ?? 0 })),
          });
        }

        if (physicalAssets.length > 0) {
          result.push({
            key: "physical",
            label: "실물자산",
            ...GROUP_META.physical,
            items: physicalAssets.map((i) => ({ name: i.title, amount: i.current_value ?? 0 })),
          });
        }

        if (debts.length > 0) {
          result.push({
            key: "debt",
            label: "부채",
            ...GROUP_META.debt,
            items: debts.map((i) => ({ name: i.title, amount: i.current_balance ?? 0 })),
          });
        }

        setGroups(result);
        if (result.length > 0) setActiveTab(result[0].key);
      } catch (err) {
        console.error("[StepAssetReview] Failed to load assets:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAssets();
  }, [profileId]);

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
