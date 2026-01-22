"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Landmark, Building2, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getNationalPensions, deleteNationalPension } from "@/lib/services/nationalPensionService";
import { getRetirementPensions, deleteRetirementPension, PENSION_TYPE_LABELS as RETIREMENT_TYPE_LABELS } from "@/lib/services/retirementPensionService";
import { getPersonalPensions, deletePersonalPension, PENSION_TYPE_LABELS as PERSONAL_TYPE_LABELS } from "@/lib/services/personalPensionService";
import type { NationalPension, RetirementPension, PersonalPension } from "@/types/tables";
import { NationalPensionModal, RetirementPensionModal, PersonalPensionModal } from "../modals";
import styles from "./StepStyles.module.css";

interface PensionStepProps {
  userId: string;
  simulationId: string;
  birthYear: number;
  retirementAge: number;
}

type ModalType = "national" | "retirement" | "personal" | null;

export function PensionStep({ simulationId, birthYear, retirementAge }: PensionStepProps) {
  const [nationalPensions, setNationalPensions] = useState<NationalPension[]>([]);
  const [retirementPensions, setRetirementPensions] = useState<RetirementPension[]>([]);
  const [personalPensions, setPersonalPensions] = useState<PersonalPension[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingNational, setEditingNational] = useState<NationalPension | null>(null);
  const [editingRetirement, setEditingRetirement] = useState<RetirementPension | null>(null);
  const [editingPersonal, setEditingPersonal] = useState<PersonalPension | null>(null);
  const [defaultOwner, setDefaultOwner] = useState<"self" | "spouse">("self");

  const loadData = async () => {
    const [national, retirement, personal] = await Promise.all([
      getNationalPensions(simulationId),
      getRetirementPensions(simulationId),
      getPersonalPensions(simulationId),
    ]);
    setNationalPensions(national.filter((n) => n.is_active));
    setRetirementPensions(retirement.filter((r) => r.is_active));
    setPersonalPensions(personal.filter((p) => p.is_active));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [simulationId]);

  const handleAddNational = (owner: "self" | "spouse" = "self") => {
    setDefaultOwner(owner);
    setEditingNational(null);
    setModalType("national");
  };

  const handleAddRetirement = (owner: "self" | "spouse" = "self") => {
    setDefaultOwner(owner);
    setEditingRetirement(null);
    setModalType("retirement");
  };

  const handleAddPersonal = (owner: "self" | "spouse" = "self") => {
    setDefaultOwner(owner);
    setEditingPersonal(null);
    setModalType("personal");
  };

  const handleEditNational = (item: NationalPension) => {
    setEditingNational(item);
    setModalType("national");
  };

  const handleEditRetirement = (item: RetirementPension) => {
    setEditingRetirement(item);
    setModalType("retirement");
  };

  const handleEditPersonal = (item: PersonalPension) => {
    setEditingPersonal(item);
    setModalType("personal");
  };

  const handleDeleteNational = async (item: NationalPension) => {
    if (confirm("이 국민연금을 삭제하시겠습니까?")) {
      await deleteNationalPension(item.id);
      loadData();
    }
  };

  const handleDeleteRetirement = async (item: RetirementPension) => {
    if (confirm("이 퇴직연금을 삭제하시겠습니까?")) {
      await deleteRetirementPension(item.id);
      loadData();
    }
  };

  const handleDeletePersonal = async (item: PersonalPension) => {
    if (confirm("이 개인연금을 삭제하시겠습니까?")) {
      await deletePersonalPension(item.id);
      loadData();
    }
  };

  const closeModal = () => {
    setModalType(null);
    setEditingNational(null);
    setEditingRetirement(null);
    setEditingPersonal(null);
  };

  const handleSaved = () => {
    closeModal();
    loadData();
  };

  if (loading) {
    return <div className={styles.empty}>로딩 중...</div>;
  }

  const hasSelfNational = nationalPensions.some((n) => n.owner === "self");
  const hasSpouseNational = nationalPensions.some((n) => n.owner === "spouse");
  const hasSelfRetirement = retirementPensions.some((r) => r.owner === "self");
  const hasSpouseRetirement = retirementPensions.some((r) => r.owner === "spouse");

  return (
    <div className={styles.stepContainer}>
      <p className={styles.description}>
        국민연금, 퇴직연금, 개인연금 정보를 입력해주세요. 예상 수령액을 알면 더 정확한 분석이 가능합니다.
      </p>

      {/* 국민연금 */}
      <div className={styles.summary} style={{ marginTop: 0, marginBottom: 16 }}>
        <div className={styles.summaryTitle}>국민연금</div>
        {nationalPensions.length > 0 ? (
          <div className={styles.itemList} style={{ marginBottom: 12 }}>
            {nationalPensions.map((item) => (
              <div key={item.id} className={styles.item} style={{ margin: 0, background: "white" }}>
                <div className={`${styles.itemIcon} ${styles[item.owner]}`}>
                  <Landmark size={18} />
                </div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemName}>
                      {item.owner === "self" ? "본인" : "배우자"}
                    </span>
                  </div>
                  <div className={styles.itemMeta}>
                    예상 월 {formatMoney(item.expected_monthly_amount || 0)}
                    {item.start_age && <> · {item.start_age}세부터</>}
                  </div>
                </div>
                <div className={styles.itemActions}>
                  <button className={styles.actionBtn} onClick={() => handleEditNational(item)}>
                    <Pencil size={16} />
                  </button>
                  <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleDeleteNational(item)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#86868b", marginBottom: 12 }}>등록된 국민연금이 없습니다</div>
        )}
        {(!hasSelfNational || !hasSpouseNational) && (
          <button className={styles.addButton} onClick={() => handleAddNational()}>
            <Plus size={16} />
            국민연금 추가
          </button>
        )}
      </div>

      {/* 퇴직연금 */}
      <div className={styles.summary} style={{ marginBottom: 16 }}>
        <div className={styles.summaryTitle}>퇴직연금</div>
        {retirementPensions.length > 0 ? (
          <div className={styles.itemList} style={{ marginBottom: 12 }}>
            {retirementPensions.map((item) => (
              <div key={item.id} className={styles.item} style={{ margin: 0, background: "white" }}>
                <div className={`${styles.itemIcon} ${styles[item.owner]}`}>
                  <Building2 size={18} />
                </div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemName}>
                      {item.owner === "self" ? "본인" : "배우자"}
                    </span>
                    <span className={styles.itemBadge}>{RETIREMENT_TYPE_LABELS[item.pension_type]}</span>
                  </div>
                  <div className={styles.itemMeta}>
                    적립금 {formatMoney(item.current_balance || 0)}
                  </div>
                </div>
                <div className={styles.itemActions}>
                  <button className={styles.actionBtn} onClick={() => handleEditRetirement(item)}>
                    <Pencil size={16} />
                  </button>
                  <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleDeleteRetirement(item)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#86868b", marginBottom: 12 }}>등록된 퇴직연금이 없습니다</div>
        )}
        {(!hasSelfRetirement || !hasSpouseRetirement) && (
          <button className={styles.addButton} onClick={() => handleAddRetirement()}>
            <Plus size={16} />
            퇴직연금 추가
          </button>
        )}
      </div>

      {/* 개인연금 */}
      <div className={styles.summary}>
        <div className={styles.summaryTitle}>개인연금</div>
        {personalPensions.length > 0 ? (
          <div className={styles.itemList} style={{ marginBottom: 12 }}>
            {personalPensions.map((item) => (
              <div key={item.id} className={styles.item} style={{ margin: 0, background: "white" }}>
                <div className={`${styles.itemIcon} ${styles[item.owner]}`}>
                  <Wallet size={18} />
                </div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemName}>{PERSONAL_TYPE_LABELS[item.pension_type]}</span>
                    <span className={styles.itemBadge}>
                      {item.owner === "self" ? "본인" : "배우자"}
                    </span>
                  </div>
                  <div className={styles.itemMeta}>
                    적립금 {formatMoney(item.current_balance || 0)}
                    {item.monthly_contribution && item.monthly_contribution > 0 && <> · 월 {formatMoney(item.monthly_contribution)}</>}
                  </div>
                </div>
                <div className={styles.itemActions}>
                  <button className={styles.actionBtn} onClick={() => handleEditPersonal(item)}>
                    <Pencil size={16} />
                  </button>
                  <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleDeletePersonal(item)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#86868b", marginBottom: 12 }}>등록된 개인연금이 없습니다</div>
        )}
        <button className={styles.addButton} onClick={() => handleAddPersonal()}>
          <Plus size={16} />
          개인연금 추가
        </button>
      </div>

      {/* Modals */}
      <NationalPensionModal
        isOpen={modalType === "national"}
        simulationId={simulationId}
        pension={editingNational}
        defaultOwner={defaultOwner}
        birthYear={birthYear}
        onClose={closeModal}
        onSaved={handleSaved}
      />
      <RetirementPensionModal
        isOpen={modalType === "retirement"}
        simulationId={simulationId}
        pension={editingRetirement}
        defaultOwner={defaultOwner}
        birthYear={birthYear}
        retirementAge={retirementAge}
        onClose={closeModal}
        onSaved={handleSaved}
      />
      <PersonalPensionModal
        isOpen={modalType === "personal"}
        simulationId={simulationId}
        pension={editingPersonal}
        defaultOwner={defaultOwner}
        birthYear={birthYear}
        retirementAge={retirementAge}
        onClose={closeModal}
        onSaved={handleSaved}
      />
    </div>
  );
}
