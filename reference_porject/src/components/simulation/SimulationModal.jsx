import React, { useState, useEffect } from "react";
import styles from "./SimulationModal.module.css";

/**
 * 새 시뮬레이션 생성 모달
 * 사용자가 새로운 시뮬레이션의 제목을 입력하면
 * "현재" 시뮬레이션의 모든 데이터를 복사하여 새 시뮬레이션을 생성합니다.
 *
 * @param {boolean} isOpen - 모달 열림 상태
 * @param {Function} onClose - 모달 닫기 함수
 * @param {Function} onCreate - 시뮬레이션 생성 함수 (title을 인자로 받음)
 * @param {boolean} isCreating - 생성 중 상태
 */
function SimulationModal({ isOpen, onClose, onCreate, isCreating = false }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setError("");
    }
  }, [isOpen]);

  // ESC 키로 모달 닫기 + body 스크롤 막기
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // 모달이 열릴 때 body 스크롤 막기
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      // 모달이 닫힐 때 body 스크롤 복원
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // 모달이 닫혀있으면 렌더링하지 않음
  if (!isOpen) return null;

  // 제목 유효성 검사
  const validateTitle = (value) => {
    if (!value.trim()) {
      return "시뮬레이션 제목을 입력해주세요.";
    }
    if (value.trim().length < 2) {
      return "제목은 2글자 이상 입력해주세요.";
    }
    if (value.trim().length > 30) {
      return "제목은 30글자 이하로 입력해주세요.";
    }
    return "";
  };

  // 제목 변경 핸들러
  const handleTitleChange = (e) => {
    const value = e.target.value;
    setTitle(value);

    // 실시간 유효성 검사
    const validationError = validateTitle(value);
    setError(validationError);
  };

  // 생성 핸들러
  const handleCreate = () => {
    const validationError = validateTitle(title);

    if (validationError) {
      setError(validationError);
      return;
    }

    // 부모 컴포넌트의 onCreate 함수 호출
    onCreate(title.trim());
  };

  // Enter 키로 생성
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !isCreating) {
      handleCreate();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isCreating) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        {/* 헤더 */}
        <div className={styles.header}>
          <h2 className={styles.title}>새 시뮬레이션 만들기</h2>
          {!isCreating && (
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="닫기"
            >
              ✕
            </button>
          )}
        </div>

        {/* 설명 */}
        <div className={styles.description}>
          <p className={styles.descriptionText}>
            <strong>"현재"</strong> 시뮬레이션의 모든 데이터가 복사됩니다.
            <br />
            새로운 시뮬레이션에서 자유롭게 데이터를 수정할 수 있습니다.
          </p>
        </div>

        {/* 입력 필드 */}
        <div className={styles.inputGroup}>
          <label htmlFor="simulation-title" className={styles.label}>
            시뮬레이션 제목 <span className={styles.required}>*</span>
          </label>
          <input
            id="simulation-title"
            type="text"
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleKeyDown}
            placeholder="예: 은퇴 후 제주도 이주, 자녀 유학 시나리오 등"
            className={`${styles.input} ${error ? styles.inputError : ""}`}
            disabled={isCreating}
            autoFocus
            maxLength={30}
          />

          {/* 글자 수 표시 */}
          <div className={styles.charCount}>{title.length} / 30</div>

          {/* 에러 메시지 */}
          {error && (
            <div className={styles.errorMessage}>
              <span className={styles.errorIcon}>⚠️</span>
              {error}
            </div>
          )}
        </div>

        {/* 예시 */}
        <div className={styles.examples}>
          <p className={styles.examplesTitle}>💡 제목 예시:</p>
          <div className={styles.exampleTags}>
            <button
              className={styles.exampleTag}
              onClick={() => setTitle("은퇴 후 제주도 이주")}
              disabled={isCreating}
            >
              은퇴 후 제주도 이주
            </button>
            <button
              className={styles.exampleTag}
              onClick={() => setTitle("자녀 유학 시나리오")}
              disabled={isCreating}
            >
              자녀 유학 시나리오
            </button>
            <button
              className={styles.exampleTag}
              onClick={() => setTitle("조기 은퇴 계획")}
              disabled={isCreating}
            >
              조기 은퇴 계획
            </button>
            <button
              className={styles.exampleTag}
              onClick={() => setTitle("부동산 투자 시뮬레이션")}
              disabled={isCreating}
            >
              부동산 투자 시뮬레이션
            </button>
          </div>
        </div>

        {/* 버튼 */}
        <div className={styles.buttonGroup}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isCreating}
          >
            취소
          </button>
          <button
            className={styles.createButton}
            onClick={handleCreate}
            disabled={isCreating || !!error || !title.trim()}
          >
            {isCreating ? (
              <>
                <span className={styles.spinner}></span>
                생성 중...
              </>
            ) : (
              "시뮬레이션 만들기"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimulationModal;
