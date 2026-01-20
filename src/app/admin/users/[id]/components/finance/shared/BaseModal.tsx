import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import styles from "./BaseModal.module.css";

interface BaseModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  children: ReactNode;
}

export function BaseModal({
  title,
  isOpen,
  onClose,
  onSave,
  saveLabel = "저장",
  saveDisabled = false,
  children,
}: BaseModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            취소
          </button>
          <button
            className={styles.saveBtn}
            onClick={onSave}
            type="button"
            disabled={saveDisabled}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
