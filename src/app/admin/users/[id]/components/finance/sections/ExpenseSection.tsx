import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import { EXPENSE_TYPE_LABELS } from "@/lib/services/expenseService";
import type { Expense, ExpenseType } from "@/types/tables";
import { AccordionSection, DataCard, QuickAddButton, EmptyState } from "../shared";
import { ExpenseModal } from "../modals/ExpenseModal";
import styles from "./Section.module.css";

interface ExpenseSectionProps {
  expenses: Expense[];
  simulationId: string;
  onUpdate: () => void;
}

const QUICK_ADD_ITEMS = [
  { label: "생활비", value: "living" },
  { label: "주거비", value: "housing" },
  { label: "교육비", value: "education" },
  { label: "보험료", value: "insurance" },
  { label: "기타", value: "other" },
];

export function ExpenseSection({
  expenses,
  simulationId,
  onUpdate,
}: ExpenseSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [defaultType, setDefaultType] = useState<ExpenseType>("living");

  // 월 환산 총액 계산
  const totalMonthly = expenses.reduce((sum, expense) => {
    const amount = expense.frequency === "yearly" ? expense.amount / 12 : expense.amount;
    return sum + amount;
  }, 0);

  const handleQuickAdd = (type: string) => {
    setDefaultType(type as ExpenseType);
    setEditingExpense(null);
    setModalOpen(true);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setDefaultType(expense.type);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingExpense(null);
  };

  const handleSaved = () => {
    handleModalClose();
    onUpdate();
  };

  return (
    <>
      <AccordionSection
        title="지출"
        count={expenses.length}
        summary={expenses.length > 0 ? `월 ${formatMoney(Math.round(totalMonthly))}` : undefined}
      >
        {expenses.length === 0 ? (
          <EmptyState message="등록된 지출이 없습니다" />
        ) : (
          <div className={styles.cardGrid}>
            {expenses.map((expense) => (
              <DataCard
                key={expense.id}
                type={EXPENSE_TYPE_LABELS[expense.type] || expense.type}
                title={expense.title}
                amount={`${formatMoney(expense.amount)} / ${expense.frequency === "monthly" ? "월" : "년"}`}
                isLinked={expense.source_type !== null}
                linkedLabel={
                  expense.source_type === "debt"
                    ? "부채"
                    : expense.source_type === "real_estate"
                      ? "부동산"
                      : expense.source_type === "insurance"
                        ? "보험"
                        : undefined
                }
                onEdit={() => handleEdit(expense)}
                onDelete={async () => {
                  if (confirm("이 지출을 삭제하시겠습니까?")) {
                    const { deleteExpense } = await import("@/lib/services/expenseService");
                    await deleteExpense(expense.id);
                    onUpdate();
                  }
                }}
              />
            ))}
          </div>
        )}
        <QuickAddButton items={QUICK_ADD_ITEMS} onAdd={handleQuickAdd} />
      </AccordionSection>

      <ExpenseModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSaved={handleSaved}
        simulationId={simulationId}
        expense={editingExpense}
        defaultType={defaultType}
      />
    </>
  );
}
