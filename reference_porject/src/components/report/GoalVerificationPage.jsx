import React from "react";
import styles from "./GoalVerificationPage.module.css";

/**
 * 목표 확인 및 데이터 검증 페이지 (Page 4)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} financialData - 재무 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function GoalVerificationPage({ profile, financialData, simulationData }) {
  // 현재 나이와 은퇴 나이
  const currentAge = simulationData?.profile?.currentAge || profile?.age || 60;
  const retirementAge =
    simulationData?.profile?.retirementAge || profile?.retirementAge || 65;

  // targetAssets는 프로필에서 만원 단위로 저장됨
  // simulationData에서는 원 단위일 수 있으므로 둘 다 확인
  const rawTargetAssets = simulationData?.profile?.targetAssets ?? profile?.targetAssets ?? 0;
  // 프로필의 targetAssets는 만원 단위이므로 억원으로 변환: 만원 / 10000 = 억원
  const targetAssetsInBillion = rawTargetAssets / 10000;

  // 은퇴 연도 계산
  const currentYear = new Date().getFullYear();
  const retirementYear = currentYear + (retirementAge - currentAge);

  return (
    <div className={styles.slideContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadges}>
            <span className={styles.stepBadge}>STEP 1-1</span>
            <span className={styles.sectionBadge}>Checklist</span>
          </div>
          <h1 className={styles.headerTitle}>목표 확인 및 데이터 검증</h1>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.cardsGrid}>
          {/* Card 1: 재무 목표 확인 */}
          <div className={styles.card}>
            <div className={styles.cornerAccent}></div>
            <span className={styles.cardNumber}>01</span>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <i className="fas fa-bullseye"></i>
              </div>
              <h2 className={styles.cardTitle}>재무 목표 확인</h2>
            </div>
            <div className={styles.cardContent}>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  <strong>은퇴 시점:</strong> {retirementAge}세 ({retirementYear}
                  년) 은퇴 예정
                </span>
              </p>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  <strong>목표 자산:</strong> 은퇴 시점 순자산{" "}
                  <span className={styles.goldText}>
                    {targetAssetsInBillion.toFixed(0)}억원
                  </span>{" "}
                  달성
                </span>
              </p>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  <strong>목표 현금흐름:</strong> 은퇴 후 월{" "}
                  <span className={styles.goldText}>350만원</span> 희망
                </span>
              </p>
              <div className={styles.noteBox}>
                <p>
                  Note: {profile?.name || "고객"}님 요청에 따라 목표 자산을{" "}
                  {targetAssetsInBillion.toFixed(0)}억원으로 설정하여
                  시뮬레이션 진행
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: 기초 데이터 검증 */}
          <div className={styles.card}>
            <span className={styles.cardNumber}>02</span>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <i className="fas fa-clipboard-check"></i>
              </div>
              <h2 className={styles.cardTitle}>기초 데이터 검증</h2>
            </div>
            <div className={styles.cardContent}>
              <p className={styles.cardDescription}>
                다음 기초 데이터가 시뮬레이션에 반영되었습니다.
              </p>
              <div className={styles.dataItems}>
                <div className={styles.dataItem}>
                  <span className={styles.dataLabel}>
                    <i className="fas fa-wallet"></i> 소득: 근로(100) + 기타(300)
                    + 임대(100)
                  </span>
                  <span className={styles.dataStatus}>
                    <i className="fas fa-check"></i>반영완료
                  </span>
                </div>
                <div className={styles.dataItem}>
                  <span className={styles.dataLabel}>
                    <i className="fas fa-home"></i> 부동산: 거주주택 + 상가 보유
                  </span>
                  <span className={styles.dataStatus}>
                    <i className="fas fa-check"></i>반영완료
                  </span>
                </div>
                <div className={styles.dataItem}>
                  <span className={styles.dataLabel}>
                    <i className="fas fa-piggy-bank"></i> 연금: 퇴직연금 +
                    개인연금 운용
                  </span>
                  <span className={styles.dataStatus}>
                    <i className="fas fa-check"></i>반영완료
                  </span>
                </div>
              </div>
              <div className={styles.dataLoadButton}>
                <i className="fas fa-database"></i>데이터 로드 완료
              </div>
            </div>
          </div>

          {/* Card 3: 주요 생애 이벤트 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <i className="fas fa-calendar-days"></i>
              </div>
              <h2 className={styles.cardTitle}>주요 생애 이벤트 (Life Events)</h2>
            </div>
            <div className={styles.cardContent}>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  <strong>{currentYear + 3}년 ({currentAge + 3}세):</strong> 자녀
                  결혼자금 지원{" "}
                  <span className={styles.redText}>1억원</span> 지출
                </span>
              </p>
              <p className={styles.checkItem}>
                <i className="fas fa-check"></i>
                <span>
                  <strong>{currentYear + 7}년 ({currentAge + 7}세):</strong>{" "}
                  전세자금 대출{" "}
                  <span className={styles.greenText}>8억원</span> 운용 (재건축
                  이주)
                </span>
              </p>
              <div className={styles.eventBox}>
                <i className="fas fa-check"></i>
                <div>
                  <strong>{currentYear + 10}년 ({currentAge + 10}세) 이슈:</strong>
                  <span className={styles.eventDetail}>
                    - 재건축 분담금 <span className={styles.redText}>1억원</span>{" "}
                    지출
                  </span>
                  <span className={styles.eventDetail}>
                    - 상가담보대출{" "}
                    <span className={styles.redText}>2.1억원</span> 상환
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: 시뮬레이션 가정 */}
          <div className={styles.card}>
            <div className={styles.cornerAccentBottomRight}></div>
            <span className={styles.cardNumber}>04</span>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <i className="fas fa-sliders"></i>
              </div>
              <h2 className={styles.cardTitle}>주요 시뮬레이션 가정</h2>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.assumptionGrid}>
                <div className={styles.assumptionBox}>
                  <p className={styles.assumptionLabel}>은퇴 전 생활비</p>
                  <p className={styles.assumptionValue}>월 510만원</p>
                </div>
                <div className={styles.assumptionBox}>
                  <p className={styles.assumptionLabel}>은퇴 후 생활비</p>
                  <p className={styles.assumptionValue}>월 350만원</p>
                </div>
              </div>
              <div className={styles.inflationBox}>
                <p className={styles.assumptionLabel}>물가 상승률 가정</p>
                <div className={styles.inflationGrid}>
                  <span className={styles.inflationLabel}>생활비</span>
                  <span className={styles.inflationValue}>1.89%</span>
                  <span className={styles.inflationSeparator}>|</span>
                  <span className={styles.inflationLabel}>의료비</span>
                  <span className={styles.inflationValue}>2.5%</span>
                </div>
              </div>
              <p className={styles.infoText}>
                <i className="fas fa-info-circle"></i>
                <span>
                  상가 임대소득은 {currentYear + 10}년까지 반영되며, 이후
                  담보대출 상환과 함께 현금흐름 조정
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GoalVerificationPage;
