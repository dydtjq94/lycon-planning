import React, { useState, useEffect } from "react";
import { financialLibraryService } from "../../services/firestoreService";
import { calculateKoreanAge } from "../../utils/koreanAge";
import styles from "./FinancialDataStorePanel.module.css";

/**
 * 재무 라이브러리 패널
 * 가족 구성원별 재무 데이터 템플릿을 Firebase에서 불러와 관리하고 추가할 수 있는 패널
 *
 * 구조:
 * - 상단: 가족 구성원 타입 탭 (본인/배우자/자녀/부모)
 * - 왼쪽: 카테고리 필터 (전체/소득/지출)
 * - 메인: 템플릿 리스트 (클릭하여 모달 열기)
 * - 관리자: 템플릿 관리 버튼
 */
function FinancialDataStorePanel({
  onSelectTemplate,
  profileData,
  onClose,
  isAdmin,
}) {
  const [templates, setTemplates] = useState([]); // 모든 템플릿
  const [loading, setLoading] = useState(true);
  const [selectedMainCategory, setSelectedMainCategory] =
    useState("income_expense"); // 메인 카테고리: income_expense, saving
  const [selectedFamilyType, setSelectedFamilyType] = useState("self"); // 선택된 가족 구성원 타입
  const [selectedSubCategory, setSelectedSubCategory] = useState("all"); // 소득/지출 내 세부 카테고리
  const [selectedFamilyMember, setSelectedFamilyMember] = useState(null); // 선택된 가족 구성원 (자녀/부모)

  // 메인 카테고리 목록
  const mainCategories = [
    { value: "income_expense", label: "소득/지출" },
    { value: "saving", label: "저축/투자" },
    { value: "pension", label: "연금" },
  ];

  // 소득/지출 세부 카테고리
  const subCategories = [
    { value: "all", label: "전체" },
    { value: "income", label: "소득" },
    { value: "expense", label: "지출" },
  ];

  // 가족 구성원 타입 목록
  const familyTypes = [
    { value: "self", label: "본인" },
    { value: "spouse", label: "배우자" },
    { value: "son", label: "아들" },
    { value: "daughter", label: "딸" },
    { value: "father", label: "부" },
    { value: "mother", label: "모" },
  ];

  // 템플릿 불러오기
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);

      // Firebase에서 템플릿 조회
      const allTemplates = await financialLibraryService.getTemplates();

      // 템플릿이 없으면 기본 템플릿 초기화
      if (allTemplates.length === 0) {
        await financialLibraryService.initializeDefaultTemplates();
        const newTemplates = await financialLibraryService.getTemplates();
        setTemplates(newTemplates);
      } else {
        setTemplates(allTemplates);
      }
    } catch (error) {
      console.error("템플릿 로딩 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  // 필터링된 템플릿 가져오기
  const getFilteredTemplates = () => {
    return templates.filter((template) => {
      // 메인 카테고리 필터
      if (selectedMainCategory === "income_expense") {
        // 소득/지출 선택 시: saving 카테고리 제외
        if (template.category === "saving") {
          return false;
        }

        // 가족 구성원 타입 필터 (배열 또는 단일 값 처리)
        const memberType = template.familyMemberType;
        if (Array.isArray(memberType)) {
          // 배열인 경우: 선택된 타입이 배열에 포함되어 있는지 확인
          if (!memberType.includes(selectedFamilyType)) {
            return false;
          }
        } else {
          // 단일 값인 경우 (하위 호환성)
          if (memberType !== selectedFamilyType) {
            return false;
          }
        }

        // 세부 카테고리 필터 (소득/지출 내에서)
        if (
          selectedSubCategory !== "all" &&
          template.category !== selectedSubCategory
        ) {
          return false;
        }
      } else if (selectedMainCategory === "saving") {
        // 저축/투자 선택 시: saving 카테고리만 표시
        if (template.category !== "saving") {
          return false;
        }
      } else if (selectedMainCategory === "pension") {
        // 연금 선택 시: pension 카테고리만 표시
        if (template.category !== "pension") {
          return false;
        }
      }

      return true;
    });
  };

  // 카테고리별로 템플릿 그룹화
  const groupTemplatesByCategory = () => {
    const filtered = getFilteredTemplates();
    const grouped = {};

    filtered.forEach((template) => {
      const category = template.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(template);
    });

    return grouped;
  };

  // 카테고리 이름 변환
  const getCategoryLabel = (category) => {
    if (category === "income") return "소득";
    if (category === "expense") return "지출";
    if (category === "saving") return "저축/투자";
    if (category === "pension") return "연금";
    return category;
  };

  // 가족 구성원 타입이 변경되면 첫 번째 구성원 자동 선택
  useEffect(() => {
    const members = getAvailableFamilyMembers();
    if (members.length > 0) {
      setSelectedFamilyMember(members[0]); // 첫 번째 구성원 선택
    } else {
      setSelectedFamilyMember(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFamilyType]);

  // 프로필 데이터가 변경되면 선택된 타입이 유효한지 확인
  useEffect(() => {
    if (profileData) {
      const available = getAvailableFamilyTypes();
      const isCurrentTypeAvailable = available.some(
        (t) => t.value === selectedFamilyType
      );

      // 현재 선택된 타입이 없으면 첫 번째 타입으로 변경
      if (!isCurrentTypeAvailable && available.length > 0) {
        setSelectedFamilyType(available[0].value);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileData]);

  // 현재 선택된 타입에 해당하는 가족 구성원 목록 가져오기
  const getAvailableFamilyMembers = () => {
    if (!profileData || !profileData.familyMembers) return [];

    if (selectedFamilyType === "son") {
      // 아들만 필터링
      return profileData.familyMembers.filter(
        (m) => m.relationship === "자녀" && m.gender === "아들"
      );
    } else if (selectedFamilyType === "daughter") {
      // 딸만 필터링
      return profileData.familyMembers.filter(
        (m) => m.relationship === "자녀" && m.gender === "딸"
      );
    } else if (selectedFamilyType === "father") {
      // 부만 필터링
      return profileData.familyMembers.filter((m) => m.relationship === "부");
    } else if (selectedFamilyType === "mother") {
      // 모만 필터링
      return profileData.familyMembers.filter((m) => m.relationship === "모");
    }
    return [];
  };

  // 템플릿 클릭 시 데이터 준비하여 모달 열기
  const handleSelectTemplate = (template) => {
    const currentYear = new Date().getFullYear();
    const { category, data, ageStart, ageEnd, familyMemberType } = template;

    // 저축/투자 카테고리일 때는 나이 기반 계산 없이 그대로 전달
    if (category === "saving") {
      const templateData = {
        category,
        ...data, // 저축/투자 모달의 모든 필드를 그대로 전달
        title: template.title, // 템플릿 제목 그대로 사용
      };

      onSelectTemplate(templateData);
      return;
    }

    // 연금 카테고리일 때도 저축/투자와 동일하게 처리
    if (category === "pension") {
      const templateData = {
        category,
        ...data, // 연금 모달의 모든 필드를 그대로 전달
        title: template.title, // 템플릿 제목 그대로 사용
      };

      onSelectTemplate(templateData);
      return;
    }

    // 소득/지출일 때는 기존 로직: 나이 기반 계산
    // 중요: 사용자가 선택한 탭(selectedFamilyType)을 사용하여 정확한 가족 구성원의 나이로 계산
    const memberType = selectedFamilyType;

    // 나이 범위가 있는 경우 startYear/endYear 자동 계산
    let startYear = currentYear;
    let endYear = currentYear + 30;
    let targetMemberName = ""; // 적용 대상 이름

    // 가족 구성원의 출생년도를 기반으로 계산
    if (ageStart !== null && ageEnd !== null) {
      if (memberType === "self" && profileData.birthYear) {
        const currentAge = calculateKoreanAge(profileData.birthYear);
        startYear = currentYear + (ageStart - currentAge);
        endYear = currentYear + (ageEnd - currentAge);
        targetMemberName = "본인";
      } else if (memberType === "spouse" && profileData.spouseBirthYear) {
        const spouseAge = calculateKoreanAge(profileData.spouseBirthYear);
        startYear = currentYear + (ageStart - spouseAge);
        endYear = currentYear + (ageEnd - spouseAge);
        targetMemberName = "배우자";
      } else if (["son", "daughter", "father", "mother"].includes(memberType)) {
        // 선택된 가족 구성원 사용 (아들/딸/부/모)
        if (selectedFamilyMember && selectedFamilyMember.birthYear) {
          const memberAge = calculateKoreanAge(selectedFamilyMember.birthYear);
          startYear = currentYear + (ageStart - memberAge);
          endYear = currentYear + (ageEnd - memberAge);
          targetMemberName = selectedFamilyMember.name || "";
        } else {
          // 선택되지 않았으면 첫 번째 해당 구성원 사용
          let defaultMember = null;
          if (memberType === "son") {
            defaultMember = profileData.familyMembers?.find(
              (m) => m.relationship === "자녀" && m.gender === "아들"
            );
          } else if (memberType === "daughter") {
            defaultMember = profileData.familyMembers?.find(
              (m) => m.relationship === "자녀" && m.gender === "딸"
            );
          } else if (memberType === "father") {
            defaultMember = profileData.familyMembers?.find(
              (m) => m.relationship === "부"
            );
          } else if (memberType === "mother") {
            defaultMember = profileData.familyMembers?.find(
              (m) => m.relationship === "모"
            );
          }
          if (defaultMember && defaultMember.birthYear) {
            const memberAge = calculateKoreanAge(defaultMember.birthYear);
            startYear = currentYear + (ageStart - memberAge);
            endYear = currentYear + (ageEnd - memberAge);
            targetMemberName = defaultMember.name || "";
          }
        }
      }
    } else {
      // 나이 범위가 없는 경우에도 적용 대상 이름 설정
      if (memberType === "self") {
        targetMemberName = "본인";
      } else if (memberType === "spouse") {
        targetMemberName = "배우자";
      } else if (["son", "daughter", "father", "mother"].includes(memberType)) {
        if (selectedFamilyMember?.name) {
          targetMemberName = selectedFamilyMember.name;
        } else {
          // 첫 번째 해당 구성원 이름 사용
          let defaultMember = null;
          if (memberType === "son") {
            defaultMember = profileData.familyMembers?.find(
              (m) => m.relationship === "자녀" && m.gender === "아들"
            );
          } else if (memberType === "daughter") {
            defaultMember = profileData.familyMembers?.find(
              (m) => m.relationship === "자녀" && m.gender === "딸"
            );
          } else if (memberType === "father") {
            defaultMember = profileData.familyMembers?.find(
              (m) => m.relationship === "부"
            );
          } else if (memberType === "mother") {
            defaultMember = profileData.familyMembers?.find(
              (m) => m.relationship === "모"
            );
          }
          if (defaultMember?.name) {
            targetMemberName = defaultMember.name;
          }
        }
      }
    }

    // 항목 명 생성: "템플릿 이름 - 적용 대상"
    const generatedTitle = targetMemberName
      ? `${template.title} - ${targetMemberName}`
      : template.title;

    // 물가상승률/소득상승률 자동 반영
    // 템플릿의 금액은 "현재 가치" 기준이므로, 시작년도까지의 상승률을 복리로 적용
    let adjustedAmount = data.amount;
    const yearsUntilStart = startYear - currentYear;

    if (yearsUntilStart > 0) {
      // 카테고리별 상승률 설정
      const inflationRate = category === "income" ? 0.033 : 0.0189; // 소득 3.3%, 지출 1.89%

      // 복리 계산: 금액 × (1 + 상승률)^년수, 반올림하여 정수로
      adjustedAmount = Math.round(
        data.amount * Math.pow(1 + inflationRate, yearsUntilStart)
      );
    }

    // 모달에 전달할 데이터 준비
    // 중요: 계산된 startYear, endYear가 data의 값을 덮어쓰도록 순서 조정
    const templateData = {
      category,
      ...data, // 먼저 data의 모든 속성을 펼침 (frequency, growthRate 등)
      amount: adjustedAmount, // 물가상승률이 반영된 금액
      title: generatedTitle, // 생성된 항목 명 사용
      startYear, // 계산된 startYear로 덮어쓰기 (중요!)
      endYear, // 계산된 endYear로 덮어쓰기 (중요!)
      memo: data.memo || "", // memo 유지
    };

    onSelectTemplate(templateData);
    // 사이드바는 유지 (onClose 호출 제거)
  };

  // 현재 프로필에 있는 가족 구성원 타입만 필터링
  const getAvailableFamilyTypes = () => {
    const types = [
      { value: "self", label: "본인", available: true }, // 본인은 항상 표시
    ];

    // 배우자가 있는지 확인
    if (profileData?.hasSpouse && profileData?.spouseName) {
      types.push({ value: "spouse", label: "배우자", available: true });
    }

    // 아들이 있는지 확인
    const hasSon = profileData?.familyMembers?.some(
      (m) => m.relationship === "자녀" && m.gender === "아들"
    );
    if (hasSon) {
      types.push({ value: "son", label: "아들", available: true });
    }

    // 딸이 있는지 확인
    const hasDaughter = profileData?.familyMembers?.some(
      (m) => m.relationship === "자녀" && m.gender === "딸"
    );
    if (hasDaughter) {
      types.push({ value: "daughter", label: "딸", available: true });
    }

    // 부가 있는지 확인
    const hasFather = profileData?.familyMembers?.some(
      (m) => m.relationship === "부"
    );
    if (hasFather) {
      types.push({ value: "father", label: "부", available: true });
    }

    // 모가 있는지 확인
    const hasMother = profileData?.familyMembers?.some(
      (m) => m.relationship === "모"
    );
    if (hasMother) {
      types.push({ value: "mother", label: "모", available: true });
    }

    return types;
  };

  const groupedTemplates = groupTemplatesByCategory();
  const availableFamilyMembers = getAvailableFamilyMembers();
  const availableFamilyTypes = getAvailableFamilyTypes();

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>템플릿을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 메인 카테고리 탭 (소득/지출, 저축/투자) */}
      <div className={styles.mainCategoryTabs}>
        {mainCategories.map((cat) => (
          <button
            key={cat.value}
            className={`${styles.mainTab} ${
              selectedMainCategory === cat.value ? styles.activeMainTab : ""
            }`}
            onClick={() => setSelectedMainCategory(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 소득/지출일 때만 가족 구성원 타입 탭 표시 */}
      {selectedMainCategory === "income_expense" && (
        <>
          {/* 가족 구성원 타입 탭 (현재 프로필에 있는 구성원만) */}
          <div className={styles.familyTypeTabs}>
            {availableFamilyTypes.map((type) => (
              <button
                key={type.value}
                className={`${styles.tab} ${
                  selectedFamilyType === type.value ? styles.activeTab : ""
                }`}
                onClick={() => setSelectedFamilyType(type.value)}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* 가족 구성원 선택 (아들/딸/부/모만) */}
          {["son", "daughter", "father", "mother"].includes(
            selectedFamilyType
          ) &&
            availableFamilyMembers.length > 0 && (
              <div className={styles.familyMemberSelector}>
                <div className={styles.memberButtons}>
                  {availableFamilyMembers.map((member, index) => {
                    // id가 없으면 name + birthYear로 고유 키 생성
                    const memberKey =
                      member.id || `${member.name}-${member.birthYear}`;
                    const selectedKey =
                      selectedFamilyMember?.id ||
                      (selectedFamilyMember
                        ? `${selectedFamilyMember.name}-${selectedFamilyMember.birthYear}`
                        : null);
                    const isSelected = memberKey === selectedKey;

                    return (
                      <button
                        key={memberKey}
                        type="button"
                        className={
                          isSelected
                            ? styles.memberButtonActive
                            : styles.memberButton
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedFamilyMember(member);
                        }}
                      >
                        {member.name}, {calculateKoreanAge(member.birthYear)}세
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          {/* 소득/지출 세부 카테고리 필터 */}
          <div className={styles.categoryFilters}>
            {subCategories.map((cat) => (
              <button
                key={cat.value}
                className={`${styles.categoryButton} ${
                  selectedSubCategory === cat.value
                    ? styles.activeCategoryButton
                    : ""
                }`}
                onClick={() => setSelectedSubCategory(cat.value)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 템플릿 리스트 */}
      <div className={styles.content}>
        {Object.keys(groupedTemplates).length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyText}>
              {selectedMainCategory === "saving"
                ? "저축/투자 라이브러리가 비었습니다"
                : selectedMainCategory === "pension"
                ? "연금 라이브러리가 비었습니다"
                : selectedSubCategory === "income"
                ? "소득 라이브러리가 비었습니다"
                : selectedSubCategory === "expense"
                ? "지출 라이브러리가 비었습니다"
                : "선택된 조건에 맞는 템플릿이 없습니다"}
            </span>
            <span className={styles.emptySubText}>
              관리 모드에서 템플릿을 추가해보세요
            </span>
          </div>
        ) : (
          Object.keys(groupedTemplates).map((category) => (
            <div key={category} className={styles.categorySection}>
              <h4
                className={`${styles.categoryTitle} ${
                  category === "income"
                    ? styles.categoryTitleIncome
                    : category === "expense"
                    ? styles.categoryTitleExpense
                    : category === "saving"
                    ? styles.categoryTitleSaving
                    : category === "pension"
                    ? styles.categoryTitlePension
                    : ""
                }`}
              >
                {getCategoryLabel(category)}
              </h4>
              <div className={styles.itemsList}>
                {groupedTemplates[category].map((template) => {
                  return (
                    <div
                      key={template.id}
                      className={`${styles.itemRow} ${
                        template.category === "income"
                          ? styles.itemRowIncome
                          : template.category === "expense"
                          ? styles.itemRowExpense
                          : template.category === "saving"
                          ? styles.itemRowSaving
                          : template.category === "pension"
                          ? styles.itemRowPension
                          : ""
                      }`}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className={styles.itemInfo}>
                        <span className={styles.itemTitle}>
                          {template.title}
                        </span>
                        <div className={styles.itemMeta}>
                          {template.ageStart !== null &&
                          template.ageEnd !== null ? (
                            <span className={styles.itemAge}>
                              {template.ageStart}~{template.ageEnd}세
                            </span>
                          ) : null}
                          {/* 소득/지출 금액 표시 */}
                          {template.data?.amount && (
                            <span className={styles.itemAmount}>
                              {template.data.amount.toLocaleString()}만원/
                              {template.data.frequency === "monthly"
                                ? "월"
                                : "년"}
                            </span>
                          )}
                          {/* 연금 금액 표시 */}
                          {template.category === "pension" &&
                            template.data?.monthlyAmount && (
                              <span className={styles.itemAmount}>
                                {template.data.monthlyAmount.toLocaleString()}
                                만원/월
                              </span>
                            )}
                          {template.category === "pension" &&
                            template.data?.currentAmount && (
                              <span className={styles.itemAmount}>
                                적립금{" "}
                                {template.data.currentAmount.toLocaleString()}
                                만원
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FinancialDataStorePanel;
