import React, { useMemo, useEffect, memo } from "react";
import { PieChart, Pie, Cell, Label } from "recharts";
import { formatAmount, formatAmountForChart } from "../../utils/format";
import styles from "./YearDetailPanel.module.css";

// 카테고리별로 그룹화된 자산 파이차트 (왼쪽 차트 + 오른쪽 범례)
const SimplePieChart = memo(({ assetData }) => {
  if (!assetData || assetData.length === 0) {
    return <div className={styles.noDistributionData}>데이터 없음</div>;
  }

  // 총 합계 계산
  const totalValue = assetData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={styles.pieChartContainer}>
      {/* 왼쪽: 파이 차트 */}
      <div className={styles.pieChartLeft}>
        <PieChart
          width={200}
          height={200}
          margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Pie
            data={assetData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={45}
            paddingAngle={2}
            animationDuration={500}
            animationBegin={0}
            animationEasing="ease-out"
            isAnimationActive={true}
          >
            {assetData.map((slice, index) => (
              <Cell key={`asset-${index}`} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </div>

      {/* 오른쪽: 범례 */}
      <div className={styles.pieChartLegend}>
        {assetData.map((item, index) => {
          const percent = ((item.value / totalValue) * 100).toFixed(1);
          return (
            <div key={index} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ backgroundColor: item.color }}
              />
              <span className={styles.legendName}>{item.name}</span>
              <span className={styles.legendPercent}>{percent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

SimplePieChart.displayName = "SimplePieChart";

/**
 * 년도별 자산/부채 구성 및 이벤트 상세 패널
 * 오른쪽에서 슬라이드로 나타남
 */
function YearDetailPanel({
  isOpen,
  onClose,
  yearData, // { year, age, breakdown: { assetItems, debtItems }, ... }
  detailedData = [],
  savings = [],
  pensions = [],
  realEstates = [],
  assets = [],
  debts = [],
  incomes = [],
  expenses = [],
  onYearChange, // 연도 변경 콜백 (년도 이동 시 호출)
}) {
  // 자산 색상 매핑 (RechartsAssetChart와 동일)
  const getAssetColor = (category) => {
    const colors = {
      저축투자: "#3b82f6", // 파랑
      연금: "#eab308", // 어두운 노랑
      부동산: "#8b5cf6", // 보라
      자산: "#06b6d4", // 청록
      양수현금: "#10b981", // 초록
      음수현금: "#ef4444", // 빨강
      부채: "#374151", // 회색
    };
    return colors[category] || "#6b7280";
  };

  // 카테고리 및 색상 판별 (sourceType 기반)
  const getCategoryAndColor = (item) => {
    // sourceType이 있으면 우선 사용
    if (item.sourceType) {
      switch (item.sourceType) {
        case "cash":
          // 현금: 금액에 따라 색상 결정
          if (item.amount >= 0) {
            return {
              category: "양수현금",
              order: 5,
              color: getAssetColor("양수현금"),
            };
          } else {
            return {
              category: "음수현금",
              order: 6,
              color: getAssetColor("음수현금"),
            };
          }
        case "saving":
          return {
            category: "저축투자",
            order: 1,
            color: getAssetColor("저축투자"),
          };
        case "pension":
          return {
            category: "연금",
            order: 2,
            color: getAssetColor("연금"),
          };
        case "realEstate":
          return {
            category: "부동산",
            order: 3,
            color: getAssetColor("부동산"),
          };
        case "asset":
          return {
            category: "자산",
            order: 4,
            color: getAssetColor("자산"),
          };
        case "debt":
          return {
            category: "부채",
            order: 7,
            color: getAssetColor("부채"),
          };
        default:
          return {
            category: "자산",
            order: 4,
            color: getAssetColor("자산"),
          };
      }
    }

    // sourceType이 없으면 라벨로 판별 (하위 호환성)
    const label = item.label || "";
    const amount = item.amount || 0;

    if (!label)
      return { category: "자산", order: 4, color: getAssetColor("자산") };

    // 현금인 경우: 금액에 따라 색상 결정
    if (label.includes("현금") || label.includes("cash")) {
      if (amount >= 0) {
        // 양수 현금 = 초록색
        return {
          category: "양수현금",
          order: 5,
          color: getAssetColor("양수현금"),
        };
      } else {
        // 음수 현금 = 빨강색
        return {
          category: "음수현금",
          order: 6,
          color: getAssetColor("음수현금"),
        };
      }
    }

    if (
      label.includes("저축") ||
      label.includes("투자") ||
      label.includes("예금") ||
      label.includes("적금") ||
      label.includes("채권") ||
      label.includes("주식") ||
      label.includes("펀드") ||
      label.includes("ETF") ||
      label.includes("ISA") ||
      label.includes("CMA") ||
      label.includes("청약")
    ) {
      return {
        category: "저축투자",
        order: 1,
        color: getAssetColor("저축투자"),
      };
    } else if (
      label.includes("연금") ||
      label.includes("퇴직") ||
      label.includes("국민연금") ||
      label.includes("IRP") ||
      label.includes("DB")
    ) {
      return { category: "연금", order: 2, color: getAssetColor("연금") };
    } else if (
      label.includes("부동산") ||
      label.includes("아파트") ||
      label.includes("자택") ||
      label.includes("주택") ||
      label.includes("토지") ||
      label.includes("건물") ||
      label.includes("상가")
    ) {
      return { category: "부동산", order: 3, color: getAssetColor("부동산") };
    } else {
      return { category: "자산", order: 4, color: getAssetColor("자산") };
    }
  };

  // 년도 상세 데이터 계산
  const yearDetail = useMemo(() => {
    if (!yearData) {
      return {
        assetItems: [],
        debtItems: [],
        totalAssets: 0,
        totalDebt: 0,
        netAssets: 0,
      };
    }

    // detailedData에서 해당 년도의 breakdown 찾기
    const yearDetailData = detailedData.find(
      (item) => item.year === yearData.year
    );

    if (!yearDetailData || !yearDetailData.breakdown) {
      return {
        assetItems: [],
        debtItems: [],
        totalAssets: 0,
        totalDebt: 0,
        netAssets: 0,
      };
    }

    // 자산 항목: 카테고리별 정렬 + 색상 적용
    const assetItems = yearDetailData.breakdown.assetItems || [];
    const sortedAssetItems = [...assetItems]
      .map((item) => {
        const { category, order, color } = getCategoryAndColor(item);
        return { ...item, category, order, color };
      })
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return Math.abs(b.amount) - Math.abs(a.amount);
      });

    // 부채 항목: 현금 먼저, 나머지는 절대값 큰 순서 + 색상 적용
    const debtItems = yearDetailData.breakdown.debtItems || [];
    const sortedDebtItems = [...debtItems]
      .map((item) => {
        const isCash =
          item.label?.includes("현금") || item.label?.includes("cash");
        return {
          ...item,
          isCash,
          color: isCash ? getAssetColor("음수현금") : getAssetColor("부채"),
        };
      })
      .sort((a, b) => {
        if (a.isCash && !b.isCash) return -1;
        if (!a.isCash && b.isCash) return 1;
        return Math.abs(b.amount) - Math.abs(a.amount);
      });

    const totalAssets = sortedAssetItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const totalDebt = sortedDebtItems.reduce(
      (sum, item) => sum + Math.abs(item.amount),
      0
    );

    return {
      assetItems: sortedAssetItems,
      debtItems: sortedDebtItems,
      totalAssets,
      totalDebt,
      netAssets: totalAssets - totalDebt,
    };
  }, [yearData, detailedData]);

  // 파이 차트용 데이터 생성 (카테고리별로 그룹화)
  const assetPieData = useMemo(() => {
    // 카테고리별로 그룹화
    const categoryMap = {};

    yearDetail.assetItems
      .filter((item) => item.amount > 0)
      .forEach((item) => {
        const category = item.category || "자산";
        if (!categoryMap[category]) {
          // "양수현금"은 "현금"으로 표시
          const displayName = category === "양수현금" ? "현금" : category;
          categoryMap[category] = {
            name: displayName,
            value: 0,
            color: item.color,
            order: item.order || 999,
          };
        }
        categoryMap[category].value += item.amount;
      });

    // 배열로 변환하고 정렬
    return Object.values(categoryMap).sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return b.value - a.value;
    });
  }, [yearDetail.assetItems]);

  const debtPieData = useMemo(() => {
    return yearDetail.debtItems
      .map((item) => ({
        name: item.label,
        value: Math.abs(item.amount),
        originalValue: item.amount,
        color: item.color,
      }))
      .sort((a, b) => b.value - a.value);
  }, [yearDetail.debtItems]);

  // 해당 년도의 이벤트 수집
  const yearEvents = useMemo(() => {
    if (!yearData) return [];

    const events = [];
    const year = yearData.year;

    // 저축/투자 이벤트
    savings.forEach((saving) => {
      if (year === saving.startYear) {
        events.push({
          type: "저축/투자 시작",
          title: saving.title,
          color: "#3b82f6",
        });
      }
      if (year === saving.endYear) {
        events.push({
          type: "저축/투자 종료",
          title: saving.title,
          color: "#3b82f6",
        });
      }
    });

    // 연금 이벤트
    pensions.forEach((pension) => {
      if (year === pension.startYear) {
        events.push({
          type: "연금 수령 시작",
          title: pension.title,
          color: "#eab308", // 어두운 노랑
        });
      }
      if (year === pension.endYear) {
        events.push({
          type: "연금 수령 종료",
          title: pension.title,
          color: "#eab308",
        });
      }
    });

    // 부동산 이벤트
    realEstates.forEach((re) => {
      if (year === re.purchaseYear) {
        events.push({
          type: "부동산 매입",
          title: re.title,
          color: "#8b5cf6", // 보라
        });
      }
      if (year === re.sellYear) {
        events.push({
          type: "부동산 매각",
          title: re.title,
          color: "#8b5cf6",
        });
      }
    });

    // 자산 이벤트
    assets.forEach((asset) => {
      if (year === asset.purchaseYear) {
        events.push({
          type: "자산 매입",
          title: asset.title,
          color: "#06b6d4", // 청록
        });
      }
      if (year === asset.sellYear) {
        events.push({
          type: "자산 매각",
          title: asset.title,
          color: "#06b6d4",
        });
      }
    });

    // 부채 이벤트
    debts.forEach((debt) => {
      if (year === debt.startYear) {
        events.push({
          type: "대출 시작",
          title: debt.title,
          color: "#374151", // 회색
        });
      }
      if (year === debt.endYear) {
        events.push({
          type: "대출 상환 완료",
          title: debt.title,
          color: "#374151",
        });
      }
    });

    // 소득 이벤트
    incomes.forEach((income) => {
      if (year === income.startYear) {
        events.push({
          type: "소득 시작",
          title: income.title,
          color: "#10b981",
        });
      }
      if (year === income.endYear) {
        events.push({
          type: "소득 종료",
          title: income.title,
          color: "#10b981",
        });
      }
    });

    // 지출 이벤트
    expenses.forEach((expense) => {
      if (year === expense.startYear) {
        events.push({
          type: "지출 시작",
          title: expense.title,
          color: "#ef4444",
        });
      }
      if (year === expense.endYear) {
        events.push({
          type: "지출 종료",
          title: expense.title,
          color: "#ef4444",
        });
      }
    });

    return events;
  }, [
    yearData,
    savings,
    pensions,
    realEstates,
    assets,
    debts,
    incomes,
    expenses,
  ]);

  // 패널이 열릴 때 배경 스크롤 방지
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

  // ESC 키로 패널 닫기 및 방향키로 연도 이동
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        // 방향키로 연도 이동
        if (!yearData || !detailedData || detailedData.length === 0) return;

        const currentIndex = detailedData.findIndex(
          (item) => item.year === yearData.year
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
        if (newIndex >= 0 && newIndex < detailedData.length) {
          const newYearData = detailedData[newIndex];
          if (onYearChange) {
            onYearChange(newYearData);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, yearData, detailedData, onYearChange]);

  // 총 자산/부채 계산
  const totalAssetValue = yearDetail.totalAssets || 0;
  const totalDebtValue = yearDetail.totalDebt || 0;
  const hasAssetItems =
    yearDetail.assetItems.filter((item) => item.amount > 0).length > 0;
  const hasDebtItems = debtPieData.length > 0;
  const hasEvents = yearEvents.length > 0;
  const hasAnyData = hasAssetItems || hasDebtItems || hasEvents;
  const netAssets = yearDetail.netAssets || 0;

  // 작년 대비 변동률 계산
  const yearOverYearChange = useMemo(() => {
    if (!yearData || !detailedData || detailedData.length === 0) {
      return null;
    }

    const currentYear = yearData.year;
    const previousYear = currentYear - 1;

    // 작년 데이터 찾기
    const previousYearData = detailedData.find(
      (item) => item.year === previousYear
    );

    if (!previousYearData || !previousYearData.breakdown) {
      return null;
    }

    const previousNetAssets =
      (previousYearData.breakdown.totalAssets || 0) -
      (previousYearData.breakdown.totalDebt || 0);

    // 작년 순자산이 0이면 변동률 계산 불가
    if (previousNetAssets === 0) {
      return null;
    }

    // 변동률 계산: ((현재 - 작년) / 작년) * 100
    const changePercent =
      ((netAssets - previousNetAssets) / Math.abs(previousNetAssets)) * 100;

    return {
      changePercent,
      previousNetAssets,
    };
  }, [yearData, detailedData, netAssets]);

  // 잉여현금 투자 정보 가져오기
  const yearDetailData = detailedData.find(
    (item) => item.year === yearData?.year
  );
  const investmentInfo = yearDetailData?.investmentInfo || {};
  const withdrawalDetailInfo = yearDetailData?.withdrawalInfo || {};

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={`${styles.overlay} ${isOpen ? styles.open : ""}`}
        onClick={onClose}
      />

      {/* 슬라이드 패널 */}
      <div className={`${styles.panel} ${isOpen ? styles.open : ""}`}>
        {/* 헤더 */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            <span className={styles.titleEmphasis}>{yearData?.year}년</span>
            <span className={styles.titleAge}>({yearData?.age}세)</span>
            <span
              className={`${styles.netInline} ${
                netAssets > 0
                  ? styles.netInlinePositive
                  : netAssets < 0
                  ? styles.netInlineNegative
                  : ""
              }`}
            >
              <span className={styles.netInlineLabel}>순자산</span>
              <span
                className={`${styles.netValueInline} ${
                  netAssets > 0
                    ? styles.positive
                    : netAssets < 0
                    ? styles.negative
                    : ""
                }`}
              >
                {formatAmountForChart(netAssets)}
              </span>
              {yearOverYearChange !== null && (
                <span
                  className={`${styles.yearOverYearChange} ${
                    yearOverYearChange.changePercent >= 0
                      ? styles.positive
                      : styles.negative
                  }`}
                >
                  {yearOverYearChange.changePercent >= 0 ? "+" : ""}
                  {yearOverYearChange.changePercent.toFixed(1)}%
                </span>
              )}
            </span>
          </h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            →
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className={styles.content}>
          <div className={styles.distributionModalContent}>
            {/* 자산 파이 차트 (카테고리별) */}
            {assetPieData.length > 0 && (
              <div className={styles.compactSection}>
                <div className={styles.chartWrapper}>
                  <SimplePieChart assetData={assetPieData} />
                </div>
              </div>
            )}

            {/* 자산 리스트 (개별 항목) */}
            {hasAssetItems && (
              <div className={styles.compactSection}>
                <div className={styles.compactTitleRow}>
                  <h5 className={styles.compactTitle}>자산</h5>
                  <span className={styles.compactTotalAsset}>
                    {formatAmountForChart(totalAssetValue)}
                  </span>
                </div>
                <div className={styles.compactList}>
                  {yearDetail.assetItems
                    .filter((item) => item.amount > 0)
                    .map((item) => {
                      const percent =
                        totalAssetValue > 0
                          ? ((item.amount / totalAssetValue) * 100).toFixed(1)
                          : "0.0";

                      // 해당 자산에 대한 잉여 현금 투자 정보 확인
                      const investmentAmount = investmentInfo[item.label] || 0;
                      // 해당 자산에 대한 인출 정보 확인
                      const withdrawalAmount = withdrawalDetailInfo[item.label] || 0;

                      return (
                        <div
                          key={`asset-list-${item.label}`}
                          className={styles.compactRow}
                        >
                          <span className={styles.compactLabel}>
                            <span
                              className={styles.distributionDot}
                              style={{ backgroundColor: item.color }}
                            />
                            <span className={styles.assetNameWrapper}>
                              {item.label}
                              {investmentAmount > 0 && (
                                <span className={styles.investmentBadge}>
                                  잉여 현금 +{formatAmountForChart(investmentAmount)}
                                </span>
                              )}
                              {withdrawalAmount > 0 && (
                                <span className={styles.withdrawalBadge}>
                                  현금 인출 -{formatAmountForChart(withdrawalAmount)}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className={styles.compactValue}>
                            {formatAmountForChart(item.amount)}
                            <span className={styles.compactPercent}>
                              {percent}%
                            </span>
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* 부채 리스트 */}
            {hasDebtItems && (
              <div className={styles.compactSection}>
                <div className={styles.compactTitleRow}>
                  <h5 className={styles.compactTitle}>부채</h5>
                  <span className={styles.compactTotalDebt}>
                    {formatAmountForChart(-Math.abs(totalDebtValue))}
                  </span>
                </div>
                <div className={styles.compactList}>
                  {debtPieData.map((slice) => {
                    const percent =
                      totalDebtValue > 0
                        ? ((slice.value / totalDebtValue) * 100).toFixed(1)
                        : "0.0";
                    const debtDisplayValue =
                      slice.originalValue < 0
                        ? slice.originalValue
                        : -Math.abs(slice.value);
                    return (
                      <div
                        key={`debt-list-${slice.name}`}
                        className={styles.compactRow}
                      >
                        <span className={styles.compactLabel}>
                          <span
                            className={styles.distributionDot}
                            style={{ backgroundColor: slice.color }}
                          />
                          {slice.name}
                        </span>
                        <span className={styles.compactValue}>
                          {formatAmountForChart(debtDisplayValue)}
                          <span className={styles.compactPercent}>
                            {percent}%
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 이벤트 섹션 */}
            {yearEvents.length > 0 && (
              <div className={styles.compactSection}>
                <div className={styles.compactTitleRow}>
                  <h5 className={styles.compactTitle}>이벤트</h5>
                  <span className={styles.compactEventCount}>
                    {yearEvents.length}
                  </span>
                </div>
                <div className={styles.compactList}>
                  {yearEvents.map((event, index) => (
                    <div key={index} className={styles.compactRow}>
                      <span className={styles.compactLabel}>
                        <span
                          className={styles.eventDot}
                          style={{ backgroundColor: event.color }}
                        />
                        <span>
                          {event.type}: {event.title}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasAnyData && (
              <div className={styles.noDistributionData}>
                해당 연도의 데이터가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default YearDetailPanel;
