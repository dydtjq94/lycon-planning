"use client";

import { useState, useEffect } from "react";
import { Plus, Calendar, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import {
  getSnapshots,
  createSnapshot,
  SNAPSHOT_TYPE_LABELS,
  calculateChange,
} from "@/lib/services/snapshotService";
import type { FinancialSnapshot } from "@/types/tables";
import { SnapshotDetail } from "./SnapshotDetail";
import styles from "./ProgressSection.module.css";

interface ProgressSectionProps {
  userId: string;
  expertId: string | null;
}

export function ProgressSection({ userId, expertId }: ProgressSectionProps) {
  const [snapshots, setSnapshots] = useState<FinancialSnapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadSnapshots = async () => {
    try {
      const data = await getSnapshots(userId);
      setSnapshots(data);

      // 가장 최근 스냅샷 자동 선택
      if (data.length > 0 && !selectedSnapshotId) {
        setSelectedSnapshotId(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load snapshots:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, [userId]);

  const handleCreateSnapshot = async () => {
    if (creating) return;

    setCreating(true);
    try {
      const isFirst = snapshots.length === 0;
      const newSnapshot = await createSnapshot({
        profile_id: userId,
        recorded_by: expertId,
        snapshot_type: isFirst ? "initial" : "followup",
      });

      setSnapshots([newSnapshot, ...snapshots]);
      setSelectedSnapshotId(newSnapshot.id);
    } catch (error) {
      console.error("Failed to create snapshot:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleSnapshotUpdate = () => {
    loadSnapshots();
  };

  const handleSnapshotDelete = () => {
    setSelectedSnapshotId(null);
    loadSnapshots();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId);
  const selectedIndex = snapshots.findIndex((s) => s.id === selectedSnapshotId);
  const previousSnapshot = selectedIndex < snapshots.length - 1 ? snapshots[selectedIndex + 1] : null;
  const change = selectedSnapshot ? calculateChange(selectedSnapshot, previousSnapshot) : null;

  return (
    <div className={styles.container}>
      {/* 상단: 타임라인 + 새 기록 버튼 */}
      <div className={styles.header}>
        <div className={styles.timeline}>
          {snapshots.length === 0 ? (
            <div className={styles.emptyTimeline}>
              <span>아직 기록이 없습니다</span>
            </div>
          ) : (
            <div className={styles.timelineTrack}>
              {snapshots.slice(0, 6).map((snapshot, index) => (
                <button
                  key={snapshot.id}
                  className={`${styles.timelineItem} ${
                    selectedSnapshotId === snapshot.id ? styles.active : ""
                  }`}
                  onClick={() => setSelectedSnapshotId(snapshot.id)}
                >
                  <div className={styles.timelineDot} />
                  <span className={styles.timelineDate}>
                    {formatShortDate(snapshot.recorded_at)}
                  </span>
                  {index === 0 && <span className={styles.latestBadge}>최신</span>}
                </button>
              ))}
              {snapshots.length > 6 && (
                <div className={styles.moreIndicator}>
                  +{snapshots.length - 6}개
                </div>
              )}
            </div>
          )}
        </div>
        <button
          className={styles.addButton}
          onClick={handleCreateSnapshot}
          disabled={creating}
        >
          <Plus size={16} />
          <span>{creating ? "생성 중..." : "새 기록"}</span>
        </button>
      </div>

      {/* 선택된 스냅샷 요약 카드 */}
      {selectedSnapshot && (
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <div className={styles.cardLabel}>순자산</div>
            <div className={styles.cardValue}>
              {formatMoney(selectedSnapshot.net_worth)}
            </div>
            {change && change.netWorthChange !== 0 && (
              <div
                className={`${styles.cardChange} ${
                  change.netWorthChange > 0 ? styles.positive : styles.negative
                }`}
              >
                {change.netWorthChange > 0 ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
                <span>
                  {change.netWorthChange > 0 ? "+" : ""}
                  {formatMoney(change.netWorthChange)}
                </span>
              </div>
            )}
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.cardLabel}>저축</div>
            <div className={styles.cardValue}>
              {formatMoney(selectedSnapshot.savings)}
            </div>
            {change && change.savingsChange !== 0 && (
              <div
                className={`${styles.cardChange} ${
                  change.savingsChange > 0 ? styles.positive : styles.negative
                }`}
              >
                {change.savingsChange > 0 ? "+" : ""}
                {formatMoney(change.savingsChange)}
              </div>
            )}
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.cardLabel}>투자</div>
            <div className={styles.cardValue}>
              {formatMoney(selectedSnapshot.investments)}
            </div>
            {change && change.investmentsChange !== 0 && (
              <div
                className={`${styles.cardChange} ${
                  change.investmentsChange > 0 ? styles.positive : styles.negative
                }`}
              >
                {change.investmentsChange > 0 ? "+" : ""}
                {formatMoney(change.investmentsChange)}
              </div>
            )}
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.cardLabel}>실물자산</div>
            <div className={styles.cardValue}>
              {formatMoney(selectedSnapshot.real_assets)}
            </div>
            {change && change.realAssetsChange !== 0 && (
              <div
                className={`${styles.cardChange} ${
                  change.realAssetsChange > 0 ? styles.positive : styles.negative
                }`}
              >
                {change.realAssetsChange > 0 ? "+" : ""}
                {formatMoney(change.realAssetsChange)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 선택된 스냅샷 상세 */}
      {selectedSnapshotId ? (
        <SnapshotDetail
          snapshotId={selectedSnapshotId}
          userId={userId}
          onUpdate={handleSnapshotUpdate}
          onDelete={handleSnapshotDelete}
        />
      ) : (
        <div className={styles.emptyState}>
          <Calendar size={48} strokeWidth={1} />
          <h3>자산 기록을 시작하세요</h3>
          <p>고객의 자산, 부채, 수입, 지출을 기록하고 변화를 추적합니다.</p>
          <button className={styles.startButton} onClick={handleCreateSnapshot}>
            <Plus size={16} />
            첫 기록 만들기
          </button>
        </div>
      )}
    </div>
  );
}
