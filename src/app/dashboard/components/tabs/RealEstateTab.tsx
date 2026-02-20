'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Building2, Plus, X, ArrowLeft } from 'lucide-react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { RealEstate, RealEstateType, HousingType, LoanRepaymentType } from '@/types/tables'
import { formatMoney, getDefaultRateCategory } from '@/lib/utils'
import { formatPeriodDisplay, toPeriodRaw, isPeriodValid, restorePeriodCursor, handlePeriodTextChange } from '@/lib/utils/periodInput'
import { useRealEstates, useInvalidateByCategory } from '@/hooks/useFinancialData'
import {
  createRealEstate,
  updateRealEstate,
  deleteRealEstate,
  REAL_ESTATE_TYPE_LABELS,
  HOUSING_TYPE_LABELS,
  REPAYMENT_TYPE_LABELS,
} from '@/lib/services/realEstateService'
import { TabSkeleton } from './shared/TabSkeleton'
import { useChartTheme } from '@/hooks/useChartTheme'
import { FinancialItemIcon } from '@/components/FinancialItemIcon'
import { FinancialIconPicker } from '@/components/FinancialIconPicker'
import styles from './RealEstateTab.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface RealEstateTabProps {
  simulationId: string
  birthYear: number
  spouseBirthYear?: number | null
  retirementAge: number
  spouseRetirementAge?: number
  isMarried: boolean
}

// 색상
const HOUSING_COLOR = '#007aff'
const USAGE_COLORS: Record<Exclude<RealEstateType, 'residence'>, string> = {
  investment: '#5856d6',
  rental: '#34c759',
  land: '#ff9500',
}

const TYPE_LABELS: Record<RealEstateType, string> = {
  residence: '거주용',
  investment: '투자용',
  rental: '임대용',
  land: '토지',
}

