"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Search } from "lucide-react";
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
import {
  getIndexData,
  getExchangeRate,
  getStockData,
  checkApiHealth,
  type StockData,
} from "@/lib/services/financeApiService";
import styles from "./PortfolioTab.module.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface MarketIndex {
  symbol: string;
  name: string;
  data: StockData[];
  loading: boolean;
  error: string | null;
}

interface ExchangeRateData {
  currency: string;
  name: string;
  data: { Date: string; Close: number }[];
  loading: boolean;
  error: string | null;
}

const INDICES = [
  { symbol: "KS11", name: "코스피" },
  { symbol: "KQ11", name: "코스닥" },
  { symbol: "DJI", name: "다우존스" },
  { symbol: "IXIC", name: "나스닥" },
];

const CURRENCIES = [
  { currency: "USD/KRW", name: "달러/원" },
  { currency: "EUR/KRW", name: "유로/원" },
  { currency: "JPY/KRW", name: "엔/원" },
];

export function PortfolioTab() {
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);
  const [indices, setIndices] = useState<MarketIndex[]>(
    INDICES.map((i) => ({ ...i, data: [], loading: true, error: null }))
  );
  const [exchangeRates, setExchangeRates] = useState<ExchangeRateData[]>(
    CURRENCIES.map((c) => ({ ...c, data: [], loading: true, error: null }))
  );
  const [searchSymbol, setSearchSymbol] = useState("");
  const [searchResult, setSearchResult] = useState<{
    symbol: string;
    data: StockData[];
    loading: boolean;
    error: string | null;
  } | null>(null);

  // API 헬스 체크
  useEffect(() => {
    checkApiHealth().then(setIsApiHealthy);
  }, []);

  // 지수 데이터 로드
  useEffect(() => {
    if (isApiHealthy === false) return;

    INDICES.forEach((idx, i) => {
      getIndexData(idx.symbol, { days: 30 })
        .then((res) => {
          setIndices((prev) =>
            prev.map((item, j) =>
              j === i ? { ...item, data: res.data, loading: false } : item
            )
          );
        })
        .catch((err) => {
          setIndices((prev) =>
            prev.map((item, j) =>
              j === i ? { ...item, loading: false, error: err.message } : item
            )
          );
        });
    });
  }, [isApiHealthy]);

  // 환율 데이터 로드
  useEffect(() => {
    if (isApiHealthy === false) return;

    CURRENCIES.forEach((curr, i) => {
      getExchangeRate(curr.currency, { days: 30 })
        .then((res) => {
          setExchangeRates((prev) =>
            prev.map((item, j) =>
              j === i ? { ...item, data: res.data, loading: false } : item
            )
          );
        })
        .catch((err) => {
          setExchangeRates((prev) =>
            prev.map((item, j) =>
              j === i ? { ...item, loading: false, error: err.message } : item
            )
          );
        });
    });
  }, [isApiHealthy]);

  // 종목 검색
  const handleSearch = async () => {
    if (!searchSymbol.trim()) return;

    setSearchResult({ symbol: searchSymbol, data: [], loading: true, error: null });

    try {
      const res = await getStockData(searchSymbol, { days: 30 });
      setSearchResult({ symbol: searchSymbol, data: res.data, loading: false, error: null });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "검색 실패";
      setSearchResult({ symbol: searchSymbol, data: [], loading: false, error: errorMessage });
    }
  };

  // 변동률 계산
  const calculateChange = (data: StockData[] | { Date: string; Close: number }[]) => {
    if (data.length < 2) return { value: 0, percent: 0 };
    const latest = data[data.length - 1].Close;
    const previous = data[data.length - 2].Close;
    const change = latest - previous;
    const percent = (change / previous) * 100;
    return { value: change, percent };
  };

  // 미니 차트 옵션
  const miniChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: {
      point: { radius: 0 },
      line: { tension: 0.4, borderWidth: 2 },
    },
  };

  // 미니 차트 데이터 생성
  const createMiniChartData = (data: StockData[] | { Date: string; Close: number }[], isPositive: boolean) => ({
    labels: data.map((d) => d.Date),
    datasets: [
      {
        data: data.map((d) => d.Close),
        borderColor: isPositive ? "#22c55e" : "#ef4444",
        backgroundColor: isPositive ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
        fill: true,
      },
    ],
  });

  if (isApiHealthy === null) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>API 상태 확인 중...</div>
      </div>
    );
  }

  if (isApiHealthy === false) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <RefreshCw size={48} className={styles.errorIcon} />
          <h3>Finance API에 연결할 수 없습니다</h3>
          <p>FastAPI 서버가 실행 중인지 확인해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 종목 검색 */}
      <div className={styles.searchSection}>
        <h2 className={styles.sectionTitle}>종목 검색</h2>
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="종목코드 입력 (예: 005930, AAPL)"
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className={styles.searchInput}
          />
          <button onClick={handleSearch} className={styles.searchButton}>
            <Search size={18} />
          </button>
        </div>

        {searchResult && (
          <div className={styles.searchResultCard}>
            {searchResult.loading ? (
              <div className={styles.cardLoading}>로딩 중...</div>
            ) : searchResult.error ? (
              <div className={styles.cardError}>{searchResult.error}</div>
            ) : searchResult.data.length > 0 ? (
              <>
                <div className={styles.cardHeader}>
                  <span className={styles.cardSymbol}>{searchResult.symbol}</span>
                  <span className={styles.cardPrice}>
                    {searchResult.data[searchResult.data.length - 1].Close.toLocaleString()}
                  </span>
                  {(() => {
                    const change = calculateChange(searchResult.data);
                    return (
                      <span className={`${styles.cardChange} ${change.percent >= 0 ? styles.positive : styles.negative}`}>
                        {change.percent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {change.percent >= 0 ? "+" : ""}{change.percent.toFixed(2)}%
                      </span>
                    );
                  })()}
                </div>
                <div className={styles.miniChart}>
                  <Line
                    data={createMiniChartData(searchResult.data, calculateChange(searchResult.data).percent >= 0)}
                    options={miniChartOptions}
                  />
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* 주요 지수 */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>주요 지수</h2>
        <div className={styles.cardGrid}>
          {indices.map((idx) => {
            const change = calculateChange(idx.data);
            const isPositive = change.percent >= 0;

            return (
              <div key={idx.symbol} className={styles.card}>
                {idx.loading ? (
                  <div className={styles.cardLoading}>로딩 중...</div>
                ) : idx.error ? (
                  <div className={styles.cardError}>{idx.error}</div>
                ) : (
                  <>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardName}>{idx.name}</span>
                      <span className={`${styles.cardChange} ${isPositive ? styles.positive : styles.negative}`}>
                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {isPositive ? "+" : ""}{change.percent.toFixed(2)}%
                      </span>
                    </div>
                    <div className={styles.cardPrice}>
                      {idx.data.length > 0 ? idx.data[idx.data.length - 1].Close.toLocaleString() : "-"}
                    </div>
                    <div className={styles.miniChart}>
                      <Line
                        data={createMiniChartData(idx.data, isPositive)}
                        options={miniChartOptions}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 환율 */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>환율</h2>
        <div className={styles.cardGrid}>
          {exchangeRates.map((rate) => {
            const change = calculateChange(rate.data);
            const isPositive = change.percent >= 0;

            return (
              <div key={rate.currency} className={styles.card}>
                {rate.loading ? (
                  <div className={styles.cardLoading}>로딩 중...</div>
                ) : rate.error ? (
                  <div className={styles.cardError}>{rate.error}</div>
                ) : (
                  <>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardName}>{rate.name}</span>
                      <span className={`${styles.cardChange} ${isPositive ? styles.positive : styles.negative}`}>
                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {isPositive ? "+" : ""}{change.percent.toFixed(2)}%
                      </span>
                    </div>
                    <div className={styles.cardPrice}>
                      {rate.data.length > 0 ? rate.data[rate.data.length - 1].Close.toLocaleString() : "-"}
                    </div>
                    <div className={styles.miniChart}>
                      <Line
                        data={createMiniChartData(rate.data, isPositive)}
                        options={miniChartOptions}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
