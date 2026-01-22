"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus, X, Check, Calendar, FileText, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import {
  getSnapshot,
  getSnapshotItems,
  updateSnapshot,
  deleteSnapshot,
  createSnapshotItem,
  updateSnapshotItem,
  deleteSnapshotItem,
  recalculateSnapshotSummary,
  SNAPSHOT_TYPE_LABELS,
  SNAPSHOT_CATEGORY_LABELS,
} from "@/lib/services/snapshotService";
import type {
  FinancialSnapshot,
  FinancialSnapshotItem,
  SnapshotCategory,
  SnapshotType,
} from "@/types/tables";
import {
  getFamilyMembers,
  RELATIONSHIP_LABELS,
  type FamilyMember,
} from "@/lib/services/familyService";
import styles from "./SnapshotDetail.module.css";

interface SnapshotDetailProps {
  snapshotId: string;
  userId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

// 단계 정의
type Step = "household" | "assets" | "cashflow" | "pension" | "financial";

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: "household", label: "가계 정보", description: "가족 구성 및 기본 정보" },
  { id: "assets", label: "자산/부채", description: "부동산, 차량, 대출 등" },
  { id: "cashflow", label: "소득/지출", description: "월 수입과 지출 현황" },
  { id: "pension", label: "연금", description: "국민연금, 퇴직연금, 개인연금" },
  { id: "financial", label: "금융 자산", description: "예적금, 투자 계좌 등" },
];

// 단계별 카테고리 매핑
const STEP_CATEGORIES: Record<Step, { category: SnapshotCategory; types: { value: string; label: string }[] }[]> = {
  household: [], // 가계 정보는 별도 처리
  assets: [
    {
      category: "asset",
      types: [
        { value: "real_estate_residence", label: "거주용 부동산" },
        { value: "real_estate_investment", label: "투자용 부동산" },
        { value: "vehicle", label: "차량" },
        { value: "other_asset", label: "기타 자산" },
      ],
    },
    {
      category: "debt",
      types: [
        { value: "mortgage", label: "주택담보대출" },
        { value: "jeonse", label: "전세자금대출" },
        { value: "credit", label: "신용대출" },
        { value: "car", label: "자동차대출" },
        { value: "student", label: "학자금대출" },
        { value: "card", label: "카드대금" },
        { value: "other", label: "기타 부채" },
      ],
    },
  ],
  cashflow: [
    {
      category: "income",
      types: [
        { value: "salary", label: "근로소득" },
        { value: "business", label: "사업소득" },
        { value: "rental", label: "임대소득" },
        { value: "dividend", label: "배당/이자" },
        { value: "other", label: "기타 소득" },
      ],
    },
    {
      category: "expense",
      types: [
        { value: "living", label: "생활비" },
        { value: "housing", label: "주거비" },
        { value: "education", label: "교육비" },
        { value: "insurance", label: "보험료" },
        { value: "transport", label: "교통비" },
        { value: "medical", label: "의료비" },
        { value: "loan_payment", label: "대출상환" },
        { value: "other", label: "기타 지출" },
      ],
    },
  ],
  pension: [
    {
      category: "pension",
      types: [
        { value: "national", label: "국민연금" },
        { value: "government", label: "공무원연금" },
        { value: "military", label: "군인연금" },
        { value: "private_school", label: "사학연금" },
        { value: "retirement_db", label: "퇴직연금(DB)" },
        { value: "retirement_dc", label: "퇴직연금(DC)" },
        { value: "irp", label: "IRP" },
        { value: "pension_savings", label: "연금저축" },
      ],
    },
  ],
  financial: [
    {
      category: "asset",
      types: [
        { value: "checking", label: "입출금 계좌" },
        { value: "savings", label: "예적금" },
        { value: "stock", label: "주식/ETF" },
        { value: "fund", label: "펀드" },
        { value: "bond", label: "채권" },
        { value: "crypto", label: "암호화폐" },
        { value: "isa", label: "ISA" },
        { value: "insurance_savings", label: "저축성 보험" },
      ],
    },
  ],
};

