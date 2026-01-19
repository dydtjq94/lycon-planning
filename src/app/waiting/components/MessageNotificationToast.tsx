"use client";

import { useEffect, useState } from "react";
import styles from "./MessageNotificationToast.module.css";

interface MessageNotificationToastProps {
  senderName: string;
  message: string;
  isVisible: boolean;
  index?: number;
  onClose: () => void;
  onClick?: () => void;
}

export function MessageNotificationToast({
  senderName,
  message,
  isVisible,
  index = 0,
  onClose,
  onClick,
}: MessageNotificationToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  // 4초 후 자동 닫기 (애니메이션 후 실제 제거)
  useEffect(() => {
    if (isVisible && !isLeaving) {
      const timer = setTimeout(() => {
        setIsLeaving(true);
        // 애니메이션 끝나고 실제 제거
        setTimeout(onClose, 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isLeaving, onClose]);

  if (!isVisible) return null;

  // 메시지 미리보기 (40자 제한)
  const preview = message.length > 40 ? message.slice(0, 40) + "..." : message;

  // 나중에 온 알림이 위에 보이도록 z-index
  const zIndex = 1000 + index;

  return (
    <div
      className={`${styles.container} ${isLeaving ? styles.leaving : ""}`}
      style={{ zIndex }}
      onClick={() => {
        setIsLeaving(true);
        setTimeout(() => {
          onClick?.();
          onClose();
        }, 300);
      }}
    >
      <div className={styles.content}>
        <div className={styles.avatar}>{senderName.charAt(0)}</div>
        <div className={styles.textArea}>
          <span className={styles.senderName}>{senderName}</span>
          <p className={styles.messagePreview}>{preview}</p>
        </div>
      </div>
    </div>
  );
}
