import React from "react";
import styles from "./Section3OverviewPage.module.css";

/**
 * 섹션 3 개요 - 소득·지출 패턴 분석 (Page 11)
 */
function Section3OverviewPage() {
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
          <p className={styles.sectionLabel}>Section Overview</p>
          <h2 className={styles.mainTitle}>
            소득·지출 패턴
            <br />
            분석 개요
          </h2>
          <p className={styles.description}>
            소비 패턴과 소득 구조의 정밀 분석을 통해
            <br />
            불필요한 낭비 요인을 제거하고
            <br />
            실질적인 저축 여력을 확보합니다.
          </p>
        </div>
      </div>

      {/* Right Section: Detail Cards */}
      <div className={styles.rightSection}>
        <div className={styles.cardsContainer}>
          {/* Card 1: Purpose */}
          <div className={`${styles.card} ${styles.cardPurpose}`}>
            <div className={styles.cardIcon}>
              <i className="fas fa-search-dollar"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.cardBadge} style={{ backgroundColor: "#78350F", color: "#FCD34D" }}>
                Purpose
              </span>
              진단 목적
            </h3>
            <div className={styles.cardContent}>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  소득/지출의 <strong>패턴 및 이상치(Outlier)</strong> 탐지
                </span>
              </p>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  재무 구조 개선을 통한 <strong>추가 저축 여력</strong> 도출
                </span>
              </p>
            </div>
          </div>

          {/* Card 2: Data Scope */}
          <div className={`${styles.card} ${styles.cardScope}`}>
            <div className={styles.cardIcon}>
              <i className="fas fa-database"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.cardBadge} style={{ backgroundColor: "#1F2937", color: "#9CA3AF" }}>
                Scope
              </span>
              데이터 범위
            </h3>
            <div className={styles.cardContent}>
              <p className={styles.scopeDescription}>
                고객님이 보내주신 데이터를 기반으로 추정하여 작성하였습니다
              </p>
              <div className={styles.scopeBoxes}>
                <div className={styles.scopeBox}>
                  <span className={styles.scopeBoxLabel}>Recent 3M</span>
                  <span className={styles.scopeBoxValue}>최근 3개월 평균 소득지출 데이터</span>
                </div>
                <div className={styles.scopeBox}>
                  <span className={styles.scopeBoxLabel}>통계치 기반 평가</span>
                  <span className={styles.scopeBoxValue}>유사 나이대 평균 수치 활용</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Deliverables */}
          <div className={`${styles.card} ${styles.cardOutput}`}>
            <div className={styles.cardIcon}>
              <i className="fas fa-chart-bar"></i>
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
                    <i className="fas fa-th-list"></i>
                  </div>
                  <p className={styles.outputLabel}>
                    카테고리별
                    <br />
                    상세 분석
                  </p>
                </div>
                <div className={`${styles.outputItem} ${styles.outputItemBorder}`}>
                  <div className={styles.outputIcon}>
                    <i className="fas fa-users"></i>
                  </div>
                  <p className={styles.outputLabel}>
                    벤치마크
                    <br />
                    비교 평가
                  </p>
                </div>
                <div className={`${styles.outputItem} ${styles.outputItemBorder}`}>
                  <div className={styles.outputIcon}>
                    <i className="fas fa-lightbulb"></i>
                  </div>
                  <p className={styles.outputLabel}>
                    구조적
                    <br />
                    개선 포인트
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

export default Section3OverviewPage;
