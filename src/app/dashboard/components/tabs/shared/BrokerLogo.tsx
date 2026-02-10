import type { ReactNode } from 'react'
import { getBrokerLogo } from '@/lib/constants/financial'
import styles from './BrokerLogo.module.css'

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

  return (
    <span className={styles[size]}>
      {logo ? (
        <img src={logo} alt="" className={styles.logo} />
      ) : (
        <div className={styles.placeholder}>
          {fallbackIcon || (brokerName || fallback).charAt(0)}
        </div>
      )}
    </span>
  )
}
