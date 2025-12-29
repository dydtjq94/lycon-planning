'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

interface RetirementPensionGuideProps {
  data: OnboardingData
}

interface PensionType {
  name: string
  manager: string
  riskBearer: string
  calculation: string
  feature: string
}

const pensionTypes: PensionType[] = [
  {
    name: 'DC형',
    manager: '본인',
    riskBearer: '본인',
    calculation: '적립금 + 운용수익',
    feature: '운용 잘하면 더 받을 수 있음',
  },
  {
    name: 'DB형',
    manager: '회사',
    riskBearer: '회사',
    calculation: '퇴직 전 3개월 평균임금 × 근속연수',
    feature: '수령액이 확정되어 안정적',
  },
  {
    name: '기업형 IRP',
    manager: '본인',
    riskBearer: '본인',
    calculation: '적립금 + 운용수익',
    feature: '10인 미만 사업장용 DC형',
  },
  {
    name: '퇴직금',
    manager: '회사',
    riskBearer: '회사',
    calculation: '퇴직 전 3개월 평균임금 × 근속연수',
    feature: '퇴직 시 일시금 지급',
  },
]

export function RetirementPensionGuide({ data }: RetirementPensionGuideProps) {
  return (
    <div className={styles.pensionTypeGuide}>
      <table className={styles.pensionTypeTable}>
        <thead>
          <tr>
            <th>유형</th>
            <th>운용</th>
            <th>특징</th>
          </tr>
        </thead>
        <tbody>
          {pensionTypes.map((type) => (
            <tr key={type.name}>
              <td className={styles.pensionTypeName}>{type.name}</td>
              <td>{type.manager}</td>
              <td className={styles.pensionTypeFeature}>{type.feature}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.pensionTypeNote}>
        급여명세서나 사내 인트라넷에서 확인할 수 있어요
      </p>
    </div>
  )
}
