/**
 * 시뮬레이션 데이터를 AI가 파싱하기 좋은 JSON 형식으로 변환
 */

import type { SimulationResult } from "@/lib/services/simulationTypes";

interface ExportOptions {
  simulationTitle: string;
  birthYear: number;
  retirementAge: number;
  spouseBirthYear?: number | null;
}

function round(v: number): number {
  return Math.round(v);
}

function breakdownToObj(
  items: { title: string; amount: number; type?: string }[],
): Record<string, number> | null {
  if (!items || items.length === 0) return null;
  const obj: Record<string, number> = {};
  for (const item of items) {
    const val = round(item.amount);
    if (val !== 0) obj[item.title] = val;
  }
  return Object.keys(obj).length > 0 ? obj : null;
}

export function exportSimulationToJson(
  result: SimulationResult,
  options: ExportOptions,
): string {
  const { snapshots, summary } = result;

  const data = {
    시뮬레이션: options.simulationTitle,
    단위: "만원",
    기본정보: {
      출생년도: options.birthYear,
      은퇴나이: options.retirementAge,
      ...(options.spouseBirthYear ? { 배우자출생년도: options.spouseBirthYear } : {}),
      시뮬레이션기간: `${result.startYear}-${result.endYear}`,
      은퇴시점: result.retirementYear,
    },
    요약: {
      현재순자산: round(summary.currentNetWorth),
      은퇴시순자산: round(summary.retirementNetWorth),
      최대순자산: round(summary.peakNetWorth),
      최대순자산년도: summary.peakNetWorthYear,
      파산예상년도: summary.bankruptcyYear,
      경제적자유달성년도: summary.yearsToFI !== null ? result.startYear + summary.yearsToFI : null,
      FI목표금액: round(summary.fiTarget),
    },
    년도별데이터: snapshots.map((s) => {
      const yearData: Record<string, unknown> = {
        년도: s.year,
        나이: s.age,
        자산: {
          금융자산: round(s.financialAssets),
          부동산: round(s.realEstateValue),
          연금: round(s.pensionAssets),
          실물자산: round(s.physicalAssetValue ?? 0),
          부채: round(s.totalDebts),
          순자산: round(s.netWorth),
        },
        현금흐름: {
          총수입: round(s.totalIncome),
          총지출: round(s.totalExpense),
          순현금흐름: round(s.netCashFlow),
        },
      };

      // 수입 상세
      const incomeDetail = breakdownToObj(s.incomeBreakdown);
      if (incomeDetail) yearData.수입상세 = incomeDetail;

      // 지출 상세
      const expenseDetail = breakdownToObj(s.expenseBreakdown);
      if (expenseDetail) yearData.지출상세 = expenseDetail;

      // 저축/투자 상세
      if (s.savingsBreakdown && s.savingsBreakdown.length > 0) {
        const obj: Record<string, number> = {};
        for (const item of s.savingsBreakdown) {
          const val = round(item.balance);
          if (val !== 0) obj[item.title] = val;
        }
        if (Object.keys(obj).length > 0) yearData.저축투자상세 = obj;
      }

      // 부동산 상세
      if (s.realEstateBreakdown && s.realEstateBreakdown.length > 0) {
        const obj: Record<string, number> = {};
        for (const item of s.realEstateBreakdown) {
          if (!item.isSold && round(item.value) !== 0) {
            obj[item.title] = round(item.value);
          }
        }
        if (Object.keys(obj).length > 0) yearData.부동산상세 = obj;
      }

      // 연금 상세
      const pensionDetail = breakdownToObj(s.pensionBreakdown);
      if (pensionDetail) yearData.연금상세 = pensionDetail;

      // 부채 상세
      const debtDetail = breakdownToObj(s.debtBreakdown);
      if (debtDetail) yearData.부채상세 = debtDetail;

      // 이벤트
      if (s.events && s.events.length > 0) yearData.이벤트 = s.events;

      return yearData;
    }),
  };

  return JSON.stringify(data, null, 2);
}
