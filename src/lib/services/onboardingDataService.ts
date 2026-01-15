/**
 * 온보딩 데이터 저장 서비스
 * OnboardingData를 새로운 테이블 구조에 직접 저장
 */

import { createClient } from '@/lib/supabase/client'
import type { OnboardingData } from '@/types'
import type {
  IncomeInput,
  ExpenseInput,
  NationalPensionInput,
  RetirementPensionInput,
  PersonalPensionInput,
  RealEstateInput,
  SavingsInput,
  DebtInput,
  Owner,
  HousingType,
  LoanRepaymentType,
} from '@/types/tables'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

/**
 * 온보딩 데이터를 새 테이블 구조에 저장
 */
export async function saveOnboardingData(
  userId: string,
  simulationId: string,
  data: OnboardingData
): Promise<void> {
  const supabase = createClient()

  // 1. 기존 데이터 삭제 (새로 저장하기 전에)
  await clearSimulationData(simulationId)

  // 2. 소득 저장
  await saveIncomes(simulationId, data)

  // 3. 지출 저장
  await saveExpenses(simulationId, data)

  // 4. 거주 부동산 저장 (+ 연동 부채/지출 생성)
  await saveResidentialRealEstate(simulationId, data)

  // 5. 추가 부동산 저장
  await saveAdditionalRealEstates(simulationId, data)

  // 6. 저축/투자 계좌 저장
  await saveSavingsAccounts(simulationId, data)

  // 7. 부채 저장 (+ 연동 지출 생성)
  await saveDebts(simulationId, data)

  // 8. 국민연금 저장 (+ 연동 소득 생성)
  await saveNationalPensions(simulationId, data, userId)

  // 9. 퇴직연금 저장 (+ 연동 소득 생성)
  await saveRetirementPensions(simulationId, data, userId)

  // 10. 개인연금 저장 (+ 연동 소득 생성)
  await savePersonalPensions(simulationId, data, userId)
}

/**
 * 시뮬레이션 데이터 초기화
 */
async function clearSimulationData(simulationId: string): Promise<void> {
  const supabase = createClient()

  await Promise.all([
    supabase.from('incomes').delete().eq('simulation_id', simulationId),
    supabase.from('expenses').delete().eq('simulation_id', simulationId),
    supabase.from('real_estates').delete().eq('simulation_id', simulationId),
    supabase.from('savings').delete().eq('simulation_id', simulationId),
    supabase.from('debts').delete().eq('simulation_id', simulationId),
    supabase.from('national_pensions').delete().eq('simulation_id', simulationId),
    supabase.from('retirement_pensions').delete().eq('simulation_id', simulationId),
    supabase.from('personal_pensions').delete().eq('simulation_id', simulationId),
  ])
}

/**
 * 소득 저장
 */
async function saveIncomes(simulationId: string, data: OnboardingData): Promise<void> {
  const supabase = createClient()
  const incomes: IncomeInput[] = []

  // 본인 근로소득
  if (data.laborIncome && data.laborIncome > 0) {
    const amount = data.laborIncomeFrequency === 'monthly'
      ? data.laborIncome
      : Math.round(data.laborIncome / 12)

    incomes.push({
      simulation_id: simulationId,
      type: 'labor',
      title: '근로소득',
      owner: 'self',
      amount,
      frequency: 'monthly',
      start_year: currentYear,
      start_month: currentMonth,
      // retirement_link로 어떤 은퇴년도에 연동할지 지정 (end_year는 시뮬레이션 시점에 동적 계산)
      end_year: null,
      end_month: null,
      is_fixed_to_retirement: true,
      retirement_link: 'self',
      growth_rate: 3.0,
      rate_category: 'income',
    })
  }

  // 배우자 근로소득
  if (data.spouseLaborIncome && data.spouseLaborIncome > 0) {
    const amount = data.spouseLaborIncomeFrequency === 'monthly'
      ? data.spouseLaborIncome
      : Math.round(data.spouseLaborIncome / 12)

    incomes.push({
      simulation_id: simulationId,
      type: 'labor',
      title: '배우자 근로소득',
      owner: 'spouse',
      amount,
      frequency: 'monthly',
      start_year: currentYear,
      start_month: currentMonth,
      // retirement_link로 어떤 은퇴년도에 연동할지 지정 (end_year는 시뮬레이션 시점에 동적 계산)
      end_year: null,
      end_month: null,
      is_fixed_to_retirement: true,
      retirement_link: 'spouse',
      growth_rate: 3.0,
      rate_category: 'income',
    })
  }

  // 본인 사업소득
  if (data.businessIncome && data.businessIncome > 0) {
    const amount = data.businessIncomeFrequency === 'monthly'
      ? data.businessIncome
      : Math.round(data.businessIncome / 12)

    incomes.push({
      simulation_id: simulationId,
      type: 'business',
      title: '사업소득',
      owner: 'self',
      amount,
      frequency: 'monthly',
      start_year: currentYear,
      start_month: currentMonth,
      // retirement_link로 어떤 은퇴년도에 연동할지 지정 (end_year는 시뮬레이션 시점에 동적 계산)
      end_year: null,
      end_month: null,
      is_fixed_to_retirement: true,
      retirement_link: 'self',
      growth_rate: 3.0,
      rate_category: 'income',
    })
  }

  // 배우자 사업소득
  if (data.spouseBusinessIncome && data.spouseBusinessIncome > 0) {
    const amount = data.spouseBusinessIncomeFrequency === 'monthly'
      ? data.spouseBusinessIncome
      : Math.round(data.spouseBusinessIncome / 12)

    incomes.push({
      simulation_id: simulationId,
      type: 'business',
      title: '배우자 사업소득',
      owner: 'spouse',
      amount,
      frequency: 'monthly',
      start_year: currentYear,
      start_month: currentMonth,
      // retirement_link로 어떤 은퇴년도에 연동할지 지정 (end_year는 시뮬레이션 시점에 동적 계산)
      end_year: null,
      end_month: null,
      is_fixed_to_retirement: true,
      retirement_link: 'spouse',
      growth_rate: 3.0,
      rate_category: 'income',
    })
  }

  if (incomes.length > 0) {
    const { error } = await supabase.from('incomes').insert(incomes)
    if (error) throw error
  }
}

