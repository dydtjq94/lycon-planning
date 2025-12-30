'use client'

import { useState, useMemo } from 'react'
import { Plus, Trash2, TrendingUp, Pencil, X, Check } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { OnboardingData } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import styles from './IncomeTab.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface IncomeTabProps {
  data: OnboardingData
  onUpdateData: (updates: Partial<OnboardingData>) => void
}

// 소득 타입
type IncomeType = 'labor' | 'business' | 'other'

// 종료 타입
type EndType = 'self-retirement' | 'spouse-retirement' | 'custom'

// 상승률 프리셋
const GROWTH_PRESETS = [
  { id: 'high', label: '높음 5%', value: 5 },
  { id: 'medium', label: '보통 3%', value: 3 },
  { id: 'low', label: '낮음 1%', value: 1 },
  { id: 'none', label: '없음', value: 0 },
]

// 소득 항목 (월 단위 기간)
interface IncomeItem {
  id: string
  type: IncomeType
  label: string
  owner: 'self' | 'spouse'
  amount: number // 만원/월
  startYear: number
  startMonth: number // 1-12
  endType: EndType
  endYear: number | null // custom일 때만 사용
  endMonth: number | null // custom일 때만 사용
  growthRate: number // % (연간)
}

// 금액 포맷팅
function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    const uk = amount / 10000
    return `${uk.toFixed(1).replace(/\.0$/, '')}억`
  }
  return `${amount.toLocaleString()}만원`
}

