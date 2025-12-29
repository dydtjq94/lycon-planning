import React, { useMemo, memo, useRef, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { formatAmountForChart } from "../../utils/format";
import ChartRangeControl from "./ChartRangeControl";
import styles from "./RechartsIncomeExpenseChart.module.css";

/**
 * Recharts를 사용한 수입/지출 차트
 * 왼쪽에는 수입, 오른쪽에는 지출을 보여줍니다
 */
function RechartsIncomeExpenseChart({
  detailedData = [],
  retirementAge,
  profileData = null,
  xAxisRange: externalXAxisRange,
  onXAxisRangeChange,
}) {
  const chartContainerRef = useRef(null);
  const hasData = detailedData && detailedData.length > 0;

  // 카테고리별 색상 설정 (RechartsCashflowChart와 동일)
  const categoryColors = {
    소득: "#10b981",
    지출: "#ef4444",
    "저축/투자": "#3b82f6",
    연금: "#fbbf24",
    부동산: "#8b5cf6",
    자산: "#06b6d4",
    부채: "#374151",
    세금: "#8b4513",
  };

  // 카테고리 매핑 (RechartsCashflowChart와 동일)
  const categoryConfig = {
    소득: { color: "#10b981", name: "소득" },
    지출: { color: "#ef4444", name: "지출" },
    저축: { color: "#3b82f6", name: "저축/투자" },
    "저축 구매": { color: "#3b82f6", name: "저축/투자" },
    "저축 적립": { color: "#3b82f6", name: "저축/투자" },
    "저축 수령": { color: "#3b82f6", name: "저축/투자" },
    "저축 수익": { color: "#3b82f6", name: "저축/투자" },
    "저축 만기": { color: "#3b82f6", name: "저축/투자" },
    "저축 만료": { color: "#3b82f6", name: "저축/투자" },
    국민연금: { color: "#fbbf24", name: "연금" },
    퇴직연금: { color: "#fbbf24", name: "연금" },
    개인연금: { color: "#fbbf24", name: "연금" },
    "퇴직금 IRP": { color: "#fbbf24", name: "연금" },
    "퇴직금 IRP 적립": { color: "#fbbf24", name: "연금" },
    "연금 적립": { color: "#fbbf24", name: "연금" },
    부동산: { color: "#8b5cf6", name: "부동산" },
    임대소득: { color: "#8b5cf6", name: "부동산" },
    "임대 소득": { color: "#8b5cf6", name: "부동산" },
    "부동산 구매": { color: "#8b5cf6", name: "부동산" },
    "부동산 수령": { color: "#8b5cf6", name: "부동산" },
    "부동산 취득세": { color: "#8b4513", name: "세금" },
    주택연금: { color: "#8b5cf6", name: "부동산" },
    취득세: { color: "#8b4513", name: "세금" },
    양도소득세: { color: "#8b4513", name: "세금" },
    양도세: { color: "#8b4513", name: "세금" },
    자산: { color: "#06b6d4", name: "자산" },
    "자산 구매": { color: "#06b6d4", name: "자산" },
    "자산 수령": { color: "#06b6d4", name: "자산" },
    대출: { color: "#374151", name: "부채" },
    "대출 유입": { color: "#374151", name: "부채" },
    이자: { color: "#374151", name: "부채" },
    "부채 이자": { color: "#374151", name: "부채" },
    "원금 상환": { color: "#374151", name: "부채" },
    "부채 원금 상환": { color: "#374151", name: "부채" },
  };

  // 전체 데이터 범위 계산
  const availableYears = useMemo(() => {
    if (!hasData) return [];
    return detailedData.map((d) => d.year).sort((a, b) => a - b);
  }, [hasData, detailedData]);

  const minYear = availableYears[0];
  const maxYear = availableYears[availableYears.length - 1];

  // 외부에서 전달받은 범위 사용, 없으면 전체 범위 사용
  const xAxisRange =
    externalXAxisRange &&
    externalXAxisRange.start !== null &&
    externalXAxisRange.end !== null
      ? externalXAxisRange
      : { start: minYear, end: maxYear };

  // X축 범위 변경 핸들러
  const handleXAxisRangeChange = useCallback(
    (newRange) => {
      if (onXAxisRangeChange) {
        onXAxisRangeChange(newRange);
      }
    },
    [onXAxisRangeChange]
  );

  // 초기값 설정
  useEffect(() => {
    if (
      minYear &&
      maxYear &&
      externalXAxisRange &&
      externalXAxisRange.start === null &&
      externalXAxisRange.end === null &&
      onXAxisRangeChange
    ) {
      onXAxisRangeChange({ start: minYear, end: maxYear });
    }
  }, [minYear, maxYear, externalXAxisRange, onXAxisRangeChange]);

  // 은퇴년도 계산
  const retirementYear =
    profileData?.retirementYear || new Date().getFullYear();

  // 수입/지출 데이터 가공
  const { incomeData, expenseData, incomeCategories, expenseCategories } =
    useMemo(() => {
      if (!hasData) {
        return {
          incomeData: [],
          expenseData: [],
          incomeCategories: [],
          expenseCategories: [],
        };
      }

      // 필터링된 데이터
      const filteredData = detailedData.filter((item) => {
        if (xAxisRange.start === null || xAxisRange.end === null) return true;
        return item.year >= xAxisRange.start && item.year <= xAxisRange.end;
      });

      // 카테고리 수집
      const incomeCategoriesSet = new Set();
      const expenseCategoriesSet = new Set();

      // 수입 데이터 가공 (모든 연도 포함)
      const incomeByYear = {};
      filteredData.forEach((item) => {
        const yearData = { year: item.year, age: item.age };

        if (item.breakdown) {
          (item.breakdown.positives || []).forEach((positive) => {
            const categoryName =
              categoryConfig[positive.category]?.name ||
              categoryConfig[positive.label]?.name ||
              "기타";
            incomeCategoriesSet.add(categoryName);

            if (!yearData[categoryName]) {
              yearData[categoryName] = 0;
            }
            yearData[categoryName] += positive.amount;
          });
        }

        incomeByYear[item.year] = yearData;
      });

      // 지출 데이터 가공 (모든 연도 포함)
      const expenseByYear = {};
      filteredData.forEach((item) => {
        const yearData = { year: item.year, age: item.age };

        if (item.breakdown) {
          (item.breakdown.negatives || []).forEach((negative) => {
            const categoryName =
              categoryConfig[negative.category]?.name ||
              categoryConfig[negative.label]?.name ||
              "기타";
            expenseCategoriesSet.add(categoryName);

            if (!yearData[categoryName]) {
              yearData[categoryName] = 0;
            }
            yearData[categoryName] += negative.amount;
          });
        }

        expenseByYear[item.year] = yearData;
      });

      return {
        incomeData: Object.values(incomeByYear),
        expenseData: Object.values(expenseByYear),
        incomeCategories: Array.from(incomeCategoriesSet),
        expenseCategories: Array.from(expenseCategoriesSet),
      };
    }, [hasData, detailedData, xAxisRange, categoryConfig]);

  // Y축 도메인 계산
  const { incomeYDomain, expenseYDomain } = useMemo(() => {
    const incomeMax =
      incomeData.length > 0
        ? Math.max(
            ...incomeData.map((d) => {
              let sum = 0;
              incomeCategories.forEach((cat) => {
                sum += d[cat] || 0;
              });
              return sum;
            })
          )
        : 1000;

    const expenseMax =
      expenseData.length > 0
        ? Math.max(
            ...expenseData.map((d) => {
              let sum = 0;
              expenseCategories.forEach((cat) => {
                sum += d[cat] || 0;
              });
              return sum;
            })
          )
        : 1000;

    const roundedIncomeMax = Math.ceil(incomeMax / 1000) * 1000;
    const roundedExpenseMax = Math.ceil(expenseMax / 1000) * 1000;

    return {
      incomeYDomain: [0, roundedIncomeMax],
      expenseYDomain: [0, roundedExpenseMax],
    };
  }, [incomeData, expenseData, incomeCategories, expenseCategories]);

  // 차트 렌더링 후 키보드 이벤트 차단
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !hasData) return;

    const handleFocus = (e) => {
      if (e.target === container || container.contains(e.target)) {
        e.target.blur();
      }
    };

    const timer = setTimeout(() => {
      const svgElements = container.querySelectorAll("svg, svg *");
      svgElements.forEach((element) => {
        element.setAttribute("focusable", "false");
        element.setAttribute("tabindex", "-1");
      });

      if (
        document.activeElement &&
        container.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
    }, 100);

    const handleKeyDown = (e) => {
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown"
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    container.addEventListener("keydown", handleKeyDown, { capture: true });
    container.addEventListener("focus", handleFocus, { capture: true });

    return () => {
      clearTimeout(timer);
      container.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      });
      container.removeEventListener("focus", handleFocus, { capture: true });
    };
  }, [hasData]);

  // 커스텀 툴팁
  const CustomTooltip = memo(({ active, payload, label, type }) => {
    if (active && payload && payload.length > 0) {
      const year = label;
      const age = payload[0]?.payload?.age;

      // 배우자 나이 계산
      const spouseAge =
        profileData?.hasSpouse && profileData?.spouseBirthYear
          ? year - parseInt(profileData.spouseBirthYear)
          : null;

      // 총 금액 계산
      const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);

      return (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(12px)",
            padding: "14px 18px",
            borderRadius: "10px",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            color: "#1f2937",
            fontSize: "13px",
            minWidth: "200px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          {/* 년도 및 나이 */}
          <div
            style={{
              borderBottom: "1px solid rgba(0,0,0,0.1)",
              paddingBottom: "8px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                fontSize: "15px",
                fontWeight: "bold",
                marginBottom: "4px",
                color: "#111827",
              }}
            >
              {year}년
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              본인 {age}세
              {spouseAge && ` • 배우자 ${spouseAge}세`}
            </div>
          </div>

          {/* 총 금액 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
              fontWeight: "bold",
              color: "#374151",
              fontSize: "14px",
            }}
          >
            <span>합계</span>
            <span style={{ color: type === "income" ? "#10b981" : "#ef4444" }}>
              {formatAmountForChart(total)}
            </span>
          </div>

          {/* 카테고리별 금액 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {payload
              .sort((a, b) => b.value - a.value)
              .map((entry, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: entry.fill,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: "#1f2937", fontSize: "12px" }}>
                      {entry.name}
                    </span>
                  </span>
                  <span
                    style={{
                      color: "#1f2937",
                      fontWeight: "500",
                      fontSize: "12px",
                    }}
                  >
                    {formatAmountForChart(entry.value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      );
    }
    return null;
  });

  CustomTooltip.displayName = "CustomTooltip";

  if (!hasData) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.noData}>데이터가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer} ref={chartContainerRef}>
      {/* X축 범위 조정 UI */}
      <ChartRangeControl
        minYear={minYear}
        maxYear={maxYear}
        xAxisRange={xAxisRange}
        onXAxisRangeChange={handleXAxisRangeChange}
        retirementYear={retirementYear}
      />

      {/* 차트 그리드 */}
      <div className={styles.chartGrid}>
        {/* 수입 차트 */}
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={incomeData}
              margin={{
                top: 40,
                right: 30,
                left: 40,
                bottom: 120,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="year"
                type="number"
                scale="linear"
                domain={[
                  xAxisRange.start ? xAxisRange.start - 1 : "dataMin - 1",
                  xAxisRange.end ? xAxisRange.end + 1 : "dataMax + 1",
                ]}
                tickFormatter={(value) => `${value}`}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis
                domain={incomeYDomain}
                tickFormatter={(value) => formatAmountForChart(value)}
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip
                content={(props) => <CustomTooltip {...props} type="income" />}
                cursor={{ fill: "rgba(16, 185, 129, 0.1)" }}
              />
              {/* 은퇴 시점 표시 */}
              {retirementYear && (
                <ReferenceLine
                  x={retirementYear}
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  strokeDasharray="10 5"
                  label={{
                    value: "은퇴",
                    position: "top",
                    offset: 10,
                    style: { fill: "#9ca3af", fontSize: "12px" },
                  }}
                />
              )}
              {incomeCategories.map((category) => (
                <Bar
                  key={category}
                  dataKey={category}
                  stackId="income"
                  fill={categoryColors[category] || "#9ca3af"}
                  name={category}
                  animationDuration={400}
                  animationBegin={0}
                  isAnimationActive={true}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 지출 차트 */}
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={expenseData}
              margin={{
                top: 40,
                right: 30,
                left: 40,
                bottom: 120,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="year"
                type="number"
                scale="linear"
                domain={[
                  xAxisRange.start ? xAxisRange.start - 1 : "dataMin - 1",
                  xAxisRange.end ? xAxisRange.end + 1 : "dataMax + 1",
                ]}
                tickFormatter={(value) => `${value}`}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis
                domain={expenseYDomain}
                tickFormatter={(value) => formatAmountForChart(value)}
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip
                content={(props) => <CustomTooltip {...props} type="expense" />}
                cursor={{ fill: "rgba(239, 68, 68, 0.1)" }}
              />
              {/* 은퇴 시점 표시 */}
              {retirementYear && (
                <ReferenceLine
                  x={retirementYear}
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  strokeDasharray="10 5"
                  label={{
                    value: "은퇴",
                    position: "top",
                    offset: 10,
                    style: { fill: "#9ca3af", fontSize: "12px" },
                  }}
                />
              )}
              {expenseCategories.map((category) => (
                <Bar
                  key={category}
                  dataKey={category}
                  stackId="expense"
                  fill={categoryColors[category] || "#9ca3af"}
                  name={category}
                  animationDuration={400}
                  animationBegin={0}
                  isAnimationActive={true}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default RechartsIncomeExpenseChart;

