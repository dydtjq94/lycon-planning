'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FinancialItem } from '@/types'
import type { FinancialSnapshotInput } from '@/types/tables'
import { loadFinancialItemsFromDB, type SimulationProfile } from '@/lib/services/dbToFinancialItems'
import type { SimulationV2Input } from '@/lib/services/simulationEngineV2'
import { getIncomes } from '@/lib/services/incomeService'
import { getExpenses } from '@/lib/services/expenseService'
import { getSavings } from '@/lib/services/savingsService'
import { getDebts } from '@/lib/services/debtService'
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
} from '@/lib/services/snapshotService'
import type { FinancialSnapshotItemInput, FinancialSnapshotItem } from '@/types/tables'
import { simulationService } from '@/lib/services/simulationService'
import { createClient } from '@/lib/supabase/client'
import { getStockData, getExchangeRate } from '@/lib/services/financeApiService'
import type { PortfolioTransaction, PortfolioAssetType, PortfolioCurrency, FinancialSnapshot } from '@/types/tables'
import { wonToManwon, manwonToWon } from '@/lib/utils'

// Query Keys
export const financialKeys = {
  all: ['financial'] as const,
  items: (simulationId: string) => [...financialKeys.all, 'items', simulationId] as const,
  incomes: (simulationId: string) => [...financialKeys.all, 'incomes', simulationId] as const,
  expenses: (simulationId: string) => [...financialKeys.all, 'expenses', simulationId] as const,
  savings: (simulationId: string) => [...financialKeys.all, 'savings', simulationId] as const,
  debts: (simulationId: string) => [...financialKeys.all, 'debts', simulationId] as const,
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
 * V2 엔진이 각 테이블에서 직접 계산하므로 연동 없음
 */
const INVALIDATION_MAP = {
  realEstates: ['realEstates', 'items'],
  debts: ['debts', 'items'],
  nationalPensions: ['nationalPensions', 'items'],
  retirementPensions: ['retirementPensions', 'items'],
  personalPensions: ['personalPensions', 'items'],
  physicalAssets: ['physicalAssets', 'items'],
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
  usePhysicalAssets(simulationId)
  useRealEstates(simulationId)
  useNationalPensions(simulationId)
  useRetirementPensions(simulationId)
  usePersonalPensions(simulationId)
}

/**
 * V2 시뮬레이션 입력 데이터 훅
 * - 기존 9개 개별 훅을 조합하여 SimulationV2Input 반환
 * - React Query 캐시 재활용, 개별 테이블 변경 시 해당 캐시만 무효화
 */
export function useSimulationV2Data(simulationId: string, enabled: boolean = true) {
  const { data: incomes = [], isLoading: l1 } = useIncomes(simulationId, enabled)
  const { data: expenses = [], isLoading: l2 } = useExpenses(simulationId, enabled)
  const { data: savings = [], isLoading: l3 } = useSavingsData(simulationId, enabled)
  const { data: debts = [], isLoading: l4 } = useDebts(simulationId, enabled)
  const { data: nationalPensions = [], isLoading: l5 } = useNationalPensions(simulationId, enabled)
  const { data: retirementPensions = [], isLoading: l6 } = useRetirementPensions(simulationId, enabled)
  const { data: personalPensions = [], isLoading: l7 } = usePersonalPensions(simulationId, enabled)
  const { data: realEstates = [], isLoading: l8 } = useRealEstates(simulationId, enabled)
  const { data: physicalAssets = [], isLoading: l9 } = usePhysicalAssets(simulationId, enabled)

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9

  const data: SimulationV2Input = useMemo(() => ({
    incomes, expenses, savings, debts,
    nationalPensions, retirementPensions, personalPensions,
    realEstates, physicalAssets,
  }), [incomes, expenses, savings, debts, nationalPensions, retirementPensions, personalPensions, realEstates, physicalAssets])

  return { data, isLoading }
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

// ============================================
// 금액 단위 변환 헬퍼 (원 ↔ 만원)
// DB는 원 단위, 클라이언트는 만원 단위 사용
// ============================================

// metadata 내 금액 필드 목록
const MONEY_METADATA_FIELDS = [
  'loan_amount', 'purchase_price', 'current_value',
  'monthly_rent', 'maintenance_fee'
]

// metadata에서 금액 필드를 원 → 만원 변환
function convertMetadataFromWon(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!metadata) return {}
  const result = { ...metadata }
  for (const field of MONEY_METADATA_FIELDS) {
    if (typeof result[field] === 'number') {
      result[field] = wonToManwon(result[field] as number)
    }
  }
  return result
}

// metadata에서 금액 필드를 만원 → 원 변환
function convertMetadataToWon(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!metadata) return {}
  const result = { ...metadata }
  for (const field of MONEY_METADATA_FIELDS) {
    if (typeof result[field] === 'number') {
      result[field] = manwonToWon(result[field] as number)
    }
  }
  return result
}

