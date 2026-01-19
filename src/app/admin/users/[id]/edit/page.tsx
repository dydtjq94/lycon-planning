"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft } from "lucide-react";
import {
  FamilyInputForm,
  HousingInputForm,
  IncomeInputForm,
  ExpenseInputForm,
  SavingsInputForm,
  InvestmentInputForm,
  DebtInputForm,
  NationalPensionInputForm,
  RetirementPensionInputForm,
  PersonalPensionInputForm,
  type FamilyMember,
  type HousingData,
  type FinancialAssetItem,
  type DebtItem,
  type IncomeFormData,
  type ExpenseFormData,
  type NationalPensionData,
  type RetirementPensionData,
  type PersonalPensionItem,
  type InvestmentAccountData,
  type PrepData,
} from "@/components/forms";
import {
  loadPrepData,
  saveFamilyData,
  saveHousingData,
  saveSavingsData,
  saveInvestmentData,
  saveDebtData,
  saveIncomeData,
  saveNationalPensionData,
  saveRetirementPensionData,
  savePersonalPensionData,
  saveExpenseData,
} from "@/lib/services/prepDataService";
import styles from "../../../admin.module.css";

interface Profile {
  id: string;
  name: string;
}

interface Expert {
  id: string;
  name: string;
  title: string;
}

type TabType = "family" | "housing" | "income" | "expense" | "savings" | "investment" | "debt" | "nationalPension" | "retirementPension" | "personalPension";

const TABS: { id: TabType; label: string }[] = [
  { id: "family", label: "가족" },
  { id: "housing", label: "주거" },
  { id: "income", label: "소득" },
  { id: "expense", label: "지출" },
  { id: "savings", label: "저축" },
  { id: "investment", label: "투자" },
  { id: "debt", label: "부채" },
  { id: "nationalPension", label: "공적연금" },
  { id: "retirementPension", label: "퇴직연금" },
  { id: "personalPension", label: "개인연금" },
];

