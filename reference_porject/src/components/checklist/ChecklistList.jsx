import React, { useState } from "react";
import styles from "./ChecklistList.module.css";

/**
 * 체크리스트 목록 컴포넌트
 */
function ChecklistList({ checklist, onUpdate, onDelete }) {
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingSubItemId, setEditingSubItemId] = useState(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newSubItemTitle, setNewSubItemTitle] = useState("");

  // 메인 항목 추가
  const handleAddItem = () => {
    if (!newItemTitle.trim()) return;

    const newItem = {
      id: `item_${Date.now()}`,
      title: newItemTitle,
      checked: false,
      subItems: [],
    };

    const updatedItems = [...(checklist.items || []), newItem];
    onUpdate({ ...checklist, items: updatedItems });
    setNewItemTitle("");
  };

  // 하위 항목 추가
  const handleAddSubItem = (itemId) => {
    if (!newSubItemTitle.trim()) return;

    const updatedItems = checklist.items.map((item) => {
      if (item.id === itemId) {
        const newSubItem = {
          id: `sub_${Date.now()}`,
          title: newSubItemTitle,
          checked: false,
        };
        return {
          ...item,
          subItems: [...(item.subItems || []), newSubItem],
        };
      }
      return item;
    });

    onUpdate({ ...checklist, items: updatedItems });
    setNewSubItemTitle("");
    setEditingSubItemId(null);
  };

  // 체크박스 토글 (메인 항목)
  const handleToggleItem = (itemId) => {
    const updatedItems = checklist.items.map((item) => {
      if (item.id === itemId) {
        const newChecked = !item.checked;
        // 부모 체크시 모든 하위 항목도 체크
        const updatedSubItems = item.subItems.map((subItem) => ({
          ...subItem,
          checked: newChecked,
        }));
        return { ...item, checked: newChecked, subItems: updatedSubItems };
      }
      return item;
    });
    onUpdate({ ...checklist, items: updatedItems });
  };

  // 체크박스 토글 (하위 항목)
  const handleToggleSubItem = (itemId, subItemId) => {
    const updatedItems = checklist.items.map((item) => {
      if (item.id === itemId) {
        const updatedSubItems = item.subItems.map((subItem) => {
          if (subItem.id === subItemId) {
            return { ...subItem, checked: !subItem.checked };
          }
          return subItem;
        });
        // 모든 하위 항목이 체크되어 있으면 메인 항목도 체크
        const allChecked =
          updatedSubItems.length > 0 &&
          updatedSubItems.every((subItem) => subItem.checked);
        return {
          ...item,
          subItems: updatedSubItems,
          checked: allChecked,
        };
      }
      return item;
    });
    onUpdate({ ...checklist, items: updatedItems });
  };

  // 항목 제목 편집
  const handleEditItem = (itemId, newTitle) => {
    if (!newTitle.trim()) return;

    const updatedItems = checklist.items.map((item) => {
      if (item.id === itemId) {
        return { ...item, title: newTitle };
      }
      return item;
    });
    onUpdate({ ...checklist, items: updatedItems });
    setEditingItemId(null);
  };

  // 하위 항목 제목 편집
  const handleEditSubItem = (itemId, subItemId, newTitle) => {
    if (!newTitle.trim()) return;

    const updatedItems = checklist.items.map((item) => {
      if (item.id === itemId) {
        const updatedSubItems = item.subItems.map((subItem) => {
          if (subItem.id === subItemId) {
            return { ...subItem, title: newTitle };
          }
          return subItem;
        });
        return { ...item, subItems: updatedSubItems };
      }
      return item;
    });
    onUpdate({ ...checklist, items: updatedItems });
    setEditingSubItemId(null);
  };

  // 항목 삭제
  const handleDeleteItem = (itemId) => {
    const updatedItems = checklist.items.filter((item) => item.id !== itemId);
    onUpdate({ ...checklist, items: updatedItems });
  };

  // 하위 항목 삭제
  const handleDeleteSubItem = (itemId, subItemId) => {
    const updatedItems = checklist.items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          subItems: item.subItems.filter((sub) => sub.id !== subItemId),
        };
      }
      return item;
    });
    onUpdate({ ...checklist, items: updatedItems });
  };

  return (
    <div className={styles.checklistContainer}>
      {/* 체크리스트 제목 */}
      <div className={styles.checklistHeader}>
        <h3 className={styles.checklistTitle}>{checklist.title}</h3>
        {onDelete && (
          <button
            className={styles.deleteButton}
            onClick={() => onDelete(checklist.id)}
            title="체크리스트 삭제"
          >
            🗑️
          </button>
        )}
      </div>

      {/* 항목 목록 */}
      {checklist.items && checklist.items.length > 0 ? (
        <div className={styles.itemsList}>
          {checklist.items.map((item) => (
            <div key={item.id} className={styles.item}>
              {/* 메인 항목 */}
              <div className={styles.itemHeader}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleToggleItem(item.id)}
                    className={styles.checkbox}
                  />
                  <span className={styles.checkmark}></span>
                </label>
                {editingItemId === item.id ? (
                  <input
                    className={styles.editInput}
                    defaultValue={item.title}
                    onBlur={(e) => handleEditItem(item.id, e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleEditItem(item.id, e.target.value);
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    className={`${styles.itemTitle} ${
                      item.checked ? styles.checked : ""
                    }`}
                    onClick={() => setEditingItemId(item.id)}
                  >
                    {item.title}
                  </span>
                )}
                <button
                  className={styles.deleteItemButton}
                  onClick={() => handleDeleteItem(item.id)}
                >
                  ×
                </button>
              </div>

              {/* 하위 항목 */}
              <div className={styles.subItems}>
                {item.subItems && item.subItems.length > 0 && (
                  <>
                    {item.subItems.map((subItem) => (
                      <div key={subItem.id} className={styles.subItem}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={subItem.checked}
                            onChange={() =>
                              handleToggleSubItem(item.id, subItem.id)
                            }
                            className={styles.checkbox}
                          />
                          <span className={styles.checkmark}></span>
                        </label>
                        {editingSubItemId === `${item.id}_${subItem.id}` ? (
                          <input
                            className={styles.editInput}
                            defaultValue={subItem.title}
                            onBlur={(e) =>
                              handleEditSubItem(
                                item.id,
                                subItem.id,
                                e.target.value
                              )
                            }
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                handleEditSubItem(
                                  item.id,
                                  subItem.id,
                                  e.target.value
                                );
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`${styles.subItemTitle} ${
                              subItem.checked ? styles.checked : ""
                            }`}
                            onClick={() =>
                              setEditingSubItemId(`${item.id}_${subItem.id}`)
                            }
                          >
                            {subItem.title}
                          </span>
                        )}
                        <button
                          className={styles.deleteItemButton}
                          onClick={() =>
                            handleDeleteSubItem(item.id, subItem.id)
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </>
                )}

                {/* 하위 항목 추가 */}
                {editingSubItemId === item.id ? (
                  <div className={styles.addSubItemForm}>
                    <input
                      className={styles.addInput}
                      placeholder="하위 항목 입력..."
                      value={newSubItemTitle}
                      onChange={(e) => setNewSubItemTitle(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleAddSubItem(item.id);
                        }
                      }}
                      autoFocus
                    />
                    <button
                      className={styles.addButton}
                      onClick={() => handleAddSubItem(item.id)}
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.addSubItemButton}
                    onClick={() => setEditingSubItemId(item.id)}
                  >
                    + 하위 항목 추가
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>+ 버튼을 눌러 항목을 추가하세요</p>
      )}

      {/* 메인 항목 추가 */}
      <div className={styles.addItemForm}>
        <input
          className={styles.addInput}
          placeholder="새 항목 입력..."
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handleAddItem();
            }
          }}
        />
        <button className={styles.addButton} onClick={handleAddItem}>
          + 추가
        </button>
      </div>
    </div>
  );
}

export default ChecklistList;
