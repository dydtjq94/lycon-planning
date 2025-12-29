import React from "react";
import styles from "./Section2OverviewPage.module.css";

/**
 * 섹션 2 개요 - 가계 재무현황 진단 (Page 7)
 */
function Section2OverviewPage() {
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
        <div className={styles.titleArea}>
          <p className={styles.sectionLabel}>Section Overview</p>
          <h2 className={styles.sectionTitle}>
            가계 재무현황
            <br />
            진단 개요
          </h2>
          <p className={styles.sectionDescription}>
            자산, 부채, 현금흐름의 구조와 건전성을
            <br />
            종합적으로 파악하여 가계 경제의
            <br />
            재무적 안정성을 정밀 진단합니다.
          </p>
        </div>
      </div>

      {/* Right Section: Detail Cards */}
      <div className={styles.rightSection}>
        <div className={styles.cardsContainer}>
          {/* Card 1: Scope */}
          <div className={`${styles.card} ${styles.cardHighlight}`}>
            <div className={styles.cardIcon}>
              <i className="fas fa-search-dollar"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.cardBadge}>Scope</span>
              진단 범위
            </h3>
            <div className={styles.cardContent}>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  자산 및 부채의 <strong>구조적 건전성</strong> 파악
                </span>
              </p>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  월간/연간 현금흐름의 <strong>유입·유출 패턴</strong> 분석
                </span>
              </p>
            </div>
          </div>

          {/* Card 2: Key Questions */}
          <div className={styles.card}>
            <div className={styles.cardIcon}>
              <i className="fas fa-question-circle"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.cardBadge}>Key Question</span>
              핵심 질문
            </h3>
            <div className={styles.cardContent}>
              <p className={styles.cardDescription}>
                재무적 안정성을 결정짓는 3가지 핵심 요소를 점검합니다.
              </p>
              <div className={styles.keyQuestionGrid}>
                <div className={styles.keyQuestionItem}>
                  <span className={styles.keyQuestionLabel}>Liquidity</span>
                  <span className={styles.keyQuestionValue}>유동성</span>
                </div>
                <div className={styles.keyQuestionItem}>
                  <span className={styles.keyQuestionLabel}>Leverage</span>
                  <span className={styles.keyQuestionValue}>부채 적정성</span>
                </div>
                <div className={styles.keyQuestionItem}>
                  <span className={styles.keyQuestionLabel}>Buffer</span>
                  <span className={styles.keyQuestionValue}>현금 버퍼</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Deliverables */}
          <div className={styles.card}>
            <div className={styles.cardIcon}>
              <i className="fas fa-file-invoice"></i>
            </div>
            <h3 className={styles.cardTitle}>
              <span className={styles.cardBadge}>Output</span>
              핵심 산출물
            </h3>
            <div className={styles.cardContent}>
              <div className={styles.outputGrid}>
                <div className={styles.outputItem}>
                  <div className={styles.outputIcon}>
                    <i className="fas fa-chart-pie"></i>
                  </div>
                  <p className={styles.outputLabel}>자산구성 스냅샷</p>
                </div>
                <div className={styles.outputItem}>
                  <div className={styles.outputIcon}>
                    <i className="fas fa-shield-alt"></i>
                  </div>
                  <p className={styles.outputLabel}>유동성 커버리지</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Section2OverviewPage;
