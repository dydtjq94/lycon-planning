'use client'

import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import type { OnboardingData, SimulationSettings } from '@/types'
import styles from '../../dashboard.module.css'

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

interface NetWorthTabProps {
  data: OnboardingData
  settings: SimulationSettings
}

// 금액 포맷팅 (억/만원)
function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    const uk = amount / 10000
    return `${uk.toFixed(1).replace(/\.0$/, '')}억`
  }
  return `${amount.toLocaleString()}만원`
}

// 나이 계산
function calculateAge(birthDate: string): number {
  if (!birthDate) return 35
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export function NetWorthTab({ data, settings }: NetWorthTabProps) {
  const currentAge = calculateAge(data.birth_date)
  const retirementAge = data.target_retirement_age || 60

  // 자산 계산
  const realEstateAsset = data.housingType === '자가' ? (data.housingValue || 0) : 0
  const depositAsset = data.housingType === '전세' ? (data.housingValue || 0) : 0
  const cashAssets = (data.cashCheckingAccount || 0) + (data.cashSavingsAccount || 0)
  const investAssets = (data.investDomesticStock || 0) + (data.investForeignStock || 0) +
    (data.investFund || 0) + (data.investOther || 0)
  const pensionAssets = (data.retirementPensionBalance || 0) +
    (data.irpBalance || 0) + (data.pensionSavingsBalance || 0) + (data.isaBalance || 0)

  const totalAssets = realEstateAsset + depositAsset + cashAssets + investAssets + pensionAssets

  // 부채 계산
  const housingDebt = data.housingHasLoan ? (data.housingLoan || 0) : 0
  const otherDebts = data.debts?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0
  const totalDebts = housingDebt + otherDebts

  // 순자산
  const netWorth = totalAssets - totalDebts

  // 월 저축액
  const monthlyIncome = (data.laborIncome || 0) + (data.businessIncome || 0) +
    (data.spouseLaborIncome || 0) + (data.spouseBusinessIncome || 0)
  const monthlyExpense = data.livingExpenses || 0
  const monthlySavings = monthlyIncome - monthlyExpense
  const annualSavings = monthlySavings * 12
  const savingsRate = monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 100) : 0

  // 자산 구성 차트
  const assetLabels = []
  const assetValues = []
  const assetColors = []
  if (realEstateAsset > 0) { assetLabels.push('부동산'); assetValues.push(realEstateAsset); assetColors.push('#5856d6') }
  if (depositAsset > 0) { assetLabels.push('전세보증금'); assetValues.push(depositAsset); assetColors.push('#af52de') }
  if (cashAssets > 0) { assetLabels.push('현금성'); assetValues.push(cashAssets); assetColors.push('#34c759') }
  if (investAssets > 0) { assetLabels.push('투자자산'); assetValues.push(investAssets); assetColors.push('#007aff') }
  if (pensionAssets > 0) { assetLabels.push('연금자산'); assetValues.push(pensionAssets); assetColors.push('#ff9500') }

  const assetData = {
    labels: assetLabels,
    datasets: [{
      data: assetValues,
      backgroundColor: assetColors,
      borderWidth: 0,
    }],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 12,
          usePointStyle: true,
          font: { size: 11 },
          generateLabels: (chart: ChartJS) => {
            const data = chart.data
            if (data.labels && data.datasets.length) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const dataset = data.datasets[0] as any
              const bgColors = dataset.backgroundColor as string[]
              return data.labels.map((label, i) => {
                const value = dataset.data[i] as number
                const color = bgColors?.[i] ?? '#78716c'
                return {
                  text: `${label} ${formatMoney(value)}`,
                  fillStyle: color,
                  hidden: false,
                  index: i,
                }
              })
            }
            return []
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: { label: string; parsed: number }) =>
            `${context.label}: ${formatMoney(context.parsed)}`,
        },
      },
    },
    cutout: '65%',
  }

  // 순자산 성장 시뮬레이션
  const years = Array.from({ length: 31 }, (_, i) => i) // 0~30년
  const annualReturn = (settings.investmentReturn || 5) / 100

  const projectedNetWorth = years.map(year => {
    let assets = netWorth
    for (let i = 0; i < year; i++) {
      assets = assets * (1 + annualReturn) + annualSavings
    }
    return Math.round(assets)
  })

  // 마일스톤 도달 연도 계산
  const milestones = [
    { name: '1억', target: 10000, color: '#34c759' },
    { name: '3억', target: 30000, color: '#007aff' },
    { name: '5억', target: 50000, color: '#5856d6' },
    { name: '10억', target: 100000, color: '#ff9500' },
  ]

  const milestoneYears = milestones.map(m => {
    if (netWorth >= m.target) return { ...m, year: 0, achieved: true }
    const yearIndex = projectedNetWorth.findIndex(v => v >= m.target)
    return {
      ...m,
      year: yearIndex === -1 ? null : yearIndex,
      achieved: false,
    }
  })

  const growthData = {
    labels: years.filter((_, i) => i % 5 === 0).map(y => y === 0 ? '현재' : `${y}년`),
    datasets: [{
      label: '예상 순자산',
      data: years.filter((_, i) => i % 5 === 0).map(y => projectedNetWorth[y]),
      borderColor: '#007aff',
      backgroundColor: 'rgba(0, 122, 255, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#007aff',
    }],
  }

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number | null } }) =>
            `순자산: ${formatMoney(context.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => {
            const num = Number(value)
            if (num >= 10000) return `${(num / 10000).toFixed(0)}억`
            return `${num.toLocaleString()}만`
          },
        },
        grid: { color: '#f5f5f4' },
      },
      x: {
        grid: { display: false },
      },
    },
  }

  // 현재 진행 중인 마일스톤
  const currentMilestone = milestoneYears.find(m => !m.achieved)
  const progressToMilestone = currentMilestone
    ? Math.min(100, Math.round((netWorth / currentMilestone.target) * 100))
    : 100

  // FI(경제적 자유) 계산 - 연간 지출의 25배
  const annualExpense = monthlyExpense * 12
  const fiTarget = annualExpense * 25
  const fiProgress = fiTarget > 0 ? Math.round((netWorth / fiTarget) * 100) : 0
  const yearsToFI = projectedNetWorth.findIndex(v => v >= fiTarget)

  return (
    <div className={styles.tabLayout}>
      {/* 요약 섹션 */}
      <div className={styles.tabInputSection}>
        {/* 순자산 메인 */}
        <div style={{
          textAlign: 'center',
          padding: '24px 0',
          borderBottom: '1px solid #e7e5e4',
          marginBottom: 20
        }}>
          <p style={{ fontSize: 13, color: '#78716c', marginBottom: 8 }}>총 순자산</p>
          <p style={{
            fontSize: 36,
            fontWeight: 700,
            color: netWorth >= 0 ? '#292524' : '#ff3b30',
            marginBottom: 4
          }}>
            {formatMoney(netWorth)}
          </p>
          <p style={{ fontSize: 12, color: '#a8a29e' }}>
            자산 {formatMoney(totalAssets)} - 부채 {formatMoney(totalDebts)}
          </p>
        </div>

        {/* 자산/부채 요약 */}
        <div style={{ marginBottom: 20 }}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>총 자산</span>
            <span className={styles.statValue} style={{ color: '#34c759' }}>
              {formatMoney(totalAssets)}
            </span>
          </div>
          <div style={{ paddingLeft: 12, marginBottom: 8 }}>
            {realEstateAsset > 0 && (
              <div className={styles.statRow}>
                <span style={{ fontSize: 12, color: '#78716c' }}>부동산</span>
                <span style={{ fontSize: 12, color: '#57534e' }}>{formatMoney(realEstateAsset)}</span>
              </div>
            )}
            {depositAsset > 0 && (
              <div className={styles.statRow}>
                <span style={{ fontSize: 12, color: '#78716c' }}>전세보증금</span>
                <span style={{ fontSize: 12, color: '#57534e' }}>{formatMoney(depositAsset)}</span>
              </div>
            )}
            {cashAssets > 0 && (
              <div className={styles.statRow}>
                <span style={{ fontSize: 12, color: '#78716c' }}>현금성 자산</span>
                <span style={{ fontSize: 12, color: '#57534e' }}>{formatMoney(cashAssets)}</span>
              </div>
            )}
            {investAssets > 0 && (
              <div className={styles.statRow}>
                <span style={{ fontSize: 12, color: '#78716c' }}>투자 자산</span>
                <span style={{ fontSize: 12, color: '#57534e' }}>{formatMoney(investAssets)}</span>
              </div>
            )}
            {pensionAssets > 0 && (
              <div className={styles.statRow}>
                <span style={{ fontSize: 12, color: '#78716c' }}>연금 자산</span>
                <span style={{ fontSize: 12, color: '#57534e' }}>{formatMoney(pensionAssets)}</span>
              </div>
            )}
          </div>

          <div className={styles.statRow}>
            <span className={styles.statLabel}>총 부채</span>
            <span className={styles.statValue} style={{ color: totalDebts > 0 ? '#ff3b30' : '#a8a29e' }}>
              {totalDebts > 0 ? `-${formatMoney(totalDebts)}` : '0원'}
            </span>
          </div>
          {totalDebts > 0 && (
            <div style={{ paddingLeft: 12 }}>
              {housingDebt > 0 && (
                <div className={styles.statRow}>
                  <span style={{ fontSize: 12, color: '#78716c' }}>주택담보대출</span>
                  <span style={{ fontSize: 12, color: '#57534e' }}>{formatMoney(housingDebt)}</span>
                </div>
              )}
              {otherDebts > 0 && (
                <div className={styles.statRow}>
                  <span style={{ fontSize: 12, color: '#78716c' }}>기타 대출</span>
                  <span style={{ fontSize: 12, color: '#57534e' }}>{formatMoney(otherDebts)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 월 저축 현황 */}
        <div style={{
          padding: 16,
          backgroundColor: '#f5f5f4',
          borderRadius: 12,
          marginBottom: 20
        }}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>월 저축</span>
            <span className={styles.statValue} style={{ color: '#007aff' }}>
              {formatMoney(monthlySavings)}
            </span>
          </div>
          <div className={styles.statRow}>
            <span style={{ fontSize: 12, color: '#78716c' }}>저축률</span>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: savingsRate >= 30 ? '#34c759' : savingsRate >= 15 ? '#ff9500' : '#ff3b30'
            }}>
              {savingsRate}%
            </span>
          </div>
          <div className={styles.statRow}>
            <span style={{ fontSize: 12, color: '#78716c' }}>연간 저축</span>
            <span style={{ fontSize: 12, color: '#57534e' }}>{formatMoney(annualSavings)}</span>
          </div>
        </div>

        {/* 경제적 자유 (FI) */}
        <div style={{
          padding: 16,
          backgroundColor: '#fef3c7',
          borderRadius: 12
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>
            경제적 자유 (FI)
          </p>
          <p style={{ fontSize: 11, color: '#a16207', marginBottom: 12 }}>
            연간 지출 x 25 = {formatMoney(fiTarget)}
          </p>
          <div style={{
            height: 8,
            backgroundColor: '#fde68a',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 8
          }}>
            <div style={{
              width: `${Math.min(100, fiProgress)}%`,
              height: '100%',
              backgroundColor: '#f59e0b',
              borderRadius: 4
            }} />
          </div>
          <div className={styles.statRow}>
            <span style={{ fontSize: 12, color: '#a16207' }}>달성률</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>{fiProgress}%</span>
          </div>
          {yearsToFI > 0 && (
            <p style={{ fontSize: 11, color: '#a16207', marginTop: 4 }}>
              현재 속도면 약 {yearsToFI}년 후 달성 예상
            </p>
          )}
        </div>
      </div>

      {/* 차트 섹션 */}
      <div className={styles.tabChartSection}>
        {/* 순자산 성장 예측 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>순자산 성장 예측</h4>
          <p style={{ fontSize: 12, color: '#78716c', marginBottom: 16 }}>
            연 {settings.investmentReturn}% 수익률, 월 {formatMoney(monthlySavings)} 저축 가정
          </p>
          <div className={styles.chartWrapper} style={{ height: 280 }}>
            <Line data={growthData} options={lineOptions} />
          </div>
        </div>

        {/* 마일스톤 */}
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>마일스톤</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {milestoneYears.map((m) => (
              <div key={m.name} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                backgroundColor: m.achieved ? '#dcfce7' : '#f5f5f4',
                borderRadius: 8
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: m.achieved ? '#34c759' : '#e7e5e4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: m.achieved ? 'white' : '#78716c',
                  fontSize: 12,
                  fontWeight: 600
                }}>
                  {m.achieved ? '!' : m.name}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: m.achieved ? '#166534' : '#292524'
                  }}>
                    {m.name} {m.achieved ? '달성' : '목표'}
                  </p>
                  <p style={{ fontSize: 12, color: m.achieved ? '#16a34a' : '#78716c' }}>
                    {m.achieved
                      ? '축하합니다!'
                      : m.year !== null
                        ? `약 ${m.year}년 후 (${currentAge + m.year}세)`
                        : '30년 이후 예상'}
                  </p>
                </div>
                {!m.achieved && m.year !== null && (
                  <div style={{
                    fontSize: 12,
                    color: '#007aff',
                    fontWeight: 500
                  }}>
                    {new Date().getFullYear() + m.year}년
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 자산 구성 */}
        {totalAssets > 0 && (
          <div className={styles.chartCard}>
            <h4 className={styles.chartTitle}>자산 구성</h4>
            <div style={{ height: 220 }}>
              <Doughnut data={assetData} options={doughnutOptions} />
            </div>
          </div>
        )}

        {/* 현재 마일스톤 진행률 */}
        {currentMilestone && (
          <div className={styles.chartCard}>
            <h4 className={styles.chartTitle}>다음 목표: {currentMilestone.name}</h4>
            <div style={{
              position: 'relative',
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#e7e5e4"
                  strokeWidth="12"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke={currentMilestone.color}
                  strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 54 * progressToMilestone / 100} ${2 * Math.PI * 54}`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div style={{
                position: 'absolute',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#292524' }}>
                  {progressToMilestone}%
                </p>
              </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#78716c', marginTop: 8 }}>
              {formatMoney(netWorth)} / {formatMoney(currentMilestone.target)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
