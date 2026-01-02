import type {
  OnboardingData,
  FinancialItemInput,
  IncomeData,
  ExpenseData,
  SavingsData,
  PensionData,
  AssetData,
  DebtData,
  RealEstateData,
} from '@/types'

// 기본 증가율 설정
const DEFAULT_RATES = {
  incomeGrowth: 3.3,      // 소득 증가율
  expenseGrowth: 2.5,     // 지출 증가율 (물가상승률)
  investmentReturn: 5.0,  // 투자 수익률
  savingsRate: 3.0,       // 예금 이자율
  realEstateGrowth: 3.0,  // 부동산 상승률
  loanRate: 5.0,          // 기본 대출 금리
}

// 기본 대출 기간 (60개월 = 5년)
const DEFAULT_LOAN_MONTHS = 60

// 기본 만기일 계산 (현재 + 60개월)
function getDefaultMaturity(): { year: number; month: number } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const endMonth = ((currentMonth - 1 + DEFAULT_LOAN_MONTHS) % 12) + 1
  const endYear = currentYear + Math.floor((currentMonth - 1 + DEFAULT_LOAN_MONTHS) / 12)
  return { year: endYear, month: endMonth }
}

/**
 * OnboardingData를 FinancialItemInput 배열로 변환
 */
export function migrateOnboardingToFinancialItems(
  data: OnboardingData,
  simulationId: string
): FinancialItemInput[] {
  const items: FinancialItemInput[] = []
  const currentYear = new Date().getFullYear()
  const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : currentYear - 35
  const retirementYear = birthYear + data.target_retirement_age

  // ============================================
  // 소득 (Income)
  // ============================================

  // 본인 근로소득
  if (data.laborIncome && data.laborIncome > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'income',
      type: 'labor',
      title: '본인 급여',
      owner: 'self',
      start_year: currentYear,
      start_month: 1,
      end_year: retirementYear,
      end_month: 12,
      is_fixed_to_retirement_year: true,
      data: {
        amount: data.laborIncomeFrequency === 'yearly'
          ? Math.round(data.laborIncome / 12)
          : data.laborIncome,
        frequency: 'monthly',
        growthRate: DEFAULT_RATES.incomeGrowth,
      } as IncomeData,
    })
  }

  // 배우자 근로소득
  if (data.spouseLaborIncome && data.spouseLaborIncome > 0) {
    const spouseRetirementYear = data.spouse?.retirement_age
      ? birthYear + data.spouse.retirement_age  // 대략적 계산
      : retirementYear

    items.push({
      simulation_id: simulationId,
      category: 'income',
      type: 'labor',
      title: '배우자 급여',
      owner: 'spouse',
      start_year: currentYear,
      start_month: 1,
      end_year: spouseRetirementYear,
      end_month: 12,
      is_fixed_to_retirement_year: false,
      data: {
        amount: data.spouseLaborIncomeFrequency === 'yearly'
          ? Math.round(data.spouseLaborIncome / 12)
          : data.spouseLaborIncome,
        frequency: 'monthly',
        growthRate: DEFAULT_RATES.incomeGrowth,
      } as IncomeData,
    })
  }

  // 본인 사업소득
  if (data.businessIncome && data.businessIncome > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'income',
      type: 'business',
      title: '본인 사업소득',
      owner: 'self',
      start_year: currentYear,
      start_month: 1,
      end_year: retirementYear,
      end_month: 12,
      is_fixed_to_retirement_year: true,
      data: {
        amount: data.businessIncomeFrequency === 'yearly'
          ? Math.round(data.businessIncome / 12)
          : data.businessIncome,
        frequency: 'monthly',
        growthRate: DEFAULT_RATES.incomeGrowth,
      } as IncomeData,
    })
  }

  // 배우자 사업소득
  if (data.spouseBusinessIncome && data.spouseBusinessIncome > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'income',
      type: 'business',
      title: '배우자 사업소득',
      owner: 'spouse',
      start_year: currentYear,
      start_month: 1,
      is_fixed_to_retirement_year: false,
      data: {
        amount: data.spouseBusinessIncomeFrequency === 'yearly'
          ? Math.round(data.spouseBusinessIncome / 12)
          : data.spouseBusinessIncome,
        frequency: 'monthly',
        growthRate: DEFAULT_RATES.incomeGrowth,
      } as IncomeData,
    })
  }

  // ============================================
  // 지출 (Expense)
  // ============================================

  // 생활비 (은퇴 전)
  if (data.livingExpenses && data.livingExpenses > 0) {
    const monthlyLiving = data.livingExpensesFrequency === 'yearly'
      ? Math.round(data.livingExpenses / 12)
      : data.livingExpenses

    items.push({
      simulation_id: simulationId,
      category: 'expense',
      type: 'living',
      title: '생활비 (은퇴 전)',
      owner: 'common',
      start_year: currentYear,
      start_month: 1,
      end_year: retirementYear,
      end_month: 12,
      is_fixed_to_retirement_year: true,
      data: {
        amount: monthlyLiving,
        frequency: 'monthly',
        growthRate: DEFAULT_RATES.expenseGrowth,
      } as ExpenseData,
    })

    // 은퇴 후 생활비 (은퇴 전의 70% 수준, 물가상승률 반영)
    const yearsToRetirement = retirementYear - currentYear
    const inflatedLiving = Math.round(monthlyLiving * Math.pow(1 + DEFAULT_RATES.expenseGrowth / 100, yearsToRetirement))
    const postRetirementLiving = Math.round(inflatedLiving * 0.7)  // 70%

    items.push({
      simulation_id: simulationId,
      category: 'expense',
      type: 'living',
      title: '생활비 (은퇴 후)',
      owner: 'common',
      start_year: retirementYear + 1,
      start_month: 1,
      data: {
        amount: postRetirementLiving,
        frequency: 'monthly',
        growthRate: DEFAULT_RATES.expenseGrowth,
      } as ExpenseData,
      memo: '은퇴 전 생활비의 70% 수준',
    })
  }

  // 월세 (지출로 처리)
  if (data.housingType === '월세' && data.housingRent && data.housingRent > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'expense',
      type: 'housing',
      title: '월세',
      owner: 'common',
      start_year: currentYear,
      start_month: 1,
      data: {
        amount: data.housingRent,
        frequency: 'monthly',
        growthRate: DEFAULT_RATES.expenseGrowth,
      } as ExpenseData,
    })
  }

  // 관리비 (자가, 전세, 월세 공통)
  if (data.housingType && data.housingType !== '해당없음' && data.housingMaintenance && data.housingMaintenance > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'expense',
      type: 'housing',
      title: '관리비',
      owner: 'common',
      start_year: currentYear,
      start_month: 1,
      data: {
        amount: data.housingMaintenance,
        frequency: 'monthly',
        growthRate: DEFAULT_RATES.expenseGrowth,
      } as ExpenseData,
    })
  }

  // ============================================
  // 부동산 (Real Estate)
  // ============================================

  if (data.housingType && data.housingType !== '해당없음') {
    const realEstateData: RealEstateData = {
      currentValue: data.housingValue || 0,
      housingType: data.housingType === '월세' ? '월세' :
                   data.housingType === '전세' ? '전세' : '자가',
      appreciationRate: DEFAULT_RATES.realEstateGrowth,
    }

    // 전세/월세 보증금
    if (data.housingType === '전세' || data.housingType === '월세') {
      realEstateData.deposit = data.housingValue || 0
      realEstateData.currentValue = 0  // 전세/월세는 자산가치 0
    }

    // 월세
    if (data.housingType === '월세') {
      realEstateData.monthlyRent = data.housingRent || 0
    }

    // 대출 정보
    if (data.housingHasLoan && data.housingLoan) {
      realEstateData.hasLoan = true
      realEstateData.loanAmount = data.housingLoan
      realEstateData.loanRate = data.housingLoanRate || DEFAULT_RATES.loanRate
      realEstateData.loanRepaymentType = data.housingLoanType || '원리금균등상환'

      if (data.housingLoanMaturity) {
        const [year, month] = data.housingLoanMaturity.split('-').map(Number)
        realEstateData.loanMaturityYear = year
        realEstateData.loanMaturityMonth = month
      } else {
        // 만기 없으면 기본 60개월
        const defaultMat = getDefaultMaturity()
        realEstateData.loanMaturityYear = defaultMat.year
        realEstateData.loanMaturityMonth = defaultMat.month
      }
    }

    items.push({
      simulation_id: simulationId,
      category: 'real_estate',
      type: 'residence',
      title: data.housingType === '자가' ? '주거용 부동산' :
             data.housingType === '전세' ? '전세 보증금' : '월세 보증금',
      owner: 'common',
      start_year: currentYear,
      start_month: 1,
      data: realEstateData,
    })
  }

  // 추가 부동산 (투자용/임대용/토지)
  if (data.realEstateProperties && data.realEstateProperties.length > 0) {
    data.realEstateProperties.forEach((property) => {
      const propData: RealEstateData = {
        currentValue: property.marketValue || 0,
        appreciationRate: DEFAULT_RATES.realEstateGrowth,
      }

      // 임대 수익
      if (property.hasRentalIncome && property.monthlyRent) {
        propData.monthlyRent = property.monthlyRent
      }
      if (property.deposit) {
        propData.deposit = property.deposit
      }

      // 대출 정보
      if (property.hasLoan && property.loanAmount) {
        propData.hasLoan = true
        propData.loanAmount = property.loanAmount
        propData.loanRate = property.loanRate || DEFAULT_RATES.loanRate
        propData.loanRepaymentType = property.loanRepaymentType || '원리금균등상환'

        if (property.loanMaturity) {
          const [year, month] = property.loanMaturity.split('-').map(Number)
          propData.loanMaturityYear = year
          propData.loanMaturityMonth = month
        } else {
          const defaultMat = getDefaultMaturity()
          propData.loanMaturityYear = defaultMat.year
          propData.loanMaturityMonth = defaultMat.month
        }
      }

      // 부동산 타입 매핑
      const typeMap: Record<string, 'investment' | 'land' | 'other'> = {
        investment: 'investment',
        rental: 'investment',  // rental → investment (RealEstateType에 rental 없음)
        land: 'land',
      }

      items.push({
        simulation_id: simulationId,
        category: 'real_estate',
        type: typeMap[property.usageType] || 'investment',
        title: property.name,
        owner: 'common',
        start_year: property.purchaseYear || currentYear,
        start_month: property.purchaseMonth || 1,
        data: propData,
      })

      // 임대 수익 → 소득으로 추가
      if (property.hasRentalIncome && property.monthlyRent && property.monthlyRent > 0) {
        items.push({
          simulation_id: simulationId,
          category: 'income',
          type: 'rental',
          title: `${property.name} 임대수익`,
          owner: 'common',
          start_year: currentYear,
          start_month: 1,
          data: {
            amount: property.monthlyRent,
            frequency: 'monthly',
            growthRate: DEFAULT_RATES.incomeGrowth,
          } as IncomeData,
        })
      }

      // 부동산 대출 → 부채로 추가
      if (property.hasLoan && property.loanAmount && property.loanAmount > 0) {
        let endYear: number
        let endMonth: number

        if (property.loanMaturity) {
          const [year, month] = property.loanMaturity.split('-').map(Number)
          endYear = year
          endMonth = month
        } else {
          const defaultMat = getDefaultMaturity()
          endYear = defaultMat.year
          endMonth = defaultMat.month
        }

        items.push({
          simulation_id: simulationId,
          category: 'debt',
          type: 'mortgage',
          title: `${property.name} 대출`,
          owner: 'common',
          end_year: endYear,
          end_month: endMonth,
          data: {
            principal: property.loanAmount,
            currentBalance: property.loanAmount,
            interestRate: property.loanRate || DEFAULT_RATES.loanRate,
            repaymentType: property.loanRepaymentType || '원리금균등상환',
          } as DebtData,
        })
      }
    })
  }

  // 실물 자산 (자동차, 귀금속 등)
  if (data.physicalAssets && data.physicalAssets.length > 0) {
    data.physicalAssets.forEach((asset) => {
      // 자산 타입 매핑
      const typeMap: Record<string, 'vehicle' | 'other'> = {
        car: 'vehicle',
        precious_metal: 'other',
        custom: 'other',
      }

      items.push({
        simulation_id: simulationId,
        category: 'asset',
        type: typeMap[asset.type] || 'other',
        title: asset.name,
        owner: 'common',
        start_year: asset.purchaseYear || currentYear,
        start_month: asset.purchaseMonth || 1,
        data: {
          currentValue: asset.purchaseValue || 0,
          purchasePrice: asset.purchaseValue || 0,
        } as AssetData,
      })

      // 자동차 대출/할부 → 부채로 추가
      if (asset.financingType && asset.financingType !== 'none' && asset.loanAmount && asset.loanAmount > 0) {
        let endYear: number
        let endMonth: number

        if (asset.loanMaturity) {
          const [year, month] = asset.loanMaturity.split('-').map(Number)
          endYear = year
          endMonth = month
        } else {
          const defaultMat = getDefaultMaturity()
          endYear = defaultMat.year
          endMonth = defaultMat.month
        }

        items.push({
          simulation_id: simulationId,
          category: 'debt',
          type: 'car_loan',
          title: `${asset.name} ${asset.financingType === 'loan' ? '대출' : '할부'}`,
          owner: 'common',
          end_year: endYear,
          end_month: endMonth,
          data: {
            principal: asset.loanAmount,
            currentBalance: asset.loanAmount,
            interestRate: asset.loanRate || DEFAULT_RATES.loanRate,
            repaymentType: asset.loanRepaymentType || '원리금균등상환',
          } as DebtData,
        })
      }
    })
  }

  // ============================================
  // 저축/자산 (Savings/Asset)
  // ============================================

  // 입출금통장
  if (data.cashCheckingAccount && data.cashCheckingAccount > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'savings',
      type: 'emergency_fund',
      title: '입출금통장',
      owner: 'common',
      data: {
        currentBalance: data.cashCheckingAccount,
        interestRate: data.cashCheckingRate || 0.1,
      } as SavingsData,
    })
  }

  // 정기예금/적금
  if (data.cashSavingsAccount && data.cashSavingsAccount > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'savings',
      type: 'savings_account',
      title: '정기예금/적금',
      owner: 'common',
      data: {
        currentBalance: data.cashSavingsAccount,
        interestRate: data.cashSavingsRate || DEFAULT_RATES.savingsRate,
      } as SavingsData,
    })
  }

  // 국내주식
  if (data.investDomesticStock && data.investDomesticStock > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'savings',
      type: 'stock',
      title: '국내주식/ETF',
      owner: 'common',
      data: {
        currentBalance: data.investDomesticStock,
        interestRate: data.investDomesticRate || DEFAULT_RATES.investmentReturn,
      } as SavingsData,
    })
  }

  // 해외주식
  if (data.investForeignStock && data.investForeignStock > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'savings',
      type: 'stock',
      title: '해외주식/ETF',
      owner: 'common',
      data: {
        currentBalance: data.investForeignStock,
        interestRate: data.investForeignRate || DEFAULT_RATES.investmentReturn,
      } as SavingsData,
    })
  }

  // 펀드/채권
  if (data.investFund && data.investFund > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'savings',
      type: 'fund',
      title: '펀드/채권',
      owner: 'common',
      data: {
        currentBalance: data.investFund,
        interestRate: data.investFundRate || DEFAULT_RATES.investmentReturn,
      } as SavingsData,
    })
  }

  // 기타 투자자산 (가상화폐 등)
  if (data.investOther && data.investOther > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'savings',
      type: 'crypto',
      title: '기타 투자자산',
      owner: 'common',
      data: {
        currentBalance: data.investOther,
        interestRate: data.investOtherRate || 0,
      } as SavingsData,
    })
  }

  // ============================================
  // 부채 (Debt)
  // ============================================

  // 주택담보대출 - data.debts에 이미 housing sourceType으로 있는지 확인하여 중복 방지
  const hasHousingDebtInDebts = data.debts?.some(d => d.sourceType === 'housing')

  if (data.housingHasLoan && data.housingLoan && data.housingLoan > 0 && !hasHousingDebtInDebts) {
    let endYear: number
    let endMonth: number

    if (data.housingLoanMaturity) {
      const [year, month] = data.housingLoanMaturity.split('-').map(Number)
      endYear = year
      endMonth = month
    } else {
      const defaultMat = getDefaultMaturity()
      endYear = defaultMat.year
      endMonth = defaultMat.month
    }

    items.push({
      simulation_id: simulationId,
      category: 'debt',
      type: 'mortgage',
      title: '주택담보대출',
      owner: 'common',
      end_year: endYear,
      end_month: endMonth,
      data: {
        principal: data.housingLoan,
        currentBalance: data.housingLoan,
        interestRate: data.housingLoanRate || DEFAULT_RATES.loanRate,
        rateType: 'fixed', // 기본값: 고정금리
        repaymentType: data.housingLoanType || '원리금균등상환',
      } as DebtData,
    })
  }

  // 기타 부채 (DebtInput[] 기반)
  if (data.debts && data.debts.length > 0) {
    data.debts.forEach((debt, index) => {
      if (debt.amount && debt.amount > 0) {
        let endYear: number
        let endMonth: number

        if (debt.maturity) {
          const [year, month] = debt.maturity.split('-').map(Number)
          endYear = year
          endMonth = month
        } else {
          const defaultMat = getDefaultMaturity()
          endYear = defaultMat.year
          endMonth = defaultMat.month
        }

        // sourceType에 따른 type 결정
        let debtType: 'mortgage' | 'credit_loan' | 'car_loan' | 'other' = 'credit_loan'
        if (debt.sourceType === 'housing' || debt.sourceType === 'realEstate') {
          debtType = 'mortgage'
        } else if (debt.sourceType === 'physicalAsset') {
          debtType = 'car_loan'
        } else if (debt.sourceType === 'credit') {
          debtType = 'credit_loan'
        }

        items.push({
          simulation_id: simulationId,
          category: 'debt',
          type: debtType,
          title: debt.name || `대출 ${index + 1}`,
          owner: 'common',
          end_year: endYear,
          end_month: endMonth,
          data: {
            principal: debt.amount,
            currentBalance: debt.amount,
            interestRate: debt.rate || DEFAULT_RATES.loanRate,
            rateType: debt.rateType || 'fixed',  // 금리 타입
            spread: debt.spread,                  // 변동금리 스프레드
            repaymentType: debt.repaymentType || '원리금균등상환',
          } as DebtData,
        })
      }
    })
  }

  // ============================================
  // 연금 (Pension)
  // ============================================

  // 국민연금 (본인)
  if (data.nationalPension && data.nationalPension > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'pension',
      type: 'national',
      title: '국민연금',
      owner: 'self',
      start_year: birthYear + (data.nationalPensionStartAge || 65),
      start_month: 1,
      data: {
        expectedMonthlyAmount: data.nationalPension,
        paymentStartAge: data.nationalPensionStartAge || 65,
      } as PensionData,
    })
  }

  // 국민연금 (배우자)
  if (data.isMarried && data.spouseNationalPension && data.spouseNationalPension > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'pension',
      type: 'national',
      title: '배우자 국민연금',
      owner: 'spouse',
      start_year: birthYear + (data.spouseNationalPensionStartAge || 65),
      start_month: 1,
      data: {
        expectedMonthlyAmount: data.spouseNationalPension,
        paymentStartAge: data.spouseNationalPensionStartAge || 65,
      } as PensionData,
    })
  }

  // 퇴직연금 (DB형은 근속연수, DC형은 잔액 기준)
  const hasRetirementPension =
    (data.retirementPensionType === 'DB' && data.yearsOfService && data.yearsOfService > 0) ||
    (data.retirementPensionBalance && data.retirementPensionBalance > 0) ||
    data.retirementPensionType

  if (hasRetirementPension) {
    items.push({
      simulation_id: simulationId,
      category: 'pension',
      type: 'retirement',
      title: '퇴직연금',
      owner: 'self',
      start_year: birthYear + (data.retirementPensionStartAge || data.target_retirement_age || 60),
      start_month: 1,
      data: {
        currentBalance: data.retirementPensionBalance || 0,
        pensionType: data.retirementPensionType || 'DC',
        yearsOfService: data.yearsOfService,
        receiveType: data.retirementPensionReceiveType === 'annuity' ? 'annuity' : 'lump_sum',
        receivingYears: data.retirementPensionReceivingYears,
        paymentStartAge: data.retirementPensionStartAge,
        returnRate: DEFAULT_RATES.investmentReturn,
      } as PensionData,
    })
  }

  // 배우자 퇴직연금
  const hasSpouseRetirementPension =
    (data.spouseRetirementPensionType === 'DB' && data.spouseYearsOfService && data.spouseYearsOfService > 0) ||
    (data.spouseRetirementPensionBalance && data.spouseRetirementPensionBalance > 0) ||
    data.spouseRetirementPensionType

  if (hasSpouseRetirementPension && data.isMarried) {
    items.push({
      simulation_id: simulationId,
      category: 'pension',
      type: 'retirement',
      title: '배우자 퇴직연금',
      owner: 'spouse',
      start_year: birthYear + (data.spouseRetirementPensionStartAge || data.target_retirement_age || 60),
      start_month: 1,
      data: {
        currentBalance: data.spouseRetirementPensionBalance || 0,
        pensionType: data.spouseRetirementPensionType || 'DC',
        yearsOfService: data.spouseYearsOfService,
        receiveType: data.spouseRetirementPensionReceiveType === 'annuity' ? 'annuity' : 'lump_sum',
        receivingYears: data.spouseRetirementPensionReceivingYears,
        paymentStartAge: data.spouseRetirementPensionStartAge,
        returnRate: DEFAULT_RATES.investmentReturn,
      } as PensionData,
    })
  }

  // IRP (본인)
  const hasIrp = (data.irpBalance && data.irpBalance > 0) || (data.irpMonthlyContribution && data.irpMonthlyContribution > 0)
  if (hasIrp) {
    items.push({
      simulation_id: simulationId,
      category: 'pension',
      type: 'irp',
      title: 'IRP',
      owner: 'self',
      start_year: birthYear + (data.irpStartAge || 56),
      start_month: 1,
      data: {
        currentBalance: data.irpBalance || 0,
        monthlyContribution: data.irpMonthlyContribution,
        paymentStartAge: data.irpStartAge,
        paymentYears: data.irpReceivingYears,
        returnRate: DEFAULT_RATES.investmentReturn,
      } as PensionData,
    })
  }

  // IRP (배우자)
  const hasSpouseIrp = data.isMarried && ((data.spouseIrpBalance && data.spouseIrpBalance > 0) || (data.spouseIrpMonthlyContribution && data.spouseIrpMonthlyContribution > 0))
  if (hasSpouseIrp) {
    items.push({
      simulation_id: simulationId,
      category: 'pension',
      type: 'irp',
      title: '배우자 IRP',
      owner: 'spouse',
      start_year: birthYear + (data.spouseIrpStartAge || 56),
      start_month: 1,
      data: {
        currentBalance: data.spouseIrpBalance || 0,
        monthlyContribution: data.spouseIrpMonthlyContribution,
        paymentStartAge: data.spouseIrpStartAge,
        paymentYears: data.spouseIrpReceivingYears,
        returnRate: DEFAULT_RATES.investmentReturn,
      } as PensionData,
    })
  }

  // 연금저축 (본인)
  const hasPensionSavings = (data.pensionSavingsBalance && data.pensionSavingsBalance > 0) || (data.pensionSavingsMonthlyContribution && data.pensionSavingsMonthlyContribution > 0)
  if (hasPensionSavings) {
    items.push({
      simulation_id: simulationId,
      category: 'pension',
      type: 'personal',
      title: '연금저축',
      owner: 'self',
      start_year: birthYear + (data.pensionSavingsStartAge || 56),
      start_month: 1,
      data: {
        currentBalance: data.pensionSavingsBalance || 0,
        monthlyContribution: data.pensionSavingsMonthlyContribution,
        paymentStartAge: data.pensionSavingsStartAge,
        paymentYears: data.pensionSavingsReceivingYears,
        returnRate: DEFAULT_RATES.investmentReturn,
      } as PensionData,
    })
  }

  // 연금저축 (배우자)
  const hasSpousePensionSavings = data.isMarried && ((data.spousePensionSavingsBalance && data.spousePensionSavingsBalance > 0) || (data.spousePensionSavingsMonthlyContribution && data.spousePensionSavingsMonthlyContribution > 0))
  if (hasSpousePensionSavings) {
    items.push({
      simulation_id: simulationId,
      category: 'pension',
      type: 'personal',
      title: '배우자 연금저축',
      owner: 'spouse',
      start_year: birthYear + (data.spousePensionSavingsStartAge || 56),
      start_month: 1,
      data: {
        currentBalance: data.spousePensionSavingsBalance || 0,
        monthlyContribution: data.spousePensionSavingsMonthlyContribution,
        paymentStartAge: data.spousePensionSavingsStartAge,
        paymentYears: data.spousePensionSavingsReceivingYears,
        returnRate: DEFAULT_RATES.investmentReturn,
      } as PensionData,
    })
  }

  // ISA (본인)
  if (data.isaBalance && data.isaBalance > 0) {
    items.push({
      simulation_id: simulationId,
      category: 'savings',
      type: 'savings_account',
      title: 'ISA',
      owner: 'self',
      data: {
        currentBalance: data.isaBalance,
        interestRate: DEFAULT_RATES.investmentReturn,
      } as SavingsData,
    })
  }

  // sort_order 추가
  return items.map((item, index) => ({
    ...item,
    sort_order: index,
  }))
}

