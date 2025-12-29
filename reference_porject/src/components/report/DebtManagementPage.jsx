import React from "react";
import styles from "./DebtManagementPage.module.css";

/**
 * 부채 관리 및 상환 계획 (Page 10)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function DebtManagementPage({ profile, simulationData }) {
  // 현재 시점 자산/부채 데이터 추출
  const assets = simulationData?.simulation?.assets || [];
  const currentAsset = assets[0]?.breakdown || {};
  const debtItems = currentAsset.debtItems || [];

  // 총 부채
  const totalDebt = currentAsset.totalDebt || 0;

  // 부채 항목별 분류
  const debtsByType = debtItems.reduce((acc, item) => {
    if (item.label && item.label !== "현금" && item.amount > 0) {
      acc.push({
        name: item.label,
        amount: item.amount,
        sourceType: item.sourceType || "debt",
      });
    }
    return acc;
  }, []);

  // 가장 큰 부채 (주요 부채)
  const mainDebt = debtsByType.length > 0
    ? debtsByType.reduce((max, debt) => debt.amount > max.amount ? debt : max, debtsByType[0])
    : null;

  // 현금흐름 데이터
  const cashflow = simulationData?.simulation?.cashflow || [];
  const currentYearCashflow = cashflow[0] || {};

  // 임대소득
  const rentalIncome = currentYearCashflow.rentalIncome || 0;
  const monthlyRentalIncome = rentalIncome / 12;

  // 부채 이자 및 원금
  const debtInterest = Math.abs(currentYearCashflow.debtInterest || 0);
  const monthlyDebtInterest = debtInterest / 12;

  // 이자보상배율 (임대소득 / 이자비용)
  const interestCoverageRatio = debtInterest > 0 ? rentalIncome / debtInterest : 0;

  // 부채 비율
  const totalAssets = currentAsset.totalAssets || 0;
  const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;

  // 상환 계획 (부동산 매각 시점 찾기)
  const realEstateSales = cashflow.filter(year => (year.realEstateSale || 0) > 0);
  const plannedRepaymentYear = realEstateSales.length > 0
    ? realEstateSales[0].year
    : new Date().getFullYear() + 10;

  // DSR 계산 (총소득 대비 원리금 상환액)
  const annualIncome = currentYearCashflow.income || 0;
  const dsr = annualIncome > 0 ? (debtInterest / annualIncome) * 100 : 0;

  // 리스크 등급
  const getRiskLevel = () => {
    if (debtRatio < 30 && interestCoverageRatio > 2) return { level: "낮음", color: "#10B981" };
    if (debtRatio < 50 && interestCoverageRatio > 1.5) return { level: "보통", color: "#F59E0B" };
    return { level: "주의", color: "#EF4444" };
  };

  const riskLevel = getRiskLevel();

  // 레버리지 효과 (임대수익률 vs 이자율)
  const estimatedInterestRate = totalDebt > 0 ? (debtInterest / totalDebt) * 100 : 0;
  const rentalYield = totalDebt > 0 ? (rentalIncome / totalDebt) * 100 : 0;
  const leverageEffect = rentalYield > estimatedInterestRate;

  if (!simulationData || !assets || assets.length === 0) {
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
            <span className={styles.stepBadge}>STEP 2-3</span>
            <span className={styles.sectionBadge}>DEBT MANAGEMENT</span>
          </div>
          <h1 className={styles.headerTitle}>부채 관리 및 상환 계획</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>보유 중인 부채의 효율적 관리와 금리 리스크 방어 전략입니다.</p>
          <p>안정적인 현금흐름 유지를 위한 구체적인 상환 로드맵을 제시합니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.cardGrid}>
          {/* Card 1: 부채 현황 */}
          <div className={styles.card}>
            <div className={styles.cardAccent} style={{ backgroundColor: "#EF4444" }}></div>
            <div className={styles.iconBox} style={{
              backgroundColor: "rgba(239, 68, 68, 0.2)",
              borderColor: "#EF4444"
            }}>
              <i className="fas fa-building" style={{ color: "#EF4444" }}></i>
            </div>
            <h3 className={styles.cardTitle}>부채 현황 진단</h3>
            <p className={styles.cardSubtitle} style={{ color: "#EF4444" }}>
              {mainDebt ? `${mainDebt.name} 보유 중` : "부채 없음"}
            </p>
            <div className={styles.cardContent}>
              {totalDebt > 0 ? (
                <>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>대출 잔액:</span> {totalDebt.toFixed(1)}만원
                  </p>
                  {mainDebt && (
                    <p className={styles.checkItem}>
                      <span className={styles.itemLabel}>담보 물건:</span> {mainDebt.name}
                    </p>
                  )}
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>대출 성격:</span> {rentalIncome > 0 ? "레버리지 투자형" : "소비성 대출"}
                  </p>
                  {debtsByType.length > 1 && (
                    <p className={styles.checkItem}>
                      <span className={styles.itemLabel}>부채 건수:</span> {debtsByType.length}건
                    </p>
                  )}
                </>
              ) : (
                <p className={styles.checkItem}>
                  <span className={styles.itemLabel}>현재 부채가 없습니다</span>
                </p>
              )}
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.footerLabel}>총 대출금</span>
              <span className={styles.footerValue}>
                {(totalDebt / 10000).toFixed(1)}<span className={styles.footerUnit}>억원</span>
              </span>
            </div>
          </div>

          {/* Card 2: 상환 계획 */}
          <div className={styles.card}>
            <div className={styles.cardAccent} style={{ backgroundColor: "#3B82F6" }}></div>
            <div className={styles.iconBox} style={{
              backgroundColor: "rgba(59, 130, 246, 0.2)",
              borderColor: "#3B82F6"
            }}>
              <i className="fas fa-file-invoice-dollar" style={{ color: "#3B82F6" }}></i>
            </div>
            <h3 className={styles.cardTitle}>상환 로드맵</h3>
            <p className={styles.cardSubtitle} style={{ color: "#3B82F6" }}>
              {rentalIncome > 0 ? "임대 소득 활용 전략" : "정기 상환 계획"}
            </p>
            <div className={styles.cardContent}>
              {totalDebt > 0 ? (
                <>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>이자 상환:</span> {rentalIncome > 0 ? "임대 수입으로 충당" : "정기 소득으로 상환"}
                  </p>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>원금 상환:</span> {realEstateSales.length > 0 ? "자산 매도 후 상환" : "정기 분할 상환"}
                  </p>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>목표 시점:</span> {plannedRepaymentYear}년
                  </p>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>월 이자:</span> {monthlyDebtInterest.toFixed(1)}만원
                  </p>
                </>
              ) : (
                <p className={styles.checkItem}>
                  <span className={styles.itemLabel}>상환 계획이 필요하지 않습니다</span>
                </p>
              )}
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.footerLabel}>월 상환 재원</span>
              <span className={styles.footerValue}>
                {rentalIncome > 0 ? "임대수익" : "근로소득"}<span className={styles.footerUnit}>활용</span>
              </span>
            </div>
          </div>

          {/* Card 3: 금리 리스크 */}
          <div className={styles.card}>
            <div className={styles.cardAccent} style={{ backgroundColor: "#F59E0B" }}></div>
            <div className={styles.iconBox} style={{
              backgroundColor: "rgba(245, 158, 11, 0.2)",
              borderColor: "#F59E0B"
            }}>
              <i className="fas fa-chart-line" style={{ color: "#F59E0B" }}></i>
            </div>
            <h3 className={styles.cardTitle}>리스크 관리</h3>
            <p className={styles.cardSubtitle} style={{ color: "#F59E0B" }}>
              금리 변동성 방어 전략
            </p>
            <div className={styles.cardContent}>
              {totalDebt > 0 ? (
                <>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>금리 모니터링:</span> 6개월 단위 금리 점검
                  </p>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>대환 전략:</span> 금리 인하기 고정금리 전환
                  </p>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>유동성:</span> 비상금 확보로 이자 연체 방지
                  </p>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>DSR:</span> {dsr.toFixed(1)}% (소득 대비 이자)
                  </p>
                </>
              ) : (
                <p className={styles.checkItem}>
                  <span className={styles.itemLabel}>금리 리스크가 없습니다</span>
                </p>
              )}
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.footerLabel}>리스크 등급</span>
              <span className={styles.footerValue}>
                {riskLevel.level}<span className={styles.footerUnit}>({totalDebt > 0 ? "주의" : "안정"})</span>
              </span>
            </div>
          </div>

          {/* Card 4: 건전성 지표 */}
          <div className={styles.card}>
            <div className={styles.cardAccent} style={{ backgroundColor: "#10B981" }}></div>
            <div className={styles.iconBox} style={{
              backgroundColor: "rgba(16, 185, 129, 0.2)",
              borderColor: "#10B981"
            }}>
              <i className="fas fa-balance-scale" style={{ color: "#10B981" }}></i>
            </div>
            <h3 className={styles.cardTitle}>재무 건전성</h3>
            <p className={styles.cardSubtitle} style={{ color: "#10B981" }}>
              부채 비율 및 상환 여력
            </p>
            <div className={styles.cardContent}>
              {totalDebt > 0 ? (
                <>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>레버리지:</span> {leverageEffect ? "수익률 > 이자율 (양호)" : "수익률 < 이자율 (주의)"}
                  </p>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>DSCR:</span> {rentalIncome > 0 ? "임대소득으로 이자 커버 가능" : "근로소득으로 상환"}
                  </p>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>출구 전략:</span> {realEstateSales.length > 0 ? "자산 매각으로 상환" : "정기 분할 상환"}
                  </p>
                  <p className={styles.checkItem}>
                    <span className={styles.itemLabel}>부채 비율:</span> {debtRatio.toFixed(1)}%
                  </p>
                </>
              ) : (
                <p className={styles.checkItem}>
                  <span className={styles.itemLabel}>건전한 재무 상태입니다</span>
                </p>
              )}
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.footerLabel}>이자보상배율</span>
              <span className={styles.footerValue}>
                {interestCoverageRatio > 0 ? interestCoverageRatio.toFixed(1) : "N/A"}<span className={styles.footerUnit}>배 이상</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DebtManagementPage;
