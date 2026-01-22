"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Home, Building, MapPin } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getRealEstates, deleteRealEstate, REAL_ESTATE_TYPE_LABELS, HOUSING_TYPE_LABELS } from "@/lib/services/realEstateService";
import type { RealEstate, RealEstateType } from "@/types/tables";
import { RealEstateModal } from "../modals/RealEstateModal";
import styles from "./StepStyles.module.css";

interface RealEstateStepProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
}

export function RealEstateStep({ simulationId }: RealEstateStepProps) {
  const [realEstates, setRealEstates] = useState<RealEstate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RealEstate | null>(null);
  const [defaultType, setDefaultType] = useState<RealEstateType>("residence");

  const loadData = async () => {
    const data = await getRealEstates(simulationId);
    setRealEstates(data.filter((r) => r.is_active));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [simulationId]);

  const handleAdd = (type: RealEstateType) => {
    setDefaultType(type);
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item: RealEstate) => {
    setEditingItem(item);
    setDefaultType(item.type);
    setModalOpen(true);
  };

  const handleDelete = async (item: RealEstate) => {
    if (confirm("이 부동산을 삭제하시겠습니까? 연결된 대출, 소득, 지출도 함께 삭제됩니다.")) {
      await deleteRealEstate(item.id);
      loadData();
    }
  };

  const totalValue = realEstates.reduce((sum, r) => sum + (r.current_value || 0), 0);

  const getIcon = (type: RealEstateType) => {
    switch (type) {
      case "residence": return <Home size={18} />;
      case "investment":
      case "rental": return <Building size={18} />;
      default: return <MapPin size={18} />;
    }
  };

  if (loading) {
    return <div className={styles.empty}>로딩 중...</div>;
  }

  return (
    <div className={styles.stepContainer}>
      <p className={styles.description}>
        보유 부동산과 현재 거주지 정보를 입력해주세요. 대출이 있다면 자동으로 부채에 연결됩니다.
      </p>

      {realEstates.length > 0 ? (
        <div className={styles.itemList}>
          {realEstates.map((item) => (
            <div key={item.id} className={styles.item}>
              <div className={`${styles.itemIcon} ${styles[item.owner === "common" ? "self" : item.owner]}`}>
                {getIcon(item.type)}
              </div>
              <div className={styles.itemInfo}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>{item.title}</span>
                  <span className={styles.itemBadge}>{REAL_ESTATE_TYPE_LABELS[item.type]}</span>
                  {item.housing_type && <span className={styles.itemBadge}>{HOUSING_TYPE_LABELS[item.housing_type]}</span>}
                </div>
                <div className={styles.itemMeta}>
                  {item.owner === "self" ? "본인" : item.owner === "spouse" ? "배우자" : "공동"}
                  {item.current_value && <> · 시세 {formatMoney(item.current_value)}</>}
                  {item.has_loan && <> · 대출 있음</>}
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
        <div className={styles.empty}>등록된 부동산이 없습니다</div>
      )}

      <div className={styles.addButtons}>
        <button className={styles.addButton} onClick={() => handleAdd("residence")}>
          <Plus size={16} />거주지
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("investment")}>
          <Plus size={16} />투자용
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("rental")}>
          <Plus size={16} />임대용
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("land")}>
          <Plus size={16} />토지
        </button>
      </div>

      {realEstates.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>부동산 요약</div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>총 시세</span>
            <span className={`${styles.summaryValue} ${styles.summaryTotal}`}>{formatMoney(totalValue)}</span>
          </div>
        </div>
      )}

      <RealEstateModal
        isOpen={modalOpen}
        simulationId={simulationId}
        realEstate={editingItem}
        defaultType={defaultType}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        onSaved={() => { setModalOpen(false); setEditingItem(null); loadData(); }}
      />
    </div>
  );
}
