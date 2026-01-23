"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
} from "chart.js";
import styles from "./DiagnosisReport.module.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export interface DiagnosisData {
  customerName: string;
  currentAge: number;
  spouseAge: number | null;
  lifeExpectancy: number;
  targetRetirementAge: number;
  nationalPensionPersonal: number;
  nationalPensionSpouse: number;
  retirementPensionPersonal: number;
  retirementPensionSpouse: number;
  privatePensionPersonal: number;
  privatePensionSpouse: number;
  otherIncomePersonal: number;
  otherIncomeSpouse: number;
  realEstateAsset: number;
  financialAsset: number;
  pensionAsset: number;
  mortgageAmount: number;
  mortgageRate: number;
  creditLoanAmount: number;
  creditLoanRate: number;
  otherDebtAmount: number;
  otherDebtRate: number;
  monthlyIncome: number;
  monthlyFixedExpense: number;
  monthlyLivingExpense: number;
}

interface DiagnosisReportProps {
  data: DiagnosisData;
  userId: string;
  isPublished?: boolean;
  hideActions?: boolean;
  opinion?: string;
  onOpinionChange?: (opinion: string) => void;
}

import { useState, useMemo } from "react";

// 간단한 마크다운 파서 (볼드, 이태릭, 밑줄)
function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // **볼드**
    .replace(/\*(.+?)\*/g, '<em>$1</em>') // *이태릭*
    .replace(/__(.+?)__/g, '<u>$1</u>') // __밑줄__
    .replace(/\n/g, '<br />'); // 줄바꿈
}

