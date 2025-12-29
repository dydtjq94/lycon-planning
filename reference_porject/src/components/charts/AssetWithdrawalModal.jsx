import React, { useState, useEffect } from "react";
import styles from "./AssetWithdrawalModal.module.css";
import { formatAmount } from "../../utils/format";

/**
 * 자산 인출 설정 모달
 * 저축/투자 자산에서 현금으로 인출하는 금액 설정
 * 금액(만원) 또는 비율(%) 두 가지 방식으로 입력 가능
 */
function AssetWithdrawalModal({
  isOpen,
  onClose,
  year,
  savings = [],
  detailedData = [], // 해당 연도의 자산 잔액 정보
  currentRule = null, // { withdrawals: [{sourceType, sourceId, amount, percentage}] }
  withdrawableYears = [], // 인출 가능한 년도 목록 (자산이 있는 년도)
  onSave,
  onYearChange,
}) {
  // 인출 금액 (각 자산별)
  const [withdrawals, setWithdrawals] = useState({});
  // 입력 모드 (각 자산별: 'amount' | 'percentage')
  const [inputModes, setInputModes] = useState({});
  // 퍼센트 값 (각 자산별)
  const [percentages, setPercentages] = useState({});

  // 모달이 열릴 때 배경 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // 해당 연도의 자산 잔액 가져오기 (useEffect에서 사용하기 위해 먼저 계산)
  const yearData = detailedData.find((d) => d.year === year);
  const breakdown = yearData?.breakdown || {};

  // 자산별 인출 전 잔액 가져오기 (label/title로 비교, 정수로 반환)
  // preWithdrawalAmount: 인출 적용 전 연말 잔액 (퍼센트 계산용)
  const getAssetBalance = (title) => {
    const assetItem = breakdown.assetItems?.find(
      (item) => item.label === title && item.sourceType === "saving"
    );
    // 인출 전 잔액을 사용 (없으면 현재 잔액 사용)
    return Math.round(assetItem?.preWithdrawalAmount || assetItem?.amount || 0);
  };

  useEffect(() => {
    // 기존 규칙이 있으면 로드
    if (currentRule && currentRule.withdrawals && currentRule.withdrawals.length > 0) {
      const newWithdrawals = {};
      const newInputModes = {};
      const newPercentages = {};

      currentRule.withdrawals.forEach((withdrawal) => {
        if (withdrawal.percentage !== undefined && withdrawal.percentage !== null) {
          // 퍼센트 모드로 저장된 경우 - 현재 잔액 기준으로 금액 재계산
          newInputModes[withdrawal.sourceId] = "percentage";
          newPercentages[withdrawal.sourceId] = withdrawal.percentage;

          // 현재 잔액 가져와서 퍼센트로 금액 계산
          const saving = savings.find((s) => s.id === withdrawal.sourceId);
          if (saving) {
            const balance = getAssetBalance(saving.title);
            newWithdrawals[withdrawal.sourceId] = Math.round(balance * (withdrawal.percentage / 100));
          } else {
            newWithdrawals[withdrawal.sourceId] = 0;
          }
        } else {
          // 금액 모드로 저장된 경우
          newInputModes[withdrawal.sourceId] = "amount";
          newWithdrawals[withdrawal.sourceId] = withdrawal.amount;
        }
      });

      setWithdrawals(newWithdrawals);
      setInputModes(newInputModes);
      setPercentages(newPercentages);
    } else {
      setWithdrawals({});
      setInputModes({});
      setPercentages({});
    }
  }, [currentRule, isOpen, year, detailedData, savings]);

  // ESC 키로 모달 닫기 및 방향키로 연도 이동
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (!withdrawableYears || withdrawableYears.length === 0) return;

        const currentIndex = withdrawableYears.findIndex(
          (item) => item.year === year
        );
        if (currentIndex === -1) return;

        let newIndex = currentIndex;
        if (e.key === "ArrowRight") {
          newIndex = currentIndex + 1;
        } else if (e.key === "ArrowLeft") {
          newIndex = currentIndex - 1;
        }

        if (newIndex >= 0 && newIndex < withdrawableYears.length) {
          const newYearData = withdrawableYears[newIndex];
          if (onYearChange) {
            onYearChange(newYearData.year);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, year, withdrawableYears, onYearChange]);

  if (!isOpen) return null;

  // 기존 인출 규칙에 있는 자산 ID 목록
  const existingWithdrawalIds = currentRule?.withdrawals?.map(w => w.sourceId) || [];

  // 활성 저축 상품 필터링 (잔액이 있거나 기존 인출 규칙이 있는 저축)
  const activeSavings = savings.filter((saving) => {
    // 기존 인출 규칙이 있으면 항상 표시
    if (existingWithdrawalIds.includes(saving.id)) {
      return true;
    }
    // 잔액 확인 (label로 비교)
    const assetItem = breakdown.assetItems?.find(
      (item) => item.label === saving.title && item.sourceType === "saving"
    );
    return assetItem && assetItem.amount > 0;
  });

  // 총 인출 금액 계산
  const totalWithdrawal = Object.values(withdrawals).reduce(
    (sum, amount) => sum + (amount || 0),
    0
  );

  // 입력 모드 변경 (모드 변경 시 값 초기화)
  const handleModeChange = (id, mode) => {
    setInputModes({
      ...inputModes,
      [id]: mode,
    });
    // 값 초기화
    setWithdrawals({
      ...withdrawals,
      [id]: 0,
    });
    setPercentages({
      ...percentages,
      [id]: 0,
    });
  };

  // 금액 입력 업데이트
  const handleWithdrawalChange = (id, value) => {
    const numValue = value === "" ? 0 : parseInt(value);
    setWithdrawals({
      ...withdrawals,
      [id]: isNaN(numValue) ? 0 : Math.max(0, numValue),
    });
    // 금액 모드로 전환
    setInputModes({
      ...inputModes,
      [id]: "amount",
    });
  };

  // 퍼센트 입력 업데이트
  const handlePercentageChange = (id, value, balance) => {
    const numValue = value === "" ? 0 : parseFloat(value);
    const validValue = isNaN(numValue) ? 0 : Math.min(100, Math.max(0, numValue));

    setPercentages({
      ...percentages,
      [id]: validValue,
    });

    // 퍼센트를 금액으로 변환하여 저장
    const calculatedAmount = Math.round((balance * validValue) / 100);
    setWithdrawals({
      ...withdrawals,
      [id]: calculatedAmount,
    });

    // 퍼센트 모드로 전환
    setInputModes({
      ...inputModes,
      [id]: "percentage",
    });
  };

  // 전액 인출 버튼 (100%로 설정)
  const handleWithdrawAll = (id, title) => {
    const balance = getAssetBalance(title);
    setWithdrawals({
      ...withdrawals,
      [id]: balance,
    });
    setPercentages({
      ...percentages,
      [id]: 100,
    });
    setInputModes({
      ...inputModes,
      [id]: "percentage",
    });
  };

  // 저장
  const handleSave = () => {
    // 잔액 초과 검사 (잔액이 있는 자산만)
    for (const [id, amount] of Object.entries(withdrawals)) {
      if (amount > 0) {
        const saving = savings.find((s) => s.id === id);
        if (saving) {
          const balance = getAssetBalance(saving.title);
          // 잔액이 있는 경우에만 초과 검사
          if (balance > 0 && amount > balance) {
            alert(`${saving.title}의 잔액(${formatAmount(balance)})을 초과할 수 없습니다.`);
            return;
          }
        }
      }
    }

    // withdrawals 배열 생성 (인출 금액이 있는 모든 자산)
    const withdrawalList = [];

    for (const [id, amount] of Object.entries(withdrawals)) {
      if (amount > 0) {
        const saving = savings.find((s) => s.id === id);
        if (saving) {
          const mode = inputModes[id] || "amount";
          const withdrawalData = {
            sourceType: "saving",
            sourceId: saving.id,
            sourceTitle: saving.title,
            amount: amount,
          };

          // 퍼센트 모드인 경우 퍼센트 값도 저장
          if (mode === "percentage" && percentages[id] !== undefined) {
            withdrawalData.percentage = percentages[id];
          }

          withdrawalList.push(withdrawalData);
        }
      }
    }

    // 인출 데이터가 없으면 규칙 삭제 (null 전달)
    const rule = withdrawalList.length === 0
      ? null
      : { withdrawals: withdrawalList };

    // 현재 년도에만 적용
    onSave([year], rule);
    onClose();
  };

  // 초기화
  const handleReset = () => {
    setWithdrawals({});
    setInputModes({});
    setPercentages({});
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className={styles.modalHeader}>
          <h2>{year}년 자산 인출 설정</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className={styles.modalBody}>
          {/* 설명 */}
          <div className={styles.description}>
            <p>
              저축/투자 또는 연금 자산에서 현금으로 인출할 금액을 설정합니다.
              인출된 금액은 현금흐름 시뮬레이션에 수입으로 반영됩니다.
            </p>
          </div>

          {/* 인출 대상 목록 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <label className={styles.sectionLabel}>총 인출 금액</label>
              {totalWithdrawal > 0 && (
                <span className={styles.totalWithdrawal}>
                  {formatAmount(totalWithdrawal)}
                </span>
              )}
            </div>

            {/* 저축 상품들 */}
            {activeSavings.length > 0 && (
              <div className={styles.categorySection}>
                <div className={styles.categoryLabel}>저축/투자</div>
                {activeSavings.map((saving) => {
                  const balance = getAssetBalance(saving.title);
                  const withdrawalAmount = withdrawals[saving.id] || 0;
                  const currentMode = inputModes[saving.id] || "amount";
                  const currentPercentage = percentages[saving.id] || 0;

                  return (
                    <div key={saving.id} className={styles.withdrawalItem}>
                      <div className={styles.withdrawalRow}>
                        <div className={styles.assetInfo}>
                          <span className={styles.assetName}>{saving.title}</span>
                          <span className={styles.assetBalance}>
                            잔액: {formatAmount(balance)}
                          </span>
                        </div>
                        <div className={styles.inputGroup}>
                          {/* 모드 선택 토글 */}
                          <div className={styles.modeToggle}>
                            <button
                              type="button"
                              className={`${styles.modeButton} ${currentMode === "amount" ? styles.modeButtonActive : ""}`}
                              onClick={() => handleModeChange(saving.id, "amount")}
                            >
                              만원
                            </button>
                            <button
                              type="button"
                              className={`${styles.modeButton} ${currentMode === "percentage" ? styles.modeButtonActive : ""}`}
                              onClick={() => handleModeChange(saving.id, "percentage")}
                            >
                              %
                            </button>
                          </div>

                          {/* 금액 입력 모드 */}
                          {currentMode === "amount" && (
                            <>
                              <input
                                type="number"
                                min="0"
                                max={balance}
                                value={withdrawalAmount === 0 ? "" : withdrawalAmount}
                                placeholder="0"
                                onChange={(e) =>
                                  handleWithdrawalChange(saving.id, e.target.value)
                                }
                                onWheel={(e) => e.target.blur()}
                                className={styles.amountInput}
                              />
                              <span className={styles.unit}>만원</span>
                            </>
                          )}

                          {/* 퍼센트 입력 모드 */}
                          {currentMode === "percentage" && (
                            <>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={currentPercentage === 0 ? "" : currentPercentage}
                                placeholder="0"
                                onChange={(e) =>
                                  handlePercentageChange(saving.id, e.target.value, balance)
                                }
                                onWheel={(e) => e.target.blur()}
                                className={styles.amountInput}
                              />
                              <span className={styles.unit}>%</span>
                            </>
                          )}

                          <button
                            className={styles.allButton}
                            onClick={() => handleWithdrawAll(saving.id, saving.title)}
                            type="button"
                          >
                            전액
                          </button>
                        </div>
                      </div>
                      {/* 퍼센트 모드일 때 금액 표시 */}
                      {currentMode === "percentage" && withdrawalAmount > 0 && (
                        <div className={styles.calculatedAmount}>
                          = {formatAmount(withdrawalAmount)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeSavings.length === 0 && (
              <div className={styles.noAssets}>
                해당 년도에 인출 가능한 자산이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className={styles.modalFooter}>
          <button className={styles.resetButton} onClick={handleReset}>
            초기화
          </button>
          <div className={styles.buttonGroup}>
            <button className={styles.cancelButton} onClick={onClose}>
              취소
            </button>
            <button
              className={styles.saveButton}
              onClick={handleSave}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssetWithdrawalModal;
