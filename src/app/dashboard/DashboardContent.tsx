"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, RefreshCw, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { AccountManagementModal } from "./components/AccountManagementModal";
import { useFinancialContext } from "@/contexts/FinancialContext";
import {
  useFinancialItems,
  useSimulations,
  useTodaySnapshot,
  useSnapshots,
} from "@/hooks/useFinancialData";
import type {
  FinancialItem,
  IncomeData,
  PensionData,
} from "@/types";
import type { SimulationResult } from "@/lib/services/simulationEngine";
import { runSimulationFromItems } from "@/lib/services/simulationEngine";
import { getTotalUnreadCount } from "@/lib/services/messageService";
import { calculateEndYear } from "@/lib/utils/chartDataTransformer";
import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_SETTINGS } from "@/types";
import { Sidebar } from "./components";
import {
  OverviewTab,
  MessagesTab,
  NetWorthTab,
  CashFlowOverviewTab,
  CurrentAssetTab,
  AssetRecordTab,
  PortfolioTab,
  BudgetTab,
  CheckingAccountTab,
  SavingsDepositsTab,
  IncomeTab,
  ExpenseTab,
  SavingsTab,
  AssetTab,
  DebtTab,
  InsuranceTab,
  RealEstateTab,
  PensionTab,
  DashboardTab,
  ScenarioTab,
  SettingsTab,
} from "./components/tabs";
import styles from "./dashboard.module.css";


const sectionTitles: Record<string, string> = {
  // 대시보드
  dashboard: "대시보드",
  // 담당자 관련
  messages: "채팅",
  consultation: "상담",
  // 재무 현황
  "current-asset": "현재 자산",
  progress: "자산 추이",
  portfolio: "포트폴리오",
  "household-budget": "가계부",
  "checking-account": "입출금통장",
  "savings-deposits": "정기 예금/적금",
  // 시뮬레이션
  scenario: "시뮬레이션",
  // 설정
  settings: "설정",
};

const validSections = Object.keys(sectionTitles);

