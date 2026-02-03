'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getBudgetCategories,
  getBudgetTransactions,
  createBudgetTransaction,
  updateBudgetTransaction,
  deleteBudgetTransaction,
  getMonthlySummaryByCategory,
  getAllAccounts,
  getBankAccounts,
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
  accounts: (profileId: string) => [...budgetKeys.all, 'accounts', profileId] as const,
  bankAccounts: (profileId: string) => [...budgetKeys.all, 'bankAccounts', profileId] as const,
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

// 거래 생성 mutation (낙관적 업데이트 포함)
export function useCreateTransaction(profileId: string, year: number, month: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: BudgetTransactionInput) => createBudgetTransaction(input),
    // 낙관적 업데이트: 백엔드 응답 전에 UI 먼저 반영
    onMutate: async (newTransaction) => {
      // 진행 중인 쿼리 취소 (낙관적 업데이트 덮어쓰기 방지)
      await queryClient.cancelQueries({
        queryKey: budgetKeys.transactions(profileId, year, month),
      })

      // 이전 데이터 스냅샷 저장 (롤백용)
      const previousTransactions = queryClient.getQueryData(
        budgetKeys.transactions(profileId, year, month)
      )

      // 임시 ID로 낙관적 업데이트
      const optimisticTransaction = {
        ...newTransaction,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sort_order: 0,
      }

      queryClient.setQueryData(
        budgetKeys.transactions(profileId, year, month),
        (old: unknown[] | undefined) => old ? [optimisticTransaction, ...old] : [optimisticTransaction]
      )

      return { previousTransactions }
    },
    // 에러 시 롤백
    onError: (_err, _newTransaction, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(
          budgetKeys.transactions(profileId, year, month),
          context.previousTransactions
        )
      }
    },
    // 성공/실패 후 최신 데이터로 동기화
    onSettled: () => {
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

// 모든 계좌 조회 훅 (증권 + 은행)
export function useAllAccounts(profileId: string) {
  return useQuery({
    queryKey: budgetKeys.accounts(profileId),
    queryFn: () => getAllAccounts(profileId),
    enabled: !!profileId,
  })
}

// 은행 계좌만 조회 훅 (입출금, 저축, 예금)
export function useBankAccounts(profileId: string) {
  return useQuery({
    queryKey: budgetKeys.bankAccounts(profileId),
    queryFn: () => getBankAccounts(profileId),
    enabled: !!profileId,
  })
}
