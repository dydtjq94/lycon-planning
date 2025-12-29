import React from "react";
import styles from "./CoverPage.module.css";

/**
 * 상담 보고서 표지 페이지
 * @param {Object} profile - 프로필 데이터
 * @param {String} reportType - 보고서 타입 (사전/basic/standard/premium)
 */
function CoverPage({ profile, reportType = "basic" }) {
  // 현재 날짜 포맷팅
  const formatDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  return (
    <div className={styles.slideContainer}>
      {/* 배경 장식 요소 */}
      <div className={`${styles.circleAccent} ${styles.circleAccent1}`}></div>
      <div className={`${styles.circleAccent} ${styles.circleAccent2}`}></div>

      {/* 장식용 라인 */}
      <div className={`${styles.lineAccent} ${styles.lineAccentVertical}`}></div>
      <div className={`${styles.lineAccent} ${styles.lineAccentHorizontal}`}></div>

      {/* 메인 콘텐츠 래퍼 */}
      <div className={styles.mainContent}>
        {/* 상단 로고/브랜드 영역 */}
        <div className={styles.topBrand}>
          <div className={styles.logoBox}>
            <i className="fas fa-chart-line"></i>
          </div>
          <p className={styles.brandText}>Lycon Planning</p>
        </div>

        {/* 타이틀 섹션 */}
        <div className={styles.titleSection}>
          <p className={styles.subtitle}>Retirement Planning & Diagnosis</p>
          <h1 className={styles.mainTitle}>
            은퇴 준비 현황 진단 프로그램
          </h1>
          <p className={styles.description}>
            <strong>4가지 핵심 진단 프로그램</strong>으로 은퇴 준비 상태를 진단합니다.
          </p>
          <p className={styles.descriptionSub}>
            현재 재무 상태를 기반으로 은퇴 준비 현황을 분석합니다.
          </p>
        </div>

        {/* 고객 정보 박스 */}
        <div className={styles.customerInfo}>
          <div className={styles.infoItem}>
            <i className="fas fa-user"></i>
            <p>
              고객명: <span className={styles.goldText}>{profile?.name || "고객"}님</span>
            </p>
          </div>
          <div className={styles.divider}></div>
          <div className={styles.infoItem}>
            <i className="fas fa-calendar"></i>
            <p>
              상담일시: <span className={styles.dateText}>{formatDate()}</span>
            </p>
          </div>
        </div>

        {/* 진단 프로그램 소개 */}
        <div className={styles.programIntro}>
          <div className={styles.programItem}>
            <div className={styles.programHeader}>
              <i className="fas fa-magnifying-glass-chart"></i>
              <p className={styles.programTitle}>정밀 진단</p>
            </div>
            <p className={styles.programDesc}>데이터 기반 목표/가정 검증</p>
          </div>

          <div className={styles.dividerVertical}></div>

          <div className={styles.programItem}>
            <div className={styles.programHeader}>
              <i className="fas fa-shield-halved"></i>
              <p className={styles.programTitle}>리스크 관리</p>
            </div>
            <p className={styles.programDesc}>예상 이벤트 및 재무 리스크 분석</p>
          </div>

          <div className={styles.dividerVertical}></div>

          <div className={styles.programItem}>
            <div className={styles.programHeader}>
              <i className="fas fa-compass-drafting"></i>
              <p className={styles.programTitle}>액션 플랜</p>
            </div>
            <p className={styles.programDesc}>현금흐름 개선 및 자산 배분 전략</p>
          </div>
        </div>
      </div>

      {/* 푸터 섹션 */}
      <div className={styles.footer}>
        <p></p>
        <div className={styles.footerRight}>
          <p>Confidential & Proprietary <span className={styles.separator}>|</span> Page 01</p>
        </div>
      </div>

      {/* 우측 추상 차트 요소 */}
      <div className={styles.abstractChart}>
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M45.7,-76.3C58.9,-69.3,69.1,-55.6,76.3,-41.2C83.5,-26.8,87.6,-11.7,85.3,2.3C83,16.3,74.3,29.2,64.5,40.3C54.7,51.4,43.8,60.7,31.6,66.6C19.4,72.5,5.9,75,-7.1,74.1C-20.1,73.2,-32.6,68.9,-43.9,61.7C-55.2,54.5,-65.3,44.4,-72.8,32.1C-80.3,19.8,-85.2,5.3,-83.3,-8.3C-81.4,-21.9,-72.7,-34.6,-61.9,-44.4C-51.1,-54.2,-38.2,-61.1,-25.2,-68.2C-12.2,-75.3,0.9,-82.6,15.1,-81.6C29.3,-80.6,44.6,-71.3,45.7,-76.3Z"
            fill="#D4AF37"
            transform="translate(100 100)"
          />
        </svg>
      </div>
    </div>
  );
}

export default CoverPage;
