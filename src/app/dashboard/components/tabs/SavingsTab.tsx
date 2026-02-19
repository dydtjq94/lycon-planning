'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, PiggyBank, Plus, X, ArrowLeft } from 'lucide-react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { Savings, SavingsInput, PersonalPension, PersonalPensionInput, Owner, CurrencyType } from '@/types/tables'
import { formatMoney } from '@/lib/utils'
import { CHART_COLORS } from '@/lib/utils/tooltipCategories'
import { formatPeriodDisplay, toPeriodRaw, isPeriodValid, handlePeriodTextChange } from '@/lib/utils/periodInput'
import { useSavingsData, usePersonalPensions, useInvalidateByCategory } from '@/hooks/useFinancialData'
import {
  createSavings,
  updateSavings,
  deleteSavings,
  type UISavingsType,
  type UIInvestmentType,
} from '@/lib/services/savingsService'
import {
  createPersonalPension,
  updatePersonalPension,
  deletePersonalPension,
} from '@/lib/services/personalPensionService'
import { BANK_OPTIONS, SECURITIES_OPTIONS } from '@/lib/constants/financial'
import { useChartTheme } from '@/hooks/useChartTheme'
import { TabSkeleton } from './shared/TabSkeleton'
import styles from './SavingsTab.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface SavingsTabProps {
  simulationId: string
  birthYear?: number
  spouseBirthYear?: number | null
  retirementAge?: number
  spouseRetirementAge?: number
  isMarried?: boolean
}

// ISA 만기 전략 라벨
const ISA_STRATEGY_LABELS = {
  pension_savings: '연금저축 전환',
  irp: 'IRP 전환',
  cash: '현금 인출',
}

// 색상 (중앙화된 CHART_COLORS 사용)
const COLORS: Record<string, string> = {
  // 저축 타입
  checking: CHART_COLORS.savingsDetail.checking,
  savings: CHART_COLORS.savingsDetail.savings,
  deposit: CHART_COLORS.savingsDetail.deposit,
  // 투자 타입
  domestic_stock: CHART_COLORS.investmentDetail.domestic_stock,
  foreign_stock: CHART_COLORS.investmentDetail.foreign_stock,
  fund: CHART_COLORS.investmentDetail.fund,
  bond: CHART_COLORS.investmentDetail.bond,
  crypto: CHART_COLORS.investmentDetail.crypto,
  other: CHART_COLORS.investmentDetail.other,
}

