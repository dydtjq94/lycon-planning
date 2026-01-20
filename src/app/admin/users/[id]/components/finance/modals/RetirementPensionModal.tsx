import { useState, useEffect } from "react";
import { BaseModal, FormField, FormRow } from "../shared";
import {
  PENSION_TYPE_LABELS,
  RECEIVE_TYPE_LABELS,
  createRetirementPension,
  updateRetirementPension,
} from "@/lib/services/retirementPensionService";
import type {
  RetirementPension,
  RetirementPensionType,
  ReceiveType,
  Owner,
} from "@/types/tables";
import styles from "./Modal.module.css";

interface RetirementPensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  simulationId: string;
  pension: RetirementPension | null;
  defaultOwner: Owner;
  birthYear: number;
  retirementAge: number;
}

export function RetirementPensionModal({
  isOpen,
  onClose,
  onSaved,
  simulationId,
  pension,
  defaultOwner,
  birthYear,
  retirementAge,
}: RetirementPensionModalProps) {
  const [owner, setOwner] = useState<Owner>(defaultOwner);
  const [pensionType, setPensionType] = useState<RetirementPensionType>("dc");
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [yearsOfService, setYearsOfService] = useState<number | null>(null);
  const [receiveType, setReceiveType] = useState<ReceiveType>("annuity");
  const [startAge, setStartAge] = useState<number | null>(55);
  const [receivingYears, setReceivingYears] = useState<number | null>(20);
  const [returnRate, setReturnRate] = useState(5);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const isDCType = pensionType === "dc" || pensionType === "corporate_irp";

  useEffect(() => {
    if (isOpen) {
      if (pension) {
        setOwner(pension.owner);
        setPensionType(pension.pension_type);
        setCurrentBalance(pension.current_balance);
        setYearsOfService(pension.years_of_service);
        setReceiveType(pension.receive_type);
        setStartAge(pension.start_age);
        setReceivingYears(pension.receiving_years);
        setReturnRate(pension.return_rate);
        setMemo(pension.memo || "");
      } else {
        setOwner(defaultOwner);
        setPensionType("dc");
        setCurrentBalance(null);
        setYearsOfService(null);
        setReceiveType("annuity");
        setStartAge(55);
        setReceivingYears(20);
        setReturnRate(5);
        setMemo("");
      }
    }
  }, [isOpen, pension, defaultOwner]);

  const handleSave = async () => {
    if (isDCType && (!currentBalance || currentBalance <= 0)) {
      alert("현재 잔액을 입력해주세요");
      return;
    }
    if (!isDCType && (!yearsOfService || yearsOfService <= 0)) {
      alert("근속 연수를 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      const data = {
        pension_type: pensionType,
        current_balance: isDCType ? currentBalance : null,
        years_of_service: !isDCType ? yearsOfService : null,
        receive_type: receiveType,
        start_age: receiveType === "annuity" ? startAge : null,
        receiving_years: receiveType === "annuity" ? receivingYears : null,
        return_rate: returnRate,
        memo: memo.trim() || null,
      };

      if (pension) {
        await updateRetirementPension(pension.id, data, birthYear, retirementAge);
      } else {
        await createRetirementPension(
          {
            simulation_id: simulationId,
            owner,
            ...data,
          },
          birthYear,
          retirementAge
        );
      }
      onSaved();
    } catch (error) {
      console.error("Failed to save retirement pension:", error);
      alert("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={pension ? "퇴직연금 수정" : "퇴직연금 추가"}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={saving ? "저장 중..." : "저장"}
      saveDisabled={saving}
    >
      <FormRow>
        <FormField label="대상자" required>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value as Owner)}
            className={styles.select}
            disabled={!!pension}
          >
            <option value="self">본인</option>
            <option value="spouse">배우자</option>
          </select>
        </FormField>
        <FormField label="연금 유형" required>
          <select
            value={pensionType}
            onChange={(e) => setPensionType(e.target.value as RetirementPensionType)}
            className={styles.select}
          >
            {Object.entries(PENSION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
      </FormRow>

      {isDCType ? (
        <FormField label="현재 잔액" required hint="DC형/IRP 적립금">
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={currentBalance || ""}
              onChange={(e) => setCurrentBalance(Number(e.target.value) || null)}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.unit}>만원</span>
          </div>
        </FormField>
      ) : (
        <FormField label="근속 연수" required hint="DB형/퇴직금 계산용">
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={yearsOfService || ""}
              onChange={(e) => setYearsOfService(Number(e.target.value) || null)}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.unit}>년</span>
          </div>
        </FormField>
      )}

      <FormField label="예상 수익률">
        <div className={styles.inputWithUnit}>
          <input
            type="number"
            value={returnRate}
            onChange={(e) => setReturnRate(Number(e.target.value))}
            onWheel={(e) => (e.target as HTMLElement).blur()}
            step={0.5}
            className={styles.input}
          />
          <span className={styles.unit}>%</span>
        </div>
      </FormField>

      <FormField label="수령 방식" required>
        <div className={styles.buttonGroup}>
          {(Object.entries(RECEIVE_TYPE_LABELS) as [ReceiveType, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                className={`${styles.toggleBtn} ${receiveType === key ? styles.active : ""}`}
                onClick={() => setReceiveType(key)}
              >
                {label}
              </button>
            )
          )}
        </div>
      </FormField>

      {receiveType === "annuity" && (
        <FormRow>
          <FormField label="수령 시작 나이">
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                value={startAge || ""}
                onChange={(e) => setStartAge(Number(e.target.value) || null)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                min={55}
                max={80}
                placeholder="55"
                className={styles.input}
              />
              <span className={styles.unit}>세</span>
            </div>
          </FormField>
          <FormField label="수령 기간">
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                value={receivingYears || ""}
                onChange={(e) => setReceivingYears(Number(e.target.value) || null)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                min={5}
                max={40}
                placeholder="20"
                className={styles.input}
              />
              <span className={styles.unit}>년</span>
            </div>
          </FormField>
        </FormRow>
      )}

      <FormField label="메모">
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="추가 메모 (선택)"
          rows={2}
          className={styles.textarea}
        />
      </FormField>
    </BaseModal>
  );
}
