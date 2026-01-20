import { Pencil, Trash2, Link } from "lucide-react";
import styles from "./DataCard.module.css";

interface DataCardProps {
  type: string;
  title: string;
  amount: string;
  subInfo?: string;
  owner?: string;
  isLinked?: boolean;
  linkedLabel?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function DataCard({
  type,
  title,
  amount,
  subInfo,
  owner,
  isLinked,
  linkedLabel,
  onEdit,
  onDelete,
}: DataCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.type}>{type}</span>
        <div className={styles.headerRight}>
          {owner && <span className={styles.owner}>{owner}</span>}
          {isLinked && (
            <span className={styles.linkedBadge}>
              <Link size={10} />
              {linkedLabel || "연결됨"}
            </span>
          )}
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.info}>
          <div className={styles.title}>{title}</div>
          <div className={styles.amount}>{amount}</div>
          {subInfo && <div className={styles.subInfo}>{subInfo}</div>}
        </div>
        {!isLinked && (onEdit || onDelete) && (
          <div className={styles.actions}>
            {onEdit && (
              <button
                className={styles.actionBtn}
                onClick={onEdit}
                type="button"
                title="편집"
              >
                <Pencil size={14} />
              </button>
            )}
            {onDelete && (
              <button
                className={`${styles.actionBtn} ${styles.deleteBtn}`}
                onClick={onDelete}
                type="button"
                title="삭제"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
