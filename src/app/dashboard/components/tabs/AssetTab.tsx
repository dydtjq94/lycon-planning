'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Trash2, Package, Plus } from 'lucide-react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { PhysicalAsset, FinancingType, LoanRepaymentType } from '@/types/tables'
import { formatMoney } from '@/lib/utils'
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
import styles from './AssetTab.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface AssetTabProps {
  simulationId: string
}

// 색상
const COLORS: Record<UIAssetType, string> = {
  car: '#5856d6',
  precious_metal: '#ffcc00',
  custom: '#8e8e93',
}

export function AssetTab({ simulationId }: AssetTabProps) {
  const { isDark } = useChartTheme()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: dbAssets = [], isLoading } = usePhysicalAssets(simulationId)
  const invalidate = useInvalidateByCategory(simulationId)

  // 편집 상태
  const [editingAsset, setEditingAsset] = useState<{ type: UIAssetType, id: string | null } | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false)
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
      currentValue: '',
      purchaseYear: currentYear.toString(),
      purchaseMonth: currentMonth.toString(),
      financingType: 'none',
      loanAmount: '',
      loanRate: '',
      loanMaturityYear: '',
      loanMaturityMonth: '',
      loanRepaymentType: '',
    })
  }

  const startEditAsset = (asset: PhysicalAsset) => {
    const uiType = dbTypeToUIType(asset.type)
    setEditingAsset({ type: uiType, id: asset.id })

    setEditValues({
      title: asset.title,
      currentValue: asset.current_value.toString(),
      purchaseYear: asset.purchase_year?.toString() || currentYear.toString(),
      purchaseMonth: asset.purchase_month?.toString() || currentMonth.toString(),
      financingType: asset.has_loan ? (asset.financing_type || 'loan') : 'none',
      loanAmount: asset.loan_amount?.toString() || '',
      loanRate: asset.loan_rate?.toString() || '',
      loanMaturityYear: asset.loan_maturity_year?.toString() || '',
      loanMaturityMonth: asset.loan_maturity_month?.toString() || '',
      loanRepaymentType: asset.loan_repayment_type || '',
    })
  }

  const cancelEdit = () => {
    setEditingAsset(null)
    setEditValues({})
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

      const input = {
        simulation_id: simulationId,
        type: uiTypeToDBType(editingAsset.type),
        title: editValues.title,
        current_value: parseFloat(editValues.currentValue) || 0,
        purchase_price: parseFloat(editValues.currentValue) || 0, // 현재는 현재가치 = 매입가
        purchase_year: editValues.purchaseYear ? parseInt(editValues.purchaseYear) : null,
        purchase_month: editValues.purchaseMonth ? parseInt(editValues.purchaseMonth) : null,
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
      cancelEdit()
    } catch (error) {
      console.error('Failed to save asset:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 자산을 삭제하시겠습니까?')) return
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

  // 편집 폼 렌더링
  const renderEditForm = (type: UIAssetType) => {
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

    return (
      <div className={styles.editItem}>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>자산명</span>
          <div className={styles.editField}>
            <input
              type="text"
              className={styles.editInputWide}
              value={editValues.title || ''}
              onChange={e => setEditValues({ ...editValues, title: e.target.value })}
              placeholder={namePlaceholder}
              autoFocus
            />
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>매입가</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInput}
              value={editValues.currentValue || ''}
              onChange={e => setEditValues({ ...editValues, currentValue: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.editUnit}>만원</span>
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>취득일</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInputSmall}
              value={editValues.purchaseYear || ''}
              onChange={e => setEditValues({ ...editValues, purchaseYear: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              min={1990}
              max={currentYear}
              placeholder={String(currentYear)}
            />
            <span className={styles.editUnit}>년</span>
            <input
              type="number"
              className={styles.editInputSmall}
              value={editValues.purchaseMonth || ''}
              onChange={e => setEditValues({ ...editValues, purchaseMonth: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              min={1}
              max={12}
              placeholder={String(currentMonth)}
            />
            <span className={styles.editUnit}>월</span>
          </div>
        </div>

        {/* 자동차일 때만 대출/할부 옵션 표시 */}
        {isCarType && (
          <>
            <div className={styles.editDivider} />
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>대출/할부</span>
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
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>{amountLabel}</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInput}
                      value={editValues.loanAmount || ''}
                      onChange={e => setEditValues({ ...editValues, loanAmount: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      placeholder="0"
                    />
                    <span className={styles.editUnit}>만원</span>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>{rateLabel}</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.loanRate || ''}
                      onChange={e => setEditValues({ ...editValues, loanRate: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      step="0.1"
                      placeholder="5.0"
                    />
                    <span className={styles.editUnit}>%</span>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>만기</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.loanMaturityYear || ''}
                      onChange={e => setEditValues({ ...editValues, loanMaturityYear: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={currentYear}
                      placeholder={String(currentYear + 3)}
                    />
                    <span className={styles.editUnit}>년</span>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.loanMaturityMonth || ''}
                      onChange={e => setEditValues({ ...editValues, loanMaturityMonth: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={1}
                      max={12}
                      placeholder={String(currentMonth)}
                    />
                    <span className={styles.editUnit}>월</span>
                  </div>
                </div>
                {/* 대출일 때만 상환방식 선택 (할부는 항상 원리금균등) */}
                {financingType === 'loan' && (
                  <div className={styles.editRow}>
                    <span className={styles.editRowLabel}>상환방식</span>
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

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={cancelEdit} disabled={isSaving}>취소</button>
          <button className={styles.saveBtn} onClick={saveAsset} disabled={isSaving}>
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    )
  }

  // 자산 아이템 렌더링
  const renderAssetItem = (asset: PhysicalAsset) => {
    const hasFinancing = asset.has_loan
    const financingLabel = asset.financing_type === 'loan' ? '대출' : '할부'
    const uiType = dbTypeToUIType(asset.type)

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
          <span className={styles.itemName}>{asset.title}</span>
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

  const handleTypeSelect = (type: UIAssetType) => {
    startAddAsset(type)
    setShowTypeMenu(false)
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

      {/* 타입 선택 드롭다운 - portal로 body에 렌더 */}
      {showTypeMenu && addButtonRef.current && createPortal(
        <div
          className={styles.typeMenu}
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
            onClick={() => handleTypeSelect('car')}
          >
            자동차
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('precious_metal')}
          >
            귀금속/금
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('custom')}
          >
            기타자산
          </button>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.flatList}>
          {dbAssets.length === 0 && !editingAsset && (
            <p className={styles.emptyHint}>
              아직 등록된 실물 자산이 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}
          {dbAssets.map(asset => (
            editingAsset?.type === dbTypeToUIType(asset.type) && editingAsset.id === asset.id
              ? <div key={asset.id}>{renderEditForm(dbTypeToUIType(asset.type))}</div>
              : renderAssetItem(asset)
          ))}

          {editingAsset && editingAsset.id === null && renderEditForm(editingAsset.type)}
        </div>
      )}
    </div>
  )
}
