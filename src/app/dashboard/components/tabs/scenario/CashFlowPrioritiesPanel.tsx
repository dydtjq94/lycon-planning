"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Plus, Trash2, GripVertical, Pin } from "lucide-react";
import type {
  CashFlowPriorities,
  CashFlowAccountCategory,
  SurplusAllocationRule,
  SurplusAllocationMode,
  WithdrawalOrderRule,
} from "@/types";
import { useSimulationV2Data } from "@/hooks/useFinancialData";
import { formatPeriodDisplay, toPeriodRaw, restorePeriodCursor } from "@/lib/utils/periodInput";
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

  // Local state for priorities
  const [localPriorities, setLocalPriorities] = useState<CashFlowPriorities>(priorities);

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);

  // Sync local state when props change
  useEffect(() => {
    setLocalPriorities(priorities);
    setIsDirty(false);
  }, [priorities]);

  // Tab state
  const [activeTab, setActiveTab] = useState<"surplus" | "withdrawal">("surplus");

  // Adding state: which section is currently adding
  const [addingSurplus, setAddingSurplus] = useState(false);
  const [addingWithdrawal, setAddingWithdrawal] = useState(false);

  // Drag state per section
  const [draggedSurplusId, setDraggedSurplusId] = useState<string | null>(null);
  const [draggedWithdrawalId, setDraggedWithdrawalId] = useState<string | null>(
    null
  );

  // 기간 입력 텍스트 상태 (rule.id → raw string like "202601")
  const [periodTexts, setPeriodTexts] = useState<Record<string, { start: string; end: string }>>({});

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

  // 인출 규칙 자동 생성 방지 (사용자가 직접 전부 삭제한 경우 재생성 안 함)
  const hasPopulatedWithdrawals = useRef(false);

  // 초기화: 기본 인출 순서 자동 생성
  useEffect(() => {
    if (dataLoading || !v2Data) return;

    // 이미 인출 규칙이 있으면 자동 생성 건너뛰기
    if (localPriorities.withdrawalRules.length > 0) {
      hasPopulatedWithdrawals.current = true;
      if (!localPriorities._initialized) {
        onChange({ ...localPriorities, _initialized: true });
      }
      return;
    }

    // 이번 세션에서 이미 자동 생성했으면 재생성 방지 (사용자가 전부 삭제한 경우)
    if (hasPopulatedWithdrawals.current) return;
    hasPopulatedWithdrawals.current = true;

    const savingsTypeOrder: string[] = [
      'checking', 'savings', 'deposit', 'housing',
      'domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other',
    ];

    const defaultRules: WithdrawalOrderRule[] = [];

    // 저축 계좌 - 타입 순서대로
    const activeSavings = v2Data.savings
      .filter((s) => s.is_active)
      .sort((a, b) => savingsTypeOrder.indexOf(a.type) - savingsTypeOrder.indexOf(b.type));

    for (const s of activeSavings) {
      const ownerLabel =
        s.owner === 'spouse' ? ' (배우자)' : s.owner === 'self' ? ' (본인)' : '';
      defaultRules.push({
        id: generateId(),
        targetId: s.id,
        targetCategory: 'savings',
        targetName: `${s.title}${ownerLabel}`,
        priority: defaultRules.length + 1,
      });
    }

    // 연금 계좌는 기본 인출 대상에서 제외 (중도 인출 불가)
    // - 퇴직연금 (DB/DC/기업IRP/퇴직금): 수령 시점 전 인출 불가
    // - 개인연금 (연금저축/IRP): 세제 패널티 있어 기본 제외
    // 사용자가 수동으로 + 추가하면 포함 가능

    onChange({
      ...localPriorities,
      surplusRules: localPriorities._initialized ? localPriorities.surplusRules : [],
      withdrawalRules: defaultRules,
      _initialized: true,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPriorities._initialized, localPriorities.withdrawalRules.length, dataLoading]);

  // 삭제된 계좌 자동 정리: 존재하지 않는 targetId를 가진 규칙 제거
  useEffect(() => {
    if (!localPriorities._initialized || availableAccounts.length === 0 || dataLoading) return;

    const validIds = new Set(availableAccounts.map(a => a.id));
    const filteredSurplus = localPriorities.surplusRules.filter(r => validIds.has(r.targetId));
    const filteredWithdrawal = localPriorities.withdrawalRules.filter(r => validIds.has(r.targetId));

    const surplusRemoved = filteredSurplus.length !== localPriorities.surplusRules.length;
    const withdrawalRemoved = filteredWithdrawal.length !== localPriorities.withdrawalRules.length;

    if (surplusRemoved || withdrawalRemoved) {
      const cleaned: CashFlowPriorities = {
        ...localPriorities,
        surplusRules: filteredSurplus.map((r, i) => ({ ...r, priority: i + 1 })),
        withdrawalRules: filteredWithdrawal.map((r, i) => ({ ...r, priority: i + 1 })),
      };
      onChange(cleaned);
    }
  }, [localPriorities._initialized, availableAccounts, dataLoading, localPriorities.surplusRules, localPriorities.withdrawalRules, onChange]);

  // Filter out already-used accounts for each section
  const availableSurplusAccounts = useMemo(() => {
    const usedIds = new Set(
      localPriorities.surplusRules.map((r) => r.targetId)
    );
    return availableAccounts.filter((a) => !usedIds.has(a.id));
  }, [availableAccounts, localPriorities.surplusRules]);

  const availableWithdrawalAccounts = useMemo(() => {
    const usedIds = new Set(
      localPriorities.withdrawalRules.map((r) => r.targetId)
    );
    return availableAccounts.filter((a) => !usedIds.has(a.id));
  }, [availableAccounts, localPriorities.withdrawalRules]);

  // Calculate total rule count
  const totalRuleCount = localPriorities.surplusRules.length + localPriorities.withdrawalRules.length;

  // Save handler
  const handleSave = () => {
    onChange(localPriorities);
    setIsDirty(false);
  };

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
        priority: localPriorities.surplusRules.length + 1,
        mode: "allocate",
      };

      setLocalPriorities({
        ...localPriorities,
        surplusRules: [...localPriorities.surplusRules, newRule],
      });
      setIsDirty(true);
      setAddingSurplus(false);
    },
    [availableAccounts, localPriorities]
  );

  const handleDeleteSurplusRule = useCallback(
    (id: string) => {
      const filtered = localPriorities.surplusRules.filter((r) => r.id !== id);
      const reordered = filtered.map((r, i) => ({ ...r, priority: i + 1 }));
      setLocalPriorities({ ...localPriorities, surplusRules: reordered });
      setIsDirty(true);
    },
    [localPriorities]
  );

  const handleUpdateSurplusRule = useCallback(
    (id: string, updates: Partial<SurplusAllocationRule>) => {
      const updated = localPriorities.surplusRules.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      );
      setLocalPriorities({ ...localPriorities, surplusRules: updated });
      setIsDirty(true);
    },
    [localPriorities]
  );

  const handleChangeSurplusMode = useCallback(
    (id: string, mode: SurplusAllocationMode) => {
      const updated = localPriorities.surplusRules.map((r) => {
        if (r.id !== id) return r;
        if (mode === "maintain_balance") {
          return { ...r, mode, annualLimit: undefined, targetBalance: r.targetBalance ?? 500 };
        }
        return { ...r, mode, targetBalance: undefined };
      });
      setLocalPriorities({ ...localPriorities, surplusRules: updated });
      setIsDirty(true);
    },
    [localPriorities]
  );

  // 기간 텍스트 헬퍼
  const getPeriodText = (ruleId: string, field: 'start' | 'end', rule: SurplusAllocationRule): string => {
    const override = periodTexts[ruleId]?.[field];
    if (override !== undefined) return override;
    const year = field === 'start' ? rule.startYear : rule.endYear;
    const month = field === 'start' ? rule.startMonth : rule.endMonth;
    if (year == null) return '';
    return toPeriodRaw(year, month ?? (field === 'start' ? 1 : 12));
  };

  const handlePeriodChange = useCallback(
    (ruleId: string, field: 'start' | 'end', e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
      restorePeriodCursor(e.target, raw);
      setPeriodTexts(prev => ({
        ...prev,
        [ruleId]: { ...prev[ruleId], [field]: raw },
      }));

      // raw가 비어있으면 해제
      if (raw === '') {
        const updates: Partial<SurplusAllocationRule> = field === 'start'
          ? { startYear: undefined, startMonth: undefined }
          : { endYear: undefined, endMonth: undefined };
        handleUpdateSurplusRule(ruleId, updates);
        return;
      }

      // 4자리 이상이면 연도 파싱
      if (raw.length >= 4) {
        const y = parseInt(raw.slice(0, 4));
        if (!isNaN(y)) {
          const updates: Partial<SurplusAllocationRule> = field === 'start'
            ? { startYear: y, startMonth: 1 }
            : { endYear: y, endMonth: 12 };
          // 5자리 이상이면 월도 파싱
          if (raw.length >= 5) {
            const m = parseInt(raw.slice(4));
            if (!isNaN(m) && m >= 1 && m <= 12) {
              if (field === 'start') updates.startMonth = m;
              else updates.endMonth = m;
            }
          }
          handleUpdateSurplusRule(ruleId, updates);
        }
      }
    },
    [handleUpdateSurplusRule]
  );

  // 기간 입력 blur 시 로컬 텍스트 정리
  const handlePeriodBlur = useCallback(
    (ruleId: string, field: 'start' | 'end') => {
      setPeriodTexts(prev => {
        const copy = { ...prev };
        if (copy[ruleId]) {
          const { [field]: _, ...rest } = copy[ruleId];
          copy[ruleId] = rest as { start: string; end: string };
        }
        return copy;
      });
    },
    []
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

    const list = [...localPriorities.surplusRules];
    const draggedIdx = list.findIndex((r) => r.id === draggedSurplusId);
    const targetIdx = list.findIndex((r) => r.id === targetId);
    const [removed] = list.splice(draggedIdx, 1);
    list.splice(targetIdx, 0, removed);

    const reordered = list.map((r, i) => ({ ...r, priority: i + 1 }));
    setLocalPriorities({ ...localPriorities, surplusRules: reordered });
    setIsDirty(true);
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
        priority: localPriorities.withdrawalRules.length + 1,
      };

      setLocalPriorities({
        ...localPriorities,
        withdrawalRules: [...localPriorities.withdrawalRules, newRule],
      });
      setIsDirty(true);
      setAddingWithdrawal(false);
    },
    [availableAccounts, localPriorities]
  );

  const handleDeleteWithdrawalRule = useCallback(
    (id: string) => {
      const filtered = localPriorities.withdrawalRules.filter((r) => r.id !== id);
      const reordered = filtered.map((r, i) => ({ ...r, priority: i + 1 }));
      setLocalPriorities({ ...localPriorities, withdrawalRules: reordered });
      setIsDirty(true);
    },
    [localPriorities]
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

    const list = [...localPriorities.withdrawalRules];
    const draggedIdx = list.findIndex((r) => r.id === draggedWithdrawalId);
    const targetIdx = list.findIndex((r) => r.id === targetId);
    const [removed] = list.splice(draggedIdx, 1);
    list.splice(targetIdx, 0, removed);

    const reordered = list.map((r, i) => ({ ...r, priority: i + 1 }));
    setLocalPriorities({ ...localPriorities, withdrawalRules: reordered });
    setIsDirty(true);
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
        <span className={styles.title}>현금흐름 우선순위</span>
        <span className={styles.count}>{totalRuleCount}개</span>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          type="button"
          disabled={isLoading || !isDirty}
        >
          저장
        </button>
      </div>

      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === "surplus" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("surplus")}
          type="button"
        >
          잉여금 배분
        </button>
        <button
          className={`${styles.tab} ${activeTab === "withdrawal" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("withdrawal")}
          type="button"
        >
          부족시 인출
        </button>
      </div>

      {activeTab === "surplus" && (
        <div className={styles.tabContent}>
          <p className={styles.sectionDescription}>
            잉여금을 마이너스 통장 상환 → 아래 순서 → 유동 현금으로 배분합니다.
          </p>

          {/* 마이너스 통장 - 항상 첫 번째 고정 */}
          <div className={styles.ruleList}>
            <div className={styles.ruleRowFixed}>
              <div className={styles.pinHandle}>
                <Pin size={14} />
              </div>
              <div className={styles.ruleName}>마이너스 통장</div>
            </div>
          </div>
          <p className={styles.fixedHint}>
            마이너스 통장이 있으면 잉여금으로 가장 먼저 상환합니다.
          </p>

          {localPriorities.surplusRules.length > 0 && (
            <div className={styles.ruleList}>
              {localPriorities.surplusRules
                .sort((a, b) => a.priority - b.priority)
                .map((rule) => {
                  const ruleMode = rule.mode || "allocate";
                  return (
                    <div
                      key={rule.id}
                      className={`${styles.ruleCard} ${
                        draggedSurplusId === rule.id ? styles.dragging : ""
                      }`}
                      draggable
                      onDragStart={(e) => handleSurplusDragStart(e, rule.id)}
                      onDragOver={handleSurplusDragOver}
                      onDrop={(e) => handleSurplusDrop(e, rule.id)}
                      onDragEnd={handleSurplusDragEnd}
                    >
                      <div className={styles.ruleCardHeader}>
                        <div className={styles.dragHandle}>
                          <GripVertical size={14} />
                        </div>
                        <div className={styles.priorityBadge}>{rule.priority}</div>
                        <div className={styles.ruleName}>{rule.targetName}</div>
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
                      <div className={styles.ruleCardBody}>
                        {/* 모드 선택 */}
                        <div className={styles.modeSelector}>
                          <button
                            className={`${styles.modeButton} ${ruleMode === "allocate" ? styles.modeActive : ""}`}
                            onClick={() => handleChangeSurplusMode(rule.id, "allocate")}
                            type="button"
                            disabled={isLoading}
                          >
                            적립
                          </button>
                          <button
                            className={`${styles.modeButton} ${ruleMode === "maintain_balance" ? styles.modeActive : ""}`}
                            onClick={() => handleChangeSurplusMode(rule.id, "maintain_balance")}
                            type="button"
                            disabled={isLoading}
                          >
                            잔액 유지
                          </button>
                        </div>

                        {/* 적립 모드 설정 */}
                        {ruleMode === "allocate" && (
                          <div className={styles.ruleSettings}>
                            <div className={styles.settingRow}>
                              <span className={styles.settingLabel}>한도</span>
                              <div className={styles.limitArea}>
                                {rule.annualLimit != null ? (
                                  <div className={styles.limitInputWrap}>
                                    <span className={styles.limitUnit}>연</span>
                                    <input
                                      type="number"
                                      className={styles.limitInput}
                                      value={rule.annualLimit}
                                      onChange={(e) =>
                                        handleUpdateSurplusRule(rule.id, {
                                          annualLimit: e.target.value === "" ? undefined : parseInt(e.target.value) || 0,
                                        })
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
                                    handleUpdateSurplusRule(rule.id, {
                                      annualLimit: rule.annualLimit != null ? undefined : 0,
                                    })
                                  }
                                  type="button"
                                  disabled={isLoading}
                                >
                                  {rule.annualLimit != null ? "나머지" : "한도"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 잔액 유지 모드 설정 */}
                        {ruleMode === "maintain_balance" && (
                          <div className={styles.ruleSettings}>
                            <div className={styles.settingRow}>
                              <span className={styles.settingLabel}>목표</span>
                              <div className={styles.limitInputWrap}>
                                <input
                                  type="number"
                                  className={styles.limitInput}
                                  value={rule.targetBalance ?? 0}
                                  onChange={(e) =>
                                    handleUpdateSurplusRule(rule.id, {
                                      targetBalance: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  disabled={isLoading}
                                />
                                <span className={styles.limitUnit}>만원</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 기간 설정 */}
                        <div className={styles.settingRow}>
                          <span className={styles.settingLabel}>기간</span>
                          <div className={styles.periodArea}>
                            <input
                              type="text"
                              className={styles.periodInput}
                              placeholder="2026.01"
                              value={formatPeriodDisplay(getPeriodText(rule.id, 'start', rule))}
                              onChange={(e) => handlePeriodChange(rule.id, 'start', e)}
                              onBlur={() => handlePeriodBlur(rule.id, 'start')}
                              disabled={isLoading}
                            />
                            <span className={styles.periodSeparator}>~</span>
                            <input
                              type="text"
                              className={styles.periodInput}
                              placeholder="2030.12"
                              value={formatPeriodDisplay(getPeriodText(rule.id, 'end', rule))}
                              onChange={(e) => handlePeriodChange(rule.id, 'end', e)}
                              onBlur={() => handlePeriodBlur(rule.id, 'end')}
                              disabled={isLoading}
                            />
                            {!rule.startYear && !rule.endYear && (
                              <span className={styles.remainderBadge}>항상</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* 유동 현금 - 항상 마지막 고정 */}
          <div className={styles.ruleList}>
            <div className={styles.ruleRowFixed}>
              <div className={styles.pinHandle}>
                <Pin size={14} />
              </div>
              <div className={styles.ruleName}>유동 현금</div>
            </div>
          </div>
          <p className={styles.fixedHint}>
            배분 규칙을 모두 채운 뒤 남은 잉여금은 유동 현금으로 보관됩니다.
          </p>

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
              <Plus size={14} />
              추가
            </button>
          )}
        </div>
      )}

      {activeTab === "withdrawal" && (
        <div className={styles.tabContent}>
          <p className={styles.sectionDescription}>
            현금이 부족할 때 유동 현금 → 아래 순서 → 마이너스 통장으로 인출합니다.
          </p>

          <div className={styles.ruleList}>
            {/* 유동 현금 - 항상 첫 번째 고정 */}
            <div className={styles.ruleRowFixed}>
              <div className={styles.pinHandle}>
                <Pin size={14} />
              </div>
              <div className={styles.ruleName}>유동 현금</div>
            </div>
          </div>
          <p className={styles.fixedHint}>
            유동 현금을 가장 먼저 사용한 뒤 아래 순서대로 인출합니다.
          </p>

          <div className={styles.ruleList}>
            {localPriorities.withdrawalRules
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
                    <GripVertical size={14} />
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
            {/* 마이너스 통장 - 항상 마지막 고정 */}
            <div className={styles.ruleRowFixed}>
              <div className={styles.pinHandle}>
                <Pin size={14} />
              </div>
              <div className={styles.ruleName}>마이너스 통장</div>
            </div>
          </div>
          <p className={styles.fixedHint}>
            모든 계좌에서 인출해도 부족하면 마이너스 통장으로 자동 충당됩니다.
          </p>

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
              <Plus size={14} />
              추가
            </button>
          )}

        </div>
      )}
    </div>
  );
}
