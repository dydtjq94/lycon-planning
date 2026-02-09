"use client";

import { PiggyBank, TrendingUp, Shield, Briefcase, ChevronDown, ChevronUp, RefreshCw, Building2 } from "lucide-react";
import { useState, useMemo } from "react";
import type { Savings } from "@/types/tables";
import { formatMoney } from "@/lib/utils";
import { useSavingsData, usePersonalPensions, useRetirementPensions, usePortfolioTransactions } from "@/hooks/useFinancialData";
import { simulationService } from "@/lib/services/simulationService";
import { createClient } from "@/lib/supabase/client";
import {
  SAVINGS_TYPE_LABELS,
  INVESTMENT_TYPE_LABELS,
  type UISavingsType,
  type UIInvestmentType,
} from "@/lib/services/savingsService";
import styles from "./AccountsSummaryPanel.module.css";

const PENSION_TYPE_LABELS: Record<string, string> = {
  pension_savings: '연금저축',
  irp: 'IRP',
  isa: 'ISA',
};

const RETIREMENT_PENSION_TYPE_LABELS: Record<string, string> = {
  dc: 'DC형 퇴직연금',
  db: 'DB형 퇴직연금',
};

interface AccountsSummaryPanelProps {
  simulationId: string;
  profileId: string;
  isMarried?: boolean;
}

// 저축 계좌 타입
const SAVINGS_TYPES = ["checking", "savings", "deposit", "housing"];
// 투자 계좌 타입 (절세계좌 제외 - personal_pensions에서 별도 관리)
const INVESTMENT_TYPES = ["domestic_stock", "foreign_stock", "fund", "bond", "crypto", "other"];

