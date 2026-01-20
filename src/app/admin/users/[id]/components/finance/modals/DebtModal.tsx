import { useState, useEffect } from "react";
import { BaseModal, FormField, FormRow } from "../shared";
import {
  DEBT_TYPE_LABELS,
  REPAYMENT_TYPE_LABELS,
  createDebt,
  updateDebt,
} from "@/lib/services/debtService";
import type { Debt, DebtType, LoanRepaymentType, RateType } from "@/types/tables";
import styles from "./Modal.module.css";

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  simulationId: string;
  debt: Debt | null;
  defaultType: DebtType;
}

export function DebtModal({
  isOpen,
  onClose,
  onSaved,
  simulationId,
  debt,
  defaultType,
}: DebtModalProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [type, setType] = useState<DebtType>(defaultType);
  const [title, setTitle] = useState("");
  const [principal, setPrincipal] = useState<number>(0);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [interestRate, setInterestRate] = useState(5);
  const [rateType, setRateType] = useState<RateType>("fixed");
  const [repaymentType, setRepaymentType] = useState<LoanRepaymentType>("원리금균등상환");
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [maturityYear, setMaturityYear] = useState(currentYear + 5);
  const [maturityMonth, setMaturityMonth] = useState(currentMonth);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (debt) {
        setType(debt.type);
        setTitle(debt.title);
        setPrincipal(debt.principal);
        setCurrentBalance(debt.current_balance);
        setInterestRate(debt.interest_rate);
        setRateType(debt.rate_type);
        setRepaymentType(debt.repayment_type);
        setStartYear(debt.start_year);
        setStartMonth(debt.start_month);
        setMaturityYear(debt.maturity_year);
        setMaturityMonth(debt.maturity_month);
        setMemo(debt.memo || "");
      } else {
        setType(defaultType);
        setTitle(DEBT_TYPE_LABELS[defaultType] || "");
        setPrincipal(0);
        setCurrentBalance(null);
        setInterestRate(5);
        setRateType("fixed");
        setRepaymentType("원리금균등상환");
        setStartYear(currentYear);
        setStartMonth(currentMonth);
        setMaturityYear(currentYear + 5);
        setMaturityMonth(currentMonth);
        setMemo("");
      }
    }
  }, [isOpen, debt, defaultType, currentYear, currentMonth]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert("명칭을 입력해주세요");
      return;
    }
    if (!principal || principal <= 0) {
      alert("원금을 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      const data = {
        type,
        title: title.trim(),
        principal,
        current_balance: currentBalance ?? principal,
        interest_rate: interestRate,
        rate_type: rateType,
        repayment_type: repaymentType,
        start_year: startYear,
        start_month: startMonth,
        maturity_year: maturityYear,
        maturity_month: maturityMonth,
        memo: memo.trim() || null,
      };

      if (debt) {
        await updateDebt(debt.id, data);
      } else {
        await createDebt({
          simulation_id: simulationId,
          ...data,
        });
      }
      onSaved();
    } catch (error) {
      console.error("Failed to save debt:", error);
      alert("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={debt ? "부채 수정" : "부채 추가"}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={saving ? "저장 중..." : "저장"}
      saveDisabled={saving}
    >
      <FormField label="부채 유형" required>
        <select
          value={type}
          onChange={(e) => {
            const newType = e.target.value as DebtType;
            setType(newType);
            if (!debt) setTitle(DEBT_TYPE_LABELS[newType] || "");
          }}
          className={styles.select}
        >
          {Object.entries(DEBT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="명칭" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: KB 신용대출"
          className={styles.input}
        />
      </FormField>

      <FormRow>
        <FormField label="원금" required>
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={principal || ""}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.unit}>만원</span>
          </div>
        </FormField>
        <FormField label="현재 잔액" hint="비워두면 원금으로 설정">
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={currentBalance ?? ""}
              onChange={(e) => setCurrentBalance(Number(e.target.value) || null)}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder={String(principal || 0)}
              className={styles.input}
            />
            <span className={styles.unit}>만원</span>
          </div>
        </FormField>
      </FormRow>

      <FormRow>
        <FormField label="연 이자율" required>
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              step={0.1}
              className={styles.input}
            />
            <span className={styles.unit}>%</span>
          </div>
        </FormField>
        <FormField label="금리 유형">
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${rateType === "fixed" ? styles.active : ""}`}
              onClick={() => setRateType("fixed")}
            >
              고정금리
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${rateType === "floating" ? styles.active : ""}`}
              onClick={() => setRateType("floating")}
            >
              변동금리
            </button>
          </div>
        </FormField>
      </FormRow>

      <FormField label="상환 방식" required>
        <select
          value={repaymentType}
          onChange={(e) => setRepaymentType(e.target.value as LoanRepaymentType)}
          className={styles.select}
        >
          {Object.entries(REPAYMENT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </FormField>

      <FormRow>
        <FormField label="대출 시작">
          <div className={styles.yearMonth}>
            <input
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              min={2000}
              max={2100}
              className={styles.input}
            />
            <span className={styles.unit}>년</span>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
              className={styles.select}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </div>
        </FormField>
        <FormField label="만기">
          <div className={styles.yearMonth}>
            <input
              type="number"
              value={maturityYear}
              onChange={(e) => setMaturityYear(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              min={startYear}
              max={2100}
              className={styles.input}
            />
            <span className={styles.unit}>년</span>
            <select
              value={maturityMonth}
              onChange={(e) => setMaturityMonth(Number(e.target.value))}
              className={styles.select}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
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
