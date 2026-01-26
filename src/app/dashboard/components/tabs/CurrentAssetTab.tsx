"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Wallet, CreditCard, TrendingUp, TrendingDown } from "lucide-react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import {
  getOrCreateTodaySnapshot,
  getSnapshotItems,
  createSnapshotItem,
  updateSnapshotItem,
  deleteSnapshotItem,
  recalculateSnapshotSummary,
} from "@/lib/services/snapshotService";
import type { FinancialSnapshot, FinancialSnapshotItem } from "@/types/tables";
import { formatMoney } from "@/lib/utils";
import styles from "./CurrentAssetTab.module.css";

ChartJS.register(ArcElement, Tooltip, Legend);

interface CurrentAssetTabProps {
  profileId: string;
}

type TabType = "savings" | "investment" | "realAsset" | "debt";

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "savings", label: "저축", icon: <Wallet size={16} /> },
  { id: "investment", label: "투자", icon: <TrendingUp size={16} /> },
  { id: "realAsset", label: "실물자산", icon: <TrendingUp size={16} /> },
  { id: "debt", label: "부채", icon: <CreditCard size={16} /> },
];

// 카테고리별 item_type 매핑
const ITEM_TYPES: Record<TabType, { value: string; label: string }[]> = {
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

export function CurrentAssetTab({ profileId }: CurrentAssetTabProps) {
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [items, setItems] = useState<FinancialSnapshotItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("savings");
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const snap = await getOrCreateTodaySnapshot(profileId);
        setSnapshot(snap);
        const snapItems = await getSnapshotItems(snap.id);
        setItems(snapItems);
      } catch (error) {
        console.error("Failed to load snapshot:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [profileId]);

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

    return { savings, investment, realAsset, debt, totalAssets, netWorth };
  }, [items]);

  // 현재 탭의 항목들
  const currentItems = useMemo(() => {
    const typeValues = ITEM_TYPES[activeTab].map((t) => t.value);
    const category = activeTab === "debt" ? "debt" : "asset";
    return items.filter((i) => i.category === category && typeValues.includes(i.item_type));
  }, [items, activeTab]);

  // 항목 추가
  const handleAddItem = async () => {
    if (!snapshot) return;

    const category = activeTab === "debt" ? "debt" : "asset";
    const defaultType = ITEM_TYPES[activeTab][0].value;

    try {
      const newItem = await createSnapshotItem({
        snapshot_id: snapshot.id,
        category,
        item_type: defaultType,
        title: "",
        amount: 0,
        owner: "self",
      });
      setItems([...items, newItem]);
      setEditingId(newItem.id);

      // 요약 재계산
      const updatedSnapshot = await recalculateSnapshotSummary(snapshot.id);
      setSnapshot(updatedSnapshot);
    } catch (error) {
      console.error("Failed to add item:", error);
    }
  };

  // 항목 업데이트
  const handleUpdateItem = async (id: string, updates: Partial<FinancialSnapshotItem>) => {
    if (!snapshot) return;

    try {
      const updated = await updateSnapshotItem(id, updates);
      setItems(items.map((i) => (i.id === id ? updated : i)));

      // 요약 재계산
      const updatedSnapshot = await recalculateSnapshotSummary(snapshot.id);
      setSnapshot(updatedSnapshot);
    } catch (error) {
      console.error("Failed to update item:", error);
    }
  };

  // 항목 삭제
  const handleDeleteItem = async (id: string) => {
    if (!snapshot) return;

    try {
      await deleteSnapshotItem(id);
      setItems(items.filter((i) => i.id !== id));

      // 요약 재계산
      const updatedSnapshot = await recalculateSnapshotSummary(snapshot.id);
      setSnapshot(updatedSnapshot);
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  // 도넛 차트 데이터
  const netWorthChartData = {
    labels: ["자산", "부채"],
    datasets: [
      {
        data: [totals.totalAssets, totals.debt],
        backgroundColor: ["#22c55e", "#ef4444"],
        borderWidth: 0,
        cutout: "70%",
      },
    ],
  };

  const assetBreakdownData = {
    labels: ["저축", "투자", "실물자산"],
    datasets: [
      {
        data: [totals.savings, totals.investment, totals.realAsset],
        backgroundColor: ["#3b82f6", "#8b5cf6", "#f59e0b"],
        borderWidth: 0,
        cutout: "60%",
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    maintainAspectRatio: false,
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
      {/* 요약 카드 섹션 */}
      <div className={styles.summarySection}>
        {/* 순자산 차트 */}
        <div className={styles.mainChart}>
          <div className={styles.chartWrapper}>
            <Doughnut data={netWorthChartData} options={chartOptions} />
            <div className={styles.chartCenter}>
              <span className={styles.chartLabel}>순자산</span>
              <span className={styles.chartValue}>{formatMoney(totals.netWorth)}</span>
            </div>
          </div>
        </div>

        {/* 상세 카드들 */}
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <div className={styles.miniChartWrapper}>
              <Doughnut data={assetBreakdownData} options={chartOptions} />
            </div>
            <div className={styles.cardInfo}>
              <span className={styles.cardLabel}>총 자산</span>
              <span className={styles.cardValue}>{formatMoney(totals.totalAssets)}</span>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.iconWrapper} style={{ backgroundColor: "#fef2f2" }}>
              <TrendingDown size={20} color="#ef4444" />
            </div>
            <div className={styles.cardInfo}>
              <span className={styles.cardLabel}>총 부채</span>
              <span className={styles.cardValue}>{formatMoney(totals.debt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 카테고리 탭 */}
      <div className={styles.categoryTabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.categoryTab} ${activeTab === tab.id ? styles.active : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span className={styles.tabAmount}>
              {formatMoney(
                tab.id === "savings"
                  ? totals.savings
                  : tab.id === "investment"
                  ? totals.investment
                  : tab.id === "realAsset"
                  ? totals.realAsset
                  : totals.debt
              )}
            </span>
          </button>
        ))}
      </div>

      {/* 항목 리스트 */}
      <div className={styles.itemsSection}>
        {currentItems.length === 0 ? (
          <div className={styles.emptyState}>
            <p>등록된 항목이 없습니다</p>
          </div>
        ) : (
          <div className={styles.itemsList}>
            {currentItems.map((item) => (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <select
                    className={styles.typeSelect}
                    value={item.item_type}
                    onChange={(e) => handleUpdateItem(item.id, { item_type: e.target.value })}
                  >
                    {ITEM_TYPES[activeTab].map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className={styles.itemBody}>
                  <div className={styles.inputGroup}>
                    <label>항목명</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="예: 국민은행 적금"
                      value={item.title}
                      onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>금액</label>
                    <div className={styles.amountInputWrapper}>
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
                      className={styles.ownerSelect}
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
              </div>
            ))}
          </div>
        )}

        {/* 추가 버튼 */}
        <button className={styles.addBtn} onClick={handleAddItem}>
          <Plus size={16} />
          <span>{TABS.find((t) => t.id === activeTab)?.label} 추가</span>
        </button>
      </div>
    </div>
  );
}