/**
 * 지출 저장
 */
async function saveExpenses(simulationId: string, data: OnboardingData): Promise<void> {
  const supabase = createClient()
  const expenses: ExpenseInput[] = []

  // 생활비
  if (data.livingExpenses && data.livingExpenses > 0) {
    const amount = data.livingExpensesFrequency === 'monthly'
      ? data.livingExpenses
      : Math.round(data.livingExpenses / 12)

    expenses.push({
      simulation_id: simulationId,
      type: 'living',
      title: '생활비',
      amount,
      frequency: 'monthly',
      start_year: currentYear,
      start_month: currentMonth,
      growth_rate: 2.5,
      rate_category: 'inflation',
    })
  }

  if (expenses.length > 0) {
    const { error } = await supabase.from('expenses').insert(expenses)
    if (error) throw error
  }
}

/**
 * 거주 부동산 저장 (+ 연동 부채/지출 자동 생성)
 */
async function saveResidentialRealEstate(simulationId: string, data: OnboardingData): Promise<void> {
  if (!data.housingType) return

  const supabase = createClient()

  // 부동산 데이터 구성
  const realEstate: RealEstateInput = {
    simulation_id: simulationId,
    type: 'residence',
    title: '거주지',
    owner: 'common',
    current_value: data.housingValue || 0,
    purchase_price: data.housingPurchasePrice || null,
    purchase_year: data.housingPurchaseYear || null,
    purchase_month: data.housingPurchaseMonth || null,
    growth_rate: 2.5,
    housing_type: data.housingType as HousingType,
    deposit: null,
    monthly_rent: data.housingRent || null,
    maintenance_fee: data.housingMaintenance || null,
    has_loan: data.housingHasLoan || false,
    loan_amount: data.housingLoan || null,
    loan_rate: data.housingLoanRate || null,
    loan_repayment_type: data.housingLoanType as LoanRepaymentType || null,
  }

  // 대출 만기 파싱 (YYYY-MM 형식)
  if (data.housingLoanMaturity) {
    const [year, month] = data.housingLoanMaturity.split('-').map(Number)
    realEstate.loan_maturity_year = year
    realEstate.loan_maturity_month = month
    realEstate.loan_start_year = data.housingPurchaseYear || currentYear
    realEstate.loan_start_month = data.housingPurchaseMonth || currentMonth
  }

  // 부동산 저장
  const { data: savedRealEstate, error: realEstateError } = await supabase
    .from('real_estates')
    .insert(realEstate)
    .select()
    .single()

  if (realEstateError) throw realEstateError

  // 연동: 담보대출 → 부채 생성
  if (realEstate.has_loan && realEstate.loan_amount && realEstate.loan_amount > 0) {
    const debt: DebtInput = {
      simulation_id: simulationId,
      type: 'mortgage',
      title: '주택담보대출',
      principal: realEstate.loan_amount,
      interest_rate: realEstate.loan_rate || 4.0,
      rate_type: 'fixed',
      repayment_type: realEstate.loan_repayment_type || '원리금균등상환',
      start_year: realEstate.loan_start_year || currentYear,
      start_month: realEstate.loan_start_month || currentMonth,
      maturity_year: realEstate.loan_maturity_year || currentYear + 30,
      maturity_month: realEstate.loan_maturity_month || currentMonth,
      source_type: 'real_estate',
      source_id: savedRealEstate.id,
    }

    const { data: savedDebt, error: debtError } = await supabase
      .from('debts')
      .insert(debt)
      .select()
      .single()

    if (debtError) throw debtError

    // 연동: 부채 → 이자 지출 생성
    const monthlyInterest = Math.round((debt.principal * (debt.interest_rate / 100)) / 12)

    const interestExpense: ExpenseInput = {
      simulation_id: simulationId,
      type: 'interest',
      title: '주택담보대출 이자',
      amount: monthlyInterest,
      frequency: 'monthly',
      start_year: debt.start_year,
      start_month: debt.start_month,
      end_year: debt.maturity_year,
      end_month: debt.maturity_month,
      rate_category: 'fixed',
      source_type: 'debt',
      source_id: savedDebt.id,
    }

    await supabase.from('expenses').insert(interestExpense)

    // 연동: 부채 → 원금상환 지출 생성 (만기일시상환 제외)
    if (debt.repayment_type !== '만기일시상환') {
      const totalMonths = ((debt.maturity_year || currentYear + 30) - (debt.start_year || currentYear)) * 12 +
        ((debt.maturity_month || 12) - (debt.start_month || 1))
      const monthlyPrincipal = Math.round(debt.principal / Math.max(totalMonths, 1))

      const principalExpense: ExpenseInput = {
        simulation_id: simulationId,
        type: 'principal',
        title: '주택담보대출 원금상환',
        amount: monthlyPrincipal,
        frequency: 'monthly',
        start_year: debt.start_year,
        start_month: debt.start_month,
        end_year: debt.maturity_year,
        end_month: debt.maturity_month,
        rate_category: 'fixed',
        source_type: 'debt',
        source_id: savedDebt.id,
      }

      await supabase.from('expenses').insert(principalExpense)
    }
  }

  // 연동: 월세 → 지출 생성
  if (data.housingType === '월세' && realEstate.monthly_rent && realEstate.monthly_rent > 0) {
    const rentExpense: ExpenseInput = {
      simulation_id: simulationId,
      type: 'housing',
      title: '월세',
      amount: realEstate.monthly_rent,
      frequency: 'monthly',
      start_year: currentYear,
      start_month: currentMonth,
      rate_category: 'inflation',
      source_type: 'real_estate',
      source_id: savedRealEstate.id,
    }

    await supabase.from('expenses').insert(rentExpense)
  }

  // 연동: 관리비 → 지출 생성
  if (realEstate.maintenance_fee && realEstate.maintenance_fee > 0) {
    const maintenanceExpense: ExpenseInput = {
      simulation_id: simulationId,
      type: 'housing',
      title: '관리비',
      amount: realEstate.maintenance_fee,
      frequency: 'monthly',
      start_year: currentYear,
      start_month: currentMonth,
      rate_category: 'inflation',
      source_type: 'real_estate',
      source_id: savedRealEstate.id,
    }

    await supabase.from('expenses').insert(maintenanceExpense)
  }
}

