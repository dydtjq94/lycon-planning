"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { List, Plus, Trash2, GripVertical } from "lucide-react";
import type {
  CashFlowPriorities,
  CashFlowAccountCategory,
  SurplusAllocationRule,
  WithdrawalOrderRule,
} from "@/types";
import { useSimulationV2Data } from "@/hooks/useFinancialData";
import styles from "./CashFlowPrioritiesPanel.module.css";

interface CashFlowPrioritiesPanelProps {
  priorities: CashFlowPriorities;
  onChange: (priorities: CashFlowPriorities) => void;
  simulationId: string;
  isLoading?: boolean;
}

interface AvailableAccount {
  id: string;
  name: string;
  category: CashFlowAccountCategory;
}

function generateId(): string {
  return `cfp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function CashFlowPrioritiesPanel({
  priorities,
  onChange,
  simulationId,
  isLoading: externalLoading = false,
}: CashFlowPrioritiesPanelProps) {
  const { data: v2Data, isLoading: dataLoading } =
    useSimulationV2Data(simulationId);
  const isLoading = externalLoading || dataLoading;

  // Adding state: which section is currently adding
  const [addingSurplus, setAddingSurplus] = useState(false);
  const [addingWithdrawal, setAddingWithdrawal] = useState(false);

  // Drag state per section
  const [draggedSurplusId, setDraggedSurplusId] = useState<string | null>(null);
  const [draggedWithdrawalId, setDraggedWithdrawalId] = useState<string | null>(
    null
  );

  // Initial load skeleton
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  useEffect(() => {
    if (isInitialLoad && !dataLoading) {
      setIsInitialLoad(false);
    }
  }, [dataLoading, isInitialLoad]);

  // Build available accounts from simulation data
  const availableAccounts = useMemo<AvailableAccount[]>(() => {
    if (!v2Data) return [];
    const accounts: AvailableAccount[] = [];

    for (const s of v2Data.savings) {
      if (!s.is_active) continue;
      const ownerLabel =
        s.owner === "spouse"
          ? " (배우자)"
          : s.owner === "self"
            ? " (본인)"
            : "";
      accounts.push({
        id: s.id,
        name: `${s.title}${ownerLabel}`,
        category: "savings",
      });
    }
    for (const p of v2Data.personalPensions) {
      if (!p.is_active) continue;
      const label =
        p.title ||
        (p.pension_type === "irp"
          ? "IRP"
          : p.pension_type === "isa"
            ? "ISA"
            : "연금저축");
      const ownerLabel =
        p.owner === "spouse"
          ? " (배우자)"
          : p.owner === "self"
            ? " (본인)"
            : "";
      accounts.push({
        id: p.id,
        name: `${label}${ownerLabel}`,
        category: "pension",
      });
    }
    for (const p of v2Data.retirementPensions) {
      if (!p.is_active) continue;
      const label = p.title || "퇴직연금";
      const ownerLabel =
        p.owner === "spouse"
          ? " (배우자)"
          : p.owner === "self"
            ? " (본인)"
            : "";
      accounts.push({
        id: p.id,
        name: `${label}${ownerLabel}`,
        category: "pension",
      });
    }
    for (const d of v2Data.debts) {
      if (!d.is_active) continue;
      accounts.push({ id: d.id, name: d.title, category: "debt" });
    }

    return accounts;
  }, [v2Data]);

  // Filter out already-used accounts for each section
  const availableSurplusAccounts = useMemo(() => {
    const usedIds = new Set(
      priorities.surplusRules.map((r) => r.targetId)
    );
    return availableAccounts.filter((a) => !usedIds.has(a.id));
  }, [availableAccounts, priorities.surplusRules]);

  const availableWithdrawalAccounts = useMemo(() => {
    const usedIds = new Set(
      priorities.withdrawalRules.map((r) => r.targetId)
    );
    return availableAccounts.filter((a) => !usedIds.has(a.id));
  }, [availableAccounts, priorities.withdrawalRules]);

  // ======== Surplus Rule Handlers ========

  const handleAddSurplusRule = useCallback(
    (accountId: string) => {
      const account = availableAccounts.find((a) => a.id === accountId);
      if (!account) return;

      const newRule: SurplusAllocationRule = {
        id: generateId(),
        targetId: account.id,
        targetCategory: account.category,
        targetName: account.name,
        priority: priorities.surplusRules.length + 1,
      };

      onChange({
        ...priorities,
        surplusRules: [...priorities.surplusRules, newRule],
      });
      setAddingSurplus(false);
    },
    [availableAccounts, priorities, onChange]
  );

  const handleDeleteSurplusRule = useCallback(
    (id: string) => {
      const filtered = priorities.surplusRules.filter((r) => r.id !== id);
      const reordered = filtered.map((r, i) => ({ ...r, priority: i + 1 }));
      onChange({ ...priorities, surplusRules: reordered });
    },
    [priorities, onChange]
  );

  const handleUpdateSurplusLimit = useCallback(
    (id: string, value: string) => {
      const numericValue = value === "" ? undefined : parseInt(value) || 0;
      const updated = priorities.surplusRules.map((r) =>
        r.id === id ? { ...r, annualLimit: numericValue } : r
      );
      onChange({ ...priorities, surplusRules: updated });
    },
    [priorities, onChange]
  );

  // Surplus drag handlers
  const handleSurplusDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSurplusId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleSurplusDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleSurplusDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedSurplusId || draggedSurplusId === targetId) return;

    const list = [...priorities.surplusRules];
    const draggedIdx = list.findIndex((r) => r.id === draggedSurplusId);
    const targetIdx = list.findIndex((r) => r.id === targetId);
    const [removed] = list.splice(draggedIdx, 1);
    list.splice(targetIdx, 0, removed);

    const reordered = list.map((r, i) => ({ ...r, priority: i + 1 }));
    onChange({ ...priorities, surplusRules: reordered });
    setDraggedSurplusId(null);
  };

  const handleSurplusDragEnd = () => {
    setDraggedSurplusId(null);
  };

  // ======== Withdrawal Rule Handlers ========

  const handleAddWithdrawalRule = useCallback(
    (accountId: string) => {
      const account = availableAccounts.find((a) => a.id === accountId);
      if (!account) return;

      const newRule: WithdrawalOrderRule = {
        id: generateId(),
        targetId: account.id,
        targetCategory: account.category,
        targetName: account.name,
        priority: priorities.withdrawalRules.length + 1,
      };

      onChange({
        ...priorities,
        withdrawalRules: [...priorities.withdrawalRules, newRule],
      });
      setAddingWithdrawal(false);
    },
    [availableAccounts, priorities, onChange]
  );

  const handleDeleteWithdrawalRule = useCallback(
    (id: string) => {
      const filtered = priorities.withdrawalRules.filter((r) => r.id !== id);
      const reordered = filtered.map((r, i) => ({ ...r, priority: i + 1 }));
      onChange({ ...priorities, withdrawalRules: reordered });
    },
    [priorities, onChange]
  );

  // Withdrawal drag handlers
  const handleWithdrawalDragStart = (e: React.DragEvent, id: string) => {
    setDraggedWithdrawalId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleWithdrawalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleWithdrawalDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedWithdrawalId || draggedWithdrawalId === targetId) return;

    const list = [...priorities.withdrawalRules];
    const draggedIdx = list.findIndex((r) => r.id === draggedWithdrawalId);
    const targetIdx = list.findIndex((r) => r.id === targetId);
    const [removed] = list.splice(draggedIdx, 1);
    list.splice(targetIdx, 0, removed);

    const reordered = list.map((r, i) => ({ ...r, priority: i + 1 }));
    onChange({ ...priorities, withdrawalRules: reordered });
    setDraggedWithdrawalId(null);
  };

  const handleWithdrawalDragEnd = () => {
    setDraggedWithdrawalId(null);
  };

  // ======== Skeleton loading ========
  if (dataLoading && isInitialLoad) {
    return (
      <div className={styles.panel}>
        <div className={styles.skeletonHeader}>
          <div className={styles.skeletonHeaderLeft}>
            <div className={`${styles.skeleton} ${styles.skeletonIcon}`} />
            <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          </div>
        </div>
        <div className={styles.skeletonContent}>
          <div className={`${styles.skeleton} ${styles.skeletonDesc}`} />
          <div className={styles.skeletonRuleList}>
            {[1, 2].map((i) => (
              <div key={i} className={styles.skeletonRuleItem}>
                <div
                  className={`${styles.skeleton} ${styles.skeletonDragHandle}`}
                />
                <div
                  className={`${styles.skeleton} ${styles.skeletonPriorityBadge}`}
                />
                <div className={styles.skeletonRuleContent}>
                  <div className={styles.skeletonRuleInfo}>
                    <div
                      className={`${styles.skeleton} ${styles.skeletonRuleTarget}`}
                    />
                    <div
                      className={`${styles.skeleton} ${styles.skeletonRuleStrategy}`}
                    />
                  </div>
                </div>
                <div
                  className={`${styles.skeleton} ${styles.skeletonDeleteBtn}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <List size={18} />
          <span className={styles.headerTitle}>현금흐름 우선순위</span>
        </div>
      </div>

      {/* Section 1: Surplus Allocation */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>잉여금 배분 순서</h3>
        <p className={styles.sectionDescription}>
          연간 잉여금을 아래 순서대로 배분합니다.
        </p>

        {priorities.surplusRules.length > 0 && (
          <div className={styles.ruleList}>
            {priorities.surplusRules
              .sort((a, b) => a.priority - b.priority)
              .map((rule) => (
                <div
                  key={rule.id}
                  className={`${styles.ruleRow} ${
                    draggedSurplusId === rule.id ? styles.dragging : ""
                  }`}
                  draggable
                  onDragStart={(e) => handleSurplusDragStart(e, rule.id)}
                  onDragOver={handleSurplusDragOver}
                  onDrop={(e) => handleSurplusDrop(e, rule.id)}
                  onDragEnd={handleSurplusDragEnd}
                >
                  <div className={styles.dragHandle}>
                    <GripVertical size={16} />
                  </div>
                  <div className={styles.priorityBadge}>{rule.priority}</div>
                  <div className={styles.ruleName}>{rule.targetName}</div>
                  <div className={styles.limitArea}>
                    {rule.annualLimit !== undefined ? (
                      <div className={styles.limitInputWrap}>
                        <span className={styles.limitUnit}>연</span>
                        <input
                          type="number"
                          className={styles.limitInput}
                          value={rule.annualLimit}
                          onChange={(e) =>
                            handleUpdateSurplusLimit(rule.id, e.target.value)
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          disabled={isLoading}
                        />
                        <span className={styles.limitUnit}>만원</span>
                      </div>
                    ) : (
                      <span className={styles.remainderBadge}>나머지</span>
                    )}
                    <button
                      className={styles.toggleLimitButton}
                      onClick={() =>
                        handleUpdateSurplusLimit(
                          rule.id,
                          rule.annualLimit !== undefined ? "" : "0"
                        )
                      }
                      type="button"
                      title={
                        rule.annualLimit !== undefined
                          ? "나머지로 변경"
                          : "한도 설정"
                      }
                      disabled={isLoading}
                    >
                      {rule.annualLimit !== undefined ? "나머지" : "한도"}
                    </button>
                  </div>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDeleteSurplusRule(rule.id)}
                    disabled={isLoading}
                    type="button"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
        )}

        {priorities.surplusRules.length === 0 && !addingSurplus && (
          <div className={styles.emptyState}>
            <p>설정된 규칙이 없습니다</p>
            <p className={styles.emptyHint}>
              규칙을 추가하지 않으면 잉여금이 현금으로 누적됩니다
            </p>
          </div>
        )}

        {addingSurplus ? (
          <div className={styles.addRow}>
            <select
              className={styles.accountSelect}
              onChange={(e) => {
                if (e.target.value) handleAddSurplusRule(e.target.value);
              }}
              defaultValue=""
              autoFocus
              disabled={isLoading}
            >
              <option value="" disabled>
                계좌 선택...
              </option>
              {availableSurplusAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              className={styles.cancelButton}
              onClick={() => setAddingSurplus(false)}
              type="button"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            className={styles.addButton}
            onClick={() => setAddingSurplus(true)}
            disabled={isLoading || availableSurplusAccounts.length === 0}
            type="button"
          >
            <Plus size={16} />
            추가
          </button>
        )}
      </div>

      <div className={styles.sectionDivider} />

      {/* Section 2: Withdrawal Order */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>부족시 인출 순서</h3>
        <p className={styles.sectionDescription}>
          현금이 부족할 때 아래 순서대로 인출합니다.
        </p>

        {priorities.withdrawalRules.length > 0 && (
          <div className={styles.ruleList}>
            {priorities.withdrawalRules
              .sort((a, b) => a.priority - b.priority)
              .map((rule) => (
                <div
                  key={rule.id}
                  className={`${styles.ruleRow} ${
                    draggedWithdrawalId === rule.id ? styles.dragging : ""
                  }`}
                  draggable
                  onDragStart={(e) => handleWithdrawalDragStart(e, rule.id)}
                  onDragOver={handleWithdrawalDragOver}
                  onDrop={(e) => handleWithdrawalDrop(e, rule.id)}
                  onDragEnd={handleWithdrawalDragEnd}
                >
                  <div className={styles.dragHandle}>
                    <GripVertical size={16} />
                  </div>
                  <div className={styles.priorityBadge}>{rule.priority}</div>
                  <div className={styles.ruleName}>{rule.targetName}</div>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDeleteWithdrawalRule(rule.id)}
                    disabled={isLoading}
                    type="button"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
        )}

        {priorities.withdrawalRules.length === 0 && !addingWithdrawal && (
          <div className={styles.emptyState}>
            <p>설정된 규칙이 없습니다</p>
            <p className={styles.emptyHint}>
              규칙을 추가하지 않으면 기본 순서로 인출됩니다
            </p>
          </div>
        )}

        {addingWithdrawal ? (
          <div className={styles.addRow}>
            <select
              className={styles.accountSelect}
              onChange={(e) => {
                if (e.target.value) handleAddWithdrawalRule(e.target.value);
              }}
              defaultValue=""
              autoFocus
              disabled={isLoading}
            >
              <option value="" disabled>
                계좌 선택...
              </option>
              {availableWithdrawalAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              className={styles.cancelButton}
              onClick={() => setAddingWithdrawal(false)}
              type="button"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            className={styles.addButton}
            onClick={() => setAddingWithdrawal(true)}
            disabled={isLoading || availableWithdrawalAccounts.length === 0}
            type="button"
          >
            <Plus size={16} />
            추가
          </button>
        )}
      </div>
    </div>
  );
}
