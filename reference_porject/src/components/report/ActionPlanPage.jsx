import React from "react";
import styles from "./ActionPlanPage.module.css";

/**
 * 재무 구조 개선전략 (Action Plan) (Page 15)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function ActionPlanPage({ profile, simulationData }) {
  // 현금흐름 데이터
  const cashflow = simulationData?.simulation?.cashflow || [];
  const currentYearCashflow = cashflow[0] || {};

  // 총 소득 계산
  const totalIncome =
    (currentYearCashflow.income || 0) +
    (currentYearCashflow.pension || 0) +
    (currentYearCashflow.rentalIncome || 0) +
    (currentYearCashflow.assetIncome || 0);

  // 총 지출 계산
  const totalExpense =
    (currentYearCashflow.expense || 0) +
    (currentYearCashflow.savings || 0) +
    Math.abs(currentYearCashflow.debtInterest || 0) +
    Math.abs(currentYearCashflow.debtPrincipal || 0);

  // 현재 월 수지차
  const monthlyBalance = (totalIncome - totalExpense) / 12;

  // 지출 항목 추정
  const expenses = currentYearCashflow.expense || 0;
  const monthlyExpense = expenses / 12;

  // 주요 지출 항목 (월 기준)
  const foodExpense = monthlyExpense * 0.33; // 식비 33%
  const clothingExpense = monthlyExpense * 0.11; // 의류·잡화 11%
  const cultureExpense = monthlyExpense * 0.05; // 문화·여가 5%
  const utilitiesExpense = monthlyExpense * 0.08; // 공과금 8%
  const communicationExpense = monthlyExpense * 0.015; // 통신비 1.5%

  // 고정비 절감 목표 (통신비 + 공과금 일부)
  const fixedCostSavings = communicationExpense * 0.3 + utilitiesExpense * 0.1;

  // 변동비 절감 목표 (식비 20% + 의류 30% + 문화비 30%)
  const variableCostSavings =
    foodExpense * 0.2 + clothingExpense * 0.3 + cultureExpense * 0.3;

  // 총 절감액
  const totalSavings = fixedCostSavings + variableCostSavings;

  // 목표 흑자
  const targetSurplus = Math.abs(monthlyBalance) + totalSavings;

  // 예비비 목표 (월 소득의 5~10%)
  const monthlyIncome = totalIncome / 12;
  const emergencyFundMonthly = monthlyIncome * 0.075; // 7.5% (중간값)
  const emergencyFundAnnual = emergencyFundMonthly * 12;

  if (!simulationData || !cashflow || cashflow.length === 0) {
    return (
      <div className={styles.slideContainer}>
        <div className={styles.loading}>
          <i className="fas fa-spinner fa-spin"></i>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.slideContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadges}>
            <span className={styles.stepBadge}>STEP 3-4</span>
            <span className={styles.sectionBadge}>ACTION PLAN STRATEGY</span>
          </div>
          <h1 className={styles.headerTitle}>재무 구조 개선전략 (Action Plan)</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>
            현재의 월 {Math.abs(monthlyBalance).toFixed(1)}만원{" "}
            {monthlyBalance >= 0 ? "흑자" : "적자"} 구조를 월{" "}
            {targetSurplus.toFixed(0)}만원 흑자로 전환하기 위한 실질적 실행 계획입니다.
          </p>
          <p>변동비 중심의 강도 높은 지출 통제와 고정비 관리 효율화가 핵심입니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.cardsGrid}>
          {/* Card 1: 고정비 구조조정 */}
          <div className={styles.actionCard}>
            <div
              className={styles.cardAccent}
              style={{ backgroundColor: "#3B82F6" }}
            ></div>
            <div
              className={styles.actionIconBox}
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.2)",
                borderColor: "#1E40AF",
                color: "#60A5FA",
              }}
            >
              <i className="fas fa-sliders-h"></i>
            </div>
            <h3 className={styles.cardTitle}>고정비 관리 최적화</h3>
            <p className={styles.cardSubtitle} style={{ color: "#60A5FA" }}>
              고정 지출의 효율성 제고
            </p>
            <div className={styles.cardContent}>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>고정 지출 관리:</span> 자동이체일
                조정 및 월할 적립
              </p>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>통신/구독료:</span> 알뜰폰 전환 및
                미사용 구독 해지
              </p>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>주거비 최적화:</span> 대출 금리
                비교 및 대환 검토
              </p>
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.footerLabel}>월 예상 절감액</span>
              <span className={styles.footerValue}>
                {fixedCostSavings.toFixed(1)}
                <span className={styles.footerUnit}>만원</span>
              </span>
            </div>
          </div>

          {/* Card 2: 변동비 구조조정 */}
          <div className={styles.actionCard}>
            <div
              className={styles.cardAccent}
              style={{ backgroundColor: "#F59E0B" }}
            ></div>
            <div
              className={styles.actionIconBox}
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.2)",
                borderColor: "#D97706",
                color: "#FBBF24",
              }}
            >
              <i className="fas fa-scissors"></i>
            </div>
            <h3 className={styles.cardTitle}>변동비 통제</h3>
            <p className={styles.cardSubtitle} style={{ color: "#FBBF24" }}>
              식비/문화비 집중 감축 (-20%)
            </p>
            <div className={styles.cardContent}>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>
                  식비({foodExpense.toFixed(1)}만):
                </span>{" "}
                주단위 예산 및 배달 축소
              </p>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>
                  의류/잡화({clothingExpense.toFixed(1)}만):
                </span>{" "}
                구매 횟수 제한 (30% 절감)
              </p>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>
                  문화/여가({cultureExpense.toFixed(1)}만):
                </span>{" "}
                무료 혜택 활용 및 긴축
              </p>
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.footerLabel}>월 예상 절감액</span>
              <span className={styles.footerValue}>
                {variableCostSavings.toFixed(1)}
                <span className={styles.footerUnit}>만원</span>
              </span>
            </div>
          </div>

          {/* Card 3: 선저축 습관 */}
          <div className={styles.actionCard}>
            <div
              className={styles.cardAccent}
              style={{ backgroundColor: "#10B981" }}
            ></div>
            <div
              className={styles.actionIconBox}
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.2)",
                borderColor: "#059669",
                color: "#34D399",
              }}
            >
              <i className="fas fa-piggy-bank"></i>
            </div>
            <h3 className={styles.cardTitle}>선저축 시스템</h3>
            <p className={styles.cardSubtitle} style={{ color: "#34D399" }}>
              흑자 전환 및 강제 저축
            </p>
            <div className={styles.cardContent}>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>흑자 전환:</span> 월{" "}
                {Math.abs(monthlyBalance).toFixed(1)}만원{" "}
                {monthlyBalance >= 0 ? "흑자" : "적자"} →{" "}
                {targetSurplus.toFixed(1)}만원 흑자
              </p>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>자동이체:</span> 급여일 익일
                100% 자동 이체
              </p>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>파킹통장:</span> 단기
                유동자금(CMA) 활용
              </p>
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.footerLabel}>월 목표 흑자</span>
              <span className={styles.footerValue}>
                {targetSurplus.toFixed(0)}
                <span className={styles.footerUnit}>만원+</span>
              </span>
            </div>
          </div>

          {/* Card 4: 이벤트 지출 관리 */}
          <div className={styles.actionCard}>
            <div
              className={styles.cardAccent}
              style={{ backgroundColor: "#EF4444" }}
            ></div>
            <div
              className={styles.actionIconBox}
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.2)",
                borderColor: "#DC2626",
                color: "#F87171",
              }}
            >
              <i className="fas fa-calendar-check"></i>
            </div>
            <h3 className={styles.cardTitle}>이벤트 예비비</h3>
            <p className={styles.cardSubtitle} style={{ color: "#F87171" }}>
              비정기 지출 리스크 방어
            </p>
            <div className={styles.cardContent}>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>연간 예산:</span> 명절, 휴가,
                경조사비 별도 책정
              </p>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>예비비 적립:</span> 월 소득의
                5~10% 별도 계좌 이체
              </p>
              <p className={styles.checkItem}>
                <span className={styles.checkItemLabel}>보너스 활용:</span> 상여금 전액
                예비비 충당
              </p>
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.footerLabel}>연간 예비비 목표</span>
              <span className={styles.footerValue}>
                {emergencyFundAnnual.toFixed(0)}
                <span className={styles.footerUnit}>만원</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActionPlanPage;
