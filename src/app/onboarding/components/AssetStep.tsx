'use client'

import { AssetList } from './AssetList'
import type { AssetInput } from '@/types'
import styles from '../onboarding.module.css'

interface AssetStepProps {
  title: string
  description: string
  items: AssetInput[]
  placeholder: string
  showFrequency?: boolean
  onAdd: () => void
  onRemove: (index: number) => void
  onUpdate: (index: number, updates: Partial<AssetInput>) => void
}

export function AssetStep({
  title,
  description,
  items,
  placeholder,
  showFrequency = true,
  onAdd,
  onRemove,
  onUpdate,
}: AssetStepProps) {
  return (
    <div>
      <h2 className={styles.pageTitle}>{title}</h2>
      <p className={styles.pageDescription}>{description}</p>
      <AssetList
        items={items}
        placeholder={placeholder}
        showFrequency={showFrequency}
        onAdd={onAdd}
        onRemove={onRemove}
        onUpdate={onUpdate}
      />
    </div>
  )
}
