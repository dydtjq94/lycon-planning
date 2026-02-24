"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useChartTheme } from "@/hooks/useChartTheme";
import { createClient } from "@/lib/supabase/client";
import {
  StepFamily,
  StepRetirement,
  StepIncome,
  StepExpense,
  StepEvents,
  StepAssetReview,
  WIZARD_STEPS,
  INITIAL_WIZARD_DATA,
} from "./wizard";
import type { WizardData } from "./wizard";
import type { ProfileBasics, FamilyMember } from "@/contexts/FinancialContext";
import styles from "./NewSimulationModal.module.css";

interface NewSimulationModalProps {
  onClose: () => void;
  onCreate: (wizardData: WizardData) => void;
  profile: ProfileBasics;
  familyMembers: FamilyMember[];
}

export function NewSimulationModal({
  onClose,
  onCreate,
  profile,
  familyMembers,
}: NewSimulationModalProps) {
  const { isDark } = useChartTheme();
  const [step, setStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>(() => {
    // Pre-populate family data from existing profile
    const spouse = familyMembers.find((fm) => fm.relationship === "spouse");
    const children = familyMembers
      .filter((fm) => fm.relationship === "child")
      .map((fm) => ({
        name: fm.name,
        birthDate: fm.birth_date || "",
        gender: fm.gender,
      }));

    return {
      ...INITIAL_WIZARD_DATA,
      family: {
        ...INITIAL_WIZARD_DATA.family,
        hasSpouse: !!spouse,
        spouseName: spouse?.name || "",
        spouseBirthDate: spouse?.birth_date || "",
        spouseGender: spouse?.gender || null,
        children,
      },
      retirement: {
        ...INITIAL_WIZARD_DATA.retirement,
        retirementAge: profile.target_retirement_age || null,
        lifeExpectancy: 100,
        spouseIsWorking: spouse?.is_working ?? false,
        spouseRetirementAge: spouse?.retirement_age || null,
        spouseLifeExpectancy: spouse ? 100 : null,
      },
    };
  });

  // prep_data에서 온보딩 데이터 로드 (admin이 입력해둔 데이터)
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("prep_data")
      .eq("id", profile.id)
      .single()
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prep = data?.prep_data as Record<string, any> | null;
        if (!prep) return;

        const updates: Partial<WizardData> = {};

        // 소득
        const prepIncome = prep.income;
        if (prepIncome) {
          type WizardIncomeItem = WizardData["income"]["items"][number];
          const incomeItems: WizardIncomeItem[] = [];

          if (prepIncome.selfLaborIncome > 0) {
            incomeItems.push({
              title: "본인 급여",
              type: "labor",
              owner: "self",
              amount: prepIncome.selfLaborIncome,
              frequency: prepIncome.selfLaborFrequency || "monthly",
              retirementLinked: true,
            });
          }
          if (prepIncome.spouseLaborIncome > 0) {
            incomeItems.push({
              title: "배우자 급여",
              type: "labor",
              owner: "spouse",
              amount: prepIncome.spouseLaborIncome,
              frequency: prepIncome.spouseLaborFrequency || "monthly",
              retirementLinked: true,
            });
          }
          if (prepIncome.additionalIncomes) {
            for (const add of prepIncome.additionalIncomes) {
              if (add.amount > 0) {
                incomeItems.push({
                  title: `${add.owner === "self" ? "본인" : "배우자"} ${add.type === "business" ? "사업소득" : "기타소득"}`,
                  type: add.type === "business" ? "business" : "other",
                  owner: add.owner,
                  amount: add.amount,
                  frequency: add.frequency || "monthly",
                  retirementLinked: true,
                });
              }
            }
          }
          if (incomeItems.length > 0) {
            updates.income = { items: incomeItems };
          }
        }

        // 지출
        const prepExpense = prep.expense;
        if (prepExpense) {
          let livingTotal = prepExpense.livingExpense || 0;
          if (!livingTotal && prepExpense.livingExpenseDetails) {
            const d = prepExpense.livingExpenseDetails;
            livingTotal = (d.food || 0) + (d.transport || 0) + (d.shopping || 0) + (d.leisure || 0) + (d.other || 0);
          }

          let fixedTotal = 0;
          if (prepExpense.fixedExpenses) {
            for (const e of prepExpense.fixedExpenses) {
              if (e.amount > 0) {
                fixedTotal += e.frequency === "yearly" ? Math.round(e.amount / 12) : e.amount;
              }
            }
          }

          updates.expense = {
            livingExpense: livingTotal > 0 ? livingTotal : null,
            fixedExpense: fixedTotal > 0 ? fixedTotal : null,
            postRetirementRate: 0.7,
            autoMedical: true,
            autoEducation: true,
            educationTier: 'normal',
          };
        }

        // 연금 (공적연금만)
        const prepNational = prep.nationalPension;
        if (prepNational) {
          updates.pension = {
            selfType: prepNational.selfType || "national",
            selfExpectedAmount: prepNational.selfExpectedAmount || null,
            selfStartAge: prepNational.selfStartAge || 65,
            spouseType: prepNational.spouseType || "national",
            spouseExpectedAmount: prepNational.spouseExpectedAmount || null,
            spouseStartAge: prepNational.spouseStartAge || null,
          };
        }

        if (Object.keys(updates).length > 0) {
          setWizardData((prev) => ({ ...prev, ...updates }));
        }
      });
  }, [profile.id]);
  const [animKey, setAnimKey] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleWizardChange = (updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
      setAnimKey((k) => k + 1);
    }
  };

  const handleNext = () => {
    if (step < WIZARD_STEPS.length - 1) {
      setStep(step + 1);
      setAnimKey((k) => k + 1);
    }
  };

  const handleSkip = () => {
    if (step < WIZARD_STEPS.length - 1) {
      setStep(step + 1);
      setAnimKey((k) => k + 1);
    }
  };

  const handleCreate = () => {
    onCreate(wizardData);
    onClose();
  };

  const isLastStep = step === WIZARD_STEPS.length - 1;

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Step 0에서 자동 포커스
  useEffect(() => {
    if (step === 0 && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [step]);

  const renderStepContent = () => {
    const props = { data: wizardData, onChange: handleWizardChange };
    switch (step) {
      case 0:
        return (
          <div className={styles.titleStep}>
            <label className={styles.titleLabel}>
              시뮬레이션 이름을 입력하세요
            </label>
            <input
              ref={titleInputRef}
              type="text"
              className={styles.titleInput}
              value={wizardData.title}
              onChange={(e) =>
                setWizardData((prev) => ({ ...prev, title: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleNext();
                }
              }}
              placeholder="예: 내 집 마련, 조기 은퇴, 자녀 교육"
              autoFocus
            />
            <p className={styles.titleDescription}>
              앞으로 몇 단계에 걸쳐 미래를 설계하기 위한 핵심 정보를 입력합니다. 입력한 내용은 언제든지 수정할 수 있습니다.
            </p>
          </div>
        );
      case 1:
        return <StepFamily {...props} userGender={profile.gender} />;
      case 2:
        return <StepRetirement {...props} />;
      case 3:
        return <StepIncome {...props} />;
      case 4:
        return <StepExpense {...props} profileBirthDate={profile.birth_date} />;
      case 5:
        return <StepEvents {...props} profileBirthDate={profile.birth_date ?? ""} />;
      case 6:
        return <StepAssetReview {...props} profileId={profile.id} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
    >
      <div
        className={styles.modal}
        style={{
          background: isDark
            ? "rgba(34, 37, 41, 0.6)"
            : "rgba(255, 255, 255, 0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
        }}
      >
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h2 className={styles.title}>{wizardData.title.trim() || "새 시뮬레이션"}</h2>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <div className={styles.stepIndicator}>
            {WIZARD_STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`${styles.stepDot} ${i === step ? styles.stepDotActive : ""} ${i < step ? styles.stepDotCompleted : ""}`}
              />
            ))}
          </div>
          <div className={styles.stepLabel}>
            {WIZARD_STEPS[step].label}
          </div>
        </div>

        <div className={styles.body} ref={contentRef}>
          <div key={animKey} className={styles.stepContent}>
            {renderStepContent()}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {step > 0 && (
              <button className={styles.prevBtn} onClick={handlePrev}>
                이전
              </button>
            )}
          </div>
          <div className={styles.footerRight}>
            {!isLastStep && (
              <>
                {step > 0 && (
                  <button className={styles.skipBtn} onClick={handleSkip}>
                    건너뛰기
                  </button>
                )}
                <button
                  className={styles.nextBtn}
                  onClick={handleNext}
                  disabled={false}
                >
                  다음
                </button>
              </>
            )}
            {isLastStep && (
              <button className={styles.createBtn} onClick={handleCreate}>
                만들기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
