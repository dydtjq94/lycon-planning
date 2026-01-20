import { useState, useEffect } from "react";
import { BaseModal, FormField, FormRow } from "../shared";
import { ALL_SAVINGS_TYPE_LABELS, createSavings, updateSavings, isSavingsType } from "@/lib/services/savingsService";
import type { Savings, SavingsType, Owner } from "@/types/tables";
import styles from "./Modal.module.css";

interface SavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  simulationId: string;
  savings: Savings | null;
  defaultType: SavingsType;
}

export function SavingsModal({
  isOpen,
  onClose,
  onSaved,
  simulationId,
  savings,
  defaultType,
}: SavingsModalProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [type, setType] = useState<SavingsType>(defaultType);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Owner>("self");
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [monthlyContribution, setMonthlyContribution] = useState<number | null>(null);
  const [contributionEndYear, setContributionEndYear] = useState<number | null>(null);
  const [contributionEndMonth, setContributionEndMonth] = useState<number | null>(null);
  const [isContributionFixedToRetirement, setIsContributionFixedToRetirement] = useState(true);
  const [interestRate, setInterestRate] = useState<number | null>(null);
  const [expectedReturn, setExpectedReturn] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const isSavingsAccount = isSavingsType(type);

  useEffect(() => {
    if (isOpen) {
      if (savings) {
        setType(savings.type);
        setTitle(savings.title);
        setOwner(savings.owner);
        setCurrentBalance(savings.current_balance);
        setMonthlyContribution(savings.monthly_contribution);
        setContributionEndYear(savings.contribution_end_year);
        setContributionEndMonth(savings.contribution_end_month);
        setIsContributionFixedToRetirement(savings.is_contribution_fixed_to_retirement);
        setInterestRate(savings.interest_rate);
        setExpectedReturn(savings.expected_return);
        setMemo(savings.memo || "");
      } else {
        setType(defaultType);
        setTitle(ALL_SAVINGS_TYPE_LABELS[defaultType] || "");
        setOwner("self");
        setCurrentBalance(0);
        setMonthlyContribution(null);
        setContributionEndYear(null);
        setContributionEndMonth(null);
        setIsContributionFixedToRetirement(true);
        setInterestRate(isSavingsType(defaultType) ? 3.0 : null);
        setExpectedReturn(isSavingsType(defaultType) ? null : 5.0);
        setMemo("");
      }
    }
  }, [isOpen, savings, defaultType]);

  const handleTypeChange = (newType: SavingsType) => {
    setType(newType);
    if (!savings) {
      setTitle(ALL_SAVINGS_TYPE_LABELS[newType] || "");
      if (isSavingsType(newType)) {
        setInterestRate(3.0);
        setExpectedReturn(null);
      } else {
        setInterestRate(null);
        setExpectedReturn(5.0);
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("항목명을 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      const data = {
        type,
        title: title.trim(),
        owner,
        current_balance: currentBalance,
        monthly_contribution: monthlyContribution,
        contribution_start_year: monthlyContribution ? currentYear : null,
        contribution_start_month: monthlyContribution ? currentMonth : null,
        contribution_end_year: isContributionFixedToRetirement ? null : contributionEndYear,
        contribution_end_month: isContributionFixedToRetirement ? null : contributionEndMonth,
        is_contribution_fixed_to_retirement: isContributionFixedToRetirement,
        interest_rate: interestRate,
        expected_return: expectedReturn,
        memo: memo.trim() || null,
      };

      if (savings) {
        await updateSavings(savings.id, data);
      } else {
        await createSavings({
          simulation_id: simulationId,
          ...data,
        });
      }
      onSaved();
    } catch (error) {
      console.error("Failed to save savings:", error);
      alert("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={savings ? "저축/투자 수정" : "저축/투자 추가"}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={saving ? "저장 중..." : "저장"}
      saveDisabled={saving}
    >
      <FormRow>
        <FormField label="유형" required>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as SavingsType)}
            className={styles.select}
          >
            {Object.entries(ALL_SAVINGS_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="귀속자" required>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value as Owner)}
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
          placeholder="예: 비상금 통장"
          className={styles.input}
        />
      </FormField>

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
            <FormField label="종료 연월">
              <div className={styles.yearMonth}>
                <input
                  type="number"
                  value={contributionEndYear || currentYear + 5}
                  onChange={(e) => setContributionEndYear(Number(e.target.value))}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  min={currentYear}
                  max={2100}
                  className={styles.input}
                />
                <span className={styles.unit}>년</span>
                <select
                  value={contributionEndMonth || 12}
                  onChange={(e) => setContributionEndMonth(Number(e.target.value))}
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
          )}
        </FormRow>
      )}

      {isSavingsAccount ? (
        <FormField label="연 이자율" hint="예금/적금 이자율">
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={interestRate ?? ""}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              step={0.1}
              placeholder="3.0"
              className={styles.input}
            />
            <span className={styles.unit}>%</span>
          </div>
        </FormField>
      ) : (
        <FormField label="기대 수익률" hint="투자 예상 연 수익률">
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={expectedReturn ?? ""}
              onChange={(e) => setExpectedReturn(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              step={0.1}
              placeholder="5.0"
              className={styles.input}
            />
            <span className={styles.unit}>%</span>
          </div>
        </FormField>
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
