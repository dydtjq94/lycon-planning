'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Plus, X } from 'lucide-react'
import type { RowId, AssetRowInputProps } from '../types'
import { calculateMonthlyTotal, calculateTotalValue, formatMoney } from '../utils'
import styles from '../../../onboarding.module.css'

// 국민연금 입력
export function renderNationalPensionInput({ data, onUpdateData, onFocus, updateAssetItem, deleteAssetItem }: AssetRowInputProps) {
  const nationalPensionItem = data.pensions.find(p =>
    p.name.includes('국민연금') || p.subcategory === '국민연금'
  )
  const nationalPensionIndex = nationalPensionItem ? data.pensions.indexOf(nationalPensionItem) : -1

  return (
    <div className={styles.excelAssetRow}>
      <div className={styles.excelPensionInfo}>
        <span className={styles.excelPensionBadge}>1층</span>
        <span className={styles.excelPensionDesc}>공적연금 (만 65세부터 수령)</span>
      </div>
      {nationalPensionItem ? (
        <div className={styles.excelAssetItem}>
          <Input
            value={nationalPensionItem.name}
            onChange={(e) => updateAssetItem('pensions', nationalPensionIndex, { name: e.target.value })}
            onFocus={() => onFocus('national_pension')}
          />
          <MoneyInput
            value={nationalPensionItem.amount}
            onChange={(value) => updateAssetItem('pensions', nationalPensionIndex, { amount: value })}
            placeholder="예상 월 수령액"
          />
          <span className={styles.excelUnit}>/월</span>
          <button
            className={styles.excelDeleteBtn}
            onClick={() => deleteAssetItem('pensions', nationalPensionIndex)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          className={styles.excelAddSmall}
          onClick={() => {
            const newItem = { name: '국민연금 (예상)', amount: null, frequency: 'monthly' as const, subcategory: '국민연금' }
            onUpdateData({ pensions: [...data.pensions, newItem] })
          }}
        >
          <Plus size={14} /> 국민연금 추가
        </button>
      )}
      <p className={styles.excelHelpText}>
        국민연금공단 예상연금조회에서 확인 가능해요
      </p>
    </div>
  )
}

// 퇴직연금 입력
export function renderRetirementPensionInput({ data, onUpdateData, onFocus, updateAssetItem, deleteAssetItem }: AssetRowInputProps) {
  const retirementPensionItems = data.pensions.filter(p =>
    ['퇴직연금', 'DB', 'DC', '퇴직금'].some(keyword => p.name.includes(keyword)) ||
    p.subcategory === '퇴직연금'
  )
  const retirementPensionTotal = calculateTotalValue(retirementPensionItems)

  return (
    <div className={styles.excelAssetRow}>
      <div className={styles.excelPensionInfo}>
        <span className={styles.excelPensionBadge}>2층</span>
        <span className={styles.excelPensionDesc}>퇴직연금 (DB/DC형)</span>
      </div>
      {retirementPensionItems.length === 0 && (
        <p className={styles.excelEmptyText}>회사에서 적립 중인 퇴직연금을 입력하세요</p>
      )}
      {retirementPensionItems.map((item, idx) => {
        const originalIndex = data.pensions.indexOf(item)
        return (
          <div key={originalIndex} className={styles.excelAssetItem}>
            <select
              className={styles.excelFrequency}
              value={item.name.includes('DB') ? 'DB' : item.name.includes('DC') ? 'DC' : '퇴직금'}
              onChange={(e) => updateAssetItem('pensions', originalIndex, { name: `퇴직연금 (${e.target.value})` })}
            >
              <option value="DB">DB형</option>
              <option value="DC">DC형</option>
              <option value="퇴직금">퇴직금</option>
            </select>
            <MoneyInput
              value={item.amount}
              onChange={(value) => updateAssetItem('pensions', originalIndex, { amount: value })}
              placeholder="적립금"
            />
            <button
              className={styles.excelDeleteBtn}
              onClick={() => deleteAssetItem('pensions', originalIndex)}
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
          const newItem = { name: '퇴직연금 (DC)', amount: null, frequency: 'once' as const, subcategory: '퇴직연금' }
          onUpdateData({ pensions: [...data.pensions, newItem] })
        }}
      >
        <Plus size={14} /> 퇴직연금 추가
      </button>
      {retirementPensionTotal > 0 && (
        <span className={styles.excelTotal}>총 적립: {formatMoney(retirementPensionTotal)}</span>
      )}
    </div>
  )
}

// 개인연금 입력
export function renderPersonalPensionInput({ data, onUpdateData, onFocus, updateAssetItem, deleteAssetItem }: AssetRowInputProps) {
  const personalPensionItems = data.pensions.filter(p =>
    ['IRP', '연금저축', '개인연금'].some(keyword => p.name.includes(keyword)) ||
    p.subcategory === '개인연금'
  )
  const personalPensionTotal = calculateTotalValue(personalPensionItems)

  return (
    <div className={styles.excelAssetRow}>
      <div className={styles.excelPensionInfo}>
        <span className={styles.excelPensionBadge}>3층</span>
        <span className={styles.excelPensionDesc}>개인연금 (세액공제 혜택)</span>
      </div>
      {personalPensionItems.length === 0 && (
        <p className={styles.excelEmptyText}>IRP, 연금저축펀드/보험 등을 입력하세요</p>
      )}
      {personalPensionItems.map((item, idx) => {
        const originalIndex = data.pensions.indexOf(item)
        return (
          <div key={originalIndex} className={styles.excelAssetItem}>
            <Input
              placeholder="연금 종류"
              value={item.name}
              onChange={(e) => updateAssetItem('pensions', originalIndex, { name: e.target.value })}
              onFocus={() => onFocus('personal_pension')}
            />
            <MoneyInput
              value={item.amount}
              onChange={(value) => updateAssetItem('pensions', originalIndex, { amount: value })}
              placeholder="적립금"
            />
            <button
              className={styles.excelDeleteBtn}
              onClick={() => deleteAssetItem('pensions', originalIndex)}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
      <div className={styles.excelPensionButtons}>
        <button
          className={styles.excelAddSmall}
          onClick={() => {
            const newItem = { name: 'IRP', amount: null, frequency: 'once' as const, subcategory: '개인연금' }
            onUpdateData({ pensions: [...data.pensions, newItem] })
          }}
        >
          <Plus size={14} /> IRP
        </button>
        <button
          className={styles.excelAddSmall}
          onClick={() => {
            const newItem = { name: '연금저축펀드', amount: null, frequency: 'once' as const, subcategory: '개인연금' }
            onUpdateData({ pensions: [...data.pensions, newItem] })
          }}
        >
          <Plus size={14} /> 연금저축펀드
        </button>
        <button
          className={styles.excelAddSmall}
          onClick={() => {
            const newItem = { name: '연금저축보험', amount: null, frequency: 'once' as const, subcategory: '개인연금' }
            onUpdateData({ pensions: [...data.pensions, newItem] })
          }}
        >
          <Plus size={14} /> 연금저축보험
        </button>
      </div>
      {personalPensionTotal > 0 && (
        <span className={styles.excelTotal}>총 적립: {formatMoney(personalPensionTotal)}</span>
      )}
      <p className={styles.excelHelpText}>
        연 최대 900만원까지 세액공제 혜택 (IRP+연금저축 합산)
      </p>
    </div>
  )
}

// 기타연금 입력
export function renderOtherPensionInput({ data, onUpdateData, onFocus, updateAssetItem, deleteAssetItem }: AssetRowInputProps) {
  const otherPensionItems = data.pensions.filter(p =>
    ['주택연금', '농지연금', '기타'].some(keyword => p.name.includes(keyword)) ||
    p.subcategory === '기타연금'
  )
  const otherPensionTotal = calculateMonthlyTotal(otherPensionItems)

  return (
    <div className={styles.excelAssetRow}>
      <div className={styles.excelPensionInfo}>
        <span className={styles.excelPensionBadge}>기타</span>
        <span className={styles.excelPensionDesc}>주택연금, 농지연금 등</span>
      </div>
      {otherPensionItems.length === 0 && (
        <p className={styles.excelEmptyText}>없으면 건너뛰세요</p>
      )}
      {otherPensionItems.map((item, idx) => {
        const originalIndex = data.pensions.indexOf(item)
        return (
          <div key={originalIndex} className={styles.excelAssetItem}>
            <Input
              placeholder="연금 종류"
              value={item.name}
              onChange={(e) => updateAssetItem('pensions', originalIndex, { name: e.target.value })}
              onFocus={() => onFocus('other_pension')}
            />
            <MoneyInput
              value={item.amount}
              onChange={(value) => updateAssetItem('pensions', originalIndex, { amount: value })}
              placeholder="월 수령액"
            />
            <span className={styles.excelUnit}>/월</span>
            <button
              className={styles.excelDeleteBtn}
              onClick={() => deleteAssetItem('pensions', originalIndex)}
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
          const newItem = { name: '주택연금', amount: null, frequency: 'monthly' as const, subcategory: '기타연금' }
          onUpdateData({ pensions: [...data.pensions, newItem] })
        }}
      >
        <Plus size={14} /> 기타 연금 추가
      </button>
      {otherPensionTotal > 0 && (
        <span className={styles.excelTotal}>월 수령: {formatMoney(otherPensionTotal)}</span>
      )}
    </div>
  )
}
