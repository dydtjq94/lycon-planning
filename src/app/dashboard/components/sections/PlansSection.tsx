'use client'

import { Plus } from 'lucide-react'
import type { OnboardingData, SimulationSettings } from '@/types'
import styles from './Sections.module.css'

interface PlansSectionProps {
  data: OnboardingData
  settings: SimulationSettings
}

export function PlansSection({ data, settings }: PlansSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.plansHeader}>
        <h3 className={styles.sectionTitle}>Plans for the Future</h3>
      </div>

      <div className={styles.plansGrid}>
        <button className={styles.addPlanCard}>
          <div className={styles.addPlanIcon}>
            <Plus size={24} />
          </div>
          <div className={styles.addPlanText}>
            <span className={styles.addPlanTitle}>Add Plan</span>
            <span className={styles.addPlanDesc}>Create a new plan</span>
          </div>
        </button>

        <div className={styles.planCard}>
          <div className={styles.planHeader}>
            <span className={styles.planTitle}>기본 시나리오</span>
            <span className={styles.planBadge}>Active</span>
          </div>
          <div className={styles.planDetails}>
            <div className={styles.planRow}>
              <span>은퇴 나이</span>
              <span>{data.target_retirement_age || 60}세</span>
            </div>
            <div className={styles.planRow}>
              <span>예상 수명</span>
              <span>{settings.lifeExpectancy}세</span>
            </div>
            <div className={styles.planRow}>
              <span>투자 수익률</span>
              <span>{settings.investmentReturn}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.scenarioSection}>
        <h3 className={styles.sectionTitle}>What-If Scenarios</h3>
        <div className={styles.scenarioList}>
          <div className={styles.scenarioItem}>
            <span className={styles.scenarioName}>월 50만원 추가 저축하면?</span>
            <span className={styles.scenarioResult}>은퇴 자금 +15% 증가</span>
          </div>
          <div className={styles.scenarioItem}>
            <span className={styles.scenarioName}>3년 늦게 은퇴하면?</span>
            <span className={styles.scenarioResult}>은퇴 자금 +25% 증가</span>
          </div>
          <div className={styles.scenarioItem}>
            <span className={styles.scenarioName}>투자 수익률 7%면?</span>
            <span className={styles.scenarioResult}>은퇴 자금 +40% 증가</span>
          </div>
        </div>
      </div>
    </div>
  )
}
