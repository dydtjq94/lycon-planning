import React from "react";
import styles from "./PreConsultNav.module.css";

/**
 * 사전 상담 좌측 네비게이션
 * 5단계 진행 상황을 표시하고 단계 이동을 제공합니다.
 */
function PreConsultNav({ currentStep, onStepChange, progress }) {
  const steps = [
    {
      number: 1,
      title: "환영",
      subtitle: "Ice Breaking",
      key: "step1_iceBreaking",
    },
    {
      number: 2,
      title: "목표 점검",
      subtitle: "은퇴 목표 & 투자성향",
      key: "step2_goals",
    },
    {
      number: 3,
      title: "3층 연금",
      subtitle: "국민·퇴직·개인연금",
      key: "step3_pension",
    },
    {
      number: 4,
      title: "재무정보",
      subtitle: "소득·지출·자산·부채",
      key: "step4_financial",
    },
    {
      number: 5,
      title: "시뮬레이션 미리보기",
      subtitle: "본 상담 프로세스 소개",
      key: "step5_preview",
    },
  ];

  // 각 단계의 완료 여부 확인
  const isStepCompleted = (stepKey) => {
    return progress[stepKey]?.completed || false;
  };

  // 전체 진행률 계산
  const calculateProgress = () => {
    const completedSteps = steps.filter((step) => isStepCompleted(step.key))
      .length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  return (
    <nav className={styles.nav}>
      {/* 전체 진행률 */}
      <div className={styles.progressSection}>
        <h3 className={styles.progressTitle}>전체 진행률</h3>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>
        <p className={styles.progressText}>{calculateProgress()}% 완료</p>
      </div>

      {/* 단계 목록 */}
      <div className={styles.stepList}>
        {steps.map((step) => {
          const isActive = currentStep === step.number;
          const isCompleted = isStepCompleted(step.key);

          return (
            <button
              key={step.number}
              className={`${styles.stepItem} ${
                isActive ? styles.stepItemActive : ""
              } ${isCompleted ? styles.stepItemCompleted : ""}`}
              onClick={() => onStepChange(step.number)}
            >
              <div className={styles.stepNumber}>
                {isCompleted ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <div className={styles.stepContent}>
                <div className={styles.stepTitle}>{step.title}</div>
                <div className={styles.stepSubtitle}>{step.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 도움말 */}
      <div className={styles.helpSection}>
        <p className={styles.helpText}>
          💡 각 단계는 순서대로 진행하지 않아도 괜찮습니다. 언제든지 이전
          단계로 돌아가서 수정할 수 있습니다.
        </p>
      </div>
    </nav>
  );
}

export default PreConsultNav;

