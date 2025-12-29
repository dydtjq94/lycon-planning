'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Target,
  ChevronDown,
  ChevronRight,
  LogOut,
  Settings,
  Banknote,
  PiggyBank,
  CreditCard,
  Home,
  Landmark,
  LineChart,
  PieChart,
  ArrowRightLeft,
  Calculator,
  Receipt,
  Pin,
  PinOff,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './Sidebar.module.css'

interface SidebarProps {
  currentSection: string
  onSectionChange: (section: string) => void
  isExpanded: boolean
  onExpandChange: (expanded: boolean) => void
}

const dashboardMenus = [
  { id: 'overview', label: '전체 요약', icon: LayoutDashboard },
  { id: 'networth', label: '순자산', icon: PieChart },
  { id: 'cashflow-overview', label: '현금흐름', icon: ArrowRightLeft },
  { id: 'tax', label: '세금분석', icon: Calculator },
]

const financeSubmenus = [
  { id: 'income', label: '소득', icon: Banknote },
  { id: 'expense', label: '지출', icon: Receipt },
  { id: 'savings', label: '저축/투자', icon: LineChart },
  { id: 'pension', label: '연금', icon: Landmark },
  { id: 'realEstate', label: '부동산', icon: Home },
  { id: 'asset', label: '자산', icon: PiggyBank },
  { id: 'debt', label: '부채', icon: CreditCard },
]

export function Sidebar({ currentSection, onSectionChange, isExpanded, onExpandChange }: SidebarProps) {
  const router = useRouter()
  const [isFinanceOpen, setIsFinanceOpen] = useState(true)
  const [isPinned, setIsPinned] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleMouseLeave = () => {
    if (!isPinned) {
      onExpandChange(false)
    }
  }

  const handlePin = () => {
    setIsPinned(!isPinned)
    if (!isPinned) {
      onExpandChange(true)
    }
  }

  const isDashboardSection = dashboardMenus.some(item => item.id === currentSection)
  const isFinanceSection = financeSubmenus.some(sub => sub.id === currentSection)

  return (
    <aside
      className={`${styles.sidebar} ${isExpanded || isPinned ? styles.expanded : ''}`}
      onMouseEnter={() => onExpandChange(true)}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.logo}>
        <span className={styles.logoLetter}>L</span>
        <span className={styles.logoText}>Lycon</span>
        <button
          className={`${styles.pinButton} ${isPinned ? styles.pinned : ''}`}
          onClick={handlePin}
          title={isPinned ? '고정 해제' : '사이드바 고정'}
        >
          {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navSection}>
          {/* 대시보드 메뉴들 - 바로 표시 */}
          {dashboardMenus.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${currentSection === item.id ? styles.active : ''}`}
              onClick={() => onSectionChange(item.id)}
              title={item.label}
            >
              <item.icon size={20} />
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}

          {/* 구분선 */}
          <div className={styles.divider} />

          {/* 나의 재무 - 접을 수 있는 메뉴 */}
          <div className={styles.navGroup}>
            <button
              className={`${styles.navItem} ${isFinanceSection ? styles.active : ''}`}
              onClick={() => setIsFinanceOpen(!isFinanceOpen)}
              title="나의 재무"
            >
              <Wallet size={20} />
              <span className={styles.navLabel}>나의 재무</span>
              <span className={styles.chevron}>
                {isFinanceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            </button>

            {isFinanceOpen && (
              <div className={styles.submenu}>
                {financeSubmenus.map((item) => (
                  <button
                    key={item.id}
                    className={`${styles.submenuItem} ${currentSection === item.id ? styles.active : ''}`}
                    onClick={() => onSectionChange(item.id)}
                    title={item.label}
                  >
                    <item.icon size={16} />
                    <span className={styles.navLabel}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div className={styles.divider} />

          <button
            className={`${styles.navItem} ${currentSection === 'progress' ? styles.active : ''}`}
            onClick={() => onSectionChange('progress')}
            title="진행 상황"
          >
            <TrendingUp size={20} />
            <span className={styles.navLabel}>진행 상황</span>
          </button>

          <button
            className={`${styles.navItem} ${currentSection === 'plans' ? styles.active : ''}`}
            onClick={() => onSectionChange('plans')}
            title="플랜"
          >
            <Target size={20} />
            <span className={styles.navLabel}>플랜</span>
          </button>
        </div>
      </nav>

      <div className={styles.footer}>
        <button
          className={styles.footerItem}
          onClick={() => router.push('/onboarding')}
          title="설정"
        >
          <Settings size={18} />
          <span className={styles.navLabel}>설정</span>
        </button>
        <button
          className={styles.footerItem}
          onClick={handleLogout}
          title="로그아웃"
        >
          <LogOut size={18} />
          <span className={styles.navLabel}>로그아웃</span>
        </button>
      </div>
    </aside>
  )
}
