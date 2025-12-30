"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { GlobalSettings, ScenarioMode } from "@/types";
import { SCENARIO_PRESETS } from "@/types";
import styles from "./Modal.module.css";

interface ScenarioModalProps {
  globalSettings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
  onClose: () => void;
}

const SCENARIO_LABELS: Record<ScenarioMode, string> = {
  optimistic: "낙관적",
  average: "평균",
  pessimistic: "비관적",
  custom: "커스텀",
};

export function ScenarioModal({
  globalSettings,
  onUpdate,
  onClose,
}: ScenarioModalProps) {
  const [mode, setMode] = useState<ScenarioMode>(globalSettings.scenarioMode);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 적용
  const handleApply = () => {
    onUpdate({
      ...globalSettings,
      scenarioMode: mode,
    });
    onClose();
  };

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 프리셋 모드의 상승률 표시
  const presetRates = mode !== "custom" ? SCENARIO_PRESETS[mode] : null;

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>시나리오 설정</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {/* 시나리오 모드 선택 */}
          <div className={styles.modeSelector}>
            {(Object.keys(SCENARIO_LABELS) as ScenarioMode[]).map((m) => (
              <button
                key={m}
                className={`${styles.modeBtn} ${mode === m ? styles.active : ""}`}
                onClick={() => setMode(m)}
              >
                {SCENARIO_LABELS[m]}
              </button>
            ))}
          </div>

          {/* 커스텀일 때 안내 메시지 */}
          {mode === "custom" ? (
            <div className={styles.customModeInfo}>
              <p className={styles.customModeText}>
                각 소득/지출 항목에 설정한 개별 상승률이 적용됩니다.
              </p>
            </div>
          ) : (
            /* 프리셋일 때 상승률 표시 (읽기 전용) */
            <div className={styles.rateList}>
              <div className={styles.rateRow}>
                <span className={styles.rateLabel}>물가 상승률</span>
                <span className={styles.rateValue}>{presetRates?.inflationRate}%</span>
              </div>
              <div className={styles.rateRow}>
                <span className={styles.rateLabel}>소득 상승률</span>
                <span className={styles.rateValue}>{presetRates?.incomeGrowthRate}%</span>
              </div>
              <div className={styles.rateRow}>
                <span className={styles.rateLabel}>투자 수익률</span>
                <span className={styles.rateValue}>{presetRates?.investmentReturnRate}%</span>
              </div>
              <div className={styles.rateRow}>
                <span className={styles.rateLabel}>부동산 상승률</span>
                <span className={styles.rateValue}>{presetRates?.realEstateGrowthRate}%</span>
              </div>
            </div>
          )}

          {/* 힌트 */}
          <div className={styles.applyOptions}>
            <p className={styles.applyHint}>
              {mode === "custom"
                ? "소득/지출 탭에서 각 항목의 상승률을 개별 설정할 수 있습니다."
                : "위 상승률이 모든 항목에 일괄 적용되어 시뮬레이션됩니다."}
            </p>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            취소
          </button>
          <button className={styles.applyBtn} onClick={handleApply}>
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
