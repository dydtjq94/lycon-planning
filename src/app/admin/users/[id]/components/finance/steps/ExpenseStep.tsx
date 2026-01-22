"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, ShoppingCart, CreditCard, GraduationCap, Heart } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getExpenses, deleteExpense, EXPENSE_TYPE_LABELS } from "@/lib/services/expenseService";
import type { Expense, ExpenseType } from "@/types/tables";
import { ExpenseModal } from "../modals/ExpenseModal";
import styles from "./StepStyles.module.css";

interface ExpenseStepProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
}

const QUICK_ADD_ITEMS: { label: string; value: ExpenseType }[] = [
  { label: "생활비", value: "living" },
  { label: "주거비", value: "housing" },
  { label: "교육비", value: "education" },
  { label: "기타", value: "other" },
];

export function ExpenseStep({ simulationId }: ExpenseStepProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [defaultType, setDefaultType] = useState<ExpenseType>("living");

  const loadData = async () => {
    const data = await getExpenses(simulationId);
    setExpenses(data.filter((e) => e.is_active));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [simulationId]);

  const handleAdd = (type: ExpenseType) => {
    setDefaultType(type);
    setEditingExpense(null);
    setModalOpen(true);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setDefaultType(expense.type);
    setModalOpen(true);
  };

  const handleDelete = async (expense: Expense) => {
    if (expense.source_type) {
      alert("연결된 지출은 원본 항목에서 삭제해주세요.");
      return;
    }
    if (confirm("이 지출을 삭제하시겠습니까?")) {
      await deleteExpense(expense.id);
      loadData();
    }
  };

  const totalMonthly = expenses.reduce((sum, expense) => {
    const amount = expense.frequency === "yearly" ? expense.amount / 12 : expense.amount;
    return sum + amount;
  }, 0);

  const getIcon = (type: ExpenseType) => {
    switch (type) {
      case "living": return <ShoppingCart size={18} />;
      case "education": return <GraduationCap size={18} />;
      case "medical": return <Heart size={18} />;
      default: return <CreditCard size={18} />;
    }
  };

  if (loading) {
    return <div className={styles.empty}>로딩 중...</div>;
  }

  return (
    <div className={styles.stepContainer}>
      <p className={styles.description}>
        월별 지출 항목을 입력해주세요. 고정 지출과 변동 지출을 구분하면 더 정확합니다.
      </p>

      {expenses.length > 0 ? (
        <div className={styles.itemList}>
          {expenses.map((expense) => (
            <div key={expense.id} className={styles.item}>
              <div className={styles.itemIcon}>
                {getIcon(expense.type)}
              </div>
              <div className={styles.itemInfo}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>{expense.title}</span>
                  <span className={styles.itemBadge}>{EXPENSE_TYPE_LABELS[expense.type]}</span>
                  {expense.source_type && <span className={styles.itemBadge}>연결됨</span>}
                </div>
                <div className={styles.itemMeta}>
                  {formatMoney(expense.amount)} / {expense.frequency === "monthly" ? "월" : "년"}
                </div>
              </div>
              {!expense.source_type && (
                <div className={styles.itemActions}>
                  <button className={styles.actionBtn} onClick={() => handleEdit(expense)} title="편집">
                    <Pencil size={16} />
                  </button>
                  <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleDelete(expense)} title="삭제">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>등록된 지출이 없습니다</div>
      )}

      <div className={styles.addButtons}>
        {QUICK_ADD_ITEMS.map((item) => (
          <button key={item.value} className={styles.addButton} onClick={() => handleAdd(item.value)}>
            <Plus size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {expenses.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>지출 요약</div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>총 월 지출</span>
            <span className={`${styles.summaryValue} ${styles.summaryTotal}`}>{formatMoney(Math.round(totalMonthly))}</span>
          </div>
        </div>
      )}

      <ExpenseModal
        isOpen={modalOpen}
        simulationId={simulationId}
        expense={editingExpense}
        defaultType={defaultType}
        onClose={() => { setModalOpen(false); setEditingExpense(null); }}
        onSaved={() => { setModalOpen(false); setEditingExpense(null); loadData(); }}
      />
    </div>
  );
}
