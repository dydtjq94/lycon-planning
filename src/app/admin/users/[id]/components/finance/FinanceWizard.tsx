"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FamilyStep } from "./steps/FamilyStep";
import { IncomeStep } from "./steps/IncomeStep";
import { ExpenseStep } from "./steps/ExpenseStep";
import { SavingsStep } from "./steps/SavingsStep";
import { RealEstateStep } from "./steps/RealEstateStep";
import { DebtStep } from "./steps/DebtStep";
import { InsuranceStep } from "./steps/InsuranceStep";
import { PensionStep } from "./steps/PensionStep";
import styles from "./FinanceWizard.module.css";

interface FinanceWizardProps {
  userId: string;
  birthYear: number;
  retirementAge: number;
}

const STEPS = [
  { id: "family", label: "가계 정보" },
  { id: "income", label: "소득" },
  { id: "expense", label: "지출" },
  { id: "savings", label: "저축/투자" },
  { id: "realestate", label: "부동산" },
  { id: "debt", label: "부채" },
  { id: "insurance", label: "보험" },
  { id: "pension", label: "연금" },
];

export function FinanceWizard({ userId, birthYear, retirementAge }: FinanceWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 시뮬레이션 ID 가져오기 또는 생성
  useEffect(() => {
    const loadSimulation = async () => {
      const supabase = createClient();

      // 기존 시뮬레이션 찾기
      const { data: existing } = await supabase
        .from("simulations")
        .select("id")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        setSimulationId(existing.id);
      } else {
        // 새 시뮬레이션 생성
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

        if (newSim) {
          setSimulationId(newSim.id);
        }
      }

      setLoading(false);
    };

    loadSimulation();
  }, [userId, birthYear, retirementAge]);

  const handleNext = () => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (index: number) => {
    // 완료된 스텝이나 현재 스텝까지만 이동 가능
    if (index <= currentStep || completedSteps.has(index)) {
      setCurrentStep(index);
    }
  };

  if (loading || !simulationId) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const renderCurrentStep = () => {
    const stepProps = {
      userId,
      simulationId,
      birthYear,
      retirementAge,
    };

    switch (STEPS[currentStep].id) {
      case "family":
        return <FamilyStep {...stepProps} />;
      case "income":
        return <IncomeStep {...stepProps} />;
      case "expense":
        return <ExpenseStep {...stepProps} />;
      case "savings":
        return <SavingsStep {...stepProps} />;
      case "realestate":
        return <RealEstateStep {...stepProps} />;
      case "debt":
        return <DebtStep {...stepProps} />;
      case "insurance":
        return <InsuranceStep {...stepProps} />;
      case "pension":
        return <PensionStep {...stepProps} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.wizard}>
      {/* Progress Header */}
      <div className={styles.progressHeader}>
        <div className={styles.stepInfo}>
          <span className={styles.stepNumber}>{currentStep + 1}/{STEPS.length}</span>
          <span className={styles.stepLabel}>{STEPS[currentStep].label}</span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Indicators */}
      <div className={styles.stepIndicators}>
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.has(index);
          const isCurrent = index === currentStep;
          const isAccessible = index <= currentStep || isCompleted;

          return (
            <button
              key={step.id}
              className={`${styles.stepDot} ${isCurrent ? styles.current : ""} ${isCompleted ? styles.completed : ""}`}
              onClick={() => handleStepClick(index)}
              disabled={!isAccessible}
              title={step.label}
            >
              {isCompleted ? <Check size={12} /> : index + 1}
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <div className={styles.stepContent}>
        {renderCurrentStep()}
      </div>

      {/* Navigation */}
      <div className={styles.navigation}>
        <button
          className={styles.navButton}
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          <ChevronLeft size={18} />
          <span>이전</span>
        </button>

        {currentStep < STEPS.length - 1 ? (
          <button className={`${styles.navButton} ${styles.primary}`} onClick={handleNext}>
            <span>다음</span>
            <ChevronRight size={18} />
          </button>
        ) : (
          <button
            className={`${styles.navButton} ${styles.primary}`}
            onClick={() => setCompletedSteps((prev) => new Set([...prev, currentStep]))}
          >
            <Check size={18} />
            <span>완료</span>
          </button>
        )}
      </div>
    </div>
  );
}
