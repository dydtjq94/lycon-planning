'use client'

import React from 'react'
import { Check } from 'lucide-react'
import { MoneyInput } from '@/components/ui/money-input'
import type { OnboardingData } from '@/types'
import type { RowId } from '../types'
import { formatMoney } from '../utils'
import styles from '../../../onboarding.module.css'

// 연금 행 컴포넌트 Props
interface PensionRowsProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  onFocus: (rowId: RowId) => void
  activeRow: RowId
  currentRowId: RowId | null
  baseRowIndex: number
  visibleRows: RowId[]
}

// 연금 행들 렌더링 (국민연금, 퇴직연금, 개인연금, 기타연금 통합)
export function PensionRows({
  data,
  onUpdateData,
  onFocus,
  activeRow,
  currentRowId,
  baseRowIndex,
  visibleRows,
}: PensionRowsProps) {
  // 완료 조건
  const hasNational = data.nationalPension != null && data.nationalPension > 0
  const hasRetirement = data.retirementPensionBalance != null && data.retirementPensionBalance > 0
  const hasPersonal = data.personalPensionBalance != null && data.personalPensionBalance > 0
  const hasOther = data.otherPensionMonthly != null && data.otherPensionMonthly > 0

  // 현재 활성 행 ID 확인
  const isCurrent = (rowId: RowId) => currentRowId === rowId

  // 해당 행이 보여야 하는지 확인
  const isVisible = (rowId: RowId) => visibleRows.includes(rowId)

  return (
    <>
      {/* 국민연금 (1층) */}
      {isVisible('national_pension') && (
        <div
          className={`${styles.excelRow} ${activeRow === 'national_pension' ? styles.excelRowActive : ''} ${isCurrent('national_pension') && !hasNational ? styles.excelRowCurrent : ''}`}
          onClick={() => onFocus('national_pension')}
          data-current={isCurrent('national_pension') && !hasNational ? 'true' : undefined}
        >
          <div className={styles.excelRowNumber}>
            {hasNational ? <Check size={14} /> : baseRowIndex}
          </div>
          <div className={styles.excelRowLabel}>국민연금</div>
          <div className={styles.excelRowInputMulti}>
            <div className={styles.excelValueCells}>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                예상 월 수령액
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                <MoneyInput
                  value={data.nationalPension}
                  onChange={(value) => onUpdateData({ nationalPension: value, hasNoPension: false })}
                  placeholder="0"
                  hideSuffix
                  onFocus={() => onFocus('national_pension')}
                  data-filled={data.nationalPension != null ? 'true' : undefined}
                />
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                만원
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
                월
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
            </div>
          </div>
        </div>
      )}

      {/* 퇴직연금 (2층) */}
      {isVisible('retirement_pension') && (
        <div
          className={`${styles.excelRow} ${activeRow === 'retirement_pension' ? styles.excelRowActive : ''} ${isCurrent('retirement_pension') && !hasRetirement ? styles.excelRowCurrent : ''}`}
          onClick={() => onFocus('retirement_pension')}
          data-current={isCurrent('retirement_pension') && !hasRetirement ? 'true' : undefined}
        >
          <div className={styles.excelRowNumber}>
            {hasRetirement ? <Check size={14} /> : baseRowIndex + 1}
          </div>
          <div className={styles.excelRowLabel}>퇴직연금</div>
          <div className={styles.excelRowInputMulti}>
            <div className={styles.excelValueCells}>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                <select
                  className={styles.pensionTypeSelect}
                  value={data.retirementPensionType || ''}
                  onChange={(e) => onUpdateData({
                    retirementPensionType: e.target.value as 'DB' | 'DC' | null || null,
                    hasNoPension: false
                  })}
                >
                  <option value="">유형 선택</option>
                  <option value="DC">DC형</option>
                  <option value="DB">DB형</option>
                </select>
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                <MoneyInput
                  value={data.retirementPensionBalance}
                  onChange={(value) => onUpdateData({ retirementPensionBalance: value, hasNoPension: false })}
                  placeholder="0"
                  hideSuffix
                  onFocus={() => onFocus('retirement_pension')}
                  data-filled={data.retirementPensionBalance != null ? 'true' : undefined}
                />
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                만원
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
                {data.retirementPensionBalance != null && data.retirementPensionBalance > 0 && (
                  <span className={styles.excelCalculatedSmall}>
                    {formatMoney(data.retirementPensionBalance)}
                  </span>
                )}
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
            </div>
          </div>
        </div>
      )}

      {/* 개인연금 (3층) - 월 납입액 행 */}
      {isVisible('personal_pension') && (
        <>
          <div
            className={`${styles.excelRow} ${activeRow === 'personal_pension' ? styles.excelRowActive : ''} ${isCurrent('personal_pension') && !hasPersonal ? styles.excelRowCurrent : ''}`}
            onClick={() => onFocus('personal_pension')}
            data-current={isCurrent('personal_pension') && !hasPersonal ? 'true' : undefined}
          >
            <div className={styles.excelRowNumber}>
              {hasPersonal ? <Check size={14} /> : baseRowIndex + 2}
            </div>
            <div className={styles.excelRowLabel}>개인연금</div>
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                  월 납입액
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                  <MoneyInput
                    value={data.personalPensionMonthly}
                    onChange={(value) => onUpdateData({ personalPensionMonthly: value, hasNoPension: false })}
                    placeholder="0"
                    hideSuffix
                    onFocus={() => onFocus('personal_pension')}
                    data-filled={data.personalPensionMonthly != null ? 'true' : undefined}
                  />
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                  만원
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
                  월
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
              </div>
            </div>
          </div>

          {/* 개인연금 - 현재 적립금 행 */}
          <div
            className={`${styles.excelRow} ${styles.excelRowExtension} ${activeRow === 'personal_pension' ? styles.excelRowActive : ''} ${isCurrent('personal_pension') && !hasPersonal ? styles.excelRowCurrent : ''}`}
            onClick={() => onFocus('personal_pension')}
            data-current={isCurrent('personal_pension') && !hasPersonal ? 'true' : undefined}
          >
            <div className={styles.excelRowNumber} />
            <div className={styles.excelRowLabel} />
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                  현재 적립금
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                  <MoneyInput
                    value={data.personalPensionBalance}
                    onChange={(value) => onUpdateData({ personalPensionBalance: value, hasNoPension: false })}
                    placeholder="0"
                    hideSuffix
                    onFocus={() => onFocus('personal_pension')}
                    data-filled={data.personalPensionBalance != null ? 'true' : undefined}
                  />
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                  만원
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
                  {data.personalPensionBalance != null && data.personalPensionBalance > 0 && (
                    <span className={styles.excelCalculatedSmall}>
                      {formatMoney(data.personalPensionBalance)}
                    </span>
                  )}
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* 기타연금 */}
      {isVisible('other_pension') && (
        <div
          className={`${styles.excelRow} ${activeRow === 'other_pension' ? styles.excelRowActive : ''} ${isCurrent('other_pension') && !hasOther ? styles.excelRowCurrent : ''}`}
          onClick={() => onFocus('other_pension')}
          data-current={isCurrent('other_pension') && !hasOther ? 'true' : undefined}
        >
          <div className={styles.excelRowNumber}>
            {hasOther ? <Check size={14} /> : baseRowIndex + 3}
          </div>
          <div className={styles.excelRowLabel}>기타연금</div>
          <div className={styles.excelRowInputMulti}>
            <div className={styles.excelValueCells}>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                예상 월 수령액
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                <MoneyInput
                  value={data.otherPensionMonthly}
                  onChange={(value) => onUpdateData({ otherPensionMonthly: value, hasNoPension: false })}
                  placeholder="0"
                  hideSuffix
                  onFocus={() => onFocus('other_pension')}
                  data-filled={data.otherPensionMonthly != null ? 'true' : undefined}
                />
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                만원
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
                월
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// 기존 render 함수들 (하위 호환성을 위해 유지하지만 실제로는 사용 안함)
export function renderNationalPensionInput() { return null }
export function renderRetirementPensionInput() { return null }
export function renderPersonalPensionInput() { return null }
export function renderOtherPensionInput() { return null }