// snapshot item을 원 → 만원 변환 (DB → 클라이언트)
function convertSnapshotItemFromWon(item: FinancialSnapshotItem): FinancialSnapshotItem {
  return {
    ...item,
    amount: wonToManwon(item.amount),
    metadata: convertMetadataFromWon(item.metadata)
  }
}

// snapshot 요약 필드를 원 → 만원 변환 (DB → 클라이언트)
function convertSnapshotFromWon(snapshot: FinancialSnapshot): FinancialSnapshot {
  return {
    ...snapshot,
    total_assets: wonToManwon(snapshot.total_assets || 0),
    total_debts: wonToManwon(snapshot.total_debts || 0),
    net_worth: wonToManwon(snapshot.net_worth || 0),
    savings: wonToManwon(snapshot.savings || 0),
    investments: wonToManwon(snapshot.investments || 0),
    real_estate: wonToManwon(snapshot.real_estate || 0),
    real_assets: wonToManwon(snapshot.real_assets || 0),
    unsecured_debt: wonToManwon(snapshot.unsecured_debt || 0),
  }
}

/**
 * 스냅샷 목록 로드 훅
 * DB에서 원 단위로 저장된 값을 만원 단위로 변환하여 반환
 */
export function useSnapshots(profileId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: snapshotKeys.list(profileId),
    queryFn: async () => {
      const snapshots = await getSnapshots(profileId)
      return snapshots.map(convertSnapshotFromWon)
    },
    enabled: enabled && !!profileId,
  })
}

/**
 * 오늘 날짜 스냅샷 로드 훅 (없으면 생성)
 * DB에서 원 단위로 저장된 값을 만원 단위로 변환하여 반환
 */
export function useTodaySnapshot(profileId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: snapshotKeys.today(profileId),
    queryFn: async () => {
      const snapshot = await getOrCreateTodaySnapshot(profileId)
      return convertSnapshotFromWon(snapshot)
    },
    enabled: enabled && !!profileId,
  })
}

/**
 * 스냅샷 항목 로드 훅
 * DB에서 원 단위로 저장된 값을 만원 단위로 변환하여 반환
 */
export function useSnapshotItems(snapshotId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: snapshotKeys.items(snapshotId || ''),
    queryFn: async () => {
      const items = await getSnapshotItems(snapshotId!)
      return items.map(convertSnapshotItemFromWon)
    },
    enabled: enabled && !!snapshotId,
  })
}

/**
 * 스냅샷 아이템 생성 훅
 * 클라이언트에서 만원 단위로 입력된 값을 원 단위로 변환하여 DB에 저장
 */
