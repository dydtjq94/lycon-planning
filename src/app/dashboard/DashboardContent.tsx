"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Settings, Tags,
  Landmark, Home, Briefcase, GraduationCap, Plane, Heart,
  TrendingUp, Wallet, PiggyBank, Shield, Target, Umbrella,
  Baby, Car, Gem, Building2, Palmtree, Rocket, Star, Coffee,
  ListOrdered, Percent, Users, CalendarClock, Play,
  type LucideIcon,
} from "lucide-react";
import { useChartTheme } from "@/hooks/useChartTheme";
import { AccountManagementModal } from "./components/AccountManagementModal";
import { CategoryManagementModal } from "./components/CategoryManagementModal";
import { SimulationAssumptionsPanel, CashFlowPrioritiesPanel, FamilyConfigPanel, LifeCyclePanel, StartPointPanel } from "./components/tabs/scenario";
import { useFinancialContext, type FamilyMember } from "@/contexts/FinancialContext";
import {
  useFinancialItems,
  useSimulationV2Data,
  useSimulations,
  useCreateSimulation,
  useDeleteSimulation,
  useUpdateSimulation,
  useTodaySnapshot,
  useSnapshots,
  financialKeys,
} from "@/hooks/useFinancialData";
import type { SimulationResult } from "@/lib/services/simulationTypes";
import type {
  FinancialItem,
  IncomeData,
  PensionData,
  LifeCycleSettings,
  SimFamilyMember,
  CashFlowPriorities,
  SimulationAssumptions,
} from "@/types";
import { runSimulationV2 } from "@/lib/services/simulationEngineV2";
import { getTotalUnreadCount } from "@/lib/services/messageService";
import { simulationService } from "@/lib/services/simulationService";
import { calculateEndYear } from "@/lib/utils/chartDataTransformer";
import { DEFAULT_SIMULATION_ASSUMPTIONS, normalizePriorities } from "@/types";
import { Sidebar } from "./components";
import {
  MessagesTab,
  CurrentAssetTab,
  AssetRecordTab,
  PortfolioTab,
  BudgetTab,
  CheckingAccountTab,
  SavingsDepositsTab,
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

interface DashboardContentProps {
  adminView?: {
    targetUserId: string;
    targetUserName: string;
  };
}

export function DashboardContent({ adminView }: DashboardContentProps) {
  const { isDark } = useChartTheme();
  // URL pathname
  const pathname = usePathname();

  // Context에서 데이터 가져오기
  const {
    simulation,
    profile,
    familyMembers,
    setFamilyMembers,
    updateProfile,
    simulationProfile,
  } = useFinancialContext();

  const queryClient = useQueryClient();

  // 시뮬레이션 아이콘 맵
  const SIM_ICON_MAP: Record<string, LucideIcon> = {
    landmark: Landmark, home: Home, briefcase: Briefcase,
    'graduation-cap': GraduationCap, plane: Plane, heart: Heart,
    baby: Baby, 'trending-up': TrendingUp, wallet: Wallet,
    'piggy-bank': PiggyBank, target: Target, umbrella: Umbrella,
    car: Car, gem: Gem, building: Building2, palmtree: Palmtree,
    rocket: Rocket, star: Star, coffee: Coffee, shield: Shield,
  };

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
  const [showStartPointPanel, setShowStartPointPanel] = useState(false);
  const [startPointRect, setStartPointRect] = useState<{ top: number; left: number } | null>(null);
  const startPointBtnRef = useRef<HTMLButtonElement>(null);
  const startPointRef = useRef<HTMLDivElement>(null);

  const [showAssumptionsPanel, setShowAssumptionsPanel] = useState(false);
  const [assumptionsPanelRect, setAssumptionsPanelRect] = useState<{ top: number; left: number } | null>(null);
  const assumptionsPanelBtnRef = useRef<HTMLButtonElement>(null);
  const assumptionsPanelRef = useRef<HTMLDivElement>(null);

  const [showPrioritiesPanel, setShowPrioritiesPanel] = useState(false);
  const [prioritiesPanelRect, setPrioritiesPanelRect] = useState<{ top: number; left: number } | null>(null);
  const prioritiesPanelBtnRef = useRef<HTMLButtonElement>(null);
  const prioritiesPanelRef = useRef<HTMLDivElement>(null);

  const [showFamilyPanel, setShowFamilyPanel] = useState(false);
  const [familyPanelRect, setFamilyPanelRect] = useState<{ top: number; left: number } | null>(null);
  const familyPanelBtnRef = useRef<HTMLButtonElement>(null);
  const familyPanelRef = useRef<HTMLDivElement>(null);

  const [showLifeCyclePanel, setShowLifeCyclePanel] = useState(false);
  const [lifeCyclePanelRect, setLifeCyclePanelRect] = useState<{ top: number; left: number } | null>(null);
  const lifeCyclePanelBtnRef = useRef<HTMLButtonElement>(null);
  const lifeCyclePanelRef = useRef<HTMLDivElement>(null);
  // 비교 선택 상태: 'asset-trend' = 자산 추이, 시뮬레이션 ID = 다른 시뮬레이션
  const [compareSelections, setCompareSelections] = useState<Set<string>>(new Set());

  // URL 업데이트 함수 (pushState 직접 사용으로 즉시 반응)
  const updateUrl = useCallback((section: string, simId: string) => {
    const params = new URLSearchParams();
    // 관리자 모드: viewAs 파라미터 보존
    if (adminView) {
      params.set("viewAs", adminView.targetUserId);
    }
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
  }, [pathname, adminView]);

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

  // 가계부 월간 상태
  const today = new Date();
  const [budgetYear, setBudgetYear] = useState(today.getFullYear());
  const [budgetMonth, setBudgetMonth] = useState(today.getMonth() + 1); // 1-12

  // 계좌 관리 모달
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState<"checking" | "savings" | "securities">("checking");
  const [accountBtnRect, setAccountBtnRect] = useState<{top: number, left: number, width: number} | null>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);

  // 카테고리 관리 모달
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryBtnRect, setCategoryBtnRect] = useState<{top: number, left: number, width: number} | null>(null);
  const categoryBtnRef = useRef<HTMLButtonElement>(null);

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

  // Start point panel click-outside handler
  useEffect(() => {
    if (!showStartPointPanel) return;
    const handleClick = (e: MouseEvent) => {
      if (
        startPointRef.current && !startPointRef.current.contains(e.target as Node) &&
        startPointBtnRef.current && !startPointBtnRef.current.contains(e.target as Node)
      ) {
        setShowStartPointPanel(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowStartPointPanel(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showStartPointPanel]);

  // Assumptions panel click-outside handler
  useEffect(() => {
    if (!showAssumptionsPanel) return;
    const handleClick = (e: MouseEvent) => {
      if (
        assumptionsPanelRef.current && !assumptionsPanelRef.current.contains(e.target as Node) &&
        assumptionsPanelBtnRef.current && !assumptionsPanelBtnRef.current.contains(e.target as Node)
      ) {
        setShowAssumptionsPanel(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAssumptionsPanel(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showAssumptionsPanel]);

  // Priorities panel click-outside handler
  useEffect(() => {
    if (!showPrioritiesPanel) return;
    const handleClick = (e: MouseEvent) => {
      if (
        prioritiesPanelRef.current && !prioritiesPanelRef.current.contains(e.target as Node) &&
        prioritiesPanelBtnRef.current && !prioritiesPanelBtnRef.current.contains(e.target as Node)
      ) {
        setShowPrioritiesPanel(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPrioritiesPanel(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showPrioritiesPanel]);

  // Family panel click-outside handler
  useEffect(() => {
    if (!showFamilyPanel) return;
    const handleClick = (e: MouseEvent) => {
      if (
        familyPanelRef.current && !familyPanelRef.current.contains(e.target as Node) &&
        familyPanelBtnRef.current && !familyPanelBtnRef.current.contains(e.target as Node)
      ) {
        setShowFamilyPanel(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowFamilyPanel(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showFamilyPanel]);

  // Life cycle panel click-outside handler
  useEffect(() => {
    if (!showLifeCyclePanel) return;
    const handleClick = (e: MouseEvent) => {
      if (
        lifeCyclePanelRef.current && !lifeCyclePanelRef.current.contains(e.target as Node) &&
        lifeCyclePanelBtnRef.current && !lifeCyclePanelBtnRef.current.contains(e.target as Node)
      ) {
        setShowLifeCyclePanel(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLifeCyclePanel(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showLifeCyclePanel]);

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
  const { data: simulations = [] } = useSimulations(profile.id);
  const createSimulation = useCreateSimulation(adminView ? profile.id : undefined);
  const updateSimulation = useUpdateSimulation();

  // 선택된 시뮬레이션 계산
  const selectedSim = simulations.find(s => s.id === selectedSimulationId) || simulations[0];

  // 시뮬레이션 추가 핸들러
  const handleAddSimulation = useCallback(async () => {
    const nextNum = simulations.length + 1;
    const title = `새 시뮬레이션 ${nextNum}`;
    createSimulation.mutate(
      { title },
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

                // 2단계: 실시간 가격 조회 및 동기화
                await simulationService.syncPricesInBackground(newSim.id, profile.id);

                // 3단계: 모든 데이터 로드 완료까지 대기 후 로딩 해제
                setSimulationDataKey(prev => prev + 1);
                queryClient.invalidateQueries({ queryKey: ["simulations"] });
                await queryClient.invalidateQueries({ queryKey: financialKeys.all });
                setInitializingSimulationId(null);
              } catch (error) {
                console.error("[handleAddSimulation] Initialize error:", error);
                setInitializingSimulationId(null);
              }
            })();
          },
        }
      );
  }, [createSimulation, simulations.length, profile.id, updateUrl]);

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
            // 시뮬레이션이 모두 삭제됨
            setSelectedSimulationId(null as unknown as string);
            // 시뮬레이션 탭에 있을 때만 대시보드로 이동
            if (currentSection === "simulation") {
              setCurrentSection("dashboard");
              updateUrl("dashboard", "");
            }
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

  // V2 시뮬레이션 데이터 로드 (선택된 시뮬레이션 기준)
  const activeSimulationId = selectedSim?.id || simulation.id;
  const { data: v2Data, isLoading: isLoadingV2 } = useSimulationV2Data(activeSimulationId);

  // 레거시 pension sync용으로만 V1 items 유지
  const { data: items = [], isLoading } = useFinancialItems(simulation.id, simulationProfile);

  // 시뮬레이션 가정 및 캐시플로우 우선순위 (선택된 시뮬레이션 기준)
  const activeSim = selectedSim || simulation;
  // 시뮬레이션 가정: 로컬 override로 즉시 반영
  const [assumptionsOverride, setAssumptionsOverride] = useState<SimulationAssumptions | null>(null);
  const simulationAssumptions = assumptionsOverride ?? activeSim.simulation_assumptions ?? DEFAULT_SIMULATION_ASSUMPTIONS;

  // 캐시플로우 우선순위: 로컬 override로 즉시 반영
  const [prioritiesOverride, setPrioritiesOverride] = useState<CashFlowPriorities | null>(null);
  const prevSimIdRef = useRef(activeSim.id);
  if (prevSimIdRef.current !== activeSim.id) {
    prevSimIdRef.current = activeSim.id;
    setAssumptionsOverride(null);
    setPrioritiesOverride(null);
  }
  const cashFlowPriorities = useMemo(() => normalizePriorities(prioritiesOverride ?? activeSim.cash_flow_priorities), [activeSim.cash_flow_priorities, prioritiesOverride]);

  // 시뮬레이션별 가족 구성 (없으면 프로필의 가족 사용, self 제외)
  const simFamilyMembers: SimFamilyMember[] = useMemo(() => {
    if (activeSim.family_config) return activeSim.family_config.filter(m => m.relationship !== 'self');
    return familyMembers.map((fm) => ({
      id: fm.id,
      relationship: fm.relationship,
      name: fm.name,
      birth_date: fm.birth_date,
      gender: fm.gender,
      is_dependent: fm.is_dependent,
      is_working: fm.is_working,
      retirement_age: fm.retirement_age,
      monthly_income: fm.monthly_income,
    }));
  }, [activeSim.family_config, familyMembers]);

  // 본인 아이콘 설정 (family_config 내 self 엔트리)
  const selfFamilyConfig = useMemo(() => {
    return activeSim.family_config?.find(m => m.relationship === 'self') ?? null;
  }, [activeSim.family_config]);

  // 배우자 정보 (시뮬레이션별 가족 기준)
  const spouseMember = useMemo(() => {
    return simFamilyMembers.find((fm) => fm.relationship === "spouse");
  }, [simFamilyMembers]);
  const isMarried = !!spouseMember;

  // 생애 주기 설정 (시뮬레이션별, 없으면 프로필 기본값)
  const lifeCycleSettings: LifeCycleSettings = useMemo(() => {
    const saved = activeSim.life_cycle_settings;
    return {
      selfRetirementAge: saved?.selfRetirementAge ?? profile.target_retirement_age,
      selfLifeExpectancy: saved?.selfLifeExpectancy ?? 100,
      spouseRetirementAge: saved?.spouseRetirementAge ?? spouseMember?.retirement_age ?? 65,
      spouseLifeExpectancy: saved?.spouseLifeExpectancy ?? saved?.selfLifeExpectancy ?? 100,
      retirementIcon: saved?.retirementIcon,
      retirementColor: saved?.retirementColor,
      lifeExpectancyIcon: saved?.lifeExpectancyIcon,
      lifeExpectancyColor: saved?.lifeExpectancyColor,
      spouseRetirementIcon: saved?.spouseRetirementIcon,
      spouseRetirementColor: saved?.spouseRetirementColor,
      spouseLifeExpectancyIcon: saved?.spouseLifeExpectancyIcon,
      spouseLifeExpectancyColor: saved?.spouseLifeExpectancyColor,
    };
  }, [activeSim.life_cycle_settings, profile.target_retirement_age, spouseMember?.retirement_age]);

  // 시뮬레이션 가정 변경 핸들러
  const handleSimulationAssumptionsChange = useCallback((newAssumptions: SimulationAssumptions) => {
    setAssumptionsOverride(newAssumptions);
    if (selectedSim) {
      updateSimulation.mutate({
        id: selectedSim.id,
        updates: { simulation_assumptions: newAssumptions }
      });
    }
  }, [selectedSim, updateSimulation]);

  // 현금 흐름 우선순위 변경 핸들러
  const handleCashFlowPrioritiesChange = useCallback((newPriorities: CashFlowPriorities) => {
    setPrioritiesOverride(newPriorities);
    if (selectedSim) {
      updateSimulation.mutate({
        id: selectedSim.id,
        updates: { cash_flow_priorities: newPriorities }
      });
    }
  }, [selectedSim, updateSimulation]);

  // 생애 주기 변경 핸들러 (시뮬레이션별 저장)
  const handleLifeCycleChange = useCallback((newSettings: LifeCycleSettings) => {
    if (selectedSim) {
      updateSimulation.mutate({
        id: selectedSim.id,
        updates: { life_cycle_settings: newSettings }
      });
    }
  }, [selectedSim, updateSimulation]);

  // 가족 구성 변경 핸들러 (시뮬레이션별 저장, self 엔트리 포함)
  const handleFamilyConfigChange = useCallback((newFamily: SimFamilyMember[], selfEntry?: SimFamilyMember | null) => {
    if (selectedSim) {
      // self 엔트리를 포함하여 저장 (있으면 앞에 추가)
      const existing = activeSim.family_config?.find(m => m.relationship === 'self');
      const selfToSave = selfEntry !== undefined ? selfEntry : existing;
      const fullConfig = selfToSave ? [selfToSave, ...newFamily.filter(m => m.relationship !== 'self')] : newFamily;
      updateSimulation.mutate({
        id: selectedSim.id,
        updates: { family_config: fullConfig }
      });
    }
  }, [selectedSim, updateSimulation, activeSim.family_config]);

  // 비교 선택 토글
  const toggleCompareSelection = useCallback((key: string) => {
    setCompareSelections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Profile update handler (saves to profiles table + updates context)
  const handleProfileUpdate = useCallback(async (updates: Record<string, any>) => {
    const supabase = createClient();
    await supabase.from("profiles").update(updates).eq("id", profile.id);
    updateProfile(updates as Partial<typeof profile>);
  }, [profile.id, updateProfile]);

  // Family members change handler (updates context so tab switching preserves changes)
  const handleFamilyMembersRefresh = useCallback((updatedMembers: FamilyMember[]) => {
    setFamilyMembers(updatedMembers);
  }, [setFamilyMembers]);

  // 공유 시뮬레이션 결과 (V2 엔진 사용, 선택된 시뮬레이션 기준)
  // v2Data 로딩 중에는 빈 결과를 반환하여 중간 상태 렌더링 방지
  const simulationResult: SimulationResult = useMemo(() => {
    if (isLoadingV2) {
      return {
        startYear: new Date().getFullYear(),
        endYear: new Date().getFullYear(),
        retirementYear: new Date().getFullYear(),
        snapshots: [],
        monthlySnapshots: [],
        summary: {
          currentNetWorth: 0, retirementNetWorth: 0,
          peakNetWorth: 0, peakNetWorthYear: 0,
          yearsToFI: null, fiTarget: 0, bankruptcyYear: null,
        },
      } as SimulationResult;
    }
    const simulationEndYear = calculateEndYear(
      simulationProfile.birthYear,
      simulationProfile.spouseBirthYear,
      lifeCycleSettings.selfLifeExpectancy,
      lifeCycleSettings.spouseLifeExpectancy
    );
    const simStartYear = activeSim.start_year || new Date().getFullYear();
    const yearsToSimulate = simulationEndYear - simStartYear;
    return runSimulationV2(
      v2Data,
      {
        birthYear: simulationProfile.birthYear,
        retirementAge: lifeCycleSettings.selfRetirementAge,
        spouseBirthYear: simulationProfile.spouseBirthYear ?? undefined,
        spouseRetirementAge: lifeCycleSettings.spouseRetirementAge,
      },
      yearsToSimulate,
      simulationAssumptions,
      cashFlowPriorities,
      activeSim.start_year,
      activeSim.start_month,
    );
  }, [v2Data, isLoadingV2, simulationProfile, lifeCycleSettings, simulationAssumptions, cashFlowPriorities, activeSim.start_year, activeSim.start_month]);

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
      const lifeExpectancy = 100;
      const investmentReturnRate =
        (simulationAssumptions.rates.investment ?? 7) / 100;

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
      const incomeGrowthRate = (simulationAssumptions.rates.incomeGrowth ?? 3) / 100;
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
            const retirementAge = lifeCycleSettings.selfRetirementAge;
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
              growthRate: simulationAssumptions.rates.inflation ?? 2.5,
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
  }, [items, isLoading, profile, familyMembers, simulationAssumptions, addItem]);

  const renderContent = () => {
    switch (currentSection) {
      // 대시보드
      case "dashboard":
        return (
          <DashboardTab
            simulationId={simulation.id}
            birthYear={simulationProfile.birthYear}
            spouseBirthYear={simulationProfile.spouseBirthYear ?? null}
            retirementAge={lifeCycleSettings.selfRetirementAge}
            unreadMessageCount={unreadMessageCount}
            onNavigate={handleSectionChange}
            profileId={profile.id}
            simulations={simulations}
            lifeCycleSettings={lifeCycleSettings}
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
        return (
          <SettingsTab
            profile={profile}
            familyMembers={familyMembers}
            onFamilyMembersChange={handleFamilyMembersRefresh}
            onProfileUpdate={handleProfileUpdate}
          />
        );
      // 시뮬레이션
      case "simulation": {
        return (
          <ScenarioTab
            key={`${selectedSimulationId}-${simulationDataKey}`}
            simulation={selectedSim || simulation}
            simulationId={selectedSimulationId}
            profile={profile}
            simulationProfile={simulationProfile}
            familyMembers={simFamilyMembers}
            simulationResult={simulationResult}
            isMarried={isMarried}
            spouseMember={spouseMember}
            isInitializing={initializingSimulationId === selectedSimulationId || isLoadingV2}
            isSyncingPrices={syncingPricesSimulationId === selectedSimulationId}
            simulationAssumptions={simulationAssumptions}
            cashFlowPriorities={cashFlowPriorities}
            compareSelections={compareSelections}
            allSimulations={simulations}
            profileId={profile.id}
            onToggleCompare={toggleCompareSelection}
          />
        );
      }
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
        {adminView && (
          <div className={styles.adminBanner}>
            <a
              href={`/admin/users/${adminView.targetUserId}`}
              className={styles.adminBannerBack}
            >
              <ChevronLeft size={16} />
            </a>
            <span className={styles.adminBannerText}>
              {adminView.targetUserName}님의 대시보드 (관리자)
            </span>
          </div>
        )}
        <header className={styles.header}>
          <div className={styles.headerInner}>
            {currentSection === "simulation" && selectedSim ? (
              <div className={styles.simTitleGroup}>
                <div className={styles.simIconWrapper} ref={iconPickerRef}>
                  <button
                    className={styles.simIconBtn}
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    type="button"
                    data-tooltip="아이콘 변경"
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
                      const newTitle = editSimTitle.trim();
                      if (newTitle && newTitle !== selectedSim.title) {
                        selectedSim.title = newTitle;
                        updateSimulation.mutate({ id: selectedSim.id, updates: { title: newTitle } });
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
                    onClick={() => {
                      setEditSimTitle(selectedSim.title);
                      setIsEditingSimTitle(true);
                    }}
                    style={{ cursor: "pointer" }}
                    data-tooltip="클릭하여 이름 변경"
                  >
                    {selectedSim.title}
                  </h1>
                )}
                <div className={styles.simHeaderDivider} />
                <button
                  ref={familyPanelBtnRef}
                  className={styles.simHeaderAction}
                  onClick={() => {
                    if (familyPanelBtnRef.current) {
                      const rect = familyPanelBtnRef.current.getBoundingClientRect();
                      setFamilyPanelRect({ top: rect.bottom + 6, left: rect.left });
                    }
                    setShowFamilyPanel(!showFamilyPanel);
                  }}
                  type="button"
                  data-tooltip={showFamilyPanel ? undefined : "가족 구성"}
                >
                  <Users size={15} />
                </button>
                <button
                  ref={lifeCyclePanelBtnRef}
                  className={styles.simHeaderAction}
                  onClick={() => {
                    if (lifeCyclePanelBtnRef.current) {
                      const rect = lifeCyclePanelBtnRef.current.getBoundingClientRect();
                      setLifeCyclePanelRect({ top: rect.bottom + 6, left: rect.left });
                    }
                    setShowLifeCyclePanel(!showLifeCyclePanel);
                  }}
                  type="button"
                  data-tooltip={showLifeCyclePanel ? undefined : "생애 주기"}
                >
                  <CalendarClock size={15} />
                </button>
                <div className={styles.simHeaderDivider} />
                <button
                  ref={startPointBtnRef}
                  className={styles.simHeaderAction}
                  onClick={() => {
                    if (startPointBtnRef.current) {
                      const rect = startPointBtnRef.current.getBoundingClientRect();
                      setStartPointRect({ top: rect.bottom + 6, left: rect.left });
                    }
                    setShowStartPointPanel(!showStartPointPanel);
                  }}
                  type="button"
                  data-tooltip={showStartPointPanel ? undefined : "시작 시점"}
                >
                  <Play size={15} />
                </button>
                <button
                  ref={assumptionsPanelBtnRef}
                  className={styles.simHeaderAction}
                  onClick={() => {
                    if (assumptionsPanelBtnRef.current) {
                      const rect = assumptionsPanelBtnRef.current.getBoundingClientRect();
                      setAssumptionsPanelRect({ top: rect.bottom + 6, left: rect.left });
                    }
                    setShowAssumptionsPanel(!showAssumptionsPanel);
                  }}
                  type="button"
                  data-tooltip={showAssumptionsPanel ? undefined : "시뮬레이션 가정"}
                >
                  <Percent size={15} />
                </button>
                <button
                  ref={prioritiesPanelBtnRef}
                  className={styles.simHeaderAction}
                  onClick={() => {
                    if (prioritiesPanelBtnRef.current) {
                      const rect = prioritiesPanelBtnRef.current.getBoundingClientRect();
                      setPrioritiesPanelRect({ top: rect.bottom + 6, left: rect.left });
                    }
                    setShowPrioritiesPanel(!showPrioritiesPanel);
                  }}
                  type="button"
                  data-tooltip={showPrioritiesPanel ? undefined : "현금 흐름 우선순위"}
                >
                  <ListOrdered size={15} />
                </button>
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

            {/* 가계부 월간 선택기 */}
            {currentSection === "household-budget" && (
              <div className={styles.budgetMonthSelector}>
                <button
                  onClick={() => {
                    if (budgetMonth === 1) {
                      setBudgetYear(budgetYear - 1);
                      setBudgetMonth(12);
                    } else {
                      setBudgetMonth(budgetMonth - 1);
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
                      setBudgetYear(budgetYear + 1);
                      setBudgetMonth(1);
                    } else {
                      setBudgetMonth(budgetMonth + 1);
                    }
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
                    ref={categoryBtnRef}
                    className={styles.accountManageBtn}
                    onClick={() => {
                      if (categoryBtnRef.current) {
                        const rect = categoryBtnRef.current.getBoundingClientRect();
                        setCategoryBtnRect({ top: rect.bottom, left: rect.left, width: rect.width });
                      }
                      setShowCategoryModal(true);
                    }}
                  >
                    <Tags size={14} />
                    카테고리 관리
                  </button>
                )}

                {/* 계좌 관리 버튼 */}
                <button
                  ref={accountBtnRef}
                  className={styles.accountManageBtn}
                  onClick={() => {
                    // 섹션에 따라 적절한 탭 열기
                    if (currentSection === "household-budget") setAccountModalTab("checking");
                    else if (currentSection === "savings-deposits") setAccountModalTab("savings");
                    else if (currentSection === "portfolio") setAccountModalTab("securities");

                    if (accountBtnRef.current) {
                      const rect = accountBtnRef.current.getBoundingClientRect();
                      setAccountBtnRect({ top: rect.bottom, left: rect.left, width: rect.width });
                    }
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

        {showStartPointPanel && startPointRect && currentSection === "simulation" && selectedSim && (
          <div
            ref={startPointRef}
            className={styles.accountsPanelDropdown}
            style={{
              position: 'fixed',
              top: startPointRect.top,
              left: startPointRect.left,
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              zIndex: 200,
              width: 260,
            }}
          >
            <StartPointPanel
              startYear={selectedSim.start_year ?? null}
              startMonth={selectedSim.start_month ?? null}
              onSave={async (year: number | null, month: number | null) => {
                try {
                  await simulationService.update(selectedSim.id, {
                    start_year: year,
                    start_month: month,
                  });
                  await queryClient.invalidateQueries({ queryKey: ["simulations"] });
                  setShowStartPointPanel(false);
                } catch (err) {
                  console.error('Failed to update start point:', err);
                }
              }}
            />
          </div>
        )}

        {showAssumptionsPanel && assumptionsPanelRect && currentSection === "simulation" && selectedSim && (
          <div
            ref={assumptionsPanelRef}
            className={styles.accountsPanelDropdown}
            style={{
              position: 'fixed',
              top: assumptionsPanelRect.top,
              left: Math.min(assumptionsPanelRect.left, window.innerWidth - 436),
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              zIndex: 200,
            }}
          >
            <SimulationAssumptionsPanel
              assumptions={simulationAssumptions}
              onChange={handleSimulationAssumptionsChange}
            />
          </div>
        )}

        {showPrioritiesPanel && prioritiesPanelRect && currentSection === "simulation" && selectedSim && (
          <div
            ref={prioritiesPanelRef}
            className={styles.accountsPanelDropdown}
            style={{
              position: 'fixed',
              top: prioritiesPanelRect.top,
              left: Math.min(prioritiesPanelRect.left, window.innerWidth - 436),
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              zIndex: 200,
            }}
          >
            <CashFlowPrioritiesPanel
              priorities={cashFlowPriorities}
              onChange={handleCashFlowPrioritiesChange}
              simulationId={selectedSimulationId}
            />
          </div>
        )}

        {showFamilyPanel && familyPanelRect && currentSection === "simulation" && selectedSim && (
          <div
            ref={familyPanelRef}
            className={styles.accountsPanelDropdown}
            style={{
              position: 'fixed',
              top: familyPanelRect.top,
              left: familyPanelRect.left,
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              zIndex: 200,
            }}
          >
            <FamilyConfigPanel
              profile={profile}
              familyMembers={simFamilyMembers}
              selfConfig={selfFamilyConfig}
              onFamilyChange={handleFamilyConfigChange}
            />
          </div>
        )}

        {showLifeCyclePanel && lifeCyclePanelRect && currentSection === "simulation" && selectedSim && (
          <div
            ref={lifeCyclePanelRef}
            className={styles.accountsPanelDropdown}
            style={{
              position: 'fixed',
              top: lifeCyclePanelRect.top,
              left: lifeCyclePanelRect.left,
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              zIndex: 200,
            }}
          >
            <LifeCyclePanel
              profile={profile}
              spouseMember={spouseMember}
              lifeCycleSettings={lifeCycleSettings}
              onLifeCycleChange={handleLifeCycleChange}
            />
          </div>
        )}

        <div className={`${styles.content} ${currentSection === "simulation" ? styles.noPadding : ""} ${currentSection === "household-budget" ? `${styles.noPadding} ${styles.noScroll}` : ""} ${currentSection === "messages" ? styles.noPadding : ""}`}>
          <div key={currentSection} className={`${styles.contentInner} ${currentSection === "simulation" || currentSection === "household-budget" || currentSection === "dashboard" ? styles.fullWidth : ""} ${currentSection === "household-budget" ? styles.fullHeight : ""}`}>{renderContent()}</div>
        </div>
      </main>

      {/* 계좌 관리 모달 */}
      {showAccountModal && (
        <AccountManagementModal
          profileId={profile.id}
          onClose={() => setShowAccountModal(false)}
          initialTab={accountModalTab}
          isMarried={isMarried}
          triggerRect={accountBtnRect}
        />
      )}

      {/* 카테고리 관리 모달 */}
      {showCategoryModal && (
        <CategoryManagementModal
          profileId={profile.id}
          onClose={() => setShowCategoryModal(false)}
          triggerRect={categoryBtnRect}
        />
      )}
    </div>
  );
}
