"use client";

import { useState, useCallback } from "react";
import {
  List,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  PiggyBank,
  TrendingUp,
  Landmark,
  CreditCard,
} from "lucide-react";
import type { CashFlowPriority, CashFlowTargetType, CashFlowStrategy } from "@/types";
import styles from "./CashFlowPrioritiesPanel.module.css";

interface CashFlowPrioritiesPanelProps {
  priorities: CashFlowPriority[];
  onChange: (priorities: CashFlowPriority[]) => void;
  isLoading?: boolean;
}

// 대상 유형 설정
const TARGET_TYPES: {
  value: CashFlowTargetType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "savings", label: "저축/예금", icon: <PiggyBank size={16} /> },
  { value: "investment", label: "투자", icon: <TrendingUp size={16} /> },
  { value: "pension", label: "연금", icon: <Landmark size={16} /> },
  { value: "debt", label: "부채 상환", icon: <CreditCard size={16} /> },
];

// 전략 설정
const STRATEGIES: {
  value: CashFlowStrategy;
  label: string;
  description: string;
}[] = [
  { value: "maintain", label: "목표 유지", description: "목표 잔액에 도달할 때까지만 할당" },
  { value: "maximize", label: "최대 한도", description: "연간 최대 한도까지 할당" },
  { value: "remainder", label: "나머지", description: "남은 잉여금 전액 할당" },
];

function generateId(): string {
  return `cfp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function CashFlowPrioritiesPanel({
  priorities,
  onChange,
  isLoading = false,
}: CashFlowPrioritiesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // 새 규칙 추가
  const handleAddRule = useCallback(() => {
    const newRule: CashFlowPriority = {
      id: generateId(),
      targetType: "savings",
      strategy: "maximize",
      maxAmount: 1200, // 연간 1200만원 (월 100만원)
      priority: priorities.length + 1,
    };
    onChange([...priorities, newRule]);
    setEditingId(newRule.id);
  }, [priorities, onChange]);

  // 규칙 삭제
  const handleDeleteRule = useCallback(
    (id: string) => {
      const filtered = priorities.filter((p) => p.id !== id);
      // 우선순위 재정렬
      const reordered = filtered.map((p, index) => ({
        ...p,
        priority: index + 1,
      }));
      onChange(reordered);
    },
    [priorities, onChange]
  );

  // 규칙 수정
  const handleUpdateRule = useCallback(
    (id: string, updates: Partial<CashFlowPriority>) => {
      const updated = priorities.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      );
      onChange(updated);
    },
    [priorities, onChange]
  );

  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  // 드래그 오버
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // 드롭
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = priorities.findIndex((p) => p.id === draggedId);
    const targetIndex = priorities.findIndex((p) => p.id === targetId);

    const newPriorities = [...priorities];
    const [removed] = newPriorities.splice(draggedIndex, 1);
    newPriorities.splice(targetIndex, 0, removed);

    // 우선순위 재정렬
    const reordered = newPriorities.map((p, index) => ({
      ...p,
      priority: index + 1,
    }));

    onChange(reordered);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const getTargetIcon = (type: CashFlowTargetType) => {
    return TARGET_TYPES.find((t) => t.value === type)?.icon || null;
  };

  const getTargetLabel = (type: CashFlowTargetType) => {
    return TARGET_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getStrategyLabel = (strategy: CashFlowStrategy) => {
    return STRATEGIES.find((s) => s.value === strategy)?.label || strategy;
  };

  return (
    <div className={styles.panel}>
      <button
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className={styles.headerLeft}>
          <List size={18} />
          <span className={styles.headerTitle}>현금흐름 우선순위</span>
          <span className={styles.countBadge}>{priorities.length}개 규칙</span>
        </div>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {isExpanded && (
        <div className={styles.content}>
          <p className={styles.description}>
            연간 잉여금(소득 - 지출)을 어디에 먼저 배분할지 우선순위를 설정합니다.
            위에서부터 순서대로 적용됩니다.
          </p>

          {priorities.length === 0 ? (
            <div className={styles.emptyState}>
              <p>설정된 규칙이 없습니다</p>
              <p className={styles.emptyHint}>
                규칙을 추가하지 않으면 모든 잉여금이 금융자산으로 누적됩니다
              </p>
            </div>
          ) : (
            <div className={styles.ruleList}>
              {priorities
                .sort((a, b) => a.priority - b.priority)
                .map((rule) => (
                  <div
                    key={rule.id}
                    className={`${styles.ruleItem} ${
                      draggedId === rule.id ? styles.dragging : ""
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, rule.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, rule.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className={styles.dragHandle}>
                      <GripVertical size={16} />
                    </div>

                    <div className={styles.priorityBadge}>{rule.priority}</div>

                    <div className={styles.ruleContent}>
                      {editingId === rule.id ? (
                        // 편집 모드
                        <div className={styles.editForm}>
                          <div className={styles.formRow}>
                            <label>대상</label>
                            <select
                              value={rule.targetType}
                              onChange={(e) =>
                                handleUpdateRule(rule.id, {
                                  targetType: e.target.value as CashFlowTargetType,
                                })
                              }
                              disabled={isLoading}
                            >
                              {TARGET_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className={styles.formRow}>
                            <label>전략</label>
                            <select
                              value={rule.strategy}
                              onChange={(e) =>
                                handleUpdateRule(rule.id, {
                                  strategy: e.target.value as CashFlowStrategy,
                                })
                              }
                              disabled={isLoading}
                            >
                              {STRATEGIES.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {rule.strategy === "maintain" && (
                            <div className={styles.formRow}>
                              <label>목표 잔액</label>
                              <div className={styles.inputWithUnit}>
                                <input
                                  type="number"
                                  value={rule.targetAmount || ""}
                                  onChange={(e) =>
                                    handleUpdateRule(rule.id, {
                                      targetAmount: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  disabled={isLoading}
                                />
                                <span>만원</span>
                              </div>
                            </div>
                          )}

                          {rule.strategy === "maximize" && (
                            <div className={styles.formRow}>
                              <label>연간 최대</label>
                              <div className={styles.inputWithUnit}>
                                <input
                                  type="number"
                                  value={rule.maxAmount || ""}
                                  onChange={(e) =>
                                    handleUpdateRule(rule.id, {
                                      maxAmount: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  disabled={isLoading}
                                />
                                <span>만원/년</span>
                              </div>
                            </div>
                          )}

                          <button
                            className={styles.doneButton}
                            onClick={() => setEditingId(null)}
                            type="button"
                          >
                            완료
                          </button>
                        </div>
                      ) : (
                        // 보기 모드
                        <div
                          className={styles.ruleDisplay}
                          onClick={() => setEditingId(rule.id)}
                        >
                          <div className={styles.ruleIcon}>
                            {getTargetIcon(rule.targetType)}
                          </div>
                          <div className={styles.ruleInfo}>
                            <span className={styles.ruleTarget}>
                              {getTargetLabel(rule.targetType)}
                            </span>
                            <span className={styles.ruleStrategy}>
                              {getStrategyLabel(rule.strategy)}
                              {rule.strategy === "maintain" && rule.targetAmount && (
                                <> - {rule.targetAmount.toLocaleString()}만원</>
                              )}
                              {rule.strategy === "maximize" && rule.maxAmount && (
                                <> - 연 {rule.maxAmount.toLocaleString()}만원</>
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDeleteRule(rule.id)}
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

          <button
            className={styles.addButton}
            onClick={handleAddRule}
            disabled={isLoading}
            type="button"
          >
            <Plus size={16} />
            규칙 추가
          </button>
        </div>
      )}
    </div>
  );
}
