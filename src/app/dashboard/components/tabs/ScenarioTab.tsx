"use client";

import { useState } from "react";
import {
  PieChart,
  ArrowRightLeft,
  Home,
  CreditCard,
  Car,
  Banknote,
  Receipt,
  LineChart,
  Landmark,
  Shield,
} from "lucide-react";
import type { Simulation, GlobalSettings } from "@/types";
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
import { InsuranceTab } from "./InsuranceTab";
import { RealEstateTab } from "./RealEstateTab";
import { PensionTab } from "./PensionTab";
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
}

// 탭 정의
const SCENARIO_TABS = [
  { id: "networth", label: "순자산", icon: PieChart },
  { id: "cashflow", label: "현금흐름", icon: ArrowRightLeft },
  { id: "realEstate", label: "부동산", icon: Home },
  { id: "debt", label: "부채", icon: CreditCard },
  { id: "asset", label: "실물 자산", icon: Car },
  { id: "income", label: "소득", icon: Banknote },
  { id: "expense", label: "지출", icon: Receipt },
  { id: "savings", label: "저축/투자", icon: LineChart },
  { id: "pension", label: "연금", icon: Landmark },
  { id: "insurance", label: "보험", icon: Shield },
];

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
}: ScenarioTabProps) {
  const [activeTab, setActiveTab] = useState("networth");

  const renderTabContent = () => {
    switch (activeTab) {
      case "networth":
        return (
          <NetWorthTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
            globalSettings={globalSettings ?? undefined}
          />
        );
      case "cashflow":
        return (
          <CashFlowOverviewTab
            simulationId={simulationId}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
            globalSettings={globalSettings ?? undefined}
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
      case "insurance":
        return <InsuranceTab simulationId={simulationId} />;
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
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* 시나리오 제목 */}
      <div className={styles.header}>
        <h2 className={styles.title}>{simulation.title}</h2>
        {simulation.description && (
          <p className={styles.description}>{simulation.description}</p>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className={styles.tabNav}>
        {SCENARIO_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 탭 컨텐츠 */}
      <div className={styles.tabContent}>
        {renderTabContent()}
      </div>
    </div>
  );
}
