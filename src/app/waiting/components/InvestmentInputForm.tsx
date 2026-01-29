"use client";

import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import type { FinancialAssetItem } from "../types";
import { AmountInput, OwnerSelect } from "./inputs";
import styles from "./InvestmentInputForm.module.css";

// 투자 유형
const INVESTMENT_TYPES_OPTIONS = [
  { value: "domestic_stock", label: "국내주식" },
  { value: "foreign_stock", label: "해외주식" },
  { value: "fund", label: "펀드" },
  { value: "bond", label: "채권" },
  { value: "crypto", label: "코인" },
  { value: "gold", label: "금" },
  { value: "other", label: "기타" },
] as const;

interface InvestmentFormItem {
  id?: string;
  type: string;
  title: string;
  owner: "self" | "spouse";
  balance: number | null;
}

interface InvestmentInputFormProps {
  hasSpouse: boolean;
  initialData: FinancialAssetItem[];
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: FinancialAssetItem[]) => Promise<void>;
  surveyInvestmentExp?: string | string[];
  surveySavingStyle?: string | string[];
}

export function InvestmentInputForm({
  hasSpouse,
  initialData,
  isCompleted,
  onClose,
  onSave,
}: InvestmentInputFormProps) {
  const [items, setItems] = useState<InvestmentFormItem[]>(() => {
    return initialData.map((item, idx) => ({
      id: item.id || `inv-${idx}`,
      type: item.type,
      title: item.title,
      owner: item.owner,
      balance: item.currentBalance ?? null,
    }));
  });

  const [saving, setSaving] = useState(false);

  // 항목 추가
  const addItem = (type: string) => {
    const typeLabel = INVESTMENT_TYPES_OPTIONS.find((t) => t.value === type)?.label || "";
    setItems([
      ...items,
      {
        id: `inv-${Date.now()}`,
        type,
        title: typeLabel,
        owner: "self",
        balance: null,
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
    field: keyof InvestmentFormItem,
    value: string | number | null
  ) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    // 타입 변경 시 title도 업데이트
    if (field === "type") {
      const typeLabel = INVESTMENT_TYPES_OPTIONS.find((t) => t.value === value)?.label || "";
      updated[index].title = typeLabel;
    }

    setItems(updated);
  };

  // 저장 - 배열 형식으로 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      const data: FinancialAssetItem[] = items
        .filter((item) => item.balance !== null && item.balance > 0)
        .map((item) => ({
          id: item.id,
          category: "investment" as const,
          type: item.type,
          title: item.title,
          owner: item.owner,
          currentBalance: item.balance || 0,
        }));

      await onSave(data);
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
          <h1 className={styles.headerTitle}>투자 계좌</h1>
          <button className={styles.closeButton} onClick={onClose}>
            <ChevronDown size={24} />
          </button>
        </header>

        <main className={styles.main}>
          <p className={styles.sectionHint}>
            주식, 코인 등 현재 보유 중인 투자 자산을 추가해주세요
          </p>

          {/* 추가된 항목들 */}
          {items.length > 0 && (
            <div className={styles.itemList}>
              {items.map((item, index) => {
                const typeLabel = INVESTMENT_TYPES_OPTIONS.find((t) => t.value === item.type)?.label || item.type;

                return (
                  <div key={item.id || index} className={styles.investmentItem}>
                    <div className={styles.itemHeader}>
                      <select
                        className={styles.typeSelect}
                        value={item.type}
                        onChange={(e) => updateItem(index, "type", e.target.value)}
                      >
                        {INVESTMENT_TYPES_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
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
                        <span className={styles.fieldLabel}>명칭</span>
                        <input
                          type="text"
                          className={styles.titleInput}
                          value={item.title}
                          onChange={(e) => updateItem(index, "title", e.target.value)}
                          placeholder={typeLabel}
                        />
                      </div>
                      <div className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>평가금액</span>
                        <AmountInput
                          value={item.balance}
                          onChange={(v) => updateItem(index, "balance", v)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 추가 버튼들 */}
          <div className={styles.addButtons}>
            {INVESTMENT_TYPES_OPTIONS.map((type) => (
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
