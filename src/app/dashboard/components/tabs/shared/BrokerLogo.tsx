"use client"

import { useState, type ReactNode } from 'react'
import { getBrokerLogo } from '@/lib/constants/financial'
import styles from './BrokerLogo.module.css'

const SIZE_MAP = { sm: 18, md: 24 } as const

interface BrokerLogoProps {
  brokerName: string | null
  fallback?: string
  fallbackIcon?: ReactNode
  size?: 'sm' | 'md'
}

export function BrokerLogo({
  brokerName,
  fallback = '?',
  fallbackIcon,
  size = 'sm',
}: BrokerLogoProps) {
  const logo = getBrokerLogo(brokerName)
  const px = SIZE_MAP[size]
  const [failed, setFailed] = useState(false)

  return (
    <span className={styles[size]}>
      {logo && !failed ? (
        <img
          src={logo}
          alt=""
          width={px}
          height={px}
          loading="eager"
          decoding="async"
          className={styles.logo}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={styles.placeholder}>
          {fallbackIcon || (brokerName || fallback).charAt(0)}
        </div>
      )}
    </span>
  )
}
