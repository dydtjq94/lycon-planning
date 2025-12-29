import React, { useState } from "react";
import { formatAmount } from "../../utils/format";
import ContextMenu from "../common/ContextMenu";
import styles from "./IncomeList.module.css";

/**
 * 소득 데이터 목록 컴포넌트
 */
function IncomeList({
  incomes,
  onEdit = () => {},
  onDelete = () => {},
  onCopy = () => {},
  isReadOnly = false,
}) {
  const [contextMenu, setContextMenu] = useState(null);

  // 우클릭 핸들러
  const handleContextMenu = (e, income) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      income,
    });
  };

  if (!incomes || incomes.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>등록된 소득이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.incomeList}>
      {incomes.map((income) => (
        <div
          key={income.id}
          className={styles.incomeItem}
          onClick={() => {
            onEdit(income);
          }}
          onContextMenu={(e) => handleContextMenu(e, income)}
        >
          <div className={styles.incomeInfo}>
            <div className={styles.incomeHeader}>
              <h4 className={styles.incomeTitle}>{income.title}</h4>
              <div className={styles.incomeActions}>
                <button
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(income.id);
                  }}
                  title="삭제"
                >
                  ×
                </button>
              </div>
            </div>

            <div className={styles.incomeAmount}>
              {formatAmount(income.originalAmount)}/
              {income.originalFrequency === "monthly" ? "월" : "년"}
            </div>

            <div className={styles.incomePeriod}>
              {income.startYear}년 - {income.endYear}년
              <br />
              (상승률 {income.growthRate}% 적용)
            </div>

            {income.memo && (
              <div className={styles.incomeMemo}>{income.memo}</div>
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
              onClick: () => onEdit(contextMenu.income),
            },
            {
              icon: "📋",
              label: "복사해서 추가",
              onClick: () => onCopy(contextMenu.income),
            },
            {
              icon: "🗑️",
              label: "삭제",
              className: "danger",
              onClick: () => onDelete(contextMenu.income.id),
            },
          ]}
        />
      )}
    </div>
  );
}

export default IncomeList;
