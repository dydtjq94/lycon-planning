"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Settings, Tags,
  Landmark, Home, Briefcase, GraduationCap, Plane, Heart,
  TrendingUp, Wallet, PiggyBank, Shield, Target, Umbrella,
  Baby, Car, Gem, Building2, Palmtree, Rocket, Star, Coffee,
  type LucideIcon,
} from "lucide-react";
import { AccountManagementModal } from "./components/AccountManagementModal";
import { CategoryManagementModal } from "./components/CategoryManagementModal";
import { useFinancialContext } from "@/contexts/FinancialContext";
import {
  useFinancialItems,
  useSimulations,
  useCreateSimulation,
  useDeleteSimulation,
  useUpdateSimulation,
  useTodaySnapshot,
  useSnapshots,
  financialKeys,
} from "@/hooks/useFinancialData";
import type {
  FinancialItem,
  IncomeData,
  PensionData,
} from "@/types";
import type { SimulationResult } from "@/lib/services/simulationEngine";
import { runSimulationFromItems } from "@/lib/services/simulationEngine";
import { getTotalUnreadCount } from "@/lib/services/messageService";
import { simulationService } from "@/lib/services/simulationService";
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
  portfolio: "투자 포트폴리오",
  "household-budget": "가계부",
  "checking-account": "입출금통장",
  "savings-deposits": "정기 예금/적금",
  // 시뮬레이션
  simulation: "시뮬레이션",
  // 설정
  settings: "설정",
};

const validSections = Object.keys(sectionTitles);

// 시뮬레이션 아이콘 프리셋
const SIMULATION_ICONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: "landmark", icon: Landmark, label: "은퇴" },
  { id: "home", icon: Home, label: "내 집" },
  { id: "briefcase", icon: Briefcase, label: "커리어" },
  { id: "graduation-cap", icon: GraduationCap, label: "교육" },
  { id: "plane", icon: Plane, label: "여행" },
  { id: "heart", icon: Heart, label: "결혼" },
  { id: "baby", icon: Baby, label: "육아" },
  { id: "trending-up", icon: TrendingUp, label: "투자" },
  { id: "wallet", icon: Wallet, label: "자산" },
  { id: "piggy-bank", icon: PiggyBank, label: "저축" },
  { id: "target", icon: Target, label: "목표" },
  { id: "umbrella", icon: Umbrella, label: "안전" },
  { id: "car", icon: Car, label: "자동차" },
  { id: "gem", icon: Gem, label: "럭셔리" },
  { id: "building", icon: Building2, label: "부동산" },
  { id: "palmtree", icon: Palmtree, label: "휴식" },
  { id: "rocket", icon: Rocket, label: "도전" },
  { id: "star", icon: Star, label: "기본" },
  { id: "coffee", icon: Coffee, label: "일상" },
  { id: "shield", icon: Shield, label: "보장" },
];

function getSimulationIcon(iconId?: string): LucideIcon {
  const found = SIMULATION_ICONS.find(i => i.id === iconId);
  return found?.icon || Star;
}

