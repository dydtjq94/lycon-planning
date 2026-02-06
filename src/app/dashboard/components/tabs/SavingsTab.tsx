'use client'

import { useState, useMemo } from 'react'
import { Pencil, Trash2, PiggyBank } from 'lucide-react'
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
  upsertPersonalPension,
} from '@/lib/services/personalPensionService'
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

  // ISA 편집 상태
  const [editingIsa, setEditingIsa] = useState<'self' | 'spouse' | null>(null)
  const [isaEditValues, setIsaEditValues] = useState<Record<string, string>>({})

  // ISA 데이터 추출
  const selfIsa = personalPensions.find(p => p.owner === 'self' && p.pension_type === 'isa')
  const spouseIsa = personalPensions.find(p => p.owner === 'spouse' && p.pension_type === 'isa')
  const isMarried = spouseBirthYear !== null

  // 합계 계산
  const savingsTotal = savingsAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const investmentTotal = investmentAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const isaTotal = (selfIsa?.current_balance || 0) + (isMarried ? (spouseIsa?.current_balance || 0) : 0)
  const totalAssets = savingsTotal + investmentTotal + isaTotal

  // 저축 계좌 CRUD
  const startAddAccount = (section: 'savings' | 'investment') => {
    setEditingAccount({ section, id: null })
    if (section === 'savings') {
      setEditValues({
        type: 'deposit',
        name: '',
        balance: '',
        interestRate: '',
        startYear: String(currentYear),
        startMonth: String(new Date().getMonth() + 1),
        durationMonths: '12',
        isTaxFree: 'false',
        currency: 'KRW',
        owner: 'self',
      })
    } else {
      setEditValues({ type: 'domestic_stock', name: '', balance: '', expectedReturn: '', owner: 'self' })
    }
  }

  const startEditSavingsAccount = (account: Savings) => {
    const section = ['checking', 'savings', 'deposit'].includes(account.type) ? 'savings' : 'investment'
    setEditingAccount({ section, id: account.id })
    if (section === 'savings') {
      // 기간(개월) 계산: 가입일 ~ 만기일
      let durationMonths = ''
      if (account.contribution_start_year && account.maturity_year) {
        const startDate = new Date(account.contribution_start_year, (account.contribution_start_month || 1) - 1)
        const endDate = new Date(account.maturity_year, (account.maturity_month || 12) - 1)
        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth())
        durationMonths = String(months)
      }
      setEditValues({
        type: account.type,
        name: account.title,
        balance: account.current_balance.toString(),
        interestRate: account.interest_rate?.toString() || '',
        startYear: account.contribution_start_year?.toString() || '',
        startMonth: account.contribution_start_month?.toString() || '',
        durationMonths,
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
      // 만기일 계산: 가입일 + 기간(개월)
      let maturityYear = editValues.maturityYear ? parseInt(editValues.maturityYear) : null
      let maturityMonth = editValues.maturityMonth ? parseInt(editValues.maturityMonth) : null

      if (editValues.startYear && editValues.durationMonths && !maturityYear) {
        const startYear = parseInt(editValues.startYear)
        const startMonth = parseInt(editValues.startMonth || '1')
        const duration = parseInt(editValues.durationMonths)
        const endDate = new Date(startYear, startMonth - 1 + duration)
        maturityYear = endDate.getFullYear()
        maturityMonth = endDate.getMonth() + 1
      }

      const input: SavingsInput = {
        simulation_id: simulationId,
        type: editValues.type as UISavingsType,
        title: editValues.name,
        owner: (editValues.owner || 'self') as Owner,
        current_balance: parseFloat(editValues.balance),
        interest_rate: editValues.interestRate ? parseFloat(editValues.interestRate) : null,
        contribution_start_year: editValues.startYear ? parseInt(editValues.startYear) : null,
        contribution_start_month: editValues.startMonth ? parseInt(editValues.startMonth) : null,
        maturity_year: maturityYear,
        maturity_month: maturityMonth,
        is_tax_free: editValues.isTaxFree === 'true',
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
  const startEditIsa = (owner: 'self' | 'spouse') => {
    const isa = owner === 'self' ? selfIsa : spouseIsa
    setEditingIsa(owner)
    setIsaEditValues({
      balance: isa?.current_balance?.toString() || '',
      monthly: isa?.monthly_contribution?.toString() || '',
      maturityYear: isa?.isa_maturity_year?.toString() || String(currentYear + 3),
      maturityMonth: isa?.isa_maturity_month?.toString() || '12',
      strategy: isa?.isa_maturity_strategy || 'pension_savings',
    })
  }

  const cancelIsaEdit = () => {
    setEditingIsa(null)
    setIsaEditValues({})
  }

  const handleSaveIsa = async () => {
    if (!editingIsa) return

    try {
      const owner: Owner = editingIsa
      const ownerBirthYear = owner === 'self' ? birthYear : (spouseBirthYear || birthYear)

      const input: Omit<PersonalPensionInput, 'simulation_id' | 'owner' | 'pension_type'> = {
        current_balance: isaEditValues.balance ? parseFloat(isaEditValues.balance) : 0,
        monthly_contribution: isaEditValues.monthly ? parseFloat(isaEditValues.monthly) : null,
        isa_maturity_year: isaEditValues.maturityYear ? parseInt(isaEditValues.maturityYear) : null,
        isa_maturity_month: isaEditValues.maturityMonth ? parseInt(isaEditValues.maturityMonth) : null,
        isa_maturity_strategy: (isaEditValues.strategy as 'pension_savings' | 'irp' | 'cash') || 'pension_savings',
        return_rate: 5, // 기본 수익률
      }

      await upsertPersonalPension(
        simulationId,
        owner,
        'isa',
        input,
        ownerBirthYear,
        retirementAge
      )

      invalidate('personalPensions')
      cancelIsaEdit()
    } catch (error) {
      console.error('Failed to save ISA:', error)
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
    if (selfIsa?.current_balance) {
      labels.push('본인 ISA')
      values.push(selfIsa.current_balance)
      colors.push(CHART_COLORS.pensionDetail.isa_self)
    }
    if (isMarried && spouseIsa?.current_balance) {
      labels.push('배우자 ISA')
      values.push(spouseIsa.current_balance)
      colors.push(CHART_COLORS.pensionDetail.isa_spouse)
    }

    return { labels, values, colors }
  }, [savingsAccounts, investmentAccounts, selfIsa, spouseIsa, isMarried])

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

  if (isLoading && hasNoData) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>데이터를 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
        {/* ========== 저축 계좌 ========== */}
        <section className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>저축 계좌</span>
          </div>
          <p className={styles.sectionDesc}>
            입출금통장, 적금, 정기예금 등 원금이 보장되는 계좌
          </p>

          <div className={styles.itemList}>
            {savingsAccounts.map(account => (
              editingAccount?.section === 'savings' && editingAccount.id === account.id ? (
                <div key={account.id} className={styles.editItem}>
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
                        placeholder="예: 카카오뱅크, 신한은행"
                        autoFocus
                      />
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
                        <span className={styles.editRowLabel}>기간</span>
                        <div className={styles.editField}>
                          <input
                            type="number"
                            className={styles.editInputSmall}
                            value={editValues.durationMonths || ''}
                            onChange={e => setEditValues({ ...editValues, durationMonths: e.target.value })}
                            onWheel={e => (e.target as HTMLElement).blur()}
                            min={1}
                            placeholder="12"
                          />
                          <span className={styles.editUnit}>개월</span>
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
              ) : (
                <div key={account.id} className={styles.assetItem}>
                  <div className={styles.itemMain}>
                    <span className={styles.itemLabel}>{SAVINGS_TYPE_LABELS[account.type as UISavingsType] || account.type}</span>
                    <span className={styles.itemAmount}>{formatMoney(account.current_balance)}</span>
                    <span className={styles.itemName}>
                      {account.title}
                      {account.broker_name && <span className={styles.brokerTag}>{account.broker_name}</span>}
                      {account.owner === 'spouse' && <span className={styles.ownerBadge}>배우자</span>}
                    </span>
                    {account.interest_rate && (
                      <span className={styles.itemMeta}>
                        금리 {account.interest_rate}%
                        {account.maturity_year && ` | ${account.maturity_year}년 ${account.maturity_month || 12}월 만기`}
                      </span>
                    )}
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => startEditSavingsAccount(account)}
                    >
                      <Pencil size={16} />
                    </button>
                    {/* 입출금통장은 삭제 불가 (기본 현금 관리 통장) */}
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
              )
            ))}

            {/* 추가 폼 */}
            {editingAccount?.section === 'savings' && editingAccount.id === null ? (
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
                      placeholder="예: 카카오뱅크, 신한은행"
                      autoFocus
                    />
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
                      <span className={styles.editRowLabel}>기간</span>
                      <div className={styles.editField}>
                        <input
                          type="number"
                          className={styles.editInputSmall}
                          value={editValues.durationMonths || ''}
                          onChange={e => setEditValues({ ...editValues, durationMonths: e.target.value })}
                          onWheel={e => (e.target as HTMLElement).blur()}
                          min={1}
                          placeholder="12"
                        />
                        <span className={styles.editUnit}>개월</span>
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
            ) : (
              <button className={styles.addBtn} onClick={() => startAddAccount('savings')}>
                + 정기 예금/적금 추가
              </button>
            )}
          </div>
        </section>

        {/* ========== 투자 계좌 ========== */}
        <section className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>투자 계좌</span>
          </div>
          <p className={styles.sectionDesc}>
            주식, ETF, 펀드, 채권, 암호화폐 등 시장 가치가 변동하는 계좌
          </p>

          <div className={styles.itemList}>
            {investmentAccounts.map(account => (
              editingAccount?.section === 'investment' && editingAccount.id === account.id ? (
                <div key={account.id} className={styles.editItem}>
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
                        placeholder="예: 삼성증권, 키움증권"
                        autoFocus
                      />
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
              ) : (
                <div key={account.id} className={styles.assetItem}>
                  <div className={styles.itemMain}>
                    <span className={styles.itemLabel}>{INVESTMENT_TYPE_LABELS[account.type as UIInvestmentType] || account.type}</span>
                    <span className={styles.itemAmount}>{formatMoney(account.current_balance)}</span>
                    <span className={styles.itemName}>
                      {account.title}
                      {account.broker_name && <span className={styles.brokerTag}>{account.broker_name}</span>}
                      {account.owner === 'spouse' && <span className={styles.ownerBadge}>배우자</span>}
                    </span>
                    {account.expected_return && (
                      <span className={styles.itemMeta}>예상 수익률 {account.expected_return}%</span>
                    )}
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => startEditSavingsAccount(account)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteAccount(account.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            ))}

            {/* 추가 폼 */}
            {editingAccount?.section === 'investment' && editingAccount.id === null ? (
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
                      placeholder="예: 삼성증권, 키움증권"
                      autoFocus
                    />
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
            ) : (
              <button className={styles.addBtn} onClick={() => startAddAccount('investment')}>
                + 투자 계좌 추가
              </button>
            )}
          </div>
        </section>

        {/* ========== 절세계좌 (ISA) ========== */}
        <section className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>절세계좌</span>
          </div>
          <p className={styles.sectionDesc}>
            ISA(개인종합자산관리계좌). 만기 시 연금계좌로 전환하면 추가 세액공제 혜택.
          </p>

          <div className={styles.itemList}>
            {/* 본인 ISA */}
            {editingIsa === 'self' ? (
              <div className={styles.editItem}>
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
                      autoFocus
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
            ) : (
              <div className={styles.assetItem}>
                <div className={styles.itemMain}>
                  <span className={styles.itemLabel}>본인 ISA</span>
                  <span className={styles.itemAmount}>
                    {selfIsa?.current_balance ? formatMoney(selfIsa.current_balance) : '0'}
                  </span>
                  {selfIsa?.title && (
                    <span className={styles.itemName}>
                      {selfIsa.title}
                      {selfIsa.broker_name && <span className={styles.brokerTag}>{selfIsa.broker_name}</span>}
                    </span>
                  )}
                  {selfIsa?.current_balance ? (
                    <span className={styles.itemMeta}>
                      {selfIsa.monthly_contribution ? `월 ${formatMoney(selfIsa.monthly_contribution)} 납입 | ` : ''}
                      {selfIsa.isa_maturity_year}년 {selfIsa.isa_maturity_month || 12}월 만기
                      {' -> '}{ISA_STRATEGY_LABELS[selfIsa.isa_maturity_strategy as keyof typeof ISA_STRATEGY_LABELS] || '연금저축 전환'}
                    </span>
                  ) : null}
                </div>
                <div className={styles.itemActions}>
                  <button className={styles.editBtn} onClick={() => startEditIsa('self')}>
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* 배우자 ISA */}
            {isMarried && (
              editingIsa === 'spouse' ? (
                <div className={styles.editItem}>
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
                        autoFocus
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
              ) : (
                <div className={styles.assetItem}>
                  <div className={styles.itemMain}>
                    <span className={styles.itemLabel}>배우자 ISA</span>
                    <span className={styles.itemAmount}>
                      {spouseIsa?.current_balance ? formatMoney(spouseIsa.current_balance) : '0'}
                    </span>
                    {spouseIsa?.title && (
                      <span className={styles.itemName}>
                        {spouseIsa.title}
                        {spouseIsa.broker_name && <span className={styles.brokerTag}>{spouseIsa.broker_name}</span>}
                      </span>
                    )}
                    {spouseIsa?.current_balance ? (
                      <span className={styles.itemMeta}>
                        {spouseIsa.monthly_contribution ? `월 ${formatMoney(spouseIsa.monthly_contribution)} 납입 | ` : ''}
                        {spouseIsa.isa_maturity_year}년 {spouseIsa.isa_maturity_month || 12}월 만기
                        {' -> '}{ISA_STRATEGY_LABELS[spouseIsa.isa_maturity_strategy as keyof typeof ISA_STRATEGY_LABELS] || '연금저축 전환'}
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.editBtn} onClick={() => startEditIsa('spouse')}>
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        <p className={styles.infoText}>
          연금저축, IRP는 연금 탭에서 관리됩니다.
        </p>
    </div>
  )
}
