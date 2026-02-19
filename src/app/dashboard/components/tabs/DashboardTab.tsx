"use client";

import { useEffect, useState, useMemo } from "react";
import { Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { useSnapshots, usePortfolioValue } from "@/hooks/useFinancialData";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatMoney, formatWon, wonToManwon } from "@/lib/utils";
import {
  loadChatData,
  type Expert,
  type Message,
} from "@/lib/services/messageService";
import {
  getNextBooking,
  type NextBooking,
} from "@/lib/services/bookingService";
import { getBudgetTransactions } from "@/lib/services/budgetService";
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
import type { SimulationResult } from "@/lib/services/simulationTypes";
import type { Simulation, LifeCycleSettings } from "@/types";
import {
  MessageSquare,
  Calendar,
  ArrowRight,
  Wallet,
  TrendingUp,
  BarChart3,
  Activity,
} from "lucide-react";
import styles from "./DashboardTab.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  ArcElement,
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
  simulations?: Simulation[];
  lifeCycleSettings?: LifeCycleSettings;
}

interface SimLine {
  title: string;
  data: { x: number; y: number }[];
}

interface WeeklyData {
  label: string;
  income: number;
  expense: number;
}

async function loadWeeklyBudget(profileId: string): Promise<WeeklyData[]> {
  const now = new Date();
  const weeks: { label: string; start: Date; end: Date }[] = [];

  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const thisMonday = getMonday(now);

  for (let i = 2; i >= 0; i--) {
    const start = new Date(thisMonday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const label = `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`;
    weeks.push({ label, start, end });
  }

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  try {
    const [currentTxns, prevTxns] = await Promise.all([
      getBudgetTransactions(profileId, year, month),
      getBudgetTransactions(profileId, prevYear, prevMonth),
    ]);
    const allTxns = [...currentTxns, ...prevTxns];

    return weeks.map((w) => {
      const weekTxns = allTxns.filter((t) => {
        const txDate = new Date(t.year, t.month - 1, t.day || 1);
        return txDate >= w.start && txDate <= w.end;
      });
      const income = weekTxns
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = weekTxns
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      return { label: w.label, income, expense };
    });
  } catch {
    return weeks.map((w) => ({ label: w.label, income: 0, expense: 0 }));
  }
}

export function DashboardTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  profileId,
  unreadMessageCount,
  onNavigate,
  simulations,
  lifeCycleSettings,
}: DashboardTabProps) {
  const [expert, setExpert] = useState<Expert | null>(null);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [nextBooking, setNextBooking] = useState<NextBooking | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [simLines, setSimLines] = useState<SimLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: snapshots, isLoading: snapshotsLoading } = useSnapshots(
    profileId || "",
    !!profileId
  );
  const { data: portfolioData, isLoading: portfolioLoading } =
    usePortfolioValue(profileId || "", !!profileId);
  const {
    chartScaleColors,
    chartLineColors,
    toRgba,
    isDark,
    categoryColors,
    colors,
  } = useChartTheme();

  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }
    const load = async () => {
      setIsLoading(true);
      const [chatData, booking, weeklyData] = await Promise.all([
        loadChatData().catch(() => null),
        getNextBooking().catch(() => null),
        loadWeeklyBudget(profileId),
      ]);
      if (chatData) {
        setExpert(chatData.expert);
        setRecentMessages(chatData.messages.slice(-5));
      }
      setNextBooking(booking);
      setWeeklyData(weeklyData);
      setIsLoading(false);
    };
    load();
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
            { incomes, expenses, savings, debts, nationalPensions: np, retirementPensions: rp, personalPensions: pp, realEstates: re, physicalAssets: pa },
            { birthYear, retirementAge: lcs.selfRetirementAge, spouseBirthYear: spouseBirthYear ?? undefined, spouseRetirementAge: lcs.spouseRetirementAge },
            endYear - startYear,
            sim.simulation_assumptions,
            sim.cash_flow_priorities,
            sim.start_year,
            sim.start_month,
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
    return () => { cancelled = true; };
  }, [simulations, lifeCycleSettings, birthYear, spouseBirthYear]);

  // Snapshots come in DESC order (newest first) - reverse for chart
  const chronoSnapshots = useMemo(
    () => (snapshots ? [...snapshots].reverse() : []),
    [snapshots]
  );

  // Latest snapshot and change (snapshots[0] = newest)
  const latestSnapshot =
    snapshots && snapshots.length > 0 ? snapshots[0] : null;
  const prevSnapshot =
    snapshots && snapshots.length > 1 ? snapshots[1] : null;
  const netWorthChange = useMemo(() => {
    if (!latestSnapshot || !prevSnapshot) return null;
    return (latestSnapshot.net_worth || 0) - (prevSnapshot.net_worth || 0);
  }, [latestSnapshot, prevSnapshot]);

  // Portfolio gain/loss
  const portfolioGain = useMemo(() => {
    if (!portfolioData) return null;
    return portfolioData.totalValue - portfolioData.totalInvested;
  }, [portfolioData]);

  // Format time helper
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "방금";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}일 전`;
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  // Format booking date
  const formatBookingDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    return `${month}월 ${day}일 (${dayNames[d.getDay()]})`;
  };

  // Max value for bar width calculation (income or expense)
  const maxWeekly = Math.max(
    ...weeklyData.flatMap((w) => [w.income, w.expense]),
    1
  );

  // Skeleton loading
  if (isLoading || snapshotsLoading) {
    return (
      <div className={styles.skeletonContainer}>
        <div className={styles.skeletonTop}>
          <div className={`${styles.skeletonTopHalf} ${styles.skeleton}`} />
          <div className={`${styles.skeletonTopHalf} ${styles.skeleton}`} />
        </div>
        <div className={styles.skeletonGrid}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`${styles.skeletonCard} ${styles.skeleton}`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* TOP SECTION: Consultation + Chat */}
      <div className={styles.topSection}>
        {/* Left: Next Consultation */}
        <div
          className={`${styles.card} ${styles.clickableCard} ${styles.topLeft}`}
          onClick={() => onNavigate("consultation")}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>다음 상담</span>
            <Calendar
              size={16}
              style={{ color: "var(--dashboard-text-muted)" }}
            />
          </div>
          {nextBooking ? (
            <div className={styles.bookingInfo}>
              <div className={styles.bookingDate}>
                {formatBookingDate(nextBooking.booking_date)}
              </div>
              <div className={styles.bookingTime}>
                {nextBooking.booking_time}
              </div>
              <div className={styles.bookingExpert}>
                {nextBooking.expert_name}
              </div>
              <span
                className={`${styles.statusBadge} ${nextBooking.status === "confirmed" ? styles.statusConfirmed : ""}`}
              >
                {nextBooking.status === "confirmed" ? "확정" : "대기중"}
              </span>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Calendar size={24} className={styles.emptyIcon} />
              <span>예약된 상담이 없습니다</span>
            </div>
          )}
        </div>

        {/* Right: Recent Chat */}
        <div className={`${styles.card} ${styles.topRight}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              최근 채팅
              {unreadMessageCount > 0 && (
                <span className={styles.unreadBadge}>
                  {unreadMessageCount}
                </span>
              )}
            </span>
            <button
              className={styles.moreBtn}
              onClick={() => onNavigate("messages")}
            >
              전체보기 <ArrowRight size={12} />
            </button>
          </div>
          {recentMessages.length > 0 ? (
            <div className={styles.messageList}>
              {recentMessages.map((msg) => (
                <div key={msg.id} className={styles.messageRow}>
                  <span
                    className={`${styles.messageSender} ${msg.sender_type === "expert" ? styles.messageSenderExpert : ""}`}
                  >
                    {msg.sender_type === "expert"
                      ? expert?.name || "전문가"
                      : "나"}
                  </span>
                  <span className={styles.messageContent}>{msg.content}</span>
                  <span className={styles.messageTime}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <MessageSquare size={24} className={styles.emptyIcon} />
              <span>아직 대화 내역이 없습니다</span>
            </div>
          )}
        </div>
      </div>

      {/* GRID: 2x2 */}
      <div className={styles.grid}>
        {/* Card 1: Weekly Budget */}
        <div
          className={`${styles.card} ${styles.clickableCard}`}
          onClick={() => onNavigate("household-budget")}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>주간 가계부</span>
            <button
              className={styles.moreBtn}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate("household-budget");
              }}
            >
              상세 <ArrowRight size={12} />
            </button>
          </div>
          {weeklyData.some((w) => w.income > 0 || w.expense > 0) ? (
            <div className={styles.weeklyBars}>
              {weeklyData.map((week, i) => {
                const net = week.income - week.expense;
                return (
                  <div key={i} className={styles.weekGroup}>
                    <span className={styles.weekLabel}>{week.label}</span>
                    <div className={styles.weekBarsCol}>
                      <div className={styles.barContainer}>
                        <div
                          className={styles.bar}
                          style={{
                            width: `${(week.income / maxWeekly) * 100}%`,
                            backgroundColor: "#ef4444",
                          }}
                        />
                      </div>
                      <div className={styles.barContainer}>
                        <div
                          className={styles.bar}
                          style={{
                            width: `${(week.expense / maxWeekly) * 100}%`,
                            backgroundColor: "#3b82f6",
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className={`${styles.weekAmount} ${net >= 0 ? styles.positive : styles.negative}`}
                    >
                      {net >= 0 ? "+" : ""}
                      {formatWon(net)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Wallet size={24} className={styles.emptyIcon} />
              <span>이번 달 가계부 데이터가 없습니다</span>
            </div>
          )}
        </div>

        {/* Card 2: Portfolio */}
        <div
          className={`${styles.card} ${styles.clickableCard}`}
          onClick={() => onNavigate("portfolio")}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>포트폴리오</span>
            <button
              className={styles.moreBtn}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate("portfolio");
              }}
            >
              상세 <ArrowRight size={12} />
            </button>
          </div>
          {portfolioData && portfolioData.holdings.length > 0 ? (
            <div className={styles.portfolioContent}>
              <div className={styles.doughnutWrap}>
                <Doughnut
                  data={{
                    labels: portfolioData.holdings
                      .slice(0, 5)
                      .map((h) => h.name),
                    datasets: [
                      {
                        data: portfolioData.holdings
                          .slice(0, 5)
                          .map((h) => h.total_invested),
                        backgroundColor: colors.slice(0, 5),
                        borderColor: chartScaleColors.doughnutBorder,
                        borderWidth: 2,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: "60%",
                    plugins: {
                      tooltip: { enabled: false },
                      legend: { display: false },
                    },
                  }}
                />
              </div>
              <div className={styles.portfolioStats}>
                <div className={styles.portfolioTotal}>
                  {formatMoney(wonToManwon(portfolioData.totalValue))}
                </div>
                {portfolioGain !== null && (
                  <div
                    className={`${styles.portfolioGain} ${portfolioGain >= 0 ? styles.positive : styles.negative}`}
                  >
                    {portfolioGain >= 0 ? "+" : ""}
                    {formatMoney(wonToManwon(portfolioGain))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <BarChart3 size={24} className={styles.emptyIcon} />
              <span>포트폴리오가 비어있습니다</span>
            </div>
          )}
        </div>

        {/* Card 3: Asset Trends */}
        <div
          className={`${styles.card} ${styles.clickableCard}`}
          onClick={() => onNavigate("progress")}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>자산 추이</span>
            <button
              className={styles.moreBtn}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate("progress");
              }}
            >
              상세 <ArrowRight size={12} />
            </button>
          </div>
          {chronoSnapshots.length > 0 ? (
            <>
              <div className={styles.netWorthDisplay}>
                <span className={styles.netWorthValue}>
                  {formatMoney(latestSnapshot?.net_worth || 0)}
                </span>
                {netWorthChange !== null ? (
                  <span
                    className={`${styles.netWorthChange} ${netWorthChange >= 0 ? styles.positive : styles.negative}`}
                  >
                    {netWorthChange >= 0 ? "+" : ""}
                    {formatMoney(netWorthChange)}
                  </span>
                ) : (
                  <span className={`${styles.netWorthChange} ${styles.muted}`}>
                    첫 기록
                  </span>
                )}
              </div>
              <div className={styles.chartContainer}>
                <Line
                  data={{
                    datasets: [
                      {
                        data: chronoSnapshots.map((s) => ({
                          x: new Date(s.recorded_at).getTime(),
                          y: s.net_worth || 0,
                        })),
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
                          displayFormats: { day: "yy.M", month: "yy.M", year: "yyyy" },
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
                        beginAtZero: false,
                      },
                    },
                  }}
                />
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <TrendingUp size={24} className={styles.emptyIcon} />
              <span>자산 기록이 없습니다</span>
            </div>
          )}
        </div>

        {/* Simulation cards - one per simulation */}
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
              <div className={styles.chartContainer}>
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
                          const gradient = ctx.chart.ctx.createLinearGradient(
                            0,
                            ctx.chart.chartArea.top,
                            0,
                            ctx.chart.chartArea.bottom
                          );
                          gradient.addColorStop(0, toRgba(colors[i % colors.length], 0.15));
                          gradient.addColorStop(1, toRgba(colors[i % colors.length], 0));
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
