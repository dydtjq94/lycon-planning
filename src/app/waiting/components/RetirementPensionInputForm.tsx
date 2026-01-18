"use client";

import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AmountInput } from "./inputs";
import type { RetirementPensionData, RetirementPensionType } from "../types";
import styles from "./PensionInputForm.module.css";

const PENSION_TYPES = [
  { value: "db", label: "퇴직금/DB형" },
  { value: "dc", label: "DC형" },
  { value: "none", label: "모름" },
] as const;

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
  // 본인
  const [selfType, setSelfType] = useState<RetirementPensionType>(
    initialData?.selfType ?? "db"
  );
  const [selfYearsWorked, setSelfYearsWorked] = useState<number | null>(
    initialData?.selfYearsWorked ?? null
  );
  const [selfBalance, setSelfBalance] = useState<number | null>(
    initialData?.selfBalance ?? null
  );

  // 배우자
  const [spouseType, setSpouseType] = useState<RetirementPensionType>(
    initialData?.spouseType ?? "db"
  );
  const [spouseYearsWorked, setSpouseYearsWorked] = useState<number | null>(
    initialData?.spouseYearsWorked ?? null
  );
  const [spouseBalance, setSpouseBalance] = useState<number | null>(
    initialData?.spouseBalance ?? null
  );

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        selfType,
        selfYearsWorked: selfType === "db" ? selfYearsWorked : null,
        selfBalance: selfType === "dc" ? selfBalance : null,
        spouseType,
        spouseYearsWorked: spouseType === "db" ? spouseYearsWorked : null,
        spouseBalance: spouseType === "dc" ? spouseBalance : null,
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
          {/* 안내 */}
          <div className={styles.pensionTypeGuide}>
            <p className={styles.guideTitle}>
              퇴직금/DB형은 회사가 관리하여 금액을 모르는 경우가 많아요.
            </p>
            <a
              href="https://100lifeplan.fss.or.kr"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.guideLinkInline}
            >
              <ExternalLink size={14} />
              <span>DC형은 통합연금포털에서 조회할 수 있어요</span>
            </a>
            <p className={styles.guideSubtitle}>
              지금 모르면 넘어가도 괜찮아요. 언제든 수정할 수 있습니다.
            </p>
          </div>

          {/* 본인 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>본인</span>
            </div>

            {/* 유형 선택 */}
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

            {/* DB형: 근속연수 입력 */}
            {selfType === "db" && (
              <div className={styles.itemFields}>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>현재 근속연수</span>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.smallInput}
                      value={selfYearsWorked ?? ""}
                      onChange={(e) =>
                        setSelfYearsWorked(e.target.value ? Number(e.target.value) : null)
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder="0"
                    />
                    <span className={styles.fieldUnit}>년</span>
                  </div>
                </div>
                <p className={styles.fieldHint}>
                  65세 은퇴 시점의 예상 퇴직금을 계산합니다
                </p>
              </div>
            )}

            {/* DC형: 현재 잔액 입력 */}
            {selfType === "dc" && (
              <div className={styles.itemFields}>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>현재 잔액</span>
                  <AmountInput
                    value={selfBalance}
                    onChange={setSelfBalance}
                  />
                </div>
              </div>
            )}
          </section>

          {/* 배우자 */}
          {hasSpouse && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>배우자</span>
              </div>

              {/* 유형 선택 */}
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

              {/* DB형: 근속연수 입력 */}
              {spouseType === "db" && (
                <div className={styles.itemFields}>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>현재 근속연수</span>
                    <div className={styles.inputWithUnit}>
                      <input
                        type="number"
                        className={styles.smallInput}
                        value={spouseYearsWorked ?? ""}
                        onChange={(e) =>
                          setSpouseYearsWorked(e.target.value ? Number(e.target.value) : null)
                        }
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        placeholder="0"
                      />
                      <span className={styles.fieldUnit}>년</span>
                    </div>
                  </div>
                  <p className={styles.fieldHint}>
                    65세 은퇴 시점의 예상 퇴직금을 계산합니다
                  </p>
                </div>
              )}

              {/* DC형: 현재 잔액 입력 */}
              {spouseType === "dc" && (
                <div className={styles.itemFields}>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>현재 잔액</span>
                    <AmountInput
                      value={spouseBalance}
                      onChange={setSpouseBalance}
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
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
