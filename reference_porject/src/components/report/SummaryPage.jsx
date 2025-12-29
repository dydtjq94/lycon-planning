import React from "react";
import styles from "./SummaryPage.module.css";

/**
 * 종합 진단 결과 요약 (Page 17)
 * 하드코딩된 데이터로 표시
 */
function SummaryPage() {
  return (
    <div className={styles.slideContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadges}>
            <span className={styles.stepBadge}>SUMMARY</span>
            <span className={styles.sectionBadge}>KEY INSIGHTS & NEXT STEPS</span>
          </div>
          <h1 className={styles.headerTitle}>종합 진단 결과 요약</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>진단을 통해 도출된 3가지 핵심 인사이트와</p>
          <p>성공적인 은퇴 준비를 위한 향후 실행 로드맵입니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Top 3 Insights */}
        <div className={styles.insightsGrid}>
          {/* Insight 1: 은퇴 자산 목표 초과 달성 (Green) */}
          <div
            className={`${styles.insightCard} ${styles.insightCardAccent}`}
            style={{ borderTopColor: "#10B981" }}
          >
            <div className={styles.numberWatermark}>1</div>
            <div className={styles.insightContent}>
              <div
                className={styles.insightIconBox}
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.2)",
                  borderColor: "#059669",
                  color: "#10B981",
                }}
              >
                <i className="fas fa-trophy" style={{ fontSize: "18px" }}></i>
              </div>
              <h3 className={styles.insightTitle}>은퇴 자산 목표 초과 달성</h3>
              <div className={styles.insightTextBox}>
                <p className={styles.insightText}>
                  은퇴 시점 예상 자산 약 74.6억원으로 목표 대비{" "}
                  <strong style={{ color: "#34D399" }}>106.6%</strong> 달성이 예상됩니다.
                </p>
                <div className={styles.insightFooter}>
                  <i
                    className="fas fa-check"
                    style={{ color: "#10B981" }}
                  ></i>
                  자산 성장률 유지 및 관리 필요
                </div>
              </div>
            </div>
          </div>

          {/* Insight 2: 2035년 유동성 리스크 경고 (Red) */}
          <div
            className={`${styles.insightCard} ${styles.insightCardAccent}`}
            style={{ borderTopColor: "#EF4444" }}
          >
            <div className={styles.numberWatermark}>2</div>
            <div className={styles.insightContent}>
              <div
                className={styles.insightIconBox}
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  borderColor: "#DC2626",
                  color: "#EF4444",
                }}
              >
                <i
                  className="fas fa-triangle-exclamation"
                  style={{ fontSize: "18px" }}
                ></i>
              </div>
              <h3 className={styles.insightTitle}>2035년 유동성 리스크 경고</h3>
              <div className={styles.insightTextBox}>
                <p className={styles.insightText}>
                  재건축 분담금 및 부채 상환으로 약{" "}
                  <strong style={{ color: "#FCA5A5" }}>3.1억원</strong>의 대규모 현금 유출이
                  발생합니다.
                </p>
                <div className={styles.insightFooter}>
                  <i
                    className="fas fa-arrow-right"
                    style={{ color: "#EF4444" }}
                  ></i>
                  사전 현금성 자산 확보 필수
                </div>
              </div>
            </div>
          </div>

          {/* Insight 3: 현재 적자 구조 개선 시급 (Yellow) */}
          <div
            className={`${styles.insightCard} ${styles.insightCardAccent}`}
            style={{ borderTopColor: "#F59E0B" }}
          >
            <div className={styles.numberWatermark}>3</div>
            <div className={styles.insightContent}>
              <div
                className={styles.insightIconBox}
                style={{
                  backgroundColor: "rgba(245, 158, 11, 0.2)",
                  borderColor: "#D97706",
                  color: "#F59E0B",
                }}
              >
                <i className="fas fa-coins" style={{ fontSize: "18px" }}></i>
              </div>
              <h3 className={styles.insightTitle}>현재 적자 구조 개선 시급</h3>
              <div className={styles.insightTextBox}>
                <p className={styles.insightText}>
                  월 소득 대비 지출 과다로{" "}
                  <strong style={{ color: "#FBBF24" }}>구조적 적자</strong> 상태입니다. 저축 여력
                  확보가 시급합니다.
                </p>
                <div className={styles.insightFooter}>
                  <i
                    className="fas fa-wrench"
                    style={{ color: "#F59E0B" }}
                  ></i>
                  고정비 구조조정 및 지출 통제
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className={styles.bottomRow}>
          {/* Next Steps */}
          <div className={styles.nextStepsSection}>
            <h3 className={styles.sectionLabel}>Next Steps : 실행 로드맵</h3>
            <div className={styles.nextStepsCard}>
              {/* Step 1 */}
              <div className={styles.stepItem}>
                <div
                  className={styles.stepIconBox}
                  style={{
                    backgroundColor: "#374151",
                    color: "#D1D5DB",
                    borderColor: "#4B5563",
                  }}
                >
                  <i className="fas fa-clipboard-list" style={{ fontSize: "14px" }}></i>
                </div>
                <p className={styles.stepTitle} style={{ color: "#E5E7EB" }}>
                  데이터 보완
                </p>
                <p className={styles.stepDescription}>
                  누락된 자산/부채
                  <br />
                  정밀 파악
                </p>
              </div>

              <div className={styles.stepArrow}>
                <i className="fas fa-chevron-right"></i>
              </div>

              {/* Step 2 */}
              <div className={styles.stepItem}>
                <div
                  className={styles.stepIconBox}
                  style={{
                    backgroundColor: "#374151",
                    color: "#D1D5DB",
                    borderColor: "#4B5563",
                  }}
                >
                  <i className="fas fa-calculator" style={{ fontSize: "14px" }}></i>
                </div>
                <p className={styles.stepTitle} style={{ color: "#E5E7EB" }}>
                  정교화 시뮬레이션
                </p>
                <p className={styles.stepDescription}>
                  유동성 리스크
                  <br />
                  대응 시나리오
                </p>
              </div>

              <div className={styles.stepArrow}>
                <i className="fas fa-chevron-right"></i>
              </div>

              {/* Step 3 */}
              <div className={styles.stepItem}>
                <div
                  className={styles.stepIconBox}
                  style={{
                    backgroundColor: "#1E3A8A",
                    color: "#60A5FA",
                    borderColor: "#3B82F6",
                    boxShadow: "0 0 10px rgba(59, 130, 246, 0.5)",
                  }}
                >
                  <i className="fas fa-scroll" style={{ fontSize: "14px" }}></i>
                </div>
                <p className={styles.stepTitle} style={{ color: "#60A5FA" }}>
                  액션플랜 실행
                </p>
                <p className={styles.stepDescription}>
                  지출 구조조정 및
                  <br />
                  현금 확보 전략
                </p>
              </div>

              <div className={styles.stepArrow}>
                <i className="fas fa-chevron-right"></i>
              </div>

              {/* Step 4 */}
              <div className={styles.stepItem}>
                <div
                  className={styles.stepIconBox}
                  style={{
                    backgroundColor: "#374151",
                    color: "#D1D5DB",
                    borderColor: "#4B5563",
                  }}
                >
                  <i
                    className="fas fa-magnifying-glass-chart"
                    style={{ fontSize: "14px" }}
                  ></i>
                </div>
                <p className={styles.stepTitle} style={{ color: "#E5E7EB" }}>
                  정기 모니터링
                </p>
                <p className={styles.stepDescription}>
                  분기별 적자 개선
                  <br />
                  성과 점검
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SummaryPage;
