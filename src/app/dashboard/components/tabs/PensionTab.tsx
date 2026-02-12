'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import type { GlobalSettings } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import {
  NationalPensionSection,
  RetirementPensionSection,
  PersonalPensionSection,
  PensionSummary,
} from './pension'
import {
  useNationalPensions,
  useRetirementPensions,
  usePersonalPensions,
  useInvalidateByCategory,
} from '@/hooks/useFinancialData'
import { useChartTheme } from '@/hooks/useChartTheme'
import { TabSkeleton } from './shared/TabSkeleton'
import styles from './PensionTab.module.css'

interface PensionTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  isMarried: boolean
  globalSettings?: GlobalSettings
}

export function PensionTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  isMarried,
  globalSettings,
}: PensionTabProps) {
  const settings = globalSettings || DEFAULT_GLOBAL_SETTINGS
  const currentYear = new Date().getFullYear()
  const currentAge = currentYear - birthYear

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const {
    data: dbNationalPensions = [],
    isLoading: nationalLoading,
  } = useNationalPensions(simulationId)
  const {
    data: dbRetirementPensions = [],
    isLoading: retirementLoading,
  } = useRetirementPensions(simulationId)
  const {
    data: dbPersonalPensions = [],
    isLoading: personalLoading,
  } = usePersonalPensions(simulationId)

  const invalidate = useInvalidateByCategory(simulationId)
  const isLoading = nationalLoading || retirementLoading || personalLoading
  const [isExpanded, setIsExpanded] = useState(true)

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [selectedPensionType, setSelectedPensionType] = useState<'national' | 'retirement' | 'personal' | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const { isDark } = useChartTheme()

  // 모든 연금 데이터 캐시 무효화
  const loadPensions = () => {
    invalidate('nationalPensions')
    invalidate('retirementPensions')
    invalidate('personalPensions')
  }

  // owner별 연금 데이터 추출
  const selfNationalPension = useMemo(
    () => dbNationalPensions.find(p => p.owner === 'self') || null,
    [dbNationalPensions]
  )
  const dbSpouseNationalPension = useMemo(
    () => dbNationalPensions.find(p => p.owner === 'spouse') || null,
    [dbNationalPensions]
  )
  const selfRetirementPension = useMemo(
    () => dbRetirementPensions.find(p => p.owner === 'self') || null,
    [dbRetirementPensions]
  )
  const spouseRetirementPension = useMemo(
    () => dbRetirementPensions.find(p => p.owner === 'spouse') || null,
    [dbRetirementPensions]
  )
  const selfPersonalPensions = useMemo(
    () => dbPersonalPensions.filter(p => p.owner === 'self'),
    [dbPersonalPensions]
  )
  const spousePersonalPensions = useMemo(
    () => dbPersonalPensions.filter(p => p.owner === 'spouse'),
    [dbPersonalPensions]
  )

  // 국민연금 데이터 (요약 패널용) - DB 데이터 사용
  const nationalPensionData = {
    self: {
      monthly: selfNationalPension?.expected_monthly_amount || 0,
      startAge: selfNationalPension?.start_age || 65,
    },
    spouse: isMarried && dbSpouseNationalPension ? {
      monthly: dbSpouseNationalPension.expected_monthly_amount || 0,
      startAge: dbSpouseNationalPension.start_age || 65,
    } : null,
  }

  // 실제 배우자 생년 (없으면 본인과 동일)
  const effectiveSpouseBirthYear = spouseBirthYear || birthYear

  // 모든 데이터가 없는 경우에만 로딩 표시
  const hasNoData = dbNationalPensions.length === 0 && dbRetirementPensions.length === 0 && dbPersonalPensions.length === 0

  // 총 연금 개수 및 합계
  const totalPensionCount = dbNationalPensions.length + dbRetirementPensions.length + dbPersonalPensions.length

  // ESC 키로 드롭다운 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTypeMenu) {
        setShowTypeMenu(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showTypeMenu])

  // 드롭다운 외부 클릭으로 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showTypeMenu &&
        addButtonRef.current &&
        !addButtonRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest(`.${styles.typeMenu}`)
      ) {
        setShowTypeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTypeMenu])

  const handleTypeSelect = (type: 'national' | 'retirement' | 'personal') => {
    setSelectedPensionType(type)
    setShowTypeMenu(false)
    // Trigger add mode for the selected pension type by triggering edit mode on the corresponding sub-component
    // This will be handled by passing a flag to each sub-component
  }

  if (isLoading && hasNoData) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={3} itemsPerSection={2} />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.headerToggle} onClick={() => setIsExpanded(!isExpanded)} type="button">
          <span className={styles.title}>연금</span>
          <span className={styles.count}>{totalPensionCount}개</span>
        </button>
        <div className={styles.headerRight}>
          <button
            ref={addButtonRef}
            className={styles.addIconBtn}
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            type="button"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* 타입 선택 드롭다운 - portal로 body에 렌더 */}
      {showTypeMenu && addButtonRef.current && createPortal(
        <div
          className={styles.typeMenu}
          data-scenario-dropdown-portal
          style={{
            position: 'fixed',
            top: addButtonRef.current.getBoundingClientRect().bottom + 6,
            left: addButtonRef.current.getBoundingClientRect().right - 150,
            background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}
        >
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('national')}
          >
            국민연금
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('retirement')}
          >
            퇴직연금
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('personal')}
          >
            개인연금
          </button>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.flatList}>
          {totalPensionCount === 0 && (
            <p className={styles.emptyHint}>
              아직 등록된 연금이 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}

          {/* 국민연금 */}
          <NationalPensionSection
            pension={selfNationalPension}
            simulationId={simulationId}
            owner="self"
            ownerLabel="본인"
            birthYear={birthYear}
            onSave={loadPensions}
          />
          {isMarried && (
            <NationalPensionSection
              pension={dbSpouseNationalPension}
              simulationId={simulationId}
              owner="spouse"
              ownerLabel="배우자"
              birthYear={effectiveSpouseBirthYear}
              onSave={loadPensions}
            />
          )}

          {/* 퇴직연금 */}
          <RetirementPensionSection
            pension={selfRetirementPension}
            simulationId={simulationId}
            owner="self"
            ownerLabel="본인"
            projection={null}
            monthlyIncome={0}
            yearsUntilRetirement={Math.max(0, retirementAge - currentAge)}
            birthYear={birthYear}
            retirementAge={retirementAge}
            onSave={loadPensions}
          />
          {isMarried && (
            <RetirementPensionSection
              pension={spouseRetirementPension}
              simulationId={simulationId}
              owner="spouse"
              ownerLabel="배우자"
              projection={null}
              monthlyIncome={0}
              yearsUntilRetirement={Math.max(0, retirementAge - currentAge)}
              birthYear={effectiveSpouseBirthYear}
              retirementAge={retirementAge}
              onSave={loadPensions}
            />
          )}

          {/* 개인연금 */}
          <PersonalPensionSection
            pensions={selfPersonalPensions}
            simulationId={simulationId}
            owner="self"
            ownerLabel="본인"
            birthYear={birthYear}
            retirementAge={retirementAge}
            onSave={loadPensions}
          />
          {isMarried && (
            <PersonalPensionSection
              pensions={spousePersonalPensions}
              simulationId={simulationId}
              owner="spouse"
              ownerLabel="배우자"
              birthYear={effectiveSpouseBirthYear}
              retirementAge={retirementAge}
              onSave={loadPensions}
            />
          )}
        </div>
      )}
    </div>
  )
}
