'use client'

import { Wallet, TrendingDown, Home, PiggyBank, CreditCard, Coins, Check } from 'lucide-react'
import styles from '../onboarding.module.css'

export type CategoryType = 'income' | 'expense' | 'realEstate' | 'asset' | 'debt' | 'pension'

interface CategoryOption {
  id: CategoryType
  icon: typeof Wallet
  title: string
  description: string
}

const categories: CategoryOption[] = [
  {
    id: 'income',
    icon: Wallet,
    title: '수입',
    description: '월급, 사업소득, 임대소득 등',
  },
  {
    id: 'expense',
    icon: TrendingDown,
    title: '지출',
    description: '생활비, 고정지출 등',
  },
  {
    id: 'realEstate',
    icon: Home,
    title: '부동산',
    description: '아파트, 주택, 토지 등',
  },
  {
    id: 'asset',
    icon: PiggyBank,
    title: '금융자산',
    description: '예금, 주식, 펀드 등',
  },
  {
    id: 'debt',
    icon: CreditCard,
    title: '부채',
    description: '대출, 카드빚 등',
  },
  {
    id: 'pension',
    icon: Coins,
    title: '연금',
    description: '국민연금, 퇴직연금 등',
  },
]

interface CategorySelectStepProps {
  selectedCategories: CategoryType[]
  onToggleCategory: (category: CategoryType) => void
}

export function CategorySelectStep({ selectedCategories, onToggleCategory }: CategorySelectStepProps) {
  return (
    <div>
      <h2 className={styles.pageTitle}>어떤 정보를 입력하시겠어요?</h2>
      <p className={styles.pageDescription}>해당하는 항목을 선택해주세요. 나중에 추가할 수 있어요.</p>

      <div className={styles.categoryList}>
        {categories.map((category) => {
          const Icon = category.icon
          const isSelected = selectedCategories.includes(category.id)

          return (
            <button
              key={category.id}
              type="button"
              className={`${styles.categoryItem} ${isSelected ? styles.categoryItemSelected : ''}`}
              onClick={() => onToggleCategory(category.id)}
            >
              <div className={`${styles.categoryCheckbox} ${isSelected ? styles.categoryCheckboxSelected : ''}`}>
                {isSelected && <Check size={14} strokeWidth={3} />}
              </div>
              <div className={styles.categoryItemIcon}>
                <Icon size={20} />
              </div>
              <div className={styles.categoryItemContent}>
                <span className={styles.categoryItemTitle}>{category.title}</span>
                <span className={styles.categoryItemDesc}>{category.description}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
