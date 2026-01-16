"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AmountInput, ToggleGroup } from "./inputs";
import styles from "./PensionInputForm.module.css";

export interface PensionFormData {
  // 국민연금
  hasNationalPension: boolean;
  selfNationalPensionExpected: number; // 월 예상 수령액
  spouseNationalPensionExpected: number;
  // 퇴직연금
  hasRetirementPension: boolean;
  selfRetirementBalance: number; // 현재 잔액
  spouseRetirementBalance: number;
  // 개인연금
  hasPersonalPension: boolean;
  selfPersonalBalance: number;
  selfPersonalMonthly: number; // 월 납입액
  spousePersonalBalance: number;
  spousePersonalMonthly: number;
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
  const [hasNationalPension, setHasNationalPension] = useState<boolean | null>(
    initialData?.hasNationalPension ?? (isCompleted ? false : null)
  );
  const [selfNationalPensionExpected, setSelfNationalPensionExpected] = useState(
    initialData?.selfNationalPensionExpected ?? 0
  );
  const [spouseNationalPensionExpected, setSpouseNationalPensionExpected] = useState(
    initialData?.spouseNationalPensionExpected ?? 0
  );

  // 퇴직연금
  const [hasRetirementPension, setHasRetirementPension] = useState<boolean | null>(
    initialData?.hasRetirementPension ?? (isCompleted ? false : null)
  );
  const [selfRetirementBalance, setSelfRetirementBalance] = useState(
    initialData?.selfRetirementBalance ?? 0
  );
  const [spouseRetirementBalance, setSpouseRetirementBalance] = useState(
    initialData?.spouseRetirementBalance ?? 0
  );

  // 개인연금
  const [hasPersonalPension, setHasPersonalPension] = useState<boolean | null>(
    initialData?.hasPersonalPension ?? (isCompleted ? false : null)
  );
  const [selfPersonalBalance, setSelfPersonalBalance] = useState(
    initialData?.selfPersonalBalance ?? 0
  );
  const [selfPersonalMonthly, setSelfPersonalMonthly] = useState(
    initialData?.selfPersonalMonthly ?? 0
  );
  const [spousePersonalBalance, setSpousePersonalBalance] = useState(
    initialData?.spousePersonalBalance ?? 0
  );
  const [spousePersonalMonthly, setSpousePersonalMonthly] = useState(
    initialData?.spousePersonalMonthly ?? 0
  );

  const [saving, setSaving] = useState(false);

  // 저장
  const handleSave = async () => {
    if (hasNationalPension === null || hasRetirementPension === null || hasPersonalPension === null) {
      alert("모든 항목을 선택해주세요.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        hasNationalPension,
        selfNationalPensionExpected: hasNationalPension ? selfNationalPensionExpected : 0,
        spouseNationalPensionExpected: hasNationalPension && hasSpouse ? spouseNationalPensionExpected : 0,
        hasRetirementPension,
        selfRetirementBalance: hasRetirementPension ? selfRetirementBalance : 0,
        spouseRetirementBalance: hasRetirementPension && hasSpouse ? spouseRetirementBalance : 0,
        hasPersonalPension,
        selfPersonalBalance: hasPersonalPension ? selfPersonalBalance : 0,
        selfPersonalMonthly: hasPersonalPension ? selfPersonalMonthly : 0,
        spousePersonalBalance: hasPersonalPension && hasSpouse ? spousePersonalBalance : 0,
        spousePersonalMonthly: hasPersonalPension && hasSpouse ? spousePersonalMonthly : 0,
      });
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    hasNationalPension !== null &&
    hasRetirementPension !== null &&
    hasPersonalPension !== null;

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
          {/* 국민연금 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>국민연금</span>
              <ToggleGroup
                value={hasNationalPension}
                onChange={setHasNationalPension}
              />
            </div>
            <p className={styles.sectionHint}>예상 월 수령액 (국민연금공단 조회)</p>

            {hasNationalPension && (
              <div className={styles.inputList}>
                <div className={styles.inputRow}>
                  <span className={styles.inputLabel}>본인</span>
                  <AmountInput
                    value={selfNationalPensionExpected}
                    onChange={(v) => setSelfNationalPensionExpected(v ?? 0)}
                    showFormatted={false}
                  />
                </div>
                {hasSpouse && (
                  <div className={styles.inputRow}>
                    <span className={styles.inputLabel}>배우자</span>
                    <AmountInput
                      value={spouseNationalPensionExpected}
                      onChange={(v) => setSpouseNationalPensionExpected(v ?? 0)}
                      showFormatted={false}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 퇴직연금 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>퇴직연금</span>
              <ToggleGroup
                value={hasRetirementPension}
                onChange={setHasRetirementPension}
              />
            </div>
            <p className={styles.sectionHint}>DC형/IRP 현재 적립금</p>

            {hasRetirementPension && (
              <div className={styles.inputList}>
                <div className={styles.inputRow}>
                  <span className={styles.inputLabel}>본인</span>
                  <AmountInput
                    value={selfRetirementBalance}
                    onChange={(v) => setSelfRetirementBalance(v ?? 0)}
                  />
                </div>
                {hasSpouse && (
                  <div className={styles.inputRow}>
                    <span className={styles.inputLabel}>배우자</span>
                    <AmountInput
                      value={spouseRetirementBalance}
                      onChange={(v) => setSpouseRetirementBalance(v ?? 0)}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 개인연금 섹션 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>개인연금</span>
              <ToggleGroup
                value={hasPersonalPension}
                onChange={setHasPersonalPension}
              />
            </div>
            <p className={styles.sectionHint}>연금저축, IRP 등</p>

            {hasPersonalPension && (
              <div className={styles.inputList}>
                {/* 본인 */}
                <div className={styles.personSection}>
                  <span className={styles.personLabel}>본인</span>
                  <div className={styles.inputRow}>
                    <span className={styles.inputLabel}>적립금</span>
                    <AmountInput
                      value={selfPersonalBalance}
                      onChange={(v) => setSelfPersonalBalance(v ?? 0)}
                    />
                  </div>
                  <div className={styles.inputRow}>
                    <span className={styles.inputLabel}>월 납입</span>
                    <AmountInput
                      value={selfPersonalMonthly}
                      onChange={(v) => setSelfPersonalMonthly(v ?? 0)}
                      showFormatted={false}
                    />
                  </div>
                </div>

                {/* 배우자 */}
                {hasSpouse && (
                  <div className={styles.personSection}>
                    <span className={styles.personLabel}>배우자</span>
                    <div className={styles.inputRow}>
                      <span className={styles.inputLabel}>적립금</span>
                      <AmountInput
                        value={spousePersonalBalance}
                        onChange={(v) => setSpousePersonalBalance(v ?? 0)}
                      />
                    </div>
                    <div className={styles.inputRow}>
                      <span className={styles.inputLabel}>월 납입</span>
                      <AmountInput
                        value={spousePersonalMonthly}
                        onChange={(v) => setSpousePersonalMonthly(v ?? 0)}
                        showFormatted={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
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
