import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import styles from "./RetirementRiskPage.module.css";

/**
 * 은퇴 리스크 진단 (Page 16)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function RetirementRiskPage({ profile, simulationData }) {
  const chartRef = useRef(null);

  // 현금흐름 및 자산 데이터
  const cashflow = simulationData?.simulation?.cashflow || [];
  const assets = simulationData?.simulation?.assets || [];
  const currentYearCashflow = cashflow[0] || {};

  // 총 소득/지출 계산
  const totalIncome =
    (currentYearCashflow.income || 0) +
    (currentYearCashflow.pension || 0) +
    (currentYearCashflow.rentalIncome || 0) +
    (currentYearCashflow.assetIncome || 0);

  const totalExpense =
    (currentYearCashflow.expense || 0) +
    (currentYearCashflow.savings || 0) +
    Math.abs(currentYearCashflow.debtInterest || 0) +
    Math.abs(currentYearCashflow.debtPrincipal || 0);

  const annualBalance = totalIncome - totalExpense;
  const monthlyBalance = annualBalance / 12;
  const savingsRate = totalIncome > 0 ? (annualBalance / totalIncome) * 100 : 0;

  // 현재 자산 규모
  const currentAsset = assets.length > 0 ? assets[0] : {};
  const totalAssets = currentAsset.totalAssets || 0;
  const realEstateValue = totalAssets * 0.8; // 부동산 자산 추정 (총 자산의 80%)

  // 기타 소득 의존도 (income 외 소득)
  const otherIncome = totalIncome - (currentYearCashflow.income || 0);
  const otherIncomeDependency = totalIncome > 0 ? (otherIncome / totalIncome) * 100 : 0;

  // 임대 소득
  const rentalIncome = currentYearCashflow.rentalIncome || 0;
  const monthlyRental = rentalIncome / 12;

  // 현재 나이 및 은퇴 나이
  const currentAge = profile?.age || 60;
  const retirementAge = profile?.retirementAge || 65;
  const currentYear = new Date().getFullYear();

  // 리스크 시나리오 찾기
  // 1. 대규모 현금 유출 (부동산 매각, 부채 상환 등)
  const largeCashOutflows = cashflow
    .map((year, index) => ({
      year: currentYear + index,
      age: currentAge + index,
      realEstateSale: year.realEstateSale || 0,
      debtPrincipal: Math.abs(year.debtPrincipal || 0),
      total: (year.realEstateSale || 0) + Math.abs(year.debtPrincipal || 0),
    }))
    .filter((item) => item.total > totalIncome * 2); // 연 소득의 2배 이상 유출

  const criticalYear = largeCashOutflows.length > 0 ? largeCashOutflows[0] : null;

  // 2. 임대 소득 중단 시점 찾기
  const rentalIncomeYears = cashflow.map((year, index) => ({
    year: currentYear + index,
    rentalIncome: year.rentalIncome || 0,
  }));

  const rentalStopIndex = rentalIncomeYears.findIndex(
    (item, index) =>
      index > 0 && item.rentalIncome === 0 && rentalIncomeYears[index - 1].rentalIncome > 0
  );

  const rentalStopYear = rentalStopIndex > 0 ? rentalIncomeYears[rentalStopIndex].year : null;

  // 리스크 매트릭스 데이터
  const risks = [
    {
      name: "유동성 리스크",
      probability: criticalYear ? 10 : 5,
      impact: criticalYear ? 9 : 6,
      severity: criticalYear ? 45 : 30,
      color: criticalYear ? "#EF4444" : "#F59E0B",
    },
    {
      name: "소득 의존도",
      probability: otherIncomeDependency > 40 ? 8 : 4,
      impact: otherIncomeDependency > 40 ? 7 : 5,
      severity: otherIncomeDependency > 40 ? 35 : 20,
      color: otherIncomeDependency > 40 ? "#F59E0B" : "#3B82F6",
    },
    {
      name: "적자 구조",
      probability: savingsRate < 0 ? 9 : 5,
      impact: savingsRate < 0 ? 7 : 4,
      severity: savingsRate < 0 ? 35 : 20,
      color: savingsRate < 0 ? "#F59E0B" : "#3B82F6",
    },
    {
      name: "임대 중단",
      probability: rentalStopYear ? 8 : 4,
      impact: rentalStopYear ? 6 : 3,
      severity: rentalStopYear ? 30 : 12,
      color: rentalStopYear ? "#F59E0B" : "#3B82F6",
    },
  ];

  // Chart
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const option = {
      backgroundColor: "transparent",
      grid: {
        top: "10%",
        right: "10%",
        bottom: "10%",
        left: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "value",
        name: "발생 가능성",
        nameLocation: "center",
        nameGap: 25,
        min: 0,
        max: 10,
        splitLine: { show: false },
        axisLine: { lineStyle: { color: "#6B7280" } },
        axisLabel: { show: false },
      },
      yAxis: {
        type: "value",
        name: "재무적 영향도",
        nameLocation: "center",
        nameGap: 25,
        min: 0,
        max: 10,
        splitLine: { show: false },
        axisLine: { lineStyle: { color: "#6B7280" } },
        axisLabel: { show: false },
      },
      series: [
        {
          type: "scatter",
          symbolSize: (data) => data[2] * 1.5,
          data: risks.map((risk) => ({
            value: [risk.probability, risk.impact, risk.severity],
            name: risk.name,
            itemStyle: {
              color: risk.color,
              shadowBlur: 10,
              shadowColor: risk.color,
            },
          })),
          label: {
            show: true,
            formatter: (param) => param.data.name,
            position: "top",
            color: "#fff",
            fontSize: 12,
            fontWeight: "bold",
          },
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
                  name: "High Risk Zone",
                  xAxis: 5,
                  yAxis: 5,
                  itemStyle: { color: "rgba(239, 68, 68, 0.1)" },
                  label: {
                    position: "insideTopRight",
                    color: "rgba(239, 68, 68, 0.5)",
                    fontSize: 10,
                  },
                },
                { xAxis: 10, yAxis: 10 },
              ],
              [
                {
                  xAxis: 0,
                  yAxis: 0,
                  itemStyle: { color: "rgba(59, 130, 246, 0.05)" },
                },
                { xAxis: 5, yAxis: 5 },
              ],
            ],
          },
          markLine: {
            silent: true,
            lineStyle: { color: "#4B5563", type: "dashed", width: 1 },
            data: [{ xAxis: 5 }, { yAxis: 5 }],
            symbol: "none",
            label: { show: false },
          },
        },
      ],
    };

    chart.setOption(option);

    return () => chart.dispose();
  }, [risks]);

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
            <span className={styles.stepBadge}>STEP 4</span>
            <span className={styles.sectionBadge}>RISK ASSESSMENT MATRIX</span>
          </div>
          <h1 className={styles.headerTitle}>은퇴 리스크 진단</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>재무 시뮬레이션 결과 도출된 4대 핵심 리스크입니다.</p>
          <p>
            {criticalYear
              ? `특히 ${criticalYear.year}년 대규모 현금 유출`
              : "현금흐름"}과 소득 구조의 취약성에 대한 대비가 필요합니다.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>
              <i className="fas fa-crosshairs" style={{ color: "#D4AF37" }}></i>
              리스크 매트릭스 (영향도 × 가능성)
            </h3>
            <div className={styles.chartContainer} ref={chartRef}></div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: "#EF4444" }}
                ></span>
                Critical Risk
              </div>
              <div className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: "#F59E0B" }}
                ></span>
                Warning Risk
              </div>
              <div className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: "#3B82F6" }}
                ></span>
                Managed Risk
              </div>
            </div>
          </div>

          {/* Key Insight */}
          <div className={styles.keyInsightBox}>
            <div className={styles.keyInsightContent}>
              <i className={`fas fa-triangle-exclamation ${styles.keyInsightIcon}`}></i>
              <div>
                <p className={styles.keyInsightTitle}>
                  핵심 경고:{" "}
                  {criticalYear
                    ? `${criticalYear.year}년 유동성 절벽`
                    : "현금흐름 적자 구조"}
                </p>
                <p className={styles.keyInsightText}>
                  {criticalYear ? (
                    <>
                      {criticalYear.age}세가 되는 {criticalYear.year}년에 재건축 분담금 및
                      부채 상환으로{" "}
                      <strong>약 {(criticalYear.total / 10000).toFixed(1)}억원의 현금 유출</strong>
                      이 발생합니다. 사전 자산 유동화 전략이 없으면 흑자 도산 위험이 있습니다.
                    </>
                  ) : (
                    <>
                      현재 월 {Math.abs(monthlyBalance).toFixed(1)}만원의{" "}
                      {monthlyBalance >= 0 ? "흑자" : "적자"} 구조로, 저축률{" "}
                      <strong>{savingsRate.toFixed(1)}%</strong>입니다. 지출 절감을 통한 현금흐름
                      개선이 시급합니다.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Risk Cards */}
        <div className={styles.rightColumn}>
          {/* Card 1: 대규모 유동성 리스크 */}
          <div
            className={`${styles.riskCard} ${styles.riskCardAccent}`}
            style={{ borderTopColor: criticalYear ? "#EF4444" : "#F59E0B" }}
          >
            <div
              className={`${styles.riskBadge} ${
                criticalYear ? styles.badgeHigh : styles.badgeMedium
              }`}
            >
              {criticalYear ? "심각 (Critical)" : "주의 (Warning)"}
            </div>
            <div className={styles.riskCardHeader}>
              <div className={styles.riskIconBox}>
                <i
                  className="fas fa-money-bill-wave"
                  style={{ color: criticalYear ? "#F87171" : "#FBBF24" }}
                ></i>
              </div>
              <h3 className={styles.riskCardTitle}>대규모 유동성 리스크</h3>
            </div>
            <p className={styles.riskCardDescription}>
              {criticalYear
                ? `${criticalYear.year}년 재건축/부채상환으로 ${(criticalYear.total / 10000).toFixed(1)}억원 일시 유출 발생`
                : "향후 대규모 현금 유출 이벤트 모니터링 필요"}
            </p>
            <div className={styles.riskSolutionBox}>
              <p
                className={styles.riskSolutionTitle}
                style={{ color: criticalYear ? "#FCA5A5" : "#FCD34D" }}
              >
                <i className="fas fa-shield-halved"></i>대응 솔루션
              </p>
              <p className={styles.riskSolutionText}>
                {criticalYear ? (
                  <>
                    • 부동산 자산({(realEstateValue / 10000).toFixed(1)}억) 일부 유동화 시점{" "}
                    {criticalYear.year - 1}년으로 조정
                    <br />• 재건축 기간 중 주택연금 등 대안 현금흐름 확보
                  </>
                ) : (
                  <>
                    • 정기적인 자산 포트폴리오 리밸런싱
                    <br />• 유동성 비율 20% 이상 유지
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Card 2: 현금흐름 적자 구조 */}
          <div
            className={`${styles.riskCard} ${styles.riskCardAccent}`}
            style={{ borderTopColor: savingsRate < 0 ? "#F59E0B" : "#3B82F6" }}
          >
            <div
              className={`${styles.riskBadge} ${
                savingsRate < 0 ? styles.badgeMedium : styles.badgeLow
              }`}
            >
              {savingsRate < 0 ? "주의 (Warning)" : "관리 (Managed)"}
            </div>
            <div className={styles.riskCardHeader}>
              <div className={styles.riskIconBox}>
                <i
                  className="fas fa-arrow-trend-down"
                  style={{ color: savingsRate < 0 ? "#FBBF24" : "#60A5FA" }}
                ></i>
              </div>
              <h3 className={styles.riskCardTitle}>현금흐름 적자 구조</h3>
            </div>
            <p className={styles.riskCardDescription}>
              연간 {annualBalance.toFixed(1)}만원 (월 약 {monthlyBalance.toFixed(1)}만원) 구조적{" "}
              {monthlyBalance >= 0 ? "흑자" : "적자"}(저축률 {savingsRate.toFixed(1)}%) 지속 중
            </p>
            <div className={styles.riskSolutionBox}>
              <p
                className={styles.riskSolutionTitle}
                style={{ color: savingsRate < 0 ? "#FCD34D" : "#93C5FD" }}
              >
                <i className="fas fa-shield-halved"></i>대응 솔루션
              </p>
              <p className={styles.riskSolutionText}>
                • 생활비(월 {((currentYearCashflow.expense || 0) / 12).toFixed(1)}만원) 10% 절감
                목표 실행
                <br />• 고정비 재설계로 월 50만원 이상 잉여 현금 확보
              </p>
            </div>
          </div>

          {/* Card 3: 소득 구조 취약성 */}
          <div
            className={`${styles.riskCard} ${styles.riskCardAccent}`}
            style={{ borderTopColor: otherIncomeDependency > 40 ? "#F59E0B" : "#3B82F6" }}
          >
            <div
              className={`${styles.riskBadge} ${
                otherIncomeDependency > 40 ? styles.badgeMedium : styles.badgeLow
              }`}
            >
              {otherIncomeDependency > 40 ? "주의 (Warning)" : "관리 (Managed)"}
            </div>
            <div className={styles.riskCardHeader}>
              <div className={styles.riskIconBox}>
                <i
                  className="fas fa-hand-holding-dollar"
                  style={{ color: otherIncomeDependency > 40 ? "#FBBF24" : "#60A5FA" }}
                ></i>
              </div>
              <h3 className={styles.riskCardTitle}>기타소득 의존도 과다</h3>
            </div>
            <p className={styles.riskCardDescription}>
              총 소득의 {otherIncomeDependency.toFixed(1)}%({(otherIncome / 10000).toFixed(1)}
              억원)가 근로소득 외 수입에 의존적인 구조
            </p>
            <div className={styles.riskSolutionBox}>
              <p
                className={styles.riskSolutionTitle}
                style={{ color: otherIncomeDependency > 40 ? "#FCD34D" : "#93C5FD" }}
              >
                <i className="fas fa-shield-halved"></i>대응 솔루션
              </p>
              <p className={styles.riskSolutionText}>
                • 기타 소득 의존도를 40% 미만으로 축소 계획 수립
                <br />• 개인연금 조기 인출 등으로 자체 소득 비중 확대
              </p>
            </div>
          </div>

          {/* Card 4: 임대소득 중단 리스크 */}
          <div
            className={`${styles.riskCard} ${styles.riskCardAccent}`}
            style={{ borderTopColor: rentalStopYear ? "#F59E0B" : "#3B82F6" }}
          >
            <div
              className={`${styles.riskBadge} ${
                rentalStopYear ? styles.badgeMedium : styles.badgeLow
              }`}
            >
              {rentalStopYear ? "주의 (Warning)" : "관리 (Managed)"}
            </div>
            <div className={styles.riskCardHeader}>
              <div className={styles.riskIconBox}>
                <i
                  className="fas fa-store-slash"
                  style={{ color: rentalStopYear ? "#FBBF24" : "#60A5FA" }}
                ></i>
              </div>
              <h3 className={styles.riskCardTitle}>임대소득 절벽</h3>
            </div>
            <p className={styles.riskCardDescription}>
              {rentalStopYear
                ? `${rentalStopYear}년 이후 상가 임대소득(월 ${monthlyRental.toFixed(1)}만원) 중단 예상`
                : `현재 월 ${monthlyRental.toFixed(1)}만원 임대소득 안정적 유지 중`}
            </p>
            <div className={styles.riskSolutionBox}>
              <p
                className={styles.riskSolutionTitle}
                style={{ color: rentalStopYear ? "#FCD34D" : "#93C5FD" }}
              >
                <i className="fas fa-shield-halved"></i>대응 솔루션
              </p>
              <p className={styles.riskSolutionText}>
                {rentalStopYear ? (
                  <>
                    • {rentalStopYear - 1}년 자산 재조정 시 배당주 ETF 등 대체 자산 편입
                    <br />• 월 배당형 자산으로 상가 소득 대체 준비
                  </>
                ) : (
                  <>
                    • 임대 계약 갱신 시 장기 계약 우선 고려
                    <br />• 배당주 등 대체 소득원 점진적 확대
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RetirementRiskPage;
