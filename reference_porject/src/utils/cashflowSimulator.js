/**
 * 현금흐름 시뮬레이션 계산 유틸리티
 */
import { calculateKoreanAge } from "./koreanAge";

/**
 * PMT 계산 함수 (정기 지불액 계산)
 * @param {number} pv - 현재 가치 (Present Value)
 * @param {number} rate - 기간당 이자율 (연수익률)
 * @param {number} nper - 총 지불/수령 횟수 (기간)
 * @returns {number} 매년 수령액
 */
function calculatePMT(pv, rate, nper) {
  if (rate === 0) {
    // 이자율이 0이면 단순히 원금을 기간으로 나눔
    return pv / nper;
  }
  // PMT = (PV × r × (1 + r)^n) / ((1 + r)^n - 1)
  const pow = Math.pow(1 + rate, nper);
  return (pv * rate * pow) / (pow - 1);
}

/**
 * 연간 이자율을 월간 이자율로 변환 (복리 기준)
 * @param {number} annualRate - 연간 이자율 (소수, 예: 0.12 = 12%)
 * @returns {number} 월간 이자율 (소수)
 * @example
 * convertAnnualToMonthlyRate(0.12) // 0.009488... (약 0.9488%)
 */
function convertAnnualToMonthlyRate(annualRate) {
  if (annualRate === 0) return 0;
  // 복리 변환: (1 + r_annual)^(1/12) - 1 = r_monthly
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * 연간 상승률을 월간 상승률로 변환 (복리 기준)
 * @param {number} annualGrowthRate - 연간 상승률 (소수, 예: 0.03 = 3%)
 * @returns {number} 월간 상승률 (소수)
 */
function convertAnnualToMonthlyGrowthRate(annualGrowthRate) {
  return convertAnnualToMonthlyRate(annualGrowthRate);
}

/**
 * 날짜가 지정된 범위 내에 있는지 확인
 * @param {Date} currentDate - 확인할 날짜
 * @param {number} startYear - 시작 년도
 * @param {number} startMonth - 시작 월 (1-12)
 * @param {number} endYear - 종료 년도
 * @param {number} endMonth - 종료 월 (1-12)
 * @returns {boolean} 범위 내에 있으면 true
 */
function isDateInRange(currentDate, startYear, startMonth, endYear, endMonth) {
  const startDate = new Date(startYear, (startMonth || 1) - 1);
  const endDate = new Date(endYear, (endMonth || 12) - 1);
  return currentDate >= startDate && currentDate <= endDate;
}

/**
 * 월 단위 PMT 계산 함수 (정기 지불액 계산)
 * @param {number} pv - 현재 가치 (Present Value)
 * @param {number} monthlyRate - 월간 이자율 (소수)
 * @param {number} months - 총 지불/수령 개월 수
 * @returns {number} 매월 지불액
 * @example
 * calculateMonthlyPMT(10000, 0.01, 120) // 월간 PMT 계산
 */
function calculateMonthlyPMT(pv, monthlyRate, months) {
  if (monthlyRate === 0) {
    // 이자율이 0이면 단순히 원금을 개월 수로 나눔
    return pv / months;
  }
  // PMT = (PV × r × (1 + r)^n) / ((1 + r)^n - 1)
  const pow = Math.pow(1 + monthlyRate, months);
  return (pv * monthlyRate * pow) / (pow - 1);
}

/**
 * 경과 개월 수 계산
 * @param {number} startYear - 시작 년도
 * @param {number} startMonth - 시작 월 (1-12)
 * @param {number} endYear - 종료 년도
 * @param {number} endMonth - 종료 월 (1-12)
 * @returns {number} 경과 개월 수
 */
function calculateMonthsElapsed(startYear, startMonth, endYear, endMonth) {
  return (endYear - startYear) * 12 + ((endMonth || 12) - (startMonth || 1));
}

/**
 * 년도와 월을 Date 객체로 변환
 * @param {number} year - 년도
 * @param {number} month - 월 (1-12)
 * @returns {Date} Date 객체
 */
function createDateFromYearMonth(year, month) {
  return new Date(year, (month || 1) - 1);
}

/**
 * 숫자 변환 유틸 (fallback 허용)
 * @param {*} value - 변환할 값
 * @param {*} fallback - 변환 실패 시 반환할 기본값
 * @returns {number|*} 변환된 숫자 또는 fallback 값
 */
function toNumberOr(value, fallback = undefined) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * 부동산 취득세 계산 함수
 * @param {number} propertyValue - 부동산 가치 (만원 단위)
 * @returns {number} 취득세 (만원 단위)
 */
function calculateAcquisitionTax(propertyValue) {
  // 6억원 = 60000만원
  // 9억원 = 90000만원
  if (propertyValue <= 60000) {
    // 6억원 이하: 1.1%
    return propertyValue * 0.011;
  } else if (propertyValue <= 90000) {
    // 6억원 초과 9억원 이하: 2.2%
    return propertyValue * 0.022;
  } else {
    // 9억원 초과: 3.3%
    return propertyValue * 0.033;
  }
}

/**
 * 보유기간에 따른 장기보유특별공제율 계산
 * @param {number} holdingYears - 보유기간 (년)
 * @returns {number} 공제율 (0~0.8)
 */
function getLongTermDeductionRate(holdingYears) {
  if (holdingYears <= 4) return 0.24;
  if (holdingYears === 5) return 0.32;
  if (holdingYears === 6) return 0.4;
  if (holdingYears === 7) return 0.48;
  if (holdingYears === 8) return 0.56;
  if (holdingYears === 9) return 0.64;
  if (holdingYears === 10) return 0.72;
  return 0.8; // 10년 초과
}

/**
 * 과세표준에 따른 양도소득세율 및 누진공제 계산
 * @param {number} taxableIncome - 과세표준 (만원 단위)
 * @returns {Object} {taxRate: 세율, deduction: 누진공제}
 */
function getCapitalGainsTaxRate(taxableIncome) {
  if (taxableIncome <= 1400) {
    return { taxRate: 0.06, deduction: 0 };
  } else if (taxableIncome <= 5000) {
    return { taxRate: 0.15, deduction: 126 };
  } else if (taxableIncome <= 8800) {
    return { taxRate: 0.24, deduction: 576 };
  } else if (taxableIncome <= 15000) {
    return { taxRate: 0.35, deduction: 1544 };
  } else if (taxableIncome <= 30000) {
    return { taxRate: 0.38, deduction: 1994 };
  } else if (taxableIncome <= 50000) {
    return { taxRate: 0.4, deduction: 2594 };
  } else if (taxableIncome <= 100000) {
    return { taxRate: 0.42, deduction: 3594 };
  } else {
    // 10억원 초과
    return { taxRate: 0.45, deduction: 6594 };
  }
}

/**
 * 부동산 양도소득세 계산 함수 (거주용 1주택)
 * @param {number} salePrice - 양도가액 (만원 단위)
 * @param {number} acquisitionPrice - 취득가액 (만원 단위)
 * @param {number} holdingYears - 보유기간 (년)
 * @returns {Object} {capitalGainsTax: 양도소득세, totalTax: 총납부금액}
 */
function calculateCapitalGainsTax(salePrice, acquisitionPrice, holdingYears) {
  // 12억원 = 120000만원
  const EXEMPTION_THRESHOLD = 120000;

  // 양도가액이 12억원 이하면 양도세 없음
  if (salePrice <= EXEMPTION_THRESHOLD) {
    return { capitalGainsTax: 0, totalTax: 0 };
  }

  // 양도차익 = 양도가액 - 취득가액
  const capitalGain = salePrice - acquisitionPrice;

  // 1. 과세 대상 양도차익 = 양도차익 × (양도가액 - 12억원) / 양도가액
  const taxableCapitalGain =
    capitalGain * ((salePrice - EXEMPTION_THRESHOLD) / salePrice);

  // 2. 장기보유특별공제액 = 과세 대상 양도차익 × 공제율
  const deductionRate = getLongTermDeductionRate(holdingYears);
  const longTermDeduction = taxableCapitalGain * deductionRate;

  // 3. 과세표준 = (과세 대상 양도차익 - 장기보유특별공제액) - 250만원
  const taxableIncome = taxableCapitalGain - longTermDeduction - 250;

  // 과세표준이 음수면 세금 없음
  if (taxableIncome <= 0) {
    return { capitalGainsTax: 0, totalTax: 0 };
  }

  // 4. 양도소득세 = (과세표준 × 세율) - 누진공제
  const { taxRate, deduction } = getCapitalGainsTaxRate(taxableIncome);
  const capitalGainsTax = taxableIncome * taxRate - deduction;

  // 5. 총 납부금액 = 양도소득세 × 1.1 (지방소득세 10% 포함)
  const totalTax = capitalGainsTax * 1.1;

  return { capitalGainsTax, totalTax };
}

/**
 * 소득 데이터를 기반으로 현금흐름 시뮬레이션을 계산합니다.
 * @param {Object} profileData - 프로필 데이터
 * @param {Array} incomes - 소득 데이터 배열
 * @param {Array} expenses - 지출 데이터 배열 (추후 구현)
 * @param {Array} savings - 저축 데이터 배열 (추후 구현)
 * @param {Array} pensions - 연금 데이터 배열 (추후 구현)
 * @returns {Array} 현금흐름 시뮬레이션 데이터
 */
export function calculateCashflowSimulation(
  profileData,
  incomes = [],
  expenses = [],
  savings = [],
  pensions = [],
  realEstates = [], // 부동산 데이터 추가
  assets = [], // 자산 데이터 추가
  debts = [] // 부채 데이터 추가
) {
  const currentYear = new Date().getFullYear();
  const startAge = calculateKoreanAge(profileData.birthYear, currentYear); // 만 나이로 실시간 계산
  const deathAge = 90;
  const simulationYears = deathAge - startAge + 1;

  // 은퇴년도 가져오기
  const retirementYear = profileData.retirementYear || currentYear;

  const cashflowData = [];

  // 저축별 연도별 투자 금액 추적 (저축 ID별, 년도별)
  const savingInvestments = {}; // { savingId: { year: amount } }

  // 저축/투자 월 단위 계산을 위한 상태 초기화
  const savingStates = {};
  savings.forEach((saving, index) => {
    const sStartYear =
      typeof saving.startYear === "string"
        ? parseInt(saving.startYear, 10)
        : saving.startYear;
    const sStartMonth = saving.startMonth || 1;
    const sEndYear =
      typeof saving.endYear === "string"
        ? parseInt(saving.endYear, 10)
        : saving.endYear;
    const sEndMonth = saving.endMonth || 12;

    const stateKey = saving.id || `saving-${index}`;
    // 기보유 금액 계산 (treatAsInitialPurchase면 시작월에 추가, 아니면 바로 balance에 포함)
    const initialBalance = saving.treatAsInitialPurchase ? 0 : (Number(saving.currentAmount) || 0);
    savingStates[stateKey] = {
      startYear: sStartYear,
      startMonth: sStartMonth,
      endYear: sEndYear,
      endMonth: sEndMonth,
      amount: Number(saving.amount) || 0,
      frequency: saving.frequency,
      yearlyGrowthRate: saving.yearlyGrowthRate || 0,
      monthlyGrowthRate: convertAnnualToMonthlyGrowthRate(
        saving.yearlyGrowthRate || 0
      ),
      interestRate: saving.interestRate || 0,
      monthlyInterestRate: convertAnnualToMonthlyRate(saving.interestRate || 0),
      incomeRate: saving.incomeRate || 0,
      monthlyIncomeRate: convertAnnualToMonthlyRate(saving.incomeRate || 0),
      savingType: saving.savingType || "standard",
      capitalGainsTaxRate: saving.capitalGainsTaxRate || 0,
      treatAsInitialPurchase: !!saving.treatAsInitialPurchase,
      balance: initialBalance,
      // 원금 추적: 양도세 계산 시 수익(이익)에만 과세하기 위함
      // ⚠️ 기보유 금액은 원금에 포함하지 않음 (이미 과거에 투자한 금액이므로)
      totalPrincipal: 0,
      monthsElapsed: 0,
      started: false,
      matured: false,
      initialPurchaseApplied: false,
    };
  });

  // 부동산 월 단위 계산을 위한 상태 초기화
  const realEstateStates = {};
  realEstates.forEach((realEstate, index) => {
    const startYear = toNumberOr(realEstate.startYear);
    const startMonth = toNumberOr(realEstate.startMonth, 1) || 1;
    const endYear = toNumberOr(realEstate.endYear);
    const endMonth = toNumberOr(realEstate.endMonth, 12) || 12;
    const rentalStartYear = toNumberOr(realEstate.rentalIncomeStartYear);
    const rentalStartMonth = toNumberOr(realEstate.rentalIncomeStartMonth, 1);
    const rentalEndYear = toNumberOr(realEstate.rentalIncomeEndYear);
    const rentalEndMonth = toNumberOr(realEstate.rentalIncomeEndMonth, 12);
    const pensionStartYear = toNumberOr(realEstate.pensionStartYear);
    const pensionStartMonth = toNumberOr(realEstate.pensionStartMonth, 1);
    const pensionEndYear = toNumberOr(realEstate.pensionEndYear);
    const pensionEndMonth = toNumberOr(realEstate.pensionEndMonth, 12);

    const growthRate = (realEstate.growthRate || 0) / 100;
    const monthlyGrowthRate = convertAnnualToMonthlyGrowthRate(growthRate);

    const key = realEstate.id || realEstate.title || `realestate-${index}`;
    realEstateStates[key] = {
      key,
      title: realEstate.title || `부동산${index + 1}`,
      isPurchase: !!realEstate.isPurchase,
      isResidential: !!realEstate.isResidential,
      acquisitionPrice: toNumberOr(realEstate.acquisitionPrice),
      acquisitionYear: toNumberOr(realEstate.acquisitionYear, startYear),
      startYear,
      startMonth,
      endYear,
      endMonth,
      rentalStartYear,
      rentalStartMonth: rentalStartMonth || 1,
      rentalEndYear,
      rentalEndMonth: rentalEndMonth || 12,
      hasRentalIncome: !!realEstate.hasRentalIncome,
      monthlyRentalIncome: toNumberOr(realEstate.monthlyRentalIncome, 0) || 0,
      convertToPension: !!realEstate.convertToPension,
      pensionStartYear,
      pensionStartMonth: pensionStartMonth || 1,
      pensionEndYear,
      pensionEndMonth: pensionEndMonth || 12,
      monthlyPensionAmount: toNumberOr(realEstate.monthlyPensionAmount, 0) || 0,
      growthRate,
      monthlyGrowthRate,
      currentValue: toNumberOr(realEstate.currentValue, 0) || 0,
      started: false,
      sold: false,
      monthsHeld: 0,
    };
  });

  // 자산 월 단위 계산을 위한 상태 초기화
  const assetStates = {};
  assets.forEach((asset, index) => {
    const startYear = toNumberOr(asset.startYear);
    const startMonth = toNumberOr(asset.startMonth, 1) || 1;
    const endYear = toNumberOr(asset.endYear);
    const endMonth = toNumberOr(asset.endMonth, 12) || 12;
    const growthRate = asset.growthRate || 0;
    const monthlyGrowthRate = convertAnnualToMonthlyGrowthRate(growthRate);
    const incomeRate = asset.incomeRate || 0;
    const monthlyIncomeRate = convertAnnualToMonthlyRate(incomeRate);

    const key = asset.id || asset.title || `asset-${index}`;
    assetStates[key] = {
      key,
      title: asset.title || `자산${index + 1}`,
      startYear,
      startMonth,
      endYear,
      endMonth,
      growthRate,
      monthlyGrowthRate,
      incomeRate,
      monthlyIncomeRate,
      currentValue: toNumberOr(asset.currentValue, 0) || 0,
      initialValue: toNumberOr(asset.currentValue, 0) || 0,
      isPurchase: !!asset.isPurchase,
      assetType: asset.assetType || "general",
      capitalGainsTaxRate: asset.capitalGainsTaxRate || 0,
      started: false,
      sold: false,
      monthsHeld: 0,
      purchaseApplied: false,
    };
  });

  // 부채 월 단위 계산을 위한 상태 초기화
  const debtStates = {};
  debts.forEach((debt, index) => {
    const startYear = toNumberOr(debt.startYear);
    const startMonth = toNumberOr(debt.startMonth, 1) || 1;
    const endYear = toNumberOr(debt.endYear);
    const endMonth = toNumberOr(debt.endMonth, 12) || 12;
    const debtAmount = toNumberOr(debt.debtAmount, 0) || 0;
    const interestRate = debt.interestRate || 0; // 연 이율(소수)
    const monthlyInterestRate = convertAnnualToMonthlyRate(interestRate);
    const totalMonths =
      Number.isFinite(startYear) && Number.isFinite(endYear)
        ? (endYear - startYear) * 12 + (endMonth - startMonth) + 1
        : 0;
    const rawGraceMonths = (parseInt(debt.gracePeriod, 10) || 0) * 12;
    const cappedGraceMonths = Math.max(
      0,
      Math.min(rawGraceMonths, Math.max(totalMonths - 1, 0))
    );
    const repaymentMonths =
      debt.debtType === "grace"
        ? Math.max(totalMonths - cappedGraceMonths, 1)
        : Math.max(totalMonths, 0);
    const monthlyPMT =
      debt.debtType === "equal" && totalMonths > 0
        ? calculateMonthlyPMT(debtAmount, monthlyInterestRate, totalMonths)
        : 0;
    const principalPerMonth =
      debt.debtType === "principal" && totalMonths > 0
        ? debtAmount / totalMonths
        : 0;
    const gracePrincipalPerMonth =
      debt.debtType === "grace" && repaymentMonths > 0
        ? debtAmount / repaymentMonths
        : 0;

    const key = debt.id || debt.title || `debt-${index}`;
    debtStates[key] = {
      key,
      title: debt.title || `부채${index + 1}`,
      startYear,
      startMonth,
      endYear,
      endMonth,
      debtType: debt.debtType || "bullet",
      interestRate,
      monthlyInterestRate,
      debtAmount,
      totalMonths,
      graceMonths: cappedGraceMonths,
      repaymentMonths,
      monthlyPMT,
      principalPerMonth,
      gracePrincipalPerMonth,
      addCashToFlow: !!debt.addCashToFlow,
      started: false,
      finished: false,
      monthIndex: 0,
      balance: 0,
      addCashApplied: false,
    };
  });

  for (let i = 0; i < simulationYears; i++) {
    const year = currentYear + i;
    const age = startAge + i;

    let totalIncome = 0;
    let totalExpense = 0;
    let totalSavings = 0;
    let totalPension = 0;
    let totalDebtInjection = 0;
    const debtInjections = [];
    const positiveBreakdown = [];
    const negativeBreakdown = [];

    const addPositive = (label, amount, category, keyBase) => {
      const value = Number(amount) || 0;
      if (value <= 0) return;
      positiveBreakdown.push({
        key: `${keyBase || category}-${year}`,
        label,
        category,
        amount: value,
      });
    };

    const addNegative = (label, amount, category, keyBase) => {
      const value = Number(amount) || 0;
      if (value <= 0) return;
      negativeBreakdown.push({
        key: `${keyBase || category}-${year}`,
        label,
        category,
        amount: value,
      });
    };

    // 소득 계산 (월 단위 기준)
    incomes.forEach((income, incomeIndex) => {
      const startYear = income.startYear;
      const startMonth = income.startMonth || 1; // 기본값: 1월 (월초)
      const endYear = income.endYear;
      const endMonth = income.endMonth || 12; // 기본값: 12월 (월말)

      // 해당 년도에 소득이 발생하는지 확인
      if (year >= startYear && year <= endYear) {
        // 해당 년도에 포함된 개월 수 계산
        let monthsInYear = 0;
        let firstMonthInYear = 1;
        let lastMonthInYear = 12;

        if (year === startYear && year === endYear) {
          // 시작년도와 종료년도가 같은 경우
          firstMonthInYear = startMonth;
          lastMonthInYear = endMonth;
          monthsInYear = endMonth - startMonth + 1;
        } else if (year === startYear) {
          // 시작년도인 경우
          firstMonthInYear = startMonth;
          lastMonthInYear = 12;
          monthsInYear = 12 - startMonth + 1;
        } else if (year === endYear) {
          // 종료년도인 경우
          firstMonthInYear = 1;
          lastMonthInYear = endMonth;
          monthsInYear = endMonth;
        } else {
          // 중간 년도인 경우 (전체 12개월)
          firstMonthInYear = 1;
          lastMonthInYear = 12;
          monthsInYear = 12;
        }

        if (monthsInYear > 0) {
          const growthRate = income.growthRate / 100;
          const monthlyGrowthRate =
            convertAnnualToMonthlyGrowthRate(growthRate);

          let yearTotalIncome = 0;

          if (income.frequency === "monthly") {
            // 월간 빈도: 각 월마다 개별 계산
            const monthlyAmount = income.amount;

            // 각 월마다 소득 계산 및 합산
            for (let m = firstMonthInYear; m <= lastMonthInYear; m++) {
              // 시작 월부터 현재 월까지의 경과 개월 수 계산
              // 시작 월은 0개월 경과 (원래 금액 그대로)
              // 다음 월부터는 상승률 적용
              const monthsElapsed = (year - startYear) * 12 + (m - startMonth);

              // 월 단위 상승률 적용
              // 시작 월(monthsElapsed = 0)은 상승률 없음, 다음 월부터 상승률 적용
              const adjustedMonthlyAmount =
                monthlyAmount * Math.pow(1 + monthlyGrowthRate, monthsElapsed);
              yearTotalIncome += adjustedMonthlyAmount;
            }
          } else {
            // 연간 빈도: 해당 년도에 포함된 개월 수만큼 비율로 계산
            // 예: 연간 120만원, 10개월이면 120만원 * (10/12) = 100만원
            const annualAmount = income.amount;
            const ratioInYear = monthsInYear / 12; // 해당 년도에 포함된 비율

            // 시작 시점부터 현재 년도까지의 경과 년 수 계산
            const yearsElapsed = year - startYear;

            // 연간 상승률 적용 (년 단위)
            const adjustedAnnualAmount =
              annualAmount * Math.pow(1 + growthRate, yearsElapsed);

            // 해당 년도에 포함된 개월 수만큼 비율로 계산
            yearTotalIncome = adjustedAnnualAmount * ratioInYear;
          }

          totalIncome += yearTotalIncome;

          addPositive(
            income.title,
            yearTotalIncome,
            "소득",
            income.id ? `income-${income.id}` : `income-${incomeIndex}`
          );
        }
      }
    });

    // 지출 계산 (월 단위 기준)
    expenses.forEach((expense, expenseIndex) => {
      const startYear = expense.startYear;
      const startMonth = expense.startMonth || 1; // 기본값: 1월 (월초)
      const endYear = expense.endYear;
      const endMonth = expense.endMonth || 12; // 기본값: 12월 (월말)

      // 해당 년도에 지출이 발생하는지 확인
      if (year >= startYear && year <= endYear) {
        // 해당 년도에 포함된 개월 수 계산
        let monthsInYear = 0;
        let firstMonthInYear = 1;
        let lastMonthInYear = 12;

        if (year === startYear && year === endYear) {
          // 시작년도와 종료년도가 같은 경우
          firstMonthInYear = startMonth;
          lastMonthInYear = endMonth;
          monthsInYear = endMonth - startMonth + 1;
        } else if (year === startYear) {
          // 시작년도인 경우
          firstMonthInYear = startMonth;
          lastMonthInYear = 12;
          monthsInYear = 12 - startMonth + 1;
        } else if (year === endYear) {
          // 종료년도인 경우
          firstMonthInYear = 1;
          lastMonthInYear = endMonth;
          monthsInYear = endMonth;
        } else {
          // 중간 년도인 경우 (전체 12개월)
          firstMonthInYear = 1;
          lastMonthInYear = 12;
          monthsInYear = 12;
        }

        if (monthsInYear > 0) {
          let yearTotalExpense = 0;

          // 세부 항목이 있고 유효한 금액이 있는지 확인
          const validSubItems =
            expense.subItems &&
            expense.subItems.length > 0 &&
            expense.subItems.some((si) => parseInt(si.amount) > 0);

          if (validSubItems) {
            // 세부 항목이 있는 경우 각 항목별로 개별 성장률 적용
            expense.subItems.forEach((subItem) => {
              const subItemAmount = parseInt(subItem.amount) || 0;
              if (subItemAmount <= 0) return;

              // 세부 항목별 성장률 (없거나 NaN이면 지출 항목의 기본 성장률 사용)
              const parsedRate = parseFloat(subItem.growthRate);
              const subItemGrowthRate =
                (!isNaN(parsedRate) ? parsedRate : expense.growthRate) / 100;
              const subItemMonthlyGrowthRate =
                convertAnnualToMonthlyGrowthRate(subItemGrowthRate);

              if (expense.frequency === "monthly") {
                // 월간 빈도: 각 월마다 개별 계산
                for (let m = firstMonthInYear; m <= lastMonthInYear; m++) {
                  const monthsElapsed =
                    (year - startYear) * 12 + (m - startMonth);
                  const adjustedAmount =
                    subItemAmount *
                    Math.pow(1 + subItemMonthlyGrowthRate, monthsElapsed);
                  yearTotalExpense += adjustedAmount;
                }
              } else {
                // 연간 빈도
                const ratioInYear = monthsInYear / 12;
                const yearsElapsed = year - startYear;
                const adjustedAmount =
                  subItemAmount * Math.pow(1 + subItemGrowthRate, yearsElapsed);
                yearTotalExpense += adjustedAmount * ratioInYear;
              }
            });
          } else {
            // 세부 항목이 없는 경우 기존 로직 사용
            const growthRate = expense.growthRate / 100;
            const monthlyGrowthRate =
              convertAnnualToMonthlyGrowthRate(growthRate);

            if (expense.frequency === "monthly") {
              // 월간 빈도: 각 월마다 개별 계산
              const monthlyAmount = expense.amount;

              // 각 월마다 지출 계산 및 합산
              for (let m = firstMonthInYear; m <= lastMonthInYear; m++) {
                // 시작 월부터 현재 월까지의 경과 개월 수 계산
                // 시작 월은 0개월 경과 (원래 금액 그대로)
                // 다음 월부터는 상승률 적용
                const monthsElapsed =
                  (year - startYear) * 12 + (m - startMonth);

                // 월 단위 상승률 적용
                // 시작 월(monthsElapsed = 0)은 상승률 없음, 다음 월부터 상승률 적용
                const adjustedMonthlyAmount =
                  monthlyAmount *
                  Math.pow(1 + monthlyGrowthRate, monthsElapsed);
                yearTotalExpense += adjustedMonthlyAmount;
              }
            } else {
              // 연간 빈도: 해당 년도에 포함된 개월 수만큼 비율로 계산
              // 예: 연간 120만원, 10개월이면 120만원 * (10/12) = 100만원
              const annualAmount = expense.amount;
              const ratioInYear = monthsInYear / 12; // 해당 년도에 포함된 비율

              // 시작 시점부터 현재 년도까지의 경과 년 수 계산
              const yearsElapsed = year - startYear;

              // 연간 상승률 적용 (년 단위)
              const adjustedAnnualAmount =
                annualAmount * Math.pow(1 + growthRate, yearsElapsed);

              // 해당 년도에 포함된 개월 수만큼 비율로 계산
              yearTotalExpense = adjustedAnnualAmount * ratioInYear;
            }
          }

          totalExpense += yearTotalExpense;

          addNegative(
            expense.title,
            yearTotalExpense,
            "지출",
            expense.id ? `expense-${expense.id}` : `expense-${expenseIndex}`
          );
        }
      }
    });

    // 부채 이자 및 원금 상환 계산
    let totalDebtInterest = 0;
    let totalDebtPrincipal = 0;
    const debtInterestDetails = [];
    const debtPrincipalDetails = [];

    debts.forEach((debt) => {
      const debtStartYear =
        typeof debt.startYear === "string"
          ? parseInt(debt.startYear, 10)
          : debt.startYear;
      const debtEndYear =
        typeof debt.endYear === "string"
          ? parseInt(debt.endYear, 10)
          : debt.endYear;
      const rawDebtAmount =
        typeof debt.debtAmount === "string"
          ? parseFloat(debt.debtAmount)
          : debt.debtAmount;
      const debtAmount = Number.isFinite(rawDebtAmount) ? rawDebtAmount : 0;

      if (
        debt.addCashToFlow &&
        debtAmount > 0 &&
        Number.isFinite(debtStartYear) &&
        year === debtStartYear
      ) {
        totalDebtInjection += debtAmount;
        debtInjections.push({
          title: debt.title,
          amount: debtAmount,
        });

        addPositive(
          `${debt.title} | 대출 유입`,
          debtAmount,
          "대출 유입",
          `debtInjection-${debt.id || debt.title}`
        );
      }

      if (
        !Number.isFinite(debtStartYear) ||
        !Number.isFinite(debtEndYear) ||
        debtStartYear === undefined ||
        debtEndYear === undefined
      ) {
        return;
      }

      // 월별 계산을 위한 변수
      const debtStartMonth = toNumberOr(debt.startMonth, 1) || 1;
      const debtEndMonth = toNumberOr(debt.endMonth, 12) || 12;
      const interestRate = debt.interestRate || 0; // 연 이자율 (소수)
      const monthlyRate = interestRate / 12; // 월 이자율

      // 총 상환 개월 수 계산
      const totalMonths =
        calculateMonthsElapsed(
          debtStartYear,
          debtStartMonth,
          debtEndYear,
          debtEndMonth
        ) + 1;

      // 현재 년도가 부채 기간 내에 있는지 확인
      if (year < debtStartYear || year > debtEndYear) {
        if (year < debtStartYear) {
          debt.amount = 0;
          debt.isActive = false;
        }
        return;
      }

      // 현재 년도에 해당하는 상환 개월 수 계산
      let repaymentMonthsInYear = 0;
      let yearStartMonth = 1;
      let yearEndMonth = 12;

      if (year === debtStartYear && year === debtEndYear) {
        // 시작 년도와 종료 년도가 같은 경우
        yearStartMonth = debtStartMonth;
        yearEndMonth = debtEndMonth;
        repaymentMonthsInYear = debtEndMonth - debtStartMonth + 1;
      } else if (year === debtStartYear) {
        // 시작 년도: 시작 월부터 12월까지
        yearStartMonth = debtStartMonth;
        yearEndMonth = 12;
        repaymentMonthsInYear = 13 - debtStartMonth;
      } else if (year === debtEndYear) {
        // 종료 년도: 1월부터 종료 월까지
        yearStartMonth = 1;
        yearEndMonth = debtEndMonth;
        repaymentMonthsInYear = debtEndMonth;
      } else {
        // 중간 년도: 전체 12개월
        yearStartMonth = 1;
        yearEndMonth = 12;
        repaymentMonthsInYear = 12;
      }

      // 현재 년도 시작 시점까지 경과한 개월 수 계산
      const monthsElapsedBeforeYear =
        year === debtStartYear
          ? 0
          : calculateMonthsElapsed(
              debtStartYear,
              debtStartMonth,
              year - 1,
              12
            ) + 1;

      // 첫 해에도 상환 시작
      debt.isActive = true;

      if (debt.debtType === "bullet") {
        // 만기일시상환: 매월 이자만 지불, 만기일에 원금 상환
        // 해당 년도에 포함된 개월 수만큼 비례 계산
        const yearlyInterest = debtAmount * interestRate * (repaymentMonthsInYear / 12);

        if (yearlyInterest > 0) {
          totalDebtInterest += yearlyInterest;
          debtInterestDetails.push({
            title: debt.title,
            amount: yearlyInterest,
          });
          addNegative(
            `${debt.title} | 이자`,
            yearlyInterest,
            "부채 이자",
            `debt-interest-${debt.id || debt.title}`
          );
        }

        if (year === debtEndYear) {
          // 만기년도: 원금 상환
          if (debtAmount > 0) {
            totalDebtPrincipal += debtAmount;
            debtPrincipalDetails.push({
              title: debt.title,
              amount: debtAmount,
            });
            addNegative(
              `${debt.title} | 원금 상환`,
              debtAmount,
              "부채 원금 상환",
              `debt-principal-${debt.id || debt.title}`
            );
          }
          debt.amount = 0;
          debt.isActive = false;
        } else {
          debt.amount = -debtAmount;
        }
      } else if (debt.debtType === "equal") {
        // 원리금균등상환: 매월 동일한 금액 상환 (월별 PMT 계산)
        // 월 PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
        const principal = debtAmount;

        if (totalMonths > 0 && monthlyRate > 0) {
          const denominator = Math.pow(1 + monthlyRate, totalMonths) - 1;
          const monthlyPmt =
            denominator !== 0
              ? (principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) / denominator
              : 0;

          // 현재 년도 시작 시점까지 상환된 원금 계산
          let remainingPrincipal = principal;
          for (let i = 0; i < monthsElapsedBeforeYear; i++) {
            const monthInterest = remainingPrincipal * monthlyRate;
            const monthPrincipal = monthlyPmt - monthInterest;
            remainingPrincipal = Math.max(remainingPrincipal - monthPrincipal, 0);
          }

          // 현재 년도의 이자와 원금 계산
          let yearlyInterest = 0;
          let yearlyPrincipal = 0;

          for (let i = 0; i < repaymentMonthsInYear; i++) {
            const monthInterest = remainingPrincipal * monthlyRate;
            const monthPrincipal = monthlyPmt - monthInterest;
            yearlyInterest += monthInterest;
            yearlyPrincipal += Math.min(monthPrincipal, remainingPrincipal);
            remainingPrincipal = Math.max(remainingPrincipal - monthPrincipal, 0);
          }

          if (yearlyInterest > 0) {
            totalDebtInterest += yearlyInterest;
            debtInterestDetails.push({
              title: debt.title,
              amount: yearlyInterest,
            });
            addNegative(
              `${debt.title} | 이자`,
              yearlyInterest,
              "부채 이자",
              `debt-interest-${debt.id || debt.title}`
            );
          }
          if (yearlyPrincipal > 0) {
            totalDebtPrincipal += yearlyPrincipal;
            debtPrincipalDetails.push({
              title: debt.title,
              amount: yearlyPrincipal,
            });
            addNegative(
              `${debt.title} | 원금 상환`,
              yearlyPrincipal,
              "부채 원금 상환",
              `debt-principal-${debt.id || debt.title}`
            );
          }

          debt.amount = -remainingPrincipal;
          if (remainingPrincipal <= 0) {
            debt.amount = 0;
            debt.isActive = false;
          }
        } else if (monthlyRate === 0 && totalMonths > 0) {
          // 이자율이 0%인 경우: 원금을 균등 분할
          const monthlyPayment = principal / totalMonths;

          // 현재 년도 시작 시점까지 상환된 원금
          const paidPrincipalBeforeYear = monthlyPayment * monthsElapsedBeforeYear;
          const remainingPrincipalAtYearStart = Math.max(principal - paidPrincipalBeforeYear, 0);

          // 현재 년도에 상환할 원금
          const yearlyPrincipal = Math.min(
            monthlyPayment * repaymentMonthsInYear,
            remainingPrincipalAtYearStart
          );

          if (yearlyPrincipal > 0) {
            totalDebtPrincipal += yearlyPrincipal;
            debtPrincipalDetails.push({
              title: debt.title,
              amount: yearlyPrincipal,
            });
            addNegative(
              `${debt.title} | 원금 상환`,
              yearlyPrincipal,
              "부채 원금 상환",
              `debt-principal-${debt.id || debt.title}`
            );
          }

          const remainingAfterPayment = Math.max(
            remainingPrincipalAtYearStart - yearlyPrincipal,
            0
          );
          debt.amount = -remainingAfterPayment;
          if (remainingAfterPayment <= 0) {
            debt.amount = 0;
            debt.isActive = false;
          }
        }
      } else if (debt.debtType === "principal") {
        // 원금균등상환: 매월 동일한 원금 상환, 이자는 남은 원금에 대해 계산
        const principal = debtAmount;
        const monthlyPrincipalPayment = totalMonths > 0 ? principal / totalMonths : 0;

        // 현재 년도 시작 시점까지 상환된 원금
        const paidPrincipalBeforeYear = monthlyPrincipalPayment * monthsElapsedBeforeYear;
        const remainingPrincipalAtYearStart = Math.max(principal - paidPrincipalBeforeYear, 0);

        // 현재 년도의 이자와 원금 계산
        let yearlyInterest = 0;
        let yearlyPrincipal = 0;
        let remainingPrincipal = remainingPrincipalAtYearStart;

        for (let i = 0; i < repaymentMonthsInYear; i++) {
          const monthInterest = remainingPrincipal * monthlyRate;
          const monthPrincipal = Math.min(monthlyPrincipalPayment, remainingPrincipal);
          yearlyInterest += monthInterest;
          yearlyPrincipal += monthPrincipal;
          remainingPrincipal = Math.max(remainingPrincipal - monthPrincipal, 0);
        }

        if (yearlyInterest > 0) {
          totalDebtInterest += yearlyInterest;
          debtInterestDetails.push({
            title: debt.title,
            amount: yearlyInterest,
          });
          addNegative(
            `${debt.title} | 이자`,
            yearlyInterest,
            "부채 이자",
            `debt-interest-${debt.id || debt.title}`
          );
        }
        if (yearlyPrincipal > 0) {
          totalDebtPrincipal += yearlyPrincipal;
          debtPrincipalDetails.push({
            title: debt.title,
            amount: yearlyPrincipal,
          });
          addNegative(
            `${debt.title} | 원금 상환`,
            yearlyPrincipal,
            "부채 원금 상환",
            `debt-principal-${debt.id || debt.title}`
          );
        }

        debt.amount = -remainingPrincipal;
        if (remainingPrincipal <= 0) {
          debt.amount = 0;
          debt.isActive = false;
        }
      } else if (debt.debtType === "grace") {
        // 거치식상환: 거치기간 동안 이자만 지불, 이후 원금 균등상환 + 남은 원금의 이자
        const principal = debtAmount;
        const r = interestRate;
        const gracePeriod = parseInt(debt.gracePeriod, 10) || 0;

        // 거치 종료 시점을 월 단위로 계산
        // 예: 2025년 6월 시작, 5년 거치 = 2030년 6월까지 거치
        const graceEndMonth = debtStartMonth;
        let graceEndYear = debtStartYear + gracePeriod;

        // 상환 시작 시점 (거치 종료 다음 달)
        let repaymentStartYear = graceEndYear;
        let repaymentStartMonth = graceEndMonth + 1;
        if (repaymentStartMonth > 12) {
          repaymentStartMonth = 1;
          repaymentStartYear += 1;
        }

        // 상환 종료 시점
        const repaymentEndYear = debtEndYear;
        const repaymentEndMonth = debtEndMonth;

        // 상환 총 개월 수 계산
        const repaymentTotalMonths =
          calculateMonthsElapsed(
            repaymentStartYear,
            repaymentStartMonth,
            repaymentEndYear,
            repaymentEndMonth
          ) + 1;

        // 현재 년도가 거치 기간인지 확인 (년 단위 비교)
        const isInGracePeriod = year < graceEndYear || year === graceEndYear;

        // 현재 년도가 상환 기간인지 확인 (년 단위 비교)
        const isInRepaymentPeriod =
          year >= repaymentStartYear && year <= repaymentEndYear;

        // 거치 기간 이자 계산 (상환 기간이 시작되지 않은 경우만)
        if (isInGracePeriod && !isInRepaymentPeriod) {
          // 해당 년도에 포함된 거치 기간 개월 수만큼 비례 계산
          let graceMonthsInYear = 0;
          if (year === debtStartYear) {
            // 시작 년도: 시작 월부터 12월까지 (단, 거치 종료 월까지만)
            graceMonthsInYear = Math.min(13 - debtStartMonth, 12);
          } else if (year === graceEndYear) {
            // 거치 종료 년도: 1월부터 거치 종료 월까지
            graceMonthsInYear = graceEndMonth;
          } else {
            // 중간 년도: 전체 12개월
            graceMonthsInYear = 12;
          }

          // 거치 기간 이자 계산
          if (graceMonthsInYear > 0) {
            const yearlyInterest = principal * r * (graceMonthsInYear / 12);
            if (yearlyInterest > 0) {
              totalDebtInterest += yearlyInterest;
              debtInterestDetails.push({
                title: debt.title,
                amount: yearlyInterest,
              });
              addNegative(
                `${debt.title} | 이자`,
                yearlyInterest,
                "부채 이자",
                `debt-interest-${debt.id || debt.title}`
              );
            }
          }

          // 상환 기간이 시작되지 않았으면 원금 유지
          debt.amount = -principal;
        }

        // 상환 기간 원금 상환 계산
        if (isInRepaymentPeriod && repaymentTotalMonths > 0) {
          // 상환기간: 원금을 균등하게 상환 + 남은 원금의 이자
          const graceMonthlyPrincipalPayment = principal / repaymentTotalMonths;

          // 현재 년도에 포함된 상환 개월 수 계산
          let graceRepaymentMonthsInYear = 0;
          if (year === repaymentStartYear && year === repaymentEndYear) {
            // 시작 년도와 종료 년도가 같은 경우
            graceRepaymentMonthsInYear =
              repaymentEndMonth - repaymentStartMonth + 1;
          } else if (year === repaymentStartYear) {
            // 상환 시작 년도: 시작 월부터 12월까지
            graceRepaymentMonthsInYear = 13 - repaymentStartMonth;
          } else if (year === repaymentEndYear) {
            // 상환 종료 년도: 1월부터 종료 월까지
            graceRepaymentMonthsInYear = repaymentEndMonth;
          } else {
            // 중간 년도: 전체 12개월
            graceRepaymentMonthsInYear = 12;
          }

          // 현재 년도 시작 시점까지 상환한 원금 계산
          const graceMonthsElapsedBeforeYear = calculateMonthsElapsed(
            repaymentStartYear,
            repaymentStartMonth,
            year,
            1
          );
          const gracePaidPrincipalBeforeYear =
            graceMonthlyPrincipalPayment * Math.max(graceMonthsElapsedBeforeYear, 0);
          const graceRemainingPrincipalAtYearStart = Math.max(
            principal - gracePaidPrincipalBeforeYear,
            0
          );

          // 현재 년도에 상환할 원금
          const graceYearlyPrincipalPayment =
            graceMonthlyPrincipalPayment * graceRepaymentMonthsInYear;

          // 현재 년도의 남은 원금 (년도 중간 시점 평균)
          const graceRemainingPrincipal =
            graceRemainingPrincipalAtYearStart - graceYearlyPrincipalPayment / 2;

          // 현재 년도의 이자와 원금
          const graceInterestPayment = graceRemainingPrincipal * r;
          const gracePrincipalPayment = graceYearlyPrincipalPayment;

          if (graceInterestPayment > 0) {
            totalDebtInterest += graceInterestPayment;
            debtInterestDetails.push({
              title: debt.title,
              amount: graceInterestPayment,
            });
            addNegative(
              `${debt.title} | 이자`,
              graceInterestPayment,
              "부채 이자",
              `debt-interest-${debt.id || debt.title}`
            );
          }
          if (gracePrincipalPayment > 0) {
            totalDebtPrincipal += gracePrincipalPayment;
            debtPrincipalDetails.push({
              title: debt.title,
              amount: gracePrincipalPayment,
            });
            addNegative(
              `${debt.title} | 원금 상환`,
              gracePrincipalPayment,
              "부채 원금 상환",
              `debt-principal-${debt.id || debt.title}`
            );
          }

          const graceRemainingAfterPayment = Math.max(
            graceRemainingPrincipalAtYearStart - gracePrincipalPayment,
            0
          );
          debt.amount = -graceRemainingAfterPayment;
          if (graceRemainingAfterPayment <= 0) {
            debt.amount = 0;
            debt.isActive = false;
          }
        }
      }

      if (year > debtEndYear) {
        debt.amount = 0;
        debt.isActive = false;
      }
    });

    // 양도소득세 관련 변수 (저축 + 부동산)
    let totalCapitalGainsTax = 0; // 양도소득세 총액
    const capitalGainsTaxes = []; // 양도소득세 상세 정보

    // --- 저축/투자: 월 단위 계산 후 연 단위로 집계 ---
    let totalSavingMaturity = 0; // 저축 만료 수입
    let totalSavingIncome = 0; // 저축 수익 (배당/이자)
    let savingMaturities = []; // 저축 만료 상세
    const savingPurchases = []; // 초기 보유금액 현금 차감 상세
    const savingIncomes = []; // 저축 수익 상세
    const savingContributions = []; // 저축 적립 상세

    const contributionTotals = {};
    const incomeTotals = {};
    const maturityTotals = {};

    // 월 단위 적립/복리 계산을 위한 상태 (시뮬레이션 시작 시점에 초기화됨)
    for (let month = 1; month <= 12; month++) {
      savings.forEach((saving, index) => {
        const stateKey = saving.id || `saving-${index}`;
        if (!savingStates[stateKey]) return;
        const state = savingStates[stateKey];

        const sStartYear = state.startYear;
        const sEndYear = state.endYear;
        if (
          !Number.isFinite(sStartYear) ||
          !Number.isFinite(sEndYear) ||
          sStartYear === undefined ||
          sEndYear === undefined
        ) {
          return;
        }

        // 현재 연/월 기준 상태 계산
        const isBeforeStart =
          year < sStartYear ||
          (year === sStartYear && month < state.startMonth);
        const isAfterEnd =
          year > sEndYear || (year === sEndYear && month > state.endMonth);

        if (state.matured || isAfterEnd) {
          return;
        }

        // 이미 시작된 경우 월간 이자 먼저 적용 (시작 월에는 이자 없음)
        if (state.started && state.balance !== 0) {
          const monthlyRate = state.monthlyInterestRate || 0;
          state.balance =
            Math.round(
              state.balance * (1 + monthlyRate) * 1000000
            ) / 1000000;
        }

        // 시작 시점 도달
        if (!state.started && !isBeforeStart) {
          state.started = true;
        }

        // 시작 월에 초기 보유금액을 현금 유출로 잡고 잔액에 반영
        if (
          state.started &&
          !state.initialPurchaseApplied &&
          saving.treatAsInitialPurchase &&
          year === sStartYear &&
          month === state.startMonth
        ) {
          const currentAmount = Number(saving.currentAmount) || 0;
          if (currentAmount > 0) {
            totalSavings += currentAmount;
            savingPurchases.push({
              title: saving.title,
              amount: currentAmount,
            });
            addNegative(
              `${saving.title} | 추가`,
              currentAmount,
              "저축 구매",
              `saving-purchase-${saving.id || saving.title}`
            );
            state.balance += currentAmount;
            // ⚠️ 기보유 금액은 원금에 포함하지 않음 (이미 과거에 투자한 금액이므로)
          }
          state.initialPurchaseApplied = true;
        }

        // 적립/수익 계산: 활동 구간(시작~종료월)만 처리
        const inActiveRange = !isBeforeStart && !isAfterEnd && state.started;
        if (inActiveRange) {
          // 적립
          const monthlyAmountBase =
            state.frequency === "monthly" ? state.amount : state.amount / 12; // 연간 빈도도 월로 균등 분할
          const adjustedContribution =
            monthlyAmountBase *
            Math.pow(1 + state.monthlyGrowthRate, state.monthsElapsed);

          if (adjustedContribution > 0) {
            totalSavings += adjustedContribution;
            state.balance += adjustedContribution;
            state.totalPrincipal += adjustedContribution; // 원금 추적
            state.monthsElapsed += 1;

            if (!contributionTotals[stateKey]) {
              contributionTotals[stateKey] = {
                title: saving.title,
                amount: 0,
              };
            }
            contributionTotals[stateKey].amount += adjustedContribution;
          }
        }

        // 수익형 저축 배당/이자 (현금 유입, 재투자 X)
        // 시작 월 포함, 종료 월까지 매월 발생해야 하므로 inActiveRange와 독립적으로 평가
        const isIncomeActive =
          state.savingType === "income" &&
          state.monthlyIncomeRate > 0 &&
          !isBeforeStart &&
          !isAfterEnd &&
          state.started &&
          state.balance > 0;
        if (isIncomeActive) {
          const monthlyIncome = state.balance * state.monthlyIncomeRate;
          if (monthlyIncome > 0) {
            if (!incomeTotals[stateKey]) {
              incomeTotals[stateKey] = { title: saving.title, amount: 0 };
            }
            incomeTotals[stateKey].amount += monthlyIncome;
          }
        }

        // 만기 처리: 종료 월에 잔액 전액 수령
        if (year === sEndYear && month === state.endMonth && state.started) {
          const maturityAmount = state.balance;
          if (maturityAmount > 0) {
            totalSavingMaturity += maturityAmount;
            maturityTotals[stateKey] = {
              title: saving.title,
              amount: maturityAmount,
            };
          }

          // 양도세 (만기 시점) - 수익(이익)에만 과세
          const taxRate = state.capitalGainsTaxRate || 0;
          if (taxRate > 0 && maturityAmount > 0) {
            // 수익 = 만기금액 - 총 원금 (적립 + 잉여현금 투자, 기보유 금액 제외)
            const capitalGain = Math.max(0, maturityAmount - (state.totalPrincipal || 0));
            const capitalGainsTax = capitalGain * taxRate;
            const taxRatePercent = taxRate * 100;
            const taxRateFormatted =
              taxRatePercent % 1 !== 0
                ? taxRatePercent.toFixed(1)
                : Math.floor(taxRatePercent);

            if (capitalGainsTax > 0) {
              totalCapitalGainsTax += capitalGainsTax;
              capitalGainsTaxes.push({
                title: `${saving.title} | 양도세 ${taxRateFormatted}%`,
                amount: capitalGainsTax,
              });
              addNegative(
                `${saving.title} | 양도세 ${taxRateFormatted}%`,
                capitalGainsTax,
                "양도세",
                `saving-tax-${saving.id || saving.title}`
              );
            }
          }

          state.balance = 0;
          state.matured = true;
        }
      });
    }

    // 월별 누적을 연간 세부 항목으로 기록
    Object.keys(contributionTotals).forEach((key) => {
      const entry = contributionTotals[key];
      if (!entry || !entry.amount) return;
      savingContributions.push(entry);
      addNegative(
        `${entry.title} | 적립`,
        entry.amount,
        "저축 적립",
        `saving-contrib-${key}`
      );
    });

    Object.keys(incomeTotals).forEach((key) => {
      const entry = incomeTotals[key];
      if (!entry || !entry.amount) return;
      totalSavingIncome += entry.amount;
      savingIncomes.push(entry);
      addPositive(
        `${entry.title} | 배당/이자`,
        entry.amount,
        "저축 수익",
        `saving-income-${key}`
      );
    });

    Object.keys(maturityTotals).forEach((key) => {
      const entry = maturityTotals[key];
      if (!entry || !entry.amount) return;
      savingMaturities.push(entry);
      addPositive(
        `${entry.title} | 수령`,
        entry.amount,
        "저축 수령",
        `saving-maturity-${key}`
      );
    });

    // 연금 계산
    pensions.forEach((pension) => {
      const toNumber = (value, fallback = undefined) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
      };

      if (pension.type === "national") {
        // 국민연금: 수령 기간 동안 현금흐름에 추가 (월 단위)
        const startYear = toNumber(pension.startYear);
        const startMonth = toNumber(pension.startMonth, 1) || 1;
        const endYear = toNumber(pension.endYear, startYear);
        const endMonth = toNumber(pension.endMonth, 12) || 12;

        // 해당 년도에 포함된 개월 수 계산
        let monthsInYear = 0;
        let firstMonthInYear = 1;
        let lastMonthInYear = 12;

        if (year >= startYear && year <= endYear) {
          if (year === startYear && year === endYear) {
            firstMonthInYear = startMonth;
            lastMonthInYear = endMonth;
            monthsInYear = endMonth - startMonth + 1;
          } else if (year === startYear) {
            firstMonthInYear = startMonth;
            lastMonthInYear = 12;
            monthsInYear = 12 - startMonth + 1;
          } else if (year === endYear) {
            firstMonthInYear = 1;
            lastMonthInYear = endMonth;
            monthsInYear = endMonth;
          } else {
            firstMonthInYear = 1;
            lastMonthInYear = 12;
            monthsInYear = 12;
          }
        }

        if (monthsInYear > 0) {
          const inflationRate = (pension.inflationRate || 2.5) / 100;
          const monthlyInflationRate =
            convertAnnualToMonthlyGrowthRate(inflationRate);

          // 해당 년도에 포함된 각 월마다 월간 수령액 계산
          const baseMonthsElapsed =
            (year - startYear) * 12 + (firstMonthInYear - startMonth);

          let yearTotalPension = 0;

          for (let m = firstMonthInYear; m <= lastMonthInYear; m++) {
            const monthsElapsed = baseMonthsElapsed + (m - firstMonthInYear);
            const adjustedMonthlyAmount =
              pension.monthlyAmount *
              Math.pow(1 + monthlyInflationRate, monthsElapsed);
            yearTotalPension += adjustedMonthlyAmount;
          }

          totalPension += yearTotalPension;
          addPositive(
            `${pension.title} | 수령`,
            yearTotalPension,
            "국민연금",
            `pension-national-${pension.id || pension.title}`
          );
        }
      } else {
        // 퇴직연금/개인연금: PMT 방식으로 수령
        const paymentStartYear = toNumber(pension.paymentStartYear);
        const paymentStartMonth = toNumber(pension.paymentStartMonth, 1) || 1;
        const paymentYears = toNumber(pension.paymentYears, 10) || 10; // 수령 기간(년)
        // 총 수령 개월과 종료 시점(년/월) 계산 (시작 월이 1월이 아닐 때도 정확히 60개월 등 계산)
        const totalPaymentMonths = paymentYears * 12;
        const endMonthIndex = paymentStartMonth - 1 + totalPaymentMonths - 1; // 0 기반 index
        const paymentEndYear = paymentStartYear + Math.floor(endMonthIndex / 12);
        const paymentEndMonth = (endMonthIndex % 12) + 1;

        // 적립/수령 기간 처리 (월 단위)
        const contributionStartYear = toNumber(pension.contributionStartYear);
        const contributionStartMonth =
          toNumber(pension.contributionStartMonth, 1) || 1;
        const contributionEndYear = toNumber(pension.contributionEndYear);
        const contributionEndMonth =
          toNumber(pension.contributionEndMonth, 12) || 12;

        // 필수 값이 없으면 계산 불가
        if (
          !Number.isFinite(paymentStartYear) ||
          !Number.isFinite(contributionStartYear) ||
          !Number.isFinite(contributionEndYear)
        ) {
          return;
        }

        // 해당 년도에 포함된 적립 개월 수 계산
        let contributionMonthsInYear = 0;
        let contributionFirstMonth = 1;
        let contributionLastMonth = 12;

        if (
          Number.isFinite(contributionStartYear) &&
          Number.isFinite(contributionEndYear) &&
          Number.isFinite(paymentStartYear) &&
          !pension.noAdditionalContribution &&
          year >= contributionStartYear &&
          year <= contributionEndYear &&
          (year < paymentStartYear ||
            (year === paymentStartYear &&
              contributionEndMonth < paymentStartMonth))
        ) {
          // 적립 기간 처리
          if (year === contributionStartYear && year === contributionEndYear) {
            contributionFirstMonth = contributionStartMonth;
            contributionLastMonth = contributionEndMonth;
            contributionMonthsInYear =
              contributionEndMonth - contributionStartMonth + 1;
          } else if (year === contributionStartYear) {
            contributionFirstMonth = contributionStartMonth;
            contributionLastMonth = 12;
            contributionMonthsInYear = 12 - contributionStartMonth + 1;
          } else if (year === contributionEndYear) {
            contributionFirstMonth = 1;
            contributionLastMonth = contributionEndMonth;
            contributionMonthsInYear = contributionEndMonth;
          } else {
            contributionFirstMonth = 1;
            contributionLastMonth = 12;
            contributionMonthsInYear = 12;
          }

          if (contributionMonthsInYear > 0) {
            // 퇴직금/DB만 추가 적립 시 현금이 빠져나감
            if (
              pension.type === "severance" &&
              pension.contributionAmount &&
              pension.contributionAmount > 0
            ) {
              let yearTotalContribution = 0;
              const monthlyAmount =
                pension.contributionFrequency === "monthly"
                  ? pension.contributionAmount
                  : pension.contributionAmount / 12;

              const baseMonthsElapsed =
                (year - contributionStartYear) * 12 +
                (contributionFirstMonth - contributionStartMonth);

              for (
                let m = contributionFirstMonth;
                m <= contributionLastMonth;
                m++
              ) {
                const monthsElapsed =
                  baseMonthsElapsed + (m - contributionFirstMonth);
                yearTotalContribution += monthlyAmount;
              }
              totalExpense += yearTotalContribution;
              addNegative(
                `${pension.title} | 추가 적립`,
                yearTotalContribution,
                "퇴직금 IRP 적립",
                `pension-contrib-${pension.id || pension.title}`
              );
            }
            // 개인연금은 적립 시 현금이 빠져나감
            else if (pension.type === "personal") {
              let yearTotalContribution = 0;
              const monthlyAmount =
                pension.contributionFrequency === "monthly"
                  ? pension.contributionAmount
                  : pension.contributionAmount / 12;

              const baseMonthsElapsed =
                (year - contributionStartYear) * 12 +
                (contributionFirstMonth - contributionStartMonth);

              for (
                let m = contributionFirstMonth;
                m <= contributionLastMonth;
                m++
              ) {
                yearTotalContribution += monthlyAmount;
              }

              totalExpense += yearTotalContribution;
              addNegative(
                `${pension.title} | 적립`,
                yearTotalContribution,
                "연금 적립",
                `pension-contrib-${pension.id || pension.title}`
              );
            }
            // 퇴직연금은 적립 시 현금이 빠져나가지 않음 (회사에서 적립)
          }
        }

        if (
          Number.isFinite(paymentStartYear) &&
          year === paymentStartYear
        ) {
          // PMT 방식: 수령 시작년도에 PMT 금액 계산 (한 번만, 월 단위)
          const returnRate = pension.returnRate / 100;
          const monthlyReturnRate = convertAnnualToMonthlyRate(returnRate);

          // 적립 완료 시점의 총 금액 계산 (월 단위)
          let totalAccumulated = pension.currentAmount || 0;

          // 적립 종료 시점을 수령 시작 직전으로 캡(겹치는 경우)
          let effectiveEndYear = contributionEndYear;
          let effectiveEndMonth = contributionEndMonth;
          if (
            contributionEndYear > paymentStartYear ||
            (contributionEndYear === paymentStartYear &&
              contributionEndMonth >= paymentStartMonth)
          ) {
            effectiveEndYear = paymentStartYear;
            effectiveEndMonth = paymentStartMonth - 1;
            if (effectiveEndMonth < 1) {
              effectiveEndYear -= 1;
              effectiveEndMonth += 12;
            }
          }

          // 적립 기간 계산 (월 단위)
          let totalContributionMonths = 0;
          if (
            Number.isFinite(contributionStartYear) &&
            Number.isFinite(contributionStartMonth) &&
            Number.isFinite(effectiveEndYear) &&
            Number.isFinite(effectiveEndMonth)
          ) {
            totalContributionMonths =
              (effectiveEndYear - contributionStartYear) * 12 +
              (effectiveEndMonth - contributionStartMonth);
          }

          // 추가 적립 금액 계산 (있는 경우만)
          let monthlyContribution = 0;
          if (
            !pension.noAdditionalContribution &&
            pension.contributionAmount &&
            pension.contributionAmount > 0
          ) {
            monthlyContribution =
              pension.contributionFrequency === "monthly"
                ? pension.contributionAmount
                : pension.contributionAmount / 12;
          }

          // 적립 기간 동안 월 단위로 적립 및 수익률 적용
          for (let m = 0; m <= totalContributionMonths; m++) {
            const currentYear =
              contributionStartYear +
              Math.floor((contributionStartMonth - 1 + m) / 12);
            const currentMonth = ((contributionStartMonth - 1 + m) % 12) + 1;

            // 해당 월이 적립 기간 내인지 확인
            const isInRange = isDateInRange(
              createDateFromYearMonth(currentYear, currentMonth),
              contributionStartYear,
              contributionStartMonth,
              contributionEndYear,
              contributionEndMonth
            );

            if (isInRange && monthlyContribution > 0) {
              if (m === 0) {
                // 시작 월: 적립만 (수익률 X)
                totalAccumulated += monthlyContribution;
              } else {
                // 다음 달부터: 전월 말 잔액에 수익률 적용 + 올해 적립금
                totalAccumulated =
                  totalAccumulated * (1 + monthlyReturnRate) +
                  monthlyContribution;
              }
            } else if (m > 0) {
              // 적립 기간이 아니지만 수익률은 계속 적용
              totalAccumulated = totalAccumulated * (1 + monthlyReturnRate);
            }
          }

          // 적립 종료 후 ~ 수령 시작 전 공백 기간의 수익률 적용 (월 단위)
          const gapMonths = Math.max(
            0,
            (paymentStartYear - effectiveEndYear) * 12 +
              (paymentStartMonth - effectiveEndMonth) -
              1
          );
          for (let i = 0; i < gapMonths; i++) {
            totalAccumulated = totalAccumulated * (1 + monthlyReturnRate);
          }

          // 잉여 현금 투자 금액 추가 (월 단위로 수익률 적용)
          let totalInvestedValue = 0;
          if (savingInvestments[pension.id]) {
            Object.keys(savingInvestments[pension.id]).forEach((investKey) => {
              let investYear, investMonth;
              if (investKey.includes("-")) {
                [investYear, investMonth] = investKey.split("-").map(Number);
              } else {
                investYear = parseInt(investKey);
                investMonth = 12;
              }

              const investMonthsElapsed =
                (paymentStartYear - investYear) * 12 +
                (paymentStartMonth - investMonth);
              const investAmount = savingInvestments[pension.id][investKey];

              if (investMonthsElapsed > 0) {
                const investmentValue =
                  investAmount *
                  Math.pow(1 + monthlyReturnRate, investMonthsElapsed);
                totalInvestedValue += investmentValue;
              } else {
                totalInvestedValue += investAmount;
              }
            });
          }
          totalAccumulated += totalInvestedValue;

          // 즉시 수령 판단 (수익률 적용 안 함):
          // 적립 종료월 = 수령 시작월이고, 추가 적립이 있는 경우만
          const hasAdditionalContribution =
            !pension.noAdditionalContribution && monthlyContribution > 0;
          const isImmediateWithdrawal =
            pension.type !== "severance" &&
            contributionEndYear === paymentStartYear &&
            contributionEndMonth === paymentStartMonth &&
            hasAdditionalContribution;

          // PMT 계산: 월 단위 PMT (월 단위로 수령)
          const paymentMonths = totalPaymentMonths;

          if (isImmediateWithdrawal) {
            // 즉시 수령: 수익률 적용 없이 그대로 수령
            pension._cashflowMonthlyPMT = calculateMonthlyPMT(
              totalAccumulated,
              0, // 수익률 0
              paymentMonths
            );
            pension._cashflowIsImmediateWithdrawal = true;
          } else {
            // 일반 수령: 수익률 적용
            pension._cashflowMonthlyPMT = calculateMonthlyPMT(
              totalAccumulated,
              monthlyReturnRate,
              paymentMonths
            );
            pension._cashflowIsImmediateWithdrawal = false;
          }

          // 해당 년도에 포함된 개월 수만큼 수령
          const monthsInYear =
            year === paymentStartYear ? 13 - paymentStartMonth : 12;
          const yearTotalPension = pension._cashflowMonthlyPMT * monthsInYear;
          totalPension += yearTotalPension;

          const pensionTypeLabel =
            pension.type === "retirement"
              ? "퇴직연금"
              : pension.type === "severance"
              ? "퇴직금 IRP"
              : "개인연금";

          addPositive(
            `${pension.title} | 수령`,
            yearTotalPension,
            pensionTypeLabel,
            `pension-payment-${pension.id || pension.title}`
          );
        } else if (
          Number.isFinite(paymentStartYear) &&
          year > paymentStartYear &&
          year <= paymentEndYear
        ) {
          // PMT 방식: 수령 기간 중 (이미 계산된 월 단위 PMT 사용)
          const monthlyPMT = pension._cashflowMonthlyPMT || 0;

          // 해당 년도에 포함된 개월 수 계산
          let monthsInYear = 12;
          if (year === paymentEndYear) {
            monthsInYear = paymentEndMonth;
          }

          const yearTotalPension = monthlyPMT * monthsInYear;
          totalPension += yearTotalPension;

          const pensionTypeLabel =
            pension.type === "retirement"
              ? "퇴직연금"
              : pension.type === "severance"
              ? "퇴직금 IRP"
              : "개인연금";

          addPositive(
            `${pension.title} | 수령`,
            yearTotalPension,
            pensionTypeLabel,
            `pension-payment-${pension.id || pension.title}`
          );
        }
        // PMT 방식에서는 year <= paymentEndYear 조건에서 모든 수령 처리 완료
      }
    });

    // 부동산 관련 계산 (월 단위 → 연 집계)
    let totalRentalIncome = 0; // 임대 소득
    let totalRealEstatePension = 0; // 주택연금 수령액
    let totalRealEstateSale = 0; // 부동산 매각 수입
    let totalRealEstatePurchase = 0; // 부동산 구매 비용
    let totalRealEstateTax = 0; // 부동산 취득세
    // totalCapitalGainsTax와 capitalGainsTaxes는 이미 위에서 선언됨 (저축 + 부동산 공통 사용)
    const realEstatePurchases = []; // 부동산 구매 상세 정보
    const realEstateSales = []; // 부동산 매각 상세 정보
    const realEstateTaxes = []; // 부동산 취득세 상세 정보
    const rentalIncomeTotals = {}; // {key: yearlyAmount}
    const pensionIncomeTotals = {}; // {key: yearlyAmount}
    // 자산 수익/매각 계산 (월 단위 → 연 집계)
    let totalAssetIncome = 0;
    let totalAssetSale = 0; // 자산 매각 수입
    let totalAssetPurchase = 0; // 자산 구매 비용
    const assetPurchases = []; // 자산 구매 상세 정보
    const assetSales = []; // 자산 매각 상세 정보
    const assetIncomeTotals = {}; // {key: yearlyAmount}

    // 월 루프
    for (let month = 1; month <= 12; month++) {
      Object.values(realEstateStates).forEach((state) => {
        if (!state || state.sold) return;

        const {
          startYear,
          startMonth,
          endYear,
          endMonth,
          monthlyGrowthRate,
          monthlyRentalIncome,
          hasRentalIncome,
          rentalStartYear,
          rentalStartMonth,
          rentalEndYear,
          rentalEndMonth,
          convertToPension,
          pensionStartYear,
          pensionStartMonth,
          pensionEndYear,
          pensionEndMonth,
          monthlyPensionAmount,
          isPurchase,
          currentValue,
        } = state;

        const inHoldingPeriod =
          Number.isFinite(startYear) &&
          Number.isFinite(endYear) &&
          (year > startYear || (year === startYear && month >= startMonth)) &&
          (year < endYear || (year === endYear && month <= endMonth));

        // 구매 이벤트 (시작월에 현금 유출)
        if (
          isPurchase &&
          !state.purchasedApplied &&
          Number.isFinite(startYear) &&
          year === startYear &&
          month === startMonth &&
          currentValue > 0
        ) {
          totalRealEstatePurchase += currentValue;
          realEstatePurchases.push({
            title: state.title,
            amount: currentValue,
          });
          addNegative(
            `${state.title} | 추가`,
            currentValue,
            "부동산 구매",
            `realestate-purchase-${state.key}`
          );

          const acquisitionTax = calculateAcquisitionTax(currentValue);
          totalRealEstateTax += acquisitionTax;
          realEstateTaxes.push({
            title: state.title,
            amount: acquisitionTax,
            taxRate:
              currentValue <= 60000
                ? "1.1%"
                : currentValue <= 90000
                ? "2.2%"
                : "3.3%",
          });
          addNegative(
            `${state.title} | 취득세`,
            acquisitionTax,
            "부동산 취득세",
            `realestate-tax-${state.key}`
          );

          state.purchasedApplied = true;
          state.started = true;
          state.monthsHeld = 0;
        }

        // 활성화 체크
        if (inHoldingPeriod && !state.started) {
          state.started = true;
          state.monthsHeld = 0;
        }
        if (!inHoldingPeriod) {
          return; // forEach에서는 continue 대신 return 사용
        }

        // 월 성장률 적용 (시작 월에는 적용하지 않고, 보유 1개월 경과부터 적용)
        if (state.started && state.monthsHeld > 0 && monthlyGrowthRate !== 0) {
          state.currentValue =
            Math.round(state.currentValue * (1 + monthlyGrowthRate) * 1000000) /
            1000000;
        }

        // 임대 소득
        const isActiveHolding = state.started && !state.sold;

        const rentActive =
          hasRentalIncome &&
          isActiveHolding &&
          Number.isFinite(rentalStartYear) &&
          (year > rentalStartYear ||
            (year === rentalStartYear && month >= (rentalStartMonth || 1))) &&
          (rentalEndYear === undefined ||
            year < rentalEndYear ||
            (year === rentalEndYear && month <= (rentalEndMonth || 12))) &&
          (year < endYear || (year === endYear && month <= endMonth));
        if (rentActive && monthlyRentalIncome > 0) {
          totalRentalIncome += monthlyRentalIncome;
          if (!rentalIncomeTotals[state.key]) rentalIncomeTotals[state.key] = 0;
          rentalIncomeTotals[state.key] += monthlyRentalIncome;
        }

        // 주택연금 수령 + 자산 차감
        const pensionActive =
          convertToPension &&
          isActiveHolding &&
          Number.isFinite(pensionStartYear) &&
          (year > pensionStartYear ||
            (year === pensionStartYear && month >= (pensionStartMonth || 1))) &&
          (pensionEndYear === undefined ||
            year < pensionEndYear ||
            (year === pensionEndYear && month <= (pensionEndMonth || 12))) &&
          (year < endYear || (year === endYear && month <= endMonth));
        if (pensionActive && monthlyPensionAmount > 0) {
          totalRealEstatePension += monthlyPensionAmount;
          if (!pensionIncomeTotals[state.key])
            pensionIncomeTotals[state.key] = 0;
          pensionIncomeTotals[state.key] += monthlyPensionAmount;
          state.currentValue = Math.max(
            0,
            state.currentValue - monthlyPensionAmount
          );
        }

        // 매각 처리 (매각월에 자산 유입 + 양도세)
        if (
          Number.isFinite(endYear) &&
          year === endYear &&
          month === endMonth &&
          !state.sold
        ) {
          const finalValue = Math.max(0, state.currentValue);
          totalRealEstateSale += finalValue;
          realEstateSales.push({
            title: state.title,
            amount: finalValue,
          });
          addPositive(
            `${state.title} | 수령`,
            finalValue,
            "부동산 수령",
            `realestate-sale-${state.key}`
          );

          if (state.isResidential) {
            const acquisitionPrice =
              state.acquisitionPrice !== undefined &&
              state.acquisitionPrice !== null
                ? state.acquisitionPrice
                : currentValue;
            const acquisitionYear =
              state.acquisitionYear !== undefined &&
              state.acquisitionYear !== null
                ? state.acquisitionYear
                : startYear;
            const holdingYears = Math.max(
              0,
              ((endYear - startYear) * 12 + (endMonth - startMonth)) / 12
            );
            const { totalTax } = calculateCapitalGainsTax(
              finalValue,
              acquisitionPrice,
              holdingYears
            );
            if (totalTax > 0) {
              totalCapitalGainsTax += totalTax;
              capitalGainsTaxes.push({
                title: state.title,
                amount: totalTax,
                salePrice: finalValue,
                acquisitionPrice: acquisitionPrice,
                holdingYears: holdingYears,
              });
              addNegative(
                `${state.title} | 양도세`,
                totalTax,
                "양도소득세",
                `realestate-capitalgains-${state.key}`
              );
            }
          }

          state.sold = true;
          state.started = false;
          state.currentValue = 0;
        }

        // 월 경과 증가
        if (state.started && !state.sold) {
          state.monthsHeld += 1;
        }
      });

      // 자산 월 단위 계산
      Object.values(assetStates).forEach((state) => {
        if (!state || state.sold) return;

        const {
          startYear,
          startMonth,
          endYear,
          endMonth,
          monthlyGrowthRate,
          monthlyIncomeRate,
          assetType,
          isPurchase,
          currentValue,
          initialValue,
          capitalGainsTaxRate,
        } = state;

        const inHoldingPeriod =
          Number.isFinite(startYear) &&
          Number.isFinite(endYear) &&
          (year > startYear || (year === startYear && month >= startMonth)) &&
          (year < endYear || (year === endYear && month <= endMonth));

        // 구매 이벤트 (시작월에 현금 유출)
        if (
          isPurchase &&
          !state.purchaseApplied &&
          Number.isFinite(startYear) &&
          year === startYear &&
          month === startMonth &&
          currentValue > 0
        ) {
          totalAssetPurchase += currentValue;
          assetPurchases.push({
            title: state.title,
            amount: currentValue,
          });
          addNegative(
            `${state.title} | 추가`,
            currentValue,
            "자산 구매",
            `asset-purchase-${state.key}`
          );
          state.purchaseApplied = true;
        }

        // 활성화 체크
        if (inHoldingPeriod && !state.started) {
          state.started = true;
          state.monthsHeld = 0;
        }
        if (!inHoldingPeriod) {
          return;
        }

        // 월 성장률 적용 (시작 월에는 적용하지 않음)
        if (state.started && state.monthsHeld > 0 && monthlyGrowthRate !== 0) {
          state.currentValue =
            Math.round(state.currentValue * (1 + monthlyGrowthRate) * 1000000) /
            1000000;
        }

        // 월 수익 (수익형 자산)
        const incomeActive =
          assetType === "income" &&
          state.started &&
          !state.sold &&
          monthlyIncomeRate > 0;
        if (incomeActive) {
          const monthlyIncome = state.currentValue * monthlyIncomeRate;
          totalAssetIncome += monthlyIncome;
          if (!assetIncomeTotals[state.key]) assetIncomeTotals[state.key] = 0;
          assetIncomeTotals[state.key] += monthlyIncome;
        }

        // 매각 처리 (매각월에 자산 유입 + 양도세)
        if (
          Number.isFinite(endYear) &&
          year === endYear &&
          month === endMonth &&
          !state.sold
        ) {
          const finalValue = Math.max(0, state.currentValue);
          totalAssetSale += finalValue;
          assetSales.push({
            title: state.title,
            amount: finalValue,
          });
          addPositive(
            `${state.title} | 수령`,
            finalValue,
            "자산 수령",
            `asset-sale-${state.key}`
          );

          const taxRate = capitalGainsTaxRate || 0;
          if (taxRate > 0) {
            const capitalGain = Math.max(0, finalValue - initialValue);
            const capitalGainsTax = capitalGain * taxRate;

            if (capitalGainsTax > 0) {
              const taxRatePercent = taxRate * 100;
              const taxRateFormatted =
                taxRatePercent % 1 !== 0
                  ? taxRatePercent.toFixed(1)
                  : Math.floor(taxRatePercent);

              totalCapitalGainsTax += capitalGainsTax;
              capitalGainsTaxes.push({
                title: `${state.title} | 양도세 ${taxRateFormatted}%`,
                amount: capitalGainsTax,
              });

              addNegative(
                `${state.title} | 양도세 ${taxRateFormatted}%`,
                capitalGainsTax,
                "양도세",
                `asset-tax-${state.key}`
              );
            }
          }

          state.sold = true;
          state.started = false;
          state.currentValue = 0;
        }

        if (state.started && !state.sold) {
          state.monthsHeld += 1;
        }
      });
    }

    // 월 누적된 임대/주택연금 합계를 연간 한 번만 breakdown에 추가
    Object.keys(rentalIncomeTotals).forEach((key) => {
      const amount = rentalIncomeTotals[key];
      if (amount > 0) {
        const title =
          realEstateStates[key]?.title || realEstateStates[key]?.key || key;
        addPositive(
          `${title} | 임대소득`,
          amount,
          "임대소득",
          `realestate-rent-${key}-${year}`
        );
      }
    });
    Object.keys(pensionIncomeTotals).forEach((key) => {
      const amount = pensionIncomeTotals[key];
      if (amount > 0) {
        const title =
          realEstateStates[key]?.title || realEstateStates[key]?.key || key;
        addPositive(
          `${title} | 주택연금`,
          amount,
          "주택연금",
          `realestate-pension-${key}-${year}`
        );
      }
    });

    // 월 누적된 자산 수익 합계를 연간 한 번만 breakdown에 추가
    Object.keys(assetIncomeTotals).forEach((key) => {
      const amount = assetIncomeTotals[key];
      if (amount > 0) {
        const title = assetStates[key]?.title || key;
        addPositive(
          `${title} | 수령`,
          amount,
          "자산 수령",
          `asset-income-${key}-${year}`
        );
      }
    });

    // 현금흐름 = 소득 - 지출 - 저축 + 연금 + 임대소득 + 주택연금 + 자산수익 + 부동산매각 + 자산매각 + 저축만료 + 저축수익 + 대출 현금 유입 - 부채이자 - 부채원금상환 - 자산구매 - 부동산구매 - 부동산취득세 - 양도소득세 (각 년도별 순현금흐름)
    let netCashflow =
      totalIncome -
      totalExpense -
      totalSavings +
      totalPension +
      totalRentalIncome +
      totalRealEstatePension +
      totalAssetIncome +
      totalRealEstateSale +
      totalAssetSale +
      totalDebtInjection +
      totalSavingMaturity +
      totalSavingIncome -
      totalDebtInterest -
      totalDebtPrincipal -
      totalAssetPurchase -
      totalRealEstatePurchase -
      totalRealEstateTax -
      totalCapitalGainsTax;

    // 잉여 현금 투자 규칙 처리 (현금흐름이 양수인 경우)
    // 잉여 현금 투자는 현금에서 자산으로 이동하므로 현금흐름에서 차감되어야 함

    let totalSurplusInvestment = 0;
    const surplusInvestments = []; // 투자 상세 정보

    if (netCashflow > 0 && profileData.cashflowInvestmentRules) {
      const investmentRule = profileData.cashflowInvestmentRules[year];

      if (investmentRule && investmentRule.allocations) {
        // 각 배분 항목에 대해 투자 금액 계산 및 누적
        investmentRule.allocations.forEach((allocation) => {
          if (allocation.ratio <= 0) return;
          // 현금은 투자가 아니므로 제외
          if (allocation.targetType === "cash") return;

          const investAmount =
            Math.round(netCashflow * (allocation.ratio / 100) * 100) / 100;

          if (investAmount > 0 && allocation.targetId) {
            if (allocation.targetType === "saving") {
              // 저축 상품에 대한 투자 금액 기록 (년-월 키 형식)
              // 년 단위 루프이므로 해당 년도의 마지막 월(12월)에 투자하는 것으로 처리
              const investKey = `${year}-12`;
              if (!savingInvestments[allocation.targetId]) {
                savingInvestments[allocation.targetId] = {};
              }
              if (!savingInvestments[allocation.targetId][investKey]) {
                savingInvestments[allocation.targetId][investKey] = 0;
              }
              savingInvestments[allocation.targetId][investKey] =
                Math.round(
                  (savingInvestments[allocation.targetId][investKey] +
                    investAmount) *
                    100
                ) / 100;

              // ⚠️ 중요: savingStates의 balance에도 투자 금액 추가
              // 이렇게 해야 다음 연도부터 복리가 적용되고, 만기 시 수령 금액에 포함됨
              const stateKey = allocation.targetId;
              if (savingStates[stateKey] && savingStates[stateKey].started && !savingStates[stateKey].matured) {
                savingStates[stateKey].balance =
                  Math.round((savingStates[stateKey].balance + investAmount) * 100) / 100;
                // 원금 추적: 잉여 현금 투자도 원금에 포함
                savingStates[stateKey].totalPrincipal =
                  Math.round((savingStates[stateKey].totalPrincipal + investAmount) * 100) / 100;

                // 투자 상세 정보 저장
                const saving = savings.find(s => s.id === allocation.targetId);
                surplusInvestments.push({
                  targetType: "saving",
                  targetId: allocation.targetId,
                  title: saving?.title || "저축/투자",
                  amount: investAmount,
                });
                totalSurplusInvestment += investAmount;
              }
            } else if (allocation.targetType === "pension") {
              // 연금 상품에 대한 투자 금액 기록 (년-월 키 형식)
              const investKey = `${year}-12`;
              if (!savingInvestments[allocation.targetId]) {
                savingInvestments[allocation.targetId] = {};
              }
              if (!savingInvestments[allocation.targetId][investKey]) {
                savingInvestments[allocation.targetId][investKey] = 0;
              }
              savingInvestments[allocation.targetId][investKey] =
                Math.round(
                  (savingInvestments[allocation.targetId][investKey] +
                    investAmount) *
                    100
                ) / 100;

              // 투자 상세 정보 저장
              const pension = pensions.find(p => p.id === allocation.targetId);
              surplusInvestments.push({
                targetType: "pension",
                targetId: allocation.targetId,
                title: pension?.title || "연금",
                amount: investAmount,
              });
              totalSurplusInvestment += investAmount;
            }
          }
        });

        // 잉여 현금 투자를 지출 항목에 추가 (현금흐름에서 차감)
        surplusInvestments.forEach((investment, idx) => {
          addNegative(
            `${investment.title} | 잉여 현금 적립`,
            investment.amount,
            "잉여투자",
            `surplus-investment-${idx}`
          );
        });
      }
    }

    // 잉여 현금 투자를 반영한 최종 현금흐름 계산
    netCashflow = netCashflow - totalSurplusInvestment;

    // ⚠️ 투자 금액은 savingContributions에 포함하지 않음 (별도 항목으로 표시)
    const allSavingContributions = [...savingContributions];

    // 자산 인출 처리 (저축/투자에서 현금으로 인출)
    let totalAssetWithdrawal = 0;
    const assetWithdrawals = []; // 인출 상세 정보

    if (profileData.assetWithdrawalRules) {
      const withdrawalRule = profileData.assetWithdrawalRules[year];

      if (withdrawalRule && withdrawalRule.withdrawals) {
        withdrawalRule.withdrawals.forEach((withdrawal) => {
          if (withdrawal.sourceType === "saving" && withdrawal.sourceId) {
            // 저축에서 인출 - savingStates에서 해당 저축 찾기
            const stateKey = withdrawal.sourceId;
            const savingState = savingStates[stateKey];

            if (savingState && savingState.balance > 0) {
              let withdrawalAmount;

              // 퍼센트 모드인 경우: 현재 잔액 기준으로 계산
              if (withdrawal.percentage !== undefined && withdrawal.percentage !== null && withdrawal.percentage > 0) {
                withdrawalAmount = Math.round(savingState.balance * (withdrawal.percentage / 100));
              } else if (withdrawal.amount > 0) {
                // 금액 모드인 경우: 고정 금액 사용
                withdrawalAmount = withdrawal.amount;
              } else {
                return; // 인출 금액이 없으면 스킵
              }

              // 실제 인출 가능 금액 (잔액 초과 방지)
              const actualWithdrawal = Math.min(withdrawalAmount, savingState.balance);

              if (actualWithdrawal <= 0) return;

              // 저축 잔액에서 차감
              savingState.balance =
                Math.round((savingState.balance - actualWithdrawal) * 100) / 100;

              // 인출 금액 누적
              totalAssetWithdrawal += actualWithdrawal;

              // 인출 상세 정보 저장
              assetWithdrawals.push({
                title: `${withdrawal.sourceTitle || "저축/투자"} | 인출`,
                amount: actualWithdrawal,
              });

              // 순현금흐름에 인출 금액 추가
              netCashflow =
                Math.round((netCashflow + actualWithdrawal) * 100) / 100;
            }
          }
        });
      }
    }

    // 인출 금액을 breakdown에 추가 (양수/수입으로)
    if (totalAssetWithdrawal > 0) {
      assetWithdrawals.forEach((withdrawal, idx) => {
        addPositive(
          withdrawal.title,
          withdrawal.amount,
          "자산인출",
          `asset-withdrawal-${idx}`
        );
      });
    }

    cashflowData.push({
      year,
      age,
      amount: netCashflow,
      income: totalIncome + totalSavingIncome + totalAssetWithdrawal, // 인출 금액을 수입에 포함
      expense: totalExpense,
      savings: totalSavings,
      pension: totalPension,
      rentalIncome: totalRentalIncome,
      realEstatePension: totalRealEstatePension,
      assetIncome: totalAssetIncome,
      realEstateSale: totalRealEstateSale,
      assetSale: totalAssetSale,
      debtInjection: totalDebtInjection,
      savingMaturity: totalSavingMaturity,
      savingMaturities: savingMaturities, // 저축 만료 상세 정보
      savingIncomes: savingIncomes, // 저축 수익 상세 정보 (배당/이자)
      savingContributions: allSavingContributions, // 저축 적립 상세 정보 (투자로 인한 적립 포함)
      debtInterest: totalDebtInterest,
      debtPrincipal: totalDebtPrincipal,
      debtInterests: debtInterestDetails,
      debtPrincipals: debtPrincipalDetails,
      realEstateTax: totalRealEstateTax, // 부동산 취득세
      realEstateTaxes: realEstateTaxes, // 부동산 취득세 상세 정보
      capitalGainsTax: totalCapitalGainsTax, // 부동산 양도소득세
      capitalGainsTaxes: capitalGainsTaxes, // 부동산 양도소득세 상세 정보
      // 구매와 매각 상세 정보 추가
      savingPurchases: savingPurchases, // 저축 구매 상세 정보
      assetPurchases: assetPurchases,
      realEstatePurchases: realEstatePurchases,
      debtInjections: debtInjections,
      assetSales: assetSales,
      realEstateSales: realEstateSales,
      assetWithdrawal: totalAssetWithdrawal, // 자산 인출 총액
      assetWithdrawals: assetWithdrawals, // 자산 인출 상세 정보
      surplusInvestment: totalSurplusInvestment, // 잉여 현금 투자 총액
      surplusInvestments: surplusInvestments, // 잉여 현금 투자 상세 정보
      breakdown: {
        positives: positiveBreakdown,
        negatives: negativeBreakdown,
      },
    });
  }

  return cashflowData;
}

