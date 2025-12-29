import React from "react";
import styles from "./Step.module.css";

/**
 * 5단계: 시뮬레이션 미리보기
 * 본 상담 프로세스 소개 및 샘플 케이스 시연
 */
function Step5Preview({ data, onChange, profileData }) {
  const handleNotesChange = (value) => {
    onChange({
      ...data,
      notes: value,
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
        <h2 className={styles.stepTitle}>👀 시뮬레이션 미리보기</h2>
        <p className={styles.stepDescription}>
          본 상담에서 어떻게 진행되는지 미리 확인해보겠습니다.
        </p>
      </div>

      <div className={styles.stepContent}>
        {/* 본 상담 소개 */}
        <div className={styles.infoBox}>
          <h3 className={styles.infoTitle}>💡 본 상담에서는 이렇게 진행됩니다</h3>
          <p className={styles.infoText}>
            지금까지 입력하신 재무 데이터를 바탕으로 은퇴 시뮬레이션을
            진행합니다. 다양한 시나리오를 만들어 비교 분석할 수 있습니다.
          </p>
        </div>

        {/* 시뮬레이션으로 알 수 있는 것들 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            💭 시뮬레이션으로 알 수 있는 것들
          </h3>
          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>✓</div>
              <div className={styles.featureContent}>
                <div className={styles.featureTitle}>
                  현재 계획으로 은퇴 목표 달성 가능한가?
                </div>
                <div className={styles.featureDesc}>
                  목표 자산과 실제 시뮬레이션 결과를 비교합니다
                </div>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>✓</div>
              <div className={styles.featureContent}>
                <div className={styles.featureTitle}>
                  언제까지 자산이 유지되는가?
                </div>
                <div className={styles.featureDesc}>
                  자산 소진 시점을 미리 파악하고 대비할 수 있습니다
                </div>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>✓</div>
              <div className={styles.featureContent}>
                <div className={styles.featureTitle}>
                  어떤 변화가 어떤 결과를 만드는가?
                </div>
                <div className={styles.featureDesc}>
                  다양한 시나리오를 비교하여 최적의 전략을 찾습니다
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 시나리오 예시 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>📊 비교 가능한 시나리오 예시</h3>
          <div className={styles.scenarioList}>
            <div className={styles.scenarioCard}>
              <div className={styles.scenarioTitle}>💸 지출 줄이기</div>
              <div className={styles.scenarioDesc}>
                월 지출을 10%, 20% 줄였을 때의 결과
              </div>
            </div>

            <div className={styles.scenarioCard}>
              <div className={styles.scenarioTitle}>⏰ 은퇴 시기 조정</div>
              <div className={styles.scenarioDesc}>
                은퇴 나이를 2년, 5년 늦췄을 때의 변화
              </div>
            </div>

            <div className={styles.scenarioCard}>
              <div className={styles.scenarioTitle}>📈 투자 수익률 변화</div>
              <div className={styles.scenarioDesc}>
                수익률 3%, 5%, 7%에 따른 차이
              </div>
            </div>

            <div className={styles.scenarioCard}>
              <div className={styles.scenarioTitle}>🏠 부동산 처분 시기</div>
              <div className={styles.scenarioDesc}>
                주택 매각 시점에 따른 현금흐름 변화
              </div>
            </div>

            <div className={styles.scenarioCard}>
              <div className={styles.scenarioTitle}>💰 추가 저축/투자</div>
              <div className={styles.scenarioDesc}>
                매월 추가 저축 시 자산 증가 효과
              </div>
            </div>

            <div className={styles.scenarioCard}>
              <div className={styles.scenarioTitle}>🎯 복합 시나리오</div>
              <div className={styles.scenarioDesc}>
                여러 변수를 동시에 조정한 종합 플랜
              </div>
            </div>
          </div>
        </div>

        {/* 다음 단계 안내 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>🎯 다음 단계</h3>
          <div className={styles.nextStepBox}>
            <div className={styles.nextStepItem}>
              <div className={styles.nextStepNumber}>1️⃣</div>
              <div className={styles.nextStepText}>
                오늘 작성한 내용을 검토하고 추가 자료를 준비해주세요
              </div>
            </div>
            <div className={styles.nextStepItem}>
              <div className={styles.nextStepNumber}>2️⃣</div>
              <div className={styles.nextStepText}>
                국민연금 예상액, 퇴직연금 잔액, 상세 지출 내역 등을 확인해주세요
              </div>
            </div>
            <div className={styles.nextStepItem}>
              <div className={styles.nextStepNumber}>3️⃣</div>
              <div className={styles.nextStepText}>
                본 상담 일정을 조율하여 시뮬레이션을 함께 진행합니다
              </div>
            </div>
          </div>
        </div>

        {/* 상담 메모 */}
        <div className={styles.section}>
          <label className={styles.label}>📝 상담 메모</label>
          <textarea
            className={styles.textarea}
            value={data.notes || ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="다음 상담 준비사항, 질문사항 등을 메모하세요..."
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
            <span>사전 상담을 완료했습니다</span>
          </label>
        </div>

        {/* 완료 메시지 */}
        {data.completed && (
          <div className={styles.completionBox}>
            <h3 className={styles.completionTitle}>
              🎉 사전 상담이 완료되었습니다!
            </h3>
            <p className={styles.completionText}>
              아래 "본 상담 시작" 버튼을 클릭하여 대시보드로 이동한 후
              시뮬레이션을 시작하세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Step5Preview;

