import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ProfileChecklistPanel.module.css";

const createItemId = () =>
  `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function ProfileChecklistPanel({
  items,
  onItemsChange,
  isLoading,
  isSaving,
  disabled,
  isAdmin = false, // 관리자 여부
  onOpenTemplateModal = null, // 템플릿 설정 모달 열기 콜백
}) {
  const [editingState, setEditingState] = useState(null);
  const skipNextBlurCommitRef = useRef(false);
  const [dragState, setDragState] = useState(null); // { type: 'top'|'child', id, parentId? }
  const [dropTarget, setDropTarget] = useState(null); // { type, id, parentId? }

  const topLevelItems = useMemo(() => items || [], [items]);
  const isInteractionDisabled = disabled || isLoading;

  useEffect(() => {
    if (!editingState) return;
    const { id, parentId } = editingState;
    const exists = parentId
      ? topLevelItems.some(
          (item) =>
            item.id === parentId &&
            (item.children || []).some((child) => child.id === id)
        )
      : topLevelItems.some((item) => item.id === id);
    if (!exists) {
      setEditingState(null);
    }
  }, [editingState, topLevelItems]);

  const startEditing = (item, parentId = null, options = {}) => {
    if (isInteractionDisabled) return;
    setEditingState({
      id: item.id,
      parentId,
      value: item.title || "",
      initialValue: item.title || "",
      isNew: options.isNew || false,
    });
    skipNextBlurCommitRef.current = false;
  };

  const applyItemsChange = (nextItems, shouldPersist) => {
    onItemsChange?.(nextItems, { persist: shouldPersist });
  };

  const handleAddTopLevelAfter = (afterId = null) => {
    if (isInteractionDisabled) return;
    const newItem = {
      id: createItemId(),
      title: "",
      checked: false,
      children: [],
    };
    const nextItems = [...topLevelItems];
    if (afterId) {
      const index = nextItems.findIndex((item) => item.id === afterId);
      const insertIndex = index >= 0 ? index + 1 : nextItems.length;
      nextItems.splice(insertIndex, 0, newItem);
    } else {
      nextItems.push(newItem);
    }
    applyItemsChange(nextItems, false);
    startEditing(newItem, null, { isNew: true });
  };

  const handleAddChild = (parentId) => {
    if (isInteractionDisabled) return;
    const newChild = {
      id: createItemId(),
      title: "",
      checked: false,
    };
    const nextItems = topLevelItems.map((item) => {
      if (item.id !== parentId) return item;
      const children = item.children ? [...item.children] : [];
      children.push(newChild);
      return { ...item, children };
    });
    applyItemsChange(nextItems, false);
    startEditing(newChild, parentId, { isNew: true });
  };

  const removeItem = (targetId, parentId) => {
    const nextItems = parentId
      ? topLevelItems.map((item) => {
          if (item.id !== parentId) return item;
          const filteredChildren = (item.children || []).filter(
            (child) => child.id !== targetId
          );
          return { ...item, children: filteredChildren };
        })
      : topLevelItems.filter((item) => item.id !== targetId);
    return nextItems;
  };

  const handleDelete = (target, parentId = null) => {
    if (isInteractionDisabled) return;
    const nextItems = removeItem(target.id, parentId);
    applyItemsChange(nextItems, true);
    if (
      editingState &&
      editingState.id === target.id &&
      editingState.parentId === parentId
    ) {
      setEditingState(null);
    }
  };

  const updateItemTitle = (targetId, parentId, title) => {
    const nextItems = parentId
      ? topLevelItems.map((item) => {
          if (item.id !== parentId) return item;
          const updatedChildren = (item.children || []).map((child) =>
            child.id === targetId ? { ...child, title } : child
          );
          return { ...item, children: updatedChildren };
        })
      : topLevelItems.map((item) =>
          item.id === targetId ? { ...item, title } : item
        );
    return nextItems;
  };

  const handleCommitEdit = (options = {}) => {
    if (!editingState) return;
    if (options.fromBlur && skipNextBlurCommitRef.current) {
      skipNextBlurCommitRef.current = false;
      return;
    }
    if (!options.fromBlur) {
      skipNextBlurCommitRef.current = true;
    }
    const trimmed = editingState.value.trim();
    if (trimmed === "") {
      if (editingState.isNew) {
        const nextItems = removeItem(editingState.id, editingState.parentId);
        applyItemsChange(nextItems, false);
      }
      setEditingState(null);
      return;
    }
    const nextItems = updateItemTitle(
      editingState.id,
      editingState.parentId,
      trimmed
    );
    applyItemsChange(nextItems, true);
    setEditingState(null);
  };

  const handleCancelEdit = () => {
    if (!editingState) return;
    if (editingState.isNew && !editingState.initialValue) {
      const nextItems = removeItem(editingState.id, editingState.parentId);
      applyItemsChange(nextItems, false);
    }
    skipNextBlurCommitRef.current = true;
    setEditingState(null);
  };

  const handleToggleTopLevel = (itemId) => {
    if (isInteractionDisabled) return;
    const nextItems = topLevelItems.map((item) => {
      if (item.id !== itemId) return item;
      const nextChecked = !item.checked;
      const updatedChildren = (item.children || []).map((child) => ({
        ...child,
        checked: nextChecked,
      }));
      return { ...item, checked: nextChecked, children: updatedChildren };
    });
    applyItemsChange(nextItems, true);
  };

  const handleToggleChild = (parentId, childId) => {
    if (isInteractionDisabled) return;
    const nextItems = topLevelItems.map((item) => {
      if (item.id !== parentId) return item;
      const updatedChildren = (item.children || []).map((child) =>
        child.id === childId ? { ...child, checked: !child.checked } : child
      );
      const allChecked =
        updatedChildren.length > 0 &&
        updatedChildren.every((child) => child.checked);
      return {
        ...item,
        children: updatedChildren,
        checked: updatedChildren.length === 0 ? item.checked : allChecked,
      };
    });
    applyItemsChange(nextItems, true);
  };

  const renderInput = (item, parentId = null) => (
    <input
      key={`${parentId || "root"}-${item.id}`}
      className={styles.editInput}
      value={
        editingState && editingState.id === item.id
          ? editingState.value
          : item.title || ""
      }
      onChange={(event) =>
        setEditingState((prev) =>
          prev && prev.id === item.id && prev.parentId === parentId
            ? { ...prev, value: event.target.value }
            : prev
        )
      }
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          handleCommitEdit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          handleCancelEdit();
        }
      }}
      onBlur={() => handleCommitEdit({ fromBlur: true })}
      autoFocus
      placeholder="체크리스트 내용을 입력하세요"
    />
  );

  const renderTopLevelItem = (item) => {
    const isEditing =
      editingState && editingState.id === item.id && !editingState.parentId;
    const isDraggingThis =
      dragState && dragState.type === "top" && dragState.id === item.id;
    const showDropBefore =
      dropTarget && dropTarget.type === "top" && dropTarget.id === item.id;
    return (
      <div
        key={item.id}
        className={`${styles.itemBlock} ${
          isDraggingThis ? styles.dragging : ""
        } ${showDropBefore ? styles.dropBeforeTop : ""}`}
        onDragOver={(e) => {
          if (!dragState || dragState.type !== "top") return;
          e.preventDefault();
          if (!showDropBefore) setDropTarget({ type: "top", id: item.id });
        }}
        onDrop={(e) => {
          if (!dragState || dragState.type !== "top") return;
          e.preventDefault();
          if (dragState.id === item.id) return;
          const fromIndex = topLevelItems.findIndex(
            (it) => it.id === dragState.id
          );
          const toIndex = topLevelItems.findIndex((it) => it.id === item.id);
          if (fromIndex < 0 || toIndex < 0) return;
          const next = [...topLevelItems];
          const [moved] = next.splice(fromIndex, 1);
          // 드롭 대상 앞에 삽입
          next.splice(toIndex, 0, moved);
          applyItemsChange(next, true);
          setDragState(null);
          setDropTarget(null);
        }}
      >
        <div className={styles.itemRow}>
          <button
            type="button"
            className={styles.dragHandle}
            draggable={!isInteractionDisabled}
            onDragStart={() => setDragState({ type: "top", id: item.id })}
            onDragEnd={() => {
              setDragState(null);
              setDropTarget(null);
            }}
            onClick={(e) => e.preventDefault()}
            aria-label="드래그하여 순서 변경"
            title="드래그하여 순서 변경"
          >
            ≡
          </button>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={!!item.checked}
              onChange={() => handleToggleTopLevel(item.id)}
              disabled={isInteractionDisabled}
            />
            <span className={styles.customCheckbox} />
          </label>
          {isEditing ? (
            renderInput(item)
          ) : (
            <button
              type="button"
              className={`${styles.itemText} ${
                item.checked ? styles.checkedText : ""
              }`}
              onClick={() => startEditing(item)}
              disabled={isInteractionDisabled}
            >
              {item.title || "내용 없는 체크리스트"}
            </button>
          )}
          <button
            type="button"
            className={styles.deleteButton}
            onClick={() => handleDelete(item)}
            disabled={isInteractionDisabled}
            title="체크리스트 삭제"
          >
            ×
          </button>
        </div>
        {(item.children || []).map((child) => renderChildItem(item.id, child))}
        <div className={styles.actionLine}>
          <button
            type="button"
            className={styles.inlineAction}
            onClick={() => handleAddChild(item.id)}
            disabled={isInteractionDisabled}
          >
            + 하위 항목 체크리스트 추가하기
          </button>
        </div>
      </div>
    );
  };

  const renderChildItem = (parentId, child) => {
    const isEditing =
      editingState &&
      editingState.id === child.id &&
      editingState.parentId === parentId;
    const isDraggingThisChild =
      dragState && dragState.type === "child" && dragState.id === child.id;
    const showDropBeforeChild =
      dropTarget &&
      dropTarget.type === "child" &&
      dropTarget.parentId === parentId &&
      dropTarget.id === child.id;
    return (
      <div
        key={child.id}
        className={`${styles.childRow} ${
          isDraggingThisChild ? styles.dragging : ""
        } ${showDropBeforeChild ? styles.dropBeforeChild : ""}`}
        onDragOver={(e) => {
          if (!dragState || dragState.type !== "child") return;
          if (dragState.parentId !== parentId) return; // 동일 부모 내에서만 허용
          e.preventDefault();
          if (!showDropBeforeChild)
            setDropTarget({ type: "child", id: child.id, parentId });
        }}
        onDrop={(e) => {
          if (!dragState || dragState.type !== "child") return;
          if (dragState.parentId !== parentId) return;
          e.preventDefault();
          if (dragState.id === child.id) return;
          const parent = topLevelItems.find((i) => i.id === parentId);
          if (!parent) return;
          const children = parent.children || [];
          const fromIndex = children.findIndex((c) => c.id === dragState.id);
          const toIndex = children.findIndex((c) => c.id === child.id);
          if (fromIndex < 0 || toIndex < 0) return;
          const nextChildren = [...children];
          const [moved] = nextChildren.splice(fromIndex, 1);
          // 드롭 대상 앞에 삽입
          nextChildren.splice(toIndex, 0, moved);
          const next = topLevelItems.map((it) =>
            it.id === parentId ? { ...it, children: nextChildren } : it
          );
          applyItemsChange(next, true);
          setDragState(null);
          setDropTarget(null);
        }}
      >
        <button
          type="button"
          className={styles.dragHandle}
          draggable={!isInteractionDisabled}
          onDragStart={() =>
            setDragState({ type: "child", id: child.id, parentId })
          }
          onDragEnd={() => {
            setDragState(null);
            setDropTarget(null);
          }}
          onClick={(e) => e.preventDefault()}
          aria-label="드래그하여 순서 변경"
          title="드래그하여 순서 변경"
        >
          ≡
        </button>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={!!child.checked}
            onChange={() => handleToggleChild(parentId, child.id)}
            disabled={isInteractionDisabled}
          />
          <span className={styles.customCheckbox} />
        </label>
        {isEditing ? (
          renderInput(child, parentId)
        ) : (
          <button
            type="button"
            className={`${styles.itemText} ${
              child.checked ? styles.checkedText : ""
            }`}
            onClick={() => startEditing(child, parentId)}
            disabled={isInteractionDisabled}
          >
            {child.title || "내용 없는 체크리스트"}
          </button>
        )}
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => handleDelete(child, parentId)}
          disabled={isInteractionDisabled}
          title="체크리스트 삭제"
        >
          ×
        </button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={styles.stateBox}>
        <p className={styles.stateText}>체크리스트를 불러오는 중입니다…</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>체크리스트</h3>
        <div className={styles.headerRight}>
          {isSaving && <span className={styles.savingBadge}>저장 중…</span>}
          {isAdmin && onOpenTemplateModal && (
            <button
              type="button"
              className={styles.settingsButton}
              onClick={onOpenTemplateModal}
              title="템플릿 설정 (관리자)"
            >
              ⚙
            </button>
          )}
        </div>
      </div>
      <div className={styles.list}>{topLevelItems.map(renderTopLevelItem)}</div>
      <button
        type="button"
        className={styles.primaryAddButton}
        onClick={() => handleAddTopLevelAfter(null)}
        disabled={isInteractionDisabled}
      >
        + 새 체크리스트 추가하기
      </button>
    </div>
  );
}

export default ProfileChecklistPanel;
