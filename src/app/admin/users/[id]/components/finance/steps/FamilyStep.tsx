"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, User } from "lucide-react";
import {
  getFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  ensureSelfExists,
  FamilyMember,
  RELATIONSHIP_LABELS,
} from "@/lib/services/familyService";
import { BaseModal } from "../shared";
import styles from "./StepStyles.module.css";

interface FamilyStepProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
}

type Relationship = "self" | "spouse" | "child" | "parent";

export function FamilyStep({ userId }: FamilyStepProps) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [defaultRelationship, setDefaultRelationship] = useState<Relationship>("spouse");

  const loadMembers = async () => {
    await ensureSelfExists(userId);
    const data = await getFamilyMembers(userId);
    setMembers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadMembers();
  }, [userId]);

  const handleAdd = (relationship: Relationship) => {
    setDefaultRelationship(relationship);
    setEditingMember(null);
    setModalOpen(true);
  };

  const handleEdit = (member: FamilyMember) => {
    setEditingMember(member);
    setDefaultRelationship(member.relationship as Relationship);
    setModalOpen(true);
  };

  const handleDelete = async (member: FamilyMember) => {
    if (member.relationship === "self") {
      alert("본인은 삭제할 수 없습니다.");
      return;
    }
    if (confirm(`${member.name}을(를) 삭제하시겠습니까?`)) {
      await deleteFamilyMember(member.id);
      loadMembers();
    }
  };

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const hasSpouse = members.some((m) => m.relationship === "spouse");

  if (loading) {
    return <div className={styles.empty}>로딩 중...</div>;
  }

  return (
    <div className={styles.stepContainer}>
      <p className={styles.description}>
        가구원 정보를 입력해주세요. 소득이 있는 가족 구성원을 포함하면 더 정확한 분석이 가능합니다.
      </p>

      {/* Member List */}
      <div className={styles.itemList}>
        {members.map((member) => {
          const age = getAge(member.birth_date);
          return (
            <div key={member.id} className={styles.item}>
              <div className={`${styles.itemIcon} ${styles[member.relationship]}`}>
                <User size={18} />
              </div>
              <div className={styles.itemInfo}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>{member.name}</span>
                  <span className={styles.itemBadge}>
                    {RELATIONSHIP_LABELS[member.relationship]}
                  </span>
                </div>
                <div className={styles.itemMeta}>
                  {member.birth_date && `${member.birth_date.replace(/-/g, ".")}`}
                  {age !== null && ` (${age}세)`}
                  {member.gender && ` · ${member.gender === "male" ? "남" : "여"}`}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button
                  className={styles.actionBtn}
                  onClick={() => handleEdit(member)}
                  title="편집"
                >
                  <Pencil size={16} />
                </button>
                {member.relationship !== "self" && (
                  <button
                    className={`${styles.actionBtn} ${styles.delete}`}
                    onClick={() => handleDelete(member)}
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Buttons */}
      <div className={styles.addButtons}>
        {!hasSpouse && (
          <button className={styles.addButton} onClick={() => handleAdd("spouse")}>
            <Plus size={16} />
            배우자 추가
          </button>
        )}
        <button className={styles.addButton} onClick={() => handleAdd("child")}>
          <Plus size={16} />
          자녀 추가
        </button>
        <button className={styles.addButton} onClick={() => handleAdd("parent")}>
          <Plus size={16} />
          부양가족 추가
        </button>
      </div>

      {/* Modal */}
      <FamilyMemberModal
        isOpen={modalOpen}
        userId={userId}
        member={editingMember}
        defaultRelationship={defaultRelationship}
        onClose={() => {
          setModalOpen(false);
          setEditingMember(null);
        }}
        onSaved={() => {
          setModalOpen(false);
          setEditingMember(null);
          loadMembers();
        }}
      />
    </div>
  );
}

// Modal Component
interface FamilyMemberModalProps {
  isOpen: boolean;
  userId: string;
  member: FamilyMember | null;
  defaultRelationship: Relationship;
  onClose: () => void;
  onSaved: () => void;
}

function FamilyMemberModal({
  isOpen,
  userId,
  member,
  defaultRelationship,
  onClose,
  onSaved,
}: FamilyMemberModalProps) {
  const [name, setName] = useState(member?.name || "");
  const [relationship, setRelationship] = useState<Relationship>(
    (member?.relationship as Relationship) || defaultRelationship
  );
  const [birthDate, setBirthDate] = useState(member?.birth_date || "");
  const [gender, setGender] = useState<"male" | "female" | "">(member?.gender || "");
  const [saving, setSaving] = useState(false);

  const isEditing = !!member;
  const isSelf = member?.relationship === "self";

  const handleSave = async () => {
    if (!name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    setSaving(true);

    try {
      if (isEditing && member) {
        await updateFamilyMember(member.id, {
          name: name.trim(),
          birth_date: birthDate || null,
          gender: gender || null,
        });
      } else {
        await createFamilyMember({
          user_id: userId,
          relationship,
          name: name.trim(),
          birth_date: birthDate || null,
          gender: gender || null,
          is_dependent: relationship === "parent",
          is_working: relationship === "self" || relationship === "spouse",
          retirement_age: null,
          monthly_income: 0,
          notes: null,
        });
      }
      onSaved();
    } catch {
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={isEditing ? "가족 정보 수정" : "가족 추가"}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={saving ? "저장 중..." : "저장"}
      saveDisabled={saving}
    >
      <div className={styles.modalForm}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>관계</label>
            <select
              className={styles.formSelect}
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as Relationship)}
              disabled={isSelf}
            >
              <option value="self">본인</option>
              <option value="spouse">배우자</option>
              <option value="child">자녀</option>
              <option value="parent">부양가족</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>이름</label>
            <input
              type="text"
              className={styles.formInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 입력"
            />
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>생년월일</label>
            <input
              type="date"
              max="9999-12-31"
              className={styles.formInput}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>성별</label>
            <select
              className={styles.formSelect}
              value={gender}
              onChange={(e) => setGender(e.target.value as "male" | "female" | "")}
            >
              <option value="">선택안함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
