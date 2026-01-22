"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Shield, Heart, Car, PiggyBank } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getInsurances, deleteInsurance, INSURANCE_TYPE_LABELS } from "@/lib/services/insuranceService";
import type { Insurance, InsuranceType } from "@/types/tables";
import { InsuranceModal } from "../modals/InsuranceModal";
import styles from "./StepStyles.module.css";

interface InsuranceStepProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
}

export function InsuranceStep({ simulationId }: InsuranceStepProps) {
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Insurance | null>(null);
  const [defaultType, setDefaultType] = useState<InsuranceType>("life");

  const loadData = async () => {
    const data = await getInsurances(simulationId);
    setInsurances(data.filter((i) => i.is_active));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [simulationId]);

  const handleAdd = (type: InsuranceType) => {
    setDefaultType(type);
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item: Insurance) => {
    setEditingItem(item);
    setDefaultType(item.type);
    setModalOpen(true);
  };

  const handleDelete = async (item: Insurance) => {
    if (confirm("이 보험을 삭제하시겠습니까?")) {
      await deleteInsurance(item.id);
      loadData();
    }
  };

  const totalMonthlyPremium = insurances.reduce((sum, i) => sum + (i.monthly_premium || 0), 0);

  const getIcon = (type: InsuranceType) => {
    switch (type) {
      case "life":
      case "term": return <Shield size={18} />;
      case "health": return <Heart size={18} />;
      case "car": return <Car size={18} />;
      case "savings":
      case "pension": return <PiggyBank size={18} />;
      default: return <Shield size={18} />;
    }
  };

  if (loading) {
    return <div className={styles.empty}>로딩 중...</div>;
  }

  return (
    <div className={styles.stepContainer}>
      <p className={styles.description}>
        가입한 보험을 입력해주세요. 보장성 보험과 저축성 보험을 구분해서 입력합니다.
      </p>

      {insurances.length > 0 ? (
        <div className={styles.itemList}>
          {insurances.map((item) => (
            <div key={item.id} className={styles.item}>
              <div className={`${styles.itemIcon} ${styles[item.owner]}`}>
                {getIcon(item.type)}
              </div>
              <div className={styles.itemInfo}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>{item.title}</span>
                  <span className={styles.itemBadge}>{INSURANCE_TYPE_LABELS[item.type]}</span>
                </div>
                <div className={styles.itemMeta}>
                  {item.owner === "self" ? "본인" : "배우자"} · 월 {formatMoney(item.monthly_premium || 0)}
                  {item.coverage_amount && <> · 보장 {formatMoney(item.coverage_amount)}</>}
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
        <div className={styles.empty}>등록된 보험이 없습니다</div>
      )}

      <div className={styles.addButtons}>
        <button className={styles.addButton} onClick={() => handleAdd("life")}>
          <Plus size={16} />종신보험
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("term")}>
          <Plus size={16} />정기보험
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("health")}>
          <Plus size={16} />실손보험
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("savings")}>
          <Plus size={16} />저축보험
        </button>
      </div>

      {insurances.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>보험 요약</div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>총 월 보험료</span>
            <span className={`${styles.summaryValue} ${styles.summaryTotal}`}>{formatMoney(totalMonthlyPremium)}</span>
          </div>
        </div>
      )}

      <InsuranceModal
        isOpen={modalOpen}
        simulationId={simulationId}
        insurance={editingItem}
        defaultType={defaultType}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        onSaved={() => { setModalOpen(false); setEditingItem(null); loadData(); }}
      />
    </div>
  );
}
