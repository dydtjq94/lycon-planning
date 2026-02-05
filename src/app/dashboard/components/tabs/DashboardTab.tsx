"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Building2, Landmark, PiggyBank, TrendingUp, CreditCard, Wallet, Plus } from "lucide-react";
import type { Account } from "@/types/tables";
import styles from "./DashboardTab.module.css";

// 결제수단 타입
interface PaymentMethod {
  id: string;
  profile_id: string;
  account_id: string;
  name: string;
  type: "debit_card" | "credit_card" | "pay";
  card_company: string | null;
  is_active: boolean;
}

// 계좌 유형별 아이콘
const ACCOUNT_TYPE_ICONS: Record<string, React.ReactNode> = {
  general: <TrendingUp size={16} />,
  isa: <TrendingUp size={16} />,
  pension_savings: <Landmark size={16} />,
  irp: <Landmark size={16} />,
  checking: <Building2 size={16} />,
  savings: <PiggyBank size={16} />,
  deposit: <PiggyBank size={16} />,
  free_savings: <PiggyBank size={16} />,
  housing: <PiggyBank size={16} />,
};

// 계좌 유형별 라벨
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  general: "일반",
  isa: "ISA",
  pension_savings: "연금저축",
  irp: "IRP",
  checking: "입출금",
  savings: "적금",
  deposit: "예금",
  free_savings: "자유적금",
  housing: "주택청약",
};

// 계좌 유형별 색상
const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  general: "#10b981",
  isa: "#22c55e",
  pension_savings: "#8b5cf6",
  irp: "#a855f7",
  checking: "#3b82f6",
  savings: "#06b6d4",
  deposit: "#0891b2",
  free_savings: "#14b8a6",
  housing: "#f59e0b",
};

// 계좌 그룹
const INVESTMENT_TYPES = ["general", "isa", "pension_savings", "irp"];
const BANK_TYPES = ["checking", "savings", "deposit", "free_savings", "housing"];

interface DashboardTabProps {
  simulationId: string;
  birthYear: number;
  spouseBirthYear: number | null;
  retirementAge: number | null;
  globalSettings: unknown;
  unreadMessageCount: number;
  onNavigate: (section: string) => void;
  profileId?: string;
}

