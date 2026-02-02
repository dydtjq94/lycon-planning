"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus,
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
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { createClient } from "@/lib/supabase/client";
import {
  getStockData,
  getExchangeRate,
  checkApiHealth,
  type StockData,
} from "@/lib/services/financeApiService";
import type {
  PortfolioTransaction,
  PortfolioTransactionInput,
  PortfolioHolding,
  PortfolioAssetType,
  PortfolioTransactionType,
  PortfolioCurrency,
} from "@/types/tables";
import styles from "./PortfolioTab.module.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const ASSET_TYPE_LABELS: Record<PortfolioAssetType, string> = {
  domestic_stock: "국내주식",
  foreign_stock: "해외주식",
  etf: "ETF",
  crypto: "암호화폐",
  fund: "펀드",
  bond: "채권",
  other: "기타",
};

interface PortfolioTabProps {
  profileId: string;
}

export function PortfolioTab({ profileId }: PortfolioTabProps) {
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<"holdings" | "transactions" | null>("holdings");

  // 종목 데이터 (자동완성용)
  const [stocksList, setStocksList] = useState<StockItem[]>([]);
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState<Partial<PortfolioTransactionInput>>({
    type: "buy",
    asset_type: "domestic_stock",
    fee: 0,
  });

  // 달러 단가 입력용 (별도 관리)
  const [usdPriceInput, setUsdPriceInput] = useState("");

  const supabase = createClient();

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

  // 티커 검색
  const handleSearch = async () => {
    if (!searchTicker.trim()) return;

    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const res = await getStockData(searchTicker.trim(), { days: 30 });

      if (res.data.length > 0) {
        const latest = res.data[res.data.length - 1];
        const previous = res.data.length > 1 ? res.data[res.data.length - 2] : latest;
        const change = latest.Close - previous.Close;
        const changePercent = (change / previous.Close) * 100;

        setSearchResult({
          symbol: res.symbol,
          price: latest.Close,
          change,
          changePercent,
          data: res.data,
          dataDate: latest.Date, // 데이터 기준 날짜
        });
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "검색 실패");
    } finally {
      setSearchLoading(false);
    }
  };

  // 검색 결과로 폼 채우기
  const applySearchResult = () => {
    if (!searchResult) return;

    // 티커 형식으로 자산 유형 판별
    let assetType: PortfolioAssetType = "other";

    if (searchResult.symbol.endsWith(".KS") || searchResult.symbol.endsWith(".KQ")) {
      assetType = "domestic_stock";
    } else if (searchResult.symbol.includes("-USD") || searchResult.symbol.includes("-KRW")) {
      assetType = "crypto";
    } else {
      assetType = "foreign_stock";
    }

    // stocks.json에서 종목명 찾기
    const stockInfo = stocksList.find(
      (s) => s.ticker.toUpperCase() === searchResult.symbol.toUpperCase()
    );
    const stockName = stockInfo?.name || searchResult.symbol.split(".")[0];

    // 국내주식만 가격 자동 입력 (원화), 해외는 직접 입력
    const isKoreanStock = assetType === "domestic_stock";

    setFormData({
      ...formData,
      ticker: searchResult.symbol,
      name: stockName,
      price: isKoreanStock ? searchResult.price : undefined,
      asset_type: assetType,
    });
    setShowAddForm(true);
    setSearchResult(null);
    setSearchTicker("");
  };

  // 보유 종목 계산
  const holdings = useMemo<PortfolioHolding[]>(() => {
    const holdingsMap = new Map<string, PortfolioHolding>();

    transactions.forEach((tx) => {
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
  }, [transactions]);

  // 총 투자금액
  const totalInvested = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.total_invested, 0);
  }, [holdings]);

  // 현재 평가금액 (실시간)
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [holdingValues, setHoldingValues] = useState<Map<string, { value: number; price: number }>>(new Map());
  const [valueLoading, setValueLoading] = useState(false);

  useEffect(() => {
    if (holdings.length === 0) {
      setCurrentValue(null);
      setHoldingValues(new Map());
      return;
    }

    const fetchCurrentValue = async () => {
      setValueLoading(true);
      let totalValue = 0;
      const newHoldingValues = new Map<string, { value: number; price: number }>();

      // 환율 가져오기
      let exchangeRate = 1;
      const hasForeign = holdings.some(
        (h) => h.asset_type === "foreign_stock" || h.asset_type === "etf"
      );

      if (hasForeign) {
        try {
          const fxRes = await getExchangeRate("USDKRW", { days: 5 });
          if (fxRes.data.length > 0) {
            exchangeRate = fxRes.data[fxRes.data.length - 1].Close;
          }
        } catch {
          exchangeRate = 1400; // 기본값
        }
      }

      // 각 종목 현재가 조회
      for (const holding of holdings) {
        try {
          const res = await getStockData(holding.ticker, { days: 5 });
          if (res.data.length > 0) {
            const currentPrice = res.data[res.data.length - 1].Close;
            const isForeign = holding.asset_type === "foreign_stock" || holding.asset_type === "etf";

            let holdingValue: number;
            if (isForeign && holding.currency === "USD") {
              holdingValue = holding.quantity * currentPrice * exchangeRate;
            } else {
              holdingValue = holding.quantity * currentPrice;
            }

            totalValue += holdingValue;
            newHoldingValues.set(holding.ticker, { value: holdingValue, price: currentPrice });
          }
        } catch {
          // 가격 조회 실패 시 투자금액 사용
          totalValue += holding.total_invested;
          newHoldingValues.set(holding.ticker, { value: holding.total_invested, price: 0 });
        }
      }

      setCurrentValue(totalValue);
      setHoldingValues(newHoldingValues);
      setValueLoading(false);
    };

    fetchCurrentValue();
  }, [holdings]);

  // 손익 계산
  const profitLoss = currentValue !== null ? currentValue - totalInvested : null;
  const profitLossRate = currentValue !== null && totalInvested > 0
    ? ((currentValue - totalInvested) / totalInvested) * 100
    : null;

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ticker || !formData.name || !formData.quantity || !formData.price || !formData.trade_date) {
      alert("필수 항목을 입력해주세요.");
      return;
    }

    // 총액 계산 (만원 단위)
    const totalAmount = Math.round((formData.quantity * formData.price) / 10000);

    // 해외주식/ETF면 USD, 아니면 KRW
    const isForeign = formData.asset_type === "foreign_stock" || formData.asset_type === "etf";
    const currency = isForeign && formData.exchange_rate && formData.exchange_rate > 1 ? "USD" : "KRW";

    const payload: PortfolioTransactionInput = {
      profile_id: profileId,
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
    setShowAddForm(false);
    setEditingId(null);
    resetForm();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>포트폴리오 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 티커 검색 */}
      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="종목명 또는 티커 검색 (삼성전자, AAPL, BTC)"
              value={searchTicker}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTicker(value);
                filterSuggestions(value);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowSuggestions(false);
                  handleSearch();
                }
              }}
              className={styles.searchInput}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} className={styles.suggestions}>
                {suggestions.map((stock) => (
                  <button
                    key={stock.ticker}
                    type="button"
                    className={styles.suggestionItem}
                    onClick={() => selectSuggestion(stock)}
                  >
                    <span className={styles.suggestionName}>{stock.name}</span>
                    <span className={styles.suggestionTicker}>{stock.ticker}</span>
                    <span className={styles.suggestionMarket}>{stock.market}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={searchLoading || isApiHealthy === false}
            className={styles.searchButton}
          >
            {searchLoading ? <RefreshCw size={18} className={styles.spinning} /> : <Search size={18} />}
          </button>
        </div>

        {isApiHealthy === false && (
          <div className={styles.apiError}>Finance API 연결 불가</div>
        )}

        {searchError && (
          <div className={styles.searchError}>{searchError}</div>
        )}

        {searchResult && (
          <div className={styles.searchResultCard}>
            <div className={styles.searchResultHeader}>
              <div className={styles.searchResultInfo}>
                <span className={styles.searchResultSymbol}>{searchResult.symbol}</span>
                <span className={styles.searchResultPrice}>
                  {searchResult.price.toLocaleString()}
                </span>
              </div>
              <span className={`${styles.searchResultChange} ${searchResult.changePercent >= 0 ? styles.positive : styles.negative}`}>
                {searchResult.changePercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {searchResult.changePercent >= 0 ? "+" : ""}{searchResult.changePercent.toFixed(2)}%
              </span>
            </div>
            <DataDateNotice dataDate={searchResult.dataDate} />
            <div className={styles.searchResultActions}>
              <button onClick={applySearchResult} className={styles.applyBtn}>
                이 종목으로 거래 추가
              </button>
              <button onClick={() => setSearchResult(null)} className={styles.closeBtn}>
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 상단 요약 */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>평가금액</span>
          <span className={styles.summaryValue}>
            {valueLoading ? "계산 중..." : currentValue !== null ? `${currentValue.toLocaleString()}원` : "-"}
          </span>
          {profitLoss !== null && (
            <span className={`${styles.profitLoss} ${profitLoss >= 0 ? styles.profit : styles.loss}`}>
              {profitLoss >= 0 ? "+" : ""}{profitLoss.toLocaleString()}원
              ({profitLossRate !== null ? `${profitLossRate >= 0 ? "+" : ""}${profitLossRate.toFixed(2)}%` : ""})
            </span>
          )}
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>투자금액</span>
          <span className={styles.summaryValue}>{totalInvested.toLocaleString()}원</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>보유 종목</span>
          <span className={styles.summaryValue}>{holdings.length}개</span>
        </div>
      </div>

      {/* 포트폴리오 가치 추이 차트 */}
      {transactions.length > 0 && (
        <div className={styles.chartSection}>
          <h3 className={styles.sectionTitle}>포트폴리오 가치 추이</h3>
          <div className={styles.chartWrapper}>
            <PortfolioValueChart transactions={transactions} />
          </div>
        </div>
      )}

      {/* 거래 추가 버튼 */}
      {!showAddForm && (
        <button className={styles.addButton} onClick={() => setShowAddForm(true)}>
          <Plus size={18} />
          거래 추가
        </button>
      )}

      {/* 거래 추가/수정 폼 */}
      {showAddForm && (
        <div className={styles.formSection}>
          <h3 className={styles.formTitle}>
            {editingId ? "거래 수정" : "새 거래 추가"}
          </h3>
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

              <div className={styles.formGroup}>
                <label>거래일</label>
                <input
                  type="date"
                  value={formData.trade_date || ""}
                  onChange={(e) => setFormData({ ...formData, trade_date: e.target.value })}
                  className={styles.input}
                />
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
            {(formData.asset_type === "foreign_stock" || formData.asset_type === "etf") ? (
              <>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>수량</label>
                    <input
                      type="number"
                      placeholder="10"
                      value={formData.quantity ?? ""}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value ? parseFloat(e.target.value) : undefined })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      className={styles.input}
                    />
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
                      value={formData.price ? `${formData.price.toLocaleString()}원` : ""}
                      readOnly
                      className={styles.input}
                      style={{ background: "#f3f4f6" }}
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
                    <label>수량</label>
                    <input
                      type="number"
                      placeholder="10"
                      value={formData.quantity ?? ""}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value ? parseFloat(e.target.value) : undefined })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      className={styles.input}
                    />
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
                총 거래금액: {(formData.quantity * formData.price).toLocaleString()}원
                {(formData.asset_type === "foreign_stock" || formData.asset_type === "etf") && formData.exchange_rate && formData.exchange_rate > 1 && (
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
      )}

      {/* 보유 종목 */}
      <div className={styles.section}>
        <button
          className={styles.sectionHeader}
          onClick={() => setExpandedSection(expandedSection === "holdings" ? null : "holdings")}
        >
          <h3 className={styles.sectionTitle}>보유 종목</h3>
          <span className={styles.badge}>{holdings.length}</span>
          {expandedSection === "holdings" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {expandedSection === "holdings" && (
          <div className={styles.holdingsList}>
            {holdings.length === 0 ? (
              <div className={styles.emptyState}>보유 종목이 없습니다.</div>
            ) : (
              holdings.map((holding) => {
                const holdingData = holdingValues.get(holding.ticker);
                const currentVal = holdingData?.value ?? null;
                const holdingPL = currentVal !== null ? currentVal - holding.total_invested : null;
                const holdingPLRate = currentVal !== null && holding.total_invested > 0
                  ? ((currentVal - holding.total_invested) / holding.total_invested) * 100
                  : null;

                return (
                  <div key={holding.ticker} className={styles.holdingCard}>
                    <div className={styles.holdingInfo}>
                      <span className={styles.holdingName}>{holding.name}</span>
                      <span className={styles.holdingTicker}>{holding.ticker}</span>
                    </div>
                    <div className={styles.holdingDetails}>
                      <div className={styles.holdingDetail}>
                        <span className={styles.detailLabel}>보유</span>
                        <span className={styles.detailValue}>{holding.quantity.toLocaleString()}주</span>
                      </div>
                      <div className={styles.holdingDetail}>
                        <span className={styles.detailLabel}>평균단가</span>
                        <span className={styles.detailValue}>
                          {holding.avg_price.toLocaleString()}원
                        </span>
                      </div>
                      <div className={styles.holdingDetail}>
                        <span className={styles.detailLabel}>투자금액</span>
                        <span className={styles.detailValue}>{holding.total_invested.toLocaleString()}원</span>
                      </div>
                      <div className={styles.holdingDetail}>
                        <span className={styles.detailLabel}>평가금액</span>
                        <span className={styles.detailValue}>
                          {valueLoading ? "..." : currentVal !== null ? `${currentVal.toLocaleString()}원` : "-"}
                        </span>
                      </div>
                      {holdingPL !== null && !valueLoading && (
                        <div className={styles.holdingDetail}>
                          <span className={styles.detailLabel}>손익</span>
                          <span className={`${styles.detailValue} ${holdingPL >= 0 ? styles.profitText : styles.lossText}`}>
                            {holdingPL >= 0 ? "+" : ""}{holdingPL.toLocaleString()}원
                            ({holdingPLRate !== null ? `${holdingPLRate >= 0 ? "+" : ""}${holdingPLRate.toFixed(1)}%` : ""})
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={`${styles.assetTypeTag} ${styles[holding.asset_type]}`}>
                      {ASSET_TYPE_LABELS[holding.asset_type]}
                    </span>
                  </div>
                );
              })
            )}
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
          <span className={styles.badge}>{transactions.length}</span>
          {expandedSection === "transactions" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {expandedSection === "transactions" && (
          <div className={styles.transactionsList}>
            {transactions.length === 0 ? (
              <div className={styles.emptyState}>거래 내역이 없습니다.</div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className={styles.transactionCard}>
                  <div className={styles.txLeft}>
                    <span className={`${styles.txType} ${styles[tx.type]}`}>
                      {tx.type === "buy" ? "매수" : "매도"}
                    </span>
                    <div className={styles.txInfo}>
                      <span className={styles.txName}>{tx.name}</span>
                      <span className={styles.txTicker}>{tx.ticker}</span>
                    </div>
                  </div>
                  <div className={styles.txCenter}>
                    <span className={styles.txQty}>{tx.quantity.toLocaleString()}주</span>
                    <span className={styles.txPrice}>
                      {tx.currency === "USD" && tx.exchange_rate > 1
                        ? `@ $${(tx.price / tx.exchange_rate).toFixed(2)}`
                        : `@ ${tx.price.toLocaleString()}원`}
                    </span>
                  </div>
                  <div className={styles.txRight}>
                    <span className={styles.txTotal}>{(tx.quantity * tx.price).toLocaleString()}원</span>
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
              ))
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

// 기간 옵션
type ChartPeriod = "1M" | "3M" | "6M" | "1Y" | "ALL";
const PERIOD_OPTIONS: { value: ChartPeriod; label: string; days: number }[] = [
  { value: "1M", label: "1개월", days: 30 },
  { value: "3M", label: "3개월", days: 90 },
  { value: "6M", label: "6개월", days: 180 },
  { value: "1Y", label: "1년", days: 365 },
  { value: "ALL", label: "전체", days: 0 },
];

// 포트폴리오 가치 추이 차트
function PortfolioValueChart({ transactions }: { transactions: PortfolioTransaction[] }) {
  const [period, setPeriod] = useState<ChartPeriod>("1Y");
  const [fullData, setFullData] = useState<{
    labels: string[];
    invested: number[];
    value: number[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // 기간에 따라 필터링된 데이터
  const chartData = useMemo(() => {
    if (!fullData) return null;

    const periodConfig = PERIOD_OPTIONS.find((p) => p.value === period);
    if (!periodConfig || periodConfig.days === 0) {
      return fullData; // 전체
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodConfig.days);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const startIdx = fullData.labels.findIndex((d) => d >= cutoffStr);
    if (startIdx === -1) return fullData;

    return {
      labels: fullData.labels.slice(startIdx),
      invested: fullData.invested.slice(startIdx),
      value: fullData.value.slice(startIdx),
    };
  }, [fullData, period]);

  useEffect(() => {
    if (transactions.length === 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      try {
        // 거래 내역 정렬
        const sortedTx = [...transactions].sort(
          (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
        );

        const firstDate = sortedTx[0].trade_date;
        const today = new Date().toISOString().split("T")[0];

        // 고유 티커 목록 + 통화 정보
        const tickerCurrencyMap = new Map<string, string>();
        transactions.forEach((tx) => {
          if (!tickerCurrencyMap.has(tx.ticker)) {
            tickerCurrencyMap.set(tx.ticker, tx.currency);
          }
        });
        const tickers = [...tickerCurrencyMap.keys()];

        // 해외주식 있는지 확인
        const hasForeignStock = [...tickerCurrencyMap.values()].some((c) => c === "USD");

        const startDate = new Date(firstDate);
        const diffDays = Math.ceil(
          (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // 각 티커의 과거 주가 데이터 가져오기
        const priceDataMap = new Map<string, Map<string, number>>();

        for (const ticker of tickers) {
          try {
            const res = await getStockData(ticker, { days: Math.max(diffDays + 30, 90) });

            const tickerPrices = new Map<string, number>();
            res.data.forEach((d) => {
              tickerPrices.set(d.Date, d.Close);
            });
            priceDataMap.set(ticker, tickerPrices);
          } catch {
            // API 실패 시 빈 데이터
            priceDataMap.set(ticker, new Map());
          }
        }

        // 환율 데이터 가져오기 (해외주식 있을 때만)
        const exchangeRateMap = new Map<string, number>();
        if (hasForeignStock) {
          try {
            const fxRes = await getExchangeRate("USDKRW", { days: Math.max(diffDays + 30, 90) });
            fxRes.data.forEach((d) => {
              exchangeRateMap.set(d.Date, d.Close);
            });
          } catch {
            console.log("환율 데이터 로드 실패, 기본 환율 사용");
          }
        }

        // 날짜 범위 생성 (첫 거래일 ~ 오늘)
        const dates: string[] = [];
        const current = new Date(firstDate);
        const end = new Date(today);

        while (current <= end) {
          dates.push(current.toISOString().split("T")[0]);
          current.setDate(current.getDate() + 1);
        }

        // 날짜별 보유 수량 계산
        const holdingsAtDate = new Map<string, Map<string, number>>();

        dates.forEach((date) => {
          const holdings = new Map<string, number>();

          sortedTx.forEach((tx) => {
            if (tx.trade_date <= date) {
              const currentQty = holdings.get(tx.ticker) || 0;
              if (tx.type === "buy") {
                holdings.set(tx.ticker, currentQty + tx.quantity);
              } else {
                holdings.set(tx.ticker, currentQty - tx.quantity);
              }
            }
          });

          holdingsAtDate.set(date, holdings);
        });

        // 날짜별 투자금액 & 평가금액 계산
        const invested: number[] = [];
        const value: number[] = [];
        let cumulativeInvested = 0;

        dates.forEach((date) => {
          // 투자금액 누적
          sortedTx.forEach((tx) => {
            if (tx.trade_date === date) {
              if (tx.type === "buy") {
                cumulativeInvested += tx.quantity * tx.price;
              } else {
                cumulativeInvested -= tx.quantity * tx.price;
              }
            }
          });
          invested.push(cumulativeInvested);

          // 평가금액 계산 (원화 기준)
          const holdings = holdingsAtDate.get(date) || new Map();
          let totalValue = 0;

          // 해당 날짜 환율 찾기 (해외주식용)
          let exchangeRate = exchangeRateMap.get(date);
          if (!exchangeRate && exchangeRateMap.size > 0) {
            // 가장 가까운 이전 날짜의 환율 찾기
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

              // 해당 날짜 가격, 없으면 가장 가까운 이전 가격 찾기
              let price = tickerPrices?.get(date);

              if (!price && tickerPrices) {
                // 가장 가까운 이전 날짜의 가격 찾기
                const sortedDates = Array.from(tickerPrices.keys()).sort();
                for (const d of sortedDates.reverse()) {
                  if (d <= date) {
                    price = tickerPrices.get(d);
                    break;
                  }
                }
              }

              if (price) {
                // 해외주식이면 환율 적용
                if (currency === "USD" && exchangeRate) {
                  totalValue += qty * price * exchangeRate;
                } else {
                  totalValue += qty * price;
                }
              }
            }
          });

          value.push(totalValue || cumulativeInvested); // 가격 데이터 없으면 투자금액 사용
        });

        // 주 단위로 샘플링 (데이터가 많으면)
        let sampledLabels = dates;
        let sampledInvested = invested;
        let sampledValue = value;

        if (dates.length > 60) {
          // 60일 초과시 주 단위
          sampledLabels = [];
          sampledInvested = [];
          sampledValue = [];

          for (let i = 0; i < dates.length; i += 7) {
            sampledLabels.push(dates[i]);
            sampledInvested.push(invested[i]);
            sampledValue.push(value[i]);
          }
          // 마지막 날짜 추가
          if (sampledLabels[sampledLabels.length - 1] !== dates[dates.length - 1]) {
            sampledLabels.push(dates[dates.length - 1]);
            sampledInvested.push(invested[invested.length - 1]);
            sampledValue.push(value[value.length - 1]);
          }
        }

        setFullData({
          labels: sampledLabels,
          invested: sampledInvested,
          value: sampledValue,
        });
      } catch (err) {
        console.error("Chart data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [transactions]);

  if (loading) {
    return <div className={styles.chartLoading}>차트 데이터 로딩 중...</div>;
  }

  if (!chartData || chartData.labels.length === 0) {
    return <div className={styles.chartLoading}>데이터 없음</div>;
  }

  // 현재 기준 수익률 계산
  const latestValue = chartData.value[chartData.value.length - 1];
  const latestInvested = chartData.invested[chartData.invested.length - 1];
  const profitRate = ((latestValue - latestInvested) / latestInvested * 100).toFixed(1);
  const profitSign = latestValue >= latestInvested ? "+" : "";

  // 구간별 색상 결정 함수
  const getSegmentColor = (idx: number) => {
    return chartData.value[idx] >= chartData.invested[idx] ? "#22c55e" : "#ef4444";
  };

  const getSegmentBgColor = (idx: number) => {
    return chartData.value[idx] >= chartData.invested[idx]
      ? "rgba(34, 197, 94, 0.15)"
      : "rgba(239, 68, 68, 0.15)";
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    labels: chartData.labels,
    datasets: [
      {
        label: `평가금액 (${profitSign}${profitRate}%)`,
        data: chartData.value,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
        tension: 0.4,
        segment: {
          borderColor: (ctx: { p0DataIndex: number }) => getSegmentColor(ctx.p0DataIndex),
          backgroundColor: (ctx: { p0DataIndex: number }) => getSegmentBgColor(ctx.p0DataIndex),
        },
      },
      {
        label: "투자금액",
        data: chartData.invested,
        borderColor: "#9ca3af",
        backgroundColor: "transparent",
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: { boxWidth: 12, font: { size: 11 } },
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        callbacks: {
          title: (items: { label: string }[]) => items[0]?.label || "",
          label: (context: { dataset: { label?: string }; raw: unknown }) =>
            `${context.dataset.label || ""}: ${(context.raw as number).toLocaleString()}원`,
          afterBody: (items: { raw: unknown }[]) => {
            if (items.length >= 2) {
              const value = items[0]?.raw as number;
              const invested = items[1]?.raw as number;
              const diff = value - invested;
              const percent = invested > 0 ? ((diff / invested) * 100).toFixed(2) : "0";
              const sign = diff >= 0 ? "+" : "";
              return `\n수익: ${sign}${diff.toLocaleString()}원 (${sign}${percent}%)`;
            }
            return "";
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { maxTicksLimit: 6, font: { size: 11 } },
      },
      y: {
        display: true,
        beginAtZero: false,
        grid: { color: "#f3f4f6" },
        ticks: {
          callback: (value: unknown) => `${(value as number).toLocaleString()}`,
          font: { size: 11 },
        },
      },
    },
    elements: {
      point: { radius: 2, hoverRadius: 4 },
      line: { borderWidth: 2 },
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
        <Line data={data} options={options} />
      </div>
    </>
  );
}
