"use client";

import type { StepProps, WizardData } from "./types";
import styles from "./StepPension.module.css";

type PensionType = WizardData["pension"]["selfType"];

const PENSION_TYPES: { value: PensionType; label: string }[] = [
  { value: "national", label: "국민" },
  { value: "government", label: "공무원" },
  { value: "military", label: "군인" },
  { value: "private_school", label: "사학" },
];

export function StepPension({ data, onChange }: StepProps) {
  const pension = data.pension?.selfType
    ? data.pension
    : { selfType: "national" as const, selfExpectedAmount: null, selfStartAge: 65, spouseType: "national" as const, spouseExpectedAmount: null, spouseStartAge: null };
  const hasSpouse = data.family.hasSpouse;

  const updatePension = (updates: Partial<typeof pension>) => {
    onChange({ pension: { ...pension, ...updates } });
  };

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>공적연금</div>

        {/* 본인 */}
        <div className={styles.personBlock}>
          <div className={styles.row}>
            <span className={styles.ownerLabel}>본인</span>
            <div className={styles.pillGroup}>
              {PENSION_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.pill} ${pension.selfType === value ? styles.pillActive : ""}`}
                  onClick={() => updatePension({ selfType: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="number"
              className={styles.amountInput}
              value={pension.selfExpectedAmount ?? ""}
              onChange={(e) =>
                updatePension({
                  selfExpectedAmount: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.unit}>만원/월</span>
            <input
              type="number"
              className={styles.ageInput}
              value={pension.selfStartAge ?? ""}
              onChange={(e) =>
                updatePension({
                  selfStartAge: e.target.value === "" ? 65 : Number(e.target.value),
                })
              }
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="65"
            />
            <span className={styles.unit}>세부터</span>
          </div>
        </div>

        {/* 배우자 */}
        {hasSpouse && (
          <div className={styles.personBlock}>
            <div className={styles.row}>
              <span className={styles.ownerLabel}>배우자</span>
              <div className={styles.pillGroup}>
                {PENSION_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.pill} ${pension.spouseType === value ? styles.pillActive : ""}`}
                    onClick={() => updatePension({ spouseType: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className={styles.amountInput}
                value={pension.spouseExpectedAmount ?? ""}
                onChange={(e) =>
                  updatePension({
                    spouseExpectedAmount: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.unit}>만원/월</span>
              <input
                type="number"
                className={styles.ageInput}
                value={pension.spouseStartAge ?? ""}
                onChange={(e) =>
                  updatePension({
                    spouseStartAge: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="65"
              />
              <span className={styles.unit}>세부터</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
