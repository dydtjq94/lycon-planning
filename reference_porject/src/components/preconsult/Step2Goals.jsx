import React from "react";
import { calculateKoreanAge } from "../../utils/koreanAge";
import styles from "./Step.module.css";

/**
 * 2단계: 은퇴 목표 및 투자성향
 * 라이프스타일, 은퇴 시점, 투자성향 파악
 */
function Step2Goals({ data, onChange, profileData }) {
  const currentYear = new Date().getFullYear();
  const currentAge = calculateKoreanAge(profileData.birthYear);

  const handleChange = (field, value) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleComplete = () => {
    onChange({
      ...data,
      completed: !data.completed,
    });
  };

  // 라이프스타일 옵션
  const lifestyleOptions = [
    {
      value: "comfortable",
      label: "여유있는 삶",
      amount: 500,
      description: "여행, 취미, 문화생활을 자유롭게 즐기는 삶",
    },
    {
      value: "normal",
      label: "평범한 삶",
      amount: 300,
      description: "적당한 여가와 안정적인 생활을 유지하는 삶",
    },
    {
      value: "basic",
      label: "기본적인 삶",
      amount: 200,
      description: "필수 생활비를 충당하며 검소하게 사는 삶",
    },
  ];

  // 투자성향 옵션
  const investmentTypes = [
    {
      value: "conservative",
      label: "안정형",
      description: "원금 보존 최우선",
    },
    {
      value: "moderatelyConservative",
      label: "안정추구형",
      description: "낮은 수익, 낮은 위험",
    },
    {
      value: "moderate",
      label: "위험중립형",
      description: "중간 수익, 중간 위험",
    },
    {
      value: "moderatelyAggressive",
      label: "적극투자형",
      description: "높은 수익, 높은 위험 감수",
    },
    {
      value: "aggressive",
      label: "공격투자형",
      description: "최대 수익 추구",
    },
  ];

  return (
    <div className={styles.step}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>🎯 은퇴 목표와 라이프스타일</h2>
        <p className={styles.stepDescription}>
          은퇴 후 어떤 삶을 살고 싶으신지 함께 그려보겠습니다.
        </p>
      </div>

      <div className={styles.stepContent}>
        {/* 라이프스타일 선택 */}
        <div className={styles.section}>
          <label className={styles.label}>
            💭 은퇴 후 추구하는 라이프스타일
          </label>
          <div className={styles.radioGroup}>
            {lifestyleOptions.map((option) => (
              <label
                key={option.value}
                className={`${styles.radioCard} ${
                  data.lifestyle === option.value ? styles.radioCardSelected : ""
                }`}
              >
                <input
                  type="radio"
                  name="lifestyle"
                  value={option.value}
                  checked={data.lifestyle === option.value}
                  onChange={(e) => {
                    handleChange("lifestyle", e.target.value);
                    handleChange("targetMonthlyIncome", option.amount);
                  }}
                  className={styles.radioInput}
                />
                <div className={styles.radioContent}>
                  <div className={styles.radioTitle}>{option.label}</div>
                  <div className={styles.radioAmount}>
                    월 {option.amount}만원~
                  </div>
                  <div className={styles.radioDescription}>
                    {option.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 목표 월 소득 (직접 입력) */}
        {data.lifestyle && (
          <div className={styles.section}>
            <label className={styles.label}>
              목표 월 소득 (선택사항, 직접 입력)
            </label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={data.targetMonthlyIncome || ""}
                onChange={(e) =>
                  handleChange("targetMonthlyIncome", parseInt(e.target.value))
                }
                placeholder="300"
              />
              <span className={styles.inputSuffix}>만원</span>
            </div>
          </div>
        )}

        {/* 구분선 */}
        <div className={styles.divider} />

        {/* 은퇴 시점 */}
        <div className={styles.section}>
          <label className={styles.label}>👤 본인 은퇴 시점</label>
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>은퇴 나이</label>
              <input
                type="number"
                className={styles.input}
                value={data.retirementAge || profileData.retirementAge || ""}
                onChange={(e) =>
                  handleChange("retirementAge", parseInt(e.target.value))
                }
                placeholder="65"
              />
              <span className={styles.inputSuffix}>세</span>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>은퇴 연도</label>
              <input
                type="number"
                className={styles.input}
                value={
                  data.retirementAge
                    ? currentYear + (data.retirementAge - currentAge)
                    : ""
                }
                readOnly
                placeholder="자동 계산"
              />
              <span className={styles.inputSuffix}>년</span>
            </div>
          </div>
        </div>

        {/* 배우자 은퇴 시점 */}
        {profileData.hasSpouse && (
          <div className={styles.section}>
            <label className={styles.label}>👫 배우자 은퇴 시점</label>
            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>은퇴 나이</label>
                <input
                  type="number"
                  className={styles.input}
                  value={
                    data.spouseRetirementAge ||
                    profileData.spouseRetirementAge ||
                    ""
                  }
                  onChange={(e) =>
                    handleChange("spouseRetirementAge", parseInt(e.target.value))
                  }
                  placeholder="60"
                />
                <span className={styles.inputSuffix}>세</span>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>은퇴 연도</label>
                <input
                  type="number"
                  className={styles.input}
                  value={
                    data.spouseRetirementAge
                      ? currentYear +
                        (data.spouseRetirementAge -
                          calculateKoreanAge(profileData.spouseBirthYear))
                      : ""
                  }
                  readOnly
                  placeholder="자동 계산"
                />
                <span className={styles.inputSuffix}>년</span>
              </div>
            </div>
          </div>
        )}

        {/* 구분선 */}
        <div className={styles.divider} />

        {/* 투자 성향 */}
        <div className={styles.section}>
          <label className={styles.label}>📊 투자 성향</label>
          <div className={styles.radioGroupVertical}>
            {investmentTypes.map((type) => (
              <label
                key={type.value}
                className={`${styles.radioOption} ${
                  data.investmentType === type.value
                    ? styles.radioOptionSelected
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="investmentType"
                  value={type.value}
                  checked={data.investmentType === type.value}
                  onChange={(e) => handleChange("investmentType", e.target.value)}
                  className={styles.radioInput}
                />
                <div className={styles.radioLabel}>
                  <span className={styles.radioLabelText}>{type.label}</span>
                  <span className={styles.radioLabelDesc}>
                    {type.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 상담 메모 */}
        <div className={styles.section}>
          <label className={styles.label}>📝 상담 메모</label>
          <textarea
            className={styles.textarea}
            value={data.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="목표 설정 관련 추가 메모..."
            rows={4}
          />
        </div>

        {/* 완료 체크 */}
        <div className={styles.completeSection}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={data.completed || false}
              onChange={handleComplete}
              className={styles.checkbox}
            />
            <span>이 단계를 완료했습니다</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default Step2Goals;

