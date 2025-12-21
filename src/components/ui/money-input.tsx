'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import styles from './money-input.module.css'

interface MoneyInputProps {
  label?: string
  value: number | null  // 실제 원 단위 값 (null = 미입력, 0 = 0 입력함)
  onChange: (value: number | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  hideSuffix?: boolean  // 만원 suffix 숨기기 (별도 셀에 단위 표시할 때)
  onFocus?: () => void  // 외부 포커스 핸들러
  'data-filled'?: string  // 입력 완료 상태 표시
}

/**
 * 금액 포맷팅 (원 단위 → 읽기 쉬운 형태)
 * - 조, 억, 만 단위는 숫자로 표시
 * - 만원 미만은 숫자로 표시 (원 단위 미만 버림)
 *
 * 예: 1000000000000 → "1조원"
 * 예: 1500000000 → "15억원"
 * 예: 150000000 → "1억 5,000만원"
 * 예: 24890000 → "2,489만원"
 * 예: 32000 → "3만 2000원"
 * 예: 36200 → "3만 6200원"
 * 예: 34414 → "3만 4414원"
 */
function formatMoney(won: number): string {
  // 원 단위 미만 버림
  won = Math.floor(won)

  if (won === 0) return '0원'

  const absWon = Math.abs(won)
  const sign = won < 0 ? '-' : ''

  // 단위 정의
  const 조 = 1000000000000  // 10^12
  const 억 = 100000000      // 10^8
  const 만 = 10000          // 10^4

  const parts: string[] = []
  let remaining = absWon

  // 조 단위
  if (remaining >= 조) {
    const count = Math.floor(remaining / 조)
    parts.push(`${count.toLocaleString()}조`)
    remaining = remaining % 조
  }

  // 억 단위
  if (remaining >= 억) {
    const count = Math.floor(remaining / 억)
    parts.push(`${count.toLocaleString()}억`)
    remaining = remaining % 억
  }

  // 만 단위
  if (remaining >= 만) {
    const count = Math.floor(remaining / 만)
    parts.push(`${count.toLocaleString()}만`)
    remaining = remaining % 만
  }

  // 만원 미만: 그냥 숫자로 표시
  if (remaining > 0) {
    parts.push(`${remaining.toLocaleString()}`)
  }

  return `${sign}${parts.join(' ')}원`
}

/**
 * 만원 단위 금액 입력 컴포넌트
 * - 입력: 만원 단위 (예: 850 입력 → 850만원 = 8,500,000원)
 * - 소수점 지원 (예: 3.3 입력 → 3.3만원 = 33,000원)
 * - 아래에 읽기 쉬운 형태로 표시
 */
export function MoneyInput({
  label,
  value,
  onChange,
  placeholder = '0',
  className,
  disabled = false,
  hideSuffix = false,
  onFocus: externalOnFocus,
  'data-filled': dataFilled,
}: MoneyInputProps) {
  // 입력 중인 문자열 상태 (0.3 같은 입력을 위해)
  // value가 null/undefined이면 빈 문자열, 0이면 '0', 숫자면 만원 단위로 변환
  const [inputValue, setInputValue] = useState<string>(
    value == null ? '' : value === 0 ? '0' : String(value / 10000)
  )
  const [isFocused, setIsFocused] = useState(false)

  // 외부 value가 변경되면 inputValue도 업데이트 (포커스 중이 아닐 때만)
  useEffect(() => {
    if (isFocused) return

    if (value == null) {
      // 미입력 상태 (null 또는 undefined)
      setInputValue('')
    } else if (value === 0) {
      // 0을 입력한 상태 - "0" 유지
      setInputValue('0')
    } else {
      setInputValue(String(value / 10000))
    }
  }, [value, isFocused])

  const handleFocus = () => {
    setIsFocused(true)
    externalOnFocus?.()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 숫자와 소수점만 허용 (소수점은 하나만)
    let rawValue = e.target.value.replace(/[^0-9.]/g, '')

    // 소수점이 여러 개면 첫 번째만 유지
    const dotIndex = rawValue.indexOf('.')
    if (dotIndex !== -1) {
      rawValue = rawValue.slice(0, dotIndex + 1) + rawValue.slice(dotIndex + 1).replace(/\./g, '')
    }

    setInputValue(rawValue)

    if (rawValue === '') {
      onChange(null)  // 빈 값 = 미입력
      return
    }

    // 입력 중인 경우 (예: "0." 또는 "0.3") 숫자로 파싱 가능할 때만 onChange
    const manwon = parseFloat(rawValue)
    if (!isNaN(manwon)) {
      const won = Math.round(manwon * 10000)
      onChange(won)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)

    // blur 시 정리
    if (inputValue === '') {
      // 빈 값이면 미입력 상태로 (placeholder 보여줌)
      onChange(null)
    } else {
      // 불필요한 소수점 제거 (예: "3.0" → "3")
      const manwon = parseFloat(inputValue)
      if (!isNaN(manwon)) {
        // 0이어도 "0"으로 표시
        setInputValue(String(manwon))
        onChange(Math.round(manwon * 10000))
      }
    }
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputWrapper}>
        <Input
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className={hideSuffix ? styles.inputNoSuffix : styles.input}
          data-filled={dataFilled}
        />
        {!hideSuffix && <span className={styles.suffix}>만원</span>}
      </div>
    </div>
  )
}

/**
 * 포맷팅 함수 export (다른 곳에서도 사용 가능)
 */
export { formatMoney }
