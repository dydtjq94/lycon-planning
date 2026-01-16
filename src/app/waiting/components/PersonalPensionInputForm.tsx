"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { AmountInput, OwnerSelect } from "./inputs";
import type { PersonalPensionItem } from "../types";
import styles from "./PensionInputForm.module.css";

// 개인연금 유형
const PERSONAL_PENSION_TYPES = [
  { value: "pension_savings", label: "연금저축" },
  { value: "irp", label: "IRP" },
] as const;

interface PersonalPensionInputFormProps {
  hasSpouse: boolean;
  initialData: PersonalPensionItem[];
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: PersonalPensionItem[]) => Promise<void>;
}

interface FormItem {
  type: string;
  owner: "self" | "spouse";
  balance: number | null;
  monthlyDeposit: number | null;
}

export function PersonalPensionInputForm({
  hasSpouse,
  initialData,
  isCompleted,
  onClose,
  onSave,
}: PersonalPensionInputFormProps) {
  const [items, setItems] = useState<FormItem[]>(() =>
    initialData.map((item) => ({
      type: item.type,
      owner: item.owner,
      balance: item.balance || null,
      monthlyDeposit: item.monthlyDeposit || null,
    }))
  );

  const [saving, setSaving] = useState(false);

  // 항목 추가
  const addItem = (type: string) => {
    setItems([
      ...items,
      {
        type,
        owner: "self",
        balance: null,
        monthlyDeposit: null,
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
    field: keyof FormItem,
    value: string | number | null
  ) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result: PersonalPensionItem[] = items
        .filter((item) => (item.balance ?? 0) > 0 || (item.monthlyDeposit ?? 0) > 0)
        .map((item) => ({
          type: item.type,
          owner: item.owner,
          balance: item.balance ?? 0,
          monthlyDeposit: item.monthlyDeposit ?? 0,
        }));

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
          <h1 className={styles.headerTitle}>개인연금</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          <section className={styles.section}>
            <p className={styles.sectionHint}>
              연금저축, IRP 등 개인이 가입한 연금 상품
            </p>

            {/* 추가된 항목들 */}
            {items.length > 0 && (
              <div className={styles.itemList}>
                {items.map((item, index) => {
                  const typeLabel = PERSONAL_PENSION_TYPES.find(
                    (t) => t.value === item.type
                  )?.label || "";
                  return (
                    <div key={index} className={styles.pensionItem}>
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
                          <span className={styles.fieldLabel}>적립금</span>
                          <AmountInput
                            value={item.balance}
                            onChange={(v) => updateItem(index, "balance", v)}
                          />
                        </div>
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>월 납입액</span>
                          <AmountInput
                            value={item.monthlyDeposit}
                            onChange={(v) => updateItem(index, "monthlyDeposit", v)}
                            showFormatted={false}
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
              {PERSONAL_PENSION_TYPES.map((type) => (
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
          </section>
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
