"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { HousingData } from "../types";
import { AmountInput, RateInput, ToggleGroup } from "./inputs";
import styles from "./HousingInputForm.module.css";

// 거주 형태 옵션
const HOUSING_TYPES = [
  { value: "자가", label: "자가" },
  { value: "전세", label: "전세" },
  { value: "월세", label: "월세 (반전세)" },
  { value: "무상", label: "무상 거주", hint: "부모님 집, 사택 등" },
] as const;

interface HousingInputFormProps {
  initialData?: HousingData | null;
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: HousingData) => Promise<void>;
}

export function HousingInputForm({
  initialData,
  isCompleted,
  onClose,
  onSave,
}: HousingInputFormProps) {
  // 거주 형태
  const [housingType, setHousingType] = useState<"자가" | "전세" | "월세" | "무상" | null>(
    initialData?.housingType ?? null
  );

  // 자가
  const [currentValue, setCurrentValue] = useState<number | null>(initialData?.currentValue ?? null);

  // 전세/월세
  const [deposit, setDeposit] = useState<number | null>(initialData?.deposit ?? null);
  const [monthlyRent, setMonthlyRent] = useState<number | null>(initialData?.monthlyRent ?? null);

  // 공통
  const [maintenanceFee, setMaintenanceFee] = useState<number | null>(initialData?.maintenanceFee ?? null);

  // 대출
  const [hasLoan, setHasLoan] = useState<boolean | null>(
    initialData?.hasLoan ?? (isCompleted ? false : null)
  );
  const [loanAmount, setLoanAmount] = useState<number | null>(initialData?.loanAmount ?? null);
  const [loanRate, setLoanRate] = useState<number | null>(initialData?.loanRate ?? null);

  const [saving, setSaving] = useState(false);

  // 저장
  const handleSave = async () => {
    if (!housingType) {
      alert("거주 형태를 선택해주세요.");
      return;
    }
    // 무상 거주가 아닌 경우에만 대출 여부 확인
    if (housingType !== "무상" && hasLoan === null) {
      alert("대출 여부를 선택해주세요.");
      return;
    }

    setSaving(true);
    try {
      const data: HousingData = {
        housingType,
        currentValue: housingType === "자가" ? (currentValue ?? undefined) : undefined,
        deposit: (housingType === "전세" || housingType === "월세") ? (deposit ?? undefined) : undefined,
        monthlyRent: housingType === "월세" ? (monthlyRent ?? undefined) : undefined,
        maintenanceFee: maintenanceFee && maintenanceFee > 0 ? maintenanceFee : undefined,
        hasLoan: housingType === "무상" ? false : !!hasLoan,
        loanType: hasLoan ? (housingType === "자가" ? "mortgage" : "jeonse") : undefined,
        loanAmount: hasLoan ? (loanAmount ?? undefined) : undefined,
        loanRate: hasLoan ? (loanRate ?? undefined) : undefined,
      };
      await onSave(data);
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 무상 거주는 대출이 없으므로 바로 저장 가능
  const canSave = housingType !== null && (housingType === "무상" || hasLoan !== null);
  const loanLabel = housingType === "자가" ? "주택담보대출" : "전월세보증금대출";

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>거주 부동산</h1>
          <button className={styles.closeButton} onClick={onClose}>
            <ChevronDown size={24} />
          </button>
        </header>

        <main className={styles.main}>
          {/* 거주 형태 선택 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>거주 형태</span>
            </div>
            <div className={styles.typeOptions}>
              {HOUSING_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={`${styles.typeBtn} ${housingType === type.value ? styles.active : ""}`}
                  onClick={() => {
                    setHousingType(type.value);
                    // 무상 거주는 대출 없음
                    if (type.value === "무상") {
                      setHasLoan(false);
                    } else if (!isCompleted) {
                      setHasLoan(null);
                    }
                  }}
                >
                  {type.label}
                  {"hint" in type && <span className={styles.typeHint}>({type.hint})</span>}
                </button>
              ))}
            </div>
          </section>

          {/* 자가 - 시세 */}
          {housingType === "자가" && (
            <section className={styles.section}>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>현재 시세</span>
                <AmountInput
                  value={currentValue}
                  onChange={(v) => setCurrentValue(v || null)}
                />
              </div>
            </section>
          )}

          {/* 전세/월세 - 보증금 */}
          {(housingType === "전세" || housingType === "월세") && (
            <section className={styles.section}>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>보증금</span>
                <AmountInput
                  value={deposit}
                  onChange={(v) => setDeposit(v || null)}
                />
              </div>
            </section>
          )}

          {/* 월세 - 월세금액 */}
          {housingType === "월세" && (
            <section className={styles.section}>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>월세</span>
                <AmountInput
                  value={monthlyRent}
                  onChange={(v) => setMonthlyRent(v || null)}
                />
              </div>
            </section>
          )}

          {/* 관리비 */}
          {housingType && (
            <section className={styles.section}>
              <div className={styles.fieldRow}>
                <div className={styles.fieldInfo}>
                  <span className={styles.fieldLabel}>관리비</span>
                  <span className={styles.fieldHint}>없으면 비워두세요</span>
                </div>
                <AmountInput
                  value={maintenanceFee}
                  onChange={(v) => setMaintenanceFee(v || null)}
                  placeholder="0"
                />
              </div>
            </section>
          )}

          {/* 대출 여부 (무상 거주 제외) */}
          {housingType && housingType !== "무상" && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{loanLabel}</span>
                <ToggleGroup
                  value={hasLoan}
                  onChange={setHasLoan}
                />
              </div>

              {hasLoan && (
                <div className={styles.loanDetails}>
                  {/* 대출 잔액 */}
                  <div className={styles.loanRow}>
                    <span className={styles.loanLabel}>남은 금액</span>
                    <AmountInput
                      value={loanAmount}
                      onChange={(v) => setLoanAmount(v || null)}
                    />
                  </div>

                  {/* 금리 */}
                  <div className={styles.loanRow}>
                    <span className={styles.loanLabel}>금리</span>
                    <RateInput
                      value={loanRate}
                      onChange={(v) => setLoanRate(v || null)}
                    />
                  </div>
                </div>
              )}
            </section>
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
