"use client";

import styles from "./inputs.module.css";

interface OwnerSelectProps {
  value: "self" | "spouse";
  onChange: (value: "self" | "spouse") => void;
  show?: boolean; // hasSpouse일 때만 토글 표시
}

export function OwnerSelect({ value, onChange, show = true }: OwnerSelectProps) {
  // 배우자 없으면 "본인" 텍스트만 표시
  if (!show) {
    return <span className={styles.ownerLabel}>본인</span>;
  }

  return (
    <div className={styles.ownerToggle}>
      <button
        type="button"
        className={`${styles.ownerBtn} ${value === "self" ? styles.active : ""}`}
        onClick={() => onChange("self")}
      >
        본인
      </button>
      <button
        type="button"
        className={`${styles.ownerBtn} ${value === "spouse" ? styles.active : ""}`}
        onClick={() => onChange("spouse")}
      >
        배우자
      </button>
    </div>
  );
}
