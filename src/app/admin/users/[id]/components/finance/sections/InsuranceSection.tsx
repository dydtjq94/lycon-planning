import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import { INSURANCE_TYPE_LABELS } from "@/lib/services/insuranceService";
import type { Insurance, InsuranceType } from "@/types/tables";
import { AccordionSection, DataCard, QuickAddButton, EmptyState } from "../shared";
import { InsuranceModal } from "../modals/InsuranceModal";
import styles from "./Section.module.css";

interface InsuranceSectionProps {
  insurances: Insurance[];
  simulationId: string;
  onUpdate: () => void;
}

const QUICK_ADD_ITEMS = [
  { label: "실손보험", value: "health" },
  { label: "종신보험", value: "life" },
  { label: "자동차", value: "car" },
  { label: "연금보험", value: "pension" },
];

export function InsuranceSection({
  insurances,
  simulationId,
  onUpdate,
}: InsuranceSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Insurance | null>(null);
  const [defaultType, setDefaultType] = useState<InsuranceType>("health");

  // 월 보험료 합계
  const totalPremium = insurances.reduce((sum, ins) => sum + ins.monthly_premium, 0);

  const handleQuickAdd = (type: string) => {
    setDefaultType(type as InsuranceType);
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item: Insurance) => {
    setEditingItem(item);
    setDefaultType(item.type);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingItem(null);
  };

  const handleSaved = () => {
    handleModalClose();
    onUpdate();
  };

  return (
    <>
      <AccordionSection
        title="보험"
        count={insurances.length}
        summary={insurances.length > 0 ? `월 ${formatMoney(totalPremium)}` : undefined}
      >
        {insurances.length === 0 ? (
          <EmptyState message="등록된 보험이 없습니다" />
        ) : (
          <div className={styles.cardGrid}>
            {insurances.map((ins) => (
              <DataCard
                key={ins.id}
                type={INSURANCE_TYPE_LABELS[ins.type] || ins.type}
                title={ins.title}
                amount={`월 ${formatMoney(ins.monthly_premium)}`}
                subInfo={
                  ins.coverage_amount
                    ? `보장 ${formatMoney(ins.coverage_amount)}`
                    : ins.current_value
                      ? `해지환급금 ${formatMoney(ins.current_value)}`
                      : undefined
                }
                owner={ins.owner === "self" ? "본인" : "배우자"}
                onEdit={() => handleEdit(ins)}
                onDelete={async () => {
                  if (confirm("이 보험을 삭제하시겠습니까? 연동된 지출도 함께 삭제됩니다.")) {
                    const { deleteInsurance } = await import("@/lib/services/insuranceService");
                    await deleteInsurance(ins.id);
                    onUpdate();
                  }
                }}
              />
            ))}
          </div>
        )}
        <QuickAddButton items={QUICK_ADD_ITEMS} onAdd={handleQuickAdd} />
      </AccordionSection>

      <InsuranceModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSaved={handleSaved}
        simulationId={simulationId}
        insurance={editingItem}
        defaultType={defaultType}
      />
    </>
  );
}
