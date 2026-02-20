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
import {
  useSnapshots,
  useSnapshotItems,
} from "@/hooks/useFinancialData";
import { useAllAccounts } from "@/hooks/useBudget";
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

const ITEM_TYPE_LABELS: Record<string, string> = {
  checking: "입출금",
  savings: "정기적금",
  deposit: "정기예금",
  free_savings: "자유적금",
  housing: "청약",
  general: "일반증권",
  isa: "ISA",
  pension_savings: "연금저축",
  irp: "IRP",
  dc: "DC퇴직연금",
  domestic_stock: "국내주식",
  foreign_stock: "해외주식",
  fund: "펀드",
  bond: "채권",
  crypto: "암호화폐",
  etf: "ETF",
  residence: "거주용",
  real_estate: "부동산",
  car: "자동차",
  precious_metal: "귀금속",
  art: "미술품",
  mortgage: "주담대",
  jeonse: "전세대출",
  credit: "신용대출",
  student: "학자금",
  card: "카드론",
  installment: "할부",
};

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
    categoryColors,
    colors,
  } = useChartTheme();

  // Latest snapshot
  const latestSnapshot =
    snapshots && snapshots.length > 0 ? snapshots[0] : null;
  const latestSnapshotId = latestSnapshot?.id;

  // Load snapshot items for the latest snapshot
  const { data: snapshotItems } = useSnapshotItems(
    latestSnapshotId,
    !!latestSnapshotId
  );

  // Load all accounts (bank + investment)
  const { data: allAccounts } = useAllAccounts(profileId || "");

  // Unified asset list: accounts + snapshot assets
  const allAssetsList = useMemo(() => {
    const list: { id: string; title: string; type: string; amount: number; color: string }[] = [];

    // 1. 저축 계좌 (checking, savings, deposit, free_savings, housing)
    if (allAccounts) {
      allAccounts
        .filter((a) => ["checking", "savings", "deposit", "free_savings", "housing"].includes(a.account_type))
        .forEach((a) => {
          list.push({
            id: `account-${a.id}`,
            title: a.name,
            type: ITEM_TYPE_LABELS[a.account_type] || a.account_type,
            amount: wonToManwon(a.current_balance || 0),
            color: categoryColors.savings,
          });
        });
    }

    // 2. 투자/연금 계좌 (general, isa, pension_savings, irp, dc)
    if (allAccounts) {
      allAccounts
        .filter((a) => ["general", "isa", "pension_savings", "irp", "dc"].includes(a.account_type))
        .forEach((a) => {
          list.push({
            id: `account-${a.id}`,
            title: a.name,
            type: ITEM_TYPE_LABELS[a.account_type] || a.account_type,
            amount: wonToManwon(a.current_balance || 0),
            color: categoryColors.investment,
          });
        });
    }

    // 3. 스냅샷 자산 (부동산, 실물자산)
    if (snapshotItems) {
      snapshotItems
        .filter((i) => i.category === "asset")
        .forEach((i) => {
          let color = categoryColors.savings;
          if (["residence", "real_estate", "apartment", "house", "officetel", "land", "commercial", "building", "room"].includes(i.item_type)) {
            color = categoryColors.realEstate;
          } else if (["car", "precious_metal", "art", "other"].includes(i.item_type)) {
            color = categoryColors.realAsset;
          }
          list.push({
            id: `snapshot-${i.id}`,
            title: i.title,
            type: ITEM_TYPE_LABELS[i.item_type] || i.item_type,
            amount: i.amount,
            color,
          });
        });
    }

    return list.sort((a, b) => b.amount - a.amount);
  }, [allAccounts, snapshotItems, categoryColors]);

  // Unified debt list
  const allDebtsList = useMemo(() => {
    const list: { id: string; title: string; type: string; amount: number; color: string }[] = [];

    if (snapshotItems) {
      snapshotItems
        .filter((i) => i.category === "debt")
        .forEach((i) => {
          list.push({
            id: `snapshot-${i.id}`,
            title: i.title,
            type: ITEM_TYPE_LABELS[i.item_type] || i.item_type,
            amount: i.amount,
            color: categoryColors.debt,
          });
        });
    }

    return list.sort((a, b) => b.amount - a.amount);
  }, [snapshotItems, categoryColors]);

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

      {/* Top section: chart + breakdown */}
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

        <div className={styles.breakdownPanel}>
          <div className={styles.breakdownHeaders}>
            <div className={styles.breakdownHeader}>
              <div className={styles.breakdownHeaderLabel}>자산</div>
              <div className={styles.breakdownHeaderAmount}>
                {formatMoney(latestSnapshot?.total_assets || 0)}
              </div>
            </div>
            <div className={styles.breakdownDivider} />
            <div className={styles.breakdownHeader}>
              <div className={styles.breakdownHeaderLabel}>부채</div>
              <div className={styles.breakdownHeaderAmount}>
                {formatMoney(latestSnapshot?.total_debts || 0)}
              </div>
            </div>
          </div>

          {/* Asset items */}
          <div className={styles.itemSection}>
            <div className={styles.itemSectionLabel}>자산 내역</div>
            {allAssetsList.length > 0 ? (
              <div className={styles.itemList}>
                {allAssetsList.map((item) => (
                  <div key={item.id} className={styles.itemRow}>
                    <div
                      className={styles.itemDot}
                      style={{ backgroundColor: item.color }}
                    />
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.itemType}>{item.type}</span>
                    <span className={styles.itemAmount}>
                      {formatMoney(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noItems}>자산 항목이 없습니다</div>
            )}
          </div>

          {/* Debt items */}
          {allDebtsList.length > 0 && (
            <div className={styles.itemSection}>
              <div className={styles.itemSectionLabel}>부채 내역</div>
              <div className={styles.itemList}>
                {allDebtsList.map((item) => (
                  <div key={item.id} className={styles.itemRow}>
                    <div
                      className={styles.itemDot}
                      style={{ backgroundColor: item.color }}
                    />
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.itemType}>{item.type}</span>
                    <span className={styles.itemAmount}>
                      {formatMoney(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
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
