"use client";

import styles from "./inputs.module.css";

interface YearMonthInputProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  minYear?: number;
  maxYear?: number;
}

export function YearMonthInput({
  year,
  month,
  onYearChange,
  onMonthChange,
  minYear = 2020,
  maxYear = 2080,
}: YearMonthInputProps) {
  return (
    <div className={styles.yearMonthWrapper}>
      <input
        type="number"
        inputMode="numeric"
        className={styles.yearInput}
        value={year}
        onChange={(e) => {
          if (e.target.value.length > 4) return;
          const v = parseInt(e.target.value);
          if (!isNaN(v) && v >= minYear && v <= maxYear) {
            onYearChange(v);
          }
        }}
        onWheel={(e) => (e.target as HTMLElement).blur()}
        min={minYear}
        max={9999}
      />
      <span className={styles.unit}>년</span>
      <select
        className={styles.monthSelect}
        value={month}
        onChange={(e) => onMonthChange(parseInt(e.target.value))}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <span className={styles.unit}>월</span>
    </div>
  );
}
