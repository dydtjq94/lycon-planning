import React, { useState, useEffect } from "react";
import styles from "./DebtModal.module.css";
import { formatAmountForChart } from "../../utils/format";
import { calculateKoreanAge } from "../../utils/koreanAge";
import { debtService } from "../../services/firestoreService";

/**
 * 부채 데이터 추가/수정 모달
 */
function DebtModal({
  isOpen,
  onClose,
  onSave,
  editData = null,
  initialData = null, // 복사된 데이터 (복사해서 추가용)
  profileData = null,
  simulations = [],
  activeSimulationId = null,
  profileId = null,
  defaultDebtInterestRate = "3.5", // 전역 설정에서 전달된 부채 이자율 기본값
}) {
  // 은퇴년도 계산 함수 (문자열 결합 방지 및 현재 연도 기준)
  const getRetirementYear = () => {
    const currentYear = new Date().getFullYear();
    if (profileData && profileData.birthYear && profileData.retirementAge) {
      const birth = parseInt(profileData.birthYear, 10);
      const retireAge = parseInt(profileData.retirementAge, 10);
      if (Number.isFinite(birth) && Number.isFinite(retireAge)) {
        const currentAge = calculateKoreanAge(birth, currentYear);
        const yearsToRetire = retireAge - currentAge;
        return (
          currentYear + (Number.isFinite(yearsToRetire) ? yearsToRetire : 0)
        );
      }
    }
    return currentYear + 5; // 기본값
  };

  const [formData, setFormData] = useState({
    title: "",
    debtType: "bullet", // bullet: 만기일시상환, equal: 원리금균등상환, principal: 원금균등상환, grace: 거치식상환
    debtAmount: "",
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1, // 현재 월
    endYear: getRetirementYear(),
    endMonth: 12,
    interestRate: defaultDebtInterestRate, // 전역 설정에서 가져온 부채 이자율
    gracePeriod: 5, // 거치기간 (년) - 기본값 5년
    memo: "",
    addCashToFlow: false,
  });

  const [errors, setErrors] = useState({});
  const [selectedSimulationIds, setSelectedSimulationIds] = useState([]);
  // 각 시뮬레이션이 수정인지 추가인지 상태 저장: { simId: 'update' | 'create' }
  const [simulationStatusMap, setSimulationStatusMap] = useState({});
  const [isSimSelectionLoading, setIsSimSelectionLoading] = useState(false);

  // 수정 모드일 때 각 시뮬레이션에 해당 ID가 존재하는지 확인
  useEffect(() => {
    // 모달이 닫혀있으면 아무것도 안함
    if (!isOpen) {
      return;
    }

    // 모달이 열리면 즉시 이전 상태 초기화 및 로딩 시작
    setIsSimSelectionLoading(true);
    setSimulationStatusMap({});
    setSelectedSimulationIds([]);

    let cancelled = false;

    const checkSimulationStatus = async () => {
      const startTime = Date.now();

      if (editData && editData.id && profileId && simulations.length > 0) {
        try {
          // 모든 시뮬레이션에서 해당 ID가 존재하는지 확인
          const checkPromises = simulations.map(async (sim) => {
            try {
              const debts = await debtService.getDebts(profileId, sim.id);
              // 같은 ID의 항목이 있는지 확인
              const hasSameId = debts.some((debt) => debt.id === editData.id);
              return { simId: sim.id, status: hasSameId ? "update" : "create" };
            } catch (error) {
              return { simId: sim.id, status: "create" }; // 오류 시 추가로 처리
            }
          });
          const results = await Promise.all(checkPromises);

          // 작업이 취소되었으면 상태 업데이트 안함
          if (cancelled) return;

          // 상태 맵 생성
          const statusMap = {};
          results.forEach(({ simId, status }) => {
            statusMap[simId] = status;
          });
          setSimulationStatusMap(statusMap);

          // 현재 활성 시뮬레이션을 기본 선택
          const defaultSelected = activeSimulationId
            ? [activeSimulationId]
            : [];
          setSelectedSimulationIds(defaultSelected);

          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, 1000 - elapsedTime);
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        } catch (error) {
          console.error("시뮬레이션 상태 확인 오류:", error);

          if (cancelled) return;

          // 오류 시 모든 시뮬레이션을 추가 상태로 설정
          const statusMap = {};
          simulations.forEach((sim) => {
            statusMap[sim.id] = "create";
          });
          setSimulationStatusMap(statusMap);
          setSelectedSimulationIds(
            activeSimulationId ? [activeSimulationId] : []
          );
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, 1000 - elapsedTime);
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        } finally {
          if (!cancelled) {
            setIsSimSelectionLoading(false);
          }
        }
      } else {
        // 추가 모드일 때는 모든 시뮬레이션을 추가 상태로
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 1000 - elapsedTime);
        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (cancelled) return;

        const statusMap = {};
        simulations.forEach((sim) => {
          statusMap[sim.id] = "create";
        });
        setSimulationStatusMap(statusMap);
        const defaultSelected = activeSimulationId ? [activeSimulationId] : [];
        setSelectedSimulationIds(defaultSelected);
        setIsSimSelectionLoading(false);
      }
    };

    checkSimulationStatus();

    // cleanup 함수: 다음 useEffect 실행 전이나 컴포넌트 언마운트 시 호출
    return () => {
      cancelled = true;
    };
  }, [isOpen, editData?.id, profileId, simulations, activeSimulationId]);

  // 수정 모드일 때 데이터 로드, 모달이 열릴 때마다 초기화
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        // 수정 모드: 기존 데이터 로드
        // gracePeriod는 명확하게 number로 변환 (0도 유효한 값이므로 || 0 대신 삼항연산자 사용)
        const parsedGracePeriod =
          editData.gracePeriod !== undefined && editData.gracePeriod !== null
            ? parseInt(editData.gracePeriod, 10)
            : 0;

        setFormData({
          title: editData.title || "",
          debtType: editData.debtType || "bullet",
          debtAmount: editData.debtAmount || "",
          startYear:
            parseInt(editData.startYear, 10) || new Date().getFullYear(),
          startMonth: parseInt(editData.startMonth, 10) || 1,
          endYear: parseInt(editData.endYear, 10) || getRetirementYear(),
          endMonth: parseInt(editData.endMonth, 10) || 12,
          interestRate:
            editData.interestRate !== undefined &&
            editData.interestRate !== null
              ? (editData.interestRate * 100).toFixed(2)
              : "3.5",
          gracePeriod: parsedGracePeriod,
          memo: editData.memo || "",
          addCashToFlow: !!editData.addCashToFlow,
        });
      } else if (initialData) {
        // 복사 모드: 복사된 데이터로 초기화 (id 제외)
        const parsedGracePeriod =
          initialData.gracePeriod !== undefined &&
          initialData.gracePeriod !== null
            ? parseInt(initialData.gracePeriod, 10)
            : 5;

        setFormData({
          title: initialData.title || "",
          debtType: initialData.debtType || "bullet",
          debtAmount: initialData.debtAmount || "",
          startYear:
            parseInt(initialData.startYear, 10) || new Date().getFullYear(),
          startMonth: parseInt(initialData.startMonth, 10) || 1,
          endYear: parseInt(initialData.endYear, 10) || getRetirementYear(),
          endMonth: parseInt(initialData.endMonth, 10) || 12,
          interestRate:
            initialData.interestRate !== undefined &&
            initialData.interestRate !== null
              ? (initialData.interestRate * 100).toFixed(2)
              : "3.5",
          gracePeriod: parsedGracePeriod,
          memo: initialData.memo || "",
          addCashToFlow: !!initialData.addCashToFlow,
        });
      } else {
        // 새 데이터일 때 초기화
        setFormData({
          title: "",
          debtType: "bullet",
          debtAmount: "",
          startYear: new Date().getFullYear(),
          startMonth: new Date().getMonth() + 1, // 현재 월
          endYear: getRetirementYear(),
          endMonth: 12,
          interestRate: defaultDebtInterestRate,
          gracePeriod: 5, // 거치식 상환의 기본값을 5년으로 설정
          memo: "",
          addCashToFlow: false,
        });
      }
    }
  }, [isOpen, editData, initialData, defaultDebtInterestRate]);

  // ESC 키로 모달 닫기 + body 스크롤 막기
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        e.stopImmediatePropagation(); // 다른 ESC 핸들러 실행 방지
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // 모달이 열릴 때 body 스크롤 막기
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      // 모달이 닫힐 때 body 스크롤 복원
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // 폼 유효성 검사
  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "부채 항목명을 입력해주세요.";
    }

    if (!formData.debtAmount || formData.debtAmount < 0) {
      newErrors.debtAmount = "대출 금액을 입력해주세요.";
    }

    if (formData.startYear > formData.endYear) {
      newErrors.endYear = "종료년도는 시작년도보다 늦어야 합니다.";
    }
    if (
      formData.startYear &&
      formData.endYear &&
      parseInt(formData.startYear, 10) === parseInt(formData.endYear, 10) &&
      formData.startMonth > formData.endMonth
    ) {
      newErrors.endYear =
        "같은 해라면 종료 월이 시작 월보다 크거나 같아야 합니다.";
    }

    const interestRateNum = parseFloat(formData.interestRate);
    if (
      isNaN(interestRateNum) ||
      interestRateNum < 0 ||
      interestRateNum > 100
    ) {
      newErrors.interestRate = "이자율은 0-100% 사이의 유효한 숫자여야 합니다.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 숫자와 마이너스 기호 입력 허용
  const handleKeyPress = (e) => {
    if (
      !/[0-9.-]/.test(e.key) &&
      !["Backspace", "Delete", "Tab", "Enter"].includes(e.key)
    ) {
      e.preventDefault();
    }
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const debtData = {
      ...formData,
      debtAmount: parseInt(formData.debtAmount, 10),
      startYear: parseInt(formData.startYear, 10),
      startMonth: parseInt(formData.startMonth, 10) || 1,
      endYear: parseInt(formData.endYear, 10),
      endMonth: parseInt(formData.endMonth, 10) || 12,
      interestRate: parseFloat(formData.interestRate) / 100, // 백분율을 소수로 변환
      gracePeriod: parseInt(formData.gracePeriod, 10), // 10진수로 명확하게 변환
      addCashToFlow: !!formData.addCashToFlow,
      selectedSimulationIds:
        selectedSimulationIds && selectedSimulationIds.length > 0
          ? selectedSimulationIds
          : activeSimulationId
          ? [activeSimulationId]
          : [],
    };

    // 수정 모드일 때는 id를 포함시켜야 함
    if (editData && editData.id) {
      debtData.id = editData.id;
    }

    await onSave(debtData);
    // 모달 닫기는 외부에서 처리 (SimulationCompareModal에서 onClose를 호출)
    if (!editData) {
      handleClose(); // 추가 모드일 때만 닫기
    }
  };

  // 모달 닫기 핸들러
  const handleClose = () => {
    setFormData({
      title: "",
      debtType: "bullet",
      debtAmount: "",
      startYear: new Date().getFullYear(),
      startMonth: new Date().getMonth() + 1, // 현재 월
      endYear: new Date().getFullYear() + 5,
      endMonth: 12,
      interestRate: defaultDebtInterestRate,
      gracePeriod: 5,
      memo: "",
      addCashToFlow: false,
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {editData ? "부채 수정" : "부채 추가"}
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>

        <form id="debtForm" onSubmit={handleSubmit} className={styles.form}>
          {/* 상환 방식 */}
          <div className={styles.field}>
            <label className={styles.label}>상환 방식 *</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="debtType"
                  value="bullet"
                  checked={formData.debtType === "bullet"}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      debtType: e.target.value,
                    });
                  }}
                />
                <span className={styles.radioText}>만기일시상환</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="debtType"
                  value="equal"
                  checked={formData.debtType === "equal"}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      debtType: e.target.value,
                    });
                  }}
                />
                <span className={styles.radioText}>원리금균등상환</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="debtType"
                  value="principal"
                  checked={formData.debtType === "principal"}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      debtType: e.target.value,
                    });
                  }}
                />
                <span className={styles.radioText}>원금균등상환</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="debtType"
                  value="grace"
                  checked={formData.debtType === "grace"}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      debtType: e.target.value,
                      gracePeriod: 5, // 거치식 상환 선택 시 기본 거치기간 5년
                    });
                  }}
                />
                <span className={styles.radioText}>거치식상환</span>
              </label>
            </div>
            <div className={styles.helpText}>
              {formData.debtType === "bullet" ? (
                <span>매달 이자만 납부하고 만기일에 원금을 한꺼번에 상환</span>
              ) : formData.debtType === "equal" ? (
                <span>매달 원금과 이자를 합친 동일한 금액을 상환</span>
              ) : formData.debtType === "principal" ? (
                <span>
                  매달 같은 금액의 원금을 상환하며, 남은 원금에 대한 이자가 점점
                  줄어듦
                </span>
              ) : (
                <span>일정 기간 동안 이자만 내다가, 이후 본격 상환 시작</span>
              )}
            </div>
          </div>

          {/* 부채 항목명 */}
          <div className={styles.field}>
            <label htmlFor="title" className={styles.label}>
              항목명 *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className={`${styles.input} ${errors.title ? styles.error : ""}`}
              placeholder="예: 주택담보대출, 자동차 할부, 신용대출"
            />
            {errors.title && (
              <span className={styles.errorText}>{errors.title}</span>
            )}
          </div>

          {/* 대출 금액과 이자율 */}
          <div className={styles.row}>
            <div className={styles.field}>
              <div className={styles.endYearWrapper}>
                <label htmlFor="debtAmount" className={styles.label}>
                  금액 (만원) *
                </label>
                <label className={styles.fixedCheckboxLabel}>
                  <input
                    id="addCashToFlow"
                    type="checkbox"
                    checked={formData.addCashToFlow}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        addCashToFlow: e.target.checked,
                      })
                    }
                    className={styles.fixedCheckbox}
                  />
                  <span className={styles.fixedCheckboxText}>
                    현금유입으로 처리
                  </span>
                </label>
              </div>
              <input
                type="text"
                id="debtAmount"
                value={formData.debtAmount}
                onChange={(e) =>
                  setFormData({ ...formData, debtAmount: e.target.value })
                }
                onKeyPress={handleKeyPress}
                className={`${styles.input} ${
                  errors.debtAmount ? styles.error : ""
                }`}
                placeholder="예: 30000"
              />
              {formData.debtAmount && !isNaN(parseInt(formData.debtAmount)) && (
                <div className={styles.amountPreview}>
                  {formatAmountForChart(parseInt(formData.debtAmount))}
                </div>
              )}
              {errors.debtAmount && (
                <span className={styles.errorText}>{errors.debtAmount}</span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="interestRate" className={styles.label}>
                이자율 (%)
              </label>
              <input
                type="text"
                id="interestRate"
                value={formData.interestRate}
                onChange={(e) => {
                  const value = e.target.value;
                  // 숫자와 소수점만 허용
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setFormData({ ...formData, interestRate: value });
                  }
                }}
                onKeyPress={handleKeyPress}
                className={`${styles.input} ${
                  errors.interestRate ? styles.error : ""
                }`}
                placeholder="3.5"
              />
              {errors.interestRate && (
                <span className={styles.errorText}>{errors.interestRate}</span>
              )}
            </div>
          </div>

          {/* 기간 (연/월) */}
          <div className={styles.row} style={{ marginTop: "1.5rem" }}>
            <div className={styles.field}>
              <label htmlFor="startYear" className={styles.label}>
                시작년도 *
              </label>
              <input
                type="text"
                id="startYear"
                value={formData.startYear}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d{0,4}$/.test(value)) {
                    setFormData({ ...formData, startYear: value });
                  }
                }}
                onKeyPress={handleKeyPress}
                className={styles.input}
                placeholder="2025"
              />
              {formData.startYear && profileData && profileData.birthYear && (
                <div className={styles.agePreview}>
                  {calculateKoreanAge(
                    profileData.birthYear,
                    formData.startYear
                  )}
                  세
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="startMonth" className={styles.label}>
                시작 월 *
              </label>
              <select
                id="startMonth"
                value={formData.startMonth}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    startMonth: parseInt(e.target.value, 10) || 1,
                  })
                }
                className={styles.select}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="endYear" className={styles.label}>
                종료년도 *
              </label>
              <input
                type="text"
                id="endYear"
                value={formData.endYear}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d{0,4}$/.test(value)) {
                    setFormData({ ...formData, endYear: value });
                  }
                }}
                onKeyPress={handleKeyPress}
                className={`${styles.input} ${
                  errors.endYear ? styles.error : ""
                }`}
                placeholder="2030"
              />
              {formData.endYear && profileData && profileData.birthYear && (
                <div className={styles.agePreview}>
                  {calculateKoreanAge(profileData.birthYear, formData.endYear)}
                  세
                </div>
              )}
              {errors.endYear && (
                <span className={styles.errorText}>{errors.endYear}</span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="endMonth" className={styles.label}>
                종료 월 *
              </label>
              <select
                id="endMonth"
                value={formData.endMonth}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    endMonth: parseInt(e.target.value, 10) || 12,
                  })
                }
                className={styles.select}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 거치기간 (거치식상환일 때만 표시) */}
          {formData.debtType === "grace" && (
            <div className={styles.field}>
              <label htmlFor="gracePeriod" className={styles.label}>
                거치기간 (년) *
              </label>
              <input
                type="text"
                id="gracePeriod"
                value={formData.gracePeriod}
                onChange={(e) => {
                  const value = e.target.value;
                  // 숫자만 허용하고 빈 문자열이면 0으로 설정
                  if (value === "" || /^\d+$/.test(value)) {
                    const numValue = value === "" ? 0 : parseInt(value, 10);
                    // 0~50년 사이로 제한 (실용적인 범위)
                    if (numValue >= 0 && numValue <= 50) {
                      setFormData({ ...formData, gracePeriod: numValue });
                    }
                  }
                }}
                className={styles.input}
                placeholder="5"
              />
              <div className={styles.helpText}>
                <span>이자만 납부하는 기간 (년 단위, 0~50년)</span>
              </div>
            </div>
          )}

          {/* 메모 */}
          <div className={styles.field}>
            <label htmlFor="memo" className={styles.label}>
              비고
            </label>
            <textarea
              id="memo"
              value={formData.memo}
              onChange={(e) =>
                setFormData({ ...formData, memo: e.target.value })
              }
              className={styles.textarea}
              rows="3"
              placeholder="추가 설명이나 참고사항을 입력하세요"
            />
          </div>

          {/* 적용 시뮬레이션 선택 */}
          {simulations && simulations.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>적용 시뮬레이션</label>
              <div>
                {isSimSelectionLoading ? (
                  <span className={styles.hintText}>
                    시뮬레이션 목록 불러오는 중…
                  </span>
                ) : (
                  simulations.map((sim) => {
                    const status = simulationStatusMap[sim.id] || "create";
                    const statusText =
                      status === "update" ? "(수정)" : "(추가)";
                    return (
                      <label key={sim.id} className={styles.fixedCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedSimulationIds.includes(sim.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedSimulationIds((prev) => {
                              if (checked)
                                return Array.from(
                                  new Set([...(prev || []), sim.id])
                                );
                              return (prev || []).filter((id) => id !== sim.id);
                            });
                          }}
                          className={styles.fixedCheckbox}
                        />
                        <span className={styles.fixedCheckboxText}>
                          {sim.title || (sim.isDefault ? "현재" : "시뮬레이션")}{" "}
                          <span
                            style={{
                              color:
                                status === "update" ? "#2196F3" : "#4CAF50",
                            }}
                          >
                            {statusText}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </form>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={handleClose}
          >
            취소
          </button>
          <button type="submit" form="debtForm" className={styles.saveButton}>
            {editData ? "수정" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DebtModal;
