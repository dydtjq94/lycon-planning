'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Plus, X, Check } from 'lucide-react'
import type { OnboardingData, AssetInput, Frequency, DebtInput } from '@/types'
import type { RowId, AssetRowInputProps, frequencyLabels } from '../types'
import { calculateMonthlyTotal, calculateTotalValue, formatMoney } from '../utils'
import styles from '../../../onboarding.module.css'

interface AssetDebtRowsProps extends AssetRowInputProps {
  frequencyLabels: typeof frequencyLabels
}

// 부동산 행 컴포넌트 Props
interface RealEstateRowsProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  onFocus: (rowId: RowId) => void
  activeRow: RowId
  currentRowId: RowId | null
  baseRowIndex: number
}

// 거주용 부동산 행들 렌더링
export function RealEstateRows({
  data,
  onUpdateData,
  onFocus,
  activeRow,
  currentRowId,
  baseRowIndex,
}: RealEstateRowsProps) {
  const isActive = activeRow === 'realEstate'
  const isCurrent = currentRowId === 'realEstate'
  const housingType = data.housingType

  // 각 필드 입력 완료 여부
  const isValueFilled = data.housingValue !== null && data.housingValue > 0
  const isRentFilled = data.housingRent !== null && data.housingRent > 0
  const isLoanFilled = data.housingLoan !== null && data.housingLoan > 0

  // 월세의 경우 보증금 + 월세 둘 다 필요
  const isMonthlyRentComplete = housingType === '월세' ? (isValueFilled && isRentFilled) : isValueFilled

  // 완료 조건: 타입 선택됨 + (해당없음 or 필수 금액 입력됨) + (대출 추가했으면 대출도 입력됨)
  const isComplete = housingType === '해당없음' ||
    (housingType !== null && isMonthlyRentComplete && (!data.housingHasLoan || isLoanFilled))

  // 현재 입력해야 할 단계 결정
  // 1. 보증금/시세 미입력 → 메인 행 강조
  // 2. 월세인데 월세+관리비 미입력 → 월세 행 강조
  // 3. 대출 추가했는데 대출금액 미입력 → 대출 행 강조
  const needsValue = !isValueFilled
  const needsRent = housingType === '월세' && isValueFilled && !isRentFilled
  const needsLoan = data.housingHasLoan && isMonthlyRentComplete && !isLoanFilled

  const selectHousingType = (type: '자가' | '전세' | '월세' | '해당없음') => {
    onUpdateData({
      housingType: type,
      housingValue: null,
      housingRent: null,
      housingHasLoan: false,
      housingLoan: null,
      housingLoanRate: null,
      housingLoanMaturity: null,
      housingLoanType: null,
    })
  }

  const resetHousingType = () => {
    onUpdateData({
      housingType: null,
      housingValue: null,
      housingRent: null,
      housingHasLoan: false,
      housingLoan: null,
      housingLoanRate: null,
      housingLoanMaturity: null,
      housingLoanType: null,
    })
  }

  const addLoan = () => {
    onUpdateData({ housingHasLoan: true })
  }

  const removeLoan = () => {
    onUpdateData({
      housingHasLoan: false,
      housingLoan: null,
      housingLoanRate: null,
      housingLoanMaturity: null,
      housingLoanType: null,
    })
  }

  // 아직 선택 안됨: 자가 / 전세 / 월세 / 해당 없음 버튼 표시
  if (housingType === null) {
    return (
      <div
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isCurrent ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('realEstate')}
      >
        <div className={styles.excelRowNumber}>{baseRowIndex}</div>
        <div className={styles.excelRowLabel}>거주 부동산</div>
        <div className={styles.excelRowInputMulti}>
          <span
            className={styles.excelAddText}
            onClick={(e) => { e.stopPropagation(); selectHousingType('자가') }}
          >
            <Plus size={14} /> 자가
          </span>
          <span
            className={styles.excelAddText}
            onClick={(e) => { e.stopPropagation(); selectHousingType('전세') }}
          >
            <Plus size={14} /> 전세
          </span>
          <span
            className={styles.excelAddText}
            onClick={(e) => { e.stopPropagation(); selectHousingType('월세') }}
          >
            <Plus size={14} /> 월세 (반전세)
          </span>
          <span
            className={styles.excelAddText}
            onClick={(e) => { e.stopPropagation(); selectHousingType('해당없음') }}
          >
            해당 없음
          </span>
        </div>
      </div>
    )
  }

  // 해당 없음 선택됨
  if (housingType === '해당없음') {
    return (
      <div
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''}`}
        onClick={() => onFocus('realEstate')}
      >
        <div className={styles.excelRowNumber}>
          <Check size={14} />
        </div>
        <div className={styles.excelRowLabel}>거주 부동산</div>
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
              해당 없음
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`} />
            <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`} />
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
            <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
              <button onClick={(e) => { e.stopPropagation(); resetHousingType() }} type="button">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 대출 라벨 결정
  const loanLabel = housingType === '자가' ? '주택담보대출' : '전월세보증금대출'
  // 메인 값 라벨 결정
  const valueLabel = housingType === '자가' ? '시세' : '보증금'

  return (
    <>
      {/* 메인 행: 거주 부동산 정보 */}
      <div
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isCurrent && needsValue ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('realEstate')}
      >
        <div className={styles.excelRowNumber}>
          {isComplete ? <Check size={14} /> : baseRowIndex}
        </div>
        <div className={styles.excelRowLabel}>거주 부동산</div>
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
              {housingType} {valueLabel}
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
              <MoneyInput
                value={data.housingValue}
                onChange={(value) => onUpdateData({ housingValue: value })}
                placeholder="0"
                hideSuffix
                onFocus={() => onFocus('realEstate')}
                data-filled={data.housingValue !== null ? 'true' : undefined}
              />
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
              만원
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
              {data.housingValue !== null && data.housingValue > 0 && (
                <span className={styles.excelCalculatedSmall}>
                  {formatMoney(data.housingValue)}
                </span>
              )}
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
              <button onClick={(e) => { e.stopPropagation(); resetHousingType() }} type="button">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 월세인 경우: 월세+관리비 행 */}
      {housingType === '월세' && (
        <div
          className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''} ${isCurrent && needsRent ? styles.excelRowCurrent : ''}`}
          onClick={() => onFocus('realEstate')}
        >
          <div className={styles.excelRowNumber} />
          <div className={styles.excelRowLabel} />
          <div className={styles.excelRowInputMulti}>
            <div className={styles.excelValueCells}>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                월세+관리비
              </div>
              <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                <MoneyInput
                  value={data.housingRent}
                  onChange={(value) => onUpdateData({ housingRent: value })}
                  placeholder="0"
                  hideSuffix
                  onFocus={() => onFocus('realEstate')}
                  data-filled={data.housingRent !== null ? 'true' : undefined}
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

      {/* 대출 행들: 대출이 있는 경우 */}
      {data.housingHasLoan && (
        <>
          {/* 대출 금액 행 */}
          <div
            className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''} ${isCurrent && needsLoan ? styles.excelRowCurrent : ''}`}
            onClick={() => onFocus('realEstate')}
          >
            <div className={styles.excelRowNumber} />
            <div className={styles.excelRowLabel} />
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                  {loanLabel}
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                  <MoneyInput
                    value={data.housingLoan}
                    onChange={(value) => onUpdateData({ housingLoan: value })}
                    placeholder="0"
                    hideSuffix
                    onFocus={() => onFocus('realEstate')}
                    data-filled={data.housingLoan !== null ? 'true' : undefined}
                  />
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                  만원
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
                  {data.housingLoan !== null && data.housingLoan > 0 && (
                    <span className={styles.excelCalculatedSmall}>
                      {formatMoney(data.housingLoan)}
                    </span>
                  )}
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
                  <button onClick={(e) => { e.stopPropagation(); removeLoan() }} type="button">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 대출 금리 행 */}
          <div
            className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''}`}
            onClick={() => onFocus('realEstate')}
          >
            <div className={styles.excelRowNumber} />
            <div className={styles.excelRowLabel} />
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                  금리
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                  <Input
                    type="number"
                    step="0.1"
                    value={data.housingLoanRate ?? ''}
                    onChange={(e) => onUpdateData({ housingLoanRate: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="0.0"
                    onFocus={() => onFocus('realEstate')}
                    data-filled={data.housingLoanRate !== null ? 'true' : undefined}
                  />
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                  %
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
                <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
              </div>
            </div>
          </div>

          {/* 대출 만기 행 */}
          <div
            className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''}`}
            onClick={() => onFocus('realEstate')}
          >
            <div className={styles.excelRowNumber} />
            <div className={styles.excelRowLabel} />
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                  만기
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                  <Input
                    type="month"
                    value={data.housingLoanMaturity ?? ''}
                    onChange={(e) => onUpdateData({ housingLoanMaturity: e.target.value || null })}
                    onFocus={() => onFocus('realEstate')}
                    data-filled={data.housingLoanMaturity !== null ? 'true' : undefined}
                  />
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`} />
                <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
                <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
              </div>
            </div>
          </div>

          {/* 상환방식 행 */}
          <div
            className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''}`}
            onClick={() => onFocus('realEstate')}
          >
            <div className={styles.excelRowNumber} />
            <div className={styles.excelRowLabel} />
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                  상환방식
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                  <select
                    className={styles.loanTypeSelect}
                    value={data.housingLoanType ?? ''}
                    onChange={(e) => onUpdateData({ housingLoanType: (e.target.value || null) as typeof data.housingLoanType })}
                    onFocus={() => onFocus('realEstate')}
                    data-filled={data.housingLoanType !== null ? 'true' : undefined}
                  >
                    <option value="">선택</option>
                    <option value="만기일시상환">만기일시상환</option>
                    <option value="원리금균등상환">원리금균등상환</option>
                    <option value="원금균등상환">원금균등상환</option>
                    <option value="거치식상환">거치식상환</option>
                  </select>
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`} />
                <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
                <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* 대출 추가 버튼 행 */}
      {!data.housingHasLoan && (
        <div
          className={`${styles.excelRow} ${styles.excelRowExtension} ${styles.excelRowAdd} ${isActive ? styles.excelRowActive : ''}`}
          onClick={() => onFocus('realEstate')}
        >
          <div className={styles.excelRowNumber} />
          <div className={styles.excelRowLabel} />
          <div className={styles.excelRowInputMulti}>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); addLoan() }}
            >
              <Plus size={14} /> {loanLabel} 추가
            </span>
          </div>
        </div>
      )}
    </>
  )
}

