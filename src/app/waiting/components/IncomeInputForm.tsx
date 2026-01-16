"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { AmountInput, ToggleGroup, TypeSelect, OwnerSelect, FrequencyToggle } from "./inputs";
import styles from "./IncomeInputForm.module.css";

// 온보딩 소득 구간 레이블
const INCOME_RANGE_LABELS: Record<string, string> = {
  under_3000: "3,000만원 이하",
  "3000_5000": "3,000~5,000만원",
  "5000_8000": "5,000~8,000만원",
  "8000_12000": "8,000만원~1.2억",
  over_12000: "1.2억 초과",
};

// 추가 소득 유형
const ADDITIONAL_INCOME_TYPES = [
  { value: "business", label: "사업소득" },
  { value: "other", label: "기타소득" },
] as const;

type AdditionalIncomeType = typeof ADDITIONAL_INCOME_TYPES[number]["value"];

interface AdditionalIncome {
  type: AdditionalIncomeType;
  owner: "self" | "spouse";
  amount: number;
  frequency: "monthly" | "yearly";
}

export interface IncomeFormData {
  selfLaborIncome: number;
  selfLaborFrequency: "monthly" | "yearly";
  spouseLaborIncome: number;
  spouseLaborFrequency: "monthly" | "yearly";
  additionalIncomes: AdditionalIncome[];
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
  // 근로소득
  const [selfLaborIncome, setSelfLaborIncome] = useState(initialData?.selfLaborIncome ?? 0);
  const [selfLaborFrequency, setSelfLaborFrequency] = useState<"monthly" | "yearly">(
    initialData?.selfLaborFrequency ?? "monthly"
  );
  const [spouseLaborIncome, setSpouseLaborIncome] = useState(initialData?.spouseLaborIncome ?? 0);
  const [spouseLaborFrequency, setSpouseLaborFrequency] = useState<"monthly" | "yearly">(
    initialData?.spouseLaborFrequency ?? "monthly"
  );

  // 추가 소득
  const [hasAdditional, setHasAdditional] = useState<boolean | null>(
    initialData?.additionalIncomes && initialData.additionalIncomes.length > 0
      ? true
      : isCompleted
      ? false
      : null
  );
  const [additionalIncomes, setAdditionalIncomes] = useState<AdditionalIncome[]>(
    initialData?.additionalIncomes ?? []
  );

  const [saving, setSaving] = useState(false);

  // 추가 소득 관리
  const addAdditionalIncome = () => {
    setAdditionalIncomes([
      ...additionalIncomes,
      { type: "business", owner: "self", amount: 0, frequency: "monthly" },
    ]);
  };

  const removeAdditionalIncome = (index: number) => {
    const updated = additionalIncomes.filter((_, i) => i !== index);
    setAdditionalIncomes(updated);
    if (updated.length === 0) {
      setHasAdditional(false);
    }
  };

  const updateAdditionalIncome = (
    index: number,
    field: keyof AdditionalIncome,
    value: string | number
  ) => {
    const updated = [...additionalIncomes];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalIncomes(updated);
  };

  // 월 소득 합계 계산
  const calculateMonthlyTotal = () => {
    let total = 0;

    // 본인 근로소득
    total += selfLaborFrequency === "monthly" ? selfLaborIncome : Math.round(selfLaborIncome / 12);

    // 배우자 근로소득
    if (hasSpouse) {
      total += spouseLaborFrequency === "monthly" ? spouseLaborIncome : Math.round(spouseLaborIncome / 12);
    }

    // 추가 소득
    for (const income of additionalIncomes) {
      total += income.frequency === "monthly" ? income.amount : Math.round(income.amount / 12);
    }

    return total;
  };

  // 저장
  const handleSave = async () => {
    if (hasAdditional === null) {
      alert("추가 소득 여부를 선택해주세요.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        selfLaborIncome,
        selfLaborFrequency,
        spouseLaborIncome: hasSpouse ? spouseLaborIncome : 0,
        spouseLaborFrequency,
        additionalIncomes: hasAdditional ? additionalIncomes.filter(inc => inc.amount > 0) : [],
      });
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const monthlyTotal = calculateMonthlyTotal();
  const canSave = hasAdditional !== null;

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

            {/* 본인 근로소득 */}
            <div className={styles.incomeRow}>
              <span className={styles.incomeLabel}>본인</span>
              <div className={styles.incomeInputGroup}>
                <AmountInput
                  value={selfLaborIncome}
                  onChange={(v) => setSelfLaborIncome(v ?? 0)}
                  showFormatted={false}
                />
                <FrequencyToggle
                  value={selfLaborFrequency}
                  onChange={setSelfLaborFrequency}
                />
              </div>
            </div>

            {/* 배우자 근로소득 (배우자 있을 때만) */}
            {hasSpouse && (
              <div className={styles.incomeRow}>
                <span className={styles.incomeLabel}>배우자</span>
                <div className={styles.incomeInputGroup}>
                  <AmountInput
                    value={spouseLaborIncome}
                    onChange={(v) => setSpouseLaborIncome(v ?? 0)}
                    showFormatted={false}
                  />
                  <FrequencyToggle
                    value={spouseLaborFrequency}
                    onChange={setSpouseLaborFrequency}
                  />
                </div>
              </div>
            )}
          </section>

          {/* 추가 소득 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>추가 소득</span>
              <ToggleGroup
                value={hasAdditional}
                onChange={(v) => {
                  setHasAdditional(v);
                  if (v && additionalIncomes.length === 0) addAdditionalIncome();
                  if (!v) setAdditionalIncomes([]);
                }}
              />
            </div>
            <p className={styles.sectionHint}>사업소득, 기타소득</p>

            {hasAdditional && (
              <div className={styles.additionalList}>
                {additionalIncomes.map((income, index) => (
                  <div key={index} className={styles.additionalItem}>
                    <div className={styles.additionalTop}>
                      <TypeSelect
                        value={income.type}
                        onChange={(v) => updateAdditionalIncome(index, "type", v)}
                        options={ADDITIONAL_INCOME_TYPES}
                      />
                      <OwnerSelect
                        value={income.owner}
                        onChange={(v) => updateAdditionalIncome(index, "owner", v)}
                        show={hasSpouse}
                      />
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeAdditionalIncome(index)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className={styles.additionalBottom}>
                      <AmountInput
                        value={income.amount}
                        onChange={(v) => updateAdditionalIncome(index, "amount", v ?? 0)}
                        showFormatted={false}
                      />
                      <FrequencyToggle
                        value={income.frequency}
                        onChange={(v) => updateAdditionalIncome(index, "frequency", v)}
                      />
                    </div>
                  </div>
                ))}
                <button className={styles.addBtn} onClick={addAdditionalIncome}>
                  <Plus size={16} />
                  <span>소득 추가</span>
                </button>
              </div>
            )}
          </section>

          {/* 합계 */}
          {monthlyTotal > 0 && (
            <div className={styles.totalBox}>
              <span className={styles.totalLabel}>월 소득 합계</span>
              <span className={styles.totalValue}>{formatMoney(monthlyTotal)}</span>
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
