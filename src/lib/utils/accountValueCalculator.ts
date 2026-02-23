/**
 * 계좌 평가액 및 거래 계산 유틸리티
 * - 가계부 거래 내역 계산 (budgetCalculator에서 이전)
 * - 정기예금/적금 평가액 계산 (CurrentAssetTab에서 추출)
 * - 포트폴리오 평가액 계산 (portfolioCalculator에서 이전)
 */

import type { PortfolioTransaction, Account, CustomHolding } from "@/types/tables";
import type { PortfolioPriceCache } from "@/hooks/useFinancialData";
import { getStockData, getExchangeRate } from "@/lib/services/financeApiService";

// ============================================================================
// 1. 가계부 거래 내역 계산 (from budgetCalculator.ts)
// ============================================================================

export interface BudgetTransaction {
  account_id: string | null;
  type: string;  // "income" | "expense" (Supabase에서 string으로 반환)
  amount: number;
  year?: number;
  month?: number;
  day?: number | null;
}

export interface AccountTransactionSummary {
  income: number;   // 수입 합계 (원)
  expense: number;  // 지출 합계 (원)
}

/**
 * 계좌별 수입/지출 합계 계산
 * @param transactions 가계부 거래 내역
 * @returns Record<accountId, { income, expense }>
 */
export function calculateAccountTransactionSummary(
  transactions: BudgetTransaction[]
): Record<string, AccountTransactionSummary> {
  const summary: Record<string, AccountTransactionSummary> = {};

  transactions.forEach(tx => {
    if (!tx.account_id) return;

    if (!summary[tx.account_id]) {
      summary[tx.account_id] = { income: 0, expense: 0 };
    }

    if (tx.type === "income") {
      summary[tx.account_id].income += tx.amount;
    } else if (tx.type === "expense") {
      summary[tx.account_id].expense += tx.amount;
    }
  });

  return summary;
}

/**
 * 저축 계좌 예상 잔액 계산 (현재 잔액 + 수입 - 지출)
 * @param currentBalance 현재 잔액 (원)
 * @param summary 해당 계좌의 수입/지출 합계
 * @returns 예상 잔액 (원)
 */
export function calculateExpectedBalance(
  currentBalance: number,
  summary: AccountTransactionSummary | undefined
): number {
  const { income = 0, expense = 0 } = summary || {};
  return (currentBalance || 0) + income - expense;
}

/**
 * 계좌별 잔액 정보
 */
export interface AccountBalanceInfo {
  income: number;        // 총 수입 (원)
  expense: number;       // 총 지출 (원)
  prevBalance: number | null;  // 시작 잔액
  expectedBalance: number;     // 예상 잔액
}

/**
 * 계좌별 누적 잔액 계산
 * current_balance(잔액 기록 시점) + balance_updated_at 이후 모든 입금 - 모든 출금
 * @param accounts 계좌 목록
 * @param transactions balance_updated_at 이후의 모든 거래 내역
 * @returns Record<accountId, AccountBalanceInfo>
 */
