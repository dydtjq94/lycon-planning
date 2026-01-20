import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import { DEBT_TYPE_LABELS, REPAYMENT_TYPE_LABELS } from "@/lib/services/debtService";
import type { Debt, DebtType } from "@/types/tables";
import { AccordionSection, DataCard, QuickAddButton, EmptyState } from "../shared";
import { DebtModal } from "../modals/DebtModal";
import styles from "./Section.module.css";

interface DebtSectionProps {
  debts: Debt[];
  simulationId: string;
  onUpdate: () => void;
}

const QUICK_ADD_ITEMS = [
  { label: "신용대출", value: "credit" },
  { label: "학자금대출", value: "student" },
  { label: "카드대출", value: "card" },
  { label: "기타", value: "other" },
];

export function DebtSection({
  debts,
  simulationId,
  onUpdate,
}: DebtSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Debt | null>(null);
  const [defaultType, setDefaultType] = useState<DebtType>("credit");

  // 총 잔액 계산
  const totalBalance = debts.reduce(
    (sum, d) => sum + (d.current_balance ?? d.principal),
    0
  );

  const handleQuickAdd = (type: string) => {
    setDefaultType(type as DebtType);
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item: Debt) => {
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
        title="부채"
        count={debts.length}
        summary={debts.length > 0 ? `총 ${formatMoney(totalBalance)}` : undefined}
      >
        {debts.length === 0 ? (
          <EmptyState message="등록된 부채가 없습니다" />
        ) : (
          <div className={styles.cardGrid}>
            {debts.map((debt) => (
              <DataCard
                key={debt.id}
                type={DEBT_TYPE_LABELS[debt.type] || debt.type}
                title={debt.title}
                amount={formatMoney(debt.current_balance ?? debt.principal)}
                subInfo={`${debt.interest_rate}% / ${REPAYMENT_TYPE_LABELS[debt.repayment_type]}`}
                isLinked={debt.source_type !== null}
                linkedLabel={
                  debt.source_type === "real_estate"
                    ? "부동산"
                    : debt.source_type === "physical_asset"
                      ? "실물자산"
                      : undefined
                }
                onEdit={() => handleEdit(debt)}
                onDelete={async () => {
                  if (confirm("이 부채를 삭제하시겠습니까? 연동된 지출도 함께 삭제됩니다.")) {
                    const { deleteDebt } = await import("@/lib/services/debtService");
                    await deleteDebt(debt.id);
                    onUpdate();
                  }
                }}
              />
            ))}
          </div>
        )}
        <QuickAddButton items={QUICK_ADD_ITEMS} onAdd={handleQuickAdd} />
      </AccordionSection>

      <DebtModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSaved={handleSaved}
        simulationId={simulationId}
        debt={editingItem}
        defaultType={defaultType}
      />
    </>
  );
}
