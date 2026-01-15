'use client'

import { useState, useMemo } from 'react'
import { Pencil, X, Plus } from 'lucide-react'
import type { Insurance, InsuranceInput, InsuranceType, Owner } from '@/types/tables'
import { formatMoney } from '@/lib/utils'
import { useInsurances, useInvalidateByCategory } from '@/hooks/useFinancialData'
import {
  createInsurance,
  updateInsurance,
  deleteInsurance,
  INSURANCE_TYPE_LABELS,
  INSURANCE_TYPE_OPTIONS,
  getInsuranceCategory,
} from '@/lib/services/insuranceService'
import styles from './InsuranceTab.module.css'

interface InsuranceTabProps {
  simulationId: string
}

interface EditingInsurance {
  id: string | null
  type: InsuranceType
  name: string
  owner: Owner
  company: string
  monthlyPremium: string
  premiumEndYear: string
  premiumEndMonth: string
  isPremiumFixedToRetirement: boolean
  coverageAmount: string
  coverageEndYear: string
  coverageEndMonth: string
  currentValue: string
  maturityYear: string
  maturityMonth: string
  maturityAmount: string
  pensionStartAge: string
  pensionReceivingYears: string
}

const initialEditingInsurance: EditingInsurance = {
  id: null,
  type: 'health',
  name: '',
  owner: 'self',
  company: '',
  monthlyPremium: '',
  premiumEndYear: '',
  premiumEndMonth: '',
  isPremiumFixedToRetirement: false,
  coverageAmount: '',
  coverageEndYear: '',
  coverageEndMonth: '',
  currentValue: '',
  maturityYear: '',
  maturityMonth: '',
  maturityAmount: '',
  pensionStartAge: '65',
  pensionReceivingYears: '20',
}

