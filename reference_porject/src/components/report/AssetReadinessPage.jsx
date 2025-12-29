import React, { useRef } from "react";
import ReactECharts from "echarts-for-react";
import styles from "./AssetReadinessPage.module.css";

/**
 * 은퇴 자산 준비율 진단 페이지 (Page 5)
 * 하드코딩된 데모 데이터 사용
 */
function AssetReadinessPage({ profile, simulationData }) {
  // 하드코딩된 데모 데이터
  const currentAge = 60;
  const retirementAge = 65;
  const projectedAssets = 74.6; // 억원
  const targetAssets = 70; // 억원
  const achievementRate = 106.6; // %
  const currentTotalAssets = 63.5; // 억원
  const realEstateRatio = 90.7; // %
  const cagr = 3.3; // %

  // 차트 데이터
  const years = [
    "60세(25년)",
    "61세(26년)",
    "62세(27년)",
    "63세(28년)",
    "64세(29년)",
    "65세(30년)",
  ];
  const currentTrend = [63.52, 65.72, 68.0, 69.37, 71.83, 74.62];
  const targetTrend = [70, 70, 70, 70, 70, 70];

  // ECharts 옵션
  const getChartOption = () => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(11, 24, 40, 0.9)",
      borderColor: "#374151",
      textStyle: { color: "#fff" },
      valueFormatter: (value) => value + " 억원",
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "15%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: years,
      axisLine: { lineStyle: { color: "#4B5563" } },
      axisLabel: { color: "#9CA3AF", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      name: "(단위: 억원)",
      min: 60,
      max: 80,
      nameTextStyle: { color: "#6B7280", padding: [0, 30, 0, 0] },
      splitLine: { lineStyle: { color: "#1F2937", type: "dashed" } },
      axisLabel: { color: "#9CA3AF" },
    },
    series: [
      {
        name: "목표 자산 (70억)",
        type: "line",
        data: targetTrend,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 2, color: "#D4AF37", type: "dashed" },
        itemStyle: { color: "#D4AF37" },
        markPoint: {
          data: [
            {
              value: "목표 70억",
              coord: [0, 70],
              itemStyle: { color: "#D4AF37" },
              label: { offset: [0, -10], color: "#D4AF37" },
            },
          ],
          symbol: "rect",
          symbolSize: [0, 0],
        },
      },
      {
        name: "예상 자산 경로",
        type: "line",
        data: currentTrend,
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        lineStyle: { width: 3, color: "#10B981" },
        itemStyle: { color: "#10B981", borderColor: "#fff", borderWidth: 1 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(16, 185, 129, 0.2)" },
              { offset: 1, color: "rgba(16, 185, 129, 0)" },
            ],
          },
        },
        markPoint: {
          data: [
            {
              value: "74.6억",
              coord: [5, 74.62],
              itemStyle: { color: "#10B981" },
              label: { color: "#fff" },
            },
          ],
          symbolSize: 40,
          symbolOffset: [0, -10],
        },
      },
    ],
  });

  return (
    <div className={styles.slideContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadges}>
            <span className={styles.stepBadge}>STEP 1-2</span>
            <span className={styles.sectionBadge}>Retirement Asset Goal</span>
          </div>
          <h1 className={styles.headerTitle}>은퇴 자산 준비율 진단</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>현재 상태 유지 시 예상되는 은퇴 시점의 자산 규모와</p>
          <p>목표 대비 달성률을 분석한 핵심 지표입니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Top Row: KPI Cards */}
        <div className={styles.kpiGrid}>
          {/* KPI 1: Projected Assets */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconBg}>
              <i className="fas fa-piggy-bank"></i>
            </div>
            <p className={styles.kpiLabel}>예상 은퇴자산 (65세)</p>
            <div className={styles.kpiValueRow}>
              <p className={styles.kpiValue}>
                {projectedAssets} <span className={styles.kpiUnit}>억원</span>
              </p>
            </div>
          </div>

          {/* KPI 2: Achievement Rate */}
          <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
            <div className={styles.kpiIconBg}>
              <i className="fas fa-chart-pie"></i>
            </div>
            <p className={styles.kpiLabel}>목표 달성률</p>
            <div className={styles.kpiValueRow}>
              <p className={styles.kpiValue} style={{ color: "#10B981" }}>
                {achievementRate}
              </p>
              <span className={styles.kpiUnit}>%</span>
            </div>
            <p className={styles.kpiStatus}>
              <i className="fas fa-check-circle"></i>안정권 진입 (Green)
            </p>
          </div>

          {/* KPI 3: Current Total Assets */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconBg}>
              <i className="fas fa-wallet"></i>
            </div>
            <p className={styles.kpiLabel}>현재 총자산 (60세)</p>
            <div className={styles.kpiValueRow}>
              <p className={styles.kpiValue}>
                {currentTotalAssets}{" "}
                <span className={styles.kpiUnit}>억원</span>
              </p>
            </div>
          </div>

          {/* KPI 4: Asset Growth Rate */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconBg}>
              <i className="fas fa-chart-line"></i>
            </div>
            <p className={styles.kpiLabel}>자산 성장률 (CAGR)</p>
            <div className={styles.kpiValueRow}>
              <p className={styles.kpiValue} style={{ color: "#D4AF37" }}>
                {cagr}
              </p>
              <span className={styles.kpiUnit}>%</span>
            </div>
          </div>
        </div>

        {/* Bottom Row: Chart & Analysis */}
        <div className={styles.bottomRow}>
          {/* Chart Area */}
          <div className={styles.chartContainer}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>
                <i className="fas fa-chart-area"></i>자산 성장 시뮬레이션
                (60세~65세)
              </h3>
              <div className={styles.chartLegend}>
                <div className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ backgroundColor: "#6B7280" }}
                  ></span>
                  <span>예상 경로</span>
                </div>
                <div className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ backgroundColor: "#D4AF37" }}
                  ></span>
                  <span>목표 자산(70억)</span>
                </div>
              </div>
            </div>
            <div className={styles.chartWrapper}>
              <ReactECharts
                option={getChartOption()}
                style={{ height: "100%", width: "100%" }}
              />
            </div>
          </div>

          {/* Analysis & Insights */}
          <div className={styles.analysisContainer}>
            <div className={styles.analysisTopBar}></div>
            <div className={styles.analysisContent}>
              <h3 className={styles.analysisTitle}>
                <i className="fas fa-lightbulb"></i>
                <span>진단 및 인사이트</span>
              </h3>
              <div className={styles.insightsList}>
                {/* Insight 1: 목표 초과 달성 */}
                <div className={styles.insightItem}>
                  <div className={styles.insightIconGreen}>
                    <i className="fas fa-check"></i>
                  </div>
                  <div className={styles.insightContent}>
                    <p className={styles.insightTitleGreen}>
                      목표 초과 달성 (Excellent)
                    </p>
                    <p className={styles.insightText}>
                      현재 자산 규모와 성장세를 고려할 때, 은퇴 시점(65세)에
                      목표 자산 70억원을 초과한 약 74.6억원이 예상됩니다.
                    </p>
                  </div>
                </div>

                {/* Insight 2: 현금흐름/유동성 리스크 */}
                <div className={styles.insightItem}>
                  <div className={styles.insightIconYellow}>
                    <i className="fas fa-exclamation"></i>
                  </div>
                  <div className={styles.insightContent}>
                    <p className={styles.insightTitleYellow}>
                      현금흐름/유동성 리스크
                    </p>
                    <p className={styles.insightText}>
                      자산은 충분하나 현금흐름이 적자(-208만원)이며, 부동산
                      비중(90.7%)이 과도하여 유동성 확보가 시급합니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommended Action Box */}
            <div className={styles.actionBox}>
              <p className={styles.actionLabel}>Recommended Action</p>
              <p className={styles.actionText}>
                <span>현금 비중 확대 및 지출 통제</span>
                <span className={styles.actionHighlight}>
                  유동성 확보 <i className="fas fa-arrow-right"></i>
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssetReadinessPage;