export function IncomeTab({ data, onUpdateData }: IncomeTabProps) {
  const currentYear = new Date().getFullYear()

  // 현재 나이 계산
  const currentAge = useMemo(() => {
    if (!data.birth_date) return 35
    const birthYear = new Date(data.birth_date).getFullYear()
    return currentYear - birthYear
  }, [data.birth_date, currentYear])

  const retirementAge = data.target_retirement_age || 60
  const selfRetirementYear = currentYear + (retirementAge - currentAge)

  // 배우자 은퇴년도
  const spouseRetirementYear = useMemo(() => {
    if (!data.spouse?.birth_date) return selfRetirementYear
    const spouseBirthYear = new Date(data.spouse.birth_date).getFullYear()
    const spouseAge = currentYear - spouseBirthYear
    const spouseRetireAge = data.spouse.retirement_age || 60
    return currentYear + (spouseRetireAge - spouseAge)
  }, [data.spouse, currentYear, selfRetirementYear])

  const hasSpouse = data.isMarried && data.spouse
  const currentMonth = new Date().getMonth() + 1 // 1-12

  // 종료 년월 계산
  const getEndYearMonth = (item: IncomeItem): { year: number; month: number } => {
    if (item.endType === 'self-retirement') return { year: selfRetirementYear, month: 12 }
    if (item.endType === 'spouse-retirement') return { year: spouseRetirementYear, month: 12 }
    return {
      year: item.endYear || selfRetirementYear,
      month: item.endMonth || 12
    }
  }

  // 개월 수 계산
  const getMonthsCount = (item: IncomeItem): number => {
    const end = getEndYearMonth(item)
    return (end.year - item.startYear) * 12 + (end.month - item.startMonth)
  }

  // 소득 항목 상태
  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>(() => {
    const items: IncomeItem[] = []
    const month = new Date().getMonth() + 1

    if (data.laborIncome && data.laborIncome > 0) {
      items.push({
        id: 'labor-self',
        type: 'labor',
        label: '본인',
        owner: 'self',
        amount: data.laborIncome,
        startYear: currentYear,
        startMonth: month,
        endType: 'self-retirement',
        endYear: null,
        endMonth: null,
        growthRate: DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
      })
    }

    if (data.spouseLaborIncome && data.spouseLaborIncome > 0) {
      items.push({
        id: 'labor-spouse',
        type: 'labor',
        label: '배우자',
        owner: 'spouse',
        amount: data.spouseLaborIncome,
        startYear: currentYear,
        startMonth: month,
        endType: 'spouse-retirement',
        endYear: null,
        endMonth: null,
        growthRate: DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
      })
    }

    if (data.businessIncome && data.businessIncome > 0) {
      items.push({
        id: 'business-self',
        type: 'business',
        label: '본인',
        owner: 'self',
        amount: data.businessIncome,
        startYear: currentYear,
        startMonth: month,
        endType: 'self-retirement',
        endYear: null,
        endMonth: null,
        growthRate: DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
      })
    }

    if (data.spouseBusinessIncome && data.spouseBusinessIncome > 0) {
      items.push({
        id: 'business-spouse',
        type: 'business',
        label: '배우자',
        owner: 'spouse',
        amount: data.spouseBusinessIncome,
        startYear: currentYear,
        startMonth: month,
        endType: 'spouse-retirement',
        endYear: null,
        endMonth: null,
        growthRate: DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
      })
    }

    return items
  })

  // 편집 중인 항목 ID
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<IncomeItem | null>(null)
  const [isCustomRateMode, setIsCustomRateMode] = useState(false)
  const [customRateInput, setCustomRateInput] = useState('')

  // 추가 중인 타입
  const [addingType, setAddingType] = useState<IncomeType | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')

  // 타입별 항목
  const laborItems = incomeItems.filter(i => i.type === 'labor')
  const businessItems = incomeItems.filter(i => i.type === 'business')
  const otherItems = incomeItems.filter(i => i.type === 'other')

  // 월 총 소득
  const monthlyIncome = useMemo(() => {
    return incomeItems.reduce((sum, item) => sum + item.amount, 0)
  }, [incomeItems])

  // 은퇴까지 총 소득 (상승률 반영, 월 단위 계산)
  const lifetimeIncome = useMemo(() => {
    let total = 0
    incomeItems.forEach(item => {
      const months = getMonthsCount(item)
      // 연간 상승률을 월간으로 변환 (복리)
      const monthlyGrowthRate = Math.pow(1 + item.growthRate / 100, 1/12) - 1
      let monthlyAmount = item.amount
      for (let i = 0; i < months; i++) {
        total += monthlyAmount
        monthlyAmount *= (1 + monthlyGrowthRate)
      }
    })
    return Math.round(total)
  }, [incomeItems, selfRetirementYear, spouseRetirementYear])

  // 차트 데이터 (연간 합계로 표시하지만 월 단위로 계산)
  const projectionData = useMemo(() => {
    const maxYear = Math.max(selfRetirementYear, spouseRetirementYear)
    const yearsUntilEnd = Math.max(0, maxYear - currentYear)
    const labels: string[] = []
    const values: number[] = []

    const step = yearsUntilEnd > 20 ? 5 : yearsUntilEnd > 10 ? 2 : 1

    for (let i = 0; i <= yearsUntilEnd; i++) {
      if (i % step === 0 || i === yearsUntilEnd) {
        const year = currentYear + i
        let yearTotal = 0

        incomeItems.forEach(item => {
          const end = getEndYearMonth(item)
          // 해당 년도에 소득이 있는지 확인
          if (year >= item.startYear && year <= end.year) {
            // 시작 월 계산
            const startM = year === item.startYear ? item.startMonth : 1
            // 종료 월 계산
            const endM = year === end.year ? end.month : 12
            const monthsInYear = Math.max(0, endM - startM + 1)

            // 해당 년도까지의 성장률 적용
            const yearsFromStart = year - item.startYear
            const grownAmount = item.amount * Math.pow(1 + item.growthRate / 100, yearsFromStart)
            yearTotal += grownAmount * monthsInYear
          }
        })

        labels.push(`${year}`)
        values.push(Math.round(yearTotal))
      }
    }

    return { labels, values }
  }, [incomeItems, selfRetirementYear, spouseRetirementYear, currentYear])

  const barChartData = {
    labels: projectionData.labels,
    datasets: [{
      data: projectionData.values,
      backgroundColor: '#007aff',
      borderRadius: 2,
      barThickness: 20,
    }],
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        grid: { color: '#f0f0f0' },
        ticks: {
          font: { size: 11 },
          callback: (value: number | string) => {
            const num = typeof value === 'number' ? value : parseFloat(value)
            if (num >= 10000) return `${(num / 10000).toFixed(0)}억`
            return `${num.toLocaleString()}만`
          },
        },
      },
    },
  }

  // 항목 추가
  const handleAdd = () => {
    if (!addingType || !newAmount) return

    const newItem: IncomeItem = {
      id: Date.now().toString(),
      type: addingType,
      label: newLabel || (addingType === 'other' ? '기타' : '본인'),
      owner: 'self',
      amount: parseFloat(newAmount),
      startYear: currentYear,
      startMonth: currentMonth,
      endType: 'self-retirement',
      endYear: null,
      endMonth: null,
      growthRate: DEFAULT_GLOBAL_SETTINGS.incomeGrowthRate,
    }

    setIncomeItems(prev => [...prev, newItem])
    setAddingType(null)
    setNewLabel('')
    setNewAmount('')
  }

  // 항목 삭제
  const handleDelete = (id: string) => {
    setIncomeItems(prev => prev.filter(item => item.id !== id))
    if (editingId === id) {
      setEditingId(null)
      setEditForm(null)
    }
  }

  // 편집 시작
  const startEdit = (item: IncomeItem) => {
    setEditingId(item.id)
    setEditForm({ ...item })
    const isCustom = !isPresetRate(item.growthRate)
    setIsCustomRateMode(isCustom)
    setCustomRateInput(isCustom ? String(item.growthRate) : '')
  }

  // 편집 취소
  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(null)
    setIsCustomRateMode(false)
    setCustomRateInput('')
  }

  // 편집 저장
  const saveEdit = () => {
    if (!editForm) return
    const finalForm = isCustomRateMode
      ? { ...editForm, growthRate: customRateInput === '' ? 0 : parseFloat(customRateInput) }
      : editForm
    setIncomeItems(prev =>
      prev.map(item => item.id === finalForm.id ? finalForm : item)
    )
    setEditingId(null)
    setEditForm(null)
    setIsCustomRateMode(false)
    setCustomRateInput('')
  }

  // 기간 표시 텍스트 (년.월 형식)
  const formatPeriod = (item: IncomeItem): string => {
    const startStr = `${item.startYear}.${String(item.startMonth).padStart(2, '0')}`

    if (item.endType === 'self-retirement') {
      return `${startStr} ~ 본인 은퇴`
    }
    if (item.endType === 'spouse-retirement') {
      return `${startStr} ~ 배우자 은퇴`
    }

    const end = getEndYearMonth(item)
    const endStr = `${end.year}.${String(end.month).padStart(2, '0')}`
    return `${startStr} ~ ${endStr}`
  }

  // 종료 타입 표시 텍스트 (편집용)
  const getEndTypeLabel = (item: IncomeItem): string => {
    if (item.endType === 'self-retirement') return `본인 은퇴`
    if (item.endType === 'spouse-retirement') return `배우자 은퇴`
    return `직접 입력`
  }

  // 상승률이 프리셋인지 확인
  const isPresetRate = (rate: number) => GROWTH_PRESETS.some(p => p.value === rate)

  // 섹션 렌더링
  const renderSection = (
    title: string,
    type: IncomeType,
    items: IncomeItem[],
    placeholder: string
  ) => (
    <div className={styles.incomeSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
        {items.length > 0 && (
          <span className={styles.sectionTotal}>
            월 {formatMoney(items.reduce((s, i) => s + i.amount, 0))}
          </span>
        )}
      </div>

      <div className={styles.itemList}>
        {items.map(item => {
          const isEditing = editingId === item.id

          if (isEditing && editForm) {
            // 편집 모드
            return (
              <div key={item.id} className={styles.editItem}>
                <div className={styles.editRow}>
                  <span className={styles.editLabel}>{item.label}</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editInput}
                      value={editForm.amount || ''}
                      onChange={e => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                    />
                    <span className={styles.editUnit}>만원/월</span>
                  </div>
                </div>

                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>시작</span>
                  <div className={styles.editField}>
                    <input
                      type="number"
                      className={styles.editYearInput}
                      value={editForm.startYear}
                      onChange={e => setEditForm({ ...editForm, startYear: parseInt(e.target.value) || currentYear })}
                    />
                    <span className={styles.editUnit}>년</span>
                    <input
                      type="number"
                      className={styles.editMonthInput}
                      value={editForm.startMonth}
                      min={1}
                      max={12}
                      onChange={e => setEditForm({ ...editForm, startMonth: Math.min(12, Math.max(1, parseInt(e.target.value) || 1)) })}
                    />
                    <span className={styles.editUnit}>월</span>
                  </div>
                </div>

                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>종료</span>
                  <div className={styles.editField}>
                    <div className={styles.endTypeButtons}>
                      <button
                        type="button"
                        className={`${styles.endTypeBtn} ${editForm.endType === 'self-retirement' ? styles.active : ''}`}
                        onClick={() => setEditForm({ ...editForm, endType: 'self-retirement' })}
                      >
                        본인 은퇴
                      </button>
                      {hasSpouse && (
                        <button
                          type="button"
                          className={`${styles.endTypeBtn} ${editForm.endType === 'spouse-retirement' ? styles.active : ''}`}
                          onClick={() => setEditForm({ ...editForm, endType: 'spouse-retirement' })}
                        >
                          배우자 은퇴
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${styles.endTypeBtn} ${editForm.endType === 'custom' ? styles.active : ''}`}
                        onClick={() => setEditForm({ ...editForm, endType: 'custom', endYear: editForm.endYear || selfRetirementYear, endMonth: editForm.endMonth || 12 })}
                      >
                        직접 입력
                      </button>
                    </div>
                    {editForm.endType === 'custom' && (
                      <>
                        <input
                          type="number"
                          className={styles.editYearInput}
                          value={editForm.endYear || ''}
                          onChange={e => setEditForm({ ...editForm, endYear: parseInt(e.target.value) || null })}
                        />
                        <span className={styles.editUnit}>년</span>
                        <input
                          type="number"
                          className={styles.editMonthInput}
                          value={editForm.endMonth || ''}
                          min={1}
                          max={12}
                          onChange={e => setEditForm({ ...editForm, endMonth: Math.min(12, Math.max(1, parseInt(e.target.value) || 12)) })}
                        />
                        <span className={styles.editUnit}>월</span>
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.editRow}>
                  <span className={styles.editRowLabel}>상승률</span>
                  <div className={styles.rateButtons}>
                    {GROWTH_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        className={`${styles.rateBtn} ${!isCustomRateMode && editForm.growthRate === preset.value ? styles.active : ''}`}
                        onClick={() => {
                          setIsCustomRateMode(false)
                          setCustomRateInput('')
                          setEditForm({ ...editForm, growthRate: preset.value })
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <div className={styles.customRateGroup}>
                      <input
                        type="number"
                        className={`${styles.customRateInput} ${isCustomRateMode ? styles.active : ''}`}
                        value={customRateInput}
                        onFocus={() => {
                          setIsCustomRateMode(true)
                          if (customRateInput === '') {
                            setCustomRateInput(String(editForm.growthRate))
                          }
                        }}
                        onChange={e => setCustomRateInput(e.target.value)}
                        placeholder="0"
                        step="0.5"
                      />
                      <span className={styles.rateUnit}>%</span>
                    </div>
                  </div>
                </div>

                <div className={styles.editActions}>
                  <button className={styles.cancelBtn} onClick={cancelEdit}>
                    취소
                  </button>
                  <button className={styles.saveBtn} onClick={saveEdit}>
                    저장
                  </button>
                </div>
              </div>
            )
          }

          // 읽기 모드
          return (
            <div key={item.id} className={styles.incomeItem}>
              <div className={styles.itemMain}>
                <span className={styles.itemLabel}>{item.label}</span>
                <span className={styles.itemAmount}>{formatMoney(item.amount)}/월</span>
                <span className={styles.itemMeta}>
                  {formatPeriod(item)} | 연 {item.growthRate}% 상승
                </span>
              </div>
              <div className={styles.itemActions}>
                <button className={styles.editBtn} onClick={() => startEdit(item)}>
                  <Pencil size={16} />
                </button>
                <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )
        })}

        {/* 인라인 추가 폼 */}
        {addingType === type ? (
          <div className={styles.inlineAddForm}>
            <input
              type="text"
              className={styles.inlineLabelInput}
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
            <div className={styles.inlineAmountGroup}>
              <input
                type="number"
                className={styles.inlineAmountInput}
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                placeholder="0"
              />
              <span className={styles.inlineUnit}>만원/월</span>
            </div>
            <div className={styles.inlineActions}>
              <button
                className={styles.inlineCancelBtn}
                onClick={() => {
                  setAddingType(null)
                  setNewLabel('')
                  setNewAmount('')
                }}
              >
                취소
              </button>
              <button
                className={styles.inlineAddBtn}
                onClick={handleAdd}
                disabled={!newAmount}
              >
                추가
              </button>
            </div>
          </div>
        ) : (
          <button
            className={styles.addBtn}
            onClick={() => setAddingType(type)}
          >
            <Plus size={16} />
            추가
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className={styles.container}>
      {/* 왼쪽: 소득 입력 */}
      <div className={styles.inputPanel}>
        {renderSection('근로 소득', 'labor', laborItems, '본인/배우자')}
        {renderSection('사업 소득', 'business', businessItems, '본인/배우자')}
        {renderSection('기타 소득', 'other', otherItems, '항목명')}

        <p className={styles.infoText}>
          배당, 이자, 임대 소득은 자산 탭에서 자동 계산됩니다.
        </p>
      </div>

      {/* 오른쪽: 요약 */}
      <div className={styles.summaryPanel}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>월 총 소득</span>
            <span className={styles.summaryValue}>{formatMoney(monthlyIncome)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>연 총 소득</span>
            <span className={styles.summaryValue}>{formatMoney(monthlyIncome * 12)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>은퇴까지 예상 총 소득</span>
            <span className={styles.summaryValueLarge}>{formatMoney(lifetimeIncome)}</span>
          </div>
          <p className={styles.summaryNote}>
            본인 {selfRetirementYear}년({retirementAge}세) 은퇴 기준
          </p>
        </div>

        {monthlyIncome > 0 && projectionData.values.length > 1 && (
          <div className={styles.chartCard}>
            <h4 className={styles.chartTitle}>소득 전망</h4>
            <div className={styles.chartWrapper}>
              <Bar data={barChartData} options={barChartOptions} />
            </div>
          </div>
        )}

        {monthlyIncome === 0 && (
          <div className={styles.emptyState}>
            <TrendingUp size={40} />
            <p>소득을 추가하면 분석 결과가 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
