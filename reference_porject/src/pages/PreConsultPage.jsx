import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { profileService } from "../services/firestoreService";
import { trackPageView, trackEvent } from "../libs/mixpanel";
import PreConsultNav from "../components/preconsult/PreConsultNav";
import Step1IceBreaking from "../components/preconsult/Step1IceBreaking";
import Step2Goals from "../components/preconsult/Step2Goals";
import Step3Pension from "../components/preconsult/Step3Pension";
import Step4Financial from "../components/preconsult/Step4Financial";
import Step5Preview from "../components/preconsult/Step5Preview";
import styles from "./PreConsultPage.module.css";

/**
 * 사전 상담 페이지
 * 본 상담(시뮬레이션) 전에 필요한 정보를 단계별로 수집합니다.
 * 
 * 5단계 구성:
 * 1. Ice Breaking - 환영 및 상담 취지 파악
 * 2. 목표 점검 - 은퇴 목표 및 투자성향
 * 3. 3층 연금 - 국민연금, 퇴직연금, 개인연금
 * 4. 재무정보 - 소득, 지출, 자산, 부채
 * 5. 시뮬레이션 미리보기 - 본 상담 프로세스 소개
 */
function PreConsultPage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  
  // 사전 상담 데이터 기본 구조
  const defaultPreConsultData = {
    step: 1,
    step1_iceBreaking: {
      motivation: "",
      notes: "",
      completed: false,
    },
    step2_goals: {
      lifestyle: "",
      targetMonthlyIncome: null,
      retirementAge: null,
      spouseRetirementAge: null,
      investmentType: "",
      notes: "",
      completed: false,
    },
    step3_pension: {
      nationalPension: {
        self: { amount: null, startAge: 65 },
        spouse: { amount: null, startAge: 65 },
      },
      retirement: {
        current: null,
        annualContribution: null,
      },
      private: {
        hasPrivatePension: false,
        totalAmount: null,
        monthlyPayment: null,
      },
      notes: "",
      completed: false,
    },
    step4_financial: {
      incomeCompleted: false,
      expenseCompleted: false,
      assetsCompleted: false,
      debtsCompleted: false,
      notes: "",
      completed: false,
    },
    step5_preview: {
      sampleProfileViewed: "",
      notes: "",
      completed: false,
    },
    overallNotes: "",
  };

  const [preConsultData, setPreConsultData] = useState(defaultPreConsultData);

  // Mixpanel: 페이지 진입 트래킹
  useEffect(() => {
    if (!loading && profileData) {
      const currentYear = new Date().getFullYear();
      const currentAge = currentYear - profileData.birthYear;

      trackPageView("사전 상담 페이지", {
        profileId,
        profileName: profileData.name,
        birthYear: profileData.birthYear,
        currentAge: currentAge,
        retirementAge: profileData.retirementAge,
        profileStatus: profileData.status || "unknown",
        currentStep,
        totalSteps: 5,
        stepProgress: `${currentStep}/5`,
      });
    }
  }, [loading, profileData, profileId, currentStep]);

  // 프로필 및 사전상담 데이터 로드
  useEffect(() => {
    loadData();
  }, [profileId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const profile = await profileService.getProfile(profileId);
      
      if (!profile) {
        alert("프로필을 찾을 수 없습니다.");
        navigate("/consult");
        return;
      }

      setProfileData(profile);
      
      // 기존 사전상담 데이터가 있으면 로드, 없으면 기본값 사용
      if (profile.preConsultation) {
        setPreConsultData(profile.preConsultation);
        setCurrentStep(profile.preConsultation.step || 1);
      } else {
        setPreConsultData(defaultPreConsultData);
      }
    } catch (error) {
      console.error("프로필 로드 오류:", error);
      trackEvent("오류 발생", {
        page: "사전 상담",
        error: error.message,
        action: "프로필 로드",
      });
      alert("프로필을 불러오는 중 오류가 발생했습니다.");
      navigate("/consult");
    } finally {
      setLoading(false);
    }
  };

  // 데이터 저장 (디바운스 적용)
  const saveData = useCallback(async (dataToSave = null, showNotification = true) => {
    try {
      setIsSaving(true);
      const savePayload = dataToSave || preConsultData;
      
      await profileService.updateProfile(profileId, {
        preConsultation: savePayload,
      });

      setLastSaved(new Date());
      
      if (showNotification) {
        trackEvent("사전 상담 데이터 저장", {
          profileId,
          step: currentStep,
        });
      }
    } catch (error) {
      console.error("저장 오류:", error);
      trackEvent("오류 발생", {
        page: "사전 상담",
        error: error.message,
        action: "데이터 저장",
      });
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }, [profileId, preConsultData, currentStep]);

  // 단계 변경 핸들러
  const handleStepChange = async (newStep) => {
    // 현재 데이터 저장 후 단계 이동
    const updatedData = {
      ...preConsultData,
      step: newStep,
    };
    
    setPreConsultData(updatedData);
    await saveData(updatedData, false);
    setCurrentStep(newStep);
    
    trackEvent("사전 상담 단계 이동", {
      profileId,
      from: currentStep,
      to: newStep,
    });
  };

  // 단계별 데이터 업데이트
  const updateStepData = (stepKey, data) => {
    setPreConsultData((prev) => ({
      ...prev,
      [stepKey]: data,
    }));
  };

  // 이전 단계
  const handlePrev = () => {
    if (currentStep > 1) {
      handleStepChange(currentStep - 1);
    }
  };

  // 다음 단계
  const handleNext = () => {
    if (currentStep < 5) {
      handleStepChange(currentStep + 1);
    }
  };

  // 본 상담 시작 (대시보드로 이동)
  const handleStartMainConsult = () => {
    trackEvent("본 상담 시작", {
      profileId,
      profileName: profileData.name,
    });
    navigate(`/consult/dashboard/${profileId}`);
  };

  // 자동 저장 (3초 디바운스)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading && preConsultData) {
        saveData(null, false);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [preConsultData, loading]);

  // 로딩 상태
  if (authLoading || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>로딩 중...</div>
      </div>
    );
  }

  // 권한 체크 (관리자만 접근 가능)
  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>접근 권한이 없습니다</h2>
          <p>사전 상담 페이지는 관리자만 접근할 수 있습니다.</p>
          <button onClick={() => navigate("/login")}>로그인하기</button>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>프로필을 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 상단 헤더 */}
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => navigate(`/consult/dashboard/${profileId}`)}
          title="대시보드로 돌아가기"
        >
          ← 대시보드로
        </button>
        
        <div className={styles.headerCenter}>
          <h1 className={styles.title}>{profileData.name}님 사전 상담</h1>
          {lastSaved && (
            <span className={styles.saveStatus}>
              {isSaving ? "저장 중..." : `마지막 저장: ${lastSaved.toLocaleTimeString()}`}
            </span>
          )}
        </div>

        <button
          className={styles.saveButton}
          onClick={() => saveData(null, true)}
          disabled={isSaving}
        >
          {isSaving ? "저장 중..." : "저장"}
        </button>
      </header>

      {/* 메인 콘텐츠 */}
      <div className={styles.content}>
        {/* 좌측 네비게이션 */}
        <PreConsultNav
          currentStep={currentStep}
          onStepChange={handleStepChange}
          progress={preConsultData}
        />

        {/* 우측 메인 영역 */}
        <main className={styles.main}>
          {currentStep === 1 && (
            <Step1IceBreaking
              data={preConsultData.step1_iceBreaking}
              onChange={(data) => updateStepData("step1_iceBreaking", data)}
              profileData={profileData}
            />
          )}
          {currentStep === 2 && (
            <Step2Goals
              data={preConsultData.step2_goals}
              onChange={(data) => updateStepData("step2_goals", data)}
              profileData={profileData}
            />
          )}
          {currentStep === 3 && (
            <Step3Pension
              data={preConsultData.step3_pension}
              onChange={(data) => updateStepData("step3_pension", data)}
              profileData={profileData}
            />
          )}
          {currentStep === 4 && (
            <Step4Financial
              data={preConsultData.step4_financial}
              onChange={(data) => updateStepData("step4_financial", data)}
              profileId={profileId}
              profileData={profileData}
            />
          )}
          {currentStep === 5 && (
            <Step5Preview
              data={preConsultData.step5_preview}
              onChange={(data) => updateStepData("step5_preview", data)}
              profileData={profileData}
            />
          )}
        </main>
      </div>

      {/* 하단 네비게이션 */}
      <footer className={styles.footer}>
        <div className={styles.footerButtons}>
          {currentStep > 1 && (
            <button className={styles.prevButton} onClick={handlePrev}>
              ← 이전 단계
            </button>
          )}
          
          <div className={styles.stepIndicator}>
            {currentStep} / 5 단계
          </div>

          {currentStep < 5 ? (
            <button className={styles.nextButton} onClick={handleNext}>
              다음 단계 →
            </button>
          ) : (
            <button
              className={styles.startButton}
              onClick={handleStartMainConsult}
            >
              본 상담 시작 →
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default PreConsultPage;

