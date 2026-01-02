'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Users, TrendingUp, Wallet, Settings } from 'lucide-react'
import { useFinancialContext } from '@/contexts/FinancialContext'
import type { OnboardingData, GlobalSettings, FinancialItem, IncomeData, ExpenseData, SavingsData, DebtData, PensionData, RealEstateData, AssetData, DashboardIncomeItem, DashboardExpenseItem, SavingsAccount, InvestmentAccount, DebtInput, FinancialItemInput, PhysicalAsset, RealEstateProperty } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_SETTINGS } from '@/types'
import { Sidebar } from './components'
import {
  OverviewTab,
  NetWorthTab,
  CashFlowOverviewTab,
  TaxAnalyticsTab,
  IncomeTab,
  ExpenseTab,
  SavingsTab,
  AssetTab,
  DebtTab,
  RealEstateTab,
  PensionTab
} from './components/tabs'
import { ProgressSection } from './components/sections/ProgressSection'
import { PlansSection } from './components/sections/PlansSection'
import { ScenarioModal } from './components/modals/ScenarioModal'
import { FamilyModal } from './components/modals/FamilyModal'
import { CashFlowModal } from './components/modals/CashFlowModal'
import styles from './dashboard.module.css'

type ModalType = 'family' | 'scenario' | 'cashflow' | 'settings' | null

