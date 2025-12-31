'use client'

import { useState, useMemo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { OnboardingData, GlobalSettings } from '@/types'
import { DEFAULT_CASH_FLOW_RULES, DEFAULT_GLOBAL_SETTINGS } from '@/types'
import { formatMoney } from '@/lib/utils'
import styles from './PensionTab.module.css'

interface PensionTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
  globalSettings?: GlobalSettings
}

export function PensionTab({ data, onUpdateData, globalSettings }: PensionTabProps) {
  const currentYear = new Date().getFullYear()

  // 글로벌 설정 (전달받은 값 또는 기본값)
  const settings = globalSettings || DEFAULT_GLOBAL_SETTINGS
  const incomeGrowthRate = settings.incomeGrowthRate / 100  // % → 소수
  const investmentReturnRate = settings.investmentReturnRate / 100

  // 현재 나이 계산
  const currentAge = useMemo(() => {
    if (!data.birth_date) return 35
    const birthYear = new Date(data.birth_date).getFullYear()
    return currentYear - birthYear
  }, [data.birth_date, currentYear])

  const retirementAge = data.target_retirement_age || 60
  const yearsUntilRetirement = Math.max(0, retirementAge - currentAge)

  // 월 소득 (소득 탭에서)
  const monthlyIncome = useMemo(() => {
    let income = 0
    if (data.laborIncome) {
      income += data.laborIncomeFrequency === 'yearly' ? data.laborIncome / 12 : data.laborIncome
    }
    return income
  }, [data.laborIncome, data.laborIncomeFrequency])

  // 현금흐름 분배에서 개인연금 납입액 가져오기
  const cashFlowRules = data.cashFlowRules?.length > 0 ? data.cashFlowRules : DEFAULT_CASH_FLOW_RULES

  const getMonthlyContribution = (accountType: string) => {
    const rule = cashFlowRules.find(r => r.accountType === accountType && r.isEnabled)
    return rule?.monthlyAmount || 0
  }

  // 편집 상태
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const startEdit = (field: string, values: Record<string, string | number | null | undefined>) => {
    setEditingField(field)
    const stringValues: Record<string, string> = {}
    Object.entries(values).forEach(([key, val]) => {
      stringValues[key] = val?.toString() || ''
    })
    setEditValues(stringValues)
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValues({})
  }

  const saveEdit = (updates: Partial<OnboardingData>) => {
    onUpdateData(updates)
    setEditingField(null)
    setEditValues({})
  }

  // ============================================
  // 퇴직연금 계산 (PMT 방식 포함)
  // ============================================
  const retirementPensionProjection = useMemo(() => {
    const type = data.retirementPensionType
    if (!type || !monthlyIncome) return null

    // DB형/퇴직금 (severance 포함)
    const isDBType = type === 'DB' || type === 'severance'
    // DC형/기업IRP (corporate_irp 포함)
    const isDCType = type === 'DC' || type === 'corporate_irp'

    // PMT 계산 함수
    const calculatePMT = (presentValue: number, years: number, annualRate: number) => {
      if (years <= 0 || presentValue <= 0) return 0
      if (annualRate === 0) return presentValue / years
      const r = annualRate
      const n = years
      const factor = Math.pow(1 + r, n)
      return presentValue * (r * factor) / (factor - 1)
    }

    // 수령 방식 (기본값: 연금 수령)
    const receiveType = data.retirementPensionReceiveType || 'annuity'
    const receiveStartAge = data.retirementPensionStartAge || 56
    const receivingYears = data.retirementPensionReceivingYears || 10

    if (isDBType) {
      const yearsOfService = data.yearsOfService || 0
      const totalYearsAtRetirement = yearsOfService + yearsUntilRetirement
      // 글로벌 설정의 소득증가율 사용
      const finalMonthlySalary = monthlyIncome * Math.pow(1 + incomeGrowthRate, yearsUntilRetirement)
      const totalAmount = finalMonthlySalary * totalYearsAtRetirement

      // 연금 수령 시 PMT 계산
      let annualPMT = 0
      let monthlyPMT = 0
      if (receiveType === 'annuity') {
        // 퇴직 시점부터 수령 시작까지 추가 운용
        const yearsUntilReceive = Math.max(0, receiveStartAge - retirementAge)
        const valueAtReceiveStart = totalAmount * Math.pow(1 + investmentReturnRate, yearsUntilReceive)
        annualPMT = calculatePMT(valueAtReceiveStart, receivingYears, investmentReturnRate)
        monthlyPMT = Math.round(annualPMT / 12)
      }

      return {
        type: 'DB' as const,
        totalAmount: Math.round(totalAmount),
        finalSalary: Math.round(finalMonthlySalary),
        totalYears: totalYearsAtRetirement,
        receiveType,
        startAge: receiveStartAge,
        receivingYears,
        annualPMT: Math.round(annualPMT),
        monthlyPMT,
      }
    } else if (isDCType) {
      const currentBalance = data.retirementPensionBalance || 0
      const monthlyContribution = monthlyIncome * 0.0833 // 연봉의 1/12
      // 글로벌 설정의 투자수익률 사용

      let futureValue = currentBalance
      for (let i = 0; i < yearsUntilRetirement; i++) {
        futureValue = (futureValue + monthlyContribution * 12) * (1 + investmentReturnRate)
      }

      // 연금 수령 시 PMT 계산
      let annualPMT = 0
      let monthlyPMT = 0
      if (receiveType === 'annuity') {
        // 퇴직 시점부터 수령 시작까지 추가 운용
        const yearsUntilReceive = Math.max(0, receiveStartAge - retirementAge)
        const valueAtReceiveStart = futureValue * Math.pow(1 + investmentReturnRate, yearsUntilReceive)
        annualPMT = calculatePMT(valueAtReceiveStart, receivingYears, investmentReturnRate)
        monthlyPMT = Math.round(annualPMT / 12)
      }

      return {
        type: 'DC' as const,
        totalAmount: Math.round(futureValue),
        currentBalance,
        monthlyContribution: Math.round(monthlyContribution),
        receiveType,
        startAge: receiveStartAge,
        receivingYears,
        annualPMT: Math.round(annualPMT),
        monthlyPMT,
      }
    }

    return null
  }, [data.retirementPensionType, data.retirementPensionBalance, data.yearsOfService, data.retirementPensionReceiveType, data.retirementPensionStartAge, data.retirementPensionReceivingYears, monthlyIncome, yearsUntilRetirement, retirementAge, incomeGrowthRate, investmentReturnRate])

  // ============================================
  // 개인연금 계산 (PMT 방식 - 수령 중에도 수익률 적용)
  // ============================================
  const personalPensionProjection = useMemo(() => {
    const pensionSavings = data.pensionSavingsBalance || 0
    const irp = data.irpBalance || 0
    const isa = data.isaBalance || 0

    const monthlyPensionSavings = getMonthlyContribution('pension_savings')
    const monthlyIrp = getMonthlyContribution('irp')
    const monthlyIsa = getMonthlyContribution('isa')

    // 수령 시작 나이와 기간
    const pensionSavingsStartAge = data.pensionSavingsStartAge || 56
    const pensionSavingsYears = data.pensionSavingsReceivingYears || 20
    const irpStartAge = data.irpStartAge || 56
    const irpYears = data.irpReceivingYears || 20

    // 수령 시작까지 남은 년수
    const yearsUntilPensionSavings = Math.max(0, pensionSavingsStartAge - currentAge)
    const yearsUntilIrp = Math.max(0, irpStartAge - currentAge)

    // ISA 만기 시 전환 처리
    const isaMaturityYear = data.isaMaturityYear || currentYear + 3
    const yearsUntilIsaMaturity = Math.max(0, isaMaturityYear - currentYear)
    const isaStrategy = data.isaMaturityStrategy || 'pension_savings'

    // 적립기간 동안 미래가치 계산 (FV)
    const calculateFutureValue = (currentBalance: number, monthlyAmount: number, years: number) => {
      let futureValue = currentBalance
      for (let i = 0; i < years; i++) {
        futureValue = (futureValue + monthlyAmount * 12) * (1 + investmentReturnRate)
      }
      return Math.round(futureValue)
    }

    // PMT 계산: 수령 중에도 수익률 적용
    // PMT = PV × (r × (1+r)^n) / ((1+r)^n - 1)
    const calculatePMT = (presentValue: number, years: number, annualRate: number) => {
      if (years <= 0 || presentValue <= 0) return 0
      if (annualRate === 0) return presentValue / years

      const r = annualRate
      const n = years
      const factor = Math.pow(1 + r, n)
      const pmt = presentValue * (r * factor) / (factor - 1)
      return Math.round(pmt)
    }

    // ISA 만기 시 잔액 계산
    const isaAtMaturity = calculateFutureValue(isa, monthlyIsa, yearsUntilIsaMaturity)

    // 연금저축: ISA 전환분 포함
    let pensionSavingsBase = pensionSavings
    let isaToAddToPensionSavings = 0
    if (isaStrategy === 'pension_savings' && yearsUntilIsaMaturity < yearsUntilPensionSavings) {
      // ISA 만기 후 연금저축 수령 시작 전까지 추가 운용
      const additionalYears = yearsUntilPensionSavings - yearsUntilIsaMaturity
      isaToAddToPensionSavings = isaAtMaturity * Math.pow(1 + investmentReturnRate, additionalYears)
    }

    // IRP: ISA 전환분 포함
    let irpBase = irp
    let isaToAddToIrp = 0
    if (isaStrategy === 'irp' && yearsUntilIsaMaturity < yearsUntilIrp) {
      const additionalYears = yearsUntilIrp - yearsUntilIsaMaturity
      isaToAddToIrp = isaAtMaturity * Math.pow(1 + investmentReturnRate, additionalYears)
    }

    // 수령 시작 시점의 적립액
    const pensionSavingsAtStart = calculateFutureValue(pensionSavings, monthlyPensionSavings, yearsUntilPensionSavings) + isaToAddToPensionSavings
    const irpAtStart = calculateFutureValue(irp, monthlyIrp, yearsUntilIrp) + isaToAddToIrp

    // 연간 수령액 (PMT)
    const pensionSavingsAnnualPMT = calculatePMT(pensionSavingsAtStart, pensionSavingsYears, investmentReturnRate)
    const irpAnnualPMT = calculatePMT(irpAtStart, irpYears, investmentReturnRate)

    return {
      pensionSavings: {
        current: pensionSavings,
        monthly: monthlyPensionSavings,
        futureAtStart: Math.round(pensionSavingsAtStart),
        startAge: pensionSavingsStartAge,
        receivingYears: pensionSavingsYears,
        annualPMT: pensionSavingsAnnualPMT,
        monthlyPMT: Math.round(pensionSavingsAnnualPMT / 12),
      },
      irp: {
        current: irp,
        monthly: monthlyIrp,
        futureAtStart: Math.round(irpAtStart),
        startAge: irpStartAge,
        receivingYears: irpYears,
        annualPMT: irpAnnualPMT,
        monthlyPMT: Math.round(irpAnnualPMT / 12),
      },
      isa: {
        current: isa,
        monthly: monthlyIsa,
        atMaturity: isaAtMaturity,
        maturityYear: isaMaturityYear,
        strategy: isaStrategy,
        transferTo: isaStrategy === 'pension_savings' ? '연금저축' : isaStrategy === 'irp' ? 'IRP' : '현금',
      },
      total: {
        current: pensionSavings + irp + isa,
        monthly: monthlyPensionSavings + monthlyIrp + monthlyIsa,
        futureAtStart: Math.round(pensionSavingsAtStart + irpAtStart),
        annualPMT: pensionSavingsAnnualPMT + irpAnnualPMT,
        monthlyPMT: Math.round((pensionSavingsAnnualPMT + irpAnnualPMT) / 12),
      }
    }
  }, [data, cashFlowRules, currentAge, currentYear, investmentReturnRate])

  // ============================================
  // 총 연금 예상
  // ============================================
  const totalPensionProjection = useMemo(() => {
    const nationalPensionMonthly = data.nationalPension || 0
    const nationalPensionStartAge = data.nationalPensionStartAge || 65
    // 국민연금은 예상 수명까지 수령 (글로벌 설정의 lifeExpectancy 사용)
    const nationalPensionYears = Math.max(0, (settings.lifeExpectancy || 85) - nationalPensionStartAge)
    const nationalPensionTotal = nationalPensionMonthly * 12 * nationalPensionYears

    const retirementTotal = retirementPensionProjection?.totalAmount || 0
    const personalTotal = personalPensionProjection.total.futureAtStart

    // 예상 월 수령액 (수령 기간 중)
    const personalMonthlyPMT = personalPensionProjection.total.monthlyPMT

    // 퇴직연금 월 수령액 (연금 수령 선택 시)
    const retirementMonthlyPMT = retirementPensionProjection?.receiveType === 'annuity'
      ? retirementPensionProjection.monthlyPMT
      : 0

    return {
      nationalPension: {
        monthly: nationalPensionMonthly,
        startAge: nationalPensionStartAge,
        years: nationalPensionYears,
        total: nationalPensionTotal,
      },
      retirement: {
        total: retirementTotal,
        monthlyPMT: retirementMonthlyPMT,
        isAnnuity: retirementPensionProjection?.receiveType === 'annuity',
      },
      personal: {
        total: personalTotal,
        monthlyPMT: personalMonthlyPMT,
        annualPMT: personalPensionProjection.total.annualPMT,
      },
      grandTotal: nationalPensionTotal + retirementTotal + personalTotal,
    }
  }, [data.nationalPension, data.nationalPensionStartAge, settings.lifeExpectancy, retirementPensionProjection, personalPensionProjection])

  return (
    <div className={styles.container}>
      {/* 왼쪽: 연금 입력 */}
      <div className={styles.inputPanel}>

        {/* ========== 국민연금 ========== */}
        <section className={styles.pensionSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>국민연금</span>
          </div>
          <p className={styles.sectionDesc}>
            국민연금공단 예상연금 조회 서비스에서 확인한 금액을 입력하세요.
          </p>

          <div className={styles.itemList}>
            {editingField === 'national' ? (
              <div className={styles.editItem}>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>금액</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInput}
                      value={editValues.amount || ''}
                      onChange={e => setEditValues({ ...editValues, amount: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      placeholder="0"
                      autoFocus
                    />
                    <span className={styles.editUnit}>만원/월</span>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>시작</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.startAge || ''}
                      onChange={e => setEditValues({ ...editValues, startAge: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={60}
                      max={70}
                    />
                    <span className={styles.editUnit}>세부터 수령</span>
                  </div>
                </div>
                <div className={styles.editActions}>
                  <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                  <button
                    className={styles.saveBtn}
                    onClick={() => saveEdit({
                      nationalPension: editValues.amount ? parseFloat(editValues.amount) : null,
                      nationalPensionStartAge: editValues.startAge ? parseInt(editValues.startAge) : null,
                    })}
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : data.nationalPension ? (
              <div className={styles.pensionItem}>
                <div className={styles.itemMain}>
                  <span className={styles.itemLabel}>예상 월 수령액</span>
                  <span className={styles.itemAmount}>{formatMoney(data.nationalPension)}/월</span>
                  <span className={styles.itemMeta}>{data.nationalPensionStartAge || 65}세부터 수령</span>
                </div>
                <div className={styles.itemActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => startEdit('national', {
                      amount: data.nationalPension,
                      startAge: data.nationalPensionStartAge || 65,
                    })}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={styles.addBtn}
                onClick={() => startEdit('national', { amount: null, startAge: 65 })}
              >
                + 국민연금 추가
              </button>
            )}
          </div>
        </section>

        {/* ========== 퇴직연금 ========== */}
        <section className={styles.pensionSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>퇴직연금/퇴직금</span>
          </div>
          <p className={styles.sectionDesc}>
            유형을 선택하면 퇴직 시 예상 수령액을 자동으로 계산합니다.
          </p>

          <div className={styles.itemList}>
            {editingField === 'retirement' ? (
              <div className={styles.editItem}>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>유형</span>
                  <div className={styles.typeButtons}>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${editValues.type === 'DB' ? styles.active : ''}`}
                      onClick={() => setEditValues({ ...editValues, type: 'DB', balance: '' })}
                    >
                      DB형/퇴직금
                    </button>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${editValues.type === 'DC' ? styles.active : ''}`}
                      onClick={() => setEditValues({ ...editValues, type: 'DC' })}
                    >
                      DC형/기업IRP
                    </button>
                  </div>
                </div>

                {editValues.type === 'DB' && (
                  <div className={styles.editRow}>
                    <span className={styles.editRowLabel}>근속</span>
                    <div className={styles.editField}>
                      <input
                        type="number"
                        className={styles.editInputSmall}
                        value={editValues.years || ''}
                        onChange={e => setEditValues({ ...editValues, years: e.target.value })}
                        onWheel={e => (e.target as HTMLElement).blur()}
                        min={0}
                        max={50}
                        placeholder="0"
                      />
                      <span className={styles.editUnit}>년</span>
                    </div>
                  </div>
                )}

                {editValues.type === 'DC' && (
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
                )}

                {editValues.type && (
                  <>
                    <div className={styles.editRow}>
                      <span className={styles.editRowLabel}>수령</span>
                      <div className={styles.typeButtons}>
                        <button
                          type="button"
                          className={`${styles.typeBtn} ${editValues.receiveType === 'annuity' ? styles.active : ''}`}
                          onClick={() => setEditValues({ ...editValues, receiveType: 'annuity' })}
                        >
                          연금 수령 (세금 30~40% 감면)
                        </button>
                        <button
                          type="button"
                          className={`${styles.typeBtn} ${editValues.receiveType === 'lump_sum' ? styles.active : ''}`}
                          onClick={() => setEditValues({ ...editValues, receiveType: 'lump_sum' })}
                        >
                          일시금 수령
                        </button>
                      </div>
                    </div>

                    {editValues.receiveType === 'annuity' && (
                      <div className={styles.editRow}>
                        <span className={styles.editRowLabel}>기간</span>
                        <div className={styles.editField}>
                          <input
                            type="number"
                            className={styles.editInputSmall}
                            value={editValues.startAge || ''}
                            onChange={e => setEditValues({ ...editValues, startAge: e.target.value })}
                            onWheel={e => (e.target as HTMLElement).blur()}
                            min={56}
                            max={80}
                            placeholder="56"
                          />
                          <span className={styles.editUnit}>세부터</span>
                          <input
                            type="number"
                            className={styles.editInputSmall}
                            value={editValues.receivingYears || ''}
                            onChange={e => setEditValues({ ...editValues, receivingYears: e.target.value })}
                            onWheel={e => (e.target as HTMLElement).blur()}
                            min={5}
                            max={30}
                            placeholder="10"
                          />
                          <span className={styles.editUnit}>년간</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className={styles.editActions}>
                  <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                  <button
                    className={styles.saveBtn}
                    onClick={() => saveEdit({
                      retirementPensionType: editValues.type as 'DB' | 'DC' | null,
                      yearsOfService: editValues.type === 'DB' && editValues.years ? parseInt(editValues.years) : null,
                      retirementPensionBalance: editValues.type === 'DC' && editValues.balance ? parseFloat(editValues.balance) : null,
                      retirementPensionReceiveType: editValues.receiveType as 'lump_sum' | 'annuity' | null,
                      retirementPensionStartAge: editValues.receiveType === 'annuity' && editValues.startAge ? parseInt(editValues.startAge) : null,
                      retirementPensionReceivingYears: editValues.receiveType === 'annuity' && editValues.receivingYears ? parseInt(editValues.receivingYears) : null,
                    })}
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : data.retirementPensionType ? (
              <div className={styles.pensionItem}>
                <div className={styles.itemMain}>
                  <span className={styles.itemLabel}>
                    {(data.retirementPensionType === 'DB' || data.retirementPensionType === 'severance') && 'DB형/퇴직금'}
                    {(data.retirementPensionType === 'DC' || data.retirementPensionType === 'corporate_irp') && 'DC형/기업IRP'}
                  </span>
                  <span className={styles.itemAmount}>
                    {retirementPensionProjection
                      ? data.retirementPensionReceiveType === 'annuity' && retirementPensionProjection.monthlyPMT
                        ? `${formatMoney(retirementPensionProjection.monthlyPMT)}/월`
                        : formatMoney(retirementPensionProjection.totalAmount)
                      : '계산 불가'}
                  </span>
                  <span className={styles.itemMeta}>
                    {(data.retirementPensionType === 'DB' || data.retirementPensionType === 'severance')
                      ? data.yearsOfService
                        ? `현재 ${data.yearsOfService}년 → 퇴직 시 ${(data.yearsOfService || 0) + yearsUntilRetirement}년 근속`
                        : '근속연수를 입력하세요'
                      : data.retirementPensionBalance
                        ? `현재 잔액 ${formatMoney(data.retirementPensionBalance)}`
                        : '현재 잔액을 입력하세요'
                    }
                    {data.retirementPensionReceiveType === 'annuity'
                      ? ` | ${data.retirementPensionStartAge || 56}세부터 ${data.retirementPensionReceivingYears || 10}년간 연금 수령`
                      : data.retirementPensionReceiveType === 'lump_sum'
                        ? ' | 일시금 수령'
                        : ''
                    }
                    {!monthlyIncome && ' | 소득 탭에서 근로소득 입력 필요'}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => startEdit('retirement', {
                      type: (data.retirementPensionType === 'DB' || data.retirementPensionType === 'severance') ? 'DB' : 'DC',
                      years: data.yearsOfService,
                      balance: data.retirementPensionBalance,
                      receiveType: data.retirementPensionReceiveType || 'annuity',
                      startAge: data.retirementPensionStartAge || 56,
                      receivingYears: data.retirementPensionReceivingYears || 10,
                    })}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={styles.addBtn}
                onClick={() => startEdit('retirement', { type: null, years: null, balance: null, receiveType: 'annuity', startAge: 55, receivingYears: 10 })}
              >
                + 퇴직연금 추가
              </button>
            )}
          </div>
        </section>

        {/* ========== 개인연금 ========== */}
        <section className={styles.pensionSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>개인연금</span>
          </div>
          <p className={styles.sectionDesc}>
            현재 잔액과 수령 계획을 입력하세요.
          </p>

          <div className={styles.itemList}>
            {/* 연금저축 */}
            {editingField === 'pensionSavings' ? (
              <div className={styles.editItem}>
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
                      autoFocus
                    />
                    <span className={styles.editUnit}>만원</span>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>수령</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.startAge || ''}
                      onChange={e => setEditValues({ ...editValues, startAge: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={56}
                      max={80}
                      placeholder="56"
                    />
                    <span className={styles.editUnit}>세부터</span>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.years || ''}
                      onChange={e => setEditValues({ ...editValues, years: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={10}
                      max={30}
                      placeholder="20"
                    />
                    <span className={styles.editUnit}>년간</span>
                  </div>
                </div>
                <div className={styles.editActions}>
                  <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                  <button
                    className={styles.saveBtn}
                    onClick={() => saveEdit({
                      pensionSavingsBalance: editValues.balance ? parseFloat(editValues.balance) : null,
                      pensionSavingsStartAge: editValues.startAge ? parseInt(editValues.startAge) : 55,
                      pensionSavingsReceivingYears: editValues.years ? parseInt(editValues.years) : 20,
                    })}
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.pensionItem}>
                <div className={styles.itemMain}>
                  <span className={styles.itemLabel}>연금저축</span>
                  <span className={styles.itemAmount}>
                    {data.pensionSavingsBalance ? formatMoney(data.pensionSavingsBalance) : '0'}
                  </span>
                  {data.pensionSavingsBalance ? (
                    <span className={styles.itemMeta}>
                      {data.pensionSavingsStartAge || 56}세부터 {data.pensionSavingsReceivingYears || 20}년간 수령
                    </span>
                  ) : null}
                </div>
                <div className={styles.itemActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => startEdit('pensionSavings', {
                      balance: data.pensionSavingsBalance,
                      startAge: data.pensionSavingsStartAge || 56,
                      years: data.pensionSavingsReceivingYears || 20,
                    })}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* IRP */}
            {editingField === 'irp' ? (
              <div className={styles.editItem}>
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
                      autoFocus
                    />
                    <span className={styles.editUnit}>만원</span>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>수령</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.startAge || ''}
                      onChange={e => setEditValues({ ...editValues, startAge: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={56}
                      max={80}
                      placeholder="56"
                    />
                    <span className={styles.editUnit}>세부터</span>
                    <input
                      type="number"
                      className={styles.editInputSmall}
                      value={editValues.years || ''}
                      onChange={e => setEditValues({ ...editValues, years: e.target.value })}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      min={10}
                      max={30}
                      placeholder="20"
                    />
                    <span className={styles.editUnit}>년간</span>
                  </div>
                </div>
                <div className={styles.editActions}>
                  <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                  <button
                    className={styles.saveBtn}
                    onClick={() => saveEdit({
                      irpBalance: editValues.balance ? parseFloat(editValues.balance) : null,
                      irpStartAge: editValues.startAge ? parseInt(editValues.startAge) : 55,
                      irpReceivingYears: editValues.years ? parseInt(editValues.years) : 20,
                    })}
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.pensionItem}>
                <div className={styles.itemMain}>
                  <span className={styles.itemLabel}>IRP</span>
                  <span className={styles.itemAmount}>
                    {data.irpBalance ? formatMoney(data.irpBalance) : '0'}
                  </span>
                  {data.irpBalance ? (
                    <span className={styles.itemMeta}>
                      {data.irpStartAge || 56}세부터 {data.irpReceivingYears || 20}년간 수령
                    </span>
                  ) : null}
                </div>
                <div className={styles.itemActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => startEdit('irp', {
                      balance: data.irpBalance,
                      startAge: data.irpStartAge || 56,
                      years: data.irpReceivingYears || 20,
                    })}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ISA */}
            {editingField === 'isa' ? (
              <div className={styles.editItem}>
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
                      autoFocus
                    />
                    <span className={styles.editUnit}>만원</span>
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
                      min={currentYear}
                      max={currentYear + 10}
                      placeholder={String(currentYear + 3)}
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
                  <span className={styles.editRowLabel}>전략</span>
                  <div className={styles.typeButtons}>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${editValues.strategy === 'pension_savings' ? styles.active : ''}`}
                      onClick={() => setEditValues({ ...editValues, strategy: 'pension_savings' })}
                    >
                      연금저축 전환
                    </button>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${editValues.strategy === 'irp' ? styles.active : ''}`}
                      onClick={() => setEditValues({ ...editValues, strategy: 'irp' })}
                    >
                      IRP 전환
                    </button>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${editValues.strategy === 'cash' ? styles.active : ''}`}
                      onClick={() => setEditValues({ ...editValues, strategy: 'cash' })}
                    >
                      현금 인출
                    </button>
                  </div>
                </div>
                <div className={styles.editActions}>
                  <button className={styles.cancelBtn} onClick={cancelEdit}>취소</button>
                  <button
                    className={styles.saveBtn}
                    onClick={() => saveEdit({
                      isaBalance: editValues.balance ? parseFloat(editValues.balance) : null,
                      isaMaturityYear: editValues.maturityYear ? parseInt(editValues.maturityYear) : null,
                      isaMaturityMonth: editValues.maturityMonth ? parseInt(editValues.maturityMonth) : null,
                      isaMaturityStrategy: (editValues.strategy as 'pension_savings' | 'irp' | 'cash') || 'pension_savings',
                    })}
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.pensionItem}>
                <div className={styles.itemMain}>
                  <span className={styles.itemLabel}>ISA</span>
                  <span className={styles.itemAmount}>
                    {data.isaBalance ? formatMoney(data.isaBalance) : '0'}
                  </span>
                  {data.isaBalance && data.isaMaturityYear ? (
                    <span className={styles.itemMeta}>
                      {data.isaMaturityYear}년 {data.isaMaturityMonth || 12}월 만기
                      {data.isaMaturityStrategy === 'pension_savings' && ' → 연금저축 전환'}
                      {data.isaMaturityStrategy === 'irp' && ' → IRP 전환'}
                      {data.isaMaturityStrategy === 'cash' && ' → 현금 인출'}
                    </span>
                  ) : null}
                </div>
                <div className={styles.itemActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => startEdit('isa', {
                      balance: data.isaBalance,
                      maturityYear: data.isaMaturityYear || currentYear + 3,
                      maturityMonth: data.isaMaturityMonth || 12,
                      strategy: data.isaMaturityStrategy || 'pension_savings',
                    })}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 오른쪽: 예측 요약 */}
      <div className={styles.summaryPanel}>
        {/* 예상 월 수령액 */}
        <div className={styles.summaryCard}>
          <div className={styles.totalPension}>
            <span className={styles.totalLabel}>예상 월 연금 수령액</span>
            <span className={styles.totalValue}>
              {formatMoney(
                totalPensionProjection.nationalPension.monthly +
                totalPensionProjection.retirement.monthlyPMT +
                totalPensionProjection.personal.monthlyPMT
              )}/월
            </span>
          </div>
          <div className={styles.subValues}>
            <div className={styles.subValueItem}>
              <span className={styles.subLabel}>국민연금</span>
              <span className={styles.subValue}>{formatMoney(totalPensionProjection.nationalPension.monthly)}/월</span>
            </div>
            {totalPensionProjection.retirement.isAnnuity && (
              <div className={styles.subValueItem}>
                <span className={styles.subLabel}>퇴직연금</span>
                <span className={styles.subValue}>{formatMoney(totalPensionProjection.retirement.monthlyPMT)}/월</span>
              </div>
            )}
            <div className={styles.subValueItem}>
              <span className={styles.subLabel}>개인연금</span>
              <span className={styles.subValue}>{formatMoney(totalPensionProjection.personal.monthlyPMT)}/월</span>
            </div>
          </div>
        </div>

        {/* 연금 상세 */}
        <div className={styles.breakdownCard}>
          <h4 className={styles.cardTitle}>연금 상세</h4>
          <div className={styles.breakdownList}>
            {/* 국민연금 */}
            <div className={styles.breakdownItem}>
              <div className={styles.breakdownInfo}>
                <span className={styles.breakdownDot} style={{ background: '#5856d6' }}></span>
                <span className={styles.breakdownLabel}>국민연금</span>
              </div>
              <div className={styles.breakdownValues}>
                <span className={styles.breakdownAmount}>{formatMoney(totalPensionProjection.nationalPension.monthly)}/월</span>
              </div>
            </div>
            <div className={styles.breakdownMeta}>
              {totalPensionProjection.nationalPension.startAge}세부터 {totalPensionProjection.nationalPension.years}년간
            </div>

            {/* 퇴직연금 */}
            {retirementPensionProjection && (
              <>
                <div className={styles.breakdownItem}>
                  <div className={styles.breakdownInfo}>
                    <span className={styles.breakdownDot} style={{ background: '#007aff' }}></span>
                    <span className={styles.breakdownLabel}>퇴직연금</span>
                  </div>
                  <div className={styles.breakdownValues}>
                    <span className={styles.breakdownAmount}>
                      {retirementPensionProjection.receiveType === 'annuity' && retirementPensionProjection.monthlyPMT
                        ? `${formatMoney(retirementPensionProjection.monthlyPMT)}/월`
                        : formatMoney(retirementPensionProjection.totalAmount)
                      }
                    </span>
                  </div>
                </div>
                <div className={styles.breakdownMeta}>
                  {retirementPensionProjection.receiveType === 'annuity'
                    ? `${retirementPensionProjection.startAge}세부터 ${retirementPensionProjection.receivingYears}년간 (적립액 ${formatMoney(retirementPensionProjection.totalAmount)})`
                    : '퇴직 시 일시금 수령'
                  }
                </div>
              </>
            )}

            {/* 연금저축 */}
            {personalPensionProjection.pensionSavings.futureAtStart > 0 && (
              <>
                <div className={styles.breakdownItem}>
                  <div className={styles.breakdownInfo}>
                    <span className={styles.breakdownDot} style={{ background: '#34c759' }}></span>
                    <span className={styles.breakdownLabel}>연금저축</span>
                  </div>
                  <div className={styles.breakdownValues}>
                    <span className={styles.breakdownAmount}>{formatMoney(personalPensionProjection.pensionSavings.monthlyPMT)}/월</span>
                  </div>
                </div>
                <div className={styles.breakdownMeta}>
                  {personalPensionProjection.pensionSavings.startAge}세부터 {personalPensionProjection.pensionSavings.receivingYears}년간
                  (적립액 {formatMoney(personalPensionProjection.pensionSavings.futureAtStart)})
                </div>
              </>
            )}

            {/* IRP */}
            {personalPensionProjection.irp.futureAtStart > 0 && (
              <>
                <div className={styles.breakdownItem}>
                  <div className={styles.breakdownInfo}>
                    <span className={styles.breakdownDot} style={{ background: '#ff9500' }}></span>
                    <span className={styles.breakdownLabel}>IRP</span>
                  </div>
                  <div className={styles.breakdownValues}>
                    <span className={styles.breakdownAmount}>{formatMoney(personalPensionProjection.irp.monthlyPMT)}/월</span>
                  </div>
                </div>
                <div className={styles.breakdownMeta}>
                  {personalPensionProjection.irp.startAge}세부터 {personalPensionProjection.irp.receivingYears}년간
                  (적립액 {formatMoney(personalPensionProjection.irp.futureAtStart)})
                </div>
              </>
            )}

            {/* ISA */}
            {personalPensionProjection.isa.current > 0 && (
              <>
                <div className={styles.breakdownItem}>
                  <div className={styles.breakdownInfo}>
                    <span className={styles.breakdownDot} style={{ background: '#af52de' }}></span>
                    <span className={styles.breakdownLabel}>ISA</span>
                  </div>
                  <div className={styles.breakdownValues}>
                    <span className={styles.breakdownAmount}>{formatMoney(personalPensionProjection.isa.atMaturity)}</span>
                  </div>
                </div>
                <div className={styles.breakdownMeta}>
                  {personalPensionProjection.isa.maturityYear}년 만기 → {personalPensionProjection.isa.transferTo} 전환
                </div>
              </>
            )}
          </div>
        </div>

        {/* 가정 안내 */}
        <div className={styles.assumptionsCard}>
          <h4 className={styles.cardTitle}>계산 가정</h4>
          <ul className={styles.assumptionsList}>
            <li>임금상승률: 연 {settings.incomeGrowthRate}%</li>
            <li>투자수익률: 연 {settings.investmentReturnRate}%</li>
            <li>예상 수명: {settings.lifeExpectancy}세</li>
            <li>PMT 방식: 수령 중에도 잔액에 수익률 적용</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
