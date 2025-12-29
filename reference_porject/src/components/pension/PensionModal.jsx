import React, { useState, useEffect } from "react";
import styles from "./PensionModal.module.css";
import { formatAmountForChart } from "../../utils/format";
import { calculateKoreanAge } from "../../utils/koreanAge";
import { pensionService } from "../../services/firestoreService";

/**
 * 연금 데이터 추가/수정 모달
 * 국민연금, 퇴직연금, 개인연금 지원
 */
function PensionModal({
  isOpen,
  onClose,
  onSave,
  editData = null,
  initialData = null, // 복사된 데이터 (복사해서 추가용)
  profileData = null,
  simulations = [],
  activeSimulationId = null,
  profileId = null,
  defaultInflationRate = "1.89", // 전역 설정에서 전달된 물가 상승률 기본값
  defaultInvestmentReturnRate = "2.86", // 전역 설정에서 전달된 투자 수익률 기본값
}) {
  // 은퇴년도 계산 함수
  const getRetirementYear = () => {
    const currentYear = new Date().getFullYear();
    if (profileData && profileData.birthYear && profileData.retirementAge) {
      const birth = parseInt(profileData.birthYear, 10);
      const retireAge = parseInt(profileData.retirementAge, 10);
      if (Number.isFinite(birth) && Number.isFinite(retireAge)) {
        const currentAge = calculateKoreanAge(birth, currentYear);
        const yearsToRetire = retireAge - currentAge;
        return (
          currentYear + (Number.isFinite(yearsToRetire) ? yearsToRetire : 0)
        );
      }
    }
    return currentYear + 10;
  };

  // 기본값 계산 함수
  const getDefaultYears = () => {
    const currentYear = new Date().getFullYear();

    // 프로필 데이터에서 현재 나이 가져오기
    let currentAge = 40; // 기본값 (프로필 데이터가 없을 때만 사용)

    if (profileData) {
      // birthYear가 있는 경우 (만 나이로 계산)
      if (profileData.birthYear) {
        currentAge = currentYear - parseInt(profileData.birthYear);
      }
      // currentKoreanAge가 있는 경우 (이미 만 나이로 저장됨)
      else if (profileData.currentKoreanAge) {
        currentAge = parseInt(profileData.currentKoreanAge);
      }
      // birthDate가 있는 경우
      else if (profileData.birthDate) {
        const birthDate = new Date(profileData.birthDate);
        const today = new Date();
        currentAge = today.getFullYear() - birthDate.getFullYear();

        // 생일이 아직 지나지 않았다면 나이에서 1 빼기
        if (
          today.getMonth() < birthDate.getMonth() ||
          (today.getMonth() === birthDate.getMonth() &&
            today.getDate() < birthDate.getDate())
        ) {
          currentAge--;
        }
      }
    }

    // 만 나이 기준으로 65세와 90세가 되는 년도 계산
    // 출생년도 + 65 = 만 65세가 되는 년도
    // 출생년도 + 90 = 만 90세가 되는 년도
    const birthYear = profileData?.birthYear
      ? parseInt(profileData.birthYear)
      : currentYear - currentAge;
    const age65Year = birthYear + 65; // 만 65세가 되는 년도
    const age90Year = birthYear + 90; // 만 90세가 되는 년도

    return { age65Year, age90Year, currentAge };
  };

  const { age65Year, age90Year } = getDefaultYears();

  const [formData, setFormData] = useState({
    type: "national", // national, retirement, personal, severance
    title: "",
    monthlyAmount: "", // 월 수령 금액
    startYear: age65Year,
    startMonth: new Date().getMonth() + 1, // 시작 월 (국민연금용) - 현재 월
    endYear: age90Year,
    endMonth: 12, // 종료 월 (국민연금용)
    inflationRate: parseFloat(defaultInflationRate) || 1.89, // 물가상승률 (국민연금용)
    // 퇴직연금/개인연금용 필드
    currentAmount: "", // 시작 보유액
    contributionAmount: "", // 월/년 적립 금액
    contributionFrequency: "monthly", // monthly, yearly
    contributionStartYear: new Date().getFullYear(),
    contributionStartMonth: 1, // 적립 시작 월
    contributionEndYear: new Date().getFullYear() + 10,
    contributionEndMonth: 12, // 적립 종료 월
    returnRate: parseFloat(defaultInvestmentReturnRate) || 2.86, // 전역 설정에서 가져온 투자 수익률
    paymentStartYear: getRetirementYear() + 1, // 수령 시작년도: 은퇴년도+1
    paymentStartMonth: 1, // 수령 시작 월
    paymentYears: 10, // 수령 기간(년) - PMT 방식
    memo: "",
    isFixedContributionEndYearToRetirement: false, // 적립 종료년도 은퇴년도 고정 여부
    // 퇴직금/DB형용 필드
    averageSalary: "", // 평균 임금 (월 단위, 만원)
    yearsOfService: "", // 재직 년도
    noAdditionalContribution: false, // 퇴직금/DB 추가 적립 안함
  });

  const [errors, setErrors] = useState({});
  const [selectedSimulationIds, setSelectedSimulationIds] = useState([]);
  // 각 시뮬레이션이 수정인지 추가인지 상태 저장: { simId: 'update' | 'create' }
  const [simulationStatusMap, setSimulationStatusMap] = useState({});
  const [isSimSelectionLoading, setIsSimSelectionLoading] = useState(false);

  // 퇴직금/DB형: 평균 임금 × 재직 년도로 보유액 자동 계산
  useEffect(() => {
    if (formData.type === "severance") {
      const salary = parseFloat(formData.averageSalary) || 0;
      const years = parseFloat(formData.yearsOfService) || 0;
      if (salary > 0 && years > 0) {
        const calculatedAmount = salary * years;
        setFormData((prev) => ({
          ...prev,
          currentAmount: calculatedAmount.toString(),
        }));
      }
    }
  }, [formData.averageSalary, formData.yearsOfService, formData.type]);

  // 은퇴년도 고정이 켜져있으면 적립 종료년도를 자동으로 은퇴년도로 업데이트
  useEffect(() => {
    if (
      formData.isFixedContributionEndYearToRetirement &&
      profileData &&
      formData.type !== "national"
    ) {
      const retirementYear = getRetirementYear();
      if (formData.contributionEndYear !== retirementYear) {
        setFormData((prev) => ({
          ...prev,
          contributionEndYear: retirementYear,
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.isFixedContributionEndYearToRetirement,
    profileData?.retirementAge,
    profileData?.birthYear,
    formData.type,
  ]);

  // 수정 모드일 때 각 시뮬레이션에 해당 ID가 존재하는지 확인
  useEffect(() => {
    // 모달이 닫혀있으면 아무것도 안함
    if (!isOpen) {
      return;
    }

    // 모달이 열리면 즉시 이전 상태 초기화 및 로딩 시작
    setIsSimSelectionLoading(true);
    setSimulationStatusMap({});
    setSelectedSimulationIds([]);

    let cancelled = false;

    const checkSimulationStatus = async () => {
      const startTime = Date.now();

      if (editData && editData.id && profileId && simulations.length > 0) {
        try {
          // 모든 시뮬레이션에서 해당 ID가 존재하는지 확인
          const checkPromises = simulations.map(async (sim) => {
            try {
              const pensions = await pensionService.getPensions(
                profileId,
                sim.id
              );
              // 같은 ID의 항목이 있는지 확인
              const hasSameId = pensions.some(
                (pension) => pension.id === editData.id
              );
              return { simId: sim.id, status: hasSameId ? "update" : "create" };
            } catch (error) {
              return { simId: sim.id, status: "create" }; // 오류 시 추가로 처리
            }
          });
          const results = await Promise.all(checkPromises);

          // 작업이 취소되었으면 상태 업데이트 안함
          if (cancelled) return;

          // 상태 맵 생성
          const statusMap = {};
          results.forEach(({ simId, status }) => {
            statusMap[simId] = status;
          });
          setSimulationStatusMap(statusMap);

          // 현재 활성 시뮬레이션을 기본 선택
          const defaultSelected = activeSimulationId
            ? [activeSimulationId]
            : [];
          setSelectedSimulationIds(defaultSelected);

          // 최소 1초 로딩 유지
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, 1000 - elapsedTime);
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        } catch (error) {
          console.error("시뮬레이션 상태 확인 오류:", error);

          if (cancelled) return;

          // 오류 시 모든 시뮬레이션을 추가 상태로 설정
          const statusMap = {};
          simulations.forEach((sim) => {
            statusMap[sim.id] = "create";
          });
          setSimulationStatusMap(statusMap);
          setSelectedSimulationIds(
            activeSimulationId ? [activeSimulationId] : []
          );

          // 최소 1초 로딩 유지
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, 1000 - elapsedTime);
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        } finally {
          if (!cancelled) {
            setIsSimSelectionLoading(false);
          }
        }
      } else {
        // 추가 모드일 때는 모든 시뮬레이션을 추가 상태로
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 1000 - elapsedTime);
        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (cancelled) return;

        const statusMap = {};
        simulations.forEach((sim) => {
          statusMap[sim.id] = "create";
        });
        setSimulationStatusMap(statusMap);
        const defaultSelected = activeSimulationId ? [activeSimulationId] : [];
        setSelectedSimulationIds(defaultSelected);
        setIsSimSelectionLoading(false);
      }
    };

    checkSimulationStatus();

    // cleanup 함수: 다음 useEffect 실행 전이나 컴포넌트 언마운트 시 호출
    return () => {
      cancelled = true;
    };
  }, [isOpen, editData?.id, profileId, simulations, activeSimulationId]);

  // 수정 모드일 때 데이터 로드, 모달이 열릴 때마다 초기화
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        // 수정 모드: 기존 데이터 로드
        setFormData({
          type: editData.type || "national",
          title: editData.title || "",
          monthlyAmount:
            editData.monthlyAmount !== undefined &&
            editData.monthlyAmount !== null
              ? editData.monthlyAmount.toString()
              : "",
          startYear: editData.startYear || new Date().getFullYear(),
          startMonth: editData.startMonth || 1, // 기존 데이터 호환성: 없으면 1월
          endYear: editData.endYear || new Date().getFullYear() + 20,
          endMonth: editData.endMonth || 12, // 기존 데이터 호환성: 없으면 12월
          inflationRate:
            editData.inflationRate !== undefined &&
            editData.inflationRate !== null
              ? editData.inflationRate.toFixed(2)
              : 1.89,
          currentAmount:
            editData.currentAmount !== undefined &&
            editData.currentAmount !== null
              ? editData.currentAmount.toString()
              : "",
          contributionAmount:
            editData.contributionAmount !== undefined &&
            editData.contributionAmount !== null
              ? editData.contributionAmount.toString()
              : "",
          contributionFrequency: editData.contributionFrequency || "monthly",
          contributionStartYear:
            editData.contributionStartYear || new Date().getFullYear(),
          contributionStartMonth: editData.contributionStartMonth || 1, // 기존 데이터 호환성: 없으면 1월
          contributionEndYear:
            editData.contributionEndYear || new Date().getFullYear() + 10,
          contributionEndMonth: editData.contributionEndMonth || 12, // 기존 데이터 호환성: 없으면 12월
          returnRate:
            editData.returnRate !== undefined
              ? editData.returnRate.toFixed(2)
              : 2.86,
          paymentStartYear:
            editData.paymentStartYear || getRetirementYear() + 1,
          paymentStartMonth: editData.paymentStartMonth || 1, // 기존 데이터 호환성: 없으면 1월
          paymentYears: editData.paymentYears
            ? editData.paymentYears
            : editData.paymentEndYear
            ? editData.paymentEndYear - editData.paymentStartYear
            : 10, // 기존 데이터 호환성 (paymentEndYear가 있으면 기간 계산)
          memo: editData.memo || "",
          isFixedContributionEndYearToRetirement:
            editData.isFixedContributionEndYearToRetirement || false,
          averageSalary:
            editData.averageSalary !== undefined &&
            editData.averageSalary !== null
              ? editData.averageSalary.toString()
              : "",
          yearsOfService:
            editData.yearsOfService !== undefined &&
            editData.yearsOfService !== null
              ? editData.yearsOfService.toString()
              : "",
          noAdditionalContribution: editData.noAdditionalContribution || false,
        });
      } else if (initialData) {
        // 복사 모드 또는 재무 라이브러리 템플릿: 데이터로 초기화 (id 제외)
        // 재무 라이브러리 템플릿의 필드명 호환 처리
        const contributionAmt =
          initialData.contributionAmount !== undefined
            ? initialData.contributionAmount
            : initialData.monthlyContribution; // 템플릿에서는 monthlyContribution 사용

        // 숫자 값 포맷팅 헬퍼
        const formatNumber = (val) => {
          if (val === undefined || val === null) return "";
          if (typeof val === "number") return val.toString();
          return val;
        };
        const formatRate = (val, defaultVal) => {
          if (val === undefined || val === null) return defaultVal;
          if (typeof val === "number") return val.toFixed(2);
          return val.toString();
        };

        setFormData({
          type: initialData.type || "national",
          title: initialData.title || "",
          monthlyAmount: formatNumber(initialData.monthlyAmount),
          startYear: initialData.startYear || new Date().getFullYear(),
          startMonth: initialData.startMonth || 1,
          endYear: initialData.endYear || new Date().getFullYear() + 20,
          endMonth: initialData.endMonth || 12,
          inflationRate: formatRate(initialData.inflationRate, 1.89),
          currentAmount: formatNumber(initialData.currentAmount),
          contributionAmount: formatNumber(contributionAmt),
          contributionFrequency: initialData.contributionFrequency || "monthly",
          contributionStartYear:
            initialData.contributionStartYear || new Date().getFullYear(),
          contributionStartMonth: initialData.contributionStartMonth || 1,
          contributionEndYear:
            initialData.contributionEndYear || new Date().getFullYear() + 10,
          contributionEndMonth: initialData.contributionEndMonth || 12,
          returnRate: formatRate(initialData.returnRate, 2.86),
          paymentStartYear:
            initialData.paymentStartYear || getRetirementYear() + 1,
          paymentStartMonth: initialData.paymentStartMonth || 1,
          paymentYears: initialData.paymentYears
            ? initialData.paymentYears
            : initialData.paymentEndYear
            ? initialData.paymentEndYear - initialData.paymentStartYear
            : 10,
          memo: initialData.memo || "",
          isFixedContributionEndYearToRetirement:
            initialData.isFixedContributionEndYearToRetirement || false,
          averageSalary: formatNumber(initialData.averageSalary),
          yearsOfService: formatNumber(initialData.yearsOfService),
          noAdditionalContribution:
            initialData.noAdditionalContribution || false,
        });
      } else {
        // 새 데이터일 때 초기화
        const { age65Year, age90Year } = getDefaultYears();
        setFormData({
          type: "national",
          title: "",
          monthlyAmount: "",
          startYear: age65Year,
          startMonth: new Date().getMonth() + 1, // 현재 월
          endYear: age90Year,
          endMonth: 12,
          inflationRate: parseFloat(defaultInflationRate) || 1.89,
          currentAmount: "",
          contributionAmount: "",
          contributionFrequency: "monthly",
          contributionStartYear: new Date().getFullYear(),
          contributionStartMonth: 1,
          contributionEndYear: new Date().getFullYear() + 10,
          contributionEndMonth: 12,
          returnRate: parseFloat(defaultInvestmentReturnRate) || 2.86,
          paymentStartYear: getRetirementYear() + 1,
          paymentStartMonth: 1,
          paymentYears: 10,
          memo: "",
          isFixedContributionEndYearToRetirement: false,
          averageSalary: "",
          yearsOfService: "",
          noAdditionalContribution: false,
        });
      }
    }
  }, [isOpen, editData, initialData]);

  // ESC 키로 모달 닫기 + body 스크롤 막기
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        e.stopImmediatePropagation(); // 다른 ESC 핸들러 실행 방지
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // 모달이 열릴 때 body 스크롤 막기
      document.body.style.overflow = "hidden";
    }

    return () => {
      // 모달이 닫힐 때 body 스크롤 복원
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // 연금 타입 변경 시 기본값 설정
  const handleTypeChange = (newType) => {
    const currentYear = new Date().getFullYear();

    // 프로필 데이터에서 현재 나이 가져오기
    let currentAge = 30; // 기본값 (프로필 데이터가 없을 때만 사용)

    if (profileData) {
      // birthDate가 있는 경우
      if (profileData.birthDate) {
        const birthDate = new Date(profileData.birthDate);
        const today = new Date();
        currentAge = today.getFullYear() - birthDate.getFullYear();

        // 생일이 아직 지나지 않았다면 나이에서 1 빼기
        if (
          today.getMonth() < birthDate.getMonth() ||
          (today.getMonth() === birthDate.getMonth() &&
            today.getDate() < birthDate.getDate())
        ) {
          currentAge--;
        }
      }
      // currentKoreanAge가 있는 경우 (더 정확한 나이)
      else if (profileData.currentKoreanAge) {
        currentAge = parseInt(profileData.currentKoreanAge);
      }
      // birthYear가 있는 경우
      else if (profileData.birthYear) {
        currentAge = currentYear - parseInt(profileData.birthYear);
      }
    }

    // 출생년도 기준으로 나이 계산 (만 나이 기준)
    const birthYear = profileData?.birthYear
      ? parseInt(profileData.birthYear)
      : currentYear - currentAge;

    // 은퇴 나이 계산
    const retirementAge = parseInt(profileData?.retirementAge || 54, 10);
    // 현재 연도 기준 은퇴년도 계산 (문자열 결합 방지)
    const currentYearSafe = new Date().getFullYear();
    const currentAgeSafe = Math.max(0, currentYearSafe - birthYear);
    const retirementYear = currentYearSafe + (retirementAge - currentAgeSafe);
    const retirementYearPlus1 = retirementYear + 1; // 은퇴 년도 + 1
    const paymentEndYear = retirementYearPlus1 + 9; // 은퇴 년도 + 1부터 10년간

    // 국민연금용 (65세, 90세)
    const age65Year = birthYear + 65;
    const age90Year = birthYear + 90;

    let newFormData = { ...formData, type: newType };

    // 연금 항목명 자동 설정
    switch (newType) {
      case "national":
        newFormData.title = "국민연금";
        newFormData.startYear = age65Year + 1;
        newFormData.startMonth = 1;
        newFormData.endYear = age90Year;
        newFormData.endMonth = 12;
        newFormData.noAdditionalContribution = false; // 국민연금은 추가 적립 안함 해제
        break;
      case "retirement":
        newFormData.title = "퇴직연금";
        newFormData.contributionStartYear = currentYear; // 현재년도부터 적립 시작
        newFormData.contributionStartMonth = 1;
        newFormData.contributionEndYear = retirementYear; // 은퇴 나이까지 적립
        newFormData.contributionEndMonth = 12;
        newFormData.paymentStartYear = retirementYear + 1; // 은퇴년도부터 수령
        newFormData.paymentStartMonth = 1;
        newFormData.paymentYears = 10; // 10년간 수령
        newFormData.noAdditionalContribution = false; // 퇴직연금은 추가 적립 안함 해제
        break;
      case "personal":
        newFormData.title = "개인연금";
        newFormData.contributionStartYear = currentYear; // 현재년도부터 적립 시작
        newFormData.contributionStartMonth = 1;
        newFormData.contributionEndYear = retirementYear; // 은퇴 나이까지 적립
        newFormData.contributionEndMonth = 12;
        newFormData.paymentStartYear = retirementYear + 1; // 은퇴년도부터 수령
        newFormData.paymentStartMonth = 1;
        newFormData.paymentYears = 10; // 10년간 수령
        newFormData.noAdditionalContribution = false; // 개인연금은 추가 적립 안함 해제
        break;
      case "severance":
        newFormData.title = "퇴직금/DB";
        newFormData.noAdditionalContribution = true; // 추가 적립 안함 기본 체크
        newFormData.contributionStartYear = retirementYear; // 은퇴년도 (추가 적립 안함이므로 의미 없음)
        newFormData.contributionStartMonth = 1;
        newFormData.contributionEndYear = retirementYear; // 은퇴년도 (추가 적립 안함이므로 의미 없음)
        newFormData.contributionEndMonth = 12;
        newFormData.paymentStartYear = retirementYear + 1; // 은퇴년도 즉시 수령
        newFormData.paymentStartMonth = 1;
        newFormData.paymentYears = 1; // 은퇴년도 즉시 수령 (한번에 현금으로)
        break;
    }

    setFormData(newFormData);
  };

  // 폼 유효성 검사
  const validateForm = () => {
    const newErrors = {};

    if (!formData.type) {
      newErrors.type = "연금 타입을 선택해주세요.";
    }

    if (!formData.title.trim()) {
      newErrors.title = "연금 항목명을 입력해주세요.";
    }

    if (formData.type === "national") {
      // 국민연금
      if (!formData.monthlyAmount || formData.monthlyAmount < 0) {
        newErrors.monthlyAmount = "월 수령 금액을 입력해주세요.";
      }
      if (formData.startYear > formData.endYear) {
        newErrors.endYear = "종료년도는 시작년도보다 늦어야 합니다.";
      }
    } else if (formData.type === "severance") {
      // 퇴직금/DB형
      if (!formData.averageSalary || formData.averageSalary < 0) {
        newErrors.averageSalary = "평균 임금을 입력해주세요.";
      }
      if (!formData.yearsOfService || formData.yearsOfService < 0) {
        newErrors.yearsOfService = "재직 기간을 입력해주세요.";
      }

      // 추가 적립 안함이 아닐 때만 적립 관련 검증
      if (!formData.noAdditionalContribution) {
        // 적립 금액은 선택사항이므로 검증 제외
        if (formData.contributionAmount && formData.contributionAmount < 0) {
          newErrors.contributionAmount = "적립 금액은 0 이상이어야 합니다.";
        }
        if (formData.contributionStartYear > formData.contributionEndYear) {
          newErrors.contributionEndYear =
            "적립 종료년도는 시작년도보다 늦어야 합니다.";
        }
        if (formData.contributionEndYear > formData.paymentStartYear) {
          newErrors.paymentStartYear =
            "수령 시작년도는 적립 종료년도와 같거나 늦어야 합니다.";
        }
      }

      // 수령 기간 검증
      const paymentYearsNum = parseInt(formData.paymentYears);
      if (!paymentYearsNum || paymentYearsNum <= 0) {
        newErrors.paymentYears = "수령 기간은 1년 이상이어야 합니다.";
      }

      const returnRateNum = parseFloat(formData.returnRate);
      if (isNaN(returnRateNum) || returnRateNum < 0 || returnRateNum > 100) {
        newErrors.returnRate = "투자 수익률은 0-100% 사이여야 합니다.";
      }
    } else {
      // 퇴직연금/개인연금
      if (formData.currentAmount && formData.currentAmount < 0) {
        newErrors.currentAmount = "시작 보유액은 0 이상이어야 합니다.";
      }
      if (!formData.contributionAmount || formData.contributionAmount < 0) {
        newErrors.contributionAmount = "적립 금액을 입력해주세요.";
      }
      if (formData.contributionStartYear > formData.contributionEndYear) {
        newErrors.contributionEndYear =
          "적립 종료년도는 시작년도보다 늦어야 합니다.";
      }

      // 수령 기간 검증
      const paymentYearsNum = parseInt(formData.paymentYears);
      if (!paymentYearsNum || paymentYearsNum <= 0) {
        newErrors.paymentYears = "수령 기간은 1년 이상이어야 합니다.";
      }
      if (formData.contributionEndYear > formData.paymentStartYear) {
        newErrors.paymentStartYear =
          "수령 시작년도는 적립 종료년도와 같거나 늦어야 합니다.";
      }
      const returnRateNum = parseFloat(formData.returnRate);
      if (isNaN(returnRateNum) || returnRateNum < 0 || returnRateNum > 100) {
        newErrors.returnRate = "투자 수익률은 0-100% 사이여야 합니다.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 숫자만 입력 허용
  const handleKeyPress = (e) => {
    if (
      !/[0-9.\-]/.test(e.key) &&
      !["Backspace", "Delete", "Tab", "Enter"].includes(e.key)
    ) {
      e.preventDefault();
    }
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const pensionData = {
      ...formData,
      monthlyAmount:
        formData.type === "national" ? parseInt(formData.monthlyAmount) : 0,
      inflationRate:
        formData.type === "national" ? parseFloat(formData.inflationRate) : 0,
      startYear:
        formData.type === "national" ? parseInt(formData.startYear) : 0,
      startMonth: formData.type === "national" ? formData.startMonth || 1 : 0,
      endYear: formData.type === "national" ? parseInt(formData.endYear) : 0,
      endMonth: formData.type === "national" ? formData.endMonth || 12 : 0,
      currentAmount:
        formData.type !== "national" && formData.currentAmount
          ? parseInt(formData.currentAmount)
          : 0,
      contributionAmount:
        formData.type !== "national" && formData.contributionAmount
          ? parseInt(formData.contributionAmount)
          : 0,
      contributionStartYear:
        formData.type !== "national"
          ? parseInt(formData.contributionStartYear)
          : 0,
      contributionStartMonth:
        formData.type !== "national" ? formData.contributionStartMonth || 1 : 0,
      contributionEndYear:
        formData.type !== "national"
          ? parseInt(formData.contributionEndYear)
          : 0,
      contributionEndMonth:
        formData.type !== "national" ? formData.contributionEndMonth || 12 : 0,
      returnRate:
        formData.type !== "national" ? parseFloat(formData.returnRate) : 0, // 백분율로 저장 (사용 시 /100 해야 함)
      paymentStartYear:
        formData.type !== "national" ? parseInt(formData.paymentStartYear) : 0,
      paymentStartMonth:
        formData.type !== "national" ? formData.paymentStartMonth || 1 : 0,
      paymentYears:
        formData.type !== "national" ? parseInt(formData.paymentYears) : 0,
      isFixedContributionEndYearToRetirement:
        formData.type !== "national"
          ? formData.isFixedContributionEndYearToRetirement || false
          : false,
      // 퇴직금/DB형 전용 필드
      averageSalary:
        formData.type === "severance" && formData.averageSalary
          ? parseFloat(formData.averageSalary)
          : 0,
      yearsOfService:
        formData.type === "severance" && formData.yearsOfService
          ? parseFloat(formData.yearsOfService)
          : 0,
      selectedSimulationIds:
        selectedSimulationIds && selectedSimulationIds.length > 0
          ? selectedSimulationIds
          : activeSimulationId
          ? [activeSimulationId]
          : [],
    };

    // 수정 모드일 때는 id를 포함시켜야 함
    if (editData && editData.id) {
      pensionData.id = editData.id;
    }

    await onSave(pensionData);
    // 모달 닫기는 외부에서 처리 (SimulationCompareModal에서 onClose를 호출)
    if (!editData) {
      handleClose(); // 추가 모드일 때만 닫기
    }
  };

  // 모달 닫기 핸들러
  const handleClose = () => {
    const { age65Year, age90Year } = getDefaultYears();
    const retirementYear = getRetirementYear();
    setFormData({
      type: "",
      title: "",
      monthlyAmount: "",
      startYear: age65Year,
      startMonth: new Date().getMonth() + 1, // 현재 월
      endYear: age90Year,
      endMonth: 12,
      inflationRate: parseFloat(defaultInflationRate) || 1.89,
      currentAmount: "",
      contributionAmount: "",
      contributionFrequency: "monthly",
      contributionStartYear: new Date().getFullYear(),
      contributionStartMonth: 1,
      contributionEndYear: new Date().getFullYear() + 10,
      contributionEndMonth: 12,
      returnRate: parseFloat(defaultInvestmentReturnRate) || 2.86,
      paymentStartYear: retirementYear + 1,
      paymentStartMonth: 1,
      paymentYears: 10,
      memo: "",
      isFixedContributionEndYearToRetirement: false,
      averageSalary: "",
      yearsOfService: "",
      noAdditionalContribution: false,
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {editData ? "연금 수정" : "연금 추가"}
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>

        <form id="pensionForm" onSubmit={handleSubmit} className={styles.form}>
          {/* 연금 타입 선택 */}
          <div className={styles.field}>
            <label className={styles.label}>연금 타입 선택 *</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="pensionType"
                  value="national"
                  checked={formData.type === "national"}
                  onChange={(e) => handleTypeChange(e.target.value)}
                />
                <span className={styles.radioText}>국민연금</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="pensionType"
                  value="severance"
                  checked={formData.type === "severance"}
                  onChange={(e) => handleTypeChange(e.target.value)}
                />
                <span className={styles.radioText}>퇴직금/퇴직연금 (DB형)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="pensionType"
                  value="retirement"
                  checked={formData.type === "retirement"}
                  onChange={(e) => handleTypeChange(e.target.value)}
                />
                <span className={styles.radioText}>퇴직연금 (DC형/IRP)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="pensionType"
                  value="personal"
                  checked={formData.type === "personal"}
                  onChange={(e) => handleTypeChange(e.target.value)}
                />
                <span className={styles.radioText}>
                  개인연금 (연금저축/IRP)
                </span>
              </label>
            </div>
            {errors.type && (
              <span className={styles.errorText}>{errors.type}</span>
            )}
          </div>

          {/* 연금 타입이 선택된 경우에만 표시 */}
          {formData.type && (
            <>
              {/* 연금 항목명 */}
              <div className={styles.field}>
                <label className={styles.label}>항목명 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className={`${styles.input} ${
                    errors.title ? styles.error : ""
                  }`}
                  placeholder="예: 국민연금, 퇴직연금"
                />
                {errors.title && (
                  <span className={styles.errorText}>{errors.title}</span>
                )}
              </div>

              {formData.type === "national" ? (
                // 국민연금 필드
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      월 예상 수령 금액 (만원) *
                    </label>
                    <input
                      type="text"
                      value={formData.monthlyAmount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          monthlyAmount: e.target.value,
                        })
                      }
                      onKeyPress={handleKeyPress}
                      className={`${styles.input} ${
                        errors.monthlyAmount ? styles.error : ""
                      }`}
                      placeholder="예: 100"
                    />
                    {formData.monthlyAmount &&
                      !isNaN(parseInt(formData.monthlyAmount)) && (
                        <div className={styles.amountPreview}>
                          {formatAmountForChart(
                            parseInt(formData.monthlyAmount)
                          )}
                        </div>
                      )}
                    {errors.monthlyAmount && (
                      <span className={styles.errorText}>
                        {errors.monthlyAmount}
                      </span>
                    )}
                  </div>

                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>수령 시작년도 *</label>
                      <input
                        type="text"
                        value={formData.startYear}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startYear: parseInt(e.target.value) || 0,
                          })
                        }
                        onKeyPress={handleKeyPress}
                        className={styles.input}
                        placeholder="2025"
                      />
                      {/* 수령 시작년도 나이 표시 */}
                      {formData.startYear &&
                        profileData &&
                        profileData.birthYear && (
                          <div className={styles.agePreview}>
                            {calculateKoreanAge(
                              profileData.birthYear,
                              formData.startYear
                            )}
                            세
                          </div>
                        )}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>시작 월 *</label>
                      <select
                        value={formData.startMonth}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startMonth: parseInt(e.target.value),
                          })
                        }
                        className={styles.select}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                          <option key={m} value={m}>
                            {m}월
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>수령 종료년도 *</label>
                      <input
                        type="text"
                        value={formData.endYear}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            endYear: parseInt(e.target.value) || 0,
                          })
                        }
                        onKeyPress={handleKeyPress}
                        className={`${styles.input} ${
                          errors.endYear ? styles.error : ""
                        }`}
                        placeholder="2045"
                      />
                      {/* 수령 종료년도 나이 표시 */}
                      {formData.endYear &&
                        profileData &&
                        profileData.birthYear && (
                          <div className={styles.agePreview}>
                            {calculateKoreanAge(
                              profileData.birthYear,
                              formData.endYear
                            )}
                            세
                          </div>
                        )}
                      {errors.endYear && (
                        <span className={styles.errorText}>
                          {errors.endYear}
                        </span>
                      )}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>종료 월 *</label>
                      <select
                        value={formData.endMonth}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            endMonth: parseInt(e.target.value),
                          })
                        }
                        className={styles.select}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                          <option key={m} value={m}>
                            {m}월
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={`${styles.field} ${styles.fieldWithMargin}`}>
                    <label className={styles.label}>물가상승률 (%) *</label>
                    <input
                      type="text"
                      value={formData.inflationRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        // 숫자, 소수점, 마이너스 기호 허용 (마이너스는 맨 앞에만)
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          setFormData({
                            ...formData,
                            inflationRate: value,
                          });
                        }
                      }}
                      onKeyPress={handleKeyPress}
                      className={`${styles.input} ${
                        errors.inflationRate ? styles.error : ""
                      }`}
                      placeholder="1.89"
                    />
                    {errors.inflationRate && (
                      <span className={styles.errorText}>
                        {errors.inflationRate}
                      </span>
                    )}
                  </div>
                </>
              ) : formData.type === "severance" ? (
                // 퇴직금/DB 필드
                <>
                  {/* 평균 임금 & 재직 년도 (같은 행에 배치) */}
                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>
                        평균 임금 (월, 만원) *
                      </label>
                      <input
                        type="text"
                        value={formData.averageSalary}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            averageSalary: e.target.value,
                          })
                        }
                        onKeyPress={handleKeyPress}
                        className={`${styles.input} ${
                          errors.averageSalary ? styles.error : ""
                        }`}
                        placeholder="예: 400"
                      />
                      {formData.averageSalary &&
                        !isNaN(parseFloat(formData.averageSalary)) && (
                          <div className={styles.amountPreview}>
                            {formatAmountForChart(
                              parseFloat(formData.averageSalary)
                            )}
                          </div>
                        )}
                      {errors.averageSalary && (
                        <span className={styles.errorText}>
                          {errors.averageSalary}
                        </span>
                      )}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>재직 기간 (년) *</label>
                      <input
                        type="text"
                        value={formData.yearsOfService}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            yearsOfService: e.target.value,
                          })
                        }
                        onKeyPress={handleKeyPress}
                        className={`${styles.input} ${
                          errors.yearsOfService ? styles.error : ""
                        }`}
                        placeholder="예: 20"
                      />
                      {errors.yearsOfService && (
                        <span className={styles.errorText}>
                          {errors.yearsOfService}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 자동 계산된 보유액 표시 (읽기 전용) */}
                  <div className={styles.field}>
                    <label className={styles.label}>
                      예상 퇴직금 (자동 계산, 만원) *
                    </label>
                    <input
                      type="text"
                      value={formData.currentAmount}
                      readOnly
                      disabled
                      className={`${styles.input} ${styles.disabled}`}
                      placeholder="평균 임금 × 재직 기간"
                    />
                    {formData.currentAmount &&
                      !isNaN(parseInt(formData.currentAmount)) && (
                        <div className={styles.amountPreview}>
                          {formatAmountForChart(
                            parseInt(formData.currentAmount)
                          )}
                        </div>
                      )}
                  </div>

                  {/* 추가 적립 안함 체크박스 */}
                  <div className={styles.field}>
                    <label className={styles.fixedCheckboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.noAdditionalContribution}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          const retirementYear = getRetirementYear();
                          setFormData({
                            ...formData,
                            noAdditionalContribution: isChecked,
                            contributionAmount: isChecked
                              ? ""
                              : formData.contributionAmount,
                            // 추가 적립 안함 체크 시:
                            // - 적립년도를 은퇴년도로 고정 (시작/종료 모두)
                            // - 수령 시작년도를 은퇴년도로 변경
                            contributionStartYear: isChecked
                              ? retirementYear
                              : formData.contributionStartYear,
                            contributionEndYear: isChecked
                              ? retirementYear
                              : formData.contributionEndYear,
                            paymentStartYear: isChecked
                              ? retirementYear
                              : formData.paymentStartYear,
                          });
                        }}
                        className={styles.fixedCheckbox}
                      />
                      <span className={styles.fixedCheckboxText}>
                        추가 적립 안함
                      </span>
                    </label>
                  </div>

                  {/* 적립 금액 (추가 적립 안함이 체크되지 않았을 때만 표시) */}
                  {!formData.noAdditionalContribution && (
                    <div className={styles.field}>
                      <label className={styles.label}>
                        추가 적립 금액 (만원) *
                      </label>
                      <div className={styles.row}>
                        <input
                          type="text"
                          value={formData.contributionAmount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              contributionAmount: e.target.value,
                            })
                          }
                          onKeyPress={handleKeyPress}
                          className={`${styles.input} ${
                            errors.contributionAmount ? styles.error : ""
                          }`}
                          placeholder="예: 50 (선택사항)"
                        />
                        <select
                          value={formData.contributionFrequency}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              contributionFrequency: e.target.value,
                            })
                          }
                          className={styles.select}
                        >
                          <option value="monthly">월</option>
                          <option value="yearly">년</option>
                        </select>
                      </div>
                      {formData.contributionAmount &&
                        !isNaN(parseInt(formData.contributionAmount)) && (
                          <div className={styles.amountPreview}>
                            {formatAmountForChart(
                              parseInt(formData.contributionAmount)
                            )}
                          </div>
                        )}
                      {errors.contributionAmount && (
                        <span className={styles.errorText}>
                          {errors.contributionAmount}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 적립년도 (시작, 종료) - 추가 적립 안함이 체크되지 않았을 때만 표시 */}
                  {!formData.noAdditionalContribution && (
                    <>
                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label}>
                            적립 시작년도 *
                          </label>
                          <input
                            type="text"
                            value={formData.contributionStartYear}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                contributionStartYear:
                                  parseInt(e.target.value) || 0,
                              })
                            }
                            onKeyPress={handleKeyPress}
                            className={styles.input}
                            placeholder="은퇴년도"
                          />
                          {/* 적립 시작년도 나이 표시 */}
                          {formData.contributionStartYear &&
                            profileData &&
                            profileData.birthYear && (
                              <div className={styles.agePreview}>
                                {calculateKoreanAge(
                                  profileData.birthYear,
                                  formData.contributionStartYear
                                )}
                                세
                              </div>
                            )}
                        </div>

                        <div className={styles.field}>
                          <label className={styles.label}>적립 시작 월 *</label>
                          <select
                            value={formData.contributionStartMonth}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                contributionStartMonth: parseInt(
                                  e.target.value
                                ),
                              })
                            }
                            className={styles.select}
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
                              (m) => (
                                <option key={m} value={m}>
                                  {m}월
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      </div>

                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label}>
                            적립 종료년도 *
                          </label>
                          <input
                            type="text"
                            value={formData.contributionEndYear}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                contributionEndYear:
                                  parseInt(e.target.value) || 0,
                              })
                            }
                            onKeyPress={handleKeyPress}
                            className={`${styles.input} ${
                              errors.contributionEndYear ? styles.error : ""
                            }`}
                            placeholder="은퇴년도"
                          />
                          {/* 적립 종료년도 나이 표시 */}
                          {formData.contributionEndYear &&
                            profileData &&
                            profileData.birthYear && (
                              <div className={styles.agePreview}>
                                {calculateKoreanAge(
                                  profileData.birthYear,
                                  formData.contributionEndYear
                                )}
                                세
                              </div>
                            )}
                          {errors.contributionEndYear && (
                            <span className={styles.errorText}>
                              {errors.contributionEndYear}
                            </span>
                          )}
                        </div>

                        <div className={styles.field}>
                          <label className={styles.label}>적립 종료 월 *</label>
                          <select
                            value={formData.contributionEndMonth}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                contributionEndMonth: parseInt(e.target.value),
                              })
                            }
                            className={styles.select}
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
                              (m) => (
                                <option key={m} value={m}>
                                  {m}월
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 투자 수익률 */}
                  <div className={`${styles.field} ${styles.fieldWithMargin}`}>
                    <label className={styles.label}>연평균 수익률 (%) *</label>
                    <input
                      type="text"
                      value={formData.returnRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        // 숫자, 소수점, 마이너스 기호 허용 (마이너스는 맨 앞에만)
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          setFormData({
                            ...formData,
                            returnRate: value,
                          });
                        }
                      }}
                      onKeyPress={handleKeyPress}
                      className={`${styles.input} ${
                        errors.returnRate ? styles.error : ""
                      }`}
                      placeholder="2.86"
                    />
                    {errors.returnRate && (
                      <span className={styles.errorText}>
                        {errors.returnRate}
                      </span>
                    )}
                  </div>

                  {/* 수령년도 (시작, 종료) */}
                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>수령 시작년도 *</label>
                      <input
                        type="text"
                        value={formData.paymentStartYear}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paymentStartYear: e.target.value,
                          })
                        }
                        onKeyPress={handleKeyPress}
                        className={`${styles.input} ${
                          errors.paymentStartYear ? styles.error : ""
                        }`}
                        placeholder="은퇴년도 + 1"
                      />
                      {/* 수령 시작년도 나이 표시 */}
                      {formData.paymentStartYear &&
                        profileData &&
                        profileData.birthYear && (
                          <div className={styles.agePreview}>
                            {calculateKoreanAge(
                              profileData.birthYear,
                              formData.paymentStartYear
                            )}
                            세
                          </div>
                        )}
                      {errors.paymentStartYear && (
                        <span className={styles.errorText}>
                          {errors.paymentStartYear}
                        </span>
                      )}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>수령 시작 월 *</label>
                      <select
                        value={formData.paymentStartMonth}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paymentStartMonth: parseInt(e.target.value),
                          })
                        }
                        className={styles.select}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                          <option key={m} value={m}>
                            {m}월
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>수령 기간(년) *</label>
                      <input
                        type="text"
                        value={formData.paymentYears}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paymentYears: e.target.value,
                          })
                        }
                        onKeyPress={handleKeyPress}
                        className={`${styles.input} ${
                          errors.paymentYears ? styles.error : ""
                        }`}
                        placeholder="예: 10"
                      />
                      {errors.paymentYears && (
                        <span className={styles.errorText}>
                          {errors.paymentYears}
                        </span>
                      )}
                      <div className={styles.helperText}>
                        연금인출 방식(PMT)
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                // 퇴직연금/개인연금 필드
                <>
                  {/* 시작 보유액 */}
                  <div className={styles.field}>
                    <label className={styles.label}>
                      기 보유 금액 (만원) *
                    </label>
                    <input
                      type="text"
                      value={formData.currentAmount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currentAmount: e.target.value,
                        })
                      }
                      onKeyPress={handleKeyPress}
                      className={`${styles.input} ${
                        errors.currentAmount ? styles.error : ""
                      }`}
                      placeholder="예: 1000 (선택사항)"
                    />
                    {formData.currentAmount &&
                      !isNaN(parseInt(formData.currentAmount)) && (
                        <div className={styles.amountPreview}>
                          {formatAmountForChart(
                            parseInt(formData.currentAmount)
                          )}
                        </div>
                      )}
                    {errors.currentAmount && (
                      <span className={styles.errorText}>
                        {errors.currentAmount}
                      </span>
                    )}
                  </div>

                  {/* 적립 금액 */}
                  <div className={styles.field}>
                    <label className={styles.label}>적립 금액 (만원) *</label>
                    <div className={styles.row}>
                      <input
                        type="text"
                        value={formData.contributionAmount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contributionAmount: e.target.value,
                          })
                        }
                        onKeyPress={handleKeyPress}
                        className={`${styles.input} ${
                          errors.contributionAmount ? styles.error : ""
                        }`}
                        placeholder="예: 50"
                      />
                      <select
                        value={formData.contributionFrequency}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contributionFrequency: e.target.value,
                          })
                        }
                        className={styles.select}
                      >
                        <option value="monthly">월</option>
                        <option value="yearly">년</option>
                      </select>
                    </div>
                    {formData.contributionAmount &&
                      !isNaN(parseInt(formData.contributionAmount)) && (
                        <div className={styles.amountPreview}>
                          {formatAmountForChart(
                            parseInt(formData.contributionAmount)
                          )}
                        </div>
                      )}
                    {errors.contributionAmount && (
                      <span className={styles.errorText}>
                        {errors.contributionAmount}
                      </span>
                    )}
                  </div>

                  {/* 적립 시작년도 / 시작월 */}
                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>적립 시작년도 *</label>
                      <input
                        type="text"
                        value={formData.contributionStartYear}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contributionStartYear:
                              parseInt(e.target.value) || 0,
                          })
                        }
                        onKeyPress={handleKeyPress}
                        className={styles.input}
                        placeholder="2025"
                      />
                      {formData.contributionStartYear &&
                        profileData &&
                        profileData.birthYear && (
                          <div className={styles.agePreview}>
                            {calculateKoreanAge(
                              profileData.birthYear,
                              formData.contributionStartYear
                            )}
                            세
                          </div>
                        )}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>적립 시작 월 *</label>
                      <select
                        value={formData.contributionStartMonth}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contributionStartMonth:
                              parseInt(e.target.value) || 1,
                          })
                        }
                        className={styles.select}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                          <option key={m} value={m}>
                            {m}월
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 적립 종료년도 / 종료월 */}
                  <div className={styles.row}>
                    <div className={styles.field}>
                      <div className={styles.endYearWrapper}>
                        <label className={styles.label}>적립 종료년도 *</label>
                        <label className={styles.fixedCheckboxLabel}>
                          <input
                            type="checkbox"
                            checked={
                              formData.isFixedContributionEndYearToRetirement
                            }
                            onChange={(e) => {
                              const isFixed = e.target.checked;
                              setFormData({
                                ...formData,
                                isFixedContributionEndYearToRetirement: isFixed,
                                contributionEndYear: isFixed
                                  ? getRetirementYear()
                                  : formData.contributionEndYear,
                              });
                            }}
                            className={styles.fixedCheckbox}
                          />
                          <span className={styles.fixedCheckboxText}>
                            은퇴 시점 고정
                          </span>
                        </label>
                      </div>
                      <input
                        type="text"
                        value={formData.contributionEndYear}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setFormData({
                            ...formData,
                            contributionEndYear: value,
                            isFixedContributionEndYearToRetirement: false,
                          });
                        }}
                        disabled={
                          formData.isFixedContributionEndYearToRetirement
                        }
                        onKeyPress={handleKeyPress}
                        className={`${styles.input} ${
                          errors.contributionEndYear ? styles.error : ""
                        } ${
                          formData.isFixedContributionEndYearToRetirement
                            ? styles.disabled
                            : ""
                        }`}
                        placeholder="2035"
                      />
                      {formData.contributionEndYear &&
                        profileData &&
                        profileData.birthYear && (
                          <div className={styles.agePreview}>
                            {calculateKoreanAge(
                              profileData.birthYear,
                              formData.contributionEndYear
                            )}
                            세
                          </div>
                        )}
                      {errors.contributionEndYear && (
                        <span className={styles.errorText}>
                          {errors.contributionEndYear}
                        </span>
                      )}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>적립 종료 월 *</label>
                      <select
                        value={formData.contributionEndMonth}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contributionEndMonth:
                              parseInt(e.target.value) || 12,
                          })
                        }
                        className={styles.select}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                          <option key={m} value={m}>
                            {m}월
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 수령 시작년도 / 시작월 */}
                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>수령 시작년도 *</label>
                      <input
                        type="text"
                        value={formData.paymentStartYear}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paymentStartYear: e.target.value,
                          })
                        }
                        onKeyPress={handleKeyPress}
                        className={`${styles.input} ${
                          errors.paymentStartYear ? styles.error : ""
                        }`}
                        placeholder="2041"
                      />
                      {formData.paymentStartYear &&
                        profileData &&
                        profileData.birthYear && (
                          <div className={styles.agePreview}>
                            {calculateKoreanAge(
                              profileData.birthYear,
                              formData.paymentStartYear
                            )}
                            세
                          </div>
                        )}
                      {errors.paymentStartYear && (
                        <span className={styles.errorText}>
                          {errors.paymentStartYear}
                        </span>
                      )}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>수령 시작 월 *</label>
                      <select
                        value={formData.paymentStartMonth}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paymentStartMonth: parseInt(e.target.value),
                          })
                        }
                        className={styles.select}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                          <option key={m} value={m}>
                            {m}월
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 연평균 수익률 / 수령 기간 */}
                  <div className={`${styles.row} ${styles.rowWithMargin}`}>
                    <div className={styles.field}>
                      <label className={styles.label}>
                        연평균 수익률 (%) *
                      </label>
                      <input
                        type="text"
                        value={formData.returnRate}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                            setFormData({
                              ...formData,
                              returnRate: value,
                            });
                          }
                        }}
                        onKeyPress={handleKeyPress}
                        className={`${styles.input} ${
                          errors.returnRate ? styles.error : ""
                        }`}
                        placeholder="2.86"
                      />
                      {errors.returnRate && (
                        <span className={styles.errorText}>
                          {errors.returnRate}
                        </span>
                      )}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>수령 기간(년) *</label>
                      <input
                        type="text"
                        value={formData.paymentYears}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paymentYears: e.target.value,
                          })
                        }
                        onKeyPress={handleKeyPress}
                        className={`${styles.input} ${
                          errors.paymentYears ? styles.error : ""
                        }`}
                        placeholder="예: 10"
                      />
                      {errors.paymentYears && (
                        <span className={styles.errorText}>
                          {errors.paymentYears}
                        </span>
                      )}
                      <div className={styles.helperText}>
                        연금인출 방식(PMT)
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 메모 */}
              <div className={`${styles.field} ${styles.fieldWithMargin}`}>
                <label className={styles.label}>비고</label>
                <textarea
                  value={formData.memo}
                  onChange={(e) =>
                    setFormData({ ...formData, memo: e.target.value })
                  }
                  className={styles.textarea}
                  placeholder="추가 정보를 입력하세요"
                  rows={3}
                />
              </div>

              {/* 적용 시뮬레이션 선택 (하단 영역) */}
              {simulations && simulations.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.label}>적용 시뮬레이션</label>
                  <div>
                    {isSimSelectionLoading ? (
                      <span className={styles.hintText}>
                        시뮬레이션 목록 불러오는 중…
                      </span>
                    ) : (
                      simulations.map((sim) => {
                        const status = simulationStatusMap[sim.id] || "create";
                        const statusText =
                          status === "update" ? "(수정)" : "(추가)";
                        return (
                          <label
                            key={sim.id}
                            className={styles.fixedCheckboxLabel}
                          >
                            <input
                              type="checkbox"
                              checked={selectedSimulationIds.includes(sim.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedSimulationIds((prev) => {
                                  if (checked)
                                    return Array.from(
                                      new Set([...(prev || []), sim.id])
                                    );
                                  return (prev || []).filter(
                                    (id) => id !== sim.id
                                  );
                                });
                              }}
                              className={styles.fixedCheckbox}
                            />
                            <span className={styles.fixedCheckboxText}>
                              {sim.title ||
                                (sim.isDefault ? "현재" : "시뮬레이션")}{" "}
                              <span
                                style={{
                                  color:
                                    status === "update" ? "#2196F3" : "#4CAF50",
                                }}
                              >
                                {statusText}
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </form>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={handleClose}
          >
            취소
          </button>
          <button
            type="submit"
            form="pensionForm"
            className={styles.saveButton}
          >
            {editData ? "수정" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PensionModal;
