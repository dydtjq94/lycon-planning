import type { OnboardingData } from '@/types'
import type { SectionId } from '../../SectionForm'
import type { RowId } from '../types'
import { formatMoney } from './formatUtils'

// TIP 콘텐츠 타입 (내부 저장용 - title이 함수일 수 있음)
export interface TipContentRaw {
  title: string | ((data: OnboardingData) => string)
  description: string
  insights?: (data: OnboardingData) => string | null
}

// TIP 콘텐츠 타입 (렌더링용 - title이 항상 string)
export interface TipContent {
  title: string
  description: string
  insights?: (data: OnboardingData) => string | null
}

// 나이 계산 헬퍼
function calculateAge(birthDate: string): number {
  if (!birthDate) return 0
  const birthYear = parseInt(birthDate.split('-')[0])
  return new Date().getFullYear() - birthYear
}

// 월 소득 계산 헬퍼
function getMonthlyIncome(data: OnboardingData): number {
  let total = 0
  total += data.laborIncomeFrequency === 'yearly'
    ? (data.laborIncome || 0) / 12
    : (data.laborIncome || 0)
  total += data.spouseLaborIncomeFrequency === 'yearly'
    ? (data.spouseLaborIncome || 0) / 12
    : (data.spouseLaborIncome || 0)
  total += data.businessIncomeFrequency === 'yearly'
    ? (data.businessIncome || 0) / 12
    : (data.businessIncome || 0)
  total += data.spouseBusinessIncomeFrequency === 'yearly'
    ? (data.spouseBusinessIncome || 0) / 12
    : (data.spouseBusinessIncome || 0)
  return total
}

// 총 금융자산 계산
function getTotalFinancialAssets(data: OnboardingData): number {
  return (
    (data.cashCheckingAccount || 0) +
    (data.cashSavingsAccount || 0) +
    (data.investDomesticStock || 0) +
    (data.investForeignStock || 0) +
    (data.investFund || 0) +
    (data.investOther || 0)
  )
}

// 순자산 계산
function getNetWorth(data: OnboardingData): number {
  const financialAssets = getTotalFinancialAssets(data)
  const pensionAssets = (data.retirementPensionBalance || 0) + (data.irpBalance || 0) + (data.pensionSavingsBalance || 0) + (data.isaBalance || 0)
  const housingEquity = data.housingType === '자가' ? (data.housingValue || 0) - (data.housingLoan || 0) : 0
  const totalDebt = data.debts.reduce((sum, d) => sum + (d.amount || 0), 0)
  return financialAssets + pensionAssets + housingEquity - totalDebt
}

// 섹션별 TIP (폴백용)
export const sectionTips: Record<SectionId, TipContent> = {
  household: {
    title: '가계 정보',
    description: '가족 구성 정보는 세금 혜택과 보험 설계의 기초 자료입니다.',
  },
  goals: {
    title: '은퇴 목표',
    description: '목표 나이와 필요 자금을 설정하세요.',
  },
  income: {
    title: '소득',
    description: '세전 금액으로 입력해주세요.',
  },
  expense: {
    title: '지출',
    description: '저축/투자 금액은 제외하고 입력하세요.',
  },
  realEstate: {
    title: '부동산',
    description: '주거비는 소득의 25-30% 이하가 적정합니다.',
  },
  asset: {
    title: '금융자산',
    description: '예금, 주식, 펀드 등 분산 투자가 중요합니다.',
  },
  debt: {
    title: '부채',
    description: '고금리 대출부터 상환하세요.',
  },
  pension: {
    title: '연금',
    description: '3층 연금으로 노후 소득을 확보하세요.',
  },
}

