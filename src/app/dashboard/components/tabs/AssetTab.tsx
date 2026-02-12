'use client'

import { useState, useMemo } from 'react'
import { Pencil, Trash2, Package } from 'lucide-react'
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

  // 타입별 필터링
  const carAssets = useMemo(
    () => dbAssets.filter(a => dbTypeToUIType(a.type) === 'car'),
    [dbAssets]
  )
  const preciousMetalAssets = useMemo(
    () => dbAssets.filter(a => dbTypeToUIType(a.type) === 'precious_metal'),
    [dbAssets]
  )
  const customAssets = useMemo(
    () => dbAssets.filter(a => dbTypeToUIType(a.type) === 'custom'),
    [dbAssets]
  )

  // 합계 계산 (현재 가치 기준)
  const carTotal = carAssets.reduce((sum, a) => sum + a.current_value, 0)
  const preciousMetalTotal = preciousMetalAssets.reduce((sum, a) => sum + a.current_value, 0)
  const customTotal = customAssets.reduce((sum, a) => sum + a.current_value, 0)
  const totalAssets = carTotal + preciousMetalTotal + customTotal

  // 대출/할부 합계
  const totalLoans = dbAssets.reduce((sum, a) => {
    return sum + (a.has_loan ? (a.loan_amount || 0) : 0)
  }, 0)

  // 순자산 (자산 - 대출/할부)
  const netAssets = totalAssets - totalLoans

  // 자동차 감가상각 계산 (연 15% 감가 가정)
  const carDepreciation = useMemo(() => {
    if (carAssets.length === 0) return { currentValue: 0, depreciation: 0 }

    let totalCurrentValue = 0
    let totalPurchaseValue = 0
    let totalDepreciation = 0

    carAssets.forEach(car => {
      const purchaseYear = car.purchase_year || currentYear
      const purchaseValue = car.purchase_price || car.current_value
      const yearsOwned = currentYear - purchaseYear
      // 감가율: 첫해 20%, 이후 연 15%
      let depreciationRate = 0
      if (yearsOwned > 0) {
        depreciationRate = 1 - (0.8 * Math.pow(0.85, yearsOwned))
      }
      const currentValue = purchaseValue * (1 - depreciationRate)
      totalCurrentValue += currentValue
      totalPurchaseValue += purchaseValue
      totalDepreciation += purchaseValue - currentValue
    })

    return {
      currentValue: Math.round(totalCurrentValue),
      depreciation: Math.round(totalDepreciation),
    }
  }, [carAssets, currentYear])

  // 자산 유동성 분류
  const liquidityBreakdown = useMemo(() => {
    return {
      high: preciousMetalTotal,
      medium: carTotal,
      low: customTotal,
    }
  }, [preciousMetalTotal, carTotal, customTotal])

  // 자산 대비 대출 비율
  const loanToAssetRatio = totalAssets > 0
    ? Math.round((totalLoans / totalAssets) * 100)
    : 0

  // 가장 가치 있는 자산
  const mostValuableAsset = useMemo(() => {
    if (dbAssets.length === 0) return null
    return dbAssets.reduce((max, a) =>
      a.current_value > max.current_value ? a : max
    )
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

  // 도넛 차트 데이터
  const chartData = useMemo(() => {
    const labels: string[] = []
    const values: number[] = []
    const colors: string[] = []

    dbAssets.forEach(asset => {
      const uiType = dbTypeToUIType(asset.type)
      labels.push(asset.title)
      values.push(asset.current_value)
      colors.push(COLORS[uiType])
    })

    return { labels, values, colors }
  }, [dbAssets])

  const doughnutData = {
    labels: chartData.labels,
    datasets: [{
      data: chartData.values,
      backgroundColor: chartData.colors,
      borderWidth: 0,
    }],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { label?: string, raw: unknown }) => {
            return `${context.label || ''}: ${formatMoney(context.raw as number)}`
          },
        },
      },
    },
  }

  const hasData = totalAssets > 0

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
          <span className={styles.title}>실물자산</span>
          <span className={styles.count}>{dbAssets.length}개</span>
        </button>
        <div className={styles.headerRight}>
          <span className={styles.totalAmount}>{formatMoney(totalAssets)}</span>
        </div>
      </div>
      {isExpanded && (
        <>
      {/* ========== 자동차 ========== */}
      <section className={styles.assetSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>자동차</span>
        </div>
        <p className={styles.sectionDesc}>
          보유 중인 자동차. 대출/할부가 있으면 부채에 자동 연동됩니다.
        </p>

        <div className={styles.itemList}>
          {carAssets.map(asset => (
            editingAsset?.type === 'car' && editingAsset.id === asset.id
              ? <div key={asset.id}>{renderEditForm('car')}</div>
              : renderAssetItem(asset)
          ))}

          {editingAsset?.type === 'car' && editingAsset.id === null ? (
            renderEditForm('car')
          ) : (
            <button className={styles.addBtn} onClick={() => startAddAsset('car')}>
              + 자동차 추가
            </button>
          )}
        </div>
      </section>

      {/* ========== 귀금속/금 ========== */}
      <section className={styles.assetSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>귀금속/금</span>
        </div>
        <p className={styles.sectionDesc}>
          금, 은, 다이아몬드 등 귀금속. 장기적으로 가치가 상승하는 실물 자산.
        </p>

        <div className={styles.itemList}>
          {preciousMetalAssets.map(asset => (
            editingAsset?.type === 'precious_metal' && editingAsset.id === asset.id
              ? <div key={asset.id}>{renderEditForm('precious_metal')}</div>
              : renderAssetItem(asset)
          ))}

          {editingAsset?.type === 'precious_metal' && editingAsset.id === null ? (
            renderEditForm('precious_metal')
          ) : (
            <button className={styles.addBtn} onClick={() => startAddAsset('precious_metal')}>
              + 귀금속 추가
            </button>
          )}
        </div>
      </section>

      {/* ========== 기타 자산 ========== */}
      <section className={styles.assetSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>기타 자산</span>
        </div>
        <p className={styles.sectionDesc}>
          미술품, 수집품, 고가 장비 등 기타 실물 자산.
        </p>

        <div className={styles.itemList}>
          {customAssets.map(asset => (
            editingAsset?.type === 'custom' && editingAsset.id === asset.id
              ? <div key={asset.id}>{renderEditForm('custom')}</div>
              : renderAssetItem(asset)
          ))}

          {editingAsset?.type === 'custom' && editingAsset.id === null ? (
            renderEditForm('custom')
          ) : (
            <button className={styles.addBtn} onClick={() => startAddAsset('custom')}>
              + 기타 자산 추가
            </button>
          )}
        </div>
      </section>

      <p className={styles.infoText}>
        자동차 대출/할부는 부채 탭에서 확인할 수 있습니다.
      </p>
        </>
      )}
    </div>
  )
}
