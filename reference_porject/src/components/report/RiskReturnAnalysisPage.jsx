import React, { useRef, useEffect } from "react";
import * as echarts from "echarts";
import styles from "./RiskReturnAnalysisPage.module.css";

/**
 * 리스크-수익률 기반 자산 점검 (Page 25)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function RiskReturnAnalysisPage({ profile, simulationData }) {
  const chartRef = useRef(null);

  // 하드코딩 값
  const netRentalReturn = 0.57; // 임대부동산 실질수익 0.57%
  const foreignRatio = 83; // 해외자산 83%

  // 차트 초기화
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: function (params) {
          return `<b>${params.data.name}</b><br/>수익률: ${params.data.value[0]}%<br/>리스크: ${params.data.value[1]}`;
        },
        backgroundColor: "rgba(11, 24, 40, 0.9)",
        borderColor: "#4B5563",
        textStyle: { color: "#fff" },
      },
      grid: {
        top: "15%",
        right: "8%",
        bottom: "12%",
        left: "6%",
        containLabel: true,
      },
      xAxis: {
        type: "value",
        name: "기대 수익률 (Return %)",
        nameLocation: "middle",
        nameGap: 35,
        min: 0,
        max: 10,
        splitLine: {
          show: true,
          lineStyle: { color: "rgba(255,255,255,0.08)", type: "dashed" },
        },
        axisLine: { lineStyle: { color: "#6B7280" } },
        axisLabel: { color: "#9CA3AF", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        name: "리스크 수준 (Risk Index)",
        nameLocation: "middle",
        nameGap: 40,
        min: 0,
        max: 8,
        splitLine: {
          show: true,
          lineStyle: { color: "rgba(255,255,255,0.08)", type: "dashed" },
        },
        axisLine: { lineStyle: { color: "#6B7280" } },
        axisLabel: { color: "#9CA3AF", fontSize: 11 },
      },
      series: [
        {
          type: "scatter",
          symbolSize: 45,
          itemStyle: {
            shadowBlur: 15,
            shadowColor: "rgba(0,0,0,0.5)",
            borderColor: "#fff",
            borderWidth: 1,
          },
          data: [
            {
              value: [0.57, 5.0],
              name: "현재: 임대부동산",
              itemStyle: { color: "#F97316" },
              label: {
                show: true,
                formatter: "임대부동산\n(0.57%, 5.0)",
                position: "top",
                color: "#F97316",
                fontSize: 12,
                fontWeight: "bold",
                backgroundColor: "rgba(11, 24, 40, 0.7)",
                padding: [4, 8],
                borderRadius: 4,
              },
            },
            {
              value: [3.0, 5.0],
              name: "현재: 금융투자",
              itemStyle: { color: "#EAB308" },
              label: {
                show: true,
                formatter: "금융투자\n(3.0%, 5.0)",
                position: "bottom",
                color: "#EAB308",
                fontSize: 12,
                fontWeight: "bold",
                backgroundColor: "rgba(11, 24, 40, 0.7)",
                padding: [4, 8],
                borderRadius: 4,
              },
            },
            {
              value: [4.0, 3.5],
              name: "현재: 보유부동산",
              itemStyle: { color: "#3B82F6" },
              label: {
                show: true,
                formatter: "보유부동산\n(4.0%, 3.5)",
                position: "left",
                color: "#3B82F6",
                fontSize: 12,
                fontWeight: "bold",
                backgroundColor: "rgba(11, 24, 40, 0.7)",
                padding: [4, 8],
                borderRadius: 4,
              },
            },
            {
              value: [7.0, 3.5],
              name: "목표 포트폴리오",
              itemStyle: { color: "#10B981" },
              label: {
                show: true,
                formatter: "목표 포트폴리오\n(7.0%, 3.5)",
                position: "right",
                color: "#10B981",
                fontSize: 13,
                fontWeight: "bold",
                backgroundColor: "rgba(11, 24, 40, 0.7)",
                padding: [4, 8],
                borderRadius: 4,
              },
            },
          ],
          markArea: {
            silent: true,
            itemStyle: {
              color: "transparent",
              borderWidth: 1,
              borderType: "dashed",
            },
            data: [
              [
                {
                  name: "Efficient Zone",
                  xAxis: 5,
                  yAxis: 0,
                  itemStyle: { color: "rgba(16, 185, 129, 0.05)" },
                  label: {
                    show: true,
                    position: "insideBottomRight",
                    color: "#059669",
                    fontSize: 11,
                    formatter: "Efficient Zone",
                  },
                },
                { xAxis: 10, yAxis: 4 },
              ],
            ],
          },
        },
        // Arrow: Rental Real Estate to Target
        {
          type: "lines",
          coordinateSystem: "cartesian2d",
          zlevel: 3,
          effect: {
            show: true,
            period: 3,
            trailLength: 0.2,
            symbol: "arrow",
            symbolSize: 12,
          },
          lineStyle: {
            color: "#22C55E",
            width: 3,
            opacity: 0.7,
            curveness: 0.15,
            type: "solid",
          },
          data: [{ coords: [[0.57, 5.0], [7.0, 3.5]] }],
        },
        // Arrow: Financial to Target
        {
          type: "lines",
          coordinateSystem: "cartesian2d",
          zlevel: 3,
          effect: {
            show: true,
            period: 3,
            trailLength: 0.2,
            symbol: "arrow",
            symbolSize: 12,
          },
          lineStyle: {
            color: "#22C55E",
            width: 3,
            opacity: 0.7,
            curveness: -0.15,
            type: "solid",
          },
          data: [{ coords: [[3.0, 5.0], [7.0, 3.5]] }],
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
            <span className={styles.stepBadge}>STEP 4</span>
            <span className={styles.sectionBadge}>Risk & Return Analysis</span>
          </div>
          <h1 className={styles.headerTitle}>리스크-수익률 기반 자산 점검</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>현재 자산의 리스크 대비 수익률을 분석하고 목표 포트폴리오의 타당성을 검증합니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Top: Risk/Return Matrix Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>
              <i className="fas fa-chart-scatter"></i>
              리스크-수익률 매트릭스 (Risk-Return Matrix)
            </h3>
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: "#F97316" }}
                ></span>
                현재(임대)
              </div>
              <div className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: "#3B82F6" }}
                ></span>
                현재(보유)
              </div>
              <div className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: "#EAB308" }}
                ></span>
                현재(금융)
              </div>
              <div className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: "#10B981" }}
                ></span>
                목표(Target)
              </div>
            </div>
          </div>
          <div className={styles.chartContainer} ref={chartRef}></div>
        </div>

        {/* Bottom: Risk Rationale Cards */}
        <div className={styles.rationaleGrid}>
          {/* Card 1: Rental Real Estate */}
          <div
            className={`${styles.rationaleCard} ${styles.cardOrange}`}
          >
            <div className={styles.rationaleHeader}>
              <h4 className={styles.rationaleTitle}>
                임대부동산 리스크 (Risk 5.0)
              </h4>
              <span className={styles.badgeDanger}>심각한 구조적 문제</span>
            </div>
            <ul className={styles.rationaleList}>
              <li>
                <i className="fas fa-exclamation-circle"></i>
                <p>
                  <strong>역마진:</strong> 실질수익 0.57% (이자 79% 잠식)
                </p>
              </li>
              <li>
                <i className="fas fa-exclamation-circle"></i>
                <p>
                  <strong>금리 리스크:</strong> 1%p 상승 시 실질 손실 전환
                  가능성
                </p>
              </li>
            </ul>
          </div>

          {/* Card 2: Owned Real Estate */}
          <div className={`${styles.rationaleCard} ${styles.cardBlue}`}>
            <div className={styles.rationaleHeader}>
              <h4 className={styles.rationaleTitle}>
                보유 부동산 리스크 (Risk 3.5)
              </h4>
              <span className={styles.badgeBlue}>중위험 / 안정추구</span>
            </div>
            <ul className={styles.rationaleList}>
              <li>
                <i className="fas fa-home"></i>
                <p>
                  <strong>자본차익:</strong> 서울 부동산 연 4.0% 안정 상승
                </p>
              </li>
              <li>
                <i className="fas fa-exclamation-circle"></i>
                <p>
                  <strong>유동성:</strong> 즉시 매각 곤란 (세금 이슈)
                </p>
              </li>
            </ul>
          </div>

          {/* Card 3: Financial Investment */}
          <div
            className={`${styles.rationaleCard} ${styles.cardYellow}`}
          >
            <div className={styles.rationaleHeader}>
              <h4 className={styles.rationaleTitle}>
                금융투자 리스크 (Risk 5.0)
              </h4>
              <span className={styles.badgeYellow}>구조적 취약</span>
            </div>
            <ul className={styles.rationaleList}>
              <li>
                <i className="fas fa-exclamation-triangle"></i>
                <p>
                  <strong>환율:</strong> 해외자산 83% (환율 노출 심화)
                </p>
              </li>
              <li>
                <i className="fas fa-exclamation-triangle"></i>
                <p>
                  <strong>저수익:</strong> 수익률 3.0% (효율성 저조)
                </p>
              </li>
            </ul>
          </div>

          {/* Card 4: Target Portfolio */}
          <div
            className={`${styles.rationaleCard} ${styles.cardGreen}`}
          >
            <div className={styles.rationaleHeader}>
              <h4 className={styles.rationaleTitle}>
                목표 포트폴리오 (Risk 3.5)
              </h4>
              <span className={styles.badgeGreen}>개선 방향</span>
            </div>
            <ul className={styles.rationaleList}>
              <li>
                <i className="fas fa-check-circle"></i>
                <p>
                  <strong>분산:</strong> 자산 배분으로 변동성 축소
                </p>
              </li>
              <li>
                <i className="fas fa-check-circle"></i>
                <p>
                  <strong>인컴:</strong> 배당/이자 현금흐름 강화
                </p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RiskReturnAnalysisPage;
