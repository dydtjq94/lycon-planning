import React, { useRef, useEffect } from "react";
import * as echarts from "echarts";
import styles from "./PortfolioHoldingsPage.module.css";

/**
 * 투자 포트폴리오 구성 현황 (Page 23)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function PortfolioHoldingsPage({ profile, simulationData }) {
  const chartRef = useRef(null);

  // 하드코딩 값
  const domesticTotal = 6800; // 국내 주식 및 ETF: 6,800만원
  const foreignTotal = 33200; // 해외 주식 및 ETF: 33,200만원
  const totalInvestment = 40000; // 평가금액 합계: 40,000만원

  const domesticRatio = 17.0; // 국내 비중: 17.0%
  const foreignRatio = 83.0; // 해외 비중: 83.0%

  // 차트 초기화
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(11, 24, 40, 0.95)",
        borderColor: "#4B5563",
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: "{b}: {c}만원 ({d}%)",
      },
      legend: {
        orient: "horizontal",
        bottom: "0",
        left: "center",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: "#9CA3AF",
          fontSize: 11,
        },
      },
      series: [
        {
          name: "투자자산 구성",
          type: "pie",
          radius: ["40%", "70%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 5,
            borderColor: "#0B1828",
            borderWidth: 2,
          },
          label: {
            show: true,
            position: "inside",
            color: "#fff",
            fontSize: 11,
            formatter: "{d}%",
            fontWeight: "bold",
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: "bold",
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            {
              value: 6800,
              name: "국내 주식 및 ETF",
              itemStyle: { color: "#3B82F6" },
            },
            {
              value: 33200,
              name: "해외 주식 및 ETF",
              itemStyle: { color: "#10B981" },
            },
          ],
        },
      ],
    };

    chart.setOption(option);

    return () => chart.dispose();
  }, []);

  return (
    <div className={styles.slideContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadges}>
            <span className={styles.stepBadge}>STEP 3</span>
            <span className={styles.sectionBadge}>Holdings Analysis</span>
          </div>
          <h1 className={styles.headerTitle}>투자 포트폴리오 구성 현황</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>금융자산 중 투자자산의 세부 구성과 종목 현황을 분석하여</p>
          <p>집중도와 분산도를 평가하고 최적화 방향을 도출합니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          <div className={styles.distributionCard}>
            <h3 className={styles.cardTitle}>
              <i className="fas fa-chart-pie"></i> 투자자산 구성 비율
            </h3>

            {/* Chart */}
            <div className={styles.chartContainer} ref={chartRef}></div>

            {/* Summary Table */}
            <div className={styles.summaryTable}>
              <table>
                <thead>
                  <tr>
                    <th>자산군</th>
                    <th className={styles.thRight}>평가금액 (만원)</th>
                    <th className={styles.thRight}>비중</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className={styles.dotBlue}></span>
                      <span className={styles.assetName}>
                        국내 주식 및 ETF
                      </span>
                    </td>
                    <td className={styles.tdAmount}>6,800</td>
                    <td className={styles.tdRatioBlue}>17.0%</td>
                  </tr>
                  <tr>
                    <td>
                      <span className={styles.dotGreen}></span>
                      <span>해외 주식 및 ETF</span>
                    </td>
                    <td className={styles.tdAmount}>33,200</td>
                    <td className={styles.tdRatio}>83.0%</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td className={styles.tfootLabel}>평가금액 합계</td>
                    <td className={styles.tfootAmount}>40,000</td>
                    <td className={styles.tfootRatio}>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          {/* Top Holdings */}
          <div className={styles.holdingsCard}>
            <h3 className={styles.cardTitleSmall}>
              <i className="fas fa-trophy"></i> 상위 10대 종목 현황
            </h3>
            <div className={styles.holdingsTableContainer}>
              <table className={styles.holdingsTable}>
                <thead>
                  <tr>
                    <th>종목명</th>
                    <th>유형</th>
                    <th className={styles.thRight}>평가금액 (만원)</th>
                    <th className={styles.thRight}>비중</th>
                    <th className={styles.thRight}>수익률</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan="5" className={styles.emptyState}>
                      <div className={styles.emptyStateContent}>
                        <i className="fas fa-spinner fa-spin"></i>
                        <p className={styles.emptyStateText}>
                          데이터 수집 중...
                        </p>
                        <p className={styles.emptyStateSubtext}>
                          종목별 상세 데이터를 준비하고 있습니다.
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Portfolio Stats */}
          <div className={styles.statsCard}>
            <h3 className={styles.cardTitleSmall}>
              <i className="fas fa-chart-bar"></i> 포트폴리오 집중도 및 분산도
              지표
            </h3>
            <div className={styles.statsGrid}>
              {/* Stat 1 */}
              <div className={styles.statBox}>
                <h4 className={styles.statTitle}>
                  <i className="fas fa-bullseye"></i> 상위 5종목 집중도
                </h4>
                <div className={styles.statContent}>
                  <i className="fas fa-spinner fa-pulse"></i>
                  <p className={styles.statPlaceholder}>데이터 수집 중...</p>
                </div>
              </div>

              {/* Stat 2 */}
              <div className={styles.statBox}>
                <h4 className={styles.statTitle}>
                  <i className="fas fa-project-diagram"></i> 분산 지수 (HHI)
                </h4>
                <div className={styles.statContent}>
                  <i className="fas fa-spinner fa-pulse"></i>
                  <p className={styles.statPlaceholder}>데이터 수집 중...</p>
                </div>
              </div>

              {/* Stat 3 */}
              <div className={styles.statBox}>
                <h4 className={styles.statTitle}>
                  <i className="fas fa-balance-scale"></i> 유동성 수준
                </h4>
                <div className={styles.statContent}>
                  <i className="fas fa-spinner fa-pulse"></i>
                  <p className={styles.statPlaceholder}>데이터 수집 중...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PortfolioHoldingsPage;
