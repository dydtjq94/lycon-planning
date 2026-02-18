"use client";

import { useState } from "react";
import styles from "./StartPointPanel.module.css";

interface StartPointPanelProps {
  startYear: number | null;
  startMonth: number | null;
  onSave: (year: number | null, month: number | null) => void;
}

export function StartPointPanel({ startYear, startMonth, onSave }: StartPointPanelProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [year, setYear] = useState<string>(startYear ? String(startYear) : "");
  const [month, setMonth] = useState<string>(startMonth ? String(startMonth) : "");
  const isDefault = !year && !month;

  return (
    <div className={styles.container}>
      <div className={styles.title}>시뮬레이션 시작 시점</div>
      <div className={styles.description}>
        비어있으면 현재 시점({currentYear}년 {currentMonth}월)부터 시작합니다.
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>시작 년도</label>
          <input
            type="number"
            className={styles.input}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder={String(currentYear)}
            min={2000}
            max={2100}
            onWheel={(e) => (e.target as HTMLElement).blur()}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>시작 월</label>
          <input
            type="number"
            className={styles.input}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder={String(currentMonth)}
            min={1}
            max={12}
            onWheel={(e) => (e.target as HTMLElement).blur()}
          />
        </div>
      </div>
      <div className={styles.actions}>
        {!isDefault && (
          <button
            className={styles.resetBtn}
            onClick={() => {
              setYear("");
              setMonth("");
              onSave(null, null);
            }}
          >
            초기화
          </button>
        )}
        <button
          className={styles.saveBtn}
          onClick={() => {
            const y = year ? parseInt(year, 10) : null;
            const m = month ? parseInt(month, 10) : null;
            onSave(y, m);
          }}
        >
          저장
        </button>
      </div>
    </div>
  );
}
