import React, {
  useEffect,
  useMemo,
  useState,
  memo,
  useRef,
  useCallback,
} from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  Cell,
  PieChart,
  Pie,
  Tooltip,
} from "recharts";
import { formatAmountForChart } from "../../utils/format";
import ChartZoomModal from "./ChartZoomModal";
import YearDetailPanel from "./YearDetailPanel";
import AssetWithdrawalModal from "./AssetWithdrawalModal";
import ChartRangeControl from "./ChartRangeControl";
import styles from "./RechartsAssetChart.module.css";

// 파이차트 컴포넌트 최적화
const OptimizedPieChart = memo(({ data, title }) => {
  if (!data || data.length === 0) {
    return <div className={styles.noDistributionData}>{title} 데이터 없음</div>;
  }

  return (
    <div className={styles.distributionChart}>
      <PieChart
        width={280}
        height={280}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={120}
          paddingAngle={1}
          animationDuration={500}
          animationBegin={0}
          animationEasing="ease-out"
          isAnimationActive={true}
        >
          {data.map((slice, index) => (
            <Cell
              key={`${title}-slice-${slice.name}-${index}`}
              fill={slice.color}
            />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
});

OptimizedPieChart.displayName = "OptimizedPieChart";

/**
 * Recharts를 사용한 자산 시뮬레이션 차트
 */
function RechartsAssetChart({
  data,
  retirementAge,
  spouseRetirementAge: spouseRetirementAgeProp,
  deathAge = 90,
  targetAssets = 50000,
  profileData = null, // 배우자 나이 계산을 위해 추가
  // detailedData prop 제거됨 - data[].breakdown에서 직접 사용 (통합 구조)
  savings = [],
  pensions = [],
  realEstates = [],
  assets = [],
  debts = [],
  incomes = [],
  expenses = [],
  xAxisRange: externalXAxisRange, // 외부에서 전달받는 X축 범위
  onXAxisRangeChange, // X축 범위 변경 콜백
  currentSimulation = null, // 현재 시뮬레이션 데이터 (인출 규칙 포함)
  onUpdateWithdrawalRule, // 인출 규칙 업데이트 콜백
}) {
  const [distributionEntry, setDistributionEntry] = useState(null);
  const [isDistributionOpen, setIsDistributionOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false); // 년도 상세 패널
  const [hoveredData, setHoveredData] = useState(null); // 클릭으로 선택된 연도 데이터
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false); // 인출 모달
  const [withdrawalModalYear, setWithdrawalModalYear] = useState(null); // 인출 모달 연도
  const hasData = Array.isArray(data) && data.length > 0;
  const chartContainerRef = useRef(null); // 차트 컨테이너 참조

  // 전체 데이터 범위 계산
  const availableYears = useMemo(() => {
    if (!hasData) return [];
    return data.map((d) => d.year).sort((a, b) => a - b);
  }, [hasData, data]);

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

  // 배우자 은퇴 나이 (props 또는 profileData에서 가져오기)
  const spouseRetirementAge = spouseRetirementAgeProp
    ? parseInt(spouseRetirementAgeProp)
    : profileData?.spouseRetirementAge
    ? parseInt(profileData.spouseRetirementAge)
    : null;

  // 나이를 년도로 변환
  const retirementYear =
    hasData && retirementAge
      ? data[0].year + (retirementAge - data[0].age)
      : null;

  // 배우자 은퇴 년도 계산 (시뮬레이션별 설정값 우선, 없으면 프로필 기반 계산)
  const spouseRetirementYear = (() => {
    if (!profileData?.hasSpouse || !profileData?.spouseIsWorking) {
      return null;
    }
    // 시뮬레이션별 배우자 은퇴년도가 설정되어 있으면 우선 사용
    if (profileData?.spouseRetirementYear) {
      return profileData.spouseRetirementYear;
    }
    // 없으면 프로필 기반으로 계산
    if (!profileData?.spouseBirthYear || !spouseRetirementAge) {
      return null;
    }
    const spouseBirthYear = parseInt(profileData.spouseBirthYear);
    return spouseBirthYear + spouseRetirementAge;
  })();

  useEffect(() => {
    if (!hasData) {
      setIsDistributionOpen(false);
      setDistributionEntry(null);
    }
  }, [hasData]);

  // 차트 렌더링 후 모든 SVG 요소에 focusable="false" 추가 및 키보드 이벤트 차단
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !hasData) return;

    // 차트 컨테이너가 포커스를 받으면 즉시 해제
    const handleFocus = (e) => {
      if (e.target === container || container.contains(e.target)) {
        e.target.blur();
      }
    };

    // 짧은 딜레이 후 실행 (차트가 완전히 렌더링된 후)
    const timer = setTimeout(() => {
      // 모든 SVG 요소에 focusable="false" 추가
      const svgElements = container.querySelectorAll("svg, svg *");
      svgElements.forEach((element) => {
        element.setAttribute("focusable", "false");
        element.setAttribute("tabindex", "-1");
      });

      // 혹시 포커스가 있다면 제거
      if (
        document.activeElement &&
        container.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
    }, 100);

    // 차트 컨테이너에서 키보드 이벤트 차단 (모달이 열려있지 않을 때만)
    const handleKeyDown = (e) => {
      // 모달이나 패널이 열려있으면 방향키를 차단하지 않음
      if (isDistributionOpen || isPanelOpen) {
        return;
      }

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
  }, [hasData, data, isDistributionOpen, isPanelOpen]); // 모달 상태도 의존성에 추가

  // 현금이 처음 마이너스로 나온 시점 감지
  const findCashNegativeTransition = () => {
    if (!hasData) return null;
    for (let i = 0; i < data.length; i++) {
      const cash = data[i]["현금"] || 0;

      // 처음으로 음수가 나온 시점 감지
      if (cash < 0) {
        return {
          year: data[i].year,
          age: data[i].age,
          cashAmount: cash,
        };
      }
    }
    return null;
  };

  const cashNegativeTransition = findCashNegativeTransition();

  // 저축/투자 이벤트 추출 (시작/종료 이벤트)
  const getSavingEvents = () => {
    const events = [];
    if (hasData && savings && savings.length > 0) {
      savings.forEach((saving) => {
        // 시작 이벤트
        events.push({
          year: saving.startYear,
          age: saving.startYear - (data[0]?.year - data[0]?.age),
          type: "start",
          category: "saving",
          title: `${saving.title} | 시작`,
        });

        // 종료 이벤트
        if (saving.endYear) {
          events.push({
            year: saving.endYear,
            age: saving.endYear - (data[0]?.year - data[0]?.age),
            type: "end",
            category: "saving",
            title: `${saving.title} | 종료`,
          });
        }
      });
    }
    return events;
  };

  const savingEvents = getSavingEvents();

  // 연금 이벤트 추출 (퇴직/개인연금: 적립 시작/종료, 수령 시작/종료)
  const getPensionEvents = () => {
    const events = [];
    if (hasData && pensions && pensions.length > 0) {
      pensions.forEach((pension) => {
        if (pension.type !== "national") {
          // 퇴직연금/개인연금: 적립 시작/종료 이벤트
          events.push({
            year: pension.contributionStartYear,
            age: pension.contributionStartYear - (data[0]?.year - data[0]?.age),
            type: "start",
            category: "pension",
            title: `${pension.title} | 적립 시작`,
          });

          if (pension.contributionEndYear) {
            events.push({
              year: pension.contributionEndYear,
              age: pension.contributionEndYear - (data[0]?.year - data[0]?.age),
              type: "end",
              category: "pension",
              title: `${pension.title} | 적립 종료`,
            });
          }

          // 퇴직연금/개인연금: 수령 시작/종료 이벤트
          events.push({
            year: pension.paymentStartYear,
            age: pension.paymentStartYear - (data[0]?.year - data[0]?.age),
            type: "start",
            category: "pension",
            title: `${pension.title} | 수령 시작`,
          });

          if (pension.paymentEndYear) {
            events.push({
              year: pension.paymentEndYear,
              age: pension.paymentEndYear - (data[0]?.year - data[0]?.age),
              type: "end",
              category: "pension",
              title: `${pension.title} | 수령 종료`,
            });
          }
        }
      });
    }
    return events;
  };

  const pensionEvents = getPensionEvents();

  // 부동산 이벤트 추출 (보유 시작/종료, 주택연금 전환)
  const getRealEstateEvents = () => {
    const events = [];
    if (hasData && realEstates && realEstates.length > 0) {
      realEstates.forEach((realEstate) => {
        // 부동산 보유 시작 이벤트
        events.push({
          year: realEstate.startYear,
          age: realEstate.startYear - (data[0]?.year - data[0]?.age),
          type: "start",
          category: "realEstate",
          title: `${realEstate.title} | 보유 시작`,
        });

        // 주택연금 전환 이벤트
        if (realEstate.convertToPension) {
          events.push({
            year: realEstate.pensionStartYear,
            age: realEstate.pensionStartYear - (data[0]?.year - data[0]?.age),
            type: "conversion",
            category: "realEstate",
            title: `${realEstate.title} | 주택연금 전환`,
          });
        }

        // 부동산 보유 종료 이벤트 (매각 또는 주택연금 전환)
        if (realEstate.endYear) {
          events.push({
            year: realEstate.endYear,
            age: realEstate.endYear - (data[0]?.year - data[0]?.age),
            type: "end",
            category: "realEstate",
            title: `${realEstate.title} | 보유 종료`,
          });
        }
      });
    }
    return events;
  };

  const realEstateEvents = getRealEstateEvents();

  // 부채 이벤트 추출 (대출 시작, 상환 완료)
  const getDebtEvents = () => {
    const events = [];
    if (hasData && debts && debts.length > 0) {
      debts.forEach((debt) => {
        // 대출 시작 이벤트
        events.push({
          year: debt.startYear,
          age: debt.startYear - (data[0]?.year - data[0]?.age),
          type: "start",
          category: "debt",
          title: `${debt.title} | 대출 시작`,
        });

        // 상환 완료 이벤트 (부채 타입별 처리)
        if (debt.debtType === "bullet") {
          // 만기일시상환: endYear에 완전 상환
          events.push({
            year: debt.endYear,
            age: debt.endYear - (data[0]?.year - data[0]?.age),
            type: "repayment",
            category: "debt",
            title: `${debt.title} | 만기 상환`,
          });
        } else if (debt.debtType === "equal") {
          // 원리금균등상환: endYear에 상환 완료
          events.push({
            year: debt.endYear,
            age: debt.endYear - (data[0]?.year - data[0]?.age),
            type: "repayment",
            category: "debt",
            title: `${debt.title} | 상환 완료`,
          });
        } else if (debt.debtType === "principal") {
          // 원금균등상환: endYear에 상환 완료
          events.push({
            year: debt.endYear,
            age: debt.endYear - (data[0]?.year - data[0]?.age),
            type: "repayment",
            category: "debt",
            title: `${debt.title} | 상환 완료`,
          });
        } else if (debt.debtType === "grace") {
          // 거치식상환: 거치기간 후 원금 상환 시작
          const principalStartYear = debt.startYear + debt.gracePeriod;
          events.push({
            year: principalStartYear,
            age: principalStartYear - (data[0]?.year - data[0]?.age),
            type: "principal_start",
            category: "debt",
            title: `${debt.title} | 원금 상환 시작`,
          });

          // 원금 상환 완료
          events.push({
            year: debt.endYear,
            age: debt.endYear - (data[0]?.year - data[0]?.age),
            type: "repayment",
            category: "debt",
            title: `${debt.title} | 상환 완료`,
          });
        }
      });
    }
    return events;
  };

  // 자산 이벤트 추출 (수익형 자산 보유 시작, 매각)
  const getAssetEvents = () => {
    const events = [];
    if (assets && assets.length > 0) {
      assets.forEach((asset) => {
        // 모든 자산 이벤트 표시
        // 자산 보유 시작 이벤트
        events.push({
          year: asset.startYear,
          age: asset.startYear - (data[0]?.year - data[0]?.age),
          type: "start",
          category: "asset",
          title: `${asset.title} | 보유 시작`,
        });

        // 자산 매각 이벤트 (종료년도 +1)
        if (asset.endYear) {
          events.push({
            year: asset.endYear + 1,
            age: asset.endYear + 1 - (data[0]?.year - data[0]?.age),
            type: "sale",
            category: "asset",
            title: `${asset.title} | 매각`,
          });
        }
      });
    }
    return events;
  };

  const assetEvents = getAssetEvents();
  const debtEvents = getDebtEvents();

  // 소득 이벤트 추출 (시작/종료)
  const getIncomeEvents = () => {
    const events = [];
    if (hasData && incomes && incomes.length > 0) {
      incomes.forEach((income) => {
        // 시작 이벤트
        events.push({
          year: income.startYear,
          age: income.startYear - (data[0]?.year - data[0]?.age),
          type: "start",
          category: "income",
          title: `${income.title} | 시작`,
        });

        // 종료 이벤트
        if (income.endYear) {
          events.push({
            year: income.endYear,
            age: income.endYear - (data[0]?.year - data[0]?.age),
            type: "end",
            category: "income",
            title: `${income.title} | 종료`,
          });
        }
      });
    }
    return events;
  };

  const incomeEvents = getIncomeEvents();

  // 지출 이벤트 추출 (시작/종료)
  const getExpenseEvents = () => {
    const events = [];
    if (hasData && expenses && expenses.length > 0) {
      expenses.forEach((expense) => {
        // 시작 이벤트
        events.push({
          year: expense.startYear,
          age: expense.startYear - (data[0]?.year - data[0]?.age),
          type: "start",
          category: "expense",
          title: `${expense.title} | 시작`,
        });

        // 종료 이벤트
        if (expense.endYear) {
          events.push({
            year: expense.endYear,
            age: expense.endYear - (data[0]?.year - data[0]?.age),
            type: "end",
            category: "expense",
            title: `${expense.title} | 종료`,
          });
        }
      });
    }
    return events;
  };

  const expenseEvents = getExpenseEvents();

  // 이벤트를 년도별로 그룹화
  const allEvents = [
    ...savingEvents,
    ...pensionEvents,
    ...realEstateEvents,
    ...assetEvents,
    ...debtEvents,
    ...incomeEvents,
    ...expenseEvents,
  ];

  const eventsByYear = allEvents.reduce((acc, event) => {
    if (!acc[event.year]) {
      acc[event.year] = [];
    }
    acc[event.year].push(event);
    return acc;
  }, {});

  // data를 년도별로 빠르게 찾기 위한 맵 (통합 구조: data[].breakdown 직접 사용)
  const detailByYear = useMemo(() => {
    if (!data || data.length === 0) return {};
    return data.reduce((acc, item) => {
      if (item?.year !== undefined && item?.year !== null) {
        acc[item.year] = item;
      }
      return acc;
    }, {});
  }, [data]);

  // 차트 데이터 포맷팅 - 4개 카테고리로 단순화 (성능 최적화)
  const chartData = useMemo(() => {
    if (!hasData) return [];

    // X축 범위에 따른 데이터 필터링
    const filteredData = data.filter((item) => {
      if (xAxisRange.start === null || xAxisRange.end === null) return true;
      return item.year >= xAxisRange.start && item.year <= xAxisRange.end;
    });

    return filteredData.map((item) => {
      // 배우자 나이 계산
      const spouseAge =
        profileData?.hasSpouse && profileData?.spouseBirthYear
          ? item.year - parseInt(profileData.spouseBirthYear)
          : null;

      // 자녀들 나이 계산
      const childrenAges = profileData?.familyMembers
        ? profileData.familyMembers
            .filter((member) => member.relationship === "자녀")
            .map((child) => ({
              gender: child.gender || "아들",
              age: item.year - parseInt(child.birthYear),
            }))
            .filter((child) => child.age >= 0)
        : [];

      // 가족 라벨 생성
      let familyLabel = `본인 ${item.age}`;
      if (spouseAge) familyLabel += ` • 배우자 ${spouseAge}`;
      if (childrenAges.length > 0) {
        const childrenText = childrenAges
          .map((child) => `${child.gender} ${child.age}`)
          .join(" • ");
        familyLabel += ` • ${childrenText}`;
      }

      // 7개 카테고리로 세분화
      let savingAmount = 0; // 저축/투자
      let pensionAmount = 0; // 연금
      let realEstateAmount = 0; // 부동산
      let assetAmount = 0; // 자산
      let positiveCash = 0; // +현금
      let negativeCash = 0; // -현금
      let debtAmount = 0; // 부채

      const applyBySourceType = (type, amount) => {
        switch (type) {
          case "cash":
            if (amount >= 0) positiveCash += amount;
            else negativeCash += amount;
            break;
          case "saving":
            savingAmount += amount;
            break;
          case "pension":
            pensionAmount += amount;
            break;
          case "realEstate":
            realEstateAmount += amount;
            break;
          case "asset":
            assetAmount += amount;
            break;
          case "debt":
            debtAmount += amount;
            break;
          default:
            assetAmount += amount;
        }
      };

      // breakdown이 있으면 sourceType 기반으로 정확히 분류
      const breakdown =
        item.breakdown || detailByYear[item.year]?.breakdown || null;

      if (breakdown && breakdown.assetItems) {
        (breakdown.assetItems || []).forEach((assetItem) => {
          const amount = Number(assetItem.amount) || 0;
          const sourceType = assetItem.sourceType || "asset";
          applyBySourceType(sourceType, amount);
        });

        (breakdown.debtItems || []).forEach((debtItem) => {
          // debtItem.amount는 양수, originalValue에 부호가 들어있음
          const raw = debtItem.originalValue ?? -Math.abs(debtItem.amount || 0);
          const amount = Number(raw) || 0;
          applyBySourceType(debtItem.sourceType || "debt", amount);
        });
      } else {
        // fallback: 기존 키워드 기반 (구 데이터 구조 대비)
        Object.keys(item).forEach((key) => {
          if (key !== "year" && key !== "age" && key !== "totalAmount") {
            const value = item[key] || 0;

            if (key === "현금" || key === "현금 자산") {
              if (value >= 0) positiveCash += value;
              else negativeCash += value;
            } else if (value < 0) {
              debtAmount += value;
            } else if (value > 0) {
              if (
                key.includes("저축") ||
                key.includes("투자") ||
                key.includes("예금") ||
                key.includes("적금") ||
                key.includes("채권") ||
                key.includes("주식") ||
                key.includes("펀드") ||
                key.includes("ETF")
              ) {
                savingAmount += value;
              } else if (
                key.includes("연금") ||
                key.includes("퇴직") ||
                key.includes("국민연금") ||
                key.includes("IRP") ||
                key.includes("DB")
              ) {
                pensionAmount += value;
              } else if (
                key.includes("부동산") ||
                key.includes("아파트") ||
                key.includes("자택") ||
                key.includes("주택") ||
                key.includes("토지") ||
                key.includes("건물") ||
                key.includes("상가")
              ) {
                realEstateAmount += value;
              } else {
                assetAmount += value;
              }
            }
          }
        });
      }

      return {
        age: item.age,
        year: item.year,
        totalAmount: item.totalAmount || item.amount,
        formattedAmount: formatAmountForChart(item.totalAmount || item.amount),
        familyLabel: familyLabel,
        events: eventsByYear[item.year] || [],
        // 7개 카테고리 (렌더링 순서: 저축 → 연금 → 부동산 → 자산 → +현금 → -현금 → 부채)
        저축투자: savingAmount,
        연금: pensionAmount,
        부동산: realEstateAmount,
        자산: assetAmount,
        양수현금: positiveCash,
        음수현금: negativeCash,
        부채: debtAmount,
      };
    });
  }, [hasData, data, profileData, eventsByYear, xAxisRange, detailByYear]);

  // 7개 카테고리 (렌더링 순서: 양수 역순, 음수 순서대로)
  const assetKeys = [
    "양수현금",
    "자산",
    "부동산",
    "연금",
    "저축투자",
    "음수현금",
    "부채",
  ];

  // 7개 카테고리 대표 색상 매핑
  const getAssetColor = (assetName) => {
    switch (assetName) {
      case "저축투자":
        return "#3b82f6"; // 파랑
      case "연금":
        return "#eab308"; // 어두운 노랑
      case "부동산":
        return "#8b5cf6"; // 보라
      case "자산":
        return "#06b6d4"; // 청록
      case "양수현금":
        return "#10b981"; // 초록
      case "음수현금":
        return "#ef4444"; // 빨강
      case "부채":
        return "#374151"; // 회색
      default:
        return "#6b7280"; // 기본 회색
    }
  };

  // 색상 팔레트 (사용하지 않는 변수 제거)

  // 은퇴 시점 찾기
  const retirementData = chartData.find((item) => item.age === retirementAge);

  // Y축 도메인 계산 (음수 포함) - chartData 변경 시 재계산
  const yDomain = useMemo(() => {
    const allValues = [];
    chartData.forEach((item) => {
      assetKeys.forEach((key) => {
        if (item[key] !== undefined) {
          allValues.push(item[key]);
        }
      });
    });

    if (allValues.length === 0) {
      return [-1000, 1000]; // 기본값
    }

    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    const maxAbsValue = Math.max(Math.abs(maxValue), Math.abs(minValue));
    const padding = maxAbsValue * 0.1;

    return [-maxAbsValue - padding, maxAbsValue + padding];
  }, [chartData]);

  // 모든 연도별 분포 데이터를 미리 계산 (통합 구조: data[].breakdown 직접 사용)
  const allDistributionData = useMemo(() => {
    if (!data || data.length === 0) return {};

    const distributionMap = {};

    data.forEach((yearData) => {
      const assetSlices = [];
      const debtSlices = [];

      // 통합 구조: data[].breakdown에서 직접 가져옴
      if (yearData.breakdown) {
        (yearData.breakdown.assetItems || []).forEach((item) => {
          assetSlices.push({
            name: item.label,
            value: item.amount,
            originalValue: item.originalValue,
            color: item.color,
          });
        });

        (yearData.breakdown.debtItems || []).forEach((item) => {
          debtSlices.push({
            name: item.label,
            value: item.amount,
            originalValue: item.originalValue,
            color: item.color,
          });
        });
      }

      distributionMap[yearData.year] = { assetSlices, debtSlices };
    });

    return distributionMap;
  }, [data]);

  const distributionSlices = useMemo(() => {
    if (!distributionEntry || !allDistributionData[distributionEntry.year]) {
      return { assetSlices: [], debtSlices: [] };
    }
    return allDistributionData[distributionEntry.year];
  }, [distributionEntry, allDistributionData]);

  const sortedDistribution = useMemo(() => {
    if (!distributionSlices.assetSlices || !distributionSlices.debtSlices) {
      return { assetSlices: [], debtSlices: [] };
    }

    const assetSlices = [...distributionSlices.assetSlices].sort(
      (a, b) => b.value - a.value
    );
    const debtSlices = [...distributionSlices.debtSlices].sort(
      (a, b) => b.value - a.value
    );
    return { assetSlices, debtSlices };
  }, [distributionSlices]);

  const totalAssetValue = useMemo(() => {
    return distributionSlices.assetSlices?.reduce(
      (sum, slice) => sum + slice.value,
      0
    );
  }, [distributionSlices]);

  const totalDebtValue = useMemo(() => {
    return distributionSlices.debtSlices?.reduce(
      (sum, slice) => sum + slice.value,
      0
    );
  }, [distributionSlices]);

  const handleBarSegmentClick = (barData) => {
    if (!hasData) return;
    if (!barData || !barData.payload) return;
    setDistributionEntry(barData.payload);
    setIsPanelOpen(true); // 패널 열기
  };

  // 인출 아이콘 클릭 핸들러
  const handleWithdrawalIconClick = useCallback(
    (year) => {
      setWithdrawalModalYear(year);
      setIsWithdrawalModalOpen(true);
    },
    []
  );

  // 해당 연도에 인출 가능한 자산이 있는지 확인 (저축/투자만)
  const hasWithdrawableAssetsForYear = useCallback(
    (year) => {
      // 통합 구조: data에서 직접 찾기
      const yearData = data.find((d) => d.year === year);
      if (!yearData?.breakdown?.assetItems) return false;

      // 저축/투자 잔액이 양수인 항목이 있는지 확인
      return yearData.breakdown.assetItems.some(
        (item) => item.sourceType === "saving" && item.amount > 0
      );
    },
    [data]
  );

  // 인출 아이콘 렌더링 (저축/투자 Bar 위에 표시)
  const renderWithdrawalIcon = useCallback(
    (props) => {
      const { x, y, width, value, index } = props;
      const entry = chartData[index];

      // entry가 없으면 아무것도 렌더링하지 않음
      if (!entry) return null;

      const year = entry.year;

      // 해당 연도에 인출 규칙이 있는지 확인
      const hasWithdrawal = currentSimulation?.assetWithdrawalRules?.[year]?.withdrawals?.length > 0;

      // 저축/투자 값이 0 이하이고 인출 규칙도 없으면 아이콘 표시 안함
      if (value <= 0 && !hasWithdrawal) return null;

      const hasWithdrawable = hasWithdrawableAssetsForYear(year);

      // 인출 가능한 자산이 없고 인출 규칙도 없으면 아이콘 표시 안함
      if (!hasWithdrawable && !hasWithdrawal) return null;

      const baseColor = hasWithdrawal ? "#f59e0b" : "#9ca3af"; // 앰버색 or 회색
      const hoverColor = hasWithdrawal ? "#d97706" : "#374151"; // 진한 앰버색 or 진한 회색

      return (
        <g>
          <foreignObject
            x={x + width / 2 - 8}
            y={y - 20}
            width={16}
            height={16}
            style={{ pointerEvents: "auto" }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: baseColor,
                fontSize: "14px",
                opacity: hasWithdrawal ? 0.9 : 0.6,
                transition: "opacity 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.color = hoverColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = hasWithdrawal ? "0.9" : "0.6";
                e.currentTarget.style.color = baseColor;
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleWithdrawalIconClick(year);
              }}
              title="현금 인출 설정"
            >
              ◉
            </div>
          </foreignObject>
        </g>
      );
    },
    [chartData, hasWithdrawableAssetsForYear, currentSimulation, handleWithdrawalIconClick]
  );

  // 차트 클릭 핸들러 (연도 선택하여 패널 열기)
  const handleChartClick = (data) => {
    // activeLabel로 년도 찾기 (빈 공간 클릭 시)
    if (data && data.activeLabel) {
      const year = parseInt(data.activeLabel);
      const clickedData = chartData.find((d) => d.year === year);
      if (clickedData) {
        setHoveredData(clickedData);
        setDistributionEntry(clickedData);
        setIsPanelOpen(true); // 패널 열기
      }
    } else if (data && data.activePayload && data.activePayload.length > 0) {
      // Bar 클릭 시
      const clickedData = data.activePayload[0].payload;
      setHoveredData(clickedData);
      setDistributionEntry(clickedData);
      setIsPanelOpen(true); // 패널 열기
    }
  };

  // 차트 렌더링 함수
  const renderChart = (height = 600) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        stackOffset="sign"
        margin={{
          top: 40,
          right: 30,
          left: 40,
          bottom: 120,
        }}
        onClick={handleChartClick}
        style={{ cursor: "pointer" }}
        tabIndex={-1}
        onKeyDown={(e) => {
          // 차트 내부의 방향키 이벤트 차단 (툴팁 이동 방지)
          if (
            e.key === "ArrowLeft" ||
            e.key === "ArrowRight" ||
            e.key === "ArrowUp" ||
            e.key === "ArrowDown"
          ) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {/* 그라데이션 정의 */}
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

        {/* X축 - 년도 */}
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
          label={{ value: "", position: "insideBottom", offset: -5 }}
        />

        {/* Y축 - 금액 */}
        <YAxis
          domain={yDomain}
          tickFormatter={(value) => formatAmountForChart(value)}
          stroke="#6b7280"
          fontSize={12}
        />

        {/* 은퇴 시점 표시 */}
        {retirementData && retirementYear && (
          <ReferenceLine
            x={retirementYear}
            stroke="#9ca3af"
            strokeWidth={1.5}
            strokeDasharray="10 5"
            label={{
              value: "은퇴",
              position: "top",
              offset: 10, // 위로 10px 올림
              style: { fill: "#9ca3af", fontSize: "12px" },
            }}
          />
        )}

        {/* 배우자 은퇴 시점 표시 */}
        {spouseRetirementYear && (
          <ReferenceLine
            x={spouseRetirementYear}
            stroke="#a78bfa"
            strokeWidth={1.5}
            strokeDasharray="10 5"
            label={{
              value: "배우자 은퇴",
              position: "top",
              offset: spouseRetirementYear === retirementYear ? 30 : 10, // 은퇴 년도가 같으면 위로 30px, 다르면 10px 올림
              style: { fill: "#a78bfa", fontSize: "12px" },
            }}
          />
        )}

        {/* Y축 0 기준선 */}
        <ReferenceLine
          y={0}
          stroke="#374151"
          strokeWidth={2}
          strokeDasharray="3 3"
        />

        {/* 목표 자산선 */}
        <ReferenceLine
          y={targetAssets}
          stroke="#fbbf24"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          label={{
            value: "목표 자산",
            position: "right",
            style: { fill: "#fbbf24", fontSize: "12px" },
          }}
        />

        {/* 현금 위험 시점 표시 */}
        {cashNegativeTransition && (
          <ReferenceLine
            x={cashNegativeTransition.year}
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="8 4"
            label={{
              value: "현금 위험",
              position: "top",
              offset: 10, // 위로 10px 올림
              style: {
                fill: "#ef4444",
                fontSize: "12px",
                fontWeight: "bold",
              },
            }}
          />
        )}

        {/* 마우스 위치 표시용 툴팁 (간략 정보) */}
        <Tooltip
          cursor={{
            fill: "rgba(59, 130, 246, 0.15)",
            stroke: "#3b82f6",
            strokeWidth: 2,
          }}
          content={({ active, payload }) => {
            if (active && payload && payload.length > 0) {
              const chartEntry = payload[0].payload;

              // 통합 구조: chartEntry에 breakdown 직접 포함
              // (chartData는 data에서 만들어지므로 원본 data 찾기)
              const yearData = detailByYear[chartEntry.year];
              const totalAssets = yearData?.breakdown?.totalAssets || 0;
              const totalDebt = yearData?.breakdown?.totalDebt || 0;
              const netAssets = yearData?.breakdown?.netAssets || 0;

              return (
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.7)",
                    backdropFilter: "blur(12px)",
                    padding: "14px 18px",
                    borderRadius: "10px",
                    border: "1px solid rgba(0, 0, 0, 0.08)",
                    color: "#1f2937",
                    fontSize: "13px",
                    pointerEvents: "none",
                    minWidth: "240px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  }}
                >
                  {/* 년도 및 가족 구성 */}
                  <div
                    style={{
                      borderBottom: "1px solid rgba(0,0,0,0.1)",
                      paddingBottom: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    {/* 년도 */}
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: "bold",
                        marginBottom: "6px",
                        color: "#111827",
                      }}
                    >
                      {chartEntry.year}년
                    </div>

                    {/* 가족 구성 */}
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6b7280",
                      }}
                    >
                      {chartEntry.familyLabel}
                    </div>
                  </div>

                  {/* 순자산 */}
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
                    <span>순자산</span>
                    <span
                      style={{ color: netAssets >= 0 ? "#10b981" : "#ef4444" }}
                    >
                      {formatAmountForChart(netAssets)}
                    </span>
                  </div>

                  {/* 자산 */}
                  <div style={{ marginBottom: "8px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "14px",
                        marginBottom: "6px",
                        fontWeight: "600",
                      }}
                    >
                      <span style={{ color: "#4b5563" }}>자산</span>
                      <span style={{ color: "#10b981" }}>
                        +{formatAmountForChart(totalAssets)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        paddingLeft: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {/* 저축/투자: 0이 아닐 때만 표시 */}
                      {chartEntry.저축투자 > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: getAssetColor("저축투자"),
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: "#1f2937" }}>저축/투자</span>
                          <span
                            style={{
                              marginLeft: "auto",
                              color: "#1f2937",
                              fontWeight: "500",
                            }}
                          >
                            {formatAmountForChart(chartEntry.저축투자)}
                          </span>
                        </div>
                      )}
                      {/* 연금: 0이 아닐 때만 표시 */}
                      {chartEntry.연금 > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: getAssetColor("연금"),
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: "#1f2937" }}>연금</span>
                          <span
                            style={{
                              marginLeft: "auto",
                              color: "#1f2937",
                              fontWeight: "500",
                            }}
                          >
                            {formatAmountForChart(chartEntry.연금)}
                          </span>
                        </div>
                      )}
                      {/* 부동산: 0이 아닐 때만 표시 */}
                      {chartEntry.부동산 > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: getAssetColor("부동산"),
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: "#1f2937" }}>부동산</span>
                          <span
                            style={{
                              marginLeft: "auto",
                              color: "#1f2937",
                              fontWeight: "500",
                            }}
                          >
                            {formatAmountForChart(chartEntry.부동산)}
                          </span>
                        </div>
                      )}
                      {/* 자산: 0이 아닐 때만 표시 */}
                      {chartEntry.자산 > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: getAssetColor("자산"),
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: "#1f2937" }}>자산</span>
                          <span
                            style={{
                              marginLeft: "auto",
                              color: "#1f2937",
                              fontWeight: "500",
                            }}
                          >
                            {formatAmountForChart(chartEntry.자산)}
                          </span>
                        </div>
                      )}
                      {/* 현금: 0이 아닐 때만 표시 */}
                      {chartEntry.양수현금 > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: getAssetColor("양수현금"),
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: "#1f2937" }}>현금</span>
                          <span
                            style={{
                              marginLeft: "auto",
                              color: "#1f2937",
                              fontWeight: "500",
                            }}
                          >
                            {formatAmountForChart(chartEntry.양수현금)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 부채 */}
                  {totalDebt > 0 && (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "14px",
                          marginBottom: "6px",
                          fontWeight: "600",
                        }}
                      >
                        <span style={{ color: "#4b5563" }}>부채</span>
                        <span style={{ color: "#ef4444" }}>
                          -{formatAmountForChart(totalDebt)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          paddingLeft: "12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        {/* -현금: 0이 아닐 때만 표시 */}
                        {chartEntry.음수현금 !== 0 && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: getAssetColor("음수현금"),
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ color: "#1f2937" }}>현금</span>
                            <span
                              style={{
                                marginLeft: "auto",
                                color: "#1f2937",
                                fontWeight: "500",
                              }}
                            >
                              -{formatAmountForChart(Math.abs(chartEntry.음수현금))}
                            </span>
                          </div>
                        )}
                        {/* 부채: 0이 아닐 때만 표시 */}
                        {chartEntry.부채 !== 0 && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: getAssetColor("부채"),
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ color: "#1f2937" }}>부채</span>
                            <span
                              style={{
                                marginLeft: "auto",
                                color: "#1f2937",
                                fontWeight: "500",
                              }}
                            >
                              -{formatAmountForChart(Math.abs(chartEntry.부채))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            return null;
          }}
          animationDuration={150}
          isAnimationActive={true}
        />

        {/* 7개 Bar로 세분화 (양수는 역순) */}
        {/* 순서: +현금(맨 아래) → 자산 → 부동산 → 연금 → 저축/투자(맨 위) → -현금 → 부채 */}
        <Bar
          key="양수현금"
          dataKey="양수현금"
          stackId="assets"
          name="+현금"
          fill={getAssetColor("양수현금")}
          stroke="#ffffff"
          strokeWidth={1}
          radius={0}
          className={styles.clickableBar}
          onClick={(data) => handleBarSegmentClick(data)}
          animationDuration={400}
          animationBegin={0}
          isAnimationActive={true}
        />
        <Bar
          key="자산"
          dataKey="자산"
          stackId="assets"
          name="자산"
          fill={getAssetColor("자산")}
          stroke="#ffffff"
          strokeWidth={1}
          radius={0}
          className={styles.clickableBar}
          onClick={(data) => handleBarSegmentClick(data)}
          animationDuration={400}
          animationBegin={0}
          isAnimationActive={true}
        />
        <Bar
          key="부동산"
          dataKey="부동산"
          stackId="assets"
          name="부동산"
          fill={getAssetColor("부동산")}
          stroke="#ffffff"
          strokeWidth={1}
          radius={0}
          className={styles.clickableBar}
          onClick={(data) => handleBarSegmentClick(data)}
          animationDuration={400}
          animationBegin={0}
          isAnimationActive={true}
        />
        <Bar
          key="연금"
          dataKey="연금"
          stackId="assets"
          name="연금"
          fill={getAssetColor("연금")}
          stroke="#ffffff"
          strokeWidth={1}
          radius={0}
          className={styles.clickableBar}
          onClick={(data) => handleBarSegmentClick(data)}
          animationDuration={400}
          animationBegin={0}
          isAnimationActive={true}
        />
        <Bar
          key="저축투자"
          dataKey="저축투자"
          stackId="assets"
          name="저축/투자"
          fill={getAssetColor("저축투자")}
          stroke="#ffffff"
          strokeWidth={1}
          radius={0}
          className={styles.clickableBar}
          onClick={(data) => handleBarSegmentClick(data)}
          animationDuration={400}
          animationBegin={0}
          isAnimationActive={true}
          label={renderWithdrawalIcon}
        />
        <Bar
          key="음수현금"
          dataKey="음수현금"
          stackId="assets"
          name="-현금"
          fill={getAssetColor("음수현금")}
          stroke="#ffffff"
          strokeWidth={1}
          radius={0}
          className={styles.clickableBar}
          onClick={(data) => handleBarSegmentClick(data)}
          animationDuration={400}
          animationBegin={0}
          isAnimationActive={true}
        />
        <Bar
          key="부채"
          dataKey="부채"
          stackId="assets"
          name="부채"
          fill={getAssetColor("부채")}
          stroke="#ffffff"
          strokeWidth={1}
          radius={0}
          className={styles.clickableBar}
          onClick={(data) => handleBarSegmentClick(data)}
          animationDuration={400}
          animationBegin={0}
          isAnimationActive={true}
        />

        {/* 이벤트 마커를 표시하기 위한 투명한 레이어 - 년도별로 작고 화려한 네모 표시 */}
        {Object.keys(eventsByYear).map((year) => {
          const dataPoint = chartData.find((d) => d.year === parseInt(year));
          if (!dataPoint) return null;

          return (
            <ReferenceLine
              key={`event-marker-${year}`}
              x={dataPoint.year}
              stroke="transparent"
              strokeWidth={0}
              label={{
                value: "■",
                position: "bottom",
                offset: 25,
                style: {
                  fill: "url(#blueGradient)",
                  fontSize: "7px",
                  fontWeight: "bold",
                },
              }}
            />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );

  // 범례 데이터 - 7개 카테고리 (렌더링 순서와 동일)
  const legendData = useMemo(
    () => [
      { value: "+현금", color: getAssetColor("양수현금") },
      { value: "자산", color: getAssetColor("자산") },
      { value: "부동산", color: getAssetColor("부동산") },
      { value: "연금", color: getAssetColor("연금") },
      { value: "저축/투자", color: getAssetColor("저축투자") },
      { value: "-현금", color: getAssetColor("음수현금") },
      { value: "부채", color: getAssetColor("부채") },
    ],
    []
  );

  // 현재 년도 데이터 가져오기 (기본값)
  const currentYearIndex = chartData.findIndex(
    (item) => item.year === new Date().getFullYear()
  );

  // displayData: 현금 흐름 차트처럼 단순하게 계산
  const displayData = hoveredData
    ? hoveredData
    : currentYearIndex >= 0
    ? chartData[currentYearIndex]
    : chartData[0];

  // 항목의 카테고리 판별 및 색상 반환 (sourceType 기반)
  const getCategoryAndColor = (item) => {
    // sourceType이 있으면 우선 사용
    if (item.sourceType) {
      switch (item.sourceType) {
        case "cash":
          return {
            category: "현금",
            order: 5,
            color: getAssetColor("양수현금"),
          };
        case "saving":
          return {
            category: "저축투자",
            order: 1,
            color: getAssetColor("저축투자"),
          };
        case "pension":
          return { category: "연금", order: 2, color: getAssetColor("연금") };
        case "realEstate":
          return {
            category: "부동산",
            order: 3,
            color: getAssetColor("부동산"),
          };
        case "asset":
          return { category: "자산", order: 4, color: getAssetColor("자산") };
        case "debt":
          return { category: "부채", order: 7, color: getAssetColor("부채") };
        default:
          return { category: "자산", order: 4, color: getAssetColor("자산") };
      }
    }

    // sourceType이 없으면 라벨로 판별 (하위 호환성)
    const label = item.label || "";

    if (label.includes("현금") || label.includes("cash")) {
      return { category: "현금", order: 5, color: getAssetColor("양수현금") };
    } else if (
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

  // 통합 구조: data[].breakdown에서 직접 가져오기 + 카테고리별 정렬 및 색상 적용
  const yearDetail = useMemo(() => {
    if (!displayData || !data || data.length === 0) {
      return {
        assetItems: [],
        debtItemsOnly: [],
        totalAssets: 0,
        totalDebt: 0,
        netAssets: 0,
      };
    }

    // 통합 구조: data에서 해당 년도 찾기
    const yearData = data.find(
      (item) => item.year === displayData.year
    );

    if (!yearData || !yearData.breakdown) {
      return {
        assetItems: [],
        debtItemsOnly: [],
        totalAssets: 0,
        totalDebt: 0,
        netAssets: 0,
      };
    }

    // 자산 항목: 카테고리별 정렬 + 색상 적용
    const assetItems = yearData.breakdown.assetItems || [];
    const sortedAssetItems = [...assetItems]
      .map((item) => {
        const { category, order, color } = getCategoryAndColor(item);
        return { ...item, category, order, color };
      })
      .sort((a, b) => {
        // 1순위: 카테고리 순서 (저축투자 → 연금 → 부동산 → 자산 → 현금)
        if (a.order !== b.order) return a.order - b.order;
        // 2순위: 같은 카테고리 내에서는 절대값 큰 순서
        return Math.abs(b.amount) - Math.abs(a.amount);
      });

    // 부채 항목: 현금 먼저, 나머지는 절대값 큰 순서 + 색상 적용
    const debtItems = yearData.breakdown.debtItems || [];
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
        // 1순위: 현금이 맨 위
        if (a.isCash && !b.isCash) return -1;
        if (!a.isCash && b.isCash) return 1;
        // 2순위: 절대값 큰 순서
        return Math.abs(b.amount) - Math.abs(a.amount);
      });

    return {
      assetItems: sortedAssetItems,
      debtItemsOnly: sortedDebtItems,
      totalAssets: yearData.breakdown.totalAssets || 0,
      totalDebt: yearData.breakdown.totalDebt || 0,
      netAssets: yearData.breakdown.netAssets || 0,
    };
  }, [displayData, data]);

  const { assetItems, debtItemsOnly, totalAssets, totalDebt, netAssets } =
    yearDetail;

  return (
    <>
      <div className={styles.chartContainer} ref={chartContainerRef}>
        {hasData ? (
          <>
            {/* X축 범위 조정 UI */}
            <ChartRangeControl
              minYear={minYear}
              maxYear={maxYear}
              xAxisRange={xAxisRange}
              onXAxisRangeChange={handleXAxisRangeChange}
              retirementYear={retirementYear}
            />

            {/* 컨텐츠 영역: 그래프 */}
            <div className={styles.chartContent}>
              <div className={styles.chartWrapper}>{renderChart()}</div>
            </div>
          </>
        ) : (
          <div className={styles.noData}>데이터가 없습니다.</div>
        )}
      </div>

      {hasData && (
        <ChartZoomModal
          isOpen={isDistributionOpen}
          onClose={() => {
            setIsDistributionOpen(false);
            setDistributionEntry(null);
          }}
          title={
            distributionEntry
              ? `${distributionEntry.year}년 자산 구성`
              : "자산 구성"
          }
        >
          <div className={styles.distributionModalContent}>
            {distributionSlices.assetSlices.length === 0 &&
            distributionSlices.debtSlices.length === 0 ? (
              <div className={styles.noDistributionData}>
                해당 연도의 자산 구성을 계산할 수 없습니다.
              </div>
            ) : (
              <>
                <div className={styles.distributionSection}>
                  <h4>자산</h4>
                  <OptimizedPieChart
                    data={sortedDistribution.assetSlices}
                    title="자산"
                  />
                  {sortedDistribution.assetSlices.length > 0 && (
                    <>
                      <div className={styles.totalValue}>
                        총 자산: {formatAmountForChart(totalAssetValue)}
                      </div>
                      <div className={styles.distributionList}>
                        {sortedDistribution.assetSlices.map((slice) => {
                          const percent =
                            totalAssetValue > 0
                              ? ((slice.value / totalAssetValue) * 100).toFixed(
                                  1
                                )
                              : "0.0";

                          // 해당 자산에 대한 잉여 현금 투자 정보 확인 (통합 구조)
                          const yearData = data.find(
                            (item) => item.year === distributionEntry?.year
                          );
                          const investmentAmount =
                            yearData?.investmentInfo?.[slice.name] || 0;

                          return (
                            <div
                              key={`asset-list-${slice.name}`}
                              className={styles.distributionRow}
                            >
                              <span className={styles.distributionLabel}>
                                <span
                                  className={styles.distributionDot}
                                  style={{ backgroundColor: slice.color }}
                                />
                                <span className={styles.assetNameWrapper}>
                                  {slice.name}
                                  {investmentAmount > 0 && (
                                    <span className={styles.investmentBadge}>
                                      잉여현금 +
                                      {formatAmountForChart(investmentAmount)}
                                    </span>
                                  )}
                                </span>
                              </span>
                              <span className={styles.distributionValue}>
                                {formatAmountForChart(
                                  Math.abs(slice.originalValue)
                                )}
                                <span className={styles.distributionPercent}>
                                  {percent}%
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                <div className={styles.distributionSection}>
                  <h4>부채</h4>
                  <OptimizedPieChart
                    data={sortedDistribution.debtSlices}
                    title="부채"
                  />
                  {sortedDistribution.debtSlices.length > 0 && (
                    <>
                      <div className={styles.totalValue}>
                        총 부채: -{formatAmountForChart(totalDebtValue)}
                      </div>
                      <div className={styles.distributionList}>
                        {sortedDistribution.debtSlices.map((slice) => {
                          const percent =
                            totalDebtValue > 0
                              ? ((slice.value / totalDebtValue) * 100).toFixed(
                                  1
                                )
                              : "0.0";
                          return (
                            <div
                              key={`debt-list-${slice.name}`}
                              className={styles.distributionRow}
                            >
                              <span className={styles.distributionLabel}>
                                <span
                                  className={styles.distributionDot}
                                  style={{ backgroundColor: slice.color }}
                                />
                                {slice.name}
                              </span>
                              <span className={styles.distributionValue}>
                                -
                                {formatAmountForChart(
                                  Math.abs(slice.originalValue)
                                )}
                                <span className={styles.distributionPercent}>
                                  {percent}%
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </ChartZoomModal>
      )}

      {/* 년도 상세 패널 (오른쪽 슬라이드) */}
      <YearDetailPanel
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          setDistributionEntry(null);
        }}
        yearData={distributionEntry}
        detailedData={data}
        savings={savings}
        pensions={pensions}
        realEstates={realEstates}
        assets={assets}
        debts={debts}
        incomes={incomes}
        expenses={expenses}
        onYearChange={(newYearData) => {
          // 방향키로 연도 변경 시 호출됨
          setDistributionEntry(newYearData);
        }}
      />

      {/* 자산 인출 모달 */}
      <AssetWithdrawalModal
        isOpen={isWithdrawalModalOpen}
        onClose={() => {
          setIsWithdrawalModalOpen(false);
          setWithdrawalModalYear(null);
        }}
        year={withdrawalModalYear}
        savings={savings}
        detailedData={data}
        currentRule={
          withdrawalModalYear && currentSimulation?.assetWithdrawalRules
            ? currentSimulation.assetWithdrawalRules[withdrawalModalYear]
            : null
        }
        withdrawableYears={data
          .filter((d) => {
            // 저축/투자 잔액이 있는 연도만 필터링
            const breakdown = d.breakdown;
            if (!breakdown || !breakdown.assetItems) return false;

            return breakdown.assetItems.some(
              (item) => item.sourceType === "saving" && item.amount > 0
            );
          })
          .map((d) => ({ year: d.year }))}
        onSave={(years, rule) => {
          if (onUpdateWithdrawalRule) {
            onUpdateWithdrawalRule(years, rule);
          }
        }}
        onYearChange={(newYear) => {
          setWithdrawalModalYear(newYear);
        }}
      />
    </>
  );
}

export default RechartsAssetChart;
