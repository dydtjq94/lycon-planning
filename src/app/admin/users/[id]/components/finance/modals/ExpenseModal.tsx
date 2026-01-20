import { useState, useEffect } from "react";
import { BaseModal, FormField, FormRow } from "../shared";
import { EXPENSE_TYPE_LABELS, EXPENSE_TYPE_DEFAULTS, createExpense, updateExpense } from "@/lib/services/expenseService";
import type { Expense, ExpenseType, Frequency } from "@/types/tables";
import styles from "./Modal.module.css";

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  simulationId: string;
  expense: Expense | null;
  defaultType: ExpenseType;
}

export function ExpenseModal({
  isOpen,
  onClose,
  onSaved,
  simulationId,
  expense,
  defaultType,
}: ExpenseModalProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [type, setType] = useState<ExpenseType>(defaultType);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endYear, setEndYear] = useState<number | null>(null);
  const [endMonth, setEndMonth] = useState<number | null>(null);
  const [isFixedToRetirement, setIsFixedToRetirement] = useState(true);
  const [growthRate, setGrowthRate] = useState(2.5);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (expense) {
        setType(expense.type);
        setTitle(expense.title);
        setAmount(expense.amount);
        setFrequency(expense.frequency);
        setStartYear(expense.start_year);
        setStartMonth(expense.start_month);
        setEndYear(expense.end_year);
        setEndMonth(expense.end_month);
        setIsFixedToRetirement(expense.is_fixed_to_retirement);
        setGrowthRate(expense.growth_rate);
        setMemo(expense.memo || "");
      } else {
        setType(defaultType);
        setTitle(EXPENSE_TYPE_LABELS[defaultType] || "");
        setAmount(0);
        setFrequency("monthly");
        setStartYear(currentYear);
        setStartMonth(currentMonth);
        setEndYear(null);
        setEndMonth(null);
        setIsFixedToRetirement(true);
        setGrowthRate(EXPENSE_TYPE_DEFAULTS[defaultType]?.growthRate || 2.5);
        setMemo("");
      }
    }
  }, [isOpen, expense, defaultType, currentYear, currentMonth]);

  const handleTypeChange = (newType: ExpenseType) => {
    setType(newType);
    if (!expense) {
      setTitle(EXPENSE_TYPE_LABELS[newType] || "");
      setGrowthRate(EXPENSE_TYPE_DEFAULTS[newType]?.growthRate || 2.5);
    }
  };

  const handleSave = async () => {
    if (!amount || amount <= 0) {
      alert("금액을 입력해주세요");
      return;
    }
    if (!title.trim()) {
      alert("항목명을 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      const defaults = EXPENSE_TYPE_DEFAULTS[type] || { rateCategory: "inflation", growthRate: 2.5 };

      if (expense) {
        await updateExpense(expense.id, {
          type,
          title: title.trim(),
          amount,
          frequency,
          start_year: startYear,
          start_month: startMonth,
          end_year: isFixedToRetirement ? null : endYear,
          end_month: isFixedToRetirement ? null : endMonth,
          is_fixed_to_retirement: isFixedToRetirement,
          growth_rate: growthRate,
          rate_category: defaults.rateCategory,
          memo: memo.trim() || null,
        });
      } else {
        await createExpense({
          simulation_id: simulationId,
          type,
          title: title.trim(),
          amount,
          frequency,
          start_year: startYear,
          start_month: startMonth,
          end_year: isFixedToRetirement ? null : endYear,
          end_month: isFixedToRetirement ? null : endMonth,
          is_fixed_to_retirement: isFixedToRetirement,
          growth_rate: growthRate,
          rate_category: defaults.rateCategory,
          memo: memo.trim() || null,
        });
      }
      onSaved();
    } catch (error) {
      console.error("Failed to save expense:", error);
      alert("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={expense ? "지출 수정" : "지출 추가"}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={saving ? "저장 중..." : "저장"}
      saveDisabled={saving}
    >
      <FormField label="지출 유형" required>
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as ExpenseType)}
          className={styles.select}
        >
          {Object.entries(EXPENSE_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="항목명" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 월 생활비"
          className={styles.input}
        />
      </FormField>

      <FormRow>
        <FormField label="금액" required>
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.unit}>만원</span>
          </div>
        </FormField>
        <FormField label="주기" required>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className={styles.select}
          >
            <option value="monthly">월</option>
            <option value="yearly">년</option>
          </select>
        </FormField>
      </FormRow>

      <FormRow>
        <FormField label="시작 연월" required>
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
        <FormField label="종료">
          <div className={styles.checkRow}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={isFixedToRetirement}
                onChange={(e) => setIsFixedToRetirement(e.target.checked)}
              />
              <span>계속 지출</span>
            </label>
          </div>
        </FormField>
      </FormRow>

      {!isFixedToRetirement && (
        <FormRow>
          <FormField label="종료 연월">
            <div className={styles.yearMonth}>
              <input
                type="number"
                value={endYear || currentYear + 10}
                onChange={(e) => setEndYear(Number(e.target.value))}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                min={startYear}
                max={2100}
                className={styles.input}
              />
              <span className={styles.unit}>년</span>
              <select
                value={endMonth || 12}
                onChange={(e) => setEndMonth(Number(e.target.value))}
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
          <div />
        </FormRow>
      )}

      <FormField label="연 상승률" hint="물가상승률 반영">
        <div className={styles.inputWithUnit}>
          <input
            type="number"
            value={growthRate}
            onChange={(e) => setGrowthRate(Number(e.target.value))}
            onWheel={(e) => (e.target as HTMLElement).blur()}
            step={0.1}
            className={styles.input}
          />
          <span className={styles.unit}>%</span>
        </div>
      </FormField>

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
