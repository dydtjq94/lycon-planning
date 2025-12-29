import React from "react";
import styles from "./Step.module.css";

/**
 * 1단계: Ice Breaking
 * 상담 환영 및 은퇴준비 계기 파악
 */
function Step1IceBreaking({ data, onChange, profileData }) {
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

  return (
    <div className={styles.step}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>🎉 상담에 오신 것을 환영합니다</h2>
        <p className={styles.stepDescription}>
          {profileData.name}님과 함께 은퇴 준비를 시작하겠습니다.
        </p>
      </div>

      <div className={styles.stepContent}>
        {/* 환영 메시지 */}
        <div className={styles.welcomeSection}>
          <div className={styles.welcomeCard}>
            <h3 className={styles.cardTitle}>은퇴 재무설계란?</h3>
            <p className={styles.cardText}>
              은퇴 후 안정적이고 행복한 삶을 위해 현재의 재무 상황을 분석하고,
              목표를 설정하며, 구체적인 실행 계획을 세우는 과정입니다.
            </p>
          </div>

          <div className={styles.welcomeCard}>
            <h3 className={styles.cardTitle}>오늘의 상담 목표</h3>
            <ul className={styles.cardList}>
              <li>은퇴 후 원하시는 라이프스타일 파악</li>
              <li>현재 재무 상황 점검</li>
              <li>3층 연금 구조 이해</li>
              <li>시뮬레이션을 통한 미래 예측</li>
            </ul>
          </div>

          <div className={styles.welcomeCard}>
            <h3 className={styles.cardTitle}>시뮬레이션 기반 설계의 장점</h3>
            <ul className={styles.cardList}>
              <li>📊 현재 계획으로 목표 달성 가능 여부 확인</li>
              <li>💰 필요한 자산 규모 정확히 파악</li>
              <li>🎯 다양한 시나리오 비교 분석</li>
              <li>📈 실행 계획의 효과 즉시 확인</li>
            </ul>
          </div>
        </div>

        {/* 은퇴준비 계기 */}
        <div className={styles.section}>
          <label className={styles.label}>
            ▶ 은퇴준비를 생각하게 된 계기가 있으신가요?
          </label>
          <textarea
            className={styles.textarea}
            value={data.motivation || ""}
            onChange={(e) => handleChange("motivation", e.target.value)}
            placeholder="예: 자녀가 독립하면서 노후에 대한 불안감이 생겼습니다..."
            rows={4}
          />
        </div>

        {/* 상담 메모 */}
        <div className={styles.section}>
          <label className={styles.label}>📝 상담 메모</label>
          <textarea
            className={styles.textarea}
            value={data.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="상담 중 특이사항이나 추가 메모를 작성하세요..."
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

export default Step1IceBreaking;

