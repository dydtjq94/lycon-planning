import React, { useState } from "react";
import { formatAmount } from "../../utils/format";
import ContextMenu from "../common/ContextMenu";
import styles from "./AssetList.module.css";

/**
 * 자산 목록 컴포넌트
 * 기본적인 자산 정보를 표시합니다.
 */
function AssetList({
  assets,
  onEdit = () => {},
  onDelete = () => {},
  onCopy = () => {},
  isReadOnly = false,
}) {
  const [contextMenu, setContextMenu] = useState(null);

  // 우클릭 핸들러
  const handleContextMenu = (e, asset) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      asset,
    });
  };

  if (!assets || assets.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>등록된 자산이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.assetList}>
      {assets.map((asset) => (
        <div
          key={asset.id}
          className={styles.assetItem}
          onClick={() => {
            onEdit(asset);
          }}
          onContextMenu={(e) => handleContextMenu(e, asset)}
        >
          <div className={styles.assetInfo}>
            <div className={styles.assetHeader}>
              <h4 className={styles.assetTitle}>
                {asset.title === "현금" ? "현금 자산" : asset.title}
              </h4>
              <div className={styles.assetActions}>
                <button
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(asset.id, asset.title);
                  }}
                  title="삭제"
                >
                  ×
                </button>
              </div>
            </div>

            <div className={styles.assetAmount}>
              {formatAmount(asset.currentValue)}
            </div>

            <div className={styles.assetPeriod}>
              {asset.startYear}년 - {asset.endYear}년
              <br />
              (연평균 가치 상승률 {(asset.growthRate * 100).toFixed(2)}% 적용
              {asset.assetType === "income" &&
                asset.incomeRate > 0 &&
                `, 연간 수익률 (배당, 이자 등) ${(
                  asset.incomeRate * 100
                ).toFixed(2)}%`}
              )
            </div>

            {asset.memo && <div className={styles.assetMemo}>{asset.memo}</div>}
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
              onClick: () => onEdit(contextMenu.asset),
            },
            {
              icon: "📋",
              label: "복사해서 추가",
              onClick: () => onCopy(contextMenu.asset),
            },
            {
              icon: "🗑️",
              label: "삭제",
              className: "danger",
              onClick: () => onDelete(contextMenu.asset.id, contextMenu.asset.title),
            },
          ]}
        />
      )}
    </div>
  );
}

export default AssetList;