/**
 * 추가 부동산 저장
 */
async function saveAdditionalRealEstates(simulationId: string, data: OnboardingData): Promise<void> {
  if (!data.realEstateProperties || data.realEstateProperties.length === 0) return

  const supabase = createClient()

  for (const property of data.realEstateProperties) {
    if (!property.name) continue

    const realEstate: RealEstateInput = {
      simulation_id: simulationId,
      type: property.usageType === 'rental' ? 'rental' : 'investment',
      title: property.name,
      owner: 'common',
      current_value: property.marketValue || 0,
      purchase_year: property.purchaseYear || null,
      purchase_month: property.purchaseMonth || null,
      growth_rate: 2.5,
      has_rental_income: property.hasRentalIncome || false,
      rental_deposit: property.deposit || null,
      rental_monthly: property.monthlyRent || null,
      has_loan: property.hasLoan || false,
      loan_amount: property.loanAmount || null,
      loan_rate: property.loanRate || null,
      loan_repayment_type: property.loanRepaymentType as LoanRepaymentType || null,
    }

    // 대출 만기 파싱
    if (property.loanMaturity) {
      const [year, month] = property.loanMaturity.split('-').map(Number)
      realEstate.loan_maturity_year = year
      realEstate.loan_maturity_month = month
      realEstate.loan_start_year = property.purchaseYear || currentYear
      realEstate.loan_start_month = property.purchaseMonth || currentMonth
    }

    // 부동산 저장
    const { data: savedRealEstate, error: realEstateError } = await supabase
      .from('real_estates')
      .insert(realEstate)
      .select()
      .single()

    if (realEstateError) throw realEstateError

    // 연동: 임대 소득 생성
    if (realEstate.has_rental_income && realEstate.rental_monthly && realEstate.rental_monthly > 0) {
      const rentalIncome: IncomeInput = {
        simulation_id: simulationId,
        type: 'rental',
        title: `${realEstate.title} 임대소득`,
        owner: 'self',
        amount: realEstate.rental_monthly,
        frequency: 'monthly',
        start_year: currentYear,
        start_month: currentMonth,
        rate_category: 'inflation',
        source_type: 'real_estate',
        source_id: savedRealEstate.id,
      }

      await supabase.from('incomes').insert(rentalIncome)
    }

    // 연동: 대출 → 부채 생성
    if (realEstate.has_loan && realEstate.loan_amount && realEstate.loan_amount > 0) {
      const debt: DebtInput = {
        simulation_id: simulationId,
        type: 'mortgage',
        title: `${realEstate.title} 담보대출`,
        principal: realEstate.loan_amount,
        interest_rate: realEstate.loan_rate || 4.0,
        rate_type: 'fixed',
        repayment_type: realEstate.loan_repayment_type || '원리금균등상환',
        start_year: realEstate.loan_start_year || currentYear,
        start_month: realEstate.loan_start_month || currentMonth,
        maturity_year: realEstate.loan_maturity_year || currentYear + 30,
        maturity_month: realEstate.loan_maturity_month || currentMonth,
        source_type: 'real_estate',
        source_id: savedRealEstate.id,
      }

      const { data: savedDebt, error: debtError } = await supabase
        .from('debts')
        .insert(debt)
        .select()
        .single()

      if (debtError) throw debtError

      // 연동: 이자 지출 생성
      const monthlyInterest = Math.round((debt.principal * (debt.interest_rate / 100)) / 12)

      const interestExpense: ExpenseInput = {
        simulation_id: simulationId,
        type: 'interest',
        title: `${realEstate.title} 대출 이자`,
        amount: monthlyInterest,
        frequency: 'monthly',
        start_year: debt.start_year,
        start_month: debt.start_month,
        end_year: debt.maturity_year,
        end_month: debt.maturity_month,
        rate_category: 'fixed',
        source_type: 'debt',
        source_id: savedDebt.id,
      }

      await supabase.from('expenses').insert(interestExpense)

      // 연동: 원금상환 지출 생성 (만기일시상환 제외)
      if (debt.repayment_type !== '만기일시상환') {
        const totalMonths = ((debt.maturity_year || currentYear + 30) - (debt.start_year || currentYear)) * 12 +
          ((debt.maturity_month || 12) - (debt.start_month || 1))
        const monthlyPrincipal = Math.round(debt.principal / Math.max(totalMonths, 1))

        const principalExpense: ExpenseInput = {
          simulation_id: simulationId,
          type: 'principal',
          title: `${realEstate.title} 대출 원금상환`,
          amount: monthlyPrincipal,
          frequency: 'monthly',
          start_year: debt.start_year,
          start_month: debt.start_month,
          end_year: debt.maturity_year,
          end_month: debt.maturity_month,
          rate_category: 'fixed',
          source_type: 'debt',
          source_id: savedDebt.id,
        }

        await supabase.from('expenses').insert(principalExpense)
      }
    }
  }
}

