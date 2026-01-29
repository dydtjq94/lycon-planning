"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Check, X, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, calculateAge } from "@/lib/utils";
import styles from "./RetirementDiagnosisForm.module.css";

// prep_data 타입 정의
type RelationshipType = "self" | "spouse" | "child" | "parent";
type GenderType = "male" | "female";

interface PrepFamilyMember {
  relationship: RelationshipType;
  name: string;
  birth_date: string | null;
  gender: GenderType | null;
}

interface PrepHousingData {
  housingType: "자가" | "전세" | "월세" | "무상";
  currentValue?: number;
  deposit?: number;
  monthlyRent?: number;
  maintenanceFee?: number;
  hasLoan: boolean;
  loanType?: "mortgage" | "jeonse";
  loanAmount?: number;
  loanRate?: number;
}

interface PrepSavingsItem {
  id?: string;
  type: string;
  title: string;
  owner: "self" | "spouse";
  currentBalance: number;
}

interface PrepInvestmentData {
  securities?: { balance: number; investmentTypes?: string[] };
  crypto?: { balance: number };
  gold?: { balance: number };
}

interface PrepDebtItem {
  id?: string;
  type: string;
  title: string;
  principal: number;
  currentBalance?: number;
  interestRate: number;
}

interface PrepIncomeData {
  selfLaborIncome: number;
  selfLaborFrequency: "monthly" | "yearly";
  spouseLaborIncome: number;
  spouseLaborFrequency: "monthly" | "yearly";
  additionalIncomes: {
    id?: string;
    type: string;
    owner: "self" | "spouse";
    title?: string;
    amount: number;
    frequency: "monthly" | "yearly";
  }[];
}

interface PrepExpenseData {
  livingExpense: number;
  livingExpenseDetails?: {
    food?: number;
    transport?: number;
    shopping?: number;
    leisure?: number;
    other?: number;
  };
  fixedExpenses: Array<{ id?: string; type: string; title: string; amount: number; frequency: "monthly" | "yearly" }>;
}

interface PrepNationalPensionData {
  selfType: string;
  selfExpectedAmount: number;
  selfStartAge?: number; // 수령 시작 나이 (기본 65)
  spouseType: string;
  spouseExpectedAmount: number;
  spouseStartAge?: number;
}

interface PrepRetirementPensionData {
  selfType: "db" | "dc" | "none";
  selfYearsWorked: number | null;
  selfBalance: number | null;
  selfWithdrawalPeriod?: number; // 인출 기간 (기본 20년)
  spouseType: "db" | "dc" | "none";
  spouseYearsWorked: number | null;
  spouseBalance: number | null;
  spouseWithdrawalPeriod?: number;
}

interface PrepPersonalPensionItem {
  id?: string;
  type: string;
  owner: "self" | "spouse";
  balance: number;
  withdrawalPeriod?: number; // 인출 기간 (기본 20년)
}

interface PrepRetirementGoals {
  targetRetirementAge: number;
  targetMonthlyExpense: number;
  lifeExpectancy?: number; // 기대수명 (기본 90)
}

interface PrepDataStore {
  family?: PrepFamilyMember[];
  income?: PrepIncomeData;
  expense?: PrepExpenseData;
  savings?: PrepSavingsItem[];
  investment?: PrepInvestmentData;
  housing?: PrepHousingData;
  debt?: PrepDebtItem[];
  nationalPension?: PrepNationalPensionData;
  retirementPension?: PrepRetirementPensionData;
  personalPension?: PrepPersonalPensionItem[];
  retirementGoals?: PrepRetirementGoals;
}

// 라벨 정의
const DEBT_TYPE_LABELS: Record<string, string> = {
  mortgage: "주택담보대출",
  jeonse: "전세자금대출",
  credit: "신용대출",
  car: "자동차대출",
  student: "학자금대출",
  card: "카드론",
  other: "기타",
};

const INCOME_TYPE_LABELS: Record<string, string> = {
  labor: "근로소득",
  business: "사업소득",
  pension: "연금소득",
  rental: "임대소득",
  financial: "금융소득",
  other: "기타소득",
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  housing: "주거비",
  education: "교육비",
  insurance: "보험료",
  loan: "대출상환",
  other: "기타",
};

const LIVING_EXPENSE_LABELS: Record<string, string> = {
  food: "식비",
  transport: "교통비",
  shopping: "쇼핑/미용",
  leisure: "여가/문화",
  other: "기타",
};

const SAVINGS_TYPE_LABELS: Record<string, string> = {
  checking: "입출금통장",
  savings: "적금",
  deposit: "예금",
};

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  domestic_stock: "국내주식",
  foreign_stock: "해외주식",
  fund: "펀드",
  bond: "채권",
  crypto: "암호화폐",
  gold: "금",
  other: "기타",
};

const PERSONAL_PENSION_TYPE_LABELS: Record<string, string> = {
  pension_savings: "연금저축",
  irp: "개인IRP",
  isa: "ISA",
};

interface RetirementDiagnosisFormProps {
  userId: string;
  birthYear: number;
  retirementAge: number;
}

