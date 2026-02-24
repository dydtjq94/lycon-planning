import { useState, useEffect } from "react";
import { BaseModal, FormField, FormRow } from "../shared";
import { INCOME_TYPE_LABELS, INCOME_TYPE_DEFAULTS } from "@/lib/services/incomeService";
import { createIncome, updateIncome } from "@/lib/services/incomeService";
import type { Income, IncomeType, Owner, Frequency } from "@/types/tables";
import styles from "./Modal.module.css";

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  simulationId: string;
  income: Income | null;
  defaultType: IncomeType;
}

export function IncomeModal({
  isOpen,
  onClose,
  onSaved,
  simulationId,
  income,
  defaultType,
}: IncomeModalProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [type, setType] = useState<IncomeType>(defaultType);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Owner>("self");
  const [amount, setAmount] = useState<number>(0);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endYear, setEndYear] = useState<number | null>(null);
  const [endMonth, setEndMonth] = useState<number | null>(null);
  const [isFixedToRetirement, setIsFixedToRetirement] = useState(true);
  const [growthRate, setGrowthRate] = useState(3.0);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (income) {
        setType(income.type);
        setTitle(income.title);
        setOwner(income.owner);
        setAmount(income.amount);
        setFrequency(income.frequency);
        setStartYear(income.start_year);
        setStartMonth(income.start_month);
        setEndYear(income.end_year);
        setEndMonth(income.end_month);
        setIsFixedToRetirement(income.is_fixed_to_retirement);
        setGrowthRate(income.growth_rate);
        setMemo(income.memo || "");
      } else {
        setType(defaultType);
        setTitle(getTitleFromType(defaultType, "self"));
        setOwner("self");
        setAmount(0);
        setFrequency("monthly");
        setStartYear(currentYear);
        setStartMonth(currentMonth);
        setEndYear(null);
        setEndMonth(null);
        setIsFixedToRetirement(true);
        setGrowthRate(INCOME_TYPE_DEFAULTS[defaultType]?.growthRate || 3.0);
        setMemo("");
      }
    }
  }, [isOpen, income, defaultType, currentYear, currentMonth]);

  const getTitleFromType = (t: IncomeType, o: Owner) => {
    const ownerLabel = o === "self" ? "본인" : "배우자";
    return `${ownerLabel} ${INCOME_TYPE_LABELS[t]}`;
  };

  const handleTypeChange = (newType: IncomeType) => {
    setType(newType);
    if (!income) {
      setTitle(getTitleFromType(newType, owner));
      setGrowthRate(INCOME_TYPE_DEFAULTS[newType]?.growthRate || 3.0);
    }
  };

  const handleOwnerChange = (newOwner: Owner) => {
    setOwner(newOwner);
    if (!income) {
      setTitle(getTitleFromType(type, newOwner));
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
      const defaults = INCOME_TYPE_DEFAULTS[type] || { rateCategory: "income", growthRate: 3.0 };

      if (income) {
        await updateIncome(income.id, {
          type,
          title: title.trim(),
          owner,
          amount,
          frequency,
          start_year: startYear,
          start_month: startMonth,
          end_year: isFixedToRetirement ? null : endYear,
          end_month: isFixedToRetirement ? null : endMonth,
          is_fixed_to_retirement: isFixedToRetirement,
          retirement_link: isFixedToRetirement ? owner : null,
          growth_rate: growthRate,
          rate_category: defaults.rateCategory,
          memo: memo.trim() || null,
        });
      } else {
        await createIncome({
          simulation_id: simulationId,
          type,
          title: title.trim(),
          owner,
          amount,
          frequency,
          start_year: startYear,
          start_month: startMonth,
          end_year: isFixedToRetirement ? null : endYear,
          end_month: isFixedToRetirement ? null : endMonth,
          is_fixed_to_retirement: isFixedToRetirement,
          retirement_link: isFixedToRetirement ? owner : null,
          growth_rate: growthRate,
          rate_category: defaults.rateCategory,
          memo: memo.trim() || null,
        });
      }
      onSaved();
    } catch (error) {
      console.error("Failed to save income:", error);
      alert("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={income ? "소득 수정" : "소득 추가"}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={saving ? "저장 중..." : "저장"}
      saveDisabled={saving}
    >
      <FormRow>
        <FormField label="소득 유형" required>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as IncomeType)}
            className={styles.select}
          >
            {Object.entries(INCOME_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="귀속자" required>
          <select
            value={owner}
            onChange={(e) => handleOwnerChange(e.target.value as Owner)}
            className={styles.select}
          >
            <option value="self">본인</option>
            <option value="spouse">배우자</option>
          </select>
        </FormField>
      </FormRow>

      <FormField label="항목명" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 본인 급여"
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
              onChange={(e) => {
                if (e.target.value.length > 4) return;
                setStartYear(Number(e.target.value));
              }}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              min={2000}
              max={9999}
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
              <span>은퇴시까지</span>
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
                onChange={(e) => {
                  if (e.target.value.length > 4) return;
                  setEndYear(Number(e.target.value));
                }}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                min={startYear}
                max={9999}
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

      <FormField label="연 상승률" hint="물가상승 등을 반영한 연간 증가율">
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
