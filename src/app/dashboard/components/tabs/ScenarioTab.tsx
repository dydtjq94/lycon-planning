"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Home,
  CreditCard,
  Car,
  Banknote,
  Receipt,
  LineChart,
  Landmark,
  Building2,
  ListOrdered,
  Settings,
} from "lucide-react";
import type { Simulation, GlobalSettings, InvestmentAssumptions, CashFlowPriority } from "@/types";
import type { SimulationResult } from "@/lib/services/simulationEngine";
import type { SimulationProfile } from "@/lib/services/dbToFinancialItems";
import type { ProfileBasics, FamilyMember } from "@/contexts/FinancialContext";
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
  cashFlowPriorities?: CashFlowPriority[];
  onCashFlowPrioritiesChange?: (priorities: CashFlowPriority[]) => void;
}

// Top level tabs
const TOP_TABS = [
  { id: "plan", label: "순자산 규모" },
  { id: "cashflow", label: "가계 현금 흐름" },
] as const;

// Category tabs
const CATEGORY_TABS = [
  { id: "accounts", label: "계좌", icon: Building2 },
  { id: "income", label: "소득", icon: Banknote },
  { id: "expense", label: "지출", icon: Receipt },
  { id: "savings", label: "저축/투자", icon: LineChart },
  { id: "realEstate", label: "부동산", icon: Home },
  { id: "asset", label: "실물자산", icon: Car },
  { id: "debt", label: "부채", icon: CreditCard },
  { id: "pension", label: "연금", icon: Landmark },
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
}: ScenarioTabProps) {
  const [activeTopTab, setActiveTopTab] = useState<"plan" | "cashflow">("plan");
  const [activeCategoryTab, setActiveCategoryTab] = useState<string | null>(null);

  // ESC 키로 패널 닫기
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
  const [localPriorities, setLocalPriorities] = useState<CashFlowPriority[]>(
    propPriorities || simulation.cash_flow_priorities || []
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
  const handlePrioritiesChange = (newPriorities: CashFlowPriority[]) => {
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
        />
      );
    }

    if (activeTopTab === "cashflow") {
      return (
        <CashFlowOverviewTab
          simulationId={simulationId}
          birthYear={simulationProfile.birthYear}
          spouseBirthYear={simulationProfile.spouseBirthYear}
          retirementAge={profile.target_retirement_age}
          globalSettings={globalSettings ?? undefined}
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
          />
        );
      default:
        return null;
    }
  };

  return (
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
              className={`${styles.categoryTab} ${activeCategoryTab === tab.id ? styles.active : ""}`}
              onClick={() => setActiveCategoryTab(activeCategoryTab === tab.id ? null : tab.id)}
              type="button"
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main area: Chart always visible, category panel overlays */}
      <div className={styles.mainArea}>
        <div className={styles.chartArea}>
          {renderMainContent()}
        </div>

        {/* Overlay */}
        <div
          className={`${styles.chartOverlay} ${activeCategoryTab ? styles.chartOverlayVisible : ""}`}
          onClick={() => setActiveCategoryTab(null)}
        />

        {/* Category slide panel */}
        <div className={`${styles.categoryPanel} ${activeCategoryTab ? styles.categoryPanelOpen : ""}`}>
          <div className={styles.categoryPanelContent}>
            {activeCategoryTab && renderCategoryContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
