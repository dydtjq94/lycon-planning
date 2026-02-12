"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Home,
  CreditCard,
  Car,
  Banknote,
  Receipt,
  LineChart,
  Landmark,
  Wallet,
  ListOrdered,
  Settings,
} from "lucide-react";
import type { Simulation, GlobalSettings, InvestmentAssumptions, CashFlowPriorities } from "@/types";
import { normalizePriorities } from "@/types";
import type { SimulationResult } from "@/lib/services/simulationEngine";
import type { SimulationProfile } from "@/lib/services/dbToFinancialItems";
import type { ProfileBasics, FamilyMember } from "@/contexts/FinancialContext";
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
import { InvestmentAssumptionsPanel, CashFlowPrioritiesPanel, AccountsSummaryPanel } from "./scenario";
import styles from "./ScenarioTab.module.css";

interface ScenarioTabProps {
  simulation: Simulation;
  simulationId: string;
  profile: ProfileBasics;
  simulationProfile: SimulationProfile;
  familyMembers: FamilyMember[];
  globalSettings: GlobalSettings | null;
  simulationResult: SimulationResult;
  isMarried: boolean;
  spouseMember?: FamilyMember;
  investmentAssumptions?: InvestmentAssumptions;
  onInvestmentAssumptionsChange?: (assumptions: InvestmentAssumptions) => void;
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
  { id: "accounts", label: "계좌", icon: Wallet },
  { id: "income", label: "소득", icon: Banknote },
  { id: "expense", label: "지출", icon: Receipt },
  { id: "savings", label: "저축/투자", icon: LineChart },
  { id: "pension", label: "연금", icon: Landmark },
  { id: "realEstate", label: "부동산", icon: Home },
  { id: "asset", label: "실물자산", icon: Car },
  { id: "debt", label: "부채", icon: CreditCard },
  { id: "investmentAssumptions", label: "투자 가정", icon: Settings },
  { id: "cashflowPriorities", label: "현금 흐름 우선순위", icon: ListOrdered },
] as const;

// 기본 Investment Assumptions
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

export function ScenarioTab({
  simulation,
  simulationId,
  profile,
  simulationProfile,
  familyMembers,
  globalSettings,
  simulationResult,
  isMarried,
  spouseMember,
  investmentAssumptions: propAssumptions,
  onInvestmentAssumptionsChange,
  cashFlowPriorities: propPriorities,
  onCashFlowPrioritiesChange,
  isInitializing,
  isSyncingPrices,
}: ScenarioTabProps) {
  const { isDark, chartScaleColors } = useChartTheme();
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

  // 로컬 state (props가 없으면 시뮬레이션에서 로드하거나 기본값 사용)
  const [localAssumptions, setLocalAssumptions] = useState<InvestmentAssumptions>(
    propAssumptions || simulation.investment_assumptions || DEFAULT_ASSUMPTIONS
  );
  const [localPriorities, setLocalPriorities] = useState<CashFlowPriorities>(
    propPriorities || normalizePriorities(simulation.cash_flow_priorities)
  );

  // 실제 사용할 값들
  const assumptions = propAssumptions || localAssumptions;
  const priorities = propPriorities || localPriorities;

  // assumptions 변경 핸들러
  const handleAssumptionsChange = (newAssumptions: InvestmentAssumptions) => {
    if (onInvestmentAssumptionsChange) {
      onInvestmentAssumptionsChange(newAssumptions);
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

  // Main chart area content
  const renderMainContent = () => {
    if (activeTopTab === "plan") {
      return (
        <NetWorthTab
          simulationId={simulationId}
          birthYear={simulationProfile.birthYear}
          spouseBirthYear={simulationProfile.spouseBirthYear}
          retirementAge={profile.target_retirement_age}
          globalSettings={globalSettings ?? undefined}
          isInitializing={isInitializing}
          timeRange={sharedTimeRange}
          onTimeRangeChange={setSharedTimeRange}
          selectedYear={sharedSelectedYear}
          onSelectedYearChange={setSharedSelectedYear}
          investmentAssumptions={assumptions}
          cashFlowPriorities={priorities}
        />
      );
    }

    if (activeTopTab === "cashflow") {
      return (
        <CashFlowOverviewTab
          simulationId={simulationId}
          birthYear={simulationProfile.birthYear}
          spouseBirthYear={simulationProfile.spouseBirthYear}
          isInitializing={isInitializing}
          retirementAge={profile.target_retirement_age}
          globalSettings={globalSettings ?? undefined}
          timeRange={sharedTimeRange}
          onTimeRangeChange={setSharedTimeRange}
          selectedYear={sharedSelectedYear}
          onSelectedYearChange={setSharedSelectedYear}
          investmentAssumptions={assumptions}
          cashFlowPriorities={priorities}
        />
      );
    }

    return null;
  };

  // Category items content
  const renderCategoryContent = () => {
    if (!activeCategoryTab) return null;

    switch (activeCategoryTab) {
      case "accounts":
        return (
          <AccountsSummaryPanel
            simulationId={simulationId}
            profileId={profile.id}
            isMarried={isMarried}
            isInitializing={isInitializing}
            isSyncingPrices={isSyncingPrices}
          />
        );
      case "investmentAssumptions":
        return (
          <InvestmentAssumptionsPanel
            assumptions={assumptions}
            onChange={handleAssumptionsChange}
          />
        );
      case "income":
        return globalSettings ? (
          <IncomeTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
            spouseRetirementAge={spouseMember?.retirement_age || 60}
            isMarried={isMarried}
            globalSettings={globalSettings}
            simulationResult={simulationResult}
          />
        ) : null;
      case "expense":
        return globalSettings ? (
          <ExpenseTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
            spouseRetirementAge={spouseMember?.retirement_age || 60}
            isMarried={isMarried}
            globalSettings={globalSettings}
            simulationResult={simulationResult}
          />
        ) : null;
      case "savings":
        return (
          <SavingsTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
          />
        );
      case "asset":
        return <AssetTab simulationId={simulationId} />;
      case "debt":
        return <DebtTab simulationId={simulationId} />;
      case "realEstate":
        return <RealEstateTab simulationId={simulationId} />;
      case "pension":
        return (
          <PensionTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
            isMarried={isMarried}
            globalSettings={globalSettings ?? undefined}
          />
        );
      case "cashflowPriorities":
        return (
          <CashFlowPrioritiesPanel
            priorities={priorities}
            onChange={handlePrioritiesChange}
            simulationId={simulationId}
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
      <div className={styles.categoryTabs}>
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
      <>
        <div className={styles.dropdownBackdrop} onClick={() => setActiveCategoryTab(null)} />
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
        </div>
      </>,
      document.body
    )}
  </>
  );
}
