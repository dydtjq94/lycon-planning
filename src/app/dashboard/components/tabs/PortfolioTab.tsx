"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit2,
  Search,
  X,
} from "lucide-react";

// 종목 데이터 타입
interface StockItem {
  code: string;
  name: string;
  ticker: string;
  market: string;
  country: string;
}
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { createClient } from "@/lib/supabase/client";
import {
  getStockData,
  getExchangeRate,
  checkApiHealth,
  type StockData,
} from "@/lib/services/financeApiService";
import {
  usePortfolioChartPriceData,
  type PortfolioPriceCache,
} from "@/hooks/useFinancialData";
import { useChartTheme } from "@/hooks/useChartTheme";
import type {
  PortfolioTransaction,
  PortfolioTransactionInput,
  PortfolioHolding,
  PortfolioAssetType,
  PortfolioTransactionType,
  PortfolioCurrency,
  PortfolioAccount,
  PortfolioAccountInput,
  AccountType,
} from "@/types/tables";
import { formatWon } from "@/lib/utils";
import { calculatePortfolioAccountValues } from "@/lib/utils/accountValueCalculator";
import styles from "./PortfolioTab.module.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const ASSET_TYPE_LABELS: Record<PortfolioAssetType, string> = {
  domestic_stock: "국내주식",
  foreign_stock: "해외주식",
  domestic_etf: "국내ETF",
  foreign_etf: "해외ETF",
  etf: "ETF",
  crypto: "암호화폐",
  fund: "펀드",
  bond: "채권",
  other: "기타",
};

interface PortfolioTabProps {
  profileId: string;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  setSearchLoading?: (loading: boolean) => void;
  onSearchTrigger?: (fn: () => void) => void;
}

// 증권사/은행 목록
const BROKER_OPTIONS = [
  "키움증권",
  "삼성증권",
  "미래에셋증권",
  "NH투자증권",
  "한국투자증권",
  "KB증권",
  "신한투자증권",
  "토스증권",
  "카카오페이증권",
  "IBK투자증권",
  "대신증권",
  "하나증권",
  "국민은행",
  "신한은행",
  "하나은행",
  "우리은행",
  "NH농협은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "기타",
];

// 계좌 유형 옵션
const ACCOUNT_TYPE_OPTIONS = [
  { value: "general", label: "일반 증권", category: "investment" },
  { value: "isa", label: "ISA", category: "investment" },
  { value: "pension_savings", label: "연금저축", category: "investment" },
  { value: "irp", label: "IRP", category: "investment" },
  { value: "dc", label: "DC형 퇴직연금", category: "investment" },
  { value: "checking", label: "입출금", category: "bank" },
  { value: "savings", label: "적금", category: "bank" },
  { value: "deposit", label: "정기예금", category: "bank" },
] as const;

