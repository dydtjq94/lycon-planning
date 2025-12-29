import React from "react";
import styles from "./ChartRangeControl.module.css";

/**
 * 차트 X축 범위 조정 공통 컴포넌트
 * 모든 차트에서 동일하게 사용되는 년도 범위 슬라이더
 */
function ChartRangeControl({
  minYear,
  maxYear,
  xAxisRange,
  onXAxisRangeChange,
  retirementYear = null,
}) {
  if (!minYear || !maxYear) {
    return null;
  }

  const handleStartChange = (e) => {
    const newStart = parseInt(e.target.value);
    if (newStart < xAxisRange.end) {
      onXAxisRangeChange({
        ...xAxisRange,
        start: newStart,
      });
    }
  };

  const handleEndChange = (e) => {
    const newEnd = parseInt(e.target.value);
    if (newEnd > xAxisRange.start) {
      onXAxisRangeChange({ ...xAxisRange, end: newEnd });
    }
  };

  return (
    <div className={styles.rangeControlsContainer}>
      <div className={styles.rangeSliderWrapper}>
        <div className={styles.rangeInputWrapper}>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={xAxisRange.start || minYear}
            onChange={handleStartChange}
            className={`${styles.rangeInput} ${styles.rangeInputStart}`}
          />
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={xAxisRange.end || maxYear}
            onChange={handleEndChange}
            className={`${styles.rangeInput} ${styles.rangeInputEnd}`}
          />
          <div className={styles.rangeTrack}>
            <div
              className={styles.rangeTrackActive}
              style={{
                left: `${
                  ((xAxisRange.start - minYear) / (maxYear - minYear)) * 100
                }%`,
                right: `${
                  100 - ((xAxisRange.end - minYear) / (maxYear - minYear)) * 100
                }%`,
              }}
            />
            {/* 은퇴 시점 마커 */}
            {retirementYear &&
              retirementYear >= minYear &&
              retirementYear <= maxYear && (
                <div
                  className={styles.retirementMarker}
                  style={{
                    left: `${
                      ((retirementYear - minYear) / (maxYear - minYear)) * 100
                    }%`,
                  }}
                  title={`은퇴: ${retirementYear}년`}
                />
              )}
          </div>
          <div className={styles.rangeLabels}>
            <span className={styles.rangeLabel}>
              {xAxisRange.start || minYear}
            </span>
            <span className={styles.rangeLabel}>
              {xAxisRange.end || maxYear}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChartRangeControl;

