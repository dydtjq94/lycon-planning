import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./ContextMenu.module.css";

/**
 * ContextMenu 컴포넌트
 * 우클릭 시 나타나는 컨텍스트 메뉴
 * Portal을 사용하여 body에 직접 렌더링
 */
function ContextMenu({ x, y, onClose, items }) {
  const menuRef = useRef(null);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    // 약간의 지연을 두어 현재 클릭 이벤트와 충돌 방지
    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", handleScroll, true);
    }, 0);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // 화면 밖으로 나가지 않도록 위치 조정
  const adjustedPosition = () => {
    if (!menuRef.current) return { top: y, left: x };

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // 오른쪽으로 넘어가면 왼쪽으로 이동
    if (x + menuRect.width > viewportWidth) {
      adjustedX = viewportWidth - menuRect.width - 10;
    }

    // 아래로 넘어가면 위로 이동
    if (y + menuRect.height > viewportHeight) {
      adjustedY = viewportHeight - menuRect.height - 10;
    }

    return { top: adjustedY, left: adjustedX };
  };

  const position = adjustedPosition();

  const menuElement = (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px` 
      }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          className={`${styles.menuItem} ${item.className || ""}`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          disabled={item.disabled}
        >
          {item.icon && <span className={styles.icon}>{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  // Portal을 사용하여 body에 직접 렌더링
  return createPortal(menuElement, document.body);
}

export default ContextMenu;