export function PortfolioTab({
  profileId,
  searchQuery = "",
  setSearchQuery,
  setSearchLoading,
  onSearchTrigger,
}: PortfolioTabProps) {
  const { chartLineColors, chartScaleColors, toRgba, isReady: isThemeReady, isDark } = useChartTheme();
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<"holdings" | "transactions" | null>("holdings");

  // 보유 종목 정렬
  type HoldingSortType = "latest" | "value" | "profit";
  const [holdingSort, setHoldingSort] = useState<HoldingSortType>("value");

  // 증권 계좌 상태
  const [accounts, setAccounts] = useState<PortfolioAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]); // 빈 배열 = 전체
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountFormData, setAccountFormData] = useState<Partial<PortfolioAccountInput>>({
    broker_name: "",
    name: "",
    account_number: "",
    account_type: "general",
    is_default: false,
  });

  // 종목 데이터 (자동완성용)
  const [stocksList, setStocksList] = useState<StockItem[]>([]);
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const holdingPanelRef = useRef<HTMLDivElement>(null);

  // 티커 검색 상태
  const [searchTicker, setSearchTicker] = useState("");
  const [searchResult, setSearchResult] = useState<{
    symbol: string;
    name?: string;
    price: number;
    change: number;
    changePercent: number;
    data: StockData[];
    dataDate: string; // 데이터 기준 날짜
  } | null>(null);
  const [searchLoadingLocal, setSearchLoadingLocal] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);
  const [isSearchPanelClosing, setIsSearchPanelClosing] = useState(false);

  // 보유 종목 상세 패널
  const [selectedHolding, setSelectedHolding] = useState<PortfolioHolding | null>(null);
  const [isHoldingPanelClosing, setIsHoldingPanelClosing] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // 패널 닫기 (애니메이션 포함)
  const closeSearchPanel = useCallback(() => {
    setIsSearchPanelClosing(true);
    setTimeout(() => {
      setSearchResult(null);
      setIsSearchPanelClosing(false);
    }, 200);
  }, []);

  // ESC key handler for search panel
  useEffect(() => {
    if (!searchResult) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearchPanel();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [searchResult, closeSearchPanel]);

  // 보유 종목 패널 닫기
  const closeHoldingPanel = useCallback(() => {
    setIsHoldingPanelClosing(true);
    setTimeout(() => {
      setSelectedHolding(null);
      setIsHoldingPanelClosing(false);
    }, 200);
  }, []);

  // ESC key handler for holding panel
  useEffect(() => {
    if (!selectedHolding) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHoldingPanel();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedHolding, closeHoldingPanel]);

  // Click-outside handler for search panel
  useEffect(() => {
    if (!searchResult) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchPanelRef.current && !searchPanelRef.current.contains(e.target as Node)) {
        closeSearchPanel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchResult, closeSearchPanel]);

  // Click-outside handler for holding panel
  useEffect(() => {
    if (!selectedHolding) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (holdingPanelRef.current && !holdingPanelRef.current.contains(e.target as Node)) {
        closeHoldingPanel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedHolding, closeHoldingPanel]);

  // ESC key handler for transaction modal
  useEffect(() => {
    if (!showAddForm) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showAddForm]);

  // Click-outside handler for transaction modal
  useEffect(() => {
    if (!showAddForm) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleCancel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddForm]);

  // 폼 상태
  const [formData, setFormData] = useState<Partial<PortfolioTransactionInput>>({
    type: "buy",
    asset_type: "domestic_stock",
    fee: 0,
    account_id: null,
  });

  // 달러 단가 입력용 (별도 관리)
  const [usdPriceInput, setUsdPriceInput] = useState("");

  const supabase = createClient();

  // 주가 데이터 캐시 (react-query로 관리 - 탭 전환해도 유지)
  const { data: priceCache, isLoading: priceCacheLoading } = usePortfolioChartPriceData(
    profileId,
    transactions,
    transactions.length > 0
  );

  // API 헬스 체크
  useEffect(() => {
    checkApiHealth().then(setIsApiHealthy);
  }, []);

  // 종목 데이터 로드
  useEffect(() => {
    fetch("/data/stocks.json")
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setStocksList(json.data);
        }
      })
      .catch(console.error);
  }, []);

  // 자동완성 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 증권 계좌 로드
  useEffect(() => {
    loadAccounts();
  }, [profileId]);

  const loadAccounts = async () => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .in("account_type", ["general", "isa", "pension_savings", "irp", "dc"]) // 증권 계좌만
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setAccounts(data);
    }
  };

  // 계좌 선택 토글
  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds((prev) => {
      if (prev.includes(accountId)) {
        return prev.filter((id) => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  };

  // 계좌 저장
  const handleSaveAccount = async () => {
    if (!accountFormData.name || !accountFormData.broker_name) {
      alert("계좌명과 증권사를 입력해주세요.");
      return;
    }

    const payload: PortfolioAccountInput = {
      profile_id: profileId,
      name: accountFormData.name,
      broker_name: accountFormData.broker_name,
      account_number: accountFormData.account_number || null,
      account_type: accountFormData.account_type || "general",
      is_default: accountFormData.is_default || false,
    };

    // 기본 계좌로 설정 시 기존 기본 계좌 해제
    if (payload.is_default) {
      await supabase
        .from("accounts")
        .update({ is_default: false })
        .eq("profile_id", profileId)
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

  const handleEditAccount = (account: PortfolioAccount) => {
    setAccountFormData({
      name: account.name,
      broker_name: account.broker_name,
      account_number: account.account_number || "",
      account_type: account.account_type || "general",
      is_default: account.is_default,
    });
    setEditingAccountId(account.id);
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("이 계좌를 삭제하시겠습니까? 관련 거래 내역은 계좌 미지정으로 변경됩니다.")) return;

    // 계좌 비활성화 (soft delete)
    const { error } = await supabase
      .from("accounts")
      .update({ is_active: false })
      .eq("id", id);

    if (!error) {
      setSelectedAccountIds((prev) => prev.filter((aid) => aid !== id));
      loadAccounts();
    }
  };

  const resetAccountForm = () => {
    setAccountFormData({
      broker_name: "",
      name: "",
      account_number: "",
      account_type: "general",
      is_default: false,
    });
    setEditingAccountId(null);
  };

  // 자동완성 필터링
  const filterSuggestions = useCallback(
    (query: string) => {
      if (!query.trim() || stocksList.length === 0) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const q = query.toLowerCase();
      const filtered = stocksList
        .filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q) ||
            s.ticker.toLowerCase().includes(q)
        )
        .slice(0, 10); // 최대 10개

      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    },
    [stocksList]
  );

  // 자동완성 항목 선택
  const selectSuggestion = (stock: StockItem) => {
    setSearchTicker(stock.ticker);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // 거래 내역 로드
  useEffect(() => {
    loadTransactions();
  }, [profileId]);

  const loadTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("portfolio_transactions")
      .select("*")
      .eq("profile_id", profileId)
      .order("trade_date", { ascending: false });

    if (!error && data) {
      setTransactions(data);
    }
    setLoading(false);
  };

  // 헤더 검색과 동기화
  useEffect(() => {
    if (searchQuery) {
      setSearchTicker(searchQuery);
    }
  }, [searchQuery]);

  // 티커 검색
  const handleSearch = useCallback(async () => {
    // 헤더에서 전달된 searchQuery 또는 로컬 searchTicker 사용
    const query = searchQuery || searchTicker;
    if (!query.trim()) return;

    setSearchLoadingLocal(true);
    setSearchLoading?.(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const res = await getStockData(query.trim(), { days: 90 });

      if (res.data.length > 0) {
        const latest = res.data[res.data.length - 1];
        const previous = res.data.length > 1 ? res.data[res.data.length - 2] : latest;
        const change = latest.Close - previous.Close;
        const changePercent = (change / previous.Close) * 100;

        // 종목명 찾기
        const stockInfo = stocksList.find(
          (s) => s.ticker.toUpperCase() === res.symbol.toUpperCase()
        );

        setSearchResult({
          symbol: res.symbol,
          name: stockInfo?.name,
          price: latest.Close,
          change,
          changePercent,
          data: res.data,
          dataDate: latest.Date,
        });
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "검색 실패");
    } finally {
      setSearchLoadingLocal(false);
      setSearchLoading?.(false);
    }
  }, [searchQuery, searchTicker, setSearchLoading]);

  // 헤더 검색 버튼과 연결
  useEffect(() => {
    if (onSearchTrigger) {
      onSearchTrigger(handleSearch);
    }
  }, [onSearchTrigger, handleSearch]);

  // 검색 결과로 폼 채우기
  const applySearchResult = () => {
    if (!searchResult) return;

    // 티커 형식으로 자산 유형 판별
    let assetType: PortfolioAssetType = "other";

    // stocks.json에서 종목 정보 찾기
    const stockInfo = stocksList.find(
      (s) => s.ticker.toUpperCase() === searchResult.symbol.toUpperCase()
    );

    if (searchResult.symbol.endsWith(".KS") || searchResult.symbol.endsWith(".KQ")) {
      // 국내: ETF인지 주식인지 구분
      if (stockInfo?.market === "ETF") {
        assetType = "domestic_etf";
      } else {
        assetType = "domestic_stock";
      }
    } else if (searchResult.symbol.includes("-USD") || searchResult.symbol.includes("-KRW")) {
      assetType = "crypto";
    } else {
      // 해외: ETF인지 주식인지 구분
      if (stockInfo?.market === "ETF") {
        assetType = "foreign_etf";
      } else {
        assetType = "foreign_stock";
      }
    }

    const stockName = stockInfo?.name || searchResult.symbol.split(".")[0];

    // 기본 계좌 찾기
    const defaultAccount = accounts.find((a) => a.is_default);

    // 국내 vs 해외 구분
    const isKorean = assetType === "domestic_stock" || assetType === "domestic_etf";

    if (isKorean) {
      // 국내: 원화 가격 그대로 입력
      setFormData({
        ...formData,
        ticker: searchResult.symbol,
        name: stockName,
        price: searchResult.price,
        asset_type: assetType,
        account_id: defaultAccount?.id || null,
      });
      setUsdPriceInput("");
    } else {
      // 해외: 달러 가격 입력, 최신 환율 적용 (없으면 1450)
      let defaultExchangeRate = 1450;
      if (priceCache?.exchangeRateMap.size) {
        const sortedFxDates = Array.from(priceCache.exchangeRateMap.keys()).sort();
        defaultExchangeRate = Math.round((priceCache.exchangeRateMap.get(sortedFxDates[sortedFxDates.length - 1]) || 1450) * 100) / 100;
      }
      setUsdPriceInput(searchResult.price.toFixed(2));
      setFormData({
        ...formData,
        ticker: searchResult.symbol,
        name: stockName,
        price: Math.round(searchResult.price * defaultExchangeRate),
        exchange_rate: defaultExchangeRate,
        asset_type: assetType,
        account_id: defaultAccount?.id || null,
      });
    }

    setShowAddForm(true);
    setSearchResult(null);
    setSearchTicker("");
  };

  // 선택된 계좌로 필터링된 거래 내역
  const filteredTransactions = useMemo(() => {
    if (selectedAccountIds.length === 0) {
      return transactions; // 전체 보기
    }
    return transactions.filter((tx) => tx.account_id && selectedAccountIds.includes(tx.account_id));
  }, [transactions, selectedAccountIds]);

  // 보유 종목 계산
  const holdings = useMemo<PortfolioHolding[]>(() => {
    const holdingsMap = new Map<string, PortfolioHolding>();

    // 날짜순 정렬 (오래된 것부터 처리해야 매도가 정확히 계산됨)
    const sortedTransactions = [...filteredTransactions].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    );

    sortedTransactions.forEach((tx) => {
      const key = tx.ticker;
      const existing = holdingsMap.get(key);

      // 원 단위로 계산 (반올림 없이)
      const txTotalWon = tx.quantity * tx.price;

      if (!existing) {
        if (tx.type === "buy") {
          holdingsMap.set(key, {
            ticker: tx.ticker,
            name: tx.name,
            asset_type: tx.asset_type as PortfolioAssetType,
            quantity: tx.quantity,
            avg_price: tx.price,
            total_invested: txTotalWon, // 원 단위
            currency: tx.currency as PortfolioCurrency,
          });
        }
      } else {
        if (tx.type === "buy") {
          const newTotalQty = existing.quantity + tx.quantity;
          const newTotalInvested = existing.total_invested + txTotalWon;
          existing.avg_price = newTotalInvested / newTotalQty;
          existing.quantity = newTotalQty;
          existing.total_invested = newTotalInvested;
        } else {
          existing.quantity -= tx.quantity;
          // 매도 시 투자금액 비례 차감
          const sellRatio = tx.quantity / (existing.quantity + tx.quantity);
          existing.total_invested *= (1 - sellRatio);
        }
      }
    });

    // 수량이 0 이하인 종목 제거
    return Array.from(holdingsMap.values()).filter((h) => h.quantity > 0);
  }, [filteredTransactions]);

  // 총 투자금액
  const totalInvested = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.total_invested, 0);
  }, [holdings]);

  // 종목별 계좌 ID 맵 (매도 시 계좌 자동 선택용)
  const tickerAccountMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    filteredTransactions.forEach((tx) => {
      if (tx.type === "buy" && tx.account_id) {
        const existing = map.get(tx.ticker);
        if (existing) {
          existing.add(tx.account_id);
        } else {
          map.set(tx.ticker, new Set([tx.account_id]));
        }
      }
    });
    return map;
  }, [filteredTransactions]);

  // 매도 폼 열기
  const openSellForm = useCallback((holding: PortfolioHolding) => {
    closeHoldingPanel();
    setTimeout(() => {
      // 해당 종목이 속한 계좌 확인
      const accountIds = tickerAccountMap.get(holding.ticker);
      const autoAccountId = accountIds && accountIds.size === 1
        ? Array.from(accountIds)[0]
        : null;

      // 해외주식인 경우 환율과 달러 단가 계산
      const isForeign = holding.asset_type === "foreign_stock" || holding.asset_type === "foreign_etf";
      let exchangeRate = 1450; // 기본값

      if (isForeign && priceCache?.exchangeRateMap.size) {
        const sortedFxDates = Array.from(priceCache.exchangeRateMap.keys()).sort();
        const latestFxDate = sortedFxDates[sortedFxDates.length - 1];
        exchangeRate = Math.round((priceCache.exchangeRateMap.get(latestFxDate) || 1450) * 100) / 100;
      }

      // 현재 시장가가 있으면 시장가, 없으면 평단가 사용
      let currentMarketPrice = 0;
      const tickerPrices = priceCache?.priceDataMap.get(holding.ticker);
      if (tickerPrices && tickerPrices.size > 0) {
        const sortedDates = Array.from(tickerPrices.keys()).sort();
        currentMarketPrice = tickerPrices.get(sortedDates[sortedDates.length - 1]) || 0;
      }
      const sellPrice = currentMarketPrice > 0
        ? (isForeign ? Math.round(currentMarketPrice * exchangeRate) : Math.round(currentMarketPrice))
        : Math.round(holding.avg_price);

      const usdPrice = isForeign
        ? (sellPrice / exchangeRate).toFixed(2)
        : "";
      setUsdPriceInput(usdPrice);

      // 오늘 날짜 (YYYY-MM-DD)
      const today = new Date().toISOString().split("T")[0];

      setFormData({
        type: "sell",
        ticker: holding.ticker,
        name: holding.name,
        asset_type: holding.asset_type,
        currency: holding.currency,
        quantity: holding.quantity,
        price: sellPrice,
        exchange_rate: isForeign ? exchangeRate : undefined,
        fee: 0,
        account_id: autoAccountId,
        trade_date: today,
      });
      setShowAddForm(true);
      setEditingId(null);
    }, 300);
  }, [closeHoldingPanel, tickerAccountMap, priceCache]);

  // 종목별 최신 거래일 맵
  const latestTradeDateMap = useMemo(() => {
    const map = new Map<string, string>();
    filteredTransactions.forEach((tx) => {
      const current = map.get(tx.ticker);
      if (!current || tx.trade_date > current) {
        map.set(tx.ticker, tx.trade_date);
      }
    });
    return map;
  }, [filteredTransactions]);

  // 현재 평가금액 (캐시된 주가 데이터에서 계산)
  const valueLoading = priceCacheLoading;

  const { currentValue, holdingValues } = useMemo(() => {
    if (!priceCache || holdings.length === 0) {
      return { currentValue: null, holdingValues: new Map<string, { value: number; price: number }>() };
    }

    const { priceDataMap, exchangeRateMap, tickerCurrencyMap } = priceCache;
    const newHoldingValues = new Map<string, { value: number; price: number }>();

    // 가장 최근 환율 찾기
    let latestExchangeRate = 1;
    if (exchangeRateMap.size > 0) {
      const sortedFxDates = Array.from(exchangeRateMap.keys()).sort();
      const latestFxDate = sortedFxDates[sortedFxDates.length - 1];
      latestExchangeRate = exchangeRateMap.get(latestFxDate) || 1400;
    }

    let totalValue = 0;
    holdings.forEach((holding) => {
      const tickerPrices = priceDataMap.get(holding.ticker);

      // 가장 최근 가격 찾기
      let latestPrice = 0;
      if (tickerPrices && tickerPrices.size > 0) {
        const sortedDates = Array.from(tickerPrices.keys()).sort();
        const latestDate = sortedDates[sortedDates.length - 1];
        latestPrice = tickerPrices.get(latestDate) || 0;
      }

      if (latestPrice > 0) {
        const isForeign = holding.asset_type === "foreign_stock" || holding.asset_type === "foreign_etf";
        const holdingValue = isForeign && holding.currency === "USD"
          ? holding.quantity * latestPrice * latestExchangeRate
          : holding.quantity * latestPrice;

        totalValue += holdingValue;
        newHoldingValues.set(holding.ticker, { value: holdingValue, price: latestPrice });
      } else {
        totalValue += holding.total_invested;
        newHoldingValues.set(holding.ticker, { value: holding.total_invested, price: 0 });
      }
    });

    return { currentValue: totalValue, holdingValues: newHoldingValues };
  }, [priceCache, holdings]);

  // 손익 계산
  const profitLoss = currentValue !== null ? currentValue - totalInvested : null;
  const profitLossRate = currentValue !== null && totalInvested > 0
    ? ((currentValue - totalInvested) / totalInvested) * 100
    : null;

  // 계좌별 평가금액 계산 (유틸리티 함수 사용)
  const accountValues = useMemo(() => {
    return calculatePortfolioAccountValues(transactions, priceCache);
  }, [priceCache, transactions]);

  // 계좌별 투자금액 계산
  const accountInvested = useMemo(() => {
    const invested = new Map<string, number>();

    accounts.forEach((account) => {
      const accountTxs = transactions
        .filter((tx) => tx.account_id === account.id)
        .sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());
      const holdingsMap = new Map<string, { quantity: number; totalInvested: number; avgPrice: number }>();

      accountTxs.forEach((tx) => {
        const existing = holdingsMap.get(tx.ticker);
        if (!existing) {
          if (tx.type === "buy") {
            holdingsMap.set(tx.ticker, {
              quantity: tx.quantity,
              totalInvested: tx.quantity * tx.price,
              avgPrice: tx.price,
            });
          }
        } else {
          if (tx.type === "buy") {
            const newQty = existing.quantity + tx.quantity;
            const newInvested = existing.totalInvested + tx.quantity * tx.price;
            existing.quantity = newQty;
            existing.totalInvested = newInvested;
            existing.avgPrice = newQty > 0 ? newInvested / newQty : 0;
          } else {
            const sellAmount = tx.quantity * existing.avgPrice;
            existing.quantity -= tx.quantity;
            existing.totalInvested = Math.max(0, existing.totalInvested - sellAmount);
          }
        }
      });

      let accountTotal = 0;
      holdingsMap.forEach((holding) => {
        if (holding.quantity > 0) {
          accountTotal += holding.totalInvested;
        }
      });

      invested.set(account.id, accountTotal);
    });

    return invested;
  }, [accounts, transactions]);

  // 전체 합계 (모든 계좌 기준 - 필터링과 무관)
  const totalAllValue = useMemo(() => {
    let sum = 0;
    accountValues.forEach((value) => {
      sum += value;
    });
    return sum;
  }, [accountValues]);

  const totalAllInvested = useMemo(() => {
    let sum = 0;
    accountInvested.forEach((value) => {
      sum += value;
    });
    return sum;
  }, [accountInvested]);

  const totalAllProfitLoss = totalAllValue - totalAllInvested;

  // 정렬된 보유 종목
  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      if (holdingSort === "latest") {
        const dateA = latestTradeDateMap.get(a.ticker) || "";
        const dateB = latestTradeDateMap.get(b.ticker) || "";
        return dateB.localeCompare(dateA); // 최신순
      } else if (holdingSort === "value") {
        const valueA = holdingValues.get(a.ticker)?.value ?? a.total_invested;
        const valueB = holdingValues.get(b.ticker)?.value ?? b.total_invested;
        return valueB - valueA; // 높은 순
      } else {
        // profit
        const valueA = holdingValues.get(a.ticker)?.value ?? a.total_invested;
        const valueB = holdingValues.get(b.ticker)?.value ?? b.total_invested;
        const profitA = valueA - a.total_invested;
        const profitB = valueB - b.total_invested;
        return profitB - profitA; // 높은 순
      }
    });
  }, [holdings, holdingSort, holdingValues, latestTradeDateMap]);

  // 매도 시 보유 수량 검증용
  const sellHoldingQuantity = useMemo(() => {
    if (formData.type !== "sell" || !formData.ticker) return null;
    const holding = holdings.find((h) => h.ticker === formData.ticker);
    return holding?.quantity || 0;
  }, [formData.type, formData.ticker, holdings]);

  const isSellQuantityExceeded = formData.type === "sell" &&
    sellHoldingQuantity !== null &&
    formData.quantity !== undefined &&
    formData.quantity > sellHoldingQuantity;

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ticker || !formData.name || !formData.quantity || !formData.price || !formData.trade_date) {
      alert("필수 항목을 입력해주세요.");
      return;
    }

    // 매도 시 보유 수량 초과 검증
    if (formData.type === "sell") {
      const holding = holdings.find((h) => h.ticker === formData.ticker);
      const currentQuantity = holding?.quantity || 0;
      if (formData.quantity > currentQuantity) {
        alert(`보유 수량(${currentQuantity}주)보다 많이 매도할 수 없습니다.`);
        return;
      }
    }

    // 총액 계산 (원 단위로 저장)
    const totalAmount = Math.round(formData.quantity * formData.price);

    // 해외주식/해외ETF면 USD, 아니면 KRW
    const isForeign = formData.asset_type === "foreign_stock" || formData.asset_type === "foreign_etf";
    const currency = isForeign && formData.exchange_rate && formData.exchange_rate > 1 ? "USD" : "KRW";

    const payload: PortfolioTransactionInput = {
      profile_id: profileId,
      account_id: formData.account_id || null,
      type: formData.type as PortfolioTransactionType,
      asset_type: formData.asset_type as PortfolioAssetType,
      ticker: formData.ticker,
      name: formData.name,
      quantity: formData.quantity,
      price: formData.price, // 원화 환산 단가
      total_amount: totalAmount,
      currency: currency as PortfolioCurrency,
      exchange_rate: formData.exchange_rate || 1,
      fee: formData.fee || 0,
      trade_date: formData.trade_date,
      memo: formData.memo || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("portfolio_transactions")
        .update(payload)
        .eq("id", editingId);

      if (!error) {
        setEditingId(null);
        resetForm();
        loadTransactions();
      }
    } else {
      const { error } = await supabase
        .from("portfolio_transactions")
        .insert(payload);

      if (!error) {
        setShowAddForm(false);
        resetForm();
        loadTransactions();
      }
    }
  };

  const resetForm = () => {
    setFormData({
      type: "buy",
      asset_type: "domestic_stock",
      fee: 0,
      account_id: selectedAccountIds.length === 1 ? selectedAccountIds[0] : null,
    });
    setUsdPriceInput("");
  };

  const handleEdit = (tx: PortfolioTransaction) => {
    setFormData({
      type: tx.type as PortfolioTransactionType,
      asset_type: tx.asset_type as PortfolioAssetType,
      ticker: tx.ticker,
      name: tx.name,
      quantity: tx.quantity,
      price: tx.price,
      exchange_rate: tx.exchange_rate || 1,
      fee: tx.fee,
      trade_date: tx.trade_date,
      memo: tx.memo || undefined,
      account_id: tx.account_id,
    });
    // USD 단가 복원
    if (tx.exchange_rate && tx.exchange_rate > 1) {
      setUsdPriceInput((tx.price / tx.exchange_rate).toFixed(2));
    } else {
      setUsdPriceInput("");
    }
    setEditingId(tx.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 거래를 삭제하시겠습니까?")) return;

    const { error } = await supabase
      .from("portfolio_transactions")
      .delete()
      .eq("id", id);

    if (!error) {
      loadTransactions();
    }
  };

  const handleCancel = () => {
    setIsModalClosing(true);
    setTimeout(() => {
      setShowAddForm(false);
      setEditingId(null);
      resetForm();
      setIsModalClosing(false);
    }, 200);
  };

  // 거래 내역 로딩 중이거나 가격 데이터 로딩 중이거나 테마 로딩 중일 때 전체 스켈레톤 표시
  if (loading || !isThemeReady || (transactions.length > 0 && priceCacheLoading)) {
    return (
      <div className={styles.container}>
        {/* 계좌 바 스켈레톤 */}
        <div className={styles.accountBar}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonAccountItem}`} />
          ))}
        </div>

        {/* 요약 헤더 스켈레톤 */}
        <div className={styles.summaryHeader}>
          <div className={styles.mainMetric}>
            <span className={`${styles.skeleton} ${styles.skeletonLabel}`} />
            <div className={`${styles.skeleton} ${styles.skeletonMainValue}`} />
            <div className={`${styles.skeleton} ${styles.skeletonChangeInfo}`} />
          </div>
          <div className={styles.sideMetrics}>
            <div className={styles.sideMetric}>
              <span className={`${styles.skeleton} ${styles.skeletonLabel}`} />
              <span className={`${styles.skeleton} ${styles.skeletonSideValue}`} />
            </div>
            <div className={styles.sideMetric}>
              <span className={`${styles.skeleton} ${styles.skeletonLabel}`} />
              <span className={`${styles.skeleton} ${styles.skeletonSideValue}`} />
            </div>
          </div>
        </div>

        {/* 차트 스켈레톤 */}
        <div className={styles.chartSection}>
          <div className={styles.chartContainer}>
            <div className={styles.chartSkeleton}>
              <div className={styles.chartSkeletonHeader}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className={styles.chartSkeletonPeriodBtn} />
                ))}
              </div>
              <div className={styles.chartSkeletonArea} />
              <div className={styles.chartSkeletonLegend}>
                <div className={styles.chartSkeletonLegendItem} />
                <div className={styles.chartSkeletonLegendItem} />
              </div>
            </div>
          </div>
        </div>

        {/* 보유 종목 스켈레톤 */}
        <div className={styles.holdingsSection}>
          <div className={styles.holdingsSectionHeader}>
            <span className={`${styles.skeleton} ${styles.skeletonSectionTitle}`} />
            <div className={styles.holdingSortGroup}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={`${styles.skeleton} ${styles.skeletonSortBtn}`} />
              ))}
            </div>
          </div>
          <div className={styles.holdingsList}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.holdingItem}>
                <div className={styles.holdingRow}>
                  <div className={styles.holdingStockInfo}>
                    <div className={styles.holdingLabelRow}>
                      <span className={`${styles.skeleton} ${styles.skeletonAssetType}`} />
                      <span className={`${styles.skeleton} ${styles.skeletonTicker}`} />
                    </div>
                    <span className={`${styles.skeleton} ${styles.skeletonHoldingName}`} />
                  </div>
                  <div className={styles.holdingMetricsRow}>
                    <div className={styles.holdingMetric}>
                      <span className={`${styles.skeleton} ${styles.skeletonMetricLabel}`} />
                      <span className={`${styles.skeleton} ${styles.skeletonMetricValue}`} />
                    </div>
                    <div className={styles.holdingMetric}>
                      <span className={`${styles.skeleton} ${styles.skeletonMetricLabel}`} />
                      <span className={`${styles.skeleton} ${styles.skeletonMetricValue}`} />
                    </div>
                  </div>
                </div>
                <div className={styles.holdingRow}>
                  <div className={styles.holdingQtyInfo}>
                    <span className={`${styles.skeleton} ${styles.skeletonMetricLabel}`} />
                    <span className={`${styles.skeleton} ${styles.skeletonQtyValue}`} />
                  </div>
                  <div className={styles.holdingMetricsRow}>
                    <div className={styles.holdingMetric}>
                      <span className={`${styles.skeleton} ${styles.skeletonMetricLabel}`} />
                      <span className={`${styles.skeleton} ${styles.skeletonMetricValue}`} />
                    </div>
                    <div className={styles.holdingMetric}>
                      <span className={`${styles.skeleton} ${styles.skeletonMetricLabel}`} />
                      <span className={`${styles.skeleton} ${styles.skeletonMetricValue}`} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 증권 계좌 선택 */}
      <div className={styles.accountBar}>
        {/* 전체 */}
        <button
          className={`${styles.accountItem} ${selectedAccountIds.length === 0 ? styles.accountItemSelected : ""}`}
          onClick={() => setSelectedAccountIds([])}
        >
          <span className={styles.accountItemName}>전체</span>
          <div className={styles.accountItemValues}>
            <span className={styles.accountItemBalance}>{formatWon(Math.round(totalAllValue))}</span>
            <span className={`${styles.accountItemChange} ${totalAllProfitLoss >= 0 ? styles.positive : styles.negative}`}>
              {totalAllProfitLoss >= 0 ? "+" : "-"}{formatWon(Math.round(Math.abs(totalAllProfitLoss)))}
            </span>
          </div>
        </button>
        <div className={styles.accountDivider} />
        {/* 개별 계좌들 */}
        {accounts.length === 0 ? (
          <span className={styles.noAccountsText}>등록된 계좌 없음</span>
        ) : (
          accounts.map((account) => {
            const accountValue = accountValues.get(account.id) || 0;
            const invested = accountInvested.get(account.id) || 0;
            const profit = accountValue - invested;
            const isSelected = selectedAccountIds.includes(account.id);
            return (
              <button
                key={account.id}
                className={`${styles.accountItem} ${isSelected ? styles.accountItemSelected : ""}`}
                onClick={() => toggleAccountSelection(account.id)}
              >
                <span className={styles.accountItemName}>{account.name}</span>
                <div className={styles.accountItemValues}>
                  <span className={styles.accountItemBalance}>{formatWon(Math.round(accountValue))}</span>
                  <span className={`${styles.accountItemChange} ${profit >= 0 ? styles.positive : styles.negative}`}>
                    {profit >= 0 ? "+" : "-"}{formatWon(Math.round(Math.abs(profit)))}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* 검색 결과 슬라이드 패널 */}
      {searchResult && (
        <div
          className={`${styles.searchPanelOverlay} ${isSearchPanelClosing ? styles.closing : ""}`}
        >
          <div
            ref={searchPanelRef}
            className={`${styles.searchPanel} ${isSearchPanelClosing ? styles.closing : ""}`}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div className={styles.searchPanelHeader}>
              <div>
                <div className={styles.searchPanelTitle}>
                  {searchResult.name && <span className={styles.searchPanelName}>{searchResult.name}</span>}
                  <span className={styles.searchPanelSymbol}>{searchResult.symbol}</span>
                </div>
                <div className={styles.searchPanelPrice}>
                  {searchResult.symbol.endsWith(".KS") || searchResult.symbol.endsWith(".KQ")
                    ? `${Math.round(searchResult.price).toLocaleString()}원`
                    : `$${searchResult.price.toLocaleString()}`}
                  <span className={`${styles.searchPanelChange} ${searchResult.changePercent >= 0 ? styles.positive : styles.negative}`}>
                    {searchResult.changePercent >= 0 ? "+" : ""}{searchResult.changePercent.toFixed(2)}%
                  </span>
                </div>
                <DataDateNotice dataDate={searchResult.dataDate} />
              </div>
              <button onClick={closeSearchPanel} className={styles.searchPanelCloseBtn}>
                <X size={20} />
              </button>
            </div>

            {/* 차트 */}
            <div className={styles.holdingPanelChart}>
              {searchResult.data && searchResult.data.length > 0 && (
                <span className={styles.chartDateLabel}>{searchResult.data[searchResult.data.length - 1]?.Date} 기준</span>
              )}
              <Sparkline
                priceData={(() => {
                  const map = new Map<string, number>();
                  searchResult.data.forEach(d => map.set(d.Date, d.Close));
                  return map;
                })()}
                profitLoss={searchResult.changePercent >= 0 ? 1 : -1}
                chartLineColors={chartLineColors}
                toRgba={toRgba}
                width={472}
                height={80}
              />
            </div>

            <button onClick={applySearchResult} className={styles.searchPanelAddBtn}>
              이 종목으로 거래 추가
            </button>
          </div>
        </div>
      )}

      {/* 보유 종목 상세 패널 */}
      {selectedHolding && (
        <div
          className={`${styles.searchPanelOverlay} ${isHoldingPanelClosing ? styles.closing : ""}`}
        >
          <div
            ref={holdingPanelRef}
            className={`${styles.holdingPanel} ${isHoldingPanelClosing ? styles.closing : ""}`}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div className={styles.searchPanelHeader}>
              <div>
                <div className={styles.searchPanelTitle}>
                  <span className={styles.searchPanelName}>{selectedHolding.name}</span>
                  <span className={styles.searchPanelSymbol}>{selectedHolding.ticker}</span>
                </div>
                <div className={styles.holdingPanelMeta}>
                  <span className={`${styles.assetTypeLabel} ${styles[selectedHolding.asset_type]}`}>
                    {ASSET_TYPE_LABELS[selectedHolding.asset_type]}
                  </span>
                </div>
              </div>
              <button onClick={closeHoldingPanel} className={styles.searchPanelCloseBtn}>
                <X size={20} />
              </button>
            </div>

            {/* 보유 정보 */}
            <div className={styles.holdingPanelInfo}>
              <div className={styles.holdingPanelRow}>
                <span className={styles.holdingPanelLabel}>보유 수량</span>
                <span className={styles.holdingPanelValue}>{selectedHolding.quantity.toLocaleString()}주</span>
              </div>
              <div className={styles.holdingPanelRow}>
                <span className={styles.holdingPanelLabel}>평균 단가</span>
                <span className={styles.holdingPanelValue}>{Math.round(selectedHolding.avg_price).toLocaleString()}원</span>
              </div>
              <div className={styles.holdingPanelRow}>
                <span className={styles.holdingPanelLabel}>투자 금액</span>
                <span className={styles.holdingPanelValue}>{Math.round(selectedHolding.total_invested).toLocaleString()}원</span>
              </div>
              {(() => {
                const holdingData = holdingValues.get(selectedHolding.ticker);
                const currentVal = holdingData?.value ?? null;
                const holdingPL = currentVal !== null ? currentVal - selectedHolding.total_invested : null;
                const holdingPLRate = currentVal !== null && selectedHolding.total_invested > 0
                  ? ((currentVal - selectedHolding.total_invested) / selectedHolding.total_invested) * 100
                  : null;
                return (
                  <>
                    <div className={styles.holdingPanelRow}>
                      <span className={styles.holdingPanelLabel}>평가 금액</span>
                      <span className={styles.holdingPanelValue}>
                        {currentVal !== null ? `${Math.round(currentVal).toLocaleString()}원` : "-"}
                      </span>
                    </div>
                    <div className={styles.holdingPanelRow}>
                      <span className={styles.holdingPanelLabel}>손익</span>
                      <span className={`${styles.holdingPanelValue} ${holdingPL !== null ? (holdingPL >= 0 ? styles.profitColor : styles.lossColor) : ""}`}>
                        {holdingPL !== null
                          ? `${holdingPL >= 0 ? "+" : ""}${Math.round(holdingPL).toLocaleString()}원 (${holdingPLRate !== null ? `${holdingPLRate >= 0 ? "+" : ""}${holdingPLRate.toFixed(1)}%` : ""})`
                          : "-"}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* 차트 */}
            <div className={styles.holdingPanelChart}>
              {(() => {
                const tickerPrices = priceCache?.priceDataMap.get(selectedHolding.ticker);
                const sortedDates = tickerPrices ? Array.from(tickerPrices.keys()).sort() : [];
                const latestDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
                return latestDate ? (
                  <span className={styles.chartDateLabel}>{latestDate} 기준</span>
                ) : null;
              })()}
              <Sparkline
                priceData={priceCache?.priceDataMap.get(selectedHolding.ticker)}
                profitLoss={(() => {
                  const holdingData = holdingValues.get(selectedHolding.ticker);
                  const currentVal = holdingData?.value ?? null;
                  return currentVal !== null ? currentVal - selectedHolding.total_invested : null;
                })()}
                chartLineColors={chartLineColors}
                toRgba={toRgba}
                width={472}
                height={80}
              />
            </div>

            <button onClick={() => openSellForm(selectedHolding)} className={styles.sellBtn}>
              매도하기
            </button>
          </div>
        </div>
      )}

      {/* 계좌 관리 모달 */}
      {/* 상단 요약 - AssetRecordTab 스타일 */}
      <div className={styles.summaryHeader}>
        <div className={styles.mainMetric}>
          <span className={styles.metricLabel}>평가금액</span>
          {valueLoading ? (
            <>
              <div className={styles.skeletonMainValue}></div>
              <div className={styles.skeletonChangeInfo}></div>
            </>
          ) : (
            <>
              <span className={styles.mainValue}>
                {currentValue !== null ? formatWon(Math.round(currentValue)) : "0원"}
              </span>
              {profitLoss !== null && (
                <div className={`${styles.changeInfo} ${profitLoss >= 0 ? styles.positive : styles.negative}`}>
                  {profitLoss >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>
                    {profitLoss >= 0 ? "+" : ""}{formatWon(Math.round(Math.abs(profitLoss)))}
                    {" "}({profitLossRate !== null ? `${profitLossRate >= 0 ? "+" : ""}${profitLossRate.toFixed(1)}%` : ""})
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <div className={styles.sideMetrics}>
          <div className={styles.sideMetric}>
            <span className={styles.sideLabel}>투자금액</span>
            <span className={styles.sideValue}>{formatWon(Math.round(totalInvested))}</span>
          </div>
          <div className={styles.sideMetric}>
            <span className={styles.sideLabel}>보유종목</span>
            <span className={styles.sideValue}>{holdings.length}개</span>
          </div>
        </div>
      </div>

      {/* 포트폴리오 가치 추이 차트 */}
      {filteredTransactions.length > 0 && (
        <div className={styles.chartSection}>
          <div className={styles.chartContainer}>
            <PortfolioValueChart
              priceCache={priceCache}
              priceCacheLoading={priceCacheLoading}
              transactions={transactions}
              filterAccountIds={selectedAccountIds}
              chartLineColors={chartLineColors}
              chartScaleColors={chartScaleColors}
              toRgba={toRgba}
            />
          </div>
        </div>
      )}

      {/* 거래 추가/수정 모달 */}
      {showAddForm && (
        <div className={`${styles.modalOverlay} ${isModalClosing ? styles.closing : ""}`}>
          <div
            ref={modalRef}
            className={`${styles.modal} ${isModalClosing ? styles.closing : ""}`}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div className={styles.modalHeader}>
              <h3>{editingId ? "거래 수정" : "새 거래 추가"}</h3>
              <button className={styles.modalCloseBtn} onClick={handleCancel}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalContent}>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>거래 유형</label>
                    <div className={styles.toggleGroup}>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${formData.type === "buy" ? styles.active : ""}`}
                        onClick={() => setFormData({ ...formData, type: "buy" })}
                      >
                        매수
                      </button>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${formData.type === "sell" ? styles.activeSell : ""}`}
                        onClick={() => setFormData({ ...formData, type: "sell" })}
                      >
                        매도
                      </button>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>자산 유형</label>
                    <select
                      value={formData.asset_type}
                      onChange={(e) => setFormData({ ...formData, asset_type: e.target.value as PortfolioAssetType })}
                      className={styles.select}
                    >
                      {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>거래일</label>
                    <div className={styles.dateInputGroup}>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="YYYY"
                        maxLength={4}
                        value={formData.trade_date?.split("-")[0] || ""}
                        onChange={(e) => {
                          const year = e.target.value.replace(/\D/g, "").slice(0, 4);
                          const parts = (formData.trade_date || "--").split("-");
                          setFormData({ ...formData, trade_date: `${year}-${parts[1] || ""}-${parts[2] || ""}` });
                          if (year.length === 4) {
                            (e.target.nextElementSibling?.nextElementSibling as HTMLInputElement)?.focus();
                          }
                        }}
                        className={styles.dateInput}
                      />
                      <span className={styles.dateSeparator}>-</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="MM"
                        maxLength={2}
                        value={formData.trade_date?.split("-")[1] || ""}
                        onChange={(e) => {
                          const month = e.target.value.replace(/\D/g, "").slice(0, 2);
                          const parts = (formData.trade_date || "--").split("-");
                          setFormData({ ...formData, trade_date: `${parts[0] || ""}-${month}-${parts[2] || ""}` });
                          if (month.length === 2) {
                            (e.target.nextElementSibling?.nextElementSibling as HTMLInputElement)?.focus();
                          }
                        }}
                        className={styles.dateInput}
                      />
                      <span className={styles.dateSeparator}>-</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="DD"
                        maxLength={2}
                        value={formData.trade_date?.split("-")[2] || ""}
                        onChange={(e) => {
                          const day = e.target.value.replace(/\D/g, "").slice(0, 2);
                          const parts = (formData.trade_date || "--").split("-");
                          setFormData({ ...formData, trade_date: `${parts[0] || ""}-${parts[1] || ""}-${day}` });
                        }}
                        className={styles.dateInput}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>증권 계좌</label>
                    <select
                      value={formData.account_id || ""}
                      onChange={(e) => setFormData({ ...formData, account_id: e.target.value || null })}
                      className={styles.select}
                    >
                      <option value="">계좌 미지정</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.broker_name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>종목코드 (티커)</label>
                    <input
                      type="text"
                      placeholder="005930.KS, AAPL"
                      value={formData.ticker || ""}
                      onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>종목명</label>
                    <input
                      type="text"
                      placeholder="삼성전자, Apple"
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={styles.input}
                    />
                  </div>
                </div>

                {/* 해외주식/ETF: 달러 단가 + 환율 */}
                {(formData.asset_type === "foreign_stock" || formData.asset_type === "foreign_etf") ? (
                  <>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>
                          수량
                          {formData.type === "sell" && sellHoldingQuantity !== null && (
                            <span className={styles.holdingHint}> (보유: {sellHoldingQuantity})</span>
                          )}
                        </label>
                        <input
                          type="number"
                          placeholder="10"
                          value={formData.quantity ?? ""}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value ? parseFloat(e.target.value) : undefined })}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={`${styles.input} ${isSellQuantityExceeded ? styles.inputError : ""}`}
                        />
                        {isSellQuantityExceeded && (
                          <span className={styles.errorHint}>보유 수량 초과</span>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label>단가 ($)</label>
                        <input
                          type="number"
                          placeholder="68.50"
                          step="0.01"
                          value={usdPriceInput}
                          onChange={(e) => {
                            setUsdPriceInput(e.target.value);
                            const usdPrice = e.target.value ? parseFloat(e.target.value) : 0;
                            const rate = formData.exchange_rate || 1450;
                            setFormData({ ...formData, price: usdPrice ? Math.round(usdPrice * rate) : undefined, exchange_rate: rate });
                          }}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={styles.input}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>환율 (원/$)</label>
                        <input
                          type="number"
                          placeholder="1450"
                          value={formData.exchange_rate ?? ""}
                          onChange={(e) => {
                            const newRate = e.target.value ? parseFloat(e.target.value) : undefined;
                            const usdPrice = usdPriceInput ? parseFloat(usdPriceInput) : 0;
                            setFormData({
                              ...formData,
                              exchange_rate: newRate,
                              price: newRate && usdPrice ? Math.round(usdPrice * newRate) : undefined
                            });
                          }}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={styles.input}
                        />
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>원화 환산 단가</label>
                        <input
                          type="text"
                          value={formData.price ? `${Math.round(formData.price).toLocaleString()}원` : ""}
                          readOnly
                          className={styles.input}
                          style={{ background: "var(--dashboard-hover-bg)" }}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>수수료 (원)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.fee ?? ""}
                          onChange={(e) => setFormData({ ...formData, fee: e.target.value ? parseFloat(e.target.value) : undefined })}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={styles.input}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>메모 (선택)</label>
                        <input
                          type="text"
                          placeholder="메모"
                          value={formData.memo || ""}
                          onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                          className={styles.input}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 국내주식/암호화폐: 원화 단가 */}
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>
                          수량
                          {formData.type === "sell" && sellHoldingQuantity !== null && (
                            <span className={styles.holdingHint}> (보유: {sellHoldingQuantity})</span>
                          )}
                        </label>
                        <input
                          type="number"
                          placeholder="10"
                          value={formData.quantity ?? ""}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value ? parseFloat(e.target.value) : undefined })}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={`${styles.input} ${isSellQuantityExceeded ? styles.inputError : ""}`}
                        />
                        {isSellQuantityExceeded && (
                          <span className={styles.errorHint}>보유 수량 초과</span>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label>단가 (원)</label>
                        <input
                          type="number"
                          placeholder="70000"
                          value={formData.price ?? ""}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value ? parseFloat(e.target.value) : undefined })}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={styles.input}
                        />
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>수수료 (원)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.fee ?? ""}
                          onChange={(e) => setFormData({ ...formData, fee: e.target.value ? parseFloat(e.target.value) : undefined })}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={styles.input}
                        />
                      </div>

                      <div className={styles.formGroup} style={{ flex: 2 }}>
                        <label>메모 (선택)</label>
                        <input
                          type="text"
                          placeholder="메모"
                          value={formData.memo || ""}
                          onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                          className={styles.input}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* 총액 미리보기 */}
                {formData.quantity && formData.price && (
                  <div className={styles.totalPreview}>
                    총 거래금액: {Math.round(formData.quantity * formData.price).toLocaleString()}원
                    {(formData.asset_type === "foreign_stock" || formData.asset_type === "foreign_etf") && formData.exchange_rate && formData.exchange_rate > 1 && (
                      <span className={styles.usdAmount}>
                        {" "}(${(formData.quantity * formData.price / formData.exchange_rate).toFixed(2)})
                      </span>
                    )}
                  </div>
                )}

                <div className={styles.formActions}>
                  <button type="button" onClick={handleCancel} className={styles.cancelBtn}>
                    취소
                  </button>
                  <button type="submit" className={styles.submitBtn}>
                    {editingId ? "수정" : "추가"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 보유 종목 */}
      <div className={styles.holdingsSection}>
        <div className={styles.holdingsSectionHeader}>
          <h3 className={styles.holdingsSectionTitle}>보유 종목</h3>
          <div className={styles.holdingSortGroup}>
            <button
              className={`${styles.holdingSortBtn} ${holdingSort === "latest" ? styles.holdingSortActive : ""}`}
              onClick={() => setHoldingSort("latest")}
            >
              최신거래순
            </button>
            <button
              className={`${styles.holdingSortBtn} ${holdingSort === "value" ? styles.holdingSortActive : ""}`}
              onClick={() => setHoldingSort("value")}
            >
              평가금액순
            </button>
            <button
              className={`${styles.holdingSortBtn} ${holdingSort === "profit" ? styles.holdingSortActive : ""}`}
              onClick={() => setHoldingSort("profit")}
            >
              손익순
            </button>
          </div>
        </div>

        {sortedHoldings.length === 0 ? (
          <div className={styles.emptyState}>보유 종목이 없습니다.</div>
        ) : (
          <div className={styles.holdingsList}>
            {sortedHoldings.map((holding) => {
              const holdingData = holdingValues.get(holding.ticker);
              const currentVal = holdingData?.value ?? null;
              const holdingPL = currentVal !== null ? currentVal - holding.total_invested : null;
              const holdingPLRate = currentVal !== null && holding.total_invested > 0
                ? ((currentVal - holding.total_invested) / holding.total_invested) * 100
                : null;

              return (
                <div
                  key={holding.ticker}
                  className={styles.holdingItem}
                  onClick={() => setSelectedHolding(holding)}
                  style={{ cursor: "pointer" }}
                >
                  {/* 1행: 종목명 + 평가금액 + 투자금액 */}
                  <div className={styles.holdingRow}>
                    <div className={styles.holdingStockInfo}>
                      <div className={styles.holdingLabelRow}>
                        <span className={`${styles.assetTypeLabel} ${styles[holding.asset_type]}`}>
                          {ASSET_TYPE_LABELS[holding.asset_type]}
                        </span>
                        <span className={styles.holdingTicker}>{holding.ticker}</span>
                      </div>
                      <span className={styles.holdingName}>{holding.name}</span>
                    </div>
                    <div className={styles.holdingMetricsRow}>
                      <div className={styles.holdingMetric}>
                        <span className={styles.metricLabel}>평가금액</span>
                        <span className={styles.metricValue}>
                          {valueLoading ? "..." : currentVal !== null ? `${Math.round(currentVal).toLocaleString()}원` : "-"}
                        </span>
                      </div>
                      <div className={styles.holdingMetric}>
                        <span className={styles.metricLabel}>투자금액</span>
                        <span className={styles.metricValue}>{Math.round(holding.total_invested).toLocaleString()}원</span>
                      </div>
                    </div>
                  </div>
                  {/* 2행: 보유주식 + 손익 + 스파크라인 */}
                  <div className={styles.holdingRow}>
                    <div className={styles.holdingQtyInfo}>
                      <span className={styles.metricLabel}>보유 주식수</span>
                      <span className={styles.metricValueLeft}>
                        {holding.quantity.toLocaleString()}주
                        <span className={styles.avgPriceInline}>({Math.round(holding.avg_price).toLocaleString()}원)</span>
                      </span>
                    </div>
                    <div className={styles.holdingMetricsRow}>
                      <div className={styles.holdingMetric}>
                        <span className={styles.metricLabel}>손익</span>
                        {holdingPL !== null && !valueLoading ? (
                          <span className={`${styles.metricValue} ${holdingPL >= 0 ? styles.profitColor : styles.lossColor}`}>
                            {holdingPL >= 0 ? "+" : ""}{Math.round(holdingPL).toLocaleString()}원
                            <span className={styles.plRateSmall}> ({holdingPLRate !== null ? `${holdingPLRate >= 0 ? "+" : ""}${holdingPLRate.toFixed(1)}%` : ""})</span>
                          </span>
                        ) : (
                          <span className={styles.metricValue}>-</span>
                        )}
                      </div>
                      <div className={styles.holdingMetricChart}>
                        <span className={styles.metricLabel}>주가 추이</span>
                        <Sparkline priceData={priceCache?.priceDataMap.get(holding.ticker)} profitLoss={holdingPL} chartLineColors={chartLineColors} toRgba={toRgba} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 거래 내역 */}
      <div className={styles.section}>
        <button
          className={styles.sectionHeader}
          onClick={() => setExpandedSection(expandedSection === "transactions" ? null : "transactions")}
        >
          <h3 className={styles.sectionTitle}>거래 내역</h3>
          <span className={styles.badge}>{filteredTransactions.length}</span>
          {expandedSection === "transactions" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {expandedSection === "transactions" && (
          <div className={styles.transactionsList}>
            {filteredTransactions.length === 0 ? (
              <div className={styles.emptyState}>거래 내역이 없습니다.</div>
            ) : (
              filteredTransactions.map((tx) => {
                const txAccount = accounts.find((a) => a.id === tx.account_id);
                return (
                <div key={tx.id} className={styles.transactionCard}>
                  <div className={styles.txLeft}>
                    <span className={`${styles.txType} ${styles[tx.type]}`}>
                      {tx.type === "buy" ? "매수" : "매도"}
                    </span>
                    <div className={styles.txInfo}>
                      <span className={styles.txName}>{tx.name}</span>
                      <div className={styles.txMeta}>
                        <span className={styles.txTicker}>{tx.ticker}</span>
                        {txAccount && (
                          <span className={styles.txAccount}>{txAccount.broker_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.txCenter}>
                    <span className={styles.txQty}>{tx.quantity.toLocaleString()}주</span>
                    <span className={styles.txPrice}>
                      {tx.currency === "USD" && tx.exchange_rate > 1
                        ? `@ $${(tx.price / tx.exchange_rate).toFixed(2)}`
                        : `@ ${Math.round(tx.price).toLocaleString()}원`}
                    </span>
                  </div>
                  <div className={styles.txRight}>
                    <span className={styles.txTotal}>{Math.round(tx.quantity * tx.price).toLocaleString()}원</span>
                    <span className={styles.txDate}>{tx.trade_date}</span>
                  </div>
                  <div className={styles.txActions}>
                    <button onClick={() => handleEdit(tx)} className={styles.actionBtn}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(tx.id)} className={styles.actionBtn}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// 데이터 기준일 안내
function DataDateNotice({ dataDate }: { dataDate: string }) {
  const today = new Date();
  const dataDay = new Date(dataDate);

  // 날짜 차이 계산 (일 단위)
  const diffTime = today.getTime() - dataDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // 오늘인지, 어제인지, 그 이전인지
  let message: string;
  let isDelayed: boolean;

  if (diffDays === 0) {
    message = `${dataDate} (오늘 종가)`;
    isDelayed = false;
  } else if (diffDays === 1) {
    message = `${dataDate} (어제 종가)`;
    isDelayed = false; // 장 마감 후에는 어제 종가가 정상
  } else if (diffDays <= 3) {
    // 주말 고려 (금요일 데이터가 월요일에 보이면 2-3일 차이)
    message = `${dataDate} 기준`;
    isDelayed = false;
  } else {
    message = `${dataDate} 기준 (${diffDays}일 전 데이터)`;
    isDelayed = true;
  }

  return (
    <div className={isDelayed ? styles.dataDateWarning : styles.dataDateNotice}>
      {message}
    </div>
  );
}

// 검색 결과 차트
function SearchResultChart({
  data,
  symbol,
  chartLineColors,
  chartScaleColors,
  toRgba,
}: {
  data: StockData[];
  symbol: string;
  chartLineColors: { price: string; value: string; profit: string; loss: string; buy: string; sell: string };
  chartScaleColors: { gridColor: string; tickColor: string; textColor: string; textSecondary: string; tooltipBg: string; tooltipBorder: string; tooltipText: string; doughnutBorder: string; emptyState: string };
  toRgba: (hex: string, alpha: number) => string;
}) {
  const isKorean = symbol.endsWith(".KS") || symbol.endsWith(".KQ");

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    return {
      labels: data.map((d) => d.Date),
      datasets: [
        {
          label: "종가",
          data: data.map((d) => d.Close),
          borderColor: chartLineColors.price,
          backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D; chartArea: { top: number; bottom: number } } }) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return toRgba(chartLineColors.price, 0.1);
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, toRgba(chartLineColors.price, 0.2));
            gradient.addColorStop(1, toRgba(chartLineColors.price, 0));
            return gradient;
          },
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }, [data, chartLineColors, toRgba]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: 'easeOutQuart',
    } as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => {
            const val = ctx.parsed?.y;
            if (val == null) return "";
            return isKorean
              ? `${Math.round(val).toLocaleString()}원`
              : `$${val.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: {
          maxTicksLimit: 5,
          font: { size: 11 },
          color: chartScaleColors.tickColor,
        },
      },
      y: {
        display: true,
        grid: { color: chartScaleColors.gridColor },
        ticks: {
          font: { size: 11 },
          color: chartScaleColors.tickColor,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (val: any) => {
            const num = typeof val === "number" ? val : parseFloat(val);
            return isKorean
              ? `${(num / 10000).toFixed(0)}만`
              : `$${num.toLocaleString()}`;
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
  }), [isKorean, chartScaleColors]);

  if (!chartData) return null;

  return <Chart type="line" data={chartData} options={options} />;
}

