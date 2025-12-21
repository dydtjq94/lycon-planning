'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Plus, X } from 'lucide-react'
import type { AssetInput, Frequency } from '@/types'
import type { RowId, AssetRowInputProps, frequencyLabels } from '../types'
import { calculateMonthlyTotal, calculateTotalValue, formatMoney } from '../utils'
import styles from '../../../onboarding.module.css'

interface AssetDebtRowsProps extends AssetRowInputProps {
  frequencyLabels: typeof frequencyLabels
}

// 부동산 입력
export function renderRealEstateInput({ data, onFocus, addAssetItem, updateAssetItem, deleteAssetItem, frequencyLabels }: AssetDebtRowsProps) {
  const items = data.realEstates
  const total = calculateTotalValue(items)

  return (
    <div className={styles.excelAssetRow}>
      {items.map((item, index) => (
        <div key={index} className={styles.excelAssetItem}>
          <Input
            placeholder="항목명"
            value={item.name}
            onChange={(e) => updateAssetItem('realEstates', index, { name: e.target.value })}
            onFocus={() => onFocus('realEstate')}
          />
          <MoneyInput
            value={item.amount}
            onChange={(value) => updateAssetItem('realEstates', index, { amount: value })}
            placeholder="0"
          />
          <select
            className={styles.excelFrequency}
            value={item.frequency}
            onChange={(e) => updateAssetItem('realEstates', index, { frequency: e.target.value as Frequency })}
          >
            {Object.entries(frequencyLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            className={styles.excelDeleteBtn}
            onClick={() => deleteAssetItem('realEstates', index)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button className={styles.excelAddSmall} onClick={() => addAssetItem('realEstates')}>
        <Plus size={14} /> 추가
      </button>
      {total > 0 && (
        <span className={styles.excelTotal}>
          총 합계: {formatMoney(total)}
        </span>
      )}
    </div>
  )
}

// 금융자산 입력
export function renderAssetInput({ data, onFocus, addAssetItem, updateAssetItem, deleteAssetItem, frequencyLabels }: AssetDebtRowsProps) {
  const items = data.assets
  const total = calculateTotalValue(items)

  return (
    <div className={styles.excelAssetRow}>
      {items.map((item, index) => (
        <div key={index} className={styles.excelAssetItem}>
          <Input
            placeholder="항목명"
            value={item.name}
            onChange={(e) => updateAssetItem('assets', index, { name: e.target.value })}
            onFocus={() => onFocus('asset')}
          />
          <MoneyInput
            value={item.amount}
            onChange={(value) => updateAssetItem('assets', index, { amount: value })}
            placeholder="0"
          />
          <select
            className={styles.excelFrequency}
            value={item.frequency}
            onChange={(e) => updateAssetItem('assets', index, { frequency: e.target.value as Frequency })}
          >
            {Object.entries(frequencyLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            className={styles.excelDeleteBtn}
            onClick={() => deleteAssetItem('assets', index)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button className={styles.excelAddSmall} onClick={() => addAssetItem('assets')}>
        <Plus size={14} /> 추가
      </button>
      {total > 0 && (
        <span className={styles.excelTotal}>
          총 합계: {formatMoney(total)}
        </span>
      )}
    </div>
  )
}

// 부채 입력
export function renderDebtInput({ data, onFocus, addAssetItem, updateAssetItem, deleteAssetItem, frequencyLabels }: AssetDebtRowsProps) {
  const items = data.debts
  const total = calculateTotalValue(items)

  return (
    <div className={styles.excelAssetRow}>
      {items.map((item, index) => (
        <div key={index} className={styles.excelAssetItem}>
          <Input
            placeholder="항목명"
            value={item.name}
            onChange={(e) => updateAssetItem('debts', index, { name: e.target.value })}
            onFocus={() => onFocus('debt')}
          />
          <MoneyInput
            value={item.amount}
            onChange={(value) => updateAssetItem('debts', index, { amount: value })}
            placeholder="0"
          />
          <select
            className={styles.excelFrequency}
            value={item.frequency}
            onChange={(e) => updateAssetItem('debts', index, { frequency: e.target.value as Frequency })}
          >
            {Object.entries(frequencyLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            className={styles.excelDeleteBtn}
            onClick={() => deleteAssetItem('debts', index)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button className={styles.excelAddSmall} onClick={() => addAssetItem('debts')}>
        <Plus size={14} /> 추가
      </button>
      {total > 0 && (
        <span className={styles.excelTotal}>
          총 합계: {formatMoney(total)}
        </span>
      )}
    </div>
  )
}
