"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import type { FinancialAssetItem } from "../types";
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
  const [hasSavings, setHasSavings] = useState<boolean | null>(
    initialData.some((item) => item.category === "savings")
      ? true
      : isCompleted
      ? false
      : null
  );
  const [savingsItems, setSavingsItems] = useState<FinancialAssetItem[]>(
    initialData.filter((item) => item.category === "savings")
  );

  // 투자 계좌
  const [hasInvestment, setHasInvestment] = useState<boolean | null>(
    initialData.some((item) => item.category === "investment")
      ? true
      : isCompleted
      ? false
      : null
  );
  const [investmentItems, setInvestmentItems] = useState<FinancialAssetItem[]>(
    initialData.filter((item) => item.category === "investment")
  );

  const [saving, setSaving] = useState(false);

  // 저축 항목 추가
  const addSavingsItem = () => {
    setSavingsItems([
      ...savingsItems,
      {
        category: "savings",
        type: "checking",
        title: "",
        owner: "self",
        currentBalance: 0,
      },
    ]);
  };

  // 투자 항목 추가
  const addInvestmentItem = () => {
    setInvestmentItems([
      ...investmentItems,
      {
        category: "investment",
        type: "domestic_stock",
        title: "",
        owner: "self",
        currentBalance: 0,
        expectedReturn: 7,
      },
    ]);
  };

  // 저축 항목 삭제
  const removeSavingsItem = (index: number) => {
    const updated = savingsItems.filter((_, i) => i !== index);
    setSavingsItems(updated);
    if (updated.length === 0) {
      setHasSavings(false);
    }
  };

  // 투자 항목 삭제
  const removeInvestmentItem = (index: number) => {
    const updated = investmentItems.filter((_, i) => i !== index);
    setInvestmentItems(updated);
    if (updated.length === 0) {
      setHasInvestment(false);
    }
  };

  // 저축 항목 업데이트
  const updateSavingsItem = (
    index: number,
    field: keyof FinancialAssetItem,
    value: string | number
  ) => {
    const updated = [...savingsItems];
    updated[index] = { ...updated[index], [field]: value };

    // 타입 변경 시 title 자동 설정
    if (field === "type") {
      const typeLabel = SAVINGS_TYPES.find((t) => t.value === value)?.label || "";
      const ownerLabel = updated[index].owner === "self" ? "본인" : "배우자";
      updated[index].title = `${ownerLabel} ${typeLabel}`;
    }
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
    field: keyof FinancialAssetItem,
    value: string | number
  ) => {
    const updated = [...investmentItems];
    updated[index] = { ...updated[index], [field]: value };

    // 타입 변경 시 title 자동 설정
    if (field === "type") {
      const typeLabel = INVESTMENT_TYPES.find((t) => t.value === value)?.label || "";
      const ownerLabel = updated[index].owner === "self" ? "본인" : "배우자";
      updated[index].title = `${ownerLabel} ${typeLabel}`;
    }
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
      total += item.currentBalance || 0;
    }
    for (const item of investmentItems) {
      total += item.currentBalance || 0;
    }
    return total;
  };

  // 저장
  const handleSave = async () => {
    if (hasSavings === null || hasInvestment === null) {
      alert("모든 항목을 선택해주세요.");
      return;
    }

    setSaving(true);
    try {
      const allItems: FinancialAssetItem[] = [
        ...(hasSavings ? savingsItems.filter((item) => item.currentBalance > 0) : []),
        ...(hasInvestment ? investmentItems.filter((item) => item.currentBalance > 0) : []),
      ];
      await onSave(allItems);
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const total = calculateTotal();
  const canSave = hasSavings !== null && hasInvestment !== null;

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
              <div className={styles.toggleGroup}>
                <button
                  className={`${styles.toggleBtn} ${hasSavings === false ? styles.active : ""}`}
                  onClick={() => {
                    setHasSavings(false);
                    setSavingsItems([]);
                  }}
                >
                  없음
                </button>
                <button
                  className={`${styles.toggleBtn} ${hasSavings === true ? styles.active : ""}`}
                  onClick={() => {
                    setHasSavings(true);
                    if (savingsItems.length === 0) {
                      addSavingsItem();
                    }
                  }}
                >
                  있음
                </button>
              </div>
            </div>
            <p className={styles.sectionHint}>입출금 통장, 적금, 예금</p>

            {hasSavings && (
              <div className={styles.itemList}>
                {savingsItems.map((item, index) => (
                  <div key={index} className={styles.assetItem}>
                    <div className={styles.itemTop}>
                      <select
                        className={styles.typeSelect}
                        value={item.type}
                        onChange={(e) =>
                          updateSavingsItem(index, "type", e.target.value)
                        }
                      >
                        {SAVINGS_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      {hasSpouse && (
                        <select
                          className={styles.ownerSelect}
                          value={item.owner}
                          onChange={(e) =>
                            updateSavingsItem(index, "owner", e.target.value as "self" | "spouse")
                          }
                        >
                          <option value="self">본인</option>
                          <option value="spouse">배우자</option>
                        </select>
                      )}
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeSavingsItem(index)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className={styles.itemRow}>
                      <span className={styles.itemLabel}>현재 잔액</span>
                      <div className={styles.inputGroup}>
                        <input
                          type="number"
                          className={styles.amountInput}
                          placeholder="0"
                          value={item.currentBalance || ""}
                          onChange={(e) =>
                            updateSavingsItem(index, "currentBalance", parseInt(e.target.value) || 0)
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.unit}>만원</span>
                      </div>
                    </div>
                  </div>
                ))}
                <button className={styles.addBtn} onClick={addSavingsItem}>
                  <Plus size={16} />
                  <span>저축 계좌 추가</span>
                </button>
              </div>
            )}
          </section>

          {/* 투자 계좌 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>투자 계좌</span>
              <div className={styles.toggleGroup}>
                <button
                  className={`${styles.toggleBtn} ${hasInvestment === false ? styles.active : ""}`}
                  onClick={() => {
                    setHasInvestment(false);
                    setInvestmentItems([]);
                  }}
                >
                  없음
                </button>
                <button
                  className={`${styles.toggleBtn} ${hasInvestment === true ? styles.active : ""}`}
                  onClick={() => {
                    setHasInvestment(true);
                    if (investmentItems.length === 0) {
                      addInvestmentItem();
                    }
                  }}
                >
                  있음
                </button>
              </div>
            </div>
            <p className={styles.sectionHint}>주식, 펀드, 채권, 암호화폐 등</p>

            {hasInvestment && (
              <div className={styles.itemList}>
                {investmentItems.map((item, index) => (
                  <div key={index} className={styles.assetItem}>
                    <div className={styles.itemTop}>
                      <select
                        className={styles.typeSelect}
                        value={item.type}
                        onChange={(e) =>
                          updateInvestmentItem(index, "type", e.target.value)
                        }
                      >
                        {INVESTMENT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      {hasSpouse && (
                        <select
                          className={styles.ownerSelect}
                          value={item.owner}
                          onChange={(e) =>
                            updateInvestmentItem(index, "owner", e.target.value as "self" | "spouse")
                          }
                        >
                          <option value="self">본인</option>
                          <option value="spouse">배우자</option>
                        </select>
                      )}
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeInvestmentItem(index)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className={styles.itemRow}>
                      <span className={styles.itemLabel}>현재 잔액</span>
                      <div className={styles.inputGroup}>
                        <input
                          type="number"
                          className={styles.amountInput}
                          placeholder="0"
                          value={item.currentBalance || ""}
                          onChange={(e) =>
                            updateInvestmentItem(index, "currentBalance", parseInt(e.target.value) || 0)
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.unit}>만원</span>
                      </div>
                    </div>
                    <div className={styles.itemRow}>
                      <span className={styles.itemLabel}>예상 수익률</span>
                      <div className={styles.inputGroup}>
                        <input
                          type="number"
                          className={styles.rateInput}
                          placeholder="0"
                          value={item.expectedReturn || ""}
                          onChange={(e) =>
                            updateInvestmentItem(index, "expectedReturn", parseFloat(e.target.value) || 0)
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          step="0.1"
                        />
                        <span className={styles.unit}>%</span>
                      </div>
                    </div>
                  </div>
                ))}
                <button className={styles.addBtn} onClick={addInvestmentItem}>
                  <Plus size={16} />
                  <span>투자 계좌 추가</span>
                </button>
              </div>
            )}
          </section>

          {/* 총 자산 */}
          {total > 0 && (
            <div className={styles.totalBox}>
              <span className={styles.totalLabel}>금융 자산 합계</span>
              <span className={styles.totalValue}>{total.toLocaleString()}만원</span>
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
