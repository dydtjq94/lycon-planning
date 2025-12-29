import React from "react";
import styles from "./Section4OverviewPage.module.css";

/**
 * 섹션 4 개요 - 목표 기반 재무 설계 (Page 18)
 */
function Section4OverviewPage() {
  return (
    <div className={styles.slideContainer}>
      {/* Background Elements */}
      <div className={styles.backgroundOverlay}></div>
      <div className={styles.accentLine}></div>

      {/* Left Section: Title & Number */}
      <div className={styles.leftSection}>
        <div className={styles.topAccent}>
          <div className={styles.topAccentFill}></div>
        </div>

        <div className={styles.titleContainer}>
          <p className={styles.sectionLabel}>PART 2 · Goal-Based Financial Planning</p>
          <h2 className={styles.mainTitle}>
            목표 기반
            <br />
            재무 설계
          </h2>
          <p className={styles.description}>
            은퇴 목표 달성을 위한 개인 맞춤형
            재무 설계 로드맵을 수립하고,
            실행 가능한 구체적 전략을 제시합니다.
          </p>
        </div>
      </div>

      {/* Right Section: Detail Cards */}
      <div className={styles.rightSection}>
        <div className={styles.cardsContainer}>
          {/* Card 1: Purpose */}
          <div className={`${styles.card} ${styles.cardPurpose}`}>
            <div className={styles.cardIcon}>
              <i className="fas fa-bullseye"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.cardBadge} style={{ backgroundColor: "#78350F", color: "#FCD34D" }}>
                Purpose
              </span>
              설계 목적
            </h3>
            <div className={styles.cardContent}>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  개인별 은퇴 목표와 현재 자산 상황의 <strong>괴리(Gap) 분석</strong>
                </span>
              </p>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  목표 달성을 위한 <strong>최적의 저축 및 인출 전략</strong> 수립
                </span>
              </p>
            </div>
          </div>

          {/* Card 2: Strategies */}
          <div className={`${styles.card} ${styles.cardStrategies}`}>
            <div className={styles.cardIcon}>
              <i className="fas fa-chess-knight"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.cardBadge} style={{ backgroundColor: "#1F2937", color: "#9CA3AF" }}>
                Strategies
              </span>
              주요 구성 전략
            </h3>
            <div className={styles.cardContent}>
              <div className={styles.strategyItems}>
                <div className={styles.strategyItem}>
                  <div className={styles.strategyNumber}>1</div>
                  <span className={styles.strategyText}>
                    은퇴 후 현금흐름 목표 달성 전략
                  </span>
                </div>
                <div className={styles.strategyItem}>
                  <div className={styles.strategyNumber}>2</div>
                  <span className={styles.strategyText}>
                    은퇴 시점 목표 자산 달성 전략
                  </span>
                </div>
                <div className={styles.strategyItem}>
                  <div className={styles.strategyNumber}>3</div>
                  <span className={styles.strategyText}>
                    투자 진단 및 실행 액션
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Deliverables */}
          <div className={`${styles.card} ${styles.cardOutput}`}>
            <div className={styles.cardIcon}>
              <i className="fas fa-file-signature"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.cardBadge} style={{ backgroundColor: "#1F2937", color: "#9CA3AF" }}>
                Output
              </span>
              핵심 산출물
            </h3>
            <div className={styles.cardContent}>
              <div className={styles.outputGrid}>
                <div className={styles.outputItem}>
                  <div className={styles.outputIcon}>
                    <i className="fas fa-chart-line"></i>
                  </div>
                  <p className={styles.outputLabel}>
                    목표-현황
                    <br />
                    격차 분석
                  </p>
                </div>
                <div className={`${styles.outputItem} ${styles.outputItemBorder}`}>
                  <div className={styles.outputIcon}>
                    <i className="fas fa-wallet"></i>
                  </div>
                  <p className={styles.outputLabel}>
                    필요 저축/
                    <br />
                    인출 설계
                  </p>
                </div>
                <div className={`${styles.outputItem} ${styles.outputItemBorder}`}>
                  <div className={styles.outputIcon}>
                    <i className="fas fa-shapes"></i>
                  </div>
                  <p className={styles.outputLabel}>
                    포트폴리오
                    <br />
                    최적화 가이드
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Section4OverviewPage;
