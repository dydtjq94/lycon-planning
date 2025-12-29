import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { calculateKoreanAge } from "../utils/koreanAge";
import {
  profileService,
  incomeService,
  expenseService,
  pensionService,
  realEstateService,
  checklistService,
  checklistTemplateService,
} from "../services/firestoreService";
import { simulationService } from "../services/simulationService";
import { formatAmountForChart } from "../utils/format";
import { buildChecklistTemplateItems } from "../constants/profileChecklist";
import { identifyUser, setUserProperties, trackEvent } from "../libs/mixpanel";
import { useAuth } from "../contexts/AuthContext";
import styles from "./OnboardingPage.module.css";

/**
 * 내담자용 온보딩 페이지
 * 링크를 통해 접근하여 단계별로 재무 정보를 입력합니다.
 *
 * 5단계 구성:
 * 1. 기본 정보 - 이름, 생년, 은퇴 나이
 * 2. 현재 재무 - 급여, 생활비, 현금
 * 3. 가족 구성 - 배우자, 자녀
 * 4. 연금 정보 - 국민연금, 퇴직연금
 * 5. 자산/부채 - 부동산, 금융자산, 부채 (선택)
 */
function OnboardingPage({ isAdminCreate = false }) {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();

  // 관리자 모드 판단: props로 전달받거나 /consult/create 경로인 경우
  const isAdminMode = isAdminCreate || location.pathname === "/consult/create";

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingProfile, setExistingProfile] = useState(null);
  const [errors, setErrors] = useState({});
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  // 관리자는 한 페이지 폼, 유저(링크 접속)는 스텝 모드
  const [useClassicMode, setUseClassicMode] = useState(isAdminMode);

  // 전체 폼 데이터
  const [formData, setFormData] = useState({
    // Step 1: 기본 정보
    name: "",
    birthYear: "",
    retirementAge: 55,

    // Step 2: 현재 재무
    currentSalary: "",
    currentLivingExpenses: "",
    currentCash: "",
    targetAssets: "",

    // Step 3: 가족 구성
    spouse: null,
    children: [],

    // Step 4: 연금 정보
    nationalPension: {
      selfAmount: "",
      selfStartAge: 65,
      spouseAmount: "",
      spouseStartAge: 65,
    },
    retirementPension: {
      currentAmount: "",
    },

    // Step 5: 자산/부채 (선택)
    realEstate: {
      hasRealEstate: false,
      title: "자택",
      currentValue: "",
    },
    financialAssets: "",
    debts: "",
  });

  // 프로필 ID가 있으면 기존 데이터 로드 (이어서 작성)
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (profileId) {
        try {
          const profile = await profileService.getProfile(profileId);
          if (profile) {
            // 이미 온보딩 완료된 경우 대시보드로 이동
            if (profile.onboardingCompleted) {
              navigate(`/consult/dashboard/${profileId}`);
              return;
            }

            setExistingProfile(profile);

            // 기존 데이터가 있으면 폼에 채우기
            if (profile.onboardingData) {
              setFormData(prev => ({
                ...prev,
                ...profile.onboardingData,
              }));
              setCurrentStep(profile.onboardingStep || 1);
            }
          }
        } catch (error) {
          console.error("프로필 로드 오류:", error);
        }
      }
      setLoading(false);
    };

    loadExistingProfile();
  }, [profileId, navigate]);

  // 자동 저장 (진행 상황 저장)
  const saveProgress = async () => {
    if (!profileId || !existingProfile) return;

    try {
      await profileService.updateProfile(profileId, {
        onboardingData: formData,
        onboardingStep: currentStep,
      });
    } catch (error) {
      console.error("진행 상황 저장 오류:", error);
    }
  };

  // 스텝 변경 시 자동 저장
  useEffect(() => {
    if (existingProfile) {
      saveProgress();
    }
  }, [currentStep, formData]);

  // 스텝별 유효성 검증
  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          newErrors.name = "이름을 입력해주세요.";
        }
        if (!formData.birthYear) {
          newErrors.birthYear = "출생년도를 입력해주세요.";
        } else {
          const birthYear = parseInt(formData.birthYear);
          const currentYear = new Date().getFullYear();
          if (birthYear < 1940 || birthYear > currentYear - 20) {
            newErrors.birthYear = "올바른 출생년도를 입력해주세요.";
          }
        }
        if (formData.retirementAge < 40 || formData.retirementAge > 80) {
          newErrors.retirementAge = "은퇴 나이는 40세에서 80세 사이여야 합니다.";
        }
        break;

      case 2:
        if (!formData.currentSalary || parseInt(formData.currentSalary) <= 0) {
          newErrors.currentSalary = "현재 급여를 입력해주세요.";
        }
        if (!formData.currentLivingExpenses || parseInt(formData.currentLivingExpenses) <= 0) {
          newErrors.currentLivingExpenses = "현재 생활비를 입력해주세요.";
        }
        break;

      case 3:
        if (formData.spouse) {
          if (!formData.spouse.name?.trim()) {
            newErrors.spouseName = "배우자 이름을 입력해주세요.";
          }
          if (!formData.spouse.birthYear) {
            newErrors.spouseBirthYear = "배우자 출생년도를 입력해주세요.";
          }
        }
        break;

      case 4:
        // 연금은 선택사항이므로 기본 유효성 검증 없음
        break;

      case 5:
        // 자산/부채는 선택사항
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 다음 스텝으로
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
      window.scrollTo(0, 0);
    }
  };

  // 이전 스텝으로
  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo(0, 0);
  };

  // 기본 소득 데이터 생성
  const createDefaultIncomes = async (profileId, simulationId, birthYear, retirementAge, currentSalary) => {
    const currentYear = new Date().getFullYear();
    const currentAge = currentYear - birthYear;
    const yearsToRetirement = retirementAge - currentAge;
    const retirementYear = currentYear + yearsToRetirement;

    const incomes = [];
    let segmentStartYear = currentYear;
    let segmentStartAge = currentAge;
    let segmentSalary = currentSalary;

    // ~50세 구간 (3.3% 상승)
    if (currentAge <= 50 && retirementAge > currentAge) {
      const segmentEndAge = Math.min(50, retirementAge);
      const segmentEndYear = birthYear + segmentEndAge;

      incomes.push({
        title: "근로소득 (본인, ~50세)",
        amount: segmentSalary,
        originalAmount: segmentSalary,
        frequency: "monthly",
        originalFrequency: "monthly",
        startYear: segmentStartYear,
        endYear: segmentEndYear,
        growthRate: 3.3,
        memo: `온보딩 시 입력한 현재 급여 기반 (만 ${currentAge}~${segmentEndAge}세, 상승률 3.3%)`,
        category: "income",
      });

      const yearsInSegment = segmentEndAge - currentAge;
      segmentSalary = Math.round(segmentSalary * Math.pow(1.033, yearsInSegment));
      segmentStartYear = segmentEndYear + 1;
      segmentStartAge = segmentEndAge + 1;
    }

    // 51~60세 구간 (0% 유지)
    if (segmentStartAge <= 60 && retirementAge >= segmentStartAge) {
      const segmentEndAge = Math.min(60, retirementAge);
      const segmentEndYear = birthYear + segmentEndAge;

      incomes.push({
        title: "근로소득 (본인, 51~60세)",
        amount: segmentSalary,
        originalAmount: segmentSalary,
        frequency: "monthly",
        originalFrequency: "monthly",
        startYear: segmentStartYear,
        endYear: segmentEndYear,
        growthRate: 0,
        memo: `온보딩 시 입력한 현재 급여 기반 (만 ${segmentStartAge}~${segmentEndAge}세, 상승률 0%)`,
        category: "income",
      });

      segmentStartYear = segmentEndYear + 1;
      segmentStartAge = segmentEndAge + 1;
    }

    // 61세~ 구간 (-3.3% 하락)
    if (segmentStartAge <= retirementAge) {
      incomes.push({
        title: "근로소득 (본인, 61세~)",
        amount: segmentSalary,
        originalAmount: segmentSalary,
        frequency: "monthly",
        originalFrequency: "monthly",
        startYear: segmentStartYear,
        endYear: retirementYear,
        growthRate: -3.3,
        memo: `온보딩 시 입력한 현재 급여 기반 (만 ${segmentStartAge}~${retirementAge}세, 하락률 -3.3%)`,
        category: "income",
      });
    }

    for (const incomeData of incomes) {
      await incomeService.createIncome(profileId, simulationId, incomeData);
    }
  };

  // 배우자 소득 데이터 생성
  const createSpouseIncome = async (profileId, simulationId, spouseBirthYear, spouseRetirementAge, spouseCurrentSalary) => {
    const currentYear = new Date().getFullYear();
    const spouseCurrentAge = currentYear - spouseBirthYear;
    const yearsToRetirement = spouseRetirementAge - spouseCurrentAge;
    const retirementYear = currentYear + yearsToRetirement;

    const incomes = [];
    let segmentStartYear = currentYear;
    let segmentStartAge = spouseCurrentAge;
    let segmentSalary = spouseCurrentSalary;

    if (spouseCurrentAge <= 50 && spouseRetirementAge > spouseCurrentAge) {
      const segmentEndAge = Math.min(50, spouseRetirementAge);
      const segmentEndYear = spouseBirthYear + segmentEndAge;

      incomes.push({
        title: "근로소득 (배우자, ~50세)",
        amount: segmentSalary,
        originalAmount: segmentSalary,
        frequency: "monthly",
        originalFrequency: "monthly",
        startYear: segmentStartYear,
        endYear: segmentEndYear,
        growthRate: 3.3,
        memo: `온보딩 시 입력한 배우자 현재 급여 기반`,
        category: "income",
      });

      const yearsInSegment = segmentEndAge - spouseCurrentAge;
      segmentSalary = Math.round(segmentSalary * Math.pow(1.033, yearsInSegment));
      segmentStartYear = segmentEndYear + 1;
      segmentStartAge = segmentEndAge + 1;
    }

    if (segmentStartAge <= 60 && spouseRetirementAge >= segmentStartAge) {
      const segmentEndAge = Math.min(60, spouseRetirementAge);
      const segmentEndYear = spouseBirthYear + segmentEndAge;

      incomes.push({
        title: "근로소득 (배우자, 51~60세)",
        amount: segmentSalary,
        originalAmount: segmentSalary,
        frequency: "monthly",
        originalFrequency: "monthly",
        startYear: segmentStartYear,
        endYear: segmentEndYear,
        growthRate: 0,
        memo: `온보딩 시 입력한 배우자 현재 급여 기반`,
        category: "income",
      });

      segmentStartYear = segmentEndYear + 1;
      segmentStartAge = segmentEndAge + 1;
    }

    if (segmentStartAge <= spouseRetirementAge) {
      incomes.push({
        title: "근로소득 (배우자, 61세~)",
        amount: segmentSalary,
        originalAmount: segmentSalary,
        frequency: "monthly",
        originalFrequency: "monthly",
        startYear: segmentStartYear,
        endYear: retirementYear,
        growthRate: -3.3,
        memo: `온보딩 시 입력한 배우자 현재 급여 기반`,
        category: "income",
      });
    }

    for (const incomeData of incomes) {
      await incomeService.createIncome(profileId, simulationId, incomeData);
    }
  };

  // 기본 지출 데이터 생성
  const createDefaultExpenses = async (profileId, simulationId, birthYear, retirementAge, currentLivingExpenses) => {
    const currentYear = new Date().getFullYear();
    const currentAge = currentYear - birthYear;
    const yearsToRetirement = retirementAge - currentAge;
    const retirementYear = currentYear + yearsToRetirement;
    const deathYear = currentYear + (90 - currentAge);

    const inflationRateToRetirement = 0.0189;
    const retirementLivingExpensesAtRetirement = Math.round(
      currentLivingExpenses * Math.pow(1 + inflationRateToRetirement, yearsToRetirement)
    );
    const retirementLivingExpensesAfter = Math.round(retirementLivingExpensesAtRetirement * 0.7);

    const expenses = [
      {
        title: "은퇴 전 생활비",
        amount: currentLivingExpenses,
        frequency: "monthly",
        startYear: currentYear,
        endYear: retirementYear,
        growthRate: 1.89,
        memo: "물가상승률 1.89% 적용",
        category: "expense",
      },
      {
        title: "은퇴 후 생활비",
        amount: retirementLivingExpensesAfter,
        frequency: "monthly",
        startYear: retirementYear + 1,
        endYear: deathYear,
        growthRate: 1.0,
        memo: "물가상승률 1% 적용",
        category: "expense",
      },
    ];

    for (const expense of expenses) {
      await expenseService.createExpense(profileId, simulationId, expense);
    }
  };

  // 국민연금 데이터 생성
  const createPension = async (profileId, simulationId, birthYear, pensionData, isSpouse = false) => {
    const amount = isSpouse ? pensionData.spouseAmount : pensionData.selfAmount;
    const startAge = isSpouse ? pensionData.spouseStartAge : pensionData.selfStartAge;

    if (!amount || parseInt(amount) <= 0) return;

    const startYear = birthYear + parseInt(startAge);
    const endYear = birthYear + 90;

    const pension = {
      title: isSpouse ? "국민연금 (배우자)" : "국민연금 (본인)",
      type: "national",
      monthlyAmount: parseInt(amount),
      startYear,
      endYear,
      inflationRate: 1.89,
      memo: "온보딩 시 입력",
    };

    await pensionService.createPension(profileId, simulationId, pension);
  };

  // 기본 부동산 데이터 생성
  const createRealEstate = async (profileId, simulationId, realEstateData) => {
    if (!realEstateData.hasRealEstate || !realEstateData.currentValue) return;

    const currentYear = new Date().getFullYear();
    const defaultRealEstate = {
      title: realEstateData.title || "자택",
      currentValue: parseInt(realEstateData.currentValue),
      growthRate: 2.4,
      startYear: currentYear,
      endYear: 2099,
      isResidential: true,
      hasRentalIncome: false,
      convertToPension: false,
      memo: "온보딩 시 입력",
    };

    await realEstateService.createRealEstate(profileId, simulationId, defaultRealEstate);
  };

  // 최종 제출
  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    setIsSubmitting(true);

    try {
      const birthYear = parseInt(formData.birthYear);
      const currentYear = new Date().getFullYear();
      const currentKoreanAge = calculateKoreanAge(birthYear, currentYear);
      const yearsToRetirement = formData.retirementAge - currentKoreanAge;
      const retirementYear = currentYear + yearsToRetirement;

      // 가족 구성원 정리
      const familyMembers = formData.children
        .filter(child => child.name?.trim() && child.birthYear)
        .map(child => ({
          name: child.name,
          birthYear: parseInt(child.birthYear),
          relationship: "자녀",
          gender: child.gender || "아들",
        }));

      // 프로필 데이터
      const profileData = {
        name: formData.name.trim(),
        birthYear,
        currentKoreanAge,
        retirementAge: parseInt(formData.retirementAge),
        retirementYear,
        currentSalary: parseInt(formData.currentSalary),
        currentLivingExpenses: parseInt(formData.currentLivingExpenses),
        targetAssets: parseInt(formData.targetAssets) || 0,
        currentCash: parseInt(formData.currentCash) || 0,
        status: "sample",
        hasSpouse: formData.spouse !== null,
        spouseName: formData.spouse?.name || "",
        spouseBirthYear: formData.spouse?.birthYear ? parseInt(formData.spouse.birthYear) : "",
        spouseIsWorking: formData.spouse?.isWorking || false,
        spouseCurrentSalary: formData.spouse?.isWorking ? parseInt(formData.spouse.currentSalary) : 0,
        spouseRetirementAge: formData.spouse?.isWorking ? parseInt(formData.spouse.retirementAge) : 0,
        familyMembers,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      let createdProfileId = profileId;

      // 새 프로필 생성 또는 기존 프로필 업데이트
      if (existingProfile) {
        await profileService.updateProfile(profileId, profileData);
      } else {
        const createdProfile = await profileService.createProfile(profileData);
        createdProfileId = createdProfile.id;
      }

      // 체크리스트 생성
      try {
        let templateItems = [];
        const template = await checklistTemplateService.getTemplate();
        if (template && template.items) {
          templateItems = template.items;
        } else {
          const defaultItems = buildChecklistTemplateItems();
          await checklistTemplateService.initializeDefaultTemplate(defaultItems);
          templateItems = defaultItems;
        }
        await checklistService.createChecklist(createdProfileId, {
          title: "체크리스트",
          items: templateItems,
        });
      } catch (error) {
        console.error("체크리스트 생성 오류:", error);
      }

      // 기본 시뮬레이션 생성
      let defaultSimulationId;
      try {
        defaultSimulationId = await simulationService.createSimulation(createdProfileId, {
          title: "현재",
          isDefault: true,
        });
      } catch (error) {
        console.error("시뮬레이션 생성 오류:", error);
        throw new Error("시뮬레이션 생성에 실패했습니다.");
      }

      // 소득 데이터 생성
      await createDefaultIncomes(
        createdProfileId,
        defaultSimulationId,
        birthYear,
        formData.retirementAge,
        parseInt(formData.currentSalary)
      );

      // 배우자 소득 데이터 생성
      if (formData.spouse?.isWorking && formData.spouse.currentSalary) {
        await createSpouseIncome(
          createdProfileId,
          defaultSimulationId,
          parseInt(formData.spouse.birthYear),
          parseInt(formData.spouse.retirementAge),
          parseInt(formData.spouse.currentSalary)
        );
      }

      // 지출 데이터 생성
      await createDefaultExpenses(
        createdProfileId,
        defaultSimulationId,
        birthYear,
        formData.retirementAge,
        parseInt(formData.currentLivingExpenses)
      );

      // 국민연금 생성 (본인)
      if (formData.nationalPension.selfAmount) {
        await createPension(createdProfileId, defaultSimulationId, birthYear, formData.nationalPension, false);
      }

      // 국민연금 생성 (배우자)
      if (formData.spouse && formData.nationalPension.spouseAmount) {
        const spouseBirthYear = parseInt(formData.spouse.birthYear);
        await createPension(createdProfileId, defaultSimulationId, spouseBirthYear, formData.nationalPension, true);
      }

      // 부동산 생성
      await createRealEstate(createdProfileId, defaultSimulationId, formData.realEstate);

      // Mixpanel 트래킹
      try {
        identifyUser(createdProfileId);
        setUserProperties({
          $name: formData.name.trim(),
          profileName: formData.name.trim(),
          birthYear,
          age: currentKoreanAge,
          retirementAge: parseInt(formData.retirementAge),
          hasSpouse: formData.spouse !== null,
          onboardingCompleted: true,
          createdAt: new Date().toISOString(),
        });
        trackEvent("온보딩 완료", {
          profileId: createdProfileId,
          profileName: formData.name.trim(),
          age: currentKoreanAge,
          retirementAge: parseInt(formData.retirementAge),
          hasSpouse: formData.spouse !== null,
        });
      } catch (error) {
        console.error("Mixpanel 오류:", error);
      }

      // 대시보드로 이동
      navigate(`/consult/dashboard/${createdProfileId}`);

    } catch (error) {
      console.error("온보딩 완료 오류:", error);
      setErrors({ form: error.message || "온보딩 완료 중 오류가 발생했습니다." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 입력 핸들러
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  // 배우자 추가/제거
  const toggleSpouse = () => {
    if (formData.spouse) {
      setFormData(prev => ({ ...prev, spouse: null }));
    } else {
      setFormData(prev => ({
        ...prev,
        spouse: { name: "", birthYear: "", isWorking: false, currentSalary: "", retirementAge: 55 },
      }));
    }
  };

  // 배우자 정보 변경
  const handleSpouseChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      spouse: { ...prev.spouse, [field]: value },
    }));
  };

  // 자녀 추가
  const addChild = () => {
    setFormData(prev => ({
      ...prev,
      children: [...prev.children, { name: "", birthYear: "", gender: "아들" }],
    }));
  };

  // 자녀 제거
  const removeChild = (index) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index),
    }));
  };

  // 자녀 정보 변경
  const handleChildChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.map((child, i) =>
        i === index ? { ...child, [field]: value } : child
      ),
    }));
  };

  // 연금 정보 변경
  const handlePensionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      nationalPension: { ...prev.nationalPension, [field]: value },
    }));
  };

  // 부동산 정보 변경
  const handleRealEstateChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      realEstate: { ...prev.realEstate, [field]: value },
    }));
  };

  // 관리자: 온보딩 링크 생성
  const handleCreateOnboardingLink = async () => {
    setIsSubmitting(true);
    try {
      const profileData = {
        name: formData.name.trim() || "새 내담자",
        status: "온보딩중",
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
      };

      const createdProfile = await profileService.createProfile(profileData);
      const onboardingLink = `${window.location.origin}/onboarding/${createdProfile.id}`;

      setGeneratedLink(onboardingLink);
      setShowLinkModal(true);

      // 클립보드에 복사
      await navigator.clipboard.writeText(onboardingLink);

      trackEvent("온보딩 링크 생성", {
        profileId: createdProfile.id,
      });
    } catch (error) {
      console.error("온보딩 링크 생성 오류:", error);
      setErrors({ form: "온보딩 링크 생성 중 오류가 발생했습니다." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 관리자: 현재 스텝 건너뛰기
  const handleSkipStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 5));
    window.scrollTo(0, 0);
  };

  // 관리자: 전체 건너뛰고 바로 완료 (최소 정보만)
  const handleSkipAll = async () => {
    // 최소 필수 정보 검증
    if (!formData.name.trim()) {
      setErrors({ name: "이름은 필수입니다." });
      setCurrentStep(1);
      return;
    }
    if (!formData.birthYear) {
      setErrors({ birthYear: "출생년도는 필수입니다." });
      setCurrentStep(1);
      return;
    }
    if (!formData.currentSalary) {
      setErrors({ currentSalary: "현재 급여는 필수입니다." });
      setCurrentStep(2);
      return;
    }
    if (!formData.currentLivingExpenses) {
      setErrors({ currentLivingExpenses: "현재 생활비는 필수입니다." });
      setCurrentStep(2);
      return;
    }

    // 나머지 진행
    await handleSubmit();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>로딩 중...</div>
      </div>
    );
  }

  // 스텝 타이틀
  const stepTitles = [
    "기본 정보",
    "현재 재무",
    "가족 구성",
    "연금 정보",
    "자산/부채",
  ];

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <header className={styles.header}>
        {isAdminMode && (
          <button
            className={styles.backButton}
            onClick={() => navigate("/consult")}
          >
            ← 목록으로
          </button>
        )}
        <div className={styles.logo}>Lycon Retire</div>
        <div className={styles.headerTitle}>
          {isAdminMode ? "새 프로필 생성" : "은퇴 재무 설계 시작하기"}
        </div>
        {isAdminMode && isAdmin && (
          <div className={styles.headerButtons}>
            <button
              className={styles.linkButton}
              onClick={handleCreateOnboardingLink}
              disabled={isSubmitting}
            >
              링크 생성
            </button>
            <button
              className={styles.classicButton}
              onClick={() => setUseClassicMode(!useClassicMode)}
            >
              {useClassicMode ? "스텝 모드" : "한 페이지 모드"}
            </button>
          </div>
        )}
      </header>

      {/* 링크 생성 모달 */}
      {showLinkModal && (
        <div className={styles.modalOverlay} onClick={() => setShowLinkModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>온보딩 링크가 생성되었습니다!</h3>
            <p className={styles.modalDesc}>링크가 클립보드에 복사되었습니다.</p>
            <div className={styles.linkBox}>
              <code>{generatedLink}</code>
            </div>
            <p className={styles.modalHint}>이 링크를 내담자에게 카카오톡이나 문자로 보내주세요.</p>
            <div className={styles.modalButtons}>
              <button
                className={styles.modalSecondaryButton}
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink);
                  alert("복사되었습니다!");
                }}
              >
                다시 복사
              </button>
              <button
                className={styles.modalPrimaryButton}
                onClick={() => {
                  setShowLinkModal(false);
                  navigate("/consult");
                }}
              >
                목록으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 클래식 모드: 한 페이지에 모든 입력 */}
      {useClassicMode ? (
        <div className={styles.classicContainer}>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className={styles.classicForm}>
            {errors.form && (
              <div className={styles.errorBanner}>{errors.form}</div>
            )}

            <div className={styles.classicTwoColumn}>
              {/* 왼쪽: 기본 정보 + 재무 */}
              <div className={styles.classicColumn}>
                <h3 className={styles.classicColumnTitle}>기본 정보</h3>

                <div className={styles.classicFieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>이름 *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                      placeholder="홍길동"
                    />
                    {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      출생년도 *
                      {formData.birthYear && (
                        <span className={styles.hint}> (만 {calculateKoreanAge(parseInt(formData.birthYear))}세)</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formData.birthYear}
                      onChange={(e) => handleChange("birthYear", e.target.value.replace(/\D/g, ""))}
                      className={`${styles.input} ${errors.birthYear ? styles.inputError : ""}`}
                      placeholder="1980"
                      maxLength={4}
                    />
                    {errors.birthYear && <span className={styles.errorText}>{errors.birthYear}</span>}
                  </div>
                </div>

                <div className={styles.classicFieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>은퇴 목표 나이 *</label>
                    <input
                      type="number"
                      value={formData.retirementAge}
                      onChange={(e) => handleChange("retirementAge", parseInt(e.target.value) || 55)}
                      className={styles.input}
                      min={40}
                      max={80}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>은퇴 시 목표 자산 (만원)</label>
                    <input
                      type="text"
                      value={formData.targetAssets}
                      onChange={(e) => handleChange("targetAssets", e.target.value.replace(/\D/g, ""))}
                      className={styles.input}
                      placeholder="100000"
                    />
                    {formData.targetAssets && (
                      <span className={styles.amountPreview}>{formatAmountForChart(parseInt(formData.targetAssets))}</span>
                    )}
                  </div>
                </div>

                <h3 className={styles.classicColumnTitle} style={{ marginTop: "1.5rem" }}>현재 재무</h3>

                <div className={styles.classicFieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>현재 월 급여 (만원) *</label>
                    <input
                      type="text"
                      value={formData.currentSalary}
                      onChange={(e) => handleChange("currentSalary", e.target.value.replace(/\D/g, ""))}
                      className={`${styles.input} ${errors.currentSalary ? styles.inputError : ""}`}
                      placeholder="450"
                    />
                    {formData.currentSalary && (
                      <span className={styles.amountPreview}>{formatAmountForChart(parseInt(formData.currentSalary))}</span>
                    )}
                    {errors.currentSalary && <span className={styles.errorText}>{errors.currentSalary}</span>}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>현재 월 생활비 (만원) *</label>
                    <input
                      type="text"
                      value={formData.currentLivingExpenses}
                      onChange={(e) => handleChange("currentLivingExpenses", e.target.value.replace(/\D/g, ""))}
                      className={`${styles.input} ${errors.currentLivingExpenses ? styles.inputError : ""}`}
                      placeholder="300"
                    />
                    {formData.currentLivingExpenses && (
                      <span className={styles.amountPreview}>{formatAmountForChart(parseInt(formData.currentLivingExpenses))}</span>
                    )}
                    {errors.currentLivingExpenses && <span className={styles.errorText}>{errors.currentLivingExpenses}</span>}
                  </div>
                </div>

                <div className={styles.classicFieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>현재 보유 현금 (만원)</label>
                    <input
                      type="text"
                      value={formData.currentCash}
                      onChange={(e) => handleChange("currentCash", e.target.value.replace(/\D/g, ""))}
                      className={styles.input}
                      placeholder="5000"
                    />
                    {formData.currentCash && (
                      <span className={styles.amountPreview}>{formatAmountForChart(parseInt(formData.currentCash))}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 오른쪽: 가족 구성 */}
              <div className={styles.classicColumn}>
                <h3 className={styles.classicColumnTitle}>가족 구성</h3>

                {/* 배우자 */}
                <div className={styles.classicFamilySection}>
                  <div className={styles.familyHeader}>
                    <span className={styles.familyTitle}>배우자</span>
                    <button
                      type="button"
                      onClick={toggleSpouse}
                      className={formData.spouse ? styles.removeButton : styles.addButton}
                    >
                      {formData.spouse ? "삭제" : "+ 추가"}
                    </button>
                  </div>
                  {formData.spouse && (
                    <div className={styles.classicFamilyCard}>
                      <div className={styles.classicFieldRow}>
                        <div className={styles.field}>
                          <label className={styles.label}>이름</label>
                          <input
                            type="text"
                            value={formData.spouse.name}
                            onChange={(e) => handleSpouseChange("name", e.target.value)}
                            className={styles.input}
                            placeholder="배우자 이름"
                          />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>출생년도</label>
                          <input
                            type="text"
                            value={formData.spouse.birthYear}
                            onChange={(e) => handleSpouseChange("birthYear", e.target.value.replace(/\D/g, ""))}
                            className={styles.input}
                            placeholder="1982"
                            maxLength={4}
                          />
                        </div>
                      </div>
                      <div className={styles.checkboxField}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={formData.spouse.isWorking}
                            onChange={(e) => handleSpouseChange("isWorking", e.target.checked)}
                          />
                          현재 일하고 있습니다
                        </label>
                      </div>
                      {formData.spouse.isWorking && (
                        <div className={styles.classicFieldRow}>
                          <div className={styles.field}>
                            <label className={styles.label}>월 급여 (만원)</label>
                            <input
                              type="text"
                              value={formData.spouse.currentSalary}
                              onChange={(e) => handleSpouseChange("currentSalary", e.target.value.replace(/\D/g, ""))}
                              className={styles.input}
                              placeholder="350"
                            />
                          </div>
                          <div className={styles.field}>
                            <label className={styles.label}>은퇴 목표 나이</label>
                            <input
                              type="number"
                              value={formData.spouse.retirementAge}
                              onChange={(e) => handleSpouseChange("retirementAge", parseInt(e.target.value) || 55)}
                              className={styles.input}
                              min={40}
                              max={80}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 자녀 */}
                <div className={styles.classicFamilySection}>
                  <div className={styles.familyHeader}>
                    <span className={styles.familyTitle}>자녀</span>
                    <button type="button" onClick={addChild} className={styles.addButton}>
                      + 추가
                    </button>
                  </div>
                  {formData.children.map((child, index) => (
                    <div key={index} className={styles.classicFamilyCard}>
                      <button
                        type="button"
                        onClick={() => removeChild(index)}
                        className={styles.cardRemoveButton}
                      >
                        ×
                      </button>
                      <div className={styles.classicFieldRow}>
                        <div className={styles.field}>
                          <label className={styles.label}>{index + 1}째 자녀 이름</label>
                          <input
                            type="text"
                            value={child.name}
                            onChange={(e) => handleChildChange(index, "name", e.target.value)}
                            className={styles.input}
                            placeholder="이름"
                          />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>성별</label>
                          <select
                            value={child.gender}
                            onChange={(e) => handleChildChange(index, "gender", e.target.value)}
                            className={styles.select}
                          >
                            <option value="아들">아들</option>
                            <option value="딸">딸</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>출생년도</label>
                          <input
                            type="text"
                            value={child.birthYear}
                            onChange={(e) => handleChildChange(index, "birthYear", e.target.value.replace(/\D/g, ""))}
                            className={styles.input}
                            placeholder="2015"
                            maxLength={4}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 클래식 모드 제출 버튼 */}
            <div className={styles.classicSubmitContainer}>
              <button
                type="submit"
                className={styles.classicSubmitButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? "생성 중..." : "프로필 생성"}
              </button>
            </div>
          </form>
        </div>
      ) : (
      <>
      {/* 진행 바 */}
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
        <div className={styles.stepIndicator}>
          {stepTitles.map((title, index) => (
            <div
              key={index}
              className={`${styles.stepDot} ${index + 1 <= currentStep ? styles.active : ""}`}
            >
              <span className={styles.stepNumber}>{index + 1}</span>
              <span className={styles.stepTitle}>{title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className={styles.main}>
        <div className={styles.formCard}>
          {errors.form && (
            <div className={styles.errorBanner}>{errors.form}</div>
          )}

          {/* Step 1: 기본 정보 */}
          {currentStep === 1 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepHeading}>기본 정보를 입력해주세요</h2>
              <p className={styles.stepDescription}>
                은퇴 설계의 기초가 되는 정보입니다.
              </p>

              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label className={styles.label}>이름 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                    placeholder="홍길동"
                  />
                  {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      출생년도 *
                      {formData.birthYear && (
                        <span className={styles.hint}>
                          (만 {calculateKoreanAge(parseInt(formData.birthYear))}세)
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formData.birthYear}
                      onChange={(e) => handleChange("birthYear", e.target.value.replace(/\D/g, ""))}
                      className={`${styles.input} ${errors.birthYear ? styles.inputError : ""}`}
                      placeholder="1980"
                      maxLength={4}
                    />
                    {errors.birthYear && <span className={styles.errorText}>{errors.birthYear}</span>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>
                      은퇴 목표 나이 *
                      {formData.birthYear && formData.retirementAge && (
                        <span className={styles.hint}>
                          ({parseInt(formData.birthYear) + parseInt(formData.retirementAge)}년)
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={formData.retirementAge}
                      onChange={(e) => handleChange("retirementAge", parseInt(e.target.value) || 55)}
                      className={`${styles.input} ${errors.retirementAge ? styles.inputError : ""}`}
                      min={40}
                      max={80}
                    />
                    {errors.retirementAge && <span className={styles.errorText}>{errors.retirementAge}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 현재 재무 */}
          {currentStep === 2 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepHeading}>현재 재무 상황을 알려주세요</h2>
              <p className={styles.stepDescription}>
                월 기준 금액을 만원 단위로 입력해주세요.
              </p>

              <div className={styles.fieldGroup}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>현재 월 급여 (만원) *</label>
                    <input
                      type="text"
                      value={formData.currentSalary}
                      onChange={(e) => handleChange("currentSalary", e.target.value.replace(/\D/g, ""))}
                      className={`${styles.input} ${errors.currentSalary ? styles.inputError : ""}`}
                      placeholder="450"
                    />
                    {formData.currentSalary && (
                      <span className={styles.amountPreview}>
                        {formatAmountForChart(parseInt(formData.currentSalary))}
                      </span>
                    )}
                    {errors.currentSalary && <span className={styles.errorText}>{errors.currentSalary}</span>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>현재 월 생활비 (만원) *</label>
                    <input
                      type="text"
                      value={formData.currentLivingExpenses}
                      onChange={(e) => handleChange("currentLivingExpenses", e.target.value.replace(/\D/g, ""))}
                      className={`${styles.input} ${errors.currentLivingExpenses ? styles.inputError : ""}`}
                      placeholder="300"
                    />
                    {formData.currentLivingExpenses && (
                      <span className={styles.amountPreview}>
                        {formatAmountForChart(parseInt(formData.currentLivingExpenses))}
                      </span>
                    )}
                    {errors.currentLivingExpenses && <span className={styles.errorText}>{errors.currentLivingExpenses}</span>}
                  </div>
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>현재 보유 현금 (만원)</label>
                    <input
                      type="text"
                      value={formData.currentCash}
                      onChange={(e) => handleChange("currentCash", e.target.value.replace(/\D/g, ""))}
                      className={styles.input}
                      placeholder="5000"
                    />
                    {formData.currentCash && (
                      <span className={styles.amountPreview}>
                        {formatAmountForChart(parseInt(formData.currentCash))}
                      </span>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>은퇴 시 목표 자산 (만원)</label>
                    <input
                      type="text"
                      value={formData.targetAssets}
                      onChange={(e) => handleChange("targetAssets", e.target.value.replace(/\D/g, ""))}
                      className={styles.input}
                      placeholder="100000"
                    />
                    {formData.targetAssets && (
                      <span className={styles.amountPreview}>
                        {formatAmountForChart(parseInt(formData.targetAssets))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 가족 구성 */}
          {currentStep === 3 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepHeading}>가족 구성을 알려주세요</h2>
              <p className={styles.stepDescription}>
                배우자와 자녀 정보를 입력해주세요. (선택사항)
              </p>

              <div className={styles.fieldGroup}>
                {/* 배우자 */}
                <div className={styles.familySection}>
                  <div className={styles.familyHeader}>
                    <h3 className={styles.familyTitle}>배우자</h3>
                    <button
                      type="button"
                      onClick={toggleSpouse}
                      className={formData.spouse ? styles.removeButton : styles.addButton}
                    >
                      {formData.spouse ? "삭제" : "+ 추가"}
                    </button>
                  </div>

                  {formData.spouse && (
                    <div className={styles.familyCard}>
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label className={styles.label}>이름</label>
                          <input
                            type="text"
                            value={formData.spouse.name}
                            onChange={(e) => handleSpouseChange("name", e.target.value)}
                            className={`${styles.input} ${errors.spouseName ? styles.inputError : ""}`}
                            placeholder="배우자 이름"
                          />
                          {errors.spouseName && <span className={styles.errorText}>{errors.spouseName}</span>}
                        </div>

                        <div className={styles.field}>
                          <label className={styles.label}>
                            출생년도
                            {formData.spouse.birthYear && (
                              <span className={styles.hint}>
                                (만 {calculateKoreanAge(parseInt(formData.spouse.birthYear))}세)
                              </span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={formData.spouse.birthYear}
                            onChange={(e) => handleSpouseChange("birthYear", e.target.value.replace(/\D/g, ""))}
                            className={`${styles.input} ${errors.spouseBirthYear ? styles.inputError : ""}`}
                            placeholder="1982"
                            maxLength={4}
                          />
                          {errors.spouseBirthYear && <span className={styles.errorText}>{errors.spouseBirthYear}</span>}
                        </div>
                      </div>

                      <div className={styles.checkboxField}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={formData.spouse.isWorking}
                            onChange={(e) => handleSpouseChange("isWorking", e.target.checked)}
                          />
                          현재 일하고 있습니다
                        </label>
                      </div>

                      {formData.spouse.isWorking && (
                        <div className={styles.fieldRow}>
                          <div className={styles.field}>
                            <label className={styles.label}>월 급여 (만원)</label>
                            <input
                              type="text"
                              value={formData.spouse.currentSalary}
                              onChange={(e) => handleSpouseChange("currentSalary", e.target.value.replace(/\D/g, ""))}
                              className={styles.input}
                              placeholder="350"
                            />
                          </div>
                          <div className={styles.field}>
                            <label className={styles.label}>은퇴 목표 나이</label>
                            <input
                              type="number"
                              value={formData.spouse.retirementAge}
                              onChange={(e) => handleSpouseChange("retirementAge", parseInt(e.target.value) || 55)}
                              className={styles.input}
                              min={40}
                              max={80}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 자녀 */}
                <div className={styles.familySection}>
                  <div className={styles.familyHeader}>
                    <h3 className={styles.familyTitle}>자녀</h3>
                    <button type="button" onClick={addChild} className={styles.addButton}>
                      + 추가
                    </button>
                  </div>

                  {formData.children.map((child, index) => (
                    <div key={index} className={styles.familyCard}>
                      <button
                        type="button"
                        onClick={() => removeChild(index)}
                        className={styles.cardRemoveButton}
                      >
                        ×
                      </button>
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label className={styles.label}>{index + 1}째 자녀 이름</label>
                          <input
                            type="text"
                            value={child.name}
                            onChange={(e) => handleChildChange(index, "name", e.target.value)}
                            className={styles.input}
                            placeholder="이름"
                          />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>성별</label>
                          <select
                            value={child.gender}
                            onChange={(e) => handleChildChange(index, "gender", e.target.value)}
                            className={styles.select}
                          >
                            <option value="아들">아들</option>
                            <option value="딸">딸</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>
                            출생년도
                            {child.birthYear && (
                              <span className={styles.hint}>
                                (만 {calculateKoreanAge(parseInt(child.birthYear))}세)
                              </span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={child.birthYear}
                            onChange={(e) => handleChildChange(index, "birthYear", e.target.value.replace(/\D/g, ""))}
                            className={styles.input}
                            placeholder="2015"
                            maxLength={4}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: 연금 정보 */}
          {currentStep === 4 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepHeading}>연금 정보를 알려주세요</h2>
              <p className={styles.stepDescription}>
                예상 수령액을 모르시면 비워두셔도 됩니다.
              </p>

              <div className={styles.fieldGroup}>
                {/* 국민연금 - 본인 */}
                <div className={styles.pensionSection}>
                  <h3 className={styles.pensionTitle}>국민연금 (본인)</h3>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>예상 월 수령액 (만원)</label>
                      <input
                        type="text"
                        value={formData.nationalPension.selfAmount}
                        onChange={(e) => handlePensionChange("selfAmount", e.target.value.replace(/\D/g, ""))}
                        className={styles.input}
                        placeholder="100"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>수령 시작 나이</label>
                      <input
                        type="number"
                        value={formData.nationalPension.selfStartAge}
                        onChange={(e) => handlePensionChange("selfStartAge", parseInt(e.target.value) || 65)}
                        className={styles.input}
                        min={60}
                        max={70}
                      />
                    </div>
                  </div>
                </div>

                {/* 국민연금 - 배우자 */}
                {formData.spouse && (
                  <div className={styles.pensionSection}>
                    <h3 className={styles.pensionTitle}>국민연금 (배우자)</h3>
                    <div className={styles.fieldRow}>
                      <div className={styles.field}>
                        <label className={styles.label}>예상 월 수령액 (만원)</label>
                        <input
                          type="text"
                          value={formData.nationalPension.spouseAmount}
                          onChange={(e) => handlePensionChange("spouseAmount", e.target.value.replace(/\D/g, ""))}
                          className={styles.input}
                          placeholder="80"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>수령 시작 나이</label>
                        <input
                          type="number"
                          value={formData.nationalPension.spouseStartAge}
                          onChange={(e) => handlePensionChange("spouseStartAge", parseInt(e.target.value) || 65)}
                          className={styles.input}
                          min={60}
                          max={70}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 퇴직연금 */}
                <div className={styles.pensionSection}>
                  <h3 className={styles.pensionTitle}>퇴직연금</h3>
                  <div className={styles.field}>
                    <label className={styles.label}>현재 적립금 (만원)</label>
                    <input
                      type="text"
                      value={formData.retirementPension.currentAmount}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        retirementPension: { ...prev.retirementPension, currentAmount: e.target.value.replace(/\D/g, "") }
                      }))}
                      className={styles.input}
                      placeholder="5000"
                    />
                    {formData.retirementPension.currentAmount && (
                      <span className={styles.amountPreview}>
                        {formatAmountForChart(parseInt(formData.retirementPension.currentAmount))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: 자산/부채 */}
          {currentStep === 5 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepHeading}>자산과 부채를 알려주세요</h2>
              <p className={styles.stepDescription}>
                선택사항입니다. 나중에 대시보드에서 추가할 수 있습니다.
              </p>

              <div className={styles.fieldGroup}>
                {/* 부동산 */}
                <div className={styles.assetSection}>
                  <div className={styles.checkboxField}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.realEstate.hasRealEstate}
                        onChange={(e) => handleRealEstateChange("hasRealEstate", e.target.checked)}
                      />
                      보유 부동산이 있습니다
                    </label>
                  </div>

                  {formData.realEstate.hasRealEstate && (
                    <div className={styles.fieldRow}>
                      <div className={styles.field}>
                        <label className={styles.label}>부동산 명칭</label>
                        <input
                          type="text"
                          value={formData.realEstate.title}
                          onChange={(e) => handleRealEstateChange("title", e.target.value)}
                          className={styles.input}
                          placeholder="자택"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>현재 시가 (만원)</label>
                        <input
                          type="text"
                          value={formData.realEstate.currentValue}
                          onChange={(e) => handleRealEstateChange("currentValue", e.target.value.replace(/\D/g, ""))}
                          className={styles.input}
                          placeholder="50000"
                        />
                        {formData.realEstate.currentValue && (
                          <span className={styles.amountPreview}>
                            {formatAmountForChart(parseInt(formData.realEstate.currentValue))}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 금융자산 */}
                <div className={styles.assetSection}>
                  <div className={styles.field}>
                    <label className={styles.label}>기타 금융자산 총액 (만원)</label>
                    <input
                      type="text"
                      value={formData.financialAssets}
                      onChange={(e) => handleChange("financialAssets", e.target.value.replace(/\D/g, ""))}
                      className={styles.input}
                      placeholder="주식, 펀드, 예적금 등"
                    />
                    {formData.financialAssets && (
                      <span className={styles.amountPreview}>
                        {formatAmountForChart(parseInt(formData.financialAssets))}
                      </span>
                    )}
                  </div>
                </div>

                {/* 부채 */}
                <div className={styles.assetSection}>
                  <div className={styles.field}>
                    <label className={styles.label}>부채 총액 (만원)</label>
                    <input
                      type="text"
                      value={formData.debts}
                      onChange={(e) => handleChange("debts", e.target.value.replace(/\D/g, ""))}
                      className={styles.input}
                      placeholder="대출 잔액 등"
                    />
                    {formData.debts && (
                      <span className={styles.amountPreview}>
                        {formatAmountForChart(parseInt(formData.debts))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 하단 네비게이션 */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className={styles.prevButton}
              disabled={isSubmitting}
            >
              ← 이전
            </button>
          )}

          <div className={styles.stepText}>
            {currentStep} / 5 단계
          </div>

          <div className={styles.footerRight}>
            {/* 관리자: 스텝 건너뛰기 버튼 */}
            {isAdminMode && isAdmin && currentStep < 5 && (
              <button
                type="button"
                onClick={handleSkipStep}
                className={styles.skipButton}
                disabled={isSubmitting}
              >
                건너뛰기
              </button>
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className={styles.nextButton}
                disabled={isSubmitting}
              >
                다음 →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className={styles.submitButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? "처리 중..." : "완료하고 대시보드 보기"}
              </button>
            )}
          </div>
        </div>
      </footer>
      </>
      )}
    </div>
  );
}

export default OnboardingPage;
