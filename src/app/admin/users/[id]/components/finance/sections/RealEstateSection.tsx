import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import { REAL_ESTATE_TYPE_LABELS, HOUSING_TYPE_LABELS } from "@/lib/services/realEstateService";
import type { RealEstate, RealEstateType } from "@/types/tables";
import { AccordionSection, DataCard, QuickAddButton, EmptyState } from "../shared";
import { RealEstateModal } from "../modals/RealEstateModal";
import styles from "./Section.module.css";

interface RealEstateSectionProps {
  realEstates: RealEstate[];
  simulationId: string;
  onUpdate: () => void;
}

const QUICK_ADD_ITEMS = [
  { label: "거주용", value: "residence" },
  { label: "투자용", value: "investment" },
  { label: "임대용", value: "rental" },
];

export function RealEstateSection({
  realEstates,
  simulationId,
  onUpdate,
}: RealEstateSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RealEstate | null>(null);
  const [defaultType, setDefaultType] = useState<RealEstateType>("residence");

  // 총 가치 계산
  const totalValue = realEstates.reduce((sum, re) => sum + re.current_value, 0);

  const handleQuickAdd = (type: string) => {
    setDefaultType(type as RealEstateType);
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item: RealEstate) => {
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

  const getSubInfo = (re: RealEstate) => {
    const parts: string[] = [];
    if (re.housing_type) {
      parts.push(HOUSING_TYPE_LABELS[re.housing_type] || re.housing_type);
    }
    if (re.has_loan && re.loan_amount) {
      parts.push(`대출 ${formatMoney(re.loan_amount)}`);
    }
    if (re.has_rental_income && re.rental_monthly) {
      parts.push(`임대 월${formatMoney(re.rental_monthly)}`);
    }
    return parts.length > 0 ? parts.join(" / ") : undefined;
  };

  return (
    <>
      <AccordionSection
        title="부동산"
        count={realEstates.length}
        summary={realEstates.length > 0 ? `총 ${formatMoney(totalValue)}` : undefined}
      >
        {realEstates.length === 0 ? (
          <EmptyState message="등록된 부동산이 없습니다" />
        ) : (
          <div className={styles.cardGrid}>
            {realEstates.map((re) => (
              <DataCard
                key={re.id}
                type={REAL_ESTATE_TYPE_LABELS[re.type] || re.type}
                title={re.title}
                amount={formatMoney(re.current_value)}
                subInfo={getSubInfo(re)}
                owner={
                  re.owner === "self"
                    ? "본인"
                    : re.owner === "spouse"
                      ? "배우자"
                      : "공동"
                }
                onEdit={() => handleEdit(re)}
                onDelete={async () => {
                  if (confirm("이 부동산을 삭제하시겠습니까? 연동된 대출, 임대소득, 지출도 함께 삭제됩니다.")) {
                    const { deleteRealEstate } = await import("@/lib/services/realEstateService");
                    await deleteRealEstate(re.id);
                    onUpdate();
                  }
                }}
              />
            ))}
          </div>
        )}
        <QuickAddButton items={QUICK_ADD_ITEMS} onAdd={handleQuickAdd} />
      </AccordionSection>

      <RealEstateModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSaved={handleSaved}
        simulationId={simulationId}
        realEstate={editingItem}
        defaultType={defaultType}
      />
    </>
  );
}