export function SavingsTab({
  simulationId,
  birthYear = new Date().getFullYear() - 30,
  spouseBirthYear = null,
  retirementAge = 60,
  spouseRetirementAge = 60,
  isMarried = false
}: SavingsTabProps) {
  const { isDark } = useChartTheme()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: allSavings = [], isLoading: savingsLoading } = useSavingsData(simulationId)
  const { data: personalPensions = [], isLoading: pensionsLoading } = usePersonalPensions(simulationId)
  const invalidate = useInvalidateByCategory(simulationId)

  const isLoading = savingsLoading || pensionsLoading

  // 현재 나이 및 은퇴 년도 계산
  const currentAge = currentYear - (birthYear || currentYear)
  const selfRetirementYear = currentYear + ((retirementAge || 65) - currentAge)
  const spouseCurrentAge = spouseBirthYear ? currentYear - spouseBirthYear : null
  const spouseRetirementYear = useMemo(() => {
    if (!spouseBirthYear || spouseCurrentAge === null) return selfRetirementYear
    return currentYear + ((spouseRetirementAge || 60) - spouseCurrentAge)
  }, [spouseBirthYear, currentYear, selfRetirementYear, spouseCurrentAge, spouseRetirementAge])
  const hasSpouse = (isMarried ?? false) && spouseBirthYear


  // 6개 섹션으로 분리
  const checkingAccounts = useMemo(
    () => allSavings.filter(s => s.type === 'checking'),
    [allSavings]
  )
  const depositAccounts = useMemo(
    () => allSavings.filter(s => s.type === 'deposit'),
    [allSavings]
  )
  const installmentSavingsAccounts = useMemo(
    () => allSavings.filter(s => s.type === 'savings'),
    [allSavings]
  )
  const investmentAccounts = useMemo(
    () => allSavings.filter(s => ['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto'].includes(s.type)),
    [allSavings]
  )
  const otherInvestmentAccounts = useMemo(
    () => allSavings.filter(s => s.type === 'other'),
    [allSavings]
  )

  // 편집 상태
  const [editingAccount, setEditingAccount] = useState<{ section: 'checking' | 'deposit' | 'installment_savings' | 'investment' | 'other', id: string | null } | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isExpanded, setIsExpanded] = useState(true)

  // ISA 편집 상태
  const [editingIsa, setEditingIsa] = useState<string | 'new' | null>(null)
  const [isaEditValues, setIsaEditValues] = useState<Record<string, string>>({})


  // 가입일/만기 텍스트 상태
  const [startType, setStartType] = useState<'current' | 'year'>('current')
  const [startDateText, setStartDateText] = useState('')
  const [maturityDateText, setMaturityDateText] = useState('')
  const [isaMaturityDateText, setIsaMaturityDateText] = useState('')

  // 절세 계좌 데이터 추출
  const isaAccounts = useMemo(
    () => personalPensions.filter(p => p.pension_type === 'isa'),
    [personalPensions]
  )

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [addingType, setAddingType] = useState<'checking' | 'deposit' | 'installment_savings' | 'investment' | 'isa' | 'other' | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  // 합계 계산
  const checkingTotal = checkingAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const depositTotal = depositAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const installmentSavingsTotal = installmentSavingsAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const investmentTotal = investmentAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const otherInvestmentTotal = otherInvestmentAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const isaTotal = isaAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const totalAssets = checkingTotal + depositTotal + installmentSavingsTotal + investmentTotal + otherInvestmentTotal + isaTotal

  // 추가 폼 리셋
  const resetAddForm = () => {
    setShowTypeMenu(false)
    setAddingType(null)
    setEditingAccount(null)
    setEditValues({})
    setEditingIsa(null)
    setIsaEditValues({})
    setStartType('current')
    setStartDateText('')
    setMaturityDateText('')
    setIsaMaturityDateText('')
  }

  // 타입 선택 (step 1 -> step 2)
  const handleTypeSelect = (section: 'checking' | 'deposit' | 'installment_savings' | 'investment' | 'isa' | 'other') => {
    setAddingType(section)
    if (section === 'checking') {
      setEditValues({
        type: 'checking',
        name: '입출금통장',
        broker: '',
        balance: '',
        interestRate: '',
        startYear: String(currentYear),
        startMonth: String(currentMonth),
        owner: 'self',
        rateCategory: 'fixed',
      })
      setStartType('current')
      setStartDateText(toPeriodRaw(currentYear, currentMonth))
    } else if (section === 'deposit') {
      setEditValues({
        type: 'deposit',
        name: '',
        broker: '',
        balance: '',
        interestRate: '',
        startYear: String(currentYear),
        startMonth: String(currentMonth),
        maturityYear: String(currentYear + 1),
        maturityMonth: '12',
        isTaxFree: 'false',
        currency: 'KRW',
        owner: 'self',
        rateCategory: 'fixed',
      })
      setStartType('current')
      setStartDateText(toPeriodRaw(currentYear, currentMonth))
      setMaturityDateText(toPeriodRaw(currentYear + 1, 12))
    } else if (section === 'installment_savings') {
      setEditValues({
        type: 'savings',
        name: '',
        broker: '',
        balance: '',
        interestRate: '',
        startYear: String(currentYear),
        startMonth: String(currentMonth),
        maturityYear: String(currentYear + 1),
        maturityMonth: '12',
        isTaxFree: 'false',
        currency: 'KRW',
        owner: 'self',
        rateCategory: 'fixed',
      })
      setStartType('current')
      setStartDateText(toPeriodRaw(currentYear, currentMonth))
      setMaturityDateText(toPeriodRaw(currentYear + 1, 12))
    } else if (section === 'investment') {
      setEditValues({
        type: 'domestic_stock',
        name: '',
        broker: '',
        balance: '',
        expectedReturn: '',
        startYear: String(currentYear),
        startMonth: String(currentMonth),
        owner: 'self',
        rateCategory: 'investment',
      })
      setStartType('current')
      setStartDateText(toPeriodRaw(currentYear, currentMonth))
    } else if (section === 'other') {
      setEditValues({
        type: 'other',
        name: '',
        balance: '',
        expectedReturn: '',
        startYear: String(currentYear),
        startMonth: String(currentMonth),
        owner: 'self',
        rateCategory: 'investment',
      })
      setStartType('current')
      setStartDateText(toPeriodRaw(currentYear, currentMonth))
    } else if (section === 'isa') {
      setIsaEditValues({
        name: '',
        broker: '',
        balance: '',
        monthly: '',
        maturityYear: String(currentYear + 3),
        maturityMonth: '12',
        strategy: 'pension_savings',
        owner: 'self',
        rateCategory: 'investment',
        returnRate: '5',
      })
      setIsaMaturityDateText(toPeriodRaw(currentYear + 3, 12))
    }
  }

  // 편집 시작 (pencil click -> edit modal)
  const startEditSavingsAccount = (account: Savings) => {
    const section: 'checking' | 'deposit' | 'installment_savings' | 'investment' | 'other' =
      account.type === 'checking' ? 'checking'
      : account.type === 'deposit' ? 'deposit'
      : account.type === 'savings' ? 'installment_savings'
      : account.type === 'other' ? 'other'
      : 'investment'
    const isSavingsType = section === 'checking' || section === 'deposit' || section === 'installment_savings'
    setEditingAccount({ section, id: account.id })
    if (isSavingsType) {
      const startY = account.contribution_start_year || currentYear
      const startM = account.contribution_start_month || currentMonth
      const matY = account.maturity_year || currentYear + 1
      const matM = account.maturity_month || 12
      setEditValues({
        type: account.type,
        name: account.title,
        broker: account.broker_name || '',
        balance: account.current_balance.toString(),
        interestRate: account.interest_rate?.toString() || '',
        startYear: String(startY),
        startMonth: String(startM),
        maturityYear: String(matY),
        maturityMonth: String(matM),
        isTaxFree: account.is_tax_free ? 'true' : 'false',
        currency: account.currency || 'KRW',
        owner: account.owner || 'self',
        rateCategory: 'fixed',
      })
      if (startY === currentYear && startM === currentMonth) {
        setStartType('current')
      } else {
        setStartType('year')
        setStartDateText(toPeriodRaw(startY, startM))
      }
      setMaturityDateText(toPeriodRaw(matY, matM))
    } else {
      const startY = account.contribution_start_year || currentYear
      const startM = account.contribution_start_month || currentMonth
      setEditValues({
        type: account.type,
        name: account.title,
        broker: account.broker_name || '',
        balance: account.current_balance.toString(),
        expectedReturn: account.expected_return?.toString() || '',
        startYear: String(startY),
        startMonth: String(startM),
        owner: account.owner || 'self',
        rateCategory: 'investment',
      })
      if (startY === currentYear && startM === currentMonth) {
        setStartType('current')
      } else {
        setStartType('year')
        setStartDateText(toPeriodRaw(startY, startM))
      }
    }
  }

  const startEditIsaAccount = (isa: PersonalPension) => {
    setEditingIsa(isa.id)
    const matY = isa.isa_maturity_year || currentYear + 3
    const matM = isa.isa_maturity_month || 12
    setIsaEditValues({
      name: isa.title || '',
      broker: isa.broker_name || '',
      balance: isa.current_balance.toString(),
      monthly: isa.monthly_contribution?.toString() || '',
      maturityYear: String(matY),
      maturityMonth: String(matM),
      strategy: isa.isa_maturity_strategy || 'pension_savings',
      owner: isa.owner || 'self',
      rateCategory: 'investment',
      returnRate: isa.return_rate?.toString() || '5',
    })
    setIsaMaturityDateText(toPeriodRaw(matY, matM))
  }

  const cancelEdit = () => {
    setEditingAccount(null)
    setEditValues({})
  }

  const cancelIsaEdit = () => {
    setEditingIsa(null)
    setIsaEditValues({})
  }


  const handleSaveSavingsAccount = async () => {
    if (!editValues.name || !editValues.balance) return

    try {
      const isChecking = editValues.type === 'checking'

      // 입출금통장은 가입일/만기 없음
      let maturityYear: number | null = null
      let maturityMonth: number | null = null

      if (!isChecking) {
        maturityYear = editValues.maturityYear ? parseInt(editValues.maturityYear) : null
        maturityMonth = editValues.maturityMonth ? parseInt(editValues.maturityMonth) : null
      }

      const input: SavingsInput = {
        simulation_id: simulationId,
        type: editValues.type as UISavingsType,
        title: editValues.name,
        broker_name: editValues.broker || null,
        owner: (editValues.owner || 'self') as Owner,
        current_balance: parseFloat(editValues.balance),
        interest_rate: editValues.interestRate ? parseFloat(editValues.interestRate) : null,
        contribution_start_year: editValues.startYear ? parseInt(editValues.startYear) : null,
        contribution_start_month: editValues.startMonth ? parseInt(editValues.startMonth) : null,
        maturity_year: maturityYear,
        maturity_month: maturityMonth,
        is_tax_free: isChecking ? false : editValues.isTaxFree === 'true',
        currency: (editValues.currency || 'KRW') as CurrencyType,
      }

      if (editingAccount?.id) {
        await updateSavings(editingAccount.id, input)
      } else {
        await createSavings(input)
      }

      invalidate('savings')
      resetAddForm()
    } catch (error) {
      console.error('Failed to save savings account:', error)
    }
  }

  const handleSaveInvestmentAccount = async () => {
    if (!editValues.name || !editValues.balance) return

    try {
      const input: SavingsInput = {
        simulation_id: simulationId,
        type: editValues.type as UIInvestmentType,
        title: editValues.name,
        broker_name: editValues.broker || null,
        owner: (editValues.owner || 'self') as Owner,
        current_balance: parseFloat(editValues.balance),
        expected_return: editValues.expectedReturn ? parseFloat(editValues.expectedReturn) : null,
        contribution_start_year: editValues.startYear ? parseInt(editValues.startYear) : null,
        contribution_start_month: editValues.startMonth ? parseInt(editValues.startMonth) : null,
      }

      if (editingAccount?.id) {
        await updateSavings(editingAccount.id, input)
      } else {
        await createSavings(input)
      }

      invalidate('savings')
      resetAddForm()
    } catch (error) {
      console.error('Failed to save investment account:', error)
    }
  }

  const handleSaveOtherAsset = async () => {
    if (!editValues.name) return

    try {
      const input: SavingsInput = {
        simulation_id: simulationId,
        type: 'other',
        title: editValues.name,
        broker_name: null,
        owner: (editValues.owner || 'self') as Owner,
        current_balance: editValues.balance ? parseFloat(editValues.balance) : 0,
        expected_return: editValues.expectedReturn ? parseFloat(editValues.expectedReturn) : null,
        contribution_start_year: editValues.startYear ? parseInt(editValues.startYear) : null,
        contribution_start_month: editValues.startMonth ? parseInt(editValues.startMonth) : null,
      }

      if (editingAccount?.id) {
        await updateSavings(editingAccount.id, input)
      } else {
        await createSavings(input)
      }

      invalidate('savings')
      resetAddForm()
    } catch (error) {
      console.error('Failed to save other asset:', error)
    }
  }

  const handleDeleteAccount = async (id: string) => {
    try {
      await deleteSavings(id)
      invalidate('savings')
    } catch (error) {
      console.error('Failed to delete account:', error)
    }
  }

  const handleSaveIsa = async () => {
    try {
      const owner = (isaEditValues.owner || 'self') as Owner
      const ownerBirthYear = owner === 'self' ? birthYear : (spouseBirthYear || birthYear)

      // returnRate: use input if available, otherwise default 5
      const returnRate = isaEditValues.returnRate ? parseFloat(isaEditValues.returnRate) : 5

      const input: PersonalPensionInput = {
        simulation_id: simulationId,
        owner,
        pension_type: 'isa',
        title: isaEditValues.name || null,
        broker_name: isaEditValues.broker || null,
        current_balance: isaEditValues.balance ? parseFloat(isaEditValues.balance) : 0,
        monthly_contribution: isaEditValues.monthly ? parseFloat(isaEditValues.monthly) : null,
        isa_maturity_year: isaEditValues.maturityYear ? parseInt(isaEditValues.maturityYear) : null,
        isa_maturity_month: isaEditValues.maturityMonth ? parseInt(isaEditValues.maturityMonth) : null,
        isa_maturity_strategy: (isaEditValues.strategy as 'pension_savings' | 'irp' | 'cash') || 'pension_savings',
        return_rate: returnRate,
      }

      if (editingIsa && editingIsa !== 'new') {
        await updatePersonalPension(editingIsa, input, ownerBirthYear, retirementAge)
      } else {
        await createPersonalPension(input, ownerBirthYear, retirementAge)
      }

      invalidate('personalPensions')
      resetAddForm()
    } catch (error) {
      console.error('Failed to save ISA:', error)
    }
  }

  const handleDeleteIsa = async (id: string) => {
    try {
      await deletePersonalPension(id)
      invalidate('personalPensions')
    } catch (error) {
      console.error('Failed to delete ISA:', error)
    }
  }

  // 도넛 차트 데이터
  const chartData = useMemo(() => {
    const labels: string[] = []
    const values: number[] = []
    const colors: string[] = []

    checkingAccounts.forEach(acc => {
      labels.push(acc.title)
      values.push(acc.current_balance)
      colors.push(COLORS.checking)
    })

    depositAccounts.forEach(acc => {
      labels.push(acc.title)
      values.push(acc.current_balance)
      colors.push(COLORS.deposit)
    })

    installmentSavingsAccounts.forEach(acc => {
      labels.push(acc.title)
      values.push(acc.current_balance)
      colors.push(COLORS.savings)
    })

    investmentAccounts.forEach(acc => {
      labels.push(acc.title)
      values.push(acc.current_balance)
      colors.push(COLORS[acc.type] || COLORS.other)
    })

    otherInvestmentAccounts.forEach(acc => {
      labels.push(acc.title)
      values.push(acc.current_balance)
      colors.push(COLORS.other)
    })

    isaAccounts.forEach(isa => {
      if (isa.current_balance) {
        const ownerLabel = isa.owner === 'spouse' ? '배우자' : '본인'
        labels.push(`${ownerLabel} ISA`)
        values.push(isa.current_balance)
        colors.push(isa.owner === 'spouse' ? CHART_COLORS.pensionDetail.isa_spouse : CHART_COLORS.pensionDetail.isa_self)
      }
    })

    return { labels, values, colors }
  }, [checkingAccounts, depositAccounts, installmentSavingsAccounts, investmentAccounts, otherInvestmentAccounts, isaAccounts])

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

  // 계좌 기간 포맷 헬퍼
  const formatAccountPeriod = (account: Savings) => {
    const sy = account.contribution_start_year
    const sm = account.contribution_start_month
    const my = account.maturity_year
    const mm = account.maturity_month
    if (!sy) return null
    const start = `${sy}.${String(sm || 1).padStart(2, '0')}`
    if (my) {
      const end = `${my}.${String(mm || 12).padStart(2, '0')}`
      return `${start}~${end}`
    }
    return `${start}~`
  }

  const hasData = totalAssets > 0

  // 모든 데이터가 없는 경우에만 로딩 표시
  const hasNoData = allSavings.length === 0 && personalPensions.length === 0

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingAccount || editingIsa) {
          cancelEdit()
          cancelIsaEdit()
          e.stopPropagation()
        } else if (showTypeMenu) {
          resetAddForm()
          e.stopPropagation()
        }
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [showTypeMenu, editingAccount, editingIsa])

  if (isLoading && hasNoData) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={2} itemsPerSection={2} />
      </div>
    )
  }

  const totalCount = checkingAccounts.length + depositAccounts.length + installmentSavingsAccounts.length + investmentAccounts.length + isaAccounts.length + otherInvestmentAccounts.length

  // 저축 편집 폼 (모달 안에서 사용)
  const renderSavingsForm = () => {
    const isChecking = editValues.type === 'checking'
    const isEditMode = !!editingAccount?.id

    return (
      <>
        {/* 계좌명 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>계좌명</span>
          <input
            type="text"
            className={styles.modalFormInput}
            value={editValues.name || ''}
            onChange={e => setEditValues({ ...editValues, name: e.target.value })}
            placeholder="예: 정기예금, 적금"
            autoFocus={!isEditMode}
          />
        </div>

        {/* 은행 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>은행</span>
          <select
            className={styles.modalFormSelect}
            value={editValues.broker || ''}
            onChange={e => setEditValues({ ...editValues, broker: e.target.value })}
          >
            <option value="">선택</option>
            {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* 잔액 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>잔액</span>
          <input
            type="number"
            className={styles.modalFormInput}
            value={editValues.balance || ''}
            onChange={e => setEditValues({ ...editValues, balance: e.target.value })}
            onWheel={e => (e.target as HTMLElement).blur()}
            placeholder="0"
          />
          <span className={styles.modalFormUnit}>만원</span>
        </div>

        {/* 소유자 */}
        {isMarried && (
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>소유자</span>
            <div className={styles.typeButtons}>
              <button
                type="button"
                className={`${styles.typeBtn} ${editValues.owner === 'self' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, owner: 'self' })}
              >
                본인
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${editValues.owner === 'spouse' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, owner: 'spouse' })}
              >
                배우자
              </button>
            </div>
          </div>
        )}

        {/* 시작 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>시작</span>
          <div className={styles.fieldContent}>
            <select
              className={styles.periodSelect}
              value={startType}
              onChange={(e) => {
                const val = e.target.value as 'current' | 'year'
                setStartType(val)
                if (val === 'current') {
                  setEditValues({ ...editValues, startYear: String(currentYear), startMonth: String(currentMonth) })
                  setStartDateText(toPeriodRaw(currentYear, currentMonth))
                }
              }}
            >
              <option value="current">현재</option>
              <option value="year">직접 입력</option>
            </select>
            {startType === 'year' && (
              <input
                type="text"
                className={`${styles.periodInput}${startDateText.length > 0 && !isPeriodValid(startDateText) ? ` ${styles.invalid}` : ''}`}
                value={formatPeriodDisplay(startDateText)}
                onChange={(e) => handlePeriodTextChange(e, setStartDateText,
                  (y) => setEditValues(prev => ({ ...prev, startYear: String(y) })),
                  (m) => setEditValues(prev => ({ ...prev, startMonth: String(m) }))
                )}
                placeholder="2026.01"
              />
            )}
          </div>
        </div>

        {/* 이율/금리 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>{isChecking ? '금리' : '이율'}</span>
          <input
            type="number"
            className={styles.modalFormInputSmall}
            value={editValues.interestRate || ''}
            onChange={e => setEditValues({ ...editValues, interestRate: e.target.value })}
            onWheel={e => (e.target as HTMLElement).blur()}
            step="0.01"
            placeholder="0"
          />
          <span className={styles.modalFormUnit}>%</span>
        </div>

        {/* 만기 (savings/deposit only) */}
        {(editValues.type === 'savings' || editValues.type === 'deposit') && (
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>만기</span>
            <div className={styles.fieldContent}>
              <input
                type="text"
                className={`${styles.periodInput}${maturityDateText.length > 0 && !isPeriodValid(maturityDateText) ? ` ${styles.invalid}` : ''}`}
                value={formatPeriodDisplay(maturityDateText)}
                onChange={(e) => handlePeriodTextChange(e, setMaturityDateText,
                  (y) => setEditValues(prev => ({ ...prev, maturityYear: String(y) })),
                  (m) => setEditValues(prev => ({ ...prev, maturityMonth: String(m) }))
                )}
                placeholder="2027.12"
              />
            </div>
          </div>
        )}

        {/* 비과세 (savings/deposit only) */}
        {(editValues.type === 'savings' || editValues.type === 'deposit') && (
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>비과세</span>
            <div className={styles.typeButtons}>
              <button
                type="button"
                className={`${styles.typeBtn} ${editValues.isTaxFree === 'true' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, isTaxFree: 'true' })}
              >
                O
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${editValues.isTaxFree !== 'true' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, isTaxFree: 'false' })}
              >
                X
              </button>
            </div>
          </div>
        )}

        {/* 통화 (savings/deposit only) */}
        {(editValues.type === 'savings' || editValues.type === 'deposit') && (
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>통화</span>
            <select
              className={styles.modalFormSelect}
              value={editValues.currency || 'KRW'}
              onChange={e => setEditValues({ ...editValues, currency: e.target.value })}
            >
              <option value="KRW">KRW (원)</option>
              <option value="USD">USD (달러)</option>
              <option value="EUR">EUR (유로)</option>
              <option value="JPY">JPY (엔)</option>
            </select>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className={styles.modalFormActions}>
          <button
            className={styles.modalCancelBtn}
            onClick={isEditMode ? cancelEdit : resetAddForm}
          >
            취소
          </button>
          <button
            className={styles.modalAddBtn}
            onClick={handleSaveSavingsAccount}
            disabled={!editValues.name || !editValues.balance}
          >
            {isEditMode ? '저장' : '추가'}
          </button>
        </div>
      </>
    )
  }

  // 투자 편집 폼 (모달 안에서 사용)
  const renderInvestmentForm = () => {
    const isEditMode = !!editingAccount?.id

    return (
      <>
        {/* 계좌명 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>계좌명</span>
          <input
            type="text"
            className={styles.modalFormInput}
            value={editValues.name || ''}
            onChange={e => setEditValues({ ...editValues, name: e.target.value })}
            placeholder="예: 미국주식, 국내ETF"
            autoFocus={!isEditMode}
          />
        </div>

        {/* 증권사 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>증권사</span>
          <select
            className={styles.modalFormSelect}
            value={editValues.broker || ''}
            onChange={e => setEditValues({ ...editValues, broker: e.target.value })}
          >
            <option value="">선택</option>
            {SECURITIES_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* 평가액 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>평가액</span>
          <input
            type="number"
            className={styles.modalFormInput}
            value={editValues.balance || ''}
            onChange={e => setEditValues({ ...editValues, balance: e.target.value })}
            onWheel={e => (e.target as HTMLElement).blur()}
            placeholder="0"
          />
          <span className={styles.modalFormUnit}>만원</span>
        </div>

        {/* 소유자 */}
        {isMarried && (
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>소유자</span>
            <div className={styles.typeButtons}>
              <button
                type="button"
                className={`${styles.typeBtn} ${editValues.owner === 'self' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, owner: 'self' })}
              >
                본인
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${editValues.owner === 'spouse' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, owner: 'spouse' })}
              >
                배우자
              </button>
            </div>
          </div>
        )}

        {/* 시작 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>시작</span>
          <div className={styles.fieldContent}>
            <select
              className={styles.periodSelect}
              value={startType}
              onChange={(e) => {
                const val = e.target.value as 'current' | 'year'
                setStartType(val)
                if (val === 'current') {
                  setEditValues({ ...editValues, startYear: String(currentYear), startMonth: String(currentMonth) })
                  setStartDateText(toPeriodRaw(currentYear, currentMonth))
                }
              }}
            >
              <option value="current">현재</option>
              <option value="year">직접 입력</option>
            </select>
            {startType === 'year' && (
              <input
                type="text"
                className={`${styles.periodInput}${startDateText.length > 0 && !isPeriodValid(startDateText) ? ` ${styles.invalid}` : ''}`}
                value={formatPeriodDisplay(startDateText)}
                onChange={(e) => handlePeriodTextChange(e, setStartDateText,
                  (y) => setEditValues(prev => ({ ...prev, startYear: String(y) })),
                  (m) => setEditValues(prev => ({ ...prev, startMonth: String(m) }))
                )}
                placeholder="2026.01"
              />
            )}
          </div>
        </div>

        {/* 수익률 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>수익률</span>
          <div className={styles.fieldContent}>
            {editValues.rateCategory !== 'fixed' && (
              <span className={styles.rateValue}>시뮬레이션 가정 (투자 수익률)</span>
            )}
            {editValues.rateCategory === 'fixed' && (
              <>
                <input
                  type="number"
                  className={styles.customRateInput}
                  value={editValues.expectedReturn || ''}
                  onChange={e => setEditValues({ ...editValues, expectedReturn: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  step="0.1"
                  placeholder="0"
                />
                <span className={styles.rateUnit}>%</span>
              </>
            )}
            <div className={styles.rateToggle}>
              <button
                type="button"
                className={`${styles.rateToggleBtn} ${editValues.rateCategory !== 'fixed' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, rateCategory: 'investment' })}
              >
                시뮬레이션 가정
              </button>
              <button
                type="button"
                className={`${styles.rateToggleBtn} ${editValues.rateCategory === 'fixed' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, rateCategory: 'fixed' })}
              >
                직접 입력
              </button>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className={styles.modalFormActions}>
          <button
            className={styles.modalCancelBtn}
            onClick={isEditMode ? cancelEdit : resetAddForm}
          >
            취소
          </button>
          <button
            className={styles.modalAddBtn}
            onClick={handleSaveInvestmentAccount}
            disabled={!editValues.name || !editValues.balance}
          >
            {isEditMode ? '저장' : '추가'}
          </button>
        </div>
      </>
    )
  }

  // ISA 편집 폼 (모달 안에서 사용)
  const renderIsaForm = () => {
    const isEditMode = !!(editingIsa && editingIsa !== 'new')

    return (
      <>
        {/* 계좌명 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>계좌명</span>
          <input
            type="text"
            className={styles.modalFormInput}
            value={isaEditValues.name || ''}
            onChange={e => setIsaEditValues({ ...isaEditValues, name: e.target.value })}
            placeholder="예: ISA중개형"
            autoFocus={!isEditMode}
          />
        </div>

        {/* 증권사 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>증권사</span>
          <select
            className={styles.modalFormSelect}
            value={isaEditValues.broker || ''}
            onChange={e => setIsaEditValues({ ...isaEditValues, broker: e.target.value })}
          >
            <option value="">선택</option>
            {SECURITIES_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* 잔액 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>잔액</span>
          <input
            type="number"
            className={styles.modalFormInput}
            value={isaEditValues.balance || ''}
            onChange={e => setIsaEditValues({ ...isaEditValues, balance: e.target.value })}
            onWheel={e => (e.target as HTMLElement).blur()}
            placeholder="0"
          />
          <span className={styles.modalFormUnit}>만원</span>
        </div>

        {/* 납입 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>납입</span>
          <input
            type="number"
            className={styles.modalFormInput}
            value={isaEditValues.monthly || ''}
            onChange={e => setIsaEditValues({ ...isaEditValues, monthly: e.target.value })}
            onWheel={e => (e.target as HTMLElement).blur()}
            placeholder="0"
          />
          <span className={styles.modalFormUnit}>만원/월</span>
        </div>

        {/* 소유자 */}
        {isMarried && (
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>소유자</span>
            <div className={styles.typeButtons}>
              <button
                type="button"
                className={`${styles.typeBtn} ${isaEditValues.owner === 'self' ? styles.active : ''}`}
                onClick={() => setIsaEditValues({ ...isaEditValues, owner: 'self' })}
              >
                본인
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${isaEditValues.owner === 'spouse' ? styles.active : ''}`}
                onClick={() => setIsaEditValues({ ...isaEditValues, owner: 'spouse' })}
              >
                배우자
              </button>
            </div>
          </div>
        )}

        {/* 수익률 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>수익률</span>
          <div className={styles.fieldContent}>
            {isaEditValues.rateCategory !== 'fixed' && (
              <span className={styles.rateValue}>시뮬레이션 가정 (투자 수익률)</span>
            )}
            {isaEditValues.rateCategory === 'fixed' && (
              <>
                <input
                  type="number"
                  className={styles.customRateInput}
                  value={isaEditValues.returnRate || ''}
                  onChange={e => setIsaEditValues({ ...isaEditValues, returnRate: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  step="0.1"
                  placeholder="5"
                />
                <span className={styles.rateUnit}>%</span>
              </>
            )}
            <div className={styles.rateToggle}>
              <button
                type="button"
                className={`${styles.rateToggleBtn} ${isaEditValues.rateCategory !== 'fixed' ? styles.active : ''}`}
                onClick={() => setIsaEditValues({ ...isaEditValues, rateCategory: 'investment' })}
              >
                시뮬레이션 가정
              </button>
              <button
                type="button"
                className={`${styles.rateToggleBtn} ${isaEditValues.rateCategory === 'fixed' ? styles.active : ''}`}
                onClick={() => setIsaEditValues({ ...isaEditValues, rateCategory: 'fixed' })}
              >
                직접 입력
              </button>
            </div>
          </div>
        </div>

        {/* 만기 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>만기</span>
          <div className={styles.fieldContent}>
            <input
              type="text"
              className={`${styles.periodInput}${isaMaturityDateText.length > 0 && !isPeriodValid(isaMaturityDateText) ? ` ${styles.invalid}` : ''}`}
              value={formatPeriodDisplay(isaMaturityDateText)}
              onChange={(e) => handlePeriodTextChange(e, setIsaMaturityDateText,
                (y) => setIsaEditValues(prev => ({ ...prev, maturityYear: String(y) })),
                (m) => setIsaEditValues(prev => ({ ...prev, maturityMonth: String(m) }))
              )}
              placeholder="2029.12"
            />
          </div>
        </div>

        {/* 전략 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>전략</span>
          <div className={styles.typeButtons}>
            <button
              type="button"
              className={`${styles.typeBtn} ${isaEditValues.strategy === 'pension_savings' ? styles.active : ''}`}
              onClick={() => setIsaEditValues({ ...isaEditValues, strategy: 'pension_savings' })}
            >
              연금저축
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${isaEditValues.strategy === 'irp' ? styles.active : ''}`}
              onClick={() => setIsaEditValues({ ...isaEditValues, strategy: 'irp' })}
            >
              IRP
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${isaEditValues.strategy === 'cash' ? styles.active : ''}`}
              onClick={() => setIsaEditValues({ ...isaEditValues, strategy: 'cash' })}
            >
              현금 인출
            </button>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className={styles.modalFormActions}>
          <button
            className={styles.modalCancelBtn}
            onClick={isEditMode ? cancelIsaEdit : resetAddForm}
          >
            취소
          </button>
          <button
            className={styles.modalAddBtn}
            onClick={handleSaveIsa}
          >
            {isEditMode ? '저장' : '추가'}
          </button>
        </div>
      </>
    )
  }

  // 기타 투자자산 폼 (이름 + 초기 잔액 + 수익률만)
  const renderOtherForm = () => {
    const isEditMode = !!editingAccount?.id

    return (
      <>
        {/* 이름 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>이름</span>
          <input
            type="text"
            className={styles.modalFormInput}
            value={editValues.name || ''}
            onChange={e => setEditValues({ ...editValues, name: e.target.value })}
            placeholder="예: 달러, 부동산펀드, 채권"
            autoFocus={!isEditMode}
          />
        </div>

        {/* 초기 잔액 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>초기 금액</span>
          <input
            type="number"
            className={styles.modalFormInput}
            value={editValues.balance || ''}
            onChange={e => setEditValues({ ...editValues, balance: e.target.value })}
            onWheel={e => (e.target as HTMLElement).blur()}
            placeholder="0"
          />
          <span className={styles.modalFormUnit}>만원</span>
        </div>

        {/* 소유자 */}
        {isMarried && (
          <div className={styles.modalFormRow}>
            <span className={styles.modalFormLabel}>소유자</span>
            <div className={styles.typeButtons}>
              <button
                type="button"
                className={`${styles.typeBtn} ${editValues.owner === 'self' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, owner: 'self' })}
              >
                본인
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${editValues.owner === 'spouse' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, owner: 'spouse' })}
              >
                배우자
              </button>
            </div>
          </div>
        )}

        {/* 시작 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>시작</span>
          <div className={styles.fieldContent}>
            <select
              className={styles.periodSelect}
              value={startType}
              onChange={(e) => {
                const val = e.target.value as 'current' | 'year'
                setStartType(val)
                if (val === 'current') {
                  setEditValues({ ...editValues, startYear: String(currentYear), startMonth: String(currentMonth) })
                  setStartDateText(toPeriodRaw(currentYear, currentMonth))
                }
              }}
            >
              <option value="current">현재</option>
              <option value="year">직접 입력</option>
            </select>
            {startType === 'year' && (
              <input
                type="text"
                className={`${styles.periodInput}${startDateText.length > 0 && !isPeriodValid(startDateText) ? ` ${styles.invalid}` : ''}`}
                value={formatPeriodDisplay(startDateText)}
                onChange={(e) => handlePeriodTextChange(e, setStartDateText,
                  (y) => setEditValues(prev => ({ ...prev, startYear: String(y) })),
                  (m) => setEditValues(prev => ({ ...prev, startMonth: String(m) }))
                )}
                placeholder="2026.01"
              />
            )}
          </div>
        </div>

        {/* 기대 수익률 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>수익률</span>
          <div className={styles.fieldContent}>
            {editValues.rateCategory !== 'fixed' && (
              <span className={styles.rateValue}>시뮬레이션 가정 (투자 수익률)</span>
            )}
            {editValues.rateCategory === 'fixed' && (
              <>
                <input
                  type="number"
                  className={styles.customRateInput}
                  value={editValues.expectedReturn || ''}
                  onChange={e => setEditValues({ ...editValues, expectedReturn: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  step="0.1"
                  placeholder="0"
                />
                <span className={styles.rateUnit}>%</span>
              </>
            )}
            <div className={styles.rateToggle}>
              <button
                type="button"
                className={`${styles.rateToggleBtn} ${editValues.rateCategory !== 'fixed' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, rateCategory: 'investment' })}
              >
                시뮬레이션 가정
              </button>
              <button
                type="button"
                className={`${styles.rateToggleBtn} ${editValues.rateCategory === 'fixed' ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, rateCategory: 'fixed' })}
              >
                직접 입력
              </button>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className={styles.modalFormActions}>
          <button
            className={styles.modalCancelBtn}
            onClick={isEditMode ? cancelEdit : resetAddForm}
          >
            취소
          </button>
          <button
            className={styles.modalAddBtn}
            onClick={handleSaveOtherAsset}
            disabled={!editValues.name}
          >
            {isEditMode ? '저장' : '추가'}
          </button>
        </div>
      </>
    )
  }

  // 편집 모달에서 어떤 섹션 타입인지 판별
  const getEditSectionLabel = () => {
    if (editingAccount?.section === 'checking') return '입출금 통장 수정'
    if (editingAccount?.section === 'deposit') return '정기 예금 수정'
    if (editingAccount?.section === 'installment_savings') return '적금 수정'
    if (editingAccount?.section === 'investment') return '투자 계좌 수정'
    if (editingAccount?.section === 'other') return '기타 투자 수정'
    return 'ISA 수정'
  }

  // 편집 모달에서 올바른 폼 렌더링
  const renderEditModalForm = () => {
    if (editingAccount?.section === 'checking' || editingAccount?.section === 'deposit' || editingAccount?.section === 'installment_savings') return renderSavingsForm()
    if (editingAccount?.section === 'investment') return renderInvestmentForm()
    if (editingAccount?.section === 'other') return renderOtherForm()
    if (editingIsa && editingIsa !== 'new') return renderIsaForm()
    return null
  }

  // 편집 모달 표시 여부
  const showEditModal = (editingAccount && editingAccount.id !== null) || (editingIsa && editingIsa !== 'new')

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.headerToggle} onClick={() => setIsExpanded(!isExpanded)} type="button">
          <span className={styles.title}>저축/투자</span>
          <span className={styles.count}>{totalCount}개</span>
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

      {/* 타입 선택 모달 (2-step) */}
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
                  <span className={styles.typeModalTitle}>저축/투자 추가</span>
                  <button
                    className={styles.typeModalClose}
                    onClick={resetAddForm}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.typeGrid}>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('checking')}>
                    <span className={styles.typeCardName}>입출금 통장</span>
                    <span className={styles.typeCardDesc}>자유입출금 계좌</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('deposit')}>
                    <span className={styles.typeCardName}>정기 예금</span>
                    <span className={styles.typeCardDesc}>만기까지 예치</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('installment_savings')}>
                    <span className={styles.typeCardName}>적금</span>
                    <span className={styles.typeCardDesc}>매월 납입</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('investment')}>
                    <span className={styles.typeCardName}>투자 계좌</span>
                    <span className={styles.typeCardDesc}>주식, 펀드, ETF 등</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('isa')}>
                    <span className={styles.typeCardName}>ISA</span>
                    <span className={styles.typeCardDesc}>개인종합자산관리</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => handleTypeSelect('other')}>
                    <span className={styles.typeCardName}>기타 투자자산</span>
                    <span className={styles.typeCardDesc}>이름, 수익률만 설정</span>
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
                      {addingType === 'checking' ? '입출금 통장' : addingType === 'deposit' ? '정기 예금' : addingType === 'installment_savings' ? '적금' : addingType === 'investment' ? '투자 계좌' : addingType === 'isa' ? 'ISA' : '기타 투자자산'} 추가
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
                  {(addingType === 'checking' || addingType === 'deposit' || addingType === 'installment_savings') && renderSavingsForm()}
                  {addingType === 'investment' && renderInvestmentForm()}
                  {addingType === 'isa' && renderIsaForm()}
                  {addingType === 'other' && renderOtherForm()}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 편집 모달 */}
      {showEditModal && createPortal(
        <div
          className={styles.typeModalOverlay}
          data-scenario-dropdown-portal="true"
          onClick={() => { cancelEdit(); cancelIsaEdit(); }}
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
                {getEditSectionLabel()}
              </span>
              <div className={styles.modalHeaderActions}>
                {/* 입출금통장은 삭제 불가 */}
                {!(editingAccount?.section === 'checking' && editValues.name === '입출금통장') && (
                  <button
                    className={styles.modalDeleteBtn}
                    onClick={() => {
                      if (window.confirm('이 항목을 삭제하시겠습니까?')) {
                        if (editingIsa && editingIsa !== 'new') {
                          handleDeleteIsa(editingIsa)
                        } else if (editingAccount?.id) {
                          handleDeleteAccount(editingAccount.id)
                        }
                        cancelEdit()
                        cancelIsaEdit()
                      }
                    }}
                    type="button"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  className={styles.typeModalClose}
                  onClick={() => { cancelEdit(); cancelIsaEdit(); }}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className={styles.modalFormBody}>
              {renderEditModalForm()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.groupedList}>
          {totalCount === 0 && (
            <p className={styles.emptyHint}>
              아직 등록된 저축/투자가 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}

          {checkingAccounts.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>입출금 통장</span>
                  <span className={styles.sectionCount}>{checkingAccounts.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {checkingAccounts.map(account => {
                  const period = formatAccountPeriod(account)
                  return (
                    <div key={account.id} className={styles.assetItem} onClick={() => startEditSavingsAccount(account)}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>
                          {account.title} | {account.owner === 'spouse' ? '배우자' : '본인'}
                        </span>
                        {period && <span className={styles.itemMeta}>{period}</span>}
                        {account.interest_rate != null && account.interest_rate > 0 && (
                          <span className={styles.itemMeta}>금리 {account.interest_rate}%</span>
                        )}
                      </div>
                      <div className={styles.itemRight}>
                        <span className={styles.itemAmount}>{formatMoney(account.current_balance)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {depositAccounts.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>정기 예금</span>
                  <span className={styles.sectionCount}>{depositAccounts.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {depositAccounts.map(account => {
                  const period = formatAccountPeriod(account)
                  return (
                    <div key={account.id} className={styles.assetItem} onClick={() => startEditSavingsAccount(account)}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>
                          {account.title} | {account.owner === 'spouse' ? '배우자' : '본인'}
                        </span>
                        {period && <span className={styles.itemMeta}>{period}</span>}
                        {account.interest_rate != null && account.interest_rate > 0 && (
                          <span className={styles.itemMeta}>금리 {account.interest_rate}%</span>
                        )}
                      </div>
                      <div className={styles.itemRight}>
                        <span className={styles.itemAmount}>{formatMoney(account.current_balance)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {installmentSavingsAccounts.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>적금</span>
                  <span className={styles.sectionCount}>{installmentSavingsAccounts.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {installmentSavingsAccounts.map(account => {
                  const period = formatAccountPeriod(account)
                  return (
                    <div key={account.id} className={styles.assetItem} onClick={() => startEditSavingsAccount(account)}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>
                          {account.title} | {account.owner === 'spouse' ? '배우자' : '본인'}
                        </span>
                        {period && <span className={styles.itemMeta}>{period}</span>}
                        {account.interest_rate != null && account.interest_rate > 0 && (
                          <span className={styles.itemMeta}>금리 {account.interest_rate}%</span>
                        )}
                      </div>
                      <div className={styles.itemRight}>
                        <span className={styles.itemAmount}>{formatMoney(account.current_balance)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {investmentAccounts.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>투자 계좌</span>
                  <span className={styles.sectionCount}>{investmentAccounts.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {investmentAccounts.map(account => {
                  const period = formatAccountPeriod(account)
                  return (
                    <div key={account.id} className={styles.assetItem} onClick={() => startEditSavingsAccount(account)}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>
                          {account.title} | {account.owner === 'spouse' ? '배우자' : '본인'}
                        </span>
                        {period && <span className={styles.itemMeta}>{period}</span>}
                        <span className={styles.itemMeta}>
                          {account.expected_return ? `수익률 ${account.expected_return}%` : '시뮬레이션 가정 (투자 수익률)'}
                        </span>
                      </div>
                      <div className={styles.itemRight}>
                        <span className={styles.itemAmount}>{formatMoney(account.current_balance)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {isaAccounts.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>ISA</span>
                  <span className={styles.sectionCount}>{isaAccounts.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {isaAccounts.map(isa => {
                  const metaParts: string[] = ['ISA']
                  if (isa.monthly_contribution) metaParts.push(`월 ${formatMoney(isa.monthly_contribution)} 납입`)
                  if (isa.isa_maturity_year) {
                    const padMonth = String(isa.isa_maturity_month || 12).padStart(2, '0')
                    const strategyLabel = ISA_STRATEGY_LABELS[isa.isa_maturity_strategy as keyof typeof ISA_STRATEGY_LABELS] || '연금저축 전환'
                    metaParts.push(`~${isa.isa_maturity_year}.${padMonth} 만기 → ${strategyLabel}`)
                  }

                  return (
                    <div key={isa.id} className={styles.assetItem} onClick={() => startEditIsaAccount(isa)}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>
                          {isa.title || 'ISA'} | {isa.owner === 'spouse' ? '배우자' : '본인'}
                        </span>
                        <span className={styles.itemMeta}>
                          {metaParts.join(' · ')}
                        </span>
                      </div>
                      <div className={styles.itemRight}>
                        <span className={styles.itemAmount}>
                          {formatMoney(isa.current_balance)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {otherInvestmentAccounts.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>기타 투자자산</span>
                  <span className={styles.sectionCount}>{otherInvestmentAccounts.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {otherInvestmentAccounts.map(account => {
                  const period = formatAccountPeriod(account)
                  return (
                    <div key={account.id} className={styles.assetItem} onClick={() => startEditSavingsAccount(account)}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>
                          {account.title} | {account.owner === 'spouse' ? '배우자' : '본인'}
                        </span>
                        {period && <span className={styles.itemMeta}>{period}</span>}
                        <span className={styles.itemMeta}>
                          {account.expected_return ? `수익률 ${account.expected_return}%` : '시뮬레이션 가정 (투자 수익률)'}
                        </span>
                      </div>
                      <div className={styles.itemRight}>
                        <span className={styles.itemAmount}>{formatMoney(account.current_balance)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <p className={styles.infoText}>
        연금(공적연금, 퇴직연금, 연금저축, IRP)은 연금 탭에서 관리됩니다.
      </p>
    </div>
  )
}
