'use client'

import React from 'react'
import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

interface RetirementPensionGuideProps {
  data: OnboardingData
}

export function RetirementPensionGuide({ }: RetirementPensionGuideProps) {
  return (
    <div className={styles.pensionTypeGuide}>
      <table className={styles.pensionTable}>
        <thead>
          <tr>
            <th></th>
            <th>DC형/기업IRP</th>
            <th>DB형/퇴직금</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.pensionTableLabel}>운용 주체</td>
            <td>본인</td>
            <td>회사</td>
          </tr>
          <tr>
            <td className={styles.pensionTableLabel}>수령액</td>
            <td>적립금+수익</td>
            <td>급여x근속</td>
          </tr>
          <tr>
            <td className={styles.pensionTableLabel}>리스크</td>
            <td>본인 부담</td>
            <td>회사 부담</td>
          </tr>
          <tr>
            <td className={styles.pensionTableLabel}>입력값</td>
            <td>현재 적립금</td>
            <td>예상 퇴직금</td>
          </tr>
        </tbody>
      </table>
      <p className={styles.pensionTypeNote}>
        급여명세서나 사내 인트라넷에서 확인할 수 있어요
      </p>
    </div>
  )
}