// 행별 TIP (상세 버전)
export const rowTips: Partial<Record<RowId, TipContentRaw>> = {
  // 1. 이름
  name: {
    title: '은퇴 후에도 월급처럼',
    description: '일하지 않아도 매달 돈이 들어오는 구조, 지금 준비하면 만들 수 있어요. 성별은 기대수명 계산에 사용됩니다 (남 83세, 여 87세).',
    insights: (data) => {
      if (data.name) {
        return `${data.name}님, 함께 시작해볼까요?`
      }
      return '오늘 시작하면 10년 뒤 당신이 감사할 거예요.'
    },
  },

  // 2. 생년월일
  birth_date: {
    title: (data: OnboardingData) => data.name ? `${data.name}님, 반갑습니다` : '시간은 가장 강력한 자산',
    description: '복리의 마법은 시간이 길수록 강력합니다. 배우자가 있다면 함께 입력하세요. 가구 단위로 재무설계가 더 정확해집니다.',
    insights: (data) => {
      if (!data.birth_date) {
        if (data.name) {
          return `${data.name}님의 재무설계 여정을 함께하게 되어 기쁩니다.`
        }
        return null
      }
      const age = calculateAge(data.birth_date)
      const yearsToRetirement = data.target_retirement_age ? data.target_retirement_age - age : null

      // 나이대별 더 구체적인 조언
      let ageAdvice = ''
      if (age < 30) {
        ageAdvice = '지금 월 30만원이 40년 후 1.2억이 됩니다. 습관이 중요합니다.'
      } else if (age < 40) {
        ageAdvice = '복리의 황금기입니다. 저축률 30%를 목표로 하세요.'
      } else if (age < 50) {
        ageAdvice = '은퇴까지 20년, 월 100만원 저축이 필요합니다.'
      } else if (age < 60) {
        ageAdvice = '자산 보존 모드로 전환할 시기입니다. 리스크를 줄이세요.'
      } else {
        ageAdvice = '인출 전략과 연금 수령 시기 최적화가 중요합니다.'
      }

      if (yearsToRetirement && yearsToRetirement > 0) {
        return `현재 ${age}세, 은퇴까지 ${yearsToRetirement}년. ${ageAdvice}`
      }
      return `현재 ${age}세. ${ageAdvice}`
    },
  },

  // 3. 자녀
  children: {
    title: '자녀 교육비 계획',
    description: '자녀 1인당 대학 졸업까지 평균 2.7억원이 필요합니다. (유아기 6,700만원 + 초중고 1.4억 + 대학 6,000만원)',
    insights: (data) => {
      const childCount = data.children.length
      if (childCount === 0) return '자녀가 없다면 은퇴 자금에 집중할 수 있습니다.'

      const currentYear = new Date().getFullYear()
      let totalEducationCost = 0
      const childAges: number[] = []

      data.children.forEach((child) => {
        if (!child.birth_date) return
        const birthYear = parseInt(child.birth_date.split('-')[0])
        const childAge = currentYear - birthYear
        childAges.push(childAge)

        // 남은 교육비 계산 (만원 단위)
        if (childAge < 7) totalEducationCost += 20000 // 2억
        else if (childAge < 13) totalEducationCost += 16000 // 1.6억
        else if (childAge < 16) totalEducationCost += 12000 // 1.2억
        else if (childAge < 19) totalEducationCost += 8000 // 8천
        else if (childAge < 23) totalEducationCost += 6000 // 6천
      })

      if (totalEducationCost > 0) {
        return `자녀 ${childCount}명. 남은 예상 교육비 약 ${formatMoney(totalEducationCost)}.`
      }
      return `자녀 ${childCount}명이 모두 성인입니다.`
    },
  },

  // 4. 은퇴 나이
  retirement_age: {
    title: '은퇴 시점 설계',
    description: '은퇴 1년 연기 = 약 1.2억 효과 (추가소득 6천만 + 자산증가 3천만 + 인출연기 3천만). 국민연금은 65세부터 수령.',
    insights: (data) => {
      if (!data.target_retirement_age) return null

      const age = data.birth_date ? calculateAge(data.birth_date) : 0
      const yearsToRetirement = data.target_retirement_age - age
      const pensionStartAge = data.nationalPensionStartAge || 65
      const pensionGap = pensionStartAge - data.target_retirement_age

      if (pensionGap > 0) {
        const monthlyExpense = data.livingExpenses || 300
        const gapFund = monthlyExpense * 12 * pensionGap * 0.7 // 은퇴 후 70% 가정
        return `연금 공백 ${pensionGap}년. 약 ${formatMoney(gapFund)}이 필요합니다.`
      }
      if (yearsToRetirement > 0) {
        return `은퇴까지 ${yearsToRetirement}년. 목표를 향해 꾸준히 준비하세요.`
      }
      return null
    },
  },

  // 5. 은퇴 자금
  retirement_fund: {
    title: '목표 은퇴 자금',
    description: '월 생활비 x 12개월 x (기대수명 - 은퇴나이). 국민연금과 퇴직연금을 빼면 실제 필요액이 줄어듭니다.',
    insights: (data) => {
      const netWorth = getNetWorth(data)
      const targetFund = data.target_retirement_fund || 0
      const monthlyExpense = data.livingExpenses || 0

      if (targetFund === 0) {
        if (monthlyExpense > 0) {
          const suggested = monthlyExpense * 12 * 30 * 0.7 // 30년, 70% 가정
          return `월 생활비 ${formatMoney(monthlyExpense)} 기준, 약 ${formatMoney(suggested)} 필요 예상.`
        }
        return null
      }

      const progress = Math.round((netWorth / targetFund) * 100)

      if (progress >= 100) {
        return `목표 달성! 자산 보존과 인출 전략에 집중하세요.`
      }

      const remaining = targetFund - netWorth
      return `달성률 ${progress}%. 남은 금액 ${formatMoney(remaining)}.`
    },
  },

  // 6. 근로소득
  labor_income: {
    title: '얼마를 버느냐보다 얼마를 남기느냐',
    description: '세전 금액(급여명세서 "지급총액")으로 입력하세요. 상여금, 성과급은 연간 총액을 12로 나누어 포함하세요.',
    insights: (data) => {
      const laborTotal = (data.laborIncome || 0) + (data.spouseLaborIncome || 0)
      if (laborTotal === 0) return null

      const monthlyLabor = data.laborIncomeFrequency === 'yearly' ? laborTotal / 12 : laborTotal

      // 한국 가구 평균 대비 비교 (2024 기준 약 550만원)
      let comparison = ''
      if (monthlyLabor >= 1000) comparison = ' (상위 10%)'
      else if (monthlyLabor >= 700) comparison = ' (상위 25%)'
      else if (monthlyLabor >= 550) comparison = ' (평균 이상)'

      return `월 ${formatMoney(monthlyLabor)}${comparison}. 저축률이 더 중요합니다.`
    },
  },

  // 7. 사업소득
  business_income: {
    title: '사업소득자 특별 안내',
    description: '순이익(매출-경비)으로 입력하세요. 사업자는 비상금 12개월치 권장, 노란우산공제 가입도 고려하세요.',
    insights: (data) => {
      const businessTotal = (data.businessIncome || 0) + (data.spouseBusinessIncome || 0)
      if (businessTotal === 0) return '사업소득이 없다면 "0"을 입력하세요.'

      const totalIncome = getMonthlyIncome(data)
      if (totalIncome === 0) return null

      const businessRatio = Math.round((businessTotal / totalIncome) * 100)
      const recommendedMonths = businessRatio >= 70 ? 12 : businessRatio >= 30 ? 9 : 6

      return `사업소득 비중 ${businessRatio}%. 비상금 ${recommendedMonths}개월치 권장.`
    },
  },

  // 8. 생활비
  living_expenses: {
    title: '저축률이 핵심',
    description: '주거비, 식비, 교통비, 통신비, 보험료, 교육비 등 포함. 저축/투자 금액과 대출 상환액은 제외하세요.',
    insights: (data) => {
      const income = getMonthlyIncome(data)
      const expense = data.livingExpenses || 0

      if (income === 0 || expense === 0) return null

      const savingsRate = Math.round(((income - expense) / income) * 100)
      const monthlySaving = income - expense

      // 한국 평균 저축률 약 15%
      let status = ''
      let advice = ''
      if (savingsRate < 10) {
        status = '위험'
        advice = '지출 점검이 필요합니다.'
      } else if (savingsRate < 20) {
        status = '주의'
        advice = '평균 수준입니다.'
      } else if (savingsRate < 30) {
        status = '양호'
        advice = '상위 30%입니다.'
      } else {
        status = '우수'
        advice = '상위 10%입니다.'
      }

      return `저축률 ${savingsRate}% [${status}]. 월 ${formatMoney(monthlySaving)}. ${advice}`
    },
  },

  // 9. 부동산
  realEstate: {
    title: '주거와 자산',
    description: '자가는 시세(KB/네이버부동산 참고)와 대출을 입력. 전세는 보증금, 월세는 보증금+월세를 입력하세요.',
    insights: (data) => {
      if (!data.housingType || data.housingType === '해당없음') return null

      if (data.housingType === '자가') {
        const value = data.housingValue || 0
        const loan = data.housingLoan || 0
        if (value === 0) return null

        const ltv = loan > 0 ? Math.round((loan / value) * 100) : 0
        const equity = value - loan

        let status = ''
        let advice = ''
        if (ltv === 0) {
          status = '무담보'
          advice = '재무적으로 안정적입니다.'
        } else if (ltv <= 40) {
          status = '안정'
          advice = ''
        } else if (ltv <= 60) {
          status = '적정'
          advice = ''
        } else {
          status = '주의'
          advice = 'DSR 규제에 유의하세요.'
        }

        return `LTV ${ltv}% [${status}]. 순자산 ${formatMoney(equity)}. ${advice}`
      }

      if (data.housingType === '전세') {
        const deposit = data.housingValue || 0
        if (deposit === 0) return null
        return `보증금 ${formatMoney(deposit)}. 전세보증보험 가입을 권장합니다.`
      }

      if (data.housingType === '월세') {
        const rent = data.housingRent || 0
        const income = getMonthlyIncome(data)
        if (rent === 0 || income === 0) return null

        const ratio = Math.round((rent / income) * 100)
        const status = ratio <= 20 ? '적정' : ratio <= 30 ? '관리가능' : '과다'
        return `월세 비율 ${ratio}% [${status}]. 25% 이하가 권장됩니다.`
      }

      return null
    },
  },

  // 10. 금융자산
  asset: {
    title: '자산 배분',
    description: '입출금통장, 정기예금, 주식(국내/해외), 펀드, 기타(코인, 금 등)를 입력하세요. 비상금 3-6개월치 현금 확보 후 투자하세요.',
    insights: (data) => {
      const cash = (data.cashCheckingAccount || 0) + (data.cashSavingsAccount || 0)
      const invest = (data.investDomesticStock || 0) + (data.investForeignStock || 0) + (data.investFund || 0) + (data.investOther || 0)
      const total = cash + invest

      if (total === 0) return null

      const age = data.birth_date ? calculateAge(data.birth_date) : 40
      const monthlyExpense = data.livingExpenses || 0
      const investRatio = Math.round((invest / total) * 100)

      // "100 - 나이" 룰
      const recommendedStockRatio = Math.max(20, 100 - age)
      let message = `총 ${formatMoney(total)}. 투자 비중 ${investRatio}%.`

      // 비상금 체크
      if (monthlyExpense > 0) {
        const emergencyMonths = Math.round(cash / monthlyExpense)
        if (emergencyMonths < 3) {
          message += ` 비상금 ${emergencyMonths}개월치로 부족.`
        } else if (emergencyMonths >= 6) {
          message += ` 비상금 충분.`
        }
      }

      // 투자 비중 조언
      if (investRatio < recommendedStockRatio - 10) {
        message += ` 투자 비중을 높이는 것을 고려하세요.`
      }

      return message
    },
  },

  // 11. 부채
  debt: {
    title: '부채 관리',
    description: '상환 우선순위: 1.카드론(20%+) 2.캐피탈(10%+) 3.신용대출(5-8%) 4.주담대(3-5%). 금리 5% 이상은 상환 우선.',
    insights: (data) => {
      const otherDebts = data.debts.reduce((sum, d) => sum + (d.amount || 0), 0)
      const housingLoan = data.housingLoan || 0
      const totalDebt = otherDebts + housingLoan

      if (totalDebt === 0) {
        if (data.hasNoDebt) return '부채 없음. 재무적으로 건전한 상태입니다.'
        return null
      }

      const annualIncome = getMonthlyIncome(data) * 12
      const dti = annualIncome > 0 ? Math.round((totalDebt / annualIncome) * 100) : 0

      // 고금리 부채 확인
      const highRateDebts = data.debts.filter(d => (d.rate || 0) >= 5)
      const veryHighRateDebts = data.debts.filter(d => (d.rate || 0) >= 10)

      let message = `총 부채 ${formatMoney(totalDebt)}.`

      if (annualIncome > 0) {
        const status = dti <= 100 ? '양호' : dti <= 200 ? '주의' : '위험'
        message += ` 연소득 대비 ${dti}% [${status}].`
      }

      if (veryHighRateDebts.length > 0) {
        message += ' 10%+ 고금리 부채 즉시 상환 권장.'
      } else if (highRateDebts.length > 0) {
        message += ' 5%+ 부채 우선 상환 고려.'
      }

      return message
    },
  },

  // 12. 국민연금
  national_pension: {
    title: '국민연금 (1층)',
    description: '평생 지급, 물가 연동. nps.or.kr에서 확인. 60세 조기수령 시 30% 감액, 70세 연기수령 시 36% 증액.',
    insights: (data) => {
      if (!data.nationalPension) {
        return '국민연금공단(nps.or.kr) > 내 연금 알아보기에서 예상연금을 확인하세요.'
      }

      const monthlyIncome = getMonthlyIncome(data)
      let message = `예상 월 ${formatMoney(data.nationalPension)}.`

      if (monthlyIncome > 0) {
        const rate = Math.round((data.nationalPension / monthlyIncome) * 100)
        message += ` 소득대체율 ${rate}%.`

        if (rate < 20) {
          message += ' 개인연금으로 보완 필요.'
        } else if (rate >= 40) {
          message += ' 양호한 수준입니다.'
        }
      }

      return message
    },
  },

  // 13. 퇴직연금
  retirement_pension: {
    title: '퇴직연금 (2층)',
    description: 'DC형은 직접 운용(TDF 권장). DB형은 퇴직 시 평균임금x근속연수. 급여명세서 또는 인사팀에서 확인하세요.',
    insights: (data) => {
      if (!data.retirementPensionBalance) {
        return 'DC형: 직접 운용. DB형: 회사가 운용. 유형을 확인하세요.'
      }

      const balance = data.retirementPensionBalance
      const age = data.birth_date ? calculateAge(data.birth_date) : 40
      const retirementAge = data.target_retirement_age || 60
      const yearsToRetirement = Math.max(0, retirementAge - age)

      // 수익률별 예상 잔액
      const lowRate = Math.round(balance * Math.pow(1.02, yearsToRetirement))  // 예금 2%
      const highRate = Math.round(balance * Math.pow(1.07, yearsToRetirement)) // TDF 7%
      const difference = highRate - lowRate

      if (yearsToRetirement > 0 && difference > 0) {
        return `현재 ${formatMoney(balance)}. TDF 운용 시 ${yearsToRetirement}년 후 +${formatMoney(difference)} 차이.`
      }

      const monthlyPension = Math.round(balance / (20 * 12))
      return `현재 ${formatMoney(balance)}. 20년 수령 시 월 ${formatMoney(monthlyPension)} 예상.`
    },
  },

  // 14. 개인연금
  personal_pension: {
    title: '개인연금 (3층)',
    description: '연금저축 600만원 + IRP 300만원 = 연 900만원 납입 시 최대 148.5만원 세금 환급 (총급여 5,500만원 이하 기준).',
    insights: (data) => {
      const irp = data.irpBalance || 0
      const pensionSavings = data.pensionSavingsBalance || 0
      const isa = data.isaBalance || 0
      const total = irp + pensionSavings + isa

      if (total === 0) {
        const annualIncome = getMonthlyIncome(data) * 12
        const creditRate = annualIncome <= 5500 ? 16.5 : 13.2
        const maxCredit = Math.round(900 * (creditRate / 100))
        return `연 900만원 납입 시 ${formatMoney(maxCredit)} 환급. 지금 시작하세요.`
      }

      // 세금 환급 효과 계산
      const age = data.birth_date ? calculateAge(data.birth_date) : 40
      const retirementAge = data.target_retirement_age || 60
      const yearsToRetirement = Math.max(0, retirementAge - age)

      if (yearsToRetirement > 0) {
        // 연 900만원 납입 가정, 5% 수익률 (만원 단위)
        const annualContribution = 900
        const projectedBalance = total + (annualContribution * yearsToRetirement)
        return `현재 ${formatMoney(total)}. ${yearsToRetirement}년 후 예상 ${formatMoney(projectedBalance)}+ (연 900만원 납입 시).`
      }

      const monthlyPension = Math.round(total / (20 * 12))
      return `총 ${formatMoney(total)}. 20년 수령 시 월 ${formatMoney(monthlyPension)} 예상.`
    },
  },
}

// 현재 활성 행에 맞는 TIP 콘텐츠 가져오기
export function getTipContent(activeRow: RowId, activeSection: SectionId, data?: OnboardingData): TipContent {
  const rawTip = rowTips[activeRow] || sectionTips[activeSection]

  // title이 함수인 경우 실행해서 문자열로 변환
  const title = typeof rawTip.title === 'function' && data
    ? rawTip.title(data)
    : typeof rawTip.title === 'string'
      ? rawTip.title
      : '정보 입력'

  return {
    title,
    description: rawTip.description,
    insights: rawTip.insights,
  }
}
