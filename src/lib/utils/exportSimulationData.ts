/**
 * 시뮬레이션 데이터를 AI가 파싱하기 좋은 JSON 형식으로 변환
 * - 차트 툴팁과 동일한 데이터 소스 및 그룹핑 사용
 */

import type { SimulationResult } from "@/lib/services/simulationTypes";
import {
  groupCashFlowItems,
  groupAssetItems,
  groupDebtItems,
} from "@/lib/utils/tooltipCategories";

interface ExportOptions {
  simulationTitle: string;
  birthYear: number;
  retirementAge: number;
  spouseBirthYear?: number | null;
}

function round(v: number): number {
  return Math.round(v);
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
      // === 자산 (차트 툴팁과 동일: assetBreakdown + pensionBreakdown → groupAssetItems) ===
      const allAssetItems = [
        ...(s.assetBreakdown || []),
        ...(s.pensionBreakdown || []),
      ];
      const assetGroups = groupAssetItems(allAssetItems);
      const totalAssets = assetGroups.reduce((sum, g) => sum + g.total, 0);

      const 자산상세: Record<string, number | Record<string, number>> = {};
      for (const group of assetGroups) {
        if (group.items.length === 1) {
          자산상세[group.category.label] = round(group.items[0].amount);
        } else {
          const items: Record<string, number> = {};
          for (const item of group.items) {
            if (round(item.amount) !== 0) items[item.title] = round(item.amount);
          }
          if (Object.keys(items).length > 0) {
            자산상세[group.category.label] = items;
          }
        }
      }

      // === 부채 (차트 툴팁과 동일: debtBreakdown → groupDebtItems) ===
      const debtGroups = groupDebtItems(s.debtBreakdown || []);
      const totalDebts = debtGroups.reduce((sum, g) => sum + g.total, 0);

      const 부채상세: Record<string, number | Record<string, number>> = {};
      for (const group of debtGroups) {
        if (group.items.length === 1) {
          부채상세[group.category.label] = round(group.items[0].amount);
        } else {
          const items: Record<string, number> = {};
          for (const item of group.items) {
            if (round(item.amount) !== 0) items[item.title] = round(item.amount);
          }
          if (Object.keys(items).length > 0) {
            부채상세[group.category.label] = items;
          }
        }
      }

      // === 현금흐름 (차트 툴팁과 동일: cashFlowBreakdown → groupCashFlowItems) ===
      const cfItems = s.cashFlowBreakdown;
      let 공급상세: Record<string, number | Record<string, number>> = {};
      let 수요상세: Record<string, number | Record<string, number>> = {};
      let 총공급 = round(s.totalIncome);
      let 총수요 = round(s.totalExpense);
      let 순현금흐름 = round(s.netCashFlow);

      if (cfItems && cfItems.length > 0) {
        const regularItems = cfItems.filter(
          (item) => item.flowType !== "deficit_withdrawal" && item.flowType !== "surplus_investment",
        );
        const grouped = groupCashFlowItems(regularItems);
        총공급 = round(grouped.totalInflow);
        총수요 = round(grouped.totalOutflow);
        순현금흐름 = round(grouped.totalInflow - grouped.totalOutflow);

        for (const group of grouped.inflows) {
          const items: Record<string, number> = {};
          for (const item of group.items) {
            if (round(item.amount) !== 0) items[item.title] = round(item.amount);
          }
          if (Object.keys(items).length > 0) {
            공급상세[group.category.label] = Object.keys(items).length === 1
              ? Object.values(items)[0]
              : items;
          }
        }

        for (const group of grouped.outflows) {
          const items: Record<string, number> = {};
          for (const item of group.items) {
            const val = round(Math.abs(item.amount));
            if (val !== 0) items[item.title] = val;
          }
          if (Object.keys(items).length > 0) {
            수요상세[group.category.label] = Object.keys(items).length === 1
              ? Object.values(items)[0]
              : items;
          }
        }
      }

      // === 조합 ===
      const yearData: Record<string, unknown> = {
        년도: s.year,
        나이: s.age,
        순자산: round(s.netWorth),
        자산: round(totalAssets),
        부채: round(totalDebts),
      };

      if (Object.keys(자산상세).length > 0) yearData.자산상세 = 자산상세;
      if (Object.keys(부채상세).length > 0) yearData.부채상세 = 부채상세;

      yearData.현금흐름 = {
        총공급: 총공급,
        총수요: 총수요,
        순현금흐름: 순현금흐름,
      };

      if (Object.keys(공급상세).length > 0) yearData.공급상세 = 공급상세;
      if (Object.keys(수요상세).length > 0) yearData.수요상세 = 수요상세;

      if (s.events && s.events.length > 0) yearData.이벤트 = s.events;

      return yearData;
    }),
  };

  return JSON.stringify(data, null, 2);
}
