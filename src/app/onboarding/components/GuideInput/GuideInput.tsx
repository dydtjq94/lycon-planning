"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { OnboardingData } from "@/types";
import { type RowId, rows, hasWorkingSpouse, purposeOptions, purposeEmpathy } from "../ProgressiveForm/types";
import type { OnboardingPurpose } from "@/types";
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

// 각 스텝에 대한 질문과 설명
const stepQuestions: Partial<Record<RowId, { question: string; description?: string }>> = {
  // Part 1: 목적
  purpose: {
    question: "Lycon에서 뭘 해보고 싶으세요?",
    description: "여러 개 선택해도 괜찮아요.",
  },
  purpose_empathy: {
    question: "", // 공감 메시지 화면 - 질문 없음
  },
  // Part 2: 알아가기
  name: {
    question: "어떻게 불러드리면 될까요?",
  },
  birth: {
    question: "몇 년생이세요?",
  },
  retirement_age: {
    question: "은퇴는 언제쯤 생각하고 계세요?",
  },
  // Part 3: 가족
  spouse: {
    question: "결혼하셨나요?",
  },
  spouse_info: {
    question: "배우자분에 대해 알려주세요",
  },
  children: {
    question: "자녀가 있으신가요?",
  },
  children_info: {
    question: "자녀 정보를 입력해주세요",
    description: "교육비 계획에 활용돼요.",
  },
  // Part 4: 재무
  income: {
    question: "월 소득이 대략 얼마인가요?",
    description: "정확하지 않아도 괜찮아요, 나중에 수정할 수 있어요.",
  },
  expense: {
    question: "월 생활비는 대략 얼마 정도 쓰세요?",
    description: "주거비, 식비, 교통비 등 모두 포함해서요.",
  },
  // Part 5: 완료
  complete: {
    question: "", // 완료 화면 - 질문 없음
  },
  // 하위 호환성 (deprecated)
  basic_info: {
    question: "기본 정보를 알려주세요",
    description: "생년월일과 은퇴 목표 나이가 필요해요.",
  },
};

// 하위 호환성
const rowQuestions = stepQuestions;

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

