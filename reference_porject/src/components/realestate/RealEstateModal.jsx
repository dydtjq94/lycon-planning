import React, { useState, useEffect } from "react";
import styles from "./RealEstateModal.module.css";
import { formatAmountForChart } from "../../utils/format";
import { calculateKoreanAge } from "../../utils/koreanAge";
import { realEstateService } from "../../services/firestoreService";

const RealEstateModal = ({
  isOpen,
  onClose,
  onSave,
  editData = null,
  initialData = null, // 복사된 데이터 (복사해서 추가용)
  profileData,
  simulations = [],
  activeSimulationId = null,
  profileId = null,
  defaultRealEstateGrowthRate = "2.4", // 전역 설정에서 전달된 부동산 가치 상승률 기본값
}) => {
  const [formData, setFormData] = useState({
    title: "",
    isResidential: true, // 거주용 여부 (기본값: 체크됨)
    hasAcquisitionInfo: false, // 올해 이전에 취득 여부
    currentValue: "",
    acquisitionPrice: "", // 취득가액 (양도세 계산용)
    acquisitionYear: "", // 취득일자 (양도세 계산용)
    growthRate: defaultRealEstateGrowthRate, // 전역 설정에서 가져온 가치 상승률
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1, // 현재 월
    endYear: new Date().getFullYear() + 30, // 종료년도 추가
    endMonth: 12,
    holdingPeriod: "",
    hasRentalIncome: false,
    monthlyRentalIncome: "",
    rentalIncomeStartYear: "",
    rentalIncomeStartMonth: 1,
    rentalIncomeEndYear: "",
    rentalIncomeEndMonth: 12,
    convertToPension: false,
    pensionStartYear: "",
    pensionStartMonth: 1,
    pensionEndYear: "",
    pensionEndMonth: 12,
    monthlyPensionAmount: "",
    memo: "(서울) 연평균 : 9.3%\n(디폴트) 10년간 전국 주택의 총 매매가 연평균 상승률 : 2.4%\n주택연금은 12억원 미만만 가능",
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
              const realEstates = await realEstateService.getRealEstates(
                profileId,
                sim.id
              );
              // 같은 ID의 항목이 있는지 확인
              const hasSameId = realEstates.some(
                (realEstate) => realEstate.id === editData.id
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
          const defaultSelected = activeSimulationId
            ? [activeSimulationId]
            : [];
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

  // 모달이 열릴 때 폼 초기화
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        // 수정 모드: 기존 데이터 로드
        setFormData({
          title: editData.title || "",
          isResidential:
            editData.isResidential !== undefined
              ? editData.isResidential
              : true,
          hasAcquisitionInfo: editData.hasAcquisitionInfo || false,
          currentValue: editData.currentValue || "",
          acquisitionPrice: editData.acquisitionPrice || "",
          acquisitionYear: editData.acquisitionYear || "",
          growthRate:
            editData.growthRate !== undefined && editData.growthRate !== null
              ? editData.growthRate.toFixed(2)
              : "2.4",
          startYear: editData.startYear || new Date().getFullYear(),
          startMonth: editData.startMonth || 1,
          endYear: editData.endYear || new Date().getFullYear() + 30,
          endMonth: editData.endMonth || 12,
          holdingPeriod: editData.holdingPeriod || "",
          hasRentalIncome: editData.hasRentalIncome || false,
          monthlyRentalIncome: editData.monthlyRentalIncome || "",
          rentalIncomeStartYear: editData.rentalIncomeStartYear || "",
          rentalIncomeStartMonth: editData.rentalIncomeStartMonth || 1,
          rentalIncomeEndYear: editData.rentalIncomeEndYear || "",
          rentalIncomeEndMonth: editData.rentalIncomeEndMonth || 12,
          convertToPension: editData.convertToPension || false,
          pensionStartYear: editData.pensionStartYear || "",
          pensionStartMonth: editData.pensionStartMonth || 1,
          pensionEndYear: editData.pensionEndYear || "",
          pensionEndMonth: editData.pensionEndMonth || 12,
          monthlyPensionAmount: editData.monthlyPensionAmount || "",
          memo: editData.memo || "",
          isPurchase: editData.isPurchase || false,
        });
      } else if (initialData) {
        // 복사 모드: 복사된 데이터로 초기화 (id 제외)
        setFormData({
          title: initialData.title || "",
          isResidential:
            initialData.isResidential !== undefined
              ? initialData.isResidential
              : true,
          hasAcquisitionInfo: initialData.hasAcquisitionInfo || false,
          currentValue: initialData.currentValue || "",
          acquisitionPrice: initialData.acquisitionPrice || "",
          acquisitionYear: initialData.acquisitionYear || "",
          growthRate:
            initialData.growthRate !== undefined &&
            initialData.growthRate !== null
              ? initialData.growthRate.toFixed(2)
              : "2.4",
          startYear: initialData.startYear || new Date().getFullYear(),
          startMonth: initialData.startMonth || 1,
          endYear: initialData.endYear || new Date().getFullYear() + 30,
          endMonth: initialData.endMonth || 12,
          holdingPeriod: initialData.holdingPeriod || "",
          hasRentalIncome: initialData.hasRentalIncome || false,
          monthlyRentalIncome: initialData.monthlyRentalIncome || "",
          rentalIncomeStartYear: initialData.rentalIncomeStartYear || "",
          rentalIncomeStartMonth: initialData.rentalIncomeStartMonth || 1,
          rentalIncomeEndYear: initialData.rentalIncomeEndYear || "",
          rentalIncomeEndMonth: initialData.rentalIncomeEndMonth || 12,
          convertToPension: initialData.convertToPension || false,
          pensionStartYear: initialData.pensionStartYear || "",
          pensionStartMonth: initialData.pensionStartMonth || 1,
          pensionEndYear: initialData.pensionEndYear || "",
          pensionEndMonth: initialData.pensionEndMonth || 12,
          monthlyPensionAmount: initialData.monthlyPensionAmount || "",
          memo: initialData.memo || "",
          isPurchase: initialData.isPurchase || false,
        });
      } else {
        // 새 데이터인 경우 기본값 설정
        setFormData({
          title: "",
          isResidential: false,
          hasAcquisitionInfo: false,
          currentValue: "",
          acquisitionPrice: "",
          acquisitionYear: "",
          growthRate: defaultRealEstateGrowthRate,
          startYear: new Date().getFullYear(),
          startMonth: new Date().getMonth() + 1, // 현재 월
          endYear: new Date().getFullYear() + 30,
          endMonth: 12,
          holdingPeriod: "",
          hasRentalIncome: false,
          monthlyRentalIncome: "",
          rentalIncomeStartYear: "",
          rentalIncomeStartMonth: 1,
          rentalIncomeEndYear: "",
          rentalIncomeEndMonth: 12,
          convertToPension: false,
          pensionStartYear: "",
          pensionStartMonth: 1,
          pensionEndYear: "",
          pensionEndMonth: 12,
          monthlyPensionAmount: "",
          memo: "(서울) 연평균 : 9.3%\n(디폴트) 10년간 전국 주택의 총 매매가 연평균 상승률 : 2.4%\n주택연금은 12억원 미만만 가능",
          isPurchase: false,
        });
      }
      setErrors({});
    }
  }, [isOpen, editData, initialData, defaultRealEstateGrowthRate]);

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

  const handleClose = () => {
    setFormData({
      title: "",
      currentValue: "",
      growthRate: defaultRealEstateGrowthRate,
      startYear: new Date().getFullYear(),
      startMonth: new Date().getMonth() + 1, // 현재 월
      endYear: new Date().getFullYear() + 30,
      endMonth: 12,
      holdingPeriod: "",
      hasRentalIncome: false,
      monthlyRentalIncome: "",
      rentalIncomeStartYear: "",
      rentalIncomeStartMonth: 1,
      rentalIncomeEndYear: "",
      rentalIncomeEndMonth: 12,
      convertToPension: false,
      pensionStartYear: "",
      pensionStartMonth: 1,
      pensionEndYear: "",
      pensionEndMonth: 12,
      monthlyPensionAmount: "",
      memo: "(서울) 연평균 : 9.3%\n(디폴트) 10년간 전국 주택의 총 매매가 연평균 상승률 : 2.4%\n주택연금은 12억원 미만만 가능",
      isPurchase: false,
    });
    setErrors({});
    onClose();
  };

  const handleKeyPress = (e) => {
    // 숫자와 소수점만 허용
    if (!/[0-9.]/.test(e.key)) {
      e.preventDefault();
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "부동산명을 입력해주세요";
    }

    if (!formData.currentValue || formData.currentValue < 0) {
      newErrors.currentValue = "가치를 입력해주세요";
    }

    if (!formData.startYear || formData.startYear < 0) {
      newErrors.startYear = "보유 시작년도를 입력해주세요";
    }

    if (!formData.endYear || formData.endYear < 0) {
      newErrors.endYear = "보유 종료년도를 입력해주세요";
    }

    // 종료년도가 시작년도보다 이후인지 확인
    if (
      formData.startYear &&
      formData.endYear &&
      parseInt(formData.startYear) > parseInt(formData.endYear)
    ) {
      newErrors.endYear = "종료년도는 시작년도 이후여야 합니다";
    }

    if (formData.hasRentalIncome) {
      if (!formData.monthlyRentalIncome || formData.monthlyRentalIncome < 0) {
        newErrors.monthlyRentalIncome = "월 임대 소득을 입력해주세요";
      }

      if (
        !formData.rentalIncomeStartYear ||
        formData.rentalIncomeStartYear < 0
      ) {
        newErrors.rentalIncomeStartYear = "임대 소득 시작년도를 입력해주세요";
      }

      if (!formData.rentalIncomeEndYear || formData.rentalIncomeEndYear < 0) {
        newErrors.rentalIncomeEndYear = "임대 소득 종료년도를 입력해주세요";
      }
    }

    if (formData.convertToPension) {
      if (!formData.pensionStartYear || formData.pensionStartYear < 0) {
        newErrors.pensionStartYear = "주택연금 시작년도를 입력해주세요";
      }

      if (!formData.monthlyPensionAmount || formData.monthlyPensionAmount < 0) {
        newErrors.monthlyPensionAmount = "월 수령액을 입력해주세요";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // 보유 기간 계산 (종료년도 - 시작년도 + 1)
    const holdingPeriod =
      parseInt(formData.endYear) - parseInt(formData.startYear) + 1;

    const realEstateData = {
      title: formData.title.trim(),
      isResidential: formData.isResidential, // 거주용 여부
      hasAcquisitionInfo: formData.hasAcquisitionInfo, // 올해 이전에 취득 여부
      currentValue: parseInt(formData.currentValue),
      acquisitionPrice:
        formData.hasAcquisitionInfo && formData.acquisitionPrice
          ? parseInt(formData.acquisitionPrice)
          : null, // 취득가액 (양도세 계산용)
      acquisitionYear:
        formData.hasAcquisitionInfo && formData.acquisitionYear
          ? parseInt(formData.acquisitionYear)
          : null, // 취득일자 (양도세 계산용)
      growthRate: parseFloat(formData.growthRate), // 백분율 그대로 저장
      startYear: parseInt(formData.startYear),
      startMonth: parseInt(formData.startMonth) || 1,
      endYear: parseInt(formData.endYear),
      endMonth: parseInt(formData.endMonth) || 12,
      holdingPeriod: holdingPeriod,
      hasRentalIncome: formData.hasRentalIncome,
      monthlyRentalIncome: formData.hasRentalIncome
        ? parseInt(formData.monthlyRentalIncome)
        : null,
      rentalIncomeStartYear: formData.hasRentalIncome
        ? parseInt(formData.rentalIncomeStartYear)
        : null,
      rentalIncomeStartMonth: formData.hasRentalIncome
        ? parseInt(formData.rentalIncomeStartMonth) || 1
        : null,
      rentalIncomeEndYear: formData.hasRentalIncome
        ? parseInt(formData.rentalIncomeEndYear)
        : null,
      rentalIncomeEndMonth: formData.hasRentalIncome
        ? parseInt(formData.rentalIncomeEndMonth) || 12
        : null,
      convertToPension: formData.convertToPension,
      pensionStartYear: formData.convertToPension
        ? parseInt(formData.pensionStartYear)
        : null,
      pensionStartMonth: formData.convertToPension
        ? parseInt(formData.pensionStartMonth) || 1
        : null,
      pensionEndYear: formData.convertToPension
        ? parseInt(formData.pensionEndYear)
        : null,
      pensionEndMonth: formData.convertToPension
        ? parseInt(formData.pensionEndMonth) || 12
        : null,
      monthlyPensionAmount: formData.convertToPension
        ? parseInt(formData.monthlyPensionAmount)
        : null,
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
      realEstateData.id = editData.id;
    }

    await onSave(realEstateData);
    // 모달 닫기는 외부에서 처리 (SimulationCompareModal에서 onClose를 호출)
    if (!editData) {
      handleClose(); // 추가 모드일 때만 닫기
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {editData ? "부동산 수정" : "부동산 추가"}
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>

        <form
          id="realEstateForm"
          className={styles.form}
          onSubmit={handleSubmit}
        >
          {/* 거주용 여부 */}
          <div className={styles.field}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isResidential}
                onChange={(e) =>
                  setFormData({ ...formData, isResidential: e.target.checked })
                }
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>거주용</span>
            </label>
            {formData.isResidential && (
              <div className={styles.helperText}>
                거주용 부동산은 양도세가 자동으로 계산됩니다
              </div>
            )}
          </div>

          {/* 부동산명 */}
          <div className={styles.field}>
            <label className={styles.label}>항목명 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className={`${styles.input} ${errors.title ? styles.error : ""}`}
              placeholder="예: 아파트, 빌라, 상가"
            />
            {errors.title && (
              <span className={styles.errorText}>{errors.title}</span>
            )}
          </div>

          {/* 올해 이전에 취득 */}
          <div className={styles.field}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.hasAcquisitionInfo}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hasAcquisitionInfo: e.target.checked,
                  })
                }
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>
                취득금액/취득시점 입력{" "}
              </span>
            </label>
          </div>

          {/* 취득가액, 취득일자 (양도세 계산용) - 올해 이전에 취득 체크 시 표시 */}
          {formData.hasAcquisitionInfo && (
            <div className={styles.optionalSection}>
              <div className={styles.optionalSectionHeader}>
                <span className={styles.optionalSectionLabel}>
                  양도세 계산용 (선택사항)
                </span>
              </div>
              <div className={styles.fieldGrid}>
                {/* 취득가액 */}
                <div className={styles.field}>
                  <label className={styles.label}>취득가액 (만원)</label>
                  <input
                    type="text"
                    value={formData.acquisitionPrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        acquisitionPrice: e.target.value,
                      })
                    }
                    onKeyPress={handleKeyPress}
                    className={styles.input}
                    placeholder="예: 40000"
                  />
                  {formData.acquisitionPrice &&
                    !isNaN(parseInt(formData.acquisitionPrice)) && (
                      <div className={styles.amountPreview}>
                        {formatAmountForChart(
                          parseInt(formData.acquisitionPrice)
                        )}
                      </div>
                    )}
                </div>

                {/* 취득일자 */}
                <div className={styles.field}>
                  <label className={styles.label}>취득일자 (년도)</label>
                  <input
                    type="text"
                    value={formData.acquisitionYear}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        acquisitionYear: e.target.value,
                      })
                    }
                    onKeyPress={handleKeyPress}
                    className={styles.input}
                    placeholder="예: 2020"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 가치 및 상승률 */}
          <div className={styles.row}>
            <div className={styles.field}>
              <div className={styles.endYearWrapper}>
                <label className={styles.label}>부동산 가치 (만원) *</label>
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
                placeholder="예: 50000"
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
                placeholder="2.4"
              />
              {errors.growthRate && (
                <span className={styles.errorText}>{errors.growthRate}</span>
              )}
            </div>
          </div>

          {/* 보유 기간 */}
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

          {/* 임대 소득 여부 */}
          <div className={styles.field} style={{ marginTop: "1.5rem" }}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.hasRentalIncome}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setFormData({
                    ...formData,
                    hasRentalIncome: isChecked,
                    // 체크 시 자동으로 임대 시작/종료 연·월을 부동산 보유 기간으로 설정
                    rentalIncomeStartYear:
                      isChecked && !formData.rentalIncomeStartYear
                        ? formData.startYear || new Date().getFullYear()
                        : formData.rentalIncomeStartYear,
                    rentalIncomeStartMonth:
                      isChecked && !formData.rentalIncomeStartMonth
                        ? formData.startMonth || 1
                        : formData.rentalIncomeStartMonth || 1,
                    rentalIncomeEndYear:
                      isChecked && !formData.rentalIncomeEndYear
                        ? formData.endYear || new Date().getFullYear() + 30
                        : formData.rentalIncomeEndYear,
                    rentalIncomeEndMonth:
                      isChecked && !formData.rentalIncomeEndMonth
                        ? formData.endMonth || 12
                        : formData.rentalIncomeEndMonth || 12,
                  });
                }}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>
                임대용 부동산으로 처리
              </span>
            </label>
          </div>

          {/* 임대 소득 관련 필드들 */}
          {formData.hasRentalIncome && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>월 임대 소득 (만원)</label>
                <input
                  type="text"
                  value={formData.monthlyRentalIncome}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      monthlyRentalIncome: e.target.value,
                    })
                  }
                  onKeyPress={handleKeyPress}
                  className={`${styles.input} ${
                    errors.monthlyRentalIncome ? styles.error : ""
                  }`}
                  placeholder="예: 100"
                />
                {formData.monthlyRentalIncome &&
                  !isNaN(parseInt(formData.monthlyRentalIncome)) && (
                    <div className={styles.amountPreview}>
                      {formatAmountForChart(
                        parseInt(formData.monthlyRentalIncome)
                      )}
                    </div>
                  )}
                {errors.monthlyRentalIncome && (
                  <span className={styles.errorText}>
                    {errors.monthlyRentalIncome}
                  </span>
                )}
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>임대 소득 시작년도</label>
                  <input
                    type="text"
                    value={formData.rentalIncomeStartYear}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rentalIncomeStartYear: e.target.value,
                      })
                    }
                    onKeyPress={handleKeyPress}
                    className={`${styles.input} ${
                      errors.rentalIncomeStartYear ? styles.error : ""
                    }`}
                    placeholder="예: 2025"
                  />
                  {formData.rentalIncomeStartYear &&
                    profileData &&
                    profileData.birthYear && (
                      <div className={styles.agePreview}>
                        {calculateKoreanAge(
                          profileData.birthYear,
                          formData.rentalIncomeStartYear
                        )}
                        세
                      </div>
                    )}
                  {errors.rentalIncomeStartYear && (
                    <span className={styles.errorText}>
                      {errors.rentalIncomeStartYear}
                    </span>
                  )}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>시작 월</label>
                  <select
                    value={formData.rentalIncomeStartMonth}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rentalIncomeStartMonth: parseInt(e.target.value) || 1,
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
                  <label className={styles.label}>임대 소득 종료년도</label>
                  <input
                    type="text"
                    value={formData.rentalIncomeEndYear}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rentalIncomeEndYear: e.target.value,
                      })
                    }
                    onKeyPress={handleKeyPress}
                    className={`${styles.input} ${
                      errors.rentalIncomeEndYear ? styles.error : ""
                    }`}
                    placeholder="예: 2083"
                  />
                  {formData.rentalIncomeEndYear &&
                    profileData &&
                    profileData.birthYear && (
                      <div className={styles.agePreview}>
                        {calculateKoreanAge(
                          profileData.birthYear,
                          formData.rentalIncomeEndYear
                        )}
                        세
                      </div>
                    )}
                  {errors.rentalIncomeEndYear && (
                    <span className={styles.errorText}>
                      {errors.rentalIncomeEndYear}
                    </span>
                  )}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>종료 월</label>
                  <select
                    value={formData.rentalIncomeEndMonth}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rentalIncomeEndMonth: parseInt(e.target.value) || 12,
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
            </>
          )}

          {/* 주택연금 전환 여부 */}
          <div className={styles.field} style={{ marginTop: "1.5rem" }}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.convertToPension}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    convertToPension: e.target.checked,
                  })
                }
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>주택연금 적용</span>
            </label>
          </div>

          {/* 주택연금 관련 필드들 */}
          {formData.convertToPension && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>월 수령액 (만원)</label>
                <input
                  type="text"
                  value={formData.monthlyPensionAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      monthlyPensionAmount: e.target.value,
                    })
                  }
                  onKeyPress={handleKeyPress}
                  className={`${styles.input} ${
                    errors.monthlyPensionAmount ? styles.error : ""
                  }`}
                  placeholder="예: 200"
                />
                {formData.monthlyPensionAmount &&
                  !isNaN(parseInt(formData.monthlyPensionAmount)) && (
                    <div className={styles.amountPreview}>
                      {formatAmountForChart(
                        parseInt(formData.monthlyPensionAmount)
                      )}
                    </div>
                  )}
                {errors.monthlyPensionAmount && (
                  <span className={styles.errorText}>
                    {errors.monthlyPensionAmount}
                  </span>
                )}
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>주택연금 수령 시작년도</label>
                  <input
                    type="text"
                    value={formData.pensionStartYear}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pensionStartYear: e.target.value,
                      })
                    }
                    onKeyPress={handleKeyPress}
                    className={`${styles.input} ${
                      errors.pensionStartYear ? styles.error : ""
                    }`}
                    placeholder="예: 2035"
                  />
                  {formData.pensionStartYear && profileData?.birthYear && (
                    <div className={styles.agePreview}>
                      {calculateKoreanAge(
                        profileData.birthYear,
                        formData.pensionStartYear
                      )}
                      세
                    </div>
                  )}
                  {errors.pensionStartYear && (
                    <span className={styles.errorText}>
                      {errors.pensionStartYear}
                    </span>
                  )}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>시작 월</label>
                  <select
                    value={formData.pensionStartMonth}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pensionStartMonth: parseInt(e.target.value) || 1,
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
                  <label className={styles.label}>주택연금 수령 종료년도</label>
                  <input
                    type="text"
                    value={formData.pensionEndYear}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pensionEndYear: e.target.value,
                      })
                    }
                    onKeyPress={handleKeyPress}
                    className={`${styles.input} ${
                      errors.pensionEndYear ? styles.error : ""
                    }`}
                    placeholder="예: 2055"
                  />
                  {formData.pensionEndYear && profileData?.birthYear && (
                    <div className={styles.agePreview}>
                      {calculateKoreanAge(
                        profileData.birthYear,
                        formData.pensionEndYear
                      )}
                      세
                    </div>
                  )}
                  {errors.pensionEndYear && (
                    <span className={styles.errorText}>
                      {errors.pensionEndYear}
                    </span>
                  )}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>종료 월</label>
                  <select
                    value={formData.pensionEndMonth}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pensionEndMonth: parseInt(e.target.value) || 12,
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
            </>
          )}

          {/* 메모 */}
          <div className={styles.field} style={{ marginTop: "1.5rem" }}>
            <label className={styles.label}>비고</label>
            <textarea
              value={formData.memo}
              onChange={(e) =>
                setFormData({ ...formData, memo: e.target.value })
              }
              className={styles.textarea}
              placeholder="추가 정보를 입력하세요"
              rows={3}
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
          <button
            type="submit"
            form="realEstateForm"
            className={styles.saveButton}
          >
            {editData ? "수정" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RealEstateModal;
