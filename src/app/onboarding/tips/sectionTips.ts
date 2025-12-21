import type { OnboardingData } from '@/types'
import type { SectionId } from '../components/SectionForm'
import type { DynamicTip, SuggestionGroup } from './types'

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

// 월 기준 합계 계산 (수입/지출용)
function calculateMonthlyTotal(
  items: Array<{ amount: number | null; frequency: string }>
): number {
  return items.reduce((sum, item) => {
    const amount = item.amount ?? 0
    if (item.frequency === 'yearly') return sum + amount / 12
    if (item.frequency === 'once') return sum // 일회성은 월 합계에 미포함
    return sum + amount // monthly
  }, 0)
}

// 단일 금액을 월 기준으로 환산
function toMonthly(amount: number | null, frequency: 'monthly' | 'yearly'): number {
  if (amount === null) return 0
  return frequency === 'yearly' ? Math.round(amount / 12) : amount
}

// 총액 계산 (자산/부채용)
function calculateTotalValue(
  items: Array<{ amount: number | null; frequency: string }>
): number {
  return items.reduce((sum, item) => {
    const amount = item.amount ?? 0
    if (item.frequency === 'monthly') return sum + amount * 12
    if (item.frequency === 'yearly') return sum + amount
    return sum + amount // once = 총액 그대로
  }, 0)
}

// 금액 포맷 헬퍼
function formatMoney(amount: number): string {
  if (amount >= 100000000) {
    const eok = Math.floor(amount / 100000000)
    const remainder = amount % 100000000
    if (remainder >= 10000) {
      const man = Math.floor(remainder / 10000)
      return `${eok}억 ${man.toLocaleString()}만`
    }
    return `${eok}억`
  } else if (amount >= 10000) {
    const man = Math.floor(amount / 10000)
    return `${man.toLocaleString()}만`
  }
  return `${amount.toLocaleString()}`
}

