import type { OnboardingData } from '@/types'
import type { DynamicTip } from './types'

// 나이 계산 헬퍼
function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// 금액 포맷 헬퍼 (만원 단위 입력 기준)
// 입력: 만원 단위 (10000 = 1억, 100 = 100만원)
function formatMoney(amount: number): string {
  if (amount === 0) return '0만원'

  if (amount >= 10000) {
    const billions = Math.floor(amount / 10000)
    const remainder = amount % 10000
    if (remainder > 0) {
      return `${billions}억 ${Math.round(remainder).toLocaleString()}만원`
    }
    return `${billions}억`
  }

  return `${Math.round(amount).toLocaleString()}만원`
}

// 월 단위로 환산하는 헬퍼
function toMonthly(amount: number | null, frequency: 'monthly' | 'yearly'): number {
  if (amount === null) return 0
  return frequency === 'yearly' ? Math.round(amount / 12) : amount
}

// 행별 개인화 TIP 생성 함수
export function getRowTip(rowId: string, data: OnboardingData): DynamicTip {
  const age = calculateAge(data.birth_date)
  const spouseAge = data.spouse?.birth_date ? calculateAge(data.spouse.birth_date) : null
  const lifeExpectancy = 90
  const retirementYears = lifeExpectancy - data.target_retirement_age
  const yearsToRetirement = age ? data.target_retirement_age - age : null

  switch (rowId) {
    case 'name':
      return {
        title: '재무 분석을 시작합니다',
        description: '이름을 입력하면 맞춤형 분석이 시작돼요. 입력하신 모든 정보는 기기에만 저장되며, 외부로 전송되지 않습니다.',
        stat: '5분',
        statLabel: '평균 소요 시간',
        insight: '재무 계획을 세운 사람은 그렇지 않은 사람보다 자산을 2배 더 빨리 모읍니다.',
      }

    case 'birth_date':
      // 배우자 정보가 완료된 경우
      if (data.isMarried && spouseAge && age) {
        const ageDiff = age - spouseAge
        const olderSpouse = ageDiff > 0 ? '본인' : '배우자'
        const youngerSpouse = ageDiff > 0 ? '배우자' : '본인'
        const absAgeDiff = Math.abs(ageDiff)

        let retirementTiming = ''
        if (absAgeDiff <= 2) {
          retirementTiming = '비슷한 나이라 함께 은퇴를 계획하기 좋아요.'
        } else if (absAgeDiff <= 5) {
          retirementTiming = `${olderSpouse}이 먼저 은퇴해도 ${youngerSpouse}의 소득이 있어 안정적이에요.`
        } else {
          retirementTiming = `나이 차이가 있어 은퇴 시기를 신중히 조율해야 해요.`
        }

        return {
          title: '함께라서 더 든든해요',
          description: `${retirementTiming} 부부가 함께 재무 목표를 세우면 달성 확률이 2배 높아집니다.`,
          stat: '월 277만원',
          statLabel: '부부 적정 노후 생활비',
          insight: '맞벌이 부부는 한 명 소득으로 생활, 다른 소득은 저축하는 전략이 효과적이에요.',
        }
      }

      // 배우자 없음 선택한 경우
      if (data.isMarried === false && age) {
        const remainingYears = lifeExpectancy - age
        return {
          title: '1인 가구 재무 전략',
          description: '1인 가구는 모든 결정을 스스로 할 수 있는 장점이 있어요. 반면 소득 중단 리스크에 더 취약하니 비상금과 보험이 중요합니다.',
          stat: '월 177만원',
          statLabel: '1인 적정 노후 생활비',
          insight: '1인 가구는 부부 대비 은퇴자금이 36% 정도 줄어들어요.',
        }
      }

      // 본인 생년월일만 입력된 경우
      if (data.name && age) {
        const remainingYears = lifeExpectancy - age
        const birthYear = new Date(data.birth_date).getFullYear()

        // 세대별 특성 분석
        let generationInfo = ''
        let financialAdvice = ''
        let keyInsight = ''

        if (birthYear >= 1997) {
          generationInfo = 'Z세대는 디지털 금융에 익숙해요.'
          financialAdvice = '일찍 시작하는 것이 최고의 전략이에요.'
          keyInsight = '지금 시작하면 복리의 마법을 최대한 누릴 수 있어요.'
        } else if (birthYear >= 1981) {
          generationInfo = '밀레니얼 세대는 부동산과 금융자산의 균형이 중요해요.'
          financialAdvice = age < 35 ? '아직 공격적인 투자가 가능한 시기예요.' : '자산 증식의 핵심 시기예요.'
          keyInsight = '지금부터 10년이 자산 형성의 골든타임이에요.'
        } else if (birthYear >= 1965) {
          generationInfo = 'X세대는 은퇴 준비 마무리 단계예요.'
          financialAdvice = '리스크 관리와 함께 꾸준한 적립을 병행하세요.'
          keyInsight = '연금 수령 전략과 자산 인출 순서를 미리 계획하세요.'
        } else {
          generationInfo = '베이비부머 세대는 자산 보존이 핵심이에요.'
          financialAdvice = '안정적인 현금흐름에 집중하세요.'
          keyInsight = '주택연금, 즉시연금 등 연금화 전략을 검토해보세요.'
        }

        return {
          title: `${data.name}님, ${age}세`,
          description: `${generationInfo} ${financialAdvice}`,
          stat: `${remainingYears}년`,
          statLabel: '기대수명까지',
          insight: keyInsight,
        }
      }

      return {
        title: '생년월일을 알려주세요',
        description: '나이에 따라 투자 전략, 위험 허용도, 은퇴 준비 방법이 완전히 달라져요. 맞춤형 분석을 위해 정확한 생년월일이 필요합니다.',
        stat: '90세',
        statLabel: '기대수명',
        insight: '한국인의 기대수명은 계속 늘어나고 있어요. 100세 시대를 준비하세요.',
      }

    case 'children':
      const childCount = data.children.length
      const childAges = data.children
        .map(c => c.birth_date ? calculateAge(c.birth_date) : null)
        .filter((a): a is number => a !== null)

      if (childCount > 0 && childAges.length > 0) {
        const youngestAge = Math.min(...childAges)
        const oldestAge = Math.max(...childAges)
        const yearsToIndependence = Math.max(0, 25 - youngestAge)

        // 자녀 교육비 예상
        const educationCostPerChild = 300000000 // 1인당 약 3억원 (0~22세)
        const totalEducationCost = childCount * educationCostPerChild

        // 자녀 나이대별 조언
        let stageAdvice = ''
        let financialImpact = ''

        if (youngestAge < 7) {
          stageAdvice = '영유아 시기는 육아비용이 크지만, 교육비 폭탄은 아직이에요.'
          financialImpact = '지금부터 교육비 전용 저축을 시작하세요. 월 50만원씩 18년 적립하면 약 1.5억원이 됩니다.'
        } else if (youngestAge < 13) {
          stageAdvice = '초등학생 시기는 학원비가 본격적으로 시작돼요.'
          financialImpact = `평균 월 80~150만원의 교육비가 예상됩니다. ${yearsToIndependence}년 후 자녀 독립 시 은퇴자금 집중 저축이 가능해져요.`
        } else if (youngestAge < 19) {
          stageAdvice = '중고등학생 시기는 교육비 지출의 피크예요.'
          financialImpact = '월 150~250만원의 교육비와 대학 등록금을 미리 준비하세요. 학자금 대출보다 사전 저축이 유리합니다.'
        } else {
          stageAdvice = '대학생/성인 자녀는 곧 독립할 시기예요.'
          financialImpact = '자녀 독립 후 남는 금액을 은퇴자금으로 전환하세요. 소위 "제2의 저축기"가 시작됩니다.'
        }

        return {
          title: `자녀 ${childCount}명, ${yearsToIndependence}년 후 독립 예상`,
          description: `${stageAdvice} ${financialImpact}`,
          stat: formatMoney(totalEducationCost),
          statLabel: `자녀 ${childCount}명 총 양육비 예상`,
          insight: oldestAge >= 20
            ? '성인 자녀의 결혼 자금까지 고려하면 1인당 5천만~1억원이 추가로 필요해요.'
            : `막내가 25세가 되면 월 ${formatMoney(educationCostPerChild / 12 / 25)}의 여유가 생겨요.`,
        }
      }

      if (data.hasChildren === false) {
        return {
          title: '자녀 없음',
          description: '자녀 양육비가 없어 은퇴자금 마련에 유리해요. 다만 노후 간병과 돌봄에 대한 별도 준비가 필요합니다. 요양보험이나 간병 펀드를 고려해보세요.',
          stat: '약 3억원',
          statLabel: '자녀 1인당 평균 양육비',
          insight: '이 비용을 30년간 투자하면(연 7%) 약 10억원이 됩니다.',
        }
      }

      return {
        title: '자녀 정보를 입력하세요',
        description: '자녀의 나이에 따라 교육비 지출 패턴이 달라져요. 초등학교부터 대학교까지 평균 2억원 이상의 교육비가 필요합니다.',
        stat: '약 3억원',
        statLabel: '자녀 1인당 양육비 (0~22세)',
        insight: '자녀 독립 후 "제2의 저축기"가 시작돼요. 이때 은퇴자금을 집중적으로 모을 수 있습니다.',
      }

    case 'retirement_age':
      if (age && yearsToRetirement !== null) {
        const isSpouseRetiring = data.spouse?.retirement_age && data.spouse.retirement_age > 0
        const spouseRetirementAge = data.spouse?.retirement_age || 0

        // 은퇴 준비 단계 분석
        let stage = ''
        let actionItems = ''
        let riskProfile = ''

        if (yearsToRetirement > 25) {
          stage = '장기 축적기'
          actionItems = '공격적인 투자가 가능해요. 주식/ETF 비중 70% 이상, 적극적인 성장주 투자를 고려하세요.'
          riskProfile = '시장 변동성을 견딜 시간이 충분해요. 단기 하락에 흔들리지 마세요.'
        } else if (yearsToRetirement > 15) {
          stage = '자산 증식기'
          actionItems = '균형 잡힌 포트폴리오로 전환할 시기예요. 주식 60%, 채권 30%, 현금 10% 비중을 고려하세요.'
          riskProfile = '수익률과 안정성의 균형이 필요해요.'
        } else if (yearsToRetirement > 5) {
          stage = '은퇴 준비기'
          actionItems = '리스크를 점진적으로 줄이세요. 배당주, 채권 비중을 높이고, 연금 수령 전략을 세워야 해요.'
          riskProfile = '원금 손실 위험을 줄이면서 인플레이션은 이겨야 해요.'
        } else if (yearsToRetirement > 0) {
          stage = '은퇴 직전'
          actionItems = '안정적인 현금흐름 확보가 우선이에요. 즉시연금, 채권, 배당주 중심으로 재편하세요.'
          riskProfile = '원금 보존이 최우선이에요. 큰 손실을 회복할 시간이 없습니다.'
        } else {
          stage = '은퇴 후'
          actionItems = '자산 인출 순서가 중요해요. 세금 효율적인 인출 전략을 세우세요.'
          riskProfile = '인플레이션만 이기면 돼요. 연 2~3% 실질수익률이 목표입니다.'
        }

        const spouseInfo = isSpouseRetiring && spouseAge
          ? ` 배우자는 ${spouseRetirementAge}세 은퇴 예정으로, ${Math.abs(data.target_retirement_age - spouseRetirementAge)}년 차이가 있어요.`
          : ''

        return {
          title: yearsToRetirement > 0 ? `은퇴까지 ${yearsToRetirement}년, ${stage}` : `은퇴 ${Math.abs(yearsToRetirement)}년차`,
          description: `${actionItems}${spouseInfo}`,
          stat: `${retirementYears}년`,
          statLabel: '은퇴 후 예상 기간',
          insight: riskProfile,
        }
      }
      return {
        title: '목표 은퇴 나이를 설정하세요',
        description: '은퇴 나이에 따라 필요한 자금과 저축률이 결정돼요. 한국인 평균 희망 은퇴 나이는 60세이지만, 실제 은퇴 나이는 평균 49세입니다.',
        stat: '60세',
        statLabel: '한국 평균 희망 은퇴 나이',
        insight: '일찍 은퇴할수록 더 많은 자금이 필요해요. 55세 은퇴는 65세 대비 2배의 자금이 필요합니다.',
      }

    case 'retirement_fund':
      const monthlyNeeded = data.isMarried ? 2770000 : 1770000
      const yearsAfterRetirement = lifeExpectancy - data.target_retirement_age
      const totalNeeded = monthlyNeeded * 12 * yearsAfterRetirement

      // 현재 목표 대비 분석
      const targetFund = data.target_retirement_fund || 0
      const fundGap = totalNeeded - targetFund
      const fundRatio = targetFund > 0 ? Math.round((targetFund / totalNeeded) * 100) : 0

      // 목표 달성을 위한 월 저축액 계산 (단순화)
      const monthsToRetirement = yearsToRetirement ? yearsToRetirement * 12 : 0
      const requiredMonthlySavings = monthsToRetirement > 0
        ? Math.round(targetFund / monthsToRetirement)
        : 0

      if (targetFund > 0) {
        let fundAnalysis = ''
        let actionAdvice = ''

        if (fundRatio >= 100) {
          fundAnalysis = '권장 은퇴자금 이상을 목표로 하고 계세요! 여유로운 노후가 기대됩니다.'
          actionAdvice = '여유 자금으로 여행, 취미 등 삶의 질을 높이는 계획도 세워보세요.'
        } else if (fundRatio >= 70) {
          fundAnalysis = '권장 수준에 근접한 목표예요. 국민연금과 퇴직연금을 합하면 충분할 수 있어요.'
          actionAdvice = '연금 수령액을 확인하고, 부족분만 개인 준비하세요.'
        } else if (fundRatio >= 50) {
          fundAnalysis = '권장 수준의 절반 정도예요. 저축률을 높이거나 은퇴 시기를 조정해보세요.'
          actionAdvice = yearsToRetirement && yearsToRetirement > 10
            ? '시간이 있으니 월 저축액을 늘리는 게 좋아요.'
            : '은퇴 후 파트타임 근무나 지출 절감을 계획하세요.'
        } else {
          fundAnalysis = '목표가 권장 수준보다 낮아요. 현실적인 재검토가 필요합니다.'
          actionAdvice = '지출을 줄이거나, 은퇴 나이를 늦추거나, 저축률을 높이는 방법이 있어요.'
        }

        return {
          title: `목표 ${formatMoney(targetFund)}, 권장의 ${fundRatio}%`,
          description: `${fundAnalysis} ${actionAdvice}`,
          stat: formatMoney(totalNeeded),
          statLabel: '권장 은퇴자금',
          insight: requiredMonthlySavings > 0
            ? `목표 달성을 위해 매월 약 ${formatMoney(requiredMonthlySavings)}의 저축이 필요해요.`
            : '국민연금(25%) + 퇴직연금(15%) + 개인 준비(60%)로 구성하세요.',
        }
      }

      return {
        title: '은퇴 자금 목표를 설정하세요',
        description: `${data.isMarried ? '부부' : '1인'} 기준 월 ${formatMoney(monthlyNeeded)}이 필요해요. ${yearsAfterRetirement}년간 생활하려면 총 ${formatMoney(totalNeeded)}이 필요합니다.`,
        stat: formatMoney(totalNeeded),
        statLabel: '예상 필요 은퇴자금',
        insight: '국민연금으로 약 25%만 충당돼요. 나머지 75%는 개인이 준비해야 합니다.',
      }

    case 'labor_income':
      // 근로 소득 계산 (월 기준으로 환산)
      const myMonthlyIncome = toMonthly(data.laborIncome, data.laborIncomeFrequency)
      const spouseMonthlyIncome = toMonthly(data.spouseLaborIncome, data.spouseLaborIncomeFrequency)
      const totalLaborIncome = myMonthlyIncome + spouseMonthlyIncome
      const hasSpouseIncome = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0

      if (totalLaborIncome > 0) {
        const annualIncome = totalLaborIncome * 12
        const incomeLevel = totalLaborIncome >= 10000000 ? '고소득' :
                            totalLaborIncome >= 5000000 ? '중상위' :
                            totalLaborIncome >= 3000000 ? '중위' : '일반'

        // 입력 주기 표시
        const myFreqLabel = data.laborIncomeFrequency === 'yearly' ? '(연봉 기준)' : ''
        const spouseFreqLabel = data.spouseLaborIncomeFrequency === 'yearly' ? '(연봉 기준)' : ''

        // 맞벌이 vs 외벌이 조언
        const workAdvice = hasSpouseIncome && spouseMonthlyIncome > 0
          ? `맞벌이 가정이시네요! 한 명 소득으로 생활하고 다른 소득을 저축하면 빠르게 자산을 늘릴 수 있어요.`
          : data.isMarried
            ? '외벌이 가정은 소득 중단 리스크가 있어요. 비상금을 충분히 확보하세요.'
            : '꾸준한 소득은 은퇴 준비의 기본이에요.'

        // 연봉 입력 시 추가 정보
        const freqInfo = (data.laborIncomeFrequency === 'yearly' || data.spouseLaborIncomeFrequency === 'yearly')
          ? ` ${myFreqLabel}${spouseFreqLabel}`
          : ''

        return {
          title: `월 ${formatMoney(totalLaborIncome)} 소득${freqInfo}`,
          description: `${incomeLevel} 수준이에요. ${workAdvice}`,
          stat: formatMoney(annualIncome),
          statLabel: '연간 총 근로소득',
          insight: '저축률 50%면 17년, 30%면 28년 후 은퇴 가능해요.',
        }
      }

      return {
        title: '근로 소득을 입력하세요',
        description: '세전 월급 또는 연봉을 입력해주세요. 주기를 클릭해서 월/년을 선택할 수 있어요.',
        stat: '월 350만원',
        statLabel: '한국 중위 소득',
        insight: '부부 합산 소득의 30% 이상을 저축하면 20년 안에 경제적 자유가 가능해요.',
      }

    case 'business_income':
      // 사업 소득 계산 (월 기준으로 환산)
      const myBusinessMonthly = toMonthly(data.businessIncome, data.businessIncomeFrequency)
      const spouseBusinessMonthly = toMonthly(data.spouseBusinessIncome, data.spouseBusinessIncomeFrequency)
      const totalBusinessIncome = myBusinessMonthly + spouseBusinessMonthly
      const hasSpouseBusinessIncome = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0

      if (totalBusinessIncome > 0) {
        const annualBusinessIncome = totalBusinessIncome * 12

        // 입력 주기 표시
        const myBizFreqLabel = data.businessIncomeFrequency === 'yearly' ? '(연간 기준)' : ''
        const spouseBizFreqLabel = data.spouseBusinessIncomeFrequency === 'yearly' ? '(연간 기준)' : ''

        const businessAdvice = hasSpouseBusinessIncome && spouseBusinessMonthly > 0
          ? '부부가 함께 사업소득이 있다면 세금 절감 전략이 중요해요. 소득 분산과 비용 처리를 잘 활용하세요.'
          : '사업소득은 변동성이 크므로 최소 6개월치 운영비를 비상금으로 확보하세요.'

        const freqBizInfo = (data.businessIncomeFrequency === 'yearly' || data.spouseBusinessIncomeFrequency === 'yearly')
          ? ` ${myBizFreqLabel}${spouseBizFreqLabel}`
          : ''

        return {
          title: `월 ${formatMoney(totalBusinessIncome)} 사업소득${freqBizInfo}`,
          description: `${businessAdvice}`,
          stat: formatMoney(annualBusinessIncome),
          statLabel: '연간 사업소득',
          insight: '사업소득자는 노란우산공제, 소기업소상공인공제 등을 통해 세금도 줄이고 퇴직금도 만들 수 있어요.',
        }
      }

      return {
        title: '사업 소득을 입력하세요',
        description: '자영업, 프리랜서, 부업 등 사업소득이 있다면 입력해주세요. 없으면 넘어가셔도 돼요.',
        stat: '연 500만원',
        statLabel: '소기업소상공인공제 세액공제 한도',
        insight: '사업소득이 있다면 노란우산공제 가입을 검토해보세요. 연 최대 500만원 세액공제가 가능해요.',
      }

    case 'living_expenses':
      // 생활비 계산 (월 기준으로 환산)
      const livingExpenseMonthly = toMonthly(data.livingExpenses, data.livingExpensesFrequency)

      // 전체 소득 계산 (근로 + 사업, 월 기준)
      const totalIncomeForLiving = toMonthly(data.laborIncome, data.laborIncomeFrequency) +
        toMonthly(data.spouseLaborIncome, data.spouseLaborIncomeFrequency) +
        toMonthly(data.businessIncome, data.businessIncomeFrequency) +
        toMonthly(data.spouseBusinessIncome, data.spouseBusinessIncomeFrequency)

      if (livingExpenseMonthly > 0) {
        const savingsAmount = totalIncomeForLiving - livingExpenseMonthly
        const savingsRate = totalIncomeForLiving > 0
          ? Math.round((savingsAmount / totalIncomeForLiving) * 100)
          : 0
        const expenseRatio = totalIncomeForLiving > 0
          ? Math.round((livingExpenseMonthly / totalIncomeForLiving) * 100)
          : 0

        // 연간 입력 시 표시
        const yearlyNote = data.livingExpensesFrequency === 'yearly' ? ' (연간 기준 월 환산)' : ''

        let savingsAdvice = ''
        if (savingsRate >= 50) {
          savingsAdvice = '상위 1% 저축률이에요. 17년 후 경제적 자유가 가능해요.'
        } else if (savingsRate >= 30) {
          savingsAdvice = '훌륭해요! 권장 저축률을 달성했어요.'
        } else if (savingsRate >= 20) {
          savingsAdvice = '괜찮아요. 조금만 더 줄이면 30%도 가능해요.'
        } else if (savingsRate >= 0) {
          savingsAdvice = '저축률을 높여보세요. 지출 점검이 필요해요.'
        } else {
          savingsAdvice = '지출이 소득을 초과해요. 즉시 지출 점검이 필요합니다.'
        }

        return {
          title: savingsRate >= 0 ? `저축률 ${savingsRate}%` : '지출 초과',
          description: `월 수입 ${formatMoney(totalIncomeForLiving)}, 생활비 ${formatMoney(livingExpenseMonthly)}${yearlyNote}. ${savingsAdvice}`,
          stat: formatMoney(Math.abs(savingsAmount)),
          statLabel: savingsRate >= 0 ? '월 저축 가능액' : '월 초과 지출',
          insight: expenseRatio <= 50
            ? '생활비 50% 이하는 이상적이에요. 저축과 투자에 여유가 있어요.'
            : '생활비 비중이 높아요. 불필요한 지출을 줄여보세요.',
        }
      }

      return {
        title: '생활비를 입력하세요',
        description: '주거비, 식비, 교통비, 보험료 등 모든 생활비를 합산해서 입력해주세요. 대시보드에서 세부 항목을 나눌 수 있어요.',
        stat: '50% 이하',
        statLabel: '권장 생활비 비율',
        insight: '저축률 30% 이상이면 28년, 50% 이상이면 17년 후 경제적 자유가 가능해요.',
      }

    default:
      return {
        title: '정보를 입력하세요',
        description: '입력하신 정보를 바탕으로 맞춤형 분석을 제공해드려요.',
      }
  }
}
