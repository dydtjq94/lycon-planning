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
        data-current={isCurrent ? 'true' : undefined}
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
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${styles.excelRowComplete}`}
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
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isComplete ? styles.excelRowComplete : ''} ${isCurrent && needsValue ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('realEstate')}
        data-current={isCurrent && needsValue ? 'true' : undefined}
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
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
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
          data-current={isCurrent && needsRent ? 'true' : undefined}
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

      {/* 대출 행: 대출이 있는 경우 */}
      {data.housingHasLoan && (
        <div
          className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''} ${isCurrent && needsLoan ? styles.excelRowCurrent : ''}`}
          onClick={() => onFocus('realEstate')}
          data-current={isCurrent && needsLoan ? 'true' : undefined}
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
              <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
              <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
                <button onClick={(e) => { e.stopPropagation(); removeLoan() }} type="button">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
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

// 금융자산 타입 정의
const assetTypeConfig = [
  { key: 'checking', label: '입출금통장', category: 'cash', dataKey: 'cashCheckingAccount' as const },
  { key: 'savings', label: '정기예금/적금', category: 'cash', dataKey: 'cashSavingsAccount' as const },
  { key: 'domestic', label: '국내주식/ETF', category: 'invest', dataKey: 'investDomesticStock' as const },
  { key: 'foreign', label: '해외주식/ETF', category: 'invest', dataKey: 'investForeignStock' as const },
  { key: 'fund', label: '펀드/채권', category: 'invest', dataKey: 'investFund' as const },
  { key: 'other', label: '기타 투자자산', category: 'invest', dataKey: 'investOther' as const },
]

