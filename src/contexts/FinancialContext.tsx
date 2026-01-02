'use client'

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'
import type {
  Simulation,
  FinancialItem,
  FinancialItemInput,
  FinancialCategory,
  GlobalSettings,
  OnboardingData,
} from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import { useFinancialItems, type UseFinancialItemsReturn } from '@/hooks/useFinancialItems'

// ============================================
// 프로필 기본 정보 타입
// ============================================

export interface ProfileBasics {
  id: string
  name: string
  birth_date: string | null
  target_retirement_age: number
  target_retirement_fund?: number
  settings?: {
    inflationRate?: number
    investmentReturn?: number
    lifeExpectancy?: number
  }
}

// ============================================
// 컨텍스트 타입
// ============================================

interface FinancialContextValue {
  // 시뮬레이션
  simulation: Simulation

  // 프로필 기본 정보
  profile: ProfileBasics

  // 재무 항목 (훅에서 가져옴)
  items: FinancialItem[]
  incomes: FinancialItem[]
  expenses: FinancialItem[]
  savings: FinancialItem[]
  pensions: FinancialItem[]
  assets: FinancialItem[]
  debts: FinancialItem[]
  realEstates: FinancialItem[]

  // CRUD 함수
  addItem: UseFinancialItemsReturn['addItem']
  addItems: UseFinancialItemsReturn['addItems']
  updateItem: UseFinancialItemsReturn['updateItem']
  deleteItem: UseFinancialItemsReturn['deleteItem']
  deleteItemWithLinked: UseFinancialItemsReturn['deleteItemWithLinked']
  refresh: UseFinancialItemsReturn['refresh']

  // 조회 함수
  getByCategory: UseFinancialItemsReturn['getByCategory']
  getLinkedItem: UseFinancialItemsReturn['getLinkedItem']
  getLinkedItems: UseFinancialItemsReturn['getLinkedItems']

  // 글로벌 설정
  globalSettings: GlobalSettings
  updateGlobalSettings: (updates: Partial<GlobalSettings>) => void

  // 상태
  isLoading: boolean
  error: Error | null

  // 계산된 값
  currentAge: number
  retirementYear: number
  currentYear: number
}

const FinancialContext = createContext<FinancialContextValue | null>(null)

// ============================================
// Provider Props
// ============================================

interface FinancialProviderProps {
  children: ReactNode
  simulation: Simulation
  initialItems: FinancialItem[]
  profile: ProfileBasics
  initialGlobalSettings?: GlobalSettings
}

// ============================================
// Provider 컴포넌트
// ============================================

export function FinancialProvider({
  children,
  simulation,
  initialItems,
  profile,
  initialGlobalSettings,
}: FinancialProviderProps) {
  // 글로벌 설정 상태
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(
    initialGlobalSettings || DEFAULT_GLOBAL_SETTINGS
  )

  // 재무 항목 훅
  const financialItems = useFinancialItems(simulation.id, initialItems)

  // 글로벌 설정 업데이트
  const updateGlobalSettings = useCallback((updates: Partial<GlobalSettings>) => {
    setGlobalSettings((prev) => ({ ...prev, ...updates }))
    // TODO: Supabase에 저장 (profiles.settings)
  }, [])

  // 현재 연도
  const currentYear = useMemo(() => new Date().getFullYear(), [])

  // 현재 나이 계산
  const currentAge = useMemo(() => {
    if (!profile.birth_date) return 35 // 기본값
    const birthYear = parseInt(profile.birth_date.split('-')[0])
    return currentYear - birthYear
  }, [profile.birth_date, currentYear])

  // 은퇴 연도 계산
  const retirementYear = useMemo(() => {
    if (!profile.birth_date) return currentYear + 25 // 기본값
    const birthYear = parseInt(profile.birth_date.split('-')[0])
    return birthYear + profile.target_retirement_age
  }, [profile.birth_date, profile.target_retirement_age, currentYear])

  // 컨텍스트 값
  const value = useMemo<FinancialContextValue>(
    () => ({
      // 시뮬레이션
      simulation,

      // 프로필
      profile,

      // 재무 항목
      items: financialItems.items,
      incomes: financialItems.incomes,
      expenses: financialItems.expenses,
      savings: financialItems.savings,
      pensions: financialItems.pensions,
      assets: financialItems.assets,
      debts: financialItems.debts,
      realEstates: financialItems.realEstates,

      // CRUD 함수
      addItem: financialItems.addItem,
      addItems: financialItems.addItems,
      updateItem: financialItems.updateItem,
      deleteItem: financialItems.deleteItem,
      deleteItemWithLinked: financialItems.deleteItemWithLinked,
      refresh: financialItems.refresh,

      // 조회 함수
      getByCategory: financialItems.getByCategory,
      getLinkedItem: financialItems.getLinkedItem,
      getLinkedItems: financialItems.getLinkedItems,

      // 글로벌 설정
      globalSettings,
      updateGlobalSettings,

      // 상태
      isLoading: financialItems.isLoading,
      error: financialItems.error,

      // 계산된 값
      currentAge,
      retirementYear,
      currentYear,
    }),
    [
      simulation,
      profile,
      financialItems,
      globalSettings,
      updateGlobalSettings,
      currentAge,
      retirementYear,
      currentYear,
    ]
  )

  return (
    <FinancialContext.Provider value={value}>
      {children}
    </FinancialContext.Provider>
  )
}

// ============================================
// 훅
// ============================================

export function useFinancialContext(): FinancialContextValue {
  const context = useContext(FinancialContext)
  if (!context) {
    throw new Error('useFinancialContext must be used within a FinancialProvider')
  }
  return context
}

// 특정 카테고리만 사용하는 편의 훅
export function useIncomes() {
  const { incomes, addItem, updateItem, deleteItem, isLoading } = useFinancialContext()
  return { incomes, addItem, updateItem, deleteItem, isLoading }
}

export function useExpenses() {
  const { expenses, addItem, updateItem, deleteItem, isLoading } = useFinancialContext()
  return { expenses, addItem, updateItem, deleteItem, isLoading }
}

export function useSavings() {
  const { savings, addItem, updateItem, deleteItem, isLoading } = useFinancialContext()
  return { savings, addItem, updateItem, deleteItem, isLoading }
}

export function usePensions() {
  const { pensions, addItem, updateItem, deleteItem, isLoading } = useFinancialContext()
  return { pensions, addItem, updateItem, deleteItem, isLoading }
}

export function useAssets() {
  const { assets, addItem, updateItem, deleteItem, isLoading } = useFinancialContext()
  return { assets, addItem, updateItem, deleteItem, isLoading }
}

export function useDebts() {
  const { debts, addItem, updateItem, deleteItem, isLoading } = useFinancialContext()
  return { debts, addItem, updateItem, deleteItem, isLoading }
}

export function useRealEstates() {
  const { realEstates, addItem, updateItem, deleteItem, deleteItemWithLinked, isLoading } = useFinancialContext()
  return { realEstates, addItem, updateItem, deleteItem, deleteItemWithLinked, isLoading }
}

export function useGlobalSettings() {
  const { globalSettings, updateGlobalSettings } = useFinancialContext()
  return { globalSettings, updateGlobalSettings }
}

export function useProfileInfo() {
  const { profile, currentAge, retirementYear, currentYear } = useFinancialContext()
  return { profile, currentAge, retirementYear, currentYear }
}
