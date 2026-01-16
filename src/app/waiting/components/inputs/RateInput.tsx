"use client";

import styles from "./inputs.module.css";

interface RateInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  step?: string;
  unit?: string;
  className?: string;
}

export function RateInput({
  value,
  onChange,
  placeholder = "0.0",
  step = "0.1",
  unit = "%",
  className,
}: RateInputProps) {
  return (
    <div className={styles.inputRow}>
      <input
        type="number"
        className={`${styles.rateInput} ${className || ""}`}
        placeholder={placeholder}
        value={value === null ? "" : value}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === "" ? null : parseFloat(val));
        }}
        onWheel={(e) => (e.target as HTMLElement).blur()}
        step={step}
      />
      <span className={styles.unit}>{unit}</span>
    </div>
  );
}
