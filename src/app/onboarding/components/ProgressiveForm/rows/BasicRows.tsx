"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Plus, Check, X } from "lucide-react";
import type { OnboardingData } from "@/types";
import type { RowId, RowInputProps } from "../types";
import { calculateAge, calculateKoreanAge } from "../utils";
import styles from "../../../onboarding.module.css";

interface BasicRowsProps extends RowInputProps {
  activeRow: RowId;
  currentRowId: RowId | null;
}

// 이름 입력
export function renderNameInput({
  data,
  onUpdateData,
  onFocus,
  isActive,
}: RowInputProps) {
  return (
    <div className={styles.excelValueCells}>
      <div className={`${styles.excelValueCell} ${styles.excelValueCellNameInput}`}>
        <Input
          placeholder="이름을 입력하세요"
          value={data.name}
          onChange={(e) => onUpdateData({ name: e.target.value })}
          onFocus={() => onFocus("name")}
          autoFocus={isActive}
          data-filled={data.name ? "true" : undefined}
        />
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellUnit} ${styles.excelGenderToggle}`}
        onClick={() => onUpdateData({ gender: data.gender === "male" ? "female" : "male" })}
        data-filled={data.gender ? "true" : undefined}
      >
        {data.gender === "male" ? "남" : data.gender === "female" ? "여" : "성별"}
      </div>
      <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
      <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
    </div>
  );
}

// 생년월일 행들 렌더링 (본인 + 배우자 통합)
interface BirthDateRowsProps {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
  onFocus: (rowId: RowId) => void;
  activeRow: RowId;
  currentRowId: RowId | null;
  baseRowIndex: number;
}

export function BirthDateRows({
  data,
  onUpdateData,
  onFocus,
  activeRow,
  currentRowId,
  baseRowIndex,
}: BirthDateRowsProps) {
  const currentAge = calculateAge(data.birth_date);
  const koreanAge = calculateKoreanAge(data.birth_date);
  const spouseAge = data.spouse?.birth_date
    ? calculateAge(data.spouse.birth_date)
    : null;
  const spouseKoreanAge = data.spouse?.birth_date
    ? calculateKoreanAge(data.spouse.birth_date)
    : null;

  const isComplete =
    !!data.birth_date &&
    (!data.isMarried || (data.isMarried === true && !!data.spouse?.birth_date));
  const isCurrent = currentRowId === "birth_date";
  const isActive = activeRow === "birth_date";
  const hasSpouse = data.isMarried === true;

  // 본인 날짜 미입력 → 본인 행 강조, 본인 입력 완료 + 배우자 있음 + 배우자 미입력 → 배우자 행 강조
  const isMainCurrent = isCurrent && !data.birth_date;
  const isSpouseCurrent =
    isCurrent && !!data.birth_date && hasSpouse && !data.spouse?.birth_date;

  return (
    <>
      {/* 본인 생년월일 - 메인 행 */}
      <div
        className={`${styles.excelRow} ${
          isActive ? styles.excelRowActive : ""
        } ${isComplete ? styles.excelRowComplete : ""} ${
          isMainCurrent ? styles.excelRowCurrent : ""
        }`}
        onClick={() => onFocus("birth_date")}
        data-current={isMainCurrent ? "true" : undefined}
      >
        <div className={styles.excelRowNumber}>
          {isComplete ? <Check size={14} /> : baseRowIndex}
        </div>
        <div className={styles.excelRowLabel}>생년월일</div>
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div
              className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
            >
              <span className={styles.excelCellLabel}>본인</span>
            </div>
            <div
              className={`${styles.excelValueCell} ${styles.excelValueCellDateWithAge}`}
            >
              <Input
                type="date"
                value={data.birth_date}
                onChange={(e) => onUpdateData({ birth_date: e.target.value })}
                onFocus={() => onFocus("birth_date")}
                min="1900-01-01"
                max="2099-12-31"
                className={styles.excelCellInput}
                data-filled={data.birth_date ? "true" : undefined}
              />
              {koreanAge !== null && currentAge !== null && (
                <span className={styles.excelCalculatedSmall}>
                  {koreanAge}세 (만 {currentAge}세)
                </span>
              )}
            </div>
            <div
              className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
            ></div>
          </div>
        </div>
      </div>

      {/* 배우자 생년월일 - 확장 행 (배우자 있는 경우) */}
      {hasSpouse && data.spouse && (
        <div
          className={`${styles.excelRow} ${styles.excelRowExtension} ${
            isActive ? styles.excelRowActive : ""
          } ${isSpouseCurrent ? styles.excelRowCurrent : ""}`}
          onClick={() => onFocus("birth_date")}
          data-current={isSpouseCurrent ? "true" : undefined}
        >
          <div className={styles.excelRowNumber}></div>
          <div className={styles.excelRowLabel}></div>
          <div className={styles.excelRowInputMulti}>
            <div className={styles.excelValueCells}>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
              >
                <span className={styles.excelCellLabel}>배우자</span>
              </div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellDateWithAge}`}
              >
                <Input
                  type="date"
                  value={data.spouse.birth_date}
                  onChange={(e) =>
                    onUpdateData({
                      spouse: { ...data.spouse!, birth_date: e.target.value },
                    })
                  }
                  onFocus={() => onFocus("birth_date")}
                  min="1900-01-01"
                  max="2099-12-31"
                  className={styles.excelCellInput}
                  data-filled={data.spouse.birth_date ? "true" : undefined}
                />
                {spouseKoreanAge !== null && spouseAge !== null && (
                  <span className={styles.excelCalculatedSmall}>
                    {spouseKoreanAge}세 (만 {spouseAge}세)
                  </span>
                )}
              </div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateData({ isMarried: null, spouse: null });
                  }}
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 배우자 추가 버튼 - 아직 배우자 없는 경우 */}
      {!hasSpouse && (
        <div
          className={`${styles.excelRow} ${styles.excelRowExtension} ${
            styles.excelRowAdd
          } ${isActive ? styles.excelRowActive : ""}`}
          onClick={() => {
            onFocus("birth_date");
            onUpdateData({
              isMarried: true,
              spouse: {
                relationship: "spouse",
                name: "배우자",
                birth_date: "",
                is_working: false,
                retirement_age: 0,
                monthly_income: 0,
              },
            });
          }}
        >
          <div className={styles.excelRowNumber}></div>
          <div className={styles.excelRowLabel}></div>
          <div className={styles.excelRowInputMulti}>
            <span className={styles.excelAddText}>
              <Plus size={14} /> 배우자 있음
            </span>
          </div>
        </div>
      )}
    </>
  );
}

