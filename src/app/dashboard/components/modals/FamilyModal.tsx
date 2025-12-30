"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { OnboardingData, FamilyMemberInput, Gender } from "@/types";
import styles from "./Modal.module.css";

interface FamilyModalProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
  onClose: () => void;
}

export function FamilyModal({ data, onUpdate, onClose }: FamilyModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const [name, setName] = useState(data.name || "");
  const [birthDate, setBirthDate] = useState(data.birth_date || "");
  const [gender, setGender] = useState<Gender | null>(data.gender || null);
  const [retirementAge, setRetirementAge] = useState(
    data.target_retirement_age || 60
  );

  // 배우자
  const [isMarried, setIsMarried] = useState(data.isMarried || false);
  const [spouse, setSpouse] = useState<FamilyMemberInput | null>(
    data.spouse || null
  );

  // 자녀
  const [children, setChildren] = useState<FamilyMemberInput[]>(
    data.children || []
  );

  // 배우자 추가/수정
  const handleSpouseChange = (
    field: keyof FamilyMemberInput,
    value: string | number | boolean
  ) => {
    if (!spouse) return;
    setSpouse({ ...spouse, [field]: value });
  };

  // 자녀 추가 (성별 지정)
  const addChild = (gender: Gender) => {
    const sameGenderCount = children.filter((c) => c.gender === gender).length;
    const label = gender === "male" ? "아들" : "딸";
    setChildren([
      ...children,
      {
        relationship: "child",
        name: `${label} ${sameGenderCount + 1}`,
        birth_date: "",
        gender,
      },
    ]);
  };

  // 자녀 수정
  const updateChild = (
    index: number,
    field: keyof FamilyMemberInput,
    value: string | number | boolean
  ) => {
    const newChildren = [...children];
    newChildren[index] = { ...newChildren[index], [field]: value };
    setChildren(newChildren);
  };

  // 자녀 삭제
  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  // 저장
  const handleSave = () => {
    onUpdate({
      name,
      birth_date: birthDate,
      gender,
      target_retirement_age: retirementAge,
      isMarried,
      spouse: isMarried ? spouse : null,
      children,
      hasChildren: children.length > 0,
    });
    onClose();
  };

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 현재 나이 계산
  const calculateAge = (birthDateStr: string): number | null => {
    if (!birthDateStr) return null;
    const birthYear = new Date(birthDateStr).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  };

  const myAge = calculateAge(birthDate);
  const spouseAge = spouse?.birth_date
    ? calculateAge(spouse.birth_date)
    : null;

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>가족 구성원</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {/* 본인 정보 */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>본인</h3>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>이름</label>
              <input
                type="text"
                className={styles.formInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름"
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>생년월일</label>
              <div className={styles.formInputWithAge}>
                <input
                  type="date"
                  className={styles.formInput}
                  min="1900-01-01"
                  max="2200-12-31"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
                {myAge !== null && (
                  <span className={styles.ageDisplay}>{myAge}세</span>
                )}
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>성별</label>
              <div className={styles.genderButtons}>
                <button
                  type="button"
                  className={`${styles.genderBtn} ${
                    gender === "male" ? styles.active : ""
                  }`}
                  onClick={() => setGender("male")}
                >
                  남성
                </button>
                <button
                  type="button"
                  className={`${styles.genderBtn} ${
                    gender === "female" ? styles.active : ""
                  }`}
                  onClick={() => setGender("female")}
                >
                  여성
                </button>
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>목표 은퇴 나이</label>
              <div className={styles.formInputWithUnit}>
                <input
                  type="number"
                  className={styles.formInputSmall}
                  value={retirementAge}
                  onChange={(e) =>
                    setRetirementAge(parseInt(e.target.value) || 60)
                  }
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
                <span className={styles.formUnit}>세</span>
              </div>
            </div>
          </div>

          {/* 배우자 정보 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>배우자</h3>
              <div className={styles.toggleButtons}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${
                    !isMarried ? styles.active : ""
                  }`}
                  onClick={() => {
                    setIsMarried(false);
                    setSpouse(null);
                  }}
                >
                  없음
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${
                    isMarried ? styles.active : ""
                  }`}
                  onClick={() => {
                    setIsMarried(true);
                    if (!spouse) {
                      setSpouse({
                        relationship: "spouse",
                        name: "",
                        birth_date: "",
                        retirement_age: 60,
                      });
                    }
                  }}
                >
                  있음
                </button>
              </div>
            </div>

            {isMarried && spouse && (
              <div className={styles.subSection}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>이름</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={spouse.name || ""}
                    onChange={(e) => handleSpouseChange("name", e.target.value)}
                    placeholder="배우자 이름"
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>생년월일</label>
                  <div className={styles.formInputWithAge}>
                    <input
                      type="date"
                      className={styles.formInput}
                      min="1900-01-01"
                      max="2200-12-31"
                      value={spouse.birth_date || ""}
                      onChange={(e) =>
                        handleSpouseChange("birth_date", e.target.value)
                      }
                    />
                    {spouseAge !== null && (
                      <span className={styles.ageDisplay}>{spouseAge}세</span>
                    )}
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>은퇴 나이</label>
                  <div className={styles.formInputWithUnit}>
                    <input
                      type="number"
                      className={styles.formInputSmall}
                      value={spouse.retirement_age || 60}
                      onChange={(e) =>
                        handleSpouseChange(
                          "retirement_age",
                          parseInt(e.target.value) || 60
                        )
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    <span className={styles.formUnit}>세</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 자녀 정보 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>자녀</h3>
            </div>

            {children.map((child, index) => (
              <div key={index} className={styles.childItem}>
                <div className={styles.childHeader}>
                  <span className={styles.childIndex}>
                    {child.gender === "male" ? "아들" : "딸"}
                  </span>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeChild(index)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>생년월일</label>
                  <div className={styles.formInputWithAge}>
                    <input
                      type="date"
                      className={styles.formInput}
                      min="1900-01-01"
                      max="2200-12-31"
                      value={child.birth_date || ""}
                      onChange={(e) =>
                        updateChild(index, "birth_date", e.target.value)
                      }
                    />
                    {child.birth_date && (
                      <span className={styles.ageDisplay}>
                        {calculateAge(child.birth_date)}세
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className={styles.addChildButtons}>
              <button
                className={styles.addChildBtn}
                onClick={() => addChild("male")}
              >
                <Plus size={16} />
                아들 추가
              </button>
              <button
                className={styles.addChildBtn}
                onClick={() => addChild("female")}
              >
                <Plus size={16} />
                딸 추가
              </button>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            취소
          </button>
          <button className={styles.applyBtn} onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
