"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Home,
  CreditCard,
  Car,
  Banknote,
  Receipt,
  LineChart,
  Landmark,
} from "lucide-react";
import type { Simulation, SimulationAssumptions, CashFlowPriorities, SimFamilyMember } from "@/types";
import { normalizePriorities } from "@/types";
import type { SimulationResult } from "@/lib/services/simulationTypes";
import type { SimulationProfile } from "@/lib/services/dbToFinancialItems";
import type { ProfileBasics } from "@/contexts/FinancialContext";
import { useChartTheme } from "@/hooks/useChartTheme";
import { NetWorthTab } from "./NetWorthTab";
import { CashFlowOverviewTab } from "./CashFlowOverviewTab";
import { IncomeTab } from "./IncomeTab";
import { ExpenseTab } from "./ExpenseTab";
import { SavingsTab } from "./SavingsTab";
import { AssetTab } from "./AssetTab";
import { DebtTab } from "./DebtTab";
import { RealEstateTab } from "./RealEstateTab";
import { PensionTab } from "./PensionTab";
import styles from "./ScenarioTab.module.css";

interface ScenarioTabProps {
  simulation: Simulation;
  simulationId: string;
  profile: ProfileBasics;
  simulationProfile: SimulationProfile;
  familyMembers: SimFamilyMember[];
  simulationResult: SimulationResult;
  isMarried: boolean;
  spouseMember?: SimFamilyMember;
  simulationAssumptions?: SimulationAssumptions;
  onSimulationAssumptionsChange?: (assumptions: SimulationAssumptions) => void;
  cashFlowPriorities?: CashFlowPriorities;
  onCashFlowPrioritiesChange?: (priorities: CashFlowPriorities) => void;
  isInitializing?: boolean;
  isSyncingPrices?: boolean;
}

// Top level tabs
const TOP_TABS = [
  { id: "plan", label: "순자산 규모" },
  { id: "cashflow", label: "가계 현금 흐름" },
] as const;

// Category tabs
const CATEGORY_TABS = [
  { id: "income", label: "소득", icon: Banknote },
  { id: "expense", label: "지출", icon: Receipt },
  { id: "savings", label: "저축/투자", icon: LineChart },
  { id: "pension", label: "연금", icon: Landmark },
  { id: "realEstate", label: "부동산", icon: Home },
  { id: "asset", label: "실물 자산", icon: Car },
  { id: "debt", label: "부채", icon: CreditCard },
] as const;

// 기본 Simulation Assumptions
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