// 각 스텝에 맞는 입력 UI 렌더링
function renderInputForRow(
  rowId: RowId,
  data: OnboardingData,
  onUpdateData: (updates: Partial<OnboardingData>) => void
) {
  switch (rowId) {
    // ========================================
    // Part 1: 목적
    // ========================================
    case "purpose":
      const selectedPurposes = data.purposes || [];
      const togglePurpose = (purposeId: OnboardingPurpose) => {
        const current = data.purposes || [];
        if (current.includes(purposeId)) {
          onUpdateData({ purposes: current.filter(p => p !== purposeId) });
        } else {
          onUpdateData({ purposes: [...current, purposeId] });
        }
      };
      return (
        <div className={styles.purposeSection}>
          <div className={styles.purposeOptions}>
            {purposeOptions.map((option) => (
              <button
                key={option.id}
                className={`${styles.purposeOption} ${
                  selectedPurposes.includes(option.id) ? styles.purposeOptionActive : ""
                }`}
                onClick={() => togglePurpose(option.id)}
              >
                <span className={styles.purposeCheck}>
                  {selectedPurposes.includes(option.id) ? "✓" : ""}
                </span>
                <span className={styles.purposeLabel}>{option.label}</span>
              </button>
            ))}
          </div>
          {selectedPurposes.length > 0 && (
            <p className={styles.purposeHint}>
              {selectedPurposes.length}개 선택됨
            </p>
          )}
        </div>
      );

    case "purpose_empathy":
      const purposes = data.purposes || [];
      if (purposes.length === 0) {
        return null;
      }
      return (
        <div className={styles.empathySection}>
          {purposes.map((purposeId, index) => (
            <p key={purposeId} className={styles.empathyMessage}>
              {purposeEmpathy[purposeId]}
            </p>
          ))}
        </div>
      );

    // ========================================
    // Part 2: 알아가기
    // ========================================
    case "name":
      return (
        <div className={styles.singleInputSection}>
          <input
            type="text"
            className={styles.largeTextInput}
            value={data.name}
            onChange={(e) => onUpdateData({ name: e.target.value })}
            placeholder="이름을 입력해주세요"
            autoFocus
          />
        </div>
      );

    case "birth":
      return (
        <div className={styles.singleInputSection}>
          <input
            type="date"
            className={styles.largeDateInput}
            value={data.birth_date}
            onChange={(e) => onUpdateData({ birth_date: e.target.value })}
            min="1900-01-01"
            max="9999-12-31"
          />
          {data.birth_date && (
            <p className={styles.ageInfo}>
              만 {calculateAge(data.birth_date)}세
            </p>
          )}
        </div>
      );

    case "retirement_age":
      return (
        <div className={styles.singleInputSection}>
          <div className={styles.retirementAgeInput}>
            <NumberInput
              className={styles.largeNumberInput}
              value={data.target_retirement_age || ""}
              onChange={(e) =>
                onUpdateData({
                  target_retirement_age: parseInt(e.target.value) || 0,
                })
              }
              placeholder="55"
              min={30}
              max={100}
            />
            <span className={styles.largeUnit}>세</span>
          </div>
          {data.birth_date && data.target_retirement_age > 0 && (
            <p className={styles.yearsLeftInfo}>
              {(() => {
                const age = calculateAge(data.birth_date);
                const yearsLeft = data.target_retirement_age - age;
                if (yearsLeft > 0) {
                  return `앞으로 ${yearsLeft}년 남았어요`;
                } else if (yearsLeft === 0) {
                  return "올해가 은퇴 목표 연도예요";
                } else {
                  return `이미 ${Math.abs(yearsLeft)}년 지났어요`;
                }
              })()}
            </p>
          )}
        </div>
      );

    // ========================================
    // Part 3: 가족
    // ========================================
    case "spouse":
      return (
        <div className={styles.yesNoSection}>
          <div className={styles.yesNoButtons}>
            <button
              className={`${styles.yesNoButton} ${
                data.isMarried === true ? styles.yesNoButtonActive : ""
              }`}
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
              네, 결혼했어요
            </button>
            <button
              className={`${styles.yesNoButton} ${
                data.isMarried === false ? styles.yesNoButtonActive : ""
              }`}
              onClick={() =>
                onUpdateData({
                  isMarried: false,
                  spouse: null,
                  spouseLaborIncome: null,
                  spouseBusinessIncome: null,
                })
              }
            >
              아니요
            </button>
          </div>
        </div>
      );

    case "spouse_info":
      if (!data.isMarried) {
        return null;
      }
      return (
        <div className={styles.spouseInfoSection}>
          {/* 배우자 생년월일 */}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>생년월일</span>
            <div className={styles.infoInputGroup}>
              <input
                type="date"
                className={styles.largeDateInput}
                value={data.spouse?.birth_date || ""}
                onChange={(e) =>
                  onUpdateData({
                    spouse: { ...data.spouse!, birth_date: e.target.value },
                  })
                }
                min="1900-01-01"
                max="9999-12-31"
              />
              {data.spouse?.birth_date && (
                <span className={styles.infoAgeDisplay}>
                  만 {calculateAge(data.spouse.birth_date)}세
                </span>
              )}
            </div>
          </div>

          {/* 배우자 소득 여부 */}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>소득 유무</span>
            <div className={styles.smallButtonGroup}>
              <button
                className={`${styles.smallButton} ${
                  data.spouse?.retirement_age !== undefined
                    ? styles.smallButtonActive
                    : ""
                }`}
                onClick={() =>
                  onUpdateData({
                    spouse: { ...data.spouse!, retirement_age: 55 },
                  })
                }
              >
                소득 있음
              </button>
              <button
                className={`${styles.smallButton} ${
                  data.spouse?.retirement_age === undefined
                    ? styles.smallButtonActive
                    : ""
                }`}
                onClick={() =>
                  onUpdateData({
                    spouse: { ...data.spouse!, retirement_age: undefined },
                    spouseLaborIncome: null,
                    spouseBusinessIncome: null,
                  })
                }
              >
                소득 없음
              </button>
            </div>
          </div>

          {/* 배우자 은퇴 나이 (소득이 있는 경우) */}
          {data.spouse?.retirement_age !== undefined && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>은퇴 나이</span>
              <div className={styles.retirementAgeInput}>
                <NumberInput
                  className={styles.largeNumberInput}
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
                <span className={styles.largeUnit}>세</span>
              </div>
            </div>
          )}
        </div>
      );

    case "children":
      return (
        <div className={styles.yesNoSection}>
          <div className={styles.yesNoButtons}>
            <button
              className={`${styles.yesNoButton} ${
                data.hasChildren === true ? styles.yesNoButtonActive : ""
              }`}
              onClick={() =>
                onUpdateData({
                  hasChildren: true,
                  children: data.children.length > 0 ? data.children : [],
                })
              }
            >
              네, 있어요
            </button>
            <button
              className={`${styles.yesNoButton} ${
                data.hasChildren === false ? styles.yesNoButtonActive : ""
              }`}
              onClick={() =>
                onUpdateData({
                  hasChildren: false,
                  children: [],
                })
              }
            >
              아니요
            </button>
          </div>
        </div>
      );

    case "children_info":
      if (!data.hasChildren) {
        return null;
      }
      const addChild = (genderType: "male" | "female") => {
        const childCount = data.children.filter(c => c.gender === genderType).length + 1;
        const newChild = {
          relationship: "child" as const,
          name: genderType === "male" ? `아들${childCount > 1 ? childCount : ""}` : `딸${childCount > 1 ? childCount : ""}`,
          gender: genderType,
          birth_date: "",
        };
        onUpdateData({
          children: [...data.children, newChild],
        });
      };
      const updateChildBirthDate = (index: number, birthDate: string) => {
        const updatedChildren = data.children.map((child, i) =>
          i === index ? { ...child, birth_date: birthDate } : child
        );
        onUpdateData({ children: updatedChildren });
      };
      const removeChild = (index: number) => {
        const updatedChildren = data.children.filter((_, i) => i !== index);
        onUpdateData({
          children: updatedChildren,
          hasChildren: updatedChildren.length > 0,
        });
      };
      return (
        <div className={styles.childrenInfoSection}>
          {/* 자녀 목록 */}
          {data.children.length > 0 && (
            <div className={styles.childrenList}>
              {data.children.map((child, index) => (
                <div key={index} className={styles.childItem}>
                  <span className={styles.childLabel}>
                    {child.gender === "male" ? "아들" : "딸"}
                  </span>
                  <input
                    type="date"
                    className={styles.childDateInput}
                    value={child.birth_date || ""}
                    onChange={(e) => updateChildBirthDate(index, e.target.value)}
                    min="1990-01-01"
                    max="9999-12-31"
                  />
                  {child.birth_date && (
                    <span className={styles.childAge}>
                      만 {calculateAge(child.birth_date)}세
                    </span>
                  )}
                  <button
                    className={styles.childDeleteButton}
                    onClick={() => removeChild(index)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 자녀 추가 버튼 */}
          <div className={styles.childrenAddButtons}>
            <button
              className={styles.addChildButton}
              onClick={() => addChild("male")}
            >
              + 아들 추가
            </button>
            <button
              className={styles.addChildButton}
              onClick={() => addChild("female")}
            >
              + 딸 추가
            </button>
          </div>

          {data.children.length === 0 && (
            <p className={styles.childrenHint}>
              자녀 정보를 추가해주세요
            </p>
          )}
        </div>
      );

    // ========================================
    // 하위 호환성 (deprecated)
    // ========================================
    case "basic_info":
      return (
        <div className={styles.basicInfoSection}>
          {/* 이름 */}
          <div className={styles.personRow}>
            <span className={styles.personLabel}>이름</span>
            <input
              type="text"
              className={styles.textInput}
              value={data.name}
              onChange={(e) => onUpdateData({ name: e.target.value })}
              placeholder="이름 입력"
            />
          </div>

          {/* 본인 생년월일 */}
          <div className={styles.personRow}>
            <span className={styles.personLabel}>생년월일</span>
            <div className={styles.dateInputGroup}>
              <input
                type="date"
                className={styles.dateInput}
                value={data.birth_date}
                onChange={(e) => onUpdateData({ birth_date: e.target.value })}
                min="1900-01-01"
                max="9999-12-31"
              />
              {data.birth_date && (
                <span className={styles.ageDisplay}>
                  {calculateKoreanAge(data.birth_date)}세 (만{" "}
                  {calculateAge(data.birth_date)}세)
                </span>
              )}
            </div>
          </div>

          {/* 은퇴 나이 */}
          <div className={styles.personRow}>
            <span className={styles.personLabel}>은퇴 나이</span>
            <div className={styles.numberInputGroupInline}>
              <NumberInput
                className={styles.numberInputSmall}
                value={data.target_retirement_age || ""}
                onChange={(e) =>
                  onUpdateData({
                    target_retirement_age: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="55"
                min={30}
                max={100}
              />
              <span className={styles.unit}>세</span>
            </div>
          </div>

          {/* 배우자 추가 */}
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
              <>
                <div className={styles.personRow}>
                  <span className={styles.personLabel}>배우자 생년월일</span>
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
                      max="9999-12-31"
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

                {/* 배우자 은퇴 나이 (소득이 있는 경우) */}
                {data.spouse?.retirement_age === undefined ? (
                  <button
                    className={styles.addSpouseButton}
                    onClick={() =>
                      onUpdateData({
                        spouse: { ...data.spouse!, retirement_age: 55 },
                      })
                    }
                  >
                    + 배우자도 소득이 있어요
                  </button>
                ) : (
                  <div className={styles.personRow}>
                    <span className={styles.personLabel}>배우자 은퇴 나이</span>
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
              </>
            )}
          </div>
        </div>
      );

    case "income":
      const hasSpouseIncome = hasWorkingSpouse(data);
      return (
        <div className={styles.incomeSection}>
          {/* 본인 소득 */}
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

          {/* 배우자 소득 (배우자 은퇴 나이가 설정된 경우) */}
          {hasSpouseIncome && (
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

          <p className={styles.hint}>
            사업소득, 기타소득은 대시보드에서 추가할 수 있어요.
          </p>
        </div>
      );

    case "expense":
      const expenseValue = data.livingExpenses || 0;
      return (
        <div className={styles.expenseSection}>
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
          <p className={styles.hint}>
            부동산, 부채, 연금 등은 대시보드에서 상세히 입력할 수 있어요.
          </p>
        </div>
      );

    // ========================================
    // Part 5: 완료
    // ========================================
    case "complete":
      return (
        <div className={styles.completeSection}>
          <h2 className={styles.completeTitle}>
            {data.name}님, 준비가 완료됐어요
          </h2>
          <p className={styles.completeDescription}>
            입력하신 정보를 바탕으로{"\n"}
            은퇴 계획을 분석해드릴게요.
          </p>
          <div className={styles.completeSummary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>목표 은퇴 나이</span>
              <span className={styles.summaryValue}>{data.target_retirement_age}세</span>
            </div>
            {data.isMarried && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>가족 구성</span>
                <span className={styles.summaryValue}>
                  배우자{data.children.length > 0 ? `, 자녀 ${data.children.length}명` : ""}
                </span>
              </div>
            )}
            {!data.isMarried && data.children.length > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>가족 구성</span>
                <span className={styles.summaryValue}>자녀 {data.children.length}명</span>
              </div>
            )}
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>월 소득</span>
              <span className={styles.summaryValue}>
                {formatMoney((data.laborIncome || 0) + (data.spouseLaborIncome || 0))}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>월 지출</span>
              <span className={styles.summaryValue}>{formatMoney(data.livingExpenses || 0)}</span>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <p className={styles.placeholder}>
          이 항목은 대시보드에서 입력해주세요.
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
