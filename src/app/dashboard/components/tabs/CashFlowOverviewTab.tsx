'use client'

import { useState, useMemo, useEffect } from 'react'
import { GripVertical } from 'lucide-react'
import type { GlobalSettings, CashFlowRule, CashFlowAccountType } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import type { Income, Expense, PersonalPension, Savings } from '@/types/tables'
import { runSimulationFromItems } from '@/lib/services/simulationEngine'
import {
  useFinancialItems,
  useIncomes,
  useExpenses,
  usePersonalPensions,
  useSavingsData,
} from '@/hooks/useFinancialData'
import { calculateEndYear } from '@/lib/utils/chartDataTransformer'
import { formatMoney } from '@/lib/utils'
import { CashFlowChart, YearCashFlowPanel, SankeyChart } from '../charts'
import styles from './CashFlowOverviewTab.module.css'

interface CashFlowOverviewTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  globalSettings?: GlobalSettings
}

const ACCOUNT_TYPE_LABELS: Record<CashFlowAccountType, string> = {
  pension_savings: '연금저축',
  irp: 'IRP',
  isa: 'ISA',
  savings: '예적금',
  investment: '투자',
  checking: '입출금통장',
}

const ACCOUNT_TYPE_COLORS: Record<CashFlowAccountType, string> = {
  pension_savings: '#5856d6',
  irp: '#007aff',
  isa: '#34c759',
  savings: '#ff9500',
  investment: '#af52de',
  checking: '#8e8e93',
}

// DB 데이터 기반 동적 규칙 생성
interface DynamicRulesData {
  personalPensions: PersonalPension[]
  savings: Savings[]
}

function generateDynamicRules(data: DynamicRulesData): CashFlowRule[] {
  const rules: CashFlowRule[] = []
  let priority = 1

  // 개인연금에서 연금저축, IRP, ISA 추출
  data.personalPensions.forEach(pension => {
    const ownerLabel = pension.owner === 'spouse' ? ' (배우자)' : ''

    if (pension.pension_type === 'pension_savings') {
      rules.push({
        id: `pension_savings_${pension.id}`,
        accountType: 'pension_savings',
        name: `연금저축${ownerLabel}`,
        priority: priority++,
        allocationType: 'fixed',
        monthlyAmount: pension.monthly_contribution || 50,
        annualLimit: 600,
        isEnabled: true,
      })
    } else if (pension.pension_type === 'irp') {
      rules.push({
        id: `irp_${pension.id}`,
        accountType: 'irp',
        name: `IRP${ownerLabel}`,
        priority: priority++,
        allocationType: 'fixed',
        monthlyAmount: pension.monthly_contribution || 25,
        annualLimit: 300,
        isEnabled: true,
      })
    } else if (pension.pension_type === 'isa') {
      rules.push({
        id: `isa_${pension.id}`,
        accountType: 'isa',
        name: `ISA${ownerLabel}`,
        priority: priority++,
        allocationType: 'fixed',
        monthlyAmount: pension.monthly_contribution || 167,
        annualLimit: 2000,
        isEnabled: true,
      })
    }
  })

  // 저축 계좌 (예적금)
  data.savings
    .filter(s => ['savings', 'deposit'].includes(s.type))
    .forEach(account => {
      rules.push({
        id: `savings_${account.id}`,
        accountType: 'savings',
        name: account.title || '정기예금/적금',
        priority: priority++,
        allocationType: 'fixed',
        monthlyAmount: account.monthly_contribution || 50,
        isEnabled: true,
      })
    })

  // 투자 계좌
  data.savings
    .filter(s => ['domestic_stock', 'foreign_stock', 'fund', 'bond', 'crypto'].includes(s.type))
    .forEach(account => {
      rules.push({
        id: `investment_${account.id}`,
        accountType: 'investment',
        name: account.title || '투자',
        priority: priority++,
        allocationType: 'fixed',
        monthlyAmount: account.monthly_contribution || 50,
        isEnabled: true,
      })
    })

  // 입출금통장은 항상 마지막에 추가 (나머지 전액)
  rules.push({
    id: 'checking_default',
    accountType: 'checking',
    name: '입출금통장',
    priority: 99,
    allocationType: 'remainder',
    isEnabled: true,
  })

  return rules
}

