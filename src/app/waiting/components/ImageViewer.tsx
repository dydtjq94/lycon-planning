"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import styles from "./ImageViewer.module.css";

interface ImageViewerProps {
  src: string;
  onClose: () => void;
}

export function ImageViewer({ src, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistanceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // 두 손가락 사이 거리 계산
  const getDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 터치 시작
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 핀치 줌 시작
      lastDistanceRef.current = getDistance(e.touches);
    } else if (e.touches.length === 1) {
      // 드래그 시작
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      setIsDragging(true);
    }
  };

  // 터치 이동
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDistanceRef.current) {
      // 핀치 줌
      e.preventDefault();
      const newDistance = getDistance(e.touches);
      const delta = newDistance / lastDistanceRef.current;
      setScale((prev) => Math.min(Math.max(prev * delta, 1), 5));
      lastDistanceRef.current = newDistance;
    } else if (e.touches.length === 1 && lastTouchRef.current && scale > 1) {
      // 드래그 (확대된 상태에서만)
      const deltaX = e.touches[0].clientX - lastTouchRef.current.x;
      const deltaY = e.touches[0].clientY - lastTouchRef.current.y;
      setPosition((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  // 터치 종료
  const handleTouchEnd = () => {
    lastTouchRef.current = null;
    lastDistanceRef.current = null;
    setIsDragging(false);

    // 축소되면 원래 위치로
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  // 더블 탭으로 확대/축소
  const lastTapRef = useRef<number>(0);
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // 더블 탭
      if (scale > 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else {
        setScale(2.5);
      }
    }
    lastTapRef.current = now;
  };

  // 배경 클릭으로 닫기 (확대 안 된 상태에서만)
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current && scale === 1) {
      onClose();
    }
  };

  return (
    <div
      className={styles.overlay}
      ref={containerRef}
      onClick={handleBackgroundClick}
    >
      <button className={styles.closeButton} onClick={onClose}>
        <X size={24} />
      </button>

      <div
        className={styles.imageContainer}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          cursor: isDragging ? "grabbing" : scale > 1 ? "grab" : "default",
        }}
      >
        <img
          src={src}
          alt="확대 이미지"
          className={styles.image}
          draggable={false}
        />
      </div>

      {scale > 1 && (
        <div className={styles.zoomIndicator}>
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
}
