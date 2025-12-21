'use client'

import React, { useState, useMemo, useEffect } from 'react'
import type { OnboardingData, AssetInput } from '@/types'
import { Check, Loader2, ArrowRight } from 'lucide-react'
import styles from '../../onboarding.module.css'

import {
  type RowId,
  type ProgressiveFormProps,
  rows,
  sectionRows,
  frequencyLabels,
} from './types'
import { sections } from '../SectionForm'

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
  renderFixedExpensesInput,
  FixedExpenseExtensionRows,
  renderVariableExpensesInput,
  VariableExpenseExtensionRows,
  renderSavingsInput,
  renderInvestmentInput,
  renderRealEstateInput,
  renderAssetInput,
  renderDebtInput,
  renderNationalPensionInput,
  renderRetirementPensionInput,
  renderPersonalPensionInput,
  renderOtherPensionInput,
} from './rows'

export function ProgressiveForm({
  data,
  onUpdateData,
  onActiveRowChange,
  activeSection,
  onSectionChange,
  onComplete,
  isCompleteDisabled,
  isSaving
}: ProgressiveFormProps) {
  const [activeRow, setActiveRow] = useState<RowId>('name')

  // 체크된 항목 + 다음 해야 할 항목 하나만 표시
  const visibleRows = useMemo(() => {
    const visible: RowId[] = []
    let foundFirstIncomplete = false

    for (const row of rows) {
      if (row.isComplete(data)) {
        visible.push(row.id)
      } else if (!foundFirstIncomplete) {
        visible.push(row.id)
        foundFirstIncomplete = true
      }
    }

    return visible
  }, [data])

  // 현재 해야 할 첫 번째 미완료 행 찾기
  const currentRowId = useMemo(() => {
    const targetRows = activeSection
      ? rows.filter(row => sectionRows[activeSection].includes(row.id))
      : rows.filter(row => visibleRows.includes(row.id))

    const firstIncomplete = targetRows.find(row => !row.isComplete(data))
    return firstIncomplete?.id || null
  }, [data, visibleRows, activeSection])

  // 섹션 변경 시 해당 섹션의 첫 번째 행으로 이동
  useEffect(() => {
    if (activeSection) {
      const sectionRowIds = sectionRows[activeSection]
      const firstIncomplete = rows.find(
        row => sectionRowIds.includes(row.id) && !row.isComplete(data)
      )
      const targetRow = firstIncomplete?.id || sectionRowIds[0]
      if (targetRow) {
        setActiveRow(targetRow)
        onActiveRowChange(targetRow)
      }
    }
  }, [activeSection])

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
      case 'fixed_expenses':
        return renderFixedExpensesInput(rowInputProps)
      case 'variable_expenses':
        return renderVariableExpensesInput(rowInputProps)
      case 'savings':
        return renderSavingsInput(assetRowInputProps)
      case 'investment':
        return renderInvestmentInput(assetRowInputProps)
      case 'realEstate':
        return renderRealEstateInput(assetRowInputProps)
      case 'asset':
        return renderAssetInput(assetRowInputProps)
      case 'debt':
        return renderDebtInput(assetRowInputProps)
      case 'national_pension':
        return renderNationalPensionInput(assetRowInputProps)
      case 'retirement_pension':
        return renderRetirementPensionInput(assetRowInputProps)
      case 'personal_pension':
        return renderPersonalPensionInput(assetRowInputProps)
      case 'other_pension':
        return renderOtherPensionInput(assetRowInputProps)
      default:
        return null
    }
  }

  const renderRow = (rowConfig: typeof rows[0]) => {
    // 생년월일 행은 별도 처리 (본인 + 배우자 통합)
    if (rowConfig.id === 'birth_date') {
      const isVisible = activeSection
        ? sectionRows[activeSection].includes('birth_date')
        : visibleRows.includes('birth_date')
      if (!isVisible) return null

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
      const isVisible = activeSection
        ? sectionRows[activeSection].includes('children')
        : visibleRows.includes('children')
      if (!isVisible) return null

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
      const isVisible = activeSection
        ? sectionRows[activeSection].includes('retirement_age')
        : visibleRows.includes('retirement_age')
      if (!isVisible) return null

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

    const isActive = activeRow === rowConfig.id
    const isComplete = rowConfig.isComplete(data)
    const isCurrent = currentRowId === rowConfig.id
    const rowNumber = rows.findIndex(r => r.id === rowConfig.id) + 1

    // 셀 구조를 사용하는 행들 (소득/지출, 은퇴자금)
    const useCellStructure = ['labor_income', 'business_income', 'fixed_expenses', 'variable_expenses', 'retirement_fund'].includes(rowConfig.id)

    // 근로 소득 행: 본인 + 배우자 확장 행 (소득 구분선 포함)
    if (rowConfig.id === 'labor_income') {
      // 본인 미입력 → 본인 행 강조
      const isMainCurrent = isCurrent && data.laborIncome === null
      return (
        <React.Fragment key={rowConfig.id}>
          {/* 소득 구분 행 */}
          <div className={styles.excelSectionDivider}>
            <div className={styles.excelRowNumber}></div>
            <div className={styles.excelSectionDividerLabel}>소득</div>
            <div className={styles.excelRowInputMulti}></div>
          </div>
          <div
            className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isComplete ? styles.excelRowComplete : ''} ${isMainCurrent ? styles.excelRowCurrent : ''}`}
            onClick={() => handleRowFocus(rowConfig.id)}
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
      // 본인 미입력 → 본인 행 강조
      const isMainCurrent = isCurrent && data.businessIncome === null
      return (
        <React.Fragment key={rowConfig.id}>
          <div
            className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isComplete ? styles.excelRowComplete : ''} ${isMainCurrent ? styles.excelRowCurrent : ''}`}
            onClick={() => handleRowFocus(rowConfig.id)}
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

    // 고정 지출 행: 메인 + 추가 항목 확장 행 (소득/지출 구분선 포함)
    if (rowConfig.id === 'fixed_expenses') {
      return (
        <React.Fragment key={rowConfig.id}>
          {/* 소득/지출 구분 행 */}
          <div className={styles.excelSectionDivider}>
            <div className={styles.excelRowNumber}></div>
            <div className={styles.excelSectionDividerLabel}>지출</div>
            <div className={styles.excelRowInputMulti}></div>
          </div>
          <div
            className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isComplete ? styles.excelRowComplete : ''} ${isCurrent ? styles.excelRowCurrent : ''}`}
            onClick={() => handleRowFocus(rowConfig.id)}
          >
            <div className={styles.excelRowNumber}>
              {isComplete ? <Check size={14} /> : rowNumber}
            </div>
            <div className={styles.excelRowLabel}>{rowConfig.label}</div>
            <div className={styles.excelRowInputMulti}>
              {renderInput(rowConfig.id, isActive)}
            </div>
          </div>
          <FixedExpenseExtensionRows
            data={data}
            onUpdateData={onUpdateData}
            onFocus={handleRowFocus}
          />
        </React.Fragment>
      )
    }

    // 변동 지출 행: 메인 + 추가 항목 확장 행
    if (rowConfig.id === 'variable_expenses') {
      return (
        <React.Fragment key={rowConfig.id}>
          <div
            className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isComplete ? styles.excelRowComplete : ''} ${isCurrent ? styles.excelRowCurrent : ''}`}
            onClick={() => handleRowFocus(rowConfig.id)}
          >
            <div className={styles.excelRowNumber}>
              {isComplete ? <Check size={14} /> : rowNumber}
            </div>
            <div className={styles.excelRowLabel}>{rowConfig.label}</div>
            <div className={styles.excelRowInputMulti}>
              {renderInput(rowConfig.id, isActive)}
            </div>
          </div>
          <VariableExpenseExtensionRows
            data={data}
            onUpdateData={onUpdateData}
            onFocus={handleRowFocus}
          />
        </React.Fragment>
      )
    }

    return (
      <div
        key={rowConfig.id}
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isComplete ? styles.excelRowComplete : ''} ${isCurrent ? styles.excelRowCurrent : ''}`}
        onClick={() => handleRowFocus(rowConfig.id)}
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

  // 섹션이 지정되면 해당 섹션의 행만 필터링 + visibleRows로 프로그레시브하게 표시
  const filteredRows = activeSection
    ? rows.filter(row => sectionRows[activeSection].includes(row.id) && visibleRows.includes(row.id))
    : rows.filter(row => visibleRows.includes(row.id))

  // 완료된 행 개수 계산 (섹션 전체 기준)
  const sectionAllRows = activeSection
    ? rows.filter(row => sectionRows[activeSection].includes(row.id))
    : rows
  const completedCount = sectionAllRows.filter(row => row.isComplete(data)).length
  const totalCount = sectionAllRows.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // 현재 섹션 완료 여부
  const isCurrentSectionComplete = sectionAllRows.every(row => row.isComplete(data))

  // 필수 항목 완료 여부 (basic 섹션의 필수 항목들)
  const requiredRows = rows.filter(row => ['name', 'birth_date', 'spouse', 'children', 'retirement_age', 'retirement_fund'].includes(row.id))
  const allRequiredComplete = requiredRows.every(row => row.isComplete(data))

  // 현재 섹션의 다음 섹션 찾기
  const currentSectionIndex = activeSection ? sections.findIndex(s => s.id === activeSection) : -1
  const nextSection = currentSectionIndex >= 0 && currentSectionIndex < sections.length - 1
    ? sections[currentSectionIndex + 1]
    : null
  const isLastSection = currentSectionIndex === sections.length - 1

  return (
    <div className={styles.excelWrapper}>
      <div className={styles.excelContainer}>
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
        <div className={styles.excelBody}>
          {filteredRows.map(renderRow)}
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
          const isActive = activeSection === section.id

          return (
            <button
              key={section.id}
              className={`${styles.excelSheetTab} ${isActive ? styles.excelSheetTabActive : ''} ${sectionComplete ? styles.excelSheetTabComplete : ''}`}
              onClick={() => onSectionChange?.(section.id)}
            >
              {sectionComplete && <Check size={12} className={styles.excelSheetTabCheck} />}
              {section.shortLabel}
            </button>
          )
        })}
      </div>

      {(onComplete || onSectionChange) && (
        <div className={styles.excelBottomNav}>
          <div className={styles.excelBottomNavInfo}>
            <span className={styles.excelBottomNavCount}>
              {completedCount} / {totalCount} 완료
            </span>
          </div>
          <button
            className={styles.excelBottomNavButton}
            onClick={() => {
              if (isLastSection && onComplete) {
                onComplete()
              } else if (nextSection && onSectionChange) {
                onSectionChange(nextSection.id)
              }
            }}
            disabled={isLastSection ? (isCompleteDisabled || !allRequiredComplete) : !isCurrentSectionComplete}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className={styles.spinner} />
                저장 중...
              </>
            ) : (
              <>
                {isLastSection ? '완료하기' : nextSection?.shortLabel}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
