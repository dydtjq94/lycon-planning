"use client";

import { X, Plus } from "lucide-react";
import type { StepProps } from "./types";
import styles from "./StepFamily.module.css";

interface StepFamilyProps extends StepProps {
  userGender: "male" | "female" | null;
}

export function StepFamily({ data, onChange, userGender }: StepFamilyProps) {
  const { family } = data;

  const updateFamily = (updates: Partial<typeof family>) => {
    onChange({ family: { ...family, ...updates } });
  };

  // Spouse - gender auto-derived from user's gender
  const handleHasSpouseToggle = (value: boolean) => {
    const spouseGender = value && userGender
      ? (userGender === "male" ? "female" : "male")
      : family.spouseGender;
    updateFamily({ hasSpouse: value, spouseGender });
  };

  // Children
  const handleAddChild = () => {
    updateFamily({
      children: [
        ...family.children,
        { name: "", birthDate: "", gender: "male" as const },
      ],
    });
  };

  const handleRemoveChild = (index: number) => {
    updateFamily({
      children: family.children.filter((_, i) => i !== index),
    });
  };

  const handleChildChange = (
    index: number,
    field: "birthDate" | "gender",
    value: string
  ) => {
    const updated = family.children.map((child, i) => {
      if (i !== index) return child;
      return { ...child, [field]: value };
    });
    updateFamily({ children: updated });
  };

  const handleChildGenderToggle = (index: number) => {
    const child = family.children[index];
    const next = child.gender === "male" ? "female" : "male";
    handleChildChange(index, "gender", next);
  };

  return (
    <div className={styles.root}>
      {/* Spouse Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>배우자</span>
        </div>
        <div className={styles.childRow}>
          <div className={styles.pillGroup}>
            <button
              type="button"
              className={`${styles.pill} ${family.hasSpouse ? styles.pillActive : ""}`}
              onClick={() => handleHasSpouseToggle(true)}
            >
              있음
            </button>
            <button
              type="button"
              className={`${styles.pill} ${!family.hasSpouse ? styles.pillActive : ""}`}
              onClick={() => handleHasSpouseToggle(false)}
            >
              없음
            </button>
          </div>

          {family.hasSpouse && (
            <input
              type="date"
              max="9999-12-31"
              className={styles.childDateInput}
              value={family.spouseBirthDate}
              onChange={(e) =>
                updateFamily({ spouseBirthDate: e.target.value })
              }
            />
          )}
        </div>
      </section>

      {/* Children + Planned Children combined section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>자녀</span>
        </div>

        {family.children.length > 0 && (
          <div className={styles.childrenList}>
            {family.children.map((child, index) => (
              <div key={index} className={styles.childRow}>
                <div className={styles.pillGroup}>
                  <button
                    type="button"
                    className={`${styles.pill} ${child.gender === "male" ? styles.pillActive : ""}`}
                    onClick={() => handleChildChange(index, "gender", "male")}
                  >
                    아들
                  </button>
                  <button
                    type="button"
                    className={`${styles.pill} ${child.gender === "female" ? styles.pillActive : ""}`}
                    onClick={() => handleChildChange(index, "gender", "female")}
                  >
                    딸
                  </button>
                </div>
                <input
                  type="date"
                  max="9999-12-31"
                  className={styles.childDateInput}
                  value={child.birthDate}
                  onChange={(e) =>
                    handleChildChange(index, "birthDate", e.target.value)
                  }
                />

                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleRemoveChild(index)}
                  aria-label="자녀 삭제"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {family.plannedChildren.length > 0 && (
          <div className={styles.childrenList}>
            {family.plannedChildren.map((planned, index) => (
              <div key={index} className={styles.childRow}>
                <span className={styles.childLabelPlanned}>계획</span>
                <div className={styles.yearInputWrapper}>
                  <input
                    type="number"
                    className={styles.yearInput}
                    value={planned.birthYear ?? ""}
                    placeholder="2028"
                    max={9999}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw.length > 4) return;
                      const val = raw === "" ? null : parseInt(raw, 10);
                      const updated = family.plannedChildren.map((p, i) =>
                        i === index ? { ...p, birthYear: val } : p
                      );
                      updateFamily({ plannedChildren: updated });
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.numberUnit}>년 출생 예정</span>
                </div>

                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => {
                    updateFamily({
                      plannedChildren: family.plannedChildren.filter((_, i) => i !== index),
                    });
                  }}
                  aria-label="계획 자녀 삭제"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.addBtnRow}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleAddChild}
          >
            <Plus size={13} />
            자녀 추가
          </button>

          {family.plannedChildren.length < 5 && (
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => {
                updateFamily({
                  plannedChildren: [...family.plannedChildren, { birthYear: null }],
                });
              }}
            >
              <Plus size={13} />
              계획 자녀 추가
            </button>
          )}
        </div>

        <p className={styles.fieldHint}>계획 자녀는 출생 예정 연도 기준으로 시뮬레이션에 반영됩니다</p>
      </section>
    </div>
  );
}
