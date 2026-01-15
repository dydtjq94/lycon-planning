"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import type { OnboardingData, OnboardingPurpose } from "@/types";
import {
  type StepId,
  type Phase,
  steps,
  getVisibleSteps,
  purposeOptions,
  calculateAge,
} from "./types";
import { getGreeting, getResponse } from "./messages";
import { TypewriterText } from "./TypewriterText";
import styles from "./ConversationalForm.module.css";

interface ConversationalFormProps {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
  onComplete: () => void;
  isSaving?: boolean;
}

export function ConversationalForm({
  data,
  onUpdateData,
  onComplete,
  isSaving = false,
}: ConversationalFormProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ask");
  const [isAnimating, setIsAnimating] = useState(false);
  const [matchingPhase, setMatchingPhase] = useState<
    "matching" | "assigned" | "matched" | null
  >(null);

  const visibleSteps = getVisibleSteps(data);
  const currentStep = visibleSteps[stepIndex];
  const isLastStep = stepIndex === visibleSteps.length - 1;

  // 현재 스텝이 완료되었는지
  const isStepComplete = currentStep?.isComplete(data) ?? false;

  // 애니메이션 duration (CSS와 동일하게)
  const ANIMATION_DURATION = 150;

  // 다음으로 이동
  const handleNext = () => {
    if (!currentStep || isAnimating) return;

    if (phase === "ask") {
      // ask → respond (응답 화면이 있는 경우만)
      const response = getResponse(currentStep.id, data);
      if (response) {
        setIsAnimating(true);
        setTimeout(() => {
          setPhase("respond");
          setTimeout(() => setIsAnimating(false), 50);
        }, ANIMATION_DURATION);
      } else {
        // 응답 없으면 바로 다음 스텝
        goToNextStep();
      }
    } else {
      // respond → 다음 스텝
      goToNextStep();
    }
  };

  const goToNextStep = () => {
    if (isLastStep) {
      onComplete();
      return;
    }

    // 다음이 complete 단계면 매칭 효과 시작
    const nextStep = visibleSteps[stepIndex + 1];
    if (nextStep?.id === "complete") {
      setIsAnimating(true);
      setTimeout(() => {
        setStepIndex((prev) => prev + 1);
        setPhase("ask");
        setMatchingPhase("matching");
        setTimeout(() => setIsAnimating(false), 50);

        // 7초 후 배정 완료 메시지
        setTimeout(() => {
          setMatchingPhase("assigned");
        }, 7000);

        // 9초 후 전문가 카드
        setTimeout(() => {
          setMatchingPhase("matched");
        }, 9000);
      }, ANIMATION_DURATION);
      return;
    }

    setIsAnimating(true);
    setTimeout(() => {
      setStepIndex((prev) => prev + 1);
      setPhase("ask");
      setTimeout(() => setIsAnimating(false), 50);
    }, ANIMATION_DURATION);
  };

  // 이전으로 이동
  const handlePrev = () => {
    if (isAnimating) return;

    if (phase === "respond") {
      setIsAnimating(true);
      setTimeout(() => {
        setPhase("ask");
        setTimeout(() => setIsAnimating(false), 50);
      }, ANIMATION_DURATION);
    } else if (stepIndex > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setStepIndex((prev) => prev - 1);
        // 이전 스텝의 응답 화면으로
        const prevStep = visibleSteps[stepIndex - 1];
        const prevResponse = getResponse(prevStep.id, data);
        setPhase(prevResponse ? "respond" : "ask");
        setTimeout(() => setIsAnimating(false), 50);
      }, ANIMATION_DURATION);
    }
  };

  // 버튼 라벨
  const getButtonLabel = () => {
    if (currentStep?.id === "welcome") return "시작하기";
    if (currentStep?.id === "complete") return "시작하기";
    if (phase === "respond") return "계속";
    return "다음";
  };

  // 버튼 비활성화 여부
  const isButtonDisabled = () => {
    if (currentStep?.id === "welcome") return false;
    if (currentStep?.id === "complete") return false;
    if (phase === "respond") return false;
    return !isStepComplete;
  };

  if (!currentStep) return null;

  const greeting = getGreeting(currentStep.id, data);
  const response =
    phase === "respond" ? getResponse(currentStep.id, data) : null;

  return (
    <div className={styles.container}>
      {/* 헤더 - 상단 고정 */}
      <header className={styles.header}>
        <span className={styles.logo}>Lycon</span>
      </header>

      {/* 메인 카드 */}
      <div className={styles.card}>
        <div
          className={`${styles.content} ${
            isAnimating ? styles.contentHidden : ""
          }`}
        >
          {/* 완료 화면 - 전문가 매칭 */}
          {currentStep.id === "complete" ? (
            <div className={styles.matchingArea}>
              {matchingPhase === "matching" ? (
                <>
                  <div className={styles.messageArea}>
                    <MessageWithSubtitle
                      text={`${data.name}님께 맞는\n전문가를 찾고 있어요...`}
                    />
                  </div>
                  <ExpertMatching />
                </>
              ) : matchingPhase === "assigned" ? (
                <>
                  <div className={styles.messageArea}>
                    <MessageWithSubtitle
                      text={`${data.name}님께 맞는\n전문가를 찾고 있어요...`}
                    />
                  </div>
                  <div className={styles.assignedMessage}>
                    <span className={styles.assignedText}>
                      {data.name}님을 도와줄
                      <br />
                      담당 자산관리사가 배정되었습니다
                    </span>
                  </div>
                </>
              ) : matchingPhase === "matched" ? (
                <>
                  <ExpertCardHorizontal />
                  <div className={styles.expertGreeting}>
                    <TypewriterText
                      key="expert-greeting"
                      text={`${data.name}님, 반갑습니다.\n\n은퇴 준비, 혼자 하려니 막막하셨죠?\n금융이란 게 원래 복잡해요.\n연금, 세금, 투자... 혼자 다 알기엔 너무 많죠.\n\n그래서 옆에 누가 있어야 해요.\n물어볼 사람, 확인해줄 사람.\n\n저와 함께 은퇴를 준비해보시죠!`}
                      speed={25}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <>
              {/* 담당자 메시지 */}
              <div className={styles.messageArea}>
                {currentStep.id === "welcome" || phase === "respond" ? (
                  <TypewriterText
                    key={`${currentStep.id}-${phase}`}
                    text={phase === "ask" ? greeting : response || ""}
                    speed={25}
                  />
                ) : (
                  <MessageWithSubtitle text={greeting} />
                )}
              </div>

              {/* 입력 영역 (ask 페이즈에서만) */}
              {phase === "ask" && currentStep.inputType !== "none" && (
                <div className={styles.inputArea}>
                  {renderInput(currentStep.id, data, onUpdateData)}
                </div>
              )}
            </>
          )}
        </div>

        {/* 네비게이션 - 매칭 중/배정 중에는 숨김 */}
        {!(currentStep.id === "complete" && (matchingPhase === "matching" || matchingPhase === "assigned")) && (
          <div className={styles.navigation}>
            {stepIndex > 0 || phase === "respond" ? (
              <button className={styles.prevButton} onClick={handlePrev}>
                이전
              </button>
            ) : (
              <div />
            )}
            <button
              className={styles.nextButton}
              onClick={handleNext}
              disabled={isButtonDisabled() || isSaving}
            >
              {isSaving ? (
                <Loader2 size={18} className={styles.buttonSpinner} />
              ) : (
                getButtonLabel()
              )}
            </button>
          </div>
        )}

        {/* 스텝 인디케이터 */}
        <div className={styles.stepIndicator}>
          {visibleSteps.map((step, idx) => (
            <div
              key={step.id}
              className={`${styles.dot} ${
                idx === stepIndex ? styles.dotActive : ""
              } ${idx < stepIndex ? styles.dotComplete : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// 입력 렌더링
// ============================================

function renderInput(
  stepId: StepId,
  data: OnboardingData,
  onUpdateData: (updates: Partial<OnboardingData>) => void
) {
  switch (stepId) {
    case "purpose":
      return <PurposeInput data={data} onUpdateData={onUpdateData} />;

    case "name":
      return (
        <input
          type="text"
          className={styles.textInput}
          value={data.name}
          onChange={(e) => onUpdateData({ name: e.target.value })}
          placeholder="이름을 입력해주세요"
          autoFocus
        />
      );

    case "birth":
      return (
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
              만 {calculateAge(data.birth_date)}세
            </span>
          )}
        </div>
      );

    case "retirement_age":
      return (
        <div className={styles.numberInputGroup}>
          <input
            type="number"
            className={styles.numberInput}
            value={data.target_retirement_age || ""}
            onChange={(e) =>
              onUpdateData({
                target_retirement_age: parseInt(e.target.value) || 0,
              })
            }
            placeholder="55"
            min={30}
            max={100}
            onWheel={(e) => (e.target as HTMLElement).blur()}
          />
          <span className={styles.unit}>세</span>
        </div>
      );

    case "spouse":
      return (
        <YesNoInput
          value={data.isMarried}
          yesLabel="네, 결혼했어요"
          noLabel="아니요"
          onSelect={(value) => {
            if (value) {
              onUpdateData({
                isMarried: true,
                spouse: {
                  relationship: "spouse",
                  name: "배우자",
                  gender: "female",
                  birth_date: "",
                },
              });
            } else {
              onUpdateData({
                isMarried: false,
                spouse: null,
                spouseLaborIncome: null,
              });
            }
          }}
        />
      );

    case "spouse_info":
      return <SpouseInfoInput data={data} onUpdateData={onUpdateData} />;

    case "children":
      return (
        <YesNoInput
          value={data.hasChildren}
          yesLabel="네, 있어요"
          noLabel="아니요"
          onSelect={(value) => {
            onUpdateData({
              hasChildren: value,
              children: value ? data.children : [],
            });
          }}
        />
      );

    case "children_info":
      return <ChildrenInput data={data} onUpdateData={onUpdateData} />;

    case "income":
      return <IncomeInput data={data} onUpdateData={onUpdateData} />;

    case "expense":
      return (
        <div className={styles.numberInputGroup}>
          <input
            type="number"
            className={styles.numberInput}
            value={data.livingExpenses !== null ? data.livingExpenses : ""}
            onChange={(e) => {
              const value = e.target.value;
              onUpdateData({
                livingExpenses: value === "" ? null : parseFloat(value) || 0,
              });
            }}
            placeholder="300"
            onWheel={(e) => (e.target as HTMLElement).blur()}
          />
          <span className={styles.unit}>만원/월</span>
        </div>
      );

    default:
      return null;
  }
}

// ============================================
// 개별 입력 컴포넌트들
// ============================================

function PurposeInput({
  data,
  onUpdateData,
}: {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
}) {
  const selected = data.purposes || [];

  const toggle = (id: OnboardingPurpose) => {
    if (selected.includes(id)) {
      onUpdateData({ purposes: selected.filter((p) => p !== id) });
    } else {
      onUpdateData({ purposes: [...selected, id] });
    }
  };

  return (
    <div className={styles.purposeOptions}>
      {purposeOptions.map((option) => (
        <button
          key={option.id}
          className={`${styles.purposeOption} ${
            selected.includes(option.id) ? styles.purposeOptionActive : ""
          }`}
          onClick={() => toggle(option.id)}
        >
          <span className={styles.purposeCheck}>
            {selected.includes(option.id) ? "✓" : ""}
          </span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function YesNoInput({
  value,
  yesLabel,
  noLabel,
  onSelect,
}: {
  value: boolean | null;
  yesLabel: string;
  noLabel: string;
  onSelect: (value: boolean) => void;
}) {
  return (
    <div className={styles.yesNoButtons}>
      <button
        className={`${styles.yesNoButton} ${
          value === true ? styles.yesNoButtonActive : ""
        }`}
        onClick={() => onSelect(true)}
      >
        {yesLabel}
      </button>
      <button
        className={`${styles.yesNoButton} ${
          value === false ? styles.yesNoButtonActive : ""
        }`}
        onClick={() => onSelect(false)}
      >
        {noLabel}
      </button>
    </div>
  );
}

function SpouseInfoInput({
  data,
  onUpdateData,
}: {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
}) {
  const hasIncome = data.spouse?.retirement_age !== undefined;

  return (
    <div className={styles.formGroup}>
      {/* 생년월일 */}
      <div className={styles.formRow}>
        <label className={styles.formLabel}>생년월일</label>
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
              만 {calculateAge(data.spouse.birth_date)}세
            </span>
          )}
        </div>
      </div>

      {/* 소득 여부 */}
      <div className={styles.formRow}>
        <label className={styles.formLabel}>소득 유무</label>
        <div className={styles.smallButtonGroup}>
          <button
            className={`${styles.smallButton} ${
              hasIncome ? styles.smallButtonActive : ""
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
              !hasIncome ? styles.smallButtonActive : ""
            }`}
            onClick={() =>
              onUpdateData({
                spouse: { ...data.spouse!, retirement_age: undefined },
                spouseLaborIncome: null,
              })
            }
          >
            소득 없음
          </button>
        </div>
      </div>

      {/* 은퇴 나이 (소득 있을 때) */}
      {hasIncome && (
        <div className={styles.formRow}>
          <label className={styles.formLabel}>은퇴 나이</label>
          <div className={styles.numberInputGroup}>
            <input
              type="number"
              className={styles.numberInputSmall}
              value={data.spouse?.retirement_age || ""}
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
              onWheel={(e) => (e.target as HTMLElement).blur()}
            />
            <span className={styles.unit}>세</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChildrenInput({
  data,
  onUpdateData,
}: {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
}) {
  const addChild = (gender: "male" | "female") => {
    const count = data.children.filter((c) => c.gender === gender).length + 1;
    const name =
      gender === "male"
        ? `아들${count > 1 ? count : ""}`
        : `딸${count > 1 ? count : ""}`;
    onUpdateData({
      children: [
        ...data.children,
        { relationship: "child", name, gender, birth_date: "" },
      ],
    });
  };

  const updateBirthDate = (index: number, birthDate: string) => {
    const updated = data.children.map((child, i) =>
      i === index ? { ...child, birth_date: birthDate } : child
    );
    onUpdateData({ children: updated });
  };

  const removeChild = (index: number) => {
    const updated = data.children.filter((_, i) => i !== index);
    onUpdateData({
      children: updated,
      hasChildren: updated.length > 0,
    });
  };

  return (
    <div className={styles.childrenSection}>
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
                onChange={(e) => updateBirthDate(index, e.target.value)}
                min="1990-01-01"
                max="2099-12-31"
              />
              {child.birth_date && (
                <span className={styles.childAge}>
                  만 {calculateAge(child.birth_date)}세
                </span>
              )}
              <button
                className={styles.removeButton}
                onClick={() => removeChild(index)}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 추가 버튼 */}
      <div className={styles.addButtons}>
        <button className={styles.addButton} onClick={() => addChild("male")}>
          + 아들 추가
        </button>
        <button className={styles.addButton} onClick={() => addChild("female")}>
          + 딸 추가
        </button>
      </div>
    </div>
  );
}

function IncomeInput({
  data,
  onUpdateData,
}: {
  data: OnboardingData;
  onUpdateData: (updates: Partial<OnboardingData>) => void;
}) {
  const hasSpouseIncome = data.spouse?.retirement_age !== undefined;

  return (
    <div className={styles.formGroup}>
      {/* 본인 소득 */}
      <div className={styles.formRow}>
        <label className={styles.formLabel}>본인</label>
        <div className={styles.numberInputGroup}>
          <input
            type="number"
            className={styles.numberInputSmall}
            value={data.laborIncome !== null ? data.laborIncome : ""}
            onChange={(e) => {
              const value = e.target.value;
              onUpdateData({
                laborIncome: value === "" ? null : parseFloat(value) || 0,
              });
            }}
            placeholder="500"
            onWheel={(e) => (e.target as HTMLElement).blur()}
          />
          <span className={styles.unit}>만원/월</span>
        </div>
      </div>

      {/* 배우자 소득 */}
      {hasSpouseIncome && (
        <div className={styles.formRow}>
          <label className={styles.formLabel}>배우자</label>
          <div className={styles.numberInputGroup}>
            <input
              type="number"
              className={styles.numberInputSmall}
              value={
                data.spouseLaborIncome !== null ? data.spouseLaborIncome : ""
              }
              onChange={(e) => {
                const value = e.target.value;
                onUpdateData({
                  spouseLaborIncome:
                    value === "" ? null : parseFloat(value) || 0,
                });
              }}
              placeholder="300"
              onWheel={(e) => (e.target as HTMLElement).blur()}
            />
            <span className={styles.unit}>만원/월</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageWithSubtitle({ text }: { text: string }) {
  // 빈 줄로 title과 subtitle 분리
  const parts = text.split("\n\n");
  const title = parts[0].trim();
  const subtitle = parts.slice(1).join("\n\n").trim();

  return (
    <>
      <h2 className={styles.messageTitle}>{title}</h2>
      {subtitle && <p className={styles.messageSubtitle}>{subtitle}</p>}
    </>
  );
}

// 전문가 매칭 로딩
function ExpertMatching() {
  return (
    <div className={styles.expertMatching}>
      <div className={styles.skeletonSlider}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className={styles.skeletonCard}>
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonText} />
            <div className={styles.skeletonTextShort} />
          </div>
        ))}
      </div>
    </div>
  );
}

// 전문가 카드 (가로형)
function ExpertCardHorizontal() {
  return (
    <div className={styles.expertCardHorizontal}>
      <div className={styles.expertAvatarSmall}>
        <span className={styles.expertAvatarPlaceholder}>Pro</span>
      </div>
      <div className={styles.expertInfoHorizontal}>
        <span className={styles.expertNameSmall}>손프로</span>
        <span className={styles.expertRoleSmall}>은퇴설계 전문</span>
      </div>
    </div>
  );
}
