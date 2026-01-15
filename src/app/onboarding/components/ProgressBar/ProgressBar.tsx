'use client'

import React from 'react'
import { type PartId, partInfo } from '../ProgressiveForm/types'
import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  currentPart: PartId
  completedParts: PartId[]
}

export function ProgressBar({ currentPart, completedParts }: ProgressBarProps) {
  const parts: PartId[] = [1, 2, 3, 4, 5]

  return (
    <div className={styles.container}>
      <div className={styles.track}>
        {parts.map((part, index) => {
          const isCompleted = completedParts.includes(part)
          const isCurrent = part === currentPart
          const isPast = part < currentPart

          return (
            <React.Fragment key={part}>
              {/* 연결선 (첫 번째 제외) */}
              {index > 0 && (
                <div
                  className={`${styles.connector} ${
                    isPast || isCompleted ? styles.connectorCompleted : ''
                  }`}
                />
              )}

              {/* 파트 노드 */}
              <div
                className={`${styles.node} ${
                  isCompleted ? styles.nodeCompleted : ''
                } ${isCurrent ? styles.nodeCurrent : ''}`}
              >
                <div className={styles.dot} />
                <span className={styles.label}>{partInfo[part].label}</span>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
