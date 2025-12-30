'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, TrendingUp, Wallet, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OnboardingData, SimulationSettings, GlobalSettings } from '@/types'
import { DEFAULT_GLOBAL_SETTINGS } from '@/types'
import { Sidebar } from './components'
import {
  OverviewTab,
  NetWorthTab,
  CashFlowOverviewTab,
  TaxAnalyticsTab,
  IncomeTab,
  ExpenseTab,
  SavingsTab,
  AssetTab,
  DebtTab,
  RealEstateTab,
  PensionTab
} from './components/tabs'
import { ProgressSection } from './components/sections/ProgressSection'
import { PlansSection } from './components/sections/PlansSection'
import { ScenarioModal } from './components/modals/ScenarioModal'
import { FamilyModal } from './components/modals/FamilyModal'
import styles from './dashboard.module.css'

type ModalType = 'family' | 'scenario' | 'cashflow' | 'settings' | null

interface DashboardContentProps {
  data: OnboardingData
  initialSettings: SimulationSettings
}

const sectionTitles: Record<string, string> = {
  // Dashboard
  overview: '전체 요약',
  networth: '순자산',
  'cashflow-overview': '현금흐름',
  tax: '세금분석',
  // Finance
  income: '소득 관리',
  expense: '지출 관리',
  savings: '저축/투자 관리',
  asset: '자산 관리',
  debt: '부채 관리',
  realEstate: '부동산 관리',
  pension: '연금 관리',
  // Others
  progress: '진행 상황',
  plans: '플랜',
}

const validSections = Object.keys(sectionTitles)

export function DashboardContent({ data: initialData, initialSettings }: DashboardContentProps) {
  const [currentSection, setCurrentSection] = useState<string>('overview')
  const [data, setData] = useState<OnboardingData>(initialData)
  const [settings, setSettings] = useState<SimulationSettings>(initialSettings)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  // 글로벌 설정 (data에서 가져오거나 기본값 사용)
  const globalSettings = data.globalSettings || DEFAULT_GLOBAL_SETTINGS

  // URL 해시에서 섹션 읽기
  const getHashSection = useCallback(() => {
    if (typeof window === 'undefined') return 'overview'
    const hash = window.location.hash.slice(1)
    return validSections.includes(hash) ? hash : 'overview'
  }, [])

  // 초기 로드 시 해시에서 섹션 설정
  useEffect(() => {
    setCurrentSection(getHashSection())
  }, [getHashSection])

  // 브라우저 뒤로가기/앞으로가기 처리
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentSection(getHashSection())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [getHashSection])

  // 섹션 변경 시 URL 해시 업데이트
  const handleSectionChange = useCallback((section: string) => {
    setCurrentSection(section)
    window.history.pushState(null, '', `#${section}`)
  }, [])

  const handleUpdateData = async (updates: Partial<OnboardingData>) => {
    const newData = { ...data, ...updates }
    setData(newData)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ draft_data: newData })
          .eq('id', user.id)
      }
    } catch (error) {
      console.error('Failed to save data:', error)
    }
  }

  const renderContent = () => {
    switch (currentSection) {
      // Dashboard tabs
      case 'overview':
        return <OverviewTab data={data} settings={settings} />
      case 'networth':
        return <NetWorthTab data={data} settings={settings} />
      case 'cashflow-overview':
        return <CashFlowOverviewTab data={data} settings={settings} />
      case 'tax':
        return <TaxAnalyticsTab data={data} settings={settings} />
      // Finance tabs
      case 'income':
        return <IncomeTab data={data} onUpdateData={handleUpdateData} globalSettings={globalSettings} />
      case 'expense':
        return <ExpenseTab data={data} onUpdateData={handleUpdateData} globalSettings={globalSettings} />
      case 'savings':
        return <SavingsTab data={data} onUpdateData={handleUpdateData} />
      case 'asset':
        return <AssetTab data={data} onUpdateData={handleUpdateData} />
      case 'debt':
        return <DebtTab data={data} onUpdateData={handleUpdateData} />
      case 'realEstate':
        return <RealEstateTab data={data} onUpdateData={handleUpdateData} />
      case 'pension':
        return <PensionTab data={data} onUpdateData={handleUpdateData} />
      // Other sections
      case 'progress':
        return <ProgressSection data={data} settings={settings} />
      case 'plans':
        return <PlansSection data={data} settings={settings} />
      default:
        return null
    }
  }

  // 글로벌 설정 업데이트
  const handleUpdateGlobalSettings = (newSettings: GlobalSettings) => {
    handleUpdateData({ globalSettings: newSettings })
  }

  return (
    <div className={styles.layout}>
      <Sidebar
        currentSection={currentSection}
        onSectionChange={handleSectionChange}
        isExpanded={isSidebarExpanded}
        onExpandChange={setIsSidebarExpanded}
      />

      <main className={`${styles.main} ${isSidebarExpanded ? styles.mainExpanded : ''}`}>
        <header className={styles.header}>
          <h1 key={currentSection} className={styles.pageTitle}>{sectionTitles[currentSection]}</h1>

          <div className={styles.headerActions}>
            <button
              className={`${styles.headerActionBtn} ${activeModal === 'family' ? styles.active : ''}`}
              onClick={() => setActiveModal(activeModal === 'family' ? null : 'family')}
              title="가족 구성원"
            >
              <Users size={18} />
            </button>
            <button
              className={`${styles.headerActionBtn} ${activeModal === 'scenario' ? styles.active : ''}`}
              onClick={() => setActiveModal(activeModal === 'scenario' ? null : 'scenario')}
              title="시나리오 설정"
            >
              <TrendingUp size={18} />
            </button>
            <button
              className={`${styles.headerActionBtn} ${activeModal === 'cashflow' ? styles.active : ''}`}
              onClick={() => setActiveModal(activeModal === 'cashflow' ? null : 'cashflow')}
              title="현금 흐름 분배"
            >
              <Wallet size={18} />
            </button>
            <button
              className={`${styles.headerActionBtn} ${activeModal === 'settings' ? styles.active : ''}`}
              onClick={() => setActiveModal(activeModal === 'settings' ? null : 'settings')}
              title="설정"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className={styles.content}>
          {renderContent()}
        </div>
      </main>

      {/* 모달 */}
      {activeModal === 'scenario' && (
        <ScenarioModal
          globalSettings={globalSettings}
          onUpdate={handleUpdateGlobalSettings}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'family' && (
        <FamilyModal
          data={data}
          onUpdate={handleUpdateData}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}