// 전체 항목 타입 옵션 (기존 호환)
const ITEM_TYPE_OPTIONS: Record<SnapshotCategory, { value: string; label: string }[]> = {
  asset: [
    { value: "real_estate_residence", label: "거주용 부동산" },
    { value: "real_estate_investment", label: "투자용 부동산" },
    { value: "vehicle", label: "차량" },
    { value: "checking", label: "입출금 계좌" },
    { value: "savings", label: "예적금" },
    { value: "stock", label: "주식/ETF" },
    { value: "fund", label: "펀드" },
    { value: "bond", label: "채권" },
    { value: "crypto", label: "암호화폐" },
    { value: "isa", label: "ISA" },
    { value: "insurance_savings", label: "저축성 보험" },
    { value: "other_asset", label: "기타 자산" },
  ],
  debt: [
    { value: "mortgage", label: "주택담보대출" },
    { value: "jeonse", label: "전세자금대출" },
    { value: "credit", label: "신용대출" },
    { value: "car", label: "자동차대출" },
    { value: "student", label: "학자금대출" },
    { value: "card", label: "카드대금" },
    { value: "other", label: "기타 부채" },
  ],
  income: [
    { value: "salary", label: "근로소득" },
    { value: "business", label: "사업소득" },
    { value: "rental", label: "임대소득" },
    { value: "pension_income", label: "연금소득" },
    { value: "dividend", label: "배당/이자" },
    { value: "other", label: "기타 소득" },
  ],
  expense: [
    { value: "living", label: "생활비" },
    { value: "housing", label: "주거비" },
    { value: "education", label: "교육비" },
    { value: "insurance", label: "보험료" },
    { value: "transport", label: "교통비" },
    { value: "medical", label: "의료비" },
    { value: "loan_payment", label: "대출상환" },
    { value: "other", label: "기타 지출" },
  ],
  pension: [
    { value: "national", label: "국민연금" },
    { value: "government", label: "공무원연금" },
    { value: "military", label: "군인연금" },
    { value: "private_school", label: "사학연금" },
    { value: "retirement_db", label: "퇴직연금(DB)" },
    { value: "retirement_dc", label: "퇴직연금(DC)" },
    { value: "irp", label: "IRP" },
    { value: "pension_savings", label: "연금저축" },
  ],
};