export function useCreateSnapshotItem(profileId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: FinancialSnapshotItemInput) => {
      // 만원 → 원 변환하여 저장
      const convertedInput: FinancialSnapshotItemInput = {
        ...input,
        amount: manwonToWon(input.amount || 0),
        metadata: convertMetadataToWon(input.metadata)
      }
      const item = await createSnapshotItem(convertedInput)
      // 요약 재계산은 프론트엔드에서 처리 (저축 연동 계좌, 포트폴리오 데이터 포함)
      return item
    },
    // Optimistic update: UI에 바로 표시 (만원 단위 유지)
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: snapshotKeys.items(newItem.snapshot_id) })
      const previousItems = queryClient.getQueryData<FinancialSnapshotItem[]>(snapshotKeys.items(newItem.snapshot_id))

      // 임시 ID로 바로 추가 (UI는 만원 단위)
      const optimisticItem: FinancialSnapshotItem = {
        id: `temp-${Date.now()}`,
        snapshot_id: newItem.snapshot_id,
        category: newItem.category,
        item_type: newItem.item_type,
        title: newItem.title || '',
        amount: newItem.amount || 0, // 만원 단위 유지
        owner: newItem.owner || 'self',
        metadata: newItem.metadata || {},
        sort_order: (previousItems?.length || 0),
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData<FinancialSnapshotItem[]>(
        snapshotKeys.items(newItem.snapshot_id),
        old => [...(old || []), optimisticItem]
      )

      return { previousItems }
    },
    onError: (_, variables, context) => {
      // 에러 시 롤백
      if (context?.previousItems) {
        queryClient.setQueryData(snapshotKeys.items(variables.snapshot_id), context.previousItems)
      }
    },
    onSettled: (_, __, variables) => {
      // 완료 후 실제 데이터로 갱신
      queryClient.invalidateQueries({ queryKey: snapshotKeys.items(variables.snapshot_id) })
      queryClient.invalidateQueries({ queryKey: snapshotKeys.today(profileId) })
      queryClient.invalidateQueries({ queryKey: snapshotKeys.list(profileId) })
    },
  })
}

/**
 * 스냅샷 아이템 수정 훅
 * 클라이언트에서 만원 단위로 입력된 값을 원 단위로 변환하여 DB에 저장
 */
export function useUpdateSnapshotItem(profileId: string, snapshotId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FinancialSnapshotItemInput> }) => {
      // 만원 → 원 변환하여 저장
      const convertedUpdates: Partial<FinancialSnapshotItemInput> = { ...updates }
      if (updates.amount !== undefined) {
        convertedUpdates.amount = manwonToWon(updates.amount)
      }
      if (updates.metadata) {
        convertedUpdates.metadata = convertMetadataToWon(updates.metadata)
      }
      const item = await updateSnapshotItem(id, convertedUpdates)
      // 요약 재계산은 프론트엔드에서 처리 (저축 연동 계좌, 포트폴리오 데이터 포함)
      return item
    },
    // Optimistic update: UI에 바로 반영 (만원 단위 유지)
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: snapshotKeys.items(snapshotId) })
      const previousItems = queryClient.getQueryData<FinancialSnapshotItem[]>(snapshotKeys.items(snapshotId))

      // 바로 수정 반영 (UI는 만원 단위)
      queryClient.setQueryData<FinancialSnapshotItem[]>(
        snapshotKeys.items(snapshotId),
        old => (old || []).map(item =>
          item.id === id ? { ...item, ...updates } : item
        )
      )

      return { previousItems }
    },
    onError: (_, __, context) => {
      // 에러 시 롤백
      if (context?.previousItems) {
        queryClient.setQueryData(snapshotKeys.items(snapshotId), context.previousItems)
      }
    },
    onSettled: () => {
      // 완료 후 실제 데이터로 갱신
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
      // 요약 재계산은 프론트엔드에서 처리 (저축 연동 계좌, 포트폴리오 데이터 포함)
    },
    // Optimistic update: UI에서 바로 제거
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: snapshotKeys.items(snapshotId) })
      const previousItems = queryClient.getQueryData<FinancialSnapshotItem[]>(snapshotKeys.items(snapshotId))

      // 바로 제거
      queryClient.setQueryData<FinancialSnapshotItem[]>(
        snapshotKeys.items(snapshotId),
        old => (old || []).filter(item => item.id !== id)
      )

      return { previousItems }
    },
    onError: (_, __, context) => {
      // 에러 시 롤백
      if (context?.previousItems) {
        queryClient.setQueryData(snapshotKeys.items(snapshotId), context.previousItems)
      }
    },
    onSettled: () => {
      // 완료 후 실제 데이터로 갱신
      queryClient.invalidateQueries({ queryKey: snapshotKeys.items(snapshotId) })
      queryClient.invalidateQueries({ queryKey: snapshotKeys.today(profileId) })
      queryClient.invalidateQueries({ queryKey: snapshotKeys.list(profileId) })
    },
  })
}

