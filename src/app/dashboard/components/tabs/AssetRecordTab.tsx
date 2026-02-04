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
import {
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Trash2,
  ChevronDown,
  Plus,
  Pencil,
  X,
} from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { useSnapshots, useDeleteSnapshot, useCreateSnapshot, useUpdateSnapshot } from "@/hooks/useFinancialData";
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
  Tooltip,
);

// 기간 필터 옵션
const TIME_FILTERS = [
  { id: "1M", label: "1개월", displayLabel: "지난 1개월", months: 1 },
  { id: "3M", label: "3개월", displayLabel: "지난 3개월", months: 3 },
  { id: "1Y", label: "1년", displayLabel: "지난 1년", months: 12 },
  { id: "5Y", label: "5년", displayLabel: "지난 5년", months: 60 },
  { id: "10Y", label: "10년", displayLabel: "지난 10년", months: 120 },
  { id: "ALL", label: "전체", displayLabel: "전체 기간", months: 9999 },
];

interface AssetRecordTabProps {
  profileId: string;
}

interface SnapshotModalData {
  date: string;
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
  savings: number;
  investments: number;
  realEstate: number;
  realAssets: number;
  unsecuredDebt: number;
}

export function AssetRecordTab({ profileId }: AssetRecordTabProps) {
  const { data: snapshots = [], isLoading } = useSnapshots(profileId);
  const deleteMutation = useDeleteSnapshot(profileId);
  const createMutation = useCreateSnapshot(profileId);
  const updateMutation = useUpdateSnapshot(profileId);

  const [timeFilter, setTimeFilter] = useState("ALL");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] =
    useState<ChartMetric>("net_worth");
  const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<SnapshotModalData>({
    date: "",
    netWorth: 0,
    totalAssets: 0,
    totalDebts: 0,
    savings: 0,
    investments: 0,
    realEstate: 0,
    realAssets: 0,
    unsecuredDebt: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsMetricDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 기간 필터 적용
  const filteredSnapshots = useMemo(() => {
    if (timeFilter === "ALL") return snapshots;

    const filter = TIME_FILTERS.find((f) => f.id === timeFilter);
    if (!filter) return snapshots;

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - filter.months);

    return snapshots.filter((s) => new Date(s.recorded_at) >= cutoffDate);
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
    const percent =
      oldestValue !== 0 ? (amount / Math.abs(oldestValue)) * 100 : 0;
    return { amount, percent };
  }, [latestRecord, oldestRecord, selectedMetric]);

  // 차트 데이터 (역순 - 오래된 순서대로)
  const chartSnapshots = [...filteredSnapshots].reverse();
  const chartData = useMemo(() => {
    const labels = chartSnapshots.map((s) => {
      const date = new Date(s.recorded_at);
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    });
    const metricData = chartSnapshots.map((s) => s[selectedMetric] || 0);

    return {
      labels,
      datasets: [
        {
          data: metricData,
          borderColor: "#14b8a6",
          backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D; chartArea: { top: number; bottom: number } } }) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(20, 184, 166, 0.1)";
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, "rgba(20, 184, 166, 0.15)");
            gradient.addColorStop(1, "rgba(20, 184, 166, 0)");
            return gradient;
          },
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
        enabled: false,
        external: (context: any) => {
          const tooltipId = "asset-record-tooltip";
          let tooltipEl = document.getElementById(tooltipId);

          if (!tooltipEl) {
            tooltipEl = document.createElement("div");
            tooltipEl.id = tooltipId;
            tooltipEl.style.cssText = `
              position: fixed;
              pointer-events: none;
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(8px);
              border-radius: 8px;
              padding: 10px 14px;
              font-size: 13px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              z-index: 9999;
              transition: opacity 0.15s ease;
              min-width: 140px;
            `;
            document.body.appendChild(tooltipEl);
          }

          const { tooltip } = context;

          if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = "0";
            return;
          }

          if (tooltip.dataPoints && tooltip.dataPoints.length > 0) {
            const dataPoint = tooltip.dataPoints[0];
            const value = dataPoint.parsed.y;
            const dateLabel = dataPoint.label;
            const metricLabel =
              METRIC_OPTIONS.find((m) => m.id === selectedMetric)?.label ||
              "순자산";

            tooltipEl.innerHTML = `
              <div style="margin-bottom: 6px; color: #666; font-size: 11px;">${dateLabel}</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: #14b8a6; flex-shrink: 0;"></span>
                <span style="color: #333; font-weight: 500;">${metricLabel}</span>
                <span style="color: #333; font-weight: 600; margin-left: auto;">${formatMoney(value)}</span>
              </div>
            `;
          }

          const chartRect = context.chart.canvas.getBoundingClientRect();
          const tooltipWidth = tooltipEl.offsetWidth;
          const tooltipHeight = tooltipEl.offsetHeight;

          let left = chartRect.left + tooltip.caretX + 10;
          let top = chartRect.top + tooltip.caretY - tooltipHeight / 2;

          if (left + tooltipWidth > window.innerWidth - 10) {
            left = chartRect.left + tooltip.caretX - tooltipWidth - 10;
          }
          if (top < 10) {
            top = 10;
          }
          if (top + tooltipHeight > window.innerHeight - 10) {
            top = window.innerHeight - tooltipHeight - 10;
          }

          tooltipEl.style.opacity = "1";
          tooltipEl.style.left = `${left}px`;
          tooltipEl.style.top = `${top}px`;
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

  // 날짜 포맷 (YYYY.MM.DD)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  };

  // 현재 선택된 기간 필터의 표시 라벨
  const currentFilterLabel = TIME_FILTERS.find(f => f.id === timeFilter)?.displayLabel || "전체 기간";

  // 모달 열기 (추가)
  const handleOpenAddModal = () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setModalData({
      date: dateStr,
      netWorth: 0,
      totalAssets: 0,
      totalDebts: 0,
      savings: 0,
      investments: 0,
      realEstate: 0,
      realAssets: 0,
      unsecuredDebt: 0,
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  // 모달 열기 (수정)
  const handleOpenEditModal = (record: typeof snapshots[0]) => {
    setModalData({
      date: record.recorded_at.split("T")[0],
      netWorth: record.net_worth,
      totalAssets: record.total_assets,
      totalDebts: record.total_debts,
      savings: record.savings,
      investments: record.investments,
      realEstate: record.real_estate || 0,
      realAssets: record.real_assets,
      unsecuredDebt: record.unsecured_debt,
    });
    setEditingId(record.id);
    setOpenMenuId(null);
    setIsModalOpen(true);
  };

  // 모달 저장
  const handleSaveModal = async () => {
    if (editingId) {
      // 수정 모드
      await updateMutation.mutateAsync({
        id: editingId,
        updates: {
          recorded_at: modalData.date,
          net_worth: modalData.netWorth,
          total_assets: modalData.totalAssets,
          total_debts: modalData.totalDebts,
          savings: modalData.savings,
          investments: modalData.investments,
          real_estate: modalData.realEstate,
          real_assets: modalData.realAssets,
          unsecured_debt: modalData.unsecuredDebt,
        },
      });
    } else {
      // 추가 모드 - 같은 날짜 있는지 확인
      const existingSnapshot = snapshots.find(
        (s) => s.recorded_at.split("T")[0] === modalData.date
      );

      if (existingSnapshot) {
        // 같은 날짜 존재 - 덮어쓸지 확인
        if (!confirm(`${modalData.date}에 이미 기록이 있습니다. 덮어쓰시겠습니까?`)) {
          return;
        }
        // 기존 스냅샷 업데이트
        await updateMutation.mutateAsync({
          id: existingSnapshot.id,
          updates: {
            net_worth: modalData.netWorth,
            total_assets: modalData.totalAssets,
            total_debts: modalData.totalDebts,
            savings: modalData.savings,
            investments: modalData.investments,
            real_estate: modalData.realEstate,
            real_assets: modalData.realAssets,
            unsecured_debt: modalData.unsecuredDebt,
          },
        });
      } else {
        // 새로 생성
        await createMutation.mutateAsync({
          recorded_at: modalData.date,
          net_worth: modalData.netWorth,
          total_assets: modalData.totalAssets,
          total_debts: modalData.totalDebts,
          savings: modalData.savings,
          investments: modalData.investments,
          real_estate: modalData.realEstate,
          real_assets: modalData.realAssets,
          unsecured_debt: modalData.unsecuredDebt,
        });
      }
    }
    setIsModalOpen(false);
    setEditingId(null);
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
              <span>
                {METRIC_OPTIONS.find((m) => m.id === selectedMetric)?.label}
              </span>
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
          <div
            className={`${styles.changeInfo} ${allTimeChange.amount >= 0 ? styles.positive : styles.negative}`}
          >
            <span className={styles.changeLabel}>{currentFilterLabel}</span>
            {allTimeChange.amount >= 0 ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingDown size={14} />
            )}
            <span>
              {allTimeChange.amount >= 0 ? "+" : ""}
              {formatMoney(Math.abs(allTimeChange.amount))}(
              {allTimeChange.percent >= 0 ? "+" : ""}
              {allTimeChange.percent.toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className={styles.sideMetrics}>
          {METRIC_OPTIONS.filter((m) => m.id !== selectedMetric).map(
            (metric) => (
              <div key={metric.id} className={styles.sideMetric}>
                <div className={styles.sideLabel}>{metric.label}</div>
                <div className={styles.sideValue}>
                  {formatMoney(latestRecord?.[metric.id] || 0)}
                </div>
              </div>
            ),
          )}
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
            <h2>자산 기록</h2>
          </div>
          <p className={styles.tableDesc}>
            현재 자산을 저장하면 자동으로 기록됩니다.
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
                <th>부동산</th>
                <th>실물자산</th>
                <th>무담보부채</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredSnapshots.length > 0 ? (
                filteredSnapshots.map((record) => (
                  <tr key={record.id}>
                    <td className={styles.dateCell}>
                      {formatDate(record.recorded_at)}
                    </td>
                    <td className={styles.netWorthCell}>
                      {formatMoney(record.net_worth)}
                    </td>
                    <td>{formatMoney(record.total_assets)}</td>
                    <td>{formatMoney(record.total_debts)}</td>
                    <td>{formatMoney(record.savings)}</td>
                    <td>{formatMoney(record.investments)}</td>
                    <td>{formatMoney(record.real_estate || 0)}</td>
                    <td>{formatMoney(record.real_assets)}</td>
                    <td>{formatMoney(record.unsecured_debt)}</td>
                    <td>
                      <div className={styles.menuContainer}>
                        <button
                          className={styles.rowMenuBtn}
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === record.id ? null : record.id,
                            )
                          }
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === record.id && (
                          <div className={styles.dropdownMenu}>
                            <button
                              className={styles.dropdownItem}
                              onClick={() => handleOpenEditModal(record)}
                            >
                              <Pencil size={14} />
                              수정
                            </button>
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
                  <td colSpan={10} className={styles.emptyRow}>
                    기록이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button className={styles.addButton} onClick={handleOpenAddModal}>
          <Plus size={16} />
          기록 추가
        </button>
      </div>

      {/* 기록 추가/수정 모달 */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingId ? "기록 수정" : "기록 추가"}</h2>
              <button className={styles.modalClose} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>날짜</label>
                <div className={styles.dateInputWrapper}>
                  <input
                    type="date"
                    value={modalData.date}
                    onChange={(e) => setModalData({ ...modalData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>저축</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={modalData.savings || ""}
                      onChange={(e) => {
                        const savings = parseInt(e.target.value) || 0;
                        const totalAssets = savings + modalData.investments + modalData.realEstate + modalData.realAssets;
                        const netWorth = totalAssets - modalData.totalDebts;
                        setModalData({ ...modalData, savings, totalAssets, netWorth });
                      }}
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
                      value={modalData.investments || ""}
                      onChange={(e) => {
                        const investments = parseInt(e.target.value) || 0;
                        const totalAssets = modalData.savings + investments + modalData.realEstate + modalData.realAssets;
                        const netWorth = totalAssets - modalData.totalDebts;
                        setModalData({ ...modalData, investments, totalAssets, netWorth });
                      }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>부동산</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={modalData.realEstate || ""}
                      onChange={(e) => {
                        const realEstate = parseInt(e.target.value) || 0;
                        const totalAssets = modalData.savings + modalData.investments + realEstate + modalData.realAssets;
                        const netWorth = totalAssets - modalData.totalDebts;
                        setModalData({ ...modalData, realEstate, totalAssets, netWorth });
                      }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>실물자산</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={modalData.realAssets || ""}
                      onChange={(e) => {
                        const realAssets = parseInt(e.target.value) || 0;
                        const totalAssets = modalData.savings + modalData.investments + modalData.realEstate + realAssets;
                        const netWorth = totalAssets - modalData.totalDebts;
                        setModalData({ ...modalData, realAssets, totalAssets, netWorth });
                      }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>부채</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={modalData.totalDebts || ""}
                      onChange={(e) => {
                        const totalDebts = parseInt(e.target.value) || 0;
                        const netWorth = modalData.totalAssets - totalDebts;
                        setModalData({ ...modalData, totalDebts, netWorth });
                      }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span>만원</span>
                  </div>
                </div>
                <div className={styles.formGroup}></div>
              </div>

              <div className={styles.formSummary}>
                <div className={styles.summaryRow}>
                  <span>총 자산</span>
                  <span className={styles.summaryValue}>{formatMoney(modalData.totalAssets)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>순자산</span>
                  <span className={styles.summaryValue}>{formatMoney(modalData.netWorth)}</span>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                취소
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSaveModal}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
