'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FinancialItem } from '@/types'
import type { FinancialSnapshotInput } from '@/types/tables'
import { loadFinancialItemsFromDB, type SimulationProfile } from '@/lib/services/dbToFinancialItems'
import { getIncomes } from '@/lib/services/incomeService'
import { getExpenses } from '@/lib/services/expenseService'
import { getSavings } from '@/lib/services/savingsService'
import { getDebts } from '@/lib/services/debtService'
import { getInsurances } from '@/lib/services/insuranceService'
import { getPhysicalAssets } from '@/lib/services/physicalAssetService'
import { getRealEstates } from '@/lib/services/realEstateService'
import { getNationalPensions } from '@/lib/services/nationalPensionService'
import { getRetirementPensions } from '@/lib/services/retirementPensionService'
import { getPersonalPensions } from '@/lib/services/personalPensionService'
import {
  getSnapshots,
  getOrCreateTodaySnapshot,
  getSnapshotItems,
  createSnapshot,
  createSnapshotItem,
  updateSnapshot,
  updateSnapshotItem,
  deleteSnapshot,
  deleteSnapshotItem,
  recalculateSnapshotSummary,
} from '@/lib/services/snapshotService'
import type { FinancialSnapshotItemInput } from '@/types/tables'
import { simulationService } from '@/lib/services/simulationService'
import { createClient } from '@/lib/supabase/client'
import { getStockData, getExchangeRate } from '@/lib/services/financeApiService'
import type { PortfolioTransaction, PortfolioAssetType, PortfolioCurrency } from '@/types/tables'

// Query Keys
export const financialKeys = {
  all: ['financial'] as const,
  items: (simulationId: string) => [...financialKeys.all, 'items', simulationId] as const,
  incomes: (simulationId: string) => [...financialKeys.all, 'incomes', simulationId] as const,
  expenses: (simulationId: string) => [...financialKeys.all, 'expenses', simulationId] as const,
  savings: (simulationId: string) => [...financialKeys.all, 'savings', simulationId] as const,
  debts: (simulationId: string) => [...financialKeys.all, 'debts', simulationId] as const,
  insurances: (simulationId: string) => [...financialKeys.all, 'insurances', simulationId] as const,
  physicalAssets: (simulationId: string) => [...financialKeys.all, 'physicalAssets', simulationId] as const,
  realEstates: (simulationId: string) => [...financialKeys.all, 'realEstates', simulationId] as const,
  nationalPensions: (simulationId: string) => [...financialKeys.all, 'nationalPensions', simulationId] as const,
  retirementPensions: (simulationId: string) => [...financialKeys.all, 'retirementPensions', simulationId] as const,
  personalPensions: (simulationId: string) => [...financialKeys.all, 'personalPensions', simulationId] as const,
}

// ============================================
// 연동 관계 기반 캐시 무효화 맵
// ============================================

/**
 * 데이터 수정 시 함께 무효화해야 할 캐시 목록
 * - 부동산 → 부채, 소득, 지출 연동
 * - 부채 → 지출 연동
 * - 연금 → 소득 연동
 * - 실물자산 → 부채 연동
 */
const INVALIDATION_MAP = {
  realEstates: ['realEstates', 'debts', 'incomes', 'expenses', 'items'],
  debts: ['debts', 'expenses', 'items'],
  insurances: ['insurances', 'expenses', 'items'],
  nationalPensions: ['nationalPensions', 'incomes', 'items'],
  retirementPensions: ['retirementPensions', 'incomes', 'items'],
  personalPensions: ['personalPensions', 'incomes', 'items'],
  physicalAssets: ['physicalAssets', 'debts', 'items'],
  savings: ['savings', 'items'],
  incomes: ['incomes', 'items'],
  expenses: ['expenses', 'items'],
} as const

export type InvalidationCategory = keyof typeof INVALIDATION_MAP

/**
 * 전체 재무 데이터 로드 훅
 * - 캐싱: 5분간 stale 아님
 * - 탭 전환 시 캐시된 데이터 즉시 표시
 */
export function useFinancialItems(
  simulationId: string,
  profile: SimulationProfile,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: financialKeys.items(simulationId),
    queryFn: () => loadFinancialItemsFromDB(simulationId, profile),
    enabled: enabled && !!simulationId,
    // 기본 설정은 QueryProvider에서 상속
  })
}

