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
import { Plus, MoreVertical, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, X, Calendar } from "lucide-react";
import { formatMoney } from "@/lib/utils";
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

// 샘플 데이터
const SAMPLE_RECORDS = [
  {
    id: "4",
    date: "2025-01-15",
    assets: 68000,
    liabilities: 25000,
    savings: 15000,
    investments: 28000,
    realAssetEquity: 45000,
    unsecuredDebt: 5000,
  },
  {
    id: "3",
    date: "2024-10-01",
    assets: 62000,
    liabilities: 27000,
    savings: 12000,
    investments: 25000,
    realAssetEquity: 42000,
    unsecuredDebt: 7000,
  },
  {
    id: "2",
    date: "2024-07-01",
    assets: 55000,
    liabilities: 30000,
    savings: 10000,
    investments: 20000,
    realAssetEquity: 38000,
    unsecuredDebt: 10000,
  },
  {
    id: "1",
    date: "2024-04-01",
    assets: 48000,
    liabilities: 32000,
    savings: 8000,
    investments: 15000,
    realAssetEquity: 35000,
    unsecuredDebt: 12000,
  },
];

interface ProgressRecord {
  id: string;
  date: string;
  assets: number;
  liabilities: number;
  savings: number;
  investments: number;
  realAssetEquity: number;
  unsecuredDebt: number;
}

export function AssetRecordTab() {
  const [records, setRecords] = useState<ProgressRecord[]>(SAMPLE_RECORDS);
  const [timeFilter, setTimeFilter] = useState("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split("T")[0],
    assets: 0,
    liabilities: 0,
    savings: 0,
    investments: 0,
    realAssetEquity: 0,
    unsecuredDebt: 0,
  });

  // 최신 기록
  const latestRecord = records[0];
  const currentNetWorth = latestRecord ? latestRecord.assets - latestRecord.liabilities : 0;
  const currentAssets = latestRecord?.assets || 0;
  const currentLiabilities = latestRecord?.liabilities || 0;

  // 전체 변화량 계산
  const oldestRecord = records[records.length - 1];
  const allTimeChange = useMemo(() => {
    if (!latestRecord || !oldestRecord) return { amount: 0, percent: 0 };
    const oldNetWorth = oldestRecord.assets - oldestRecord.liabilities;
    const newNetWorth = latestRecord.assets - latestRecord.liabilities;
    const amount = newNetWorth - oldNetWorth;
    const percent = oldNetWorth !== 0 ? ((newNetWorth - oldNetWorth) / Math.abs(oldNetWorth)) * 100 : 0;
    return { amount, percent };
  }, [latestRecord, oldestRecord]);

  // 차트 데이터 (시간순 정렬)
  const chartData = useMemo(() => {
    const sortedRecords = [...records].reverse();

    const labels = sortedRecords.map((r) => {
      const date = new Date(r.date);
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
    });

    const netWorthData = sortedRecords.map((r) => r.assets - r.liabilities);

    return {
      labels,
      datasets: [
        {
          data: netWorthData,
          borderColor: "#14b8a6",
          backgroundColor: "rgba(20, 184, 166, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: "#14b8a6",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [records]);

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
  const handleAddRecord = () => {
    const record: ProgressRecord = {
      id: Date.now().toString(),
      ...newRecord,
    };
    setRecords([record, ...records]);
    setIsAddModalOpen(false);
    setNewRecord({
      date: new Date().toISOString().split("T")[0],
      assets: 0,
      liabilities: 0,
      savings: 0,
      investments: 0,
      realAssetEquity: 0,
      unsecuredDebt: 0,
    });
  };

  // 기록 삭제
  const handleDeleteRecord = (id: string) => {
    setRecords(records.filter((r) => r.id !== id));
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

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

      {/* 자산 기록 테이블 */}
      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitle}>
            <h2>자산 기록</h2>
            <button className={styles.menuButton}>
              <MoreVertical size={18} />
            </button>
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
                <th>저축</th>
                <th>투자</th>
                <th>부동산 순자산</th>
                <th>무담보 부채</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td className={styles.dateCell}>{formatDate(record.date)}</td>
                  <td className={styles.netWorthCell}>
                    {formatMoney(record.assets - record.liabilities)}
                  </td>
                  <td>{formatMoney(record.assets)}</td>
                  <td>{formatMoney(record.liabilities)}</td>
                  <td>{formatMoney(record.savings)}</td>
                  <td>{formatMoney(record.investments)}</td>
                  <td>{formatMoney(record.realAssetEquity)}</td>
                  <td>{formatMoney(record.unsecuredDebt)}</td>
                  <td>
                    <button
                      className={styles.rowMenuBtn}
                      onClick={() => handleDeleteRecord(record.id)}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.tableFooter}>
          <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
            <Plus size={16} />
            추가
          </button>
          <div className={styles.pagination}>
            <span className={styles.pageInfo}>1-{records.length} / {records.length}개</span>
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
                      value={newRecord.assets || ""}
                      onChange={(e) => setNewRecord({ ...newRecord, assets: parseInt(e.target.value) || 0 })}
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
                      value={newRecord.liabilities || ""}
                      onChange={(e) => setNewRecord({ ...newRecord, liabilities: parseInt(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>저축</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={newRecord.savings || ""}
                      onChange={(e) => setNewRecord({ ...newRecord, savings: parseInt(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>투자</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={newRecord.investments || ""}
                      onChange={(e) => setNewRecord({ ...newRecord, investments: parseInt(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>부동산 순자산</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={newRecord.realAssetEquity || ""}
                      onChange={(e) => setNewRecord({ ...newRecord, realAssetEquity: parseInt(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>무담보 부채</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={newRecord.unsecuredDebt || ""}
                      onChange={(e) => setNewRecord({ ...newRecord, unsecuredDebt: parseInt(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
              </div>

              <div className={styles.formSummary}>
                <span>순자산</span>
                <span className={styles.summaryValue}>
                  {formatMoney(newRecord.assets - newRecord.liabilities)}
                </span>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setIsAddModalOpen(false)}>
                취소
              </button>
              <button className={styles.saveBtn} onClick={handleAddRecord}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
