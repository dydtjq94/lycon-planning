"use client";

import { useMemo } from "react";
import { Plus, Trash2, User } from "lucide-react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import {
  useTodaySnapshot,
  useSnapshotItems,
  useCreateSnapshotItem,
  useUpdateSnapshotItem,
  useDeleteSnapshotItem,
} from "@/hooks/useFinancialData";
import type { FinancialSnapshotItem } from "@/types/tables";
import { formatMoney } from "@/lib/utils";
import styles from "./CurrentAssetTab.module.css";
import { useState } from "react";

ChartJS.register(ArcElement, Tooltip, Legend);

interface CurrentAssetTabProps {
  profileId: string;
}

type TabType = "savings" | "investment" | "realAsset" | "debt" | "aboutYou";

const TABS: { id: TabType; label: string }[] = [
  { id: "savings", label: "저축" },
  { id: "investment", label: "투자" },
  { id: "realAsset", label: "실물자산" },
  { id: "debt", label: "부채" },
  { id: "aboutYou", label: "About You" },
];

// 카테고리별 item_type 매핑
const ITEM_TYPES: Record<Exclude<TabType, "aboutYou">, { value: string; label: string }[]> = {
  savings: [
    { value: "checking", label: "입출금통장" },
    { value: "savings", label: "적금" },
    { value: "deposit", label: "예금" },
    { value: "emergency", label: "비상금" },
  ],
  investment: [
    { value: "domestic_stock", label: "국내주식" },
    { value: "foreign_stock", label: "해외주식" },
    { value: "fund", label: "펀드" },
    { value: "bond", label: "채권" },
    { value: "crypto", label: "암호화폐" },
    { value: "etf", label: "ETF" },
  ],
  realAsset: [
    { value: "real_estate", label: "부동산" },
    { value: "car", label: "자동차" },
    { value: "precious_metal", label: "귀금속" },
    { value: "art", label: "미술품" },
    { value: "other", label: "기타" },
  ],
  debt: [
    { value: "mortgage", label: "주택담보대출" },
    { value: "jeonse", label: "전세대출" },
    { value: "credit", label: "신용대출" },
    { value: "student", label: "학자금대출" },
    { value: "card", label: "카드대출" },
    { value: "car", label: "자동차대출" },
    { value: "installment", label: "할부금" },
    { value: "other", label: "기타" },
  ],
};

// 카테고리별 색상
const CATEGORY_COLORS = {
  savings: "#3b82f6",
  investment: "#22c55e",
  realAsset: "#f59e0b",
  debt: "#ef4444",
};

