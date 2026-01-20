"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Income,
  Expense,
  Savings,
  RealEstate,
  Debt,
  Insurance,
  NationalPension,
  RetirementPension,
  PersonalPension,
} from "@/types/tables";
import { IncomeSection } from "./sections/IncomeSection";
import { ExpenseSection } from "./sections/ExpenseSection";
import { SavingsSection } from "./sections/SavingsSection";
import { RealEstateSection } from "./sections/RealEstateSection";
import { DebtSection } from "./sections/DebtSection";
import { InsuranceSection } from "./sections/InsuranceSection";
import { PensionSection } from "./sections/PensionSection";
import styles from "./FinanceManager.module.css";

interface FinanceManagerProps {
  userId: string;
  birthYear: number;
  retirementAge: number;
}

export function FinanceManager({
  userId,
  birthYear,
  retirementAge,
}: FinanceManagerProps) {
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 재무 데이터 상태
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [savings, setSavings] = useState<Savings[]>([]);
  const [realEstates, setRealEstates] = useState<RealEstate[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [nationalPensions, setNationalPensions] = useState<NationalPension[]>([]);
  const [retirementPensions, setRetirementPensions] = useState<RetirementPension[]>([]);
  const [personalPensions, setPersonalPensions] = useState<PersonalPension[]>([]);

  // 시뮬레이션 ID 가져오기
  useEffect(() => {
    const fetchSimulationId = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("simulations")
        .select("id")
        .eq("profile_id", userId)
        .eq("is_default", true)
        .single();

      if (data) {
        setSimulationId(data.id);
      } else {
        // 시뮬레이션이 없으면 생성
        const { data: newSim } = await supabase
          .from("simulations")
          .insert({
            profile_id: userId,
            title: "기본 시뮬레이션",
            is_default: true,
          })
          .select("id")
          .single();

        if (newSim) {
          setSimulationId(newSim.id);
        }
      }
    };

    fetchSimulationId();
  }, [userId]);

  // 모든 재무 데이터 로드
  const loadAllData = useCallback(async () => {
    if (!simulationId) return;

    setLoading(true);
    const supabase = createClient();

    try {
      const [
        incomeRes,
        expenseRes,
        savingsRes,
        realEstateRes,
        debtRes,
        insuranceRes,
        nationalRes,
        retirementRes,
        personalRes,
      ] = await Promise.all([
        supabase.from("incomes").select("*").eq("simulation_id", simulationId).eq("is_active", true).order("sort_order"),
        supabase.from("expenses").select("*").eq("simulation_id", simulationId).eq("is_active", true).order("sort_order"),
        supabase.from("savings").select("*").eq("simulation_id", simulationId).eq("is_active", true).order("sort_order"),
        supabase.from("real_estates").select("*").eq("simulation_id", simulationId).eq("is_active", true).order("sort_order"),
        supabase.from("debts").select("*").eq("simulation_id", simulationId).eq("is_active", true).order("sort_order"),
        supabase.from("insurances").select("*").eq("simulation_id", simulationId).eq("is_active", true).order("sort_order"),
        supabase.from("national_pensions").select("*").eq("simulation_id", simulationId).eq("is_active", true).order("owner"),
        supabase.from("retirement_pensions").select("*").eq("simulation_id", simulationId).eq("is_active", true).order("owner"),
        supabase.from("personal_pensions").select("*").eq("simulation_id", simulationId).eq("is_active", true).order("owner"),
      ]);

      if (incomeRes.data) setIncomes(incomeRes.data);
      if (expenseRes.data) setExpenses(expenseRes.data);
      if (savingsRes.data) setSavings(savingsRes.data);
      if (realEstateRes.data) setRealEstates(realEstateRes.data);
      if (debtRes.data) setDebts(debtRes.data);
      if (insuranceRes.data) setInsurances(insuranceRes.data);
      if (nationalRes.data) setNationalPensions(nationalRes.data);
      if (retirementRes.data) setRetirementPensions(retirementRes.data);
      if (personalRes.data) setPersonalPensions(personalRes.data);
    } catch (error) {
      console.error("Failed to load finance data:", error);
    } finally {
      setLoading(false);
    }
  }, [simulationId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  if (!simulationId) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>시뮬레이션 준비 중...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>재무 데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.sections}>
        <IncomeSection
          incomes={incomes}
          simulationId={simulationId}
          onUpdate={loadAllData}
        />

        <ExpenseSection
          expenses={expenses}
          simulationId={simulationId}
          onUpdate={loadAllData}
        />

        <SavingsSection
          savings={savings}
          simulationId={simulationId}
          onUpdate={loadAllData}
        />

        <RealEstateSection
          realEstates={realEstates}
          simulationId={simulationId}
          onUpdate={loadAllData}
        />

        <DebtSection
          debts={debts}
          simulationId={simulationId}
          onUpdate={loadAllData}
        />

        <InsuranceSection
          insurances={insurances}
          simulationId={simulationId}
          onUpdate={loadAllData}
        />

        <PensionSection
          nationalPensions={nationalPensions}
          retirementPensions={retirementPensions}
          personalPensions={personalPensions}
          simulationId={simulationId}
          birthYear={birthYear}
          retirementAge={retirementAge}
          onUpdate={loadAllData}
        />
      </div>
    </div>
  );
}
