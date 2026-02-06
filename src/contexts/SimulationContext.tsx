"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import type {
  Simulation,
  InvestmentAssumptions,
  CashFlowPriority,
  GlobalSettings,
  DEFAULT_INVESTMENT_ASSUMPTIONS,
} from "@/types";
import { DEFAULT_GLOBAL_SETTINGS } from "@/types";
import type { SimulationResult, SimulationProfile } from "@/lib/services/simulationEngine";
import { runSimulationFromItems } from "@/lib/services/simulationEngine";
import { loadFinancialItemsFromDB } from "@/lib/services/dbToFinancialItems";

// ============================================
// Context 타입
// ============================================

interface SimulationContextValue {
  // 현재 시뮬레이션
  currentSimulation: Simulation | null;
  setCurrentSimulation: (simulation: Simulation | null) => void;

  // 프로필 정보 (계산에 필요)
  profile: SimulationProfile | null;
  setProfile: (profile: SimulationProfile | null) => void;

  // 계산된 결과 (캐시)
  result: SimulationResult | null;
  isCalculating: boolean;
  lastCalculatedAt: Date | null;

  // Investment Assumptions
  investmentAssumptions: InvestmentAssumptions;
  setInvestmentAssumptions: (assumptions: InvestmentAssumptions) => void;

  // Cash Flow Priorities
  cashFlowPriorities: CashFlowPriority[];
  setCashFlowPriorities: (priorities: CashFlowPriority[]) => void;

  // Global Settings (기존 호환)
  globalSettings: GlobalSettings;
  setGlobalSettings: (settings: GlobalSettings) => void;

  // Actions
  recalculate: () => Promise<void>;
  invalidateCache: () => void;
}

const SimulationContext = createContext<SimulationContextValue | undefined>(undefined);

// ============================================
// 기본값
// ============================================

const DEFAULT_ASSUMPTIONS: InvestmentAssumptions = {
  mode: "fixed",
  rates: {
    savings: 3.0,
    investment: 7.0,
    pension: 5.0,
    realEstate: 3.0,
    inflation: 2.5,
  },
};

// ============================================
// Provider
// ============================================

interface SimulationProviderProps {
  children: ReactNode;
  initialSimulation?: Simulation | null;
  initialProfile?: SimulationProfile | null;
}

export function SimulationProvider({
  children,
  initialSimulation = null,
  initialProfile = null,
}: SimulationProviderProps) {
  // State
  const [currentSimulation, setCurrentSimulation] = useState<Simulation | null>(initialSimulation);
  const [profile, setProfile] = useState<SimulationProfile | null>(initialProfile);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<Date | null>(null);

  // Investment Assumptions (시뮬레이션에서 로드 또는 기본값)
  const [investmentAssumptions, setInvestmentAssumptionsState] = useState<InvestmentAssumptions>(
    currentSimulation?.investment_assumptions || DEFAULT_ASSUMPTIONS
  );

  // Cash Flow Priorities (시뮬레이션에서 로드 또는 빈 배열)
  const [cashFlowPriorities, setCashFlowPrioritiesState] = useState<CashFlowPriority[]>(
    currentSimulation?.cash_flow_priorities || []
  );

  // Global Settings
  const [globalSettings, setGlobalSettingsState] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);

  // Debounce용 ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const calculationRequestRef = useRef<number>(0);

  // 시뮬레이션 변경 시 설정 동기화
  useEffect(() => {
    if (currentSimulation) {
      setInvestmentAssumptionsState(
        currentSimulation.investment_assumptions || DEFAULT_ASSUMPTIONS
      );
      setCashFlowPrioritiesState(currentSimulation.cash_flow_priorities || []);
    }
  }, [currentSimulation?.id]);

  // 캐시 무효화
  const invalidateCache = useCallback(() => {
    setResult(null);
    setLastCalculatedAt(null);
  }, []);

  // 재계산 함수
  const recalculate = useCallback(async () => {
    if (!currentSimulation || !profile) {
      console.log("[SimulationContext] Cannot calculate: missing simulation or profile");
      return;
    }

    const requestId = ++calculationRequestRef.current;
    setIsCalculating(true);

    try {
      // DB에서 재무 데이터 로드
      const items = await loadFinancialItemsFromDB(currentSimulation.id, profile);

      // 요청이 취소되었는지 확인
      if (requestId !== calculationRequestRef.current) {
        console.log("[SimulationContext] Calculation cancelled (newer request)");
        return;
      }

      // 시뮬레이션 실행 (Investment Assumptions 전달)
      const simulationResult = runSimulationFromItems(
        items,
        profile,
        globalSettings,
        50, // 50년 시뮬레이션
        investmentAssumptions // Investment Assumptions 전달
      );

      // 요청이 취소되었는지 확인
      if (requestId !== calculationRequestRef.current) {
        return;
      }

      setResult(simulationResult);
      setLastCalculatedAt(new Date());
      console.log("[SimulationContext] Calculation complete", {
        years: simulationResult.snapshots.length,
        startYear: simulationResult.startYear,
        endYear: simulationResult.endYear,
      });
    } catch (error) {
      console.error("[SimulationContext] Calculation error:", error);
      if (requestId === calculationRequestRef.current) {
        setResult(null);
      }
    } finally {
      if (requestId === calculationRequestRef.current) {
        setIsCalculating(false);
      }
    }
  }, [currentSimulation, profile, globalSettings, investmentAssumptions]);

  // Debounced 재계산 트리거
  const triggerRecalculation = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      recalculate();
    }, 500); // 500ms debounce
  }, [recalculate]);

  // 설정 변경 시 재계산 트리거
  const setInvestmentAssumptions = useCallback(
    (assumptions: InvestmentAssumptions) => {
      setInvestmentAssumptionsState(assumptions);
      invalidateCache();
      triggerRecalculation();
    },
    [invalidateCache, triggerRecalculation]
  );

  const setCashFlowPriorities = useCallback(
    (priorities: CashFlowPriority[]) => {
      setCashFlowPrioritiesState(priorities);
      invalidateCache();
      triggerRecalculation();
    },
    [invalidateCache, triggerRecalculation]
  );

  const setGlobalSettings = useCallback(
    (settings: GlobalSettings) => {
      setGlobalSettingsState(settings);
      invalidateCache();
      triggerRecalculation();
    },
    [invalidateCache, triggerRecalculation]
  );

  // 시뮬레이션/프로필 변경 시 재계산
  useEffect(() => {
    if (currentSimulation && profile) {
      triggerRecalculation();
    }
  }, [currentSimulation?.id, profile?.birthYear, profile?.retirementAge]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Context value
  const value = useMemo<SimulationContextValue>(
    () => ({
      currentSimulation,
      setCurrentSimulation,
      profile,
      setProfile,
      result,
      isCalculating,
      lastCalculatedAt,
      investmentAssumptions,
      setInvestmentAssumptions,
      cashFlowPriorities,
      setCashFlowPriorities,
      globalSettings,
      setGlobalSettings,
      recalculate,
      invalidateCache,
    }),
    [
      currentSimulation,
      profile,
      result,
      isCalculating,
      lastCalculatedAt,
      investmentAssumptions,
      setInvestmentAssumptions,
      cashFlowPriorities,
      setCashFlowPriorities,
      globalSettings,
      setGlobalSettings,
      recalculate,
      invalidateCache,
    ]
  );

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (context === undefined) {
    throw new Error("useSimulation must be used within a SimulationProvider");
  }
  return context;
}

// 선택적 훅 (Provider 없을 때 null 반환)
export function useSimulationOptional() {
  return useContext(SimulationContext);
}
