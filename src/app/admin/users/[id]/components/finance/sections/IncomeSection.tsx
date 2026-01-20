import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import { INCOME_TYPE_LABELS } from "@/lib/services/incomeService";
import type { Income, IncomeType } from "@/types/tables";
import { AccordionSection, DataCard, QuickAddButton, EmptyState } from "../shared";
import { IncomeModal } from "../modals/IncomeModal";
import styles from "./Section.module.css";

interface IncomeSectionProps {
  incomes: Income[];
  simulationId: string;
  onUpdate: () => void;
}

const QUICK_ADD_ITEMS = [
  { label: "근로소득", value: "labor" },
  { label: "사업소득", value: "business" },
  { label: "임대소득", value: "rental" },
  { label: "기타", value: "other" },
];

export function IncomeSection({
  incomes,
  simulationId,
  onUpdate,
}: IncomeSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [defaultType, setDefaultType] = useState<IncomeType>("labor");

  // 월 환산 총액 계산
  const totalMonthly = incomes.reduce((sum, income) => {
    const amount = income.frequency === "yearly" ? income.amount / 12 : income.amount;
    return sum + amount;
  }, 0);

  const handleQuickAdd = (type: string) => {
    setDefaultType(type as IncomeType);
    setEditingIncome(null);
    setModalOpen(true);
  };

  const handleEdit = (income: Income) => {
    setEditingIncome(income);
    setDefaultType(income.type);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingIncome(null);
  };

  const handleSaved = () => {
    handleModalClose();
    onUpdate();
  };

  return (
    <>
      <AccordionSection
        title="소득"
        count={incomes.length}
        summary={incomes.length > 0 ? `월 ${formatMoney(Math.round(totalMonthly))}` : undefined}
        defaultOpen={true}
      >
        {incomes.length === 0 ? (
          <EmptyState message="등록된 소득이 없습니다" />
        ) : (
          <div className={styles.cardGrid}>
            {incomes.map((income) => (
              <DataCard
                key={income.id}
                type={INCOME_TYPE_LABELS[income.type] || income.type}
                title={income.title}
                amount={`${formatMoney(income.amount)} / ${income.frequency === "monthly" ? "월" : "년"}`}
                owner={income.owner === "self" ? "본인" : "배우자"}
                isLinked={income.source_type !== null}
                linkedLabel={
                  income.source_type === "national_pension"
                    ? "국민연금"
                    : income.source_type === "retirement_pension"
                      ? "퇴직연금"
                      : income.source_type === "personal_pension"
                        ? "개인연금"
                        : income.source_type === "real_estate"
                          ? "부동산"
                          : undefined
                }
                onEdit={() => handleEdit(income)}
                onDelete={async () => {
                  if (confirm("이 소득을 삭제하시겠습니까?")) {
                    const { deleteIncome } = await import("@/lib/services/incomeService");
                    await deleteIncome(income.id);
                    onUpdate();
                  }
                }}
              />
            ))}
          </div>
        )}
        <QuickAddButton items={QUICK_ADD_ITEMS} onAdd={handleQuickAdd} />
      </AccordionSection>

      <IncomeModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSaved={handleSaved}
        simulationId={simulationId}
        income={editingIncome}
        defaultType={defaultType}
      />
    </>
  );
}