// 기간 옵션
type ChartPeriod = "1M" | "3M" | "6M" | "1Y" | "3Y" | "ALL";
const PERIOD_OPTIONS: { value: ChartPeriod; label: string; days: number }[] = [
  { value: "1M", label: "1개월", days: 30 },
  { value: "3M", label: "3개월", days: 90 },
  { value: "6M", label: "6개월", days: 180 },
  { value: "1Y", label: "1년", days: 365 },
  { value: "3Y", label: "3년", days: 1095 },
  { value: "ALL", label: "전체", days: 0 },
];

// 스파크라인 미니 차트
function Sparkline({
  priceData,
  profitLoss,
  width = 80,
  height = 32,
  chartLineColors,
  toRgba,
}: {
  priceData: Map<string, number> | undefined;
  profitLoss?: number | null;
  width?: number;
  height?: number;
  chartLineColors: { price: string; value: string; profit: string; loss: string; buy: string; sell: string };
  toRgba: (hex: string, alpha: number) => string;
}) {

  const chartData = useMemo(() => {
    if (!priceData || priceData.size === 0) return null;

    // 최근 90일 데이터만 사용
    const sortedDates = Array.from(priceData.keys()).sort();
    const recentDates = sortedDates.slice(-90);
    const prices = recentDates.map((d) => priceData.get(d) || 0);

    if (prices.length < 2) return null;

    return {
      labels: recentDates,
      prices,
    };
  }, [priceData]);

  if (!chartData) {
    return <div style={{ width, height, background: "#f5f5f5", borderRadius: 4 }} />;
  }

  const { labels, prices } = chartData;
  // 손익 기준으로 색상 결정 (한국식: 수익=빨강, 손실=파랑)
  const isProfit = profitLoss !== null && profitLoss !== undefined ? profitLoss >= 0 : true;
  const lineColor = isProfit ? chartLineColors.profit : chartLineColors.loss;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    labels,
    datasets: [
      {
        data: prices,
        borderColor: lineColor,
        backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D; chartArea: { top: number; bottom: number } } }) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          if (!chartArea) return toRgba(lineColor, 0.15);
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, toRgba(lineColor, 0.25));
          gradient.addColorStop(1, toRgba(lineColor, 0));
          return gradient;
        },
        fill: true,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    responsive: false,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: {
      line: { borderCapStyle: "round" },
    },
  };

  return (
    <div style={{ width, height }}>
      <Chart type="line" data={data} options={options} width={width} height={height} />
    </div>
  );
}