/**
 * 프로필 기본 정보 추출 (OnboardingData에서)
 */
export function extractProfileInfo(data: OnboardingData) {
  return {
    name: data.name,
    gender: data.gender,
    birth_date: data.birth_date,
    target_retirement_age: data.target_retirement_age,
    target_retirement_fund: data.target_retirement_fund,
    isMarried: data.isMarried,
    spouse: data.spouse,
    hasChildren: data.hasChildren,
    children: data.children,
    parents: data.parents,
  }
}

/**
 * FinancialItem 배열에서 월별 금액 계산
 */
export function getMonthlyAmount(
  item: { data: IncomeData | ExpenseData },
): number {
  const data = item.data as IncomeData | ExpenseData
  if (data.frequency === 'yearly') {
    return Math.round(data.amount / 12)
  }
  return data.amount
}

/**
 * 특정 연월에 항목이 활성화되어 있는지 확인
 */
export function isItemActiveAt(
  item: {
    start_year?: number
    start_month?: number
    end_year?: number
    end_month?: number
  },
  year: number,
  month: number
): boolean {
  const startYM = (item.start_year || 0) * 12 + (item.start_month || 1)
  const endYM = item.end_year
    ? item.end_year * 12 + (item.end_month || 12)
    : 9999 * 12  // 무한대
  const targetYM = year * 12 + month

  return targetYM >= startYM && targetYM <= endYM
}
