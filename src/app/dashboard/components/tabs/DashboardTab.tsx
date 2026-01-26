"use client";

import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { MessageCircle, Calendar, TrendingUp, TrendingDown, ChevronRight, Home, Landmark, LineChart, CreditCard, Car, PiggyBank } from "lucide-react";
import { useFinancialItems } from "@/hooks/useFinancialData";
import { useFinancialContext } from "@/contexts/FinancialContext";
import { formatMoney } from "@/lib/utils";
import { runSimulationFromItems } from "@/lib/services/simulationEngine";
import { calculateEndYear } from "@/lib/utils/chartDataTransformer";
import { DEFAULT_GLOBAL_SETTINGS } from "@/types";
import type { GlobalSettings } from "@/types";
import styles from "./DashboardTab.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

// 기간 필터 옵션
const TIME_FILTERS = [
  { id: "1Y", label: "1년", years: 1 },
  { id: "5Y", label: "5년", years: 5 },
  { id: "10Y", label: "10년", years: 10 },
  { id: "20Y", label: "20년", years: 20 },
  { id: "ALL", label: "전체", years: 100 },
];

// 자산 카테고리 아이콘 매핑
const ASSET_ICONS: Record<string, React.ReactNode> = {
  "금융자산": <LineChart size={16} />,
  "부동산": <Home size={16} />,
  "실물자산": <Car size={16} />,
  "연금": <Landmark size={16} />,
  "저축": <PiggyBank size={16} />,
};

// 자산 카테고리 색상
const ASSET_COLORS: Record<string, string> = {
  "금융자산": "#10b981",
  "부동산": "#3b82f6",
  "실물자산": "#f59e0b",
  "연금": "#8b5cf6",
  "저축": "#06b6d4",
};

interface DashboardTabProps {
  simulationId: string;
  birthYear: number;
  spouseBirthYear: number | null;
  retirementAge: number | null;
  globalSettings: GlobalSettings | null;
  unreadMessageCount: number;
  onNavigate: (section: string) => void;
}