// 포트폴리오 가치 추이 차트
function PortfolioValueChart({
  priceCache,
  priceCacheLoading,
  transactions,
  filterAccountIds = [],
  chartLineColors,
  chartScaleColors,
  toRgba,
}: {
  priceCache: PortfolioPriceCache | undefined;
  priceCacheLoading: boolean;
  transactions: PortfolioTransaction[];
  filterAccountIds?: string[];
  chartLineColors: { price: string; value: string; profit: string; loss: string; buy: string; sell: string };
  chartScaleColors: { gridColor: string; tickColor: string; textColor: string; textSecondary: string; tooltipBg: string; tooltipBorder: string; tooltipText: string; doughnutBorder: string; emptyState: string };
  toRgba: (hex: string, alpha: number) => string;
}) {
  const [period, setPeriod] = useState<ChartPeriod>("3M");
  const [chartReady, setChartReady] = useState(false);
  const loading = priceCacheLoading;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  // 평가금액 그라데이션 함수 (공식 문서 방식)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getValueGradient = useCallback((ctx: CanvasRenderingContext2D, chartArea: any) => {
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, toRgba(chartLineColors.value, 0.15));
    gradient.addColorStop(1, toRgba(chartLineColors.value, 0));
    return gradient;
  }, [chartLineColors.value, toRgba]);

  // 손익 양수(빨강) 그라데이션 - 위에서 아래로 투명
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPLPosGradient = useCallback((ctx: CanvasRenderingContext2D, chartArea: any, scales: any) => {
    const zeroY = scales?.y1?.getPixelForValue(0) ?? chartArea.bottom;
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, zeroY);
    gradient.addColorStop(0, toRgba(chartLineColors.profit, 0.2));
    gradient.addColorStop(1, toRgba(chartLineColors.profit, 0));
    return gradient;
  }, [chartLineColors.profit, toRgba]);

  // 손익 음수(파랑) 그라데이션 - 0에서 아래로 색상
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPLNegGradient = useCallback((ctx: CanvasRenderingContext2D, chartArea: any, scales: any) => {
    const zeroY = scales?.y1?.getPixelForValue(0) ?? chartArea.top;
    const gradient = ctx.createLinearGradient(0, zeroY, 0, chartArea.bottom);
    gradient.addColorStop(0, toRgba(chartLineColors.loss, 0));
    gradient.addColorStop(1, toRgba(chartLineColors.loss, 0.2));
    return gradient;
  }, [chartLineColors.loss, toRgba]);

  // 계좌 필터링된 거래 내역
  const filteredTx = useMemo(() => {
    if (filterAccountIds.length === 0) return transactions;
    return transactions.filter((tx) => tx.account_id && filterAccountIds.includes(tx.account_id));
  }, [transactions, filterAccountIds]);

  // 날짜별 거래 내역 맵 (툴팁 및 마커용)
  const transactionsByDate = useMemo(() => {
    const map = new Map<string, PortfolioTransaction[]>();
    filteredTx.forEach((tx) => {
      const date = tx.trade_date;
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(tx);
    });
    return map;
  }, [filteredTx]);

  // 캐시된 가격 데이터 + 필터링된 거래로 투자금액/평가금액 계산
  const fullData = useMemo(() => {
    if (!priceCache || filteredTx.length === 0) return null;

    const { priceDataMap, exchangeRateMap, tickerCurrencyMap, dates } = priceCache;

    // 필터링된 거래로 날짜별 보유량 계산
    const sortedTx = [...filteredTx].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    );

    // 날짜별 보유 수량 및 평균단가 계산
    type HoldingState = { quantity: number; totalInvested: number; avgPrice: number };
    const holdingsAtDate = new Map<string, Map<string, number>>();
    const holdingStateAtDate = new Map<string, Map<string, HoldingState>>();

    dates.forEach((date) => {
      const holdings = new Map<string, number>();
      const holdingStates = new Map<string, HoldingState>();

      sortedTx.forEach((tx) => {
        if (tx.trade_date <= date) {
          const currentQty = holdings.get(tx.ticker) || 0;
          const currentState = holdingStates.get(tx.ticker) || { quantity: 0, totalInvested: 0, avgPrice: 0 };

          if (tx.type === "buy") {
            const newQty = currentState.quantity + tx.quantity;
            const newInvested = currentState.totalInvested + tx.quantity * tx.price;
            holdings.set(tx.ticker, currentQty + tx.quantity);
            holdingStates.set(tx.ticker, {
              quantity: newQty,
              totalInvested: newInvested,
              avgPrice: newQty > 0 ? newInvested / newQty : 0,
            });
          } else {
            // 매도: 평균단가 기준으로 투자금액 차감
            const sellAmount = tx.quantity * currentState.avgPrice;
            const newQty = currentState.quantity - tx.quantity;
            const newInvested = currentState.totalInvested - sellAmount;
            holdings.set(tx.ticker, currentQty - tx.quantity);
            holdingStates.set(tx.ticker, {
              quantity: newQty,
              totalInvested: Math.max(0, newInvested),
              avgPrice: currentState.avgPrice,
            });
          }
        }
      });

      holdingsAtDate.set(date, holdings);
      holdingStateAtDate.set(date, holdingStates);
    });

    // 날짜별 투자금액 & 평가금액 계산
    const invested: number[] = [];
    const value: number[] = [];

    dates.forEach((date) => {
      const holdingStates = holdingStateAtDate.get(date) || new Map();
      let totalInvested = 0;
      holdingStates.forEach((state) => {
        totalInvested += state.totalInvested;
      });
      invested.push(totalInvested);

      const holdings = holdingsAtDate.get(date) || new Map();
      let totalValue = 0;

      // 해당 날짜 환율 찾기
      let exchangeRate = exchangeRateMap.get(date);
      if (!exchangeRate && exchangeRateMap.size > 0) {
        const sortedFxDates = Array.from(exchangeRateMap.keys()).sort();
        for (const d of sortedFxDates.reverse()) {
          if (d <= date) {
            exchangeRate = exchangeRateMap.get(d);
            break;
          }
        }
      }

      holdings.forEach((qty, ticker) => {
        if (qty > 0) {
          const tickerPrices = priceDataMap.get(ticker);
          const currency = tickerCurrencyMap.get(ticker);

          let price = tickerPrices?.get(date);
          if (!price && tickerPrices) {
            const sortedDates = Array.from(tickerPrices.keys()).sort();
            for (const d of sortedDates.reverse()) {
              if (d <= date) {
                price = tickerPrices.get(d);
                break;
              }
            }
          }

          if (price) {
            if (currency === "USD" && exchangeRate) {
              totalValue += qty * price * exchangeRate;
            } else {
              totalValue += qty * price;
            }
          }
        }
      });

      value.push(totalValue || totalInvested);
    });

    return { labels: dates, invested, value };
  }, [priceCache, filteredTx]);

  // 기간에 따라 필터링된 데이터
  const chartData = useMemo(() => {
    if (!fullData) return null;

    const periodConfig = PERIOD_OPTIONS.find((p) => p.value === period);

    // 기간 필터링
    let filteredLabels = fullData.labels;
    let filteredInvested = fullData.invested;
    let filteredValue = fullData.value;

    if (periodConfig && periodConfig.days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - periodConfig.days);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];

      const startIdx = fullData.labels.findIndex((d) => d >= cutoffStr);
      if (startIdx !== -1) {
        filteredLabels = fullData.labels.slice(startIdx);
        filteredInvested = fullData.invested.slice(startIdx);
        filteredValue = fullData.value.slice(startIdx);
      }
    }

    // 모든 기간 일 단위로 표시 (거래 마커가 누락되지 않도록)
    return {
      labels: filteredLabels,
      invested: filteredInvested,
      value: filteredValue,
    };
  }, [fullData, period]);

  // 탭 진입 시 애니메이션: 마운트 후 0→실제 데이터 전환 (1회만)
  useEffect(() => {
    if (!loading && chartData && !chartReady) {
      requestAnimationFrame(() => setChartReady(true));
    }
  }, [loading, chartData, chartReady]);

  if (loading) {
    return (
      <div className={styles.chartSkeleton}>
        <div className={styles.chartSkeletonHeader}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.chartSkeletonPeriodBtn}></div>
          ))}
        </div>
        <div className={styles.chartSkeletonArea}></div>
        <div className={styles.chartSkeletonLegend}>
          <div className={styles.chartSkeletonLegendItem}></div>
          <div className={styles.chartSkeletonLegendItem}></div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.labels.length === 0) {
    return <div className={styles.chartLoading}>데이터 없음</div>;
  }

  // 각 시점의 누적 손익 계산 (평가금액 - 투자금액)
  const plData = chartData.value.map((v, i) => v - chartData.invested[i]);

  // 날짜별 거래 내역 (세로선 마커용)
  const txAtIndex = chartData.labels.map((label) => transactionsByDate.get(label) || null);

  // Y축 대칭을 위한 최대 절대값 계산
  const maxAbsPL = Math.max(...plData.map((v) => Math.abs(v)));

  // 현재 기준 수익률 계산
  const latestValue = chartData.value[chartData.value.length - 1];
  const latestInvested = chartData.invested[chartData.invested.length - 1];
  const totalPL = latestValue - latestInvested;
  const profitRate = ((totalPL / latestInvested) * 100).toFixed(1);
  const profitSign = totalPL >= 0 ? "+" : "";

  // 거래가 있는 인덱스 목록 (세로 점선용)
  const txIndices = txAtIndex
    .map((tx, i) => (tx && tx.length > 0 ? i : -1))
    .filter((i) => i >= 0);


  // 거래일 세로 점선 플러그인
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txVerticalLinePlugin: any = {
    id: "txVerticalLines",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    afterDatasetsDraw: (chart: any) => {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales?.x) return;

      const xScale = scales.x;
      const dataLength = chartData.labels.length;
      if (dataLength <= 1) return;

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(156, 163, 175, 0.5)";
      ctx.lineWidth = 1;

      txIndices.forEach((idx: number) => {
        // 카테고리 스케일의 실제 픽셀 위치 계산 (스케일 패딩 고려)
        const x = xScale.getPixelForValue(idx);
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      });

      ctx.restore();
    },
  };

  const zeroPlData = chartReady ? plData : plData.map(() => 0);
  const zeroValueData = chartReady ? chartData.value : chartData.value.map(() => 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    labels: chartData.labels,
    datasets: [
      {
        type: "bar" as const,
        label: "손익",
        data: zeroPlData,
        backgroundColor: plData.map((v) => v >= 0 ? toRgba(chartLineColors.profit, 0.7) : toRgba(chartLineColors.loss, 0.7)),
        hoverBackgroundColor: plData.map((v) => v >= 0 ? toRgba(chartLineColors.profit, 0.9) : toRgba(chartLineColors.loss, 0.9)),
        borderWidth: 0,
        borderRadius: 2,
        yAxisID: "y1",
        order: 2,
      },
      {
        type: "line" as const,
        label: "평가금액",
        data: zeroValueData,
        borderColor: toRgba(chartLineColors.value, 0.8),
        backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D; chartArea: { top: number; bottom: number } } }) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          if (!chartArea) return toRgba(chartLineColors.value, 0.05);
          return getValueGradient(ctx, chartArea);
        },
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: chartLineColors.value,
        tension: 0.3,
        yAxisID: "y",
        order: 1,
      },
    ],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: 'easeOutQuart' as const,
    },
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
        external: (context: { chart: { canvas: HTMLCanvasElement }; tooltip: { opacity: number; caretX: number; caretY: number; title?: string[]; dataPoints?: { dataset: { label?: string }; raw: number }[] } }) => {
          const { chart, tooltip } = context;

          // 차트 컨테이너 안에 툴팁을 넣어야 backdrop-filter가 작동함
          const chartContainer = chart.canvas.parentElement;
          if (!chartContainer) return;

          let tooltipEl = chartContainer.querySelector("#portfolio-chart-tooltip") as HTMLDivElement | null;

          if (!tooltipEl) {
            tooltipEl = document.createElement("div");
            tooltipEl.id = "portfolio-chart-tooltip";
            chartContainer.style.position = "relative";
            chartContainer.appendChild(tooltipEl);
          }

          if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = "0";
            tooltipEl.style.pointerEvents = "none";
            return;
          }

          // 인라인 스타일 직접 적용 (backdrop-filter 포함)
          Object.assign(tooltipEl.style, {
            position: "absolute",
            pointerEvents: "none",
            background: "rgba(255, 255, 255, 0.5)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            borderRadius: "10px",
            padding: "14px 18px",
            fontSize: "13px",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
            transition: "opacity 0.15s ease",
            zIndex: "100",
          });

          // 내용 구성
          let html = "";
          if (tooltip.title && tooltip.title[0]) {
            html += `<div style="font-weight:600;color:#111827;margin-bottom:8px;border-bottom:1px solid rgba(0,0,0,0.1);padding-bottom:8px;">${tooltip.title[0]}</div>`;
          }

          // 현재 인덱스에서 거래 내역 확인
          let currentTx: PortfolioTransaction[] | null = null;
          if (tooltip.dataPoints && tooltip.dataPoints.length > 0) {
            const idx = (tooltip.dataPoints[0] as { dataIndex?: number }).dataIndex;
            if (idx !== undefined && txAtIndex[idx]) {
              currentTx = txAtIndex[idx];
            }
          }

          if (tooltip.dataPoints) {
            tooltip.dataPoints.forEach((point) => {
              const label = point.dataset.label || "";
              const value = point.raw;

              if (label === "손익") {
                const color = value >= 0 ? chartLineColors.profit : chartLineColors.loss;
                const sign = value >= 0 ? "+" : "";
                html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px;">
                  <span style="color:#6b7280;font-weight:500;">손익</span>
                  <span style="color:${color};font-weight:500;">${sign}${Math.round(value).toLocaleString()}원</span>
                </div>`;
              } else if (label === "평가금액") {
                html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                  <span style="color:#6b7280;font-weight:500;">평가금액</span>
                  <span style="color:${chartLineColors.value};font-weight:500;">${Math.round(value).toLocaleString()}원</span>
                </div>`;
              }
            });
          }

          // 거래 내역 표시
          if (currentTx && currentTx.length > 0) {
            html += `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.1);">
              <div style="font-weight:600;color:#6b7280;font-size:11px;margin-bottom:6px;">거래 내역</div>`;
            currentTx.forEach((tx) => {
              const isBuy = tx.type === "buy";
              const color = isBuy ? chartLineColors.buy : chartLineColors.sell;
              const typeLabel = isBuy ? "매수" : "매도";
              const amount = tx.quantity * tx.price;
              html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:12px;">
                <span style="color:${color};font-weight:600;min-width:28px;">${typeLabel}</span>
                <span style="color:#374151;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tx.name || tx.ticker}</span>
                <span style="color:#6b7280;">${Math.round(amount).toLocaleString()}원</span>
              </div>`;
            });
            html += `</div>`;
          }

          tooltipEl.innerHTML = html;
          tooltipEl.style.opacity = "1";

          // 차트 컨테이너 기준 상대 위치 (오버플로우 방지)
          const containerWidth = chartContainer.offsetWidth;
          const tooltipWidth = tooltipEl.offsetWidth;
          const tooltipHeight = tooltipEl.offsetHeight;

          let left = tooltip.caretX;
          let top = tooltip.caretY - 10;
          let transformX = "-50%";
          let transformY = "-100%";

          // 오른쪽 오버플로우 체크
          if (left + tooltipWidth / 2 > containerWidth) {
            left = containerWidth - tooltipWidth / 2 - 10;
          }
          // 왼쪽 오버플로우 체크
          if (left - tooltipWidth / 2 < 0) {
            left = tooltipWidth / 2 + 10;
          }
          // 상단 오버플로우 체크
          if (top - tooltipHeight < 0) {
            top = tooltip.caretY + 10;
            transformY = "0%";
          }

          tooltipEl.style.left = left + "px";
          tooltipEl.style.top = top + "px";
          tooltipEl.style.transform = `translate(${transformX}, ${transformY})`;
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { maxTicksLimit: 8, font: { size: 10 } },
      },
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        grid: { color: chartScaleColors.gridColor },
        ticks: {
          callback: (value: unknown) => {
            const v = value as number;
            if (v >= 100000000) {
              return `${(v / 100000000).toFixed(1)}억`;
            }
            return `${Math.round(v / 10000).toLocaleString()}만`;
          },
          font: { size: 10 },
          color: chartScaleColors.tickColor,
        },
        title: {
          display: false,
        },
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        min: -maxAbsPL,
        max: maxAbsPL,
        grid: { drawOnChartArea: false },
        ticks: {
          callback: (value: unknown) => {
            const v = value as number;
            if (Math.abs(v) >= 100000000) {
              return `${(v / 100000000).toFixed(1)}억`;
            }
            return `${Math.round(v / 10000).toLocaleString()}만`;
          },
          font: { size: 10 },
        },
        title: {
          display: false,
        },
      },
    },
  };

  return (
    <>
      <div className={styles.periodSelector}>
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`${styles.periodBtn} ${period === opt.value ? styles.periodBtnActive : ""}`}
            onClick={() => setPeriod(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className={styles.chartInner}>
        <Chart ref={chartRef} type="bar" data={data} options={options} plugins={[txVerticalLinePlugin]} />
      </div>
      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: chartLineColors.value }}></span>
          <span className={styles.legendLabel}>평가금액</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendLines}>
            <span className={styles.legendBar} style={{ background: chartLineColors.profit }}></span>
            <span className={styles.legendBar} style={{ background: chartLineColors.loss }}></span>
          </div>
          <span className={styles.legendLabel}>손익</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDashed}></span>
          <span className={styles.legendLabel}>거래</span>
        </div>
      </div>
    </>
  );
}
