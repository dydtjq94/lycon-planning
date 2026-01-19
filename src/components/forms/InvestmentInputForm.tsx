"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import type { InvestmentAccountData } from "./types";
import { AmountInput, RateInput, OwnerSelect } from "./inputs";
import styles from "./InvestmentInputForm.module.css";

// 투자 계좌 유형
const ACCOUNT_TYPES = [
  { value: "securities", label: "증권 계좌" },
  { value: "crypto", label: "코인 거래소" },
  { value: "gold", label: "금 현물" },
] as const;

// 증권 계좌 투자 유형
const INVESTMENT_TYPES = [
  { value: "domestic_stock", label: "국내 주식" },
  { value: "foreign_stock", label: "해외 주식" },
  { value: "domestic_etf", label: "국내 ETF" },
  { value: "foreign_etf", label: "해외 ETF" },
  { value: "fund", label: "펀드" },
  { value: "bond", label: "채권" },
] as const;

interface InvestmentFormItem {
  type: string;
  title: string;
  owner: "self" | "spouse";
  balance: number | null;
  investmentTypes?: string[];
  expectedReturn?: number | null;
}

interface InvestmentInputFormProps {
  hasSpouse: boolean;
  initialData: InvestmentAccountData | null;
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: InvestmentAccountData) => Promise<void>;
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
    const result: InvestmentFormItem[] = [];

    if (initialData?.securities) {
      result.push({
        type: "securities",
        title: "본인 증권 계좌",
        owner: "self",
        balance: initialData.securities.balance ?? null,
        investmentTypes: initialData.securities.investmentTypes ?? [],
        expectedReturn: null,
      });
    }

    if (initialData?.crypto) {
      result.push({
        type: "crypto",
        title: "본인 코인 거래소",
        owner: "self",
        balance: initialData.crypto.balance ?? null,
        expectedReturn: null,
      });
    }

    if (initialData?.gold) {
      result.push({
        type: "gold",
        title: "본인 금 현물",
        owner: "self",
        balance: initialData.gold.balance ?? null,
        expectedReturn: null,
      });
    }

    return result;
  });

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
        balance: null,
        investmentTypes: type === "securities" ? [] : undefined,
        expectedReturn: null,
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
    value: string | number | string[] | null
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

  // 투자 유형 토글
  const toggleInvestmentType = (index: number, type: string) => {
    const item = items[index];
    const types = item.investmentTypes || [];
    if (types.includes(type)) {
      updateItem(index, "investmentTypes", types.filter((t) => t !== type));
    } else {
      updateItem(index, "investmentTypes", [...types, type]);
    }
  };

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      const data: InvestmentAccountData = {};

      for (const item of items) {
        if (item.balance !== null && item.balance > 0) {
          if (item.type === "securities") {
            data.securities = {
              balance: item.balance,
              investmentTypes: item.investmentTypes || [],
            };
          } else if (item.type === "crypto") {
            data.crypto = { balance: item.balance };
          } else if (item.type === "gold") {
            data.gold = { balance: item.balance };
          }
        }
      }

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
          <button className={styles.backButton} onClick={onClose}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.headerTitle}>투자 계좌</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          <p className={styles.sectionHint}>
            주식, 코인 등 현재 보유 중인 투자 자산을 추가해주세요
          </p>

          {/* 추가된 항목들 */}
          {items.length > 0 && (
            <div className={styles.itemList}>
              {items.map((item, index) => {
                const typeLabel = ACCOUNT_TYPES.find((t) => t.value === item.type)?.label || "";
                const isSecurities = item.type === "securities";

                return (
                  <div key={index} className={styles.investmentItem}>
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
                        <span className={styles.fieldLabel}>평가금액</span>
                        <AmountInput
                          value={item.balance}
                          onChange={(v) => updateItem(index, "balance", v)}
                        />
                      </div>
                      <div className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>현재 수익률</span>
                        <RateInput
                          value={item.expectedReturn ?? null}
                          onChange={(v) => updateItem(index, "expectedReturn", v)}
                        />
                      </div>
                      {isSecurities && (
                        <div className={styles.investmentTypesRow}>
                          <div className={styles.fieldLabelRow}>
                            <span className={styles.fieldLabel}>보유 투자</span>
                            <span className={styles.fieldHint}>여러 개 선택 가능</span>
                          </div>
                          <div className={styles.typeChips}>
                            {INVESTMENT_TYPES.map((type) => (
                              <button
                                key={type.value}
                                className={`${styles.typeChip} ${
                                  item.investmentTypes?.includes(type.value) ? styles.active : ""
                                }`}
                                onClick={() => toggleInvestmentType(index, type.value)}
                              >
                                {type.label}
                              </button>
                            ))}
                          </div>
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
