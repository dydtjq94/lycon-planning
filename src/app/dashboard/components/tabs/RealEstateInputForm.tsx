"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Home, Building, Plus, X } from "lucide-react";
import type { RealEstate, HousingType, LoanRepaymentType, RateType } from "@/types/tables";
import { formatMoney } from "@/lib/utils";
import styles from "./RealEstateInputForm.module.css";

interface RealEstateInputFormProps {
  missionType: "residence" | "investment";
  missionNumber: number;
  simulationId: string;
  existingData?: RealEstate[];
  onComplete: (data: RealEstateFormData[]) => Promise<void>;
  onSkip: () => void;
  onBack: () => void;
}

export interface RealEstateFormData {
  id?: string;
  type: "residence" | "investment" | "rental" | "land";
  title: string;
  owner: "self" | "spouse" | "common";
  current_value: number;
  purchase_price?: number | null;
  purchase_year?: number | null;
  purchase_month?: number | null;
  growth_rate?: number;
  // 거주용
  housing_type?: HousingType | null;
  deposit?: number | null;
  monthly_rent?: number | null;
  maintenance_fee?: number | null;
  // 대출
  has_loan: boolean;
  loan_amount?: number | null;
  loan_rate?: number | null;
  loan_rate_type?: RateType | null;
  loan_start_year?: number | null;
  loan_start_month?: number | null;
  loan_maturity_year?: number | null;
  loan_maturity_month?: number | null;
  loan_repayment_type?: LoanRepaymentType | null;
  // 임대
  has_rental_income?: boolean;
  rental_monthly?: number | null;
}

const HOUSING_TYPES: { value: HousingType; label: string }[] = [
  { value: "자가", label: "자가" },
  { value: "전세", label: "전세" },
  { value: "월세", label: "월세" },
];

const REPAYMENT_TYPES: { value: LoanRepaymentType; label: string }[] = [
  { value: "원리금균등상환", label: "원리금균등" },
  { value: "원금균등상환", label: "원금균등" },
  { value: "만기일시상환", label: "만기일시" },
  { value: "거치식상환", label: "거치식" },
];

