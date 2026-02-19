"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { X, Check, List, CalendarDays, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import {
  useBudgetCategories,
  useBudgetTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from "@/hooks/useBudget";
import type { BudgetTransaction, TransactionType } from "@/lib/services/budgetService";
import type { Account, AccountInput, PaymentMethod, PaymentMethodInput } from "@/types/tables";
import { formatWon } from "@/lib/utils";
import { calculateAccountBalances } from "@/lib/utils/accountValueCalculator";
import { useChartTheme } from "@/hooks/useChartTheme";
import styles from "./BudgetTab.module.css";

interface BudgetTabProps {
  profileId: string;
  year: number;
  month: number; // 1-12
}

// 요일 이름
const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

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
  "식비", "외식", "카페/음료", "주거", "생활용품", "교통", "통신", "의료/건강", "교육", "의류/패션", "뷰티/미용", "여가/취미", "경조사", "보험", "기타"
];
const DEFAULT_INCOME_CATEGORIES = ["급여", "사업소득", "부수입", "용돈/선물", "환급/지원금", "기타"];

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

// 요일 인덱스 → 한글 요일
function getDayOfWeekName(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);
  const jsDay = date.getDay(); // 0=일, 1=월, ...
  const names = ["일", "월", "화", "수", "목", "금", "토"];
  return names[jsDay];
}

