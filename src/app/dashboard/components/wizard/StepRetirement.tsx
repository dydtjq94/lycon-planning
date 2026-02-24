"use client";

import type { StepProps } from "./types";
import styles from "./StepRetirement.module.css";

export function StepRetirement({ data, onChange }: StepProps) {
  const { retirement, family } = data;
  const hasSpouse = family.hasSpouse;
  const spouseName = family.spouseName || "배우자";

  const updateRetirement = (updates: Partial<typeof retirement>) => {
    onChange({ retirement: { ...retirement, ...updates } });
  };

  const handleSpouseWorkingToggle = (isWorking: boolean) => {
    updateRetirement({
      spouseIsWorking: isWorking,
      spouseRetirementAge: isWorking ? (retirement.spouseRetirementAge ?? 65) : null,
    });
  };

  return (
    <div className={styles.root}>
      {/* 본인 섹션 */}
      <section className={styles.section}>
        <span className={styles.sectionLabel}>본인</span>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>은퇴 나이</label>
          <div className={styles.ageInputWrapper}>
            <input
              type="number"
              className={styles.ageInput}
              value={retirement.retirementAge ?? ""}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                updateRetirement({ retirementAge: isNaN(val) ? null : val });
              }}
              onWheel={(e) => (e.target as HTMLElement).blur()}
            />
            <span className={styles.unit}>세</span>
          </div>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>기대수명</label>
          <div className={styles.ageInputWrapper}>
            <input
              type="number"
              className={styles.ageInput}
              value={retirement.lifeExpectancy ?? ""}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                updateRetirement({ lifeExpectancy: isNaN(val) ? null : val });
              }}
              onWheel={(e) => (e.target as HTMLElement).blur()}
            />
            <span className={styles.unit}>세</span>
          </div>
        </div>
      </section>

      {/* 배우자 섹션 */}
      {hasSpouse && (
        <section className={styles.section}>
          <span className={styles.sectionLabel}>{spouseName}</span>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>근로 여부</label>
            <div className={styles.pillGroup}>
              <button
                type="button"
                className={`${styles.pill} ${retirement.spouseIsWorking ? styles.pillActive : ""}`}
                onClick={() => handleSpouseWorkingToggle(true)}
              >
                일하고 있음
              </button>
              <button
                type="button"
                className={`${styles.pill} ${!retirement.spouseIsWorking ? styles.pillActive : ""}`}
                onClick={() => handleSpouseWorkingToggle(false)}
              >
                일하고 있지 않음
              </button>
            </div>
          </div>

          {retirement.spouseIsWorking && (
            <div className={styles.animatedField}>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>은퇴 나이</label>
                <div className={styles.ageInputWrapper}>
                  <input
                    type="number"
                    className={styles.ageInput}
                    value={retirement.spouseRetirementAge ?? ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateRetirement({ spouseRetirementAge: isNaN(val) ? null : val });
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>세</span>
                </div>
              </div>
            </div>
          )}

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>기대수명</label>
            <div className={styles.ageInputWrapper}>
              <input
                type="number"
                className={styles.ageInput}
                value={retirement.spouseLifeExpectancy ?? ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  updateRetirement({ spouseLifeExpectancy: isNaN(val) ? null : val });
                }}
                onWheel={(e) => (e.target as HTMLElement).blur()}
              />
              <span className={styles.unit}>세</span>
            </div>
          </div>

          {!retirement.spouseIsWorking && (
            <p className={styles.hint}>
              은퇴 나이가 설정되지 않으면 본인의 은퇴 나이가 기준이 됩니다
            </p>
          )}
        </section>
      )}
    </div>
  );
}
