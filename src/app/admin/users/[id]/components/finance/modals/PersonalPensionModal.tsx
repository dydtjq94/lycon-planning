import { useState, useEffect } from "react";
import { BaseModal, FormField, FormRow } from "../shared";
import {
  PENSION_TYPE_LABELS,
  createPersonalPension,
  updatePersonalPension,
} from "@/lib/services/personalPensionService";
import type { PersonalPension, PersonalPensionType, Owner } from "@/types/tables";
import styles from "./Modal.module.css";

interface PersonalPensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  simulationId: string;
  pension: PersonalPension | null;
  defaultOwner: Owner;
  birthYear: number;
  retirementAge: number;
}

export function PersonalPensionModal({
  isOpen,
  onClose,
  onSaved,
  simulationId,
  pension,
  defaultOwner,
  birthYear,
  retirementAge,
}: PersonalPensionModalProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [owner, setOwner] = useState<Owner>(defaultOwner);
  const [pensionType, setPensionType] = useState<PersonalPensionType>("pension_savings");
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [monthlyContribution, setMonthlyContribution] = useState<number | null>(null);
  const [isContributionFixedToRetirement, setIsContributionFixedToRetirement] = useState(true);
  const [contributionEndYear, setContributionEndYear] = useState<number | null>(null);
  const [startAge, setStartAge] = useState<number | null>(55);
  const [receivingYears, setReceivingYears] = useState<number | null>(20);
  const [returnRate, setReturnRate] = useState(5);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (pension) {
        setOwner(pension.owner);
        setPensionType(pension.pension_type);
        setCurrentBalance(pension.current_balance);
        setMonthlyContribution(pension.monthly_contribution);
        setIsContributionFixedToRetirement(pension.is_contribution_fixed_to_retirement);
        setContributionEndYear(pension.contribution_end_year);
        setStartAge(pension.start_age);
        setReceivingYears(pension.receiving_years);
        setReturnRate(pension.return_rate);
        setMemo(pension.memo || "");
      } else {
        setOwner(defaultOwner);
        setPensionType("pension_savings");
        setCurrentBalance(0);
        setMonthlyContribution(null);
        setIsContributionFixedToRetirement(true);
        setContributionEndYear(null);
        setStartAge(55);
        setReceivingYears(20);
        setReturnRate(5);
        setMemo("");
      }
    }
  }, [isOpen, pension, defaultOwner]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        pension_type: pensionType,
        current_balance: currentBalance,
        monthly_contribution: monthlyContribution,
        contribution_start_year: monthlyContribution ? currentYear : null,
        contribution_start_month: monthlyContribution ? currentMonth : null,
        contribution_end_year: isContributionFixedToRetirement ? null : contributionEndYear,
        contribution_end_month: isContributionFixedToRetirement ? null : 12,
        is_contribution_fixed_to_retirement: isContributionFixedToRetirement,
        start_age: startAge,
        receiving_years: receivingYears,
        return_rate: returnRate,
        memo: memo.trim() || null,
      };

      if (pension) {
        await updatePersonalPension(pension.id, data, birthYear, retirementAge);
      } else {
        await createPersonalPension(
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
      console.error("Failed to save personal pension:", error);
      alert("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={pension ? "개인연금 수정" : "개인연금 추가"}
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
            onChange={(e) => setPensionType(e.target.value as PersonalPensionType)}
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

      <FormRow>
        <FormField label="현재 잔액" required>
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={currentBalance || ""}
              onChange={(e) => setCurrentBalance(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.unit}>만원</span>
          </div>
        </FormField>
        <FormField label="월 적립액">
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={monthlyContribution || ""}
              onChange={(e) => setMonthlyContribution(Number(e.target.value) || null)}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.unit}>만원</span>
          </div>
        </FormField>
      </FormRow>

      {monthlyContribution && monthlyContribution > 0 && (
        <FormRow>
          <FormField label="적립 종료">
            <div className={styles.checkRow}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={isContributionFixedToRetirement}
                  onChange={(e) => setIsContributionFixedToRetirement(e.target.checked)}
                />
                <span>은퇴시까지</span>
              </label>
            </div>
          </FormField>
          {!isContributionFixedToRetirement && (
            <FormField label="적립 종료 연도">
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  value={contributionEndYear || currentYear + 10}
                  onChange={(e) => setContributionEndYear(Number(e.target.value))}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  min={currentYear}
                  max={2100}
                  className={styles.input}
                />
                <span className={styles.unit}>년</span>
              </div>
            </FormField>
          )}
        </FormRow>
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
