"use client";

import { useState, useEffect } from "react";
import { formatMoney } from "@/lib/utils";
import {
  getIncomes,
  createIncome,
  updateIncome,
  deleteIncome,
  INCOME_TYPE_LABELS,
} from "@/lib/services/incomeService";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  EXPENSE_TYPE_LABELS,
} from "@/lib/services/expenseService";
import type { Income, Expense, IncomeType, ExpenseType } from "@/types/tables";
import styles from "./CashFlowSection.module.css";

interface CashFlowSectionProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
  onDataChange?: (data: CashFlowData) => void;
}

export interface CashFlowData {
  totalMonthlyIncome: number;
  totalMonthlyExpense: number;
  monthlySavings: number;
  savingsRate: number;
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
}

interface IncomeItem {
  id?: string;
  type: IncomeType;
  label: string;
  amount: number;
}

interface ExpenseItem {
  id?: string;
  type: ExpenseType;
  label: string;
  amount: number;
}

// 기타 수입 타입
const OTHER_INCOME_TYPES: { type: IncomeType; label: string }[] = [
  { type: "business", label: "사업소득" },
  { type: "rental", label: "임대소득" },
  { type: "other", label: "기타소득" },
];

// 선택 지출 타입
const OPTIONAL_EXPENSE_TYPES: { type: ExpenseType; label: string }[] = [
  { type: "transport", label: "차량" },
  { type: "parents", label: "부모님" },
  { type: "travel", label: "여가" },
  { type: "other", label: "기타" },
];

