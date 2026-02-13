'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Trash2, Package, Plus, X, ArrowLeft } from 'lucide-react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { PhysicalAsset, FinancingType, LoanRepaymentType } from '@/types/tables'
import type { GlobalSettings } from '@/types'
import { formatMoney, getDefaultRateCategory, getEffectiveRate } from '@/lib/utils'
import { usePhysicalAssets, useInvalidateByCategory } from '@/hooks/useFinancialData'
import {
  createPhysicalAsset,
  updatePhysicalAsset,
  deletePhysicalAsset,
  dbTypeToUIType,
  uiTypeToDBType,
  UIAssetType,
  ASSET_TYPE_LABELS,
  FINANCING_TYPE_LABELS,
  REPAYMENT_TYPE_LABELS,
} from '@/lib/services/physicalAssetService'
import { TabSkeleton } from './shared/TabSkeleton'
import { useChartTheme } from '@/hooks/useChartTheme'
import { formatPeriodDisplay, toPeriodRaw, isPeriodValid, handlePeriodTextChange } from '@/lib/utils/periodInput'
import styles from './AssetTab.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface AssetTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  spouseRetirementAge?: number
  isMarried: boolean
  globalSettings?: GlobalSettings
}

// 색상
const COLORS: Record<UIAssetType, string> = {
  car: '#5856d6',
  precious_metal: '#ffcc00',
  custom: '#8e8e93',
}

