'use client'

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  Simulation,
  FinancialItem,
  GlobalSettings,
} from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import { loadFinancialItemsFromDB, type SimulationProfile } from '@/lib/services/dbToFinancialItems'
import { financialKeys } from '@/hooks/useFinancialData'

// ============================================
// 프로필 기본 정보 타입
// ============================================

export interface ProfileBasics {
  id: string
  name: string
  gender: 'male' | 'female' | null
  birth_date: string | null
  target_retirement_age: number
  target_retirement_fund?: number
  retirement_lifestyle_ratio?: number
  investment_profile?: {
    type?: string
    answers?: Record<string, string | string[]>
    updatedAt?: string
  }
  survey_responses?: Record<string, Record<string, string | string[]>>
  settings?: {
    inflationRate?: number
    investmentReturn?: number
    lifeExpectancy?: number
  }
  diagnosis_started_at?: string | null
  action_plan_status?: Record<string, boolean>
}

// ============================================
// 가족 구성원 타입
// ============================================

export interface FamilyMember {
  id: string
  user_id: string
  relationship: 'spouse' | 'child' | 'parent' | string
  name: string
  birth_date: string | null
  gender: 'male' | 'female' | null
  is_dependent: boolean
  is_working: boolean
  retirement_age: number | null
  monthly_income: number | null
  notes: string | null
}

// ============================================
// 컨텍스트 타입
// ============================================

interface FinancialContextValue {
  // 시뮬레이션
  simulation: Simulation

  // 프로필 기본 정보
  profile: ProfileBasics

  // 가족 구성원
  familyMembers: FamilyMember[]

  // 시뮬레이션 프로필 (계산된 값)
  simulationProfile: SimulationProfile

  // 글로벌 설정
  globalSettings: GlobalSettings
  updateGlobalSettings: (updates: Partial<GlobalSettings>) => void

  // 재무 데이터 로드 (시뮬레이션용) - 레거시, useFinancialItems 훅 사용 권장
  loadItems: () => Promise<FinancialItem[]>

  // React Query 캐시 무효화 (데이터 변경 후 호출)
  invalidateFinancialData: () => void

  // 데이터 리프레시 트리거 (레거시 - invalidateFinancialData 사용 권장)
  refreshTrigger: number
  triggerRefresh: () => void

  // 상태
  isLoading: boolean

  // 계산된 값
  currentAge: number
  retirementYear: number
  currentYear: number
  birthYear: number
}

const FinancialContext = createContext<FinancialContextValue | null>(null)

// ============================================
// Provider Props
// ============================================

interface FinancialProviderProps {
  children: ReactNode
  simulation: Simulation
  profile: ProfileBasics
  familyMembers: FamilyMember[]
  initialGlobalSettings?: GlobalSettings
}

// ============================================
// Provider 컴포넌트
// ============================================

export function FinancialProvider({
  children,
  simulation,
  profile,
  familyMembers,
  initialGlobalSettings,
}: FinancialProviderProps) {
  // React Query Client
  const queryClient = useQueryClient()

  // 글로벌 설정 상태
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(
    initialGlobalSettings || DEFAULT_GLOBAL_SETTINGS
  )

  // 리프레시 트리거 상태 (레거시 호환용)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // 글로벌 설정 업데이트
  const updateGlobalSettings = useCallback((updates: Partial<GlobalSettings>) => {
    setGlobalSettings((prev) => ({ ...prev, ...updates }))
    // TODO: Supabase에 저장 (profiles.settings)
  }, [])

  // React Query 캐시 무효화
  const invalidateFinancialData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: financialKeys.items(simulation.id) })
    // 레거시 호환: triggerRefresh도 함께 호출
    setRefreshTrigger(prev => prev + 1)
  }, [queryClient, simulation.id])

  // 리프레시 트리거 (레거시 - invalidateFinancialData 호출)
  const triggerRefresh = useCallback(() => {
    invalidateFinancialData()
  }, [invalidateFinancialData])

  // 현재 연도
  const currentYear = useMemo(() => new Date().getFullYear(), [])

  // 생년 계산
  const birthYear = useMemo(() => {
    if (!profile.birth_date) return currentYear - 35 // 기본값
    return parseInt(profile.birth_date.split('-')[0])
  }, [profile.birth_date, currentYear])

  // 현재 나이 계산
  const currentAge = useMemo(() => {
    return currentYear - birthYear
  }, [birthYear, currentYear])

  // 은퇴 연도 계산
  const retirementYear = useMemo(() => {
    return birthYear + profile.target_retirement_age
  }, [birthYear, profile.target_retirement_age])

  // 시뮬레이션 프로필 생성
  const simulationProfile: SimulationProfile = useMemo(() => {
    // 배우자 정보 추출
    const spouseMember = familyMembers.find(fm => fm.relationship === 'spouse')

    let spouseBirthYear: number | undefined
    if (spouseMember?.birth_date) {
      spouseBirthYear = parseInt(spouseMember.birth_date.split('-')[0])
    } else if (spouseMember) {
      spouseBirthYear = birthYear // 배우자가 있지만 생년월일 없으면 본인과 동갑
    }

    return {
      birthYear,
      retirementAge: profile.target_retirement_age,
      spouseBirthYear,
      spouseRetirementAge: spouseMember?.retirement_age || undefined,
    }
  }, [birthYear, profile.target_retirement_age, familyMembers])

  // 재무 데이터 로드 함수
  const loadItems = useCallback(async (): Promise<FinancialItem[]> => {
    setIsLoading(true)
    try {
      const items = await loadFinancialItemsFromDB(simulation.id, simulationProfile)
      return items
    } finally {
      setIsLoading(false)
    }
  }, [simulation.id, simulationProfile])

  // 컨텍스트 값
  const value = useMemo<FinancialContextValue>(
    () => ({
      // 시뮬레이션
      simulation,

      // 프로필
      profile,

      // 가족 구성원
      familyMembers,

      // 시뮬레이션 프로필
      simulationProfile,

      // 글로벌 설정
      globalSettings,
      updateGlobalSettings,

      // 재무 데이터 로드
      loadItems,

      // React Query 캐시 무효화
      invalidateFinancialData,

      // 리프레시 트리거 (레거시)
      refreshTrigger,
      triggerRefresh,

      // 상태
      isLoading,

      // 계산된 값
      currentAge,
      retirementYear,
      currentYear,
      birthYear,
    }),
    [
      simulation,
      profile,
      familyMembers,
      simulationProfile,
      globalSettings,
      updateGlobalSettings,
      loadItems,
      invalidateFinancialData,
      refreshTrigger,
      triggerRefresh,
      isLoading,
      currentAge,
      retirementYear,
      currentYear,
      birthYear,
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

// 글로벌 설정 훅
export function useGlobalSettings() {
  const { globalSettings, updateGlobalSettings } = useFinancialContext()
  return { globalSettings, updateGlobalSettings }
}

// 프로필 정보 훅
export function useProfileInfo() {
  const { profile, simulationProfile, currentAge, retirementYear, currentYear, birthYear } = useFinancialContext()
  return { profile, simulationProfile, currentAge, retirementYear, currentYear, birthYear }
}

// 시뮬레이션 정보 훅
export function useSimulation() {
  const { simulation, loadItems, refreshTrigger, triggerRefresh } = useFinancialContext()
  return { simulation, loadItems, refreshTrigger, triggerRefresh }
}

// 가족 구성원 훅
export function useFamilyMembers() {
  const { familyMembers } = useFinancialContext()
  return { familyMembers }
}
