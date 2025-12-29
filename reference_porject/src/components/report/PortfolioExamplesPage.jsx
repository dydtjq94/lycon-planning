import React, { useRef, useEffect } from "react";
import * as echarts from "echarts";
import styles from "./PortfolioExamplesPage.module.css";

/**
 * 예시 포트폴리오 & 즉시 실행 액션 (Page 26)
 * @param {Object} profile - 프로필 데이터
 * @param {Object} simulationData - 시뮬레이션 전체 데이터
 */
function PortfolioExamplesPage({ profile, simulationData }) {
  const chart1Ref = useRef(null);
  const chart2Ref = useRef(null);
  const chart3Ref = useRef(null);
  const chart4Ref = useRef(null);

  // 도넛 차트 생성 함수
  const createDonutChart = (chartRef, data, colors) => {
    if (!chartRef.current) return null;

    const chart = echarts.init(chartRef.current);

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c}%",
        backgroundColor: "rgba(11, 24, 40, 0.9)",
        borderColor: "#4B5563",
        textStyle: { color: "#fff" },
      },
      series: [
        {
          type: "pie",
          radius: ["65%", "85%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderWidth: 0,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: false,
            },
            scale: true,
            scaleSize: 5,
          },
          data: data.map((item, index) => ({
            value: item.value,
            name: item.name,
            itemStyle: { color: colors[index] },
          })),
        },
      ],
    };

    chart.setOption(option);
    return chart;
  };

  useEffect(() => {
    // Growth+Dividend Portfolio
    const chart1 = createDonutChart(
      chart1Ref,
      [
        { name: "QQQ", value: 20 },
        { name: "SPY", value: 50 },
        { name: "SCHD", value: 30 },
      ],
      ["#EF4444", "#F87171", "#FCA5A5"]
    );

    // All Weather Portfolio
    const chart2 = createDonutChart(
      chart2Ref,
      [
        { name: "QQQ", value: 30 },
        { name: "SHY", value: 50 },
        { name: "GLD", value: 20 },
      ],
      ["#3B82F6", "#60A5FA", "#93C5FD"]
    );

    // Dividend ETF
    const chart3 = createDonutChart(
      chart3Ref,
      [{ name: "SCHD", value: 100 }],
      ["#10B981"]
    );

    // S&P 500 ETF
    const chart4 = createDonutChart(
      chart4Ref,
      [{ name: "SPY", value: 100 }],
      ["#F59E0B"]
    );

    return () => {
      chart1?.dispose();
      chart2?.dispose();
      chart3?.dispose();
      chart4?.dispose();
    };
  }, []);

  return (
    <div className={styles.slideContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadges}>
            <span className={styles.stepBadge}>BACKTESTED DATA</span>
            <span className={styles.sectionBadge}>Performance Summary</span>
          </div>
          <h1 className={styles.headerTitle}>
            예시 포트폴리오 &amp; 즉시 실행 액션
          </h1>
        </div>
        <div className={styles.headerDescription}>
          <span className={styles.assumptionBadge}>
            가정: 2012.1~2025.10, 시작금액 $10,000
          </span>
          <p>실제 백테스팅 데이터를 기반으로 검증된 포트폴리오입니다.</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.portfolioGrid}>
          {/* Card 1: Growth+Dividend Portfolio */}
          <div className={`${styles.portfolioCard} ${styles.cardRed}`}>
            <div className={styles.topBar}></div>
            <div className={styles.cardHeader}>
              <div
                className={`${styles.iconBox} ${styles.iconBoxRed}`}
              >
                <i className="fas fa-chart-line"></i>
              </div>
              <span className={`${styles.cagrBadge} ${styles.badgeRed}`}>
                15.34% CAGR
              </span>
            </div>
            <div className={styles.cardTitle}>
              <h3>Growth+Dividend</h3>
              <p className={styles.titleRed}>
                QQQ 20% / SPY 50% / SCHD 30%
              </p>
            </div>
            <div className={styles.etfContainer}>
              <span className={styles.etfTag}>TIGER 미국나스닥100</span>
              <span className={styles.etfTag}>TIGER 미국S&amp;P500</span>
              <span className={styles.etfTag}>TIGER 미국배당다우존스</span>
            </div>
            <div className={styles.donutContainer} ref={chart1Ref}></div>
            <div className={styles.metricsContainer}>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>시작 금액</span>
                <span className={styles.metricValue}>$10,000</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최종 금액</span>
                <span className={styles.metricValue}>$72,000</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>연배당률</span>
                <span className={styles.metricValueGreen}>1.78%</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>투자기간</span>
                <span className={styles.metricValueBlue}>
                  최저 2년 / 추천 3년
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최대 낙폭</span>
                <span className={styles.metricValueRed}>-23.17%</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최고/최악년</span>
                <span className={styles.metricValue}>
                  <span className={styles.textGreen}>33.35%</span> /{" "}
                  <span className={styles.textRed}>-16.57%</span>
                </span>
              </div>
            </div>
            <div className={styles.analysisBox}>
              <p className={styles.analysisItemGreen}>
                <i className="fas fa-plus-circle"></i>최고수익, 성장+배당 균형
              </p>
              <p className={styles.analysisItemRed}>
                <i className="fas fa-minus-circle"></i>변동성 높음, 주식100%
              </p>
              <p className={styles.analysisItemBlue}>
                <i className="fas fa-user-check"></i>적합: 50대 초중반
              </p>
            </div>
          </div>

          {/* Card 2: All Weather Portfolio */}
          <div className={`${styles.portfolioCard} ${styles.cardBlue}`}>
            <div className={styles.topBar}></div>
            <div className={styles.cardHeader}>
              <div
                className={`${styles.iconBox} ${styles.iconBoxBlue}`}
              >
                <i className="fas fa-shield-alt"></i>
              </div>
              <span className={`${styles.cagrBadge} ${styles.badgeBlue}`}>
                8.61% CAGR
              </span>
            </div>
            <div className={styles.cardTitle}>
              <h3>All Weather</h3>
              <p className={styles.titleBlue}>
                QQQ 30% / SHY 50% / GLD 20%
              </p>
            </div>
            <div className={styles.etfContainer}>
              <span className={styles.etfTag}>TIGER 미국나스닥100</span>
              <span className={styles.etfTag}>TIGER 미국달러단기채권</span>
              <span className={styles.etfTag}>TIGER KRX금현물</span>
            </div>
            <div className={styles.donutContainer} ref={chart2Ref}></div>
            <div className={styles.metricsContainer}>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>시작 금액</span>
                <span className={styles.metricValue}>$10,000</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최종 금액</span>
                <span className={styles.metricValue}>$31,352</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>연배당률</span>
                <span className={styles.metricValueGreen}>1.84%</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>투자기간</span>
                <span className={styles.metricValueBlue}>
                  최저 1년 / 추천 2년
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최대 낙폭</span>
                <span className={styles.metricValueRed}>-13.92%</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최고/최악년</span>
                <span className={styles.metricValue}>
                  <span className={styles.textGreen}>21.08%</span> /{" "}
                  <span className={styles.textRed}>-11.87%</span>
                </span>
              </div>
            </div>
            <div className={styles.analysisBox}>
              <p className={styles.analysisItemGreen}>
                <i className="fas fa-plus-circle"></i>최저 MDD, 최고 효율
              </p>
              <p className={styles.analysisItemRed}>
                <i className="fas fa-minus-circle"></i>가장 낮은 CAGR 8.61%
              </p>
              <p className={styles.analysisItemBlue}>
                <i className="fas fa-user-check"></i>적합: 60대 이상 보수적
              </p>
            </div>
          </div>

          {/* Card 3: Dividend ETF */}
          <div className={`${styles.portfolioCard} ${styles.cardGreen}`}>
            <div className={styles.topBar}></div>
            <div className={styles.cardHeader}>
              <div
                className={`${styles.iconBox} ${styles.iconBoxGreen}`}
              >
                <i className="fas fa-hand-holding-usd"></i>
              </div>
              <span className={`${styles.cagrBadge} ${styles.badgeGreen}`}>
                11.91% CAGR
              </span>
            </div>
            <div className={styles.cardTitle}>
              <h3>Dividend ETF</h3>
              <p className={styles.titleGreen}>SCHD 100%</p>
            </div>
            <div className={styles.etfContainer}>
              <span className={styles.etfTag}>TIGER 미국배당다우존스</span>
            </div>
            <div className={styles.donutContainer} ref={chart3Ref}></div>
            <div className={styles.metricsContainer}>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>시작 금액</span>
                <span className={styles.metricValue}>$10,000</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최종 금액</span>
                <span className={styles.metricValue}>$47,417</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>연배당률</span>
                <span className={styles.metricValueGreen}>3.92%</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>투자기간</span>
                <span className={styles.metricValueBlue}>
                  최저 3년 / 추천 4년
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최대 낙폭</span>
                <span className={styles.metricValueRed}>-21.54%</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최고/최악년</span>
                <span className={styles.metricValue}>
                  <span className={styles.textGreen}>32.89%</span> /{" "}
                  <span className={styles.textRed}>-5.56%</span>
                </span>
              </div>
            </div>
            <div className={styles.analysisBox}>
              <p className={styles.analysisItemGreen}>
                <i className="fas fa-plus-circle"></i>최저 손실 -5.56%, 고배당
              </p>
              <p className={styles.analysisItemRed}>
                <i className="fas fa-minus-circle"></i>효율 낮음, 섹터 편중
              </p>
              <p className={styles.analysisItemBlue}>
                <i className="fas fa-user-check"></i>적합: 50대 후반 배당중시
              </p>
            </div>
          </div>

          {/* Card 4: S&P 500 ETF */}
          <div className={`${styles.portfolioCard} ${styles.cardYellow}`}>
            <div className={styles.topBar}></div>
            <div className={styles.cardHeader}>
              <div
                className={`${styles.iconBox} ${styles.iconBoxYellow}`}
              >
                <i className="fas fa-university"></i>
              </div>
              <span className={`${styles.cagrBadge} ${styles.badgeYellow}`}>
                15.04% CAGR
              </span>
            </div>
            <div className={styles.cardTitle}>
              <h3>S&amp;P 500 ETF</h3>
              <p className={styles.titleYellow}>SPY 100%</p>
            </div>
            <div className={styles.etfContainer}>
              <span className={styles.etfTag}>TIGER 미국S&amp;P500</span>
              <span className={styles.etfTag}>KODEX 미국S&amp;P500</span>
              <span className={styles.etfTag}>ACE 미국S&amp;P500</span>
            </div>
            <div className={styles.donutContainer} ref={chart4Ref}></div>
            <div className={styles.metricsContainer}>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>시작 금액</span>
                <span className={styles.metricValue}>$10,000</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최종 금액</span>
                <span className={styles.metricValue}>$69,439</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>연배당률</span>
                <span className={styles.metricValueGreen}>1.50%</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>투자기간</span>
                <span className={styles.metricValueBlue}>
                  최저 2년 / 추천 3년
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최대 낙폭</span>
                <span className={styles.metricValueRed}>-23.93%</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>최고/최악년</span>
                <span className={styles.metricValue}>
                  <span className={styles.textGreen}>32.31%</span> /{" "}
                  <span className={styles.textRed}>-18.17%</span>
                </span>
              </div>
            </div>
            <div className={styles.analysisBox}>
              <p className={styles.analysisItemGreen}>
                <i className="fas fa-plus-circle"></i>2위 CAGR, 시장 대표성
              </p>
              <p className={styles.analysisItemRed}>
                <i className="fas fa-minus-circle"></i>최고 MDD, 낮은 배당
              </p>
              <p className={styles.analysisItemBlue}>
                <i className="fas fa-user-check"></i>적합: 40-50대 적극적
              </p>
            </div>
          </div>

          {/* Card 5: 즉시 실행 액션 */}
          <div className={`${styles.portfolioCard} ${styles.cardPurple}`}>
            <div className={styles.topBar}></div>
            <div className={styles.cardHeader}>
              <div
                className={`${styles.iconBox} ${styles.iconBoxPurple}`}
              >
                <i className="fas fa-tasks"></i>
              </div>
              <span className={`${styles.cagrBadge} ${styles.badgePurple}`}>
                Action Plan
              </span>
            </div>
            <div className={styles.cardTitle}>
              <h3>즉시 실행 5대 수칙</h3>
              <p className={styles.titlePurple}>
                성공 투자를 위한 필수 루틴
              </p>
            </div>
            <div className={styles.actionList}>
              <div className={styles.actionItem}>
                <div className={styles.actionNumber}>1</div>
                <div>
                  <p className={styles.actionTitle}>자동이체 설정</p>
                  <p className={styles.actionDesc}>
                    급여 다음날 월/분기 적립식 투자
                  </p>
                </div>
              </div>
              <div className={styles.actionItem}>
                <div className={styles.actionNumber}>2</div>
                <div>
                  <p className={styles.actionTitle}>리밸런싱 규칙</p>
                  <p className={styles.actionDesc}>
                    목표 비중 ±5%p 이탈 시 조정
                  </p>
                </div>
              </div>
              <div className={styles.actionItem}>
                <div className={styles.actionNumber}>3</div>
                <div>
                  <p className={styles.actionTitle}>현금버퍼 확보</p>
                  <p className={styles.actionDesc}>
                    월 생활비 3~6개월분 별도 관리
                  </p>
                </div>
              </div>
              <div className={styles.actionItem}>
                <div className={styles.actionNumber}>4</div>
                <div>
                  <p className={styles.actionTitle}>비용 절감</p>
                  <p className={styles.actionDesc}>
                    저보수 ETF 활용 (0.5% 이하)
                  </p>
                </div>
              </div>
              <div className={styles.actionItem}>
                <div className={styles.actionNumber}>5</div>
                <div>
                  <p className={styles.actionTitle}>세제 혜택 최우선</p>
                  <p className={styles.actionDesc}>
                    IRP/연금저축 연 1,800만원 우선
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

export default PortfolioExamplesPage;
