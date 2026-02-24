"use client";

import { calculateAge, formatMoney } from "@/lib/utils";
import type { StepProps } from "./types";
import styles from "./StepExpense.module.css";

interface StepExpenseProps extends StepProps {
  profileBirthDate: string | null;
}

export function StepExpense({ data, onChange, profileBirthDate }: StepExpenseProps) {
  const { expense } = data;

  const updateExpense = (updates: Partial<typeof expense>) => {
    onChange({ expense: { ...expense, ...updates } });
  };

  // Preview calculation
  const livingExpense = expense.livingExpense;
  const postRetirementRate = expense.postRetirementRate;
  const retirementAge = data.retirement.retirementAge;

  let yearsToRetirement = 0;
  let currentAge = 0;
  if (profileBirthDate) {
    currentAge = calculateAge(profileBirthDate);
    yearsToRetirement = Math.max(0, (retirementAge ?? 65) - currentAge);
  }

  const showPreview = livingExpense !== null && livingExpense > 0;
  const inflationRate = 0.025;
  const preRetirementExpense = showPreview
    ? Math.round(livingExpense * Math.pow(1 + inflationRate, yearsToRetirement))
    : 0;
  const postRetirementExpense = showPreview
    ? Math.round(preRetirementExpense * postRetirementRate)
    : 0;

  return (
    <div className={styles.root}>
      <section className={styles.section}>
        <span className={styles.sectionLabel}>생활비</span>
        <div className={styles.amountWrapper}>
          <input
            type="number"
            className={styles.amountInput}
            value={expense.livingExpense ?? ""}
            placeholder="0"
            onChange={(e) => {
              const raw = e.target.value;
              updateExpense({ livingExpense: raw === "" ? null : parseInt(raw, 10) });
            }}
            onWheel={(e) => (e.target as HTMLElement).blur()}
          />
          <span className={styles.unit}>만원/월</span>
        </div>
      </section>

      <section className={styles.section}>
        <span className={styles.sectionLabel}>고정비</span>
        <div className={styles.amountWrapper}>
          <input
            type="number"
            className={styles.amountInput}
            value={expense.fixedExpense ?? ""}
            placeholder="0"
            onChange={(e) => {
              const raw = e.target.value;
              updateExpense({ fixedExpense: raw === "" ? null : parseInt(raw, 10) });
            }}
            onWheel={(e) => (e.target as HTMLElement).blur()}
          />
          <span className={styles.unit}>만원/월</span>
        </div>
      </section>

      <hr className={styles.divider} />

      <section className={styles.rateSection}>
        <span className={styles.sectionLabel}>은퇴 후 생활비</span>
        <div className={styles.rateRow}>
          <input
            type="number"
            className={styles.rateInput}
            value={Math.round(postRetirementRate * 100)}
            min={50}
            max={100}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return;
              const pct = Math.min(100, Math.max(50, parseInt(raw, 10)));
              updateExpense({ postRetirementRate: pct / 100 });
            }}
            onWheel={(e) => (e.target as HTMLElement).blur()}
          />
          <span className={styles.percent}>%</span>
        </div>

        {showPreview && (
          <div className={styles.previewGrid}>
            {yearsToRetirement <= 0 ? (
              <span className={styles.previewHint}>이미 은퇴 나이 도달</span>
            ) : (
              <>
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>은퇴 전 예상</span>
                  <span className={styles.previewValue}>약 {formatMoney(preRetirementExpense)}/월</span>
                </div>
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>은퇴 후 예상</span>
                  <span className={styles.previewValue}>약 {formatMoney(postRetirementExpense)}/월</span>
                </div>
                <span className={styles.previewHint}>(물가 2.5% 반영, {yearsToRetirement}년 후 기준)</span>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
