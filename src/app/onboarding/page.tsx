"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Check } from "lucide-react";
import type { OnboardingData, AssetCategory } from "@/types";
import { ProgressiveForm, type SectionId, GuideInput } from "./components";
import { rows, type RowId } from "./components/ProgressiveForm/types";
import styles from "./onboarding.module.css";

// 진행률 계산 함수 (나중에 진행률 바에 사용 예정)
// function calculateProgress(data: OnboardingData): {
//   steps: Array<{ id: string; label: string; done: boolean }>;
//   percent: number;
// } {
//   const hasValidItem = (
//     items: Array<{ name: string; amount: number | null }>
//   ) => items.some((i) => i.name && i.name.trim() !== "" && i.amount !== null);
//
//   const steps = [
//     { id: "name", label: "이름", done: !!data.name.trim() },
//     { id: "birth_date", label: "생년월일", done: !!data.birth_date },
//     {
//       id: "spouse",
//       label: "배우자",
//       done:
//         data.isMarried === false ||
//         (data.isMarried === true && !!data.spouse?.birth_date),
//     },
//     { id: "income", label: "수입", done: hasValidItem(data.incomes) },
//     { id: "expense", label: "지출", done: hasValidItem(data.expenses) },
//     { id: "realEstate", label: "부동산", done: hasValidItem(data.realEstates) },
//     { id: "asset", label: "금융자산", done: hasValidItem(data.assets) },
//     { id: "debt", label: "부채", done: hasValidItem(data.debts) },
//     { id: "pension", label: "연금", done: hasValidItem(data.pensions) },
//     { id: "retirement_age", label: "목표", done: false },
//   ];
//
//   // 필수 항목만으로 퍼센트 계산
//   const requiredSteps = steps.filter((s) =>
//     ["name", "birth_date", "income", "expense"].includes(s.id)
//   );
//   const completed = requiredSteps.filter((s) => s.done).length;
//   const percent = Math.round((completed / requiredSteps.length) * 100);
//
//   return { steps, percent };
// }




const initialData: OnboardingData = {
  name: "",
  birth_date: "",
  target_retirement_age: 0,
  target_retirement_fund: 0,
  isMarried: null,
  spouse: null,
  hasChildren: null,
  children: [],
  parents: [],
  // 소득: 근로소득, 사업소득
  laborIncome: null,
  laborIncomeFrequency: 'monthly',
  spouseLaborIncome: null,
  spouseLaborIncomeFrequency: 'monthly',
  businessIncome: null,
  businessIncomeFrequency: 'monthly',
  spouseBusinessIncome: null,
  spouseBusinessIncomeFrequency: 'monthly',
  // 지출
  livingExpenses: null,
  livingExpensesFrequency: 'monthly',
  // 거주용 부동산
  housingType: null,
  housingValue: null,
  housingRent: null,
  housingHasLoan: false,
  housingLoan: null,
  housingLoanRate: null,
  housingLoanMaturity: null,
  housingLoanType: null,
  // 금융자산 - 현금성 자산
  cashCheckingAccount: null,
  cashCheckingRate: null,
  cashSavingsAccount: null,
  cashSavingsRate: null,
  // 금융자산 - 투자자산
  investDomesticStock: null,
  investDomesticRate: null,
  investForeignStock: null,
  investForeignRate: null,
  investFund: null,
  investFundRate: null,
  investOther: null,
  investOtherRate: null,
  incomes: [],
  expenses: [],
  realEstates: [],
  assets: [],
  debts: [],
  hasNoDebt: null,
  // 연금
  nationalPension: null,
  nationalPensionStartAge: null,
  retirementPensionType: null,
  retirementPensionBalance: null,
  personalPensionMonthly: null,
  personalPensionBalance: null,
  otherPensionMonthly: null,
  hasNoPension: null,
  pensions: [],
};

