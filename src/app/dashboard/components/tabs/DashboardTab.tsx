"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { useSnapshots, usePortfolioTransactions, usePortfolioChartPriceData } from "@/hooks/useFinancialData";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatMoney, wonToManwon } from "@/lib/utils";
import { getIncomes } from "@/lib/services/incomeService";
import { getExpenses } from "@/lib/services/expenseService";
import { getSavings } from "@/lib/services/savingsService";
import { getDebts } from "@/lib/services/debtService";
import { getNationalPensions } from "@/lib/services/nationalPensionService";
import { getRetirementPensions } from "@/lib/services/retirementPensionService";
import { getPersonalPensions } from "@/lib/services/personalPensionService";
import { getRealEstates } from "@/lib/services/realEstateService";
import { getPhysicalAssets } from "@/lib/services/physicalAssetService";
import { runSimulationV2 } from "@/lib/services/simulationEngineV2";
import { calculateEndYear } from "@/lib/utils/chartDataTransformer";
import type { Simulation, LifeCycleSettings } from "@/types";
import {
  ArrowRight,
  TrendingUp,
  Activity,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import styles from "./DashboardTab.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

const PERIODS = [
  { id: "ALL", label: "전체" },
  { id: "1M", label: "1개월", months: 1 },
  { id: "3M", label: "3개월", months: 3 },
  { id: "1Y", label: "1년", months: 12 },
  { id: "3Y", label: "3년", months: 36 },
  { id: "5Y", label: "5년", months: 60 },
  { id: "10Y", label: "10년", months: 120 },
] as const;

interface DashboardTabProps {
  simulationId: string;
  birthYear: number;
  spouseBirthYear: number | null;
  retirementAge: number | null;
  unreadMessageCount: number;
  onNavigate: (section: string) => void;
  profileId?: string;
  profileName?: string;
  accountCount?: number;
  onOpenAccountModal?: () => void;
  simulations?: Simulation[];
  lifeCycleSettings?: LifeCycleSettings;
}

interface SimLine {
  title: string;
  data: { x: number; y: number }[];
}

export function DashboardTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  profileId,
  profileName,
  accountCount,
  onOpenAccountModal,
  unreadMessageCount,
  onNavigate,
  simulations,
  lifeCycleSettings,
}: DashboardTabProps) {
  const [simLines, setSimLines] = useState<SimLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("ALL");
  const [hoveredPoint, setHoveredPoint] = useState<{ value: number; date: string; index: number } | null>(null);
  const hoveredPointRef = useRef<{ value: number; date: string; index: number } | null>(null);
  const chartRef = useRef<any>(null);

  const { data: snapshots, isLoading: snapshotsLoading } = useSnapshots(
    profileId || "",
    !!profileId
  );

  const {
    chartScaleColors,
    chartLineColors,
    toRgba,
    colors,
  } = useChartTheme();

  // Portfolio data
  const { data: portfolioTransactions = [], isLoading: ptxLoading } = usePortfolioTransactions(
    profileId || "",
    !!profileId
  );

  const { data: priceCache, isLoading: priceCacheLoading } = usePortfolioChartPriceData(
    profileId || "",
    portfolioTransactions,
    !!profileId && portfolioTransactions.length > 0
  );

  // Latest snapshot
  const latestSnapshot =
    snapshots && snapshots.length > 0 ? snapshots[0] : null;

  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
  }, [profileId]);

  // Load all simulation results
  useEffect(() => {
    if (!simulations?.length || !lifeCycleSettings) return;
    let cancelled = false;

    const loadAllSims = async () => {
      const results: SimLine[] = [];
      for (const sim of simulations) {
        try {
          const [incomes, expenses, savings, debts, np, rp, pp, re, pa] =
            await Promise.all([
              getIncomes(sim.id),
              getExpenses(sim.id),
              getSavings(sim.id),
              getDebts(sim.id),
              getNationalPensions(sim.id),
              getRetirementPensions(sim.id),
              getPersonalPensions(sim.id),
              getRealEstates(sim.id),
              getPhysicalAssets(sim.id),
            ]);
          const lcs = sim.life_cycle_settings || lifeCycleSettings;
          const endYear = calculateEndYear(
            birthYear,
            spouseBirthYear,
            lcs.selfLifeExpectancy,
            lcs.spouseLifeExpectancy
          );
          const startYear = sim.start_year || new Date().getFullYear();
          const result = runSimulationV2(
            {
              incomes,
              expenses,
              savings,
              debts,
              nationalPensions: np,
              retirementPensions: rp,
              personalPensions: pp,
              realEstates: re,
              physicalAssets: pa,
            },
            {
              birthYear,
              retirementAge: lcs.selfRetirementAge,
              spouseBirthYear: spouseBirthYear ?? undefined,
              spouseRetirementAge: lcs.spouseRetirementAge,
            },
            endYear - startYear,
            sim.simulation_assumptions,
            sim.cash_flow_priorities,
            sim.start_year,
            sim.start_month
          );
          results.push({
            title: sim.title,
            data: result.snapshots.map((s) => ({ x: s.year, y: s.netWorth })),
          });
        } catch {
          // skip failed simulations
        }
      }
      if (!cancelled) setSimLines(results);
    };
    loadAllSims();
    return () => {
      cancelled = true;
    };
  }, [simulations, lifeCycleSettings, birthYear, spouseBirthYear]);

  // Snapshots come in DESC order (newest first) - reverse for chart
  const chronoSnapshots = useMemo(
    () => (snapshots ? [...snapshots].reverse() : []),
    [snapshots]
  );

  // Filter snapshots by selected period
  const filteredSnapshots = useMemo(() => {
    if (selectedPeriod === "ALL" || chronoSnapshots.length === 0) {
      return chronoSnapshots;
    }
    const period = PERIODS.find((p) => p.id === selectedPeriod);
    if (!period || !("months" in period)) return chronoSnapshots;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - period.months);
    return chronoSnapshots.filter(
      (s) => new Date(s.recorded_at).getTime() >= cutoff.getTime()
    );
  }, [chronoSnapshots, selectedPeriod]);

  // Net worth change based on selected period
  const netWorthChange = useMemo(() => {
    if (filteredSnapshots.length < 1 || !latestSnapshot) return null;
    const firstInPeriod = filteredSnapshots[0];
    const latestNetWorth = latestSnapshot.net_worth || 0;
    const firstNetWorth = firstInPeriod.net_worth || 0;
    const change = latestNetWorth - firstNetWorth;
    const pct =
      firstNetWorth !== 0
        ? Math.round((change / Math.abs(firstNetWorth)) * 100)
        : null;
    return { change, pct };
  }, [filteredSnapshots, latestSnapshot]);

  // Portfolio time-series data (value over time from transactions + prices)
  const portfolioTimeSeries = useMemo(() => {
    if (!priceCache || portfolioTransactions.length === 0) return null;

    const { priceDataMap, exchangeRateMap, tickerCurrencyMap, dates } = priceCache;

    const sortedTx = [...portfolioTransactions].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    );

    const value: number[] = [];

    dates.forEach((date) => {
      // Build holdings up to this date
      const holdings = new Map<string, number>();
      const investedMap = new Map<string, number>();

      sortedTx.forEach((tx) => {
        if (tx.trade_date <= date) {
          const currentQty = holdings.get(tx.ticker) || 0;
          const currentInvested = investedMap.get(tx.ticker) || 0;

          if (tx.type === "buy") {
            holdings.set(tx.ticker, currentQty + tx.quantity);
            investedMap.set(tx.ticker, currentInvested + tx.quantity * tx.price);
          } else {
            const newQty = currentQty - tx.quantity;
            const sellRatio = currentQty > 0 ? tx.quantity / currentQty : 0;
            holdings.set(tx.ticker, newQty);
            investedMap.set(tx.ticker, currentInvested * (1 - sellRatio));
          }
        }
      });

      // Calculate value using prices
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

      let totalValue = 0;
      let totalInvested = 0;
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
          totalInvested += investedMap.get(ticker) || 0;
        }
      });

      value.push(totalValue || totalInvested);
    });

    return { labels: dates, value };
  }, [priceCache, portfolioTransactions]);

  // Filter portfolio data by selected period
  const filteredPortfolio = useMemo(() => {
    if (!portfolioTimeSeries) return null;

    if (selectedPeriod === "ALL") {
      return portfolioTimeSeries;
    }

    const period = PERIODS.find((p) => p.id === selectedPeriod);
    if (!period || !("months" in period)) return portfolioTimeSeries;

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - period.months);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const startIdx = portfolioTimeSeries.labels.findIndex((d) => d >= cutoffStr);
    if (startIdx === -1) return portfolioTimeSeries;

    return {
      labels: portfolioTimeSeries.labels.slice(startIdx),
      value: portfolioTimeSeries.value.slice(startIdx),
    };
  }, [portfolioTimeSeries, selectedPeriod]);

  // Crosshair plugin for vertical dashed line on hover (uses ref to avoid re-creating)
  const crosshairPlugin = useMemo(() => ({
    id: 'dashboardCrosshair',
    afterDraw: (chart: any) => {
      const hp = hoveredPointRef.current;
      if (hp === null) return;
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta.data[hp.index]) return;
      const x = meta.data[hp.index].x;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = chartScaleColors.tickColor;
      ctx.lineWidth = 1;
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [chartScaleColors.tickColor]);

  // Skeleton loading
  if (isLoading || snapshotsLoading) {
    return (
      <div className={styles.skeletonContainer}>
        <div className={styles.skeletonTop}>
          <div className={`${styles.skeletonTopLeft} ${styles.skeleton}`} />
          <div className={`${styles.skeletonTopRight} ${styles.skeleton}`} />
        </div>
        <div className={styles.skeletonGrid}>
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className={`${styles.skeletonCard} ${styles.skeleton}`}
            />
          ))}
        </div>
      </div>
    );
  }

  const periodLabel =
    selectedPeriod === "ALL"
      ? "전체"
      : PERIODS.find((p) => p.id === selectedPeriod)?.label || "전체";

  return (
    <div className={styles.container}>
      {/* Greeting */}
      <div className={styles.greetingRow}>
        {profileName && (
          <h1 className={styles.greeting}>안녕하세요, {profileName}님</h1>
        )}
        {onOpenAccountModal && (
          <button className={styles.accountBtn} onClick={onOpenAccountModal}>
            <CreditCard size={15} />
            <span>계좌 {accountCount ?? 0}개</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Top section: net worth chart + portfolio chart */}
      <div className={styles.topSection}>
        <div className={styles.chartPanel} onMouseLeave={() => { hoveredPointRef.current = null; setHoveredPoint(null); }}>
          {chronoSnapshots.length > 0 ? (
            <>
              <div className={styles.netWorthLabel}>순자산</div>
              <div className={styles.netWorthAmount}>
                {formatMoney(hoveredPoint ? hoveredPoint.value : (latestSnapshot?.net_worth || 0))}
              </div>
              <div className={styles.changeIndicator}>
                {hoveredPoint ? (
                  <>
                    <span className={styles.changeDate}>{hoveredPoint.date}</span>
                    {(() => {
                      const first = filteredSnapshots[0];
                      if (!first) return null;
                      const change = hoveredPoint.value - (first.net_worth || 0);
                      const pct = first.net_worth ? Math.round((change / Math.abs(first.net_worth)) * 100) : null;
                      return (
                        <span className={change >= 0 ? styles.positive : styles.negative}>
                          {change >= 0 ? "+ " : "- "}
                          {formatMoney(Math.abs(change))}
                          {pct !== null && ` (${change >= 0 ? "+" : ""}${pct}%)`}
                        </span>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <span className={styles.changeLabel}>{periodLabel}</span>
                    {netWorthChange ? (
                      <span
                        className={
                          netWorthChange.change >= 0
                            ? styles.positive
                            : styles.negative
                        }
                      >
                        {netWorthChange.change >= 0 ? "+ " : "- "}
                        {formatMoney(Math.abs(netWorthChange.change))}
                        {netWorthChange.pct !== null &&
                          ` (${netWorthChange.change >= 0 ? "+" : ""}${netWorthChange.pct}%)`}
                      </span>
                    ) : (
                      <span className={styles.muted}>첫 기록</span>
                    )}
                  </>
                )}
              </div>
              <div className={styles.chartContainer}>
                <Line
                  ref={chartRef}
                  plugins={[crosshairPlugin]}
                  data={{
                    datasets: [
                      {
                        data: filteredSnapshots.map((s) => ({
                          x: new Date(s.recorded_at).getTime(),
                          y: s.net_worth || 0,
                        })),
                        borderColor: chartLineColors.price,
                        borderWidth: 2,
                        pointRadius: filteredSnapshots.map((_, i) => hoveredPoint?.index === i ? 5 : 0),
                        pointBackgroundColor: chartLineColors.price,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHitRadius: 8,
                        fill: true,
                        backgroundColor: (ctx: any) => {
                          if (!ctx.chart.chartArea) return "transparent";
                          const gradient =
                            ctx.chart.ctx.createLinearGradient(
                              0,
                              ctx.chart.chartArea.top,
                              0,
                              ctx.chart.chartArea.bottom
                            );
                          gradient.addColorStop(
                            0,
                            toRgba(chartLineColors.price, 0.15)
                          );
                          gradient.addColorStop(
                            1,
                            toRgba(chartLineColors.price, 0)
                          );
                          return gradient;
                        },
                        tension: 0.3,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { right: 20 } },
                    interaction: {
                      mode: 'index' as const,
                      intersect: false,
                    },
                    onHover: (_event: any, elements: any[]) => {
                      if (elements.length > 0) {
                        const idx = elements[0].index;
                        if (hoveredPointRef.current?.index === idx) return;
                        const snapshot = filteredSnapshots[idx];
                        if (!snapshot) return;
                        const d = new Date(snapshot.recorded_at);
                        const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
                        const pt = { value: snapshot.net_worth || 0, date: dateStr, index: idx };
                        hoveredPointRef.current = pt;
                        setHoveredPoint(pt);
                      } else if (hoveredPointRef.current !== null) {
                        hoveredPointRef.current = null;
                        setHoveredPoint(null);
                      }
                    },
                    plugins: {
                      tooltip: { enabled: false },
                      legend: { display: false },
                    },
                    scales: {
                      x: {
                        type: "time",
                        display: true,
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                          color: chartScaleColors.tickColor,
                          font: { size: 10 },
                          source: "data" as const,
                          maxRotation: 0,
                        },
                        time: {
                          tooltipFormat: "yyyy.MM.dd",
                          displayFormats: {
                            day: "yy.M",
                            month: "yy.M",
                            year: "yyyy",
                          },
                        },
                      },
                      y: {
                        display: true,
                        position: "left" as const,
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                          color: chartScaleColors.tickColor,
                          font: { size: 10 },
                          maxTicksLimit: 4,
                          callback: (v: any) => formatMoney(v),
                        },
                        beginAtZero: false,
                      },
                    },
                  }}
                />
              </div>
              <div className={styles.periodSelector}>
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    className={`${styles.periodBtn} ${selectedPeriod === p.id ? styles.periodBtnActive : ""}`}
                    onClick={() => setSelectedPeriod(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.emptyTopSection}>
              <TrendingUp size={28} className={styles.emptyIcon} />
              <span>자산 기록이 없습니다</span>
            </div>
          )}
        </div>

        <div className={styles.portfolioPanel} onClick={() => onNavigate("portfolio")}>
          {filteredPortfolio && filteredPortfolio.value.length > 0 ? (
            <>
              <div className={styles.netWorthLabel}>투자 포트폴리오</div>
              <div className={styles.netWorthAmount}>
                {formatMoney(wonToManwon(filteredPortfolio.value[filteredPortfolio.value.length - 1]))}
              </div>
              <div className={styles.changeIndicator}>
                {(() => {
                  const firstVal = filteredPortfolio.value[0];
                  const lastVal = filteredPortfolio.value[filteredPortfolio.value.length - 1];
                  const change = lastVal - firstVal;
                  const changeManwon = wonToManwon(change);
                  const pct = firstVal !== 0 ? Math.round((change / Math.abs(firstVal)) * 100) : null;
                  return (
                    <>
                      <span className={styles.changeLabel}>{periodLabel}</span>
                      <span className={change >= 0 ? styles.positive : styles.negative}>
                        {change >= 0 ? "+ " : "- "}
                        {formatMoney(Math.abs(changeManwon))}
                        {pct !== null && ` (${change >= 0 ? "+" : ""}${pct}%)`}
                      </span>
                    </>
                  );
                })()}
              </div>
              <div className={styles.chartContainer}>
                <Line
                  data={{
                    datasets: [
                      {
                        data: filteredPortfolio.labels.map((label, idx) => ({
                          x: new Date(label).getTime(),
                          y: filteredPortfolio.value[idx],
                        })),
                        borderColor: colors[1] || chartLineColors.price,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHitRadius: 8,
                        fill: true,
                        backgroundColor: (ctx: any) => {
                          if (!ctx.chart.chartArea) return "transparent";
                          const c = colors[1] || chartLineColors.price;
                          const gradient = ctx.chart.ctx.createLinearGradient(
                            0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom
                          );
                          gradient.addColorStop(0, toRgba(c, 0.15));
                          gradient.addColorStop(1, toRgba(c, 0));
                          return gradient;
                        },
                        tension: 0.3,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { right: 20 } },
                    plugins: {
                      tooltip: { enabled: false },
                      legend: { display: false },
                    },
                    scales: {
                      x: {
                        type: "time",
                        display: true,
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                          color: chartScaleColors.tickColor,
                          font: { size: 10 },
                          source: "data" as const,
                          maxRotation: 0,
                        },
                        time: {
                          tooltipFormat: "yyyy.MM.dd",
                          displayFormats: {
                            day: "yy.M",
                            month: "yy.M",
                            year: "yyyy",
                          },
                        },
                      },
                      y: {
                        display: true,
                        position: "left" as const,
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                          color: chartScaleColors.tickColor,
                          font: { size: 10 },
                          maxTicksLimit: 4,
                          callback: (v: any) => formatMoney(wonToManwon(v as number)),
                        },
                        beginAtZero: false,
                      },
                    },
                  }}
                />
              </div>
            </>
          ) : (
            <div className={styles.emptyTopSection}>
              <Activity size={24} className={styles.emptyIcon} />
              <span>{ptxLoading || priceCacheLoading ? "포트폴리오 로딩 중..." : "포트폴리오 데이터가 없습니다"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Simulation section */}
      <div className={styles.simSection}>
        {simLines.length > 0 ? (
          simLines.map((line, i) => (
            <div
              key={i}
              className={`${styles.card} ${styles.clickableCard}`}
              onClick={() => onNavigate("simulation")}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>{line.title}</span>
                <button
                  className={styles.moreBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate("simulation");
                  }}
                >
                  상세 <ArrowRight size={12} />
                </button>
              </div>
              <div className={styles.simChartContainer}>
                <Line
                  data={{
                    datasets: [
                      {
                        data: line.data,
                        borderColor: colors[i % colors.length],
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHitRadius: 8,
                        fill: true,
                        backgroundColor: (ctx: any) => {
                          if (!ctx.chart.chartArea) return "transparent";
                          const gradient =
                            ctx.chart.ctx.createLinearGradient(
                              0,
                              ctx.chart.chartArea.top,
                              0,
                              ctx.chart.chartArea.bottom
                            );
                          gradient.addColorStop(
                            0,
                            toRgba(colors[i % colors.length], 0.15)
                          );
                          gradient.addColorStop(
                            1,
                            toRgba(colors[i % colors.length], 0)
                          );
                          return gradient;
                        },
                        tension: 0.3,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      tooltip: { enabled: false },
                      legend: { display: false },
                    },
                    scales: {
                      x: {
                        type: "linear" as const,
                        display: true,
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                          color: chartScaleColors.tickColor,
                          font: { size: 10 },
                          callback: (v: any) => v,
                          maxTicksLimit: 5,
                        },
                      },
                      y: {
                        display: true,
                        position: "left" as const,
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                          color: chartScaleColors.tickColor,
                          font: { size: 10 },
                          maxTicksLimit: 3,
                          callback: (v: any) => formatMoney(v),
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <div
            className={`${styles.card} ${styles.clickableCard}`}
            onClick={() => onNavigate("simulation")}
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>시뮬레이션</span>
            </div>
            <div className={styles.emptyState}>
              <Activity size={24} className={styles.emptyIcon} />
              <span>시뮬레이션 데이터가 없습니다</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
