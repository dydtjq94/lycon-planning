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
