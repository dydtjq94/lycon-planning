"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Check } from "lucide-react";
import type { OnboardingData, AssetCategory } from "@/types";
import { ProgressiveForm, type SectionId } from "./components";
import { getRowTip, getDynamicTip } from "./tips";
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
  // 고정 지출
  fixedExpenseName: '',
  fixedExpenses: null,
  fixedExpensesFrequency: 'monthly',
  additionalFixedExpenses: [],
  // 변동 지출
  variableExpenseName: '',
  variableExpenses: null,
  variableExpensesFrequency: 'monthly',
  additionalVariableExpenses: [],
  incomes: [],
  expenses: [],
  realEstates: [],
  assets: [],
  debts: [],
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
  // 고정 지출 샘플
  fixedExpenseName: '주거비',
  fixedExpenses: 1500000,       // 150만원/월
  fixedExpensesFrequency: 'monthly',
  additionalFixedExpenses: [
    { name: '보험료', amount: 500000, frequency: 'monthly' },
    { name: '교육비', amount: 1000000, frequency: 'monthly' },
    { name: '구독 서비스', amount: 50000, frequency: 'monthly' },
    { name: '용돈', amount: 300000, frequency: 'monthly' },
    { name: '기타 고정 지출', amount: null, frequency: 'monthly' },
  ],
  // 변동 지출 샘플
  variableExpenseName: '생활·식비',
  variableExpenses: 1200000,    // 120만원/월
  variableExpensesFrequency: 'monthly',
  additionalVariableExpenses: [
    { name: '패션·개인관리비', amount: 300000, frequency: 'monthly' },
    { name: '교통비', amount: 400000, frequency: 'monthly' },
    { name: '교육·자기계발비', amount: 200000, frequency: 'monthly' },
    { name: '건강·여가비', amount: 500000, frequency: 'monthly' },
    { name: '기타 변동 지출', amount: null, frequency: 'monthly' },
  ],
  incomes: [],
  expenses: [],
  realEstates: [],
  assets: [
    { name: "예금", amount: 150000000, frequency: "once" },
    { name: "주식/ETF", amount: 80000000, frequency: "once" },
  ],
  debts: [{ name: "주택담보대출", amount: 400000000, frequency: "once" }],
  pensions: [
    { name: "국민연금 (예상)", amount: 1800000, frequency: "monthly" },
  ],
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
  const [activeRow, setActiveRow] = useState<string>("name");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [showContent, setShowContent] = useState(false);

  // 자동 저장 상태
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>("");
  const [isLoading, setIsLoading] = useState(true);

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

  // 지출 키워드 (소득/지출 섹션에서 구분용)
  const expenseKeywords = [
    "주거비",
    "보험료",
    "교육비",
    "구독",
    "용돈",
    "생활",
    "식비",
    "교통비",
    "건강",
    "여가",
    "지출",
  ];

  // 제안 항목 클릭시 추가/제거 토글
  const handleToggleSuggestion = (name: string) => {
    // 소득/지출 섹션의 새로운 구조 처리
    if (activeSection === "income") {
      // 고정 지출 또는 변동 지출 행인지 확인
      if (activeRow === "fixed_expenses") {
        // 고정 지출에 추가
        const items = data.additionalFixedExpenses || [];

        // 이미 메인 항목명에 있는지 확인
        if (data.fixedExpenseName === name) {
          // 메인 항목명 제거
          setData((prev) => ({
            ...prev,
            fixedExpenseName: "",
          }));
          return;
        }

        // 추가 항목에 있는지 확인
        const existingIndex = items.findIndex((item) => item.name === name);
        if (existingIndex >= 0) {
          // 이미 있으면 제거
          setData((prev) => ({
            ...prev,
            additionalFixedExpenses: items.filter((_, i) => i !== existingIndex),
          }));
        } else {
          // 없으면 추가 - 메인 항목명이 비어있으면 거기에 먼저 추가
          if (!data.fixedExpenseName) {
            setData((prev) => ({
              ...prev,
              fixedExpenseName: name,
            }));
          } else {
            setData((prev) => ({
              ...prev,
              additionalFixedExpenses: [...items, { name, amount: null, frequency: 'monthly' as const }],
            }));
          }
        }
        return;
      }

      if (activeRow === "variable_expenses") {
        // 변동 지출에 추가
        const items = data.additionalVariableExpenses || [];

        // 이미 메인 항목명에 있는지 확인
        if (data.variableExpenseName === name) {
          // 메인 항목명 제거
          setData((prev) => ({
            ...prev,
            variableExpenseName: "",
          }));
          return;
        }

        // 추가 항목에 있는지 확인
        const existingIndex = items.findIndex((item) => item.name === name);
        if (existingIndex >= 0) {
          // 이미 있으면 제거
          setData((prev) => ({
            ...prev,
            additionalVariableExpenses: items.filter((_, i) => i !== existingIndex),
          }));
        } else {
          // 없으면 추가 - 메인 항목명이 비어있으면 거기에 먼저 추가
          if (!data.variableExpenseName) {
            setData((prev) => ({
              ...prev,
              variableExpenseName: name,
            }));
          } else {
            setData((prev) => ({
              ...prev,
              additionalVariableExpenses: [...items, { name, amount: null, frequency: 'monthly' as const }],
            }));
          }
        }
        return;
      }

      // 그 외 소득 섹션 (기존 로직 - 소득/지출 배열 사용)
      const isExpense = expenseKeywords.some((k) => name.includes(k));
      const key = isExpense ? "expenses" : "incomes";
      const items = data[key] as Array<{
        name: string;
        amount: number | null;
        frequency: "monthly" | "yearly" | "once";
      }>;

      const existingIndex = items.findIndex((item) => item.name === name);

      if (existingIndex >= 0) {
        const newItems = items.filter((_, index) => index !== existingIndex);
        if (newItems.length === 0) {
          newItems.push({ name: "", amount: null, frequency: "monthly" });
        }
        setData((prev) => ({ ...prev, [key]: newItems }));
      } else {
        const emptyIndex = items.findIndex(
          (item) => !item.name && item.amount === null
        );
        if (emptyIndex >= 0) {
          const newItems = [...items];
          newItems[emptyIndex] = { ...newItems[emptyIndex], name };
          setData((prev) => ({ ...prev, [key]: newItems }));
        } else {
          setData((prev) => ({
            ...prev,
            [key]: [...items, { name, amount: null, frequency: "monthly" }],
          }));
        }
      }
      return;
    }

    // 다른 섹션들 (기존 로직)
    const keyMap: Record<SectionId, keyof OnboardingData | null> = {
      basic: null,
      income: "incomes",
      savings: null,
      realEstate: "realEstates",
      asset: "assets",
      debt: "debts",
      pension: "pensions",
    };
    const key = keyMap[activeSection];

    if (!key) return;

    const items = data[key] as Array<{
      name: string;
      amount: number | null;
      frequency: "monthly" | "yearly" | "once";
    }>;

    const existingIndex = items.findIndex((item) => item.name === name);

    if (existingIndex >= 0) {
      const newItems = items.filter((_, index) => index !== existingIndex);
      if (newItems.length === 0) {
        newItems.push({ name: "", amount: null, frequency: "monthly" });
      }
      setData((prev) => ({ ...prev, [key]: newItems }));
    } else {
      const emptyIndex = items.findIndex(
        (item) => !item.name && item.amount === null
      );
      if (emptyIndex >= 0) {
        const newItems = [...items];
        newItems[emptyIndex] = { ...newItems[emptyIndex], name };
        setData((prev) => ({ ...prev, [key]: newItems }));
      } else {
        setData((prev) => ({
          ...prev,
          [key]: [...items, { name, amount: null, frequency: "monthly" }],
        }));
      }
    }
  };

  // 제안 항목이 이미 추가되었는지 확인 (새로운 구조 지원)
  const isSuggestionAdded = (name: string): boolean => {
    if (activeSection === "income") {
      if (activeRow === "fixed_expenses") {
        const items = data.additionalFixedExpenses || [];
        return items.some((item) => item.name === name) || data.fixedExpenseName === name;
      }
      if (activeRow === "variable_expenses") {
        const items = data.additionalVariableExpenses || [];
        return items.some((item) => item.name === name) || data.variableExpenseName === name;
      }
      // 기존 소득/지출 배열 확인
      const isExpense = expenseKeywords.some((k) => name.includes(k));
      const items = isExpense ? data.expenses : data.incomes;
      return items.some((item) => item.name === name);
    }

    const keyMap: Record<SectionId, keyof OnboardingData | null> = {
      basic: null,
      income: "incomes",
      savings: null,
      realEstate: "realEstates",
      asset: "assets",
      debt: "debts",
      pension: "pensions",
    };
    const key = keyMap[activeSection];
    if (!key) return false;
    const items = data[key] as Array<{ name: string }>;
    return items.some((item) => item.name === name);
  };

  // row-based TIP을 사용하는 행 ID들 (기본정보 + 소득/지출)
  const rowBasedTipIds = [
    'name', 'birth_date', 'children', 'retirement_age', 'retirement_fund',  // 기본정보
    'labor_income', 'business_income', 'fixed_expenses', 'variable_expenses',  // 소득/지출
  ];
  const currentTip = useMemo(() => {
    if (rowBasedTipIds.includes(activeRow)) {
      return getRowTip(activeRow, data);
    }
    return getDynamicTip(activeSection, data);
  }, [activeRow, activeSection, data]);
  // progress는 나중에 진행률 바에 사용할 수 있도록 유지
  // const progress = useMemo(() => calculateProgress(data), [data]);

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
        <div className={styles.spreadsheetPageMain}>
          {error && <div className={styles.errorBox}>{error}</div>}

          <ProgressiveForm
            data={data}
            onUpdateData={updateData}
            onComplete={handleSubmit}
            isCompleteDisabled={saving || !data.name || !data.birth_date}
            isSaving={saving}
            onActiveRowChange={(rowId) => {
              // 활성 행 업데이트
              setActiveRow(rowId);

              // 행 ID에 따라 섹션 자동 전환
              const rowToSection: Record<string, SectionId> = {
                name: "basic",
                birth_date: "basic",
                children: "basic",
                retirement_age: "basic",
                retirement_fund: "basic",
                labor_income: "income",
                business_income: "income",
                fixed_expenses: "income",
                variable_expenses: "income",
                savings: "savings",
                investment: "savings",
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

        <aside className={styles.spreadsheetPageAside}>
          <div className={styles.contextPanel}>
            <div
              key={`${activeRow}-${currentTip.title}`}
              className={styles.contextCard}
            >
              <span className={styles.contextLabel}>TIP</span>
              <h3 className={styles.contextTitle}>{currentTip.title}</h3>
              <p className={styles.contextDescription}>
                {currentTip.description}
              </p>
              {currentTip.guides && currentTip.guides.length > 0 && (
                <ul className={styles.contextGuides}>
                  {currentTip.guides.map((guide, index) => (
                    <li key={index}>{guide}</li>
                  ))}
                </ul>
              )}
              {currentTip.suggestionGroups &&
                currentTip.suggestionGroups.length > 0 && (
                  <div className={styles.contextSuggestions}>
                    {currentTip.suggestionGroups.map((group) => (
                      <div
                        key={group.label}
                        className={styles.contextSuggestionGroup}
                      >
                        <span className={styles.contextSuggestionsLabel}>
                          {group.label}
                        </span>
                        <div className={styles.contextSuggestionsList}>
                          {group.items.map((suggestion) => {
                            const isAdded = isSuggestionAdded(suggestion);
                            return (
                              <button
                                key={suggestion}
                                className={`${styles.contextSuggestionBtn} ${
                                  isAdded
                                    ? styles.contextSuggestionBtnAdded
                                    : ""
                                }`}
                                onClick={() =>
                                  handleToggleSuggestion(suggestion)
                                }
                              >
                                {suggestion}
                                {isAdded && " ✓"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              {currentTip.suggestions && currentTip.suggestions.length > 0 && (
                <div className={styles.contextSuggestions}>
                  <span className={styles.contextSuggestionsLabel}>
                    클릭해서 추가
                  </span>
                  <div className={styles.contextSuggestionsList}>
                    {currentTip.suggestions.map((suggestion) => {
                      const isAdded = isSuggestionAdded(suggestion);
                      return (
                        <button
                          key={suggestion}
                          className={`${styles.contextSuggestionBtn} ${
                            isAdded ? styles.contextSuggestionBtnAdded : ""
                          }`}
                          onClick={() => handleToggleSuggestion(suggestion)}
                        >
                          {suggestion}
                          {isAdded && " ✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {currentTip.insight && (
                <p className={styles.contextInsight}>{currentTip.insight}</p>
              )}
              {currentTip.stat && (
                <div className={styles.contextStat}>
                  <div className={styles.contextStatValue}>
                    {currentTip.stat}
                  </div>
                  <div className={styles.contextStatLabel}>
                    {currentTip.statLabel}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
