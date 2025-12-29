import React, { useState } from "react";
import { formatAmount } from "../../utils/format";
import ContextMenu from "../common/ContextMenu";
import styles from "./RealEstateList.module.css";

const RealEstateList = ({
  realEstates,
  onEdit = () => {},
  onDelete = () => {},
  onCopy = () => {},
  isReadOnly = false,
}) => {
  const [contextMenu, setContextMenu] = useState(null);

  // 우클릭 핸들러
  const handleContextMenu = (e, realEstate) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      realEstate,
    });
  };

  if (!realEstates || realEstates.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>등록된 부동산이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.realEstateList}>
      {realEstates.map((realEstate) => (
        <div
          key={realEstate.id}
          className={styles.realEstateItem}
          onClick={() => {
            onEdit(realEstate);
          }}
          onContextMenu={(e) => handleContextMenu(e, realEstate)}
        >
          <div className={styles.realEstateHeader}>
            <div className={styles.realEstateTitle}>
              <span className={styles.title}>{realEstate.title}</span>
            </div>
            <div className={styles.realEstateActions}>
              <button
                className={styles.deleteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(realEstate.id);
                }}
                title="삭제"
              >
                ×
              </button>
            </div>
          </div>

          <div className={styles.realEstateContent}>
            <div className={styles.realEstateValue}>
              부동산 가치: {formatAmount(realEstate.currentValue)}
            </div>
            <div className={styles.realEstateRate}>
              연평균 가치 상승률: {realEstate.growthRate.toFixed(2)}%
            </div>
            <div className={styles.realEstatePeriod}>
              {realEstate.startYear}년 - {realEstate.endYear}년
            </div>

            {realEstate.hasRentalIncome && (
              <div className={styles.rentalInfo}>
                <div className={styles.rentalPeriod}>
                  임대 수입: {realEstate.rentalIncomeStartYear}년 -{" "}
                  {realEstate.rentalIncomeEndYear}년
                </div>
                <div className={styles.rentalAmount}>
                  월 임대 수입: {formatAmount(realEstate.monthlyRentalIncome)}
                  /월
                </div>
              </div>
            )}

            {realEstate.convertToPension && (
              <div className={styles.pensionInfo}>
                <div className={styles.pensionPeriod}>
                  주택연금: {realEstate.pensionStartYear}년 -{" "}
                  {realEstate.pensionEndYear}년
                </div>
                <div className={styles.pensionAmount}>
                  월 수령액: {formatAmount(realEstate.monthlyPensionAmount)}/월
                </div>
              </div>
            )}

            {realEstate.memo && (
              <div className={styles.memo}>
                <span className={styles.memoText}>{realEstate.memo}</span>
              </div>
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
              onClick: () => onEdit(contextMenu.realEstate),
            },
            {
              icon: "📋",
              label: "복사해서 추가",
              onClick: () => onCopy(contextMenu.realEstate),
            },
            {
              icon: "🗑️",
              label: "삭제",
              className: "danger",
              onClick: () => onDelete(contextMenu.realEstate.id),
            },
          ]}
        />
      )}
    </div>
  );
};

export default RealEstateList;
