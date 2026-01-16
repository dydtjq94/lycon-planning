"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import type { DebtItem, HousingData } from "../types";
import { AmountInput, RateInput, OwnerSelect } from "./inputs";
import styles from "./DebtInputForm.module.css";

// 대출 유형
const LOAN_TYPES = [
  { value: "credit", label: "신용대출" },
  { value: "credit_line", label: "마이너스통장" },
  { value: "student", label: "학자금대출" },
  { value: "card", label: "카드론" },
  { value: "other_loan", label: "기타" },
] as const;

// 할부 유형
const INSTALLMENT_TYPES = [
  { value: "car", label: "자동차" },
  { value: "appliance", label: "가전" },
  { value: "phone", label: "휴대폰" },
  { value: "other_installment", label: "기타" },
] as const;

interface DebtInputFormProps {
  hasSpouse: boolean;
  housingData: HousingData | null;
  initialData: DebtItem[];
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: DebtItem[]) => Promise<void>;
}

interface DebtFormItem {
  category: "loan" | "installment";
  type: string;
  title: string;
  owner: "self" | "spouse";
  balance: number | null;
  interestRate: number | null;
}

export function DebtInputForm({
  hasSpouse,
  housingData,
  initialData,
  isCompleted,
  onClose,
  onSave,
}: DebtInputFormProps) {
  // 대출 항목
  const [loanItems, setLoanItems] = useState<DebtFormItem[]>(() =>
    initialData
      .filter(item => LOAN_TYPES.some(t => t.value === item.type))
      .map(item => ({
        category: "loan" as const,
        type: item.type,
        title: item.title,
        owner: "self" as const,
        balance: item.currentBalance ?? null,
        interestRate: item.interestRate ?? null,
      }))
  );

  // 할부 항목
  const [installmentItems, setInstallmentItems] = useState<DebtFormItem[]>(() =>
    initialData
      .filter(item => INSTALLMENT_TYPES.some(t => t.value === item.type))
      .map(item => ({
        category: "installment" as const,
        type: item.type,
        title: item.title,
        owner: "self" as const,
        balance: item.currentBalance ?? null,
        interestRate: item.interestRate ?? null,
      }))
  );

  const [saving, setSaving] = useState(false);

  // 대출 항목 추가
  const addLoanItem = (type: string) => {
    const typeLabel = LOAN_TYPES.find(t => t.value === type)?.label || "";
    setLoanItems([
      ...loanItems,
      {
        category: "loan",
        type,
        title: `본인 ${typeLabel}`,
        owner: "self",
        balance: null,
        interestRate: null,
      },
    ]);
  };

  // 대출 항목 삭제
  const removeLoanItem = (index: number) => {
    setLoanItems(loanItems.filter((_, i) => i !== index));
  };

  // 대출 항목 업데이트
  const updateLoanItem = (
    index: number,
    field: keyof DebtFormItem,
    value: string | number | null
  ) => {
    const updated = [...loanItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "owner") {
      const typeLabel = LOAN_TYPES.find((t) => t.value === updated[index].type)?.label || "";
      const ownerLabel = value === "self" ? "본인" : "배우자";
      updated[index].title = `${ownerLabel} ${typeLabel}`;
    }

    setLoanItems(updated);
  };

  // 할부 항목 추가
  const addInstallmentItem = (type: string) => {
    const typeLabel = INSTALLMENT_TYPES.find(t => t.value === type)?.label || "";
    setInstallmentItems([
      ...installmentItems,
      {
        category: "installment",
        type,
        title: `본인 ${typeLabel} 할부`,
        owner: "self",
        balance: null,
        interestRate: null,
      },
    ]);
  };

  // 할부 항목 삭제
  const removeInstallmentItem = (index: number) => {
    setInstallmentItems(installmentItems.filter((_, i) => i !== index));
  };

  // 할부 항목 업데이트
  const updateInstallmentItem = (
    index: number,
    field: keyof DebtFormItem,
    value: string | number | null
  ) => {
    const updated = [...installmentItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "owner") {
      const typeLabel = INSTALLMENT_TYPES.find((t) => t.value === updated[index].type)?.label || "";
      const ownerLabel = value === "self" ? "본인" : "배우자";
      updated[index].title = `${ownerLabel} ${typeLabel} 할부`;
    }

    setInstallmentItems(updated);
  };


  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      const items: DebtItem[] = [];

      for (const item of loanItems) {
        if (item.balance !== null && item.balance > 0) {
          items.push({
            type: item.type,
            title: item.title || LOAN_TYPES.find((t) => t.value === item.type)?.label || item.type,
            principal: item.balance,
            currentBalance: item.balance,
            interestRate: item.interestRate ?? 0,
          });
        }
      }

      for (const item of installmentItems) {
        if (item.balance !== null && item.balance > 0) {
          items.push({
            type: item.type,
            title: item.title || INSTALLMENT_TYPES.find((t) => t.value === item.type)?.label + " 할부" || item.type,
            principal: item.balance,
            currentBalance: item.balance,
            interestRate: item.interestRate ?? 0,
          });
        }
      }

      await onSave(items);
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 주거 대출 라벨
  const getHousingLoanLabel = () => {
    if (!housingData?.hasLoan) return "";
    return housingData.housingType === "자가" ? "주택담보대출" : "전월세보증금대출";
  };


  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onClose}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.headerTitle}>부채 정보</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          {/* 주거 대출 (읽기 전용) */}
          {housingData?.hasLoan && housingData.loanAmount && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{getHousingLoanLabel()}</span>
                <span className={styles.linkedBadge}>거주부동산 연동</span>
              </div>
              <div className={styles.linkedItem}>
                <div className={styles.linkedRow}>
                  <span className={styles.linkedLabel}>남은 금액</span>
                  <span className={styles.linkedValue}>
                    {formatMoney(housingData.loanAmount)}
                  </span>
                </div>
                <div className={styles.linkedRow}>
                  <span className={styles.linkedLabel}>금리</span>
                  <span className={styles.linkedValue}>
                    {housingData.loanRate}%
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* 대출 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>대출</span>
            </div>
            <p className={styles.sectionHint}>
              신용대출, 학자금대출 등 현재 상환 중인 대출이 있다면 추가해주세요
            </p>

            {/* 추가된 대출 항목들 */}
            {loanItems.length > 0 && (
              <div className={styles.itemList}>
                {loanItems.map((item, index) => {
                  const typeLabel = LOAN_TYPES.find(t => t.value === item.type)?.label || "";
                  return (
                    <div key={index} className={styles.debtItem}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemType}>{typeLabel}</span>
                        <div className={styles.itemHeaderRight}>
                          <OwnerSelect
                            value={item.owner}
                            onChange={(v) => updateLoanItem(index, "owner", v)}
                            show={hasSpouse}
                          />
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeLoanItem(index)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <div className={styles.itemFields}>
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>남은 금액</span>
                          <AmountInput
                            value={item.balance}
                            onChange={(v) => updateLoanItem(index, "balance", v)}
                          />
                        </div>
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>금리</span>
                          <RateInput
                            value={item.interestRate}
                            onChange={(v) => updateLoanItem(index, "interestRate", v)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 대출 추가 버튼들 */}
            <div className={styles.addButtons}>
              {LOAN_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={styles.addChip}
                  onClick={() => addLoanItem(type.value)}
                >
                  <Plus size={14} />
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 할부 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>할부</span>
            </div>
            <p className={styles.sectionHint}>
              1년 이상 남은 할부만 작성해주세요 (자동차, 가전 등)
            </p>

            {/* 추가된 할부 항목들 */}
            {installmentItems.length > 0 && (
              <div className={styles.itemList}>
                {installmentItems.map((item, index) => {
                  const typeLabel = INSTALLMENT_TYPES.find(t => t.value === item.type)?.label || "";
                  return (
                    <div key={index} className={styles.debtItem}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemType}>{typeLabel} 할부</span>
                        <div className={styles.itemHeaderRight}>
                          <OwnerSelect
                            value={item.owner}
                            onChange={(v) => updateInstallmentItem(index, "owner", v)}
                            show={hasSpouse}
                          />
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeInstallmentItem(index)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <div className={styles.itemFields}>
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>남은 금액</span>
                          <AmountInput
                            value={item.balance}
                            onChange={(v) => updateInstallmentItem(index, "balance", v)}
                          />
                        </div>
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>금리</span>
                          <RateInput
                            value={item.interestRate}
                            onChange={(v) => updateInstallmentItem(index, "interestRate", v)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 할부 추가 버튼들 */}
            <div className={styles.addButtons}>
              {INSTALLMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={styles.addChip}
                  onClick={() => addInstallmentItem(type.value)}
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
