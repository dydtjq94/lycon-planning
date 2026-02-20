'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  FINANCIAL_ICON_PRESETS,
  FINANCIAL_COLOR_PRESETS,
  getFinancialIcon,
  getFinancialColor,
  getFinancialIconById,
} from '@/lib/constants/financialIcons'
import { useChartTheme } from '@/hooks/useChartTheme'
import styles from './FinancialIconPicker.module.css'

interface FinancialItemIconProps {
  category: string
  type: string
  icon?: string | null
  color?: string | null
  onSave?: (icon: string | null, color: string | null) => void
}

export function FinancialItemIcon({ category, type, icon, color, onSave }: FinancialItemIconProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempIcon, setTempIcon] = useState<string | null>(icon || null)
  const [tempColor, setTempColor] = useState<string | null>(color || null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const iconRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { isDark } = useChartTheme()

  // Refs for latest values (avoid stale closures in inline handlers)
  const tempIconRef = useRef(tempIcon)
  const tempColorRef = useRef(tempColor)
  tempIconRef.current = tempIcon
  tempColorRef.current = tempColor

  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const displayIcon = isOpen ? tempIcon : (icon || null)
  const displayColor = isOpen ? tempColor : (color || null)

  const Icon = displayIcon ? getFinancialIconById(displayIcon) : getFinancialIcon(category, type)
  const iconColor = displayColor || getFinancialColor(category)

  const editable = !!onSave

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!editable) return
    e.stopPropagation()
    e.preventDefault()

    if (isOpen) {
      setIsOpen(false)
      return
    }

    const rect = iconRef.current?.getBoundingClientRect()
    if (rect) {
      let left = rect.left
      const panelWidth = 220
      if (left + panelWidth > window.innerWidth - 16) {
        left = window.innerWidth - panelWidth - 16
      }
      if (left < 16) left = 16
      setPos({ top: rect.bottom + 6, left })
    }
    setTempIcon(icon || null)
    setTempColor(color || null)
    setIsOpen(true)
  }, [editable, isOpen, icon, color])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        iconRef.current && !iconRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isOpen])

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [isOpen])

  return (
    <>
      <div
        ref={iconRef}
        onClick={handleClick}
        data-icon-editable={editable ? '' : undefined}
        className={editable ? styles.iconCircle : undefined}
        style={{
          width: 28,
          height: 28,
          minWidth: 28,
          borderRadius: '50%',
          background: `${iconColor}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
          cursor: editable ? 'pointer' : undefined,
        }}
      >
        <Icon size={15} color={iconColor} strokeWidth={2} />
      </div>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          className={styles.popover}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            background: isDark ? 'rgba(34, 37, 41, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}
        >
          <div className={styles.iconGrid}>
            {FINANCIAL_ICON_PRESETS.map((item) => {
              const ItemIcon = item.icon
              const isSelected = (tempIcon || icon) === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.iconItem} ${isSelected ? styles.iconItemActive : ''}`}
                  style={isSelected ? { color: iconColor } : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    setTempIcon(item.id)
                    onSaveRef.current?.(item.id, tempColorRef.current)
                  }}
                  title={item.label}
                >
                  <ItemIcon size={16} />
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
                className={`${styles.colorItem} ${iconColor === item.color ? styles.colorItemActive : ''}`}
                style={{ background: item.color }}
                onClick={(e) => {
                  e.stopPropagation()
                  setTempColor(item.color)
                  onSaveRef.current?.(tempIconRef.current, item.color)
                }}
              />
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
