"use client";

import { MoneyInput } from "@/components/ui/money-input";
import type { OnboardingData } from "@/types";
import type { RowInputProps, RowId } from "../types";
import styles from "../../../onboarding.module.css";

type FrequencyType = 'monthly' | 'yearly';

// 주기 토글 버튼 컴포넌트
function FrequencyToggle({
  value,
  onChange,
}: {
  value: FrequencyType;
  onChange: (value: FrequencyType) => void;
}) {
  const toggleFrequency = () => {
    onChange(value === 'monthly' ? 'yearly' : 'monthly');
  };

  return (
    <button
      type="button"
      onClick={toggleFrequency}
      className={styles.frequencyToggle}
      title={value === 'monthly' ? '클릭하여 연으로 변경' : '클릭하여 월으로 변경'}
    >
      {value === 'monthly' ? '월' : '년'}
    </button>
  );
}

// 근로 소득 입력 - 본인 급여 (메인 행)
export function renderLaborIncomeInput({
  data,
  onUpdateData,
  onFocus,
}: RowInputProps) {
  return (
    <div className={styles.excelValueCells}>
      <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
        <span className={styles.excelCellLabel}>본인 급여</span>
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
      >
        <MoneyInput
          value={data.laborIncome}
          onChange={(value) => onUpdateData({ laborIncome: value })}
          placeholder="0"
          hideSuffix
          onFocus={() => onFocus("labor_income")}
          data-filled={data.laborIncome !== null ? "true" : undefined}
        />
      </div>
      <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
        만원
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
      >
        <FrequencyToggle
          value={data.laborIncomeFrequency}
          onChange={(value) => onUpdateData({ laborIncomeFrequency: value })}
        />
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
      ></div>
    </div>
  );
}

// 근로 소득 - 배우자 급여 확장 행
interface IncomeExtensionRowProps {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
  onFocus: (rowId: RowId) => void;
  isActive?: boolean;
  isCurrent?: boolean;
}

export function SpouseLaborIncomeRow({
  data,
  onUpdateData,
  onFocus,
  isActive,
  isCurrent,
}: IncomeExtensionRowProps) {
  // 배우자가 있고 은퇴나이가 설정된 경우에만 표시
  const hasWorkingSpouse =
    data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;

  if (!hasWorkingSpouse) return null;

  // 본인 입력 완료 + 배우자 미입력 → 배우자 행 강조
  const isSpouseCurrent = isCurrent && data.laborIncome !== null && data.spouseLaborIncome === null;

  return (
    <div className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''} ${isSpouseCurrent ? styles.excelRowCurrent : ''}`} data-current={isSpouseCurrent ? 'true' : undefined}>
      <div className={styles.excelRowNumber}></div>
      <div className={styles.excelRowLabel}></div>
      <div className={styles.excelRowInputMulti}>
        <div className={styles.excelValueCells}>
          <div
            className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
          >
            <span className={styles.excelCellLabel}>배우자 급여</span>
          </div>
          <div
            className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
          >
            <MoneyInput
              value={data.spouseLaborIncome}
              onChange={(value) => onUpdateData({ spouseLaborIncome: value })}
              placeholder="0"
              hideSuffix
              onFocus={() => onFocus("labor_income")}
              data-filled={data.spouseLaborIncome !== null ? "true" : undefined}
            />
          </div>
          <div
            className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}
          >
            만원
          </div>
          <div
            className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
          >
            <FrequencyToggle
              value={data.spouseLaborIncomeFrequency}
              onChange={(value) => onUpdateData({ spouseLaborIncomeFrequency: value })}
            />
          </div>
          <div
            className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
          ></div>
        </div>
      </div>
    </div>
  );
}

// 사업 소득 - 본인 소득
export function renderBusinessIncomeInput({
  data,
  onUpdateData,
  onFocus,
}: RowInputProps) {
  return (
    <div className={styles.excelValueCells}>
      <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
        <span className={styles.excelCellLabel}>본인 소득</span>
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
      >
        <MoneyInput
          value={data.businessIncome}
          onChange={(value) => onUpdateData({ businessIncome: value })}
          placeholder="0"
          hideSuffix
          onFocus={() => onFocus("business_income")}
          data-filled={data.businessIncome !== null ? "true" : undefined}
        />
      </div>
      <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
        만원
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
      >
        <FrequencyToggle
          value={data.businessIncomeFrequency}
          onChange={(value) => onUpdateData({ businessIncomeFrequency: value })}
        />
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
      ></div>
    </div>
  );
}

// 사업 소득 - 배우자 소득 확장 행
export function SpouseBusinessIncomeRow({
  data,
  onUpdateData,
  onFocus,
  isActive,
  isCurrent,
}: IncomeExtensionRowProps) {
  // 배우자가 있고 은퇴나이가 설정된 경우에만 표시
  const hasWorkingSpouse =
    data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;

  if (!hasWorkingSpouse) return null;

  // 본인 입력 완료 + 배우자 미입력 → 배우자 행 강조
  const isSpouseCurrent = isCurrent && data.businessIncome !== null && data.spouseBusinessIncome === null;

  return (
    <div className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''} ${isSpouseCurrent ? styles.excelRowCurrent : ''}`} data-current={isSpouseCurrent ? 'true' : undefined}>
      <div className={styles.excelRowNumber}></div>
      <div className={styles.excelRowLabel}></div>
      <div className={styles.excelRowInputMulti}>
        <div className={styles.excelValueCells}>
          <div
            className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
          >
            <span className={styles.excelCellLabel}>배우자 소득</span>
          </div>
          <div
            className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
          >
            <MoneyInput
              value={data.spouseBusinessIncome}
              onChange={(value) => onUpdateData({ spouseBusinessIncome: value })}
              placeholder="0"
              hideSuffix
              onFocus={() => onFocus("business_income")}
              data-filled={data.spouseBusinessIncome !== null ? "true" : undefined}
            />
          </div>
          <div
            className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}
          >
            만원
          </div>
          <div
            className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
          >
            <FrequencyToggle
              value={data.spouseBusinessIncomeFrequency}
              onChange={(value) => onUpdateData({ spouseBusinessIncomeFrequency: value })}
            />
          </div>
          <div
            className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
          ></div>
        </div>
      </div>
    </div>
  );
}

// 생활비 입력 (셀 구조: 금액 | 만원 | 주기 | 빈 삭제칸)
export function renderLivingExpensesInput({
  data,
  onUpdateData,
  onFocus,
}: RowInputProps) {
  return (
    <div className={styles.excelValueCells}>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
      >
        <MoneyInput
          value={data.livingExpenses}
          onChange={(value) => onUpdateData({ livingExpenses: value })}
          placeholder="0"
          hideSuffix
          onFocus={() => onFocus("living_expenses")}
          data-filled={data.livingExpenses !== null ? "true" : undefined}
        />
      </div>
      <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
        만원
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
      >
        <FrequencyToggle
          value={data.livingExpensesFrequency}
          onChange={(value) => onUpdateData({ livingExpensesFrequency: value })}
        />
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
      ></div>
    </div>
  );
}
