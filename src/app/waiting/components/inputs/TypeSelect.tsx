"use client";

import styles from "./inputs.module.css";

interface TypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  className?: string;
}

export function TypeSelect({ value, onChange, options, className }: TypeSelectProps) {
  return (
    <select
      className={`${styles.typeSelect} ${className || ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