export function CurrentAssetTab({ profileId }: CurrentAssetTabProps) {
  const [activeTab, setActiveTab] = useState<TabType>("savings");

  // React Query 훅 사용 - 캐싱으로 탭 전환 시 빠름
  const { data: snapshot, isLoading: isSnapshotLoading } = useTodaySnapshot(profileId);
  const { data: items = [], isLoading: isItemsLoading } = useSnapshotItems(snapshot?.id);

  // Mutation 훅
  const createMutation = useCreateSnapshotItem(profileId);
  const updateMutation = useUpdateSnapshotItem(profileId, snapshot?.id || '');
  const deleteMutation = useDeleteSnapshotItem(profileId, snapshot?.id || '');

  const isLoading = isSnapshotLoading || isItemsLoading;

  // 카테고리별 합계 계산
  const totals = useMemo(() => {
    const savings = items
      .filter((i) => i.category === "asset" && ["checking", "savings", "deposit", "emergency"].includes(i.item_type))
      .reduce((sum, i) => sum + i.amount, 0);
    const investment = items
      .filter((i) => i.category === "asset" && ["domestic_stock", "foreign_stock", "fund", "bond", "crypto", "etf"].includes(i.item_type))
      .reduce((sum, i) => sum + i.amount, 0);
    const realAsset = items
      .filter((i) => i.category === "asset" && ["real_estate", "car", "precious_metal", "art", "other"].includes(i.item_type))
      .reduce((sum, i) => sum + i.amount, 0);
    const debt = items
      .filter((i) => i.category === "debt")
      .reduce((sum, i) => sum + i.amount, 0);

    const totalAssets = savings + investment + realAsset;
    const netWorth = totalAssets - debt;
    const equity = totalAssets > 0 ? totalAssets - debt : 0;

    return { savings, investment, realAsset, debt, totalAssets, netWorth, equity };
  }, [items]);

  // 현재 탭의 항목들
  const currentItems = useMemo(() => {
    if (activeTab === "aboutYou") return [];
    const typeValues = ITEM_TYPES[activeTab].map((t) => t.value);
    const category = activeTab === "debt" ? "debt" : "asset";
    return items.filter((i) => i.category === category && typeValues.includes(i.item_type));
  }, [items, activeTab]);

  // 항목 추가
  const handleAddItem = async () => {
    if (!snapshot || activeTab === "aboutYou") return;

    const category = activeTab === "debt" ? "debt" : "asset";
    const defaultType = ITEM_TYPES[activeTab][0].value;

    createMutation.mutate({
      snapshot_id: snapshot.id,
      category,
      item_type: defaultType,
      title: "",
      amount: 0,
      owner: "self",
    });
  };

  // 항목 업데이트
  const handleUpdateItem = async (id: string, updates: Partial<FinancialSnapshotItem>) => {
    if (!snapshot) return;
    updateMutation.mutate({ id, updates });
  };

  // 항목 삭제
  const handleDeleteItem = async (id: string) => {
    if (!snapshot) return;
    deleteMutation.mutate(id);
  };

  // 차트 옵션
  const chartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    maintainAspectRatio: false,
    cutout: "75%",
  };

  // 빈 상태 색상
  const EMPTY_COLOR = "#e5e7eb";

  // 데이터가 있는지 확인
  const hasNetWorthData = totals.savings > 0 || totals.investment > 0 || totals.realAsset > 0 || totals.debt > 0;
  const hasAssetsData = totals.savings > 0 || totals.investment > 0 || totals.realAsset > 0;
  const hasDebtData = totals.debt > 0;
  const hasEquityData = totals.equity > 0 || totals.debt > 0;

  // 순자산 차트 (다색상)
  const netWorthChartData = {
    labels: hasNetWorthData ? ["저축", "투자", "실물자산", "부채"] : ["빈"],
    datasets: [
      {
        data: hasNetWorthData
          ? [totals.savings || 0.01, totals.investment || 0.01, totals.realAsset || 0.01, totals.debt || 0.01]
          : [1],
        backgroundColor: hasNetWorthData
          ? [CATEGORY_COLORS.savings, CATEGORY_COLORS.investment, CATEGORY_COLORS.realAsset, CATEGORY_COLORS.debt]
          : [EMPTY_COLOR],
        borderWidth: 0,
      },
    ],
  };

  // 자산 차트 (자산 색상들)
  const assetsChartData = {
    labels: hasAssetsData ? ["저축", "투자", "실물자산"] : ["빈"],
    datasets: [
      {
        data: hasAssetsData
          ? [totals.savings || 0.01, totals.investment || 0.01, totals.realAsset || 0.01]
          : [1],
        backgroundColor: hasAssetsData
          ? [CATEGORY_COLORS.savings, CATEGORY_COLORS.investment, CATEGORY_COLORS.realAsset]
          : [EMPTY_COLOR],
        borderWidth: 0,
      },
    ],
  };

  // 부채 차트
  const liabilitiesChartData = {
    labels: ["부채", "빈공간"],
    datasets: [
      {
        data: hasDebtData
          ? [totals.debt, totals.totalAssets > totals.debt ? totals.totalAssets - totals.debt : 0.01]
          : [1],
        backgroundColor: hasDebtData ? ["#64748b", "#e2e8f0"] : [EMPTY_COLOR],
        borderWidth: 0,
      },
    ],
  };

  // Equity 차트
  const equityChartData = {
    labels: ["순자산", "빈공간"],
    datasets: [
      {
        data: hasEquityData
          ? [totals.equity > 0 ? totals.equity : 0.01, totals.debt || 0.01]
          : [1],
        backgroundColor: hasEquityData ? ["#a78bfa", "#e2e8f0"] : [EMPTY_COLOR],
        borderWidth: 0,
      },
    ],
  };

  // 탭별 금액 가져오기
  const getTabAmount = (tabId: TabType): number | null => {
    switch (tabId) {
      case "savings": return totals.savings;
      case "investment": return totals.investment;
      case "realAsset": return totals.realAsset;
      case "debt": return totals.debt;
      case "aboutYou": return null;
    }
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
      {/* 상단 차트 섹션 */}
      <div className={styles.chartsSection}>
        {/* 순자산 (큰 차트) */}
        <div className={styles.mainChartWrapper}>
          <div className={styles.chartBox}>
            <Doughnut data={netWorthChartData} options={chartOptions} />
            <div className={styles.chartCenterText}>
              <span className={styles.chartAmount}>{formatMoney(totals.netWorth)}</span>
              <span className={styles.chartLabel}>순자산</span>
            </div>
          </div>
        </div>

        {/* 자산/부채/순자산 (작은 차트들) */}
        <div className={styles.smallChartsRow}>
          <div className={styles.smallChartWrapper}>
            <div className={styles.smallChartBox}>
              <Doughnut data={assetsChartData} options={chartOptions} />
              <div className={styles.chartCenterText}>
                <span className={styles.smallChartAmount}>{formatMoney(totals.totalAssets)}</span>
                <span className={styles.smallChartLabel}>자산</span>
              </div>
            </div>
          </div>

          <div className={styles.smallChartWrapper}>
            <div className={styles.smallChartBox}>
              <Doughnut data={liabilitiesChartData} options={chartOptions} />
              <div className={styles.chartCenterText}>
                <span className={styles.smallChartAmount}>{formatMoney(totals.debt)}</span>
                <span className={styles.smallChartLabel}>부채</span>
              </div>
            </div>
          </div>

          <div className={styles.smallChartWrapper}>
            <div className={styles.smallChartBox}>
              <Doughnut data={equityChartData} options={chartOptions} />
              <div className={styles.chartCenterText}>
                <span className={styles.smallChartAmount}>{formatMoney(totals.equity)}</span>
                <span className={styles.smallChartLabel}>순자본</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 카테고리 탭 */}
      <div className={styles.categoryTabs}>
        {TABS.map((tab) => {
          const amount = getTabAmount(tab.id);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`${styles.categoryTab} ${isActive ? styles.active : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.id === "aboutYou" ? (
                <>
                  <User size={20} className={styles.tabIconLarge} />
                  <span className={styles.tabLabel}>{tab.label}</span>
                </>
              ) : (
                <>
                  <span className={styles.tabAmount}>{formatMoney(amount || 0)}</span>
                  <span className={styles.tabLabel}>{tab.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* 항목 리스트 */}
      <div className={styles.itemsSection}>
        {activeTab === "aboutYou" ? (
          <div className={styles.aboutYouSection}>
            <p className={styles.comingSoon}>프로필 정보 (준비중)</p>
          </div>
        ) : currentItems.length === 0 ? (
          <div className={styles.emptyState}>
            <p>등록된 항목이 없습니다</p>
          </div>
        ) : (
          <div className={styles.itemsList}>
            {currentItems.map((item) => {
              const typeLabel = ITEM_TYPES[activeTab as Exclude<TabType, "aboutYou">]?.find(
                (t) => t.value === item.item_type
              )?.label || item.item_type;

              return (
                <div key={item.id} className={styles.itemCard}>
                  <div
                    className={styles.itemIcon}
                    style={{ backgroundColor: CATEGORY_COLORS[activeTab as keyof typeof CATEGORY_COLORS] || "#6b7280" }}
                  >
                    <span>{typeLabel.charAt(0)}</span>
                  </div>

                  <div className={styles.itemContent}>
                    <div className={styles.itemRow}>
                      <div className={styles.inputGroup}>
                        <label>종류</label>
                        <select
                          className={styles.selectInput}
                          value={item.item_type}
                          onChange={(e) => handleUpdateItem(item.id, { item_type: e.target.value })}
                        >
                          {ITEM_TYPES[activeTab as Exclude<TabType, "aboutYou">].map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.inputGroup}>
                        <label>금액</label>
                        <div className={styles.amountWrapper}>
                          <input
                            type="number"
                            className={styles.amountInput}
                            value={item.amount || ""}
                            onChange={(e) =>
                              handleUpdateItem(item.id, { amount: parseInt(e.target.value) || 0 })
                            }
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                          />
                          <span className={styles.unit}>만원</span>
                        </div>
                      </div>

                      <div className={styles.inputGroup}>
                        <label>소유자</label>
                        <select
                          className={styles.selectInput}
                          value={item.owner || "self"}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { owner: e.target.value as "self" | "spouse" | "joint" })
                          }
                        >
                          <option value="self">본인</option>
                          <option value="spouse">배우자</option>
                          <option value="joint">공동</option>
                        </select>
                      </div>
                    </div>

                    <div className={styles.itemRow}>
                      <div className={styles.inputGroup} style={{ flex: 1 }}>
                        <label>메모</label>
                        <input
                          type="text"
                          className={styles.textInput}
                          placeholder="예: 국민은행 적금"
                          value={item.title}
                          onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 추가 버튼 */}
        {activeTab !== "aboutYou" && (
          <button className={styles.addBtn} onClick={handleAddItem}>
            <Plus size={16} />
            <span>{TABS.find((t) => t.id === activeTab)?.label} 추가</span>
          </button>
        )}
      </div>
    </div>
  );
}
