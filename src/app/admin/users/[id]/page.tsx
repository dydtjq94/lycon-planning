"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import styles from "../../admin.module.css";

interface Profile {
  id: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
  target_retirement_age: number;
  created_at: string;
  onboarding_step: string | null;
  prep_data: PrepData | null;
}

// --- prep_data 실제 타입 (InputForm에서 저장하는 구조) ---
interface PrepData {
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
}

interface PrepFamilyMember {
  relationship: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
}

// 소득 (IncomeFormData)
interface PrepIncomeData {
  selfLaborIncome: number;
  selfLaborFrequency: "monthly" | "yearly";
  spouseLaborIncome: number;
  spouseLaborFrequency: "monthly" | "yearly";
  additionalIncomes: Array<{
    type: string;
    owner: "self" | "spouse";
    amount: number;
    frequency: "monthly" | "yearly";
  }>;
}

// 지출 (ExpenseFormData)
interface PrepExpenseData {
  livingExpense: number;
  livingExpenseDetails?: {
    food?: number;
    transport?: number;
    shopping?: number;
    leisure?: number;
  };
  fixedExpenses: Array<{ type: string; title: string; amount: number; frequency: "monthly" | "yearly" }>;
  variableExpenses: Array<{ type: string; title: string; amount: number; frequency: "monthly" | "yearly" }>;
}

// 저축 (FinancialAssetItem)
interface PrepSavingsItem {
  category: string;
  type: string;
  title: string;
  owner: "self" | "spouse";
  currentBalance: number;
  monthlyDeposit?: number;
  expectedReturn?: number;
}

// 투자 (InvestmentAccountData)
interface PrepInvestmentData {
  securities?: {
    balance: number;
    investmentTypes: string[];
  };
  crypto?: {
    balance: number;
  };
  gold?: {
    balance: number;
  };
}

// 주거 (HousingData)
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
  loanRateType?: "fixed" | "floating";
  loanMaturityYear?: number;
  loanMaturityMonth?: number;
  loanRepaymentType?: string;
}

// 부채 (DebtItem)
interface PrepDebtItem {
  type: string;
  title: string;
  principal: number;
  currentBalance?: number;
  interestRate: number;
  monthlyPayment?: number;
}

// 국민(공적)연금 (NationalPensionData)
interface PrepNationalPensionData {
  selfType: string;
  selfExpectedAmount: number;
  spouseType: string;
  spouseExpectedAmount: number;
}

// 퇴직연금 (RetirementPensionData)
interface PrepRetirementPensionData {
  selfType: string;
  selfYearsWorked: number | null;
  selfBalance: number | null;
  spouseType: string;
  spouseYearsWorked: number | null;
  spouseBalance: number | null;
}

// 개인연금 (PersonalPensionItem)
interface PrepPersonalPensionItem {
  type: string;
  owner: "self" | "spouse";
  balance: number;
  monthlyDeposit: number;
}

interface FamilyMember {
  id: string;
  relationship: string;
  name: string;
  birth_date: string | null;
  is_working: boolean;
  monthly_income: number;
}

interface Income {
  id: string;
  type: string;
  title: string;
  owner: string;
  amount: number;
  frequency: string;
}

interface Expense {
  id: string;
  type: string;
  title: string;
  amount: number;
  frequency: string;
}

interface RealEstate {
  id: string;
  type: string;
  title: string;
  current_value: number;
  housing_type: string | null;
}

interface Saving {
  id: string;
  type: string;
  title: string;
  current_balance: number;
}

interface Debt {
  id: string;
  type: string;
  title: string;
  current_balance: number;
  interest_rate: number;
}