const PROPERTY_TYPES = [
  { value: "apt", label: "아파트" },
  { value: "villa", label: "빌라/연립" },
  { value: "house", label: "단독주택" },
  { value: "officetel", label: "오피스텔" },
  { value: "commercial", label: "상가" },
  { value: "land", label: "토지" },
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

function createEmptyResidence(): RealEstateFormData {
  return {
    type: "residence",
    title: "",
    owner: "self",
    current_value: 0,
    housing_type: "자가",
    deposit: null,
    monthly_rent: null,
    maintenance_fee: null,
    has_loan: false,
    loan_amount: null,
    loan_rate: null,
    loan_rate_type: "fixed",
    loan_start_year: currentYear,
    loan_start_month: currentMonth,
    loan_maturity_year: currentYear + 30,
    loan_maturity_month: currentMonth,
    loan_repayment_type: "원리금균등상환",
  };
}

function createEmptyInvestment(): RealEstateFormData {
  return {
    type: "investment",
    title: "",
    owner: "self",
    current_value: 0,
    purchase_price: null,
    purchase_year: currentYear,
    purchase_month: currentMonth,
    growth_rate: 3,
    has_loan: false,
    loan_amount: null,
    loan_rate: null,
    loan_rate_type: "fixed",
    loan_start_year: currentYear,
    loan_start_month: currentMonth,
    loan_maturity_year: currentYear + 30,
    loan_maturity_month: currentMonth,
    loan_repayment_type: "원리금균등상환",
    has_rental_income: false,
    rental_monthly: null,
  };
}

export function RealEstateInputForm({
  missionType,
  missionNumber,
  simulationId,
  existingData,
  onComplete,
  onSkip,
  onBack,
}: RealEstateInputFormProps) {
  const [properties, setProperties] = useState<RealEstateFormData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasNoProperty, setHasNoProperty] = useState(false);

  // 기존 데이터로 초기화
  useEffect(() => {
    if (existingData && existingData.length > 0) {
      const filtered = existingData.filter((p) =>
        missionType === "residence"
          ? p.type === "residence"
          : p.type !== "residence"
      );
      if (filtered.length > 0) {
        setProperties(
          filtered.map((p) => ({
            id: p.id,
            type: p.type,
            title: p.title,
            owner: p.owner,
            current_value: p.current_value,
            purchase_price: p.purchase_price,
            purchase_year: p.purchase_year,
            purchase_month: p.purchase_month,
            growth_rate: p.growth_rate,
            housing_type: p.housing_type,
            deposit: p.deposit,
            monthly_rent: p.monthly_rent,
            maintenance_fee: p.maintenance_fee,
            has_loan: p.has_loan,
            loan_amount: p.loan_amount,
            loan_rate: p.loan_rate,
            loan_rate_type: p.loan_rate_type,
            loan_start_year: p.loan_start_year,
            loan_start_month: p.loan_start_month,
            loan_maturity_year: p.loan_maturity_year,
            loan_maturity_month: p.loan_maturity_month,
            loan_repayment_type: p.loan_repayment_type,
            has_rental_income: p.has_rental_income,
            rental_monthly: p.rental_monthly,
          }))
        );
      } else if (missionType === "residence") {
        // 거주 부동산이 없으면 빈 폼 하나 추가
        setProperties([createEmptyResidence()]);
      }
    } else if (missionType === "residence") {
      setProperties([createEmptyResidence()]);
    }
  }, [existingData, missionType]);

  const handleAddProperty = () => {
    if (missionType === "residence") {
      setProperties([createEmptyResidence()]);
    } else {
      setProperties([...properties, createEmptyInvestment()]);
    }
    setHasNoProperty(false);
  };

  const handleRemoveProperty = (index: number) => {
    setProperties(properties.filter((_, i) => i !== index));
  };

  const handleUpdateProperty = (
    index: number,
    field: keyof RealEstateFormData,
    value: unknown
  ) => {
    setProperties(
      properties.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (hasNoProperty) {
        await onComplete([]);
      } else {
        await onComplete(properties);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isResidence = missionType === "residence";

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <div className={styles.headerInfo}>
          <p className={styles.missionLabel}>Mission {missionNumber}</p>
          <h2 className={styles.title}>
            {isResidence ? "거주 부동산" : "투자/임대 부동산"}
          </h2>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className={styles.content}>
        {/* 없음 선택 (투자용만) */}
        {!isResidence && properties.length === 0 && !hasNoProperty && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Building size={32} />
            </div>
            <p className={styles.emptyText}>
              거주용 외에 보유한 부동산이 있나요?
            </p>
            <div className={styles.emptyActions}>
              <button
                className={styles.addButton}
                onClick={handleAddProperty}
              >
                <Plus size={18} />
                부동산 추가
              </button>
              <button
                className={styles.noPropertyButton}
                onClick={() => setHasNoProperty(true)}
              >
                없습니다
              </button>
            </div>
          </div>
        )}

        {/* 없음 선택됨 */}
        {hasNoProperty && (
          <div className={styles.noPropertySelected}>
            <p>투자/임대 부동산이 없습니다.</p>
            <button
              className={styles.changeButton}
              onClick={() => setHasNoProperty(false)}
            >
              변경하기
            </button>
          </div>
        )}

        {/* 부동산 목록 */}
        {properties.map((property, index) => (
          <div key={index} className={styles.propertyCard}>
            {/* 카드 헤더 */}
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <Home size={18} />
              </div>
              <span className={styles.cardTitle}>
                {isResidence
                  ? "거주 부동산"
                  : property.title || `부동산 ${index + 1}`}
              </span>
              {!isResidence && properties.length > 1 && (
                <button
                  className={styles.removeButton}
                  onClick={() => handleRemoveProperty(index)}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 기본 정보 */}
            <div className={styles.section}>
              {/* 거주 형태 (거주용만) */}
              {isResidence && (
                <div className={styles.field}>
                  <label className={styles.label}>거주 형태</label>
                  <div className={styles.buttonGroup}>
                    {HOUSING_TYPES.map((type) => (
                      <button
                        key={type.value}
                        className={`${styles.optionButton} ${
                          property.housing_type === type.value
                            ? styles.selected
                            : ""
                        }`}
                        onClick={() =>
                          handleUpdateProperty(index, "housing_type", type.value)
                        }
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 부동산명 (투자용만) */}
              {!isResidence && (
                <div className={styles.field}>
                  <label className={styles.label}>부동산명</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="예: 강남 오피스텔"
                    value={property.title}
                    onChange={(e) =>
                      handleUpdateProperty(index, "title", e.target.value)
                    }
                  />
                </div>
              )}

              {/* 자가=시세, 전세=전세금, 월세=보증금 */}
              {isResidence && property.housing_type && (
                <div className={styles.field}>
                  <label className={styles.label}>
                    {property.housing_type === "자가"
                      ? "현재 시세"
                      : property.housing_type === "전세"
                        ? "전세금"
                        : "보증금"}
                    {property.housing_type === "자가" && (
                      <span className={styles.hint}>
                        (KB시세, 네이버부동산 참고)
                      </span>
                    )}
                  </label>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.numberInput}
                      placeholder={property.housing_type === "자가" ? "50000" : "30000"}
                      value={property.current_value || ""}
                      onChange={(e) =>
                        handleUpdateProperty(
                          index,
                          "current_value",
                          e.target.value ? parseInt(e.target.value) : 0
                        )
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                  {property.current_value > 0 && (
                    <span className={styles.formatted}>
                      {formatMoney(property.current_value)}
                    </span>
                  )}
                </div>
              )}

              {/* 투자용 부동산 시세 */}
              {!isResidence && (
                <div className={styles.field}>
                  <label className={styles.label}>
                    현재 시세
                    <span className={styles.hint}>
                      (KB시세, 네이버부동산 참고)
                    </span>
                  </label>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.numberInput}
                      placeholder="50000"
                      value={property.current_value || ""}
                      onChange={(e) =>
                        handleUpdateProperty(
                          index,
                          "current_value",
                          e.target.value ? parseInt(e.target.value) : 0
                        )
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                  {property.current_value > 0 && (
                    <span className={styles.formatted}>
                      {formatMoney(property.current_value)}
                    </span>
                  )}
                </div>
              )}

              {/* 월세 (월세만) */}
              {isResidence && property.housing_type === "월세" && (
                <div className={styles.field}>
                  <label className={styles.label}>월세</label>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      className={styles.numberInput}
                      placeholder="100"
                      value={property.monthly_rent || ""}
                      onChange={(e) =>
                        handleUpdateProperty(
                          index,
                          "monthly_rent",
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                </div>
              )}

              {/* 관리비 */}
              <div className={styles.field}>
                <label className={styles.label}>월 관리비</label>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    className={styles.numberInput}
                    placeholder="30"
                    value={property.maintenance_fee || ""}
                    onChange={(e) =>
                      handleUpdateProperty(
                        index,
                        "maintenance_fee",
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                  <span className={styles.unit}>만원</span>
                </div>
              </div>
            </div>

            {/* 대출 정보 - 거주 형태에 따라 라벨 변경 */}
            {isResidence && property.housing_type && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>
                  {property.housing_type === "자가" ? "주택담보대출" : "전월세 보증금 대출"}
                </span>
                <div className={styles.toggle}>
                  <button
                    className={`${styles.toggleButton} ${
                      property.has_loan ? styles.active : ""
                    }`}
                    onClick={() =>
                      handleUpdateProperty(index, "has_loan", !property.has_loan)
                    }
                  >
                    {property.has_loan ? "있음" : "없음"}
                  </button>
                </div>
              </div>

              {property.has_loan && (
                <div className={styles.loanFields}>
                  {/* 대출 금액 */}
                  <div className={styles.field}>
                    <label className={styles.label}>대출 금액</label>
                    <div className={styles.inputWithUnit}>
                      <input
                        type="number"
                        className={styles.numberInput}
                        placeholder="30000"
                        value={property.loan_amount || ""}
                        onChange={(e) =>
                          handleUpdateProperty(
                            index,
                            "loan_amount",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.unit}>만원</span>
                    </div>
                    {property.loan_amount && property.loan_amount > 0 && (
                      <span className={styles.formatted}>
                        {formatMoney(property.loan_amount)}
                      </span>
                    )}
                  </div>

                  {/* 금리 */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldHalf}>
                      <label className={styles.label}>금리</label>
                      <div className={styles.inputWithUnit}>
                        <input
                          type="number"
                          className={styles.numberInput}
                          placeholder="4.5"
                          step="0.1"
                          value={property.loan_rate || ""}
                          onChange={(e) =>
                            handleUpdateProperty(
                              index,
                              "loan_rate",
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.unit}>%</span>
                      </div>
                    </div>
                    <div className={styles.fieldHalf}>
                      <label className={styles.label}>금리 유형</label>
                      <div className={styles.buttonGroupSmall}>
                        <button
                          className={`${styles.optionButtonSmall} ${
                            property.loan_rate_type === "fixed"
                              ? styles.selected
                              : ""
                          }`}
                          onClick={() =>
                            handleUpdateProperty(index, "loan_rate_type", "fixed")
                          }
                        >
                          고정
                        </button>
                        <button
                          className={`${styles.optionButtonSmall} ${
                            property.loan_rate_type === "floating"
                              ? styles.selected
                              : ""
                          }`}
                          onClick={() =>
                            handleUpdateProperty(
                              index,
                              "loan_rate_type",
                              "floating"
                            )
                          }
                        >
                          변동
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 상환 방식 */}
                  <div className={styles.field}>
                    <label className={styles.label}>상환 방식</label>
                    <div className={styles.buttonGroup}>
                      {REPAYMENT_TYPES.map((type) => (
                        <button
                          key={type.value}
                          className={`${styles.optionButton} ${
                            property.loan_repayment_type === type.value
                              ? styles.selected
                              : ""
                          }`}
                          onClick={() =>
                            handleUpdateProperty(
                              index,
                              "loan_repayment_type",
                              type.value
                            )
                          }
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 만기 */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldHalf}>
                      <label className={styles.label}>대출 시작</label>
                      <div className={styles.dateInputs}>
                        <input
                          type="number"
                          className={styles.yearInput}
                          placeholder="2024"
                          max={9999}
                          value={property.loan_start_year || ""}
                          onChange={(e) => {
                            if (e.target.value.length > 4) return;
                            handleUpdateProperty(
                              index,
                              "loan_start_year",
                              e.target.value ? parseInt(e.target.value) : null
                            );
                          }}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.dateSeparator}>년</span>
                        <input
                          type="number"
                          className={styles.monthInput}
                          placeholder="1"
                          min={1}
                          max={12}
                          value={property.loan_start_month || ""}
                          onChange={(e) =>
                            handleUpdateProperty(
                              index,
                              "loan_start_month",
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.dateSeparator}>월</span>
                      </div>
                    </div>
                    <div className={styles.fieldHalf}>
                      <label className={styles.label}>만기</label>
                      <div className={styles.dateInputs}>
                        <input
                          type="number"
                          className={styles.yearInput}
                          placeholder="2054"
                          max={9999}
                          value={property.loan_maturity_year || ""}
                          onChange={(e) => {
                            if (e.target.value.length > 4) return;
                            handleUpdateProperty(
                              index,
                              "loan_maturity_year",
                              e.target.value ? parseInt(e.target.value) : null
                            );
                          }}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.dateSeparator}>년</span>
                        <input
                          type="number"
                          className={styles.monthInput}
                          placeholder="1"
                          min={1}
                          max={12}
                          value={property.loan_maturity_month || ""}
                          onChange={(e) =>
                            handleUpdateProperty(
                              index,
                              "loan_maturity_month",
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.dateSeparator}>월</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* 투자용 대출 정보 */}
            {!isResidence && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>대출 정보</span>
                <div className={styles.toggle}>
                  <button
                    className={`${styles.toggleButton} ${
                      property.has_loan ? styles.active : ""
                    }`}
                    onClick={() =>
                      handleUpdateProperty(index, "has_loan", !property.has_loan)
                    }
                  >
                    {property.has_loan ? "있음" : "없음"}
                  </button>
                </div>
              </div>

              {property.has_loan && (
                <div className={styles.loanFields}>
                  {/* 대출 금액 */}
                  <div className={styles.field}>
                    <label className={styles.label}>대출 금액</label>
                    <div className={styles.inputWithUnit}>
                      <input
                        type="number"
                        className={styles.numberInput}
                        placeholder="30000"
                        value={property.loan_amount || ""}
                        onChange={(e) =>
                          handleUpdateProperty(
                            index,
                            "loan_amount",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.unit}>만원</span>
                    </div>
                  </div>

                  {/* 금리 */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldHalf}>
                      <label className={styles.label}>금리</label>
                      <div className={styles.inputWithUnit}>
                        <input
                          type="number"
                          className={styles.numberInput}
                          placeholder="4.5"
                          step="0.1"
                          value={property.loan_rate || ""}
                          onChange={(e) =>
                            handleUpdateProperty(
                              index,
                              "loan_rate",
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.unit}>%</span>
                      </div>
                    </div>
                    <div className={styles.fieldHalf}>
                      <label className={styles.label}>금리 유형</label>
                      <div className={styles.buttonGroupSmall}>
                        <button
                          className={`${styles.optionButtonSmall} ${
                            property.loan_rate_type === "fixed"
                              ? styles.selected
                              : ""
                          }`}
                          onClick={() =>
                            handleUpdateProperty(index, "loan_rate_type", "fixed")
                          }
                        >
                          고정
                        </button>
                        <button
                          className={`${styles.optionButtonSmall} ${
                            property.loan_rate_type === "floating"
                              ? styles.selected
                              : ""
                          }`}
                          onClick={() =>
                            handleUpdateProperty(
                              index,
                              "loan_rate_type",
                              "floating"
                            )
                          }
                        >
                          변동
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 상환 방식 */}
                  <div className={styles.field}>
                    <label className={styles.label}>상환 방식</label>
                    <div className={styles.buttonGroup}>
                      {REPAYMENT_TYPES.map((type) => (
                        <button
                          key={type.value}
                          className={`${styles.optionButton} ${
                            property.loan_repayment_type === type.value
                              ? styles.selected
                              : ""
                          }`}
                          onClick={() =>
                            handleUpdateProperty(
                              index,
                              "loan_repayment_type",
                              type.value
                            )
                          }
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 만기 */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldHalf}>
                      <label className={styles.label}>대출 시작</label>
                      <div className={styles.dateInputs}>
                        <input
                          type="number"
                          className={styles.yearInput}
                          placeholder="2024"
                          max={9999}
                          value={property.loan_start_year || ""}
                          onChange={(e) => {
                            if (e.target.value.length > 4) return;
                            handleUpdateProperty(
                              index,
                              "loan_start_year",
                              e.target.value ? parseInt(e.target.value) : null
                            );
                          }}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.dateSeparator}>년</span>
                        <input
                          type="number"
                          className={styles.monthInput}
                          placeholder="1"
                          min={1}
                          max={12}
                          value={property.loan_start_month || ""}
                          onChange={(e) =>
                            handleUpdateProperty(
                              index,
                              "loan_start_month",
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.dateSeparator}>월</span>
                      </div>
                    </div>
                    <div className={styles.fieldHalf}>
                      <label className={styles.label}>만기</label>
                      <div className={styles.dateInputs}>
                        <input
                          type="number"
                          className={styles.yearInput}
                          placeholder="2054"
                          max={9999}
                          value={property.loan_maturity_year || ""}
                          onChange={(e) => {
                            if (e.target.value.length > 4) return;
                            handleUpdateProperty(
                              index,
                              "loan_maturity_year",
                              e.target.value ? parseInt(e.target.value) : null
                            );
                          }}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.dateSeparator}>년</span>
                        <input
                          type="number"
                          className={styles.monthInput}
                          placeholder="1"
                          min={1}
                          max={12}
                          value={property.loan_maturity_month || ""}
                          onChange={(e) =>
                            handleUpdateProperty(
                              index,
                              "loan_maturity_month",
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                        <span className={styles.dateSeparator}>월</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* 임대 수익 (투자용만) */}
            {!isResidence && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>임대 수익</span>
                  <div className={styles.toggle}>
                    <button
                      className={`${styles.toggleButton} ${
                        property.has_rental_income ? styles.active : ""
                      }`}
                      onClick={() =>
                        handleUpdateProperty(
                          index,
                          "has_rental_income",
                          !property.has_rental_income
                        )
                      }
                    >
                      {property.has_rental_income ? "있음" : "없음"}
                    </button>
                  </div>
                </div>

                {property.has_rental_income && (
                  <div className={styles.field}>
                    <label className={styles.label}>월 임대료</label>
                    <div className={styles.inputWithUnit}>
                      <input
                        type="number"
                        className={styles.numberInput}
                        placeholder="100"
                        value={property.rental_monthly || ""}
                        onChange={(e) =>
                          handleUpdateProperty(
                            index,
                            "rental_monthly",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.unit}>만원</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* 추가 버튼 (투자용만, 이미 부동산이 있을 때) */}
        {!isResidence && properties.length > 0 && !hasNoProperty && (
          <button className={styles.addMoreButton} onClick={handleAddProperty}>
            <Plus size={18} />
            부동산 추가
          </button>
        )}
      </div>

      {/* 하단 액션 */}
      <div className={styles.footer}>
        <div className={styles.buttonRow}>
          <button className={styles.skipButton} onClick={onSkip}>
            건너뛰기
          </button>
          <button
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "저장 중..." : "완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
