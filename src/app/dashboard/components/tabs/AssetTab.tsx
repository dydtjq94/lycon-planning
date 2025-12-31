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
import type { OnboardingData, PhysicalAsset, PhysicalAssetType, AssetFinancingType, AssetLoanRepaymentType, DebtInput } from '@/types'
import { formatMoney } from '@/lib/utils'
import styles from './AssetTab.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface AssetTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

// 타입별 라벨
const ASSET_TYPE_LABELS: Record<PhysicalAssetType, string> = {
  car: '자동차',
  precious_metal: '귀금속/금',
  custom: '기타 자산',
}

// 색상
const COLORS: Record<PhysicalAssetType, string> = {
  car: '#5856d6',
  precious_metal: '#ffcc00',
  custom: '#8e8e93',
}

// 금융 타입 라벨
const FINANCING_TYPE_LABELS: Record<AssetFinancingType, string> = {
  none: '없음',
  loan: '대출 있음',
  installment: '할부 있음',
}

// 상환방식 라벨
const REPAYMENT_TYPE_LABELS: Record<string, string> = {
  '만기일시상환': '만기일시',
  '원리금균등상환': '원리금균등',
  '원금균등상환': '원금균등',
}

export function AssetTab({ data, onUpdateData }: AssetTabProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // 편집 상태
  const [editingAsset, setEditingAsset] = useState<{ type: PhysicalAssetType, id: string | null } | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  // 데이터 가져오기
  const physicalAssets = data.physicalAssets || []

  // 타입별 필터링
  const carAssets = physicalAssets.filter(a => a.type === 'car')
  const preciousMetalAssets = physicalAssets.filter(a => a.type === 'precious_metal')
  const customAssets = physicalAssets.filter(a => a.type === 'custom')

  // 합계 계산 (매입가 기준)
  const carTotal = carAssets.reduce((sum, a) => sum + a.purchaseValue, 0)
  const preciousMetalTotal = preciousMetalAssets.reduce((sum, a) => sum + a.purchaseValue, 0)
  const customTotal = customAssets.reduce((sum, a) => sum + a.purchaseValue, 0)
  const totalAssets = carTotal + preciousMetalTotal + customTotal

  // 대출/할부 합계
  const totalLoans = physicalAssets.reduce((sum, a) => {
    const hasFinancing = a.financingType === 'loan' || a.financingType === 'installment'
    return sum + (hasFinancing ? (a.loanAmount || 0) : 0)
  }, 0)

  // 편집 시작
  const startAddAsset = (type: PhysicalAssetType) => {
    setEditingAsset({ type, id: null })
    setEditValues({
      name: '',
      purchaseValue: '',
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
    setEditingAsset({ type: asset.type, id: asset.id })

    // 만기를 년/월로 분리
    let maturityYear = ''
    let maturityMonth = ''
    if (asset.loanMaturity) {
      const [y, m] = asset.loanMaturity.split('-')
      maturityYear = y || ''
      maturityMonth = m || ''
    }

    setEditValues({
      name: asset.name,
      purchaseValue: asset.purchaseValue.toString(),
      purchaseYear: asset.purchaseYear?.toString() || currentYear.toString(),
      purchaseMonth: asset.purchaseMonth?.toString() || currentMonth.toString(),
      financingType: asset.financingType || 'none',
      loanAmount: asset.loanAmount?.toString() || '',
      loanRate: asset.loanRate?.toString() || '',
      loanMaturityYear: maturityYear,
      loanMaturityMonth: maturityMonth,
      loanRepaymentType: asset.loanRepaymentType || '',
    })
  }

  const cancelEdit = () => {
    setEditingAsset(null)
    setEditValues({})
  }

  // 저장
  const saveAsset = () => {
    if (!editingAsset || !editValues.name || !editValues.purchaseValue) return

    const financingType = (editValues.financingType || 'none') as AssetFinancingType
    const hasFinancing = financingType !== 'none'

    // 만기 조합
    let loanMaturity: string | undefined
    if (hasFinancing && editValues.loanMaturityYear && editValues.loanMaturityMonth) {
      loanMaturity = `${editValues.loanMaturityYear}-${editValues.loanMaturityMonth.padStart(2, '0')}`
    }

    const assetId = editingAsset.id || `asset-${Date.now()}`

    // 할부는 항상 원리금균등상환
    const repaymentType: AssetLoanRepaymentType = financingType === 'installment'
      ? '원리금균등상환'
      : (editValues.loanRepaymentType as AssetLoanRepaymentType || null)

    const newAsset: PhysicalAsset = {
      id: assetId,
      type: editingAsset.type,
      name: editValues.name,
      purchaseValue: parseFloat(editValues.purchaseValue) || 0,
      purchaseYear: editValues.purchaseYear ? parseInt(editValues.purchaseYear) : undefined,
      purchaseMonth: editValues.purchaseMonth ? parseInt(editValues.purchaseMonth) : undefined,
      // 대출/할부 정보
      financingType: financingType,
      loanAmount: hasFinancing ? (parseFloat(editValues.loanAmount) || undefined) : undefined,
      loanRate: hasFinancing ? (parseFloat(editValues.loanRate) || undefined) : undefined,
      loanMaturity: hasFinancing ? loanMaturity : undefined,
      loanRepaymentType: hasFinancing ? repaymentType : undefined,
    }

    let updatedAssets: PhysicalAsset[]
    if (editingAsset.id) {
      updatedAssets = physicalAssets.map(a => a.id === editingAsset.id ? newAsset : a)
    } else {
      updatedAssets = [...physicalAssets, newAsset]
    }

    // 부채 배열 업데이트 (대출/할부가 있는 경우)
    let updatedDebts = [...(data.debts || [])]
    const debtId = `debt-asset-${assetId}`

    // 기존 연동 부채 제거
    updatedDebts = updatedDebts.filter(d => d.sourceId !== assetId)

    // 대출/할부가 있으면 새 부채 추가
    if (hasFinancing && newAsset.loanAmount) {
      const debtName = financingType === 'loan'
        ? `${editValues.name} 대출`
        : `${editValues.name} 할부`

      const newDebt: DebtInput = {
        id: debtId,
        name: debtName,
        amount: newAsset.loanAmount,
        rate: newAsset.loanRate || null,
        maturity: newAsset.loanMaturity || null,
        repaymentType: newAsset.loanRepaymentType || null,
        sourceType: 'physicalAsset',
        sourceId: assetId,
      }
      updatedDebts.push(newDebt)
    }

    onUpdateData({
      physicalAssets: updatedAssets,
      debts: updatedDebts,
    })
    cancelEdit()
  }

  // 삭제
  const deleteAsset = (id: string) => {
    const updatedAssets = physicalAssets.filter(a => a.id !== id)
    // 연동된 부채도 삭제
    const updatedDebts = (data.debts || []).filter(d => d.sourceId !== id)
    onUpdateData({
      physicalAssets: updatedAssets,
      debts: updatedDebts,
    })
  }

  // 편집 폼 렌더링
  const renderEditForm = (type: PhysicalAssetType) => {
    const isCarType = type === 'car'
    const namePlaceholder = type === 'car'
      ? '예: BMW 5시리즈, 테슬라 모델3'
      : type === 'precious_metal'
        ? '예: 금 50g, 금반지'
        : '예: 미술품, 수집품'

    const financingType = (editValues.financingType || 'none') as AssetFinancingType
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
              value={editValues.name || ''}
              onChange={e => setEditValues({ ...editValues, name: e.target.value })}
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
              value={editValues.purchaseValue || ''}
              onChange={e => setEditValues({ ...editValues, purchaseValue: e.target.value })}
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
          <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
          <button className={styles.saveBtn} onClick={saveAsset}>저장</button>
        </div>
      </div>
    )
  }

  // 자산 아이템 렌더링
  const renderAssetItem = (asset: PhysicalAsset) => {
    const hasFinancing = asset.financingType === 'loan' || asset.financingType === 'installment'
    const financingLabel = asset.financingType === 'loan' ? '대출' : '할부'

    // 취득일 표시
    const purchaseDate = asset.purchaseYear
      ? `${asset.purchaseYear}년${asset.purchaseMonth ? ` ${asset.purchaseMonth}월` : ''}`
      : null

    return (
      <div key={asset.id} className={styles.assetItem}>
        <div className={styles.itemMain}>
          <span className={styles.itemLabel}>{ASSET_TYPE_LABELS[asset.type]}</span>
          <span className={styles.itemAmount}>{formatMoney(asset.purchaseValue)}</span>
          <span className={styles.itemName}>{asset.name}</span>
          {purchaseDate && (
            <span className={styles.itemMeta}>
              {purchaseDate} 취득
            </span>
          )}
          {hasFinancing && asset.loanAmount && (
            <span className={styles.itemLoan}>
              {financingLabel} {formatMoney(asset.loanAmount)}
              {asset.loanRate && ` | ${asset.loanRate}%`}
              {asset.loanMaturity && ` | ${asset.loanMaturity} 만기`}
            </span>
          )}
        </div>
        <div className={styles.itemActions}>
          <button
            className={styles.editBtn}
            onClick={() => startEditAsset(asset)}
          >
            <Pencil size={16} />
          </button>
          <button
            className={styles.deleteBtn}
            onClick={() => deleteAsset(asset.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    )
  }

  // 도넛 차트 데이터
  const chartData = useMemo(() => {
    const labels: string[] = []
    const values: number[] = []
    const colors: string[] = []

    physicalAssets.forEach(asset => {
      labels.push(asset.name)
      values.push(asset.purchaseValue)
      colors.push(COLORS[asset.type])
    })

    return { labels, values, colors }
  }, [physicalAssets])

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

  return (
    <div className={styles.container}>
      {/* 왼쪽: 자산 입력 */}
      <div className={styles.inputPanel}>

        {/* ========== 자동차 ========== */}
        <section className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>자동차</span>
            {carTotal > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(carTotal)}</span>
            )}
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
            {preciousMetalTotal > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(preciousMetalTotal)}</span>
            )}
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
            {customTotal > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(customTotal)}</span>
            )}
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
      </div>

      {/* 오른쪽: 요약 */}
      <div className={styles.summaryPanel}>
        {hasData ? (
          <>
            {/* 요약 카드 */}
            <div className={styles.summaryCard}>
              <div className={styles.totalAssets}>
                <span className={styles.totalLabel}>총 실물자산</span>
                <span className={styles.totalValue}>{formatMoney(totalAssets)}</span>
              </div>

              <div className={styles.subValues}>
                <div className={styles.subValueItem}>
                  <span className={styles.subLabel}>자동차</span>
                  <span className={styles.subValue}>{formatMoney(carTotal)}</span>
                </div>
                <div className={styles.subValueItem}>
                  <span className={styles.subLabel}>귀금속</span>
                  <span className={styles.subValue}>{formatMoney(preciousMetalTotal)}</span>
                </div>
                <div className={styles.subValueItem}>
                  <span className={styles.subLabel}>기타</span>
                  <span className={styles.subValue}>{formatMoney(customTotal)}</span>
                </div>
              </div>

              {totalLoans > 0 && (
                <div className={styles.loanSummary}>
                  <span className={styles.loanLabel}>관련 대출</span>
                  <span className={styles.loanValue}>{formatMoney(totalLoans)}</span>
                </div>
              )}
            </div>

            {/* 자산 현황 */}
            <div className={styles.countCard}>
              <h4 className={styles.cardTitle}>자산 현황</h4>
              <div className={styles.countList}>
                <div className={styles.countRow}>
                  <span className={styles.countLabel}>자동차</span>
                  <span className={styles.countValue}>{carAssets.length}대</span>
                </div>
                <div className={styles.countRow}>
                  <span className={styles.countLabel}>귀금속</span>
                  <span className={styles.countValue}>{preciousMetalAssets.length}건</span>
                </div>
                <div className={styles.countRow}>
                  <span className={styles.countLabel}>기타 자산</span>
                  <span className={styles.countValue}>{customAssets.length}건</span>
                </div>
              </div>
            </div>

            {/* 자산 구성 차트 */}
            {chartData.values.length > 0 && (
              <div className={styles.chartCard}>
                <h4 className={styles.cardTitle}>자산 구성</h4>
                <div className={styles.chartWrapper}>
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
                <div className={styles.legendList}>
                  {chartData.labels.map((label, index) => (
                    <div key={label} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: chartData.colors[index] }}></span>
                      <span className={styles.legendLabel}>{label}</span>
                      <span className={styles.legendValue}>{formatMoney(chartData.values[index])}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            <Package size={40} />
            <p>실물 자산을 추가하면<br />분석 결과가 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
