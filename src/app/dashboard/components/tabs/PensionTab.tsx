'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ArrowLeft, X } from 'lucide-react'
import type { RetirementPensionType, ReceiveType, PersonalPensionType, RateCategory } from '@/types/tables'
import {
  NationalPensionSection,
  RetirementPensionSection,
  PersonalPensionSection,
} from './pension'
import {
  useNationalPensions,
  useRetirementPensions,
  usePersonalPensions,
  useInvalidateByCategory,
} from '@/hooks/useFinancialData'
import { upsertNationalPension } from '@/lib/services/nationalPensionService'
import { upsertRetirementPension } from '@/lib/services/retirementPensionService'
import { upsertPersonalPension } from '@/lib/services/personalPensionService'
import { getDefaultRateCategory } from '@/lib/utils'
import {
  formatPeriodDisplay,
  toPeriodRaw,
  isPeriodValid,
  handlePeriodTextChange,
} from '@/lib/utils/periodInput'
import { useChartTheme } from '@/hooks/useChartTheme'
import { TabSkeleton } from './shared/TabSkeleton'
import styles from './PensionTab.module.css'

interface PensionTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  isMarried: boolean
  lifeCycleSettings?: {
    selfRetirementAge: number
    spouseRetirementAge: number
    selfLifeExpectancy: number
    spouseLifeExpectancy: number
  }
  inflationRate?: number
}

