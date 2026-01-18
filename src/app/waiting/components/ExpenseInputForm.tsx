"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import type { HousingData, DebtItem } from "../types";
import { AmountInput } from "./inputs";
import styles from "./ExpenseInputForm.module.css";

// 생활비 카테고리
const LIVING_EXPENSE_CATEGORIES = [
  {
    key: "food",
    label: "식비",
    description: "외식비, 장보기, 배달음식 등"
  },
  {
    key: "transport",
    label: "교통비",
    description: "택시비, 기름값, 대중교통비 등"
  },
  {
    key: "shopping",
    label: "쇼핑/미용비",
    description: "옷, 전자기기, 생활용품, 헤어, 네일 등"
  },
  {
    key: "leisure",
    label: "유흥/여가비",
    description: "술자리, 카페, 영화, 취미활동 등"
  },
] as const;

export interface ExpenseFormData {
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

interface ExpenseInputFormProps {
  housingData: HousingData | null;
  debtData: DebtItem[];
  initialData?: ExpenseFormData | null;
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: ExpenseFormData) => Promise<void>;
  surveyMonthlyExpense?: string;
}

// 온보딩 응답 레이블
const EXPENSE_RANGE_LABELS: Record<string, string> = {
  under_150: "150만원 이하",
  "150_250": "150~250만원",
  "250_400": "250~400만원",
  "400_600": "400~600만원",
  over_600: "600만원 초과",
};

// 월 대출 상환액 계산 (원리금균등)
function calculateMonthlyPayment(
  balance: number,
  annualRate: number,
  remainingMonths: number = 60
): number {
  if (balance <= 0) return 0;
  if (annualRate === 0) return Math.round(balance / remainingMonths);

  const monthlyRate = annualRate / 100 / 12;
  const payment =
    (balance * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) /
    (Math.pow(1 + monthlyRate, remainingMonths) - 1);
  return Math.round(payment);
}

export function ExpenseInputForm({
  housingData,
  debtData,
  initialData,
  onClose,
  onSave,
  surveyMonthlyExpense,
}: ExpenseInputFormProps) {
  const [expenses, setExpenses] = useState<Record<string, number | null>>(() => ({
    food: initialData?.livingExpenseDetails?.food ?? null,
    transport: initialData?.livingExpenseDetails?.transport ?? null,
    shopping: initialData?.livingExpenseDetails?.shopping ?? null,
    leisure: initialData?.livingExpenseDetails?.leisure ?? null,
  }));
  const [saving, setSaving] = useState(false);

  // 총 생활비 계산
  const totalLivingExpense = Object.values(expenses).reduce<number>(
    (sum, val) => sum + (val ?? 0),
    0
  );

  const updateExpense = (key: string, value: number | null) => {
    setExpenses((prev) => ({ ...prev, [key]: value }));
  };

  // 자동 계산 항목 목록
  const autoExpenses: Array<{ label: string; amount: number }> = [];

  // 주거 관련 대출 상환
  if (housingData?.hasLoan && housingData.loanAmount && housingData.loanRate) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const maturityYear = housingData.loanMaturityYear ?? currentYear + 20;
    const maturityMonth = housingData.loanMaturityMonth ?? 12;
    const remainingMonths =
      (maturityYear - currentYear) * 12 + (maturityMonth - currentMonth);

    const monthlyPayment = calculateMonthlyPayment(
      housingData.loanAmount,
      housingData.loanRate,
      remainingMonths
    );

    if (monthlyPayment > 0) {
      const label = housingData.loanType === "mortgage" ? "주담대 상환" : "전세대출 상환";
      autoExpenses.push({ label, amount: monthlyPayment });
    }
  }

  // 월세
  if (housingData?.monthlyRent) {
    autoExpenses.push({ label: "월세", amount: housingData.monthlyRent });
  }

  // 관리비
  if (housingData?.maintenanceFee) {
    autoExpenses.push({ label: "관리비", amount: housingData.maintenanceFee });
  }

  // 부채/할부 상환
  for (const debt of debtData) {
    const monthlyPayment = calculateMonthlyPayment(
      debt.currentBalance ?? debt.principal,
      debt.interestRate,
      60
    );
    if (monthlyPayment > 0) {
      autoExpenses.push({ label: `${debt.title} 상환`, amount: monthlyPayment });
    }
  }

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        livingExpense: totalLivingExpense,
        livingExpenseDetails: {
          food: expenses.food ?? undefined,
          transport: expenses.transport ?? undefined,
          shopping: expenses.shopping ?? undefined,
          leisure: expenses.leisure ?? undefined,
        },
        fixedExpenses: [],
        variableExpenses: [],
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error("저장 실패 (Error):", error.message, error.stack);
      } else {
        console.error("저장 실패:", error, Object.keys(error as object));
      }
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onClose}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.headerTitle}>지출 정보</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          {/* 온보딩 힌트 */}
          {surveyMonthlyExpense && (
            <div className={styles.hintBox}>
              <span className={styles.hintLabel}>온보딩 응답</span>
              <span className={styles.hintValue}>
                월 생활비 {EXPENSE_RANGE_LABELS[surveyMonthlyExpense] || surveyMonthlyExpense}
              </span>
            </div>
          )}

          {/* 월 생활비 입력 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>월 변동 생활비</span>
              {totalLivingExpense > 0 && (
                <span className={styles.totalAmount}>
                  {formatMoney(totalLivingExpense)}
                </span>
              )}
            </div>
            <p className={styles.sectionHint}>
              매달 쓰는 실제 생활비를 항목별로 입력해주세요
            </p>

            <div className={styles.expenseList}>
              {LIVING_EXPENSE_CATEGORIES.map((category) => (
                <div key={category.key} className={styles.expenseRow}>
                  <div className={styles.expenseInfo}>
                    <span className={styles.expenseLabel}>{category.label}</span>
                    <span className={styles.expenseDesc}>{category.description}</span>
                  </div>
                  <AmountInput
                    value={expenses[category.key]}
                    onChange={(v) => updateExpense(category.key, v)}
                    showFormatted={false}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 자동 반영 항목 */}
          {autoExpenses.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>자동 반영</span>
                <span className={styles.badge}>거주/부채 연동</span>
              </div>
              <p className={styles.sectionHint}>
                위 생활비와 별도로 자동 계산됩니다
              </p>
              <div className={styles.autoList}>
                {autoExpenses.map((expense, index) => (
                  <div key={index} className={styles.autoRow}>
                    <span className={styles.autoLabel}>{expense.label}</span>
                    <span className={styles.autoAmount}>{formatMoney(expense.amount)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <div className={styles.bottomArea}>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
