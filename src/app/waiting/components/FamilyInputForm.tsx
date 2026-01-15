"use client";

import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import type { FamilyMember, PrepTaskId } from "../types";
import styles from "./FamilyInputForm.module.css";

interface Child {
  gender: "son" | "daughter";
  birthDate: string; // YYMMDD
}

type ParentRelation = "father" | "mother" | "father_in_law" | "mother_in_law";

interface FamilyInputFormProps {
  taskId: PrepTaskId;
  initialData: FamilyMember[];
  isCompleted: boolean;
  onClose: () => void;
  onSave: (data: FamilyMember[]) => Promise<void>;
  surveyMaritalStatus?: string;
  surveyChildren?: string;
}

const PARENT_OPTIONS: { value: ParentRelation; label: string }[] = [
  { value: "father", label: "아버지" },
  { value: "mother", label: "어머니" },
  { value: "father_in_law", label: "장인/시아버지" },
  { value: "mother_in_law", label: "장모/시어머니" },
];

// 생년월일 파싱 (YYMMDD → 나이)
function parseAge(birthDate: string): number | null {
  if (birthDate.length !== 6) return null;
  const yy = parseInt(birthDate.slice(0, 2));
  const year = yy > 50 ? 1900 + yy : 2000 + yy;
  return new Date().getFullYear() - year;
}

