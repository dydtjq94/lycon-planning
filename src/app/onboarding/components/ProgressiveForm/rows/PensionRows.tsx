'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Plus, X, Check } from 'lucide-react'
import type { OnboardingData, AssetInput } from '@/types'
import type { RowId } from '../types'
import styles from '../../../onboarding.module.css'

// 연금 행 컴포넌트 Props
interface PensionRowsProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  onFocus: (rowId: RowId) => void
  activeRow: RowId
  currentRowId: RowId | null
  baseRowIndex: number
}

// 빈 연금 항목 생성
const createEmptyPension = (subcategory: string, name: string = ''): AssetInput => ({
  name,
  amount: null,
  frequency: subcategory === '국민연금' || subcategory === '기타연금' ? 'monthly' : 'once',
  subcategory,
})

// 연금 행들 렌더링 (국민연금, 퇴직연금, 개인연금, 기타연금 통합)
export function PensionRows({
  data,
  onUpdateData,
  onFocus,
  activeRow,
  currentRowId,
  baseRowIndex,
}: PensionRowsProps) {
  const isActive = activeRow === 'national_pension' || activeRow === 'retirement_pension' ||
                   activeRow === 'personal_pension' || activeRow === 'other_pension'

  // 각 카테고리별 연금 항목 필터링
  const nationalPensions = data.pensions.filter(p => p.subcategory === '국민연금')
  const retirementPensions = data.pensions.filter(p => p.subcategory === '퇴직연금')
  const personalPensions = data.pensions.filter(p => p.subcategory === '개인연금')
  const otherPensions = data.pensions.filter(p => p.subcategory === '기타연금')

  // 완료 조건
  const hasNational = nationalPensions.some(p => p.amount !== null && p.amount > 0)
  const hasRetirement = retirementPensions.some(p => p.amount !== null && p.amount > 0)
  const hasPersonal = personalPensions.some(p => p.amount !== null && p.amount > 0)
  const hasOther = otherPensions.some(p => p.amount !== null && p.amount > 0)
  const isComplete = hasNational || hasRetirement || hasPersonal || hasOther

  // 연금 항목 추가
  const addPension = (subcategory: string, name: string = '') => {
    const newPension = createEmptyPension(subcategory, name)
    onUpdateData({ pensions: [...data.pensions, newPension] })
  }

  // 연금 항목 업데이트
  const updatePension = (index: number, updates: Partial<AssetInput>) => {
    const newPensions = data.pensions.map((p, i) => (i === index ? { ...p, ...updates } : p))
    onUpdateData({ pensions: newPensions })
  }

  // 연금 항목 삭제
  const deletePension = (index: number) => {
    onUpdateData({ pensions: data.pensions.filter((_, i) => i !== index) })
  }

  // 시작하기 (빈 배열일 때 첫 항목 추가)
  const startAddingPension = (subcategory: string, name: string = '') => {
    const newPension = createEmptyPension(subcategory, name)
    onUpdateData({ pensions: [...data.pensions, newPension] })
  }

  // 현재 활성 행 ID 확인
  const isCurrent = (rowId: RowId) => currentRowId === rowId

  return (
    <>
      {/* 국민연금 (1층) */}
      {nationalPensions.length === 0 ? (
        <div
          className={`${styles.excelRow} ${activeRow === 'national_pension' ? styles.excelRowActive : ''} ${isCurrent('national_pension') ? styles.excelRowCurrent : ''}`}
          onClick={() => onFocus('national_pension')}
        >
          <div className={styles.excelRowNumber}>{baseRowIndex}</div>
          <div className={styles.excelRowLabel}>국민연금</div>
          <div className={styles.excelRowInputMulti}>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); startAddingPension('국민연금', '국민연금 (예상)') }}
            >
              <Plus size={14} /> 국민연금 추가
            </span>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); /* 해당없음 - 빈 상태 유지 */ }}
            >
              해당 없음
            </span>
          </div>
        </div>
      ) : (
        nationalPensions.map((pension, idx) => {
          const originalIndex = data.pensions.indexOf(pension)
          const isFirst = idx === 0

          return (
            <div
              key={originalIndex}
              className={`${styles.excelRow} ${!isFirst ? styles.excelRowExtension : ''} ${activeRow === 'national_pension' ? styles.excelRowActive : ''} ${isCurrent('national_pension') && isFirst && !hasNational ? styles.excelRowCurrent : ''}`}
              onClick={() => onFocus('national_pension')}
            >
              <div className={styles.excelRowNumber}>
                {isFirst ? (hasNational ? <Check size={14} /> : baseRowIndex) : null}
              </div>
              <div className={styles.excelRowLabel}>{isFirst ? '국민연금' : ''}</div>
              <div className={styles.excelRowInputMulti}>
                <div className={styles.excelValueCells}>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                    예상 월 수령액
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                    <MoneyInput
                      value={pension.amount}
                      onChange={(value) => updatePension(originalIndex, { amount: value })}
                      placeholder="0"
                      hideSuffix
                      onFocus={() => onFocus('national_pension')}
                      data-filled={pension.amount !== null ? 'true' : undefined}
                    />
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                    만원
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
                    월
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
                    <button onClick={(e) => { e.stopPropagation(); deletePension(originalIndex) }} type="button">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}

      {/* 퇴직연금 (2층) */}
      {retirementPensions.length === 0 ? (
        <div
          className={`${styles.excelRow} ${activeRow === 'retirement_pension' ? styles.excelRowActive : ''} ${isCurrent('retirement_pension') ? styles.excelRowCurrent : ''}`}
          onClick={() => onFocus('retirement_pension')}
        >
          <div className={styles.excelRowNumber}>{baseRowIndex + 1}</div>
          <div className={styles.excelRowLabel}>퇴직연금</div>
          <div className={styles.excelRowInputMulti}>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); startAddingPension('퇴직연금', '퇴직연금 (DC)') }}
            >
              <Plus size={14} /> DC형
            </span>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); startAddingPension('퇴직연금', '퇴직연금 (DB)') }}
            >
              <Plus size={14} /> DB형
            </span>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); startAddingPension('퇴직연금', '퇴직금') }}
            >
              <Plus size={14} /> 퇴직금
            </span>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); /* 해당없음 */ }}
            >
              해당 없음
            </span>
          </div>
        </div>
      ) : (
        <>
          {retirementPensions.map((pension, idx) => {
            const originalIndex = data.pensions.indexOf(pension)
            const isFirst = idx === 0

            return (
              <div
                key={originalIndex}
                className={`${styles.excelRow} ${!isFirst ? styles.excelRowExtension : ''} ${activeRow === 'retirement_pension' ? styles.excelRowActive : ''} ${isCurrent('retirement_pension') && isFirst && !hasRetirement ? styles.excelRowCurrent : ''}`}
                onClick={() => onFocus('retirement_pension')}
              >
                <div className={styles.excelRowNumber}>
                  {isFirst ? (hasRetirement ? <Check size={14} /> : baseRowIndex + 1) : null}
                </div>
                <div className={styles.excelRowLabel}>{isFirst ? '퇴직연금' : ''}</div>
                <div className={styles.excelRowInputMulti}>
                  <div className={styles.excelValueCells}>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                      <select
                        className={styles.pensionTypeSelect}
                        value={pension.name.includes('DB') ? 'DB' : pension.name.includes('DC') ? 'DC' : '퇴직금'}
                        onChange={(e) => {
                          const typeLabel = e.target.value === '퇴직금' ? '퇴직금' : `퇴직연금 (${e.target.value})`
                          updatePension(originalIndex, { name: typeLabel })
                        }}
                      >
                        <option value="DC">DC형</option>
                        <option value="DB">DB형</option>
                        <option value="퇴직금">퇴직금</option>
                      </select>
                    </div>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                      <MoneyInput
                        value={pension.amount}
                        onChange={(value) => updatePension(originalIndex, { amount: value })}
                        placeholder="0"
                        hideSuffix
                        onFocus={() => onFocus('retirement_pension')}
                        data-filled={pension.amount !== null ? 'true' : undefined}
                      />
                    </div>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                      만원
                    </div>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
                      <button onClick={(e) => { e.stopPropagation(); deletePension(originalIndex) }} type="button">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {/* 퇴직연금 추가 버튼 행 */}
          <div
            className={`${styles.excelRow} ${styles.excelRowExtension} ${styles.excelRowAdd} ${activeRow === 'retirement_pension' ? styles.excelRowActive : ''}`}
            onClick={() => onFocus('retirement_pension')}
          >
            <div className={styles.excelRowNumber} />
            <div className={styles.excelRowLabel} />
            <div className={styles.excelRowInputMulti}>
              <span
                className={styles.excelAddText}
                onClick={(e) => { e.stopPropagation(); addPension('퇴직연금', '퇴직연금 (DC)') }}
              >
                <Plus size={14} /> 퇴직연금 추가
              </span>
            </div>
          </div>
        </>
      )}

      {/* 개인연금 (3층) */}
      {personalPensions.length === 0 ? (
        <div
          className={`${styles.excelRow} ${activeRow === 'personal_pension' ? styles.excelRowActive : ''} ${isCurrent('personal_pension') ? styles.excelRowCurrent : ''}`}
          onClick={() => onFocus('personal_pension')}
        >
          <div className={styles.excelRowNumber}>{baseRowIndex + 2}</div>
          <div className={styles.excelRowLabel}>개인연금</div>
          <div className={styles.excelRowInputMulti}>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); startAddingPension('개인연금', 'IRP') }}
            >
              <Plus size={14} /> IRP
            </span>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); startAddingPension('개인연금', '연금저축펀드') }}
            >
              <Plus size={14} /> 연금저축펀드
            </span>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); startAddingPension('개인연금', '연금저축보험') }}
            >
              <Plus size={14} /> 연금저축보험
            </span>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); /* 해당없음 */ }}
            >
              해당 없음
            </span>
          </div>
        </div>
      ) : (
        <>
          {personalPensions.map((pension, idx) => {
            const originalIndex = data.pensions.indexOf(pension)
            const isFirst = idx === 0

            return (
              <div
                key={originalIndex}
                className={`${styles.excelRow} ${!isFirst ? styles.excelRowExtension : ''} ${activeRow === 'personal_pension' ? styles.excelRowActive : ''} ${isCurrent('personal_pension') && isFirst && !hasPersonal ? styles.excelRowCurrent : ''}`}
                onClick={() => onFocus('personal_pension')}
              >
                <div className={styles.excelRowNumber}>
                  {isFirst ? (hasPersonal ? <Check size={14} /> : baseRowIndex + 2) : null}
                </div>
                <div className={styles.excelRowLabel}>{isFirst ? '개인연금' : ''}</div>
                <div className={styles.excelRowInputMulti}>
                  <div className={styles.excelValueCells}>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                      <Input
                        value={pension.name}
                        onChange={(e) => updatePension(originalIndex, { name: e.target.value })}
                        placeholder="연금 종류"
                        className={styles.pensionNameInput}
                        onFocus={() => onFocus('personal_pension')}
                      />
                    </div>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                      <MoneyInput
                        value={pension.amount}
                        onChange={(value) => updatePension(originalIndex, { amount: value })}
                        placeholder="0"
                        hideSuffix
                        onFocus={() => onFocus('personal_pension')}
                        data-filled={pension.amount !== null ? 'true' : undefined}
                      />
                    </div>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                      만원
                    </div>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
                      <button onClick={(e) => { e.stopPropagation(); deletePension(originalIndex) }} type="button">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {/* 개인연금 추가 버튼 행 */}
          <div
            className={`${styles.excelRow} ${styles.excelRowExtension} ${styles.excelRowAdd} ${activeRow === 'personal_pension' ? styles.excelRowActive : ''}`}
            onClick={() => onFocus('personal_pension')}
          >
            <div className={styles.excelRowNumber} />
            <div className={styles.excelRowLabel} />
            <div className={styles.excelRowInputMulti}>
              <span
                className={styles.excelAddText}
                onClick={(e) => { e.stopPropagation(); addPension('개인연금', 'IRP') }}
              >
                <Plus size={14} /> IRP
              </span>
              <span
                className={styles.excelAddText}
                onClick={(e) => { e.stopPropagation(); addPension('개인연금', '연금저축펀드') }}
              >
                <Plus size={14} /> 연금저축펀드
              </span>
            </div>
          </div>
        </>
      )}

      {/* 기타연금 */}
      {otherPensions.length === 0 ? (
        <div
          className={`${styles.excelRow} ${activeRow === 'other_pension' ? styles.excelRowActive : ''} ${isCurrent('other_pension') ? styles.excelRowCurrent : ''}`}
          onClick={() => onFocus('other_pension')}
        >
          <div className={styles.excelRowNumber}>{baseRowIndex + 3}</div>
          <div className={styles.excelRowLabel}>기타연금</div>
          <div className={styles.excelRowInputMulti}>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); startAddingPension('기타연금', '주택연금') }}
            >
              <Plus size={14} /> 주택연금
            </span>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); startAddingPension('기타연금', '농지연금') }}
            >
              <Plus size={14} /> 농지연금
            </span>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); /* 해당없음 */ }}
            >
              해당 없음
            </span>
          </div>
        </div>
      ) : (
        <>
          {otherPensions.map((pension, idx) => {
            const originalIndex = data.pensions.indexOf(pension)
            const isFirst = idx === 0

            return (
              <div
                key={originalIndex}
                className={`${styles.excelRow} ${!isFirst ? styles.excelRowExtension : ''} ${activeRow === 'other_pension' ? styles.excelRowActive : ''} ${isCurrent('other_pension') && isFirst && !hasOther ? styles.excelRowCurrent : ''}`}
                onClick={() => onFocus('other_pension')}
              >
                <div className={styles.excelRowNumber}>
                  {isFirst ? (hasOther ? <Check size={14} /> : baseRowIndex + 3) : null}
                </div>
                <div className={styles.excelRowLabel}>{isFirst ? '기타연금' : ''}</div>
                <div className={styles.excelRowInputMulti}>
                  <div className={styles.excelValueCells}>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                      <Input
                        value={pension.name}
                        onChange={(e) => updatePension(originalIndex, { name: e.target.value })}
                        placeholder="연금 종류"
                        className={styles.pensionNameInput}
                        onFocus={() => onFocus('other_pension')}
                      />
                    </div>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                      <MoneyInput
                        value={pension.amount}
                        onChange={(value) => updatePension(originalIndex, { amount: value })}
                        placeholder="0"
                        hideSuffix
                        onFocus={() => onFocus('other_pension')}
                        data-filled={pension.amount !== null ? 'true' : undefined}
                      />
                    </div>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                      만원
                    </div>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
                      월
                    </div>
                    <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
                      <button onClick={(e) => { e.stopPropagation(); deletePension(originalIndex) }} type="button">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {/* 기타연금 추가 버튼 행 */}
          <div
            className={`${styles.excelRow} ${styles.excelRowExtension} ${styles.excelRowAdd} ${activeRow === 'other_pension' ? styles.excelRowActive : ''}`}
            onClick={() => onFocus('other_pension')}
          >
            <div className={styles.excelRowNumber} />
            <div className={styles.excelRowLabel} />
            <div className={styles.excelRowInputMulti}>
              <span
                className={styles.excelAddText}
                onClick={(e) => { e.stopPropagation(); addPension('기타연금', '') }}
              >
                <Plus size={14} /> 기타연금 추가
              </span>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// 기존 render 함수들 (하위 호환성을 위해 유지하지만 실제로는 사용 안함)
export function renderNationalPensionInput() { return null }
export function renderRetirementPensionInput() { return null }
export function renderPersonalPensionInput() { return null }
export function renderOtherPensionInput() { return null }
