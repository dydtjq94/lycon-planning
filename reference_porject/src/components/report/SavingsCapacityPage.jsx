import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import styles from "./SavingsCapacityPage.module.css";

/**
 * 저축/투자 가능 현금흐름 구성 (Page 14)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function SavingsCapacityPage({ profile, simulationData }) {
  const chartRef = useRef(null);

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

  // 연간 수지차
  const annualCashflow = totalIncome - totalExpense;

  // 월 수지차
  const monthlyCashflow = annualCashflow / 12;

  // 현재 저축률 (소득 대비 잉여 비율)
  const savingsRate = totalIncome > 0 ? (annualCashflow / totalIncome) * 100 : 0;

  // 저축 여력 (양수면 저축 가능, 음수면 적자)
  const savingsCapacity = annualCashflow;
  const monthlySavingsCapacity = monthlyCashflow;

  // 권장 저축률 20% 달성을 위한 필요 금액
  const recommendedSavingsAmount = totalIncome * 0.2;
  const currentSavingsAmount = Math.max(0, annualCashflow);
  const gapToRecommended = recommendedSavingsAmount - currentSavingsAmount;
  const monthlyGapToRecommended = gapToRecommended / 12;

  // 60대 평균 저축률 (8~10%) 달성을 위한 필요 금액
  const averageSavingsRate = 0.09; // 9% (중간값)
  const averageSavingsAmount = totalIncome * averageSavingsRate;
  const gapToAverage = averageSavingsAmount - currentSavingsAmount;
  const monthlyGapToAverage = gapToAverage / 12;

  // 소비지출 비율 (총 지출 / 총 소득 * 100)
  const consumptionRate = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 100;

  // 적자(초과지출) 비율
  const deficitRate = savingsRate < 0 ? Math.abs(savingsRate) : 0;

  // 상태 판단
  const getStatus = () => {
    if (savingsRate >= 30) return { text: "이상적", color: "#D4AF37", severity: "excellent" };
    if (savingsRate >= 20) return { text: "양호", color: "#10B981", severity: "good" };
    if (savingsRate >= 8) return { text: "평균", color: "#F59E0B", severity: "average" };
    if (savingsRate >= 0) return { text: "미달", color: "#F59E0B", severity: "below" };
    return { text: "심각한 미달", color: "#EF4444", severity: "critical" };
  };

  const status = getStatus();

  // Chart
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    // 60대 평균: 소비 90%, 저축 10%
    // 나 현재: 소비 consumptionRate%, 저축 savingsRate% (음수면 적자)
    // 권장 모델: 소비 70%, 저축 30%

    const myConsumption = Math.min(consumptionRate, 100);
    const mySavings = savingsRate > 0 ? Math.min(savingsRate, 100) : 0;
    const myDeficit = savingsRate < 0 ? Math.min(Math.abs(savingsRate), 100) : 0;

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(11, 24, 40, 0.9)",
        borderColor: "#374151",
        textStyle: { color: "#fff" },
        formatter: (params) => {
          let res = params[0].name + "<br/>";
          params.forEach((param) => {
            if (param.value !== 0) {
              res += `${param.marker}${param.seriesName}: ${Math.abs(param.value).toFixed(1)}%<br/>`;
            }
          });
          return res;
        },
      },
      legend: {
        data: ["소비지출", "저축/투자", "적자(초과지출)"],
        textStyle: { color: "#9CA3AF", fontSize: 11 },
        bottom: 0,
        right: 0,
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: {
        left: "2%",
        right: "4%",
        bottom: "15%",
        top: "5%",
        containLabel: true,
      },
      xAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#1F2937", type: "dashed" } },
        axisLabel: {
          formatter: "{value}%",
          color: "#6B7280",
          fontSize: 10,
        },
      },
      yAxis: {
        type: "category",
        data: ["60대 평균", "나 (현재)", "권장 모델"],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#E5E7EB",
          fontWeight: "bold",
          fontSize: 11,
        },
      },
      series: [
        {
          name: "소비지출",
          type: "bar",
          stack: "total",
          barWidth: "45%",
          label: {
            show: true,
            position: "inside",
            formatter: (params) => params.value.toFixed(1) + "%",
            color: "#D1D5DB",
            fontSize: 11,
          },
          itemStyle: { color: "#4B5563" },
          data: [90, myConsumption, 70],
        },
        {
          name: "저축/투자",
          type: "bar",
          stack: "total",
          label: {
            show: true,
            position: "inside",
            formatter: (params) => {
              return params.value > 0 ? params.value.toFixed(1) + "%" : "";
            },
            fontWeight: "bold",
            color: "#0B1828",
            fontSize: 11,
          },
          itemStyle: { color: "#D4AF37" },
          data: [10, mySavings, 30],
        },
        {
          name: "적자(초과지출)",
          type: "bar",
          stack: "total",
          label: {
            show: true,
            position: "right",
            formatter: (params) => params.value.toFixed(1) + "%",
            fontWeight: "bold",
            color: "#EF4444",
            fontSize: 11,
          },
          itemStyle: { color: "#EF4444" },
          data: [0, myDeficit, 0],
        },
      ],
    };

    chart.setOption(option);

    return () => chart.dispose();
  }, [consumptionRate, savingsRate]);

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
            <span className={styles.stepBadge}>STEP 3-3</span>
            <span className={styles.sectionBadge}>SAVINGS & INVESTMENT CAPACITY</span>
          </div>
          <h1 className={styles.headerTitle}>저축/투자 가능 현금흐름 구성</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>현재 소득 대비 저축 여력을 분석하고, 연령대별 평균 및</p>
          <p>은퇴 목표 달성을 위한 권장 가이드라인과 비교 진단합니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* KPI Cards */}
        <div className={styles.kpiGrid}>
          {/* KPI 1: Current Savings Rate */}
          <div className={styles.kpiCard}>
            <i className={`fas fa-piggy-bank ${styles.kpiIcon}`}></i>
            <p className={styles.kpiLabel}>
              현재 저축률 {savingsRate < 0 ? "(적자)" : ""}
            </p>
            <div className={styles.kpiValue}>
              <span className={styles.kpiNumber} style={{ color: status.color }}>
                {savingsRate.toFixed(1)}
              </span>
              <span className={styles.kpiUnit}>%</span>
            </div>
            <p className={styles.kpiNote}>
              <span style={{ color: "#6b7280", marginRight: "4px" }}>
                권장(20%↑) 대비
              </span>
              <strong style={{ color: status.color }}>{status.text}</strong>
            </p>
          </div>

          {/* KPI 2: Monthly Cashflow */}
          <div className={styles.kpiCard}>
            <i className={`fas fa-hand-holding-dollar ${styles.kpiIcon}`}></i>
            <p className={styles.kpiLabel}>
              월 현금 {monthlyCashflow >= 0 ? "잉여액" : "부족액"}
            </p>
            <div className={styles.kpiValue}>
              <span
                className={styles.kpiNumber}
                style={{ color: monthlyCashflow >= 0 ? "#10B981" : "#EF4444" }}
              >
                {monthlyCashflow >= 0 ? "" : "-"}
                {Math.abs(monthlyCashflow).toFixed(1)}
              </span>
              <span className={styles.kpiUnit}>만원</span>
            </div>
            <p className={styles.kpiNote}>
              연간 <strong>{Math.abs(annualCashflow).toFixed(1)}만원</strong> 자산{" "}
              {annualCashflow >= 0 ? "증가" : "감소"} 중
            </p>
          </div>

          {/* KPI 3: Annual Balance */}
          <div className={styles.kpiCard}>
            <i className={`fas fa-scale-unbalanced ${styles.kpiIcon}`}></i>
            <p className={styles.kpiLabel}>연간 수지차 (소득-지출)</p>
            <div className={styles.kpiValue}>
              <span className={styles.kpiNumber} style={{ color: "#d1d5db", fontSize: "20px" }}>
                {totalIncome.toFixed(1)}
              </span>
              <span className={styles.kpiUnit} style={{ fontSize: "11px", margin: "0 4px" }}>
                vs
              </span>
              <span
                className={styles.kpiNumber}
                style={{
                  color: annualCashflow >= 0 ? "#10B981" : "#EF4444",
                  fontSize: "20px",
                }}
              >
                {totalExpense.toFixed(1)}
              </span>
            </div>
            <div className={styles.kpiNote}>
              <i
                className={`fas ${annualCashflow >= 0 ? "fa-check-circle" : "fa-triangle-exclamation"}`}
                style={{ color: annualCashflow >= 0 ? "#10B981" : "#EF4444" }}
              ></i>{" "}
              {annualCashflow >= 0 ? "소득이 지출 초과" : "지출이 소득 초과"}
            </div>
          </div>

          {/* KPI 4: Savings Capacity */}
          <div className={styles.kpiCard}>
            <i className={`fas fa-wrench ${styles.kpiIcon}`}></i>
            <p className={styles.kpiLabel}>저축 여력 상태</p>
            <div className={styles.kpiValue}>
              <span
                className={styles.kpiNumber}
                style={{ color: savingsCapacity >= 0 ? "#10B981" : "#F59E0B" }}
              >
                {Math.max(0, savingsCapacity).toFixed(1)}
              </span>
              <span className={styles.kpiUnit}>만원</span>
            </div>
            <p className={styles.kpiNote} style={{ color: "#fbbf24", fontWeight: 500 }}>
              <i className="fas fa-bell" style={{ marginRight: "4px" }}></i>
              {savingsCapacity >= recommendedSavingsAmount
                ? "목표 달성"
                : savingsCapacity >= 0
                ? "개선 필요"
                : "긴급 구조조정 필요"}
            </p>
          </div>
        </div>

        {/* Bottom Row */}
        <div className={styles.bottomRow}>
          {/* Chart Card */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>
                <i className="fas fa-chart-bar" style={{ color: "#D4AF37" }}></i>
                소득 대비 소비/저축 구조 비교 분석
              </h3>
              <div className={styles.chartLegend}>
                <div className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ backgroundColor: "#4B5563" }}
                  ></span>
                  <span>소비지출</span>
                </div>
                <div className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ backgroundColor: "#D4AF37" }}
                  ></span>
                  <span>저축/투자</span>
                </div>
                <div className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ backgroundColor: "#EF4444" }}
                  ></span>
                  <span>적자(초과지출)</span>
                </div>
              </div>
            </div>
            <div className={styles.chartContainer} ref={chartRef}></div>
            <div className={styles.guideBox}>
              <div className={styles.guideHeader}>
                <i className="fas fa-bullseye" style={{ color: "#F59E0B", fontSize: "11px" }}></i>
                <span className={styles.guideTitle}>
                  저축률 기준 가이드 (Savings Rate Guideline)
                </span>
              </div>
              <div className={styles.guideGrid}>
                <div className={styles.guideItem}>
                  <span className={styles.guideItemLabel} style={{ color: "#6b7280" }}>
                    ① 60대 평균 (일반)
                  </span>
                  <div className={styles.guideItemValue}>
                    <span className={styles.guideItemNumber} style={{ color: "#d1d5db" }}>
                      8~10%
                    </span>
                    <span className={styles.guideItemNote}>전체 가계</span>
                  </div>
                </div>
                <div className={styles.guideItem}>
                  <span className={styles.guideItemLabel} style={{ color: "#10B981" }}>
                    ② 은퇴 준비 권장
                  </span>
                  <div className={styles.guideItemValue}>
                    <span className={styles.guideItemNumber} style={{ color: "#10B981" }}>
                      20~30%
                    </span>
                    <span className={styles.guideItemNote}>50-60대 필수</span>
                  </div>
                </div>
                <div className={styles.guideItem}>
                  <span className={styles.guideItemLabel} style={{ color: "#F59E0B" }}>
                    ③ 이상적 재정 안정
                  </span>
                  <div className={styles.guideItemValue}>
                    <span className={styles.guideItemNumber} style={{ color: "#F59E0B" }}>
                      30%↑
                    </span>
                    <span className={styles.guideItemNote}>Golden Ratio</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Card */}
          <div className={styles.analysisCard}>
            <div className={styles.analysisAccent} style={{ backgroundColor: status.color }}></div>
            <div>
              <h3 className={styles.analysisTitle}>
                <i
                  className={`fas ${savingsRate < 0 ? "fa-siren-on" : "fa-lightbulb"}`}
                  style={{ color: status.color }}
                ></i>
                <span>{savingsRate < 0 ? "긴급 진단 포인트" : "재정 분석 포인트"}</span>
              </h3>
              <div className={styles.analysisPoints}>
                <div className={styles.analysisPoint}>
                  <div
                    className={styles.analysisIconBadge}
                    style={{
                      backgroundColor: `${status.color}33`,
                      borderColor: status.color,
                    }}
                  >
                    <i
                      className={`fas fa-triangle-exclamation`}
                      style={{ color: status.color, fontSize: "11px" }}
                    ></i>
                  </div>
                  <div>
                    <p className={styles.analysisPointTitle} style={{ color: status.color }}>
                      권장 기준 대비 {savingsRate >= 20 ? "양호" : "미달"}
                    </p>
                    <p className={styles.analysisPointText}>
                      60대 평균(8~10%)은{" "}
                      {savingsRate >= 8 ? "충족하였으나" : "물론"} 은퇴 준비 권장 수준(20~30%)
                      {savingsRate >= 20 ? "을 달성했습니다" : "에 못 미치는"}{" "}
                      <strong style={{ color: status.color }}>
                        {savingsRate.toFixed(1)}% {savingsRate < 0 ? "적자 " : ""}상태
                      </strong>
                      입니다.
                    </p>
                  </div>
                </div>
                <div className={styles.analysisPoint}>
                  <div
                    className={styles.analysisIconBadge}
                    style={{
                      backgroundColor: "rgba(245, 158, 11, 0.2)",
                      borderColor: "#F59E0B",
                    }}
                  >
                    <i
                      className="fas fa-scissors"
                      style={{ color: "#F59E0B", fontSize: "11px" }}
                    ></i>
                  </div>
                  <div>
                    <p className={styles.analysisPointTitle} style={{ color: "#F59E0B" }}>
                      {savingsRate < 8 ? "지출 구조조정 목표" : "저축 최적화 목표"}
                    </p>
                    <p className={styles.analysisPointText}>
                      재정 안정을 위해{" "}
                      {savingsRate < 8 ? (
                        <>
                          최소한 '60대 평균' 수준인{" "}
                          <strong>월 {(averageSavingsAmount / 12).toFixed(1)}만원</strong> (약
                          10%)의 잉여 현금흐름 확보가 1차 목표입니다.
                        </>
                      ) : (
                        <>
                          '권장 수준'인{" "}
                          <strong>월 {(recommendedSavingsAmount / 12).toFixed(1)}만원</strong> (약
                          20%)의 저축을 목표로 설정하는 것이 좋습니다.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.gapAnalysisBox}>
              <p className={styles.gapAnalysisLabel}>Gap Analysis</p>
              <p className={styles.gapAnalysisValue}>
                <span>권장(20%) 달성 필요액</span>
                <span className={styles.gapAnalysisAmount}>
                  {gapToRecommended > 0 ? "+ " : ""}
                  약 {Math.abs(monthlyGapToRecommended).toFixed(1)}만원/월
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SavingsCapacityPage;