export function DiagnosisReport({
  data,
  userId,
  isPublished = false,
  hideActions = false,
  opinion = "",
  onOpinionChange,
}: DiagnosisReportProps) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(isPublished);
  // 계산 로직
  const totalAsset = data.realEstateAsset + data.financialAsset + data.pensionAsset;
  const totalDebt = data.mortgageAmount + data.creditLoanAmount + data.otherDebtAmount;
  const netWorth = Math.round((totalAsset - totalDebt / 10000) * 100) / 100;

  const monthlyPension =
    data.nationalPensionPersonal +
    data.nationalPensionSpouse +
    data.retirementPensionPersonal +
    data.retirementPensionSpouse +
    data.privatePensionPersonal +
    data.privatePensionSpouse +
    data.otherIncomePersonal +
    data.otherIncomeSpouse;

  // 은퇴 후 월지출 = 현재 지출의 70%
  const currentExpenseBase = data.monthlyFixedExpense + data.monthlyLivingExpense;
  const monthlyExpense = Math.round(currentExpenseBase * 0.7);
  const monthlyGap = monthlyPension - monthlyExpense;

  // 현재 현금흐름
  const monthlyInterest = Math.round(
    (data.mortgageAmount * data.mortgageRate) / 100 / 12 +
      (data.creditLoanAmount * data.creditLoanRate) / 100 / 12 +
      (data.otherDebtAmount * data.otherDebtRate) / 100 / 12
  );
  const currentMonthlyExpense = data.monthlyFixedExpense + data.monthlyLivingExpense + monthlyInterest;
  const currentMonthlyGap = data.monthlyIncome - currentMonthlyExpense;

  // 자산 비율
  const realEstateRatio = totalAsset > 0 ? Math.round((data.realEstateAsset / totalAsset) * 100) : 0;
  const financialRatio = totalAsset > 0 ? Math.round((data.financialAsset / totalAsset) * 100) : 0;
  const pensionRatio = 100 - realEstateRatio - financialRatio;

  // 유동자산 = 금융 + 연금 - 부채
  const liquidAsset = Math.round((data.financialAsset + data.pensionAsset - totalDebt / 10000) * 100) / 100;

  // 은퇴 시점까지 유동자산 성장
  const yearsToRetirement = Math.max(0, data.targetRetirementAge - data.currentAge);
  const growthRate = 0.025;
  const liquidAssetAtRetirement =
    Math.round(liquidAsset * Math.pow(1 + growthRate, yearsToRetirement) * 100) / 100;

  // 자산 소진 시점 계산
  const retirementYears = data.lifeExpectancy - data.targetRetirementAge;
  const annualShortfall = monthlyGap < 0 ? (Math.abs(monthlyGap) * 12) / 10000 : 0;
  const yearsOfWithdrawal =
    liquidAssetAtRetirement <= 0
      ? 0
      : annualShortfall > 0
        ? Math.round((liquidAssetAtRetirement / annualShortfall) * 10) / 10
        : 999;
  const assetDepletionAge = data.targetRetirementAge + Math.floor(yearsOfWithdrawal);
  const shortfallYears = Math.max(0, retirementYears - yearsOfWithdrawal);

  // 연금 충당률
  const pensionCoverageRate = monthlyExpense > 0 ? Math.round((monthlyPension / monthlyExpense) * 100) : 0;

  // 총수요/총공급
  const totalDemand = Math.round(((retirementYears * monthlyExpense * 12) / 10000) * 100) / 100;
  const totalPensionSupply = Math.round(((retirementYears * monthlyPension * 12) / 10000) * 100) / 100;
  const totalSupply =
    Math.round((totalPensionSupply + Math.max(0, liquidAssetAtRetirement)) * 100) / 100;
  const supplyDeficit = Math.round((totalDemand - totalSupply) * 100) / 100;
  const supplyRatio = totalDemand > 0 ? Math.round((totalSupply / totalDemand) * 100) : 0;
  const deficitRatio = 100 - supplyRatio;

  // 리스크 수준 판단
  const getRiskLevel = (value: number, thresholds: [number, number]) => {
    if (value >= thresholds[1]) return "high";
    if (value >= thresholds[0]) return "medium";
    return "low";
  };

  // 소견 생성
  const generateVerdict = () => {
    const findings: string[] = [];
    const recommendations: string[] = [];

    if (monthlyGap < 0) {
      findings.push(`은퇴 후 월 ${Math.abs(monthlyGap)}만원의 현금흐름 부족이 예상됩니다`);
      if (currentMonthlyGap > 0) {
        recommendations.push(`현재 월 저축여력 ${currentMonthlyGap}만원을 활용한 자산 축적 전략 수립`);
      }
    }

    if (realEstateRatio >= 70) {
      findings.push(`부동산 비중이 ${realEstateRatio}%로 유동성 리스크가 높습니다`);
      recommendations.push("부동산 일부 현금화 또는 역모기지 활용 검토");
    }

    if (pensionCoverageRate < 50) {
      findings.push(`연금 충당률이 ${pensionCoverageRate}%로 매우 낮습니다`);
      recommendations.push("개인연금 추가 가입 또는 연금저축 확대 검토");
    }

    if (yearsOfWithdrawal < retirementYears) {
      findings.push(`현재 구조 유지 시 ${assetDepletionAge}세에 금융자산 소진이 예상됩니다`);
      recommendations.push(`${data.lifeExpectancy}세까지 자산 유지를 위한 현금흐름 개선 필요`);
    }

    return {
      findingText: findings.length > 0 ? findings.slice(0, 2).join(". ") + "." : "현재 재무 구조가 안정적입니다.",
      recommendationText: recommendations.length > 0 ? recommendations[0] + "이 필요합니다." : "",
    };
  };

  const verdict = generateVerdict();

  // 저축률 평가
  const savingsRate = data.monthlyIncome > 0 ? (currentMonthlyGap / data.monthlyIncome) * 100 : 0;
  const getSavingsGrade = () => {
    if (savingsRate < 0) return { grade: "적자", className: styles.gradeDanger };
    if (savingsRate < 10) return { grade: "부족", className: styles.gradeWarning };
    if (savingsRate < 20) return { grade: "보통", className: styles.gradeCaution };
    if (savingsRate < 30) return { grade: "양호", className: styles.gradeGood };
    return { grade: "우수", className: styles.gradeExcellent };
  };
  const savingsGrade = getSavingsGrade();

  // 은퇴 후 현금흐름 평가
  const getRetirementGrade = () => {
    if (monthlyGap < 0 && pensionCoverageRate < 50) return { grade: "위험", className: styles.gradeDanger };
    if (monthlyGap < 0 && pensionCoverageRate < 70) return { grade: "부족", className: styles.gradeWarning };
    if (monthlyGap < 0) return { grade: "주의", className: styles.gradeCaution };
    if (pensionCoverageRate >= 100) return { grade: "충분", className: styles.gradeExcellent };
    return { grade: "양호", className: styles.gradeGood };
  };
  const retirementGrade = getRetirementGrade();

  // 인쇄 핸들러
  const handlePrint = () => {
    window.print();
  };

  // 발행 핸들러
  const handlePublish = async () => {
    if (published) {
      alert("이미 발행된 보고서입니다.");
      return;
    }

    if (!confirm("보고서를 발행하시겠습니까?\n고객에게 SMS가 발송됩니다.")) {
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch("/api/report/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, opinion }),
      });

      const result = await response.json();

      if (result.success) {
        setPublished(true);
        alert("보고서가 발행되었습니다.\n고객에게 SMS가 발송되었습니다.");
      } else {
        alert(result.error || "발행에 실패했습니다.");
      }
    } catch {
      alert("발행 중 오류가 발생했습니다.");
    } finally {
      setPublishing(false);
    }
  };

  // 오늘 날짜
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <div className={styles.reportContainer}>
      {!hideActions && (
        <div className={styles.actionButtons}>
          <button className={styles.printButton} onClick={handlePrint}>
            인쇄하기
          </button>
          <button
            className={`${styles.publishButton} ${published ? styles.published : ""}`}
            onClick={handlePublish}
            disabled={publishing || published}
          >
            {publishing ? "발행 중..." : published ? "발행 완료" : "보고서 발행하기"}
          </button>
        </div>
      )}

      <div className={styles.reportPage}>
        {/* 헤더 */}
        <header className={styles.reportHeader}>
          <div className={styles.reportHeaderLeft}>
            <div className={styles.reportLogo}>Lycon Planning</div>
            <h1 className={styles.reportTitle}>은퇴 준비 진단표</h1>
          </div>
          <div className={styles.reportHeaderRight}>
            <span className={styles.reportInfoLabel}>성명</span>
            <span className={styles.reportInfoValue}>{data.customerName}</span>
            <span className={styles.reportInfoLabel}>연령</span>
            <span className={styles.reportInfoValue}>만 {data.currentAge}세</span>
            <span className={styles.reportInfoLabel}>검진일</span>
            <span className={styles.reportInfoValue}>{today}</span>
            <span className={styles.reportInfoLabel}>목표 은퇴</span>
            <span className={styles.reportInfoValue}>만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 현금흐름 분석 */}
        <div className={styles.reportTwoColumn}>
          {/* 현재 현금흐름 */}
          <section className={`${styles.reportSection} ${styles.half}`}>
            <h2 className={styles.sectionTitle}>
              현재 현금흐름 <span className={styles.sectionTitleEn}>Current</span>
            </h2>
            <div className={styles.cashflowGrid}>
              <div className={styles.cashflowItem}>
                <div className={styles.cashflowLabel}>월 소득</div>
                <div className={styles.cashflowBarContainer}>
                  <div
                    className={`${styles.cashflowBar} ${styles.income}`}
                    style={{
                      width: `${Math.min(100, (data.monthlyIncome / Math.max(data.monthlyIncome, currentMonthlyExpense)) * 100)}%`,
                    }}
                  >
                    <span className={styles.cashflowBarLabel}>{data.monthlyIncome}만원</span>
                  </div>
                </div>
                <div className={styles.cashflowNote}></div>
              </div>
              <div className={styles.cashflowItem}>
                <div className={styles.cashflowLabel}>월 지출</div>
                <div className={styles.cashflowBarContainer}>
                  <div
                    className={`${styles.cashflowBar} ${styles.expense}`}
                    style={{
                      width: `${Math.min(100, (currentMonthlyExpense / Math.max(data.monthlyIncome, currentMonthlyExpense)) * 100)}%`,
                    }}
                  >
                    <span className={styles.cashflowBarLabel}>{currentMonthlyExpense}만원</span>
                  </div>
                </div>
                <div className={styles.cashflowNote}></div>
              </div>
              <div className={`${styles.cashflowItem} ${styles.highlight}`}>
                <div className={styles.cashflowLabel}>저축/투자 여력</div>
                <div className={styles.cashflowBarContainer}>
                  <div
                    className={`${styles.cashflowBar} ${styles.gap} ${currentMonthlyGap >= 0 ? styles.positive : styles.negative}`}
                    style={{
                      width: `${Math.min(100, (Math.abs(currentMonthlyGap) / currentMonthlyExpense) * 100)}%`,
                    }}
                  >
                    <span className={styles.cashflowBarLabel}>
                      {currentMonthlyGap >= 0 ? "+" : ""}
                      {currentMonthlyGap}만원
                    </span>
                  </div>
                </div>
                <div className={`${styles.cashflowGrade} ${savingsGrade.className}`}>
                  {savingsGrade.grade}
                </div>
              </div>
            </div>
          </section>

          {/* 은퇴 후 현금흐름 */}
          <section className={`${styles.reportSection} ${styles.half}`}>
            <h2 className={styles.sectionTitle}>
              은퇴 후 예상 현금흐름 <span className={styles.sectionTitleEn}>After Retirement</span>
            </h2>
            <div className={styles.cashflowGrid}>
              <div className={styles.cashflowItem}>
                <div className={styles.cashflowLabel}>월 소득(연금)</div>
                <div className={styles.cashflowBarContainer}>
                  <div
                    className={`${styles.cashflowBar} ${styles.income}`}
                    style={{
                      width: `${Math.min(100, (monthlyPension / Math.max(monthlyPension, monthlyExpense)) * 100)}%`,
                    }}
                  >
                    <span className={styles.cashflowBarLabel}>{monthlyPension}만원</span>
                  </div>
                </div>
                <div className={styles.cashflowNote}>충당률 {pensionCoverageRate}%</div>
              </div>
              <div className={styles.cashflowItem}>
                <div className={styles.cashflowLabel}>월 지출</div>
                <div className={styles.cashflowBarContainer}>
                  <div
                    className={`${styles.cashflowBar} ${styles.expense}`}
                    style={{
                      width: `${Math.min(100, (monthlyExpense / Math.max(monthlyPension, monthlyExpense)) * 100)}%`,
                    }}
                  >
                    <span className={styles.cashflowBarLabel}>{monthlyExpense}만원</span>
                  </div>
                </div>
                <div className={styles.cashflowNote}>현재의 70%</div>
              </div>
              <div className={`${styles.cashflowItem} ${styles.highlight}`}>
                <div className={styles.cashflowLabel}>{monthlyGap >= 0 ? "월 잉여금액" : "월 부족금액"}</div>
                <div className={styles.cashflowBarContainer}>
                  <div
                    className={`${styles.cashflowBar} ${styles.gap} ${monthlyGap >= 0 ? styles.positive : styles.negative}`}
                    style={{
                      width: `${Math.min(100, (Math.abs(monthlyGap) / monthlyExpense) * 100)}%`,
                    }}
                  >
                    <span className={styles.cashflowBarLabel}>
                      {monthlyGap >= 0 ? "+" : ""}
                      {monthlyGap}만원
                    </span>
                  </div>
                </div>
                <div className={`${styles.cashflowGrade} ${retirementGrade.className}`}>
                  {retirementGrade.grade}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 총수요/총공급 분석 */}
        <section className={styles.reportSection}>
          <h2 className={styles.sectionTitle}>
            은퇴 후 자금 수급 분석 <span className={styles.sectionTitleEn}>Demand vs Supply</span>
            <span className={styles.sectionNote}>* 현재 물가 기준</span>
          </h2>
          <div className={styles.demandSupplyChart}>
            <div className={styles.dsRow}>
              <span className={styles.dsLabel}>총수요</span>
              <div className={styles.dsTrack}>
                <div className={`${styles.dsBar} ${styles.demand}`} style={{ width: "100%" }}>
                  <span className={styles.dsValue}>{totalDemand}억</span>
                </div>
              </div>
            </div>
            <div className={styles.dsRow}>
              <span className={styles.dsLabel}>총공급</span>
              <div className={styles.dsTrack}>
                <div className={`${styles.dsBar} ${styles.supply}`} style={{ width: `${supplyRatio}%` }}>
                  <span className={styles.dsValue}>{totalSupply}억</span>
                </div>
                {supplyDeficit > 0 && (
                  <div className={`${styles.dsBar} ${styles.deficit}`} style={{ width: `${deficitRatio}%` }}>
                    <span className={styles.dsValue}>-{supplyDeficit}억</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className={styles.dsLegend}>
            <div className={styles.dsLegendItem}>
              <span className={`${styles.dsLegendBox} ${styles.demand}`}></span>
              <span>총 지출 수요 ({retirementYears}년)</span>
            </div>
            <div className={styles.dsLegendItem}>
              <span className={`${styles.dsLegendBox} ${styles.supply}`}></span>
              <span>확보 현금흐름</span>
            </div>
            {supplyDeficit > 0 && (
              <div className={styles.dsLegendItem}>
                <span className={`${styles.dsLegendBox} ${styles.deficit}`}></span>
                <span>부족분</span>
              </div>
            )}
          </div>
        </section>

        {/* 자산 구성 + 자산 지속성 */}
        <div className={styles.reportTwoColumn}>
          {/* 자산 구성분석 */}
          <section className={`${styles.reportSection} ${styles.half}`}>
            <h2 className={styles.sectionTitle}>
              자산 구성분석 <span className={styles.sectionTitleEn}>Asset Composition</span>
            </h2>
            <div className={styles.assetStackBar}>
              <div
                className={`${styles.assetSegment} ${styles.realestate}`}
                style={{ width: `${realEstateRatio}%` }}
              />
              <div
                className={`${styles.assetSegment} ${styles.financial}`}
                style={{ width: `${financialRatio}%` }}
              />
              <div
                className={`${styles.assetSegment} ${styles.pension}`}
                style={{ width: `${pensionRatio}%` }}
              />
            </div>
            <div className={styles.assetLegend}>
              <div className={styles.assetLegendItem}>
                <span className={`${styles.legendDot} ${styles.realestate}`}></span>
                <span>
                  부동산 {data.realEstateAsset}억 ({realEstateRatio}%)
                </span>
              </div>
              <div className={styles.assetLegendItem}>
                <span className={`${styles.legendDot} ${styles.financial}`}></span>
                <span>
                  금융자산 {data.financialAsset}억 ({financialRatio}%)
                </span>
              </div>
              <div className={styles.assetLegendItem}>
                <span className={`${styles.legendDot} ${styles.pension}`}></span>
                <span>
                  연금 평가금액 {data.pensionAsset}억 ({pensionRatio}%)
                </span>
              </div>
            </div>
            <div className={styles.assetSummary}>
              <div className={styles.assetSummaryRow}>
                <span>총자산</span>
                <span>{totalAsset}억원</span>
              </div>
              <div className={`${styles.assetSummaryRow} ${styles.debt}`}>
                <span>
                  - 부채{" "}
                  <span className={styles.debtDetail}>
                    (
                    {[
                      data.mortgageAmount > 0 && `주담대 ${(data.mortgageAmount / 10000).toFixed(1)}억`,
                      data.creditLoanAmount > 0 && `신용 ${(data.creditLoanAmount / 10000).toFixed(1)}억`,
                      data.otherDebtAmount > 0 && `기타 ${(data.otherDebtAmount / 10000).toFixed(1)}억`,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    )
                  </span>
                </span>
                <span>{(totalDebt / 10000).toFixed(1)}억원</span>
              </div>
              <div className={`${styles.assetSummaryRow} ${styles.total}`}>
                <span>순자산</span>
                <span>{netWorth}억원</span>
              </div>
            </div>
          </section>

          {/* 자산 지속성 */}
          <section className={`${styles.reportSection} ${styles.half}`}>
            <h2 className={styles.sectionTitle}>
              자산 지속성 <span className={styles.sectionTitleEn}>Sustainability</span>
            </h2>
            <div className={styles.sustainabilityTimeline}>
              <div className={styles.timelineBar}>
                <div
                  className={styles.timelineFilled}
                  style={{ width: `${Math.min(100, (yearsOfWithdrawal / retirementYears) * 100)}%` }}
                />
                <div
                  className={styles.timelineMarker}
                  style={{
                    left: `${Math.max(5, Math.min(95, (Math.min(1, yearsOfWithdrawal / retirementYears)) * 100))}%`,
                  }}
                >
                  <span className={styles.markerLabel}>
                    {yearsOfWithdrawal >= retirementYears ? "충분" : `${assetDepletionAge}세 소진`}
                  </span>
                </div>
              </div>
              <div className={styles.timelineLabels}>
                <span>{data.targetRetirementAge}세</span>
                <span>{data.lifeExpectancy}세</span>
              </div>
            </div>
            <div className={styles.sustainabilityStats}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>지속 가능</span>
                <span className={styles.statValue}>{Math.min(yearsOfWithdrawal, retirementYears).toFixed(0)}년</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>필요 기간</span>
                <span className={styles.statValue}>{retirementYears}년</span>
              </div>
              <div className={`${styles.statRow} ${shortfallYears > 0 ? styles.negative : styles.positiveRow}`}>
                <span className={styles.statLabel}>부족 기간</span>
                <span className={styles.statValue}>{shortfallYears > 0 ? `${Math.round(shortfallYears)}년` : "-"}</span>
              </div>
            </div>
            <div className={styles.sustainabilityNote}>
              * 유동자산 기준 (부동산 제외), 연 2.5% 성장 가정, 은퇴 시점 {liquidAssetAtRetirement}억원
            </div>
          </section>
        </div>

        {/* 리스크 진단 */}
        <section className={styles.reportSection}>
          <h2 className={styles.sectionTitle}>
            리스크 진단 <span className={styles.sectionTitleEn}>Risk Diagnosis</span>
          </h2>
          <div className={styles.riskGrid}>
            <div className={styles.riskItem}>
              <div className={styles.riskLabel}>부동산 편중</div>
              <div className={styles.riskBarContainer}>
                <div className={styles.riskZoneLabels}>
                  <span className={`${styles.zoneLabel} ${styles.high}`}>위험</span>
                  <span className={`${styles.zoneLabel} ${styles.medium}`}>주의</span>
                  <span className={`${styles.zoneLabel} ${styles.low}`}>적정</span>
                </div>
                <div className={styles.riskBarBg}>
                  <div className={`${styles.riskZone} ${styles.high}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.medium}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.low}`} style={{ width: "40%" }} />
                </div>
                <div
                  className={`${styles.riskIndicator} ${styles[getRiskLevel(realEstateRatio, [50, 70])]}`}
                  style={{ left: `${Math.max(0, Math.min(100, 100 - realEstateRatio))}%` }}
                />
              </div>
              <div className={styles.riskValue}>{realEstateRatio}%</div>
            </div>
            <div className={styles.riskItem}>
              <div className={styles.riskLabel}>현금흐름 적자</div>
              <div className={styles.riskBarContainer}>
                <div className={styles.riskZoneLabels}>
                  <span className={`${styles.zoneLabel} ${styles.high}`}>위험</span>
                  <span className={`${styles.zoneLabel} ${styles.medium}`}>주의</span>
                  <span className={`${styles.zoneLabel} ${styles.low}`}>적정</span>
                </div>
                <div className={styles.riskBarBg}>
                  <div className={`${styles.riskZone} ${styles.high}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.medium}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.low}`} style={{ width: "40%" }} />
                </div>
                <div
                  className={`${styles.riskIndicator} ${styles[monthlyGap >= 0 ? "low" : getRiskLevel(Math.abs(monthlyGap), [50, 150])]}`}
                  style={{
                    left: `${monthlyGap >= 0 ? 100 : Math.max(0, Math.min(100, 100 - Math.abs(monthlyGap) / 2))}%`,
                  }}
                />
              </div>
              <div className={styles.riskValue}>
                {monthlyGap >= 0 ? "+" : ""}
                {monthlyGap}만원
              </div>
            </div>
            <div className={styles.riskItem}>
              <div className={styles.riskLabel}>연금 충당률</div>
              <div className={styles.riskBarContainer}>
                <div className={styles.riskZoneLabels}>
                  <span className={`${styles.zoneLabel} ${styles.high}`}>위험</span>
                  <span className={`${styles.zoneLabel} ${styles.medium}`}>주의</span>
                  <span className={`${styles.zoneLabel} ${styles.low}`}>적정</span>
                </div>
                <div className={styles.riskBarBg}>
                  <div className={`${styles.riskZone} ${styles.high}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.medium}`} style={{ width: "30%" }} />
                  <div className={`${styles.riskZone} ${styles.low}`} style={{ width: "40%" }} />
                </div>
                <div
                  className={`${styles.riskIndicator} ${styles[pensionCoverageRate >= 80 ? "low" : pensionCoverageRate >= 50 ? "medium" : "high"]}`}
                  style={{ left: `${Math.min(100, pensionCoverageRate)}%` }}
                />
              </div>
              <div className={styles.riskValue}>{pensionCoverageRate}%</div>
            </div>
          </div>
        </section>

        {/* 개선 가능성 */}
        <section className={styles.reportSection}>
          <h2 className={styles.sectionTitle}>
            개선 가능성 <span className={styles.sectionTitleEn}>Improvement Potential</span>
            <span className={styles.sectionNote}>단위: 유동자산(억)</span>
          </h2>
          {(() => {
            // 개선 시 계산
            const improvedGrowthRate = 0.08;
            const expenseReduction = 0.15;
            const pensionIncrease = 0.2;

            const improvedAtRetirement =
              Math.round(liquidAsset * Math.pow(1 + improvedGrowthRate, yearsToRetirement) * 100) / 100;

            const improvedMonthlyPension = Math.round(monthlyPension * (1 + pensionIncrease));
            const improvedMonthlyExpense = Math.round(monthlyExpense * (1 - expenseReduction));
            const improvedMonthlyGap = improvedMonthlyPension - improvedMonthlyExpense;
            const improvedAnnualShortfall = improvedMonthlyGap < 0 ? (Math.abs(improvedMonthlyGap) * 12) / 10000 : 0;

            // 개선 시 연도별 자산 추이
            const improvedYearlyAssets: number[] = [];
            let improvedAsset = improvedAtRetirement;
            for (let year = 0; year <= retirementYears; year++) {
              improvedYearlyAssets.push(Math.round(Math.max(0, improvedAsset) * 10) / 10);
              improvedAsset = improvedAsset * (1 + improvedGrowthRate) - improvedAnnualShortfall;
            }

            // 현재 유지 시 연도별 자산 추이
            const currentYearlyAssets: number[] = [];
            let currentAsset = liquidAssetAtRetirement;
            for (let year = 0; year <= retirementYears; year++) {
              currentYearlyAssets.push(Math.round(Math.max(0, currentAsset) * 10) / 10);
              currentAsset = currentAsset * (1 + growthRate) - annualShortfall;
            }

            const improvedFinalAsset = improvedYearlyAssets[retirementYears] || 0;

            // X축 라벨 (5년 단위)
            const labels: string[] = [];
            for (let year = 0; year <= retirementYears; year += 5) {
              labels.push(`${data.targetRetirementAge + year}세`);
            }
            if ((retirementYears % 5) !== 0) {
              labels.push(`${data.lifeExpectancy}세`);
            }

            // 5년 단위 데이터 추출
            const improvedData: number[] = [];
            const currentData: number[] = [];
            for (let year = 0; year <= retirementYears; year += 5) {
              improvedData.push(improvedYearlyAssets[year] || 0);
              currentData.push(currentYearlyAssets[year] || 0);
            }
            if ((retirementYears % 5) !== 0) {
              improvedData.push(improvedYearlyAssets[retirementYears] || 0);
              currentData.push(currentYearlyAssets[retirementYears] || 0);
            }

            const chartData = {
              labels,
              datasets: [
                {
                  label: `개선 시 (${data.lifeExpectancy}세 ${improvedFinalAsset.toFixed(1)}억)`,
                  data: improvedData,
                  borderColor: "#3182ce",
                  backgroundColor: "rgba(49, 130, 206, 0.1)",
                  borderDash: [5, 3],
                  tension: 0.3,
                  pointRadius: 2,
                  pointBackgroundColor: "#3182ce",
                },
                {
                  label: `현재 유지 시 (${assetDepletionAge}세 소진)`,
                  data: currentData,
                  borderColor: "#e53e3e",
                  backgroundColor: "rgba(229, 62, 62, 0.1)",
                  tension: 0.3,
                  pointRadius: 2,
                  pointBackgroundColor: "#e53e3e",
                },
              ],
            };

            const chartOptions = {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "top" as const,
                  labels: {
                    font: { size: 10 },
                    boxWidth: 20,
                    padding: 8,
                  },
                },
                tooltip: {
                  callbacks: {
                    label: (context: TooltipItem<"line">) => {
                      const value = context.parsed?.y ?? 0;
                      return `${context.dataset.label}: ${value}억`;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: false,
                  },
                  ticks: {
                    font: { size: 10 },
                    callback: (value: string | number) => `${value}억`,
                  },
                },
                x: {
                  ticks: {
                    font: { size: 10 },
                  },
                },
              },
            };

            return (
              <div className={styles.improvementChart}>
                <Line data={chartData} options={chartOptions} />
              </div>
            );
          })()}
        </section>

        {/* 간단 소견 */}
        <section className={styles.reportSection}>
          <h2 className={styles.sectionTitle}>
            담당자 소견 <span className={styles.sectionTitleEn}>| 손균우 은퇴 설계 전문가</span>
          </h2>
          {/* 미발행 + admin 모드: 직접 입력 */}
          {!published && onOpinionChange ? (
            <div className={styles.opinionInput}>
              <textarea
                className={styles.opinionTextarea}
                placeholder="고객에게 전달할 소견을 작성하세요..."
                value={opinion}
                onChange={(e) => onOpinionChange(e.target.value)}
                rows={4}
              />
              <p className={styles.opinionHint}>
                * 자동 생성 참고: {verdict.findingText} {verdict.recommendationText}
              </p>
            </div>
          ) : (
            /* 발행됨 또는 사용자 뷰: 저장된 소견 또는 자동 생성 */
            <div className={styles.opinionContent}>
              {opinion ? (
                <div
                  className={styles.opinionFinding}
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(opinion) }}
                />
              ) : (
                <>
                  <p className={styles.opinionFinding}>{verdict.findingText}</p>
                  {verdict.recommendationText && <p className={styles.opinionRecommendation}>{verdict.recommendationText}</p>}
                </>
              )}
            </div>
          )}
        </section>

        {/* 푸터 */}
        <footer className={styles.reportFooter}>
          <div className={styles.footerBrand}>Lycon Planning</div>
          <div className={styles.footerTagline}>은퇴는 투자가 아니라 의사결정의 문제입니다</div>
        </footer>
      </div>
    </div>
  );
}