const sampleData: OnboardingData = {
  name: "김민수",
  birth_date: "1983-05-15",
  target_retirement_age: 55,
  target_retirement_fund: 1500000000,
  isMarried: true,
  spouse: {
    relationship: "spouse",
    name: "이영희",
    birth_date: "1985-08-22",
    is_working: true,
    retirement_age: 55,
    monthly_income: 5000000,
  },
  hasChildren: true,
  children: [
    {
      relationship: "child",
      name: "김서준",
      birth_date: "2012-03-10",
      gender: "male",
    },
    {
      relationship: "child",
      name: "김서윤",
      birth_date: "2015-11-25",
      gender: "female",
    },
  ],
  parents: [],
  // 소득 샘플
  laborIncome: 8500000,         // 본인 근로소득 850만원/월
  laborIncomeFrequency: 'monthly',
  spouseLaborIncome: 5000000,   // 배우자 근로소득 500만원/월
  spouseLaborIncomeFrequency: 'monthly',
  businessIncome: null,         // 본인 사업소득
  businessIncomeFrequency: 'monthly',
  spouseBusinessIncome: null,   // 배우자 사업소득
  spouseBusinessIncomeFrequency: 'monthly',
  // 지출 샘플 (월 450만원)
  livingExpenses: 4500000,
  livingExpensesFrequency: 'monthly',
  // 거주용 부동산 샘플
  housingType: '자가',
  housingValue: 900000000,  // 9억
  housingRent: null,
  housingHasLoan: true,
  housingLoan: 400000000,   // 4억 대출
  housingLoanRate: 3.5,     // 금리 3.5%
  housingLoanMaturity: '2045-06',  // 만기 2045년 6월
  housingLoanType: '원리금균등상환',
  // 금융자산 - 현금성 자산 샘플
  cashCheckingAccount: 30000000,  // 입출금통장 3천만원
  cashCheckingRate: 0.1,          // 0.1%
  cashSavingsAccount: 100000000,  // 정기예금 1억
  cashSavingsRate: 3.5,           // 3.5%
  // 금융자산 - 투자자산 샘플
  investDomesticStock: 50000000,  // 국내주식 5천만원
  investDomesticRate: null,
  investForeignStock: 30000000,   // 해외주식 3천만원
  investForeignRate: null,
  investFund: 20000000,           // 펀드 2천만원
  investFundRate: null,
  investOther: null,
  investOtherRate: null,
  // 부채 샘플
  debts: [
    {
      name: '신용대출',
      amount: 50000000,  // 5천만원
      rate: 5.5,
      maturity: '2027-12',
      repaymentType: '원리금균등상환',
    },
  ],
  hasNoDebt: false,
  incomes: [],
  expenses: [],
  realEstates: [],
  assets: [],
  // 연금 샘플
  nationalPension: 1800000,          // 예상 월 180만원
  nationalPensionStartAge: 65,       // 65세부터 수령
  retirementPensionType: 'DC',       // DC형
  retirementPensionBalance: 80000000, // 현재 8천만원
  personalPensionMonthly: 500000,    // 월 50만원 납입
  personalPensionBalance: 30000000,  // 현재 3천만원
  otherPensionMonthly: null,         // 기타연금 없음
  hasNoPension: false,
  pensions: [],
};

