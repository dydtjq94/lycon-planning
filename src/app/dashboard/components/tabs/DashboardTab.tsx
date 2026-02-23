"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Line, Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { useSnapshots, usePortfolioTransactions, usePortfolioChartPriceData, useTodaySnapshot, useSnapshotItems } from "@/hooks/useFinancialData";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatMoney, formatWon } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { CustomHolding } from "@/types/tables";
import { getNextBooking, type NextBooking } from "@/lib/services/bookingService";
import { getConversations, getMessages, type Conversation, type Message } from "@/lib/services/messageService";
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
  Calendar,
  MessageSquare,
} from "lucide-react";
import styles from "./DashboardTab.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip
);


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
  const [simLoading, setSimLoading] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [customHoldings, setCustomHoldings] = useState<CustomHolding[]>([]);
  const [portfolioAccounts, setPortfolioAccounts] = useState<{ id: string; account_type: string }[]>([]);
  const [nextBooking, setNextBooking] = useState<NextBooking | null>(null);
  const [recentChat, setRecentChat] = useState<{ expertName: string; lastMessage: string; lastDate: string; unread: number } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ value: number; date: string; index: number } | null>(null);
  const hoveredPointRef = useRef<{ value: number; date: string; index: number } | null>(null);
  const chartRef = useRef<any>(null);

  const { data: snapshots, isLoading: snapshotsLoading } = useSnapshots(
    profileId || "",
    !!profileId
  );

  // Today's snapshot + items for asset list
  const { data: todaySnapshot } = useTodaySnapshot(profileId || "", !!profileId);
  const { data: snapshotItems = [] } = useSnapshotItems(todaySnapshot?.id, !!todaySnapshot?.id);

  // 자산 항목: 저축/투자 (snapshot summary) + 부동산/실물자산 (snapshot items)
  const assetItems = useMemo(() => {
    const items: { id: string; title: string; amount: number }[] = [];

    // 저축 (pre-computed by CurrentAssetTab → snapshot summary)
    if (todaySnapshot && todaySnapshot.savings > 0) {
      items.push({ id: "_savings", title: "저축", amount: todaySnapshot.savings });
    }
    // 투자 (pre-computed by CurrentAssetTab → snapshot summary)
    if (todaySnapshot && todaySnapshot.investments > 0) {
      items.push({ id: "_investments", title: "투자", amount: todaySnapshot.investments });
    }

    // 부동산 items
    snapshotItems
      .filter(i => {
        if (i.category !== "asset") return false;
        const meta = (i.metadata || {}) as Record<string, unknown>;
        if (meta.housing_type === "무상") return false;
        return meta.purpose === "residential" || meta.purpose === "investment" ||
          ["apartment", "house", "officetel", "land", "commercial"].includes(i.item_type);
      })
      .forEach(i => items.push({ id: i.id, title: i.title, amount: i.amount }));

    // 실물자산 items
    snapshotItems
      .filter(i => i.category === "asset" && ["car", "precious_metal", "art"].includes(i.item_type))
      .forEach(i => items.push({ id: i.id, title: i.title, amount: i.amount }));

    return items.sort((a, b) => b.amount - a.amount);
  }, [snapshotItems, todaySnapshot]);

  // 부채 항목: 금융부채 (snapshot items) + 담보대출 (asset item metadata)
  const debtItems = useMemo(() => {
    const items: { id: string; title: string; amount: number }[] = [];

    // 금융 부채 (순수 부채 - source 없는 것)
    snapshotItems
      .filter(i => i.category === "debt")
      .forEach(i => {
        const meta = (i.metadata || {}) as Record<string, unknown>;
        if (!meta.source) {
          items.push({ id: i.id, title: i.title, amount: i.amount });
        }
      });

    // 부동산/실물자산 담보대출 (asset item metadata에서)
    snapshotItems
      .filter(i => i.category === "asset")
      .forEach(i => {
        const meta = (i.metadata || {}) as Record<string, unknown>;
        const loanAmt = meta.loan_amount as number | undefined;
        const hasLoan = meta.has_loan as boolean | undefined;
        if (hasLoan && loanAmt && loanAmt > 0) {
          items.push({ id: `${i.id}-loan`, title: `${i.title} 대출`, amount: loanAmt });
        }
      });

    return items.sort((a, b) => b.amount - a.amount);
  }, [snapshotItems]);

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

  // Load portfolio accounts
  useEffect(() => {
    if (!profileId) return;
    const supabase = createClient();
    supabase
      .from("accounts")
      .select("id, account_type")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .in("account_type", ["general", "isa", "pension_savings", "irp", "dc"])
      .then(({ data }) => {
        if (data) setPortfolioAccounts(data);
      });
  }, [profileId]);

  // Filter account IDs by type
  const generalAccountIds = useMemo(
    () => new Set(portfolioAccounts.filter(a => ["general", "isa"].includes(a.account_type)).map(a => a.id)),
    [portfolioAccounts],
  );
  const pensionAccountIds = useMemo(
    () => new Set(portfolioAccounts.filter(a => ["pension_savings", "irp", "dc"].includes(a.account_type)).map(a => a.id)),
    [portfolioAccounts],
  );

  // Filter transactions by account type
  const generalTransactions = useMemo(
    () => portfolioTransactions.filter(tx => tx.account_id && generalAccountIds.has(tx.account_id)),
    [portfolioTransactions, generalAccountIds],
  );
  const pensionTransactions = useMemo(
    () => portfolioTransactions.filter(tx => tx.account_id && pensionAccountIds.has(tx.account_id)),
    [portfolioTransactions, pensionAccountIds],
  );

  // Separate price caches for each investment type
  const { data: generalPriceCache, isLoading: generalPriceCacheLoading } = usePortfolioChartPriceData(
    profileId || "",
    generalTransactions,
    !!profileId && generalTransactions.length > 0,
    "general",
  );

  const { data: pensionPriceCache, isLoading: pensionPriceCacheLoading } = usePortfolioChartPriceData(
    profileId || "",
    pensionTransactions,
    !!profileId && pensionTransactions.length > 0,
    "pension",
  );

  // Load next booking & recent chat
  useEffect(() => {
    getNextBooking().then(setNextBooking).catch(() => {});
    getConversations().then(async (convos) => {
      if (convos.length === 0) return;
      const primary = convos[0]; // primary first, sorted by last_message_at
      const messages = await getMessages(primary.id);
      const last = messages[messages.length - 1];
      if (last) {
        const d = new Date(last.created_at);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        setRecentChat({
          expertName: primary.expert?.name || "전문가",
          lastMessage: last.content,
          lastDate: dateStr,
          unread: primary.unread_count || 0,
        });
      }
    }).catch(() => {});
  }, []);

  // Load custom holdings
  useEffect(() => {
    if (!profileId) return;
    const supabase = createClient();
    supabase
      .from("custom_holdings")
      .select("*")
      .eq("profile_id", profileId)
      .then(({ data, error }) => {
        if (!error && data) {
          setCustomHoldings(data as CustomHolding[]);
        }
      });
  }, [profileId]);

  // Filter custom holdings by account type
  const generalCustomHoldings = useMemo(
    () => customHoldings.filter(ch => ch.account_id && generalAccountIds.has(ch.account_id)),
    [customHoldings, generalAccountIds],
  );
  const pensionCustomHoldings = useMemo(
    () => customHoldings.filter(ch => ch.account_id && pensionAccountIds.has(ch.account_id)),
    [customHoldings, pensionAccountIds],
  );

  // Latest snapshot
  const latestSnapshot =
    snapshots && snapshots.length > 0 ? snapshots[0] : null;

  // Load all simulation results
  useEffect(() => {
    if (!simulations?.length || !lifeCycleSettings) {
      setSimLoading(false);
      return;
    }
    setSimLoading(true);
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
      if (!cancelled) {
        setSimLines(results);
        setSimLoading(false);
      }
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

  // Net worth change (all time)
  const netWorthChange = useMemo(() => {
    if (chronoSnapshots.length < 1 || !latestSnapshot) return null;
    const first = chronoSnapshots[0];
    const latestNetWorth = latestSnapshot.net_worth || 0;
    const firstNetWorth = first.net_worth || 0;
    const change = latestNetWorth - firstNetWorth;
    const pct =
      firstNetWorth !== 0
        ? Math.round((change / Math.abs(firstNetWorth)) * 100)
        : null;
    return { change, pct };
  }, [chronoSnapshots, latestSnapshot]);

  // Shared helper to build portfolio time-series from cache + transactions + custom holdings
  const buildPortfolioTimeSeries = useCallback((
    cache: typeof generalPriceCache,
    txs: typeof portfolioTransactions,
    holdings: typeof customHoldings,
  ) => {
    if (!cache || txs.length === 0) return null;

    const { priceDataMap, exchangeRateMap, tickerCurrencyMap, dates } = cache;

    const sortedTx = [...txs].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    );

    const value: number[] = [];
    const invested: number[] = [];

    dates.forEach((date) => {
      const holdingsMap = new Map<string, number>();
      const investedMap = new Map<string, number>();

      sortedTx.forEach((tx) => {
        if (tx.trade_date <= date) {
          const currentQty = holdingsMap.get(tx.ticker) || 0;
          const currentInvested = investedMap.get(tx.ticker) || 0;

          if (tx.type === "buy") {
            holdingsMap.set(tx.ticker, currentQty + tx.quantity);
            investedMap.set(tx.ticker, currentInvested + tx.quantity * tx.price);
          } else {
            const newQty = currentQty - tx.quantity;
            const sellRatio = currentQty > 0 ? tx.quantity / currentQty : 0;
            holdingsMap.set(tx.ticker, newQty);
            investedMap.set(tx.ticker, currentInvested * (1 - sellRatio));
          }
        }
      });

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
      holdingsMap.forEach((qty, ticker) => {
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

      holdings.forEach(ch => {
        if (ch.date_basis && date >= ch.date_basis) {
          totalValue += ch.current_value;
          totalInvested += ch.principal;
        }
      });

      value.push(totalValue || totalInvested);
      invested.push(totalInvested);
    });

    return { labels: dates, value, invested };
  }, []);

  const generalTimeSeries = useMemo(
    () => buildPortfolioTimeSeries(generalPriceCache, generalTransactions, generalCustomHoldings),
    [buildPortfolioTimeSeries, generalPriceCache, generalTransactions, generalCustomHoldings],
  );

  const pensionTimeSeries = useMemo(
    () => buildPortfolioTimeSeries(pensionPriceCache, pensionTransactions, pensionCustomHoldings),
    [buildPortfolioTimeSeries, pensionPriceCache, pensionTransactions, pensionCustomHoldings],
  );

  const totalAssets = useMemo(() => assetItems.reduce((sum, item) => sum + item.amount, 0), [assetItems]);
  const totalDebts = useMemo(() => debtItems.reduce((sum, item) => sum + item.amount, 0), [debtItems]);

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

  // Portfolio is ready when: no transactions (nothing to load) or price cache is loaded
  const generalReady = generalTransactions.length === 0 ? !ptxLoading : !generalPriceCacheLoading;
  const pensionReady = pensionTransactions.length === 0 ? !ptxLoading : !pensionPriceCacheLoading;
  const dataReady = !snapshotsLoading && generalReady && pensionReady && !simLoading;

  // Minimum skeleton duration: data loaded → +0.5s delay
  useEffect(() => {
    if (dataReady && !minTimeElapsed) {
      const timer = setTimeout(() => setMinTimeElapsed(true), 500);
      return () => clearTimeout(timer);
    }
  }, [dataReady, minTimeElapsed]);

  // Skeleton loading: wait for all data + minimum duration
  if (!dataReady || !minTimeElapsed) {
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
        {/* Skeleton quick info */}
        <div className={styles.skeletonQuickInfoRow}>
          {[...Array(2)].map((_, i) => (
            <div key={`qi-${i}`} className={styles.skeletonQuickInfoCard}>
              <div className={`${styles.skeleton}`} style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <div className={`${styles.skeleton}`} style={{ width: 60, height: 11 }} />
                <div className={`${styles.skeleton}`} style={{ width: 150, height: 13 }} />
              </div>
            </div>
          ))}
        </div>
        {/* Skeleton charts */}
        <div className={styles.skeletonGrid}>
          {[...Array(2)].map((_, i) => (
            <div key={`top-${i}`} className={styles.skeletonChartBlock}>
              <div className={`${styles.skeletonTextLg} ${styles.skeleton}`} />
              <div className={`${styles.skeletonTextSm} ${styles.skeleton}`} />
              <div className={`${styles.skeletonChart} ${styles.skeleton}`} />
            </div>
          ))}
        </div>
        {/* Skeleton investment row */}
        <div className={styles.skeletonGrid}>
          {[...Array(2)].map((_, i) => (
            <div key={`inv-${i}`} className={styles.skeletonChartBlock}>
              <div className={`${styles.skeletonTextSm} ${styles.skeleton}`} />
              <div className={`${styles.skeletonChart} ${styles.skeleton}`} />
            </div>
          ))}
        </div>
        {/* Skeleton sim cards */}
        <div className={styles.skeletonGrid}>
          {[...Array(2)].map((_, i) => (
            <div key={`sim-${i}`} className={styles.skeletonChartBlock}>
              <div className={`${styles.skeletonTextSm} ${styles.skeleton}`} />
              <div className={`${styles.skeletonChartSmall} ${styles.skeleton}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

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

      {/* Quick info: next booking + recent chat */}
      {(nextBooking || recentChat) && (
        <div className={styles.quickInfoRow}>
          {nextBooking ? (
            <div className={styles.quickInfoCard} onClick={() => onNavigate("consultation")}>
              <Calendar size={16} className={styles.quickInfoIcon} />
              <div className={styles.quickInfoContent}>
                <span className={styles.quickInfoLabel}>다음 상담</span>
                <span className={styles.quickInfoValue}>
                  {(() => {
                    const d = new Date(nextBooking.booking_date + "T00:00:00");
                    return `${d.getMonth() + 1}/${d.getDate()} ${nextBooking.booking_time}`;
                  })()}
                  <span className={styles.quickInfoSub}>{nextBooking.expert_name}</span>
                </span>
              </div>
              <ChevronRight size={14} className={styles.quickInfoArrow} />
            </div>
          ) : (
            <div className={styles.quickInfoCard} onClick={() => onNavigate("consultation")}>
              <Calendar size={16} className={styles.quickInfoIcon} />
              <div className={styles.quickInfoContent}>
                <span className={styles.quickInfoLabel}>다음 상담</span>
                <span className={styles.quickInfoMuted}>예정된 상담이 없습니다</span>
              </div>
              <ChevronRight size={14} className={styles.quickInfoArrow} />
            </div>
          )}
          {recentChat ? (
            <div className={styles.quickInfoCard} onClick={() => onNavigate("messages")}>
              <MessageSquare size={16} className={styles.quickInfoIcon} />
              <div className={styles.quickInfoContent}>
                <span className={styles.quickInfoLabel}>
                  {recentChat.expertName}
                  {recentChat.unread > 0 && (
                    <span className={styles.unreadBadge}>{recentChat.unread}</span>
                  )}
                </span>
                <span className={styles.quickInfoValue}>
                  {recentChat.lastMessage.length > 30
                    ? recentChat.lastMessage.slice(0, 30) + "..."
                    : recentChat.lastMessage}
                  <span className={styles.quickInfoSub}>{recentChat.lastDate}</span>
                </span>
              </div>
              <ChevronRight size={14} className={styles.quickInfoArrow} />
            </div>
          ) : (
            <div className={styles.quickInfoCard} onClick={() => onNavigate("messages")}>
              <MessageSquare size={16} className={styles.quickInfoIcon} />
              <div className={styles.quickInfoContent}>
                <span className={styles.quickInfoLabel}>전문가 채팅</span>
                <span className={styles.quickInfoMuted}>채팅 내역이 없습니다</span>
              </div>
              <ChevronRight size={14} className={styles.quickInfoArrow} />
            </div>
          )}
        </div>
      )}

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
                      const first = chronoSnapshots[0];
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
                    <span className={styles.changeLabel}>전체</span>
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
                        data: chronoSnapshots.map((s) => ({
                          x: new Date(s.recorded_at).getTime(),
                          y: s.net_worth || 0,
                        })),
                        borderColor: chartLineColors.price,
                        borderWidth: 2,
                        pointRadius: chronoSnapshots.map((_, i) => hoveredPoint?.index === i ? 5 : 0),
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
                        const snapshot = chronoSnapshots[idx];
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
            </>
          ) : (
            <div className={styles.emptyTopSection}>
              <TrendingUp size={28} className={styles.emptyIcon} />
              <span>자산 기록이 없습니다</span>
            </div>
          )}
        </div>

        <div className={styles.assetListPanel} onClick={() => onNavigate("current-asset")}>
          {(assetItems.length > 0 || debtItems.length > 0) ? (
            <div className={styles.assetDebtColumns}>
              <div className={styles.assetColumn}>
                <div className={styles.columnHeader}>
                  <span className={styles.columnTitle}>자산</span>
                  <span className={styles.columnTotal}>{formatMoney(totalAssets)}</span>
                </div>
                <div className={styles.columnScroll}>
                  {assetItems.map((item) => (
                    <div key={item.id} className={styles.assetListItem}>
                      <span className={styles.assetListLabel}>{item.title}</span>
                      <span className={styles.assetListValue}>{formatMoney(item.amount)}</span>
                    </div>
                  ))}
                  {assetItems.length === 0 && (
                    <span className={styles.columnEmpty}>등록된 자산 없음</span>
                  )}
                </div>
              </div>
              <div className={styles.debtColumn}>
                <div className={styles.columnHeader}>
                  <span className={styles.columnTitle}>부채</span>
                  <span className={`${styles.columnTotal} ${styles.negative}`}>
                    {totalDebts > 0 ? `-${formatMoney(totalDebts)}` : "0"}
                  </span>
                </div>
                <div className={styles.columnScroll}>
                  {debtItems.map((item) => (
                    <div key={item.id} className={styles.assetListItem}>
                      <span className={styles.assetListLabel}>{item.title}</span>
                      <span className={`${styles.assetListValue} ${styles.negative}`}>
                        {formatMoney(item.amount)}
                      </span>
                    </div>
                  ))}
                  {debtItems.length === 0 && (
                    <span className={styles.columnEmpty}>등록된 부채 없음</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.emptyTopSection}>
              <TrendingUp size={28} className={styles.emptyIcon} />
              <span>자산 기록이 없습니다</span>
            </div>
          )}
        </div>
      </div>

      {/* Investment section: 일반 투자 + 연금 투자 */}
      <div className={styles.investmentSection}>
        {/* 일반 투자 (general / isa) */}
        <div className={styles.portfolioPanel} onClick={() => onNavigate("portfolio")}>
          {generalTimeSeries && generalTimeSeries.value.length > 0 ? (
            <>
              <div className={styles.netWorthLabel}>일반 투자</div>
              <div className={styles.netWorthAmount}>
                {formatWon(Math.round(generalTimeSeries.value[generalTimeSeries.value.length - 1]))}
              </div>
              <div className={styles.changeIndicator}>
                {(() => {
                  const lastVal = generalTimeSeries.value[generalTimeSeries.value.length - 1];
                  const lastInvested = generalTimeSeries.invested[generalTimeSeries.invested.length - 1];
                  const profitLoss = lastVal - lastInvested;
                  const pct = lastInvested !== 0 ? ((profitLoss / Math.abs(lastInvested)) * 100).toFixed(1) : null;
                  return (
                    <>
                      <span className={styles.changeLabel}>원금 대비</span>
                      <span className={profitLoss >= 0 ? styles.positive : styles.negative}>
                        {profitLoss >= 0 ? "+ " : "- "}
                        {formatWon(Math.round(Math.abs(profitLoss)))}
                        {pct !== null && ` (${profitLoss >= 0 ? "+" : ""}${pct}%)`}
                      </span>
                    </>
                  );
                })()}
              </div>
              <div className={styles.chartContainer}>
                {(() => {
                  const plData = generalTimeSeries.value.map((v, i) => v - generalTimeSeries.invested[i]);
                  const maxAbsPL = Math.max(...plData.map((v) => Math.abs(v)));
                  return (
                    <Chart
                      type="bar"
                      data={{
                        labels: generalTimeSeries.labels,
                        datasets: [
                          {
                            type: "bar" as const,
                            label: "손익",
                            data: plData,
                            backgroundColor: plData.map((v) => v >= 0 ? toRgba(chartLineColors.profit, 0.7) : toRgba(chartLineColors.loss, 0.7)),
                            borderWidth: 0,
                            borderRadius: 1,
                            yAxisID: "y1",
                            order: 2,
                          },
                          {
                            type: "line" as const,
                            label: "평가금액",
                            data: generalTimeSeries.value,
                            borderColor: chartLineColors.value,
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: true,
                            backgroundColor: (ctx: any) => {
                              if (!ctx.chart.chartArea) return "transparent";
                              const gradient = ctx.chart.ctx.createLinearGradient(
                                0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom
                              );
                              gradient.addColorStop(0, toRgba(chartLineColors.value, 0.15));
                              gradient.addColorStop(1, toRgba(chartLineColors.value, 0));
                              return gradient;
                            },
                            tension: 0.3,
                            yAxisID: "y",
                            order: 1,
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
                            type: "category",
                            display: true,
                            grid: { display: false },
                            border: { display: false },
                            ticks: {
                              color: chartScaleColors.tickColor,
                              font: { size: 10 },
                              maxRotation: 0,
                              maxTicksLimit: 6,
                              callback: function(val: any) {
                                const label = this.getLabelForValue(val);
                                if (!label) return "";
                                const d = new Date(label);
                                const yy = String(d.getFullYear()).slice(2);
                                return `${yy}.${d.getMonth() + 1}`;
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
                              callback: (v: any) => formatWon(Math.round(v as number)),
                            },
                            beginAtZero: false,
                          },
                          y1: {
                            display: false,
                            position: "right" as const,
                            grid: { display: false },
                            border: { display: false },
                            min: -maxAbsPL * 2,
                            max: maxAbsPL * 2,
                          },
                        },
                      }}
                    />
                  );
                })()}
              </div>
            </>
          ) : (
            <div className={styles.emptyTopSection}>
              <Activity size={24} className={styles.emptyIcon} />
              <span>{ptxLoading || generalPriceCacheLoading ? "로딩 중..." : "거래 데이터가 없습니다"}</span>
            </div>
          )}
        </div>
        {/* 연금 투자 (pension_savings / irp / dc) */}
        <div className={styles.portfolioPanel} onClick={() => onNavigate("pension-portfolio")}>
          {pensionTimeSeries && pensionTimeSeries.value.length > 0 ? (
            <>
              <div className={styles.netWorthLabel}>연금 투자</div>
              <div className={styles.netWorthAmount}>
                {formatWon(Math.round(pensionTimeSeries.value[pensionTimeSeries.value.length - 1]))}
              </div>
              <div className={styles.changeIndicator}>
                {(() => {
                  const lastVal = pensionTimeSeries.value[pensionTimeSeries.value.length - 1];
                  const lastInvested = pensionTimeSeries.invested[pensionTimeSeries.invested.length - 1];
                  const profitLoss = lastVal - lastInvested;
                  const pct = lastInvested !== 0 ? ((profitLoss / Math.abs(lastInvested)) * 100).toFixed(1) : null;
                  return (
                    <>
                      <span className={styles.changeLabel}>원금 대비</span>
                      <span className={profitLoss >= 0 ? styles.positive : styles.negative}>
                        {profitLoss >= 0 ? "+ " : "- "}
                        {formatWon(Math.round(Math.abs(profitLoss)))}
                        {pct !== null && ` (${profitLoss >= 0 ? "+" : ""}${pct}%)`}
                      </span>
                    </>
                  );
                })()}
              </div>
              <div className={styles.chartContainer}>
                {(() => {
                  const plData = pensionTimeSeries.value.map((v, i) => v - pensionTimeSeries.invested[i]);
                  const maxAbsPL = Math.max(...plData.map((v) => Math.abs(v)));
                  return (
                    <Chart
                      type="bar"
                      data={{
                        labels: pensionTimeSeries.labels,
                        datasets: [
                          {
                            type: "bar" as const,
                            label: "손익",
                            data: plData,
                            backgroundColor: plData.map((v) => v >= 0 ? toRgba(chartLineColors.profit, 0.7) : toRgba(chartLineColors.loss, 0.7)),
                            borderWidth: 0,
                            borderRadius: 1,
                            yAxisID: "y1",
                            order: 2,
                          },
                          {
                            type: "line" as const,
                            label: "평가금액",
                            data: pensionTimeSeries.value,
                            borderColor: chartLineColors.value,
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: true,
                            backgroundColor: (ctx: any) => {
                              if (!ctx.chart.chartArea) return "transparent";
                              const gradient = ctx.chart.ctx.createLinearGradient(
                                0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom
                              );
                              gradient.addColorStop(0, toRgba(chartLineColors.value, 0.15));
                              gradient.addColorStop(1, toRgba(chartLineColors.value, 0));
                              return gradient;
                            },
                            tension: 0.3,
                            yAxisID: "y",
                            order: 1,
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
                            type: "category",
                            display: true,
                            grid: { display: false },
                            border: { display: false },
                            ticks: {
                              color: chartScaleColors.tickColor,
                              font: { size: 10 },
                              maxRotation: 0,
                              maxTicksLimit: 6,
                              callback: function(val: any) {
                                const label = this.getLabelForValue(val);
                                if (!label) return "";
                                const d = new Date(label);
                                const yy = String(d.getFullYear()).slice(2);
                                return `${yy}.${d.getMonth() + 1}`;
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
                              callback: (v: any) => formatWon(Math.round(v as number)),
                            },
                            beginAtZero: false,
                          },
                          y1: {
                            display: false,
                            position: "right" as const,
                            grid: { display: false },
                            border: { display: false },
                            min: -maxAbsPL * 2,
                            max: maxAbsPL * 2,
                          },
                        },
                      }}
                    />
                  );
                })()}
              </div>
            </>
          ) : (
            <div className={styles.emptyTopSection}>
              <Activity size={24} className={styles.emptyIcon} />
              <span>{ptxLoading || pensionPriceCacheLoading ? "로딩 중..." : "거래 데이터가 없습니다"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Simulation section */}
      <div className={styles.sectionLabel}>시뮬레이션</div>
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
                        borderColor: chartLineColors.price,
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
                        min: line.data[0]?.x,
                        max: line.data[line.data.length - 1]?.x,
                        ticks: {
                          color: chartScaleColors.tickColor,
                          font: { size: 10 },
                          callback: (v: any) => Math.round(v),
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
