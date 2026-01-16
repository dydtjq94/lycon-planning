"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AmountInput } from "./inputs";
import type { RetirementPensionData } from "../types";
import styles from "./PensionInputForm.module.css";

interface RetirementPensionInputFormProps {
  hasSpouse: boolean;
  initialData: RetirementPensionData | null;
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: RetirementPensionData) => Promise<void>;
}

export function RetirementPensionInputForm({
  hasSpouse,
  initialData,
  isCompleted,
  onClose,
  onSave,
}: RetirementPensionInputFormProps) {
  const [selfBalance, setSelfBalance] = useState<number | null>(
    initialData?.selfBalance ?? null
  );
  const [spouseBalance, setSpouseBalance] = useState<number | null>(
    initialData?.spouseBalance ?? null
  );

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        selfBalance: selfBalance ?? 0,
        spouseBalance: spouseBalance ?? 0,
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
          <h1 className={styles.headerTitle}>퇴직연금/퇴직금</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          <section className={styles.section}>
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
                      value={selfBalance}
                      onChange={setSelfBalance}
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
                        value={spouseBalance}
                        onChange={setSpouseBalance}
                      />
                    </div>
                  </div>
                </div>
              )}
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
