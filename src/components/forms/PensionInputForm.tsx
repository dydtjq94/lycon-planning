"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { AmountInput, OwnerSelect } from "./inputs";
import styles from "./PensionInputForm.module.css";

// 개인연금 유형
const PERSONAL_PENSION_TYPES = [
  { value: "pension_savings", label: "연금저축" },
  { value: "irp", label: "IRP" },
] as const;

export interface PensionFormData {
  // 국민연금
  hasNationalPension: boolean;
  selfNationalPensionExpected: number;
  spouseNationalPensionExpected: number;
  // 퇴직연금
  hasRetirementPension: boolean;
  selfRetirementBalance: number;
  spouseRetirementBalance: number;
  // 개인연금
  hasPersonalPension: boolean;
  selfPersonalBalance: number;
  selfPersonalMonthly: number;
  spousePersonalBalance: number;
  spousePersonalMonthly: number;
}

interface PersonalPensionItem {
  type: string;
  owner: "self" | "spouse";
  balance: number | null;
  monthlyDeposit: number | null;
}

interface PensionInputFormProps {
  hasSpouse: boolean;
  initialData?: PensionFormData | null;
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: PensionFormData) => Promise<void>;
}

export function PensionInputForm({
  hasSpouse,
  initialData,
  isCompleted,
  onClose,
  onSave,
}: PensionInputFormProps) {
  // 국민연금
  const [selfNationalPension, setSelfNationalPension] = useState<number | null>(
    initialData?.selfNationalPensionExpected ?? null
  );
  const [spouseNationalPension, setSpouseNationalPension] = useState<number | null>(
    initialData?.spouseNationalPensionExpected ?? null
  );

  // 퇴직연금/퇴직금
  const [selfRetirement, setSelfRetirement] = useState<number | null>(
    initialData?.selfRetirementBalance ?? null
  );
  const [spouseRetirement, setSpouseRetirement] = useState<number | null>(
    initialData?.spouseRetirementBalance ?? null
  );

  // 개인연금
  const [personalPensions, setPersonalPensions] = useState<PersonalPensionItem[]>(() => {
    const items: PersonalPensionItem[] = [];

    // 기존 데이터에서 개인연금 복원
    if (initialData?.hasPersonalPension) {
      if (initialData.selfPersonalBalance > 0 || initialData.selfPersonalMonthly > 0) {
        items.push({
          type: "pension_savings",
          owner: "self",
          balance: initialData.selfPersonalBalance || null,
          monthlyDeposit: initialData.selfPersonalMonthly || null,
        });
      }
      if (hasSpouse && (initialData.spousePersonalBalance > 0 || initialData.spousePersonalMonthly > 0)) {
        items.push({
          type: "pension_savings",
          owner: "spouse",
          balance: initialData.spousePersonalBalance || null,
          monthlyDeposit: initialData.spousePersonalMonthly || null,
        });
      }
    }

    return items;
  });

  const [saving, setSaving] = useState(false);

  // 개인연금 추가
  const addPersonalPension = (type: string) => {
    setPersonalPensions([
      ...personalPensions,
      {
        type,
        owner: "self",
        balance: null,
        monthlyDeposit: null,
      },
    ]);
  };

  // 개인연금 삭제
  const removePersonalPension = (index: number) => {
    setPersonalPensions(personalPensions.filter((_, i) => i !== index));
  };

  // 개인연금 업데이트
  const updatePersonalPension = (
    index: number,
    field: keyof PersonalPensionItem,
    value: string | number | null
  ) => {
    const updated = [...personalPensions];
    updated[index] = { ...updated[index], [field]: value };
    setPersonalPensions(updated);
  };

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      // 개인연금 합산 (본인/배우자)
      let selfPersonalBalance = 0;
      let selfPersonalMonthly = 0;
      let spousePersonalBalance = 0;
      let spousePersonalMonthly = 0;

      for (const item of personalPensions) {
        if (item.owner === "self") {
          selfPersonalBalance += item.balance ?? 0;
          selfPersonalMonthly += item.monthlyDeposit ?? 0;
        } else {
          spousePersonalBalance += item.balance ?? 0;
          spousePersonalMonthly += item.monthlyDeposit ?? 0;
        }
      }

      await onSave({
        hasNationalPension: (selfNationalPension ?? 0) > 0 || (spouseNationalPension ?? 0) > 0,
        selfNationalPensionExpected: selfNationalPension ?? 0,
        spouseNationalPensionExpected: spouseNationalPension ?? 0,
        hasRetirementPension: (selfRetirement ?? 0) > 0 || (spouseRetirement ?? 0) > 0,
        selfRetirementBalance: selfRetirement ?? 0,
        spouseRetirementBalance: spouseRetirement ?? 0,
        hasPersonalPension: personalPensions.length > 0,
        selfPersonalBalance,
        selfPersonalMonthly,
        spousePersonalBalance,
        spousePersonalMonthly,
      });
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
          <h1 className={styles.headerTitle}>연금 정보</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          {/* 국민(공적)연금 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>국민(공적)연금</span>
            </div>
            <p className={styles.sectionHint}>
              국민연금공단에서 예상 월 수령액을 조회할 수 있어요
            </p>

            <div className={styles.itemList}>
              <div className={styles.pensionItem}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemType}>본인</span>
                </div>
                <div className={styles.itemFields}>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>예상 수령액</span>
                    <AmountInput
                      value={selfNationalPension}
                      onChange={setSelfNationalPension}
                      showFormatted={false}
                    />
                    <span className={styles.fieldUnit}>/월</span>
                  </div>
                </div>
              </div>

              {hasSpouse && (
                <div className={styles.pensionItem}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemType}>배우자</span>
                  </div>
                  <div className={styles.itemFields}>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>예상 수령액</span>
                      <AmountInput
                        value={spouseNationalPension}
                        onChange={setSpouseNationalPension}
                        showFormatted={false}
                      />
                      <span className={styles.fieldUnit}>/월</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 퇴직연금/퇴직금 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>퇴직연금/퇴직금</span>
            </div>
            <p className={styles.sectionHint}>
              DC형, DB형, 퇴직금 등 현재 적립된 금액
            </p>

            <div className={styles.itemList}>
              <div className={styles.pensionItem}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemType}>본인</span>
                </div>
                <div className={styles.itemFields}>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>적립금</span>
                    <AmountInput
                      value={selfRetirement}
                      onChange={setSelfRetirement}
                    />
                  </div>
                </div>
              </div>

              {hasSpouse && (
                <div className={styles.pensionItem}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemType}>배우자</span>
                  </div>
                  <div className={styles.itemFields}>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>적립금</span>
                      <AmountInput
                        value={spouseRetirement}
                        onChange={setSpouseRetirement}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 개인연금 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>개인연금</span>
            </div>
            <p className={styles.sectionHint}>
              연금저축, IRP 등 개인이 가입한 연금 상품
            </p>

            {/* 추가된 개인연금 항목들 */}
            {personalPensions.length > 0 && (
              <div className={styles.itemList}>
                {personalPensions.map((item, index) => {
                  const typeLabel = PERSONAL_PENSION_TYPES.find(t => t.value === item.type)?.label || "";
                  return (
                    <div key={index} className={styles.pensionItem}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemType}>{typeLabel}</span>
                        <div className={styles.itemHeaderRight}>
                          <OwnerSelect
                            value={item.owner}
                            onChange={(v) => updatePersonalPension(index, "owner", v)}
                            show={hasSpouse}
                          />
                          <button
                            className={styles.removeBtn}
                            onClick={() => removePersonalPension(index)}
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
                            onChange={(v) => updatePersonalPension(index, "balance", v)}
                          />
                        </div>
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>월 납입액</span>
                          <AmountInput
                            value={item.monthlyDeposit}
                            onChange={(v) => updatePersonalPension(index, "monthlyDeposit", v)}
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
                  onClick={() => addPersonalPension(type.value)}
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
