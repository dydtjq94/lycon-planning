"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/utils";
import {
  getFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  FamilyMember,
  RELATIONSHIP_LABELS,
} from "@/lib/services/familyService";
import { getRealEstates, createRealEstate, deleteRealEstate } from "@/lib/services/realEstateService";
import { getSavings, createSavings, deleteSavings } from "@/lib/services/savingsService";
import { getDebts, createDebt, deleteDebt, getDefaultMaturity } from "@/lib/services/debtService";
import { getIncomes, createIncome, deleteIncome, INCOME_TYPE_LABELS } from "@/lib/services/incomeService";
import { getExpenses, createExpense, deleteExpense, EXPENSE_TYPE_LABELS } from "@/lib/services/expenseService";
import { getNationalPensions, createNationalPension, deleteNationalPension } from "@/lib/services/nationalPensionService";
import { getRetirementPensions, createRetirementPension, deleteRetirementPension } from "@/lib/services/retirementPensionService";
import { getPersonalPensions, createPersonalPension, deletePersonalPension } from "@/lib/services/personalPensionService";
import type {
  RealEstate,
  Savings,
  Debt,
  Income,
  Expense,
  NationalPension,
  RetirementPension,
  PersonalPension,
  Owner,
  IncomeType,
  ExpenseType,
} from "@/types/tables";
import styles from "./RetirementDiagnosisForm.module.css";

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
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("고객님");

  // Section 1: 가계 정보
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: "",
    relationship: "spouse" as "spouse" | "child" | "parent",
    birth_date: "",
    gender: "male" as "male" | "female",
  });

  // Section 2: 자산 (금융 자산 제외)
  const [realEstates, setRealEstates] = useState<RealEstate[]>([]);
  const [addingRealEstate, setAddingRealEstate] = useState(false);
  const [realEstateForm, setRealEstateForm] = useState({
    type: "residence" as RealEstate["type"],
    title: "",
    value: 0,
    loan: 0,
    owner: "self" as Owner,
  });

  // Section 3: 부채
  const [debts, setDebts] = useState<Debt[]>([]);
  const [addingDebt, setAddingDebt] = useState(false);
  const [debtForm, setDebtForm] = useState({
    type: "mortgage" as Debt["type"],
    title: "",
    balance: 0,
    rate: 4.0,
  });

  // Section 4: 소득/지출
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [addingIncome, setAddingIncome] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    type: "labor" as IncomeType,
    owner: "self" as "self" | "spouse",
    title: "",
    amount: 0,
  });
  const [expenseForm, setExpenseForm] = useState({
    type: "living" as ExpenseType,
    title: "",
    amount: 0,
  });

  // Section 5: 연금
  const [nationalPensions, setNationalPensions] = useState<NationalPension[]>([]);
  const [retirementPensions, setRetirementPensions] = useState<RetirementPension[]>([]);
  const [personalPensions, setPersonalPensions] = useState<PersonalPension[]>([]);
  const [addingPension, setAddingPension] = useState<"national" | "retirement" | "personal" | null>(null);
  const [pensionForm, setPensionForm] = useState({
    category: "national" as "national" | "retirement" | "personal",
    type: "national" as string,
    amount: 0,
    owner: "self" as Owner,
    startAge: 65,
  });

  // Section 6: 금융자산
  const [savings, setSavings] = useState<Savings[]>([]);
  const [addingSavings, setAddingSavings] = useState<"savings" | "investment" | null>(null);
  const [savingsForm, setSavingsForm] = useState({
    type: "savings" as Savings["type"],
    title: "",
    balance: 0,
    owner: "self" as Owner,
  });

  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentAge = currentYear - birthYear;

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();

      // Get customer name
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .single();
      if (profile?.name) {
        setCustomerName(profile.name);
      }

      // Get or create simulation
      const { data: existing } = await supabase
        .from("simulations")
        .select("id")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let simId: string;
      if (existing) {
        simId = existing.id;
      } else {
        const { data: newSim } = await supabase
          .from("simulations")
          .insert({
            profile_id: userId,
            name: "기본 시뮬레이션",
            birth_year: birthYear,
            retirement_age: retirementAge,
          })
          .select("id")
          .single();
        simId = newSim!.id;
      }
      setSimulationId(simId);

      // Load all data in parallel
      const [
        familyData,
        realEstatesData,
        debtsData,
        incomesData,
        expensesData,
        nationalPensionsData,
        retirementPensionsData,
        personalPensionsData,
        savingsData,
      ] = await Promise.all([
        getFamilyMembers(userId),
        getRealEstates(simId),
        getDebts(simId),
        getIncomes(simId),
        getExpenses(simId),
        getNationalPensions(simId),
        getRetirementPensions(simId),
        getPersonalPensions(simId),
        getSavings(simId),
      ]);

      setFamilyMembers(familyData);
      setRealEstates(realEstatesData);
      setDebts(debtsData);
      setIncomes(incomesData);
      setExpenses(expensesData);
      setNationalPensions(nationalPensionsData);
      setRetirementPensions(retirementPensionsData);
      setPersonalPensions(personalPensionsData);
      setSavings(savingsData);

      setLoading(false);
    };

    loadData();
  }, [userId, birthYear, retirementAge]);

  // Helper functions
  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const getBirthYear = (birthDate: string | null) => {
    if (!birthDate) return null;
    return new Date(birthDate).getFullYear();
  };

  // Section 1: Family handlers
  const handleSaveMember = async () => {
    if (!memberForm.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      if (editingMember) {
        await updateFamilyMember(editingMember.id, {
          name: memberForm.name,
          relationship: memberForm.relationship,
          birth_date: memberForm.birth_date || null,
          gender: memberForm.gender,
        });
      } else {
        await createFamilyMember({
          user_id: userId,
          name: memberForm.name,
          relationship: memberForm.relationship,
          birth_date: memberForm.birth_date || null,
          gender: memberForm.gender,
          is_dependent: memberForm.relationship === "child" || memberForm.relationship === "parent",
          is_working: memberForm.relationship === "spouse",
          retirement_age: memberForm.relationship === "spouse" ? 60 : null,
          monthly_income: 0,
          notes: null,
        });
      }
      const updated = await getFamilyMembers(userId);
      setFamilyMembers(updated);
      setFamilyModalOpen(false);
      setEditingMember(null);
      resetMemberForm();
    } catch (error) {
      console.error("Error saving member:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (member: FamilyMember) => {
    if (!confirm(`${member.name}을(를) 삭제하시겠습니까?`)) return;
    await deleteFamilyMember(member.id);
    const updated = await getFamilyMembers(userId);
    setFamilyMembers(updated);
  };

  const resetMemberForm = () => {
    setMemberForm({
      name: "",
      relationship: "spouse",
      birth_date: "",
      gender: "male",
    });
  };

  // Section 2: Real Estate handlers
  const handleSaveRealEstate = async () => {
    if (!simulationId || !realEstateForm.title.trim()) {
      alert("명칭을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await createRealEstate({
        simulation_id: simulationId,
        type: realEstateForm.type,
        title: realEstateForm.title,
        current_value: realEstateForm.value,
        loan_amount: realEstateForm.loan || null,
        owner: realEstateForm.owner,
      });
      const updated = await getRealEstates(simulationId);
      setRealEstates(updated);
      setAddingRealEstate(false);
      setRealEstateForm({ type: "residence", title: "", value: 0, loan: 0, owner: "self" });
    } catch (error) {
      console.error("Error saving real estate:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRealEstate = async (id: string) => {
    if (!simulationId || !confirm("삭제하시겠습니까?")) return;
    await deleteRealEstate(id);
    const updated = await getRealEstates(simulationId);
    setRealEstates(updated);
  };

  // Section 3: Debt handlers
  const handleSaveDebt = async () => {
    if (!simulationId || !debtForm.title.trim()) {
      alert("명칭을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const maturity = getDefaultMaturity();
      await createDebt({
        simulation_id: simulationId,
        type: debtForm.type,
        title: debtForm.title,
        principal: debtForm.balance,
        current_balance: debtForm.balance,
        interest_rate: debtForm.rate,
        repayment_type: "원리금균등상환",
        start_year: currentYear,
        start_month: currentMonth,
        maturity_year: maturity.year,
        maturity_month: maturity.month,
      });
      const updated = await getDebts(simulationId);
      setDebts(updated);
      setAddingDebt(false);
      setDebtForm({ type: "mortgage", title: "", balance: 0, rate: 4.0 });
    } catch (error) {
      console.error("Error saving debt:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDebt = async (id: string) => {
    if (!simulationId || !confirm("삭제하시겠습니까?")) return;
    await deleteDebt(id);
    const updated = await getDebts(simulationId);
    setDebts(updated);
  };

  // Section 4: Income/Expense handlers
  const handleSaveIncome = async () => {
    if (!simulationId || !incomeForm.title.trim()) {
      alert("명칭을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await createIncome({
        simulation_id: simulationId,
        type: incomeForm.type,
        owner: incomeForm.owner,
        title: incomeForm.title,
        amount: incomeForm.amount,
        frequency: "monthly",
        start_year: currentYear,
        start_month: currentMonth,
        end_year: currentYear + (retirementAge - currentAge),
        end_month: currentMonth,
        is_fixed_to_retirement: true,
        growth_rate: 3.0,
        rate_category: "income",
      });
      const updated = await getIncomes(simulationId);
      setIncomes(updated);
      setAddingIncome(false);
      setIncomeForm({ type: "labor", owner: "self", title: "", amount: 0 });
    } catch (error) {
      console.error("Error saving income:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIncome = async (id: string) => {
    if (!simulationId || !confirm("삭제하시겠습니까?")) return;
    await deleteIncome(id);
    const updated = await getIncomes(simulationId);
    setIncomes(updated);
  };

  const handleSaveExpense = async () => {
    if (!simulationId || !expenseForm.title.trim()) {
      alert("명칭을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await createExpense({
        simulation_id: simulationId,
        type: expenseForm.type,
        title: expenseForm.title,
        amount: expenseForm.amount,
        frequency: "monthly",
        start_year: currentYear,
        start_month: currentMonth,
        end_year: currentYear + (retirementAge - currentAge),
        end_month: currentMonth,
        is_fixed_to_retirement: true,
        growth_rate: 2.5,
        rate_category: "inflation",
      });
      const updated = await getExpenses(simulationId);
      setExpenses(updated);
      setAddingExpense(false);
      setExpenseForm({ type: "living", title: "", amount: 0 });
    } catch (error) {
      console.error("Error saving expense:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!simulationId || !confirm("삭제하시겠습니까?")) return;
    await deleteExpense(id);
    const updated = await getExpenses(simulationId);
    setExpenses(updated);
  };

  // Section 5: Pension handlers
  const handleSavePension = async () => {
    if (!simulationId) return;
    setSaving(true);
    try {
      if (addingPension === "national") {
        await createNationalPension(
          {
            simulation_id: simulationId,
            owner: pensionForm.owner,
            pension_type: pensionForm.type as NationalPension["pension_type"],
            expected_monthly_amount: pensionForm.amount,
            start_age: pensionForm.startAge,
            end_age: null,
          },
          birthYear
        );
        const updated = await getNationalPensions(simulationId);
        setNationalPensions(updated);
      } else if (addingPension === "retirement") {
        await createRetirementPension(
          {
            simulation_id: simulationId,
            owner: pensionForm.owner,
            pension_type: pensionForm.type as RetirementPension["pension_type"],
            current_balance: pensionForm.amount,
            receive_type: "lump_sum",
          },
          birthYear,
          retirementAge
        );
        const updated = await getRetirementPensions(simulationId);
        setRetirementPensions(updated);
      } else if (addingPension === "personal") {
        await createPersonalPension(
          {
            simulation_id: simulationId,
            owner: pensionForm.owner,
            pension_type: pensionForm.type as PersonalPension["pension_type"],
            current_balance: pensionForm.amount,
          },
          birthYear,
          retirementAge
        );
        const updated = await getPersonalPensions(simulationId);
        setPersonalPensions(updated);
      }
      setAddingPension(null);
      setPensionForm({ category: "national", type: "national", amount: 0, owner: "self", startAge: 65 });
    } catch (error) {
      console.error("Error saving pension:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNationalPension = async (id: string) => {
    if (!simulationId || !confirm("삭제하시겠습니까?")) return;
    await deleteNationalPension(id);
    const updated = await getNationalPensions(simulationId);
    setNationalPensions(updated);
  };

  const handleDeleteRetirementPension = async (id: string) => {
    if (!simulationId || !confirm("삭제하시겠습니까?")) return;
    await deleteRetirementPension(id);
    const updated = await getRetirementPensions(simulationId);
    setRetirementPensions(updated);
  };

  const handleDeletePersonalPension = async (id: string) => {
    if (!simulationId || !confirm("삭제하시겠습니까?")) return;
    await deletePersonalPension(id);
    const updated = await getPersonalPensions(simulationId);
    setPersonalPensions(updated);
  };

  // Section 6: Financial Assets handlers
  const handleSaveSavings = async () => {
    if (!simulationId || !savingsForm.title.trim()) {
      alert("명칭을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await createSavings({
        simulation_id: simulationId,
        type: savingsForm.type,
        title: savingsForm.title,
        current_balance: savingsForm.balance,
        owner: savingsForm.owner,
      });
      const updated = await getSavings(simulationId);
      setSavings(updated);
      setAddingSavings(null);
      setSavingsForm({ type: "savings", title: "", balance: 0, owner: "self" });
    } catch (error) {
      console.error("Error saving savings:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSavings = async (id: string) => {
    if (!simulationId || !confirm("삭제하시겠습니까?")) return;
    await deleteSavings(id);
    const updated = await getSavings(simulationId);
    setSavings(updated);
  };

  // Type labels
  const REAL_ESTATE_TYPE_LABELS: Record<string, string> = {
    residence: "거주용",
    investment: "투자용",
    rental: "임대용",
    land: "토지",
  };

  const DEBT_TYPE_LABELS: Record<string, string> = {
    mortgage: "주택담보대출",
    jeonse: "전세자금대출",
    credit: "신용대출",
    car: "자동차대출",
    student: "학자금대출",
    card: "카드론",
    other: "기타",
  };

  const NATIONAL_PENSION_TYPE_LABELS: Record<string, string> = {
    national: "국민연금",
    government: "공무원연금",
    military: "군인연금",
    private_school: "사학연금",
  };

  const RETIREMENT_PENSION_TYPE_LABELS: Record<string, string> = {
    severance: "퇴직금",
    db: "DB형",
    dc: "DC형",
    corporate_irp: "기업IRP",
  };

  const PERSONAL_PENSION_TYPE_LABELS: Record<string, string> = {
    pension_savings: "연금저축",
    irp: "개인IRP",
    isa: "ISA",
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

  // Derived values
  const spouse = familyMembers.find((m) => m.relationship === "spouse");
  const children = familyMembers.filter((m) => m.relationship === "child");
  const parents = familyMembers.filter((m) => m.relationship === "parent");
  const hasSpouse = !!spouse;

  const totalRealEstateValue = realEstates.reduce((sum, re) => sum + re.current_value, 0);
  const totalRealEstateLoan = realEstates.reduce((sum, re) => sum + (re.loan_amount || 0), 0);
  const totalDebt = debts.reduce((sum, d) => sum + (d.current_balance || d.principal), 0);
  const totalMonthlyIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalMonthlyExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const savingsAccounts = savings.filter((s) => ["checking", "savings", "deposit"].includes(s.type));
  const investmentAccounts = savings.filter((s) => !["checking", "savings", "deposit"].includes(s.type));
  const totalSavings = savingsAccounts.reduce((sum, s) => sum + s.current_balance, 0);
  const totalInvestments = investmentAccounts.reduce((sum, s) => sum + s.current_balance, 0);

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

      {/* Section 1: 가계 정보 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>1. 가계 정보</h2>
          <button
            className={styles.editButton}
            onClick={() => {
              setFamilyModalOpen(true);
              resetMemberForm();
              setEditingMember(null);
            }}
          >
            수정
          </button>
        </div>
        <div className={styles.sectionContent}>
          <div className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>이름</span>
              <span className={styles.infoValue}>{customerName}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>생년</span>
              <span className={styles.infoValue}>{birthYear}년</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>현재 나이</span>
              <span className={styles.infoValue}>{currentAge}세</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>배우자</span>
              <span className={styles.infoValue}>
                {spouse
                  ? `있음 (${getBirthYear(spouse.birth_date)}년생, ${getAge(spouse.birth_date)}세)`
                  : "없음"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>자녀</span>
              <span className={styles.infoValue}>
                {children.length > 0
                  ? `${children.length}명 (${children.map((c) => `${getAge(c.birth_date)}세`).join(", ")})`
                  : "없음"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>부양가족</span>
              <span className={styles.infoValue}>
                {parents.length > 0
                  ? `${parents.length}명 (${parents.map((p) => `${p.name} ${getAge(p.birth_date)}세`).join(", ")})`
                  : "없음"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: 자산 파악 (금융 자산 제외) */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>2. 자산 파악 (금융 자산 제외)</h2>
          <div className={styles.sectionActions}>
            {totalRealEstateValue > 0 && (
              <span className={styles.sectionSummary}>
                총 {formatMoney(totalRealEstateValue)}
                {totalRealEstateLoan > 0 && ` (담보대출 ${formatMoney(totalRealEstateLoan)})`}
              </span>
            )}
            <button className={styles.headerAddBtn} onClick={() => setAddingRealEstate(true)}>
              <Plus size={12} /> 추가
            </button>
          </div>
        </div>
        <div className={styles.sectionContent}>
          <div className={styles.itemList}>
            {realEstates.map((re) => (
              <div key={re.id} className={styles.item}>
                <span className={styles.itemType}>{REAL_ESTATE_TYPE_LABELS[re.type]}</span>
                <span className={styles.itemTitle}>{re.title}</span>
                <span className={styles.itemValue}>{formatMoney(re.current_value)}</span>
                {re.loan_amount && re.loan_amount > 0 && (
                  <span className={styles.itemSub}>대출 {formatMoney(re.loan_amount)}</span>
                )}
                <span className={styles.itemOwner}>
                  {re.owner === "self" ? "본인" : re.owner === "spouse" ? "배우자" : "공동"}
                </span>
                <button className={styles.deleteBtn} onClick={() => handleDeleteRealEstate(re.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {realEstates.length === 0 && !addingRealEstate && (
              <span className={styles.emptyText}>등록된 부동산이 없습니다</span>
            )}
          </div>

          {addingRealEstate && (
            <div className={styles.addForm}>
              <select
                className={styles.select}
                value={realEstateForm.type}
                onChange={(e) => setRealEstateForm({ ...realEstateForm, type: e.target.value as RealEstate["type"] })}
              >
                {Object.entries(REAL_ESTATE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                type="text"
                className={styles.input}
                placeholder="명칭 (예: 아파트)"
                value={realEstateForm.title}
                onChange={(e) => setRealEstateForm({ ...realEstateForm, title: e.target.value })}
              />
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="시세"
                  value={realEstateForm.value || ""}
                  onChange={(e) => setRealEstateForm({ ...realEstateForm, value: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="담보대출"
                  value={realEstateForm.loan || ""}
                  onChange={(e) => setRealEstateForm({ ...realEstateForm, loan: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
              <select
                className={styles.selectSmall}
                value={realEstateForm.owner}
                onChange={(e) => setRealEstateForm({ ...realEstateForm, owner: e.target.value as Owner })}
              >
                <option value="self">본인</option>
                <option value="spouse">배우자</option>
                <option value="joint">공동</option>
              </select>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setAddingRealEstate(false)}>취소</button>
                <button className={styles.saveBtn} onClick={handleSaveRealEstate} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 3: 부채 파악 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>3. 부채 파악</h2>
          <div className={styles.sectionActions}>
            {totalDebt > 0 && <span className={styles.sectionSummary}>총 {formatMoney(totalDebt)}</span>}
            <button className={styles.headerAddBtn} onClick={() => setAddingDebt(true)}>
              <Plus size={12} /> 추가
            </button>
          </div>
        </div>
        <div className={styles.sectionContent}>
          <div className={styles.itemList}>
            {debts.map((d) => (
              <div key={d.id} className={styles.item}>
                <span className={styles.itemType}>{DEBT_TYPE_LABELS[d.type]}</span>
                <span className={styles.itemTitle}>{d.title}</span>
                <span className={styles.itemValue}>{formatMoney(d.current_balance || d.principal)}</span>
                <span className={styles.itemSub}>{d.interest_rate}%</span>
                <button className={styles.deleteBtn} onClick={() => handleDeleteDebt(d.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {debts.length === 0 && !addingDebt && (
              <span className={styles.emptyText}>등록된 부채가 없습니다</span>
            )}
          </div>

          {addingDebt && (
            <div className={styles.addForm}>
              <select
                className={styles.select}
                value={debtForm.type}
                onChange={(e) => setDebtForm({ ...debtForm, type: e.target.value as Debt["type"] })}
              >
                {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                type="text"
                className={styles.input}
                placeholder="명칭"
                value={debtForm.title}
                onChange={(e) => setDebtForm({ ...debtForm, title: e.target.value })}
              />
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="잔액"
                  value={debtForm.balance || ""}
                  onChange={(e) => setDebtForm({ ...debtForm, balance: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="금리"
                  value={debtForm.rate || ""}
                  onChange={(e) => setDebtForm({ ...debtForm, rate: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  step="0.1"
                />
                <span className={styles.unit}>%</span>
              </div>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setAddingDebt(false)}>취소</button>
                <button className={styles.saveBtn} onClick={handleSaveDebt} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 4: 소득/지출 파악 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>4. 소득/지출 파악</h2>
          <span className={styles.sectionSummary}>
            월 수입 {formatMoney(totalMonthlyIncome)} / 지출 {formatMoney(totalMonthlyExpense)}
          </span>
        </div>
        <div className={styles.sectionContent}>
          {/* 소득 */}
          <div className={styles.subHeader}>
            <h3 className={styles.subTitle}>소득</h3>
            <button className={styles.subAddBtn} onClick={() => setAddingIncome(true)}>
              <Plus size={12} /> 추가
            </button>
          </div>
          <div className={styles.itemList}>
            {incomes.map((i) => (
              <div key={i.id} className={styles.item}>
                <span className={styles.itemType}>{INCOME_TYPE_LABELS[i.type]}</span>
                <span className={styles.itemTitle}>{i.title}</span>
                <span className={styles.itemValue}>{formatMoney(i.amount)}/월</span>
                <span className={styles.itemOwner}>{i.owner === "self" ? "본인" : "배우자"}</span>
                <button className={styles.deleteBtn} onClick={() => handleDeleteIncome(i.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {incomes.length === 0 && !addingIncome && (
              <span className={styles.emptyText}>등록된 소득이 없습니다</span>
            )}
          </div>

          {addingIncome && (
            <div className={styles.addForm}>
              <select
                className={styles.select}
                value={incomeForm.type}
                onChange={(e) => setIncomeForm({ ...incomeForm, type: e.target.value as IncomeType })}
              >
                {Object.entries(INCOME_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                className={styles.selectSmall}
                value={incomeForm.owner}
                onChange={(e) => setIncomeForm({ ...incomeForm, owner: e.target.value as "self" | "spouse" })}
              >
                <option value="self">본인</option>
                <option value="spouse">배우자</option>
              </select>
              <input
                type="text"
                className={styles.input}
                placeholder="명칭"
                value={incomeForm.title}
                onChange={(e) => setIncomeForm({ ...incomeForm, title: e.target.value })}
              />
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="금액"
                  value={incomeForm.amount || ""}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원/월</span>
              </div>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setAddingIncome(false)}>취소</button>
                <button className={styles.saveBtn} onClick={handleSaveIncome} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}

          {/* 지출 */}
          <div className={styles.subHeader}>
            <h3 className={styles.subTitle}>지출</h3>
            <button className={styles.subAddBtn} onClick={() => setAddingExpense(true)}>
              <Plus size={12} /> 추가
            </button>
          </div>
          <div className={styles.itemList}>
            {expenses.map((e) => (
              <div key={e.id} className={styles.item}>
                <span className={styles.itemType}>{EXPENSE_TYPE_LABELS[e.type]}</span>
                <span className={styles.itemTitle}>{e.title}</span>
                <span className={styles.itemValue}>{formatMoney(e.amount)}/월</span>
                <button className={styles.deleteBtn} onClick={() => handleDeleteExpense(e.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {expenses.length === 0 && !addingExpense && (
              <span className={styles.emptyText}>등록된 지출이 없습니다</span>
            )}
          </div>

          {addingExpense && (
            <div className={styles.addForm}>
              <select
                className={styles.select}
                value={expenseForm.type}
                onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value as ExpenseType })}
              >
                {Object.entries(EXPENSE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                type="text"
                className={styles.input}
                placeholder="명칭"
                value={expenseForm.title}
                onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              />
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="금액"
                  value={expenseForm.amount || ""}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원/월</span>
              </div>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setAddingExpense(false)}>취소</button>
                <button className={styles.saveBtn} onClick={handleSaveExpense} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 5: 연금 현황 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>5. 연금 현황</h2>
        </div>
        <div className={styles.sectionContent}>
          {/* 공적연금 */}
          <div className={styles.subHeader}>
            <h3 className={styles.subTitle}>공적연금 (국민연금, 공무원연금 등)</h3>
            <button className={styles.subAddBtn} onClick={() => { setAddingPension("national"); setPensionForm({ ...pensionForm, type: "national", category: "national" }); }}>
              <Plus size={12} /> 추가
            </button>
          </div>
          <div className={styles.itemList}>
            {nationalPensions.map((np) => (
              <div key={np.id} className={styles.item}>
                <span className={styles.itemType}>{NATIONAL_PENSION_TYPE_LABELS[np.pension_type || "national"]}</span>
                <span className={styles.itemTitle}>{np.start_age}세부터</span>
                <span className={styles.itemValue}>월 {formatMoney(np.expected_monthly_amount)}</span>
                <span className={styles.itemOwner}>{np.owner === "self" ? "본인" : "배우자"}</span>
                <button className={styles.deleteBtn} onClick={() => handleDeleteNationalPension(np.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {nationalPensions.length === 0 && addingPension !== "national" && (
              <span className={styles.emptyText}>등록된 공적연금이 없습니다</span>
            )}
          </div>
          {addingPension === "national" && (
            <div className={styles.addForm}>
              <select
                className={styles.select}
                value={pensionForm.type}
                onChange={(e) => setPensionForm({ ...pensionForm, type: e.target.value })}
              >
                {Object.entries(NATIONAL_PENSION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                className={styles.selectSmall}
                value={pensionForm.owner}
                onChange={(e) => setPensionForm({ ...pensionForm, owner: e.target.value as Owner })}
              >
                <option value="self">본인</option>
                <option value="spouse">배우자</option>
              </select>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="예상 월 수령액"
                  value={pensionForm.amount || ""}
                  onChange={(e) => setPensionForm({ ...pensionForm, amount: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원/월</span>
              </div>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="수령 시작 나이"
                  value={pensionForm.startAge || ""}
                  onChange={(e) => setPensionForm({ ...pensionForm, startAge: Number(e.target.value) || 65 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>세</span>
              </div>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setAddingPension(null)}>취소</button>
                <button className={styles.saveBtn} onClick={handleSavePension} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}

          {/* 퇴직연금/퇴직금 */}
          <div className={styles.subHeader}>
            <h3 className={styles.subTitle}>퇴직연금/퇴직금</h3>
            <button className={styles.subAddBtn} onClick={() => { setAddingPension("retirement"); setPensionForm({ ...pensionForm, type: "severance", category: "retirement" }); }}>
              <Plus size={12} /> 추가
            </button>
          </div>
          <div className={styles.itemList}>
            {retirementPensions.map((rp) => (
              <div key={rp.id} className={styles.item}>
                <span className={styles.itemType}>{RETIREMENT_PENSION_TYPE_LABELS[rp.pension_type]}</span>
                <span className={styles.itemTitle}>{rp.receive_type === "lump_sum" ? "일시금" : "연금"}</span>
                <span className={styles.itemValue}>
                  {rp.current_balance ? formatMoney(rp.current_balance) : `${rp.years_of_service}년`}
                </span>
                <span className={styles.itemOwner}>{rp.owner === "self" ? "본인" : "배우자"}</span>
                <button className={styles.deleteBtn} onClick={() => handleDeleteRetirementPension(rp.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {retirementPensions.length === 0 && addingPension !== "retirement" && (
              <span className={styles.emptyText}>등록된 퇴직연금이 없습니다</span>
            )}
          </div>
          {addingPension === "retirement" && (
            <div className={styles.addForm}>
              <select
                className={styles.select}
                value={pensionForm.type}
                onChange={(e) => setPensionForm({ ...pensionForm, type: e.target.value })}
              >
                {Object.entries(RETIREMENT_PENSION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                className={styles.selectSmall}
                value={pensionForm.owner}
                onChange={(e) => setPensionForm({ ...pensionForm, owner: e.target.value as Owner })}
              >
                <option value="self">본인</option>
                <option value="spouse">배우자</option>
              </select>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="현재 적립금"
                  value={pensionForm.amount || ""}
                  onChange={(e) => setPensionForm({ ...pensionForm, amount: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setAddingPension(null)}>취소</button>
                <button className={styles.saveBtn} onClick={handleSavePension} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}

          {/* 개인연금 (연금저축, IRP, ISA) */}
          <div className={styles.subHeader}>
            <h3 className={styles.subTitle}>개인연금 (연금저축, IRP, ISA)</h3>
            <button className={styles.subAddBtn} onClick={() => { setAddingPension("personal"); setPensionForm({ ...pensionForm, type: "pension_savings", category: "personal" }); }}>
              <Plus size={12} /> 추가
            </button>
          </div>
          <div className={styles.itemList}>
            {personalPensions.map((pp) => (
              <div key={pp.id} className={styles.item}>
                <span className={styles.itemType}>{PERSONAL_PENSION_TYPE_LABELS[pp.pension_type]}</span>
                <span className={styles.itemValue}>{formatMoney(pp.current_balance)}</span>
                <span className={styles.itemOwner}>{pp.owner === "self" ? "본인" : "배우자"}</span>
                <button className={styles.deleteBtn} onClick={() => handleDeletePersonalPension(pp.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {personalPensions.length === 0 && addingPension !== "personal" && (
              <span className={styles.emptyText}>등록된 개인연금이 없습니다</span>
            )}
          </div>
          {addingPension === "personal" && (
            <div className={styles.addForm}>
              <select
                className={styles.select}
                value={pensionForm.type}
                onChange={(e) => setPensionForm({ ...pensionForm, type: e.target.value })}
              >
                {Object.entries(PERSONAL_PENSION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                className={styles.selectSmall}
                value={pensionForm.owner}
                onChange={(e) => setPensionForm({ ...pensionForm, owner: e.target.value as Owner })}
              >
                <option value="self">본인</option>
                <option value="spouse">배우자</option>
              </select>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="현재 적립금"
                  value={pensionForm.amount || ""}
                  onChange={(e) => setPensionForm({ ...pensionForm, amount: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setAddingPension(null)}>취소</button>
                <button className={styles.saveBtn} onClick={handleSavePension} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 6: 금융자산 파악 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>6. 금융자산 파악</h2>
          {totalSavings + totalInvestments > 0 && (
            <span className={styles.sectionSummary}>총 {formatMoney(totalSavings + totalInvestments)}</span>
          )}
        </div>
        <div className={styles.sectionContent}>
          {/* 저축 계좌 */}
          <div className={styles.subHeader}>
            <h3 className={styles.subTitle}>저축 계좌 (예금, 적금)</h3>
            <button className={styles.subAddBtn} onClick={() => { setAddingSavings("savings"); setSavingsForm({ ...savingsForm, type: "savings" }); }}>
              <Plus size={12} /> 추가
            </button>
          </div>
          <div className={styles.itemList}>
            {savingsAccounts.map((s) => (
              <div key={s.id} className={styles.item}>
                <span className={styles.itemType}>{SAVINGS_TYPE_LABELS[s.type]}</span>
                <span className={styles.itemTitle}>{s.title}</span>
                <span className={styles.itemValue}>{formatMoney(s.current_balance)}</span>
                <span className={styles.itemOwner}>{s.owner === "self" ? "본인" : "배우자"}</span>
                <button className={styles.deleteBtn} onClick={() => handleDeleteSavings(s.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {savingsAccounts.length === 0 && addingSavings !== "savings" && (
              <span className={styles.emptyText}>등록된 저축 계좌가 없습니다</span>
            )}
          </div>
          {addingSavings === "savings" && (
            <div className={styles.addForm}>
              <select
                className={styles.select}
                value={savingsForm.type}
                onChange={(e) => setSavingsForm({ ...savingsForm, type: e.target.value as Savings["type"] })}
              >
                {Object.entries(SAVINGS_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                type="text"
                className={styles.input}
                placeholder="명칭"
                value={savingsForm.title}
                onChange={(e) => setSavingsForm({ ...savingsForm, title: e.target.value })}
              />
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="잔액"
                  value={savingsForm.balance || ""}
                  onChange={(e) => setSavingsForm({ ...savingsForm, balance: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
              <select
                className={styles.selectSmall}
                value={savingsForm.owner}
                onChange={(e) => setSavingsForm({ ...savingsForm, owner: e.target.value as Owner })}
              >
                <option value="self">본인</option>
                <option value="spouse">배우자</option>
              </select>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setAddingSavings(null)}>취소</button>
                <button className={styles.saveBtn} onClick={handleSaveSavings} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}

          {/* 투자 계좌 */}
          <div className={styles.subHeader}>
            <h3 className={styles.subTitle}>투자 계좌 (주식, 펀드, 코인, 금 등)</h3>
            <button className={styles.subAddBtn} onClick={() => { setAddingSavings("investment"); setSavingsForm({ ...savingsForm, type: "domestic_stock" }); }}>
              <Plus size={12} /> 추가
            </button>
          </div>
          <div className={styles.itemList}>
            {investmentAccounts.map((s) => (
              <div key={s.id} className={styles.item}>
                <span className={styles.itemType}>{INVESTMENT_TYPE_LABELS[s.type] || s.type}</span>
                <span className={styles.itemTitle}>{s.title}</span>
                <span className={styles.itemValue}>{formatMoney(s.current_balance)}</span>
                <span className={styles.itemOwner}>{s.owner === "self" ? "본인" : "배우자"}</span>
                <button className={styles.deleteBtn} onClick={() => handleDeleteSavings(s.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {investmentAccounts.length === 0 && addingSavings !== "investment" && (
              <span className={styles.emptyText}>등록된 투자 계좌가 없습니다</span>
            )}
          </div>
          {addingSavings === "investment" && (
            <div className={styles.addForm}>
              <select
                className={styles.select}
                value={savingsForm.type}
                onChange={(e) => setSavingsForm({ ...savingsForm, type: e.target.value as Savings["type"] })}
              >
                {Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                type="text"
                className={styles.input}
                placeholder="명칭"
                value={savingsForm.title}
                onChange={(e) => setSavingsForm({ ...savingsForm, title: e.target.value })}
              />
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.inputSmall}
                  placeholder="잔액"
                  value={savingsForm.balance || ""}
                  onChange={(e) => setSavingsForm({ ...savingsForm, balance: Number(e.target.value) || 0 })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원</span>
              </div>
              <select
                className={styles.selectSmall}
                value={savingsForm.owner}
                onChange={(e) => setSavingsForm({ ...savingsForm, owner: e.target.value as Owner })}
              >
                <option value="self">본인</option>
                <option value="spouse">배우자</option>
              </select>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setAddingSavings(null)}>취소</button>
                <button className={styles.saveBtn} onClick={handleSaveSavings} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Family Edit Modal */}
      {familyModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setFamilyModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>가계 정보 수정</h2>
              <button className={styles.modalCloseBtn} onClick={() => setFamilyModalOpen(false)} type="button">
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Current members list */}
              <div className={styles.memberList}>
                <h4 className={styles.memberListTitle}>가구원 목록</h4>
                {familyMembers.map((member) => (
                  <div key={member.id} className={styles.memberItem}>
                    <div className={styles.memberInfo}>
                      <span className={`${styles.memberBadge} ${styles[member.relationship]}`}>
                        {RELATIONSHIP_LABELS[member.relationship as keyof typeof RELATIONSHIP_LABELS]}
                      </span>
                      <span className={styles.memberName}>{member.name}</span>
                      {member.birth_date && (
                        <span className={styles.memberAge}>({getAge(member.birth_date)}세)</span>
                      )}
                    </div>
                    <div className={styles.memberActions}>
                      <button
                        className={styles.memberActionBtn}
                        onClick={() => {
                          setEditingMember(member);
                          setMemberForm({
                            name: member.name,
                            relationship: member.relationship as "spouse" | "child" | "parent",
                            birth_date: member.birth_date || "",
                            gender: (member.gender || "male") as "male" | "female",
                          });
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={`${styles.memberActionBtn} ${styles.delete}`}
                        onClick={() => handleDeleteMember(member)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add member buttons */}
              <div className={styles.addMemberSection}>
                <h4 className={styles.addMemberTitle}>가구원 추가</h4>
                <div className={styles.addMemberButtons}>
                  {!hasSpouse && (
                    <button
                      className={styles.addMemberBtn}
                      onClick={() => {
                        setEditingMember(null);
                        setMemberForm({ name: "", relationship: "spouse", birth_date: "", gender: "male" });
                      }}
                    >
                      <Plus size={14} />
                      <span>배우자 추가</span>
                    </button>
                  )}
                  <button
                    className={styles.addMemberBtn}
                    onClick={() => {
                      setEditingMember(null);
                      setMemberForm({ name: "", relationship: "child", birth_date: "", gender: "male" });
                    }}
                  >
                    <Plus size={14} />
                    <span>자녀 추가</span>
                  </button>
                  <button
                    className={styles.addMemberBtn}
                    onClick={() => {
                      setEditingMember(null);
                      setMemberForm({ name: "", relationship: "parent", birth_date: "", gender: "male" });
                    }}
                  >
                    <Plus size={14} />
                    <span>부모님 추가</span>
                  </button>
                </div>
              </div>

              {/* Edit/Add form */}
              {(editingMember || memberForm.name !== "" || memberForm.relationship !== "spouse") && (
                <div className={styles.memberForm}>
                  <h4 className={styles.formTitle}>
                    {editingMember ? "정보 수정" : "새 가구원"}
                  </h4>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>관계</label>
                    <select
                      className={styles.formSelect}
                      value={memberForm.relationship}
                      onChange={(e) => setMemberForm({ ...memberForm, relationship: e.target.value as "spouse" | "child" | "parent" })}
                    >
                      <option value="spouse" disabled={hasSpouse && editingMember?.relationship !== "spouse"}>배우자</option>
                      <option value="child">자녀</option>
                      <option value="parent">부모님</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>이름</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={memberForm.name}
                      onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                      placeholder="이름 입력"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>생년월일</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={memberForm.birth_date}
                      onChange={(e) => setMemberForm({ ...memberForm, birth_date: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>성별</label>
                    <div className={styles.genderButtons}>
                      <button
                        type="button"
                        className={`${styles.genderBtn} ${memberForm.gender === "male" ? styles.selected : ""}`}
                        onClick={() => setMemberForm({ ...memberForm, gender: "male" })}
                      >
                        남성
                      </button>
                      <button
                        type="button"
                        className={`${styles.genderBtn} ${memberForm.gender === "female" ? styles.selected : ""}`}
                        onClick={() => setMemberForm({ ...memberForm, gender: "female" })}
                      >
                        여성
                      </button>
                    </div>
                  </div>

                  <div className={styles.formActions}>
                    <button
                      className={styles.cancelBtn}
                      onClick={() => {
                        setEditingMember(null);
                        resetMemberForm();
                      }}
                    >
                      취소
                    </button>
                    <button className={styles.saveBtn} onClick={handleSaveMember} disabled={saving}>
                      {saving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
