'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Target,
  ChevronDown,
  ChevronUp,
  Plus,
  HelpCircle,
  Gift,
  BookOpen,
  MessageCircle,
  Info,
  BarChart3,
  Settings,
} from 'lucide-react'
import styles from './sidebar.module.css'

const mainMenuItems = [
  { icon: LayoutDashboard, href: '/dashboard', label: 'Dashboard' },
  { icon: Wallet, href: '/dashboard/finances', label: 'Current Finances' },
  { icon: TrendingUp, href: '/dashboard/progress', label: 'Progress' },
]

const plansSubMenu = [
  { icon: TrendingUp, href: '/dashboard/projections', label: 'Current Projections' },
  { icon: Target, href: '/dashboard/plan', label: 'Original Plan + Progress' },
  { icon: Plus, href: '/dashboard/new-plan', label: 'New Plan' },
]

const bottomMenuItems = [
  { icon: HelpCircle, href: '/help', label: 'Help Center' },
  { icon: Gift, href: '/gift', label: 'Gift a Subscription' },
]

const expandableMenus = [
  { icon: BookOpen, label: 'Resources' },
  { icon: MessageCircle, label: 'Support' },
  { icon: Info, label: 'More Info' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(false)
  const [plansOpen, setPlansOpen] = useState(true)

  return (
    <aside
      className={`${styles.sidebar} ${isExpanded ? styles.sidebarExpanded : styles.sidebarCollapsed}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo */}
      <div className={styles.logoContainer}>
        <div className={styles.logoIcon}>
          <BarChart3 />
        </div>
        <span className={`${styles.logoText} ${isExpanded ? styles.logoTextVisible : styles.logoTextHidden}`}>
          Lycon
        </span>
      </div>

      {/* Main Menu */}
      <nav className={styles.nav}>
        {/* Upgrade Button */}
        <Link href="/upgrade" className={styles.menuItem}>
          <Settings className={styles.menuItemIcon} />
          <span className={`${styles.menuItemText} ${isExpanded ? styles.menuItemTextVisible : styles.menuItemTextHidden}`}>
            Upgrade
          </span>
        </Link>

        {/* Main Items */}
        {mainMenuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ''}`}
            >
              <Icon className={styles.menuItemIcon} />
              <span className={`${styles.menuItemText} ${isExpanded ? styles.menuItemTextVisible : styles.menuItemTextHidden}`}>
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* Plans Section */}
        <div className={styles.plansSection}>
          <button
            onClick={() => setPlansOpen(!plansOpen)}
            className={styles.plansButton}
          >
            <div className={styles.plansButtonLeft}>
              <Target className={styles.menuItemIcon} />
              <span className={`${styles.menuItemText} ${isExpanded ? styles.menuItemTextVisible : styles.menuItemTextHidden}`}>
                Plans
              </span>
            </div>
            {isExpanded && (
              plansOpen ? <ChevronUp className={styles.plansChevron} /> : <ChevronDown className={styles.plansChevron} />
            )}
          </button>

          {/* Plans Submenu */}
          {plansOpen && isExpanded && (
            <div className={styles.plansSubmenu}>
              {plansSubMenu.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.submenuItem} ${isActive ? styles.submenuItemActive : ''}`}
                  >
                    <Icon className={styles.submenuIcon} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className={styles.spacer} />

        {/* Bottom Items */}
        <div className={styles.bottomSection}>
          {bottomMenuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={styles.menuItem}
              >
                <Icon className={styles.menuItemIcon} />
                <span className={`${styles.menuItemText} ${isExpanded ? styles.menuItemTextVisible : styles.menuItemTextHidden}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* Expandable Bottom Menus */}
          {expandableMenus.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                className={styles.menuItem}
              >
                <Icon className={styles.menuItemIcon} />
                <span className={`${styles.menuItemText} ${isExpanded ? styles.menuItemTextVisible : styles.menuItemTextHidden}`}>
                  {item.label}
                </span>
                {isExpanded && <ChevronDown className={styles.plansChevron} />}
              </button>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}
