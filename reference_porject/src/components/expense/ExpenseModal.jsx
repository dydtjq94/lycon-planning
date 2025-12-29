import React, { useState, useEffect } from "react";
import styles from "./ExpenseModal.module.css";
import { formatAmountForChart } from "../../utils/format";
import { calculateKoreanAge } from "../../utils/koreanAge";
import { expenseService } from "../../services/firestoreService";

/**
 * 지출 데이터 추가/수정 모달
 */
function ExpenseModal({
  isOpen,
  onClose,
  onSave,
  editData = null,
  initialData = null, // 재무 라이브러리에서 전달된 템플릿 데이터
  profileData = null,
  simulations = [],
  activeSimulationId = null,
  profileId = null,
  defaultInflationRate = "1.89", // 전역 설정에서 전달된 물가 상승률 기본값
}) {
  // 은퇴년도 계산 (문자열 결합 방지 및 현재 연도 기준 계산)
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
    return currentYear + 10;
  };

  const [formData, setFormData] = useState({
    title: "",
    frequency: "monthly", // monthly, yearly
    amount: "",
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1, // 시작 월 (1-12) - 현재 월
    endYear: getRetirementYear(),
    endMonth: 12, // 종료 월 (1-12)
    memo: "2014년부터 2024년까지의 10년간 평균",
    growthRate: defaultInflationRate, // 전역 설정에서 가져온 물가 상승률
    isFixedToRetirementYear: false, // 은퇴년도 고정 여부
  });

  // 세부 항목 상태
  const [subItems, setSubItems] = useState([]);
  const [showSubItems, setShowSubItems] = useState(false);

  const [errors, setErrors] = useState({});
  const [selectedSimulationIds, setSelectedSimulationIds] = useState([]);
  // 각 시뮬레이션이 수정인지 추가인지 상태 저장: { simId: 'update' | 'create' }
  const [simulationStatusMap, setSimulationStatusMap] = useState({});
  const [isSimSelectionLoading, setIsSimSelectionLoading] = useState(false);

  // 은퇴년도 고정이 켜져있으면 endYear를 자동으로 은퇴년도로 업데이트
  useEffect(() => {
    if (formData.isFixedToRetirementYear && profileData) {
      const retirementYear = getRetirementYear();
      if (formData.endYear !== retirementYear) {
        setFormData((prev) => ({ ...prev, endYear: retirementYear }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.isFixedToRetirementYear,
    profileData?.retirementAge,
    profileData?.birthYear,
  ]);

  // 세부 항목 합계 계산
  const calculateSubItemsTotal = (items) => {
    return items.reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);
  };

  // 세부 항목이 있을 때 총액 자동 업데이트
  useEffect(() => {
    if (showSubItems && subItems.length > 0) {
      const total = calculateSubItemsTotal(subItems);
      setFormData((prev) => ({ ...prev, amount: total.toString() }));
    }
  }, [subItems, showSubItems]);

  // 세부 항목 추가 (기본 성장률은 현재 설정된 물가 상승률)
  const addSubItem = () => {
    setSubItems((prev) => [
      ...prev,
      { id: Date.now(), name: "", amount: "", growthRate: formData.growthRate },
    ]);
  };

  // 세부 항목 삭제
  const removeSubItem = (id) => {
    setSubItems((prev) => prev.filter((item) => item.id !== id));
  };

  // 세부 항목 수정
  const updateSubItem = (id, field, value) => {
    setSubItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

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
              const expenses = await expenseService.getExpenses(
                profileId,
                sim.id
              );
              // 같은 ID의 항목이 있는지 확인
              const hasSameId = expenses.some(
                (expense) => expense.id === editData.id
              );
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
          const defaultSelected = activeSimulationId ? [activeSimulationId] : [];
          setSelectedSimulationIds(defaultSelected);

          // 최소 1초 로딩 유지
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

          // 최소 1초 로딩 유지
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
        // 수정 모드
        setFormData({
          title: editData.title || "",
          frequency:
            editData.originalFrequency || editData.frequency || "monthly",
          amount: editData.originalAmount || editData.amount || "",
          startYear: parseInt(editData.startYear) || new Date().getFullYear(),
          startMonth: editData.startMonth || 1, // 기존 데이터 호환성: 없으면 1월
          endYear: parseInt(editData.endYear) || getRetirementYear(),
          endMonth: editData.endMonth || 12, // 기존 데이터 호환성: 없으면 12월
          memo: editData.memo || "",
          growthRate: editData.growthRate !== undefined && editData.growthRate !== null
            ? editData.growthRate.toString()
            : "1.89",
          isFixedToRetirementYear: editData.isFixedToRetirementYear || false,
        });
        // 세부 항목 로드
        if (editData.subItems && editData.subItems.length > 0) {
          setSubItems(editData.subItems);
          setShowSubItems(true);
        } else {
          setSubItems([]);
          setShowSubItems(false);
        }
      } else if (initialData) {
        // 재무 라이브러리에서 선택된 템플릿 데이터로 초기화
        setFormData({
          title: initialData.title || "",
          frequency: initialData.frequency || "monthly",
          amount: initialData.amount || "",
          startYear: initialData.startYear || new Date().getFullYear(),
          startMonth: initialData.startMonth || 1,
          endYear: initialData.endYear || getRetirementYear(),
          endMonth: initialData.endMonth || 12,
          memo: initialData.memo || "",
          growthRate:
            initialData.growthRate !== undefined
              ? initialData.growthRate.toString()
              : "1.89",
          isFixedToRetirementYear: initialData.isFixedToRetirementYear || false,
        });
        // 세부 항목 로드
        if (initialData.subItems && initialData.subItems.length > 0) {
          setSubItems(initialData.subItems);
          setShowSubItems(true);
        } else {
          setSubItems([]);
          setShowSubItems(false);
        }
      } else {
        // 새 데이터일 때 기본값
        setFormData({
          title: "",
          frequency: "monthly",
          amount: "",
          startYear: new Date().getFullYear(),
          startMonth: new Date().getMonth() + 1, // 현재 월
          endYear: getRetirementYear(),
          endMonth: 12,
          memo: "2014년부터 2024년까지의 10년간 평균",
          growthRate: defaultInflationRate,
          isFixedToRetirementYear: false,
        });
        setSubItems([]);
        setShowSubItems(false);
      }
    }
  }, [isOpen, editData, initialData, defaultInflationRate]);

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
      newErrors.title = "제목을 입력해주세요.";
    }

    if (!formData.amount || formData.amount < 0) {
      newErrors.amount = "금액을 입력해주세요.";
    }

    if (formData.startYear > formData.endYear) {
      newErrors.endYear = "종료년도는 시작년도보다 늦어야 합니다.";
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

    const expenseData = {
      ...formData,
      amount: parseInt(formData.amount),
      startYear: parseInt(formData.startYear), // 문자열을 숫자로 변환
      startMonth: formData.startMonth || 1, // 기본값 1월
      endYear: parseInt(formData.endYear), // 문자열을 숫자로 변환
      endMonth: formData.endMonth || 12, // 기본값 12월
      growthRate: parseFloat(formData.growthRate), // 백분율 그대로 저장 (마이너스 값 포함)
      originalAmount: parseInt(formData.amount),
      originalFrequency: formData.frequency,
      isFixedToRetirementYear: formData.isFixedToRetirementYear || false,
      selectedSimulationIds:
        selectedSimulationIds && selectedSimulationIds.length > 0
          ? selectedSimulationIds
          : activeSimulationId
          ? [activeSimulationId]
          : [],
      // 세부 항목 저장 (활성화되어 있고 항목이 있을 때만)
      subItems: showSubItems && subItems.length > 0 ? subItems : [],
    };

    // 수정 모드일 때는 id를 포함시켜야 함
    if (editData && editData.id) {
      expenseData.id = editData.id;
    }

    await onSave(expenseData);
    // 모달 닫기는 외부에서 처리 (SimulationCompareModal에서 onClose를 호출)
    if (!editData) {
      handleClose(); // 추가 모드일 때만 닫기
    }
  };

  // 모달 닫기 핸들러
  const handleClose = () => {
    setFormData({
      title: "",
      frequency: "monthly",
      amount: "",
      startYear: new Date().getFullYear(),
      startMonth: new Date().getMonth() + 1, // 현재 월
      endYear: new Date().getFullYear() + 10,
      endMonth: 12,
      memo: "2014년부터 2024년까지의 10년간 평균",
      growthRate: defaultInflationRate,
      isFixedToRetirementYear: false,
    });
    setSubItems([]);
    setShowSubItems(false);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {editData ? "지출 수정" : "지출 추가"}
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>

        <form id="expenseForm" onSubmit={handleSubmit} className={styles.form}>
          {/* 지출 항목명 */}
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
              placeholder="예: 생활비, 교육비, 의료비"
            />
            {errors.title && (
              <span className={styles.errorText}>{errors.title}</span>
            )}
          </div>

          {/* 빈도와 금액 */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="frequency" className={styles.label}>
                주기 *
              </label>
              <select
                id="frequency"
                value={formData.frequency}
                onChange={(e) =>
                  setFormData({ ...formData, frequency: e.target.value })
                }
                className={styles.select}
              >
                <option value="monthly">월</option>
                <option value="yearly">년</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="amount" className={styles.label}>
                금액 (만원) *
                {showSubItems && subItems.length > 0 && (
                  <span className={styles.totalLabel}> (세부 항목 합계)</span>
                )}
              </label>
              <input
                type="text"
                id="amount"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                onKeyPress={handleKeyPress}
                className={`${styles.input} ${
                  errors.amount ? styles.error : ""
                } ${showSubItems && subItems.length > 0 ? styles.disabled : ""}`}
                placeholder="예: 300"
                readOnly={showSubItems && subItems.length > 0}
              />
              {formData.amount && !isNaN(parseInt(formData.amount)) && (
                <div className={styles.amountPreview}>
                  {formatAmountForChart(parseInt(formData.amount))}
                </div>
              )}
              {errors.amount && (
                <span className={styles.errorText}>{errors.amount}</span>
              )}
            </div>
          </div>

          {/* 세부 항목 토글 */}
          <div className={styles.subItemsToggle}>
            <label className={styles.fixedCheckboxLabel}>
              <input
                type="checkbox"
                checked={showSubItems}
                onChange={(e) => {
                  setShowSubItems(e.target.checked);
                  if (e.target.checked && subItems.length === 0) {
                    addSubItem();
                  }
                }}
                className={styles.fixedCheckbox}
              />
              <span className={styles.fixedCheckboxText}>세부 항목으로 입력</span>
            </label>
          </div>

          {/* 세부 항목 리스트 */}
          {showSubItems && (
            <div className={styles.subItemsSection}>
              <div className={styles.subItemsHeader}>
                <span className={styles.subItemsHeaderName}>항목명</span>
                <span className={styles.subItemsHeaderAmount}>금액</span>
                <span className={styles.subItemsHeaderRate}>상승률</span>
                <span className={styles.subItemsHeaderAction}></span>
              </div>
              <div className={styles.subItemsList}>
                {subItems.map((item, index) => (
                  <div key={item.id} className={styles.subItemRow}>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateSubItem(item.id, "name", e.target.value)}
                      className={styles.subItemName}
                      placeholder={`세부 항목 ${index + 1}`}
                    />
                    <div className={styles.subItemAmountWrapper}>
                      <input
                        type="text"
                        value={item.amount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^\d*$/.test(value)) {
                            updateSubItem(item.id, "amount", value);
                          }
                        }}
                        className={styles.subItemAmount}
                        placeholder="금액"
                      />
                      <span className={styles.subItemUnit}>만원</span>
                    </div>
                    <div className={styles.subItemRateWrapper}>
                      <input
                        type="text"
                        value={item.growthRate ?? formData.growthRate}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                            updateSubItem(item.id, "growthRate", value);
                          }
                        }}
                        className={styles.subItemRate}
                        placeholder="1.89"
                      />
                      <span className={styles.subItemUnit}>%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSubItem(item.id)}
                      className={styles.subItemRemove}
                      title="삭제"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addSubItem}
                className={styles.addSubItemBtn}
              >
                + 세부 항목 추가
              </button>
              {subItems.length > 0 && (
                <div className={styles.subItemsTotal}>
                  합계: {formatAmountForChart(calculateSubItemsTotal(subItems))}
                </div>
              )}
            </div>
          )}

          {/* 기간 */}
          <div className={styles.row}>
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
                  // 숫자만 허용하고 4자리 제한
                  if (value === "" || /^\d{0,4}$/.test(value)) {
                    setFormData({ ...formData, startYear: value });
                  }
                }}
                onKeyPress={handleKeyPress}
                className={styles.input}
                placeholder="2025"
              />
              {/* 시작년도 나이 표시 */}
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
                    startMonth: parseInt(e.target.value),
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
              <div className={styles.endYearWrapper}>
                <label htmlFor="endYear" className={styles.label}>
                  종료년도 *
                </label>
                <label className={styles.fixedCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.isFixedToRetirementYear}
                    onChange={(e) => {
                      const isFixed = e.target.checked;
                      setFormData({
                        ...formData,
                        isFixedToRetirementYear: isFixed,
                        // 체크 시 은퇴년도로 자동 설정
                        endYear: isFixed
                          ? getRetirementYear()
                          : formData.endYear,
                      });
                    }}
                    className={styles.fixedCheckbox}
                  />
                  <span className={styles.fixedCheckboxText}>
                    은퇴 시점 고정
                  </span>
                </label>
              </div>
              <input
                type="text"
                id="endYear"
                value={formData.endYear}
                onChange={(e) => {
                  const value = e.target.value;
                  // 숫자만 허용하고 4자리 제한
                  if (value === "" || /^\d{0,4}$/.test(value)) {
                    setFormData({
                      ...formData,
                      endYear: value,
                      // 수동으로 변경하면 고정 해제
                      isFixedToRetirementYear: false,
                    });
                  }
                }}
                disabled={formData.isFixedToRetirementYear}
                onKeyPress={handleKeyPress}
                className={`${styles.input} ${
                  errors.endYear ? styles.error : ""
                } ${formData.isFixedToRetirementYear ? styles.disabled : ""}`}
                placeholder="2035"
              />
              {/* 종료년도 나이 표시 */}
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
                    endMonth: parseInt(e.target.value),
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

          {/* 상승률 - 세부 항목 사용 시 숨김 (각 항목별 성장률 사용) */}
          {!(showSubItems && subItems.length > 0) && (
            <div className={styles.field}>
              <label htmlFor="growthRate" className={styles.label}>
                물가 상승률 (%)
              </label>
              <input
                type="text"
                id="growthRate"
                value={formData.growthRate}
                onChange={(e) => {
                  const value = e.target.value;
                  // 숫자, 소수점, 마이너스 기호 허용 (마이너스는 맨 앞에만)
                  if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                    setFormData({ ...formData, growthRate: value });
                  }
                }}
                onKeyPress={handleKeyPress}
                className={styles.input}
                placeholder="1.89"
              />
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

          {/* 적용 시뮬레이션 선택 (하단 영역) */}
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
                    const statusText = status === "update" ? "(수정)" : "(추가)";
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
                              color: status === "update" ? "#2196F3" : "#4CAF50",
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

        {/* 버튼 */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={handleClose}
          >
            취소
          </button>
          <button type="submit" form="expenseForm" className={styles.saveButton}>
            {editData ? "수정" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExpenseModal;
