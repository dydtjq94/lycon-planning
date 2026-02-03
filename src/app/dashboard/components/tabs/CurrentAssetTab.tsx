"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus, Trash2, Link2, User } from "lucide-react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import {
  useTodaySnapshot,
  useSnapshotItems,
  useCreateSnapshotItem,
  useUpdateSnapshotItem,
  useDeleteSnapshotItem,
  useUpdateSnapshot,
  usePortfolioTransactions,
  usePortfolioChartPriceData,
} from "@/hooks/useFinancialData";
import type { FinancialSnapshotItem, PortfolioAccount, Account } from "@/types/tables";
import { formatMoney, formatWon } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getBankAccounts, getTermDepositAccounts, getBudgetTransactions } from "@/lib/services/budgetService";
import styles from "./CurrentAssetTab.module.css";

ChartJS.register(ArcElement, Tooltip, Legend);

interface CurrentAssetTabProps {
  profileId: string;
  onNavigate?: (section: string) => void;
}

type TabType = "savings" | "investment" | "realEstate" | "realAsset" | "debt" | "profile";

const TABS: { id: TabType; label: string; color: string }[] = [
  { id: "savings", label: "저축", color: "#3b82f6" },
  { id: "investment", label: "투자", color: "#22c55e" },
  { id: "realEstate", label: "부동산", color: "#8b5cf6" },
  { id: "realAsset", label: "실물 자산", color: "#f59e0b" },
  { id: "debt", label: "부채", color: "#ef4444" },
  { id: "profile", label: "프로필", color: "#6b7280" },
];

// 카테고리별 item_type 매핑
const ITEM_TYPES: Record<TabType, { value: string; label: string }[]> = {
  savings: [
    { value: "checking", label: "입출금통장" },
    { value: "savings", label: "적금" },
    { value: "deposit", label: "예금" },
    { value: "emergency", label: "비상금" },
  ],
  investment: [
    { value: "domestic_stock", label: "국내주식" },
    { value: "foreign_stock", label: "해외주식" },
    { value: "fund", label: "펀드" },
    { value: "bond", label: "채권" },
    { value: "crypto", label: "암호화폐" },
    { value: "etf", label: "ETF" },
  ],
  realEstate: [
    { value: "apartment", label: "아파트" },
    { value: "house", label: "주택" },
    { value: "officetel", label: "오피스텔" },
    { value: "land", label: "토지" },
    { value: "commercial", label: "상가" },
    { value: "other", label: "기타" },
  ],
  realAsset: [
    { value: "car", label: "자동차" },
    { value: "precious_metal", label: "귀금속" },
    { value: "art", label: "미술품" },
    { value: "other", label: "기타" },
  ],
  debt: [
    { value: "mortgage", label: "주택담보대출" },
    { value: "jeonse", label: "전세대출" },
    { value: "credit", label: "신용대출" },
    { value: "student", label: "학자금대출" },
    { value: "card", label: "카드대출" },
    { value: "car", label: "자동차대출" },
    { value: "installment", label: "할부금" },
    { value: "other", label: "기타" },
  ],
  profile: [],
};