// 금융자산 행 컴포넌트 Props
interface FinancialAssetRowsProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  onFocus: (rowId: RowId) => void
  activeRow: RowId
  currentRowId: RowId | null
  baseRowIndex: number
}

// 금융자산 행들 렌더링 (현금성 자산 + 투자자산)
export function FinancialAssetRows({
  data,
  onUpdateData,
  onFocus,
  activeRow,
  currentRowId,
  baseRowIndex,
}: FinancialAssetRowsProps) {
  const isActive = activeRow === 'asset'
  const isCurrent = currentRowId === 'asset'

  // 완료 조건: 현금성 자산 또는 투자자산 중 하나라도 입력
  const hasCash = (data.cashCheckingAccount !== null && data.cashCheckingAccount > 0) ||
                  (data.cashSavingsAccount !== null && data.cashSavingsAccount > 0)
  const hasInvest = (data.investDomesticStock !== null && data.investDomesticStock > 0) ||
                    (data.investForeignStock !== null && data.investForeignStock > 0) ||
                    (data.investFund !== null && data.investFund > 0) ||
                    (data.investOther !== null && data.investOther > 0)
  const isComplete = hasCash || hasInvest

  // 첫 번째 미입력 항목 찾기 (현재 입력해야 할 행 결정)
  const needsChecking = data.cashCheckingAccount === null
  const needsSavings = !needsChecking && data.cashSavingsAccount === null
  const needsDomestic = !needsChecking && !needsSavings && data.investDomesticStock === null
  const needsForeign = !needsDomestic && data.investForeignStock === null
  const needsFund = !needsForeign && data.investFund === null
  const needsOther = !needsFund && data.investOther === null

  return (
    <>
      {/* 현금성 자산 - 입출금통장 */}
      <div
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isCurrent && needsChecking && !isComplete ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('asset')}
      >
        <div className={styles.excelRowNumber}>
          {isComplete ? <Check size={14} /> : baseRowIndex}
        </div>
        <div className={styles.excelRowLabel}>현금성 자산</div>
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
              입출금통장
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
              <MoneyInput
                value={data.cashCheckingAccount}
                onChange={(value) => onUpdateData({ cashCheckingAccount: value })}
                placeholder="0"
                hideSuffix
                onFocus={() => onFocus('asset')}
                data-filled={data.cashCheckingAccount !== null ? 'true' : undefined}
              />
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
              만원
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
              {data.cashCheckingAccount !== null && data.cashCheckingAccount > 0 && (
                <span className={styles.excelCalculatedSmall}>
                  {formatMoney(data.cashCheckingAccount)}
                </span>
              )}
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
          </div>
        </div>
      </div>

      {/* 현금성 자산 - 정기예금/적금 */}
      <div
        className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''} ${isCurrent && needsSavings && !isComplete ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('asset')}
      >
        <div className={styles.excelRowNumber} />
        <div className={styles.excelRowLabel} />
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
              정기예금/적금
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
              <MoneyInput
                value={data.cashSavingsAccount}
                onChange={(value) => onUpdateData({ cashSavingsAccount: value })}
                placeholder="0"
                hideSuffix
                onFocus={() => onFocus('asset')}
                data-filled={data.cashSavingsAccount !== null ? 'true' : undefined}
              />
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
              만원
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
              {data.cashSavingsAccount !== null && data.cashSavingsAccount > 0 && (
                <span className={styles.excelCalculatedSmall}>
                  {formatMoney(data.cashSavingsAccount)}
                </span>
              )}
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
          </div>
        </div>
      </div>

      {/* 투자자산 - 국내주식 및 ETF */}
      <div
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isCurrent && needsDomestic && !isComplete ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('asset')}
      >
        <div className={styles.excelRowNumber} />
        <div className={styles.excelRowLabel}>투자자산</div>
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
              국내주식/ETF
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
              <MoneyInput
                value={data.investDomesticStock}
                onChange={(value) => onUpdateData({ investDomesticStock: value })}
                placeholder="0"
                hideSuffix
                onFocus={() => onFocus('asset')}
                data-filled={data.investDomesticStock !== null ? 'true' : undefined}
              />
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
              만원
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
              {data.investDomesticStock !== null && data.investDomesticStock > 0 && (
                <span className={styles.excelCalculatedSmall}>
                  {formatMoney(data.investDomesticStock)}
                </span>
              )}
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
          </div>
        </div>
      </div>

      {/* 투자자산 - 해외주식 및 ETF */}
      <div
        className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''} ${isCurrent && needsForeign && !isComplete ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('asset')}
      >
        <div className={styles.excelRowNumber} />
        <div className={styles.excelRowLabel} />
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
              해외주식/ETF
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
              <MoneyInput
                value={data.investForeignStock}
                onChange={(value) => onUpdateData({ investForeignStock: value })}
                placeholder="0"
                hideSuffix
                onFocus={() => onFocus('asset')}
                data-filled={data.investForeignStock !== null ? 'true' : undefined}
              />
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
              만원
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
              {data.investForeignStock !== null && data.investForeignStock > 0 && (
                <span className={styles.excelCalculatedSmall}>
                  {formatMoney(data.investForeignStock)}
                </span>
              )}
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
          </div>
        </div>
      </div>

      {/* 투자자산 - 펀드 및 채권 */}
      <div
        className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''} ${isCurrent && needsFund && !isComplete ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('asset')}
      >
        <div className={styles.excelRowNumber} />
        <div className={styles.excelRowLabel} />
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
              펀드/채권
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
              <MoneyInput
                value={data.investFund}
                onChange={(value) => onUpdateData({ investFund: value })}
                placeholder="0"
                hideSuffix
                onFocus={() => onFocus('asset')}
                data-filled={data.investFund !== null ? 'true' : undefined}
              />
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
              만원
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
              {data.investFund !== null && data.investFund > 0 && (
                <span className={styles.excelCalculatedSmall}>
                  {formatMoney(data.investFund)}
                </span>
              )}
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
          </div>
        </div>
      </div>

      {/* 투자자산 - 기타 (가상화폐, P2P 등) */}
      <div
        className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''} ${isCurrent && needsOther && !isComplete ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('asset')}
      >
        <div className={styles.excelRowNumber} />
        <div className={styles.excelRowLabel} />
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
              기타 투자자산
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
              <MoneyInput
                value={data.investOther}
                onChange={(value) => onUpdateData({ investOther: value })}
                placeholder="0"
                hideSuffix
                onFocus={() => onFocus('asset')}
                data-filled={data.investOther !== null ? 'true' : undefined}
              />
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
              만원
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
              {data.investOther !== null && data.investOther > 0 && (
                <span className={styles.excelCalculatedSmall}>
                  {formatMoney(data.investOther)}
                </span>
              )}
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
          </div>
        </div>
      </div>
    </>
  )
}

