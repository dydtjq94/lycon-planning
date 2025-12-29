import React, { useState } from "react";
import { formatAmount } from "../../utils/format";
import ContextMenu from "../common/ContextMenu";
import styles from "./DebtList.module.css";

/**
 * 부채 데이터 목록 컴포넌트
 */
function DebtList({
  debts,
  onEdit = () => {},
  onDelete = () => {},
  onCopy = () => {},
  isReadOnly = false,
}) {
  const [contextMenu, setContextMenu] = useState(null);

  // 우클릭 핸들러
  const handleContextMenu = (e, debt) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      debt,
    });
  };

  if (!debts || debts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>등록된 부채가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.debtList}>
      {debts.map((debt) => (
        <div
          key={debt.id}
          className={styles.debtItem}
          onClick={() => {
            onEdit(debt);
          }}
          onContextMenu={(e) => handleContextMenu(e, debt)}
        >
          <div className={styles.debtInfo}>
            <div className={styles.debtHeader}>
              <h4 className={styles.debtTitle}>{debt.title}</h4>
              <div className={styles.debtActions}>
                <button
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(debt.id);
                  }}
                  title="삭제"
                >
                  ×
                </button>
              </div>
            </div>

            <div className={styles.debtAmount}>
              {formatAmount(debt.debtAmount)}
            </div>

            <div className={styles.debtDetails}>
              <div className={styles.debtType}>
                {debt.debtType === "bullet"
                  ? "만기일시상환"
                  : debt.debtType === "equal"
                  ? "원리금균등상환"
                  : debt.debtType === "principal"
                  ? "원금균등상환"
                  : debt.debtType === "grace"
                  ? "거치식상환"
                  : "알 수 없음"}
                {debt.debtType === "grace" && debt.gracePeriod > 0 && (
                  <span className={styles.gracePeriod}>
                    (거치 {debt.gracePeriod}년)
                  </span>
                )}
              </div>
              <div className={styles.debtPeriod}>
                {debt.startYear}년 - {debt.endYear}년
                <br />
                (이자율 {(debt.interestRate * 100).toFixed(2)}% 적용)
              </div>
            </div>

            {debt.memo && <div className={styles.debtMemo}>{debt.memo}</div>}
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
              onClick: () => onEdit(contextMenu.debt),
            },
            {
              icon: "📋",
              label: "복사해서 추가",
              onClick: () => onCopy(contextMenu.debt),
            },
            {
              icon: "🗑️",
              label: "삭제",
              className: "danger",
              onClick: () => onDelete(contextMenu.debt.id),
            },
          ]}
        />
      )}
    </div>
  );
}

export default DebtList;