export function PensionTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  isMarried,
  lifeCycleSettings,
  inflationRate,
}: PensionTabProps) {
  const currentYear = new Date().getFullYear()
  const currentAge = currentYear - birthYear

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const {
    data: dbNationalPensions = [],
    isLoading: nationalLoading,
  } = useNationalPensions(simulationId)
  const {
    data: dbRetirementPensions = [],
    isLoading: retirementLoading,
  } = useRetirementPensions(simulationId)
  const {
    data: dbPersonalPensions = [],
    isLoading: personalLoading,
  } = usePersonalPensions(simulationId)

  const invalidate = useInvalidateByCategory(simulationId)
  const isLoading = nationalLoading || retirementLoading || personalLoading
  const [isExpanded, setIsExpanded] = useState(true)

  // 타입 선택 모달
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [addingType, setAddingType] = useState<'national' | 'retirement' | 'personal' | null>(null)
  const [addOwner, setAddOwner] = useState<'self' | 'spouse'>('self')
  const [addValues, setAddValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const { isDark } = useChartTheme()
  const [personalStartDateText, setPersonalStartDateText] = useState('')
  const [personalEndDateText, setPersonalEndDateText] = useState('')

  // 실제 배우자 생년 (없으면 본인과 동일)
  const effectiveSpouseBirthYear = spouseBirthYear || birthYear

  // 모든 연금 데이터 캐시 무효화
  const loadPensions = () => {
    invalidate('nationalPensions')
    invalidate('retirementPensions')
    invalidate('personalPensions')
  }

  // owner별 연금 데이터 추출
  const selfNationalPension = useMemo(
    () => dbNationalPensions.find(p => p.owner === 'self') || null,
    [dbNationalPensions]
  )
  const dbSpouseNationalPension = useMemo(
    () => dbNationalPensions.find(p => p.owner === 'spouse') || null,
    [dbNationalPensions]
  )
  const selfRetirementPension = useMemo(
    () => dbRetirementPensions.find(p => p.owner === 'self') || null,
    [dbRetirementPensions]
  )
  const spouseRetirementPension = useMemo(
    () => dbRetirementPensions.find(p => p.owner === 'spouse') || null,
    [dbRetirementPensions]
  )
  const selfPersonalPensions = useMemo(
    () => dbPersonalPensions.filter(p => p.owner === 'self' && (p.pension_type === 'pension_savings' || p.pension_type === 'irp')),
    [dbPersonalPensions]
  )
  const spousePersonalPensions = useMemo(
    () => dbPersonalPensions.filter(p => p.owner === 'spouse' && (p.pension_type === 'pension_savings' || p.pension_type === 'irp')),
    [dbPersonalPensions]
  )
  // 국민연금 데이터 (요약 패널용) - DB 데이터 사용
  const nationalPensionData = {
    self: {
      monthly: selfNationalPension?.expected_monthly_amount || 0,
      startAge: selfNationalPension?.start_age || 65,
    },
    spouse: isMarried && dbSpouseNationalPension ? {
      monthly: dbSpouseNationalPension.expected_monthly_amount || 0,
      startAge: dbSpouseNationalPension.start_age || 65,
    } : null,
  }

  // 모든 데이터가 없는 경우에만 로딩 표시
  const hasNoData = dbNationalPensions.length === 0 && dbRetirementPensions.length === 0 && dbPersonalPensions.length === 0

  // 총 연금 개수 및 합계
  const personalPensionCount = selfPersonalPensions.length + spousePersonalPensions.length
  const totalPensionCount = dbNationalPensions.length + dbRetirementPensions.length + personalPensionCount

  // 추가 폼 리셋
  const resetAddForm = () => {
    setShowTypeMenu(false)
    setAddingType(null)
    setAddValues({})
    setAddOwner('self')
    setPersonalStartDateText('')
    setPersonalEndDateText('')
  }

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTypeMenu) {
        resetAddForm()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [showTypeMenu])

  const handleTypeSelect = (type: 'national' | 'retirement' | 'personal') => {
    setAddingType(type)
    setAddOwner('self')
    if (type === 'national') {
      const startYear = birthYear + 65
      setAddValues({
        amount: '',
        startYear: String(startYear),
        startMonth: '1',
        endYear: '',
        endMonth: '',
      })
    } else if (type === 'personal') {
      const startYear = birthYear + 56
      setAddValues({
        pensionType: '',
        balance: '',
        monthly: '',
        startYear: String(startYear),
        startMonth: '1',
        endYear: String(startYear + 20),
        endMonth: '12',
        rateCategory: getDefaultRateCategory('investment'),
        returnRate: '5',
      })
      setPersonalStartDateText(toPeriodRaw(startYear, 1))
      setPersonalEndDateText(toPeriodRaw(startYear + 20, 12))
    } else {
      const startYear = birthYear + 56
      setAddValues({
        type: '',
        years: '',
        balance: '',
        monthlySalary: '',
        calculationMode: 'auto',
        receiveType: 'annuity',
        startYear: String(startYear),
        startMonth: '1',
        endYear: String(startYear + 10),
        endMonth: '12',
      })
    }
  }

  // 소유자별 birthYear
  const getBirthYearForOwner = () => {
    return addOwner === 'self' ? birthYear : effectiveSpouseBirthYear
  }

  // 국민연금 저장
  const handleSaveNationalPension = async () => {
    if (!addValues.amount) return

    setIsSaving(true)
    try {
      const ownerBirthYear = getBirthYearForOwner()
      const startYear = parseInt(addValues.startYear) || (ownerBirthYear + 65)
      const startAge = startYear - ownerBirthYear
      const endYear = addValues.endYear ? parseInt(addValues.endYear) : null
      const endAge = endYear ? endYear - ownerBirthYear : null

      await upsertNationalPension(
        simulationId,
        addOwner,
        {
          expected_monthly_amount: parseFloat(addValues.amount),
          start_age: startAge,
          end_age: endAge,
        },
        ownerBirthYear
      )
      loadPensions()
      resetAddForm()
    } catch (error) {
      console.error('Failed to save national pension:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 퇴직연금 저장
  const handleSaveRetirementPension = async () => {
    if (!addValues.type) return

    setIsSaving(true)
    try {
      const ownerBirthYear = getBirthYearForOwner()
      const startYear = parseInt(addValues.startYear) || (ownerBirthYear + 56)
      const endYear = parseInt(addValues.endYear) || (startYear + 10)
      const validatedStartAge = Math.max(56, startYear - ownerBirthYear)
      const receivingYears = Math.max(1, endYear - startYear)
      const pensionType: RetirementPensionType = addValues.type === 'DB' ? 'db' : 'dc'
      const receiveType = addValues.receiveType as ReceiveType
      const isDBType = addValues.type === 'DB'
      const isAutoMode = addValues.calculationMode !== 'manual'

      let pensionFields: Parameters<typeof upsertRetirementPension>[2]
      if (isDBType && isAutoMode) {
        pensionFields = {
          pension_type: pensionType,
          current_balance: null,
          years_of_service: addValues.years ? parseInt(addValues.years) : null,
          monthly_salary: addValues.monthlySalary ? parseFloat(addValues.monthlySalary) : null,
          calculation_mode: 'auto',
          receive_type: receiveType,
          start_age: receiveType === 'annuity' ? validatedStartAge : null,
          receiving_years: receiveType === 'annuity' ? receivingYears : null,
          return_rate: 5,
        }
      } else if (isDBType && !isAutoMode) {
        pensionFields = {
          pension_type: pensionType,
          current_balance: addValues.balance ? parseFloat(addValues.balance) : null,
          years_of_service: null,
          monthly_salary: null,
          calculation_mode: 'manual',
          receive_type: receiveType,
          start_age: receiveType === 'annuity' ? validatedStartAge : null,
          receiving_years: receiveType === 'annuity' ? receivingYears : null,
          return_rate: 5,
        }
      } else {
        // DC/기업IRP
        pensionFields = {
          pension_type: pensionType,
          current_balance: addValues.balance ? parseFloat(addValues.balance) : null,
          years_of_service: null,
          monthly_salary: addValues.monthlySalary ? parseFloat(addValues.monthlySalary) : null,
          receive_type: receiveType,
          start_age: receiveType === 'annuity' ? validatedStartAge : null,
          receiving_years: receiveType === 'annuity' ? receivingYears : null,
          return_rate: 5,
        }
      }

      await upsertRetirementPension(
        simulationId,
        addOwner,
        pensionFields,
        ownerBirthYear,
        retirementAge
      )
      loadPensions()
      resetAddForm()
    } catch (error) {
      console.error('Failed to save retirement pension:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 개인연금 저장
  const handleSavePersonalPension = async () => {
    if (!addValues.pensionType) return

    setIsSaving(true)
    try {
      const ownerBirthYear = getBirthYearForOwner()
      const startYear = parseInt(addValues.startYear) || (ownerBirthYear + 56)
      const endYear = parseInt(addValues.endYear) || (startYear + 20)
      const validatedStartAge = Math.max(56, startYear - ownerBirthYear)
      const receivingYears = Math.max(1, endYear - startYear)
      const rateCategory = addValues.rateCategory as RateCategory
      const returnRate = parseFloat(addValues.returnRate) || 5

      await upsertPersonalPension(
        simulationId,
        addOwner,
        addValues.pensionType as PersonalPensionType,
        {
          current_balance: addValues.balance ? parseFloat(addValues.balance) : 0,
          monthly_contribution: addValues.monthly ? parseFloat(addValues.monthly) : null,
          is_contribution_fixed_to_retirement: true,
          start_age: validatedStartAge,
          receiving_years: receivingYears,
          return_rate: returnRate,
          rate_category: rateCategory,
        },
        ownerBirthYear,
        retirementAge
      )
      loadPensions()
      resetAddForm()
    } catch (error) {
      console.error('Failed to save personal pension:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 추가 폼 렌더링
  const renderAddForm = () => {
    if (addingType === 'national') {
      return (
        <div className={styles.modalFormBody}>
          {isMarried && (
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>소유자</span>
              <div className={styles.typeButtons}>
                <button type="button" className={`${styles.typeBtn} ${addOwner === 'self' ? styles.active : ''}`}
                  onClick={() => setAddOwner('self')}>본인</button>
                <button type="button" className={`${styles.typeBtn} ${addOwner === 'spouse' ? styles.active : ''}`}
                  onClick={() => setAddOwner('spouse')}>배우자</button>
              </div>
            </div>
          )}
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>금액</span>
            <input
              type="number"
              className={styles.modalFormInput}
              value={addValues.amount || ''}
              onChange={e => setAddValues({ ...addValues, amount: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
              autoFocus
            />
            <span className={styles.modalFormUnit}>만원/월</span>
          </div>
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>수령시작</span>
            <div className={styles.modalDateGroup}>
              <input
                type="number"
                className={styles.modalYearInput}
                value={addValues.startYear || ''}
                onChange={e => setAddValues({ ...addValues, startYear: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
              />
              <span className={styles.modalFormUnit}>년</span>
              <input
                type="number"
                className={styles.modalMonthInput}
                value={addValues.startMonth || ''}
                onChange={e => setAddValues({ ...addValues, startMonth: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                min={1}
                max={12}
                placeholder="1"
              />
              <span className={styles.modalFormUnit}>월</span>
            </div>
          </div>
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>수령종료</span>
            <div className={styles.modalDateGroup}>
              <input
                type="number"
                className={styles.modalYearInput}
                value={addValues.endYear || ''}
                onChange={e => setAddValues({ ...addValues, endYear: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder=""
              />
              <span className={styles.modalFormUnit}>년</span>
              <input
                type="number"
                className={styles.modalMonthInput}
                value={addValues.endMonth || ''}
                onChange={e => setAddValues({ ...addValues, endMonth: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                min={1}
                max={12}
                placeholder="12"
              />
              <span className={styles.modalFormUnit}>월</span>
            </div>
          </div>
          <div className={styles.modalFormActions}>
            <button className={styles.modalCancelBtn} onClick={resetAddForm}>취소</button>
            <button className={styles.modalAddBtn} onClick={handleSaveNationalPension} disabled={isSaving || !addValues.amount}>
              {isSaving ? '저장 중...' : '추가'}
            </button>
          </div>
        </div>
      )
    }

    if (addingType === 'retirement') {
      return (
        <div className={styles.modalFormBody}>
          {isMarried && (
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>소유자</span>
              <div className={styles.typeButtons}>
                <button type="button" className={`${styles.typeBtn} ${addOwner === 'self' ? styles.active : ''}`}
                  onClick={() => setAddOwner('self')}>본인</button>
                <button type="button" className={`${styles.typeBtn} ${addOwner === 'spouse' ? styles.active : ''}`}
                  onClick={() => setAddOwner('spouse')}>배우자</button>
              </div>
            </div>
          )}
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>유형</span>
            <div className={styles.typeButtons}>
              <button
                type="button"
                className={`${styles.typeBtn} ${addValues.type === 'DB' ? styles.active : ''}`}
                onClick={() => setAddValues({ ...addValues, type: 'DB', balance: '' })}
              >
                DB형/퇴직금
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${addValues.type === 'DC' ? styles.active : ''}`}
                onClick={() => setAddValues({ ...addValues, type: 'DC' })}
              >
                DC형/기업IRP
              </button>
            </div>
          </div>

          {addValues.type === 'DB' && (
            <>
              <div className={styles.modalFormRow}>
                <span className={styles.modalFormLabel}>계산</span>
                <div className={styles.typeButtons}>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${addValues.calculationMode !== 'manual' ? styles.active : ''}`}
                    onClick={() => setAddValues({ ...addValues, calculationMode: 'auto' })}
                  >
                    자동 계산
                  </button>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${addValues.calculationMode === 'manual' ? styles.active : ''}`}
                    onClick={() => setAddValues({ ...addValues, calculationMode: 'manual' })}
                  >
                    직접 입력
                  </button>
                </div>
              </div>

              {addValues.calculationMode !== 'manual' ? (
                <>
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>근속</span>
                    <input
                      type="number"
                      className={styles.modalFormInput}
                      value={addValues.years || ''}
                      onChange={e => setAddValues({ ...addValues, years: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={0}
                      max={50}
                      placeholder="0"
                    />
                    <span className={styles.modalFormUnit}>년</span>
                  </div>
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>연봉</span>
                    <input
                      type="number"
                      className={styles.modalFormInput}
                      value={addValues.monthlySalary || ''}
                      onChange={e => setAddValues({ ...addValues, monthlySalary: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={0}
                      placeholder="0"
                    />
                    <span className={styles.modalFormUnit}>만원</span>
                  </div>
                </>
              ) : (
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>예상 총액</span>
                  <input
                    type="number"
                    className={styles.modalFormInput}
                    value={addValues.balance || ''}
                    onChange={e => setAddValues({ ...addValues, balance: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder="0"
                  />
                  <span className={styles.modalFormUnit}>만원</span>
                </div>
              )}
            </>
          )}

          {addValues.type === 'DC' && (
            <>
              <div className={styles.modalFormRow}>
                <span className={styles.modalFormLabel}>잔액</span>
                <input
                  type="number"
                  className={styles.modalFormInput}
                  value={addValues.balance || ''}
                  onChange={e => setAddValues({ ...addValues, balance: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.modalFormUnit}>만원</span>
              </div>
              <div className={styles.modalFormRow}>
                <span className={styles.modalFormLabel}>연봉</span>
                <input
                  type="number"
                  className={styles.modalFormInput}
                  value={addValues.monthlySalary || ''}
                  onChange={e => setAddValues({ ...addValues, monthlySalary: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  min={0}
                  placeholder="0"
                />
                <span className={styles.modalFormUnit}>만원</span>
              </div>
              <span className={styles.modalFormHint}>매년 연봉의 1/12이 회사에서 DC 계좌로 적립됩니다</span>
            </>
          )}

          {addValues.type && (
            <>
              <div className={styles.modalFormRow}>
                <span className={styles.modalFormLabel}>수령</span>
                <div className={styles.typeButtons}>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${addValues.receiveType === 'annuity' ? styles.active : ''}`}
                    onClick={() => setAddValues({ ...addValues, receiveType: 'annuity' })}
                  >
                    연금 수령
                  </button>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${addValues.receiveType === 'lump_sum' ? styles.active : ''}`}
                    onClick={() => setAddValues({ ...addValues, receiveType: 'lump_sum' })}
                  >
                    일시금 수령
                  </button>
                </div>
              </div>

              {addValues.receiveType === 'annuity' && (
                <>
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>수령시작</span>
                    <div className={styles.modalDateGroup}>
                      <input
                        type="number"
                        className={styles.modalYearInput}
                        value={addValues.startYear || ''}
                        onChange={e => setAddValues({ ...addValues, startYear: e.target.value })}
                        onWheel={e => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.modalFormUnit}>년</span>
                      <input
                        type="number"
                        className={styles.modalMonthInput}
                        value={addValues.startMonth || ''}
                        onChange={e => setAddValues({ ...addValues, startMonth: e.target.value })}
                        onWheel={e => (e.target as HTMLElement).blur()}
                        min={1}
                        max={12}
                        placeholder="1"
                      />
                      <span className={styles.modalFormUnit}>월</span>
                    </div>
                  </div>
                  <div className={styles.modalFormRow}>
                    <span className={styles.modalFormLabel}>수령종료</span>
                    <div className={styles.modalDateGroup}>
                      <input
                        type="number"
                        className={styles.modalYearInput}
                        value={addValues.endYear || ''}
                        onChange={e => setAddValues({ ...addValues, endYear: e.target.value })}
                        onWheel={e => (e.target as HTMLElement).blur()}
                      />
                      <span className={styles.modalFormUnit}>년</span>
                      <input
                        type="number"
                        className={styles.modalMonthInput}
                        value={addValues.endMonth || ''}
                        onChange={e => setAddValues({ ...addValues, endMonth: e.target.value })}
                        onWheel={e => (e.target as HTMLElement).blur()}
                        min={1}
                        max={12}
                        placeholder="12"
                      />
                      <span className={styles.modalFormUnit}>월</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <div className={styles.modalFormActions}>
            <button className={styles.modalCancelBtn} onClick={resetAddForm}>취소</button>
            <button className={styles.modalAddBtn} onClick={handleSaveRetirementPension} disabled={isSaving || !addValues.type}>
              {isSaving ? '저장 중...' : '추가'}
            </button>
          </div>
        </div>
      )
    }

    if (addingType === 'personal') {
      return (
        <div className={styles.modalFormBody}>
          {/* 연금 유형 */}
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>유형</span>
            <div className={styles.typeButtons}>
              <button
                type="button"
                className={`${styles.typeBtn} ${addValues.pensionType === 'pension_savings' ? styles.active : ''}`}
                onClick={() => setAddValues({ ...addValues, pensionType: 'pension_savings' })}
              >
                연금저축
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${addValues.pensionType === 'irp' ? styles.active : ''}`}
                onClick={() => setAddValues({ ...addValues, pensionType: 'irp' })}
              >
                IRP
              </button>
            </div>
          </div>

          {isMarried && (
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>소유자</span>
              <div className={styles.typeButtons}>
                <button type="button" className={`${styles.typeBtn} ${addOwner === 'self' ? styles.active : ''}`}
                  onClick={() => setAddOwner('self')}>본인</button>
                <button type="button" className={`${styles.typeBtn} ${addOwner === 'spouse' ? styles.active : ''}`}
                  onClick={() => setAddOwner('spouse')}>배우자</button>
              </div>
            </div>
          )}

          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>잔액</span>
            <input
              type="number"
              className={styles.modalFormInput}
              value={addValues.balance || ''}
              onChange={e => setAddValues({ ...addValues, balance: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
              autoFocus
            />
            <span className={styles.modalFormUnit}>만원</span>
          </div>

          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>납입</span>
            <input
              type="number"
              className={styles.modalFormInput}
              value={addValues.monthly || ''}
              onChange={e => setAddValues({ ...addValues, monthly: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.modalFormUnit}>만원/월</span>
          </div>

          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>수익률</span>
            <div className={styles.fieldContent}>
              <div className={styles.rateToggle}>
                <button
                  type="button"
                  className={`${styles.rateToggleBtn} ${addValues.rateCategory !== 'fixed' ? styles.active : ''}`}
                  onClick={() => setAddValues({ ...addValues, rateCategory: getDefaultRateCategory('investment') })}
                >
                  시뮬레이션 가정
                </button>
                <button
                  type="button"
                  className={`${styles.rateToggleBtn} ${addValues.rateCategory === 'fixed' ? styles.active : ''}`}
                  onClick={() => setAddValues({ ...addValues, rateCategory: 'fixed' })}
                >
                  직접 입력
                </button>
              </div>
              {addValues.rateCategory === 'fixed' ? (
                <>
                  <input
                    type="number"
                    className={styles.customRateInput}
                    value={addValues.returnRate || ''}
                    onChange={e => setAddValues({ ...addValues, returnRate: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder="0"
                    step="0.1"
                  />
                  <span className={styles.rateUnit}>%</span>
                </>
              ) : (
                <span className={styles.rateValue}>시뮬레이션 가정</span>
              )}
            </div>
          </div>

          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>수령시작</span>
            <input
              type="text"
              className={`${styles.periodInput} ${personalStartDateText.length === 6 && !isPeriodValid(personalStartDateText) ? styles.invalid : ''}`}
              value={formatPeriodDisplay(personalStartDateText)}
              onChange={e => handlePeriodTextChange(
                e,
                setPersonalStartDateText,
                y => setAddValues({ ...addValues, startYear: String(y) }),
                m => setAddValues({ ...addValues, startMonth: String(m) })
              )}
              placeholder="YYYY.MM"
            />
          </div>

          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>수령종료</span>
            <input
              type="text"
              className={`${styles.periodInput} ${personalEndDateText.length === 6 && !isPeriodValid(personalEndDateText) ? styles.invalid : ''}`}
              value={formatPeriodDisplay(personalEndDateText)}
              onChange={e => handlePeriodTextChange(
                e,
                setPersonalEndDateText,
                y => setAddValues({ ...addValues, endYear: String(y) }),
                m => setAddValues({ ...addValues, endMonth: String(m) })
              )}
              placeholder="YYYY.MM"
            />
          </div>

          <div className={styles.modalFormActions}>
            <button className={styles.modalCancelBtn} onClick={resetAddForm}>취소</button>
            <button className={styles.modalAddBtn} onClick={handleSavePersonalPension} disabled={isSaving || !addValues.pensionType}>
              {isSaving ? '저장 중...' : '추가'}
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  if (isLoading && hasNoData) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={3} itemsPerSection={2} />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.headerToggle} onClick={() => setIsExpanded(!isExpanded)} type="button">
          <span className={styles.title}>연금</span>
          <span className={styles.count}>{totalPensionCount}개</span>
        </button>
        <div className={styles.headerRight}>
          <button
            className={styles.addIconBtn}
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            type="button"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* 타입 선택 모달 (2-step) */}
      {showTypeMenu && createPortal(
        <div
          className={styles.typeModalOverlay}
          data-scenario-dropdown-portal="true"
          onClick={() => resetAddForm()}
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
                  <span className={styles.typeModalTitle}>연금 추가</span>
                  <button className={styles.typeModalClose} onClick={() => resetAddForm()} type="button">
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.typeGrid}>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('national')}>
                    <span className={styles.typeCardName}>공적연금</span>
                    <span className={styles.typeCardDesc}>국민/공무원/군인연금</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('retirement')}>
                    <span className={styles.typeCardName}>퇴직연금</span>
                    <span className={styles.typeCardDesc}>DB/DC, 수령방식</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('personal')}>
                    <span className={styles.typeCardName}>개인연금</span>
                    <span className={styles.typeCardDesc}>연금저축, IRP</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: 입력 폼 */}
                <div className={styles.typeModalHeader}>
                  <div className={styles.headerLeft}>
                    <button className={styles.backButton} onClick={() => setAddingType(null)} type="button">
                      <ArrowLeft size={18} />
                    </button>
                    <span className={styles.stepLabel}>
                      {addingType === 'national' ? '공적연금 추가' : addingType === 'retirement' ? '퇴직연금 추가' : '개인연금 추가'}
                    </span>
                  </div>
                  <button className={styles.typeModalClose} onClick={() => resetAddForm()} type="button">
                    <X size={18} />
                  </button>
                </div>
                {renderAddForm()}
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.groupedList}>
          {totalPensionCount === 0 && (
            <p className={styles.emptyHint}>
              아직 등록된 연금이 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}

          {(selfNationalPension || (isMarried && dbSpouseNationalPension)) && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>공적연금</span>
                  <span className={styles.sectionCount}>{dbNationalPensions.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                <NationalPensionSection
                  pension={selfNationalPension}
                  simulationId={simulationId}
                  owner="self"
                  ownerLabel="본인"
                  birthYear={birthYear}
                  onSave={loadPensions}
                  retirementAge={lifeCycleSettings?.selfRetirementAge}
                  lifeExpectancy={lifeCycleSettings?.selfLifeExpectancy}
                  inflationRate={inflationRate}
                />
                {isMarried && (
                  <NationalPensionSection
                    pension={dbSpouseNationalPension}
                    simulationId={simulationId}
                    owner="spouse"
                    ownerLabel="배우자"
                    birthYear={effectiveSpouseBirthYear}
                    onSave={loadPensions}
                    retirementAge={lifeCycleSettings?.spouseRetirementAge}
                    lifeExpectancy={lifeCycleSettings?.spouseLifeExpectancy}
                    inflationRate={inflationRate}
                  />
                )}
              </div>
            </div>
          )}

          {(selfRetirementPension || (isMarried && spouseRetirementPension)) && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>퇴직연금</span>
                  <span className={styles.sectionCount}>{dbRetirementPensions.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                <RetirementPensionSection
                  pension={selfRetirementPension}
                  simulationId={simulationId}
                  owner="self"
                  ownerLabel="본인"

                  yearsUntilRetirement={Math.max(0, retirementAge - currentAge)}
                  birthYear={birthYear}
                  retirementAge={retirementAge}
                  onSave={loadPensions}
                />
                {isMarried && (
                  <RetirementPensionSection
                    pension={spouseRetirementPension}
                    simulationId={simulationId}
                    owner="spouse"
                    ownerLabel="배우자"
  
                    yearsUntilRetirement={Math.max(0, retirementAge - currentAge)}
                    birthYear={effectiveSpouseBirthYear}
                    retirementAge={retirementAge}
                    onSave={loadPensions}
                  />
                )}
              </div>
            </div>
          )}

          {(selfPersonalPensions.length > 0 || (isMarried && spousePersonalPensions.length > 0)) && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>개인연금</span>
                  <span className={styles.sectionCount}>{personalPensionCount}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                <PersonalPensionSection
                  pensions={selfPersonalPensions}
                  simulationId={simulationId}
                  owner="self"
                  ownerLabel="본인"
                  birthYear={birthYear}
                  retirementAge={retirementAge}
                  onSave={loadPensions}
                />
                {isMarried && (
                  <PersonalPensionSection
                    pensions={spousePersonalPensions}
                    simulationId={simulationId}
                    owner="spouse"
                    ownerLabel="배우자"
                    birthYear={effectiveSpouseBirthYear}
                    retirementAge={retirementAge}
                    onSave={loadPensions}
                  />
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
