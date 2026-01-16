"use client";

import styles from "./inputs.module.css";

interface FrequencyToggleProps {
  value: "monthly" | "yearly";
  onChange: (value: "monthly" | "yearly") => void;
}

export function FrequencyToggle({ value, onChange }: FrequencyToggleProps) {
  return (
    <div className={styles.frequencyToggle}>
      <button
        className={`${styles.freqBtn} ${value === "monthly" ? styles.active : ""}`}
        onClick={() => onChange("monthly")}
      >
        월
      </button>
      <button
        className={`${styles.freqBtn} ${value === "yearly" ? styles.active : ""}`}
        onClick={() => onChange("yearly")}
      >
        연
      </button>
    </div>
  );
}