export function DashboardTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  globalSettings,
  unreadMessageCount,
  onNavigate,
}: DashboardTabProps) {
  const { simulationProfile } = useFinancialContext();
  const { data: items = [] } = useFinancialItems(simulationId, simulationProfile);
  const [timeFilter, setTimeFilter] = useState("ALL");

  // 중복 제거된 items
  const deduplicatedItems = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.category}-${item.title}-${item.type}-${item.owner || "self"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);

  // 시뮬레이션 결과
  const simulationResult = useMemo(() => {
    const simulationEndYear = calculateEndYear(birthYear, spouseBirthYear);
    const yearsToSimulate = simulationEndYear - new Date().getFullYear();
    const engineProfile = {
      ...simulationProfile,
      spouseBirthYear: simulationProfile.spouseBirthYear ?? undefined,
    };
    return runSimulationFromItems(
      deduplicatedItems,
      engineProfile,
      globalSettings || DEFAULT_GLOBAL_SETTINGS,
      yearsToSimulate
    );
  }, [deduplicatedItems, simulationProfile, globalSettings, birthYear, spouseBirthYear]);

  // 필터링된 스냅샷
  const filteredSnapshots = useMemo(() => {
    const filter = TIME_FILTERS.find(f => f.id === timeFilter);
    if (!filter || filter.years >= 100) return simulationResult.snapshots;
    return simulationResult.snapshots.slice(0, filter.years);
  }, [simulationResult.snapshots, timeFilter]);

  // 차트 데이터
  const chartData = useMemo(() => {
    const labels = filteredSnapshots.map(s => `${s.year}`);
    const netWorthData = filteredSnapshots.map(s => s.netWorth);

    return {
      labels,
      datasets: [
        {
          data: netWorthData,
          borderColor: "#14b8a6",
          backgroundColor: "rgba(20, 184, 166, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: filteredSnapshots.length > 20 ? 0 : 4,
          pointBackgroundColor: "#14b8a6",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [filteredSnapshots]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number | null } }) =>
            context.parsed.y !== null ? formatMoney(context.parsed.y) : "",
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#9ca3af",
          font: { size: 11 },
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: { color: "#f3f4f6", drawBorder: false },
        ticks: {
          color: "#9ca3af",
          font: { size: 11 },
          callback: (value: number | string) => formatMoney(Number(value)),
        },
      },
    },
  };

  // 현재 순자산
  const currentNetWorth = simulationResult.summary.currentNetWorth;

  // 총 자산/부채
  const { totalAssets, totalLiabilities } = useMemo(() => {
    if (simulationResult.snapshots.length === 0) {
      return { totalAssets: 0, totalLiabilities: 0 };
    }
    const firstYear = simulationResult.snapshots[0];
    return {
      totalAssets: firstYear.totalAssets,
      totalLiabilities: firstYear.totalDebts,
    };
  }, [simulationResult]);

  // 전체 기간 변화량
  const allTimeChange = useMemo(() => {
    if (filteredSnapshots.length < 2) return { amount: 0, percent: 0 };
    const first = filteredSnapshots[0].netWorth;
    const last = filteredSnapshots[filteredSnapshots.length - 1].netWorth;
    const amount = last - first;
    const percent = first !== 0 ? (amount / Math.abs(first)) * 100 : 0;
    return { amount, percent };
  }, [filteredSnapshots]);

  // 자산 카테고리별 분류
  const assetBreakdown = useMemo(() => {
    const breakdown: { label: string; amount: number; icon: React.ReactNode; color: string }[] = [];

    const financialAssets = deduplicatedItems
      .filter(i => i.category === "savings")
      .reduce((sum, i) => sum + ((i.data as { currentBalance?: number })?.currentBalance || 0), 0);
    if (financialAssets > 0) breakdown.push({
      label: "금융자산",
      amount: financialAssets,
      icon: ASSET_ICONS["금융자산"],
      color: ASSET_COLORS["금융자산"],
    });

    const realEstateAssets = deduplicatedItems
      .filter(i => i.category === "real_estate")
      .reduce((sum, i) => sum + ((i.data as { currentValue?: number })?.currentValue || 0), 0);
    if (realEstateAssets > 0) breakdown.push({
      label: "부동산",
      amount: realEstateAssets,
      icon: ASSET_ICONS["부동산"],
      color: ASSET_COLORS["부동산"],
    });

    const physicalAssets = deduplicatedItems
      .filter(i => i.category === "asset")
      .reduce((sum, i) => sum + ((i.data as { currentValue?: number })?.currentValue || 0), 0);
    if (physicalAssets > 0) breakdown.push({
      label: "실물자산",
      amount: physicalAssets,
      icon: ASSET_ICONS["실물자산"],
      color: ASSET_COLORS["실물자산"],
    });

    const pensionAssets = deduplicatedItems
      .filter(i => i.category === "pension")
      .reduce((sum, i) => sum + ((i.data as { currentBalance?: number })?.currentBalance || 0), 0);
    if (pensionAssets > 0) breakdown.push({
      label: "연금",
      amount: pensionAssets,
      icon: ASSET_ICONS["연금"],
      color: ASSET_COLORS["연금"],
    });

    return breakdown.sort((a, b) => b.amount - a.amount);
  }, [deduplicatedItems]);

  // 부채 카테고리별 분류
  const liabilityBreakdown = useMemo(() => {
    const breakdown: { label: string; amount: number }[] = [];

    const debts = deduplicatedItems.filter(i => i.category === "debt");
    debts.forEach(debt => {
      const balance = (debt.data as { remainingBalance?: number })?.remainingBalance || 0;
      if (balance > 0) {
        breakdown.push({ label: debt.title, amount: balance });
      }
    });

    return breakdown.sort((a, b) => b.amount - a.amount);
  }, [deduplicatedItems]);

  return (
    <div className={styles.container}>
      {/* 상단 카드 영역 */}
      <div className={styles.topCards}>
        <button className={styles.card} onClick={() => onNavigate("messages")}>
          <div className={styles.cardIcon}>
            <MessageCircle size={20} />
            {unreadMessageCount > 0 && (
              <span className={styles.badge}>{unreadMessageCount > 9 ? "9+" : unreadMessageCount}</span>
            )}
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>채팅</span>
            <span className={styles.cardDesc}>
              {unreadMessageCount > 0 ? `${unreadMessageCount}개의 새 메시지` : "담당자와 대화"}
            </span>
          </div>
          <ChevronRight size={18} className={styles.cardArrow} />
        </button>

        <button className={styles.card} onClick={() => onNavigate("consultation")}>
          <div className={styles.cardIcon}>
            <Calendar size={20} />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>상담</span>
            <span className={styles.cardDesc}>상담 일정 확인</span>
          </div>
          <ChevronRight size={18} className={styles.cardArrow} />
        </button>
      </div>

      {/* 메인 그리드: 차트 + 자산/부채 */}
      <div className={styles.mainGrid}>
        {/* 왼쪽: 순자산 + 차트 */}
        <div className={styles.chartSection}>
          <div className={styles.netWorthHeader}>
            <div className={styles.netWorthLeft}>
              <span className={styles.netWorthLabel}>순자산</span>
              <div className={styles.netWorthValue}>{formatMoney(currentNetWorth)}</div>
            </div>
            <div className={styles.netWorthRight}>
              <span className={styles.changeLabel}>전체 기간</span>
              <span className={`${styles.changeValue} ${allTimeChange.amount >= 0 ? styles.positive : styles.negative}`}>
                {allTimeChange.amount >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {allTimeChange.amount >= 0 ? "+" : ""}{formatMoney(Math.abs(allTimeChange.amount))}
                <span className={styles.changePercent}>
                  ({allTimeChange.percent >= 0 ? "+" : ""}{allTimeChange.percent.toFixed(1)}%)
                </span>
              </span>
            </div>
          </div>

          <div className={styles.chartContainer}>
            <Line data={chartData} options={chartOptions} />
          </div>

          <div className={styles.timeFilters}>
            {TIME_FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={`${styles.timeFilterBtn} ${timeFilter === filter.id ? styles.active : ""}`}
                onClick={() => setTimeFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* 오른쪽: 자산/부채 리스트 */}
        <div className={styles.assetLiabilitySection}>
          {/* 자산 */}
          <div className={styles.assetBox}>
            <div className={styles.boxHeader}>
              <span className={styles.boxLabel}>자산</span>
              <span className={styles.boxTotal}>{formatMoney(totalAssets)}</span>
            </div>
            <div className={styles.breakdownList}>
              {assetBreakdown.length > 0 ? (
                assetBreakdown.map((item, idx) => (
                  <div key={idx} className={styles.breakdownItem}>
                    <div className={styles.breakdownLeft}>
                      <div className={styles.breakdownIcon} style={{ backgroundColor: item.color }}>
                        {item.icon}
                      </div>
                      <span className={styles.breakdownLabel}>{item.label}</span>
                    </div>
                    <span className={styles.breakdownValue}>{formatMoney(item.amount)}</span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyBreakdown}>자산 없음</div>
              )}
            </div>
          </div>

          {/* 부채 */}
          <div className={styles.liabilityBox}>
            <div className={styles.boxHeader}>
              <span className={styles.boxLabel}>부채</span>
              <span className={styles.boxTotal}>{formatMoney(totalLiabilities)}</span>
            </div>
            <div className={styles.breakdownList}>
              {liabilityBreakdown.length > 0 ? (
                liabilityBreakdown.map((item, idx) => (
                  <div key={idx} className={styles.breakdownItem}>
                    <div className={styles.breakdownLeft}>
                      <div className={styles.breakdownIcon} style={{ backgroundColor: "#ef4444" }}>
                        <CreditCard size={16} />
                      </div>
                      <span className={styles.breakdownLabel}>{item.label}</span>
                    </div>
                    <span className={styles.breakdownValue}>{formatMoney(item.amount)}</span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyBreakdown}>부채 없음</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 시뮬레이션 섹션 */}
      <div className={styles.scenarioSection}>
        <div className={styles.scenarioHeader}>
          <span className={styles.scenarioLabel}>시뮬레이션</span>
        </div>
        <div className={styles.scenarioCards}>
          <button className={styles.scenarioCard} onClick={() => onNavigate("networth")}>
            <div className={styles.scenarioIcon}>
              <Landmark size={24} />
            </div>
            <div className={styles.scenarioContent}>
              <span className={styles.scenarioTitle}>은퇴</span>
              <span className={styles.scenarioDesc}>순자산 및 현금흐름 시뮬레이션</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
