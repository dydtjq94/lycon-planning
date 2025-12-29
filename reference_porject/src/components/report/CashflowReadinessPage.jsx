import React, { useEffect, useRef } from "react";
import styles from "./CashflowReadinessPage.module.css";

/**
 * 은퇴 현금흐름 준비율 진단 페이지 (Page 6)
 * STEP 1-3: 은퇴 현금흐름 준비율 진단 (2031-2055)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function CashflowReadinessPage() {
  const canvasRef = useRef(null);

  // ===== 하드코딩된 값들 (HTML 기준) =====
  // 은퇴 기간: 2031-2055 (66세~90세, 25년)
  // 총공급: 30.4억원 (연금 11.4 + 자산/유입 18.4 + 임대 0.6)
  // 총수요: 35.5억원 (부동산/상환 19.1 + 생활/의료 14.2 + 금융 2.2)
  // 부족 자금: 5.1억원
  // 은퇴 자금 준비율: 85.6%

  // 차트 그리기
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Set Canvas Resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const width = rect.width;
    const height = rect.height;

    // Data - HTML 기준 하드코딩
    // Supply 총 30.4억 + 부족 5.1억 = 35.5억 (Demand와 동일 높이)
    const supplyData = [
      { value: 11.4, label: "연금소득", color: "#1E3A8A" },      // 국민+퇴직
      { value: 18.4, label: "자산/대출유입", color: "#3B82F6" }, // 대출8+전세8+기타2.4
      { value: 0.6, label: "임대소득", color: "#60A5FA" },       // 상가임대
      { value: 5.1, label: "부족자금", color: "pattern" },       // 35.5 - 30.4
    ];

    // Demand 총 35.5억
    const demandData = [
      { value: 19.1, label: "부동산/상환", color: "#D97706" },   // 원금/전세/분담금
      { value: 14.2, label: "생활/의료비", color: "#F59E0B" },   // 생활12+의료2.2
      { value: 2.2, label: "금융비용", color: "#FDE68A" },       // 이자/관리비
    ];

    // Chart Config
    const padding = { top: 40, bottom: 30, left: 40, right: 120 };
    const chartHeight = height - padding.top - padding.bottom;
    const chartWidth = width - padding.left - padding.right;
    const barWidth = 80;
    const spacing = (chartWidth - barWidth * 2) / 3;
    const maxValue = 40; // Scale to 40억 to fit 35.5 (HTML 기준)

    // Create Stripe Pattern
    const pCanvas = document.createElement("canvas");
    pCanvas.width = 10;
    pCanvas.height = 10;
    const pCtx = pCanvas.getContext("2d");
    pCtx.strokeStyle = "rgba(239, 68, 68, 0.5)";
    pCtx.lineWidth = 1;
    pCtx.beginPath();
    pCtx.moveTo(0, 10);
    pCtx.lineTo(10, 0);
    pCtx.stroke();
    const stripePattern = ctx.createPattern(pCanvas, "repeat");

    // Drawing Function
    function drawBar(x, data) {
      let currentY = height - padding.bottom;
      data.forEach((item) => {
        const barH = (item.value / maxValue) * chartHeight;
        const y = currentY - barH;

        // Draw Rect
        ctx.fillStyle = item.color === "pattern" ? stripePattern : item.color;
        ctx.fillRect(x, y, barWidth, barH);

        // Border for pattern
        if (item.color === "pattern") {
          ctx.strokeStyle = "#EF4444";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 2]);
          ctx.strokeRect(x, y, barWidth, barH);
          ctx.setLineDash([]);
        }

        // Label
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 11px Inter";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (barH > 15) {
          ctx.fillText(item.value.toFixed(1), x + barWidth / 2, y + barH / 2);
        }

        currentY -= barH;
      });
    }

    // Draw Axis Lines (HTML 기준: 10 단위로)
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= maxValue; i += 10) {
      const y = height - padding.bottom - (i / maxValue) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-Axis Labels
      ctx.fillStyle = "#9CA3AF";
      ctx.font = "10px Inter";
      ctx.textAlign = "right";
      ctx.fillText(i, padding.left - 10, y + 3);
    }
    ctx.setLineDash([]);

    // Draw Bars
    const x1 = padding.left + spacing;
    const x2 = x1 + barWidth + spacing;

    drawBar(x1, supplyData);
    drawBar(x2, demandData);

    // X-Axis Labels (HTML 기준)
    ctx.fillStyle = "#D1D5DB";
    ctx.font = "bold 12px Inter";
    ctx.textAlign = "center";
    ctx.fillText("총공급 (Supply)", x1 + barWidth / 2, height - 10);
    ctx.fillText("총수요 (Demand)", x2 + barWidth / 2, height - 10);

    // Legend
    const legendX = width - 110;
    let legendY = padding.top + 10;

    const allItems = [
      ...supplyData.slice().reverse(),
      { spacer: true },
      ...demandData.slice().reverse(),
    ];

    allItems.forEach((item) => {
      if (item.spacer) {
        legendY += 10;
        return;
      }

      // Box
      ctx.fillStyle = item.color === "pattern" ? stripePattern : item.color;
      ctx.fillRect(legendX, legendY, 12, 12);
      if (item.color === "pattern") {
        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, legendY, 12, 12);
      }

      // Text
      ctx.fillStyle = "#9CA3AF";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "11px Inter";
      ctx.fillText(item.label, legendX + 20, legendY + 6);

      legendY += 20;
    });
  }, []); // 하드코딩된 값이므로 의존성 없음

  return (
    <div className={styles.slideContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadges}>
            <span className={styles.stepBadge}>STEP 1-3</span>
            <span className={styles.checklistBadge}>Cashflow Analysis</span>
          </div>
          <h1 className={styles.headerTitle}>은퇴 현금흐름 준비율 진단 (2031-2055)</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>은퇴 기간(66세~90세) 동안의 자금 총수요와 총공급을 분석하여</p>
          <p>생애 주기별 현금흐름 과부족 및 유동성 리스크를 진단합니다.</p>
        </div>
      </div>

      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Column: KPI Cards */}
        <div className={styles.leftColumn}>
          {/* KPI 1: 은퇴 자금 준비율 - 85.6% (노란색 경고) */}
          <div className={styles.kpiCardCircle} style={{ borderTopColor: "#EAB308" }}>
            <div className={styles.cardTopBar}>
              <span className={styles.cardTopLabel}>
                은퇴 자금 준비율 (총액)
              </span>
              <i
                className="fas fa-exclamation-circle"
                style={{ color: "#EAB308" }}
              ></i>
            </div>
            <div className={styles.circleChartContainer}>
              <svg className={styles.circleSvg} viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="#1F2937"
                  strokeWidth="10"
                ></circle>
                {/* 85.6% filled: 440 * 0.856 ≈ 376.6, offset = 440 - 376.6 = 63.4 */}
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="#EAB308"
                  strokeWidth="10"
                  strokeDasharray="440"
                  strokeDashoffset="63"
                  transform="rotate(-90 80 80)"
                ></circle>
              </svg>
              <div className={styles.circleCenter}>
                <p className={styles.circleValue}>
                  85.6
                  <span className={styles.circleUnit}>%</span>
                </p>
              </div>
            </div>
            <p className={styles.circleDescription}>
              총수요 35.5억원 대비
              <br />
              <strong>30.4억원</strong> 확보 (부족 5.1억)
            </p>
          </div>

          {/* KPI 2: 현금흐름 위기 요인 - 빨간색 경고 */}
          <div className={styles.kpiCardRisk} style={{ borderTopColor: "#EF4444" }}>
            <div className={styles.cardTopBar}>
              <span className={styles.cardTopLabel}>현금흐름 위기 요인</span>
              <i className="fas fa-heartbeat" style={{ color: "#EF4444" }}></i>
            </div>
            <div className={styles.riskTitle}>의료비 급증</div>
            <p className={styles.riskDescription}>
              75세 이후 의료비 지출이 가파르게 상승하여
              <br />
              연금 소득만으로는 감당하기 어려운
              <br />
              구조적 현금흐름 적자가 심화될 위험이 있습니다.
            </p>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: "70%" }}
              ></div>
            </div>
            <div className={styles.progressLabels}>
              <span>소득 대비 의료비 부담</span>
              <span>경고 단계</span>
            </div>
          </div>
        </div>

        {/* Right Column: Chart */}
        <div className={styles.rightColumn}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>
              <i className="fas fa-chart-pie" style={{ color: "#D97706" }}></i>
              {" "}은퇴 후(25년) 자금 총수요 vs 총공급 세부 구성
            </h3>
            <div className={styles.chartUnit}>단위: 억원</div>
          </div>

          {/* Summary Stats - HTML 기준 하드코딩 */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>은퇴 자금 총수요</span>
                <i className="fas fa-shopping-cart" style={{ color: "#EAB308" }}></i>
              </div>
              <div className={styles.statValue} style={{ color: "#FACC15" }}>
                35.5억원
              </div>
              <div className={styles.statLabel}>
                부동산/상환(19.1) + 생활/의료(14.2)
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>은퇴 자금 총공급</span>
                <i className="fas fa-hand-holding-dollar" style={{ color: "#3B82F6" }}></i>
              </div>
              <div className={styles.statValue} style={{ color: "#60A5FA" }}>
                30.4억원
              </div>
              <div className={styles.statLabel}>연금(11.4) + 자산/유입(18.4)</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>부족 자금 (Shortfall)</span>
                <i className="fas fa-minus-circle" style={{ color: "#EF4444" }}></i>
              </div>
              <div className={styles.statValue} style={{ color: "#F87171" }}>
                5.1억원
              </div>
              <div className={styles.statLabel}>순현금흐름 적자 예상</div>
            </div>
          </div>

          {/* Canvas Chart */}
          <div className={styles.canvasContainer}>
            <canvas ref={canvasRef}></canvas>
          </div>

          {/* Insight - HTML 기준 하드코딩 */}
          <div className={styles.insightBox}>
            <div className={styles.insightSection} style={{ borderRight: "1px solid #374151", paddingRight: "16px" }}>
              <p className={styles.insightLabel} style={{ color: "#F87171" }}>
                RISK POINT
              </p>
              <p className={styles.insightText}>
                은퇴 후반기 의료비 증가(총 2.2억)와 물가 상승으로 인해,{" "}
                <strong>2040년 이후 현금흐름</strong>이 급격히 악화되며{" "}
                <strong style={{ color: "#F87171" }}>
                  약 5.1억원의 자금 부족
                </strong>
                이 발생할 것으로 예상됩니다.
              </p>
            </div>
            <div className={styles.insightSection} style={{ paddingLeft: "8px" }}>
              <p className={styles.insightLabel} style={{ color: "#4ADE80" }}>
                SOLUTION
              </p>
              <p className={styles.insightText}>
                보유중인 자산의 수익률을 높여 배당, 이자 등{" "}
                <strong>안정적인 현금흐름을 확보하는 구조</strong>로 재편할
                필요가 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default CashflowReadinessPage;