export function BudgetTab({ profileId, year, month }: BudgetTabProps) {
  const supabase = createClient();
  const { isDark } = useChartTheme();
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "timeline">("calendar");

  // 월간 달력 계산
  const calendarDays = useMemo(() => {
    // 해당 월 1일의 요일 (0=일, 1=월, ..., 6=토)
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
    // 월요일 시작 오프셋 (월=0, 화=1, ..., 일=6)
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    // 해당 월 마지막 날
    const lastDate = new Date(year, month, 0).getDate();
    // 총 셀 수 (5행 x 7열 = 35, 필요시 42)
    const totalCells = 42;

    const days: Date[] = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(year, month - 1, 1 - startOffset + i);
      days.push(d);
    }
    return days;
  }, [year, month]);

  // 오늘 날짜
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 데이터 조회용 년/월
  const selectedYear = year;
  const selectedMonth = month;

  // 5주 범위에 걸치는 고유 년/월 조합 계산
  const monthsToLoad = useMemo(() => {
    const months = new Set<string>();
    for (const d of calendarDays) {
      months.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    }
    return Array.from(months).map(m => {
      const [y, mo] = m.split("-");
      return { year: parseInt(y, 10), month: parseInt(mo, 10) };
    });
  }, [calendarDays]);

  // 중복 제출 방지용 ref (state보다 즉시 반영됨)
  const isSubmittingRef = useRef(false);

  // 은행 계좌 상태
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountFormData, setAccountFormData] = useState<Partial<AccountInput> & { balance_date?: string }>({
    broker_name: "",
    name: "",
    account_number: "",
    account_type: "checking",
    current_balance: 0,
    is_default: false,
    balance_date: new Date().toISOString().split("T")[0],
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
  const [confirmBalances, setConfirmBalances] = useState<Record<string, string>>({});
  const [balanceTransactions, setBalanceTransactions] = useState<BudgetTransaction[]>([]);
  const [balanceTxLoading, setBalanceTxLoading] = useState(true);
  const [balanceTxVersion, setBalanceTxVersion] = useState(0);

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

  // 잔액 계산용 거래 로드 (balance_updated_at 이후 모든 거래)
  useEffect(() => {
    const loadBalanceTransactions = async () => {
      if (accounts.length === 0) {
        setBalanceTransactions([]);
        if (!accountsLoading) {
          setBalanceTxLoading(false);
        }
        return;
      }

      setBalanceTxLoading(true);

      const balanceDates = accounts
        .filter((a) => a.balance_updated_at)
        .map((a) => new Date(a.balance_updated_at!));

      if (balanceDates.length === 0) {
        const { data, error } = await supabase
          .from("budget_transactions")
          .select("*")
          .eq("profile_id", profileId)
          .order("year", { ascending: true })
          .order("month", { ascending: true })
          .order("day", { ascending: true });

        if (!error && data) {
          setBalanceTransactions(data);
        }
        setBalanceTxLoading(false);
        return;
      }

      const oldestDate = new Date(Math.min(...balanceDates.map(d => d.getTime())));
      const oldestYear = oldestDate.getFullYear();
      const oldestMonth = oldestDate.getMonth() + 1;

      const { data, error } = await supabase
        .from("budget_transactions")
        .select("*")
        .eq("profile_id", profileId)
        .or(`year.gt.${oldestYear},and(year.eq.${oldestYear},month.gte.${oldestMonth})`)
        .order("year", { ascending: true })
        .order("month", { ascending: true })
        .order("day", { ascending: true });

      if (!error && data) {
        setBalanceTransactions(data);
      }
      setBalanceTxLoading(false);
    };

    loadBalanceTransactions();
  }, [accounts, profileId, balanceTxVersion]);

  const loadAccounts = async () => {
    setAccountsLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .eq("account_type", "checking")
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

    let balanceChanged = false;
    if (editingAccountId) {
      const existingAccount = accounts.find((a) => a.id === editingAccountId);
      if (existingAccount && existingAccount.current_balance !== accountFormData.current_balance) {
        balanceChanged = true;
      }
    } else {
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

    if (balanceChanged && accountFormData.balance_date) {
      payload.balance_updated_at = new Date(accountFormData.balance_date + "T00:00:00").toISOString();
    }

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
      balance_date: account.balance_updated_at
        ? new Date(account.balance_updated_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
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
      balance_date: new Date().toISOString().split("T")[0],
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

  // 데이터 조회 (5주 범위에 걸치는 최대 3개월 조회)
  const { data: categories = [] } = useBudgetCategories(profileId);

  // 각 월별로 거래 데이터 조회
  const month0 = monthsToLoad[0] || { year: selectedYear, month: selectedMonth };
  const month1 = monthsToLoad[1] || month0;
  const month2 = monthsToLoad[2] || month0;

  const { data: transactions0 = [], isLoading: isLoading0 } = useBudgetTransactions(
    profileId, month0.year, month0.month
  );
  const { data: transactions1 = [], isLoading: isLoading1 } = useBudgetTransactions(
    profileId, month1.year, month1.month
  );
  const { data: transactions2 = [], isLoading: isLoading2 } = useBudgetTransactions(
    profileId, month2.year, month2.month
  );
  const isLoading = isLoading0 || isLoading1 || isLoading2;

  // 모든 월 데이터 합치고 중복 제거
  const allTransactions = useMemo(() => {
    const merged = [...transactions0, ...transactions1, ...transactions2];
    const seen = new Set<string>();
    return merged.filter((tx) => {
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    });
  }, [transactions0, transactions1, transactions2]);

  // 달력 범위 내 거래 필터
  const calendarTransactions = useMemo(() => {
    if (calendarDays.length === 0) return [];
    const rangeStart = new Date(calendarDays[0]);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(calendarDays[calendarDays.length - 1]);
    rangeEnd.setHours(23, 59, 59, 999);
    return allTransactions.filter((tx) => {
      const txDate = new Date(tx.year, tx.month - 1, tx.day || 1);
      txDate.setHours(0, 0, 0, 0);
      return txDate >= rangeStart && txDate <= rangeEnd;
    });
  }, [allTransactions, calendarDays]);

  // 현재 월 거래 (표시용)
  const transactions = useMemo(() => {
    return allTransactions.filter((tx) => tx.year === year && tx.month === month);
  }, [allTransactions, year, month]);

  // 달력 일별 수입/지출 합계
  const calendarDailyTotals = useMemo(() => {
    const totals = new Map<string, { income: number; expense: number }>();
    calendarDays.forEach((d) => {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      totals.set(key, { income: 0, expense: 0 });
    });
    calendarTransactions.forEach((tx) => {
      if (!tx.day) return;
      const key = `${tx.year}-${tx.month - 1}-${tx.day}`;
      const current = totals.get(key);
      if (current) {
        if (tx.type === "income") {
          current.income += tx.amount;
        } else {
          current.expense += tx.amount;
        }
      }
    });
    return totals;
  }, [calendarTransactions, calendarDays]);

  // 타임라인용: 전체 거래를 최신순으로 정렬 + 날짜별 그룹화
  const timelineSorted = useMemo(() => {
    return [...allTransactions].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return (b.day || 0) - (a.day || 0);
    });
  }, [allTransactions]);

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

  // 총합 계산 (현재 주 거래 기준)
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
      return transactions;
    }
    return transactions.filter((tx) => tx.account_id && selectedAccountIds.has(tx.account_id));
  }, [transactions, selectedAccountIds]);

  // 월별 마감 확정 (모든 계좌 일괄) - 차액을 기타 거래로 추가
  const handleConfirmMonth = async () => {
    if (accounts.length === 0) return;

    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();

    for (const account of accounts) {
      const actualBalance = parseInt(confirmBalances[account.id] || "0", 10);
      if (isNaN(actualBalance)) continue;

      const info = accountBalanceInfo[account.id];
      const expectedBalance = info?.expectedBalance ?? (account.current_balance || 0);
      const difference = actualBalance - expectedBalance;

      if (difference === 0) continue;

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
    window.location.reload();
  };

  // 마감 모달 열기
  const openConfirmModal = () => {
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
          setBalanceTxVersion((v) => v + 1);
        },
      }
    );
  };

  // 거래 삭제
  const handleDelete = (id: string) => {
    if (confirm("이 거래를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          setBalanceTxVersion((v) => v + 1);
        },
      });
    }
  };

  // 거래 수정
  const handleUpdate = (id: string, updates: Partial<BudgetTransaction>) => {
    updateMutation.mutate(
      { id, updates },
      {
        onSuccess: () => {
          setBalanceTxVersion((v) => v + 1);
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
    return calculateAccountBalances(accounts, balanceTransactions);
  }, [accounts, balanceTransactions]);

  // 전체 누적 잔액
  const totalExpectedBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => {
      const info = accountBalanceInfo[acc.id];
      return sum + (info?.expectedBalance ?? (acc.current_balance || 0));
    }, 0);
  }, [accounts, accountBalanceInfo]);

  // 전체 누적 변동액
  const totalBalanceChange = useMemo(() => {
    return accounts.reduce((sum, acc) => {
      const info = accountBalanceInfo[acc.id];
      return sum + ((info?.income ?? 0) - (info?.expense ?? 0));
    }, 0);
  }, [accounts, accountBalanceInfo]);

  // 로딩 중일 때 스켈레톤 표시
  if (accountsLoading || isLoading || balanceTxLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.contentArea}>
          <div className={`${styles.skeleton} ${styles.skeletonCalendar}`} />
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonBottomNav}`} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 콘텐츠 영역 */}
      <div className={styles.contentArea}>
        {viewMode === "calendar" ? (
          /* ===== 캘린더 뷰 ===== */
          <div className={styles.calendarGrid}>
            {/* 요일 헤더 */}
            {DAY_NAMES.map((name) => (
              <div key={name} className={styles.calendarHeaderCell}>
                {name}
              </div>
            ))}

            {/* 달력 셀 */}
            {calendarDays.map((day, idx) => {
              const dayNum = day.getDate();
              const isToday = day.getTime() === today.getTime();
              const isCurrentMonth = day.getMonth() === month - 1 && day.getFullYear() === year;
              const key = `${day.getFullYear()}-${day.getMonth()}-${dayNum}`;
              const totals = calendarDailyTotals.get(key) || { income: 0, expense: 0 };

              return (
                <div
                  key={idx}
                  className={`${styles.calendarCell} ${!isCurrentMonth ? styles.calendarCellOtherMonth : ""}`}
                >
                  <div className={styles.calendarCellHeader}>
                    <span className={`${styles.calendarDayNum} ${isToday ? styles.calendarDayToday : ""}`}>
                      {dayNum}
                    </span>
                  </div>
                  <div className={styles.calendarCellTotals}>
                    {totals.income > 0 && (
                      <span className={styles.calendarIncome}>+{formatWon(totals.income)}</span>
                    )}
                    {totals.expense > 0 && (
                      <span className={styles.calendarExpense}>-{formatWon(totals.expense)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ===== 타임라인 뷰 ===== */
          <TimelineView
            transactions={timelineSorted}
            accounts={accounts}
            paymentMethods={paymentMethods}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* 하단 네비게이션 바 */}
      <div
        className={styles.bottomNav}
        style={{
          background: isDark ? 'rgba(34, 37, 41, 0.5)' : 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
        }}
      >
        <button
          className={`${styles.bottomNavItem} ${viewMode === "timeline" ? styles.bottomNavItemActive : ""}`}
          onClick={() => setViewMode("timeline")}
        >
          <List size={18} />
        </button>
        <button
          className={styles.addButton}
          onClick={() => setShowForm(true)}
        >
          <Plus size={20} />
        </button>
        <button
          className={`${styles.bottomNavItem} ${viewMode === "calendar" ? styles.bottomNavItemActive : ""}`}
          onClick={() => setViewMode("calendar")}
        >
          <CalendarDays size={18} />
        </button>
      </div>

      {/* 가계부 작성 일괄 입력 모달 */}
      {showForm && (
        <TransactionForm
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          accounts={accounts}
          onSubmit={handleAddTransaction}
          onClose={() => setShowForm(false)}
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

// 타임라인 뷰 컴포넌트
function TimelineView({
  transactions,
  accounts,
  paymentMethods,
  expenseCategories,
  incomeCategories,
  onUpdate,
  onDelete,
}: {
  transactions: BudgetTransaction[];
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  expenseCategories: string[];
  incomeCategories: string[];
  onUpdate: (id: string, updates: Partial<BudgetTransaction>) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (transactions.length === 0) {
    return (
      <div className={styles.timelineView}>
        <div className={styles.timelineEmpty}>거래 내역이 없습니다</div>
      </div>
    );
  }

  // 날짜별 그룹화
  type DateGroup = { dateKey: string; label: string; items: BudgetTransaction[] };
  const groups: DateGroup[] = [];
  let currentGroup: DateGroup | null = null;

  for (const tx of transactions) {
    const dateKey = `${tx.year}-${tx.month}-${tx.day || 0}`;
    if (!currentGroup || currentGroup.dateKey !== dateKey) {
      const dayLabel = tx.day
        ? `${tx.month}/${tx.day} ${getDayOfWeekName(tx.year, tx.month, tx.day)}`
        : `${tx.year}.${String(tx.month).padStart(2, "0")}`;
      currentGroup = { dateKey, label: dayLabel, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(tx);
  }

  return (
    <div className={styles.timelineView}>
      {groups.map((group) => (
        <div key={group.dateKey}>
          <div className={styles.timelineGroup}>{group.label}</div>
          {group.items.map((tx) => (
            <TimelineTransactionRow
              key={tx.id}
              transaction={tx}
              accounts={accounts}
              paymentMethods={paymentMethods}
              categories={tx.type === "income" ? incomeCategories : expenseCategories}
              isEditing={editingId === tx.id}
              onStartEdit={() => setEditingId(tx.id)}
              onCancelEdit={() => setEditingId(null)}
              onUpdate={(updates) => {
                onUpdate(tx.id, updates);
                setEditingId(null);
              }}
              onDelete={() => onDelete(tx.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// 타임라인 거래 행 (표시/수정 겸용)
function TimelineTransactionRow({
  transaction,
  accounts,
  paymentMethods,
  categories,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: {
  transaction: BudgetTransaction;
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  categories: string[];
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<BudgetTransaction>) => void;
  onDelete: () => void;
}) {
  const [editDay, setEditDay] = useState(transaction.day?.toString() || "");
  const [editAmount, setEditAmount] = useState(transaction.amount.toString());
  const [editTitle, setEditTitle] = useState(transaction.title);
  const [editCategory, setEditCategory] = useState(transaction.category);
  const initialPaymentSource = transaction.payment_method_id
    ? `payment:${transaction.payment_method_id}`
    : `account:${transaction.account_id}`;
  const [editPaymentSource, setEditPaymentSource] = useState(initialPaymentSource);

  const handleSave = () => {
    const amount = parseInt(editAmount, 10);
    if (!amount || amount <= 0 || !editTitle.trim()) return;

    let accountId = transaction.account_id;
    let paymentMethodId: string | null = transaction.payment_method_id;

    if (editPaymentSource.startsWith("payment:")) {
      paymentMethodId = editPaymentSource.replace("payment:", "");
      const pm = paymentMethods.find((p) => p.id === paymentMethodId);
      if (pm) accountId = pm.account_id;
    } else if (editPaymentSource.startsWith("account:")) {
      accountId = editPaymentSource.replace("account:", "");
      paymentMethodId = null;
    }

    onUpdate({
      day: editDay ? parseInt(editDay, 10) : null,
      amount,
      title: editTitle.trim(),
      category: editCategory,
      account_id: accountId,
      payment_method_id: paymentMethodId,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      onCancelEdit();
      setEditDay(transaction.day?.toString() || "");
      setEditAmount(transaction.amount.toString());
      setEditTitle(transaction.title);
      setEditCategory(transaction.category);
      setEditPaymentSource(initialPaymentSource);
    }
  };

  if (isEditing) {
    return (
      <div className={styles.timelineEditRow}>
        <input
          type="number"
          className={styles.timelineEditDayInput}
          value={editDay}
          onChange={(e) => setEditDay(e.target.value)}
          onKeyDown={handleKeyDown}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          min={1}
          max={31}
          placeholder="일"
          autoFocus
        />
        <input
          type="number"
          className={styles.timelineEditAmountInput}
          value={editAmount}
          onChange={(e) => setEditAmount(e.target.value)}
          onKeyDown={handleKeyDown}
          onWheel={(e) => (e.target as HTMLElement).blur()}
        />
        <input
          type="text"
          className={styles.timelineEditTitleInput}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <select
          className={styles.timelineEditCategorySelect}
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value)}
          onKeyDown={handleKeyDown}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          className={styles.timelineEditAccountSelect}
          value={editPaymentSource}
          onChange={(e) => setEditPaymentSource(e.target.value)}
          onKeyDown={handleKeyDown}
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
        <button className={styles.timelineEditSaveBtn} onClick={handleSave}>
          <Check size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.timelineRow} onClick={onStartEdit}>
      <div className={styles.timelineRowDate}>
        {transaction.day ? `${transaction.day}일` : ""}
      </div>
      <div
        className={`${styles.timelineRowAmount} ${
          transaction.type === "income"
            ? styles.timelineRowAmountIncome
            : styles.timelineRowAmountExpense
        }`}
      >
        {transaction.type === "income" ? "+" : "-"}{formatWon(transaction.amount)}
      </div>
      <div className={styles.timelineRowTitle}>{transaction.title}</div>
      <div className={styles.timelineRowCategory}>{transaction.category}</div>
      <button
        className={styles.timelineRowDelete}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// 거래 행 컴포넌트 (legacy - kept for potential reuse)
function TransactionRow({
  transaction,
  accounts,
  categories,
  paymentMethods = [],
  onUpdate,
  onDelete,
  showAccount = false,
}: {
  transaction: BudgetTransaction;
  accounts: Account[];
  categories: string[];
  paymentMethods?: PaymentMethod[];
  onUpdate: (updates: Partial<BudgetTransaction>) => void;
  onDelete: () => void;
  showAccount?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDay, setEditDay] = useState(transaction.day?.toString() || "");
  const [editAmount, setEditAmount] = useState(transaction.amount.toString());
  const [editTitle, setEditTitle] = useState(transaction.title);
  const [editCategory, setEditCategory] = useState(transaction.category);
  const initialPaymentSource = transaction.payment_method_id
    ? `payment:${transaction.payment_method_id}`
    : `account:${transaction.account_id}`;
  const [editPaymentSource, setEditPaymentSource] = useState(initialPaymentSource);

  const account = accounts.find((a) => a.id === transaction.account_id);
  const paymentMethod = paymentMethods.find((pm) => pm.id === transaction.payment_method_id);

  const handleSave = () => {
    const amount = parseInt(editAmount, 10);
    if (!amount || amount <= 0 || !editTitle.trim()) return;

    let accountId = transaction.account_id;
    let paymentMethodId: string | null = transaction.payment_method_id;

    if (editPaymentSource.startsWith("payment:")) {
      paymentMethodId = editPaymentSource.replace("payment:", "");
      const pm = paymentMethods.find((p) => p.id === paymentMethodId);
      if (pm) accountId = pm.account_id;
    } else if (editPaymentSource.startsWith("account:")) {
      accountId = editPaymentSource.replace("account:", "");
      paymentMethodId = null;
    }

    onUpdate({
      day: editDay ? parseInt(editDay, 10) : null,
      amount,
      title: editTitle.trim(),
      category: editCategory,
      account_id: accountId,
      payment_method_id: paymentMethodId,
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
      setEditPaymentSource(initialPaymentSource);
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
          <select
            className={styles.editAccountSelect}
            value={editPaymentSource}
            onChange={(e) => setEditPaymentSource(e.target.value)}
            onKeyDown={handleKeyDown}
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
        )}
        <button className={styles.saveButton} onClick={handleSave}>
          <Check size={14} />
        </button>
      </div>
    );
  }

  // 표시용 결제수단 이름
  const displayPaymentSource = paymentMethod?.name || account?.name || "-";

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
          {displayPaymentSource}
        </div>
      )}
      <button className={styles.deleteButton} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
        <X size={14} />
      </button>
    </div>
  );
}

// 일괄 거래 입력 폼 (가계부 작성)
interface FormRow {
  id: string;
  day: string;
  type: TransactionType;
  category: string;
  title: string;
  amount: string;
  accountId: string;
}

function createEmptyRow(
  defaultType: TransactionType,
  defaultCategory: string,
  defaultAccountId: string,
  defaultDay: string,
): FormRow {
  return {
    id: crypto.randomUUID(),
    day: defaultDay,
    type: defaultType,
    category: defaultCategory,
    title: "",
    amount: "",
    accountId: defaultAccountId,
  };
}

function TransactionForm({
  expenseCategories,
  incomeCategories,
  accounts,
  onSubmit,
  onClose,
  isLoading,
}: {
  expenseCategories: string[];
  incomeCategories: string[];
  accounts: Account[];
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
  isLoading: boolean;
}) {
  const defaultAccount = accounts.find((a) => a.is_default);
  const defaultAccountId = defaultAccount?.id || "";
  const todayDay = new Date().getDate().toString();

  const [rows, setRows] = useState<FormRow[]>([]);
  const [currentRow, setCurrentRow] = useState<FormRow>(
    createEmptyRow("expense", expenseCategories[0] || "", defaultAccountId, todayDay)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const isRowValid = (row: FormRow) => {
    return row.title.trim() !== "" && row.amount !== "" && parseInt(row.amount, 10) > 0;
  };

  const commitCurrentRow = () => {
    if (!isRowValid(currentRow)) return;
    setRows((prev) => [...prev, currentRow]);
    setCurrentRow(
      createEmptyRow(currentRow.type, currentRow.category, currentRow.accountId, currentRow.day)
    );
    // Focus the title input of the new row after render
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleCurrentRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitCurrentRow();
    }
  };

  const handleDeleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCurrentRowTypeChange = (newType: TransactionType) => {
    const newCategories = newType === "expense" ? expenseCategories : incomeCategories;
    setCurrentRow((prev) => ({
      ...prev,
      type: newType,
      category: newCategories[0] || "",
    }));
  };

  const getCategoriesForType = (type: TransactionType) => {
    return type === "expense" ? expenseCategories : incomeCategories;
  };

  const handleSaveAll = async () => {
    // Collect all valid rows: committed rows + current row if valid
    const allRows = [...rows];
    if (isRowValid(currentRow)) {
      allRows.push(currentRow);
    }

    if (allRows.length === 0) return;

    setIsSubmitting(true);
    for (const row of allRows) {
      onSubmit({
        type: row.type,
        category: row.category,
        title: row.title.trim(),
        amount: parseInt(row.amount, 10),
        day: row.day ? parseInt(row.day, 10) : null,
        memo: "",
        account_id: row.accountId || null,
      });
    }
    // Close is handled by the parent via onSuccess callback in createMutation
  };

  const totalCount = rows.length + (isRowValid(currentRow) ? 1 : 0);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.batchModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>가계부 작성</h3>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.batchBody}>
          {/* Header row */}
          <div className={styles.batchHeader}>
            <span className={styles.batchColDay}>날짜</span>
            <span className={styles.batchColType}>유형</span>
            <span className={styles.batchColCategory}>카테고리</span>
            <span className={styles.batchColTitle}>내용</span>
            <span className={styles.batchColAmount}>금액</span>
            <span className={styles.batchColAccount}>계좌</span>
            <span className={styles.batchColAction} />
          </div>

          {/* Committed rows */}
          <div className={styles.batchList}>
            {rows.map((row) => (
              <div key={row.id} className={styles.batchRow}>
                <span className={styles.batchCellDay}>{row.day || "-"}</span>
                <span
                  className={`${styles.batchCellType} ${
                    row.type === "income" ? styles.batchCellTypeIncome : styles.batchCellTypeExpense
                  }`}
                >
                  {row.type === "expense" ? "지출" : "수입"}
                </span>
                <span className={styles.batchCellCategory}>{row.category}</span>
                <span className={styles.batchCellTitle}>{row.title}</span>
                <span className={styles.batchCellAmount}>{parseInt(row.amount, 10).toLocaleString()}</span>
                <span className={styles.batchCellAccount}>
                  {accounts.find((a) => a.id === row.accountId)?.name || "-"}
                </span>
                <button
                  className={styles.batchRowDelete}
                  onClick={() => handleDeleteRow(row.id)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {/* Active input row */}
            <div className={styles.batchInputRow}>
              <input
                type="number"
                className={styles.batchDayInput}
                value={currentRow.day}
                onChange={(e) => setCurrentRow((prev) => ({ ...prev, day: e.target.value }))}
                onKeyDown={handleCurrentRowKeyDown}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder={todayDay}
                min={1}
                max={31}
              />
              <div className={styles.batchTypeToggle}>
                <button
                  type="button"
                  className={`${styles.batchTypeBtn} ${
                    currentRow.type === "expense" ? styles.batchTypeBtnExpense : ""
                  }`}
                  onClick={() => handleCurrentRowTypeChange("expense")}
                >
                  지출
                </button>
                <button
                  type="button"
                  className={`${styles.batchTypeBtn} ${
                    currentRow.type === "income" ? styles.batchTypeBtnIncome : ""
                  }`}
                  onClick={() => handleCurrentRowTypeChange("income")}
                >
                  수입
                </button>
              </div>
              <select
                className={styles.batchCategorySelect}
                value={currentRow.category}
                onChange={(e) => setCurrentRow((prev) => ({ ...prev, category: e.target.value }))}
                onKeyDown={handleCurrentRowKeyDown}
              >
                {getCategoriesForType(currentRow.type).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <input
                ref={titleInputRef}
                type="text"
                className={styles.batchTitleInput}
                value={currentRow.title}
                onChange={(e) => setCurrentRow((prev) => ({ ...prev, title: e.target.value }))}
                onKeyDown={handleCurrentRowKeyDown}
                placeholder="내용"
              />
              <input
                type="number"
                className={styles.batchAmountInput}
                value={currentRow.amount}
                onChange={(e) => setCurrentRow((prev) => ({ ...prev, amount: e.target.value }))}
                onKeyDown={handleCurrentRowKeyDown}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <select
                className={styles.batchAccountSelect}
                value={currentRow.accountId}
                onChange={(e) => setCurrentRow((prev) => ({ ...prev, accountId: e.target.value }))}
                onKeyDown={handleCurrentRowKeyDown}
              >
                <option value="">-</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
              <button
                className={styles.batchRowAdd}
                onClick={commitCurrentRow}
                disabled={!isRowValid(currentRow)}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.batchFooter}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className={styles.submitButton}
            onClick={handleSaveAll}
            disabled={totalCount === 0 || isLoading || isSubmitting}
          >
            {isLoading || isSubmitting ? "저장 중..." : `저장 (${totalCount}건)`}
          </button>
        </div>
      </div>
    </div>
  );
}
