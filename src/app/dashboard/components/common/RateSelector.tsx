'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import styles from './RateSelector.module.css'

interface RateSelectorProps {
  value: number
  onChange: (value: number) => void
  globalDefault: number
  label?: string
  type?: 'growth' | 'interest' | 'return'
}

interface RateOption {
  id: string
  label: string
  value: number | 'custom'
  description?: string
}

export function RateSelector({
  value,
  onChange,
  globalDefault,
  label = '증가율',
  type = 'growth',
}: RateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customValue, setCustomValue] = useState<string>('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 타입별 기본 옵션
  const getOptions = (): RateOption[] => {
    switch (type) {
      case 'growth':
        return [
          { id: 'global', label: `기본값 ${globalDefault}%`, value: globalDefault, description: '글로벌 설정 사용' },
          { id: 'optimistic', label: '낙관적 5%', value: 5, description: '높은 성장 시나리오' },
          { id: 'moderate', label: '보통 3%', value: 3, description: '평균 성장 시나리오' },
          { id: 'pessimistic', label: '비관적 1%', value: 1, description: '낮은 성장 시나리오' },
          { id: 'none', label: '증가 없음', value: 0, description: '고정 금액 유지' },
          { id: 'custom', label: '직접 입력', value: 'custom' },
        ]
      case 'interest':
        return [
          { id: 'global', label: `기본값 ${globalDefault}%`, value: globalDefault, description: '글로벌 설정 사용' },
          { id: 'high', label: '고금리 5%', value: 5 },
          { id: 'medium', label: '중금리 3.5%', value: 3.5 },
          { id: 'low', label: '저금리 2%', value: 2 },
          { id: 'custom', label: '직접 입력', value: 'custom' },
        ]
      case 'return':
        return [
          { id: 'global', label: `기본값 ${globalDefault}%`, value: globalDefault, description: '글로벌 설정 사용' },
          { id: 'aggressive', label: '공격적 8%', value: 8, description: '주식 중심' },
          { id: 'balanced', label: '균형 5%', value: 5, description: '혼합 포트폴리오' },
          { id: 'conservative', label: '보수적 3%', value: 3, description: '채권 중심' },
          { id: 'safe', label: '안전 1%', value: 1, description: '예금 수준' },
          { id: 'custom', label: '직접 입력', value: 'custom' },
        ]
      default:
        return []
    }
  }

  const options = getOptions()

  // 현재 선택된 옵션 찾기
  const getCurrentOption = () => {
    const matchedOption = options.find(opt => opt.value === value)
    if (matchedOption) return matchedOption

    // 커스텀 값인 경우
    return { id: 'custom', label: `${value}%`, value: 'custom' as const }
  }

  const currentOption = getCurrentOption()
  const isCustom = currentOption.id === 'custom' || !options.find(opt => opt.value === value)

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowCustomInput(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (option: RateOption) => {
    if (option.value === 'custom') {
      setShowCustomInput(true)
      setCustomValue(value.toString())
    } else {
      onChange(option.value)
      setIsOpen(false)
      setShowCustomInput(false)
    }
  }

  const handleCustomSubmit = () => {
    const numValue = parseFloat(customValue)
    if (!isNaN(numValue)) {
      onChange(numValue)
    }
    setIsOpen(false)
    setShowCustomInput(false)
  }

  return (
    <div className={styles.container} ref={dropdownRef}>
      {label && <label className={styles.label}>{label}</label>}
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.open : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.triggerText}>
          {isCustom ? `${value}%` : currentOption.label}
        </span>
        <ChevronDown size={16} className={styles.chevron} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>추천 설정</div>
            {options.filter(opt => opt.id !== 'custom').map(option => (
              <button
                key={option.id}
                type="button"
                className={`${styles.option} ${option.value === value ? styles.selected : ''}`}
                onClick={() => handleSelect(option)}
              >
                <div className={styles.optionContent}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.description && (
                    <span className={styles.optionDesc}>{option.description}</span>
                  )}
                </div>
                {option.value === value && <Check size={16} className={styles.checkIcon} />}
              </button>
            ))}
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionTitle}>직접 입력</div>
            {showCustomInput ? (
              <div className={styles.customInputWrapper}>
                <input
                  type="number"
                  className={styles.customInput}
                  value={customValue}
                  onChange={e => setCustomValue(e.target.value)}
                  placeholder="0"
                  step="0.1"
                  autoFocus
                />
                <span className={styles.customUnit}>%</span>
                <button
                  type="button"
                  className={styles.customSubmit}
                  onClick={handleCustomSubmit}
                >
                  적용
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`${styles.option} ${isCustom ? styles.selected : ''}`}
                onClick={() => handleSelect({ id: 'custom', label: '직접 입력', value: 'custom' })}
              >
                <div className={styles.optionContent}>
                  <span className={styles.optionLabel}>
                    {isCustom ? `커스텀 ${value}%` : '커스텀'}
                  </span>
                  <span className={styles.optionDesc}>원하는 값 직접 입력</span>
                </div>
                {isCustom && <Check size={16} className={styles.checkIcon} />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