export function DashboardTab({
  profileId,
  onNavigate,
}: DashboardTabProps) {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);

      const [accountsRes, paymentRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("*")
          .eq("profile_id", profileId)
          .eq("is_active", true)
          .order("account_type")
          .order("is_default", { ascending: false }),
        supabase
          .from("payment_methods")
          .select("*")
          .eq("profile_id", profileId)
          .eq("is_active", true),
      ]);

      if (accountsRes.error) {
        console.error("Failed to load accounts:", accountsRes.error);
      } else {
        setAccounts(accountsRes.data || []);
      }

      if (paymentRes.error) {
        console.error("Failed to load payment methods:", paymentRes.error);
      } else {
        setPaymentMethods(paymentRes.data || []);
      }

      setIsLoading(false);
    };

    loadData();
  }, [profileId, supabase]);

  // 계좌 분류
  const investmentAccounts = accounts.filter(acc => INVESTMENT_TYPES.includes(acc.account_type || ""));
  const bankAccounts = accounts.filter(acc => BANK_TYPES.includes(acc.account_type || ""));

  // 계좌에 연결되지 않은 결제수단
  const unlinkedPayments = paymentMethods.filter(pm => !pm.account_id);

  // 계좌별 연결된 결제수단 찾기
  const getLinkedPayments = (accountId: string) => {
    return paymentMethods.filter(pm => pm.account_id === accountId);
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 증권 계좌 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>증권 계좌</span>
          <span className={styles.sectionCount}>{investmentAccounts.length}개</span>
        </div>

        <div className={styles.accountList}>
          {investmentAccounts.length > 0 ? (
            investmentAccounts.map(account => (
              <div key={account.id} className={styles.accountItem}>
                <div
                  className={styles.accountIcon}
                  style={{ backgroundColor: ACCOUNT_TYPE_COLORS[account.account_type || "general"] }}
                >
                  {ACCOUNT_TYPE_ICONS[account.account_type || "general"]}
                </div>
                <div className={styles.accountInfo}>
                  <span className={styles.accountName}>{account.name}</span>
                  <span className={styles.accountMeta}>
                    {account.broker_name}
                    <span className={styles.accountTypeBadge}>
                      {ACCOUNT_TYPE_LABELS[account.account_type || "general"]}
                    </span>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>등록된 계좌가 없습니다</div>
          )}

          <button
            className={styles.addBtn}
            onClick={() => onNavigate("portfolio")}
          >
            <Plus size={14} />
            추가
          </button>
        </div>
      </div>

      {/* 은행 계좌 + 연결된 카드/페이 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>은행 계좌</span>
          <span className={styles.sectionCount}>{bankAccounts.length}개</span>
        </div>

        <div className={styles.accountList}>
          {bankAccounts.length > 0 ? (
            bankAccounts.map(account => {
              const linkedPayments = getLinkedPayments(account.id);
              return (
                <div key={account.id} className={styles.accountWithPayments}>
                  <div className={styles.accountItem}>
                    <div
                      className={styles.accountIcon}
                      style={{ backgroundColor: ACCOUNT_TYPE_COLORS[account.account_type || "checking"] }}
                    >
                      {ACCOUNT_TYPE_ICONS[account.account_type || "checking"]}
                    </div>
                    <div className={styles.accountInfo}>
                      <span className={styles.accountName}>{account.name}</span>
                      <span className={styles.accountMeta}>
                        {account.broker_name}
                        <span className={styles.accountTypeBadge}>
                          {ACCOUNT_TYPE_LABELS[account.account_type || "checking"]}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* 연결된 카드/페이 */}
                  {linkedPayments.length > 0 && (
                    <div className={styles.linkedPayments}>
                      {linkedPayments.map(pm => (
                        <div key={pm.id} className={styles.linkedPaymentItem}>
                          <div className={styles.linkedLine} />
                          <div
                            className={styles.paymentIcon}
                            style={{ backgroundColor: pm.type === "pay" ? "#f59e0b" : "#6366f1" }}
                          >
                            {pm.type === "pay" ? <Wallet size={12} /> : <CreditCard size={12} />}
                          </div>
                          <span className={styles.paymentName}>{pm.name}</span>
                          {pm.type !== "pay" && (
                            <span className={styles.paymentTypeBadge}>
                              {pm.type === "credit_card" ? "신용" : "체크"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className={styles.emptyState}>등록된 계좌가 없습니다</div>
          )}

          <button
            className={styles.addBtn}
            onClick={() => onNavigate("savings-deposits")}
          >
            <Plus size={14} />
            추가
          </button>
        </div>
      </div>

      {/* 연결되지 않은 카드/페이 */}
      {unlinkedPayments.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>미연결 카드/페이</span>
            <span className={styles.sectionCount}>{unlinkedPayments.length}개</span>
          </div>

          <div className={styles.accountList}>
            {unlinkedPayments.map(pm => (
              <div key={pm.id} className={styles.accountItem}>
                <div
                  className={styles.paymentIconLarge}
                  style={{ backgroundColor: pm.type === "pay" ? "#f59e0b" : "#6366f1" }}
                >
                  {pm.type === "pay" ? <Wallet size={16} /> : <CreditCard size={16} />}
                </div>
                <div className={styles.accountInfo}>
                  <span className={styles.accountName}>{pm.name}</span>
                  <span className={styles.accountMeta}>
                    {pm.card_company || ""}
                    <span className={styles.paymentTypeBadge}>
                      {pm.type === "pay" ? "페이" : pm.type === "credit_card" ? "신용" : "체크"}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