/**
 * 저축/투자 계좌 저장
 */
async function saveSavingsAccounts(simulationId: string, data: OnboardingData): Promise<void> {
  const supabase = createClient()
  const savings: SavingsInput[] = []

  // 저축 계좌 (savingsAccounts 배열에서 가져옴)
  let hasCheckingAccount = false
  if (data.savingsAccounts && data.savingsAccounts.length > 0) {
    for (const account of data.savingsAccounts) {
      if (!account.name && account.balance === undefined) continue

      if (account.type === 'checking') {
        hasCheckingAccount = true
      }

      savings.push({
        simulation_id: simulationId,
        type: account.type as 'checking' | 'savings' | 'deposit',
        title: account.name || (account.type === 'checking' ? '입출금통장' : '저축계좌'),
        owner: 'self',
        current_balance: account.balance || 0,
        interest_rate: account.interestRate || null,
        maturity_year: account.maturityYear || null,
        maturity_month: account.maturityMonth || null,
      })
    }
  }

  // 입출금통장이 없으면 기본 통장 생성 (시뮬레이션에 필요)
  if (!hasCheckingAccount) {
    savings.push({
      simulation_id: simulationId,
      type: 'checking',
      title: '입출금통장',
      owner: 'self',
      current_balance: 0,
    })
  }

  // 투자 계좌
  if (data.investmentAccounts && data.investmentAccounts.length > 0) {
    for (const account of data.investmentAccounts) {
      if (!account.name || !account.balance) continue

      savings.push({
        simulation_id: simulationId,
        type: account.type as 'domestic_stock' | 'foreign_stock' | 'fund' | 'crypto' | 'other',
        title: account.name,
        owner: 'self',
        current_balance: account.balance,
        expected_return: account.expectedReturn || null,
      })
    }
  }

  if (savings.length > 0) {
    const { error } = await supabase.from('savings').insert(savings)
    if (error) throw error
  }
}