// 금융자산 입력 (기존 - deprecated)
export function renderAssetInput({ data, onFocus, addAssetItem, updateAssetItem, deleteAssetItem, frequencyLabels }: AssetDebtRowsProps) {
  const items = data.assets
  const total = calculateTotalValue(items)

  return (
    <div className={styles.excelAssetRow}>
      {items.map((item, index) => (
        <div key={index} className={styles.excelAssetItem}>
          <Input
            placeholder="항목명"
            value={item.name}
            onChange={(e) => updateAssetItem('assets', index, { name: e.target.value })}
            onFocus={() => onFocus('asset')}
          />
          <MoneyInput
            value={item.amount}
            onChange={(value) => updateAssetItem('assets', index, { amount: value })}
            placeholder="0"
          />
          <select
            className={styles.excelFrequency}
            value={item.frequency}
            onChange={(e) => updateAssetItem('assets', index, { frequency: e.target.value as Frequency })}
          >
            {Object.entries(frequencyLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            className={styles.excelDeleteBtn}
            onClick={() => deleteAssetItem('assets', index)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button className={styles.excelAddSmall} onClick={() => addAssetItem('assets')}>
        <Plus size={14} /> 추가
      </button>
      {total > 0 && (
        <span className={styles.excelTotal}>
          총 합계: {formatMoney(total)}
        </span>
      )}
    </div>
  )
}

// 부채 행 컴포넌트 Props
interface DebtRowsProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  onFocus: (rowId: RowId) => void
  activeRow: RowId
  currentRowId: RowId | null
  baseRowIndex: number
}

// 빈 부채 항목 생성
const createEmptyDebt = (): DebtInput => ({
  name: '',
  amount: null,
  rate: null,
  maturity: null,
  repaymentType: null,
})

// 부채 행들 렌더링
export function DebtRows({
  data,
  onUpdateData,
  onFocus,
  activeRow,
  currentRowId,
  baseRowIndex,
}: DebtRowsProps) {
  const isActive = activeRow === 'debt'
  const isCurrent = currentRowId === 'debt'
  const debts = data.debts

  // 완료 조건: 하나 이상의 부채 항목이 이름과 금액이 입력됨
  const isComplete = debts.some(d => d.name && d.name.trim() !== '' && d.amount !== null && d.amount > 0)

  // 부채 항목 추가
  const addDebt = () => {
    onUpdateData({ debts: [...debts, createEmptyDebt()] })
  }

  // 부채 항목 업데이트
  const updateDebt = (index: number, updates: Partial<DebtInput>) => {
    const newDebts = debts.map((d, i) => (i === index ? { ...d, ...updates } : d))
    onUpdateData({ debts: newDebts })
  }

  // 부채 항목 삭제
  const deleteDebt = (index: number) => {
    if (debts.length <= 1) {
      // 마지막 항목 삭제 시 빈 배열로 → 초기 버튼 UI로 복귀
      onUpdateData({ debts: [] })
    } else {
      onUpdateData({ debts: debts.filter((_, i) => i !== index) })
    }
  }

  // 부채 항목 처음 추가 (빈 배열일 때)
  const startAddingDebt = () => {
    onUpdateData({ debts: [createEmptyDebt()] })
  }

  // 부채가 없으면 추가 버튼만 표시
  if (debts.length === 0) {
    return (
      <div
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isCurrent ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('debt')}
      >
        <div className={styles.excelRowNumber}>{baseRowIndex}</div>
        <div className={styles.excelRowLabel}>부채</div>
        <div className={styles.excelRowInputMulti}>
          <span
            className={styles.excelAddText}
            onClick={(e) => { e.stopPropagation(); startAddingDebt() }}
          >
            <Plus size={14} /> 부채 추가
          </span>
          <span
            className={styles.excelAddText}
            onClick={(e) => { e.stopPropagation(); /* 해당없음 처리 - 빈 상태 유지 */ }}
          >
            해당 없음
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      {debts.map((debt, index) => {
        const isFirstDebt = index === 0
        const needsAmount = debt.name && debt.name.trim() !== '' && debt.amount === null

        return (
          <React.Fragment key={index}>
            {/* 부채 항목 - 이름 + 금액 행 */}
            <div
              className={`${styles.excelRow} ${!isFirstDebt ? styles.excelRowExtension : ''} ${isActive ? styles.excelRowActive : ''} ${isCurrent && isFirstDebt && !isComplete ? styles.excelRowCurrent : ''}`}
              onClick={() => onFocus('debt')}
            >
              <div className={styles.excelRowNumber}>
                {isFirstDebt ? (isComplete ? <Check size={14} /> : baseRowIndex) : null}
              </div>
              <div className={styles.excelRowLabel}>{isFirstDebt ? '부채' : ''}</div>
              <div className={styles.excelRowInputMulti}>
                <div className={styles.excelValueCells}>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                    <Input
                      value={debt.name}
                      onChange={(e) => updateDebt(index, { name: e.target.value })}
                      placeholder="부채명 입력"
                      className={styles.debtNameInput}
                      onFocus={() => onFocus('debt')}
                    />
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                    <MoneyInput
                      value={debt.amount}
                      onChange={(value) => updateDebt(index, { amount: value })}
                      placeholder="0"
                      hideSuffix
                      onFocus={() => onFocus('debt')}
                      data-filled={debt.amount !== null ? 'true' : undefined}
                    />
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                    만원
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`}>
                    {debt.amount !== null && debt.amount > 0 && (
                      <span className={styles.excelCalculatedSmall}>
                        {formatMoney(debt.amount)}
                      </span>
                    )}
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
                    <button onClick={(e) => { e.stopPropagation(); deleteDebt(index) }} type="button">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 금리 행 */}
            <div
              className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''}`}
              onClick={() => onFocus('debt')}
            >
              <div className={styles.excelRowNumber} />
              <div className={styles.excelRowLabel} />
              <div className={styles.excelRowInputMulti}>
                <div className={styles.excelValueCells}>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                    금리
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                    <Input
                      type="number"
                      step="0.1"
                      value={debt.rate ?? ''}
                      onChange={(e) => updateDebt(index, { rate: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="0.0"
                      onFocus={() => onFocus('debt')}
                      data-filled={debt.rate !== null ? 'true' : undefined}
                    />
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                    %
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
                </div>
              </div>
            </div>

            {/* 만기 행 */}
            <div
              className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''}`}
              onClick={() => onFocus('debt')}
            >
              <div className={styles.excelRowNumber} />
              <div className={styles.excelRowLabel} />
              <div className={styles.excelRowInputMulti}>
                <div className={styles.excelValueCells}>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                    만기
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                    <Input
                      type="month"
                      value={debt.maturity ?? ''}
                      onChange={(e) => updateDebt(index, { maturity: e.target.value || null })}
                      onFocus={() => onFocus('debt')}
                      data-filled={debt.maturity !== null ? 'true' : undefined}
                    />
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`} />
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
                </div>
              </div>
            </div>

            {/* 상환방식 행 */}
            <div
              className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''}`}
              onClick={() => onFocus('debt')}
            >
              <div className={styles.excelRowNumber} />
              <div className={styles.excelRowLabel} />
              <div className={styles.excelRowInputMulti}>
                <div className={styles.excelValueCells}>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                    상환방식
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                    <select
                      className={styles.loanTypeSelect}
                      value={debt.repaymentType ?? ''}
                      onChange={(e) => updateDebt(index, { repaymentType: (e.target.value || null) as DebtInput['repaymentType'] })}
                      onFocus={() => onFocus('debt')}
                      data-filled={debt.repaymentType !== null ? 'true' : undefined}
                    >
                      <option value="">선택</option>
                      <option value="만기일시상환">만기일시상환</option>
                      <option value="원리금균등상환">원리금균등상환</option>
                      <option value="원금균등상환">원금균등상환</option>
                      <option value="거치식상환">거치식상환</option>
                    </select>
                  </div>
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`} />
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`} />
                </div>
              </div>
            </div>
          </React.Fragment>
        )
      })}

      {/* 부채 추가 버튼 행 */}
      <div
        className={`${styles.excelRow} ${styles.excelRowExtension} ${styles.excelRowAdd} ${isActive ? styles.excelRowActive : ''}`}
        onClick={() => onFocus('debt')}
      >
        <div className={styles.excelRowNumber} />
        <div className={styles.excelRowLabel} />
        <div className={styles.excelRowInputMulti}>
          <span
            className={styles.excelAddText}
            onClick={(e) => { e.stopPropagation(); addDebt() }}
          >
            <Plus size={14} /> 부채 추가
          </span>
        </div>
      </div>
    </>
  )
}

