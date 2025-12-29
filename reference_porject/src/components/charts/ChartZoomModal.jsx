import React, { useEffect } from "react";
import styles from "./ChartZoomModal.module.css";

/**
 * 차트 확대 모달
 * 차트를 전체 화면으로 확대하여 보여줍니다.
 * 방향키(←, →)로 년도를 이동할 수 있습니다.
 */
function ChartZoomModal({ 
  isOpen, 
  onClose, 
  children, 
  title,
  onYearChange, // 방향키로 년도 변경 시 호출되는 콜백
  currentYear, // 현재 선택된 년도
  allYears = [], // 전체 년도 목록
}) {
  // ESC 키로 모달 닫기 및 방향키로 연도 이동
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && onYearChange) {
        // 방향키로 연도 이동
        if (!currentYear || !allYears || allYears.length === 0) return;

        const currentIndex = allYears.findIndex(
          (year) => year === currentYear
        );
        if (currentIndex === -1) return;

        let newIndex = currentIndex;
        if (e.key === "ArrowRight") {
          // 다음 연도로 이동
          newIndex = currentIndex + 1;
        } else if (e.key === "ArrowLeft") {
          // 이전 연도로 이동
          newIndex = currentIndex - 1;
        }

        // 범위 체크
        if (newIndex >= 0 && newIndex < allYears.length) {
          const newYear = allYears[newIndex];
          onYearChange(newYear);
        }
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // 스크롤 방지
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose, onYearChange, currentYear, allYears]);

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={`${styles.modalOverlay} ${isOpen ? styles.open : ""}`}
        onClick={onClose}
      />

      {/* 슬라이드 패널 */}
      <div className={`${styles.modalContent} ${isOpen ? styles.open : ""}`}>
        {/* 헤더 */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
            title="닫기 (ESC)"
          >
            →
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className={styles.chartContainer}>{children}</div>
      </div>
    </>
  );
}

export default ChartZoomModal;