export function DashboardContent() {
  // Context에서 데이터 가져오기
  const {
    simulation,
    profile,
    familyMembers,
    simulationProfile,
    globalSettings,
  } = useFinancialContext();

  const [currentSection, setCurrentSection] = useState<string>("dashboard");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false); // 기본값: 닫혀있음
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>(simulation.id);

  // 포트폴리오 검색 상태 (헤더에서 입력, PortfolioTab에서 처리)
  const [portfolioSearchQuery, setPortfolioSearchQuery] = useState("");
  const [portfolioSearchLoading, setPortfolioSearchLoading] = useState(false);
  const portfolioSearchTriggerRef = useRef<(() => void) | null>(null);

  // 가계부 년/월 상태
  const today = new Date();
  const [budgetYear, setBudgetYear] = useState(today.getFullYear());
  const [budgetMonth, setBudgetMonth] = useState(today.getMonth() + 1);

  // 계좌 관리 모달
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState<"checking" | "savings" | "securities">("checking");

  // 종목 자동완성
  interface StockItem {
    code: string;
    name: string;
    ticker: string;
    market: string;
    country: string;
  }
  const [stocksList, setStocksList] = useState<StockItem[]>([]);
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // 종목 데이터 로드
  useEffect(() => {
    fetch("/data/stocks.json")
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setStocksList(json.data);
        }
      })
      .catch(console.error);
  }, []);

  // 자동완성 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 검색어로 종목 필터링
  const filterSuggestions = useCallback((query: string) => {
    if (!query.trim() || stocksList.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = query.toLowerCase();
    const filtered = stocksList
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.ticker.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q)
      )
      .slice(0, 10);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [stocksList]);

  // 자동완성 선택
  const selectSuggestion = useCallback((stock: StockItem) => {
    setPortfolioSearchQuery(stock.ticker);
    setShowSuggestions(false);
    // 선택 후 자동 검색
    setTimeout(() => {
      portfolioSearchTriggerRef.current?.();
    }, 100);
  }, []);

  // 시뮬레이션(시나리오) 목록 조회
  const { data: simulations = [] } = useSimulations();

  // 스냅샷 데이터 Prefetch (CurrentAssetTab, AssetRecordTab에서 사용)
  // 탭 전환 시 즉시 로드되도록 미리 캐싱
  useTodaySnapshot(profile.id);
  useSnapshots(profile.id);

  // 초기 unread 메시지 체크 (Supabase에서)
  useEffect(() => {
    getTotalUnreadCount().then(setUnreadMessageCount).catch(console.error);
  }, []);

  // React Query로 재무 데이터 로드 (캐싱 적용)
  const {
    data: items = [],
    isLoading,
    isFetching,
  } = useFinancialItems(simulation.id, simulationProfile);

  // Prefetch 제거 - useFinancialItems가 이미 모든 데이터를 로드함

  // 배우자 정보 (IncomeTab, ExpenseTab에서 사용)
  const spouseMember = useMemo(() => {
    return familyMembers.find((fm) => fm.relationship === "spouse");
  }, [familyMembers]);
  const isMarried = !!spouseMember;

  // 중복 제거된 items (title + type + owner + category로 중복 판단)
  const deduplicatedItems = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.category}-${item.title}-${item.type}-${
        item.owner || "self"
      }`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);

  // 공유 시뮬레이션 결과 (Single Source of Truth)
  const simulationResult: SimulationResult = useMemo(() => {
    const simulationEndYear = calculateEndYear(
      simulationProfile.birthYear,
      simulationProfile.spouseBirthYear
    );
    const yearsToSimulate = simulationEndYear - new Date().getFullYear();
    // null을 undefined로 변환 (simulationEngine 타입 호환)
    const engineProfile = {
      ...simulationProfile,
      spouseBirthYear: simulationProfile.spouseBirthYear ?? undefined,
    };
    return runSimulationFromItems(
      deduplicatedItems,
      engineProfile,
      globalSettings || DEFAULT_GLOBAL_SETTINGS,
      yearsToSimulate
    );
  }, [deduplicatedItems, simulationProfile, globalSettings]);

  // 기본 설정
  const settings = DEFAULT_SETTINGS;

  // 레거시 CRUD 스텁 함수 (실제 업데이트는 개별 서비스 사용)
  const addItem = useCallback(
    async (input: Partial<FinancialItem>): Promise<FinancialItem> => {
      console.warn("[Legacy] addItem called - use individual services instead");
      // React Query 캐시 무효화로 데이터 새로고침
      return input as FinancialItem;
    },
    []
  );

  // URL 해시에서 섹션 읽기
  const getHashSection = useCallback(() => {
    if (typeof window === "undefined") return "dashboard";
    const hash = window.location.hash.slice(1);
    return validSections.includes(hash) ? hash : "dashboard";
  }, []);

  // 초기 로드 시 해시에서 섹션 설정
  useEffect(() => {
    setCurrentSection(getHashSection());
  }, [getHashSection]);

  // 브라우저 뒤로가기/앞으로가기 처리
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentSection(getHashSection());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [getHashSection]);

  // 연금 자산 → 연금 소득 동기화 (온보딩 후 첫 로드 시)
  const pensionSyncRef = useRef<boolean>(false);
  useEffect(() => {
    // 이미 동기화했거나 로딩 중이면 스킵
    if (pensionSyncRef.current || isLoading || items.length === 0) return;

    const syncPensionToIncome = async () => {
      const pensionItems = items.filter((i) => i.category === "pension");
      if (pensionItems.length === 0) return;

      const birthYear = profile.birth_date
        ? parseInt(profile.birth_date.split("-")[0])
        : new Date().getFullYear() - 35;
      const spouseMemberLocal = familyMembers.find(
        (fm) => fm.relationship === "spouse"
      );
      const spouseBirthYear = spouseMemberLocal?.birth_date
        ? parseInt(spouseMemberLocal.birth_date.split("-")[0])
        : birthYear;
      const lifeExpectancy = globalSettings?.lifeExpectancy ?? 100;
      const investmentReturnRate =
        (globalSettings?.investmentReturnRate ?? 5) / 100;

      // PMT 계산 함수
      const calculatePMT = (
        presentValue: number,
        years: number,
        annualRate: number
      ): number => {
        if (years <= 0 || presentValue <= 0) return 0;
        if (annualRate === 0) return presentValue / years;
        const r = annualRate;
        const n = years;
        const factor = Math.pow(1 + r, n);
        return (presentValue * (r * factor)) / (factor - 1);
      };

      // 근로소득 정보 가져오기 (퇴직연금 계산용)
      const selfLaborIncome = items.find(
        (i) =>
          i.category === "income" && i.type === "labor" && i.owner === "self"
      );
      const spouseLaborIncome = items.find(
        (i) =>
          i.category === "income" && i.type === "labor" && i.owner === "spouse"
      );
      const incomeGrowthRate = (globalSettings?.incomeGrowthRate ?? 3) / 100;
      const currentYear = new Date().getFullYear();

      for (const pensionItem of pensionItems) {
        const pensionData = pensionItem.data as PensionData;
        const ownerBirthYear =
          pensionItem.owner === "spouse" ? spouseBirthYear : birthYear;

        // 이미 해당 연금 소득 항목이 있는지 확인
        const existingIncomeItem = items.find(
          (i) =>
            i.category === "income" &&
            i.type === "pension" &&
            i.owner === pensionItem.owner &&
            i.title === pensionItem.title
        );

        if (existingIncomeItem) continue; // 이미 있으면 스킵

        // 일시금 수령 방식이면 소득 항목 생성 안함
        if (pensionData.receiveType === "lump_sum") continue;

        let monthlyAmount = 0;
        const pensionStartAge = pensionData.paymentStartAge || 65;
        const pensionStartYear = ownerBirthYear + pensionStartAge;
        let pensionEndYear = ownerBirthYear + lifeExpectancy;
        const receivingYears =
          pensionData.paymentYears || pensionData.receivingYears || 20;

        // 국민연금: expectedMonthlyAmount 사용
        if (
          pensionItem.type === "national" &&
          pensionData.expectedMonthlyAmount
        ) {
          monthlyAmount = pensionData.expectedMonthlyAmount;
        }
        // 퇴직연금 (DB형): 근무년수 + 근로소득으로 계산
        else if (
          pensionItem.type === "retirement" &&
          (pensionData.pensionType === "DB" ||
            pensionData.pensionType === "severance")
        ) {
          const laborIncomeItem =
            pensionItem.owner === "spouse"
              ? spouseLaborIncome
              : selfLaborIncome;
          if (laborIncomeItem) {
            const laborData = laborIncomeItem.data as IncomeData;
            const monthlyIncome =
              laborData.frequency === "yearly"
                ? laborData.amount / 12
                : laborData.amount;
            const currentAge = currentYear - ownerBirthYear;
            const retirementAge = profile.target_retirement_age || 60;
            const yearsOfService = pensionData.yearsOfService || 0;
            const yearsUntilRetirement = Math.max(
              0,
              retirementAge - currentAge
            );
            const totalYearsAtRetirement =
              yearsOfService + yearsUntilRetirement;
            const finalMonthlySalary =
              monthlyIncome *
              Math.pow(1 + incomeGrowthRate, yearsUntilRetirement);
            const totalAmount = finalMonthlySalary * totalYearsAtRetirement;

            if (totalAmount > 0) {
              const yearsUntilReceive = Math.max(
                0,
                pensionStartAge - retirementAge
              );
              const valueAtReceiveStart =
                totalAmount *
                Math.pow(1 + investmentReturnRate, yearsUntilReceive);
              const annualPMT = calculatePMT(
                valueAtReceiveStart,
                receivingYears,
                investmentReturnRate
              );
              monthlyAmount = Math.round(annualPMT / 12);
              pensionEndYear = pensionStartYear + receivingYears - 1;
            }
          }
        }
        // 기타 연금 (DC형, IRP, 연금저축 등): currentBalance에서 PMT 계산
        else if (pensionData.currentBalance && pensionData.currentBalance > 0) {
          pensionEndYear = pensionStartYear + receivingYears - 1;
          const yearsUntilStart = Math.max(0, pensionStartYear - currentYear);
          const futureValue =
            pensionData.currentBalance *
            Math.pow(1 + investmentReturnRate, yearsUntilStart);
          const annualPMT = calculatePMT(
            futureValue,
            receivingYears,
            investmentReturnRate
          );
          monthlyAmount = Math.round(annualPMT / 12);
        }

        if (monthlyAmount <= 0) continue;

        // 연금 소득 항목 생성
        try {
          await addItem({
            category: "income",
            type: "pension",
            title: pensionItem.title,
            owner: pensionItem.owner,
            start_year: pensionStartYear,
            start_month: 1,
            end_year: pensionEndYear,
            end_month: 12,
            data: {
              amount: monthlyAmount,
              frequency: "monthly",
              growthRate: globalSettings?.inflationRate ?? 2,
              rateCategory: "inflation",
            } as IncomeData,
          });
        } catch (error) {
          console.error(
            "[DashboardContent] Failed to sync pension to income:",
            error
          );
        }
      }

      pensionSyncRef.current = true;
    };

    syncPensionToIncome();
  }, [items, isLoading, profile, familyMembers, globalSettings, addItem]);

  // 섹션 변경 시 URL 해시 업데이트
  const handleSectionChange = useCallback((section: string) => {
    setCurrentSection(section);
    window.history.pushState(null, "", `#${section}`);
  }, []);

  const renderContent = () => {
    switch (currentSection) {
      // 대시보드
      case "dashboard":
        return (
          <DashboardTab
            simulationId={simulation.id}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear ?? null}
            retirementAge={profile.target_retirement_age}
            globalSettings={globalSettings}
            unreadMessageCount={unreadMessageCount}
            onNavigate={handleSectionChange}
          />
        );
      // 담당자 관련
      case "messages":
        return (
          <MessagesTab
            onUnreadCountChange={setUnreadMessageCount}
            isVisible={currentSection === "messages"}
          />
        );
      case "consultation":
        return <div style={{ padding: 40, color: "#888" }}>상담 기록 (준비중)</div>;
      // 자산 추이
      case "current-asset":
        return <CurrentAssetTab profileId={profile.id} onNavigate={handleSectionChange} />;
      case "progress":
        return <AssetRecordTab profileId={profile.id} />;
      case "portfolio":
        return (
          <PortfolioTab
            profileId={profile.id}
            searchQuery={portfolioSearchQuery}
            setSearchQuery={setPortfolioSearchQuery}
            setSearchLoading={setPortfolioSearchLoading}
            onSearchTrigger={(fn) => { portfolioSearchTriggerRef.current = fn; }}
          />
        );
      case "household-budget":
        return <BudgetTab profileId={profile.id} year={budgetYear} month={budgetMonth} />;
      case "checking-account":
        return <CheckingAccountTab profileId={profile.id} />;
      case "savings-deposits":
        return <SavingsDepositsTab profileId={profile.id} />;
      // 설정
      case "settings":
        return <SettingsTab profileName={profile.name || ""} />;
      // 시나리오
      case "scenario": {
        const selectedSim = simulations.find(s => s.id === selectedSimulationId) || simulations[0];
        return (
          <ScenarioTab
            simulation={selectedSim || simulation}
            simulationId={selectedSimulationId}
            profile={profile}
            simulationProfile={simulationProfile}
            familyMembers={familyMembers}
            globalSettings={globalSettings}
            simulationResult={simulationResult}
            isMarried={isMarried}
            spouseMember={spouseMember}
          />
        );
      }
      // Legacy - 이전 직접 접근용 (나중에 제거)
      case "networth":
        return (
          <NetWorthTab
            simulationId={simulation.id}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
            globalSettings={globalSettings}
          />
        );
      case "cashflow-overview":
        return (
          <CashFlowOverviewTab
            simulationId={simulation.id}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
            globalSettings={globalSettings}
          />
        );
      // Finance tabs (나의 재무)
      case "income":
        return (
          <IncomeTab
            simulationId={simulation.id}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
            spouseRetirementAge={spouseMember?.retirement_age || 60}
            isMarried={isMarried}
            globalSettings={globalSettings}
            simulationResult={simulationResult}
          />
        );
      case "expense":
        return (
          <ExpenseTab
            simulationId={simulation.id}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
            spouseRetirementAge={spouseMember?.retirement_age || 60}
            isMarried={isMarried}
            globalSettings={globalSettings}
            simulationResult={simulationResult}
          />
        );
      case "savings":
        return (
          <SavingsTab
            simulationId={simulation.id}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
          />
        );
      case "asset":
        return <AssetTab simulationId={simulation.id} />;
      case "debt":
        return <DebtTab simulationId={simulation.id} />;
      case "insurance":
        return <InsuranceTab simulationId={simulation.id} />;
      case "realEstate":
        return <RealEstateTab simulationId={simulation.id} />;
      case "pension":
        return (
          <PensionTab
            simulationId={simulation.id}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear}
            retirementAge={profile.target_retirement_age}
            isMarried={isMarried}
            globalSettings={globalSettings}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.layout}>
      <Sidebar
        currentSection={currentSection}
        onSectionChange={handleSectionChange}
        isExpanded={isSidebarExpanded}
        onExpandChange={setIsSidebarExpanded}
        unreadMessageCount={unreadMessageCount}
        simulations={simulations}
        currentSimulationId={selectedSimulationId}
        onSimulationChange={setSelectedSimulationId}
      />

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <h1 key={currentSection} className={styles.pageTitle}>
              {sectionTitles[currentSection] || currentSection}
            </h1>

            {/* 가계부 월 선택기 */}
            {currentSection === "household-budget" && (
              <div className={styles.budgetMonthSelector}>
                <button
                  onClick={() => {
                    if (budgetMonth === 1) {
                      setBudgetYear((y) => y - 1);
                      setBudgetMonth(12);
                    } else {
                      setBudgetMonth((m) => m - 1);
                    }
                  }}
                  className={styles.budgetMonthBtn}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={styles.budgetMonthLabel}>
                  {budgetYear}년 {budgetMonth}월
                </span>
                <button
                  onClick={() => {
                    if (budgetMonth === 12) {
                      setBudgetYear((y) => y + 1);
                      setBudgetMonth(1);
                    } else {
                      setBudgetMonth((m) => m + 1);
                    }
                  }}
                  className={styles.budgetMonthBtn}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* 계좌 관리 버튼 (가계부, 정기예금/적금, 포트폴리오) */}
            {["household-budget", "savings-deposits", "portfolio"].includes(currentSection) && (
              <button
                className={styles.accountManageBtn}
                onClick={() => {
                  // 섹션에 따라 적절한 탭 열기
                  if (currentSection === "household-budget") setAccountModalTab("checking");
                  else if (currentSection === "savings-deposits") setAccountModalTab("savings");
                  else if (currentSection === "portfolio") setAccountModalTab("securities");
                  setShowAccountModal(true);
                }}
              >
                <Settings size={14} />
                계좌 관리
              </button>
            )}

            {/* 포트폴리오 검색 (포트폴리오 탭에서만 표시) */}
            {currentSection === "portfolio" && (
              <div className={styles.headerSearch}>
                <div className={styles.headerSearchWrapper}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="종목 검색 후 거래 내역 추가하기"
                    value={portfolioSearchQuery}
                    onChange={(e) => {
                      setPortfolioSearchQuery(e.target.value);
                      filterSuggestions(e.target.value);
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setShowSuggestions(false);
                        portfolioSearchTriggerRef.current?.();
                      }
                    }}
                    className={styles.headerSearchInput}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div ref={suggestionsRef} className={styles.headerSuggestions}>
                      {suggestions.map((stock) => (
                        <button
                          key={stock.ticker}
                          type="button"
                          className={styles.headerSuggestionItem}
                          onClick={() => selectSuggestion(stock)}
                        >
                          <span className={styles.suggestionName}>{stock.name}</span>
                          <span className={styles.suggestionTicker}>{stock.ticker}</span>
                          <span className={styles.suggestionMarket}>{stock.market}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowSuggestions(false);
                    portfolioSearchTriggerRef.current?.();
                  }}
                  disabled={portfolioSearchLoading}
                  className={styles.headerSearchBtn}
                >
                  {portfolioSearchLoading ? <RefreshCw size={16} className={styles.spinning} /> : <Search size={16} />}
                </button>
              </div>
            )}
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.contentInner}>{renderContent()}</div>
        </div>
      </main>

      {/* 계좌 관리 모달 */}
      {showAccountModal && (
        <AccountManagementModal
          profileId={profile.id}
          onClose={() => setShowAccountModal(false)}
          initialTab={accountModalTab}
        />
      )}
    </div>
  );
}