export function CashFlowSection({
  userId,
  simulationId,
  birthYear,
  retirementAge,
  onDataChange,
}: CashFlowSectionProps) {
  const [loading, setLoading] = useState(true);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Income state
  const [selfLabor, setSelfLabor] = useState(0);
  const [spouseLabor, setSpouseLabor] = useState(0);
  const [otherIncomes, setOtherIncomes] = useState<IncomeItem[]>([]);

  // Expense state
  const [living, setLiving] = useState(0);
  const [housing, setHousing] = useState(0);
  const [education, setEducation] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [optionalExpenses, setOptionalExpenses] = useState<ExpenseItem[]>([]);

  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [incomesData, expensesData] = await Promise.all([
          getIncomes(simulationId),
          getExpenses(simulationId),
        ]);

        setIncomes(incomesData);
        setExpenses(expensesData);

        // Parse incomes
        const selfLaborIncome = incomesData.find(
          (i) => i.type === "labor" && i.owner === "self"
        );
        const spouseLaborIncome = incomesData.find(
          (i) => i.type === "labor" && i.owner === "spouse"
        );
        const otherIncomesData = incomesData.filter(
          (i) => !(i.type === "labor" && (i.owner === "self" || i.owner === "spouse"))
        );

        setSelfLabor(selfLaborIncome?.amount || 0);
        setSpouseLabor(spouseLaborIncome?.amount || 0);
        setOtherIncomes(
          otherIncomesData.map((i) => ({
            id: i.id,
            type: i.type,
            label: INCOME_TYPE_LABELS[i.type],
            amount: i.amount,
          }))
        );

        // Parse expenses
        const livingExpense = expensesData.find((e) => e.type === "living");
        const housingExpense = expensesData.find((e) => e.type === "housing");
        const educationExpense = expensesData.find((e) => e.type === "education");
        const insuranceExpense = expensesData.find((e) => e.type === "insurance");
        const optionalExpensesData = expensesData.filter(
          (e) =>
            !["living", "housing", "education", "insurance"].includes(e.type)
        );

        setLiving(livingExpense?.amount || 0);
        setHousing(housingExpense?.amount || 0);
        setEducation(educationExpense?.amount || 0);
        setInsurance(insuranceExpense?.amount || 0);
        setOptionalExpenses(
          optionalExpensesData.map((e) => ({
            id: e.id,
            type: e.type,
            label: EXPENSE_TYPE_LABELS[e.type],
            amount: e.amount,
          }))
        );
      } catch (error) {
        console.error("Failed to load cash flow data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [simulationId]);

  // Calculate totals
  const totalMonthlyIncome =
    selfLabor +
    spouseLabor +
    otherIncomes.reduce((sum, item) => sum + item.amount, 0);

  const totalMonthlyExpense =
    living +
    housing +
    education +
    insurance +
    optionalExpenses.reduce((sum, item) => sum + item.amount, 0);

  const monthlySavings = totalMonthlyIncome - totalMonthlyExpense;
  const savingsRate =
    totalMonthlyIncome > 0
      ? Math.round((monthlySavings / totalMonthlyIncome) * 100 * 10) / 10
      : 0;

  // Notify parent
  useEffect(() => {
    if (onDataChange) {
      onDataChange({
        totalMonthlyIncome,
        totalMonthlyExpense,
        monthlySavings,
        savingsRate,
        incomes: [
          ...(selfLabor > 0
            ? [{ type: "labor" as IncomeType, label: "본인 근로소득", amount: selfLabor }]
            : []),
          ...(spouseLabor > 0
            ? [{ type: "labor" as IncomeType, label: "배우자 근로소득", amount: spouseLabor }]
            : []),
          ...otherIncomes,
        ],
        expenses: [
          ...(living > 0
            ? [{ type: "living" as ExpenseType, label: "생활비", amount: living }]
            : []),
          ...(housing > 0
            ? [{ type: "housing" as ExpenseType, label: "주거비", amount: housing }]
            : []),
          ...(education > 0
            ? [{ type: "education" as ExpenseType, label: "교육비", amount: education }]
            : []),
          ...(insurance > 0
            ? [{ type: "insurance" as ExpenseType, label: "보험료", amount: insurance }]
            : []),
          ...optionalExpenses,
        ],
      });
    }
  }, [
    selfLabor,
    spouseLabor,
    otherIncomes,
    living,
    housing,
    education,
    insurance,
    optionalExpenses,
    totalMonthlyIncome,
    totalMonthlyExpense,
    monthlySavings,
    savingsRate,
    onDataChange,
  ]);

  // Handlers for incomes
  const handleSelfLaborChange = async (value: number) => {
    setSelfLabor(value);
    await saveIncome("labor", "self", "본인 근로소득", value);
  };

  const handleSpouseLaborChange = async (value: number) => {
    setSpouseLabor(value);
    await saveIncome("labor", "spouse", "배우자 근로소득", value);
  };

  const handleAddOtherIncome = (type: IncomeType, label: string) => {
    setOtherIncomes([...otherIncomes, { type, label, amount: 0 }]);
  };

  const handleOtherIncomeChange = async (index: number, amount: number) => {
    const updated = [...otherIncomes];
    updated[index].amount = amount;
    setOtherIncomes(updated);

    const item = updated[index];
    await saveIncome(item.type, "self", item.label, amount, item.id);
  };

  const handleRemoveOtherIncome = async (index: number) => {
    const item = otherIncomes[index];
    if (item.id) {
      await deleteIncome(item.id);
    }
    setOtherIncomes(otherIncomes.filter((_, i) => i !== index));
  };

  // Handlers for expenses
  const handleLivingChange = async (value: number) => {
    setLiving(value);
    await saveExpense("living", "생활비 (식비, 공과금 등)", value);
  };

  const handleHousingChange = async (value: number) => {
    setHousing(value);
    await saveExpense("housing", "주거비 (월세/관리비)", value);
  };

  const handleEducationChange = async (value: number) => {
    setEducation(value);
    await saveExpense("education", "교육비", value);
  };

  const handleInsuranceChange = async (value: number) => {
    setInsurance(value);
    await saveExpense("insurance", "보험료", value);
  };

  const handleAddOptionalExpense = (type: ExpenseType, label: string) => {
    setOptionalExpenses([...optionalExpenses, { type, label, amount: 0 }]);
  };

  const handleOptionalExpenseChange = async (index: number, amount: number) => {
    const updated = [...optionalExpenses];
    updated[index].amount = amount;
    setOptionalExpenses(updated);

    const item = updated[index];
    await saveExpense(item.type, item.label, amount, item.id);
  };

  const handleRemoveOptionalExpense = async (index: number) => {
    const item = optionalExpenses[index];
    if (item.id) {
      await deleteExpense(item.id);
    }
    setOptionalExpenses(optionalExpenses.filter((_, i) => i !== index));
  };

  // Save helpers
  const saveIncome = async (
    type: IncomeType,
    owner: "self" | "spouse",
    title: string,
    amount: number,
    id?: string
  ) => {
    try {
      const incomeData = {
        simulation_id: simulationId,
        type,
        owner,
        title,
        amount,
        frequency: "monthly" as const,
        start_year: currentYear,
        start_month: new Date().getMonth() + 1,
        end_year: currentYear + (retirementAge - currentAge),
        end_month: new Date().getMonth() + 1,
        is_fixed_to_retirement: true,
        growth_rate: 3.0,
        rate_category: "income" as const,
      };

      if (id) {
        await updateIncome(id, incomeData);
      } else {
        const created = await createIncome(incomeData);
        // Update id in state
        if (type === "labor" && owner === "self") {
          setIncomes([...incomes, created]);
        } else if (type === "labor" && owner === "spouse") {
          setIncomes([...incomes, created]);
        } else {
          setOtherIncomes(
            otherIncomes.map((item) =>
              item.type === type && !item.id ? { ...item, id: created.id } : item
            )
          );
        }
      }
    } catch (error) {
      console.error("Failed to save income:", error);
    }
  };

  const saveExpense = async (
    type: ExpenseType,
    title: string,
    amount: number,
    id?: string
  ) => {
    try {
      const expenseData = {
        simulation_id: simulationId,
        type,
        title,
        amount,
        frequency: "monthly" as const,
        start_year: currentYear,
        start_month: new Date().getMonth() + 1,
        end_year: currentYear + (retirementAge - currentAge),
        end_month: new Date().getMonth() + 1,
        is_fixed_to_retirement: true,
        growth_rate: 2.5,
        rate_category: "inflation" as const,
      };

      if (id) {
        await updateExpense(id, expenseData);
      } else {
        const created = await createExpense(expenseData);
        // Update id in state
        if (["living", "housing", "education", "insurance"].includes(type)) {
          setExpenses([...expenses, created]);
        } else {
          setOptionalExpenses(
            optionalExpenses.map((item) =>
              item.type === type && !item.id ? { ...item, id: created.id } : item
            )
          );
        }
      }
    } catch (error) {
      console.error("Failed to save expense:", error);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 2-1. 월 수입 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>2-1. 월 수입</h3>
          <span className={styles.sectionTotal}>
            총 {formatMoney(totalMonthlyIncome)}
          </span>
        </div>
        <div className={styles.sectionContent}>
          <div className={styles.inputRow}>
            <label className={styles.inputLabel}>본인 근로소득</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={selfLabor || ""}
                onChange={(e) => handleSelfLaborChange(Number(e.target.value) || 0)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.unit}>만원/월</span>
            </div>
          </div>

          <div className={styles.inputRow}>
            <label className={styles.inputLabel}>배우자 근로소득</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={spouseLabor || ""}
                onChange={(e) =>
                  handleSpouseLaborChange(Number(e.target.value) || 0)
                }
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.unit}>만원/월</span>
            </div>
            <span className={styles.helper}>(없으면 0)</span>
          </div>

          <div className={styles.divider}>기타 수입</div>

          <div className={styles.buttonRow}>
            {OTHER_INCOME_TYPES.map((item) => (
              <button
                key={item.type}
                className={styles.addButton}
                onClick={() => handleAddOtherIncome(item.type, item.label)}
                disabled={otherIncomes.some((i) => i.type === item.type)}
              >
                + {item.label}
              </button>
            ))}
          </div>

          {otherIncomes.map((item, index) => (
            <div key={index} className={styles.inputRow}>
              <label className={styles.inputLabel}>{item.label}</label>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.input}
                  value={item.amount || ""}
                  onChange={(e) =>
                    handleOtherIncomeChange(index, Number(e.target.value) || 0)
                  }
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.unit}>만원/월</span>
              </div>
              <button
                className={styles.removeButton}
                onClick={() => handleRemoveOtherIncome(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2-2. 월 지출 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>2-2. 월 지출</h3>
          <span className={styles.sectionTotal}>
            총 {formatMoney(totalMonthlyExpense)}
          </span>
        </div>
        <div className={styles.sectionContent}>
          <div className={styles.divider}>필수 지출</div>

          <div className={styles.inputRow}>
            <label className={styles.inputLabel}>생활비 (식비, 공과금 등)</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={living || ""}
                onChange={(e) => handleLivingChange(Number(e.target.value) || 0)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.unit}>만원/월</span>
            </div>
          </div>

          <div className={styles.inputRow}>
            <label className={styles.inputLabel}>주거비 (월세/관리비)</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={housing || ""}
                onChange={(e) => handleHousingChange(Number(e.target.value) || 0)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.unit}>만원/월</span>
            </div>
          </div>

          <div className={styles.inputRow}>
            <label className={styles.inputLabel}>교육비</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={education || ""}
                onChange={(e) => handleEducationChange(Number(e.target.value) || 0)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.unit}>만원/월</span>
            </div>
          </div>

          <div className={styles.inputRow}>
            <label className={styles.inputLabel}>보험료</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={insurance || ""}
                onChange={(e) => handleInsuranceChange(Number(e.target.value) || 0)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.unit}>만원/월</span>
            </div>
          </div>

          <div className={styles.divider}>선택 지출</div>

          <div className={styles.buttonRow}>
            {OPTIONAL_EXPENSE_TYPES.map((item) => (
              <button
                key={item.type}
                className={styles.addButton}
                onClick={() => handleAddOptionalExpense(item.type, item.label)}
                disabled={optionalExpenses.some((e) => e.type === item.type)}
              >
                + {item.label}
              </button>
            ))}
          </div>

          {optionalExpenses.map((item, index) => (
            <div key={index} className={styles.inputRow}>
              <label className={styles.inputLabel}>{item.label}</label>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  className={styles.input}
                  value={item.amount || ""}
                  onChange={(e) =>
                    handleOptionalExpenseChange(index, Number(e.target.value) || 0)
                  }
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.unit}>만원/월</span>
              </div>
              <button
                className={styles.removeButton}
                onClick={() => handleRemoveOptionalExpense(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2-3. 월 현금흐름 요약 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>2-3. 월 현금흐름 요약</h3>
        </div>
        <div className={styles.sectionContent}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>월 수입</span>
            <span className={styles.summaryValue}>
              {formatMoney(totalMonthlyIncome)}
            </span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>월 지출</span>
            <span className={styles.summaryValue}>
              -{formatMoney(totalMonthlyExpense)}
            </span>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabelBold}>월 저축 가능액</span>
            <span
              className={`${styles.summaryValueBold} ${
                monthlySavings >= 0 ? styles.positive : styles.negative
              }`}
            >
              {formatMoney(monthlySavings)}
            </span>
          </div>

          <div className={styles.savingsRate}>
            <span className={styles.savingsRateLabel}>저축률:</span>
            <span className={styles.savingsRateValue}>{savingsRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