// 월 잉여금 계산
function calculateMonthlySurplus(incomes: Income[], expenses: Expense[]): number {
  const currentYear = new Date().getFullYear()

  // 현재 활성 소득 합산
  const monthlyIncome = incomes
    .filter(income => {
      if (!income.is_active) return false
      // source_type이 있는 연동 소득(연금소득 등)은 제외 (은퇴 후 소득)
      if (income.source_type) return false
      // 시작/종료 연도 체크
      if (income.start_year && income.start_year > currentYear) return false
      if (income.end_year && income.end_year < currentYear) return false
      return true
    })
    .reduce((sum, income) => {
      const amount = income.frequency === 'yearly' ? income.amount / 12 : income.amount
      return sum + amount
    }, 0)

  // 현재 활성 지출 합산
  const monthlyExpense = expenses
    .filter(expense => {
      if (!expense.is_active) return false
      if (expense.start_year && expense.start_year > currentYear) return false
      if (expense.end_year && expense.end_year < currentYear) return false
      return true
    })
    .reduce((sum, expense) => {
      const amount = expense.frequency === 'yearly' ? expense.amount / 12 : expense.amount
      return sum + amount
    }, 0)

  return monthlyIncome - monthlyExpense
}

export function CashFlowOverviewTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  globalSettings,
}: CashFlowOverviewTabProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const currentYear = new Date().getFullYear()

  // 시뮬레이션 설정
  const simulationEndYear = calculateEndYear(birthYear, spouseBirthYear)
  const yearsToSimulate = simulationEndYear - currentYear
  const retirementYear = birthYear + retirementAge

  // 프로필 정보
  const profile = useMemo(() => ({
    birthYear,
    retirementAge,
    spouseBirthYear: spouseBirthYear || undefined,
  }), [birthYear, retirementAge, spouseBirthYear])

  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: items = [], isLoading: itemsLoading } = useFinancialItems(simulationId, profile)
  const { data: incomes = [], isLoading: incomesLoading } = useIncomes(simulationId)
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(simulationId)
  const { data: personalPensions = [], isLoading: pensionsLoading } = usePersonalPensions(simulationId)
  const { data: savingsData = [], isLoading: savingsLoading } = useSavingsData(simulationId)

  // 전체 로딩 상태
  const loading = itemsLoading || incomesLoading || expensesLoading || pensionsLoading || savingsLoading

  // 시뮬레이션 실행
  const simulationResult = useMemo(() => {
    if (items.length === 0) {
      return {
        startYear: currentYear,
        endYear: simulationEndYear,
        retirementYear,
        snapshots: [],
        summary: {
          currentNetWorth: 0,
          retirementNetWorth: 0,
          peakNetWorth: 0,
          peakNetWorthYear: currentYear,
          yearsToFI: null,
          fiTarget: 0,
          bankruptcyYear: null,
        },
      }
    }

    const gs = globalSettings || DEFAULT_GLOBAL_SETTINGS

    return runSimulationFromItems(
      items,
      {
        birthYear,
        retirementAge,
        spouseBirthYear: spouseBirthYear || undefined,
      },
      gs,
      yearsToSimulate
    )
  }, [items, birthYear, retirementAge, spouseBirthYear, globalSettings, yearsToSimulate, currentYear, simulationEndYear, retirementYear])

  // 선택된 연도 스냅샷
  const selectedSnapshot = selectedYear
    ? simulationResult.snapshots.find(s => s.year === selectedYear)
    : null

  // 현금흐름도 연도 선택 상태 (기본값: 현재 연도)
  const [sankeyYear, setSankeyYear] = useState<number>(currentYear)

  // 슬라이더 진행률 계산
  const sliderProgress = useMemo(() => {
    const totalYears = simulationEndYear - currentYear
    const currentPos = sankeyYear - currentYear
    return totalYears > 0 ? (currentPos / totalYears) * 100 : 0
  }, [sankeyYear, currentYear, simulationEndYear])

  // 현재 나이 계산
  const currentAge = currentYear - birthYear
  const sankeyAge = sankeyYear - birthYear

  // 분배 규칙 상태
  const [rules, setRules] = useState<CashFlowRule[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // 규칙 초기화: DB 데이터 기반 동적 생성
  useEffect(() => {
    if (!loading && (personalPensions.length > 0 || savingsData.length > 0)) {
      setRules(generateDynamicRules({ personalPensions, savings: savingsData }))
    }
  }, [loading, personalPensions, savingsData])

  // 월 잉여금 계산
  const monthlySurplus = useMemo(() => {
    return calculateMonthlySurplus(incomes, expenses)
  }, [incomes, expenses])

  // 분배 시뮬레이션
  const allocation = useMemo(() => {
    const result: Record<string, number> = {}
    let remaining = monthlySurplus

    const sortedRules = [...rules]
      .filter(r => r.isEnabled)
      .sort((a, b) => a.priority - b.priority)

    for (const rule of sortedRules) {
      if (rule.allocationType === 'remainder') {
        // 입출금통장은 음수 허용 (잉여금이 마이너스여도 표시)
        result[rule.id] = remaining
        break
      }

      const targetAmount = rule.monthlyAmount || 0
      const allocated = Math.min(targetAmount, Math.max(0, remaining))
      result[rule.id] = allocated
      remaining -= allocated
    }

    return result
  }, [rules, monthlySurplus])

  // 드래그 앤 드롭
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const sortableRules = rules.filter(r => r.allocationType !== 'remainder')
    const remainderRule = rules.find(r => r.allocationType === 'remainder')

    const newSortable = [...sortableRules]
    const draggedRule = newSortable[draggedIndex]
    newSortable.splice(draggedIndex, 1)
    newSortable.splice(index, 0, draggedRule)

    // 우선순위 재설정
    newSortable.forEach((rule, i) => {
      rule.priority = i + 1
    })

    const newRules = remainderRule ? [...newSortable, remainderRule] : newSortable
    setRules(newRules)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // 규칙 업데이트
  const updateRule = (id: string, updates: Partial<CashFlowRule>) => {
    const newRules = rules.map(r => r.id === id ? { ...r, ...updates } : r)
    setRules(newRules)
  }

  // 규칙 활성화/비활성화
  const toggleRule = (id: string) => {
    const newRules = rules.map(r => r.id === id ? { ...r, isEnabled: !r.isEnabled } : r)
    setRules(newRules)
  }

  // 나머지 규칙과 정렬 가능한 규칙 분리
  const remainderRule = rules.find(r => r.allocationType === 'remainder')
  const sortableRules = rules.filter(r => r.allocationType !== 'remainder')

  // 캐시된 데이터가 없고 로딩 중일 때만 로딩 표시
  if (loading && items.length === 0) {
    return <div className={styles.loadingState}>데이터를 불러오는 중...</div>
  }

  return (
    <div className={styles.container}>
      {/* 현금흐름 시뮬레이션 차트 */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>현금흐름 시뮬레이션</h3>
            <p className={styles.chartSubtitle}>연도를 클릭하면 상세 내역을 확인할 수 있습니다</p>
          </div>
        </div>
        <div className={styles.chartContent}>
          <div className={styles.chartArea}>
            <CashFlowChart
              simulationResult={simulationResult}
              endYear={simulationEndYear}
              retirementYear={retirementYear}
              onYearClick={setSelectedYear}
              selectedYear={selectedYear}
            />
          </div>
          {selectedSnapshot && (
            <div className={styles.detailPanel}>
              <YearCashFlowPanel
                snapshot={selectedSnapshot}
                onClose={() => setSelectedYear(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* 현금흐름도 */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>현금흐름도</h3>
            <p className={styles.chartSubtitle}>돈이 어디서 오고 어디로 가는지 한눈에 확인하세요</p>
          </div>
          {/* 연도 선택 슬라이더 */}
          <div className={styles.yearSliderWrapper}>
            <div className={styles.yearDisplay}>
              <span className={styles.yearValue}>{sankeyYear}년</span>
              <span className={styles.ageValue}>({sankeyAge}세)</span>
            </div>
            <div className={styles.sliderContainer}>
              <span className={styles.sliderLabel}>{currentYear}</span>
              <div className={styles.sliderTrack}>
                <div
                  className={styles.sliderProgress}
                  style={{ width: `${sliderProgress}%` }}
                />
                <input
                  type="range"
                  min={currentYear}
                  max={simulationEndYear}
                  value={sankeyYear}
                  onChange={(e) => setSankeyYear(parseInt(e.target.value))}
                  className={styles.sliderInput}
                />
              </div>
              <span className={styles.sliderLabel}>{simulationEndYear}</span>
            </div>
          </div>
        </div>
        <SankeyChart
          simulationResult={simulationResult}
          selectedYear={sankeyYear}
        />
      </div>

      {/* 현금 흐름 분배 설정 */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>현금 흐름 분배</h3>
            <p className={styles.chartSubtitle}>잉여금을 어떤 순서로 어디에 분배할지 설정하세요</p>
          </div>
          <div className={styles.surplusDisplay}>
            <span className={styles.surplusLabel}>월 잉여금</span>
            <span className={`${styles.surplusValue} ${monthlySurplus < 0 ? styles.negative : ''}`}>
              {formatMoney(monthlySurplus)}
            </span>
          </div>
        </div>

        <div className={styles.distributionContent}>
          {/* 분배 규칙 리스트 */}
          <div className={styles.rulesContainer}>
            <div className={styles.rulesHeader}>
              <span className={styles.rulesHeaderItem}>순위</span>
              <span className={styles.rulesHeaderItem}>계좌</span>
              <span className={styles.rulesHeaderItem}>목표 금액</span>
              <span className={styles.rulesHeaderItem}>실제 분배</span>
              <span className={styles.rulesHeaderItem}>상태</span>
            </div>

            <div className={styles.rulesList}>
              {sortableRules.map((rule, index) => (
                <div
                  key={rule.id}
                  className={`${styles.ruleItem} ${draggedIndex === index ? styles.dragging : ''} ${!rule.isEnabled ? styles.disabled : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className={styles.ruleHandle}>
                    <GripVertical size={16} />
                  </div>

                  <div className={styles.rulePriority}>{index + 1}</div>

                  <div className={styles.ruleInfo}>
                    <span
                      className={styles.ruleDot}
                      style={{ background: ACCOUNT_TYPE_COLORS[rule.accountType] }}
                    />
                    <span className={styles.ruleName}>{rule.name}</span>
                    {rule.annualLimit && (
                      <span className={styles.ruleLimit}>연 {formatMoney(rule.annualLimit)} 한도</span>
                    )}
                  </div>

                  <div className={styles.ruleAmount}>
                    <input
                      type="number"
                      className={styles.amountInput}
                      value={rule.monthlyAmount || ''}
                      onChange={e => updateRule(rule.id, { monthlyAmount: parseFloat(e.target.value) || 0 })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      disabled={!rule.isEnabled}
                    />
                    <span className={styles.amountUnit}>만원/월</span>
                  </div>

                  <div className={styles.ruleAllocation}>
                    {rule.isEnabled && allocation[rule.id] !== undefined && (
                      <span className={allocation[rule.id] < (rule.monthlyAmount || 0) ? styles.insufficient : ''}>
                        {formatMoney(allocation[rule.id])}
                      </span>
                    )}
                  </div>

                  <button
                    className={`${styles.toggleBtn} ${rule.isEnabled ? styles.active : ''}`}
                    onClick={() => toggleRule(rule.id)}
                  >
                    {rule.isEnabled ? '활성' : '비활성'}
                  </button>
                </div>
              ))}

              {/* 나머지 (입출금통장) - 항상 고정 */}
              {remainderRule && (
                <div className={`${styles.ruleItem} ${styles.remainderRule}`}>
                  <div className={styles.ruleHandle} style={{ visibility: 'hidden' }}>
                    <GripVertical size={16} />
                  </div>

                  <div className={styles.rulePriority} style={{ background: '#8e8e93' }}>-</div>

                  <div className={styles.ruleInfo}>
                    <span
                      className={styles.ruleDot}
                      style={{ background: ACCOUNT_TYPE_COLORS[remainderRule.accountType] }}
                    />
                    <span className={styles.ruleName}>{remainderRule.name}</span>
                    <span className={styles.ruleLimit}>나머지 전액</span>
                  </div>

                  <div className={styles.ruleAmount}>
                    <span className={styles.remainderText}>자동</span>
                  </div>

                  <div className={styles.ruleAllocation}>
                    <span className={allocation[remainderRule.id] < 0 ? styles.negative : ''}>
                      {formatMoney(allocation[remainderRule.id] || 0)}
                    </span>
                  </div>

                  <div style={{ width: 60 }} />
                </div>
              )}
            </div>
          </div>

          {/* 분배 결과 바 */}
          {monthlySurplus > 0 && (
            <div className={styles.summarySection}>
              <div className={styles.summaryBar}>
                {rules.filter(r => r.isEnabled && allocation[r.id] > 0).map(rule => (
                  <div
                    key={rule.id}
                    className={styles.summarySegment}
                    style={{
                      width: `${(allocation[rule.id] / monthlySurplus) * 100}%`,
                      background: ACCOUNT_TYPE_COLORS[rule.accountType],
                    }}
                    title={`${rule.name}: ${formatMoney(allocation[rule.id])}`}
                  />
                ))}
              </div>
              <div className={styles.summaryLegend}>
                {rules.filter(r => r.isEnabled && allocation[r.id] > 0).map(rule => (
                  <div key={rule.id} className={styles.legendItem}>
                    <span
                      className={styles.legendDot}
                      style={{ background: ACCOUNT_TYPE_COLORS[rule.accountType] }}
                    />
                    <span className={styles.legendName}>{rule.name}</span>
                    <span className={styles.legendValue}>{formatMoney(allocation[rule.id])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {monthlySurplus <= 0 && (
            <div className={styles.warningMessage}>
              월 잉여금이 없습니다. 소득을 늘리거나 지출을 줄여주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
