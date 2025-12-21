'use client'

import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import type { AssetInput, Frequency } from '@/types'
import { Plus, Trash2 } from 'lucide-react'
import styles from '../onboarding.module.css'

const frequencyLabels: Record<Frequency, string> = {
  monthly: '월',
  yearly: '연',
  once: '일시',
}

interface AssetListProps {
  items: AssetInput[]
  placeholder: string
  showFrequency?: boolean
  onAdd: () => void
  onRemove: (index: number) => void
  onUpdate: (index: number, updates: Partial<AssetInput>) => void
}

export function AssetList({
  items,
  placeholder,
  showFrequency = true,
  onAdd,
  onRemove,
  onUpdate,
}: AssetListProps) {
  return (
    <div className={styles.assetList}>
      {items.map((item, index) => (
        <div key={index} className={styles.assetItem}>
          <div className={styles.assetItemRow}>
            <Input
              placeholder={placeholder}
              value={item.name}
              onChange={(e) => onUpdate(index, { name: e.target.value })}
            />
            {showFrequency && (
              <select
                className={styles.assetSelect}
                value={item.frequency}
                onChange={(e) => onUpdate(index, { frequency: e.target.value as Frequency })}
              >
                {Object.entries(frequencyLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}
            <button
              className={styles.deleteButton}
              onClick={() => onRemove(index)}
            >
              <Trash2 className={styles.icon16} />
            </button>
          </div>
          <MoneyInput
            value={item.amount}
            onChange={(value) => onUpdate(index, { amount: value })}
            placeholder="0"
          />
        </div>
      ))}
      <button className={styles.addButton} onClick={onAdd}>
        <Plus className={styles.icon16} />
        항목 추가
      </button>
    </div>
  )
}
