"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";
import type { ProfileBasics } from "@/contexts/FinancialContext";
import type { SimFamilyMember } from "@/types";
import {
  FAMILY_ICONS,
  FAMILY_COLORS,
  FAMILY_DEFAULTS,
  getFamilyIcon,
} from "@/lib/constants/family";
import { useChartTheme } from "@/hooks/useChartTheme";
import styles from "./FamilyConfigPanel.module.css";

interface FamilyConfigPanelProps {
  profile: ProfileBasics;
  familyMembers: SimFamilyMember[];
  selfConfig: SimFamilyMember | null;
  onFamilyChange: (members: SimFamilyMember[], selfEntry?: SimFamilyMember | null) => void;
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

function getRelLabel(member: SimFamilyMember): string {
  if (member.relationship === "child") {
    return member.gender === "male" ? "아들" : member.gender === "female" ? "딸" : "자녀";
  }
  return RELATIONSHIP_LABELS[member.relationship] || member.relationship;
}

export function FamilyConfigPanel({ profile, familyMembers: initial, selfConfig, onFamilyChange }: FamilyConfigPanelProps) {
  const { isDark } = useChartTheme();
  const [members, setMembers] = useState<SimFamilyMember[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"name" | "birth_date" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // 아이콘 로컬 state
  const selfDefault = FAMILY_DEFAULTS.self;
  const [selfIcon, setSelfIcon] = useState(selfConfig?.icon ?? selfDefault.icon);
  const [selfIconColor, setSelfIconColor] = useState(selfConfig?.iconColor ?? selfDefault.color);

  // 피커
  const [pickerTargetId, setPickerTargetId] = useState<string | null>(null); // 'self' or member.id
  const pickerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const hasSpouse = members.some((m) => m.relationship === "spouse");
  const totalCount = 1 + members.length;

  // Close picker on outside click
  useEffect(() => {
    if (!pickerTargetId) return;
    const handleClick = (e: MouseEvent) => {
      const isInsidePicker = pickerRef.current?.contains(e.target as Node);
      const isInsideBtn = Object.values(btnRefs.current).some(
        (btn) => btn?.contains(e.target as Node)
      );
      if (!isInsidePicker && !isInsideBtn) {
        setPickerTargetId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerTargetId]);

  // Close picker on ESC
  useEffect(() => {
    if (!pickerTargetId) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerTargetId(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [pickerTargetId]);

  const updateLocal = (next: SimFamilyMember[]) => {
    setMembers(next);
    setIsDirty(true);
  };

  const handleSave = () => {
    const selfEntry: SimFamilyMember = {
      id: "self",
      relationship: "self",
      name: profile.name,
      birth_date: profile.birth_date,
      gender: profile.gender,
      is_dependent: false,
      is_working: true,
      retirement_age: null,
      monthly_income: null,
      icon: selfIcon,
      iconColor: selfIconColor,
    };
    onFamilyChange(members, selfEntry);
    setIsDirty(false);
  };

  // 본인 아이콘 변경
  const handleSelfIconChange = (iconId: string) => {
    setSelfIcon(iconId);
    setIsDirty(true);
  };

  const handleSelfColorChange = (color: string) => {
    setSelfIconColor(color);
    setIsDirty(true);
  };

  // 구성원 아이콘 변경
  const handleMemberIconChange = (memberId: string, iconId: string) => {
    const next = members.map((m) =>
      m.id === memberId ? { ...m, icon: iconId } : m
    );
    setMembers(next);
    setIsDirty(true);
  };

  const handleMemberColorChange = (memberId: string, color: string) => {
    const next = members.map((m) =>
      m.id === memberId ? { ...m, iconColor: color } : m
    );
    setMembers(next);
    setIsDirty(true);
  };

  // 피커 아이콘/색상 핸들러
  const handlePickerIconChange = (iconId: string) => {
    if (pickerTargetId === "self") {
      handleSelfIconChange(iconId);
    } else if (pickerTargetId) {
      handleMemberIconChange(pickerTargetId, iconId);
    }
  };

  const handlePickerColorChange = (color: string) => {
    if (pickerTargetId === "self") {
      handleSelfColorChange(color);
    } else if (pickerTargetId) {
      handleMemberColorChange(pickerTargetId, color);
    }
  };

  // 현재 피커 대상의 아이콘/색상
  const getCurrentPickerValues = () => {
    if (pickerTargetId === "self") {
      return { icon: selfIcon, color: selfIconColor };
    }
    const member = members.find((m) => m.id === pickerTargetId);
    if (member) {
      const defKey = member.relationship === "child" && member.gender ? `child_${member.gender}` : member.relationship;
      const def = FAMILY_DEFAULTS[defKey] ?? FAMILY_DEFAULTS[member.relationship] ?? FAMILY_DEFAULTS.self;
      return { icon: member.icon ?? def.icon, color: member.iconColor ?? def.color };
    }
    return { icon: "", color: "" };
  };
  const { icon: currentPickerIcon, color: currentPickerColor } = getCurrentPickerValues();

  // 구성원 필드 수정
  const handleUpdateField = (id: string, field: string, value: string) => {
    const next = members.map((m) =>
      m.id === id ? { ...m, [field]: value || null } : m
    );
    updateLocal(next);
    setEditingId(null);
    setEditingField(null);
  };

  const handleDelete = (id: string) => {
    updateLocal(members.filter((m) => m.id !== id));
  };

  const handleAdd = (
    relationship: "spouse" | "child" | "parent",
    options?: { gender?: "male" | "female"; name?: string }
  ) => {
    const defaultName =
      options?.name ||
      (relationship === "child"
        ? options?.gender === "male"
          ? "아들"
          : "딸"
        : RELATIONSHIP_LABELS[relationship]);
    const defKey = relationship === "child" && options?.gender
      ? `child_${options.gender}` : relationship;
    const def = FAMILY_DEFAULTS[defKey] ?? FAMILY_DEFAULTS[relationship] ?? FAMILY_DEFAULTS.self;
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
      icon: def.icon,
      iconColor: def.color,
    };
    updateLocal([...members, newMember]);
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

  const togglePicker = (targetId: string) => {
    setPickerTargetId(pickerTargetId === targetId ? null : targetId);
  };

  const SelfIconComp = getFamilyIcon(selfIcon);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>가족 구성</span>
        <span className={styles.count}>{totalCount}명</span>
        <button
          type="button"
          className={`${styles.saveButton}${!isDirty ? ` ${styles.saveButtonDisabled}` : ''}`}
          onClick={handleSave}
          disabled={!isDirty}
        >
          저장
        </button>
      </div>

      <div className={styles.memberList}>
        {/* 본인 */}
        <div className={styles.memberRow}>
          <div className={styles.memberMain}>
            <button
              ref={(el) => { btnRefs.current["self"] = el; }}
              className={styles.iconBtn}
              style={{ color: selfIconColor }}
              onClick={() => togglePicker("self")}
            >
              <SelfIconComp size={14} />
            </button>
            <div className={styles.memberInfo}>
              <span className={styles.nameRow}>
                <span className={styles.name}>{profile.name}</span>
                <span className={styles.separator}>|</span>
                <span className={styles.relation}>본인</span>
              </span>
              <span className={styles.birthDate}>
                {profile.birth_date || "미입력"}{" "}
                {profile.birth_date && `(${calculateAge(profile.birth_date)})`}
              </span>
            </div>
          </div>
        </div>

        {/* 가족 구성원 */}
        {members.map((member) => {
          const defKey = member.relationship === "child" && member.gender ? `child_${member.gender}` : member.relationship;
          const def = FAMILY_DEFAULTS[defKey] ?? FAMILY_DEFAULTS[member.relationship] ?? FAMILY_DEFAULTS.self;
          const memberIcon = member.icon ?? def.icon;
          const memberColor = member.iconColor ?? def.color;
          const MemberIcon = getFamilyIcon(memberIcon);

          return (
            <div key={member.id} className={styles.memberRow}>
              <div className={styles.memberMain}>
                <button
                  ref={(el) => { btnRefs.current[member.id] = el; }}
                  className={styles.iconBtn}
                  style={{ color: memberColor }}
                  onClick={() => togglePicker(member.id)}
                >
                  <MemberIcon size={14} />
                </button>
                <div className={styles.memberInfo}>
                  <span className={styles.nameRow}>
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
                    <span className={styles.separator}>|</span>
                    <span className={styles.relation}>{getRelLabel(member)}</span>
                  </span>
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
          );
        })}
      </div>

      {/* 아이콘/색상 피커 */}
      {pickerTargetId && (
        <div
          ref={pickerRef}
          className={styles.picker}
          style={{
            background: isDark ? "rgba(34, 37, 41, 0.5)" : "rgba(255, 255, 255, 0.5)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
          }}
        >
          <div className={styles.pickerSection}>
            <div className={styles.pickerGrid}>
              {FAMILY_ICONS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={`${styles.pickerIconItem} ${currentPickerIcon === item.id ? styles.pickerItemActive : ""}`}
                    style={currentPickerIcon === item.id ? { color: currentPickerColor } : undefined}
                    onClick={() => handlePickerIconChange(item.id)}
                    title={item.label}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className={styles.pickerDivider} />
          <div className={styles.pickerSection}>
            <div className={styles.colorGrid}>
              {FAMILY_COLORS.map((item) => (
                <button
                  key={item.id}
                  className={`${styles.colorItem} ${currentPickerColor === item.color ? styles.colorItemActive : ""}`}
                  style={{ background: item.color }}
                  onClick={() => handlePickerColorChange(item.color)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

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
