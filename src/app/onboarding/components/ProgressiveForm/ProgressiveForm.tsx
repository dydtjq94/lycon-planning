'use client'

import React, { useState, useEffect } from 'react'
import type { OnboardingData } from '@/types'
import styles from './ProgressiveForm.module.css'

import { type StepId, type ProgressiveFormProps, steps, getCurrentPart } from './types'
import { TipPanel } from './tips'

export function ProgressiveForm({
  data,
  currentStepIndex = 0
}: ProgressiveFormProps) {
  const [activeStep, setActiveStep] = useState<StepId>('purpose')

  // currentStepIndex와 activeStep 동기화
  useEffect(() => {
    if (currentStepIndex >= 0 && currentStepIndex < steps.length) {
      const targetStepId = steps[currentStepIndex].id
      if (activeStep !== targetStepId) {
        setActiveStep(targetStepId)
      }
    }
  }, [currentStepIndex, activeStep])

  const currentPart = getCurrentPart(activeStep)

  return (
    <div className={styles.rightPanelSplit}>
      <div className={styles.rightPanelFull}>
        <TipPanel
          activeStep={activeStep}
          currentPart={currentPart}
          data={data}
        />
      </div>
    </div>
  )
}
