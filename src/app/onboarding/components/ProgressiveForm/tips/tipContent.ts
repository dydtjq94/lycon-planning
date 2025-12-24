import type { OnboardingData } from '@/types'
import type { SectionId } from '../../SectionForm'
import type { RowId } from '../types'
import { formatMoney } from './formatUtils'

// TIP 콘텐츠 타입
export interface TipContent {
  title: string
  description: string
  insights?: (data: OnboardingData) => string | null
}

// 섹션별 TIP
export const sectionTips: Record<SectionId, TipContent> = {
  household: {
    title: '가계 정보',
    description: '가족 구성원 정보는 부양가족 공제, 교육비, 의료비 등 세금 혜택과 보험 설계에 중요한 기초 자료입니다.',
  },
  goals: {
    title: '은퇴 목표',
    description: '현실적인 은퇴 목표 설정이 성공적인 노후 준비의 첫걸음입니다. 목표 나이와 필요 자금을 구체적으로 설정하세요.',
  },
  income: {
    title: '소득',
    description: '정확한 소득 파악은 저축률 계산과 투자 계획 수립의 기본입니다. 세전 금액으로 입력해주세요.',
  },
  expense: {
    title: '지출',
    description: '지출 파악은 재무 건전성의 핵심입니다. 고정 지출과 변동 지출을 구분하면 절약 포인트를 찾기 쉽습니다.',
  },
  realEstate: {
    title: '부동산',
    description: '주거용 부동산은 자산이자 비용입니다. 대출 상환 계획을 세우고 적정 주거비 비율(소득의 25-30%)을 유지하세요.',
  },
  asset: {
    title: '금융자산',
    description: '자산 배분은 위험 관리의 핵심입니다. 예금, 주식, 펀드 등 다양한 자산에 분산 투자하세요.',
  },
  debt: {
    title: '부채',
    description: '부채 관리의 핵심은 금리입니다. 고금리 대출부터 상환하고, 총 부채는 연소득의 2배를 넘지 않도록 관리하세요.',
  },
  pension: {
    title: '연금',
    description: '한국의 3층 연금 체계(국민연금, 퇴직연금, 개인연금)를 활용하면 안정적인 노후 소득을 확보할 수 있습니다.',
  },
}