// 금융자산 행들 렌더링 (추가 형태)
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

  // 추가된 자산들 (값이 null이 아닌 것들)
  const addedAssets = assetTypeConfig.filter(type => data[type.dataKey] !== null)
  const hasAnyAsset = addedAssets.length > 0
  const hasNoAssetSelected = data.hasNoAsset === true

  // 완료 조건: 자산 없음 선택됨 or 하나 이상의 자산이 실제 값 입력됨 (0보다 큼)
  const isComplete = hasNoAssetSelected || addedAssets.some(type => {
    const value = data[type.dataKey]
    return value !== null && value > 0
  })

  // 아직 추가되지 않은 자산 타입들
  const availableCashAssets = assetTypeConfig.filter(t => t.category === 'cash' && data[t.dataKey] === null)
  const availableInvestAssets = assetTypeConfig.filter(t => t.category === 'invest' && data[t.dataKey] === null)

  // 자산 삭제
  const removeAsset = (dataKey: keyof OnboardingData) => {
    onUpdateData({ [dataKey]: null })
  }

  // 자산 없음 선택됨
  if (hasNoAssetSelected) {
    return (
      <div
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${styles.excelRowComplete}`}
        onClick={() => onFocus('asset')}
      >
        <div className={styles.excelRowNumber}>
          <Check size={14} />
        </div>
        <div className={styles.excelRowLabel}>금융자산</div>
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
              금융자산 없음
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`} />
            <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`} />
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
            <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
              <button onClick={(e) => { e.stopPropagation(); onUpdateData({ hasNoAsset: null }) }} type="button">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 자산이 하나도 없으면 카테고리 선택 버튼 표시
  if (!hasAnyAsset) {
    return (
      <>
        {/* 메인 행: 카테고리 선택 */}
        <div
          className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isCurrent ? styles.excelRowCurrent : ''}`}
          onClick={() => onFocus('asset')}
          data-current={isCurrent ? 'true' : undefined}
        >
          <div className={styles.excelRowNumber}>{baseRowIndex}</div>
          <div className={styles.excelRowLabel}>금융자산</div>
          <div className={styles.excelRowInputMulti}>
            <span className={styles.excelCategoryLabel}>현금성 자산</span>
            {availableCashAssets.map(type => (
              <span
                key={type.key}
                className={styles.excelAddText}
                onClick={(e) => { e.stopPropagation(); onUpdateData({ [type.dataKey]: 0 }) }}
              >
                <Plus size={14} /> {type.label}
              </span>
            ))}
          </div>
        </div>
        {/* 투자 자산 행 */}
        <div
          className={`${styles.excelRow} ${styles.excelRowExtension} ${isActive ? styles.excelRowActive : ''}`}
          onClick={() => onFocus('asset')}
        >
          <div className={styles.excelRowNumber} />
          <div className={styles.excelRowLabel} />
          <div className={styles.excelRowInputMulti}>
            <span className={styles.excelCategoryLabel}>투자 자산</span>
            {availableInvestAssets.map(type => (
              <span
                key={type.key}
                className={styles.excelAddText}
                onClick={(e) => { e.stopPropagation(); onUpdateData({ [type.dataKey]: 0 }) }}
              >
                <Plus size={14} /> {type.label}
              </span>
            ))}
          </div>
        </div>
        {/* 금융자산 없음 행 */}
        <div
          className={`${styles.excelRow} ${styles.excelRowExtension} ${styles.excelRowAdd} ${isActive ? styles.excelRowActive : ''}`}
          onClick={() => onFocus('asset')}
        >
          <div className={styles.excelRowNumber} />
          <div className={styles.excelRowLabel} />
          <div className={styles.excelRowInputMulti}>
            <span
              className={styles.excelAddText}
              onClick={(e) => { e.stopPropagation(); onUpdateData({ hasNoAsset: true }) }}
            >
              금융자산 없음
            </span>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* 추가된 자산들 */}
      {addedAssets.map((assetType, index) => {
        const isFirst = index === 0
        const value = data[assetType.dataKey]

        return (
          <div
            key={assetType.key}
            className={`${styles.excelRow} ${!isFirst ? styles.excelRowExtension : ''} ${isActive ? styles.excelRowActive : ''} ${isFirst && isComplete ? styles.excelRowComplete : ''} ${isCurrent && isFirst && !isComplete ? styles.excelRowCurrent : ''}`}
            onClick={() => onFocus('asset')}
            data-current={isCurrent && isFirst && !isComplete ? 'true' : undefined}
          >
            <div className={styles.excelRowNumber}>
              {isFirst ? (isComplete ? <Check size={14} /> : baseRowIndex) : null}
            </div>
            <div className={styles.excelRowLabel}>{isFirst ? '금융자산' : ''}</div>
            <div className={styles.excelRowInputMulti}>
              <div className={styles.excelValueCells}>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
                  {assetType.label}
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`}>
                  <MoneyInput
                    value={value === 0 ? null : value}
                    onChange={(newValue) => onUpdateData({ [assetType.dataKey]: newValue ?? 0 })}
                    placeholder="0"
                    hideSuffix
                    onFocus={() => onFocus('asset')}
                    data-filled={value !== null && value !== 0 ? 'true' : undefined}
                  />
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`}>
                  만원
                </div>
                <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
                <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
                  <button onClick={(e) => { e.stopPropagation(); removeAsset(assetType.dataKey) }} type="button">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* 자산 추가 버튼 행 */}
      {(availableCashAssets.length > 0 || availableInvestAssets.length > 0) && (
        <div
          className={`${styles.excelRow} ${styles.excelRowExtension} ${styles.excelRowAdd} ${isActive ? styles.excelRowActive : ''}`}
          onClick={() => onFocus('asset')}
        >
          <div className={styles.excelRowNumber} />
          <div className={styles.excelRowLabel} />
          <div className={styles.excelRowInputMulti}>
            {availableCashAssets.map(type => (
              <span
                key={type.key}
                className={styles.excelAddText}
                onClick={(e) => { e.stopPropagation(); onUpdateData({ [type.dataKey]: 0 }) }}
              >
                <Plus size={14} /> {type.label}
              </span>
            ))}
            {availableInvestAssets.map(type => (
              <span
                key={type.key}
                className={styles.excelAddText}
                onClick={(e) => { e.stopPropagation(); onUpdateData({ [type.dataKey]: 0 }) }}
              >
                <Plus size={14} /> {type.label}
              </span>
            ))}
          </div>
        </div>
      )}
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
  const hasNoDebt = data.hasNoDebt

  // 완료 조건: 부채 없음 선택됨 or 하나 이상의 부채 항목이 이름과 금액이 입력됨
  const isComplete = hasNoDebt === true || debts.some(d => d.name && d.name.trim() !== '' && d.amount !== null && d.amount > 0)

  // 부채 항목 추가
  const addDebt = () => {
    onUpdateData({ hasNoDebt: false, debts: [...debts, createEmptyDebt()] })
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
      onUpdateData({ debts: [], hasNoDebt: null })
    } else {
      onUpdateData({ debts: debts.filter((_, i) => i !== index) })
    }
  }

  // 부채 항목 처음 추가 (빈 배열일 때)
  const startAddingDebt = () => {
    onUpdateData({ debts: [createEmptyDebt()] })
  }

  // 부채 없음 선택됨
  if (hasNoDebt === true) {
    return (
      <div
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${styles.excelRowComplete}`}
        onClick={() => onFocus('debt')}
      >
        <div className={styles.excelRowNumber}>
          <Check size={14} />
        </div>
        <div className={styles.excelRowLabel}>부채</div>
        <div className={styles.excelRowInputMulti}>
          <div className={styles.excelValueCells}>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellLabel}`}>
              부채 없음
            </div>
            <div className={`${styles.excelValueCell} ${styles.excelValueCellAmountMid}`} />
            <div className={`${styles.excelValueCell} ${styles.excelValueCellUnit}`} />
            <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
            <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
              <button onClick={(e) => { e.stopPropagation(); onUpdateData({ hasNoDebt: null }) }} type="button">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 부채가 없으면 추가 버튼만 표시
  if (debts.length === 0) {
    return (
      <div
        className={`${styles.excelRow} ${isActive ? styles.excelRowActive : ''} ${isCurrent ? styles.excelRowCurrent : ''}`}
        onClick={() => onFocus('debt')}
        data-current={isCurrent ? 'true' : undefined}
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
            onClick={(e) => { e.stopPropagation(); onUpdateData({ hasNoDebt: true, debts: [] }) }}
          >
            부채 없음
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
              className={`${styles.excelRow} ${!isFirstDebt ? styles.excelRowExtension : ''} ${isActive ? styles.excelRowActive : ''} ${isFirstDebt && isComplete ? styles.excelRowComplete : ''} ${isCurrent && isFirstDebt && !isComplete ? styles.excelRowCurrent : ''}`}
              onClick={() => onFocus('debt')}
              data-current={isCurrent && isFirstDebt && !isComplete ? 'true' : undefined}
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
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellFrequencyFixed}`} />
                  <div className={`${styles.excelValueCell} ${styles.excelValueCellDelete}`}>
                    <button onClick={(e) => { e.stopPropagation(); deleteDebt(index) }} type="button">
                      <X size={14} />
                    </button>
                  </div>
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

