import React, { useState, useEffect, useMemo } from "react";
import { financialLibraryService } from "../../services/firestoreService";
import styles from "./TemplateManageModal.module.css";
import TemplateEditorModal from "./TemplateEditorModal";

/**
 * 템플릿 관리 모달
 * 카테고리별 탭 필터링, 검색, 편집/삭제 기능을 제공
 */
function TemplateManageModal({ isOpen, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 카테고리 목록
  const categories = [
    { value: "all", label: "전체" },
    { value: "income", label: "소득" },
    { value: "expense", label: "지출" },
    { value: "saving", label: "저축/투자" },
    { value: "pension", label: "연금" },
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

  // 연금 타입 목록
  const pensionTypes = [
    { value: "national", label: "국민연금" },
    { value: "severance", label: "퇴직금/퇴직연금 (DB형)" },
    { value: "retirement", label: "퇴직연금 (DC형/IRP)" },
    { value: "personal", label: "개인연금 (연금저축/IRP)" },
  ];

  // 템플릿 불러오기
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const allTemplates = await financialLibraryService.getTemplates();
      setTemplates(allTemplates);
    } catch (error) {
      console.error("템플릿 로딩 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen && !isEditorModalOpen) {
        e.stopPropagation();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, isEditorModalOpen, onClose]);

  // 모달이 열릴 때 배경 스크롤 막기
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";

      return () => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // 필터링된 템플릿
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      // 카테고리 필터
      if (
        selectedCategory !== "all" &&
        template.category !== selectedCategory
      ) {
        return false;
      }
      // 검색어 필터
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = template.title?.toLowerCase().includes(query);
        const memoMatch = template.data?.memo?.toLowerCase().includes(query);
        if (!titleMatch && !memoMatch) {
          return false;
        }
      }
      return true;
    });
  }, [templates, selectedCategory, searchQuery]);

  // 카테고리별 템플릿 수
  const categoryCounts = useMemo(() => {
    const counts = { all: templates.length };
    categories.forEach((cat) => {
      if (cat.value !== "all") {
        counts[cat.value] = templates.filter(
          (t) => t.category === cat.value
        ).length;
      }
    });
    return counts;
  }, [templates]);

  // 새 템플릿 추가
  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setIsEditorModalOpen(true);
  };

  // 템플릿 편집
  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setIsEditorModalOpen(true);
  };

  // 템플릿 삭제
  const handleDeleteTemplate = async (templateId, e) => {
    e.stopPropagation();
    if (window.confirm("이 템플릿을 삭제하시겠습니까?")) {
      try {
        await financialLibraryService.deleteTemplate(templateId);
        await loadTemplates();
      } catch (error) {
        console.error("템플릿 삭제 오류:", error);
        alert("템플릿 삭제 중 오류가 발생했습니다.");
      }
    }
  };

  // 템플릿 저장
  const handleSaveTemplate = async (templateData) => {
    try {
      if (editingTemplate && editingTemplate.id) {
        await financialLibraryService.updateTemplate(
          editingTemplate.id,
          templateData
        );
      } else {
        await financialLibraryService.addTemplate(templateData);
      }
      await loadTemplates();
      setIsEditorModalOpen(false);
    } catch (error) {
      console.error("템플릿 저장 오류:", error);
      alert("템플릿 저장 중 오류가 발생했습니다.");
    }
  };

  // 카테고리 라벨 가져오기
  const getCategoryLabel = (value) => {
    const cat = categories.find((c) => c.value === value);
    return cat ? cat.label : value;
  };

  // 가족 타입 라벨 가져오기
  const getFamilyTypeLabel = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((v) => {
          const type = familyTypes.find((t) => t.value === v);
          return type ? type.label : v;
        })
        .join(", ");
    }
    const type = familyTypes.find((t) => t.value === value);
    return type ? type.label : value;
  };

  // 연금 타입 라벨 가져오기
  const getPensionTypeLabel = (value) => {
    const type = pensionTypes.find((t) => t.value === value);
    return type ? type.label : value;
  };

  // 템플릿 상세 정보 렌더링
  const renderTemplateDetails = (template) => {
    const details = [];

    // 연령 정보
    if (template.ageStart !== null && template.ageEnd !== null) {
      details.push(`${template.ageStart}~${template.ageEnd}세`);
    }

    // 카테고리별 상세 정보
    if (template.category === "income" || template.category === "expense") {
      if (template.data?.amount) {
        const freq = template.data.frequency === "monthly" ? "월" : "년";
        details.push(`${template.data.amount.toLocaleString()}만원/${freq}`);
      }
      if (
        template.data?.growthRate &&
        parseFloat(template.data.growthRate) !== 0
      ) {
        details.push(`연 ${template.data.growthRate}% 증가`);
      }
    } else if (template.category === "saving") {
      if (template.data?.amount) {
        const freq = template.data.frequency === "monthly" ? "월" : "년";
        details.push(`${template.data.amount.toLocaleString()}만원/${freq}`);
      }
      if (template.data?.interestRate) {
        details.push(`수익률 ${template.data.interestRate}%`);
      }
    } else if (template.category === "pension") {
      if (template.data?.type) {
        details.push(getPensionTypeLabel(template.data.type));
      }
      if (template.data?.monthlyAmount) {
        details.push(`${template.data.monthlyAmount.toLocaleString()}만원/월`);
      }
      if (template.data?.pensionCurrentAmount) {
        details.push(
          `적립금 ${template.data.pensionCurrentAmount.toLocaleString()}만원`
        );
      }
    }

    return details;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className={styles.header}>
            <h2 className={styles.title}>재무 라이브러리 관리</h2>
            <button className={styles.closeButton} onClick={onClose}>
              ×
            </button>
          </div>

          {/* 툴바: 검색 + 추가 버튼 */}
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="템플릿 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className={styles.clearSearch}
                  onClick={() => setSearchQuery("")}
                >
                  ×
                </button>
              )}
            </div>
            <button className={styles.addButton} onClick={handleAddTemplate}>
              + 새 템플릿
            </button>
          </div>

          {/* 카테고리 탭 */}
          <div className={styles.categoryTabs}>
            {categories.map((cat) => (
              <button
                key={cat.value}
                className={`${styles.categoryTab} ${
                  selectedCategory === cat.value ? styles.categoryTabActive : ""
                }`}
                onClick={() => setSelectedCategory(cat.value)}
              >
                <span className={styles.tabLabel}>{cat.label}</span>
                <span className={styles.tabCount}>
                  {categoryCounts[cat.value] || 0}
                </span>
              </button>
            ))}
          </div>

          {/* 템플릿 목록 */}
          <div className={styles.content}>
            {loading ? (
              <div className={styles.loading}>
                <span className={styles.loadingSpinner}></span>
                <span>로딩 중...</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyText}>
                  {searchQuery
                    ? `"${searchQuery}" 검색 결과가 없습니다`
                    : selectedCategory === "all"
                    ? "등록된 템플릿이 없습니다"
                    : `${getCategoryLabel(selectedCategory)} 템플릿이 없습니다`}
                </span>
                {!searchQuery && (
                  <button
                    className={styles.emptyAddButton}
                    onClick={handleAddTemplate}
                  >
                    + 첫 템플릿 추가하기
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.templateList}>
                {filteredTemplates.map((template) => {
                  const details = renderTemplateDetails(template);
                  return (
                    <div
                      key={template.id}
                      className={styles.templateItem}
                      onClick={() => handleEditTemplate(template)}
                    >
                      <div className={styles.templateMain}>
                        <div className={styles.templateHeader}>
                          <span
                            className={`${styles.categoryIndicator} ${
                              styles[
                                `indicator${
                                  template.category.charAt(0).toUpperCase() +
                                  template.category.slice(1)
                                }`
                              ]
                            }`}
                          />
                          <span className={styles.templateTitle}>
                            {template.title}
                          </span>
                        </div>
                        {details.length > 0 && (
                          <div className={styles.templateDetails}>
                            {details.map((detail, idx) => (
                              <span key={idx} className={styles.detailItem}>
                                {idx > 0 && " · "}
                                {detail}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={styles.templateActions}>
                        <button
                          className={styles.editButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTemplate(template);
                          }}
                        >
                          수정
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={(e) => handleDeleteTemplate(template.id, e)}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 하단 요약 */}
          {!loading && templates.length > 0 && (
            <div className={styles.footer}>
              <span className={styles.footerText}>
                총 {templates.length}개 템플릿
                {selectedCategory !== "all" &&
                  ` • ${getCategoryLabel(selectedCategory)} ${
                    categoryCounts[selectedCategory] || 0
                  }개`}
                {searchQuery && ` • 검색 결과 ${filteredTemplates.length}개`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 템플릿 편집 모달 */}
      <TemplateEditorModal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        onSave={handleSaveTemplate}
        editData={editingTemplate}
      />
    </>
  );
}

export default TemplateManageModal;
