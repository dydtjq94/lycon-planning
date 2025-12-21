'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Plus, X } from 'lucide-react'
import type { OnboardingData } from '@/types'
import type { RowId, AssetRowInputProps } from '../types'
import { calculateTotalValue, formatMoney } from '../utils'
import styles from '../../../onboarding.module.css'

// 저축 입력
export function renderSavingsInput({ data, onUpdateData, onFocus, deleteAssetItem, updateAssetItem }: AssetRowInputProps) {
  const savingsItems = data.assets.filter(item =>
    ['예금', '적금', 'CMA', 'MMF', '저축', '비상금'].some(keyword => item.name.includes(keyword)) ||
    item.subcategory === '저축'
  )
  const savingsTotal = calculateTotalValue(savingsItems)

  return (
    <div className={styles.excelAssetRow}>
      <div className={styles.excelAssetGroup}>
        <div className={styles.excelAssetGroupHeader}>
          <span className={styles.excelAssetGroupLabel}>정기 저축</span>
        </div>
        {savingsItems.length === 0 && (
          <p className={styles.excelEmptyText}>예금, 적금, CMA 등 안전 자산을 입력하세요</p>
        )}
        {savingsItems.map((item, idx) => {
          const originalIndex = data.assets.indexOf(item)
          return (
            <div key={originalIndex} className={styles.excelAssetItem}>
              <Input
                placeholder="저축 항목"
                value={item.name}
                onChange={(e) => updateAssetItem('assets', originalIndex, { name: e.target.value })}
                onFocus={() => onFocus('savings')}
              />
              <MoneyInput
                value={item.amount}
                onChange={(value) => updateAssetItem('assets', originalIndex, { amount: value })}
                placeholder="0"
              />
              <button
                className={styles.excelDeleteBtn}
                onClick={() => deleteAssetItem('assets', originalIndex)}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
        <button
          className={styles.excelAddSmall}
          onClick={() => {
            const newItem = { name: '', amount: null, frequency: 'once' as const, subcategory: '저축' }
            onUpdateData({ assets: [...data.assets, newItem] })
          }}
        >
          <Plus size={14} /> 저축 추가
        </button>
      </div>
      {savingsTotal > 0 && (
        <span className={styles.excelTotal}>총 저축: {formatMoney(savingsTotal)}</span>
      )}
    </div>
  )
}

// 투자 입력
export function renderInvestmentInput({ data, onUpdateData, onFocus, deleteAssetItem, updateAssetItem }: AssetRowInputProps) {
  const investmentItems = data.assets.filter(item =>
    ['주식', 'ETF', '펀드', '채권', '암호화폐', '코인', '투자'].some(keyword => item.name.includes(keyword)) ||
    item.subcategory === '투자'
  )
  const investmentTotal = calculateTotalValue(investmentItems)

  return (
    <div className={styles.excelAssetRow}>
      <div className={styles.excelAssetGroup}>
        <div className={styles.excelAssetGroupHeader}>
          <span className={styles.excelAssetGroupLabel}>투자 자산</span>
        </div>
        {investmentItems.length === 0 && (
          <p className={styles.excelEmptyText}>주식, ETF, 펀드, 채권 등 투자 자산을 입력하세요</p>
        )}
        {investmentItems.map((item, idx) => {
          const originalIndex = data.assets.indexOf(item)
          return (
            <div key={originalIndex} className={styles.excelAssetItem}>
              <Input
                placeholder="투자 항목"
                value={item.name}
                onChange={(e) => updateAssetItem('assets', originalIndex, { name: e.target.value })}
                onFocus={() => onFocus('investment')}
              />
              <MoneyInput
                value={item.amount}
                onChange={(value) => updateAssetItem('assets', originalIndex, { amount: value })}
                placeholder="0"
              />
              <button
                className={styles.excelDeleteBtn}
                onClick={() => deleteAssetItem('assets', originalIndex)}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
        <button
          className={styles.excelAddSmall}
          onClick={() => {
            const newItem = { name: '', amount: null, frequency: 'once' as const, subcategory: '투자' }
            onUpdateData({ assets: [...data.assets, newItem] })
          }}
        >
          <Plus size={14} /> 투자 추가
        </button>
      </div>
      {investmentTotal > 0 && (
        <span className={styles.excelTotal}>총 투자: {formatMoney(investmentTotal)}</span>
      )}
    </div>
  )
}
