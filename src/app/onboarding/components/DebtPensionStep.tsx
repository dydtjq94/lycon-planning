'use client'

import { AssetList } from './AssetList'
import type { AssetInput } from '@/types'
import styles from '../onboarding.module.css'

interface DebtPensionStepProps {
  debts: AssetInput[]
  pensions: AssetInput[]
  onAddDebt: () => void
  onRemoveDebt: (index: number) => void
  onUpdateDebt: (index: number, updates: Partial<AssetInput>) => void
  onAddPension: () => void
  onRemovePension: (index: number) => void
  onUpdatePension: (index: number, updates: Partial<AssetInput>) => void
}

export function DebtPensionStep({
  debts,
  pensions,
  onAddDebt,
  onRemoveDebt,
  onUpdateDebt,
  onAddPension,
  onRemovePension,
  onUpdatePension,
}: DebtPensionStepProps) {
  return (
    <div className={styles.debtPensionSection}>
      <div>
        <h2 className={styles.pageTitle}>부채</h2>
        <p className={styles.pageDescription}>대출 등 부채를 입력해주세요</p>
        <AssetList
          items={debts}
          placeholder="부채 (예: 주택담보대출)"
          showFrequency={false}
          onAdd={onAddDebt}
          onRemove={onRemoveDebt}
          onUpdate={onUpdateDebt}
        />
      </div>
      <hr className={styles.divider} />
      <div>
        <h2 className={styles.pageTitle}>연금</h2>
        <p className={styles.pageDescription}>예상 연금을 입력해주세요</p>
        <AssetList
          items={pensions}
          placeholder="연금 (예: 국민연금)"
          showFrequency={true}
          onAdd={onAddPension}
          onRemove={onRemovePension}
          onUpdate={onUpdatePension}
        />
      </div>
    </div>
  )
}
