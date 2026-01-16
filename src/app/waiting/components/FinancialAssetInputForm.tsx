"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import type { FinancialAssetItem } from "../types";
import { AmountInput, RateInput, OwnerSelect } from "./inputs";
import styles from "./FinancialAssetInputForm.module.css";

// 저축 계좌 유형
const SAVINGS_TYPES = [
  { value: "checking", label: "입출금 통장" },
  { value: "savings", label: "적금" },
  { value: "deposit", label: "예금" },
] as const;

// 투자 계좌 유형
const INVESTMENT_TYPES = [
  { value: "domestic_stock", label: "국내 주식" },
  { value: "foreign_stock", label: "해외 주식" },
  { value: "fund", label: "펀드" },
  { value: "bond", label: "채권" },
  { value: "crypto", label: "암호화폐" },
  { value: "other", label: "기타" },
] as const;

interface AssetFormItem {
  category: "savings" | "investment";
  type: string;
  title: string;
  owner: "self" | "spouse";
  currentBalance: number | null;
  expectedReturn?: number | null;
}

interface FinancialAssetInputFormProps {
  hasSpouse: boolean;
  initialData: FinancialAssetItem[];
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: FinancialAssetItem[]) => Promise<void>;
}

export function FinancialAssetInputForm({
  hasSpouse,
  initialData,
  isCompleted,
  onClose,
  onSave,
}: FinancialAssetInputFormProps) {
  // 저축 계좌
  const [savingsItems, setSavingsItems] = useState<AssetFormItem[]>(() =>
    initialData
      .filter((item) => item.category === "savings")
      .map((item) => ({
        category: "savings" as const,
        type: item.type,
        title: item.title,
        owner: item.owner,
        currentBalance: item.currentBalance ?? null,
      }))
  );

  // 투자 계좌
  const [investmentItems, setInvestmentItems] = useState<AssetFormItem[]>(() =>
    initialData
      .filter((item) => item.category === "investment")
      .map((item) => ({
        category: "investment" as const,
        type: item.type,
        title: item.title,
        owner: item.owner,
        currentBalance: item.currentBalance ?? null,
        expectedReturn: item.expectedReturn ?? null,
      }))
  );

  const [saving, setSaving] = useState(false);

  // 저축 항목 추가
  const addSavingsItem = (type: string) => {
    const typeLabel = SAVINGS_TYPES.find((t) => t.value === type)?.label || "";
    setSavingsItems([
      ...savingsItems,
      {
        category: "savings",
        type,
        title: `본인 ${typeLabel}`,
        owner: "self",
        currentBalance: null,
      },
    ]);
  };

  // 투자 항목 추가
  const addInvestmentItem = (type: string) => {
    const typeLabel = INVESTMENT_TYPES.find((t) => t.value === type)?.label || "";
    setInvestmentItems([
      ...investmentItems,
      {
        category: "investment",
        type,
        title: `본인 ${typeLabel}`,
        owner: "self",
        currentBalance: null,
        expectedReturn: null,
      },
    ]);
  };

  // 저축 항목 삭제
  const removeSavingsItem = (index: number) => {
    setSavingsItems(savingsItems.filter((_, i) => i !== index));
  };

  // 투자 항목 삭제
  const removeInvestmentItem = (index: number) => {
    setInvestmentItems(investmentItems.filter((_, i) => i !== index));
  };

  // 저축 항목 업데이트
  const updateSavingsItem = (
    index: number,
    field: keyof AssetFormItem,
    value: string | number | null
  ) => {
    const updated = [...savingsItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "owner") {
      const typeLabel = SAVINGS_TYPES.find((t) => t.value === updated[index].type)?.label || "";
      const ownerLabel = value === "self" ? "본인" : "배우자";
      updated[index].title = `${ownerLabel} ${typeLabel}`;
    }

    setSavingsItems(updated);
  };

  // 투자 항목 업데이트
  const updateInvestmentItem = (
    index: number,
    field: keyof AssetFormItem,
    value: string | number | null
  ) => {
    const updated = [...investmentItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "owner") {
      const typeLabel = INVESTMENT_TYPES.find((t) => t.value === updated[index].type)?.label || "";
      const ownerLabel = value === "self" ? "본인" : "배우자";
      updated[index].title = `${ownerLabel} ${typeLabel}`;
    }

    setInvestmentItems(updated);
  };

  // 총 잔액 계산
  const calculateTotal = () => {
    let total = 0;
    for (const item of savingsItems) {
      total += item.currentBalance ?? 0;
    }
    for (const item of investmentItems) {
      total += item.currentBalance ?? 0;
    }
    return total;
  };

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      const allItems: FinancialAssetItem[] = [];

      for (const item of savingsItems) {
        if (item.currentBalance !== null && item.currentBalance > 0) {
          allItems.push({
            category: "savings",
            type: item.type,
            title: item.title || SAVINGS_TYPES.find((t) => t.value === item.type)?.label || item.type,
            owner: item.owner,
            currentBalance: item.currentBalance,
          });
        }
      }

      for (const item of investmentItems) {
        if (item.currentBalance !== null && item.currentBalance > 0) {
          allItems.push({
            category: "investment",
            type: item.type,
            title: item.title || INVESTMENT_TYPES.find((t) => t.value === item.type)?.label || item.type,
            owner: item.owner,
            currentBalance: item.currentBalance,
            expectedReturn: item.expectedReturn ?? undefined,
          });
        }
      }

      await onSave(allItems);
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const total = calculateTotal();

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onClose}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.headerTitle}>금융 자산</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          {/* 저축 계좌 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>저축 계좌</span>
            </div>

            {/* 추가된 저축 항목들 */}
            {savingsItems.length > 0 && (
              <div className={styles.itemList}>
                {savingsItems.map((item, index) => {
                  const typeLabel = SAVINGS_TYPES.find((t) => t.value === item.type)?.label || "";
                  return (
                    <div key={index} className={styles.assetItem}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemType}>{typeLabel}</span>
                        <div className={styles.itemHeaderRight}>
                          <OwnerSelect
                            value={item.owner}
                            onChange={(v) => updateSavingsItem(index, "owner", v)}
                            show={hasSpouse}
                          />
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeSavingsItem(index)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <div className={styles.itemFields}>
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>현재 잔액</span>
                          <AmountInput
                            value={item.currentBalance}
                            onChange={(v) => updateSavingsItem(index, "currentBalance", v)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 저축 추가 버튼들 */}
            <div className={styles.addButtons}>
              {SAVINGS_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={styles.addChip}
                  onClick={() => addSavingsItem(type.value)}
                >
                  <Plus size={14} />
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 투자 계좌 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>투자 계좌</span>
            </div>

            {/* 추가된 투자 항목들 */}
            {investmentItems.length > 0 && (
              <div className={styles.itemList}>
                {investmentItems.map((item, index) => {
                  const typeLabel = INVESTMENT_TYPES.find((t) => t.value === item.type)?.label || "";
                  return (
                    <div key={index} className={styles.assetItem}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemType}>{typeLabel}</span>
                        <div className={styles.itemHeaderRight}>
                          <OwnerSelect
                            value={item.owner}
                            onChange={(v) => updateInvestmentItem(index, "owner", v)}
                            show={hasSpouse}
                          />
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeInvestmentItem(index)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <div className={styles.itemFields}>
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>현재 잔액</span>
                          <AmountInput
                            value={item.currentBalance}
                            onChange={(v) => updateInvestmentItem(index, "currentBalance", v)}
                          />
                        </div>
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>예상 수익률</span>
                          <RateInput
                            value={item.expectedReturn ?? null}
                            onChange={(v) => updateInvestmentItem(index, "expectedReturn", v)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 투자 추가 버튼들 */}
            <div className={styles.addButtons}>
              {INVESTMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={styles.addChip}
                  onClick={() => addInvestmentItem(type.value)}
                >
                  <Plus size={14} />
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 총 자산 */}
          {total > 0 && (
            <div className={styles.totalBox}>
              <span className={styles.totalLabel}>금융 자산 합계</span>
              <span className={styles.totalValue}>{formatMoney(total)}</span>
            </div>
          )}
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
