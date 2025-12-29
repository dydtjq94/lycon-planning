/**
 * 체크리스트 템플릿 수정 모달
 * 관리자만 접근 가능하며, 프로필 생성 시 사용되는 디폴트 체크리스트 템플릿을 수정합니다.
 */

import React, { useEffect, useState, useRef } from "react";
import { checklistTemplateService } from "../../services/firestoreService";
import { buildChecklistTemplateItems } from "../../constants/profileChecklist";
import styles from "./ChecklistTemplateModal.module.css";

const createItemId = () =>
  `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function ChecklistTemplateModal({ isOpen, onClose }) {
  const [template, setTemplate] = useState(null);
  const [items, setItems] = useState([]);
  const [isSaving, setSaving] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [editingState, setEditingState] = useState(null);
  const skipNextBlurCommitRef = useRef(false);
  const [dragState, setDragState] = useState(null); // 드래그 상태
  const [dropTarget, setDropTarget] = useState(null); // 드롭 타겟

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !editingState) {
        e.preventDefault();
        e.stopPropagation(); // 이벤트 전파 차단 (사이드바로 전달 방지)
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // capture phase에서 처리
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose, editingState]);

  // 템플릿 로드
  useEffect(() => {
    if (!isOpen) return;

    const loadTemplate = async () => {
      setLoading(true);
      try {
        let templateData = await checklistTemplateService.getTemplate();

        // 템플릿이 없으면 기본 템플릿으로 초기화
        if (!templateData) {
          console.log("템플릿이 없어서 기본 템플릿으로 초기화합니다.");
          const defaultItems = buildChecklistTemplateItems();
          templateData = await checklistTemplateService.initializeDefaultTemplate(
            defaultItems
          );
        }

        setTemplate(templateData);
        setItems(templateData.items || []);
      } catch (error) {
        console.error("템플릿 로드 실패:", error);
        alert("템플릿을 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [isOpen]);

  // 저장
  const handleSave = async () => {
    if (!template) return;

    setSaving(true);
    try {
      await checklistTemplateService.updateTemplate(template.id, {
        title: template.title,
        items: items,
      });
      alert("템플릿이 저장되었습니다.");
      onClose();
    } catch (error) {
      console.error("템플릿 저장 실패:", error);
      alert("템플릿 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 편집 시작
  const startEditing = (item, parentId = null) => {
    setEditingState({
      id: item.id,
      parentId,
      value: item.title || "",
      initialValue: item.title || "",
    });
    skipNextBlurCommitRef.current = false;
  };

  // 편집 커밋
  const commitEdit = () => {
    if (!editingState) return;

    const { id, parentId, value, initialValue } = editingState;
    const trimmedValue = value.trim();

    // 변경사항이 없으면 취소
    if (trimmedValue === initialValue) {
      setEditingState(null);
      return;
    }

    // 빈 값이면 삭제
    if (!trimmedValue) {
      const nextItems = parentId
        ? items.map((item) => {
            if (item.id !== parentId) return item;
            return {
              ...item,
              children: (item.children || []).filter((c) => c.id !== id),
            };
          })
        : items.filter((item) => item.id !== id);

      setItems(nextItems);
      setEditingState(null);
      return;
    }

    // 업데이트
    const nextItems = parentId
      ? items.map((item) => {
          if (item.id !== parentId) return item;
          return {
            ...item,
            children: (item.children || []).map((c) =>
              c.id === id ? { ...c, title: trimmedValue } : c
            ),
          };
        })
      : items.map((item) =>
          item.id === id ? { ...item, title: trimmedValue } : item
        );

    setItems(nextItems);
    setEditingState(null);
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingState(null);
  };

  // 최상위 아이템 추가
  const handleAddTopLevel = () => {
    const newItem = {
      id: createItemId(),
      title: "",
      checked: false,
      children: [],
    };
    setItems([...items, newItem]);
    startEditing(newItem, null);
  };

  // 하위 아이템 추가
  const handleAddChild = (parentId) => {
    const newChild = {
      id: createItemId(),
      title: "",
      checked: false,
    };
    const nextItems = items.map((item) => {
      if (item.id !== parentId) return item;
      const children = item.children ? [...item.children] : [];
      children.push(newChild);
      return { ...item, children };
    });
    setItems(nextItems);
    startEditing(newChild, parentId);
  };

  // 아이템 삭제
  const handleDelete = (targetId, parentId) => {
    const nextItems = parentId
      ? items.map((item) => {
          if (item.id !== parentId) return item;
          return {
            ...item,
            children: (item.children || []).filter((c) => c.id !== targetId),
          };
        })
      : items.filter((item) => item.id !== targetId);

    setItems(nextItems);
  };

  // 모달 닫기
  const handleClose = () => {
    if (editingState) {
      cancelEdit();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>체크리스트 템플릿 수정</h2>
          <button
            onClick={handleClose}
            className={styles.closeButton}
            disabled={isSaving}
          >
            ✕
          </button>
        </div>

        <div className={styles.description}>
          프로필 생성 시 사용되는 기본 체크리스트 템플릿을 수정합니다.
        </div>

        <div className={styles.itemsContainer}>
          {isLoading ? (
            <div className={styles.loadingMessage}>템플릿 로드 중...</div>
          ) : (
            <>
              {items.map((item, index) => {
                const isDragging = dragState && dragState.id === item.id;
                const showDropBefore = dropTarget && dropTarget.id === item.id;

                return (
                  <div
                    key={item.id}
                    className={`${styles.topLevelItem} ${
                      isDragging ? styles.dragging : ""
                    } ${showDropBefore ? styles.dropBefore : ""}`}
                    draggable={!editingState}
                    onDragStart={() => setDragState({ id: item.id, index })}
                    onDragEnd={() => {
                      setDragState(null);
                      setDropTarget(null);
                    }}
                    onDragOver={(e) => {
                      if (!dragState) return;
                      e.preventDefault();
                      if (!showDropBefore) setDropTarget({ id: item.id, index });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!dragState || dragState.id === item.id) return;

                      const fromIndex = items.findIndex((it) => it.id === dragState.id);
                      const toIndex = index;

                      if (fromIndex < 0 || toIndex < 0) return;

                      const nextItems = [...items];
                      const [moved] = nextItems.splice(fromIndex, 1);
                      nextItems.splice(toIndex, 0, moved);

                      setItems(nextItems);
                      setDragState(null);
                      setDropTarget(null);
                    }}
                  >
                    <div className={styles.itemRow}>
                      <button
                        type="button"
                        className={styles.dragHandle}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="드래그하여 순서 변경"
                      >
                        ≡
                      </button>
                      {editingState?.id === item.id &&
                      !editingState.parentId ? (
                      <input
                        type="text"
                        value={editingState.value}
                        onChange={(e) =>
                          setEditingState({
                            ...editingState,
                            value: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            commitEdit();
                          } else if (e.key === "Escape") {
                            cancelEdit();
                          }
                        }}
                        onBlur={() => {
                          if (!skipNextBlurCommitRef.current) {
                            commitEdit();
                          }
                          skipNextBlurCommitRef.current = false;
                        }}
                        className={styles.editInput}
                        autoFocus
                      />
                    ) : (
                      <span
                        className={styles.itemTitle}
                        onClick={() => startEditing(item, null)}
                      >
                        {item.title || "(제목 없음)"}
                      </span>
                    )}
                    <div className={styles.itemActions}>
                      <button
                        onClick={() => handleAddChild(item.id)}
                        className={styles.actionButton}
                        title="하위 항목 추가"
                      >
                        + 하위
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, null)}
                        className={styles.deleteButton}
                        title="삭제"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {item.children && item.children.length > 0 && (
                    <div className={styles.childrenContainer}>
                      {item.children.map((child, childIndex) => {
                        const isChildDragging =
                          dragState &&
                          dragState.type === "child" &&
                          dragState.id === child.id &&
                          dragState.parentId === item.id;
                        const showChildDropBefore =
                          dropTarget &&
                          dropTarget.type === "child" &&
                          dropTarget.id === child.id &&
                          dropTarget.parentId === item.id &&
                          !dropTarget.isAfter;
                        const showChildDropAfter =
                          dropTarget &&
                          dropTarget.type === "child" &&
                          dropTarget.id === child.id &&
                          dropTarget.parentId === item.id &&
                          dropTarget.isAfter === true;
                        const isLastChild = childIndex === item.children.length - 1;

                        return (
                          <div
                            key={child.id}
                            className={`${styles.childItem} ${
                              isChildDragging ? styles.dragging : ""
                            } ${showChildDropBefore ? styles.dropBefore : ""} ${
                              showChildDropAfter ? styles.dropAfter : ""
                            }`}
                            draggable={!editingState}
                            onDragStart={(e) => {
                              e.stopPropagation(); // 상위 카테고리로 전파 방지
                              setDragState({
                                type: "child",
                                id: child.id,
                                parentId: item.id,
                                index: childIndex,
                              });
                            }}
                            onDragEnd={(e) => {
                              e.stopPropagation(); // 상위 카테고리로 전파 방지
                              setDragState(null);
                              setDropTarget(null);
                            }}
                            onDragOver={(e) => {
                              if (
                                !dragState ||
                                dragState.type !== "child" ||
                                dragState.parentId !== item.id
                              )
                                return;
                              e.preventDefault();
                              e.stopPropagation(); // 상위로 전파 방지
                              
                              // 자기 자신은 드롭 타겟으로 표시하지 않음
                              if (dragState.id === child.id) return;

                              // 마우스 위치에 따라 위쪽/아래쪽 결정
                              const rect = e.currentTarget.getBoundingClientRect();
                              const mouseY = e.clientY;
                              const itemMiddle = rect.top + rect.height / 2;
                              const isAfter = mouseY > itemMiddle;

                              // 마지막 항목이고 아래쪽이면 dropAfter
                              if (isLastChild && isAfter) {
                                if (!showChildDropAfter)
                                  setDropTarget({
                                    type: "child",
                                    id: child.id,
                                    parentId: item.id,
                                    index: childIndex,
                                    isAfter: true,
                                  });
                              } else if (!isAfter && !showChildDropBefore) {
                                // 위쪽이면 dropBefore
                                setDropTarget({
                                  type: "child",
                                  id: child.id,
                                  parentId: item.id,
                                  index: childIndex,
                                  isAfter: false,
                                });
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (
                                !dragState ||
                                dragState.type !== "child" ||
                                dragState.parentId !== item.id ||
                                dragState.id === child.id
                              )
                                return;

                              const parent = items.find((i) => i.id === item.id);
                              if (!parent || !parent.children) return;

                              const fromIndex = parent.children.findIndex(
                                (c) => c.id === dragState.id
                              );
                              let toIndex = childIndex;

                              // dropAfter면 다음 위치에 삽입
                              if (dropTarget?.isAfter) {
                                toIndex = childIndex + 1;
                              }

                              if (fromIndex < 0) return;

                              const nextChildren = [...parent.children];
                              const [moved] = nextChildren.splice(fromIndex, 1);
                              
                              // fromIndex가 toIndex보다 작으면 삭제로 인해 index 조정 필요
                              const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
                              nextChildren.splice(adjustedToIndex, 0, moved);

                              const nextItems = items.map((i) =>
                                i.id === item.id
                                  ? { ...i, children: nextChildren }
                                  : i
                              );

                              setItems(nextItems);
                              setDragState(null);
                              setDropTarget(null);
                            }}
                          >
                            <button
                              type="button"
                              className={styles.dragHandle}
                              onMouseDown={(e) => e.stopPropagation()}
                              title="드래그하여 순서 변경"
                            >
                              ≡
                            </button>
                            {editingState?.id === child.id &&
                            editingState.parentId === item.id ? (
                              <input
                                type="text"
                                value={editingState.value}
                                onChange={(e) =>
                                  setEditingState({
                                    ...editingState,
                                    value: e.target.value,
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    commitEdit();
                                  } else if (e.key === "Escape") {
                                    cancelEdit();
                                  }
                                }}
                                onBlur={() => {
                                  if (!skipNextBlurCommitRef.current) {
                                    commitEdit();
                                  }
                                  skipNextBlurCommitRef.current = false;
                                }}
                                className={styles.editInput}
                                autoFocus
                              />
                            ) : (
                              <span
                                className={styles.childTitle}
                                onClick={() => startEditing(child, item.id)}
                              >
                                {child.title || "(제목 없음)"}
                              </span>
                            )}
                            <button
                              onClick={() => handleDelete(child.id, item.id)}
                              className={styles.deleteButton}
                              title="삭제"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </div>
                );
              })}

              <button
                onClick={handleAddTopLevel}
                className={styles.addTopLevelButton}
              >
                + 카테고리 추가
              </button>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            onClick={handleClose}
            className={styles.cancelButton}
            disabled={isSaving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className={styles.saveButton}
            disabled={isSaving || isLoading}
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChecklistTemplateModal;