export function RetirementDiagnosisForm({
  userId,
  birthYear,
  retirementAge,
}: RetirementDiagnosisFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [prepData, setPrepData] = useState<PrepDataStore>({});
  const [customerName, setCustomerName] = useState("고객님");
  const [saving, setSaving] = useState(false);

  // 편집 상태
  const [editingSection, setEditingSection] = useState<string | null>(null);

  // 폼 데이터
  const [familyMembers, setFamilyMembers] = useState<PrepFamilyMember[]>([]);
  const [housingData, setHousingData] = useState<PrepHousingData | null>(null);
  const [debts, setDebts] = useState<PrepDebtItem[]>([]);
  const [incomeData, setIncomeData] = useState<PrepIncomeData | null>(null);
  const [expenseData, setExpenseData] = useState<PrepExpenseData | null>(null);
  const [nationalPensionData, setNationalPensionData] = useState<PrepNationalPensionData | null>(null);
  const [retirementPensionData, setRetirementPensionData] = useState<PrepRetirementPensionData | null>(null);
  const [personalPensions, setPersonalPensions] = useState<PrepPersonalPensionItem[]>([]);
  const [savingsItems, setSavingsItems] = useState<PrepSavingsItem[]>([]);
  const [retirementGoals, setRetirementGoals] = useState<PrepRetirementGoals>({
    targetRetirementAge: retirementAge,
    targetMonthlyExpense: 300,
  });

  // 만 나이 계산 (birthYear만 있으면 1월 1일 기준)
  const currentAge = calculateAge(birthYear);

  // prep_data 저장 함수
  const savePrepData = useCallback(async (newPrepData: PrepDataStore) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ prep_data: newPrepData })
      .eq("id", userId);

    if (error) {
      console.error("Failed to save prep_data:", error);
      throw error;
    }
    setPrepData(newPrepData);
  }, [userId]);

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, prep_data")
        .eq("id", userId)
        .single();

      if (profile?.name) {
        setCustomerName(profile.name);
      }

      const loaded = (profile?.prep_data || {}) as PrepDataStore;
      setPrepData(loaded);

      setFamilyMembers(loaded.family || []);
      setHousingData(loaded.housing || null);
      setDebts((loaded.debt || []).map((d, idx) => ({ ...d, id: d.id || `debt-${idx}` })));
      setIncomeData(loaded.income || null);
      setExpenseData(loaded.expense || null);
      setNationalPensionData(loaded.nationalPension || null);
      setRetirementPensionData(loaded.retirementPension || null);
      setPersonalPensions((loaded.personalPension || []).map((p, idx) => ({ ...p, id: p.id || `personal-${idx}` })));
      setSavingsItems((loaded.savings || []).map((s, idx) => ({ ...s, id: s.id || `savings-${idx}` })));
      if (loaded.retirementGoals) {
        setRetirementGoals(loaded.retirementGoals);
      }

      setLoading(false);
    };

    loadData();
  }, [userId]);

  // Helper - 만 나이 계산
  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return calculateAge(birthDate);
  };

  // === 저장 핸들러 ===

  // 가계 정보 저장
  const handleSaveFamily = async () => {
    setSaving(true);
    try {
      const newPrepData = { ...prepData, family: familyMembers };
      await savePrepData(newPrepData);
      setEditingSection(null);
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // 거주 부동산 저장
  const handleSaveHousing = async () => {
    setSaving(true);
    try {
      const newPrepData = { ...prepData, housing: housingData || undefined };
      await savePrepData(newPrepData);
      setEditingSection(null);
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // 부채 저장
  const handleSaveDebts = async () => {
    setSaving(true);
    try {
      const newPrepData = { ...prepData, debt: debts };
      await savePrepData(newPrepData);
      setEditingSection(null);
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // 소득/지출 저장
  const handleSaveIncomeExpense = async () => {
    setSaving(true);
    try {
      const newPrepData = { ...prepData, income: incomeData || undefined, expense: expenseData || undefined };
      await savePrepData(newPrepData);
      setEditingSection(null);
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // 연금 저장
  const handleSavePensions = async () => {
    setSaving(true);
    try {
      const newPrepData = {
        ...prepData,
        nationalPension: nationalPensionData || undefined,
        retirementPension: retirementPensionData || undefined,
        personalPension: personalPensions,
      };
      await savePrepData(newPrepData);
      setEditingSection(null);
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // 금융자산 저장
  const handleSaveSavings = async () => {
    setSaving(true);
    try {
      const newPrepData = { ...prepData, savings: savingsItems };
      await savePrepData(newPrepData);
      setEditingSection(null);
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // 은퇴 목표 저장
  const handleSaveGoals = async () => {
    setSaving(true);
    try {
      const newPrepData = { ...prepData, retirementGoals };
      await savePrepData(newPrepData);
      setEditingSection(null);
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // === 편집 핸들러 ===

  // 가족 구성원 추가
  const addFamilyMember = (relationship: RelationshipType) => {
    setFamilyMembers([...familyMembers, {
      relationship,
      name: "",
      birth_date: null,
      gender: "male",
    }]);
  };

  // 가족 구성원 삭제
  const deleteFamilyMember = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  };

  // 가족 구성원 수정
  const updateFamilyMember = (index: number, field: keyof PrepFamilyMember, value: string | null) => {
    const updated = [...familyMembers];
    updated[index] = { ...updated[index], [field]: value };
    setFamilyMembers(updated);
  };

  // 파생 값 계산
  const spouse = familyMembers.find((m) => m.relationship === "spouse");
  const children = familyMembers.filter((m) => m.relationship === "child");
  const parents = familyMembers.filter((m) => m.relationship === "parent");

  const totalRealEstateValue = housingData?.housingType === "자가" ? (housingData.currentValue || 0) : 0;
  const totalDebt = debts.reduce((sum, d) => sum + (d.currentBalance || d.principal), 0);
  const totalMonthlyIncome = (incomeData?.selfLaborIncome || 0) +
    (incomeData?.spouseLaborIncome || 0) +
    (incomeData?.additionalIncomes || []).reduce((sum, i) => sum + i.amount, 0);
  const totalMonthlyExpense = (expenseData?.livingExpense || 0) +
    (expenseData?.fixedExpenses || []).reduce((sum, e) => sum + e.amount, 0);
  const savingsAccounts = savingsItems.filter((s) => ["checking", "savings", "deposit"].includes(s.type));
  const investmentAccounts = savingsItems.filter((s) => !["checking", "savings", "deposit"].includes(s.type));
  const totalSavings = savingsAccounts.reduce((sum, s) => sum + s.currentBalance, 0);
  const totalInvestments = investmentAccounts.reduce((sum, s) => sum + s.currentBalance, 0);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 상단 액션 바 */}
      <div className={styles.actionBar}>
        <button
          className={styles.reportButton}
          onClick={() => router.push(`/admin/users/${userId}/report`)}
        >
          <FileText size={14} />
          보고서 만들기
        </button>
      </div>

      {/* Section 1: 기본 정보 + 은퇴 목표 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>1. 기본 정보</h2>
          {editingSection === "goals" ? (
            <div className={styles.headerActions}>
              <button className={styles.cancelBtn} onClick={() => setEditingSection(null)}>취소</button>
              <button className={styles.saveBtn} onClick={handleSaveGoals} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          ) : (
            <button className={styles.editBtn} onClick={() => setEditingSection("goals")}>
              <Pencil size={12} /> 수정
            </button>
          )}
        </div>
        <div className={styles.sectionContent}>
          <div className={styles.infoTable}>
            <div className={styles.infoRow}>
              <span className={styles.label}>이름</span>
              <span className={styles.value}>{customerName}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>생년 / 나이</span>
              <span className={styles.value}>{birthYear}년 (만 {currentAge}세)</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>목표 은퇴 나이</span>
              {editingSection === "goals" ? (
                <div className={styles.inlineEdit}>
                  <input
                    type="number"
                    className={styles.smallInput}
                    value={retirementGoals.targetRetirementAge}
                    onChange={(e) => setRetirementGoals({ ...retirementGoals, targetRetirementAge: Number(e.target.value) || 60 })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>세</span>
                </div>
              ) : (
                <span className={styles.value}>{retirementGoals.targetRetirementAge}세</span>
              )}
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>은퇴 후 목표 생활비</span>
              {editingSection === "goals" ? (
                <div className={styles.inlineEdit}>
                  <input
                    type="number"
                    className={styles.smallInput}
                    value={retirementGoals.targetMonthlyExpense || ""}
                    onChange={(e) => setRetirementGoals({ ...retirementGoals, targetMonthlyExpense: Number(e.target.value) || 0 })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
              ) : (
                <span className={styles.value}>{formatMoney(retirementGoals.targetMonthlyExpense)}/월</span>
              )}
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>기대수명</span>
              {editingSection === "goals" ? (
                <div className={styles.inlineEdit}>
                  <input
                    type="number"
                    className={styles.smallInput}
                    value={retirementGoals.lifeExpectancy || 90}
                    onChange={(e) => setRetirementGoals({ ...retirementGoals, lifeExpectancy: Number(e.target.value) || 90 })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>세</span>
                </div>
              ) : (
                <span className={styles.value}>{retirementGoals.lifeExpectancy || 90}세</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: 가계 구성 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>2. 가계 구성</h2>
          {editingSection === "family" ? (
            <div className={styles.headerActions}>
              <button className={styles.cancelBtn} onClick={() => {
                setFamilyMembers(prepData.family || []);
                setEditingSection(null);
              }}>취소</button>
              <button className={styles.saveBtn} onClick={handleSaveFamily} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          ) : (
            <button className={styles.editBtn} onClick={() => setEditingSection("family")}>
              <Pencil size={12} /> 수정
            </button>
          )}
        </div>
        <div className={styles.sectionContent}>
          {editingSection === "family" ? (
            <div className={styles.editList}>
              {familyMembers.map((member, idx) => (
                <div key={idx} className={styles.editRow}>
                  <select
                    className={styles.selectSmall}
                    value={member.relationship}
                    onChange={(e) => updateFamilyMember(idx, "relationship", e.target.value)}
                  >
                    <option value="spouse">배우자</option>
                    <option value="child">자녀</option>
                    <option value="parent">부모님</option>
                  </select>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="이름"
                    value={member.name}
                    onChange={(e) => updateFamilyMember(idx, "name", e.target.value)}
                  />
                  <input
                    type="date"
                    className={styles.input}
                    value={member.birth_date || ""}
                    onChange={(e) => updateFamilyMember(idx, "birth_date", e.target.value || null)}
                  />
                  <select
                    className={styles.selectSmall}
                    value={member.gender || "male"}
                    onChange={(e) => updateFamilyMember(idx, "gender", e.target.value)}
                  >
                    <option value="male">남</option>
                    <option value="female">여</option>
                  </select>
                  <button className={styles.deleteBtn} onClick={() => deleteFamilyMember(idx)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className={styles.addButtons}>
                {!spouse && (
                  <button className={styles.addBtn} onClick={() => addFamilyMember("spouse")}>
                    <Plus size={12} /> 배우자
                  </button>
                )}
                <button className={styles.addBtn} onClick={() => addFamilyMember("child")}>
                  <Plus size={12} /> 자녀
                </button>
                <button className={styles.addBtn} onClick={() => addFamilyMember("parent")}>
                  <Plus size={12} /> 부모님
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.infoTable}>
              <div className={styles.infoRow}>
                <span className={styles.label}>배우자</span>
                <span className={styles.value}>
                  {spouse ? `${spouse.name} (만 ${getAge(spouse.birth_date)}세)` : "없음"}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>자녀</span>
                <span className={styles.value}>
                  {children.length > 0
                    ? children.map((c) => `${c.name || "이름 미입력"} (만 ${getAge(c.birth_date)}세)`).join(", ")
                    : "없음"}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>부양가족</span>
                <span className={styles.value}>
                  {parents.length > 0
                    ? parents.map((p) => `${p.name || "이름 미입력"} (만 ${getAge(p.birth_date)}세)`).join(", ")
                    : "없음"}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 3: 거주 부동산 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>3. 거주 부동산</h2>
          <div className={styles.headerRight}>
            {totalRealEstateValue > 0 && <span className={styles.summary}>시세 {formatMoney(totalRealEstateValue)}</span>}
            {editingSection === "housing" ? (
              <div className={styles.headerActions}>
                <button className={styles.cancelBtn} onClick={() => {
                  setHousingData(prepData.housing || null);
                  setEditingSection(null);
                }}>취소</button>
                <button className={styles.saveBtn} onClick={handleSaveHousing} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            ) : (
              <button className={styles.editBtn} onClick={() => setEditingSection("housing")}>
                <Pencil size={12} /> 수정
              </button>
            )}
          </div>
        </div>
        <div className={styles.sectionContent}>
          {editingSection === "housing" ? (
            <div className={styles.editForm}>
              <div className={styles.formRow}>
                <label>주거 형태</label>
                <select
                  className={styles.select}
                  value={housingData?.housingType || "무상"}
                  onChange={(e) => {
                    const type = e.target.value as "자가" | "전세" | "월세" | "무상";
                    setHousingData({
                      housingType: type,
                      currentValue: type === "자가" ? (housingData?.currentValue || 0) : undefined,
                      deposit: type === "전세" || type === "월세" ? (housingData?.deposit || 0) : undefined,
                      monthlyRent: type === "월세" ? (housingData?.monthlyRent || 0) : undefined,
                      hasLoan: housingData?.hasLoan || false,
                      loanAmount: housingData?.loanAmount,
                      loanRate: housingData?.loanRate,
                    });
                  }}
                >
                  <option value="자가">자가</option>
                  <option value="전세">전세</option>
                  <option value="월세">월세</option>
                  <option value="무상">무상</option>
                </select>
              </div>
              {housingData?.housingType === "자가" && (
                <>
                  <div className={styles.formRow}>
                    <label>시세</label>
                    <div className={styles.inputWithUnit}>
                      <input
                        type="number"
                        className={styles.input}
                        value={housingData.currentValue || ""}
                        onChange={(e) => setHousingData({ ...housingData, currentValue: Number(e.target.value) || 0 })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.unit}>만원</span>
                    </div>
                  </div>
                  <div className={styles.formRow}>
                    <label>담보대출</label>
                    <div className={styles.inputWithUnit}>
                      <input
                        type="number"
                        className={styles.input}
                        value={housingData.loanAmount || ""}
                        onChange={(e) => setHousingData({
                          ...housingData,
                          hasLoan: Number(e.target.value) > 0,
                          loanAmount: Number(e.target.value) || 0
                        })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.unit}>만원</span>
                    </div>
                  </div>
                  {housingData.hasLoan && (
                    <div className={styles.formRow}>
                      <label>대출 금리</label>
                      <div className={styles.inputWithUnit}>
                        <input
                          type="number"
                          className={styles.input}
                          value={housingData.loanRate || ""}
                          onChange={(e) => setHousingData({ ...housingData, loanRate: Number(e.target.value) || 4.5 })}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          step="0.1"
                        />
                        <span className={styles.unit}>%</span>
                      </div>
                    </div>
                  )}
                </>
              )}
              {(housingData?.housingType === "전세" || housingData?.housingType === "월세") && (
                <div className={styles.formRow}>
                  <label>보증금</label>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.input}
                      value={housingData.deposit || ""}
                      onChange={(e) => setHousingData({ ...housingData, deposit: Number(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                </div>
              )}
              {housingData?.housingType === "월세" && (
                <div className={styles.formRow}>
                  <label>월세</label>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.input}
                      value={housingData.monthlyRent || ""}
                      onChange={(e) => setHousingData({ ...housingData, monthlyRent: Number(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원/월</span>
                  </div>
                </div>
              )}
              {housingData && (
                <div className={styles.formRow}>
                  <label>관리비</label>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.input}
                      value={housingData.maintenanceFee || ""}
                      onChange={(e) => setHousingData({ ...housingData, maintenanceFee: Number(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원/월</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.infoTable}>
              {housingData ? (
                <>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>주거 형태</span>
                    <span className={styles.value}>{housingData.housingType}</span>
                  </div>
                  {housingData.housingType === "자가" && (
                    <>
                      <div className={styles.infoRow}>
                        <span className={styles.label}>시세</span>
                        <span className={styles.value}>{formatMoney(housingData.currentValue || 0)}</span>
                      </div>
                      {housingData.hasLoan && (
                        <div className={styles.infoRow}>
                          <span className={styles.label}>담보대출</span>
                          <span className={styles.value}>{formatMoney(housingData.loanAmount || 0)} ({housingData.loanRate || 4.5}%)</span>
                        </div>
                      )}
                    </>
                  )}
                  {(housingData.housingType === "전세" || housingData.housingType === "월세") && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>보증금</span>
                      <span className={styles.value}>{formatMoney(housingData.deposit || 0)}</span>
                    </div>
                  )}
                  {housingData.housingType === "월세" && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>월세</span>
                      <span className={styles.value}>{formatMoney(housingData.monthlyRent || 0)}/월</span>
                    </div>
                  )}
                  {(housingData.maintenanceFee || 0) > 0 && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>관리비</span>
                      <span className={styles.value}>{formatMoney(housingData.maintenanceFee || 0)}/월</span>
                    </div>
                  )}
                </>
              ) : (
                <span className={styles.empty}>등록된 거주 정보가 없습니다</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 4: 부채 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>4. 부채</h2>
          <div className={styles.headerRight}>
            {totalDebt > 0 && <span className={styles.summary}>총 {formatMoney(totalDebt)}</span>}
            {editingSection === "debt" ? (
              <div className={styles.headerActions}>
                <button className={styles.cancelBtn} onClick={() => {
                  setDebts((prepData.debt || []).map((d, idx) => ({ ...d, id: d.id || `debt-${idx}` })));
                  setEditingSection(null);
                }}>취소</button>
                <button className={styles.saveBtn} onClick={handleSaveDebts} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            ) : (
              <button className={styles.editBtn} onClick={() => setEditingSection("debt")}>
                <Pencil size={12} /> 수정
              </button>
            )}
          </div>
        </div>
        <div className={styles.sectionContent}>
          {editingSection === "debt" ? (
            <div className={styles.editList}>
              {debts.map((debt, idx) => (
                <div key={debt.id} className={styles.editRow}>
                  <select
                    className={styles.selectSmall}
                    value={debt.type}
                    onChange={(e) => {
                      const updated = [...debts];
                      updated[idx] = { ...updated[idx], type: e.target.value };
                      setDebts(updated);
                    }}
                  >
                    {Object.entries(DEBT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="명칭"
                    value={debt.title}
                    onChange={(e) => {
                      const updated = [...debts];
                      updated[idx] = { ...updated[idx], title: e.target.value };
                      setDebts(updated);
                    }}
                  />
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.smallInput}
                      placeholder="잔액"
                      value={debt.currentBalance || debt.principal || ""}
                      onChange={(e) => {
                        const updated = [...debts];
                        updated[idx] = { ...updated[idx], principal: Number(e.target.value) || 0, currentBalance: Number(e.target.value) || 0 };
                        setDebts(updated);
                      }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.smallInput}
                      placeholder="금리"
                      value={debt.interestRate || ""}
                      onChange={(e) => {
                        const updated = [...debts];
                        updated[idx] = { ...updated[idx], interestRate: Number(e.target.value) || 0 };
                        setDebts(updated);
                      }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      step="0.1"
                    />
                    <span className={styles.unit}>%</span>
                  </div>
                  <button className={styles.deleteBtn} onClick={() => setDebts(debts.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                className={styles.addBtn}
                onClick={() => setDebts([...debts, { id: `debt-${Date.now()}`, type: "credit", title: "", principal: 0, interestRate: 5.0 }])}
              >
                <Plus size={12} /> 부채 추가
              </button>
            </div>
          ) : (
            <div className={styles.itemList}>
              {debts.length > 0 ? debts.map((d) => (
                <div key={d.id} className={styles.item}>
                  <span className={styles.itemBadge}>{DEBT_TYPE_LABELS[d.type]}</span>
                  <span className={styles.itemTitle}>{d.title}</span>
                  <span className={styles.itemValue}>{formatMoney(d.currentBalance || d.principal)}</span>
                  <span className={styles.itemSub}>{d.interestRate}%</span>
                </div>
              )) : (
                <span className={styles.empty}>등록된 부채가 없습니다</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 5: 소득/지출 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>5. 소득/지출</h2>
          <div className={styles.headerRight}>
            <span className={styles.summary}>
              월 수입 {formatMoney(totalMonthlyIncome)} / 지출 {formatMoney(totalMonthlyExpense)}
            </span>
            {editingSection === "income" ? (
              <div className={styles.headerActions}>
                <button className={styles.cancelBtn} onClick={() => {
                  setIncomeData(prepData.income || null);
                  setExpenseData(prepData.expense || null);
                  setEditingSection(null);
                }}>취소</button>
                <button className={styles.saveBtn} onClick={handleSaveIncomeExpense} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            ) : (
              <button className={styles.editBtn} onClick={() => setEditingSection("income")}>
                <Pencil size={12} /> 수정
              </button>
            )}
          </div>
        </div>
        <div className={styles.sectionContent}>
          {editingSection === "income" ? (
            <div className={styles.editForm}>
              <h4 className={styles.subTitle}>근로소득</h4>
              <div className={styles.formRow}>
                <label>본인 월 소득</label>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    className={styles.input}
                    value={incomeData?.selfLaborIncome || ""}
                    onChange={(e) => setIncomeData({
                      ...(incomeData || { selfLaborIncome: 0, selfLaborFrequency: "monthly", spouseLaborIncome: 0, spouseLaborFrequency: "monthly", additionalIncomes: [] }),
                      selfLaborIncome: Number(e.target.value) || 0
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <label>배우자 월 소득</label>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    className={styles.input}
                    value={incomeData?.spouseLaborIncome || ""}
                    onChange={(e) => setIncomeData({
                      ...(incomeData || { selfLaborIncome: 0, selfLaborFrequency: "monthly", spouseLaborIncome: 0, spouseLaborFrequency: "monthly", additionalIncomes: [] }),
                      spouseLaborIncome: Number(e.target.value) || 0
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원</span>
                </div>
              </div>

              <h4 className={styles.subTitle}>기타 소득</h4>
              {(incomeData?.additionalIncomes || []).map((income, idx) => (
                <div key={income.id || idx} className={styles.editRow}>
                  <select
                    className={styles.selectSmall}
                    value={income.type}
                    onChange={(e) => {
                      const updated = { ...incomeData! };
                      updated.additionalIncomes[idx] = { ...updated.additionalIncomes[idx], type: e.target.value };
                      setIncomeData(updated);
                    }}
                  >
                    {Object.entries(INCOME_TYPE_LABELS).filter(([k]) => k !== "labor").map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="명칭"
                    value={income.title || ""}
                    onChange={(e) => {
                      const updated = { ...incomeData! };
                      updated.additionalIncomes[idx] = { ...updated.additionalIncomes[idx], title: e.target.value };
                      setIncomeData(updated);
                    }}
                  />
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.smallInput}
                      value={income.amount || ""}
                      onChange={(e) => {
                        const updated = { ...incomeData! };
                        updated.additionalIncomes[idx] = { ...updated.additionalIncomes[idx], amount: Number(e.target.value) || 0 };
                        setIncomeData(updated);
                      }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원/월</span>
                  </div>
                  <button className={styles.deleteBtn} onClick={() => {
                    const updated = { ...incomeData! };
                    updated.additionalIncomes = updated.additionalIncomes.filter((_, i) => i !== idx);
                    setIncomeData(updated);
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                className={styles.addBtn}
                onClick={() => {
                  const current = incomeData || { selfLaborIncome: 0, selfLaborFrequency: "monthly" as const, spouseLaborIncome: 0, spouseLaborFrequency: "monthly" as const, additionalIncomes: [] };
                  setIncomeData({
                    ...current,
                    additionalIncomes: [...current.additionalIncomes, { id: `income-${Date.now()}`, type: "rental", owner: "self", amount: 0, frequency: "monthly" }]
                  });
                }}
              >
                <Plus size={12} /> 기타소득 추가
              </button>

              <h4 className={styles.subTitle}>지출 (변동비)</h4>
              <div className={styles.formRow}>
                <label>식비</label>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    className={styles.input}
                    value={expenseData?.livingExpenseDetails?.food || ""}
                    onChange={(e) => setExpenseData({
                      ...(expenseData || { livingExpense: 0, fixedExpenses: [] }),
                      livingExpenseDetails: {
                        ...(expenseData?.livingExpenseDetails || {}),
                        food: Number(e.target.value) || 0
                      },
                      livingExpense: (Number(e.target.value) || 0) +
                        (expenseData?.livingExpenseDetails?.transport || 0) +
                        (expenseData?.livingExpenseDetails?.shopping || 0) +
                        (expenseData?.livingExpenseDetails?.leisure || 0) +
                        (expenseData?.livingExpenseDetails?.other || 0)
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <label>교통비</label>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    className={styles.input}
                    value={expenseData?.livingExpenseDetails?.transport || ""}
                    onChange={(e) => setExpenseData({
                      ...(expenseData || { livingExpense: 0, fixedExpenses: [] }),
                      livingExpenseDetails: {
                        ...(expenseData?.livingExpenseDetails || {}),
                        transport: Number(e.target.value) || 0
                      },
                      livingExpense: (expenseData?.livingExpenseDetails?.food || 0) +
                        (Number(e.target.value) || 0) +
                        (expenseData?.livingExpenseDetails?.shopping || 0) +
                        (expenseData?.livingExpenseDetails?.leisure || 0) +
                        (expenseData?.livingExpenseDetails?.other || 0)
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <label>쇼핑/미용</label>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    className={styles.input}
                    value={expenseData?.livingExpenseDetails?.shopping || ""}
                    onChange={(e) => setExpenseData({
                      ...(expenseData || { livingExpense: 0, fixedExpenses: [] }),
                      livingExpenseDetails: {
                        ...(expenseData?.livingExpenseDetails || {}),
                        shopping: Number(e.target.value) || 0
                      },
                      livingExpense: (expenseData?.livingExpenseDetails?.food || 0) +
                        (expenseData?.livingExpenseDetails?.transport || 0) +
                        (Number(e.target.value) || 0) +
                        (expenseData?.livingExpenseDetails?.leisure || 0) +
                        (expenseData?.livingExpenseDetails?.other || 0)
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <label>여가/문화</label>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    className={styles.input}
                    value={expenseData?.livingExpenseDetails?.leisure || ""}
                    onChange={(e) => setExpenseData({
                      ...(expenseData || { livingExpense: 0, fixedExpenses: [] }),
                      livingExpenseDetails: {
                        ...(expenseData?.livingExpenseDetails || {}),
                        leisure: Number(e.target.value) || 0
                      },
                      livingExpense: (expenseData?.livingExpenseDetails?.food || 0) +
                        (expenseData?.livingExpenseDetails?.transport || 0) +
                        (expenseData?.livingExpenseDetails?.shopping || 0) +
                        (Number(e.target.value) || 0) +
                        (expenseData?.livingExpenseDetails?.other || 0)
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <label>기타</label>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    className={styles.input}
                    value={expenseData?.livingExpenseDetails?.other || ""}
                    onChange={(e) => setExpenseData({
                      ...(expenseData || { livingExpense: 0, fixedExpenses: [] }),
                      livingExpenseDetails: {
                        ...(expenseData?.livingExpenseDetails || {}),
                        other: Number(e.target.value) || 0
                      },
                      livingExpense: (expenseData?.livingExpenseDetails?.food || 0) +
                        (expenseData?.livingExpenseDetails?.transport || 0) +
                        (expenseData?.livingExpenseDetails?.shopping || 0) +
                        (expenseData?.livingExpenseDetails?.leisure || 0) +
                        (Number(e.target.value) || 0)
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
              </div>

              <h4 className={styles.subTitle}>고정 지출</h4>
              {(expenseData?.fixedExpenses || []).map((expense, idx) => (
                <div key={expense.id || idx} className={styles.editRow}>
                  <select
                    className={styles.selectSmall}
                    value={expense.type}
                    onChange={(e) => {
                      const updated = { ...expenseData! };
                      updated.fixedExpenses[idx] = { ...updated.fixedExpenses[idx], type: e.target.value };
                      setExpenseData(updated);
                    }}
                  >
                    {Object.entries(EXPENSE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="명칭"
                    value={expense.title}
                    onChange={(e) => {
                      const updated = { ...expenseData! };
                      updated.fixedExpenses[idx] = { ...updated.fixedExpenses[idx], title: e.target.value };
                      setExpenseData(updated);
                    }}
                  />
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.smallInput}
                      value={expense.amount || ""}
                      onChange={(e) => {
                        const updated = { ...expenseData! };
                        updated.fixedExpenses[idx] = { ...updated.fixedExpenses[idx], amount: Number(e.target.value) || 0 };
                        setExpenseData(updated);
                      }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원/월</span>
                  </div>
                  <button className={styles.deleteBtn} onClick={() => {
                    const updated = { ...expenseData! };
                    updated.fixedExpenses = updated.fixedExpenses.filter((_, i) => i !== idx);
                    setExpenseData(updated);
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                className={styles.addBtn}
                onClick={() => {
                  const current = expenseData || { livingExpense: 0, fixedExpenses: [] };
                  setExpenseData({
                    ...current,
                    fixedExpenses: [...current.fixedExpenses, { id: `expense-${Date.now()}`, type: "insurance", title: "", amount: 0, frequency: "monthly" }]
                  });
                }}
              >
                <Plus size={12} /> 고정지출 추가
              </button>
            </div>
          ) : (
            <div className={styles.infoTable}>
              <div className={styles.infoRow}>
                <span className={styles.label}>본인 근로소득</span>
                <span className={styles.value}>{formatMoney(incomeData?.selfLaborIncome || 0)}/월</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>배우자 근로소득</span>
                <span className={styles.value}>{formatMoney(incomeData?.spouseLaborIncome || 0)}/월</span>
              </div>
              {(incomeData?.additionalIncomes || []).map((i) => (
                <div key={i.id} className={styles.infoRow}>
                  <span className={styles.label}>{INCOME_TYPE_LABELS[i.type] || i.type}</span>
                  <span className={styles.value}>{formatMoney(i.amount)}/월</span>
                </div>
              ))}
              <div className={styles.divider} />
              {expenseData?.livingExpenseDetails && Object.values(expenseData.livingExpenseDetails).some(v => v && v > 0) ? (
                <>
                  {expenseData.livingExpenseDetails.food ? (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>식비</span>
                      <span className={styles.value}>{formatMoney(expenseData.livingExpenseDetails.food)}/월</span>
                    </div>
                  ) : null}
                  {expenseData.livingExpenseDetails.transport ? (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>교통비</span>
                      <span className={styles.value}>{formatMoney(expenseData.livingExpenseDetails.transport)}/월</span>
                    </div>
                  ) : null}
                  {expenseData.livingExpenseDetails.shopping ? (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>쇼핑/미용</span>
                      <span className={styles.value}>{formatMoney(expenseData.livingExpenseDetails.shopping)}/월</span>
                    </div>
                  ) : null}
                  {expenseData.livingExpenseDetails.leisure ? (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>여가/문화</span>
                      <span className={styles.value}>{formatMoney(expenseData.livingExpenseDetails.leisure)}/월</span>
                    </div>
                  ) : null}
                  {expenseData.livingExpenseDetails.other ? (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>기타 생활비</span>
                      <span className={styles.value}>{formatMoney(expenseData.livingExpenseDetails.other)}/월</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.infoRow}>
                  <span className={styles.label}>월 생활비</span>
                  <span className={styles.value}>{formatMoney(expenseData?.livingExpense || 0)}/월</span>
                </div>
              )}
              {(expenseData?.fixedExpenses || []).map((e) => (
                <div key={e.id} className={styles.infoRow}>
                  <span className={styles.label}>{e.title || EXPENSE_TYPE_LABELS[e.type]}</span>
                  <span className={styles.value}>{formatMoney(e.amount)}/월</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section 6: 연금 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>6. 연금</h2>
          {editingSection === "pension" ? (
            <div className={styles.headerActions}>
              <button className={styles.cancelBtn} onClick={() => {
                setNationalPensionData(prepData.nationalPension || null);
                setRetirementPensionData(prepData.retirementPension || null);
                setPersonalPensions((prepData.personalPension || []).map((p, idx) => ({ ...p, id: p.id || `personal-${idx}` })));
                setEditingSection(null);
              }}>취소</button>
              <button className={styles.saveBtn} onClick={handleSavePensions} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          ) : (
            <button className={styles.editBtn} onClick={() => setEditingSection("pension")}>
              <Pencil size={12} /> 수정
            </button>
          )}
        </div>
        <div className={styles.sectionContent}>
          {editingSection === "pension" ? (
            <div className={styles.editForm}>
              <h4 className={styles.subTitle}>국민연금</h4>
              <div className={styles.formRow}>
                <label>본인 예상 수령액</label>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    className={styles.input}
                    value={nationalPensionData?.selfExpectedAmount || ""}
                    onChange={(e) => setNationalPensionData({
                      ...(nationalPensionData || { selfType: "national", selfExpectedAmount: 0, spouseType: "national", spouseExpectedAmount: 0 }),
                      selfExpectedAmount: Number(e.target.value) || 0
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <label>배우자 예상 수령액</label>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    className={styles.input}
                    value={nationalPensionData?.spouseExpectedAmount || ""}
                    onChange={(e) => setNationalPensionData({
                      ...(nationalPensionData || { selfType: "national", selfExpectedAmount: 0, spouseType: "national", spouseExpectedAmount: 0 }),
                      spouseExpectedAmount: Number(e.target.value) || 0
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <label>본인 수령 시작 나이</label>
                <div className={styles.inputWithUnit}>
                  <select
                    className={styles.selectSmall}
                    value={nationalPensionData?.selfStartAge || 65}
                    onChange={(e) => setNationalPensionData({
                      ...(nationalPensionData || { selfType: "national", selfExpectedAmount: 0, spouseType: "national", spouseExpectedAmount: 0 }),
                      selfStartAge: Number(e.target.value)
                    })}
                  >
                    <option value={62}>62세 (조기)</option>
                    <option value={63}>63세</option>
                    <option value={64}>64세</option>
                    <option value={65}>65세 (정상)</option>
                    <option value={66}>66세</option>
                    <option value={67}>67세</option>
                    <option value={68}>68세</option>
                    <option value={69}>69세</option>
                    <option value={70}>70세 (연기)</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <label>배우자 수령 시작 나이</label>
                <div className={styles.inputWithUnit}>
                  <select
                    className={styles.selectSmall}
                    value={nationalPensionData?.spouseStartAge || 65}
                    onChange={(e) => setNationalPensionData({
                      ...(nationalPensionData || { selfType: "national", selfExpectedAmount: 0, spouseType: "national", spouseExpectedAmount: 0 }),
                      spouseStartAge: Number(e.target.value)
                    })}
                  >
                    <option value={62}>62세 (조기)</option>
                    <option value={63}>63세</option>
                    <option value={64}>64세</option>
                    <option value={65}>65세 (정상)</option>
                    <option value={66}>66세</option>
                    <option value={67}>67세</option>
                    <option value={68}>68세</option>
                    <option value={69}>69세</option>
                    <option value={70}>70세 (연기)</option>
                  </select>
                </div>
              </div>

              <h4 className={styles.subTitle}>퇴직연금</h4>
              <div className={styles.formRow}>
                <label>본인 적립금</label>
                <div className={styles.inputWithUnit}>
                  <select
                    className={styles.selectSmall}
                    value={retirementPensionData?.selfType || "dc"}
                    onChange={(e) => setRetirementPensionData({
                      ...(retirementPensionData || { selfType: "dc", selfYearsWorked: null, selfBalance: null, spouseType: "dc", spouseYearsWorked: null, spouseBalance: null }),
                      selfType: e.target.value as "db" | "dc" | "none"
                    })}
                  >
                    <option value="db">DB형</option>
                    <option value="dc">DC형</option>
                    <option value="none">없음</option>
                  </select>
                  <input
                    type="number"
                    className={styles.input}
                    value={retirementPensionData?.selfBalance || ""}
                    onChange={(e) => setRetirementPensionData({
                      ...(retirementPensionData || { selfType: "dc", selfYearsWorked: null, selfBalance: null, spouseType: "dc", spouseYearsWorked: null, spouseBalance: null }),
                      selfBalance: Number(e.target.value) || null
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <label>배우자 적립금</label>
                <div className={styles.inputWithUnit}>
                  <select
                    className={styles.selectSmall}
                    value={retirementPensionData?.spouseType || "dc"}
                    onChange={(e) => setRetirementPensionData({
                      ...(retirementPensionData || { selfType: "dc", selfYearsWorked: null, selfBalance: null, spouseType: "dc", spouseYearsWorked: null, spouseBalance: null }),
                      spouseType: e.target.value as "db" | "dc" | "none"
                    })}
                  >
                    <option value="db">DB형</option>
                    <option value="dc">DC형</option>
                    <option value="none">없음</option>
                  </select>
                  <input
                    type="number"
                    className={styles.input}
                    value={retirementPensionData?.spouseBalance || ""}
                    onChange={(e) => setRetirementPensionData({
                      ...(retirementPensionData || { selfType: "dc", selfYearsWorked: null, selfBalance: null, spouseType: "dc", spouseYearsWorked: null, spouseBalance: null }),
                      spouseBalance: Number(e.target.value) || null
                    })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원</span>
                </div>
              </div>
              <div className={styles.formRow}>
                <label>퇴직연금 인출 기간</label>
                <div className={styles.inputWithUnit}>
                  <select
                    className={styles.selectSmall}
                    value={retirementPensionData?.selfWithdrawalPeriod || 20}
                    onChange={(e) => setRetirementPensionData({
                      ...(retirementPensionData || { selfType: "dc", selfYearsWorked: null, selfBalance: null, spouseType: "dc", spouseYearsWorked: null, spouseBalance: null }),
                      selfWithdrawalPeriod: Number(e.target.value),
                      spouseWithdrawalPeriod: Number(e.target.value)
                    })}
                  >
                    <option value={10}>10년</option>
                    <option value={15}>15년</option>
                    <option value={20}>20년</option>
                    <option value={25}>25년</option>
                    <option value={30}>30년</option>
                  </select>
                </div>
              </div>

              <h4 className={styles.subTitle}>개인연금</h4>
              {personalPensions.map((pp, idx) => (
                <div key={pp.id} className={styles.editRow}>
                  <select
                    className={styles.selectSmall}
                    value={pp.type}
                    onChange={(e) => {
                      const updated = [...personalPensions];
                      updated[idx] = { ...updated[idx], type: e.target.value };
                      setPersonalPensions(updated);
                    }}
                  >
                    {Object.entries(PERSONAL_PENSION_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <select
                    className={styles.selectSmall}
                    value={pp.owner}
                    onChange={(e) => {
                      const updated = [...personalPensions];
                      updated[idx] = { ...updated[idx], owner: e.target.value as "self" | "spouse" };
                      setPersonalPensions(updated);
                    }}
                  >
                    <option value="self">본인</option>
                    <option value="spouse">배우자</option>
                  </select>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.smallInput}
                      value={pp.balance || ""}
                      onChange={(e) => {
                        const updated = [...personalPensions];
                        updated[idx] = { ...updated[idx], balance: Number(e.target.value) || 0 };
                        setPersonalPensions(updated);
                      }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                  <button className={styles.deleteBtn} onClick={() => setPersonalPensions(personalPensions.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                className={styles.addBtn}
                onClick={() => setPersonalPensions([...personalPensions, { id: `personal-${Date.now()}`, type: "pension_savings", owner: "self", balance: 0 }])}
              >
                <Plus size={12} /> 개인연금 추가
              </button>
            </div>
          ) : (
            <div className={styles.infoTable}>
              <div className={styles.infoRow}>
                <span className={styles.label}>국민연금 (본인)</span>
                <span className={styles.value}>{formatMoney(nationalPensionData?.selfExpectedAmount || 0)}/월</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>국민연금 (배우자)</span>
                <span className={styles.value}>{formatMoney(nationalPensionData?.spouseExpectedAmount || 0)}/월</span>
              </div>
              <div className={styles.divider} />
              <div className={styles.infoRow}>
                <span className={styles.label}>퇴직연금 (본인)</span>
                <span className={styles.value}>
                  {retirementPensionData?.selfBalance
                    ? `${retirementPensionData.selfType === "db" ? "DB" : "DC"} ${formatMoney(retirementPensionData.selfBalance)}`
                    : "없음"}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>퇴직연금 (배우자)</span>
                <span className={styles.value}>
                  {retirementPensionData?.spouseBalance
                    ? `${retirementPensionData.spouseType === "db" ? "DB" : "DC"} ${formatMoney(retirementPensionData.spouseBalance)}`
                    : "없음"}
                </span>
              </div>
              {personalPensions.length > 0 && (
                <>
                  <div className={styles.divider} />
                  {personalPensions.map((pp) => (
                    <div key={pp.id} className={styles.infoRow}>
                      <span className={styles.label}>{PERSONAL_PENSION_TYPE_LABELS[pp.type]} ({pp.owner === "self" ? "본인" : "배우자"})</span>
                      <span className={styles.value}>{formatMoney(pp.balance)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 7: 금융자산 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>7. 금융자산</h2>
          <div className={styles.headerRight}>
            {(totalSavings + totalInvestments) > 0 && <span className={styles.summary}>총 {formatMoney(totalSavings + totalInvestments)}</span>}
            {editingSection === "savings" ? (
              <div className={styles.headerActions}>
                <button className={styles.cancelBtn} onClick={() => {
                  setSavingsItems((prepData.savings || []).map((s, idx) => ({ ...s, id: s.id || `savings-${idx}` })));
                  setEditingSection(null);
                }}>취소</button>
                <button className={styles.saveBtn} onClick={handleSaveSavings} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            ) : (
              <button className={styles.editBtn} onClick={() => setEditingSection("savings")}>
                <Pencil size={12} /> 수정
              </button>
            )}
          </div>
        </div>
        <div className={styles.sectionContent}>
          {editingSection === "savings" ? (
            <div className={styles.editForm}>
              <h4 className={styles.subTitle}>저축 (예금, 적금)</h4>
              {savingsAccounts.map((s, idx) => {
                const realIdx = savingsItems.findIndex((item) => item.id === s.id);
                return (
                  <div key={s.id} className={styles.editRow}>
                    <select
                      className={styles.selectSmall}
                      value={s.type}
                      onChange={(e) => {
                        const updated = [...savingsItems];
                        updated[realIdx] = { ...updated[realIdx], type: e.target.value };
                        setSavingsItems(updated);
                      }}
                    >
                      {Object.entries(SAVINGS_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="명칭"
                      value={s.title}
                      onChange={(e) => {
                        const updated = [...savingsItems];
                        updated[realIdx] = { ...updated[realIdx], title: e.target.value };
                        setSavingsItems(updated);
                      }}
                    />
                    <select
                      className={styles.selectSmall}
                      value={s.owner}
                      onChange={(e) => {
                        const updated = [...savingsItems];
                        updated[realIdx] = { ...updated[realIdx], owner: e.target.value as "self" | "spouse" };
                        setSavingsItems(updated);
                      }}
                    >
                      <option value="self">본인</option>
                      <option value="spouse">배우자</option>
                    </select>
                    <div className={styles.inputWithUnit}>
                      <input
                        type="number"
                        className={styles.smallInput}
                        value={s.currentBalance || ""}
                        onChange={(e) => {
                          const updated = [...savingsItems];
                          updated[realIdx] = { ...updated[realIdx], currentBalance: Number(e.target.value) || 0 };
                          setSavingsItems(updated);
                        }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.unit}>만원</span>
                    </div>
                    <button className={styles.deleteBtn} onClick={() => setSavingsItems(savingsItems.filter((_, i) => i !== realIdx))}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              <button
                className={styles.addBtn}
                onClick={() => setSavingsItems([...savingsItems, { id: `savings-${Date.now()}`, type: "savings", title: "", owner: "self", currentBalance: 0 }])}
              >
                <Plus size={12} /> 저축 추가
              </button>

              <h4 className={styles.subTitle}>투자 (주식, 펀드, 코인 등)</h4>
              {investmentAccounts.map((s, idx) => {
                const realIdx = savingsItems.findIndex((item) => item.id === s.id);
                return (
                  <div key={s.id} className={styles.editRow}>
                    <select
                      className={styles.selectSmall}
                      value={s.type}
                      onChange={(e) => {
                        const updated = [...savingsItems];
                        updated[realIdx] = { ...updated[realIdx], type: e.target.value };
                        setSavingsItems(updated);
                      }}
                    >
                      {Object.entries(INVESTMENT_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="명칭"
                      value={s.title}
                      onChange={(e) => {
                        const updated = [...savingsItems];
                        updated[realIdx] = { ...updated[realIdx], title: e.target.value };
                        setSavingsItems(updated);
                      }}
                    />
                    <select
                      className={styles.selectSmall}
                      value={s.owner}
                      onChange={(e) => {
                        const updated = [...savingsItems];
                        updated[realIdx] = { ...updated[realIdx], owner: e.target.value as "self" | "spouse" };
                        setSavingsItems(updated);
                      }}
                    >
                      <option value="self">본인</option>
                      <option value="spouse">배우자</option>
                    </select>
                    <div className={styles.inputWithUnit}>
                      <input
                        type="number"
                        className={styles.smallInput}
                        value={s.currentBalance || ""}
                        onChange={(e) => {
                          const updated = [...savingsItems];
                          updated[realIdx] = { ...updated[realIdx], currentBalance: Number(e.target.value) || 0 };
                          setSavingsItems(updated);
                        }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.unit}>만원</span>
                    </div>
                    <button className={styles.deleteBtn} onClick={() => setSavingsItems(savingsItems.filter((_, i) => i !== realIdx))}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              <button
                className={styles.addBtn}
                onClick={() => setSavingsItems([...savingsItems, { id: `investment-${Date.now()}`, type: "domestic_stock", title: "", owner: "self", currentBalance: 0 }])}
              >
                <Plus size={12} /> 투자 추가
              </button>
            </div>
          ) : (
            <div className={styles.itemList}>
              {savingsAccounts.length > 0 && (
                <>
                  <div className={styles.itemGroupTitle}>저축</div>
                  {savingsAccounts.map((s) => (
                    <div key={s.id} className={styles.item}>
                      <span className={styles.itemBadge}>{SAVINGS_TYPE_LABELS[s.type]}</span>
                      <span className={styles.itemTitle}>{s.title}</span>
                      <span className={styles.itemOwner}>{s.owner === "self" ? "본인" : "배우자"}</span>
                      <span className={styles.itemValue}>{formatMoney(s.currentBalance)}</span>
                    </div>
                  ))}
                </>
              )}
              {investmentAccounts.length > 0 && (
                <>
                  <div className={styles.itemGroupTitle}>투자</div>
                  {investmentAccounts.map((s) => (
                    <div key={s.id} className={styles.item}>
                      <span className={styles.itemBadge}>{INVESTMENT_TYPE_LABELS[s.type] || s.type}</span>
                      <span className={styles.itemTitle}>{s.title}</span>
                      <span className={styles.itemOwner}>{s.owner === "self" ? "본인" : "배우자"}</span>
                      <span className={styles.itemValue}>{formatMoney(s.currentBalance)}</span>
                    </div>
                  ))}
                </>
              )}
              {savingsAccounts.length === 0 && investmentAccounts.length === 0 && (
                <span className={styles.empty}>등록된 금융자산이 없습니다</span>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