/**
 * 부채 저장 (+ 연동 이자 지출 생성)
 */
async function saveDebts(simulationId: string, data: OnboardingData): Promise<void> {
  if (!data.debts || data.debts.length === 0) return

  const supabase = createClient()

  for (const debtItem of data.debts) {
    if (!debtItem.name || !debtItem.amount) continue

    // 만기 파싱
    let maturityYear = currentYear + 10
    let maturityMonth = currentMonth
    if (debtItem.maturity) {
      const [year, month] = debtItem.maturity.split('-').map(Number)
      maturityYear = year
      maturityMonth = month
    }

    const debt: DebtInput = {
      simulation_id: simulationId,
      type: 'credit',
      title: debtItem.name,
      principal: debtItem.amount,
      interest_rate: debtItem.rate || 5.0,
      rate_type: 'fixed',
      repayment_type: debtItem.repaymentType as LoanRepaymentType || '원리금균등상환',
      start_year: currentYear,
      start_month: currentMonth,
      maturity_year: maturityYear,
      maturity_month: maturityMonth,
    }

    const { data: savedDebt, error: debtError } = await supabase
      .from('debts')
      .insert(debt)
      .select()
      .single()

    if (debtError) throw debtError

    // 연동: 이자 지출 생성
    const monthlyInterest = Math.round((debt.principal * (debt.interest_rate / 100)) / 12)

    const interestExpense: ExpenseInput = {
      simulation_id: simulationId,
      type: 'interest',
      title: `${debt.title} 이자`,
      amount: monthlyInterest,
      frequency: 'monthly',
      start_year: debt.start_year,
      start_month: debt.start_month,
      end_year: debt.maturity_year,
      end_month: debt.maturity_month,
      rate_category: 'fixed',
      source_type: 'debt',
      source_id: savedDebt.id,
    }

    await supabase.from('expenses').insert(interestExpense)

    // 연동: 원금상환 지출 생성 (만기일시상환 제외)
    if (debt.repayment_type !== '만기일시상환') {
      const totalMonths = ((debt.maturity_year || currentYear + 5) - (debt.start_year || currentYear)) * 12 +
        ((debt.maturity_month || 12) - (debt.start_month || 1))
      const monthlyPrincipal = Math.round(debt.principal / Math.max(totalMonths, 1))

      const principalExpense: ExpenseInput = {
        simulation_id: simulationId,
        type: 'principal',
        title: `${debt.title} 원금상환`,
        amount: monthlyPrincipal,
        frequency: 'monthly',
        start_year: debt.start_year,
        start_month: debt.start_month,
        end_year: debt.maturity_year,
        end_month: debt.maturity_month,
        rate_category: 'fixed',
        source_type: 'debt',
        source_id: savedDebt.id,
      }

      await supabase.from('expenses').insert(principalExpense)
    }
  }
}

/**
 * 국민연금 저장 (+ 연동 소득 생성)
 */