/**
 * 재무 데이터 캐시 무효화 훅
 * - 데이터 변경 후 호출하면 다음 접근 시 새로 로드
 */
export function useInvalidateFinancialData() {
  const queryClient = useQueryClient()

  return {
    // 전체 재무 데이터 무효화
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.all })
    },
    // 특정 시뮬레이션 데이터만 무효화
    invalidateItems: (simulationId: string) => {
      queryClient.invalidateQueries({ queryKey: financialKeys.items(simulationId) })
    },
  }
}

/**
 * 연동 관계 기반 선택적 캐시 무효화 훅
 * - 데이터 수정 시 연동된 데이터만 무효화
 * - 예: 부채 수정 → 부채 + 지출 + items 캐시 무효화
 */
export function useInvalidateByCategory(simulationId: string) {
  const queryClient = useQueryClient()

  return (category: InvalidationCategory) => {
    const keysToInvalidate = INVALIDATION_MAP[category]

    keysToInvalidate.forEach(key => {
      if (key === 'items') {
        queryClient.invalidateQueries({ queryKey: financialKeys.items(simulationId) })
      } else {
        const keyFn = financialKeys[key as keyof Omit<typeof financialKeys, 'all'>]
        if (typeof keyFn === 'function') {
          queryClient.invalidateQueries({ queryKey: keyFn(simulationId) })
        }
      }
    })
  }
}

/**
 * 모든 재무 데이터 Prefetch 훅
 * - DashboardContent에서 호출하면 모든 데이터를 한 번에 로드
 * - 이후 탭 전환 시 캐시된 데이터 즉시 사용
 */
export function usePrefetchAllFinancialData(simulationId: string) {
  // 모든 개별 데이터 로드 (React Query가 병렬로 처리)
  useIncomes(simulationId)
  useExpenses(simulationId)
  useSavingsData(simulationId)
  useDebts(simulationId)
  useInsurances(simulationId)
  usePhysicalAssets(simulationId)
  useRealEstates(simulationId)
  useNationalPensions(simulationId)
  useRetirementPensions(simulationId)
  usePersonalPensions(simulationId)
}

// ============================================
// 개별 테이블 훅 (CashFlowOverviewTab 등에서 사용)
// ============================================

/**
 * 소득 데이터 로드 훅
 */
export function useIncomes(simulationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: financialKeys.incomes(simulationId),
    queryFn: () => getIncomes(simulationId),
    enabled: enabled && !!simulationId,
  })
}

/**
 * 지출 데이터 로드 훅
 */
export function useExpenses(simulationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: financialKeys.expenses(simulationId),
    queryFn: () => getExpenses(simulationId),
    enabled: enabled && !!simulationId,
  })
}

/**
 * 개인연금 데이터 로드 훅
 */
export function usePersonalPensions(simulationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: financialKeys.personalPensions(simulationId),
    queryFn: () => getPersonalPensions(simulationId),
    enabled: enabled && !!simulationId,
  })
}

/**
 * 저축 데이터 로드 훅
 */
export function useSavingsData(simulationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: financialKeys.savings(simulationId),
    queryFn: () => getSavings(simulationId),
    enabled: enabled && !!simulationId,
  })
}

/**
 * 부채 데이터 로드 훅
 */
export function useDebts(simulationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: financialKeys.debts(simulationId),
    queryFn: () => getDebts(simulationId),
    enabled: enabled && !!simulationId,
  })
}

/**
 * 보험 데이터 로드 훅
 */
export function useInsurances(simulationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: financialKeys.insurances(simulationId),
    queryFn: () => getInsurances(simulationId),
    enabled: enabled && !!simulationId,
  })
}

/**
 * 실물자산 데이터 로드 훅
 */
export function usePhysicalAssets(simulationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: financialKeys.physicalAssets(simulationId),
    queryFn: () => getPhysicalAssets(simulationId),
    enabled: enabled && !!simulationId,
  })
}

/**
 * 부동산 데이터 로드 훅
 */
export function useRealEstates(simulationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: financialKeys.realEstates(simulationId),
    queryFn: () => getRealEstates(simulationId),
    enabled: enabled && !!simulationId,
  })
}

/**
 * 국민연금 데이터 로드 훅
 */
