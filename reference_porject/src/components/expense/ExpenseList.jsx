import React, { useState } from "react";
import { formatAmount } from "../../utils/format";
import ContextMenu from "../common/ContextMenu";
import styles from "./ExpenseList.module.css";

/**
 * 지출 데이터 목록 컴포넌트
 */
function ExpenseList({
  expenses,
  onEdit = () => {},
  onDelete = () => {},
  onCopy = () => {},
  isReadOnly = false,
}) {
  const [contextMenu, setContextMenu] = useState(null);

  // 우클릭 핸들러
  const handleContextMenu = (e, expense) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      expense,
    });
  };

  if (!expenses || expenses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>등록된 지출이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.expenseList}>
      {expenses.map((expense) => (
        <div
          key={expense.id}
          className={styles.expenseItem}
          onClick={() => {
            onEdit(expense);
          }}
          onContextMenu={(e) => handleContextMenu(e, expense)}
        >
          <div className={styles.expenseInfo}>
            <div className={styles.expenseHeader}>
              <h4 className={styles.expenseTitle}>{expense.title}</h4>
              <div className={styles.expenseActions}>
                <button
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(expense.id);
                  }}
                  title="삭제"
                >
                  ×
                </button>
              </div>
            </div>

            <div className={styles.expenseAmount}>
              {formatAmount(expense.amount)}/
              {expense.frequency === "monthly" ? "월" : "년"}
            </div>

            <div className={styles.expensePeriod}>
              {expense.startYear}년 - {expense.endYear}년
              <br />
              (물가 상승률 {expense.growthRate}% 적용)
            </div>

            {expense.memo && (
              <div className={styles.expenseMemo}>{expense.memo}</div>
            )}
          </div>
        </div>
      ))}

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              icon: "✏️",
              label: "수정",
              onClick: () => onEdit(contextMenu.expense),
            },
            {
              icon: "📋",
              label: "복사해서 추가",
              onClick: () => onCopy(contextMenu.expense),
            },
            {
              icon: "🗑️",
              label: "삭제",
              className: "danger",
              onClick: () => onDelete(contextMenu.expense.id),
            },
          ]}
        />
      )}
    </div>
  );
}

export default ExpenseList;
