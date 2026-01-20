import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import type { NationalPension, RetirementPension, PersonalPension, Owner } from "@/types/tables";
import { AccordionSection, DataCard, QuickAddButton, EmptyState } from "../shared";
import { PENSION_TYPE_LABELS as RETIREMENT_TYPE_LABELS } from "@/lib/services/retirementPensionService";
import { PENSION_TYPE_LABELS as PERSONAL_TYPE_LABELS } from "@/lib/services/personalPensionService";
import { NationalPensionModal } from "../modals/NationalPensionModal";
import { RetirementPensionModal } from "../modals/RetirementPensionModal";
import { PersonalPensionModal } from "../modals/PersonalPensionModal";
import styles from "./Section.module.css";

interface PensionSectionProps {
  nationalPensions: NationalPension[];
  retirementPensions: RetirementPension[];
  personalPensions: PersonalPension[];
  simulationId: string;
  birthYear: number;
  retirementAge: number;
  onUpdate: () => void;
}

type ModalType = "national" | "retirement" | "personal" | null;

const QUICK_ADD_ITEMS = [
  { label: "국민연금", value: "national" },
  { label: "퇴직연금", value: "retirement" },
  { label: "개인연금", value: "personal" },
];

export function PensionSection({
  nationalPensions,
  retirementPensions,
  personalPensions,
  simulationId,
  birthYear,
  retirementAge,
  onUpdate,
}: PensionSectionProps) {
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingNational, setEditingNational] = useState<NationalPension | null>(null);
  const [editingRetirement, setEditingRetirement] = useState<RetirementPension | null>(null);
  const [editingPersonal, setEditingPersonal] = useState<PersonalPension | null>(null);
  const [defaultOwner, setDefaultOwner] = useState<Owner>("self");

  const totalCount = nationalPensions.length + retirementPensions.length + personalPensions.length;

  // 요약 정보 생성
  const getSummary = () => {
    const parts: string[] = [];
    if (nationalPensions.length > 0) parts.push(`국민 ${nationalPensions.length}`);
    if (retirementPensions.length > 0) parts.push(`퇴직 ${retirementPensions.length}`);
    if (personalPensions.length > 0) parts.push(`개인 ${personalPensions.length}`);
    return parts.length > 0 ? parts.join(", ") : undefined;
  };

  const handleQuickAdd = (type: string) => {
    setDefaultOwner("self");
    if (type === "national") {
      setEditingNational(null);
      setModalType("national");
    } else if (type === "retirement") {
      setEditingRetirement(null);
      setModalType("retirement");
    } else if (type === "personal") {
      setEditingPersonal(null);
      setModalType("personal");
    }
  };

  const handleModalClose = () => {
    setModalType(null);
    setEditingNational(null);
    setEditingRetirement(null);
    setEditingPersonal(null);
  };

  const handleSaved = () => {
    handleModalClose();
    onUpdate();
  };

  const isEmpty = totalCount === 0;

  return (
    <>
      <AccordionSection
        title="연금"
        count={totalCount}
        summary={getSummary()}
      >
        {isEmpty ? (
          <EmptyState message="등록된 연금이 없습니다" />
        ) : (
          <div className={styles.cardGrid}>
            {/* 국민연금 */}
            {nationalPensions.map((pension) => (
              <DataCard
                key={`national-${pension.id}`}
                type="국민연금"
                title={`${pension.owner === "self" ? "본인" : "배우자"} 국민연금`}
                amount={`월 ${formatMoney(pension.expected_monthly_amount)}`}
                subInfo={`${pension.start_age}세부터 수령`}
                owner={pension.owner === "self" ? "본인" : "배우자"}
                onEdit={() => {
                  setEditingNational(pension);
                  setDefaultOwner(pension.owner);
                  setModalType("national");
                }}
                onDelete={async () => {
                  if (confirm("이 국민연금을 삭제하시겠습니까?")) {
                    const { deleteNationalPension } = await import("@/lib/services/nationalPensionService");
                    await deleteNationalPension(pension.id);
                    onUpdate();
                  }
                }}
              />
            ))}

            {/* 퇴직연금 */}
            {retirementPensions.map((pension) => (
              <DataCard
                key={`retirement-${pension.id}`}
                type={RETIREMENT_TYPE_LABELS[pension.pension_type] || "퇴직연금"}
                title={`${pension.owner === "self" ? "본인" : "배우자"} ${RETIREMENT_TYPE_LABELS[pension.pension_type]}`}
                amount={
                  pension.current_balance
                    ? formatMoney(pension.current_balance)
                    : pension.years_of_service
                      ? `근속 ${pension.years_of_service}년`
                      : "-"
                }
                subInfo={pension.receive_type === "annuity" ? "연금 수령" : "일시금 수령"}
                owner={pension.owner === "self" ? "본인" : "배우자"}
                onEdit={() => {
                  setEditingRetirement(pension);
                  setDefaultOwner(pension.owner);
                  setModalType("retirement");
                }}
                onDelete={async () => {
                  if (confirm("이 퇴직연금을 삭제하시겠습니까?")) {
                    const { deleteRetirementPension } = await import("@/lib/services/retirementPensionService");
                    await deleteRetirementPension(pension.id);
                    onUpdate();
                  }
                }}
              />
            ))}

            {/* 개인연금 */}
            {personalPensions.map((pension) => (
              <DataCard
                key={`personal-${pension.id}`}
                type={PERSONAL_TYPE_LABELS[pension.pension_type] || "개인연금"}
                title={`${pension.owner === "self" ? "본인" : "배우자"} ${PERSONAL_TYPE_LABELS[pension.pension_type]}`}
                amount={formatMoney(pension.current_balance)}
                subInfo={
                  pension.monthly_contribution
                    ? `월 ${formatMoney(pension.monthly_contribution)} 적립`
                    : undefined
                }
                owner={pension.owner === "self" ? "본인" : "배우자"}
                onEdit={() => {
                  setEditingPersonal(pension);
                  setDefaultOwner(pension.owner);
                  setModalType("personal");
                }}
                onDelete={async () => {
                  if (confirm("이 개인연금을 삭제하시겠습니까?")) {
                    const { deletePersonalPension } = await import("@/lib/services/personalPensionService");
                    await deletePersonalPension(pension.id);
                    onUpdate();
                  }
                }}
              />
            ))}
          </div>
        )}
        <QuickAddButton items={QUICK_ADD_ITEMS} onAdd={handleQuickAdd} />
      </AccordionSection>

      {/* 국민연금 모달 */}
      <NationalPensionModal
        isOpen={modalType === "national"}
        onClose={handleModalClose}
        onSaved={handleSaved}
        simulationId={simulationId}
        pension={editingNational}
        defaultOwner={defaultOwner}
        birthYear={birthYear}
      />

      {/* 퇴직연금 모달 */}
      <RetirementPensionModal
        isOpen={modalType === "retirement"}
        onClose={handleModalClose}
        onSaved={handleSaved}
        simulationId={simulationId}
        pension={editingRetirement}
        defaultOwner={defaultOwner}
        birthYear={birthYear}
        retirementAge={retirementAge}
      />

      {/* 개인연금 모달 */}
      <PersonalPensionModal
        isOpen={modalType === "personal"}
        onClose={handleModalClose}
        onSaved={handleSaved}
        simulationId={simulationId}
        pension={editingPersonal}
        defaultOwner={defaultOwner}
        birthYear={birthYear}
        retirementAge={retirementAge}
      />
    </>
  );
}
