import React, { useState } from "react";
import ContextMenu from "../common/ContextMenu";
import styles from "./PensionList.module.css";

/**
 * 연금 목록 컴포넌트
 */
function PensionList({
  pensions,
  onEdit = () => {},
  onDelete = () => {},
  onCopy = () => {},
  isReadOnly = false,
}) {
  const [contextMenu, setContextMenu] = useState(null);

  // 우클릭 핸들러
  const handleContextMenu = (e, pension) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      pension,
    });
  };
  const getTypeLabel = (type) => {
    switch (type) {
      case "national":
        return "국민연금";
      case "retirement":
        return "퇴직연금";
      case "personal":
        return "개인연금";
      case "severance":
        return "퇴직금/DB";
      default:
        return "연금";
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "national":
        return "#3b82f6"; // 파란색
      case "retirement":
        return "#10b981"; // 초록색
      case "personal":
        return "#f59e0b"; // 주황색
      case "severance":
        return "#8b5cf6"; // 보라색
      default:
        return "#6b7280"; // 회색
    }
  };

  const formatAmount = (amount) => {
    if (amount >= 10000) {
      const eok = Math.floor(amount / 10000);
      const man = amount % 10000;
      return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
    }
    return `${amount.toLocaleString()}만원`;
  };

  if (pensions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>등록된 연금이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.pensionList}>
      {pensions.map((pension) => (
        <div
          key={pension.id}
          className={styles.pensionItem}
          onClick={() => {
            onEdit(pension);
          }}
          onContextMenu={(e) => handleContextMenu(e, pension)}
        >
          <div className={styles.pensionHeader}>
            <div className={styles.pensionTitle}>
              {pension.title && (
                <span
                  className={styles.pensionName}
                  style={{ color: getTypeColor(pension.type) }}
                >
                  {pension.title}
                </span>
              )}
            </div>
            <div className={styles.pensionActions}>
              <button
                className={styles.deleteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(pension.id);
                }}
                title="삭제"
              >
                ×
              </button>
            </div>
          </div>

          <div className={styles.pensionContent}>
            {pension.type === "national" ? (
              // 국민연금 정보
              <>
                <div className={styles.pensionAmount}>
                  {formatAmount(pension.monthlyAmount)}/월
                </div>
                <div className={styles.pensionPeriod}>
                  {pension.startYear}년 - {pension.endYear}년
                  <br />
                  (물가상승률 {pension.inflationRate || 2.5}% 적용)
                </div>
              </>
            ) : (
              // 퇴직연금/개인연금/퇴직금 정보
              <>
                {pension.currentAmount > 0 && (
                  <div className={styles.pensionCurrentAmount}>
                    {pension.type === "severance" ? "퇴직금" : "기 보유"}:{" "}
                    {formatAmount(pension.currentAmount)}
                  </div>
                )}
                {/* 추가 적립이 있는 경우만 적립 금액 표시 */}
                {pension.contributionAmount > 0 &&
                  !(
                    pension.type === "severance" &&
                    pension.noAdditionalContribution
                  ) && (
                    <div className={styles.pensionAmount}>
                      {formatAmount(pension.contributionAmount)}/
                      {pension.contributionFrequency === "monthly"
                        ? "월"
                        : "년"}
                    </div>
                  )}
                <div className={styles.pensionPeriod}>
                  {/* 추가 적립이 있는 경우만 적립 기간 표시 */}
                  {pension.type === "severance" &&
                  !pension.noAdditionalContribution ? (
                    <>
                      적립: {pension.contributionStartYear}년 -{" "}
                      {pension.contributionEndYear}년
                      <br />
                    </>
                  ) : pension.type !== "severance" ? (
                    <>
                      적립: {pension.contributionStartYear}년 -{" "}
                      {pension.contributionEndYear}년
                      <br />
                    </>
                  ) : null}
                  수령: {pension.paymentStartYear}년부터{" "}
                  {pension.paymentYears ||
                    (pension.paymentEndYear
                      ? pension.paymentEndYear - pension.paymentStartYear + 1
                      : 10)}
                  년간
                  <br />
                  (연평균 수익률 {pension.returnRate}% 적용, 연금인출 방식(PMT))
                </div>
              </>
            )}

            {pension.memo && (
              <div className={styles.pensionMemo}>{pension.memo}</div>
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
              onClick: () => onEdit(contextMenu.pension),
            },
            {
              icon: "📋",
              label: "복사해서 추가",
              onClick: () => onCopy(contextMenu.pension),
            },
            {
              icon: "🗑️",
              label: "삭제",
              className: "danger",
              onClick: () => onDelete(contextMenu.pension.id),
            },
          ]}
        />
      )}
    </div>
  );
}

export default PensionList;
