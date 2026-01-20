import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import { ALL_SAVINGS_TYPE_LABELS } from "@/lib/services/savingsService";
import type { Savings, SavingsType } from "@/types/tables";
import { AccordionSection, DataCard, QuickAddButton, EmptyState } from "../shared";
import { SavingsModal } from "../modals/SavingsModal";
import styles from "./Section.module.css";

interface SavingsSectionProps {
  savings: Savings[];
  simulationId: string;
  onUpdate: () => void;
}

const QUICK_ADD_ITEMS = [
  { label: "예금", value: "deposit" },
  { label: "적금", value: "savings" },
  { label: "국내주식", value: "domestic_stock" },
  { label: "해외주식", value: "foreign_stock" },
  { label: "펀드", value: "fund" },
];

export function SavingsSection({
  savings,
  simulationId,
  onUpdate,
}: SavingsSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSavings, setEditingSavings] = useState<Savings | null>(null);
  const [defaultType, setDefaultType] = useState<SavingsType>("deposit");

  // 총 잔액 계산
  const totalBalance = savings.reduce((sum, s) => sum + s.current_balance, 0);

  const handleQuickAdd = (type: string) => {
    setDefaultType(type as SavingsType);
    setEditingSavings(null);
    setModalOpen(true);
  };

  const handleEdit = (item: Savings) => {
    setEditingSavings(item);
    setDefaultType(item.type);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingSavings(null);
  };

  const handleSaved = () => {
    handleModalClose();
    onUpdate();
  };

  return (
    <>
      <AccordionSection
        title="저축/투자"
        count={savings.length}
        summary={savings.length > 0 ? `총 ${formatMoney(totalBalance)}` : undefined}
      >
        {savings.length === 0 ? (
          <EmptyState message="등록된 저축/투자가 없습니다" />
        ) : (
          <div className={styles.cardGrid}>
            {savings.map((item) => (
              <DataCard
                key={item.id}
                type={ALL_SAVINGS_TYPE_LABELS[item.type] || item.type}
                title={item.title}
                amount={formatMoney(item.current_balance)}
                subInfo={
                  item.monthly_contribution
                    ? `월 ${formatMoney(item.monthly_contribution)} 적립`
                    : undefined
                }
                owner={item.owner === "self" ? "본인" : "배우자"}
                onEdit={() => handleEdit(item)}
                onDelete={async () => {
                  if (confirm("이 저축/투자를 삭제하시겠습니까?")) {
                    const { deleteSavings } = await import("@/lib/services/savingsService");
                    await deleteSavings(item.id);
                    onUpdate();
                  }
                }}
              />
            ))}
          </div>
        )}
        <QuickAddButton items={QUICK_ADD_ITEMS} onAdd={handleQuickAdd} />
      </AccordionSection>

      <SavingsModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSaved={handleSaved}
        simulationId={simulationId}
        savings={editingSavings}
        defaultType={defaultType}
      />
    </>
  );
}
