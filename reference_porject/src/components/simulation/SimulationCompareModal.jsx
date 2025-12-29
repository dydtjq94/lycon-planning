import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import styles from "./SimulationCompareModal.module.css";
import incomeStyles from "../income/IncomeList.module.css";
import expenseStyles from "../expense/ExpenseList.module.css";
import savingStyles from "../saving/SavingList.module.css";
import pensionStyles from "../pension/PensionList.module.css";
import realEstateStyles from "../realestate/RealEstateList.module.css";
import assetStyles from "../asset/AssetList.module.css";
import debtStyles from "../debt/DebtList.module.css";
import IncomeList from "../income/IncomeList";
import ExpenseList from "../expense/ExpenseList";
import SavingList from "../saving/SavingList";
import PensionList from "../pension/PensionList";
import RealEstateList from "../realestate/RealEstateList";
import AssetList from "../asset/AssetList";
import DebtList from "../debt/DebtList";
import IncomeModal from "../income/IncomeModal";
import ExpenseModal from "../expense/ExpenseModal";
import SavingModal from "../saving/SavingModal";
import PensionModal from "../pension/PensionModal";
import RealEstateModal from "../realestate/RealEstateModal";
import AssetModal from "../asset/AssetModal";
import DebtModal from "../debt/DebtModal";
import { calculateLifetimeCashFlowTotals } from "../../utils/presentValueCalculator";
import { formatAmountForChart, formatAmount } from "../../utils/format";
import {
  calculateAssetSimulation,
  calculateCashflowSimulation,
} from "../../utils/cashflowSimulator";
import { trackEvent } from "../../libs/mixpanel";
import {
  incomeService,
  expenseService,
  savingsService,
  pensionService,
  realEstateService,
  assetService,
  debtService,
} from "../../services/firestoreService";

const categoryConfigs = [
  {
    key: "incomes",
    label: "소득",
    component: IncomeList,
    propName: "incomes",
    modalComponent: IncomeModal,
  },
  {
    key: "expenses",
    label: "지출",
    component: ExpenseList,
    propName: "expenses",
    modalComponent: ExpenseModal,
  },
  {
    key: "savings",
    label: "저축/투자",
    component: SavingList,
    propName: "savings",
    modalComponent: SavingModal,
  },
  {
    key: "pensions",
    label: "연금",
    component: PensionList,
    propName: "pensions",
    modalComponent: PensionModal,
  },
  {
    key: "realEstates",
    label: "부동산",
    component: RealEstateList,
    propName: "realEstates",
    modalComponent: RealEstateModal,
  },
  {
    key: "assets",
    label: "자산",
    component: AssetList,
    propName: "assets",
    modalComponent: AssetModal,
  },
  {
    key: "debts",
    label: "부채",
    component: DebtList,
    propName: "debts",
    modalComponent: DebtModal,
  },
];

// 컴포넌트 외부로 이동: cashflow 데이터 필터링 함수 (React Hook 의존성 문제 해결)
const filterCashflowByPeriod = (cashflow, period, retirementYear) => {
  if (!cashflow || !retirementYear) return cashflow;

  switch (period) {
    case "beforeRetirement": // 은퇴전(포함)
      return cashflow.filter((cf) => cf.year <= retirementYear);
    case "afterRetirement": // 은퇴 이후
      return cashflow.filter((cf) => cf.year > retirementYear);
    case "all": // 전체
    default:
      return cashflow;
  }
};

const parseNumericInput = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

