'use client'

import { BarChart3, Clock } from 'lucide-react'
import styles from '../onboarding.module.css'

interface WelcomeStepProps {
  onStart: () => void
  onSandbox: () => void
  saving: boolean
}

export function WelcomeStep({ onStart, onSandbox, saving }: WelcomeStepProps) {
  return (
    <div className={styles.welcomeContainer}>
      <h2 className={styles.pageTitle}>당신의 은퇴를 설계해봐요!</h2>
      <p className={styles.pageDescription}>몇 분 안에 멋진 시뮬레이션을 볼 수 있어요</p>

      <div className={styles.welcomeGrid}>
        <button onClick={onStart} className={styles.welcomeCard}>
          <div className={styles.welcomeCardHeader}>
            <div className={`${styles.welcomeCardIcon} ${styles.welcomeCardIconBlue}`}>
              <BarChart3 className={`${styles.icon20} ${styles.iconBlue}`} />
            </div>
            <span className={styles.welcomeCardTitle}>일반 설정</span>
          </div>
          <p className={styles.welcomeCardDescription}>단계별로 정보를 입력하세요.</p>
          <div className={styles.welcomeCardTime}>
            <Clock className={styles.icon12} />
            <span>5-10분</span>
          </div>
        </button>

        <button
          onClick={onSandbox}
          disabled={saving}
          className={styles.welcomeCard}
        >
          <div className={styles.welcomeCardHeader}>
            <div className={`${styles.welcomeCardIcon} ${styles.welcomeCardIconPurple}`}>
              <BarChart3 className={`${styles.icon20} ${styles.iconPurple}`} />
            </div>
            <span className={styles.welcomeCardTitle}>둘러보기</span>
          </div>
          <p className={styles.welcomeCardDescription}>40대 대기업 직장인 예시로 체험하세요.</p>
          <div className={styles.welcomeCardTime}>
            <Clock className={styles.icon12} />
            <span>약 1분</span>
          </div>
        </button>
      </div>
    </div>
  )
}
