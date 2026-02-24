"use client";

import { useState, useRef, useEffect } from "react";
import {
  LIFECYCLE_ICONS,
  LIFECYCLE_COLORS,
  getLifecycleIcon,
} from "@/lib/constants/lifecycle";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { StepProps } from "./types";
import styles from "./StepRetirement.module.css";

type PickerTarget =
  | "retirementIcon"
  | "lifeExpectancyIcon"
  | "spouseRetirementIcon"
  | "spouseLifeExpectancyIcon"
  | null;

export function StepRetirement({ data, onChange }: StepProps) {
  const { isDark } = useChartTheme();
  const { retirement, family } = data;
  const hasSpouse = family.hasSpouse;
  const spouseName = family.spouseName || "배우자";

  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const iconBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const updateRetirement = (updates: Partial<typeof retirement>) => {
    onChange({ retirement: { ...retirement, ...updates } });
  };

  // Close picker on outside click (but not when clicking another icon button)
  useEffect(() => {
    if (!pickerTarget) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close if clicking inside picker
      if (pickerRef.current?.contains(target)) return;
      // Don't close if clicking an icon button (it handles its own toggle)
      for (const btn of Object.values(iconBtnRefs.current)) {
        if (btn?.contains(target)) return;
      }
      setPickerTarget(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerTarget]);

  // Close picker on ESC
  useEffect(() => {
    if (!pickerTarget) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerTarget(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [pickerTarget]);

  const getIconColorForTarget = (target: NonNullable<PickerTarget>) => {
    switch (target) {
      case "retirementIcon":
        return { icon: retirement.retirementIcon, color: retirement.retirementColor };
      case "lifeExpectancyIcon":
        return { icon: retirement.lifeExpectancyIcon, color: retirement.lifeExpectancyColor };
      case "spouseRetirementIcon":
        return { icon: retirement.spouseRetirementIcon, color: retirement.spouseRetirementColor };
      case "spouseLifeExpectancyIcon":
        return { icon: retirement.spouseLifeExpectancyIcon, color: retirement.spouseLifeExpectancyColor };
    }
  };

  const handleIconSelect = (iconId: string) => {
    if (!pickerTarget) return;
    updateRetirement({ [pickerTarget]: iconId });
  };

  const handleColorSelect = (color: string) => {
    if (!pickerTarget) return;
    const colorKey = pickerTarget.replace("Icon", "Color");
    updateRetirement({ [colorKey]: color });
  };

  const togglePicker = (target: NonNullable<PickerTarget>) => {
    setPickerTarget(pickerTarget === target ? null : target);
  };

  const renderIconButton = (
    target: NonNullable<PickerTarget>,
    iconId: string,
    color: string,
  ) => {
    const Icon = getLifecycleIcon(iconId);
    return (
      <button
        ref={(el) => { iconBtnRefs.current[target] = el; }}
        type="button"
        className={styles.iconBtn}
        style={{ color }}
        onClick={() => togglePicker(target)}
      >
        <Icon size={14} />
      </button>
    );
  };

  const renderPicker = (target: NonNullable<PickerTarget>) => {
    if (pickerTarget !== target) return null;
    const current = getIconColorForTarget(target);
    return (
      <div
        ref={pickerRef}
        className={styles.picker}
        style={{
          background: isDark ? "rgba(34, 37, 41, 0.5)" : "rgba(255, 255, 255, 0.5)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
        }}
      >
        <div className={styles.pickerSection}>
          <div className={styles.pickerGrid}>
            {LIFECYCLE_ICONS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.pickerIconItem} ${current.icon === item.id ? styles.pickerItemActive : ""}`}
                  style={current.icon === item.id ? { color: current.color } : undefined}
                  onClick={() => handleIconSelect(item.id)}
                  title={item.label}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.pickerDivider} />
        <div className={styles.pickerSection}>
          <div className={styles.colorGrid}>
            {LIFECYCLE_COLORS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.colorItem} ${current.color === item.color ? styles.colorItemActive : ""}`}
                style={{ backgroundColor: item.color }}
                onClick={() => handleColorSelect(item.color)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const spouseNotWorking = !retirement.spouseIsWorking;

  return (
    <div className={styles.root}>
      {/* 본인 섹션 */}
      <section className={styles.section}>
        <span className={styles.sectionLabel}>본인</span>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>
            {renderIconButton("retirementIcon", retirement.retirementIcon, retirement.retirementColor)}
            은퇴 나이
          </label>
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
        {renderPicker("retirementIcon")}

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>
            {renderIconButton("lifeExpectancyIcon", retirement.lifeExpectancyIcon, retirement.lifeExpectancyColor)}
            기대 수명
          </label>
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
        {renderPicker("lifeExpectancyIcon")}
      </section>

      {/* 배우자 섹션 */}
      {hasSpouse && (
        <section className={styles.section}>
          <span className={styles.sectionLabel}>{spouseName}</span>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              {renderIconButton("spouseRetirementIcon", retirement.spouseRetirementIcon, retirement.spouseRetirementColor)}
              은퇴 나이
            </label>
            <div className={styles.ageInputWrapper}>
              <input
                type="number"
                className={`${styles.ageInput} ${spouseNotWorking ? styles.ageInputDisabled : ""}`}
                value={retirement.spouseRetirementAge ?? ""}
                disabled={spouseNotWorking}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  updateRetirement({ spouseRetirementAge: isNaN(val) ? null : val });
                }}
                onWheel={(e) => (e.target as HTMLElement).blur()}
              />
              <span className={styles.unit}>세</span>
            </div>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={spouseNotWorking}
                onChange={(e) => {
                  const notWorking = e.target.checked;
                  updateRetirement({
                    spouseIsWorking: !notWorking,
                    ...(!notWorking && retirement.spouseRetirementAge === null
                      ? { spouseRetirementAge: 65 }
                      : {}),
                  });
                }}
              />
              일하지 않음
            </label>
          </div>
          {renderPicker("spouseRetirementIcon")}

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              {renderIconButton("spouseLifeExpectancyIcon", retirement.spouseLifeExpectancyIcon, retirement.spouseLifeExpectancyColor)}
              기대 수명
            </label>
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
          {renderPicker("spouseLifeExpectancyIcon")}
        </section>
      )}
    </div>
  );
}
