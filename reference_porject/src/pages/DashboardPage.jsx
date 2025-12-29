import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAdminInfo, checkProfileAccess } from "../services/authService";
import { calculateKoreanAge, getKoreanAgeInYear } from "../utils/koreanAge";
import { formatAmount } from "../utils/format";
import {
  calculateCashflowSimulation,
  calculateAssetSimulation,
  extractAIAnalysisData,
} from "../utils/cashflowSimulator";
import {
  profileService,
  incomeService,
  expenseService,
  savingsService,
  pensionService,
  realEstateService,
  assetService,
  debtService,
  checklistService,
  globalSettingsService,
  aiPromptService,
} from "../services/firestoreService";
import { simulationService } from "../services/simulationService";
import { migrateProfileData } from "../utils/dataMigration";
import SimulationTabs from "../components/simulation/SimulationTabs";
import RechartsCashflowChart from "../components/charts/RechartsCashflowChart";
import RechartsAssetChart from "../components/charts/RechartsAssetChart";
import IncomeModal from "../components/income/IncomeModal";
import IncomeList from "../components/income/IncomeList";
import ExpenseModal from "../components/expense/ExpenseModal";
import ExpenseList from "../components/expense/ExpenseList";
import SavingModal from "../components/saving/SavingModal";
import SavingList from "../components/saving/SavingList";
import PensionModal from "../components/pension/PensionModal";
import PensionList from "../components/pension/PensionList";
import RealEstateModal from "../components/realestate/RealEstateModal";
import RealEstateList from "../components/realestate/RealEstateList";
import AssetModal from "../components/asset/AssetModal";
import AssetList from "../components/asset/AssetList";
import DebtModal from "../components/debt/DebtModal";
import DebtList from "../components/debt/DebtList";
import ProfileEditModal from "../components/profile/ProfileEditModal";
import ProfileSummary from "../components/profile/ProfileSummary";
import ProfilePasswordModal from "../components/profile/ProfilePasswordModal";
import CalculatorModal from "../components/common/CalculatorModal";
import SimulationCompareModal from "../components/simulation/SimulationCompareModal";
import ProfileChecklistPanel from "../components/checklist/ProfileChecklistPanel";
import ChecklistTemplateModal from "../components/checklist/ChecklistTemplateModal";
import { normalizeChecklistItems } from "../constants/profileChecklist";
import FinancialDataStorePanel from "../components/datastore/FinancialDataStorePanel";
import TemplateManageModal from "../components/datastore/TemplateManageModal";
import RateAdjustModal from "../components/rate/RateAdjustModal";
import { trackEvent, trackPageView } from "../libs/mixpanel";
import styles from "./DashboardPage.module.css";

/**
 * 프로필 레벨의 투자 규칙을 시뮬레이션별로 마이그레이션
 * (기존 프로필에 cashflowInvestmentRules가 있으면 모든 시뮬레이션에 복사하고 프로필에서 삭제)
 */
async function migrateInvestmentRulesToSimulations(profileId, simulationList) {
  try {
    // 프로필 데이터 가져오기
    const profile = await profileService.getProfile(profileId);

    // 프로필에 cashflowInvestmentRules가 있는지 확인
    if (
      !profile.cashflowInvestmentRules ||
      Object.keys(profile.cashflowInvestmentRules).length === 0
    ) {
      // 마이그레이션할 데이터 없음
      return;
    }

    // 모든 시뮬레이션에 투자 규칙 복사
    const migrationPromises = simulationList.map((sim) =>
      simulationService.updateInvestmentRules(
        profileId,
        sim.id,
        profile.cashflowInvestmentRules
      )
    );

    await Promise.all(migrationPromises);

    // 프로필에서 cashflowInvestmentRules 삭제
    await profileService.updateProfile(profileId, {
      cashflowInvestmentRules: {},
    });
  } catch (error) {
    console.error("투자 규칙 마이그레이션 오류:", error);
  }
}

/**
 * 프로필 대시보드 페이지
 * 재무 상담사가 내담자의 재무 상태를 관리하고 시뮬레이션을 확인할 수 있습니다.
 */
