"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import type { HousingData } from "../types";
import { AmountInput, ToggleGroup, TypeSelect, FrequencyToggle } from "./inputs";
import styles from "./ExpenseInputForm.module.css";

// 지출 카테고리
const EXPENSE_TYPES = [
  { value: "food", label: "식비" },
  { value: "transport", label: "교통비" },
  { value: "communication", label: "통신비" },
  { value: "insurance", label: "보험료" },
  { value: "medical", label: "의료비" },
  { value: "education", label: "교육비" },
  { value: "leisure", label: "여가/문화" },
  { value: "clothing", label: "의류/미용" },
  { value: "other", label: "기타" },
] as const;

interface ExpenseItem {
  type: string;
  title: string;
  amount: number;
  frequency: "monthly" | "yearly";
}

export interface ExpenseFormData {
  livingExpense: number; // 기본 생활비 (월)
  hasAdditionalExpense: boolean;
  additionalExpenses: ExpenseItem[];
}

interface ExpenseInputFormProps {
  housingData: HousingData | null;
  initialData?: ExpenseFormData | null;
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: ExpenseFormData) => Promise<void>;
  surveyMonthlyExpense?: string;
}

// 온보딩 응답 레이블
const EXPENSE_RANGE_LABELS: Record<string, string> = {
  under_150: "150만원 이하",
  "150_250": "150~250만원",
  "250_400": "250~400만원",
  "400_600": "400~600만원",
  over_600: "600만원 초과",
};

export function ExpenseInputForm({
  housingData,
  initialData,
  isCompleted,
  onClose,
  onSave,
  surveyMonthlyExpense,
}: ExpenseInputFormProps) {
  // 기본 생활비
  const [livingExpense, setLivingExpense] = useState(
    initialData?.livingExpense ?? 0
  );

  // 추가 지출
  const [hasAdditionalExpense, setHasAdditionalExpense] = useState<boolean | null>(
    initialData?.hasAdditionalExpense ?? (isCompleted ? false : null)
  );
  const [additionalExpenses, setAdditionalExpenses] = useState<ExpenseItem[]>(
    initialData?.additionalExpenses ?? []
  );

  const [saving, setSaving] = useState(false);

  // 추가 지출 항목 추가
  const addExpenseItem = () => {
    setAdditionalExpenses([
      ...additionalExpenses,
      { type: "food", title: "", amount: 0, frequency: "monthly" },
    ]);
  };

  // 추가 지출 항목 삭제
  const removeExpenseItem = (index: number) => {
    const updated = additionalExpenses.filter((_, i) => i !== index);
    setAdditionalExpenses(updated);
    if (updated.length === 0) {
      setHasAdditionalExpense(false);
    }
  };

  // 추가 지출 항목 업데이트
  const updateExpenseItem = (
    index: number,
    field: keyof ExpenseItem,
    value: string | number
  ) => {
    const updated = [...additionalExpenses];
    updated[index] = { ...updated[index], [field]: value };

    // 타입 변경 시 title 자동 설정
    if (field === "type") {
      const typeLabel = EXPENSE_TYPES.find((t) => t.value === value)?.label || "";
      updated[index].title = typeLabel;
    }

    setAdditionalExpenses(updated);
  };

  // 월 지출 합계 계산
  const calculateMonthlyTotal = () => {
    let total = livingExpense;

    // 관리비 (주거 데이터에서)
    if (housingData?.maintenanceFee) {
      total += housingData.maintenanceFee;
    }

    // 월세 (주거 데이터에서)
    if (housingData?.monthlyRent) {
      total += housingData.monthlyRent;
    }

    // 추가 지출
    for (const expense of additionalExpenses) {
      total +=
        expense.frequency === "monthly"
          ? expense.amount
          : Math.round(expense.amount / 12);
    }

    return total;
  };

  // 저장
  const handleSave = async () => {
    if (hasAdditionalExpense === null) {
      alert("추가 지출 여부를 선택해주세요.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        livingExpense,
        hasAdditionalExpense,
        additionalExpenses: hasAdditionalExpense
          ? additionalExpenses.filter((e) => e.amount > 0)
          : [],
      });
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const monthlyTotal = calculateMonthlyTotal();
  const canSave = hasAdditionalExpense !== null;

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onClose}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.headerTitle}>지출 정보</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          {/* 온보딩 힌트 */}
          {surveyMonthlyExpense && (
            <div className={styles.hintBox}>
              <span className={styles.hintLabel}>온보딩 응답</span>
              <span className={styles.hintValue}>
                월 생활비 {EXPENSE_RANGE_LABELS[surveyMonthlyExpense] || surveyMonthlyExpense}
              </span>
            </div>
          )}

          {/* 주거 관련 지출 (읽기 전용) */}
          {(housingData?.maintenanceFee || housingData?.monthlyRent) && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>주거 관련 지출</span>
                <span className={styles.linkedBadge}>거주부동산 연동</span>
              </div>
              <div className={styles.linkedItem}>
                {housingData?.monthlyRent && (
                  <div className={styles.linkedRow}>
                    <span className={styles.linkedLabel}>월세</span>
                    <span className={styles.linkedValue}>
                      {formatMoney(housingData.monthlyRent)}
                    </span>
                  </div>
                )}
                {housingData?.maintenanceFee && (
                  <div className={styles.linkedRow}>
                    <span className={styles.linkedLabel}>관리비</span>
                    <span className={styles.linkedValue}>
                      {formatMoney(housingData.maintenanceFee)}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 기본 생활비 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>기본 생활비</span>
            </div>
            <p className={styles.sectionHint}>
              월세/관리비 제외, 식비/교통비/통신비 등
            </p>
            <AmountInput
              value={livingExpense}
              onChange={(v) => setLivingExpense(v ?? 0)}
              showFormatted={false}
            />
          </section>

          {/* 추가 지출 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>추가 지출</span>
              <ToggleGroup
                value={hasAdditionalExpense}
                onChange={(v) => {
                  setHasAdditionalExpense(v);
                  if (v && additionalExpenses.length === 0) addExpenseItem();
                  if (!v) setAdditionalExpenses([]);
                }}
              />
            </div>
            <p className={styles.sectionHint}>
              보험료, 교육비, 정기 구독 등 추가 지출
            </p>

            {hasAdditionalExpense && (
              <div className={styles.itemList}>
                {additionalExpenses.map((item, index) => (
                  <div key={index} className={styles.expenseItem}>
                    <div className={styles.itemTop}>
                      <TypeSelect
                        value={item.type}
                        onChange={(v) => updateExpenseItem(index, "type", v)}
                        options={EXPENSE_TYPES}
                      />
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeExpenseItem(index)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className={styles.itemBottom}>
                      <AmountInput
                        value={item.amount}
                        onChange={(v) => updateExpenseItem(index, "amount", v ?? 0)}
                        showFormatted={false}
                      />
                      <FrequencyToggle
                        value={item.frequency}
                        onChange={(v) => updateExpenseItem(index, "frequency", v)}
                      />
                    </div>
                  </div>
                ))}
                <button className={styles.addBtn} onClick={addExpenseItem}>
                  <Plus size={16} />
                  <span>지출 추가</span>
                </button>
              </div>
            )}
          </section>

          {/* 합계 */}
          {monthlyTotal > 0 && (
            <div className={styles.totalBox}>
              <span className={styles.totalLabel}>월 지출 합계</span>
              <span className={styles.totalValue}>
                {formatMoney(monthlyTotal)}
              </span>
            </div>
          )}
        </main>

        <div className={styles.bottomArea}>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving || !canSave}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