// 자녀 행들 렌더링
interface ChildrenRowsProps {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
  onFocus: (rowId: RowId) => void;
  activeRow: RowId;
  currentRowId: RowId | null;
  baseRowIndex: number;
}

export function ChildrenRows({
  data,
  onUpdateData,
  onFocus,
  activeRow,
  currentRowId,
  baseRowIndex,
}: ChildrenRowsProps) {
  const isCurrent = currentRowId === "children";
  const isActive = activeRow === "children";
  const isComplete =
    data.children.length === 0 || data.children.every((c) => !!c.birth_date);

  return (
    <>
      {/* 자녀 행들 */}
      {data.children.map((child, index) => {
        const childAge = child.birth_date
          ? calculateAge(child.birth_date)
          : null;
        const childKoreanAge = child.birth_date
          ? calculateKoreanAge(child.birth_date)
          : null;
        const genderLabel =
          child.gender === "male"
            ? "아들"
            : child.gender === "female"
            ? "딸"
            : "자녀";
        const isFirst = index === 0;

        return (
          <div
            key={`child-${index}`}
            className={`${styles.excelRow} ${
              isFirst ? "" : styles.excelRowExtension
            } ${isActive ? styles.excelRowActive : ""} ${
              isComplete ? styles.excelRowComplete : ""
            } ${isCurrent && !child.birth_date ? styles.excelRowCurrent : ""}`}
            onClick={() => onFocus("children")}
            data-current={isCurrent && !child.birth_date ? "true" : undefined}
          >
            <div className={styles.excelRowNumber}>
              {isFirst ? isComplete ? <Check size={14} /> : baseRowIndex : null}
            </div>
            <div className={styles.excelRowLabel}>{isFirst ? "자녀" : ""}</div>
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
                >
                  <span className={styles.excelCellLabel}>{genderLabel}</span>
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellDateWithAge}`}
                >
                  <Input
                    type="date"
                    value={child.birth_date || ""}
                    onChange={(e) => {
                      const newChildren = [...data.children];
                      newChildren[index] = {
                        ...child,
                        birth_date: e.target.value,
                      };
                      onUpdateData({ children: newChildren });
                    }}
                    onFocus={() => onFocus("children")}
                    min="1900-01-01"
                    max="2099-12-31"
                    className={styles.excelCellInput}
                    data-filled={child.birth_date ? "true" : undefined}
                  />
                  {childKoreanAge !== null && childAge !== null && (
                    <span className={styles.excelCalculatedSmall}>
                      {childKoreanAge}세 (만 {childAge}세)
                    </span>
                  )}
                </div>
                <div
                  className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateData({
                        children: data.children.filter((_, i) => i !== index),
                      });
                    }}
                    type="button"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 자녀 추가 버튼 행 */}
      <div
        className={`${styles.excelRow} ${
          data.children.length > 0 ? styles.excelRowExtension : ""
        } ${styles.excelRowAdd} ${isActive ? styles.excelRowActive : ""} ${
          isCurrent && data.children.length === 0 ? styles.excelRowCurrent : ""
        }`}
        onClick={() => onFocus("children")}
        data-current={isCurrent && data.children.length === 0 ? "true" : undefined}
      >
        <div className={styles.excelRowNumber}>
          {data.children.length === 0 ? baseRowIndex : null}
        </div>
        <div className={styles.excelRowLabel}>
          {data.children.length === 0 ? "자녀" : ""}
        </div>
        <div className={styles.excelRowInputMulti}>
          <span
            className={styles.excelAddText}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateData({
                hasChildren: true,
                children: [
                  ...data.children,
                  {
                    relationship: "child",
                    name: "아들",
                    birth_date: "",
                    gender: "male",
                  },
                ],
              });
            }}
          >
            <Plus size={14} /> 아들 추가
          </span>
          <span
            className={styles.excelAddText}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateData({
                hasChildren: true,
                children: [
                  ...data.children,
                  {
                    relationship: "child",
                    name: "딸",
                    birth_date: "",
                    gender: "female",
                  },
                ],
              });
            }}
          >
            <Plus size={14} /> 딸 추가
          </span>
        </div>
      </div>
    </>
  );
}

// 은퇴 나이 행들 렌더링
interface RetirementAgeRowsProps {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
  onFocus: (rowId: RowId) => void;
  activeRow: RowId;
  currentRowId: RowId | null;
  baseRowIndex: number;
}

export function RetirementAgeRows({
  data,
  onUpdateData,
  onFocus,
  activeRow,
  currentRowId,
  baseRowIndex,
}: RetirementAgeRowsProps) {
  const isCurrent = currentRowId === "retirement_age";
  const isActive = activeRow === "retirement_age";
  const hasSpouse = data.isMarried && data.spouse;
  // -1은 "추가됨, 값 미입력" 상태를 나타냄
  const hasSpouseRetirementAge =
    data.spouse?.retirement_age != null && data.spouse.retirement_age !== 0;

  // 완료 조건: (본인 입력 OR 배우자 입력) AND (배우자 행 없거나 배우자도 입력 완료)
  const mainComplete = data.target_retirement_age > 0;
  const spouseComplete = (data.spouse?.retirement_age ?? 0) > 0;
  const isComplete =
    (mainComplete || spouseComplete) &&
    (!hasSpouseRetirementAge || spouseComplete);

  // 본인 미입력 → 본인 행 강조, 본인 입력 완료 + 배우자 은퇴 나이 추가됨 + 배우자 미입력 → 배우자 행 강조
  const isMainCurrent = isCurrent && data.target_retirement_age <= 0;
  const isSpouseCurrent =
    isCurrent &&
    data.target_retirement_age > 0 &&
    hasSpouseRetirementAge &&
    (data.spouse?.retirement_age ?? 0) <= 0;

  return (
    <>
      {/* 본인 은퇴 나이 - 메인 행 */}
      <div
        className={`${styles.excelRow} ${
          isActive ? styles.excelRowActive : ""
        } ${isComplete ? styles.excelRowComplete : ""} ${
          isMainCurrent ? styles.excelRowCurrent : ""
        }`}
        onClick={() => onFocus("retirement_age")}
        data-current={isMainCurrent ? "true" : undefined}
      >
        <div className={styles.excelRowNumber}>
          {isComplete ? <Check size={14} /> : baseRowIndex}
        </div>
        <div className={styles.excelRowLabel}>목표 은퇴 나이</div>
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div
              className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
            >
              <span className={styles.excelCellLabel}>본인</span>
            </div>
            <div
              className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
            >
              <Input
                type="number"
                placeholder="60"
                value={data.target_retirement_age || ""}
                onChange={(e) =>
                  onUpdateData({
                    target_retirement_age: parseInt(e.target.value) || 0,
                  })
                }
                onFocus={() => onFocus("retirement_age")}
                className={styles.excelCellInput}
                data-filled={data.target_retirement_age > 0 ? "true" : undefined}
              />
            </div>
            <div
              className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}
            >
              세
            </div>
            <div
              className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
            ></div>
            <div
              className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
            ></div>
          </div>
        </div>
      </div>

      {/* 배우자 은퇴 나이 - 확장 행 (추가된 경우에만) */}
      {hasSpouse && hasSpouseRetirementAge && (
        <div
          className={`${styles.excelRow} ${styles.excelRowExtension} ${
            isActive ? styles.excelRowActive : ""
          } ${isSpouseCurrent ? styles.excelRowCurrent : ""}`}
          onClick={() => onFocus("retirement_age")}
          data-current={isSpouseCurrent ? "true" : undefined}
        >
          <div className={styles.excelRowNumber}></div>
          <div className={styles.excelRowLabel}></div>
          <div className={styles.excelRowInputMulti}>
            <div className={styles.excelValueCells}>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}
              >
                <span className={styles.excelCellLabel}>배우자</span>
              </div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
              >
                <Input
                  type="number"
                  placeholder="60"
                  value={
                    data.spouse?.retirement_age &&
                    data.spouse.retirement_age > 0
                      ? data.spouse.retirement_age
                      : ""
                  }
                  onChange={(e) =>
                    onUpdateData({
                      spouse: {
                        ...data.spouse!,
                        retirement_age: parseInt(e.target.value) || -1,
                      },
                    })
                  }
                  onFocus={() => onFocus("retirement_age")}
                  className={styles.excelCellInput}
                  data-filled={(data.spouse?.retirement_age ?? 0) > 0 ? "true" : undefined}
                />
              </div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}
              >
                세
              </div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
              ></div>
              <div
                className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateData({
                      spouse: { ...data.spouse!, retirement_age: 0 },
                    });
                  }}
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 배우자 은퇴 나이 추가 버튼 */}
      {hasSpouse && !hasSpouseRetirementAge && (
        <div
          className={`${styles.excelRow} ${styles.excelRowExtension} ${
            styles.excelRowAdd
          } ${isActive ? styles.excelRowActive : ""}`}
          onClick={() => {
            onFocus("retirement_age");
            onUpdateData({ spouse: { ...data.spouse!, retirement_age: -1 } });
          }}
        >
          <div className={styles.excelRowNumber}></div>
          <div className={styles.excelRowLabel}></div>
          <div className={styles.excelRowInputMulti}>
            <span className={styles.excelAddText}>
              <Plus size={14} /> 배우자 은퇴 나이 추가
            </span>
          </div>
        </div>
      )}
    </>
  );
}

// 은퇴 자금 입력
export function renderRetirementFundInput({
  data,
  onUpdateData,
  onFocus,
}: RowInputProps) {
  return (
    <div className={styles.excelValueCells}>
      <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
        <span className={styles.excelCellLabel}>가계 기준</span>
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}
      >
        <Input
          type="number"
          placeholder="100000"
          value={data.target_retirement_fund || ""}
          onChange={(e) => {
            onUpdateData({
              target_retirement_fund: parseFloat(e.target.value) || 0,
            });
          }}
          onFocus={() => onFocus("retirement_fund")}
          className={styles.excelCellInput}
          data-filled={data.target_retirement_fund > 0 ? "true" : undefined}
        />
      </div>
      <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
        만원
      </div>
      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}
      />

      <div
        className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}
      ></div>
    </div>
  );
}
