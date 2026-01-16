"use client";

import { formatMoney } from "@/lib/utils";
import styles from "./inputs.module.css";

interface AmountInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  showFormatted?: boolean;
  unit?: string;
  className?: string;
}

export function AmountInput({
  value,
  onChange,
  placeholder = "0",
  showFormatted = true,
  unit = "만원",
  className,
}: AmountInputProps) {
  return (
    <div className={styles.amountWrapper}>
      <div className={styles.inputRow}>
        <input
          type="number"
          className={`${styles.amountInput} ${className || ""}`}
          placeholder={placeholder}
          value={value === null ? "" : value}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val === "" ? null : parseInt(val));
          }}
          onWheel={(e) => (e.target as HTMLElement).blur()}
        />
        <span className={styles.unit}>{unit}</span>
      </div>
      {showFormatted && (
        <p className={styles.formattedAmount}>
          {value !== null && value > 0 ? formatMoney(value) : "\u00A0"}
        </p>
      )}
    </div>
  );
}
