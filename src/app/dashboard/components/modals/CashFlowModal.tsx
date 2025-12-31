'use client'

import { useState, useMemo } from 'react'
import { X, GripVertical, Plus, Trash2 } from 'lucide-react'
import type { OnboardingData, CashFlowRule, CashFlowAccountType } from '@/types'
import { DEFAULT_CASH_FLOW_RULES } from '@/types'
import { formatMoney } from '@/lib/utils'
import styles from './CashFlowModal.module.css'

interface CashFlowModalProps {
  data: OnboardingData
  onUpdate: (updates: Partial<OnboardingData>) => void
  onClose: () => void
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

export function CashFlowModal({ data, onUpdate, onClose }: CashFlowModalProps) {
  // 규칙 초기화 (저장된 규칙이 없으면 기본값 사용)
  const initialRules = data.cashFlowRules?.length > 0
    ? data.cashFlowRules
    : DEFAULT_CASH_FLOW_RULES

  const [rules, setRules] = useState<CashFlowRule[]>(initialRules)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // 월 잉여금 계산
  const monthlySurplus = useMemo(() => {
    let income = 0
    if (data.laborIncome) {
      income += data.laborIncomeFrequency === 'yearly' ? data.laborIncome / 12 : data.laborIncome
    }
    if (data.businessIncome) {
      income += data.businessIncomeFrequency === 'yearly' ? data.businessIncome / 12 : data.businessIncome
    }

    let expense = 0
    if (data.livingExpenses) {
      expense += data.livingExpensesFrequency === 'yearly' ? data.livingExpenses / 12 : data.livingExpenses
    }

    return income - expense
  }, [data])

  // 분배 시뮬레이션
  const allocation = useMemo(() => {
    const result: Record<string, number> = {}
    let remaining = monthlySurplus

    const sortedRules = [...rules]
      .filter(r => r.isEnabled)
      .sort((a, b) => a.priority - b.priority)

    for (const rule of sortedRules) {
      if (rule.allocationType === 'remainder') {
        result[rule.id] = Math.max(0, remaining)
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

    const newRules = [...rules]
    const draggedRule = newRules[draggedIndex]
    newRules.splice(draggedIndex, 1)
    newRules.splice(index, 0, draggedRule)

    // 우선순위 재설정
    newRules.forEach((rule, i) => {
      if (rule.allocationType !== 'remainder') {
        rule.priority = i + 1
      }
    })

    setRules(newRules)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // 규칙 업데이트
  const updateRule = (id: string, updates: Partial<CashFlowRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  // 규칙 활성화/비활성화
  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, isEnabled: !r.isEnabled } : r))
  }

  // 저장
  const handleSave = () => {
    onUpdate({ cashFlowRules: rules })
    onClose()
  }

  // 나머지 규칙 찾기
  const remainderRule = rules.find(r => r.allocationType === 'remainder')
  const sortableRules = rules.filter(r => r.allocationType !== 'remainder')

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>현금 흐름 분배</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className={styles.content}>
          {/* 월 잉여금 표시 */}
          <div className={styles.surplusCard}>
            <span className={styles.surplusLabel}>월 잉여금</span>
            <span className={styles.surplusValue}>{formatMoney(monthlySurplus)}</span>
            <span className={styles.surplusDesc}>소득 - 지출</span>
          </div>

          {/* 분배 규칙 리스트 */}
          <div className={styles.rulesSection}>
            <h3 className={styles.sectionTitle}>분배 우선순위</h3>
            <p className={styles.sectionDesc}>드래그하여 우선순위를 변경하세요</p>

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

                  <div
                    className={styles.ruleDot}
                    style={{ background: ACCOUNT_TYPE_COLORS[rule.accountType] }}
                  ></div>

                  <div className={styles.ruleInfo}>
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
                    className={styles.toggleBtn}
                    onClick={() => toggleRule(rule.id)}
                  >
                    {rule.isEnabled ? '활성' : '비활성'}
                  </button>
                </div>
              ))}

              {/* 나머지 (입출금통장) */}
              {remainderRule && (
                <div className={`${styles.ruleItem} ${styles.remainderRule}`}>
                  <div className={styles.ruleHandle} style={{ visibility: 'hidden' }}>
                    <GripVertical size={16} />
                  </div>

                  <div className={styles.rulePriority} style={{ background: '#8e8e93' }}>-</div>

                  <div
                    className={styles.ruleDot}
                    style={{ background: ACCOUNT_TYPE_COLORS[remainderRule.accountType] }}
                  ></div>

                  <div className={styles.ruleInfo}>
                    <span className={styles.ruleName}>{remainderRule.name}</span>
                    <span className={styles.ruleLimit}>나머지 전액</span>
                  </div>

                  <div className={styles.ruleAmount}>
                    <span className={styles.remainderText}>자동</span>
                  </div>

                  <div className={styles.ruleAllocation}>
                    <span>{formatMoney(allocation[remainderRule.id] || 0)}</span>
                  </div>

                  <div style={{ width: 48 }}></div>
                </div>
              )}
            </div>
          </div>

          {/* 분배 결과 요약 */}
          <div className={styles.summarySection}>
            <h3 className={styles.sectionTitle}>분배 결과</h3>
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
                ></div>
              ))}
            </div>
            <div className={styles.summaryLegend}>
              {rules.filter(r => r.isEnabled && allocation[r.id] > 0).map(rule => (
                <div key={rule.id} className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ background: ACCOUNT_TYPE_COLORS[rule.accountType] }}
                  ></span>
                  <span className={styles.legendName}>{rule.name}</span>
                  <span className={styles.legendValue}>{formatMoney(allocation[rule.id])}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.saveBtn} onClick={handleSave}>저장</button>
        </footer>
      </div>
    </div>
  )
}