function SimulationCompareModal({
  isOpen,
  onClose,
  isLoading,
  defaultTitle,
  targetTitle,
  defaultData,
  targetData,
  profileData,
  currentSimulationId,
  simulations,
  onDataRefresh, // 데이터 새로고침 콜백 추가
  currentSimulationData, // DashboardPage에서 이미 계산된 데이터 (Firestore 재호출 방지)
}) {
  // 선택된 시뮬레이션 ID 목록 (현재 시뮬레이션은 항상 포함)
  const defaultSimulationEntry = useMemo(
    () => simulations?.find((sim) => sim.isDefault) || simulations?.[0],
    [simulations]
  );

  const [selectedSimulationIds, setSelectedSimulationIds] = useState(() => {
    const defaultSimId =
      simulations?.find((sim) => sim.isDefault)?.id || simulations?.[0]?.id;
    return defaultSimId ? [defaultSimId] : [];
  });

  // 선택된 시뮬레이션들의 데이터
  const [simulationsData, setSimulationsData] = useState({});

  // 데이터 로딩 상태
  const [isDataLoading, setIsDataLoading] = useState(false);

  // 세부 항목 토글 상태 (기본값: 접혀있음)
  const [expandedRows, setExpandedRows] = useState({});

  // 생애 자금 공급/수요 탭 상태 (기본값: 전체)
  const [cashflowPeriod, setCashflowPeriod] = useState("all");

  // 메인 탭 상태 (기본값: 생애 자금)
  const [activeTab, setActiveTab] = useState("cashflow");

  // 순자산 차트 기간 필터 상태 (기본값: 전체)
  const [netWorthPeriod, setNetWorthPeriod] = useState("all");

  // 재무 데이터 수정 모달 상태
  const [editModal, setEditModal] = useState({
    isOpen: false,
    type: null, // 'income', 'expense', 'saving', etc.
    data: null,
    simulationId: null, // 수정할 시뮬레이션 ID
  });

  // 시뮬레이션 데이터 로드 함수
  const fetchSimulationData = useCallback(
    async (simulationId) => {
      if (!profileData?.id || !simulationId) return null;

      try {
        const [
          incomeData,
          expenseData,
          savingData,
          pensionData,
          realEstateData,
          assetsData,
          debtData,
        ] = await Promise.all([
          incomeService.getIncomes(profileData.id, simulationId),
          expenseService.getExpenses(profileData.id, simulationId),
          savingsService.getSavings(profileData.id, simulationId),
          pensionService.getPensions(profileData.id, simulationId),
          realEstateService.getRealEstates(profileData.id, simulationId),
          assetService.getAssets(profileData.id, simulationId),
          debtService.getDebts(profileData.id, simulationId),
        ]);

        const sortByCreatedAt = (list) =>
          list
            ? [...list].sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
              )
            : [];

        const incomes = sortByCreatedAt(incomeData);
        const expenses = sortByCreatedAt(expenseData);
        const savings = sortByCreatedAt(savingData);
        const pensions = sortByCreatedAt(pensionData);
        const realEstates = sortByCreatedAt(realEstateData);
        const assets = sortByCreatedAt(assetsData);
        const debts = sortByCreatedAt(debtData);

        // 해당 시뮬레이션의 투자 규칙 및 인출 규칙 가져오기
        const simulation = simulations.find((sim) => sim.id === simulationId);
        const profileDataWithSimulation = {
          ...profileData,
          cashflowInvestmentRules: simulation?.cashflowInvestmentRules || {},
          assetWithdrawalRules: simulation?.assetWithdrawalRules || {},
          retirementYear:
            simulation?.retirementYear || profileData?.retirementYear,
        };

        // cashflow 계산 (투자 규칙이 포함된 profileData 사용)
        const cashflow = calculateCashflowSimulation(
          profileDataWithSimulation,
          incomes,
          expenses,
          savings,
          pensions,
          realEstates,
          assets,
          debts
        );

        return {
          incomes,
          expenses,
          savings,
          pensions,
          realEstates,
          assets,
          debts,
          cashflow,
        };
      } catch (error) {
        console.error(`시뮬레이션 ${simulationId} 데이터 로드 오류:`, error);
        return null;
      }
    },
    [profileData, simulations]
  );

  // 선택된 시뮬레이션들의 데이터 로드
  useEffect(() => {
    if (!isOpen || selectedSimulationIds.length === 0) return;

    const loadData = async () => {
      setIsDataLoading(true);
      const newData = {};

      for (const simId of selectedSimulationIds) {
        // 현재 시뮬레이션은 props로 받은 데이터 사용 (Firestore 재호출 방지)
        if (simId === currentSimulationId && currentSimulationData) {
          const { simulationData, incomes, expenses, savings, pensions, realEstates, assets, debts } = currentSimulationData;
          newData[simId] = {
            incomes: incomes || [],
            expenses: expenses || [],
            savings: savings || [],
            pensions: pensions || [],
            realEstates: realEstates || [],
            assets: assets || [],
            debts: debts || [],
            cashflow: simulationData?.cashflow || [],
          };
        } else {
          // 다른 시뮬레이션은 Firestore에서 로드
          const data = await fetchSimulationData(simId);
          if (data) {
            newData[simId] = data;
          }
        }
      }

      if (Object.keys(newData).length > 0) {
        setSimulationsData(newData);
      }
      setIsDataLoading(false);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedSimulationIds, fetchSimulationData, currentSimulationId, currentSimulationData]);

  // 모달이 열릴 때 초기 선택 설정
  useEffect(() => {
    if (isOpen) {
      // 모달이 열리면 기본 시뮬레이션과 현재 활성 시뮬레이션을 선택
      const defaultSimId =
        simulations?.find((sim) => sim.isDefault)?.id || simulations?.[0]?.id;
      const activeSimId = currentSimulationId;

      const initialSelection = new Set();
      if (defaultSimId) initialSelection.add(defaultSimId);
      if (activeSimId && activeSimId !== defaultSimId)
        initialSelection.add(activeSimId);

      if (initialSelection.size > 0) {
        setSelectedSimulationIds(Array.from(initialSelection));
      }
    } else {
      // 모달이 닫히면 선택을 기본으로 리셋하고 캐시 초기화
      const defaultSimId =
        simulations?.find((sim) => sim.isDefault)?.id || simulations?.[0]?.id;
      if (defaultSimId) {
        setSelectedSimulationIds([defaultSimId]);
      }
      // 캐시된 데이터 초기화하여 다음에 열 때 최신 데이터 로드
      setSimulationsData({});
    }
  }, [isOpen, simulations, currentSimulationId]);

  // 시뮬레이션 선택 토글
  const handleToggleSimulation = (simulationId) => {
    const defaultSimId = defaultSimulationEntry?.id;

    // "현재" 시뮬레이션은 항상 선택되어 있어야 함
    if (simulationId === defaultSimId) {
      return;
    }

    setSelectedSimulationIds((prev) => {
      if (prev.includes(simulationId)) {
        // 이미 선택되어 있으면 제거 (최소 1개는 유지)
        return prev.length > 1
          ? prev.filter((id) => id !== simulationId)
          : prev;
      } else {
        // 선택 추가
        return [...prev, simulationId];
      }
    });
  };

  // 재무 데이터 수정 핸들러
  const handleEditData = (type, data, simulationId) => {
    setEditModal({
      isOpen: true,
      type: type,
      data: data,
      simulationId: simulationId,
    });

    trackEvent("시뮬레이션 비교 모달에서 재무 데이터 수정 시작", {
      type: type,
      dataTitle: data?.title || "",
      simulationId: simulationId,
    });
  };

  // 재무 데이터 삭제 핸들러
  const handleDeleteData = async (type, itemId, simulationId) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) {
      return;
    }

    try {
      if (!profileData?.id) {
        throw new Error("프로필 ID가 없습니다.");
      }

      // 각 타입별 서비스 선택
      const serviceMap = {
        income: incomeService,
        expense: expenseService,
        saving: savingsService,
        pension: pensionService,
        realEstate: realEstateService,
        asset: assetService,
        debt: debtService,
      };

      const service = serviceMap[type];
      if (!service) {
        throw new Error(`알 수 없는 데이터 타입: ${type}`);
      }

      const deleteMethodName = `delete${
        type.charAt(0).toUpperCase() + type.slice(1)
      }`;
      await service[deleteMethodName](profileData.id, simulationId, itemId);

      trackEvent("시뮬레이션 비교 모달에서 재무 데이터 삭제 완료", {
        type: type,
        simulationId: simulationId,
      });

      // 로컬 state 즉시 업데이트 (깜빡임 없이 즉시 반영)
      const updatedData = await fetchSimulationData(simulationId);
      if (updatedData) {
        setSimulationsData((prev) => ({
          ...prev,
          [simulationId]: updatedData,
        }));
      }

      // onDataRefresh는 호출하지 않음 (비교 모달이 새로고침되는 것을 방지)
    } catch (error) {
      console.error(`❌ [시뮬레이션 비교] ${type} 데이터 삭제 오류:`, error);
      alert(`삭제 중 오류가 발생했습니다: ${error.message}`);

      trackEvent("시뮬레이션 비교 모달에서 재무 데이터 삭제 오류", {
        type: type,
        error: error.message,
      });
    }
  };

  // 재무 데이터 수정 모달 닫기
  const handleCloseEditModal = () => {
    setEditModal({
      isOpen: false,
      type: null,
      data: null,
      simulationId: null,
    });
  };

  // 재무 데이터 저장 핸들러
  const handleSaveFinancialData = async (type, data) => {
    try {
      // profileId가 없으면 오류
      if (!profileData?.id) {
        throw new Error("프로필 ID가 없습니다.");
      }

      // 저장할 시뮬레이션 ID 목록
      const simulationIdsToSave =
        data.selectedSimulationIds ||
        (currentSimulationId ? [currentSimulationId] : []);

      if (simulationIdsToSave.length === 0) {
        throw new Error("적용할 시뮬레이션을 선택해주세요.");
      }

      // 각 타입별 서비스 선택
      const serviceMap = {
        income: incomeService,
        expense: expenseService,
        saving: savingsService,
        pension: pensionService,
        realEstate: realEstateService,
        asset: assetService,
        debt: debtService,
      };

      const service = serviceMap[type];
      if (!service) {
        throw new Error(`알 수 없는 데이터 타입: ${type}`);
      }

      // 수정 모드인지 확인 (editData에 id가 있으면 수정)
      const isEditMode = data.id ? true : false;

      // 각 시뮬레이션에 저장
      for (const simId of simulationIdsToSave) {
        if (isEditMode) {
          // 수정 모드: 해당 시뮬레이션에 같은 ID가 있는지 확인
          const updateMethodName = `update${
            type.charAt(0).toUpperCase() + type.slice(1)
          }`;
          const createWithIdMethodName = `create${
            type.charAt(0).toUpperCase() + type.slice(1)
          }WithId`;

          // 해당 시뮬레이션의 데이터 가져오기
          const getMethodName = `get${
            type.charAt(0).toUpperCase() + type.slice(1)
          }s`;
          const existingItems = await service[getMethodName](
            profileData.id,
            simId
          );
          const existingItem = existingItems.find(
            (item) => item.id === data.id
          );

          if (existingItem) {
            // 같은 ID가 있으면 업데이트
            await service[updateMethodName](
              profileData.id,
              simId,
              data.id,
              data
            );
          } else {
            // 같은 ID가 없으면 새로 생성 (ID 유지)
            if (service[createWithIdMethodName]) {
              await service[createWithIdMethodName](
                profileData.id,
                simId,
                data.id,
                data
              );
            } else {
              console.warn(
                `⚠️ createWithId 메서드가 없음: ${createWithIdMethodName}`
              );
            }
          }
        } else {
          // 추가 모드: 새로 생성
          const createMethodName = `create${
            type.charAt(0).toUpperCase() + type.slice(1)
          }`;
          await service[createMethodName](profileData.id, simId, data);
        }
      }

      // 저장 성공
      trackEvent("시뮬레이션 비교 모달에서 재무 데이터 저장 완료", {
        type: type,
        isEditMode: isEditMode,
        simulationCount: simulationIdsToSave.length,
      });

      // 로컬 state 즉시 업데이트 (깜빡임 없이 즉시 반영)
      // 영향을 받은 시뮬레이션들의 데이터 다시 로드
      // editModal.simulationId도 포함하여 확실히 업데이트
      const affectedSimIdsSet = new Set(simulationIdsToSave);
      if (editModal.simulationId) {
        affectedSimIdsSet.add(editModal.simulationId);
      }
      const affectedSimIds = Array.from(affectedSimIdsSet).filter((id) =>
        selectedSimulationIds.includes(id)
      );

      if (affectedSimIds.length > 0) {
        const updatedData = {};
        for (const simId of affectedSimIds) {
          const data = await fetchSimulationData(simId);
          if (data) {
            updatedData[simId] = data;
          }
        }
        if (Object.keys(updatedData).length > 0) {
          // 상태 업데이트 (비교 모달 내에서만 반영, 새로고침 없음)
          setSimulationsData((prev) => ({ ...prev, ...updatedData }));
        }
      }

      // onDataRefresh는 호출하지 않음 (비교 모달이 새로고침되는 것을 방지)
      // 모달을 닫을 때 부모에게 알려서 대시보드 리스트만 업데이트됨

      // 편집 모달 닫기
      handleCloseEditModal();
    } catch (error) {
      console.error(`❌ [시뮬레이션 비교] ${type} 데이터 저장 오류:`, error);
      alert(`저장 중 오류가 발생했습니다: ${error.message}`);

      trackEvent("시뮬레이션 비교 모달에서 재무 데이터 저장 오류", {
        type: type,
        error: error.message,
      });
    }
  };

  // 재무 데이터 수정 모달 렌더링 함수 (React 내부 오류 방지)
  const renderEditModal = () => {
    if (!editModal.isOpen) return null;

    const commonProps = {
      isOpen: editModal.isOpen,
      onClose: handleCloseEditModal,
      profileId: profileData?.id,
      profileData: profileData,
      editData: editModal.data,
      activeSimulationId: editModal.simulationId || currentSimulationId,
      simulations: simulations,
    };

    switch (editModal.type) {
      case "income":
        return (
          <IncomeModal
            key="income-modal"
            {...commonProps}
            onSave={(data) => handleSaveFinancialData("income", data)}
          />
        );
      case "expense":
        return (
          <ExpenseModal
            key="expense-modal"
            {...commonProps}
            onSave={(data) => handleSaveFinancialData("expense", data)}
          />
        );
      case "saving":
        return (
          <SavingModal
            key="saving-modal"
            {...commonProps}
            onSave={(data) => handleSaveFinancialData("saving", data)}
          />
        );
      case "pension":
        return (
          <PensionModal
            key="pension-modal"
            {...commonProps}
            onSave={(data) => handleSaveFinancialData("pension", data)}
          />
        );
      case "realEstate":
        return (
          <RealEstateModal
            key="realEstate-modal"
            {...commonProps}
            onSave={(data) => handleSaveFinancialData("realEstate", data)}
          />
        );
      case "asset":
        return (
          <AssetModal
            key="asset-modal"
            {...commonProps}
            onSave={(data) => handleSaveFinancialData("asset", data)}
          />
        );
      case "debt":
        return (
          <DebtModal
            key="debt-modal"
            {...commonProps}
            onSave={(data) => handleSaveFinancialData("debt", data)}
          />
        );
      default:
        return null;
    }
  };

  // 재무 데이터를 현재 시뮬레이션 기준으로 정렬하는 함수
  const sortByCurrentSimulation = (data, currentData) => {
    if (!Array.isArray(data) || data.length === 0) return data;
    if (!Array.isArray(currentData) || currentData.length === 0) return data;

    // 현재 시뮬레이션의 ID 목록 추출
    const currentIds = new Set(
      currentData.map((item) => item.id).filter(Boolean)
    );

    // 데이터를 두 그룹으로 나눔
    const itemsWithCurrentId = []; // 현재 시뮬레이션에 있는 ID
    const itemsWithoutCurrentId = []; // 새로 추가된 ID

    data.forEach((item) => {
      if (item.id && currentIds.has(item.id)) {
        itemsWithCurrentId.push(item);
      } else {
        itemsWithoutCurrentId.push(item);
      }
    });

    // 현재 시뮬레이션의 ID 순서대로 정렬
    const currentIdOrder = currentData.map((item) => item.id).filter(Boolean);
    itemsWithCurrentId.sort((a, b) => {
      const indexA = currentIdOrder.indexOf(a.id);
      const indexB = currentIdOrder.indexOf(b.id);
      return indexA - indexB;
    });

    // 현재 시뮬레이션에 있는 항목들을 먼저, 새로 추가된 항목들은 뒤에
    return [...itemsWithCurrentId, ...itemsWithoutCurrentId];
  };

  // 카테고리별 필드 정의 (비교용)
  const categoryFieldDefinitions = {
    incomes: [
      { key: "title", label: "제목", format: (v) => v },
      {
        key: "originalAmount",
        label: "금액",
        format: (v, item) =>
          `${formatAmount(v)}/${
            item.originalFrequency === "monthly" ? "월" : "년"
          }`,
      },
      { key: "startYear", label: "시작년도", format: (v) => `${v}년` },
      { key: "endYear", label: "종료년도", format: (v) => `${v}년` },
      { key: "growthRate", label: "상승률", format: (v) => `${v}%` },
      { key: "memo", label: "메모", format: (v) => v || "-" },
    ],
    expenses: [
      { key: "title", label: "제목", format: (v) => v },
      {
        key: "amount",
        label: "금액",
        format: (v, item) =>
          `${formatAmount(v)}/${item.frequency === "monthly" ? "월" : "년"}`,
      },
      { key: "startYear", label: "시작년도", format: (v) => `${v}년` },
      { key: "endYear", label: "종료년도", format: (v) => `${v}년` },
      { key: "growthRate", label: "상승률", format: (v) => `${v}%` },
      { key: "memo", label: "메모", format: (v) => v || "-" },
    ],
    savings: [
      { key: "title", label: "제목", format: (v) => v },
      {
        key: "currentAmount",
        label: "기 보유",
        format: (v) => (v > 0 ? formatAmount(v) : "-"),
      },
      {
        key: "originalAmount",
        label: "납입액",
        format: (v, item) =>
          `${formatAmount(v)}/${
            item.originalFrequency === "monthly"
              ? "월"
              : item.originalFrequency === "yearly"
              ? "년"
              : "일회성"
          }`,
      },
      { key: "startYear", label: "시작년도", format: (v) => `${v}년` },
      { key: "endYear", label: "종료년도", format: (v) => `${v}년` },
      {
        key: "interestRate",
        label: "연평균 수익률",
        format: (v) => `${(v * 100).toFixed(2)}%`,
      },
      {
        key: "yearlyGrowthRate",
        label: "저축/투자액 증가율",
        format: (v) => (v > 0 ? `${(v * 100).toFixed(2)}%` : "-"),
      },
      { key: "memo", label: "메모", format: (v) => v || "-" },
    ],
    pensions: [
      { key: "title", label: "제목", format: (v) => v },
      {
        key: "type",
        label: "연금 타입",
        format: (v) => {
          switch (v) {
            case "national":
              return "국민연금";
            case "retirement":
              return "퇴직연금";
            case "personal":
              return "개인연금";
            case "severance":
              return "퇴직금/DB";
            default:
              return "연금";
          }
        },
      },
      {
        key: "monthlyAmount",
        label: "월 수령액",
        format: (v) => formatAmount(v),
      },
      {
        key: "currentAmount",
        label: "기 보유",
        format: (v) => (v > 0 ? formatAmount(v) : "-"),
      },
      {
        key: "contributionAmount",
        label: "납입액",
        format: (v, item) =>
          v > 0
            ? `${formatAmount(v)}/${
                item.contributionFrequency === "monthly" ? "월" : "년"
              }`
            : "-",
      },
      {
        key: "returnRate",
        label: "연평균 수익률",
        format: (v) => (v ? `${v}%` : "-"),
      },
      {
        key: "inflationRate",
        label: "물가상승률",
        format: (v) => (v ? `${v}%` : "-"),
      },
      { key: "memo", label: "메모", format: (v) => v || "-" },
    ],
    realEstates: [
      { key: "title", label: "제목", format: (v) => v },
      {
        key: "currentValue",
        label: "부동산 가치",
        format: (v) => formatAmount(v),
      },
      {
        key: "growthRate",
        label: "연평균 가치 상승률",
        format: (v) => `${v.toFixed(2)}%`,
      },
      { key: "startYear", label: "시작년도", format: (v) => `${v}년` },
      { key: "endYear", label: "종료년도", format: (v) => `${v}년` },
      {
        key: "hasRentalIncome",
        label: "임대 수입",
        format: (v) => (v ? "있음" : "-"),
      },
      {
        key: "convertToPension",
        label: "주택연금",
        format: (v) => (v ? "전환" : "-"),
      },
      { key: "memo", label: "메모", format: (v) => v || "-" },
    ],
    assets: [
      { key: "title", label: "제목", format: (v) => v },
      {
        key: "currentValue",
        label: "현재 가치",
        format: (v) => formatAmount(v),
      },
      { key: "startYear", label: "시작년도", format: (v) => `${v}년` },
      { key: "endYear", label: "종료년도", format: (v) => `${v}년` },
      {
        key: "growthRate",
        label: "가치 상승률",
        format: (v) => `${(v * 100).toFixed(2)}%`,
      },
      { key: "memo", label: "메모", format: (v) => v || "-" },
    ],
    debts: [
      { key: "title", label: "제목", format: (v) => v },
      {
        key: "debtAmount",
        label: "부채 금액",
        format: (v) => formatAmount(v),
      },
      {
        key: "debtType",
        label: "상환 방식",
        format: (v) => {
          switch (v) {
            case "bullet":
              return "만기일시상환";
            case "equal":
              return "원리금균등상환";
            case "principal":
              return "원금균등상환";
            case "grace":
              return "거치식상환";
            default:
              return "알 수 없음";
          }
        },
      },
      {
        key: "gracePeriod",
        label: "거치 기간",
        format: (v) => (v > 0 ? `${v}년` : "-"),
      },
      { key: "startYear", label: "시작년도", format: (v) => `${v}년` },
      { key: "endYear", label: "종료년도", format: (v) => `${v}년` },
      {
        key: "interestRate",
        label: "이자율",
        format: (v) => `${(v * 100).toFixed(2)}%`,
      },
      { key: "memo", label: "메모", format: (v) => v || "-" },
    ],
  };

  // 두 항목의 필드를 비교하여 변경사항 반환
  const compareItems = (item1, item2, fields) => {
    const changes = [];
    fields.forEach((field) => {
      const val1 = item1?.[field.key];
      const val2 = item2?.[field.key];

      // 값이 다른 경우만 변경으로 간주
      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        changes.push({
          fieldKey: field.key,
          fieldLabel: field.label,
          oldValue: val1,
          newValue: val2,
          format: field.format,
        });
      }
    });
    return changes;
  };

  // 재무 항목의 주요 정보를 렌더링하는 함수 (카테고리별)
  const renderItemMainInfo = (item, config, changedFields = []) => {
    const type = config.key;

    // 카테고리별 색상 클래스명 매핑
    const categoryColorClass = {
      incomes: "income",
      expenses: "expense",
      savings: "saving",
      pensions: "pension",
      realEstates: "realEstate",
      assets: "asset",
      debts: "debt",
    }[type];

    // 필드가 변경되었는지 확인하는 헬퍼 함수
    const isFieldChanged = (fieldKey) =>
      changedFields.some((c) => c.fieldKey === fieldKey);

    // 변경 표시 아이콘
    const changeIndicator = <span className={styles.changeIndicator}>*</span>;

    switch (type) {
      case "incomes":
        return (
          <>
            <div className={incomeStyles.incomeAmount}>
              {isFieldChanged("originalAmount") && changeIndicator}
              {formatAmount(item.originalAmount)}/
              {item.originalFrequency === "monthly" ? "월" : "년"}
            </div>
            <div className={incomeStyles.incomePeriod}>
              {isFieldChanged("startYear") && changeIndicator}
              {item.startYear}년 -{" "}
              {isFieldChanged("endYear") && changeIndicator}
              {item.endYear}년
              <br />
              (상승률 {isFieldChanged("growthRate") && changeIndicator}
              {item.growthRate}% 적용)
            </div>
            {item.memo && (
              <div className={incomeStyles.incomeMemo}>
                {isFieldChanged("memo") && changeIndicator}
                {item.memo}
              </div>
            )}
          </>
        );

      case "expenses":
        return (
          <>
            <div className={expenseStyles.expenseAmount}>
              {isFieldChanged("amount") && changeIndicator}
              {formatAmount(item.amount)}/
              {item.frequency === "monthly" ? "월" : "년"}
            </div>
            <div className={expenseStyles.expensePeriod}>
              {isFieldChanged("startYear") && changeIndicator}
              {item.startYear}년 -{" "}
              {isFieldChanged("endYear") && changeIndicator}
              {item.endYear}년
              <br />
              (물가 상승률 {isFieldChanged("growthRate") && changeIndicator}
              {item.growthRate}% 적용)
            </div>
            {item.memo && (
              <div className={expenseStyles.expenseMemo}>
                {isFieldChanged("memo") && changeIndicator}
                {item.memo}
              </div>
            )}
          </>
        );

      case "savings":
        return (
          <>
            {/* 시작 보유액 표시 */}
            {item.currentAmount !== undefined &&
              item.currentAmount !== null &&
              item.currentAmount > 0 && (
                <div className={savingStyles.savingCurrent}>
                  기 보유: {formatAmount(item.currentAmount)}
                </div>
              )}

            {/* 납입 주기 및 금액 */}
            <div className={savingStyles.savingFrequency}>
              {isFieldChanged("originalAmount") && changeIndicator}
              {formatAmount(item.originalAmount)}/
              {item.originalFrequency === "monthly"
                ? "월"
                : item.originalFrequency === "yearly"
                ? "년"
                : "일회성"}
            </div>

            <div className={savingStyles.savingPeriod}>
              {isFieldChanged("startYear") && changeIndicator}
              {item.startYear}년 -{" "}
              {isFieldChanged("endYear") && changeIndicator}
              {item.endYear}년
              <br />
              (연평균 수익률 {isFieldChanged("interestRate") && changeIndicator}
              {(item.interestRate * 100).toFixed(2)}% 적용
              {item.yearlyGrowthRate > 0 &&
                `, 저축/투자액 증가율 ${
                  isFieldChanged("yearlyGrowthRate") ? "*" : ""
                }${(item.yearlyGrowthRate * 100).toFixed(2)}%`}
              )
            </div>

            {item.memo && (
              <div className={savingStyles.savingMemo}>
                {isFieldChanged("memo") && changeIndicator}
                {item.memo}
              </div>
            )}
          </>
        );

      case "pensions":
        return (
          <>
            {item.type === "national" ? (
              // 국민연금
              <>
                <div className={pensionStyles.pensionAmount}>
                  {isFieldChanged("monthlyAmount") && changeIndicator}
                  {formatAmount(item.monthlyAmount)}/월
                </div>
                <div className={pensionStyles.pensionPeriod}>
                  {isFieldChanged("startYear") && changeIndicator}
                  {item.startYear}년 -{" "}
                  {isFieldChanged("endYear") && changeIndicator}
                  {item.endYear}년
                  <br />
                  (물가상승률{" "}
                  {isFieldChanged("inflationRate") && changeIndicator}
                  {item.inflationRate || 2.5}% 적용)
                </div>
              </>
            ) : (
              // 퇴직연금/개인연금/퇴직금
              <>
                {item.currentAmount > 0 && (
                  <div className={pensionStyles.pensionCurrentAmount}>
                    {item.type === "severance" ? "퇴직금" : "기 보유"}:{" "}
                    {formatAmount(item.currentAmount)}
                  </div>
                )}
                {/* 추가 적립이 있는 경우만 적립 금액 표시 */}
                {item.contributionAmount > 0 &&
                  !(
                    item.type === "severance" && item.noAdditionalContribution
                  ) && (
                    <div className={pensionStyles.pensionAmount}>
                      {isFieldChanged("contributionAmount") && changeIndicator}
                      {formatAmount(item.contributionAmount)}/
                      {item.contributionFrequency === "monthly" ? "월" : "년"}
                    </div>
                  )}
                <div className={pensionStyles.pensionPeriod}>
                  {/* 추가 적립이 있는 경우만 적립 기간 표시 */}
                  {item.type === "severance" &&
                  !item.noAdditionalContribution ? (
                    <>
                      적립: {item.contributionStartYear}년 -{" "}
                      {item.contributionEndYear}년
                      <br />
                    </>
                  ) : item.type !== "severance" ? (
                    <>
                      적립: {item.contributionStartYear}년 -{" "}
                      {item.contributionEndYear}년
                      <br />
                    </>
                  ) : null}
                  수령: {item.paymentStartYear}년부터{" "}
                  {item.paymentYears ||
                    (item.paymentEndYear
                      ? item.paymentEndYear - item.paymentStartYear + 1
                      : 10)}
                  년간
                  <br />
                  (연평균 수익률{" "}
                  {isFieldChanged("returnRate") && changeIndicator}
                  {item.returnRate}% 적용, 연금인출 방식(PMT))
                </div>
              </>
            )}
            {item.memo && (
              <div className={pensionStyles.pensionMemo}>
                {isFieldChanged("memo") && changeIndicator}
                {item.memo}
              </div>
            )}
          </>
        );

      case "realEstates":
        return (
          <>
            <div className={realEstateStyles.realEstateValue}>
              {isFieldChanged("currentValue") && changeIndicator}
              부동산 가치: {formatAmount(item.currentValue)}
            </div>
            <div className={realEstateStyles.realEstateRate}>
              연평균 가치 상승률:{" "}
              {isFieldChanged("growthRate") && changeIndicator}
              {item.growthRate.toFixed(2)}%
            </div>
            <div className={realEstateStyles.realEstatePeriod}>
              {isFieldChanged("startYear") && changeIndicator}
              {item.startYear}년 -{" "}
              {isFieldChanged("endYear") && changeIndicator}
              {item.endYear}년
            </div>

            {item.hasRentalIncome && (
              <div className={realEstateStyles.rentalInfo}>
                <div className={realEstateStyles.rentalPeriod}>
                  임대 수입: {item.rentalIncomeStartYear}년 -{" "}
                  {item.rentalIncomeEndYear}년
                </div>
                <div className={realEstateStyles.rentalAmount}>
                  월 임대 수입: {formatAmount(item.monthlyRentalIncome)}/월
                </div>
              </div>
            )}

            {item.convertToPension && (
              <div className={realEstateStyles.pensionInfo}>
                <div className={realEstateStyles.pensionPeriod}>
                  주택연금: {item.pensionStartYear}년 - {item.pensionEndYear}년
                </div>
                <div className={realEstateStyles.pensionAmount}>
                  월 수령액: {formatAmount(item.monthlyPensionAmount)}/월
                </div>
              </div>
            )}

            {item.memo && (
              <div className={realEstateStyles.memo}>
                <span className={realEstateStyles.memoText}>
                  {isFieldChanged("memo") && changeIndicator}
                  {item.memo}
                </span>
              </div>
            )}
          </>
        );

      case "assets":
        return (
          <>
            <div className={assetStyles.assetAmount}>
              {isFieldChanged("currentValue") && changeIndicator}
              {formatAmount(item.currentValue)}
            </div>
            <div className={assetStyles.assetPeriod}>
              {isFieldChanged("startYear") && changeIndicator}
              {item.startYear}년 -{" "}
              {isFieldChanged("endYear") && changeIndicator}
              {item.endYear}년
              <br />
              (연평균 가치 상승률{" "}
              {isFieldChanged("growthRate") && changeIndicator}
              {(item.growthRate * 100).toFixed(2)}% 적용
              {item.assetType === "income" &&
                item.incomeRate > 0 &&
                `, 연간 수익률 (배당, 이자 등) ${
                  isFieldChanged("incomeRate") ? "*" : ""
                }${(item.incomeRate * 100).toFixed(2)}%`}
              )
            </div>
            {item.memo && (
              <div className={assetStyles.assetMemo}>
                {isFieldChanged("memo") && changeIndicator}
                {item.memo}
              </div>
            )}
          </>
        );

      case "debts":
        return (
          <>
            <div className={debtStyles.debtAmount}>
              {isFieldChanged("debtAmount") && changeIndicator}
              {formatAmount(-Math.abs(item.debtAmount))}
            </div>

            <div className={debtStyles.debtDetails}>
              <div className={debtStyles.debtType}>
                {item.debtType === "bullet"
                  ? "만기일시상환"
                  : item.debtType === "equal"
                  ? "원리금균등상환"
                  : item.debtType === "principal"
                  ? "원금균등상환"
                  : item.debtType === "grace"
                  ? "거치식상환"
                  : "알 수 없음"}
                {item.debtType === "grace" && item.gracePeriod > 0 && (
                  <span className={debtStyles.gracePeriod}>
                    (거치 {item.gracePeriod}년)
                  </span>
                )}
              </div>
              <div className={debtStyles.debtPeriod}>
                {isFieldChanged("startYear") && changeIndicator}
                {item.startYear}년 -{" "}
                {isFieldChanged("endYear") && changeIndicator}
                {item.endYear}년
                <br />
                (이자율 {isFieldChanged("interestRate") && changeIndicator}
                {(item.interestRate * 100).toFixed(2)}% 적용)
              </div>
            </div>

            {item.memo && (
              <div className={debtStyles.debtMemo}>
                {isFieldChanged("memo") && changeIndicator}
                {item.memo}
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  // 상세 재무 항목 렌더링 (변경사항 표시)
  const renderDetailedFinancialItem = (
    item,
    config,
    baseItem,
    isFirstColumn,
    simulationId
  ) => {
    const type = config.key;
    const fields = categoryFieldDefinitions[type] || [];

    // 상태 판별
    const isNew = !baseItem && item;
    const isRemoved = baseItem && !item && isFirstColumn;
    const isModified = baseItem && item;

    // 변경된 필드 찾기
    let changedFields = [];
    if (isModified) {
      changedFields = compareItems(baseItem, item, fields);
    }

    if (!item && !isRemoved) {
      return (
        <div className={styles.detailedFinancialItem}>
          <div className={styles.detailedItemInfo}>
            <span className={styles.empty}>-</span>
          </div>
        </div>
      );
    }

    const displayItem = item || baseItem;

    return (
      <div
        className={`${styles.detailedFinancialItem} ${
          isNew ? styles.detailedItemNew : ""
        } ${isRemoved ? styles.detailedItemRemoved : ""} ${
          changedFields.length > 0 ? styles.detailedItemModified : ""
        }`}
      >
        <div
          className={styles.detailedItemInfo}
          onClick={() => {
            if (item) {
              handleEditData(config.key.slice(0, -1), item, simulationId);
            }
          }}
        >
          <div className={styles.detailedItemHeader}>
            <h4 className={styles.detailedItemTitle}>{displayItem.title}</h4>
            <div className={styles.detailedItemActions}>
              <div className={styles.detailedItemBadges}>
                {isNew && <span className={styles.badgeNew}>신규</span>}
                {isRemoved && (
                  <span className={styles.badgeRemoved}>삭제됨</span>
                )}
                {changedFields.length > 0 && !isNew && (
                  <span className={styles.badgeModified}>수정됨</span>
                )}
              </div>
              {item && !isRemoved && (
                <button
                  className={styles.detailedItemDeleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteData(
                      config.key.slice(0, -1),
                      item.id,
                      simulationId
                    );
                  }}
                  title="삭제"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* 기존 IncomeList와 동일한 형식으로 주요 정보 표시 (변경된 필드에 * 표시) */}
          {renderItemMainInfo(displayItem, config, changedFields)}
        </div>
      </div>
    );
  };

  // renderList 함수 - onEdit 핸들러 추가 + 정렬 적용
  const renderList = (config, data, currentData) => {
    const Component = config.component;
    if (!Component) {
      return <div className={styles.empty}>지원되지 않는 카테고리입니다.</div>;
    }

    // 현재 시뮬레이션 기준으로 데이터 정렬
    const sortedData = sortByCurrentSimulation(data, currentData);

    const props = {
      [config.propName]: sortedData || [],
      onEdit: (item) => handleEditData(config.key.slice(0, -1), item), // 's' 제거 (incomes -> income)
      onDelete: () => {}, // 읽기 전용이므로 삭제는 비활성화
      isReadOnly: false, // 클릭 가능하게 설정
    };

    return (
      <div className={styles.listWrapper}>
        <Component {...props} />
      </div>
    );
  };

  // 토글 함수
  const toggleRow = (rowKey) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  };

  // 은퇴년도 계산
  const retirementYear = useMemo(() => {
    const explicitYear = parseNumericInput(profileData?.retirementYear);
    if (explicitYear !== null) return explicitYear;
    if (!profileData?.birthYear || !profileData?.retirementAge) return null;
    const currentYear = new Date().getFullYear();
    const currentAge = currentYear - parseInt(profileData.birthYear, 10);
    return currentYear + (parseInt(profileData.retirementAge, 10) - currentAge);
  }, [profileData]);

  // 시뮬레이션별 은퇴년도/나이 매핑
  const retirementYearBySimulation = useMemo(() => {
    const fallbackYear = retirementYear;
    const map = {};

    simulations?.forEach((sim) => {
      const simYear = parseNumericInput(sim?.retirementYear);
      if (sim?.id) {
        map[sim.id] =
          simYear !== null && Number.isFinite(simYear) ? simYear : fallbackYear;
      }
    });

    return map;
  }, [simulations, retirementYear]);

  const retirementAgeBySimulation = useMemo(() => {
    const birth = parseNumericInput(profileData?.birthYear);
    const map = {};
    if (!Number.isFinite(birth)) return map;

    Object.entries(retirementYearBySimulation).forEach(([simId, year]) => {
      if (Number.isFinite(year)) {
        map[simId] = year - birth;
      }
    });

    return map;
  }, [retirementYearBySimulation, profileData]);

  // 선택된 시뮬레이션들의 생애 자금 공급/수요 계산
  const simulationsPV = useMemo(() => {
    if (!isOpen || !profileData) return {};

    const result = {};
    selectedSimulationIds.forEach((simId) => {
      const simData = simulationsData[simId];
      if (!simData) return;

      // 해당 시뮬레이션의 투자 규칙 및 인출 규칙을 반영하여 cashflow 재계산
      const simulation = simulations?.find((sim) => sim.id === simId);
      const simulationRetirementYear =
        retirementYearBySimulation[simId] ?? retirementYear;
      const profileDataWithSimulation = {
        ...profileData,
        cashflowInvestmentRules: simulation?.cashflowInvestmentRules || {},
        assetWithdrawalRules: simulation?.assetWithdrawalRules || {},
        retirementYear: simulationRetirementYear ?? profileData?.retirementYear,
      };

      // 투자 규칙 및 인출 규칙이 반영된 최신 cashflow 계산
      const cashflow = calculateCashflowSimulation(
        profileDataWithSimulation,
        simData.incomes || [],
        simData.expenses || [],
        simData.savings || [],
        simData.pensions || [],
        simData.realEstates || [],
        simData.assets || [],
        simData.debts || []
      );

      const filteredCashflow = filterCashflowByPeriod(
        cashflow,
        cashflowPeriod,
        simulationRetirementYear
      );
      result[simId] = calculateLifetimeCashFlowTotals(filteredCashflow);
    });

    return result;
  }, [
    selectedSimulationIds,
    simulationsData,
    profileData,
    simulations,
    isOpen,
    cashflowPeriod,
    retirementYear,
    retirementYearBySimulation,
  ]);

  // 선택된 시뮬레이션들의 자산 타임라인 계산
  const simulationsAssetsTimeline = useMemo(() => {
    if (!profileData || !isOpen) return {};

    const result = {};
    selectedSimulationIds.forEach((simId) => {
      const simData = simulationsData[simId];
      if (!simData) return;

      // 해당 시뮬레이션의 투자 규칙 및 인출 규칙을 반영하여 cashflow 재계산
      const simulation = simulations?.find((sim) => sim.id === simId);
      const simulationRetirementYear =
        retirementYearBySimulation[simId] ?? retirementYear;
      const profileDataWithSimulation = {
        ...profileData,
        cashflowInvestmentRules: simulation?.cashflowInvestmentRules || {},
        assetWithdrawalRules: simulation?.assetWithdrawalRules || {},
        retirementYear: simulationRetirementYear ?? profileData?.retirementYear,
      };

      // 투자 규칙 및 인출 규칙이 반영된 최신 cashflow 계산
      const cashflow = calculateCashflowSimulation(
        profileDataWithSimulation,
        simData.incomes || [],
        simData.expenses || [],
        simData.savings || [],
        simData.pensions || [],
        simData.realEstates || [],
        simData.assets || [],
        simData.debts || []
      );

      // 통합 구조: calculateAssetSimulation이 직접 배열 반환 (각 항목에 breakdown 포함)
      const assetResult = calculateAssetSimulation(
        profileDataWithSimulation,
        simData.incomes || [],
        simData.expenses || [],
        simData.savings || [],
        simData.pensions || [],
        simData.realEstates || [],
        simData.assets || [],
        cashflow, // 재계산된 cashflow 사용
        simData.debts || []
      );
      result[simId] = assetResult;
    });

    return result;
  }, [
    selectedSimulationIds,
    simulationsData,
    profileData,
    isOpen,
    simulations,
    retirementYear,
    retirementYearBySimulation,
  ]);

  const currentAssetsBySimulation = useMemo(() => {
    if (!profileData) return {};

    const currentYear = new Date().getFullYear();

    const toNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const ensureVisibleYear = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : currentYear;
    };

    const result = {};

    selectedSimulationIds.forEach((simId) => {
      const simData = simulationsData[simId];
      if (!simData) return;

      const savingsTotal = (simData.savings || []).reduce((sum, saving) => {
        const startYear = ensureVisibleYear(saving?.startYear);
        if (startYear <= currentYear) {
          return sum + toNumber(saving?.currentAmount);
        }
        return sum;
      }, 0);

      const assetsTotal = (simData.assets || []).reduce((sum, asset) => {
        const startYear = ensureVisibleYear(asset?.startYear);
        if (startYear <= currentYear) {
          return sum + toNumber(asset?.currentValue);
        }
        return sum;
      }, 0);

      const realEstatesTotal = (simData.realEstates || []).reduce(
        (sum, realEstate) => {
          const startYear = ensureVisibleYear(realEstate?.startYear);
          if (startYear <= currentYear) {
            return sum + toNumber(realEstate?.currentValue);
          }
          return sum;
        },
        0
      );

      const pensionsTotal = (simData.pensions || []).reduce((sum, pension) => {
        const startYear = ensureVisibleYear(pension?.contributionStartYear);
        if (startYear <= currentYear) {
          return sum + toNumber(pension?.currentAmount);
        }
        return sum;
      }, 0);

      const debtsTotal = (simData.debts || []).reduce((sum, debt) => {
        const startYear = ensureVisibleYear(debt?.startYear);
        if (startYear <= currentYear) {
          return sum + toNumber(debt?.debtAmount);
        }
        return sum;
      }, 0);

      const currentCash = toNumber(profileData.currentCash);

      const netWorth =
        currentCash +
        savingsTotal +
        assetsTotal +
        realEstatesTotal +
        pensionsTotal -
        debtsTotal;

      result[simId] = {
        currentCash,
        savingsTotal,
        assetsTotal,
        realEstatesTotal,
        pensionsTotal,
        debtsTotal: -Math.abs(debtsTotal),
        netWorth,
      };
    });

    return result;
  }, [profileData, selectedSimulationIds, simulationsData]);

  // 선택된 시뮬레이션 개수로 컬럼 수 결정
  const valueColumnCount = selectedSimulationIds.length;
  const gridTemplateColumns = `minmax(160px, 1.2fr) repeat(${valueColumnCount}, minmax(140px, 1fr))`;

  // 각 시뮬레이션의 타이틀 가져오기
  const getSimulationTitle = (simId) => {
    const sim = simulations?.find((s) => s.id === simId);
    return sim?.title || (sim?.isDefault ? "현재" : "시뮬레이션");
  };

  // 선택된 시뮬레이션들을 정렬 (기본 시뮬레이션 "현재"가 먼저 오도록)
  const sortedSelectedSimulationIds = useMemo(() => {
    if (!simulations || selectedSimulationIds.length === 0)
      return selectedSimulationIds;

    // 기본 시뮬레이션(isDefault)을 먼저, 나머지는 simulations 배열 순서대로
    const selectedSims = simulations.filter((sim) =>
      selectedSimulationIds.includes(sim.id)
    );

    // isDefault가 true인 것을 먼저, 나머지는 원래 순서 유지
    selectedSims.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return 0;
    });

    return selectedSims.map((sim) => sim.id);
  }, [simulations, selectedSimulationIds]);

  const summaryRows = useMemo(() => {
    const rows = [];

    // 자금 공급
    const supplyRow = {
      key: "supply",
      label: "자금 공급 (총)",
      values: {},
      breakdowns: {},
    };

    sortedSelectedSimulationIds.forEach((simId) => {
      const pv = simulationsPV[simId];
      supplyRow.values[simId] = pv?.totalSupply ?? null;
      supplyRow.breakdowns[simId] = pv?.supply || [];
    });
    rows.push(supplyRow);

    // 자금 수요
    const demandRow = {
      key: "demand",
      label: "자금 수요 (총)",
      values: {},
      breakdowns: {},
    };

    sortedSelectedSimulationIds.forEach((simId) => {
      const pv = simulationsPV[simId];
      demandRow.values[simId] = pv?.totalDemand ?? null;
      demandRow.breakdowns[simId] = pv?.demand || [];
    });
    rows.push(demandRow);

    // 순현금흐름
    const netRow = {
      key: "net",
      label: "순현금흐름",
      values: {},
      breakdowns: {},
    };

    sortedSelectedSimulationIds.forEach((simId) => {
      const pv = simulationsPV[simId];
      netRow.values[simId] = pv?.netCashFlow ?? null;
      netRow.breakdowns[simId] = [];
    });
    rows.push(netRow);

    return rows;
  }, [sortedSelectedSimulationIds, simulationsPV]);

  // 생애 자금 공급/수요 막대 차트 데이터
  const cashflowChartData = useMemo(() => {
    if (summaryRows.length === 0 || sortedSelectedSimulationIds.length === 0) {
      return [];
    }

    // 각 시뮬레이션별로 자금공급, 자금수요, 순현금흐름 데이터 생성
    const data = sortedSelectedSimulationIds.map((simId, index) => {
      const supplyRow = summaryRows.find((r) => r.key === "supply");
      const demandRow = summaryRows.find((r) => r.key === "demand");
      const netRow = summaryRows.find((r) => r.key === "net");

      return {
        name: getSimulationTitle(simId),
        simId,
        index,
        supply: supplyRow?.values[simId] ?? 0,
        demand: demandRow?.values[simId] ?? 0,
        net: netRow?.values[simId] ?? 0,
      };
    });

    return data;
  }, [summaryRows, sortedSelectedSimulationIds, getSimulationTitle]);

  const renderBreakdownList = (items, prefix) => {
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    // 시스템 필드들을 제외하고 필터링
    const systemFields = ["totalAmount", "year", "age"];
    const filteredItems = items.filter(
      (item) =>
        item &&
        item.name &&
        !systemFields.includes(item.name) &&
        typeof item.amount === "number"
    );

    if (filteredItems.length === 0) {
      return null;
    }

    return (
      <ul className={styles.summaryBreakdown}>
        {filteredItems.map((item, index) => {
          // 카테고리 색상 가져오기 (item 객체를 전달하여 category 필드 우선 사용)
          const borderColor = getCategoryColor(item);

          return (
            <li
              key={`${prefix}-${item.name}-${item.category || "기타"}-${index}`}
              className={styles.summaryBreakdownItem}
              style={{ borderLeftColor: borderColor }}
            >
              <span className={styles.summaryBreakdownLabel}>{item.name}</span>
              <span className={styles.summaryBreakdownValue}>
                {formatAmountForChart(item.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  // 카테고리 판별 함수 (정렬용)
  const getCategoryType = (itemName) => {
    const name = itemName.toLowerCase();

    // 세금 관련 (먼저 확인)
    if (
      name.includes("세금") ||
      name.includes("취득세") ||
      name.includes("양도세") ||
      name.includes("양도소득세")
    ) {
      return "tax";
    }

    // 소득 관련
    if (
      name.includes("소득") ||
      name.includes("급여") ||
      name.includes("수입") ||
      name.includes("인건비")
    ) {
      return "income";
    }

    // 지출 관련
    if (
      name.includes("지출") ||
      name.includes("생활비") ||
      name.includes("비용")
    ) {
      return "expense";
    }

    // 저축/투자 관련
    if (
      name.includes("저축") ||
      name.includes("투자") ||
      name.includes("예금") ||
      name.includes("적금")
    ) {
      return "savings";
    }

    // 연금 관련
    if (
      name.includes("연금") ||
      name.includes("퇴직") ||
      name.includes("국민연금")
    ) {
      return "pension";
    }

    // 부동산 관련
    if (
      name.includes("부동산") ||
      name.includes("아파트") ||
      name.includes("자택") ||
      name.includes("임대") ||
      name.includes("주택")
    ) {
      return "realEstate";
    }

    // 부채 관련
    if (
      name.includes("부채") ||
      name.includes("대출") ||
      name.includes("빚") ||
      name.includes("이자") ||
      name.includes("원금")
    ) {
      return "debt";
    }

    // 자산 관련 (기타)
    return "assets";
  };

  // 카테고리 문자열을 정규화
  const normalizeCategoryKey = (value) => {
    if (!value || typeof value !== "string") return "";
    return value.replace(/\s+/g, "").toLowerCase();
  };

  // category/sourceType 기반 카테고리 판별 (라벨에 의존하지 않음)
  const resolveCategoryType = (itemOrName) => {
    // sourceType이 있는 경우 우선 사용 (자산 시뮬레이션 구조)
    if (itemOrName && typeof itemOrName === "object" && itemOrName.sourceType) {
      switch (itemOrName.sourceType) {
        case "cash":
          // 원본 값 기준으로 양수/음수 현금 구분
          if (typeof itemOrName.originalValue === "number") {
            return itemOrName.originalValue < 0
              ? "cashNegative"
              : "cashPositive";
          }
          return "cashPositive";
        case "saving":
          return "savings";
        case "pension":
          return "pension";
        case "realEstate":
          return "realEstate";
        case "asset":
          return "assets";
        case "debt":
          return "debt";
        default:
          break;
      }
    }

    // category 필드 매핑 (라벨 대신 카테고리 문자열 사용)
    const rawCategory =
      typeof itemOrName === "object" && itemOrName !== null
        ? itemOrName.category
        : itemOrName;
    const normalizedCategory = normalizeCategoryKey(rawCategory);

    const categoryMap = {
      income: "income",
      소득: "income",
      지출: "expense",
      비용: "expense",
      저축: "savings",
      "저축/투자": "savings",
      저축투자: "savings",
      투자: "savings",
      saving: "savings",
      savings: "savings",
      연금: "pension",
      국민연금: "pension",
      퇴직연금: "pension",
      개인연금: "pension",
      주택연금: "pension",
      부동산: "realEstate",
      임대소득: "realEstate",
      "임대 소득": "realEstate",
      realestate: "realEstate",
      자산: "assets",
      asset: "assets",
      assets: "assets",
      현금: "assets",
      양수현금: "cashPositive",
      음수현금: "cashNegative",
      대출: "debt",
      부채: "debt",
      debt: "debt",
      대출유입: "debt",
      "대출 유입": "debt",
      이자: "debt",
      부채이자: "debt",
      "부채 이자": "debt",
      원금상환: "debt",
      "원금 상환": "debt",
      부채원금상환: "debt",
      "부채 원금 상환": "debt",
      세금: "tax",
      취득세: "tax",
      양도소득세: "tax",
      양도세: "tax",
    };

    if (categoryMap[normalizedCategory]) {
      return categoryMap[normalizedCategory];
    }

    return null;
  };

  // 카테고리별 색상 결정 함수 (item 객체 또는 itemName 문자열을 받음)
  const getCategoryColor = (itemOrName) => {
    const resolvedCategory =
      resolveCategoryType(itemOrName) ||
      (typeof itemOrName === "object" && itemOrName !== null
        ? getCategoryType(itemOrName.name || "")
        : getCategoryType(itemOrName));

    const colorMap = {
      income: "#10b981", // 소득 - 초록색
      expense: "#ef4444", // 지출 - 빨간색
      savings: "#3b82f6", // 저축/투자 - 파란색
      pension: "#fbbf24", // 연금 - 노란색
      realEstate: "#8b5cf6", // 부동산 - 보라색
      debt: "#6b7280", // 부채 - 회색
      assets: "#06b6d4", // 자산 - 청록색
      tax: "#8b4513", // 세금 - 갈색
      cashPositive: "#10b981", // 현금(+)
      cashNegative: "#ef4444", // 현금(-)
    };

    return colorMap[resolvedCategory] || colorMap.assets;
  };

  // 여러 breakdown을 비교하여 같은 이름끼리 행을 맞춰서 표시
  const renderBreakdownComparison = (
    breakdownsMap,
    prefix,
    gridTemplateColumns,
    context = "supply"
  ) => {
    // breakdownsMap: { simId: [items...], ... }
    const allSimIds = sortedSelectedSimulationIds;
    if (allSimIds.length === 0) return null;

    // 시스템 필드들을 제외하고 필터링
    const systemFields = ["totalAmount", "year", "age"];
    const filterItems = (items) => {
      if (!Array.isArray(items)) return [];
      return items.filter(
        (item) =>
          item &&
          item.name &&
          !systemFields.includes(item.name) &&
          typeof item.amount === "number"
      );
    };

    // 모든 시뮬레이션의 breakdown 필터링
    const filteredBreakdowns = {};
    allSimIds.forEach((simId) => {
      filteredBreakdowns[simId] = filterItems(breakdownsMap[simId] || []);
    });

    // 모든 항목 이름 수집
    const allNames = new Set();
    Object.values(filteredBreakdowns).forEach((items) => {
      items.forEach((item) => allNames.add(item.name));
    });

    if (allNames.size === 0) return null;

    // 첫 번째 시뮬레이션(현재)에 있는 항목과 새로 추가된 항목 분리
    const firstSimId = allSimIds[0];
    const firstSimNames = new Set(
      filteredBreakdowns[firstSimId]?.map((item) => item.name) || []
    );

    const existingNames = Array.from(firstSimNames);
    const newNames = Array.from(allNames).filter(
      (name) => !firstSimNames.has(name)
    );

    // 카테고리별 정렬 순서
    const categoryOrder = [
      "income",
      "expense",
      "savings",
      "pension",
      "realEstate",
      "assets",
      "debt",
      "tax",
    ];

    // 카테고리별 정렬 함수 (item 객체를 받아서 category 필드 사용)
    const sortByCategory = (names) => {
      return names.sort((a, b) => {
        // 이름으로 항목 찾기
        const itemA = findItem(filteredBreakdowns[firstSimId], a);
        const itemB = findItem(filteredBreakdowns[firstSimId], b);

        const categoryA =
          resolveCategoryType(itemA) || getCategoryType(a) || "assets";
        const categoryB =
          resolveCategoryType(itemB) || getCategoryType(b) || "assets";

        const resolveOrder = (category) => {
          if (category === "cashPositive")
            return categoryOrder.indexOf("assets");
          if (category === "cashNegative") return categoryOrder.indexOf("debt");
          const idx = categoryOrder.indexOf(category);
          return idx === -1 ? categoryOrder.length : idx;
        };

        const orderA = resolveOrder(categoryA);
        const orderB = resolveOrder(categoryB);

        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.localeCompare(b, "ko");
      });
    };

    // 이름으로 아이템 찾기
    const findItem = (items, name) => items?.find((item) => item.name === name);

    // 정렬
    const sortedExistingNames = sortByCategory(existingNames);
    const sortedNewNames = sortByCategory(newNames);
    const sortedNames = [...sortedExistingNames, ...sortedNewNames];

    return (
      <>
        {sortedNames.map((name, index) => {
          // 첫 번째 시뮬레이션의 항목을 찾아서 category 정보 가져오기
          const firstItem = findItem(filteredBreakdowns[firstSimId], name);
          // 카테고리 색상 가져오기 (item 객체를 전달하여 category 필드 우선 사용)
          const borderColor = getCategoryColor(firstItem || name);

          return (
            <div
              key={`${prefix}-${name}-${index}`}
              className={styles.breakdownComparisonRow}
              style={{ gridTemplateColumns, borderLeftColor: borderColor }}
            >
              <div className={styles.breakdownComparisonName}>{name}</div>
              {allSimIds.map((simId, simIndex) => {
                const item = findItem(filteredBreakdowns[simId], name);
                const firstSimItem = findItem(
                  filteredBreakdowns[firstSimId],
                  name
                );
                const isFirstCol = simIndex === 0;
                const isNew = !firstSimItem && item;
                const isRemoved = firstSimItem && !item && simIndex === 0;

                return (
                  <div key={simId} className={styles.breakdownComparisonValue}>
                    {item ? (
                      <>
                        <span>{formatAmountForChart(item.amount)}</span>
                        {isNew && (
                          <span className={styles.breakdownComparisonNew}>
                            신규
                          </span>
                        )}
                        {!isFirstCol && firstSimItem && (
                          <span className={styles.breakdownComparisonDiff}>
                            {renderDifference(
                              firstSimItem.amount,
                              item.amount,
                              context
                            )}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className={styles.summaryEmpty}>-</span>
                        {isRemoved && (
                          <span className={styles.breakdownComparisonRemoved}>
                            삭제됨
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </>
    );
  };

  const renderDifference = (defaultValue, targetValue, context = "supply") => {
    const base = parseNumericInput(defaultValue);
    const compare = parseNumericInput(targetValue);
    if (
      base === null ||
      compare === null ||
      Number.isNaN(base) ||
      Number.isNaN(compare)
    ) {
      return null;
    }

    const diff = compare - base;

    if (!Number.isFinite(diff)) {
      return null;
    }

    // 부채 전용: 더 음수가 커지면 (diff < 0) 빨간색, 줄어들면 초록색
    if (context === "debt") {
      if (diff === 0) {
        return (
          <span className={`${styles.summaryDelta} ${styles.deltaNeutral}`}>
            변화 없음
          </span>
        );
      }
      const directionClass =
        diff > 0 ? styles.deltaPositive : styles.deltaNegative;
      const formatted =
        diff > 0
          ? `+${formatAmountForChart(diff)}`
          : formatAmountForChart(diff);
      const arrow = diff > 0 ? "↑" : "↓";
      return (
        <span className={`${styles.summaryDelta} ${directionClass}`}>
          {formatted} {arrow}
        </span>
      );
    }

    if (diff === 0) {
      return (
        <span className={`${styles.summaryDelta} ${styles.deltaNeutral}`}>
          변화 없음
        </span>
      );
    }

    const isDemandContext = context === "demand";
    const shouldUsePositiveColor =
      (diff > 0 && !isDemandContext) || (diff < 0 && isDemandContext);

    const formatted =
      diff > 0 ? `+${formatAmountForChart(diff)}` : formatAmountForChart(diff);
    const directionClass = shouldUsePositiveColor
      ? styles.deltaPositive
      : styles.deltaNegative;
    const arrow = diff > 0 ? "↑" : "↓";

    return (
      <span className={`${styles.summaryDelta} ${directionClass}`}>
        {formatted} {arrow}
      </span>
    );
  };

  const buildAssetBreakdown = (entry) => {
    if (!entry || typeof entry !== "object") return [];

    const mapSourceTypeToCategory = (item, isAsset) => {
      switch (item?.sourceType) {
        case "cash":
          if (
            typeof item?.originalValue === "number" &&
            item.originalValue < 0
          ) {
            return "음수현금";
          }
          return "양수현금";
        case "saving":
          return "저축";
        case "pension":
          return "연금";
        case "realEstate":
          return "부동산";
        case "asset":
          return "자산";
        case "debt":
          return "부채";
        default:
          return isAsset ? "자산" : "부채";
      }
    };

    // breakdown 정보가 있으면 이를 사용 (새로운 데이터 구조)
    if (entry.breakdown) {
      const items = [];

      // assetItems에서 자산 항목 추출
      if (
        entry.breakdown.assetItems &&
        Array.isArray(entry.breakdown.assetItems)
      ) {
        entry.breakdown.assetItems.forEach((item) => {
          items.push({
            name: item.label || item.name,
            amount: item.amount,
            isAsset: true,
            category: mapSourceTypeToCategory(item, true),
            sourceType: item.sourceType,
          });
        });
      }

      // debtItems에서 부채 항목 추출
      if (
        entry.breakdown.debtItems &&
        Array.isArray(entry.breakdown.debtItems)
      ) {
        entry.breakdown.debtItems.forEach((item) => {
          items.push({
            name: item.label || item.name,
            amount: -Math.abs(item.amount), // 부채는 음수로
            isAsset: false,
            category: mapSourceTypeToCategory(item, false),
            sourceType: item.sourceType,
          });
        });
      }

      // 금액 절댓값 기준으로 정렬 (모든 항목 노출)
      return items.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    }

    // 구 데이터 구조 지원 (fallback)
    const systemFields = ["totalAmount", "year", "age", "breakdown"];
    const items = [];

    Object.entries(entry).forEach(([key, value]) => {
      if (systemFields.includes(key)) return;
      if (typeof value !== "number") return;
      if (value === 0) return;

      items.push({
        name: key,
        amount: value,
        isAsset: value > 0,
        category: value > 0 ? "자산" : "부채",
      });
    });

    return items.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  };

  const findEntryByAge = (timeline, age) => {
    if (!Array.isArray(timeline) || typeof age !== "number") {
      return null;
    }
    const entry = timeline.find((item) => item?.age === age) || null;
    return entry;
  };

  const birthYear = parseNumericInput(profileData?.birthYear);
  const currentYear = new Date().getFullYear();
  const startAge =
    birthYear !== null && !Number.isNaN(birthYear)
      ? currentYear - birthYear
      : null;
  const profileRetirementAge = parseNumericInput(profileData?.retirementAge);
  const targetAssetGoal = parseNumericInput(profileData?.targetAssets);

  const netWorthRows = useMemo(() => {
    const rows = [];

    // 목표 자산 추가
    if (targetAssetGoal !== null && !Number.isNaN(targetAssetGoal)) {
      const goalRow = {
        key: "goal",
        label: "목표 자산",
        values: {},
        breakdowns: {},
        isGoal: true,
      };

      sortedSelectedSimulationIds.forEach((simId) => {
        goalRow.values[simId] = targetAssetGoal;
        goalRow.breakdowns[simId] = [];
      });

      rows.push(goalRow);
    }

    // 시점별 순자산 계산
    const retirementAgesForSelected = sortedSelectedSimulationIds
      .map((simId) => retirementAgeBySimulation[simId] ?? profileRetirementAge)
      .filter((age) => Number.isFinite(age));

    const retirementLabel =
      retirementAgesForSelected.length > 0 &&
      new Set(retirementAgesForSelected).size === 1
        ? `은퇴 (${retirementAgesForSelected[0]}세)`
        : "은퇴 (시뮬레이션별)";

    const checkpoints = [
      {
        key: "start",
        label: startAge !== null ? `현재 (${startAge}세)` : "현재",
        resolveAge: () => startAge,
      },
      {
        key: "retirement",
        label: retirementLabel,
        resolveAge: (simId) =>
          retirementAgeBySimulation[simId] ?? profileRetirementAge,
      },
      {
        key: "age90",
        label: "90세",
        resolveAge: () => 90,
      },
    ];

    // year와 age를 제외한 실제 순자산 계산
    const calculateNetWorth = (entry) => {
      if (!entry) return null;

      // breakdown 정보가 있으면 이를 우선 사용 (새로운 데이터 구조)
      if (entry.breakdown && typeof entry.breakdown.netAssets === "number") {
        return entry.breakdown.netAssets;
      }

      // totalAmount가 있으면 우선 사용 (자산 시뮬레이션 총합)
      if (
        typeof entry.totalAmount === "number" &&
        !Number.isNaN(entry.totalAmount)
      ) {
        return entry.totalAmount;
      }

      // 구 데이터 구조 지원 (fallback)
      const systemFields = ["totalAmount", "year", "age", "breakdown"];
      let netWorth = 0;

      Object.entries(entry).forEach(([key, value]) => {
        if (
          !systemFields.includes(key) &&
          typeof value === "number" &&
          Number.isFinite(value)
        ) {
          netWorth += value;
        }
      });

      return netWorth;
    };

    checkpoints.forEach((checkpoint) => {
      const checkpointRow = {
        key: checkpoint.key,
        label: checkpoint.label,
        values: {},
        breakdowns: {},
      };

      let hasAnyData = false;

      sortedSelectedSimulationIds.forEach((simId) => {
        const age =
          typeof checkpoint.resolveAge === "function"
            ? checkpoint.resolveAge(simId)
            : checkpoint.age;

        if (age === null || Number.isNaN(age)) {
          checkpointRow.values[simId] = null;
          checkpointRow.breakdowns[simId] = [];
          return;
        }

        const timeline = simulationsAssetsTimeline[simId];
        const entry = findEntryByAge(timeline, age);

        if (entry) {
          hasAnyData = true;
          checkpointRow.values[simId] = calculateNetWorth(entry);
          checkpointRow.breakdowns[simId] = buildAssetBreakdown(entry);
        } else {
          checkpointRow.values[simId] = null;
          checkpointRow.breakdowns[simId] = [];
        }
      });

      // 해당 시점에 데이터가 하나라도 있으면 추가
      if (hasAnyData) {
        rows.push(checkpointRow);
      }
    });

    return rows;
  }, [
    startAge,
    profileRetirementAge,
    sortedSelectedSimulationIds,
    simulationsAssetsTimeline,
    targetAssetGoal,
    retirementAgeBySimulation,
  ]);

  // 시뮬레이션별 차트 색상
  const simulationColors = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#84cc16", // lime
  ];

  // 전체 연도별 순자산 라인 차트 데이터
  const fullNetWorthChartData = useMemo(() => {
    if (
      !simulationsAssetsTimeline ||
      sortedSelectedSimulationIds.length === 0
    ) {
      return [];
    }

    // 모든 시뮬레이션의 연도(나이)를 수집하여 공통 X축 생성
    const allAges = new Set();
    sortedSelectedSimulationIds.forEach((simId) => {
      const timeline = simulationsAssetsTimeline[simId];
      if (Array.isArray(timeline)) {
        timeline.forEach((entry) => {
          if (entry?.age !== undefined && Number.isFinite(entry.age)) {
            allAges.add(entry.age);
          }
        });
      }
    });

    if (allAges.size === 0) return [];

    // 나이 순으로 정렬
    const sortedAges = Array.from(allAges).sort((a, b) => a - b);

    // 순자산 계산 함수
    const calculateNetWorth = (entry) => {
      if (!entry) return null;
      if (entry.breakdown && typeof entry.breakdown.netAssets === "number") {
        return entry.breakdown.netAssets;
      }
      if (
        typeof entry.totalAmount === "number" &&
        !Number.isNaN(entry.totalAmount)
      ) {
        return entry.totalAmount;
      }
      return null;
    };

    // 각 나이별 데이터 포인트 생성
    return sortedAges.map((age) => {
      const dataPoint = {
        name: `${age}세`,
        age,
      };

      sortedSelectedSimulationIds.forEach((simId) => {
        const timeline = simulationsAssetsTimeline[simId];
        if (Array.isArray(timeline)) {
          const entry = timeline.find((e) => e?.age === age);
          dataPoint[simId] = calculateNetWorth(entry);
        } else {
          dataPoint[simId] = null;
        }
      });

      return dataPoint;
    });
  }, [simulationsAssetsTimeline, sortedSelectedSimulationIds]);

  // 기간 필터링된 순자산 차트 데이터
  const filteredNetWorthChartData = useMemo(() => {
    if (!fullNetWorthChartData || fullNetWorthChartData.length === 0) {
      return [];
    }

    // 현재 나이와 은퇴 나이 확인
    const currentAge = startAge;
    const retirementAge = profileRetirementAge;

    switch (netWorthPeriod) {
      case "toRetirement": // 현재 ~ 은퇴 시점
        if (currentAge === null || retirementAge === null) return fullNetWorthChartData;
        return fullNetWorthChartData.filter(
          (d) => d.age >= currentAge && d.age <= retirementAge
        );
      case "afterRetirement": // 은퇴 시점 ~ 90세
        if (retirementAge === null) return fullNetWorthChartData;
        return fullNetWorthChartData.filter(
          (d) => d.age >= retirementAge && d.age <= 90
        );
      case "all": // 전체
      default:
        return fullNetWorthChartData;
    }
  }, [fullNetWorthChartData, netWorthPeriod, startAge, profileRetirementAge]);

  // 모달이 열릴 때 토글을 모두 열린 상태로 초기화
  useEffect(() => {
    if (!isOpen) return;

    // 생애 자금 공급/수요 탭의 토글들 (supply, demand)
    // 시점별 순자산 탭의 토글들 (start, retirement, age90)
    const initialExpandedRows = {
      supply: true,
      demand: true,
      "networth-start": true,
      "networth-retirement": true,
      "networth-age90": true,
      currentAssetsNetworth: true,
    };
    setExpandedRows(initialExpandedRows);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Mixpanel: 시뮬레이션 비교 모달 열림
    trackEvent("시뮬레이션 비교 모달 열림", {
      simulationCount: selectedSimulationIds.length,
      simulationIds: selectedSimulationIds,
    });

    const handleKeyDown = async (event) => {
      if (event.key === "Escape") {
        // 재무 데이터 수정 모달이 열려있으면 비교 모달은 닫지 않음
        if (editModal.isOpen) {
          return;
        }
        // 모달을 닫을 때 대시보드의 재무 리스트를 업데이트
        if (onDataRefresh) {
          await onDataRefresh();
        }
        onClose?.();
        trackEvent("시뮬레이션 비교 모달 닫힘", {
          method: "ESC 키",
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    // 모달이 열릴 때 body 스크롤 막기
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // 모달이 닫힐 때 body 스크롤 복원
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, selectedSimulationIds, editModal.isOpen]);

  // 모달이 닫혀있으면 렌더링하지 않음
  if (!isOpen) return null;

  // 선택된 시뮬레이션 개수에 따라 모달 너비 결정
  const getModalWidth = () => {
    const count = selectedSimulationIds.length;
    if (count <= 2) return "960px";
    if (count === 3) return "1200px";
    if (count === 4) return "1400px";
    return "1600px"; // 5개 이상
  };

  return (
    <div
      className={styles.overlay}
      onClick={async () => {
        trackEvent("시뮬레이션 비교 모달 닫힘", {
          method: "오버레이 클릭",
        });
        // 모달을 닫을 때 대시보드의 재무 리스트를 업데이트
        if (onDataRefresh) {
          await onDataRefresh();
        }
        onClose?.();
      }}
    >
      <div
        className={styles.modal}
        style={{ width: `min(${getModalWidth()}, 95vw)` }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <div style={{ flex: 1 }}>
            <h3>시뮬레이션 비교</h3>
            <div className={styles.simulationSelector}>
              {simulations?.map((sim) => (
                <label
                  key={sim.id}
                  className={`${styles.simulationCheckbox} ${
                    sim.isDefault ? styles.simulationCheckboxDefault : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSimulationIds.includes(sim.id)}
                    onChange={() => handleToggleSimulation(sim.id)}
                    disabled={sim.isDefault}
                  />
                  <span className={styles.simulationLabel}>
                    {sim.title || (sim.isDefault ? "현재" : "시뮬레이션")}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button
            className={styles.closeButton}
            onClick={async () => {
              trackEvent("시뮬레이션 비교 모달 닫힘", {
                method: "닫기 버튼",
              });
              // 모달을 닫을 때 대시보드의 재무 리스트를 업데이트
              if (onDataRefresh) {
                await onDataRefresh();
              }
              onClose?.();
            }}
            type="button"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          {isLoading || isDataLoading ? (
            <div className={styles.loading}>데이터를 불러오는 중...</div>
          ) : (
            <>
              {/* 메인 탭 네비게이션 */}
              <div className={styles.mainTabs}>
                <button
                  className={`${styles.mainTab} ${
                    activeTab === "currentAssets" ? styles.mainTabActive : ""
                  }`}
                  onClick={() => setActiveTab("currentAssets")}
                >
                  현재 자산 현황
                </button>
                <button
                  className={`${styles.mainTab} ${
                    activeTab === "cashflow" ? styles.mainTabActive : ""
                  }`}
                  onClick={() => setActiveTab("cashflow")}
                >
                  생애 자금 공급/수요
                </button>
                <button
                  className={`${styles.mainTab} ${
                    activeTab === "networth" ? styles.mainTabActive : ""
                  }`}
                  onClick={() => setActiveTab("networth")}
                >
                  시점별 순자산
                </button>
                <button
                  className={`${styles.mainTab} ${
                    activeTab === "detail" ? styles.mainTabActive : ""
                  }`}
                  onClick={() => setActiveTab("detail")}
                >
                  상세 재무 데이터
                </button>
              </div>

              {/* 현재 자산 현황 탭 */}
              {activeTab === "currentAssets" && (
                <div className={styles.summarySection}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionHeaderLeft}>
                      <h4 className={styles.summaryTitle}>현재 자산 현황</h4>
                      <p className={styles.summaryNote}>
                        입력된 현재 재무 데이터 기준
                      </p>
                    </div>
                  </div>
                  {Object.keys(currentAssetsBySimulation).length > 0 ? (
                    <div className={styles.summaryTable}>
                      <div
                        className={`${styles.summaryRow} ${styles.summaryHeaderDetail}`}
                        style={{ gridTemplateColumns }}
                      >
                        <div className={styles.summaryCellDetail}>항목</div>
                        {sortedSelectedSimulationIds.map((simId) => (
                          <div key={simId} className={styles.summaryCellDetail}>
                            {getSimulationTitle(simId)}
                          </div>
                        ))}
                      </div>
                      {(() => {
                        return [
                          {
                            key: "netWorth",
                            label: "순자산",
                            isNetWorth: true,
                          },
                          { key: "currentCash", label: "현금" },
                          { key: "savingsTotal", label: "저축/투자 보유" },
                          { key: "assetsTotal", label: "자산 가치" },
                          { key: "realEstatesTotal", label: "부동산 가치" },
                          { key: "pensionsTotal", label: "연금 보유" },
                          { key: "debtsTotal", label: "부채" },
                        ];
                      })().map((row) => (
                        <React.Fragment key={row.key}>
                          <div
                            className={styles.summaryRow}
                            style={{ gridTemplateColumns }}
                          >
                            <div
                              className={`${styles.summaryCellDetail} ${
                                row.isNetWorth
                                  ? styles.summaryLabel
                                  : styles.summarySubLabel
                              }`}
                            >
                              {row.label}
                            </div>
                            {sortedSelectedSimulationIds.map((simId, index) => {
                              const value =
                                currentAssetsBySimulation[simId]?.[row.key];
                              const isFirstCol = index === 0;

                              return (
                                <div
                                  key={simId}
                                  className={styles.summaryCellDetail}
                                >
                                  {value !== null &&
                                  value !== undefined &&
                                  !Number.isNaN(value) ? (
                                    <div className={styles.summaryValueRow}>
                                      {row.isNetWorth ? (
                                        <span
                                          className={`${styles.summaryValue} ${
                                            value >= 0
                                              ? styles.positive
                                              : styles.negative
                                          }`}
                                        >
                                          {formatAmountForChart(value)}
                                        </span>
                                      ) : (
                                        <span
                                          className={`${
                                            styles.summaryValueSubtle
                                          } ${
                                            row.key === "debtsTotal"
                                              ? styles.negative
                                              : ""
                                          }`}
                                        >
                                          {formatAmountForChart(value)}
                                        </span>
                                      )}
                                      {!isFirstCol &&
                                        sortedSelectedSimulationIds.length >
                                          1 &&
                                        renderDifference(
                                          currentAssetsBySimulation[
                                            sortedSelectedSimulationIds[0]
                                          ]?.[row.key],
                                          value,
                                          row.key === "debtsTotal"
                                            ? "debt"
                                            : "supply"
                                        )}
                                    </div>
                                  ) : (
                                    <span className={styles.summaryEmpty}>
                                      -
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.summaryTable}>
                      <div className={styles.summaryEmpty}>
                        데이터가 없습니다.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 생애 자금 공급/수요 현재가 요약 */}
              {activeTab === "cashflow" &&
                Object.keys(simulationsPV).length > 0 && (
                  <div className={styles.summarySection}>
                    <div className={styles.sectionHeader}>
                      <h4 className={styles.summaryTitle}>
                        생애 자금 공급/수요
                      </h4>
                      <div className={styles.periodTabs}>
                        <button
                          className={`${styles.periodTab} ${
                            cashflowPeriod === "all"
                              ? styles.periodTabActive
                              : ""
                          }`}
                          onClick={() => setCashflowPeriod("all")}
                        >
                          전체
                        </button>
                        <button
                          className={`${styles.periodTab} ${
                            cashflowPeriod === "beforeRetirement"
                              ? styles.periodTabActive
                              : ""
                          }`}
                          onClick={() => setCashflowPeriod("beforeRetirement")}
                        >
                          은퇴전(포함)
                        </button>
                        <button
                          className={`${styles.periodTab} ${
                            cashflowPeriod === "afterRetirement"
                              ? styles.periodTabActive
                              : ""
                          }`}
                          onClick={() => setCashflowPeriod("afterRetirement")}
                        >
                          은퇴 이후
                        </button>
                      </div>
                    </div>

                    {/* 생애 자금 공급/수요 비교 차트 - 3개 분리 (시뮬레이션별 동일 색상) */}
                    {cashflowChartData.length > 0 && (
                      <div className={styles.cashflowChartsWrapper}>
                        {/* 자금 공급 비교 차트 */}
                        <div className={styles.cashflowChartItem}>
                          <h5 className={styles.cashflowChartTitle}>
                            자금 공급 비교
                          </h5>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart
                              data={cashflowChartData}
                              margin={{
                                top: 10,
                                right: 20,
                                left: 10,
                                bottom: 5,
                              }}
                              barCategoryGap="25%"
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#e5e7eb"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={{ stroke: "#e5e7eb" }}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) =>
                                  formatAmountForChart(value)
                                }
                                width={70}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (
                                    !active ||
                                    !payload ||
                                    payload.length === 0
                                  )
                                    return null;
                                  const data = payload[0]?.payload;
                                  if (!data) return null;
                                  const simIndex = cashflowChartData.findIndex(
                                    (d) => d.simId === data.simId
                                  );
                                  const color =
                                    simulationColors[
                                      simIndex % simulationColors.length
                                    ];
                                  return (
                                    <div
                                      style={{
                                        backgroundColor: "#ffffff",
                                        border: "none",
                                        borderRadius: "12px",
                                        boxShadow:
                                          "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
                                        padding: "14px 18px",
                                        minWidth: "180px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: 700,
                                          color: "#1e293b",
                                          fontSize: "0.9rem",
                                          marginBottom: "10px",
                                          paddingBottom: "8px",
                                          borderBottom: "1px solid #e5e7eb",
                                        }}
                                      >
                                        자금 공급
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "10px",
                                          padding: "5px 0",
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: "10px",
                                            height: "10px",
                                            borderRadius: "2px",
                                            backgroundColor: color,
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span
                                          style={{
                                            flex: 1,
                                            fontSize: "0.85rem",
                                            fontWeight: 500,
                                            color: "#64748b",
                                          }}
                                        >
                                          {data.name}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: "0.9rem",
                                            fontWeight: 600,
                                            color: color,
                                          }}
                                        >
                                          {formatAmountForChart(data.supply)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                              <Bar
                                dataKey="supply"
                                name="자금 공급"
                                radius={[4, 4, 0, 0]}
                              >
                                {cashflowChartData.map((entry, index) => (
                                  <Cell
                                    key={`cell-supply-${index}`}
                                    fill={
                                      simulationColors[
                                        index % simulationColors.length
                                      ]
                                    }
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* 자금 수요 비교 차트 */}
                        <div className={styles.cashflowChartItem}>
                          <h5 className={styles.cashflowChartTitle}>
                            자금 수요 비교
                          </h5>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart
                              data={cashflowChartData}
                              margin={{
                                top: 10,
                                right: 20,
                                left: 10,
                                bottom: 5,
                              }}
                              barCategoryGap="25%"
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#e5e7eb"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={{ stroke: "#e5e7eb" }}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) =>
                                  formatAmountForChart(value)
                                }
                                width={70}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (
                                    !active ||
                                    !payload ||
                                    payload.length === 0
                                  )
                                    return null;
                                  const data = payload[0]?.payload;
                                  if (!data) return null;
                                  const simIndex = cashflowChartData.findIndex(
                                    (d) => d.simId === data.simId
                                  );
                                  const color =
                                    simulationColors[
                                      simIndex % simulationColors.length
                                    ];
                                  return (
                                    <div
                                      style={{
                                        backgroundColor: "#ffffff",
                                        border: "none",
                                        borderRadius: "12px",
                                        boxShadow:
                                          "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
                                        padding: "14px 18px",
                                        minWidth: "180px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: 700,
                                          color: "#1e293b",
                                          fontSize: "0.9rem",
                                          marginBottom: "10px",
                                          paddingBottom: "8px",
                                          borderBottom: "1px solid #e5e7eb",
                                        }}
                                      >
                                        자금 수요
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "10px",
                                          padding: "5px 0",
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: "10px",
                                            height: "10px",
                                            borderRadius: "2px",
                                            backgroundColor: color,
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span
                                          style={{
                                            flex: 1,
                                            fontSize: "0.85rem",
                                            fontWeight: 500,
                                            color: "#64748b",
                                          }}
                                        >
                                          {data.name}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: "0.9rem",
                                            fontWeight: 600,
                                            color: color,
                                          }}
                                        >
                                          {formatAmountForChart(data.demand)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                              <Bar
                                dataKey="demand"
                                name="자금 수요"
                                radius={[4, 4, 0, 0]}
                              >
                                {cashflowChartData.map((entry, index) => (
                                  <Cell
                                    key={`cell-demand-${index}`}
                                    fill={
                                      simulationColors[
                                        index % simulationColors.length
                                      ]
                                    }
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* 순현금흐름 비교 차트 */}
                        <div className={styles.cashflowChartItem}>
                          <h5 className={styles.cashflowChartTitle}>
                            순현금흐름 비교
                          </h5>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart
                              data={cashflowChartData}
                              margin={{
                                top: 10,
                                right: 20,
                                left: 10,
                                bottom: 5,
                              }}
                              barCategoryGap="25%"
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#e5e7eb"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={{ stroke: "#e5e7eb" }}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) =>
                                  formatAmountForChart(value)
                                }
                                width={70}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (
                                    !active ||
                                    !payload ||
                                    payload.length === 0
                                  )
                                    return null;
                                  const data = payload[0]?.payload;
                                  if (!data) return null;
                                  const simIndex = cashflowChartData.findIndex(
                                    (d) => d.simId === data.simId
                                  );
                                  const color =
                                    simulationColors[
                                      simIndex % simulationColors.length
                                    ];
                                  return (
                                    <div
                                      style={{
                                        backgroundColor: "#ffffff",
                                        border: "none",
                                        borderRadius: "12px",
                                        boxShadow:
                                          "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
                                        padding: "14px 18px",
                                        minWidth: "180px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: 700,
                                          color: "#1e293b",
                                          fontSize: "0.9rem",
                                          marginBottom: "10px",
                                          paddingBottom: "8px",
                                          borderBottom: "1px solid #e5e7eb",
                                        }}
                                      >
                                        순현금흐름
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "10px",
                                          padding: "5px 0",
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: "10px",
                                            height: "10px",
                                            borderRadius: "2px",
                                            backgroundColor: color,
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span
                                          style={{
                                            flex: 1,
                                            fontSize: "0.85rem",
                                            fontWeight: 500,
                                            color: "#64748b",
                                          }}
                                        >
                                          {data.name}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: "0.9rem",
                                            fontWeight: 600,
                                            color: color,
                                          }}
                                        >
                                          {formatAmountForChart(data.net)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                              <ReferenceLine
                                y={0}
                                stroke="#9ca3af"
                                strokeDasharray="2 2"
                              />
                              <Bar
                                dataKey="net"
                                name="순현금흐름"
                                radius={[4, 4, 0, 0]}
                              >
                                {cashflowChartData.map((entry, index) => (
                                  <Cell
                                    key={`cell-net-${index}`}
                                    fill={
                                      simulationColors[
                                        index % simulationColors.length
                                      ]
                                    }
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* 시뮬레이션 색상 범례 */}
                    {cashflowChartData.length > 0 && (
                      <div className={styles.chartLegend}>
                        {cashflowChartData.map((item, index) => (
                          <div key={item.simId} className={styles.legendItem}>
                            <span
                              className={styles.legendSquare}
                              style={{
                                backgroundColor:
                                  simulationColors[
                                    index % simulationColors.length
                                  ],
                              }}
                            />
                            <span className={styles.legendLabel}>
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className={styles.summaryTable}>
                      <div
                        className={`${styles.summaryRow} ${styles.summaryHeaderCashflow}`}
                        style={{ gridTemplateColumns }}
                      >
                        <div className={styles.summaryCellCashflow}>항목</div>
                        {sortedSelectedSimulationIds.map((simId) => (
                          <div
                            key={simId}
                            className={styles.summaryCellCashflow}
                          >
                            {getSimulationTitle(simId)}
                          </div>
                        ))}
                      </div>
                      {summaryRows.map((row) => (
                        <React.Fragment key={row.key}>
                          <div
                            className={styles.summaryRow}
                            style={{ gridTemplateColumns }}
                          >
                            <div
                              className={`${styles.summaryCellCashflow} ${styles.summaryLabel}`}
                            >
                              {row.key !== "net" && (
                                <button
                                  className={styles.toggleButton}
                                  onClick={() => toggleRow(row.key)}
                                  aria-label={
                                    expandedRows[row.key]
                                      ? "세부 항목 접기"
                                      : "세부 항목 펼치기"
                                  }
                                >
                                  {expandedRows[row.key] ? "▼" : "▶"}
                                </button>
                              )}
                              {row.label}
                            </div>
                            {sortedSelectedSimulationIds.map((simId, index) => {
                              const value = row.values[simId];
                              const isFirstCol = index === 0;

                              return (
                                <div
                                  key={simId}
                                  className={styles.summaryCellCashflow}
                                >
                                  {value !== null && value !== undefined ? (
                                    <>
                                      <span
                                        className={`${styles.summaryValue} ${
                                          row.key === "net"
                                            ? value >= 0
                                              ? styles.positive
                                              : styles.negative
                                            : ""
                                        }`}
                                      >
                                        {formatAmountForChart(value)}
                                      </span>
                                      {!isFirstCol &&
                                        sortedSelectedSimulationIds.length >
                                          1 &&
                                        renderDifference(
                                          row.values[
                                            sortedSelectedSimulationIds[0]
                                          ],
                                          value,
                                          row.key === "demand"
                                            ? "demand"
                                            : "supply"
                                        )}
                                    </>
                                  ) : (
                                    <span className={styles.summaryEmpty}>
                                      -
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {/* 세부 내용 표시 - 펼쳐졌을 때만 */}
                          {row.key !== "net" && expandedRows[row.key] && (
                            <div
                              style={{
                                gridColumn: "1 / -1",
                                paddingTop: "0.5rem",
                              }}
                            >
                              {renderBreakdownComparison(
                                row.breakdowns,
                                `comparison-${row.key}`,
                                gridTemplateColumns,
                                row.key === "demand" ? "demand" : "supply"
                              )}
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              {activeTab === "networth" && (
                <>
                  {netWorthRows.length > 0 && (
                    <div className={styles.netWorthSection}>
                      <div className={styles.netWorthHeader}>
                        <h4 className={styles.netWorthTitle}>시점별 순자산</h4>
                        {/* 기간 필터 탭 */}
                        <div className={styles.periodTabs}>
                          <button
                            className={`${styles.periodTab} ${netWorthPeriod === "all" ? styles.periodTabActive : ""}`}
                            onClick={() => setNetWorthPeriod("all")}
                          >
                            전체
                          </button>
                          <button
                            className={`${styles.periodTab} ${netWorthPeriod === "toRetirement" ? styles.periodTabActive : ""}`}
                            onClick={() => setNetWorthPeriod("toRetirement")}
                          >
                            현재 ~ 은퇴
                          </button>
                          <button
                            className={`${styles.periodTab} ${netWorthPeriod === "afterRetirement" ? styles.periodTabActive : ""}`}
                            onClick={() => setNetWorthPeriod("afterRetirement")}
                          >
                            은퇴 ~ 90세
                          </button>
                        </div>
                      </div>

                      {/* 전체 연도별 순자산 비교 라인 차트 */}
                      {filteredNetWorthChartData.length > 0 && (
                        <div className={styles.netWorthChartContainer}>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                              data={filteredNetWorthChartData}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 10,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#e5e7eb"
                              />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={{ stroke: "#d1d5db" }}
                                tickLine={{ stroke: "#d1d5db" }}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                tickFormatter={(value) =>
                                  formatAmountForChart(value)
                                }
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={{ stroke: "#d1d5db" }}
                                tickLine={{ stroke: "#d1d5db" }}
                                width={80}
                              />
                              <Tooltip
                                content={({ active, payload, label }) => {
                                  if (
                                    !active ||
                                    !payload ||
                                    payload.length === 0
                                  )
                                    return null;
                                  return (
                                    <div
                                      style={{
                                        backgroundColor: "#ffffff",
                                        border: "none",
                                        borderRadius: "12px",
                                        boxShadow:
                                          "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
                                        padding: "14px 18px",
                                        minWidth: "180px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: 700,
                                          color: "#1e293b",
                                          fontSize: "0.9rem",
                                          marginBottom: "10px",
                                          paddingBottom: "8px",
                                          borderBottom: "1px solid #e5e7eb",
                                        }}
                                      >
                                        {label}
                                      </div>
                                      {payload.map((entry, index) => (
                                        <div
                                          key={index}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            padding: "5px 0",
                                          }}
                                        >
                                          <span
                                            style={{
                                              width: "10px",
                                              height: "10px",
                                              borderRadius: "2px",
                                              backgroundColor: entry.color,
                                              flexShrink: 0,
                                            }}
                                          />
                                          <span
                                            style={{
                                              flex: 1,
                                              fontSize: "0.85rem",
                                              fontWeight: 500,
                                              color: "#64748b",
                                            }}
                                          >
                                            {getSimulationTitle(entry.dataKey)}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: "0.9rem",
                                              fontWeight: 600,
                                              color: entry.color,
                                            }}
                                          >
                                            {formatAmountForChart(entry.value)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                }}
                              />
                              <ReferenceLine
                                y={0}
                                stroke="#9ca3af"
                                strokeDasharray="2 2"
                              />
                              {/* 은퇴 나이 세로 참조선 */}
                              {profileRetirementAge !== null &&
                                !Number.isNaN(profileRetirementAge) && (
                                  <ReferenceLine
                                    x={`${profileRetirementAge}세`}
                                    stroke="#9ca3af"
                                    strokeDasharray="5 5"
                                    strokeWidth={1.5}
                                    label={{
                                      value: `은퇴 ${profileRetirementAge}세`,
                                      position: "top",
                                      fill: "#6b7280",
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                              {/* 목표 자산 참조선 */}
                              {targetAssetGoal !== null &&
                                !Number.isNaN(targetAssetGoal) && (
                                  <ReferenceLine
                                    y={targetAssetGoal}
                                    stroke="#f59e0b"
                                    strokeDasharray="5 5"
                                    strokeWidth={2}
                                    label={{
                                      value: `목표: ${formatAmountForChart(
                                        targetAssetGoal
                                      )}`,
                                      position: "right",
                                      fill: "#f59e0b",
                                      fontSize: 11,
                                    }}
                                  />
                                )}
                              {sortedSelectedSimulationIds.map(
                                (simId, index) => (
                                  <Line
                                    key={simId}
                                    type="monotone"
                                    dataKey={simId}
                                    name={getSimulationTitle(simId)}
                                    stroke={
                                      simulationColors[
                                        index % simulationColors.length
                                      ]
                                    }
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{
                                      r: 3,
                                      strokeWidth: 0,
                                      fill: simulationColors[
                                        index % simulationColors.length
                                      ],
                                    }}
                                    connectNulls
                                  />
                                )
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                          {/* 시뮬레이션 색상 범례 */}
                          <div className={styles.chartLegend}>
                            {sortedSelectedSimulationIds.map((simId, index) => (
                              <div key={simId} className={styles.legendItem}>
                                <span
                                  className={styles.legendLine}
                                  style={{
                                    backgroundColor:
                                      simulationColors[
                                        index % simulationColors.length
                                      ],
                                  }}
                                />
                                <span className={styles.legendLabel}>
                                  {getSimulationTitle(simId)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className={styles.summaryTable}>
                        <div
                          className={`${styles.summaryRow} ${styles.summaryHeaderNetworth}`}
                          style={{ gridTemplateColumns }}
                        >
                          <div className={styles.summaryCellNetworth}>시점</div>
                          {sortedSelectedSimulationIds.map((simId) => (
                            <div
                              key={simId}
                              className={styles.summaryCellNetworth}
                            >
                              {getSimulationTitle(simId)}
                            </div>
                          ))}
                        </div>
                        {netWorthRows.map((row) => (
                          <React.Fragment key={row.key}>
                            <div
                              className={styles.summaryRow}
                              style={{ gridTemplateColumns }}
                            >
                              <div
                                className={`${styles.summaryCellNetworth} ${styles.summaryLabel}`}
                              >
                                {!row.isGoal && (
                                  <button
                                    className={styles.toggleButton}
                                    onClick={() =>
                                      toggleRow(`networth-${row.key}`)
                                    }
                                    aria-label={
                                      expandedRows[`networth-${row.key}`]
                                        ? "세부 항목 접기"
                                        : "세부 항목 펼치기"
                                    }
                                  >
                                    {expandedRows[`networth-${row.key}`]
                                      ? "▼"
                                      : "▶"}
                                  </button>
                                )}
                                {row.label}
                              </div>
                              {sortedSelectedSimulationIds.map(
                                (simId, index) => {
                                  const value = row.values[simId];
                                  const isFirstCol = index === 0;

                                  return (
                                    <div
                                      key={simId}
                                      className={styles.summaryCellNetworth}
                                    >
                                      {value !== null &&
                                      value !== undefined &&
                                      !Number.isNaN(value) ? (
                                        <>
                                          <span
                                            className={`${
                                              styles.summaryValue
                                            } ${
                                              row.isGoal
                                                ? ""
                                                : value >= 0
                                                ? styles.positive
                                                : styles.negative
                                            }`}
                                          >
                                            {formatAmountForChart(value)}
                                          </span>
                                          {!isFirstCol &&
                                            sortedSelectedSimulationIds.length >
                                              1 &&
                                            renderDifference(
                                              row.values[
                                                sortedSelectedSimulationIds[0]
                                              ],
                                              value,
                                              "supply"
                                            )}
                                        </>
                                      ) : (
                                        <span className={styles.summaryEmpty}>
                                          -
                                        </span>
                                      )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                            {/* 세부 내용 표시 - 펼쳐졌을 때만 */}
                            {!row.isGoal &&
                              expandedRows[`networth-${row.key}`] && (
                                <div
                                  style={{
                                    gridColumn: "1 / -1",
                                    paddingTop: "0.5rem",
                                  }}
                                >
                                  {renderBreakdownComparison(
                                    row.breakdowns,
                                    `networth-comparison-${row.key}`,
                                    gridTemplateColumns,
                                    "supply"
                                  )}
                                </div>
                              )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 상세 재무 데이터 비교 */}
              {activeTab === "detail" && (
                <div className={styles.financialDataSection}>
                  <h4 className={styles.financialDataTitle}>
                    상세 재무 데이터
                  </h4>
                  {/* 헤더 행 */}
                  <div className={styles.summaryTable}>
                    <div
                      className={`${styles.summaryRow} ${styles.summaryHeaderDetail}`}
                      style={{ gridTemplateColumns }}
                    >
                      <div className={styles.summaryCellDetail}>카테고리</div>
                      {sortedSelectedSimulationIds.map((simId) => (
                        <div key={simId} className={styles.summaryCellDetail}>
                          {getSimulationTitle(simId)}
                        </div>
                      ))}
                    </div>
                  </div>
                  {categoryConfigs.map((config) => {
                    // 모든 시뮬레이션의 데이터를 ID 기준으로 병합
                    const allItemsById = new Map();
                    const baseSimId = sortedSelectedSimulationIds[0];
                    const baseSimData = simulationsData[baseSimId];

                    // 기준 시뮬레이션의 항목들을 먼저 추가
                    if (baseSimData?.[config.key]) {
                      baseSimData[config.key].forEach((item) => {
                        allItemsById.set(item.id, {
                          id: item.id,
                          baseItem: item,
                          items: { [baseSimId]: item },
                        });
                      });
                    }

                    // 다른 시뮬레이션의 항목들 추가
                    sortedSelectedSimulationIds.forEach((simId) => {
                      if (simId === baseSimId) return;
                      const simData = simulationsData[simId];
                      if (simData?.[config.key]) {
                        simData[config.key].forEach((item) => {
                          if (allItemsById.has(item.id)) {
                            allItemsById.get(item.id).items[simId] = item;
                          } else {
                            allItemsById.set(item.id, {
                              id: item.id,
                              baseItem: null, // 신규 항목
                              items: { [simId]: item },
                            });
                          }
                        });
                      }
                    });

                    // 항목이 없으면 표시 안 함
                    if (allItemsById.size === 0) {
                      return null;
                    }

                    const itemsArray = Array.from(allItemsById.values());
                    const isLastItem = (index) =>
                      index === itemsArray.length - 1;

                    return (
                      <React.Fragment key={config.key}>
                        {itemsArray.map((itemGroup, itemIndex) => (
                          <div
                            key={itemGroup.id}
                            className={`${styles.summaryRow} ${
                              isLastItem(itemIndex)
                                ? styles.categoryLastRow
                                : ""
                            }`}
                            style={{ gridTemplateColumns }}
                          >
                            {/* 첫 번째 열: 카테고리명 (첫 항목에만 표시) */}
                            <div
                              className={`${styles.summaryCellDetail} ${styles.summaryLabel2}`}
                            >
                              {itemIndex === 0 ? config.label : ""}
                            </div>
                            {/* 나머지 열: 각 시뮬레이션의 해당 항목 */}
                            {sortedSelectedSimulationIds.map(
                              (simId, simIndex) => {
                                const item = itemGroup.items[simId];
                                const baseItem = itemGroup.baseItem;
                                const isFirstColumn = simIndex === 0;

                                return (
                                  <div
                                    key={simId}
                                    className={styles.summaryCellDetail}
                                  >
                                    {renderDetailedFinancialItem(
                                      item,
                                      config,
                                      baseItem,
                                      isFirstColumn,
                                      simId
                                    )}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 재무 데이터 수정 모달 (통합 렌더링으로 React 내부 오류 방지) */}
      {renderEditModal()}
    </div>
  );
}

export default SimulationCompareModal;
