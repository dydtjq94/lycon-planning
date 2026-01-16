"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import type { FinancialAssetItem } from "../types";
import { AmountInput, RateInput, OwnerSelect } from "./inputs";
import styles from "./SavingsInputForm.module.css";

// 저축 계좌 유형
const ACCOUNT_TYPES = [
  { value: "checking", label: "입출금 통장" },
  { value: "savings", label: "적금" },
  { value: "deposit", label: "정기 예금" },
] as const;

interface SavingsFormItem {
  type: string;
  title: string;
  owner: "self" | "spouse";
  currentBalance: number | null;
  monthlyDeposit?: number | null;
  expectedReturn?: number | null;
}

interface SavingsInputFormProps {
  hasSpouse: boolean;
  initialData: FinancialAssetItem[];
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: FinancialAssetItem[]) => Promise<void>;
}

export function SavingsInputForm({
  hasSpouse,
  initialData = [],
  isCompleted,
  onClose,
  onSave,
}: SavingsInputFormProps) {
  const safeInitialData = initialData || [];

  const [items, setItems] = useState<SavingsFormItem[]>(() =>
    safeInitialData.map((item) => ({
      type: item.type,
      title: item.title,
      owner: item.owner,
      currentBalance: item.currentBalance ?? null,
      monthlyDeposit: item.monthlyDeposit ?? null,
      expectedReturn: item.expectedReturn ?? null,
    }))
  );

  const [saving, setSaving] = useState(false);

  // 항목 추가
  const addItem = (type: string) => {
    const typeLabel = ACCOUNT_TYPES.find((t) => t.value === type)?.label || "";
    setItems([
      ...items,
      {
        type,
        title: `본인 ${typeLabel}`,
        owner: "self",
        currentBalance: null,
        monthlyDeposit: type === "savings" ? null : undefined,
        expectedReturn: type !== "checking" ? null : undefined,
      },
    ]);
  };

  // 항목 삭제
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // 항목 업데이트
  const updateItem = (
    index: number,
    field: keyof SavingsFormItem,
    value: string | number | null
  ) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "owner") {
      const typeLabel = ACCOUNT_TYPES.find((t) => t.value === updated[index].type)?.label || "";
      const ownerLabel = value === "self" ? "본인" : "배우자";
      updated[index].title = `${ownerLabel} ${typeLabel}`;
    }

    setItems(updated);
  };

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      const result: FinancialAssetItem[] = [];

      for (const item of items) {
        if (item.currentBalance !== null && item.currentBalance > 0) {
          result.push({
            category: "savings",
            type: item.type,
            title: item.title || ACCOUNT_TYPES.find((t) => t.value === item.type)?.label || item.type,
            owner: item.owner,
            currentBalance: item.currentBalance,
            monthlyDeposit: item.monthlyDeposit ?? undefined,
            expectedReturn: item.expectedReturn ?? undefined,
          });
        }
      }

      await onSave(result);
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onClose}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.headerTitle}>저축 계좌</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          {/* 추가된 항목들 */}
          {items.length > 0 && (
            <div className={styles.itemList}>
              {items.map((item, index) => {
                const typeLabel = ACCOUNT_TYPES.find((t) => t.value === item.type)?.label || "";
                const isChecking = item.type === "checking";
                const isSavings = item.type === "savings";

                return (
                  <div key={index} className={styles.savingsItem}>
                    <div className={styles.itemHeader}>
                      <span className={styles.itemType}>{typeLabel}</span>
                      <div className={styles.itemHeaderRight}>
                        <OwnerSelect
                          value={item.owner}
                          onChange={(v) => updateItem(index, "owner", v)}
                          show={hasSpouse}
                        />
                        <button
                          className={styles.removeBtn}
                          onClick={() => removeItem(index)}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                    <div className={styles.itemFields}>
                      <div className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>
                          {isChecking ? "잔액" : "현재 잔액"}
                        </span>
                        <AmountInput
                          value={item.currentBalance}
                          onChange={(v) => updateItem(index, "currentBalance", v)}
                        />
                      </div>
                      {isSavings && (
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>월 납입액</span>
                          <AmountInput
                            value={item.monthlyDeposit ?? null}
                            onChange={(v) => updateItem(index, "monthlyDeposit", v)}
                          />
                        </div>
                      )}
                      {!isChecking && (
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>금리</span>
                          <RateInput
                            value={item.expectedReturn ?? null}
                            onChange={(v) => updateItem(index, "expectedReturn", v)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 추가 버튼들 */}
          <div className={styles.addButtons}>
            {ACCOUNT_TYPES.map((type) => (
              <button
                key={type.value}
                className={styles.addChip}
                onClick={() => addItem(type.value)}
              >
                <Plus size={14} />
                <span>{type.label}</span>
              </button>
            ))}
          </div>

        </main>

        <div className={styles.bottomArea}>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
