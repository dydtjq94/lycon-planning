"use client";

import { useState, useCallback, useEffect } from "react";
import { TrendingUp, Landmark, Home, Percent } from "lucide-react";
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
  description: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}[] = [
  {
    key: "savings",
    label: "예금/적금 이율",
    description: "은행 예금, 적금의 연간 이자율",
    icon: <Landmark size={18} />,
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 3.0,
  },
  {
    key: "investment",
    label: "투자 수익률",
    description: "주식, 펀드, ETF 등 투자자산의 연평균 수익률",
    icon: <TrendingUp size={18} />,
    min: -10,
    max: 20,
    step: 0.5,
    defaultValue: 7.0,
  },
  {
    key: "pension",
    label: "연금 수익률",
    description: "연금저축, IRP, 퇴직연금의 연평균 수익률",
    icon: <Landmark size={18} />,
    min: 0,
    max: 15,
    step: 0.5,
    defaultValue: 5.0,
  },
  {
    key: "realEstate",
    label: "부동산 상승률",
    description: "부동산 자산의 연간 가치 상승률",
    icon: <Home size={18} />,
    min: -5,
    max: 15,
    step: 0.5,
    defaultValue: 3.0,
  },
  {
    key: "inflation",
    label: "물가상승률",
    description: "연간 물가상승률 (지출 증가에 적용)",
    icon: <Percent size={18} />,
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 2.5,
  },
];

export function InvestmentAssumptionsPanel({
  assumptions,
  onChange,
  isLoading = false,
}: InvestmentAssumptionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 첫 로드 후 isInitialLoad를 false로 설정
  useEffect(() => {
    if (isInitialLoad && !isLoading) {
      setIsInitialLoad(false);
    }
  }, [isLoading, isInitialLoad]);

  const handleRateChange = useCallback(
    (key: keyof InvestmentRates, value: number) => {
      onChange({
        ...assumptions,
        rates: {
          ...assumptions.rates,
          [key]: value,
        },
      });
    },
    [assumptions, onChange]
  );

  const handleResetToDefault = useCallback(() => {
    onChange({
      mode: "fixed",
      rates: {
        savings: 3.0,
        investment: 7.0,
        pension: 5.0,
        realEstate: 3.0,
        inflation: 2.5,
      },
    });
  }, [onChange]);

  // 초기 로딩 스켈레톤
  if (isLoading && isInitialLoad) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.skeletonHeaderToggle}>
            <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
            <div className={`${styles.skeleton} ${styles.skeletonCount}`} />
            <div className={`${styles.skeleton} ${styles.skeletonChevron}`} />
          </div>
          <div className={styles.headerRight}>
            <div className={`${styles.skeleton} ${styles.skeletonBadge}`} />
          </div>
        </div>
        <div className={styles.skeletonContent}>
          <div className={`${styles.skeleton} ${styles.skeletonDesc}`} />
          <div className={styles.skeletonRateList}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={styles.skeletonRateItem}>
                <div className={styles.skeletonRateHeader}>
                  <div className={`${styles.skeleton} ${styles.skeletonRateIcon}`} />
                  <div className={styles.skeletonRateInfo}>
                    <div className={`${styles.skeleton} ${styles.skeletonRateLabel}`} />
                    <div className={`${styles.skeleton} ${styles.skeletonRateDesc}`} />
                  </div>
                </div>
                <div className={`${styles.skeleton} ${styles.skeletonRateInput}`} />
              </div>
            ))}
          </div>
          <div className={styles.skeletonFooter}>
            <div className={`${styles.skeleton} ${styles.skeletonResetBtn}`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <button className={styles.headerToggle} onClick={() => setIsExpanded(!isExpanded)} type="button">
          <span className={styles.title}>투자 가정</span>
          <span className={styles.count}>5개</span>
        </button>
        <div className={styles.headerRight}>
          <span className={styles.modeBadge}>고정 수익률</span>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          <p className={styles.description}>
            시뮬레이션에 적용할 수익률을 설정합니다. 각 자산 유형별로 연간 수익률/상승률을 입력하세요.
          </p>

          <div className={styles.rateList}>
            {RATE_FIELDS.map((field) => (
              <div key={field.key} className={styles.rateItem}>
                <div className={styles.rateHeader}>
                  <div className={styles.rateIcon}>{field.icon}</div>
                  <div className={styles.rateInfo}>
                    <span className={styles.rateLabel}>{field.label}</span>
                    <span className={styles.rateDesc}>{field.description}</span>
                  </div>
                </div>
                <div className={styles.rateInputWrapper}>
                  <input
                    type="number"
                    className={styles.rateInput}
                    value={assumptions.rates[field.key]}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        handleRateChange(field.key, value);
                      }
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    disabled={isLoading}
                  />
                  <span className={styles.rateUnit}>%</span>
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
      )}
    </div>
  );
}
