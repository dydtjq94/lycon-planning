"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { OnboardingData, FamilyMemberInput, DebtInput } from "@/types";
import { type RowId, rows } from "../ProgressiveForm/types";
import { formatMoney } from "../ProgressiveForm/tips/formatUtils";
import { NumberInput } from "./NumberInput";
import styles from "./GuideInput.module.css";

interface GuideInputProps {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
  currentRowId: RowId | null;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  onComplete: () => void;
  isLastStep: boolean;
}

// 각 행에 대한 질문과 설명
const rowQuestions: Record<RowId, { question: string; description?: string }> =
  {
    name: {
      question: "이름을 알려주세요",
      description: "이름은 맞춤형 리포트에, 성별은 기대수명 계산에 활용됩니다.",
    },
    birth_date: {
      question: "생년월일을 알려주세요",
      description: "정확한 나이 계산을 위해 필요해요.",
    },
    children: {
      question: "자녀가 있으신가요?",
      description: "자녀의 교육비, 양육비 계획에 반영됩니다.",
    },
    retirement_age: {
      question: "몇 살에 은퇴하고 싶으세요?",
      description: "목표 은퇴 나이를 설정해주세요.",
    },
    retirement_fund: {
      question: "은퇴할 때 자산 목표는 얼마인가요?",
      description: "은퇴 시점에 모으고 싶은 총 자산이에요.",
    },
    labor_income: {
      question: "월 근로소득이 얼마인가요?",
      description: "세후 실수령액 기준으로 입력해주세요.",
    },
    business_income: {
      question: "사업소득이 있으신가요?",
      description: "사업, 프리랜서 등으로 얻는 소득이에요.",
    },
    living_expenses: {
      question: "월 평균 생활비는 얼마인가요?",
      description: "주거비, 식비, 교통비 등 모든 지출을 포함해요.",
    },
    realEstate: {
      question: "현재 거주 형태는 어떻게 되나요?",
      description: "자가, 전세, 월세 중에서 선택해주세요.",
    },
    asset: {
      question: "바로 쓸 수 있는 현금이 얼마나 있나요?",
      description: "입출금통장, 파킹통장 등 즉시 인출 가능한 금액이에요.",
    },
    debt: {
      question: "부채가 있으신가요?",
      description: "대출, 카드론 등 모든 부채를 입력해주세요.",
    },
    national_pension: {
      question: "국민연금 예상 수령액을 알고 계신가요?",
      description: "국민연금공단에서 확인할 수 있어요.",
    },
    retirement_pension: {
      question: "퇴직연금 또는 퇴직금이 있으신가요?",
      description: "회사에서 적립 중인 퇴직연금 또는 퇴직금이에요.",
    },
    personal_pension: {
      question: "개인연금에 얼마나 모았나요?",
      description: "IRP, 연금저축에 지금까지 쌓인 금액이에요.",
    },
  };

