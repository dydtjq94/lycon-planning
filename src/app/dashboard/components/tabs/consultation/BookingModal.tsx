'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useChartTheme } from '@/hooks/useChartTheme'
import { CONSULTATION_TYPES } from '@/lib/constants/consultationTypes'
import {
  getAvailableTimesForDates,
  createBooking,
} from '@/lib/services/bookingService'
import styles from './BookingModal.module.css'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  expertId: string
  onSuccess: () => void
}

type Step = 'type' | 'date' | 'time' | 'memo'

const STEP_TITLES: Record<Step, string> = {
  type: '상담 유형 선택',
  date: '날짜 선택',
  time: '시간 선택',
  memo: '메모 및 확인',
}

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function BookingModal({ isOpen, onClose, expertId, onSuccess }: BookingModalProps) {
  const { isDark } = useChartTheme()
  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [availableTimes, setAvailableTimes] = useState<Record<string, string[]>>({})
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [memo, setMemo] = useState('')
  const [loadingTimes, setLoadingTimes] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEsc)
      return () => window.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('type')
      setSelectedType(null)
      setSelectedDate(null)
      setSelectedTime(null)
      setMemo('')
      const now = new Date()
      setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() })
    }
  }, [isOpen])

  // Load available times when calendar month changes
  const loadTimes = useCallback(async () => {
    if (!expertId) return
    setLoadingTimes(true)
    try {
      const { year, month } = calendarMonth
      const dates: Date[] = []
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d)
        if (date >= today) {
          dates.push(date)
        }
      }

      if (dates.length > 0) {
        const result = await getAvailableTimesForDates(expertId, dates)
        setAvailableTimes(result)
      } else {
        setAvailableTimes({})
      }
    } catch {
      setAvailableTimes({})
    } finally {
      setLoadingTimes(false)
    }
  }, [expertId, calendarMonth])

  useEffect(() => {
    if (step === 'date') {
      loadTimes()
    }
  }, [step, loadTimes])

  const handleSubmit = async () => {
    if (!selectedType || !selectedDate || !selectedTime) return
    setSubmitting(true)
    try {
      await createBooking(
        expertId,
        selectedDate,
        selectedTime,
        memo || undefined,
        selectedType
      )
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Booking failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const goNext = () => {
    if (step === 'type' && selectedType) setStep('date')
    else if (step === 'date' && selectedDate) setStep('time')
    else if (step === 'time' && selectedTime) setStep('memo')
  }

  const goBack = () => {
    if (step === 'date') setStep('type')
    else if (step === 'time') setStep('date')
    else if (step === 'memo') setStep('time')
  }

  const canNext = () => {
    if (step === 'type') return !!selectedType
    if (step === 'date') return !!selectedDate
    if (step === 'time') return !!selectedTime
    return true
  }

  // Calendar rendering
  const renderCalendar = () => {
    const { year, month } = calendarMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = formatLocalDate(today)

    const cells: JSX.Element[] = []

    // Empty cells for days before first
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className={styles.calendarEmpty} />)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const dateStr = formatLocalDate(date)
      const isPast = date < today
      const isToday = dateStr === todayStr
      const isSelected = dateStr === selectedDate
      const hasSlots = (availableTimes[dateStr]?.length || 0) > 0

      const disabled = isPast || (!loadingTimes && !hasSlots)

      let className = styles.calendarDay
      if (isSelected) className += ` ${styles.calendarDaySelected}`
      if (disabled) className += ` ${styles.calendarDayDisabled}`
      if (isToday && !isSelected) className += ` ${styles.calendarDayToday}`

      cells.push(
        <button
          key={d}
          className={className}
          disabled={disabled}
          onClick={() => {
            setSelectedDate(dateStr)
            setSelectedTime(null)
          }}
        >
          {d}
        </button>
      )
    }

    return (
      <div className={styles.calendar}>
        <div className={styles.calendarHeader}>
          <button
            className={styles.calendarNavBtn}
            onClick={() => {
              setCalendarMonth(prev => {
                const d = new Date(prev.year, prev.month - 1)
                return { year: d.getFullYear(), month: d.getMonth() }
              })
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span className={styles.calendarMonth}>
            {year}년 {month + 1}월
          </span>
          <button
            className={styles.calendarNavBtn}
            onClick={() => {
              setCalendarMonth(prev => {
                const d = new Date(prev.year, prev.month + 1)
                return { year: d.getFullYear(), month: d.getMonth() }
              })
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className={styles.calendarGrid}>
          {DOW.map(d => (
            <div key={d} className={styles.calendarDow}>{d}</div>
          ))}
          {cells}
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  const glassBg = isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{
          background: glassBg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{STEP_TITLES[step]}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Step: type */}
          {step === 'type' && (
            <>
              <div className={styles.stepLabel}>상담 종류를 선택하세요</div>
              <div className={styles.typeGrid}>
                {CONSULTATION_TYPES.map(t => (
                  <button
                    key={t.id}
                    className={`${styles.typeCard} ${selectedType === t.id ? styles.typeCardSelected : ''}`}
                    onClick={() => setSelectedType(t.id)}
                  >
                    <div className={styles.typeName}>
                      <span className={styles.typeDot} style={{ backgroundColor: t.color }} />
                      {t.name}
                    </div>
                    <div className={styles.typeDesc}>{t.description}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step: date */}
          {step === 'date' && (
            <>
              <div className={styles.stepLabel}>날짜를 선택하세요</div>
              {loadingTimes && <div className={styles.loadingText}>일정 불러오는 중...</div>}
              {renderCalendar()}
            </>
          )}

          {/* Step: time */}
          {step === 'time' && (
            <>
              <div className={styles.stepLabel}>시간을 선택하세요</div>
              {selectedDate && availableTimes[selectedDate]?.length ? (
                <div className={styles.timeGrid}>
                  {availableTimes[selectedDate].map(time => (
                    <button
                      key={time}
                      className={`${styles.timeSlot} ${selectedTime === time ? styles.timeSlotSelected : ''}`}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.noTimes}>선택 가능한 시간이 없습니다</div>
              )}
            </>
          )}

          {/* Step: memo */}
          {step === 'memo' && (
            <>
              <div className={styles.stepLabel}>메모 (선택사항)</div>
              <textarea
                className={styles.memoInput}
                placeholder="상담 시 전달하고 싶은 내용이 있으면 입력하세요"
                value={memo}
                onChange={e => setMemo(e.target.value)}
              />
            </>
          )}
        </div>

        <div className={styles.footer}>
          {step === 'type' ? (
            <div />
          ) : (
            <button className={styles.backBtn} onClick={goBack}>
              이전
            </button>
          )}
          {step === 'memo' ? (
            <button
              className={styles.nextBtn}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? '예약 중...' : '예약하기'}
            </button>
          ) : (
            <button
              className={styles.nextBtn}
              onClick={goNext}
              disabled={!canNext()}
            >
              다음
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
