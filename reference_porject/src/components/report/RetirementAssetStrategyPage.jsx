import React, { useRef, useEffect } from "react";
import * as echarts from "echarts";
import styles from "./RetirementAssetStrategyPage.module.css";

/**
 * 은퇴 시점 목표 자산 달성 전략 (Page 22)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function RetirementAssetStrategyPage({ profile, simulationData }) {
  const chartRef = useRef(null);

  // 하드코딩 값
  const retirementAge = 65;
  const targetAssets = 70; // 70억원
  const retirementAssets = 74.62; // 74.62억원
  const achievementRate = 107; // 107%
  const gap = 4.62; // +4.62억원

  // 시나리오별 예상 자산 (하드코딩)
  const scenario2 = 70.0; // 보수적 시나리오 (2%)
  const scenario3 = 74.62; // 기준 시나리오 (3%)
  const scenario4 = 78.5; // 적극적 시나리오 (4%)

  // 민감도 분석 (하드코딩)
  const sensitivity = {
    r20i20: 101,
    r20i25: 97,
    r20i30: 93,
    r30i20: 110,
    r30i25: 107,
    r30i30: 101,
    r40i20: 115,
    r40i25: 111,
    r40i30: 106,
  };

  // 차트 초기화
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(17, 24, 39, 0.9)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        textStyle: { color: "#F3F4F6" },
        formatter: function (params) {
          let result = params[0].axisValueLabel + "<br/>";
          params.forEach((item) => {
            result +=
              item.marker +
              " " +
              item.seriesName +
              ": " +
              item.value +
              "억원<br/>";
          });
          return result;
        },
      },
      legend: {
        data: ["목표 자산 (Target)", "예상 자산 (Projected)"],
        top: 0,
        right: 0,
        textStyle: { color: "#D1D5DB", fontSize: 10 },
        itemWidth: 12,
        itemHeight: 12,
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "10%",
        top: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: [
          "보수적 시나리오 (2%)",
          "기준 시나리오 (3%)",
          "적극적 시나리오 (4%)",
        ],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#D1D5DB",
          fontSize: 10,
          fontWeight: 500,
        },
      },
      yAxis: {
        type: "value",
        min: 60,
        max: 85,
        axisLine: { show: false },
        splitLine: {
          lineStyle: { color: "rgba(75, 85, 99, 0.2)" },
        },
        axisLabel: {
          color: "#9CA3AF",
          fontSize: 10,
          formatter: (value) => value + "억",
        },
      },
      series: [
        {
          name: "목표 자산 (Target)",
          type: "line",
          data: [70, 70, 70],
          lineStyle: {
            color: "#9CA3AF",
            width: 2,
            type: "dashed",
          },
          symbol: "none",
          z: 1,
        },
        {
          name: "예상 자산 (Projected)",
          type: "bar",
          data: [70.0, 74.62, 78.5],
          itemStyle: {
            color: function (params) {
              const colors = [
                "rgba(16, 185, 129, 0.6)",
                "rgba(16, 185, 129, 0.7)",
                "rgba(16, 185, 129, 0.8)",
              ];
              return colors[params.dataIndex];
            },
            borderColor: "rgba(16, 185, 129, 1)",
            borderWidth: 1,
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: "50%",
          label: {
            show: true,
            position: "top",
            color: "#fff",
            fontSize: 11,
            formatter: (params) => params.value + "억",
          },
          z: 2,
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
            <span className={styles.stepBadge}>STEP 2</span>
            <span className={styles.sectionBadge}>
              Retirement Asset Strategy
            </span>
          </div>
          <h1 className={styles.headerTitle}>은퇴 시점 목표 자산 달성 전략</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>
            은퇴 시점(65세)의 목표 자산과 예상 자산을 비교 분석하고,
          </p>
          <p>
            투자 수익률 및 물가 변동 시나리오에 따른 달성 가능성을 진단합니다.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          {/* Achievement Rate */}
          <div className={styles.achievementCard}>
            <div className={styles.achievementLabel}>
              목표 달성률 (Achievement Rate)
            </div>
            <div className={styles.achievementCircle}>
              <svg viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="#1F2937"
                  strokeWidth="12"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="12"
                  strokeDasharray="440"
                  strokeDashoffset="0"
                  transform="rotate(-90 80 80)"
                />
              </svg>
              <div className={styles.achievementValue}>
                <p className={styles.achievementNumber}>
                  107
                  <span>%</span>
                </p>
              </div>
            </div>
            <div className={styles.achievementStatus}>
              <p className={styles.achievementStatusText}>
                초과 달성 (Exceeding)
              </p>
              <p className={styles.achievementStatusNote}>
                목표 자산 대비 4.62억원 초과
              </p>
            </div>
          </div>

          {/* Gap Analysis */}
          <div className={styles.gapCard}>
            <div className={styles.gapHeader}>
              <p className={styles.gapLabel}>자산 격차 (Gap Analysis)</p>
              <div
                className={`${styles.gapBadge} ${styles.gapBadgePositive}`}
              >
                +4.62억원
              </div>
            </div>
            <div className={styles.gapContent}>
              <div className={styles.gapRow}>
                <div className={styles.gapRowLabel}>목표 자산 (Target)</div>
                <div className={styles.gapRowValue}>
                  70.0
                  <span>억원</span>
                </div>
              </div>
              <div className={styles.gapDivider}></div>
              <div className={styles.gapRow}>
                <div className={styles.gapRowLabel}>예상 자산 (Projected)</div>
                <div className={styles.gapRowValueHighlight}>
                  74.62
                  <span>억원</span>
                </div>
              </div>
            </div>
            <p className={styles.gapNote}>
              <i className="fas fa-info-circle"></i>
              65세 시점 기준, 투자수익률 연 3.0% 및 물가상승률 2.5%
              가정 시 시뮬레이션 결과입니다.
            </p>
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          {/* Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>
                <i className="fas fa-chart-bar"></i>
                투자 수익률 시나리오별 예상 자산 (65세 시점)
              </h3>
              <div className={styles.chartLegend}>
                <div className={styles.legendItem}>
                  <div className={styles.legendDotGray}></div>
                  <span>목표(70억)</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.legendDotGreen}></div>
                  <span>예상자산</span>
                </div>
              </div>
            </div>
            <div className={styles.chartContainer} ref={chartRef}></div>
          </div>

          {/* Bottom Row */}
          <div className={styles.bottomRow}>
            {/* Sensitivity Matrix */}
            <div className={styles.sensitivityCard}>
              <h3 className={styles.sensitivityTitle}>
                <i className="fas fa-table"></i>
                민감도 분석 (Sensitivity Analysis)
                <span className={styles.sensitivityUnit}>단위: 달성률(%)</span>
              </h3>
              <div className={styles.sensitivityGrid}>
                {/* Headers */}
                <div className={styles.headerCell}>수익\물가</div>
                <div className={styles.headerColCell}>2.0%(저)</div>
                <div className={`${styles.headerColCell} ${styles.highlight}`}>
                  2.5%(기본)
                </div>
                <div className={styles.headerColCell}>3.0%(고)</div>

                {/* Row 1 */}
                <div className={styles.headerRowCell}>2.0%</div>
                <div className={styles.cellHigh}>101%</div>
                <div className={styles.cellMid}>97%</div>
                <div className={styles.cellMid}>93%</div>

                {/* Row 2 */}
                <div className={`${styles.headerRowCell} ${styles.highlight}`}>
                  3.0%
                </div>
                <div className={styles.cellHigh}>110%</div>
                <div className={`${styles.cellHigh} ${styles.baseScenario}`}>
                  107%
                </div>
                <div className={styles.cellHigh}>101%</div>

                {/* Row 3 */}
                <div className={styles.headerRowCell}>4.0%</div>
                <div className={styles.cellHigh}>115%</div>
                <div className={styles.cellHigh}>111%</div>
                <div className={styles.cellHigh}>106%</div>
              </div>
            </div>

            {/* Action Guide */}
            <div className={styles.actionCard}>
              <h3 className={styles.actionTitle}>Strategic Insight</h3>
              <p className={styles.actionText}>
                현재 자산구성 유지 시{" "}
                <strong>목표 초과 달성이 예상</strong>
                되며, 수익률 및 물가 변동에도 안정적입니다.
              </p>
              <div className={styles.actionFooter}>
                <div className={styles.actionLabel}>권장 조치</div>
                <div className={styles.actionRecommend}>
                  <i className="fas fa-check-circle"></i>
                  <span>현재 자산 유지, 유동성 확보</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RetirementAssetStrategyPage;
