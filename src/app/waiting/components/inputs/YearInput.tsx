"use client";

import styles from "./inputs.module.css";

interface YearInputProps {
  value: number;
  onChange: (value: number) => void;
  defaultValue?: number;
  unit?: string;
  className?: string;
}

export function YearInput({
  value,
  onChange,
  defaultValue = new Date().getFullYear() + 5,
  unit = "년",
  className,
}: YearInputProps) {
  return (
    <div className={styles.inputRow}>
      <input
        type="number"
        className={`${styles.yearInput} ${className || ""}`}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || defaultValue)}
        onWheel={(e) => (e.target as HTMLElement).blur()}
      />
      <span className={styles.unit}>{unit}</span>
    </div>
  );
}