const greetingMessages = [
  "안녕하세요?",
  "편안한 노후를 꿈꾸시나요?",
  "지금 시작하면 늦지 않아요.",
  "당신의 은퇴를 함께 준비할게요.",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [activeSection, setActiveSection] = useState<SectionId>("basic");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [showContent, setShowContent] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // 자동 저장 상태
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // 현재 스텝의 rowId
  const currentRowId = stepIndex < rows.length ? rows[stepIndex].id : null;
  const currentRow = stepIndex < rows.length ? rows[stepIndex] : null;
  const isCurrentRowComplete = currentRow ? currentRow.isComplete(data) : false;
  const isLastStep = stepIndex === rows.length - 1;

  // 이전/다음 핸들러
  const handlePrevStep = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  }, [stepIndex]);

  const handleNextStep = useCallback(() => {
    if (stepIndex < rows.length - 1 && isCurrentRowComplete) {
      setStepIndex(stepIndex + 1);
    }
  }, [stepIndex, isCurrentRowComplete]);

  // 페이지 로드 시 임시 저장 데이터 복원
  useEffect(() => {
    const loadDraftData = async () => {
      const supabase = createClient();

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Supabase에서 draft_data 가져오기
        const { data: profile } = await supabase
          .from("profiles")
          .select("draft_data")
          .eq("id", user.id)
          .single();

        if (profile?.draft_data) {
          const draftData = profile.draft_data as OnboardingData;
          setData(draftData);
          lastSavedDataRef.current = JSON.stringify(draftData);
          setStarted(true); // 임시 저장 데이터가 있으면 바로 폼으로
        } else {
          // localStorage 백업 확인
          const localDraft = localStorage.getItem(
            `onboarding_draft_${user.id}`
          );
          if (localDraft) {
            try {
              const parsedData = JSON.parse(localDraft) as OnboardingData;
              setData(parsedData);
              lastSavedDataRef.current = localDraft;
              setStarted(true);
            } catch {
              // 파싱 실패시 무시
            }
          }
        }
      } catch {
        // 에러 시 기본 상태로
      } finally {
        setIsLoading(false);
      }
    };

    loadDraftData();
  }, []);

  // 타이핑 효과
  useEffect(() => {
    if (started) return;

    const currentMessage = greetingMessages[currentMessageIndex];
    let charIndex = 0;

    const typeTimer = setInterval(() => {
      if (charIndex <= currentMessage.length) {
        setCurrentText(currentMessage.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(typeTimer);

        // 다음 메시지로 이동 또는 콘텐츠 표시
        setTimeout(() => {
          if (currentMessageIndex < greetingMessages.length - 1) {
            setCurrentMessageIndex((prev) => prev + 1);
            setCurrentText("");
          } else {
            setShowContent(true);
          }
        }, 800);
      }
    }, 80);

    return () => clearInterval(typeTimer);
  }, [started, currentMessageIndex]);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  // 임시 저장 함수
  const autoSave = useCallback(async (dataToSave: OnboardingData) => {
    // 이름이 없으면 저장하지 않음
    if (!dataToSave.name.trim()) return;

    const currentDataStr = JSON.stringify(dataToSave);
    // 이전 저장과 동일하면 스킵
    if (currentDataStr === lastSavedDataRef.current) return;

    setAutoSaveStatus("saving");
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAutoSaveStatus("idle");
        return;
      }

      // 임시 저장 데이터를 localStorage에 저장 (오프라인 대비)
      localStorage.setItem(`onboarding_draft_${user.id}`, currentDataStr);

      // 전체 데이터를 draft_data에 저장
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        name: dataToSave.name,
        birth_date: dataToSave.birth_date || null,
        target_retirement_age: dataToSave.target_retirement_age,
        target_retirement_fund: dataToSave.target_retirement_fund,
        draft_data: dataToSave,
        updated_at: new Date().toISOString(),
      });

      if (profileError) throw profileError;

      lastSavedDataRef.current = currentDataStr;
      setAutoSaveStatus("saved");
      // 저장됨 상태 유지 (사라지지 않음)
    } catch {
      setAutoSaveStatus("error");
      // 에러는 3초 후 사라짐
      setTimeout(() => setAutoSaveStatus("idle"), 3000);
    }
  }, []);

  // 데이터 변경 시 자동 저장 (2초 디바운스)
  useEffect(() => {
    if (!started) return;

    // 이전 타이머 취소
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // 2초 후 자동 저장
    autoSaveTimerRef.current = setTimeout(() => {
      autoSave(data);
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [data, started, autoSave]);

  // 데이터 저장
  const saveData = async (dataToSave: OnboardingData) => {
    setSaving(true);
    setError(null);

    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("로그인이 필요합니다");
        setSaving(false);
        return false;
      }

      // 프로필 저장
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        name: dataToSave.name,
        birth_date: dataToSave.birth_date || null,
        target_retirement_age: dataToSave.target_retirement_age,
        target_retirement_fund: dataToSave.target_retirement_fund,
        updated_at: new Date().toISOString(),
      });

      if (profileError) throw profileError;

      // 기존 가족 구성원 삭제 후 새로 저장
      await supabase.from("family_members").delete().eq("user_id", user.id);

      const familyMembers: Array<{
        user_id: string;
        relationship: string;
        name: string;
        birth_date: string | null;
        gender: string | null;
        is_dependent: boolean;
        is_working: boolean;
        retirement_age: number | null;
        monthly_income: number;
      }> = [];

      if (dataToSave.isMarried && dataToSave.spouse && dataToSave.spouse.name) {
        familyMembers.push({
          user_id: user.id,
          relationship: "spouse",
          name: dataToSave.spouse.name,
          birth_date: dataToSave.spouse.birth_date || null,
          gender: null,
          is_dependent: false,
          is_working: dataToSave.spouse.is_working ?? false,
          retirement_age: dataToSave.spouse.retirement_age ?? null,
          monthly_income: dataToSave.spouse.monthly_income ?? 0,
        });
      }

      dataToSave.children
        .filter((c) => c.name)
        .forEach((child) => {
          familyMembers.push({
            user_id: user.id,
            relationship: "child",
            name: child.name,
            birth_date: child.birth_date || null,
            gender: child.gender || null,
            is_dependent: false,
            is_working: false,
            retirement_age: null,
            monthly_income: 0,
          });
        });

      if (familyMembers.length > 0) {
        const { error: familyError } = await supabase
          .from("family_members")
          .insert(familyMembers);
        if (familyError) throw familyError;
      }

      // 자산 저장
      await supabase.from("assets").delete().eq("user_id", user.id);

      const assetsToInsert = [
        ...dataToSave.incomes
          .filter((i) => i.name && i.amount)
          .map((i) => ({
            ...i,
            category: "income" as AssetCategory,
            user_id: user.id,
          })),
        ...dataToSave.expenses
          .filter((i) => i.name && i.amount)
          .map((i) => ({
            ...i,
            category: "expense" as AssetCategory,
            user_id: user.id,
          })),
        ...dataToSave.realEstates
          .filter((i) => i.name && i.amount)
          .map((i) => ({
            ...i,
            category: "real_estate" as AssetCategory,
            user_id: user.id,
          })),
        ...dataToSave.assets
          .filter((i) => i.name && i.amount)
          .map((i) => ({
            ...i,
            category: "asset" as AssetCategory,
            user_id: user.id,
          })),
        ...dataToSave.debts
          .filter((i) => i.name && i.amount)
          .map((i) => ({
            ...i,
            category: "debt" as AssetCategory,
            user_id: user.id,
          })),
        ...dataToSave.pensions
          .filter((i) => i.name && i.amount)
          .map((i) => ({
            ...i,
            category: "pension" as AssetCategory,
            user_id: user.id,
          })),
      ];

      if (assetsToInsert.length > 0) {
        const { error: assetsError } = await supabase
          .from("assets")
          .insert(assetsToInsert);
        if (assetsError) throw assetsError;
      }

      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "저장 중 오류가 발생했습니다"
      );
      setSaving(false);
      return false;
    }
  };

  const handleSubmit = async () => {
    const success = await saveData(data);
    if (success) {
      router.push("/dashboard");
      router.refresh();
    }
  };

  const handleSandbox = async () => {
    const success = await saveData(sampleData);
    if (success) {
      router.push("/dashboard");
      router.refresh();
    }
  };

  // 로딩 중
  if (isLoading) {
    return (
      <div className={styles.welcomePage}>
        <div className={styles.welcomeContent}>
          <Loader2 size={32} className={styles.spinner} />
        </div>
      </div>
    );
  }

  // 시작 전 화면
  if (!started) {
    return (
      <div className={styles.welcomePage}>
        <div className={styles.welcomeContent}>
          {!showContent && (
            <div className={styles.welcomeGreetingWrapper}>
              <h2 className={styles.welcomeGreeting}>
                {currentText}
                <span className={styles.welcomeCursor}>|</span>
              </h2>
              <div className={styles.welcomeProgress}>
                {greetingMessages.map((_, index) => {
                  const isCompleted = index < currentMessageIndex;
                  const isCurrent = index === currentMessageIndex;
                  const progress = isCurrent
                    ? currentText.length / greetingMessages[index].length
                    : 0;

                  // 색상 보간: #E7E5E4 (회색) -> #D97706 (주황)
                  const r = Math.round(231 + (217 - 231) * progress);
                  const g = Math.round(229 + (119 - 229) * progress);
                  const b = Math.round(228 + (6 - 228) * progress);
                  const scale = 1 + progress * 0.3;

                  return (
                    <span
                      key={index}
                      className={`${styles.welcomeProgressDot} ${
                        isCompleted ? styles.welcomeProgressDotActive : ""
                      }`}
                      style={
                        isCurrent
                          ? {
                              backgroundColor: `rgb(${r}, ${g}, ${b})`,
                              transform: `scale(${scale})`,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          {showContent && (
            <>
              <div className={styles.welcomeBadge}>은퇴 진단 시뮬레이션</div>
              <h1 className={styles.welcomeTitle}>이제 시작해볼까요?</h1>
              <p className={styles.welcomeSubtitle}>
                3분이면 충분해요.
                <br />
                간단한 정보만 입력하면 은퇴 준비 상태를 진단해드려요.
              </p>

              <div className={styles.welcomeActions}>
                <button
                  className={styles.welcomeStartButton}
                  onClick={() => setStarted(true)}
                >
                  무료로 진단받기
                </button>
                <button
                  className={styles.welcomeSandboxButton}
                  onClick={handleSandbox}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 size={16} className={styles.spinner} />
                  ) : null}
                  샘플로 먼저 체험하기
                </button>
              </div>

              <p className={styles.welcomeNote}>
                입력하신 정보는 안전하게 보호됩니다
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // 프로그레시브 폼 화면
  return (
    <div className={styles.spreadsheetPage}>
      <header className={styles.spreadsheetPageHeader}>
        <div className={styles.spreadsheetPageLogo}>
          <span>Lycon</span>
          <span className={styles.logoSeparator}>|</span>
          <span className={styles.logoSubtitle}>현재 재무 정리</span>
        </div>
        <div className={styles.headerActions}>
          <span
            className={`${styles.autoSaveStatus} ${
              autoSaveStatus === "idle" ? styles.autoSaveStatusIdle : ""
            } ${
              autoSaveStatus !== "idle"
                ? styles[
                    `autoSaveStatus${
                      autoSaveStatus.charAt(0).toUpperCase() +
                      autoSaveStatus.slice(1)
                    }`
                  ]
                : ""
            }`}
          >
            {autoSaveStatus === "saving" && (
              <>
                <Loader2 size={14} className={styles.spinner} />
                저장 중...
              </>
            )}
            {autoSaveStatus === "saved" && (
              <>
                <Check size={14} />
                임시 저장됨
              </>
            )}
            {autoSaveStatus === "error" && "저장 실패"}
            {autoSaveStatus === "idle" && (
              <span style={{ visibility: "hidden" }}>임시 저장됨</span>
            )}
          </span>
          <button
            className={styles.spreadsheetSubmitButton}
            onClick={handleSubmit}
            disabled={saving || !data.name || !data.birth_date}
          >
            {saving ? (
              <>
                <Loader2 size={16} className={styles.spinner} />
                저장 중...
              </>
            ) : (
              "완료"
            )}
          </button>
        </div>
      </header>

      <div className={styles.spreadsheetPageContent}>
        {/* 왼쪽: 가이드 입력 영역 */}
        <div className={styles.guidePanel}>
          <GuideInput
            data={data}
            onUpdateData={updateData}
            currentRowId={currentRowId as RowId | null}
            onPrev={handlePrevStep}
            onNext={handleNextStep}
            canGoPrev={stepIndex > 0}
            canGoNext={isCurrentRowComplete}
            onComplete={handleSubmit}
            isLastStep={isLastStep}
          />
        </div>

        {/* 오른쪽: 스프레드시트 (동기화) */}
        <div className={styles.spreadsheetPanel}>
          {error && <div className={styles.errorBox}>{error}</div>}

          <ProgressiveForm
            data={data}
            onUpdateData={updateData}
            onComplete={handleSubmit}
            isCompleteDisabled={saving || !data.name || !data.birth_date}
            isSaving={saving}
            currentStepIndex={stepIndex}
            onActiveRowChange={(rowId) => {
              const rowToSection: Record<string, SectionId> = {
                name: "basic",
                birth_date: "basic",
                children: "basic",
                retirement_age: "basic",
                retirement_fund: "basic",
                labor_income: "income",
                business_income: "income",
                living_expenses: "expense",
                realEstate: "realEstate",
                asset: "asset",
                debt: "debt",
                national_pension: "pension",
                retirement_pension: "pension",
                personal_pension: "pension",
                other_pension: "pension",
              };
              const section = rowToSection[rowId];
              if (section) setActiveSection(section);
            }}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        </div>
      </div>
    </div>
  );
}
