"use client";

import { PiggyBank, TrendingUp, Shield, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { Savings } from "@/types/tables";
import { formatMoney } from "@/lib/utils";
import { useSavingsData, usePersonalPensions } from "@/hooks/useFinancialData";
import { simulationService } from "@/lib/services/simulationService";
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
  const totalAssets = savingsTotal + investmentTotal + pensionTotal;
  const totalCount = allSavings.length + personalPensions.length;

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
      await simulationService.copyAccountsToSimulation(simulationId, profileId);
      await Promise.all([refetch(), refetchPensions()]);
    } catch (error) {
      console.error("Failed to sync accounts:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading || pensionsLoading) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <PiggyBank size={20} />
            <span className={styles.title}>계좌</span>
          </div>
        </div>
        <div className={styles.loading}>불러오는 중...</div>
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
          <PiggyBank size={20} />
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
