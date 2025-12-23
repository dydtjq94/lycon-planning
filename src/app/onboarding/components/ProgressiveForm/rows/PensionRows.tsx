"use client";

import React from "react";
import { Check } from "lucide-react";
import { MoneyInput } from "@/components/ui/money-input";
import type { OnboardingData } from "@/types";
import type { RowId } from "../types";
import { formatMoney } from "../utils";
import styles from "../../../onboarding.module.css";

// 연금 행 컴포넌트 Props
interface PensionRowsProps {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
  onFocus: (rowId: RowId) => void;
  activeRow: RowId;
  currentRowId: RowId | null;
  baseRowIndex: number;
  visibleRows: RowId[];
}

// 연금 행들 렌더링 (국민연금, 퇴직연금/퇴직금, 개인연금, 기타연금 통합)
export function PensionRows({
  data,
  onUpdateData,
  onFocus,
  activeRow,
  currentRowId,
  baseRowIndex,
  visibleRows,
}: PensionRowsProps) {
  // 완료 조건
  const hasNational = data.nationalPension != null && data.nationalPension > 0;
  const hasRetirement =
    data.retirementPensionType != null && data.retirementPensionBalance != null;
  const hasPersonal =
    (data.irpBalance != null && data.irpBalance > 0) ||
    (data.pensionSavingsBalance != null && data.pensionSavingsBalance > 0) ||
    (data.isaBalance != null && data.isaBalance > 0);
  const hasOther =
    data.otherPensionMonthly != null && data.otherPensionMonthly > 0;

  // 현재 활성 행 ID 확인
  const isCurrent = (rowId: RowId) => currentRowId === rowId;

  // 해당 행이 보여야 하는지 확인
  const isVisible = (rowId: RowId) => visibleRows.includes(rowId);

  return (
    <>
      {/* 국민연금 (1층) */}
      {isVisible("national_pension") && (
        <div
          className={`${styles.excelRow} ${
            activeRow === "national_pension" ? styles.excelRowActive : ""
          } ${hasNational ? styles.excelRowComplete : ""} ${
            isCurrent("national_pension") && !hasNational
              ? styles.excelRowCurrent
              : ""
          }`}
          onClick={() => onFocus("national_pension")}
          data-current={
            isCurrent("national_pension") && !hasNational ? "true" : undefined
          }
        >
          <div className={styles.excelRowNumber}>
            {hasNational ? <Check size={14} /> : baseRowIndex}
          </div>
          <div className={styles.excelRowLabel}>국민연금</div>
          <div className={styles.excelRowInputMulti}>
            <div className={styles.excelValueCells}>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
              >
                예상 월 수령액
              </div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
              >
                <MoneyInput
                  value={data.nationalPension}
                  onChange={(value) =>
                    onUpdateData({
                      nationalPension: value,
                      hasNoPension: false,
                    })
                  }
                  placeholder="0"
                  hideSuffix
                  onFocus={() => onFocus("national_pension")}
                  data-filled={
                    data.nationalPension != null ? "true" : undefined
                  }
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
                월
              </div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* 퇴직연금/퇴직금 (2층) */}
      {isVisible("retirement_pension") && (
        <div
          className={`${styles.excelRow} ${
            activeRow === "retirement_pension" ? styles.excelRowActive : ""
          } ${hasRetirement ? styles.excelRowComplete : ""} ${
            isCurrent("retirement_pension") && !hasRetirement
              ? styles.excelRowCurrent
              : ""
          }`}
          onClick={() => onFocus("retirement_pension")}
          data-current={
            isCurrent("retirement_pension") && !hasRetirement
              ? "true"
              : undefined
          }
        >
          <div className={styles.excelRowNumber}>
            {hasRetirement ? <Check size={14} /> : baseRowIndex + 1}
          </div>
          <div className={styles.excelRowLabel}>퇴직연금/퇴직금</div>
          <div className={styles.excelRowInputMulti}>
            <div className={styles.excelValueCells}>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
              >
                <select
                  className={styles.pensionTypeSelect}
                  value={data.retirementPensionType || ""}
                  onChange={(e) =>
                    onUpdateData({
                      retirementPensionType:
                        (e.target.value as "DB" | "DC" | "severance" | null) ||
                        null,
                      hasNoPension: false,
                    })
                  }
                >
                  <option value="">유형 선택</option>
                  <option value="DC">DC형</option>
                  <option value="DB">DB형</option>
                  <option value="severance">퇴직금</option>
                </select>
              </div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
              >
                <MoneyInput
                  value={data.retirementPensionBalance}
                  onChange={(value) =>
                    onUpdateData({
                      retirementPensionBalance: value,
                      hasNoPension: false,
                    })
                  }
                  placeholder="0"
                  hideSuffix
                  onFocus={() => onFocus("retirement_pension")}
                  data-filled={
                    data.retirementPensionBalance != null ? "true" : undefined
                  }
                />
              </div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}
              >
                만원
              </div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
              />
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* 개인연금 (3층) - IRP */}
      {isVisible("personal_pension") && (
        <>
          <div
            className={`${styles.excelRow} ${
              activeRow === "personal_pension" ? styles.excelRowActive : ""
            } ${hasPersonal ? styles.excelRowComplete : ""} ${
              isCurrent("personal_pension") && !hasPersonal
                ? styles.excelRowCurrent
                : ""
            }`}
            onClick={() => onFocus("personal_pension")}
            data-current={
              isCurrent("personal_pension") && !hasPersonal ? "true" : undefined
            }
          >
            <div className={styles.excelRowNumber}>
              {hasPersonal ? <Check size={14} /> : baseRowIndex + 2}
            </div>
            <div className={styles.excelRowLabel}>개인연금</div>
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
                >
                  IRP
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
                >
                  <MoneyInput
                    value={data.irpBalance}
                    onChange={(value) =>
                      onUpdateData({ irpBalance: value, hasNoPension: false })
                    }
                    placeholder="0"
                    hideSuffix
                    onFocus={() => onFocus("personal_pension")}
                    data-filled={data.irpBalance != null ? "true" : undefined}
                  />
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}
                >
                  만원
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
                />
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
                />
              </div>
            </div>
          </div>

          {/* 개인연금 - 연금저축 */}
          <div
            className={`${styles.excelRow} ${styles.excelRowExtension} ${
              activeRow === "personal_pension" ? styles.excelRowActive : ""
            }`}
            onClick={() => onFocus("personal_pension")}
          >
            <div className={styles.excelRowNumber} />
            <div className={styles.excelRowLabel} />
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
                >
                  연금저축
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
                >
                  <MoneyInput
                    value={data.pensionSavingsBalance}
                    onChange={(value) =>
                      onUpdateData({
                        pensionSavingsBalance: value,
                        hasNoPension: false,
                      })
                    }
                    placeholder="0"
                    hideSuffix
                    onFocus={() => onFocus("personal_pension")}
                    data-filled={
                      data.pensionSavingsBalance != null ? "true" : undefined
                    }
                  />
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}
                >
                  만원
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
                />
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
                />
              </div>
            </div>
          </div>

          {/* 개인연금 - ISA */}
          <div
            className={`${styles.excelRow} ${styles.excelRowExtension} ${
              activeRow === "personal_pension" ? styles.excelRowActive : ""
            }`}
            onClick={() => onFocus("personal_pension")}
          >
            <div className={styles.excelRowNumber} />
            <div className={styles.excelRowLabel} />
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
                >
                  ISA
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
                >
                  <MoneyInput
                    value={data.isaBalance}
                    onChange={(value) =>
                      onUpdateData({ isaBalance: value, hasNoPension: false })
                    }
                    placeholder="0"
                    hideSuffix
                    onFocus={() => onFocus("personal_pension")}
                    data-filled={data.isaBalance != null ? "true" : undefined}
                  />
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}
                >
                  만원
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
                />
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// 기존 render 함수들 (하위 호환성을 위해 유지하지만 실제로는 사용 안함)
export function renderNationalPensionInput() {
  return null;
}
export function renderRetirementPensionInput() {
  return null;
}
export function renderPersonalPensionInput() {
  return null;
}
export function renderOtherPensionInput() {
  return null;
}
