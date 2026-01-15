'use client'

import { useState, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Question } from './surveyQuestions'
import styles from './SurveyUI.module.css'

interface SurveyUIProps {
  questions: Question[]
  initialAnswers?: Record<string, string | string[]>
  onComplete: (answers: Record<string, string | string[]>) => void
}

export function SurveyUI({ questions, initialAnswers = {}, onComplete }: SurveyUIProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(initialAnswers)

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const currentAnswer = answers[currentQuestion?.id]

  // 답변이 유효한지 체크
  const isAnswerValid = useCallback(() => {
    if (!currentQuestion) return false
    const answer = answers[currentQuestion.id]

    if (currentQuestion.type === 'multi') {
      return Array.isArray(answer) && answer.length > 0
    }
    return answer !== undefined && answer !== ''
  }, [currentQuestion, answers])

  // 단일 선택
  const handleSingleSelect = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }))
  }

  // 복수 선택
  const handleMultiSelect = (value: string) => {
    setAnswers(prev => {
      const current = (prev[currentQuestion.id] as string[]) || []
      if (current.includes(value)) {
        return { ...prev, [currentQuestion.id]: current.filter(v => v !== value) }
      }
      return { ...prev, [currentQuestion.id]: [...current, value] }
    })
  }

  // 숫자/금액 입력
  const handleNumberInput = (value: string) => {
    // 숫자만 허용
    const numericValue = value.replace(/[^0-9]/g, '')
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: numericValue }))
  }

  // 다음 질문
  const handleNext = () => {
    if (isLastQuestion) {
      onComplete(answers)
    } else {
      setCurrentIndex(prev => prev + 1)
    }
  }

  // 이전 질문
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }

  if (!currentQuestion) return null

  return (
    <div className={styles.container}>
      {/* 진행률 */}
      <div className={styles.progress}>
        <span className={styles.progressText}>
          {currentIndex + 1} / {questions.length}
        </span>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 질문 */}
      <div className={styles.questionSection}>
        <h2 className={styles.questionText}>{currentQuestion.text}</h2>

        {/* 단일 선택 */}
        {currentQuestion.type === 'single' && currentQuestion.options && (
          <div className={styles.options}>
            {currentQuestion.options.map(option => (
              <button
                key={option.value}
                className={`${styles.optionButton} ${currentAnswer === option.value ? styles.selected : ''}`}
                onClick={() => handleSingleSelect(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* 복수 선택 */}
        {currentQuestion.type === 'multi' && currentQuestion.options && (
          <div className={styles.options}>
            {currentQuestion.options.map(option => {
              const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(option.value)
              return (
                <button
                  key={option.value}
                  className={`${styles.optionButton} ${styles.multiOption} ${isSelected ? styles.selected : ''}`}
                  onClick={() => handleMultiSelect(option.value)}
                >
                  <span className={styles.checkbox}>
                    {isSelected && <span className={styles.checkmark} />}
                  </span>
                  {option.label}
                </button>
              )
            })}
          </div>
        )}

        {/* 숫자 입력 */}
        {(currentQuestion.type === 'number' || currentQuestion.type === 'amount') && (
          <div className={styles.inputWrapper}>
            <input
              type="text"
              inputMode="numeric"
              className={styles.numberInput}
              value={currentAnswer as string || ''}
              onChange={(e) => handleNumberInput(e.target.value)}
              placeholder={currentQuestion.placeholder}
            />
            {currentQuestion.unit && (
              <span className={styles.unit}>{currentQuestion.unit}</span>
            )}
          </div>
        )}
      </div>

      {/* 네비게이션 */}
      <div className={styles.navigation}>
        {currentIndex > 0 && (
          <button className={styles.prevButton} onClick={handlePrev}>
            이전
          </button>
        )}
        <button
          className={styles.nextButton}
          onClick={handleNext}
          disabled={!isAnswerValid()}
        >
          {isLastQuestion ? '완료' : '다음'}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