// YYMMDD → YYYY-MM-DD 변환
function convertToISODate(yymmdd: string): string | null {
  if (yymmdd.length !== 6) return null;
  const yy = parseInt(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const year = yy > 50 ? 1900 + yy : 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

export function FamilyInputForm({
  taskId,
  initialData,
  isCompleted,
  onClose,
  onSave,
  surveyMaritalStatus,
  surveyChildren,
}: FamilyInputFormProps) {
  // initialData에서 초기값 파싱
  const parseInitialData = () => {
    const members = initialData || [];

    // 배우자
    const spouse = members.find(m => m.relationship === "spouse");
    let initHasSpouse: boolean | null = null;
    let initSpouseBirthDate = "";

    if (spouse) {
      initHasSpouse = true;
      if (spouse.birth_date) {
        const [y, m, d] = spouse.birth_date.split("-");
        initSpouseBirthDate = `${y.slice(2)}${m}${d}`;
      }
    } else if (isCompleted) {
      initHasSpouse = false;
    } else if (surveyMaritalStatus === "married") {
      initHasSpouse = true;
    } else if (surveyMaritalStatus === "single" || surveyMaritalStatus === "divorced") {
      initHasSpouse = false;
    }

    // 자녀
    const childrenData = members.filter(m => m.relationship === "child");
    let initHasChildren: boolean | null = null;
    let initChildren: Child[] = [];

    if (childrenData.length > 0) {
      initHasChildren = true;
      initChildren = childrenData.map(c => ({
        gender: c.gender === "male" ? "son" as const : "daughter" as const,
        birthDate: c.birth_date ? `${c.birth_date.slice(2, 4)}${c.birth_date.slice(5, 7)}${c.birth_date.slice(8, 10)}` : "",
      }));
    } else if (isCompleted) {
      initHasChildren = false;
    } else if (surveyChildren === "none") {
      initHasChildren = false;
    } else if (surveyChildren === "one" || surveyChildren === "two" || surveyChildren === "three_plus") {
      initHasChildren = true;
      const count = surveyChildren === "one" ? 1 : surveyChildren === "two" ? 2 : 3;
      initChildren = Array.from({ length: count }, () => ({ gender: "son" as const, birthDate: "" }));
    }

    // 부양 부모님
    const parentsData = members.filter(m => m.relationship === "parent");
    let initHasParents: boolean | null = null;
    const initSelectedParents = new Set<ParentRelation>();

    if (parentsData.length > 0) {
      initHasParents = true;
      parentsData.forEach(p => {
        if (p.name === "아버지") initSelectedParents.add("father");
        else if (p.name === "어머니") initSelectedParents.add("mother");
        else if (p.name === "장인/시아버지") initSelectedParents.add("father_in_law");
        else if (p.name === "장모/시어머니") initSelectedParents.add("mother_in_law");
      });
    } else if (isCompleted) {
      initHasParents = false;
    }

    return { initHasSpouse, initSpouseBirthDate, initHasChildren, initChildren, initHasParents, initSelectedParents };
  };

  const initial = parseInitialData();

  // 배우자
  const [hasSpouse, setHasSpouse] = useState<boolean | null>(initial.initHasSpouse);
  const [spouseBirthDate, setSpouseBirthDate] = useState(initial.initSpouseBirthDate);

  // 자녀
  const [hasChildren, setHasChildren] = useState<boolean | null>(initial.initHasChildren);
  const [children, setChildren] = useState<Child[]>(initial.initChildren);

  // 부양 부모님 (다중 선택)
  const [hasParents, setHasParents] = useState<boolean | null>(initial.initHasParents);
  const [selectedParents, setSelectedParents] = useState<Set<ParentRelation>>(initial.initSelectedParents);

  const [saving, setSaving] = useState(false);

  // 자녀 추가/삭제
  const addChild = () => {
    setChildren([...children, { gender: "son", birthDate: "" }]);
  };

  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
    if (children.length === 1) setHasChildren(false);
  };

  const updateChild = (index: number, field: keyof Child, value: string) => {
    const updated = [...children];
    updated[index] = { ...updated[index], [field]: value };
    setChildren(updated);
  };

  // 부모님 토글
  const toggleParent = (relation: ParentRelation) => {
    const newSet = new Set(selectedParents);
    if (newSet.has(relation)) {
      newSet.delete(relation);
    } else {
      newSet.add(relation);
    }
    setSelectedParents(newSet);
    if (newSet.size === 0) setHasParents(false);
  };

  // 저장
  const handleSave = async () => {
    if (hasSpouse === null || hasChildren === null || hasParents === null) {
      alert("모든 항목을 선택해주세요.");
      return;
    }

    setSaving(true);
    try {
      // 저장할 데이터 구성
      const newMembers: FamilyMember[] = [];

      // 배우자
      if (hasSpouse && spouseBirthDate) {
        newMembers.push({
          relationship: "spouse",
          name: "배우자",
          birth_date: convertToISODate(spouseBirthDate),
          gender: null,
        });
      }

      // 자녀
      for (const child of children) {
        newMembers.push({
          relationship: "child",
          name: child.gender === "son" ? "아들" : "딸",
          birth_date: convertToISODate(child.birthDate),
          gender: child.gender === "son" ? "male" : "female",
        });
      }

      // 부양 부모님
      for (const parentRelation of selectedParents) {
        const labelMap: Record<ParentRelation, string> = {
          father: "아버지",
          mother: "어머니",
          father_in_law: "장인/시아버지",
          mother_in_law: "장모/시어머니",
        };
        newMembers.push({
          relationship: "parent",
          name: labelMap[parentRelation],
          birth_date: null,
          gender: parentRelation.includes("father") ? "male" : "female",
        });
      }

      // 부모 컴포넌트에서 저장 처리
      await onSave(newMembers);
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onClose}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.headerTitle}>가계 구성</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          {/* 배우자 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>배우자</span>
              <div className={styles.toggleGroup}>
                <button
                  className={`${styles.toggleBtn} ${hasSpouse === false ? styles.active : ""}`}
                  onClick={() => setHasSpouse(false)}
                >
                  없음
                </button>
                <button
                  className={`${styles.toggleBtn} ${hasSpouse === true ? styles.active : ""}`}
                  onClick={() => setHasSpouse(true)}
                >
                  있음
                </button>
              </div>
            </div>

            {hasSpouse && (
              <div className={styles.inputRow}>
                <input
                  type="text"
                  className={styles.birthInput}
                  placeholder="생년월일 6자리"
                  value={spouseBirthDate}
                  onChange={(e) => setSpouseBirthDate(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                />
                {parseAge(spouseBirthDate) && (
                  <span className={styles.ageText}>{parseAge(spouseBirthDate)}세</span>
                )}
              </div>
            )}
          </section>

          {/* 자녀 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>자녀</span>
              <div className={styles.toggleGroup}>
                <button
                  className={`${styles.toggleBtn} ${hasChildren === false ? styles.active : ""}`}
                  onClick={() => {
                    setHasChildren(false);
                    setChildren([]);
                  }}
                >
                  없음
                </button>
                <button
                  className={`${styles.toggleBtn} ${hasChildren === true ? styles.active : ""}`}
                  onClick={() => {
                    setHasChildren(true);
                    if (children.length === 0) addChild();
                  }}
                >
                  있음
                </button>
              </div>
            </div>

            {hasChildren && children.length > 0 && (
              <div className={styles.itemList}>
                {children.map((child, index) => (
                  <div key={index} className={styles.itemRow}>
                    <div className={styles.genderToggle}>
                      <button
                        className={`${styles.genderBtn} ${child.gender === "son" ? styles.active : ""}`}
                        onClick={() => updateChild(index, "gender", "son")}
                      >
                        아들
                      </button>
                      <button
                        className={`${styles.genderBtn} ${child.gender === "daughter" ? styles.active : ""}`}
                        onClick={() => updateChild(index, "gender", "daughter")}
                      >
                        딸
                      </button>
                    </div>
                    <input
                      type="text"
                      className={styles.birthInput}
                      placeholder="생년월일 6자리"
                      value={child.birthDate}
                      onChange={(e) => updateChild(index, "birthDate", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                    />
                    {parseAge(child.birthDate) && (
                      <span className={styles.ageText}>{parseAge(child.birthDate)}세</span>
                    )}
                    <button className={styles.removeBtn} onClick={() => removeChild(index)}>
                      <X size={18} />
                    </button>
                  </div>
                ))}
                <button className={styles.addBtn} onClick={addChild}>
                  <Plus size={16} />
                  <span>자녀 추가</span>
                </button>
              </div>
            )}
          </section>

          {/* 부양 부모님 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>부양 부모님</span>
              <div className={styles.toggleGroup}>
                <button
                  className={`${styles.toggleBtn} ${hasParents === false ? styles.active : ""}`}
                  onClick={() => {
                    setHasParents(false);
                    setSelectedParents(new Set());
                  }}
                >
                  없음
                </button>
                <button
                  className={`${styles.toggleBtn} ${hasParents === true ? styles.active : ""}`}
                  onClick={() => setHasParents(true)}
                >
                  있음
                </button>
              </div>
            </div>
            <p className={styles.sectionHint}>경제적으로 부양하는 부모님</p>

            {hasParents && (
              <div className={styles.parentOptions}>
                {PARENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`${styles.parentBtn} ${selectedParents.has(opt.value) ? styles.active : ""}`}
                    onClick={() => toggleParent(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>

        <div className={styles.bottomArea}>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving || hasSpouse === null || hasChildren === null || hasParents === null}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
