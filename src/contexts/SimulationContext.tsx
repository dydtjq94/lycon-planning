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
  SimulationAssumptions,
  CashFlowPriorities,
} from "@/types";
import { DEFAULT_SIMULATION_ASSUMPTIONS, normalizePriorities } from "@/types";
import type { SimulationResult, SimulationProfile } from "@/lib/services/simulationTypes";
import { runSimulationV2 } from "@/lib/services/simulationEngineV2";
import { getIncomes } from "@/lib/services/incomeService";
import { getExpenses } from "@/lib/services/expenseService";
import { getSavings } from "@/lib/services/savingsService";
import { getDebts } from "@/lib/services/debtService";
import { getNationalPensions } from "@/lib/services/nationalPensionService";
import { getRetirementPensions } from "@/lib/services/retirementPensionService";
import { getPersonalPensions } from "@/lib/services/personalPensionService";
import { getRealEstates } from "@/lib/services/realEstateService";
import { getPhysicalAssets } from "@/lib/services/physicalAssetService";

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

  // Simulation Assumptions
  simulationAssumptions: SimulationAssumptions;
  setSimulationAssumptions: (assumptions: SimulationAssumptions) => void;

  // Cash Flow Priorities
  cashFlowPriorities: CashFlowPriorities;
  setCashFlowPriorities: (priorities: CashFlowPriorities) => void;

  // Actions
  recalculate: () => Promise<void>;
  invalidateCache: () => void;
}

const SimulationContext = createContext<SimulationContextValue | undefined>(undefined);

// ============================================
// 기본값
// ============================================

const DEFAULT_ASSUMPTIONS: SimulationAssumptions = {
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

  // Simulation Assumptions (시뮬레이션에서 로드 또는 기본값)
  const [simulationAssumptions, setSimulationAssumptionsState] = useState<SimulationAssumptions>(
    currentSimulation?.simulation_assumptions || DEFAULT_ASSUMPTIONS
  );

  // Cash Flow Priorities (시뮬레이션에서 로드 또는 빈 배열)
  const [cashFlowPriorities, setCashFlowPrioritiesState] = useState<CashFlowPriorities>(
    normalizePriorities(currentSimulation?.cash_flow_priorities)
  );

  // Debounce용 ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const calculationRequestRef = useRef<number>(0);

  // 시뮬레이션 변경 시 설정 동기화
  useEffect(() => {
    if (currentSimulation) {
      setSimulationAssumptionsState(
        currentSimulation.simulation_assumptions || DEFAULT_ASSUMPTIONS
      );
      setCashFlowPrioritiesState(normalizePriorities(currentSimulation.cash_flow_priorities));
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
      // DB에서 재무 데이터 직접 로드 (V2: dbToFinancialItems 우회)
      const [
        incomes,
        expenses,
        savings,
        debts,
        nationalPensions,
        retirementPensions,
        personalPensions,
        realEstates,
        physicalAssets,
      ] = await Promise.all([
        getIncomes(currentSimulation.id),
        getExpenses(currentSimulation.id),
        getSavings(currentSimulation.id),
        getDebts(currentSimulation.id),
        getNationalPensions(currentSimulation.id),
        getRetirementPensions(currentSimulation.id),
        getPersonalPensions(currentSimulation.id),
        getRealEstates(currentSimulation.id),
        getPhysicalAssets(currentSimulation.id),
      ]);

      // 요청이 취소되었는지 확인
      if (requestId !== calculationRequestRef.current) {
        console.log("[SimulationContext] Calculation cancelled (newer request)");
        return;
      }

      // V2 시뮬레이션 실행 (DB 타입 직접 사용)
      const simulationResult = runSimulationV2(
        {
          incomes,
          expenses,
          savings,
          debts,
          nationalPensions,
          retirementPensions,
          personalPensions,
          realEstates,
          physicalAssets,
        },
        profile,
        50, // 50년 시뮬레이션
        simulationAssumptions,
        cashFlowPriorities
      );

      // 요청이 취소되었는지 확인
      if (requestId !== calculationRequestRef.current) {
        return;
      }

      setResult(simulationResult);
      setLastCalculatedAt(new Date());
      console.log("[SimulationContext] V2 Calculation complete", {
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
  }, [currentSimulation, profile, simulationAssumptions, cashFlowPriorities]);

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
  const setSimulationAssumptions = useCallback(
    (assumptions: SimulationAssumptions) => {
      setSimulationAssumptionsState(assumptions);
      invalidateCache();
      triggerRecalculation();
    },
    [invalidateCache, triggerRecalculation]
  );

  const setCashFlowPriorities = useCallback(
    (priorities: CashFlowPriorities) => {
      setCashFlowPrioritiesState(priorities);
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
      simulationAssumptions,
      setSimulationAssumptions,
      cashFlowPriorities,
      setCashFlowPriorities,
      recalculate,
      invalidateCache,
    }),
    [
      currentSimulation,
      profile,
      result,
      isCalculating,
      lastCalculatedAt,
      simulationAssumptions,
      setSimulationAssumptions,
      cashFlowPriorities,
      setCashFlowPriorities,
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
