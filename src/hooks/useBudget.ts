'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getBudgetCategories,
  getBudgetTransactions,
  createBudgetTransaction,
  updateBudgetTransaction,
  deleteBudgetTransaction,
  getMonthlySummaryByCategory,
  type BudgetTransactionInput,
  type TransactionType,
} from '@/lib/services/budgetService'

// Query Keys
export const budgetKeys = {
  all: ['budget'] as const,
  categories: (profileId: string) => [...budgetKeys.all, 'categories', profileId] as const,
  transactions: (profileId: string, year: number, month: number) =>
    [...budgetKeys.all, 'transactions', profileId, year, month] as const,
  summary: (profileId: string, year: number, month: number, type: TransactionType) =>
    [...budgetKeys.all, 'summary', profileId, year, month, type] as const,
}

// 카테고리 조회 훅
export function useBudgetCategories(profileId: string, type?: TransactionType) {
  return useQuery({
    queryKey: budgetKeys.categories(profileId),
    queryFn: () => getBudgetCategories(profileId, type),
    enabled: !!profileId,
  })
}

// 거래 조회 훅 (월별)
export function useBudgetTransactions(
  profileId: string,
  year: number,
  month: number
) {
  return useQuery({
    queryKey: budgetKeys.transactions(profileId, year, month),
    queryFn: () => getBudgetTransactions(profileId, year, month),
    enabled: !!profileId && !!year && !!month,
  })
}

// 카테고리별 요약 훅
export function useMonthlySummary(
  profileId: string,
  year: number,
  month: number,
  type: TransactionType
) {
  return useQuery({
    queryKey: budgetKeys.summary(profileId, year, month, type),
    queryFn: () => getMonthlySummaryByCategory(profileId, year, month, type),
    enabled: !!profileId && !!year && !!month,
  })
}

// 거래 생성 mutation
export function useCreateTransaction(profileId: string, year: number, month: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: BudgetTransactionInput) => createBudgetTransaction(input),
    onSuccess: () => {
      // 거래 목록과 요약 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: budgetKeys.transactions(profileId, year, month),
      })
      queryClient.invalidateQueries({
        queryKey: budgetKeys.summary(profileId, year, month, 'expense'),
      })
      queryClient.invalidateQueries({
        queryKey: budgetKeys.summary(profileId, year, month, 'income'),
      })
    },
  })
}

// 거래 수정 mutation
export function useUpdateTransaction(profileId: string, year: number, month: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BudgetTransactionInput> }) =>
      updateBudgetTransaction(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: budgetKeys.transactions(profileId, year, month),
      })
      queryClient.invalidateQueries({
        queryKey: budgetKeys.summary(profileId, year, month, 'expense'),
      })
      queryClient.invalidateQueries({
        queryKey: budgetKeys.summary(profileId, year, month, 'income'),
      })
    },
  })
}

// 거래 삭제 mutation
export function useDeleteTransaction(profileId: string, year: number, month: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteBudgetTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: budgetKeys.transactions(profileId, year, month),
      })
      queryClient.invalidateQueries({
        queryKey: budgetKeys.summary(profileId, year, month, 'expense'),
      })
      queryClient.invalidateQueries({
        queryKey: budgetKeys.summary(profileId, year, month, 'income'),
      })
    },
  })
}
