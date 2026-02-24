"use client";

import { useState, useEffect } from "react";
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
  label: string;
  items: { name: string; amount: number }[];
}

// accounts 테이블 account_type 분류 (simulationService.ts와 동일)
const BANK_TYPES = ["checking", "savings", "deposit", "free_savings", "housing"];
const INVESTMENT_TYPES = ["general"];
const PENSION_TYPES = ["pension_savings", "irp", "isa"];
const RETIREMENT_TYPES = ["dc"];

export function StepAssetReview({ profileId }: StepAssetReviewProps) {
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadAssets() {
      try {
        // 1. 병렬로 모든 데이터 조회
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

        // 2. 실시간 시세로 투자 계좌 평가금액 계산 (CurrentAssetTab과 동일)
        const priceCache = await fetchPortfolioPrices(portfolioTransactions);
        const investmentValues = calculatePortfolioAccountValues(
          portfolioTransactions,
          priceCache,
          accounts?.map((a) => ({ id: a.id, additional_amount: a.additional_amount })),
          customHoldingsRes.data || []
        );

        // 3. 저축 계좌 잔액 계산 (가계부 반영 + 이자 포함)
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

        // 잔액 조회 헬퍼
        const getBalance = (accountId: string, currentBalance: number | null, isInvestment: boolean): number => {
          if (isInvestment && investmentValues.has(accountId)) {
            return investmentValues.get(accountId)!;
          }
          if (!isInvestment && savingsValues.has(accountId)) {
            return savingsValues.get(accountId)!;
          }
          return currentBalance || 0;
        };

        // 2. 기본 시뮬레이션에서 부채/부동산/실물자산 조회 (copySimulationData 소스)
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

        // 3. 기본 시뮬레이션에 없는 항목은 스냅샷 폴백 (copyMissingDataFromSnapshot)
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

        // 4. 그룹 구성
        const result: AssetGroup[] = [];

        if (accounts) {
          // 예적금
          const bankAccounts = accounts.filter((a) => BANK_TYPES.includes(a.account_type || ""));
          if (bankAccounts.length > 0) {
            result.push({
              label: "예적금",
              items: bankAccounts.map((a) => ({
                name: a.name,
                amount: getBalance(a.id, a.current_balance, false),
              })),
            });
          }

          // 투자
          const investAccounts = accounts.filter((a) => INVESTMENT_TYPES.includes(a.account_type || ""));
          if (investAccounts.length > 0) {
            result.push({
              label: "투자",
              items: investAccounts.map((a) => ({
                name: a.name,
                amount: getBalance(a.id, a.current_balance, true),
              })),
            });
          }

          // 연금
          const pensionAccounts = accounts.filter((a) => PENSION_TYPES.includes(a.account_type || ""));
          if (pensionAccounts.length > 0) {
            result.push({
              label: "연금",
              items: pensionAccounts.map((a) => ({
                name: a.name,
                amount: getBalance(a.id, a.current_balance, true),
              })),
            });
          }

          // 퇴직연금
          const retirementAccounts = accounts.filter((a) => RETIREMENT_TYPES.includes(a.account_type || ""));
          if (retirementAccounts.length > 0) {
            result.push({
              label: "퇴직연금",
              items: retirementAccounts.map((a) => ({
                name: a.name,
                amount: getBalance(a.id, a.current_balance, true),
              })),
            });
          }
        }

        // 부동산
        if (realEstates.length > 0) {
          result.push({
            label: "부동산",
            items: realEstates.map((i) => ({ name: i.title, amount: i.current_value ?? 0 })),
          });
        }

        // 실물자산
        if (physicalAssets.length > 0) {
          result.push({
            label: "실물자산",
            items: physicalAssets.map((i) => ({ name: i.title, amount: i.current_value ?? 0 })),
          });
        }

        // 부채
        if (debts.length > 0) {
          result.push({
            label: "부채",
            items: debts.map((i) => ({ name: i.title, amount: i.current_balance ?? 0 })),
          });
        }

        setGroups(result);
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
        <div className={styles.description}>자산 데이터를 불러오는 중...</div>
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

  return (
    <div className={styles.root}>
      <div className={styles.description}>
        현재 등록된 자산이 새 시뮬레이션에 자동으로 복사됩니다.
      </div>
      {groups.map((group) => (
        <div key={group.label} className={styles.groupSection}>
          <div className={styles.groupLabel}>{group.label}</div>
          {group.items.map((item, idx) => (
            <div key={idx} className={styles.itemRow}>
              <span className={styles.itemName}>{item.name}</span>
              <span className={styles.itemAmount}>
                {formatMoney(Math.round(item.amount / 10000))}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
