'use client'

import type { OnboardingData } from '@/types'
import styles from './Charts.module.css'

interface WelcomeChartProps {
  data: OnboardingData
}

export function WelcomeChart({}: WelcomeChartProps) {
  return (
    <div className={styles.quoteContainer}>
      <div className={styles.quoteIcon}>"</div>
      <blockquote className={styles.quoteText}>
        은퇴 후에 뭔가 하려고 하면<br />
        조급해질 수밖에 없다.<br />
        <span className={styles.quoteHighlight}>
          월급 받을 수 있는 직장이 있을 때<br />
          이것저것 먼저 해봐야 한다.
        </span>
      </blockquote>
      <cite className={styles.quoteSource}>
        — 서울 자가에 대기업 다니는 김 부장 이야기
      </cite>
    </div>
  )
}
