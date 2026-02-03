"use client";

import { useState, useMemo, useEffect, Fragment, useRef } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Edit2, Trash2, Check } from "lucide-react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { createClient } from "@/lib/supabase/client";

ChartJS.register(ArcElement, Tooltip, Legend);
import {
  useBudgetCategories,
  useBudgetTransactions,
  useMonthlySummary,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from "@/hooks/useBudget";
import type { BudgetTransaction, TransactionType } from "@/lib/services/budgetService";
import type { Account, AccountType, AccountInput, PaymentMethod, PaymentMethodType, PaymentMethodInput } from "@/types/tables";
import { formatWon } from "@/lib/utils";
import styles from "./BudgetTab.module.css";

interface BudgetTabProps {
  profileId: string;
  year: number;
  month: number;
}

// 은행 목록
const BANK_OPTIONS = [
  "국민은행",
  "신한은행",
  "하나은행",
  "우리은행",
  "NH농협은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "기업은행",
  "SC제일은행",
  "기타",
];

// 은행 계좌 유형
const BANK_ACCOUNT_TYPE_OPTIONS = [
  { value: "checking", label: "입출금" },
  { value: "savings", label: "적금" },
  { value: "deposit", label: "정기예금" },
] as const;

// 기본 카테고리 목록 (DB에서 가져오기 전 폴백)
const DEFAULT_EXPENSE_CATEGORIES = [
  "식비", "주거", "교통", "통신", "의료", "문화", "교육", "의류", "경조사", "기타"
];
const DEFAULT_INCOME_CATEGORIES = ["급여", "부수입", "이자/배당", "기타"];

// 결제수단 유형
const PAYMENT_METHOD_TYPE_OPTIONS = [
  { value: "debit_card", label: "체크카드" },
  { value: "credit_card", label: "신용카드" },
  { value: "pay", label: "페이" },
] as const;

// 카드사 목록
const CARD_COMPANY_OPTIONS = [
  "신한카드",
  "삼성카드",
  "KB국민카드",
  "현대카드",
  "롯데카드",
  "우리카드",
  "하나카드",
  "NH농협카드",
  "BC카드",
  "카카오페이",
  "네이버페이",
  "토스페이",
  "삼성페이",
  "애플페이",
  "기타",
];

export function BudgetTab({ profileId, year: selectedYear, month: selectedMonth }: BudgetTabProps) {
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<TransactionType>("expense");

  // 인라인 입력 상태
  const [incomeInput, setIncomeInput] = useState({ day: "", amount: "", title: "", category: "", accountId: "" });
  const [expenseInput, setExpenseInput] = useState({ day: "", amount: "", title: "", category: "", paymentSource: "" }); // paymentSource: "account:id" or "payment:id"

  // 중복 제출 방지용 ref (state보다 즉시 반영됨)
  const isSubmittingRef = useRef(false);

  // 은행 계좌 상태
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true); // 계좌 로딩 상태
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set()); // 필터용 선택된 계좌들
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountFormData, setAccountFormData] = useState<Partial<AccountInput>>({
    broker_name: "",
    name: "",
    account_number: "",
    account_type: "checking",
    current_balance: 0,
    is_default: false,
  });

  // 결제수단 (카드/페이) 상태
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<string | null>(null);
  const [paymentMethodFormData, setPaymentMethodFormData] = useState<Partial<PaymentMethodInput>>({
    account_id: "",
    name: "",
    type: "debit_card",
    card_company: "",
  });

  // 월별 확정 잔액
  interface MonthlyBalance {
    id: string;
    account_id: string;
    year: number;
    month: number;
    confirmed_balance: number;
    confirmed_at: string;
  }
  const [monthlyBalances, setMonthlyBalances] = useState<MonthlyBalance[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // 모든 계좌 잔액 (계좌별)
  const [confirmBalances, setConfirmBalances] = useState<Record<string, string>>({});

  // 은행 계좌 로드
  useEffect(() => {
    loadAccounts();
    loadPaymentMethods();
  }, [profileId]);

  // 월별 확정 잔액 로드 (모든 계좌)
  useEffect(() => {
    const loadMonthlyBalances = async () => {
      if (accounts.length === 0) return;

      const accountIds = accounts.map((a) => a.id);
      const { data, error } = await supabase
        .from("account_monthly_balances")
        .select("*")
        .in("account_id", accountIds)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (!error && data) {
        setMonthlyBalances(data);
      }
    };

    loadMonthlyBalances();
  }, [accounts]);

  const loadAccounts = async () => {
    setAccountsLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .in("account_type", ["checking", "savings", "deposit"]) // 은행 계좌만
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setAccounts(data);
    }
    setAccountsLoading(false);
  };

  // 계좌 선택 토글 (필터용)
  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // 계좌 저장
  const handleSaveAccount = async () => {
    if (!accountFormData.name || !accountFormData.broker_name) {
      alert("계좌명과 은행을 입력해주세요.");
      return;
    }

    // 기존 계좌의 잔액 확인 (잔액이 변경되었는지 체크)
    let balanceChanged = false;
    if (editingAccountId) {
      const existingAccount = accounts.find((a) => a.id === editingAccountId);
      if (existingAccount && existingAccount.current_balance !== accountFormData.current_balance) {
        balanceChanged = true;
      }
    } else {
      // 새 계좌는 항상 잔액 기록
      balanceChanged = true;
    }

    const payload: AccountInput & { balance_updated_at?: string } = {
      profile_id: profileId,
      name: accountFormData.name,
      broker_name: accountFormData.broker_name,
      account_number: accountFormData.account_number || null,
      account_type: accountFormData.account_type || "checking",
      current_balance: accountFormData.current_balance || 0,
      is_default: accountFormData.is_default || false,
    };

    // 잔액이 변경되면 checkpoint 타임스탬프 업데이트
    if (balanceChanged) {
      payload.balance_updated_at = new Date().toISOString();
    }

    // 기본 계좌로 설정 시 기존 은행 계좌 중 기본 계좌 해제
    if (payload.is_default) {
      await supabase
        .from("accounts")
        .update({ is_default: false })
        .eq("profile_id", profileId)
        .in("account_type", ["checking", "savings", "deposit"])
        .eq("is_default", true);
    }

    if (editingAccountId) {
      const { error } = await supabase
        .from("accounts")
        .update(payload)
        .eq("id", editingAccountId);

      if (!error) {
        setEditingAccountId(null);
        resetAccountForm();
        loadAccounts();
      }
    } else {
      const { error } = await supabase
        .from("accounts")
        .insert(payload);

      if (!error) {
        resetAccountForm();
        loadAccounts();
      }
    }
  };

  const handleEditAccount = (account: Account) => {
    setAccountFormData({
      name: account.name,
      broker_name: account.broker_name,
      account_number: account.account_number || "",
      account_type: account.account_type || "checking",
      current_balance: account.current_balance || 0,
      is_default: account.is_default || false,
    });
    setEditingAccountId(account.id);
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("이 계좌를 삭제하시겠습니까?")) return;

    const { error } = await supabase
      .from("accounts")
      .update({ is_active: false })
      .eq("id", id);

    if (!error) {
      // 삭제된 계좌는 선택 해제
      setSelectedAccountIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      loadAccounts();
    }
  };

  const resetAccountForm = () => {
    setAccountFormData({
      broker_name: "",
      name: "",
      account_number: "",
      account_type: "checking",
      current_balance: 0,
      is_default: false,
    });
    setEditingAccountId(null);
  };

  // 결제수단 로드
  const loadPaymentMethods = async () => {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setPaymentMethods(data);
    }
  };

  // 결제수단 저장
  const handleSavePaymentMethod = async () => {
    if (!paymentMethodFormData.name || !paymentMethodFormData.account_id) {
      alert("결제수단 이름과 연결 계좌를 선택해주세요.");
      return;
    }

    const payload: PaymentMethodInput = {
      profile_id: profileId,
      account_id: paymentMethodFormData.account_id,
      name: paymentMethodFormData.name,
      type: paymentMethodFormData.type || "debit_card",
      card_company: paymentMethodFormData.card_company || null,
    };

    if (editingPaymentMethodId) {
      const { error } = await supabase
        .from("payment_methods")
        .update(payload)
        .eq("id", editingPaymentMethodId);

      if (!error) {
        setEditingPaymentMethodId(null);
        resetPaymentMethodForm();
        loadPaymentMethods();
      }
    } else {
      const { error } = await supabase
        .from("payment_methods")
        .insert(payload);

      if (!error) {
        resetPaymentMethodForm();
        loadPaymentMethods();
      }
    }
  };

  const handleEditPaymentMethod = (pm: PaymentMethod) => {
    setPaymentMethodFormData({
      account_id: pm.account_id,
      name: pm.name,
      type: pm.type,
      card_company: pm.card_company || "",
    });
    setEditingPaymentMethodId(pm.id);
  };

  const handleDeletePaymentMethod = async (id: string) => {
    if (!confirm("이 결제수단을 삭제하시겠습니까?")) return;

    const { error } = await supabase
      .from("payment_methods")
      .update({ is_active: false })
      .eq("id", id);

    if (!error) {
      loadPaymentMethods();
    }
  };

  const resetPaymentMethodForm = () => {
    setPaymentMethodFormData({
      account_id: accounts[0]?.id || "",
      name: "",
      type: "debit_card",
      card_company: "",
    });
    setEditingPaymentMethodId(null);
  };

  // 데이터 조회
  const { data: categories = [] } = useBudgetCategories(profileId);
  const { data: transactions = [], isLoading } = useBudgetTransactions(
    profileId,
    selectedYear,
    selectedMonth
  );
  const { data: expenseSummary = [] } = useMonthlySummary(
    profileId,
    selectedYear,
    selectedMonth,
    "expense"
  );
  const { data: incomeSummary = [] } = useMonthlySummary(
    profileId,
    selectedYear,
    selectedMonth,
    "income"
  );

  // Mutations
  const createMutation = useCreateTransaction(profileId, selectedYear, selectedMonth);
  const updateMutation = useUpdateTransaction(profileId, selectedYear, selectedMonth);
  const deleteMutation = useDeleteTransaction(profileId, selectedYear, selectedMonth);


  // 카테고리 목록 (DB에서 가져온 것 또는 기본값)
  const expenseCategories = useMemo(() => {
    const dbCategories = categories
      .filter((c) => c.type === "expense")
      .map((c) => c.name);
    return dbCategories.length > 0 ? dbCategories : DEFAULT_EXPENSE_CATEGORIES;
  }, [categories]);

  const incomeCategories = useMemo(() => {
    const dbCategories = categories
      .filter((c) => c.type === "income")
      .map((c) => c.name);
    return dbCategories.length > 0 ? dbCategories : DEFAULT_INCOME_CATEGORIES;
  }, [categories]);

  // 총합 계산 (모든 거래 기준)
  const totalExpense = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const totalIncome = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  // 선택된 계좌 기준으로 필터링된 거래
  const filteredTransactions = useMemo(() => {
    if (selectedAccountIds.size === 0) {
      // 아무것도 선택 안 하면 전체 표시
      return transactions;
    }
    return transactions.filter((tx) => tx.account_id && selectedAccountIds.has(tx.account_id));
  }, [transactions, selectedAccountIds]);

  // 수입/지출 거래 분리 (필터링된 거래 기준)
  const incomeTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.type === "income");
  }, [filteredTransactions]);

  const expenseTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.type === "expense");
  }, [filteredTransactions]);

  // 월별 마감 확정 (모든 계좌 일괄) - 차액을 기타 거래로 추가
  const handleConfirmMonth = async () => {
    if (accounts.length === 0) return;

    // 해당 월의 마지막 날 계산
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();

    for (const account of accounts) {
      const actualBalance = parseInt(confirmBalances[account.id] || "0", 10);
      if (isNaN(actualBalance)) continue;

      const info = accountBalanceInfo[account.id];
      const expectedBalance = info?.expectedBalance ?? (account.current_balance || 0);
      const difference = actualBalance - expectedBalance;

      // 차액이 없으면 건너뛰기
      if (difference === 0) continue;

      // 차액이 있으면 기타 거래 추가
      // 양수 차액: 수입으로 추가 (실제 잔액이 더 높음)
      // 음수 차액: 지출로 추가 (실제 잔액이 더 낮음)
      const transactionType = difference > 0 ? "income" : "expense";
      const transactionAmount = Math.abs(difference);

      const { error } = await supabase
        .from("budget_transactions")
        .insert({
          profile_id: profileId,
          type: transactionType,
          category: "기타",
          title: "잔액 조정",
          amount: transactionAmount,
          year: selectedYear,
          month: selectedMonth,
          day: lastDay,
          memo: `${selectedMonth}월 정리: ${formatWon(expectedBalance)} → ${formatWon(actualBalance)}`,
          account_id: account.id,
        });

      if (error) {
        console.error("Failed to create adjustment transaction:", error);
      }
    }

    setShowConfirmModal(false);
    setConfirmBalances({});

    // 거래 목록 새로고침을 위해 페이지 리로드 대신 mutation 캐시 무효화
    // createMutation의 onSuccess에서 자동으로 처리되므로 여기서는 window.location.reload() 사용
    window.location.reload();
  };

  // 마감 모달 열기
  const openConfirmModal = () => {
    // 모든 계좌의 예상 잔액으로 초기화
    const initialBalances: Record<string, string> = {};
    accounts.forEach((account) => {
      const info = accountBalanceInfo[account.id];
      initialBalances[account.id] = (info?.expectedBalance ?? account.current_balance ?? 0).toString();
    });
    setConfirmBalances(initialBalances);
    setShowConfirmModal(true);
  };

  // 거래 추가
  const handleAddTransaction = (data: {
    type: TransactionType;
    category: string;
    title: string;
    amount: number;
    day: number | null;
    memo: string;
    account_id: string | null;
  }) => {
    createMutation.mutate(
      {
        profile_id: profileId,
        type: data.type,
        category: data.category,
        title: data.title,
        amount: data.amount,
        year: selectedYear,
        month: selectedMonth,
        day: data.day,
        memo: data.memo || null,
        account_id: data.account_id,
      },
      {
        onSuccess: () => {
          setShowForm(false);
        },
      }
    );
  };

  // 거래 삭제
  const handleDelete = (id: string) => {
    if (confirm("이 거래를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  // 인라인 입력으로 거래 추가
  const handleInlineSubmit = (type: TransactionType) => {
    // 중복 제출 방지 (ref로 즉시 체크)
    if (isSubmittingRef.current) return;

    // 현재 입력값 캡처 (초기화 전에 저장)
    const currentInput = type === "income" ? { ...incomeInput } : { ...expenseInput };
    const amount = parseInt(currentInput.amount, 10);

    if (!amount || amount <= 0) return;
    const title = currentInput.title;
    if (!title.trim()) return;

    // 즉시 제출 잠금 (Enter 연타 방지)
    isSubmittingRef.current = true;

    // 입력 즉시 초기화 (낙관적 UX - 다음 입력 준비)
    if (type === "income") {
      setIncomeInput({ day: "", amount: "", title: "", category: "", accountId: "" });
    } else {
      setExpenseInput({ day: "", amount: "", title: "", category: "", paymentSource: "" });
    }

    // 기본 계좌
    const defaultAccountId = accounts.find(a => a.is_default)?.id || accounts[0]?.id || null;

    let accountId: string | null = null;
    let paymentMethodId: string | null = null;

    if (type === "income") {
      // 수입: 계좌로 직접
      accountId = (currentInput as typeof incomeInput).accountId || defaultAccountId;
    } else {
      // 지출: 계좌 또는 결제수단
      const source = (currentInput as typeof expenseInput).paymentSource;
      if (source.startsWith("account:")) {
        accountId = source.replace("account:", "");
      } else if (source.startsWith("payment:")) {
        paymentMethodId = source.replace("payment:", "");
        // 결제수단의 연결 계좌 찾기
        const pm = paymentMethods.find(p => p.id === paymentMethodId);
        accountId = pm?.account_id || null;
      } else {
        // 기본 계좌
        accountId = defaultAccountId;
      }
    }

    // 카테고리: 선택된 것 또는 첫 번째
    const defaultCategories = type === "income" ? incomeCategories : expenseCategories;
    const category = currentInput.category || defaultCategories[0] || "기타";

    createMutation.mutate(
      {
        profile_id: profileId,
        type,
        category,
        title: title.trim(),
        amount,
        year: selectedYear,
        month: selectedMonth,
        day: currentInput.day ? parseInt(currentInput.day, 10) : null,
        memo: null,
        account_id: accountId,
        payment_method_id: paymentMethodId,
      },
      {
        onSettled: () => {
          // 제출 완료 후 잠금 해제
          isSubmittingRef.current = false;
        },
      }
    );
  };

  // 전체 계좌 합계
  const totalAccountBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
  }, [accounts]);

  // 계좌별 수입/지출 및 예상 잔액 계산
  const accountBalanceInfo = useMemo(() => {
    const info: Record<string, { income: number; expense: number; prevBalance: number | null; expectedBalance: number }> = {};

    accounts.forEach((account) => {
      // 해당 계좌의 수입/지출 계산
      const accountIncome = transactions
        .filter((tx) => tx.type === "income" && tx.account_id === account.id)
        .reduce((sum, tx) => sum + tx.amount, 0);
      const accountExpense = transactions
        .filter((tx) => tx.type === "expense" && tx.account_id === account.id)
        .reduce((sum, tx) => sum + tx.amount, 0);

      // 전월 확정 잔액 찾기
      let prevYear = selectedYear;
      let prevMonth = selectedMonth - 1;
      if (prevMonth === 0) {
        prevYear -= 1;
        prevMonth = 12;
      }
      const prevBalance = monthlyBalances.find(
        (b) => b.account_id === account.id && b.year === prevYear && b.month === prevMonth
      );

      // 시작 잔액: 전월 확정 잔액 또는 계좌 초기 잔액
      const startBalance = prevBalance?.confirmed_balance ?? (account.current_balance || 0);
      const expectedBalance = startBalance + accountIncome - accountExpense;

      info[account.id] = {
        income: accountIncome,
        expense: accountExpense,
        prevBalance: prevBalance?.confirmed_balance ?? null,
        expectedBalance,
      };
    });

    return info;
  }, [accounts, transactions, monthlyBalances, selectedYear, selectedMonth]);

  // 로딩 중일 때 스켈레톤 표시
  if (accountsLoading || isLoading) {
    return (
      <div className={styles.container}>
        {/* 계좌 바 스켈레톤 */}
        <div className={styles.accountBar}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonAccountItem}`} />
          ))}
        </div>

        {/* 요약 헤더 스켈레톤 */}
        <div className={styles.summaryHeader}>
          <div className={styles.summaryCharts}>
            <div className={styles.summaryChartBlock}>
              <div className={styles.sideMetric}>
                <span className={`${styles.skeleton} ${styles.skeletonLabel}`} />
                <span className={`${styles.skeleton} ${styles.skeletonValue}`} />
              </div>
              <div className={styles.categoryChart}>
                <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
                <div className={styles.chartLegend}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`${styles.skeleton} ${styles.skeletonLegendItem}`} />
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.summaryChartBlock}>
              <div className={styles.sideMetric}>
                <span className={`${styles.skeleton} ${styles.skeletonLabel}`} />
                <span className={`${styles.skeleton} ${styles.skeletonValue}`} />
              </div>
              <div className={styles.categoryChart}>
                <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
                <div className={styles.chartLegend}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`${styles.skeleton} ${styles.skeletonLegendItem}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 콘텐츠 스켈레톤 */}
        <div className={styles.content}>
          <div className={styles.incomeColumn}>
            <div className={`${styles.skeleton} ${styles.skeletonColumnLabel}`} />
            <div className={`${styles.skeleton} ${styles.skeletonTableHeader}`} />
            {[1, 2, 3].map((i) => (
              <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
            ))}
          </div>
          <div className={styles.expenseColumn}>
            <div className={`${styles.skeleton} ${styles.skeletonColumnLabel}`} />
            <div className={`${styles.skeleton} ${styles.skeletonTableHeader}`} />
            {[1, 2, 3].map((i) => (
              <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 상단 계좌 바 */}
      <div className={styles.accountBar}>
        {/* 전체 (맨 왼쪽) */}
        <button
          className={`${styles.accountItem} ${selectedAccountIds.size === 0 ? styles.accountItemSelected : ""}`}
          onClick={() => setSelectedAccountIds(new Set())}
        >
          <span className={styles.accountItemName}>전체</span>
          <div className={styles.accountItemValues}>
            <span className={styles.accountItemBalance}>{formatWon(totalAccountBalance + totalIncome - totalExpense)}</span>
            <span className={`${styles.accountItemChange} ${(totalIncome - totalExpense) >= 0 ? styles.positive : styles.negative}`}>
              {(totalIncome - totalExpense) >= 0 ? "+" : "-"}{formatWon(Math.abs(totalIncome - totalExpense))}
            </span>
          </div>
        </button>
        <div className={styles.accountDivider} />
        {/* 개별 계좌들 */}
        {accounts.length === 0 ? (
          <span className={styles.noAccountsText}>등록된 계좌 없음</span>
        ) : (
          accounts.map((account) => {
            const info = accountBalanceInfo[account.id];
            const change = (info?.income ?? 0) - (info?.expense ?? 0);
            const currentBalance = info?.expectedBalance ?? (account.current_balance || 0);
            const isSelected = selectedAccountIds.has(account.id);
            return (
              <button
                key={account.id}
                className={`${styles.accountItem} ${isSelected ? styles.accountItemSelected : ""}`}
                onClick={() => toggleAccountSelection(account.id)}
              >
                <span className={styles.accountItemName}>{account.name}</span>
                <div className={styles.accountItemValues}>
                  <span className={styles.accountItemBalance}>{formatWon(currentBalance)}</span>
                  <span className={`${styles.accountItemChange} ${change >= 0 ? styles.positive : styles.negative}`}>
                    {change >= 0 ? "+" : "-"}{formatWon(Math.abs(change))}
                  </span>
                </div>
              </button>
            );
          })
        )}
        <button
          className={styles.confirmButton}
          onClick={openConfirmModal}
        >
          <Check size={14} />
          정리하기
        </button>
      </div>

      {/* 수입/지출 요약 + 월 선택 */}
      <div className={styles.summaryHeader}>
        <div className={styles.summaryCharts}>
          {/* 수입 차트 */}
          <div className={styles.summaryChartBlock}>
            <div className={styles.sideMetric}>
              <span className={styles.sideLabel}>수입</span>
              <span className={`${styles.sideValue} ${styles.incomeValue}`}>+{formatWon(totalIncome)}</span>
            </div>
            <div className={styles.categoryChart}>
              <div className={styles.chartWrapper}>
                <Doughnut
                  data={incomeSummary.length > 0 ? {
                    labels: incomeSummary.map((item) => item.category),
                    datasets: [{
                      data: incomeSummary.map((item) => item.total),
                      backgroundColor: ["#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"],
                      borderWidth: 0,
                    }],
                  } : {
                    labels: ["없음"],
                    datasets: [{
                      data: [1],
                      backgroundColor: ["#e5e7eb"],
                      borderWidth: 0,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        enabled: incomeSummary.length > 0,
                        callbacks: {
                          label: (ctx) => {
                            const value = ctx.raw as number;
                            const percent = ((value / totalIncome) * 100).toFixed(1);
                            return `${formatWon(value)} (${percent}%)`;
                          },
                        },
                      },
                    },
                    cutout: "80%",
                  }}
                />
              </div>
              <div className={styles.chartLegend}>
                {incomeSummary.length > 0 ? incomeSummary.map((item, idx) => {
                  const colors = ["#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"];
                  const percent = ((item.total / totalIncome) * 100).toFixed(1);
                  return (
                    <div key={item.category} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ backgroundColor: colors[idx % colors.length] }} />
                      <span className={styles.legendLabel}>{item.category}</span>
                      <span className={styles.legendValue}>{formatWon(item.total)}</span>
                      <span className={styles.legendPercent}>{percent}%</span>
                    </div>
                  );
                }) : (
                  <div className={styles.emptyLegend}>수입 내역이 없습니다</div>
                )}
              </div>
            </div>
          </div>
          {/* 지출 차트 */}
          <div className={styles.summaryChartBlock}>
            <div className={styles.sideMetric}>
              <span className={styles.sideLabel}>지출</span>
              <span className={`${styles.sideValue} ${styles.expenseValue}`}>-{formatWon(totalExpense)}</span>
            </div>
            <div className={styles.categoryChart}>
              <div className={styles.chartWrapper}>
                <Doughnut
                  data={expenseSummary.length > 0 ? {
                    labels: expenseSummary.map((item) => item.category),
                    datasets: [{
                      data: expenseSummary.map((item) => item.total),
                      backgroundColor: ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#eab308", "#14b8a6", "#6366f1", "#f43f5e"],
                      borderWidth: 0,
                    }],
                  } : {
                    labels: ["없음"],
                    datasets: [{
                      data: [1],
                      backgroundColor: ["#e5e7eb"],
                      borderWidth: 0,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        enabled: expenseSummary.length > 0,
                        callbacks: {
                          label: (ctx) => {
                            const value = ctx.raw as number;
                            const percent = ((value / totalExpense) * 100).toFixed(1);
                            return `${formatWon(value)} (${percent}%)`;
                          },
                        },
                      },
                    },
                    cutout: "80%",
                  }}
                />
              </div>
              <div className={styles.chartLegend}>
                {expenseSummary.length > 0 ? expenseSummary.map((item, idx) => {
                  const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#eab308", "#14b8a6", "#6366f1", "#f43f5e"];
                  const percent = ((item.total / totalExpense) * 100).toFixed(1);
                  return (
                    <div key={item.category} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ backgroundColor: colors[idx % colors.length] }} />
                      <span className={styles.legendLabel}>{item.category}</span>
                      <span className={styles.legendValue}>{formatWon(item.total)}</span>
                      <span className={styles.legendPercent}>{percent}%</span>
                    </div>
                  );
                }) : (
                  <div className={styles.emptyLegend}>지출 내역이 없습니다</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* 왼쪽: 수입 */}
        <div className={styles.incomeColumn}>
          <div className={styles.columnLabel}>수입 입력</div>
          {/* 테이블 헤더 */}
          <div className={styles.tableHeader}>
            <span className={styles.headerDay}>일</span>
            <span className={styles.headerAmount}>금액</span>
            <span className={styles.headerTitle}>내역</span>
            <span className={styles.headerCategory}>카테고리</span>
            <span className={styles.headerAccount}>계좌</span>
            <span className={styles.headerAction}></span>
          </div>
          {/* 인라인 입력 */}
          <div className={styles.inlineInputRow}>
            <input
              type="number"
              className={styles.inlineDayInput}
              value={incomeInput.day}
              onChange={(e) => setIncomeInput({ ...incomeInput, day: e.target.value })}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              min={1}
              max={31}
            />
            <input
              type="number"
              className={styles.inlineAmountInput}
              value={incomeInput.amount}
              onChange={(e) => setIncomeInput({ ...incomeInput, amount: e.target.value })}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
            />
            <input
              type="text"
              className={styles.inlineTitleInput}
              value={incomeInput.title}
              onChange={(e) => setIncomeInput({ ...incomeInput, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleInlineSubmit("income");
                }
              }}
            />
            <select
              className={styles.inlineCategorySelect}
              value={incomeInput.category || incomeCategories[0] || ""}
              onChange={(e) => setIncomeInput({ ...incomeInput, category: e.target.value })}
            >
              {incomeCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              className={styles.inlineAccountSelect}
              value={incomeInput.accountId || accounts.find(a => a.is_default)?.id || accounts[0]?.id || ""}
              onChange={(e) => setIncomeInput({ ...incomeInput, accountId: e.target.value })}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
            <button
              className={styles.inlineAddBtn}
              onClick={() => handleInlineSubmit("income")}
              disabled={createMutation.isPending}
            >
              +
            </button>
          </div>
          <div className={styles.transactionList}>
            {isLoading ? (
              <div className={styles.loading}>로딩 중...</div>
            ) : incomeTransactions.length === 0 ? (
              <div className={styles.emptyText}>이번 달 수입이 없습니다</div>
            ) : (
              incomeTransactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  accounts={accounts}
                  categories={incomeCategories}
                  onUpdate={(updates) => updateMutation.mutate({ id: tx.id, updates })}
                  onDelete={() => handleDelete(tx.id)}
                  showAccount={true}
                />
              ))
            )}
          </div>
        </div>

        {/* 오른쪽: 지출 */}
        <div className={styles.expenseColumn}>
          <div className={styles.columnLabel}>지출 입력</div>
          {/* 테이블 헤더 */}
          <div className={styles.tableHeader}>
            <span className={styles.headerDay}>일</span>
            <span className={styles.headerAmount}>금액</span>
            <span className={styles.headerTitle}>내역</span>
            <span className={styles.headerCategory}>카테고리</span>
            <span className={styles.headerAccount}>결제수단</span>
            <span className={styles.headerAction}></span>
          </div>
          {/* 인라인 입력 */}
          <div className={styles.inlineInputRow}>
            <input
              type="number"
              className={styles.inlineDayInput}
              value={expenseInput.day}
              onChange={(e) => setExpenseInput({ ...expenseInput, day: e.target.value })}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              min={1}
              max={31}
            />
            <input
              type="number"
              className={styles.inlineAmountInput}
              value={expenseInput.amount}
              onChange={(e) => setExpenseInput({ ...expenseInput, amount: e.target.value })}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
            />
            <input
              type="text"
              className={styles.inlineTitleInput}
              value={expenseInput.title}
              onChange={(e) => setExpenseInput({ ...expenseInput, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleInlineSubmit("expense");
                }
              }}
            />
            <select
              className={styles.inlineCategorySelect}
              value={expenseInput.category || expenseCategories[0] || ""}
              onChange={(e) => setExpenseInput({ ...expenseInput, category: e.target.value })}
            >
              {expenseCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              className={styles.inlineAccountSelect}
              value={expenseInput.paymentSource || `account:${accounts.find(a => a.is_default)?.id || accounts[0]?.id || ""}`}
              onChange={(e) => setExpenseInput({ ...expenseInput, paymentSource: e.target.value })}
            >
              {paymentMethods.length > 0 && (
                <optgroup label="카드/페이">
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={`payment:${pm.id}`}>{pm.name}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="계좌이체">
                {accounts.map((acc) => (
                  <option key={acc.id} value={`account:${acc.id}`}>{acc.name}</option>
                ))}
              </optgroup>
            </select>
            <button
              className={styles.inlineAddBtn}
              onClick={() => handleInlineSubmit("expense")}
              disabled={createMutation.isPending}
            >
              +
            </button>
          </div>
          <div className={styles.transactionList}>
            {isLoading ? (
              <div className={styles.loading}>로딩 중...</div>
            ) : expenseTransactions.length === 0 ? (
              <div className={styles.emptyText}>이번 달 지출이 없습니다</div>
            ) : (
              expenseTransactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  accounts={accounts}
                  categories={expenseCategories}
                  onUpdate={(updates) => updateMutation.mutate({ id: tx.id, updates })}
                  onDelete={() => handleDelete(tx.id)}
                  showAccount={true}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 거래 추가 폼 모달 */}
      {showForm && (
        <TransactionForm
          type={formType}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          accounts={accounts}
          month={selectedMonth}
          onSubmit={handleAddTransaction}
          onClose={() => setShowForm(false)}
          onTypeChange={setFormType}
          isLoading={createMutation.isPending}
        />
      )}

      {/* 월마감 확인 모달 */}
      {showConfirmModal && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{selectedMonth}월 가계부 정리</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowConfirmModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.confirmModalContent}>
              {accounts.length === 0 ? (
                <div className={styles.emptyState}>등록된 계좌가 없습니다.</div>
              ) : (
                <>
                  <p className={styles.confirmDescription}>
                    각 계좌의 실제 잔액을 확인하고 입력해주세요. 차이가 있으면 자동으로 조정됩니다.
                  </p>
                  <div className={styles.confirmAccountList}>
                    {accounts.map((account) => {
                      const info = accountBalanceInfo[account.id];
                      const expectedBalance = info?.expectedBalance ?? (account.current_balance || 0);
                      const actualBalance = parseInt(confirmBalances[account.id] || "0", 10) || 0;
                      const difference = actualBalance - expectedBalance;
                      return (
                        <div key={account.id} className={styles.confirmAccountItem}>
                          <div className={styles.confirmAccountLeft}>
                            <div className={styles.confirmAccountHeader}>
                              <span className={styles.confirmAccountName}>{account.name}</span>
                            </div>
                            <div className={styles.confirmAccountSummary}>
                              <span>수입 <span className={styles.incomeValue}>+{formatWon(info?.income ?? 0)}</span></span>
                              <span>지출 <span className={styles.expenseValue}>-{formatWon(info?.expense ?? 0)}</span></span>
                            </div>
                            <div className={styles.confirmExpectedBalance}>
                              예상 잔액: {formatWon(expectedBalance)}
                            </div>
                          </div>
                          <div className={styles.confirmAccountRight}>
                            <div className={styles.confirmAccountInput}>
                              <label>실제 잔액</label>
                              <input
                                type="number"
                                value={confirmBalances[account.id] || ""}
                                onChange={(e) => setConfirmBalances({ ...confirmBalances, [account.id]: e.target.value })}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                placeholder="0"
                              />
                            </div>
                            {difference !== 0 && (
                              <div className={`${styles.confirmDifference} ${difference > 0 ? styles.positive : styles.negative}`}>
                                {difference > 0 ? "+" : ""}{formatWon(difference)}
                                <span className={styles.confirmDifferenceLabel}>
                                  ({difference > 0 ? "수입" : "지출"} 추가)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.confirmTotalRow}>
                    <span>총 잔액</span>
                    <span>{formatWon(Object.values(confirmBalances).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0))}</span>
                  </div>
                </>
              )}
              <div className={styles.confirmActions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setShowConfirmModal(false)}
                >
                  취소
                </button>
                <button
                  className={styles.submitBtn}
                  onClick={handleConfirmMonth}
                  disabled={accounts.length === 0}
                >
                  정리 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 거래 행 컴포넌트
function TransactionRow({
  transaction,
  accounts,
  categories,
  onUpdate,
  onDelete,
  showAccount = false,
}: {
  transaction: BudgetTransaction;
  accounts: Account[];
  categories: string[];
  onUpdate: (updates: Partial<BudgetTransaction>) => void;
  onDelete: () => void;
  showAccount?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDay, setEditDay] = useState(transaction.day?.toString() || "");
  const [editAmount, setEditAmount] = useState(transaction.amount.toString());
  const [editTitle, setEditTitle] = useState(transaction.title);
  const [editCategory, setEditCategory] = useState(transaction.category);

  const account = accounts.find((a) => a.id === transaction.account_id);

  const handleSave = () => {
    const amount = parseInt(editAmount, 10);
    if (!amount || amount <= 0 || !editTitle.trim()) return;

    onUpdate({
      day: editDay ? parseInt(editDay, 10) : null,
      amount,
      title: editTitle.trim(),
      category: editCategory,
    });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditDay(transaction.day?.toString() || "");
      setEditAmount(transaction.amount.toString());
      setEditTitle(transaction.title);
      setEditCategory(transaction.category);
    }
  };

  if (isEditing) {
    return (
      <div className={styles.transactionRow}>
        <input
          type="number"
          className={styles.editDayInput}
          value={editDay}
          onChange={(e) => setEditDay(e.target.value)}
          onKeyDown={handleKeyDown}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          min={1}
          max={31}
          autoFocus
        />
        <input
          type="number"
          className={styles.editAmountInput}
          value={editAmount}
          onChange={(e) => setEditAmount(e.target.value)}
          onKeyDown={handleKeyDown}
          onWheel={(e) => (e.target as HTMLElement).blur()}
        />
        <input
          type="text"
          className={styles.editTitleInput}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <select
          className={styles.editCategorySelect}
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value)}
          onKeyDown={handleKeyDown}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {showAccount && (
          <div className={styles.transactionAccountCol}>
            {account?.name || "-"}
          </div>
        )}
        <button className={styles.saveButton} onClick={handleSave}>
          <Check size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.transactionRow} onClick={() => setIsEditing(true)}>
      <div className={styles.transactionDate}>
        {transaction.day ? `${transaction.month}/${transaction.day}` : `${transaction.month}월`}
      </div>
      <div className={styles.transactionAmountExpense}>
        {formatWon(transaction.amount)}
      </div>
      <div className={styles.transactionTitle}>
        {transaction.title}
      </div>
      <div className={styles.transactionCategory}>{transaction.category}</div>
      {showAccount && (
        <div className={styles.transactionAccountCol}>
          {account?.name || "-"}
        </div>
      )}
      <button className={styles.deleteButton} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
        <X size={14} />
      </button>
    </div>
  );
}

// 거래 추가 폼 컴포넌트
function TransactionForm({
  type,
  expenseCategories,
  incomeCategories,
  accounts,
  month,
  onSubmit,
  onClose,
  onTypeChange,
  isLoading,
}: {
  type: TransactionType;
  expenseCategories: string[];
  incomeCategories: string[];
  accounts: Account[];
  month: number;
  onSubmit: (data: {
    type: TransactionType;
    category: string;
    title: string;
    amount: number;
    day: number | null;
    memo: string;
    account_id: string | null;
  }) => void;
  onClose: () => void;
  onTypeChange: (type: TransactionType) => void;
  isLoading: boolean;
}) {
  const categories = type === "expense" ? expenseCategories : incomeCategories;
  const [category, setCategory] = useState(categories[0] || "");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState<string>("");
  const [memo, setMemo] = useState("");
  const defaultAccount = accounts.find((a) => a.is_default);
  const [accountId, setAccountId] = useState<string>(defaultAccount?.id || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !title || !amount) return;

    onSubmit({
      type,
      category,
      title,
      amount: parseInt(amount, 10),
      day: day ? parseInt(day, 10) : null,
      memo,
      account_id: accountId || null,
    });
  };

  // 타입 변경 시 카테고리도 리셋
  const handleTypeChange = (newType: TransactionType) => {
    onTypeChange(newType);
    const newCategories = newType === "expense" ? expenseCategories : incomeCategories;
    setCategory(newCategories[0] || "");
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>거래 추가</h3>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 지출/수입 선택 */}
          <div className={styles.typeSelector}>
            <button
              type="button"
              className={`${styles.typeButton} ${type === "expense" ? styles.typeButtonActive : ""}`}
              onClick={() => handleTypeChange("expense")}
            >
              지출
            </button>
            <button
              type="button"
              className={`${styles.typeButton} ${type === "income" ? styles.typeButtonActiveIncome : ""}`}
              onClick={() => handleTypeChange("income")}
            >
              수입
            </button>
          </div>

          {/* 날짜 */}
          <div className={styles.formRow}>
            <label className={styles.formLabel}>날짜</label>
            <div className={styles.dateInputGroup}>
              <span className={styles.monthDisplay}>{month}월</span>
              <input
                type="number"
                className={styles.dayInput}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="일"
                min={1}
                max={31}
              />
              <span className={styles.unitText}>일</span>
              <span className={styles.optionalText}>(선택)</span>
            </div>
          </div>

          {/* 계좌 */}
          {accounts.length > 0 && (
            <div className={styles.formRow}>
              <label className={styles.formLabel}>계좌</label>
              <select
                className={styles.select}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">선택 안 함</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.broker_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 카테고리 */}
          <div className={styles.formRow}>
            <label className={styles.formLabel}>카테고리</label>
            <select
              className={styles.select}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* 내용 */}
          <div className={styles.formRow}>
            <label className={styles.formLabel}>내용</label>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 점심, 교통카드 충전"
            />
          </div>

          {/* 금액 */}
          <div className={styles.formRow}>
            <label className={styles.formLabel}>금액</label>
            <div className={styles.amountInputGroup}>
              <input
                type="number"
                className={styles.amountInput}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.unitText}>만원</span>
            </div>
          </div>

          {/* 메모 */}
          <div className={styles.formRow}>
            <label className={styles.formLabel}>메모</label>
            <input
              type="text"
              className={styles.input}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="(선택)"
            />
          </div>

          {/* 버튼 */}
          <div className={styles.formButtons}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={!category || !title || !amount || isLoading}
            >
              {isLoading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
