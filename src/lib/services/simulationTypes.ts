/**
 * 시뮬레이션 공통 타입 정의
 * - V2 엔진, 차트, 컨텍스트에서 공유하는 타입
 */

import type { CashFlowItem } from "@/types";

// 프로필 정보 (시뮬레이션용)
export interface SimulationProfile {
  birthYear: number;
  retirementAge: number;
  spouseBirthYear?: number | null;
  spouseRetirementAge?: number;
}

export interface YearlySnapshot {
  year: number;
  age: number;

  // 현금흐름
  totalIncome: number; // 연간 총 수입
  totalExpense: number; // 연간 총 지출
  netCashFlow: number; // 연간 순현금흐름 (저축 가능액)

  // 자산
  totalAssets: number; // 총 자산
  realEstateValue: number; // 부동산 가치
  financialAssets: number; // 금융자산 (현금 + 투자)
  pensionAssets: number; // 연금자산

  // 부채
  totalDebts: number; // 총 부채

  // 순자산
  netWorth: number; // 순자산 (자산 - 부채)

  // 상세 breakdown
  incomeBreakdown: { title: string; amount: number; type?: string }[];
  expenseBreakdown: { title: string; amount: number; type?: string }[];
  assetBreakdown: { title: string; amount: number; type?: string }[];
  debtBreakdown: { title: string; amount: number; type?: string }[];
  pensionBreakdown: { title: string; amount: number; type?: string }[];

  // V2 필드
  cashBalance?: number;
  physicalAssetValue?: number;
  taxPaid?: number;
  savingsBreakdown?: {
    id: string;
    title: string;
    balance: number;
    type: string;
  }[];
  realEstateBreakdown?: {
    id: string;
    title: string;
    value: number;
    isSold: boolean;
  }[];
  physicalAssetBreakdown?: { id: string; title: string; value: number }[];
  events?: string[];
  cashFlowBreakdown?: CashFlowItem[];
}

export interface MonthlySnapshot {
  year: number;
  month: number;
  age: number;

  // 해당 월의 현금흐름
  monthlyIncome: number;
  monthlyExpense: number;
  netCashFlow: number;

  // 해당 월 말 자산/부채 잔액
  financialAssets: number;
  pensionAssets: number;
  realEstateValue: number;
  physicalAssetValue: number;
  totalDebts: number;
  netWorth: number;
  currentCash: number;

  // 상세 breakdown
  incomeBreakdown: { title: string; amount: number; type?: string }[];
  expenseBreakdown: { title: string; amount: number; type?: string }[];

  // 자산/부채/연금 개별 항목 (월말 잔액)
  assetBreakdown?: { title: string; amount: number; type: string }[];
  debtBreakdown?: { title: string; amount: number; type: string }[];
  pensionBreakdown?: { title: string; amount: number; type: string }[];

  // 월별 인출/적립 내역
  withdrawalBreakdown?: {
    title: string;
    amount: number;
    category: string;
  }[];
  surplusBreakdown?: { title: string; amount: number; category: string }[];
}

export interface SimulationResult {
  startYear: number;
  endYear: number;
  retirementYear: number;
  snapshots: YearlySnapshot[];
  monthlySnapshots?: MonthlySnapshot[];

  // 요약 지표
  summary: {
    currentNetWorth: number;
    retirementNetWorth: number;
    peakNetWorth: number;
    peakNetWorthYear: number;
    yearsToFI: number | null; // 경제적 자유 달성 연도 (null = 미달성)
    fiTarget: number; // FI 목표 (연간 지출 x 25)
    bankruptcyYear: number | null; // 파산 연도 (금융자산 < 0, null = 파산 안함)
  };
}