async function saveNationalPensions(
  simulationId: string,
  data: OnboardingData,
  userId: string
): Promise<void> {
  const supabase = createClient()
  const pensionsToInsert: NationalPensionInput[] = []
  const linkedIncomes: IncomeInput[] = []

  // 본인 국민연금
  if (data.nationalPension && data.nationalPension > 0) {
    // 생년월일에서 birth year 추출
    const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : 1980
    const startAge = data.nationalPensionStartAge || 65
    const startYear = birthYear + startAge

    const pension: NationalPensionInput = {
      simulation_id: simulationId,
      owner: 'self',
      expected_monthly_amount: data.nationalPension,
      start_age: startAge,
    }

    pensionsToInsert.push(pension)

    // 연동 소득 (저장 후 source_id 연결)
    linkedIncomes.push({
      simulation_id: simulationId,
      type: 'pension',
      title: '국민연금',
      owner: 'self',
      amount: pension.expected_monthly_amount,
      frequency: 'monthly',
      start_year: startYear,
      start_month: 1,
      rate_category: 'inflation',
      source_type: 'national_pension',
      source_id: null, // 나중에 연결
    })
  }

  // 배우자 국민연금
  if (data.spouseNationalPension && data.spouseNationalPension > 0 && data.spouse?.birth_date) {
    const spouseBirthYear = parseInt(data.spouse.birth_date.split('-')[0])
    const startAge = data.spouseNationalPensionStartAge || 65
    const startYear = spouseBirthYear + startAge

    const pension: NationalPensionInput = {
      simulation_id: simulationId,
      owner: 'spouse',
      expected_monthly_amount: data.spouseNationalPension,
      start_age: startAge,
    }

    pensionsToInsert.push(pension)

    linkedIncomes.push({
      simulation_id: simulationId,
      type: 'pension',
      title: '배우자 국민연금',
      owner: 'spouse',
      amount: pension.expected_monthly_amount,
      frequency: 'monthly',
      start_year: startYear,
      start_month: 1,
      rate_category: 'inflation',
      source_type: 'national_pension',
      source_id: null,
    })
  }

  // 연금 저장 및 소득 연동
  for (let i = 0; i < pensionsToInsert.length; i++) {
    const { data: savedPension, error: pensionError } = await supabase
      .from('national_pensions')
      .insert(pensionsToInsert[i])
      .select()
      .single()

    if (pensionError) throw pensionError

    // 연동 소득에 source_id 연결
    linkedIncomes[i].source_id = savedPension.id

    const { error: incomeError } = await supabase
      .from('incomes')
      .insert(linkedIncomes[i])

    if (incomeError) throw incomeError
  }
}

/**
 * 퇴직연금 저장 (+ 연동 소득 생성)
 */
async function saveRetirementPensions(
  simulationId: string,
  data: OnboardingData,
  userId: string
): Promise<void> {
  const supabase = createClient()

  // 본인 퇴직연금
  if (data.retirementPensionBalance && data.retirementPensionBalance > 0) {
    const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : 1980
    const startAge = data.retirementPensionStartAge || 55
    const startYear = birthYear + startAge

    const pension: RetirementPensionInput = {
      simulation_id: simulationId,
      owner: 'self',
      pension_type: (data.retirementPensionType?.toLowerCase() || 'dc') as 'db' | 'dc' | 'corporate_irp' | 'severance',
      current_balance: data.retirementPensionBalance,
      years_of_service: data.yearsOfService || null,
      receive_type: data.retirementPensionReceiveType === 'lump_sum' ? 'lump_sum' : 'annuity',
      start_age: startAge,
      receiving_years: data.retirementPensionReceivingYears || 10,
      return_rate: 4.0,
    }

    const { data: savedPension, error: pensionError } = await supabase
      .from('retirement_pensions')
      .insert(pension)
      .select()
      .single()

    if (pensionError) throw pensionError

    // 연금 수령 방식에 따른 소득 생성
    if (pension.receive_type === 'annuity' && pension.receiving_years && pension.current_balance) {
      const monthlyAmount = Math.round(pension.current_balance / (pension.receiving_years * 12))

      const income: IncomeInput = {
        simulation_id: simulationId,
        type: 'pension',
        title: '퇴직연금',
        owner: 'self',
        amount: monthlyAmount,
        frequency: 'monthly',
        start_year: startYear,
        start_month: 1,
        end_year: startYear + pension.receiving_years,
        end_month: 12,
        rate_category: 'fixed',
        source_type: 'retirement_pension',
        source_id: savedPension.id,
      }

      await supabase.from('incomes').insert(income)
    }
  }

  // 배우자 퇴직연금
  if (data.spouseRetirementPensionBalance && data.spouseRetirementPensionBalance > 0 && data.spouse?.birth_date) {
    const spouseBirthYear = parseInt(data.spouse.birth_date.split('-')[0])
    const startAge = data.spouseRetirementPensionStartAge || 55
    const startYear = spouseBirthYear + startAge

    const pension: RetirementPensionInput = {
      simulation_id: simulationId,
      owner: 'spouse',
      pension_type: (data.spouseRetirementPensionType?.toLowerCase() || 'dc') as 'db' | 'dc' | 'corporate_irp' | 'severance',
      current_balance: data.spouseRetirementPensionBalance,
      years_of_service: data.spouseYearsOfService || null,
      receive_type: data.spouseRetirementPensionReceiveType === 'lump_sum' ? 'lump_sum' : 'annuity',
      start_age: startAge,
      receiving_years: data.spouseRetirementPensionReceivingYears || 10,
      return_rate: 4.0,
    }

    const { data: savedPension, error: pensionError } = await supabase
      .from('retirement_pensions')
      .insert(pension)
      .select()
      .single()

    if (pensionError) throw pensionError

    // 연금 수령 방식에 따른 소득 생성
    if (pension.receive_type === 'annuity' && pension.receiving_years && pension.current_balance) {
      const monthlyAmount = Math.round(pension.current_balance / (pension.receiving_years * 12))

      const income: IncomeInput = {
        simulation_id: simulationId,
        type: 'pension',
        title: '배우자 퇴직연금',
        owner: 'spouse',
        amount: monthlyAmount,
        frequency: 'monthly',
        start_year: startYear,
        start_month: 1,
        end_year: startYear + pension.receiving_years,
        end_month: 12,
        rate_category: 'fixed',
        source_type: 'retirement_pension',
        source_id: savedPension.id,
      }

      await supabase.from('incomes').insert(income)
    }
  }
}

