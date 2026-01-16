"use client";

import styles from "./inputs.module.css";

interface ToggleGroupProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  falseLabel?: string;
  trueLabel?: string;
}

export function ToggleGroup({
  value,
  onChange,
  falseLabel = "없음",
  trueLabel = "있음",
}: ToggleGroupProps) {
  return (
    <div className={styles.toggleGroup}>
      <button
        className={`${styles.toggleBtn} ${value === false ? styles.active : ""}`}
        onClick={() => onChange(false)}
      >
        {falseLabel}
      </button>
      <button
        className={`${styles.toggleBtn} ${value === true ? styles.active : ""}`}
        onClick={() => onChange(true)}
      >
        {trueLabel}
      </button>
    </div>
  );
}
