"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getSavings, deleteSavings, SAVINGS_TYPE_LABELS, INVESTMENT_TYPE_LABELS } from "@/lib/services/savingsService";
import type { Savings, SavingsType } from "@/types/tables";
import { SavingsModal } from "../modals/SavingsModal";
import styles from "./StepStyles.module.css";

interface SavingsStepProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
}

export function SavingsStep({ simulationId }: SavingsStepProps) {
  const [savings, setSavings] = useState<Savings[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSavings, setEditingSavings] = useState<Savings | null>(null);
  const [defaultType, setDefaultType] = useState<SavingsType>("savings");

  const loadData = async () => {
    const data = await getSavings(simulationId);
    setSavings(data.filter((s) => s.is_active));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [simulationId]);

  const handleAdd = (type: SavingsType) => {
    setDefaultType(type);
    setEditingSavings(null);
    setModalOpen(true);
  };

  const handleEdit = (item: Savings) => {
    setEditingSavings(item);
    setDefaultType(item.type);
    setModalOpen(true);
  };

  const handleDelete = async (item: Savings) => {
    if (confirm("이 저축/투자를 삭제하시겠습니까?")) {
      await deleteSavings(item.id);
      loadData();
    }
  };

  const totalBalance = savings.reduce((sum, s) => sum + (s.current_balance || 0), 0);

  const getIcon = (type: string) => {
    if (["checking", "savings", "deposit"].includes(type)) return <PiggyBank size={18} />;
    if (["domestic_stock", "foreign_stock", "fund", "bond", "crypto"].includes(type)) return <TrendingUp size={18} />;
    return <Wallet size={18} />;
  };

  const getTypeLabel = (type: string) => {
    return (SAVINGS_TYPE_LABELS as Record<string, string>)[type] ||
      (INVESTMENT_TYPE_LABELS as Record<string, string>)[type] || type;
  };

  if (loading) {
    return <div className={styles.empty}>로딩 중...</div>;
  }

  return (
    <div className={styles.stepContainer}>
      <p className={styles.description}>
        저축 계좌, 예금, 투자 자산을 입력해주세요. ISA, 주식, 펀드, 채권 등을 포함합니다.
      </p>

      {savings.length > 0 ? (
        <div className={styles.itemList}>
          {savings.map((item) => (
            <div key={item.id} className={styles.item}>
              <div className={`${styles.itemIcon} ${styles[item.owner]}`}>
                {getIcon(item.type)}
              </div>
              <div className={styles.itemInfo}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>{item.title}</span>
                  <span className={styles.itemBadge}>{getTypeLabel(item.type)}</span>
                </div>
                <div className={styles.itemMeta}>
                  {item.owner === "self" ? "본인" : "배우자"} · 잔액 {formatMoney(item.current_balance || 0)}
                  {item.monthly_contribution && item.monthly_contribution > 0 && <> · 월 {formatMoney(item.monthly_contribution)}</>}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button className={styles.actionBtn} onClick={() => handleEdit(item)} title="편집">
                  <Pencil size={16} />
                </button>
                <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleDelete(item)} title="삭제">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>등록된 저축/투자가 없습니다</div>
      )}

      <div className={styles.addButtons}>
        <button className={styles.addButton} onClick={() => handleAdd("savings")}>
          <Plus size={16} />예금/적금
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("domestic_stock")}>
          <Plus size={16} />국내주식
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("foreign_stock")}>
          <Plus size={16} />해외주식
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("fund")}>
          <Plus size={16} />펀드
        </button>
      </div>

      {savings.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>저축/투자 요약</div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>총 잔액</span>
            <span className={`${styles.summaryValue} ${styles.summaryTotal}`}>{formatMoney(totalBalance)}</span>
          </div>
        </div>
      )}

      <SavingsModal
        isOpen={modalOpen}
        simulationId={simulationId}
        savings={editingSavings}
        defaultType={defaultType}
        onClose={() => { setModalOpen(false); setEditingSavings(null); }}
        onSaved={() => { setModalOpen(false); setEditingSavings(null); loadData(); }}
      />
    </div>
  );
}
