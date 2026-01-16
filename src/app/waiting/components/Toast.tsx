"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import styles from "./Toast.module.css";

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({
  message,
  isVisible,
  onClose,
  duration = 2500,
}: ToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsLeaving(false);
      const timer = setTimeout(() => {
        setIsLeaving(true);
        setTimeout(onClose, 300); // 애니메이션 후 닫기
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible && !isLeaving) return null;

  return (
    <div className={`${styles.toast} ${isLeaving ? styles.leaving : ""}`}>
      <div className={styles.icon}>
        <Check size={16} />
      </div>
      <span className={styles.message}>{message}</span>
    </div>
  );
}
