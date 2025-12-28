'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { OnboardingData } from '@/types'
import { formatMoney } from '../formatUtils'
import styles from './Charts.module.css'

interface RetirementGoalChartProps {
  data: OnboardingData
}

// 생활 수준 가이드 (30년 기준, 연 4% 인출률)
const lifestyleLevels = [
  {
    level: '기본',
    asset: 50000,  // 5억
    monthly: 139,  // 월 139만원
    description: '기본 생활비 충당'
  },
  {
    level: '안정',
    asset: 100000, // 10억
    monthly: 278,  // 월 278만원
    description: '여유로운 일상'
  },
  {
    level: '여유',
    asset: 150000, // 15억
    monthly: 417,  // 월 417만원
    description: '취미와 여행'
  },
  {
    level: '풍요',
    asset: 200000, // 20억
    monthly: 556,  // 월 556만원
    description: '풍요로운 노후'
  },
]

export function RetirementGoalChart({ data }: RetirementGoalChartProps) {
  const targetAsset = data.target_retirement_fund || 0
  const [debouncedTarget, setDebouncedTarget] = useState(targetAsset)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // 1.5초 디바운스
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedTarget(targetAsset)
    }, 1500)
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [targetAsset])

  // 월 인출 가능 금액 계산 (30년, 4% 수익률 가정)
  const monthlyWithdrawal = Math.round((debouncedTarget * 0.04) / 12)

  // 현재 목표가 어느 레벨에 해당하는지
  const getCurrentLevel = () => {
    if (debouncedTarget >= 200000) return '풍요'
    if (debouncedTarget >= 150000) return '여유'
    if (debouncedTarget >= 100000) return '안정'
    if (debouncedTarget >= 50000) return '기본'
    return null
  }

  const currentLevel = getCurrentLevel()

  return (
    <div className={styles.goalChart}>
      <div className={styles.goalHeader}>
        <span className={styles.goalLabel}>생활 수준 가이드</span>
      </div>

      <div className={styles.goalLevels}>
        {lifestyleLevels.map((item) => {
          const isActive = currentLevel === item.level
          const isPassed = debouncedTarget >= item.asset

          return (
            <div
              key={item.level}
              className={`${styles.goalLevel} ${isActive ? styles.goalLevelActive : ''} ${isPassed ? styles.goalLevelPassed : ''}`}
            >
              <div className={styles.goalLevelHeader}>
                <span className={styles.goalLevelName}>{item.level}</span>
                <span className={styles.goalLevelAsset}>{formatMoney(item.asset)}</span>
              </div>
              <div className={styles.goalLevelDetail}>
                <span className={styles.goalLevelMonthly}>월 {item.monthly}만원</span>
                <span className={styles.goalLevelDesc}>{item.description}</span>
              </div>
            </div>
          )
        })}
      </div>

      {debouncedTarget > 0 && (
        <div className={styles.goalResult}>
          <div className={styles.goalResultLabel}>내 목표</div>
          <div className={styles.goalResultValue}>
            <span className={styles.goalResultAsset}>{formatMoney(debouncedTarget)}</span>
            <span className={styles.goalResultMonthly}>월 {monthlyWithdrawal}만원 사용 가능</span>
          </div>
        </div>
      )}

      <div className={styles.goalNote}>
        * 연 4% 수익률, 30년 기준
      </div>
    </div>
  )
}
