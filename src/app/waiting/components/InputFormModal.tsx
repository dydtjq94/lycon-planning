"use client";

import { useEffect, useState } from "react";
import styles from "./InputFormModal.module.css";

interface InputFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function InputFormModal({ isOpen, onClose, children }: InputFormModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
  };

  useEffect(() => {
    if (isClosing) {
      const timer = setTimeout(() => {
        setIsClosing(false);
        onClose();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isClosing, onClose]);

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.overlay} ${isClosing ? styles.closing : ""}`}
      onClick={handleBackdropClick}
    >
      <div className={styles.modal}>
        {children}
      </div>
    </div>
  );
}
