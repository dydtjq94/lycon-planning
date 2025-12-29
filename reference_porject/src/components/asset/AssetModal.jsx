import React, { useState, useEffect } from "react";
import { formatAmount, formatAmountForChart } from "../../utils/format";
import { calculateKoreanAge } from "../../utils/koreanAge";
import styles from "./AssetModal.module.css";
import { assetService } from "../../services/firestoreService";

/**
 * 자산 추가/수정 모달
 * 기본적인 자산 정보를 관리합니다.
 */
function AssetModal({
  isOpen,
  onClose,
  onSave,
  editData = null,
  initialData = null, // 복사된 데이터 (복사해서 추가용)
  profileData,
  simulations = [],
  activeSimulationId = null,
  profileId = null,
  defaultAssetGrowthRate = "2.86", // 전역 설정에서 전달된 자산 가치 상승률 기본값
  defaultIncomeRate = "3", // 전역 설정에서 전달된 연간 수익률 (배당, 이자 등) 기본값
}) {
  const [formData, setFormData] = useState({
    title: "",
    currentValue: "",
    growthRate: defaultAssetGrowthRate, // 전역 설정에서 가져온 가치 상승률
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1, // 현재 월
    endYear: "",
    endMonth: 12,
    assetType: "general", // "general" 또는 "income"
    incomeRate: defaultIncomeRate, // 전역 설정에서 가져온 연간 수익률 (배당, 이자 등)
    capitalGainsTaxRate: "", // 양도세율 (%)
    memo: "2020년부터 2024년까지의 5년간 퇴직연금의 연환산수익률",
    isPurchase: false, // 구매 여부
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
              const assets = await assetService.getAssets(profileId, sim.id);
              // 같은 ID의 항목이 있는지 확인
              const hasSameId = assets.some(
                (asset) => asset.id === editData.id
              );
              return { simId: sim.id, status: hasSameId ? "update" : "create" };
            } catch (error) {
              console.error(`  ❌ 시뮬레이션 ${sim.id} 확인 오류:`, error);
              return { simId: sim.id, status: "create" }; // 오류 시 추가로 처리
            }
          });
          const results = await Promise.all(checkPromises);

          // 작업이 취소되었으면 상태 업데이트 안함
          if (cancelled) {
            return;
          }

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
          console.error("❌ [자산모달] 시뮬레이션 상태 확인 오류:", error);

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

  // 모달이 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        // 수정 모드: 기존 데이터 로드
        setFormData({
          title: editData.title || "",
          currentValue: editData.currentValue || "",
          growthRate:
            editData.growthRate !== undefined
              ? (editData.growthRate * 100).toFixed(2)
              : "2.86",
          startYear: editData.startYear || new Date().getFullYear(),
          startMonth: editData.startMonth || 1,
          endYear: editData.endYear || "",
          endMonth: editData.endMonth || 12,
          assetType: editData.assetType || "general",
          incomeRate:
            editData.incomeRate !== undefined
              ? (editData.incomeRate * 100).toFixed(2)
              : "3",
          capitalGainsTaxRate:
            editData.capitalGainsTaxRate !== undefined &&
            editData.capitalGainsTaxRate !== null
              ? (editData.capitalGainsTaxRate * 100).toFixed(2)
              : "",
          memo: editData.memo || "",
          isPurchase: editData.isPurchase || false,
        });
      } else if (initialData) {
        // 복사 모드: 복사된 데이터로 초기화 (id 제외)
        setFormData({
          title: initialData.title || "",
          currentValue: initialData.currentValue || "",
          growthRate:
            initialData.growthRate !== undefined
              ? (initialData.growthRate * 100).toFixed(2)
              : "2.86",
          startYear: initialData.startYear || new Date().getFullYear(),
          startMonth: initialData.startMonth || 1,
          endYear: initialData.endYear || "",
          endMonth: initialData.endMonth || 12,
          assetType: initialData.assetType || "general",
          incomeRate:
            initialData.incomeRate !== undefined
              ? (initialData.incomeRate * 100).toFixed(2)
              : "3",
          capitalGainsTaxRate:
            initialData.capitalGainsTaxRate !== undefined &&
            initialData.capitalGainsTaxRate !== null
              ? (initialData.capitalGainsTaxRate * 100).toFixed(2)
              : "",
          memo: initialData.memo || "",
          isPurchase: initialData.isPurchase || false,
        });
      } else {
        // 새 데이터인 경우 기본값 설정
        const currentYear = new Date().getFullYear();
        const deathYear = profileData
          ? profileData.birthYear + 90
          : currentYear + 50;

        setFormData({
          title: "",
          currentValue: "",
          growthRate: defaultAssetGrowthRate,
          startYear: currentYear,
          startMonth: new Date().getMonth() + 1, // 현재 월
          endYear: deathYear,
          endMonth: 12,
          assetType: "general",
          incomeRate: defaultIncomeRate,
          capitalGainsTaxRate: "",
          memo: "2020년부터 2024년까지의 5년간 퇴직연금의 연환산수익률",
          isPurchase: false,
        });
      }
    }
  }, [isOpen, editData, initialData, profileData, defaultAssetGrowthRate, defaultIncomeRate]);

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

  // 폼 검증
  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "자산명을 입력해주세요.";
    } else if (formData.title.trim() === "현금") {
      newErrors.title = "'현금'은 이미 추가된 자산입니다.";
    }

    if (!formData.currentValue || parseFloat(formData.currentValue) < 0) {
      newErrors.currentValue = "가치는 0보다 큰 값을 입력해주세요.";
    }

    const growthRateNum = parseFloat(formData.growthRate);
    if (isNaN(growthRateNum) || growthRateNum < -100 || growthRateNum > 1000) {
      newErrors.growthRate = "상승률은 -100%와 1000% 사이의 숫자여야 합니다.";
    }

    if (!formData.endYear || parseInt(formData.endYear) < formData.startYear) {
      newErrors.endYear = "종료 연도는 시작 연도보다 크거나 같아야 합니다.";
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

    if (formData.assetType === "income") {
      const incomeRateNum = parseFloat(formData.incomeRate);
      if (
        isNaN(incomeRateNum) ||
        incomeRateNum < -100 ||
        incomeRateNum > 1000
      ) {
        newErrors.incomeRate = "수익률은 -100%와 1000% 사이의 숫자여야 합니다.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 숫자만 입력 허용
  const handleKeyPress = (e) => {
    if (
      !/[0-9]/.test(e.key) &&
      !["Backspace", "Delete", "Tab", "Enter", "."].includes(e.key)
    ) {
      e.preventDefault();
    }
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const assetData = {
      title: formData.title.trim(),
      currentValue: parseFloat(formData.currentValue),
      growthRate: parseFloat(formData.growthRate) / 100, // 백분율을 소수로 변환
      startYear: parseInt(formData.startYear),
      startMonth: parseInt(formData.startMonth) || 1,
      endYear: parseInt(formData.endYear),
      endMonth: parseInt(formData.endMonth) || 12,
      assetType: formData.assetType,
      incomeRate:
        formData.assetType === "income"
          ? parseFloat(formData.incomeRate) / 100
          : 0, // 수익형 자산일 때만 수익률 적용
      capitalGainsTaxRate: formData.capitalGainsTaxRate
        ? parseFloat(formData.capitalGainsTaxRate) / 100
        : 0, // 양도세율 (백분율을 소수로 변환)
      memo: formData.memo.trim(),
      isPurchase: formData.isPurchase, // 구매 여부
      selectedSimulationIds:
        selectedSimulationIds && selectedSimulationIds.length > 0
          ? selectedSimulationIds
          : activeSimulationId
          ? [activeSimulationId]
          : [],
    };

    // 수정 모드일 때는 id를 포함시켜야 함
    if (editData && editData.id) {
      assetData.id = editData.id;
    }

    await onSave(assetData);
    // 모달 닫기는 외부에서 처리 (SimulationCompareModal에서 onClose를 호출)
    // DashboardPage에서 직접 호출할 때는 onSave 완료 후 자동으로 모달이 닫힘
    if (!editData) {
      handleClose(); // 추가 모드일 때만 닫기
    }
  };

  // 모달 닫기
  const handleClose = () => {
    setFormData({
      title: "",
      currentValue: "",
      growthRate: defaultAssetGrowthRate,
      startYear: new Date().getFullYear(),
      startMonth: new Date().getMonth() + 1, // 현재 월
      endYear: "",
      endMonth: 12,
      assetType: "general",
      incomeRate: defaultIncomeRate,
      capitalGainsTaxRate: "",
      memo: "",
      isPurchase: false,
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
            {editData ? "자산 수정" : "자산 추가"}
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>

        <form id="assetForm" onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>자산 타입 *</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="assetType"
                  value="general"
                  checked={formData.assetType === "general"}
                  onChange={(e) =>
                    setFormData({ ...formData, assetType: e.target.value })
                  }
                />
                <span className={styles.radioText}>일반 자산 (자동차 등)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="assetType"
                  value="income"
                  checked={formData.assetType === "income"}
                  onChange={(e) =>
                    setFormData({ ...formData, assetType: e.target.value })
                  }
                />
                <span className={styles.radioText}>수익형 자산</span>
              </label>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>항목명 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className={`${styles.input} ${errors.title ? styles.error : ""}`}
              placeholder="예: 주식, 채권, 금, 예금 등"
            />
            {errors.title && (
              <span className={styles.errorText}>{errors.title}</span>
            )}
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <div className={styles.endYearWrapper}>
                <label className={styles.label}>자산 가치 (만원) *</label>
                <label className={styles.fixedCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.isPurchase}
                    onChange={(e) =>
                      setFormData({ ...formData, isPurchase: e.target.checked })
                    }
                    className={styles.fixedCheckbox}
                  />
                  <span className={styles.fixedCheckboxText}>
                    현금유출로 처리
                  </span>
                </label>
              </div>
              <input
                type="text"
                value={formData.currentValue}
                onChange={(e) =>
                  setFormData({ ...formData, currentValue: e.target.value })
                }
                onKeyPress={handleKeyPress}
                className={`${styles.input} ${
                  errors.currentValue ? styles.error : ""
                }`}
                placeholder="예: 1000"
              />
              {formData.currentValue &&
                !isNaN(parseInt(formData.currentValue)) && (
                  <div className={styles.amountPreview}>
                    {formatAmountForChart(parseInt(formData.currentValue))}
                  </div>
                )}
              {errors.currentValue && (
                <span className={styles.errorText}>{errors.currentValue}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>연평균 가치 상승률 (%) *</label>
              <input
                type="text"
                value={formData.growthRate}
                onChange={(e) => {
                  const value = e.target.value;
                  // 숫자, 소수점, 마이너스 기호 허용 (마이너스는 맨 앞에만)
                  if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                    setFormData({ ...formData, growthRate: value });
                  }
                }}
                className={`${styles.input} ${
                  errors.growthRate ? styles.error : ""
                }`}
                placeholder="예: 2.86"
              />
              {errors.growthRate && (
                <span className={styles.errorText}>{errors.growthRate}</span>
              )}
            </div>
          </div>

          {formData.assetType === "income" && (
            <div className={styles.field}>
              <label className={styles.label}>
                연간 수익률 (배당, 이자 등) (%) *
              </label>
              <input
                type="text"
                value={formData.incomeRate}
                onChange={(e) => {
                  const value = e.target.value;
                  // 숫자, 소수점, 마이너스 기호 허용 (마이너스는 맨 앞에만)
                  if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                    setFormData({ ...formData, incomeRate: value });
                  }
                }}
                className={`${styles.input} ${
                  errors.incomeRate ? styles.error : ""
                }`}
                placeholder="예: 2.86"
              />
              {errors.incomeRate && (
                <span className={styles.errorText}>{errors.incomeRate}</span>
              )}
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>보유 시작년도 *</label>
              <input
                type="text"
                value={formData.startYear}
                onChange={(e) =>
                  setFormData({ ...formData, startYear: e.target.value })
                }
                onKeyPress={handleKeyPress}
                className={`${styles.input} ${
                  errors.startYear ? styles.error : ""
                }`}
                placeholder="보유 시작"
              />
              {formData.startYear && profileData?.birthYear && (
                <div className={styles.agePreview}>
                  {calculateKoreanAge(
                    profileData.birthYear,
                    formData.startYear
                  )}
                  세
                </div>
              )}
              {errors.startYear && (
                <span className={styles.errorText}>{errors.startYear}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>시작 월 *</label>
              <select
                value={formData.startMonth}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    startMonth: parseInt(e.target.value) || 1,
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
              <label className={styles.label}>보유 종료년도 *</label>
              <input
                type="text"
                value={formData.endYear}
                onChange={(e) =>
                  setFormData({ ...formData, endYear: e.target.value })
                }
                onKeyPress={handleKeyPress}
                className={`${styles.input} ${
                  errors.endYear ? styles.error : ""
                }`}
                placeholder="보유 종료"
              />
              {formData.endYear && profileData?.birthYear && (
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
              <label className={styles.label}>종료 월 *</label>
              <select
                value={formData.endMonth}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    endMonth: parseInt(e.target.value) || 12,
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

          <div className={`${styles.field} ${styles.taxField}`}>
            <label className={styles.label}>
              양도세율 (%) <span className={styles.optional}>- 선택</span>
            </label>
            <input
              type="text"
              value={formData.capitalGainsTaxRate}
              onChange={(e) => {
                const value = e.target.value;
                // 숫자와 소수점만 허용 (0-100)
                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                  setFormData({
                    ...formData,
                    capitalGainsTaxRate: value,
                  });
                }
              }}
              onKeyPress={handleKeyPress}
              className={styles.input}
              placeholder="예: 22 (수익의 22%를 세금으로 납부)"
            />
            <div className={styles.fieldHelper}>
              매각 시 (최종가치 - 초기가치) × 양도세율을 세금으로 납부합니다.
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>비고</label>
            <textarea
              value={formData.memo}
              onChange={(e) =>
                setFormData({ ...formData, memo: e.target.value })
              }
              className={styles.textarea}
              placeholder="자산에 대한 추가 정보나 설명을 입력하세요"
              rows={3}
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
            onClick={handleClose}
            className={styles.cancelButton}
          >
            취소
          </button>
          <button type="submit" form="assetForm" className={styles.saveButton}>
            {editData ? "수정" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AssetModal;
