import React from "react";
import styles from "./ProfileSummary.module.css";

/**
 * 프로필 하단 차트 선택 탭 컴포넌트
 * 차트 종류를 선택할 수 있는 탭 UI 제공
 */
function ProfileSummary({ activeChart, onChartChange }) {
  return (
    <div className={styles.profileSummary}>
      {/* 차트 선택 탭 */}
      <div className={styles.chartTabs}>
        <button
          className={`${styles.chartTab} ${
            activeChart === "assets" ? styles.chartTabActive : ""
          }`}
          onClick={() => onChartChange("assets")}
        >
          순 자산 규모
        </button>
        <button
          className={`${styles.chartTab} ${
            activeChart === "cashflow" ? styles.chartTabActive : ""
          }`}
          onClick={() => onChartChange("cashflow")}
        >
          가계 현금 흐름
        </button>
      </div>
    </div>
  );
}

export default ProfileSummary;