// 행별 TIP
export const rowTips: Partial<Record<RowId, TipContent>> = {
  name: {
    title: '이름',
    description: '본인의 이름을 입력해주세요. 배우자가 있다면 배우자 정보도 함께 입력할 수 있습니다.',
  },
  birth_date: {
    title: '생년월일',
    description: '생년월일은 국민연금 수령 시기, 은퇴까지 남은 기간 등을 계산하는 데 사용됩니다.',
    insights: (data) => {
      if (!data.birth_date) return null
      const birthYear = parseInt(data.birth_date.split('-')[0])
      const currentYear = new Date().getFullYear()
      const age = currentYear - birthYear
      const yearsToRetirement = data.target_retirement_age ? data.target_retirement_age - age : null
      if (yearsToRetirement && yearsToRetirement > 0) {
        return `현재 ${age}세이며, 목표 은퇴까지 ${yearsToRetirement}년 남았습니다.`
      }
      return `현재 ${age}세입니다.`
    },
  },
  children: {
    title: '자녀',
    description: '자녀 정보는 교육비 계획, 부양가족 공제 등에 활용됩니다. 미성년 자녀가 있다면 교육비 준비도 함께 계획하세요.',
    insights: (data) => {
      const childCount = data.children.length
      if (childCount === 0) return null
      const minorChildren = data.children.filter(child => {
        if (!child.birth_date) return false
        const birthYear = parseInt(child.birth_date.split('-')[0])
        const age = new Date().getFullYear() - birthYear
        return age < 19
      }).length
      if (minorChildren > 0) {
        return `미성년 자녀 ${minorChildren}명의 교육비 준비가 필요합니다.`
      }
      return null
    },
  },
  retirement_age: {
    title: '목표 은퇴 나이',
    description: '한국의 법정 정년은 60세이며, 국민연금은 출생연도에 따라 62-65세부터 수령 가능합니다.',
    insights: (data) => {
      if (!data.target_retirement_age) return null
      if (data.target_retirement_age < 55) {
        return '55세 이전 조기 은퇴를 목표로 하고 계시네요. 더 많은 자산이 필요합니다.'
      }
      if (data.target_retirement_age > 65) {
        return '65세 이후 은퇴를 계획하시면 연금 수령 기간이 짧아져 더 여유로운 노후가 가능합니다.'
      }
      return null
    },
  },
  retirement_fund: {
    title: '목표 은퇴 자금',
    description: '일반적으로 은퇴 후 월 생활비의 25-30년치가 필요합니다. 현재 생활비와 기대 수명을 고려해 설정하세요.',
    insights: (data) => {
      if (!data.target_retirement_fund) return null
      const monthlyExpense = data.livingExpenses || 0
      if (monthlyExpense > 0) {
        const yearsOfExpense = Math.round(data.target_retirement_fund / (monthlyExpense * 12))
        return `현재 생활비 기준 약 ${yearsOfExpense}년치 생활비에 해당합니다.`
      }
      return null
    },
  },
  labor_income: {
    title: '근로소득',
    description: '급여, 상여금, 수당 등 모든 근로소득을 포함합니다. 세전 금액으로 입력해주세요.',
    insights: (data) => {
      const total = (data.laborIncome || 0) + (data.spouseLaborIncome || 0)
      if (total === 0) return null
      const monthly = data.laborIncomeFrequency === 'yearly' ? Math.round(total / 12) : total
      return `가구 월 근로소득: 약 ${formatMoney(monthly)}`
    },
  },
  business_income: {
    title: '사업소득',
    description: '사업, 프리랜서, 부업 등에서 발생하는 소득입니다. 경비 차감 전 매출이 아닌 순이익으로 입력해주세요.',
  },
  living_expenses: {
    title: '생활비',
    description: '주거비, 식비, 교통비, 통신비 등 매월 지출되는 평균 생활비입니다. 저축/투자 금액은 제외하세요.',
    insights: (data) => {
      const income = (data.laborIncome || 0) + (data.spouseLaborIncome || 0) + (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)
      const expense = data.livingExpenses || 0
      if (income === 0 || expense === 0) return null
      const savingRate = Math.round((1 - expense / income) * 100)
      if (savingRate < 20) {
        return `저축률 ${savingRate}%로 낮은 편입니다. 최소 20% 이상을 권장합니다.`
      }
      return `저축률 약 ${savingRate}%입니다.`
    },
  },
  realEstate: {
    title: '거주 부동산',
    description: '현재 거주하는 주택의 형태와 가치를 입력하세요. 자가는 자산으로, 전/월세 보증금은 묶인 자금으로 계산됩니다.',
    insights: (data) => {
      if (data.housingType === '자가' && data.housingValue && data.housingLoan) {
        const ltv = Math.round((data.housingLoan / data.housingValue) * 100)
        return `LTV(담보인정비율) ${ltv}%입니다. 40% 이하를 유지하면 안정적입니다.`
      }
      return null
    },
  },
  asset: {
    title: '금융자산',
    description: '예금, 적금, 주식, 펀드 등 모든 금융자산을 입력하세요. 비상금은 월 생활비의 3-6개월치를 권장합니다.',
    insights: (data) => {
      const cash = (data.cashCheckingAccount || 0) + (data.cashSavingsAccount || 0)
      const invest = (data.investDomesticStock || 0) + (data.investForeignStock || 0) + (data.investFund || 0) + (data.investOther || 0)
      const total = cash + invest
      if (total === 0) return null
      const investRatio = Math.round((invest / total) * 100)
      return `현금성 자산 ${Math.round((cash / total) * 100)}%, 투자자산 ${investRatio}% 비율입니다.`
    },
  },
  debt: {
    title: '부채',
    description: '신용대출, 카드론, 학자금대출 등 모든 부채를 입력하세요. 주택담보대출은 부동산 항목에서 입력합니다.',
    insights: (data) => {
      const totalDebt = data.debts.reduce((sum, d) => sum + (d.amount || 0), 0)
      if (totalDebt === 0) return null
      const income = ((data.laborIncome || 0) + (data.spouseLaborIncome || 0)) * (data.laborIncomeFrequency === 'monthly' ? 12 : 1)
      if (income === 0) return null
      const dti = Math.round((totalDebt / income) * 100)
      if (dti > 200) {
        return `부채가 연소득의 ${dti}%입니다. 200% 이하로 관리하세요.`
      }
      return `부채가 연소득의 ${dti}%입니다.`
    },
  },
  national_pension: {
    title: '국민연금',
    description: '국민연금공단 홈페이지에서 예상 수령액을 확인할 수 있습니다. 가입 기간과 납부액에 따라 달라집니다.',
    insights: (data) => {
      if (!data.nationalPension) return null
      const yearlyPension = data.nationalPension * 12
      return `연간 약 ${formatMoney(yearlyPension)}의 국민연금 수령 예상입니다.`
    },
  },
  retirement_pension: {
    title: '퇴직연금/퇴직금',
    description: 'DC형과 기업형 IRP는 운용 성과에 따라, DB형은 퇴직 시 급여에 따라 수령액이 결정됩니다. 퇴직금은 1년 근속당 1개월치 급여입니다.',
    insights: (data) => {
      if (!data.retirementPensionBalance) return null
      if (data.retirementPensionType === 'DC') {
        return 'DC형은 직접 운용하므로 수익률 관리가 중요합니다.'
      }
      if (data.retirementPensionType === 'DB') {
        return 'DB형은 회사가 운용하며, 퇴직 시 급여 기준으로 수령합니다.'
      }
      if (data.retirementPensionType === 'corporate_irp') {
        return '기업형 IRP는 DC형과 유사하게 직접 운용하며, 세액공제 혜택이 있습니다.'
      }
      return null
    },
  },
  personal_pension: {
    title: '개인연금',
    description: 'IRP, 연금저축, ISA는 세액공제 혜택이 있습니다. 연간 납입 한도와 세액공제 한도를 확인하세요.',
    insights: (data) => {
      const total = (data.irpBalance || 0) + (data.pensionSavingsBalance || 0) + (data.isaBalance || 0)
      if (total === 0) return null
      const items = []
      if (data.irpBalance) items.push(`IRP ${formatMoney(data.irpBalance)}`)
      if (data.pensionSavingsBalance) items.push(`연금저축 ${formatMoney(data.pensionSavingsBalance)}`)
      if (data.isaBalance) items.push(`ISA ${formatMoney(data.isaBalance)}`)
      return items.join(', ')
    },
  },
}

// 현재 활성 행에 맞는 TIP 콘텐츠 가져오기
export function getTipContent(activeRow: RowId, activeSection: SectionId): TipContent {
  return rowTips[activeRow] || sectionTips[activeSection]
}
