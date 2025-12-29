import React, { useState, useEffect } from "react";
import { calculateKoreanAge } from "../../utils/koreanAge";
import {
  profileService,
  incomeService,
  savingsService,
  expenseService,
  pensionService,
} from "../../services/firestoreService";
import { simulationService } from "../../services/simulationService";
import { formatAmountForChart } from "../../utils/format";
import styles from "./ProfileEditModal.module.css";

/**
 * 프로필 수정 모달
 * 사용자의 기본 정보를 수정할 수 있습니다.
 */
function ProfileEditModal({
  isOpen,
  onClose,
  profileData,
  onSave,
  activeSimulationId,
  simulations = [],
}) {
  const [formData, setFormData] = useState({
    name: "",
    birthYear: "",
    retirementAge: 55,
    targetAssets: "",
    currentCash: "",
    status: "sample", // 프로필 상태 (샘플/제작중/상담 전/상담 후)
    hasSpouse: false,
    spouseName: "",
    spouseBirthYear: "",
    spouseIsWorking: false,
    spouseCurrentSalary: "",
    spouseRetirementAge: "",
    children: [], // 자녀 배열
    parents: [], // 부모 배열
    otherFamilyMembers: [], // 기타 가구원 배열
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 모달이 열릴 때 프로필 데이터 로드
  useEffect(() => {
    if (isOpen && profileData) {
      // familyMembers를 자녀, 부모, 기타로 분리
      const children = [];
      const parents = [];
      const others = [];

      if (profileData.familyMembers) {
        profileData.familyMembers.forEach((member) => {
          const relationship = member.relationship || member.relation;
          if (relationship === "자녀") {
            children.push({
              id: member.id || Date.now() + Math.random(),
              name: member.name,
              birthYear: member.birthYear,
              gender: member.gender || "아들",
            });
          } else if (relationship === "부" || relationship === "모") {
            parents.push({
              id: member.id || Date.now() + Math.random(),
              name: member.name,
              birthYear: member.birthYear,
              relation: relationship,
            });
          } else {
            others.push({
              id: member.id || Date.now() + Math.random(),
              name: member.name,
              birthYear: member.birthYear,
              relationship: relationship || "기타",
            });
          }
        });
      }

      setFormData({
        name: profileData.name || "",
        birthYear: profileData.birthYear || "",
        retirementAge: profileData.retirementAge || 55,
        targetAssets: profileData.targetAssets || "",
        currentCash: profileData.currentCash || "",
        status: profileData.status || "sample", // 기본값: 샘플
        hasSpouse: profileData.hasSpouse || false,
        spouseName: profileData.spouseName || "",
        spouseBirthYear: profileData.spouseBirthYear || "",
        spouseIsWorking: Boolean(profileData.spouseIsWorking),
        spouseCurrentSalary: profileData.spouseCurrentSalary || "",
        spouseRetirementAge: profileData.spouseRetirementAge || "",
        children,
        parents,
        otherFamilyMembers: others,
      });
    }
  }, [isOpen, profileData]);

  // ESC 키로 모달 닫기 + body 스크롤 막기
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // 배우자 추가
  const addSpouse = () => {
    setFormData((prev) => ({
      ...prev,
      hasSpouse: true,
      spouseName: "",
      spouseBirthYear: "",
      spouseIsWorking: false,
      spouseCurrentSalary: "",
      spouseRetirementAge: "",
    }));
  };

  // 배우자 제거
  const removeSpouse = () => {
    setFormData((prev) => ({
      ...prev,
      hasSpouse: false,
      spouseName: "",
      spouseBirthYear: "",
      spouseIsWorking: false,
      spouseCurrentSalary: "",
      spouseRetirementAge: "",
    }));
  };

  // 자녀 추가
  const addChild = () => {
    setFormData((prev) => ({
      ...prev,
      children: [
        ...prev.children,
        { id: Date.now(), name: "", birthYear: "", gender: "아들" },
      ],
    }));
  };

  // 자녀 제거
  const removeChild = (id) => {
    setFormData((prev) => ({
      ...prev,
      children: prev.children.filter((child) => child.id !== id),
    }));
  };

  // 자녀 정보 변경
  const handleChildChange = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      children: prev.children.map((child) =>
        child.id === id ? { ...child, [field]: value } : child
      ),
    }));
  };

  // 부모 추가
  const addParent = () => {
    setFormData((prev) => ({
      ...prev,
      parents: [
        ...prev.parents,
        { id: Date.now(), name: "", birthYear: "", relation: "부" },
      ],
    }));
  };

  // 부모 제거
  const removeParent = (id) => {
    setFormData((prev) => ({
      ...prev,
      parents: prev.parents.filter((parent) => parent.id !== id),
    }));
  };

  // 부모 정보 변경
  const handleParentChange = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      parents: prev.parents.map((parent) =>
        parent.id === id ? { ...parent, [field]: value } : parent
      ),
    }));
  };

  // 기타 가구원 추가
  const addOtherMember = () => {
    setFormData((prev) => ({
      ...prev,
      otherFamilyMembers: [
        ...prev.otherFamilyMembers,
        { id: Date.now(), name: "", birthYear: "", relationship: "기타" },
      ],
    }));
  };

  // 기타 가구원 제거
  const removeOtherMember = (id) => {
    setFormData((prev) => ({
      ...prev,
      otherFamilyMembers: prev.otherFamilyMembers.filter(
        (member) => member.id !== id
      ),
    }));
  };

  // 기타 가구원 정보 변경
  const handleOtherMemberChange = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      otherFamilyMembers: prev.otherFamilyMembers.map((member) =>
        member.id === id ? { ...member, [field]: value } : member
      ),
    }));
  };

  // 폼 검증
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "이름을 입력해주세요.";
    }

    if (
      !formData.birthYear ||
      formData.birthYear < 1900 ||
      formData.birthYear > new Date().getFullYear()
    ) {
      newErrors.birthYear = "올바른 출생년도를 입력해주세요.";
    }

    const retirementAgeNum =
      typeof formData.retirementAge === "string" &&
      formData.retirementAge === ""
        ? null
        : parseInt(formData.retirementAge, 10);
    if (!retirementAgeNum || retirementAgeNum < 30 || retirementAgeNum > 80) {
      newErrors.retirementAge = "은퇴 나이는 30-80세 사이여야 합니다.";
    }

    if (formData.targetAssets && formData.targetAssets < 0) {
      newErrors.targetAssets = "목표 자산은 0 이상이어야 합니다.";
    }

    if (formData.currentCash && formData.currentCash < 0) {
      newErrors.currentCash = "현재 현금은 0 이상이어야 합니다.";
    }

    // 배우자가 있는 경우 검증
    if (formData.hasSpouse) {
      if (!formData.spouseName.trim()) {
        newErrors.spouseName = "배우자 이름을 입력해주세요.";
      }
      if (
        !formData.spouseBirthYear ||
        formData.spouseBirthYear < 1900 ||
        formData.spouseBirthYear > new Date().getFullYear()
      ) {
        newErrors.spouseBirthYear = "올바른 배우자 출생년도를 입력해주세요.";
      }

      // 배우자 근로 정보 검증
      if (formData.spouseIsWorking) {
        if (
          !formData.spouseRetirementAge ||
          formData.spouseRetirementAge < 30 ||
          formData.spouseRetirementAge > 80
        ) {
          newErrors.spouseRetirementAge =
            "배우자 은퇴 예상 나이는 30세에서 80세 사이여야 합니다.";
        }
      }
    }

    // 자녀 정보 검증
    formData.children.forEach((child, index) => {
      if (child.name.trim() && !child.birthYear) {
        newErrors[`child${index}BirthYear`] = "자녀 출생년도를 입력해주세요.";
      }
      if (!child.name.trim() && child.birthYear) {
        newErrors[`child${index}Name`] = "자녀 이름을 입력해주세요.";
      }
      if (child.birthYear) {
        const childBirthYear = parseInt(child.birthYear);
        const currentYear = new Date().getFullYear();
        if (childBirthYear < 1900 || childBirthYear > currentYear) {
          newErrors[`child${index}BirthYear`] =
            "올바른 자녀 출생년도를 입력해주세요.";
        }
      }
    });

    // 부모 정보 검증
    formData.parents.forEach((parent, index) => {
      if (parent.name.trim() && !parent.birthYear) {
        newErrors[`parent${index}BirthYear`] =
          "부모 출생년도를 입력해주세요.";
      }
      if (!parent.name.trim() && parent.birthYear) {
        newErrors[`parent${index}Name`] = "부모 이름을 입력해주세요.";
      }
      if (parent.birthYear) {
        const parentBirthYear = parseInt(parent.birthYear);
        const currentYear = new Date().getFullYear();
        if (parentBirthYear < 1900 || parentBirthYear > currentYear) {
          newErrors[`parent${index}BirthYear`] =
            "올바른 부모 출생년도를 입력해주세요.";
        }
      }
    });

    // 기타 가구원 정보 검증
    formData.otherFamilyMembers.forEach((member, index) => {
      if (member.name.trim() && !member.birthYear) {
        newErrors[`other${index}BirthYear`] =
          "가구원 출생년도를 입력해주세요.";
      }
      if (!member.name.trim() && member.birthYear) {
        newErrors[`other${index}Name`] = "가구원 이름을 입력해주세요.";
      }
      if (member.birthYear) {
        const memberBirthYear = parseInt(member.birthYear);
        const currentYear = new Date().getFullYear();
        if (memberBirthYear < 1900 || memberBirthYear > currentYear) {
          newErrors[`other${index}BirthYear`] =
            "올바른 가구원 출생년도를 입력해주세요.";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 은퇴년도 계산 함수
  const getRetirementYear = (birthYear, retirementAge) => {
    const currentYear = new Date().getFullYear();
    if (birthYear && retirementAge) {
      const birth = parseInt(birthYear, 10);
      const retireAge = parseInt(retirementAge, 10);
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

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // 가구 구성원 정보 정리
      const familyMembers = [];

      // 자녀 추가
      formData.children.forEach((child) => {
        if (child.name.trim() && child.birthYear) {
          familyMembers.push({
            name: child.name,
            birthYear: parseInt(child.birthYear),
            relationship: "자녀",
            gender: child.gender || "아들",
          });
        }
      });

      // 부모 추가
      formData.parents.forEach((parent) => {
        if (parent.name.trim() && parent.birthYear) {
          familyMembers.push({
            name: parent.name,
            birthYear: parseInt(parent.birthYear),
            relationship: parent.relation === "부" ? "부" : "모",
          });
        }
      });

      // 기타 가구원 추가
      formData.otherFamilyMembers.forEach((member) => {
        if (member.name.trim() && member.birthYear) {
          familyMembers.push({
            name: member.name,
            birthYear: parseInt(member.birthYear),
            relationship: member.relationship,
          });
        }
      });

      // retirementAge 계산 (로컬 state 업데이트용, DB에는 저장 안함)
      const retirementAgeNum =
        typeof formData.retirementAge === "string" &&
        formData.retirementAge === ""
          ? 55
          : parseInt(formData.retirementAge, 10) || 55;

      const updatedProfile = {
        ...profileData,
        name: formData.name.trim(),
        birthYear: parseInt(formData.birthYear),
        retirementAge: retirementAgeNum, // 로컬 state만 업데이트 (DB 저장 안함)
        currentCash: parseInt(formData.currentCash) || 0,
        targetAssets: parseInt(formData.targetAssets) || 0,
        status: formData.status || "sample", // 프로필 상태 저장
        currentKoreanAge: calculateKoreanAge(formData.birthYear),
        hasSpouse: formData.hasSpouse,
        spouseName: formData.hasSpouse ? formData.spouseName : "",
        spouseBirthYear: formData.hasSpouse
          ? parseInt(formData.spouseBirthYear)
          : "",
        spouseIsWorking: formData.hasSpouse ? formData.spouseIsWorking : false,
        spouseRetirementAge:
          formData.hasSpouse && formData.spouseIsWorking
            ? parseInt(formData.spouseRetirementAge) || 0
            : 0,
        familyMembers,
        updatedAt: new Date().toISOString(),
      };

      // 은퇴년도 또는 출생년도가 변경되었는지 확인
      const retirementAgeChanged =
        profileData.retirementAge !== retirementAgeNum;
      const birthYearChanged = profileData.birthYear !== parseInt(formData.birthYear);

      // 배우자 은퇴 나이 계산
      const spouseRetirementAgeNum =
        formData.hasSpouse && formData.spouseIsWorking
          ? parseInt(formData.spouseRetirementAge) || 0
          : 0;

      // 배우자 은퇴년도 또는 배우자 출생년도가 변경되었는지 확인
      const spouseRetirementAgeChanged =
        profileData.spouseRetirementAge !== spouseRetirementAgeNum;
      const spouseBirthYearChanged =
        profileData.spouseBirthYear !== parseInt(formData.spouseBirthYear);

      // 현재 시뮬레이션이 기본 시뮬레이션(현재)인지 확인
      const currentSimulation = simulations.find(
        (sim) => sim.id === activeSimulationId
      );
      const isDefaultSimulation = currentSimulation?.isDefault === true;

      // 프로필 DB 업데이트
      // 기본 시뮬레이션인 경우만 retirementAge 포함, 아니면 제외
      const profileForDB = isDefaultSimulation
        ? updatedProfile
        : (() => {
            const { retirementAge: _, ...rest } = updatedProfile;
            return rest;
          })();

      await profileService.updateProfile(
        profileData.id || profileData.docId,
        profileForDB
      );

      // 은퇴년도가 변경된 경우, 고정된 소득/저축/지출/연금 항목들의 endYear 및 시뮬레이션 retirementYear 업데이트
      if (retirementAgeChanged || birthYearChanged) {
        try {
          const retirementAgeForCalc =
            typeof formData.retirementAge === "string" &&
            formData.retirementAge === ""
              ? profileData.retirementAge || 55
              : parseInt(formData.retirementAge, 10) ||
                profileData.retirementAge ||
                55;
          const newRetirementYear = getRetirementYear(
            formData.birthYear,
            retirementAgeForCalc
          );

          // 소득, 저축, 지출, 연금 항목을 병렬로 업데이트
          const [incomeCount, savingCount, expenseCount, pensionCount] =
            await Promise.all([
              incomeService.updateFixedIncomesEndYear(
                profileData.id || profileData.docId,
                newRetirementYear
              ),
              savingsService.updateFixedSavingsEndYear(
                profileData.id || profileData.docId,
                newRetirementYear
              ),
              expenseService.updateFixedExpensesEndYear(
                profileData.id || profileData.docId,
                newRetirementYear
              ),
              pensionService.updateFixedPensionsEndYear(
                profileData.id || profileData.docId,
                newRetirementYear
              ),
            ]);

          const totalUpdated =
            incomeCount + savingCount + expenseCount + pensionCount;
          if (totalUpdated > 0) {
            console.log(
              `${totalUpdated}개의 고정된 항목이 자동으로 업데이트되었습니다. (소득: ${incomeCount}, 저축: ${savingCount}, 지출: ${expenseCount}, 연금: ${pensionCount})`
            );
          }

          // 현재 활성화된 시뮬레이션의 retirementYear만 업데이트
          if (activeSimulationId) {
            await simulationService.updateRetirementYear(
              profileData.id || profileData.docId,
              activeSimulationId,
              newRetirementYear
            );
          }
        } catch (error) {
          console.error("고정된 항목 업데이트 오류:", error);
          // 항목 업데이트 실패해도 프로필 업데이트는 성공으로 처리
        }
      }

      // 배우자 은퇴년도가 변경된 경우, 현재 시뮬레이션의 spouseRetirementYear 업데이트
      if (
        (spouseRetirementAgeChanged || spouseBirthYearChanged) &&
        formData.hasSpouse &&
        formData.spouseIsWorking &&
        activeSimulationId
      ) {
        try {
          const newSpouseRetirementYear = getRetirementYear(
            formData.spouseBirthYear,
            formData.spouseRetirementAge
          );

          await simulationService.updateSpouseRetirementYear(
            profileData.id || profileData.docId,
            activeSimulationId,
            newSpouseRetirementYear
          );
        } catch (error) {
          console.error("배우자 은퇴년도 업데이트 오류:", error);
          // 업데이트 실패해도 프로필 업데이트는 성공으로 처리
        }
      }

      onSave(updatedProfile);
      onClose();
    } catch (error) {
      console.error("프로필 수정 오류:", error);
      alert("프로필 수정 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* 헤더 */}
        <div className={styles.header}>
          <h2 className={styles.title}>프로필 수정</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {errors.form && (
            <div className={styles.errorBanner}>{errors.form}</div>
          )}

          {/* 프로필 상태 선택 (최상단) */}
          <div className={styles.statusSection}>
            <label htmlFor="status" className={styles.statusLabel}>
              프로필 상태
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className={styles.statusSelect}
              disabled={isSubmitting}
            >
              <option value="sample">샘플</option>
              <option value="inProgress">제작중</option>
              <option value="beforeConsult">상담 전</option>
              <option value="afterConsult">상담 후</option>
            </select>
          </div>

          <div className={styles.twoColumnLayout}>
            {/* 왼쪽: 기본 정보 */}
            <div className={styles.leftColumn}>
              <h3 className={styles.columnTitle}>기본 정보</h3>

              {/* 이름, 출생년도 */}
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="name" className={styles.label}>
                    이름 *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={`${styles.input} ${
                      errors.name ? styles.inputError : ""
                    }`}
                    placeholder="홍길동"
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <span className={styles.errorText}>{errors.name}</span>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor="birthYear" className={styles.label}>
                    출생년도 * (현재 만 나이:{" "}
                    {formData.birthYear
                      ? calculateKoreanAge(parseInt(formData.birthYear))
                      : "?"}
                    세)
                  </label>
                  <input
                    type="text"
                    id="birthYear"
                    name="birthYear"
                    value={formData.birthYear}
                    onChange={(e) =>
                      setFormData({ ...formData, birthYear: e.target.value })
                    }
                    className={`${styles.input} ${
                      errors.birthYear ? styles.inputError : ""
                    }`}
                    placeholder="1990"
                    disabled={isSubmitting}
                    onKeyPress={(e) => {
                      if (!/[0-9]/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                  {errors.birthYear && (
                    <span className={styles.errorText}>{errors.birthYear}</span>
                  )}
                </div>
              </div>

              {/* 은퇴 나이, 목표 자산 */}
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="retirementAge" className={styles.label}>
                    은퇴 목표 연령 * (은퇴년도:{" "}
                    {formData.birthYear && formData.retirementAge
                      ? (() => {
                          const currentYear = new Date().getFullYear();
                          const birth = parseInt(formData.birthYear, 10);
                          const retireAge = parseInt(
                            formData.retirementAge,
                            10
                          );
                          if (
                            Number.isFinite(birth) &&
                            Number.isFinite(retireAge)
                          ) {
                            const currentAge = currentYear - birth;
                            const yearsToRetire = retireAge - currentAge;
                            return (
                              currentYear +
                              (Number.isFinite(yearsToRetire)
                                ? yearsToRetire
                                : 0)
                            );
                          }
                          return "?";
                        })()
                      : "?"}
                    년)
                  </label>
                  <input
                    type="text"
                    id="retirementAge"
                    name="retirementAge"
                    value={formData.retirementAge}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d+$/.test(value)) {
                        setFormData({
                          ...formData,
                          retirementAge: value === "" ? "" : parseInt(value, 10),
                        });
                      }
                    }}
                    className={`${styles.input} ${
                      errors.retirementAge ? styles.inputError : ""
                    }`}
                    placeholder="55"
                    disabled={isSubmitting}
                    onKeyPress={(e) => {
                      if (!/[0-9]/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                  {errors.retirementAge && (
                    <span className={styles.errorText}>
                      {errors.retirementAge}
                    </span>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor="targetAssets" className={styles.label}>
                    은퇴 시점 목표 자산 규모 (만원) *
                  </label>
                  <input
                    type="text"
                    id="targetAssets"
                    name="targetAssets"
                    value={formData.targetAssets}
                    onChange={(e) =>
                      setFormData({ ...formData, targetAssets: e.target.value })
                    }
                    className={`${styles.input} ${
                      errors.targetAssets ? styles.inputError : ""
                    }`}
                    placeholder="50000"
                    disabled={isSubmitting}
                    onKeyPress={(e) => {
                      if (!/[0-9]/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                  {formData.targetAssets &&
                    !isNaN(parseInt(formData.targetAssets)) && (
                      <div className={styles.amountPreview}>
                        {formatAmountForChart(parseInt(formData.targetAssets))}
                      </div>
                    )}
                  {errors.targetAssets && (
                    <span className={styles.errorText}>
                      {errors.targetAssets}
                    </span>
                  )}
                </div>
              </div>

              {/* 현재 현금 */}
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="currentCash" className={styles.label}>
                    현재 현금 (만원)
                  </label>
                  <input
                    type="text"
                    id="currentCash"
                    name="currentCash"
                    value={formData.currentCash}
                    onChange={(e) =>
                      setFormData({ ...formData, currentCash: e.target.value })
                    }
                    className={`${styles.input} ${
                      errors.currentCash ? styles.inputError : ""
                    }`}
                    placeholder="1000"
                    disabled={isSubmitting}
                    onKeyPress={(e) => {
                      if (!/[0-9]/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                  {formData.currentCash &&
                    !isNaN(parseInt(formData.currentCash)) && (
                      <div className={styles.amountPreview}>
                        {formatAmountForChart(parseInt(formData.currentCash))}
                      </div>
                    )}
                  {errors.currentCash && (
                    <span className={styles.errorText}>
                      {errors.currentCash}
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* 오른쪽: 가족 구성원 */}
            <div className={styles.rightColumn}>
              <h3 className={styles.columnTitle}>가족 구성원</h3>

              {/* 배우자 섹션 */}
              <div className={styles.familySection}>
                <div className={styles.familySectionHeader}>
                  <h4 className={styles.familySectionTitle}>배우자</h4>
                  {!formData.hasSpouse && (
                    <button
                      type="button"
                      onClick={addSpouse}
                      className={styles.addFamilyButton}
                      disabled={isSubmitting}
                    >
                      + 추가
                    </button>
                  )}
                </div>

                {formData.hasSpouse && (
                  <div className={styles.familyMemberItem}>
                    <button
                      type="button"
                      onClick={removeSpouse}
                      className={styles.removeButton}
                      disabled={isSubmitting}
                      aria-label="배우자 삭제"
                    >
                      ×
                    </button>
                    <div className={styles.fieldGrid}>
                      <div className={styles.field}>
                        <label className={styles.label}>이름</label>
                        <input
                          type="text"
                          value={formData.spouseName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              spouseName: e.target.value,
                            })
                          }
                          className={`${styles.input} ${
                            errors.spouseName ? styles.inputError : ""
                          }`}
                          placeholder="배우자 이름"
                          disabled={isSubmitting}
                        />
                        {errors.spouseName && (
                          <span className={styles.errorText}>
                            {errors.spouseName}
                          </span>
                        )}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>
                          출생년도 (만 나이:{" "}
                          {formData.spouseBirthYear
                            ? calculateKoreanAge(
                                parseInt(formData.spouseBirthYear)
                              )
                            : "?"}
                          세)
                        </label>
                        <input
                          type="text"
                          value={formData.spouseBirthYear}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              spouseBirthYear: e.target.value,
                            })
                          }
                          className={`${styles.input} ${
                            errors.spouseBirthYear ? styles.inputError : ""
                          }`}
                          placeholder="1992"
                          disabled={isSubmitting}
                          onKeyPress={(e) => {
                            if (!/[0-9]/.test(e.key)) {
                              e.preventDefault();
                            }
                          }}
                        />
                        {errors.spouseBirthYear && (
                          <span className={styles.errorText}>
                            {errors.spouseBirthYear}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.checkboxField}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={formData.spouseIsWorking}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              spouseIsWorking: e.target.checked,
                            })
                          }
                          disabled={isSubmitting}
                        />
                        현재 일하고 있습니다
                      </label>
                    </div>

                    {formData.spouseIsWorking && (
                      <div className={styles.fieldGrid}>
                        <div className={styles.field}>
                          <label className={styles.label}>
                            은퇴 예상 나이 (만 나이)
                          </label>
                          <input
                            type="text"
                            value={formData.spouseRetirementAge}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                spouseRetirementAge: e.target.value,
                              })
                            }
                            className={`${styles.input} ${
                              errors.spouseRetirementAge ? styles.inputError : ""
                            }`}
                            placeholder="60"
                            disabled={isSubmitting}
                            onKeyPress={(e) => {
                              if (!/[0-9]/.test(e.key)) {
                                e.preventDefault();
                              }
                            }}
                          />
                          {errors.spouseRetirementAge && (
                            <span className={styles.errorText}>
                              {errors.spouseRetirementAge}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 자녀 정보 */}
              <div className={styles.familySection}>
                <div className={styles.familySectionHeader}>
                  <h4 className={styles.familySectionTitle}>자녀</h4>
                  <button
                    type="button"
                    onClick={addChild}
                    className={styles.addFamilyButton}
                    disabled={isSubmitting}
                  >
                    + 추가
                  </button>
                </div>

                {formData.children.map((child, index) => (
                  <div key={child.id} className={styles.familyMemberItem}>
                    <button
                      type="button"
                      onClick={() => removeChild(child.id)}
                      className={styles.removeButton}
                      disabled={isSubmitting}
                      aria-label={`${index + 1}째 자녀 삭제`}
                    >
                      ×
                    </button>
                    <div className={styles.fieldGrid}>
                      <div className={styles.field}>
                        <label className={styles.label}>
                          {index + 1}째 자녀 이름
                        </label>
                        <input
                          type="text"
                          value={child.name}
                          onChange={(e) =>
                            handleChildChange(child.id, "name", e.target.value)
                          }
                          className={`${styles.input} ${
                            errors[`child${index}Name`] ? styles.inputError : ""
                          }`}
                          placeholder="홍길동"
                          disabled={isSubmitting}
                        />
                        {errors[`child${index}Name`] && (
                          <span className={styles.errorText}>
                            {errors[`child${index}Name`]}
                          </span>
                        )}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>성별</label>
                        <select
                          value={child.gender || "아들"}
                          onChange={(e) =>
                            handleChildChange(child.id, "gender", e.target.value)
                          }
                          className={styles.select}
                          disabled={isSubmitting}
                        >
                          <option value="아들">아들</option>
                          <option value="딸">딸</option>
                        </select>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>
                          출생년도 (현재 만 나이:{" "}
                          {child.birthYear
                            ? calculateKoreanAge(parseInt(child.birthYear))
                            : "?"}
                          세)
                        </label>
                        <input
                          type="text"
                          value={child.birthYear}
                          onChange={(e) =>
                            handleChildChange(
                              child.id,
                              "birthYear",
                              e.target.value
                            )
                          }
                          className={`${styles.input} ${
                            errors[`child${index}BirthYear`]
                              ? styles.inputError
                              : ""
                          }`}
                          placeholder="2015"
                          disabled={isSubmitting}
                          onKeyPress={(e) => {
                            if (!/[0-9]/.test(e.key)) {
                              e.preventDefault();
                            }
                          }}
                        />
                        {errors[`child${index}BirthYear`] && (
                          <span className={styles.errorText}>
                            {errors[`child${index}BirthYear`]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 부모 정보 */}
              <div className={styles.familySection}>
                <div className={styles.familySectionHeader}>
                  <h4 className={styles.familySectionTitle}>부모</h4>
                  <button
                    type="button"
                    onClick={addParent}
                    className={styles.addFamilyButton}
                    disabled={isSubmitting}
                  >
                    + 추가
                  </button>
                </div>

                {formData.parents.map((parent, index) => (
                  <div key={parent.id} className={styles.familyMemberItem}>
                    <button
                      type="button"
                      onClick={() => removeParent(parent.id)}
                      className={styles.removeButton}
                      disabled={isSubmitting}
                      aria-label="부모 삭제"
                    >
                      ×
                    </button>
                    <div className={styles.fieldGrid}>
                      <div className={styles.field}>
                        <label className={styles.label}>부모 이름</label>
                        <input
                          type="text"
                          value={parent.name}
                          onChange={(e) =>
                            handleParentChange(
                              parent.id,
                              "name",
                              e.target.value
                            )
                          }
                          className={`${styles.input} ${
                            errors[`parent${index}Name`] ? styles.inputError : ""
                          }`}
                          placeholder="홍아무개"
                          disabled={isSubmitting}
                        />
                        {errors[`parent${index}Name`] && (
                          <span className={styles.errorText}>
                            {errors[`parent${index}Name`]}
                          </span>
                        )}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>관계</label>
                        <select
                          value={parent.relation}
                          onChange={(e) =>
                            handleParentChange(
                              parent.id,
                              "relation",
                              e.target.value
                            )
                          }
                          className={`${styles.input} ${styles.select}`}
                          disabled={isSubmitting}
                        >
                          <option value="부">부</option>
                          <option value="모">모</option>
                        </select>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>
                          출생년도 (현재 만 나이:{" "}
                          {parent.birthYear
                            ? calculateKoreanAge(parseInt(parent.birthYear))
                            : "?"}
                          세)
                        </label>
                        <input
                          type="text"
                          value={parent.birthYear}
                          onChange={(e) =>
                            handleParentChange(
                              parent.id,
                              "birthYear",
                              e.target.value
                            )
                          }
                          className={`${styles.input} ${
                            errors[`parent${index}BirthYear`]
                              ? styles.inputError
                              : ""
                          }`}
                          placeholder="1950"
                          disabled={isSubmitting}
                          onKeyPress={(e) => {
                            if (!/[0-9]/.test(e.key)) {
                              e.preventDefault();
                            }
                          }}
                        />
                        {errors[`parent${index}BirthYear`] && (
                          <span className={styles.errorText}>
                            {errors[`parent${index}BirthYear`]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 기타 가구원 정보 */}
              <div className={styles.familySection}>
                <div className={styles.familySectionHeader}>
                  <h4 className={styles.familySectionTitle}>기타 가구원</h4>
                  <button
                    type="button"
                    onClick={addOtherMember}
                    className={styles.addFamilyButton}
                    disabled={isSubmitting}
                  >
                    + 추가
                  </button>
                </div>

                {formData.otherFamilyMembers.map((member, index) => (
                  <div key={member.id} className={styles.familyMemberItem}>
                    <button
                      type="button"
                      onClick={() => removeOtherMember(member.id)}
                      className={styles.removeButton}
                      disabled={isSubmitting}
                      aria-label="기타 가구원 삭제"
                    >
                      ×
                    </button>
                    <div className={styles.fieldGrid}>
                      <div className={styles.field}>
                        <label className={styles.label}>가구원 이름</label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) =>
                            handleOtherMemberChange(
                              member.id,
                              "name",
                              e.target.value
                            )
                          }
                          className={`${styles.input} ${
                            errors[`other${index}Name`] ? styles.inputError : ""
                          }`}
                          placeholder="이름"
                          disabled={isSubmitting}
                        />
                        {errors[`other${index}Name`] && (
                          <span className={styles.errorText}>
                            {errors[`other${index}Name`]}
                          </span>
                        )}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>관계</label>
                        <select
                          value={member.relationship}
                          onChange={(e) =>
                            handleOtherMemberChange(
                              member.id,
                              "relationship",
                              e.target.value
                            )
                          }
                          className={`${styles.input} ${styles.select}`}
                          disabled={isSubmitting}
                        >
                          <option value="형제">형제</option>
                          <option value="자매">자매</option>
                          <option value="조부">조부</option>
                          <option value="조모">조모</option>
                          <option value="기타">기타</option>
                        </select>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>
                          출생년도 (현재 만 나이:{" "}
                          {member.birthYear
                            ? calculateKoreanAge(parseInt(member.birthYear))
                            : "?"}
                          세)
                        </label>
                        <input
                          type="text"
                          value={member.birthYear}
                          onChange={(e) =>
                            handleOtherMemberChange(
                              member.id,
                              "birthYear",
                              e.target.value
                            )
                          }
                          className={`${styles.input} ${
                            errors[`other${index}BirthYear`]
                              ? styles.inputError
                              : ""
                          }`}
                          placeholder="1990"
                          disabled={isSubmitting}
                          onKeyPress={(e) => {
                            if (!/[0-9]/.test(e.key)) {
                              e.preventDefault();
                            }
                          }}
                        />
                        {errors[`other${index}BirthYear`] && (
                          <span className={styles.errorText}>
                            {errors[`other${index}BirthYear`]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* 수정 버튼 (모달 하단 고정) */}
        <div className={styles.submitButtonContainer}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "수정 중..." : "수정"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileEditModal;