// FinancialItem[]을 OnboardingData 호환 형식으로 변환 (Phase 4까지 임시 호환 레이어)
function convertItemsToLegacyData(
  items: FinancialItem[],
  profile: { name: string; birth_date: string | null; target_retirement_age: number; target_retirement_fund?: number },
  globalSettings: GlobalSettings
): OnboardingData {
  const incomes = items.filter(i => i.category === 'income')
  const expenses = items.filter(i => i.category === 'expense')
  const savings = items.filter(i => i.category === 'savings')
  const debts = items.filter(i => i.category === 'debt')
  const pensions = items.filter(i => i.category === 'pension')
  const realEstates = items.filter(i => i.category === 'real_estate')

  // 본인 근로소득 찾기
  const selfLaborIncome = incomes.find(i => i.type === 'labor' && i.owner === 'self')
  const spouseLaborIncome = incomes.find(i => i.type === 'labor' && i.owner === 'spouse')
  const selfBusinessIncome = incomes.find(i => i.type === 'business' && i.owner === 'self')
  const spouseBusinessIncome = incomes.find(i => i.type === 'business' && i.owner === 'spouse')

  // 생활비 찾기
  const livingExpense = expenses.find(i => i.type === 'living')

  // 거주용 부동산 찾기
  const residence = realEstates.find(i => i.type === 'residence')
  const residenceData = residence?.data as RealEstateData | undefined

  // 저축 계좌 변환
  const savingsAccounts = savings
    .filter(i => ['emergency_fund', 'savings_account'].includes(i.type))
    .map(i => {
      const d = i.data as SavingsData
      return {
        id: i.id,
        type: i.type === 'emergency_fund' ? 'checking' as const : 'deposit' as const,
        name: i.title,
        balance: d.currentBalance || 0,
        interestRate: d.interestRate,
      }
    })

  // 투자 계좌 변환
  const investmentAccounts = savings
    .filter(i => ['stock', 'fund', 'crypto'].includes(i.type))
    .map(i => {
      const d = i.data as SavingsData
      return {
        id: i.id,
        type: i.type === 'stock' ? 'domestic_stock' as const :
              i.type === 'fund' ? 'fund' as const : 'other' as const,
        name: i.title,
        balance: d.currentBalance || 0,
        expectedReturn: d.interestRate,
      }
    })

  // 부채 변환
  const debtItems = debts.map(i => {
    const d = i.data as DebtData
    return {
      id: i.id,
      name: i.title,
      amount: d.currentBalance || d.principal || 0,
      rate: d.interestRate || 5,
      maturity: i.end_year && i.end_month ? `${i.end_year}-${String(i.end_month).padStart(2, '0')}` : null,
      repaymentType: d.repaymentType || '원리금균등상환',
    }
  })

  // 연금 데이터 추출
  const nationalPensionItem = pensions.find(i => i.type === 'national' && i.owner === 'self')
  const retirementPensionItem = pensions.find(i => i.type === 'retirement' && i.owner === 'self')
  const irpItem = pensions.find(i => i.type === 'irp' && i.owner === 'self')
  const pensionSavingsItem = pensions.find(i => i.type === 'personal' && i.owner === 'self')

  const nationalPensionData = nationalPensionItem?.data as PensionData | undefined
  const retirementPensionData = retirementPensionItem?.data as PensionData | undefined
  const irpData = irpItem?.data as PensionData | undefined
  const pensionSavingsData = pensionSavingsItem?.data as PensionData | undefined

  return {
    name: profile.name,
    gender: null,
    birth_date: profile.birth_date || '',
    target_retirement_age: profile.target_retirement_age,
    target_retirement_fund: profile.target_retirement_fund || 0,
    isMarried: !!spouseLaborIncome,
    spouse: spouseLaborIncome ? {
      relationship: 'spouse' as const,
      name: '배우자',
      birth_date: '',
      is_working: true,
      retirement_age: 60,
      monthly_income: (spouseLaborIncome.data as IncomeData).amount || 0,
    } : null,
    hasChildren: false,
    children: [],
    parents: [],
    laborIncome: selfLaborIncome ? (selfLaborIncome.data as IncomeData).amount : null,
    laborIncomeFrequency: 'monthly',
    spouseLaborIncome: spouseLaborIncome ? (spouseLaborIncome.data as IncomeData).amount : null,
    spouseLaborIncomeFrequency: 'monthly',
    businessIncome: selfBusinessIncome ? (selfBusinessIncome.data as IncomeData).amount : null,
    businessIncomeFrequency: 'monthly',
    spouseBusinessIncome: spouseBusinessIncome ? (spouseBusinessIncome.data as IncomeData).amount : null,
    spouseBusinessIncomeFrequency: 'monthly',
    livingExpenses: livingExpense ? (livingExpense.data as ExpenseData).amount : null,
    livingExpensesFrequency: 'monthly',
    housingType: residenceData?.housingType || null,
    housingValue: residenceData?.currentValue || null,
    housingRent: residenceData?.monthlyRent || null,
    housingMaintenance: null,
    housingHasLoan: residenceData?.hasLoan || false,
    housingLoan: residenceData?.loanAmount || null,
    housingLoanRate: residenceData?.loanRate || null,
    housingLoanMaturity: residenceData?.loanMaturityYear && residenceData?.loanMaturityMonth
      ? `${residenceData.loanMaturityYear}-${String(residenceData.loanMaturityMonth).padStart(2, '0')}`
      : null,
    housingLoanType: residenceData?.loanRepaymentType || null,
    savingsAccounts,
    investmentAccounts,
    physicalAssets: [],
    realEstateProperties: [],
    cashCheckingAccount: null,
    cashCheckingRate: null,
    cashSavingsAccount: null,
    cashSavingsRate: null,
    investDomesticStock: null,
    investDomesticRate: null,
    investForeignStock: null,
    investForeignRate: null,
    investFund: null,
    investFundRate: null,
    investOther: null,
    investOtherRate: null,
    hasNoAsset: false,
    incomes: [],
    expenses: [],
    realEstates: [],
    assets: [],
    debts: debtItems,
    hasNoDebt: debtItems.length === 0,
    nationalPension: nationalPensionData?.expectedMonthlyAmount || null,
    nationalPensionStartAge: nationalPensionData?.paymentStartAge || null,
    retirementPensionType: (retirementPensionData?.pensionType as 'DC' | 'DB') || 'DC',
    retirementPensionBalance: retirementPensionData?.currentBalance || null,
    retirementPensionReceiveType: null,
    retirementPensionStartAge: null,
    retirementPensionReceivingYears: null,
    personalPensionMonthly: null,
    personalPensionBalance: null,
    irpBalance: irpData?.currentBalance || null,
    irpMonthlyContribution: null,
    irpStartAge: null,
    irpReceivingYears: null,
    pensionSavingsBalance: pensionSavingsData?.currentBalance || null,
    pensionSavingsMonthlyContribution: null,
    pensionSavingsStartAge: null,
    pensionSavingsReceivingYears: null,
    isaBalance: null,
    isaMonthlyContribution: null,
    isaMaturityYear: null,
    isaMaturityMonth: null,
    isaMaturityStrategy: null,
    spouseIsaBalance: null,
    spouseIsaMonthlyContribution: null,
    spouseIsaMaturityYear: null,
    spouseIsaMaturityMonth: null,
    spouseIsaMaturityStrategy: null,
    personalPensionWithdrawYears: null,
    otherPensionMonthly: null,
    hasNoPension: pensions.length === 0,
    yearsOfService: null,
    spouseNationalPension: null,
    spouseNationalPensionStartAge: null,
    spouseRetirementPensionType: 'DC',
    spouseRetirementPensionBalance: null,
    spouseRetirementPensionReceiveType: null,
    spouseRetirementPensionStartAge: null,
    spouseRetirementPensionReceivingYears: null,
    spouseYearsOfService: null,
    spousePensionSavingsBalance: null,
    spousePensionSavingsMonthlyContribution: null,
    spousePensionSavingsStartAge: null,
    spousePensionSavingsReceivingYears: null,
    spouseIrpBalance: null,
    spouseIrpMonthlyContribution: null,
    spouseIrpStartAge: null,
    spouseIrpReceivingYears: null,
    cashFlowRules: [],
    pensions: [],
    globalSettings,
  }
}

