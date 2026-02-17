import { useMemo } from 'react'
import type { OnboardingData } from '@/types'

interface PensionCalculationsProps {
  data: OnboardingData
}

// PMT 계산: 수령 중에도 수익률 적용
// PMT = PV × (r × (1+r)^n) / ((1+r)^n - 1)
export function calculatePMT(presentValue: number, years: number, annualRate: number): number {
  if (years <= 0 || presentValue <= 0) return 0
  if (annualRate === 0) return presentValue / years
  const r = annualRate
  const n = years
  const factor = Math.pow(1 + r, n)
  return presentValue * (r * factor) / (factor - 1)
}

// 적립기간 동안 미래가치 계산 (FV)
export function calculateFutureValue(
  currentBalance: number,
  monthlyAmount: number,
  years: number,
  annualRate: number
): number {
  let futureValue = currentBalance
  for (let i = 0; i < years; i++) {
    futureValue = (futureValue + monthlyAmount * 12) * (1 + annualRate)
  }
  return Math.round(futureValue)
}

// 투자 수익률 (기본값 5%)
export function getInvestmentReturnRate(): number {
  return 5 / 100
}

// 소득 상승률 (기본값 3%)
export function getIncomeGrowthRate(): number {
  return 3 / 100
}

export interface RetirementPensionProjection {
  type: 'DB' | 'DC'
  totalAmount: number
  finalSalary?: number
  totalYears?: number
  currentBalance?: number
  monthlyContribution?: number
  receiveType: 'lump_sum' | 'annuity'
  startAge: number
  receivingYears: number
  annualPMT: number
  monthlyPMT: number
}

export interface PersonalPensionItem {
  current: number
  monthly: number
  futureAtStart: number
  startAge: number
  receivingYears: number
  annualPMT: number
  monthlyPMT: number
}

export interface ISAProjection {
  current: number
  monthly: number
  atMaturity: number
  maturityYear: number
  strategy: 'pension_savings' | 'irp' | 'cash'
  transferTo: string
}

export interface PersonalPensionProjection {
  pensionSavings: PersonalPensionItem
  irp: PersonalPensionItem
  isa: ISAProjection
  total: {
    current: number
    monthly: number
    futureAtStart: number
    annualPMT: number
    monthlyPMT: number
  }
}

export interface TotalPensionProjection {
  nationalPension: {
    monthly: number
    startAge: number
    years: number
    total: number
  }
  retirement: {
    total: number
    monthlyPMT: number
    isAnnuity: boolean
  }
  personal: {
    total: number
    monthlyPMT: number
    annualPMT: number
  }
  grandTotal: number
}

