import { useState, useEffect } from "react";
import { BaseModal, FormField, FormRow } from "../shared";
import {
  INSURANCE_TYPE_LABELS,
  getInsuranceCategory,
  createInsurance,
  updateInsurance,
} from "@/lib/services/insuranceService";
import type { Insurance, InsuranceType, Owner } from "@/types/tables";
import styles from "./Modal.module.css";

interface InsuranceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  simulationId: string;
  insurance: Insurance | null;
  defaultType: InsuranceType;
}

export function InsuranceModal({
  isOpen,
  onClose,
  onSaved,
  simulationId,
  insurance,
  defaultType,
}: InsuranceModalProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [type, setType] = useState<InsuranceType>(defaultType);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Owner>("self");
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [monthlyPremium, setMonthlyPremium] = useState<number>(0);
  const [isPremiumFixedToRetirement, setIsPremiumFixedToRetirement] = useState(false);
  const [premiumEndYear, setPremiumEndYear] = useState<number | null>(null);
  const [premiumEndMonth, setPremiumEndMonth] = useState<number | null>(null);
  const [coverageAmount, setCoverageAmount] = useState<number | null>(null);
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [maturityAmount, setMaturityAmount] = useState<number | null>(null);
  const [pensionStartAge, setPensionStartAge] = useState<number | null>(null);
  const [pensionReceivingYears, setPensionReceivingYears] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const isSavingsType = getInsuranceCategory(type) === "savings";

  useEffect(() => {
    if (isOpen) {
      if (insurance) {
        setType(insurance.type);
        setTitle(insurance.title);
        setOwner(insurance.owner);
        setInsuranceCompany(insurance.insurance_company || "");
        setMonthlyPremium(insurance.monthly_premium);
        setIsPremiumFixedToRetirement(insurance.is_premium_fixed_to_retirement);
        setPremiumEndYear(insurance.premium_end_year);
        setPremiumEndMonth(insurance.premium_end_month);
        setCoverageAmount(insurance.coverage_amount);
        setCurrentValue(insurance.current_value);
        setMaturityAmount(insurance.maturity_amount);
        setPensionStartAge(insurance.pension_start_age);
        setPensionReceivingYears(insurance.pension_receiving_years);
        setMemo(insurance.memo || "");
      } else {
        setType(defaultType);
        setTitle(INSURANCE_TYPE_LABELS[defaultType] || "");
        setOwner("self");
        setInsuranceCompany("");
        setMonthlyPremium(0);
        setIsPremiumFixedToRetirement(false);
        setPremiumEndYear(null);
        setPremiumEndMonth(null);
        setCoverageAmount(null);
        setCurrentValue(null);
        setMaturityAmount(null);
        setPensionStartAge(defaultType === "pension" ? 60 : null);
        setPensionReceivingYears(defaultType === "pension" ? 20 : null);
        setMemo("");
      }
    }
  }, [isOpen, insurance, defaultType]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert("보험명을 입력해주세요");
      return;
    }
    if (!monthlyPremium || monthlyPremium <= 0) {
      alert("월 보험료를 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      const data = {
        type,
        title: title.trim(),
        owner,
        insurance_company: insuranceCompany.trim() || null,
        monthly_premium: monthlyPremium,
        premium_start_year: currentYear,
        premium_start_month: currentMonth,
        premium_end_year: isPremiumFixedToRetirement ? null : premiumEndYear,
        premium_end_month: isPremiumFixedToRetirement ? null : premiumEndMonth,
        is_premium_fixed_to_retirement: isPremiumFixedToRetirement,
        coverage_amount: !isSavingsType ? coverageAmount : null,
        current_value: isSavingsType ? currentValue : null,
        maturity_amount: isSavingsType ? maturityAmount : null,
        pension_start_age: type === "pension" ? pensionStartAge : null,
        pension_receiving_years: type === "pension" ? pensionReceivingYears : null,
        memo: memo.trim() || null,
      };

      if (insurance) {
        await updateInsurance(insurance.id, data);
      } else {
        await createInsurance({
          simulation_id: simulationId,
          ...data,
        });
      }
      onSaved();
    } catch (error) {
      console.error("Failed to save insurance:", error);
      alert("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={insurance ? "보험 수정" : "보험 추가"}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={saving ? "저장 중..." : "저장"}
      saveDisabled={saving}
    >
      <FormRow>
        <FormField label="보험 유형" required>
          <select
            value={type}
            onChange={(e) => {
              const newType = e.target.value as InsuranceType;
              setType(newType);
              if (!insurance) setTitle(INSURANCE_TYPE_LABELS[newType] || "");
            }}
            className={styles.select}
          >
            {Object.entries(INSURANCE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="피보험자" required>
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

      <FormRow>
        <FormField label="보험명" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 삼성생명 종신보험"
            className={styles.input}
          />
        </FormField>
        <FormField label="보험사">
          <input
            type="text"
            value={insuranceCompany}
            onChange={(e) => setInsuranceCompany(e.target.value)}
            placeholder="예: 삼성생명"
            className={styles.input}
          />
        </FormField>
      </FormRow>

      <FormRow>
        <FormField label="월 보험료" required>
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={monthlyPremium || ""}
              onChange={(e) => setMonthlyPremium(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.unit}>만원</span>
          </div>
        </FormField>
        <FormField label="납입 종료">
          <div className={styles.checkRow}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={isPremiumFixedToRetirement}
                onChange={(e) => setIsPremiumFixedToRetirement(e.target.checked)}
              />
              <span>계속 납입</span>
            </label>
          </div>
        </FormField>
      </FormRow>

      {!isPremiumFixedToRetirement && (
        <FormField label="납입 종료 연월">
          <div className={styles.yearMonth}>
            <input
              type="number"
              value={premiumEndYear || currentYear + 10}
              onChange={(e) => setPremiumEndYear(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              min={currentYear}
              max={2100}
              className={styles.input}
            />
            <span className={styles.unit}>년</span>
            <select
              value={premiumEndMonth || 12}
              onChange={(e) => setPremiumEndMonth(Number(e.target.value))}
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

      {!isSavingsType && (
        <FormField label="보장금액" hint="사망/질병 보장액">
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={coverageAmount || ""}
              onChange={(e) => setCoverageAmount(Number(e.target.value) || null)}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.unit}>만원</span>
          </div>
        </FormField>
      )}

      {isSavingsType && (
        <>
          <FormRow>
            <FormField label="현재 해지환급금">
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  value={currentValue || ""}
                  onChange={(e) => setCurrentValue(Number(e.target.value) || null)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  placeholder="0"
                  className={styles.input}
                />
                <span className={styles.unit}>만원</span>
              </div>
            </FormField>
            <FormField label="만기 예상금액">
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  value={maturityAmount || ""}
                  onChange={(e) => setMaturityAmount(Number(e.target.value) || null)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  placeholder="0"
                  className={styles.input}
                />
                <span className={styles.unit}>만원</span>
              </div>
            </FormField>
          </FormRow>

          {type === "pension" && (
            <FormRow>
              <FormField label="연금 개시 나이">
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    value={pensionStartAge || ""}
                    onChange={(e) => setPensionStartAge(Number(e.target.value) || null)}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="60"
                    className={styles.input}
                  />
                  <span className={styles.unit}>세</span>
                </div>
              </FormField>
              <FormField label="수령 기간">
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    value={pensionReceivingYears || ""}
                    onChange={(e) => setPensionReceivingYears(Number(e.target.value) || null)}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="20"
                    className={styles.input}
                  />
                  <span className={styles.unit}>년</span>
                </div>
              </FormField>
            </FormRow>
          )}
        </>
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