export function useNationalPensions(simulationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: financialKeys.nationalPensions(simulationId),
    queryFn: () => getNationalPensions(simulationId),
    enabled: enabled && !!simulationId,
  })
}

/**
 * 퇴직연금 데이터 로드 훅
 */
export function useRetirementPensions(simulationId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: financialKeys.retirementPensions(simulationId),
    queryFn: () => getRetirementPensions(simulationId),
    enabled: enabled && !!simulationId,
  })
}

// ============================================
// 스냅샷 (Financial Snapshots) 훅
// ============================================

export const snapshotKeys = {
  all: ['snapshots'] as const,
  list: (profileId: string) => [...snapshotKeys.all, 'list', profileId] as const,
  today: (profileId: string) => [...snapshotKeys.all, 'today', profileId] as const,
  items: (snapshotId: string) => [...snapshotKeys.all, 'items', snapshotId] as const,
}

/**
 * 스냅샷 목록 로드 훅
 */
export function useSnapshots(profileId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: snapshotKeys.list(profileId),
    queryFn: () => getSnapshots(profileId),
    enabled: enabled && !!profileId,
  })
}

/**
 * 오늘 날짜 스냅샷 로드 훅 (없으면 생성)
 */
export function useTodaySnapshot(profileId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: snapshotKeys.today(profileId),
    queryFn: () => getOrCreateTodaySnapshot(profileId),
    enabled: enabled && !!profileId,
  })
}

/**
 * 스냅샷 항목 로드 훅
 */
export function useSnapshotItems(snapshotId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: snapshotKeys.items(snapshotId || ''),
    queryFn: () => getSnapshotItems(snapshotId!),
    enabled: enabled && !!snapshotId,
  })
}

/**
 * 스냅샷 아이템 생성 훅
 */
export function useCreateSnapshotItem(profileId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: FinancialSnapshotItemInput) => {
      const item = await createSnapshotItem(input)
      // 요약 재계산
      await recalculateSnapshotSummary(input.snapshot_id)
      return item
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: snapshotKeys.items(variables.snapshot_id) })
      queryClient.invalidateQueries({ queryKey: snapshotKeys.today(profileId) })
      queryClient.invalidateQueries({ queryKey: snapshotKeys.list(profileId) })
    },
  })
}

/**
 * 스냅샷 아이템 수정 훅
 */
export function useUpdateSnapshotItem(profileId: string, snapshotId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FinancialSnapshotItemInput> }) => {
      const item = await updateSnapshotItem(id, updates)
      // 요약 재계산
      await recalculateSnapshotSummary(snapshotId)
      return item
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snapshotKeys.items(snapshotId) })
      queryClient.invalidateQueries({ queryKey: snapshotKeys.today(profileId) })
      queryClient.invalidateQueries({ queryKey: snapshotKeys.list(profileId) })
    },
  })
}

/**
 * 스냅샷 아이템 삭제 훅
 */
export function useDeleteSnapshotItem(profileId: string, snapshotId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteSnapshotItem(id)
      // 요약 재계산
      await recalculateSnapshotSummary(snapshotId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snapshotKeys.items(snapshotId) })
      queryClient.invalidateQueries({ queryKey: snapshotKeys.today(profileId) })
      queryClient.invalidateQueries({ queryKey: snapshotKeys.list(profileId) })
    },
  })
}

/**
 * 스냅샷 생성 훅
 */
export function useCreateSnapshot(profileId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<FinancialSnapshotInput, 'profile_id'>) =>
      createSnapshot({ ...input, profile_id: profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snapshotKeys.list(profileId) })
    },
  })
}

/**
 * 스냅샷 수정 훅
 */
export function useUpdateSnapshot(profileId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<FinancialSnapshotInput> }) =>
      updateSnapshot(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snapshotKeys.list(profileId) })
    },
  })
}

/**
 * 스냅샷 삭제 훅
 */
export function useDeleteSnapshot(profileId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteSnapshot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snapshotKeys.list(profileId) })
    },
  })
}

// ============================================
// 시뮬레이션 (Simulations/Scenarios) 훅
// ============================================

export const simulationKeys = {
  all: ['simulations'] as const,
  list: () => [...simulationKeys.all, 'list'] as const,
}

