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

type TabType = "overview" | "income" | "expense" | "asset" | "debt" | "pension";

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
        {(["overview", "income", "expense", "asset", "debt"] as TabType[]).map(
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
    </div>
  );
}
