import React, {
  useState,
  useMemo,
  memo,
  useRef,
  useEffect,
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
  Cell,
  PieChart,
  Pie,
  Tooltip,
} from "recharts";
import { formatAmountForChart } from "../../utils/format";
import CashflowInvestmentModal from "./CashflowInvestmentModal";
import ChartZoomModal from "./ChartZoomModal";
import ChartRangeControl from "./ChartRangeControl";
import styles from "./RechartsCashflowChart.module.css";

// 파이차트 컴포넌트 (YearDetailPanel의 SimplePieChart와 동일)
const SimplePieChart = memo(({ data, totalValue }) => {
  if (!data || data.length === 0) {
    return <div className={styles.noDistributionData}>데이터 없음</div>;
  }

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
            data={data}
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
            {data.map((slice, index) => (
              <Cell key={`slice-${index}`} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </div>

      {/* 오른쪽: 범례 */}
      <div className={styles.pieChartLegend}>
        {data.map((item, index) => {
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
 * Recharts를 사용한 현금 흐름 시뮬레이션 차트
 */
function RechartsCashflowChart({
  data,
  retirementAge,
  deathAge = 90,
  profileData = null, // 배우자 은퇴 정보를 위해 프로필 데이터 추가
  currentSimulation = null, // 현재 시뮬레이션 데이터 (투자 규칙 포함)
  detailedData = [],
  incomes = [],
  expenses = [],
  savings = [],
  pensions = [],
  realEstates = [],
  assets = [],
  debts = [],
  onUpdateInvestmentRule, // 투자 규칙 업데이트 콜백
  xAxisRange: externalXAxisRange, // 외부에서 전달받는 X축 범위
  onXAxisRangeChange, // X축 범위 변경 콜백
}) {
  const [distributionEntry, setDistributionEntry] = useState(null);
  const [isDistributionOpen, setIsDistributionOpen] = useState(false);
  const [investmentModalData, setInvestmentModalData] = useState(null);
  const chartContainerRef = useRef(null); // 차트 컨테이너 참조

  const hasData = data && data.length > 0;

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

  // 은퇴년도 계산 (자산 차트와 동일한 로직)
  // 시뮬레이션별 은퇴년도가 있으면 우선 사용, 없으면 retirementAge와 데이터를 기반으로 계산
  const retirementYear = (() => {
    // 시뮬레이션별 은퇴년도가 있으면 우선 사용
    if (currentSimulation?.retirementYear) {
      return currentSimulation.retirementYear;
    }
    // profileData에 retirementYear가 있으면 사용
    if (profileData?.retirementYear) {
      return profileData.retirementYear;
    }
    // retirementAge와 데이터를 기반으로 계산 (자산 차트와 동일한 로직)
    if (hasData && retirementAge) {
      return data[0].year + (retirementAge - data[0].age);
    }
    return null;
  })();

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
    const spouseBirthYear = parseInt(profileData.spouseBirthYear);
    const spouseRetirement = parseInt(profileData.spouseRetirementAge);
    if (!spouseBirthYear || !spouseRetirement) {
      return null;
    }
    return spouseBirthYear + spouseRetirement;
  })();

  // 소득 이벤트 추출 (시작/종료 이벤트)
  const getIncomeEvents = () => {
    const events = [];
    if (incomes && incomes.length > 0) {
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

  // 지출 이벤트 추출 (시작/종료 이벤트)
  const getExpenseEvents = () => {
    const events = [];
    if (expenses && expenses.length > 0) {
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

  // 저축/투자 이벤트 추출 (시작/종료/수령 이벤트)
  const getSavingEvents = () => {
    const events = [];
    if (savings && savings.length > 0) {
      savings.forEach((saving) => {
        // 숫자형으로 보정 (문자열로 들어오는 경우 방지)
        const sStart = Number(saving.startYear);
        const sEnd = Number(saving.endYear);

        // 시작 이벤트
        if (Number.isFinite(sStart)) {
          events.push({
            year: sStart,
            age: sStart - (data[0]?.year - data[0]?.age),
            type: "start",
            category: "saving",
            title: `${saving.title} | 시작`,
          });
        }

        // 종료 이벤트: 종료년도에 "종료" 표시
        if (Number.isFinite(sEnd)) {
          events.push({
            year: sEnd,
            age: sEnd - (data[0]?.year - data[0]?.age),
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

  // 연금 이벤트 추출 (국민연금: 시작/종료, 퇴직/개인연금: 수령 시작/종료)
  const getPensionEvents = () => {
    const events = [];
    if (pensions && pensions.length > 0) {
      pensions.forEach((pension) => {
        if (pension.type === "national") {
          // 국민연금: 수령 시작/종료 이벤트
          events.push({
            year: pension.startYear,
            age: pension.startYear - (data[0]?.year - data[0]?.age),
            type: "start",
            category: "pension",
            title: `${pension.title} | 수령 시작`,
          });

          if (pension.endYear) {
            events.push({
              year: pension.endYear,
              age: pension.endYear - (data[0]?.year - data[0]?.age),
              type: "end",
              category: "pension",
              title: `${pension.title} | 수령 종료`,
            });
          }
        } else {
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

  // 부동산 이벤트 추출 (구매, 임대소득 시작/종료, 주택연금 전환, 매각)
  const getRealEstateEvents = () => {
    const events = [];
    if (realEstates && realEstates.length > 0) {
      realEstates.forEach((realEstate) => {
        // 부동산 구매 이벤트
        if (realEstate.isPurchase) {
          events.push({
            year: realEstate.startYear,
            age: realEstate.startYear - (data[0]?.year - data[0]?.age),
            type: "purchase",
            category: "realEstate",
            title: `${realEstate.title} | 추가`,
          });
        }

        // 임대소득 시작/종료 이벤트
        if (realEstate.hasRentalIncome) {
          events.push({
            year: realEstate.rentalIncomeStartYear,
            age:
              realEstate.rentalIncomeStartYear - (data[0]?.year - data[0]?.age),
            type: "start",
            category: "realEstate",
            title: `${realEstate.title} | 임대소득 시작`,
          });

          if (realEstate.rentalIncomeEndYear) {
            events.push({
              year: realEstate.rentalIncomeEndYear,
              age:
                realEstate.rentalIncomeEndYear - (data[0]?.year - data[0]?.age),
              type: "end",
              category: "realEstate",
              title: `${realEstate.title} | 임대소득 종료`,
            });
          }
        }

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

        // 매각 이벤트 (보유 종료년도)
        if (realEstate.endYear) {
          events.push({
            year: realEstate.endYear,
            age: realEstate.endYear - (data[0]?.year - data[0]?.age),
            type: "sale",
            category: "realEstate",
            title: `${realEstate.title} | 매각`,
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
    if (debts && debts.length > 0) {
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

  // 자산 이벤트 추출 (수익형 자산 구매, 매각)
  const getAssetEvents = () => {
    const events = [];
    if (assets && assets.length > 0) {
      assets.forEach((asset) => {
        // 모든 자산 이벤트 표시
        // 자산 구매 이벤트
        if (asset.isPurchase) {
          const purchaseEvent = {
            year: asset.startYear,
            age: asset.startYear - (data[0]?.year - data[0]?.age),
            type: "purchase",
            category: "asset",
            title: `${asset.title} | 추가`,
          };
          events.push(purchaseEvent);
        }

        // 자산 매각 이벤트 (종료년도 +1)
        if (asset.endYear) {
          const saleEvent = {
            year: asset.endYear + 1,
            age: asset.endYear + 1 - (data[0]?.year - data[0]?.age),
            type: "sale",
            category: "asset",
            title: `${asset.title} | 매각`,
          };
          events.push(saleEvent);
        }
      });
    }
    return events;
  };

  const assetEvents = getAssetEvents();
  const debtEvents = getDebtEvents();

  // 이벤트를 년도별로 그룹화
  const allEvents = [
    ...incomeEvents,
    ...expenseEvents,
    ...savingEvents,
    ...pensionEvents,
    ...realEstateEvents,
    ...assetEvents,
    ...debtEvents,
  ];
  const eventsByYear = allEvents.reduce((acc, event) => {
    if (!acc[event.year]) {
      acc[event.year] = [];
    }
    acc[event.year].push(event);
    return acc;
  }, {});

  // 차트 데이터 포맷팅
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
          .join(", ");
        familyLabel += ` • ${childrenText}`;
      }

      return {
        age: item.age,
        year: item.year,
        amount: item.amount,
        formattedAmount: formatAmountForChart(item.amount),
        familyLabel: familyLabel,
        assetPurchases: item.assetPurchases || [],
        savingPurchases: item.savingPurchases || [],
        savingIncomes: item.savingIncomes || [],
        savingContributions: item.savingContributions || [],
        realEstatePurchases: item.realEstatePurchases || [],
        realEstateTaxes: item.realEstateTaxes || [],
        capitalGainsTaxes: item.capitalGainsTaxes || [],
        assetSales: item.assetSales || [],
        realEstateSales: item.realEstateSales || [],
        debtInjections: item.debtInjections || [],
        debtInterests: item.debtInterests || [],
        debtPrincipals: item.debtPrincipals || [],
        events: eventsByYear[item.year] || [],
      };
    });
  }, [hasData, data, profileData, eventsByYear, xAxisRange]);

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
      // 모달이나 투자 설정 모달이 열려있으면 방향키를 차단하지 않음
      if (isDistributionOpen || investmentModalData) {
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
  }, [hasData, data, isDistributionOpen, investmentModalData]); // 모달 상태도 의존성에 추가

  // 은퇴 시점 찾기
  const retirementData = chartData.find((item) => item.age === retirementAge);

  // Y축 도메인 계산 (0을 중심으로 대칭) - chartData 변경 시 재계산
  const { yDomain, ticks } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        yDomain: [-10000, 10000],
        ticks: [-10000, -5000, 0, 5000, 10000],
      };
    }

    const amounts = chartData.map((d) => d.amount);
    const maxAbsAmount = Math.max(...amounts.map(Math.abs), 1000);

    // 깔끔한 Y축을 위해 1000만원 단위로 반올림
    const roundedMax = Math.ceil(maxAbsAmount / 1000) * 1000;
    const domain = [-roundedMax, roundedMax];

    // Y축 틱 생성 (깔끔한 간격으로)
    const tickStep = roundedMax / 4; // 4개 구간으로 나누기
    const tickArray = [];
    for (let i = -4; i <= 4; i++) {
      const tickValue = i * tickStep;
      if (!tickArray.includes(tickValue)) {
        tickArray.push(tickValue);
      }
    }

    return { yDomain: domain, ticks: tickArray };
  }, [chartData]);

  // 차트 렌더링 함수
  const renderChart = (height = 600) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{
          top: 40,
          right: 30,
          left: 40,
          bottom: 120,
        }}
        onClick={(e) => {
          // 클릭한 위치의 년도 데이터 찾기
          if (e && e.activeLabel) {
            const year = parseInt(e.activeLabel);
            const clickedData = chartData.find((d) => d.year === year);
            if (clickedData) {
              handleBarClick({ payload: clickedData });
            }
          } else if (e && e.activePayload && e.activePayload[0]) {
            handleBarClick(e.activePayload[0]);
          }
        }}
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
          ticks={ticks}
          tickFormatter={(value) => {
            if (value === 0) return "0";
            const absValue = Math.abs(value);
            const formatted = formatAmountForChart(absValue);
            return value > 0 ? `+${formatted}` : `-${formatted}`;
          }}
          stroke="#6b7280"
          fontSize={12}
        />

        {/* 0선 */}
        <ReferenceLine
          y={0}
          stroke="#6b7280"
          strokeWidth={2}
          strokeDasharray="5 5"
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
              offset: 10,
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
              offset: spouseRetirementYear === retirementYear ? 30 : 10,
              style: { fill: "#a78bfa", fontSize: "12px" },
            }}
          />
        )}

        {/* 툴팁 */}
        <Tooltip
          cursor={{
            fill: "rgba(59, 130, 246, 0.15)",
            stroke: "#3b82f6",
            strokeWidth: 2,
          }}
          content={({ active, payload }) => {
            if (active && payload && payload.length > 0) {
              const data = payload[0].payload;
              const detailData = detailedData.find(
                (item) => item.year === data.year
              );

              // 카테고리별 색상 설정 (모달과 동일)
              const categoryConfig = {
                소득: { color: "#10b981", name: "소득" },
                지출: { color: "#ef4444", name: "지출" },
                저축: { color: "#3b82f6", name: "저축/투자" },
                "저축 구매": { color: "#3b82f6", name: "저축/투자" },
                "저축 적립": { color: "#3b82f6", name: "저축/투자" },
                "저축 수령": { color: "#3b82f6", name: "저축/투자" },
                "저축 판매/수령": { color: "#3b82f6", name: "저축/투자" },
                "저축 수익": { color: "#3b82f6", name: "저축/투자" },
                "저축 만기": { color: "#3b82f6", name: "저축/투자" },
                "저축 만료": { color: "#3b82f6", name: "저축/투자" },
                자산인출: { color: "#3b82f6", name: "저축/투자" },
                "자산 인출": { color: "#3b82f6", name: "저축/투자" },
                잉여투자: { color: "#3b82f6", name: "저축/투자" },
                "잉여 투자": { color: "#3b82f6", name: "저축/투자" },
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
                "부동산 매도/수령": { color: "#8b5cf6", name: "부동산" },
                "부동산 취득세": { color: "#8b4513", name: "세금" },
                주택연금: { color: "#8b5cf6", name: "부동산" },
                취득세: { color: "#8b4513", name: "세금" },
                양도소득세: { color: "#8b4513", name: "세금" },
                양도세: { color: "#8b4513", name: "세금" },
                자산: { color: "#06b6d4", name: "자산" },
                "자산 구매": { color: "#06b6d4", name: "자산" },
                "자산 수령": { color: "#06b6d4", name: "자산" },
                "자산 판매/수령": { color: "#06b6d4", name: "자산" },
                대출: { color: "#374151", name: "부채" },
                "대출 유입": { color: "#374151", name: "부채" },
                이자: { color: "#374151", name: "부채" },
                "부채 이자": { color: "#374151", name: "부채" },
                "원금 상환": { color: "#374151", name: "부채" },
                "부채 원금 상환": { color: "#374151", name: "부채" },
              };

              // breakdown에서 수입/지출 데이터 가져오기 (카테고리별로 그룹화)
              const positivesByCategory = {};
              const negativesByCategory = {};

              if (detailData && detailData.breakdown) {
                (detailData.breakdown.positives || []).forEach((item) => {
                  const categoryName =
                    categoryConfig[item.category]?.name ||
                    categoryConfig[item.label]?.name ||
                    "기타";
                  const color =
                    categoryConfig[item.category]?.color ||
                    categoryConfig[item.label]?.color ||
                    "#9ca3af";

                  if (!positivesByCategory[categoryName]) {
                    positivesByCategory[categoryName] = {
                      color:
                        categoryConfig[item.category]?.color ||
                        categoryConfig[item.label]?.color ||
                        "#9ca3af",
                      items: [],
                    };
                  }
                  positivesByCategory[categoryName].items.push({
                    label: item.label,
                    amount: item.amount,
                    color: color,
                  });
                });

                (detailData.breakdown.negatives || []).forEach((item) => {
                  const categoryName =
                    categoryConfig[item.category]?.name ||
                    categoryConfig[item.label]?.name ||
                    "기타";
                  const color =
                    categoryConfig[item.category]?.color ||
                    categoryConfig[item.label]?.color ||
                    "#9ca3af";

                  if (!negativesByCategory[categoryName]) {
                    negativesByCategory[categoryName] = {
                      color:
                        categoryConfig[item.category]?.color ||
                        categoryConfig[item.label]?.color ||
                        "#9ca3af",
                      items: [],
                    };
                  }
                  negativesByCategory[categoryName].items.push({
                    label: item.label,
                    amount: item.amount,
                    color: color,
                  });
                });
              }

              // 전체 합계를 위한 배열 생성
              const positives = Object.values(positivesByCategory)
                .map((cat) => cat.items)
                .flat();
              const negatives = Object.values(negativesByCategory)
                .map((cat) => cat.items)
                .flat();

              const totalPositive = positives.reduce(
                (sum, item) => sum + item.amount,
                0
              );
              const totalNegative = negatives.reduce(
                (sum, item) => sum + item.amount,
                0
              );
              const netCashflow = data.amount || 0;

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
                      {data.year}년
                    </div>

                    {/* 가족 구성 */}
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6b7280",
                      }}
                    >
                      본인 {data.age}세
                      {profileData?.hasSpouse &&
                        profileData?.spouseBirthYear &&
                        ` • 배우자 ${
                          data.year - parseInt(profileData.spouseBirthYear)
                        }세`}
                      {profileData?.familyMembers &&
                        profileData.familyMembers
                          .filter((member) => member.relationship === "자녀")
                          .map((child) => ({
                            gender: child.gender || "아들",
                            age: data.year - parseInt(child.birthYear),
                          }))
                          .filter((child) => child.age >= 0).length > 0 &&
                        ` • ${profileData.familyMembers
                          .filter((member) => member.relationship === "자녀")
                          .map((child) => ({
                            gender: child.gender || "아들",
                            age: data.year - parseInt(child.birthYear),
                          }))
                          .filter((child) => child.age >= 0)
                          .map((child) => `${child.gender} ${child.age}세`)
                          .join(" • ")}`}
                    </div>
                  </div>

                  {/* 순 현금흐름 */}
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
                    <span>순 현금흐름</span>
                    <span
                      style={{
                        color: netCashflow >= 0 ? "#10b981" : "#ef4444",
                      }}
                    >
                      {netCashflow >= 0 ? "+" : ""}
                      {formatAmountForChart(netCashflow)}
                    </span>
                  </div>

                  {/* 수입 */}
                  {positives.length > 0 && (
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
                        <span style={{ color: "#4b5563" }}>수입</span>
                        <span style={{ color: "#10b981" }}>
                          +{formatAmountForChart(totalPositive)}
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
                        {/* 카테고리 순서 정의 */}
                        {[
                          "소득",
                          "지출",
                          "저축/투자",
                          "연금",
                          "부동산",
                          "자산",
                          "부채",
                          "세금",
                        ]
                          .filter(
                            (categoryName) => positivesByCategory[categoryName]
                          )
                          .map((categoryName) => {
                            const categoryData =
                              positivesByCategory[categoryName];
                            // 개별 항목 표시
                            return categoryData.items.map((item, itemIndex) => (
                              <div
                                key={`positive-item-${categoryName}-${itemIndex}`}
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
                                    backgroundColor: categoryData.color,
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ color: "#1f2937" }}>
                                  {item.label}
                                </span>
                                <span
                                  style={{
                                    marginLeft: "auto",
                                    color: "#1f2937",
                                    fontWeight: "500",
                                  }}
                                >
                                  +{formatAmountForChart(item.amount)}
                                </span>
                              </div>
                            ));
                          })}
                      </div>
                    </div>
                  )}

                  {/* 지출 */}
                  {negatives.length > 0 && (
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
                        <span style={{ color: "#4b5563" }}>지출</span>
                        <span style={{ color: "#ef4444" }}>
                          -{formatAmountForChart(totalNegative)}
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
                        {/* 카테고리 순서 정의 */}
                        {[
                          "소득",
                          "지출",
                          "저축/투자",
                          "연금",
                          "부동산",
                          "자산",
                          "부채",
                          "세금",
                        ]
                          .filter(
                            (categoryName) => negativesByCategory[categoryName]
                          )
                          .map((categoryName) => {
                            const categoryData =
                              negativesByCategory[categoryName];
                            // 개별 항목 표시
                            return categoryData.items.map((item, itemIndex) => (
                              <div
                                key={`negative-item-${categoryName}-${itemIndex}`}
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
                                    backgroundColor: categoryData.color,
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ color: "#1f2937" }}>
                                  {item.label}
                                </span>
                                <span
                                  style={{
                                    marginLeft: "auto",
                                    color: "#1f2937",
                                    fontWeight: "500",
                                  }}
                                >
                                  -{formatAmountForChart(item.amount)}
                                </span>
                              </div>
                            ));
                          })}
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

        {/* Bar 그래프 */}
        <Bar
          dataKey="amount"
          radius={[0, 0, 0, 0]}
          strokeWidth={0}
          onClick={handleBarClick}
          style={{ cursor: "pointer" }}
          animationDuration={400}
          animationBegin={0}
          isAnimationActive={true}
          label={renderInvestmentIcon}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.amount >= 0 ? "#10b981" : "#ef4444"}
              style={{ cursor: "pointer" }}
            />
          ))}
        </Bar>

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

  // 카테고리별 색상 설정 (한글 카테고리를 키로 사용)
  const categoryConfig = {
    소득: { color: "#10b981", order: 1, name: "소득" },
    지출: { color: "#ef4444", order: 2, name: "지출" },
    저축: { color: "#3b82f6", order: 3, name: "저축" },
    "저축 구매": { color: "#3b82f6", order: 3, name: "저축" },
    "저축 적립": { color: "#3b82f6", order: 3, name: "저축" },
    "저축 수령": { color: "#3b82f6", order: 3, name: "저축" },
    "저축 판매/수령": { color: "#3b82f6", order: 3, name: "저축" },
    "저축 수익": { color: "#3b82f6", order: 3, name: "저축" },
    "저축 만기": { color: "#3b82f6", order: 3, name: "저축" },
    "저축 만료": { color: "#3b82f6", order: 3, name: "저축" },
    자산인출: { color: "#3b82f6", order: 3, name: "저축" },
    "자산 인출": { color: "#3b82f6", order: 3, name: "저축" },
    잉여투자: { color: "#3b82f6", order: 3, name: "저축" },
    "잉여 투자": { color: "#3b82f6", order: 3, name: "저축" },
    국민연금: { color: "#fbbf24", order: 4, name: "연금" },
    퇴직연금: { color: "#fbbf24", order: 4, name: "연금" },
    개인연금: { color: "#fbbf24", order: 4, name: "연금" },
    "퇴직금 IRP": { color: "#fbbf24", order: 4, name: "연금" },
    "퇴직금 IRP 적립": { color: "#fbbf24", order: 4, name: "연금" },
    "연금 적립": { color: "#fbbf24", order: 4, name: "연금" },
    부동산: { color: "#8b5cf6", order: 5, name: "부동산" },
    임대소득: { color: "#8b5cf6", order: 5, name: "부동산" },
    "임대 소득": { color: "#8b5cf6", order: 5, name: "부동산" },
    "부동산 구매": { color: "#8b5cf6", order: 5, name: "부동산" },
    "부동산 수령": { color: "#8b5cf6", order: 5, name: "부동산" },
    "부동산 매도/수령": { color: "#8b5cf6", order: 5, name: "부동산" },
    "부동산 취득세": { color: "#8b4513", order: 8, name: "세금" },
    주택연금: { color: "#8b5cf6", order: 5, name: "부동산" },
    취득세: { color: "#8b4513", order: 8, name: "세금" },
    양도소득세: { color: "#8b4513", order: 8, name: "세금" },
    양도세: { color: "#8b4513", order: 8, name: "세금" },
    자산: { color: "#06b6d4", order: 6, name: "자산" },
    "자산 구매": { color: "#06b6d4", order: 6, name: "자산" },
    "자산 수령": { color: "#06b6d4", order: 6, name: "자산" },
    "자산 판매/수령": { color: "#06b6d4", order: 6, name: "자산" },
    대출: { color: "#374151", order: 7, name: "부채" },
    "대출 유입": { color: "#374151", order: 7, name: "부채" },
    이자: { color: "#374151", order: 7, name: "부채" },
    "부채 이자": { color: "#374151", order: 7, name: "부채" },
    "원금 상환": { color: "#374151", order: 7, name: "부채" },
    "부채 원금 상환": { color: "#374151", order: 7, name: "부채" },
  };

  // 수입/지출 분포 데이터 생성 (파이 차트용 - 카테고리별 그룹화)
  const allDistributionData = useMemo(() => {
    const distributionByYear = {};

    detailedData.forEach((yearData) => {
      const positiveCategoryMap = {}; // 카테고리별 데이터 (파이 차트 + 리스트용)
      const negativeCategoryMap = {}; // 카테고리별 데이터 (파이 차트 + 리스트용)

      if (yearData.breakdown) {
        // 수입 항목 처리
        (yearData.breakdown.positives || []).forEach((item) => {
          const category = categoryConfig[item.category]?.name || "기타";
          const color = categoryConfig[item.category]?.color || "#9ca3af";

          // 카테고리별 데이터 구조 생성
          if (!positiveCategoryMap[category]) {
            positiveCategoryMap[category] = {
              name: category,
              value: 0,
              color: color,
              items: [], // 해당 카테고리의 개별 항목들
            };
          }

          // 카테고리 합계 증가
          positiveCategoryMap[category].value += item.amount;

          // 개별 항목 추가
          positiveCategoryMap[category].items.push({
            name: item.label,
            value: item.amount,
            originalValue: item.amount,
          });
        });

        // 지출 항목 처리
        (yearData.breakdown.negatives || []).forEach((item) => {
          const category = categoryConfig[item.category]?.name || "기타";
          const color = categoryConfig[item.category]?.color || "#9ca3af";

          // 카테고리별 데이터 구조 생성
          if (!negativeCategoryMap[category]) {
            negativeCategoryMap[category] = {
              name: category,
              value: 0,
              color: color,
              items: [], // 해당 카테고리의 개별 항목들
            };
          }

          // 카테고리 합계 증가
          negativeCategoryMap[category].value += item.amount;

          // 개별 항목 추가
          negativeCategoryMap[category].items.push({
            name: item.label,
            value: item.amount,
            originalValue: item.amount,
          });
        });
      }

      distributionByYear[yearData.year] = {
        positiveCategories: Object.values(positiveCategoryMap), // 카테고리별 데이터 (파이 차트 + 리스트용)
        negativeCategories: Object.values(negativeCategoryMap), // 카테고리별 데이터 (파이 차트 + 리스트용)
      };
    });

    return distributionByYear;
  }, [detailedData]);

  const distributionSlices = useMemo(() => {
    if (!distributionEntry || !allDistributionData[distributionEntry.year]) {
      return {
        positiveCategories: [],
        negativeCategories: [],
      };
    }
    return allDistributionData[distributionEntry.year];
  }, [distributionEntry, allDistributionData]);

  // 정렬된 분포 데이터 (카테고리별로 그룹화된 항목들)
  const sortedDistribution = useMemo(() => {
    // 카테고리를 금액 순으로 정렬하고, 각 항목에 카테고리 정보 추가
    const sortedPositiveItems = [];
    [...distributionSlices.positiveCategories]
      .sort((a, b) => b.value - a.value)
      .forEach((category) => {
        const sortedItems = [...category.items].sort(
          (a, b) => b.value - a.value
        );
        sortedItems.forEach((item) => {
          sortedPositiveItems.push({
            ...item,
            categoryName: category.name,
            categoryColor: category.color,
          });
        });
      });

    const sortedNegativeItems = [];
    [...distributionSlices.negativeCategories]
      .sort((a, b) => b.value - a.value)
      .forEach((category) => {
        const sortedItems = [...category.items].sort(
          (a, b) => b.value - a.value
        );
        sortedItems.forEach((item) => {
          sortedNegativeItems.push({
            ...item,
            categoryName: category.name,
            categoryColor: category.color,
          });
        });
      });

    return {
      positiveItems: sortedPositiveItems,
      negativeItems: sortedNegativeItems,
    };
  }, [distributionSlices]);

  // 총 합계 계산
  const totalPositiveValue = useMemo(() => {
    return distributionSlices.positiveCategories.reduce(
      (sum, item) => sum + item.value,
      0
    );
  }, [distributionSlices.positiveCategories]);

  const totalNegativeValue = useMemo(() => {
    return distributionSlices.negativeCategories.reduce(
      (sum, item) => sum + item.value,
      0
    );
  }, [distributionSlices.negativeCategories]);

  // 바 클릭 핸들러
  const handleBarClick = (barData) => {
    if (!barData || !barData.payload) return;
    setDistributionEntry(barData.payload);
    setIsDistributionOpen(true);
  };

  // 방향키로 연도 변경 핸들러
  const handleYearChange = (newYear) => {
    const newEntry = chartData.find((item) => item.year === newYear);
    if (newEntry) {
      setDistributionEntry(newEntry);
    }
  };

  // 투자 설정 아이콘 클릭 핸들러
  const handleInvestmentSettingClick = useCallback(
    (entry) => {
      if (!entry) return;

      // 현재 설정된 투자 규칙 가져오기
      const currentRule =
        currentSimulation?.cashflowInvestmentRules?.[entry.year] || null;

      // 투자 설정이 있는 경우에는 amount가 0 이하여도 모달 열기 허용
      const hasInvestment = currentRule?.allocations?.some(
        (allocation) =>
          (allocation.targetType === "saving" ||
            allocation.targetType === "pension") &&
          allocation.ratio > 0
      );

      if (entry.amount <= 0 && !hasInvestment) return;

      // 양수 현금흐름이 있거나 투자 설정이 있는 년도 목록 계산
      const positiveYears = chartData
        .filter((item) => {
          if (item.amount > 0) return true;
          // 투자 설정이 있는 년도도 포함
          const rule = currentSimulation?.cashflowInvestmentRules?.[item.year];
          return rule?.allocations?.some(
            (allocation) =>
              (allocation.targetType === "saving" ||
                allocation.targetType === "pension") &&
              allocation.ratio > 0
          );
        })
        .map((item) => ({
          year: item.year,
          amount: item.amount,
        }));

      setInvestmentModalData({
        year: entry.year,
        amount: entry.amount,
        currentRule,
        positiveYears,
      });
    },
    [chartData, currentSimulation]
  );

  // 투자 규칙 저장 핸들러
  const handleSaveInvestmentRule = (years, rule) => {
    if (onUpdateInvestmentRule) {
      onUpdateInvestmentRule(years, rule);
    }
    setInvestmentModalData(null);
  };

  // 투자 아이콘 렌더링 함수 (메모이제이션)
  const renderInvestmentIcon = useCallback(
    (props) => {
      const { x, y, width, value, index } = props;
      const entry = chartData[index];

      // entry가 없으면 아무것도 렌더링하지 않음
      if (!entry) {
        return null;
      }

      // 투자 규칙 확인 (현금 100%가 아닌 경우 파란색)
      const investmentRule =
        currentSimulation?.cashflowInvestmentRules?.[entry.year];
      const hasInvestment = investmentRule?.allocations?.some(
        (allocation) =>
          (allocation.targetType === "saving" ||
            allocation.targetType === "pension") &&
          allocation.ratio > 0
      );

      // 양수인 경우 또는 투자 설정이 있는 경우 아이콘 표시
      if (value > 0 || hasInvestment) {
        const baseColor = hasInvestment ? "#3b82f6" : "#9ca3af"; // 파란색 or 회색
        const hoverColor = hasInvestment ? "#2563eb" : "#374151"; // 진한 파란색 or 진한 회색

        // 0원일 때 아이콘 위치 계산 (바 높이가 0이므로 기준선 위에 표시)
        const iconY = value > 0 ? y - 20 : y - 16;

        return (
          <g>
            <foreignObject
              x={x + width / 2 - 8}
              y={iconY}
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
                  opacity: hasInvestment ? 0.8 : 0.6,
                  transition: "opacity 0.2s, color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.color = hoverColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = hasInvestment ? "0.8" : "0.6";
                  e.currentTarget.style.color = baseColor;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleInvestmentSettingClick(entry);
                }}
                title="투자 설정"
              >
                ◎
              </div>
            </foreignObject>
          </g>
        );
      }
      return null;
    },
    [chartData, currentSimulation, handleInvestmentSettingClick]
  );

  return (
    <>
      <div className={styles.chartContainer} ref={chartContainerRef}>
        {!hasData ? (
          <div className={styles.noData}>데이터가 없습니다.</div>
        ) : (
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
            <div className={styles.chartWrapper}>{renderChart()}</div>
          </>
        )}
      </div>

      {/* 수입/지출 분포 모달 (파이 차트) */}
      {hasData && (
        <ChartZoomModal
          isOpen={isDistributionOpen}
          onClose={() => {
            setIsDistributionOpen(false);
            setDistributionEntry(null);
          }}
          title={
            distributionEntry
              ? `${distributionEntry.year}년 현금 흐름 구성`
              : "현금 흐름 구성"
          }
          onYearChange={handleYearChange}
          currentYear={distributionEntry?.year}
          allYears={chartData.map((item) => item.year)}
        >
          <div className={styles.distributionModalContent}>
            {distributionSlices.positiveCategories.length === 0 &&
            distributionSlices.negativeCategories.length === 0 ? (
              <div className={styles.noDistributionData}>
                해당 연도의 현금 흐름 구성을 계산할 수 없습니다.
              </div>
            ) : (
              <>
                {/* 수입 섹션 (파이 차트 + 리스트) */}
                {sortedDistribution.positiveItems.length > 0 && (
                  <>
                    {/* 수입 파이 차트 (카테고리별) */}
                    <div className={styles.pieChartWrapper}>
                      <SimplePieChart
                        data={distributionSlices.positiveCategories}
                        totalValue={totalPositiveValue}
                      />
                    </div>

                    {/* 수입 리스트 (카테고리별 그룹화) */}
                    <div className={styles.compactSection}>
                      <div className={styles.compactTitleRow}>
                        <h5 className={styles.compactTitle}>수입</h5>
                        <span className={styles.compactTotalPositive}>
                          +{formatAmountForChart(totalPositiveValue)}
                        </span>
                      </div>
                      <div className={styles.compactList}>
                        {sortedDistribution.positiveItems.map((item) => {
                          const percent =
                            totalPositiveValue > 0
                              ? (
                                  (item.value / totalPositiveValue) *
                                  100
                                ).toFixed(1)
                              : "0.0";
                          return (
                            <div
                              key={`positive-item-${item.name}`}
                              className={styles.compactRow}
                            >
                              <span className={styles.compactLabel}>
                                <span
                                  className={styles.distributionDot}
                                  style={{
                                    backgroundColor: item.categoryColor,
                                  }}
                                />
                                {item.name}
                              </span>
                              <span className={styles.compactValue}>
                                +
                                {formatAmountForChart(
                                  Math.abs(item.originalValue)
                                )}
                                <span className={styles.compactPercent}>
                                  {percent}%
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* 지출 섹션 (파이 차트 + 리스트) */}
                {sortedDistribution.negativeItems.length > 0 && (
                  <>
                    {/* 지출 파이 차트 (카테고리별) */}
                    <div className={styles.pieChartWrapper}>
                      <SimplePieChart
                        data={distributionSlices.negativeCategories}
                        totalValue={totalNegativeValue}
                      />
                    </div>

                    {/* 지출 리스트 (카테고리별 그룹화) */}
                    <div className={styles.compactSection}>
                      <div className={styles.compactTitleRow}>
                        <h5 className={styles.compactTitle}>지출</h5>
                        <span className={styles.compactTotalNegative}>
                          -{formatAmountForChart(totalNegativeValue)}
                        </span>
                      </div>
                      <div className={styles.compactList}>
                        {sortedDistribution.negativeItems.map((item) => {
                          const percent =
                            totalNegativeValue > 0
                              ? (
                                  (item.value / totalNegativeValue) *
                                  100
                                ).toFixed(1)
                              : "0.0";
                          return (
                            <div
                              key={`negative-item-${item.name}`}
                              className={styles.compactRow}
                            >
                              <span className={styles.compactLabel}>
                                <span
                                  className={styles.distributionDot}
                                  style={{
                                    backgroundColor: item.categoryColor,
                                  }}
                                />
                                {item.name}
                              </span>
                              <span className={styles.compactValue}>
                                -
                                {formatAmountForChart(
                                  Math.abs(item.originalValue)
                                )}
                                <span className={styles.compactPercent}>
                                  {percent}%
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* 이벤트 섹션 */}
                {distributionEntry?.events &&
                  distributionEntry.events.length > 0 && (
                    <div className={styles.compactSection}>
                      <div className={styles.compactTitleRow}>
                        <h5 className={styles.compactTitle}>이벤트</h5>
                        <span className={styles.compactEventCount}>
                          {distributionEntry.events.length}
                        </span>
                      </div>
                      <div className={styles.compactList}>
                        {distributionEntry.events.map((event, index) => (
                          <div key={index} className={styles.compactRow}>
                            <span className={styles.compactLabel}>
                              <span
                                className={styles.eventDot}
                                style={{ backgroundColor: "#3b82f6" }}
                              />
                              {event.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </ChartZoomModal>
      )}

      {/* 잉여 현금 투자 설정 모달 */}
      {investmentModalData && (
        <CashflowInvestmentModal
          isOpen={!!investmentModalData}
          onClose={() => setInvestmentModalData(null)}
          year={investmentModalData.year}
          amount={investmentModalData.amount}
          savings={savings}
          pensions={pensions}
          currentRule={investmentModalData.currentRule}
          positiveYears={investmentModalData.positiveYears || []}
          onSave={handleSaveInvestmentRule}
          onYearChange={(newYear, newAmount) => {
            // 방향키로 연도 변경 시 호출됨
            // 양수 현금흐름에서 해당 연도 찾기
            const positiveYears = investmentModalData.positiveYears || [];
            const newYearData = positiveYears.find(
              (item) => item.year === newYear
            );

            if (newYearData) {
              // 해당 연도의 투자 규칙 가져오기
              const investmentRules =
                currentSimulation?.cashflowInvestmentRules || {};
              const rule = investmentRules[newYear] || null;

              setInvestmentModalData({
                year: newYear,
                amount: newAmount,
                currentRule: rule,
                positiveYears: positiveYears,
              });
            }
          }}
        />
      )}
    </>
  );
}

export default RechartsCashflowChart;
