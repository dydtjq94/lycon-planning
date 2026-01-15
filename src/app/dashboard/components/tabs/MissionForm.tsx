'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { Question } from './surveyQuestions'
import styles from './MissionForm.module.css'

interface MissionFormProps {
  missionNumber?: number
  title: string
  questions: Question[]
  initialValues?: Record<string, string | string[]>
  onComplete: (answers: Record<string, string | string[]>) => void
  onSkip: () => void
  onBack: () => void
}

export function MissionForm({ missionNumber, title, questions, initialValues = {}, onComplete, onSkip, onBack }: MissionFormProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(initialValues)

  const isAllAnswered = questions.every(q => {
    const answer = answers[q.id]
    if (q.type === 'multi') {
      return Array.isArray(answer) && answer.length > 0
    }
    return answer !== undefined && answer !== ''
  })

  const handleSingleSelect = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleMultiSelect = (questionId: string, value: string) => {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) || []
      if (current.includes(value)) {
        return { ...prev, [questionId]: current.filter(v => v !== value) }
      }
      return { ...prev, [questionId]: [...current, value] }
    })
  }

  const handleNumberInput = (questionId: string, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '')
    setAnswers(prev => ({ ...prev, [questionId]: numericValue }))
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <div className={styles.headerInfo}>
          {missionNumber !== undefined && (
            <span className={styles.missionLabel}>Mission {missionNumber}</span>
          )}
          <h2 className={styles.title}>{title}</h2>
        </div>
      </div>

      <div className={styles.form}>
        {questions.map(question => (
          <div key={question.id} className={styles.field}>
            <label className={styles.label}>{question.text}</label>

            {question.type === 'single' && question.options && (
              <div className={styles.options}>
                {question.options.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionBtn} ${answers[question.id] === option.value ? styles.selected : ''}`}
                    onClick={() => handleSingleSelect(question.id, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {question.type === 'multi' && question.options && (
              <div className={styles.optionsTags}>
                {question.options.map(option => {
                  const isSelected = Array.isArray(answers[question.id]) &&
                    (answers[question.id] as string[]).includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.tagBtn} ${isSelected ? styles.selected : ''}`}
                      onClick={() => handleMultiSelect(question.id, option.value)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            )}

            {(question.type === 'number' || question.type === 'amount') && (
              <div className={styles.inputRow}>
                <input
                  type="text"
                  inputMode="numeric"
                  className={styles.numberInput}
                  value={(answers[question.id] as string) || ''}
                  onChange={(e) => handleNumberInput(question.id, e.target.value)}
                  placeholder={question.placeholder}
                />
                {question.unit && <span className={styles.unit}>{question.unit}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <button className={styles.skipBtn} onClick={onSkip}>
          건너뛰기
        </button>
        <button
          className={styles.completeBtn}
          onClick={() => onComplete(answers)}
          disabled={!isAllAnswered}
        >
          완료
        </button>
      </div>
    </div>
  )
}
