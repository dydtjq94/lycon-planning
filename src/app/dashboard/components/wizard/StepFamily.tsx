"use client";

import { X, Plus, User } from "lucide-react";
import type { StepProps } from "./types";
import styles from "./StepFamily.module.css";

type ChildGender = "male" | "female" | null;

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
        { name: "", birthDate: "", gender: "male" as ChildGender },
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
    field: "name" | "birthDate" | "gender",
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
        </div>

        {family.hasSpouse && (
          <div className={styles.spouseFields}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>이름</label>
              <input
                type="text"
                className={styles.textInput}
                value={family.spouseName}
                onChange={(e) => updateFamily({ spouseName: e.target.value })}
                placeholder="배우자 이름"
              />
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>생년월일</label>
              <input
                type="date"
                className={styles.dateInput}
                value={family.spouseBirthDate}
                onChange={(e) =>
                  updateFamily({ spouseBirthDate: e.target.value })
                }
              />
            </div>

          </div>
        )}
      </section>

      {/* Children Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>자녀</span>
          {family.children.length > 0 && (
            <span className={styles.countBadge}>{family.children.length}명</span>
          )}
        </div>

        {family.children.length === 0 ? (
          <p className={styles.emptyText}>자녀가 없습니다</p>
        ) : (
          <div className={styles.childrenList}>
            {family.children.map((child, index) => (
              <div key={index} className={styles.childRow}>
                <button
                  type="button"
                  className={`${styles.genderPill} ${child.gender === "female" ? styles.genderPillFemale : styles.genderPillMale}`}
                  onClick={() => handleChildGenderToggle(index)}
                  title={child.gender === "male" ? "남" : "여"}
                >
                  <User size={12} />
                  {child.gender === "male" ? "남" : "여"}
                </button>

                <input
                  type="text"
                  className={styles.childNameInput}
                  value={child.name}
                  onChange={(e) =>
                    handleChildChange(index, "name", e.target.value)
                  }
                  placeholder="이름"
                />

                <input
                  type="date"
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
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className={styles.addBtn}
          onClick={handleAddChild}
        >
          <Plus size={14} />
          자녀 추가
        </button>
      </section>

      {/* Planned Children Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>계획 중인 자녀</span>
          {family.plannedChildren.length > 0 && (
            <span className={styles.countBadge}>{family.plannedChildren.length}명</span>
          )}
        </div>

        {family.plannedChildren.length === 0 ? (
          <p className={styles.emptyText}>계획 중인 자녀가 없습니다</p>
        ) : (
          <div className={styles.childrenList}>
            {family.plannedChildren.map((planned, index) => (
              <div key={index} className={styles.childRow}>
                <div className={styles.yearInputWrapper}>
                  <input
                    type="number"
                    className={styles.yearInput}
                    value={planned.birthYear ?? ""}
                    placeholder="2028"
                    onChange={(e) => {
                      const raw = e.target.value;
                      const val = raw === "" ? null : parseInt(raw, 10);
                      const updated = family.plannedChildren.map((p, i) =>
                        i === index ? { ...p, birthYear: val } : p
                      );
                      updateFamily({ plannedChildren: updated });
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.numberUnit}>년 출생</span>
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
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

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
            <Plus size={14} />
            계획 자녀 추가
          </button>
        )}
        <p className={styles.fieldHint}>출생 예정 연도를 입력하면 해당 연도 기준으로 시뮬레이션에 반영됩니다</p>
      </section>
    </div>
  );
}
