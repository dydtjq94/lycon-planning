"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import type { Savings, SavingsType, Owner } from "@/types/tables";
import styles from "./SavingsInputForm.module.css";

// 금융자산 타입 정의
const SAVINGS_TYPES: { value: SavingsType; label: string; category: "savings" | "investment" }[] = [
  { value: "checking", label: "입출금", category: "savings" },
  { value: "savings", label: "적금", category: "savings" },
  { value: "deposit", label: "예금", category: "savings" },
  { value: "domestic_stock", label: "국내주식", category: "investment" },
  { value: "foreign_stock", label: "해외주식", category: "investment" },
  { value: "fund", label: "펀드", category: "investment" },
  { value: "bond", label: "채권", category: "investment" },
  { value: "crypto", label: "코인", category: "investment" },
  { value: "other", label: "기타", category: "investment" },
];

export interface SavingsFormData {
  id?: string;
  type: SavingsType;
  title: string;
  owner: Owner;
  current_balance: number;
  monthly_contribution: number | null;
  contribution_start_year: number | null;
  contribution_start_month: number | null;
  contribution_end_year: number | null;
  contribution_end_month: number | null;
  is_contribution_fixed_to_retirement: boolean;
  interest_rate: number | null;
  expected_return: number | null;
  maturity_year: number | null;
  maturity_month: number | null;
}

interface SavingsInputFormProps {
  missionType: "savings" | "investment" | "all";
  missionNumber: number;
  simulationId: string;
  existingData: Savings[];
  onComplete: (data: SavingsFormData[]) => void;
  onSkip: () => void;
  onBack: () => void;
}

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

function createEmptySavings(missionType: "savings" | "investment" | "all"): SavingsFormData {
  return {
    type: missionType === "investment" ? "domestic_stock" : "checking",
    title: "",
    owner: "self",
    current_balance: 0,
    monthly_contribution: null,
    contribution_start_year: currentYear,
    contribution_start_month: currentMonth,
    contribution_end_year: null,
    contribution_end_month: null,
    is_contribution_fixed_to_retirement: false,
    interest_rate: null,
    expected_return: null,
    maturity_year: null,
    maturity_month: null,
  };
}

function isSavingsType(type: SavingsType): boolean {
  return ["checking", "savings", "deposit"].includes(type);
}

