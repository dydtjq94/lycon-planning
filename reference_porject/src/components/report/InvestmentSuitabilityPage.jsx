import React from "react";
import styles from "./InvestmentSuitabilityPage.module.css";

/**
 * 투자 성향 및 적합성 평가 (Page 24)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function InvestmentSuitabilityPage({ profile, simulationData }) {
  // 하드코딩된 체크리스트 상태
  const checklist = {
    q1: true,   // 원금 손실 감내 - 체크됨
    q2: true,   // 장기 투자 - 체크됨
    q3: false,  // 비상 예비자금 - 체크안됨
    q4: true,   // 투자 경험 - 체크됨
    q5: true,   // 기대 수익률 - 체크됨
  };

  // 하드코딩 값
  const currentAge = 60;
  const realEstateRatio = 90; // 부동산 90% 집중
  const annualDeficit = 1100; // 연 1,100만원 부족

  // 하드코딩된 위험 성향
  const riskType = "안정형";
  const riskTypeEn = "Conservative";
  const psychologicalLevel = "보통";
  const financialLevel = "낮음";

  // 하드코딩된 적합성 등급
  const suitabilityRating = "주의";
  const suitabilityText = "주의 (Attention)";

  return (
    <div className={styles.slideContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadges}>
            <span className={styles.stepBadge}>STEP 3</span>
            <span className={styles.sectionBadge}>
              Investment Suitability
            </span>
          </div>
          <h1 className={styles.headerTitle}>투자 성향 및 적합성 평가</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.cardsGrid}>
          {/* Card 1: 투자 성향 체크리스트 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <i className="fas fa-list-check"></i>
              </div>
              <h2 className={styles.cardTitle}>
                투자 성향 자가진단 (Checklist)
              </h2>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.checklistItems}>
                <div className={styles.checklistItem}>
                  <p className={styles.checklistText}>
                    1. 원금의 <span>1~10% 손실</span>을 감내할 수 있습니까?
                  </p>
                  <i className={`fas fa-check-square ${styles.checked}`}></i>
                </div>
                <div className={styles.checklistItem}>
                  <p className={styles.checklistText}>
                    2. <span>5년 이상</span> 장기 투자가 가능합니까?
                  </p>
                  <i className={`fas fa-check-square ${styles.checked}`}></i>
                </div>
                <div className={styles.checklistItem}>
                  <p className={styles.checklistText}>
                    3. <span>3~6개월 생활비</span>(현금)를 확보했습니까?
                  </p>
                  <i className={`fas fa-square-xmark ${styles.unchecked}`}></i>
                </div>
                <div className={styles.checklistItem}>
                  <p className={styles.checklistText}>
                    4. 주식/펀드 투자 경험이 <span>3년 이상</span>입니까?
                  </p>
                  <i className={`fas fa-check-square ${styles.checked}`}></i>
                </div>
                <div className={styles.checklistItem}>
                  <p className={styles.checklistText}>
                    5. 연 <span>5~7% 수준</span>의 기대 수익을 추구합니까?
                  </p>
                  <i className={`fas fa-check-square ${styles.checked}`}></i>
                </div>
              </div>

              {/* 경고 메시지 (하드코딩) */}
              <div className={styles.warningBox}>
                <i className="fas fa-triangle-exclamation"></i>
                <p>경고: 비상 예비자금(유동성) 확보 미흡</p>
              </div>
            </div>
          </div>

          {/* Card 2: 위험 성향 매트릭스 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <i className="fas fa-chart-pie"></i>
              </div>
              <h2 className={styles.cardTitle}>위험 수용력 vs 감내도 분석</h2>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.matrixContainer}>
                <div className={styles.matrixWrapper}>
                  <div className={styles.axisLabelTop}>위험 감내도 (심리)</div>
                  <div className={styles.axisLabelLeft}>
                    위험 수용력 (재무)
                  </div>

                  <div className={styles.matrixGrid}>
                    <div className={styles.matrixCell}>
                      <span>공격형</span>
                    </div>
                    <div className={styles.matrixCell}>
                      <span>적극형</span>
                    </div>
                    <div className={styles.matrixCell}>
                      <span>중립형</span>
                    </div>
                    <div className={`${styles.matrixCell} ${styles.active}`}>
                      <div className={styles.activeDot}></div>
                      <span className={styles.activeText}>안정형</span>
                    </div>
                  </div>
                </div>

                <div className={styles.matrixSummary}>
                  <div className={styles.resultBox}>
                    <p className={styles.resultLabel}>진단 결과</p>
                    <p className={styles.resultValue}>안정 추구형</p>
                    <p className={styles.resultSubtext}>(Conservative)</p>
                  </div>
                  <div className={styles.resultDescription}>
                    <p>심리적 감내도 보통,</p>
                    <p className={styles.warning}>재무적 수용력 낮음</p>
                    <p>보수적 접근 요구됨</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: 적합성 진단 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <i className="fas fa-user-shield"></i>
              </div>
              <h2 className={styles.cardTitle}>
                투자 적합성 진단 (Fit Check)
              </h2>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.fitCheckItems}>
                <div className={styles.fitCheckBox}>
                  <div className={styles.fitCheckHeader}>
                    <i className="fas fa-hourglass-half"></i>
                    <p>
                      생애주기: <span>60세 (은퇴 임박)</span>
                    </p>
                  </div>
                  <p className={styles.fitCheckText}>
                    자산 증식보다는{" "}
                    <span>자산 보존 및 현금흐름 창출</span> 우선
                  </p>
                </div>

                <div className={styles.fitCheckBox}>
                  <div className={styles.fitCheckHeader}>
                    <i className="fas fa-wallet"></i>
                    <p>
                      현금흐름: <span>연 1,100만원 부족</span>
                    </p>
                  </div>
                  <p className={styles.fitCheckText}>
                    적극적 투자보다{" "}
                    <span>확정적 인컴(배당/이자) 확보</span> 시급
                  </p>
                </div>

                <div className={styles.fitCheckBox}>
                  <div className={styles.fitCheckHeader}>
                    <i className="fas fa-building"></i>
                    <p>
                      자산구성: <span>부동산 90% 집중</span>
                    </p>
                  </div>
                  <p className={styles.fitCheckText}>
                    환금성 위험 노출, <span>금융자산 비중 확대</span> 필수
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: 최종 판단 */}
          <div className={styles.card}>
            <div className={styles.cornerAccent}></div>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <i className="fas fa-lightbulb"></i>
              </div>
              <h2 className={styles.cardTitle}>최종 판단 및 고려사항</h2>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.finalJudgment}>
                <p className={styles.judgmentIntro}>
                  귀하의 포트폴리오는 <strong>유동성 부족</strong>과{" "}
                  <strong>부동산 편중</strong>으로 안정성 기준에{" "}
                  <span className={styles.unsuitable}>부적합</span>합니다.
                </p>

                <ul className={styles.actionList}>
                  <li>
                    <i className="fas fa-arrow-right"></i>
                    <span>
                      <strong>즉시 조치:</strong> 비상 예비자금(3~6개월)
                      최우선 확보
                    </span>
                  </li>
                  <li>
                    <i className="fas fa-arrow-right"></i>
                    <span>
                      <strong>자산 배분:</strong> 부동산 유동화 또는 담보대출
                      활용 검토
                    </span>
                  </li>
                  <li>
                    <i className="fas fa-arrow-right"></i>
                    <span>
                      <strong>투자 상품:</strong> 월지급식 ETF 등 인컴형 상품
                      편입
                    </span>
                  </li>
                </ul>

                <div className={styles.ratingBar}>
                  <span className={styles.ratingLabel}>적합성 등급</span>
                  <div className={styles.ratingIndicator}>
                    <div className={styles.ratingDots}>
                      <div
                        className={styles.dotGreen}
                        style={{ opacity: 0.2 }}
                      ></div>
                      <div
                        className={styles.dotYellow}
                        style={{ opacity: 0.2 }}
                      ></div>
                      <div
                        className={styles.dotRed}
                        style={{ opacity: 1 }}
                      ></div>
                    </div>
                    <span className={styles.ratingText}>주의 (Attention)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvestmentSuitabilityPage;