export function AccountsSummaryPanel({
  simulationId,
  profileId,
  isMarried = false,
}: AccountsSummaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { data: allSavings = [], isLoading, refetch } = useSavingsData(simulationId);
  const { data: personalPensions = [], isLoading: pensionsLoading, refetch: refetchPensions } = usePersonalPensions(simulationId);
  const { data: retirementPensions = [], isLoading: retirementLoading, refetch: refetchRetirement } = useRetirementPensions(simulationId);
  const { data: portfolioTransactions = [] } = usePortfolioTransactions(profileId);

  // 포트폴리오 거래에서 계좌별 순 투자금액 계산
  const portfolioAccountValues = useMemo(() => {
    const values = new Map<string, number>();
    portfolioTransactions.forEach((tx) => {
      if (!tx.account_id) return;
      const amount = tx.type === 'buy' ? tx.total_amount : -tx.total_amount;
      values.set(tx.account_id, (values.get(tx.account_id) || 0) + amount);
    });
    // 음수 값은 0으로 처리 (전량 매도한 경우)
    values.forEach((val, key) => {
      if (val < 0) values.set(key, 0);
    });
    return values;
  }, [portfolioTransactions]);

  // 저축 계좌와 투자 계좌 분리
  const savingsAccounts = allSavings.filter((s) =>
    SAVINGS_TYPES.includes(s.type)
  );
  const investmentAccounts = allSavings.filter((s) =>
    INVESTMENT_TYPES.includes(s.type)
  );

  // 합계 계산
  const savingsTotal = savingsAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);
  const investmentTotal = investmentAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);
  const pensionTotal = personalPensions.reduce((sum, p) => sum + (p.current_balance || 0), 0);
  const retirementTotal = retirementPensions.reduce((sum, p) => sum + (p.current_balance || 0), 0);
  const totalAssets = savingsTotal + investmentTotal + pensionTotal + retirementTotal;
  const totalCount = allSavings.length + personalPensions.length + retirementPensions.length;

  const getTypeLabel = (account: Savings) => {
    if (SAVINGS_TYPES.includes(account.type)) {
      return SAVINGS_TYPE_LABELS[account.type as UISavingsType];
    }
    return INVESTMENT_TYPE_LABELS[account.type as UIInvestmentType];
  };

  const getRate = (account: Savings) => {
    if (account.interest_rate) return `${account.interest_rate}%`;
    if (account.expected_return) return `${account.expected_return}%`;
    return "-";
  };

  // 이미 만원 단위로 변환되어 있음 (getSavings에서 convertArrayFromWon 적용됨)

  // 현재 자산 동기화
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // 포트폴리오 거래 기반 계좌별 투자금액을 전달
      await simulationService.copyAccountsToSimulation(simulationId, profileId, portfolioAccountValues);
      await Promise.all([refetch(), refetchPensions(), refetchRetirement()]);
    } catch (error) {
      console.error("Failed to sync accounts:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading || pensionsLoading || retirementLoading) {
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
          {/* 저축 그룹 스켈레톤 */}
          <div className={styles.skeletonGroup}>
            <div className={styles.skeletonGroupHeader}>
              <div className={`${styles.skeleton} ${styles.skeletonGroupIcon}`} />
              <div className={`${styles.skeleton} ${styles.skeletonGroupLabel}`} />
              <div className={`${styles.skeleton} ${styles.skeletonGroupTotal}`} />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className={styles.skeletonItem}>
                <div className={styles.skeletonItemLeft}>
                  <div className={`${styles.skeleton} ${styles.skeletonItemName}`} />
                  <div className={`${styles.skeleton} ${styles.skeletonItemType}`} />
                </div>
                <div className={styles.skeletonItemRight}>
                  <div className={`${styles.skeleton} ${styles.skeletonItemRate}`} />
                  <div className={`${styles.skeleton} ${styles.skeletonItemBalance}`} />
                </div>
              </div>
            ))}
          </div>
          {/* 투자 그룹 스켈레톤 */}
          <div className={styles.skeletonGroup}>
            <div className={styles.skeletonGroupHeader}>
              <div className={`${styles.skeleton} ${styles.skeletonGroupIcon}`} />
              <div className={`${styles.skeleton} ${styles.skeletonGroupLabel}`} />
              <div className={`${styles.skeleton} ${styles.skeletonGroupTotal}`} />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className={styles.skeletonItem}>
                <div className={styles.skeletonItemLeft}>
                  <div className={`${styles.skeleton} ${styles.skeletonItemName}`} />
                  <div className={`${styles.skeleton} ${styles.skeletonItemType}`} />
                </div>
                <div className={styles.skeletonItemRight}>
                  <div className={`${styles.skeleton} ${styles.skeletonItemRate}`} />
                  <div className={`${styles.skeleton} ${styles.skeletonItemBalance}`} />
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
      <button
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className={styles.headerLeft}>
          <Building2 size={20} />
          <span className={styles.title}>계좌</span>
          <span className={styles.count}>{totalCount}개</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.totalAmount}>{formatMoney(totalAssets)}</span>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {isExpanded && (
        <div className={styles.content}>
          <p className={styles.description}>
            시뮬레이션 생성 시점의 계좌 스냅샷입니다. 모든 계좌는 하나의 현금 풀로 통합되어 계산됩니다.
          </p>

          {totalCount === 0 ? (
            <div className={styles.emptyState}>
              <p>등록된 계좌가 없습니다.</p>
              <button
                className={styles.syncButton}
                onClick={handleSync}
                disabled={isSyncing}
                type="button"
              >
                <RefreshCw size={16} className={isSyncing ? styles.spinning : ""} />
                {isSyncing ? "동기화 중..." : "현재 자산에서 동기화"}
              </button>
            </div>
          ) : (
            <div className={styles.accountList}>
              {/* 저축 계좌 */}
              {savingsAccounts.length > 0 && (
                <div className={styles.accountGroup}>
                  <div className={styles.groupHeader}>
                    <PiggyBank size={16} />
                    <span>저축</span>
                    <span className={styles.groupTotal}>{formatMoney(savingsTotal)}</span>
                  </div>
                  {savingsAccounts.map((account) => (
                    <div key={account.id} className={styles.accountItem}>
                      <div className={styles.accountMain}>
                        <span className={styles.accountName}>
                          {account.title}
                          {isMarried && account.owner === "spouse" && (
                            <span className={styles.ownerBadge}>배우자</span>
                          )}
                        </span>
                        <span className={styles.accountType}>{getTypeLabel(account)}</span>
                      </div>
                      <div className={styles.accountMeta}>
                        <span className={styles.accountRate}>{getRate(account)}</span>
                        <span className={styles.accountBalance}>{formatMoney(account.current_balance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 투자 계좌 */}
              {investmentAccounts.length > 0 && (
                <div className={styles.accountGroup}>
                  <div className={styles.groupHeader}>
                    <TrendingUp size={16} />
                    <span>투자</span>
                    <span className={styles.groupTotal}>{formatMoney(investmentTotal)}</span>
                  </div>
                  {investmentAccounts.map((account) => (
                    <div key={account.id} className={styles.accountItem}>
                      <div className={styles.accountMain}>
                        <span className={styles.accountName}>
                          {account.title}
                          {isMarried && account.owner === "spouse" && (
                            <span className={styles.ownerBadge}>배우자</span>
                          )}
                        </span>
                        <span className={styles.accountType}>{getTypeLabel(account)}</span>
                      </div>
                      <div className={styles.accountMeta}>
                        <span className={styles.accountRate}>{getRate(account)}</span>
                        <span className={styles.accountBalance}>{formatMoney(account.current_balance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 절세 계좌 (ISA, 연금저축, IRP) */}
              {personalPensions.length > 0 && (
                <div className={styles.accountGroup}>
                  <div className={styles.groupHeader}>
                    <Shield size={16} />
                    <span>절세계좌</span>
                    <span className={styles.groupTotal}>{formatMoney(pensionTotal)}</span>
                  </div>
                  {personalPensions.map((pension) => (
                    <div key={pension.id} className={styles.accountItem}>
                      <div className={styles.accountMain}>
                        <span className={styles.accountName}>
                          {pension.title || PENSION_TYPE_LABELS[pension.pension_type] || pension.pension_type}
                          {pension.broker_name && (
                            <span className={styles.brokerBadge}>{pension.broker_name}</span>
                          )}
                        </span>
                        <span className={styles.accountType}>
                          {PENSION_TYPE_LABELS[pension.pension_type] || pension.pension_type}
                        </span>
                      </div>
                      <div className={styles.accountMeta}>
                        <span className={styles.accountRate}>-</span>
                        <span className={styles.accountBalance}>{formatMoney(pension.current_balance || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 퇴직연금 (DC형) */}
              {retirementPensions.length > 0 && (
                <div className={styles.accountGroup}>
                  <div className={styles.groupHeader}>
                    <Briefcase size={16} />
                    <span>퇴직연금</span>
                    <span className={styles.groupTotal}>{formatMoney(retirementTotal)}</span>
                  </div>
                  {retirementPensions.map((pension) => (
                    <div key={pension.id} className={styles.accountItem}>
                      <div className={styles.accountMain}>
                        <span className={styles.accountName}>
                          {RETIREMENT_PENSION_TYPE_LABELS[pension.pension_type] || pension.pension_type}
                        </span>
                        <span className={styles.accountType}>
                          {pension.receive_type === 'annuity' ? '연금 수령' : '일시금 수령'}
                        </span>
                      </div>
                      <div className={styles.accountMeta}>
                        <span className={styles.accountRate}>{pension.return_rate}%</span>
                        <span className={styles.accountBalance}>{formatMoney(pension.current_balance || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 재동기화 버튼 */}
              <button
                className={styles.resyncButton}
                onClick={handleSync}
                disabled={isSyncing}
                type="button"
              >
                <RefreshCw size={14} className={isSyncing ? styles.spinning : ""} />
                {isSyncing ? "동기화 중..." : "현재 자산으로 업데이트"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
