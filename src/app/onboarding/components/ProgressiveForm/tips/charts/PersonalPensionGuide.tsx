'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

interface PersonalPensionGuideProps {
  data: OnboardingData
}

interface PensionType {
  name: string
  limit: string
  withdrawal: string
  note: string
}

const pensionTypes: PensionType[] = [
  {
    name: '연금저축',
    limit: '600만원',
    withdrawal: '가능',
    note: '누구나 가입 가능',
  },
  {
    name: 'IRP',
    limit: '+300만원',
    withdrawal: '불가',
    note: '소득자만 가입',
  },
  {
    name: 'ISA',
    limit: '비과세',
    withdrawal: '가능',
    note: '3년 후 연금 전환 시 추가 공제',
  },
]

export function PersonalPensionGuide({ data }: PersonalPensionGuideProps) {
  return (
    <div className={styles.pensionTypeGuide}>
      <div className={styles.pensionStrategy}>
        <span className={styles.pensionStrategyLabel}>절세 전략</span>
        <span className={styles.pensionStrategyValue}>연금저축 600 + IRP 300 = 900만원</span>
      </div>
      <table className={styles.pensionTypeTable}>
        <thead>
          <tr>
            <th>유형</th>
            <th>공제한도</th>
            <th>중도인출</th>
          </tr>
        </thead>
        <tbody>
          {pensionTypes.map((type) => (
            <tr key={type.name}>
              <td className={styles.pensionTypeName}>{type.name}</td>
              <td>{type.limit}</td>
              <td>{type.withdrawal}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.pensionTypeNote}>
        없으면 0으로 넘어가세요
      </p>
    </div>
  )
}
