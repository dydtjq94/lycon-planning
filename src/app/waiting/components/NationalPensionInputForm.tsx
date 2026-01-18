"use client";

import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AmountInput } from "./inputs";
import type { NationalPensionData, PublicPensionType } from "../types";
import styles from "./PensionInputForm.module.css";

// 공적연금 유형
const PENSION_TYPES = [
  {
    value: "national",
    label: "국민연금",
    desc: "일반 국민",
    link: "https://csa.nps.or.kr/ohkd/ntpsidnty/anpninq/UHKD7101M0.do",
    linkText: "NPS 내연금 알아보기",
  },
  {
    value: "government",
    label: "공무원연금",
    desc: "공무원",
    link: "https://www.geps.or.kr",
    linkText: "공무원연금공단 (GEPS)",
  },
  {
    value: "military",
    label: "군인연금",
    desc: "직업군인",
    link: "https://www.mps.mil.kr",
    linkText: "국방부 군인연금",
  },
  {
    value: "private_school",
    label: "사학연금",
    desc: "사립학교 교직원",
    link: "https://www.tp.or.kr",
    linkText: "사학연금공단",
  },
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
            <p className={styles.guideTitle}>
              가입하신 연금을 선택하고, 해당 공단에서 예상 수령액을 조회해주세요.
            </p>
            <p className={styles.guideSubtitle}>
              지금 모르면 0원으로 넘어가도 괜찮아요. 언제든 수정할 수 있습니다.
            </p>
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

            {/* 선택한 연금 유형의 조회 링크 */}
            <a
              href={PENSION_TYPES.find((t) => t.value === selfType)?.link}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.lookupLink}
            >
              <ExternalLink size={14} />
              <span>{PENSION_TYPES.find((t) => t.value === selfType)?.linkText}에서 조회</span>
            </a>

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

              {/* 선택한 연금 유형의 조회 링크 */}
              <a
                href={PENSION_TYPES.find((t) => t.value === spouseType)?.link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.lookupLink}
              >
                <ExternalLink size={14} />
                <span>{PENSION_TYPES.find((t) => t.value === spouseType)?.linkText}에서 조회</span>
              </a>

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
