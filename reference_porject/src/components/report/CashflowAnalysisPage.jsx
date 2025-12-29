import React, { useState, useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";
import styles from "./CashflowAnalysisPage.module.css";

/**
 * 연도별 현금흐름 현황 (Page 9)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function CashflowAnalysisPage({ profile, simulationData }) {
  // 현재 나이와 은퇴 나이
  const currentAge =
    simulationData?.profile?.currentAge || profile?.currentAge || 42;
  const retirementAge =
    simulationData?.profile?.retirementAge || profile?.retirementAge || 65;

  // 현금흐름 데이터 추출 (현재 시점부터 은퇴 시점까지)
  const cashflow = simulationData?.simulation?.cashflow || [];
  const yearsToRetirement = retirementAge - currentAge + 1; // 은퇴 연도 포함
  const displayCount = yearsToRetirement; // 최대 제한 제거 - 은퇴까지 전부 표시
  const displayYears = cashflow.slice(0, displayCount);

  console.log("CashflowAnalysisPage - 현재 나이:", currentAge);
  console.log("CashflowAnalysisPage - 은퇴 나이:", retirementAge);
  console.log("CashflowAnalysisPage - 은퇴까지 연수:", yearsToRetirement);
  console.log("CashflowAnalysisPage - 표시할 연수:", displayCount);
  console.log("CashflowAnalysisPage - cashflow 전체:", cashflow);
  console.log("CashflowAnalysisPage - displayYears:", displayYears);

  // 현재 연도 계산
  const currentYear = new Date().getFullYear();

  // KPI 계산 (총 수입 기준)
  const firstYearData = displayYears[0] || {};
  const firstYearIncome =
    (firstYearData.income || 0) +
    (firstYearData.pension || 0) +
    (firstYearData.rentalIncome || 0) +
    (firstYearData.realEstatePension || 0) +
    (firstYearData.assetIncome || 0) +
    (firstYearData.realEstateSale || 0) +
    (firstYearData.assetSale || 0) +
    (firstYearData.debtInjection || 0) +
    (firstYearData.savingMaturity || 0);

  const firstYearExpense =
    Math.abs(firstYearData.expense || 0) +
    Math.abs(firstYearData.savings || 0) +
    Math.abs(firstYearData.debtInterest || 0) +
    Math.abs(firstYearData.debtPrincipal || 0) +
    Math.abs(firstYearData.realEstateTax || 0) +
    Math.abs(firstYearData.capitalGainsTax || 0);

  const firstYearNet = firstYearIncome - firstYearExpense;

  // 누적 적자/흑자 계산
  const cumulativeNet = displayYears.reduce((sum, year) => {
    const totalIncome =
      (year.income || 0) +
      (year.pension || 0) +
      (year.rentalIncome || 0) +
      (year.realEstatePension || 0) +
      (year.assetIncome || 0) +
      (year.realEstateSale || 0) +
      (year.assetSale || 0) +
      (year.debtInjection || 0) +
      (year.savingMaturity || 0);

    const totalExpense =
      Math.abs(year.expense || 0) +
      Math.abs(year.savings || 0) +
      Math.abs(year.debtInterest || 0) +
      Math.abs(year.debtPrincipal || 0) +
      Math.abs(year.realEstateTax || 0) +
      Math.abs(year.capitalGainsTax || 0);

    return sum + (totalIncome - totalExpense);
  }, 0);

  // 소득 대비 지출 비율
  const expenseRatio =
    firstYearIncome > 0 ? (firstYearExpense / firstYearIncome) * 100 : 0;

  // 차트 데이터 생성
  const chartData = displayYears.map((year, index) => {
    // 총 수입 = 근로소득 + 저축수익 + 연금 + 임대소득 + 부동산연금 + 자산수익 + 부동산매각 + 자산매각 + 부채조달 + 저축만기
    const totalIncome =
      (year.income || 0) + // 근로소득 (이미 저축수익 포함됨)
      (year.pension || 0) + // 연금
      (year.rentalIncome || 0) + // 임대소득
      (year.realEstatePension || 0) + // 부동산연금
      (year.assetIncome || 0) + // 자산수익
      (year.realEstateSale || 0) + // 부동산매각
      (year.assetSale || 0) + // 자산매각
      (year.debtInjection || 0) + // 부채조달
      (year.savingMaturity || 0); // 저축만기

    // 총 지출 = 생활비 + 저축적립 + 부채이자 + 부채원금 + 부동산취득세 + 양도소득세 + 저축구매 + 자산구매 + 부동산구매
    const baseExpense = Math.abs(year.expense || 0); // 생활비
    const savingsContribution = Math.abs(year.savings || 0); // 저축적립
    const debtInterest = Math.abs(year.debtInterest || 0); // 부채이자
    const debtPrincipal = Math.abs(year.debtPrincipal || 0); // 부채원금
    const realEstateTax = Math.abs(year.realEstateTax || 0); // 부동산 취득세
    const capitalGainsTax = Math.abs(year.capitalGainsTax || 0); // 양도소득세

    const totalExpense =
      baseExpense +
      savingsContribution +
      debtInterest +
      debtPrincipal +
      realEstateTax +
      capitalGainsTax;

    const net = totalIncome - totalExpense;
    const yearAge = currentAge + index;
    const isRetirement = yearAge >= retirementAge; // 은퇴 나이 이상이면 은퇴

    return {
      year: currentYear + index,
      yearLabel: isRetirement
        ? `${currentYear + index}(은퇴)`
        : `${currentYear + index}`,
      age: yearAge,
      income: totalIncome,
      expense: totalExpense,
      net,
      isRetirement,
    };
  });

  // 차트 옵션
  const getChartOption = () => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      backgroundColor: "rgba(11, 24, 40, 0.9)",
      borderColor: "#374151",
      textStyle: {
        color: "#fff",
      },
      formatter: function (params) {
        let result = params[0].axisValue + "<br/>";
        params.forEach((item) => {
          let valueStr = (item.value / 10000).toFixed(2);
          if (item.seriesName === "순현금흐름" && item.value > 0) {
            valueStr = "+" + valueStr;
          }
          result +=
            item.marker + " " + item.seriesName + ": " + valueStr + "억원<br/>";
        });
        return result;
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "3%",
      containLabel: true,
    },
    legend: {
      show: false,
    },
    xAxis: {
      type: "category",
      data: chartData.map((d) => d.yearLabel),
      axisLine: {
        lineStyle: {
          color: "#4B5563",
        },
      },
      axisLabel: {
        color: "#9CA3AF",
        fontFamily: "Inter",
      },
    },
    yAxis: {
      type: "value",
      name: "",
      axisLabel: {
        formatter: (value) => {
          return (value / 10000).toFixed(1) + "억";
        },
        color: "#9CA3AF",
      },
      splitLine: {
        lineStyle: {
          color: "#1F2937",
          type: "dashed",
        },
      },
    },
    series: [
      {
        name: "연 수입",
        type: "bar",
        barWidth: "20%",
        itemStyle: {
          color: "#3B82F6",
          borderRadius: [4, 4, 0, 0],
        },
        data: chartData.map((d) => d.income),
      },
      {
        name: "연 지출",
        type: "bar",
        barWidth: "20%",
        barGap: "5%",
        itemStyle: {
          color: "#9CA3AF",
          borderRadius: [4, 4, 0, 0],
        },
        data: chartData.map((d) => d.expense),
      },
      {
        name: "순현금흐름",
        type: "line",
        symbol: "circle",
        symbolSize: 8,
        lineStyle: {
          width: 2,
          color: "#9CA3AF", // 라인은 회색으로
        },
        itemStyle: {
          color: function (params) {
            // 각 포인트마다 값에 따라 색상 변경
            return params.data >= 0 ? "#10B981" : "#EF4444";
          },
        },
        data: chartData.map((d) => d.net),
      },
    ],
  });

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
            <span className={styles.stepBadge}>STEP 2-2</span>
            <span className={styles.sectionBadge}>
              ANNUAL CASHFLOW ANALYSIS
            </span>
          </div>
          <h1 className={styles.headerTitle}>
            연도별 현금흐름 현황 ({currentYear}-{currentYear + displayCount - 1}년, 은퇴 {retirementAge}세)
          </h1>
        </div>
        <div className={styles.headerDescription}>
          <p>은퇴 시점까지의 연간 소득 및 지출 추이를 시뮬레이션하여</p>
          <p>구조적인 적자 현금흐름을 진단합니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* KPI Cards */}
        <div className={styles.kpiGrid}>
          {/* 첫 해 연 수입 */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <p className={styles.kpiLabel}>{currentYear}년 연 수입</p>
              <div className={styles.kpiIcon} style={{ color: "#3B82F6" }}>
                <i className="fas fa-won-sign"></i>
              </div>
            </div>
            <p className={styles.kpiValue}>
              {firstYearIncome.toFixed(1)}{" "}
              <span className={styles.kpiUnit}>만원</span>
            </p>
            <p className={styles.kpiNote}>근로+연금+임대+매각+만기 등</p>
          </div>

          {/* 첫 해 연 지출 */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <p className={styles.kpiLabel}>{currentYear}년 연 지출</p>
              <div className={styles.kpiIcon} style={{ color: "#9CA3AF" }}>
                <i className="fas fa-shopping-cart"></i>
              </div>
            </div>
            <p className={styles.kpiValue}>
              {firstYearExpense.toFixed(1)}{" "}
              <span className={styles.kpiUnit}>만원</span>
            </p>
            <p className={styles.kpiNote}>
              수입 대비 {expenseRatio.toFixed(1)}% 지출
            </p>
          </div>

          {/* 연간 순현금흐름 */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <p className={styles.kpiLabel}>
                연간 순현금흐름 ({firstYearNet >= 0 ? "흑자" : "적자"})
              </p>
              <div
                className={styles.kpiIcon}
                style={{ color: firstYearNet >= 0 ? "#10B981" : "#EF4444" }}
              >
                <i
                  className={`fas fa-arrow-trend-${firstYearNet >= 0 ? "up" : "down"}`}
                ></i>
              </div>
            </div>
            <p
              className={styles.kpiValue}
              style={{ color: firstYearNet >= 0 ? "#10B981" : "#EF4444" }}
            >
              {firstYearNet >= 0 ? "+" : ""}
              {firstYearNet.toFixed(1)}{" "}
              <span className={styles.kpiUnit}>만원</span>
            </p>
            <p
              className={styles.kpiNote}
              style={{ color: firstYearNet >= 0 ? "#10B981" : "#EF4444" }}
            >
              {firstYearNet >= 0 ? "건전한 현금흐름" : "구조적 적자 발생 중"}
            </p>
          </div>

          {/* 누적 예상 */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <p className={styles.kpiLabel}>
                {displayCount}년 누적 예상{" "}
                {cumulativeNet >= 0 ? "흑자" : "적자"}
              </p>
              <div
                className={styles.kpiIcon}
                style={{ color: cumulativeNet >= 0 ? "#10B981" : "#EF4444" }}
              >
                <i className="fas fa-chart-line"></i>
              </div>
            </div>
            <p
              className={styles.kpiValue}
              style={{ color: cumulativeNet >= 0 ? "#10B981" : "#EF4444" }}
            >
              {cumulativeNet >= 0 ? "+" : ""}
              {cumulativeNet.toFixed(1)}{" "}
              <span className={styles.kpiUnit}>만원</span>
            </p>
            <p className={styles.kpiNote}>
              {currentYear + displayCount - 1}년 은퇴 시점까지 누적
            </p>
          </div>
        </div>

        {/* Chart and Table */}
        <div className={styles.contentRow}>
          {/* Left: Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <p className={styles.chartTitle}>
                연도별 현금흐름 시뮬레이션 ({currentYear}-
                {currentYear + displayCount - 1})
              </p>
              <div className={styles.legendContainer}>
                <div className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ backgroundColor: "#3B82F6" }}
                  ></span>
                  <span className={styles.legendLabel}>연 수입</span>
                </div>
                <div className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ backgroundColor: "#9CA3AF" }}
                  ></span>
                  <span className={styles.legendLabel}>연 지출</span>
                </div>
                <div className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ backgroundColor: "#EF4444" }}
                  ></span>
                  <span className={styles.legendLabel}>순현금흐름</span>
                </div>
              </div>
            </div>
            <div className={styles.chartArea}>
              <ReactECharts
                option={getChartOption()}
                style={{ height: "100%", width: "100%" }}
              />
            </div>
          </div>

          {/* Right: Table */}
          <div className={styles.tableCard}>
            <p className={styles.tableTitle}>
              연도별 상세 데이터{" "}
              <span className={styles.tableUnit}>(단위: 만원)</span>
            </p>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>연도</th>
                    <th className={styles.textRight}>수입</th>
                    <th className={styles.textRight}>지출</th>
                    <th className={styles.textRight}>수지</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((data, index) => (
                    <tr key={index}>
                      <td>{data.yearLabel}</td>
                      <td className={styles.textRight}>
                        {data.income.toFixed(1)}
                      </td>
                      <td className={styles.textRight}>
                        {data.expense.toFixed(1)}
                      </td>
                      <td
                        className={styles.textRight}
                        style={{ color: data.net >= 0 ? "#10B981" : "#EF4444" }}
                      >
                        {data.net >= 0 ? "+" : ""}
                        {data.net.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.tableNote}>
              <i className="fas fa-circle-info"></i>
              <p>
                {cumulativeNet >= 0
                  ? "중기계획을 통해 은퇴 자산 확보 가능"
                  : "중기계획을 통해 적자 해소 및 자산 확보 필요"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CashflowAnalysisPage;
