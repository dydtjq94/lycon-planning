"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import styles from "./BottomSheet.module.css";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  categoryId: string;
  placeholder?: string;
  initialValue?: string;
  onSave: (categoryId: string, value: string) => void;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  categoryId,
  placeholder = "",
  initialValue = "",
  onSave,
}: BottomSheetProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      // 바디 스크롤 방지
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, initialValue]);

  const handleClose = () => {
    setIsClosing(true);
  };

  useEffect(() => {
    if (isClosing) {
      const timer = setTimeout(() => {
        setIsClosing(false);
        onClose();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isClosing, onClose]);

  const handleSave = () => {
    onSave(categoryId, value);
    handleClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`${styles.overlay} ${isClosing ? styles.closing : ""}`}
      onClick={handleOverlayClick}
    >
      <div className={styles.sheet}>
        <div className={styles.handle}>
          <div className={styles.handleBar} />
        </div>

        <div className={styles.header}>
          <h2 className={styles.title}>{title} 메모</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>미리 파악한 내용</label>
            <textarea
              className={styles.textarea}
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <p className={styles.hint}>
              검진 시 전문가와 상담할 때 활용됩니다.
            </p>
          </div>

          <button className={styles.saveButton} onClick={handleSave}>
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
