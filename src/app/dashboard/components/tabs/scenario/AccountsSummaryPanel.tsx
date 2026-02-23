"use client";

import {
  PiggyBank,
  TrendingUp,
  Shield,
  Briefcase,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { formatWon } from "@/lib/utils";
import type { CustomHolding } from "@/types/tables";
import { simulationService } from "@/lib/services/simulationService";
import { createClient } from "@/lib/supabase/client";
import {
  usePortfolioTransactions,
  usePortfolioChartPriceData,
} from "@/hooks/useFinancialData";
import {
  calculatePortfolioAccountValues,
  calculateAccountTransactionSummary,
  calculateExpectedBalance,
} from "@/lib/utils/accountValueCalculator";
import { BrokerLogo } from "../shared/BrokerLogo";
import styles from "./AccountsSummaryPanel.module.css";

const PENSION_TYPE_LABELS: Record<string, string> = {
  pension_savings: "연금저축",
  irp: "IRP",
  isa: "ISA",
};

const RETIREMENT_PENSION_TYPE_LABELS: Record<string, string> = {
  dc: "DC형 퇴직연금",
  db: "DB형 퇴직연금",
};

interface AccountsSummaryPanelProps {
  simulationId: string;
  profileId: string;
  isMarried?: boolean;
  isInitializing?: boolean;
  isSyncingPrices?: boolean;
}

// 저축 계좌 타입
const SAVINGS_TYPES = ["checking", "savings", "deposit", "housing"];
// 투자 계좌 타입
const INVESTMENT_TYPES = [
  "domestic_stock",
  "foreign_stock",
  "fund",
  "bond",
  "crypto",
  "other",
];

// 계좌 타입 라벨
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "입출금통장",
  savings: "적금",
  deposit: "예금",
  housing: "주택청약",
  domestic_stock: "증권계좌",
  foreign_stock: "해외주식",
  fund: "펀드",
  bond: "채권",
  crypto: "암호화폐",
  other: "기타",
};

// Raw 원 단위 데이터 타입
interface RawAccountData {
  id: string;
  type: string;
  title: string;
  owner: string;
  current_balance: number; // 원 단위
  broker_name: string | null;
}

interface RawPensionData {
  id: string;
  pension_type: string;
  title: string | null;
  current_balance: number | null; // 원 단위
  broker_name: string | null;
}

