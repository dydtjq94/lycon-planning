'use client'

import { useState } from 'react'
import {
  FINANCIAL_ICON_PRESETS,
  FINANCIAL_COLOR_PRESETS,
  getFinancialIcon,
  getFinancialColor,
  getFinancialIconById,
} from '@/lib/constants/financialIcons'
import styles from './FinancialIconPicker.module.css'

interface FinancialIconPickerProps {
  category: string
  type: string
  icon: string | null
  color: string | null
  onIconChange: (icon: string | null) => void
  onColorChange: (color: string | null) => void
}

export function FinancialIconPicker({
  category,
  type,
  icon,
  color,
  onIconChange,
  onColorChange,
}: FinancialIconPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const CurrentIcon = icon ? getFinancialIconById(icon) : getFinancialIcon(category, type)
  const currentColor = color || getFinancialColor(category)

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div
          className={styles.preview}
          style={{ background: `${currentColor}18` }}
        >
          <CurrentIcon size={15} color={currentColor} strokeWidth={2} />
        </div>
        <span className={styles.triggerLabel}>아이콘</span>
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.iconGrid}>
            {FINANCIAL_ICON_PRESETS.map((item) => {
              const Icon = item.icon
              const isSelected = icon === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.iconItem} ${isSelected ? styles.iconItemActive : ''}`}
                  style={isSelected ? { color: currentColor } : undefined}
                  onClick={() => {
                    onIconChange(item.id)
                  }}
                  title={item.label}
                >
                  <Icon size={16} />
                </button>
              )
            })}
          </div>
          <div className={styles.divider} />
          <div className={styles.colorGrid}>
            {FINANCIAL_COLOR_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.colorItem} ${currentColor === item.color ? styles.colorItemActive : ''}`}
                style={{ background: item.color }}
                onClick={() => {
                  onColorChange(item.color)
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
