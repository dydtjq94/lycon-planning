import React, { useState, useEffect } from "react";
import styles from "./CashflowInvestmentModal.module.css";
import { formatAmount } from "../../utils/format";

/**
 * 현금흐름 투자 설정 모달
 * 특정 연도의 잉여 현금을 여러 자산에 비율로 분배
 */
function CashflowInvestmentModal({
  isOpen,
  onClose,
  year,
  amount,
  savings = [],
  pensions = [], // 연금 목록 추가
  currentRule = null, // { allocations: [{targetType, targetId, ratio}] }
  positiveYears = [], // 양수 현금흐름이 있는 년도 목록
  onSave,
  onYearChange, // 연도 변경 콜백 (년도 이동 시 호출)
}) {
  // 선택된 년도들 (기본: 현재 년도만)
  const [selectedYears, setSelectedYears] = useState([year]);

  // 범위 슬라이더용 상태 (인덱스 기반)
  const [rangeStartIdx, setRangeStartIdx] = useState(0);
  const [rangeEndIdx, setRangeEndIdx] = useState(0);

  // 배분 비율 (현금 + 각 저축 상품별)
  const [ratios, setRatios] = useState({
    cash: 100, // 현금은 기본 100%
  });

  // 모달이 열릴 때 배경 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // cleanup: 컴포넌트 unmount 시 원래대로
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    // 현재 년도의 인덱스 찾기
    const currentYearIdx = positiveYears.findIndex(
      (item) => item.year === year
    );

    // 범위 인덱스 설정 (현재 년도만 선택)
    // ⚠️ 중요: 범위 인덱스만 설정하면 두 번째 useEffect에서 selectedYears가 자동 계산됨
    if (currentYearIdx !== -1) {
      setRangeStartIdx(currentYearIdx);
      setRangeEndIdx(currentYearIdx);
      // 범위 useEffect가 트리거되기 전에 직접 selectedYears 설정 (경쟁 조건 방지)
      setSelectedYears([year]);
    } else {
      setRangeStartIdx(0);
      setRangeEndIdx(0);
      // 인덱스를 찾지 못한 경우에도 현재 년도만 선택
      setSelectedYears([year]);
    }

    // 기존 규칙이 있으면 로드
    if (currentRule && currentRule.allocations && currentRule.allocations.length > 0) {
      const newRatios = { cash: 0 };
      currentRule.allocations.forEach((allocation) => {
        if (allocation.targetType === "cash") {
          newRatios.cash = allocation.ratio;
        } else if (allocation.targetType === "saving") {
          newRatios[allocation.targetId] = allocation.ratio;
        } else if (allocation.targetType === "pension") {
          newRatios[allocation.targetId] = allocation.ratio;
        }
      });
      
      // 총합 계산
      const totalRatio = Object.values(newRatios).reduce((sum, ratio) => sum + (ratio || 0), 0);
      
      // 총합이 100%가 아니면 기본값으로 리셋 (현금 0%는 유효한 설정임)
      if (totalRatio !== 100) {
        setRatios({ cash: 100 });
      } else {
        setRatios(newRatios);
      }
    } else {
      // 기본값: 현금 100%
      setRatios({ cash: 100 });
    }
  }, [currentRule, isOpen, year, positiveYears]);

  // ESC 키로 모달 닫기 및 방향키로 연도 이동
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        // 방향키로 연도 이동 (양수 현금흐름이 있는 년도만)
        if (!positiveYears || positiveYears.length === 0) return;

        const currentIndex = positiveYears.findIndex(
          (item) => item.year === year
        );
        if (currentIndex === -1) return;

        let newIndex = currentIndex;
        if (e.key === "ArrowRight") {
          // 다음 연도로 이동
          newIndex = currentIndex + 1;
        } else if (e.key === "ArrowLeft") {
          // 이전 연도로 이동
          newIndex = currentIndex - 1;
        }

        // 범위 체크
        if (newIndex >= 0 && newIndex < positiveYears.length) {
          const newYearData = positiveYears[newIndex];
          if (onYearChange) {
            onYearChange(newYearData.year, newYearData.amount);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, year, positiveYears, onYearChange]);

  if (!isOpen) return null;

  // 활성 저축 상품 필터링 (해당 연도에 활성화된 저축만)
  const activeSavings = savings.filter(
    (saving) => year >= saving.startYear && year < saving.endYear
  );

  // 활성 연금 필터링 (퇴직연금과 개인연금만)
  const activePensions = pensions.filter((pension) => {
    // 퇴직연금(retirement)과 개인연금(personal)만 선택 가능
    if (pension.type !== "retirement" && pension.type !== "personal") {
      return false;
    }
    // 해당 연도가 적립 시작 ~ 수령 시작 전까지 투자 가능
    // - 적립 기간: contributionStartYear ~ contributionEndYear
    // - 공백 기간: contributionEndYear < year < paymentStartYear
    // - 수령 기간: paymentStartYear ~ (투자 불가)
    return (
      year >= pension.contributionStartYear && 
      year < pension.paymentStartYear
    );
  });

  // 총 비율 계산
  const totalRatio = Object.values(ratios).reduce(
    (sum, ratio) => sum + (ratio || 0),
    0
  );

  // 비율 업데이트
  const handleRatioChange = (key, value) => {
    const numValue = value === "" ? 0 : parseInt(value);
    setRatios({
      ...ratios,
      [key]: isNaN(numValue) ? 0 : Math.min(100, Math.max(0, numValue)),
    });
  };

  // 범위 변경 시 선택된 년도 업데이트
  // ⚠️ positiveYears 의존성 제거: positiveYears 변경 시 첫 번째 useEffect에서 처리
  useEffect(() => {
    if (positiveYears.length === 0) return;

    // 인덱스 범위 내의 양수 현금흐름 년도만 선택
    const yearsInRange = positiveYears
      .slice(rangeStartIdx, rangeEndIdx + 1)
      .map((item) => item.year);

    setSelectedYears(yearsInRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStartIdx, rangeEndIdx]);

  // 저장
  const handleSave = () => {
    // 비율이 100%가 아니면 경고
    if (totalRatio !== 100) {
      alert("총 비율이 100%가 되어야 합니다.");
      return;
    }

    // allocations 배열 생성
    const allocations = [];

    // 현금
    if (ratios.cash > 0) {
      allocations.push({
        targetType: "cash",
        targetId: "",
        ratio: ratios.cash,
      });
    }

    // 저축 상품들
    activeSavings.forEach((saving) => {
      const ratio = ratios[saving.id] || 0;
      if (ratio > 0) {
        allocations.push({
          targetType: "saving",
          targetId: saving.id,
          ratio: ratio,
        });
      }
    });

    // 연금 상품들
    activePensions.forEach((pension) => {
      const ratio = ratios[pension.id] || 0;
      if (ratio > 0) {
        allocations.push({
          targetType: "pension",
          targetId: pension.id,
          ratio: ratio,
        });
      }
    });

    // 현금만 100%인 경우 규칙 삭제 (null 전달)
    // 이렇게 하면 파란색 표시도 사라지고 기본 상태로 돌아감
    const rule = ratios.cash === 100 && allocations.length === 1 
      ? null 
      : { allocations };

    // 선택된 년도들에 적용
    onSave(selectedYears, rule);
    onClose();
  };

  // 초기화
  const handleReset = () => {
    setRatios({ cash: 100 });
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className={styles.modalHeader}>
          <h2>{year}년 잉여 현금 투자 설정</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className={styles.modalBody}>
          {/* 적용 범위 선택 - 범위 슬라이더 */}
          {positiveYears.length > 1 && (
            <div className={styles.rangeSliderSection}>
              <div className={styles.sectionLabel}>적용 범위 선택</div>

              {/* 슬라이더 컨테이너 */}
              <div className={styles.sliderContainer}>
                {/* 듀얼 슬라이더 */}
                <div className={styles.dualSlider}>
                  {/* 배경 트랙 */}
                  <div className={styles.sliderTrack}>
                    {/* 선택된 범위 표시 */}
                    <div
                      className={styles.sliderRange}
                      style={{
                        left:
                          rangeStartIdx === 0
                            ? "0px"
                            : `calc(${
                                (rangeStartIdx / (positiveYears.length - 1)) *
                                100
                              }% - 12px)`,
                        right:
                          rangeEndIdx === positiveYears.length - 1
                            ? "0px"
                            : `calc(${
                                100 -
                                (rangeEndIdx / (positiveYears.length - 1)) * 100
                              }% - 12px)`,
                      }}
                    />
                  </div>

                  {/* 시작 슬라이더 (아래쪽) */}
                  <input
                    type="range"
                    min={0}
                    max={positiveYears.length - 1}
                    value={rangeStartIdx}
                    onChange={(e) => {
                      const newStartIdx = parseInt(e.target.value);
                      if (newStartIdx <= rangeEndIdx) {
                        setRangeStartIdx(newStartIdx);
                      }
                    }}
                    className={`${styles.sliderInput} ${styles.sliderInputStart}`}
                  />

                  {/* 끝 슬라이더 (위쪽) */}
                  <input
                    type="range"
                    min={0}
                    max={positiveYears.length - 1}
                    value={rangeEndIdx}
                    onChange={(e) => {
                      const newEndIdx = parseInt(e.target.value);
                      if (newEndIdx >= rangeStartIdx) {
                        setRangeEndIdx(newEndIdx);
                      }
                    }}
                    className={`${styles.sliderInput} ${styles.sliderInputEnd}`}
                  />
                </div>

                {/* 최소/최대 년도 표시 */}
                <div className={styles.minMaxLabels}>
                  <span>{positiveYears[0]?.year}</span>
                  <span>{positiveYears[positiveYears.length - 1]?.year}</span>
                </div>
              </div>

              {/* 선택된 범위 정보 */}
              <div className={styles.rangeInfo}>
                {rangeStartIdx === rangeEndIdx ? (
                  <span className={styles.rangeYears}>
                    {positiveYears[rangeStartIdx]?.year}년
                  </span>
                ) : (
                  <span className={styles.rangeYears}>
                    {positiveYears[rangeStartIdx]?.year}년 ~{" "}
                    {positiveYears[rangeEndIdx]?.year}년
                  </span>
                )}
                <span className={styles.totalAmount}>
                  {formatAmount(
                    Math.round(
                      selectedYears.reduce((sum, y) => {
                        const item = positiveYears.find(
                          (item) => item.year === y
                        );
                        return sum + (item ? item.amount : 0);
                      }, 0)
                    )
                  )}
                </span>
              </div>
            </div>
          )}

          {/* 단일 년도인 경우 간단한 정보만 표시 */}
          {positiveYears.length === 1 && (
            <div className={styles.singleYearInfo}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>적용 년도</span>
                <span className={styles.infoValue}>{year}년</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>잉여 현금</span>
                <span className={styles.infoValue}>
                  +{formatAmount(Math.round(amount))}
                </span>
              </div>
            </div>
          )}

          {/* 배분 목록 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <label className={styles.sectionLabel}>투자 배분</label>
              <span
                className={
                  totalRatio === 100
                    ? styles.ratioStatus
                    : styles.ratioStatusError
                }
              >
                총 {totalRatio}%
              </span>
            </div>

            {/* 현금 */}
            <div className={styles.allocationItem}>
              <div className={styles.allocationRow}>
                <span className={styles.targetName}>현금</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={ratios.cash === 0 ? "" : ratios.cash}
                  placeholder="0"
                  onChange={(e) => handleRatioChange("cash", e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  className={styles.ratioInput}
                />
                <span className={styles.percent}>%</span>
              </div>
            </div>

            {/* 저축 상품들 */}
            {activeSavings.length > 0 && (
              <div className={styles.categorySection}>
                <div className={styles.categoryLabel}>저축/투자</div>
                {activeSavings.map((saving) => (
                  <div key={saving.id} className={styles.allocationItem}>
                    <div className={styles.allocationRow}>
                      <span className={styles.targetName}>{saving.title}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={
                          ratios[saving.id] === 0 ? "" : ratios[saving.id] || ""
                        }
                        placeholder="0"
                        onChange={(e) =>
                          handleRatioChange(saving.id, e.target.value)
                        }
                        onWheel={(e) => e.target.blur()}
                        className={styles.ratioInput}
                      />
                      <span className={styles.percent}>%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 연금 상품들 */}
            {activePensions.length > 0 && (
              <div className={styles.categorySection}>
                <div className={styles.categoryLabel}>연금</div>
                {activePensions.map((pension) => (
                  <div key={pension.id} className={styles.allocationItem}>
                    <div className={styles.allocationRow}>
                      <span className={styles.targetName}>
                        {pension.title}
                        <span className={styles.pensionType}>
                          {pension.type === "retirement"
                            ? " (퇴직연금)"
                            : " (개인연금)"}
                        </span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={
                          ratios[pension.id] === 0
                            ? ""
                            : ratios[pension.id] || ""
                        }
                        placeholder="0"
                        onChange={(e) =>
                          handleRatioChange(pension.id, e.target.value)
                        }
                        onWheel={(e) => e.target.blur()}
                        className={styles.ratioInput}
                      />
                      <span className={styles.percent}>%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSavings.length === 0 && activePensions.length === 0 && (
              <div className={styles.noSavings}>
                해당 년도에 활성화된 저축/투자/연금 상품이 없습니다.
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
              disabled={totalRatio !== 100}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CashflowInvestmentModal;