export function ScenarioTab({
  simulation,
  simulationId,
  profile,
  simulationProfile,
  familyMembers,
  simulationResult,
  isMarried,
  spouseMember,
  simulationAssumptions: propAssumptions,
  onSimulationAssumptionsChange,
  cashFlowPriorities: propPriorities,
  onCashFlowPrioritiesChange,
  isInitializing,
  isSyncingPrices,
}: ScenarioTabProps) {
  const { isDark, chartScaleColors } = useChartTheme();

  // 시뮬레이션별 은퇴 나이 + 기대수명 (life_cycle_settings에서 가져오고, 없으면 프로필 기본값)
  const lifeCycleSettings = useMemo(() => {
    const saved = simulation.life_cycle_settings as { selfRetirementAge?: number; spouseRetirementAge?: number; selfLifeExpectancy?: number; spouseLifeExpectancy?: number } | null;
    return {
      selfRetirementAge: saved?.selfRetirementAge ?? profile.target_retirement_age,
      spouseRetirementAge: saved?.spouseRetirementAge ?? spouseMember?.retirement_age ?? 65,
      selfLifeExpectancy: saved?.selfLifeExpectancy ?? 100,
      spouseLifeExpectancy: saved?.spouseLifeExpectancy ?? saved?.selfLifeExpectancy ?? 100,
    };
  }, [simulation.life_cycle_settings, profile.target_retirement_age, spouseMember?.retirement_age]);

  const [activeTopTab, setActiveTopTab] = useState<"plan" | "cashflow">("plan");
  const [activeCategoryTab, setActiveCategoryTab] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Shared state for time range and selected year
  type TimeRange = 'next3m' | 'next5m' | 'next5' | 'next10' | 'next20' | 'next30' | 'next40' | 'accumulation' | 'drawdown' | 'full'
  const [sharedTimeRange, setSharedTimeRange] = useState<TimeRange>('full')
  const [sharedSelectedYear, setSharedSelectedYear] = useState<number>(new Date().getFullYear())

  // 카테고리 버튼 클릭 → 드롭다운 위치 계산
  // 왼쪽 버튼: 좌측 정렬, 오른쪽 버튼: 버튼이 드롭다운 중앙에 오도록 보간
  const handleCategoryClick = useCallback((tabId: string) => {
    if (activeCategoryTab === tabId) {
      setActiveCategoryTab(null);
      return;
    }

    const btn = buttonRefs.current.get(tabId);
    if (btn) {
      const btnRect = btn.getBoundingClientRect();
      const dropdownWidth = 520;

      // 버튼 인덱스 비율 (0=첫번째, 1=마지막)
      const tabIndex = CATEGORY_TABS.findIndex(t => t.id === tabId);
      const ratio = CATEGORY_TABS.length > 1 ? tabIndex / (CATEGORY_TABS.length - 1) : 0;

      // 보간: ratio=0 → 좌측 정렬, ratio=1 → 버튼 중앙 정렬
      let left = btnRect.left - ratio * (dropdownWidth / 2 - btnRect.width / 2);

      // 화면 넘침 방지
      if (left + dropdownWidth > window.innerWidth - 16) {
        left = window.innerWidth - dropdownWidth - 16;
      }
      if (left < 16) left = 16;

      setDropdownStyle({
        top: btnRect.bottom + 6,
        left,
      });
    }

    setActiveCategoryTab(tabId);
  }, [activeCategoryTab]);

  // ESC 키로 드롭다운 닫기
  useEffect(() => {
    if (!activeCategoryTab) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveCategoryTab(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCategoryTab]);

  // 드롭다운 외부 클릭으로 닫기 (백드롭 대신)
  const categoryTabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeCategoryTab) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // 드롭다운 내부 클릭 → 무시
      if (dropdownRef.current?.contains(target)) return;
      // 카테고리 탭 버튼 클릭 → handleCategoryClick이 처리하므로 무시
      if (categoryTabsRef.current?.contains(target)) return;
      // 카테고리 탭 내부 포탈 (타입 선택 드롭다운 등) 클릭 → 무시
      if ((target as HTMLElement).closest?.('[data-scenario-dropdown-portal]')) return;
      // 그 외 영역 클릭 → 닫기
      setActiveCategoryTab(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeCategoryTab]);

  // 로컬 state (props가 없으면 시뮬레이션에서 로드하거나 기본값 사용)
  const [localAssumptions, setLocalAssumptions] = useState<SimulationAssumptions>(
    propAssumptions || simulation.simulation_assumptions || DEFAULT_ASSUMPTIONS
  );
  const [localPriorities, setLocalPriorities] = useState<CashFlowPriorities>(
    propPriorities || normalizePriorities(simulation.cash_flow_priorities)
  );

  // 실제 사용할 값들
  const assumptions = propAssumptions || localAssumptions;
  const priorities = propPriorities || localPriorities;

  // assumptions 변경 핸들러
  const handleAssumptionsChange = (newAssumptions: SimulationAssumptions) => {
    if (onSimulationAssumptionsChange) {
      onSimulationAssumptionsChange(newAssumptions);
    } else {
      setLocalAssumptions(newAssumptions);
    }
  };

  // priorities 변경 핸들러
  const handlePrioritiesChange = (newPriorities: CashFlowPriorities) => {
    if (onCashFlowPrioritiesChange) {
      onCashFlowPrioritiesChange(newPriorities);
    } else {
      setLocalPriorities(newPriorities);
    }
  };

  // Main chart area content (both tabs always mounted, hidden via display:none)
  const renderMainContent = () => {
    return (
      <>
        <div style={{ display: activeTopTab === "plan" ? "block" : "none" }}>
          <NetWorthTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={lifeCycleSettings.selfRetirementAge}
            isInitializing={isInitializing}
            timeRange={sharedTimeRange}
            onTimeRangeChange={setSharedTimeRange}
            selectedYear={sharedSelectedYear}
            onSelectedYearChange={setSharedSelectedYear}
            simulationAssumptions={assumptions}
            cashFlowPriorities={priorities}
            selfLifeExpectancy={lifeCycleSettings.selfLifeExpectancy}
            spouseLifeExpectancy={lifeCycleSettings.spouseLifeExpectancy}
            simulationStartYear={simulation.start_year}
            simulationStartMonth={simulation.start_month}
          />
        </div>
        <div style={{ display: activeTopTab === "cashflow" ? "block" : "none" }}>
          <CashFlowOverviewTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            isInitializing={isInitializing}
            retirementAge={lifeCycleSettings.selfRetirementAge}
            timeRange={sharedTimeRange}
            onTimeRangeChange={setSharedTimeRange}
            selectedYear={sharedSelectedYear}
            onSelectedYearChange={setSharedSelectedYear}
            simulationAssumptions={assumptions}
            cashFlowPriorities={priorities}
            selfLifeExpectancy={lifeCycleSettings.selfLifeExpectancy}
            spouseLifeExpectancy={lifeCycleSettings.spouseLifeExpectancy}
            simulationStartYear={simulation.start_year}
            simulationStartMonth={simulation.start_month}
          />
        </div>
      </>
    );
  };

  // Category items content
  const renderCategoryContent = () => {
    if (!activeCategoryTab) return null;

    switch (activeCategoryTab) {
      case "income":
        return (
          <IncomeTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={lifeCycleSettings.selfRetirementAge}
            spouseRetirementAge={lifeCycleSettings.spouseRetirementAge}
            isMarried={isMarried}
            simulationResult={simulationResult}
            selfLifeExpectancy={lifeCycleSettings.selfLifeExpectancy}
            spouseLifeExpectancy={lifeCycleSettings.spouseLifeExpectancy}
          />
        );
      case "expense":
        return (
          <ExpenseTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={lifeCycleSettings.selfRetirementAge}
            spouseRetirementAge={lifeCycleSettings.spouseRetirementAge}
            isMarried={isMarried}
            lifeExpectancy={lifeCycleSettings.selfLifeExpectancy}
            spouseLifeExpectancy={lifeCycleSettings.spouseLifeExpectancy}
            simulationResult={simulationResult}
            familyMembers={familyMembers}
          />
        );
      case "savings":
        return (
          <SavingsTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={lifeCycleSettings.selfRetirementAge}
            spouseRetirementAge={lifeCycleSettings.spouseRetirementAge}
            isMarried={isMarried}
          />
        );
      case "asset":
        return (
          <AssetTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={lifeCycleSettings.selfRetirementAge}
            spouseRetirementAge={lifeCycleSettings.spouseRetirementAge}
            isMarried={isMarried}
          />
        );
      case "debt":
        return (
          <DebtTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={lifeCycleSettings.selfRetirementAge}
            spouseRetirementAge={lifeCycleSettings.spouseRetirementAge}
            isMarried={isMarried}
            selfLifeExpectancy={lifeCycleSettings.selfLifeExpectancy}
            spouseLifeExpectancy={lifeCycleSettings.spouseLifeExpectancy}
          />
        );
      case "realEstate":
        return (
          <RealEstateTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={lifeCycleSettings.selfRetirementAge}
            spouseRetirementAge={lifeCycleSettings.spouseRetirementAge}
            isMarried={isMarried}
          />
        );
      case "pension":
        return (
          <PensionTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={lifeCycleSettings.selfRetirementAge}
            isMarried={isMarried}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
    <div className={styles.container}>
      {/* Top tabs */}
      <div className={styles.topTabs}>
        {TOP_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.topTab} ${activeTopTab === tab.id ? styles.active : ""}`}
            onClick={() => setActiveTopTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category tabs (below top tabs) */}
      <div ref={categoryTabsRef} className={styles.categoryTabs}>
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              ref={(el) => { if (el) buttonRefs.current.set(tab.id, el); }}
              className={`${styles.categoryTab} ${activeCategoryTab === tab.id ? styles.active : ""}`}
              onClick={() => handleCategoryClick(tab.id)}
              type="button"
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main area: Chart always visible */}
      <div className={styles.mainArea}>
        <div className={styles.chartArea}>
          {renderMainContent()}
        </div>
      </div>

    </div>

    {/* Category dropdown popover (portal to body for backdrop-filter) */}
    {activeCategoryTab && createPortal(
      <div
        ref={dropdownRef}
        className={styles.dropdown}
        style={{
          ...dropdownStyle,
          background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${chartScaleColors.gridColor}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        }}
      >
        <div className={styles.dropdownContent}>
          {renderCategoryContent()}
        </div>
      </div>,
      document.body
    )}
  </>
  );
}