/**
 * 사용자의 모든 시뮬레이션(시나리오) 목록 로드 훅
 */
export function useSimulations(enabled: boolean = true) {
  return useQuery({
    queryKey: simulationKeys.list(),
    queryFn: () => simulationService.getAll(),
    enabled,
  })
}

// ============================================
// 포트폴리오 (Portfolio) 훅
// ============================================

export const portfolioKeys = {
  all: ['portfolio'] as const,
  transactions: (profileId: string) => [...portfolioKeys.all, 'transactions', profileId] as const,
  value: (profileId: string) => [...portfolioKeys.all, 'value', profileId] as const,
  chartPriceData: (profileId: string) => [...portfolioKeys.all, 'chartPriceData', profileId] as const,
}

interface PortfolioHolding {
  ticker: string
  name: string
  asset_type: PortfolioAssetType
  quantity: number
  avg_price: number
  total_invested: number
  currency: PortfolioCurrency
}

/**
 * 포트폴리오 거래 내역 로드 훅
 */
export function usePortfolioTransactions(profileId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: portfolioKeys.transactions(profileId),
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('portfolio_transactions')
        .select('*')
        .eq('profile_id', profileId)
        .order('trade_date', { ascending: false })

      if (error) throw error
      return data as PortfolioTransaction[]
    },
    enabled: enabled && !!profileId,
  })
}

/**
 * 포트폴리오 총 평가금액 로드 훅
 * - 거래 내역 → 보유 종목 계산 → 현재가 조회 → 총액 반환
 */
export function usePortfolioValue(profileId: string, enabled: boolean = true) {
  const { data: transactions = [], isLoading: txLoading } = usePortfolioTransactions(profileId, enabled)

  return useQuery({
    queryKey: portfolioKeys.value(profileId),
    queryFn: async () => {
      if (transactions.length === 0) {
        return { totalValue: 0, totalInvested: 0, holdings: [] }
      }

      // 보유 종목 계산
      const holdingsMap = new Map<string, PortfolioHolding>()

      transactions.forEach((tx) => {
        const key = tx.ticker
        const existing = holdingsMap.get(key)
        const txTotalWon = tx.quantity * tx.price

        if (!existing) {
          if (tx.type === 'buy') {
            holdingsMap.set(key, {
              ticker: tx.ticker,
              name: tx.name,
              asset_type: tx.asset_type as PortfolioAssetType,
              quantity: tx.quantity,
              avg_price: tx.price,
              total_invested: txTotalWon,
              currency: tx.currency as PortfolioCurrency,
            })
          }
        } else {
          if (tx.type === 'buy') {
            const newTotalQty = existing.quantity + tx.quantity
            const newTotalInvested = existing.total_invested + txTotalWon
            existing.avg_price = newTotalInvested / newTotalQty
            existing.quantity = newTotalQty
            existing.total_invested = newTotalInvested
          } else {
            existing.quantity -= tx.quantity
            const sellRatio = tx.quantity / (existing.quantity + tx.quantity)
            existing.total_invested *= (1 - sellRatio)
          }
        }
      })

      const holdings = Array.from(holdingsMap.values()).filter((h) => h.quantity > 0)

      if (holdings.length === 0) {
        return { totalValue: 0, totalInvested: 0, holdings: [] }
      }

      // 환율 조회 (해외 종목이 있는 경우)
      const hasForeign = holdings.some(
        (h) => h.asset_type === 'foreign_stock' || h.asset_type === 'foreign_etf'
      )

      let exchangeRate = 1
      if (hasForeign) {
        try {
          const fxRes = await getExchangeRate('USDKRW', { days: 5 })
          if (fxRes.data.length > 0) {
            exchangeRate = fxRes.data[fxRes.data.length - 1].Close
          }
        } catch {
          exchangeRate = 1400 // fallback
        }
      }

      // 현재가 조회 및 총액 계산
      let totalValue = 0
      const totalInvested = holdings.reduce((sum, h) => sum + h.total_invested, 0)

      const pricePromises = holdings.map(async (holding) => {
        try {
          const res = await getStockData(holding.ticker, { days: 5 })
          if (res.data.length > 0) {
            return { ticker: holding.ticker, price: res.data[res.data.length - 1].Close, success: true }
          }
          return { ticker: holding.ticker, price: 0, success: false }
        } catch {
          return { ticker: holding.ticker, price: 0, success: false }
        }
      })

      const priceResults = await Promise.all(pricePromises)

      priceResults.forEach((result, idx) => {
        const holding = holdings[idx]
        if (result.success) {
          const isForeign = holding.asset_type === 'foreign_stock' || holding.asset_type === 'foreign_etf'
          const holdingValue = isForeign && holding.currency === 'USD'
            ? holding.quantity * result.price * exchangeRate
            : holding.quantity * result.price
          totalValue += holdingValue
        } else {
          totalValue += holding.total_invested
        }
      })

      return { totalValue, totalInvested, holdings }
    },
    enabled: enabled && !!profileId && !txLoading && transactions.length > 0,
    staleTime: 1000 * 60 * 5, // 5분간 fresh 유지
  })
}

