'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Button } from '@/components/ui/button'
import {
  generateRetirementSimulation,
  calculateMonthlyTotals,
  calculateNetWorth,
} from '@/lib/calculations/retirement'
import type { Asset, Profile } from '@/types'
import {
  Menu,
  Settings,
  Bell,
  TrendingUp,
  Home,
  Landmark,
  Car,
  PiggyBank,
  Wallet,
  CreditCard,
  Building,
  Coins,
  BadgeDollarSign,
  LogOut,
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import styles from './dashboard.module.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

interface DashboardContentProps {
  profile: Profile
  assets: Asset[]
}

function formatKRW(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만`
  }
  return amount.toLocaleString()
}

const assetIcons: Record<string, typeof Home> = {
  '아파트': Home,
  '부동산': Building,
  '예금': Landmark,
  '주식': TrendingUp,
  'ETF': TrendingUp,
  '펀드': PiggyBank,
  '연금': Coins,
  '퇴직': BadgeDollarSign,
  'IRP': BadgeDollarSign,
  '차': Car,
  '자동차': Car,
  '대출': CreditCard,
  '부채': CreditCard,
}

function getAssetIcon(name: string) {
  for (const [key, Icon] of Object.entries(assetIcons)) {
    if (name.includes(key)) return Icon
  }
  return Wallet
}

const assetColorClasses = [
  styles.bgCyan,
  styles.bgEmerald,
  styles.bgBlue,
  styles.bgViolet,
  styles.bgAmber,
  styles.bgRose,
  styles.bgTeal,
  styles.bgIndigo,
]

function calculateAge(birthDate: string): number {
  if (!birthDate) return 0
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export function DashboardContent({ profile, assets }: DashboardContentProps) {
  const router = useRouter()
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '1Y' | '5Y' | '10Y' | 'ALL'>('ALL')

  const currentAge = calculateAge(profile.birth_date)
  const totals = calculateMonthlyTotals(assets)
  const netWorth = calculateNetWorth(totals)

  const assetItems = assets.filter(a => ['real_estate', 'asset'].includes(a.category))
  const debtItems = assets.filter(a => a.category === 'debt')
  const totalAssets = totals.realEstate + totals.asset
  const totalDebts = totals.debt

  const simulationData = generateRetirementSimulation({
    currentAge,
    retirementAge: profile.target_retirement_age,
    lifeExpectancy: 90,
    currentAssets: netWorth,
    monthlyIncome: totals.income,
    monthlyExpense: totals.expense,
    monthlyPension: totals.pension,
    annualReturnRate: 0.05,
    inflationRate: 0.02,
  })

  const chartData = {
    labels: simulationData.map(d => d.age),
    datasets: [
      {
        data: simulationData.map(d => d.assets),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#06b6d4',
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { raw: number }) => `₩${formatKRW(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { color: '#94a3b8', maxTicksLimit: 6 },
      },
      y: {
        display: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          color: '#94a3b8',
          callback: (value: number) => formatKRW(value),
        },
      },
    },
  }

  const initialAssets = simulationData[0]?.assets || 0
  const maxAssets = Math.max(...simulationData.map(d => d.assets))
  const changePercent = initialAssets > 0 ? ((maxAssets - initialAssets) / initialAssets * 100).toFixed(1) : 0

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className={styles.container}>
      <Sidebar />

      <div className={styles.mainContent}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.iconButton}>
              <Menu size={20} />
            </button>
            <h1 className={styles.headerTitle}>Dashboard</h1>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.iconButton}>
              <Bell size={20} />
            </button>
            <button className={styles.iconButton}>
              <Settings size={20} />
            </button>
            <div className={styles.avatar}>
              {profile.name.charAt(0)}
            </div>
            <button
              onClick={handleLogout}
              className={styles.iconButton}
              title="로그아웃"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className={styles.main}>
          <div className={styles.grid}>
            {/* NET WORTH Section */}
            <div className={styles.netWorthSection}>
              <div className={styles.netWorthCard}>
                <div className={styles.netWorthHeader}>
                  <div>
                    <p className={styles.netWorthLabel}>NET WORTH</p>
                    <h2 className={styles.netWorthValue}>₩{formatKRW(netWorth)}</h2>
                    <div className={styles.netWorthChange}>
                      <span className={styles.netWorthTime}>ALL TIME</span>
                      <span className={styles.netWorthDelta}>
                        <TrendingUp size={16} />
                        +₩{formatKRW(maxAssets - initialAssets)} ({changePercent}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.chartContainer}>
                  <Line data={chartData} options={chartOptions as never} />
                </div>

                <div className={styles.timeRangeSelector}>
                  {(['1M', '3M', '1Y', '5Y', '10Y', 'ALL'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`${styles.timeRangeButton} ${timeRange === range ? styles.timeRangeButtonActive : ''}`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ASSETS & LIABILITIES */}
            <div className={styles.assetsSection}>
              {/* Assets */}
              <div className={styles.assetCard}>
                <div className={styles.assetCardHeader}>
                  <p className={styles.assetCardLabel}>ASSETS</p>
                  <h3 className={styles.assetCardValue}>₩{formatKRW(totalAssets)}</h3>
                </div>
                <div className={styles.assetList}>
                  {assetItems.map((asset, idx) => {
                    const Icon = getAssetIcon(asset.name)
                    const colorClass = assetColorClasses[idx % assetColorClasses.length]
                    return (
                      <div key={asset.id} className={styles.assetItem}>
                        <div className={styles.assetItemLeft}>
                          <div className={`${styles.assetIcon} ${colorClass}`}>
                            <Icon size={16} />
                          </div>
                          <span className={styles.assetName}>{asset.name}</span>
                        </div>
                        <span className={styles.assetAmount}>₩{formatKRW(asset.amount)}</span>
                      </div>
                    )
                  })}
                  {assetItems.length === 0 && (
                    <p className={styles.emptyText}>등록된 자산이 없습니다</p>
                  )}
                </div>
              </div>

              {/* Liabilities */}
              <div className={styles.assetCard}>
                <div className={styles.assetCardHeader}>
                  <p className={styles.assetCardLabel}>LIABILITIES</p>
                  <h3 className={styles.assetCardValue}>₩{formatKRW(totalDebts)}</h3>
                </div>
                <div className={styles.assetList}>
                  {debtItems.map((debt) => {
                    const Icon = getAssetIcon(debt.name)
                    return (
                      <div key={debt.id} className={styles.assetItem}>
                        <div className={styles.assetItemLeft}>
                          <div className={`${styles.assetIcon} ${styles.bgRose}`}>
                            <Icon size={16} />
                          </div>
                          <span className={styles.assetName}>{debt.name}</span>
                        </div>
                        <span className={styles.assetAmount}>₩{formatKRW(debt.amount)}</span>
                      </div>
                    )
                  })}
                  {debtItems.length === 0 && (
                    <p className={styles.emptyText}>등록된 부채가 없습니다</p>
                  )}
                </div>
              </div>
            </div>

            {/* Plans for the Future */}
            <div className={styles.plansSection}>
              <div className={styles.plansSectionHeader}>
                <h3 className={styles.plansSectionTitle}>
                  <span className={styles.plansSectionTitleBold}>Plans</span> for the Future
                </h3>
                <select className={styles.plansSelect}>
                  <option>Next 20 Years</option>
                  <option>Next 30 Years</option>
                  <option>Until Retirement</option>
                </select>
              </div>

              <div className={styles.plansGrid}>
                {/* Current Projections Card */}
                <div className={styles.planCard}>
                  <div className={styles.planCardHeader}>
                    <div className={`${styles.planCardIcon} ${styles.planCardIconCyan}`}>
                      <TrendingUp />
                    </div>
                    <div>
                      <h4 className={styles.planCardTitle}>Current Projections</h4>
                      <p className={styles.planCardSubtitle}>Now</p>
                    </div>
                  </div>
                  <div className={styles.planChartContainer}>
                    <Line
                      data={{
                        labels: simulationData.slice(0, 20).map(d => d.age),
                        datasets: [{
                          data: simulationData.slice(0, 20).map(d => d.assets),
                          borderColor: '#06b6d4',
                          backgroundColor: 'rgba(6, 182, 212, 0.1)',
                          fill: true,
                          tension: 0.4,
                          pointRadius: 0,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { display: false },
                          y: {
                            display: true,
                            grid: { display: false },
                            ticks: {
                              color: '#94a3b8',
                              callback: (value: number) => formatKRW(value),
                              maxTicksLimit: 3,
                            },
                          },
                        },
                      } as never}
                    />
                  </div>
                </div>

                {/* Retirement Goal Card */}
                <div className={styles.planCard}>
                  <div className={styles.planCardHeader}>
                    <div className={`${styles.planCardIcon} ${styles.planCardIconViolet}`}>
                      <PiggyBank />
                    </div>
                    <div>
                      <h4 className={styles.planCardTitle}>은퇴 목표</h4>
                      <p className={styles.planCardSubtitle}>{profile.target_retirement_age}세까지</p>
                    </div>
                  </div>
                  <div className={styles.goalStats}>
                    <div className={styles.goalStatRow}>
                      <span className={styles.goalStatLabel}>현재 순자산</span>
                      <span className={styles.goalStatValue}>₩{formatKRW(netWorth)}</span>
                    </div>
                    <div className={styles.goalStatRow}>
                      <span className={styles.goalStatLabel}>목표 금액</span>
                      <span className={styles.goalStatValue}>₩{formatKRW(profile.target_retirement_fund)}</span>
                    </div>
                    <div className={styles.goalProgressBar}>
                      <div
                        className={styles.goalProgressFill}
                        style={{ width: `${Math.min((netWorth / profile.target_retirement_fund) * 100, 100)}%` }}
                      />
                    </div>
                    <p className={styles.goalProgressText}>
                      {((netWorth / profile.target_retirement_fund) * 100).toFixed(1)}% 달성
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className={styles.quickActions}>
              <Button
                variant="outline"
                onClick={() => router.push('/onboarding')}
                className={styles.actionButton}
              >
                <Settings size={16} />
                자산 정보 수정
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