/**
 * 자산 시뮬레이션 계산
 */
export function calculateAssetSimulation(
  profileData,
  incomes = [],
  expenses = [],
  savings = [],
  pensions = [],
  realEstates = [],
  assets = [],
  cashflowData = [],
  debts = []
) {
  // 현재는 더미 데이터 반환
  const currentYear = new Date().getFullYear();
  const startAge = calculateKoreanAge(profileData.birthYear, currentYear); // 만 나이로 실시간 계산
  const deathAge = 90;
  const simulationYears = deathAge - startAge + 1;

  const assetData = [];

  // 현재 현금 (프로필에서 가져옴)
  let currentCash = profileData.currentCash || 0;

  // 저축별 누적 자산 (ID별로 분리)
  const savingsById = {};

  // 저축 데이터가 없어도 자산과 부채만으로 시뮬레이션 생성 가능
  if (savings && Array.isArray(savings) && savings.length > 0) {
    savings.forEach((saving, index) => {
      if (!saving.id) {
        console.error("저축에 ID가 없습니다:", saving);
        return;
      }

      // 년도 데이터 타입 확인 및 변환
      const startYear =
        typeof saving.startYear === "string"
          ? parseInt(saving.startYear)
          : saving.startYear;
      const endYear =
        typeof saving.endYear === "string"
          ? parseInt(saving.endYear)
          : saving.endYear;

      savingsById[saving.id] = {
        amount: 0, // 시작년도 전에는 0, 시작년도에 currentAmount 추가
        currentAmount: saving.currentAmount || 0, // 현재 보유 금액 저장
        startYear: startYear,
        endYear: endYear,
        interestRate:
          saving.interestRate !== undefined && saving.interestRate !== null
            ? saving.interestRate
            : 0.03, // 이자율 (0 허용)
        yearlyGrowthRate:
          saving.yearlyGrowthRate !== undefined &&
          saving.yearlyGrowthRate !== null
            ? saving.yearlyGrowthRate
            : 0, // 년간 저축 상승률 (0 허용)
        frequency: saving.frequency,
        originalAmount: saving.amount,
        title: saving.title, // 제목도 저장
        savingType: saving.savingType || "standard", // "standard" 또는 "income"
        incomeRate:
          saving.incomeRate !== undefined && saving.incomeRate !== null
            ? saving.incomeRate
            : 0, // 수익형 저축의 수익률 (0 허용)
        isActive: false, // 시작년도 전에는 비활성
        totalInvested: 0, // 잉여 현금 투자 누적액 (자산 시뮬레이션에서 추가됨)
      };
    });
  }

  // 은퇴년도 가져오기
  const retirementYear = profileData.retirementYear || currentYear;

  // 연금별 누적 자산 (제목별로 분리)
  const pensionsByTitle = {};
  // 연금별 누적 자산 (ID별로 분리 - 투자 배분용)
  const pensionsById = {};

  pensions.forEach((pension) => {
    if (pension.type !== "national") {
      // 퇴직연금/개인연금만 자산으로 관리

      const isActive = pension.type !== "severance";

      const pensionData = {
        // 퇴직금/DB는 초기 amount를 0으로 설정 (은퇴년도에 currentAmount 설정)
        // 퇴직연금/개인연금은 처음부터 currentAmount 설정
        amount: pension.type === "severance" ? 0 : pension.currentAmount || 0,
        initialAmount: pension.currentAmount || 0, // 원래 보유액 저장
        contributionStartYear: pension.contributionStartYear,
        contributionStartMonth: pension.contributionStartMonth || 1, // 적립 시작월 추가
        contributionEndYear: pension.contributionEndYear,
        contributionEndMonth: pension.contributionEndMonth || 12, // 적립 종료월 추가
        paymentStartYear: pension.paymentStartYear,
        paymentStartMonth: pension.paymentStartMonth || 1, // 수령 시작월 추가
        paymentYears: pension.paymentYears || 10, // 수령 기간(년)
        paymentEndYear:
          pension.paymentStartYear + (pension.paymentYears || 10) - 1, // 종료년도 계산
        returnRate: pension.returnRate !== undefined ? pension.returnRate : 5.0,
        contributionAmount: pension.contributionAmount,
        contributionFrequency: pension.contributionFrequency,
        noAdditionalContribution: pension.noAdditionalContribution || false, // 추가 적립 안함 여부
        type: pension.type, // 연금 타입 저장
        monthlyPayment: 0, // 월 수령액 (적립 종료 후 계산)
        retirementYear: retirementYear, // 은퇴년도 저장
        // 퇴직금/DB는 은퇴년도 전까지 자산 차트에 표시 안함
        // 퇴직연금/개인연금은 처음부터 자산 차트에 표시
        isActive: isActive,
        title: pension.title, // 제목 저장
      };

      pensionsByTitle[pension.title] = pensionData;

      // ID로도 접근 가능하도록 (투자 배분 시 사용)
      if (pension.id) {
        pensionsById[pension.id] = pensionData;
      }
    }
  });

  // 부동산별 자산 (제목별로 분리, 월 단위 상태)
  const realEstatesByTitle = {};
  realEstates.forEach((realEstate) => {
    const startYear =
      typeof realEstate.startYear === "string"
        ? parseInt(realEstate.startYear)
        : realEstate.startYear || currentYear;
    const startMonth =
      typeof realEstate.startMonth === "string"
        ? parseInt(realEstate.startMonth, 10)
        : realEstate.startMonth || 1;
    const endYear =
      typeof realEstate.endYear === "string"
        ? parseInt(realEstate.endYear)
        : realEstate.endYear;
    const endMonth =
      typeof realEstate.endMonth === "string"
        ? parseInt(realEstate.endMonth, 10)
        : realEstate.endMonth || 12;

    const monthlyGrowthRate = convertAnnualToMonthlyGrowthRate(
      (realEstate.growthRate || 0) / 100
    );

    const pensionStartYear =
      typeof realEstate.pensionStartYear === "string"
        ? parseInt(realEstate.pensionStartYear, 10)
        : realEstate.pensionStartYear;
    const pensionStartMonth =
      typeof realEstate.pensionStartMonth === "string"
        ? parseInt(realEstate.pensionStartMonth, 10)
        : realEstate.pensionStartMonth || 1;
    const pensionEndYear =
      typeof realEstate.pensionEndYear === "string"
        ? parseInt(realEstate.pensionEndYear, 10)
        : realEstate.pensionEndYear;
    const pensionEndMonth =
      typeof realEstate.pensionEndMonth === "string"
        ? parseInt(realEstate.pensionEndMonth, 10)
        : realEstate.pensionEndMonth || 12;

    const initialRealEstateValue = realEstate.currentValue || 0;
    realEstatesByTitle[realEstate.title] = {
      amount: initialRealEstateValue,
      startYear,
      startMonth,
      endYear,
      endMonth,
      monthlyGrowthRate,
      convertToPension: realEstate.convertToPension || false,
      pensionStartYear,
      pensionStartMonth,
      pensionEndYear,
      pensionEndMonth,
      monthlyPensionAmount: realEstate.monthlyPensionAmount || 0,
      isPurchase: realEstate.isPurchase || false,
      isActive: false,
      monthsHeld: 0,
    };
  });

  // 자산별 자산 (제목별로 분리)
  const assetsByTitle = {};
  assets.forEach((asset) => {
    // 년도 데이터 타입 확인 및 변환
    const startYear =
      typeof asset.startYear === "string"
        ? parseInt(asset.startYear)
        : asset.startYear;
    const startMonth =
      typeof asset.startMonth === "string"
        ? parseInt(asset.startMonth)
        : asset.startMonth || 1;
    const endYear =
      typeof asset.endYear === "string"
        ? parseInt(asset.endYear)
        : asset.endYear;
    const endMonth =
      typeof asset.endMonth === "string"
        ? parseInt(asset.endMonth)
        : asset.endMonth || 12;

    const initialValue = asset.currentValue || 0;
    const growthRate = asset.growthRate || 0; // 이미 소수로 저장됨 (예: 0.0286)
    assetsByTitle[asset.title] = {
      amount: 0,
      startYear: startYear,
      startMonth: startMonth,
      endYear: endYear,
      endMonth: endMonth,
      growthRate: growthRate,
      monthlyGrowthRate: convertAnnualToMonthlyGrowthRate(growthRate),
      assetType: asset.assetType || "general", // "general" 또는 "income"
      incomeRate: asset.incomeRate || 0, // 수익형 자산의 수익률 (연)
      monthlyIncomeRate: convertAnnualToMonthlyRate(asset.incomeRate || 0),
      capitalGainsTaxRate: asset.capitalGainsTaxRate || 0, // 양도세율 저장
      isPurchase: asset.isPurchase || false, // 구매 여부 저장
      isActive: false,
      sold: false,
      monthsHeld: 0,
      _initialValue: initialValue, // 초기값 저장
      initialValue: initialValue,
    };
  });

  // 부채별 자산 (제목별로 분리) - 음수로 표시
  const debtsByTitle = {};
  debts.forEach((debt) => {
    // 년도 데이터 타입 확인 및 변환
    const startYear =
      typeof debt.startYear === "string"
        ? parseInt(debt.startYear)
        : debt.startYear;
    const endYear =
      typeof debt.endYear === "string" ? parseInt(debt.endYear) : debt.endYear;
    const startMonth = toNumberOr(debt.startMonth, 1) || 1;
    const endMonth = toNumberOr(debt.endMonth, 12) || 12;

    debtsByTitle[debt.title] = {
      amount: -debt.debtAmount, // 부채는 음수로 표시
      startYear: startYear,
      startMonth: startMonth,
      endYear: endYear,
      endMonth: endMonth,
      debtType: debt.debtType, // "bullet", "equal", "principal", "grace"
      interestRate: debt.interestRate,
      originalAmount: debt.debtAmount,
      gracePeriod: debt.gracePeriod, // 거치기간 추가 (거치식 상환에 필요)
      isActive: true,
    };
  });

  // 카테고리별 색상 매핑 함수
  const getCategoryColor = (key, value = 0) => {
    // 현금
    if (key === "현금") {
      return value < 0 ? "#ef4444" : "#10b981";
    }
    // 연금
    if (
      key.includes("연금") ||
      key.includes("퇴직") ||
      key.includes("국민연금")
    ) {
      const pensionColors = [
        "#fbbf24",
        "#f59e0b",
        "#eab308",
        "#d97706",
        "#ca8a04",
      ];
      const hash = key.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      return pensionColors[Math.abs(hash) % pensionColors.length];
    }
    // 부채
    if (
      key.includes("부채") ||
      key.includes("대출") ||
      key.includes("빚") ||
      value < 0
    ) {
      const debtColors = [
        "#111827",
        "#1f2937",
        "#374151",
        "#4b5563",
        "#6b7280",
      ];
      const hash = key.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      return debtColors[Math.abs(hash) % debtColors.length];
    }
    // 저축/투자
    if (
      key.includes("저축") ||
      key.includes("투자") ||
      key.includes("예금") ||
      key.includes("적금")
    ) {
      const savingColors = [
        "#3b82f6",
        "#2563eb",
        "#1d4ed8",
        "#06b6d4",
        "#0891b2",
      ];
      const hash = key.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      return savingColors[Math.abs(hash) % savingColors.length];
    }
    // 부동산
    if (
      key.includes("부동산") ||
      key.includes("아파트") ||
      key.includes("자택") ||
      key.includes("임대")
    ) {
      const realEstateColors = [
        "#8b5cf6",
        "#7c3aed",
        "#6d28d9",
        "#5b21b6",
        "#a78bfa",
      ];
      const hash = key.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      return realEstateColors[Math.abs(hash) % realEstateColors.length];
    }
    // 일반 자산
    const assetColors = ["#3b82f6", "#06b6d4", "#8b5cf6", "#6366f1", "#0ea5e9"];
    const hash = key.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return assetColors[Math.abs(hash) % assetColors.length];
  };

  for (let i = 0; i < simulationYears; i++) {
    const year = currentYear + i;
    const age = startAge + i;

    // 해당 연도의 현금 흐름 가져오기
    const yearCashflow = cashflowData.find((cf) => cf.year === year);
    const netCashflow = yearCashflow ? yearCashflow.amount : 0;

    // 현금 흐름을 현재 현금에 적용 (부동소수점 오류 방지)
    const previousCash = currentCash;
    currentCash = Math.round((currentCash + netCashflow) * 100) / 100;

    // 해당 연도의 저축 계산 (ID별로)
    // ⚠️ 중요: 저축 계산(수익률 적용)을 먼저 실행하고, 이후에 잉여 현금 투자를 처리해야
    //         연말에 투자한 금액이 해당 년도 수익률을 받지 않음 (연말 기준)
    Object.keys(savingsById).forEach((id) => {
      const saving = savingsById[id];

      // 시작년도 이전: 자산 차트에 표시 안함
      if (year < saving.startYear) {
        return;
      }

      // endYear 이상이면 저축을 비활성화 (자산 차트에서 제거)
      // 종료년도부터는 현금으로 전환되므로 자산에서 제거
      if (year >= saving.endYear) {
        // 현금흐름 시뮬레이션에서 이미 계산된 저축 만료 금액이 netCashflow에 포함되어 있으므로
        // 여기서 추가로 currentCash에 더하지 않음 (중복 방지)

        // 저축을 즉시 비활성화 (자산 차트에서 제거됨)
        saving.isActive = false;
        saving.amount = 0; // 전환 후 금액 초기화

        return; // 전환 후 더 이상 처리하지 않음
      }

      // 시작년도: 활성화 및 현재 보유액 설정
      if (year === saving.startYear && !saving.isActive) {
        saving.isActive = true;
        saving.amount = saving.currentAmount; // 현재 보유액으로 시작
      }

      // 비활성 상태면 건너뛰기
      if (!saving.isActive) {
        return;
      }

      // 해당 년도에 포함된 개월 수 계산
      const sStartMonth = saving.startMonth || 1;
      const sEndMonth = saving.endMonth || 12;

      let monthsInYear = 0;
      let firstMonthInYear = 1;
      let lastMonthInYear = 12;

      if (year >= saving.startYear && year <= saving.endYear) {
        if (year === saving.startYear && year === saving.endYear) {
          firstMonthInYear = sStartMonth;
          lastMonthInYear = sEndMonth;
          monthsInYear = sEndMonth - sStartMonth + 1;
        } else if (year === saving.startYear) {
          firstMonthInYear = sStartMonth;
          lastMonthInYear = 12;
          monthsInYear = 12 - sStartMonth + 1;
        } else if (year === saving.endYear) {
          firstMonthInYear = 1;
          lastMonthInYear = sEndMonth;
          monthsInYear = sEndMonth;
        } else {
          firstMonthInYear = 1;
          lastMonthInYear = 12;
          monthsInYear = 12;
        }
      }

      if (
        year >= saving.startYear &&
        year < saving.endYear &&
        monthsInYear > 0
      ) {
        // 저축 기간 중 (endYear 전까지만 - 종료년도에는 자산에서 제거)
        const interestRate = saving.interestRate; // 이미 소수로 저장됨
        const monthlyInterestRate = convertAnnualToMonthlyRate(interestRate);
        const yearlyGrowthRate = saving.yearlyGrowthRate; // 이미 소수로 저장됨
        const monthlyGrowthRate =
          convertAnnualToMonthlyGrowthRate(yearlyGrowthRate);

        if (saving.frequency === "one_time") {
          // 일회성 저축 (정기예금 등)
          if (year === saving.startYear && firstMonthInYear === sStartMonth) {
            // 시작 월: 이미 currentAmount가 설정되어 있으므로 추가로 더하지 않음
            // (수익률 적용 X, 시작 월에는 수익률 없음)
          } else if (
            year > saving.startYear ||
            (year === saving.startYear && firstMonthInYear > sStartMonth)
          ) {
            // 다음 달부터 수익률 적용 (월 단위 복리)
            // 각 월마다 복리 적용 (연 단위가 아닌 월 단위로)
            for (let m = firstMonthInYear; m <= lastMonthInYear; m++) {
              saving.amount = saving.amount * (1 + monthlyInterestRate);
            }
          }
        } else {
          // 월간/연간 저축: 해당 년도에 포함된 각 월마다 적립 및 수익률 적용
          let monthlyAmount;
          if (saving.frequency === "monthly") {
            monthlyAmount = saving.originalAmount;
          } else {
            monthlyAmount = saving.originalAmount / 12;
          }

          // 해당 년도의 첫 월부터 시작하는 기준으로 경과 개월 수 계산
          const baseMonthsElapsed =
            (year - saving.startYear) * 12 + (firstMonthInYear - sStartMonth);

          // 각 월마다 적립 및 수익률 적용
          for (let m = firstMonthInYear; m <= lastMonthInYear; m++) {
            // 현재 월까지의 경과 개월 수
            const monthsElapsed = baseMonthsElapsed + (m - firstMonthInYear);

            // 월 단위 상승률 적용
            const adjustedMonthlyAmount =
              monthlyAmount * Math.pow(1 + monthlyGrowthRate, monthsElapsed);

            if (monthsElapsed === 0) {
              // 시작 월: 적립만 (수익률 X)
              saving.amount = saving.amount + adjustedMonthlyAmount;
            } else {
              // 다음 달부터: 전월 말 잔액에 수익률 적용 + 올해 적립금
              saving.amount =
                saving.amount * (1 + monthlyInterestRate) +
                adjustedMonthlyAmount;
            }
          }
        }
      }
    });

    // 잉여 현금 투자 처리: cashflowData에서 투자 정보 가져오기
    // 현금흐름 시뮬레이션에서 이미 계산된 투자 금액을 사용
    const investmentInfo = {}; // 투자 정보 저장 (자산별)
    const yearCashflowData = cashflowData.find((cf) => cf.year === year);

    if (yearCashflowData && yearCashflowData.surplusInvestments) {
      yearCashflowData.surplusInvestments.forEach((investment) => {
        if (investment.targetType === "saving" && investment.targetId) {
          const targetSaving = savingsById[investment.targetId];
          if (targetSaving && targetSaving.isActive) {
            // 저축 자산에 투자 금액 추가
            targetSaving.amount =
              Math.round((targetSaving.amount + investment.amount) * 100) / 100;
            targetSaving.totalInvested =
              Math.round((targetSaving.totalInvested + investment.amount) * 100) / 100;
            investmentInfo[targetSaving.title] = investment.amount;
          }
        } else if (investment.targetType === "pension" && investment.targetId) {
          const targetPension = pensionsById[investment.targetId];
          if (targetPension && targetPension.isActive) {
            // 연금 자산에 투자 금액 추가
            targetPension.amount =
              Math.round((targetPension.amount + investment.amount) * 100) / 100;
            if (!targetPension.totalInvested) {
              targetPension.totalInvested = 0;
            }
            targetPension.totalInvested =
              Math.round((targetPension.totalInvested + investment.amount) * 100) / 100;
            investmentInfo[targetPension.title] = investment.amount;
          }
        }
      });
    }

    // 자산 인출 처리: 자산 시뮬레이션의 잔액 기준으로 직접 계산
    // 현금흐름과 자산 시뮬레이션이 각각 독립적으로 퍼센트 계산해야 정확함
    const withdrawalInfo = {};

    // 인출 전 잔액 저장 (모달에서 퍼센트 계산용)
    Object.keys(savingsById).forEach((id) => {
      const saving = savingsById[id];
      if (saving.isActive) {
        saving.preWithdrawalAmount = saving.amount;
      }
    });

    // 원본 인출 규칙에서 직접 계산 (자산 시뮬레이션의 잔액 기준)
    if (profileData.assetWithdrawalRules) {
      const withdrawalRule = profileData.assetWithdrawalRules[year];

      if (withdrawalRule && withdrawalRule.withdrawals) {
        withdrawalRule.withdrawals.forEach((withdrawal) => {
          if (withdrawal.sourceType === "saving" && withdrawal.sourceId) {
            const targetSaving = savingsById[withdrawal.sourceId];

            if (targetSaving && targetSaving.isActive && targetSaving.amount > 0) {
              let withdrawalAmount;

              // 퍼센트 모드인 경우: 현재 자산 시뮬레이션의 잔액 기준으로 계산
              if (withdrawal.percentage !== undefined && withdrawal.percentage !== null && withdrawal.percentage > 0) {
                withdrawalAmount = Math.round(targetSaving.amount * (withdrawal.percentage / 100));
              } else if (withdrawal.amount > 0) {
                // 금액 모드인 경우: 고정 금액 사용
                withdrawalAmount = withdrawal.amount;
              } else {
                return; // 인출 금액이 없으면 스킵
              }

              // 실제 인출 가능 금액 (잔액 초과 방지)
              const actualWithdrawal = Math.min(withdrawalAmount, targetSaving.amount);

              if (actualWithdrawal <= 0) return;

              // 저축 자산에서 인출 금액 차감 (음수 방지)
              targetSaving.amount =
                Math.max(0, Math.round((targetSaving.amount - actualWithdrawal) * 100) / 100);

              // 인출 누적액 저장
              if (!targetSaving.totalWithdrawn) {
                targetSaving.totalWithdrawn = 0;
              }
              targetSaving.totalWithdrawn =
                Math.round((targetSaving.totalWithdrawn + actualWithdrawal) * 100) / 100;

              // 인출 정보 저장 (표시용)
              withdrawalInfo[targetSaving.title] = actualWithdrawal;
            }
          }
        });
      }
    }

    // 연금 계산 (퇴직연금/개인연금)
    Object.keys(pensionsByTitle).forEach((title) => {
      const pension = pensionsByTitle[title];

      // 퇴직금/DB: 은퇴년도 처리
      if (
        !pension.isActive &&
        pension.type === "severance" &&
        year === pension.retirementYear
      ) {
        // 은퇴년도: 자산에 표시 (수령 여부는 아래에서 처리)
        pension.isActive = true;
        pension.amount = pension.initialAmount; // 은퇴년도에 퇴직금 자산으로 설정
      }

      if (!pension.isActive) return; // 비활성 연금은 건너뛰기

      // 퇴직금/DB인 경우: 은퇴년도가 수령년도가 아니면 자산으로만 표시
      if (
        pension.type === "severance" &&
        year === pension.retirementYear &&
        year !== pension.paymentStartYear
      ) {
        // 은퇴년도: 퇴직금 그대로 자산으로만 표시
        // 수익률 X, 적립 X, 수령 X (나중에 수령)
        // 다음 해부터 계산 시작
        return;
      }

      // 월 단위 수익률 계산을 위한 변환
      const annualReturnRate = pension.returnRate / 100;
      const monthlyReturnRate = convertAnnualToMonthlyRate(annualReturnRate);

      // 퇴직금/DB인 경우: 적립 기간 처리 (은퇴 다음해부터)
      if (
        pension.type === "severance" &&
        year > pension.retirementYear && // 은퇴 다음해부터만
        year >= pension.contributionStartYear && // 적립 시작년도부터
        year <= pension.contributionEndYear && // 적립 종료년도까지
        year < pension.paymentStartYear // 수령 시작 전까지
      ) {
        // 적립 기간 동안 처리 (월 단위)
        const isFirstContributionYear = year === pension.contributionStartYear;

        // 추가 적립이 있는 경우
        if (
          !pension.noAdditionalContribution &&
          pension.contributionAmount &&
          pension.contributionAmount > 0
        ) {
          const monthlyAmount =
            pension.contributionFrequency === "monthly"
              ? pension.contributionAmount
              : pension.contributionAmount / 12;

          // 월 단위로 적립 및 수익률 적용
          for (let m = 1; m <= 12; m++) {
            if (isFirstContributionYear && m === 1) {
              // 첫 적립년도 첫 월: 적립만 (수익률 X)
              pension.amount = pension.amount + monthlyAmount;
            } else {
              // 다음 달부터: 전월 말 잔액에 수익률 적용 + 적립금
              pension.amount = pension.amount * (1 + monthlyReturnRate) + monthlyAmount;
            }
          }
        } else {
          // 추가 적립 없으면 수익률만 적용 (월 단위)
          if (!isFirstContributionYear) {
            for (let m = 1; m <= 12; m++) {
              pension.amount = pension.amount * (1 + monthlyReturnRate);
            }
          }
        }
      } else if (
        pension.type === "severance" &&
        year > pension.retirementYear && // 은퇴 다음해부터
        year < pension.contributionStartYear // 적립 시작 전까지
      ) {
        // 은퇴 후 ~ 적립 시작 전: 보유액에만 수익률 적용 (단, 은퇴 다음해는 첫 해이므로 수익률 X)
        if (year > pension.retirementYear + 1) {
          // 월 단위 수익률 적용
          for (let m = 1; m <= 12; m++) {
            pension.amount = pension.amount * (1 + monthlyReturnRate);
          }
        }
      }

      // 월 정보 가져오기
      const cStartMonth = pension.contributionStartMonth || 1;
      const cEndMonth = pension.contributionEndMonth || 12;
      const pStartMonth = pension.paymentStartMonth || 1;

      // 퇴직연금/개인연금: 적립 시작 전 기보유액 수익률 적용
      if (
        pension.type !== "severance" &&
        year < pension.contributionStartYear &&
        year < pension.paymentStartYear &&
        pension.amount > 0
      ) {
        // 적립 시작 전 연도: 기보유액에 월 단위 수익률 적용 (12개월 전부)
        for (let m = 1; m <= 12; m++) {
          pension.amount = pension.amount * (1 + monthlyReturnRate);
        }
      } else if (
        pension.type !== "severance" &&
        year === pension.contributionStartYear &&
        cStartMonth > 1 &&
        year < pension.paymentStartYear &&
        pension.amount > 0
      ) {
        // 적립 시작 연도에서 납입 시작 전 월에만 기보유액 수익률 적용
        // 예: 7월 시작이면 1~6월(6개월)만 수익률 적용
        for (let m = 1; m < cStartMonth; m++) {
          pension.amount = pension.amount * (1 + monthlyReturnRate);
        }
      }

      // 퇴직연금/개인연금: 적립 기간 처리
      // 적립 종료년도 = 수령 시작년도인 경우 수령 로직 우선 (year < paymentStartYear)
      if (
        pension.type !== "severance" && // 퇴직금/DB는 위에서 이미 처리
        year >= pension.contributionStartYear &&
        year <= pension.contributionEndYear &&
        year < pension.paymentStartYear
      ) {
        // 적립 기간: 연금 자산에 추가 (월 단위 수익률 적용)
        const isFirstContributionYear = year === pension.contributionStartYear;
        const isLastContributionYear = year === pension.contributionEndYear;

        // 해당 연도의 시작/종료 월 계산
        const firstMonth = isFirstContributionYear ? cStartMonth : 1;
        const lastMonth = isLastContributionYear ? cEndMonth : 12;

        // 추가 적립 금액 계산 (있는 경우만)
        const monthlyAmount = (pension.contributionAmount && pension.contributionAmount > 0)
          ? (pension.contributionFrequency === "monthly"
              ? pension.contributionAmount
              : pension.contributionAmount / 12)
          : 0;

        // 적립 시작 전 월들: 수익률만 적용 (기보유액)
        for (let m = 1; m < firstMonth; m++) {
          pension.amount = pension.amount * (1 + monthlyReturnRate);
        }

        // 적립 기간 월들: 적립 + 수익률 적용
        for (let m = firstMonth; m <= lastMonth; m++) {
          if (isFirstContributionYear && m === cStartMonth) {
            // 적립 시작 첫 월: 적립만 (수익률 X)
            pension.amount = pension.amount + monthlyAmount;
          } else {
            // 다음 달부터: 전월 말 잔액에 수익률 적용 + 적립금
            pension.amount = pension.amount * (1 + monthlyReturnRate) + monthlyAmount;
          }
        }

        // 적립 종료 후 남은 월들: 수익률만 적용
        for (let m = lastMonth + 1; m <= 12; m++) {
          pension.amount = pension.amount * (1 + monthlyReturnRate);
        }
      } else if (
        pension.type !== "severance" &&
        year > pension.contributionEndYear &&
        year < pension.paymentStartYear
      ) {
        // 적립 종료 후 ~ 수령 시작 전: 수익률만 적용 (공백 기간, 월 단위)
        for (let m = 1; m <= 12; m++) {
          pension.amount = pension.amount * (1 + monthlyReturnRate);
        }
      } else if (year === pension.paymentStartYear) {
        // PMT 방식: 수령 시작년도에 매년 수령액 계산
        const paymentYears = pension.paymentYears || 10;
        const paymentEndYear = pension.paymentStartYear + paymentYears - 1;

        // 즉시 수령 판단 (수익률 적용 안 함):
        // 적립 종료년도 = 수령 시작년도이고, 추가 적립이 있는 경우만 (연말 기준, 같은 해에 적립하고 바로 수령)
        // 단, 퇴직금은 이미 보유한 금액이므로 항상 수익률 적용
        // 기 보유 금액만 있는 경우(추가 적립 없음)는 일반 수령으로 처리 (수익률 적용)
        const hasAdditionalContribution =
          !pension.noAdditionalContribution && pension.contributionAmount > 0;
        const isImmediateWithdrawal =
          pension.type !== "severance" &&
          pension.contributionEndYear === pension.paymentStartYear &&
          hasAdditionalContribution;

        if (isImmediateWithdrawal) {
          // 즉시 수령: 수익률 적용 없이 그대로 수령
          pension._pmtAmount = calculatePMT(
            pension.amount,
            0, // 수익률 0
            paymentYears
          );
          pension._isImmediateWithdrawal = true; // 저장
          // 수익률 적용 없이 PMT 차감
          pension.amount = pension.amount - pension._pmtAmount;
        } else {
          // 일반 수령: 월 단위 수익률 적용 후 PMT 계산
          // 먼저 1년치 월 단위 수익률 적용
          for (let m = 1; m <= 12; m++) {
            pension.amount = pension.amount * (1 + monthlyReturnRate);
          }
          // PMT 계산 (연간 수익률 기준)
          pension._pmtAmount = calculatePMT(
            pension.amount,
            annualReturnRate,
            paymentYears
          );
          pension._isImmediateWithdrawal = false; // 저장
          // PMT 차감
          pension.amount = pension.amount - pension._pmtAmount;
        }

        // 수령 기간이 1년인 경우 (시작 = 종료): 즉시 비활성화
        if (pension.paymentStartYear === paymentEndYear) {
          pension.isActive = false;
          pension.amount = 0;
        }
      } else if (
        year > pension.paymentStartYear &&
        year < pension.paymentEndYear
      ) {
        // PMT 방식: 수령 기간 중 (월 단위 수익률 적용)

        if (pension._isImmediateWithdrawal) {
          // 즉시 수령: 수익률 적용 없이 PMT 차감
          pension.amount = pension.amount - pension._pmtAmount;
        } else {
          // 일반 수령: 월 단위 수익률 적용 후 PMT 차감
          for (let m = 1; m <= 12; m++) {
            pension.amount = pension.amount * (1 + monthlyReturnRate);
          }
          pension.amount = pension.amount - pension._pmtAmount;
        }
      } else if (year === pension.paymentEndYear) {
        // PMT 방식: 수령 종료년도 (마지막 수령 후 비활성화)

        if (pension._isImmediateWithdrawal) {
          // 즉시 수령: 수익률 적용 없이 마지막 PMT 차감
          pension.amount = pension.amount - pension._pmtAmount;
        } else {
          // 일반 수령: 월 단위 수익률 적용 후 마지막 PMT 차감
          for (let m = 1; m <= 12; m++) {
            pension.amount = pension.amount * (1 + monthlyReturnRate);
          }
          pension.amount = pension.amount - pension._pmtAmount;
        }

        // 수령 완료 후 비활성화
        pension.isActive = false;
        pension.amount = 0;
      } else if (year > pension.paymentEndYear) {
        // 수령 종료 이후: 연금 비활성화
        pension.isActive = false;
        pension.amount = 0;
      }
    });

    // 부동산 처리 (월 단위 업데이트 후 연말 스냅샷)
    Object.keys(realEstatesByTitle).forEach((title) => {
      const realEstate = realEstatesByTitle[title];
      const {
        startYear,
        startMonth,
        endYear,
        endMonth,
        monthlyGrowthRate,
        convertToPension,
        pensionStartYear,
        pensionStartMonth,
        pensionEndYear,
        pensionEndMonth,
        monthlyPensionAmount,
      } = realEstate;

      // 연중 월 단위 시뮬레이션
      for (let month = 1; month <= 12; month++) {
        const inHoldingPeriod =
          year > startYear ||
          (year === startYear && month >= startMonth && month <= 12);

        const beforeEnd =
          year < endYear || (year === endYear && month <= endMonth);

        if (!inHoldingPeriod || !beforeEnd) {
          continue;
        }

        if (!realEstate.isActive && inHoldingPeriod && beforeEnd) {
          realEstate.isActive = true;
          realEstate.monthsHeld = 0;
          // 시작 월에는 초기값 그대로
        }

        // 월 성장률 (시작 월은 제외)
        if (realEstate.isActive && realEstate.monthsHeld > 0) {
          realEstate.amount =
            Math.round(realEstate.amount * (1 + monthlyGrowthRate) * 1000000) /
            1000000;
        }

        // 주택연금 차감 (월 단위)
        const pensionActive =
          convertToPension &&
          Number.isFinite(pensionStartYear) &&
          (year > pensionStartYear ||
            (year === pensionStartYear && month >= pensionStartMonth)) &&
          (pensionEndYear === undefined ||
            year < pensionEndYear ||
            (year === pensionEndYear && month <= pensionEndMonth));
        if (pensionActive && monthlyPensionAmount > 0 && realEstate.isActive) {
          realEstate.amount = Math.max(
            0,
            realEstate.amount - monthlyPensionAmount
          );
        }

        // 매각 월이면 이후 비활성화
        if (year === endYear && month === endMonth) {
          realEstate.isActive = false;
          realEstate.monthsHeld += 1;
          break; // 이후 월은 보유하지 않음
        }

        if (realEstate.isActive) {
          realEstate.monthsHeld += 1;
        }
      }

      // 보유 기간 종료 이후 정리
      if (year > endYear || (year === endYear && 12 >= endMonth)) {
        if (year >= endYear) {
          realEstate.isActive = false;
          realEstate.amount = 0;
        }
      }
    });

    // 자산 계산 (월 단위 업데이트 후 연말 스냅샷)
    Object.keys(assetsByTitle).forEach((title) => {
      const asset = assetsByTitle[title];
      const { startYear, startMonth, endYear, endMonth, monthlyGrowthRate } =
        asset;

      for (let month = 1; month <= 12; month++) {
        const inHoldingPeriod =
          year > startYear ||
          (year === startYear && month >= startMonth && month <= 12);
        const beforeEnd =
          year < endYear || (year === endYear && month <= endMonth);

        if (!inHoldingPeriod || !beforeEnd) {
          continue;
        }

        if (!asset.isActive && inHoldingPeriod && beforeEnd) {
          asset.isActive = true;
          asset.monthsHeld = 0;
          asset.amount = asset._initialValue || asset.amount || 0;
        }

        if (asset.isActive && asset.monthsHeld > 0 && monthlyGrowthRate !== 0) {
          asset.amount =
            Math.round(asset.amount * (1 + monthlyGrowthRate) * 1000000) /
            1000000;
        }

        if (asset.isActive) {
          asset.monthsHeld += 1;
        }

        if (year === endYear && month === endMonth) {
          asset.isActive = false;
          break;
        }
      }

      // 보유 기간 종료 이후 정리
      if (year > endYear || (year === endYear && 12 >= endMonth)) {
        if (year >= endYear) {
          asset.isActive = false;
          asset.amount = 0;
        }
      }
    });

    // 부채 계산 (제목별로) - 음수로 표시
    Object.keys(debtsByTitle).forEach((title) => {
      const debt = debtsByTitle[title];
      const { startYear, endYear, debtType, originalAmount } = debt;
      const interestRate = debt.interestRate || 0;
      const gracePeriod = parseInt(debt.gracePeriod, 10) || 0;

      let outstanding = 0;

      // 월별 계산을 위한 변수
      const debtStartMonth = debt.startMonth || 1;
      const debtEndMonth = debt.endMonth || 12;
      const monthlyRate = interestRate / 12; // 월 이자율

      // 총 상환 개월 수 계산
      const totalMonths =
        calculateMonthsElapsed(startYear, debtStartMonth, endYear, debtEndMonth) + 1;

      // 부채 기간 내에 있는지 확인
      if (year >= startYear && year <= endYear) {
        // 현재 년도 말(12월)까지 경과한 개월 수 계산
        let monthsElapsedToYearEnd = 0;
        if (year === startYear && year === endYear) {
          // 시작 년도와 종료 년도가 같은 경우
          monthsElapsedToYearEnd = debtEndMonth - debtStartMonth + 1;
        } else if (year === startYear) {
          // 시작 년도: 시작 월부터 12월까지
          monthsElapsedToYearEnd = 13 - debtStartMonth;
        } else if (year === endYear) {
          // 종료 년도: 1월부터 종료 월까지
          monthsElapsedToYearEnd =
            calculateMonthsElapsed(startYear, debtStartMonth, year, debtEndMonth) + 1;
        } else {
          // 중간 년도: 시작부터 12월까지
          monthsElapsedToYearEnd =
            calculateMonthsElapsed(startYear, debtStartMonth, year, 12) + 1;
        }

        if (debtType === "bullet") {
          // 만기일시상환: 만기년도 만기월까지 원금 유지
          if (year < endYear) {
            outstanding = -originalAmount;
          } else if (year === endYear) {
            // 만기년도: 만기월 이후면 0, 아니면 원금 유지 (연말 기준이므로 0)
            outstanding = 0;
          }
        } else if (debtType === "equal") {
          // 원리금균등상환: 월별 PMT 계산
          if (totalMonths > 0 && monthlyRate > 0) {
            const denominator = Math.pow(1 + monthlyRate, totalMonths) - 1;
            const monthlyPmt =
              denominator !== 0
                ? (originalAmount *
                    (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
                  denominator
                : 0;

            let remainingPrincipal = originalAmount;
            // 연말까지 경과한 개월 수만큼 상환
            for (let i = 0; i < monthsElapsedToYearEnd; i++) {
              const monthInterest = remainingPrincipal * monthlyRate;
              const monthPrincipal = monthlyPmt - monthInterest;
              remainingPrincipal = Math.max(remainingPrincipal - monthPrincipal, 0);
            }

            outstanding = -remainingPrincipal;
          } else if (totalMonths > 0) {
            // 이자율이 0%인 경우: 원금을 균등 분할
            const monthlyPayment = originalAmount / totalMonths;
            const paidPrincipal = monthlyPayment * monthsElapsedToYearEnd;
            const remainingPrincipal = Math.max(originalAmount - paidPrincipal, 0);
            outstanding = -remainingPrincipal;
          }
        } else if (debtType === "principal") {
          // 원금균등상환: 월별 원금 균등 상환
          if (totalMonths > 0) {
            const monthlyPrincipalPayment = originalAmount / totalMonths;
            const paidPrincipal = monthlyPrincipalPayment * monthsElapsedToYearEnd;
            const remainingPrincipal = Math.max(originalAmount - paidPrincipal, 0);
            outstanding = -remainingPrincipal;
          }
        } else if (debtType === "grace") {
          // 거치식상환: 거치기간 동안 이자만 지불, 이후 원금 균등상환
          // 거치 종료 시점을 월 단위로 계산
          // 예: 2025년 6월 시작, 5년 거치 = 2030년 6월까지 거치
          const graceEndMonth = debtStartMonth;
          let graceEndYear = startYear + gracePeriod;

          // 상환 시작 시점 (거치 종료 다음 달)
          let repaymentStartYear = graceEndYear;
          let repaymentStartMonth = graceEndMonth + 1;
          if (repaymentStartMonth > 12) {
            repaymentStartMonth = 1;
            repaymentStartYear += 1;
          }

          // 상환 종료 시점
          const repaymentEndYear = endYear;
          const repaymentEndMonth = debtEndMonth;

          // 상환 총 개월 수 계산
          const repaymentTotalMonths =
            calculateMonthsElapsed(
              repaymentStartYear,
              repaymentStartMonth,
              repaymentEndYear,
              repaymentEndMonth
            ) + 1;

          // 현재 년도가 거치 기간인지 확인 (년 단위 비교)
          const isInGracePeriod = year < graceEndYear || year === graceEndYear;

          // 현재 년도가 상환 기간인지 확인 (년 단위 비교)
          const isInRepaymentPeriod =
            year >= repaymentStartYear && year <= repaymentEndYear;

          if (isInGracePeriod && !isInRepaymentPeriod) {
            // 거치 기간: 원금 유지
            outstanding = -originalAmount;
          } else if (isInRepaymentPeriod && repaymentTotalMonths > 0) {
            // 상환 기간: 원금을 균등하게 상환
            const monthlyPrincipalPayment =
              originalAmount / repaymentTotalMonths;

            // 현재 년도에 포함된 상환 개월 수 계산
            let repaymentMonthsInYear = 0;
            if (year === repaymentStartYear && year === repaymentEndYear) {
              // 시작 년도와 종료 년도가 같은 경우
              repaymentMonthsInYear =
                repaymentEndMonth - repaymentStartMonth + 1;
            } else if (year === repaymentStartYear) {
              // 상환 시작 년도: 시작 월부터 12월까지
              repaymentMonthsInYear = 13 - repaymentStartMonth;
            } else if (year === repaymentEndYear) {
              // 상환 종료 년도: 1월부터 종료 월까지
              repaymentMonthsInYear = repaymentEndMonth;
            } else {
              // 중간 년도: 전체 12개월
              repaymentMonthsInYear = 12;
            }

            // 현재 년도 시작 시점까지 상환한 원금 계산
            const monthsElapsedBeforeYear = calculateMonthsElapsed(
              repaymentStartYear,
              repaymentStartMonth,
              year,
              1
            );
            const paidPrincipalBeforeYear =
              monthlyPrincipalPayment * Math.max(monthsElapsedBeforeYear, 0);

            // 현재 년도에 상환할 원금
            const yearlyPrincipalPayment =
              monthlyPrincipalPayment * repaymentMonthsInYear;

            // 현재 년도 말까지 상환한 원금
            const paidPrincipalAtYearEnd =
              paidPrincipalBeforeYear + yearlyPrincipalPayment;

            const remainingPrincipal = Math.max(
              originalAmount - paidPrincipalAtYearEnd,
              0
            );
            outstanding = -remainingPrincipal;
          }
        }
      }

      debt.amount = outstanding;
      debt.isActive = outstanding !== 0;
    });

    // 자산 데이터 구성
    const assetItem = {
      year,
      age,
    };

    // 현금을 그대로 표시 (양수면 자산, 음수면 부채)
    assetItem.현금 = currentCash;

    // 활성 저축별 자산 추가 (같은 제목의 저축은 합계 계산)
    const savingsByTitle = {};
    Object.keys(savingsById).forEach((id) => {
      const saving = savingsById[id];
      if (saving.isActive) {
        if (savingsByTitle[saving.title]) {
          savingsByTitle[saving.title] += saving.amount;
        } else {
          savingsByTitle[saving.title] = saving.amount;
        }
      }
    });

    // 합계된 저축을 자산 아이템에 추가
    Object.keys(savingsByTitle).forEach((title) => {
      assetItem[title] = savingsByTitle[title];
    });

    // 활성 연금별 자산 추가
    Object.keys(pensionsByTitle).forEach((title) => {
      const pension = pensionsByTitle[title];
      if (pension.isActive) {
        assetItem[title] = pension.amount;
      }
    });

    // 활성 부동산별 자산 추가
    Object.keys(realEstatesByTitle).forEach((title) => {
      const realEstate = realEstatesByTitle[title];
      if (realEstate.isActive) {
        assetItem[title] = realEstate.amount;
      }
    });

    // 활성 자산별 자산 추가
    Object.keys(assetsByTitle).forEach((title) => {
      const asset = assetsByTitle[title];
      if (asset.isActive) {
        // "현금"이라는 이름은 시스템 예약어이므로 "현금 자산"으로 변경
        const displayTitle = title === "현금" ? "현금 자산" : title;
        assetItem[displayTitle] = asset.amount;
      }
    });

    // 부채(음수) 추가
    Object.keys(debtsByTitle).forEach((title) => {
      const debt = debtsByTitle[title];
      if (debt.amount && debt.amount !== 0) {
        assetItem[title] = debt.amount;
      }
    });

    // assetItem은 아직 totalAmount 없이 저장 (나중에 breakdown 계산 후 동기화)
    assetData.push(assetItem);

    // detailedData 생성 (breakdown 정보)
    const assetItems = [];
    const debtItems = [];

    // 현금 (양수면 자산, 음수면 부채로 분류)
    if (currentCash > 0) {
      assetItems.push({
        label: "현금",
        amount: currentCash,
        originalValue: currentCash,
        sourceType: "cash", // 데이터 출처
      });
    } else if (currentCash < 0) {
      debtItems.push({
        label: "현금",
        amount: Math.abs(currentCash),
        originalValue: currentCash,
        sourceType: "cash", // 데이터 출처
      });
    }

    // 저축
    Object.keys(savingsById).forEach((id) => {
      const saving = savingsById[id];
      if (saving.isActive && saving.amount > 0) {
        assetItems.push({
          label: saving.title,
          amount: saving.amount,
          originalValue: saving.amount,
          preWithdrawalAmount: saving.preWithdrawalAmount || saving.amount, // 인출 전 잔액 (퍼센트 계산용)
          sourceType: "saving", // 데이터 출처
          sourceId: id, // 저축 ID 추가
        });
      }
    });

    // 연금
    Object.keys(pensionsByTitle).forEach((title) => {
      const pension = pensionsByTitle[title];
      if (pension.isActive && pension.amount > 0) {
        assetItems.push({
          label: title,
          amount: pension.amount,
          originalValue: pension.amount,
          sourceType: "pension", // 데이터 출처
        });
      }
    });

    // 부동산
    Object.keys(realEstatesByTitle).forEach((title) => {
      const realEstate = realEstatesByTitle[title];
      if (realEstate.isActive && realEstate.amount > 0) {
        assetItems.push({
          label: title,
          amount: realEstate.amount,
          originalValue: realEstate.amount,
          sourceType: "realEstate", // 데이터 출처
        });
      }
    });

    // 자산
    Object.keys(assetsByTitle).forEach((title) => {
      const asset = assetsByTitle[title];
      if (asset.isActive && asset.amount > 0) {
        const displayTitle = title === "현금" ? "현금 자산" : title;
        assetItems.push({
          label: displayTitle,
          amount: asset.amount,
          originalValue: asset.amount,
          sourceType: "asset", // 데이터 출처
        });
      }
    });

    // 부채
    Object.keys(debtsByTitle).forEach((title) => {
      const debt = debtsByTitle[title];
      if (debt.amount && debt.amount !== 0) {
        debtItems.push({
          label: title,
          amount: Math.abs(debt.amount),
          originalValue: debt.amount,
          sourceType: "debt", // 데이터 출처
        });
      }
    });

    // 색상 매핑 함수 (bar 차트와 동일한 색상)
    const getAssetColor = (assetName) => {
      switch (assetName) {
        case "저축투자":
          return "#3b82f6"; // 파랑
        case "연금":
          return "#fbbf24"; // 노랑
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

    // 카테고리 판별 및 색상 반환 함수 (sourceType 우선, 라벨은 보조)
    const getCategoryAndColor = (item) => {
      const label = item?.label || "";
      const sourceType = item?.sourceType;

      if (sourceType) {
        switch (sourceType) {
          case "cash":
            return { category: "현금", color: getAssetColor("양수현금") };
          case "saving":
            return { category: "저축투자", color: getAssetColor("저축투자") };
          case "pension":
            return { category: "연금", color: getAssetColor("연금") };
          case "realEstate":
            return { category: "부동산", color: getAssetColor("부동산") };
          case "asset":
            return { category: "자산", color: getAssetColor("자산") };
          case "debt":
            return { category: "부채", color: getAssetColor("부채") };
          default:
            break;
        }
      }

      if (label.includes("현금") || label.includes("cash")) {
        return { category: "현금", color: getAssetColor("양수현금") };
      } else if (
        label.includes("저축") ||
        label.includes("투자") ||
        label.includes("예금") ||
        label.includes("적금") ||
        label.includes("채권") ||
        label.includes("주식") ||
        label.includes("펀드") ||
        label.includes("ETF")
      ) {
        return { category: "저축투자", color: getAssetColor("저축투자") };
      } else if (
        label.includes("연금") ||
        label.includes("퇴직") ||
        label.includes("국민연금") ||
        label.includes("IRP") ||
        label.includes("DB")
      ) {
        return { category: "연금", color: getAssetColor("연금") };
      } else if (
        label.includes("부동산") ||
        label.includes("아파트") ||
        label.includes("자택") ||
        label.includes("주택") ||
        label.includes("토지") ||
        label.includes("건물") ||
        label.includes("상가")
      ) {
        return { category: "부동산", color: getAssetColor("부동산") };
      } else {
        return { category: "자산", color: getAssetColor("자산") };
      }
    };

    // bar 차트와 동일한 순서로 정렬 (미리 계산하여 hover 시 렉 방지)
    // 1. 카테고리별 분류 + 색상 할당
    const categorizedAssets = {
      현금: [],
      연금: [],
      자산: [],
    };

    const categorizedDebts = {
      현금: [],
      기타: [],
    };

    assetItems.forEach((item) => {
      const { category, color } = getCategoryAndColor(item);
      const itemWithColor = { ...item, color };

      if (item.label === "현금" || item.label === "현금 자산") {
        categorizedAssets.현금.push(itemWithColor);
      } else if (
        item.label.includes("연금") ||
        item.label.includes("퇴직") ||
        item.label.includes("국민연금")
      ) {
        categorizedAssets.연금.push(itemWithColor);
      } else {
        categorizedAssets.자산.push(itemWithColor);
      }
    });

    debtItems.forEach((item) => {
      const color =
        item.label === "현금"
          ? getAssetColor("음수현금")
          : getAssetColor("부채");
      const itemWithColor = { ...item, color };

      if (item.label === "현금") {
        categorizedDebts.현금.push(itemWithColor);
      } else {
        categorizedDebts.기타.push(itemWithColor);
      }
    });

    // 2. 각 카테고리 내에서 금액이 작은 순서대로 정렬 (작은 금액이 위로)
    Object.keys(categorizedAssets).forEach((category) => {
      categorizedAssets[category].sort((a, b) => a.amount - b.amount); // 오름차순 (작은 금액 → 큰 금액)
    });

    // 부채도 모두 오름차순 정렬 (작은 금액 → 큰 금액)
    if (categorizedDebts.현금.length > 0) {
      categorizedDebts.현금.sort((a, b) => a.amount - b.amount);
    }
    if (categorizedDebts.기타.length > 0) {
      categorizedDebts.기타.sort((a, b) => a.amount - b.amount);
    }

    // 3. bar 차트와 반대 순서로 결합
    // bar 쌓이는 순서: 자산 큰 것(맨 아래) → 연금 큰 것 → 현금(맨 위)
    // 상세 패널 순서: 자산 작은 것(맨 위) → 연금 작은 것 → 현금(맨 아래)
    // 각 카테고리 내에서 작은 금액 → 큰 금액 순서로 정렬됨
    const sortedAssetItems = [
      ...categorizedAssets.자산,
      ...categorizedAssets.연금,
      ...categorizedAssets.현금,
    ];

    // 부채: 기타 부채(리스트 맨 위) → 현금(리스트 맨 아래)
    const sortedDebtItems = [
      ...categorizedDebts.기타,
      ...categorizedDebts.현금,
    ];

    // 합계 계산
    const totalAssets = sortedAssetItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const totalDebt = sortedDebtItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    // 순자산 계산 (Single Source of Truth: assetItems, debtItems에서 계산)
    const netAssets = totalAssets - totalDebt;

    // assetData에 totalAmount 동기화 (breakdown.netAssets와 동일한 값)
    // 이렇게 하면 차트, 툴팁, 패널 모두 같은 값을 사용
    assetItem.totalAmount = netAssets;

    // 통합 구조: assetItem에 breakdown, investmentInfo, withdrawalInfo 직접 추가
    // (cashflow처럼 차트용 데이터와 상세 데이터를 하나의 배열에 통합)
    assetItem.breakdown = {
      assetItems: sortedAssetItems, // 이미 정렬됨
      debtItems: sortedDebtItems, // 이미 정렬됨
      totalAssets: totalAssets, // 합계도 미리 계산
      totalDebt: totalDebt,
      netAssets: netAssets, // assetItem.totalAmount와 동일
    };
    assetItem.investmentInfo = investmentInfo; // 잉여 현금 투자 정보 (자산명: 투자금액)
    assetItem.withdrawalInfo = withdrawalInfo; // 자산 인출 정보 (자산명: 인출금액)
  }

  // 통합된 assetData 반환 (차트용 + 상세용 모두 포함)
  // 이전: { data: assetData, detailedData: detailedData }
  // 현재: assetData 배열 직접 반환 (각 항목에 breakdown 포함)
  return assetData;
}

/**
 * 부채 시뮬레이션 계산
 */
export function calculateDebtSimulation(profileData, debts = []) {
  const currentYear = new Date().getFullYear();
  const startAge = calculateKoreanAge(profileData.birthYear, currentYear); // 만 나이로 실시간 계산
  const deathAge = 90;
  const simulationYears = deathAge - startAge + 1;

  const debtData = [];

  // 부채별 자산 (제목별로 분리)
  const debtsByTitle = {};
  debts.forEach((debt) => {
    const startMonth = parseInt(debt.startMonth, 10) || 1;
    const endMonth = parseInt(debt.endMonth, 10) || 12;
    debtsByTitle[debt.title] = {
      amount: debt.debtAmount, // 부채 금액
      startYear: debt.startYear,
      startMonth: startMonth,
      endYear: debt.endYear,
      endMonth: endMonth,
      debtType: debt.debtType, // "bullet", "equal", "principal", "grace"
      interestRate: debt.interestRate || 0, // 이미 소수로 저장됨
      originalAmount: debt.debtAmount,
      gracePeriod: debt.gracePeriod, // 거치기간 추가 (거치식 상환에 필요)
      isActive: true,
    };
  });

  for (let i = 0; i < simulationYears; i++) {
    const year = currentYear + i;
    const age = startAge + i;

    const debtItem = { year, age };

    // 부채 상환 처리
    Object.keys(debtsByTitle).forEach((title) => {
      const debt = debtsByTitle[title];
      const { startYear, startMonth, endYear, endMonth, debtType, originalAmount } = debt;
      const interestRate = debt.interestRate || 0;
      const gracePeriod = parseInt(debt.gracePeriod, 10) || 0;
      const monthlyRate = interestRate / 12; // 월 이자율

      // 총 상환 개월 수 계산
      const totalMonths =
        calculateMonthsElapsed(startYear, startMonth, endYear, endMonth) + 1;

      let outstanding = 0;

      if (year >= startYear && year <= endYear) {
        // 현재 년도 말(12월)까지 경과한 개월 수 계산
        let monthsElapsedToYearEnd = 0;
        if (year === startYear && year === endYear) {
          // 시작 년도와 종료 년도가 같은 경우
          monthsElapsedToYearEnd = endMonth - startMonth + 1;
        } else if (year === startYear) {
          // 시작 년도: 시작 월부터 12월까지
          monthsElapsedToYearEnd = 13 - startMonth;
        } else if (year === endYear) {
          // 종료 년도: 시작부터 종료 월까지
          monthsElapsedToYearEnd =
            calculateMonthsElapsed(startYear, startMonth, year, endMonth) + 1;
        } else {
          // 중간 년도: 시작부터 12월까지
          monthsElapsedToYearEnd =
            calculateMonthsElapsed(startYear, startMonth, year, 12) + 1;
        }

        if (debtType === "bullet") {
          // 만기일시상환: 만기년도 만기월까지 원금 유지
          if (year < endYear) {
            outstanding = -originalAmount;
          } else if (year === endYear) {
            // 만기년도: 연말 기준이므로 0
            outstanding = 0;
          }
        } else if (debtType === "equal") {
          // 원리금균등상환: 월별 PMT 계산
          if (totalMonths > 0 && monthlyRate > 0) {
            const denominator = Math.pow(1 + monthlyRate, totalMonths) - 1;
            const monthlyPmt =
              denominator !== 0
                ? (originalAmount *
                    (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
                  denominator
                : 0;

            let remainingPrincipal = originalAmount;
            // 연말까지 경과한 개월 수만큼 상환
            for (let j = 0; j < monthsElapsedToYearEnd; j++) {
              const monthInterest = remainingPrincipal * monthlyRate;
              const monthPrincipal = monthlyPmt - monthInterest;
              remainingPrincipal = Math.max(remainingPrincipal - monthPrincipal, 0);
            }

            outstanding = -remainingPrincipal;
          } else if (totalMonths > 0) {
            // 이자율이 0%인 경우: 원금을 균등 분할
            const monthlyPayment = originalAmount / totalMonths;
            const paidPrincipal = monthlyPayment * monthsElapsedToYearEnd;
            const remainingPrincipal = Math.max(originalAmount - paidPrincipal, 0);
            outstanding = -remainingPrincipal;
          }
        } else if (debtType === "principal") {
          // 원금균등상환: 월별 원금 균등 상환
          if (totalMonths > 0) {
            const monthlyPrincipalPayment = originalAmount / totalMonths;
            const paidPrincipal = monthlyPrincipalPayment * monthsElapsedToYearEnd;
            const remainingPrincipal = Math.max(originalAmount - paidPrincipal, 0);
            outstanding = -remainingPrincipal;
          }
        } else if (debtType === "grace") {
          // 거치식상환: 거치기간 동안 이자만 지불, 이후 원금 균등상환
          const graceEndMonth = startMonth;
          let graceEndYear = startYear + gracePeriod;

          // 상환 시작 시점 (거치 종료 다음 달)
          let repaymentStartYear = graceEndYear;
          let repaymentStartMonth = graceEndMonth + 1;
          if (repaymentStartMonth > 12) {
            repaymentStartMonth = 1;
            repaymentStartYear += 1;
          }

          // 상환 총 개월 수 계산
          const repaymentTotalMonths =
            calculateMonthsElapsed(repaymentStartYear, repaymentStartMonth, endYear, endMonth) + 1;

          // 현재 년도가 거치 기간인지 확인
          const isInGracePeriod = year < graceEndYear || year === graceEndYear;
          const isInRepaymentPeriod =
            year >= repaymentStartYear && year <= endYear;

          if (isInGracePeriod && !isInRepaymentPeriod) {
            outstanding = -originalAmount;
          } else if (isInRepaymentPeriod && repaymentTotalMonths > 0) {
            const monthlyPrincipalPayment = originalAmount / repaymentTotalMonths;

            // 현재 년도 말까지 경과한 상환 개월 수 계산
            let repaymentMonthsToYearEnd = 0;
            if (year === repaymentStartYear && year === endYear) {
              repaymentMonthsToYearEnd = endMonth - repaymentStartMonth + 1;
            } else if (year === repaymentStartYear) {
              repaymentMonthsToYearEnd = 13 - repaymentStartMonth;
            } else if (year === endYear) {
              repaymentMonthsToYearEnd =
                calculateMonthsElapsed(repaymentStartYear, repaymentStartMonth, year, endMonth) + 1;
            } else {
              repaymentMonthsToYearEnd =
                calculateMonthsElapsed(repaymentStartYear, repaymentStartMonth, year, 12) + 1;
            }

            const paidPrincipal = monthlyPrincipalPayment * repaymentMonthsToYearEnd;
            const remainingPrincipal = Math.max(originalAmount - paidPrincipal, 0);
            outstanding = -remainingPrincipal;
          }
        }
      }

      if (outstanding !== 0) {
        debt.isActive = true;
        debt.amount = outstanding;
        debtItem[title] = outstanding;
      } else {
        debt.isActive = false;
        debt.amount = 0;
      }
    });

    // 총 부채 계산 (year, age 필드 제외)
    const totalAmount = Object.entries(debtItem).reduce((sum, [key, value]) => {
      // year, age 필드는 제외하고 숫자 필드만 합산
      if (key !== "year" && key !== "age" && typeof value === "number") {
        return sum + value;
      }
      return sum;
    }, 0);

    debtItem.totalAmount = totalAmount;
    debtData.push(debtItem);
  }

  return debtData;
}

/**
 * AI 분석에 필요한 핵심 필드만 추출하는 헬퍼 함수들
 * createdAt, updatedAt 등 메타데이터는 제외
 */

// 소득 데이터 정제
function cleanIncomeData(incomes) {
  return incomes.map((income) => ({
    name: income.title || income.name,
    amount: income.amount,
    frequency: income.frequency,
    startYear: income.startYear,
    startMonth: income.startMonth,
    endYear: income.endYear,
    endMonth: income.endMonth,
    yearlyGrowthRate: income.yearlyGrowthRate || income.growthRate,
    fixedToRetirement: income.isFixedToRetirementYear || income.fixedToRetirement,
  }));
}

// 지출 데이터 정제
function cleanExpenseData(expenses) {
  return expenses.map((expense) => ({
    name: expense.title || expense.name,
    amount: expense.amount,
    frequency: expense.frequency,
    startYear: expense.startYear,
    startMonth: expense.startMonth,
    endYear: expense.endYear,
    endMonth: expense.endMonth,
    yearlyGrowthRate: expense.yearlyGrowthRate || expense.growthRate,
    fixedToRetirement: expense.isFixedToRetirementYear || expense.fixedToRetirement,
  }));
}

// 저축/투자 데이터 정제
function cleanSavingData(savings) {
  return savings.map((saving) => ({
    name: saving.title || saving.name,
    amount: saving.amount,
    frequency: saving.frequency,
    currentAmount: saving.currentAmount,
    startYear: saving.startYear,
    startMonth: saving.startMonth,
    endYear: saving.endYear,
    endMonth: saving.endMonth,
    interestRate: saving.interestRate,
    yearlyGrowthRate: saving.yearlyGrowthRate,
    capitalGainsTaxRate: saving.capitalGainsTaxRate,
    treatAsPurchase: saving.treatAsInitialPurchase || saving.treatAsPurchase,
    savingType: saving.savingType,
    incomeRate: saving.incomeRate,
    fixedToRetirement: saving.isFixedToRetirementYear || saving.fixedToRetirement,
  }));
}

// 연금 데이터 정제
function cleanPensionData(pensions) {
  return pensions.map((pension) => ({
    name: pension.title || pension.name,
    type: pension.type,
    currentAmount: pension.currentAmount,
    contributionAmount: pension.contributionAmount,
    frequency: pension.frequency,
    interestRate: pension.interestRate,
    contributionStartYear: pension.contributionStartYear,
    contributionStartMonth: pension.contributionStartMonth,
    contributionEndYear: pension.contributionEndYear,
    contributionEndMonth: pension.contributionEndMonth,
    paymentStartYear: pension.paymentStartYear,
    paymentStartMonth: pension.paymentStartMonth,
    paymentYears: pension.paymentYears,
    paymentEndMonth: pension.paymentEndMonth,
    monthlyPayment: pension.monthlyPayment,
    averageMonthlyWage: pension.averageMonthlyWage,
    yearsOfService: pension.yearsOfService,
    noAdditionalContribution: pension.noAdditionalContribution,
    fixedContributionEndToRetirement: pension.fixedContributionEndToRetirement,
  }));
}

// 부동산 데이터 정제
function cleanRealEstateData(realEstates) {
  return realEstates.map((realEstate) => ({
    name: realEstate.title || realEstate.name,
    currentValue: realEstate.currentValue,
    growthRate: realEstate.growthRate || realEstate.annualAppreciationRate,
    startYear: realEstate.startYear,
    startMonth: realEstate.startMonth,
    endYear: realEstate.endYear,
    endMonth: realEstate.endMonth,
    isPurchase: realEstate.isPurchase,
    monthlyRentalIncome: realEstate.monthlyRentalIncome,
    hasRentalIncome: realEstate.hasRentalIncome,
    rentalIncomeStartYear: realEstate.rentalIncomeStartYear,
    rentalIncomeStartMonth: realEstate.rentalIncomeStartMonth,
    rentalIncomeEndYear: realEstate.rentalIncomeEndYear,
    rentalIncomeEndMonth: realEstate.rentalIncomeEndMonth,
    convertToPension: realEstate.convertToPension,
    monthlyPensionAmount: realEstate.monthlyPensionAmount,
    pensionStartYear: realEstate.pensionStartYear,
    pensionStartMonth: realEstate.pensionStartMonth,
    pensionEndYear: realEstate.pensionEndYear,
    pensionEndMonth: realEstate.pensionEndMonth,
    isResidential: realEstate.isResidential,
    hasAcquisitionInfo: realEstate.hasAcquisitionInfo,
    acquisitionPrice: realEstate.acquisitionPrice,
    acquisitionYear: realEstate.acquisitionYear,
  }));
}

// 자산 데이터 정제
function cleanAssetData(assets) {
  return assets.map((asset) => ({
    name: asset.title || asset.name,
    currentValue: asset.currentValue,
    growthRate: asset.growthRate || asset.annualAppreciationRate,
    startYear: asset.startYear,
    startMonth: asset.startMonth,
    endYear: asset.endYear,
    endMonth: asset.endMonth,
    assetType: asset.assetType,
    incomeRate: asset.incomeRate,
    capitalGainsTaxRate: asset.capitalGainsTaxRate,
    isPurchase: asset.isPurchase,
  }));
}

// 부채 데이터 정제
function cleanDebtData(debts) {
  return debts.map((debt) => ({
    name: debt.title || debt.name,
    debtAmount: debt.debtAmount,
    interestRate: debt.interestRate || debt.annualInterestRate,
    startYear: debt.startYear,
    startMonth: debt.startMonth,
    endYear: debt.endYear,
    endMonth: debt.endMonth,
    repaymentType: debt.repaymentType,
    graceYears: debt.graceYears,
    treatAsInflow: debt.treatAsInflow,
  }));
}

/**
 * 시뮬레이션 데이터 정제: 0이나 빈 배열 제거
 * 핵심 필드(year, age, amount, breakdown)는 항상 유지
 */
function cleanSimulationYearData(yearData) {
  const cleaned = {
    year: yearData.year,
    age: yearData.age,
    amount: yearData.amount,
  };

  // breakdown이 있으면 항상 포함 (중요한 정보)
  if (yearData.breakdown) {
    cleaned.breakdown = yearData.breakdown;
  }

  // 나머지 필드들은 0이 아니거나 빈 배열이 아닐 때만 포함
  Object.keys(yearData).forEach((key) => {
    // 이미 처리한 필드들은 건너뛰기
    if (
      key === "year" ||
      key === "age" ||
      key === "amount" ||
      key === "breakdown"
    ) {
      return;
    }

    const value = yearData[key];

    // 숫자이고 0이 아닌 경우
    if (typeof value === "number" && value !== 0) {
      cleaned[key] = value;
    }
    // 배열이고 비어있지 않은 경우
    else if (Array.isArray(value) && value.length > 0) {
      cleaned[key] = value;
    }
    // 객체인 경우 (breakdown 외)
    else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
    ) {
      cleaned[key] = value;
    }
  });

  return cleaned;
}

/**
 * 시뮬레이션 데이터 배열 정제
 */
function cleanSimulationData(simulationData) {
  return simulationData.map((yearData) => cleanSimulationYearData(yearData));
}

/**
 * AI 봇을 위한 시뮬레이션 데이터 추출
 * 현금흐름과 자산 시뮬레이션 데이터를 AI가 분석하기 쉬운 형태로 변환
 * createdAt, updatedAt 등 메타데이터 제외, 0과 빈 배열도 제거
 */
export function extractAIAnalysisData(
  profileData,
  incomes = [],
  expenses = [],
  savings = [],
  pensions = [],
  realEstates = [],
  assets = [],
  debts = []
) {
  // 현금흐름 시뮬레이션 계산
  const cashflowData = calculateCashflowSimulation(
    profileData,
    incomes,
    expenses,
    savings,
    pensions,
    realEstates,
    assets,
    debts
  );

  // 자산 시뮬레이션 계산
  const assetSimulationResult = calculateAssetSimulation(
    profileData,
    incomes,
    expenses,
    savings,
    pensions,
    realEstates,
    assets,
    cashflowData,
    debts
  );

  // calculateAssetSimulation은 통합된 배열을 직접 반환 (각 항목에 breakdown 포함)
  const assetData = assetSimulationResult;

  // AI 분석용 데이터 구성 (핵심 필드만 추출, 0과 빈 배열 제거)
  const aiAnalysisData = {
    // 기본 정보
    profile: {
      name: profileData.name,
      currentAge: calculateKoreanAge(profileData.birthYear), // 만 나이로 실시간 계산
      retirementAge: profileData.retirementAge,
      retirementYear:
        new Date().getFullYear() +
        (parseInt(profileData.retirementAge, 10) -
          calculateKoreanAge(parseInt(profileData.birthYear, 10))),
      currentCash: profileData.currentCash || 0,
      targetAssets: profileData.targetAssets,
    },

    // 시뮬레이션 데이터 (전체 기간, 0과 빈 배열 제거)
    simulation: {
      cashflow: cleanSimulationData(cashflowData),
      assets: cleanSimulationData(Array.isArray(assetData) ? assetData : []),
    },

    // 원시 데이터 (핵심 필드만 포함, 메타데이터 제외)
    rawData: {
      incomes: cleanIncomeData(incomes),
      expenses: cleanExpenseData(expenses),
      savings: cleanSavingData(savings),
      pensions: cleanPensionData(pensions),
      realEstates: cleanRealEstateData(realEstates),
      assets: cleanAssetData(assets),
      debts: cleanDebtData(debts),
    },

    // 데이터 생성 시간
    generatedAt: new Date().toISOString(),
  };

  return aiAnalysisData;
}
