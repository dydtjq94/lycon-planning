import { useState, useEffect } from "react";
import { BaseModal, FormField, FormRow } from "../shared";
import {
  REAL_ESTATE_TYPE_LABELS,
  HOUSING_TYPE_LABELS,
  REPAYMENT_TYPE_LABELS,
  createRealEstate,
  updateRealEstate,
} from "@/lib/services/realEstateService";
import type {
  RealEstate,
  RealEstateType,
  HousingType,
  OwnerWithCommon,
  LoanRepaymentType,
  RateType,
} from "@/types/tables";
import styles from "./Modal.module.css";

interface RealEstateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  simulationId: string;
  realEstate: RealEstate | null;
  defaultType: RealEstateType;
}

export function RealEstateModal({
  isOpen,
  onClose,
  onSaved,
  simulationId,
  realEstate,
  defaultType,
}: RealEstateModalProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [type, setType] = useState<RealEstateType>(defaultType);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<OwnerWithCommon>("self");
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [growthRate, setGrowthRate] = useState(3);

  // 거주용
  const [housingType, setHousingType] = useState<HousingType | null>(null);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [monthlyRent, setMonthlyRent] = useState<number | null>(null);
  const [maintenanceFee, setMaintenanceFee] = useState<number | null>(null);

  // 임대
  const [hasRentalIncome, setHasRentalIncome] = useState(false);
  const [rentalMonthly, setRentalMonthly] = useState<number | null>(null);

  // 대출
  const [hasLoan, setHasLoan] = useState(false);
  const [loanAmount, setLoanAmount] = useState<number | null>(null);
  const [loanRate, setLoanRate] = useState<number | null>(4);
  const [loanRateType, setLoanRateType] = useState<RateType>("fixed");
  const [loanMaturityYear, setLoanMaturityYear] = useState(currentYear + 30);
  const [loanMaturityMonth, setLoanMaturityMonth] = useState(currentMonth);
  const [loanRepaymentType, setLoanRepaymentType] = useState<LoanRepaymentType>("원리금균등상환");

  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (realEstate) {
        setType(realEstate.type);
        setTitle(realEstate.title);
        setOwner(realEstate.owner);
        setCurrentValue(realEstate.current_value);
        setGrowthRate(realEstate.growth_rate);
        setHousingType(realEstate.housing_type);
        setDeposit(realEstate.deposit);
        setMonthlyRent(realEstate.monthly_rent);
        setMaintenanceFee(realEstate.maintenance_fee);
        setHasRentalIncome(realEstate.has_rental_income);
        setRentalMonthly(realEstate.rental_monthly);
        setHasLoan(realEstate.has_loan);
        setLoanAmount(realEstate.loan_amount);
        setLoanRate(realEstate.loan_rate);
        setLoanRateType(realEstate.loan_rate_type || "fixed");
        setLoanMaturityYear(realEstate.loan_maturity_year || currentYear + 30);
        setLoanMaturityMonth(realEstate.loan_maturity_month || currentMonth);
        setLoanRepaymentType(realEstate.loan_repayment_type || "원리금균등상환");
        setMemo(realEstate.memo || "");
      } else {
        setType(defaultType);
        setTitle(getDefaultTitle(defaultType));
        setOwner("self");
        setCurrentValue(0);
        setGrowthRate(3);
        setHousingType(defaultType === "residence" ? "자가" : null);
        setDeposit(null);
        setMonthlyRent(null);
        setMaintenanceFee(null);
        setHasRentalIncome(defaultType === "rental");
        setRentalMonthly(null);
        setHasLoan(false);
        setLoanAmount(null);
        setLoanRate(4);
        setLoanRateType("fixed");
        setLoanMaturityYear(currentYear + 30);
        setLoanMaturityMonth(currentMonth);
        setLoanRepaymentType("원리금균등상환");
        setMemo("");
      }
    }
  }, [isOpen, realEstate, defaultType, currentYear, currentMonth]);

  const getDefaultTitle = (t: RealEstateType) => {
    switch (t) {
      case "residence":
        return "자가 주택";
      case "investment":
        return "투자 부동산";
      case "rental":
        return "임대 부동산";
      case "land":
        return "토지";
      default:
        return "";
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("명칭을 입력해주세요");
      return;
    }
    if (!currentValue || currentValue <= 0) {
      alert("현재 가치를 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      const data = {
        type,
        title: title.trim(),
        owner,
        current_value: currentValue,
        growth_rate: growthRate,
        housing_type: type === "residence" ? housingType : null,
        deposit: type === "residence" && housingType !== "자가" ? deposit : null,
        monthly_rent: type === "residence" && housingType === "월세" ? monthlyRent : null,
        maintenance_fee: maintenanceFee,
        has_rental_income: hasRentalIncome,
        rental_monthly: hasRentalIncome ? rentalMonthly : null,
        rental_start_year: hasRentalIncome ? currentYear : null,
        rental_start_month: hasRentalIncome ? currentMonth : null,
        has_loan: hasLoan,
        loan_amount: hasLoan ? loanAmount : null,
        loan_rate: hasLoan ? loanRate : null,
        loan_rate_type: hasLoan ? loanRateType : null,
        loan_start_year: hasLoan ? currentYear : null,
        loan_start_month: hasLoan ? currentMonth : null,
        loan_maturity_year: hasLoan ? loanMaturityYear : null,
        loan_maturity_month: hasLoan ? loanMaturityMonth : null,
        loan_repayment_type: hasLoan ? loanRepaymentType : null,
        memo: memo.trim() || null,
      };

      if (realEstate) {
        await updateRealEstate(realEstate.id, data);
      } else {
        await createRealEstate({
          simulation_id: simulationId,
          ...data,
        });
      }
      onSaved();
    } catch (error) {
      console.error("Failed to save real estate:", error);
      alert("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={realEstate ? "부동산 수정" : "부동산 추가"}
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
            onChange={(e) => {
              const newType = e.target.value as RealEstateType;
              setType(newType);
              if (!realEstate) setTitle(getDefaultTitle(newType));
              if (newType === "rental") setHasRentalIncome(true);
            }}
            className={styles.select}
          >
            {Object.entries(REAL_ESTATE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="소유자" required>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value as OwnerWithCommon)}
            className={styles.select}
          >
            <option value="self">본인</option>
            <option value="spouse">배우자</option>
            <option value="common">공동</option>
          </select>
        </FormField>
      </FormRow>

      <FormField label="명칭" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 강남 아파트"
          className={styles.input}
        />
      </FormField>

      <FormRow>
        <FormField label="현재 가치" required>
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={currentValue || ""}
              onChange={(e) => setCurrentValue(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.unit}>만원</span>
          </div>
        </FormField>
        <FormField label="연 상승률">
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={growthRate}
              onChange={(e) => setGrowthRate(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              step={0.5}
              className={styles.input}
            />
            <span className={styles.unit}>%</span>
          </div>
        </FormField>
      </FormRow>

      {type === "residence" && (
        <>
          <FormField label="거주 형태">
            <div className={styles.buttonGroup}>
              {(Object.entries(HOUSING_TYPE_LABELS) as [HousingType, string][]).map(
                ([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.toggleBtn} ${housingType === key ? styles.active : ""}`}
                    onClick={() => setHousingType(key)}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </FormField>

          {housingType && housingType !== "자가" && housingType !== "무상" && (
            <FormRow>
              <FormField label="보증금">
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    value={deposit || ""}
                    onChange={(e) => setDeposit(Number(e.target.value) || null)}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="0"
                    className={styles.input}
                  />
                  <span className={styles.unit}>만원</span>
                </div>
              </FormField>
              {housingType === "월세" && (
                <FormField label="월세">
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      value={monthlyRent || ""}
                      onChange={(e) => setMonthlyRent(Number(e.target.value) || null)}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder="0"
                      className={styles.input}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                </FormField>
              )}
            </FormRow>
          )}

          <FormField label="월 관리비">
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                value={maintenanceFee || ""}
                onChange={(e) => setMaintenanceFee(Number(e.target.value) || null)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0"
                className={styles.input}
              />
              <span className={styles.unit}>만원</span>
            </div>
          </FormField>
        </>
      )}

      {(type === "rental" || type === "investment") && (
        <FormField label="임대 수익">
          <div className={styles.checkRow}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={hasRentalIncome}
                onChange={(e) => setHasRentalIncome(e.target.checked)}
              />
              <span>임대 수익 있음</span>
            </label>
          </div>
          {hasRentalIncome && (
            <div className={styles.inputWithUnit} style={{ marginTop: 8 }}>
              <input
                type="number"
                value={rentalMonthly || ""}
                onChange={(e) => setRentalMonthly(Number(e.target.value) || null)}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="월 임대료"
                className={styles.input}
              />
              <span className={styles.unit}>만원/월</span>
            </div>
          )}
        </FormField>
      )}

      <FormField label="담보 대출">
        <div className={styles.checkRow}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={hasLoan}
              onChange={(e) => setHasLoan(e.target.checked)}
            />
            <span>담보 대출 있음</span>
          </label>
        </div>
      </FormField>

      {hasLoan && (
        <>
          <FormRow>
            <FormField label="대출 금액">
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  value={loanAmount || ""}
                  onChange={(e) => setLoanAmount(Number(e.target.value) || null)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  placeholder="0"
                  className={styles.input}
                />
                <span className={styles.unit}>만원</span>
              </div>
            </FormField>
            <FormField label="연 이율">
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  value={loanRate || ""}
                  onChange={(e) => setLoanRate(Number(e.target.value) || null)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  step={0.1}
                  placeholder="4.0"
                  className={styles.input}
                />
                <span className={styles.unit}>%</span>
              </div>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="금리 유형">
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${loanRateType === "fixed" ? styles.active : ""}`}
                  onClick={() => setLoanRateType("fixed")}
                >
                  고정금리
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${loanRateType === "floating" ? styles.active : ""}`}
                  onClick={() => setLoanRateType("floating")}
                >
                  변동금리
                </button>
              </div>
            </FormField>
            <FormField label="상환 방식">
              <select
                value={loanRepaymentType}
                onChange={(e) => setLoanRepaymentType(e.target.value as LoanRepaymentType)}
                className={styles.select}
              >
                {Object.entries(REPAYMENT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
          </FormRow>

          <FormField label="만기">
            <div className={styles.yearMonth}>
              <input
                type="number"
                value={loanMaturityYear}
                onChange={(e) => setLoanMaturityYear(Number(e.target.value))}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                min={currentYear}
                max={2100}
                className={styles.input}
              />
              <span className={styles.unit}>년</span>
              <select
                value={loanMaturityMonth}
                onChange={(e) => setLoanMaturityMonth(Number(e.target.value))}
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
