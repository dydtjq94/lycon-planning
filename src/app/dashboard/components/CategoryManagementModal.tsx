"use client";

import { useState, useEffect } from "react";
import { X, Plus, Pencil, Trash2, Check, GripVertical } from "lucide-react";
import { useBudgetCategories } from "@/hooks/useBudget";
import {
  createBudgetCategory,
  updateBudgetCategory,
  deleteBudgetCategory,
  reorderBudgetCategories,
  TransactionType,
  BudgetCategory,
} from "@/lib/services/budgetService";
import { useQueryClient } from "@tanstack/react-query";
import styles from "./CategoryManagementModal.module.css";

interface CategoryManagementModalProps {
  profileId: string;
  onClose: () => void;
}

export function CategoryManagementModal({
  profileId,
  onClose,
}: CategoryManagementModalProps) {
  const queryClient = useQueryClient();
  const { data: categories = [] } = useBudgetCategories(profileId);

  const [activeTab, setActiveTab] = useState<TransactionType>("income");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<BudgetCategory[]>([]);

  // 카테고리 변경 시 로컬 상태 동기화
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  // 탭별 카테고리 필터링
  const filteredCategories = localCategories.filter((cat) => cat.type === activeTab);

  // 카테고리 추가
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      await createBudgetCategory(profileId, activeTab, newCategoryName.trim());
      setNewCategoryName("");
      queryClient.invalidateQueries({ queryKey: ["budget", "categories"] });
    } catch (error) {
      console.error("카테고리 추가 실패:", error);
      alert("카테고리 추가에 실패했습니다.");
    }
  };

  // 수정 시작
  const startEdit = (category: BudgetCategory) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  // 수정 저장
  const handleUpdateCategory = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      await updateBudgetCategory(editingId, editingName.trim());
      setEditingId(null);
      setEditingName("");
      queryClient.invalidateQueries({ queryKey: ["budget", "categories"] });
    } catch (error) {
      console.error("카테고리 수정 실패:", error);
      alert("카테고리 수정에 실패했습니다.");
    }
  };

  // 삭제
  const handleDeleteCategory = async (category: BudgetCategory) => {
    if (!confirm(`"${category.name}" 카테고리를 삭제하시겠습니까?`)) return;

    try {
      await deleteBudgetCategory(category.id);
      queryClient.invalidateQueries({ queryKey: ["budget", "categories"] });
    } catch (error) {
      console.error("카테고리 삭제 실패:", error);
      alert("카테고리 삭제에 실패했습니다.");
    }
  };

  // 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedId(categoryId);
    e.dataTransfer.effectAllowed = "move";
  };

  // 드래그 오버
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = filteredCategories.findIndex((c) => c.id === draggedId);
    const targetIndex = filteredCategories.findIndex((c) => c.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // 마우스 위치로 위/아래 판단
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const isBelow = e.clientY > midY;

    // 실제 삽입 위치 계산
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      // 아래로 이동
      insertIndex = isBelow ? targetIndex : targetIndex - 1;
    } else {
      // 위로 이동
      insertIndex = isBelow ? targetIndex + 1 : targetIndex;
    }

    if (insertIndex === draggedIndex) return;

    // 로컬에서 순서 변경
    const filtered = localCategories.filter((c) => c.type === activeTab);
    const others = localCategories.filter((c) => c.type !== activeTab);

    const [draggedItem] = filtered.splice(draggedIndex, 1);
    filtered.splice(insertIndex, 0, draggedItem);

    setLocalCategories([...others, ...filtered]);
  };

  // 드래그 종료
  const handleDragEnd = async () => {
    if (!draggedId) return;

    // 현재 탭의 카테고리 ID 순서 저장
    const orderedIds = filteredCategories.map((c) => c.id);

    try {
      await reorderBudgetCategories(orderedIds);
      queryClient.invalidateQueries({ queryKey: ["budget", "categories"] });
    } catch (error) {
      console.error("순서 변경 실패:", error);
    }

    setDraggedId(null);
  };

  // ESC로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>카테고리 관리</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 탭 */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "income" ? styles.active : ""}`}
            onClick={() => setActiveTab("income")}
          >
            수입
          </button>
          <button
            className={`${styles.tab} ${activeTab === "expense" ? styles.active : ""}`}
            onClick={() => setActiveTab("expense")}
          >
            지출
          </button>
        </div>

        {/* 카테고리 목록 */}
        <div className={styles.categoryList}>
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              className={`${styles.categoryItem} ${draggedId === category.id ? styles.dragging : ""}`}
              draggable={editingId !== category.id}
              onDragStart={(e) => handleDragStart(e, category.id)}
              onDragOver={(e) => handleDragOver(e, category.id)}
              onDragEnd={handleDragEnd}
            >
              {editingId === category.id ? (
                <div className={styles.editRow}>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdateCategory();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className={styles.editInput}
                    autoFocus
                  />
                  <button
                    className={styles.iconBtn}
                    onClick={handleUpdateCategory}
                  >
                    <Check size={16} />
                  </button>
                  <button className={styles.iconBtn} onClick={cancelEdit}>
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.dragHandle}>
                    <GripVertical size={14} />
                  </div>
                  <span className={styles.categoryName}>{category.name}</span>
                  <div className={styles.actions}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => startEdit(category)}
                      title="수정"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className={styles.iconBtn}
                      onClick={() => handleDeleteCategory(category)}
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* 새 카테고리 추가 */}
        <div className={styles.addSection}>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCategory();
            }}
            placeholder="새 카테고리 이름"
            className={styles.addInput}
          />
          <button
            className={styles.addBtn}
            onClick={handleAddCategory}
            disabled={!newCategoryName.trim()}
          >
            <Plus size={16} />
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