export function RealEstateTab({
  simulationId,
  birthYear,
  spouseBirthYear,
  retirementAge,
  spouseRetirementAge,
  isMarried,
}: RealEstateTabProps) {
  const { isDark } = useChartTheme()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const currentAge = currentYear - birthYear
  const selfRetirementYear = currentYear + (retirementAge - currentAge)
  const spouseCurrentAge = spouseBirthYear ? currentYear - spouseBirthYear : null
  const spouseRetirementYear = useMemo(() => {
    if (!spouseBirthYear || spouseCurrentAge === null) return selfRetirementYear
    return currentYear + ((spouseRetirementAge || 60) - spouseCurrentAge)
  }, [spouseBirthYear, currentYear, selfRetirementYear, spouseCurrentAge, spouseRetirementAge])
  const hasSpouse = isMarried && spouseBirthYear


  // React Query로 데이터 로드 (캐시에서 즉시 가져옴)
  const { data: dbRealEstates = [], isLoading } = useRealEstates(simulationId)
  const invalidate = useInvalidateByCategory(simulationId)

  // 편집 상태
  const [editingProperty, setEditingProperty] = useState<{ type: RealEstateType, id: string | null } | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editBooleans, setEditBooleans] = useState<{ hasRentalIncome: boolean, hasLoan: boolean, includeInCashflow: boolean }>({ hasRentalIncome: false, hasLoan: false, includeInCashflow: false })
  const [isSaving, setIsSaving] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  // Icon/color state
  const [editIcon, setEditIcon] = useState<string | null>(null)
  const [editColor, setEditColor] = useState<string | null>(null)

  // Rate category and owner state
  const [editRateCategory, setEditRateCategory] = useState<string>('realEstate')
  const [editCustomRate, setEditCustomRate] = useState("")
  const [editOwner, setEditOwner] = useState<'self' | 'spouse' | 'common'>('self')

  // Period text states
  const [purchaseDateText, setPurchaseDateText] = useState('')
  const [sellDateText, setSellDateText] = useState('')
  const [sellMode, setSellMode] = useState<'none' | 'custom'>('none')
  const [loanStartDateText, setLoanStartDateText] = useState('')
  const [loanMaturityDateText, setLoanMaturityDateText] = useState('')
  const [graceEndDateText, setGraceEndDateText] = useState('')

  // Preset types
  const [purchaseType, setPurchaseType] = useState<'current' | 'year'>('current')
  const [loanStartType, setLoanStartType] = useState<'current' | 'year'>('current')

  // 타입 선택 드롭다운
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [addingType, setAddingType] = useState<RealEstateType | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  // 타입별 분류
  const residenceProperties = useMemo(
    () => dbRealEstates.filter(p => p.type === 'residence'),
    [dbRealEstates]
  )
  const investmentProperties = useMemo(
    () => dbRealEstates.filter(p => p.type === 'investment'),
    [dbRealEstates]
  )
  const rentalProperties = useMemo(
    () => dbRealEstates.filter(p => p.type === 'rental'),
    [dbRealEstates]
  )
  const landProperties = useMemo(
    () => dbRealEstates.filter(p => p.type === 'land'),
    [dbRealEstates]
  )

  // 합계 계산
  const investmentTotal = investmentProperties.reduce((sum, p) => sum + p.current_value, 0)
  const rentalTotal = rentalProperties.reduce((sum, p) => sum + p.current_value, 0)
  const landTotal = landProperties.reduce((sum, p) => sum + p.current_value, 0)
  const additionalTotal = investmentTotal + rentalTotal + landTotal

  // 거주용 자산 (자가만 자산으로 계산)
  const housingAssetValue = residenceProperties
    .filter(p => p.housing_type === '자가')
    .reduce((sum, p) => sum + p.current_value, 0)
  const housingLoanAmount = residenceProperties
    .filter(p => p.has_loan)
    .reduce((sum, p) => sum + (p.loan_amount || 0), 0)

  // 총 부동산 자산
  const totalRealEstateValue = housingAssetValue + additionalTotal

  // 총 부동산 대출
  const additionalLoans = dbRealEstates
    .filter(p => p.type !== 'residence')
    .reduce((sum, p) => sum + (p.has_loan ? (p.loan_amount || 0) : 0), 0)
  const totalRealEstateLoans = housingLoanAmount + additionalLoans

  // 월 임대 수익 합계
  const totalMonthlyRent = dbRealEstates.reduce((sum, p) => {
    return sum + (p.has_rental_income ? (p.rental_monthly || 0) : 0)
  }, 0)

  // 순자산
  const netRealEstateValue = totalRealEstateValue - totalRealEstateLoans

  // LTV 비율
  const ltvRatio = totalRealEstateValue > 0
    ? Math.round((totalRealEstateLoans / totalRealEstateValue) * 100)
    : 0

  // 연간 임대 수익률
  const rentalPropertiesValue = dbRealEstates
    .filter(p => p.has_rental_income)
    .reduce((sum, p) => sum + p.current_value, 0)
  const annualRentalYield = rentalPropertiesValue > 0
    ? ((totalMonthlyRent * 12) / rentalPropertiesValue * 100).toFixed(1)
    : '0'

  // 평균 대출 금리 계산
  const loansWithRates: { amount: number; rate: number }[] = dbRealEstates
    .filter(p => p.has_loan && p.loan_amount && p.loan_rate)
    .map(p => ({ amount: p.loan_amount!, rate: p.loan_rate! }))
  const avgLoanRate = loansWithRates.length > 0
    ? (loansWithRates.reduce((sum, l) => sum + (l.amount * l.rate), 0) /
       loansWithRates.reduce((sum, l) => sum + l.amount, 0)).toFixed(2)
    : '0'

  // 레버리지 배율
  const leverageRatio = netRealEstateValue > 0
    ? (totalRealEstateValue / netRealEstateValue).toFixed(1)
    : '1.0'

  // 추가 폼 리셋
  const resetAddForm = () => {
    setShowTypeMenu(false)
    setAddingType(null)
    setEditingProperty(null)
    setEditValues({})
    setEditBooleans({ hasRentalIncome: false, hasLoan: false, includeInCashflow: false })
    setPurchaseDateText('')
    setSellDateText('')
    setLoanStartDateText('')
    setLoanMaturityDateText('')
    setGraceEndDateText('')
    setPurchaseType('current')
    setLoanStartType('current')
  }

  // 편집 시작 (거주용) - for step 2 in add modal or edit modal
  const initResidenceValues = (prop?: RealEstate | null) => {
    setEditingProperty({ type: 'residence', id: prop?.id || null })
    setEditBooleans({ hasRentalIncome: false, hasLoan: prop?.has_loan || false, includeInCashflow: prop?.include_in_cashflow || false })

    // Initialize period text states
    if (prop?.purchase_year && prop?.purchase_month) {
      setPurchaseDateText(toPeriodRaw(prop.purchase_year, prop.purchase_month))
      setPurchaseType('year')
    } else {
      setPurchaseDateText('')
      setPurchaseType('current')
    }

    if (prop?.loan_start_year && prop?.loan_start_month) {
      setLoanStartDateText(toPeriodRaw(prop.loan_start_year, prop.loan_start_month))
      setLoanStartType('year')
    } else {
      setLoanStartDateText('')
      setLoanStartType('current')
    }

    if (prop?.loan_maturity_year && prop?.loan_maturity_month) {
      setLoanMaturityDateText(toPeriodRaw(prop.loan_maturity_year, prop.loan_maturity_month))
    } else {
      setLoanMaturityDateText('')
    }

    if (prop?.grace_end_year && prop?.grace_end_month) {
      setGraceEndDateText(toPeriodRaw(prop.grace_end_year, prop.grace_end_month))
    } else {
      setGraceEndDateText('')
    }

    const hasSell = !!(prop?.sell_year && prop?.sell_month)
    setSellDateText(hasSell ? toPeriodRaw(prop.sell_year!, prop.sell_month!) : '')
    setSellMode(hasSell ? 'custom' : 'none')

    setEditValues({
      housingType: prop?.housing_type || '',
      currentValue: prop?.current_value?.toString() || '',
      purchaseYear: prop?.purchase_year?.toString() || '',
      purchaseMonth: prop?.purchase_month?.toString() || '',
      purchasePrice: prop?.purchase_price?.toString() || '',
      monthlyRent: prop?.monthly_rent?.toString() || '',
      maintenanceFee: prop?.maintenance_fee?.toString() || '',
      loanAmount: prop?.loan_amount?.toString() || '',
      loanRate: prop?.loan_rate?.toString() || '',
      loanStartYear: prop?.loan_start_year?.toString() || '',
      loanStartMonth: prop?.loan_start_month?.toString() || '',
      loanMaturityYear: prop?.loan_maturity_year?.toString() || '',
      loanMaturityMonth: prop?.loan_maturity_month?.toString() || '',
      loanRepaymentType: prop?.loan_repayment_type || '',
      graceEndYear: prop?.grace_end_year?.toString() || '',
      graceEndMonth: prop?.grace_end_month?.toString() || '',
    })
  }

  // 편집 시작 (추가 부동산) - for step 2 in add modal
  const initPropertyValues = (type: Exclude<RealEstateType, 'residence'>) => {
    setEditingProperty({ type, id: null })
    setEditBooleans({ hasRentalIncome: false, hasLoan: false, includeInCashflow: false })
    setEditRateCategory('realEstate')
    setEditCustomRate('')
    setEditOwner('self')

    // Initialize period text states to empty (will use presets)
    setPurchaseDateText('')
    setSellDateText('')
    setLoanStartDateText('')
    setLoanMaturityDateText('')
    setGraceEndDateText('')
    setPurchaseType('current')
    setLoanStartType('current')

    setEditValues({
      title: '',
      currentValue: '',
      purchaseYear: currentYear.toString(),
      purchaseMonth: currentMonth.toString(),
      rentalMonthly: '',
      rentalDeposit: '',
      loanAmount: '',
      loanRate: '',
      loanStartYear: currentYear.toString(),
      loanStartMonth: currentMonth.toString(),
      loanMaturityYear: '',
      loanMaturityMonth: '',
      loanRepaymentType: '',
      graceEndYear: '',
      graceEndMonth: '',
    })
  }

  const startEditProperty = (property: RealEstate) => {
    setEditingProperty({ type: property.type, id: property.id })

    // Set icon and color
    setEditIcon(property.icon || null)
    setEditColor(property.color || null)

    // Set rate category and owner
    const rateCategory = (property as any).rate_category || 'realEstate'
    setEditRateCategory(rateCategory)
    if (rateCategory === 'fixed') {
      setEditCustomRate(property.growth_rate?.toString() || '')
    } else {
      setEditCustomRate('')
    }
    setEditOwner(property.owner || 'self')

    // Initialize period text states
    if (property.purchase_year && property.purchase_month) {
      setPurchaseDateText(toPeriodRaw(property.purchase_year, property.purchase_month))
      setPurchaseType('year')
    } else {
      setPurchaseDateText('')
      setPurchaseType('current')
    }

    if (property.loan_start_year && property.loan_start_month) {
      setLoanStartDateText(toPeriodRaw(property.loan_start_year, property.loan_start_month))
      setLoanStartType('year')
    } else {
      setLoanStartDateText('')
      setLoanStartType('current')
    }

    if (property.loan_maturity_year && property.loan_maturity_month) {
      setLoanMaturityDateText(toPeriodRaw(property.loan_maturity_year, property.loan_maturity_month))
    } else {
      setLoanMaturityDateText('')
    }

    if (property.grace_end_year && property.grace_end_month) {
      setGraceEndDateText(toPeriodRaw(property.grace_end_year, property.grace_end_month))
    } else {
      setGraceEndDateText('')
    }

    const hasSellEdit = !!(property.sell_year && property.sell_month)
    setSellDateText(hasSellEdit ? toPeriodRaw(property.sell_year!, property.sell_month!) : '')
    setSellMode(hasSellEdit ? 'custom' : 'none')

    if (property.type === 'residence') {
      setEditBooleans({ hasRentalIncome: false, hasLoan: property.has_loan || false, includeInCashflow: property.include_in_cashflow || false })
      setEditValues({
        housingType: property.housing_type || '',
        currentValue: property.current_value?.toString() || '',
        purchaseYear: property.purchase_year?.toString() || '',
        purchaseMonth: property.purchase_month?.toString() || '',
        purchasePrice: property.purchase_price?.toString() || '',
        monthlyRent: property.monthly_rent?.toString() || '',
        maintenanceFee: property.maintenance_fee?.toString() || '',
        loanAmount: property.loan_amount?.toString() || '',
        loanRate: property.loan_rate?.toString() || '',
        loanStartYear: property.loan_start_year?.toString() || '',
        loanStartMonth: property.loan_start_month?.toString() || '',
        loanMaturityYear: property.loan_maturity_year?.toString() || '',
        loanMaturityMonth: property.loan_maturity_month?.toString() || '',
        loanRepaymentType: property.loan_repayment_type || '',
        graceEndYear: property.grace_end_year?.toString() || '',
        graceEndMonth: property.grace_end_month?.toString() || '',
      })
    } else {
      setEditBooleans({
        hasRentalIncome: property.has_rental_income || false,
        hasLoan: property.has_loan || false,
        includeInCashflow: property.include_in_cashflow || false,
      })
      setEditValues({
        title: property.title,
        currentValue: property.current_value.toString(),
        purchaseYear: property.purchase_year?.toString() || '',
        purchaseMonth: property.purchase_month?.toString() || '',
        rentalMonthly: property.rental_monthly?.toString() || '',
        rentalDeposit: property.rental_deposit?.toString() || '',
        loanAmount: property.loan_amount?.toString() || '',
        loanRate: property.loan_rate?.toString() || '',
        loanStartYear: property.loan_start_year?.toString() || '',
        loanStartMonth: property.loan_start_month?.toString() || '',
        loanMaturityYear: property.loan_maturity_year?.toString() || '',
        loanMaturityMonth: property.loan_maturity_month?.toString() || '',
        loanRepaymentType: property.loan_repayment_type || '',
        graceEndYear: property.grace_end_year?.toString() || '',
        graceEndMonth: property.grace_end_month?.toString() || '',
      })
    }
  }

  const cancelEdit = () => {
    setEditingProperty(null)
    setEditValues({})
    setEditBooleans({ hasRentalIncome: false, hasLoan: false, includeInCashflow: false })
    setPurchaseDateText('')
    setSellDateText('')
    setLoanStartDateText('')
    setLoanMaturityDateText('')
    setGraceEndDateText('')
    setPurchaseType('current')
    setLoanStartType('current')
    setEditIcon(null)
    setEditColor(null)
  }

  // 저장 (거주용)
  const saveResidence = async () => {
    if (!editingProperty) return
    setIsSaving(true)

    try {
      const housingType = editValues.housingType as HousingType | null

      // Parse purchase date
      let purchaseYear: number | null = null
      let purchaseMonth: number | null = null
      if (purchaseType === 'current') {
        purchaseYear = currentYear
        purchaseMonth = currentMonth
      } else if (purchaseDateText.length === 6 && isPeriodValid(purchaseDateText)) {
        purchaseYear = parseInt(purchaseDateText.slice(0, 4))
        purchaseMonth = parseInt(purchaseDateText.slice(4))
      }

      // Parse loan start date
      let loanStartYear: number | null = null
      let loanStartMonth: number | null = null
      if (editBooleans.hasLoan) {
        if (loanStartType === 'current') {
          loanStartYear = currentYear
          loanStartMonth = currentMonth
        } else if (loanStartDateText.length === 6 && isPeriodValid(loanStartDateText)) {
          loanStartYear = parseInt(loanStartDateText.slice(0, 4))
          loanStartMonth = parseInt(loanStartDateText.slice(4))
        }
      }

      // Parse loan maturity date
      let loanMaturityYear: number | null = null
      let loanMaturityMonth: number | null = null
      if (editBooleans.hasLoan && loanMaturityDateText.length === 6 && isPeriodValid(loanMaturityDateText)) {
        loanMaturityYear = parseInt(loanMaturityDateText.slice(0, 4))
        loanMaturityMonth = parseInt(loanMaturityDateText.slice(4))
      }

      // Parse grace end date
      let graceEndYear: number | null = null
      let graceEndMonth: number | null = null
      if (editBooleans.hasLoan && editValues.loanRepaymentType === '거치식상환' && graceEndDateText.length === 6 && isPeriodValid(graceEndDateText)) {
        graceEndYear = parseInt(graceEndDateText.slice(0, 4))
        graceEndMonth = parseInt(graceEndDateText.slice(4))
      }

      // Parse sell date
      let sellYear: number | null = null
      let sellMonth: number | null = null
      if (sellDateText.length === 6 && isPeriodValid(sellDateText)) {
        sellYear = parseInt(sellDateText.slice(0, 4))
        sellMonth = parseInt(sellDateText.slice(4))
      }

      const title = housingType === '자가' ? '자가 주택' : housingType === '전세' ? '전세 주택' : '월세 주택'
      const input = {
        simulation_id: simulationId,
        type: 'residence' as const,
        title,
        owner: 'self' as const,
        housing_type: housingType,
        current_value: editValues.currentValue ? parseFloat(editValues.currentValue) : 0,
        purchase_price: editValues.purchasePrice ? parseFloat(editValues.purchasePrice) : null,
        purchase_year: purchaseYear,
        purchase_month: purchaseMonth,
        deposit: housingType !== '자가' ? (editValues.currentValue ? parseFloat(editValues.currentValue) : null) : null,
        monthly_rent: editValues.monthlyRent ? parseFloat(editValues.monthlyRent) : null,
        maintenance_fee: editValues.maintenanceFee ? parseFloat(editValues.maintenanceFee) : null,
        has_loan: editBooleans.hasLoan,
        loan_amount: editValues.loanAmount ? parseFloat(editValues.loanAmount) : null,
        loan_rate: editValues.loanRate ? parseFloat(editValues.loanRate) : null,
        loan_start_year: loanStartYear,
        loan_start_month: loanStartMonth,
        loan_maturity_year: loanMaturityYear,
        loan_maturity_month: loanMaturityMonth,
        loan_repayment_type: editValues.loanRepaymentType as LoanRepaymentType | null,
        grace_end_year: graceEndYear,
        grace_end_month: graceEndMonth,
        sell_year: sellYear,
        sell_month: sellMonth,
        include_in_cashflow: editBooleans.includeInCashflow,
      }

      if (editingProperty.id) {
        await updateRealEstate(editingProperty.id, input)
      } else {
        await createRealEstate(input)
      }

      invalidate('realEstates')
      resetAddForm()
    } catch (error) {
      console.error('Failed to save residence:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 저장 (추가 부동산)
  const saveProperty = async () => {
    if (!editingProperty || !editValues.title || !editValues.currentValue) return
    setIsSaving(true)

    try {
      // Compute growth_rate based on rate category
      let growthRate: number | undefined
      if (editRateCategory === 'fixed') {
        growthRate = editCustomRate ? parseFloat(editCustomRate) : 0
      } else {
        growthRate = 3.0
      }

      // Parse purchase date
      let purchaseYear: number | null = null
      let purchaseMonth: number | null = null
      if (purchaseType === 'current') {
        purchaseYear = currentYear
        purchaseMonth = currentMonth
      } else if (purchaseDateText.length === 6 && isPeriodValid(purchaseDateText)) {
        purchaseYear = parseInt(purchaseDateText.slice(0, 4))
        purchaseMonth = parseInt(purchaseDateText.slice(4))
      }

      // Parse loan start date
      let loanStartYear: number | null = null
      let loanStartMonth: number | null = null
      if (editBooleans.hasLoan) {
        if (loanStartType === 'current') {
          loanStartYear = currentYear
          loanStartMonth = currentMonth
        } else if (loanStartDateText.length === 6 && isPeriodValid(loanStartDateText)) {
          loanStartYear = parseInt(loanStartDateText.slice(0, 4))
          loanStartMonth = parseInt(loanStartDateText.slice(4))
        }
      }

      // Parse loan maturity date
      let loanMaturityYear: number | null = null
      let loanMaturityMonth: number | null = null
      if (editBooleans.hasLoan && loanMaturityDateText.length === 6 && isPeriodValid(loanMaturityDateText)) {
        loanMaturityYear = parseInt(loanMaturityDateText.slice(0, 4))
        loanMaturityMonth = parseInt(loanMaturityDateText.slice(4))
      }

      // Parse grace end date
      let graceEndYear: number | null = null
      let graceEndMonth: number | null = null
      if (editBooleans.hasLoan && editValues.loanRepaymentType === '거치식상환' && graceEndDateText.length === 6 && isPeriodValid(graceEndDateText)) {
        graceEndYear = parseInt(graceEndDateText.slice(0, 4))
        graceEndMonth = parseInt(graceEndDateText.slice(4))
      }

      // Parse sell date
      let sellYear: number | null = null
      let sellMonth: number | null = null
      if (sellDateText.length === 6 && isPeriodValid(sellDateText)) {
        sellYear = parseInt(sellDateText.slice(0, 4))
        sellMonth = parseInt(sellDateText.slice(4))
      }

      const input = {
        simulation_id: simulationId,
        type: editingProperty.type,
        title: editValues.title,
        owner: editOwner,
        current_value: parseFloat(editValues.currentValue) || 0,
        icon: editIcon,
        color: editColor,
        purchase_year: purchaseYear,
        purchase_month: purchaseMonth,
        growth_rate: growthRate,
        rate_category: editRateCategory,
        has_rental_income: editBooleans.hasRentalIncome,
        rental_monthly: editBooleans.hasRentalIncome && editValues.rentalMonthly ? parseFloat(editValues.rentalMonthly) : null,
        rental_deposit: editBooleans.hasRentalIncome && editValues.rentalDeposit ? parseFloat(editValues.rentalDeposit) : null,
        rental_start_year: editBooleans.hasRentalIncome ? currentYear : null,
        rental_start_month: editBooleans.hasRentalIncome ? currentMonth : null,
        has_loan: editBooleans.hasLoan,
        loan_amount: editBooleans.hasLoan && editValues.loanAmount ? parseFloat(editValues.loanAmount) : null,
        loan_rate: editBooleans.hasLoan && editValues.loanRate ? parseFloat(editValues.loanRate) : null,
        loan_start_year: loanStartYear,
        loan_start_month: loanStartMonth,
        loan_maturity_year: loanMaturityYear,
        loan_maturity_month: loanMaturityMonth,
        loan_repayment_type: editBooleans.hasLoan && editValues.loanRepaymentType
          ? editValues.loanRepaymentType as LoanRepaymentType
          : null,
        grace_end_year: graceEndYear,
        grace_end_month: graceEndMonth,
        sell_year: sellYear,
        sell_month: sellMonth,
        include_in_cashflow: editBooleans.includeInCashflow,
      } as any

      if (editingProperty.id) {
        await updateRealEstate(editingProperty.id, input)
      } else {
        await createRealEstate(input)
      }

      invalidate('realEstates')
      resetAddForm()
    } catch (error) {
      console.error('Failed to save property:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsSaving(true)

    try {
      await deleteRealEstate(id)
      invalidate('realEstates')
    } catch (error) {
      console.error('Failed to delete property:', error)
    } finally {
      setIsSaving(false)
    }
  }


  // 대출 폼 공통 (모달용)
  const renderLoanFields = () => {
    const hasLoan = editBooleans.hasLoan
    return (
      <>
        {hasLoan && (
          <>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>대출금액</span>
              <input
                type="number"
                className={styles.modalFormInput}
                value={editValues.loanAmount || ''}
                onChange={e => setEditValues({ ...editValues, loanAmount: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.modalFormUnit}>만원</span>
            </div>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>금리</span>
              <input
                type="number"
                className={styles.modalFormInputSmall}
                value={editValues.loanRate || ''}
                onChange={e => setEditValues({ ...editValues, loanRate: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                step="0.1"
                placeholder="3.5"
              />
              <span className={styles.modalFormUnit}>%</span>
            </div>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>대출시작</span>
              <div className={styles.fieldContent}>
                <select
                  className={styles.periodSelect}
                  value={loanStartType}
                  onChange={(e) => {
                    const type = e.target.value as 'current' | 'year'
                    setLoanStartType(type)
                    if (type === 'current') {
                      setLoanStartDateText('')
                      setEditValues({ ...editValues, loanStartYear: currentYear.toString(), loanStartMonth: currentMonth.toString() })
                    }
                  }}
                >
                  <option value="current">현재</option>
                  <option value="year">직접 입력</option>
                </select>
                {loanStartType === 'year' && (
                  <input
                    type="text"
                    className={`${styles.periodInput}${loanStartDateText.length > 0 && !isPeriodValid(loanStartDateText) ? ` ${styles.invalid}` : ''}`}
                    value={formatPeriodDisplay(loanStartDateText)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 6)
                      restorePeriodCursor(e.target, raw)
                      setLoanStartDateText(raw)
                      if (raw.length >= 4) {
                        const y = parseInt(raw.slice(0, 4))
                        if (!isNaN(y)) setEditValues({ ...editValues, loanStartYear: y.toString() })
                      }
                      if (raw.length >= 5) {
                        const m = parseInt(raw.slice(4))
                        if (!isNaN(m) && m >= 1 && m <= 12) setEditValues({ ...editValues, loanStartMonth: m.toString() })
                      }
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="2026.01"
                  />
                )}
              </div>
            </div>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>만기</span>
              <div className={styles.fieldContent}>
                <input
                  type="text"
                  className={`${styles.periodInput}${loanMaturityDateText.length > 0 && !isPeriodValid(loanMaturityDateText) ? ` ${styles.invalid}` : ''}`}
                  value={formatPeriodDisplay(loanMaturityDateText)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 6)
                    restorePeriodCursor(e.target, raw)
                    setLoanMaturityDateText(raw)
                    if (raw.length >= 4) {
                      const y = parseInt(raw.slice(0, 4))
                      if (!isNaN(y)) setEditValues({ ...editValues, loanMaturityYear: y.toString() })
                    }
                    if (raw.length >= 5) {
                      const m = parseInt(raw.slice(4))
                      if (!isNaN(m) && m >= 1 && m <= 12) setEditValues({ ...editValues, loanMaturityMonth: m.toString() })
                    }
                  }}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  placeholder="2030.12"
                />
              </div>
            </div>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>상환</span>
              <div className={styles.repaymentButtons}>
                {(['원리금균등상환', '원금균등상환', '만기일시상환', '거치식상환'] as const).map(repType => (
                  <button
                    key={repType}
                    type="button"
                    className={`${styles.repaymentBtn} ${editValues.loanRepaymentType === repType ? styles.active : ''}`}
                    onClick={() => setEditValues({ ...editValues, loanRepaymentType: repType })}
                  >
                    {REPAYMENT_TYPE_LABELS[repType]}
                  </button>
                ))}
              </div>
            </div>
            {editValues.loanRepaymentType === '거치식상환' && (
              <div className={styles.modalFormRow}>
                <span className={styles.modalFormLabel}>거치종료</span>
                <div className={styles.fieldContent}>
                  <input
                    type="text"
                    className={`${styles.periodInput}${graceEndDateText.length > 0 && !isPeriodValid(graceEndDateText) ? ` ${styles.invalid}` : ''}`}
                    value={formatPeriodDisplay(graceEndDateText)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 6)
                      restorePeriodCursor(e.target, raw)
                      setGraceEndDateText(raw)
                      if (raw.length >= 4) {
                        const y = parseInt(raw.slice(0, 4))
                        if (!isNaN(y)) setEditValues({ ...editValues, graceEndYear: y.toString() })
                      }
                      if (raw.length >= 5) {
                        const m = parseInt(raw.slice(4))
                        if (!isNaN(m) && m >= 1 && m <= 12) setEditValues({ ...editValues, graceEndMonth: m.toString() })
                      }
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="2028.06"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </>
    )
  }

  // 거주용 모달 폼
  const renderResidenceModalForm = () => {
    const housingType = editValues.housingType
    const hasLoan = editBooleans.hasLoan
    const isEditMode = !!(editingProperty?.id)

    return (
      <>
        {/* 거주형태 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>거주형태</span>
          <div className={styles.typeButtons}>
            {(['자가', '전세', '월세'] as const).map(type => (
              <button
                key={type}
                type="button"
                className={`${styles.typeBtn} ${housingType === type ? styles.active : ''}`}
                onClick={() => setEditValues({ ...editValues, housingType: type })}
              >
                {HOUSING_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {housingType && (
          <>
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>
                {housingType === '자가' ? '시세' : '보증금'}
              </span>
              <input
                type="number"
                className={styles.modalFormInput}
                value={editValues.currentValue || ''}
                onChange={e => setEditValues({ ...editValues, currentValue: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.modalFormUnit}>만원</span>
            </div>

            {housingType === '자가' && (
              <>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>취득일자</span>
                  <div className={styles.fieldContent}>
                    <select
                      className={styles.periodSelect}
                      value={purchaseType}
                      onChange={(e) => {
                        const type = e.target.value as 'current' | 'year'
                        setPurchaseType(type)
                        if (type === 'current') {
                          setPurchaseDateText('')
                          setEditValues({ ...editValues, purchaseYear: currentYear.toString(), purchaseMonth: currentMonth.toString() })
                        }
                      }}
                    >
                      <option value="current">현재</option>
                      <option value="year">직접 입력</option>
                    </select>
                    {purchaseType === 'year' && (
                      <input
                        type="text"
                        className={`${styles.periodInput}${purchaseDateText.length > 0 && !isPeriodValid(purchaseDateText) ? ` ${styles.invalid}` : ''}`}
                        value={formatPeriodDisplay(purchaseDateText)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '').slice(0, 6)
                          restorePeriodCursor(e.target, raw)
                          setPurchaseDateText(raw)
                          if (raw.length >= 4) {
                            const y = parseInt(raw.slice(0, 4))
                            if (!isNaN(y)) setEditValues({ ...editValues, purchaseYear: y.toString() })
                          }
                          if (raw.length >= 5) {
                            const m = parseInt(raw.slice(4))
                            if (!isNaN(m) && m >= 1 && m <= 12) setEditValues({ ...editValues, purchaseMonth: m.toString() })
                          }
                        }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        placeholder="2026.01"
                      />
                    )}
                  </div>
                </div>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>취득가</span>
                  <input
                    type="number"
                    className={styles.modalFormInput}
                    value={editValues.purchasePrice || ''}
                    onChange={e => setEditValues({ ...editValues, purchasePrice: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder="0"
                  />
                  <span className={styles.modalFormUnit}>만원</span>
                </div>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}></span>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={editBooleans.includeInCashflow}
                      onChange={e => setEditBooleans({ ...editBooleans, includeInCashflow: e.target.checked })}
                    />
                    <span className={styles.checkboxText}>현금 흐름으로 처리</span>
                  </label>
                </div>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>매각 예정</span>
                  <div className={styles.fieldContent}>
                    <div className={styles.typeButtons}>
                      <button
                        type="button"
                        className={`${styles.typeBtn} ${sellMode === 'none' ? styles.active : ''}`}
                        onClick={() => { setSellMode('none'); setSellDateText('') }}
                      >
                        매각 안함
                      </button>
                      <button
                        type="button"
                        className={`${styles.typeBtn} ${sellMode === 'custom' ? styles.active : ''}`}
                        onClick={() => setSellMode('custom')}
                      >
                        직접 입력
                      </button>
                    </div>
                    {sellMode === 'custom' && (
                      <input
                        type="text"
                        className={styles.periodInput}
                        value={formatPeriodDisplay(sellDateText)}
                        onChange={(e) => {
                          handlePeriodTextChange(e, setSellDateText, () => {}, () => {})
                        }}
                        placeholder="2030.01"
                        maxLength={7}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {housingType === '월세' && (
              <div className={styles.modalFormRow}>
                <span className={styles.modalFormLabel}>월세</span>
                <input
                  type="number"
                  className={styles.modalFormInput}
                  value={editValues.monthlyRent || ''}
                  onChange={e => setEditValues({ ...editValues, monthlyRent: e.target.value })}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  placeholder="0"
                />
                <span className={styles.modalFormUnit}>만원</span>
              </div>
            )}

            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>관리비</span>
              <input
                type="number"
                className={styles.modalFormInput}
                value={editValues.maintenanceFee || ''}
                onChange={e => setEditValues({ ...editValues, maintenanceFee: e.target.value })}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder="0"
              />
              <span className={styles.modalFormUnit}>만원/월</span>
            </div>

            <div className={styles.modalDivider} />

            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>
                {housingType === '자가' ? '주담대' : '전월세대출'}
              </span>
              <div className={styles.typeButtons}>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${!hasLoan ? styles.active : ''}`}
                  onClick={() => setEditBooleans({ ...editBooleans, hasLoan: false })}
                >
                  없음
                </button>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${hasLoan ? styles.active : ''}`}
                  onClick={() => setEditBooleans({ ...editBooleans, hasLoan: true })}
                >
                  있음
                </button>
              </div>
            </div>

            {renderLoanFields()}
          </>
        )}

        <div className={styles.modalFormActions}>
          <button
            className={styles.modalCancelBtn}
            onClick={isEditMode ? cancelEdit : resetAddForm}
            disabled={isSaving}
          >
            취소
          </button>
          <button
            className={styles.modalAddBtn}
            onClick={saveResidence}
            disabled={isSaving}
          >
            {isSaving ? '저장 중...' : (isEditMode ? '저장' : '추가')}
          </button>
        </div>
      </>
    )
  }

  // 추가 부동산 모달 폼
  const renderPropertyModalForm = (type: Exclude<RealEstateType, 'residence'>) => {
    const namePlaceholder = type === 'investment'
      ? '예: 판교 아파트, 분당 빌라'
      : type === 'rental'
        ? '예: 강남 오피스텔, 홍대 상가'
        : '예: 경기 토지, 제주 땅'

    const hasRentalIncome = editBooleans.hasRentalIncome
    const hasLoan = editBooleans.hasLoan
    const showRentalOption = type === 'rental' || type === 'investment'
    const isEditMode = !!(editingProperty?.id)

    return (
      <>
        {/* 부동산명 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>부동산명</span>
          <input
            type="text"
            className={styles.modalFormInput}
            value={editValues.title || ''}
            onChange={e => setEditValues({ ...editValues, title: e.target.value })}
            placeholder={namePlaceholder}
            autoFocus={!isEditMode}
          />
        </div>

        {/* 소유자 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>소유자</span>
          <div className={styles.ownerButtons}>
            <button
              type="button"
              className={`${styles.ownerBtn} ${editOwner === 'self' ? styles.active : ''}`}
              onClick={() => setEditOwner('self')}
            >
              본인
            </button>
            {hasSpouse && (
              <button
                type="button"
                className={`${styles.ownerBtn} ${editOwner === 'spouse' ? styles.active : ''}`}
                onClick={() => setEditOwner('spouse')}
              >
                배우자
              </button>
            )}
          </div>
        </div>

        {/* 시세 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>시세</span>
          <input
            type="number"
            className={styles.modalFormInput}
            value={editValues.currentValue || ''}
            onChange={e => setEditValues({ ...editValues, currentValue: e.target.value })}
            onWheel={e => (e.target as HTMLElement).blur()}
            placeholder="0"
          />
          <span className={styles.modalFormUnit}>만원</span>
        </div>

        {/* 취득일 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>취득일</span>
          <div className={styles.fieldContent}>
            <select
              className={styles.periodSelect}
              value={purchaseType}
              onChange={(e) => {
                const type = e.target.value as 'current' | 'year'
                setPurchaseType(type)
                if (type === 'current') {
                  setPurchaseDateText('')
                  setEditValues({ ...editValues, purchaseYear: currentYear.toString(), purchaseMonth: currentMonth.toString() })
                }
              }}
            >
              <option value="current">현재</option>
              <option value="year">직접 입력</option>
            </select>
            {purchaseType === 'year' && (
              <input
                type="text"
                className={`${styles.periodInput}${purchaseDateText.length > 0 && !isPeriodValid(purchaseDateText) ? ` ${styles.invalid}` : ''}`}
                value={formatPeriodDisplay(purchaseDateText)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 6)
                  restorePeriodCursor(e.target, raw)
                  setPurchaseDateText(raw)
                  if (raw.length >= 4) {
                    const y = parseInt(raw.slice(0, 4))
                    if (!isNaN(y)) setEditValues({ ...editValues, purchaseYear: y.toString() })
                  }
                  if (raw.length >= 5) {
                    const m = parseInt(raw.slice(4))
                    if (!isNaN(m) && m >= 1 && m <= 12) setEditValues({ ...editValues, purchaseMonth: m.toString() })
                  }
                }}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="2026.01"
              />
            )}
          </div>
        </div>

        {/* 현금 흐름 처리 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}></span>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={editBooleans.includeInCashflow}
              onChange={e => setEditBooleans({ ...editBooleans, includeInCashflow: e.target.checked })}
            />
            <span className={styles.checkboxText}>현금 흐름으로 처리</span>
          </label>
        </div>

        {/* 부동산 상승률 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>상승률</span>
          <div className={styles.fieldContent}>
            {editRateCategory !== 'fixed' ? (
              <>
                <span className={styles.rateValue}>시뮬레이션 가정</span>
                <div className={styles.rateToggle}>
                  <button
                    type="button"
                    className={`${styles.rateToggleBtn} ${editRateCategory !== 'fixed' ? styles.active : ''}`}
                    onClick={() => setEditRateCategory('realEstate')}
                  >
                    시뮬레이션 가정
                  </button>
                  <button
                    type="button"
                    className={`${styles.rateToggleBtn} ${editRateCategory === 'fixed' ? styles.active : ''}`}
                    onClick={() => setEditRateCategory('fixed')}
                  >
                    직접 입력
                  </button>
                </div>
              </>
            ) : (
              <>
                <input
                  type="number"
                  className={styles.customRateInput}
                  value={editCustomRate}
                  onChange={(e) => setEditCustomRate(e.target.value)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  step="0.1"
                  placeholder="0"
                />
                <span className={styles.rateUnit}>%</span>
                <div className={styles.rateToggle}>
                  <button
                    type="button"
                    className={`${styles.rateToggleBtn} ${editRateCategory !== 'fixed' ? styles.active : ''}`}
                    onClick={() => setEditRateCategory('realEstate')}
                  >
                    시뮬레이션 가정
                  </button>
                  <button
                    type="button"
                    className={`${styles.rateToggleBtn} ${editRateCategory === 'fixed' ? styles.active : ''}`}
                    onClick={() => setEditRateCategory('fixed')}
                  >
                    직접 입력
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 매각 예정 */}
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>매각 예정</span>
          <div className={styles.fieldContent}>
            <div className={styles.typeButtons}>
              <button
                type="button"
                className={`${styles.typeBtn} ${sellMode === 'none' ? styles.active : ''}`}
                onClick={() => { setSellMode('none'); setSellDateText('') }}
              >
                매각 안함
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${sellMode === 'custom' ? styles.active : ''}`}
                onClick={() => setSellMode('custom')}
              >
                직접 입력
              </button>
            </div>
            {sellMode === 'custom' && (
              <input
                type="text"
                className={styles.periodInput}
                value={formatPeriodDisplay(sellDateText)}
                onChange={(e) => {
                  handlePeriodTextChange(e, setSellDateText, () => {}, () => {})
                }}
                placeholder="2030.01"
                maxLength={7}
              />
            )}
          </div>
        </div>

        {/* 임대 수익 (투자용/임대용만) */}
        {showRentalOption && (
          <>
            <div className={styles.modalDivider} />
            <div className={styles.modalFormRow}>
              <span className={styles.modalFormLabel}>임대수익</span>
              <div className={styles.typeButtons}>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${!hasRentalIncome ? styles.active : ''}`}
                  onClick={() => setEditBooleans({ ...editBooleans, hasRentalIncome: false })}
                >
                  없음
                </button>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${hasRentalIncome ? styles.active : ''}`}
                  onClick={() => setEditBooleans({ ...editBooleans, hasRentalIncome: true })}
                >
                  있음
                </button>
              </div>
            </div>

            {hasRentalIncome && (
              <>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>월임대료</span>
                  <input
                    type="number"
                    className={styles.modalFormInput}
                    value={editValues.rentalMonthly || ''}
                    onChange={e => setEditValues({ ...editValues, rentalMonthly: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder="0"
                  />
                  <span className={styles.modalFormUnit}>만원</span>
                </div>
                <div className={styles.modalFormRow}>
                  <span className={styles.modalFormLabel}>보증금</span>
                  <input
                    type="number"
                    className={styles.modalFormInput}
                    value={editValues.rentalDeposit || ''}
                    onChange={e => setEditValues({ ...editValues, rentalDeposit: e.target.value })}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder="0"
                  />
                  <span className={styles.modalFormUnit}>만원</span>
                </div>
              </>
            )}
          </>
        )}

        {/* 대출 정보 */}
        <div className={styles.modalDivider} />
        <div className={styles.modalFormRow}>
          <span className={styles.modalFormLabel}>대출</span>
          <div className={styles.typeButtons}>
            <button
              type="button"
              className={`${styles.typeBtn} ${!hasLoan ? styles.active : ''}`}
              onClick={() => setEditBooleans({ ...editBooleans, hasLoan: false })}
            >
              없음
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${hasLoan ? styles.active : ''}`}
              onClick={() => setEditBooleans({ ...editBooleans, hasLoan: true })}
            >
              있음
            </button>
          </div>
        </div>

        {renderLoanFields()}

        <div className={styles.modalFormActions}>
          <button
            className={styles.modalCancelBtn}
            onClick={isEditMode ? cancelEdit : resetAddForm}
            disabled={isSaving}
          >
            취소
          </button>
          <button
            className={styles.modalAddBtn}
            onClick={saveProperty}
            disabled={isSaving || !editValues.title || !editValues.currentValue}
          >
            {isSaving ? '저장 중...' : (isEditMode ? '저장' : '추가')}
          </button>
        </div>
      </>
    )
  }

  // 부동산 아이템 렌더링 (항상 읽기 모드)
  const renderPropertyItem = (property: RealEstate) => {
    // 메타 정보 구성
    const metaParts = []

    // 소유자
    if (property.owner === 'spouse') {
      metaParts.push('배우자')
    } else {
      metaParts.push('본인')
    }

    if (property.purchase_year) {
      metaParts.push(`${property.purchase_year}년${property.purchase_month ? ` ${property.purchase_month}월` : ''} 취득`)
    }

    // 상승률
    const rateCategory = (property as any).rate_category || 'realEstate'
    if (rateCategory === 'fixed') {
      metaParts.push(`상승률 ${property.growth_rate}%`)
    } else {
      metaParts.push('시뮬레이션 가정 (부동산 상승률)')
    }

    if (property.has_rental_income && property.rental_monthly) {
      const rentInfo = `월 임대 ${formatMoney(property.rental_monthly)}`
      if (property.rental_deposit) {
        metaParts.push(`${rentInfo} | 보증금 ${formatMoney(property.rental_deposit)}`)
      } else {
        metaParts.push(rentInfo)
      }
    }

    let loanLine: string | null = null
    if (property.has_loan && property.loan_amount) {
      const loanParts = [`대출 ${formatMoney(property.loan_amount)}`]
      if (property.loan_rate) loanParts.push(`${property.loan_rate}%`)
      if (property.loan_repayment_type) loanParts.push(REPAYMENT_TYPE_LABELS[property.loan_repayment_type])
      if (property.loan_maturity_year) {
        loanParts.push(`${property.loan_maturity_year}.${String(property.loan_maturity_month || 1).padStart(2, '0')} 만기`)
      }
      loanLine = loanParts.join(' | ')
    }

    if (property.sell_year) {
      metaParts.push(`매각 ${property.sell_year}년${property.sell_month ? ` ${property.sell_month}월` : ''}`)
    }

    if ((property as any).include_in_cashflow) {
      metaParts.push('현금 흐름 포함')
    }

    return (
      <div key={property.id} className={styles.assetItem} onClick={() => startEditProperty(property)} style={{ cursor: 'pointer' }}>
        <FinancialItemIcon
          category="realEstate"
          type={property.type}
          icon={property.icon}
          color={property.color}
          onSave={async (icon, color) => {
            await updateRealEstate(property.id, { icon, color })
            invalidate('realEstates')
          }}
        />
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{property.title}</span>
          {metaParts.length > 0 && (
            <span className={styles.itemMeta}>
              {metaParts.join(' | ')}
            </span>
          )}
          {loanLine && (
            <span className={styles.itemMeta}>{loanLine}</span>
          )}
        </div>
        <div className={styles.itemRight}>
          <span className={styles.itemAmount}>{formatMoney(property.current_value)}</span>
        </div>
      </div>
    )
  }

  // 거주용 부동산 아이템 렌더링
  const renderResidenceItem = (property: RealEstate) => {
    const metaParts: string[] = []

    if (property.housing_type === '자가') {
      if (property.purchase_year && property.purchase_month) {
        metaParts.push(`취득 ${property.purchase_year}.${String(property.purchase_month).padStart(2, '0')}`)
      }
      if (property.purchase_price) {
        metaParts.push(`취득가 ${formatMoney(property.purchase_price)}`)
      }
    }

    if (property.housing_type === '월세' && property.monthly_rent) {
      metaParts.push(`월세 ${formatMoney(property.monthly_rent)}`)
    }

    if (property.maintenance_fee) {
      metaParts.push(`관리비 ${formatMoney(property.maintenance_fee)}/월`)
    }

    if (property.sell_year) {
      metaParts.push(`매각 ${property.sell_year}년${property.sell_month ? ` ${property.sell_month}월` : ''}`)
    }

    if (property.include_in_cashflow) {
      metaParts.push('현금 흐름 포함')
    }

    let loanLine: string | null = null
    if (property.has_loan && property.loan_amount) {
      const loanLabel = property.housing_type === '자가' ? '주담대' : '전월세 보증금 대출'
      const loanParts = [`${loanLabel} ${formatMoney(property.loan_amount)}`]
      if (property.loan_rate) loanParts.push(`${property.loan_rate}%`)
      if (property.loan_repayment_type) loanParts.push(REPAYMENT_TYPE_LABELS[property.loan_repayment_type])
      if (property.loan_maturity_year) {
        loanParts.push(`${property.loan_maturity_year}.${String(property.loan_maturity_month || 1).padStart(2, '0')} 만기`)
      }
      loanLine = loanParts.join(' | ')
    }

    return (
      <div key={property.id} className={styles.assetItem} onClick={() => startEditProperty(property)} style={{ cursor: 'pointer' }}>
        <FinancialItemIcon
          category="realEstate"
          type="residence"
          icon={property.icon}
          color={property.color}
          onSave={async (icon, color) => {
            await updateRealEstate(property.id, { icon, color })
            invalidate('realEstates')
          }}
        />
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{property.housing_type}</span>
          {metaParts.length > 0 && (
            <span className={styles.itemMeta}>{metaParts.join(' | ')}</span>
          )}
          {loanLine && (
            <span className={styles.itemMeta}>{loanLine}</span>
          )}
        </div>
        <div className={styles.itemRight}>
          <span className={styles.itemAmount}>
            {property.housing_type === '자가'
              ? formatMoney(property.current_value)
              : `보증금 ${formatMoney(property.current_value)}`}
          </span>
        </div>
      </div>
    )
  }

  // 차트 데이터
  const chartData = useMemo(() => {
    const labels: string[] = []
    const values: number[] = []
    const colors: string[] = []

    // 거주용 (자가만 자산으로 포함)
    residenceProperties
      .filter(p => p.housing_type === '자가' && p.current_value > 0)
      .forEach(p => {
        labels.push(p.title || '거주용 부동산')
        values.push(p.current_value)
        colors.push(HOUSING_COLOR)
      })

    // 추가 부동산
    ;[...investmentProperties, ...rentalProperties, ...landProperties].forEach(property => {
      labels.push(property.title)
      values.push(property.current_value)
      colors.push(USAGE_COLORS[property.type as Exclude<RealEstateType, 'residence'>])
    })

    return { labels, values, colors }
  }, [residenceProperties, investmentProperties, rentalProperties, landProperties])

  const doughnutData = {
    labels: chartData.labels,
    datasets: [{
      data: chartData.values,
      backgroundColor: chartData.colors,
      borderWidth: 0,
    }],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { label?: string, raw: unknown }) => {
            return `${context.label || ''}: ${formatMoney(context.raw as number)}`
          },
        },
      },
    },
  }

  const hasData = totalRealEstateValue > 0 || residenceProperties.length > 0

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingProperty && !showTypeMenu) {
          cancelEdit()
          e.stopPropagation()
        } else if (showTypeMenu) {
          resetAddForm()
          e.stopPropagation()
        }
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [showTypeMenu, editingProperty])


  if (isLoading && dbRealEstates.length === 0) {
    return (
      <div className={styles.container}>
        <TabSkeleton sections={2} itemsPerSection={2} />
      </div>
    )
  }

  const totalPropertyCount = dbRealEstates.length

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.headerToggle} onClick={() => setIsExpanded(!isExpanded)} type="button">
          <span className={styles.title}>부동산</span>
          <span className={styles.count}>{totalPropertyCount}개</span>
        </button>
        <div className={styles.headerRight}>
          <button
            ref={addButtonRef}
            className={styles.addIconBtn}
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            type="button"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* 타입 선택 모달 (2-step) */}
      {showTypeMenu && createPortal(
        <div
          className={styles.typeModalOverlay}
          data-scenario-dropdown-portal="true"
          onClick={resetAddForm}
        >
          <div
            className={styles.typeModal}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            {!addingType ? (
              <>
                {/* Step 1: 타입 선택 */}
                <div className={styles.typeModalHeader}>
                  <span className={styles.typeModalTitle}>부동산 추가</span>
                  <button
                    className={styles.typeModalClose}
                    onClick={resetAddForm}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.typeGrid}>
                  <button className={styles.typeCard} onClick={() => {
                    setAddingType('residence')
                    initResidenceValues()
                  }}>
                    <span className={styles.typeCardName}>거주용</span>
                    <span className={styles.typeCardDesc}>내 집, 아파트 등</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => {
                    setAddingType('investment')
                    initPropertyValues('investment')
                  }}>
                    <span className={styles.typeCardName}>투자용</span>
                    <span className={styles.typeCardDesc}>시세 차익 목적</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => {
                    setAddingType('rental')
                    initPropertyValues('rental')
                  }}>
                    <span className={styles.typeCardName}>임대용</span>
                    <span className={styles.typeCardDesc}>임대 수익 목적</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => {
                    setAddingType('land')
                    initPropertyValues('land')
                  }}>
                    <span className={styles.typeCardName}>토지</span>
                    <span className={styles.typeCardDesc}>농지, 대지 등</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: 입력 폼 */}
                <div className={styles.typeModalHeader}>
                  <div className={styles.headerLeft}>
                    <button
                      className={styles.backButton}
                      onClick={() => setAddingType(null)}
                      type="button"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <span className={styles.stepLabel}>
                      {TYPE_LABELS[addingType]} 추가
                    </span>
                  </div>
                  <button
                    className={styles.typeModalClose}
                    onClick={resetAddForm}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.modalFormBody}>
                  {addingType === 'residence'
                    ? renderResidenceModalForm()
                    : renderPropertyModalForm(addingType as Exclude<RealEstateType, 'residence'>)
                  }
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 편집 모달 (기존 아이템 수정) */}
      {editingProperty && editingProperty.id && !showTypeMenu && createPortal(
        <div
          className={styles.typeModalOverlay}
          data-scenario-dropdown-portal="true"
          onClick={cancelEdit}
        >
          <div
            className={styles.typeModal}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div className={styles.typeModalHeader}>
              <span className={styles.stepLabel}>
                {TYPE_LABELS[editingProperty.type]} 수정
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  className={styles.typeModalClose}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm('이 항목을 삭제하시겠습니까?')) {
                      handleDelete(editingProperty.id!)
                      cancelEdit()
                    }
                  }}
                  type="button"
                  disabled={isSaving}
                  style={{ color: 'var(--dashboard-text-secondary)' }}
                >
                  <Trash2 size={18} />
                </button>
                <button
                  className={styles.typeModalClose}
                  onClick={cancelEdit}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className={styles.modalFormBody}>
              <FinancialIconPicker
                category="realEstate"
                type={editingProperty.type}
                icon={editIcon}
                color={editColor}
                onIconChange={setEditIcon}
                onColorChange={setEditColor}
              />
              {editingProperty.type === 'residence'
                ? renderResidenceModalForm()
                : renderPropertyModalForm(editingProperty.type as Exclude<RealEstateType, 'residence'>)
              }
            </div>
          </div>
        </div>,
        document.body
      )}

      {isExpanded && (
        <div className={styles.groupedList}>
          {dbRealEstates.length === 0 && (
            <p className={styles.emptyHint}>
              아직 등록된 부동산이 없습니다. 오른쪽 + 버튼으로 추가하세요.
            </p>
          )}

          {residenceProperties.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>거주용</span>
                  <span className={styles.sectionCount}>{residenceProperties.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {residenceProperties.map(property => renderResidenceItem(property))}
              </div>
            </div>
          )}

          {investmentProperties.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>투자용</span>
                  <span className={styles.sectionCount}>{investmentProperties.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {investmentProperties.map(property => renderPropertyItem(property))}
              </div>
            </div>
          )}

          {rentalProperties.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>임대용</span>
                  <span className={styles.sectionCount}>{rentalProperties.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {rentalProperties.map(property => renderPropertyItem(property))}
              </div>
            </div>
          )}

          {landProperties.length > 0 && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>
                <div className={styles.sectionTitleRow}>
                  <span className={styles.sectionGroupTitle}>토지</span>
                  <span className={styles.sectionCount}>{landProperties.length}개</span>
                </div>
              </div>
              <div className={styles.sectionItems}>
                {landProperties.map(property => renderPropertyItem(property))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