export function GuideInput({
  data,
  onUpdateData,
  currentRowId,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
  onComplete,
  isLastStep,
}: GuideInputProps) {
  const [animationDirection, setAnimationDirection] = useState<
    "next" | "prev" | null
  >(null);
  const [incomingDirection, setIncomingDirection] = useState<
    "next" | "prev" | null
  >(null);
  const [displayRowId, setDisplayRowId] = useState(currentRowId);
  const inputSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentRowId !== displayRowId) {
      if (animationDirection) {
        // 이전/다음 버튼 클릭: 애니메이션 후 업데이트
        const timer = setTimeout(() => {
          setIncomingDirection(animationDirection);
          setDisplayRowId(currentRowId);
          setAnimationDirection(null);
          // 슬라이드인 애니메이션 후 리셋
          setTimeout(() => setIncomingDirection(null), 250);
        }, 200);
        return () => clearTimeout(timer);
      } else {
        // 섹션 탭 클릭 등 직접 이동: 애니메이션 없이 즉시 업데이트
        setDisplayRowId(currentRowId);
      }
    }
  }, [currentRowId, displayRowId, animationDirection]);

  // 왼쪽 입력 필드에 자동 포커스
  useEffect(() => {
    if (!displayRowId || animationDirection || incomingDirection) return;

    const timer = setTimeout(() => {
      const container = inputSectionRef.current;
      if (!container) return;

      // 첫 번째 포커스 가능한 요소 찾기
      const focusable = container.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])"
      );
      if (focusable) {
        focusable.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [displayRowId, animationDirection, incomingDirection]);

  const handlePrev = () => {
    setAnimationDirection("prev");
    onPrev();
  };

  const handleNext = () => {
    setAnimationDirection("next");
    onNext();
  };

  if (!displayRowId) {
    return (
      <div className={styles.container}>
        <div className={styles.complete}>
          <h2 className={styles.completeTitle}>모든 항목을 입력했어요!</h2>
          <p className={styles.completeDescription}>
            완료 버튼을 눌러 저장하세요.
          </p>
        </div>
        <div className={styles.navigation}>
          <button className={styles.navButtonPrev} onClick={handlePrev}>
            <ChevronLeft size={20} />
            이전
          </button>
          <button className={styles.navButtonComplete} onClick={onComplete}>
            완료
          </button>
        </div>
      </div>
    );
  }

  const questionData = rowQuestions[displayRowId];
  const currentIndex = rows.findIndex((r) => r.id === displayRowId);

  const contentClass = `${styles.content} ${
    animationDirection === "next" ? styles.slideOutLeft : ""
  } ${animationDirection === "prev" ? styles.slideOutRight : ""} ${
    incomingDirection === "next" ? styles.slideInFromRight : ""
  } ${incomingDirection === "prev" ? styles.slideInFromLeft : ""}`;

  return (
    <div className={styles.container}>
      {/* 상단 헤더 - 애플 스타일 */}
      <div className={styles.header}>
        <span className={styles.stepIndicator}>{currentIndex + 1}</span>
        <h2 className={styles.question}>{questionData?.question}</h2>
        {questionData?.description && (
          <p className={styles.description}>{questionData.description}</p>
        )}
      </div>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div key={displayRowId} className={contentClass}>
        <div className={styles.inputSection} ref={inputSectionRef}>
          {renderInputForRow(displayRowId, data, onUpdateData)}
        </div>
      </div>

      <div className={styles.navigation}>
        <button
          className={styles.navButtonPrev}
          onClick={handlePrev}
          disabled={!canGoPrev}
        >
          <ChevronLeft size={20} />
          이전
        </button>
        {isLastStep ? (
          <button
            className={styles.navButtonComplete}
            onClick={onComplete}
            disabled={!canGoNext}
          >
            완료
          </button>
        ) : (
          <button
            className={styles.navButtonNext}
            onClick={handleNext}
            disabled={!canGoNext}
          >
            다음
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

// 각 행에 맞는 입력 UI 렌더링
function renderInputForRow(
  rowId: RowId,
  data: OnboardingData,
  onUpdateData: (updates: Partial<OnboardingData>) => void
) {
  switch (rowId) {
    case "name":
      return (
        <div className={styles.nameSection}>
          <input
            type="text"
            className={styles.textInput}
            value={data.name}
            onChange={(e) => onUpdateData({ name: e.target.value })}
            placeholder="이름 입력"
            autoFocus
          />
          <div className={styles.genderButtons}>
            <button
              className={`${styles.genderButton} ${
                data.gender === "male" ? styles.genderButtonActive : ""
              }`}
              onClick={() => onUpdateData({ gender: "male" })}
              type="button"
            >
              남자
            </button>
            <button
              className={`${styles.genderButton} ${
                data.gender === "female" ? styles.genderButtonActive : ""
              }`}
              onClick={() => onUpdateData({ gender: "female" })}
              type="button"
            >
              여자
            </button>
          </div>
        </div>
      );

    case "birth_date":
      return (
        <div className={styles.birthDateSection}>
          {/* 본인 생년월일 */}
          <div className={styles.personRow}>
            <span className={styles.personLabel}>본인</span>
            <div className={styles.dateInputGroup}>
              <input
                type="date"
                className={styles.dateInput}
                value={data.birth_date}
                onChange={(e) => onUpdateData({ birth_date: e.target.value })}
                min="1900-01-01"
                max="2099-12-31"
              />
              {data.birth_date && (
                <span className={styles.ageDisplay}>
                  {calculateKoreanAge(data.birth_date)}세 (만{" "}
                  {calculateAge(data.birth_date)}세)
                </span>
              )}
            </div>
          </div>

          {/* 배우자 선택 */}
          <div className={styles.spouseSection}>
            {data.isMarried === null || data.isMarried === false ? (
              <button
                className={styles.addSpouseButton}
                onClick={() =>
                  onUpdateData({
                    isMarried: true,
                    spouse: {
                      relationship: "spouse",
                      name: "배우자",
                      gender: "female",
                      birth_date: "",
                    },
                  })
                }
              >
                + 배우자 추가
              </button>
            ) : (
              <div className={styles.personRow}>
                <span className={styles.personLabel}>배우자</span>
                <div className={styles.dateInputGroup}>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={data.spouse?.birth_date || ""}
                    onChange={(e) =>
                      onUpdateData({
                        spouse: { ...data.spouse!, birth_date: e.target.value },
                      })
                    }
                    min="1900-01-01"
                    max="2099-12-31"
                  />
                  {data.spouse?.birth_date && (
                    <span className={styles.ageDisplay}>
                      {calculateKoreanAge(data.spouse.birth_date)}세 (만{" "}
                      {calculateAge(data.spouse.birth_date)}세)
                    </span>
                  )}
                </div>
                <button
                  className={styles.removeSpouseButton}
                  onClick={() =>
                    onUpdateData({
                      isMarried: false,
                      spouse: null,
                      spouseLaborIncome: null,
                      spouseBusinessIncome: null,
                    })
                  }
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      );

    case "retirement_age":
      return (
        <div className={styles.retirementAgeSection}>
          {/* 본인 은퇴 나이 */}
          <div className={styles.personRow}>
            <span className={styles.personLabel}>본인</span>
            <div className={styles.numberInputGroupInline}>
              <NumberInput
                className={styles.numberInputSmall}
                value={data.target_retirement_age || ""}
                onChange={(e) =>
                  onUpdateData({
                    target_retirement_age: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="60"
                min={30}
                max={100}
              />
              <span className={styles.unit}>세</span>
            </div>
          </div>

          {/* 배우자 은퇴 나이 */}
          {data.isMarried && data.spouse && (
            <div className={styles.spouseSection}>
              {data.spouse.retirement_age === undefined ? (
                <button
                  className={styles.addSpouseButton}
                  onClick={() =>
                    onUpdateData({
                      spouse: { ...data.spouse!, retirement_age: 55 },
                    })
                  }
                >
                  + 배우자 은퇴 나이 추가
                </button>
              ) : (
                <div className={styles.personRow}>
                  <span className={styles.personLabel}>배우자</span>
                  <div className={styles.numberInputGroupInline}>
                    <NumberInput
                      className={styles.numberInputSmall}
                      value={data.spouse.retirement_age || ""}
                      onChange={(e) =>
                        onUpdateData({
                          spouse: {
                            ...data.spouse!,
                            retirement_age: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="55"
                      min={30}
                      max={100}
                    />
                    <span className={styles.unit}>세</span>
                  </div>
                  <button
                    className={styles.removeSpouseButton}
                    onClick={() =>
                      onUpdateData({
                        spouse: { ...data.spouse!, retirement_age: undefined },
                        spouseLaborIncome: null,
                        spouseBusinessIncome: null,
                      })
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      );

    case "retirement_fund":
      const fundValue = data.target_retirement_fund || 0;
      return (
        <div className={styles.numberInputWithDisplay}>
          <div className={styles.numberInputGroup}>
            <NumberInput
              className={styles.numberInput}
              value={data.target_retirement_fund || ""}
              onChange={(e) =>
                onUpdateData({
                  target_retirement_fund: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="100000"
            />
            <span className={styles.unit}>만원</span>
          </div>
          {fundValue > 0 && (
            <div className={styles.amountDisplay}>{formatMoney(fundValue)}</div>
          )}
        </div>
      );

    case "labor_income":
      const hasWorkingSpouse =
        data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      return (
        <div className={styles.incomeSection}>
          {/* 본인 근로소득 */}
          <div className={styles.personRow}>
            <span className={styles.personLabel}>본인</span>
            <div className={styles.inputWithAmount}>
              <div className={styles.numberInputGroupInline}>
                <NumberInput
                  className={styles.numberInputSmall}
                  value={data.laborIncome !== null ? data.laborIncome : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    onUpdateData({
                      laborIncome: value === "" ? null : parseFloat(value) || 0,
                    });
                  }}
                  placeholder="500"
                />
                <span className={styles.unit}>만원/월</span>
              </div>
              {(data.laborIncome || 0) > 0 && (
                <div className={styles.amountDisplay}>
                  {formatMoney(data.laborIncome || 0)}
                </div>
              )}
            </div>
          </div>

          {/* 배우자 근로소득 (배우자 은퇴 나이가 설정된 경우) */}
          {hasWorkingSpouse && (
            <div className={styles.personRow}>
              <span className={styles.personLabel}>배우자</span>
              <div className={styles.inputWithAmount}>
                <div className={styles.numberInputGroupInline}>
                  <NumberInput
                    className={styles.numberInputSmall}
                    value={
                      data.spouseLaborIncome !== null
                        ? data.spouseLaborIncome
                        : ""
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      onUpdateData({
                        spouseLaborIncome:
                          value === "" ? null : parseFloat(value) || 0,
                      });
                    }}
                    placeholder="300"
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
                {(data.spouseLaborIncome || 0) > 0 && (
                  <div className={styles.amountDisplay}>
                    {formatMoney(data.spouseLaborIncome || 0)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );

    case "business_income":
      const hasWorkingSpouseForBiz =
        data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      return (
        <div className={styles.incomeSection}>
          {/* 본인 사업소득 */}
          <div className={styles.personRow}>
            <span className={styles.personLabel}>본인</span>
            <div className={styles.inputWithAmount}>
              <div className={styles.numberInputGroupInline}>
                <NumberInput
                  className={styles.numberInputSmall}
                  value={data.businessIncome !== null ? data.businessIncome : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    onUpdateData({
                      businessIncome:
                        value === "" ? null : parseFloat(value) || 0,
                    });
                  }}
                  placeholder="0"
                />
                <span className={styles.unit}>만원/월</span>
              </div>
              {(data.businessIncome || 0) > 0 && (
                <div className={styles.amountDisplay}>
                  {formatMoney(data.businessIncome || 0)}
                </div>
              )}
            </div>
          </div>

          {/* 배우자 사업소득 (배우자 은퇴 나이가 설정된 경우) */}
          {hasWorkingSpouseForBiz && (
            <div className={styles.personRow}>
              <span className={styles.personLabel}>배우자</span>
              <div className={styles.inputWithAmount}>
                <div className={styles.numberInputGroupInline}>
                  <NumberInput
                    className={styles.numberInputSmall}
                    value={
                      data.spouseBusinessIncome !== null
                        ? data.spouseBusinessIncome
                        : ""
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      onUpdateData({
                        spouseBusinessIncome:
                          value === "" ? null : parseFloat(value) || 0,
                      });
                    }}
                    placeholder="0"
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
                {(data.spouseBusinessIncome || 0) > 0 && (
                  <div className={styles.amountDisplay}>
                    {formatMoney(data.spouseBusinessIncome || 0)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );

    case "living_expenses":
      const expenseValue = data.livingExpenses || 0;
      return (
        <div className={styles.numberInputWithDisplay}>
          <div className={styles.numberInputGroup}>
            <NumberInput
              className={styles.numberInput}
              value={data.livingExpenses !== null ? data.livingExpenses : ""}
              onChange={(e) => {
                const value = e.target.value;
                onUpdateData({
                  livingExpenses: value === "" ? null : parseFloat(value) || 0,
                });
              }}
              placeholder="300"
            />
            <span className={styles.unit}>만원/월</span>
          </div>
          {expenseValue > 0 && (
            <div className={styles.amountDisplay}>
              {formatMoney(expenseValue)}
            </div>
          )}
        </div>
      );

    case "realEstate":
      return (
        <div className={styles.realEstateSection}>
          <div className={styles.buttonGroup}>
            {(["자가", "전세", "월세", "해당없음"] as const).map((type) => (
              <button
                key={type}
                className={`${styles.optionButton} ${
                  data.housingType === type ? styles.optionButtonActive : ""
                }`}
                onClick={() => onUpdateData({ housingType: type })}
              >
                {type}
              </button>
            ))}
          </div>

          {/* 자가: 시세 + 관리비 입력 */}
          {data.housingType === "자가" && (
            <div className={styles.realEstateInputs}>
              <div className={styles.realEstateRow}>
                <span className={styles.realEstateLabel}>시세</span>
                <div className={styles.inputWithAmount}>
                  <div className={styles.numberInputGroupInline}>
                    <NumberInput
                      className={styles.numberInputSmall}
                      value={data.housingValue !== null ? data.housingValue : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateData({
                          housingValue:
                            value === "" ? null : parseFloat(value) || 0,
                        });
                      }}
                      placeholder="0"
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                  {(data.housingValue || 0) > 0 && (
                    <div className={styles.amountDisplay}>
                      {formatMoney(data.housingValue || 0)}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.realEstateRow}>
                <span className={styles.realEstateLabel}>관리비</span>
                <div className={styles.inputWithAmount}>
                  <div className={styles.numberInputGroupInline}>
                    <NumberInput
                      className={styles.numberInputSmall}
                      value={data.housingMaintenance !== null ? data.housingMaintenance : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateData({
                          housingMaintenance:
                            value === "" ? null : parseFloat(value) || 0,
                        });
                      }}
                      placeholder="0"
                    />
                    <span className={styles.unit}>만원/월</span>
                  </div>
                  {(data.housingMaintenance || 0) > 0 && (
                    <div className={styles.amountDisplay}>
                      {formatMoney(data.housingMaintenance || 0)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 전세: 보증금 + 관리비 입력 */}
          {data.housingType === "전세" && (
            <div className={styles.realEstateInputs}>
              <div className={styles.realEstateRow}>
                <span className={styles.realEstateLabel}>보증금</span>
                <div className={styles.inputWithAmount}>
                  <div className={styles.numberInputGroupInline}>
                    <NumberInput
                      className={styles.numberInputSmall}
                      value={data.housingValue !== null ? data.housingValue : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateData({
                          housingValue:
                            value === "" ? null : parseFloat(value) || 0,
                        });
                      }}
                      placeholder="0"
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                  {(data.housingValue || 0) > 0 && (
                    <div className={styles.amountDisplay}>
                      {formatMoney(data.housingValue || 0)}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.realEstateRow}>
                <span className={styles.realEstateLabel}>관리비</span>
                <div className={styles.inputWithAmount}>
                  <div className={styles.numberInputGroupInline}>
                    <NumberInput
                      className={styles.numberInputSmall}
                      value={data.housingMaintenance !== null ? data.housingMaintenance : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateData({
                          housingMaintenance:
                            value === "" ? null : parseFloat(value) || 0,
                        });
                      }}
                      placeholder="0"
                    />
                    <span className={styles.unit}>만원/월</span>
                  </div>
                  {(data.housingMaintenance || 0) > 0 && (
                    <div className={styles.amountDisplay}>
                      {formatMoney(data.housingMaintenance || 0)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 월세: 보증금 + 월세 + 관리비 입력 */}
          {data.housingType === "월세" && (
            <div className={styles.realEstateInputs}>
              <div className={styles.realEstateRow}>
                <span className={styles.realEstateLabel}>보증금</span>
                <div className={styles.inputWithAmount}>
                  <div className={styles.numberInputGroupInline}>
                    <NumberInput
                      className={styles.numberInputSmall}
                      value={data.housingValue !== null ? data.housingValue : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateData({
                          housingValue:
                            value === "" ? null : parseFloat(value) || 0,
                        });
                      }}
                      placeholder="0"
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                  {(data.housingValue || 0) > 0 && (
                    <div className={styles.amountDisplay}>
                      {formatMoney(data.housingValue || 0)}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.realEstateRow}>
                <span className={styles.realEstateLabel}>월세</span>
                <div className={styles.inputWithAmount}>
                  <div className={styles.numberInputGroupInline}>
                    <NumberInput
                      className={styles.numberInputSmall}
                      value={data.housingRent !== null ? data.housingRent : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateData({
                          housingRent:
                            value === "" ? null : parseFloat(value) || 0,
                        });
                      }}
                      placeholder="0"
                    />
                    <span className={styles.unit}>만원/월</span>
                  </div>
                  {(data.housingRent || 0) > 0 && (
                    <div className={styles.amountDisplay}>
                      {formatMoney(data.housingRent || 0)}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.realEstateRow}>
                <span className={styles.realEstateLabel}>관리비</span>
                <div className={styles.inputWithAmount}>
                  <div className={styles.numberInputGroupInline}>
                    <NumberInput
                      className={styles.numberInputSmall}
                      value={data.housingMaintenance !== null ? data.housingMaintenance : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateData({
                          housingMaintenance:
                            value === "" ? null : parseFloat(value) || 0,
                        });
                      }}
                      placeholder="0"
                    />
                    <span className={styles.unit}>만원/월</span>
                  </div>
                  {(data.housingMaintenance || 0) > 0 && (
                    <div className={styles.amountDisplay}>
                      {formatMoney(data.housingMaintenance || 0)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 대출 추가 (자가, 전세, 월세 공통) */}
          {data.housingType && data.housingType !== "해당없음" && (
            <>
              {!data.housingHasLoan ? (
                <button
                  className={styles.addButton}
                  onClick={() => onUpdateData({ housingHasLoan: true })}
                >
                  +{" "}
                  {data.housingType === "자가"
                    ? "주택담보대출"
                    : "전월세보증금대출"}{" "}
                  추가
                </button>
              ) : (
                <div className={styles.debtCard}>
                  <div className={styles.debtCardHeader}>
                    <span className={styles.debtNameDisplay}>
                      {data.housingType === "자가"
                        ? "주택담보대출"
                        : "전월세보증금대출"}
                    </span>
                    <button
                      className={styles.debtDeleteButton}
                      onClick={() =>
                        onUpdateData({
                          housingHasLoan: false,
                          housingLoan: null,
                          housingLoanRate: null,
                          housingLoanMaturity: null,
                          housingLoanType: null,
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className={styles.debtRow}>
                    <span className={styles.debtLabel}>금액</span>
                    <div className={styles.inputWithAmount}>
                      <div className={styles.debtInputGroup}>
                        <NumberInput
                          className={styles.debtInput}
                          value={
                            data.housingLoan !== null ? data.housingLoan : ""
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            onUpdateData({
                              housingLoan:
                                value === "" ? null : parseFloat(value) || 0,
                            });
                          }}
                          placeholder="0"
                        />
                        <span className={styles.debtUnit}>만원</span>
                      </div>
                      {(data.housingLoan || 0) > 0 && (
                        <div className={styles.amountDisplay}>
                          {formatMoney(data.housingLoan || 0)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      );

    case "asset":
      // 간소화된 현금 보유 입력: 입출금통장만
      const checkingValue = data.cashCheckingAccount || 0;

      return (
        <div className={styles.pensionSection}>
          <div className={styles.pensionRow}>
            <span className={styles.pensionLabel}>입출금통장</span>
            <div className={styles.inputWithAmount}>
              <div className={styles.numberInputGroupInline}>
                <NumberInput
                  className={styles.numberInputSmall}
                  value={data.cashCheckingAccount !== null ? data.cashCheckingAccount : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    onUpdateData({
                      cashCheckingAccount: value === "" ? null : parseFloat(value) || 0,
                    });
                  }}
                  placeholder="0"
                />
                <span className={styles.unit}>만원</span>
              </div>
              {checkingValue > 0 && (
                <div className={styles.amountDisplay}>
                  {formatMoney(checkingValue)}
                </div>
              )}
            </div>
          </div>
          <p className={styles.pensionHint}>
            없으면 0을 입력하세요. 투자자산, 절세계좌 등은 대시보드에서 관리해요.
          </p>
        </div>
      );

    case "children":
      return (
        <div className={styles.childrenSection}>
          {/* 자녀 목록 */}
          {data.children.length > 0 && (
            <div className={styles.childrenList}>
              {data.children.map((child, index) => (
                <div key={index} className={styles.personRow}>
                  <span className={styles.personLabel}>
                    {child.gender === "male" ? "아들" : "딸"}
                  </span>
                  <div className={styles.dateInputGroup}>
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={child.birth_date || ""}
                      onChange={(e) => {
                        const newChildren = [...data.children];
                        newChildren[index] = {
                          ...newChildren[index],
                          birth_date: e.target.value,
                        };
                        onUpdateData({ children: newChildren });
                      }}
                      min="1990-01-01"
                      max="2099-12-31"
                    />
                    {child.birth_date && (
                      <span className={styles.ageDisplay}>
                        {calculateKoreanAge(child.birth_date)}세 (만{" "}
                        {calculateAge(child.birth_date)}세)
                      </span>
                    )}
                  </div>
                  <button
                    className={styles.removeSpouseButton}
                    onClick={() => {
                      const newChildren = data.children.filter(
                        (_, i) => i !== index
                      );
                      onUpdateData({ children: newChildren });
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 추가 버튼 */}
          <div className={styles.childrenAddButtons}>
            <button
              className={styles.addChildButton}
              onClick={() => {
                const newChild: FamilyMemberInput = {
                  relationship: "child",
                  name: `아들 ${
                    data.children.filter((c) => c.gender === "male").length + 1
                  }`,
                  gender: "male",
                  birth_date: "",
                };
                onUpdateData({ children: [...data.children, newChild] });
              }}
            >
              + 아들 추가
            </button>
            <button
              className={styles.addChildButton}
              onClick={() => {
                const newChild: FamilyMemberInput = {
                  relationship: "child",
                  name: `딸 ${
                    data.children.filter((c) => c.gender === "female").length +
                    1
                  }`,
                  gender: "female",
                  birth_date: "",
                };
                onUpdateData({ children: [...data.children, newChild] });
              }}
            >
              + 딸 추가
            </button>
          </div>

          {data.children.length === 0 && (
            <p className={styles.childrenHint}>
              자녀가 없으면 그냥 다음으로 넘어가세요
            </p>
          )}
        </div>
      );

    case "debt":
      return (
        <div className={styles.debtSection}>
          {/* 부채 목록 */}
          {data.debts.length > 0 && (
            <div className={styles.debtList}>
              {data.debts.map((debt, index) => (
                <div key={index} className={styles.debtCard}>
                  {/* 헤더: 대출명 + 삭제 */}
                  <div className={styles.debtCardHeader}>
                    <input
                      type="text"
                      className={styles.debtNameInput}
                      value={debt.name}
                      onChange={(e) => {
                        const newDebts = [...data.debts];
                        newDebts[index] = {
                          ...newDebts[index],
                          name: e.target.value,
                        };
                        onUpdateData({ debts: newDebts });
                      }}
                      placeholder="대출명"
                    />
                    <button
                      className={styles.debtDeleteButton}
                      onClick={() => {
                        const newDebts = data.debts.filter(
                          (_, i) => i !== index
                        );
                        onUpdateData({ debts: newDebts });
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* 금액 */}
                  <div className={styles.debtRow}>
                    <span className={styles.debtLabel}>금액</span>
                    <div className={styles.inputWithAmount}>
                      <div className={styles.debtInputGroup}>
                        <NumberInput
                          className={styles.debtInput}
                          value={debt.amount !== null ? debt.amount : ""}
                          onChange={(e) => {
                            const newDebts = [...data.debts];
                            const value = e.target.value;
                            newDebts[index] = {
                              ...newDebts[index],
                              amount:
                                value === "" ? null : parseFloat(value) || 0,
                            };
                            onUpdateData({ debts: newDebts });
                          }}
                          placeholder="0"
                        />
                        <span className={styles.debtUnit}>만원</span>
                      </div>
                      {(debt.amount || 0) > 0 && (
                        <div className={styles.amountDisplay}>
                          {formatMoney(debt.amount || 0)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 부채 추가 / 부채 없음 버튼 */}
          <div className={styles.debtButtons}>
            <button
              className={styles.addDebtButton}
              onClick={() => {
                const newDebt: DebtInput = {
                  id: `debt-${Date.now()}`,
                  name: "",
                  amount: null,
                  rate: null,
                  maturity: null,
                  repaymentType: null,
                };
                onUpdateData({
                  hasNoDebt: false,
                  debts: [...data.debts, newDebt],
                });
              }}
            >
              + 부채 추가
            </button>
            <button
              className={`${styles.noDebtButton} ${
                data.hasNoDebt === true ? styles.noDebtButtonActive : ""
              }`}
              onClick={() => {
                onUpdateData({ hasNoDebt: true, debts: [] });
              }}
            >
              부채 없음
            </button>
          </div>
        </div>
      );

    case "national_pension":
      // 예상 국민연금 수령액 계산 (본인)
      const monthlyIncome = (data.laborIncome || 0) + (data.businessIncome || 0);
      const retirementAge = data.target_retirement_age || 60;
      const estimatedPension = (() => {
        if (monthlyIncome <= 0) return 0;
        const grossIncome = Math.round(monthlyIncome / 0.85);
        const aValue = 309;
        const bValue = Math.min(Math.max(grossIncome, 40), 637);
        const contributionYears = Math.max(0, Math.min(retirementAge, 60) - 27);
        return Math.round((aValue + bValue) * contributionYears * 0.005);
      })();

      // 배우자 예상 국민연금 수령액 계산
      const spouseMonthlyIncome = (data.spouseLaborIncome || 0) + (data.spouseBusinessIncome || 0);
      const spouseRetirementAge = data.spouse?.retirement_age || 60;
      const spouseEstimatedPension = (() => {
        if (spouseMonthlyIncome <= 0) return 0;
        const grossIncome = Math.round(spouseMonthlyIncome / 0.85);
        const aValue = 309;
        const bValue = Math.min(Math.max(grossIncome, 40), 637);
        const contributionYears = Math.max(0, Math.min(spouseRetirementAge, 60) - 27);
        return Math.round((aValue + bValue) * contributionYears * 0.005);
      })();

      const hasWorkingSpouseForPension =
        data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;

      return (
        <div className={styles.pensionSection}>
          {/* 본인 국민연금 */}
          <div className={styles.personRow}>
            <span className={styles.personLabel}>본인</span>
            <div className={styles.inputWithAmount}>
              <div className={styles.numberInputGroupInline}>
                <NumberInput
                  className={styles.numberInputSmall}
                  value={data.nationalPension != null ? data.nationalPension : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    onUpdateData({
                      nationalPension:
                        value === "" ? null : parseFloat(value) || 0,
                      hasNoPension: false,
                    });
                  }}
                  placeholder={estimatedPension > 0 ? String(estimatedPension) : "0"}
                />
                <span className={styles.unit}>만원/월</span>
              </div>
              {(data.nationalPension || 0) > 0 && (
                <div className={styles.amountDisplay}>
                  {formatMoney(data.nationalPension || 0)}
                </div>
              )}
            </div>
          </div>

          {/* 배우자 국민연금 (배우자 은퇴 나이가 설정된 경우) */}
          {hasWorkingSpouseForPension && (
            <div className={styles.personRow}>
              <span className={styles.personLabel}>배우자</span>
              <div className={styles.inputWithAmount}>
                <div className={styles.numberInputGroupInline}>
                  <NumberInput
                    className={styles.numberInputSmall}
                    value={data.spouseNationalPension != null ? data.spouseNationalPension : ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      onUpdateData({
                        spouseNationalPension:
                          value === "" ? null : parseFloat(value) || 0,
                      });
                    }}
                    placeholder={spouseEstimatedPension > 0 ? String(spouseEstimatedPension) : "0"}
                  />
                  <span className={styles.unit}>만원/월</span>
                </div>
                {(data.spouseNationalPension || 0) > 0 && (
                  <div className={styles.amountDisplay}>
                    {formatMoney(data.spouseNationalPension || 0)}
                  </div>
                )}
              </div>
            </div>
          )}

          <p className={styles.pensionHint}>
            정확한 금액은 국민연금공단에서 확인하세요.
          </p>
        </div>
      );

    case "retirement_pension":
      // DC형/기업IRP vs DB형/퇴직금 구분
      const isDCType = data.retirementPensionType === "DC" || data.retirementPensionType === "corporate_irp";
      const isDBType = data.retirementPensionType === "DB" || data.retirementPensionType === "severance";
      const isUnknownType = data.retirementPensionType === "unknown";
      const hasWorkingSpouseForRetirement = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      const spouseIsDCType = data.spouseRetirementPensionType === "DC" || data.spouseRetirementPensionType === "corporate_irp";
      const spouseIsDBType = data.spouseRetirementPensionType === "DB" || data.spouseRetirementPensionType === "severance";
      const spouseIsUnknownType = data.spouseRetirementPensionType === "unknown";

      return (
        <div className={styles.pensionSection}>
          {/* 본인 퇴직연금 */}
          <div className={styles.personRow}>
            <span className={styles.personLabel}>본인</span>
            <div className={styles.retirementPensionInputs}>
              <div className={styles.buttonGroupSmall}>
                <button
                  className={`${styles.typeButton} ${isDCType ? styles.typeButtonActive : ""}`}
                  onClick={() => onUpdateData({ retirementPensionType: "DC", hasNoPension: false })}
                >
                  DC형/기업IRP
                </button>
                <button
                  className={`${styles.typeButton} ${isDBType ? styles.typeButtonActive : ""}`}
                  onClick={() => onUpdateData({ retirementPensionType: "DB", hasNoPension: false })}
                >
                  DB형/퇴직금
                </button>
                <button
                  className={`${styles.typeButton} ${isUnknownType ? styles.typeButtonActive : ""}`}
                  onClick={() => onUpdateData({ retirementPensionType: "unknown", hasNoPension: false })}
                >
                  모름
                </button>
              </div>
              {isDCType && (
                <div className={styles.numberInputGroupInline}>
                  <span className={styles.inputLabel}>적립금</span>
                  <NumberInput
                    className={styles.numberInputSmall}
                    value={data.retirementPensionBalance != null ? data.retirementPensionBalance : ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      onUpdateData({ retirementPensionBalance: value === "" ? null : parseFloat(value) || 0 });
                    }}
                    placeholder="0"
                  />
                  <span className={styles.unit}>만원</span>
                </div>
              )}
              {isDBType && (
                <div className={styles.numberInputGroupInline}>
                  <span className={styles.inputLabel}>근속</span>
                  <NumberInput
                    className={styles.numberInputSmall}
                    value={data.yearsOfService != null ? data.yearsOfService : ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      onUpdateData({ yearsOfService: value === "" ? null : parseInt(value) || 0 });
                    }}
                    placeholder="0"
                    min={0}
                    max={50}
                  />
                  <span className={styles.unit}>년</span>
                </div>
              )}
              {isUnknownType && (
                <p className={styles.pensionHint}>
                  대시보드에서 나중에 추가할 수 있어요.
                </p>
              )}
            </div>
          </div>

          {/* 배우자 퇴직연금 (배우자가 일하는 경우) */}
          {hasWorkingSpouseForRetirement && (
            <div className={styles.personRow}>
              <span className={styles.personLabel}>배우자</span>
              <div className={styles.retirementPensionInputs}>
                <div className={styles.buttonGroupSmall}>
                  <button
                    className={`${styles.typeButton} ${spouseIsDCType ? styles.typeButtonActive : ""}`}
                    onClick={() => onUpdateData({ spouseRetirementPensionType: "DC" })}
                  >
                    DC형/기업IRP
                  </button>
                  <button
                    className={`${styles.typeButton} ${spouseIsDBType ? styles.typeButtonActive : ""}`}
                    onClick={() => onUpdateData({ spouseRetirementPensionType: "DB" })}
                  >
                    DB형/퇴직금
                  </button>
                  <button
                    className={`${styles.typeButton} ${spouseIsUnknownType ? styles.typeButtonActive : ""}`}
                    onClick={() => onUpdateData({ spouseRetirementPensionType: "unknown" })}
                  >
                    모름
                  </button>
                </div>
                {spouseIsDCType && (
                  <div className={styles.numberInputGroupInline}>
                    <span className={styles.inputLabel}>적립금</span>
                    <NumberInput
                      className={styles.numberInputSmall}
                      value={data.spouseRetirementPensionBalance != null ? data.spouseRetirementPensionBalance : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateData({ spouseRetirementPensionBalance: value === "" ? null : parseFloat(value) || 0 });
                      }}
                      placeholder="0"
                    />
                    <span className={styles.unit}>만원</span>
                  </div>
                )}
                {spouseIsDBType && (
                  <div className={styles.numberInputGroupInline}>
                    <span className={styles.inputLabel}>근속</span>
                    <NumberInput
                      className={styles.numberInputSmall}
                      value={data.spouseYearsOfService != null ? data.spouseYearsOfService : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateData({ spouseYearsOfService: value === "" ? null : parseInt(value) || 0 });
                      }}
                      placeholder="0"
                      min={0}
                      max={50}
                    />
                    <span className={styles.unit}>년</span>
                  </div>
                )}
                {spouseIsUnknownType && (
                  <p className={styles.pensionHint}>
                    대시보드에서 나중에 추가할 수 있어요.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      );

    case "personal_pension":
      const hasWorkingSpouseForPersonalPension =
        data.spouse?.retirement_age != null && data.spouse.retirement_age > 0;
      return (
        <div className={styles.pensionSection}>
          {/* 본인 개인연금 */}
          <div className={styles.personRow}>
            <span className={styles.personLabel}>본인</span>
            <div className={styles.retirementPensionInputs}>
              <div className={styles.numberInputGroupInline}>
                <span className={styles.inputLabel}>IRP</span>
                <NumberInput
                  className={styles.numberInputSmall}
                  value={data.irpBalance != null ? data.irpBalance : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    onUpdateData({
                      irpBalance: value === "" ? null : parseFloat(value) || 0,
                      hasNoPension: false,
                    });
                  }}
                  placeholder="0"
                />
                <span className={styles.unit}>만원</span>
              </div>
              <div className={styles.numberInputGroupInline}>
                <span className={styles.inputLabel}>연금저축</span>
                <NumberInput
                  className={styles.numberInputSmall}
                  value={
                    data.pensionSavingsBalance != null
                      ? data.pensionSavingsBalance
                      : ""
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    onUpdateData({
                      pensionSavingsBalance:
                        value === "" ? null : parseFloat(value) || 0,
                      hasNoPension: false,
                    });
                  }}
                  placeholder="0"
                />
                <span className={styles.unit}>만원</span>
              </div>
            </div>
          </div>

          {/* 배우자 개인연금 (배우자가 일하는 경우) */}
          {hasWorkingSpouseForPersonalPension && (
            <div className={styles.personRow}>
              <span className={styles.personLabel}>배우자</span>
              <div className={styles.retirementPensionInputs}>
                <div className={styles.numberInputGroupInline}>
                  <span className={styles.inputLabel}>IRP</span>
                  <NumberInput
                    className={styles.numberInputSmall}
                    value={data.spouseIrpBalance != null ? data.spouseIrpBalance : ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      onUpdateData({
                        spouseIrpBalance: value === "" ? null : parseFloat(value) || 0,
                      });
                    }}
                    placeholder="0"
                  />
                  <span className={styles.unit}>만원</span>
                </div>
                <div className={styles.numberInputGroupInline}>
                  <span className={styles.inputLabel}>연금저축</span>
                  <NumberInput
                    className={styles.numberInputSmall}
                    value={
                      data.spousePensionSavingsBalance != null
                        ? data.spousePensionSavingsBalance
                        : ""
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      onUpdateData({
                        spousePensionSavingsBalance:
                          value === "" ? null : parseFloat(value) || 0,
                      });
                    }}
                    placeholder="0"
                  />
                  <span className={styles.unit}>만원</span>
                </div>
              </div>
            </div>
          )}

          <p className={styles.pensionHint}>
            없으면 0을 입력하세요. ISA는 절세 투자계좌라 저축/투자에서 관리해요.
          </p>
        </div>
      );

    default:
      return (
        <p className={styles.placeholder}>
          이 항목은 오른쪽 스프레드시트에서 입력해주세요.
        </p>
      );
  }
}

// 만 나이 계산
function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// 한국 나이 계산 (현재년도 - 출생년도 + 1)
function calculateKoreanAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  return today.getFullYear() - birth.getFullYear() + 1;
}
