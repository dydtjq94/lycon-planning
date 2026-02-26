/**
 * 시뮬레이션 데이터를 AI가 파싱하기 좋은 JSON 형식으로 변환
 * - 차트 툴팁과 동일한 데이터 소스 및 그룹핑 사용
 */

import type { SimulationResult, MonthlySnapshot } from "@/lib/services/simulationTypes";
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

interface SnapshotWithBreakdowns {
  netWorth: number;
  assetBreakdown?: { title: string; amount: number; type?: string }[];
  debtBreakdown?: { title: string; amount: number; type?: string }[];
  pensionBreakdown?: { title: string; amount: number; type?: string }[];
}

// === 공통 헬퍼: 스냅샷 → 자산/부채 그룹 빌드 (월별/연별 공통) ===
function buildAssetGroups(s: SnapshotWithBreakdowns): {
  자산상세: Record<string, number | Record<string, number>>;
  부채상세: Record<string, number | Record<string, number>>;
  totalAssets: number;
  totalDebts: number;
} {
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

  return { 자산상세, 부채상세, totalAssets, totalDebts };
}

// === 공통 헬퍼: 현재자산 섹션 빌드 ===
function buildCurrentAssets(s: SnapshotWithBreakdowns, currentYear: number, currentMonth: number) {
  const { 자산상세, 부채상세, totalAssets, totalDebts } = buildAssetGroups(s);
  return {
    기준: `${currentYear}.${String(currentMonth).padStart(2, "0")}`,
    순자산: round(s.netWorth),
    자산: round(totalAssets),
    부채: round(totalDebts),
    ...(Object.keys(자산상세).length > 0 ? { 자산상세 } : {}),
    ...(Object.keys(부채상세).length > 0 ? { 부채상세 } : {}),
  };
}

// === 공통 헬퍼: 기본정보 + 요약 섹션 빌드 ===
function buildCommonSections(result: SimulationResult, options: ExportOptions) {
  const { summary } = result;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentMonthSnapshot: MonthlySnapshot | undefined = result.monthlySnapshots?.find(
    (s) => s.year === currentYear && s.month === currentMonth,
  );

  return {
    currentYear,
    currentMonth,
    currentMonthSnapshot,
    기본정보: {
      출생년도: options.birthYear,
      은퇴나이: options.retirementAge,
      ...(options.spouseBirthYear ? { 배우자출생년도: options.spouseBirthYear } : {}),
      시뮬레이션기간: `${result.startYear}-${result.endYear}`,
      은퇴시점: result.retirementYear,
    },
    요약: {
      현재순자산: round(currentMonthSnapshot ? currentMonthSnapshot.netWorth : summary.currentNetWorth),
      은퇴시순자산: round(summary.retirementNetWorth),
      최대순자산: round(summary.peakNetWorth),
      최대순자산년도: summary.peakNetWorthYear,
      파산예상년도: summary.bankruptcyYear,
      경제적자유달성년도: summary.yearsToFI !== null ? result.startYear + summary.yearsToFI : null,
      FI목표금액: round(summary.fiTarget),
    },
  };
}

export function exportSimulationToJson(
  result: SimulationResult,
  options: ExportOptions,
): string {
  const { snapshots } = result;
  const { 기본정보, 요약, currentYear, currentMonth, currentMonthSnapshot } = buildCommonSections(result, options);

  const data = {
    시뮬레이션: options.simulationTitle,
    단위: "만원",
    기본정보,
    요약,
    ...(currentMonthSnapshot ? { 현재자산: buildCurrentAssets(currentMonthSnapshot, currentYear, currentMonth) } : {}),
    년도별데이터: snapshots.map((s) => {
      // === 자산/부채 ===
      const { 자산상세, 부채상세, totalAssets, totalDebts } = buildAssetGroups(s);

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

export function exportMonthlySimulationToJson(
  result: SimulationResult,
  options: ExportOptions,
): string {
  // 월별 스냅샷이 없으면 연도별 export로 폴백
  if (!result.monthlySnapshots || result.monthlySnapshots.length === 0) {
    return exportSimulationToJson(result, options);
  }

  const { 기본정보, 요약, currentYear, currentMonth, currentMonthSnapshot } = buildCommonSections(result, options);

  // 첫 60개월 (5년) 또는 가능한 전체
  const monthlySlice = result.monthlySnapshots.slice(0, 60);

  const 월별데이터 = monthlySlice.map((s) => {
    // === 자산/부채 ===
    const { 자산상세, 부채상세, totalAssets, totalDebts } = buildAssetGroups(s);

    // === 현금흐름: incomeBreakdown / expenseBreakdown 직접 사용 ===
    const 총공급 = round(s.monthlyIncome);
    const 총수요 = round(s.monthlyExpense);
    const 순현금흐름 = round(s.netCashFlow);

    // 공급상세: incomeBreakdown 항목별로 집계 (이름 기준 그룹화, 비零값만)
    const 공급상세: Record<string, number> = {};
    for (const item of s.incomeBreakdown ?? []) {
      const val = round(item.amount);
      if (val !== 0) {
        공급상세[item.title] = (공급상세[item.title] ?? 0) + val;
      }
    }

    // 수요상세: expenseBreakdown 항목별로 집계 (절댓값, 비零값만)
    const 수요상세: Record<string, number> = {};
    for (const item of s.expenseBreakdown ?? []) {
      const val = round(Math.abs(item.amount));
      if (val !== 0) {
        수요상세[item.title] = (수요상세[item.title] ?? 0) + val;
      }
    }

    const yearmonth = `${s.year}.${String(s.month).padStart(2, "0")}`;

    const monthData: Record<string, unknown> = {
      년월: yearmonth,
      나이: s.age,
      순자산: round(s.netWorth),
      자산: round(totalAssets),
      부채: round(totalDebts),
    };

    if (Object.keys(자산상세).length > 0) monthData.자산상세 = 자산상세;
    if (Object.keys(부채상세).length > 0) monthData.부채상세 = 부채상세;

    monthData.현금흐름 = {
      총공급: 총공급,
      총수요: 총수요,
      순현금흐름: 순현금흐름,
    };

    if (Object.keys(공급상세).length > 0) monthData.공급상세 = 공급상세;
    if (Object.keys(수요상세).length > 0) monthData.수요상세 = 수요상세;

    return monthData;
  });

  const data = {
    시뮬레이션: options.simulationTitle,
    단위: "만원",
    기본정보,
    요약,
    ...(currentMonthSnapshot ? { 현재자산: buildCurrentAssets(currentMonthSnapshot, currentYear, currentMonth) } : {}),
    월별데이터,
  };

  return JSON.stringify(data, null, 2);
}