export function SavingsInputForm({
  missionType,
  missionNumber,
  simulationId,
  existingData,
  onComplete,
  onSkip,
  onBack,
}: SavingsInputFormProps) {
  const [items, setItems] = useState<SavingsFormData[]>([createEmptySavings(missionType)]);
  const [hasNoAsset, setHasNoAsset] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTypes = missionType === "all"
    ? SAVINGS_TYPES
    : SAVINGS_TYPES.filter((t) => t.category === missionType);

  useEffect(() => {
    if (existingData && existingData.length > 0) {
      const filtered = missionType === "all"
        ? existingData
        : existingData.filter((s) => {
            const typeInfo = SAVINGS_TYPES.find((t) => t.value === s.type);
            return typeInfo?.category === missionType;
          });

      if (filtered.length > 0) {
        setItems(
          filtered.map((s) => ({
            id: s.id,
            type: s.type,
            title: s.title,
            owner: s.owner,
            current_balance: s.current_balance,
            monthly_contribution: s.monthly_contribution,
            contribution_start_year: s.contribution_start_year,
            contribution_start_month: s.contribution_start_month,
            contribution_end_year: s.contribution_end_year,
            contribution_end_month: s.contribution_end_month,
            is_contribution_fixed_to_retirement: s.is_contribution_fixed_to_retirement,
            interest_rate: s.interest_rate,
            expected_return: s.expected_return,
            maturity_year: s.maturity_year,
            maturity_month: s.maturity_month,
          }))
        );
      }
    }
  }, [existingData, missionType]);

  const handleAddItem = () => {
    setItems([...items, createEmptySavings(missionType)]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleUpdateItem = (
    index: number,
    field: keyof SavingsFormData,
    value: unknown
  ) => {
    setItems(
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleNoAssetToggle = () => {
    if (!hasNoAsset) {
      setItems([]);
    } else {
      setItems([createEmptySavings(missionType)]);
    }
    setHasNoAsset(!hasNoAsset);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const validItems = hasNoAsset
        ? []
        : items.filter((item) => item.current_balance > 0 || item.title);
      await onComplete(validItems);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalBalance = items.reduce((sum, item) => sum + (item.current_balance || 0), 0);

  const titleText = missionType === "all" ? "자산" : missionType === "savings" ? "저축 계좌" : "투자 계좌";
  const descText = missionType === "all"
    ? "보유한 금융자산을 입력해주세요."
    : missionType === "savings"
    ? "보유한 저축 계좌를 입력해주세요."
    : "보유한 투자 자산을 입력해주세요.";
  const noAssetText = "자산 없음";
  const addText = "자산 추가";

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.missionNumber}>Mission {missionNumber}</span>
          <h1 className={styles.title}>{titleText}</h1>
          <p className={styles.description}>{descText}</p>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className={styles.content}>
        {/* 없음 토글 */}
        <button
          className={`${styles.noAssetBtn} ${hasNoAsset ? styles.active : ""}`}
          onClick={handleNoAssetToggle}
        >
          {noAssetText}
        </button>

        {!hasNoAsset && (
          <>
            {/* 총액 */}
            {totalBalance > 0 && (
              <div className={styles.totalBar}>
                <span>총액</span>
                <span className={styles.totalValue}>{formatMoney(totalBalance)}</span>
              </div>
            )}

            {/* 항목 리스트 */}
            {items.map((item, index) => (
              <div key={index} className={styles.itemRow}>
                {/* 타입 선택 */}
                <div className={styles.typeButtons}>
                  {filteredTypes.map((type) => (
                    <button
                      key={type.value}
                      className={`${styles.typeBtn} ${item.type === type.value ? styles.selected : ""}`}
                      onClick={() => handleUpdateItem(index, "type", type.value)}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                {/* 입력 필드들 */}
                <div className={styles.inputFields}>
                  {/* 소유자 */}
                  <div className={styles.ownerGroup}>
                    <button
                      className={`${styles.ownerBtn} ${item.owner === "self" ? styles.selected : ""}`}
                      onClick={() => handleUpdateItem(index, "owner", "self")}
                    >
                      본인
                    </button>
                    <button
                      className={`${styles.ownerBtn} ${item.owner === "spouse" ? styles.selected : ""}`}
                      onClick={() => handleUpdateItem(index, "owner", "spouse")}
                    >
                      배우자
                    </button>
                  </div>

                  {/* 잔액 */}
                  <div className={styles.inputGroup}>
                    <input
                      type="number"
                      className={styles.input}
                      placeholder="잔액"
                      value={item.current_balance || ""}
                      onChange={(e) =>
                        handleUpdateItem(index, "current_balance", e.target.value ? parseInt(e.target.value) : 0)
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>

                  {/* 이자율/수익률 */}
                  {item.type !== "checking" && (
                    <div className={styles.inputGroup}>
                      <input
                        type="number"
                        className={styles.inputSmall}
                        placeholder={isSavingsType(item.type) ? "이자" : "수익률"}
                        step="0.1"
                        value={isSavingsType(item.type) ? (item.interest_rate || "") : (item.expected_return || "")}
                        onChange={(e) =>
                          handleUpdateItem(
                            index,
                            isSavingsType(item.type) ? "interest_rate" : "expected_return",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.unit}>%</span>
                    </div>
                  )}

                  {/* 삭제 버튼 */}
                  {items.length > 1 && (
                    <button className={styles.removeBtn} onClick={() => handleRemoveItem(index)}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* 추가 버튼 */}
            <button className={styles.addButton} onClick={handleAddItem}>
              <Plus size={16} />
              {addText}
            </button>
          </>
        )}
      </div>

      {/* 하단 */}
      <div className={styles.footer}>
        <button className={styles.skipButton} onClick={onSkip}>
          건너뛰기
        </button>
        <button
          className={styles.submitButton}
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "저장 중..." : "완료"}
        </button>
      </div>
    </div>
  );
}
