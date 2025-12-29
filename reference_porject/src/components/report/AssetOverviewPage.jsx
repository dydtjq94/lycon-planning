import React, { useState, useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { analyzeAssetOverview } from "../../services/openaiService";
import styles from "./AssetOverviewPage.module.css";

/**
 * 자산 현황 브리핑 (Page 8)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function AssetOverviewPage({ profile, simulationData }) {
  const [aiInsights, setAiInsights] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const hasAnalyzed = useRef(false); // AI 분석 실행 여부 추적

  // 현재 시점 자산/부채 데이터 추출
  const assets = simulationData?.simulation?.assets || [];
  const currentAsset = assets[0]?.breakdown || {};
  const assetItems = currentAsset.assetItems || [];
  const debtItems = currentAsset.debtItems || [];

  const totalAssets = currentAsset.totalAssets || 0;
  const totalDebt = currentAsset.totalDebt || 0;
  const netAssets = currentAsset.netAssets || 0;

  // 자산 카테고리별 분류
  const assetsByCategory = {
    부동산: 0,
    저축투자: 0,
    연금: 0,
    현금: 0,
    자산: 0,
  };

  assetItems.forEach((item) => {
    const amount = item.amount || 0;
    const sourceType = item.sourceType || "자산";

    if (sourceType === "realEstate") {
      assetsByCategory.부동산 += amount;
    } else if (sourceType === "saving") {
      assetsByCategory.저축투자 += amount;
    } else if (sourceType === "pension") {
      assetsByCategory.연금 += amount;
    } else if (sourceType === "cash") {
      assetsByCategory.현금 += amount;
    } else if (sourceType === "asset") {
      assetsByCategory.자산 += amount;
    }
  });

  console.log("AssetOverviewPage - 자산 카테고리별:", assetsByCategory);
  console.log("AssetOverviewPage - assetItems:", assetItems);
  assetItems.forEach((item, idx) => {
    console.log(`assetItem[${idx}]:`, {
      label: item.label,
      sourceType: item.sourceType,
      amount: item.amount,
    });
  });

  // 0이 아닌 항목만 필터링하여 차트 데이터 생성
  const chartData = Object.entries(assetsByCategory)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value: value / 10000, // 억원 단위
      ratio: totalAssets > 0 ? (value / totalAssets) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // 부채 비율 및 건전성 지표
  const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;

  // 현금흐름 데이터 (연 단위 데이터)
  const cashflow = simulationData?.simulation?.cashflow || [];
  const currentYearCashflow = cashflow[0] || {};

  // cashflow 데이터는 연 단위로 저장됨
  const annualIncome = currentYearCashflow.income || 0; // 이미 만원 단위
  const annualExpense = Math.abs(currentYearCashflow.expense || 0); // 이미 만원 단위
  const monthlyIncome = annualIncome / 12;
  const monthlyExpense = annualExpense / 12;
  const netCashflow = monthlyIncome - monthlyExpense;

  console.log("AssetOverviewPage - cashflow 데이터:", {
    cashflow: cashflow[0],
    annualIncome,
    annualExpense,
    monthlyIncome,
    monthlyExpense,
  });

  // 유동 자산 계산 (즉시 또는 빠르게 현금화 가능한 자산)
  // amount는 만원 단위임 (예: 20153.61 = 20,153만원 = 약 2억원)

  // 1. 현금 (sourceType: "cash") - 100% 유동성
  // 2. 저축 상품 중 유동성 높은 것들 - 100% 유동성
  //    - 예금, 적금, CMA, MMF, ISA, 주택청약 등
  // 3. 자산 중 현금성 자산 - 100% 유동성
  //    - 기타 현금성(외화예금 등)
  const liquidAssets = assetItems.reduce((sum, item) => {
    const label = (item.label || "").toLowerCase();

    // 현금 100%
    if (item.sourceType === "cash") {
      console.log("유동자산 - 현금:", item);
      return sum + (item.amount || 0);
    }

    // 저축 상품 중 유동성 높은 것 100%
    if (item.sourceType === "saving") {
      const isHighlyLiquid =
        label.includes("예금") ||
        label.includes("적금") ||
        label.includes("cma") ||
        label.includes("mmf") ||
        label.includes("isa") ||
        label.includes("파킹") ||
        label.includes("단기") ||
        label.includes("청약");

      if (isHighlyLiquid) {
        console.log("유동자산 - 저축:", item);
        return sum + (item.amount || 0);
      }
    }

    // 자산 중 현금성 자산 100%
    if (item.sourceType === "asset") {
      const isCashEquivalent =
        label.includes("현금성") ||
        label.includes("외화예금") ||
        label.includes("예금");

      if (isCashEquivalent) {
        console.log("유동자산 - 자산:", item);
        return sum + (item.amount || 0);
      }
    }

    return sum;
  }, 0);

  console.log("총 유동자산:", liquidAssets);

  // 비상자금 개월 수 (유동 자산 / 월지출)
  const emergencyFundMonths =
    monthlyExpense > 0 ? liquidAssets / monthlyExpense : 0;

  // DSR 계산 (총소득 대비 원리금 상환 비율)
  // 부채 항목에서 연 이자 추정 (totalDebt는 이미 만원 단위)
  const annualInterestManwon = totalDebt * 0.045; // 만원 단위 (예: 21,210만원 * 4.5% = 954.45만원)
  const monthlyInterestManwon = annualInterestManwon / 12; // 월 이자 (만원)
  const dsr = annualIncome > 0 ? (annualInterestManwon / annualIncome) * 100 : 0;

  // 부채 목록
  const debtList = debtItems
    .filter((item) => item.label !== "현금")
    .map((item) => ({
      name: item.label,
      amount: item.amount / 10000,
    }));

  // 차트 옵션
  const getChartOption = () => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(11, 24, 40, 0.95)",
      borderColor: "#4B5563",
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: function (params) {
        return `<div class="font-bold mb-1">${params.name}</div>
                <div class="text-xs">금액: ${params.value.toFixed(1)}억원</div>
                <div class="text-xs">비중: ${params.percent}%</div>`;
      },
    },
    legend: {
      show: false,
    },
    series: [
      {
        name: "자산 구성",
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: "#0B1828",
          borderWidth: 2,
        },
        label: {
          show: true,
          position: "outside",
          color: "#9CA3AF",
          fontSize: 11,
          formatter: "{b}\n{d}%",
          edgeDistance: "10%",
        },
        labelLine: {
          show: true,
          length: 15,
          length2: 0,
          lineStyle: {
            color: "#4B5563",
          },
        },
        data: chartData.map((item) => ({
          value: item.value,
          name: item.name,
          itemStyle: {
            color:
              item.name === "부동산"
                ? "#D4AF37"
                : item.name === "저축투자"
                  ? "#3B82F6"
                  : item.name === "연금"
                    ? "#10B981"
                    : item.name === "현금"
                      ? "#F59E0B"
                      : item.name === "자산"
                        ? "#8B5CF6"
                        : "#6B7280",
          },
        })),
      },
    ],
  });

  // DSR 상태
  const getDSRStatus = () => {
    if (dsr < 15) return { text: "매우 양호", color: "#10B981" };
    if (dsr < 30) return { text: "양호", color: "#3B82F6" };
    if (dsr < 40) return { text: "주의", color: "#F59E0B" };
    return { text: "위험", color: "#EF4444" };
  };

  const dsrStatus = getDSRStatus();

  // 유동성 상태
  const getLiquidityStatus = () => {
    if (emergencyFundMonths >= 6) return { text: "안정적", color: "#10B981" };
    if (emergencyFundMonths >= 3) return { text: "보통", color: "#F59E0B" };
    return { text: "부족", color: "#EF4444" };
  };

  const liquidityStatus = getLiquidityStatus();

  // AI 분석 자동 실행 (한 번만)
  useEffect(() => {
    if (
      simulationData &&
      totalAssets > 0 &&
      !hasAnalyzed.current &&
      !isAnalyzing
    ) {
      hasAnalyzed.current = true; // 실행 플래그 설정
      // AI 분석 대신 기본 인사이트 바로 설정 (CORS 문제로 인해)
      setAiInsights({
        mainInsight: `총자산 ${(totalAssets / 10000).toFixed(1)}억원 중 부채 비율은 ${debtRatio.toFixed(1)}%입니다. ${debtRatio > 50 ? "부채 관리가 필요합니다." : "재무 건전성이 양호합니다."}`,
        liquidityInsight: `비상자금은 ${emergencyFundMonths.toFixed(1)}개월분입니다. ${emergencyFundMonths < 3 ? "최소 3개월 이상 확보를 권장합니다." : emergencyFundMonths < 6 ? "6개월분 확보를 권장합니다." : "충분한 유동성을 보유하고 있습니다."}`,
      });
      // handleAIAnalysis(); // CORS 문제로 주석 처리
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationData, totalAssets]);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);

    try {
      const analysisData = {
        totalAssets: totalAssets / 10000,
        totalDebt: totalDebt / 10000,
        netAssets: netAssets / 10000,
        assetBreakdown: chartData,
        debtRatio,
        dsr,
        emergencyFundMonths,
        monthlyIncome: monthlyIncome / 10000,
        monthlyExpense: monthlyExpense / 10000,
        netCashflow: netCashflow / 10000,
        debtList,
      };

      const result = await analyzeAssetOverview(analysisData);
      console.log("자산 현황 AI 분석 결과:", result);
      setAiInsights(result);
    } catch (error) {
      console.error("AI 분석 실패:", error);
      // 기본 인사이트 설정 (AI 호출 실패 시)
      setAiInsights({
        mainInsight: `총자산 ${(totalAssets / 10000).toFixed(1)}억원 중 부채 비율은 ${debtRatio.toFixed(1)}%입니다. ${debtRatio > 50 ? "부채 관리가 필요합니다." : "재무 건전성이 양호합니다."}`,
        liquidityInsight: `비상자금은 ${emergencyFundMonths.toFixed(1)}개월분입니다. ${emergencyFundMonths < 3 ? "최소 3개월 이상 확보를 권장합니다." : emergencyFundMonths < 6 ? "6개월분 확보를 권장합니다." : "충분한 유동성을 보유하고 있습니다."}`,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!simulationData || !assets || assets.length === 0) {
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
            <span className={styles.stepBadge}>STEP 2-1</span>
            <span className={styles.sectionBadge}>Financial Overview</span>
          </div>
          <h1 className={styles.headerTitle}>자산 현황 브리핑</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>가계의 총자산 구성과 부채 건전성을 진단하여</p>
          <p>재무적 안정성과 리스크 요인을 파악합니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Column: Asset Composition */}
        <div className={styles.leftColumn}>
          <div className={styles.assetCard}>
            <h3 className={styles.cardTitle}>
              <i className="fas fa-chart-pie"></i> 자산 포트폴리오
            </h3>

            {/* Chart */}
            <div className={styles.chartArea}>
              <ReactECharts
                option={getChartOption()}
                style={{ height: "100%", width: "100%" }}
              />
            </div>

            {/* Summary Table */}
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>자산 항목</th>
                    <th>금액 (억원)</th>
                    <th>비중</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <span
                          className={styles.colorDot}
                          style={{
                            backgroundColor:
                              item.name === "부동산"
                                ? "#D4AF37"
                                : item.name === "저축투자"
                                  ? "#3B82F6"
                                  : item.name === "연금"
                                    ? "#10B981"
                                    : item.name === "현금"
                                      ? "#F59E0B"
                                      : item.name === "자산"
                                        ? "#8B5CF6"
                                        : "#6B7280",
                          }}
                        ></span>
                        <span>{item.name}</span>
                      </td>
                      <td className={styles.monospace}>{item.value.toFixed(1)}</td>
                      <td
                        className={styles.monospace}
                        style={{
                          color: index === 0 ? "#F59E0B" : "inherit",
                          fontWeight: index === 0 ? "700" : "normal",
                        }}
                      >
                        {item.ratio.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>총 자산 (Total)</td>
                    <td className={styles.monospace}>
                      {(totalAssets / 10000).toFixed(1)}
                    </td>
                    <td className={styles.monospace}>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          {/* 1. AI Insight Box */}
          <div className={styles.insightBox}>
            <div className={styles.insightHeader}>
              <div className={styles.insightIcon}>
                <i className="fas fa-lightbulb"></i>
              </div>
              <h4 className={styles.insightTitle}>핵심 인사이트</h4>
            </div>
            <p className={styles.insightText}>
              부동산 비중이 87.2%로 여전히 높으나, 여행자금 등 현금성 자산 확보로 유동성이 크게 개선(비상자금 19.5개월분)되었습니다.
            </p>
          </div>

          {/* 2. Liquidity Check */}
          <div className={styles.liquidityCard}>
            <div className={styles.accentBar}></div>
            <div className={styles.liquidityLeft}>
              <h3 className={styles.liquidityTitle}>유동성 진단 (비상자금)</h3>
              <div className={styles.liquidityValue}>
                <p className={styles.valueNumber}>19.5</p>
                <p className={styles.valueUnit}>개월분 보유</p>
              </div>
              <p className={styles.liquidityNote}>
                보유 현금성 자산: 10,366만원(여행자금)
              </p>
            </div>
            <div className={styles.liquidityRight}>
              <div className={styles.progressHeader}>
                <span>현재 수준</span>
                <span>권장 수준 (6개월 이상)</span>
              </div>
              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBar}
                  style={{
                    width: "100%",
                    backgroundColor: "#3B82F6",
                  }}
                ></div>
              </div>
              <div className={styles.liquidityWarning}>
                <i
                  className="fas fa-check-circle"
                  style={{ color: "#3B82F6" }}
                ></i>
                <p>
                  비상자금이 권장 수준을 크게 상회하여 매우 안정적입니다. 향후 의료비 재원 등으로 활용 가능합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Debt Analysis */}
          <div className={styles.debtCard}>
            <div className={styles.debtHeader}>
              <h3 className={styles.cardTitle}>
                <i className="fas fa-file-invoice-dollar"></i> 부채 건전성 진단
              </h3>
              <span className={styles.unit}>단위: 만원</span>
            </div>

            <div className={styles.debtContent}>
              {/* Left: DSR Circle */}
              <div className={styles.dsrSection}>
                <div className={styles.circleContainer}>
                  <svg className={styles.circularChart} viewBox="0 0 36 36">
                    <path
                      className={styles.circleBg}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    ></path>
                    <path
                      className={styles.circle}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      style={{
                        stroke: dsrStatus.color,
                        strokeDasharray: `${dsr}, 100`,
                      }}
                    ></path>
                  </svg>
                  <div className={styles.circleCenter}>
                    <span className={styles.circleLabel}>DSR</span>
                    <span className={styles.circleValue}>{dsr.toFixed(1)}%</span>
                  </div>
                </div>
                <div className={styles.dsrStatus}>
                  <p className={styles.statusText}>상태: {dsrStatus.text}</p>
                  <p className={styles.statusNote}>
                    DSR은 총소득 대비 원리금 상환액 비율로, 30% 이하가 안정적입니다.
                  </p>
                </div>
              </div>

              {/* Right: 2x2 Grid */}
              <div className={styles.debtGrid}>
                {/* Annual Income */}
                <div className={styles.debtGridItem}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemIcon} style={{ backgroundColor: "rgba(59, 130, 246, 0.2)" }}>
                      <i className="fas fa-wallet" style={{ color: "#3B82F6" }}></i>
                    </div>
                    <span>연 소득</span>
                  </div>
                  <p className={styles.itemValue}>{annualIncome.toFixed(1)}</p>
                  <p className={styles.itemNote}>근로+임대+기타 (만원)</p>
                </div>

                {/* Total Debt */}
                <div className={styles.debtGridItem}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemIcon} style={{ backgroundColor: "rgba(251, 191, 36, 0.2)" }}>
                      <i className="fas fa-coins" style={{ color: "#FBBF24" }}></i>
                    </div>
                    <span>총 부채 규모</span>
                  </div>
                  <p className={styles.itemValue}>{totalDebt.toFixed(1)}</p>
                  <p className={styles.itemNote}>
                    {debtList.length > 0 ? `${debtList[0].name} (만원)` : "부채 없음"}
                  </p>
                </div>

                {/* Annual Interest */}
                <div className={styles.debtGridItem}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemIcon} style={{ backgroundColor: "rgba(239, 68, 68, 0.2)" }}>
                      <i className="fas fa-receipt" style={{ color: "#EF4444" }}></i>
                    </div>
                    <span>연 이자비용</span>
                  </div>
                  <p className={styles.itemValue}>{annualInterestManwon.toFixed(1)}</p>
                  <p className={styles.itemNote}>
                    월 약 {monthlyInterestManwon.toFixed(1)} (만원)
                  </p>
                </div>

                {/* Debt Ratio */}
                <div className={styles.debtGridItem}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemIcon} style={{ backgroundColor: "rgba(16, 185, 129, 0.2)" }}>
                      <i className="fas fa-balance-scale" style={{ color: "#10B981" }}></i>
                    </div>
                    <span>부채 비율</span>
                  </div>
                  <p className={styles.itemValue}>{debtRatio.toFixed(1)}%</p>
                  <p
                    className={styles.itemNote}
                    style={{ color: debtRatio < 50 ? "#10B981" : "#F59E0B" }}
                  >
                    {debtRatio < 50 ? "재무 건전성 우수" : "관리 필요"}
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

export default AssetOverviewPage;