export function InsuranceTab({ simulationId }: InsuranceTabProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // React Query로 데이터 로드
  const { data: insurances = [], isLoading } = useInsurances(simulationId)
  const invalidate = useInvalidateByCategory(simulationId)

  // 편집 상태
  const [editingInsurance, setEditingInsurance] = useState<EditingInsurance | null>(null)

  // 보험 카테고리별 분류
  const categorizedInsurances = useMemo(() => {
    const protection: Insurance[] = []
    const savings: Insurance[] = []

    insurances.forEach(ins => {
      if (getInsuranceCategory(ins.type) === 'savings') {
        savings.push(ins)
      } else {
        protection.push(ins)
      }
    })

    return { protection, savings }
  }, [insurances])


  // 보험 추가 시작
  const startAddInsurance = (type: InsuranceType) => {
    setEditingInsurance({
      ...initialEditingInsurance,
      type,
      name: INSURANCE_TYPE_LABELS[type],
    })
  }

  // 보험 편집 시작
  const startEditInsurance = (insurance: Insurance) => {
    setEditingInsurance({
      id: insurance.id,
      type: insurance.type,
      name: insurance.title || '',
      owner: insurance.owner || 'self',
      company: insurance.insurance_company || '',
      monthlyPremium: insurance.monthly_premium?.toString() || '',
      premiumEndYear: insurance.premium_end_year?.toString() || '',
      premiumEndMonth: insurance.premium_end_month?.toString() || '',
      isPremiumFixedToRetirement: insurance.is_premium_fixed_to_retirement || false,
      coverageAmount: insurance.coverage_amount?.toString() || '',
      coverageEndYear: insurance.coverage_end_year?.toString() || '',
      coverageEndMonth: insurance.coverage_end_month?.toString() || '',
      currentValue: insurance.current_value?.toString() || '',
      maturityYear: insurance.maturity_year?.toString() || '',
      maturityMonth: insurance.maturity_month?.toString() || '',
      maturityAmount: insurance.maturity_amount?.toString() || '',
      pensionStartAge: insurance.pension_start_age?.toString() || '65',
      pensionReceivingYears: insurance.pension_receiving_years?.toString() || '20',
    })
  }

  // 보험 저장
  const handleSaveInsurance = async () => {
    if (!editingInsurance) return

    try {
      const input: InsuranceInput = {
        simulation_id: simulationId,
        type: editingInsurance.type,
        title: editingInsurance.name || INSURANCE_TYPE_LABELS[editingInsurance.type],
        owner: editingInsurance.owner,
        insurance_company: editingInsurance.company || null,
        monthly_premium: parseFloat(editingInsurance.monthlyPremium) || 0,
        premium_start_year: currentYear,
        premium_start_month: currentMonth,
        premium_end_year: editingInsurance.premiumEndYear ? parseInt(editingInsurance.premiumEndYear) : null,
        premium_end_month: editingInsurance.premiumEndMonth ? parseInt(editingInsurance.premiumEndMonth) : null,
        is_premium_fixed_to_retirement: editingInsurance.isPremiumFixedToRetirement,
        coverage_amount: editingInsurance.coverageAmount ? parseFloat(editingInsurance.coverageAmount) : null,
        coverage_end_year: editingInsurance.coverageEndYear ? parseInt(editingInsurance.coverageEndYear) : null,
        coverage_end_month: editingInsurance.coverageEndMonth ? parseInt(editingInsurance.coverageEndMonth) : null,
        current_value: editingInsurance.currentValue ? parseFloat(editingInsurance.currentValue) : null,
        maturity_year: editingInsurance.maturityYear ? parseInt(editingInsurance.maturityYear) : null,
        maturity_month: editingInsurance.maturityMonth ? parseInt(editingInsurance.maturityMonth) : null,
        maturity_amount: editingInsurance.maturityAmount ? parseFloat(editingInsurance.maturityAmount) : null,
        pension_start_age: editingInsurance.pensionStartAge ? parseInt(editingInsurance.pensionStartAge) : null,
        pension_receiving_years: editingInsurance.pensionReceivingYears ? parseInt(editingInsurance.pensionReceivingYears) : null,
      }

      if (editingInsurance.id) {
        await updateInsurance(editingInsurance.id, input)
      } else {
        await createInsurance(input)
      }

      invalidate('insurances')
      setEditingInsurance(null)
    } catch (error) {
      console.error('Failed to save insurance:', error)
    }
  }

  // 보험 삭제
  const handleDeleteInsurance = async (id: string) => {
    try {
      await deleteInsurance(id)
      invalidate('insurances')
    } catch (error) {
      console.error('Failed to delete insurance:', error)
    }
  }

  // 편집 폼 렌더링
  const renderEditForm = () => {
    if (!editingInsurance) return null

    const isSavingsType = editingInsurance.type === 'savings' || editingInsurance.type === 'pension'

    return (
      <div className={styles.editForm}>
        <div className={styles.editRow}>
          <label className={styles.editLabel}>유형</label>
          <div className={styles.typeButtons}>
            {INSURANCE_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.typeBtn} ${editingInsurance.type === opt.value ? styles.active : ''}`}
                onClick={() => setEditingInsurance({
                  ...editingInsurance,
                  type: opt.value,
                  name: editingInsurance.name === INSURANCE_TYPE_LABELS[editingInsurance.type]
                    ? INSURANCE_TYPE_LABELS[opt.value]
                    : editingInsurance.name,
                })}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.editRow}>
          <label className={styles.editLabel}>이름</label>
          <input
            type="text"
            className={styles.editInput}
            value={editingInsurance.name}
            onChange={e => setEditingInsurance({ ...editingInsurance, name: e.target.value })}
            placeholder={INSURANCE_TYPE_LABELS[editingInsurance.type]}
          />
        </div>

        <div className={styles.editRow}>
          <label className={styles.editLabel}>가입자</label>
          <div className={styles.ownerButtons}>
            <button
              type="button"
              className={`${styles.ownerBtn} ${editingInsurance.owner === 'self' ? styles.active : ''}`}
              onClick={() => setEditingInsurance({ ...editingInsurance, owner: 'self' })}
            >
              본인
            </button>
            <button
              type="button"
              className={`${styles.ownerBtn} ${editingInsurance.owner === 'spouse' ? styles.active : ''}`}
              onClick={() => setEditingInsurance({ ...editingInsurance, owner: 'spouse' })}
            >
              배우자
            </button>
          </div>
        </div>

        <div className={styles.editRow}>
          <label className={styles.editLabel}>보험사</label>
          <input
            type="text"
            className={styles.editInput}
            value={editingInsurance.company}
            onChange={e => setEditingInsurance({ ...editingInsurance, company: e.target.value })}
            placeholder="삼성생명, 현대해상 등"
          />
        </div>

        <div className={styles.editRow}>
          <label className={styles.editLabel}>월 보험료</label>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInputNumber}
              value={editingInsurance.monthlyPremium}
              onChange={e => setEditingInsurance({ ...editingInsurance, monthlyPremium: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.editUnit}>만원</span>
          </div>
        </div>

        <div className={styles.editRow}>
          <label className={styles.editLabel}>납입 종료</label>
          <div className={styles.editField}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={editingInsurance.isPremiumFixedToRetirement}
                onChange={e => setEditingInsurance({
                  ...editingInsurance,
                  isPremiumFixedToRetirement: e.target.checked,
                  premiumEndYear: '',
                  premiumEndMonth: '',
                })}
              />
              <span>은퇴시까지</span>
            </label>
            {!editingInsurance.isPremiumFixedToRetirement && (
              <>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editingInsurance.premiumEndYear}
                  onChange={e => setEditingInsurance({ ...editingInsurance, premiumEndYear: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder={String(currentYear + 10)}
                  min={currentYear}
                  max={currentYear + 50}
                />
                <span className={styles.editUnit}>년</span>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editingInsurance.premiumEndMonth}
                  onChange={e => setEditingInsurance({ ...editingInsurance, premiumEndMonth: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="12"
                  min={1}
                  max={12}
                />
                <span className={styles.editUnit}>월</span>
              </>
            )}
          </div>
        </div>

        {!isSavingsType && (
          <div className={styles.editRow}>
            <label className={styles.editLabel}>보장금액</label>
            <div className={styles.editField}>
              <input
                type="number"
                className={styles.editInputNumber}
                value={editingInsurance.coverageAmount}
                onChange={e => setEditingInsurance({ ...editingInsurance, coverageAmount: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.editUnit}>만원</span>
            </div>
          </div>
        )}

        {isSavingsType && (
          <>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>현재 환급금</label>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInputNumber}
                  value={editingInsurance.currentValue}
                  onChange={e => setEditingInsurance({ ...editingInsurance, currentValue: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.editUnit}>만원</span>
              </div>
            </div>

            <div className={styles.editRow}>
              <label className={styles.editLabel}>만기</label>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editingInsurance.maturityYear}
                  onChange={e => setEditingInsurance({ ...editingInsurance, maturityYear: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder={String(currentYear + 20)}
                />
                <span className={styles.editUnit}>년</span>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editingInsurance.maturityMonth}
                  onChange={e => setEditingInsurance({ ...editingInsurance, maturityMonth: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="12"
                  min={1}
                  max={12}
                />
                <span className={styles.editUnit}>월</span>
              </div>
            </div>

            <div className={styles.editRow}>
              <label className={styles.editLabel}>만기금액</label>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInputNumber}
                  value={editingInsurance.maturityAmount}
                  onChange={e => setEditingInsurance({ ...editingInsurance, maturityAmount: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.editUnit}>만원</span>
              </div>
            </div>
          </>
        )}

        {editingInsurance.type === 'pension' && (
          <>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>연금 시작</label>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editingInsurance.pensionStartAge}
                  onChange={e => setEditingInsurance({ ...editingInsurance, pensionStartAge: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="65"
                />
                <span className={styles.editUnit}>세부터</span>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editingInsurance.pensionReceivingYears}
                  onChange={e => setEditingInsurance({ ...editingInsurance, pensionReceivingYears: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="20"
                />
                <span className={styles.editUnit}>년간</span>
              </div>
            </div>
          </>
        )}

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={() => setEditingInsurance(null)}>취소</button>
          <button className={styles.saveBtn} onClick={handleSaveInsurance}>저장</button>
        </div>
      </div>
    )
  }

  // 보험 항목 렌더링
  const renderInsuranceItem = (insurance: Insurance) => {
    const isEditing = editingInsurance?.id === insurance.id

    if (isEditing) {
      return <div key={insurance.id}>{renderEditForm()}</div>
    }

    const isSavingsType = getInsuranceCategory(insurance.type) === 'savings'

    return (
      <div key={insurance.id} className={styles.insuranceItem}>
        <div className={styles.insuranceMain}>
          <span className={styles.insuranceLabel}>
            {INSURANCE_TYPE_LABELS[insurance.type]}
            {insurance.insurance_company && ` | ${insurance.insurance_company}`}
          </span>
          <span className={styles.insuranceAmount}>
            월 {formatMoney(insurance.monthly_premium || 0)}
          </span>
          <span className={styles.insuranceName}>{insurance.title}</span>
          <span className={styles.insuranceMeta}>
            {insurance.owner === 'spouse' ? '배우자' : '본인'}
            {!isSavingsType && insurance.coverage_amount && ` | 보장 ${formatMoney(insurance.coverage_amount)}`}
            {isSavingsType && insurance.current_value && ` | 환급금 ${formatMoney(insurance.current_value)}`}
          </span>
        </div>
        <div className={styles.insuranceActions}>
          <button className={styles.editBtn} onClick={() => startEditInsurance(insurance)}>
            <Pencil size={16} />
          </button>
          <button className={styles.deleteBtn} onClick={() => handleDeleteInsurance(insurance.id)}>
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  // 섹션 렌더링
  const renderSection = (
    title: string,
    insuranceList: Insurance[],
    defaultType: InsuranceType,
    placeholder?: string
  ) => {
    const isAddingNew = editingInsurance && !editingInsurance.id &&
      (defaultType === 'health'
        ? ['life', 'term', 'health', 'car', 'other'].includes(editingInsurance.type)
        : ['savings', 'pension'].includes(editingInsurance.type))

    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{title}</span>
        </div>

        {insuranceList.length > 0 && (
          <div className={styles.insuranceList}>
            {insuranceList.map(ins => renderInsuranceItem(ins))}
          </div>
        )}

        {insuranceList.length === 0 && placeholder && !isAddingNew && (
          <p className={styles.placeholder}>{placeholder}</p>
        )}

        {isAddingNew ? (
          renderEditForm()
        ) : (
          <button className={styles.addBtn} onClick={() => startAddInsurance(defaultType)}>
            <Plus size={16} />
            <span>{title} 추가</span>
          </button>
        )}
      </div>
    )
  }

  if (isLoading && insurances.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>데이터를 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* 왼쪽: 보험 입력 */}
      <div className={styles.inputPanel}>
        {renderSection(
          '보장성 보험',
          categorizedInsurances.protection,
          'health',
          '실손보험, 종신보험, 정기보험 등'
        )}

        {renderSection(
          '저축성/연금 보험',
          categorizedInsurances.savings,
          'savings',
          '저축보험, 연금보험 등'
        )}

        <p className={styles.infoText}>
          보험료는 지출로 자동 연동됩니다.
          저축성 보험의 환급금은 자산으로 반영됩니다.
        </p>
      </div>

      {/* 오른쪽: 인사이트 */}
      <div className={styles.insightPanel}>
        {/* TODO: 인사이트 내용 추가 예정 */}
      </div>
    </div>
  )
}
