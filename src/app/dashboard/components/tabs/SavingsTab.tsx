'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Trash2, PiggyBank, Plus } from 'lucide-react'
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
import { useSavingsData, usePersonalPensions, useInvalidateByCategory } from '@/hooks/useFinancialData'
import {
  createSavings,
  updateSavings,
  deleteSavings,
  SAVINGS_TYPE_LABELS,
  INVESTMENT_TYPE_LABELS,
  type UISavingsType,
  type UIInvestmentType,
} from '@/lib/services/savingsService'
import {
  createPersonalPension,
  updatePersonalPension,
  deletePersonalPension,
  upsertPersonalPension,
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
  retirementAge = 60
}: SavingsTabProps) {
  const { isDark } = useChartTheme()
  const currentYear = new Date().getFullYear()

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: allSavings = [], isLoading: savingsLoading } = useSavingsData(simulationId)
  const { data: personalPensions = [], isLoading: pensionsLoading } = usePersonalPensions(simulationId)
  const invalidate = useInvalidateByCategory(simulationId)

  const isLoading = savingsLoading || pensionsLoading

  // 저축 계좌와 투자 계좌 분리 (useMemo로 필터링)
  const savingsAccounts = useMemo(
    () => allSavings.filter(s => ['checking', 'savings', 'deposit'].includes(s.type)),
    [allSavings]
  )
  const investmentAccounts = useMemo(
    () => allSavings.filter(s => ['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other'].includes(s.type)),
    [allSavings]
  )

  // 편집 상태
  const [editingAccount, setEditingAccount] = useState<{ section: 'savings' | 'investment', id: string | null } | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isExpanded, setIsExpanded] = useState(true)

  // ISA 편집 상태
  const [editingIsa, setEditingIsa] = useState<string | 'new' | null>(null)
  const [isaEditValues, setIsaEditValues] = useState<Record<string, string>>({})

  // ISA 데이터 추출
  const isaAccounts = useMemo(
    () => personalPensions.filter(p => p.pension_type === 'isa'),
    [personalPensions]
  )
  const isMarried = spouseBirthYear !== null

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  // 합계 계산
  const savingsTotal = savingsAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const investmentTotal = investmentAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const isaTotal = isaAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const totalAssets = savingsTotal + investmentTotal + isaTotal

  // 저축 계좌 CRUD
  const startAddAccount = (section: 'savings' | 'investment' | 'isa') => {
    if (section === 'isa') {
      startAddIsa()
      return
    }
    setEditingAccount({ section, id: null })
    if (section === 'savings') {
      setEditValues({
        type: 'deposit',
        name: '',
        broker: '',
        balance: '',
        interestRate: '',
        startYear: String(currentYear),
        startMonth: String(new Date().getMonth() + 1),
        maturityYear: String(currentYear + 1),
        maturityMonth: '12',
        isTaxFree: 'false',
        currency: 'KRW',
        owner: 'self',
      })
    } else {
      setEditValues({ type: 'domestic_stock', name: '', broker: '', balance: '', expectedReturn: '', owner: 'self' })
    }
  }

  const startEditSavingsAccount = (account: Savings) => {
    const section = ['checking', 'savings', 'deposit'].includes(account.type) ? 'savings' : 'investment'
    setEditingAccount({ section, id: account.id })
    if (section === 'savings') {
      setEditValues({
        type: account.type,
        name: account.title,
        broker: account.broker_name || '',
        balance: account.current_balance.toString(),
        interestRate: account.interest_rate?.toString() || '',
        startYear: account.contribution_start_year?.toString() || '',
        startMonth: account.contribution_start_month?.toString() || '',
        maturityYear: account.maturity_year?.toString() || '',
        maturityMonth: account.maturity_month?.toString() || '',
        isTaxFree: account.is_tax_free ? 'true' : 'false',
        currency: account.currency || 'KRW',
        owner: account.owner || 'self',
      })
    } else {
      setEditValues({
        type: account.type,
        name: account.title,
        broker: account.broker_name || '',
        balance: account.current_balance.toString(),
        expectedReturn: account.expected_return?.toString() || '',
        owner: account.owner || 'self',
      })
    }
  }

  const cancelEdit = () => {
    setEditingAccount(null)
    setEditValues({})
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
        contribution_start_year: isChecking ? null : (editValues.startYear ? parseInt(editValues.startYear) : null),
        contribution_start_month: isChecking ? null : (editValues.startMonth ? parseInt(editValues.startMonth) : null),
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
      cancelEdit()
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
      }

      if (editingAccount?.id) {
        await updateSavings(editingAccount.id, input)
      } else {
        await createSavings(input)
      }

      invalidate('savings')
      cancelEdit()
    } catch (error) {
      console.error('Failed to save investment account:', error)
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

  // ISA 편집 함수
  const startAddIsa = () => {
    setEditingIsa('new')
    setIsaEditValues({
      name: '',
      broker: '',
      balance: '',
      monthly: '',
      maturityYear: String(currentYear + 3),
      maturityMonth: '12',
      strategy: 'pension_savings',
      owner: 'self',
    })
  }

  const startEditIsaAccount = (isa: PersonalPension) => {
    setEditingIsa(isa.id)
    setIsaEditValues({
      name: isa.title || '',
      broker: isa.broker_name || '',
      balance: isa.current_balance.toString(),
      monthly: isa.monthly_contribution?.toString() || '',
      maturityYear: isa.isa_maturity_year?.toString() || String(currentYear + 3),
      maturityMonth: isa.isa_maturity_month?.toString() || '12',
      strategy: isa.isa_maturity_strategy || 'pension_savings',
      owner: isa.owner || 'self',
    })
  }

  const cancelIsaEdit = () => {
    setEditingIsa(null)
    setIsaEditValues({})
  }

  const handleSaveIsa = async () => {
    try {
      const owner = (isaEditValues.owner || 'self') as Owner
      const ownerBirthYear = owner === 'self' ? birthYear : (spouseBirthYear || birthYear)

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
        return_rate: 5,
      }

      if (editingIsa && editingIsa !== 'new') {
        await updatePersonalPension(editingIsa, input, ownerBirthYear, retirementAge)
      } else {
        await createPersonalPension(input, ownerBirthYear, retirementAge)
      }

      invalidate('personalPensions')
      cancelIsaEdit()
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

    savingsAccounts.forEach(acc => {
      labels.push(`${acc.title} (${SAVINGS_TYPE_LABELS[acc.type as UISavingsType] || acc.type})`)
      values.push(acc.current_balance)
      colors.push(COLORS[acc.type] || COLORS.other)
    })

    investmentAccounts.forEach(acc => {
      labels.push(`${acc.title} (${INVESTMENT_TYPE_LABELS[acc.type as UIInvestmentType] || acc.type})`)
      values.push(acc.current_balance)
      colors.push(COLORS[acc.type] || COLORS.other)
    })

    // ISA 추가
    isaAccounts.forEach(isa => {
      if (isa.current_balance) {
        const ownerLabel = isa.owner === 'spouse' ? '배우자' : '본인'
        labels.push(`${ownerLabel} ISA`)
        values.push(isa.current_balance)
        colors.push(isa.owner === 'spouse' ? CHART_COLORS.pensionDetail.isa_spouse : CHART_COLORS.pensionDetail.isa_self)
      }
    })

    return { labels, values, colors }
  }, [savingsAccounts, investmentAccounts, isaAccounts])

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

  // 모든 데이터가 없는 경우에만 로딩 표시
  const hasNoData = allSavings.length === 0 && personalPensions.length === 0

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

  const handleTypeSelect = (section: 'savings' | 'investment' | 'isa') => {
    startAddAccount(section)
    setShowTypeMenu(false)
  }

  if (isLoading && hasNoData) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={2} itemsPerSection={2} />
      </div>
    )
  }

  const totalCount = savingsAccounts.length + investmentAccounts.length + isaAccounts.length

  // 모든 항목을 단일 리스트로 합치기
  const allItems = useMemo(() => {
    const items: Array<{ type: 'savings' | 'investment' | 'isa', data: Savings | PersonalPension }> = []
    savingsAccounts.forEach(s => items.push({ type: 'savings', data: s }))
    investmentAccounts.forEach(i => items.push({ type: 'investment', data: i }))
    isaAccounts.forEach(isa => items.push({ type: 'isa', data: isa }))
    return items
  }, [savingsAccounts, investmentAccounts, isaAccounts])

  // 렌더 함수들
  const renderSavingsEditForm = (account: Savings | null) => {
    const isEditing = account !== null
    const isChecking = editValues.type === 'checking'

    return (
      <div className={styles.editItem}>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>유형</span>
          <div className={styles.typeButtons}>
            {(['checking', 'savings', 'deposit'] as UISavingsType[]).map(type => (
              <button
                key={type}
                type="button"
                className={`${styles.typeBtn} ${editValues.type === type ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, type })}
              >
                {SAVINGS_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>계좌명</span>
          <div className={styles.editField}>
            <input
              type="text"
              className={styles.editInputWide}
              value={editValues.name || ''}
              onChange={e => setEditValues({ ...editValues, name: e.target.value })}
              placeholder="예: 정기예금, 적금"
              autoFocus
            />
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>은행</span>
          <div className={styles.editField}>
            <select
              className={styles.editSelect}
              value={editValues.broker || ''}
              onChange={e => setEditValues({ ...editValues, broker: e.target.value })}
            >
              <option value="">선택</option>
              {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>잔액</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInput}
              value={editValues.balance || ''}
              onChange={e => setEditValues({ ...editValues, balance: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.editUnit}>만원</span>
          </div>
        </div>
        {isMarried && (
          <div className={styles.editRow}>
            <span className={styles.editRowLabel}>소유자</span>
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
        {(editValues.type === 'savings' || editValues.type === 'deposit') && (
          <>
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>가입일</span>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editValues.startYear || ''}
                  onChange={e => setEditValues({ ...editValues, startYear: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder={String(currentYear)}
                />
                <span className={styles.editUnit}>년</span>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editValues.startMonth || ''}
                  onChange={e => setEditValues({ ...editValues, startMonth: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  min={1}
                  max={12}
                  placeholder="1"
                />
                <span className={styles.editUnit}>월</span>
              </div>
            </div>
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>이율</span>
              <div className={styles.editField}>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editValues.interestRate || ''}
                  onChange={e => setEditValues({ ...editValues, interestRate: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  step="0.01"
                  placeholder="0"
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
                  value={editValues.maturityYear || ''}
                  onChange={e => setEditValues({ ...editValues, maturityYear: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder={String(currentYear + 1)}
                />
                <span className={styles.editUnit}>년</span>
                <input
                  type="number"
                  className={styles.editInputSmall}
                  value={editValues.maturityMonth || ''}
                  onChange={e => setEditValues({ ...editValues, maturityMonth: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  min={1}
                  max={12}
                  placeholder="12"
                />
                <span className={styles.editUnit}>월</span>
              </div>
            </div>
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>비과세</span>
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
            <div className={styles.editRow}>
              <span className={styles.editRowLabel}>통화</span>
              <div className={styles.editField}>
                <select
                  className={styles.editSelect}
                  value={editValues.currency || 'KRW'}
                  onChange={e => setEditValues({ ...editValues, currency: e.target.value })}
                >
                  <option value="KRW">KRW (원)</option>
                  <option value="USD">USD (달러)</option>
                  <option value="EUR">EUR (유로)</option>
                  <option value="JPY">JPY (엔)</option>
                </select>
              </div>
            </div>
          </>
        )}
        {editValues.type === 'checking' && (
          <div className={styles.editRow}>
            <span className={styles.editRowLabel}>금리</span>
            <div className={styles.editField}>
              <input
                type="number"
                className={styles.editInputSmall}
                value={editValues.interestRate || ''}
                onChange={e => setEditValues({ ...editValues, interestRate: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                step="0.01"
                placeholder="0"
              />
              <span className={styles.editUnit}>%</span>
            </div>
          </div>
        )}
        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
          <button className={styles.saveBtn} onClick={handleSaveSavingsAccount}>저장</button>
        </div>
      </div>
    )
  }

  const renderInvestmentEditForm = (account: Savings | null) => {
    return (
      <div className={styles.editItem}>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>유형</span>
          <div className={styles.typeButtons}>
            {(['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other'] as UIInvestmentType[]).map(type => (
              <button
                key={type}
                type="button"
                className={`${styles.typeBtn} ${editValues.type === type ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, type })}
              >
                {INVESTMENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>계좌명</span>
          <div className={styles.editField}>
            <input
              type="text"
              className={styles.editInputWide}
              value={editValues.name || ''}
              onChange={e => setEditValues({ ...editValues, name: e.target.value })}
              placeholder="예: 미국주식, 국내ETF"
              autoFocus
            />
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>증권사</span>
          <div className={styles.editField}>
            <select
              className={styles.editSelect}
              value={editValues.broker || ''}
              onChange={e => setEditValues({ ...editValues, broker: e.target.value })}
            >
              <option value="">선택</option>
              {SECURITIES_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>평가액</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInput}
              value={editValues.balance || ''}
              onChange={e => setEditValues({ ...editValues, balance: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.editUnit}>만원</span>
          </div>
        </div>
        {isMarried && (
          <div className={styles.editRow}>
            <span className={styles.editRowLabel}>소유자</span>
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
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>수익률</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInputSmall}
              value={editValues.expectedReturn || ''}
              onChange={e => setEditValues({ ...editValues, expectedReturn: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              step="0.1"
              placeholder="0"
            />
            <span className={styles.editUnit}>%</span>
          </div>
        </div>
        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
          <button className={styles.saveBtn} onClick={handleSaveInvestmentAccount}>저장</button>
        </div>
      </div>
    )
  }

  const renderIsaEditForm = (isa: PersonalPension | null) => {
    return (
      <div className={styles.editItem}>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>계좌명</span>
          <div className={styles.editField}>
            <input
              type="text"
              className={styles.editInputWide}
              value={isaEditValues.name || ''}
              onChange={e => setIsaEditValues({ ...isaEditValues, name: e.target.value })}
              placeholder="예: ISA중개형"
              autoFocus
            />
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>증권사</span>
          <div className={styles.editField}>
            <select
              className={styles.editSelect}
              value={isaEditValues.broker || ''}
              onChange={e => setIsaEditValues({ ...isaEditValues, broker: e.target.value })}
            >
              <option value="">선택</option>
              {SECURITIES_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>잔액</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInput}
              value={isaEditValues.balance || ''}
              onChange={e => setIsaEditValues({ ...isaEditValues, balance: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.editUnit}>만원</span>
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>납입</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInput}
              value={isaEditValues.monthly || ''}
              onChange={e => setIsaEditValues({ ...isaEditValues, monthly: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              placeholder="0"
            />
            <span className={styles.editUnit}>만원/월</span>
          </div>
        </div>
        {isMarried && (
          <div className={styles.editRow}>
            <span className={styles.editRowLabel}>소유자</span>
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
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>만기</span>
          <div className={styles.editField}>
            <input
              type="number"
              className={styles.editInputSmall}
              value={isaEditValues.maturityYear || ''}
              onChange={e => setIsaEditValues({ ...isaEditValues, maturityYear: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              min={currentYear}
              max={currentYear + 10}
              placeholder={String(currentYear + 3)}
            />
            <span className={styles.editUnit}>년</span>
            <input
              type="number"
              className={styles.editInputSmall}
              value={isaEditValues.maturityMonth || ''}
              onChange={e => setIsaEditValues({ ...isaEditValues, maturityMonth: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              min={1}
              max={12}
              placeholder="12"
            />
            <span className={styles.editUnit}>월</span>
          </div>
        </div>
        <div className={styles.editRow}>
          <span className={styles.editRowLabel}>전략</span>
          <div className={styles.typeButtons}>
            <button
              type="button"
              className={`${styles.typeBtn} ${isaEditValues.strategy === 'pension_savings' ? styles.active : ''}`}
              onClick={() => setIsaEditValues({ ...isaEditValues, strategy: 'pension_savings' })}
            >
              연금저축 전환
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${isaEditValues.strategy === 'irp' ? styles.active : ''}`}
              onClick={() => setIsaEditValues({ ...isaEditValues, strategy: 'irp' })}
            >
              IRP 전환
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
        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={cancelIsaEdit}>취소</button>
          <button className={styles.saveBtn} onClick={handleSaveIsa}>저장</button>
        </div>
      </div>
    )
  }

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

      {/* 타입 선택 드롭다운 - portal로 body에 렌더 */}
      {showTypeMenu && addButtonRef.current && createPortal(
        <div
          className={styles.typeMenu}
          data-scenario-dropdown-portal
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
            onClick={() => handleTypeSelect('savings')}
          >
            저축 계좌
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('investment')}
          >
            투자 계좌
          </button>
          <button
            className={styles.typeMenuItem}
            onClick={() => handleTypeSelect('isa')}
          >
            ISA 계좌
          </button>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.flatList}>
          {allItems.length === 0 && !editingAccount && !editingIsa && (
            <p className={styles.emptyHint}>
              아직 등록된 저축/투자가 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}

          {/* 기존 항목 렌더링 */}
          {allItems.map((item) => {
            if (item.type === 'isa') {
              const isa = item.data as PersonalPension
              if (editingIsa === isa.id) {
                return <div key={isa.id}>{renderIsaEditForm(isa)}</div>
              }
              return (
                <div key={isa.id} className={styles.assetItem}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>
                      {isa.title || 'ISA'}
                      {isa.broker_name && <span className={styles.brokerTag}>{isa.broker_name}</span>}
                      {isa.owner === 'spouse' && <span className={styles.ownerBadge}>배우자</span>}
                    </span>
                    <span className={styles.itemMeta}>
                      ISA
                      {isa.monthly_contribution && ` | 월 ${formatMoney(isa.monthly_contribution)} 납입`}
                      {isa.isa_maturity_year && ` | ${isa.isa_maturity_year}년 ${isa.isa_maturity_month || 12}월 만기 -> ${ISA_STRATEGY_LABELS[isa.isa_maturity_strategy as keyof typeof ISA_STRATEGY_LABELS] || '연금저축 전환'}`}
                    </span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={styles.itemAmount}>
                      {formatMoney(isa.current_balance)}
                    </span>
                    <div className={styles.itemActions}>
                      <button className={styles.editBtn} onClick={() => startEditIsaAccount(isa)}>
                        <Pencil size={16} />
                      </button>
                      <button className={styles.deleteBtn} onClick={() => handleDeleteIsa(isa.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            const account = item.data as Savings
            const section = item.type
            if (editingAccount?.section === section && editingAccount.id === account.id) {
              return (
                <div key={account.id}>
                  {section === 'savings' ? renderSavingsEditForm(account) : renderInvestmentEditForm(account)}
                </div>
              )
            }

            return (
              <div key={account.id} className={styles.assetItem}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>
                    {account.title}
                    {account.broker_name && <span className={styles.brokerTag}>{account.broker_name}</span>}
                    {account.owner === 'spouse' && <span className={styles.ownerBadge}>배우자</span>}
                  </span>
                  <span className={styles.itemMeta}>
                    {section === 'savings'
                      ? `${SAVINGS_TYPE_LABELS[account.type as UISavingsType] || account.type}${account.interest_rate ? ` | 금리 ${account.interest_rate}%` : ''}${account.maturity_year ? ` | ${account.maturity_year}년 ${account.maturity_month || 12}월 만기` : ''}`
                      : `${INVESTMENT_TYPE_LABELS[account.type as UIInvestmentType] || account.type}${account.expected_return ? ` | 예상 수익률 ${account.expected_return}%` : ''}`
                    }
                  </span>
                </div>
                <div className={styles.itemRight}>
                  <span className={styles.itemAmount}>{formatMoney(account.current_balance)}</span>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => startEditSavingsAccount(account)}
                    >
                      <Pencil size={16} />
                    </button>
                    {!(account.type === 'checking' && account.title === '입출금통장') && (
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteAccount(account.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* 추가 폼 (하단) */}
          {editingAccount?.id === null && editingAccount.section === 'savings' && renderSavingsEditForm(null)}
          {editingAccount?.id === null && editingAccount.section === 'investment' && renderInvestmentEditForm(null)}
          {editingIsa === 'new' && renderIsaEditForm(null)}
        </div>
      )}

      <p className={styles.infoText}>
        연금저축, IRP는 연금 탭에서 관리됩니다.
      </p>
    </div>
  )
}