export function DashboardContent() {
  // URL pathname
  const pathname = usePathname();

  // Context에서 데이터 가져오기
  const {
    simulation,
    profile,
    familyMembers,
    simulationProfile,
    globalSettings,
  } = useFinancialContext();

  const queryClient = useQueryClient();

  // 상태 (URL에서 초기화는 useEffect에서 처리)
  const [currentSection, setCurrentSection] = useState<string>("dashboard");
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>(simulation.id);
  const [initializingSimulationId, setInitializingSimulationId] = useState<string | null>(null);
  const [syncingPricesSimulationId, setSyncingPricesSimulationId] = useState<string | null>(null);
  const [simulationDataKey, setSimulationDataKey] = useState(0); // 데이터 리로드 트리거
  const [isEditingSimTitle, setIsEditingSimTitle] = useState(false);
  const [editSimTitle, setEditSimTitle] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  // URL 업데이트 함수 (pushState 직접 사용으로 즉시 반응)
  const updateUrl = useCallback((section: string, simId: string) => {
    const params = new URLSearchParams();
    if (section !== "dashboard") {
      params.set("section", section);
    }
    // 시뮬레이션 섹션에서는 항상 sim 파라미터 포함
    if (section === "simulation" && simId) {
      params.set("sim", simId);
    }
    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    window.history.pushState(null, "", newUrl);
  }, [pathname]);

  // 섹션 변경 핸들러
  const handleSectionChange = useCallback((section: string) => {
    setCurrentSection(section);
    // simulation 섹션은 handleSimulationChange에서 URL 관리
    if (section !== "simulation") {
      updateUrl(section, selectedSimulationId);
    }
  }, [selectedSimulationId, updateUrl]);

  // 시뮬레이션 변경 핸들러 (섹션도 함께 변경)
  const handleSimulationChange = useCallback((simId: string) => {
    setSelectedSimulationId(simId);
    setCurrentSection("simulation");
    updateUrl("simulation", simId);
  }, [updateUrl]);

  // 초기 로드 시 URL에서 상태 동기화 (마운트 시 1회만 실행)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const simFromUrl = params.get("sim");
    const sectionFromUrl = params.get("section");

    console.log("[DashboardContent] Initial URL sync:", { simFromUrl, sectionFromUrl });

    if (sectionFromUrl && validSections.includes(sectionFromUrl)) {
      setCurrentSection(sectionFromUrl);
    }
    // URL에 sim 파라미터가 있으면 그것 사용
    if (simFromUrl) {
      setSelectedSimulationId(simFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 브라우저 뒤로가기/앞으로가기 처리
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const newSection = params.get("section");
      const newSimId = params.get("sim");

      if (newSection && validSections.includes(newSection)) {
        setCurrentSection(newSection);
      } else {
        setCurrentSection("dashboard");
      }

      setSelectedSimulationId(newSimId || simulation.id);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [simulation.id]);

  // 포트폴리오 검색 상태 (헤더에서 입력, PortfolioTab에서 처리)
  const [portfolioSearchQuery, setPortfolioSearchQuery] = useState("");
  const [portfolioSearchLoading, setPortfolioSearchLoading] = useState(false);
  const portfolioSearchTriggerRef = useRef<(() => void) | null>(null);

  // 가계부 주간 상태
  const today = new Date();
  // 월요일 구하기 (0=일요일이므로 조정 필요)
  const getMonday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 일요일이면 이전 주 월요일
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const [budgetWeekStart, setBudgetWeekStart] = useState(() => getMonday(today));

  // 계좌 관리 모달
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState<"checking" | "savings" | "securities">("checking");

  // 카테고리 관리 모달
  const [showCategoryModal, setShowCategoryModal] = useState(false);

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
      // 아이콘 피커 외부 클릭
      if (
        iconPickerRef.current &&
        !iconPickerRef.current.contains(e.target as Node)
      ) {
        setShowIconPicker(false);
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
  const createSimulation = useCreateSimulation();
  const updateSimulation = useUpdateSimulation();

  // 선택된 시뮬레이션 계산
  const selectedSim = simulations.find(s => s.id === selectedSimulationId) || simulations[0];

  // 시뮬레이션 추가 핸들러
  const handleAddSimulation = useCallback(async () => {
    const title = prompt("새 시뮬레이션 이름을 입력하세요:", "새 시뮬레이션");
    if (title && title.trim()) {
      createSimulation.mutate(
        { title: title.trim() },
        {
          onSuccess: (newSim) => {
            // 즉시 UI 업데이트 (시뮬레이션 리스트에 표시)
            setSelectedSimulationId(newSim.id);
            setCurrentSection("simulation");
            updateUrl("simulation", newSim.id);
            setInitializingSimulationId(newSim.id); // 초기화 중 표시

            // 백그라운드에서 데이터 초기화
            (async () => {
              try {
                // 1단계: 계좌 데이터 복사 (가격 없이 빠르게)
                await simulationService.initializeSimulationData(newSim.id, profile.id);

                // 2단계: UI 표시 (데이터 로드)
                setInitializingSimulationId(null);
                setSimulationDataKey(prev => prev + 1);
                queryClient.invalidateQueries({ queryKey: ["simulations"] });
                queryClient.invalidateQueries({ queryKey: financialKeys.items(newSim.id) });

                // 3단계: 백그라운드에서 실시간 가격 조회 후 업데이트
                setSyncingPricesSimulationId(newSim.id);
                simulationService.syncPricesInBackground(newSim.id, profile.id)
                  .then(() => {
                    // 가격 업데이트 후 UI 새로고침
                    setSyncingPricesSimulationId(null);
                    queryClient.invalidateQueries({ queryKey: financialKeys.items(newSim.id) });
                    queryClient.invalidateQueries({ queryKey: ["simulations"] });
                  })
                  .catch((error) => {
                    console.error("Price sync error:", error);
                    setSyncingPricesSimulationId(null);
                  });
              } catch (error) {
                console.error("[handleAddSimulation] Initialize error:", error);
                setInitializingSimulationId(null);
              }
            })();
          },
        }
      );
    }
  }, [createSimulation, profile.id, updateUrl]);

  // 시뮬레이션 삭제
  const deleteSimulation = useDeleteSimulation();

  const handleDeleteSimulation = useCallback((simulationId: string) => {
    deleteSimulation.mutate(simulationId, {
      onSuccess: () => {
        // 삭제된 시뮬레이션이 현재 선택된 것이었다면
        if (selectedSimulationId === simulationId) {
          const remaining = simulations.filter(s => s.id !== simulationId);
          if (remaining.length > 0) {
            const defaultSim = remaining.find(s => s.is_default) || remaining[0];
            setSelectedSimulationId(defaultSim.id);
            updateUrl("simulation", defaultSim.id);
          } else {
            // 시뮬레이션이 모두 삭제되면 대시보드로 이동
            setSelectedSimulationId(null as unknown as string);
            setCurrentSection("dashboard");
            updateUrl("dashboard", "");
          }
        }
      },
    });
  }, [deleteSimulation, selectedSimulationId, simulations, updateUrl]);

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
            profileId={profile.id}
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
        return <BudgetTab profileId={profile.id} weekStart={budgetWeekStart} />;
      case "checking-account":
        return <CheckingAccountTab profileId={profile.id} />;
      case "savings-deposits":
        return <SavingsDepositsTab profileId={profile.id} />;
      // 설정
      case "settings":
        return <SettingsTab profileName={profile.name || ""} />;
      // 시뮬레이션
      case "simulation": {
        return (
          <ScenarioTab
            key={`${selectedSimulationId}-${simulationDataKey}`}
            simulation={selectedSim || simulation}
            simulationId={selectedSimulationId}
            profile={profile}
            simulationProfile={simulationProfile}
            familyMembers={familyMembers}
            globalSettings={globalSettings}
            simulationResult={simulationResult}
            isMarried={isMarried}
            spouseMember={spouseMember}
            isInitializing={initializingSimulationId === selectedSimulationId}
            isSyncingPrices={syncingPricesSimulationId === selectedSimulationId}
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
        unreadMessageCount={unreadMessageCount}
        simulations={simulations}
        currentSimulationId={selectedSimulationId}
        onSimulationChange={handleSimulationChange}
        onAddSimulation={handleAddSimulation}
        onDeleteSimulation={handleDeleteSimulation}
      />

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            {currentSection === "simulation" && selectedSim ? (
              <div className={styles.simTitleGroup}>
                <div className={styles.simIconWrapper} ref={iconPickerRef}>
                  <button
                    className={styles.simIconBtn}
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    type="button"
                  >
                    {(() => {
                      const SimIcon = getSimulationIcon(selectedSim.icon);
                      return <SimIcon size={16} />;
                    })()}
                  </button>
                  {showIconPicker && (
                    <div className={styles.iconPicker}>
                      {SIMULATION_ICONS.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            className={`${styles.iconPickerItem} ${selectedSim.icon === item.id ? styles.iconPickerItemActive : ""}`}
                            onClick={() => {
                              updateSimulation.mutate({ id: selectedSim.id, updates: { icon: item.id } });
                              setShowIconPicker(false);
                            }}
                            title={item.label}
                            type="button"
                          >
                            <Icon size={18} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {isEditingSimTitle ? (
                  <input
                    className={styles.pageTitleInput}
                    value={editSimTitle}
                    onChange={(e) => setEditSimTitle(e.target.value)}
                    onBlur={() => {
                      if (editSimTitle.trim() && editSimTitle.trim() !== selectedSim.title) {
                        updateSimulation.mutate({ id: selectedSim.id, updates: { title: editSimTitle.trim() } });
                      }
                      setIsEditingSimTitle(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                      if (e.key === "Escape") {
                        setIsEditingSimTitle(false);
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <h1
                    className={styles.pageTitle}
                    onDoubleClick={() => {
                      setEditSimTitle(selectedSim.title);
                      setIsEditingSimTitle(true);
                    }}
                    style={{ cursor: "default" }}
                  >
                    {selectedSim.title}
                  </h1>
                )}
              </div>
            ) : (
              <h1 key={currentSection} className={styles.pageTitle}>
                {sectionTitles[currentSection] || currentSection}
              </h1>
            )}

            {/* 현재 자산 날짜 표시 */}
            {currentSection === "current-asset" && (
              <span className={styles.currentAssetDate}>
                {new Date().getFullYear()}년 {new Date().getMonth() + 1}월 {new Date().getDate()}일
              </span>
            )}

            {/* 가계부 주간 선택기 */}
            {currentSection === "household-budget" && (
              <div className={styles.budgetMonthSelector}>
                <button
                  onClick={() => {
                    const newDate = new Date(budgetWeekStart);
                    newDate.setDate(newDate.getDate() - 7);
                    setBudgetWeekStart(newDate);
                  }}
                  className={styles.budgetMonthBtn}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={styles.budgetMonthLabel}>
                  {budgetWeekStart.getMonth() + 1}.{budgetWeekStart.getDate()} - {(() => {
                    const endDate = new Date(budgetWeekStart);
                    endDate.setDate(endDate.getDate() + 6);
                    return `${endDate.getMonth() + 1}.${endDate.getDate()}`;
                  })()}
                </span>
                <button
                  onClick={() => {
                    const newDate = new Date(budgetWeekStart);
                    newDate.setDate(newDate.getDate() + 7);
                    setBudgetWeekStart(newDate);
                  }}
                  className={styles.budgetMonthBtn}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* 관리 버튼들 (가계부, 정기예금/적금, 포트폴리오) */}
            {["household-budget", "savings-deposits", "portfolio"].includes(currentSection) && (
              <div className={styles.headerBtnGroup}>
                {/* 카테고리 관리 버튼 (가계부만) */}
                {currentSection === "household-budget" && (
                  <button
                    className={styles.accountManageBtn}
                    onClick={() => setShowCategoryModal(true)}
                  >
                    <Tags size={14} />
                    카테고리 관리
                  </button>
                )}

                {/* 계좌 관리 버튼 */}
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
              </div>
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

        <div className={`${styles.content} ${currentSection === "simulation" ? styles.noPadding : ""}`}>
          <div key={currentSection} className={`${styles.contentInner} ${currentSection === "simulation" ? styles.fullWidth : ""}`}>{renderContent()}</div>
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

      {/* 카테고리 관리 모달 */}
      {showCategoryModal && (
        <CategoryManagementModal
          profileId={profile.id}
          onClose={() => setShowCategoryModal(false)}
        />
      )}
    </div>
  );
}