function DashboardPage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { adminId, userId, isAdmin: isAdminFromAuth } = useAuth(); // 관리자 및 사용자 정보
  const [isAdmin, setIsAdmin] = useState(false); // 실제 편집 권한 여부 (관리자 또는 권한 있는 사용자)
  const [hasEditPermission, setHasEditPermission] = useState(false); // 편집 권한 여부
  const [selectedCategory, setSelectedCategory] = useState("income");
  const [isProfileEditModalOpen, setIsProfileEditModalOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [originalRetirementAge, setOriginalRetirementAge] = useState(null); // 프로필 원본 은퇴 나이 (기본 시뮬레이션용)
  const [originalSpouseRetirementAge, setOriginalSpouseRetirementAge] = useState(null); // 프로필 원본 배우자 은퇴 나이 (기본 시뮬레이션용)
  const [loading, setLoading] = useState(true);

  // 프로필 패스워드 관련 state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false); // 패스워드 입력 모달
  const [hasProfileAccess, setHasProfileAccess] = useState(false); // 프로필 접근 권한 (패스워드 입력 완료)
  const [activeChart, setActiveChart] = useState("assets"); // 기본값: 순 자산 규모
  const [simulationData, setSimulationData] = useState({
    cashflow: [],
    assets: [],
  });

  // 시뮬레이션 관련 state
  const [simulations, setSimulations] = useState([]); // 모든 시뮬레이션 목록
  const [activeSimulationId, setActiveSimulationId] = useState(null); // 현재 활성화된 시뮬레이션 ID
  const [isFinancialDataLoading, setIsFinancialDataLoading] = useState(true); // 재무 데이터 로딩 상태
  const [simulationMemo, setSimulationMemo] = useState("");
  const [isMemoSaving, setIsMemoSaving] = useState(false);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [profilePanelTab, setProfilePanelTab] = useState("memo");
  const [isDataStorePanelOpen, setIsDataStorePanelOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false); // 재무 라이브러리 관리 모달
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0); // 재무 라이브러리 새로고침 키
  const [profileMemo, setProfileMemo] = useState("");
  const [isProfileMemoSaving, setIsProfileMemoSaving] = useState(false);
  const [profileChecklist, setProfileChecklist] = useState(null);
  const [isChecklistLoading, setIsChecklistLoading] = useState(false);
  const [isChecklistSaving, setIsChecklistSaving] = useState(false);
  const checklistIdRef = useRef(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false); // 템플릿 수정 모달

  // X축 범위 조정 상태 (두 차트 공유)
  const [chartXAxisRange, setChartXAxisRange] = useState({
    start: null,
    end: null,
  });

  const fetchSimulationFinancialData = useCallback(
    async (simulationId) => {
      if (!profileId || !simulationId || !profileData) return null;

      const [
        incomeData,
        expenseData,
        savingData,
        pensionData,
        realEstateData,
        assetsData,
        debtData,
      ] = await Promise.all([
        incomeService.getIncomes(profileId, simulationId),
        expenseService.getExpenses(profileId, simulationId),
        savingsService.getSavings(profileId, simulationId),
        pensionService.getPensions(profileId, simulationId),
        realEstateService.getRealEstates(profileId, simulationId),
        assetService.getAssets(profileId, simulationId),
        debtService.getDebts(profileId, simulationId),
      ]);

      const sortByCreatedAt = (list) =>
        list
          ? [...list].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            )
          : [];

      const sortedIncomes = sortByCreatedAt(incomeData);
      const sortedExpenses = sortByCreatedAt(expenseData);
      const sortedSavings = sortByCreatedAt(savingData);
      const sortedPensions = sortByCreatedAt(pensionData);
      const sortedRealEstates = sortByCreatedAt(realEstateData);
      const sortedAssets = sortByCreatedAt(assetsData);
      const sortedDebts = sortByCreatedAt(debtData);

      // 해당 시뮬레이션의 투자 규칙 및 인출 규칙 가져오기
      const simulation = simulations.find((sim) => sim.id === simulationId);
      const profileDataWithSimulation = {
        ...profileData,
        cashflowInvestmentRules: simulation?.cashflowInvestmentRules || {},
        assetWithdrawalRules: simulation?.assetWithdrawalRules || {},
      };

      const cashflow = calculateCashflowSimulation(
        profileDataWithSimulation, // 투자 규칙이 포함된 profileData 사용
        sortedIncomes,
        sortedExpenses,
        sortedSavings,
        sortedPensions,
        sortedRealEstates,
        sortedAssets,
        sortedDebts
      );

      return {
        incomes: sortedIncomes,
        expenses: sortedExpenses,
        savings: sortedSavings,
        pensions: sortedPensions,
        realEstates: sortedRealEstates,
        assets: sortedAssets,
        debts: sortedDebts,
        cashflow,
      };
    },
    [profileId, profileData, simulations]
  );

  const loadProfileChecklist = useCallback(async () => {
    if (!profileId) return;
    setIsChecklistLoading(true);
    try {
      const checklists = await checklistService.getChecklists(profileId);
      if (!checklists || checklists.length === 0) {
        checklistIdRef.current = null;
        setProfileChecklist({
          id: null,
          title: "체크리스트",
          items: [],
        });
        return;
      }

      const first = {
        ...checklists[0],
      };
      const normalizedItems = normalizeChecklistItems(first.items || []);
      checklistIdRef.current = first.id;
      setProfileChecklist({
        id: first.id,
        title: first.title || "체크리스트",
        items: normalizedItems,
      });
    } catch (error) {
      console.error("체크리스트 로드 오류:", error);
      alert("체크리스트를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsChecklistLoading(false);
    }
  }, [profileId]);

  const [incomes, setIncomes] = useState([]);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [savings, setSavings] = useState([]);
  const [isSavingModalOpen, setIsSavingModalOpen] = useState(false);
  const [editingSaving, setEditingSaving] = useState(null);
  const [pensions, setPensions] = useState([]);
  const [isPensionModalOpen, setIsPensionModalOpen] = useState(false);
  const [editingPension, setEditingPension] = useState(null);
  const [realEstates, setRealEstates] = useState([]);
  const [isRealEstateModalOpen, setIsRealEstateModalOpen] = useState(false);
  const [editingRealEstate, setEditingRealEstate] = useState(null);
  const [assets, setAssets] = useState([]);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [debts, setDebts] = useState([]);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [sidebarView, setSidebarView] = useState("categories"); // "categories" or "list"
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isAIOptionModalOpen, setIsAIOptionModalOpen] = useState(false); // AI 옵션 선택 모달
  const [aiPrompts, setAiPrompts] = useState({
    singlePrompt: "",
    comparePrompt: "",
  }); // AI 프롬프트 설정값
  const [isSavingPrompts, setIsSavingPrompts] = useState(false); // 프롬프트 저장 중
  const [isRateAdjustModalOpen, setIsRateAdjustModalOpen] = useState(false); // 상승률 일괄 조절 모달
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // 사이드바 접기/펼치기 상태
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [showDebugTable, setShowDebugTable] = useState(false); // 디버그 테이블 표시 여부
  const [showDataFlowInfo, setShowDataFlowInfo] = useState(false); // 데이터 흐름 설명 표시 여부
  const [initialIncomeData, setInitialIncomeData] = useState(null); // 재무 라이브러리에서 선택한 소득 템플릿 데이터
  const [initialExpenseData, setInitialExpenseData] = useState(null); // 재무 라이브러리에서 선택한 지출 템플릿 데이터
  const [initialSavingData, setInitialSavingData] = useState(null); // 복사된 저축 데이터
  const [initialPensionData, setInitialPensionData] = useState(null); // 복사된 연금 데이터
  const [initialAssetData, setInitialAssetData] = useState(null); // 복사된 자산 데이터
  const [initialRealEstateData, setInitialRealEstateData] = useState(null); // 복사된 부동산 데이터
  const [initialDebtData, setInitialDebtData] = useState(null); // 복사된 부채 데이터
  const [globalSettings, setGlobalSettings] = useState({
    defaultInflationRate: "1.89",
    defaultIncomeGrowthRate: "3.3",
    defaultInvestmentReturnRate: "2.86",
    defaultSavingGrowthRate: "1.89",
    defaultIncomeRate: "3",
    defaultRealEstateGrowthRate: "2.4",
    defaultAssetGrowthRate: "2.86",
    defaultDebtInterestRate: "3.5",
  }); // 전역 설정
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState({
    defaultData: null,
    targetData: null,
    defaultTitle: "",
    targetTitle: "",
    defaultSimulationId: null,
    targetSimulationId: null,
  });
  const defaultSimulationEntry = useMemo(
    () => simulations.find((sim) => sim.isDefault),
    [simulations]
  );
  const currentSimulation = useMemo(
    () => simulations.find((sim) => sim.id === activeSimulationId),
    [simulations, activeSimulationId]
  );
  const isActiveSimulationDefault = !!(
    defaultSimulationEntry &&
    activeSimulationId &&
    defaultSimulationEntry.id === activeSimulationId
  );

  // 권한 확인: 관리자 또는 해당 프로필에 권한이 있는 사용자
  useEffect(() => {
    const checkPermissions = async () => {
      if (!profileId) {
        setIsAdmin(false);
        setHasEditPermission(false);
        return;
      }

      // 1. 관리자 권한 확인
      if (adminId) {
        try {
          const result = await getAdminInfo(adminId);
          if (result.success && result.admin) {
            const adminIsAdmin = result.admin.isAdmin !== false;
            setIsAdmin(adminIsAdmin);
            setHasEditPermission(adminIsAdmin); // 관리자는 항상 편집 가능
            return;
          }
        } catch (error) {
          console.error("관리자 상태 확인 오류:", error);
        }
      }

      // 2. 사용자 권한 확인
      if (userId) {
        try {
          const hasAccess = await checkProfileAccess(userId, profileId);
          setIsAdmin(false); // 관리자가 아님
          setHasEditPermission(hasAccess); // 프로필 접근 권한이 있으면 편집 가능
          return;
        } catch (error) {
          console.error("사용자 권한 확인 오류:", error);
        }
      }

      // 3. 비로그인 사용자
      setIsAdmin(false);
      setHasEditPermission(false);
    };

    checkPermissions();
  }, [adminId, userId, profileId]);

  // 프로필 데이터 로드
  useEffect(() => {
    let isMounted = true; // 컴포넌트가 마운트된 상태인지 확인

    const loadProfile = async () => {
      if (!profileId) return;

      try {
        setLoading(true);
        const profile = await profileService.getProfile(profileId);

        // 컴포넌트가 여전히 마운트된 상태에서만 상태 업데이트
        if (isMounted) {
          if (profile) {
            setProfileData(profile);
            setOriginalRetirementAge(profile.retirementAge); // 원본 은퇴 나이 저장
            setOriginalSpouseRetirementAge(profile.spouseRetirementAge); // 원본 배우자 은퇴 나이 저장
            setProfileMemo(profile.memo || "");

            // 프로필 패스워드 체크
            // 1. 관리자나 사용자로 로그인한 경우는 패스워드 체크 스킵
            if (adminId || userId) {
              setHasProfileAccess(true);
            }
            // 2. 프로필에 패스워드가 설정되어 있는 경우
            else if (profile.password && profile.password.trim()) {
              // localStorage에 해당 프로필의 접근 권한이 있는지 확인
              const savedPassword = localStorage.getItem(
                `profileAccess_${profileId}`
              );

              if (savedPassword === profile.password) {
                // 패스워드가 일치하면 접근 허용
                setHasProfileAccess(true);

                // Mixpanel: localStorage 패스워드로 접근 성공
                const currentYear = new Date().getFullYear();
                const currentAge = calculateKoreanAge(
                  profile.birthYear,
                  currentYear
                );
                trackEvent("프로필 자동 접근 (localStorage)", {
                  profileId,
                  profileName: profile.name,
                  birthYear: profile.birthYear,
                  currentAge: currentAge,
                  retirementAge: profile.retirementAge,
                  profileStatus: profile.status || "unknown",
                  hasSpouse: profile.hasSpouse || false,
                });
              } else {
                // 패스워드가 없거나 일치하지 않으면 모달 표시
                setHasProfileAccess(false);
                setIsPasswordModalOpen(true);
              }
            }
            // 3. 패스워드가 설정되어 있지 않은 경우 -> 패스워드 입력 필수
            else {
              // 패스워드가 설정되지 않았어도 입력 모달 표시
              setHasProfileAccess(false);
              setIsPasswordModalOpen(true);
            }

            // generateSimulationData는 별도 useEffect에서 처리
          } else {
            navigate("/consult");
          }
        }
      } catch (error) {
        console.error("프로필 로드 오류:", error);
        if (isMounted) {
          navigate("/consult");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    // cleanup 함수로 중복 요청 방지
    return () => {
      isMounted = false;
    };
  }, [profileId, navigate, adminId, userId]);

  // 전역 설정 로드
  useEffect(() => {
    const loadGlobalSettings = async () => {
      try {
        const settings = await globalSettingsService.getSettings();
        setGlobalSettings(settings);
      } catch (error) {
        console.error("전역 설정 로드 오류:", error);
      }
    };
    loadGlobalSettings();
  }, []);

  // AI 프롬프트 설정 로드
  useEffect(() => {
    const loadAiPrompts = async () => {
      try {
        const prompts = await aiPromptService.getPrompts();
        setAiPrompts(prompts);
      } catch (error) {
        console.error("AI 프롬프트 로드 오류:", error);
      }
    };
    loadAiPrompts();
  }, []);

  // AI 프롬프트 저장 핸들러
  const handleSaveAiPrompts = async (newPrompts) => {
    setIsSavingPrompts(true);
    try {
      await aiPromptService.updatePrompts(newPrompts);
      setAiPrompts(newPrompts); // 저장 후 state 업데이트
      alert("AI 프롬프트가 저장되었습니다.");
    } catch (error) {
      console.error("AI 프롬프트 저장 오류:", error);
      alert("AI 프롬프트 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingPrompts(false);
    }
  };

  // 사이드바가 열릴 때 배경 스크롤 막기
  useEffect(() => {
    const isSidebarOpen = isProfilePanelOpen || isDataStorePanelOpen;

    if (isSidebarOpen) {
      // 현재 스크롤 위치 저장
      const scrollY = window.scrollY;

      // body 스크롤 막기
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";

      // 터치 이벤트로 스크롤 방지 (모바일)
      const preventScroll = (e) => {
        // 패널 내부 및 모달 내부 스크롤은 허용
        let target = e.target;
        while (target && target !== document.body) {
          if (target.classList) {
            // 프로필 패널 내부 스크롤 허용
            if (
              target.classList.contains("profileSidePanelContent") ||
              target.classList.contains("profilePanelContent")
            ) {
              return;
            }
            // 모달 오버레이는 스크롤 허용 (그 안의 모든 요소)
            if (target.classList.contains("modalOverlay")) {
              return;
            }
          }
          // overflow가 설정된 스크롤 가능한 요소인지 확인
          const style = window.getComputedStyle(target);
          if (style.overflowY === "auto" || style.overflowY === "scroll") {
            return;
          }
          target = target.parentElement;
        }
        e.preventDefault();
      };

      // touchmove 이벤트 차단 (모바일)
      document.addEventListener("touchmove", preventScroll, { passive: false });
      // wheel 이벤트 차단 (데스크톱)
      document.addEventListener("wheel", preventScroll, { passive: false });

      return () => {
        // 원래 상태로 복구
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";

        // 이벤트 리스너 제거
        document.removeEventListener("touchmove", preventScroll);
        document.removeEventListener("wheel", preventScroll);

        // 스크롤 위치 복원
        window.scrollTo(0, scrollY);
      };
    }
  }, [isProfilePanelOpen, isDataStorePanelOpen]);

  useEffect(() => {
    if (!profileId) {
      setProfileChecklist(null);
      checklistIdRef.current = null;
      return;
    }
    checklistIdRef.current = null;
    setProfileChecklist(null);
    loadProfileChecklist();
  }, [profileId, loadProfileChecklist]);

  // 시뮬레이션 목록 로드 및 자동 마이그레이션
  useEffect(() => {
    const loadSimulations = async () => {
      if (!profileId) return;

      try {
        const simulationList = await simulationService.getSimulations(
          profileId
        );

        if (simulationList.length === 0) {
          // 기존 데이터를 새 구조로 자동 마이그레이션
          const migrationResult = await migrateProfileData(profileId);

          if (migrationResult.success) {
            // 마이그레이션 후 시뮬레이션 다시 로드
            const updatedSimulations = await simulationService.getSimulations(
              profileId
            );
            setSimulations(updatedSimulations);

            // 기본 시뮬레이션 활성화
            const defaultSim = updatedSimulations.find(
              (sim) => sim.isDefault === true
            );
            if (defaultSim) {
              setActiveSimulationId(defaultSim.id);
            }
          } else {
            console.error("마이그레이션 실패:", migrationResult);
            // 마이그레이션이 필요없는 경우(이미 완료된 경우)는 무시
            if (migrationResult.simulationCount > 0) {
              const updatedSimulations = await simulationService.getSimulations(
                profileId
              );
              setSimulations(updatedSimulations);
              const defaultSim = updatedSimulations.find(
                (sim) => sim.isDefault === true
              );
              if (defaultSim) {
                setActiveSimulationId(defaultSim.id);
              }
            }
          }
          return;
        }

        setSimulations(simulationList);

        // 기본 시뮬레이션을 활성화
        const defaultSim = simulationList.find((sim) => sim.isDefault === true);
        if (defaultSim) {
          setActiveSimulationId(defaultSim.id);
        } else {
          // 기본 시뮬레이션이 없으면 첫 번째 시뮬레이션 활성화
          setActiveSimulationId(simulationList[0].id);
        }

        // 프로필 레벨 투자 규칙 마이그레이션 체크 및 실행
        await migrateInvestmentRulesToSimulations(profileId, simulationList);
      } catch (error) {
        console.error("시뮬레이션 목록 조회 오류:", error);
      }
    };

    loadSimulations();
  }, [profileId]);

  // 시뮬레이션 전환 시 프로필 데이터의 은퇴년도 업데이트
  useEffect(() => {
    if (!activeSimulationId || !simulations.length || !profileData) return;

    const currentSim = simulations.find(
      (sim) => sim.id === activeSimulationId
    );
    if (!currentSim) return;

    const birthYear = parseInt(profileData.birthYear);
    const spouseBirthYear = parseInt(profileData.spouseBirthYear);
    let newRetirementAge;
    let newSpouseRetirementAge;

    if (currentSim.isDefault) {
      // 기본 시뮬레이션("현재")인 경우: 프로필 원본 값으로 복원
      newRetirementAge = originalRetirementAge;
      newSpouseRetirementAge = originalSpouseRetirementAge;
    } else if (currentSim.retirementYear) {
      // 다른 시뮬레이션: retirementYear가 있으면 그걸 기반으로 retirementAge 계산
      const retirementYear = parseInt(currentSim.retirementYear);
      newRetirementAge = retirementYear - birthYear;
      // 배우자 은퇴년도도 시뮬레이션에 있으면 사용
      if (currentSim.spouseRetirementYear && spouseBirthYear) {
        newSpouseRetirementAge = parseInt(currentSim.spouseRetirementYear) - spouseBirthYear;
      } else {
        newSpouseRetirementAge = originalSpouseRetirementAge;
      }
    } else {
      // retirementYear가 없는 시뮬레이션: 원본 값 사용
      newRetirementAge = originalRetirementAge;
      newSpouseRetirementAge = originalSpouseRetirementAge;
    }

    // 현재 프로필의 값과 다른 경우만 업데이트
    const needsUpdate =
      (newRetirementAge && profileData.retirementAge !== newRetirementAge) ||
      (newSpouseRetirementAge && profileData.spouseRetirementAge !== newSpouseRetirementAge);

    if (needsUpdate) {
      setProfileData({
        ...profileData,
        ...(newRetirementAge && { retirementAge: newRetirementAge }),
        ...(newSpouseRetirementAge && { spouseRetirementAge: newSpouseRetirementAge }),
      });
    }
  }, [activeSimulationId, simulations, profileData?.birthYear, profileData?.spouseBirthYear, originalRetirementAge, originalSpouseRetirementAge]);

  // 모든 재무 데이터를 한 번에 병렬로 로드
  useEffect(() => {
    const loadAllFinancialData = async () => {
      if (!profileId || !activeSimulationId) return;

      try {
        // 시뮬레이션 변경 시 이전 데이터 즉시 초기화
        setIncomes([]);
        setExpenses([]);
        setSavings([]);
        setPensions([]);
        setRealEstates([]);
        setAssets([]);
        setDebts([]);

        setIsFinancialDataLoading(true); // 로딩 시작

        // Promise.all을 사용하여 모든 데이터를 동시에 가져오기
        const [
          incomeData,
          expenseData,
          savingData,
          pensionData,
          realEstateData,
          assetsData,
          debtData,
        ] = await Promise.all([
          incomeService.getIncomes(profileId, activeSimulationId),
          expenseService.getExpenses(profileId, activeSimulationId),
          savingsService.getSavings(profileId, activeSimulationId),
          pensionService.getPensions(profileId, activeSimulationId),
          realEstateService.getRealEstates(profileId, activeSimulationId),
          assetService.getAssets(profileId, activeSimulationId),
          debtService.getDebts(profileId, activeSimulationId),
        ]);

        // 모든 데이터를 생성 순서대로 정렬 (createdAt 기준)
        const sortedIncomes = incomeData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        const sortedExpenses = expenseData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        const sortedSavings = savingData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        const sortedPensions = pensionData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        const sortedRealEstates = realEstateData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        const sortedAssets = assetsData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        const sortedDebts = debtData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );

        // 모든 상태를 한 번에 업데이트
        setIncomes(sortedIncomes);
        setExpenses(sortedExpenses);
        setSavings(sortedSavings);
        setPensions(sortedPensions);
        setRealEstates(sortedRealEstates);
        setAssets(sortedAssets);
        setDebts(sortedDebts);

        setIsFinancialDataLoading(false); // 로딩 완료
      } catch (error) {
        console.error("재무 데이터 로드 오류:", error);
        setIsFinancialDataLoading(false); // 오류 시에도 로딩 완료 처리
      }
    };

    loadAllFinancialData();
  }, [profileId, activeSimulationId]);

  // 시뮬레이션 메모 동기화
  useEffect(() => {
    if (!activeSimulationId) {
      setSimulationMemo("");
      return;
    }

    const currentSimulation = simulations.find(
      (sim) => sim.id === activeSimulationId
    );
    const memoText = currentSimulation?.memo || "";
    setSimulationMemo(memoText);
  }, [activeSimulationId, simulations]);

  useEffect(() => {
    setProfileMemo(profileData?.memo || "");
  }, [profileData?.memo]);

  // Mixpanel: Dashboard 페이지 진입 이벤트
  useEffect(() => {
    if (profileData && !loading) {
      const currentYear = new Date().getFullYear();
      const currentAge = calculateKoreanAge(profileData.birthYear, currentYear);
      const childrenCount = profileData.familyMembers
        ? profileData.familyMembers.filter((m) => m.relationship === "자녀")
            .length
        : 0;
      const parentsCount = profileData.familyMembers
        ? profileData.familyMembers.filter(
            (m) => m.relationship === "부" || m.relationship === "모"
          ).length
        : 0;

      // 현재 시뮬레이션의 은퇴년도 계산 (시뮬레이션에 설정되어 있으면 사용, 아니면 프로필 기준으로 계산)
      const currentSimulation = simulations.find(
        (s) => s.id === activeSimulationId
      );
      let retirementYear;
      if (currentSimulation?.retirementYear) {
        retirementYear = currentSimulation.retirementYear;
      } else {
        // 프로필의 retirementAge로부터 계산
        const birthYear = parseInt(profileData.birthYear);
        const retirementAge = parseInt(profileData.retirementAge);
        retirementYear = birthYear + retirementAge;
      }

      trackPageView("대시보드 페이지", {
        profileId: profileId,
        profileName: profileData.name,
        birthYear: profileData.birthYear,
        currentAge: currentAge,
        retirementAge: profileData.retirementAge,
        retirementYear: retirementYear,
        profileStatus: profileData.status || "unknown",
        hasSpouse: profileData.hasSpouse || false,
        spouseName: profileData.spouseName || "",
        childrenCount: childrenCount,
        parentsCount: parentsCount,
        simulationCount: simulations.length,
        activeSimulation: currentSimulation?.title,
        hasEditPermission: hasEditPermission,
        isAdmin: isAdmin,
        viewerType: isAdmin ? "관리자" : userId ? "로그인 사용자" : "비로그인",
      });
    }
  }, [
    profileData,
    loading,
    profileId,
    simulations.length,
    activeSimulationId,
    hasEditPermission,
    isAdmin,
    userId,
  ]);

  // useMemo를 사용해 시뮬레이션 데이터를 메모이제이션하여 불필요한 재계산 방지
  // 재무 데이터나 프로필이 실제로 변경될 때만 계산 수행
  const memoizedSimulationData = useMemo(() => {
    // profileData가 없거나 재무 데이터 로딩 중이면 빈 데이터 반환
    if (!profileData || isFinancialDataLoading) {
      return { cashflow: [], cashflowDetailed: [], assets: [] };
    }

    const currentYear = new Date().getFullYear();
    const startAge = calculateKoreanAge(profileData.birthYear, currentYear); // 만 나이로 실시간 계산
    const retirementAge = parseInt(profileData.retirementAge);
    const deathAge = 90;
    const startYear = currentYear;

    // 현재 나이와 은퇴 나이의 차이를 계산해서 은퇴 년도 구하기
    const yearsToRetirement = retirementAge - startAge;
    const retirementYear = currentYear + yearsToRetirement;

    // 현재 나이와 죽을 나이의 차이를 계산해서 죽을 년도 구하기
    const yearsToDeath = deathAge - startAge;
    const deathYear = currentYear + yearsToDeath;

    const years = [];
    for (let year = startYear; year <= deathYear; year++) {
      const age = getKoreanAgeInYear(profileData.birthYear, year);
      years.push({ year, age });
    }

    // 프로필 데이터에 시뮬레이션 투자 규칙 및 은퇴년도 병합
    const profileDataWithSimulation = {
      ...profileData,
      cashflowInvestmentRules: currentSimulation?.cashflowInvestmentRules || {},
      assetWithdrawalRules: currentSimulation?.assetWithdrawalRules || {},
      // 시뮬레이션별 은퇴년도가 설정되어 있으면 프로필 기본값 대신 사용
      retirementYear: currentSimulation?.retirementYear || retirementYear,
      // 시뮬레이션별 배우자 은퇴년도가 설정되어 있으면 사용
      spouseRetirementYear: currentSimulation?.spouseRetirementYear || null,
    };

    // 실제 소득 데이터를 기반으로 현금흐름 시뮬레이션 계산
    const cashflow = calculateCashflowSimulation(
      profileDataWithSimulation,
      incomes,
      expenses, // 지출 데이터 사용
      savings, // 저축/투자 데이터 사용
      pensions, // 연금 데이터 사용
      realEstates, // 부동산 데이터 사용
      assets, // 자산 데이터 사용
      debts // 부채 데이터 사용
    );

    // 자산 시뮬레이션 데이터 계산 (현금 흐름 데이터 포함)
    const assetSimulation = calculateAssetSimulation(
      profileDataWithSimulation,
      incomes,
      expenses,
      savings, // 저축/투자 데이터 사용
      pensions, // 연금 데이터 사용
      realEstates, // 부동산 데이터 사용
      assets, // 자산 데이터 사용
      cashflow, // 현금 흐름 데이터 전달
      debts // 부채 데이터 사용
    );

    // 통합된 구조 반환 (cashflow, assets 모두 breakdown 포함)
    // assetSimulation은 이제 배열 직접 반환 (각 항목에 breakdown 포함)
    return {
      cashflow,
      cashflowDetailed: cashflow, // 상세 데이터는 cashflow와 동일 (하위 호환)
      assets: assetSimulation, // 통합된 배열 (차트용 + 상세용 모두 포함)
    };
  }, [
    profileData,
    currentSimulation,
    incomes,
    expenses,
    savings,
    pensions,
    realEstates,
    assets,
    debts,
    isFinancialDataLoading,
  ]);

  // 메모이제이션된 데이터를 state에 동기화
  // 이렇게 하면 패널 열기 등 다른 state 변경 시에는 재계산되지 않음
  useEffect(() => {
    setSimulationData(memoizedSimulationData);
  }, [memoizedSimulationData]);

  // 프로필 수정 핸들러

  // 프로필 수정 모달 열기
  // 수정/삭제 권한 확인 함수 (권한이 없으면 회원가입 페이지로 이동)
  const checkEditPermission = (actionName = "수정") => {
    if (!hasEditPermission) {
      if (
        confirm(
          `${actionName} 권한이 필요합니다. 로그인 또는 회원가입을 진행하시겠습니까?`
        )
      ) {
        navigate(`/signup?profileId=${profileId}`);
      }
      return false;
    }
    return true;
  };

  const handleEditProfile = () => {
    if (!checkEditPermission("프로필 수정")) return;
    setIsProfileEditModalOpen(true);
  };

  // 프로필 수정 모달 닫기
  const handleCloseProfileEditModal = () => {
    setIsProfileEditModalOpen(false);
  };

  /**
   * 프로필 패스워드 제출 핸들러
   * @param {string} password - 사용자가 입력한 패스워드
   * @returns {Promise<boolean>} 패스워드가 맞으면 true, 틀리면 false
   */
  const handleSubmitPassword = async (password) => {
    // 패스워드가 설정되지 않은 프로필인 경우
    if (!profileData || !profileData.password || !profileData.password.trim()) {
      // 패스워드가 없으면 접근 불가 (관리자가 설정해야 함)
      return false;
    }

    // 패스워드가 맞는지 확인
    if (password === profileData.password) {
      // localStorage에 저장 (같은 브라우저에서는 재입력 불필요)
      localStorage.setItem(`profileAccess_${profileId}`, password);

      // 접근 권한 부여
      setHasProfileAccess(true);
      setIsPasswordModalOpen(false);

      // Mixpanel: 패스워드 입력 후 프로필 접근 성공
      const currentYear = new Date().getFullYear();
      const currentAge = calculateKoreanAge(profileData.birthYear, currentYear);
      trackEvent("프로필 패스워드 접근 성공", {
        profileId,
        profileName: profileData.name,
        birthYear: profileData.birthYear,
        currentAge: currentAge,
        retirementAge: profileData.retirementAge,
        profileStatus: profileData.status || "unknown",
        hasSpouse: profileData.hasSpouse || false,
        accessMethod: "패스워드 입력",
      });

      return true;
    }

    return false;
  };

  /**
   * 프로필 패스워드 모달 닫기 (취소)
   */
  const handleClosePasswordModal = () => {
    // 패스워드 입력 없이 모달을 닫으면 /consult로 이동
    navigate("/consult");
  };

  // 프로필 수정 저장
  const handleSaveProfileEdit = async (updatedProfile) => {
    // 시뮬레이션 목록 다시 로드 (은퇴년도 업데이트 반영)
    try {
      const updatedSimulations = await simulationService.getSimulations(
        profileId
      );
      setSimulations(updatedSimulations);

      // 현재 활성화된 시뮬레이션의 은퇴년도로 retirementAge 설정
      // 탭 전환 시마다 자동으로 업데이트되지만, 프로필 수정 후 현재 탭에 있는 경우를 위해 여기서도 설정
      if (activeSimulationId) {
        const currentSimulation = updatedSimulations.find(
          (s) => s.id === activeSimulationId
        );
        if (
          currentSimulation &&
          currentSimulation.retirementYear &&
          updatedProfile.birthYear
        ) {
          const birthYear = parseInt(updatedProfile.birthYear);
          const retirementYear = parseInt(currentSimulation.retirementYear);
          const retirementAge = retirementYear - birthYear;

          updatedProfile = {
            ...updatedProfile,
            retirementAge: retirementAge,
          };
        }
      }
    } catch (error) {
      console.error("시뮬레이션 목록 재로드 오류:", error);
    }

    setProfileData(updatedProfile);
    // 기본 시뮬레이션에서 수정한 경우 원본 은퇴 나이도 업데이트
    const currentSim = simulations.find((s) => s.id === activeSimulationId);
    if (currentSim?.isDefault) {
      if (updatedProfile.retirementAge) {
        setOriginalRetirementAge(updatedProfile.retirementAge);
      }
      if (updatedProfile.spouseRetirementAge !== undefined) {
        setOriginalSpouseRetirementAge(updatedProfile.spouseRetirementAge);
      }
    }
    // 시뮬레이션 재계산은 useEffect에서 자동 처리

    // 프로필 업데이트 후 소득/저축/지출/연금 데이터 다시 로드 (은퇴년도 변경 시 고정된 항목 업데이트 반영)
    if (activeSimulationId) {
      try {
        const [incomeData, savingData, expenseData, pensionData] =
          await Promise.all([
            incomeService.getIncomes(profileId, activeSimulationId),
            savingsService.getSavings(profileId, activeSimulationId),
            expenseService.getExpenses(profileId, activeSimulationId),
            pensionService.getPensions(profileId, activeSimulationId),
          ]);

        const sortedIncomes = incomeData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        const sortedSavings = savingData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        const sortedExpenses = expenseData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        const sortedPensions = pensionData.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );

        setIncomes(sortedIncomes);
        setSavings(sortedSavings);
        setExpenses(sortedExpenses);
        setPensions(sortedPensions);
      } catch (error) {
        console.error("재무 데이터 리로드 오류:", error);
        // 데이터 리로드 실패해도 프로필 업데이트는 성공으로 처리
      }
    }
  };

  // 현금흐름 투자 규칙 업데이트 핸들러 (시뮬레이션별, 단일 또는 여러 년도 지원)
  const handleUpdateInvestmentRule = async (years, rule) => {
    if (!checkEditPermission("투자 규칙 설정")) return;
    if (!activeSimulationId) {
      alert("활성화된 시뮬레이션이 없습니다.");
      return;
    }

    try {
      // 현재 시뮬레이션의 투자 규칙 가져오기
      const currentRules = await simulationService.getInvestmentRules(
        profileId,
        activeSimulationId
      );

      // 업데이트할 규칙 준비
      const updatedRules = { ...currentRules };

      // 배열인 경우 모든 년도에 적용, 아니면 단일 년도에만 적용
      // null이면 해당 년도의 규칙 삭제 (현금 100% = 기본값)
      if (Array.isArray(years)) {
        years.forEach((year) => {
          if (rule === null) {
            delete updatedRules[year];
          } else {
            updatedRules[year] = rule;
          }
        });
      } else {
        if (rule === null) {
          delete updatedRules[years];
        } else {
          updatedRules[years] = rule;
        }
      }

      // 시뮬레이션 업데이트 (한 번만 호출)
      await simulationService.updateInvestmentRules(
        profileId,
        activeSimulationId,
        updatedRules
      );

      // 시뮬레이션 목록 다시 로드 (투자 규칙 반영)
      const updatedSimulations = await simulationService.getSimulations(
        profileId
      );
      setSimulations(updatedSimulations);
    } catch (error) {
      console.error("투자 규칙 저장 오류:", error);
      alert("투자 규칙 저장 중 오류가 발생했습니다.");
    }
  };

  // 자산 인출 규칙 업데이트 핸들러 (시뮬레이션별, 단일 또는 여러 년도 지원)
  const handleUpdateWithdrawalRule = async (years, rule) => {
    if (!checkEditPermission("인출 규칙 설정")) return;
    if (!activeSimulationId) {
      alert("활성화된 시뮬레이션이 없습니다.");
      return;
    }

    try {
      // 현재 시뮬레이션의 인출 규칙 가져오기
      const currentRules = await simulationService.getWithdrawalRules(
        profileId,
        activeSimulationId
      );

      // 업데이트할 규칙 준비
      const updatedRules = { ...currentRules };

      // 배열인 경우 모든 년도에 적용, 아니면 단일 년도에만 적용
      // null이면 해당 년도의 규칙 삭제
      if (Array.isArray(years)) {
        years.forEach((year) => {
          if (rule === null) {
            delete updatedRules[year];
          } else {
            updatedRules[year] = rule;
          }
        });
      } else {
        if (rule === null) {
          delete updatedRules[years];
        } else {
          updatedRules[years] = rule;
        }
      }

      // 시뮬레이션 업데이트 (한 번만 호출)
      await simulationService.updateWithdrawalRules(
        profileId,
        activeSimulationId,
        updatedRules
      );

      // 시뮬레이션 목록 다시 로드 (인출 규칙 반영)
      const updatedSimulations = await simulationService.getSimulations(
        profileId
      );
      setSimulations(updatedSimulations);
    } catch (error) {
      console.error("인출 규칙 저장 오류:", error);
      alert("인출 규칙 저장 중 오류가 발생했습니다.");
    }
  };

  // 사이드바 뷰 핸들러들
  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);
    setSidebarView("list");
  };

  const handleBackToCategories = useCallback(() => {
    setSidebarView("categories");
  }, []);

  // 키보드 이벤트 핸들러 (백틱 키로 뒤로가기)
  useEffect(() => {
    const handleKeyDown = (event) => {
      // 백틱 키 (`) 또는 ₩ 키로 뒤로가기
      if (event.key === "`" || event.key === "₩") {
        // 사이드바가 리스트 뷰일 때만 뒤로가기 작동
        if (sidebarView === "list") {
          handleBackToCategories();
        }
      }
    };

    // 이벤트 리스너 등록
    window.addEventListener("keydown", handleKeyDown);

    // 컴포넌트 언마운트 시 리스너 제거
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sidebarView, handleBackToCategories]);

  // 소득 데이터 핸들러들
  const handleAddIncome = () => {
    if (!checkEditPermission("소득 추가")) return;
    trackEvent("소득 추가 버튼 클릭", { profileId });
    setEditingIncome(null);
    setInitialIncomeData(null); // initialData 초기화
    setIsIncomeModalOpen(true);
  };

  const handleEditIncome = (income) => {
    if (!checkEditPermission("소득 수정")) return;
    setEditingIncome(income);
    setInitialIncomeData(null); // initialData 초기화
    setIsIncomeModalOpen(true);
  };

  const handleCopyIncome = (income) => {
    if (!checkEditPermission("소득 복사")) return;
    trackEvent("소득 복사", { profileId });
    const { id, ...copiedData } = income; // id 제거
    setEditingIncome(null);
    setInitialIncomeData(copiedData); // 복사된 데이터를 initialData로 설정
    setIsIncomeModalOpen(true);
  };

  const handleSaveIncome = async (incomeData) => {
    try {
      if (editingIncome) {
        // 수정 모드: 각 시뮬레이션에서 ID 존재 여부 확인 후 업데이트 또는 생성
        trackEvent("소득 수정", {
          profileId,
          simulationId: activeSimulationId,
          incomeId: editingIncome.id,
        });
        const targetSimIds = incomeData.selectedSimulationIds?.length
          ? incomeData.selectedSimulationIds
          : [activeSimulationId];

        // 각 시뮬레이션에서 해당 ID가 존재하는지 확인
        const checkPromises = targetSimIds.map(async (simId) => {
          try {
            const items = await incomeService.getIncomes(profileId, simId);
            const exists = items.some((item) => item.id === editingIncome.id);
            return { simId, exists };
          } catch (error) {
            return { simId, exists: false };
          }
        });
        const checkResults = await Promise.all(checkPromises);

        // 존재하는 시뮬레이션은 업데이트, 없는 시뮬레이션은 생성
        const updatePromises = checkResults.map(({ simId, exists }) => {
          if (exists) {
            return incomeService.updateIncome(
              profileId,
              simId,
              editingIncome.id,
              incomeData
            );
          } else {
            return incomeService.createIncomeWithId(
              profileId,
              simId,
              editingIncome.id,
              incomeData
            );
          }
        });
        await Promise.all(updatePromises);

        // 현재 탭 상태만 즉시 반영
        if (targetSimIds.includes(activeSimulationId)) {
          setIncomes(
            incomes.map((income) =>
              income.id === editingIncome.id
                ? { ...income, ...incomeData }
                : income
            )
          );
        }
      } else {
        // 추가
        trackEvent("소득 추가", {
          profileId,
          simulationId: activeSimulationId,
        });
        const targetSimIds = incomeData.selectedSimulationIds?.length
          ? incomeData.selectedSimulationIds
          : [activeSimulationId];
        // 첫 번째 시뮬레이션에 생성하여 id 획득
        const primarySimId = targetSimIds[0];
        const newIncome = await incomeService.createIncome(
          profileId,
          primarySimId,
          incomeData
        );
        const newId = newIncome.id;
        // 나머지 시뮬레이션들에 동일 id로 생성
        await Promise.all(
          targetSimIds
            .filter((sid) => sid !== primarySimId)
            .map((sid) =>
              incomeService.createIncomeWithId(
                profileId,
                sid,
                newId,
                incomeData
              )
            )
        );
        if (primarySimId === activeSimulationId) {
          setIncomes([...incomes, newIncome]);
        }
      }

      setIsIncomeModalOpen(false);
    } catch (error) {
      console.error("소득 데이터 저장 오류:", error);
    }
  };

  const handleDeleteIncome = async (incomeId) => {
    if (!checkEditPermission("소득 삭제")) return;
    if (!window.confirm("이 소득 데이터를 삭제하시겠습니까?")) return;

    try {
      await incomeService.deleteIncome(profileId, activeSimulationId, incomeId);
      setIncomes(incomes.filter((income) => income.id !== incomeId));
    } catch (error) {
      console.error("소득 데이터 삭제 오류:", error);
    }
  };

  // 지출 핸들러들
  const handleAddExpense = () => {
    if (!checkEditPermission("지출 추가")) return;
    setEditingExpense(null);
    setInitialExpenseData(null); // initialData 초기화
    setIsExpenseModalOpen(true);
  };

  // 저축/투자 핸들러들
  const handleAddSaving = () => {
    if (!checkEditPermission("저축 추가")) return;
    setEditingSaving(null);
    setIsSavingModalOpen(true);
  };

  const handleEditExpense = (expense) => {
    if (!checkEditPermission("지출 수정")) return;
    setEditingExpense(expense);
    setInitialExpenseData(null); // initialData 초기화
    setIsExpenseModalOpen(true);
  };

  const handleCopyExpense = (expense) => {
    if (!checkEditPermission("지출 복사")) return;
    trackEvent("지출 복사", { profileId });
    const { id, ...copiedData } = expense; // id 제거
    setEditingExpense(null);
    setInitialExpenseData(copiedData); // 복사된 데이터를 initialData로 설정
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (expenseData) => {
    try {
      if (editingExpense) {
        // 수정 모드: 각 시뮬레이션에서 ID 존재 여부 확인 후 업데이트 또는 생성
        const targetSimIds = expenseData.selectedSimulationIds?.length
          ? expenseData.selectedSimulationIds
          : [activeSimulationId];

        // 각 시뮬레이션에서 해당 ID가 존재하는지 확인
        const checkPromises = targetSimIds.map(async (simId) => {
          try {
            const items = await expenseService.getExpenses(profileId, simId);
            const exists = items.some((item) => item.id === editingExpense.id);
            return { simId, exists };
          } catch (error) {
            return { simId, exists: false };
          }
        });
        const checkResults = await Promise.all(checkPromises);

        // 존재하는 시뮬레이션은 업데이트, 없는 시뮬레이션은 생성
        const updatePromises = checkResults.map(({ simId, exists }) => {
          if (exists) {
            return expenseService.updateExpense(
              profileId,
              simId,
              editingExpense.id,
              expenseData
            );
          } else {
            return expenseService.createExpenseWithId(
              profileId,
              simId,
              editingExpense.id,
              expenseData
            );
          }
        });
        await Promise.all(updatePromises);

        // 현재 탭 상태만 즉시 반영
        if (targetSimIds.includes(activeSimulationId)) {
          setExpenses(
            expenses.map((expense) =>
              expense.id === editingExpense.id
                ? { ...expense, ...expenseData }
                : expense
            )
          );
        }
      } else {
        // 추가
        const targetSimIds = expenseData.selectedSimulationIds?.length
          ? expenseData.selectedSimulationIds
          : [activeSimulationId];
        // 첫 번째 시뮬레이션에 생성하여 id 획득
        const primarySimId = targetSimIds[0];
        const newExpense = await expenseService.createExpense(
          profileId,
          primarySimId,
          expenseData
        );
        const newId = newExpense.id;
        // 나머지 시뮬레이션들에 동일 id로 생성
        await Promise.all(
          targetSimIds
            .filter((sid) => sid !== primarySimId)
            .map((sid) =>
              expenseService.createExpenseWithId(
                profileId,
                sid,
                newId,
                expenseData
              )
            )
        );
        if (primarySimId === activeSimulationId) {
          setExpenses([...expenses, newExpense]);
        }
      }

      setIsExpenseModalOpen(false);
    } catch (error) {
      console.error("지출 데이터 저장 오류:", error);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!checkEditPermission("지출 삭제")) return;
    if (!window.confirm("이 지출 데이터를 삭제하시겠습니까?")) return;

    try {
      await expenseService.deleteExpense(
        profileId,
        activeSimulationId,
        expenseId
      );
      setExpenses(expenses.filter((expense) => expense.id !== expenseId));
    } catch (error) {
      console.error("지출 데이터 삭제 오류:", error);
    }
  };

  // 저축/투자 저장 핸들러
  const handleSaveSaving = async (savingData) => {
    try {
      if (editingSaving) {
        // 수정 모드: 각 시뮬레이션에서 ID 존재 여부 확인 후 업데이트 또는 생성
        const targetSimIds = savingData.selectedSimulationIds?.length
          ? savingData.selectedSimulationIds
          : [activeSimulationId];

        // 각 시뮬레이션에서 해당 ID가 존재하는지 확인
        const checkPromises = targetSimIds.map(async (simId) => {
          try {
            const items = await savingsService.getSavings(profileId, simId);
            const exists = items.some((item) => item.id === editingSaving.id);
            return { simId, exists };
          } catch (error) {
            return { simId, exists: false };
          }
        });
        const checkResults = await Promise.all(checkPromises);

        // 존재하는 시뮬레이션은 업데이트, 없는 시뮬레이션은 생성
        const updatePromises = checkResults.map(({ simId, exists }) => {
          if (exists) {
            return savingsService.updateSaving(
              profileId,
              simId,
              editingSaving.id,
              savingData
            );
          } else {
            return savingsService.createSavingWithId(
              profileId,
              simId,
              editingSaving.id,
              savingData
            );
          }
        });
        await Promise.all(updatePromises);

        // 현재 탭 상태만 즉시 반영
        if (targetSimIds.includes(activeSimulationId)) {
          setSavings(
            savings.map((saving) =>
              saving.id === editingSaving.id
                ? { ...saving, ...savingData }
                : saving
            )
          );
        }
      } else {
        // 추가
        const targetSimIds = savingData.selectedSimulationIds?.length
          ? savingData.selectedSimulationIds
          : [activeSimulationId];
        // 첫 번째 시뮬레이션에 생성하여 id 획득
        const primarySimId = targetSimIds[0];
        const newSaving = await savingsService.createSaving(
          profileId,
          primarySimId,
          savingData
        );
        const newId = newSaving.id;
        // 나머지 시뮬레이션들에 동일 id로 생성
        await Promise.all(
          targetSimIds
            .filter((sid) => sid !== primarySimId)
            .map((sid) =>
              savingsService.createSavingWithId(
                profileId,
                sid,
                newId,
                savingData
              )
            )
        );
        if (primarySimId === activeSimulationId) {
          setSavings([...savings, newSaving]);
        }
      }

      setIsSavingModalOpen(false);
    } catch (error) {
      console.error("저축/투자 데이터 저장 오류:", error);
    }
  };

  // 저축/투자 수정 핸들러
  const handleEditSaving = (saving) => {
    if (!checkEditPermission("저축 수정")) return;
    setEditingSaving(saving);
    setIsSavingModalOpen(true);
  };

  const handleCopySaving = (saving) => {
    if (!checkEditPermission("저축 복사")) return;
    trackEvent("저축 복사", { profileId });
    const { id, ...copiedData } = saving; // id 제거
    setEditingSaving(null); // editing을 null로 설정 (추가 모드)
    setInitialSavingData(copiedData); // 복사된 데이터를 initialData로 설정
    setIsSavingModalOpen(true);
  };

  // 저축/투자 삭제 핸들러
  const handleDeleteSaving = async (savingId) => {
    if (!checkEditPermission("저축 삭제")) return;
    if (!window.confirm("이 저축/투자 데이터를 삭제하시겠습니까?")) return;

    try {
      await savingsService.deleteSaving(
        profileId,
        activeSimulationId,
        savingId
      );
      setSavings(savings.filter((saving) => saving.id !== savingId));
    } catch (error) {
      console.error("저축/투자 데이터 삭제 오류:", error);
    }
  };

  // 연금 핸들러들
  const handleAddPension = () => {
    if (!checkEditPermission("연금 추가")) return;
    setEditingPension(null);
    setIsPensionModalOpen(true);
  };

  const handleEditPension = (pension) => {
    if (!checkEditPermission("연금 수정")) return;
    setEditingPension(pension);
    setIsPensionModalOpen(true);
  };

  const handleCopyPension = (pension) => {
    if (!checkEditPermission("연금 복사")) return;
    trackEvent("연금 복사", { profileId });
    const { id, ...copiedData } = pension; // id 제거
    setEditingPension(null); // editing을 null로 설정 (추가 모드)
    setInitialPensionData(copiedData); // 복사된 데이터를 initialData로 설정
    setIsPensionModalOpen(true);
  };

  const handleSavePension = async (pensionData) => {
    try {
      if (editingPension) {
        // 수정 모드: 각 시뮬레이션에서 ID 존재 여부 확인 후 업데이트 또는 생성
        const targetSimIds = pensionData.selectedSimulationIds?.length
          ? pensionData.selectedSimulationIds
          : [activeSimulationId];

        // 각 시뮬레이션에서 해당 ID가 존재하는지 확인
        const checkPromises = targetSimIds.map(async (simId) => {
          try {
            const items = await pensionService.getPensions(profileId, simId);
            const exists = items.some((item) => item.id === editingPension.id);
            return { simId, exists };
          } catch (error) {
            return { simId, exists: false };
          }
        });
        const checkResults = await Promise.all(checkPromises);

        // 존재하는 시뮬레이션은 업데이트, 없는 시뮬레이션은 생성
        const updatePromises = checkResults.map(({ simId, exists }) => {
          if (exists) {
            return pensionService.updatePension(
              profileId,
              simId,
              editingPension.id,
              pensionData
            );
          } else {
            return pensionService.createPensionWithId(
              profileId,
              simId,
              editingPension.id,
              pensionData
            );
          }
        });
        await Promise.all(updatePromises);

        // 현재 탭 상태만 즉시 반영
        if (targetSimIds.includes(activeSimulationId)) {
          setPensions(
            pensions.map((pension) =>
              pension.id === editingPension.id
                ? { ...pension, ...pensionData }
                : pension
            )
          );
        }
      } else {
        // 추가
        const targetSimIds = pensionData.selectedSimulationIds?.length
          ? pensionData.selectedSimulationIds
          : [activeSimulationId];
        // 첫 번째 시뮬레이션에 생성하여 id 획득
        const primarySimId = targetSimIds[0];
        const pensionId = await pensionService.createPension(
          profileId,
          primarySimId,
          pensionData
        );
        // 나머지 시뮬레이션들에 동일 id로 생성
        await Promise.all(
          targetSimIds
            .filter((sid) => sid !== primarySimId)
            .map((sid) =>
              pensionService.createPensionWithId(
                profileId,
                sid,
                pensionId,
                pensionData
              )
            )
        );
        if (primarySimId === activeSimulationId) {
          setPensions([...pensions, { id: pensionId, ...pensionData }]);
        }
      }

      setEditingPension(null);
      setIsPensionModalOpen(false);
    } catch (error) {
      console.error("연금 데이터 저장 오류:", error);
    }
  };

  const handleDeletePension = async (pensionId) => {
    if (!checkEditPermission("연금 삭제")) return;
    if (!window.confirm("이 연금 데이터를 삭제하시겠습니까?")) return;

    try {
      await pensionService.deletePension(
        profileId,
        activeSimulationId,
        pensionId
      );
      setPensions(pensions.filter((pension) => pension.id !== pensionId));
    } catch (error) {
      console.error("연금 데이터 삭제 오류:", error);
    }
  };

  // 부동산 핸들러들
  const handleAddRealEstate = () => {
    if (!checkEditPermission("부동산 추가")) return;
    setEditingRealEstate(null);
    setIsRealEstateModalOpen(true);
  };

  const handleEditRealEstate = (realEstate) => {
    if (!checkEditPermission("부동산 수정")) return;
    setEditingRealEstate(realEstate);
    setIsRealEstateModalOpen(true);
  };

  const handleCopyRealEstate = (realEstate) => {
    if (!checkEditPermission("부동산 복사")) return;
    trackEvent("부동산 복사", { profileId });
    const { id, ...copiedData } = realEstate; // id 제거
    setEditingRealEstate(null); // editing을 null로 설정 (추가 모드)
    setInitialRealEstateData(copiedData); // 복사된 데이터를 initialData로 설정
    setIsRealEstateModalOpen(true);
  };

  const handleSaveRealEstate = async (realEstateData) => {
    try {
      if (editingRealEstate) {
        // 수정 모드: 각 시뮬레이션에서 ID 존재 여부 확인 후 업데이트 또는 생성
        const targetSimIds = realEstateData.selectedSimulationIds?.length
          ? realEstateData.selectedSimulationIds
          : [activeSimulationId];

        // 각 시뮬레이션에서 해당 ID가 존재하는지 확인
        const checkPromises = targetSimIds.map(async (simId) => {
          try {
            const items = await realEstateService.getRealEstates(
              profileId,
              simId
            );
            const exists = items.some(
              (item) => item.id === editingRealEstate.id
            );
            return { simId, exists };
          } catch (error) {
            return { simId, exists: false };
          }
        });
        const checkResults = await Promise.all(checkPromises);

        // 존재하는 시뮬레이션은 업데이트, 없는 시뮬레이션은 생성
        const updatePromises = checkResults.map(({ simId, exists }) => {
          if (exists) {
            return realEstateService.updateRealEstate(
              profileId,
              simId,
              editingRealEstate.id,
              realEstateData
            );
          } else {
            return realEstateService.createRealEstateWithId(
              profileId,
              simId,
              editingRealEstate.id,
              realEstateData
            );
          }
        });
        await Promise.all(updatePromises);

        // 현재 탭 상태만 즉시 반영
        if (targetSimIds.includes(activeSimulationId)) {
          setRealEstates(
            realEstates.map((realEstate) =>
              realEstate.id === editingRealEstate.id
                ? { ...realEstate, ...realEstateData }
                : realEstate
            )
          );
        }
      } else {
        // 추가
        const targetSimIds = realEstateData.selectedSimulationIds?.length
          ? realEstateData.selectedSimulationIds
          : [activeSimulationId];
        // 첫 번째 시뮬레이션에 생성하여 id 획득
        const primarySimId = targetSimIds[0];
        const newRealEstateId = await realEstateService.createRealEstate(
          profileId,
          primarySimId,
          realEstateData
        );
        // 나머지 시뮬레이션들에 동일 id로 생성
        await Promise.all(
          targetSimIds
            .filter((sid) => sid !== primarySimId)
            .map((sid) =>
              realEstateService.createRealEstateWithId(
                profileId,
                sid,
                newRealEstateId,
                realEstateData
              )
            )
        );
        if (primarySimId === activeSimulationId) {
          setRealEstates([
            ...realEstates,
            { id: newRealEstateId, ...realEstateData },
          ]);
        }
      }

      setIsRealEstateModalOpen(false);
    } catch (error) {
      console.error("부동산 데이터 저장 오류:", error);
    }
  };

  const handleDeleteRealEstate = async (realEstateId) => {
    if (!checkEditPermission("부동산 삭제")) return;
    if (!window.confirm("이 부동산 데이터를 삭제하시겠습니까?")) return;

    try {
      await realEstateService.deleteRealEstate(
        profileId,
        activeSimulationId,
        realEstateId
      );
      setRealEstates(
        realEstates.filter((realEstate) => realEstate.id !== realEstateId)
      );
    } catch (error) {
      console.error("부동산 데이터 삭제 오류:", error);
    }
  };

  // 자산 관련 핸들러들
  const handleAddAsset = () => {
    if (!checkEditPermission("자산 추가")) return;
    setEditingAsset(null);
    setIsAssetModalOpen(true);
  };

  const handleEditAsset = (asset) => {
    if (!checkEditPermission("자산 수정")) return;
    setEditingAsset(asset);
    setIsAssetModalOpen(true);
  };

  const handleCopyAsset = (asset) => {
    if (!checkEditPermission("자산 복사")) return;
    trackEvent("자산 복사", { profileId });
    const { id, ...copiedData } = asset; // id 제거
    setEditingAsset(null); // editing을 null로 설정 (추가 모드)
    setInitialAssetData(copiedData); // 복사된 데이터를 initialData로 설정
    setIsAssetModalOpen(true);
  };

  const handleSaveAsset = async (assetData) => {
    try {
      if (editingAsset) {
        // 수정 모드: 각 시뮬레이션에서 ID 존재 여부 확인 후 업데이트 또는 생성
        const targetSimIds = assetData.selectedSimulationIds?.length
          ? assetData.selectedSimulationIds
          : [activeSimulationId];

        // 각 시뮬레이션에서 해당 ID가 존재하는지 확인
        const checkPromises = targetSimIds.map(async (simId) => {
          try {
            const items = await assetService.getAssets(profileId, simId);
            const exists = items.some((item) => item.id === editingAsset.id);
            return { simId, exists };
          } catch (error) {
            return { simId, exists: false };
          }
        });
        const checkResults = await Promise.all(checkPromises);

        // 존재하는 시뮬레이션은 업데이트, 없는 시뮬레이션은 생성
        const updatePromises = checkResults.map(({ simId, exists }) => {
          if (exists) {
            return assetService.updateAsset(
              profileId,
              simId,
              editingAsset.id,
              assetData
            );
          } else {
            return assetService.createAssetWithId(
              profileId,
              simId,
              editingAsset.id,
              assetData
            );
          }
        });
        await Promise.all(updatePromises);

        if (targetSimIds.includes(activeSimulationId)) {
          setAssets(
            assets.map((asset) =>
              asset.id === editingAsset.id ? { ...asset, ...assetData } : asset
            )
          );
        }
      } else {
        const targetSimIds = assetData.selectedSimulationIds?.length
          ? assetData.selectedSimulationIds
          : [activeSimulationId];
        const primarySimId = targetSimIds[0];
        const newAssetId = await assetService.createAsset(
          profileId,
          primarySimId,
          assetData
        );
        await Promise.all(
          targetSimIds
            .filter((sid) => sid !== primarySimId)
            .map((sid) =>
              assetService.createAssetWithId(
                profileId,
                sid,
                newAssetId,
                assetData
              )
            )
        );
        if (primarySimId === activeSimulationId) {
          setAssets([...assets, { id: newAssetId, ...assetData }]);
        }
      }

      setIsAssetModalOpen(false);
    } catch (error) {
      console.error("자산 데이터 저장 오류:", error);
    }
  };

  const handleDeleteAsset = async (assetId) => {
    if (!checkEditPermission("자산 삭제")) return;
    if (!window.confirm("이 자산 데이터를 삭제하시겠습니까?")) return;

    try {
      await assetService.deleteAsset(profileId, activeSimulationId, assetId);
      setAssets(assets.filter((asset) => asset.id !== assetId));
    } catch (error) {
      console.error("자산 데이터 삭제 오류:", error);
    }
  };

  // 부채 핸들러들
  const handleAddDebt = () => {
    if (!checkEditPermission("부채 추가")) return;
    setEditingDebt(null);
    setIsDebtModalOpen(true);
  };

  const handleEditDebt = (debt) => {
    if (!checkEditPermission("부채 수정")) return;
    setEditingDebt(debt);
    setIsDebtModalOpen(true);
  };

  const handleCopyDebt = (debt) => {
    if (!checkEditPermission("부채 복사")) return;
    trackEvent("부채 복사", { profileId });
    const { id, ...copiedData } = debt; // id 제거
    setEditingDebt(null); // editing을 null로 설정 (추가 모드)
    setInitialDebtData(copiedData); // 복사된 데이터를 initialData로 설정
    setIsDebtModalOpen(true);
  };

  const handleSaveDebt = async (debtData) => {
    try {
      if (editingDebt) {
        // 수정 모드: 각 시뮬레이션에서 ID 존재 여부 확인 후 업데이트 또는 생성
        const targetSimIds = debtData.selectedSimulationIds?.length
          ? debtData.selectedSimulationIds
          : [activeSimulationId];

        // 각 시뮬레이션에서 해당 ID가 존재하는지 확인
        const checkPromises = targetSimIds.map(async (simId) => {
          try {
            const items = await debtService.getDebts(profileId, simId);
            const exists = items.some((item) => item.id === editingDebt.id);
            return { simId, exists };
          } catch (error) {
            return { simId, exists: false };
          }
        });
        const checkResults = await Promise.all(checkPromises);

        // 존재하는 시뮬레이션은 업데이트, 없는 시뮬레이션은 생성
        const updatePromises = checkResults.map(({ simId, exists }) => {
          if (exists) {
            return debtService.updateDebt(
              profileId,
              simId,
              editingDebt.id,
              debtData
            );
          } else {
            return debtService.createDebtWithId(
              profileId,
              simId,
              editingDebt.id,
              debtData
            );
          }
        });
        await Promise.all(updatePromises);

        if (targetSimIds.includes(activeSimulationId)) {
          setDebts(
            debts.map((debt) =>
              debt.id === editingDebt.id ? { ...debt, ...debtData } : debt
            )
          );
        }
        setEditingDebt(null);
      } else {
        // 추가
        const targetSimIds = debtData.selectedSimulationIds?.length
          ? debtData.selectedSimulationIds
          : [activeSimulationId];
        const primarySimId = targetSimIds[0];
        const newDebt = await debtService.createDebt(
          profileId,
          primarySimId,
          debtData
        );
        const newId = newDebt.id;
        await Promise.all(
          targetSimIds
            .filter((sid) => sid !== primarySimId)
            .map((sid) =>
              debtService.createDebtWithId(profileId, sid, newId, debtData)
            )
        );
        if (primarySimId === activeSimulationId) {
          setDebts([...debts, newDebt]);
        }
      }

      setIsDebtModalOpen(false);
    } catch (error) {
      console.error("부채 데이터 저장 오류:", error);
    }
  };

  const handleDeleteDebt = async (debtId) => {
    if (!checkEditPermission("부채 삭제")) return;
    if (!window.confirm("이 부채 데이터를 삭제하시겠습니까?")) return;

    try {
      await debtService.deleteDebt(profileId, activeSimulationId, debtId);
      setDebts(debts.filter((debt) => debt.id !== debtId));
    } catch (error) {
      console.error("부채 데이터 삭제 오류:", error);
    }
  };

  // 카테고리별 추가 핸들러
  const handleAddData = () => {
    switch (selectedCategory) {
      case "income":
        handleAddIncome();
        break;
      case "expense":
        handleAddExpense();
        break;
      case "savings":
        handleAddSaving();
        break;
      case "pension":
        handleAddPension();
        break;
      case "realEstate":
        handleAddRealEstate();
        break;
      case "assets":
        handleAddAsset();
        break;
      case "debt":
        handleAddDebt();
        break;
      default:
        break;
    }
  };

  const handleProfileSummaryItemClick = (type, item) => {
    switch (type) {
      case "income":
        handleEditIncome(item);
        break;
      case "expense":
        handleEditExpense(item);
        break;
      case "saving":
        handleEditSaving(item);
        break;
      case "pension":
        handleEditPension(item);
        break;
      case "realEstate":
        handleEditRealEstate(item);
        break;
      case "asset":
        handleEditAsset(item);
        break;
      case "debt":
        handleEditDebt(item);
        break;
      default:
        break;
    }
  };

  // ProfileSummary에서 항목 삭제 시 해당 삭제 핸들러 호출
  const handleProfileSummaryDelete = (type, itemId) => {
    switch (type) {
      case "income":
        handleDeleteIncome(itemId);
        break;
      case "expense":
        handleDeleteExpense(itemId);
        break;
      case "saving":
        handleDeleteSaving(itemId);
        break;
      case "pension":
        handleDeletePension(itemId);
        break;
      case "realEstate":
        handleDeleteRealEstate(itemId);
        break;
      case "asset":
        handleDeleteAsset(itemId);
        break;
      case "debt":
        handleDeleteDebt(itemId);
        break;
      default:
        break;
    }
  };

  // 시뮬레이션 관련 핸들러들
  const handleSaveSimulationMemo = useCallback(
    async (nextMemo) => {
      if (!checkEditPermission("시뮬레이션 메모 저장")) return;
      if (!profileId || !activeSimulationId) return;
      if ((simulationMemo || "") === nextMemo) return;

      try {
        setIsMemoSaving(true);
        trackEvent("시뮬레이션 메모 저장", {
          profileId,
          simulationId: activeSimulationId,
          memoLength: nextMemo.length,
        });
        await simulationService.updateSimulation(
          profileId,
          activeSimulationId,
          {
            memo: nextMemo,
          }
        );
        setSimulationMemo(nextMemo);
        setSimulations((prev) =>
          prev.map((sim) =>
            sim.id === activeSimulationId ? { ...sim, memo: nextMemo } : sim
          )
        );
      } catch (error) {
        console.error("시뮬레이션 메모 저장 오류:", error);
      } finally {
        setIsMemoSaving(false);
      }
    },
    [profileId, activeSimulationId, simulationMemo]
  );

  const handleSimulationTabChange = (simulationId) => {
    const selectedSimulation = simulations.find((s) => s.id === simulationId);
    setActiveSimulationId(simulationId);

    // 시뮬레이션의 retirementYear를 프로필의 retirementAge로 변환하여 업데이트
    if (selectedSimulation && selectedSimulation.retirementYear) {
      const retirementYear = parseInt(selectedSimulation.retirementYear);

      // 함수형 업데이트를 사용하여 최신 profileData 사용
      setProfileData((prevProfileData) => {
        if (!prevProfileData) return prevProfileData;

        const birthYear = parseInt(prevProfileData.birthYear);
        const retirementAge = retirementYear - birthYear;

        return {
          ...prevProfileData,
          retirementAge: retirementAge,
        };
      });
    }

    // Mixpanel: 시뮬레이션 전환 이벤트
    if (selectedSimulation) {
      trackEvent("시뮬레이션 전환", {
        profileId,
        profileName: profileData?.name,
        fromSimulation:
          simulations.find((s) => s.id === activeSimulationId)?.title || "없음",
        toSimulation: selectedSimulation.title,
        toSimulationId: simulationId,
        isDefault: selectedSimulation.isDefault || false,
      });
    }
  };

  const openProfilePanel = (tab) => {
    // 권한이 없으면 회원가입 유도
    if (!hasEditPermission) {
      trackEvent("메모/체크리스트 접근 시도 (권한 없음)", {
        profileId,
        tab: tab,
      });
      if (
        confirm(
          `${
            tab === "memo" ? "프로필 메모" : "상담 체크리스트"
          }를 수정하려면 회원가입이 필요합니다. 회원가입 페이지로 이동하시겠습니까?`
        )
      ) {
        trackEvent("회원가입 페이지로 이동", {
          profileId,
          source: "메모/체크리스트",
        });
        navigate(`/signup?profileId=${profileId}`);
      }
      return;
    }
    trackEvent("프로필 패널 열기", {
      profileId,
      tab: tab,
    });
    setProfilePanelTab(tab);
    setIsProfilePanelOpen(true);
  };

  const closeProfilePanel = () => setIsProfilePanelOpen(false);

  const openDataStorePanel = () => {
    // 권한이 없으면 회원가입 유도
    if (!hasEditPermission) {
      trackEvent("재무 라이브러리 접근 시도 (권한 없음)", {
        profileId,
      });
      if (
        confirm(
          "재무 라이브러리를 사용하려면 회원가입이 필요합니다. 회원가입 페이지로 이동하시겠습니까?"
        )
      ) {
        trackEvent("회원가입 페이지로 이동", {
          profileId,
          source: "재무 라이브러리",
        });
        navigate(`/signup?profileId=${profileId}`);
      }
      return;
    }
    trackEvent("재무 라이브러리 열기", {
      profileId,
    });
    setIsDataStorePanelOpen(true);
  };

  const closeDataStorePanel = () => setIsDataStorePanelOpen(false);

  useEffect(() => {
    if (!isProfilePanelOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeProfilePanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProfilePanelOpen]);

  useEffect(() => {
    if (!isDataStorePanelOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeDataStorePanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDataStorePanelOpen]);

  // AI 옵션 모달 ESC 키로 닫기
  useEffect(() => {
    if (!isAIOptionModalOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsAIOptionModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAIOptionModalOpen]);

  // 재무 라이브러리에서 템플릿 선택 시 처리
  const handleSelectTemplate = (templateData) => {
    const { category } = templateData;

    // 카테고리에 따라 적절한 모달 열기
    // 각 카테고리에서 editing 상태를 초기화하여 이전 수정 데이터가 남아있지 않도록 함
    if (category === "income") {
      setEditingIncome(null);
      setInitialIncomeData(templateData);
      setIsIncomeModalOpen(true);
    } else if (category === "expense") {
      setEditingExpense(null);
      setInitialExpenseData(templateData);
      setIsExpenseModalOpen(true);
    } else if (category === "saving") {
      setEditingSaving(null);
      setInitialSavingData(templateData);
      setIsSavingModalOpen(true);
    } else if (category === "pension") {
      setEditingPension(null);
      setInitialPensionData(templateData);
      setIsPensionModalOpen(true);
    }
  };

  // 재무 라이브러리에서 선택한 항목들 추가 (구버전, 호환성 유지)
  const handleAddDataStoreItems = async (items) => {
    if (!checkEditPermission("재무 데이터 추가")) return;
    if (!profileId || !activeSimulationId) return;

    try {
      for (const item of items) {
        const { category, ...itemData } = item;

        // 현재 연도와 은퇴년도 계산
        const currentYear = new Date().getFullYear();
        let retirementYear = currentYear + 10;
        if (profileData && profileData.birthYear && profileData.retirementAge) {
          const birth = parseInt(profileData.birthYear, 10);
          const retireAge = parseInt(profileData.retirementAge, 10);
          if (Number.isFinite(birth) && Number.isFinite(retireAge)) {
            const currentAge = calculateKoreanAge(birth, currentYear);
            const yearsToRetire = retireAge - currentAge;
            retirementYear =
              currentYear +
              (Number.isFinite(yearsToRetire) ? yearsToRetire : 10);
          }
        }

        // 카테고리별 필수 필드 보완
        let itemWithDefaults = {
          ...itemData,
          startYear: itemData.startYear || currentYear,
          endYear:
            itemData.endYear ||
            (category === "expense" ||
            category === "income" ||
            category === "saving"
              ? retirementYear
              : currentYear + 30),
        };

        // 카테고리별 추가 필드 설정
        if (category === "income" || category === "expense") {
          itemWithDefaults = {
            ...itemWithDefaults,
            amount: itemData.amount || 0,
            originalAmount: itemData.originalAmount || itemData.amount || 0,
            originalFrequency:
              itemData.originalFrequency || itemData.frequency || "monthly",
            growthRate: itemData.growthRate || 0,
            isFixedToRetirementYear: itemData.isFixedToRetirementYear || false,
          };
        } else if (category === "saving") {
          itemWithDefaults = {
            ...itemWithDefaults,
            amount: itemData.amount || 0,
            originalAmount: itemData.originalAmount || itemData.amount || 0,
            originalFrequency:
              itemData.originalFrequency || itemData.frequency || "monthly",
            interestRate: itemData.interestRate || 0,
            yearlyGrowthRate: itemData.yearlyGrowthRate || 0,
            currentAmount: itemData.currentAmount || 0,
            isFixedToRetirementYear: itemData.isFixedToRetirementYear || false,
          };
        } else if (category === "pension") {
          itemWithDefaults = {
            ...itemWithDefaults,
            type: itemData.type || "national",
            monthlyAmount: itemData.monthlyAmount || 0,
            inflationRate: itemData.inflationRate || 1.89,
          };
        }

        switch (category) {
          case "income":
            await incomeService.createIncome(
              profileId,
              activeSimulationId,
              itemWithDefaults
            );
            break;
          case "expense":
            await expenseService.createExpense(
              profileId,
              activeSimulationId,
              itemWithDefaults
            );
            break;
          case "saving":
            await savingsService.createSaving(
              profileId,
              activeSimulationId,
              itemWithDefaults
            );
            break;
          case "pension":
            // 연금 데이터 형식 변환
            const pensionData = {
              ...itemWithDefaults,
              title: itemData.title || itemWithDefaults.title,
              monthlyAmount: itemWithDefaults.monthlyAmount || 0,
              startYear: itemWithDefaults.startYear || currentYear,
              endYear: itemWithDefaults.endYear || currentYear + 30,
              inflationRate: itemWithDefaults.inflationRate || 1.89,
              memo: itemWithDefaults.memo || "",
            };
            await pensionService.createPension(
              profileId,
              activeSimulationId,
              pensionData
            );
            break;
          default:
            console.warn(`Unknown category: ${category}`);
        }
      }

      // 데이터 다시 로드
      await fetchSimulationFinancialData(activeSimulationId);

      // 패널 닫기
      closeDataStorePanel();

      trackEvent("재무 라이브러리 항목 추가", {
        profileId,
        itemCount: items.length,
      });
    } catch (error) {
      console.error("재무 라이브러리 항목 추가 오류:", error);
      alert("항목 추가 중 오류가 발생했습니다.");
    }
  };

  const handleSaveProfileMemo = async (memoValue) => {
    if (!checkEditPermission("프로필 메모 저장")) return;
    if (!profileId) return;
    if ((profileMemo || "") === memoValue) return;

    try {
      setIsProfileMemoSaving(true);
      trackEvent("프로필 메모 저장", {
        profileId,
        memoLength: memoValue.length,
      });
      await profileService.updateProfile(profileId, {
        memo: memoValue,
      });
      setProfileMemo(memoValue);
      setProfileData((prev) => (prev ? { ...prev, memo: memoValue } : prev));
    } catch (error) {
      console.error("프로필 메모 저장 오류:", error);
      alert("프로필 메모 저장 중 오류가 발생했습니다.");
    } finally {
      setIsProfileMemoSaving(false);
    }
  };

  const handleChecklistItemsChange = useCallback(
    async (nextItems, { persist }) => {
      // persist가 false면 로컬 상태만 업데이트 (권한 확인 안 함)
      if (persist && !checkEditPermission("상담 체크리스트 저장")) {
        return;
      }

      setProfileChecklist((prev) => {
        if (prev) {
          return { ...prev, items: nextItems };
        }
        if (checklistIdRef.current) {
          return {
            id: checklistIdRef.current,
            title: "체크리스트",
            items: nextItems,
          };
        }
        return prev;
      });

      if (persist && profileId) {
        try {
          setIsChecklistSaving(true);
          trackEvent("상담 체크리스트 저장", {
            profileId,
            itemCount: nextItems.length,
            isNew: !checklistIdRef.current,
          });
          if (!checklistIdRef.current) {
            const created = await checklistService.createChecklist(profileId, {
              title: "체크리스트",
              items: nextItems,
            });
            checklistIdRef.current = created.id;
            setProfileChecklist((prev) => ({
              id: created.id,
              title: created.title || "체크리스트",
              items: nextItems,
            }));
          } else {
            await checklistService.updateChecklist(
              profileId,
              checklistIdRef.current,
              {
                items: nextItems,
              }
            );
          }
        } catch (error) {
          console.error("체크리스트 저장 오류:", error);
          alert("체크리스트 저장 중 오류가 발생했습니다.");
        } finally {
          setIsChecklistSaving(false);
        }
      }
    },
    [profileId, checkEditPermission]
  );

  const handleOpenCompareModal = async () => {
    if (!defaultSimulationEntry) {
      alert("기본 시뮬레이션을 찾을 수 없습니다.");
      return;
    }
    if (!activeSimulationId) {
      alert("비교할 시뮬레이션을 선택하세요.");
      return;
    }

    // 현재 시뮬레이션이 기본 시뮬레이션과 같을 때는 기본 시뮬레이션만 표시
    const isCurrentSimulation =
      defaultSimulationEntry.id === activeSimulationId;

    setIsCompareModalOpen(true);
    setIsCompareLoading(true);
    try {
      if (isCurrentSimulation) {
        // 현재 시뮬레이션만 보이도록 기본 시뮬레이션 데이터만 로드
        const defaultData = await fetchSimulationFinancialData(
          defaultSimulationEntry.id
        );
        setComparisonData({
          defaultData,
          targetData: null, // null로 설정하여 비교하지 않음
          defaultTitle: defaultSimulationEntry.title || "현재",
          targetTitle: null,
          defaultSimulationId: defaultSimulationEntry.id, // 시뮬레이션 ID 추가
          targetSimulationId: null,
        });
      } else {
        // 기존처럼 두 시뮬레이션 비교
        const [defaultData, targetData] = await Promise.all([
          fetchSimulationFinancialData(defaultSimulationEntry.id),
          fetchSimulationFinancialData(activeSimulationId),
        ]);

        const targetSimulation =
          simulations.find((sim) => sim.id === activeSimulationId) || {};

        setComparisonData({
          defaultData,
          targetData,
          defaultTitle: defaultSimulationEntry.title || "현재",
          targetTitle: targetSimulation.title || "선택된 시뮬레이션",
          defaultSimulationId: defaultSimulationEntry.id, // 시뮬레이션 ID 추가
          targetSimulationId: activeSimulationId, // 시뮬레이션 ID 추가
        });
      }
    } catch (error) {
      console.error("시뮬레이션 비교 데이터 로드 오류:", error);
      alert("시뮬레이션 비교 데이터를 불러오지 못했습니다.");
      setComparisonData({
        defaultData: null,
        targetData: null,
        defaultTitle: "",
        targetTitle: "",
        defaultSimulationId: null,
        targetSimulationId: null,
      });
    } finally {
      setIsCompareLoading(false);
    }
  };

  // 시뮬레이션 비교 데이터 새로고침 함수
  const handleRefreshComparisonData = async () => {
    if (!defaultSimulationEntry) return;

    setIsCompareLoading(true);
    try {
      const isCurrentSimulation =
        defaultSimulationEntry.id === activeSimulationId;

      if (isCurrentSimulation) {
        // 현재 시뮬레이션만 보이도록 기본 시뮬레이션 데이터만 로드
        const defaultData = await fetchSimulationFinancialData(
          defaultSimulationEntry.id
        );
        setComparisonData({
          defaultData,
          targetData: null,
          defaultTitle: defaultSimulationEntry.title || "현재",
          targetTitle: null,
          defaultSimulationId: defaultSimulationEntry.id,
          targetSimulationId: null,
        });
      } else {
        // 두 시뮬레이션 비교
        const [defaultData, targetData] = await Promise.all([
          fetchSimulationFinancialData(defaultSimulationEntry.id),
          fetchSimulationFinancialData(activeSimulationId),
        ]);

        const targetSimulation =
          simulations.find((sim) => sim.id === activeSimulationId) || {};

        setComparisonData({
          defaultData,
          targetData,
          defaultTitle: defaultSimulationEntry.title || "현재",
          targetTitle: targetSimulation.title || "선택된 시뮬레이션",
          defaultSimulationId: defaultSimulationEntry.id,
          targetSimulationId: activeSimulationId,
        });
      }

      // 대시보드의 재무 리스트도 업데이트 (비교 모달에서 수정한 내용 반영)
      // 현재 활성 시뮬레이션의 재무 데이터를 다시 로드
      const activeData = await fetchSimulationFinancialData(activeSimulationId);
      if (activeData) {
        setIncomes(activeData.incomes || []);
        setExpenses(activeData.expenses || []);
        setSavings(activeData.savings || []);
        setPensions(activeData.pensions || []);
        setRealEstates(activeData.realEstates || []);
        setAssets(activeData.assets || []);
        setDebts(activeData.debts || []);
      }
    } catch (error) {
      console.error("시뮬레이션 비교 데이터 새로고침 오류:", error);
    } finally {
      setIsCompareLoading(false);
    }
  };

  const handleAddSimulation = async () => {
    if (!checkEditPermission("시뮬레이션 추가")) return;
    try {
      // 기본 시뮬레이션(현재) 찾기
      const defaultSimulation = simulations.find(
        (sim) => sim.isDefault === true
      );
      if (!defaultSimulation) {
        alert("기본 시뮬레이션을 찾을 수 없습니다.");
        return;
      }

      // 시뮬레이션 개수에 따라 자동으로 제목 생성 (시뮬레이션 2, 시뮬레이션 3, ...)
      const simulationNumber = simulations.length;
      const title = `시뮬레이션 ${simulationNumber}`;

      // 기본 시뮬레이션의 데이터를 복사하여 새 시뮬레이션 생성
      const newSimulationId = await simulationService.copySimulation(
        profileId,
        defaultSimulation.id,
        title
      );

      // 시뮬레이션 목록 다시 로드
      const updatedSimulations = await simulationService.getSimulations(
        profileId
      );
      setSimulations(updatedSimulations);

      // 새로 생성한 시뮬레이션으로 전환
      setActiveSimulationId(newSimulationId);
    } catch (error) {
      console.error("시뮬레이션 생성 오류:", error);
      alert("시뮬레이션 생성 중 오류가 발생했습니다: " + error.message);
    }
  };

  // 시뮬레이션 복제 핸들러 (우클릭 컨텍스트 메뉴에서 호출)
  const handleCopySimulation = async (sourceSimulationId) => {
    if (!checkEditPermission("시뮬레이션 복제")) return;
    try {
      // 복제할 시뮬레이션 찾기
      const sourceSimulation = simulations.find(
        (sim) => sim.id === sourceSimulationId
      );
      if (!sourceSimulation) {
        alert("복제할 시뮬레이션을 찾을 수 없습니다.");
        return;
      }

      // 시뮬레이션 개수에 따라 자동으로 제목 생성
      const simulationNumber = simulations.length;
      const title = `${sourceSimulation.title} 복사본`;

      // 선택된 시뮬레이션의 데이터를 복사하여 새 시뮬레이션 생성
      const newSimulationId = await simulationService.copySimulation(
        profileId,
        sourceSimulationId,
        title
      );

      // 시뮬레이션 목록 다시 로드
      const updatedSimulations = await simulationService.getSimulations(
        profileId
      );
      setSimulations(updatedSimulations);

      // 새로 생성한 시뮬레이션으로 전환
      setActiveSimulationId(newSimulationId);

      // Mixpanel 트래킹
      if (window.mixpanel) {
        window.mixpanel.track("시뮬레이션 복제", {
          sourceSimulationId: sourceSimulationId,
          sourceSimulationTitle: sourceSimulation.title,
          newSimulationId: newSimulationId,
        });
      }
    } catch (error) {
      console.error("시뮬레이션 복제 오류:", error);
      alert("시뮬레이션 복제 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleCreateSimulation = async (title) => {
    try {
      setIsCreatingSimulation(true);

      // 기본 시뮬레이션(현재) 찾기
      const defaultSimulation = simulations.find(
        (sim) => sim.isDefault === true
      );
      if (!defaultSimulation) {
        alert("기본 시뮬레이션을 찾을 수 없습니다.");
        return;
      }

      // 기본 시뮬레이션의 데이터를 복사하여 새 시뮬레이션 생성
      const newSimulationId = await simulationService.copySimulation(
        profileId,
        defaultSimulation.id,
        title
      );

      // 시뮬레이션 목록 다시 로드
      const updatedSimulations = await simulationService.getSimulations(
        profileId
      );
      setSimulations(updatedSimulations);

      // 새로 생성한 시뮬레이션으로 전환
      setActiveSimulationId(newSimulationId);

      alert(`"${title}" 시뮬레이션이 생성되었습니다!`);
    } catch (error) {
      console.error("시뮬레이션 생성 오류:", error);
      alert("시뮬레이션 생성 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleDeleteSimulation = async (simulationId) => {
    if (!checkEditPermission("시뮬레이션 삭제")) return;
    try {
      await simulationService.deleteSimulation(profileId, simulationId);

      // 시뮬레이션 목록 다시 로드
      const updatedSimulations = await simulationService.getSimulations(
        profileId
      );
      setSimulations(updatedSimulations);

      // 삭제한 시뮬레이션이 현재 활성화된 것이면 기본 시뮬레이션으로 전환
      if (activeSimulationId === simulationId) {
        const defaultSim = updatedSimulations.find(
          (sim) => sim.isDefault === true
        );
        if (defaultSim) {
          setActiveSimulationId(defaultSim.id);
        } else if (updatedSimulations.length > 0) {
          setActiveSimulationId(updatedSimulations[0].id);
        }
      }
    } catch (error) {
      console.error("시뮬레이션 삭제 오류:", error);
      alert(error.message || "시뮬레이션 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleRenameSimulation = async (simulationId, newTitle) => {
    if (!checkEditPermission("시뮬레이션 이름 변경")) return;
    try {
      await simulationService.updateSimulation(profileId, simulationId, {
        title: newTitle,
      });

      // 시뮬레이션 목록 업데이트
      setSimulations(
        simulations.map((sim) =>
          sim.id === simulationId ? { ...sim, title: newTitle } : sim
        )
      );
    } catch (error) {
      console.error("시뮬레이션 이름 변경 오류:", error);
      alert("시뮬레이션 이름 변경 중 오류가 발생했습니다.");
    }
  };

  // AI 분석 데이터 생성 핸들러 (옵션: "single" 또는 "compare")
  const handleGenerateAIAnalysis = async (option = "single") => {
    if (!profileData) {
      alert("프로필 데이터가 로드되지 않았습니다. 페이지를 새로고침해주세요.");
      trackEvent("AI 데이터 추출 실패", {
        reason: "프로필 데이터 없음",
        profileId,
      });
      return;
    }

    setIsGeneratingAI(true);
    setIsAIOptionModalOpen(false);

    // Mixpanel 이벤트 트래킹 - 시도
    trackEvent("AI 데이터 추출 시도", {
      profileId,
      option,
      activeSimulationId,
    });

    try {
      // 현재 선택된 시뮬레이션 정보
      const currentSimulation = simulations.find(
        (sim) => sim.id === activeSimulationId
      );
      const simulationTitle = currentSimulation
        ? currentSimulation.title
        : "알 수 없음";

      // 기본 시뮬레이션(현재) 찾기
      const defaultSimulation = simulations.find((sim) => sim.isDefault);
      const isCurrentDefault = defaultSimulation?.id === activeSimulationId;

      let promptText;

      // 옵션이 "compare"이고 기본 시뮬레이션이 아닌 경우: 기본 + 현재 두 개 비교
      if (option === "compare" && !isCurrentDefault && defaultSimulation) {
        // 기본 시뮬레이션 데이터 가져오기
        const defaultData = await fetchSimulationFinancialData(
          defaultSimulation.id
        );

        // 데이터 로드 실패 체크
        if (!defaultData) {
          alert(
            "기본 시뮬레이션 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요."
          );
          // Mixpanel 이벤트 트래킹 - 실패
          trackEvent("AI 데이터 추출 실패", {
            profileId,
            option: "compare",
            activeSimulationId,
            errorType: "default_simulation_data_load_failed",
            errorMessage: "기본 시뮬레이션 데이터를 불러올 수 없습니다.",
          });
          setIsGeneratingAI(false);
          return;
        }

        const defaultAnalysisData = extractAIAnalysisData(
          profileData,
          defaultData.incomes,
          defaultData.expenses,
          defaultData.savings,
          defaultData.pensions,
          defaultData.realEstates,
          defaultData.assets,
          defaultData.debts
        );

        // 현재 시뮬레이션 데이터
        const currentAnalysisData = extractAIAnalysisData(
          profileData,
          incomes,
          expenses,
          savings,
          pensions,
          realEstates,
          assets,
          debts
        );

        // 비교 프롬프트 생성 (Firebase에서 불러온 프롬프트 사용)
        promptText = `**비교 대상 시뮬레이션:**
- A: ${defaultSimulation.title} (기본 시뮬레이션)
- B: ${simulationTitle} (선택된 시뮬레이션)

${aiPrompts.comparePrompt}

## 재무 데이터

### A: ${defaultSimulation.title} (기본 시뮬레이션)
${JSON.stringify(defaultAnalysisData, null, 2)}

### B: ${simulationTitle} (선택된 시뮬레이션)
${JSON.stringify(currentAnalysisData, null, 2)}`;

        // Mixpanel 이벤트 트래킹 - 성공 (비교 분석)
        trackEvent("AI 데이터 추출 성공", {
          profileId,
          option: "compare",
          activeSimulationId,
          defaultSimulationId: defaultSimulation.id,
        });

        alert(
          "현재 데이터와 선택된 시뮬레이션 데이터가 비교 형식으로 클립보드에 복사되었습니다!\nChatGPT에 붙여넣기하여 AI 비교 분석을 받아보세요."
        );
      } else {
        // 단일 시뮬레이션 분석 (option === "single" 또는 기본 시뮬레이션)
        const analysisData = extractAIAnalysisData(
          profileData,
          incomes,
          expenses,
          savings,
          pensions,
          realEstates,
          assets,
          debts
        );

        // 시뮬레이션 정보 추가
        analysisData.시뮬레이션 = simulationTitle;

        // AI 분석용 프롬프트와 데이터를 함께 구성 (Firebase에서 불러온 프롬프트 사용)
        promptText = `**분석 대상 시뮬레이션: ${simulationTitle}**

        ${aiPrompts.singlePrompt}

        ## 재무 데이터
        ${JSON.stringify(analysisData, null, 2)}`;

        // Mixpanel 이벤트 트래킹 - 성공 (단일 분석)
        trackEvent("AI 데이터 추출 성공", {
          profileId,
          option: "single",
          activeSimulationId,
        });

        alert(
          "AI 분석용 프롬프트와 데이터가 클립보드에 복사되었습니다!\nChatGPT에 붙여넣기하여 AI 조언을 받아보세요."
        );
      }

      // 클립보드에 프롬프트와 데이터를 함께 복사
      await navigator.clipboard.writeText(promptText);
    } catch (error) {
      console.error("AI 분석 데이터 생성 오류:", error);

      // 오류 타입에 따른 상세한 메시지
      let errorMessage = "AI 분석 데이터 생성 중 오류가 발생했습니다.";
      let errorType = "unknown";

      if (error.name === "NotAllowedError") {
        errorMessage =
          "클립보드 접근 권한이 없습니다. 브라우저 설정에서 클립보드 권한을 허용해주세요.";
        errorType = "clipboard_permission_denied";
      } else if (error.message?.includes("clipboard")) {
        errorMessage = "클립보드에 복사하는 중 오류가 발생했습니다.";
        errorType = "clipboard_error";
      } else if (error.message?.includes("extractAIAnalysisData")) {
        errorMessage = "데이터 추출 중 오류가 발생했습니다.";
        errorType = "data_extraction_error";
      }

      // Mixpanel 이벤트 트래킹 - 실패
      trackEvent("AI 데이터 추출 실패", {
        profileId,
        option,
        activeSimulationId,
        errorType,
        errorMessage: error.message,
      });

      alert(errorMessage);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // 카테고리별 이름 매핑
  const getCategoryName = (categoryId) => {
    const categoryMap = {
      income: "소득",
      expense: "지출",
      savings: "저축/투자",
      pension: "연금",
      realEstate: "부동산",
      assets: "자산",
      debt: "부채",
    };
    return categoryMap[categoryId] || "데이터";
  };

  // 로딩 상태 처리 (프로필 또는 시뮬레이션 로드 중)
  if (loading || !activeSimulationId) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>데이터를 불러오는 중...</div>
      </div>
    );
  }

  // 프로필이 없는 경우
  if (!profileData) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>프로필을 찾을 수 없습니다.</div>
        <button onClick={() => navigate("/consult")}>목록으로 돌아가기</button>
      </div>
    );
  }

  // 카테고리 설정
  const categories = [
    { id: "income", name: "소득", color: "#10b981", count: incomes.length },
    { id: "expense", name: "지출", color: "#ef4444", count: expenses.length },
    {
      id: "savings",
      name: "저축/투자",
      color: "#3b82f6",
      count: savings.length,
    },
    { id: "pension", name: "연금", color: "#8b5cf6", count: pensions.length },
    {
      id: "realEstate",
      name: "부동산",
      color: "#f59e0b",
      count: realEstates.length,
    },
    { id: "assets", name: "자산", color: "#f59e0b", count: assets.length },
    { id: "debt", name: "부채", color: "#6b7280", count: debts.length },
  ];

  if (!profileData) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>프로필을 찾을 수 없습니다.</div>
        <button onClick={() => navigate("/consult")}>목록으로 돌아가기</button>
      </div>
    );
  }

  // 패스워드 입력 전에는 대시보드 내용을 숨기고 패스워드 모달만 표시
  if (!hasProfileAccess) {
    return (
      <div className={styles.container}>
        {/* 프로필 패스워드 입력 모달 */}
        <ProfilePasswordModal
          isOpen={isPasswordModalOpen}
          onClose={handleClosePasswordModal}
          onSubmit={handleSubmitPassword}
          profileName={profileData?.name || ""}
          profileId={profileId}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 상단 프로필 정보 */}
      <div className={styles.profileHeader}>
        {isAdmin && (
          <button
            className={styles.backIconButton}
            onClick={() => navigate("/consult")}
            title="목록으로"
          >
            ←
          </button>
        )}
        <div className={styles.profileInfo}>
          <h1
            className={styles.profileName}
            onClick={handleEditProfile}
            title="클릭하여 수정"
          >
            {profileData.name}님
          </h1>
          <span
            className={styles.infoText}
            onClick={handleEditProfile}
            title="클릭하여 수정"
          >
            현재 {calculateKoreanAge(profileData.birthYear)}세
          </span>
          <span className={styles.infoDivider}>|</span>
          <span
            className={styles.infoText}
            onClick={handleEditProfile}
            title="클릭하여 수정"
          >
            은퇴 {profileData.retirementAge}세 (
            {(() => {
              const currentYear = new Date().getFullYear();
              const birth = parseInt(profileData.birthYear, 10);
              const retireAge = parseInt(profileData.retirementAge, 10);
              if (Number.isFinite(birth) && Number.isFinite(retireAge)) {
                const currentAge = calculateKoreanAge(birth, currentYear);
                const yearsToRetire = retireAge - currentAge;
                return (
                  currentYear +
                  (Number.isFinite(yearsToRetire) ? yearsToRetire : 0)
                );
              }
              return "?";
            })()}
            년)
          </span>
          <span className={styles.infoDivider}>|</span>
          <span
            className={styles.infoText}
            onClick={handleEditProfile}
            title="클릭하여 수정"
          >
            현금 {formatAmount(profileData.currentCash)}
          </span>
          <span className={styles.infoDivider}>|</span>
          <span
            className={styles.infoText}
            onClick={handleEditProfile}
            title="클릭하여 수정"
          >
            목표 {formatAmount(profileData.targetAssets)}
          </span>
          <span className={styles.infoDivider}>|</span>
          <span
            className={styles.infoText}
            onClick={handleEditProfile}
            title="클릭하여 수정"
          >
            가구{" "}
            {(() => {
              let count = 1;
              if (profileData.hasSpouse) count += 1;
              if (profileData.familyMembers)
                count += profileData.familyMembers.length;
              return count;
            })()}
            명
            {(profileData.hasSpouse ||
              (profileData.familyMembers &&
                profileData.familyMembers.length > 0)) && (
              <span className={styles.familyDetail}>
                {profileData.hasSpouse &&
                  `배우자(${calculateKoreanAge(
                    profileData.spouseBirthYear
                  )}세)${
                    profileData.familyMembers &&
                    profileData.familyMembers.length > 0
                      ? ", "
                      : ""
                  }`}
                {profileData.familyMembers &&
                  profileData.familyMembers.length > 0 &&
                  profileData.familyMembers.map((member, index) => {
                    // 자녀인 경우 성별 표시
                    const isChild = member.relationship === "자녀";
                    const currentAge = calculateKoreanAge(member.birthYear);

                    return (
                      <span key={member.id || `family-${index}`}>
                        {index > 0 && ", "}
                        {isChild && member.gender
                          ? `자녀(${member.gender}, ${currentAge}세)`
                          : `${
                              member.relationship || member.relation || "가족"
                            }(${currentAge}세)`}
                      </span>
                    );
                  })}
              </span>
            )}
          </span>
        </div>
        <div className={styles.profileActions}>
          {/* 사전 상담 버튼 - 임시 숨김 */}
          {/* {isAdmin && (
            <button
              className={styles.iconButton}
              onClick={() => navigate(`/consult/preconsult/${profileId}`)}
              title="사전 상담 페이지로 이동"
            >
              <span className={styles.buttonText}>사전 상담</span>
            </button>
          )} */}
          {isAdmin && (
            <button
              className={styles.reportButton}
              onClick={() => navigate(`/consult/report/${profileId}`)}
              title="상담 보고서 보기"
            >
              <i className="fas fa-file-alt"></i>
              <span className={styles.buttonText}>상담 보고서</span>
            </button>
          )}
          <button className={styles.iconButton} onClick={openDataStorePanel}>
            <span className={styles.buttonText}>재무 라이브러리</span>
          </button>
          <button
            className={styles.iconButton}
            onClick={() => setIsCalculatorModalOpen(true)}
          >
            <span className={styles.buttonText}>계산기</span>
          </button>
          <button
            className={styles.iconButton}
            onClick={() => openProfilePanel("memo")}
          >
            <span className={styles.buttonText}>프로필 메모</span>
          </button>
          <button
            className={styles.iconButton}
            onClick={() => openProfilePanel("checklist")}
          >
            <span className={styles.buttonText}>체크리스트</span>
          </button>
        </div>
      </div>

      {/* 시뮬레이션 탭 */}
      {simulations.length > 0 && activeSimulationId && (
        <SimulationTabs
          simulations={simulations}
          activeSimulationId={activeSimulationId}
          onTabChange={handleSimulationTabChange}
          onAddSimulation={handleAddSimulation}
          onDeleteSimulation={handleDeleteSimulation}
          onRenameSimulation={handleRenameSimulation}
          onCopySimulation={handleCopySimulation}
          isReadOnly={false}
        />
      )}

      {/* 사이드바 토글 버튼 & 재무 항목 요약 */}
      <div className={styles.summaryContainer}>
        <div className={styles.sidebarControlGroup}>
          <button
            className={styles.sidebarToggleButton}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <div className={styles.sidebarControlRightGroup}>
            {isAdmin && (
              <>
                <button
                  className={styles.sidebarIconButton}
                  title="상승률 일괄 조절"
                  onClick={() => setIsRateAdjustModalOpen(true)}
                  disabled={!activeSimulationId}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                </button>
                <button
                  className={styles.sidebarIconButton}
                  title="AI 분석 데이터 추출"
                  onClick={() => setIsAIOptionModalOpen(true)}
                  disabled={isGeneratingAI || !activeSimulationId}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3v12" />
                    <path d="M8 11l4 4 4-4" />
                    <path d="M5 19h14" />
                  </svg>
                </button>
              </>
            )}
            <button
              className={styles.sidebarIconButton}
              title="시뮬레이션 비교"
              onClick={handleOpenCompareModal}
              disabled={!activeSimulationId}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="4" width="6" height="12" rx="1" />
                <rect x="14" y="8" width="6" height="12" rx="1" />
                <path d="M4 20h16" />
              </svg>
            </button>
          </div>
        </div>
        {/* 프로필 하단 차트 선택 탭 */}
        <ProfileSummary
          activeChart={activeChart}
          onChartChange={setActiveChart}
        />
      </div>

      {/* 메인 대시보드 */}
      <div className={styles.dashboardMain}>
        {/* 좌측 동적 사이드바 */}
        <div
          className={`${styles.sidebar} ${
            isSidebarCollapsed ? styles.collapsed : ""
          }`}
        >
          {sidebarView === "categories" ? (
            // 카테고리 목록 뷰
            <div className={`${styles.sidebarView} ${styles.categoriesView}`}>
              <div className={styles.categoryList}>
                {categories.map((category) => (
                  <div key={category.id} className={styles.categoryItem}>
                    <button
                      className={styles.categoryButton}
                      onClick={() => handleCategoryClick(category.id)}
                      data-category={category.id}
                    >
                      <span className={styles.categoryName}>
                        {category.name}
                      </span>
                      <span className={styles.categoryCount}>
                        {category.count}개
                      </span>
                    </button>
                    {/* 수정/삭제 버튼은 모두 표시, 클릭 시 권한 확인 */}
                    <button
                      className={styles.categoryAddButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCategory(category.id);
                        // 직접 해당 카테고리의 추가 함수 호출
                        switch (category.id) {
                          case "income":
                            handleAddIncome();
                            break;
                          case "expense":
                            handleAddExpense();
                            break;
                          case "savings":
                            handleAddSaving();
                            break;
                          case "pension":
                            handleAddPension();
                            break;
                          case "realEstate":
                            handleAddRealEstate();
                            break;
                          case "assets":
                            handleAddAsset();
                            break;
                          case "debt":
                            handleAddDebt();
                            break;
                          default:
                            break;
                        }
                      }}
                      title={`${category.name} 추가`}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // 리스트 뷰
            <div className={`${styles.sidebarView} ${styles.listView}`}>
              <div className={styles.listHeader}>
                <button
                  className={styles.backIconButton}
                  onClick={handleBackToCategories}
                  title="뒤로가기"
                >
                  ←
                </button>
                <h2 className={styles.listTitle}>
                  {getCategoryName(selectedCategory)}
                </h2>
                <button
                  className={styles.addIconButton}
                  onClick={handleAddData}
                  title="추가"
                >
                  +
                </button>
              </div>
              <div className={styles.listContent}>
                {selectedCategory === "income" ? (
                  <IncomeList
                    incomes={incomes}
                    onEdit={handleEditIncome}
                    onCopy={handleCopyIncome}
                    onDelete={handleDeleteIncome}
                    isReadOnly={false}
                  />
                ) : selectedCategory === "expense" ? (
                  <ExpenseList
                    expenses={expenses}
                    onEdit={handleEditExpense}
                    onCopy={handleCopyExpense}
                    onDelete={handleDeleteExpense}
                    isReadOnly={false}
                  />
                ) : selectedCategory === "savings" ? (
                  <SavingList
                    savings={savings}
                    onEdit={handleEditSaving}
                    onCopy={handleCopySaving}
                    onDelete={handleDeleteSaving}
                    isReadOnly={false}
                  />
                ) : selectedCategory === "pension" ? (
                  <PensionList
                    pensions={pensions}
                    onEdit={handleEditPension}
                    onCopy={handleCopyPension}
                    onDelete={handleDeletePension}
                    isReadOnly={false}
                  />
                ) : selectedCategory === "realEstate" ? (
                  <RealEstateList
                    realEstates={realEstates}
                    onEdit={handleEditRealEstate}
                    onCopy={handleCopyRealEstate}
                    onDelete={handleDeleteRealEstate}
                    isReadOnly={false}
                  />
                ) : selectedCategory === "assets" ? (
                  <AssetList
                    assets={assets}
                    onEdit={handleEditAsset}
                    onCopy={handleCopyAsset}
                    onDelete={handleDeleteAsset}
                    isReadOnly={false}
                  />
                ) : selectedCategory === "debt" ? (
                  <DebtList
                    debts={debts}
                    onEdit={handleEditDebt}
                    onCopy={handleCopyDebt}
                    onDelete={handleDeleteDebt}
                    isReadOnly={false}
                  />
                ) : (
                  <div className={styles.emptyList}>
                    <p>데이터가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {sidebarView === "categories" && !isSidebarCollapsed && (
            <SimulationMemoPanel
              memo={simulationMemo}
              onSave={handleSaveSimulationMemo}
              isSaving={isMemoSaving}
              isDisabled={!activeSimulationId || !hasEditPermission}
            />
          )}
        </div>

        {/* 우측 메인 콘텐츠 - 그래프만 */}
        <div className={styles.mainContent}>
          <div className={styles.chartSection}>
            {/* 선택된 차트 렌더링 */}
            <div className={styles.chartGrid}>
              {activeChart === "assets" && (
                <div className={styles.chartContainer}>
                  <RechartsAssetChart
                    key={`assets-${activeSimulationId}`}
                    data={simulationData.assets}
                    retirementAge={profileData.retirementAge}
                    spouseRetirementAge={profileData.spouseRetirementAge}
                    targetAssets={profileData.targetAssets}
                    profileData={profileData}
                    savings={savings}
                    pensions={pensions}
                    realEstates={realEstates}
                    assets={assets}
                    debts={debts}
                    incomes={incomes}
                    expenses={expenses}
                    xAxisRange={chartXAxisRange}
                    onXAxisRangeChange={setChartXAxisRange}
                    currentSimulation={currentSimulation}
                    onUpdateWithdrawalRule={handleUpdateWithdrawalRule}
                  />
                </div>
              )}

              {activeChart === "cashflow" && (
                <div className={styles.chartContainer}>
                  <RechartsCashflowChart
                    key={`cashflow-${activeSimulationId}`}
                    data={simulationData.cashflow}
                    retirementAge={profileData.retirementAge}
                    detailedData={simulationData.cashflowDetailed}
                    profileData={profileData} // 배우자 은퇴 정보를 위해 전체 프로필 데이터 전달
                    currentSimulation={currentSimulation} // 현재 시뮬레이션 데이터 (투자 규칙 포함)
                    incomes={incomes}
                    expenses={expenses}
                    savings={savings}
                    pensions={pensions}
                    realEstates={realEstates}
                    assets={assets}
                    debts={debts}
                    onUpdateInvestmentRule={handleUpdateInvestmentRule} // 투자 규칙 업데이트 콜백
                    xAxisRange={chartXAxisRange}
                    onXAxisRangeChange={setChartXAxisRange}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 프로필 패널 오버레이 */}
      {isProfilePanelOpen && (
        <div
          className={styles.profilePanelOverlay}
          onClick={closeProfilePanel}
        />
      )}
      {/* 재무 라이브러리 패널 오버레이 */}
      {isDataStorePanelOpen && (
        <div
          className={styles.profilePanelOverlay}
          onClick={closeDataStorePanel}
        />
      )}

      {/* 프로필 패널 */}
      <div
        className={`${styles.profileSidePanel} ${
          isProfilePanelOpen ? styles.open : ""
        }`}
      >
        <div className={styles.profileSidePanelHeader}>
          <div className={styles.profileSidePanelTabs}>
            <button
              className={`${styles.panelTab} ${
                profilePanelTab === "memo" ? styles.active : ""
              }`}
              onClick={() => setProfilePanelTab("memo")}
              type="button"
            >
              프로필 메모
            </button>
            <button
              className={`${styles.panelTab} ${
                profilePanelTab === "checklist" ? styles.active : ""
              }`}
              onClick={() => setProfilePanelTab("checklist")}
              type="button"
            >
              체크리스트
            </button>
          </div>
          <button
            className={styles.profilePanelClose}
            onClick={closeProfilePanel}
            type="button"
          >
            →
          </button>
        </div>
        <div className={styles.profileSidePanelContent}>
          {profilePanelTab === "memo" ? (
            <ProfileMemoPanel
              memo={profileMemo}
              onSave={handleSaveProfileMemo}
              isSaving={isProfileMemoSaving}
              isDisabled={!hasEditPermission}
            />
          ) : (
            <ProfileChecklistPanel
              items={profileChecklist?.items || []}
              onItemsChange={handleChecklistItemsChange}
              isLoading={isChecklistLoading}
              isSaving={isChecklistSaving}
              disabled={isChecklistSaving || !hasEditPermission}
              isAdmin={isAdmin}
              onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
            />
          )}
        </div>
      </div>

      {/* 재무 라이브러리 패널 */}
      <div
        className={`${styles.profileSidePanel} ${
          isDataStorePanelOpen ? styles.open : ""
        }`}
      >
        <div className={styles.profileSidePanelHeader}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
            재무 라이브러리
          </h3>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {isAdmin && (
              <button
                className={styles.profilePanelSettings}
                onClick={() => setIsManageModalOpen(true)}
                type="button"
                title="템플릿 관리"
              >
                ⚙
              </button>
            )}
            <button
              className={styles.profilePanelClose}
              onClick={closeDataStorePanel}
              type="button"
            >
              →
            </button>
          </div>
        </div>
        <div className={styles.profileSidePanelContent}>
          <FinancialDataStorePanel
            key={libraryRefreshKey}
            onSelectTemplate={handleSelectTemplate}
            profileData={profileData}
            onClose={closeDataStorePanel}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {/* 재무 라이브러리 관리 모달 */}
      <TemplateManageModal
        isOpen={isManageModalOpen}
        onClose={() => {
          setIsManageModalOpen(false);
          setLibraryRefreshKey((prev) => prev + 1); // 템플릿 목록 새로고침
        }}
      />

      {/* 소득 모달 */}
      <IncomeModal
        isOpen={isIncomeModalOpen}
        onClose={() => {
          setIsIncomeModalOpen(false);
          setInitialIncomeData(null);
          setEditingIncome(null); // 수정 데이터 초기화
        }}
        onSave={handleSaveIncome}
        editData={editingIncome}
        initialData={initialIncomeData}
        profileData={profileData}
        simulations={simulations}
        activeSimulationId={activeSimulationId}
        profileId={profileId}
        defaultIncomeGrowthRate={globalSettings.defaultIncomeGrowthRate}
      />

      {/* 지출 모달 */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setInitialExpenseData(null);
          setEditingExpense(null); // 수정 데이터 초기화
        }}
        onSave={handleSaveExpense}
        editData={editingExpense}
        initialData={initialExpenseData}
        profileData={profileData}
        simulations={simulations}
        activeSimulationId={activeSimulationId}
        profileId={profileId}
        defaultInflationRate={globalSettings.defaultInflationRate}
      />

      {/* 저축/투자 모달 */}
      <SavingModal
        isOpen={isSavingModalOpen}
        onClose={() => {
          setIsSavingModalOpen(false);
          setEditingSaving(null); // 수정 데이터 초기화
          setInitialSavingData(null); // 복사 데이터 초기화
        }}
        onSave={handleSaveSaving}
        editData={editingSaving}
        initialData={initialSavingData}
        profileData={profileData}
        simulations={simulations}
        activeSimulationId={activeSimulationId}
        profileId={profileId}
        defaultInvestmentReturnRate={globalSettings.defaultInvestmentReturnRate}
        defaultSavingGrowthRate={globalSettings.defaultSavingGrowthRate}
        defaultIncomeRate={globalSettings.defaultIncomeRate}
      />

      <PensionModal
        isOpen={isPensionModalOpen}
        onClose={() => {
          setIsPensionModalOpen(false);
          setEditingPension(null); // 수정 데이터 초기화
          setInitialPensionData(null); // 복사 데이터 초기화
        }}
        onSave={handleSavePension}
        editData={editingPension}
        initialData={initialPensionData}
        profileData={profileData}
        simulations={simulations}
        activeSimulationId={activeSimulationId}
        profileId={profileId}
        defaultInflationRate={globalSettings.defaultInflationRate}
        defaultInvestmentReturnRate={globalSettings.defaultInvestmentReturnRate}
      />

      <RealEstateModal
        isOpen={isRealEstateModalOpen}
        onClose={() => {
          setIsRealEstateModalOpen(false);
          setEditingRealEstate(null); // 수정 데이터 초기화
          setInitialRealEstateData(null); // 복사 데이터 초기화
        }}
        onSave={handleSaveRealEstate}
        editData={editingRealEstate}
        initialData={initialRealEstateData}
        profileData={profileData}
        simulations={simulations}
        activeSimulationId={activeSimulationId}
        profileId={profileId}
        defaultRealEstateGrowthRate={globalSettings.defaultRealEstateGrowthRate}
      />

      <ProfileEditModal
        isOpen={isProfileEditModalOpen}
        onClose={handleCloseProfileEditModal}
        onSave={handleSaveProfileEdit}
        profileData={profileData}
        activeSimulationId={activeSimulationId}
        simulations={simulations}
      />

      {/* 자산 모달 */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => {
          setIsAssetModalOpen(false);
          setEditingAsset(null); // 수정 데이터 초기화
          setInitialAssetData(null); // 복사 데이터 초기화
        }}
        onSave={handleSaveAsset}
        editData={editingAsset}
        initialData={initialAssetData}
        profileData={profileData}
        simulations={simulations}
        activeSimulationId={activeSimulationId}
        profileId={profileId}
        defaultAssetGrowthRate={globalSettings.defaultAssetGrowthRate}
        defaultIncomeRate={globalSettings.defaultIncomeRate}
      />

      {/* 부채 모달 */}
      <DebtModal
        isOpen={isDebtModalOpen}
        onClose={() => {
          setIsDebtModalOpen(false);
          setEditingDebt(null); // 수정 데이터 초기화
          setInitialDebtData(null); // 복사 데이터 초기화
        }}
        onSave={handleSaveDebt}
        editData={editingDebt}
        initialData={initialDebtData}
        profileData={profileData}
        simulations={simulations}
        activeSimulationId={activeSimulationId}
        profileId={profileId}
        defaultDebtInterestRate={globalSettings.defaultDebtInterestRate}
      />

      {/* 계산기 모달 */}
      <CalculatorModal
        isOpen={isCalculatorModalOpen}
        onClose={() => setIsCalculatorModalOpen(false)}
        profileData={profileData}
      />

      {/* 재무 데이터 모달 */}
      <SimulationCompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        isLoading={isCompareLoading}
        defaultTitle={comparisonData.defaultTitle}
        targetTitle={comparisonData.targetTitle}
        defaultData={comparisonData.defaultData}
        targetData={comparisonData.targetData}
        defaultSimulationId={comparisonData.defaultSimulationId}
        targetSimulationId={comparisonData.targetSimulationId}
        profileData={profileData}
        currentSimulationId={activeSimulationId}
        simulations={simulations}
        onDataRefresh={handleRefreshComparisonData}
        // 현재 시뮬레이션의 이미 계산된 데이터 전달 (Firestore 재호출 방지)
        currentSimulationData={{
          simulationData,
          incomes,
          expenses,
          savings,
          pensions,
          realEstates,
          assets,
          debts,
        }}
      />

      {/* 상승률 일괄 조절 모달 */}
      <RateAdjustModal
        isOpen={isRateAdjustModalOpen}
        onClose={() => setIsRateAdjustModalOpen(false)}
        incomes={incomes}
        expenses={expenses}
        savings={savings}
        realEstates={realEstates}
        assets={assets}
        debts={debts}
        pensions={pensions}
        globalSettings={globalSettings}
        onSave={async ({
          incomes: updatedIncomes,
          expenses: updatedExpenses,
          savings: updatedSavings,
          realEstates: updatedRealEstates,
          assets: updatedAssets,
          debts: updatedDebts,
          pensions: updatedPensions,
        }) => {
          // 소득 업데이트
          for (const item of updatedIncomes) {
            const original = incomes.find((i) => i.id === item.id);
            if (original && original.growthRate !== item.growthRate) {
              await incomeService.updateIncome(
                profileId,
                activeSimulationId,
                item.id,
                { ...item }
              );
            }
          }
          // 지출 업데이트
          for (const item of updatedExpenses) {
            const original = expenses.find((i) => i.id === item.id);
            if (original && original.growthRate !== item.growthRate) {
              await expenseService.updateExpense(
                profileId,
                activeSimulationId,
                item.id,
                { ...item }
              );
            }
          }
          // 저축/투자 업데이트
          for (const item of updatedSavings) {
            const original = savings.find((i) => i.id === item.id);
            if (
              original &&
              (original.interestRate !== item.interestRate ||
                original.yearlyGrowthRate !== item.yearlyGrowthRate ||
                original.incomeRate !== item.incomeRate)
            ) {
              await savingsService.updateSaving(
                profileId,
                activeSimulationId,
                item.id,
                { ...item }
              );
            }
          }
          // 부동산 업데이트
          for (const item of updatedRealEstates) {
            const original = realEstates.find((i) => i.id === item.id);
            if (original && original.growthRate !== item.growthRate) {
              await realEstateService.updateRealEstate(
                profileId,
                activeSimulationId,
                item.id,
                { ...item }
              );
            }
          }
          // 자산 업데이트
          for (const item of updatedAssets) {
            const original = assets.find((i) => i.id === item.id);
            if (original && original.growthRate !== item.growthRate) {
              await assetService.updateAsset(
                profileId,
                activeSimulationId,
                item.id,
                { ...item }
              );
            }
          }
          // 부채 업데이트
          for (const item of updatedDebts) {
            const original = debts.find((i) => i.id === item.id);
            if (original && original.interestRate !== item.interestRate) {
              await debtService.updateDebt(
                profileId,
                activeSimulationId,
                item.id,
                { ...item }
              );
            }
          }
          // 연금 업데이트
          for (const item of updatedPensions) {
            const original = pensions.find((i) => i.id === item.id);
            if (original) {
              // 국민연금: inflationRate 비교
              if (
                item.type === "national" &&
                original.inflationRate !== item.inflationRate
              ) {
                await pensionService.updatePension(
                  profileId,
                  activeSimulationId,
                  item.id,
                  { ...item }
                );
              }
              // 퇴직/개인/퇴직금: returnRate 비교
              else if (
                item.type !== "national" &&
                original.returnRate !== item.returnRate
              ) {
                await pensionService.updatePension(
                  profileId,
                  activeSimulationId,
                  item.id,
                  { ...item }
                );
              }
            }
          }
          // 상태 업데이트
          setIncomes(updatedIncomes);
          setExpenses(updatedExpenses);
          setSavings(updatedSavings);
          setRealEstates(updatedRealEstates);
          setAssets(updatedAssets);
          setDebts(updatedDebts);
          setPensions(updatedPensions);
          trackEvent("상승률 일괄 조절", {
            profileId,
            simulationId: activeSimulationId,
            incomeCount: updatedIncomes.length,
            expenseCount: updatedExpenses.length,
            savingCount: updatedSavings.length,
            realEstateCount: updatedRealEstates.length,
            assetCount: updatedAssets.length,
            debtCount: updatedDebts.length,
            pensionCount: updatedPensions.length,
          });
        }}
      />

      {/* AI 옵션 선택 모달 */}
      {isAIOptionModalOpen && (
        <AIPromptModal
          aiPrompts={aiPrompts}
          isSavingPrompts={isSavingPrompts}
          isGeneratingAI={isGeneratingAI}
          onClose={() => setIsAIOptionModalOpen(false)}
          onSave={handleSaveAiPrompts}
          onExtractSingle={() => handleGenerateAIAnalysis("single")}
          onExtractCompare={() => handleGenerateAIAnalysis("compare")}
          canCompare={simulations.some(
            (sim) => sim.isDefault && sim.id !== activeSimulationId
          )}
        />
      )}

      {/* 체크리스트 템플릿 수정 모달 (관리자 전용) */}
      <ChecklistTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />

      {/* 데이터 디버그 테이블 (개발용) */}
      <div style={{ padding: "20px", background: "#1a1a2e", marginTop: "20px" }}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "flex-start" }}>
          <button
            onClick={() => setShowDebugTable(!showDebugTable)}
            style={{
              padding: "10px 20px",
              background: showDebugTable ? "#ef4444" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {showDebugTable ? "디버그 테이블 숨기기" : "디버그 테이블 보기"}
          </button>
          <button
            onClick={() => setShowDataFlowInfo(!showDataFlowInfo)}
            style={{
              padding: "10px 20px",
              background: showDataFlowInfo ? "#f59e0b" : "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {showDataFlowInfo ? "데이터 흐름 숨기기" : "데이터 흐름 보기"}
          </button>
        </div>

        {/* 데이터 흐름 설명 패널 */}
        {showDataFlowInfo && simulationData && (
          <div style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            border: "1px solid #334155",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px",
          }}>
            <h3 style={{ color: "#f59e0b", marginTop: 0, marginBottom: "16px", fontSize: "16px" }}>
              🔄 Single Source of Truth - 실제 코드 & 데이터 흐름
            </h3>

            {/* ===== 1. 데이터 저장 & 로드 ===== */}
            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ color: "#22c55e", marginBottom: "12px", fontSize: "14px" }}>
                📦 1단계: 데이터 저장 & 로드
              </h4>
              <div style={{ background: "#0f172a", padding: "16px", borderRadius: "8px" }}>
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ color: "#f59e0b", fontWeight: "600", marginBottom: "4px" }}>저장 위치</div>
                  <code style={{ fontSize: "11px", color: "#94a3b8" }}>Firestore → profiles/{"{profileId}"}/simulations/{"{simulationId}"}/[incomes|expenses|savings|...]</code>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ color: "#3b82f6", fontWeight: "600", marginBottom: "4px" }}>로드 코드 (DashboardPage.jsx)</div>
                  <pre style={{ fontSize: "10px", color: "#64748b", margin: 0, background: "#1e293b", padding: "8px", borderRadius: "4px", overflow: "auto" }}>{`// src/pages/DashboardPage.jsx - useEffect 내부
const [incomeData, expenseData, savingData, ...] = await Promise.all([
  incomeService.getIncomes(profileData.id, simulationId),
  expenseService.getExpenses(profileData.id, simulationId),
  ...
]);`}</pre>
                </div>
                <div style={{ color: "#22c55e", fontWeight: "600", marginBottom: "4px" }}>현재 로드된 데이터 개수</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px" }}>
                  <span style={{ background: "#1e3a2e", padding: "4px 8px", borderRadius: "4px" }}>소득: {incomes?.length || 0}개</span>
                  <span style={{ background: "#3a2e1e", padding: "4px 8px", borderRadius: "4px" }}>지출: {expenses?.length || 0}개</span>
                  <span style={{ background: "#1e2a3e", padding: "4px 8px", borderRadius: "4px" }}>저축: {savings?.length || 0}개</span>
                  <span style={{ background: "#2e1e3e", padding: "4px 8px", borderRadius: "4px" }}>연금: {pensions?.length || 0}개</span>
                  <span style={{ background: "#3e1e2e", padding: "4px 8px", borderRadius: "4px" }}>부동산: {realEstates?.length || 0}개</span>
                  <span style={{ background: "#1e3e2e", padding: "4px 8px", borderRadius: "4px" }}>자산: {assets?.length || 0}개</span>
                  <span style={{ background: "#3e2e2e", padding: "4px 8px", borderRadius: "4px" }}>부채: {debts?.length || 0}개</span>
                </div>
              </div>
            </div>

            {/* ===== 2. 계산 로직 ===== */}
            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ color: "#3b82f6", marginBottom: "12px", fontSize: "14px" }}>
                ⚙️ 2단계: 시뮬레이션 계산 (cashflowSimulator.js)
              </h4>
              <div style={{ background: "#0f172a", padding: "16px", borderRadius: "8px" }}>
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ color: "#f59e0b", fontWeight: "600", marginBottom: "4px" }}>호출 코드</div>
                  <pre style={{ fontSize: "10px", color: "#64748b", margin: 0, background: "#1e293b", padding: "8px", borderRadius: "4px", overflow: "auto" }}>{`// src/pages/DashboardPage.jsx
const result = calculateCashflowSimulation(
  profileData, incomes, expenses, savings, pensions, realEstates, assets, debts
);
setSimulationData(result);`}</pre>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ color: "#a855f7", fontWeight: "600", marginBottom: "4px" }}>핵심 계산 (Single Source of Truth)</div>
                  <pre style={{ fontSize: "10px", color: "#64748b", margin: 0, background: "#1e293b", padding: "8px", borderRadius: "4px", overflow: "auto" }}>{`// src/utils/cashflowSimulator.js (약 3835번째 줄)
// 원본: assetItems[], debtItems[] 배열
const totalAssets = assetItems.reduce((sum, item) => sum + item.amount, 0);
const totalDebt = debtItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);
const netAssets = totalAssets - totalDebt;  // ← 이 값이 기준!

// 차트용 totalAmount도 동일한 값으로 동기화
assetItem.totalAmount = netAssets;`}</pre>
                </div>
                <div style={{ color: "#22c55e", fontWeight: "600", marginBottom: "4px" }}>계산 결과 (simulationData)</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px" }}>
                  <span style={{ background: "#1e3a2e", padding: "4px 8px", borderRadius: "4px" }}>
                    assets: {simulationData.assets?.length || 0}년치 (통합: totalAmount + breakdown)
                  </span>
                  <span style={{ background: "#2e1e3e", padding: "4px 8px", borderRadius: "4px" }}>
                    cashflow: {simulationData.cashflow?.length || 0}년치 (통합: amount + breakdown)
                  </span>
                </div>
              </div>
            </div>

            {/* ===== 3. UI 컴포넌트별 데이터 사용 ===== */}
            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ color: "#ec4899", marginBottom: "12px", fontSize: "14px" }}>
                🎨 3단계: UI 컴포넌트별 데이터 사용
              </h4>
              <div style={{ display: "grid", gap: "12px" }}>
                {/* Bar 차트 */}
                <div style={{ background: "#0f172a", padding: "12px", borderRadius: "8px", borderLeft: "4px solid #10b981" }}>
                  <div style={{ color: "#10b981", fontWeight: "600", marginBottom: "8px" }}>📊 Bar 차트 (RechartsAssetChart.jsx)</div>
                  <pre style={{ fontSize: "10px", color: "#64748b", margin: 0, background: "#1e293b", padding: "8px", borderRadius: "4px", overflow: "auto" }}>{`// props로 받음: data={simulationData.assets}
// 사용: item.totalAmount (차트 높이 결정)

// RechartsAssetChart.jsx:718
totalAmount: item.totalAmount || item.amount`}</pre>
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>
                    현재 값 (첫 해): <span style={{ color: "#10b981", fontWeight: "bold" }}>
                      {simulationData.assets?.[0]?.totalAmount?.toLocaleString() || 0}원
                    </span>
                  </div>
                </div>

                {/* 툴팁 */}
                <div style={{ background: "#0f172a", padding: "12px", borderRadius: "8px", borderLeft: "4px solid #3b82f6" }}>
                  <div style={{ color: "#3b82f6", fontWeight: "600", marginBottom: "8px" }}>💬 툴팁 (RechartsAssetChart.jsx)</div>
                  <pre style={{ fontSize: "10px", color: "#64748b", margin: 0, background: "#1e293b", padding: "8px", borderRadius: "4px", overflow: "auto" }}>{`// props로 받음: data={simulationData.assets} (통합 구조)
// 사용: item.breakdown.netAssets (순자산 표시)

// RechartsAssetChart.jsx
const netAssets = item?.breakdown?.netAssets || 0;`}</pre>
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>
                    현재 값 (첫 해): <span style={{ color: "#3b82f6", fontWeight: "bold" }}>
                      {simulationData.assets?.[0]?.breakdown?.netAssets?.toLocaleString() || 0}원
                    </span>
                  </div>
                </div>

                {/* 구성 Panel */}
                <div style={{ background: "#0f172a", padding: "12px", borderRadius: "8px", borderLeft: "4px solid #a855f7" }}>
                  <div style={{ color: "#a855f7", fontWeight: "600", marginBottom: "8px" }}>📋 구성 Panel (RechartsAssetChart.jsx)</div>
                  <pre style={{ fontSize: "10px", color: "#64748b", margin: 0, background: "#1e293b", padding: "8px", borderRadius: "4px", overflow: "auto" }}>{`// props로 받음: data={simulationData.assets} (통합 구조)
// 사용: item.breakdown.assetItems[], item.breakdown.debtItems[]

// RechartsAssetChart.jsx
const assetItems = item.breakdown.assetItems || [];
const debtItems = item.breakdown.debtItems || [];`}</pre>
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>
                    현재 값 (첫 해): 자산 <span style={{ color: "#22c55e", fontWeight: "bold" }}>
                      {simulationData.assets?.[0]?.breakdown?.assetItems?.length || 0}개
                    </span>, 부채 <span style={{ color: "#ef4444", fontWeight: "bold" }}>
                      {simulationData.assets?.[0]?.breakdown?.debtItems?.length || 0}개
                    </span>
                  </div>
                </div>

                {/* 비교 모달 */}
                <div style={{ background: "#0f172a", padding: "12px", borderRadius: "8px", borderLeft: "4px solid #f59e0b" }}>
                  <div style={{ color: "#f59e0b", fontWeight: "600", marginBottom: "8px" }}>🔀 비교 모달 (SimulationCompareModal.jsx)</div>
                  <pre style={{ fontSize: "10px", color: "#64748b", margin: 0, background: "#1e293b", padding: "8px", borderRadius: "4px", overflow: "auto" }}>{`// DashboardPage.jsx에서 props로 전달
<SimulationCompareModal
  currentSimulationData={{
    simulationData, incomes, expenses, savings, ...
  }}
/>

// SimulationCompareModal.jsx:275 - 현재 시뮬레이션은 props 사용
if (simId === currentSimulationId && currentSimulationData) {
  // Firestore 재호출 없이 props 데이터 사용!
}`}</pre>
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>
                    ✅ 현재 시뮬레이션: <span style={{ color: "#22c55e" }}>props로 전달 (Firestore 재호출 X)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== 4. 현재 값 일람 ===== */}
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ color: "#06b6d4", marginBottom: "12px", fontSize: "14px" }}>
                📊 4단계: 현재 값 일람 (첫 해 기준)
              </h4>
              {(() => {
                // 통합 구조: assets[0]에 totalAmount와 breakdown 모두 포함
                const firstAsset = simulationData.assets?.[0];
                const breakdown = firstAsset?.breakdown || {};
                const assetItemsSum = (breakdown.assetItems || []).reduce((sum, a) => sum + (a.amount || 0), 0);
                const debtItemsSum = (breakdown.debtItems || []).reduce((sum, d) => sum + Math.abs(d.amount || 0), 0);

                return (
                  <div style={{ background: "#0f172a", padding: "16px", borderRadius: "8px" }}>
                    <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #334155" }}>
                          <th style={{ textAlign: "left", padding: "8px", color: "#94a3b8" }}>데이터 경로</th>
                          <th style={{ textAlign: "right", padding: "8px", color: "#94a3b8" }}>값</th>
                          <th style={{ textAlign: "left", padding: "8px", color: "#94a3b8" }}>사용처</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "8px", color: "#10b981" }}>simulationData.assets[0].totalAmount</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#fff", fontWeight: "bold" }}>{(firstAsset?.totalAmount || 0).toLocaleString()}원</td>
                          <td style={{ padding: "8px", color: "#6b7280" }}>Bar 차트 높이</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "8px", color: "#3b82f6" }}>breakdown.netAssets</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#fff", fontWeight: "bold" }}>{(breakdown.netAssets || 0).toLocaleString()}원</td>
                          <td style={{ padding: "8px", color: "#6b7280" }}>툴팁 순자산</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "8px", color: "#22c55e" }}>breakdown.totalAssets</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#22c55e", fontWeight: "bold" }}>{(breakdown.totalAssets || 0).toLocaleString()}원</td>
                          <td style={{ padding: "8px", color: "#6b7280" }}>툴팁 총자산</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "8px", color: "#ef4444" }}>breakdown.totalDebt</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#ef4444", fontWeight: "bold" }}>{(breakdown.totalDebt || 0).toLocaleString()}원</td>
                          <td style={{ padding: "8px", color: "#6b7280" }}>툴팁 총부채</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "8px", color: "#a855f7" }}>Σ assetItems[].amount</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#a855f7", fontWeight: "bold" }}>{assetItemsSum.toLocaleString()}원</td>
                          <td style={{ padding: "8px", color: "#6b7280" }}>패널 자산 합계</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "8px", color: "#f59e0b" }}>Σ debtItems[].amount</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#f59e0b", fontWeight: "bold" }}>{debtItemsSum.toLocaleString()}원</td>
                          <td style={{ padding: "8px", color: "#6b7280" }}>패널 부채 합계</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "8px", color: "#06b6d4" }}>패널 계산 (자산 - 부채)</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#06b6d4", fontWeight: "bold" }}>{(assetItemsSum - debtItemsSum).toLocaleString()}원</td>
                          <td style={{ padding: "8px", color: "#6b7280" }}>패널 순자산</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 일치 여부 확인 */}
                    {(() => {
                      const val1 = firstAsset?.totalAmount || 0;
                      const val2 = breakdown.netAssets || 0;
                      const val3 = assetItemsSum - debtItemsSum;
                      const allMatch = Math.abs(val1 - val2) <= 1 && Math.abs(val1 - val3) <= 1;

                      return (
                        <div style={{
                          marginTop: "12px",
                          padding: "10px",
                          background: allMatch ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          borderRadius: "6px",
                          border: `1px solid ${allMatch ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                          textAlign: "center"
                        }}>
                          {allMatch ? (
                            <span style={{ color: "#22c55e", fontWeight: "600" }}>
                              ✅ 모든 값이 일치합니다! (Single Source of Truth 정상 작동)
                            </span>
                          ) : (
                            <span style={{ color: "#ef4444", fontWeight: "600" }}>
                              ⚠️ 값 불일치 발견 - cashflowSimulator.js 확인 필요
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>

            {/* ===== 5. 패널 상세 데이터 (assetItems, debtItems) ===== */}
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ color: "#a855f7", marginBottom: "12px", fontSize: "14px" }}>
                📋 5단계: 패널 상세 데이터 (첫 해 기준)
              </h4>
              {(() => {
                // 통합 구조: assets[0].breakdown에서 직접 가져옴
                const firstAsset = simulationData.assets?.[0];
                const breakdown = firstAsset?.breakdown || {};
                const assetItemsList = breakdown.assetItems || [];
                const debtItemsList = breakdown.debtItems || [];

                return (
                  <div style={{ background: "#0f172a", padding: "16px", borderRadius: "8px" }}>
                    {/* 생성 코드 설명 */}
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ color: "#f59e0b", fontWeight: "600", marginBottom: "8px" }}>생성 코드 (cashflowSimulator.js:3584~3665)</div>
                      <pre style={{ fontSize: "10px", color: "#64748b", margin: 0, background: "#1e293b", padding: "8px", borderRadius: "4px", overflow: "auto" }}>{`// assetItems 생성 - 각 데이터 소스에서 하나씩 push
if (currentCash > 0) {
  assetItems.push({ label: "현금", amount: currentCash, sourceType: "cash" });
}
Object.keys(savingsById).forEach((id) => {
  assetItems.push({ label: saving.title, amount: saving.amount, sourceType: "saving" });
});
Object.keys(pensionsByTitle).forEach((title) => {
  assetItems.push({ label: title, amount: pension.amount, sourceType: "pension" });
});
// ... realEstates, assets 도 동일

// debtItems 생성
Object.keys(debtsByTitle).forEach((title) => {
  debtItems.push({ label: title, amount: Math.abs(debt.amount), sourceType: "debt" });
});`}</pre>
                    </div>

                    {/* assetItems 상세 */}
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ color: "#22c55e", fontWeight: "600", marginBottom: "8px" }}>
                        assetItems[] ({assetItemsList.length}개)
                      </div>
                      {assetItemsList.length > 0 ? (
                        <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #334155" }}>
                              <th style={{ textAlign: "left", padding: "6px", color: "#94a3b8" }}>label</th>
                              <th style={{ textAlign: "right", padding: "6px", color: "#94a3b8" }}>amount</th>
                              <th style={{ textAlign: "left", padding: "6px", color: "#94a3b8" }}>sourceType</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assetItemsList.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #1e293b" }}>
                                <td style={{ padding: "6px", color: "#e2e8f0" }}>{item.label}</td>
                                <td style={{ padding: "6px", textAlign: "right", color: "#22c55e", fontWeight: "bold" }}>
                                  {(item.amount || 0).toLocaleString()}원
                                </td>
                                <td style={{ padding: "6px" }}>
                                  <span style={{
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "10px",
                                    background: item.sourceType === "cash" ? "#1e3a2e" :
                                               item.sourceType === "saving" ? "#1e2a3e" :
                                               item.sourceType === "pension" ? "#2e1e3e" :
                                               item.sourceType === "realEstate" ? "#3e2e1e" :
                                               "#1e3e2e",
                                    color: item.sourceType === "cash" ? "#10b981" :
                                           item.sourceType === "saving" ? "#3b82f6" :
                                           item.sourceType === "pension" ? "#a855f7" :
                                           item.sourceType === "realEstate" ? "#f59e0b" :
                                           "#22c55e"
                                  }}>
                                    {item.sourceType}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            <tr style={{ background: "#1e293b" }}>
                              <td style={{ padding: "6px", color: "#94a3b8", fontWeight: "bold" }}>합계</td>
                              <td style={{ padding: "6px", textAlign: "right", color: "#22c55e", fontWeight: "bold" }}>
                                {assetItemsList.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}원
                              </td>
                              <td style={{ padding: "6px" }}></td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ color: "#6b7280", fontSize: "11px" }}>데이터 없음</div>
                      )}
                    </div>

                    {/* debtItems 상세 */}
                    <div>
                      <div style={{ color: "#ef4444", fontWeight: "600", marginBottom: "8px" }}>
                        debtItems[] ({debtItemsList.length}개)
                      </div>
                      {debtItemsList.length > 0 ? (
                        <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #334155" }}>
                              <th style={{ textAlign: "left", padding: "6px", color: "#94a3b8" }}>label</th>
                              <th style={{ textAlign: "right", padding: "6px", color: "#94a3b8" }}>amount</th>
                              <th style={{ textAlign: "left", padding: "6px", color: "#94a3b8" }}>sourceType</th>
                            </tr>
                          </thead>
                          <tbody>
                            {debtItemsList.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #1e293b" }}>
                                <td style={{ padding: "6px", color: "#e2e8f0" }}>{item.label}</td>
                                <td style={{ padding: "6px", textAlign: "right", color: "#ef4444", fontWeight: "bold" }}>
                                  {(item.amount || 0).toLocaleString()}원
                                </td>
                                <td style={{ padding: "6px" }}>
                                  <span style={{
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "10px",
                                    background: "#3e1e1e",
                                    color: "#ef4444"
                                  }}>
                                    {item.sourceType}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            <tr style={{ background: "#1e293b" }}>
                              <td style={{ padding: "6px", color: "#94a3b8", fontWeight: "bold" }}>합계</td>
                              <td style={{ padding: "6px", textAlign: "right", color: "#ef4444", fontWeight: "bold" }}>
                                {debtItemsList.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}원
                              </td>
                              <td style={{ padding: "6px" }}></td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ color: "#6b7280", fontSize: "11px" }}>데이터 없음</div>
                      )}
                    </div>

                    {/* 데이터 흐름 요약 */}
                    <div style={{
                      marginTop: "16px",
                      padding: "12px",
                      background: "#1e293b",
                      borderRadius: "6px",
                      borderLeft: "3px solid #a855f7"
                    }}>
                      <div style={{ color: "#a855f7", fontWeight: "600", marginBottom: "6px" }}>📌 패널 데이터 흐름</div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.6" }}>
                        <div>1. <code style={{ color: "#f59e0b" }}>cashflowSimulator.js</code>에서 각 데이터 소스(현금, 저축, 연금, 부동산, 자산, 부채)를 순회</div>
                        <div>2. 각 항목을 <code style={{ color: "#22c55e" }}>assetItems[]</code> 또는 <code style={{ color: "#ef4444" }}>debtItems[]</code>에 push</div>
                        <div>3. <code style={{ color: "#3b82f6" }}>breakdown</code> 객체에 저장: {`{ assetItems, debtItems, totalAssets, totalDebt, netAssets }`}</div>
                        <div>4. <code style={{ color: "#a855f7" }}>RechartsAssetChart.jsx</code>에서 props로 받아서 패널에 표시</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ===== 6. Single Source of Truth 전체 구조 ===== */}
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ color: "#f59e0b", marginBottom: "12px", fontSize: "14px" }}>
                🏗️ 6단계: Single Source of Truth 전체 구조
              </h4>
              <div style={{ background: "#0f172a", padding: "16px", borderRadius: "8px" }}>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ color: "#ef4444", fontWeight: "600", marginBottom: "8px" }}>
                    ✅ 네, 모든 상세 데이터는 한 곳에서 관리됩니다!
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.8" }}>
                    <code style={{ color: "#f59e0b" }}>cashflowSimulator.js</code>에서 모든 계산이 이루어집니다.
                  </div>
                </div>

                {/* 전체 데이터 흐름 다이어그램 */}
                <div style={{ background: "#1e293b", padding: "16px", borderRadius: "8px", fontFamily: "monospace", fontSize: "10px" }}>
                  <div style={{ textAlign: "center", lineHeight: "2" }}>
                    <div style={{ color: "#f59e0b", fontWeight: "bold", marginBottom: "8px" }}>【 Firestore (원본 데이터) 】</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                      <span style={{ background: "#1e3a2e", padding: "4px 8px", borderRadius: "4px", color: "#10b981" }}>incomes</span>
                      <span style={{ background: "#3a2e1e", padding: "4px 8px", borderRadius: "4px", color: "#f59e0b" }}>expenses</span>
                      <span style={{ background: "#1e2a3e", padding: "4px 8px", borderRadius: "4px", color: "#3b82f6" }}>savings</span>
                      <span style={{ background: "#2e1e3e", padding: "4px 8px", borderRadius: "4px", color: "#a855f7" }}>pensions</span>
                      <span style={{ background: "#3e2e1e", padding: "4px 8px", borderRadius: "4px", color: "#f59e0b" }}>realEstates</span>
                      <span style={{ background: "#1e3e2e", padding: "4px 8px", borderRadius: "4px", color: "#22c55e" }}>assets</span>
                      <span style={{ background: "#3e1e1e", padding: "4px 8px", borderRadius: "4px", color: "#ef4444" }}>debts</span>
                    </div>

                    <div style={{ color: "#6b7280" }}>↓</div>

                    <div style={{ color: "#22c55e", fontWeight: "bold", margin: "8px 0" }}>【 cashflowSimulator.js 】</div>
                    <div style={{ fontSize: "9px", color: "#64748b", marginBottom: "8px" }}>
                      <div>savingsById, pensionsByTitle, realEstatesByTitle, assetsByTitle, debtsByTitle</div>
                      <div>↓ 연도별 순회하며 계산</div>
                    </div>

                    <div style={{ color: "#6b7280" }}>↓</div>

                    <div style={{ color: "#3b82f6", fontWeight: "bold", margin: "8px 0" }}>【 simulationData 】</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "8px" }}>
                      {/* 자산: 통합 구조 */}
                      <div style={{ background: "#1e3a2e", padding: "8px", borderRadius: "4px" }}>
                        <div style={{ color: "#10b981", fontWeight: "bold", fontSize: "10px" }}>자산 시뮬레이션</div>
                        <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                          <span style={{ background: "#0f172a", padding: "2px 6px", borderRadius: "3px", fontSize: "9px", color: "#10b981" }}>assets[]</span>
                        </div>
                        <div style={{ color: "#6b7280", fontSize: "8px", marginTop: "4px" }}>totalAmount + breakdown 포함 (통합)</div>
                      </div>
                      {/* 현금흐름: 통합 구조 */}
                      <div style={{ background: "#2e1e3e", padding: "8px", borderRadius: "4px" }}>
                        <div style={{ color: "#a855f7", fontWeight: "bold", fontSize: "10px" }}>현금흐름 시뮬레이션</div>
                        <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                          <span style={{ background: "#0f172a", padding: "2px 6px", borderRadius: "3px", fontSize: "9px", color: "#a855f7" }}>cashflow[]</span>
                        </div>
                        <div style={{ color: "#6b7280", fontSize: "8px", marginTop: "4px" }}>amount + breakdown 포함 (통합)</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "9px", color: "#22c55e", marginBottom: "8px", textAlign: "center" }}>
                      ✅ 자산/현금흐름 모두 통합 구조 - 각 배열에 breakdown 포함
                    </div>

                    <div style={{ color: "#6b7280" }}>↓</div>

                    <div style={{ color: "#ec4899", fontWeight: "bold", margin: "8px 0" }}>【 UI 컴포넌트 (props로 전달) 】</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ background: "#1e3a2e", padding: "6px 10px", borderRadius: "4px" }}>
                        <div style={{ color: "#10b981" }}>차트</div>
                      </div>
                      <div style={{ background: "#1e2a3e", padding: "6px 10px", borderRadius: "4px" }}>
                        <div style={{ color: "#3b82f6" }}>툴팁</div>
                      </div>
                      <div style={{ background: "#2e1e3e", padding: "6px 10px", borderRadius: "4px" }}>
                        <div style={{ color: "#a855f7" }}>패널</div>
                      </div>
                      <div style={{ background: "#3e2e1e", padding: "6px 10px", borderRadius: "4px" }}>
                        <div style={{ color: "#f59e0b" }}>비교모달</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 핵심 포인트 */}
                <div style={{
                  marginTop: "16px",
                  padding: "12px",
                  background: "rgba(34, 197, 94, 0.1)",
                  borderRadius: "6px",
                  border: "1px solid rgba(34, 197, 94, 0.3)"
                }}>
                  <div style={{ color: "#22c55e", fontWeight: "600", marginBottom: "8px" }}>✅ 핵심 포인트</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.8" }}>
                    <div>1. <strong style={{ color: "#fff" }}>원본 데이터</strong>: Firestore에 저장된 7가지 컬렉션</div>
                    <div>2. <strong style={{ color: "#fff" }}>계산 엔진</strong>: <code style={{ color: "#f59e0b" }}>cashflowSimulator.js</code> 하나에서 모든 계산</div>
                    <div>3. <strong style={{ color: "#fff" }}>파생 데이터</strong>: assetItems[], debtItems[], totalAssets, totalDebt, netAssets, totalAmount</div>
                    <div>4. <strong style={{ color: "#fff" }}>UI</strong>: 계산된 데이터를 props로 받아서 표시만 함 (재계산 없음)</div>
                  </div>
                </div>

                {/* 수정 시 영향 범위 */}
                <div style={{
                  marginTop: "12px",
                  padding: "12px",
                  background: "rgba(251, 191, 36, 0.1)",
                  borderRadius: "6px",
                  border: "1px solid rgba(251, 191, 36, 0.3)"
                }}>
                  <div style={{ color: "#fbbf24", fontWeight: "600", marginBottom: "8px" }}>🔧 수정 시 영향 범위</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.8" }}>
                    <div>• <code style={{ color: "#f59e0b" }}>cashflowSimulator.js</code> 수정 → 모든 UI에 자동 반영</div>
                    <div>• UI 컴포넌트는 props를 받아서 <strong style={{ color: "#fff" }}>표시만</strong> 하므로 별도 수정 불필요</div>
                    <div>• 비교 모달도 <strong style={{ color: "#fff" }}>같은 데이터</strong>를 props로 받음 (Firestore 재호출 X)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 수정 포인트 */}
            <div style={{
              padding: "12px",
              background: "rgba(34, 197, 94, 0.1)",
              borderRadius: "8px",
              border: "1px solid rgba(34, 197, 94, 0.3)"
            }}>
              <div style={{ color: "#22c55e", fontWeight: "600", marginBottom: "6px" }}>✅ 값을 바꾸려면?</div>
              <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                <code style={{ color: "#f59e0b" }}>src/utils/cashflowSimulator.js</code>에서 계산 로직 하나만 수정하면
                모든 UI (차트, 툴팁, 패널, 비교 모달)에 자동 반영됩니다.
              </div>
            </div>
          </div>
        )}

        {showDebugTable && simulationData && (
          <div style={{ overflowX: "auto" }}>
            {/* 데이터 소스 범례 */}
            <div style={{
              background: "#2d2d44",
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "13px",
            }}>
              <h4 style={{ color: "#fbbf24", marginBottom: "12px" }}>📋 3가지 데이터 소스 비교 (같은 시뮬레이션 결과 내에서)</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                <div style={{ padding: "10px", background: "#1e3a2e", borderRadius: "6px", borderLeft: "4px solid #10b981" }}>
                  <strong style={{ color: "#10b981" }}>1. Bar 차트</strong>
                  <div style={{ color: "#a0a0b0", fontSize: "11px", marginTop: "4px" }}>
                    자산: <code>assets[].totalAmount</code><br/>
                    현금흐름: <code>cashflow[].amount</code>
                  </div>
                </div>
                <div style={{ padding: "10px", background: "#1e2a3e", borderRadius: "6px", borderLeft: "4px solid #3b82f6" }}>
                  <strong style={{ color: "#3b82f6" }}>2. 툴팁</strong>
                  <div style={{ color: "#a0a0b0", fontSize: "11px", marginTop: "4px" }}>
                    자산: <code>breakdown.netAssets</code><br/>
                    현금흐름: <code>amount</code> (동일)
                  </div>
                </div>
                <div style={{ padding: "10px", background: "#2e1e3e", borderRadius: "6px", borderLeft: "4px solid #a855f7" }}>
                  <strong style={{ color: "#a855f7" }}>3. 구성 Panel</strong>
                  <div style={{ color: "#a0a0b0", fontSize: "11px", marginTop: "4px" }}>
                    자산: <code>Σ assetItems - Σ debtItems</code><br/>
                    현금흐름: <code>Σ positives - Σ negatives</code>
                  </div>
                </div>
              </div>
            </div>

            {/* === 자산 시뮬레이션: 3가지 데이터 소스 비교 === */}
            <h3 style={{ color: "#10b981", marginTop: "20px", marginBottom: "10px" }}>
              📊 자산 시뮬레이션 - 3가지 데이터 소스 비교 (순자산 기준)
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", color: "#e5e5e5" }}>
              <thead>
                <tr style={{ background: "#3b3b5c" }}>
                  <th style={{ padding: "8px", border: "1px solid #444", width: "60px" }}>년도</th>
                  <th style={{ padding: "8px", border: "1px solid #444", background: "#1e3a2e", color: "#10b981" }}>
                    <div>1. Bar 차트</div>
                    <div style={{ fontSize: "10px", color: "#888" }}>assets[].totalAmount</div>
                  </th>
                  <th style={{ padding: "8px", border: "1px solid #444", background: "#1e2a3e", color: "#3b82f6" }}>
                    <div>2. 툴팁</div>
                    <div style={{ fontSize: "10px", color: "#888" }}>breakdown.netAssets</div>
                  </th>
                  <th style={{ padding: "8px", border: "1px solid #444", background: "#2e1e3e", color: "#a855f7" }}>
                    <div>3. 구성 Panel</div>
                    <div style={{ fontSize: "10px", color: "#888" }}>Σassets - Σdebts</div>
                  </th>
                  <th style={{ padding: "8px", border: "1px solid #444", width: "100px" }}>일치 여부</th>
                </tr>
              </thead>
              <tbody>
                {(simulationData.assets || []).map((item, idx) => {
                  // 통합 구조: item에 totalAmount와 breakdown 모두 포함
                  // 1. Bar 차트 값 (totalAmount)
                  const barChartValue = item?.totalAmount || 0;

                  // 2. 툴팁 값 (breakdown.netAssets)
                  const tooltipValue = item.breakdown?.netAssets || 0;

                  // 3. 구성 Panel 값 (assetItems 합계 - debtItems 합계)
                  const assetItemsSum = (item.breakdown?.assetItems || []).reduce((sum, a) => sum + (a.amount || 0), 0);
                  const debtItemsSum = (item.breakdown?.debtItems || []).reduce((sum, d) => sum + Math.abs(d.amount || 0), 0);
                  const panelValue = assetItemsSum - debtItemsSum;

                  // 불일치 체크 (1원 허용 오차)
                  const mismatch1_2 = Math.abs(barChartValue - tooltipValue) > 1;
                  const mismatch1_3 = Math.abs(barChartValue - panelValue) > 1;
                  const hasMismatch = mismatch1_2 || mismatch1_3;

                  return (
                    <tr key={idx} style={{ background: hasMismatch ? "#4a1c1c" : idx % 2 === 0 ? "#252538" : "#1e1e30" }}>
                      <td style={{ padding: "6px", border: "1px solid #444", fontWeight: "bold" }}>{item.year}</td>
                      <td style={{ padding: "6px", border: "1px solid #444", textAlign: "right", background: "#1e3a2e", color: "#10b981" }}>
                        {barChartValue.toLocaleString()}
                      </td>
                      <td style={{
                        padding: "6px",
                        border: "1px solid #444",
                        textAlign: "right",
                        background: mismatch1_2 ? "#4a1c1c" : "#1e2a3e",
                        color: mismatch1_2 ? "#ef4444" : "#3b82f6"
                      }}>
                        {tooltipValue.toLocaleString()}
                        {mismatch1_2 && <span style={{ marginLeft: "4px", fontSize: "10px" }}>({(tooltipValue - barChartValue).toLocaleString()})</span>}
                      </td>
                      <td style={{
                        padding: "6px",
                        border: "1px solid #444",
                        textAlign: "right",
                        background: mismatch1_3 ? "#4a1c1c" : "#2e1e3e",
                        color: mismatch1_3 ? "#ef4444" : "#a855f7"
                      }}>
                        {panelValue.toLocaleString()}
                        {mismatch1_3 && <span style={{ marginLeft: "4px", fontSize: "10px" }}>({(panelValue - barChartValue).toLocaleString()})</span>}
                      </td>
                      <td style={{ padding: "6px", border: "1px solid #444", textAlign: "center", fontWeight: "bold" }}>
                        {hasMismatch ? (
                          <span style={{ color: "#ef4444" }}>❌ 불일치</span>
                        ) : (
                          <span style={{ color: "#10b981" }}>✓ 일치</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* === 현금흐름 시뮬레이션: 3가지 데이터 소스 비교 === */}
            <h3 style={{ color: "#3b82f6", marginTop: "40px", marginBottom: "10px" }}>
              💰 현금흐름 시뮬레이션 - 3가지 데이터 소스 비교 (순현금흐름 기준)
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", color: "#e5e5e5" }}>
              <thead>
                <tr style={{ background: "#3b3b5c" }}>
                  <th style={{ padding: "8px", border: "1px solid #444", width: "60px" }}>년도</th>
                  <th style={{ padding: "8px", border: "1px solid #444", background: "#1e3a2e", color: "#10b981" }}>
                    <div>1. Bar 차트</div>
                    <div style={{ fontSize: "10px", color: "#888" }}>amount</div>
                  </th>
                  <th style={{ padding: "8px", border: "1px solid #444", background: "#1e2a3e", color: "#3b82f6" }}>
                    <div>2. 툴팁</div>
                    <div style={{ fontSize: "10px", color: "#888" }}>amount (동일)</div>
                  </th>
                  <th style={{ padding: "8px", border: "1px solid #444", background: "#2e1e3e", color: "#a855f7" }}>
                    <div>3. 구성 Panel</div>
                    <div style={{ fontSize: "10px", color: "#888" }}>Σpositives - Σnegatives</div>
                  </th>
                  <th style={{ padding: "8px", border: "1px solid #444", width: "100px" }}>일치 여부</th>
                </tr>
              </thead>
              <tbody>
                {(simulationData.cashflow || []).map((item, idx) => {
                  // 1. Bar 차트 값 (amount)
                  const barChartValue = item.amount || 0;

                  // 2. 툴팁 값 - 현금흐름은 data.amount를 그대로 사용함
                  const tooltipValue = item.amount || 0;

                  // 3. 구성 Panel 값 (positives 합계 - negatives 합계)
                  const positivesSum = (item.breakdown?.positives || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                  const negativesSum = (item.breakdown?.negatives || []).reduce((sum, n) => sum + Math.abs(n.amount || 0), 0);
                  const panelValue = positivesSum - negativesSum;

                  // 불일치 체크 (1원 허용 오차)
                  const mismatch1_2 = Math.abs(barChartValue - tooltipValue) > 1;
                  const mismatch1_3 = Math.abs(barChartValue - panelValue) > 1;
                  const hasMismatch = mismatch1_2 || mismatch1_3;

                  return (
                    <tr key={idx} style={{ background: hasMismatch ? "#4a1c1c" : idx % 2 === 0 ? "#252538" : "#1e1e30" }}>
                      <td style={{ padding: "6px", border: "1px solid #444", fontWeight: "bold" }}>{item.year}</td>
                      <td style={{ padding: "6px", border: "1px solid #444", textAlign: "right", background: "#1e3a2e", color: barChartValue >= 0 ? "#10b981" : "#ef4444" }}>
                        {barChartValue.toLocaleString()}
                      </td>
                      <td style={{
                        padding: "6px",
                        border: "1px solid #444",
                        textAlign: "right",
                        background: mismatch1_2 ? "#4a1c1c" : "#1e2a3e",
                        color: mismatch1_2 ? "#ef4444" : "#3b82f6"
                      }}>
                        {tooltipValue.toLocaleString()}
                        {mismatch1_2 && <span style={{ marginLeft: "4px", fontSize: "10px" }}>({(tooltipValue - barChartValue).toLocaleString()})</span>}
                      </td>
                      <td style={{
                        padding: "6px",
                        border: "1px solid #444",
                        textAlign: "right",
                        background: mismatch1_3 ? "#4a1c1c" : "#2e1e3e",
                        color: mismatch1_3 ? "#ef4444" : "#a855f7"
                      }}>
                        {panelValue.toLocaleString()}
                        {mismatch1_3 && <span style={{ marginLeft: "4px", fontSize: "10px" }}>({(panelValue - barChartValue).toLocaleString()})</span>}
                      </td>
                      <td style={{ padding: "6px", border: "1px solid #444", textAlign: "center", fontWeight: "bold" }}>
                        {hasMismatch ? (
                          <span style={{ color: "#ef4444" }}>❌ 불일치</span>
                        ) : (
                          <span style={{ color: "#10b981" }}>✓ 일치</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* === 불일치 요약 === */}
            <div style={{
              marginTop: "30px",
              padding: "16px",
              background: "#2d2d44",
              borderRadius: "8px",
            }}>
              <h4 style={{ color: "#fbbf24", marginBottom: "12px" }}>📈 불일치 요약</h4>
              {(() => {
                // 통합 구조: assets에 totalAmount와 breakdown 모두 포함
                const assetMismatches = (simulationData.assets || []).filter(item => {
                  const barChartValue = item?.totalAmount || 0;
                  const tooltipValue = item.breakdown?.netAssets || 0;
                  const assetItemsSum = (item.breakdown?.assetItems || []).reduce((sum, a) => sum + (a.amount || 0), 0);
                  const debtItemsSum = (item.breakdown?.debtItems || []).reduce((sum, d) => sum + Math.abs(d.amount || 0), 0);
                  const panelValue = assetItemsSum - debtItemsSum;

                  return Math.abs(barChartValue - tooltipValue) > 1 ||
                         Math.abs(barChartValue - panelValue) > 1;
                });

                const cashflowMismatches = (simulationData.cashflow || []).filter(item => {
                  const barChartValue = item.amount || 0;
                  const tooltipValue = item.amount || 0; // 현금흐름 툴팁은 amount 그대로 사용
                  const positivesSum = (item.breakdown?.positives || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                  const negativesSum = (item.breakdown?.negatives || []).reduce((sum, n) => sum + Math.abs(n.amount || 0), 0);
                  const panelValue = positivesSum - negativesSum;

                  return Math.abs(barChartValue - tooltipValue) > 1 ||
                         Math.abs(barChartValue - panelValue) > 1;
                });

                const totalYears = (simulationData.assets || []).length;
                const assetMismatchCount = assetMismatches.length;
                const cashflowMismatchCount = cashflowMismatches.length;

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div style={{
                      padding: "12px",
                      background: assetMismatchCount > 0 ? "#4a1c1c" : "#1a3a2e",
                      borderRadius: "6px"
                    }}>
                      <div style={{ color: "#10b981", fontWeight: "bold", marginBottom: "8px" }}>자산 시뮬레이션</div>
                      {assetMismatchCount > 0 ? (
                        <>
                          <div style={{ color: "#ef4444", fontSize: "18px", fontWeight: "bold" }}>
                            ❌ {assetMismatchCount}개 년도 불일치
                          </div>
                          <div style={{ color: "#888", fontSize: "11px", marginTop: "4px" }}>
                            불일치 년도: {assetMismatches.map(m => m.year).join(", ")}
                          </div>
                        </>
                      ) : (
                        <div style={{ color: "#10b981", fontSize: "18px", fontWeight: "bold" }}>
                          ✓ 전체 {totalYears}개 년도 일치
                        </div>
                      )}
                    </div>
                    <div style={{
                      padding: "12px",
                      background: cashflowMismatchCount > 0 ? "#4a1c1c" : "#1a3a2e",
                      borderRadius: "6px"
                    }}>
                      <div style={{ color: "#3b82f6", fontWeight: "bold", marginBottom: "8px" }}>현금흐름 시뮬레이션</div>
                      {cashflowMismatchCount > 0 ? (
                        <>
                          <div style={{ color: "#ef4444", fontSize: "18px", fontWeight: "bold" }}>
                            ❌ {cashflowMismatchCount}개 년도 불일치
                          </div>
                          <div style={{ color: "#888", fontSize: "11px", marginTop: "4px" }}>
                            불일치 년도: {cashflowMismatches.map(m => m.year).join(", ")}
                          </div>
                        </>
                      ) : (
                        <div style={{ color: "#10b981", fontSize: "18px", fontWeight: "bold" }}>
                          ✓ 전체 {(simulationData.cashflow || []).length}개 년도 일치
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ProfileMemoPanel = React.memo(function ProfileMemoPanel({
  memo,
  onSave,
  isSaving,
  isDisabled,
}) {
  const [value, setValue] = useState(memo || "");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setValue(memo || "");
    setIsDirty(false);
  }, [memo]);

  const handleChange = (event) => {
    if (isDisabled) return;
    const nextValue = event.target.value;
    setValue(nextValue);
    setIsDirty(nextValue !== (memo || ""));
  };

  const handleSave = () => {
    if (isDisabled || !isDirty || isSaving) return;
    onSave?.(value);
  };

  return (
    <div className={styles.profileMemoSection}>
      <div className={styles.profileMemoHeader}>
        <label className={styles.profileMemoLabel} htmlFor="profileMemo">
          프로필 메모
        </label>
        <button
          className={styles.profileMemoSaveButton}
          type="button"
          onClick={handleSave}
          disabled={isDisabled || isSaving || !isDirty}
        >
          {isSaving ? "저장 중..." : "저장"}
        </button>
      </div>
      <textarea
        id="profileMemo"
        className={styles.profileMemoTextarea}
        value={value}
        onChange={handleChange}
        placeholder={
          isDisabled
            ? "수정하려면 회원가입이 필요합니다."
            : "프로필 전반에 대한 메모를 기록하세요."
        }
        disabled={isDisabled}
      />
    </div>
  );
});

export default DashboardPage;
const SimulationMemoPanel = React.memo(function SimulationMemoPanel({
  memo,
  onSave,
  isSaving,
  isDisabled,
}) {
  const [value, setValue] = useState(memo || "");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setValue(memo || "");
    setIsDirty(false);
  }, [memo]);

  const handleChange = (event) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    setIsDirty(nextValue !== (memo || ""));
  };

  const handleSave = () => {
    if (isDisabled || !isDirty || isSaving) return;
    onSave?.(value);
  };

  return (
    <div className={styles.sidebarMemoSection}>
      <div className={styles.memoHeader}>
        <span className={styles.memoTitle}>시뮬레이션 메모</span>
        <button
          className={styles.memoSaveButton}
          onClick={handleSave}
          disabled={isDisabled || !isDirty || isSaving}
          type="button"
        >
          {isSaving ? "저장 중..." : "저장"}
        </button>
      </div>
      <textarea
        className={styles.memoTextarea}
        placeholder={
          isDisabled
            ? "수정하려면 회원가입이 필요합니다."
            : "메모를 작성하세요."
        }
        value={value}
        onChange={handleChange}
        disabled={isDisabled}
      />
    </div>
  );
});

// AI 프롬프트 모달 (ref를 내부에서 관리)
const AIPromptModal = React.memo(function AIPromptModal({
  aiPrompts,
  isSavingPrompts,
  isGeneratingAI,
  onClose,
  onSave,
  onExtractSingle,
  onExtractCompare,
  canCompare,
}) {
  const [singlePrompt, setSinglePrompt] = useState(
    aiPrompts.singlePrompt || ""
  );
  const [comparePrompt, setComparePrompt] = useState(
    aiPrompts.comparePrompt || ""
  );

  useEffect(() => {
    setSinglePrompt(aiPrompts.singlePrompt || "");
    setComparePrompt(aiPrompts.comparePrompt || "");
  }, [aiPrompts.singlePrompt, aiPrompts.comparePrompt]);

  // 모달 열릴 때 배경 스크롤 막기
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleSave = () => {
    onSave({ singlePrompt, comparePrompt });
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.aiOptionModal}>
        <div className={styles.aiOptionHeader}>
          <h3 className={styles.aiOptionTitle}>AI 데이터 추출 옵션</h3>
          <button className={styles.aiOptionCloseButton} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.aiOptionContent}>
          <div className={styles.aiPromptSettingPanel}>
            <div className={styles.aiPromptGrid}>
              {/* 단일 분석 컬럼 */}
              <div className={styles.aiPromptColumn}>
                <button
                  className={styles.aiExtractButton}
                  onClick={onExtractSingle}
                  disabled={isGeneratingAI}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  해당 시뮬레이션만 추출
                </button>
                <div className={styles.aiPromptField}>
                  <label className={styles.aiPromptLabel}>
                    단일 분석 프롬프트
                  </label>
                  <textarea
                    className={styles.aiPromptTextarea}
                    value={singlePrompt}
                    onChange={(e) => setSinglePrompt(e.target.value)}
                    placeholder="단일 시뮬레이션 분석용 프롬프트를 입력하세요..."
                  />
                </div>
              </div>

              {/* 비교 분석 컬럼 */}
              <div className={styles.aiPromptColumn}>
                <button
                  className={styles.aiExtractButton}
                  onClick={onExtractCompare}
                  disabled={isGeneratingAI || !canCompare}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M9 15h6" />
                  </svg>
                  기본 시뮬레이션과 비교 추출
                </button>
                <div className={styles.aiPromptField}>
                  <label className={styles.aiPromptLabel}>
                    비교 분석 프롬프트
                  </label>
                  <textarea
                    className={styles.aiPromptTextarea}
                    value={comparePrompt}
                    onChange={(e) => setComparePrompt(e.target.value)}
                    placeholder="비교 분석용 프롬프트를 입력하세요..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.aiOptionFooter}>
          <button className={styles.aiOptionCancelButton} onClick={onClose}>
            닫기
          </button>
          <button
            className={styles.aiPromptSaveButton}
            onClick={handleSave}
            disabled={isSavingPrompts}
          >
            {isSavingPrompts ? "저장 중..." : "프롬프트 저장"}
          </button>
        </div>
      </div>
    </div>
  );
});
