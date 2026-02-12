"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useSnapshots } from "@/hooks/useFinancialData";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatMoney, formatWon } from "@/lib/utils";
import { Wallet, PiggyBank, Briefcase, BarChart3, ArrowRight } from "lucide-react";
import styles from "./DashboardTab.module.css";

ChartJS.register(ArcElement, Tooltip, Legend);

interface BudgetTransaction {
  id: string;
  type: "income" | "expense";
  title: string;
  amount: number;
  year: number;
  month: number;
  day: number;
}

interface PortfolioTransaction {
  id: string;
  type: "buy" | "sell";
  name: string;
  total_amount: number;
  trade_date: string;
}

interface DashboardTabProps {
  simulationId: string;
  birthYear: number;
  spouseBirthYear: number | null;
  retirementAge: number | null;
  globalSettings: unknown;
  unreadMessageCount: number;
  onNavigate: (section: string) => void;
  profileId?: string;
}

export function DashboardTab({
  profileId,
  birthYear,
  retirementAge,
  onNavigate,
}: DashboardTabProps) {
  const supabase = createClient();
  const { data: snapshots, isLoading: snapshotsLoading } = useSnapshots(profileId || "", !!profileId);
  const { categoryColors, chartScaleColors } = useChartTheme();

  const [recentBudget, setRecentBudget] = useState<BudgetTransaction[]>([]);
  const [recentPortfolio, setRecentPortfolio] = useState<PortfolioTransaction[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);

      const now = new Date();
      const thisYear = now.getFullYear();
      const thisMonth = now.getMonth() + 1;

      const [budgetRes, monthlyBudgetRes, portfolioRes] = await Promise.all([
        supabase
          .from("budget_transactions")
          .select("id, type, title, amount, year, month, day")
          .eq("profile_id", profileId)
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .order("day", { ascending: false })
          .limit(5),
        supabase
          .from("budget_transactions")
          .select("type, amount")
          .eq("profile_id", profileId)
          .eq("year", thisYear)
          .eq("month", thisMonth),
        supabase
          .from("portfolio_transactions")
          .select("id, type, name, total_amount, trade_date")
          .eq("profile_id", profileId)
          .order("trade_date", { ascending: false })
          .limit(5),
      ]);

      if (budgetRes.data) {
        setRecentBudget(budgetRes.data as BudgetTransaction[]);
      }

      if (monthlyBudgetRes.data) {
        let incomeTotal = 0;
        let expenseTotal = 0;
        for (const tx of monthlyBudgetRes.data) {
          if (tx.type === "income") incomeTotal += tx.amount;
          else expenseTotal += tx.amount;
        }
        setMonthlyIncome(incomeTotal);
        setMonthlyExpense(expenseTotal);
      }

      if (portfolioRes.data) {
        setRecentPortfolio(portfolioRes.data as PortfolioTransaction[]);
      }

      setIsLoading(false);
    };

    loadData();
  }, [profileId, supabase]);

  const latestSnapshot = snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const prevSnapshot = snapshots && snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

  const netWorthChange = useMemo(() => {
    if (!latestSnapshot || !prevSnapshot) return null;
    return (latestSnapshot.net_worth || 0) - (prevSnapshot.net_worth || 0);
  }, [latestSnapshot, prevSnapshot]);

  const currentAge = new Date().getFullYear() - birthYear;
  const yearsLeft = retirementAge ? retirementAge - currentAge : null;
  const retirementProgress = retirementAge ? Math.min((currentAge / retirementAge) * 100, 100) : 0;

  // Asset composition for doughnut chart
  const assetData = useMemo(() => {
    const s = latestSnapshot;
    if (!s) return null;
    const items = [
      { label: "저축", value: s.savings || 0, color: categoryColors.savings },
      { label: "투자", value: s.investments || 0, color: categoryColors.investment },
      { label: "부동산", value: s.real_estate || 0, color: categoryColors.realEstate },
      { label: "실물자산", value: s.real_assets || 0, color: categoryColors.realAsset },
    ];
    const hasData = items.some((i) => i.value > 0);
    return { items, hasData, total: s.total_assets || 0 };
  }, [latestSnapshot, categoryColors]);

  const doughnutData = {
    labels: assetData?.hasData ? assetData.items.map((i) => i.label) : ["데이터 없음"],
    datasets: [
      {
        data: assetData?.hasData ? assetData.items.map((i) => i.value) : [1],
        backgroundColor: assetData?.hasData
          ? assetData.items.map((i) => i.color)
          : [chartScaleColors.emptyState],
        borderWidth: 3,
        borderColor: chartScaleColors.doughnutBorder,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartScaleColors.tooltipBg,
        titleColor: chartScaleColors.tooltipText,
        bodyColor: chartScaleColors.tooltipText,
        borderColor: chartScaleColors.tooltipBorder,
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx: { label?: string; raw?: unknown }) =>
            `${ctx.label}: ${formatMoney(ctx.raw as number)}`,
        },
      },
    },
  };

  const quickNavItems = [
    { icon: <Wallet size={20} />, label: "가계부", section: "budget" },
    { icon: <PiggyBank size={20} />, label: "예금적금", section: "savings-deposits" },
    { icon: <Briefcase size={20} />, label: "포트폴리오", section: "portfolio" },
    { icon: <BarChart3 size={20} />, label: "현재 자산", section: "current-asset" },
  ];

  // Skeleton loading
  if (isLoading || snapshotsLoading) {
    return (
      <div className={styles.skeletonContainer}>
        <div className={styles.skeletonHeroGrid}>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
        <div className={styles.skeletonChart}>
          <div className={styles.skeletonCircle} />
          <div className={styles.skeletonLegend}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className={styles.skeletonLine} />
            ))}
          </div>
        </div>
        <div className={styles.skeletonActivityGrid}>
          <div className={styles.skeletonActivityCard} />
          <div className={styles.skeletonActivityCard} />
        </div>
        <div className={styles.skeletonQuickNav}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className={styles.skeletonQuickItem} />
          ))}
        </div>
      </div>
    );
  }

  const formatTradeDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  return (
    <div className={styles.container}>
      {/* Section 1: Hero Stats */}
      <div className={styles.heroGrid}>
        {/* Net Worth */}
        <div className={styles.heroCard}>
          <span className={styles.heroLabel}>순자산</span>
          <span className={styles.heroValue}>
            {formatMoney(latestSnapshot?.net_worth || 0)}
          </span>
          <span className={styles.heroSub}>
            {netWorthChange !== null ? (
              <span
                className={
                  netWorthChange >= 0 ? styles.positive : styles.negative
                }
              >
                {netWorthChange >= 0 ? "+" : ""}
                {formatMoney(netWorthChange)}
              </span>
            ) : (
              <span className={styles.muted}>첫 기록</span>
            )}
          </span>
        </div>

        {/* Monthly Income/Expense */}
        <div className={styles.heroCard}>
          <span className={styles.heroLabel}>이번 달</span>
          <span className={`${styles.heroValue} ${styles.positive}`}>
            +{formatWon(monthlyIncome)}
          </span>
          <span className={styles.heroSub}>
            <span className={styles.negative}>-{formatWon(monthlyExpense)}</span>
            <span className={styles.heroDivider} />
            <span>
              {formatWon(monthlyIncome - monthlyExpense)}
            </span>
          </span>
        </div>

        {/* Retirement Countdown */}
        <div className={styles.heroCard}>
          <span className={styles.heroLabel}>은퇴까지</span>
          {yearsLeft !== null ? (
            <>
              <span className={styles.heroValue}>{yearsLeft}년</span>
              <div className={styles.progressBarWrap}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${retirementProgress}%` }}
                />
              </div>
            </>
          ) : (
            <span className={`${styles.heroValue} ${styles.muted}`}>미설정</span>
          )}
        </div>
      </div>

      {/* Section 2: Asset Composition */}
      <div className={styles.assetSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>자산 구성</span>
          <button
            className={styles.detailBtn}
            onClick={() => onNavigate("current-asset")}
          >
            자세히
            <ArrowRight size={14} />
          </button>
        </div>
        <div className={styles.assetContent}>
          <div className={styles.doughnutWrap}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
            <div className={styles.doughnutCenter}>
              <span className={styles.doughnutCenterLabel}>총 자산</span>
              <span className={styles.doughnutCenterValue}>
                {formatMoney(assetData?.total || 0)}
              </span>
            </div>
          </div>
          <div className={styles.legendList}>
            {assetData?.items.map((item) => (
              <div key={item.label} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: item.color }}
                />
                <span className={styles.legendLabel}>{item.label}</span>
                <span className={styles.legendValue}>
                  {formatMoney(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Recent Activity */}
      <div className={styles.activityGrid}>
        {/* Budget */}
        <div className={styles.activityCard}>
          <div className={styles.activityHeader}>
            <span className={styles.activityTitle}>가계부</span>
            <button
              className={styles.moreBtn}
              onClick={() => onNavigate("budget")}
            >
              더보기
              <ArrowRight size={12} />
            </button>
          </div>
          <div className={styles.activityList}>
            {recentBudget.length > 0 ? (
              recentBudget.map((tx) => (
                <div key={tx.id} className={styles.activityRow}>
                  <span className={styles.activityDate}>
                    {tx.month}.{tx.day}
                  </span>
                  <span className={styles.activityName}>{tx.title}</span>
                  <span
                    className={
                      tx.type === "income"
                        ? styles.activityIncome
                        : styles.activityExpense
                    }
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatWon(tx.amount)}
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>기록이 없습니다</div>
            )}
          </div>
        </div>

        {/* Portfolio */}
        <div className={styles.activityCard}>
          <div className={styles.activityHeader}>
            <span className={styles.activityTitle}>포트폴리오</span>
            <button
              className={styles.moreBtn}
              onClick={() => onNavigate("portfolio")}
            >
              더보기
              <ArrowRight size={12} />
            </button>
          </div>
          <div className={styles.activityList}>
            {recentPortfolio.length > 0 ? (
              recentPortfolio.map((tx) => (
                <div key={tx.id} className={styles.activityRow}>
                  <span className={styles.activityDate}>
                    {formatTradeDate(tx.trade_date)}
                  </span>
                  <span
                    className={
                      tx.type === "buy" ? styles.badgeBuy : styles.badgeSell
                    }
                  >
                    {tx.type === "buy" ? "매수" : "매도"}
                  </span>
                  <span className={styles.activityName}>{tx.name}</span>
                  <span className={styles.activityAmount}>
                    {formatWon(tx.total_amount)}
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>거래 내역이 없습니다</div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Quick Nav */}
      <div className={styles.quickNav}>
        {quickNavItems.map((item) => (
          <button
            key={item.section}
            className={styles.quickNavItem}
            onClick={() => onNavigate(item.section)}
          >
            <span className={styles.quickNavIcon}>{item.icon}</span>
            <span className={styles.quickNavLabel}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
