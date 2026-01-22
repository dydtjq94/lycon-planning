"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Home, Car, CreditCard, GraduationCap, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getDebts, deleteDebt, DEBT_TYPE_LABELS } from "@/lib/services/debtService";
import type { Debt, DebtType } from "@/types/tables";
import { DebtModal } from "../modals/DebtModal";
import styles from "./StepStyles.module.css";

interface DebtStepProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
}

export function DebtStep({ simulationId }: DebtStepProps) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Debt | null>(null);
  const [defaultType, setDefaultType] = useState<DebtType>("credit");

  const loadData = async () => {
    const data = await getDebts(simulationId);
    setDebts(data.filter((d) => d.is_active));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [simulationId]);

  const handleAdd = (type: DebtType) => {
    setDefaultType(type);
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item: Debt) => {
    setEditingItem(item);
    setDefaultType(item.type);
    setModalOpen(true);
  };

  const handleDelete = async (item: Debt) => {
    if (item.source_type) {
      alert("연결된 부채는 원본 항목에서 삭제해주세요.");
      return;
    }
    if (confirm("이 부채를 삭제하시겠습니까?")) {
      await deleteDebt(item.id);
      loadData();
    }
  };

  const totalBalance = debts.reduce((sum, d) => sum + (d.current_balance || 0), 0);

  const getIcon = (type: DebtType) => {
    switch (type) {
      case "mortgage":
      case "jeonse": return <Home size={18} />;
      case "car": return <Car size={18} />;
      case "card": return <CreditCard size={18} />;
      case "student": return <GraduationCap size={18} />;
      default: return <Wallet size={18} />;
    }
  };

  if (loading) {
    return <div className={styles.empty}>로딩 중...</div>;
  }

  return (
    <div className={styles.stepContainer}>
      <p className={styles.description}>
        대출, 신용카드 할부, 학자금 등 모든 부채를 입력해주세요. 부동산에서 등록한 대출은 자동으로 표시됩니다.
      </p>

      {debts.length > 0 ? (
        <div className={styles.itemList}>
          {debts.map((item) => (
            <div key={item.id} className={styles.item}>
              <div className={styles.itemIcon}>
                {getIcon(item.type)}
              </div>
              <div className={styles.itemInfo}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>{item.title}</span>
                  <span className={styles.itemBadge}>{DEBT_TYPE_LABELS[item.type]}</span>
                  {item.source_type && <span className={styles.itemBadge}>연결됨</span>}
                </div>
                <div className={styles.itemMeta}>
                  잔액 {formatMoney(item.current_balance || 0)}
                  {item.interest_rate && <> · 금리 {item.interest_rate}%</>}
                </div>
              </div>
              {!item.source_type && (
                <div className={styles.itemActions}>
                  <button className={styles.actionBtn} onClick={() => handleEdit(item)} title="편집">
                    <Pencil size={16} />
                  </button>
                  <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleDelete(item)} title="삭제">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>등록된 부채가 없습니다</div>
      )}

      <div className={styles.addButtons}>
        <button className={styles.addButton} onClick={() => handleAdd("credit")}>
          <Plus size={16} />신용대출
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("car")}>
          <Plus size={16} />자동차대출
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("student")}>
          <Plus size={16} />학자금대출
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("card")}>
          <Plus size={16} />카드할부
        </button>
      </div>

      {debts.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>부채 요약</div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>총 부채</span>
            <span className={`${styles.summaryValue} ${styles.summaryTotal}`}>{formatMoney(totalBalance)}</span>
          </div>
        </div>
      )}

      <DebtModal
        isOpen={modalOpen}
        simulationId={simulationId}
        debt={editingItem}
        defaultType={defaultType}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        onSaved={() => { setModalOpen(false); setEditingItem(null); loadData(); }}
      />
    </div>
  );
}
