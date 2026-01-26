"use client";

import { useState, useMemo } from "react";
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
import { Plus, MoreVertical, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, X, Calendar, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { useSnapshots, useCreateSnapshot, useDeleteSnapshot } from "@/hooks/useFinancialData";
import styles from "./AssetRecordTab.module.css";

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
  const createMutation = useCreateSnapshot(profileId);
  const deleteMutation = useDeleteSnapshot(profileId);

  const [timeFilter, setTimeFilter] = useState("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split("T")[0],
    totalAssets: 0,
    totalDebts: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
  });

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
  const currentNetWorth = latestRecord?.net_worth || 0;
  const currentAssets = latestRecord?.total_assets || 0;
  const currentLiabilities = latestRecord?.total_debts || 0;

  // 전체 변화량 계산
  const oldestRecord = filteredSnapshots[filteredSnapshots.length - 1];
  const allTimeChange = useMemo(() => {
    if (!latestRecord || !oldestRecord) return { amount: 0, percent: 0 };
    const oldNetWorth = oldestRecord.net_worth;
    const newNetWorth = latestRecord.net_worth;
    const amount = newNetWorth - oldNetWorth;
    const percent = oldNetWorth !== 0 ? ((newNetWorth - oldNetWorth) / Math.abs(oldNetWorth)) * 100 : 0;
    return { amount, percent };
  }, [latestRecord, oldestRecord]);

  // 차트 데이터 (시간순 정렬)
  const chartData = useMemo(() => {
    const sortedRecords = [...filteredSnapshots].reverse();

    const labels = sortedRecords.map((r) => {
      const date = new Date(r.recorded_at);
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
    });

    const netWorthData = sortedRecords.map((r) => r.net_worth);

    return {
      labels,
      datasets: [
        {
          data: netWorthData,
          borderColor: "#14b8a6",
          backgroundColor: "rgba(20, 184, 166, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: sortedRecords.length > 10 ? 0 : 5,
          pointBackgroundColor: "#14b8a6",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 7,
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
        ticks: { color: "#9ca3af", font: { size: 12 } },
      },
      y: {
        grid: { color: "#f3f4f6", drawBorder: false },
        ticks: {
          color: "#9ca3af",
          font: { size: 12 },
          callback: (value: number | string) => formatMoney(Number(value)),
        },
      },
    },
  };

  // 새 기록 추가
  const handleAddRecord = async () => {
    const netWorth = newRecord.totalAssets - newRecord.totalDebts;
    const monthlySavings = newRecord.monthlyIncome - newRecord.monthlyExpense;
    const savingsRate = newRecord.monthlyIncome > 0
      ? Math.round((monthlySavings / newRecord.monthlyIncome) * 10000) / 100
      : 0;

    try {
      await createMutation.mutateAsync({
        recorded_at: newRecord.date,
        snapshot_type: "followup",
        total_assets: newRecord.totalAssets,
        total_debts: newRecord.totalDebts,
        net_worth: netWorth,
        monthly_income: newRecord.monthlyIncome,
        monthly_expense: newRecord.monthlyExpense,
        monthly_savings: monthlySavings,
        savings_rate: savingsRate,
      });

      setIsAddModalOpen(false);
      setNewRecord({
        date: new Date().toISOString().split("T")[0],
        totalAssets: 0,
        totalDebts: 0,
        monthlyIncome: 0,
        monthlyExpense: 0,
      });
    } catch (error) {
      console.error("Failed to create snapshot:", error);
    }
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
        <div className={styles.netWorthSection}>
          <div className={styles.netWorthLabel}>순자산</div>
          <div className={styles.netWorthValue}>{formatMoney(currentNetWorth)}</div>
          <div className={styles.allTimeChange}>
            <span className={styles.allTimeLabel}>전체 기간</span>
            <span className={`${styles.changeValue} ${allTimeChange.amount >= 0 ? styles.positive : styles.negative}`}>
              {allTimeChange.amount >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {allTimeChange.amount >= 0 ? "+" : ""}{formatMoney(allTimeChange.amount)}
              <span className={styles.changePercent}>
                ({allTimeChange.percent >= 0 ? "+" : ""}{allTimeChange.percent.toFixed(1)}%)
              </span>
            </span>
          </div>
        </div>

        <div className={styles.statsRight}>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>총 자산</div>
            <div className={styles.statValue}>{formatMoney(currentAssets)}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>총 부채</div>
            <div className={styles.statValue}>{formatMoney(currentLiabilities)}</div>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className={styles.chartSection}>
        <div className={styles.chartContainer}>
          {filteredSnapshots.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className={styles.emptyChart}>기록이 없습니다</div>
          )}
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

      {/* 자산 기록 테이블 */}
      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitle}>
            <h2>자산 기록</h2>
          </div>
          <p className={styles.tableDesc}>
            정기적으로 자산 현황을 기록하면 목표 달성 여부를 정확히 파악할 수 있어요.
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
                <th>월 수입</th>
                <th>월 지출</th>
                <th>저축률</th>
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
                    <td>{formatMoney(record.monthly_income)}</td>
                    <td>{formatMoney(record.monthly_expense)}</td>
                    <td>{record.savings_rate.toFixed(1)}%</td>
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
                  <td colSpan={8} className={styles.emptyRow}>
                    기록이 없습니다. 첫 번째 자산 현황을 기록해보세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.tableFooter}>
          <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
            <Plus size={16} />
            추가
          </button>
          <div className={styles.pagination}>
            <span className={styles.pageInfo}>
              {filteredSnapshots.length > 0 ? `1-${filteredSnapshots.length} / ${filteredSnapshots.length}개` : "0개"}
            </span>
            <button className={styles.pageBtn} disabled>
              <ChevronLeft size={16} />
            </button>
            <button className={styles.pageBtn} disabled>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 추가 모달 */}
      {isAddModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsAddModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>새 기록 추가</h2>
              <button className={styles.modalClose} onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>날짜</label>
                <div className={styles.dateInputWrapper}>
                  <Calendar size={16} />
                  <input
                    type="date"
                    value={newRecord.date}
                    onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>총 자산</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={newRecord.totalAssets || ""}
                      onChange={(e) => setNewRecord({ ...newRecord, totalAssets: parseInt(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>총 부채</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={newRecord.totalDebts || ""}
                      onChange={(e) => setNewRecord({ ...newRecord, totalDebts: parseInt(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>월 수입</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={newRecord.monthlyIncome || ""}
                      onChange={(e) => setNewRecord({ ...newRecord, monthlyIncome: parseInt(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>월 지출</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={newRecord.monthlyExpense || ""}
                      onChange={(e) => setNewRecord({ ...newRecord, monthlyExpense: parseInt(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
              </div>

              <div className={styles.formSummary}>
                <div className={styles.summaryRow}>
                  <span>순자산</span>
                  <span className={styles.summaryValue}>
                    {formatMoney(newRecord.totalAssets - newRecord.totalDebts)}
                  </span>
                </div>
                <div className={styles.summaryRow}>
                  <span>월 저축</span>
                  <span className={styles.summaryValue}>
                    {formatMoney(newRecord.monthlyIncome - newRecord.monthlyExpense)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setIsAddModalOpen(false)}>
                취소
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleAddRecord}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