/**
 * 포트폴리오 차트용 주가 데이터 캐싱 훅
 * - 거래 내역의 모든 종목에 대한 과거 주가를 한 번만 로드
 * - 탭 전환 시에도 캐시 유지 (5분)
 */
export interface PortfolioPriceCache {
  priceDataMap: Map<string, Map<string, number>>
  exchangeRateMap: Map<string, number>
  tickerCurrencyMap: Map<string, string>
  dates: string[]
}

export function usePortfolioChartPriceData(
  profileId: string,
  transactions: PortfolioTransaction[],
  enabled: boolean = true
) {
  return useQuery({
    queryKey: portfolioKeys.chartPriceData(profileId),
    queryFn: async (): Promise<PortfolioPriceCache> => {
      if (transactions.length === 0) {
        return {
          priceDataMap: new Map(),
          exchangeRateMap: new Map(),
          tickerCurrencyMap: new Map(),
          dates: [],
        }
      }

      // 전체 거래 내역 정렬
      const sortedTx = [...transactions].sort(
        (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
      )

      const firstDate = sortedTx[0].trade_date
      const today = new Date().toISOString().split('T')[0]

      // 고유 티커 목록 + 통화 정보
      const tickerCurrencyMap = new Map<string, string>()
      transactions.forEach((tx) => {
        if (!tickerCurrencyMap.has(tx.ticker)) {
          tickerCurrencyMap.set(tx.ticker, tx.currency)
        }
      })
      const tickers = [...tickerCurrencyMap.keys()]

      // 해외주식 있는지 확인
      const hasForeignStock = [...tickerCurrencyMap.values()].some((c) => c === 'USD')

      // 첫 거래일부터 오늘까지 전체 기간
      const diffDays = Math.ceil(
        (new Date().getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      const fetchDays = diffDays + 30

      // 주가 데이터 + 환율 병렬 fetch
      const priceDataMap = new Map<string, Map<string, number>>()
      const exchangeRateMap = new Map<string, number>()

      const stockPromises = tickers.map(async (ticker) => {
        try {
          const res = await getStockData(ticker, { days: fetchDays })
          const tickerPrices = new Map<string, number>()
          res.data.forEach((d) => {
            tickerPrices.set(d.Date, d.Close)
          })
          return { ticker, prices: tickerPrices }
        } catch {
          return { ticker, prices: new Map<string, number>() }
        }
      })

      const fxPromise = hasForeignStock
        ? getExchangeRate('USDKRW', { days: fetchDays })
            .then((res) => {
              res.data.forEach((d) => {
                exchangeRateMap.set(d.Date, d.Close)
              })
            })
            .catch(() => {
              console.log('환율 데이터 로드 실패, 기본 환율 사용')
            })
        : Promise.resolve()

      const [stockResults] = await Promise.all([Promise.all(stockPromises), fxPromise])

      stockResults.forEach(({ ticker, prices }) => {
        priceDataMap.set(ticker, prices)
      })

      // 날짜 범위 생성 (첫 거래일 ~ 오늘)
      const dates: string[] = []
      const current = new Date(firstDate)
      const end = new Date(today)

      while (current <= end) {
        dates.push(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 1)
      }

      return {
        priceDataMap,
        exchangeRateMap,
        tickerCurrencyMap,
        dates,
      }
    },
    enabled: enabled && !!profileId && transactions.length > 0,
    staleTime: 1000 * 60 * 5, // 5분간 fresh 유지
  })
}
