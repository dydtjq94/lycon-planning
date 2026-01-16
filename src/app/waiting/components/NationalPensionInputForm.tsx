"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AmountInput } from "./inputs";
import type { NationalPensionData, PublicPensionType } from "../types";
import styles from "./PensionInputForm.module.css";

// 공적연금 유형
const PENSION_TYPES = [
  { value: "national", label: "국민연금", desc: "일반 국민" },
  { value: "government", label: "공무원연금", desc: "공무원" },
  { value: "military", label: "군인연금", desc: "직업군인" },
  { value: "private_school", label: "사학연금", desc: "사립학교 교직원" },
] as const;

interface NationalPensionInputFormProps {
  hasSpouse: boolean;
  initialData: NationalPensionData | null;
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: NationalPensionData) => Promise<void>;
}

export function NationalPensionInputForm({
  hasSpouse,
  initialData,
  isCompleted,
  onClose,
  onSave,
}: NationalPensionInputFormProps) {
  // 본인
  const [selfType, setSelfType] = useState<PublicPensionType>(
    initialData?.selfType ?? "national"
  );
  const [selfAmount, setSelfAmount] = useState<number | null>(
    initialData?.selfExpectedAmount ?? null
  );

  // 배우자
  const [spouseType, setSpouseType] = useState<PublicPensionType>(
    initialData?.spouseType ?? "national"
  );
  const [spouseAmount, setSpouseAmount] = useState<number | null>(
    initialData?.spouseExpectedAmount ?? null
  );

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        selfType,
        selfExpectedAmount: selfAmount ?? 0,
        spouseType,
        spouseExpectedAmount: spouseAmount ?? 0,
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
          <h1 className={styles.headerTitle}>국민(공적)연금</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          {/* 연금 유형 안내 */}
          <div className={styles.pensionTypeGuide}>
            {PENSION_TYPES.map((type) => (
              <div key={type.value} className={styles.pensionTypeRow}>
                <span className={styles.pensionTypeName}>{type.label}</span>
                <span className={styles.pensionTypeDesc}>{type.desc}</span>
              </div>
            ))}
          </div>

          {/* 본인 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>본인</span>
            </div>

            {/* 연금 유형 선택 */}
            <div className={styles.typeChips}>
              {PENSION_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={`${styles.typeChip} ${selfType === type.value ? styles.active : ""}`}
                  onClick={() => setSelfType(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div className={styles.itemFields}>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>예상 수령액</span>
                <AmountInput
                  value={selfAmount}
                  onChange={setSelfAmount}
                  showFormatted={false}
                />
                <span className={styles.fieldUnit}>/월</span>
              </div>
            </div>
          </section>

          {/* 배우자 */}
          {hasSpouse && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>배우자</span>
              </div>

              {/* 연금 유형 선택 */}
              <div className={styles.typeChips}>
                {PENSION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    className={`${styles.typeChip} ${spouseType === type.value ? styles.active : ""}`}
                    onClick={() => setSpouseType(type.value)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <div className={styles.itemFields}>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>예상 수령액</span>
                  <AmountInput
                    value={spouseAmount}
                    onChange={setSpouseAmount}
                    showFormatted={false}
                  />
                  <span className={styles.fieldUnit}>/월</span>
                </div>
              </div>
            </section>
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
