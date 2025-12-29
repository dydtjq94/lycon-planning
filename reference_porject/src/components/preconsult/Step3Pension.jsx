import React from "react";
import { formatAmount } from "../../utils/format";
import styles from "./Step.module.css";

/**
 * 3단계: 3층 연금 구조
 * 국민연금, 퇴직연금, 개인연금 파악
 */
function Step3Pension({ data, onChange, profileData }) {
  const handleChange = (category, field, value) => {
    onChange({
      ...data,
      [category]: {
        ...data[category],
        [field]: value,
      },
    });
  };

  const handleNestedChange = (category, subCategory, field, value) => {
    onChange({
      ...data,
      [category]: {
        ...data[category],
        [subCategory]: {
          ...data[category][subCategory],
          [field]: value,
        },
      },
    });
  };

  const handleComplete = () => {
    onChange({
      ...data,
      completed: !data.completed,
    });
  };

  const handleNotesChange = (value) => {
    onChange({
      ...data,
      notes: value,
    });
  };

  return (
    <div className={styles.step}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>🏛️ 3층 연금 구조 파악</h2>
        <p className={styles.stepDescription}>
          은퇴 후 안정적인 현금흐름의 핵심인 3층 연금을 확인합니다.
        </p>
      </div>

      <div className={styles.stepContent}>
        {/* 3층 연금 설명 */}
        <div className={styles.infoBox}>
          <h3 className={styles.infoTitle}>💡 3층 연금이란?</h3>
          <p className={styles.infoText}>
            은퇴 후 받게 되는 연금은 크게 3가지로 구성됩니다. 이 구조를
            이해하고 각각의 금액을 파악하는 것이 은퇴설계의 첫 단계입니다.
          </p>
        </div>

        {/* 1층: 국민연금 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>1️⃣ 국민연금 (공적연금)</h3>
            <a
              href="https://www.nps.or.kr/jsppage/cyber_pr/easy/easy_04_01.jsp"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.externalLink}
            >
              📎 내연금 확인하기 →
            </a>
          </div>
          
          <div className={styles.subsection}>
            <label className={styles.label}>👤 본인 국민연금</label>
            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>예상 수령액</label>
                <input
                  type="number"
                  className={styles.input}
                  value={data.nationalPension?.self?.amount || ""}
                  onChange={(e) =>
                    handleNestedChange(
                      "nationalPension",
                      "self",
                      "amount",
                      parseInt(e.target.value)
                    )
                  }
                  placeholder="150"
                />
                <span className={styles.inputSuffix}>만원/월</span>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>수령 시작 나이</label>
                <input
                  type="number"
                  className={styles.input}
                  value={data.nationalPension?.self?.startAge || ""}
                  onChange={(e) =>
                    handleNestedChange(
                      "nationalPension",
                      "self",
                      "startAge",
                      parseInt(e.target.value)
                    )
                  }
                  placeholder="65"
                />
                <span className={styles.inputSuffix}>세</span>
              </div>
            </div>
          </div>

          {profileData.hasSpouse && (
            <div className={styles.subsection}>
              <label className={styles.label}>👫 배우자 국민연금</label>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>예상 수령액</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={data.nationalPension?.spouse?.amount || ""}
                    onChange={(e) =>
                      handleNestedChange(
                        "nationalPension",
                        "spouse",
                        "amount",
                        parseInt(e.target.value)
                      )
                    }
                    placeholder="100"
                  />
                  <span className={styles.inputSuffix}>만원/월</span>
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>수령 시작 나이</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={data.nationalPension?.spouse?.startAge || ""}
                    onChange={(e) =>
                      handleNestedChange(
                        "nationalPension",
                        "spouse",
                        "startAge",
                        parseInt(e.target.value)
                      )
                    }
                    placeholder="65"
                  />
                  <span className={styles.inputSuffix}>세</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2층: 퇴직연금 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>2️⃣ 퇴직연금 (기업연금)</h3>
            <a
              href="https://www.crew.or.kr"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.externalLink}
            >
              📎 내퇴직연금 확인하기 →
            </a>
          </div>

          <div className={styles.infoBox}>
            <p className={styles.infoTextSmall}>
              퇴직금, DC(확정기여형), IRP(개인형퇴직연금) 등을 포함합니다.
            </p>
          </div>

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>현재 퇴직연금 잔액</label>
              <input
                type="number"
                className={styles.input}
                value={data.retirement?.current || ""}
                onChange={(e) =>
                  handleChange("retirement", "current", parseInt(e.target.value))
                }
                placeholder="5000"
              />
              <span className={styles.inputSuffix}>만원</span>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>연 적립액 (추가 납입)</label>
              <input
                type="number"
                className={styles.input}
                value={data.retirement?.annualContribution || ""}
                onChange={(e) =>
                  handleChange(
                    "retirement",
                    "annualContribution",
                    parseInt(e.target.value)
                  )
                }
                placeholder="600"
              />
              <span className={styles.inputSuffix}>만원/연</span>
            </div>
          </div>
        </div>

        {/* 3층: 개인연금 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>3️⃣ 개인연금 (사적연금)</h3>
          
          <div className={styles.subsection}>
            <label className={styles.label}>가입 여부</label>
            <div className={styles.radioGroupHorizontal}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="hasPrivatePension"
                  checked={data.private?.hasPrivatePension === true}
                  onChange={() =>
                    handleChange("private", "hasPrivatePension", true)
                  }
                  className={styles.radioInput}
                />
                <span>예</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="hasPrivatePension"
                  checked={data.private?.hasPrivatePension === false}
                  onChange={() =>
                    handleChange("private", "hasPrivatePension", false)
                  }
                  className={styles.radioInput}
                />
                <span>아니오</span>
              </label>
            </div>
          </div>

          {data.private?.hasPrivatePension && (
            <>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>
                    연금보험/연금저축 합계
                  </label>
                  <input
                    type="number"
                    className={styles.input}
                    value={data.private?.totalAmount || ""}
                    onChange={(e) =>
                      handleChange(
                        "private",
                        "totalAmount",
                        parseInt(e.target.value)
                      )
                    }
                    placeholder="2000"
                  />
                  <span className={styles.inputSuffix}>만원</span>
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>월 납입액</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={data.private?.monthlyPayment || ""}
                    onChange={(e) =>
                      handleChange(
                        "private",
                        "monthlyPayment",
                        parseInt(e.target.value)
                      )
                    }
                    placeholder="30"
                  />
                  <span className={styles.inputSuffix}>만원/월</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 3층 연금 요약 */}
        {(data.nationalPension?.self?.amount ||
          data.nationalPension?.spouse?.amount) && (
          <div className={styles.summaryBox}>
            <h3 className={styles.summaryTitle}>💬 3층 연금 요약</h3>
            <div className={styles.summaryContent}>
              <p className={styles.summaryText}>
                총 예상 국민연금 수령액:{" "}
                <strong>
                  월{" "}
                  {formatAmount(
                    (data.nationalPension?.self?.amount || 0) +
                      (data.nationalPension?.spouse?.amount || 0)
                  )}
                </strong>
              </p>
              <p className={styles.summaryTextSmall}>
                (시뮬레이션에 자동 반영됩니다)
              </p>
            </div>
          </div>
        )}

        {/* 상담 메모 */}
        <div className={styles.section}>
          <label className={styles.label}>📝 상담 메모</label>
          <textarea
            className={styles.textarea}
            value={data.notes || ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="연금 관련 추가 메모..."
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

export default Step3Pension;