export function SnapshotDetail({ snapshotId, userId, onUpdate, onDelete }: SnapshotDetailProps) {
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [items, setItems] = useState<FinancialSnapshotItem[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoText, setMemoText] = useState("");

  // 단계 네비게이션 상태
  const [currentStep, setCurrentStep] = useState<Step>("household");

  // 새 항목 추가 상태
  const [addingCategory, setAddingCategory] = useState<SnapshotCategory | null>(null);
  const [newItem, setNewItem] = useState({
    item_type: "",
    title: "",
    amount: 0,
    owner: "self" as const,
  });

  const loadData = async () => {
    try {
      const [snapshotData, itemsData, familyData] = await Promise.all([
        getSnapshot(snapshotId),
        getSnapshotItems(snapshotId),
        getFamilyMembers(userId),
      ]);
      setSnapshot(snapshotData);
      setItems(itemsData);
      setFamilyMembers(familyData);
      setMemoText(snapshotData?.memo || "");
    } catch (error) {
      console.error("Failed to load snapshot:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [snapshotId, userId]);

  const handleDateChange = async (date: string) => {
    if (!snapshot) return;
    await updateSnapshot(snapshotId, { recorded_at: date });
    await loadData();
    onUpdate();
  };

  const handleTypeChange = async (type: SnapshotType) => {
    if (!snapshot) return;
    await updateSnapshot(snapshotId, { snapshot_type: type });
    await loadData();
    onUpdate();
  };

  const handleMemoSave = async () => {
    await updateSnapshot(snapshotId, { memo: memoText || null });
    setEditingMemo(false);
    await loadData();
    onUpdate();
  };

  const handleDeleteSnapshot = async () => {
    await deleteSnapshot(snapshotId);
    onDelete();
  };

  const handleAddItem = async () => {
    if (!addingCategory || !newItem.item_type || !newItem.title || newItem.amount <= 0) return;

    await createSnapshotItem({
      snapshot_id: snapshotId,
      category: addingCategory,
      item_type: newItem.item_type,
      title: newItem.title,
      amount: newItem.amount,
      owner: newItem.owner,
    });

    await recalculateSnapshotSummary(snapshotId);
    await loadData();
    onUpdate();

    // 입력 초기화
    setAddingCategory(null);
    setNewItem({ item_type: "", title: "", amount: 0, owner: "self" });
  };

  const handleDeleteItem = async (itemId: string) => {
    await deleteSnapshotItem(itemId);
    await recalculateSnapshotSummary(snapshotId);
    await loadData();
    onUpdate();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getTypeLabel = (category: SnapshotCategory, itemType: string) => {
    const options = ITEM_TYPE_OPTIONS[category];
    return options.find((o) => o.value === itemType)?.label || itemType;
  };

  const getItemsByCategory = (category: SnapshotCategory) => {
    return items.filter((item) => item.category === category);
  };

  const getCategoryTotal = (category: SnapshotCategory) => {
    return getItemsByCategory(category).reduce((sum, item) => sum + item.amount, 0);
  };

  // 현재 단계의 카테고리 목록 가져오기
  const getCurrentStepCategories = (): { category: SnapshotCategory; types: { value: string; label: string }[] }[] => {
    return STEP_CATEGORIES[currentStep] || [];
  };

  // 단계 이동
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const canGoPrev = currentStepIndex > 0;
  const canGoNext = currentStepIndex < STEPS.length - 1;

  const goToPrevStep = () => {
    if (canGoPrev) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
      setAddingCategory(null);
    }
  };

  const goToNextStep = () => {
    if (canGoNext) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
      setAddingCategory(null);
    }
  };

  // 나이 계산
  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading || !snapshot) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 스냅샷 메타 정보 */}
      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <Calendar size={14} />
          <input
            type="date"
            value={snapshot.recorded_at}
            onChange={(e) => handleDateChange(e.target.value)}
            className={styles.dateInput}
          />
        </div>
        <select
          value={snapshot.snapshot_type}
          onChange={(e) => handleTypeChange(e.target.value as SnapshotType)}
          className={styles.typeSelect}
        >
          {Object.entries(SNAPSHOT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          className={styles.deleteButton}
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 size={14} />
          삭제
        </button>
      </div>

      {/* 단계 네비게이션 탭 */}
      <div className={styles.stepTabs}>
        {STEPS.map((step, index) => (
          <button
            key={step.id}
            className={`${styles.stepTab} ${currentStep === step.id ? styles.active : ""}`}
            onClick={() => {
              setCurrentStep(step.id);
              setAddingCategory(null);
            }}
          >
            <span className={styles.stepNumber}>{index + 1}</span>
            <span className={styles.stepLabel}>{step.label}</span>
          </button>
        ))}
      </div>

      {/* 현재 단계 헤더 */}
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>
          {STEPS[currentStepIndex].label}
        </h2>
        <p className={styles.stepDescription}>
          {STEPS[currentStepIndex].description}
        </p>
      </div>

      {/* 단계별 콘텐츠 */}
      <div className={styles.stepContent}>
        {/* 가계 정보 단계 */}
        {currentStep === "household" && (
          <div className={styles.householdSection}>
            {familyMembers.length === 0 ? (
              <div className={styles.emptyHousehold}>
                <Users size={40} strokeWidth={1} />
                <p>등록된 가족 구성원이 없습니다.</p>
                <span className={styles.householdHint}>
                  기본 정보 탭에서 가족 구성원을 추가해주세요.
                </span>
              </div>
            ) : (
              <div className={styles.familyList}>
                {familyMembers.map((member) => (
                  <div key={member.id} className={styles.familyCard}>
                    <div className={styles.familyMain}>
                      <span className={styles.familyRelation}>
                        {RELATIONSHIP_LABELS[member.relationship] || member.relationship}
                      </span>
                      <span className={styles.familyName}>{member.name}</span>
                    </div>
                    <div className={styles.familyDetails}>
                      {member.birth_date && (
                        <span className={styles.familyAge}>
                          {calculateAge(member.birth_date)}세
                        </span>
                      )}
                      {member.is_working && (
                        <span className={styles.familyWorking}>근로중</span>
                      )}
                      {member.monthly_income > 0 && (
                        <span className={styles.familyIncome}>
                          월 {formatMoney(member.monthly_income)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 자산/부채, 소득/지출, 연금, 금융자산 단계 */}
        {currentStep !== "household" && (
          <div className={styles.categories}>
            {getCurrentStepCategories().map(({ category, types }) => (
              <div key={category} className={styles.categorySection}>
                <div className={styles.categoryHeader}>
                  <h3 className={styles.categoryTitle}>
                    {SNAPSHOT_CATEGORY_LABELS[category]}
                  </h3>
                  <span className={styles.categoryTotal}>
                    {formatMoney(getCategoryTotal(category))}
                  </span>
                </div>

                <div className={styles.itemList}>
                  {/* 해당 단계의 타입에 맞는 항목만 필터링 */}
                  {items
                    .filter((item) =>
                      item.category === category &&
                      types.some((t) => t.value === item.item_type)
                    )
                    .map((item) => (
                      <div key={item.id} className={styles.item}>
                        <span className={styles.itemType}>
                          {getTypeLabel(category, item.item_type)}
                        </span>
                        <span className={styles.itemTitle}>{item.title}</span>
                        <span className={styles.itemAmount}>
                          {formatMoney(item.amount)}
                        </span>
                        <button
                          className={styles.itemDelete}
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}

                  {/* 새 항목 추가 폼 */}
                  {addingCategory === category ? (
                    <div className={styles.addItemForm}>
                      <select
                        value={newItem.item_type}
                        onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })}
                        className={styles.addSelect}
                      >
                        <option value="">유형 선택</option>
                        {types.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="항목명"
                        value={newItem.title}
                        onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                        className={styles.addInput}
                      />
                      <div className={styles.addAmountGroup}>
                        <input
                          type="number"
                          placeholder="금액"
                          value={newItem.amount || ""}
                          onChange={(e) =>
                            setNewItem({ ...newItem, amount: Number(e.target.value) })
                          }
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className={styles.addAmountInput}
                        />
                        <span className={styles.addUnit}>만원</span>
                      </div>
                      <button className={styles.addConfirm} onClick={handleAddItem}>
                        <Check size={14} />
                      </button>
                      <button
                        className={styles.addCancel}
                        onClick={() => setAddingCategory(null)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className={styles.addButton}
                      onClick={() => {
                        setAddingCategory(category);
                        setNewItem({
                          item_type: types[0]?.value || "",
                          title: "",
                          amount: 0,
                          owner: "self",
                        });
                      }}
                    >
                      <Plus size={14} />
                      {SNAPSHOT_CATEGORY_LABELS[category]} 추가
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 단계 이동 버튼 */}
      <div className={styles.stepNavigation}>
        <button
          className={styles.navButton}
          onClick={goToPrevStep}
          disabled={!canGoPrev}
        >
          <ChevronLeft size={16} />
          이전
        </button>
        <div className={styles.stepIndicator}>
          {currentStepIndex + 1} / {STEPS.length}
        </div>
        <button
          className={`${styles.navButton} ${styles.navNext}`}
          onClick={goToNextStep}
          disabled={!canGoNext}
        >
          다음
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 메모 */}
      <div className={styles.memoSection}>
        <div className={styles.memoHeader}>
          <FileText size={14} />
          <span>메모</span>
        </div>
        {editingMemo ? (
          <div className={styles.memoEdit}>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder="이 기록에 대한 메모를 작성하세요..."
              className={styles.memoTextarea}
              rows={3}
            />
            <div className={styles.memoActions}>
              <button className={styles.memoCancel} onClick={() => setEditingMemo(false)}>
                취소
              </button>
              <button className={styles.memoSave} onClick={handleMemoSave}>
                저장
              </button>
            </div>
          </div>
        ) : (
          <div
            className={styles.memoContent}
            onClick={() => setEditingMemo(true)}
          >
            {snapshot.memo || "메모를 추가하려면 클릭하세요..."}
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>기록 삭제</h3>
            <p>
              {formatDate(snapshot.recorded_at)} 기록을 삭제하시겠습니까?
              <br />
              삭제된 기록은 복구할 수 없습니다.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setShowDeleteConfirm(false)}
              >
                취소
              </button>
              <button className={styles.modalConfirm} onClick={handleDeleteSnapshot}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
