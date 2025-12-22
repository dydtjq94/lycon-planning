'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { OnboardingData, AssetInput } from '@/types'
import { Check } from 'lucide-react'
import styles from '../../onboarding.module.css'

import {
  type RowId,
  type ProgressiveFormProps,
  rows,
  sectionRows,
  frequencyLabels,
} from './types'
import { sections, type SectionId } from '../SectionForm'

import {
  renderNameInput,
  BirthDateRows,
  ChildrenRows,
  RetirementAgeRows,
  renderRetirementFundInput,
  renderLaborIncomeInput,
  SpouseLaborIncomeRow,
  renderBusinessIncomeInput,
  SpouseBusinessIncomeRow,
  renderLivingExpensesInput,
  RealEstateRows,
  FinancialAssetRows,
  DebtRows,
  PensionRows,
  renderAssetInput,
  renderNationalPensionInput,
  renderRetirementPensionInput,
  renderPersonalPensionInput,
  renderOtherPensionInput,
} from './rows'

// 섹션 헤더 레이블 정의
const sectionLabels: Record<SectionId, string> = {
  basic: '기본 정보',
  income: '소득',
  expense: '지출',
  realEstate: '부동산',
  asset: '금융자산',
  debt: '부채',
  pension: '연금',
}

export function ProgressiveForm({
  data,
  onUpdateData,
  onActiveRowChange,
  activeSection,
  onSectionChange,
  currentStepIndex = 0
}: ProgressiveFormProps) {
  const [activeRow, setActiveRow] = useState<RowId>('name')
  const [visibleSection, setVisibleSection] = useState<SectionId>('basic')

  // currentStepIndex와 activeRow 동기화
  useEffect(() => {
    if (currentStepIndex >= 0 && currentStepIndex < rows.length) {
      const targetRowId = rows[currentStepIndex].id
      if (activeRow !== targetRowId) {
        setActiveRow(targetRowId)
      }
    }
  }, [currentStepIndex, activeRow])

  // 현재 행으로 자동 스크롤
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // 약간의 딜레이 후 스크롤 (DOM 업데이트 대기)
    const timer = setTimeout(() => {
      const currentRowElement = container.querySelector('[data-current="true"]') as HTMLElement
      if (currentRowElement) {
        const containerRect = container.getBoundingClientRect()
        const rowRect = currentRowElement.getBoundingClientRect()
        const headerHeight = 80 // 헤더 + 프로그레스바 높이

        // 현재 스크롤 위치에서 행이 보이는 위치로 계산
        const scrollTop = container.scrollTop + (rowRect.top - containerRect.top) - headerHeight

        container.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [currentStepIndex])

  // 섹션 헤더 ref들 (Intersection Observer용)
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    basic: null,
    income: null,
    expense: null,
    realEstate: null,
    asset: null,
    debt: null,
    pension: null,
  })
  // 섹션 컨테이너 ref들 (스크롤용)
  const sectionContainerRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    basic: null,
    income: null,
    expense: null,
    realEstate: null,
    asset: null,
    debt: null,
    pension: null,
  })
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 현재 스텝까지의 모든 행 표시
  const visibleRows = useMemo(() => {
    return rows.slice(0, currentStepIndex + 1).map(row => row.id)
  }, [currentStepIndex])

  // 현재 스텝의 행 ID
  const currentRowId = useMemo(() => {
    return currentStepIndex < rows.length ? rows[currentStepIndex].id : null
  }, [currentStepIndex])

  // Intersection Observer로 현재 보이는 섹션 감지
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        // 가장 상단에 가까운 보이는 섹션 찾기
        const visibleEntries = entries.filter(entry => entry.isIntersecting)
        if (visibleEntries.length > 0) {
          // 가장 상단에 있는 섹션 (boundingClientRect.top이 가장 작은 것)
          const topEntry = visibleEntries.reduce((prev, curr) =>
            curr.boundingClientRect.top < prev.boundingClientRect.top ? curr : prev
          )
          const sectionId = topEntry.target.getAttribute('data-section') as SectionId
          if (sectionId) {
            setVisibleSection(sectionId)
            // 외부에 섹션 변경 알림 (탭 상태 동기화)
            if (onSectionChange && sectionId !== activeSection) {
              // 스크롤로 인한 변경은 onSectionChange를 호출하지 않음 (무한 루프 방지)
              // 대신 visibleSection 상태만 업데이트
            }
          }
        }
      },
      {
        root: container,
        rootMargin: '-50px 0px -80% 0px', // 상단 50px 아래부터 감지
        threshold: 0,
      }
    )

    // 각 섹션 헤더 관찰
    Object.entries(sectionRefs.current).forEach(([sectionId, ref]) => {
      if (ref) {
        observer.observe(ref)
      }
    })

    return () => observer.disconnect()
  }, [activeSection, onSectionChange])

  // 탭 클릭 시 해당 섹션으로 스크롤
  const scrollToSection = useCallback((sectionId: SectionId) => {
    const sectionContainer = sectionContainerRefs.current[sectionId]
    const container = scrollContainerRef.current
    if (sectionContainer && container) {
      // 먼저 맨 위로 스크롤해서 getBoundingClientRect 정확히 계산
      const containerRect = container.getBoundingClientRect()

      // 섹션 컨테이너 위치 계산 (현재 스크롤 위치 고려)
      const sectionRect = sectionContainer.getBoundingClientRect()
      const currentScrollTop = container.scrollTop
      const sectionTop = sectionRect.top - containerRect.top + currentScrollTop

      // spacer 높이를 더해서 섹션 헤더가 상단에 오도록
      const spacerHeight = sectionId !== 'basic' ? 28 : 0
      const scrollTop = sectionTop + spacerHeight - 35

      container.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      })
    }
    setVisibleSection(sectionId)
  }, [])

  const handleRowFocus = (rowId: RowId) => {
    setActiveRow(rowId)
    onActiveRowChange(rowId)
  }

  // 자산 항목 관리
  const addAssetItem = (key: keyof OnboardingData) => {
    const items = data[key] as AssetInput[]
    onUpdateData({ [key]: [...items, { name: '', amount: null, frequency: 'monthly' }] })
  }

  const updateAssetItem = (key: keyof OnboardingData, index: number, updates: Partial<AssetInput>) => {
    const items = data[key] as AssetInput[]
    onUpdateData({ [key]: items.map((item, i) => (i === index ? { ...item, ...updates } : item)) })
  }

  const deleteAssetItem = (key: keyof OnboardingData, index: number) => {
    const items = data[key] as AssetInput[]
    if (items.length <= 1) {
      onUpdateData({ [key]: [{ name: '', amount: null, frequency: 'monthly' }] })
    } else {
      onUpdateData({ [key]: items.filter((_, i) => i !== index) })
    }
  }

  // 공통 props
  const rowInputProps = {
    data,
    onUpdateData,
    onFocus: handleRowFocus,
  }

  const assetRowInputProps = {
    ...rowInputProps,
    addAssetItem,
    updateAssetItem,
    deleteAssetItem,
    frequencyLabels,
  }

  const renderInput = (rowId: RowId, isActive: boolean) => {
    switch (rowId) {
      case 'name':
        return renderNameInput({ ...rowInputProps, isActive })
      case 'birth_date':
      case 'children':
      case 'retirement_age':
        return null // 별도 처리
      case 'retirement_fund':
        return renderRetirementFundInput(rowInputProps)
      // 소득/지출
      case 'labor_income':
        return renderLaborIncomeInput(rowInputProps)
      case 'business_income':
        return renderBusinessIncomeInput(rowInputProps)
      case 'living_expenses':
        return renderLivingExpensesInput(rowInputProps)
      case 'realEstate':
        return null // 별도 처리
      case 'asset':
        return renderAssetInput(assetRowInputProps)
      case 'debt':
        return null // 별도 처리
      case 'national_pension':
      case 'retirement_pension':
      case 'personal_pension':
      case 'other_pension':
        return null // 별도 처리 (PensionRows)
      default:
        return null
    }
  }

  // 행이 보여야 하는지 체크 (프로그레시브 + 섹션 기반)
  const isRowVisible = (rowId: RowId) => {
    return visibleRows.includes(rowId)
  }

  const renderRow = (rowConfig: typeof rows[0]) => {
    // 프로그레시브: 보이지 않는 행은 렌더링하지 않음
    if (!isRowVisible(rowConfig.id)) return null

    // 생년월일 행은 별도 처리 (본인 + 배우자 통합)
    if (rowConfig.id === 'birth_date') {
      const baseRowIndex = rows.findIndex(r => r.id === 'birth_date') + 1
      return (
        <BirthDateRows
          key="birth-date-rows"
          data={data}
          onUpdateData={onUpdateData}
          onFocus={handleRowFocus}
          activeRow={activeRow}
          currentRowId={currentRowId}
          baseRowIndex={baseRowIndex}
        />
      )
    }

    // 자녀 행은 별도 처리
    if (rowConfig.id === 'children') {
      const baseRowIndex = rows.findIndex(r => r.id === 'children') + 1
      return (
        <ChildrenRows
          key="children-rows"
          data={data}
          onUpdateData={onUpdateData}
          onFocus={handleRowFocus}
          activeRow={activeRow}
          currentRowId={currentRowId}
          baseRowIndex={baseRowIndex}
        />
      )
    }

    // 은퇴 나이 행은 별도 처리
    if (rowConfig.id === 'retirement_age') {
      const baseRowIndex = rows.findIndex(r => r.id === 'retirement_age') + 1
      return (
        <RetirementAgeRows
          key="retirement-age-rows"
          data={data}
          onUpdateData={onUpdateData}
          onFocus={handleRowFocus}
          activeRow={activeRow}
          currentRowId={currentRowId}
          baseRowIndex={baseRowIndex}
        />
      )
    }

    // 부동산 행은 별도 처리
    if (rowConfig.id === 'realEstate') {
      const baseRowIndex = rows.findIndex(r => r.id === 'realEstate') + 1
      return (
        <RealEstateRows
          key="real-estate-rows"
          data={data}
          onUpdateData={onUpdateData}
          onFocus={handleRowFocus}
          activeRow={activeRow}
          currentRowId={currentRowId}
          baseRowIndex={baseRowIndex}
        />
      )
    }

    // 금융자산 행은 별도 처리
    if (rowConfig.id === 'asset') {
      const baseRowIndex = rows.findIndex(r => r.id === 'asset') + 1
      return (
        <FinancialAssetRows
          key="financial-asset-rows"
          data={data}
          onUpdateData={onUpdateData}
          onFocus={handleRowFocus}
          activeRow={activeRow}
          currentRowId={currentRowId}
          baseRowIndex={baseRowIndex}
        />
      )
    }

    // 부채 행은 별도 처리
    if (rowConfig.id === 'debt') {
      const baseRowIndex = rows.findIndex(r => r.id === 'debt') + 1
      return (
        <DebtRows
          key="debt-rows"
          data={data}
          onUpdateData={onUpdateData}
          onFocus={handleRowFocus}
          activeRow={activeRow}
          currentRowId={currentRowId}
          baseRowIndex={baseRowIndex}
        />
      )
    }

    // 연금 행은 별도 처리 (국민연금 행에서 전체 렌더링)
    if (rowConfig.id === 'national_pension') {
      const baseRowIndex = rows.findIndex(r => r.id === 'national_pension') + 1
      return (
        <PensionRows
          key="pension-rows"
          data={data}
          onUpdateData={onUpdateData}
          onFocus={handleRowFocus}
          activeRow={activeRow}
          currentRowId={currentRowId}
          baseRowIndex={baseRowIndex}
          visibleRows={visibleRows}
        />
      )
    }

    // 퇴직연금, 개인연금, 기타연금은 PensionRows에서 통합 처리되므로 스킵
    if (['retirement_pension', 'personal_pension', 'other_pension'].includes(rowConfig.id)) {
      return null
    }

    const isActive = activeRow === rowConfig.id
    const isComplete = rowConfig.isComplete(data)
    const isCurrent = currentRowId === rowConfig.id
    const rowNumber = rows.findIndex(r => r.id === rowConfig.id) + 1

    // 셀 구조를 사용하는 행들 (소득/지출, 은퇴자금)
    const useCellStructure = ['labor_income', 'business_income', 'living_expenses', 'retirement_fund'].includes(rowConfig.id)

    // 근로 소득 행: 본인 + 배우자 확장 행
    if (rowConfig.id === 'labor_income') {
      const isMainCurrent = isCurrent && data.laborIncome === null
      return (
        <React.Fragment key={rowConfig.id}>
          <div
            className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isComplete ? styles.excelRowComplete : ''} ${isMainCurrent ? styles.excelRowCurrent : ''}`}
            onClick={() => handleRowFocus(rowConfig.id)}
            data-current={isMainCurrent ? 'true' : undefined}
          >
            <div className={styles.excelRowNumber}>
              {isComplete ? <Check size={14} /> : rowNumber}
            </div>
            <div className={styles.excelRowLabel}>{rowConfig.label}</div>
            <div className={styles.excelRowInputMulti}>
              {renderInput(rowConfig.id, isActive)}
            </div>
          </div>
          <SpouseLaborIncomeRow
            data={data}
            onUpdateData={onUpdateData}
            onFocus={handleRowFocus}
            isActive={isActive}
            isCurrent={isCurrent}
          />
        </React.Fragment>
      )
    }

    // 사업 소득 행: 본인 + 배우자 확장 행
    if (rowConfig.id === 'business_income') {
      const isMainCurrent = isCurrent && data.businessIncome === null
      return (
        <React.Fragment key={rowConfig.id}>
          <div
            className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isComplete ? styles.excelRowComplete : ''} ${isMainCurrent ? styles.excelRowCurrent : ''}`}
            onClick={() => handleRowFocus(rowConfig.id)}
            data-current={isMainCurrent ? 'true' : undefined}
          >
            <div className={styles.excelRowNumber}>
              {isComplete ? <Check size={14} /> : rowNumber}
            </div>
            <div className={styles.excelRowLabel}>{rowConfig.label}</div>
            <div className={styles.excelRowInputMulti}>
              {renderInput(rowConfig.id, isActive)}
            </div>
          </div>
          <SpouseBusinessIncomeRow
            data={data}
            onUpdateData={onUpdateData}
            onFocus={handleRowFocus}
            isActive={isActive}
            isCurrent={isCurrent}
          />
        </React.Fragment>
      )
    }

    return (
      <div
        key={rowConfig.id}
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isComplete ? styles.excelRowComplete : ''} ${isCurrent ? styles.excelRowCurrent : ''}`}
        onClick={() => handleRowFocus(rowConfig.id)}
        data-current={isCurrent ? 'true' : undefined}
      >
        <div className={styles.excelRowNumber}>
          {isComplete ? <Check size={14} /> : rowNumber}
        </div>
        <div className={styles.excelRowLabel}>{rowConfig.label}</div>
        <div className={useCellStructure ? styles.excelRowInputMulti : styles.excelRowInput}>
          {renderInput(rowConfig.id, isActive)}
        </div>
      </div>
    )
  }

  // 섹션별로 행들을 그룹화하여 렌더링
  const renderSectionWithRows = (sectionId: SectionId) => {
    const sectionRowIds = sectionRows[sectionId]
    const sectionRowConfigs = rows.filter(row => sectionRowIds.includes(row.id))

    // 이 섹션에 보여야 할 행이 있는지 체크
    const hasVisibleRows = sectionRowConfigs.some(row => isRowVisible(row.id))
    if (!hasVisibleRows) return null

    return (
      <div
        key={sectionId}
        ref={el => { sectionContainerRefs.current[sectionId] = el }}
        className={styles.excelSection}
      >
        {/* 섹션 구분 빈 행 (첫 번째 섹션 제외) */}
        {sectionId !== 'basic' && (
          <div className={styles.excelSectionSpacer}>
            <div className={styles.excelSectionSpacerNumber} />
            <div className={styles.excelSectionSpacerLabel} />
            <div className={styles.excelSectionSpacerValue} />
          </div>
        )}

        {/* 섹션 헤더 (sticky) */}
        <div
          ref={el => { sectionRefs.current[sectionId] = el }}
          data-section={sectionId}
          className={`${styles.excelSectionHeader} ${visibleSection === sectionId ? styles.excelSectionHeaderActive : ''}`}
        >
          <div className={styles.excelSectionHeaderNumber} />
          <div className={styles.excelSectionHeaderContent}>
            <span className={styles.excelSectionHeaderLabel}>{sectionLabels[sectionId]}</span>
          </div>
        </div>

        {/* 섹션 내 행들 */}
        <div className={styles.excelSectionBody}>
          {sectionRowConfigs.map(renderRow)}
        </div>
      </div>
    )
  }

  // 전체 진행률 계산
  const completedCount = rows.filter(row => row.isComplete(data)).length
  const totalCount = rows.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className={styles.excelWrapper}>
      <div className={styles.excelContainer} ref={scrollContainerRef}>
        {/* 고정 헤더 */}
        <div className={styles.excelHeader}>
          <div className={styles.excelHeaderNumber}>#</div>
          <div className={styles.excelHeaderLabel}>항목</div>
          <div className={styles.excelHeaderValue}>값</div>
        </div>
        <div className={styles.excelProgressBar}>
          <div
            className={styles.excelProgressFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 스크롤 가능한 바디 (모든 섹션 포함) */}
        <div className={styles.excelBody}>
          {sections.map(section => renderSectionWithRows(section.id))}
        </div>
      </div>

      {/* 엑셀 시트 탭 */}
      <div className={styles.excelSheetTabs}>
        {sections.map((section) => {
          const sectionRowIds = sectionRows[section.id]
          const sectionComplete = sectionRowIds.every(rowId => {
            const row = rows.find(r => r.id === rowId)
            return row ? row.isComplete(data) : true
          })
          const isActive = visibleSection === section.id

          return (
            <button
              key={section.id}
              className={`${styles.excelSheetTab} ${isActive ? styles.excelSheetTabActive : ''} ${sectionComplete ? styles.excelSheetTabComplete : ''}`}
              onClick={() => scrollToSection(section.id)}
            >
              {sectionComplete && <Check size={12} className={styles.excelSheetTabCheck} />}
              {section.shortLabel}
            </button>
          )
        })}
      </div>

          </div>
  )
}