export function AccountsSummaryPanel({
  simulationId,
  profileId,
  isMarried = false,
  isInitializing = false,
  isSyncingPrices = false,
}: AccountsSummaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 초기화 중이면 로딩 상태 유지
  const showLoading = isLoading || isInitializing;
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // 원 단위 raw 데이터 상태
  const [savingsAccounts, setSavingsAccounts] = useState<RawAccountData[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<
    RawAccountData[]
  >([]);
  const [personalPensions, setPersonalPensions] = useState<RawPensionData[]>(
    [],
  );
  const [retirementPensions, setRetirementPensions] = useState<
    RawPensionData[]
  >([]);
  const [customHoldings, setCustomHoldings] = useState<CustomHolding[]>([]);

  const supabase = createClient();

  // 포트폴리오 거래 내역 및 가격 데이터 (캐시됨)
  const { data: portfolioTransactions = [] } =
    usePortfolioTransactions(profileId);
  const { data: priceCache, refetch: refetchPrices } =
    usePortfolioChartPriceData(
      profileId,
      portfolioTransactions,
      portfolioTransactions.length > 0,
    );

  // 원 단위 데이터 직접 로드
  const loadRawData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [savingsRes, personalRes, retirementRes, simulationRes, customHoldingsRes] =
        await Promise.all([
          supabase
            .from("savings")
            .select("id, type, title, owner, current_balance, broker_name")
            .eq("simulation_id", simulationId)
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabase
            .from("personal_pensions")
            .select("id, pension_type, title, current_balance, broker_name")
            .eq("simulation_id", simulationId)
            .eq("is_active", true),
          supabase
            .from("retirement_pensions")
            .select("id, pension_type, title, current_balance, broker_name")
            .eq("simulation_id", simulationId)
            .eq("is_active", true),
          supabase
            .from("simulations")
            .select("last_synced_at")
            .eq("id", simulationId)
            .single(),
          supabase
            .from("custom_holdings")
            .select("*")
            .eq("profile_id", profileId),
        ]);

      const allSavings = (savingsRes.data || []) as RawAccountData[];
      setSavingsAccounts(
        allSavings.filter((s) => SAVINGS_TYPES.includes(s.type)),
      );
      setInvestmentAccounts(
        allSavings.filter((s) => INVESTMENT_TYPES.includes(s.type)),
      );
      setPersonalPensions((personalRes.data || []) as RawPensionData[]);
      setRetirementPensions((retirementRes.data || []) as RawPensionData[]);
      setCustomHoldings((customHoldingsRes.data || []) as CustomHolding[]);
      if (simulationRes.data?.last_synced_at) {
        setLastSyncedAt(new Date(simulationRes.data.last_synced_at));
      }
    } finally {
      setIsLoading(false);
    }
  }, [simulationId, profileId, supabase]);

  useEffect(() => {
    loadRawData();
  }, [loadRawData]);

  // 가격 동기화 완료 시 데이터 새로고침
  const prevSyncingPricesRef = useRef(isSyncingPrices);
  useEffect(() => {
    if (prevSyncingPricesRef.current && !isSyncingPrices) {
      loadRawData();
    }
    prevSyncingPricesRef.current = isSyncingPrices;
  }, [isSyncingPrices, loadRawData]);

  // 합계 계산 (원 단위)
  const totalAssets =
    savingsAccounts.reduce((sum, acc) => sum + acc.current_balance, 0) +
    investmentAccounts.reduce((sum, acc) => sum + acc.current_balance, 0) +
    personalPensions.reduce((sum, p) => sum + (p.current_balance || 0), 0) +
    retirementPensions.reduce((sum, p) => sum + (p.current_balance || 0), 0);
  const totalCount =
    savingsAccounts.length +
    investmentAccounts.length +
    personalPensions.length +
    retirementPensions.length;

  // 현재 자산 동기화
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // 1. 가격 데이터 새로고침 후 결과 직접 사용
      const priceResult = await refetchPrices();
      const freshPriceCache = priceResult.data;

      // 2. 저축 계좌 잔액 계산 (가계부 반영)
      const savingsAccountBalances = new Map<string, number>();
      const { data: checkingAccounts } = await supabase
        .from("accounts")
        .select("id, current_balance")
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .in("account_type", [
          "checking",
          "savings",
          "deposit",
          "free_savings",
          "housing",
        ]);

      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const { data: budgetTx } = await supabase
        .from("budget_transactions")
        .select("account_id, type, amount")
        .eq("profile_id", profileId)
        .eq("year", currentYear)
        .eq("month", currentMonth);

      // 유틸리티 함수 사용
      const txSummary = calculateAccountTransactionSummary(budgetTx || []);

      checkingAccounts?.forEach((acc) => {
        const expectedBalance = calculateExpectedBalance(
          acc.current_balance || 0,
          txSummary[acc.id],
        );
        savingsAccountBalances.set(acc.id, Math.round(expectedBalance));
      });

      // 3. 투자 계좌 평가액 계산 (유틸리티 함수 사용)
      const investmentAccountValues = calculatePortfolioAccountValues(
        portfolioTransactions,
        freshPriceCache,
        undefined,
        customHoldings || []
      );

      // 4. 시뮬레이션에 복사
      await simulationService.copyAccountsToSimulation(
        simulationId,
        profileId,
        investmentAccountValues,
        savingsAccountBalances,
      );
      // 동기화 시간 저장
      const now = new Date();
      await supabase
        .from("simulations")
        .update({ last_synced_at: now.toISOString() })
        .eq("id", simulationId);
      setLastSyncedAt(now);
      await loadRawData();
    } catch (error) {
      console.error("Failed to sync accounts:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (showLoading) {
    return (
      <div className={styles.panel}>
        <div className={styles.skeletonHeader}>
          <div className={styles.skeletonHeaderLeft}>
            <div className={`${styles.skeleton} ${styles.skeletonIcon}`} />
            <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
            <div className={`${styles.skeleton} ${styles.skeletonCount}`} />
          </div>
          <div className={`${styles.skeleton} ${styles.skeletonAmount}`} />
        </div>
        <div className={styles.loading}>
          <div className={styles.skeletonGroup}>
            <div className={styles.skeletonGroupHeader}>
              <div
                className={`${styles.skeleton} ${styles.skeletonGroupIcon}`}
              />
              <div
                className={`${styles.skeleton} ${styles.skeletonGroupLabel}`}
              />
              <div
                className={`${styles.skeleton} ${styles.skeletonGroupTotal}`}
              />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className={styles.skeletonItem}>
                <div className={styles.skeletonItemLeft}>
                  <div
                    className={`${styles.skeleton} ${styles.skeletonItemName}`}
                  />
                </div>
                <div className={styles.skeletonItemRight}>
                  <div
                    className={`${styles.skeleton} ${styles.skeletonItemBalance}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <button
          className={styles.headerToggle}
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          <span className={styles.title}>계좌</span>
          <span className={styles.count}>{totalCount}개</span>
        </button>
        <div className={styles.headerRight}>
          {isSyncingPrices ? (
            <span className={styles.syncingText}>가격 동기화 중...</span>
          ) : lastSyncedAt ? (
            <span className={styles.syncTime}>
              {lastSyncedAt.toLocaleDateString("ko-KR", {
                month: "2-digit",
                day: "2-digit",
              })}{" "}
              {lastSyncedAt.toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              동기화
            </span>
          ) : null}
          <button
            className={styles.syncIconButton}
            onClick={(e) => {
              e.stopPropagation();
              handleSync();
            }}
            disabled={isSyncing || isSyncingPrices}
            type="button"
            title="현재 자산으로 업데이트"
          >
            <RefreshCw
              size={14}
              className={isSyncing || isSyncingPrices ? styles.spinning : ""}
            />
          </button>
          <span className={styles.totalAmount}>{formatWon(totalAssets)}</span>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          {totalCount === 0 ? (
            <div className={styles.emptyState}>
              <p>등록된 계좌가 없습니다.</p>
            </div>
          ) : (
            <div className={styles.accountList}>
              {/* 저축 계좌 */}
              {savingsAccounts.length > 0 && (
                <div className={styles.accountGroup}>
                  <div className={styles.groupHeader}>
                    <PiggyBank size={14} />
                    <span>저축</span>
                  </div>
                  {savingsAccounts.map((account) => (
                    <div key={account.id} className={styles.accountItem}>
                      <div className={styles.accountMain}>
                        <BrokerLogo
                          brokerName={account.broker_name}
                          fallback={account.title || "?"}
                        />
                        <div className={styles.accountInfo}>
                          <span className={styles.accountName}>
                            {account.title}
                            {isMarried && account.owner === "spouse" && (
                              <span className={styles.ownerBadge}>배우자</span>
                            )}
                          </span>
                          <span className={styles.accountType}>
                            {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                          </span>
                        </div>
                      </div>
                      <span className={styles.accountBalance}>
                        {formatWon(account.current_balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 투자 계좌 */}
              {investmentAccounts.length > 0 && (
                <div className={styles.accountGroup}>
                  <div className={styles.groupHeader}>
                    <TrendingUp size={14} />
                    <span>투자</span>
                  </div>
                  {investmentAccounts.map((account) => (
                    <div key={account.id} className={styles.accountItem}>
                      <div className={styles.accountMain}>
                        <BrokerLogo
                          brokerName={account.broker_name}
                          fallback={account.title || "?"}
                        />
                        <div className={styles.accountInfo}>
                          <span className={styles.accountName}>
                            {account.title}
                            {isMarried && account.owner === "spouse" && (
                              <span className={styles.ownerBadge}>배우자</span>
                            )}
                          </span>
                          <span className={styles.accountType}>
                            {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                          </span>
                        </div>
                      </div>
                      <span className={styles.accountBalance}>
                        {formatWon(account.current_balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 절세 계좌 (ISA, 연금저축, IRP) */}
              {personalPensions.length > 0 && (
                <div className={styles.accountGroup}>
                  <div className={styles.groupHeader}>
                    <Shield size={14} />
                    <span>절세계좌</span>
                  </div>
                  {personalPensions.map((pension) => (
                    <div key={pension.id} className={styles.accountItem}>
                      <div className={styles.accountMain}>
                        <BrokerLogo
                          brokerName={pension.broker_name}
                          fallback={pension.title || "?"}
                        />
                        <div className={styles.accountInfo}>
                          <span className={styles.accountName}>
                            {pension.title ||
                              PENSION_TYPE_LABELS[pension.pension_type] ||
                              pension.pension_type}
                          </span>
                          <span className={styles.accountType}>
                            {PENSION_TYPE_LABELS[pension.pension_type] ||
                              pension.pension_type}
                          </span>
                        </div>
                      </div>
                      <span className={styles.accountBalance}>
                        {formatWon(pension.current_balance || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 퇴직연금 (DC형) */}
              {retirementPensions.length > 0 && (
                <div className={styles.accountGroup}>
                  <div className={styles.groupHeader}>
                    <Briefcase size={14} />
                    <span>퇴직연금</span>
                  </div>
                  {retirementPensions.map((pension) => (
                    <div key={pension.id} className={styles.accountItem}>
                      <div className={styles.accountMain}>
                        <BrokerLogo
                          brokerName={pension.broker_name}
                          fallbackIcon={<Briefcase size={12} />}
                        />
                        <div className={styles.accountInfo}>
                          <span className={styles.accountName}>
                            {pension.title ||
                              RETIREMENT_PENSION_TYPE_LABELS[
                                pension.pension_type
                              ] ||
                              pension.pension_type}
                          </span>
                          <span className={styles.accountType}>
                            {RETIREMENT_PENSION_TYPE_LABELS[
                              pension.pension_type
                            ] || pension.pension_type}
                          </span>
                        </div>
                      </div>
                      <span className={styles.accountBalance}>
                        {formatWon(pension.current_balance || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
