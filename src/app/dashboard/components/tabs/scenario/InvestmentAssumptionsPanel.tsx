"use client";

import { useState, useCallback, useEffect } from "react";
import { TrendingUp, Landmark, Home, Percent, Wallet } from "lucide-react";
import type { InvestmentAssumptions, InvestmentRates } from "@/types";
import styles from "./InvestmentAssumptionsPanel.module.css";

interface InvestmentAssumptionsPanelProps {
  assumptions: InvestmentAssumptions;
  onChange: (assumptions: InvestmentAssumptions) => void;
  isLoading?: boolean;
}

// 각 수익률 필드 설정
const RATE_FIELDS: {
  key: keyof InvestmentRates;
  label: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}[] = [
  {
    key: "incomeGrowth",
    label: "소득 상승률",
    icon: <Wallet size={14} />,
    min: 0,
    max: 15,
    step: 0.5,
    defaultValue: 3.0,
  },
  {
    key: "inflation",
    label: "물가 상승률",
    icon: <Percent size={14} />,
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 2.5,
  },
  {
    key: "savings",
    label: "예금/적금 이율",
    icon: <Landmark size={14} />,
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 3.0,
  },
  {
    key: "investment",
    label: "투자 수익률",
    icon: <TrendingUp size={14} />,
    min: -10,
    max: 20,
    step: 0.5,
    defaultValue: 7.0,
  },
  {
    key: "pension",
    label: "연금 수익률",
    icon: <Landmark size={14} />,
    min: 0,
    max: 15,
    step: 0.5,
    defaultValue: 5.0,
  },
  {
    key: "realEstate",
    label: "부동산 상승률",
    icon: <Home size={14} />,
    min: -5,
    max: 15,
    step: 0.5,
    defaultValue: 3.0,
  },
];

export function InvestmentAssumptionsPanel({
  assumptions,
  onChange,
  isLoading = false,
}: InvestmentAssumptionsPanelProps) {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  // 로컬 input state (문자열로 관리 → blur 시 저장)
  const [localRates, setLocalRates] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    RATE_FIELDS.forEach((f) => {
      init[f.key] = String(assumptions.rates[f.key] ?? f.defaultValue);
    });
    return init;
  });

  // 첫 로드 후 isInitialLoad를 false로 설정
  useEffect(() => {
    if (isInitialLoad && !isLoading) {
      setIsInitialLoad(false);
    }
  }, [isLoading, isInitialLoad]);

  const handleLocalChange = (key: string, raw: string) => {
    setLocalRates((prev) => ({ ...prev, [key]: raw }));
    setIsDirty(true);
  };

  const handleBlur = (key: keyof InvestmentRates, defaultValue: number) => {
    const parsed = parseFloat(localRates[key]);
    const value = isNaN(parsed) ? defaultValue : parsed;
    setLocalRates((prev) => ({ ...prev, [key]: String(value) }));
  };

  const handleSave = () => {
    const newRates: Record<string, number> = {};
    RATE_FIELDS.forEach((field) => {
      const parsed = parseFloat(localRates[field.key]);
      newRates[field.key] = isNaN(parsed) ? field.defaultValue : parsed;
    });
    onChange({
      ...assumptions,
      rates: { ...assumptions.rates, ...newRates } as InvestmentRates,
    });
    setIsDirty(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  const handleResetToDefault = useCallback(() => {
    const defaults = {
      savings: 3.0,
      investment: 7.0,
      pension: 5.0,
      realEstate: 3.0,
      inflation: 2.5,
      incomeGrowth: 3.0,
    };
    const init: Record<string, string> = {};
    RATE_FIELDS.forEach((f) => {
      init[f.key] = String(
        defaults[f.key as keyof typeof defaults] ?? f.defaultValue,
      );
    });
    setLocalRates(init);
    onChange({ mode: "fixed", rates: defaults });
  }, [onChange]);

  // 초기 로딩 스켈레톤
  if (isLoading && isInitialLoad) {
    return (
      <div className={styles.panel}>
        <div className={styles.skeletonHeader}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        </div>
        <div className={styles.skeletonContent}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.skeletonRow}>
              <div className={styles.skeletonLabel}>
                <div className={`${styles.skeleton} ${styles.skeletonIcon}`} />
                <div className={`${styles.skeleton} ${styles.skeletonText}`} />
              </div>
              <div className={`${styles.skeleton} ${styles.skeletonInput}`} />
            </div>
          ))}
        </div>
        <div className={styles.skeletonFooter}>
          <div className={`${styles.skeleton} ${styles.skeletonResetBtn}`} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>시뮬레이션 가정</span>
        <button
          type="button"
          className={`${styles.saveButton}${!isDirty ? ` ${styles.saveButtonDisabled}` : ''}`}
          onClick={handleSave}
          disabled={!isDirty}
        >
          저장
        </button>
      </div>

      <div className={styles.rateList}>
        {RATE_FIELDS.map((field) => (
          <div key={field.key} className={styles.row}>
            <div className={styles.labelGroup}>
              <div className={styles.rateIcon}>{field.icon}</div>
              <span className={styles.label}>{field.label}</span>
            </div>
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.rateInput}
                value={localRates[field.key] ?? ""}
                onChange={(e) =>
                  handleLocalChange(field.key, e.target.value)
                }
                onBlur={() => handleBlur(field.key, field.defaultValue)}
                onKeyDown={handleKeyDown}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                min={field.min}
                max={field.max}
                step={field.step}
                disabled={isLoading}
              />
              <span className={styles.unit}>%</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <button
          className={styles.resetButton}
          onClick={handleResetToDefault}
          disabled={isLoading}
          type="button"
        >
          기본값으로 초기화
        </button>
      </div>
    </div>
  );
}
