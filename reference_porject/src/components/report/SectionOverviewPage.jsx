import React from "react";
import styles from "./SectionOverviewPage.module.css";

/**
 * 섹션 개요 페이지 - 은퇴 준비 상태 진단
 */
function SectionOverviewPage() {
  return (
    <div className={styles.slideContainer}>
      {/* 배경 요소 */}
      <div className={styles.backgroundOverlay}></div>
      <div className={styles.accentLine}></div>

      {/* 왼쪽 섹션: 타이틀 & 번호 */}
      <div className={styles.leftSection}>
        <div className={styles.topBar}>
          <div className={styles.goldBar}></div>
        </div>
        <div className={styles.titleArea}>
          <div className={styles.bigNumber}>01</div>
          <p className={styles.sectionLabel}>Section Overview</p>
          <h2 className={styles.mainTitle}>
            은퇴 준비 상태<br />진단 개요
          </h2>
          <p className={styles.description}>
            현재 자산과 미래 현금흐름을 면밀히 분석하여 은퇴 목표 달성 가능성을
            객관적인 수치로 진단합니다.
          </p>
        </div>
      </div>

      {/* 오른쪽 섹션: 세부 카드 */}
      <div className={styles.rightSection}>
        <div className={styles.cardsContainer}>
          {/* Card 1: 진단 목적 */}
          <div className={`${styles.card} ${styles.cardPurpose}`}>
            <div className={styles.cardIcon}>
              <i className="fas fa-crosshairs"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.badge}>Purpose</span>
              진단 목적
            </h3>
            <div className={styles.cardContent}>
              <div className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  설정된 은퇴 목표와 가정의 <strong>정합성 검증</strong>
                </span>
              </div>
              <div className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  현재 상태 유지 시 은퇴 <strong>준비율(%) 정밀 진단</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: 분석 방법 */}
          <div className={`${styles.card} ${styles.cardMethod}`}>
            <div className={styles.cardIcon}>
              <i className="fas fa-calculator"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.badgeGray}>Method</span>
              분석 방법
            </h3>
            <p className={styles.cardDescription}>
              데이터 확인하고, 이를 기반으로 은퇴 준비 상태를 객관적으로
              진단합니다.
            </p>
            <div className={styles.stepContainer}>
              <div className={styles.step}>
                <span className={styles.stepLabel}>STEP 1</span>
                <span className={styles.stepText}>
                  제공 데이터 확인 및 검증
                </span>
              </div>
              <div className={styles.step}>
                <span className={styles.stepLabel}>STEP 2</span>
                <span className={styles.stepText}>데이터 분석 및 진단</span>
              </div>
            </div>
          </div>

          {/* Card 3: 핵심 산출물 */}
          <div className={`${styles.card} ${styles.cardOutput}`}>
            <div className={styles.cardIcon}>
              <i className="fas fa-file-contract"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.badgeGray}>Output</span>
              핵심 산출물
            </h3>
            <div className={styles.outputGrid}>
              <div className={styles.outputItem}>
                <div className={styles.outputIcon}>
                  <i className="fas fa-chart-pie"></i>
                </div>
                <p>은퇴자산 준비율</p>
              </div>
              <div className={`${styles.outputItem} ${styles.outputBorder}`}>
                <div className={styles.outputIcon}>
                  <i className="fas fa-money-bill-wave"></i>
                </div>
                <p>현금흐름 준비율</p>
              </div>
              <div className={`${styles.outputItem} ${styles.outputBorder}`}>
                <div className={styles.outputIcon}>
                  <i className="fas fa-hourglass-half"></i>
                </div>
                <p>자산 유지기간</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SectionOverviewPage;
