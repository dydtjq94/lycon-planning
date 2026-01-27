"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
import { MoreVertical, TrendingUp, TrendingDown, Trash2, ChevronDown } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { useSnapshots, useDeleteSnapshot } from "@/hooks/useFinancialData";
import styles from "./AssetRecordTab.module.css";

type ChartMetric = "net_worth" | "total_assets" | "total_debts";

const METRIC_OPTIONS: { id: ChartMetric; label: string }[] = [
  { id: "net_worth", label: "순자산" },
  { id: "total_assets", label: "총자산" },
  { id: "total_debts", label: "총부채" },
];

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
  { id: "1M", label: "1개월", months: 1 },
  { id: "3M", label: "3개월", months: 3 },
  { id: "1Y", label: "1년", months: 12 },
  { id: "5Y", label: "5년", months: 60 },
  { id: "10Y", label: "10년", months: 120 },
  { id: "ALL", label: "전체", months: 9999 },
];

interface AssetRecordTabProps {
  profileId: string;
}

export function AssetRecordTab({ profileId }: AssetRecordTabProps) {
  const { data: snapshots = [], isLoading } = useSnapshots(profileId);
  const deleteMutation = useDeleteSnapshot(profileId);

  const [timeFilter, setTimeFilter] = useState("ALL");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>("net_worth");
  const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMetricDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 기간 필터 적용
  const filteredSnapshots = useMemo(() => {
    if (timeFilter === "ALL") return snapshots;

    const filter = TIME_FILTERS.find(f => f.id === timeFilter);
    if (!filter) return snapshots;

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - filter.months);

    return snapshots.filter(s => new Date(s.recorded_at) >= cutoffDate);
  }, [snapshots, timeFilter]);

  // 최신 기록
  const latestRecord = filteredSnapshots[0];
  const oldestRecord = filteredSnapshots[filteredSnapshots.length - 1];

  // 선택된 지표의 현재 값
  const currentValue = useMemo(() => {
    if (!latestRecord) return 0;
    return latestRecord[selectedMetric] || 0;
  }, [latestRecord, selectedMetric]);

  // 전체 변화량 계산 (선택된 지표 기준)
  const allTimeChange = useMemo(() => {
    if (!latestRecord || !oldestRecord) return { amount: 0, percent: 0 };
    const latestValue = latestRecord[selectedMetric] || 0;
    const oldestValue = oldestRecord[selectedMetric] || 0;
    const amount = latestValue - oldestValue;
    const percent = oldestValue !== 0
      ? (amount / Math.abs(oldestValue)) * 100
      : 0;
    return { amount, percent };
  }, [latestRecord, oldestRecord, selectedMetric]);

  // 차트 데이터 (역순 - 오래된 순서대로)
  const chartSnapshots = [...filteredSnapshots].reverse();
  const chartData = useMemo(() => {
    const labels = chartSnapshots.map(s => {
      const date = new Date(s.recorded_at);
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
    });
    const metricData = chartSnapshots.map(s => s[selectedMetric] || 0);

    return {
      labels,
      datasets: [
        {
          data: metricData,
          borderColor: "#14b8a6",
          backgroundColor: "rgba(20, 184, 166, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: chartSnapshots.length > 20 ? 0 : 4,
          pointBackgroundColor: "#14b8a6",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [chartSnapshots, selectedMetric]);

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

  // 기록 삭제
  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setOpenMenuId(null);
    } catch (error) {
      console.error("Failed to delete snapshot:", error);
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 상단 요약 */}
      <div className={styles.summaryHeader}>
        <div className={styles.mainMetric}>
          <div className={styles.metricSelector} ref={dropdownRef}>
            <button
              className={styles.metricButton}
              onClick={() => setIsMetricDropdownOpen(!isMetricDropdownOpen)}
            >
              <span>{METRIC_OPTIONS.find(m => m.id === selectedMetric)?.label}</span>
              <ChevronDown size={16} />
            </button>
            {isMetricDropdownOpen && (
              <div className={styles.metricDropdown}>
                {METRIC_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    className={`${styles.metricOption} ${selectedMetric === option.id ? styles.active : ""}`}
                    onClick={() => {
                      setSelectedMetric(option.id);
                      setIsMetricDropdownOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={styles.mainValue}>{formatMoney(currentValue)}</div>
          <div className={`${styles.changeInfo} ${allTimeChange.amount >= 0 ? styles.positive : styles.negative}`}>
            <span className={styles.changeLabel}>ALL TIME</span>
            {allTimeChange.amount >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>
              {allTimeChange.amount >= 0 ? "+" : ""}{formatMoney(Math.abs(allTimeChange.amount))}
              ({allTimeChange.percent >= 0 ? "+" : ""}{allTimeChange.percent.toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className={styles.sideMetrics}>
          {METRIC_OPTIONS.filter(m => m.id !== selectedMetric).map((metric) => (
            <div key={metric.id} className={styles.sideMetric}>
              <div className={styles.sideLabel}>{metric.label}</div>
              <div className={styles.sideValue}>
                {formatMoney(latestRecord?.[metric.id] || 0)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 차트 */}
      {chartSnapshots.length > 0 && (
        <div className={styles.chartSection}>
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
          <div className={styles.chartContainer}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitle}>
            <h2>Progress Points</h2>
          </div>
          <p className={styles.tableDesc}>
            현재 자산을 수정하면 자동으로 기록됩니다.
          </p>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>날짜</th>
                <th>순자산</th>
                <th>총 자산</th>
                <th>총 부채</th>
                <th>저축</th>
                <th>투자</th>
                <th>실물자산</th>
                <th>무담보부채</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredSnapshots.length > 0 ? (
                filteredSnapshots.map((record) => (
                  <tr key={record.id}>
                    <td className={styles.dateCell}>{formatDate(record.recorded_at)}</td>
                    <td className={styles.netWorthCell}>
                      {formatMoney(record.net_worth)}
                    </td>
                    <td>{formatMoney(record.total_assets)}</td>
                    <td>{formatMoney(record.total_debts)}</td>
                    <td>{formatMoney(record.savings)}</td>
                    <td>{formatMoney(record.investments)}</td>
                    <td>{formatMoney(record.real_assets)}</td>
                    <td>{formatMoney(record.unsecured_debt)}</td>
                    <td>
                      <div className={styles.menuContainer}>
                        <button
                          className={styles.rowMenuBtn}
                          onClick={() => setOpenMenuId(openMenuId === record.id ? null : record.id)}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === record.id && (
                          <div className={styles.dropdownMenu}>
                            <button
                              className={styles.dropdownItem}
                              onClick={() => handleDeleteRecord(record.id)}
                            >
                              <Trash2 size={14} />
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className={styles.emptyRow}>
                    기록이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