const sectionTitles: Record<string, string> = {
  // Dashboard
  overview: '전체 요약',
  networth: '순자산',
  'cashflow-overview': '현금흐름',
  tax: '세금분석',
  // Finance
  income: '소득 관리',
  expense: '지출 관리',
  savings: '저축/투자 관리',
  asset: '실물 자산 관리',
  debt: '부채 관리',
  realEstate: '부동산 관리',
  pension: '연금 관리',
  // Others
  progress: '진행 상황',
  plans: '플랜',
}

const validSections = Object.keys(sectionTitles)

export function DashboardContent() {
  // Context에서 데이터 가져오기
  const {
    items,
    profile,
    globalSettings,
    updateGlobalSettings,
    addItem,
    updateItem,
    deleteItem,
    isLoading,
  } = useFinancialContext()

  const [currentSection, setCurrentSection] = useState<string>('overview')
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  // FinancialItem[]을 OnboardingData로 변환 (Phase 4까지 임시 호환 레이어)
  const data = useMemo(() => {
    return convertItemsToLegacyData(items, profile, globalSettings)
  }, [items, profile, globalSettings])

  // 기본 설정
  const settings = DEFAULT_SETTINGS

  // URL 해시에서 섹션 읽기
  const getHashSection = useCallback(() => {
    if (typeof window === 'undefined') return 'overview'
    const hash = window.location.hash.slice(1)
    return validSections.includes(hash) ? hash : 'overview'
  }, [])

  // 초기 로드 시 해시에서 섹션 설정
  useEffect(() => {
    setCurrentSection(getHashSection())
  }, [getHashSection])

  // 브라우저 뒤로가기/앞으로가기 처리
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentSection(getHashSection())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [getHashSection])

  // 섹션 변경 시 URL 해시 업데이트
  const handleSectionChange = useCallback((section: string) => {
    setCurrentSection(section)
    window.history.pushState(null, '', `#${section}`)
  }, [])

  // 마지막 저장된 items를 추적 (중복 저장 방지)
  const lastSavedIncomeRef = useRef<string>('')
  const lastSavedExpenseRef = useRef<string>('')
  const lastSavedSavingsRef = useRef<string>('')
  const lastSavedInvestmentRef = useRef<string>('')
  const lastSavedAssetsRef = useRef<string>('')
  const lastSavedRealEstateRef = useRef<string>('')

  // DashboardIncomeItem을 FinancialItemInput으로 변환
  const convertIncomeItemToFinancial = useCallback((
    item: DashboardIncomeItem,
    simulationId: string,
    retirementYear: number,
    spouseRetirementYear: number
  ): Omit<FinancialItemInput, 'simulation_id'> => {
    // 종료 연도 계산
    let endYear: number | undefined
    let endMonth: number | undefined

    if (item.endType === 'self-retirement') {
      endYear = retirementYear
      endMonth = 12
    } else if (item.endType === 'spouse-retirement') {
      endYear = spouseRetirementYear
      endMonth = 12
    } else if (item.endType === 'custom' && item.endYear) {
      endYear = item.endYear
      endMonth = item.endMonth || 12
    }

    // 타입 매핑 (DashboardIncomeItem.type → FinancialItemType)
    // IncomeType: 'labor' | 'business' | 'side_income' | 'rental' | 'dividend' | 'other'
    const typeMap: Record<string, 'labor' | 'business' | 'side_income' | 'rental' | 'dividend' | 'other'> = {
      labor: 'labor',
      business: 'business',
      regular: 'side_income',
      onetime: 'other',
      rental: 'rental',
      pension: 'other', // pension 소득은 별도 카테고리에서 처리
    }

    return {
      category: 'income',
      type: typeMap[item.type] || 'other',
      title: item.label,
      owner: item.owner || 'self',
      start_year: item.startYear,
      start_month: item.startMonth,
      end_year: endYear,
      end_month: endMonth,
      is_fixed_to_retirement_year: item.endType === 'self-retirement',
      data: {
        amount: item.amount,
        frequency: item.frequency || 'monthly',
        growthRate: item.growthRate || 0,
      } as IncomeData,
    }
  }, [])

  // DashboardExpenseItem을 FinancialItemInput으로 변환
  const convertExpenseItemToFinancial = useCallback((
    item: DashboardExpenseItem,
    retirementYear: number,
    spouseRetirementYear: number
  ): Omit<FinancialItemInput, 'simulation_id'> => {
    // 종료 연도 계산
    let endYear: number | undefined
    let endMonth: number | undefined

    if (item.endType === 'self-retirement') {
      endYear = retirementYear
      endMonth = 12
    } else if (item.endType === 'spouse-retirement') {
      endYear = spouseRetirementYear
      endMonth = 12
    } else if (item.endType === 'custom' && item.endYear) {
      endYear = item.endYear
      endMonth = item.endMonth || 12
    }

    // 타입 매핑 (DashboardExpenseType → ExpenseType)
    // ExpenseType: 'living' | 'housing' | 'maintenance' | 'education' | 'child' | 'insurance' | 'transport' | 'health' | 'travel' | 'parents' | 'wedding' | 'leisure' | 'other'
    const typeMap: Record<string, 'living' | 'housing' | 'maintenance' | 'education' | 'child' | 'insurance' | 'transport' | 'health' | 'travel' | 'parents' | 'wedding' | 'leisure' | 'other'> = {
      fixed: 'living',
      variable: 'other',
      onetime: 'other',
      medical: 'health',
      interest: 'other',
      housing: 'housing',
    }

    return {
      category: 'expense',
      type: typeMap[item.type] || 'other',
      title: item.label,
      owner: 'common',
      start_year: item.startYear,
      start_month: item.startMonth,
      end_year: endYear,
      end_month: endMonth,
      is_fixed_to_retirement_year: item.endType === 'self-retirement',
      data: {
        amount: item.amount,
        frequency: item.frequency || 'monthly',
        growthRate: item.growthRate || 0,
      } as ExpenseData,
    }
  }, [])

  // SavingsAccount를 FinancialItemInput으로 변환
  const convertSavingsAccountToFinancial = useCallback((
    account: SavingsAccount
  ): Omit<FinancialItemInput, 'simulation_id'> => {
    // 타입 매핑 (SavingsAccountType → SavingsType)
    // SavingsType: 'emergency_fund' | 'savings_account' | 'stock' | 'fund' | 'crypto' | 'other'
    const typeMap: Record<string, 'emergency_fund' | 'savings_account' | 'stock' | 'fund' | 'crypto' | 'other'> = {
      checking: 'emergency_fund',
      savings: 'savings_account',
      deposit: 'savings_account',
    }

    return {
      category: 'savings',
      type: typeMap[account.type] || 'savings_account',
      title: account.name,
      owner: 'self',
      end_year: account.maturityYear,
      end_month: account.maturityMonth,
      data: {
        currentBalance: account.balance,
        interestRate: account.interestRate || 0,
      } as SavingsData,
    }
  }, [])

  // InvestmentAccount를 FinancialItemInput으로 변환
  const convertInvestmentAccountToFinancial = useCallback((
    account: InvestmentAccount
  ): Omit<FinancialItemInput, 'simulation_id'> => {
    // 타입 매핑 (InvestmentAccountType → SavingsType)
    const typeMap: Record<string, 'emergency_fund' | 'savings_account' | 'stock' | 'fund' | 'crypto' | 'other'> = {
      domestic_stock: 'stock',
      foreign_stock: 'stock',
      fund: 'fund',
      bond: 'other',
      crypto: 'crypto',
      other: 'other',
    }

    return {
      category: 'savings',
      type: typeMap[account.type] || 'other',
      title: account.name,
      owner: 'self',
      data: {
        currentBalance: account.balance,
        interestRate: account.expectedReturn || 0,
      } as SavingsData,
    }
  }, [])

  // PhysicalAsset을 FinancialItemInput으로 변환
  const convertPhysicalAssetToFinancial = useCallback((
    asset: PhysicalAsset
  ): Omit<FinancialItemInput, 'simulation_id'> => {
    // 타입 매핑 (PhysicalAssetType → AssetType)
    // AssetType: 'deposit' | 'stock' | 'fund' | 'bond' | 'crypto' | 'vehicle' | 'other'
    const typeMap: Record<string, 'deposit' | 'stock' | 'fund' | 'bond' | 'crypto' | 'vehicle' | 'other'> = {
      car: 'vehicle',
      precious_metal: 'other', // gold → other (AssetType에 gold 없음)
      custom: 'other',
    }

    return {
      category: 'asset',
      type: typeMap[asset.type] || 'other',
      title: asset.name,
      owner: 'self',
      start_year: asset.purchaseYear,
      start_month: asset.purchaseMonth,
      data: {
        currentValue: asset.purchaseValue,
        purchaseValue: asset.purchaseValue,
        // 대출/할부 정보는 연동된 debt 항목에서 처리
      } as AssetData,
    }
  }, [])

  // RealEstateProperty를 FinancialItemInput으로 변환
  const convertRealEstatePropertyToFinancial = useCallback((
    property: RealEstateProperty
  ): Omit<FinancialItemInput, 'simulation_id'> => {
    // 타입 매핑 (RealEstateUsageType → RealEstateType)
    // RealEstateType: 'residence' | 'investment' | 'land' | 'other'
    const typeMap: Record<string, 'residence' | 'investment' | 'land' | 'other'> = {
      investment: 'investment',
      rental: 'investment', // rental → investment (RealEstateType에 rental 없음)
      land: 'land',
    }

    return {
      category: 'real_estate',
      type: typeMap[property.usageType] || 'investment',
      title: property.name,
      owner: 'self',
      start_year: property.purchaseYear,
      start_month: property.purchaseMonth,
      data: {
        currentValue: property.marketValue,
        purchaseValue: property.marketValue,
        monthlyRent: property.monthlyRent,
        hasLoan: property.hasLoan,
        loanAmount: property.loanAmount,
        loanRate: property.loanRate,
        loanMaturityYear: property.loanMaturity ? parseInt(property.loanMaturity.split('-')[0]) : undefined,
        loanMaturityMonth: property.loanMaturity ? parseInt(property.loanMaturity.split('-')[1]) : undefined,
        loanRepaymentType: property.loanRepaymentType,
      } as RealEstateData,
    }
  }, [])

  // OnboardingData 업데이트 핸들러 (incomeItems, expenseItems 지원)
  const handleUpdateData = useCallback(async (updates: Partial<OnboardingData>) => {
    // incomeItems 업데이트 처리
    if (updates.incomeItems) {
      const newItems = updates.incomeItems
      const newItemsStr = JSON.stringify(newItems)

      // 중복이 아닐 때만 처리
      if (newItemsStr !== lastSavedIncomeRef.current) {
        lastSavedIncomeRef.current = newItemsStr
        try {
          // 1. 기존 소득 항목 삭제 (임대소득만 제외 - 부동산에서 연동됨)
          const existingIncomes = items.filter(i => i.category === 'income')
          for (const item of existingIncomes) {
            if (item.type === 'rental') continue
            await deleteItem(item.id)
          }

          // 2. 새 소득 항목 추가
          const retirementYear = profile.birth_date
            ? parseInt(profile.birth_date.split('-')[0]) + profile.target_retirement_age
            : new Date().getFullYear() + 25
          const spouseRetirementYear = retirementYear

          for (const incomeItem of newItems) {
            if (incomeItem.isSystem) continue
            const financialInput = convertIncomeItemToFinancial(
              incomeItem, '', retirementYear, spouseRetirementYear
            )
            await addItem(financialInput)
          }
        } catch (error) {
          console.error('[DashboardContent] Failed to save income items:', error)
        }
      }
    }

    // expenseItems 업데이트 처리
    if (updates.expenseItems) {
      const newItems = updates.expenseItems
      const newItemsStr = JSON.stringify(newItems)

      if (newItemsStr !== lastSavedExpenseRef.current) {
        lastSavedExpenseRef.current = newItemsStr
        try {
          // 1. 기존 지출 항목 삭제 (연동된 항목 제외)
          const existingExpenses = items.filter(i => i.category === 'expense')
          for (const item of existingExpenses) {
            if (item.linked_item_id) continue
            await deleteItem(item.id)
          }

          // 2. 새 지출 항목 추가
          const retirementYear = profile.birth_date
            ? parseInt(profile.birth_date.split('-')[0]) + profile.target_retirement_age
            : new Date().getFullYear() + 25
          const spouseRetirementYear = retirementYear

          for (const expenseItem of newItems) {
            if (expenseItem.sourceType) continue
            const financialInput = convertExpenseItemToFinancial(
              expenseItem, retirementYear, spouseRetirementYear
            )
            await addItem(financialInput)
          }
        } catch (error) {
          console.error('[DashboardContent] Failed to save expense items:', error)
        }
      }
    }

    // savingsAccounts 업데이트 처리
    if (updates.savingsAccounts) {
      const newAccounts = updates.savingsAccounts
      const newAccountsStr = JSON.stringify(newAccounts)

      if (newAccountsStr !== lastSavedSavingsRef.current) {
        lastSavedSavingsRef.current = newAccountsStr
        try {
          const existingSavings = items.filter(i =>
            i.category === 'savings' && ['emergency_fund', 'savings_account'].includes(i.type)
          )
          for (const item of existingSavings) {
            await deleteItem(item.id)
          }
          for (const account of newAccounts) {
            const financialInput = convertSavingsAccountToFinancial(account)
            await addItem(financialInput)
          }
        } catch (error) {
          console.error('[DashboardContent] Failed to save savings accounts:', error)
        }
      }
    }

    // investmentAccounts 업데이트 처리
    if (updates.investmentAccounts) {
      const newAccounts = updates.investmentAccounts
      const newAccountsStr = JSON.stringify(newAccounts)

      if (newAccountsStr !== lastSavedInvestmentRef.current) {
        lastSavedInvestmentRef.current = newAccountsStr
        try {
          const existingInvestments = items.filter(i =>
            i.category === 'savings' && ['stock', 'fund', 'crypto', 'other'].includes(i.type)
          )
          for (const item of existingInvestments) {
            await deleteItem(item.id)
          }
          for (const account of newAccounts) {
            const financialInput = convertInvestmentAccountToFinancial(account)
            await addItem(financialInput)
          }
        } catch (error) {
          console.error('[DashboardContent] Failed to save investment accounts:', error)
        }
      }
    }

    // physicalAssets 업데이트 처리
    if (updates.physicalAssets) {
      const newAssets = updates.physicalAssets
      const newAssetsStr = JSON.stringify(newAssets)

      if (newAssetsStr !== lastSavedAssetsRef.current) {
        lastSavedAssetsRef.current = newAssetsStr
        try {
          // 1. 기존 asset 항목 삭제
          const existingAssets = items.filter(i => i.category === 'asset')
          for (const item of existingAssets) {
            await deleteItem(item.id)
          }

          // 2. 새 asset 항목 추가
          for (const asset of newAssets) {
            const financialInput = convertPhysicalAssetToFinancial(asset)
            await addItem(financialInput)
          }

          // 3. 연동된 debts도 함께 처리
          if (updates.debts) {
            for (const debt of updates.debts) {
              if (debt.sourceType === 'physicalAsset') {
                await addItem({
                  category: 'debt',
                  type: 'car_loan',
                  title: debt.name,
                  owner: 'self',
                  end_year: debt.maturity ? parseInt(debt.maturity.split('-')[0]) : undefined,
                  end_month: debt.maturity ? parseInt(debt.maturity.split('-')[1]) : undefined,
                  data: {
                    principal: debt.amount || 0,
                    currentBalance: debt.amount || 0,
                    interestRate: debt.rate || 0,
                    repaymentType: debt.repaymentType || '원리금균등상환',
                  } as DebtData,
                })
              }
            }
          }
        } catch (error) {
          console.error('[DashboardContent] Failed to save physical assets:', error)
        }
      }
    }

    // realEstateProperties 업데이트 처리
    if (updates.realEstateProperties) {
      const newProperties = updates.realEstateProperties
      const newPropertiesStr = JSON.stringify(newProperties)

      if (newPropertiesStr !== lastSavedRealEstateRef.current) {
        lastSavedRealEstateRef.current = newPropertiesStr
        try {
          // 1. 기존 real_estate 항목 삭제 (residence 제외 - 온보딩 데이터)
          const existingRealEstates = items.filter(i => i.category === 'real_estate' && i.type !== 'residence')
          for (const item of existingRealEstates) {
            await deleteItem(item.id)
          }

          // 2. 새 real_estate 항목 추가
          for (const property of newProperties) {
            const financialInput = convertRealEstatePropertyToFinancial(property)
            await addItem(financialInput)
          }

          // 3. 연동된 debts 처리
          if (updates.debts) {
            for (const debt of updates.debts) {
              if (debt.sourceType === 'realEstate') {
                await addItem({
                  category: 'debt',
                  type: 'mortgage',
                  title: debt.name,
                  owner: 'self',
                  end_year: debt.maturity ? parseInt(debt.maturity.split('-')[0]) : undefined,
                  end_month: debt.maturity ? parseInt(debt.maturity.split('-')[1]) : undefined,
                  data: {
                    principal: debt.amount || 0,
                    currentBalance: debt.amount || 0,
                    interestRate: debt.rate || 0,
                    repaymentType: debt.repaymentType || '원리금균등상환',
                  } as DebtData,
                })
              }
            }
          }

          // 4. 연동된 임대소득 처리 (incomeItems with sourceType: 'realEstate')
          if (updates.incomeItems) {
            // 기존 임대소득 삭제
            const existingRentalIncomes = items.filter(i => i.category === 'income' && i.type === 'rental')
            for (const item of existingRentalIncomes) {
              await deleteItem(item.id)
            }

            // 새 임대소득 추가
            for (const income of updates.incomeItems) {
              if (income.sourceType === 'realEstate') {
                await addItem({
                  category: 'income',
                  type: 'rental',
                  title: income.label,
                  owner: income.owner || 'self',
                  start_year: income.startYear,
                  start_month: income.startMonth,
                  data: {
                    amount: income.amount,
                    frequency: 'monthly',
                    growthRate: income.growthRate || 0,
                  } as IncomeData,
                })
              }
            }
          }
        } catch (error) {
          console.error('[DashboardContent] Failed to save real estate properties:', error)
        }
      }
    }

    // 국민연금 업데이트 처리
    if ('nationalPension' in updates || 'nationalPensionStartAge' in updates) {
      try {
        // 기존 국민연금 항목 찾기
        const existingNational = items.find(i => i.category === 'pension' && i.type === 'national' && i.owner === 'self')

        const amount = updates.nationalPension ?? data.nationalPension
        const startAge = updates.nationalPensionStartAge ?? data.nationalPensionStartAge

        if (existingNational) {
          await updateItem(existingNational.id, {
            data: {
              ...existingNational.data,
              expectedMonthlyAmount: amount,
              paymentStartAge: startAge,
            } as PensionData,
          })
        } else if (amount || startAge) {
          await addItem({
            category: 'pension',
            type: 'national',
            title: '국민연금',
            owner: 'self',
            data: {
              expectedMonthlyAmount: amount,
              paymentStartAge: startAge,
            } as PensionData,
          })
        }
      } catch (error) {
        console.error('[DashboardContent] Failed to save national pension:', error)
      }
    }

    // 퇴직연금 업데이트 처리
    if ('retirementPensionType' in updates || 'retirementPensionBalance' in updates || 'yearsOfService' in updates) {
      try {
        const existingRetirement = items.find(i => i.category === 'pension' && i.type === 'retirement' && i.owner === 'self')

        const pensionType = updates.retirementPensionType ?? data.retirementPensionType
        const balance = updates.retirementPensionBalance ?? data.retirementPensionBalance

        if (existingRetirement) {
          await updateItem(existingRetirement.id, {
            data: {
              ...existingRetirement.data,
              pensionType,
              currentBalance: balance,
            } as PensionData,
          })
        } else if (pensionType || balance) {
          await addItem({
            category: 'pension',
            type: 'retirement',
            title: '퇴직연금',
            owner: 'self',
            data: {
              pensionType,
              currentBalance: balance,
            } as PensionData,
          })
        }
      } catch (error) {
        console.error('[DashboardContent] Failed to save retirement pension:', error)
      }
    }

    // IRP 업데이트 처리
    if ('irpBalance' in updates || 'irpMonthlyContribution' in updates || 'irpStartAge' in updates) {
      try {
        const existingIrp = items.find(i => i.category === 'pension' && i.type === 'irp' && i.owner === 'self')

        const balance = updates.irpBalance ?? data.irpBalance
        const monthly = updates.irpMonthlyContribution ?? data.irpMonthlyContribution
        const startAge = updates.irpStartAge ?? data.irpStartAge
        const years = updates.irpReceivingYears ?? data.irpReceivingYears

        if (existingIrp) {
          await updateItem(existingIrp.id, {
            data: {
              ...existingIrp.data,
              currentBalance: balance,
              monthlyContribution: monthly,
              paymentStartAge: startAge,
              paymentYears: years,
            } as PensionData,
          })
        } else if (balance || monthly) {
          await addItem({
            category: 'pension',
            type: 'irp',
            title: 'IRP',
            owner: 'self',
            data: {
              currentBalance: balance,
              monthlyContribution: monthly,
              paymentStartAge: startAge,
              paymentYears: years,
            } as PensionData,
          })
        }
      } catch (error) {
        console.error('[DashboardContent] Failed to save IRP:', error)
      }
    }

    // 연금저축 업데이트 처리
    if ('pensionSavingsBalance' in updates || 'pensionSavingsMonthlyContribution' in updates || 'pensionSavingsStartAge' in updates) {
      try {
        const existingPersonal = items.find(i => i.category === 'pension' && i.type === 'personal' && i.owner === 'self')

        const balance = updates.pensionSavingsBalance ?? data.pensionSavingsBalance
        const monthly = updates.pensionSavingsMonthlyContribution ?? data.pensionSavingsMonthlyContribution
        const startAge = updates.pensionSavingsStartAge ?? data.pensionSavingsStartAge
        const years = updates.pensionSavingsReceivingYears ?? data.pensionSavingsReceivingYears

        if (existingPersonal) {
          await updateItem(existingPersonal.id, {
            data: {
              ...existingPersonal.data,
              currentBalance: balance,
              monthlyContribution: monthly,
              paymentStartAge: startAge,
              paymentYears: years,
            } as PensionData,
          })
        } else if (balance || monthly) {
          await addItem({
            category: 'pension',
            type: 'personal',
            title: '연금저축',
            owner: 'self',
            data: {
              currentBalance: balance,
              monthlyContribution: monthly,
              paymentStartAge: startAge,
              paymentYears: years,
            } as PensionData,
          })
        }
      } catch (error) {
        console.error('[DashboardContent] Failed to save pension savings:', error)
      }
    }

    // 배우자 국민연금 업데이트 처리
    if ('spouseNationalPension' in updates || 'spouseNationalPensionStartAge' in updates) {
      try {
        const existingSpouseNational = items.find(i => i.category === 'pension' && i.type === 'national' && i.owner === 'spouse')

        const amount = updates.spouseNationalPension ?? data.spouseNationalPension
        const startAge = updates.spouseNationalPensionStartAge ?? data.spouseNationalPensionStartAge

        if (existingSpouseNational) {
          await updateItem(existingSpouseNational.id, {
            data: {
              ...existingSpouseNational.data,
              expectedMonthlyAmount: amount,
              paymentStartAge: startAge,
            } as PensionData,
          })
        } else if (amount || startAge) {
          await addItem({
            category: 'pension',
            type: 'national',
            title: '배우자 국민연금',
            owner: 'spouse',
            data: {
              expectedMonthlyAmount: amount,
              paymentStartAge: startAge,
            } as PensionData,
          })
        }
      } catch (error) {
        console.error('[DashboardContent] Failed to save spouse national pension:', error)
      }
    }
  }, [items, data, profile, addItem, updateItem, deleteItem, convertIncomeItemToFinancial, convertExpenseItemToFinancial, convertSavingsAccountToFinancial, convertInvestmentAccountToFinancial, convertPhysicalAssetToFinancial, convertRealEstatePropertyToFinancial])

  const renderContent = () => {
    switch (currentSection) {
      // Dashboard tabs
      case 'overview':
        return <OverviewTab data={data} settings={settings} />
      case 'networth':
        return <NetWorthTab data={data} settings={settings} />
      case 'cashflow-overview':
        return <CashFlowOverviewTab data={data} settings={settings} />
      case 'tax':
        return <TaxAnalyticsTab data={data} settings={settings} />
      // Finance tabs
      case 'income':
        return <IncomeTab data={data} onUpdateData={handleUpdateData} globalSettings={globalSettings} />
      case 'expense':
        return <ExpenseTab data={data} onUpdateData={handleUpdateData} globalSettings={globalSettings} />
      case 'savings':
        return <SavingsTab data={data} onUpdateData={handleUpdateData} />
      case 'asset':
        return <AssetTab data={data} onUpdateData={handleUpdateData} />
      case 'debt':
        return <DebtTab data={data} onUpdateData={handleUpdateData} />
      case 'realEstate':
        return <RealEstateTab data={data} onUpdateData={handleUpdateData} />
      case 'pension':
        return <PensionTab data={data} onUpdateData={handleUpdateData} globalSettings={globalSettings} />
      // Other sections
      case 'progress':
        return <ProgressSection data={data} settings={settings} />
      case 'plans':
        return <PlansSection data={data} settings={settings} />
      default:
        return null
    }
  }

  // 글로벌 설정 업데이트
  const handleUpdateGlobalSettings = (newSettings: GlobalSettings) => {
    updateGlobalSettings(newSettings)
  }

  return (
    <div className={styles.layout}>
      <Sidebar
        currentSection={currentSection}
        onSectionChange={handleSectionChange}
        isExpanded={isSidebarExpanded}
        onExpandChange={setIsSidebarExpanded}
      />

      <main className={`${styles.main} ${isSidebarExpanded ? styles.mainExpanded : ''}`}>
        <header className={styles.header}>
          <h1 key={currentSection} className={styles.pageTitle}>{sectionTitles[currentSection]}</h1>

          <div className={styles.headerActions}>
            <button
              className={`${styles.headerActionBtn} ${activeModal === 'family' ? styles.active : ''}`}
              onClick={() => setActiveModal(activeModal === 'family' ? null : 'family')}
              title="가족 구성원"
            >
              <Users size={18} />
            </button>
            <button
              className={`${styles.headerActionBtn} ${activeModal === 'scenario' ? styles.active : ''}`}
              onClick={() => setActiveModal(activeModal === 'scenario' ? null : 'scenario')}
              title="시나리오 설정"
            >
              <TrendingUp size={18} />
            </button>
            <button
              className={`${styles.headerActionBtn} ${activeModal === 'cashflow' ? styles.active : ''}`}
              onClick={() => setActiveModal(activeModal === 'cashflow' ? null : 'cashflow')}
              title="현금 흐름 분배"
            >
              <Wallet size={18} />
            </button>
            <button
              className={`${styles.headerActionBtn} ${activeModal === 'settings' ? styles.active : ''}`}
              onClick={() => setActiveModal(activeModal === 'settings' ? null : 'settings')}
              title="설정"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className={styles.content}>
          {renderContent()}
        </div>
      </main>

      {/* 모달 */}
      {activeModal === 'scenario' && (
        <ScenarioModal
          globalSettings={globalSettings}
          onUpdate={handleUpdateGlobalSettings}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'family' && (
        <FamilyModal
          data={data}
          onUpdate={handleUpdateData}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'cashflow' && (
        <CashFlowModal
          data={data}
          onUpdate={handleUpdateData}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}
