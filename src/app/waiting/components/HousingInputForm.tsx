"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { HousingData } from "../types";
import styles from "./HousingInputForm.module.css";

// 거주 형태 옵션
const HOUSING_TYPES = [
  { value: "자가", label: "자가" },
  { value: "전세", label: "전세" },
  { value: "월세", label: "월세 (반전세)" },
] as const;

// 상환 방식 옵션
const REPAYMENT_TYPES = [
  { value: "원리금균등", label: "원리금균등" },
  { value: "원금균등", label: "원금균등" },
  { value: "만기일시", label: "만기일시" },
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
  const [housingType, setHousingType] = useState<"자가" | "전세" | "월세" | null>(
    initialData?.housingType ?? null
  );

  // 자가
  const [currentValue, setCurrentValue] = useState(initialData?.currentValue ?? 0);

  // 전세/월세
  const [deposit, setDeposit] = useState(initialData?.deposit ?? 0);
  const [monthlyRent, setMonthlyRent] = useState(initialData?.monthlyRent ?? 0);

  // 공통
  const [maintenanceFee, setMaintenanceFee] = useState(initialData?.maintenanceFee ?? 0);

  // 대출
  const [hasLoan, setHasLoan] = useState<boolean | null>(
    initialData?.hasLoan ?? (isCompleted ? false : null)
  );
  const [loanAmount, setLoanAmount] = useState(initialData?.loanAmount ?? 0);
  const [loanRate, setLoanRate] = useState(initialData?.loanRate ?? 0);
  const [loanRateType, setLoanRateType] = useState<"fixed" | "floating">(
    initialData?.loanRateType ?? "fixed"
  );
  const [loanRepaymentType, setLoanRepaymentType] = useState(
    initialData?.loanRepaymentType ?? "원리금균등"
  );
  const [loanMaturityYear, setLoanMaturityYear] = useState(
    initialData?.loanMaturityYear ?? new Date().getFullYear() + 20
  );

  const [saving, setSaving] = useState(false);

  // 저장
  const handleSave = async () => {
    if (!housingType) {
      alert("거주 형태를 선택해주세요.");
      return;
    }
    if (hasLoan === null) {
      alert("대출 여부를 선택해주세요.");
      return;
    }

    setSaving(true);
    try {
      const data: HousingData = {
        housingType,
        currentValue: housingType === "자가" ? currentValue : undefined,
        deposit: housingType !== "자가" ? deposit : undefined,
        monthlyRent: housingType === "월세" ? monthlyRent : undefined,
        maintenanceFee: maintenanceFee > 0 ? maintenanceFee : undefined,
        hasLoan,
        loanType: hasLoan ? (housingType === "자가" ? "mortgage" : "jeonse") : undefined,
        loanAmount: hasLoan ? loanAmount : undefined,
        loanRate: hasLoan ? loanRate : undefined,
        loanRateType: hasLoan ? loanRateType : undefined,
        loanMaturityYear: hasLoan ? loanMaturityYear : undefined,
        loanRepaymentType: hasLoan ? loanRepaymentType : undefined,
      };
      await onSave(data);
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const canSave = housingType !== null && hasLoan !== null;
  const loanLabel = housingType === "자가" ? "주택담보대출" : "전월세보증금대출";

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onClose}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.headerTitle}>거주 부동산</h1>
          <div className={styles.headerSpacer} />
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
                    // 대출 여부 초기화
                    if (!isCompleted) setHasLoan(null);
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </section>

          {/* 자가 - 시세 */}
          {housingType === "자가" && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>현재 시세</span>
              </div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  className={styles.amountInput}
                  placeholder="0"
                  value={currentValue || ""}
                  onChange={(e) => setCurrentValue(parseInt(e.target.value) || 0)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
            </section>
          )}

          {/* 전세/월세 - 보증금 */}
          {(housingType === "전세" || housingType === "월세") && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>보증금</span>
              </div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  className={styles.amountInput}
                  placeholder="0"
                  value={deposit || ""}
                  onChange={(e) => setDeposit(parseInt(e.target.value) || 0)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
            </section>
          )}

          {/* 월세 - 월세금액 */}
          {housingType === "월세" && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>월세</span>
              </div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  className={styles.amountInput}
                  placeholder="0"
                  value={monthlyRent || ""}
                  onChange={(e) => setMonthlyRent(parseInt(e.target.value) || 0)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
            </section>
          )}

          {/* 관리비 */}
          {housingType && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>관리비</span>
              </div>
              <p className={styles.sectionHint}>없으면 0원</p>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  className={styles.amountInput}
                  placeholder="0"
                  value={maintenanceFee || ""}
                  onChange={(e) => setMaintenanceFee(parseInt(e.target.value) || 0)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
            </section>
          )}

          {/* 대출 여부 */}
          {housingType && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{loanLabel}</span>
                <div className={styles.toggleGroup}>
                  <button
                    className={`${styles.toggleBtn} ${hasLoan === false ? styles.active : ""}`}
                    onClick={() => setHasLoan(false)}
                  >
                    없음
                  </button>
                  <button
                    className={`${styles.toggleBtn} ${hasLoan === true ? styles.active : ""}`}
                    onClick={() => setHasLoan(true)}
                  >
                    있음
                  </button>
                </div>
              </div>

              {hasLoan && (
                <div className={styles.loanDetails}>
                  {/* 대출 잔액 */}
                  <div className={styles.loanRow}>
                    <span className={styles.loanLabel}>대출 잔액</span>
                    <div className={styles.inputRow}>
                      <input
                        type="number"
                        className={styles.amountInput}
                        placeholder="0"
                        value={loanAmount || ""}
                        onChange={(e) => setLoanAmount(parseInt(e.target.value) || 0)}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.unit}>만원</span>
                    </div>
                  </div>

                  {/* 금리 */}
                  <div className={styles.loanRow}>
                    <span className={styles.loanLabel}>금리</span>
                    <div className={styles.inputRow}>
                      <input
                        type="number"
                        className={styles.rateInput}
                        placeholder="0.0"
                        value={loanRate || ""}
                        onChange={(e) => setLoanRate(parseFloat(e.target.value) || 0)}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        step="0.1"
                      />
                      <span className={styles.unit}>%</span>
                      <div className={styles.rateToggle}>
                        <button
                          className={`${styles.rateBtn} ${loanRateType === "fixed" ? styles.active : ""}`}
                          onClick={() => setLoanRateType("fixed")}
                        >
                          고정
                        </button>
                        <button
                          className={`${styles.rateBtn} ${loanRateType === "floating" ? styles.active : ""}`}
                          onClick={() => setLoanRateType("floating")}
                        >
                          변동
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 상환 방식 */}
                  <div className={styles.loanRow}>
                    <span className={styles.loanLabel}>상환 방식</span>
                    <div className={styles.repaymentOptions}>
                      {REPAYMENT_TYPES.map((type) => (
                        <button
                          key={type.value}
                          className={`${styles.repaymentBtn} ${loanRepaymentType === type.value ? styles.active : ""}`}
                          onClick={() => setLoanRepaymentType(type.value)}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 만기 년도 */}
                  <div className={styles.loanRow}>
                    <span className={styles.loanLabel}>만기</span>
                    <div className={styles.inputRow}>
                      <input
                        type="number"
                        className={styles.yearInput}
                        value={loanMaturityYear}
                        onChange={(e) => setLoanMaturityYear(parseInt(e.target.value) || 2045)}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.unit}>년</span>
                    </div>
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
