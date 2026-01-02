'use client'

import { useState, useMemo, useCallback } from 'react'
import type {
  FinancialItem,
  FinancialItemInput,
  FinancialCategory,
} from '@/types'
import { financialItemService } from '@/lib/services/financialService'

/**
 * FinancialItem CRUD 훅
 * 시뮬레이션의 재무 항목을 관리합니다.
 */
export function useFinancialItems(
  simulationId: string,
  initialItems: FinancialItem[] = []
) {
  const [items, setItems] = useState<FinancialItem[]>(initialItems)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 카테고리별 필터링
  const incomes = useMemo(
    () => items.filter((i) => i.category === 'income'),
    [items]
  )
  const expenses = useMemo(
    () => items.filter((i) => i.category === 'expense'),
    [items]
  )
  const savings = useMemo(
    () => items.filter((i) => i.category === 'savings'),
    [items]
  )
  const pensions = useMemo(
    () => items.filter((i) => i.category === 'pension'),
    [items]
  )
  const assets = useMemo(
    () => items.filter((i) => i.category === 'asset'),
    [items]
  )
  const debts = useMemo(
    () => items.filter((i) => i.category === 'debt'),
    [items]
  )
  const realEstates = useMemo(
    () => items.filter((i) => i.category === 'real_estate'),
    [items]
  )

  // 특정 카테고리 항목 가져오기
  const getByCategory = useCallback(
    (category: FinancialCategory) => {
      return items.filter((i) => i.category === category)
    },
    [items]
  )

  // 연동된 항목 가져오기
  const getLinkedItem = useCallback(
    (linkedItemId: string): FinancialItem | null => {
      return items.find((i) => i.id === linkedItemId) || null
    },
    [items]
  )

  // 특정 항목에 연동된 모든 항목 가져오기
  const getLinkedItems = useCallback(
    (sourceId: string): FinancialItem[] => {
      return items.filter((i) => i.linked_item_id === sourceId)
    },
    [items]
  )

  // 항목 추가
  const addItem = useCallback(
    async (input: Omit<FinancialItemInput, 'simulation_id'>): Promise<FinancialItem> => {
      setIsLoading(true)
      setError(null)
      try {
        const created = await financialItemService.create({
          ...input,
          simulation_id: simulationId,
        })
        setItems((prev) => [...prev, created])
        return created
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add item')
        setError(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [simulationId]
  )

  // 여러 항목 일괄 추가
  const addItems = useCallback(
    async (inputs: Omit<FinancialItemInput, 'simulation_id'>[]): Promise<FinancialItem[]> => {
      setIsLoading(true)
      setError(null)
      try {
        const itemInputs = inputs.map((input) => ({
          ...input,
          simulation_id: simulationId,
        }))
        const created = await financialItemService.createMany(itemInputs)
        setItems((prev) => [...prev, ...created])
        return created
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add items')
        setError(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [simulationId]
  )

  // 항목 수정
  const updateItem = useCallback(
    async (
      id: string,
      updates: Partial<Omit<FinancialItemInput, 'simulation_id'>>
    ): Promise<FinancialItem> => {
      setIsLoading(true)
      setError(null)
      try {
        const updated = await financialItemService.update(id, updates)
        setItems((prev) => prev.map((item) => (item.id === id ? updated : item)))
        return updated
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update item')
        setError(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 항목 삭제 (soft delete)
  const deleteItem = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      await financialItemService.delete(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete item')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 항목 및 연동된 항목 모두 삭제
  const deleteItemWithLinked = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true)
      setError(null)
      try {
        // 연동된 항목들 찾기
        const linkedItems = items.filter((i) => i.linked_item_id === id)

        // 연동된 항목들 삭제
        await Promise.all(linkedItems.map((item) => financialItemService.delete(item.id)))

        // 원본 항목 삭제
        await financialItemService.delete(id)

        // 상태 업데이트
        const idsToRemove = new Set([id, ...linkedItems.map((i) => i.id)])
        setItems((prev) => prev.filter((item) => !idsToRemove.has(item.id)))
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete item')
        setError(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [items]
  )

  // 데이터 새로고침
  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const freshItems = await financialItemService.getAll(simulationId)
      setItems(freshItems)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh items')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [simulationId])

  return {
    // 전체 항목
    items,
    setItems,

    // 카테고리별 필터링된 항목
    incomes,
    expenses,
    savings,
    pensions,
    assets,
    debts,
    realEstates,

    // 조회 함수
    getByCategory,
    getLinkedItem,
    getLinkedItems,

    // CRUD 함수
    addItem,
    addItems,
    updateItem,
    deleteItem,
    deleteItemWithLinked,
    refresh,

    // 상태
    isLoading,
    error,
  }
}

export type UseFinancialItemsReturn = ReturnType<typeof useFinancialItems>