type TabType = "overview" | "income" | "expense" | "asset" | "debt" | "pension" | "prep";

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [realEstates, setRealEstates] = useState<RealEstate[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  useEffect(() => {
    const loadUserData = async () => {
      const supabase = createClient();

      // 프로필 조회
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // 가족 정보
      const { data: familyData } = await supabase
        .from("family_members")
        .select("*")
        .eq("user_id", userId);

      if (familyData) {
        setFamily(familyData);
      }

      // 시뮬레이션 ID 가져오기
      const { data: simulation } = await supabase
        .from("simulations")
        .select("id")
        .eq("profile_id", userId)
        .eq("is_default", true)
        .single();

      if (simulation) {
        // 소득
        const { data: incomeData } = await supabase
          .from("incomes")
          .select("*")
          .eq("simulation_id", simulation.id)
          .eq("is_active", true);
        if (incomeData) setIncomes(incomeData);

        // 지출
        const { data: expenseData } = await supabase
          .from("expenses")
          .select("*")
          .eq("simulation_id", simulation.id)
          .eq("is_active", true);
        if (expenseData) setExpenses(expenseData);

        // 부동산
        const { data: realEstateData } = await supabase
          .from("real_estates")
          .select("*")
          .eq("simulation_id", simulation.id)
          .eq("is_active", true);
        if (realEstateData) setRealEstates(realEstateData);

        // 저축/투자
        const { data: savingData } = await supabase
          .from("savings")
          .select("*")
          .eq("simulation_id", simulation.id)
          .eq("is_active", true);
        if (savingData) setSavings(savingData);

        // 부채
        const { data: debtData } = await supabase
          .from("debts")
          .select("*")
          .eq("simulation_id", simulation.id)
          .eq("is_active", true);
        if (debtData) setDebts(debtData);
      }

      setLoading(false);
    };

    loadUserData();
  }, [userId]);

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getRelationshipLabel = (rel: string) => {
    const labels: Record<string, string> = {
      spouse: "배우자",
      child: "자녀",
      parent: "부모",
    };
    return labels[rel] || rel;
  };

  const getIncomeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      salary: "근로소득",
      business: "사업소득",
      rental: "임대소득",
      pension: "연금소득",
      other: "기타소득",
    };
    return labels[type] || type;
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

  if (!profile) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.emptyState}>유저를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const totalMonthlyIncome = incomes
    .filter((i) => i.frequency === "monthly")
    .reduce((sum, i) => sum + i.amount, 0);

  const totalMonthlyExpense = expenses
    .filter((e) => e.frequency === "monthly")
    .reduce((sum, e) => sum + e.amount, 0);

  const totalAssets =
    realEstates.reduce((sum, r) => sum + r.current_value, 0) +
    savings.reduce((sum, s) => sum + s.current_balance, 0);

  const totalDebt = debts.reduce((sum, d) => sum + (d.current_balance || 0), 0);

  return (
    <div className={styles.dashboard}>
      {/* 헤더 */}
      <div className={styles.userDetailHeader}>
        <button className={styles.backButton} onClick={() => router.back()}>
          <ChevronLeft size={18} />
          뒤로
        </button>
        <h1 className={styles.userDetailTitle}>
          {profile.name}
          {getAge(profile.birth_date) && ` (${getAge(profile.birth_date)}세)`}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={styles.actionButton}
            onClick={() => router.push(`/admin/users/${userId}/edit`)}
          >
            편집
          </button>
          <button
            className={styles.actionButton}
            onClick={() => router.push(`/admin/chat/${userId}`)}
          >
            채팅하기
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabsContainer}>
        {(["overview", "income", "expense", "asset", "debt", "prep"] as TabType[]).map(
          (tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {{
                overview: "요약",
                income: "소득",
                expense: "지출",
                asset: "자산",
                debt: "부채",
                pension: "연금",
                prep: "입력해두기",
              }[tab]}
            </button>
          )
        )}
      </div>

      {/* 요약 탭 */}
      {activeTab === "overview" && (
        <>
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>월 소득</div>
              <div className={styles.statValue}>{formatMoney(totalMonthlyIncome)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>월 지출</div>
              <div className={styles.statValue}>{formatMoney(totalMonthlyExpense)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>총 자산</div>
              <div className={styles.statValue}>{formatMoney(totalAssets)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>총 부채</div>
              <div className={styles.statValue}>{formatMoney(totalDebt)}</div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>기본 정보</h2>
            </div>
            <div className={styles.dataGrid}>
              <div className={styles.dataCard}>
                <div className={styles.dataCardTitle}>본인</div>
                <div className={styles.dataItem}>
                  <span className={styles.dataLabel}>이름</span>
                  <span className={styles.dataValue}>{profile.name}</span>
                </div>
                <div className={styles.dataItem}>
                  <span className={styles.dataLabel}>생년월일</span>
                  <span className={styles.dataValue}>
                    {profile.birth_date || "-"}
                  </span>
                </div>
                <div className={styles.dataItem}>
                  <span className={styles.dataLabel}>목표 은퇴 나이</span>
                  <span className={styles.dataValue}>
                    {profile.target_retirement_age}세
                  </span>
                </div>
              </div>

              {family.length > 0 && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>가족</div>
                  {family.map((member) => (
                    <div key={member.id} className={styles.dataItem}>
                      <span className={styles.dataLabel}>
                        {getRelationshipLabel(member.relationship)}
                      </span>
                      <span className={styles.dataValue}>
                        {member.name}
                        {getAge(member.birth_date) &&
                          ` (${getAge(member.birth_date)}세)`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 소득 탭 */}
      {activeTab === "income" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>소득 목록</h2>
          </div>
          <div className={styles.dataGrid}>
            {incomes.length === 0 ? (
              <div className={styles.emptyState}>등록된 소득이 없습니다.</div>
            ) : (
              incomes.map((income) => (
                <div key={income.id} className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>
                    {getIncomeTypeLabel(income.type)}
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>항목</span>
                    <span className={styles.dataValue}>{income.title}</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>금액</span>
                    <span className={styles.dataValue}>
                      {formatMoney(income.amount)} /{" "}
                      {income.frequency === "monthly" ? "월" : "년"}
                    </span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>귀속</span>
                    <span className={styles.dataValue}>
                      {income.owner === "self" ? "본인" : "배우자"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 지출 탭 */}
      {activeTab === "expense" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>지출 목록</h2>
          </div>
          <div className={styles.dataGrid}>
            {expenses.length === 0 ? (
              <div className={styles.emptyState}>등록된 지출이 없습니다.</div>
            ) : (
              expenses.map((expense) => (
                <div key={expense.id} className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>{expense.type}</div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>항목</span>
                    <span className={styles.dataValue}>{expense.title}</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>금액</span>
                    <span className={styles.dataValue}>
                      {formatMoney(expense.amount)} /{" "}
                      {expense.frequency === "monthly" ? "월" : "년"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 자산 탭 */}
      {activeTab === "asset" && (
        <>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>부동산</h2>
            </div>
            <div className={styles.dataGrid}>
              {realEstates.length === 0 ? (
                <div className={styles.emptyState}>등록된 부동산이 없습니다.</div>
              ) : (
                realEstates.map((re) => (
                  <div key={re.id} className={styles.dataCard}>
                    <div className={styles.dataCardTitle}>{re.title}</div>
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>유형</span>
                      <span className={styles.dataValue}>
                        {re.housing_type || re.type}
                      </span>
                    </div>
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>현재 가치</span>
                      <span className={styles.dataValue}>
                        {formatMoney(re.current_value)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>금융자산</h2>
            </div>
            <div className={styles.dataGrid}>
              {savings.length === 0 ? (
                <div className={styles.emptyState}>등록된 금융자산이 없습니다.</div>
              ) : (
                savings.map((saving) => (
                  <div key={saving.id} className={styles.dataCard}>
                    <div className={styles.dataCardTitle}>{saving.title}</div>
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>유형</span>
                      <span className={styles.dataValue}>{saving.type}</span>
                    </div>
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>현재 잔액</span>
                      <span className={styles.dataValue}>
                        {formatMoney(saving.current_balance)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* 부채 탭 */}
      {activeTab === "debt" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>부채 목록</h2>
          </div>
          <div className={styles.dataGrid}>
            {debts.length === 0 ? (
              <div className={styles.emptyState}>등록된 부채가 없습니다.</div>
            ) : (
              debts.map((debt) => (
                <div key={debt.id} className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>{debt.title}</div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>유형</span>
                    <span className={styles.dataValue}>{debt.type}</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>잔액</span>
                    <span className={styles.dataValue}>
                      {formatMoney(debt.current_balance || 0)}
                    </span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>이자율</span>
                    <span className={styles.dataValue}>{debt.interest_rate}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 입력해두기 탭 */}
      {activeTab === "prep" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>대기실에서 입력해둔 정보</h2>
          </div>

          {!profile.prep_data || Object.keys(profile.prep_data).length === 0 ? (
            <div className={styles.emptyState}>입력해둔 정보가 없습니다.</div>
          ) : (
            <div className={styles.dataGrid}>
              {/* 가족 구성 */}
              {profile.prep_data.family && profile.prep_data.family.length > 0 && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>가족 구성</div>
                  {profile.prep_data.family.map((member, idx) => {
                    // birth_date: "2025-01-01" → "25.01.01" 형식
                    const formatBirthDate = (dateStr: string | null) => {
                      if (!dateStr) return "-";
                      const [year, month, day] = dateStr.split("-");
                      return `${year.slice(2)}.${month}.${day}`;
                    };
                    // 나이 계산
                    const calcAge = (dateStr: string | null) => {
                      if (!dateStr) return null;
                      const birthYear = parseInt(dateStr.split("-")[0]);
                      return new Date().getFullYear() - birthYear;
                    };
                    const age = calcAge(member.birth_date);
                    return (
                      <div key={idx} className={styles.dataItem}>
                        <span className={styles.dataLabel}>
                          {member.relationship === "self" ? "본인" :
                           member.relationship === "spouse" ? "배우자" :
                           member.relationship === "child" ? "자녀" :
                           member.relationship === "parent" ? "부양부모" : member.relationship}
                          {member.name && ` (${member.name})`}
                        </span>
                        <span className={styles.dataValue}>
                          {formatBirthDate(member.birth_date)}
                          {age !== null && ` (${age}세)`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 소득 (IncomeFormData 구조) */}
              {profile.prep_data.income && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>소득</div>
                  {/* 본인 근로소득 */}
                  {profile.prep_data.income.selfLaborIncome > 0 && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>본인 근로소득</span>
                      <span className={styles.dataValue}>
                        {formatMoney(profile.prep_data.income.selfLaborIncome)} / {profile.prep_data.income.selfLaborFrequency === "monthly" ? "월" : "년"}
                      </span>
                    </div>
                  )}
                  {/* 배우자 근로소득 */}
                  {profile.prep_data.income.spouseLaborIncome > 0 && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>배우자 근로소득</span>
                      <span className={styles.dataValue}>
                        {formatMoney(profile.prep_data.income.spouseLaborIncome)} / {profile.prep_data.income.spouseLaborFrequency === "monthly" ? "월" : "년"}
                      </span>
                    </div>
                  )}
                  {/* 추가 소득 */}
                  {profile.prep_data.income.additionalIncomes?.map((item, idx) => (
                    <div key={idx} className={styles.dataItem}>
                      <span className={styles.dataLabel}>
                        {item.owner === "self" ? "본인" : "배우자"} {item.type === "business" ? "사업소득" : item.type === "other" ? "기타소득" : item.type}
                      </span>
                      <span className={styles.dataValue}>
                        {formatMoney(item.amount)} / {item.frequency === "monthly" ? "월" : "년"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 지출 (ExpenseFormData 구조) */}
              {profile.prep_data.expense && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>지출</div>
                  {/* 월 생활비 총액 */}
                  {profile.prep_data.expense.livingExpense > 0 && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>월 변동 생활비</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.expense.livingExpense)} / 월</span>
                    </div>
                  )}
                  {/* 세부 항목 */}
                  {profile.prep_data.expense.livingExpenseDetails?.food && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>- 식비</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.expense.livingExpenseDetails.food)}</span>
                    </div>
                  )}
                  {profile.prep_data.expense.livingExpenseDetails?.transport && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>- 교통비</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.expense.livingExpenseDetails.transport)}</span>
                    </div>
                  )}
                  {profile.prep_data.expense.livingExpenseDetails?.shopping && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>- 쇼핑/미용비</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.expense.livingExpenseDetails.shopping)}</span>
                    </div>
                  )}
                  {profile.prep_data.expense.livingExpenseDetails?.leisure && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>- 유흥/여가비</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.expense.livingExpenseDetails.leisure)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 저축 (FinancialAssetItem[] 구조) */}
              {profile.prep_data.savings && profile.prep_data.savings.length > 0 && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>저축 계좌</div>
                  {profile.prep_data.savings.map((item, idx) => (
                    <div key={idx} className={styles.dataItem}>
                      <span className={styles.dataLabel}>
                        {item.title || `${item.owner === "self" ? "본인" : "배우자"} ${item.type === "checking" ? "입출금" : item.type === "savings" ? "적금" : item.type === "deposit" ? "정기예금" : item.type}`}
                      </span>
                      <span className={styles.dataValue}>
                        {formatMoney(item.currentBalance)}
                        {item.expectedReturn && ` (${item.expectedReturn}%)`}
                        {item.monthlyDeposit && ` / 월 ${formatMoney(item.monthlyDeposit)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 투자 (InvestmentAccountData 구조) */}
              {profile.prep_data.investment && (profile.prep_data.investment.securities || profile.prep_data.investment.crypto || profile.prep_data.investment.gold) && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>투자</div>
                  {profile.prep_data.investment.securities && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>
                        증권 계좌
                        {profile.prep_data.investment.securities.investmentTypes?.length > 0 &&
                          ` (${profile.prep_data.investment.securities.investmentTypes.map(t =>
                            t === "domestic_stock" ? "국내주식" :
                            t === "foreign_stock" ? "해외주식" :
                            t === "domestic_etf" ? "국내ETF" :
                            t === "foreign_etf" ? "해외ETF" :
                            t === "fund" ? "펀드" :
                            t === "bond" ? "채권" : t
                          ).join(", ")})`}
                      </span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.investment.securities.balance)}</span>
                    </div>
                  )}
                  {profile.prep_data.investment.crypto && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>코인 거래소</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.investment.crypto.balance)}</span>
                    </div>
                  )}
                  {profile.prep_data.investment.gold && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>금 현물</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.investment.gold.balance)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 주거 (HousingData 구조) */}
              {profile.prep_data.housing && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>거주용 부동산</div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>거주 형태</span>
                    <span className={styles.dataValue}>{profile.prep_data.housing.housingType}</span>
                  </div>
                  {profile.prep_data.housing.currentValue && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>현재 시세</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.housing.currentValue)}</span>
                    </div>
                  )}
                  {profile.prep_data.housing.deposit && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>보증금</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.housing.deposit)}</span>
                    </div>
                  )}
                  {profile.prep_data.housing.monthlyRent && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>월세</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.housing.monthlyRent)} / 월</span>
                    </div>
                  )}
                  {profile.prep_data.housing.maintenanceFee && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>관리비</span>
                      <span className={styles.dataValue}>{formatMoney(profile.prep_data.housing.maintenanceFee)} / 월</span>
                    </div>
                  )}
                  {profile.prep_data.housing.hasLoan && profile.prep_data.housing.loanAmount && (
                    <>
                      <div className={styles.dataItem}>
                        <span className={styles.dataLabel}>
                          {profile.prep_data.housing.loanType === "mortgage" ? "주담대 잔액" : "전세대출 잔액"}
                        </span>
                        <span className={styles.dataValue}>{formatMoney(profile.prep_data.housing.loanAmount)}</span>
                      </div>
                      {profile.prep_data.housing.loanRate && (
                        <div className={styles.dataItem}>
                          <span className={styles.dataLabel}>대출 금리</span>
                          <span className={styles.dataValue}>
                            {profile.prep_data.housing.loanRate}%
                            {profile.prep_data.housing.loanRateType && ` (${profile.prep_data.housing.loanRateType === "fixed" ? "고정" : "변동"})`}
                          </span>
                        </div>
                      )}
                      {profile.prep_data.housing.loanMaturityYear && (
                        <div className={styles.dataItem}>
                          <span className={styles.dataLabel}>대출 만기</span>
                          <span className={styles.dataValue}>
                            {profile.prep_data.housing.loanMaturityYear}년 {profile.prep_data.housing.loanMaturityMonth || 12}월
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 부채 (DebtItem[] 구조) */}
              {profile.prep_data.debt && profile.prep_data.debt.length > 0 && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>부채</div>
                  {profile.prep_data.debt.map((item, idx) => (
                    <div key={idx} className={styles.dataItem}>
                      <span className={styles.dataLabel}>{item.title || item.type}</span>
                      <span className={styles.dataValue}>
                        {formatMoney(item.currentBalance ?? item.principal)}
                        {item.interestRate > 0 && ` (${item.interestRate}%)`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 국민(공적)연금 (NationalPensionData 구조) */}
              {profile.prep_data.nationalPension && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>국민(공적)연금</div>
                  {profile.prep_data.nationalPension.selfExpectedAmount > 0 && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>
                        본인 ({profile.prep_data.nationalPension.selfType === "national" ? "국민연금" :
                              profile.prep_data.nationalPension.selfType === "government" ? "공무원연금" :
                              profile.prep_data.nationalPension.selfType === "military" ? "군인연금" :
                              profile.prep_data.nationalPension.selfType === "private_school" ? "사학연금" : profile.prep_data.nationalPension.selfType})
                      </span>
                      <span className={styles.dataValue}>월 {formatMoney(profile.prep_data.nationalPension.selfExpectedAmount)}</span>
                    </div>
                  )}
                  {profile.prep_data.nationalPension.spouseExpectedAmount > 0 && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>
                        배우자 ({profile.prep_data.nationalPension.spouseType === "national" ? "국민연금" :
                                profile.prep_data.nationalPension.spouseType === "government" ? "공무원연금" :
                                profile.prep_data.nationalPension.spouseType === "military" ? "군인연금" :
                                profile.prep_data.nationalPension.spouseType === "private_school" ? "사학연금" : profile.prep_data.nationalPension.spouseType})
                      </span>
                      <span className={styles.dataValue}>월 {formatMoney(profile.prep_data.nationalPension.spouseExpectedAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 퇴직연금 (RetirementPensionData 구조) */}
              {profile.prep_data.retirementPension && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>퇴직연금/퇴직금</div>
                  {/* 본인 */}
                  {profile.prep_data.retirementPension.selfType !== "none" && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>
                        본인 ({profile.prep_data.retirementPension.selfType === "db" ? "퇴직금/DB형" : "DC형"})
                      </span>
                      <span className={styles.dataValue}>
                        {profile.prep_data.retirementPension.selfType === "db" && profile.prep_data.retirementPension.selfYearsWorked
                          ? `근속 ${profile.prep_data.retirementPension.selfYearsWorked}년`
                          : profile.prep_data.retirementPension.selfBalance
                            ? formatMoney(profile.prep_data.retirementPension.selfBalance)
                            : "-"}
                      </span>
                    </div>
                  )}
                  {/* 배우자 */}
                  {profile.prep_data.retirementPension.spouseType !== "none" && (
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>
                        배우자 ({profile.prep_data.retirementPension.spouseType === "db" ? "퇴직금/DB형" : "DC형"})
                      </span>
                      <span className={styles.dataValue}>
                        {profile.prep_data.retirementPension.spouseType === "db" && profile.prep_data.retirementPension.spouseYearsWorked
                          ? `근속 ${profile.prep_data.retirementPension.spouseYearsWorked}년`
                          : profile.prep_data.retirementPension.spouseBalance
                            ? formatMoney(profile.prep_data.retirementPension.spouseBalance)
                            : "-"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 개인연금 (PersonalPensionItem[] 구조) */}
              {profile.prep_data.personalPension && profile.prep_data.personalPension.length > 0 && (
                <div className={styles.dataCard}>
                  <div className={styles.dataCardTitle}>개인연금</div>
                  {profile.prep_data.personalPension.map((item, idx) => (
                    <div key={idx} className={styles.dataItem}>
                      <span className={styles.dataLabel}>
                        {item.owner === "self" ? "본인" : "배우자"} {item.type === "pension_savings" ? "연금저축" : item.type === "irp" ? "IRP" : item.type}
                      </span>
                      <span className={styles.dataValue}>
                        {formatMoney(item.balance)}
                        {item.monthlyDeposit > 0 && ` / 월 ${formatMoney(item.monthlyDeposit)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