// 스냅샷 요약 필드를 만원 → 원 변환 (클라이언트 → DB)
function convertSnapshotInputToWon(input: Partial<FinancialSnapshotInput>): Partial<FinancialSnapshotInput> {
  const result = { ...input }
  if (input.total_assets !== undefined) result.total_assets = manwonToWon(input.total_assets)
  if (input.total_debts !== undefined) result.total_debts = manwonToWon(input.total_debts)
  if (input.net_worth !== undefined) result.net_worth = manwonToWon(input.net_worth)
  if (input.savings !== undefined) result.savings = manwonToWon(input.savings)
  if (input.investments !== undefined) result.investments = manwonToWon(input.investments)
  if (input.real_estate !== undefined) result.real_estate = manwonToWon(input.real_estate)
  if (input.real_assets !== undefined) result.real_assets = manwonToWon(input.real_assets)
  if (input.unsecured_debt !== undefined) result.unsecured_debt = manwonToWon(input.unsecured_debt)
  return result
}

/**
 * 스냅샷 생성 훅
 * 클라이언트에서 만원 단위로 입력된 값을 원 단위로 변환하여 DB에 저장
 */
export function useCreateSnapshot(profileId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<FinancialSnapshotInput, 'profile_id'>) => {
      // 만원 → 원 변환하여 저장
      const convertedInput = convertSnapshotInputToWon(input)
      return createSnapshot({ ...convertedInput, profile_id: profileId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snapshotKeys.list(profileId) })
    },
  })
}

/**
 * 스냅샷 수정 훅
 * 클라이언트에서 만원 단위로 입력된 값을 원 단위로 변환하여 DB에 저장
 */
export function useUpdateSnapshot(profileId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<FinancialSnapshotInput> }) => {
      // 만원 → 원 변환하여 저장
      const convertedUpdates = convertSnapshotInputToWon(updates)
      return updateSnapshot(id, convertedUpdates)
    },
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
export function useSimulations(profileId?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [...simulationKeys.list(), profileId],
    queryFn: () => simulationService.getAll(profileId),
    enabled,
  })
}

/**
 * 시뮬레이션 생성 훅
 */
export function useCreateSimulation(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { title: string; description?: string }) =>
      simulationService.create({
        title: input.title,
        description: input.description,
        ...(profileId ? { profile_id: profileId } : {}),
      }),
    onSuccess: async () => {
      // 시뮬레이션 목록 새로고침 (refetch 완료까지 대기)
      await queryClient.refetchQueries({ queryKey: simulationKeys.list() })
    },
  })
}

/**
 * 시뮬레이션 삭제 훅
 */
export function useDeleteSimulation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (simulationId: string) => simulationService.delete(simulationId),
    onSuccess: async () => {
      // 시뮬레이션 목록 새로고침 (refetch 완료까지 대기)
      await queryClient.refetchQueries({ queryKey: simulationKeys.list() })
    },
  })
}

/**
 * 시뮬레이션 업데이트 훅
 */
export function useUpdateSimulation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<{ title: string; description?: string; icon?: string; simulation_assumptions?: any; cash_flow_priorities?: any; life_cycle_settings?: any; family_config?: any }> }) =>
      simulationService.update(id, updates),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: simulationKeys.list() })
    },
  })
}

// ============================================
// 포트폴리오 (Portfolio) 훅
// ============================================

export const portfolioKeys = {
  all: ['portfolio'] as const,
  transactions: (profileId: string) => [...portfolioKeys.all, 'transactions', profileId] as const,
  value: (profileId: string) => [...portfolioKeys.all, 'value', profileId] as const,
  chartPriceData: (profileId: string, scopeKey?: string) => [...portfolioKeys.all, 'chartPriceData', profileId, scopeKey || 'all'] as const,
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
  enabled: boolean = true,
  scopeKey?: string,
) {
  return useQuery({
    queryKey: portfolioKeys.chartPriceData(profileId, scopeKey),
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