export function usePensionCalculations({ data }: PensionCalculationsProps) {
  const currentYear = new Date().getFullYear()

  // 기본 수익률
  const investmentReturnRate = getInvestmentReturnRate()
  const incomeGrowthRate = getIncomeGrowthRate()

  // 현재 나이 계산
  const currentAge = useMemo(() => {
    if (!data.birth_date) return 35
    const birthYear = new Date(data.birth_date).getFullYear()
    return currentYear - birthYear
  }, [data.birth_date, currentYear])

  // 배우자 현재 나이
  const spouseAge = useMemo(() => {
    if (!data.spouse?.birth_date) return null
    const birthYear = new Date(data.spouse.birth_date).getFullYear()
    return currentYear - birthYear
  }, [data.spouse?.birth_date, currentYear])

  const retirementAge = data.target_retirement_age || 60
  const yearsUntilRetirement = Math.max(0, retirementAge - currentAge)

  // 배우자 은퇴 나이
  const spouseRetirementAge = data.spouse?.retirement_age || 60
  const spouseYearsUntilRetirement = spouseAge ? Math.max(0, spouseRetirementAge - spouseAge) : 0

  // 월 소득 (소득 탭에서)
  const monthlyIncome = useMemo(() => {
    let income = 0
    if (data.laborIncome) {
      income += data.laborIncomeFrequency === 'yearly' ? data.laborIncome / 12 : data.laborIncome
    }
    return income
  }, [data.laborIncome, data.laborIncomeFrequency])

  // 배우자 월 소득
  const spouseMonthlyIncome = useMemo(() => {
    let income = 0
    if (data.spouseLaborIncome) {
      income += data.spouseLaborIncomeFrequency === 'yearly' ? data.spouseLaborIncome / 12 : data.spouseLaborIncome
    }
    return income
  }, [data.spouseLaborIncome, data.spouseLaborIncomeFrequency])

  // ============================================
  // 본인 퇴직연금 계산
  // ============================================
  const retirementPensionProjection = useMemo((): RetirementPensionProjection | null => {
    const type = data.retirementPensionType
    if (!type || !monthlyIncome) return null

    const isDBType = type === 'DB' || type === 'severance'
    const isDCType = type === 'DC' || type === 'corporate_irp'

    const receiveType = data.retirementPensionReceiveType || 'annuity'
    const receiveStartAge = Math.max(56, data.retirementPensionStartAge || 56)
    const receivingYears = data.retirementPensionReceivingYears || 10

    if (isDBType) {
      const yearsOfService = data.yearsOfService || 0
      const totalYearsAtRetirement = yearsOfService + yearsUntilRetirement
      const finalMonthlySalary = monthlyIncome * Math.pow(1 + incomeGrowthRate, yearsUntilRetirement)
      const totalAmount = finalMonthlySalary * totalYearsAtRetirement

      let annualPMT = 0
      let monthlyPMT = 0
      if (receiveType === 'annuity') {
        const yearsUntilReceive = Math.max(0, receiveStartAge - retirementAge)
        const valueAtReceiveStart = totalAmount * Math.pow(1 + investmentReturnRate, yearsUntilReceive)
        annualPMT = calculatePMT(valueAtReceiveStart, receivingYears, investmentReturnRate)
        monthlyPMT = Math.round(annualPMT / 12)
      }

      return {
        type: 'DB',
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
      const monthlyContribution = monthlyIncome * 0.0833

      let futureValue = currentBalance
      for (let i = 0; i < yearsUntilRetirement; i++) {
        futureValue = (futureValue + monthlyContribution * 12) * (1 + investmentReturnRate)
      }

      let annualPMT = 0
      let monthlyPMT = 0
      if (receiveType === 'annuity') {
        const yearsUntilReceive = Math.max(0, receiveStartAge - retirementAge)
        const valueAtReceiveStart = futureValue * Math.pow(1 + investmentReturnRate, yearsUntilReceive)
        annualPMT = calculatePMT(valueAtReceiveStart, receivingYears, investmentReturnRate)
        monthlyPMT = Math.round(annualPMT / 12)
      }

      return {
        type: 'DC',
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
  }, [data, monthlyIncome, yearsUntilRetirement, retirementAge, incomeGrowthRate, investmentReturnRate])

  // ============================================
  // 배우자 퇴직연금 계산
  // ============================================
  const spouseRetirementPensionProjection = useMemo((): RetirementPensionProjection | null => {
    const type = data.spouseRetirementPensionType
    if (!type || !spouseMonthlyIncome || !spouseAge) return null

    const isDBType = type === 'DB' || type === 'severance'
    const isDCType = type === 'DC' || type === 'corporate_irp'

    const receiveType = data.spouseRetirementPensionReceiveType || 'annuity'
    const receiveStartAge = Math.max(56, data.spouseRetirementPensionStartAge || 56)
    const receivingYears = data.spouseRetirementPensionReceivingYears || 10

    if (isDBType) {
      const yearsOfService = data.spouseYearsOfService || 0
      const totalYearsAtRetirement = yearsOfService + spouseYearsUntilRetirement
      const finalMonthlySalary = spouseMonthlyIncome * Math.pow(1 + incomeGrowthRate, spouseYearsUntilRetirement)
      const totalAmount = finalMonthlySalary * totalYearsAtRetirement

      let annualPMT = 0
      let monthlyPMT = 0
      if (receiveType === 'annuity') {
        const yearsUntilReceive = Math.max(0, receiveStartAge - spouseRetirementAge)
        const valueAtReceiveStart = totalAmount * Math.pow(1 + investmentReturnRate, yearsUntilReceive)
        annualPMT = calculatePMT(valueAtReceiveStart, receivingYears, investmentReturnRate)
        monthlyPMT = Math.round(annualPMT / 12)
      }

      return {
        type: 'DB',
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
      const currentBalance = data.spouseRetirementPensionBalance || 0
      const monthlyContribution = spouseMonthlyIncome * 0.0833

      let futureValue = currentBalance
      for (let i = 0; i < spouseYearsUntilRetirement; i++) {
        futureValue = (futureValue + monthlyContribution * 12) * (1 + investmentReturnRate)
      }

      let annualPMT = 0
      let monthlyPMT = 0
      if (receiveType === 'annuity') {
        const yearsUntilReceive = Math.max(0, receiveStartAge - spouseRetirementAge)
        const valueAtReceiveStart = futureValue * Math.pow(1 + investmentReturnRate, yearsUntilReceive)
        annualPMT = calculatePMT(valueAtReceiveStart, receivingYears, investmentReturnRate)
        monthlyPMT = Math.round(annualPMT / 12)
      }

      return {
        type: 'DC',
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
  }, [data, spouseMonthlyIncome, spouseAge, spouseYearsUntilRetirement, spouseRetirementAge, incomeGrowthRate, investmentReturnRate])

  // ============================================
  // 본인 개인연금 계산 (cashFlowRules 의존 제거)
  // ============================================
  const personalPensionProjection = useMemo((): PersonalPensionProjection => {
    const pensionSavings = data.pensionSavingsBalance || 0
    const irp = data.irpBalance || 0
    const isa = data.isaBalance || 0

    // 직접 월 납입액 필드 사용 (cashFlowRules 대신)
    const monthlyPensionSavings = data.pensionSavingsMonthlyContribution || 0
    const monthlyIrp = data.irpMonthlyContribution || 0
    const monthlyIsa = data.isaMonthlyContribution || 0

    // 수령 시작 나이와 기간 (56세 이상 검증)
    const pensionSavingsStartAge = Math.max(56, data.pensionSavingsStartAge || 56)
    const pensionSavingsYears = data.pensionSavingsReceivingYears || 20
    const irpStartAge = Math.max(56, data.irpStartAge || 56)
    const irpYears = data.irpReceivingYears || 20

    // 수령 시작까지 남은 년수
    const yearsUntilPensionSavings = Math.max(0, pensionSavingsStartAge - currentAge)
    const yearsUntilIrp = Math.max(0, irpStartAge - currentAge)

    // ISA 만기 처리
    const isaMaturityYear = data.isaMaturityYear || currentYear + 3
    const yearsUntilIsaMaturity = Math.max(0, isaMaturityYear - currentYear)
    const isaStrategy = data.isaMaturityStrategy || 'pension_savings'

    // ISA 만기 시 잔액
    const isaAtMaturity = calculateFutureValue(isa, monthlyIsa, yearsUntilIsaMaturity, investmentReturnRate)

    // ISA 전환분 계산
    let isaToAddToPensionSavings = 0
    let isaToAddToIrp = 0

    if (isaStrategy === 'pension_savings' && yearsUntilIsaMaturity < yearsUntilPensionSavings) {
      const additionalYears = yearsUntilPensionSavings - yearsUntilIsaMaturity
      isaToAddToPensionSavings = isaAtMaturity * Math.pow(1 + investmentReturnRate, additionalYears)
    }

    if (isaStrategy === 'irp' && yearsUntilIsaMaturity < yearsUntilIrp) {
      const additionalYears = yearsUntilIrp - yearsUntilIsaMaturity
      isaToAddToIrp = isaAtMaturity * Math.pow(1 + investmentReturnRate, additionalYears)
    }

    // 수령 시작 시점의 적립액
    const pensionSavingsAtStart = calculateFutureValue(pensionSavings, monthlyPensionSavings, yearsUntilPensionSavings, investmentReturnRate) + isaToAddToPensionSavings
    const irpAtStart = calculateFutureValue(irp, monthlyIrp, yearsUntilIrp, investmentReturnRate) + isaToAddToIrp

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
        annualPMT: Math.round(pensionSavingsAnnualPMT),
        monthlyPMT: Math.round(pensionSavingsAnnualPMT / 12),
      },
      irp: {
        current: irp,
        monthly: monthlyIrp,
        futureAtStart: Math.round(irpAtStart),
        startAge: irpStartAge,
        receivingYears: irpYears,
        annualPMT: Math.round(irpAnnualPMT),
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
        annualPMT: Math.round(pensionSavingsAnnualPMT + irpAnnualPMT),
        monthlyPMT: Math.round((pensionSavingsAnnualPMT + irpAnnualPMT) / 12),
      }
    }
  }, [data, currentAge, currentYear, investmentReturnRate])

  // ============================================
  // 배우자 개인연금 계산
  // ============================================
  const spousePersonalPensionProjection = useMemo((): PersonalPensionProjection | null => {
    if (!data.isMarried || !spouseAge) return null

    const pensionSavings = data.spousePensionSavingsBalance || 0
    const irp = data.spouseIrpBalance || 0

    const monthlyPensionSavings = data.spousePensionSavingsMonthlyContribution || 0
    const monthlyIrp = data.spouseIrpMonthlyContribution || 0

    // 배우자는 ISA 없음 (필요시 추가)
    if (pensionSavings === 0 && irp === 0 && monthlyPensionSavings === 0 && monthlyIrp === 0) {
      return null
    }

    const pensionSavingsStartAge = Math.max(56, data.spousePensionSavingsStartAge || 56)
    const pensionSavingsYears = data.spousePensionSavingsReceivingYears || 20
    const irpStartAge = Math.max(56, data.spouseIrpStartAge || 56)
    const irpYears = data.spouseIrpReceivingYears || 20

    const yearsUntilPensionSavings = Math.max(0, pensionSavingsStartAge - spouseAge)
    const yearsUntilIrp = Math.max(0, irpStartAge - spouseAge)

    const pensionSavingsAtStart = calculateFutureValue(pensionSavings, monthlyPensionSavings, yearsUntilPensionSavings, investmentReturnRate)
    const irpAtStart = calculateFutureValue(irp, monthlyIrp, yearsUntilIrp, investmentReturnRate)

    const pensionSavingsAnnualPMT = calculatePMT(pensionSavingsAtStart, pensionSavingsYears, investmentReturnRate)
    const irpAnnualPMT = calculatePMT(irpAtStart, irpYears, investmentReturnRate)

    return {
      pensionSavings: {
        current: pensionSavings,
        monthly: monthlyPensionSavings,
        futureAtStart: Math.round(pensionSavingsAtStart),
        startAge: pensionSavingsStartAge,
        receivingYears: pensionSavingsYears,
        annualPMT: Math.round(pensionSavingsAnnualPMT),
        monthlyPMT: Math.round(pensionSavingsAnnualPMT / 12),
      },
      irp: {
        current: irp,
        monthly: monthlyIrp,
        futureAtStart: Math.round(irpAtStart),
        startAge: irpStartAge,
        receivingYears: irpYears,
        annualPMT: Math.round(irpAnnualPMT),
        monthlyPMT: Math.round(irpAnnualPMT / 12),
      },
      isa: {
        current: 0,
        monthly: 0,
        atMaturity: 0,
        maturityYear: currentYear,
        strategy: 'cash',
        transferTo: '-',
      },
      total: {
        current: pensionSavings + irp,
        monthly: monthlyPensionSavings + monthlyIrp,
        futureAtStart: Math.round(pensionSavingsAtStart + irpAtStart),
        annualPMT: Math.round(pensionSavingsAnnualPMT + irpAnnualPMT),
        monthlyPMT: Math.round((pensionSavingsAnnualPMT + irpAnnualPMT) / 12),
      }
    }
  }, [data, spouseAge, currentYear, investmentReturnRate])

  // ============================================
  // 총 연금 예상 (본인 + 배우자)
  // ============================================
  const totalPensionProjection = useMemo((): TotalPensionProjection => {
    // 본인 국민연금
    const nationalPensionMonthly = data.nationalPension || 0
    const nationalPensionStartAge = data.nationalPensionStartAge || 65
    const nationalPensionYears = Math.max(0, 100 - nationalPensionStartAge)
    const nationalPensionTotal = nationalPensionMonthly * 12 * nationalPensionYears

    // 배우자 국민연금
    const spouseNationalPensionMonthly = data.spouseNationalPension || 0
    const spouseNationalPensionStartAge = data.spouseNationalPensionStartAge || 65
    const spouseNationalPensionYears = Math.max(0, 100 - spouseNationalPensionStartAge)
    const spouseNationalPensionTotal = spouseNationalPensionMonthly * 12 * spouseNationalPensionYears

    // 퇴직연금
    const retirementTotal = (retirementPensionProjection?.totalAmount || 0) + (spouseRetirementPensionProjection?.totalAmount || 0)
    const retirementMonthlyPMT =
      (retirementPensionProjection?.receiveType === 'annuity' ? retirementPensionProjection.monthlyPMT : 0) +
      (spouseRetirementPensionProjection?.receiveType === 'annuity' ? spouseRetirementPensionProjection.monthlyPMT : 0)

    // 개인연금
    const personalTotal = personalPensionProjection.total.futureAtStart + (spousePersonalPensionProjection?.total.futureAtStart || 0)
    const personalMonthlyPMT = personalPensionProjection.total.monthlyPMT + (spousePersonalPensionProjection?.total.monthlyPMT || 0)
    const personalAnnualPMT = personalPensionProjection.total.annualPMT + (spousePersonalPensionProjection?.total.annualPMT || 0)

    return {
      nationalPension: {
        monthly: nationalPensionMonthly + spouseNationalPensionMonthly,
        startAge: nationalPensionStartAge,
        years: nationalPensionYears,
        total: nationalPensionTotal + spouseNationalPensionTotal,
      },
      retirement: {
        total: retirementTotal,
        monthlyPMT: retirementMonthlyPMT,
        isAnnuity: retirementPensionProjection?.receiveType === 'annuity' || spouseRetirementPensionProjection?.receiveType === 'annuity',
      },
      personal: {
        total: personalTotal,
        monthlyPMT: personalMonthlyPMT,
        annualPMT: personalAnnualPMT,
      },
      grandTotal: nationalPensionTotal + spouseNationalPensionTotal + retirementTotal + personalTotal,
    }
  }, [data, retirementPensionProjection, spouseRetirementPensionProjection, personalPensionProjection, spousePersonalPensionProjection])

  return {
    currentYear,
    currentAge,
    spouseAge,
    retirementAge,
    spouseRetirementAge,
    yearsUntilRetirement,
    spouseYearsUntilRetirement,
    monthlyIncome,
    spouseMonthlyIncome,
    investmentReturnRate,
    incomeGrowthRate,
    retirementPensionProjection,
    spouseRetirementPensionProjection,
    personalPensionProjection,
    spousePersonalPensionProjection,
    totalPensionProjection,
  }
}