export function AssetTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  spouseRetirementAge = 60,
  isMarried,
  globalSettings
}: AssetTabProps) {
  const { isDark } = useChartTheme()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // 현재 나이 계산
  const currentAge = currentYear - birthYear
  const selfRetirementYear = currentYear + (retirementAge - currentAge)

  // 배우자 나이 계산
  const spouseCurrentAge = spouseBirthYear ? currentYear - spouseBirthYear : null

  // 배우자 은퇴년도
  const spouseRetirementYear = useMemo(() => {
    if (!spouseBirthYear || spouseCurrentAge === null) return selfRetirementYear
    return currentYear + (spouseRetirementAge - spouseCurrentAge)
  }, [spouseBirthYear, currentYear, selfRetirementYear, spouseCurrentAge, spouseRetirementAge])

  const hasSpouse = isMarried && spouseBirthYear

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: dbAssets = [], isLoading } = usePhysicalAssets(simulationId)
  const invalidate = useInvalidateByCategory(simulationId)

  // 편집 상태
  const [editingAsset, setEditingAsset] = useState<{ type: UIAssetType, id: string | null } | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  // Period text inputs
  const [purchaseDateText, setPurchaseDateText] = useState('')
  const [loanMaturityDateText, setLoanMaturityDateText] = useState('')

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [addingType, setAddingType] = useState<UIAssetType | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  // 합계 계산 (현재 가치 기준)
  const totalAssets = useMemo(() => {
    return dbAssets.reduce((sum, a) => sum + a.current_value, 0)
  }, [dbAssets])


  // 편집 시작
  const startAddAsset = (type: UIAssetType) => {
    setEditingAsset({ type, id: null })
    setEditValues({
      title: '',
      owner: 'self',
      currentValue: '',
      purchaseYear: currentYear.toString(),
      purchaseMonth: currentMonth.toString(),
      annualRate: '',
      rateCategory: getDefaultRateCategory(type),
      financingType: 'none',
      loanAmount: '',
      loanRate: '',
      loanMaturityYear: '',
      loanMaturityMonth: '',
      loanRepaymentType: '',
    })
    setPurchaseDateText(toPeriodRaw(currentYear, currentMonth))
    setLoanMaturityDateText('')
  }

  const startEditAsset = (asset: PhysicalAsset) => {
    const uiType = dbTypeToUIType(asset.type)
    setEditingAsset({ type: uiType, id: asset.id })

    const purchaseY = asset.purchase_year || currentYear
    const purchaseM = asset.purchase_month || currentMonth

    setEditValues({
      title: asset.title,
      owner: asset.owner || 'self',
      currentValue: asset.current_value.toString(),
      purchaseYear: purchaseY.toString(),
      purchaseMonth: purchaseM.toString(),
      annualRate: asset.annual_rate?.toString() || '',
      rateCategory: asset.rate_category || getDefaultRateCategory(uiType),
      financingType: asset.has_loan ? (asset.financing_type || 'loan') : 'none',
      loanAmount: asset.loan_amount?.toString() || '',
      loanRate: asset.loan_rate?.toString() || '',
      loanMaturityYear: asset.loan_maturity_year?.toString() || '',
      loanMaturityMonth: asset.loan_maturity_month?.toString() || '',
      loanRepaymentType: asset.loan_repayment_type || '',
    })

    setPurchaseDateText(toPeriodRaw(purchaseY, purchaseM))

    if (asset.loan_maturity_year && asset.loan_maturity_month) {
      setLoanMaturityDateText(toPeriodRaw(asset.loan_maturity_year, asset.loan_maturity_month))
    } else {
      setLoanMaturityDateText('')
    }
  }

  const cancelEdit = () => {
    setEditingAsset(null)
    setEditValues({})
    setPurchaseDateText('')
    setLoanMaturityDateText('')
  }

  const resetAddForm = () => {
    setShowTypeMenu(false)
    setAddingType(null)
    setEditingAsset(null)
    setEditValues({})
    setPurchaseDateText('')
    setLoanMaturityDateText('')
  }

  // 저장
  const saveAsset = async () => {
    if (!editingAsset || !editValues.title || !editValues.currentValue) return
    setIsSaving(true)

    try {
      const financingType = editValues.financingType as FinancingType | 'none'
      const hasFinancing = financingType !== 'none'

      // 할부는 항상 원리금균등상환
      const repaymentType: LoanRepaymentType | null = financingType === 'installment'
        ? '원리금균등상환'
        : (editValues.loanRepaymentType as LoanRepaymentType || null)

      // annual_rate 결정
      const annualRate = editValues.rateCategory === 'fixed'
        ? (editValues.annualRate ? parseFloat(editValues.annualRate) : 0)
        : (globalSettings?.inflationRate || 0)

      const input = {
        simulation_id: simulationId,
        type: uiTypeToDBType(editingAsset.type),
        title: editValues.title,
        owner: editValues.owner as any || 'self',
        current_value: parseFloat(editValues.currentValue) || 0,
        purchase_price: parseFloat(editValues.currentValue) || 0, // 현재는 현재가치 = 매입가
        purchase_year: editValues.purchaseYear ? parseInt(editValues.purchaseYear) : null,
        purchase_month: editValues.purchaseMonth ? parseInt(editValues.purchaseMonth) : null,
        annual_rate: annualRate,
        rate_category: editValues.rateCategory as any,
        has_loan: hasFinancing,
        financing_type: hasFinancing ? financingType as FinancingType : null,
        loan_amount: hasFinancing && editValues.loanAmount ? parseFloat(editValues.loanAmount) : null,
        loan_rate: hasFinancing && editValues.loanRate ? parseFloat(editValues.loanRate) : null,
        loan_maturity_year: hasFinancing && editValues.loanMaturityYear ? parseInt(editValues.loanMaturityYear) : null,
        loan_maturity_month: hasFinancing && editValues.loanMaturityMonth ? parseInt(editValues.loanMaturityMonth) : null,
        loan_repayment_type: hasFinancing ? repaymentType : null,
      }

      if (editingAsset.id) {
        await updatePhysicalAsset(editingAsset.id, input)
      } else {
        await createPhysicalAsset(input)
      }

      invalidate('physicalAssets')

      // If it's a new asset, reset add form. If editing existing, just cancel edit.
      if (editingAsset.id === null) {
        resetAddForm()
      } else {
        cancelEdit()
      }
    } catch (error) {
      console.error('Failed to save asset:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 삭제
  const handleDelete = async (id: string) => {
    setIsSaving(true)

    try {
      await deletePhysicalAsset(id)
      invalidate('physicalAssets')
    } catch (error) {
      console.error('Failed to delete asset:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 모달 폼 렌더링 (추가 + 편집 공통)
  const renderModalForm = (type: UIAssetType) => {
    const isCarType = type === 'car'
    const namePlaceholder = type === 'car'
      ? '예: BMW 5시리즈, 테슬라 모델3'
      : type === 'precious_metal'
        ? '예: 금 50g, 금반지'
        : '예: 미술품, 수집품'

    const financingType = (editValues.financingType || 'none') as FinancingType | 'none'
    const hasFinancing = financingType !== 'none'
    const amountLabel = financingType === 'loan' ? '대출금액' : '할부금액'
    const rateLabel = financingType === 'loan' ? '대출금리' : '할부금리'

    // Rate calculation
    const rateCategory = editValues.rateCategory || 'inflation'
    const effectiveRate = globalSettings
      ? getEffectiveRate(
          parseFloat(editValues.annualRate || '0'),
          rateCategory as any,
          globalSettings.scenarioMode,
          globalSettings
        )
      : parseFloat(editValues.annualRate || '0')

    return (
      <>
        {/* 자산명 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>자산명</span>
          <input
            type="text"
            className={styles.modalFormInput}
            value={editValues.title || ''}
            onChange={e => setEditValues({ ...editValues, title: e.target.value })}
            placeholder={namePlaceholder}
            autoFocus
          />
        </div>

        {/* 소유자 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>소유자</span>
          <div className={styles.ownerButtons}>
            <button
              type="button"
              className={`${styles.ownerBtn} ${editValues.owner === 'self' ? styles.active : ''}`}
              onClick={() => setEditValues({ ...editValues, owner: 'self' })}
            >
              본인
            </button>
            {hasSpouse && (
              <button
                type="button"
                className={`${styles.ownerBtn} ${editValues.owner === 'spouse' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, owner: 'spouse' })}
              >
                배우자
              </button>
            )}
          </div>
        </div>

        {/* 매입가 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>매입가</span>
          <input
            type="number"
            className={styles.modalFormInput}
            value={editValues.currentValue || ''}
            onChange={e => setEditValues({ ...editValues, currentValue: e.target.value })}
            onWheel={e => (e.target as HTMLElement).blur()}
            placeholder="0"
          />
          <span className={styles.modalFormUnit}>만원</span>
        </div>

        {/* 취득일 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>취득일</span>
          <div className={styles.fieldContent}>
            <input
              type="text"
              className={`${styles.periodInput} ${purchaseDateText.length === 6 && !isPeriodValid(purchaseDateText) ? styles.invalid : ''}`}
              value={formatPeriodDisplay(purchaseDateText)}
              onChange={(e) => {
                handlePeriodTextChange(
                  e,
                  setPurchaseDateText,
                  (y) => setEditValues({ ...editValues, purchaseYear: y.toString() }),
                  (m) => setEditValues({ ...editValues, purchaseMonth: m.toString() })
                )
              }}
              placeholder="2026.01"
              maxLength={7}
            />
          </div>
        </div>

        {/* 상승률 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>상승률</span>
          <div className={styles.fieldContent}>
            {rateCategory !== 'fixed' && (
              <span className={styles.rateValue}>{effectiveRate}%</span>
            )}
            {rateCategory === 'fixed' && (
              <>
                <input
                  type="number"
                  className={styles.customRateInput}
                  value={editValues.annualRate || ''}
                  onChange={(e) => setEditValues({ ...editValues, annualRate: e.target.value })}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  placeholder="0"
                  step="0.5"
                />
                <span className={styles.rateUnit}>%</span>
              </>
            )}
            <div className={styles.rateToggle}>
              <button
                type="button"
                className={`${styles.rateToggleBtn} ${rateCategory !== 'fixed' ? styles.active : ''}`}
                onClick={() => {
                  setEditValues({ ...editValues, rateCategory: getDefaultRateCategory(type) })
                }}
              >
                시뮬레이션 가정
              </button>
              <button
                type="button"
                className={`${styles.rateToggleBtn} ${rateCategory === 'fixed' ? styles.active : ''}`}
                onClick={() => {
                  setEditValues({ ...editValues, rateCategory: 'fixed' })
                }}
              >
                직접 입력
              </button>
            </div>
          </div>
        </div>

        {/* 자동차일 때만 대출/할부 옵션 표시 */}
        {isCarType && (
          <>
            <div className={styles.modalDivider} />
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>대출/할부</span>
              <div className={styles.typeButtons}>
                {(['none', 'loan', 'installment'] as const).map(ft => (
                  <button
                    key={ft}
                    type="button"
                    className={`${styles.typeBtn} ${financingType === ft ? styles.active : ''}`}
                    onClick={() => setEditValues({ ...editValues, financingType: ft })}
                  >
                    {FINANCING_TYPE_LABELS[ft]}
                  </button>
                ))}
              </div>
            </div>

            {hasFinancing && (
              <>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>{amountLabel}</span>
                  <input
                    type="number"
                    className={styles.modalFormInput}
                    value={editValues.loanAmount || ''}
                    onChange={e => setEditValues({ ...editValues, loanAmount: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder="0"
                  />
                  <span className={styles.modalFormUnit}>만원</span>
                </div>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>{rateLabel}</span>
                  <input
                    type="number"
                    className={styles.modalFormInput}
                    value={editValues.loanRate || ''}
                    onChange={e => setEditValues({ ...editValues, loanRate: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    step="0.1"
                    placeholder="5.0"
                  />
                  <span className={styles.modalFormUnit}>%</span>
                </div>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>만기</span>
                  <div className={styles.fieldContent}>
                    <input
                      type="text"
                      className={`${styles.periodInput} ${loanMaturityDateText.length === 6 && !isPeriodValid(loanMaturityDateText) ? styles.invalid : ''}`}
                      value={formatPeriodDisplay(loanMaturityDateText)}
                      onChange={(e) => {
                        handlePeriodTextChange(
                          e,
                          setLoanMaturityDateText,
                          (y) => setEditValues({ ...editValues, loanMaturityYear: y.toString() }),
                          (m) => setEditValues({ ...editValues, loanMaturityMonth: m.toString() })
                        )
                      }}
                      placeholder="2029.01"
                      maxLength={7}
                    />
                  </div>
                </div>
                {/* 대출일 때만 상환방식 선택 (할부는 항상 원리금균등) */}
                {financingType === 'loan' && (
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>상환방식</span>
                    <div className={styles.typeButtons}>
                      {(['원리금균등상환', '원금균등상환', '만기일시상환'] as const).map(repType => (
                        <button
                          key={repType}
                          type="button"
                          className={`${styles.typeBtn} ${editValues.loanRepaymentType === repType ? styles.active : ''}`}
                          onClick={() => setEditValues({ ...editValues, loanRepaymentType: repType })}
                        >
                          {REPAYMENT_TYPE_LABELS[repType]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 하단 버튼 */}
        <div className={styles.modalFormActions}>
          <button
            className={styles.modalCancelBtn}
            onClick={editingAsset?.id ? cancelEdit : resetAddForm}
            disabled={isSaving}
            type="button"
          >
            취소
          </button>
          <button
            className={styles.modalAddBtn}
            onClick={saveAsset}
            disabled={isSaving || !editValues.title || !editValues.currentValue}
            type="button"
          >
            {isSaving ? '저장 중...' : editingAsset?.id ? '저장' : '추가'}
          </button>
        </div>
      </>
    )
  }

  // 자산 아이템 렌더링
  const renderAssetItem = (asset: PhysicalAsset) => {
    const hasFinancing = asset.has_loan
    const financingLabel = asset.financing_type === 'loan' ? '대출' : '할부'
    const uiType = dbTypeToUIType(asset.type)
    const ownerLabel = asset.owner === 'spouse' ? '배우자' : '본인'

    // 메타 정보 구성
    const metaParts = []

    if (asset.purchase_year) {
      metaParts.push(`${asset.purchase_year}년${asset.purchase_month ? ` ${asset.purchase_month}월` : ''} 취득`)
    }

    if (hasFinancing && asset.loan_amount) {
      const loanInfo = `${financingLabel} ${formatMoney(asset.loan_amount)}`
      const loanDetails = []
      if (asset.loan_rate) loanDetails.push(`${asset.loan_rate}%`)
      if (asset.loan_maturity_year) {
        loanDetails.push(`${asset.loan_maturity_year}.${String(asset.loan_maturity_month || 1).padStart(2, '0')} 만기`)
      }
      metaParts.push(loanDetails.length > 0 ? `${loanInfo} | ${loanDetails.join(' | ')}` : loanInfo)
    }

    return (
      <div key={asset.id} className={styles.assetItem}>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{asset.title} | {ownerLabel}</span>
          {metaParts.length > 0 && (
            <span className={styles.itemMeta}>
              {metaParts.join(' | ')}
            </span>
          )}
        </div>
        <div className={styles.itemRight}>
          <span className={styles.itemAmount}>{formatMoney(asset.current_value)}</span>
          <div className={styles.itemActions}>
            <button
              className={styles.editBtn}
              onClick={() => startEditAsset(asset)}
            >
              <Pencil size={16} />
            </button>
            <button
              className={styles.deleteBtn}
              onClick={() => handleDelete(asset.id)}
              disabled={isSaving}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingAsset?.id) {
          cancelEdit()
          e.stopPropagation()
        } else if (showTypeMenu) {
          resetAddForm()
          e.stopPropagation()
        }
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [showTypeMenu, editingAsset])

  const handleTypeSelect = (type: UIAssetType) => {
    setAddingType(type)
    setEditingAsset({ type, id: null })
    setEditValues({
      title: '',
      owner: 'self',
      currentValue: '',
      purchaseYear: currentYear.toString(),
      purchaseMonth: currentMonth.toString(),
      annualRate: '',
      rateCategory: getDefaultRateCategory(type),
      financingType: 'none',
      loanAmount: '',
      loanRate: '',
      loanMaturityYear: '',
      loanMaturityMonth: '',
      loanRepaymentType: '',
    })
    setPurchaseDateText(toPeriodRaw(currentYear, currentMonth))
    setLoanMaturityDateText('')
    // DON'T close showTypeMenu - stay in modal for step 2
  }

  if (isLoading && dbAssets.length === 0) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={2} itemsPerSection={2} />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.headerToggle} onClick={() => setIsExpanded(!isExpanded)} type="button">
          <span className={styles.title}>실물 자산</span>
          <span className={styles.count}>{dbAssets.length}개</span>
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

      {/* 타입 선택 + 추가 모달 (2-step) */}
      {showTypeMenu && createPortal(
        <div
          className={styles.typeModalOverlay}
          data-scenario-dropdown-portal="true"
          onClick={resetAddForm}
        >
          <div
            className={styles.typeModal}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            {!addingType ? (
              <>
                {/* Step 1: 타입 선택 */}
                <div className={styles.typeModalHeader}>
                  <span className={styles.typeModalTitle}>실물 자산 추가</span>
                  <button
                    className={styles.typeModalClose}
                    onClick={resetAddForm}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.typeGrid}>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('car')}>
                    <span className={styles.typeCardName}>자동차</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('precious_metal')}>
                    <span className={styles.typeCardName}>귀금속/금</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('custom')}>
                    <span className={styles.typeCardName}>기타자산</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: 입력 폼 */}
                <div className={styles.typeModalHeader}>
                  <div className={styles.headerLeft}>
                    <button
                      className={styles.backButton}
                      onClick={() => setAddingType(null)}
                      type="button"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <span className={styles.stepLabel}>
                      {ASSET_TYPE_LABELS[addingType]} 추가
                    </span>
                  </div>
                  <button
                    className={styles.typeModalClose}
                    onClick={resetAddForm}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.modalFormBody}>
                  {renderModalForm(addingType)}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 편집 모달 */}
      {editingAsset && editingAsset.id !== null && createPortal(
        <div
          className={styles.typeModalOverlay}
          data-scenario-dropdown-portal="true"
          onClick={cancelEdit}
        >
          <div
            className={styles.typeModal}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div className={styles.typeModalHeader}>
              <span className={styles.stepLabel}>
                {ASSET_TYPE_LABELS[editingAsset.type]} 수정
              </span>
              <button
                className={styles.typeModalClose}
                onClick={cancelEdit}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalFormBody}>
              {renderModalForm(editingAsset.type)}
            </div>
          </div>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.flatList}>
          {dbAssets.length === 0 && (
            <p className={styles.emptyHint}>
              아직 등록된 실물 자산이 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}
          {dbAssets.map(asset => renderAssetItem(asset))}
        </div>
      )}
    </div>
  )
}