/**
 * 개인연금 저장 (연금저축, IRP, ISA)
 */
async function savePersonalPensions(
  simulationId: string,
  data: OnboardingData,
  userId: string
): Promise<void> {
  const supabase = createClient()
  const birthYear = data.birth_date ? parseInt(data.birth_date.split('-')[0]) : 1980
  const spouseBirthYear = data.spouse?.birth_date ? parseInt(data.spouse.birth_date.split('-')[0]) : null

  // 본인 연금저축
  if (data.pensionSavingsBalance && data.pensionSavingsBalance > 0) {
    const startAge = data.pensionSavingsStartAge || 55
    const startYear = birthYear + startAge
    const receivingYears = data.pensionSavingsReceivingYears || 20

    const pension: PersonalPensionInput = {
      simulation_id: simulationId,
      owner: 'self',
      pension_type: 'pension_savings',
      current_balance: data.pensionSavingsBalance,
      monthly_contribution: data.pensionSavingsMonthlyContribution || null,
      start_age: startAge,
      receiving_years: receivingYears,
      return_rate: 4.0,
    }

    const { data: savedPension, error: pensionError } = await supabase
      .from('personal_pensions')
      .insert(pension)
      .select()
      .single()

    if (pensionError) throw pensionError

    // 연동 소득 생성
    const monthlyAmount = Math.round(pension.current_balance / (receivingYears * 12))

    const income: IncomeInput = {
      simulation_id: simulationId,
      type: 'pension',
      title: '연금저축',
      owner: 'self',
      amount: monthlyAmount,
      frequency: 'monthly',
      start_year: startYear,
      start_month: 1,
      end_year: startYear + receivingYears,
      end_month: 12,
      rate_category: 'fixed',
      source_type: 'personal_pension',
      source_id: savedPension.id,
    }

    await supabase.from('incomes').insert(income)
  }

  // 본인 IRP
  if (data.irpBalance && data.irpBalance > 0) {
    const startAge = data.irpStartAge || 55
    const startYear = birthYear + startAge
    const receivingYears = data.irpReceivingYears || 20

    const pension: PersonalPensionInput = {
      simulation_id: simulationId,
      owner: 'self',
      pension_type: 'irp',
      current_balance: data.irpBalance,
      monthly_contribution: data.irpMonthlyContribution || null,
      start_age: startAge,
      receiving_years: receivingYears,
      return_rate: 4.0,
    }

    const { data: savedPension, error: pensionError } = await supabase
      .from('personal_pensions')
      .insert(pension)
      .select()
      .single()

    if (pensionError) throw pensionError

    // 연동 소득 생성
    const monthlyAmount = Math.round(pension.current_balance / (receivingYears * 12))

    const income: IncomeInput = {
      simulation_id: simulationId,
      type: 'pension',
      title: 'IRP',
      owner: 'self',
      amount: monthlyAmount,
      frequency: 'monthly',
      start_year: startYear,
      start_month: 1,
      end_year: startYear + receivingYears,
      end_month: 12,
      rate_category: 'fixed',
      source_type: 'personal_pension',
      source_id: savedPension.id,
    }

    await supabase.from('incomes').insert(income)
  }

  // 본인 ISA
  if (data.isaBalance && data.isaBalance > 0) {
    const pension: PersonalPensionInput = {
      simulation_id: simulationId,
      owner: 'self',
      pension_type: 'isa',
      current_balance: data.isaBalance,
      monthly_contribution: data.isaMonthlyContribution || null,
      return_rate: 4.0,
      isa_maturity_year: data.isaMaturityYear || null,
      isa_maturity_month: data.isaMaturityMonth || null,
      isa_maturity_strategy: data.isaMaturityStrategy || null,
    }

    await supabase.from('personal_pensions').insert(pension)
    // ISA는 만기 시 전환되므로 바로 소득 연동하지 않음
  }

  // 배우자 연금저축
  if (data.spousePensionSavingsBalance && data.spousePensionSavingsBalance > 0 && spouseBirthYear) {
    const startAge = data.spousePensionSavingsStartAge || 55
    const startYear = spouseBirthYear + startAge
    const receivingYears = data.spousePensionSavingsReceivingYears || 20

    const pension: PersonalPensionInput = {
      simulation_id: simulationId,
      owner: 'spouse',
      pension_type: 'pension_savings',
      current_balance: data.spousePensionSavingsBalance,
      monthly_contribution: data.spousePensionSavingsMonthlyContribution || null,
      start_age: startAge,
      receiving_years: receivingYears,
      return_rate: 4.0,
    }

    const { data: savedPension, error: pensionError } = await supabase
      .from('personal_pensions')
      .insert(pension)
      .select()
      .single()

    if (pensionError) throw pensionError

    const monthlyAmount = Math.round(pension.current_balance / (receivingYears * 12))

    const income: IncomeInput = {
      simulation_id: simulationId,
      type: 'pension',
      title: '배우자 연금저축',
      owner: 'spouse',
      amount: monthlyAmount,
      frequency: 'monthly',
      start_year: startYear,
      start_month: 1,
      end_year: startYear + receivingYears,
      end_month: 12,
      rate_category: 'fixed',
      source_type: 'personal_pension',
      source_id: savedPension.id,
    }

    await supabase.from('incomes').insert(income)
  }

  // 배우자 IRP
  if (data.spouseIrpBalance && data.spouseIrpBalance > 0 && spouseBirthYear) {
    const startAge = data.spouseIrpStartAge || 55
    const startYear = spouseBirthYear + startAge
    const receivingYears = data.spouseIrpReceivingYears || 20

    const pension: PersonalPensionInput = {
      simulation_id: simulationId,
      owner: 'spouse',
      pension_type: 'irp',
      current_balance: data.spouseIrpBalance,
      monthly_contribution: data.spouseIrpMonthlyContribution || null,
      start_age: startAge,
      receiving_years: receivingYears,
      return_rate: 4.0,
    }

    const { data: savedPension, error: pensionError } = await supabase
      .from('personal_pensions')
      .insert(pension)
      .select()
      .single()

    if (pensionError) throw pensionError

    const monthlyAmount = Math.round(pension.current_balance / (receivingYears * 12))

    const income: IncomeInput = {
      simulation_id: simulationId,
      type: 'pension',
      title: '배우자 IRP',
      owner: 'spouse',
      amount: monthlyAmount,
      frequency: 'monthly',
      start_year: startYear,
      start_month: 1,
      end_year: startYear + receivingYears,
      end_month: 12,
      rate_category: 'fixed',
      source_type: 'personal_pension',
      source_id: savedPension.id,
    }

    await supabase.from('incomes').insert(income)
  }

  // 배우자 ISA
  if (data.spouseIsaBalance && data.spouseIsaBalance > 0) {
    const pension: PersonalPensionInput = {
      simulation_id: simulationId,
      owner: 'spouse',
      pension_type: 'isa',
      current_balance: data.spouseIsaBalance,
      monthly_contribution: data.spouseIsaMonthlyContribution || null,
      return_rate: 4.0,
      isa_maturity_year: data.spouseIsaMaturityYear || null,
      isa_maturity_month: data.spouseIsaMaturityMonth || null,
      isa_maturity_strategy: data.spouseIsaMaturityStrategy || null,
    }

    await supabase.from('personal_pensions').insert(pension)
  }
}