export function calculateAccountBalances(
  accounts: { id: string; current_balance: number | null; balance_updated_at: string | null }[],
  transactions: BudgetTransaction[]
): Record<string, AccountBalanceInfo> {
  const info: Record<string, AccountBalanceInfo> = {};

  accounts.forEach((account) => {
    let balanceDate: Date | null = null;
    if (account.balance_updated_at) {
      balanceDate = new Date(account.balance_updated_at);
      balanceDate.setHours(0, 0, 0, 0);
    }

    const accountIncome = transactions
      .filter((tx) => {
        if (tx.type !== "income" || tx.account_id !== account.id) return false;
        if (!balanceDate) return true;
        if (!tx.year || !tx.month) return true;
        const txDate = new Date(tx.year, tx.month - 1, tx.day ?? 1);
        txDate.setHours(0, 0, 0, 0);
        return txDate >= balanceDate;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const accountExpense = transactions
      .filter((tx) => {
        if (tx.type !== "expense" || tx.account_id !== account.id) return false;
        if (!balanceDate) return true;
        if (!tx.year || !tx.month) return true;
        const txDate = new Date(tx.year, tx.month - 1, tx.day ?? 1);
        txDate.setHours(0, 0, 0, 0);
        return txDate >= balanceDate;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const startBalance = account.current_balance || 0;
    const expectedBalance = startBalance + accountIncome - accountExpense;

    info[account.id] = {
      income: accountIncome,
      expense: accountExpense,
      prevBalance: startBalance,
      expectedBalance,
    };
  });

  return info;
}

// ============================================================================
// 2. 정기예금/적금 평가액 계산 (from CurrentAssetTab.tsx)
// ============================================================================

/**
 * 정기예금/적금 현재 평가금액 계산
 * - 적금 (savings with monthly_contribution): 월복리 적금 이자 계산
 * - 예금 (deposit): 월복리 예금 이자 계산
 * @param account Account 객체
 * @returns 원금 + 이자 (원 단위)
 */
export function calculateTermDepositValue(account: Account): number {
  const calculateInterest = (): number => {
    if (!account.current_balance || !account.interest_rate) return 0;
    if (!account.start_year) return 0;

    const startDate = new Date(account.start_year, (account.start_month || 1) - 1, account.start_day || 1);
    const today = new Date();
    const monthsElapsed = Math.max(0,
      (today.getFullYear() - startDate.getFullYear()) * 12 +
      (today.getMonth() - startDate.getMonth())
    );
    const interestType = account.interest_type || 'simple';

    if (account.account_type === "savings" && account.monthly_contribution) {
      // 적금
      const monthlyRate = account.interest_rate / 100 / 12;
      const principal = account.monthly_contribution * monthsElapsed;
      if (interestType === 'simple') {
        const interest = (monthsElapsed * (monthsElapsed + 1) / 2) * account.monthly_contribution * monthlyRate;
        return Math.round(interest);
      } else if (interestType === 'monthly_compound') {
        let total = 0;
        for (let i = 0; i < monthsElapsed; i++) {
          total = (total + account.monthly_contribution) * (1 + monthlyRate);
        }
        return Math.round(total - principal);
      } else {
        const effectiveMonthlyRate = Math.pow(1 + account.interest_rate / 100, 1/12) - 1;
        let total = 0;
        for (let i = 0; i < monthsElapsed; i++) {
          total = (total + account.monthly_contribution) * (1 + effectiveMonthlyRate);
        }
        return Math.round(total - principal);
      }
    } else {
      // 예금
      if (interestType === 'simple') {
        const years = monthsElapsed / 12;
        const interest = account.current_balance * (account.interest_rate / 100) * years;
        return Math.round(interest);
      } else if (interestType === 'monthly_compound') {
        const monthlyRate = account.interest_rate / 100 / 12;
        const currentValue = account.current_balance * Math.pow(1 + monthlyRate, monthsElapsed);
        return Math.round(currentValue - account.current_balance);
      } else {
        const years = monthsElapsed / 12;
        const currentValue = account.current_balance * Math.pow(1 + account.interest_rate / 100, years);
        return Math.round(currentValue - account.current_balance);
      }
    }
  };

  const interest = calculateInterest();

  if (account.account_type === "savings" && account.monthly_contribution && account.start_year) {
    const startDate = new Date(account.start_year, (account.start_month || 1) - 1, account.start_day || 1);
    const today = new Date();
    const monthsElapsed = Math.max(0,
      (today.getFullYear() - startDate.getFullYear()) * 12 +
      (today.getMonth() - startDate.getMonth())
    );
    const principal = account.monthly_contribution * monthsElapsed;
    return principal + interest;
  }
  return (account.current_balance || 0) + interest;
}

/**
 * 만기까지 남은 일수 (D-day)
 * @returns "D-365", "D-Day", "만기" 등
 */
export function getMaturityDays(account: Account): string | null {
  if (!account.maturity_year || !account.maturity_month) return null;
  const maturityDate = new Date(
    account.maturity_year,
    account.maturity_month - 1,
    account.maturity_day || 1
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  maturityDate.setHours(0, 0, 0, 0);
  const diffTime = maturityDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "만기";
  if (diffDays === 0) return "D-Day";
  return `D-${diffDays}`;
}

/**
 * 정기예금/적금 기간 (개월)
 */
export function getDurationMonths(account: Account): number | null {
  if (!account.start_year || !account.maturity_year) return null;
  const startDate = new Date(account.start_year, (account.start_month || 1) - 1);
  const endDate = new Date(account.maturity_year, (account.maturity_month || 12) - 1);
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}

/**
 * 정기예금/적금 원금 계산
 * - 적금: 월납입 × 경과개월
 * - 예금: current_balance
 */
export function getTermDepositPrincipal(account: Account): number {
  if (account.account_type === "savings" && account.monthly_contribution && account.start_year) {
    const startDate = new Date(account.start_year, (account.start_month || 1) - 1, account.start_day || 1);
    const today = new Date();
    const monthsElapsed = Math.max(0,
      (today.getFullYear() - startDate.getFullYear()) * 12 +
      (today.getMonth() - startDate.getMonth())
    );
    return account.monthly_contribution * monthsElapsed;
  }
  return account.current_balance || 0;
}

/**
 * 만기수령액 (세전) 계산
 * interest_type에 따라 단리/월복리/년복리
 */
export function calculateMaturityAmountPreTax(account: Account): number | null {
  if (!account.current_balance || !account.interest_rate) return null;
  const months = getDurationMonths(account);
  if (months === null) return null;
  const interestType = account.interest_type || 'simple';

  if (account.account_type === "savings" && account.monthly_contribution) {
    const monthlyRate = account.interest_rate / 100 / 12;
    const principal = account.monthly_contribution * months;
    if (interestType === 'simple') {
      const interest = (months * (months + 1) / 2) * account.monthly_contribution * monthlyRate;
      return Math.round(principal + interest);
    } else if (interestType === 'monthly_compound') {
      let total = 0;
      for (let i = 0; i < months; i++) {
        total = (total + account.monthly_contribution) * (1 + monthlyRate);
      }
      return Math.round(total);
    } else {
      const effectiveMonthlyRate = Math.pow(1 + account.interest_rate / 100, 1/12) - 1;
      let total = 0;
      for (let i = 0; i < months; i++) {
        total = (total + account.monthly_contribution) * (1 + effectiveMonthlyRate);
      }
      return Math.round(total);
    }
  } else {
    if (interestType === 'simple') {
      const years = months / 12;
      const interest = account.current_balance * (account.interest_rate / 100) * years;
      return Math.round(account.current_balance + interest);
    } else if (interestType === 'monthly_compound') {
      const monthlyRate = account.interest_rate / 100 / 12;
      return Math.round(account.current_balance * Math.pow(1 + monthlyRate, months));
    } else {
      const years = months / 12;
      return Math.round(account.current_balance * Math.pow(1 + account.interest_rate / 100, years));
    }
  }
}

/**
 * 만기수령액 (세후) 계산 - 이자에 15.4% 세금
 */
export function calculateMaturityAmountPostTax(account: Account): number | null {
  const preTax = calculateMaturityAmountPreTax(account);
  if (preTax === null || !account.current_balance) return null;

  const months = getDurationMonths(account);
  if (months === null) return null;

  let principal: number;
  if (account.account_type === "savings" && account.monthly_contribution) {
    principal = account.monthly_contribution * months;
  } else {
    principal = account.current_balance;
  }

  const interest = preTax - principal;
  const taxRate = account.is_tax_free ? 0 : 0.154;
  const tax = interest * taxRate;

  return Math.round(preTax - tax);
}

// ============================================================================
// 3. 포트폴리오 평가액 계산 (from portfolioCalculator.ts)
// ============================================================================

/**
 * 포트폴리오 현재 가격 및 환율 조회
 * Hook 없이 사용 가능한 버전
 */
export async function fetchPortfolioPrices(
  transactions: PortfolioTransaction[]
): Promise<PortfolioPriceCache> {
  if (transactions.length === 0) {
    return {
      priceDataMap: new Map(),
      exchangeRateMap: new Map(),
      tickerCurrencyMap: new Map(),
      dates: [],
    };
  }

  // 고유 티커 목록 + 통화 정보
  const tickerCurrencyMap = new Map<string, string>();
  transactions.forEach((tx) => {
    if (!tickerCurrencyMap.has(tx.ticker)) {
      tickerCurrencyMap.set(tx.ticker, tx.currency);
    }
  });
  const tickers = [...tickerCurrencyMap.keys()];

  // 해외주식 있는지 확인
  const hasForeignStock = [...tickerCurrencyMap.values()].some((c) => c === "USD");

  // 최근 30일 데이터만 가져오기 (최신 가격만 필요)
  const fetchDays = 30;

  // 주가 데이터 + 환율 병렬 fetch
  const priceDataMap = new Map<string, Map<string, number>>();
  const exchangeRateMap = new Map<string, number>();

  const stockPromises = tickers.map(async (ticker) => {
    try {
      const res = await getStockData(ticker, { days: fetchDays });
      const tickerPrices = new Map<string, number>();
      res.data.forEach((d) => {
        tickerPrices.set(d.Date, d.Close);
      });
      return { ticker, prices: tickerPrices };
    } catch {
      return { ticker, prices: new Map<string, number>() };
    }
  });

  const fxPromise = hasForeignStock
    ? getExchangeRate("USDKRW", { days: fetchDays })
        .then((res) => {
          res.data.forEach((d) => {
            exchangeRateMap.set(d.Date, d.Close);
          });
        })
        .catch(() => {
          console.log("환율 데이터 로드 실패, 기본 환율 사용");
        })
    : Promise.resolve();

  const [stockResults] = await Promise.all([Promise.all(stockPromises), fxPromise]);

  stockResults.forEach(({ ticker, prices }) => {
    priceDataMap.set(ticker, prices);
  });

  return {
    priceDataMap,
    exchangeRateMap,
    tickerCurrencyMap,
    dates: [],
  };
}

/**
 * 계좌별 포트폴리오 평가액 계산
 * - 거래 내역을 기반으로 보유량 계산
 * - 현재가와 환율 적용하여 평가액 산출
 * @returns Map<accountId, 평가액(원 단위)>
 */
export function calculatePortfolioAccountValues(
  transactions: PortfolioTransaction[],
  priceCache: PortfolioPriceCache | null | undefined,
  accounts?: { id: string; additional_amount?: number | null }[],
  customHoldings?: CustomHolding[]
): Map<string, number> {
  const investmentAccountValues = new Map<string, number>();

  if (transactions.length === 0) {
    return investmentAccountValues;
  }

  const priceDataMap = priceCache?.priceDataMap;
  const exchangeRateMap = priceCache?.exchangeRateMap;

  // 가장 최근 환율 찾기
  let latestExchangeRate = 1400; // 기본값
  if (exchangeRateMap && exchangeRateMap.size > 0) {
    const sortedFxDates = Array.from(exchangeRateMap.keys()).sort();
    const latestFxDate = sortedFxDates[sortedFxDates.length - 1];
    latestExchangeRate = exchangeRateMap.get(latestFxDate) || 1400;
  }

  // 계좌별 보유량 계산
  const accountHoldingsMap = new Map<string, Map<string, { qty: number; invested: number; currency: string; assetType: string }>>();

  transactions.forEach((tx) => {
    const accountId = tx.account_id || "unknown";
    if (!accountHoldingsMap.has(accountId)) {
      accountHoldingsMap.set(accountId, new Map());
    }
    const accountHoldings = accountHoldingsMap.get(accountId)!;
    const current = accountHoldings.get(tx.ticker) || { qty: 0, invested: 0, currency: tx.currency, assetType: tx.asset_type };

    if (tx.type === "buy") {
      current.qty += tx.quantity;
      current.invested += tx.quantity * tx.price;
    } else {
      const sellRatio = current.qty > 0 ? tx.quantity / current.qty : 0;
      current.qty -= tx.quantity;
      current.invested *= (1 - sellRatio);
    }
    accountHoldings.set(tx.ticker, current);
  });

  // 계좌별 평가액 계산 (원 단위)
  accountHoldingsMap.forEach((holdings, accountId) => {
    let accountValue = 0;

    holdings.forEach((h, ticker) => {
      if (h.qty > 0) {
        // 현재가 찾기
        let latestPrice = 0;
        if (priceDataMap) {
          const tickerPrices = priceDataMap.get(ticker);
          if (tickerPrices && tickerPrices.size > 0) {
            const sortedDates = Array.from(tickerPrices.keys()).sort();
            const latestDate = sortedDates[sortedDates.length - 1];
            latestPrice = tickerPrices.get(latestDate) || 0;
          }
        }

        if (latestPrice > 0) {
          // 해외주식(foreign_stock/foreign_etf) AND USD일 때만 환율 적용
          const isForeign = h.assetType === "foreign_stock" || h.assetType === "foreign_etf";
          if (isForeign && h.currency === "USD") {
            accountValue += h.qty * latestPrice * latestExchangeRate;
          } else {
            accountValue += h.qty * latestPrice;
          }
        } else {
          // 가격 데이터 없으면 투자금액 사용
          accountValue += h.invested;
        }
      }
    });

    const additionalAmount = accounts?.find(a => a.id === accountId)?.additional_amount || 0;
    investmentAccountValues.set(accountId, Math.round(accountValue + additionalAmount));
  });

  // 거래 없는 계좌도 추가금액이 있으면 포함
  if (accounts) {
    accounts.forEach(acc => {
      if (!investmentAccountValues.has(acc.id) && acc.additional_amount && acc.additional_amount > 0) {
        investmentAccountValues.set(acc.id, acc.additional_amount);
      }
    });
  }

  // 커스텀 종목 평가액 합산
  if (customHoldings) {
    customHoldings.forEach(ch => {
      const key = ch.account_id || "__unassigned__";
      const existing = investmentAccountValues.get(key) || 0;
      investmentAccountValues.set(key, existing + ch.current_value);
    });
  }

  return investmentAccountValues;
}

/**
 * 계좌별 포트폴리오 상세 정보 계산 (평가액 + 투자금액)
 * CurrentAssetTab에서 사용하는 상세 버전
 */
export interface AccountValueDetail {
  broker: string;
  accountName: string;
  value: number;      // 평가액 (원)
  invested: number;   // 투자금액 (원)
  accountType: string;
}

export function calculatePortfolioAccountValuesDetailed(
  transactions: PortfolioTransaction[],
  priceCache: PortfolioPriceCache | null | undefined,
  accounts: { id: string; broker_name: string | null; name: string; account_type: string; additional_amount?: number | null }[],
  customHoldings?: CustomHolding[]
): Map<string, AccountValueDetail> {
  const values = new Map<string, AccountValueDetail>();

  // 가장 최근 환율 찾기
  let latestExchangeRate = 1400;
  if (priceCache?.exchangeRateMap && priceCache.exchangeRateMap.size > 0) {
    const sortedFxDates = Array.from(priceCache.exchangeRateMap.keys()).sort();
    const latestFxDate = sortedFxDates[sortedFxDates.length - 1];
    latestExchangeRate = priceCache.exchangeRateMap.get(latestFxDate) || 1400;
  }

  // 계좌별 보유량 계산
  const accountHoldingsMap = new Map<string, Map<string, { qty: number; invested: number; currency: string; assetType: string }>>();

  transactions.forEach((tx) => {
    const accountId = tx.account_id || "unknown";
    if (!accountHoldingsMap.has(accountId)) {
      accountHoldingsMap.set(accountId, new Map());
    }
    const accountHoldings = accountHoldingsMap.get(accountId)!;
    const current = accountHoldings.get(tx.ticker) || { qty: 0, invested: 0, currency: tx.currency, assetType: tx.asset_type };

    if (tx.type === "buy") {
      current.qty += tx.quantity;
      current.invested += tx.quantity * tx.price;
    } else {
      const sellRatio = current.qty > 0 ? tx.quantity / current.qty : 0;
      current.qty -= tx.quantity;
      current.invested *= (1 - sellRatio);
    }
    accountHoldings.set(tx.ticker, current);
  });

  // 증권 계좌 타입 목록
  const SECURITIES_ACCOUNT_TYPES = ["general", "isa", "pension_savings", "irp", "dc"];

  // 모든 증권 계좌를 먼저 추가 (거래 없어도 표시)
  accounts
    .filter(acc => SECURITIES_ACCOUNT_TYPES.includes(acc.account_type))
    .forEach(account => {
      const additionalAmount = account.additional_amount || 0;
      values.set(account.id, {
        broker: account.broker_name || "기타",
        accountName: account.name || "계좌",
        value: additionalAmount,
        invested: 0,
        accountType: account.account_type,
      });
    });

  // 계좌별 평가금액 계산
  accountHoldingsMap.forEach((holdings, accountId) => {
    let totalInvested = 0;
    let totalValue = 0;

    holdings.forEach((h, ticker) => {
      if (h.qty > 0) {
        totalInvested += h.invested;

        // 현재가 찾기
        let latestPrice = 0;
        if (priceCache?.priceDataMap) {
          const tickerPrices = priceCache.priceDataMap.get(ticker);
          if (tickerPrices && tickerPrices.size > 0) {
            const sortedDates = Array.from(tickerPrices.keys()).sort();
            const latestDate = sortedDates[sortedDates.length - 1];
            latestPrice = tickerPrices.get(latestDate) || 0;
          }
        }

        if (latestPrice > 0) {
          // 해외주식(foreign_stock/foreign_etf) AND USD일 때만 환율 적용
          const isForeign = h.assetType === "foreign_stock" || h.assetType === "foreign_etf";
          if (isForeign && h.currency === "USD") {
            totalValue += h.qty * latestPrice * latestExchangeRate;
          } else {
            totalValue += h.qty * latestPrice;
          }
        } else {
          // 가격 데이터 없으면 투자금액 사용
          totalValue += h.invested;
        }
      }
    });

    const account = accounts.find(a => a.id === accountId);
    const broker = account?.broker_name || "기타";
    const accountName = account?.name || "계좌";
    const accountType = account?.account_type || "general";

    if (totalInvested > 0 || totalValue > 0) {
      const additionalAmount = account?.additional_amount || 0;
      values.set(accountId, {
        broker,
        accountName,
        value: (totalValue || totalInvested) + additionalAmount,
        invested: totalInvested,
        accountType,
      });
    }
  });

  // 커스텀 종목 평가액 및 투자금액 합산
  if (customHoldings) {
    customHoldings.forEach(ch => {
      const key = ch.account_id || "__unassigned__";
      const existing = values.get(key);
      if (existing) {
        existing.value += ch.current_value;
        existing.invested += ch.principal;
      } else {
        const account = accounts.find(a => a.id === key);
        values.set(key, {
          broker: account?.broker_name || "기타",
          accountName: account?.name || "직접입력",
          value: ch.current_value,
          invested: ch.principal,
          accountType: account?.account_type || "general",
        });
      }
    });
  }

  return values;
}
