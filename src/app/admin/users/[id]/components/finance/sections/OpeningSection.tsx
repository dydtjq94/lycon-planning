"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import {
  getFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  FamilyMember,
  RELATIONSHIP_LABELS,
} from "@/lib/services/familyService";
import styles from "./OpeningSection.module.css";

interface OpeningSectionProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
  customerName: string;
  onDataChange?: (data: OpeningData) => void;
}

export interface OpeningData {
  concerns: string;
  targetRetirementAge: number;
  targetMonthlyIncome: number;
}

const LIFESTYLE_PRESETS = [
  { label: "기본", value: 200 },
  { label: "평범", value: 300 },
  { label: "여유", value: 500 },
];

export function OpeningSection({
  userId,
  customerName,
  birthYear,
  retirementAge,
  onDataChange,
}: OpeningSectionProps) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Opening data state
  const [concerns, setConcerns] = useState("");
  const [targetRetirementAge, setTargetRetirementAge] = useState(retirementAge);
  const [targetMonthlyIncome, setTargetMonthlyIncome] = useState(300);
  const [selectedLifestyle, setSelectedLifestyle] = useState<number | null>(300);

  // Family modal state
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: "",
    relationship: "spouse" as "spouse" | "child" | "parent",
    birth_date: "",
    gender: "male" as "male" | "female",
  });
  const [saving, setSaving] = useState(false);

  const loadFamily = async () => {
    // 본인 정보는 profiles에서 가져오므로 ensureSelfExists 불필요
    // family_members는 spouse, child, parent만 저장
    const members = await getFamilyMembers(userId);
    setFamilyMembers(members);
  };

  useEffect(() => {
    const initializeFamily = async () => {
      await loadFamily();
      setLoading(false);
    };
    initializeFamily();
  }, [userId]);

  useEffect(() => {
    if (onDataChange) {
      onDataChange({
        concerns,
        targetRetirementAge,
        targetMonthlyIncome,
      });
    }
  }, [concerns, targetRetirementAge, targetMonthlyIncome, onDataChange]);

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const getBirthYear = (birthDate: string | null) => {
    if (!birthDate) return null;
    return new Date(birthDate).getFullYear();
  };

  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;

  const spouse = familyMembers.find((m) => m.relationship === "spouse");
  const children = familyMembers.filter((m) => m.relationship === "child");
  const parents = familyMembers.filter((m) => m.relationship === "parent");
  const hasSpouse = familyMembers.some((m) => m.relationship === "spouse");

  const handleLifestyleClick = (value: number) => {
    setTargetMonthlyIncome(value);
    setSelectedLifestyle(value);
  };

  const handleCustomIncomeChange = (value: number) => {
    setTargetMonthlyIncome(value);
    const isPreset = LIFESTYLE_PRESETS.some((p) => p.value === value);
    setSelectedLifestyle(isPreset ? value : null);
  };

  const openFamilyModal = () => {
    setEditingMember(null);
    setMemberForm({
      name: "",
      relationship: "spouse",
      birth_date: "",
      gender: "male",
    });
    setFamilyModalOpen(true);
  };

  const handleEditMember = (member: FamilyMember) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      relationship: member.relationship as any,
      birth_date: member.birth_date || "",
      gender: (member.gender || "male") as "male" | "female",
    });
    setFamilyModalOpen(true);
  };

  const handleDeleteMember = async (member: FamilyMember) => {
    if (confirm(`${member.name}을(를) 삭제하시겠습니까?`)) {
      await deleteFamilyMember(member.id);
      await loadFamily();
    }
  };

  const handleSaveMember = async () => {
    if (!memberForm.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      if (editingMember) {
        await updateFamilyMember(editingMember.id, {
          name: memberForm.name,
          relationship: memberForm.relationship,
          birth_date: memberForm.birth_date || null,
          gender: memberForm.gender,
        });
      } else {
        await createFamilyMember({
          user_id: userId,
          name: memberForm.name,
          relationship: memberForm.relationship,
          birth_date: memberForm.birth_date || null,
          gender: memberForm.gender,
          is_dependent: memberForm.relationship === "child" || memberForm.relationship === "parent",
          is_working: memberForm.relationship === "spouse",
          retirement_age: memberForm.relationship === "spouse" ? 60 : null,
          monthly_income: 0,
          notes: null,
        });
      }
      await loadFamily();
      setFamilyModalOpen(false);
      setEditingMember(null);
      setMemberForm({
        name: "",
        relationship: "spouse",
        birth_date: "",
        gender: "male",
      });
    } catch (error) {
      console.error("Error saving member:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = (relationship: "spouse" | "child" | "parent") => {
    setEditingMember(null);
    setMemberForm({
      name: "",
      relationship,
      birth_date: "",
      gender: "male",
    });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 1-1. 기본 정보 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>1-1. 기본 정보</h3>
        </div>
        <div className={styles.sectionContent}>
          <div className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>이름:</span>
              <span className={styles.infoValue}>{customerName}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>생년:</span>
              <span className={styles.infoValue}>{birthYear}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>현재 나이:</span>
              <span className={styles.infoValue}>{currentAge}세</span>
            </div>
          </div>

          <div className={styles.familySummary}>
            {spouse ? (
              <div className={styles.familyRow}>
                <span className={styles.familyLabel}>배우자:</span>
                <span className={styles.familyValue}>
                  있음 ({getBirthYear(spouse.birth_date)}년생, {getAge(spouse.birth_date)}세)
                </span>
              </div>
            ) : (
              <div className={styles.familyRow}>
                <span className={styles.familyLabel}>배우자:</span>
                <span className={styles.familyValue}>없음</span>
              </div>
            )}

            {children.length > 0 ? (
              <div className={styles.familyRow}>
                <span className={styles.familyLabel}>자녀:</span>
                <span className={styles.familyValue}>
                  {children.length}명 (
                  {children.map((c, i) => (
                    <span key={c.id}>
                      {getAge(c.birth_date)}세
                      {i < children.length - 1 ? ", " : ""}
                    </span>
                  ))}
                  )
                </span>
              </div>
            ) : (
              <div className={styles.familyRow}>
                <span className={styles.familyLabel}>자녀:</span>
                <span className={styles.familyValue}>없음</span>
              </div>
            )}

            {parents.length > 0 ? (
              <div className={styles.familyRow}>
                <span className={styles.familyLabel}>부양가족:</span>
                <span className={styles.familyValue}>
                  {parents.length}명 (
                  {parents.map((p, i) => (
                    <span key={p.id}>
                      {p.name} {getAge(p.birth_date)}세
                      {i < parents.length - 1 ? ", " : ""}
                    </span>
                  ))}
                  )
                </span>
              </div>
            ) : (
              <div className={styles.familyRow}>
                <span className={styles.familyLabel}>부양가족:</span>
                <span className={styles.familyValue}>없음</span>
              </div>
            )}
          </div>

          <div className={styles.editLink}>
            <button className={styles.editButton} onClick={openFamilyModal}>
              가계 정보 수정
            </button>
          </div>
        </div>
      </div>

      {/* 1-2. 오늘의 고민 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>1-2. 오늘의 고민</h3>
        </div>
        <div className={styles.sectionContent}>
          <textarea
            className={styles.concernsTextarea}
            placeholder="고객님이 가장 걱정하는 것은 무엇인가요?"
            value={concerns}
            onChange={(e) => setConcerns(e.target.value)}
            rows={6}
          />
          <p className={styles.helperText}>
            예: 자녀 교육비, 은퇴 후 생활비, 주택 마련, 노후 의료비
          </p>
        </div>
      </div>

      {/* 1-3. 은퇴 목표 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>1-3. 은퇴 목표</h3>
        </div>
        <div className={styles.sectionContent}>
          <div className={styles.goalRow}>
            <label className={styles.goalLabel}>희망 은퇴 나이:</label>
            <div className={styles.goalInputGroup}>
              <input
                type="number"
                className={styles.goalInput}
                value={targetRetirementAge}
                onChange={(e) => setTargetRetirementAge(Number(e.target.value))}
                onWheel={(e) => (e.target as HTMLElement).blur()}
              />
              <span className={styles.unit}>세</span>
            </div>
          </div>

          <div className={styles.goalSection}>
            <label className={styles.goalLabel}>은퇴 후 월 생활비:</label>
            <div className={styles.lifestyleButtons}>
              {LIFESTYLE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  className={`${styles.lifestyleButton} ${
                    selectedLifestyle === preset.value ? styles.selected : ""
                  }`}
                  onClick={() => handleLifestyleClick(preset.value)}
                >
                  <span className={styles.lifestyleLabel}>{preset.label}</span>
                  <span className={styles.lifestyleValue}>{preset.value}만</span>
                </button>
              ))}
            </div>

            <div className={styles.customInput}>
              <label className={styles.customLabel}>직접 입력:</label>
              <div className={styles.goalInputGroup}>
                <input
                  type="number"
                  className={styles.goalInput}
                  value={targetMonthlyIncome}
                  onChange={(e) => handleCustomIncomeChange(Number(e.target.value))}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.unit}>만원/월</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Family Edit Modal */}
      {familyModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setFamilyModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>가계 정보 수정</h2>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setFamilyModalOpen(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Current members list */}
              <div className={styles.memberList}>
                <h4 className={styles.memberListTitle}>가구원 목록</h4>
                {familyMembers.map((member) => (
                  <div key={member.id} className={styles.memberItem}>
                    <div className={styles.memberInfo}>
                      <span
                        className={`${styles.memberBadge} ${styles[member.relationship]}`}
                      >
                        {RELATIONSHIP_LABELS[member.relationship as keyof typeof RELATIONSHIP_LABELS]}
                      </span>
                      <span className={styles.memberName}>{member.name}</span>
                      {member.birth_date && (
                        <span className={styles.memberAge}>
                          ({getAge(member.birth_date)}세)
                        </span>
                      )}
                    </div>
                    <div className={styles.memberActions}>
                      <button
                        className={styles.memberActionBtn}
                        onClick={() => handleEditMember(member)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={`${styles.memberActionBtn} ${styles.delete}`}
                        onClick={() => handleDeleteMember(member)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add member buttons */}
              <div className={styles.addMemberSection}>
                <h4 className={styles.addMemberTitle}>가구원 추가</h4>
                <div className={styles.addMemberButtons}>
                  {!hasSpouse && (
                    <button
                      className={styles.addMemberBtn}
                      onClick={() => handleAddMember("spouse")}
                    >
                      <Plus size={14} />
                      <span>배우자 추가</span>
                    </button>
                  )}
                  <button
                    className={styles.addMemberBtn}
                    onClick={() => handleAddMember("child")}
                  >
                    <Plus size={14} />
                    <span>자녀 추가</span>
                  </button>
                  <button
                    className={styles.addMemberBtn}
                    onClick={() => handleAddMember("parent")}
                  >
                    <Plus size={14} />
                    <span>부모님 추가</span>
                  </button>
                </div>
              </div>

              {/* Edit/Add form (shown when editingMember or adding new) */}
              {(editingMember || memberForm.name !== "") && (
                <div className={styles.memberForm}>
                  <h4 className={styles.formTitle}>
                    {editingMember ? "정보 수정" : "새 가구원"}
                  </h4>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>관계</label>
                    <select
                      className={styles.formSelect}
                      value={memberForm.relationship}
                      onChange={(e) =>
                        setMemberForm({
                          ...memberForm,
                          relationship: e.target.value as any,
                        })
                      }
                    >
                      <option
                        value="spouse"
                        disabled={hasSpouse && editingMember?.relationship !== "spouse"}
                      >
                        배우자
                      </option>
                      <option value="child">자녀</option>
                      <option value="parent">부모님</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>이름</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={memberForm.name}
                      onChange={(e) =>
                        setMemberForm({ ...memberForm, name: e.target.value })
                      }
                      placeholder="이름 입력"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>생년월일</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={memberForm.birth_date}
                      onChange={(e) =>
                        setMemberForm({ ...memberForm, birth_date: e.target.value })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>성별</label>
                    <div className={styles.genderButtons}>
                      <button
                        type="button"
                        className={`${styles.genderBtn} ${
                          memberForm.gender === "male" ? styles.selected : ""
                        }`}
                        onClick={() =>
                          setMemberForm({ ...memberForm, gender: "male" })
                        }
                      >
                        남성
                      </button>
                      <button
                        type="button"
                        className={`${styles.genderBtn} ${
                          memberForm.gender === "female" ? styles.selected : ""
                        }`}
                        onClick={() =>
                          setMemberForm({ ...memberForm, gender: "female" })
                        }
                      >
                        여성
                      </button>
                    </div>
                  </div>

                  <div className={styles.formActions}>
                    <button
                      className={styles.cancelBtn}
                      onClick={() => {
                        setEditingMember(null);
                        setMemberForm({
                          name: "",
                          relationship: "spouse",
                          birth_date: "",
                          gender: "male",
                        });
                      }}
                    >
                      취소
                    </button>
                    <button
                      className={styles.saveBtn}
                      onClick={handleSaveMember}
                      disabled={saving}
                    >
                      {saving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
