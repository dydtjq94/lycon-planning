import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import styles from "./IncomeStructurePage.module.css";

/**
 * 소득 구조 분석 (Page 12)
 * 완전 하드코딩 버전
 */
function IncomeStructurePage({ profile, simulationData }) {
  const pieChartRef = useRef(null);
  const lineChartRef = useRef(null);

  // 하드코딩된 소득 데이터
  const incomeData = [
    { name: "기타소득", value: 300, percentage: 50.7, color: "#3B82F6" },
    { name: "근로소득", value: 100, percentage: 16.9, color: "#D4AF37" },
    { name: "임대소득", value: 100, percentage: 16.9, color: "#10B981" },
    { name: "개인연금", value: 92, percentage: 15.5, color: "#6B7280" },
  ];

  const totalIncome = 592; // 월 총 소득

  // 하드코딩된 소득 경로 데이터
  const pathData = [
    { label: "60세(25년)", value: 7103 },
    { label: "63세(28년)", value: 7103 },
    { label: "65세(30년)", value: 10338 },
    { label: "66세(31년)", value: 5584 },
    { label: "71세(36년)", value: 4626 },
  ];

  // Pie 차트 초기화
  useEffect(() => {
    if (!pieChartRef.current) return;

    const pieChart = echarts.init(pieChartRef.current);

    const pieOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(11, 24, 40, 0.95)',
        borderColor: '#4B5563',
        textStyle: { color: '#fff' },
        formatter: '{b}: {d}%'
      },
      legend: { show: false },
      series: [
        {
          name: '소득 구성',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 5,
            borderColor: '#0B1828',
            borderWidth: 2
          },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#fff',
              formatter: '{b}\n{d}%'
            }
          },
          data: incomeData.map(item => ({
            value: item.percentage,
            name: item.name,
            itemStyle: { color: item.color }
          }))
        }
      ]
    };

    pieChart.setOption(pieOption);

    return () => {
      pieChart.dispose();
    };
  }, []);

  // Line 차트 초기화
  useEffect(() => {
    if (!lineChartRef.current) return;

    const chartHeight = 200;
    const lineChart = echarts.init(lineChartRef.current, null, {
      renderer: 'canvas',
      height: chartHeight
    });

    const lineOption = {
      backgroundColor: 'transparent',
      grid: {
        top: 25,
        bottom: 35,
        left: 50,
        right: 20
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(11, 24, 40, 0.95)',
        borderColor: '#D4AF37',
        borderWidth: 1,
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params) => {
          const data = params[0];
          return `<strong>${data.axisValue}</strong><br/>연소득: <span style="color:#D4AF37;font-weight:bold">${data.value.toLocaleString()}만원</span>`;
        }
      },
      xAxis: {
        type: 'category',
        data: pathData.map(d => d.label),
        axisLine: { lineStyle: { color: '#4B5563' } },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 11,
          interval: 0
        },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        max: 12000,
        min: 0,
        splitNumber: 4,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#6B7280',
          fontSize: 10,
          formatter: (value) => value.toLocaleString()
        }
      },
      series: [
        {
          name: '예상 연소득',
          type: 'line',
          data: pathData.map(d => d.value),
          smooth: 0.4,
          symbol: 'circle',
          symbolSize: 12,
          itemStyle: {
            color: '#D4AF37',
            borderColor: '#0B1828',
            borderWidth: 3
          },
          lineStyle: {
            width: 4,
            color: '#D4AF37',
            shadowColor: 'rgba(212, 175, 55, 0.5)',
            shadowBlur: 10
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(212, 175, 55, 0.35)' },
              { offset: 0.7, color: 'rgba(212, 175, 55, 0.1)' },
              { offset: 1, color: 'rgba(212, 175, 55, 0)' }
            ])
          },
          label: {
            show: true,
            position: 'top',
            color: '#fff',
            fontSize: 11,
            fontWeight: 'bold',
            formatter: (params) => params.value.toLocaleString()
          }
        }
      ]
    };

    lineChart.setOption(lineOption);

    const handleResize = () => {
      lineChart.resize({ height: chartHeight });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      lineChart.dispose();
    };
  }, []);

  return (
    <div className={styles.slideContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadges}>
            <span className={styles.stepBadge}>STEP 3-1</span>
            <span className={styles.sectionBadge}>Income Structure Analysis</span>
          </div>
          <h1 className={styles.headerTitle}>소득 구조 분석</h1>
        </div>
        <div className={styles.headerDescription}>
          <p>현재 소득의 원천별 구성 비중과 향후 생애주기에 따른</p>
          <p>소득 변화 경로를 예측하여 재무적 대응 방안을 수립합니다.</p>
        </div>
      </div>

      <div className={styles.divider}></div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Column: Income Portfolio */}
        <div className={styles.leftColumn}>
          <div className={styles.incomeCard}>
            <h3 className={styles.cardTitle}>
              <i className="fas fa-wallet"></i> 소득 포트폴리오 (2025년)
            </h3>

            {/* Pie Chart */}
            <div ref={pieChartRef} className={styles.chartContainer}></div>

            {/* Income Table */}
            <div className={styles.tableContainer}>
              <table className={styles.incomeTable}>
                <thead>
                  <tr>
                    <th>소득 원천</th>
                    <th>월 금액 (만원)</th>
                    <th>비중</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span
                        className={styles.colorDot}
                        style={{ backgroundColor: '#3B82F6' }}
                      ></span>
                      기타소득 (자녀지원)
                    </td>
                    <td className={styles.amountCell}>300</td>
                    <td className={styles.percentCell} style={{ color: '#60A5FA', fontWeight: 'bold' }}>50.7%</td>
                  </tr>
                  <tr>
                    <td>
                      <span
                        className={styles.colorDot}
                        style={{ backgroundColor: '#D4AF37' }}
                      ></span>
                      근로소득
                    </td>
                    <td className={styles.amountCell}>100</td>
                    <td className={styles.percentCell}>16.9%</td>
                  </tr>
                  <tr>
                    <td>
                      <span
                        className={styles.colorDot}
                        style={{ backgroundColor: '#10B981' }}
                      ></span>
                      임대소득
                    </td>
                    <td className={styles.amountCell}>100</td>
                    <td className={styles.percentCell}>16.9%</td>
                  </tr>
                  <tr>
                    <td>
                      <span
                        className={styles.colorDot}
                        style={{ backgroundColor: '#6B7280' }}
                      ></span>
                      개인연금
                    </td>
                    <td className={styles.amountCell}>92</td>
                    <td className={styles.percentCell}>15.5%</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td>총 소득 (Total)</td>
                    <td className={styles.amountCell}>{totalIncome}</td>
                    <td>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Insight Box */}
            <div className={styles.insightBox}>
              <p className={styles.insightLabel}>Insight</p>
              <p className={styles.insightText}>
                자녀 지원금(기타소득) 비중이 <strong>50.7%</strong>로 매우 높습니다.
                은퇴 후 국민/퇴직연금 개시 전까지 해당 소득의 지속 가능성이 재무 안정성의 핵심입니다.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          {/* Income Path Projection */}
          <div className={styles.pathCard}>
            <div className={styles.pathHeader}>
              <h3 className={styles.pathTitle}>
                <i className="fas fa-chart-line"></i> 향후 소득 예상 경로
              </h3>
              <span className={styles.pathBadge}>연간 소득 추이 (만원)</span>
            </div>
            <div ref={lineChartRef} className={styles.lineChartContainer}></div>
          </div>

          {/* Event Impact Analysis */}
          <div className={styles.eventsCard}>
            <div className={styles.eventsHeader}>
              <h3 className={styles.eventsTitle}>
                <i className="fas fa-calendar-check"></i> 주요 소득 변동 이벤트
              </h3>
              <span className={styles.eventsPeriod}>향후 10년</span>
            </div>

            <div className={styles.eventsList}>
              {/* Event 1 */}
              <div className={styles.eventItem}>
                <div className={styles.eventLeft}>
                  <div className={styles.eventYear} style={{ color: '#3B82F6', borderColor: '#374151' }}>
                    2030
                  </div>
                  <div className={styles.eventContent}>
                    <p className={styles.eventName}>공식 은퇴 및 연금 개시 (65세)</p>
                    <p className={styles.eventDesc}>국민연금 + 퇴직연금 수령 시작 (연 4,338만원 규모)</p>
                  </div>
                </div>
                <div className={styles.eventBadge} style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#93C5FD' }}>
                  소득 ▲ 46%
                </div>
              </div>

              {/* Event 2 */}
              <div className={styles.eventItem}>
                <div className={styles.eventLeft}>
                  <div className={styles.eventYear} style={{ color: '#F59E0B', borderColor: '#374151' }}>
                    2031
                  </div>
                  <div className={styles.eventContent}>
                    <p className={styles.eventName}>근로소득 & 자녀지원 종료 (66세)</p>
                    <p className={styles.eventDesc}>근로소득(월 100만원) 및 자녀지원금(월 300만원) 종료로 인한 대폭 소득 감소</p>
                  </div>
                </div>
                <div className={styles.eventBadge} style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#FCD34D' }}>
                  소득 ▼ 46%
                </div>
              </div>

              {/* Event 3 */}
              <div className={styles.eventItem}>
                <div className={styles.eventLeft}>
                  <div className={styles.eventYear} style={{ color: '#EF4444', borderColor: '#374151' }}>
                    상시
                  </div>
                  <div className={styles.eventContent}>
                    <p className={styles.eventName}>자녀 지원금 리스크</p>
                    <p className={styles.eventDesc}>월 300만원 지원금의 변동성에 따른 소득 충격 위험</p>
                  </div>
                </div>
                <div className={styles.eventBadge} style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5' }}>
                  높은 변동성
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IncomeStructurePage;
