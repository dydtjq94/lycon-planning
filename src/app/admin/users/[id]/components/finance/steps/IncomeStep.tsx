"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Briefcase, Building2, Home, Coins } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getIncomes, deleteIncome, INCOME_TYPE_LABELS } from "@/lib/services/incomeService";
import type { Income, IncomeType } from "@/types/tables";
import { IncomeModal } from "../modals/IncomeModal";
import styles from "./StepStyles.module.css";

interface IncomeStepProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
}

const QUICK_ADD_ITEMS: { label: string; value: IncomeType }[] = [
  { label: "근로소득", value: "labor" },
  { label: "사업소득", value: "business" },
  { label: "임대소득", value: "rental" },
  { label: "기타소득", value: "other" },
];

export function IncomeStep({ simulationId }: IncomeStepProps) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [defaultType, setDefaultType] = useState<IncomeType>("labor");

  const loadData = async () => {
    const data = await getIncomes(simulationId);
    setIncomes(data.filter((i) => i.is_active));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [simulationId]);

  const handleAdd = (type: IncomeType) => {
    setDefaultType(type);
    setEditingIncome(null);
    setModalOpen(true);
  };

  const handleEdit = (income: Income) => {
    setEditingIncome(income);
    setDefaultType(income.type);
    setModalOpen(true);
  };

  const handleDelete = async (income: Income) => {
    if (income.source_type) {
      alert("연결된 소득은 원본 항목에서 삭제해주세요.");
      return;
    }
    if (confirm("이 소득을 삭제하시겠습니까?")) {
      await deleteIncome(income.id);
      loadData();
    }
  };

  const totalMonthly = incomes.reduce((sum, income) => {
    const amount = income.frequency === "yearly" ? income.amount / 12 : income.amount;
    return sum + amount;
  }, 0);

  const getIcon = (type: IncomeType) => {
    switch (type) {
      case "labor": return <Briefcase size={18} />;
      case "business": return <Building2 size={18} />;
      case "rental": return <Home size={18} />;
      default: return <Coins size={18} />;
    }
  };

  if (loading) {
    return <div className={styles.empty}>로딩 중...</div>;
  }

  return (
    <div className={styles.stepContainer}>
      <p className={styles.description}>
        본인과 배우자의 모든 소득을 입력해주세요. 근로소득, 사업소득, 임대소득 등을 포함합니다.
      </p>

      {incomes.length > 0 ? (
        <div className={styles.itemList}>
          {incomes.map((income) => (
            <div key={income.id} className={styles.item}>
              <div className={`${styles.itemIcon} ${styles[income.owner]}`}>
                {getIcon(income.type)}
              </div>
              <div className={styles.itemInfo}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>{income.title}</span>
                  <span className={styles.itemBadge}>{INCOME_TYPE_LABELS[income.type]}</span>
                  {income.source_type && <span className={styles.itemBadge}>연결됨</span>}
                </div>
                <div className={styles.itemMeta}>
                  {income.owner === "self" ? "본인" : "배우자"} · {formatMoney(income.amount)} / {income.frequency === "monthly" ? "월" : "년"}
                </div>
              </div>
              {!income.source_type && (
                <div className={styles.itemActions}>
                  <button className={styles.actionBtn} onClick={() => handleEdit(income)} title="편집">
                    <Pencil size={16} />
                  </button>
                  <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleDelete(income)} title="삭제">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>등록된 소득이 없습니다</div>
      )}

      <div className={styles.addButtons}>
        {QUICK_ADD_ITEMS.map((item) => (
          <button key={item.value} className={styles.addButton} onClick={() => handleAdd(item.value)}>
            <Plus size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {incomes.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>소득 요약</div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>총 월 소득</span>
            <span className={`${styles.summaryValue} ${styles.summaryTotal}`}>{formatMoney(Math.round(totalMonthly))}</span>
          </div>
        </div>
      )}

      <IncomeModal
        isOpen={modalOpen}
        simulationId={simulationId}
        income={editingIncome}
        defaultType={defaultType}
        onClose={() => { setModalOpen(false); setEditingIncome(null); }}
        onSaved={() => { setModalOpen(false); setEditingIncome(null); loadData(); }}
      />
    </div>
  );
}