// 섹션별 동적 팁 생성 함수
export function getDynamicTip(
  activeSection: SectionId,
  data: OnboardingData
): DynamicTip {
  const age = calculateAge(data.birth_date)
  const spouseAge = data.spouse?.birth_date
    ? calculateAge(data.spouse.birth_date)
    : null
  // 월 기준 합계 (수입/지출/연금)
  const totalIncome = calculateMonthlyTotal(data.incomes)
  const totalExpense = calculateMonthlyTotal(data.expenses)
  const totalPension = calculateMonthlyTotal(data.pensions)
  // 총액 기준 (자산/부채/부동산)
  const totalAsset = calculateTotalValue(data.assets)
  const totalDebt = calculateTotalValue(data.debts)
  const totalRealEstate = calculateTotalValue(data.realEstates)
  const monthlySavings = totalIncome - totalExpense
  const yearsToRetirement = age ? data.target_retirement_age - age : null

  switch (activeSection) {
    case 'basic':
      // 기본 정보 섹션 - 이름, 생년월일, 배우자, 은퇴 목표
      if (age) {
        const lifeExpectancy = 90
        const remainingLife = lifeExpectancy - age
        const retirementYears = lifeExpectancy - data.target_retirement_age
        return {
          title: data.name
            ? `${data.name}님, 반갑습니다`
            : '기본 정보를 입력하세요',
          description: data.name
            ? `${age}세, 아직 늦지 않았어요. 기대수명 90세 기준, 앞으로 약 ${remainingLife}년의 시간이 있습니다. 은퇴 후에도 ${retirementYears}년을 준비해야 해요.`
            : '은퇴 준비의 첫 걸음입니다. 당신만을 위한 맞춤 분석을 시작할게요.',
          stat: data.name ? `${remainingLife}년` : '상위 30%',
          statLabel: data.name ? '앞으로의 시간' : '은퇴 준비를 시작한 사람',
          insight:
            age < 40
              ? '30대는 복리의 힘을 가장 크게 누릴 수 있는 황금기입니다.'
              : age < 50
              ? '40대는 자산 증식의 마지막 골든타임입니다.'
              : '50대부터는 안정적인 자산 보존이 핵심입니다.',
        }
      }
      if (data.isMarried && spouseAge) {
        const ageDiff = age ? age - spouseAge : 0
        return {
          title: '함께라서 더 든든해요',
          description: `부부가 함께 은퇴를 준비하면 성공 확률이 2배 높아집니다. ${
            ageDiff > 0
              ? '배우자가 더 젊으니 은퇴 시기를 맞추는 것이 중요해요.'
              : ageDiff < 0
              ? '배우자가 먼저 은퇴할 수 있으니 미리 계획하세요.'
              : '비슷한 나이라 함께 계획하기 좋아요.'
          }`,
          stat: '월 277만원',
          statLabel: '부부 적정 노후 생활비',
        }
      }
      return {
        title: '기본 정보를 입력하세요',
        description:
          '은퇴 준비의 첫 걸음입니다. 이름, 생년월일, 배우자 정보와 은퇴 목표를 입력해주세요.',
        stat: '3분',
        statLabel: '평균 소요 시간',
      }

    case 'income':
      // 소득 및 지출 섹션 - 주기에 따라 월 기준으로 환산
      // 근로소득
      const laborIncomeTotal = toMonthly(data.laborIncome, data.laborIncomeFrequency) +
        toMonthly(data.spouseLaborIncome, data.spouseLaborIncomeFrequency)
      // 사업소득
      const businessIncomeTotal = toMonthly(data.businessIncome, data.businessIncomeFrequency) +
        toMonthly(data.spouseBusinessIncome, data.spouseBusinessIncomeFrequency)
      // 총 소득
      const totalMonthlyIncome = laborIncomeTotal + businessIncomeTotal
      const fixedExpenseTotal = toMonthly(data.fixedExpenses, data.fixedExpensesFrequency) +
        (data.additionalFixedExpenses?.reduce(
          (sum, item) => sum + toMonthly(item.amount, item.frequency || 'monthly'), 0
        ) ?? 0)
      const variableExpenseTotal = toMonthly(data.variableExpenses, data.variableExpensesFrequency) +
        (data.additionalVariableExpenses?.reduce(
          (sum, item) => sum + toMonthly(item.amount, item.frequency || 'monthly'), 0
        ) ?? 0)
      const expenseTotal = fixedExpenseTotal + variableExpenseTotal
      const monthlySavingsNew = totalMonthlyIncome - expenseTotal

      const incomeGuides = [
        '월급 또는 연봉으로 입력하세요. 주기(월/년)를 클릭해 변경할 수 있어요.',
        '사업소득이 없으면 빈칸으로 두세요.',
        '0원인 항목은 비워두시면 됩니다.',
      ]

      // 고정 지출 항목 설명
      const fixedExpenseDescriptions = [
        '주거비: 월세·관리비 등',
        '보험료: 건강·자동차·연금 보험',
        '교육비: 학원비, 자녀 등록금',
        '구독 서비스: OTT·음악·멤버십',
        '용돈: 부모님/자녀에게 지급',
      ]

      // 변동 지출 항목 설명
      const variableExpenseDescriptions = [
        '생활·식비: 장보기·외식·생필품',
        '패션·개인관리비: 의류·미용 등',
        '교통비: 기름값·대중교통비',
        '교육·자기계발비: 본인 성장 관련',
        '건강·여가비: 병원비·취미·문화활동',
      ]

      const expenseGroups: SuggestionGroup[] = [
        { label: '고정 지출', items: fixedExpenseDescriptions },
        { label: '변동 지출', items: variableExpenseDescriptions },
      ]

      if (totalMonthlyIncome > 0 && expenseTotal > 0) {
        const savingsRate = Math.round((monthlySavingsNew / totalMonthlyIncome) * 100)
        const fixedRatio = Math.round((fixedExpenseTotal / totalMonthlyIncome) * 100)
        const variableRatio = Math.round((variableExpenseTotal / totalMonthlyIncome) * 100)

        let title = ''
        let advice = ''
        if (savingsRate >= 50) {
          title = '🔥 상위 1% 저축률!'
          advice = '경제적 자유까지 약 17년! 이 속도를 유지하세요.'
        } else if (savingsRate >= 30) {
          title = '훌륭한 저축률이에요!'
          advice = '권장 저축률을 달성했어요. 꾸준히 유지하세요.'
        } else if (savingsRate >= 20) {
          title = '괜찮은 편이에요'
          advice = '조금만 더 줄이면 30% 달성! 변동 지출을 점검해보세요.'
        } else if (savingsRate >= 0) {
          title = '저축률 개선이 필요해요'
          advice = '변동 지출에서 줄일 항목을 찾아보세요.'
        } else {
          title = '⚠️ 지출 초과'
          advice = '지출이 소득을 초과해요. 즉시 점검이 필요합니다.'
        }

        // 소득 구성 설명
        const incomeBreakdown = []
        if (laborIncomeTotal > 0) incomeBreakdown.push(`근로 ${formatMoney(laborIncomeTotal)}`)
        if (businessIncomeTotal > 0) incomeBreakdown.push(`사업 ${formatMoney(businessIncomeTotal)}`)
        const incomeDetail = incomeBreakdown.length > 1 ? ` (${incomeBreakdown.join(' + ')})` : ''

        return {
          title,
          description: `월 소득 ${formatMoney(totalMonthlyIncome)}${incomeDetail} 중 고정 ${fixedRatio}%, 변동 ${variableRatio}% 지출. ${advice}`,
          stat: `${savingsRate}%`,
          statLabel: '현재 저축률',
          insight: monthlySavingsNew >= 0
            ? `매월 ${formatMoney(monthlySavingsNew)} 저축 가능`
            : `매월 ${formatMoney(Math.abs(monthlySavingsNew))} 초과 지출`,
          guides: incomeGuides,
          suggestionGroups: expenseGroups,
        }
      }

      if (totalMonthlyIncome > 0) {
        const hasSpouse = data.spouse?.retirement_age != null && data.spouse.retirement_age > 0
        const hasMultipleIncomeSources = [laborIncomeTotal > 0, businessIncomeTotal > 0].filter(Boolean).length > 1
        return {
          title: `월 ${formatMoney(totalMonthlyIncome)} 소득`,
          description: hasMultipleIncomeSources
            ? `다양한 소득원이 있네요! 이제 지출을 정리하면 저축률을 알 수 있어요.`
            : hasSpouse && data.spouseLaborIncome && data.spouseLaborIncome > 0
              ? `맞벌이 가정이시네요! 이제 지출을 정리하면 저축률을 알 수 있어요.`
              : '이제 지출을 정리하면 얼마를 저축할 수 있는지 알 수 있어요.',
          stat: `연 ${formatMoney(totalMonthlyIncome * 12)}`,
          statLabel: '연간 총 소득',
          insight: '고정 지출 → 변동 지출 순으로 입력하세요.',
          guides: incomeGuides,
          suggestionGroups: expenseGroups,
        }
      }

      return {
        title: '소득과 지출을 정리하세요',
        description: '근로 소득, 고정 지출, 변동 지출 순으로 입력해보세요. 저축률이 은퇴 시기를 결정합니다.',
        stat: '30% 이상',
        statLabel: '권장 저축률',
        insight: '저축률 50%면 17년, 30%면 28년 후 은퇴 가능',
        guides: incomeGuides,
        suggestionGroups: expenseGroups,
      }

    case 'savings':
      // 저축 및 투자 섹션
      const savingsInAssets = data.assets.filter(
        (item) =>
          ['예금', '적금', 'CMA', 'MMF', '저축', '비상금'].some((k) =>
            item.name.includes(k)
          ) || item.subcategory === '저축'
      )
      const investmentInAssets = data.assets.filter(
        (item) =>
          ['주식', 'ETF', '펀드', '채권', '암호화폐', '코인', '투자'].some(
            (k) => item.name.includes(k)
          ) || item.subcategory === '투자'
      )
      const savingsAmount = calculateTotalValue(savingsInAssets)
      const investmentAmount = calculateTotalValue(investmentInAssets)
      const totalSavingsInvestment = savingsAmount + investmentAmount

      const savingsGuides = [
        '비상금은 월 생활비의 3~6개월치를 예금으로 보유하세요.',
        '저축은 안전자산, 투자는 위험자산으로 분류됩니다.',
        '나이가 젊을수록 투자 비중을 높여도 괜찮아요.',
      ]
      const savingsSuggestions = ['예금', '적금', 'CMA', 'MMF', '비상금']
      const investmentSuggestions = ['주식', 'ETF', '펀드', '채권', '암호화폐']
      const savingsExpenseGroups: SuggestionGroup[] = [
        { label: '안전 자산 (저축)', items: savingsSuggestions },
        { label: '위험 자산 (투자)', items: investmentSuggestions },
      ]

      if (totalSavingsInvestment > 0) {
        const savingsRatio =
          totalSavingsInvestment > 0
            ? Math.round((savingsAmount / totalSavingsInvestment) * 100)
            : 0
        const investmentRatio = 100 - savingsRatio
        const recommendedInvestmentRatio = age ? Math.max(0, 100 - age) : 60 // 100 - 나이 법칙

        return {
          title: `저축 ${savingsRatio}% : 투자 ${investmentRatio}%`,
          description: age
            ? `${age}세 기준 권장 투자 비중은 ${recommendedInvestmentRatio}%입니다. ${
                investmentRatio < recommendedInvestmentRatio - 10
                  ? '투자 비중을 늘려 수익률을 높여보세요.'
                  : investmentRatio > recommendedInvestmentRatio + 10
                  ? '안전자산 비중을 늘려 리스크를 줄이세요.'
                  : '적절한 비율이에요!'
              }`
            : '저축과 투자의 균형이 중요합니다.',
          stat: formatMoney(totalSavingsInvestment),
          statLabel: '저축 + 투자 총액',
          insight: `100 - 나이 = 투자 비중 (${age}세 → ${recommendedInvestmentRatio}% 투자 권장)`,
          guides: savingsGuides,
          suggestionGroups: savingsExpenseGroups,
        }
      }
      return {
        title: '저축과 투자를 정리하세요',
        description:
          '안전자산(예금, 적금)과 위험자산(주식, ETF)을 구분해서 입력하세요. 자산 배분이 수익률을 결정합니다.',
        stat: '72의 법칙',
        statLabel: '수익률 ÷ 72 = 원금 2배 기간',
        insight: '연 7% 수익률이면 약 10년 후 원금이 2배가 됩니다.',
        guides: savingsGuides,
        suggestionGroups: savingsExpenseGroups,
      }

    case 'realEstate':
      const realEstateGuides = [
        '현재 시세 기준으로 입력하세요. KB시세나 호가 평균을 참고하세요.',
        '전세보증금도 내 자산입니다. 빼먹지 마세요.',
        '부동산 비중이 80% 이상이면 유동성 리스크가 있어요.',
      ]
      const realEstateGroups: SuggestionGroup[] = [
        {
          label: '주거용',
          items: ['아파트', '빌라/주택', '오피스텔', '전세보증금'],
        },
        { label: '투자용', items: ['상가', '토지', '분양권', '재건축/재개발'] },
      ]
      const totalAllAssets = totalRealEstate + totalAsset
      const realEstateRatio =
        totalAllAssets > 0
          ? Math.round((totalRealEstate / totalAllAssets) * 100)
          : 0

      if (totalRealEstate > 0) {
        const isOverConcentrated = realEstateRatio > 80
        const isUnderweight = realEstateRatio < 30
        return {
          title: isOverConcentrated
            ? '부동산 집중도가 높아요'
            : isUnderweight
            ? '금융자산 중심의 포트폴리오'
            : '균형 잡힌 자산 구성이에요',
          description: `전체 자산 중 부동산 ${realEstateRatio}%입니다. ${
            isOverConcentrated
              ? '유동성 확보를 위해 일부 금융자산 전환을 고려해보세요. 급한 돈이 필요할 때 부동산은 즉시 현금화가 어렵습니다.'
              : isUnderweight
              ? '한국에서 부동산은 인플레이션 헷지 수단입니다. 거주 안정성도 고려해보세요.'
              : '부동산과 금융자산이 적절히 분산되어 있어요.'
          }`,
          stat: formatMoney(totalRealEstate),
          statLabel: '총 부동산 자산',
          insight:
            age && age >= 50
              ? '50대 이후에는 주택연금 활용도 고려해보세요. 9억 이하 주택은 가입 가능합니다.'
              : '실거주 1채 + 투자용 자산 분산이 일반적인 전략입니다.',
          guides: realEstateGuides,
          suggestionGroups: realEstateGroups,
        }
      }
      return {
        title: '부동산 자산을 정리하세요',
        description:
          '아파트, 빌라, 상가, 토지 등 보유한 부동산을 현재 시세 기준으로 입력하세요. 전세보증금도 자산에 포함됩니다.',
        stat: '74%',
        statLabel: '한국 가구 자산 중 부동산 비중',
        insight: '한국 가구 평균 부동산 비중은 74%로 OECD 최고 수준입니다.',
        guides: realEstateGuides,
        suggestionGroups: realEstateGroups,
      }

    case 'asset':
      const assetGuides = [
        '현재 평가액 기준으로 입력하세요. 주식/펀드는 증권사 앱에서 확인하세요.',
        '자동차는 중고차 시세를 기준으로 입력하세요.',
        '보험 해지환급금도 자산입니다. 보험사에 문의하면 알 수 있어요.',
      ]
      const assetGroups: SuggestionGroup[] = [
        {
          label: '안전 자산',
          items: ['예금/적금', '채권', '금/귀금속', '보험 해지환급금'],
        },
        {
          label: '위험 자산',
          items: ['주식', 'ETF/펀드', '암호화폐', '기타자산'],
        },
        { label: '실물 자산', items: ['자동차', '귀금속', '기타 실물'] },
      ]

      // 안전자산 vs 위험자산 비율 분석
      const riskyAssets = data.assets.filter((item) =>
        ['주식', 'ETF', '펀드', '코인', '암호화폐'].some((k) =>
          item.name.includes(k)
        )
      )
      const riskyAmount = calculateTotalValue(riskyAssets)
      const riskyRatio =
        totalAsset > 0 ? Math.round((riskyAmount / totalAsset) * 100) : 0

      if (totalAsset > 0) {
        const assetToIncome =
          totalIncome > 0
            ? Math.round((totalAsset / (totalIncome * 12)) * 10) / 10
            : 0
        const netWorth = totalAsset + totalRealEstate - totalDebt
        const recommendedRiskyRatio = age ? Math.max(0, 100 - age) : 60

        return {
          title:
            assetToIncome >= 10
              ? '훌륭한 자산 규모입니다!'
              : assetToIncome >= 5
              ? '꾸준히 자산이 쌓이고 있어요'
              : '자산 형성 중이에요',
          description: `연소득 대비 ${assetToIncome}배의 금융자산을 보유 중이에요. ${
            assetToIncome < 5
              ? '은퇴 시점까지 연소득의 10배 이상을 목표로 해보세요.'
              : assetToIncome < 10
              ? '좋은 진전이에요! 지금 페이스를 유지하세요.'
              : '훌륭합니다. 자산 배분 최적화에 집중하세요.'
          }`,
          stat: formatMoney(netWorth),
          statLabel: '순자산 (자산 - 부채)',
          insight: age
            ? `${age}세 권장 위험자산 비중: ${recommendedRiskyRatio}% / 현재: ${riskyRatio}%`
            : `안전:위험 자산 비율 = ${100 - riskyRatio}%:${riskyRatio}%`,
          guides: assetGuides,
          suggestionGroups: assetGroups,
        }
      }
      return {
        title: '금융자산을 정리하세요',
        description:
          '예금, 적금, 주식, 펀드 등 모든 금융자산을 입력하세요. 인플레이션(연 2.5%)을 이기려면 적절한 위험자산 배분이 필요합니다.',
        stat: '연소득 10배',
        statLabel: '은퇴 전 목표 자산',
        insight: '72의 법칙: 수익률 ÷ 72 = 원금 2배 기간 (예: 연 7% → 약 10년)',
        guides: assetGuides,
        suggestionGroups: assetGroups,
      }

    case 'debt':
      const debtGuides = [
        '남은 원금 기준으로 입력하세요.',
        '금리가 높은 부채부터 먼저 상환하세요. (카드론 > 신용대출 > 담보대출)',
        '주택담보대출은 자산과 연결되어 있어 단순 비교가 어렵습니다.',
      ]
      const debtGroups: SuggestionGroup[] = [
        {
          label: '담보 대출',
          items: ['주택담보대출', '전세대출', '자동차할부'],
        },
        {
          label: '신용 대출',
          items: ['신용대출', '학자금대출', '카드대출', '마이너스통장'],
        },
      ]

      // 대출 유형별 분석
      const securedDebt = data.debts.filter((item) =>
        ['담보', '전세', '주택', '자동차'].some((k) => item.name.includes(k))
      )
      const unsecuredDebt = data.debts.filter((item) =>
        ['신용', '카드', '학자금', '마이너스'].some((k) =>
          item.name.includes(k)
        )
      )
      const securedAmount = calculateTotalValue(securedDebt)
      const unsecuredAmount = calculateTotalValue(unsecuredDebt)

      if (totalDebt > 0) {
        const debtToAsset =
          totalAsset + totalRealEstate > 0
            ? Math.round((totalDebt / (totalAsset + totalRealEstate)) * 100)
            : 0
        const debtToIncome =
          totalIncome > 0
            ? Math.round((totalDebt / (totalIncome * 12)) * 10) / 10
            : 0
        const hasHighInterestDebt = unsecuredAmount > 0
        const netWorth = totalAsset + totalRealEstate - totalDebt

        return {
          title:
            netWorth < 0
              ? '부채 상환이 우선이에요'
              : debtToAsset > 50
              ? '부채 비중이 높은 편이에요'
              : '관리 가능한 수준이에요',
          description:
            hasHighInterestDebt && unsecuredAmount > 10000000
              ? `고금리 신용대출 ${formatMoney(
                  unsecuredAmount
                )}원이 있어요. 연 10% 이상의 이자를 내고 있다면 투자보다 상환이 먼저입니다.`
              : `총 부채 ${formatMoney(totalDebt)}원 중 담보대출 ${formatMoney(
                  securedAmount
                )}원입니다. ${
                  yearsToRetirement && yearsToRetirement > 0
                    ? `은퇴까지 ${yearsToRetirement}년, 부채 정리 계획을 세워보세요.`
                    : '은퇴 전 부채 제로를 목표로 하세요.'
                }`,
          stat: formatMoney(netWorth),
          statLabel: '순자산 (자산 - 부채)',
          insight:
            debtToIncome > 3
              ? `DSR 주의: 연소득 대비 부채가 ${debtToIncome}배입니다. 3배 이하가 안전합니다.`
              : hasHighInterestDebt
              ? '고금리 부채 먼저 갚기 → 눈덩이 효과로 빠른 상환 가능'
              : '담보대출은 인플레이션 헷지 효과도 있어요.',
          guides: debtGuides,
          suggestionGroups: debtGroups,
        }
      }
      return {
        title: '부채가 없다면 축하해요!',
        description:
          '부채 없이 은퇴를 준비하는 것은 큰 장점입니다. 없다면 그냥 다음 섹션으로 넘어가세요.',
        stat: '9,480만원',
        statLabel: '가구당 평균 부채 (2023)',
        insight: '부채가 없는 상태에서 적극적인 투자가 가능합니다.',
        guides: debtGuides,
        suggestionGroups: debtGroups,
      }

    case 'pension':
      const pensionGuides = [
        '국민연금 예상액은 NPS 앱이나 국민연금공단 홈페이지에서 확인하세요.',
        '퇴직연금은 회사 인사팀이나 금융기관에서 확인 가능해요.',
        '연금저축은 연 900만원까지 세액공제 혜택이 있습니다.',
      ]
      const pensionGroups: SuggestionGroup[] = [
        {
          label: '1층 (공적연금)',
          items: ['국민연금', '공무원연금', '사학연금', '군인연금'],
        },
        {
          label: '2층 (퇴직연금)',
          items: ['퇴직연금(DB)', '퇴직연금(DC)', 'IRP'],
        },
        {
          label: '3층 (개인연금)',
          items: ['연금저축펀드', '연금저축보험', '주택연금'],
        },
      ]

      // 연금 층별 분석
      const tier1Pension = data.pensions.filter((item) =>
        ['국민연금', '공무원연금', '사학연금', '군인연금'].some((k) =>
          item.name.includes(k)
        )
      )
      const tier2Pension = data.pensions.filter((item) =>
        ['퇴직연금', 'DB', 'DC', 'IRP'].some((k) => item.name.includes(k))
      )
      const tier3Pension = data.pensions.filter((item) =>
        ['연금저축', '개인연금', '주택연금'].some((k) => item.name.includes(k))
      )
      const tier1Amount = calculateMonthlyTotal(tier1Pension)
      const tier2Amount = calculateMonthlyTotal(tier2Pension)
      const tier3Amount = calculateMonthlyTotal(tier3Pension)

      if (totalPension > 0) {
        const monthlyPensionNeeded = data.isMarried ? 2770000 : 1770000
        const coverageRate = Math.round(
          (totalPension / monthlyPensionNeeded) * 100
        )
        const pensionGap = Math.max(0, monthlyPensionNeeded - totalPension)

        // 어떤 층이 부족한지 분석
        const hasTier1 = tier1Amount > 0
        const hasTier2 = tier2Amount > 0
        const hasTier3 = tier3Amount > 0
        const tierCount = [hasTier1, hasTier2, hasTier3].filter(Boolean).length

        return {
          title:
            coverageRate >= 80
              ? '연금 준비 잘하셨어요!'
              : coverageRate >= 50
              ? '절반 이상 준비됐어요'
              : '추가 연금이 필요해요',
          description:
            coverageRate >= 80
              ? `3층 연금으로 노후 생활비의 ${coverageRate}%를 충당할 수 있어요. ${
                  tierCount < 3
                    ? '다만 연금 소스를 더 다양화하면 좋겠어요.'
                    : '균형 잡힌 연금 구조입니다!'
                }`
              : `현재 ${tierCount}개 층의 연금만 있어요. 월 ${formatMoney(
                  pensionGap
                )}원의 연금 갭이 있습니다. ${
                  !hasTier3
                    ? '개인연금(3층)을 추가해보세요.'
                    : !hasTier2
                    ? '퇴직연금(2층)을 확인해보세요.'
                    : '연금 수령액을 높여보세요.'
                }`,
          stat: `월 ${formatMoney(totalPension)}`,
          statLabel: '예상 연금 수령액 합계',
          insight: `1층 ${formatMoney(tier1Amount)} + 2층 ${formatMoney(
            tier2Amount
          )} + 3층 ${formatMoney(tier3Amount)} = ${coverageRate}% 충당률`,
          guides: pensionGuides,
          suggestionGroups: pensionGroups,
        }
      }
      return {
        title: '연금, 노후의 월급입니다',
        description: `국민연금만으로는 노후 생활비의 약 25%만 충당됩니다. 3층 연금 구조(공적+퇴직+개인)로 ${
          data.isMarried ? '부부 기준 월 277만원' : '1인 기준 월 177만원'
        }의 노후 생활비를 마련하세요.`,
        stat: data.isMarried ? '월 277만원' : '월 177만원',
        statLabel: '적정 노후 생활비',
        insight: '연금저축 + IRP = 연 최대 900만원 세액공제 (13.2~16.5%)',
        guides: pensionGuides,
        suggestionGroups: pensionGroups,
      }

    default:
      return {
        title: '은퇴를 준비해보세요',
        description: '지금 시작하면 늦지 않아요. 한 걸음씩 함께 준비해봐요.',
      }
  }
}
