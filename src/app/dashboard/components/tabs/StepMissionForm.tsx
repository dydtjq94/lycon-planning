'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { Question } from './surveyQuestions'
import styles from './StepMissionForm.module.css'

// 투자 유형 정의
interface InvestmentType {
  type: string
  label: string
  description: string
  color: string
}

const INVESTMENT_TYPES: Record<string, InvestmentType> = {
  conservative: {
    type: 'conservative',
    label: '안정형',
    description: '원금 보존을 최우선으로 하며, 낮은 위험의 예금과 채권 중심 투자를 선호합니다.',
    color: '#34C759',
  },
  moderately_conservative: {
    type: 'moderately_conservative',
    label: '안정추구형',
    description: '안정적인 수익을 추구하면서 일부 위험자산에도 투자할 수 있습니다.',
    color: '#5AC8FA',
  },
  balanced: {
    type: 'balanced',
    label: '위험중립형',
    description: '수익과 위험의 균형을 중시하며, 주식과 채권을 적절히 배분합니다.',
    color: '#007AFF',
  },
  growth: {
    type: 'growth',
    label: '적극투자형',
    description: '높은 수익을 위해 주식 중심 투자를 선호하며, 일정 수준의 손실을 감수합니다.',
    color: '#FF9500',
  },
  aggressive: {
    type: 'aggressive',
    label: '공격투자형',
    description: '최대 수익을 추구하며, 높은 변동성과 손실 위험을 적극적으로 감수합니다.',
    color: '#FF3B30',
  },
}

// 투자 유형 계산
function calculateInvestmentType(answers: Record<string, string | string[]>): InvestmentType {
  let score = 0

  // 투자 경험 (0-3점)
  const experience = answers['investment-experience'] as string
  if (experience === 'none') score += 0
  else if (experience === 'beginner') score += 1
  else if (experience === 'intermediate') score += 2
  else if (experience === 'advanced') score += 3

  // 손실 허용 (0-3점)
  const lossTolerance = answers['max-loss-tolerance'] as string
  if (lossTolerance === '0') score += 0
  else if (lossTolerance === '10') score += 1
  else if (lossTolerance === '20') score += 2
  else if (lossTolerance === '30') score += 3

  // 시장 하락 반응 (0-2점)
  const crashReaction = answers['market-crash-reaction'] as string
  if (crashReaction === 'sell') score += 0
  else if (crashReaction === 'hold') score += 1
  else if (crashReaction === 'buy') score += 2

  // 투자 스타일 (0-2점)
  const preference = answers['investment-preference'] as string
  if (preference === 'safe') score += 0
  else if (preference === 'balanced') score += 1
  else if (preference === 'growth') score += 2

  // 투자 기간 (0-2점)
  const horizon = answers['investment-horizon'] as string
  if (horizon === 'short') score += 0
  else if (horizon === 'medium') score += 1
  else if (horizon === 'long') score += 2

  // 총점: 0-12점
  if (score <= 2) return INVESTMENT_TYPES.conservative
  if (score <= 4) return INVESTMENT_TYPES.moderately_conservative
  if (score <= 7) return INVESTMENT_TYPES.balanced
  if (score <= 10) return INVESTMENT_TYPES.growth
  return INVESTMENT_TYPES.aggressive
}

interface StepMissionFormProps {
  missionNumber?: number
  title: string
  questions: Question[]
  questionsPerPage?: number
  initialValues?: Record<string, string | string[]>
  onComplete: (answers: Record<string, string | string[]>, calculatedType?: string) => void
  onSkip: () => void
  onBack: () => void
}

export function StepMissionForm({
  missionNumber,
  title,
  questions,
  questionsPerPage = 2,
  initialValues = {},
  onComplete,
  onSkip,
  onBack,
}: StepMissionFormProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(initialValues)
  const [currentPage, setCurrentPage] = useState(0)
  const [showResult, setShowResult] = useState(false)

  // 페이지별 질문 분리
  const totalPages = Math.ceil(questions.length / questionsPerPage)
  const currentQuestions = questions.slice(
    currentPage * questionsPerPage,
    (currentPage + 1) * questionsPerPage
  )

  // 현재 페이지 질문이 모두 답변되었는지 체크
  const isCurrentPageComplete = currentQuestions.every(q => {
    const answer = answers[q.id]
    if (q.type === 'multi') {
      return Array.isArray(answer) && answer.length > 0
    }
    return answer !== undefined && answer !== ''
  })

  // 단일 선택
  const handleSingleSelect = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  // 복수 선택
  const handleMultiSelect = (questionId: string, value: string) => {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) || []
      if (current.includes(value)) {
        return { ...prev, [questionId]: current.filter(v => v !== value) }
      }
      return { ...prev, [questionId]: [...current, value] }
    })
  }

  // 숫자/금액 입력
  const handleNumberInput = (questionId: string, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '')
    setAnswers(prev => ({ ...prev, [questionId]: numericValue }))
  }

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    } else {
      // 마지막 페이지면 결과 화면 표시
      setShowResult(true)
    }
  }

  const handlePrev = () => {
    if (showResult) {
      setShowResult(false)
    } else if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleComplete = () => {
    const investmentType = calculateInvestmentType(answers)
    onComplete(answers, investmentType.type)
  }

  const isLastPage = currentPage === totalPages - 1

  // 결과 화면
  if (showResult) {
    const investmentType = calculateInvestmentType(answers)

    return (
      <div className={styles.container}>
        <div className={styles.resultContainer}>
          <p className={styles.resultLabel}>당신의 투자 성향은</p>
          <div className={styles.resultType} style={{ color: investmentType.color }}>
            {investmentType.label}
          </div>
          <p className={styles.resultDescription}>
            {investmentType.description}
          </p>
        </div>

        <div className={styles.footer}>
          <div className={styles.navigation}>
            <button className={styles.prevBtn} onClick={handlePrev}>
              다시 보기
            </button>
            <button className={styles.nextBtn} onClick={handleComplete}>
              완료하기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <div className={styles.headerInfo}>
          {missionNumber !== undefined && (
            <p className={styles.missionLabel}>Mission {missionNumber}</p>
          )}
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.pageIndicator}>
            {Array.from({ length: totalPages }, (_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i === currentPage ? styles.activeDot : ''} ${i < currentPage ? styles.completedDot : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.form}>
        {currentQuestions.map(question => (
          <div key={question.id} className={styles.field}>
            <label className={styles.label}>{question.text}</label>

            {/* 단일 선택 */}
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

            {/* 복수 선택 - 태그 스타일 */}
            {question.type === 'multi' && question.options && (
              <div className={styles.options}>
                {question.options.map(option => {
                  const isSelected = Array.isArray(answers[question.id]) &&
                    (answers[question.id] as string[]).includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.optionBtn} ${styles.tagStyle} ${isSelected ? styles.selected : ''}`}
                      onClick={() => handleMultiSelect(question.id, option.value)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* 숫자/금액 입력 */}
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
                {question.unit && (
                  <span className={styles.unit}>{question.unit}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.navigation}>
          {currentPage > 0 ? (
            <button className={styles.prevBtn} onClick={handlePrev}>
              이전
            </button>
          ) : (
            <button className={styles.skipBtn} onClick={onSkip}>
              건너뛰기
            </button>
          )}
          <button
            className={styles.nextBtn}
            onClick={handleNext}
            disabled={!isCurrentPageComplete}
          >
            {isLastPage ? '결과 보기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}
