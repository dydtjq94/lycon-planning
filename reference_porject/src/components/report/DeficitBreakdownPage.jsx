import React, { useRef, useEffect } from "react";
import * as echarts from "echarts";
import styles from "./DeficitBreakdownPage.module.css";

/**
 * 이벤트성 적자 vs 구조적 적자 상세 분석 (Page 20)
 * 하드코딩 버전
 */
function DeficitBreakdownPage({ profile, simulationData }) {
  const chartRef = useRef(null);

  // 하드코딩된 데이터
  const totalDeficit = -5.1; // 억원

  // 구조적 적자 데이터
  const structuralDeficit = -2.8; // 억원
  const structuralRatio = 55; // %

  // 구조적 수입 (12.0억원)
  const structuralIncome = {
    pension: 11.4, // 연금소득 (국민+퇴직) 억원
    rentalIncome: 0.6, // 임대소득 (5년간) 억원
    total: 12.0,
  };

  // 구조적 지출 (14.79억원)
  const structuralExpense = {
    livingCost: 12.0, // 기본 생활비 억원
    medicalCost: 2.21, // 의료/건강관리비 억원
    rentalManagement: 0.11, // 부동산 관리비 억원
    loanInterest: 0.47, // 대출 이자 억원
    total: 14.79,
  };

  // 이벤트성 적자 데이터
  const eventDeficit = -2.3; // 억원
  const eventRatio = 45; // %

  // 이벤트성 수입 (18.38억원)
  const eventIncome = [
    { item: "전세금 회수", year: "2030", amount: 4.0 },
    { item: "상가 매도", year: "2035", amount: 8.0 },
    { item: "예금/적금 해지", year: "2030-2040", amount: 3.5 },
    { item: "퇴직금 수령", year: "2030", amount: 2.88 },
  ];
  const totalEventIncome = 18.38;

  // 이벤트성 지출 (20.70억원)
  const eventExpense = [
    { item: "상가 담보대출 상환", year: "2035", amount: 5.0 },
    { item: "주담대 상환", year: "2030-2045", amount: 4.2 },
    { item: "재건축 분담금", year: "2035", amount: 1.0 },
    { item: "자녀 결혼자금", year: "2032", amount: 1.0 },
    { item: "차량구입 (2회)", year: "2030, 2040", amount: 1.0 },
    { item: "기타 목적자금", year: "~", amount: 8.5 },
  ];
  const totalEventExpense = 20.7;

  // 하드코딩된 차트 데이터
  const chartData = [
    { value: 2.8, name: "구조적 적자 (55%)" },
    { value: 2.3, name: "이벤트성 적자 (45%)" },
  ];

  // 차트 초기화
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(11, 24, 40, 0.95)",
        borderColor: "#374151",
        textStyle: { color: "#fff" },
        formatter: "{b}: {c}억원",
      },
      legend: {
        orient: "horizontal",
        bottom: "0%",
        left: "center",
        textStyle: { color: "#9CA3AF", fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
        data: ["구조적 적자 (55%)", "이벤트성 적자 (45%)"],
      },
      series: [
        {
          name: "적자 유형",
          type: "pie",
          radius: ["40%", "60%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: "#0B1828",
            borderWidth: 2,
          },
          label: {
            show: true,
            position: "inside",
            color: "#fff",
            fontWeight: "bold",
            fontSize: 12,
            formatter: "{c}억원",
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 13,
              fontWeight: "bold",
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            {
              value: 2.8,
              name: "구조적 적자 (55%)",
              itemStyle: { color: "#3B82F6" },
            },
            {
              value: 2.3,
              name: "이벤트성 적자 (45%)",
              itemStyle: { color: "#EAB308" },
            },
          ],
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
            <span className={styles.stepBadge}>STEP 2-2</span>
            <span className={styles.sectionBadge}>
              Deficit Breakdown Analysis
            </span>
          </div>
          <h1 className={styles.headerTitle}>
            이벤트성 적자 vs 구조적 적자 상세 분석
          </h1>
        </div>
        <div className={styles.headerDescription}>
          <p>은퇴 기간 중 발생할 적자의 성격을 구조적 요인과 일시적 이벤트</p>
          <p>요인으로 분리하여 분석하고, 구체적인 발생 시기와 규모를 파악합니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          {/* Chart Card */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>
                <i className="fas fa-chart-pie"></i>
                <span>적자 유형별 비중 및 규모</span>
              </h3>
            </div>
            <div className={styles.chartContainer} ref={chartRef}></div>

            {/* Total Summary */}
            <div className={styles.totalSummary}>
              <div className={styles.summaryLeft}>
                <div className={styles.summaryIcon}>
                  <i className="fas fa-minus-circle"></i>
                </div>
                <div>
                  <p className={styles.summaryLabel}>총 부족 자금</p>
                  <p className={styles.summaryValue}>
                    {totalDeficit} <span>억원</span>
                  </p>
                </div>
              </div>
              <div className={styles.summaryRight}>
                <div className={styles.summaryRatio}>
                  <span className={styles.ratioBlue}></span>
                  <span>구조적: {structuralRatio}%</span>
                </div>
                <div className={styles.summaryRatio}>
                  <span className={styles.ratioYellow}></span>
                  <span>이벤트성: {eventRatio}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Insight Box */}
          <div className={styles.insightBox}>
            <h3 className={styles.insightTitle}>
              <i className="fas fa-lightbulb"></i> 핵심 진단
            </h3>
            <p className={styles.insightText}>
              전체 부족 자금 중 <strong>구조적 적자가 절반 이상({structuralRatio}%)</strong>을
              차지하여 장기적인 현금흐름 개선이 시급합니다. 이벤트성 적자는
              <strong> 2035년 전후로 집중</strong>되므로 해당 시점의 유동성 관리가 핵심입니다.
            </p>
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          {/* Structural Balance */}
          <div className={styles.structuralCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <i className="fas fa-layer-group"></i> 구조적 수지 (Structural
                Balance)
              </h3>
              <div className={styles.cardHeaderRight}>
                <span className={styles.cardSummary}>
                  수입 {structuralIncome.total}억원 vs 지출 {structuralExpense.total}억원
                </span>
                <span className={styles.cardBadgeBlue}>
                  {structuralDeficit} 억원
                </span>
              </div>
            </div>

            <div className={styles.cardContent}>
              {/* Income */}
              <div className={styles.tableSection}>
                <h4 className={styles.tableTitleBlue}>정기 수입</h4>
                <div className={styles.tableContainer}>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>항목</th>
                        <th className={styles.thCenter}>기간</th>
                        <th className={styles.thRight}>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>연금소득 (국민+퇴직)</td>
                        <td className={styles.tdYear}>25년</td>
                        <td className={styles.tdAmount}>
                          {structuralIncome.pension.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td>임대소득</td>
                        <td className={styles.tdYear}>5년</td>
                        <td className={styles.tdAmount}>
                          {structuralIncome.rentalIncome.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2" className={styles.tfootLabel}>
                          합계
                        </td>
                        <td className={styles.tfootAmount}>
                          {structuralIncome.total.toFixed(1)} 억원
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Expense */}
              <div className={styles.tableSection}>
                <h4 className={styles.tableTitleRed}>정기 지출</h4>
                <div className={styles.tableContainer}>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>항목</th>
                        <th className={styles.thCenter}>기간</th>
                        <th className={styles.thRight}>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>기본 생활비</td>
                        <td className={styles.tdYear}>25년</td>
                        <td className={styles.tdAmount}>
                          {structuralExpense.livingCost.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td>의료/건강관리비</td>
                        <td className={styles.tdYear}>25년</td>
                        <td className={styles.tdAmount}>
                          {structuralExpense.medicalCost.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td>부동산 관리비</td>
                        <td className={styles.tdYear}>5년</td>
                        <td className={styles.tdAmount}>
                          {structuralExpense.rentalManagement.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td>대출 이자</td>
                        <td className={styles.tdYear}>~2035</td>
                        <td className={styles.tdAmount}>
                          {structuralExpense.loanInterest.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2" className={styles.tfootLabel}>
                          합계
                        </td>
                        <td className={styles.tfootAmount}>
                          {structuralExpense.total.toFixed(2)} 억원
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Event Balance */}
          <div className={styles.eventCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitleYellow}>
                <i className="fas fa-bolt"></i> 이벤트성 수지 (Event Balance)
              </h3>
              <div className={styles.cardHeaderRight}>
                <span className={styles.cardSummary}>
                  수입 {totalEventIncome}억원 vs 지출 {totalEventExpense}억원
                </span>
                <span className={styles.cardBadgeYellow}>
                  {eventDeficit} 억원
                </span>
              </div>
            </div>

            <div className={styles.cardContent}>
              {/* Event Income */}
              <div className={styles.tableSection}>
                <h4 className={styles.tableTitleBlue}>이벤트 수입</h4>
                <div className={styles.tableContainerScroll}>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>항목</th>
                        <th className={styles.thCenter}>발생년도</th>
                        <th className={styles.thRight}>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventIncome.map((item, index) => (
                        <tr key={index}>
                          <td>{item.item}</td>
                          <td className={styles.tdYear}>{item.year}</td>
                          <td className={styles.tdAmount}>
                            {item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2" className={styles.tfootLabel}>
                          합계
                        </td>
                        <td className={styles.tfootAmount}>
                          {totalEventIncome.toFixed(2)} 억원
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Event Expense */}
              <div className={styles.tableSection}>
                <h4 className={styles.tableTitleRed}>이벤트 지출</h4>
                <div className={styles.tableContainerScroll}>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>항목</th>
                        <th className={styles.thCenter}>발생년도</th>
                        <th className={styles.thRight}>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventExpense.map((item, index) => (
                        <tr key={index}>
                          <td>{item.item}</td>
                          <td className={styles.tdYear}>{item.year}</td>
                          <td className={styles.tdAmount}>
                            {item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2" className={styles.tfootLabel}>
                          합계
                        </td>
                        <td className={styles.tfootAmount}>
                          {totalEventExpense.toFixed(2)} 억원
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeficitBreakdownPage;
