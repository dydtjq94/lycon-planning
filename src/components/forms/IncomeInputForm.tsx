"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { AmountInput, OwnerSelect, FrequencyToggle } from "./inputs";
import styles from "./IncomeInputForm.module.css";

// 온보딩 소득 구간 레이블
const INCOME_RANGE_LABELS: Record<string, string> = {
  under_1200: "1,200만원 이하",
  "1200_4600": "1,200~4,600만원",
  "4600_8800": "4,600~8,800만원",
  "8800_15000": "8,800만원~1.5억",
  over_15000: "1.5억 초과",
};

// 소득 유형
const INCOME_TYPES = [
  { value: "labor", label: "근로소득" },
  { value: "business", label: "사업소득" },
  { value: "other", label: "기타소득" },
] as const;

interface IncomeFormItem {
  type: string;
  title: string;
  owner: "self" | "spouse";
  amount: number | null;
  frequency: "monthly" | "yearly";
}

export interface IncomeFormData {
  selfLaborIncome: number;
  selfLaborFrequency: "monthly" | "yearly";
  spouseLaborIncome: number;
  spouseLaborFrequency: "monthly" | "yearly";
  additionalIncomes: {
    type: string;
    owner: "self" | "spouse";
    amount: number;
    frequency: "monthly" | "yearly";
  }[];
}

interface IncomeInputFormProps {
  hasSpouse: boolean;
  initialData?: IncomeFormData | null;
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: IncomeFormData) => Promise<void>;
  surveyIncomeRange?: string;
}

export function IncomeInputForm({
  hasSpouse,
  initialData,
  isCompleted,
  onClose,
  onSave,
  surveyIncomeRange,
}: IncomeInputFormProps) {
  // 소득 항목들
  const [items, setItems] = useState<IncomeFormItem[]>(() => {
    const result: IncomeFormItem[] = [];

    // 본인 근로소득 (기본)
    result.push({
      type: "labor",
      title: "본인 근로소득",
      owner: "self",
      amount: initialData?.selfLaborIncome ?? null,
      frequency: initialData?.selfLaborFrequency ?? "monthly",
    });

    // 배우자 근로소득 (배우자 있을 때)
    if (hasSpouse) {
      result.push({
        type: "labor",
        title: "배우자 근로소득",
        owner: "spouse",
        amount: initialData?.spouseLaborIncome ?? null,
        frequency: initialData?.spouseLaborFrequency ?? "monthly",
      });
    }

    // 추가 소득
    if (initialData?.additionalIncomes) {
      for (const inc of initialData.additionalIncomes) {
        const typeLabel = INCOME_TYPES.find(t => t.value === inc.type)?.label || "";
        const ownerLabel = inc.owner === "self" ? "본인" : "배우자";
        result.push({
          type: inc.type,
          title: `${ownerLabel} ${typeLabel}`,
          owner: inc.owner,
          amount: inc.amount,
          frequency: inc.frequency,
        });
      }
    }

    return result;
  });

  const [saving, setSaving] = useState(false);

  // 항목 추가
  const addItem = (type: string) => {
    const typeLabel = INCOME_TYPES.find(t => t.value === type)?.label || "";
    setItems([
      ...items,
      {
        type,
        title: `본인 ${typeLabel}`,
        owner: "self",
        amount: null,
        frequency: "monthly",
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
    field: keyof IncomeFormItem,
    value: string | number | null
  ) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "owner") {
      const typeLabel = INCOME_TYPES.find(t => t.value === updated[index].type)?.label || "";
      const ownerLabel = value === "self" ? "본인" : "배우자";
      updated[index].title = `${ownerLabel} ${typeLabel}`;
    }

    setItems(updated);
  };

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      // 근로소득 추출
      const selfLabor = items.find(i => i.type === "labor" && i.owner === "self");
      const spouseLabor = items.find(i => i.type === "labor" && i.owner === "spouse");

      // 추가 소득 추출
      const additionalIncomes = items
        .filter(i => i.type !== "labor" && i.amount !== null && i.amount > 0)
        .map(i => ({
          type: i.type,
          owner: i.owner,
          amount: i.amount as number,
          frequency: i.frequency,
        }));

      await onSave({
        selfLaborIncome: selfLabor?.amount ?? 0,
        selfLaborFrequency: selfLabor?.frequency ?? "monthly",
        spouseLaborIncome: spouseLabor?.amount ?? 0,
        spouseLaborFrequency: spouseLabor?.frequency ?? "monthly",
        additionalIncomes,
      });
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 근로소득 항목들
  const laborItems = items.filter(i => i.type === "labor");
  // 추가 소득 항목들 (사업소득, 기타소득)
  const additionalItems = items.filter(i => i.type !== "labor");

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onClose}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.headerTitle}>소득 정보</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          {/* 온보딩 힌트 */}
          {surveyIncomeRange && (
            <div className={styles.hintBox}>
              <span className={styles.hintLabel}>온보딩 응답</span>
              <span className={styles.hintValue}>
                연 소득 {INCOME_RANGE_LABELS[surveyIncomeRange] || surveyIncomeRange}
              </span>
            </div>
          )}

          {/* 근로소득 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>근로소득</span>
            </div>
            <p className={styles.sectionHint}>세후 기준, 일을 안하시면 0원</p>

            <div className={styles.itemList}>
              {laborItems.map((item, idx) => {
                const originalIndex = items.findIndex(i => i === item);
                return (
                  <div key={originalIndex} className={styles.incomeItem}>
                    <div className={styles.itemHeader}>
                      <span className={styles.itemType}>
                        {item.owner === "self" ? "본인" : "배우자"}
                      </span>
                    </div>
                    <div className={styles.itemFields}>
                      <div className={styles.fieldRow}>
                        <AmountInput
                          value={item.amount}
                          onChange={(v) => updateItem(originalIndex, "amount", v)}
                          showFormatted={false}
                        />
                        <FrequencyToggle
                          value={item.frequency}
                          onChange={(v) => updateItem(originalIndex, "frequency", v)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 추가 소득 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>추가 소득</span>
            </div>
            <p className={styles.sectionHint}>사업소득, 기타소득 등이 있다면 추가해주세요</p>

            {/* 추가된 항목들 */}
            {additionalItems.length > 0 && (
              <div className={styles.itemList}>
                {additionalItems.map((item) => {
                  const originalIndex = items.findIndex(i => i === item);
                  const typeLabel = INCOME_TYPES.find(t => t.value === item.type)?.label || "";
                  return (
                    <div key={originalIndex} className={styles.incomeItem}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemType}>{typeLabel}</span>
                        <div className={styles.itemHeaderRight}>
                          <OwnerSelect
                            value={item.owner}
                            onChange={(v) => updateItem(originalIndex, "owner", v)}
                            show={hasSpouse}
                          />
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeItem(originalIndex)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <div className={styles.itemFields}>
                        <div className={styles.fieldRow}>
                          <AmountInput
                            value={item.amount}
                            onChange={(v) => updateItem(originalIndex, "amount", v)}
                            showFormatted={false}
                          />
                          <FrequencyToggle
                            value={item.frequency}
                            onChange={(v) => updateItem(originalIndex, "frequency", v)}
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
              {INCOME_TYPES.filter(t => t.value !== "labor").map((type) => (
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
