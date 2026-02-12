"use client";

import { useState } from "react";
import { X, Plus, User } from "lucide-react";
import type { ProfileBasics } from "@/contexts/FinancialContext";
import type { SimFamilyMember } from "@/types";
import styles from "./FamilyConfigPanel.module.css";

interface FamilyConfigPanelProps {
  profile: ProfileBasics;
  familyMembers: SimFamilyMember[];
  onFamilyChange: (members: SimFamilyMember[]) => void;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  self: "본인",
  spouse: "배우자",
  child: "자녀",
  parent: "부양가족",
};

function calculateAge(birthDate: string | null): string {
  if (!birthDate) return "";
  const currentYear = new Date().getFullYear();
  const birthYear = parseInt(birthDate.split("-")[0]);
  const age = currentYear - birthYear;
  return `${age}세`;
}

function generateId(): string {
  return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function FamilyConfigPanel({ profile, familyMembers: initial, onFamilyChange }: FamilyConfigPanelProps) {
  const [members, setMembers] = useState<SimFamilyMember[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"name" | "birth_date" | null>(null);
  const [editValue, setEditValue] = useState("");

  const hasSpouse = members.some((m) => m.relationship === "spouse");
  const totalCount = 1 + members.length;

  const updateAndSave = (next: SimFamilyMember[]) => {
    setMembers(next);
    onFamilyChange(next);
  };

  // 구성원 필드 수정
  const handleUpdateField = (id: string, field: string, value: string) => {
    const next = members.map((m) =>
      m.id === id ? { ...m, [field]: value || null } : m
    );
    updateAndSave(next);
    setEditingId(null);
    setEditingField(null);
  };

  // 구성원 삭제
  const handleDelete = (id: string) => {
    updateAndSave(members.filter((m) => m.id !== id));
  };

  // 구성원 추가
  const handleAdd = (
    relationship: "spouse" | "child" | "parent",
    options?: { gender?: "male" | "female"; name?: string }
  ) => {
    const defaultName = options?.name
      || (relationship === "child" ? (options?.gender === "male" ? "아들" : "딸") : RELATIONSHIP_LABELS[relationship]);
    const newMember: SimFamilyMember = {
      id: generateId(),
      relationship,
      name: defaultName,
      birth_date: null,
      gender: options?.gender || null,
      is_dependent: relationship !== "spouse",
      is_working: relationship === "spouse",
      retirement_age: relationship === "spouse" ? 60 : null,
      monthly_income: null,
    };
    updateAndSave([...members, newMember]);
  };

  const startEdit = (id: string, field: "name" | "birth_date", currentValue: string) => {
    setEditingId(id);
    setEditingField(field);
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue("");
  };

  const saveEdit = (id: string) => {
    if (!editingField) return;
    handleUpdateField(id, editingField, editValue);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>가족 구성</span>
        <span className={styles.count}>{totalCount}명</span>
      </div>

      <div className={styles.memberList}>
        {/* 본인 (읽기전용 - 프로필 정보) */}
        <div className={styles.memberRow}>
          <div className={styles.memberMain}>
            <div className={styles.roleIconWrapper}>
              <User size={16} className={styles.roleIcon} />
            </div>
            <div className={styles.roleBadge}>본인</div>
            <div className={styles.memberInfo}>
              <span className={styles.name}>{profile.name}</span>
              <span className={styles.birthDate}>
                {profile.birth_date || "미입력"}{" "}
                {profile.birth_date && `(${calculateAge(profile.birth_date)})`}
              </span>
            </div>
          </div>
        </div>

        {/* 가족 구성원 */}
        {members.map((member) => (
          <div key={member.id} className={styles.memberRow}>
            <div className={styles.memberMain}>
              <div className={styles.roleIconWrapper}>
                <User size={16} className={styles.roleIcon} />
              </div>
              <div className={styles.roleBadge}>
                {member.relationship === "child"
                  ? (member.gender === "male" ? "아들" : member.gender === "female" ? "딸" : "자녀")
                  : (RELATIONSHIP_LABELS[member.relationship] || member.relationship)}
              </div>
              <div className={styles.memberInfo}>
                {editingId === member.id && editingField === "name" ? (
                  <input
                    type="text"
                    className={styles.nameInput}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveEdit(member.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(member.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    className={styles.name}
                    onClick={() => startEdit(member.id, "name", member.name)}
                  >
                    {member.name}
                  </span>
                )}
                {editingId === member.id && editingField === "birth_date" ? (
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveEdit(member.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(member.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    className={styles.birthDate}
                    onClick={() => startEdit(member.id, "birth_date", member.birth_date || "")}
                  >
                    {member.birth_date || "미입력"}{" "}
                    {member.birth_date && `(${calculateAge(member.birth_date)})`}
                  </span>
                )}
              </div>
            </div>
            <button
              className={styles.deleteButton}
              onClick={() => handleDelete(member.id)}
              type="button"
              aria-label="삭제"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className={styles.addButtons}>
        {!hasSpouse && (
          <button
            className={styles.addButton}
            onClick={() => handleAdd("spouse")}
            type="button"
          >
            <Plus size={14} />
            배우자 추가
          </button>
        )}
        <button
          className={styles.addButton}
          onClick={() => handleAdd("child", { gender: "male" })}
          type="button"
        >
          <Plus size={14} />
          아들 추가
        </button>
        <button
          className={styles.addButton}
          onClick={() => handleAdd("child", { gender: "female" })}
          type="button"
        >
          <Plus size={14} />
          딸 추가
        </button>
        <button
          className={styles.addButton}
          onClick={() => handleAdd("parent")}
          type="button"
        >
          <Plus size={14} />
          부양가족 추가
        </button>
      </div>
    </div>
  );
}
