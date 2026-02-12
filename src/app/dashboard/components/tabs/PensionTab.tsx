'use client'

import { useState, useMemo } from 'react'
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
      </div>

      {isExpanded && (
        <>
          {/* ========== 국민연금 ========== */}
          <section className={styles.pensionSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>국민연금</span>
        </div>
        <p className={styles.sectionDesc}>
          국민연금공단 예상연금 조회 서비스에서 확인한 금액을 입력하세요.
        </p>

        <div className={styles.itemList}>
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
        </div>
      </section>

      {/* ========== 퇴직연금 ========== */}
      <section className={styles.pensionSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>퇴직연금/퇴직금</span>
        </div>
        <p className={styles.sectionDesc}>
          유형을 선택하면 퇴직 시 예상 수령액을 자동으로 계산합니다.
        </p>

        <div className={styles.itemList}>
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
        </div>
      </section>

      {/* ========== 개인연금 ========== */}
      <section className={styles.pensionSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>개인연금</span>
        </div>
        <p className={styles.sectionDesc}>
          현재 잔액, 월 납입액, 수령 계획을 입력하세요. (56세 이상부터 수령 가능)
        </p>

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
          <>
            <div className={styles.sectionHeader} style={{ marginTop: 24 }}>
              <span className={styles.sectionTitle}>배우자 개인연금</span>
            </div>
            <PersonalPensionSection
              pensions={spousePersonalPensions}
              simulationId={simulationId}
              owner="spouse"
              ownerLabel="배우자"
              birthYear={effectiveSpouseBirthYear}
              retirementAge={retirementAge}
              onSave={loadPensions}
            />
          </>
        )}
          </section>
        </>
      )}
    </div>
  )
}