export default function UserEditPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [prepData, setPrepData] = useState<PrepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("family");
  const [activeForm, setActiveForm] = useState<TabType | null>(null);
  const [hasSpouse, setHasSpouse] = useState(false);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [currentExpertId, setCurrentExpertId] = useState<string | null>(null);
  const [changingExpert, setChangingExpert] = useState(false);

  // 데이터 로드
  const loadData = useCallback(async () => {
    const supabase = createClient();

    // 프로필 조회
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("id", userId)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    // 전문가 목록 조회
    const { data: expertsData } = await supabase
      .from("experts")
      .select("id, name, title")
      .eq("is_active", true)
      .order("name");

    if (expertsData) {
      setExperts(expertsData);
    }

    // 현재 담당 전문가 조회 (primary conversation)
    const { data: conversation } = await supabase
      .from("conversations")
      .select("expert_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle();

    if (conversation) {
      setCurrentExpertId(conversation.expert_id);
    }

    // 준비사항 데이터 로드
    const data = await loadPrepData(userId);
    setPrepData(data);

    // 배우자 여부 확인
    const spouse = data.family.find((m) => m.relationship === "spouse");
    setHasSpouse(!!spouse);

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 담당 전문가 변경
  const handleChangeExpert = async (newExpertId: string) => {
    if (!newExpertId || newExpertId === currentExpertId) return;

    setChangingExpert(true);
    const supabase = createClient();

    // 기존 primary conversation 찾기
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle();

    if (existingConv) {
      // 기존 conversation의 expert_id 업데이트
      await supabase
        .from("conversations")
        .update({ expert_id: newExpertId })
        .eq("id", existingConv.id);
    } else {
      // 새 conversation 생성
      await supabase.from("conversations").insert({
        user_id: userId,
        expert_id: newExpertId,
        is_primary: true,
      });
    }

    setCurrentExpertId(newExpertId);
    setChangingExpert(false);
  };

  // 저장 핸들러들
  const handleSaveFamily = async (members: FamilyMember[]) => {
    await saveFamilyData(userId, members);
    const spouse = members.find((m) => m.relationship === "spouse");
    setHasSpouse(!!spouse);
    await loadData();
    setActiveForm(null);
  };

  const handleSaveHousing = async (data: HousingData) => {
    await saveHousingData(userId, data);
    await loadData();
    setActiveForm(null);
  };

  const handleSaveIncome = async (data: IncomeFormData) => {
    await saveIncomeData(userId, data);
    await loadData();
    setActiveForm(null);
  };

  const handleSaveExpense = async (data: ExpenseFormData) => {
    await saveExpenseData(userId, data);
    await loadData();
    setActiveForm(null);
  };

  const handleSaveSavings = async (items: FinancialAssetItem[]) => {
    await saveSavingsData(userId, items);
    await loadData();
    setActiveForm(null);
  };

  const handleSaveInvestment = async (data: InvestmentAccountData) => {
    await saveInvestmentData(userId, data);
    await loadData();
    setActiveForm(null);
  };

  const handleSaveDebt = async (items: DebtItem[]) => {
    await saveDebtData(userId, items);
    await loadData();
    setActiveForm(null);
  };

  const handleSaveNationalPension = async (data: NationalPensionData) => {
    await saveNationalPensionData(userId, data);
    await loadData();
    setActiveForm(null);
  };

  const handleSaveRetirementPension = async (data: RetirementPensionData) => {
    await saveRetirementPensionData(userId, data);
    await loadData();
    setActiveForm(null);
  };

  const handleSavePersonalPension = async (items: PersonalPensionItem[]) => {
    await savePersonalPensionData(userId, items);
    await loadData();
    setActiveForm(null);
  };

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  if (!profile || !prepData) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.emptyState}>유저를 찾을 수 없습니다.</div>
      </div>
    );
  }

  // 폼 렌더링
  if (activeForm) {
    switch (activeForm) {
      case "family":
        return (
          <FamilyInputForm
            taskId="family"
            initialData={prepData.family}
            isCompleted={prepData.completed.family}
            onClose={() => setActiveForm(null)}
            onSave={handleSaveFamily}
          />
        );
      case "housing":
        return (
          <HousingInputForm
            initialData={prepData.housing}
            isCompleted={prepData.completed.housing}
            onClose={() => setActiveForm(null)}
            onSave={handleSaveHousing}
          />
        );
      case "income":
        return (
          <IncomeInputForm
            hasSpouse={hasSpouse}
            initialData={{
              selfLaborIncome: 0,
              selfLaborFrequency: "monthly",
              spouseLaborIncome: 0,
              spouseLaborFrequency: "monthly",
              additionalIncomes: [],
            }}
            isCompleted={prepData.completed.income}
            onClose={() => setActiveForm(null)}
            onSave={handleSaveIncome}
          />
        );
      case "expense":
        return (
          <ExpenseInputForm
            housingData={prepData.housing}
            debtData={prepData.debt}
            initialData={prepData.expense || {
              livingExpense: 0,
              livingExpenseDetails: {},
              fixedExpenses: [],
              variableExpenses: [],
            }}
            isCompleted={prepData.completed.expense}
            onClose={() => setActiveForm(null)}
            onSave={handleSaveExpense}
          />
        );
      case "savings":
        return (
          <SavingsInputForm
            hasSpouse={hasSpouse}
            initialData={prepData.savings}
            isCompleted={prepData.completed.savings}
            onClose={() => setActiveForm(null)}
            onSave={handleSaveSavings}
          />
        );
      case "investment":
        return (
          <InvestmentInputForm
            hasSpouse={hasSpouse}
            initialData={prepData.investment}
            isCompleted={prepData.completed.investment}
            onClose={() => setActiveForm(null)}
            onSave={handleSaveInvestment}
          />
        );
      case "debt":
        return (
          <DebtInputForm
            hasSpouse={hasSpouse}
            housingData={prepData.housing}
            initialData={prepData.debt}
            isCompleted={prepData.completed.debt}
            onClose={() => setActiveForm(null)}
            onSave={handleSaveDebt}
          />
        );
      case "nationalPension":
        return (
          <NationalPensionInputForm
            hasSpouse={hasSpouse}
            initialData={prepData.nationalPension}
            isCompleted={prepData.completed.nationalPension}
            onClose={() => setActiveForm(null)}
            onSave={handleSaveNationalPension}
          />
        );
      case "retirementPension":
        return (
          <RetirementPensionInputForm
            hasSpouse={hasSpouse}
            initialData={prepData.retirementPension}
            isCompleted={prepData.completed.retirementPension}
            onClose={() => setActiveForm(null)}
            onSave={handleSaveRetirementPension}
          />
        );
      case "personalPension":
        return (
          <PersonalPensionInputForm
            hasSpouse={hasSpouse}
            initialData={prepData.personalPension}
            isCompleted={prepData.completed.personalPension}
            onClose={() => setActiveForm(null)}
            onSave={handleSavePersonalPension}
          />
        );
    }
  }

  return (
    <div className={styles.dashboard}>
      {/* 헤더 */}
      <div className={styles.userDetailHeader}>
        <button className={styles.backButton} onClick={() => router.back()}>
          <ChevronLeft size={18} />
          뒤로
        </button>
        <h1 className={styles.userDetailTitle}>{profile.name} - 정보 편집</h1>
        <div style={{ width: 80 }} />
      </div>

      {/* 담당 전문가 */}
      <div className={styles.section} style={{ marginBottom: 16 }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>담당 전문가</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            value={currentExpertId || ""}
            onChange={(e) => handleChangeExpert(e.target.value)}
            disabled={changingExpert}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              fontSize: 14,
              minWidth: 200,
            }}
          >
            <option value="">선택하세요</option>
            {experts.map((expert) => (
              <option key={expert.id} value={expert.id}>
                {expert.name} ({expert.title})
              </option>
            ))}
          </select>
          {changingExpert && <span style={{ color: "#737373" }}>변경 중...</span>}
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabsContainer} style={{ flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {prepData.completed[tab.id] && (
              <span style={{ marginLeft: 4, color: "#16a34a" }}>V</span>
            )}
          </button>
        ))}
      </div>

      {/* 편집 버튼 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {TABS.find((t) => t.id === activeTab)?.label} 정보
          </h2>
          <button
            className={styles.actionButton}
            onClick={() => setActiveForm(activeTab)}
          >
            편집
          </button>
        </div>

        {/* 간단한 요약 표시 */}
        <div className={styles.dataGrid}>
          {activeTab === "family" && (
            <div className={styles.dataCard}>
              <div className={styles.dataCardTitle}>가족 구성원</div>
              {prepData.family.length === 0 ? (
                <p style={{ color: "#737373" }}>등록된 가족이 없습니다.</p>
              ) : (
                prepData.family.map((member, i) => (
                  <div key={i} className={styles.dataItem}>
                    <span className={styles.dataLabel}>
                      {member.relationship === "spouse" ? "배우자" : member.relationship === "child" ? "자녀" : "부모"}
                    </span>
                    <span className={styles.dataValue}>{member.name}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "housing" && (
            <div className={styles.dataCard}>
              <div className={styles.dataCardTitle}>거주 정보</div>
              {!prepData.housing ? (
                <p style={{ color: "#737373" }}>등록된 주거 정보가 없습니다.</p>
              ) : (
                <>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>거주 유형</span>
                    <span className={styles.dataValue}>{prepData.housing.housingType}</span>
                  </div>
                  {prepData.housing.hasLoan && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>대출</span>
                      <span className={styles.dataValue}>있음</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "savings" && (
            <div className={styles.dataCard}>
              <div className={styles.dataCardTitle}>저축 계좌</div>
              {prepData.savings.length === 0 ? (
                <p style={{ color: "#737373" }}>등록된 저축이 없습니다.</p>
              ) : (
                <p>{prepData.savings.length}개 계좌</p>
              )}
            </div>
          )}

          {activeTab === "debt" && (
            <div className={styles.dataCard}>
              <div className={styles.dataCardTitle}>부채</div>
              {prepData.debt.length === 0 ? (
                <p style={{ color: "#737373" }}>등록된 부채가 없습니다.</p>
              ) : (
                <p>{prepData.debt.length}개 항목</p>
              )}
            </div>
          )}

          {(activeTab === "income" || activeTab === "expense" || activeTab === "investment" ||
            activeTab === "nationalPension" || activeTab === "retirementPension" || activeTab === "personalPension") && (
            <div className={styles.dataCard}>
              <div className={styles.dataCardTitle}>
                {TABS.find((t) => t.id === activeTab)?.label}
              </div>
              <p style={{ color: "#737373" }}>
                {prepData.completed[activeTab] ? "입력 완료" : "미입력"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