export function CurrentAssetTab({ profileId, onNavigate }: CurrentAssetTabProps) {
  const [activeTab, setActiveTab] = useState<TabType>("savings");
  const [isSaved, setIsSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const supabase = createClient();

  // 스냅샷 데이터 (항상 오늘)
  const { data: todaySnapshot, isLoading: isSnapshotLoading } = useTodaySnapshot(profileId);
  const currentSnapshot = todaySnapshot;

  const { data: dbItems = [], isLoading: isItemsLoading } = useSnapshotItems(currentSnapshot?.id);

  // 로컬 상태 (저장 버튼 누를 때까지 DB에 반영 안 됨)
  const [localItems, setLocalItems] = useState<FinancialSnapshotItem[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
  const [nextTempId, setNextTempId] = useState(1);

  // DB 데이터 변경 시 로컬 상태 초기화 (스냅샷 ID 기준)
  const snapshotId = currentSnapshot?.id;
  const dbItemsKey = JSON.stringify(dbItems.map(i => i.id).sort());

  useEffect(() => {
    // hasChanges가 true면 로컬 변경사항이 있으므로 덮어쓰지 않음
    if (!hasChanges) {
      setLocalItems(dbItems);
      setPendingDeletes([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId, dbItemsKey]);

  // 실제 사용할 items (로컬 상태)
  const items = localItems;

  // Mutation 훅
  const createMutation = useCreateSnapshotItem(profileId);
  const updateMutation = useUpdateSnapshotItem(profileId, currentSnapshot?.id || '');
  const deleteMutation = useDeleteSnapshotItem(profileId, currentSnapshot?.id || '');
  const updateSnapshotMutation = useUpdateSnapshot(profileId);

  // 포트폴리오 거래 + 계좌 데이터
  const { data: portfolioTransactions = [], isLoading: isTransactionsLoading } = usePortfolioTransactions(profileId);
  const { data: priceCache, isLoading: isPriceLoading } = usePortfolioChartPriceData(profileId, portfolioTransactions, portfolioTransactions.length > 0);
  const [accounts, setAccounts] = useState<PortfolioAccount[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(true);

  // 증권 계좌 로드
  useEffect(() => {
    const loadAccounts = async () => {
      setIsAccountsLoading(true);
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .order("is_default", { ascending: false });
      if (data) setAccounts(data);
      setIsAccountsLoading(false);
    };
    loadAccounts();
  }, [profileId, supabase]);

  // 저축 연동: 입출금 계좌 + 정기 예금/적금 계좌 + 거래 내역
  const [checkingAccounts, setCheckingAccounts] = useState<Account[]>([]);
  const [termDepositAccounts, setTermDepositAccounts] = useState<Account[]>([]);
  const [budgetTransactions, setBudgetTransactions] = useState<{ account_id: string | null; type: string; amount: number }[]>([]);
  const [isSavingsAccountsLoading, setIsSavingsAccountsLoading] = useState(true);

  // 현재 연/월
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    const loadSavingsAccounts = async () => {
      setIsSavingsAccountsLoading(true);
      try {
        // 입출금 계좌 (checking만)
        const { data: checkingData } = await supabase
          .from("accounts")
          .select("*")
          .eq("profile_id", profileId)
          .eq("is_active", true)
          .eq("account_type", "checking")
          .order("is_default", { ascending: false });
        if (checkingData) setCheckingAccounts(checkingData);

        // 정기 예금/적금 계좌
        const termData = await getTermDepositAccounts(profileId);
        setTermDepositAccounts(termData);

        // 현재 월의 거래 내역 가져오기 (예상 잔액 계산용)
        const transactions = await getBudgetTransactions(profileId, currentYear, currentMonth);
        setBudgetTransactions(transactions.map(tx => ({
          account_id: tx.account_id,
          type: tx.type,
          amount: tx.amount,
        })));
      } catch (error) {
        console.error("Failed to load savings accounts:", error);
      } finally {
        setIsSavingsAccountsLoading(false);
      }
    };
    loadSavingsAccounts();
  }, [profileId, supabase, currentYear, currentMonth]);

  // 계좌별 수입/지출 합계 계산
  const accountTransactionSummary = useMemo(() => {
    const summary: Record<string, { income: number; expense: number }> = {};
    budgetTransactions.forEach(tx => {
      if (!tx.account_id) return;
      if (!summary[tx.account_id]) {
        summary[tx.account_id] = { income: 0, expense: 0 };
      }
      if (tx.type === "income") {
        summary[tx.account_id].income += tx.amount;
      } else {
        summary[tx.account_id].expense += tx.amount;
      }
    });
    return summary;
  }, [budgetTransactions]);

  // 정기 예금/적금 현재 평가금액 계산 (SavingsDepositsTab과 동일한 로직)
  const getTermDepositCurrentValue = (account: Account): number => {
    // 누적 이자 계산
    const calculateInterest = (): number => {
      if (!account.current_balance || !account.interest_rate) return 0;
      if (!account.start_year) return 0;

      const startDate = new Date(account.start_year, (account.start_month || 1) - 1);
      const today = new Date();
      const monthsElapsed = Math.max(0,
        (today.getFullYear() - startDate.getFullYear()) * 12 +
        (today.getMonth() - startDate.getMonth())
      );

      if (account.account_type === "savings" && account.monthly_contribution) {
        // 적금: 복리 계산
        const monthlyRate = account.interest_rate / 100 / 12;
        let total = 0;
        for (let i = 0; i < monthsElapsed; i++) {
          total = (total + account.monthly_contribution) * (1 + monthlyRate);
        }
        const principal = account.monthly_contribution * monthsElapsed;
        return Math.round(total - principal);
      } else {
        // 예금: 복리 계산
        const yearsElapsed = monthsElapsed / 12;
        const rate = account.interest_rate / 100;
        const currentValue = account.current_balance * Math.pow(1 + rate, yearsElapsed);
        return Math.round(currentValue - account.current_balance);
      }
    };

    const interest = calculateInterest();

    // 현재 평가금액 = 원금 + 이자
    if (account.account_type === "savings" && account.monthly_contribution && account.start_year) {
      const startDate = new Date(account.start_year, (account.start_month || 1) - 1);
      const today = new Date();
      const monthsElapsed = Math.max(0,
        (today.getFullYear() - startDate.getFullYear()) * 12 +
        (today.getMonth() - startDate.getMonth())
      );
      const principal = account.monthly_contribution * monthsElapsed;
      return principal + interest;
    }
    return (account.current_balance || 0) + interest;
  };

  // 저축 계좌별 데이터 계산 (원 단위, 거래 반영한 예상 잔액)
  const savingsAccountValues = useMemo(() => {
    const values: { id: string; type: string; name: string; broker: string; value: number }[] = [];

    // 입출금 계좌 (원 단위) - 현재 잔액 + 수입 - 지출 = 예상 잔액
    checkingAccounts.forEach(acc => {
      const summary = accountTransactionSummary[acc.id] || { income: 0, expense: 0 };
      const expectedBalance = (acc.current_balance || 0) + summary.income - summary.expense;
      values.push({
        id: acc.id,
        type: "checking",
        name: acc.name,
        broker: acc.broker_name,
        value: expectedBalance,
      });
    });

    // 정기 예금/적금 (원 단위)
    termDepositAccounts.forEach(acc => {
      values.push({
        id: acc.id,
        type: acc.account_type,
        name: acc.name,
        broker: acc.broker_name,
        value: getTermDepositCurrentValue(acc),
      });
    });

    return values;
  }, [checkingAccounts, termDepositAccounts, accountTransactionSummary]);

  // 저축 총액 (연동) - 원 단위
  const linkedSavingsTotalWon = useMemo(() => {
    return savingsAccountValues.reduce((sum, acc) => sum + acc.value, 0);
  }, [savingsAccountValues]);

  // 저축 총액 (만원 단위 - 다른 섹션과 일관성 유지)
  const linkedSavingsTotal = useMemo(() => {
    return Math.round(linkedSavingsTotalWon / 10000);
  }, [linkedSavingsTotalWon]);


  const isLoading = isSnapshotLoading || isItemsLoading;
  const isInvestmentDataReady = !isTransactionsLoading && !isPriceLoading && !isAccountsLoading;
  const isSavingsDataReady = !isSavingsAccountsLoading;

  // 증권 계좌별 평가금액 계산 (현재가 기준)
  const accountValues = useMemo(() => {
    const values = new Map<string, { broker: string; accountName: string; value: number; invested: number }>();

    // 계좌별 보유량 계산
    const holdingsMap = new Map<string, Map<string, { qty: number; invested: number; currency: string }>>();

    portfolioTransactions.forEach(tx => {
      const accountId = tx.account_id || "unknown";
      if (!holdingsMap.has(accountId)) {
        holdingsMap.set(accountId, new Map());
      }
      const accountHoldings = holdingsMap.get(accountId)!;
      const current = accountHoldings.get(tx.ticker) || { qty: 0, invested: 0, currency: tx.currency };

      if (tx.type === "buy") {
        current.qty += tx.quantity;
        current.invested += tx.quantity * tx.price;
      } else {
        const sellRatio = current.qty > 0 ? tx.quantity / current.qty : 0;
        current.qty -= tx.quantity;
        current.invested *= (1 - sellRatio);
      }
      accountHoldings.set(tx.ticker, current);
    });

    // 가장 최근 환율 찾기
    let latestExchangeRate = 1400; // 기본값
    if (priceCache?.exchangeRateMap && priceCache.exchangeRateMap.size > 0) {
      const sortedFxDates = Array.from(priceCache.exchangeRateMap.keys()).sort();
      const latestFxDate = sortedFxDates[sortedFxDates.length - 1];
      latestExchangeRate = priceCache.exchangeRateMap.get(latestFxDate) || 1400;
    }

    // 계좌별 평가금액 계산
    holdingsMap.forEach((holdings, accountId) => {
      let totalInvested = 0;
      let totalValue = 0;

      holdings.forEach((h, ticker) => {
        if (h.qty > 0) {
          totalInvested += h.invested;

          // 현재가 찾기
          let latestPrice = 0;
          if (priceCache?.priceDataMap) {
            const tickerPrices = priceCache.priceDataMap.get(ticker);
            if (tickerPrices && tickerPrices.size > 0) {
              const sortedDates = Array.from(tickerPrices.keys()).sort();
              const latestDate = sortedDates[sortedDates.length - 1];
              latestPrice = tickerPrices.get(latestDate) || 0;
            }
          }

          if (latestPrice > 0) {
            // 해외주식이면 환율 적용
            if (h.currency === "USD") {
              totalValue += h.qty * latestPrice * latestExchangeRate;
            } else {
              totalValue += h.qty * latestPrice;
            }
          } else {
            // 가격 데이터 없으면 투자금액 사용
            totalValue += h.invested;
          }
        }
      });

      const account = accounts.find(a => a.id === accountId);
      const broker = account?.broker_name || "기타";
      const accountName = account?.name || "계좌";

      if (totalInvested > 0 || totalValue > 0) {
        values.set(accountId, {
          broker,
          accountName,
          value: totalValue || totalInvested,
          invested: totalInvested,
        });
      }
    });

    return values;
  }, [portfolioTransactions, accounts, priceCache]);

  // 투자 총액 (원 단위)
  const investmentTotalWon = useMemo(() => {
    let total = 0;
    accountValues.forEach(v => {
      total += v.value;
    });
    return Math.round(total);
  }, [accountValues]);

  // 카테고리별 합계 계산
  const totals = useMemo(() => {
    // 저축: 연동된 계좌 데이터 사용 (입출금 + 정기예금/적금)
    const savings = linkedSavingsTotal;

    // 투자: 포트폴리오 계좌별 평가금액 합계 (만원 단위로 변환)
    let portfolioTotal = 0;
    accountValues.forEach(v => {
      portfolioTotal += v.value; // 평가금액 사용
    });
    const investment = Math.round(portfolioTotal / 10000);

    // 부동산: real_estate 타입 또는 새 부동산 타입들
    const realEstate = items
      .filter(i => i.category === "asset" && ["real_estate", "apartment", "house", "officetel", "land", "commercial"].includes(i.item_type))
      .reduce((sum, i) => sum + i.amount, 0);

    // 실물자산: 자동차, 귀금속, 미술품 등 (부동산 제외)
    const realAsset = items
      .filter(i => i.category === "asset" && ["car", "precious_metal", "art", "other"].includes(i.item_type))
      .reduce((sum, i) => sum + i.amount, 0);

    const debt = items
      .filter(i => i.category === "debt")
      .reduce((sum, i) => sum + i.amount, 0);

    const totalAssets = savings + investment + realEstate + realAsset;
    const netWorth = totalAssets - debt;

    return { savings, investment, realEstate, realAsset, debt, totalAssets, netWorth };
  }, [items, accountValues, linkedSavingsTotal]);

  // 현재 탭의 항목들
  const currentItems = useMemo(() => {
    if (activeTab === "profile") return [];
    const typeValues = ITEM_TYPES[activeTab].map(t => t.value);
    // realEstate는 기존 real_estate도 포함
    const additionalTypes = activeTab === "realEstate" ? ["real_estate"] : [];
    const allTypes = [...typeValues, ...additionalTypes];
    const category = activeTab === "debt" ? "debt" : "asset";
    return items.filter(i => i.category === category && allTypes.includes(i.item_type));
  }, [items, activeTab]);

  // 차트 데이터 - 순자산 (메인) - 부채 포함
  const hasData = totals.savings > 0 || totals.investment > 0 || totals.realEstate > 0 || totals.realAsset > 0 || totals.debt > 0;
  const chartData = {
    labels: hasData ? ["저축", "투자", "부동산", "실물자산", "부채"] : ["데이터 없음"],
    datasets: [{
      data: hasData
        ? [totals.savings || 0.01, totals.investment || 0.01, totals.realEstate || 0.01, totals.realAsset || 0.01, totals.debt || 0.01]
        : [1],
      backgroundColor: hasData
        ? ["#3b82f6", "#22c55e", "#8b5cf6", "#f59e0b", "#ef4444"]
        : ["#e5e7eb"],
      borderWidth: 0,
    }],
  };

  // 부동산 유형별 데이터
  const realEstateBreakdown = useMemo(() => {
    const breakdown = new Map<string, number>();
    items
      .filter(i => i.category === "asset" && ["real_estate", "apartment", "house", "officetel", "land", "commercial"].includes(i.item_type))
      .forEach(item => {
        const current = breakdown.get(item.item_type) || 0;
        breakdown.set(item.item_type, current + item.amount);
      });
    return breakdown;
  }, [items]);

  const realEstateChartData = useMemo(() => {
    const colors = ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"];
    const hasRealEstate = totals.realEstate > 0;
    const entries = Array.from(realEstateBreakdown.entries()).filter(([, amount]) => amount > 0);

    return {
      labels: hasRealEstate ? entries.map(([type]) => ITEM_TYPES.realEstate.find(t => t.value === type)?.label || type) : ["데이터 없음"],
      datasets: [{
        data: hasRealEstate ? entries.map(([, amount]) => amount) : [1],
        backgroundColor: hasRealEstate ? colors.slice(0, entries.length) : ["#e5e7eb"],
        borderWidth: 0,
      }],
    };
  }, [realEstateBreakdown, totals.realEstate]);

  // 실물자산 유형별 데이터 (부동산 제외)
  const realAssetBreakdown = useMemo(() => {
    const breakdown = new Map<string, number>();
    items
      .filter(i => i.category === "asset" && ["car", "precious_metal", "art", "other"].includes(i.item_type))
      .forEach(item => {
        const current = breakdown.get(item.item_type) || 0;
        breakdown.set(item.item_type, current + item.amount);
      });
    return breakdown;
  }, [items]);

  const realAssetChartData = useMemo(() => {
    const colors = ["#f59e0b", "#fb923c", "#fbbf24", "#fcd34d"];
    const hasRealAsset = totals.realAsset > 0;
    const entries = Array.from(realAssetBreakdown.entries()).filter(([, amount]) => amount > 0);

    return {
      labels: hasRealAsset ? entries.map(([type]) => ITEM_TYPES.realAsset.find(t => t.value === type)?.label || type) : ["데이터 없음"],
      datasets: [{
        data: hasRealAsset ? entries.map(([, amount]) => amount) : [1],
        backgroundColor: hasRealAsset ? colors.slice(0, entries.length) : ["#e5e7eb"],
        borderWidth: 0,
      }],
    };
  }, [realAssetBreakdown, totals.realAsset]);

  // 부채 유형별 데이터
  const debtBreakdown = useMemo(() => {
    const breakdown = new Map<string, number>();
    items
      .filter(i => i.category === "debt")
      .forEach(item => {
        const current = breakdown.get(item.item_type) || 0;
        breakdown.set(item.item_type, current + item.amount);
      });
    return breakdown;
  }, [items]);

  const debtChartData = useMemo(() => {
    const colors = ["#ef4444", "#f87171", "#fca5a5", "#fecaca", "#fee2e2", "#fef2f2", "#dc2626", "#b91c1c"];
    const hasDebt = totals.debt > 0;
    const entries = Array.from(debtBreakdown.entries()).filter(([, amount]) => amount > 0);

    return {
      labels: hasDebt ? entries.map(([type]) => ITEM_TYPES.debt.find(t => t.value === type)?.label || type) : ["데이터 없음"],
      datasets: [{
        data: hasDebt ? entries.map(([, amount]) => amount) : [1],
        backgroundColor: hasDebt ? colors.slice(0, entries.length) : ["#e5e7eb"],
        borderWidth: 0,
      }],
    };
  }, [debtBreakdown, totals.debt]);

  const chartOptions = {
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    maintainAspectRatio: false,
    cutout: "85%",
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  // 항목 추가 (로컬 상태만 변경)
  const handleAddItem = () => {
    if (!currentSnapshot) return;
    if (activeTab === "profile" || activeTab === "savings" || activeTab === "investment") return;

    const category = activeTab === "debt" ? "debt" : "asset";
    const defaultType = ITEM_TYPES[activeTab][0].value;

    const tempItem: FinancialSnapshotItem = {
      id: `temp-${nextTempId}`,
      snapshot_id: currentSnapshot.id,
      category,
      item_type: defaultType,
      title: "",
      amount: 0,
      owner: "self",
      metadata: {},
      sort_order: localItems.length,
      created_at: new Date().toISOString(),
    };

    setLocalItems(prev => [...prev, tempItem]);
    setNextTempId(prev => prev + 1);
    setHasChanges(true);
  };

  // 항목 업데이트 (로컬 상태만 변경)
  const handleUpdateItem = (id: string, updates: Partial<FinancialSnapshotItem>) => {
    setLocalItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
    setHasChanges(true);
  };

  // 항목 삭제 (로컬 상태만 변경)
  const handleDeleteItem = (id: string) => {
    setLocalItems(prev => prev.filter(item => item.id !== id));
    // 실제 DB에 있는 항목만 삭제 대기열에 추가
    if (!id.startsWith("temp-")) {
      setPendingDeletes(prev => [...prev, id]);
    }
    setHasChanges(true);
  };

  // 부동산 추가 (거주용/투자용 구분)
  const handleAddRealEstate = (purpose: "residential" | "investment") => {
    if (!currentSnapshot) return;

    const tempItem: FinancialSnapshotItem = {
      id: `temp-${nextTempId}`,
      snapshot_id: currentSnapshot.id,
      category: "asset",
      item_type: "apartment",
      title: "",
      amount: 0,
      owner: "self",
      metadata: { purpose },
      sort_order: localItems.length,
      created_at: new Date().toISOString(),
    };

    setLocalItems(prev => [...prev, tempItem]);
    setNextTempId(prev => prev + 1);
    setHasChanges(true);
  };

  // 스냅샷 저장 (모든 변경사항 DB 반영)
  const handleSaveSnapshot = async () => {
    if (!currentSnapshot) return;

    try {
      // 1. 삭제 대기 항목 삭제
      for (const id of pendingDeletes) {
        await deleteMutation.mutateAsync(id);
      }

      // 2. 새로 추가된 항목 생성 / 수정된 항목 업데이트
      for (const item of localItems) {
        if (item.id.startsWith("temp-")) {
          // 새 항목 생성
          await createMutation.mutateAsync({
            snapshot_id: currentSnapshot.id,
            category: item.category,
            item_type: item.item_type,
            title: item.title,
            amount: item.amount,
            owner: item.owner,
          });
        } else {
          // 기존 항목 업데이트
          const original = dbItems.find(db => db.id === item.id);
          if (original && (
            original.item_type !== item.item_type ||
            original.title !== item.title ||
            original.amount !== item.amount
          )) {
            await updateMutation.mutateAsync({
              id: item.id,
              updates: {
                item_type: item.item_type,
                title: item.title,
                amount: item.amount,
              },
            });
          }
        }
      }

      // 3. 스냅샷 합계 저장
      await updateSnapshotMutation.mutateAsync({
        id: currentSnapshot.id,
        updates: {
          savings: totals.savings,
          investments: totals.investment,
          real_assets: totals.realEstate + totals.realAsset,
          total_assets: totals.totalAssets,
          total_debts: totals.debt,
          net_worth: totals.netWorth,
        },
      });

      console.log("[CurrentAssetTab] All changes saved successfully");
      setHasChanges(false);
      setPendingDeletes([]);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error("[CurrentAssetTab] Failed to save:", error);
    }
  };

  // 탭별 금액
  const getTabAmount = (tabId: TabType): number => {
    switch (tabId) {
      case "savings": return totals.savings;
      case "investment": return totals.investment;
      case "realEstate": return totals.realEstate;
      case "realAsset": return totals.realAsset;
      case "debt": return totals.debt;
      case "profile": return 0;
    }
  };

  // 스냅샷, 투자, 저축 데이터 로딩 중일 때 전체 스켈레톤 표시
  if (isLoading || !isInvestmentDataReady || !isSavingsDataReady) {
    return (
      <div className={styles.container}>
        {/* 헤더 스켈레톤 */}
        <div className={styles.header}>
          <div className={`${styles.skeleton} ${styles.skeletonDate}`} />
          <div className={`${styles.skeleton} ${styles.skeletonSaveBtn}`} />
        </div>

        {/* 차트 섹션 스켈레톤 */}
        <div className={styles.chartSection}>
          <div className={styles.chartWrapper}>
            <div className={`${styles.skeletonChartMain}`} />
          </div>
          <div className={styles.legendSection}>
            <div className={styles.legendItems}>
              {[1, 2, 3].map(i => (
                <div key={i} className={styles.legendItem}>
                  <span className={`${styles.skeleton} ${styles.skeletonDot}`} />
                  <span className={`${styles.skeleton} ${styles.skeletonLegendLabel}`} />
                  <span className={`${styles.skeleton} ${styles.skeletonLegendValue}`} />
                </div>
              ))}
            </div>
            <div className={styles.legendDivider} />
            <div className={styles.legendItem}>
              <span className={`${styles.skeleton} ${styles.skeletonDot}`} />
              <span className={`${styles.skeleton} ${styles.skeletonLegendLabel}`} />
              <span className={`${styles.skeleton} ${styles.skeletonLegendValue}`} />
            </div>
          </div>
          <div className={styles.subChartsGroup}>
            <div className={styles.chartCardSmall}>
              <div className={`${styles.skeletonChartSmall}`} />
            </div>
            <div className={styles.chartCardSmall}>
              <div className={`${styles.skeletonChartSmall}`} />
            </div>
          </div>
        </div>

        {/* 탭 스켈레톤 */}
        <div className={styles.tabsSection}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonTab}`} />
          ))}
        </div>

        {/* 콘텐츠 스켈레톤 */}
        <div className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <span className={`${styles.skeleton} ${styles.skeletonSectionTitle}`} />
            <span className={`${styles.skeleton} ${styles.skeletonTotal}`} />
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th><span className={`${styles.skeleton} ${styles.skeletonTableHeader}`} /></th>
                  <th className={styles.amountHeader}><span className={`${styles.skeleton} ${styles.skeletonTableHeader}`} /></th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map(i => (
                  <tr key={i}>
                    <td><span className={`${styles.skeleton} ${styles.skeletonName}`} /></td>
                    <td className={styles.amountCell}><span className={`${styles.skeleton} ${styles.skeletonAmount}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 헤더: 오늘 날짜 + 저장 버튼 */}
      <div className={styles.header}>
        <span className={styles.dateLabel}>{formatDate(new Date().toISOString())}</span>

        <button
          className={`${styles.saveButton} ${isSaved ? styles.saved : ""}`}
          onClick={handleSaveSnapshot}
          disabled={updateSnapshotMutation.isPending || createMutation.isPending || deleteMutation.isPending || isSaved}
        >
          {isSaved ? "저장됨" : updateSnapshotMutation.isPending || createMutation.isPending || deleteMutation.isPending ? "저장 중..." : "현재 자산 저장"}
        </button>
      </div>

      {/* 차트 섹션 */}
      <div className={styles.chartSection}>
        {/* 메인: 순자산 차트 + 범례 */}
        <div className={styles.chartWrapper}>
          <div className={styles.chartBoxMain}>
            <Doughnut data={chartData} options={chartOptions} />
            <div className={styles.chartCenter}>
              <span className={styles.chartLabel}>순자산</span>
              <span className={styles.chartAmount}>{formatMoney(totals.netWorth)}</span>
            </div>
          </div>
        </div>

        <div className={styles.legendSection}>
          <div className={styles.legendItems}>
            {TABS.filter(t => t.id !== "debt" && t.id !== "profile").map(tab => (
              <div key={tab.id} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: tab.color }} />
                <span className={styles.legendLabel}>{tab.label}</span>
                <span className={styles.legendValue}>{formatMoney(getTabAmount(tab.id))}</span>
                {totals.totalAssets > 0 && (
                  <span className={styles.legendPercent}>
                    {Math.round((getTabAmount(tab.id) / totals.totalAssets) * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className={styles.legendDivider} />
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: "#ef4444" }} />
            <span className={styles.legendLabel}>부채</span>
            <span className={styles.legendValue} style={{ color: "#ef4444" }}>
              -{formatMoney(totals.debt)}
            </span>
          </div>
        </div>

        {/* 서브 차트들 */}
        <div className={styles.subChartsGroup}>
          <div className={styles.chartCardSmall}>
            <div className={styles.chartBoxSmall}>
              <Doughnut data={realAssetChartData} options={chartOptions} />
              <div className={styles.chartCenter}>
                <span className={styles.chartLabelSmall}>실물자산</span>
                <span className={styles.chartAmountSmall}>{formatMoney(totals.realAsset)}</span>
              </div>
            </div>
          </div>

          <div className={styles.chartCardSmall}>
            <div className={styles.chartBoxSmall}>
              <Doughnut data={debtChartData} options={chartOptions} />
              <div className={styles.chartCenter}>
                <span className={styles.chartLabelSmall}>부채</span>
                <span className={styles.chartAmountSmall} style={{ color: "#ef4444" }}>
                  {formatMoney(totals.debt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 카테고리 탭 - 레퍼런스 스타일 */}
      <div className={styles.tabsSection}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const amount = getTabAmount(tab.id);
          return (
            <button
              key={tab.id}
              className={`${styles.tabButton} ${isActive ? styles.active : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.id === "profile" ? (
                <User className={styles.tabIcon} size={24} />
              ) : (
                <span className={styles.tabAmount}>{formatMoney(amount)}</span>
              )}
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 콘텐츠 섹션 */}
      <div key={activeTab} className={styles.contentSection}>
        {activeTab === "savings" ? (
          /* 저축 탭 - 가계부 + 정기예금/적금 연동 */
          <div className={styles.investmentSection}>
            {savingsAccountValues.length > 0 ? (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>
                        <div className={styles.tableHeaderWithBadge}>
                          계좌
                          <span className={styles.linkedBadgeSmall}>
                            <Link2 size={10} />
                            가계부 / 정기 예금적금에서 연동됨
                          </span>
                        </div>
                      </th>
                      <th className={styles.amountHeader}>평가금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savingsAccountValues.map(data => (
                      <tr key={data.id}>
                        <td>
                          <div className={styles.accountCell}>
                            <div className={styles.accountNameRow}>
                              <span className={styles.accountName}>{data.name}</span>
                              <span className={styles.accountTypeLabel}>
                                {data.type === "checking" ? "입출금" :
                                 data.type === "deposit" ? "예금" :
                                 data.type === "housing" ? "청약" :
                                 data.type === "free_savings" ? "자유적금" : "적금"}
                              </span>
                            </div>
                            <span className={styles.brokerName}>{data.broker}</span>
                          </div>
                        </td>
                        <td className={styles.amountCell}>
                          {formatWon(data.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p>등록된 저축 계좌가 없습니다</p>
              </div>
            )}

            {/* 하단: 관리 버튼 + 합계 */}
            <div className={styles.sectionFooterWithButtons}>
              <div className={styles.footerButtons}>
                <button className={styles.footerLinkButton} onClick={() => onNavigate?.("household-budget")}>
                  가계부 관리
                </button>
                <button className={styles.footerLinkButton} onClick={() => onNavigate?.("savings-deposits")}>
                  예금/적금 관리
                </button>
              </div>
              <div className={styles.footerTotalGroup}>
                <span className={styles.footerTotalLabel}>합계</span>
                <span className={styles.footerTotalValue}>{formatWon(linkedSavingsTotalWon)}</span>
              </div>
            </div>
          </div>
        ) : activeTab === "investment" ? (
          /* 투자 탭 - 포트폴리오 연동 */
          <div className={styles.investmentSection}>
            {accountValues.size > 0 ? (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>
                        <div className={styles.tableHeaderWithBadge}>
                          계좌
                          <span className={styles.linkedBadgeSmall}>
                            <Link2 size={10} />
                            포트폴리오에서 연동됨
                          </span>
                        </div>
                      </th>
                      <th className={styles.amountHeader}>평가금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(accountValues.entries()).map(([id, data]) => (
                      <tr key={id}>
                        <td>
                          <div className={styles.accountCell}>
                            <div className={styles.accountNameRow}>
                              <span className={styles.accountName}>{data.accountName}</span>
                              <span className={styles.accountTypeLabel}>증권</span>
                            </div>
                            <span className={styles.brokerName}>{data.broker}</span>
                          </div>
                        </td>
                        <td className={styles.amountCell}>
                          {formatWon(Math.round(data.value))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p>등록된 투자 내역이 없습니다</p>
              </div>
            )}

            {/* 하단: 관리 버튼 + 합계 */}
            <div className={styles.sectionFooterWithButtons}>
              <div className={styles.footerButtons}>
                <button className={styles.footerLinkButton} onClick={() => onNavigate?.("portfolio")}>
                  포트폴리오 관리
                </button>
              </div>
              <div className={styles.footerTotalGroup}>
                <span className={styles.footerTotalLabel}>합계</span>
                <span className={styles.footerTotalValue}>{formatWon(investmentTotalWon)}</span>
              </div>
            </div>
          </div>
        ) : activeTab === "realEstate" ? (
          /* 부동산 탭 - 거주용/투자용 구분 */
          <div className={styles.realEstateSection}>
            {/* 거주용 부동산 */}
            <div className={styles.realEstateGroup}>
              <div className={styles.realEstateGroupHeader}>
                <span className={styles.realEstateGroupTitle}>거주용</span>
                <span className={styles.realEstateGroupDesc}>내가 거주하는 자가 주택</span>
              </div>
              <div className={styles.realEstateList}>
                {currentItems
                  .filter(item => (item.metadata as Record<string, unknown>)?.purpose === "residential")
                  .map(item => (
                    <div key={item.id} className={styles.realEstateCard}>
                      <div className={styles.realEstateInfo}>
                        <select
                          className={styles.selectInputSmall}
                          value={item.item_type}
                          onChange={e => handleUpdateItem(item.id, { item_type: e.target.value })}
                        >
                          {ITEM_TYPES.realEstate.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          className={styles.textInputInline}
                          placeholder="별명 (예: 강남 아파트)"
                          value={item.title}
                          onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                        />
                      </div>
                      <div className={styles.realEstateAmountGroup}>
                        <div className={styles.fieldGroup}>
                          <input
                            type="number"
                            className={styles.fieldGroupInput}
                            placeholder="0"
                            value={item.amount || ""}
                            onChange={e => handleUpdateItem(item.id, { amount: parseInt(e.target.value) || 0 })}
                            onWheel={e => (e.target as HTMLElement).blur()}
                          />
                          <span className={styles.unit}>만원</span>
                        </div>
                      </div>
                      <button className={styles.deleteBtn} onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
              </div>
              <button
                className={styles.addButtonSmall}
                onClick={() => handleAddRealEstate("residential")}
              >
                <Plus size={14} />
                거주용 추가
              </button>
            </div>

            {/* 투자/임대 부동산 */}
            <div className={styles.realEstateGroup}>
              <div className={styles.realEstateGroupHeader}>
                <span className={styles.realEstateGroupTitle}>투자/임대</span>
                <span className={styles.realEstateGroupDesc}>임대 수익 목적 부동산</span>
              </div>
              <div className={styles.realEstateList}>
                {currentItems
                  .filter(item => (item.metadata as Record<string, unknown>)?.purpose === "investment")
                  .map(item => (
                    <div key={item.id} className={styles.realEstateCard}>
                      <div className={styles.realEstateInfo}>
                        <select
                          className={styles.selectInputSmall}
                          value={item.item_type}
                          onChange={e => handleUpdateItem(item.id, { item_type: e.target.value })}
                        >
                          {ITEM_TYPES.realEstate.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          className={styles.textInputInline}
                          placeholder="별명 (예: 성수 오피스텔)"
                          value={item.title}
                          onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                        />
                      </div>
                      <div className={styles.realEstateAmountGroup}>
                        <div className={styles.fieldGroup}>
                          <input
                            type="number"
                            className={styles.fieldGroupInput}
                            placeholder="0"
                            value={item.amount || ""}
                            onChange={e => handleUpdateItem(item.id, { amount: parseInt(e.target.value) || 0 })}
                            onWheel={e => (e.target as HTMLElement).blur()}
                          />
                          <span className={styles.unit}>만원</span>
                        </div>
                      </div>
                      <button className={styles.deleteBtn} onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
              </div>
              <button
                className={styles.addButtonSmall}
                onClick={() => handleAddRealEstate("investment")}
              >
                <Plus size={14} />
                투자용 추가
              </button>
            </div>

            {/* 하단 합계 */}
            {totals.realEstate > 0 && (
              <div className={styles.sectionFooter}>
                <span className={styles.footerTotalLabel}>합계</span>
                <span className={styles.footerTotalValue}>{formatMoney(totals.realEstate)}</span>
              </div>
            )}
          </div>
        ) : activeTab === "profile" ? (
          /* 프로필 탭 */
          <div className={styles.simpleSection}>
            <div className={styles.simpleSectionHeader}>
              <span className={styles.simpleSectionTitle}>프로필</span>
            </div>
            <div className={styles.profileContent}>
              <p>프로필 정보는 설정에서 관리할 수 있습니다</p>
              <button className={styles.profileLinkButton} onClick={() => onNavigate?.("settings")}>
                설정으로 이동
              </button>
            </div>
          </div>
        ) : activeTab === "realAsset" ? (
          /* 실물자산 탭 */
          <div className={styles.simpleSection}>
            <div className={styles.simpleSectionHeader}>
              <span className={styles.simpleSectionTitle}>실물 자산</span>
              <span className={styles.simpleSectionDesc}>자동차, 귀금속, 미술품 등</span>
            </div>
            <div className={styles.simpleList}>
              {currentItems.map(item => (
                <div key={item.id} className={styles.simpleRow}>
                  <div className={styles.simpleRowInfo}>
                    <select
                      className={styles.selectInputSmall}
                      value={item.item_type}
                      onChange={e => handleUpdateItem(item.id, { item_type: e.target.value })}
                    >
                      {ITEM_TYPES.realAsset.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className={styles.textInputInline}
                      placeholder="메모 (예: 2020 그랜저)"
                      value={item.title}
                      onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                    />
                  </div>
                  <div className={styles.simpleRowAmount}>
                    <input
                      type="number"
                      className={styles.fieldGroupInput}
                      placeholder="0"
                      value={item.amount || ""}
                      onChange={e => handleUpdateItem(item.id, { amount: parseInt(e.target.value) || 0 })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                  <button className={styles.deleteBtn} onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button className={styles.addButtonSmall} onClick={handleAddItem}>
              <Plus size={14} />
              실물 자산 추가
            </button>
            {totals.realAsset > 0 && (
              <div className={styles.sectionFooter}>
                <span className={styles.footerTotalLabel}>합계</span>
                <span className={styles.footerTotalValue}>{formatMoney(totals.realAsset)}</span>
              </div>
            )}
          </div>
        ) : activeTab === "debt" ? (
          /* 부채 탭 */
          <div className={styles.simpleSection}>
            <div className={styles.simpleSectionHeader}>
              <span className={styles.simpleSectionTitle}>부채</span>
              <span className={styles.simpleSectionDesc}>대출, 카드대출, 할부금 등</span>
            </div>
            <div className={styles.simpleList}>
              {currentItems.map(item => (
                <div key={item.id} className={styles.simpleRow}>
                  <div className={styles.simpleRowInfo}>
                    <select
                      className={styles.selectInputSmall}
                      value={item.item_type}
                      onChange={e => handleUpdateItem(item.id, { item_type: e.target.value })}
                    >
                      {ITEM_TYPES.debt.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className={styles.textInputInline}
                      placeholder="메모 (예: 신한은행)"
                      value={item.title}
                      onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                    />
                  </div>
                  <div className={styles.simpleRowAmount}>
                    <input
                      type="number"
                      className={styles.fieldGroupInput}
                      placeholder="0"
                      value={item.amount || ""}
                      onChange={e => handleUpdateItem(item.id, { amount: parseInt(e.target.value) || 0 })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                  <button className={styles.deleteBtn} onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button className={styles.addButtonSmall} onClick={handleAddItem}>
              <Plus size={14} />
              부채 추가
            </button>
            {totals.debt > 0 && (
              <div className={styles.sectionFooter}>
                <span className={styles.footerTotalLabel}>합계</span>
                <span className={styles.footerTotalValue}>{formatMoney(totals.debt)}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
