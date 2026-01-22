"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import styles from "./ClosingSection.module.css";

export interface ClosingSectionProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
  totalAssets: number;
  totalDebts: number;
  monthlyIncome: number;
  monthlyExpense: number;
  targetRetirementAge: number;
  targetMonthlyIncome: number;
  nationalPensionAmount: number;
  onComplete?: () => void;
}

export function ClosingSection({
  userId,
  simulationId,
  birthYear,
  retirementAge,
  totalAssets,
  totalDebts,
  monthlyIncome,
  monthlyExpense,
  targetRetirementAge,
  targetMonthlyIncome,
  nationalPensionAmount,
  onComplete,
}: ClosingSectionProps) {
  const [reportDelivery, setReportDelivery] = useState(false);
  const [secondMeeting, setSecondMeeting] = useState(false);
  const [additionalDocs, setAdditionalDocs] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Calculations
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;
  const netWorth = totalAssets - totalDebts;
  const monthlySavings = monthlyIncome - monthlyExpense;
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

  const yearsToRetirement = targetRetirementAge - currentAge;
  const expectedSavings = monthlySavings * 12 * yearsToRetirement;
  const expectedRetirementAssets = netWorth + expectedSavings;

  const consultationDate = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const consultationTime = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <div className={styles.container}>
      {/* 4-1. 재무 현황 요약 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>4-1. 재무 현황 요약</h3>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <h3 className={styles.cardTitle}>순자산</h3>
            <div className={styles.cardContent}>
              <div className={styles.summaryRow}>
                <span className={styles.label}>총 자산</span>
                <span className={styles.value}>{formatMoney(totalAssets)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.label}>총 부채</span>
                <span className={styles.value}>-{formatMoney(totalDebts)}</span>
              </div>
              <div className={styles.divider} />
              <div className={styles.summaryRow}>
                <span className={styles.labelBold}>순자산</span>
                <span className={styles.valueBold}>{formatMoney(netWorth)}</span>
              </div>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <h3 className={styles.cardTitle}>월 현금흐름</h3>
            <div className={styles.cardContent}>
              <div className={styles.summaryRow}>
                <span className={styles.label}>월 수입</span>
                <span className={styles.value}>{formatMoney(monthlyIncome)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.label}>월 지출</span>
                <span className={styles.value}>-{formatMoney(monthlyExpense)}</span>
              </div>
              <div className={styles.divider} />
              <div className={styles.summaryRow}>
                <span className={styles.labelBold}>월 저축</span>
                <span className={styles.valueBold}>{formatMoney(monthlySavings)}</span>
              </div>
              <div className={styles.savingsRate}>
                (저축률 {savingsRate.toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-2. 은퇴 준비 현황 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>4-2. 은퇴 준비 현황</h3>
        <div className={styles.retirementPanel}>
          <div className={styles.goalRow}>
            <span>목표 은퇴 나이:</span>
            <span className={styles.highlight}>
              {targetRetirementAge}세 ({yearsToRetirement}년 후)
            </span>
          </div>
          <div className={styles.goalRow}>
            <span>목표 월 생활비:</span>
            <span className={styles.highlight}>{formatMoney(targetMonthlyIncome)}</span>
          </div>

          <div className={styles.subsection}>
            <h4 className={styles.subsectionTitle}>예상 은퇴 자금</h4>
            <div className={styles.calcRow}>
              <span>현재 순자산</span>
              <span>{formatMoney(netWorth)}</span>
            </div>
            <div className={styles.calcRow}>
              <span>은퇴까지 예상 저축</span>
              <span>
                {formatMoney(expectedSavings)}
                <span className={styles.detail}>
                  (월{formatMoney(monthlySavings)} × {yearsToRetirement}년)
                </span>
              </span>
            </div>
            <div className={styles.divider} />
            <div className={styles.calcRow}>
              <span className={styles.labelBold}>예상 은퇴 시점 자산</span>
              <span className={styles.valueBold}>{formatMoney(expectedRetirementAssets)}</span>
            </div>
          </div>

          <div className={styles.subsection}>
            <h4 className={styles.subsectionTitle}>예상 연금 수입</h4>
            <div className={styles.calcRow}>
              <span>국민연금</span>
              <span>
                월 {formatMoney(nationalPensionAmount)}
                <span className={styles.detail}>(65세부터)</span>
              </span>
            </div>
            <div className={styles.calcRow}>
              <span>퇴직연금</span>
              <span className={styles.placeholder}>월 ?만원</span>
            </div>
            <div className={styles.calcRow}>
              <span>개인연금</span>
              <span className={styles.placeholder}>월 ?만원</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4-3. 다음 단계 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>4-3. 다음 단계</h3>
        <div className={styles.nextStepsPanel}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={reportDelivery}
              onChange={(e) => setReportDelivery(e.target.checked)}
            />
            <span>보고서 작성 후 7일 내 전달</span>
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={secondMeeting}
              onChange={(e) => setSecondMeeting(e.target.checked)}
            />
            <span>2차 상담 일정 예약</span>
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={additionalDocs}
              onChange={(e) => setAdditionalDocs(e.target.checked)}
            />
            <span>추가 자료 요청 (연금 조회 결과, 보험 증권 등)</span>
          </label>

          <div className={styles.memoSection}>
            <h4 className={styles.memoTitle}>추가 확인 필요 사항</h4>
            <textarea
              className={styles.memoTextarea}
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="상담 중 추가로 확인해야 할 사항 메모"
              rows={5}
            />
          </div>
        </div>
      </section>

      {/* 상담 완료 */}
      <section className={styles.finalSection}>
        <div className={styles.dateTime}>
          상담 일시: {consultationDate} {consultationTime}
        </div>
        <button className={styles.completeButton} onClick={handleComplete}>
          상담 완료
        </button>
      </section>
    </div>
  );
}
