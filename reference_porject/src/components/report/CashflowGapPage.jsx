import React, { useRef, useEffect } from "react";
import * as echarts from "echarts";
import styles from "./CashflowGapPage.module.css";

/**
 * 은퇴 후 현금흐름 목표 달성 전략 (Page 19)
 * 하드코딩 버전
 */
function CashflowGapPage({ profile, simulationData }) {
  const chartRef = useRef(null);

  // 하드코딩된 데이터
  const retirementYears = 25; // 은퇴 후 25년

  // 총공급 (Supply) - 30.4억원
  const totalPension = 11.4; // 연금소득 (국민+퇴직) 억원
  const totalAssetInflow = 18.4; // 자산/대출유입 억원
  const totalRentalIncome = 0.6; // 임대소득 (5년) 억원
  const totalSupply = 30.4; // 총공급 억원

  // 총수요 (Demand) - 35.5억원
  const totalDebtPayment = 19.1; // 부동산/상환 억원
  const totalExpense = 14.2; // 생활/의료비 억원
  const totalFinanceCost = 2.2; // 금융비용 (이자+관리비) 억원
  const totalDemand = 35.5; // 총수요 억원

  // 자금 부족액
  const shortfall = -5.1; // 억원

  // 최악의 년도 - 2035년 (70세)
  const worstYear = {
    year: 2035,
    age: 70,
    balance: -3.37, // 억원
    debtPrincipal: 2.10, // 상가 담보대출 원금 상환 억원
    realEstatePurchase: 1.00, // 재건축 분담금 납부 억원
    livingEtc: 0.27, // 생활비/의료비/이자 등 억원
  };

  // 총자산
  const totalAssets = 63.5; // 억원

  // 차트 초기화
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(11, 24, 40, 0.95)",
        borderColor: "#374151",
        textStyle: { color: "#fff" },
        formatter: function (params) {
          let result = params[0].name + "<br/>";
          params.forEach((item) => {
            result +=
              item.marker +
              " " +
              item.seriesName +
              ": " +
              item.value +
              " 억원<br/>";
          });
          return result;
        },
      },
      legend: {
        data: ["총공급 (Supply)", "총수요 (Demand)"],
        textStyle: { color: "#9CA3AF", fontSize: 11 },
        bottom: 0,
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
        type: "value",
        axisLabel: {
          color: "#6B7280",
          formatter: "{value}억",
        },
        splitLine: {
          lineStyle: { color: "#374151", type: "dashed", opacity: 0.3 },
        },
      },
      yAxis: {
        type: "category",
        data: [`은퇴 후 ${retirementYears}년 합계`],
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "총공급 (Supply)",
          type: "bar",
          data: [totalSupply],
          itemStyle: {
            color: "#3B82F6",
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: "right",
            color: "#60A5FA",
            fontWeight: "bold",
            formatter: "{c} 억원",
          },
          barWidth: 40,
          barGap: "30%",
        },
        {
          name: "총수요 (Demand)",
          type: "bar",
          data: [totalDemand],
          itemStyle: {
            color: "#D97706",
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: "right",
            color: "#F59E0B",
            fontWeight: "bold",
            formatter: "{c} 억원",
          },
          barWidth: 40,
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
            <span className={styles.stepBadge}>STEP 2-1</span>
            <span className={styles.sectionBadge}>
              Gap Analysis &amp; Solution
            </span>
          </div>
          <h1 className={styles.headerTitle}>은퇴 후 현금흐름 목표 달성 전략</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>은퇴 기간 전체 현금흐름을 구조적으로 분석하여</p>
          <p>자금 과부족 및 주요 리스크 시점을 진단합니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          {/* Chart Container */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>
                <i className="fas fa-chart-bar"></i>
                <span>은퇴 기간({retirementYears}년) 자금 수지 구조</span>
              </h3>
              <span className={styles.unitBadge}>단위: 억원</span>
            </div>
            <div className={styles.chartContainer} ref={chartRef}></div>

            {/* Summary */}
            <div className={styles.summaryBox}>
              <div className={styles.summaryLeft}>
                <div className={styles.summaryIcon}>
                  <i className="fas fa-wallet"></i>
                </div>
                <div>
                  <p className={styles.summaryLabel}>자금 부족 (Shortfall)</p>
                  <p className={styles.summaryValue}>
                    {shortfall}{" "}
                    <span className={styles.summaryUnit}>억원</span>
                  </p>
                </div>
              </div>
              <div className={styles.summaryRight}>
                <p className={styles.summaryNote}>전체 기간 누적 수지</p>
                <p className={styles.summaryWarning}>
                  <i className="fas fa-exclamation-circle"></i> 자산 운용을 통한
                  보완 필요
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className={styles.breakdownCard}>
            <h3 className={styles.breakdownTitle}>세부 구성 내역</h3>
            <div className={styles.breakdownContent}>
              {/* Supply */}
              <div className={styles.breakdownSection}>
                <div className={styles.breakdownHeader}>
                  <span className={styles.breakdownLabel}>
                    총공급 ({totalSupply}억원)
                  </span>
                </div>
                <div className={styles.breakdownTable}>
                  <table>
                    <tbody>
                      <tr>
                        <td>연금소득 (국민+퇴직)</td>
                        <td className={styles.breakdownNumber}>
                          {totalPension}
                        </td>
                      </tr>
                      <tr>
                        <td>자산/대출유입</td>
                        <td className={styles.breakdownNumber}>
                          {totalAssetInflow}
                        </td>
                      </tr>
                      <tr>
                        <td>임대소득 (5년)</td>
                        <td className={styles.breakdownNumber}>
                          {totalRentalIncome}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Demand */}
              <div className={styles.breakdownSection}>
                <div className={styles.breakdownHeader}>
                  <span className={styles.breakdownLabelDemand}>
                    총수요 ({totalDemand}억원)
                  </span>
                </div>
                <div className={styles.breakdownTable}>
                  <table>
                    <tbody>
                      <tr>
                        <td>부동산/상환</td>
                        <td className={styles.breakdownNumber}>
                          {totalDebtPayment}
                        </td>
                      </tr>
                      <tr>
                        <td>생활/의료비</td>
                        <td className={styles.breakdownNumber}>
                          {totalExpense}
                        </td>
                      </tr>
                      <tr>
                        <td>금융비용 (이자+관리비)</td>
                        <td className={styles.breakdownNumber}>
                          {totalFinanceCost}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          {/* Worst Year Card */}
          <div className={styles.worstYearCard}>
            <div className={styles.worstYearIcon}>
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div className={styles.worstYearHeader}>
              <div>
                <p className={styles.worstYearBadge}>WORST CASHFLOW YEAR</p>
                <h3 className={styles.worstYearTitle}>
                  {worstYear.year}년 ({worstYear.age}세)
                </h3>
              </div>
              <div className={styles.worstYearAmount}>
                <p className={styles.worstYearLabel}>순현금흐름 적자</p>
                <p className={styles.worstYearValue}>
                  {worstYear.balance} <span>억원</span>
                </p>
              </div>
            </div>

            <div className={styles.worstYearDetails}>
              <p className={styles.worstYearDetailsTitle}>주요 적자 원인</p>
              <div className={styles.worstYearDetailsContent}>
                <div className={styles.worstYearItem}>
                  <span>
                    <i className="fas fa-caret-right"></i>상가 담보대출 원금
                    상환
                  </span>
                  <span className={styles.worstYearItemAmount}>
                    {worstYear.debtPrincipal.toFixed(2)} 억원
                  </span>
                </div>
                <div className={styles.worstYearItem}>
                  <span>
                    <i className="fas fa-caret-right"></i>재건축 분담금 납부
                  </span>
                  <span className={styles.worstYearItemAmount}>
                    {worstYear.realEstatePurchase.toFixed(2)} 억원
                  </span>
                </div>
                <div className={styles.worstYearItemTotal}>
                  <span>생활비/의료비/이자 등</span>
                  <span>{worstYear.livingEtc.toFixed(2)} 억원</span>
                </div>
              </div>
            </div>

            <p className={styles.worstYearNote}>
              * 해당 연도에는 유동성 자산(전세금 회수 등)을 활용한 대응이
              필수적입니다.
            </p>
          </div>

          {/* Insights Card */}
          <div className={styles.insightsCard}>
            <div className={styles.insightsHeader}>
              <i className="fas fa-clipboard-list"></i>
              <h3>전략적 인사이트</h3>
            </div>
            <div className={styles.insightsContent}>
              {/* Positive */}
              <div className={styles.insightItem}>
                <div className={`${styles.insightIcon} ${styles.insightGood}`}>
                  <i className="fas fa-check"></i>
                </div>
                <div>
                  <p className={styles.insightTitle}>
                    자산 대비 생활비 부담 적정
                  </p>
                  <p className={styles.insightText}>
                    현재 총자산({totalAssets}억) 대비 {retirementYears}년 생활·의료비({totalExpense}억) 비중은 22% 수준으로, 보유 자산으로 충분히 감당 가능합니다.
                  </p>
                </div>
              </div>

              {/* Warning */}
              <div className={styles.insightItem}>
                <div className={`${styles.insightIcon} ${styles.insightWarn}`}>
                  <i className="fas fa-exclamation"></i>
                </div>
                <div>
                  <p className={styles.insightTitle}>
                    {worstYear.year}년 유동성 절벽 주의
                  </p>
                  <p className={styles.insightText}>
                    {worstYear.year}년에 재건축({worstYear.realEstatePurchase}억) 및 상가대출 상환({worstYear.debtPrincipal}억)으로 3.1억원의 일시 유출이 발생하므로 사전 유동성 확보가 필요합니다.
                  </p>
                </div>
              </div>

              {/* Analysis */}
              <div className={styles.insightItem}>
                <div className={`${styles.insightIcon} ${styles.insightInfo}`}>
                  <i className="fas fa-chart-line"></i>
                </div>
                <div>
                  <p className={styles.insightTitle}>
                    자산 수익률 개선으로 해결 가능
                  </p>
                  <p className={styles.insightText}>
                    {Math.abs(shortfall)}억원의 부족 자금은 보유 자산의 연 3% 수익률 개선만으로도 충분히 해결 가능한 수준입니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CashflowGapPage;
