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
import type { OnboardingData, SavingsAccount, InvestmentAccount, SavingsAccountType, InvestmentAccountType } from '@/types'
import { formatMoney } from '@/lib/utils'
import styles from './SavingsTab.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface SavingsTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

// 타입별 라벨
const SAVINGS_TYPE_LABELS: Record<SavingsAccountType, string> = {
  checking: '입출금통장',
  savings: '적금',
  deposit: '정기예금',
}

const INVESTMENT_TYPE_LABELS: Record<InvestmentAccountType, string> = {
  domestic_stock: '국내주식/ETF',
  foreign_stock: '해외주식/ETF',
  fund: '펀드',
  bond: '채권',
  crypto: '암호화폐',
  other: '기타',
}

// 색상
const COLORS = {
  checking: '#8e8e93',
  savings: '#5856d6',
  deposit: '#007aff',
  domestic_stock: '#34c759',
  foreign_stock: '#ff9500',
  fund: '#af52de',
  bond: '#ff3b30',
  crypto: '#ffcc00',
  other: '#00c7be',
}

export function SavingsTab({ data, onUpdateData }: SavingsTabProps) {
  const currentYear = new Date().getFullYear()

  // 편집 상태
  const [editingAccount, setEditingAccount] = useState<{ section: 'savings' | 'investment', id: string | null } | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  // 데이터 가져오기
  const savingsAccounts = data.savingsAccounts || []
  const investmentAccounts = data.investmentAccounts || []

  // 합계 계산
  const savingsTotal = savingsAccounts.reduce((sum, acc) => sum + acc.balance, 0)
  const investmentTotal = investmentAccounts.reduce((sum, acc) => sum + acc.balance, 0)
  const totalAssets = savingsTotal + investmentTotal

  // 편집 시작
  const startAddAccount = (section: 'savings' | 'investment') => {
    setEditingAccount({ section, id: null })
    if (section === 'savings') {
      setEditValues({ type: 'checking', name: '', balance: '', interestRate: '' })
    } else {
      setEditValues({ type: 'domestic_stock', name: '', balance: '', expectedReturn: '' })
    }
  }

  const startEditAccount = (section: 'savings' | 'investment', account: SavingsAccount | InvestmentAccount) => {
    setEditingAccount({ section, id: account.id })
    if (section === 'savings') {
      const sav = account as SavingsAccount
      setEditValues({
        type: sav.type,
        name: sav.name,
        balance: sav.balance.toString(),
        interestRate: sav.interestRate?.toString() || '',
        maturityYear: sav.maturityYear?.toString() || '',
        maturityMonth: sav.maturityMonth?.toString() || '',
      })
    } else {
      const inv = account as InvestmentAccount
      setEditValues({
        type: inv.type,
        name: inv.name,
        balance: inv.balance.toString(),
        expectedReturn: inv.expectedReturn?.toString() || '',
      })
    }
  }

  const cancelEdit = () => {
    setEditingAccount(null)
    setEditValues({})
  }

  // 저장
  const saveSavingsAccount = () => {
    if (!editValues.name || !editValues.balance) return

    const newAccount: SavingsAccount = {
      id: editingAccount?.id || `sav-${Date.now()}`,
      type: editValues.type as SavingsAccountType,
      name: editValues.name,
      balance: parseFloat(editValues.balance),
      interestRate: editValues.interestRate ? parseFloat(editValues.interestRate) : undefined,
      maturityYear: editValues.maturityYear ? parseInt(editValues.maturityYear) : undefined,
      maturityMonth: editValues.maturityMonth ? parseInt(editValues.maturityMonth) : undefined,
    }

    let updated: SavingsAccount[]
    if (editingAccount?.id) {
      updated = savingsAccounts.map(acc => acc.id === editingAccount.id ? newAccount : acc)
    } else {
      updated = [...savingsAccounts, newAccount]
    }

    onUpdateData({ savingsAccounts: updated })
    cancelEdit()
  }

  const saveInvestmentAccount = () => {
    if (!editValues.name || !editValues.balance) return

    const newAccount: InvestmentAccount = {
      id: editingAccount?.id || `inv-${Date.now()}`,
      type: editValues.type as InvestmentAccountType,
      name: editValues.name,
      balance: parseFloat(editValues.balance),
      expectedReturn: editValues.expectedReturn ? parseFloat(editValues.expectedReturn) : undefined,
    }

    let updated: InvestmentAccount[]
    if (editingAccount?.id) {
      updated = investmentAccounts.map(acc => acc.id === editingAccount.id ? newAccount : acc)
    } else {
      updated = [...investmentAccounts, newAccount]
    }

    onUpdateData({ investmentAccounts: updated })
    cancelEdit()
  }

  // 삭제
  const deleteSavingsAccount = (id: string) => {
    const updated = savingsAccounts.filter(acc => acc.id !== id)
    onUpdateData({ savingsAccounts: updated })
  }

  const deleteInvestmentAccount = (id: string) => {
    const updated = investmentAccounts.filter(acc => acc.id !== id)
    onUpdateData({ investmentAccounts: updated })
  }

  // 도넛 차트 데이터
  const chartData = useMemo(() => {
    const labels: string[] = []
    const values: number[] = []
    const colors: string[] = []

    savingsAccounts.forEach(acc => {
      labels.push(`${acc.name} (${SAVINGS_TYPE_LABELS[acc.type]})`)
      values.push(acc.balance)
      colors.push(COLORS[acc.type])
    })

    investmentAccounts.forEach(acc => {
      labels.push(`${acc.name} (${INVESTMENT_TYPE_LABELS[acc.type]})`)
      values.push(acc.balance)
      colors.push(COLORS[acc.type])
    })

    return { labels, values, colors }
  }, [savingsAccounts, investmentAccounts])

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
      {/* 왼쪽: 계좌 입력 */}
      <div className={styles.inputPanel}>

        {/* ========== 저축 계좌 ========== */}
        <section className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>저축 계좌</span>
            {savingsTotal > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(savingsTotal)}</span>
            )}
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
                      {(['checking', 'savings', 'deposit'] as SavingsAccountType[]).map(type => (
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
                  <div className={styles.editRow}>
                    <span className={styles.editRowLabel}>금리</span>
                    <div className={styles.editField}>
                      <input
                        type="number"
                        className={styles.editInputSmall}
                        value={editValues.interestRate || ''}
                        onChange={e => setEditValues({ ...editValues, interestRate: e.target.value })}
                        onWheel={e => (e.target as HTMLElement).blur()}
                        step="0.1"
                        placeholder="0"
                      />
                      <span className={styles.editUnit}>%</span>
                    </div>
                  </div>
                  {(editValues.type === 'savings' || editValues.type === 'deposit') && (
                    <div className={styles.editRow}>
                      <span className={styles.editRowLabel}>만기</span>
                      <div className={styles.editField}>
                        <input
                          type="number"
                          className={styles.editInputSmall}
                          value={editValues.maturityYear || ''}
                          onChange={e => setEditValues({ ...editValues, maturityYear: e.target.value })}
                          onWheel={e => (e.target as HTMLElement).blur()}
                          min={currentYear}
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
                  )}
                  <div className={styles.editActions}>
                    <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                    <button className={styles.saveBtn} onClick={saveSavingsAccount}>저장</button>
                  </div>
                </div>
              ) : (
                <div key={account.id} className={styles.assetItem}>
                  <div className={styles.itemMain}>
                    <span className={styles.itemLabel}>{SAVINGS_TYPE_LABELS[account.type]}</span>
                    <span className={styles.itemAmount}>{formatMoney(account.balance)}</span>
                    <span className={styles.itemName}>{account.name}</span>
                    {account.interestRate && (
                      <span className={styles.itemMeta}>
                        금리 {account.interestRate}%
                        {account.maturityYear && ` | ${account.maturityYear}년 ${account.maturityMonth || 12}월 만기`}
                      </span>
                    )}
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => startEditAccount('savings', account)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteSavingsAccount(account.id)}
                    >
                      <Trash2 size={16} />
                    </button>
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
                    {(['checking', 'savings', 'deposit'] as SavingsAccountType[]).map(type => (
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
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>금리</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.interestRate || ''}
                      onChange={e => setEditValues({ ...editValues, interestRate: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      step="0.1"
                      placeholder="0"
                    />
                    <span className={styles.editUnit}>%</span>
                  </div>
                </div>
                {(editValues.type === 'savings' || editValues.type === 'deposit') && (
                  <div className={styles.editRow}>
                    <span className={styles.editRowLabel}>만기</span>
                    <div className={styles.editField}>
                      <input
                        type="number"
                        className={styles.editInputSmall}
                        value={editValues.maturityYear || ''}
                        onChange={e => setEditValues({ ...editValues, maturityYear: e.target.value })}
                        onWheel={e => (e.target as HTMLElement).blur()}
                        min={currentYear}
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
                )}
                <div className={styles.editActions}>
                  <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                  <button className={styles.saveBtn} onClick={saveSavingsAccount}>저장</button>
                </div>
              </div>
            ) : (
              <button className={styles.addBtn} onClick={() => startAddAccount('savings')}>
                + 저축 계좌 추가
              </button>
            )}
          </div>
        </section>

        {/* ========== 투자 계좌 ========== */}
        <section className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>투자 계좌</span>
            {investmentTotal > 0 && (
              <span className={styles.sectionTotal}>{formatMoney(investmentTotal)}</span>
            )}
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
                      {(['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other'] as InvestmentAccountType[]).map(type => (
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
                    <button className={styles.saveBtn} onClick={saveInvestmentAccount}>저장</button>
                  </div>
                </div>
              ) : (
                <div key={account.id} className={styles.assetItem}>
                  <div className={styles.itemMain}>
                    <span className={styles.itemLabel}>{INVESTMENT_TYPE_LABELS[account.type]}</span>
                    <span className={styles.itemAmount}>{formatMoney(account.balance)}</span>
                    <span className={styles.itemName}>{account.name}</span>
                    {account.expectedReturn && (
                      <span className={styles.itemMeta}>예상 수익률 {account.expectedReturn}%</span>
                    )}
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => startEditAccount('investment', account)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteInvestmentAccount(account.id)}
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
                    {(['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto', 'other'] as InvestmentAccountType[]).map(type => (
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
                  <button className={styles.saveBtn} onClick={saveInvestmentAccount}>저장</button>
                </div>
              </div>
            ) : (
              <button className={styles.addBtn} onClick={() => startAddAccount('investment')}>
                + 투자 계좌 추가
              </button>
            )}
          </div>
        </section>

        <p className={styles.infoText}>
          연금저축, IRP, ISA는 연금 탭에서 관리됩니다.
        </p>
      </div>

      {/* 오른쪽: 요약 */}
      <div className={styles.summaryPanel}>
        {hasData ? (
          <>
            {/* 요약 카드 */}
            <div className={styles.summaryCard}>
              <div className={styles.totalAssets}>
                <span className={styles.totalLabel}>총 금융자산</span>
                <span className={styles.totalValue}>{formatMoney(totalAssets)}</span>
              </div>

              <div className={styles.subValues}>
                <div className={styles.subValueItem}>
                  <span className={styles.subLabel}>저축 계좌</span>
                  <span className={styles.subValue}>{formatMoney(savingsTotal)}</span>
                </div>
                <div className={styles.subValueItem}>
                  <span className={styles.subLabel}>투자 계좌</span>
                  <span className={styles.subValue}>{formatMoney(investmentTotal)}</span>
                </div>
              </div>
            </div>

            {/* 계좌 수 */}
            <div className={styles.countCard}>
              <h4 className={styles.cardTitle}>계좌 현황</h4>
              <div className={styles.countList}>
                <div className={styles.countRow}>
                  <span className={styles.countLabel}>저축 계좌</span>
                  <span className={styles.countValue}>{savingsAccounts.length}개</span>
                </div>
                <div className={styles.countRow}>
                  <span className={styles.countLabel}>투자 계좌</span>
                  <span className={styles.countValue}>{investmentAccounts.length}개</span>
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
            <PiggyBank size={40} />
            <p>저축/투자 계좌를 추가하면<br />분석 결과가 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
