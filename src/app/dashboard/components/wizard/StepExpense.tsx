"use client";

import { X, Plus } from "lucide-react";
import type { StepProps, WizardData } from "./types";
import styles from "./StepExpense.module.css";

type FixedExpenseItem = WizardData["expense"]["fixedExpenses"][number];

const LIVING_CATEGORIES: { key: keyof WizardData["expense"]["livingExpenseDetails"]; label: string }[] = [
  { key: "food", label: "식비" },
  { key: "transport", label: "교통비" },
  { key: "shopping", label: "쇼핑/미용" },
  { key: "leisure", label: "여가/유흥" },
];

export function StepExpense({ data, onChange }: StepProps) {
  const { expense } = data;

  const updateExpense = (updates: Partial<typeof expense>) => {
    onChange({ expense: { ...expense, ...updates } });
  };

  const handleDetailChange = (key: keyof typeof expense.livingExpenseDetails, value: number | null) => {
    const updated = { ...expense.livingExpenseDetails, [key]: value };
    const total = (updated.food || 0) + (updated.transport || 0) + (updated.shopping || 0) + (updated.leisure || 0);
    updateExpense({
      livingExpenseDetails: updated,
      livingExpense: total > 0 ? total : null,
    });
  };

  const handleAddFixed = () => {
    updateExpense({
      fixedExpenses: [
        ...expense.fixedExpenses,
        { title: "", type: "other", amount: null, frequency: "monthly" },
      ],
    });
  };

  const handleRemoveFixed = (index: number) => {
    updateExpense({
      fixedExpenses: expense.fixedExpenses.filter((_, i) => i !== index),
    });
  };

  const handleFixedChange = (index: number, updates: Partial<FixedExpenseItem>) => {
    updateExpense({
      fixedExpenses: expense.fixedExpenses.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      ),
    });
  };

  return (
    <div className={styles.root}>
      {/* 생활비 섹션 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>생활비</span>
          {expense.livingExpense != null && expense.livingExpense > 0 && (
            <span className={styles.totalBadge}>
              합계 {expense.livingExpense}만원/월
            </span>
          )}
        </div>

        <div className={styles.detailGrid}>
          {LIVING_CATEGORIES.map((cat) => (
            <div key={cat.key} className={styles.detailRow}>
              <label className={styles.detailLabel}>{cat.label}</label>
              <div className={styles.amountWrapper}>
                <input
                  type="number"
                  className={styles.amountInput}
                  value={expense.livingExpenseDetails[cat.key] ?? ""}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value;
                    handleDetailChange(cat.key, raw === "" ? null : parseInt(raw, 10));
                  }}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원/월</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 고정비 섹션 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>고정비</span>
          {expense.fixedExpenses.length > 0 && (
            <span className={styles.countBadge}>{expense.fixedExpenses.length}건</span>
          )}
        </div>

        {expense.fixedExpenses.length === 0 ? (
          <p className={styles.emptyText}>등록된 고정비가 없습니다</p>
        ) : (
          <div className={styles.list}>
            {expense.fixedExpenses.map((item, index) => (
              <div key={index} className={styles.fixedRow}>
                <input
                  type="text"
                  className={styles.titleInput}
                  value={item.title}
                  onChange={(e) => handleFixedChange(index, { title: e.target.value })}
                  placeholder="항목명 (예: 통신비, 보험료)"
                />

                <div className={styles.amountWrapper}>
                  <input
                    type="number"
                    className={styles.amountInputSmall}
                    value={item.amount ?? ""}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = e.target.value;
                      handleFixedChange(index, { amount: raw === "" ? null : parseInt(raw, 10) });
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원</span>
                </div>

                <div className={styles.pillGroup}>
                  <button
                    type="button"
                    className={`${styles.pillSmall} ${item.frequency === "monthly" ? styles.pillSmallActive : ""}`}
                    onClick={() => handleFixedChange(index, { frequency: "monthly" })}
                  >
                    월
                  </button>
                  <button
                    type="button"
                    className={`${styles.pillSmall} ${item.frequency === "yearly" ? styles.pillSmallActive : ""}`}
                    onClick={() => handleFixedChange(index, { frequency: "yearly" })}
                  >
                    년
                  </button>
                </div>

                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleRemoveFixed(index)}
                  aria-label="고정비 삭제"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button type="button" className={styles.addBtn} onClick={handleAddFixed}>
          <Plus size={14} />
          고정비 추가
        </button>
      </section>
    </div>
  );
}
