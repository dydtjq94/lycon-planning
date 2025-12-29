import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import styles from "./ExpensePatternPage.module.css";

/**
 * 지출 패턴 분석 (Page 13)
 * 하드코딩 버전
 */
function ExpensePatternPage({ profile, simulationData }) {
  const chartRef = useRef(null);

  // 하드코딩된 지출 데이터 (상위 10개, 값 내림차순)
  const expenseData = [
    { name: '식비', value: 200, type: '변동비', color: '#3B82F6' },
    { name: '주거비', value: 100, type: '고정비', color: '#EF4444' },
    { name: '대출이자', value: 78, type: '고정비', color: '#EF4444' },
    { name: '의류·잡화', value: 70, type: '변동비', color: '#3B82F6' },
    { name: '공과금', value: 50, type: '고정비', color: '#EF4444' },
    { name: '문화·여가', value: 30, type: '변동비', color: '#3B82F6' },
    { name: '보험료', value: 22, type: '고정비', color: '#EF4444' },
    { name: '상가관리비', value: 16, type: '고정비', color: '#EF4444' },
    { name: '기타변동', value: 14, type: '변동비', color: '#3B82F6' },
    { name: '생활용품', value: 10, type: '변동비', color: '#3B82F6' },
  ];

  // 하드코딩된 수치들
  const fixedExpense = 270; // 고정비
  const variableExpense = 339; // 변동비
  const totalMonthly = 609; // 월 총 지출
  const totalYearly = 7311; // 연간 총 지출
  const fixedRatio = 44.3; // 고정비 비중 (%)

  // SVG 원형 차트 계산
  const circumference = 440;
  const fixedOffset = circumference - (circumference * fixedRatio) / 100;

  // Chart
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current, null, { height: 280 });

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(11, 24, 40, 0.95)",
        borderColor: "#4B5563",
        textStyle: { color: "#fff" },
        formatter: (params) => {
          const item = expenseData[params[0].dataIndex];
          return `<div style="font-weight: bold; margin-bottom: 4px; color: #d1d5db;">${item.name}</div>
                  <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px; margin-bottom: 4px;">
                    <span>분류</span>
                    <span style="color:${item.color}">${item.type}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 14px;">
                    <span>금액</span>
                    <span style="font-weight: bold;">${item.value}만원</span>
                  </div>`;
        },
      },
      grid: {
        left: "2%",
        right: "2%",
        bottom: "3%",
        top: "12%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: expenseData.map((item) => item.name),
        axisLabel: {
          color: "#9CA3AF",
          interval: 0,
          fontSize: 11,
          fontWeight: "500",
          margin: 12,
          formatter: (value) => {
            return value.length > 4 ? value.substring(0, 4) + ".." : value;
          },
        },
        axisLine: { show: true, lineStyle: { color: "#374151" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        name: "(만원)",
        nameTextStyle: {
          color: "#6B7280",
          align: "right",
        },
        splitLine: {
          show: true,
          lineStyle: { color: "#374151", type: "dashed" },
        },
        axisLabel: {
          color: "#6B7280",
          formatter: (value) => value.toFixed(0),
        },
      },
      series: [
        {
          type: "bar",
          barWidth: "50%",
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: (params) => {
              return expenseData[params.dataIndex].color;
            },
            shadowBlur: 5,
            shadowColor: "rgba(0, 0, 0, 0.2)",
          },
          label: {
            show: true,
            position: "top",
            color: "#D1D5DB",
            formatter: (params) => params.value,
            fontWeight: "bold",
            fontSize: 11,
            offset: [0, 2],
          },
          data: expenseData.map((item) => item.value),
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, []);

  return (
    <div className={styles.slideContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadges}>
            <span className={styles.stepBadge}>STEP 3-2</span>
            <span className={styles.sectionBadge}>Expense Pattern Analysis</span>
          </div>
          <h1 className={styles.headerTitle}>지출 패턴 분석 (2025년 기준)</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>실제 지출 데이터를 기반으로 고정비와 변동비를 정밀 분석하고,</p>
          <p>지출 구조의 유연성과 절감 잠재력을 진단합니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          {/* Fixed Cost Ratio Card */}
          <div className={styles.card}>
            <span className={styles.cardLabel}>고정비 비중</span>
            <div className={styles.cardIconBadge}>
              <i className="fas fa-check-circle"></i>
            </div>
            <div className={styles.circularProgress}>
              <svg className={styles.circularProgressSvg}>
                <circle
                  className={styles.circularProgressBg}
                  cx="80"
                  cy="80"
                  r="70"
                ></circle>
                <circle
                  className={styles.circularProgressFill}
                  cx="80"
                  cy="80"
                  r="70"
                  style={{ strokeDashoffset: fixedOffset }}
                ></circle>
              </svg>
              <div className={styles.circularProgressValue}>
                <span className={styles.progressPercentage}>{fixedRatio}%</span>
              </div>
            </div>
            <p className={styles.fixedCostSummary}>
              고정비 <strong>{fixedExpense}만원</strong> / 변동비{" "}
              <span className={styles.variableAmount}>{variableExpense}만원</span>
              <br />
              <span className={styles.statusBadge}>지출 구조 유연성 양호</span>
            </p>
          </div>

          {/* Total Expense Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardHeaderLabel}>연간 총 지출 규모</span>
              <i className={`fas fa-wallet ${styles.cardHeaderIcon}`}></i>
            </div>
            <div className={styles.totalAmount}>
              <span className={styles.amountValue}>{totalYearly.toLocaleString()}</span>
              <span className={styles.amountUnit}>만원</span>
            </div>
            <p className={styles.expenseNote}>
              <i className="fas fa-calculator"></i> 월 평균 {totalMonthly}만원 지출
            </p>
            <div className={styles.expenseBar}>
              <div
                className={styles.expenseBarFixed}
                style={{ width: `${fixedRatio}%` }}
              ></div>
              <div
                className={styles.expenseBarVariable}
                style={{ width: `${100 - fixedRatio}%` }}
              ></div>
            </div>
            <div className={styles.expenseBarLabels}>
              <span>고정비(44%)</span>
              <span>변동비(56%)</span>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>
                <i className="fas fa-chart-column"></i>
                주요 지출 항목 분석
              </h3>
              <div className={styles.chartLegend}>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: "#EF4444" }}></span>
                  고정비
                </span>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: "#3B82F6" }}></span>
                  변동비
                </span>
              </div>
            </div>
            <div className={styles.chartContainer} ref={chartRef}></div>
            <div className={styles.insightBox}>
              <div className={styles.insightColumn}>
                <p className={styles.insightLabelObs}>OBSERVATION</p>
                <p className={styles.insightText}>
                  변동비 비중이 <strong>55.7%</strong>로 높으며, 특히{" "}
                  <strong>식비(200만원)</strong>와 <strong>주거비(100만원)</strong>가
                  전체 지출의 약 50%를 차지합니다. 대출이자(78만원)는 고정비의 약 29%를
                  점유하고 있습니다.
                </p>
              </div>
              <div className={styles.insightColumn}>
                <p className={styles.insightLabelAction}>ACTION PLAN</p>
                <p className={styles.insightText}>
                  식비 및 의류·잡화 등 변동지출을 <strong>20%</strong> 절감할 경우,
                  월 <strong>약 70만원</strong>의 추가 현금흐름을 확보하여 노후 준비를
                  위한 투자 재원으로 활용할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExpensePatternPage;
